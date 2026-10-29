# Test Results & Known Limitations

Last run: **2026-10-28** · Command: `npm test` (Vitest 3.2.7, jsdom, React Testing Library)

```
 Test Files  3 passed (3)
      Tests  83 passed (83)
   Duration  8.57s
```

- `src/test/acceptance.test.tsx` — **63 tests**, one block per Master PRD acceptance criterion.
- `src/test/screens.smoke.test.tsx` — **19 tests**, rendering every primary screen (5 member tabs, 9 admin sections, 5 account screens) with a real session to catch runtime crashes.
- `src/test/noStorage.test.tsx` — **1 test**, proving the app still boots when `localStorage` is blocked (as it is inside the sandboxed in-app preview iframe).

Production build: `npm run build` → **passed** (`tsc -b` clean, `dist/` produced: 627 kB JS / 42 kB CSS, gzip 164 kB / 7.2 kB).

---

## Acceptance criteria coverage

Every item in section 18 of the Master PRD is covered by at least one automated test, and most are covered through both the service layer and the rendered UI.

| # | Acceptance criterion | Tests | Result |
| --- | --- | --- | --- |
| 1 | Registration and login work | 4 (service + UI login) | ✅ |
| 2 | Membership approval works | 4 (pending block, approve, notification, UI awaiting screen) | ✅ |
| 3 | Members cannot access admin actions | 4 (service guards, self-promotion, UI hiding/showing the portal) | ✅ |
| 4 | Contribution amount can remain unset | 3 (`amount_ghs = null`, activation refused, dashboard explains) | ✅ |
| 5 | Obligations generated correctly after activation | 2 (grid per member/period, no duplicates, no future periods) | ✅ |
| 6 | Payments remain pending until verified | 2 (no balance change, validation) | ✅ |
| 7 | Verified payments update member balance and group income | 5 (single posting, double-verify blocked, rejection, multi-period split, partial) | ✅ |
| 8 | Outstanding balances calculated correctly | 2 (per-member reconciliation, grace period) | ✅ |
| 9 | Admin can create an expense with amount, reason, date, attachment | 3 (service, validation, full UI flow) | ✅ |
| 10 | Posting an expense decreases the balance exactly once | 3 (single ledger row, spending-limit block + override, pending not income) | ✅ |
| 11 | Expense appears in the expense history | 2 (service + rendered Group Fund tab) | ✅ |
| 12 | Approved members can view shared payment-status fields | 2 (public projection whitelist, directory search/filters) | ✅ |
| 13 | Unauthorised users cannot access private payment evidence | 1 (owner allowed, admin allowed, other member blocked, no leakage in public list) | ✅ |
| 14 | Expense corrections remain auditable | 3 (adjust, reverse, reason required) | ✅ |
| 15 | WhatsApp reminders use the correct member and balance | 3 (message text, per-member link, in-app reminder) | ✅ |
| 16 | Financial summaries match the underlying ledger | 2 (signed sum reconciliation, verify+expense+reversal cycle) | ✅ |
| 17 | Database security policies block unauthorised changes | 5 (write guards, unauthenticated reads, last-admin rule, role promotion, audit logging) | ✅ |
| 18 | The interface works on mobile screens | 3 (5-tab nav + touch targets, no tables, empty states) + 19 screen render checks + 1 no-storage boot | ✅ |
| 19 | Important buttons perform real actions | 3 (submit payment, verify payment, logout) | ✅ |
| 20 | Production build and tests pass | 5 + build (`tsc -b && vite build` succeeds) | ✅ |

Plus 2 extra tests for demo-seed integrity and error typing.

---

## Manual verification performed

- Started the dev server (`npm run dev`) bound to `0.0.0.0:5173`; the welcome screen, hero illustration and navigation render.
- Confirmed the production build output in `dist/` and that `npm run preview` serves it on `0.0.0.0:4173`.
- Reviewed every screen's markup for horizontal overflow: the app shell is capped at `max-w-[480px]`, no `<table>` elements exist anywhere, and all lists are vertical cards. Long filter rows scroll horizontally **inside their own container only**, which is the standard mobile pattern and does not scroll the page itself.

---

## Known limitations

1. **Offline demo engine vs live Supabase.** Without Supabase credentials the app runs on a local relational engine persisted in `localStorage`. It enforces the same rules (permissions, ledger uniqueness, no deletion, atomic allocation) and passes the full suite, but it is not a multi-device backend: data lives on one browser. Set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for real multi-user use.
2. **The service layer is not yet wired to live Supabase RPCs.** `src/services/databaseService.ts` is written against the local engine; `supabaseClient.ts` and the migration (`verify_payment_submission`, `post_group_expense`, `bootstrap_first_admin`, RLS policies) are complete and ready, but swapping the transport is a remaining integration step — every function signature already matches the RPC parameters.
3. **Evidence files are stored as data URLs** (limited to 3 MB) rather than in Supabase Storage. The `file_attachments` table and the private bucket plan are in place; moving the bytes to Storage is a follow-up.
4. **No WhatsApp delivery confirmation.** The reminder opens `wa.me` with a prefilled message. The app cannot know whether the message was sent, delivered or read — it never claims otherwise.
5. **Automatic reminders are not scheduled.** Reminders are triggered by an administrator; there is no cron job or push notification service (and no paid service is used).
6. **No password-reset email in demo mode.** The offline engine acknowledges the request without sending mail; live Supabase Auth sends a real reset link.
7. **One-time login per browser session.** The demo session is not a hardened auth token, and the local password hash is a deterministic placeholder — real hashing and sessions come from Supabase Auth in live mode.
8. **`monthly`/`quarterly`/`annual` period labels use calendar months**; a rule starting on the 31st clamps the due day to the last valid day of the month.
9. **Single currency.** All amounts are GHS; there is no multi-currency support (out of scope).
10. **Bundle is a single chunk** (~627 kB). Acceptable for this size of app; code-splitting the admin portal would be the first optimisation.
11. **No automated cross-browser run.** The test environment is jsdom; real-device testing on an Android phone was not possible inside this sandbox and should be done before rollout.

---

## How to reproduce

```bash
npm install
npm test          # 83 passed (63 acceptance + 19 screen renders + 1 no-storage boot)
npm run build     # tsc + vite build
npm run dev       # http://localhost:5173
```

Log in with `admin@have2022.org` / `Admin123!` for the admin portal, or `ama@example.com` / `Member123!` for the ordinary-member experience.
