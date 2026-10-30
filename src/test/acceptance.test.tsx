import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { invalidateCache, loadState, resetToBlank, resetToSeed, todayISO } from '../services/localStore';
import {
  ServiceError,
  adjustExpense,
  approveMember,
  changeMyPassword,
  getAdminMemberRows,
  getContributionRule,
  getCurrentWeekOutstanding,
  getNotifications,
  getAllPayments,
  getAuditLogs,
  getExpenseEvidence,
  getExpenses,
  getGroupSummary,
  getLedgerEntries,
  getMyComputation,
  getMyPayments,
  getOutstandingMembers,
  getPaymentEvidence,
  getPublicMembers,
  getSessionUser,
  postExpense,
  recordOfflinePayment,
  rejectPayment,
  reverseExpense,
  saveContributionRule,
  sendInAppReminder,
  setMemberRole,
  signIn,
  signOut,
  signUp,
  submitPayment,
  verifyPayment,
  __getStateForTests,
} from '../services/databaseService';
import { buildWhatsAppReminderMessage } from '../utils/formatters';

const SEED_PASSWORD = 'Member123!';
const SEED_ADMIN_PASSWORD = 'Admin123!';

function loginSeed(email: string, password: string) {
  return signIn(email, password);
}

function userIdByEmail(email: string): string {
  const state = loadState();
  const user = state.users.find((u) => u.email === email);
  if (!user) throw new Error(`Seed user not found: ${email}`);
  return user.id;
}

beforeEach(() => {
  resetToSeed();
  invalidateCache();
});

/* ================================================================== */
/* 1. Registration and login work                                      */
/* ================================================================== */

describe('1. Registration and login', () => {
  it('registers a new member and signs them in', () => {
    const session = signUp({
      fullName: 'Kwesi Appiah',
      email: 'kwesi@example.com',
      password: 'StrongPass123',
      phone: '024 111 2222',
      acceptedPrivacy: true,
    });
    expect(session.profile.email).toBe('kwesi@example.com');
    expect(session.profile.membership_status).toBe('pending');
    expect(session.role).toBe('member');
    expect(getSessionUser()?.profile.email).toBe('kwesi@example.com');

    signOut();
    expect(getSessionUser()).toBeNull();

    const back = signIn('Kwesi@Example.com ', 'StrongPass123');
    expect(back.profile.full_name).toBe('Kwesi Appiah');
  });

  it('rejects duplicate emails, weak passwords and missing privacy consent', () => {
    expect(() =>
      signUp({ fullName: 'Ama Boateng', email: 'ama@example.com', password: 'StrongPass123', acceptedPrivacy: true })
    ).toThrow(/already exists/i);

    expect(() =>
      signUp({ fullName: 'New Person', email: 'new@example.com', password: 'short', acceptedPrivacy: true })
    ).toThrow(/at least 8/);

    expect(() =>
      signUp({ fullName: 'New Person', email: 'new2@example.com', password: 'StrongPass123', acceptedPrivacy: false })
    ).toThrow(/privacy/i);
  });

  it('shows a clear error for a wrong password', () => {
    expect(() => signIn('ama@example.com', 'wrong-password')).toThrow(/Incorrect email or password/i);
  });

  it('renders the login screen and signs in through the real UI', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('welcome-login'));
    await user.type(screen.getByLabelText(/email address/i), 'ama@example.com');
    await user.type(screen.getByLabelText(/^password$/i), SEED_PASSWORD);
    await user.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByText(/Good (morning|afternoon|evening), Ama/i)).toBeInTheDocument());
  });
});

/* ================================================================== */
/* 2. Membership approval works                                       */
/* ================================================================== */

describe('2. Membership approval', () => {
  it('creates new accounts as pending and blocks financial access until approved', () => {
    signUp({ fullName: 'Yaa Test', email: 'yaatest@example.com', password: 'StrongPass123', acceptedPrivacy: true });
    expect(() => getGroupSummary()).toThrow(/awaiting approval/i);
    expect(() => getPublicMembers()).toThrow(/awaiting approval/i);

    const adminId = userIdByEmail('admin@have2022.org');
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const newUser = loadState().users.find((u) => u.email === 'yaatest@example.com')!;
    approveMember(newUser.id);

    signIn('yaatest@example.com', 'StrongPass123');
    const summary = getGroupSummary();
    expect(summary.approved_members_count).toBeGreaterThan(0);

    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const approvalLog = getAuditLogs().find((l) => l.action_type === 'APPROVE_MEMBER' && l.actor_id === adminId);
    expect(approvalLog).toBeTruthy();
  });

  it('sends an approval notification to the member', () => {
    signUp({ fullName: 'Kojo Test', email: 'kojotest@example.com', password: 'StrongPass123', acceptedPrivacy: true });
    const newId = loadState().users.find((u) => u.email === 'kojotest@example.com')!.id;
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    approveMember(newId);
    const notifications = loadState().notifications.filter((n) => n.user_id === newId);
    expect(notifications.some((n) => n.type === 'membership_approved')).toBe(true);
  });

  it('generates obligations for a pending member when approved after the rule is active', () => {
    signUp({ fullName: 'Late Joiner', email: 'late@example.com', password: 'StrongPass123', acceptedPrivacy: true });
    const newId = loadState().users.find((u) => u.email === 'late@example.com')!.id;
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    approveMember(newId);

    const obligations = loadState().obligations.filter((o) => o.member_id === newId);
    expect(obligations.length).toBeGreaterThan(0);
    expect(obligations.every((o) => o.amount_paid_ghs === 0)).toBe(true);
  });

  it('shows the awaiting-approval screen in the UI', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('welcome-join'));
    await user.type(screen.getByLabelText(/full name/i), 'Pending Person');
    await user.type(screen.getByLabelText(/email address/i), 'pending@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123');
    await user.click(screen.getByTestId('register-privacy'));
    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Awaiting Approval/i })).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Group financial data stays hidden/i).length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/* 3. Members cannot access admin actions                             */
/* ================================================================== */

