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
