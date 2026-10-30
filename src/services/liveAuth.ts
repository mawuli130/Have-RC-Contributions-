import { supabase, isLiveSupabaseConfigured } from './supabaseClient';
import {
  ServiceError,
  clearLocalMirrorSession,
  syncLocalMirrorUser,
  type AdminMemberRow,
  type SignUpInput,
} from './databaseService';
import type { AppRole, AuthenticatedUser, MembershipStatus, Profile } from '../types/database';

/* ------------------------------------------------------------------ */
/* Live Supabase accounts                                              */
/* Used ONLY when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set   */
/* (isLiveSupabaseConfigured). Registration creates a real Supabase     */
/* Auth user; migration 003's trigger adds the pending profile +       */
/* member role. Approvals and role changes go through guarded RPCs.    */
/* When Supabase is not configured the app uses the offline demo       */
/* engine in databaseService.ts instead — the two never mix.           */
/* ------------------------------------------------------------------ */

/* Last-good copies for offline viewing. When the network fails, screens
 * keep showing these instead of an error; AppContext reloads fresh data
 * the moment the connection returns. */
const SESSION_CACHE_KEY = 'have_rc_live_session_v1';
const MEMBERS_CACHE_KEY = 'have_rc_live_members_v1';

function cacheSessionUser(user: AuthenticatedUser): void {
  try {
    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
  } catch {
    // storage unavailable: offline fallback simply will not persist
  }
}

function readCachedSessionUser(): AuthenticatedUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  } catch {
    return null;
  }
}

function client() {
  if (!isLiveSupabaseConfigured || !supabase) {
    throw new ServiceError(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app.',
      'not_configured'
    );
  }
  return supabase;
}

function friendlyAuthError(message: string): ServiceError {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return new ServiceError('Incorrect email or password. Please try again.');
  }
  if (m.includes('email not confirmed')) {
    return new ServiceError('Please open the confirmation email we sent you first, then log in.');
  }
  if (m.includes('already registered') || m.includes('already exists')) {
    return new ServiceError('An account already exists with this email address. Please log in instead.');
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return new ServiceError('Too many tries. Please wait a moment and try again.');
  }
  if (m.includes('password')) {
    return new ServiceError(message);
  }
  return new ServiceError(message || 'Something went wrong. Please try again.');
}

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  membership_status: MembershipStatus;
  privacy_accepted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    membership_status: row.membership_status,
    privacy_accepted_at: row.privacy_accepted_at,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Loads the profile + role for an authenticated Supabase user. */
async function fetchAuthenticatedUser(
  userId: string,
  fallbackEmail: string,
  fallbackName?: string | null
): Promise<AuthenticatedUser> {
  const sb = client();
  const { data: profileRow, error: profileError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || !profileRow) {
    // Offline (or profile not readable yet): reuse the last-good copy so
    // approved members and admins keep their real status without signal.
    const cached = readCachedSessionUser();
    if (cached && cached.profile.id === userId) return cached;
  }
  const { data: roleRow } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const profile: Profile = profileRow
    ? toProfile(profileRow as ProfileRow)
    : {
        // Profile trigger (migration 003) normally creates this row. The
        // fallback keeps the app usable for accounts created before it ran.
        id: userId,
        full_name: fallbackName && fallbackName.trim().length >= 2 ? fallbackName.trim() : 'Member',
        email: fallbackEmail,
        phone: null,
        avatar_url: null,
        membership_status: 'pending',
        privacy_accepted_at: now,
        approved_by: null,
        approved_at: null,
        created_at: now,
        updated_at: now,
      };

  return { profile, role: (roleRow?.role as AppRole | undefined) ?? 'member' };
}

export interface LiveSignUpResult {
  fullName: string;
  /** True when Supabase emailed a confirmation link and there is no session yet. */
  needsEmailConfirmation: boolean;
}

export async function liveSignUp(input: SignUpInput): Promise<LiveSignUpResult> {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  const email = input.email.trim().toLowerCase();

  if (fullName.length < 3) throw new ServiceError('Please enter your full name (at least 3 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ServiceError('Please enter a valid email address.');
  if (input.password.length < 8) throw new ServiceError('Your password must be at least 8 characters long.');
  if (!input.acceptedPrivacy) {
    throw new ServiceError('Please accept the privacy notice so we can show your contribution status to the group.');
  }

  const sb = client();
  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: fullName, phone: input.phone?.trim() || null },
    },
  });
  if (error) throw friendlyAuthError(error.message);

  // When the email is already taken, Supabase may return an obfuscated user
  // with no identities instead of an error (to avoid leaking accounts).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new ServiceError('An account already exists with this email address. Please log in instead.');
  }
  if (!data.user) {
    throw new ServiceError('Registration failed. Please try again.');
  }
  if (!data.session) {
    // Email confirmation is on: the Auth user + pending profile exist, but
    // the person must click the email link before they can log in.
    return { fullName, needsEmailConfirmation: true };
  }

  const authUser = await fetchAuthenticatedUser(data.user.id, email, fullName);
  cacheSessionUser(authUser);
  syncLocalMirrorUser(authUser);
  return { fullName: authUser.profile.full_name, needsEmailConfirmation: false };
}

