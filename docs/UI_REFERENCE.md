# UI reference implementation — screen map

The supplied collage (15 phone screens) is the visual source of truth.
Every screen below is a real, working page — no screenshot backgrounds.

| # | Reference screen | Implementation | Route / entry |
| --- | --- | --- | --- |
| 1 | Welcome / onboarding (crest, navy, gold Join, Login, Contributions/Expenses/Transparency) | `src/screens/WelcomeScreen.tsx` + `src/components/Crest.tsx` + `SchoolHero` | unauthenticated home |
| 2 | Login (crest, Welcome Back!, Remember me, Forgot password?, Google, Register) | `src/screens/AuthScreens.tsx` (`LoginScreen`) | `login` |
| 3 | Member home dashboard (account card, Total Paid green, Outstanding orange, Next Due, Payment Status purple, Quick Actions) | `src/screens/HomeScreen.tsx` | tab `home` |
| 4 | Contributions (Contribution Rule, yellow not-set notice, Your Contribution Summary, Submit Payment) | `src/screens/ContributionsScreen.tsx` | tab `contributions` |
| 5 | Members (search, All/Paid/Partial/Not Paid chips, GH₵ paid/total, periods, status pill) | `src/screens/MembersScreen.tsx` | tab `members` |
| 6 | Submit Payment (info box, Amount/Date/Reference/Method *, upload receipt) | `src/screens/SubmitPaymentScreen.tsx` | `submit-payment` |
| 7 | Payment History (All / My Payments / Group tabs, Verified pill, GH₵) | `src/screens/PaymentHistoryScreen.tsx` | `payment-history` |
| 8 | Group Fund (Current Balance, totals, Recent Expenses, admin-only + Add Expense gold) | `src/screens/GroupFundScreen.tsx` | tab `fund` |
| 9 | Expenses (thumbnail rows, amount, date, category pill) — read-only for members | `src/screens/ExpensesScreen.tsx` | `expenses` (Group Fund → View All) |
| 10 | Add Expense (Title/Amount/Reason/Date/Category *, receipt upload, Save Expense) — admin only | `src/screens/admin/AddExpenseScreen.tsx` | `admin-add-expense` (guarded + service + RLS) |
| 11 | Reminders (yellow banner, member rows, Send Reminder) | `src/screens/admin/OutstandingMembersScreen.tsx` | `admin-outstanding` |
| 12 | Financial Activity (All/Contributions/Expenses tabs, timeline +/− GH₵) | `src/screens/FinancialHistoryScreen.tsx` | `financial-history` |
| 13 | Admin Dashboard (stat grid, Pending/Overdue, Quick Actions) | `src/screens/admin/AdminDashboardScreen.tsx` | `admin-dashboard` |
| 14 | Profile (avatar, Member pill, HRJ-2022-•••, My Profile…Log Out) | `src/screens/MoreScreen.tsx` + `ProfileEditScreen` | tab `more`, `profile-edit` |
| 15 | More / Admin Tools (Financial Reports, Expense History, Contribution Settings, Audit Log) | `src/screens/MoreScreen.tsx` (admin section, admins only) | tab `more` |

## Design tokens

- Navy `#0B3570` (900) / `#071F42` (950), gold `#FFC400`, background `#EEF3FA`.
- Green = paid/verified, orange/amber = pending/partial/outstanding, red = overdue/expenses, purple = payment-status tile (dashboard only).
- Cards `rounded-[20px]`, white, `border #E3ECF7`, soft navy shadow; bottom nav Home · Contributions · Group Fund · Members · More.
- Currency everywhere via `formatGHS` → `GH₵1,250.00`. Member code via `formatMemberId` → `HRJ-2022-004` (display only).

## Role rule (expenses)

Members: Group Fund + Expenses are read-only, no Add/Edit controls are rendered.
Admins/treasurers: Add Expense is shown, confirmed before posting, and enforced
again in `databaseService.postExpense` and in Supabase RLS
(`Only admins can create or adjust expenses`, `post_group_expense` RPC check).
See `docs/SECURITY.md`.

## Remaining limitations

- Google sign-in button explains the setup step; it activates once the Google
  provider is enabled in Supabase Auth (demo mode uses email/password).
- Crest and school illustration are clean SVG recreations, not official artwork.
- Without `.env`, data is the offline demo database (localStorage) — connect
  Supabase per `docs/SUPABASE_SETUP.md` for shared live records.

## Weekly plan (admin-set)

- Admin sets: **Amount** (e.g. GH₵10), **How often** (Every week = default,
  Every 2 weeks, Every month…), **First week starts**, **How many weeks**
  (blank = no end), then turns **Start payments** on.
- Pay within the week: the due date is the **last day of the week**.
  When the week ends and a member has not paid, that week becomes
  **Outstanding** for them and they get one notification (no duplicates).
  A new week starts by itself when the app is opened.
- Dashboard (clean, only this): **We have** (group total) · **Outstanding**
  (missed weeks, yours) · **You paid** (your total) · **This week** (amount +
  Paid/Not paid) · Submit Payment · **Outstanding · Week N** list of people
  who have not paid for that week.

## Compact mobile layout (correction)

- Every screen lives in a `100dvh` phone shell; content scrolls **inside**
  the shell only where it is a real list (Members, History, Expenses, Weeks).
- **Home does not scroll** (`app-fixed`): compact navy header → greeting →
  identity card → 4 tiles (Total Paid, Outstanding, Next Due Date, Payment
  Status) → Submit Payment / Payment History → max-3 "Outstanding · Week N"
  preview (full list in Members). Estimated height ≈ 600px at 360×800,
  leaving the fixed bottom nav clear.
- Welcome does not scroll and uses the real photo asset
  `src/assets/school-hero.jpg` (`object-cover`, 168px crop, 113KB) — a
  school-inspired generated photo, not an official school photograph.
  The old CSS/SVG SchoolHero was deleted.
- Login fits one screen; demo accounts are collapsed under "Demo accounts".
- Group Fund shows a 2×2 summary + only 3 recent expenses (View All opens
  the full Expenses screen).
- Automated viewport structure tests run at 360×800, 375×812, 393×873
  (`src/test/viewport.test.tsx`). Pixel/screenshot testing needs a real
  browser, which the sandbox cannot download — verify visually in the
  live preview / a phone browser at those sizes.