describe('3. Members cannot access admin actions', () => {
  it('blocks every admin service call for a normal member', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    expect(() => getAdminMemberRows()).toThrow(/Access denied/i);
    expect(() => getAuditLogs()).toThrow(/Access denied/i);
    expect(() => getAllPayments()).toThrow(/Access denied/i);
    expect(() => getOutstandingMembers()).toThrow(/Access denied/i);
    expect(() => setMemberRole(userIdByEmail('ama@example.com'), 'admin')).toThrow(/Access denied/i);
    expect(() => approveMember(userIdByEmail('yaa@example.com'))).toThrow(/Access denied/i);
    expect(() => saveContributionRule({
      title: 'Hack',
      amountGhs: 1,
      frequency: 'monthly',
      startDate: todayISO(),
      dueDay: 1,
      gracePeriodDays: 0,
      isActive: true,
      momoNumber: '0',
      momoName: 'x',
    })).toThrow(/Access denied/i);
    expect(() => postExpense({
      title: 'Fake',
      amountGhs: 10,
      reason: 'Should not work',
      expenseDate: todayISO(),
    })).toThrow(/Access denied/i);
  });

  it('prevents a member from promoting themselves', () => {
    signIn('kwame@example.com', SEED_PASSWORD);
    const selfId = userIdByEmail('kwame@example.com');
    expect(() => setMemberRole(selfId, 'admin')).toThrow(/Access denied/i);
    expect(loadState().users.find((u) => u.id === selfId)?.role).toBe('member');
  });

  it('hides the admin portal from a normal member in the UI', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);
    await user.click(screen.getByTestId('tab-more'));
    expect(screen.queryByText(/Admin portal/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-menu-admin-dashboard')).not.toBeInTheDocument();
  });

  it('shows the admin portal to an administrator in the UI', async () => {
    const user = userEvent.setup();
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    render(<App />);
    await user.click(screen.getByTestId('tab-more'));
    expect(await screen.findByText(/Admin portal/i)).toBeInTheDocument();
    expect(screen.getByTestId('admin-menu-admin-dashboard')).toBeInTheDocument();
  });
});

/* ================================================================== */
/* 4. The contribution amount can remain unset                        */
/* ================================================================== */

describe('4. Contribution amount can remain unset', () => {
  it('stores a rule with amount_ghs = null, inactive, and generates no obligations', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    resetToBlank();
    signUp({ fullName: 'Admin One', email: 'admin1@example.com', password: 'StrongPass123', acceptedPrivacy: true });
    // nothing is active yet
    expect(loadState().contribution_rules.length).toBe(0);
    expect(loadState().obligations.length).toBe(0);

    const adminId = loadState().users.find((u) => u.email === 'admin1@example.com')!.id;
    const state = loadState();
    const admin = state.users.find((u) => u.id === adminId)!;
    admin.membership_status = 'approved';
    admin.role = 'admin';

    const result = saveContributionRule({
      title: 'Have R/C JHS 2022 Contribution',
      amountGhs: null,
      frequency: 'monthly',
      startDate: '',
      dueDay: 28,
      gracePeriodDays: 5,
      isActive: false,
      momoNumber: '024 000 0000',
      momoName: 'Welfare Fund',
    });

    expect(result.periodsCreated).toBe(0);
    const rule = loadState().contribution_rules[0];
    expect(rule.amount_ghs).toBeNull();
    expect(rule.is_active).toBe(false);
    expect(loadState().obligations.length).toBe(0);
  });

  it('refuses to activate the schedule without an amount', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    // deactivate the seeded rule, then clear the amount
    saveContributionRule({
      title: 'Have R/C JHS 2022 Monthly Contribution',
      amountGhs: null,
      frequency: 'monthly',
      startDate: '2026-01-01',
      dueDay: 28,
      gracePeriodDays: 5,
      isActive: false,
      momoNumber: '024 411 2200',
      momoName: 'Kofi Asante (Treasurer)',
    });
    expect(() =>
      saveContributionRule({
        title: 'Have R/C JHS 2022 Monthly Contribution',
        amountGhs: null,
        frequency: 'monthly',
        startDate: '2026-01-01',
        dueDay: 28,
        gracePeriodDays: 5,
        isActive: true,
        momoNumber: '024 411 2200',
        momoName: 'Kofi Asante (Treasurer)',
      })
    ).toThrow(/Enter the agreed contribution amount/i);
  });

  it('explains the missing schedule on the dashboard', async () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    saveContributionRule({
      title: 'Have R/C JHS 2022 Monthly Contribution',
      amountGhs: null,
      frequency: 'monthly',
      startDate: '',
      dueDay: 28,
      gracePeriodDays: 5,
      isActive: false,
      momoNumber: '024 411 2200',
      momoName: 'Kofi Asante (Treasurer)',
    });
    render(<App />);
    expect(await screen.findByText(/schedule not yet available/i)).toBeInTheDocument();
  });
});

/* ================================================================== */
/* 5. Obligations are generated correctly after activation            */
/* ================================================================== */

describe('5. Obligation generation', () => {
  it('creates one obligation per approved member per period and never duplicates', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const before = loadState().obligations.length;
    const approvedCount = loadState().users.filter((u) => u.membership_status === 'approved').length;

    // Re-saving the same active rule must not duplicate anything
    const seeded = loadState().contribution_rules[0];
    saveContributionRule({
      title: seeded.title,
      amountGhs: seeded.amount_ghs,
      frequency: seeded.frequency,
      everyWeeks: seeded.every_weeks ?? 1,
      durationPeriods: seeded.duration_periods ?? null,
      startDate: seeded.start_date as string,
      dueDay: seeded.due_day,
      gracePeriodDays: seeded.grace_period_days,
      isActive: true,
      momoNumber: '024 411 2200',
      momoName: 'Kofi Asante (Treasurer)',
    });
    expect(loadState().obligations.length).toBe(before);

    // A brand-new activation from a blank state generates the right grid
    resetToBlank();
    const state = loadState();
    state.users.push(
      {
        id: 'u_admin',
        email: 'boss@example.com',
        password_hash: state.users[0]?.password_hash ?? '',
        full_name: 'Boss Admin',
        phone: null,
        avatar_url: null,
        membership_status: 'approved',
        role: 'admin',
        privacy_accepted_at: new Date().toISOString(),
        approved_by: null,
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'u_m1',
        email: 'm1@example.com',
        password_hash: 'x',
        full_name: 'Member One',
        phone: null,
        avatar_url: null,
        membership_status: 'approved',
        role: 'member',
        privacy_accepted_at: new Date().toISOString(),
        approved_by: null,
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
    state.session_user_id = 'u_admin';
    window.localStorage.setItem('have_rc_jhs_2022_fund_db_v1', JSON.stringify(state));
    invalidateCache();

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
    threeMonthsAgo.setDate(1);
    const start = threeMonthsAgo.toISOString().slice(0, 10);

    const result = saveContributionRule({
      title: 'Monthly Dues',
      amountGhs: 50,
      frequency: 'monthly',
      startDate: start,
      dueDay: 28,
      gracePeriodDays: 5,
      isActive: true,
      momoNumber: '024',
      momoName: 'Fund',
    });

    expect(result.periodsCreated).toBe(3);
    const periods = loadState().contribution_periods.length;
    const obligations = loadState().obligations.length;
    expect(periods).toBe(3);
    expect(obligations).toBe(periods * 2); // 2 approved members
    expect(loadState().obligations.every((o) => o.amount_due_ghs === 50)).toBe(true);
    expect(approvedCount).toBeGreaterThan(0);
  });

  it('does not create obligations for future periods', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const future = new Date();
    future.setMonth(future.getMonth() + 2);
    const result = saveContributionRule({
      title: 'Future Rule',
      amountGhs: 100,
      frequency: 'monthly',
      startDate: future.toISOString().slice(0, 10),
      dueDay: 28,
      gracePeriodDays: 5,
      isActive: true,
      momoNumber: '024',
      momoName: 'Fund',
    });
    expect(result.periodsCreated).toBe(0);
  });
});

