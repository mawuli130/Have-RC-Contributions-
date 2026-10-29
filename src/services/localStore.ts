import type {
  AppNotification,
  AppRole,
  AuditLogEntry,
  ContributionObligation,
  ContributionPeriod,
  ContributionRule,
  ExpenseAdjustment,
  ExpenseRecord,
  FileAttachment,
  FinancialLedgerEntry,
  MembershipStatus,
  PaymentAllocation,
  PaymentSubmission,
} from '../types/database';
import { roundMoney } from '../utils/formatters';

const STORAGE_KEY = 'have_rc_jhs_2022_fund_db_v1';

export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  membership_status: MembershipStatus;
  role: AppRole;
  privacy_accepted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalDbState {
  version: number;
  users: LocalUser[];
  contribution_rules: ContributionRule[];
  contribution_periods: ContributionPeriod[];
  obligations: ContributionObligation[];
  payments: PaymentSubmission[];
  allocations: PaymentAllocation[];
  expenses: ExpenseRecord[];
  attachments: FileAttachment[];
  ledger: FinancialLedgerEntry[];
  notifications: AppNotification[];
  audit_logs: AuditLogEntry[];
  session_user_id: string | null;
  is_demo_seed: boolean;
}

/* ------------------------------------------------------------------ */
/* IDs, hashing & persistence helpers                                  */
/* ------------------------------------------------------------------ */

