import React, { useMemo } from 'react';
import { ArrowRight, BadgeCheck, Bell, CalendarClock, CircleDollarSign } from 'lucide-react';
import { Avatar } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import {
  getContributionRule,
  getCurrentWeekOutstanding,
  getGroupSummary,
  getMyComputation,
  getMyObligations,
  getNotifications,
} from '../services/databaseService';
import { Crest } from '../components/Crest';
import { formatDateShort, formatGHS } from '../utils/formatters';
import type { ContributionRule, GroupFinancialSummary } from '../types/database';
import type { MemberComputation } from '../services/calculations';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Compact dashboard — fits one Android screen (360×800) with the fixed
 * bottom navigation. No page scroll: header, identity, 4 tiles, 2 actions,
 * and a max-3 preview of who missed this week.
 */
export function HomeScreen() {
  const { session, navigate, switchTab } = useApp();
  const summary = useServiceData<GroupFinancialSummary>(() => getGroupSummary());
  const mine = useServiceData<MemberComputation | null>(() => getMyComputation());
  const rule = useServiceData<ContributionRule | null>(() => getContributionRule());
  const obligations = useServiceData(() => getMyObligations());
  const week = useServiceData(() => getCurrentWeekOutstanding());
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
  const nextDue = (obligations.data ?? []).find((o) => o.status !== 'paid');
  const thisWeekPaid = scheduleActive && (m?.current_period_outstanding_ghs ?? 1) <= 0;
  const statusText = !scheduleActive
    ? '—'
    : m?.status_label === 'Not Yet Paid'
      ? 'Not Paid'
      : (m?.status_label ?? '—');
  const missedCount = m ? m.periods_partially_paid + m.periods_not_yet_paid : 0;
  const outstandingPeople = week.data?.members ?? [];

  return (
    <div className="app-shell app-fixed flex flex-col" data-testid="home-screen">
      {/* Compact navy header */}
      <header className="shrink-0 bg-navy-900 px-4 pb-3 pt-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Crest size={28} />
            <p className="truncate text-[13px] font-extrabold leading-tight">Have R/C JHS 2022</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('notifications')}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 active:scale-95"
          >
            <Bell size={17} />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-extrabold text-navy-950">
                {unread}
              </span>
            ) : null}
          </button>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
              Recorded group balance
            </p>
            <p className="money text-[20px] font-extrabold leading-tight">
              {formatGHS(s?.current_recorded_balance_ghs ?? 0)}
            </p>
          </div>
          {scheduleActive ? (
            <p className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-gold-400">
              {formatGHS(r?.amount_ghs ?? 0, false)} / {r?.frequency === 'weekly' ? 'week' : 'period'}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        <p className="shrink-0 truncate text-[17px] font-extrabold text-navy-950">
          {greeting()}, {firstName} <span aria-hidden>👋</span>
        </p>

        {/* Identity */}
        <div className="mt-2 flex shrink-0 items-center gap-2.5 rounded-[18px] border border-[#E3ECF7] bg-white p-2.5 shadow-card">
          <Avatar name={session?.profile.full_name ?? 'Member'} src={session?.profile.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold leading-tight text-navy-950">
              {session?.profile.full_name}
            </p>
            <p className="text-[11px] leading-tight text-slate-500">
              {session?.role === 'admin' ? 'Admin' : session?.role === 'treasurer' ? 'Treasurer' : 'Member'}
              {m?.current_period_label ? ` · ${m.current_period_label.split('·')[0]}` : ''}
            </p>
          </div>
          <span className={`pill shrink-0 ${thisWeekPaid ? 'pill-paid' : 'pill-partial'}`}>
            {scheduleActive ? (thisWeekPaid ? 'Paid' : 'Not paid') : '—'}
          </span>
        </div>

        {!scheduleActive ? (
          <p className="mt-2 shrink-0 rounded-[18px] bg-navy-50 px-3 py-2.5 text-[13px] font-semibold text-navy-800">
            Schedule not yet available.
          </p>
        ) : null}

        {/* 4 compact tiles */}
        <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2">
          <div className="rounded-[18px] bg-[#1E9E63] p-2.5 text-white shadow-card">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
              <CircleDollarSign size={12} /> Total Paid
            </p>
            <p className="money mt-0.5 truncate text-[19px] font-extrabold leading-tight">
              {formatGHS(m?.total_verified_paid ?? 0)}
            </p>
            <p className="text-[10px] leading-tight text-white/85">{m?.periods_fully_paid ?? 0} paid</p>
          </div>
          <div className="rounded-[18px] bg-[#F59E0B] p-2.5 text-white shadow-card">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/90">
              <CalendarClock size={12} /> Outstanding
            </p>
            <p className="money mt-0.5 truncate text-[19px] font-extrabold leading-tight">
              {formatGHS(m?.overdue_outstanding_ghs ?? 0)}
            </p>
            <p className="text-[10px] leading-tight text-white/90">{missedCount} missed</p>
          </div>
          <div className="rounded-[18px] border border-[#E3ECF7] bg-white p-2.5 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Next Due Date</p>
            <p className="mt-0.5 truncate text-[16px] font-extrabold leading-tight text-navy-950">
              {nextDue ? formatDateShort(nextDue.due_date) : scheduleActive ? 'Paid up' : '—'}
            </p>
            <p className="truncate text-[10px] leading-tight text-slate-500">
              {nextDue ? nextDue.period_label.split('·')[0] : ' '}
            </p>
          </div>
          <div className="rounded-[18px] bg-[#7C3AED] p-2.5 text-white shadow-card">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
              <BadgeCheck size={12} /> Payment Status
            </p>
            <p className="mt-0.5 truncate text-[16px] font-extrabold leading-tight">{statusText}</p>
            <p className="truncate text-[10px] leading-tight text-white/85">
              {m?.current_period_label?.split('·')[0] ?? ' '}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('submit-payment')}
            className="btn-primary min-h-[48px]"
            data-testid="home-submit-payment"
          >
            <CircleDollarSign size={17} /> Submit Payment
          </button>
          <button
            type="button"
            onClick={() => navigate('payment-history')}
            className="btn min-h-[48px] border border-[#D8E2F0] bg-[#EAF1FB] font-bold text-navy-800"
          >
            Payment History
          </button>
        </div>

        {/* Who missed this week — preview only (full list in Members) */}
        {scheduleActive ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3">
              <h2 className="truncate text-[15px] font-bold text-navy-950">
                {week.data?.is_ended ? 'Outstanding' : 'Not paid'} ·{' '}
                {week.data?.period_label?.split('·')[0]?.trim() ?? 'This week'}
              </h2>
              <button
                type="button"
                onClick={() => switchTab('members')}
                className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-navy-700"
              >
                See all <ArrowRight size={13} />
              </button>
            </div>
            <div className="card-flat shrink-0 overflow-hidden bg-white">
              {outstandingPeople.length === 0 ? (
                <p className="px-4 py-3 text-[13px] font-bold text-[#137447]">All paid ✓</p>
              ) : (
                <ul>
                  {outstandingPeople.slice(0, 3).map((person) => (
                    <li key={person.member_id}>
                      <button
                        type="button"
                        onClick={() => navigate('member-detail', { id: person.member_id })}
                        className="flex w-full items-center gap-2.5 border-b border-[#EDF2F9] px-3 py-2 text-left last:border-b-0"
                      >
                        <Avatar name={person.full_name} src={person.avatar_url} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-navy-950">
                            {person.full_name}
                          </span>
                          <span className="block text-[10.5px] leading-tight text-slate-500">
                            Ends {formatDateShort(week.data?.due_date)}
                          </span>
                        </span>
                        <span className="money shrink-0 text-[13px] font-extrabold text-[#A82B2B]">
                          {formatGHS(person.outstanding_ghs)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