export async function liveSignIn(email: string, password: string): Promise<AuthenticatedUser> {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw friendlyAuthError(error.message);
  if (!data.user) throw new ServiceError('Incorrect email or password. Please try again.');

  const metaName = (data.user.user_metadata?.full_name as string | undefined) ?? null;
  const authUser = await fetchAuthenticatedUser(data.user.id, data.user.email ?? email, metaName);

  if (authUser.profile.membership_status === 'rejected') {
    await sb.auth.signOut().catch(() => undefined);
    clearLocalMirrorSession();
    throw new ServiceError('This membership request was declined. Please contact an administrator for help.');
  }

  cacheSessionUser(authUser);
  syncLocalMirrorUser(authUser);
  return authUser;
}

/** Restores the signed-in user on app start (null when signed out). */
export async function liveGetSessionUser(): Promise<AuthenticatedUser | null> {
  if (!isLiveSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  const u = data.session.user;
  const metaName = (u.user_metadata?.full_name as string | undefined) ?? null;
  const authUser = await fetchAuthenticatedUser(u.id, u.email ?? '', metaName);
  cacheSessionUser(authUser);
  syncLocalMirrorUser(authUser);
  return authUser;
}

export async function liveSignOut(): Promise<void> {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch {
    // Signing out locally matters more than a network failure here.
  } finally {
    try {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      window.localStorage.removeItem(MEMBERS_CACHE_KEY);
    } catch {
      // ignore storage failures on sign-out
    }
    clearLocalMirrorSession();
  }
}

export interface LiveProfileUpdate {
  fullName: string;
  phone: string | null;
  /** Small data URL (already downscaled) or null to remove the photo. */
  avatarDataUrl: string | null;
}

/**
 * Saves name/phone/photo to the Supabase profile — the source of truth.
 * Without this, profile edits (especially the photo) only lived in the
 * phone's local mirror and were wiped by the next session restore/sync.
 */
export async function liveUpdateMyProfile(input: LiveProfileUpdate): Promise<AuthenticatedUser> {
  const sb = client();
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 3) throw new ServiceError('Please enter your full name (at least 3 characters).');

  const { data: sessionData } = await sb.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser) throw new ServiceError('You are not signed in. Please log in again.');

  const { data: updatedRows, error } = await sb
    .from('profiles')
    .update({
      full_name: fullName,
      phone: input.phone?.trim() || null,
      avatar_url: input.avatarDataUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authUser.id)
    .select('id');
  if (error) throw new ServiceError(error.message);
  if (!updatedRows || updatedRows.length === 0) {
    throw new ServiceError(
      'Your profile was not found in the database, so the photo could not be saved. Please ask the administrator to confirm the account setup (migration 003), then try again.'
    );
  }

  const updated = await fetchAuthenticatedUser(authUser.id, authUser.email ?? '', fullName);
  cacheSessionUser(updated);
  syncLocalMirrorUser(updated);
  return updated;
}

export async function liveChangeMyPassword(newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new ServiceError('Your new password must be at least 8 characters long.');
  }
  const sb = client();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw friendlyAuthError(error.message);
}

export async function liveRequestPasswordReset(email: string): Promise<string> {
  const sb = client();
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw friendlyAuthError(error.message);
  // Same wording as offline mode: never reveal whether the account exists.
  return 'If that email is registered, a password reset link will be sent to it.';
}

/* ------------------------------------------------------------------ */
/* Admin member management (Manage Members screen, live mode)          */
/* ------------------------------------------------------------------ */

export async function liveListMembers(): Promise<AdminMemberRow[]> {
  const sb = client();
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !profiles) {
    // Offline: show the last list the admin actually saw.
    try {
      const raw = window.localStorage.getItem(MEMBERS_CACHE_KEY);
      if (raw) return JSON.parse(raw) as AdminMemberRow[];
    } catch {
      // fall through to the error below
    }
    throw new ServiceError(error?.message ?? 'Could not load members.');
  }

  const { data: roles } = await sb.from('user_roles').select('user_id, role');
  const roleByUser = new Map<string, AppRole>();
  (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => roleByUser.set(r.user_id, r.role));

  const rows = (profiles as ProfileRow[]).map((row) => ({
    user_id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    membership_status: row.membership_status,
    role: roleByUser.get(row.id) ?? 'member',
    created_at: row.created_at,
    approved_at: row.approved_at ?? null,
    // Contribution money is managed by the financial screens; nothing is
    // recorded in the live database for this member yet.
    total_verified_paid: 0,
    outstanding: 0,
    pending_submissions_count: 0,
    status_label: 'Not Paid',
    relevant_period_label: '',
    has_schedule: false,
  }));

  try {
    window.localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // cache is best-effort only
  }
  return rows;
}

export async function liveApproveMember(userId: string): Promise<void> {
  const sb = client();
  const { error } = await sb.rpc('admin_set_membership', { p_target_user: userId, p_status: 'approved' });
  if (error) throw new ServiceError(error.message);
}

export async function liveRejectMember(userId: string, reason?: string): Promise<void> {
  const sb = client();
  const { error } = await sb.rpc('admin_set_membership', {
    p_target_user: userId,
    p_status: 'rejected',
    p_reason: reason?.trim() || null,
  });
  if (error) throw new ServiceError(error.message);
}

export async function liveSetMemberRole(userId: string, role: AppRole): Promise<void> {
  const sb = client();
  const { error } = await sb.rpc('admin_set_role', { p_target_user: userId, p_role: role });
  if (error) throw new ServiceError(error.message);
}
