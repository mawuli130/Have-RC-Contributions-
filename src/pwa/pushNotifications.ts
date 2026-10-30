import { supabase, isLiveSupabaseConfigured } from '../services/supabaseClient';

/* ------------------------------------------------------------------ */
/* Web Push subscriptions (closed-app alerts)                          */
/* The browser subscription is stored in Supabase (push_subscriptions, */
/* migration 005). The notify-payment Edge Function uses the service   */
/* role + VAPID keys to deliver pushes to admins when a payment is     */
/* submitted — even while their app is closed. Requires:               */
/*   VITE_VAPID_PUBLIC_KEY in the app env, and the Edge Function       */
/*   deployed with VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets.       */
/* Without a VAPID key this gracefully does nothing; background        */
/* browser notifications (browserNotifications.ts) still work.         */
/* ------------------------------------------------------------------ */

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushConfigured = Boolean(
  vapidPublicKey && vapidPublicKey.length > 20 && !vapidPublicKey.includes('placeholder')
);

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    pushConfigured
  );
}

/** Subscribes this device and stores the subscription for the user. */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as BufferSource,
      }));

    if (isLiveSupabaseConfigured && supabase) {
      const json = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'endpoint' }
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      if (isLiveSupabaseConfigured && supabase) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
      }
      await subscription.unsubscribe();
    }
  } catch {
    // unsubscribing is best-effort
  }
}
