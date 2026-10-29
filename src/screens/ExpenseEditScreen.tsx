import React, { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Save } from 'lucide-react';
import { Alert, ScreenHeader, SectionHeader } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { ServiceError, adjustExpense, getExpenses, reverseExpense } from '../services/databaseService';
import { formatGHS } from '../utils/formatters';

export function ExpenseEditScreen({ expenseId }: { expenseId: string }) {
  const { goBack, toast, refresh } = useApp();
  const expenses = useServiceData(() => getExpenses());
  const expense = (expenses.data ?? []).find((e) => e.id === expenseId);

  const [mode, setMode] = useState<'adjust' | 'reverse'>('adjust');
  const [newAmount, setNewAmount] = useState(expense ? String(expense.effective_amount_ghs) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!expense) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Correct expense" onBack={goBack} />
        <div className="px-4 pt-4">
          <Alert tone="error" title="Expense not found">
            This record could not be loaded. Please go back and try again.
          </Alert>
        </div>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'reverse') {
        reverseExpense(expense.id, reason);
        toast.success('Expense reversed with an audit trail.');
      } else {
        adjustExpense(expense.id, Number(newAmount), reason);
        toast.success('Expense corrected. The ledger was updated once.');
      }
      refresh();
      goBack();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'The correction could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Correct an expense" subtitle={expense.title} onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Current record</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-navy-950">{expense.title}</p>
            <p className="money text-[16px] font-extrabold text-[#A82B2B]">−{formatGHS(expense.effective_amount_ghs)}</p>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-slate-600">{expense.reason}</p>
        </div>

        <div className="mt-3">
          <Alert tone="warning" title="Nothing is deleted">
            Posted expenses are never removed. A correction adds an audited entry so the original
            stays visible to everyone.
          </Alert>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('adjust')}
            className={`min-h-[52px] rounded-xl border-2 px-2 py-2 text-[13px] font-bold ${
              mode === 'adjust' ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-800'
            }`}
          >
            Correct the amount
          </button>
          <button
            type="button"
            onClick={() => setMode('reverse')}
            className={`min-h-[52px] rounded-xl border-2 px-2 py-2 text-[13px] font-bold ${
              mode === 'reverse' ? 'border-[#A82B2B] bg-[#A82B2B] text-white' : 'border-[#D8E2F0] bg-white text-navy-800'
            }`}
          >
            Reverse completely
          </button>
        </div>

        {error ? (
          <div className="mt-3">
            <Alert tone="error" title="Please check" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-3 space-y-3.5">
          {mode === 'adjust' ? (
            <div>
              <label className="label" htmlFor="adjust-amount">
                Correct amount (GHS)
              </label>
              <input
                id="adjust-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input money text-[19px] font-extrabold"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                required
              />
              <p className="field-help">
                The difference is posted to the ledger: money returns to the fund if the amount goes
                down, and an extra outflow is recorded if it goes up.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#F0BFBF] bg-[#FDECEC] p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#A82B2B]">
                <AlertTriangle size={14} /> This returns {formatGHS(expense.effective_amount_ghs)} to the
                recorded balance
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#8A3030]">
                The expense stays in the history marked as reversed, and the ledger receives a
                compensating entry.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="adjust-reason">
              Reason for the correction
            </label>
            <textarea
              id="adjust-reason"
              className="input min-h-[80px]"
              placeholder="e.g. Amount was entered twice, correct amount is GH₵200"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              required
            />
            <p className="field-help">This explanation is stored in the admin activity log.</p>
          </div>

          <button type="submit" className={mode === 'reverse' ? 'btn-danger' : 'btn-primary'} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'reverse' ? <RotateCcw size={16} /> : <Save size={16} />}
            {mode === 'reverse' ? 'Confirm reversal' : 'Save correction'}
          </button>
        </form>

        <div className="mt-4">
          <SectionHeader title="Existing corrections" />
          {expense.adjustments.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-[12px] text-slate-500 border border-[#E8EEF7]">
              This expense has not been corrected before.
            </p>
          ) : (
            <div className="card space-y-2">
              {expense.adjustments.map((a) => (
                <div key={a.id} className="border-b border-[#F1F5FA] pb-2 text-[12px] last:border-b-0 last:pb-0">
                  <p className="font-bold text-navy-950">
                    {formatGHS(a.previous_amount_ghs)} → {formatGHS(a.new_amount_ghs)}
                  </p>
                  <p className="text-slate-600">{a.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
