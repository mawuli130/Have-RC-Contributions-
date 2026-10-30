import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, MessageCircle, Search, Send, Users } from 'lucide-react';
import {
  Alert,
  Avatar,
  EmptyState,
  InfoNote,
  ScreenHeader,
  SectionHeader,
  Sheet,
  SimplePill,
} from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import {
  ServiceError,
  buildReminder,
  getOutstandingMembers,
  getPeriodOptions,
  sendInAppReminder,
  type OutstandingRow,
} from '../../services/databaseService';
import { formatGHS } from '../../utils/formatters';

export function OutstandingMembersScreen() {
  const { goBack, toast, refresh } = useApp();
  const periods = useServiceData(() => getPeriodOptions());
  const [periodFilter, setPeriodFilter] = useState('all');
  const [query, setQuery] = useState('');
  const rows = useServiceData<OutstandingRow[]>(() => getOutstandingMembers(periodFilter === 'all' ? undefined : periodFilter), [periodFilter]);
  const [target, setTarget] = useState<OutstandingRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows.data ?? []).filter((r) => (q ? r.full_name.toLowerCase().includes(q) : true));
  }, [rows.data, query]);

  const totalOutstanding = (rows.data ?? []).reduce((s, r) => s + r.outstanding, 0);

  const openReminder = (row: OutstandingRow) => setTarget(row);

  const reminder = target
    ? buildReminder(target.phone, target.full_name, target.outstanding, target.relevant_period_label)
    : null;

  const sendInApp = () => {
    if (!target) return;
    try {
      sendInAppReminder(target.member_id, target.outstanding, target.relevant_period_label);
      toast.success(`Reminder sent to ${target.full_name} inside the app.`);
      setTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'The reminder could not be sent.');
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Reminders" subtitle="Outstanding Members · Send a friendly reminder" onBack={goBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-[#F3D9A8] bg-[#FFF6E6] p-3.5">
          <Bell size={16} className="mt-0.5 shrink-0 text-[#9A5B06]" />
          <p className="text-[12.5px] leading-relaxed text-[#7A5A20]">Here are members who still need to pay. You can send a friendly reminder via WhatsApp.</p>
        </div>

        <div className="rounded-2xl bg-navy-900 p-3.5 text-white">
          <p className="text-[11px] uppercase tracking-wide text-navy-200">Total outstanding</p>
          <p className="money mt-0.5 text-[24px] font-extrabold">{formatGHS(totalOutstanding)}</p>
          <p className="text-[11.5px] text-navy-300">{(rows.data ?? []).length} member(s) with a balance</p>
        </div>

        <div className="relative mt-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search member" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search outstanding members" />
        </div>

        <div className="mt-2.5">
          <label className="label" htmlFor="period-filter">Filter by contribution period</label>
          <select id="period-filter" className="input" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option value="all">All periods</option>
            {(periods.data ?? []).map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<CheckCircle2 size={22} />}
                title="Everyone is up to date"
                description="No member has an outstanding balance for this period. Excellent!"
              />
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.member_id} className="card">
                <div className="flex items-start gap-2.5">
                  <Avatar name={r.full_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-bold text-navy-950">{r.full_name}</p>
                        <p className="text-[11.5px] text-slate-500">{r.relevant_period_label}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="money text-[14px] font-extrabold text-[#A82B2B]">{formatGHS(r.outstanding)}</p>
                        <p className="text-[10.5px] text-slate-400">outstanding</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <SimplePill tone={r.status_label === 'Paid' ? 'paid' : r.status_label === 'Overdue' ? 'unpaid' : 'pending'}>
                        {r.status_label}
                      </SimplePill>
                      {r.overdue_periods > 0 ? <span className="pill-unpaid">{r.overdue_periods} overdue</span> : null}
                      <span className="text-[11px] text-slate-400">
                        paid {formatGHS(r.total_paid)} of {formatGHS(r.total_due)}
                      </span>
                    </div>
                    <button type="button" aria-label="Reminder" onClick={() => openReminder(r)} className="btn-primary btn-sm mt-2 min-h-[38px] rounded-full px-4">
                      <MessageCircle size={13} /> Send Reminder
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      <Sheet
        open={Boolean(target)}
        title={target ? `Remind ${target.full_name}` : 'Reminder'}
        onClose={() => setTarget(null)}
        footer={
          <div className="space-y-2">
            <a
              href={reminder?.whatsappUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-success w-full"
              data-testid="whatsapp-reminder"
            >
              <MessageCircle size={16} />
              Share on WhatsApp
            </a>
            <button type="button" onClick={sendInApp} className="btn-outline w-full">
              <Bell size={16} />
              Send in-app reminder instead
            </button>
          </div>
        }
      >
        {target && reminder ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#FDF1F1] px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#A82B2B]">Outstanding</p>
                <p className="money text-[14px] font-extrabold text-[#A82B2B]">{formatGHS(target.outstanding)}</p>
              </div>
              <div className="rounded-xl bg-[#F7FAFE] px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Period</p>
                <p className="text-[12.5px] font-bold text-navy-950">{target.relevant_period_label}</p>
              </div>
            </div>

            <div>
              <p className="label">Message preview</p>
              <div className="rounded-xl border border-[#E8EEF7] bg-[#F7FAFE] p-3 text-[12.5px] leading-relaxed text-navy-900">
                {reminder.message}
              </div>
            </div>

            <div className="rounded-xl bg-white p-2.5 border border-[#E8EEF7] text-[11.5px] text-slate-500">
              Phone on record: <strong className="text-navy-900">{target.phone || 'not provided'}</strong>
              {!target.phone ? ' — WhatsApp will ask you to choose a contact.' : ''}
            </div>

            {target.periods.length > 0 ? (
              <div>
                <p className="label">Outstanding periods</p>
                <div className="space-y-1">
                  {target.periods.filter((p) => p.outstanding > 0).map((p) => (
                    <div key={p.period_label} className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-600">{p.period_label}</span>
                      <span className="money font-bold text-navy-950">{formatGHS(p.outstanding)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}


          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
