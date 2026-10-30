# Securely Assigning the First Administrator

The app **never** grants administrator rights automatically. Registering first, choosing an "admin" option at signup, or editing your own profile cannot make you an administrator.

The first administrator is created by the **database owner** (whoever controls the Supabase project) using the SQL Editor. The `bootstrap_first_admin()` function is revoked from `PUBLIC`, `anon` and `authenticated`, so it can only be executed from the SQL Editor / service role — never from the browser.

---

## Step 1 — Create a normal account

> Prerequisites: migrations `001`, `002` **and `003`** have been run (see `SUPABASE_SETUP.md`), and the app is deployed with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set — the Welcome screen shows **Connected to Supabase**. Without `003`, registrations create an Auth login but no profile row, and Step 2 cannot find the account.

1. Open the app and tap **Join the Group**.
2. Register with the real email address of the person who will administer the group, e.g. `treasurer.have2022@gmail.com`.
3. Accept the privacy notice. Supabase creates the login, and a database trigger automatically adds the **pending member** profile + `member` role.
4. If **Confirm email** is on (Authentication → Providers → Email), click the confirmation link in the inbox first. The pending profile already exists either way.

## Step 2 — Promote that account in the SQL Editor

Open **Supabase → SQL Editor → New query** and run:

```sql
SELECT public.bootstrap_first_admin('treasurer.have2022@gmail.com');
```

That single call:

- sets `membership_status = 'approved'` and stamps `approved_at`,
- assigns the `admin` role in `user_roles`,
- writes a `BOOTSTRAP_ADMIN` row to `audit_logs` naming who was promoted and when.

## Step 3 — Verify

```sql
SELECT p.email, p.membership_status, ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.role = 'admin';
```

You should see exactly one administrator (the person you just promoted).

## Step 4 — Sign in and finish setup

1. Log in on the phone as that administrator.
2. **More → Admin portal** now appears.
3. Open **Contribution Settings** and either leave the amount unset (if the group has not decided) or enter and activate the agreed amount.
4. Approve the other members in **Manage Members**.
5. Optionally promote one trusted person to **Treasurer** (a treasurer can verify payments, post expenses and read reports, but cannot change roles or bootstrap admins).

---

## Rules to keep the group safe

1. **One administrator minimum, ideally two.** The last administrator cannot remove their own role, and the system refuses to leave the group with zero administrators.
2. **Never share the service-role key.** It bypasses RLS completely.
3. **Assign roles only through the app or the SQL Editor** — never by editing `profiles.membership_status` in a shared spreadsheet.
4. **Keep the bootstrap function locked down.** If you ever re-run the migration, confirm this line is present:

   ```sql
   REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT) FROM PUBLIC, anon, authenticated;
   ```

5. **Watch the audit log.** Every promotion (`SET_ROLE`), approval (`APPROVE_MEMBER`) and bootstrap (`BOOTSTRAP_ADMIN`) is recorded with the actor's name and timestamp.

## Replacing an administrator

If the administrator leaves the group or loses access:

1. The remaining administrator signs in and uses **Manage Members → Change role** to promote someone new.
2. If no administrator can sign in, the database owner repeats Step 2 with the new person's email, then removes the old role:

```sql
UPDATE public.user_roles SET role = 'member' WHERE user_id = (
  SELECT id FROM public.profiles WHERE lower(email) = lower('old.admin@example.com')
);
```

Both actions must be recorded in the group's minutes.
