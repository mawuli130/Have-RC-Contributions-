# Supabase Setup Guide

This guide connects the app to a real Supabase project. The app is fully usable without it (offline demo database), but live deployments need Supabase for authentication, storage of records and Row Level Security.

---

## 1. Create the project

1. Go to <https://supabase.com> and sign in.
2. **New project** → choose your organisation → name it e.g. `have-rc-jhs-2022-fund`.
3. Choose the region closest to Ghana (e.g. `eu-west-1` / `eu-central-1`) and set a strong **database password**. Store it in a password manager — it is never needed by the app.
4. Wait for provisioning to finish (~2 minutes).

## 2. Run the migration

1. In the dashboard open **SQL Editor → New query**.
2. Paste the whole contents of [`../supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql).
3. Press **Run**. You should see `Success. No rows returned`.

The migration creates:

- Enums, tables, indexes, foreign keys and money constraints (`NUMERIC(12,2)`).
- Helper functions `has_admin_or_treasurer_role()` and `is_approved_member()`.
- Atomic RPCs: `verify_payment_submission()`, `post_group_expense()`, `bootstrap_first_admin()`.
- Triggers that block deletion of posted expenses and ledger rows.
- Row Level Security policies on every table, all switched **on**.
- The audit log, notifications and secure file-attachment tables.

> If you re-run the migration it is safe: every `CREATE` is `IF NOT EXISTS` / guarded.

## 3. Configure email authentication

1. **Authentication → Providers → Email**: keep Email enabled.
2. For a small trusted group you can turn **Confirm email** off so new members can log in immediately (they still land on *Awaiting Approval*). With confirmation on, members must click the email link first.
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://your-app-domain.example`
   - *Redirect URLs*: add `http://localhost:5173` and your production URL.

## 4. Storage for receipts (optional)

The migration stores attachment metadata in `file_attachments`. To use Supabase Storage instead of embedded data URLs:

1. **Storage → New bucket** → name it `payment-evidence` → **Private**.
2. Create a second private bucket `expense-evidence`.
3. Add policies so that an object is readable only when `owner_id = auth.uid()` **or** the caller passes `has_admin_or_treasurer_role(auth.uid())`.
4. Never make these buckets public.

## 5. Environment variables

Copy the template and fill in **only** the public values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL="https://abcdefghijkl.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

Find both under **Project Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **Project API keys → `anon` `public`** → `VITE_SUPABASE_ANON_KEY`

### What must never appear in the browser bundle

| Key | Where it belongs |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/CI only. Never in `VITE_*`. |
| Database password | Your password manager. |
| `JWT secret` | Supabase internals only. |

Anything prefixed with `VITE_` is compiled into the JavaScript bundle and is readable by anyone who opens the app. The `anon` key is designed to be public **because RLS protects the data** — never disable RLS to "make something work".

## 6. Seed the group's real data

After the first administrator exists (see [`INITIAL_ADMIN.md`](INITIAL_ADMIN.md)):

1. Members register in the app → status `pending`.
2. The administrator approves them in **Admin Portal → Manage Members**.
3. The administrator opens **Contribution Settings**, enters the agreed amount, picks the frequency and start date, then switches **Schedule active** on. Obligations are generated for every approved member.

## 7. Verify the deployment

- `SELECT count(*) FROM public.profiles;` returns your members.
- `SELECT * FROM public.financial_ledger ORDER BY created_at DESC;` shows verified contributions and posted expenses.
- `SELECT COALESCE(SUM(signed_amount_ghs),0) FROM public.financial_ledger;` equals the balance shown on the Group Fund screen.
- Signing in as an ordinary member and calling `post_group_expense` must fail with *Access denied*.

## 8. Backup and retention

- Supabase takes daily backups on paid plans. On the free plan, export regularly:
  **Database → Backups**, or run `pg_dump` against your connection string.
- The `financial_ledger` and `audit_logs` tables are append-only by policy — keep them permanently.