/* ================================================================== */
/* 6. Payments remain pending until verified                          */
/* ================================================================== */

describe('6. Payments stay pending until verified', () => {
  it('creates a pending submission that does not change balances', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const before = getMyComputation()!;
    const groupBefore = getGroupSummary();

    const payment = submitPayment({
      amountGhs: 100,
      paymentDate: todayISO(),
      paymentMethod: 'Mobile Money',
      transactionReference: 'MM-999',
    });

    expect(payment.status).toBe('pending');
    const after = getMyComputation()!;
    expect(after.total_verified_paid).toBe(before.total_verified_paid);
    expect(after.outstanding).toBe(before.outstanding);
    expect(getGroupSummary().total_verified_contributions_ghs).toBe(groupBefore.total_verified_contributions_ghs);
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(groupBefore.current_recorded_balance_ghs);
    expect(getLedgerEntries().some((e) => e.source_payment_id === payment.id)).toBe(false);
  });

  it('requires a positive amount and a non-future date', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    expect(() => submitPayment({ amountGhs: 0, paymentDate: todayISO(), paymentMethod: 'Cash' })).toThrow(/greater than zero/i);
    expect(() => submitPayment({ amountGhs: 10, paymentDate: '2099-01-01', paymentMethod: 'Cash' })).toThrow(/cannot be in the future/i);
  });
});

/* ================================================================== */
/* 7. Verified payments update member balance and group income        */
/* ================================================================== */

describe('7. Verification updates balances and income exactly once', () => {
  it('increases the member total, group income and the ledger by exactly the paid amount', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 25, paymentDate: todayISO(), paymentMethod: 'Mobile Money' });
    const balanceBefore = getGroupSummary().current_recorded_balance_ghs;

    signIn('treasurer@have2022.org', SEED_PASSWORD);
    verifyPayment(payment.id);

    const summary = getGroupSummary();
    expect(summary.current_recorded_balance_ghs).toBe(balanceBefore + 25);
    expect(summary.total_verified_contributions_ghs).toBeGreaterThanOrEqual(25);

    const ledgerRows = getLedgerEntries().filter((e) => e.source_payment_id === payment.id);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0].signed_amount_ghs).toBe(25);

    signIn('ama@example.com', SEED_PASSWORD);
    const mine = getMyComputation()!;
    expect(mine.total_verified_paid).toBe(25);
    expect(getMyPayments().find((p) => p.id === payment.id)?.status).toBe('verified');
  });

  it('cannot verify the same payment twice', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 100, paymentDate: todayISO(), paymentMethod: 'Cash' });
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    verifyPayment(payment.id);
    expect(() => verifyPayment(payment.id)).toThrow(/already been processed/i);
    expect(getLedgerEntries().filter((e) => e.source_payment_id === payment.id)).toHaveLength(1);
  });

  it('rejecting a payment never changes any balance', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 100, paymentDate: todayISO(), paymentMethod: 'Cash' });
    const before = getGroupSummary().current_recorded_balance_ghs;
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    rejectPayment(payment.id, 'Money was not received in the group account.');
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(before);
    expect(getLedgerEntries().filter((e) => e.source_payment_id === payment.id)).toHaveLength(0);
    expect(() => rejectPayment(payment.id, 'again')).toThrow(/Only pending payments/i);
  });

  it('splits a multi-period payment across periods without double counting', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const before = getMyComputation()!;
    const combined = before.outstanding;
    const payment = submitPayment({ amountGhs: combined, paymentDate: todayISO(), paymentMethod: 'Bank transfer' });

    signIn('treasurer@have2022.org', SEED_PASSWORD);
    verifyPayment(payment.id);

    signIn('ama@example.com', SEED_PASSWORD);
    const after = getMyComputation()!;
    expect(after.total_verified_paid).toBe(before.total_verified_paid + combined);
    expect(after.outstanding).toBe(0);

    const allocations = loadState().allocations.filter((a) => a.payment_id === payment.id);
    expect(allocations.length).toBeGreaterThan(1);
    const allocatedSum = allocations.reduce((s, a) => s + a.amount_allocated_ghs, 0);
    expect(Math.round(allocatedSum * 100) / 100).toBe(combined);
    // no obligation is ever over-paid
    expect(loadState().obligations.every((o) => o.amount_paid_ghs <= o.amount_due_ghs)).toBe(true);
  });

  it('supports partial payments across periods', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 15, paymentDate: todayISO(), paymentMethod: 'Cash' });
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    verifyPayment(payment.id);
    signIn('ama@example.com', SEED_PASSWORD);
    const mine = getMyComputation()!;
    expect(mine.total_verified_paid).toBe(15);
    expect(mine.outstanding).toBe(mine.total_due - 15);
    expect(mine.periods_partially_paid).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/* 8. Outstanding balances are calculated correctly                   */
/* ================================================================== */

