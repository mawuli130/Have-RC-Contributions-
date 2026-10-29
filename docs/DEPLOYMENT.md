# Local Development & Deployment Guide

## Requirements

- Node.js **20 LTS** or newer (`node -v`)
- npm 10+ (bundled with Node)
- A Supabase project (optional for local UI work — see the demo mode below)

---

## Local development

```bash
git clone <your-repo-url> have-rc-jhs-2022-fund
cd have-rc-jhs-2022-fund
npm install
cp .env.example .env        # optional
npm run dev
```

Open <http://localhost:5173>. On your phone, use your computer's LAN IP (`http://192.168.x.x:5173`) — the dev server already binds to `0.0.0.0` and accepts any host header.

### Demo mode vs live mode

| `.env` state | Behaviour |
| --- | --- |
| No Supabase values (or placeholder values) | Offline demo database in `localStorage`. All 83 tests, every screen and every permission rule work. |
| Real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | `src/services/supabaseClient.ts` creates a live client; the welcome screen shows **Connected to Supabase**. |

The offline engine (`src/services/localStore.ts` + `databaseService.ts`) mirrors the SQL rules one-for-one: pending members are blocked, members cannot verify payments, expenses cannot be deleted, ledger rows are unique per source, and corrections post compensating entries. This makes the app demonstrable in a classroom or a village meeting with no internet.

### Reset the demo data

**More → About & data → Restore demo records** (then log in again).

### Tests and type checks

```bash
npm test          # 83 tests: 63 acceptance checks + 19 screen renders + 1 no-storage boot
npm run build     # tsc -b && vite build  → dist/
npm run preview   # serve dist/ locally on port 4173
```

---

## Production build

```bash
npm ci
npm run build
```

Outputs a static bundle in `dist/` (~630 kB JS, ~164 kB gzipped). Deploy it to any static host — no server process needed.

### Netlify

1. Connect the repository.
2. Build command: `npm run build` · Publish directory: `dist`.
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Add a `_redirects` file in `public/` containing `/*  /index.html  200` so deep links work.

### Vercel

1. Import the repository (framework preset: **Vite**).
2. Build command `npm run build`, output `dist`.
3. Add the two `VITE_` environment variables for Production, Preview and Development.
4. Vercel handles SPA routing automatically.

### GitHub Pages

```bash
npm run build
npx gh-pages -d dist
```

Set `base: '/<repo-name>/'` in `vite.config.ts` for project pages.

### Any VPS with Nginx

```nginx
server {
  listen 80;
  server_name fund.have2022.org;
  root /var/www/have-rc-jhs-2022/dist;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

Add TLS with `certbot --nginx -d fund.have2022.org`.

---

## Post-deployment checklist

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in the host's environment.
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` anywhere in the front-end environment.
- [ ] Supabase **Site URL / Redirect URLs** include the production domain.
- [ ] The migration ran and RLS is enabled on all 13 tables.
- [ ] The first administrator exists (see `INITIAL_ADMIN.md`).
- [ ] A member account cannot open any Admin screen.
- [ ] The balance on the Group Fund screen equals `SUM(signed_amount_ghs)` in `financial_ledger`.
- [ ] Tested on a real Android phone in portrait — no horizontal scrolling.
- [ ] `npm test` and `npm run build` both pass.

---

## Updating the app

```bash
git pull
npm ci
npm test
npm run build
# redeploy dist/
```

If a new SQL migration is added to `supabase/migrations/`, run it in the Supabase SQL Editor **before** deploying the front end that depends on it.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Demo data mode" still shown after adding `.env` | Restart `npm run dev`; Vite only reads env vars at start-up. |
| Blank page after deploy | Check the SPA fallback rule (all routes must serve `index.html`). |
| `new row violates row-level security policy` | The signed-in user is not approved, or the action needs the admin/treasurer role. |
| Payments verified but balance unchanged | Confirm `verify_payment_submission()` ran (check `financial_ledger`), not an ad-hoc update. |
| Contribution schedule missing | The rule is inactive or the amount is `NULL` — this is intended until an administrator activates it. |
