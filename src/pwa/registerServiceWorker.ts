/**
 * Registers the service worker (production builds only — the Vite dev
 * server must always serve fresh modules). When a new version takes
 * control, the page reloads once so members are never stuck on a stale
 * build after reconnecting.
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
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installation is a progressive enhancement; the app still works
      // as a normal website without it.
    });
  });
}