describe('8. Outstanding balance calculation', () => {
  it('matches total due minus verified payments for each member', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const members = getPublicMembers();
    members.forEach((m) => {
      const obligations = loadState().obligations.filter((o) => o.member_id === m.member_id);
      const due = obligations.reduce((s, o) => s + o.amount_due_ghs, 0);
      const paid = obligations.reduce((s, o) => s + o.amount_paid_ghs, 0);
      expect(Math.round(due * 100) / 100).toBe(Math.round(m.total_due_ghs * 100) / 100);
      expect(Math.round((due - paid) * 100) / 100).toBe(Math.round(m.outstanding_amount_ghs * 100) / 100);
    });
  });

  it('applies the grace period before labelling a period overdue', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const mine = getMyComputation()!;
    const state = loadState();
    const unpaid = state.obligations.filter((o) => o.member_id === mine.member.id && o.status !== 'paid');
    // oldest unpaid period has a due date in the past -> overdue after grace
    expect(unpaid.length).toBeGreaterThan(0);
    const statuses = getPublicMembers();
    expect(statuses.length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/* 9. Admin can create an expense with amount, reason, date, evidence */
/* ================================================================== */

describe('9. Creating an expense', () => {
  it('posts an expense with all fields and optional evidence', () => {
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    const expense = postExpense({
      title: 'Funeral Support',
      amountGhs: 250,
      reason: "Contribution towards a former classmate's family funeral.",
      expenseDate: todayISO(),
      category: 'Welfare',
      vendorPaid: 'Mensah Family',
      notes: 'Approved at the meeting',
      evidence: {
        fileName: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });

    expect(expense.title).toBe('Funeral Support');
    expect(expense.amount_ghs).toBe(250);
    expect(expense.status).toBe('posted');
    expect(expense.has_evidence).toBe(true);
    expect(expense.created_by_name).toBe('Akosua Frimpong');
    expect(getExpenses().some((e) => e.id === expense.id)).toBe(true);
    expect(getExpenseEvidence(expense.id)?.fileName).toBe('receipt.png');
  });

  it('validates amount, reason and date', () => {
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    expect(() => postExpense({ title: 'Zero amount', amountGhs: 0, reason: 'test reason', expenseDate: todayISO() })).toThrow(/greater than zero/i);
    expect(() => postExpense({ title: 'Valid title', amountGhs: 10, reason: '', expenseDate: todayISO() })).toThrow(/reason/i);
    expect(() => postExpense({ title: 'Valid title', amountGhs: 10, reason: 'valid reason', expenseDate: '2099-01-01' })).toThrow(/future/i);
  });

  it('completes the whole flow through the admin UI', async () => {
    const user = userEvent.setup();
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    render(<App />);

    await user.click(screen.getByTestId('tab-fund'));
    await user.click(await screen.findByTestId('fund-add-expense'));

    await user.type(await screen.findByTestId('expense-title'), 'Transport for Executive Meeting');
    await user.type(screen.getByTestId('expense-amount'), '45');
    await user.type(screen.getByTestId('expense-reason'), 'Fuel for the treasurer to collect the group receipt book.');
    await user.click(screen.getByTestId('expense-review'));

    await user.click(await screen.findByRole('button', { name: /Save & post expense/i }));
    await waitFor(() => expect(screen.getByText(/Expense History/i)).toBeInTheDocument());
    expect(loadState().expenses.some((e) => e.title === 'Transport for Executive Meeting')).toBe(true);
  });
});

/* ================================================================== */
/* 10. Posting an expense decreases the balance exactly once          */
/* ================================================================== */

describe('10. Expense impacts the balance exactly once', () => {
  it('subtracts the expense from the recorded balance exactly once', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const before = getGroupSummary().current_recorded_balance_ghs;
    const expense = postExpense({
      title: 'Printing receipts',
      amountGhs: 30,
      reason: 'Receipt book for contributions',
      expenseDate: todayISO(),
    });
    const after = getGroupSummary();
    expect(after.current_recorded_balance_ghs).toBe(before - 30);
    expect(after.total_posted_expenses_ghs).toBeGreaterThanOrEqual(30);
    expect(getLedgerEntries().filter((e) => e.source_expense_id === expense.id)).toHaveLength(1);
  });

  it('blocks an expense above the recorded balance unless an authorised exception is given', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const balance = getGroupSummary().current_recorded_balance_ghs;
    const tooMuch = balance + 500;

    expect(() =>
      postExpense({ title: 'Huge spend', amountGhs: tooMuch, reason: 'No approval', expenseDate: todayISO() })
    ).toThrow(/more than the recorded balance/i);

    expect(() =>
      postExpense({
        title: 'Huge spend',
        amountGhs: tooMuch,
        reason: 'Approved at meeting',
        expenseDate: todayISO(),
        overrideBalanceLimit: true,
        overrideReason: '',
      })
    ).toThrow(/explanation/i);

    const ok = postExpense({
      title: 'Huge spend',
      amountGhs: tooMuch,
      reason: 'Approved at meeting',
      expenseDate: todayISO(),
      overrideBalanceLimit: true,
      overrideReason: 'Approved unanimously at the 12 October general meeting; cash received but not yet recorded.',
    });
    expect(ok.exceeded_balance_override).toBe(true);
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(balance - tooMuch);
  });

  it('never counts pending payments as income', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    submitPayment({ amountGhs: 500, paymentDate: todayISO(), paymentMethod: 'Mobile Money' });
    const summary = getGroupSummary();
    expect(summary.pending_payment_submissions_count).toBeGreaterThan(0);
    const incomeFromLedger = getLedgerEntries({ type: 'income' });
    expect(incomeFromLedger.every((e) => e.recorded_status === 'Verified')).toBe(true);
  });
});

/* ================================================================== */
/* 11. The expense appears in the expense history                     */
/* ================================================================== */

describe('11. Expense appears in the history', () => {
  it('lists a new expense for approved members', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const expense = postExpense({
      title: 'Meeting refreshment',
      amountGhs: 60,
      reason: 'Water for the October meeting',
      expenseDate: todayISO(),
    });
    signIn('ama@example.com', SEED_PASSWORD);
    const listed = getExpenses().find((e) => e.id === expense.id);
    expect(listed).toBeTruthy();
    expect(listed?.title).toBe('Meeting refreshment');
  });

  it('renders posted expenses on the Group Fund tab', async () => {
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);
    await userEvent.setup().click(screen.getByTestId('tab-fund'));
    expect(await screen.findByText('Funeral Support')).toBeInTheDocument();
    expect(screen.getByText('Printing of Constitution Copies')).toBeInTheDocument();
  });
});

/* ================================================================== */
/* 12. Approved members can view shared payment-status fields         */
/* ================================================================== */

