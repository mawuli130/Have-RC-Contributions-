import React, { useState } from 'react';
import {
  CalendarDays,
  Edit3,
  FileSearch,
  Info,
  Paperclip,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import {
  Alert,
  EmptyState,
  InfoNote,
  ScreenHeader,
  SectionHeader,
  Sheet,
  SimplePill,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getExpenseEvidence, getExpenses } from '../services/databaseService';
import { formatDateShort, formatDateTimeShort, formatGHS } from '../utils/formatters';
import { Detail } from './PaymentHistoryScreen';

export function ExpenseDetailScreen({ expenseId }: { expenseId: string }) {
  const { goBack, navigate, isAdmin, toast } = useApp();
  const expenses = useServiceData(() => getExpenses());
  const expense = (expenses.data ?? []).find((e) => e.id === expenseId);
  const [evidence, setEvidence] = useState<{ dataUrl: string; fileName: string } | null>(null);

  if (!expense) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Expense" onBack={goBack} />
        <div className="px-4 pt-4">
          <EmptyState icon={<Receipt size={22} />} title="Expense not found" description="This expense record is not available." />
        </div>
      </div>
    );
  }

  const viewEvidence = () => {
    try {
      const found = getExpenseEvidence(expense.id);
      if (!found) {
        toast.info('No evidence was attached to this expense.');
        return;
      }
      setEvidence(found);
    } catch {
      toast.error('Evidence is not available.');
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Expense details" subtitle={formatDateShort(expense.expense_date)} onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[17px] font-extrabold leading-snug text-navy-950">{expense.title}</h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{expense.reason}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="money text-[19px] font-extrabold text-[#A82B2B]">
                −{formatGHS(expense.effective_amount_ghs)}
              </p>
              {expense.effective_amount_ghs !== expense.amount_ghs ? (
                <p className="text-[10.5px] text-slate-400 line-through">{formatGHS(expense.amount_ghs)}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <SimplePill tone="info">{expense.category}</SimplePill>
            <SimplePill tone={expense.status === 'posted' ? 'paid' : expense.status === 'reversed' ? 'unpaid' : 'pending'}>
              {expense.status === 'posted' ? 'Posted' : expense.status === 'reversed' ? 'Reversed' : 'Adjusted'}
            </SimplePill>
            {expense.has_evidence ? (
              <span className="pill-neutral">
                <Paperclip size={11} /> Evidence available
              </span>
            ) : (
              <span className="pill-neutral">No evidence</span>
            )}
          </div>
        </div>

        <div className="mt-3">
          <SectionHeader title="Record details" />
          <div className="card">
            <dl className="space-y-2 text-[13px]">
              <Detail label="Amount" value={formatGHS(expense.amount_ghs)} />
              <Detail label="Expense date" value={formatDateShort(expense.expense_date)} />
              <Detail label="Category" value={expense.category} />
              {expense.vendor_paid ? <Detail label="Paid to" value={expense.vendor_paid} /> : null}
              <Detail label="Recorded by" value={expense.created_by_name} />
              <Detail label="Recorded on" value={formatDateTimeShort(expense.created_at)} />
              {expense.notes ? <Detail label="Notes" value={expense.notes} /> : null}
            </dl>
          </div>
        </div>

        {expense.exceeded_balance_override ? (
          <div className="mt-3">
            <Alert tone="warning" title="Authorised exception used">
              This expense was larger than the recorded balance at the time. Reason given:{' '}
              {expense.override_reason}
            </Alert>
          </div>
        ) : null}

        {expense.adjustments.length > 0 ? (
          <div className="mt-3">
            <SectionHeader title="Correction history" caption="Audited — nothing was deleted" />
            <div className="card space-y-2.5">
              {expense.adjustments.map((a) => (
                <div key={a.id} className="border-b border-[#F1F5FA] pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-bold text-navy-950">
                      {a.adjustment_type === 'reversal' ? 'Reversed' : 'Amount corrected'}
                    </p>
                    <p className="money text-[12px] font-bold text-navy-900">
                      {formatGHS(a.previous_amount_ghs)} → {formatGHS(a.new_amount_ghs)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{a.reason}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">
                    {a.adjusted_by_name} · {formatDateTimeShort(a.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {expense.has_evidence ? (
            <button type="button" onClick={viewEvidence} className="btn-outline">
              <FileSearch size={15} />
              View receipt / evidence
            </button>
          ) : null}
          {isAdmin && expense.status !== 'reversed' ? (
            <>
              <button type="button" onClick={() => navigate('expense-edit', { id: expense.id })} className="btn-primary">
                <Edit3 size={15} />
                Correct this expense
              </button>
              <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <RotateCcw size={12} /> Corrections are recorded in the audit trail
              </p>
            </>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white p-3 border border-[#E8EEF7]">
          <div className="flex flex-col items-center gap-1 text-center">
            <CalendarDays size={15} className="text-navy-400" />
            <p className="text-[10px] leading-tight text-slate-500">Posted to ledger</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <User size={15} className="text-navy-400" />
            <p className="text-[10px] leading-tight text-slate-500">Creator recorded</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <Store size={15} className="text-navy-400" />
            <p className="text-[10px] leading-tight text-slate-500">Visible to members</p>
          </div>
        </div>

        <div className="mt-3">
          <InfoNote>
            Every approved member can see posted expenses. Editing is limited to authorised
            administrators and every change keeps the original record for auditing.
          </InfoNote>
        </div>

        <div className="mt-2 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            Posted financial records can never be quietly deleted — the database blocks deletion and
            requires a documented reversal instead.
          </p>
        </div>

        <div className="mt-2 flex items-center gap-1.5 justify-center text-[11px] text-slate-400">
          <Info size={12} /> Expense ID: {expense.id.slice(-8).toUpperCase()}
        </div>
      </div>

      <Sheet open={Boolean(evidence)} title={evidence?.fileName ?? 'Evidence'} onClose={() => setEvidence(null)}>
        {evidence ? (
          evidence.dataUrl.startsWith('data:image') ? (
            <img src={evidence.dataUrl} alt="Expense receipt" className="w-full rounded-xl" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Paperclip size={26} className="text-navy-400" />
              <p className="text-[13px] font-semibold text-navy-950">{evidence.fileName}</p>
              <a href={evidence.dataUrl} download={evidence.fileName} className="btn-outline btn-sm">
                Download file
              </a>
            </div>
          )
        ) : null}
      </Sheet>
    </div>
  );
}
