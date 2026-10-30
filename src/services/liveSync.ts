import { supabase, isLiveSupabaseConfigured } from './supabaseClient';
import {
  loadState,
  onStateWritten,
  writeState,
  type LocalDbState,
  type LocalUser,
} from './localStore';
import { ensureWeeklySchedule } from './databaseService';
import type { AppRole, AuthenticatedUser, MembershipStatus } from '../types/database';

/* ------------------------------------------------------------------ */
/* Live sync bridge                                                    */
/* The screens run on the fast local engine. In live mode this bridge  */
/* keeps every approved phone sharing ONE group state document in      */
/* Supabase (public.group_state, migration 005):                       */
/*   - accounts/roles always come from profiles + user_roles,          */
/*   - financial records (rules, weeks, obligations, payments,         */
/*     expenses, ledger, notifications) sync through the document,     */
/*   - writes push (debounced), pulls happen on start/focus/online     */
/*     and every 25s; last write wins (fine for a year-group fund).    */
/* Offline it simply keeps the last-good local copy.                   */
/* ------------------------------------------------------------------ */

const FINANCIAL_KEYS = [
  'contribution_rules',
  'contribution_periods',
  'obligations',
  'payments',
  'allocations',
  'expenses',
  'attachments',
  'ledger',
  'notifications',
  'audit_logs',
] as const;

export type FinancialState = Pick<LocalDbState, (typeof FINANCIAL_KEYS)[number]>;

export function extractFinancialState(state: LocalDbState): FinancialState {
  const out = {} as FinancialState;
  FINANCIAL_KEYS.forEach((key) => {
    out[key] = (state[key] ?? []) as never;
  });
  return out;
}

export function sanitizeFinancialState(raw: unknown): FinancialState {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as FinancialState;
  FINANCIAL_KEYS.forEach((key) => {
    out[key] = (Array.isArray(source[key]) ? source[key] : []) as never;
  });
  return out;
}

export interface ProfileLike {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  membership_status: MembershipStatus;
  privacy_accepted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The member list always mirrors Supabase profiles — the source of truth. */
export function mergeProfileUsers(
  current: LocalUser[],
  profiles: ProfileLike[],
  roles: Map<string, AppRole>
): LocalUser[] {
  return profiles.map((p) => {
    const existing = current.find((u) => u.id === p.id);
    return {
      id: p.id,
      email: p.email,
      password_hash: existing?.password_hash ?? '',
      full_name: p.full_name,
      phone: p.phone ?? null,
      avatar_url: p.avatar_url ?? null,
      membership_status: p.membership_status,
      role: roles.get(p.id) ?? existing?.role ?? 'member',
      privacy_accepted_at: p.privacy_accepted_at,
      approved_by: p.approved_by ?? null,
      approved_at: p.approved_at ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });
}

let active: { userId: string; stop: () => void } | null = null;

/**
 * Starts syncing for the signed-in approved user. Returns a stop function.
 * Safe to call repeatedly for the same user (reuses the running sync).
 */
export function startLiveSync(user: AuthenticatedUser, onSynced: () => void): () => void {
  if (!isLiveSupabaseConfigured || !supabase) return () => undefined;
  if (active && active.userId === user.profile.id) return active.stop;
  if (active) active.stop();

  const sb = supabase;
  const userId = user.profile.id;
  let stopped = false;
  let knownVersion: number | null = null;
  let suppressPush = false;
  let pushTimer: number | null = null;
  let lastUsersJson = '';

  const fetchProfiles = async (): Promise<{ profiles: ProfileLike[]; roles: Map<string, AppRole> }> => {
    const { data: profiles } = await sb.from('profiles').select('*');
    const { data: roles } = await sb.from('user_roles').select('user_id, role');
    const map = new Map<string, AppRole>();
    (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => map.set(r.user_id, r.role));
    return { profiles: (profiles ?? []) as ProfileLike[], roles: map };
  };

  const applyUsers = (profiles: ProfileLike[], roles: Map<string, AppRole>) => {
    suppressPush = true;
    try {
      writeState((s) => {
        s.users = mergeProfileUsers(s.users, profiles, roles);
        s.is_demo_seed = false;
      });
    } finally {
      suppressPush = false;
    }
  };

  const push = async () => {
    if (stopped || suppressPush) return;
    const financial = extractFinancialState(loadState());
    const nextVersion = (knownVersion ?? 0) + 1;
    const { error } = await sb.from('group_state').upsert(
      {
        id: 1,
        state: financial,
        version: nextVersion,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (!error) knownVersion = nextVersion;
  };

  const schedulePush = () => {
    if (pushTimer !== null) window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      void push();
    }, 700);
  };

  const pull = async () => {
    if (stopped) return;
    try {
      const [{ data: row }, { profiles, roles }] = await Promise.all([
        sb.from('group_state').select('*').eq('id', 1).maybeSingle(),
        fetchProfiles(),
      ]);
      const usersJson = JSON.stringify(
        profiles.map((p) => [p.id, p.membership_status, roles.get(p.id) ?? 'member'])
      );

      if (row && (knownVersion === null || row.version !== knownVersion)) {
        // Newer shared state: adopt it wholesale, refresh members, backfill.
        knownVersion = row.version as number;
        suppressPush = true;
        try {
          writeState((s) => {
            const financial = sanitizeFinancialState(row.state);
            FINANCIAL_KEYS.forEach((key) => {
              (s as unknown as Record<string, unknown>)[key] = financial[key];
            });
            s.users = mergeProfileUsers(s.users, profiles, roles);
            s.is_demo_seed = false;
          });
        } finally {
          suppressPush = false;
        }
        lastUsersJson = usersJson;
        ensureWeeklySchedule(); // late joiners get their weeks; may push after
        onSynced();
        return;
      }

      if (!row) {
        // First approved device ever: publish its local state.
        lastUsersJson = usersJson;
        applyUsers(profiles, roles);
        await push();
        onSynced();
        return;
      }

      if (usersJson !== lastUsersJson) {
        // Someone registered or was approved/declined elsewhere.
        lastUsersJson = usersJson;
        applyUsers(profiles, roles);
        ensureWeeklySchedule();
        onSynced();
      }
    } catch {
      // Offline or transient failure: keep working on last-good data.
    }
  };

  const unsubscribe = onStateWritten(() => {
    if (!suppressPush && !stopped) schedulePush();
  });
  const interval = window.setInterval(() => {
    void pull();
  }, 25000);
  const onFocus = () => {
    void pull();
  };
  const onOnline = () => {
    void pull();
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  void pull();

  const stop = () => {
    stopped = true;
    unsubscribe();
    window.clearInterval(interval);
    if (pushTimer !== null) window.clearTimeout(pushTimer);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
    if (active && active.userId === userId) active = null;
  };
  active = { userId, stop };
  return stop;
}
