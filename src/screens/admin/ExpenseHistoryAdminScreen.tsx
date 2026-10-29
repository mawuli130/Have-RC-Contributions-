import React, { useState } from 'react';
import { Download, Edit3, FileSearch, Lock, Paperclip, Plus, Receipt } from 'lucide-react';
import { EmptyState, InfoNote, ScreenHeader, SectionHeader, SimplePill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { buildExpenseReportCsv, downloadCsv, getExpenses } from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import type { ExpenseRecord } from '../../types/database';

export function ExpenseHistoryAdminScreen() {
  const { goBack, navigate, toast } = useApp();
  const expenses = useServiceData<ExpenseRecord[]>(() => getExpenses());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const list = (expenses.data ?? []).filter((e) => {
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  });

  const total = list.reduce((s, e) => s + e.effective_amount_ghs, 0);

  return (
    <div className="app-shell">
      <ScreenHeader
        title="Expense History"
        subtitle="Correct or reverse posted expenses"
        onBack={goBack}
        right={
          <button type="button" onClick={() => navigate('admin-add-expense')} className="btn-gold btn-sm shrink-0">
            <Plus size={14} /> Add
          </button>
        }
      />
      <div className="px-4 pt-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Shown total</p>
              <p className="money mt-0.5 text-[19px] font-extrabold text-navy-950">{formatGHS(total)}</p>
              <p className="text-[11.5px] text-slate-500">{list.length} expense(s)</p>
            </div>
            <button
              type="button"
              onClick={() => {
                downloadCsv(`have-rc-jhs-2022-expenses-${new Date().toISOString().slice(0, 10)}.csv`, buildExpenseReportCsv(from || undefined, to || undefined));
                toast.success('Expense CSV downloaded.');
              }}
              className="btn-outline btn-sm shrink-0"
            >
              <Download size={14} /> CSV
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="exp-from">From</label>
              <input id="exp-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="exp-to">To</label>
              <input id="exp-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <SectionHeader title="Posted expenses" caption="Tap to open or correct" />
          {list.length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState icon={<Receipt size={22} />} title="No expenses" description="No expense matches this date range." />
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((e) => (
                <div key={e.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-navy-950">{e.title}</p>
                      <p className="line-clamp-2 text-[11.5px] leading-snug text-slate-500">{e.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="money text-[14.5px] font-extrabold text-[#A82B2B]">−{formatGHS(e.effective_amount_ghs)}</p>
                      {e.effective_amount_ghs !== e.amount_ghs ? (
                        <p className="text-[10.5px] text-slate-400 line-through">{formatGHS(e.amount_ghs)}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SimplePill tone="info">{e.category}</SimplePill>
                    {e.status !== 'posted' ? (
                      <SimplePill tone={e.status === 'reversed' ? 'unpaid' : 'pending'}>
                        {e.status === 'reversed' ? 'Reversed' : 'Adjusted'}
                      </SimplePill>
                    ) : null}
                    {e.has_evidence ? (
                      <span className="pill-neutral"><Paperclip size={11} /> Evidence</span>
                    ) : null}
                    {e.exceeded_balance_override ? <span className="pill-unpaid">Exception</span> : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {formatDateShort(e.expense_date)} · {e.created_by_name} ·{' '}
                    {e.adjustments.length} correction(s)
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" onClick={() => navigate('expense-detail', { id: e.id })} className="btn-outline btn-sm flex-1">
                      <FileSearch size={13} /> View
                    </button>
                    {e.status !== 'reversed' ? (
                      <button type="button" onClick={() => navigate('expense-edit', { id: e.id })} className="btn-primary btn-sm flex-1">
                        <Edit3 size={13} /> Correct
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <Lock size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            Expenses cannot be deleted. A correction reverses the amount (returning it to the fund) or
            adjusts it with a reason, and both actions are recorded in the admin activity log.
          </p>
        </div>

        <div className="mt-2">
          <InfoNote>CSV exports include the reason, category, evidence flag and the administrator who recorded each entry.</InfoNote>
        </div>
      </div>
    </div>
  );
}