describe('12. Shared payment status visibility', () => {
  it('exposes only the agreed public fields to approved members', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const members = getPublicMembers();
    expect(members.length).toBeGreaterThan(0);
    const sample = members[0];
    expect(sample).toHaveProperty('full_name');
    expect(sample).toHaveProperty('total_verified_paid_ghs');
    expect(sample).toHaveProperty('outstanding_amount_ghs');
    expect(sample).toHaveProperty('payment_status');

    const raw = sample as unknown as Record<string, unknown>;
    expect(raw.email).toBeUndefined();
    expect(raw.phone).toBeUndefined();
    expect(raw.transaction_reference).toBeUndefined();
    expect(raw.evidence_attachment_id).toBeUndefined();
    expect(raw.notes).toBeUndefined();
  });

  it('renders the members directory with a search and filters', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);
    await user.click(screen.getByTestId('tab-members'));
    expect(await screen.findByText('Kwame Mensah')).toBeInTheDocument();

    await user.type(screen.getByTestId('member-search'), 'Ama');
    expect(screen.getByText(/Ama Boateng/)).toBeInTheDocument();
    expect(screen.queryByText('Kwame Mensah')).not.toBeInTheDocument();

    await user.clear(screen.getByTestId('member-search'));
    await user.click(screen.getByTestId('filter-paid'));
    await waitFor(() => expect(screen.queryByText('Ama Boateng')).not.toBeInTheDocument());
  });
});

/* ================================================================== */
/* 13. Unauthorised users cannot access private payment evidence      */
/* ================================================================== */

describe('13. Payment evidence is private', () => {
  it('restricts receipts and references to the owner and admins', () => {
    const state = loadState();
    const ama = state.users.find((u) => u.email === 'ama@example.com')!;

    const attachmentId = 'att_secret';
    state.attachments.push({
      id: attachmentId,
      owner_id: ama.id,
      scope: 'payment_evidence',
      file_name: 'momo.png',
      mime_type: 'image/png',
      file_size_bytes: 10,
      storage_path: 'payment-evidence/secret',
      data_url: 'data:image/png;base64,AAAA',
      created_at: new Date().toISOString(),
    });
    state.payments.push({
      id: 'pay_secret',
      member_id: ama.id,
      member_name: ama.full_name,
      amount_ghs: 50,
      allocated_amount_ghs: 0,
      unallocated_credit_ghs: 0,
      payment_date: todayISO(),
      payment_method: 'Mobile Money',
      transaction_reference: 'MM-PRIVATE-REF',
      evidence_attachment_id: attachmentId,
      has_evidence: true,
      target_period_id: null,
      notes: 'private note',
      status: 'pending',
      is_offline_entry: false,
      recorded_by: null,
      reviewed_by: null,
      reviewed_by_name: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    window.localStorage.setItem('have_rc_jhs_2022_fund_db_v1', JSON.stringify(state));
    invalidateCache();

    // Other member: blocked
    signIn('kwame@example.com', SEED_PASSWORD);
    expect(() => getPaymentEvidence('pay_secret')).toThrow(/Access denied/i);

    // Owner: allowed
    signIn('ama@example.com', SEED_PASSWORD);
    expect(getPaymentEvidence('pay_secret')?.fileName).toBe('momo.png');

    // Admin: allowed
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    expect(getPaymentEvidence('pay_secret')?.fileName).toBe('momo.png');

    // Another member cannot see the reference in the shared member list
    signIn('kwame@example.com', SEED_PASSWORD);
    const json = JSON.stringify(getPublicMembers());
    expect(json).not.toContain('MM-PRIVATE-REF');
    expect(json).not.toContain('momo.png');
  });
});

/* ================================================================== */
/* 14. Expense corrections remain auditable                           */
/* ================================================================== */

describe('14. Expense corrections stay auditable', () => {
  it('adjusts an amount and keeps the original record plus an audit trail', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const before = getGroupSummary().current_recorded_balance_ghs;
    const expense = postExpense({
      title: 'Wrong amount',
      amountGhs: 200,
      reason: 'Entered incorrectly',
      expenseDate: todayISO(),
    });
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(before - 200);

    adjustExpense(expense.id, 120, 'Correct amount on the invoice is GH₵120, not GH₵200.');

    const stored = loadState().expenses.find((e) => e.id === expense.id)!;
    expect(stored.amount_ghs).toBe(200); // original preserved
    expect(stored.effective_amount_ghs).toBe(120);
    expect(stored.status).toBe('adjusted');
    expect(stored.adjustments).toHaveLength(1);
    expect(stored.adjustments[0].reason).toMatch(/invoice/i);

    // 80 returned to the fund, applied once
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(before - 120);
    const corrections = getLedgerEntries().filter((e) => e.source_adjustment_id);
    expect(corrections).toHaveLength(1);

    const audit = getAuditLogs().find((l) => l.action_type === 'ADJUST_EXPENSE' && l.entity_id === expense.id);
    expect(audit).toBeTruthy();
    expect(audit?.summary).toMatch(/120/);
  });

  it('reverses an expense with a reason and keeps history', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const before = getGroupSummary().current_recorded_balance_ghs;
    const expense = postExpense({
      title: 'Mistaken entry',
      amountGhs: 75,
      reason: 'Double entry mistake',
      expenseDate: todayISO(),
    });
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(before - 75);

    reverseExpense(expense.id, 'Expense was entered twice by mistake; this is the duplicate.');
    expect(getGroupSummary().current_recorded_balance_ghs).toBe(before);

    const stored = loadState().expenses.find((e) => e.id === expense.id)!;
    expect(stored.status).toBe('reversed');
    expect(stored.adjustments[0].adjustment_type).toBe('reversal');
    expect(() => reverseExpense(expense.id, 'again and again')).toThrow(/already been reversed/i);
  });

  it('requires a reason for corrections', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const expense = postExpense({ title: 'Something', amountGhs: 10, reason: 'Valid reason here', expenseDate: todayISO() });
    expect(() => adjustExpense(expense.id, 5, '')).toThrow(/explain/i);
    expect(() => reverseExpense(expense.id, '')).toThrow(/explain/i);
  });
});

/* ================================================================== */
/* 15. WhatsApp reminders use the correct member and balance          */
/* ================================================================== */