export function newId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}${rand}`;
}

/**
 * Lightweight deterministic hash used ONLY for the offline/local engine.
 * In live Supabase mode, passwords are hashed and salted by Supabase Auth
 * (GoTrue) and never touch this code path.
 */
export function hashPassword(password: string): string {
  const salt = 'have-rc-jhs-2022-local-salt';
  const input = `${salt}:${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = (h1 ^ code) * 0x01000193;
    h1 >>>= 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  return `lh1$${h1.toString(16)}$${h2.toString(16)}$${input.length}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function emptyState(): LocalDbState {
  return {
    version: 1,
    users: [],
    contribution_rules: [],
    contribution_periods: [],
    obligations: [],
    payments: [],
    allocations: [],
    expenses: [],
    attachments: [],
    ledger: [],
    notifications: [],
    audit_logs: [],
    session_user_id: null,
    is_demo_seed: false,
  };
}

let cache: LocalDbState | null = null;

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadState(): LocalDbState {
  if (cache) return cache;
  if (storageAvailable()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalDbState;
        if (parsed && parsed.version === 1) {
          cache = { ...emptyState(), ...parsed };
          return cache;
        }
      }
    } catch {
      // corrupted storage falls through to a fresh state
    }
  }
  cache = buildSeedState();
  persist();
  return cache;
}

export function persist(): void {
  if (!cache) return;
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage full / disabled: engine keeps working in memory
  }
}

export function writeState(mutator: (state: LocalDbState) => void): LocalDbState {
  const state = loadState();
  mutator(state);
  persist();
  return state;
}

export function resetToSeed(): LocalDbState {
  cache = buildSeedState();
  persist();
  return cache;
}

export function resetToBlank(): LocalDbState {
  cache = emptyState();
  persist();
  return cache;
}

export function invalidateCache(): void {
  cache = null;
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(dateISO: string, months: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISODate(d);
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function monthLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function isOverdue(obligation: ContributionObligation, nowISO = todayISO()): boolean {
  if (obligation.status === 'paid') return false;
  const graceEnd = addDays(obligation.due_date, obligation.grace_period_days || 0);
  return nowISO > graceEnd;
}

/* ------------------------------------------------------------------ */
/* Demo seed — realistic records that live in the database             */
/* ------------------------------------------------------------------ */

interface SeedMember {
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  status: MembershipStatus;
  paid: number; // total amount they have verified-paid
  pendingSubmission?: number;
}

const SEED_PASSWORD = 'Member123!';
const SEED_ADMIN_PASSWORD = 'Admin123!';

export function buildSeedState(): LocalDbState {
  const state = emptyState();
  state.is_demo_seed = true;

  const now = new Date();
  const createdAt = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90).toISOString();

  const members: SeedMember[] = [
    { name: 'Kofi Asante', email: 'admin@have2022.org', phone: '024 411 2200', role: 'admin', status: 'approved', paid: 400 },
    { name: 'Akosua Frimpong', email: 'treasurer@have2022.org', phone: '020 553 8811', role: 'treasurer', status: 'approved', paid: 300 },
    { name: 'Kwame Mensah', email: 'kwame@example.com', phone: '024 123 4567', role: 'member', status: 'approved', paid: 300 },
    { name: 'Ama Boateng', email: 'ama@example.com', phone: '055 987 6543', role: 'member', status: 'approved', paid: 0 },
    { name: 'Yaw Owusu', email: 'yaw@example.com', phone: '027 334 1122', role: 'member', status: 'approved', paid: 200, pendingSubmission: 100 },
    { name: 'Abena Sarpong', email: 'abena@example.com', phone: '024 665 7788', role: 'member', status: 'approved', paid: 400 },
    { name: 'Kojo Antwi', email: 'kojo@example.com', role: 'member', status: 'approved', paid: 100 },
    { name: 'Efua Adjei', email: 'efua@example.com', phone: '020 118 2244', role: 'member', status: 'approved', paid: 250 },
    { name: 'Nana Yaa Darko', email: 'yaa@example.com', role: 'member', status: 'pending', paid: 0 },
  ];

  const users: LocalUser[] = members.map((m) => ({
    id: newId('usr'),
    email: m.email,
    password_hash: hashPassword(m.role === 'admin' ? SEED_ADMIN_PASSWORD : SEED_PASSWORD),
    full_name: m.name,
    phone: m.phone ?? null,
    avatar_url: null,
    membership_status: m.status,
    role: m.role,
    privacy_accepted_at: createdAt,
    approved_by: null,
    approved_at: m.status === 'approved' ? createdAt : null,
    created_at: createdAt,
    updated_at: createdAt,
  }));
  state.users = users;

  const admin = users[0];

  // Contribution rule: ACTIVE at GH₵100 monthly, starting 4 months ago.
  const startMonthDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const startISO = toISODate(startMonthDate);

  const rule: ContributionRule = {
    id: newId('rule'),
    title: 'Have R/C JHS 2022 Monthly Contribution',
    amount_ghs: 100,
    frequency: 'monthly',
    start_date: startISO,
    due_day: 28,
    grace_period_days: 5,
    is_active: true,
    treasurer_momo_number: '024 411 2200',
    treasurer_momo_name: 'Kofi Asante (Treasurer)',
    updated_by: admin.id,
    created_at: createdAt,
    updated_at: createdAt,
  };
  state.contribution_rules.push(rule);

  // Periods: 4 monthly periods (3 complete + current)
  const periods: ContributionPeriod[] = [];
  for (let i = 0; i < 4; i += 1) {
    const start = addMonths(startISO, i);
    const y = Number(start.slice(0, 4));
    const m = Number(start.slice(5, 7));
    const lastDay = new Date(y, m, 0).getDate();
    const dueDate = `${start.slice(0, 7)}-${`${Math.min(rule.due_day, lastDay)}`.padStart(2, '0')}`;
    periods.push({
      id: newId('per'),
      rule_id: rule.id,
      period_key: monthKey(start),
      period_label: monthLabel(start),
      start_date: start,
      due_date: dueDate,
      grace_period_days: rule.grace_period_days,
      amount_due_ghs: 100,
      created_at: createdAt,
    });
  }
  state.contribution_periods = periods;

  // Obligations for every approved member × every period
  const approvedUsers = users.filter((u) => u.membership_status === 'approved');
  approvedUsers.forEach((u) => {
    periods.forEach((p) => {
      state.obligations.push({
        id: newId('obl'),
        member_id: u.id,
        period_id: p.id,
        period_key: p.period_key,
        period_label: p.period_label,
        due_date: p.due_date,
        grace_period_days: p.grace_period_days,
        amount_due_ghs: p.amount_due_ghs,
        amount_paid_ghs: 0,
        status: 'unpaid',
        is_overdue: false,
        created_at: createdAt,
        updated_at: createdAt,
      });
    });
  });

  // Verified payments that allocate oldest-first, mirroring the live RPC
  members.forEach((seed) => {
    const user = users.find((u) => u.email === seed.email);
    if (!user || seed.paid <= 0) return;
    let remaining = seed.paid;
    // split into 1-2 verified payments for realism
    const chunks: number[] = [];
    if (seed.paid > 100) {
      chunks.push(100);
      remaining -= 100;
      chunks.push(remaining);
    } else {
      chunks.push(seed.paid);
    }
    let dayOffset = 70;
    chunks.forEach((amount) => {
      const paymentDate = addDays(todayISO(), -dayOffset);
      dayOffset -= 28;
      const payment: PaymentSubmission = {
        id: newId('pay'),
        member_id: user.id,
        member_name: user.full_name,
        amount_ghs: roundMoney(amount),
        allocated_amount_ghs: 0,
        unallocated_credit_ghs: 0,
        payment_date: paymentDate,
        payment_method: amount >= 200 ? 'Mobile Money' : 'Cash',
        transaction_reference: user.id === admin.id ? 'MM-8842-REF' : `REF-${Math.floor(Math.random() * 90000 + 10000)}`,
        evidence_attachment_id: null,
        has_evidence: false,
        target_period_id: null,
        notes: 'Verified by treasurer',
        status: 'verified',
        is_offline_entry: true,
        recorded_by: admin.id,
        reviewed_by: admin.id,
        reviewed_by_name: admin.full_name,
        reviewed_at: `${paymentDate}T10:15:00.000Z`,
        rejection_reason: null,
        created_at: `${paymentDate}T10:10:00.000Z`,
        updated_at: `${paymentDate}T10:15:00.000Z`,
      };

      // allocate
      let toAllocate = payment.amount_ghs;
      let allocatedTotal = 0;
      const memberObligations = state.obligations
        .filter((o) => o.member_id === user.id && o.status !== 'paid')
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      memberObligations.forEach((ob) => {
        if (toAllocate <= 0) return;
        const needed = roundMoney(ob.amount_due_ghs - ob.amount_paid_ghs);
        if (needed <= 0) return;
        const alloc = roundMoney(Math.min(toAllocate, needed));
        state.allocations.push({
          id: newId('alc'),
          payment_id: payment.id,
          obligation_id: ob.id,
          member_id: user.id,
          amount_allocated_ghs: alloc,
          created_at: payment.created_at,
        });
        ob.amount_paid_ghs = roundMoney(ob.amount_paid_ghs + alloc);
        ob.status = ob.amount_paid_ghs >= ob.amount_due_ghs ? 'paid' : 'partially_paid';
        ob.updated_at = payment.created_at;
        toAllocate = roundMoney(toAllocate - alloc);
        allocatedTotal = roundMoney(allocatedTotal + alloc);
      });

      payment.allocated_amount_ghs = allocatedTotal;
      payment.unallocated_credit_ghs = roundMoney(toAllocate);
      state.payments.push(payment);

      state.ledger.push({
        id: newId('led'),
        entry_date: payment.payment_date,
        entry_type: 'income',
        category: 'Member Contribution',
        description: `Member contribution verified (${user.full_name})`,
        amount_ghs: payment.amount_ghs,
        signed_amount_ghs: payment.amount_ghs,
        recorded_status: 'Verified',
        source_payment_id: payment.id,
        source_expense_id: null,
        source_adjustment_id: null,
        created_by: admin.id,
        created_at: payment.updated_at,
      });
    });

    if (seed.pendingSubmission) {
      const paymentDate = addDays(todayISO(), -2);
      state.payments.push({
        id: newId('pay'),
        member_id: user.id,
        member_name: user.full_name,
        amount_ghs: roundMoney(seed.pendingSubmission),
        allocated_amount_ghs: 0,
        unallocated_credit_ghs: 0,
        payment_date: paymentDate,
        payment_method: 'Mobile Money',
        transaction_reference: 'MM-556123',
        evidence_attachment_id: null,
        has_evidence: false,
        target_period_id: null,
        notes: 'Sent via MTN MoMo',
        status: 'pending',
        is_offline_entry: false,
        recorded_by: null,
        reviewed_by: null,
        reviewed_by_name: null,
        reviewed_at: null,
        rejection_reason: null,
        created_at: `${paymentDate}T09:00:00.000Z`,
        updated_at: `${paymentDate}T09:00:00.000Z`,
      });
    }
  });

  // Posted expenses (with audit trail)
  const expenseSeeds = [
    {
      title: 'Funeral Support',
      amount: 250,
      reason: "Contribution towards a former classmate's family funeral.",
      category: 'Welfare',
      vendor: 'Mensah Family',
      daysAgo: 40,
    },
    {
      title: 'Printing of Constitution Copies',
      amount: 180,
      reason: 'Printed 60 copies of the association constitution for the general meeting.',
      category: 'Printing',
      vendor: 'Sharp Print Ventures',
      daysAgo: 24,
    },
    {
      title: 'Meeting Refreshment',
      amount: 320,
      reason: 'Water and snacks for the October general meeting at Have.',
      category: 'Meetings',
      vendor: 'Auntie Ama Catering',
      daysAgo: 9,
    },
  ];

  expenseSeeds.forEach((seed, index) => {
    const expenseDate = addDays(todayISO(), -seed.daysAgo);
    const expense: ExpenseRecord = {
      id: newId('exp'),
      title: seed.title,
      amount_ghs: roundMoney(seed.amount),
      effective_amount_ghs: roundMoney(seed.amount),
      reason: seed.reason,
      expense_date: expenseDate,
      category: seed.category,
      vendor_paid: seed.vendor,
      evidence_attachment_id: null,
      has_evidence: index === 0,
      notes: null,
      status: 'posted',
      exceeded_balance_override: false,
      override_reason: null,
      created_by: admin.id,
      created_by_name: admin.full_name,
      created_at: `${expenseDate}T16:30:00.000Z`,
      updated_at: `${expenseDate}T16:30:00.000Z`,
      adjustments: [],
    };
    state.expenses.push(expense);
    state.ledger.push({
      id: newId('led'),
      entry_date: expenseDate,
      entry_type: 'expense',
      category: seed.category,
      description: `Expense: ${seed.title} — ${seed.reason}`,
      amount_ghs: expense.amount_ghs,
      signed_amount_ghs: -expense.amount_ghs,
      recorded_status: 'Posted',
      source_payment_id: null,
      source_expense_id: expense.id,
      source_adjustment_id: null,
      created_by: admin.id,
      created_at: expense.created_at,
    });
  });

  // Audit trail
  const auditSeeds: Array<Omit<AuditLogEntry, 'id'>> = [
    {
      actor_id: admin.id,
      actor_name: admin.full_name,
      action_type: 'SET_CONTRIBUTION_RULE',
      entity_type: 'contribution_rules',
      entity_id: rule.id,
      summary: 'Activated monthly contribution of GH₵100.00 and generated member obligations',
      metadata: { amount_ghs: 100, frequency: 'monthly' },
      created_at: createdAt,
    },
    ...expenseSeeds.map((seed, i) => ({
      actor_id: admin.id,
      actor_name: admin.full_name,
      action_type: 'POST_EXPENSE',
      entity_type: 'expenses',
      entity_id: state.expenses[i].id,
      summary: `Posted group expense "${seed.title}" of GH₵${seed.amount.toFixed(2)}`,
      metadata: { amount_ghs: seed.amount },
      created_at: state.expenses[i].created_at,
    })),
  ];
  state.audit_logs = auditSeeds.map((a) => ({ ...a, id: newId('aud') }));

  // Notifications
  state.notifications = [
    {
      id: newId('ntf'),
      user_id: users[2].id,
      title: 'Contribution Due',
      message: 'Your monthly contribution of GH₵100.00 is due on the 28th. Thank you for supporting the group.',
      type: 'contribution_due',
      is_read: false,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: newId('ntf'),
      user_id: users[2].id,
      title: 'Payment Verified',
      message: 'Your contribution payment of GH₵100.00 has been verified and added to your record.',
      type: 'payment_verified',
      is_read: true,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  ];

  return state;
}

export const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@have2022.org', password: SEED_ADMIN_PASSWORD },
  { label: 'Treasurer', email: 'treasurer@have2022.org', password: SEED_PASSWORD },
  { label: 'Member (paid)', email: 'kwame@example.com', password: SEED_PASSWORD },
  { label: 'Member (unpaid)', email: 'ama@example.com', password: SEED_PASSWORD },
  { label: 'Pending member', email: 'yaa@example.com', password: SEED_PASSWORD },
];
