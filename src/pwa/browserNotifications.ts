import type { AppNotification } from '../types/database';

/* ------------------------------------------------------------------ */
/* Browser notifications                                               */
/* When a new in-app notification arrives (payment submitted, member   */
/* registered, week missed...) and the app is in the background, we    */
/* also surface it as a real browser/phone notification — the kind     */
/* that appears at the top of the phone and in the pull-down shade.    */
/* Closed-app pushes additionally need the Web Push subscription in    */
/* pushNotifications.ts + the notify-payment Edge Function.            */
/* ------------------------------------------------------------------ */

const SEEN_KEY = 'have_rc_browser_notified_v1';
const MAX_SEEN = 200;

export type NotificationSupport = NotificationPermission | 'unsupported';

export function browserNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationSupport {
  if (!browserNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (!browserNotificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function showViaServiceWorker(title: string, body: string, tag: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  await registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    data: { url: '/' },
  });
  return true;
}

/** Shows one notification as a phone/browser alert. Foreground use is
 *  left to in-app toasts, so this only fires while the app is hidden. */
export async function showBrowserNotification(notification: AppNotification): Promise<boolean> {
  if (!browserNotificationsSupported() || Notification.permission !== 'granted') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;
  try {
    return await showViaServiceWorker(notification.title, notification.message, notification.id);
  } catch {
    return false;
  }
}

/** Manual "send test" from the Notifications screen (works in foreground). */
export async function showTestBrowserNotification(): Promise<boolean> {
  if (!browserNotificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const shown = await showViaServiceWorker(
      'Have R/C JHS 2022',
      'Phone notifications are on. New payments and updates will appear here.',
      'have-rc-test'
    );
    if (shown) return true;
    new Notification('Have R/C JHS 2022', {
      body: 'Phone notifications are on. New payments and updates will appear here.',
      icon: '/icons/icon-192.png',
    });
    return true;
  } catch {
    return false;
  }
}

function loadSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveSeen(ids: string[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-MAX_SEEN)));
  } catch {
    // best effort only
  }
}

/**
 * Surfaces any unread notifications we have not shown before as browser
 * notifications. The very first run only records history (no spam burst).
 */
export function surfaceNewNotifications(notifications: AppNotification[]): void {
  const seen = loadSeen();
  if (seen.length === 0 && notifications.length > 0) {
    saveSeen(notifications.map((n) => n.id));
    return;
  }
  const seenSet = new Set(seen);
  const fresh = notifications.filter((n) => !n.is_read && !seenSet.has(n.id));
  if (fresh.length === 0) return;
  fresh.forEach((n) => {
    seenSet.add(n.id);
    void showBrowserNotification(n);
  });
  saveSeen([...seenSet]);
}
