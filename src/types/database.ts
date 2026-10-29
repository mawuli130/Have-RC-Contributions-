export type MembershipStatus = 'pending' | 'approved' | 'rejected';
export type AppRole = 'member' | 'treasurer' | 'admin';
export type PaymentFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'one_time';
export type ObligationStatus = 'unpaid' | 'partially_paid' | 'paid';
export type PaymentSubmissionStatus = 'pending' | 'verified' | 'rejected';
export type ExpenseStatus = 'posted' | 'adjusted' | 'reversed';
export type LedgerEntryType =
  | 'income'
  | 'other_income'
  | 'expense'
  | 'expense_reversal'
  | 'expense_adjustment';

export type PublicPaymentStatusLabel =
  | 'Paid'
  | 'Partially Paid'
  | 'Not Yet Paid'
  | 'Pending Verification'
  | 'Overdue'
  | 'Rejected'
  | 'Schedule Not Set';

export interface Profile {
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

export interface UserRoleRecord {
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  assigned_at: string;
}

export interface AuthenticatedUser {
  profile: Profile;
  role: AppRole;
}

export interface ContributionRule {
  id: string;
  title: string;
  amount_ghs: number | null; // Null when unset!
  frequency: PaymentFrequency;
  start_date: string | null;
  due_day: number;
  grace_period_days: number;
  is_active: boolean;
  treasurer_momo_number: string;
  treasurer_momo_name: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributionPeriod {
  id: string;
  rule_id: string;
  period_key: string;
  period_label: string;
  start_date: string;
  due_date: string;
  grace_period_days: number;
  amount_due_ghs: number;
  created_at: string;
}

export interface ContributionObligation {
  id: string;
  member_id: string;
  period_id: string;
  period_key: string;
  period_label: string;
  due_date: string;
  grace_period_days: number;
  amount_due_ghs: number;
  amount_paid_ghs: number;
  status: ObligationStatus;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileAttachment {
  id: string;
  owner_id: string;
  scope: 'payment_evidence' | 'expense_evidence' | 'avatar';
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  data_url: string;
  created_at: string;
}

export interface PaymentSubmission {
  id: string;
  member_id: string;
  member_name: string;
  amount_ghs: number;
  allocated_amount_ghs: number;
  unallocated_credit_ghs: number;
  payment_date: string;
  payment_method: string;
  transaction_reference: string | null;
  evidence_attachment_id: string | null;
  has_evidence: boolean;
  target_period_id: string | null;
  notes: string | null;
  status: PaymentSubmissionStatus;
  is_offline_entry: boolean;
  recorded_by: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  obligation_id: string;
  member_id: string;
  amount_allocated_ghs: number;
  created_at: string;
}

export interface ExpenseAdjustment {
  id: string;
  expense_id: string;
  adjustment_type: 'reversal' | 'amount_adjustment';
  previous_amount_ghs: number;
  new_amount_ghs: number;
  delta_ghs: number;
  reason: string;
  adjusted_by: string;
  adjusted_by_name: string;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  amount_ghs: number;
  effective_amount_ghs: number;
  reason: string;
  expense_date: string;
  category: string;
  vendor_paid: string | null;
  evidence_attachment_id: string | null;
  has_evidence: boolean;
  notes: string | null;
  status: ExpenseStatus;
  exceeded_balance_override: boolean;
  override_reason: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  adjustments: ExpenseAdjustment[];
}

export interface FinancialLedgerEntry {
  id: string;
  entry_date: string;
  entry_type: LedgerEntryType;
  category: string;
  description: string;
  amount_ghs: number;
  signed_amount_ghs: number;
  recorded_status: 'Verified' | 'Posted' | 'Reversed' | 'Adjusted';
  source_payment_id: string | null;
  source_expense_id: string | null;
  source_adjustment_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type:
    | 'membership_approved'
    | 'payment_submitted'
    | 'payment_verified'
    | 'payment_rejected'
    | 'contribution_due'
    | 'outstanding_reminder'
    | 'expense_recorded'
    | 'system';
  is_read: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Shared public-safe member payment status record visible to approved members.
 * Deliberately omits private transaction_reference, receipt screenshots, email, and admin notes.
 */
export interface PublicMemberPaymentSummary {
  member_id: string;
  full_name: string;
  avatar_url: string | null;
  membership_status: MembershipStatus;
  role: AppRole;
  total_due_ghs: number;
  total_verified_paid_ghs: number;
  outstanding_amount_ghs: number;
  unallocated_credit_ghs: number;
  periods_fully_paid: number;
  periods_partially_paid: number;
  periods_not_yet_paid: number;
  overdue_periods_count: number;
  pending_submissions_count: number;
  pending_amount_ghs: number;
  latest_verified_payment_date: string | null;
  latest_verified_payment_amount_ghs: number | null;
  payment_status: PublicPaymentStatusLabel;
  relevant_period_label: string;
}

export interface GroupFinancialSummary {
  total_verified_contributions_ghs: number;
  other_recorded_income_ghs: number;
  total_recorded_income_ghs: number;
  total_posted_expenses_ghs: number;
  other_recorded_outflows_ghs: number;
  current_recorded_balance_ghs: number;
  approved_members_count: number;
  pending_members_count: number;
  members_yet_to_pay_count: number;
  members_fully_paid_count: number;
  members_partially_paid_count: number;
  members_overdue_count: number;
  pending_payment_submissions_count: number;
  is_contribution_rule_active: boolean;
}

export interface RecentActivityItem {
  id: string;
  timestamp: string;
  date_label: string;
  type: 'contribution_verified' | 'expense_recorded' | 'expense_adjusted' | 'payment_rejected' | 'rule_updated' | 'member_approved';
  title: string;
  description: string;
  amount_ghs: number | null;
  is_positive: boolean | null;
}
