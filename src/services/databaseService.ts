import type {
  AppNotification,
  AppRole,
  AuditLogEntry,
  AuthenticatedUser,
  ContributionObligation,
  ContributionRule,
  ExpenseRecord,
  FinancialLedgerEntry,
  GroupFinancialSummary,
  MembershipStatus,
  PaymentSubmission,
  Profile,
  PublicMemberPaymentSummary,
  RecentActivityItem,
} from '../types/database';
import { roundMoney, formatGHS, buildWhatsAppReminderMessage, buildWhatsAppUrl } from '../utils/formatters';
import {
  DEMO_ACCOUNTS,
  addMonths,
  addDays,
  hashPassword,
  isOverdue,
  loadState,
  newId,
  resetToBlank,
  resetToSeed,
  todayISO,
  toISODate,
  verifyPassword,
  writeState,
  monthKey,
  monthLabel,
  type LocalDbState,
  type LocalUser,
} from './localStore';
import {
  computeGroupSummary,
  computeMember,
  computeRecentActivity,
  toPublicSummary,
  type MemberComputation,
} from './calculations';

export class ServiceError extends Error {
  code: string;
  constructor(message: string, code = 'invalid') {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export const DEMO_LOGIN_ACCOUNTS = DEMO_ACCOUNTS;

/* ------------------------------------------------------------------ */
/* Authorization helpers — mirror of the database RLS policies         */
/* ------------------------------------------------------------------ */

function currentUser(state: LocalDbState): LocalUser {
  const id = state.session_user_id;
  const user = id ? state.users.find((u) => u.id === id) : null;
  if (!user) throw new ServiceError('You must be signed in to continue.', 'unauthenticated');
  return user;
}

function requireApproved(state: LocalDbState): LocalUser {
  const user = currentUser(state);
  if (user.membership_status !== 'approved') {
    throw new ServiceError(
      'Your membership is still awaiting approval. Group financial information is private until an administrator approves you.',
      'not_approved'
    );
  }
  return user;
}

export function isAdminRole(role: AppRole): boolean {
  return role === 'admin' || role === 'treasurer';
}

function requireAdmin(state: LocalDbState): LocalUser {
  const user = requireApproved(state);
  if (!isAdminRole(user.role)) {
    throw new ServiceError('Access denied: administrator permission is required for this action.', 'forbidden');
  }
  return user;
}

function audit(
  state: LocalDbState,
  actor: LocalUser | null,
  action_type: string,
  entity_type: string,
  entity_id: string | null,
  summary: string,
  metadata: Record<string, unknown> = {}
): void {
  state.audit_logs.push({
    id: newId('aud'),
    actor_id: actor?.id ?? null,
    actor_name: actor?.full_name ?? 'System',
    action_type,
    entity_type,
    entity_id,
    summary,
    metadata,
    created_at: new Date().toISOString(),
  });
}

function notify(
  state: LocalDbState,
  user_id: string,
  title: string,
  message: string,
  type: AppNotification['type']
): void {
  state.notifications.push({
    id: newId('ntf'),
    user_id,
    title,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

function toProfile(user: LocalUser): Profile {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    membership_status: user.membership_status,
    privacy_accepted_at: user.privacy_accepted_at,
    approved_by: user.approved_by,
    approved_at: user.approved_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  acceptedPrivacy: boolean;
}

export function signUp(input: SignUpInput): AuthenticatedUser {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  const email = input.email.trim().toLowerCase();

  if (fullName.length < 3) throw new ServiceError('Please enter your full name (at least 3 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ServiceError('Please enter a valid email address.');
  if (input.password.length < 8) throw new ServiceError('Your password must be at least 8 characters long.');
  if (!input.acceptedPrivacy) {
    throw new ServiceError('Please accept the privacy notice so we can show your contribution status to the group.');
  }

  const state = loadState();
  if (state.users.some((u) => u.email.toLowerCase() === email)) {
    throw new ServiceError('An account already exists with this email address. Please log in instead.');
  }

  const now = new Date().toISOString();
  const user: LocalUser = {
    id: newId('usr'),
    email,
    password_hash: hashPassword(input.password),
    full_name: fullName,
    phone: input.phone?.trim() || null,
    avatar_url: null,
    // Membership ALWAYS starts pending. Admin rights are never granted at signup.
    membership_status: 'pending',
    role: 'member',
    privacy_accepted_at: now,
    approved_by: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
  };

  writeState((s) => {
    s.users.push(user);
    s.session_user_id = user.id;
    audit(s, user, 'REGISTER', 'profiles', user.id, `${fullName} registered and is awaiting approval`);
    // Tell admins/treasurers immediately so nobody waits unnoticed.
    s.users
      .filter((u) => isAdminRole(u.role) && u.membership_status === 'approved')
      .forEach((adminUser) => {
        notify(
          s,
          adminUser.id,
          'New Member Registered',
          `${fullName} just registered and is awaiting approval.`,
          'system'
        );
      });
  });

  return { profile: toProfile(user), role: 'member' };
}

export function signIn(email: string, password: string): AuthenticatedUser {
  const state = loadState();
  const normalized = email.trim().toLowerCase();
  const user = state.users.find((u) => u.email.toLowerCase() === normalized);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new ServiceError('Incorrect email or password. Please try again.');
  }
  if (user.membership_status === 'rejected') {
    throw new ServiceError('This membership request was declined. Please contact an administrator for help.');
  }
  writeState((s) => {
    s.session_user_id = user.id;
  });
  return { profile: toProfile(user), role: user.role };
}

export function signOut(): void {
  writeState((s) => {
    s.session_user_id = null;
  });
}

export function getSessionUser(): AuthenticatedUser | null {
  const state = loadState();
  if (!state.session_user_id) return null;
  const user = state.users.find((u) => u.id === state.session_user_id);
  if (!user) return null;
  return { profile: toProfile(user), role: user.role };
}

/* ------------------------------------------------------------------ */
/* Live-mode mirror                                                    */
/* When the app is connected to Supabase, accounts live in Supabase    */
/* Auth + profiles (see services/liveAuth.ts). The contribution       */
/* screens still read the local engine, so the signed-in Supabase     */
/* user is mirrored into local state. Demo seed data is wiped first   */
/* so a live deployment never shows invented members or balances.     */
/* ------------------------------------------------------------------ */

export function syncLocalMirrorUser(user: AuthenticatedUser): void {
  if (loadState().is_demo_seed) {
    resetToBlank();
  }
  writeState((s) => {
    const p = user.profile;
    const existing = s.users.find((u) => u.id === p.id);
    const mirrored: LocalUser = {
      id: p.id,
      email: p.email,
      // Passwords are managed by Supabase Auth in live mode; never stored here.
      password_hash: existing?.password_hash ?? '',
      full_name: p.full_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      membership_status: p.membership_status,
      role: user.role,
      privacy_accepted_at: p.privacy_accepted_at,
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
    if (existing) {
      Object.assign(existing, mirrored);
    } else {
      s.users.push(mirrored);
    }
    s.session_user_id = p.id;
  });
}

export function clearLocalMirrorSession(): void {
  writeState((s) => {
    s.session_user_id = null;
  });
}

export function requestPasswordReset(email: string): string {
  const state = loadState();
  const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    // Do not reveal whether an account exists
    return 'If that email is registered, a password reset link will be sent to it.';
  }
  audit(state, null, 'PASSWORD_RESET_REQUESTED', 'profiles', user.id, `Password reset requested for ${email}`);
  writeState(() => undefined);
  return 'If that email is registered, a password reset link will be sent to it.';
}

export function updateMyProfile(input: { fullName?: string; phone?: string | null; avatarDataUrl?: string | null }): void {
  writeState((s) => {
    const user = requireApproved(s);
    if (input.fullName !== undefined) {
      const cleaned = input.fullName.trim().replace(/\s+/g, ' ');
      if (cleaned.length < 3) throw new ServiceError('Please enter your full name (at least 3 characters).');
      user.full_name = cleaned;
    }
    if (input.phone !== undefined) user.phone = input.phone?.trim() || null;
    if (input.avatarDataUrl !== undefined) user.avatar_url = input.avatarDataUrl;
    user.updated_at = new Date().toISOString();
    audit(s, user, 'UPDATE_PROFILE', 'profiles', user.id, `${user.full_name} updated their profile details`);
  });
}

export function changeMyPassword(currentPassword: string, newPassword: string): void {
  writeState((s) => {
    const user = currentUser(s);
    if (!verifyPassword(currentPassword, user.password_hash)) {
      throw new ServiceError('Your current password is incorrect.');
    }
    if (newPassword.length < 8) throw new ServiceError('Your new password must be at least 8 characters long.');
    user.password_hash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    audit(s, user, 'CHANGE_PASSWORD', 'profiles', user.id, `${user.full_name} changed their password`);
  });
}

/* ------------------------------------------------------------------ */
/* Reads — scoped to the viewing user                                  */
/* ------------------------------------------------------------------ */

export function getGroupSummary(): GroupFinancialSummary {
  ensureWeeklySchedule();
  const state = loadState();
  requireApproved(state);
  return computeGroupSummary(state);
}

export function getPublicMembers(): PublicMemberPaymentSummary[] {
  ensureWeeklySchedule();
  const state = loadState();
  requireApproved(state);
  return state.users
    .filter((u) => u.membership_status === 'approved')
    .map((u) => computeMember(state, u.id))
    .filter((c): c is MemberComputation => Boolean(c))
    .map(toPublicSummary)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function getMyComputation(): MemberComputation | null {
  ensureWeeklySchedule();
  const state = loadState();
  const user = requireApproved(state);
  return computeMember(state, user.id);
}

export function getMyObligations(): ContributionObligation[] {
  ensureWeeklySchedule();
  const state = loadState();
  const user = requireApproved(state);
  return state.obligations
    .filter((o) => o.member_id === user.id)
    .map((o) => ({ ...o, is_overdue: isOverdue(o) }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getMyPayments(): PaymentSubmission[] {
  const state = loadState();
  const user = currentUser(state);
  return state.payments
    .filter((p) => p.member_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** All submissions for the group — administrators/treasurers only. */
export function getAllPayments(): PaymentSubmission[] {
  const state = loadState();
  requireAdmin(state);
  return [...state.payments].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getPendingPayments(): PaymentSubmission[] {
  return getAllPayments().filter((p) => p.status === 'pending');
}

export function getWalletRecipient(): { momoNumber: string; momoName: string } {
  const state = loadState();
  requireApproved(state);
  const rule = state.contribution_rules[0];
  return {
    momoNumber: rule?.treasurer_momo_number ?? '—',
    momoName: rule?.treasurer_momo_name ?? 'Have R/C JHS 2022 Welfare Fund',
  };
}

export function getContributionRule(): ContributionRule | null {
  ensureWeeklySchedule();
  const state = loadState();
  requireApproved(state);
  return state.contribution_rules[0] ?? null;
}

export function getExpenses(): ExpenseRecord[] {
  const state = loadState();
  requireApproved(state);
  return [...state.expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date));
}

export function getLedgerEntries(filter?: {
  type?: 'all' | 'income' | 'expense';
  from?: string;
  to?: string;
}): FinancialLedgerEntry[] {
  const state = loadState();
  requireApproved(state);
  let entries = [...state.ledger];
  if (filter?.type === 'income') entries = entries.filter((e) => e.signed_amount_ghs > 0);
  if (filter?.type === 'expense') entries = entries.filter((e) => e.signed_amount_ghs < 0);
  if (filter?.from) entries = entries.filter((e) => e.entry_date >= filter.from!);
  if (filter?.to) entries = entries.filter((e) => e.entry_date <= filter.to!);
  return entries.sort((a, b) => {
    const byDate = b.entry_date.localeCompare(a.entry_date);
    return byDate !== 0 ? byDate : b.created_at.localeCompare(a.created_at);
  });
}

export function getRecentActivity(limit = 12): RecentActivityItem[] {
  const state = loadState();
  requireApproved(state);
  return computeRecentActivity(state, limit);
}

export function getNotifications(): AppNotification[] {
  ensureWeeklySchedule();
  const state = loadState();
  const user = currentUser(state);
  return state.notifications
    .filter((n) => n.user_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markNotificationRead(id: string): void {
  writeState((s) => {
    const user = currentUser(s);
    const n = s.notifications.find((x) => x.id === id && x.user_id === user.id);
    if (n) n.is_read = true;
  });
}

export function markAllNotificationsRead(): void {
  writeState((s) => {
    const user = currentUser(s);
    s.notifications.forEach((n) => {
      if (n.user_id === user.id) n.is_read = true;
    });
  });
}

/* ------------------------------------------------------------------ */
/* Admin: membership management                                       */
/* ------------------------------------------------------------------ */

export interface AdminMemberRow {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  membership_status: MembershipStatus;
  role: AppRole;
  created_at: string;
  approved_at: string | null;
  total_verified_paid: number;
  outstanding: number;
  pending_submissions_count: number;
  status_label: string;
  relevant_period_label: string;
  has_schedule: boolean;
}

export function getAdminMemberRows(): AdminMemberRow[] {
  const state = loadState();
  requireAdmin(state);
  return state.users
    .map((u) => {
      const computation = computeMember(state, u.id);
      return {
        user_id: u.id,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        membership_status: u.membership_status,
        role: u.role,
        created_at: u.created_at,
        approved_at: u.approved_at,
        total_verified_paid: computation?.total_verified_paid ?? 0,
        outstanding: computation?.outstanding ?? 0,
        pending_submissions_count: computation?.pending_count ?? 0,
        status_label: computation?.status_label ?? 'Schedule Not Set',
        relevant_period_label: computation?.relevant_period_label ?? '—',
        has_schedule: computation?.has_schedule ?? false,
      };
    })
    .sort((a, b) => {
      const order: Record<MembershipStatus, number> = { pending: 0, approved: 1, rejected: 2 };
      if (order[a.membership_status] !== order[b.membership_status]) {
        return order[a.membership_status] - order[b.membership_status];
      }
      return a.full_name.localeCompare(b.full_name);
    });
}

export function approveMember(userId: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const user = s.users.find((u) => u.id === userId);
    if (!user) throw new ServiceError('Member not found.');
    if (user.membership_status === 'approved') return;
    user.membership_status = 'approved';
    user.approved_by = admin.id;
    user.approved_at = new Date().toISOString();
    user.updated_at = new Date().toISOString();

    // Generate obligations for any already-active contribution rule
    const rule = s.contribution_rules.find((r) => r.is_active && r.amount_ghs !== null);
    if (rule) generateObligationsForMember(s, user, rule);

    notify(
      s,
      user.id,
      'Membership Approved',
      'Welcome! Your membership has been approved. You can now view group contributions and financial records.',
      'membership_approved'
    );
    audit(s, admin, 'APPROVE_MEMBER', 'profiles', user.id, `Approved membership for ${user.full_name}`);
  });
}

export function rejectMember(userId: string, reason: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const user = s.users.find((u) => u.id === userId);
    if (!user) throw new ServiceError('Member not found.');
    if (user.role === 'admin') throw new ServiceError('Administrator accounts cannot be declined.');
    user.membership_status = 'rejected';
    user.updated_at = new Date().toISOString();
    notify(
      s,
      user.id,
      'Membership Not Approved',
      reason?.trim() || 'Your membership request was declined. Please contact the group administrator.',
      'system'
    );
    audit(s, admin, 'REJECT_MEMBER', 'profiles', user.id, `Declined membership for ${user.full_name}`, { reason });
  });
}

export function setMemberRole(userId: string, role: AppRole): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    if (admin.role !== 'admin') {
      throw new ServiceError('Only a full administrator can change roles.');
    }
    const user = s.users.find((u) => u.id === userId);
    if (!user) throw new ServiceError('Member not found.');
    if (user.id === admin.id && role !== 'admin') {
      throw new ServiceError('You cannot remove your own administrator role.');
    }
    const admins = s.users.filter((u) => u.role === 'admin' && u.membership_status === 'approved');
    if (user.role === 'admin' && role !== 'admin' && admins.length <= 1) {
      throw new ServiceError('At least one administrator must remain in the group.');
    }
    user.role = role;
    user.updated_at = new Date().toISOString();
    audit(s, admin, 'SET_ROLE', 'user_roles', user.id, `Set ${user.full_name}'s role to ${role}`, { role });
  });
}

/* ------------------------------------------------------------------ */
/* Admin: contribution settings & obligation generation               */
/* ------------------------------------------------------------------ */

export interface RuleInput {
  title: string;
  amountGhs: number | null; // null = deliberately unset
  frequency: ContributionRule['frequency'];
  /** 1 = every week (default), 2 = every 2 weeks. Weekly only. */
  everyWeeks?: number;
  /** Total number of weeks/periods. null = no end. */
  durationPeriods?: number | null;
  startDate: string;
  dueDay: number;
  gracePeriodDays: number;
  isActive: boolean;
  momoNumber: string;
  momoName: string;
}

export function saveContributionRule(input: RuleInput): { periodsCreated: number } {
  let created = 0;
  writeState((s) => {
    const admin = requireAdmin(s);

    const wantsActive = input.isActive;
    if (input.amountGhs === null || input.amountGhs === undefined || Number.isNaN(input.amountGhs)) {
      if (wantsActive) {
        throw new ServiceError(
          'Enter the agreed contribution amount before activating the schedule. The group can keep the amount unset until a decision is made.'
        );
      }
    }
    if (input.amountGhs !== null && input.amountGhs !== undefined && input.amountGhs <= 0) {
      throw new ServiceError('Contribution amount must be greater than zero.');
    }
    if (wantsActive && !input.startDate) {
      throw new ServiceError('Choose the first contribution start date before activating the schedule.');
    }
    if (input.dueDay < 1 || input.dueDay > 31) throw new ServiceError('Due day must be between 1 and 31.');
    const everyWeeks = Math.round(input.everyWeeks ?? 1);
    if (everyWeeks < 1 || everyWeeks > 12) throw new ServiceError('Weeks between payments must be 1 to 12.');
    const durationPeriods =
      input.durationPeriods === null || input.durationPeriods === undefined || (input.durationPeriods as unknown) === ''
        ? null
        : Math.round(input.durationPeriods);
    if (durationPeriods !== null && (durationPeriods < 1 || durationPeriods > 260)) {
      throw new ServiceError('Duration must be 1 to 260 weeks/periods, or blank for no end.');
    }
    if (input.gracePeriodDays < 0 || input.gracePeriodDays > 60) {
      throw new ServiceError('Grace period must be between 0 and 60 days.');
    }

    const now = new Date().toISOString();
    let rule = s.contribution_rules[0];
    if (!rule) {
      rule = {
        id: newId('rule'),
        title: input.title.trim() || 'Have R/C JHS 2022 Contribution',
        amount_ghs: input.amountGhs,
        frequency: input.frequency,
        every_weeks: everyWeeks,
        duration_periods: durationPeriods,
        start_date: input.startDate || null,
        due_day: input.dueDay,
        grace_period_days: input.gracePeriodDays,
        is_active: false,
        treasurer_momo_number: input.momoNumber,
        treasurer_momo_name: input.momoName,
        updated_by: admin.id,
        created_at: now,
        updated_at: now,
      };
      s.contribution_rules.push(rule);
    }

    const previousActive = rule.is_active;
    rule.title = input.title.trim() || rule.title;
    rule.amount_ghs = input.amountGhs ?? null;
    rule.frequency = input.frequency;
    rule.every_weeks = everyWeeks;
    rule.duration_periods = durationPeriods;
    rule.start_date = input.startDate || null;
    rule.due_day = input.dueDay;
    rule.grace_period_days = input.gracePeriodDays;
    rule.is_active = wantsActive && rule.amount_ghs !== null && Boolean(rule.start_date);
    rule.treasurer_momo_number = input.momoNumber.trim() || rule.treasurer_momo_number;
    rule.treasurer_momo_name = input.momoName.trim() || rule.treasurer_momo_name;
    rule.updated_by = admin.id;
    rule.updated_at = now;

    if (rule.is_active && rule.amount_ghs !== null && rule.start_date) {
      created = generateObligations(s, rule);
    }

    const summaryParts = [
      rule.amount_ghs === null ? 'amount unset' : `GH₵${rule.amount_ghs.toFixed(2)}`,
      rule.frequency.replace('_', ' '),
      rule.is_active ? 'active' : 'inactive',
    ];
    audit(
      s,
      admin,
      'SET_CONTRIBUTION_RULE',
      'contribution_rules',
      rule.id,
      `${previousActive === rule.is_active ? 'Updated' : rule.is_active ? 'Activated' : 'Deactivated'} contribution rule (${summaryParts.join(', ')})`,
      {
        amount_ghs: rule.amount_ghs,
        frequency: rule.frequency,
        every_weeks: rule.every_weeks ?? 1,
        duration_periods: rule.duration_periods ?? null,
        is_active: rule.is_active,
        periods_created: created,
      }
    );
  });
  return { periodsCreated: created };
}

function periodDays(rule: ContributionRule): number {
  if (rule.frequency === 'weekly') return 7 * (rule.every_weeks ?? 1);
  return 0;
}

function periodLabelFor(
  dateISO: string,
  frequency: ContributionRule['frequency'],
  index = 0,
  rule?: ContributionRule
): string {
  if (frequency === 'weekly') {
    const days = rule ? Math.max(7, periodDays(rule)) : 7;
    const d = new Date(`${dateISO}T00:00:00`);
    const end = new Date(d);
    end.setDate(end.getDate() + days - 1);
    const range = `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    return days === 7 ? `Week ${index + 1} · ${range}` : `Period ${index + 1} · ${range}`;
  }
  if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'annual') {
    return monthLabel(dateISO);
  }
  return monthLabel(dateISO);
}

function stepPeriod(
  dateISO: string,
  frequency: ContributionRule['frequency'],
  index: number,
  rule?: ContributionRule
): string {
  switch (frequency) {
    case 'weekly':
      return addDays(dateISO, 7 * (rule?.every_weeks ?? 1) * index);
    case 'quarterly':
      return addMonths(dateISO, 3 * index);
    case 'annual':
      return addMonths(dateISO, 12 * index);
    case 'one_time':
      return dateISO;
    case 'monthly':
    default:
      return addMonths(dateISO, index);
  }
}

function periodKeyFor(dateISO: string, frequency: ContributionRule['frequency']): string {
  if (frequency === 'weekly') return `W${dateISO}`;
  if (frequency === 'quarterly') {
    const month = Number(dateISO.slice(5, 7));
    return `${dateISO.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
  }
  if (frequency === 'annual') return dateISO.slice(0, 4);
  if (frequency === 'one_time') return `ONCE-${dateISO}`;
  return monthKey(dateISO);
}

/**
 * Creates periods from the rule start date up to the current period
 * (never into the future) and one obligation per approved member per period.
 * Idempotent: unique (member, period) keys prevent double-generation.
 */
export function generateObligations(s: LocalDbState, rule: ContributionRule): number {
  if (!rule.is_active || rule.amount_ghs === null || !rule.start_date) return 0;

  const today = todayISO();
  const start = rule.start_date;
  const existingKeys = new Set(s.contribution_periods.map((p) => p.period_key));
  const approvedMembers = s.users.filter((u) => u.membership_status === 'approved');

  let created = 0;
  const totalPeriods = rule.duration_periods ?? (rule.frequency === 'weekly' ? 260 : 60);
  for (let i = 0; i < totalPeriods; i += 1) {
    const periodStart = stepPeriod(start, rule.frequency, i, rule);
    if (periodStart > today) break; // no obligations for future unpaid periods
    const key = periodKeyFor(periodStart, rule.frequency);
    if (existingKeys.has(key)) {
      if (rule.frequency === 'one_time') break;
      continue;
    }
    const y = Number(periodStart.slice(0, 4));
    const m = Number(periodStart.slice(5, 7));
    const lastDay = new Date(y, m, 0).getDate();
    const dueDate =
      rule.frequency === 'weekly'
        ? addDays(periodStart, Math.max(7, periodDays(rule)) - 1) // pay within the week: last day
        : rule.frequency === 'one_time'
          ? periodStart
          : `${periodStart.slice(0, 7)}-${`${Math.min(rule.due_day, lastDay)}`.padStart(2, '0')}`;
    const period = {
      id: newId('per'),
      rule_id: rule.id,
      period_key: key,
      period_label: periodLabelFor(periodStart, rule.frequency, i, rule),
      start_date: periodStart,
      due_date: dueDate,
      grace_period_days: rule.grace_period_days,
      amount_due_ghs: roundMoney(rule.amount_ghs),
      created_at: new Date().toISOString(),
    };
    s.contribution_periods.push(period);
    existingKeys.add(key);
    created += 1;

    approvedMembers.forEach((member) => {
      const exists = s.obligations.some((o) => o.member_id === member.id && o.period_id === period.id);
      if (exists) return;
      s.obligations.push({
        id: newId('obl'),
        member_id: member.id,
        period_id: period.id,
        period_key: period.period_key,
        period_label: period.period_label,
        due_date: period.due_date,
        grace_period_days: period.grace_period_days,
        amount_due_ghs: period.amount_due_ghs,
        amount_paid_ghs: 0,
        status: 'unpaid',
        is_overdue: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    if (rule.frequency === 'one_time') break;
  }
  return created;
}

function generateObligationsForMember(s: LocalDbState, member: LocalUser, rule: ContributionRule): void {
  s.contribution_periods.forEach((period) => {
    const exists = s.obligations.some((o) => o.member_id === member.id && o.period_id === period.id);
    if (exists) return;
    s.obligations.push({
      id: newId('obl'),
      member_id: member.id,
      period_id: period.id,
      period_key: period.period_key,
      period_label: period.period_label,
      due_date: period.due_date,
      grace_period_days: period.grace_period_days,
      amount_due_ghs: period.amount_due_ghs,
      amount_paid_ghs: 0,
      status: 'unpaid',
      is_overdue: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Weekly sync: new week starts, missed week becomes outstanding      */
/* ------------------------------------------------------------------ */

function scheduleNeedsSync(state: LocalDbState): boolean {
  const rule = state.contribution_rules.find((r) => r.is_active && r.amount_ghs !== null && r.start_date);
  if (!rule) return false;
  const today = todayISO();
  const total = rule.duration_periods ?? (rule.frequency === 'weekly' ? 260 : 60);
  for (let i = 0; i < total; i += 1) {
    const start = stepPeriod(rule.start_date as string, rule.frequency, i, rule);
    if (start > today) break;
    const key = periodKeyFor(start, rule.frequency);
    const period = state.contribution_periods.find((x) => x.period_key === key);
    if (!period) return true;
    const missingMember = state.users.some(
      (u) =>
        u.membership_status === 'approved' &&
        !state.obligations.some((o) => o.member_id === u.id && o.period_id === period.id)
    );
    if (missingMember) return true;
  }
  // Missed (ended) weeks need one notification each.
  const missingNote = state.obligations.some((o) => {
    if (!isOverdue(o) || o.amount_paid_ghs >= o.amount_due_ghs) return false;
    const user = state.users.find((u) => u.id === o.member_id);
    if (!user || user.membership_status !== 'approved') return false;
    return !state.notifications.some((n) => n.id === `ntf_out_${o.id}`);
  });
  return missingNote;
}

function syncScheduleAndNotifications(state: LocalDbState): void {
  const rule = state.contribution_rules.find((r) => r.is_active && r.amount_ghs !== null && r.start_date);
  if (!rule) return;
  generateObligations(state, rule);
  // Backfill: a member approved AFTER the schedule started — or approved on
  // another device — must still receive an obligation for every week, so
  // their outstanding shows exactly like everyone else's. Deduplicated by
  // (member, period) inside generateObligationsForMember.
  state.users
    .filter((u) => u.membership_status === 'approved')
    .forEach((user) => generateObligationsForMember(state, user, rule));
  const today = todayISO();
  void today;
  state.users
    .filter((u) => u.membership_status === 'approved')
    .forEach((user) => {
      state.obligations
        .filter((o) => o.member_id === user.id && isOverdue(o) && o.amount_paid_ghs < o.amount_due_ghs)
        .forEach((o) => {
          const id = `ntf_out_${o.id}`;
          if (state.notifications.some((n) => n.id === id)) return;
          const unpaid = roundMoney(o.amount_due_ghs - o.amount_paid_ghs);
          state.notifications.push({
            id,
            user_id: user.id,
            title: 'Outstanding payment',
            message: `${o.period_label}: ${formatGHS(unpaid)} outstanding.`,
            type: 'outstanding_reminder',
            is_read: false,
            created_at: new Date().toISOString(),
          });
        });
    });
}

/** Runs at most when a new week/period or a missed-week notice is missing. Safe on every read. */
export function ensureWeeklySchedule(): void {
  try {
    const state = loadState();
    if (!scheduleNeedsSync(state)) return;
    writeState((s) => syncScheduleAndNotifications(s));
  } catch {
    // Reads must never fail because of a background sync.
  }
}

export interface WeekOutstandingMember {
  member_id: string;
  full_name: string;
  avatar_url: string | null;
  amount_due_ghs: number;
  amount_paid_ghs: number;
  outstanding_ghs: number;
}

export interface WeekOutstanding {
  period_id: string;
  period_label: string;
  start_date: string;
  due_date: string;
  /** True when this is a past, ended week. False when it is the week we are in now. */
  is_ended: boolean;
  members: WeekOutstandingMember[];
}

/** People who have not paid for the latest ended week (or this week, if none has ended yet). */
export function getCurrentWeekOutstanding(): WeekOutstanding | null {
  ensureWeeklySchedule();
  const state = loadState();
  requireApproved(state);
  const periods = [...state.contribution_periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (periods.length === 0) return null;
  const today = todayISO();
  const ended = periods.filter((per) => addDays(per.due_date, per.grace_period_days || 0) < today);
  const period =
    ended[ended.length - 1] ??
    periods.filter((per) => per.start_date <= today).slice(-1)[0] ??
    periods[periods.length - 1];
  const isEnded = ended.length > 0 && ended[ended.length - 1].id === period.id;
  void today;
  const members = state.users
    .filter((u) => u.membership_status === 'approved')
    .map((u) => {
      const o = state.obligations.find((x) => x.member_id === u.id && x.period_id === period.id);
      const due = o ? roundMoney(o.amount_due_ghs) : roundMoney(period.amount_due_ghs);
      const paid = o ? roundMoney(o.amount_paid_ghs) : 0;
      return {
        member_id: u.id,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        amount_due_ghs: due,
        amount_paid_ghs: paid,
        outstanding_ghs: roundMoney(Math.max(0, due - paid)),
      };
    })
    .filter((m) => m.outstanding_ghs > 0)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return {
    period_id: period.id,
    period_label: period.period_label,
    start_date: period.start_date,
    due_date: period.due_date,
    is_ended: isEnded,
    members,
  };
}

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

export interface PaymentSubmissionInput {
  amountGhs: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  notes?: string;
  evidence?: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string } | null;
  targetPeriodId?: string | null;
}

export function submitPayment(input: PaymentSubmissionInput): PaymentSubmission {
  let result: PaymentSubmission | null = null;
  writeState((s) => {
    const user = requireApproved(s);
    const amount = roundMoney(Number(input.amountGhs));
    if (!amount || amount <= 0) throw new ServiceError('Enter the amount you paid (greater than zero).');
    if (!input.paymentDate) throw new ServiceError('Choose the date you made the payment.');
    if (input.paymentDate > todayISO()) throw new ServiceError('The payment date cannot be in the future.');
    if (!input.paymentMethod?.trim()) throw new ServiceError('Choose the payment method you used.');

    let attachmentId: string | null = null;
    if (input.evidence) {
      if (input.evidence.sizeBytes > 3 * 1024 * 1024) {
        throw new ServiceError('The receipt image must be smaller than 3 MB.');
      }
      const attachmentIdNew = newId('att');
      s.attachments.push({
        id: attachmentIdNew,
        owner_id: user.id,
        scope: 'payment_evidence',
        file_name: input.evidence.fileName,
        mime_type: input.evidence.mimeType,
        file_size_bytes: input.evidence.sizeBytes,
        storage_path: `payment-evidence/${user.id}/${attachmentIdNew}`,
        data_url: input.evidence.dataUrl,
        created_at: new Date().toISOString(),
      });
      attachmentId = attachmentIdNew;
    }

    const payment: PaymentSubmission = {
      id: newId('pay'),
      member_id: user.id,
      member_name: user.full_name,
      amount_ghs: amount,
      allocated_amount_ghs: 0,
      unallocated_credit_ghs: 0,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod.trim(),
      transaction_reference: input.transactionReference?.trim() || null,
      evidence_attachment_id: attachmentId,
      has_evidence: Boolean(attachmentId),
      target_period_id: input.targetPeriodId ?? null,
      notes: input.notes?.trim() || null,
      status: 'pending', // NEVER verified on submission
      is_offline_entry: false,
      recorded_by: null,
      reviewed_by: null,
      reviewed_by_name: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    s.payments.push(payment);
    result = payment;

    notify(
      s,
      user.id,
      'Payment Submitted',
      `Your payment of GH₵${amount.toFixed(2)} was submitted and is awaiting verification by the treasurer.`,
      'payment_submitted'
    );
    // Notify admins
    s.users
      .filter((u) => isAdminRole(u.role) && u.membership_status === 'approved')
      .forEach((adminUser) => {
        notify(
          s,
          adminUser.id,
          'New Payment to Review',
          `${user.full_name} submitted GH₵${amount.toFixed(2)} for verification.`,
          'payment_submitted'
        );
      });
    audit(
      s,
      user,
      'SUBMIT_PAYMENT',
      'payment_submissions',
      payment.id,
      `Submitted payment of GH₵${amount.toFixed(2)} for verification`,
      { amount_ghs: amount, has_evidence: Boolean(attachmentId) }
    );
  });
  if (!result) throw new ServiceError('The payment could not be submitted. Please try again.');
  return result;
}

function allocatePaymentToObligations(s: LocalDbState, payment: PaymentSubmission): number {
  let remaining = roundMoney(payment.amount_ghs);
  let allocated = 0;

  const obligations = s.obligations
    .filter((o) => o.member_id === payment.member_id && o.status !== 'paid')
    .sort((a, b) => {
      if (payment.target_period_id) {
        const aTarget = a.period_id === payment.target_period_id ? 0 : 1;
        const bTarget = b.period_id === payment.target_period_id ? 0 : 1;
        if (aTarget !== bTarget) return aTarget - bTarget;
      }
      return a.due_date.localeCompare(b.due_date);
    });

  obligations.forEach((ob) => {
    if (remaining <= 0) return;
    const needed = roundMoney(ob.amount_due_ghs - ob.amount_paid_ghs);
    if (needed <= 0) return;
    const alloc = roundMoney(Math.min(remaining, needed));
    // UNIQUE(payment_id, obligation_id) prevents double allocation
    const duplicate = s.allocations.some((a) => a.payment_id === payment.id && a.obligation_id === ob.id);
    if (duplicate) return;

    s.allocations.push({
      id: newId('alc'),
      payment_id: payment.id,
      obligation_id: ob.id,
      member_id: payment.member_id,
      amount_allocated_ghs: alloc,
      created_at: new Date().toISOString(),
    });
    ob.amount_paid_ghs = roundMoney(ob.amount_paid_ghs + alloc);
    ob.status = ob.amount_paid_ghs >= ob.amount_due_ghs ? 'paid' : 'partially_paid';
    ob.updated_at = new Date().toISOString();

    remaining = roundMoney(remaining - alloc);
    allocated = roundMoney(allocated + alloc);
  });

  return allocated;
}

export function verifyPayment(paymentId: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const payment = s.payments.find((p) => p.id === paymentId);
    if (!payment) throw new ServiceError('Payment submission not found.');
    if (payment.status !== 'pending') {
      throw new ServiceError(`This payment has already been processed (${payment.status}).`);
    }
    // Duplicate posting guard, mirroring UNIQUE(source_payment_id) in the ledger
    if (s.ledger.some((l) => l.source_payment_id === payment.id)) {
      throw new ServiceError('This payment has already been posted to the financial ledger.');
    }

    const allocated = allocatePaymentToObligations(s, payment);
    payment.status = 'verified';
    payment.allocated_amount_ghs = allocated;
    payment.unallocated_credit_ghs = roundMoney(payment.amount_ghs - allocated);
    payment.reviewed_by = admin.id;
    payment.reviewed_by_name = admin.full_name;
    payment.reviewed_at = new Date().toISOString();
    payment.updated_at = new Date().toISOString();

    s.ledger.push({
      id: newId('led'),
      entry_date: payment.payment_date,
      entry_type: 'income',
      category: 'Member Contribution',
      description: payment.member_name,
      amount_ghs: payment.amount_ghs,
      signed_amount_ghs: payment.amount_ghs,
      recorded_status: 'Verified',
      source_payment_id: payment.id,
      source_expense_id: null,
      source_adjustment_id: null,
      created_by: admin.id,
      created_at: new Date().toISOString(),
    });

    notify(
      s,
      payment.member_id,
      'Payment Verified',
      `Your contribution payment of GH₵${payment.amount_ghs.toFixed(2)} has been verified and added to your record.`,
      'payment_verified'
    );
    audit(
      s,
      admin,
      'VERIFY_PAYMENT',
      'payment_submissions',
      payment.id,
      `Verified contribution of GH₵${payment.amount_ghs.toFixed(2)} for ${payment.member_name}`,
      { amount_ghs: payment.amount_ghs, allocated_ghs: allocated, unallocated_credit_ghs: payment.unallocated_credit_ghs }
    );
  });
}

export function rejectPayment(paymentId: string, reason: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const payment = s.payments.find((p) => p.id === paymentId);
    if (!payment) throw new ServiceError('Payment submission not found.');
    if (payment.status !== 'pending') throw new ServiceError('Only pending payments can be rejected.');
    if (!reason?.trim() || reason.trim().length < 4) {
      throw new ServiceError('Please give a short reason so the member understands what to fix.');
    }
    payment.status = 'rejected';
    payment.rejection_reason = reason.trim();
    payment.reviewed_by = admin.id;
    payment.reviewed_by_name = admin.full_name;
    payment.reviewed_at = new Date().toISOString();
    payment.updated_at = new Date().toISOString();

    notify(
      s,
      payment.member_id,
      'Payment Not Confirmed',
      `Your payment of GH₵${payment.amount_ghs.toFixed(2)} could not be verified. Reason: ${reason.trim()}. Please contact the treasurer.`,
      'payment_rejected'
    );
    audit(
      s,
      admin,
      'REJECT_PAYMENT',
      'payment_submissions',
      payment.id,
      `Rejected payment of GH₵${payment.amount_ghs.toFixed(2)} for ${payment.member_name}`,
      { reason: reason.trim() }
    );
  });
}

export interface OfflinePaymentInput {
  memberId: string;
  amountGhs: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  targetPeriodId?: string | null;
}

/** Admin-recorded cash/offline payment — verified immediately since the treasurer witnessed it. */
export function recordOfflinePayment(input: OfflinePaymentInput): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const member = s.users.find((u) => u.id === input.memberId);
    if (!member) throw new ServiceError('Choose the member who made the payment.');
    if (member.membership_status !== 'approved') throw new ServiceError('Only approved members can make contributions.');
    const amount = roundMoney(Number(input.amountGhs));
    if (!amount || amount <= 0) throw new ServiceError('Enter the amount received (greater than zero).');
    if (!input.paymentDate) throw new ServiceError('Choose the date the payment was received.');
    if (input.paymentDate > todayISO()) throw new ServiceError('The payment date cannot be in the future.');
    if (!input.paymentMethod?.trim()) throw new ServiceError('Choose how the payment was made.');

    const payment: PaymentSubmission = {
      id: newId('pay'),
      member_id: member.id,
      member_name: member.full_name,
      amount_ghs: amount,
      allocated_amount_ghs: 0,
      unallocated_credit_ghs: 0,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod.trim(),
      transaction_reference: null,
      evidence_attachment_id: null,
      has_evidence: false,
      target_period_id: input.targetPeriodId ?? null,
      notes: input.notes?.trim() || null,
      status: 'pending',
      is_offline_entry: true,
      recorded_by: admin.id,
      reviewed_by: null,
      reviewed_by_name: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    s.payments.push(payment);

    const allocated = allocatePaymentToObligations(s, payment);
    payment.status = 'verified';
    payment.allocated_amount_ghs = allocated;
    payment.unallocated_credit_ghs = roundMoney(amount - allocated);
    payment.reviewed_by = admin.id;
    payment.reviewed_by_name = admin.full_name;
    payment.reviewed_at = new Date().toISOString();

    s.ledger.push({
      id: newId('led'),
      entry_date: payment.payment_date,
      entry_type: 'income',
      category: 'Member Contribution',
      description: member.full_name,
      amount_ghs: amount,
      signed_amount_ghs: amount,
      recorded_status: 'Verified',
      source_payment_id: payment.id,
      source_expense_id: null,
      source_adjustment_id: null,
      created_by: admin.id,
      created_at: new Date().toISOString(),
    });

    notify(
      s,
      member.id,
      'Payment Verified',
      `A cash/offline payment of GH₵${amount.toFixed(2)} was recorded for you by the treasurer.`,
      'payment_verified'
    );
    audit(
      s,
      admin,
      'RECORD_OFFLINE_PAYMENT',
      'payment_submissions',
      payment.id,
      `Recorded offline payment of GH₵${amount.toFixed(2)} for ${member.full_name}`,
      { amount_ghs: amount, payment_method: input.paymentMethod }
    );
  });
}

/** Private evidence: owner or authorized admin only. Mirrors the file_attachments RLS policy. */
export function getPaymentEvidence(paymentId: string): { dataUrl: string; fileName: string } | null {
  const state = loadState();
  const user = currentUser(state);
  const payment = state.payments.find((p) => p.id === paymentId);
  if (!payment) throw new ServiceError('Payment not found.');
  const isOwner = payment.member_id === user.id;
  const isAdmin = user.membership_status === 'approved' && isAdminRole(user.role);
  if (!isOwner && !isAdmin) {
    throw new ServiceError('Access denied: payment evidence is private to the member and the treasurer.', 'forbidden');
  }
  if (!payment.evidence_attachment_id) return null;
  const attachment = state.attachments.find((a) => a.id === payment.evidence_attachment_id);
  if (!attachment?.data_url) return null;
  return { dataUrl: attachment.data_url, fileName: attachment.file_name };
}

/** Admin-only: full payment detail including the private transaction reference. */
export function getAdminPaymentDetail(paymentId: string): PaymentSubmission {
  const state = loadState();
  requireAdmin(state);
  const payment = state.payments.find((p) => p.id === paymentId);
  if (!payment) throw new ServiceError('Payment not found.');
  return payment;
}

/* ------------------------------------------------------------------ */
/* Expenses                                                           */
/* ------------------------------------------------------------------ */

export interface ExpenseInput {
  title: string;
  amountGhs: number;
  reason: string;
  expenseDate: string;
  category?: string;
  vendorPaid?: string;
  notes?: string;
  evidence?: { fileName: string; mimeType: string; sizeBytes: number; dataUrl: string } | null;
  overrideBalanceLimit?: boolean;
  overrideReason?: string;
}

export interface BalanceCheck {
  currentBalance: number;
  wouldRemain: number;
  exceedsBalance: boolean;
}

export function checkExpenseBalance(amountGhs: number): BalanceCheck {
  const state = loadState();
  requireApproved(state);
  const summary = computeGroupSummary(state);
  const amount = roundMoney(Number(amountGhs) || 0);
  return {
    currentBalance: summary.current_recorded_balance_ghs,
    wouldRemain: roundMoney(summary.current_recorded_balance_ghs - amount),
    exceedsBalance: amount > summary.current_recorded_balance_ghs,
  };
}

export function postExpense(input: ExpenseInput): ExpenseRecord {
  let created: ExpenseRecord | null = null;
  writeState((s) => {
    const admin = requireAdmin(s);
    const amount = roundMoney(Number(input.amountGhs));
    if (!input.title?.trim() || input.title.trim().length < 2) {
      throw new ServiceError('Enter a short expense title (at least 2 characters).');
    }
    if (!amount || amount <= 0) throw new ServiceError('Enter an expense amount greater than zero.');
    if (!input.reason?.trim() || input.reason.trim().length < 3) {
      throw new ServiceError('Please explain the reason for this expense.');
    }
    if (!input.expenseDate) throw new ServiceError('Choose the date this expense was paid.');
    if (input.expenseDate > todayISO()) throw new ServiceError('The expense date cannot be in the future.');

    const balance = roundMoney(s.ledger.reduce((sum, e) => sum + e.signed_amount_ghs, 0));
    const exceeds = amount > balance;
    if (exceeds && !input.overrideBalanceLimit) {
      throw new ServiceError(
        `This expense (GH₵${amount.toFixed(2)}) is more than the recorded balance (GH₵${balance.toFixed(2)}). An authorised exception and explanation are required.`
      );
    }
    if (exceeds && (!input.overrideReason || input.overrideReason.trim().length < 5)) {
      throw new ServiceError('Write a short explanation for spending above the recorded balance.');
    }

    let evidenceId: string | null = null;
    if (input.evidence) {
      if (input.evidence.sizeBytes > 3 * 1024 * 1024) {
        throw new ServiceError('The receipt image must be smaller than 3 MB.');
      }
      evidenceId = newId('att');
      s.attachments.push({
        id: evidenceId,
        owner_id: admin.id,
        scope: 'expense_evidence',
        file_name: input.evidence.fileName,
        mime_type: input.evidence.mimeType,
        file_size_bytes: input.evidence.sizeBytes,
        storage_path: `expense-evidence/${admin.id}/${evidenceId}`,
        data_url: input.evidence.dataUrl,
        created_at: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    const expense: ExpenseRecord = {
      id: newId('exp'),
      title: input.title.trim(),
      amount_ghs: amount,
      effective_amount_ghs: amount,
      reason: input.reason.trim(),
      expense_date: input.expenseDate,
      category: input.category?.trim() || 'General',
      vendor_paid: input.vendorPaid?.trim() || null,
      evidence_attachment_id: evidenceId,
      has_evidence: Boolean(evidenceId),
      notes: input.notes?.trim() || null,
      status: 'posted',
      exceeded_balance_override: exceeds,
      override_reason: exceeds ? input.overrideReason?.trim() || null : null,
      created_by: admin.id,
      created_by_name: admin.full_name,
      created_at: now,
      updated_at: now,
      adjustments: [],
    };
    s.expenses.push(expense);

    // Exactly ONE ledger row per expense (UNIQUE source_expense_id)
    s.ledger.push({
      id: newId('led'),
      entry_date: expense.expense_date,
      entry_type: 'expense',
      category: expense.category,
      description: expense.title,
      amount_ghs: amount,
      signed_amount_ghs: -amount,
      recorded_status: 'Posted',
      source_payment_id: null,
      source_expense_id: expense.id,
      source_adjustment_id: null,
      created_by: admin.id,
      created_at: now,
    });

    s.users
      .filter((u) => isAdminRole(u.role) && u.membership_status === 'approved')
      .forEach((a) =>
        notify(
          s,
          a.id,
          'Expense Recorded',
          `${expense.title} — GH₵${amount.toFixed(2)} was posted to the group fund.`,
          'expense_recorded'
        )
      );
    audit(
      s,
      admin,
      'POST_EXPENSE',
      'expenses',
      expense.id,
      `Posted group expense "${expense.title}" of GH₵${amount.toFixed(2)}`,
      { amount_ghs: amount, override: exceeds, override_reason: expense.override_reason }
    );
    created = expense;
  });
  if (!created) throw new ServiceError('The expense could not be saved. Please try again.');
  return created;
}

export function reverseExpense(expenseId: string, reason: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const expense = s.expenses.find((e) => e.id === expenseId);
    if (!expense) throw new ServiceError('Expense not found.');
    if (expense.status === 'reversed') throw new ServiceError('This expense has already been reversed.');
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new ServiceError('Please explain why this expense is being reversed (at least 5 characters).');
    }
    const previous = expense.effective_amount_ghs;
    const adjustmentId = newId('adj');
    expense.adjustments.push({
      id: adjustmentId,
      expense_id: expense.id,
      adjustment_type: 'reversal',
      previous_amount_ghs: previous,
      new_amount_ghs: 0,
      delta_ghs: -previous,
      reason: reason.trim(),
      adjusted_by: admin.id,
      adjusted_by_name: admin.full_name,
      created_at: new Date().toISOString(),
    });
    expense.effective_amount_ghs = 0;
    expense.status = 'reversed';
    expense.updated_at = new Date().toISOString();

    // Ledger: original expense row stays untouched (immutable) + compensating reversal row
    s.ledger.push({
      id: newId('led'),
      entry_date: todayISO(),
      entry_type: 'expense_reversal',
      category: expense.category,
      description: expense.title,
      amount_ghs: previous,
      signed_amount_ghs: previous,
      recorded_status: 'Reversed',
      source_payment_id: null,
      source_expense_id: expense.id,
      source_adjustment_id: adjustmentId,
      created_by: admin.id,
      created_at: new Date().toISOString(),
    });
    audit(
      s,
      admin,
      'REVERSE_EXPENSE',
      'expenses',
      expense.id,
      `Reversed expense "${expense.title}" of GH₵${previous.toFixed(2)}`,
      { reason: reason.trim(), previous_amount_ghs: previous }
    );
  });
}

export function adjustExpense(expenseId: string, newAmountGhs: number, reason: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const expense = s.expenses.find((e) => e.id === expenseId);
    if (!expense) throw new ServiceError('Expense not found.');
    if (expense.status === 'reversed') throw new ServiceError('A reversed expense cannot be adjusted.');
    const nextAmount = roundMoney(Number(newAmountGhs));
    if (!Number.isFinite(nextAmount) || nextAmount < 0) throw new ServiceError('Enter a valid corrected amount.');
    if (nextAmount === 0) throw new ServiceError('To remove an expense completely, use the reversal process.');
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new ServiceError('Please explain this correction (at least 5 characters).');
    }
    const previous = expense.effective_amount_ghs;
    const delta = roundMoney(nextAmount - previous);
    if (delta === 0) throw new ServiceError('The corrected amount is the same as the current amount.');

    const adjustmentId = newId('adj');
    expense.adjustments.push({
      id: adjustmentId,
      expense_id: expense.id,
      adjustment_type: 'amount_adjustment',
      previous_amount_ghs: previous,
      new_amount_ghs: nextAmount,
      delta_ghs: delta,
      reason: reason.trim(),
      adjusted_by: admin.id,
      adjusted_by_name: admin.full_name,
      created_at: new Date().toISOString(),
    });
    expense.effective_amount_ghs = nextAmount;
    expense.status = 'adjusted';
    expense.updated_at = new Date().toISOString();

    if (delta > 0) {
      // Expense increased: post an additional outflow
      s.ledger.push({
        id: newId('led'),
        entry_date: todayISO(),
        entry_type: 'expense_adjustment',
        category: expense.category,
        description: expense.title,
        amount_ghs: delta,
        signed_amount_ghs: -delta,
        recorded_status: 'Adjusted',
        source_payment_id: null,
        source_expense_id: expense.id,
        source_adjustment_id: adjustmentId,
        created_by: admin.id,
        created_at: new Date().toISOString(),
      });
    } else {
      // Expense decreased: return the difference to the fund
      s.ledger.push({
        id: newId('led'),
        entry_date: todayISO(),
        entry_type: 'expense_adjustment',
        category: expense.category,
        description: expense.title,
        amount_ghs: Math.abs(delta),
        signed_amount_ghs: Math.abs(delta),
        recorded_status: 'Adjusted',
        source_payment_id: null,
        source_expense_id: expense.id,
        source_adjustment_id: adjustmentId,
        created_by: admin.id,
        created_at: new Date().toISOString(),
      });
    }
    audit(
      s,
      admin,
      'ADJUST_EXPENSE',
      'expenses',
      expense.id,
      `Adjusted expense "${expense.title}" from GH₵${previous.toFixed(2)} to GH₵${nextAmount.toFixed(2)}`,
      { reason: reason.trim(), previous_amount_ghs: previous, new_amount_ghs: nextAmount }
    );
  });
}

/** Expense receipt evidence: all approved members may view posted expense evidence per group policy. */
export function getExpenseEvidence(expenseId: string): { dataUrl: string; fileName: string } | null {
  const state = loadState();
  requireApproved(state);
  const expense = state.expenses.find((e) => e.id === expenseId);
  if (!expense?.evidence_attachment_id) return null;
  const attachment = state.attachments.find((a) => a.id === expense.evidence_attachment_id);
  if (!attachment?.data_url) return null;
  return { dataUrl: attachment.data_url, fileName: attachment.file_name };
}

/* ------------------------------------------------------------------ */
/* Reports, audit log & reminders                                     */
/* ------------------------------------------------------------------ */

export function getAuditLogs(limit = 100): AuditLogEntry[] {
  const state = loadState();
  requireAdmin(state);
  return [...state.audit_logs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export interface OutstandingRow {
  member_id: string;
  full_name: string;
  phone: string | null;
  outstanding: number;
  total_due: number;
  total_paid: number;
  status_label: string;
  overdue_periods: number;
  relevant_period_label: string;
  periods: Array<{ period_label: string; amount_due: number; amount_paid: number; outstanding: number }>;
}

export function getOutstandingMembers(periodFilter?: string): OutstandingRow[] {
  ensureWeeklySchedule();
  const state = loadState();
  requireAdmin(state);
  return state.users
    .filter((u) => u.membership_status === 'approved')
    .map((u) => {
      const computation = computeMember(state, u.id);
      const obligations = state.obligations
        .filter((o) => o.member_id === u.id)
        .filter((o) => (periodFilter && periodFilter !== 'all' ? o.period_key === periodFilter : true))
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      const outstanding = roundMoney(obligations.reduce((sum, o) => sum + (o.amount_due_ghs - o.amount_paid_ghs), 0));
      return {
        member_id: u.id,
        full_name: u.full_name,
        phone: u.phone,
        outstanding,
        total_due: roundMoney(obligations.reduce((sum, o) => sum + o.amount_due_ghs, 0)),
        total_paid: roundMoney(obligations.reduce((sum, o) => sum + o.amount_paid_ghs, 0)),
        status_label: computation?.status_label ?? 'Not Yet Paid',
        overdue_periods: obligations.filter((o) => isOverdue(o)).length,
        relevant_period_label:
          obligations.filter((o) => o.status !== 'paid')[0]?.period_label ??
          obligations[obligations.length - 1]?.period_label ??
          'All periods',
        periods: obligations.map((o) => ({
          period_label: o.period_label,
          amount_due: o.amount_due_ghs,
          amount_paid: o.amount_paid_ghs,
          outstanding: roundMoney(o.amount_due_ghs - o.amount_paid_ghs),
        })),
      };
    })
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function getPeriodOptions(): Array<{ key: string; label: string }> {
  ensureWeeklySchedule();
  const state = loadState();
  requireApproved(state);
  return [...state.contribution_periods]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((p) => ({ key: p.period_key, label: p.period_label }));
}

export function buildReminder(phone: string | null, memberName: string, outstanding: number, periodLabel: string) {
  const message = buildWhatsAppReminderMessage({
    memberName,
    outstandingAmountGhs: outstanding,
    periodLabel,
  });
  return { message, whatsappUrl: buildWhatsAppUrl(phone, message) };
}

/** In-app reminder: records the reminder in the member's notification inbox. */
export function sendInAppReminder(memberId: string, outstanding: number, periodLabel: string): void {
  writeState((s) => {
    const admin = requireAdmin(s);
    const member = s.users.find((u) => u.id === memberId);
    if (!member) throw new ServiceError('Member not found.');
    notify(
      s,
      member.id,
      'Contribution Reminder',
      `A friendly reminder: your outstanding contribution balance is GH₵${outstanding.toFixed(2)} for ${periodLabel}. If you have already paid, please contact the treasurer.`,
      'outstanding_reminder'
    );
    audit(
      s,
      admin,
      'SEND_REMINDER',
      'profiles',
      member.id,
      `Sent an in-app contribution reminder to ${member.full_name}`,
      { outstanding_ghs: outstanding, period: periodLabel }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Data management (demo / reset)                                     */
/* ------------------------------------------------------------------ */

export function reseedDemoData(): void {
  resetToSeed();
}

export function startBlankGroup(): void {
  resetToBlank();
}

export function getDemoAccounts() {
  return DEMO_ACCOUNTS;
}

/* ------------------------------------------------------------------ */
/* CSV exports                                                        */
/* ------------------------------------------------------------------ */

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
  return lines.join('\n');
}

export function buildMemberReportCsv(): string {
  const rows = getPublicMembers();
  return toCsv(
    ['Member', 'Status', 'Total Due (GHS)', 'Verified Paid (GHS)', 'Outstanding (GHS)', 'Periods Paid', 'Overdue Periods', 'Relevant Period'],
    rows.map((r) => [
      r.full_name,
      r.payment_status,
      r.total_due_ghs.toFixed(2),
      r.total_verified_paid_ghs.toFixed(2),
      r.outstanding_amount_ghs.toFixed(2),
      r.periods_fully_paid,
      r.overdue_periods_count,
      r.relevant_period_label,
    ])
  );
}

export function buildOutstandingReportCsv(): string {
  const rows = getOutstandingMembers('all');
  return toCsv(
    ['Member', 'Total Due (GHS)', 'Verified Paid (GHS)', 'Outstanding (GHS)', 'Overdue Periods', 'Status'],
    rows.map((r) => [
      r.full_name,
      r.total_due.toFixed(2),
      r.total_paid.toFixed(2),
      r.outstanding.toFixed(2),
      r.overdue_periods,
      r.status_label,
    ])
  );
}

export function buildPaymentHistoryCsv(): string {
  const payments = getAllPayments();
  return toCsv(
    ['Date', 'Member', 'Amount (GHS)', 'Allocated (GHS)', 'Method', 'Status', 'Reference'],
    payments.map((p) => [
      p.payment_date,
      p.member_name,
      p.amount_ghs.toFixed(2),
      p.allocated_amount_ghs.toFixed(2),
      p.payment_method,
      p.status,
      p.transaction_reference ?? '',
    ])
  );
}

export function buildExpenseReportCsv(from?: string, to?: string): string {
  let expenses = getExpenses();
  if (from) expenses = expenses.filter((e) => e.expense_date >= from);
  if (to) expenses = expenses.filter((e) => e.expense_date <= to);
  return toCsv(
    ['Date', 'Title', 'Category', 'Amount (GHS)', 'Effective Amount (GHS)', 'Status', 'Vendor', 'Reason', 'Recorded By', 'Recorded At'],
    expenses.map((e) => [
      e.expense_date,
      e.title,
      e.category,
      e.amount_ghs.toFixed(2),
      e.effective_amount_ghs.toFixed(2),
      e.status,
      e.vendor_paid ?? '',
      e.reason,
      e.created_by_name,
      e.created_at,
    ])
  );
}

export function buildLedgerCsv(from?: string, to?: string): string {
  const entries = getLedgerEntries({ from, to });
  return toCsv(
    ['Date', 'Type', 'Category', 'Description', 'Amount (GHS)', 'Signed Amount (GHS)', 'Status'],
    entries.map((e) => [
      e.entry_date,
      e.entry_type,
      e.category,
      e.description,
      e.amount_ghs.toFixed(2),
      e.signed_amount_ghs.toFixed(2),
      e.recorded_status,
    ])
  );
}

export function buildFinancialSummaryCsv(): string {
  const summary = getGroupSummary();
  return toCsv(
    ['Measure', 'Value (GHS)'],
    [
      ['Total verified contributions', summary.total_verified_contributions_ghs.toFixed(2)],
      ['Other recorded income', summary.other_recorded_income_ghs.toFixed(2)],
      ['Total recorded income', summary.total_recorded_income_ghs.toFixed(2)],
      ['Total posted expenses', summary.total_posted_expenses_ghs.toFixed(2)],
      ['Other recorded outflows', summary.other_recorded_outflows_ghs.toFixed(2)],
      ['Current recorded balance', summary.current_recorded_balance_ghs.toFixed(2)],
      ['Approved members', summary.approved_members_count],
      ['Members with outstanding balances', summary.members_yet_to_pay_count],
      ['Pending payment submissions', summary.pending_payment_submissions_count],
    ]
  );
}

export function buildAuditLogCsv(): string {
  const logs = getAuditLogs(500);
  return toCsv(
    ['Timestamp', 'Actor', 'Action', 'Entity', 'Entity ID', 'Summary'],
    logs.map((l) => [l.created_at, l.actor_name, l.action_type, l.entity_type, l.entity_id ?? '', l.summary])
  );
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Test hooks                                                         */
/* ------------------------------------------------------------------ */

export function __setSessionForTests(userId: string | null): void {
  writeState((s) => {
    s.session_user_id = userId;
  });
}

export function __getStateForTests(): LocalDbState {
  return loadState();
}
