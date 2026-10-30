import { describe, expect, it } from 'vitest';
import {
  approveMember,
  getAdminMemberRows,
  getCurrentWeekOutstanding,
  getGroupSummary,
  getNotifications,
  signIn,
  signUp,
} from '../services/databaseService';
import { loadState, resetToSeed, writeState } from '../services/localStore';
import {
  extractFinancialState,
  mergeProfileUsers,
  sanitizeFinancialState,
  type ProfileLike,
} from '../services/liveSync';
import { surfaceNewNotifications } from '../pwa/browserNotifications';
import type { AppNotification } from '../types/database';

const ADMIN = { email: 'admin@have2022.org', password: 'Admin123!' };

function joinAndApprove(fullName: string, email: string): string {
  signIn(ADMIN.email, ADMIN.password);
  const session = signUp({ fullName, email, password: 'StrongPass123', acceptedPrivacy: true });
  signIn(ADMIN.email, ADMIN.password);
  approveMember(session.profile.id);
  return session.profile.id;
}

describe('Late joiners (schedule started before they registered)', () => {
  it('a member approved after the weeks started gets every week + outstanding', () => {
    resetToSeed();
    const lateId = joinAndApprove('Late Joiner', 'latejoiner@example.com');

    const state = loadState();
    const periods = state.contribution_periods;
    const obligations = state.obligations.filter((o) => o.member_id === lateId);
    expect(periods.length).toBeGreaterThan(1);
    expect(obligations.length).toBe(periods.length);

    // Admin sees their outstanding like everyone else's.
    signIn(ADMIN.email, ADMIN.password);
    const row = getAdminMemberRows().find((r) => r.user_id === lateId);
    expect(row).toBeTruthy();
    expect(row!.outstanding).toBeGreaterThanOrEqual(10);

    // And they appear in the current-week outstanding list.
    signIn('latejoiner@example.com', 'StrongPass123');
    const week = getCurrentWeekOutstanding();
    expect(week?.members.some((m) => m.member_id === lateId)).toBe(true);
  });

  it('sync backfills obligations even when approval happened elsewhere', () => {
    resetToSeed();
    const lateId = joinAndApprove('External Approve', 'external@example.com');

    // Simulate approval via Supabase/another device: obligations missing locally.
    writeState((s) => {
      s.obligations = s.obligations.filter((o) => o.member_id !== lateId);
    });
    expect(loadState().obligations.some((o) => o.member_id === lateId)).toBe(false);

    // Any schedule-aware read must repair it.
    signIn('external@example.com', 'StrongPass123');
    getCurrentWeekOutstanding();

    const state = loadState();
    expect(state.obligations.filter((o) => o.member_id === lateId).length).toBe(
      state.contribution_periods.length
    );
  });
});

describe('Registration alerts + registered members count', () => {
  it('admins are notified when a new member registers', () => {
    resetToSeed();
    signUp({ fullName: 'Fresh Member', email: 'fresh@example.com', password: 'StrongPass123', acceptedPrivacy: true });
    signIn(ADMIN.email, ADMIN.password);
    const notes = getNotifications();
    expect(notes.some((n) => n.title === 'New Member Registered' && n.message.includes('Fresh Member'))).toBe(true);
  });

  it('group summary counts every registered account', () => {
    resetToSeed();
    signIn(ADMIN.email, ADMIN.password);
    const summary = getGroupSummary();
    expect(summary.registered_members_count).toBe(loadState().users.length);
    expect(summary.registered_members_count).toBeGreaterThan(summary.approved_members_count);
  });
});

describe('Live sync helpers', () => {
  it('extracts and sanitizes only the financial slices', () => {
    resetToSeed();
    const state = loadState();
    const financial = extractFinancialState(state);
    expect(Object.keys(financial)).not.toContain('users');
    expect(Array.isArray(financial.obligations)).toBe(true);
    const empty = sanitizeFinancialState(null);
    expect(empty.obligations).toEqual([]);
    expect(empty.payments).toEqual([]);
    const partial = sanitizeFinancialState({ payments: [{ id: 'x' }], obligations: 'junk' });
    expect(partial.payments).toHaveLength(1);
    expect(partial.obligations).toEqual([]);
  });

  it('merges Supabase profiles into local users with roles', () => {
    const profiles: ProfileLike[] = [
      {
        id: 'u1',
        email: 'a@example.com',
        full_name: 'Ama Serwaa',
        phone: null,
        avatar_url: null,
        membership_status: 'approved',
        privacy_accepted_at: '2026-01-01T00:00:00.000Z',
        approved_by: null,
        approved_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const roles = new Map([['u1', 'treasurer' as const]]);
    const merged = mergeProfileUsers([], profiles, roles);
    expect(merged).toHaveLength(1);
    expect(merged[0].role).toBe('treasurer');
    expect(merged[0].membership_status).toBe('approved');
  });

  it('first browser-notification run records history without bursting', () => {
    const fake: AppNotification[] = [
      {
        id: 'ntf_1',
        user_id: 'u1',
        title: 'New Payment to Review',
        message: 'Ama submitted GH₵10.00',
        type: 'payment_submitted',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ];
    surfaceNewNotifications(fake);
    const stored = window.localStorage.getItem('have_rc_browser_notified_v1');
    expect(stored).toContain('ntf_1');
  });
});
