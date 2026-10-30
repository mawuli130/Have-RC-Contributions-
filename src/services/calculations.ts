import type {
  ContributionObligation,
  ContributionRule,
  GroupFinancialSummary,
  PublicMemberPaymentSummary,
  PublicPaymentStatusLabel,
  RecentActivityItem,
} from '../types/database';
import { roundMoney, formatDateShort, formatGHS } from '../utils/formatters';
import type { LocalDbState, LocalUser } from './localStore';
import { isOverdue, todayISO } from './localStore';

export interface MemberComputation {
  member: LocalUser;
  total_due: number;
  total_verified_paid: number;
  outstanding: number;
  unallocated_credit: number;
  periods_fully_paid: number;
  periods_partially_paid: number;
  periods_not_yet_paid: number;
  overdue_periods: number;
  pending_count: number;
  pending_amount: number;
  latest_verified_date: string | null;
  latest_verified_amount: number | null;
  status_label: PublicPaymentStatusLabel;
  relevant_period_label: string;
  has_schedule: boolean;
  /** Money missed from weeks/periods that have already ended. */
  overdue_outstanding_ghs: number;
  current_period_label: string;
  current_period_due_ghs: number;
  current_period_paid_ghs: number;
  current_period_outstanding_ghs: number;
  latest_ended_period_label: string;
  latest_ended_outstanding_ghs: number;
}

function computeStatusLabel(args: {
  hasSchedule: boolean;
  outstanding: number;
  pendingCount: number;
  overdueCount: number;
  paid: number;
}): PublicPaymentStatusLabel {
  if (!args.hasSchedule) return 'Schedule Not Set';
  if (args.outstanding <= 0) return 'Paid';
  if (args.pendingCount > 0) return 'Pending Verification';
  if (args.overdueCount > 0) return 'Overdue';
  if (args.paid > 0) return 'Partially Paid';
  return 'Not Yet Paid';
}

/**
 * Single source of truth for every member figure shown in the app.
 * Derived from obligations (verified allocations) — NEVER from pending submissions.
 */
export function computeMember(state: LocalDbState, memberId: string): MemberComputation | null {
  const member = state.users.find((u) => u.id === memberId);
  if (!member) return null;

  const obligations = state.obligations
    .filter((o) => o.member_id === memberId)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalDue = roundMoney(obligations.reduce((sum, o) => sum + o.amount_due_ghs, 0));
  const totalPaid = roundMoney(obligations.reduce((sum, o) => sum + o.amount_paid_ghs, 0));
  const outstanding = roundMoney(Math.max(0, totalDue - totalPaid));

  let fullyPaid = 0;
  let partiallyPaid = 0;
  let notPaid = 0;
  let overdueCount = 0;
  obligations.forEach((o) => {
    if (o.status === 'paid') fullyPaid += 1;
    else if (o.status === 'partially_paid') partiallyPaid += 1;
    else notPaid += 1;
    if (isOverdue(o)) overdueCount += 1;
  });

  const memberPayments = state.payments.filter((p) => p.member_id === memberId);
  const pending = memberPayments.filter((p) => p.status === 'pending');
  const verified = memberPayments
    .filter((p) => p.status === 'verified')
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));

  const unallocated = roundMoney(
    memberPayments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.unallocated_credit_ghs, 0)
  );

  const hasSchedule = obligations.length > 0;
  const activeRule = state.contribution_rules.find((r) => r.is_active && r.amount_ghs !== null);

  const today = todayISO();
  const periodStart = new Map(state.contribution_periods.map((p) => [p.id, p.start_date]));
  const startOf = (o: ContributionObligation) => periodStart.get(o.period_id) ?? o.due_date;
  const currentObligation =
    obligations.find((o) => startOf(o) <= today && o.due_date >= today) ??
    [...obligations].reverse().find((o) => startOf(o) <= today) ??
    obligations[obligations.length - 1];
  const ended = obligations.filter((o) => isOverdue(o));
  const latestEnded = ended[ended.length - 1];
  const overdueOutstanding = roundMoney(
    ended.reduce((sum, o) => sum + Math.max(0, o.amount_due_ghs - o.amount_paid_ghs), 0)
  );

  // "Relevant period": oldest unpaid period, else latest period
  const oldestUnpaid = obligations.find((o) => o.status !== 'paid');
  const relevantPeriod =
    oldestUnpaid?.period_label ?? obligations[obligations.length - 1]?.period_label ?? 'Not yet scheduled';

  return {
    member,
    total_due: totalDue,
    total_verified_paid: totalPaid,
    outstanding,
    unallocated_credit: unallocated,
    periods_fully_paid: fullyPaid,
    periods_partially_paid: partiallyPaid,
    periods_not_yet_paid: notPaid,
    overdue_periods: overdueCount,
    pending_count: pending.length,
    pending_amount: roundMoney(pending.reduce((s, p) => s + p.amount_ghs, 0)),
    latest_verified_date: verified[0]?.payment_date ?? null,
    latest_verified_amount: verified[0] ? roundMoney(verified[0].amount_ghs) : null,
    status_label: computeStatusLabel({
      hasSchedule: hasSchedule && Boolean(activeRule),
      outstanding,
      pendingCount: pending.length,
      overdueCount,
      paid: totalPaid,
    }),
    relevant_period_label: relevantPeriod,
    has_schedule: hasSchedule && Boolean(activeRule),
    overdue_outstanding_ghs: overdueOutstanding,
    current_period_label: currentObligation?.period_label ?? '—',
    current_period_due_ghs: currentObligation ? roundMoney(currentObligation.amount_due_ghs) : 0,
    current_period_paid_ghs: currentObligation ? roundMoney(currentObligation.amount_paid_ghs) : 0,
    current_period_outstanding_ghs: currentObligation
      ? roundMoney(Math.max(0, currentObligation.amount_due_ghs - currentObligation.amount_paid_ghs))
      : 0,
    latest_ended_period_label: latestEnded?.period_label ?? currentObligation?.period_label ?? '—',
    latest_ended_outstanding_ghs: latestEnded
      ? roundMoney(Math.max(0, latestEnded.amount_due_ghs - latestEnded.amount_paid_ghs))
      : currentObligation
        ? roundMoney(Math.max(0, currentObligation.amount_due_ghs - currentObligation.amount_paid_ghs))
        : 0,
  };
}

