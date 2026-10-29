import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ClipboardCheck,
  Download,
  FileText,
  HandCoins,
  History,
  Settings2,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { EmptyState, SectionHeader, StatCard, StatusPill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { getAdminMemberRows, getGroupSummary, getPendingPayments, getRecentActivity } from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import type { GroupFinancialSummary, PaymentSubmission, RecentActivityItem } from '../../types/database';
import type { AdminMemberRow } from '../../services/databaseService';

export function AdminDashboardScreen() {
  const { navigate, session } = useApp();
  const summary = useServiceData<GroupFinancialSummary>(() => getGroupSummary());
  const pending = useServiceData<PaymentSubmission[]>(() => getPendingPayments());
  const members = useServiceData<AdminMemberRow[]>(() => getAdminMemberRows());
  const activity = useServiceData<RecentActivityItem[]>(() => getRecentActivity(5));

  const s = summary.data;
  const pendingMembers = (members.data ?? []).filter((m) => m.membership_status === 'pending');

  const menu = [
    { icon: <Users size={17} />, label: 'Manage Members', desc: 'Approve new members and set roles', screen: 'admin-members' as const, badge: pendingMembers.length },
    { icon: <Settings2 size={17} />, label: 'Contribution Settings', desc: 'Amount, frequency, due day, activate', screen: 'admin-contribution-settings' as const },
    { icon: <ClipboardCheck size={17} />, label: 'Review Payments', desc: 'Verify or reject submissions', screen: 'admin-review-payments' as const, badge: (pending.data ?? []).length },
    { icon: <Bell size={17} />, label: 'Outstanding Members', desc: 'Balances and WhatsApp reminders', screen: 'admin-outstanding' as const },
    { icon: <HandCoins size={17} />, label: 'Add Expense', desc: 'Record spending with evidence', screen: 'admin-add-expense' as const },
    { icon: <FileText size={17} />, label: 'Expense History', desc: 'Review, correct or reverse', screen: 'admin-expense-history' as const },
    { icon: <Download size={17} />, label: 'Financial Reports', desc: 'Summary figures and CSV exports', screen: 'admin-reports' as const },
    { icon: <History size={17} />, label: 'Admin Activity Log', desc: 'Every admin action, dated', screen: 'admin-audit-log' as const },
  ];

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 border-b border-[#E8EEF7] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 text-navy-950">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h1 className="text-[17px] font-extrabold leading-tight text-navy-950">Admin Portal</h1>
            <p className="text-[11.5px] leading-tight text-slate-500">
              {session?.role === 'admin' ? 'Administrator' : 'Treasurer'} · {session?.profile.full_name}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard label="Approved Members" value={`${s?.approved_members_count ?? 0}`} hint={`${pendingMembers.length} awaiting approval`} icon={<UserCheck size={16} />} tone="navy" onClick={() => navigate('admin-members')} />
          <StatCard label="Verified Contributions" value={formatGHS(s?.total_verified_contributions_ghs ?? 0)} hint="From verified payments" icon={<HandCoins size={16} />} tone="green" onClick={() => navigate('admin-reports')} />
          <StatCard label="Posted Expenses" value={formatGHS(s?.total_posted_expenses_ghs ?? 0)} hint="All posted expenses" icon={<TrendingDown size={16} />} tone="red" onClick={() => navigate('admin-expense-history')} />
          <StatCard label="Recorded Balance" value={formatGHS(s?.current_recorded_balance_ghs ?? 0)} hint="Income − expenses" icon={<Wallet size={16} />} tone="gold" onClick={() => navigate('admin-reports')} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => navigate('admin-outstanding')} className="card text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Outstanding members</p>
            <p className="mt-1 text-[20px] font-extrabold text-navy-950">{s?.members_yet_to_pay_count ?? 0}</p>
            <p className="text-[11px] text-slate-500">{s?.members_overdue_count ?? 0} overdue</p>
          </button>
          <button type="button" onClick={() => navigate('admin-review-payments')} className="card text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pending payments</p>
            <p className="mt-1 text-[20px] font-extrabold text-navy-950">{s?.pending_payment_submissions_count ?? 0}</p>
            <p className="text-[11px] text-slate-500">Waiting for verification</p>
          </button>
        </div>

        {pendingMembers.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-[#EFE0BC] bg-[#FFFBF0] p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#8A5A08]">
              <AlertTriangle size={14} /> {pendingMembers.length} member{pendingMembers.length === 1 ? '' : 's'} awaiting approval
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#7A5A20]">
              They cannot see group finances until approved. {pendingMembers.map((p) => p.full_name).join(', ')}
            </p>
            <button type="button" onClick={() => navigate('admin-members')} className="btn-outline btn-sm mt-2 bg-white">
              Review members <ArrowRight size={13} />
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          <SectionHeader title="Admin menu" caption="Each tool does one job" />
          <div className="card-flat overflow-hidden bg-white">
            {menu.map((m) => (
              <button key={m.label} type="button" onClick={() => navigate(m.screen)} className="list-row" data-testid={`admin-menu-${m.screen}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-[#8A5A08]">{m.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-navy-950">{m.label}</p>
                  <p className="truncate text-[11.5px] text-slate-500">{m.desc}</p>
                </div>
                {m.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B8392F] px-1.5 text-[10.5px] font-bold text-white">
                    {m.badge}
                  </span>
                ) : null}
                <ArrowRight size={16} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <SectionHeader title="Recent financial activity" />
          <div className="card-flat overflow-hidden bg-white">
            {(activity.data ?? []).length === 0 ? (
              <EmptyState icon={<History size={20} />} title="No activity yet" description="Verified payments and posted expenses will appear here." />
            ) : (
              (activity.data ?? []).map((a) => (
                <div key={a.id} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-navy-950">{a.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{a.date_label}</p>
                  </div>
                  {a.amount_ghs != null ? (
                    <span className={`money shrink-0 text-[12.5px] font-extrabold ${a.is_positive ? 'text-[#137447]' : 'text-[#A82B2B]'}`}>
                      {a.is_positive ? '+' : '−'}{formatGHS(a.amount_ghs)}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-[#E8EEF7] bg-white p-3.5">
          <p className="text-[12px] font-bold text-navy-950">Treasurer reminders</p>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-slate-500">
            <li>• Verify payments the same day whenever you can — members see the change immediately.</li>
            <li>• Attach a receipt to every expense; members trust what they can check.</li>
            <li>• Never delete a wrong entry — correct or reverse it with a reason.</li>
            <li>• Last app check: {formatDateShort(new Date().toISOString())}</li>
          </ul>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <StatusPill status="Schedule Not Set" />
          <span>shown when no contribution rule is active</span>
        </div>
      </div>
    </div>
  );
}
