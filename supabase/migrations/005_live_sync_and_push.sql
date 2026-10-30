-- ============================================================================
-- 005: Live sync (shared group state) + Web Push subscriptions
-- Run AFTER 001–003. Safe to re-run.
-- ============================================================================
-- The app screens run on a fast local engine. To make every phone see the
-- same records, approved devices sync one shared JSON document (contribution
-- rules, weekly periods, obligations, payments, expenses, ledger,
-- notifications) through this table:
--
--   * Only APPROVED members can read or write it (RLS below).
--   * Accounts, roles and approvals themselves stay in profiles/user_roles
--     (migrations 001/003) — never in this document.
--   * Role checks for financial actions are enforced by the app engine
--     (same checks as offline mode). This is the pragmatic group-fund
--     bridge; per-row financial RLS remains a future hardening step.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.group_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved members can read group state" ON public.group_state;
CREATE POLICY "Approved members can read group state" ON public.group_state
  FOR SELECT USING (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Approved members can sync group state" ON public.group_state;
CREATE POLICY "Approved members can sync group state" ON public.group_state
  FOR INSERT WITH CHECK (public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Approved members can update group state" ON public.group_state;
CREATE POLICY "Approved members can update group state" ON public.group_state
  FOR UPDATE USING (public.is_approved_member(auth.uid()))
  WITH CHECK (public.is_approved_member(auth.uid()));

-- ============================================================================
-- Web Push subscriptions (one row per browser/device a member opted in on).
-- Members manage only their own rows. Pushes are sent by the notify-payment
-- Edge Function using the service role, which bypasses RLS on purpose.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
