/* Have R/C JHS 2022 — service worker (v3)
 *
 * HARD RULE: this worker must never break a page load. Some browsers
 * (older iOS Safari in particular) run service workers WITHOUT the
 * Cache API — `caches` is simply not defined there. v2 called it
 * unguarded, which threw inside respondWith and bricked the site.
 * v3 therefore:
 *   - feature-detects the Cache API and skips caching entirely where
 *     it is missing (the site then behaves like a normal website),
 *   - wraps every cache call so failures degrade to plain network,
 *   - always resolves navigations to a real page (never an error).
 *
 * Where caching exists:
 *   - app shell is precached; navigations are network-first with a
 *     cached/offline fallback; static assets stale-while-revalidate;
 *   - API/auth traffic (Supabase) and non-GET requests are untouched.
 * Bump VERSION to ship a new shell; old caches are deleted on activate. */
const VERSION = 'v3';
const SHELL_CACHE = `have-rc-shell-${VERSION}`;
const RUNTIME_CACHE = `have-rc-runtime-${VERSION}`;

const HAS_CACHE = typeof caches !== 'undefined' && typeof caches.open === 'function';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/crest.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Have R/C JHS 2022 — Offline</title>
<style>body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#071F42;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}div{max-width:320px}h1{font-size:20px;margin:0 0 8px}p{color:#B9CBE8;font-size:14px;line-height:1.5;margin:0 0 16px}button{background:#FFC400;color:#071F42;border:0;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700}</style>
</head><body><div>
<h1>You're offline</h1>
<p>The app could not load. Check your connection and try again — your saved data is still on this phone.</p>
<button onclick="location.reload()">Try again</button>
</div></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (HAS_CACHE) {
        try {
          const cache = await caches.open(SHELL_CACHE);
          await cache.addAll(PRECACHE_URLS);
        } catch {
          // Precaching is best-effort; a failed shell must not block install.
        }
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (HAS_CACHE) {
        try {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
              .map((key) => caches.delete(key))
          );
        } catch {
          // Old caches are harmless; never fail activation over them.
        }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Never intercept cross-origin traffic (Supabase auth/API, CDNs).
  if (url.origin !== self.location.origin) return;

  // No Cache API on this browser: step aside completely and let the
  // request behave like a normal website request. THIS is the line
  // that keeps older iPhones working.
  if (!HAS_CACHE) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          try {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put('/index.html', fresh.clone());
          } catch {
            // Caching the fresh page is optional.
          }
          return fresh;
        } catch {
          try {
            const cached = await caches.match('/index.html');
            if (cached) return cached;
          } catch {
            // fall through to the offline page
          }
          return new Response(OFFLINE_PAGE, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  // Same-origin static files: serve cache fast, refresh in the background.
  event.respondWith(
    (async () => {
      let cached;
      try {
        cached = await caches.match(request);
      } catch {
        cached = undefined;
      }
      if (cached) {
        fetch(request)
          .then(async (response) => {
            if (response && response.ok) {
              try {
                const cache = await caches.open(RUNTIME_CACHE);
                await cache.put(request, response.clone());
              } catch {
                // background refresh is best-effort
              }
            }
          })
          .catch(() => undefined);
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          try {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
          } catch {
            // caching is optional
          }
        }
        return response;
      } catch {
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});

/* Web Push: delivered by the notify-payment Edge Function when a payment
 * is submitted (admins/treasurers), even while the app is closed. */
self.addEventListener('push', (event) => {
  let payload = { title: 'Have R/C JHS 2022', body: 'You have a new update.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'have-rc-push',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
