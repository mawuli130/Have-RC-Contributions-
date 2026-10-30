import React, { useMemo, useState } from 'react';
import { Eye, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import {
  Alert,
  Avatar,
  EmptyState,
  InfoNote,
  SectionHeader,
  StatusPill,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getPublicMembers } from '../services/databaseService';
import { formatGHS } from '../utils/formatters';
import type { PublicMemberPaymentSummary, PublicPaymentStatusLabel } from '../types/database';

type Filter = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'partial', label: 'Partial' },
  { key: 'unpaid', label: 'Not Paid' },
  { key: 'overdue', label: 'Outstanding' },
];

export function MembersScreen() {
  const { navigate, session } = useApp();
  const members = useServiceData<PublicMemberPaymentSummary[]>(() => getPublicMembers());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = members.data ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((m) => {
      if (q && !m.full_name.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'paid':
          return m.payment_status === 'Paid';
        case 'partial':
          return m.payment_status === 'Partially Paid' || m.payment_status === 'Pending Verification';
        case 'unpaid':
          return m.payment_status === 'Not Yet Paid' || m.payment_status === 'Schedule Not Set';
        case 'overdue':
          return m.overdue_periods_count > 0;
        default:
          return true;
      }
    });
  }, [members.data, filter, query]);

  const counts = useMemo(() => {
    const list = members.data ?? [];
    return {
      all: list.length,
      paid: list.filter((m) => m.payment_status === 'Paid').length,
      outstanding: list.filter((m) => m.outstanding_amount_ghs > 0).length,
    };
  }, [members.data]);

  if (members.error) {
    return (
      <div className="app-shell px-4 pt-4">
        <Alert tone="error" title="Members are not available">
          {members.error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-navy-900 px-4 pb-3 pt-3.5 text-white shadow-pop">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-[17px] font-extrabold">Members</h1>
            <p className="text-[12px] text-navy-200">
              {counts.all} approved · {counts.paid} fully paid · {counts.outstanding} with a balance
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-gold-400">
            <Users size={17} />
          </span>
        </div>

        <div className="relative mt-2.5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input border-0 pl-9"
            placeholder="Search members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search members by name"
            data-testid="member-search"
          />
        </div>

        <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}`}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                filter === f.key
                  ? 'border-gold-500 bg-gold-500 text-navy-950'
                  : 'border-white/0 bg-white text-navy-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-3">
        {filtered.length === 0 ? (
          <div className="card-flat bg-white">
            <EmptyState
              icon={<SlidersHorizontal size={22} />}
              title="No members match this view"
              description="No match."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setQuery('');
                  }}
                  className="btn-outline"
                >
                  Show all members
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => {
              const isMe = m.member_id === session?.profile.id;
              const percent =
                m.total_due_ghs > 0 ? Math.min(100, Math.round((m.total_verified_paid_ghs / m.total_due_ghs) * 100)) : 0;
              return (
                <div key={m.member_id} className="card">
                  <div className="flex items-start gap-3">
                    <Avatar name={m.full_name} src={m.avatar_url} size={44} ring={isMe} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-navy-950">
                            {m.full_name}
                            {isMe ? <span className="ml-1 text-[11px] font-semibold text-navy-500">(you)</span> : null}
                          </p>
                          <p className="text-[11.5px] text-slate-500">
                            {m.current_period_label} · {m.current_period_outstanding_ghs > 0 ? `${formatGHS(m.current_period_outstanding_ghs)} to pay` : 'Paid'}
                            {m.overdue_outstanding_ghs > 0 ? ` · ${formatGHS(m.overdue_outstanding_ghs)} outstanding` : ''}
                          </p>
                        </div>
                        <StatusPill status={m.payment_status} />
                      </div>

                      <p className="money mt-1 text-[12.5px] font-bold text-slate-600">
                        {formatGHS(m.total_verified_paid_ghs, false)} <span className="font-medium text-slate-400">/ {formatGHS(m.total_due_ghs, false)}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {m.periods_fully_paid} paid · {m.periods_partially_paid + m.periods_not_yet_paid} due
                        {m.outstanding_amount_ghs > 0 ? ` · ${formatGHS(m.outstanding_amount_ghs)} outstanding` : ''}
                        {m.pending_submissions_count > 0 ? ` · ${m.pending_submissions_count} pending` : ''}
                      </p>

                      <div className="mt-1.5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate('member-detail', { id: m.member_id })}
                          className="flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-navy-700"
                        >
                          <Eye size={13} /> View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
