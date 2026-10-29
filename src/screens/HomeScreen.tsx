import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  Info,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  EmptyState,
  InfoNote,
  MiniStat,
  SectionHeader,
  StatCard,
  StatusPill,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import {
  getContributionRule,
  getGroupSummary,
  getMyComputation,
  getNotifications,
  getRecentActivity,
} from '../services/databaseService';
import { formatDateShort, formatGHS, formatSignedGHS } from '../utils/formatters';
import type {
  ContributionRule,
  GroupFinancialSummary,
  RecentActivityItem,
} from '../types/database';
import type { MemberComputation } from '../services/calculations';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const { session, navigate, switchTab } = useApp();
  const summary = useServiceData<GroupFinancialSummary>(() => getGroupSummary());
  const mine = useServiceData<MemberComputation | null>(() => getMyComputation());
  const rule = useServiceData<ContributionRule | null>(() => getContributionRule());
  const activity = useServiceData<RecentActivityItem[]>(() => getRecentActivity(6));
  const notifications = useServiceData(() => getNotifications());

  const unread = useMemo(
    () => (notifications.data ?? []).filter((n) => !n.is_read).length,
    [notifications.data]
  );

  const firstName = session?.profile.full_name.split(' ')[0] ?? 'Member';
  const s = summary.data;
  const m = mine.data;
  const r = rule.data;
  const scheduleActive = Boolean(r?.is_active && r.amount_ghs !== null);
  const personalReminder =
    m && scheduleActive && m.outstanding > 0
      ? `Your outstanding balance is ${formatGHS(m.outstanding)} for ${m.relevant_period_label}. Please contact the treasurer once you have paid.`
      : null;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="rounded-b-3xl bg-navy-900 px-4 pb-5 pt-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-400">
              Have R/C JHS 2022
            </p>
            <h1 className="mt-0.5 truncate text-[19px] font-extrabold leading-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-[12px] text-navy-200">Old Students Contribution & Group Fund</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('notifications')}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 active:scale-95"
          >
            <Bell size={19} />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9.5px] font-extrabold text-navy-950">
                {unread}
              </span>
            ) : null}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-200">
              Recorded group balance
            </p>
            <p className="money mt-0.5 text-[24px] font-extrabold leading-tight">
              {formatGHS(s?.current_recorded_balance_ghs ?? 0)}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-navy-950">
            <Wallet size={19} />
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-navy-300">
          Based on verified contributions and posted expenses only. This is a record of the fund, not a
          bank or Mobile Money balance.
        </p>
      </header>

      <div className="px-4 pt-4">
        {/* Personal reminder */}
        {personalReminder ? (
          <div className="mb-3">
            <Alert tone="warning" title="Contribution reminder">
              {personalReminder}
            </Alert>
          </div>
        ) : null}

        {!scheduleActive ? (
          <div className="mb-3">
            <Alert tone="info" title="Contribution schedule not yet available">
              The group has not yet set the contribution amount. No one has been charged yet. Once the
              treasurer activates the agreed amount, your schedule and balance will appear here.
            </Alert>
          </div>
        ) : null}

        {/* Group financial summary */}
        <SectionHeader
          title="Group financial summary"
          caption="Calculated live from verified records"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Total Contributions"
            value={formatGHS(s?.total_verified_contributions_ghs ?? 0)}
            hint="Verified payments only"
            icon={<HandCoins size={16} />}
            tone="green"
            onClick={() => switchTab('contributions')}
          />
          <StatCard
            label="Total Expenses"
            value={formatGHS(s?.total_posted_expenses_ghs ?? 0)}
            hint="Posted expenses"
            icon={<TrendingDown size={16} />}
            tone="red"
            onClick={() => switchTab('fund')}
          />
          <StatCard
            label="Current Group Balance"
            value={formatGHS(s?.current_recorded_balance_ghs ?? 0)}
            hint="Income − expenses"
            icon={<Wallet size={16} />}
            tone="navy"
            onClick={() => switchTab('fund')}
          />
          <StatCard
            label="Members Yet to Pay"
            value={`${s?.members_yet_to_pay_count ?? 0}`}
            hint={`of ${s?.approved_members_count ?? 0} approved members`}
            icon={<Users size={16} />}
            tone="gold"
            onClick={() => switchTab('members')}
          />
        </div>

        {/* Personal summary */}
        <div className="mt-5">
          <SectionHeader
            title="My contribution summary"
            caption={scheduleActive ? (r?.title ?? '') : 'Schedule not set yet'}
          />
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={session?.profile.full_name ?? 'Member'} src={session?.profile.avatar_url} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-navy-950">
                    {session?.profile.full_name}
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    {m?.has_schedule
                      ? `${m.periods_fully_paid} of ${m.periods_fully_paid + m.periods_partially_paid + m.periods_not_yet_paid} periods fully paid`
                      : 'No periods scheduled yet'}
                  </p>
                </div>
              </div>
              <StatusPill status={m?.status_label ?? 'Schedule Not Set'} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="My Total Paid" value={formatGHS(m?.total_verified_paid ?? 0)} tone="text-[#137447]" />
              <MiniStat
                label="My Outstanding"
                value={formatGHS(m?.outstanding ?? 0)}
                tone={(m?.outstanding ?? 0) > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}
              />
              <MiniStat
                label="My Latest Payment"
                value={
                  m?.latest_verified_amount != null
                    ? formatGHS(m.latest_verified_amount)
                    : 'No payment yet'
                }
              />
              <MiniStat
                label="Latest Payment Date"
                value={m?.latest_verified_date ? formatDateShort(m.latest_verified_date) : '—'}
              />
            </div>

            <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500">
              <CalendarClock size={13} className="mt-0.5 shrink-0 text-navy-400" />
              {m?.has_schedule
                ? `Relevant period: ${m.relevant_period_label}. ${m.pending_count > 0 ? `You have ${m.pending_count} payment awaiting verification.` : 'Payments count once the treasurer verifies them.'}`
                : 'Your payment schedule will appear as soon as the contribution amount is set and activated.'}
            </p>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => navigate('submit-payment')} className="btn-gold flex-1" data-testid="home-submit-payment">
                <CircleDollarSign size={16} />
                Submit payment
              </button>
              <button type="button" onClick={() => switchTab('contributions')} className="btn-outline flex-1">
                My records
              </button>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="mt-5">
          <SectionHeader
            title="Recent activity"
            caption="Privacy-safe group updates"
            action={
              <button
                type="button"
                onClick={() => navigate('financial-history')}
                className="flex items-center gap-0.5 text-[12.5px] font-bold text-navy-700"
              >
                See all <ArrowRight size={14} />
              </button>
            }
          />
          <div className="card-flat overflow-hidden bg-white">
            {(activity.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Info size={22} />}
                title="No activity yet"
                description="Verified contributions and posted expenses will appear here in date order."
              />
            ) : (
              <ul>
                {(activity.data ?? []).map((item) => (
                  <li key={item.id} className="list-row">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        item.is_positive === true
                          ? 'bg-[#E4F6EC] text-[#137447]'
                          : item.is_positive === false
                            ? 'bg-[#FDECEC] text-[#A82B2B]'
                            : 'bg-navy-50 text-navy-600'
                      }`}
                    >
                      {item.is_positive === true ? (
                        <ArrowDownLeft size={16} />
                      ) : item.is_positive === false ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <BadgeCheck size={16} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-navy-950">{item.title}</p>
                      <p className="line-clamp-2 text-[11.5px] leading-snug text-slate-500">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
                        {item.date_label}
                      </p>
                    </div>
                    {item.amount_ghs != null ? (
                      <span
                        className={`money shrink-0 text-[13px] font-extrabold ${
                          item.is_positive ? 'text-[#137447]' : 'text-[#A82B2B]'
                        }`}
                      >
                        {item.is_positive ? '+' : '−'}
                        {formatGHS(item.amount_ghs)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-2">
            <InfoNote>
              Activity entries never show receipts, transaction references or private contact details.
            </InfoNote>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#E8EEF7] bg-white p-3.5">
          <p className="text-[12.5px] font-bold text-navy-950">How the balance is worked out</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Current Recorded Balance = Total Recorded Income − Total Posted Expenses − Other Recorded
            Outflows. Pending payments are never counted, and each expense is subtracted exactly once.
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
            Last calculated: {formatDateShort(new Date().toISOString())} · Signed amounts:{' '}
            <span className="money">{formatSignedGHS(s?.current_recorded_balance_ghs ?? 0)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
