// notify-payment — sends a Web Push to every admin/treasurer device when a
// member submits a payment, so they can verify it quickly (even with the
// app closed).
//
// Deploy (once):
//   npx web-push generate-vapid-keys        # keep the private key secret!
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:admin@example.com
//   supabase functions deploy notify-payment
// And set VITE_VAPID_PUBLIC_KEY (the SAME public key) in the app env, then
// redeploy the app. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided
// automatically inside Edge Functions.
//
// The caller must be signed in (their JWT is verified). Only the message
// text comes from the caller; recipients are always admins/treasurers.

// @ts-ignore Deno + npm specifiers are resolved by the Edge runtime.
import webpush from 'npm:web-push@3.6.7';
// @ts-ignore Deno global
const Deno = globalThis.Deno;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// @ts-ignore Deno.serve is provided by the Edge runtime.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  // 1) Verify the caller is a real signed-in user.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authHeader },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { title, body, url } = await req.json().catch(() => ({}));
  const payload = JSON.stringify({
    title: String(title ?? 'Have R/C JHS 2022').slice(0, 80),
    body: String(body ?? 'You have a new update.').slice(0, 180),
    url: String(url ?? '/').slice(0, 200),
  });

  // 2) Recipients: every admin/treasurer subscription.
  const rolesRes = await rest('user_roles?role=in.(admin,treasurer)&select=user_id');
  const roles = (await rolesRes.json()) as Array<{ user_id: string }>;
  const adminIds = [...new Set(roles.map((r) => r.user_id))];
  if (adminIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subsRes = await rest(
    `push_subscriptions?user_id=in.(${adminIds.join(',')})&select=id,endpoint,p256dh,auth`
  );
  const subs = (await subsRes.json()) as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>;

  // 3) Deliver; prune dead subscriptions (410/404).
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await rest(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        }
      }
    })
  );

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
