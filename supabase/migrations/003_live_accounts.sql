-- ============================================================================
-- 003: Live accounts — automatic profile creation + admin membership RPCs
-- Run AFTER 001_initial_schema.sql and 002_weekly_schedule.sql.
-- Safe to re-run: functions are CREATE OR REPLACE, triggers are dropped first.
-- ============================================================================
-- Why this file exists:
-- * Registering in the app creates a Supabase Auth user. Something must also
--   create that person's row in public.profiles (status 'pending') and their
--   row in public.user_roles (role 'member'), otherwise admin tools such as
--   bootstrap_first_admin() cannot find the account. A trigger on auth.users
--   is the reliable place: it runs even when email confirmation is switched
--   on and the new user has no session yet.
-- * Admins approve / decline members and change roles through two guarded
--   RPCs instead of raw table updates, so the check + audit entry are atomic.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auto-create profile + member role for every new Auth user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), '');
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    -- Fall back to the part of the email before '@' so the NOT NULL name
    -- constraint can never block a signup.
    v_name := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, membership_status, privacy_accepted_at)
  VALUES (
    NEW.id,
    lower(NEW.email),
    v_name,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    'pending',
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Only the trigger may call this; never expose it to app clients.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Admin/treasurer: approve, decline or reset a membership (audited)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_membership(
  p_target_user UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_target_name TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.has_admin_or_treasurer_role(v_actor) THEN
    RAISE EXCEPTION 'Access denied: Only administrators or treasurers can change membership status.';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid membership status: %', p_status;
  END IF;

  SELECT full_name INTO v_target_name FROM public.profiles WHERE id = p_target_user;
  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'No profile found for that user.';
  END IF;

  UPDATE public.profiles
  SET membership_status = p_status::public.membership_status_enum,
      approved_by = CASE WHEN p_status = 'approved' THEN v_actor ELSE approved_by END,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
      updated_at = now()
  WHERE id = p_target_user;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.audit_logs (actor_id, actor_name, action_type, entity_type, entity_id, summary)
  VALUES (
    v_actor,
    COALESCE(v_actor_name, 'Administrator'),
    CASE p_status
      WHEN 'approved' THEN 'APPROVE_MEMBER'
      WHEN 'rejected' THEN 'REJECT_MEMBER'
      ELSE 'RESET_MEMBER_STATUS'
    END,
    'profiles',
    p_target_user::text,
    format(
      '%s was set to %s by %s%s',
      v_target_name,
      p_status,
      COALESCE(v_actor_name, 'an administrator'),
      CASE WHEN p_reason IS NULL OR trim(p_reason) = '' THEN '' ELSE format(' — reason: %s', trim(p_reason)) END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_membership(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_membership(UUID, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Admin only: change a member's role (audited, last admin protected)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_target_user UUID,
  p_role public.app_role_enum
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_target_name TEXT;
  v_old_role public.app_role_enum;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Access denied: You must be signed in.';
  END IF;

  -- Role changes are stricter than approvals: administrators only, never treasurers.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only administrators can change roles.';
  END IF;

  SELECT full_name INTO v_target_name FROM public.profiles WHERE id = p_target_user;
  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'No profile found for that user.';
  END IF;

  SELECT role INTO v_old_role FROM public.user_roles WHERE user_id = p_target_user;

  -- Never leave the group with zero administrators.
  IF v_old_role = 'admin' AND p_role <> 'admin' THEN
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'You cannot remove the last administrator. Promote another administrator first.';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
  VALUES (p_target_user, p_role, v_actor, now())
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role, assigned_by = EXCLUDED.assigned_by, assigned_at = EXCLUDED.assigned_at;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.audit_logs (actor_id, actor_name, action_type, entity_type, entity_id, summary)
  VALUES (
    v_actor,
    COALESCE(v_actor_name, 'Administrator'),
    'SET_ROLE',
    'user_roles',
    p_target_user::text,
    format('%s role changed from %s to %s by %s', v_target_name, COALESCE(v_old_role::text, 'member'), p_role::text, COALESCE(v_actor_name, 'an administrator'))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(UUID, public.app_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(UUID, public.app_role_enum) TO authenticated;