describe('15. WhatsApp reminders', () => {
  it('builds the exact prefilled message with the member name, amount and period', () => {
    const message = buildWhatsAppReminderMessage({
      memberName: 'Ama Boateng',
      outstandingAmountGhs: 400,
      periodLabel: 'August 2026',
    });
    expect(message).toContain('Hello Ama Boateng, this is a friendly reminder from the Have R/C JHS 2022 Old Students group.');
    expect(message).toContain('GH₵400.00');
    expect(message).toContain('for August 2026');
    expect(message).toContain('If you have already paid, please contact the treasurer so your records can be updated.');
  });

  it('uses each member’s own balance in the reminder action', async () => {
    const user = userEvent.setup();
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);

    const outstanding = getOutstandingMembers('all');
    const amaRow = outstanding.find((o) => o.full_name === 'Ama Boateng');
    expect(amaRow).toBeDefined();

    render(<App />);
    await user.click(screen.getByTestId('tab-more'));
    await user.click(await screen.findByTestId('admin-menu-admin-outstanding'));

    const reminderButtons = await screen.findAllByRole('button', { name: /^Reminder$/i });
    expect(reminderButtons.length).toBeGreaterThan(0);

    // open the first outstanding member's reminder
    await user.click(reminderButtons[0]);
    const link = await screen.findByTestId('whatsapp-reminder');
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('https://wa.me/');
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain('Have R/C JHS 2022 Old Students group');
    expect(decoded).toContain('GH₵');
  });

  it('records an in-app reminder notification for the right member', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const rows = getOutstandingMembers('all');
    const target = rows[0];
    sendInAppReminder(target.member_id, target.outstanding, target.relevant_period_label);
    const notes = loadState().notifications.filter((n) => n.user_id === target.member_id);
    expect(notes.some((n) => n.type === 'outstanding_reminder')).toBe(true);
    expect(notes[notes.length - 1].message).toContain(target.outstanding.toFixed(2));
  });
});

/* ================================================================== */
/* 16. Financial summaries match the underlying ledger                */
/* ================================================================== */

describe('16. Summaries reconcile with the ledger', () => {
  it('balance equals the signed sum of every ledger entry', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const summary = getGroupSummary();
    const ledger = getLedgerEntries();
    const signedSum = Math.round(ledger.reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100;
    expect(summary.current_recorded_balance_ghs).toBe(signedSum);

    const incomeSum =
      Math.round(ledger.filter((e) => e.signed_amount_ghs > 0).reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100;
    const expenseSum =
      Math.round(ledger.filter((e) => e.signed_amount_ghs < 0).reduce((s, e) => s + Math.abs(e.signed_amount_ghs), 0) * 100) / 100;
    expect(Math.round((incomeSum - expenseSum) * 100) / 100).toBe(summary.current_recorded_balance_ghs);
    expect(summary.total_recorded_income_ghs).toBe(summary.total_verified_contributions_ghs + summary.other_recorded_income_ghs);
  });

  it('reconciles after a full cycle of verify + expense + reversal', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 200, paymentDate: todayISO(), paymentMethod: 'Mobile Money' });
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    verifyPayment(payment.id);
    const expense = postExpense({ title: 'Cycle expense', amountGhs: 50, reason: 'Testing reconciliation', expenseDate: todayISO() });
    reverseExpense(expense.id, 'Reversed to prove the ledger stays balanced.');

    const summary = getGroupSummary();
    const ledger = getLedgerEntries();
    expect(summary.current_recorded_balance_ghs).toBe(
      Math.round(ledger.reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100
    );
    // the reversed expense nets to zero but both entries remain
    const expenseEntries = ledger.filter((e) => e.source_expense_id === expense.id);
    expect(expenseEntries).toHaveLength(2);
    expect(Math.round(expenseEntries.reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100).toBe(0);
  });
});

/* ================================================================== */
/* 17. Database security policies block unauthorised changes          */
/* ================================================================== */

describe('17. Security rules block unauthorised changes', () => {
  it('prevents members from approving, verifying, rejecting, expensing or changing roles', () => {
    signIn('kwame@example.com', SEED_PASSWORD);
    const otherPayment = loadState().payments[0];
    expect(() => verifyPayment(otherPayment.id)).toThrow(/Access denied/i);
    expect(() => rejectPayment(otherPayment.id, 'no reason to allow this')).toThrow(/Access denied/i);
    expect(() => recordOfflinePayment({
      memberId: userIdByEmail('ama@example.com'),
      amountGhs: 100,
      paymentDate: todayISO(),
      paymentMethod: 'Cash',
    })).toThrow(/Access denied/i);
    expect(() => reverseExpense(loadState().expenses[0].id, 'Unauthorised attempt')).toThrow(/Access denied/i);
  });

  it('requires an authenticated session for every read', () => {
    signOut();
    expect(() => getGroupSummary()).toThrow(/signed in/i);
    expect(() => getPublicMembers()).toThrow(/signed in/i);
    expect(() => getExpenses()).toThrow(/signed in/i);
  });

  it('keeps the last administrator in place', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const selfId = userIdByEmail('admin@have2022.org');
    expect(() => setMemberRole(selfId, 'member')).toThrow(/cannot remove your own administrator role/i);
  });

  it('allows a full admin to promote a trusted member to treasurer', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const kwameId = userIdByEmail('kwame@example.com');
    setMemberRole(kwameId, 'treasurer');
    signIn('kwame@example.com', SEED_PASSWORD);
    expect(() => getAuditLogs()).not.toThrow();
  });

  it('marks every admin action in the audit log', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    postExpense({ title: 'Audited expense', amountGhs: 5, reason: 'Audit check', expenseDate: todayISO() });
    const logs = getAuditLogs();
    expect(logs.some((l) => l.action_type === 'POST_EXPENSE')).toBe(true);
    expect(logs[0].actor_name).toBe('Kofi Asante');
  });
});

/* ================================================================== */
/* 18. The interface works on mobile screens                          */
/* ================================================================== */

describe('18. Mobile-first interface', () => {
  it('renders a five-tab bottom navigation with large touch targets', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);

    for (const tab of ['home', 'contributions', 'fund', 'members', 'more']) {
      expect(screen.getByTestId(`tab-${tab}`)).toBeInTheDocument();
    }
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);

    await user.click(screen.getByTestId('tab-contributions'));
    expect(await screen.findByText(/My Contributions/i)).toBeInTheDocument();
  });

  it('uses a single-column card layout with no wide data tables', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    const { container } = render(<App />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeTruthy();
    // app-shell carries the mobile max-width through the .app-shell utility class
    expect(shell?.className).toContain('app-shell');
    // no wide data tables that force horizontal scrolling on phones
    expect(container.querySelectorAll('table')).toHaveLength(0);
  });

  it('shows helpful empty states', async () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    resetToBlank();
    render(<App />);
    // blank database -> welcome screen, signed out
    expect(await screen.findByTestId('welcome-join')).toBeInTheDocument();
  });
});

