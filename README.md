# Have R/C JHS 2022 — Contribution & Group Fund App

A mobile-first contribution and group-fund management app for the **Have R/C JHS 2022 Old Students**.

Members can see exactly where the group stands: who has paid, who is outstanding, every posted expense, and the current recorded balance. Administrators and treasurers can approve members, set the contribution rule, verify payments, post expenses with evidence, and send reminders.

Built with **React + TypeScript + Vite + Tailwind CSS**, backed by **Supabase (PostgreSQL + Auth + RLS)**.

---

## Quick start

```bash
npm install
cp .env.example .env      # optional: add your Supabase project URL + anon key
npm run dev               # http://localhost:5173
```

The app ships with a **fully working offline demo database** so you can explore every screen and every role before connecting Supabase.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@have2022.org` | `Admin123!` |
| Treasurer | `treasurer@have2022.org` | `Member123!` |
| Member (fully paid) | `kwesi…` → `kwame@example.com` | `Member123!` |
| Member (not paid) | `ama@example.com` | `Member123!` |
| Member (pending approval) | `yaa@example.com` | `Member123!` |

The login screen lists these accounts — tap one to fill the form. "Restore demo records" in the **More** tab resets the demo data.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on `0.0.0.0:5173` |
| `npm run build` | Type-check (`tsc -b`) and produce the production bundle in `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the 83-test suite (63 acceptance tests + 19 screen renders + 1 no-storage boot check) |

---

## How the money is calculated

```
Current Recorded Balance = Total Recorded Income − Total Posted Expenses − Other Recorded Outflows
```

Rules enforced in the app **and** in the database:

- Only **verified** payments are income. Pending and rejected submissions never move a balance.
- Each expense is posted to an immutable ledger **exactly once** (unique `source_expense_id`).
- An expense larger than the recorded balance is blocked unless an administrator records an explicit exception with a reason.
- Posted expenses can never be deleted. Corrections post a compensating ledger entry and keep the original row plus an audit trail.
- A payment covering several periods is allocated oldest-first with **no double counting** (`UNIQUE(payment_id, obligation_id)`).
- The contribution amount may stay **unset** (`amount_ghs IS NULL`, `is_active = false`). No obligations are generated until an administrator activates an agreed amount.

---

## Project structure

```
src/
  App.tsx                     App shell, routing and route guards
  components/                 Shared UI (cards, pills, sheets, BottomNav, SchoolHero)
  context/AppContext.tsx      Session, navigation, refresh key, toasts
  screens/                    Member screens (Welcome, Auth, Home, Contributions,
                              Group Fund, Members, More, payment + history screens)
  screens/admin/              The 8-section Admin Portal
  services/databaseService.ts Authorisation-checked data API used by every screen
  services/localStore.ts      Persistent local relational engine + demo seed
  services/calculations.ts    Single source of truth for balances and statuses
  services/supabaseClient.ts  Supabase client (only used when .env is configured)
  types/database.ts           Shared TypeScript data model
  test/                       83-test suite (all 20 PRD acceptance criteria + screen renders)
supabase/migrations/001_initial_schema.sql   Full PostgreSQL schema, RPCs, RLS
docs/                         Setup, deployment, member and admin guides
```

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) | Create the project, run the migration, wire `.env` |
| [`docs/INITIAL_ADMIN.md`](docs/INITIAL_ADMIN.md) | Securely assign the very first administrator |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Local development and production deployment |
| [`docs/MEMBER_GUIDE.md`](docs/MEMBER_GUIDE.md) | Simple guide for ordinary members |
| [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) | Administrator and treasurer guide |
| [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) | Test results and known limitations |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security model, RLS summary, privacy rules |
| [`docs/PWA.md`](docs/PWA.md) | Install the app (crest icon) and offline behaviour |

---

## Privacy in one sentence

Approved members can see each other's **name, verified paid total, outstanding balance and payment status**; everything else — receipts, transaction references, emails, phone numbers and notes — stays private to the member and the authorised treasurer.

---

## UI reference fidelity

The app implements the 15-screen reference collage screen-by-screen
(navy `#0B3570` + gold `#FFC400`, crest, bottom navigation, status pills).
See [`docs/UI_REFERENCE.md`](docs/UI_REFERENCE.md) for the screen-by-screen
map, design tokens, the admin-only expense rule, and remaining limitations.

### Weekly payments (default)

The admin sets the amount (e.g. **GH₵10**), how often (**every week** by
default, or every 2 weeks / monthly), the first week, and for how many weeks.
Members pay within the week; a missed week becomes **Outstanding** with a
notification. Every dashboard shows only: *We have*, *Outstanding*, *You
paid*, this week, and who missed that week.
