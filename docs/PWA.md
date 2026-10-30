# Installing the App & Offline Use

The app is an installable web app (PWA). Members can put the **school crest
icon** on their home screen and open it like a normal Android/iPhone app —
full screen, no browser bars.

## Install

**Android (Chrome)**
1. Open the app link in Chrome.
2. Tap **Install the App** on the Welcome screen (or **More → Install App**),
   or open the Chrome **⋮ menu → Install app**.
3. The crest appears on the home screen. Tap it to open the app.

**iPhone (Safari)**
1. Open the app link in Safari.
2. Tap the **Share** button → **Add to Home Screen → Add**.

**Requirements for the install prompt:** the site must be served over
**HTTPS** (Vercel does this automatically) and the production build must be
deployed — the service worker only runs in production builds.

## The icon

Icons live in `public/icons/` and are generated from the same crest artwork
used inside the app (navy shield, gold laurels, open book, 2022 banner — a
recreation, not official school artwork):

```bash
npm run icons   # regenerates crest.svg + 192/512/maskable/apple PNGs
```

Regenerate after any crest change; commit the PNGs with your code change.

## Offline behaviour

- The whole app shell is cached by the service worker (`public/sw.js`), so
  the app **opens with no connection**.
- Contributions data is stored on the device (offline mode) or mirrored
  locally (live Supabase mode), and the admin member list keeps a last-good
  copy — members can **view their totals, outstanding amounts, history and
  the member list offline**.
- While offline a slim amber bar says **"You're offline · Showing last
  saved data"**.
- The moment the connection returns, the app **reloads the session and all
  screen data automatically** and confirms with a green
  **"Back online"** bar + toast.
- Supabase Auth/API calls are never cached or intercepted by the service
  worker; anything that needs the server simply waits for signal.

## Updates

When a new version is deployed, the new service worker activates itself and
the page reloads once — members always end up on the latest build without
doing anything. If an icon or shell change seems stuck, bump `VERSION` in
`public/sw.js`.

## Notifications (payment submitted, member registered, week missed)

Three levels, from simplest to strongest:

1. **In-app** — the bell list (Notifications screen). Admins are alerted the
   moment a payment is submitted or a member registers; members are alerted
   when approved, verified, or a week becomes outstanding.
2. **Browser/phone pop-ups** — with permission granted (**Notifications →
   Phone notifications → Turn on**), new alerts also appear at the top of
   the phone / in the pull-down shade while the app is in the background.
   In live mode, devices sync every ~25 seconds and on focus, so a payment
   submitted on one phone alerts the treasurer on another.
3. **Closed-app push (Web Push)** — for alerts even when the app is fully
   closed. One-time setup:
   1. `npx web-push generate-vapid-keys`
   2. App env: `VITE_VAPID_PUBLIC_KEY=<public key>` → redeploy the app.
   3. `supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@example.com`
   4. `supabase functions deploy notify-payment`
   5. Members/admins tap **Turn on notifications** once. Subscriptions are
      stored in `push_subscriptions` (migration 005); the function only
      ever pushes to admins/treasurers and prunes dead devices.

The private VAPID key is a secret: Edge Function only, never in the app.

## Live sync (migration 005)

In live mode every approved phone shares one group state document
(`public.group_state`): contribution settings, weeks, obligations,
payments, expenses and notifications sync between devices automatically
(writes push within a second; pulls on open/focus/reconnect and every
25s). Accounts and roles always come from `profiles`/`user_roles`.
Members who join after the schedule started are backfilled automatically —
they owe every week from the schedule start, like everyone else.

## If a phone ever shows "FetchEvent.respondWith … Can't find variable: caches"

That was the v2 worker running on an iOS version whose service workers
have no Cache API. v3 fixes it at the root: the worker feature-detects
the Cache API, steps aside completely where it is missing, and can
never fail a page load. Phones normally self-heal on the next visit
(sw.js is always fetched fresh). If one phone stays stuck:

1. Delete the home-screen icon (long-press → Remove App).
2. iPhone **Settings → Safari → Advanced → Website Data** → find this
   site → **Delete** (this evicts the bad worker).
3. Open the site link fresh in Safari, then re-add to the home screen.