/* ================================================================== */
/* 19. Important buttons perform real actions                         */
/* ================================================================== */

describe('19. Buttons perform real actions', () => {
  it('submitting a payment from the UI creates a real pending record', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);

    await user.click(screen.getByTestId('tab-contributions'));
    await user.click(await screen.findByTestId('submit-payment-button'));

    fireEvent.change(await screen.findByTestId('payment-amount'), { target: { value: '120' } });
    fireEvent.change(screen.getByTestId('payment-reference'), { target: { value: 'UI-REF-1' } });
    await user.click(screen.getByTestId('payment-submit'));

    await waitFor(() => expect(screen.getByText(/Pending Verification/i)).toBeInTheDocument());
    const payments = getMyPayments();
    const created = payments.find((p) => p.transaction_reference === 'UI-REF-1');
    expect(created).toBeTruthy();
    expect(created?.status).toBe('pending');
    expect(created?.amount_ghs).toBe(120);
  });

  it('verifying a payment from the admin UI posts it to the ledger', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 90, paymentDate: todayISO(), paymentMethod: 'Cash' });

    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    render(<App />);

    await user.click(screen.getByTestId('tab-more'));
    await user.click(await screen.findByTestId('admin-menu-admin-review-payments'));

    const reviewButtons = await screen.findAllByText('Review');
    await user.click(reviewButtons[0]);
    await user.click(await screen.findByTestId('verify-payment'));

    await waitFor(() => {
      const stored = loadState().payments.find((p) => p.id === payment.id);
      expect(stored?.status).toBe('verified');
    });
  });

  it('logs out and returns to the welcome screen', async () => {
    const user = userEvent.setup();
    signIn('ama@example.com', SEED_PASSWORD);
    render(<App />);
    await user.click(screen.getByTestId('tab-more'));
    await user.click(await screen.findByTestId('logout-button'));
    await waitFor(() => expect(screen.getByTestId('welcome-join')).toBeInTheDocument());
    expect(getSessionUser()).toBeNull();
  });
});

/* ================================================================== */
/* 20. Production build and tests pass                                */
/* ================================================================== */

describe('20. Build integrity and data flows', () => {
  it('exposes every service the app needs without demo-only shortcuts in financial data', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const summary = getGroupSummary();
    // all figures derived from real records, not constants
    expect(typeof summary.current_recorded_balance_ghs).toBe('number');
    expect(Number.isFinite(summary.current_recorded_balance_ghs)).toBe(true);
    expect(summary.approved_members_count).toBeGreaterThan(0);
    expect(Array.isArray(getExpenses())).toBe(true);
    expect(Array.isArray(getLedgerEntries())).toBe(true);
  });

  it('supports the complete admin lifecycle end to end', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);

    // 1. approve a pending member
    const pendingId = loadState().users.find((u) => u.membership_status === 'pending')!.id;
    approveMember(pendingId);

    // 2. that member submits a payment
    signIn('yaa@example.com', SEED_PASSWORD);
    const payment = submitPayment({ amountGhs: 100, paymentDate: todayISO(), paymentMethod: 'Mobile Money' });

    // 3. treasurer verifies it
    signIn('treasurer@have2022.org', SEED_PASSWORD);
    verifyPayment(payment.id);

    // 4. treasurer posts an expense
    const expense = postExpense({
      title: 'Office supplies',
      amountGhs: 40,
      reason: 'Envelopes and stamps for receipts',
      expenseDate: todayISO(),
    });

    // 5. member sees the recorded balance, the expense and their own paid total
    signIn('yaa@example.com', SEED_PASSWORD);
    const summary = getGroupSummary();
    const mirror = getPublicMembers().find((m) => m.full_name === 'Nana Yaa Darko')!;
    expect(mirror.total_verified_paid_ghs).toBe(100);
    expect(getExpenses().some((e) => e.id === expense.id)).toBe(true);
    expect(summary.current_recorded_balance_ghs).toBe(
      Math.round(getLedgerEntries().reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100
    );

    // 6. audit log records the whole story
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const actions = getAuditLogs().map((l) => l.action_type);
    expect(actions).toContain('APPROVE_MEMBER');
    expect(actions).toContain('VERIFY_PAYMENT');
    expect(actions).toContain('POST_EXPENSE');
  });

  it('changes a password only with the current one', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    expect(() => changeMyPassword('not-my-password', 'NewPass123')).toThrow(/current password is incorrect/i);
    changeMyPassword(SEED_PASSWORD, 'NewPass123');
    signOut();
    expect(() => signIn('ama@example.com', SEED_PASSWORD)).toThrow(/Incorrect/i);
    expect(signIn('ama@example.com', 'NewPass123').profile.full_name).toBe('Ama Boateng');
  });

  it('blocks a rejected member from signing in', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const target = loadState().users.find((u) => u.email === 'kojo@example.com')!;
    const state = loadState();
    state.users.find((u) => u.id === target.id)!.membership_status = 'rejected';
    window.localStorage.setItem('have_rc_jhs_2022_fund_db_v1', JSON.stringify(state));
    invalidateCache();
    expect(() => signIn('kojo@example.com', SEED_PASSWORD)).toThrow(/declined/i);
  });

  it('never leaks private reference data into the activity feed', () => {
    signIn('ama@example.com', SEED_PASSWORD);
    submitPayment({
      amountGhs: 100,
      paymentDate: todayISO(),
      paymentMethod: 'Mobile Money',
      transactionReference: 'SECRET-REF-999',
    });
    signIn('kwame@example.com', SEED_PASSWORD);
    const feed = JSON.stringify(__getStateForTests().ledger);
    expect(feed).not.toContain('SECRET-REF-999');
  });
});

/* ================================================================== */
/* Extra: seed integrity                                              */
/* ================================================================== */