/** Public-safe projection: strips email, phone, references, evidence, and admin notes. */
export function toPublicSummary(computation: MemberComputation): PublicMemberPaymentSummary {
  return {
    member_id: computation.member.id,
    full_name: computation.member.full_name,
    avatar_url: computation.member.avatar_url,
    membership_status: computation.member.membership_status,
    role: computation.member.role,
    total_due_ghs: computation.total_due,
    total_verified_paid_ghs: computation.total_verified_paid,
    outstanding_amount_ghs: computation.outstanding,
    unallocated_credit_ghs: computation.unallocated_credit,
    periods_fully_paid: computation.periods_fully_paid,
    periods_partially_paid: computation.periods_partially_paid,
    periods_not_yet_paid: computation.periods_not_yet_paid,
    overdue_periods_count: computation.overdue_periods,
    pending_submissions_count: computation.pending_count,
    pending_amount_ghs: computation.pending_amount,
    latest_verified_payment_date: computation.latest_verified_date,
    latest_verified_payment_amount_ghs: computation.latest_verified_amount,
    payment_status: computation.status_label,
    relevant_period_label: computation.relevant_period_label,
    overdue_outstanding_ghs: computation.overdue_outstanding_ghs,
    current_period_label: computation.current_period_label,
    current_period_outstanding_ghs: computation.current_period_outstanding_ghs,
    latest_ended_period_label: computation.latest_ended_period_label,
    latest_ended_outstanding_ghs: computation.latest_ended_outstanding_ghs,
  };
}

export function computeGroupSummary(state: LocalDbState): GroupFinancialSummary {
  const ledger = state.ledger;
  const contributionIncome = roundMoney(
    ledger
      .filter((e) => e.entry_type === 'income' && e.source_payment_id)
      .reduce((sum, e) => sum + e.amount_ghs, 0)
  );
  const otherIncome = roundMoney(
    ledger.filter((e) => e.entry_type === 'other_income').reduce((sum, e) => sum + e.amount_ghs, 0)
  );
  // Net posted expenses = posted expenses minus audited reversals/adjustments
  const netExpenses = roundMoney(
    -ledger
      .filter((e) => ['expense', 'expense_reversal', 'expense_adjustment'].includes(e.entry_type))
      .reduce((sum, e) => sum + e.signed_amount_ghs, 0)
  );
  const otherOutflows = roundMoney(0);
  const balance = roundMoney(ledger.reduce((sum, e) => sum + e.signed_amount_ghs, 0));

  const approved = state.users.filter((u) => u.membership_status === 'approved');
  const computations = approved.map((u) => computeMember(state, u.id)).filter(Boolean) as MemberComputation[];
  const withSchedule = computations.filter((c) => c.has_schedule);
  const activeRule = state.contribution_rules.find((r) => r.is_active && r.amount_ghs !== null);

  return {
    total_verified_contributions_ghs: contributionIncome,
    other_recorded_income_ghs: otherIncome,
    total_recorded_income_ghs: roundMoney(contributionIncome + otherIncome),
    total_posted_expenses_ghs: Math.max(0, netExpenses),
    other_recorded_outflows_ghs: otherOutflows,
    current_recorded_balance_ghs: balance,
    approved_members_count: approved.length,
    pending_members_count: state.users.filter((u) => u.membership_status === 'pending').length,
    members_yet_to_pay_count: withSchedule.filter((c) => c.outstanding > 0).length,
    members_fully_paid_count: withSchedule.filter((c) => c.outstanding <= 0).length,
    members_partially_paid_count: withSchedule.filter(
      (c) => c.outstanding > 0 && c.total_verified_paid > 0
    ).length,
    members_overdue_count: withSchedule.filter((c) => c.overdue_periods > 0).length,
    pending_payment_submissions_count: state.payments.filter((p) => p.status === 'pending').length,
    is_contribution_rule_active: Boolean(activeRule),
  };
}

