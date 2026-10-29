# Security & Privacy Model

## Layers

1. **Authentication** — Supabase Auth (GoTrue) in live mode. Passwords are hashed and salted by Supabase; they never reach the application code. In offline demo mode a deterministic local hash stands in, clearly marked as demo-only in the source.
2. **Authorisation in the data layer** — every service function in `src/services/databaseService.ts` calls `requireApproved()` or `requireAdmin()` before touching data. The UI cannot bypass this because screens only ever call the service.
3. **Database enforcement** — Supabase Row Level Security plus `SECURITY DEFINER` RPCs in `supabase/migrations/001_initial_schema.sql`. Even a crafted request from the browser is rejected by PostgreSQL.
4. **Financial integrity** — immutable ledger, unique source constraints, deletion triggers, atomic verification/posting.

## Roles

| Role | Stored in | Granted by |
| --- | --- | --- |
| `member` | `user_roles` | Default for every account |
| `treasurer` | `user_roles` | An administrator, in the app |
| `admin` | `user_roles` | An administrator in the app, or `bootstrap_first_admin()` in the SQL Editor |

Roles live in a **separate table** from profiles with `FOR ALL` policies restricted to admins, so a member can never escalate themselves by editing their own profile row.

## RLS summary

| Table | Member (own) | Approved member | Admin / Treasurer |
| --- | --- | --- | --- |
| `profiles` | read/update own non-sensitive fields | read approved profiles | read/update all |
| `user_roles` | read own | read | all |
| `contribution_rules`, `contribution_periods`, `contribution_obligations` | — | read | all |
| `payment_submissions` | read own, insert own `pending` | — | all |
| `payment_allocations` | read own | — | all |
| `file_attachments` | read own | insert own, read `avatar` scope | read all |
| `expenses`, `expense_adjustments` | — | read | read + insert |
| `financial_ledger` | — | read | read + insert |
| `notifications` | read/update own | — | insert |
| `audit_logs` | — | — | read + insert |

Pending members fail `is_approved_member(auth.uid())`, so they see no financial rows at all — matching the "Awaiting Approval" screen.

## What is private

Never exposed to other members, in any view, CSV or activity feed:

- Payment receipts and screenshots (`file_attachments` scope `payment_evidence`)
- Mobile Money / bank transaction references
- Member email addresses and phone numbers
- Notes written to the treasurer and rejection reasons
- Audit-log metadata

The public projection is an explicit whitelist in `toPublicSummary()` (`src/services/calculations.ts`); a test asserts that `email`, `phone`, `transaction_reference`, `evidence_attachment_id` and `notes` are absent from it.

## Financial safeguards

- `UNIQUE(source_payment_id)`, `UNIQUE(source_expense_id)`, `UNIQUE(source_adjustment_id)` on `financial_ledger` → a payment or expense can be posted **once**.
- `UNIQUE(payment_id, obligation_id)` on `payment_allocations` → no double allocation.
- `BEFORE DELETE` triggers on `expenses` and `financial_ledger` raise an exception; corrections are compensating rows.
- `CHECK (amount_paid_ghs <= amount_due_ghs)` on obligations → an obligation can never be over-paid.
- `CHECK` that an active rule must have an amount and a start date; `amount_ghs` is `NULL`-able so the group can defer the decision.
- `verify_payment_submission()` and `post_group_expense()` re-check the caller's role inside the transaction and recompute the balance from the ledger.
- Pending payments never enter the ledger, so they can never inflate the balance.

## Client-side prohibitions

- No `SUPABASE_SERVICE_ROLE_KEY` or database password in the bundle. Only `VITE_SUPABASE_URL` and the public `VITE_SUPABASE_ANON_KEY` are used.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- No third-party analytics, no ad network, no paid messaging service.

## Recommendations for rollout

1. Turn on email confirmation in Supabase Auth if members use shared devices.
2. Keep the `payment-evidence` and `expense-evidence` buckets private.
3. Require two administrators so the group is never locked out.
4. Review the admin activity log monthly.
5. Reconcile the recorded balance against the real Mobile Money/bank balance each month and correct discrepancies through the documented adjustment process.