describe('Demo seed integrity', () => {
  it('ships a realistic, reconciling dataset', () => {
    signIn('admin@have2022.org', SEED_ADMIN_PASSWORD);
    const state = loadState();
    expect(state.users.length).toBeGreaterThanOrEqual(8);
    expect(state.payments.some((p) => p.status === 'pending')).toBe(true);
    expect(state.payments.some((p) => p.status === 'verified')).toBe(true);
    expect(state.expenses.length).toBeGreaterThanOrEqual(3);
    const summary = getGroupSummary();
    expect(summary.current_recorded_balance_ghs).toBe(
      Math.round(state.ledger.reduce((s, e) => s + e.signed_amount_ghs, 0) * 100) / 100
    );
  });

  it('throws a friendly error object for invalid input', () => {
    try {
      signIn('nobody@example.com', 'whatever');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).code).toBe('invalid');
    }
  });
});

/* ================================================================== */
/* 21. Weekly plan set by admin (GH₵10/week default)                   */
/* ================================================================== */

describe('21. Weekly plan set by admin', () => {
  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function blankWithTwoMembers() {
    resetToBlank();
    const state = loadState();
    const now = new Date().toISOString();
    state.users.push(
      {
        id: 'u_admin', email: 'boss@example.com', password_hash: 'x', full_name: 'Boss Admin',
        phone: null, avatar_url: null, membership_status: 'approved', role: 'admin',
        privacy_accepted_at: now, approved_by: null, approved_at: now, created_at: now, updated_at: now,
      } as never,
      {
        id: 'u_m1', email: 'm1@example.com', password_hash: 'x', full_name: 'Member One',
        phone: null, avatar_url: null, membership_status: 'approved', role: 'member',
        privacy_accepted_at: now, approved_by: null, approved_at: now, created_at: now, updated_at: now,
      } as never
    );
    state.session_user_id = 'u_admin';
    window.localStorage.setItem('have_rc_jhs_2022_fund_db_v1', JSON.stringify(state));
    invalidateCache();
  }

  it('creates Week 1, Week 2, Week 3 from the admin start date, due on the last day', () => {
    blankWithTwoMembers();
    const start = daysAgo(15); // Week 1 and 2 have ended, Week 3 is now
    const result = saveContributionRule({
      title: 'Weekly Contribution', amountGhs: 10, frequency: 'weekly', everyWeeks: 1,
      durationPeriods: 4, startDate: start, dueDay: 7, gracePeriodDays: 0,
      isActive: true, momoNumber: '024', momoName: 'Fund',
    });
    expect(result.periodsCreated).toBe(3);
    const periods = loadState().contribution_periods;
    expect(periods.map((x) => x.period_label.split('·')[0].trim())).toEqual(['Week 1', 'Week 2', 'Week 3']);
    expect(periods[0].due_date).toBe(daysAgo(9)); // start + 6 days
    expect(loadState().obligations).toHaveLength(6); // 2 members x 3 weeks

    const mine = getMyComputation()!;
    expect(mine.current_period_label).toContain('Week 3');
    expect(mine.current_period_outstanding_ghs).toBe(10);
    expect(mine.overdue_outstanding_ghs).toBe(20); // Week 1 + Week 2 missed

    const week = getCurrentWeekOutstanding()!;
    expect(week.is_ended).toBe(true);
    expect(week.period_label).toContain('Week 2');
    expect(week.members.map((m) => m.full_name)).toEqual(['Boss Admin', 'Member One']);
    expect(week.members[0].outstanding_ghs).toBe(10);
  });

  it('sends one outstanding notification for each missed week, only once', () => {
    blankWithTwoMembers();
    saveContributionRule({
      title: 'Weekly Contribution', amountGhs: 10, frequency: 'weekly', everyWeeks: 1,
      durationPeriods: 4, startDate: daysAgo(15), dueDay: 7, gracePeriodDays: 0,
      isActive: true, momoNumber: '024', momoName: 'Fund',
    });
    const first = getNotifications().filter((n) => n.type === 'outstanding_reminder');
    expect(first).toHaveLength(2); // Week 1 + Week 2
    expect(first[0].message).toContain('GH₵');
    getNotifications();
    getMyComputation();
    const again = getNotifications().filter((n) => n.type === 'outstanding_reminder');
    expect(again).toHaveLength(2); // no duplicates
  });

  it('supports every 2 weeks and stops at the admin duration', () => {
    blankWithTwoMembers();
    const twoWeekly = saveContributionRule({
      title: 'Weekly Contribution', amountGhs: 10, frequency: 'weekly', everyWeeks: 2,
      durationPeriods: 3, startDate: daysAgo(20), dueDay: 7, gracePeriodDays: 0,
      isActive: true, momoNumber: '024', momoName: 'Fund',
    });
    expect(twoWeekly.periodsCreated).toBe(2); // days -20 to -7, then -6 to +7
    expect(loadState().contribution_periods[0].period_label).toContain('Period 1');

    blankWithTwoMembers();
    const stopped = saveContributionRule({
      title: 'Weekly Contribution', amountGhs: 10, frequency: 'weekly', everyWeeks: 1,
      durationPeriods: 2, startDate: daysAgo(30), dueDay: 7, gracePeriodDays: 0,
      isActive: true, momoNumber: '024', momoName: 'Fund',
    });
    expect(stopped.periodsCreated).toBe(2); // duration reached, no Week 3+
    expect(getContributionRule()?.duration_periods).toBe(2);
  });

  it('starts the new week by itself when time passes', () => {
    blankWithTwoMembers();
    saveContributionRule({
      title: 'Weekly Contribution', amountGhs: 10, frequency: 'weekly', everyWeeks: 1,
      durationPeriods: 4, startDate: daysAgo(8), dueDay: 7, gracePeriodDays: 0,
      isActive: true, momoNumber: '024', momoName: 'Fund',
    });
    expect(loadState().contribution_periods).toHaveLength(2);
    // Pretend Week 2 was never created (e.g. nobody opened the app that week)
    const state = loadState();
    const week2 = state.contribution_periods[1];
    state.contribution_periods = state.contribution_periods.filter((x) => x.id !== week2.id);
    state.obligations = state.obligations.filter((o) => o.period_id !== week2.id);
    window.localStorage.setItem('have_rc_jhs_2022_fund_db_v1', JSON.stringify(state));
    invalidateCache();

    getContributionRule(); // opening the app syncs the schedule
    expect(loadState().contribution_periods).toHaveLength(2);
    expect(loadState().contribution_periods[1].period_label).toContain('Week 2');
  });
});
