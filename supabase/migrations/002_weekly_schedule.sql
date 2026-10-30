-- 002: Admin-set weekly schedule (default: GH₵ amount every week)
-- Run after 001_initial_schema.sql in the Supabase SQL Editor.

-- How many weeks between payments (1 = every week, 2 = every 2 weeks)
ALTER TABLE public.contribution_rules
  ADD COLUMN IF NOT EXISTS every_weeks INTEGER NOT NULL DEFAULT 1
  CHECK (every_weeks BETWEEN 1 AND 12);

-- Total number of weeks/periods the admin set. NULL = no end (until stopped).
ALTER TABLE public.contribution_rules
  ADD COLUMN IF NOT EXISTS duration_periods INTEGER
  CHECK (duration_periods IS NULL OR duration_periods BETWEEN 1 AND 260);

-- New groups start weekly by default.
ALTER TABLE public.contribution_rules
  ALTER COLUMN frequency SET DEFAULT 'weekly';

-- How it works in the app (mirrored by the local engine + tests):
-- * Admin sets amount, how often, the first week start date, and duration, then turns it On.
-- * One period is created per payment cycle from the start date. For weekly,
--   the due date is the LAST day of that week (pay within the week).
-- * When a week has ended (due date + grace days passed) and a member has not
--   paid, that week is outstanding for that member and one
--   'outstanding_reminder' notification is created for them (no duplicates).
-- * After duration_periods cycles, no new periods are created.
COMMENT ON COLUMN public.contribution_rules.every_weeks IS 'Weeks between payments when frequency = weekly. 1 = every week (default).';
COMMENT ON COLUMN public.contribution_rules.duration_periods IS 'Total payment periods/weeks set by admin. NULL = no end.';