/**
 * Privacy-safe activity feed. Never includes transaction references,
 * receipt data, phone numbers, emails, or admin notes.
 */
export function computeRecentActivity(state: LocalDbState, limit = 12): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];

  state.ledger.forEach((entry) => {
    if (entry.entry_type === 'income') {
      const payment = state.payments.find((p) => p.id === entry.source_payment_id);
      const name = payment?.member_name ?? 'A member';
      items.push({
        id: entry.id,
        timestamp: entry.created_at,
        date_label: formatDateShort(entry.entry_date),
        type: 'contribution_verified',
        title: name,
        description: '',
        amount_ghs: entry.amount_ghs,
        is_positive: true,
      });
    } else if (entry.entry_type === 'expense') {
      const expense = state.expenses.find((e) => e.id === entry.source_expense_id);
      items.push({
        id: entry.id,
        timestamp: entry.created_at,
        date_label: formatDateShort(entry.entry_date),
        type: 'expense_recorded',
        title: expense?.title ?? 'Group expense',
        description: '',
        amount_ghs: entry.amount_ghs,
        is_positive: false,
      });
    } else if (entry.entry_type === 'expense_reversal' || entry.entry_type === 'expense_adjustment') {
      const expense = state.expenses.find((e) => e.id === entry.source_expense_id);
      items.push({
        id: entry.id,
        timestamp: entry.created_at,
        date_label: formatDateShort(entry.entry_date),
        type: 'expense_adjusted',
        title: expense?.title ?? 'Expense',
        description: entry.entry_type === 'expense_reversal' ? 'Reversed' : 'Adjusted',
        amount_ghs: Math.abs(entry.signed_amount_ghs),
        is_positive: entry.signed_amount_ghs > 0,
      });
    }
  });

  state.payments
    .filter((p) => p.status === 'rejected')
    .forEach((p) => {
      items.push({
        id: `rej_${p.id}`,
        timestamp: p.updated_at,
        date_label: formatDateShort(p.updated_at.slice(0, 10)),
        type: 'payment_rejected',
        title: p.member_name,
        description: 'Not confirmed',
        amount_ghs: null,
        is_positive: null,
      });
    });

  state.contribution_rules.forEach((rule) => {
    items.push({
      id: `rule_${rule.id}`,
      timestamp: rule.updated_at,
      date_label: formatDateShort(rule.updated_at.slice(0, 10)),
      type: 'rule_updated',
      title: 'Contribution',
      description: rule.is_active ? `${formatGHS(Number(rule.amount_ghs ?? 0))} · ${rule.frequency.replace('_', ' ')}` : 'Paused',
      amount_ghs: null,
      is_positive: null,
    });
  });

  state.users
    .filter((u) => u.membership_status === 'approved' && u.approved_at)
    .forEach((u) => {
      items.push({
        id: `apr_${u.id}`,
        timestamp: u.approved_at as string,
        date_label: formatDateShort((u.approved_at as string).slice(0, 10)),
        type: 'member_approved',
        title: u.full_name,
        description: 'Joined',
        amount_ghs: null,
        is_positive: null,
      });
    });

  return items
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export function activeRule(state: LocalDbState): ContributionRule | undefined {
  return state.contribution_rules.find((r) => r.is_active) ?? state.contribution_rules[0];
}

export function hasOutstanding(computation: MemberComputation): boolean {
  return computation.outstanding > 0 && computation.has_schedule;
}

export function overdueNow(dueDate: string, graceDays: number): boolean {
  const graceEnd = new Date(`${dueDate}T00:00:00`);
  graceEnd.setDate(graceEnd.getDate() + (graceDays || 0));
  const today = new Date(`${todayISO()}T00:00:00`);
  return today > graceEnd;
}
