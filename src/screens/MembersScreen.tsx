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
  { key: 'all', label: 'All Members' },
  { key: 'paid', label: 'Fully Paid' },
  { key: 'partial', label: 'Partially Paid' },
  { key: 'unpaid', label: 'Not Yet Paid' },
  { key: 'overdue', label: 'Overdue' },
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
      <header className="sticky top-0 z-30 border-b border-[#E8EEF7] bg-white/95 px-4 pb-2.5 pt-3 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-[17px] font-extrabold text-navy-950">Members</h1>
            <p className="text-[12px] text-slate-500">
              {counts.all} approved · {counts.paid} fully paid · {counts.outstanding} with a balance
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
            <Users size={17} />
          </span>
        </div>

        <div className="relative mt-2.5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search member by name"
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
                  ? 'border-navy-900 bg-navy-900 text-white'
                  : 'border-[#D8E2F0] bg-white text-navy-700'
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
              description="Try another filter or clear the search box to see everyone again."
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
                          <p className="text-[11.5px] text-slate-500">{m.relevant_period_label}</p>
                        </div>
                        <StatusPill status={m.payment_status} />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-[#F2FBF6] px-2.5 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#137447]">Paid</p>
                          <p className="money text-[13.5px] font-extrabold text-[#137447]">
                            {formatGHS(m.total_verified_paid_ghs)}
                          </p>
                        </div>
                        <div className={`rounded-lg px-2.5 py-1.5 ${m.outstanding_amount_ghs > 0 ? 'bg-[#FDF1F1]' : 'bg-[#F2FBF6]'}`}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${m.outstanding_amount_ghs > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}`}>
                            Outstanding
                          </p>
                          <p className={`money text-[13.5px] font-extrabold ${m.outstanding_amount_ghs > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}`}>
                            {formatGHS(m.outstanding_amount_ghs)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EDF2F9]">
                        <div
                          className={`h-full rounded-full ${percent >= 100 ? 'bg-[#1E9E63]' : percent > 0 ? 'bg-gold-500' : 'bg-[#D8E2F0]'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">
                          {m.periods_fully_paid} paid · {m.periods_partially_paid} partial ·{' '}
                          {m.periods_not_yet_paid} unpaid
                          {m.pending_submissions_count > 0 ? ` · ${m.pending_submissions_count} pending` : ''}
                        </p>
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

        <div className="mt-4 rounded-2xl border border-[#E3D2A8] bg-[#FFFBF0] p-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#8A5A08]">
            <ShieldCheck size={15} /> Why this page is shared
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#7A5A20]">
            Group transparency helps everyone see the true state of contributions. Only the figures
            needed for transparency are shown — never receipts, references, phone numbers or private
            notes. Labels are factual: &ldquo;Outstanding&rdquo; or &ldquo;Not Yet Paid&rdquo;, never a judgement about a person.
          </p>
        </div>

        <div className="mt-3">
          <InfoNote>
            Statuses update automatically the moment a treasurer verifies a payment. Pending
            submissions are shown separately and are not counted as paid.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
