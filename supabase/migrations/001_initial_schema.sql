-- ============================================================================
-- HAVE R/C JHS 2022 CONTRIBUTION & GROUP FUND APP
-- Supabase PostgreSQL Schema, Constraints, Atomic Functions & RLS Policies
-- Migration: 001_initial_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS & CUSTOM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.membership_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role_enum AS ENUM ('member', 'treasurer', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_frequency_enum AS ENUM ('weekly', 'monthly', 'quarterly', 'annual', 'one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.obligation_status_enum AS ENUM ('unpaid', 'partially_paid', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status_enum AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_status_enum AS ENUM ('posted', 'adjusted', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type_enum AS ENUM (
    'income',
    'other_income',
    'expense',
    'expense_reversal',
    'expense_adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES & USER ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  membership_status public.membership_status_enum NOT NULL DEFAULT 'pending',
  privacy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Separate roles table so members can NEVER escalate their own privileges via profile updates
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role_enum NOT NULL DEFAULT 'member',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(membership_status);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ----------------------------------------------------------------------------
-- 3. CONTRIBUTION RULES, PERIODS & MEMBER OBLIGATIONS
-- ----------------------------------------------------------------------------
-- Note: amount_ghs is NULLABLE and is_active defaults to FALSE because the group
-- has not yet decided the contribution amount until an administrator configures it.
CREATE TABLE IF NOT EXISTS public.contribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Have R/C JHS 2022 Standard Contribution',
  amount_ghs NUMERIC(12, 2) CHECK (amount_ghs IS NULL OR amount_ghs > 0),
  frequency public.payment_frequency_enum NOT NULL DEFAULT 'monthly',
  start_date DATE,
  due_day INTEGER NOT NULL DEFAULT 28 CHECK (due_day BETWEEN 1 AND 31),
  grace_period_days INTEGER NOT NULL DEFAULT 5 CHECK (grace_period_days BETWEEN 0 AND 60),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  treasurer_momo_number TEXT NOT NULL DEFAULT '024 000 0000',
  treasurer_momo_name TEXT NOT NULL DEFAULT 'Have R/C JHS 2022 Welfare Fund',
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT active_rule_requires_amount_and_start CHECK (
    (is_active = FALSE) OR (amount_ghs IS NOT NULL AND amount_ghs > 0 AND start_date IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.contribution_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.contribution_rules(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL UNIQUE, -- e.g. '2026-08', '2026-09', '2026-10'
  period_label TEXT NOT NULL,     -- e.g. 'August 2026', 'September 2026'
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  grace_period_days INTEGER NOT NULL DEFAULT 5,
  amount_due_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_due_ghs > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contribution_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.contribution_periods(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  due_date DATE NOT NULL,
  grace_period_days INTEGER NOT NULL DEFAULT 5,
  amount_due_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_due_ghs > 0),
  amount_paid_ghs NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid_ghs >= 0 AND amount_paid_ghs <= amount_due_ghs),
  status public.obligation_status_enum NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_period_obligation UNIQUE (member_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_obligations_member ON public.contribution_obligations(member_id);
CREATE INDEX IF NOT EXISTS idx_obligations_period ON public.contribution_obligations(period_id);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.contribution_obligations(status);

-- ----------------------------------------------------------------------------
-- 4. SECURE FILE ATTACHMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('payment_evidence', 'expense_evidence', 'avatar')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  data_url TEXT, -- Used for preview / local storage fallback when authorized
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. PAYMENT SUBMISSIONS & ALLOCATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_ghs > 0),
  allocated_amount_ghs NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (allocated_amount_ghs >= 0 AND allocated_amount_ghs <= amount_ghs),
  unallocated_credit_ghs NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unallocated_credit_ghs >= 0),
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (char_length(trim(payment_method)) > 0),
  transaction_reference TEXT, -- Restricted to submitting member & admins
  evidence_attachment_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  target_period_id UUID REFERENCES public.contribution_periods(id) ON DELETE SET NULL,
  notes TEXT,
  status public.payment_status_enum NOT NULL DEFAULT 'pending',
  is_offline_entry BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payment_submissions(id) ON DELETE RESTRICT,
  obligation_id UUID NOT NULL REFERENCES public.contribution_obligations(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_allocated_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_allocated_ghs > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_obligation_allocation UNIQUE (payment_id, obligation_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_member ON public.payment_submissions(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_obligation ON public.payment_allocations(obligation_id);

-- ----------------------------------------------------------------------------
-- 6. EXPENSES & AUDITED EXPENSE ADJUSTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
  amount_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_ghs > 0),
  effective_amount_ghs NUMERIC(12, 2) NOT NULL CHECK (effective_amount_ghs >= 0),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
  expense_date DATE NOT NULL,
  category TEXT DEFAULT 'General',
  vendor_paid TEXT,
  evidence_attachment_id UUID REFERENCES public.file_attachments(id) ON DELETE SET NULL,
  has_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  status public.expense_status_enum NOT NULL DEFAULT 'posted',
  exceeded_balance_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('reversal', 'amount_adjustment')),
  previous_amount_ghs NUMERIC(12, 2) NOT NULL,
  new_amount_ghs NUMERIC(12, 2) NOT NULL CHECK (new_amount_ghs >= 0),
  delta_ghs NUMERIC(12, 2) NOT NULL, -- new_amount_ghs - previous_amount_ghs
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
  adjusted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  adjusted_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_adjustments_expense ON public.expense_adjustments(expense_id);

-- ----------------------------------------------------------------------------
-- 7. IMMUTABLE FINANCIAL LEDGER
-- ----------------------------------------------------------------------------
-- Every verified contribution, other income, posted expense, or expense adjustment
-- generates exactly ONE traceable row in financial_ledger.
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  entry_type public.ledger_entry_type_enum NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_ghs NUMERIC(12, 2) NOT NULL CHECK (amount_ghs > 0),
  -- signed_amount_ghs: +amount for income/reversal, -amount for expense
  signed_amount_ghs NUMERIC(12, 2) NOT NULL,
  recorded_status TEXT NOT NULL DEFAULT 'Posted',
  -- Unique foreign keys prevent duplicate postings of the same payment or expense
  source_payment_id UUID UNIQUE REFERENCES public.payment_submissions(id) ON DELETE RESTRICT,
  source_expense_id UUID UNIQUE REFERENCES public.expenses(id) ON DELETE RESTRICT,
  source_adjustment_id UUID UNIQUE REFERENCES public.expense_adjustments(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.financial_ledger(entry_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.financial_ledger(entry_type);

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS & AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'membership_approved',
    'payment_submitted',
    'payment_verified',
    'payment_rejected',
    'contribution_due',
    'outstanding_reminder',
    'expense_recorded',
    'system'
  )),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. HELPER FUNCTIONS FOR ACCESS CONTROL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_admin_or_treasurer_role(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = check_user_id
      AND p.membership_status = 'approved'
      AND ur.role IN ('admin', 'treasurer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_member(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = check_user_id
      AND p.membership_status = 'approved'
  );
$$;

-- ----------------------------------------------------------------------------
-- 10. SECURE ADMIN BOOTSTRAP FUNCTION (NEVER VIA SIGNUP)
-- ----------------------------------------------------------------------------
-- Run ONLY by the database owner inside the Supabase SQL Editor to promote the
-- initial administrator after they create a standard account.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(target_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_name TEXT;
BEGIN
  SELECT id, full_name INTO v_user_id, v_name
  FROM public.profiles
  WHERE lower(email) = lower(trim(target_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No registered profile found for email: %', target_email;
  END IF;

  UPDATE public.profiles
  SET membership_status = 'approved',
      approved_at = now(),
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.user_roles (user_id, role, assigned_at)
  VALUES (v_user_id, 'admin', now())
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin', assigned_at = now();

  INSERT INTO public.audit_logs (actor_id, actor_name, action_type, entity_type, entity_id, summary)
  VALUES (v_user_id, COALESCE(v_name, 'System Bootstrap'), 'BOOTSTRAP_ADMIN', 'user_roles', v_user_id::text,
          format('Initial administrator role assigned securely to %s (%s)', v_name, target_email));
END;
$$;

-- Revoke public execution of bootstrap_first_admin so only postgres/service_role in SQL Editor can run it
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. BLOCK SILENT DELETION OF POSTED FINANCIAL RECORDS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_financial_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Deleting posted financial records is prohibited for audit integrity. Use the controlled reversal/adjustment process.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_expense_delete ON public.expenses;
CREATE TRIGGER trg_prevent_expense_delete
BEFORE DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_prevent_ledger_delete ON public.financial_ledger;
CREATE TRIGGER trg_prevent_ledger_delete
BEFORE DELETE ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_deletion();

-- ----------------------------------------------------------------------------
-- 12. ATOMIC RPC: VERIFY PAYMENT & ALLOCATE TO OBLIGATIONS + LEDGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_payment_submission(
  p_submission_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_sub RECORD;
  v_member_name TEXT;
  v_remaining NUMERIC(12, 2);
  v_ob RECORD;
  v_needed NUMERIC(12, 2);
  v_alloc NUMERIC(12, 2);
  v_total_allocated NUMERIC(12, 2) := 0;
BEGIN
  IF NOT public.has_admin_or_treasurer_role(v_actor_id) THEN
    RAISE EXCEPTION 'Access denied: Only authorized administrators or treasurers can verify payments.';
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

  SELECT * INTO v_sub
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found.';
  END IF;

  IF v_sub.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment submission has already been processed (current status: %).', v_sub.status;
  END IF;

  SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_sub.member_id;

  v_remaining := v_sub.amount_ghs;

  -- Allocate across unpaid/partially paid obligations in chronological due_date order
  FOR v_ob IN
    SELECT *
    FROM public.contribution_obligations
    WHERE member_id = v_sub.member_id
      AND status <> 'paid'
      AND amount_paid_ghs < amount_due_ghs
    ORDER BY
      CASE WHEN id = v_sub.target_period_id THEN 0 ELSE 1 END,
      due_date ASC,
      created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_needed := v_ob.amount_due_ghs - v_ob.amount_paid_ghs;
    v_alloc := LEAST(v_remaining, v_needed);

    IF v_alloc > 0 THEN
      INSERT INTO public.payment_allocations (payment_id, obligation_id, member_id, amount_allocated_ghs)
      VALUES (v_sub.id, v_ob.id, v_sub.member_id, v_alloc);

      UPDATE public.contribution_obligations
      SET amount_paid_ghs = amount_paid_ghs + v_alloc,
          status = CASE
            WHEN (amount_paid_ghs + v_alloc) >= amount_due_ghs THEN 'paid'::public.obligation_status_enum
            ELSE 'partially_paid'::public.obligation_status_enum
          END,
          updated_at = now()
      WHERE id = v_ob.id;

      v_remaining := v_remaining - v_alloc;
      v_total_allocated := v_total_allocated + v_alloc;
    END IF;
  END LOOP;

  -- Mark submission verified
  UPDATE public.payment_submissions
  SET status = 'verified',
      allocated_amount_ghs = v_total_allocated,
      unallocated_credit_ghs = v_remaining,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      notes = COALESCE(p_admin_note, notes),
      updated_at = now()
  WHERE id = v_sub.id;

  -- Post to immutable financial ledger exactly once (enforced by UNIQUE constraint on source_payment_id)
  INSERT INTO public.financial_ledger (
    entry_date,
    entry_type,
    category,
    description,
    amount_ghs,
    signed_amount_ghs,
    recorded_status,
    source_payment_id,
    created_by
  ) VALUES (
    v_sub.payment_date,
    'income',
    'Member Contribution',
    'Member contribution verified (' || COALESCE(v_member_name, 'Member') || ')',
    v_sub.amount_ghs,
    v_sub.amount_ghs,
    'Verified',
    v_sub.id,
    v_actor_id
  );

  -- Notify member
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_sub.member_id,
    'Payment Verified',
    format('Your contribution payment of GH₵%s has been verified and added to your record.', to_char(v_sub.amount_ghs, 'FM999,999,990.00')),
    'payment_verified'
  );

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, actor_name, action_type, entity_type, entity_id, summary, metadata)
  VALUES (
    v_actor_id,
    COALESCE(v_actor_name, 'Administrator'),
    'VERIFY_PAYMENT',
    'payment_submissions',
    v_sub.id::text,
    format('Verified contribution of GH₵%s for %s', to_char(v_sub.amount_ghs, 'FM999,999,990.00'), v_member_name),
    jsonb_build_object('amount_ghs', v_sub.amount_ghs, 'allocated_ghs', v_total_allocated, 'unallocated_credit_ghs', v_remaining)
  );

  RETURN jsonb_build_object('status', 'verified', 'payment_id', v_sub.id, 'allocated_ghs', v_total_allocated);
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. ATOMIC RPC: POST GROUP EXPENSE WITH SPENDING LIMIT CHECK + LEDGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_group_expense(
  p_title TEXT,
  p_amount_ghs NUMERIC(12, 2),
  p_reason TEXT,
  p_expense_date DATE,
  p_category TEXT DEFAULT 'General',
  p_vendor_paid TEXT DEFAULT NULL,
  p_evidence_attachment_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_exceeded_balance_override BOOLEAN DEFAULT FALSE,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_current_balance NUMERIC(12, 2);
  v_expense_id UUID;
BEGIN
  IF NOT public.has_admin_or_treasurer_role(v_actor_id) THEN
    RAISE EXCEPTION 'Access denied: Only authorized administrators can post expenses.';
  END IF;

  IF p_amount_ghs IS NULL OR p_amount_ghs <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero.';
  END IF;

  SELECT COALESCE(SUM(signed_amount_ghs), 0.00) INTO v_current_balance
  FROM public.financial_ledger;

  IF p_amount_ghs > v_current_balance AND NOT COALESCE(p_exceeded_balance_override, FALSE) THEN
    RAISE EXCEPTION 'Expense amount (GH₵%) exceeds available recorded balance (GH₵%). Explicit authorized exception override is required.',
      p_amount_ghs, v_current_balance;
  END IF;

  IF p_amount_ghs > v_current_balance AND COALESCE(p_exceeded_balance_override, FALSE) AND (p_override_reason IS NULL OR char_length(trim(p_override_reason)) < 5) THEN
    RAISE EXCEPTION 'An explicit override explanation is required when posting an expense that exceeds recorded funds.';
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

  INSERT INTO public.expenses (
    title,
    amount_ghs,
    effective_amount_ghs,
    reason,
    expense_date,
    category,
    vendor_paid,
    evidence_attachment_id,
    has_evidence,
    notes,
    status,
    exceeded_balance_override,
    override_reason,
    created_by,
    created_by_name
  ) VALUES (
    trim(p_title),
    p_amount_ghs,
    p_amount_ghs,
    trim(p_reason),
    p_expense_date,
    COALESCE(NULLIF(trim(p_category), ''), 'General'),
    NULLIF(trim(p_vendor_paid), ''),
    p_evidence_attachment_id,
    (p_evidence_attachment_id IS NOT NULL),
    NULLIF(trim(p_notes), ''),
    'posted',
    COALESCE(p_exceeded_balance_override, FALSE),
    NULLIF(trim(p_override_reason), ''),
    v_actor_id,
    COALESCE(v_actor_name, 'Administrator')
  ) RETURNING id INTO v_expense_id;

  -- Post to financial_ledger exactly once
  INSERT INTO public.financial_ledger (
    entry_date,
    entry_type,
    category,
    description,
    amount_ghs,
    signed_amount_ghs,
    recorded_status,
    source_expense_id,
    created_by
  ) VALUES (
    p_expense_date,
    'expense',
    COALESCE(NULLIF(trim(p_category), ''), 'General'),
    'Expense: ' || trim(p_title) || ' — ' || trim(p_reason),
    p_amount_ghs,
    -p_amount_ghs,
    'Posted',
    v_expense_id,
    v_actor_id
  );

  INSERT INTO public.audit_logs (actor_id, actor_name, action_type, entity_type, entity_id, summary, metadata)
  VALUES (
    v_actor_id,
    COALESCE(v_actor_name, 'Administrator'),
    'POST_EXPENSE',
    'expenses',
    v_expense_id::text,
    format('Posted group expense "%s" of GH₵%s', trim(p_title), to_char(p_amount_ghs, 'FM999,999,990.00')),
    jsonb_build_object('amount_ghs', p_amount_ghs, 'override', p_exceeded_balance_override, 'override_reason', p_override_reason)
  );

  RETURN v_expense_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile; approved members can read approved profiles; admins can read/update all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Approved members can read approved member profiles" ON public.profiles
  FOR SELECT USING (public.is_approved_member(auth.uid()) AND membership_status = 'approved');

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Users can insert own pending profile on signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND membership_status = 'pending');

CREATE POLICY "Users can update own non-sensitive profile details" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND membership_status = (SELECT p.membership_status FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Admins can update member approval status" ON public.profiles
  FOR UPDATE USING (public.has_admin_or_treasurer_role(auth.uid()));

-- User Roles: Members can view their own role; ONLY admins can alter roles
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_approved_member(auth.uid()));

CREATE POLICY "Only admins can insert or update roles" ON public.user_roles
  FOR ALL USING (public.has_admin_or_treasurer_role(auth.uid()));

-- Contribution Rules & Periods: Approved members can read; only admins can modify
CREATE POLICY "Approved members can view contribution rules" ON public.contribution_rules
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Admins can manage contribution rules" ON public.contribution_rules
  FOR ALL USING (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Approved members can view contribution periods" ON public.contribution_periods
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Admins can manage contribution periods" ON public.contribution_periods
  FOR ALL USING (public.has_admin_or_treasurer_role(auth.uid()));

-- Contribution Obligations: Approved members can read obligations for group transparency; only admins/RPC modify
CREATE POLICY "Approved members can view contribution obligations" ON public.contribution_obligations
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Admins can manage contribution obligations" ON public.contribution_obligations
  FOR ALL USING (public.has_admin_or_treasurer_role(auth.uid()));

-- Payment Submissions:
-- STRICT PRIVACY: Only the submitting member and authorized admins can read payment_submissions
-- (because it contains transaction_reference and evidence_attachment_id).
CREATE POLICY "Members can read own payment submissions" ON public.payment_submissions
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY "Admins can read all payment submissions" ON public.payment_submissions
  FOR SELECT USING (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Approved members can submit own pending payments" ON public.payment_submissions
  FOR INSERT WITH CHECK (
    auth.uid() = member_id
    AND public.is_approved_member(auth.uid())
    AND status = 'pending'
    AND is_offline_entry = FALSE
  );

CREATE POLICY "Only admins can update or record offline payments" ON public.payment_submissions
  FOR ALL USING (public.has_admin_or_treasurer_role(auth.uid()));

-- File Attachments:
-- Payment evidence is strictly restricted to owner + admins!
CREATE POLICY "Authorized access to file attachments" ON public.file_attachments
  FOR SELECT USING (
    auth.uid() = owner_id
    OR public.has_admin_or_treasurer_role(auth.uid())
    OR (scope = 'avatar' AND public.is_approved_member(auth.uid()))
  );

CREATE POLICY "Approved members can upload own attachments" ON public.file_attachments
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND public.is_approved_member(auth.uid()));

-- Expenses & Adjustments: Approved members can read; only admins can insert/update
CREATE POLICY "Approved members can view posted expenses" ON public.expenses
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Only admins can create or adjust expenses" ON public.expenses
  FOR INSERT WITH CHECK (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Only admins can update expenses via adjustment" ON public.expenses
  FOR UPDATE USING (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Approved members can view expense adjustments" ON public.expense_adjustments
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Only admins can insert expense adjustments" ON public.expense_adjustments
  FOR INSERT WITH CHECK (public.has_admin_or_treasurer_role(auth.uid()));

-- Financial Ledger: Approved members can read; only admins/RPC can insert
CREATE POLICY "Approved members can view financial ledger" ON public.financial_ledger
  FOR SELECT USING (public.is_approved_member(auth.uid()));

CREATE POLICY "Only admins can insert ledger entries" ON public.financial_ledger
  FOR INSERT WITH CHECK (public.has_admin_or_treasurer_role(auth.uid()));

-- Notifications: Users can read and mark their own notifications as read
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.has_admin_or_treasurer_role(auth.uid()) OR auth.uid() = user_id);

-- Audit Logs: Only admins can read audit logs
CREATE POLICY "Only admins can read audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_admin_or_treasurer_role(auth.uid()));

CREATE POLICY "Admins can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.has_admin_or_treasurer_role(auth.uid()));
