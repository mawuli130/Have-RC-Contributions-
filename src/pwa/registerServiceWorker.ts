/**
 * Registers the service worker (production builds only — the Vite dev
 * server must always serve fresh modules). When a new version takes
 * control, the page reloads once so members are never stuck on a stale
 * build after reconnecting.
 *
 * updateViaCache: 'none' forces the browser to always fetch sw.js fresh
 * from the network, and we re-check for updates whenever the app comes
 * back to the foreground — together these let phones recover by
 * themselves if a worker ever misbehaves.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        const checkForUpdate = () => {
          registration.update().catch(() => undefined);
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        window.addEventListener('online', checkForUpdate);
      })
      .catch(() => {
        // Installation is a progressive enhancement; the app still works
        // as a normal website without it.
      });
  });
}
