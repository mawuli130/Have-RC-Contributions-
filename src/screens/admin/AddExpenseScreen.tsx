import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Receipt, Save, ShieldAlert, Wallet } from 'lucide-react';
import {
  Alert,
  ConfirmDialog,
  FilePicker,
  ScreenHeader,
  SectionHeader,
  type PickedFile,
} from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { checkExpenseBalance, getGroupSummary, postExpense, ServiceError } from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import { todayISO } from '../../services/localStore';

const CATEGORIES = ['General', 'Welfare', 'Printing', 'Meetings', 'Transport', 'Donation', 'Equipment', 'Other'];

export function AddExpenseScreen() {
  const { goBack, toast, refresh, navigate } = useApp();
  const summary = useServiceData(() => getGroupSummary());

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [category, setCategory] = useState('General');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<PickedFile | null>(null);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amountValue = Number(amount) || 0;
  const balanceCheck = useMemo(() => {
    try {
      return checkExpenseBalance(amountValue);
    } catch {
      return { currentBalance: summary.data?.current_recorded_balance_ghs ?? 0, wouldRemain: 0, exceedsBalance: false };
    }
  }, [amountValue, summary.data]);

  const validate = (): string | null => {
    if (title.trim().length < 2) return 'Enter a short expense title, for example "Funeral Support".';
    if (!(amountValue > 0)) return 'Enter the amount spent (greater than zero).';
    if (reason.trim().length < 3) return 'Please explain the reason for this expense.';
    if (!expenseDate) return 'Choose the date the expense was paid.';
    if (expenseDate > todayISO()) return 'The expense date cannot be in the future.';
    if (balanceCheck.exceedsBalance && !override) {
      return `This amount is more than the recorded balance (${formatGHS(balanceCheck.currentBalance)}). Tick the exception box to continue.`;
    }
    if (balanceCheck.exceedsBalance && override && overrideReason.trim().length < 5) {
      return 'Write a short explanation for spending above the recorded balance.';
    }
    return null;
  };

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const save = () => {
    setBusy(true);
    setError(null);
    try {
      postExpense({
        title,
        amountGhs: amountValue,
        reason,
        expenseDate,
        category,
        vendorPaid: vendor,
        notes,
        evidence,
        overrideBalanceLimit: override,
        overrideReason,
      });
      toast.success('Expense saved and posted to the group fund.');
      refresh();
      navigate('admin-expense-history');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'The expense could not be saved.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Add Expense" subtitle="Recorded for every member to see" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Available recorded balance</p>
              <p className="money mt-0.5 text-[19px] font-extrabold text-navy-950">
                {formatGHS(summary.data?.current_recorded_balance_ghs ?? 0)}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-gold-400">
              <Wallet size={18} />
            </span>
          </div>
          {amountValue > 0 ? (
            <p className={`mt-2 text-[12px] font-semibold ${balanceCheck.exceedsBalance ? 'text-[#A82B2B]' : 'text-[#137447]'}`}>
              {balanceCheck.exceedsBalance
                ? `This is ${formatGHS(amountValue - balanceCheck.currentBalance)} more than the recorded balance.`
                : `Balance after this expense: ${formatGHS(balanceCheck.wouldRemain)}`}
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3">
            <Alert tone="error" title="Please check the form" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <form onSubmit={review} className="mt-3 space-y-3.5">
          <div>
            <label className="label" htmlFor="exp-title">Expense Title *</label>
            <input id="exp-title" className="input" placeholder="e.g. Printing & Stationery" value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="expense-title" />
          </div>

          <div>
            <label className="label" htmlFor="exp-amount">Amount (GH₵) *</label>
            <input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className="input money text-[19px] font-extrabold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              data-testid="expense-amount"
            />
          </div>

          <div>
            <label className="label" htmlFor="exp-reason">Reason *</label>
            <textarea
              id="exp-reason"
              className="input min-h-[80px]"
              placeholder="e.g. Meeting refreshments"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              required
              data-testid="expense-reason"
            />
            
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="exp-date">Date *</label>
              <input id="exp-date" type="date" className="input" value={expenseDate} max={todayISO()} onChange={(e) => setExpenseDate(e.target.value)} required data-testid="expense-date" />
            </div>
            <div>
              <label className="label" htmlFor="exp-category">Category</label>
              <select id="exp-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="exp-vendor">
              Paid to <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input id="exp-vendor" className="input" placeholder="Person or vendor paid" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>

          <FilePicker
            label="Receipt / Screenshot (optional)"
            hint="Photo, screenshot or PDF smaller than 3 MB. Visible to approved members."
            value={evidence}
            onChange={setEvidence}
          />

          <div>
            <label className="label" htmlFor="exp-notes">
              Additional notes <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <textarea id="exp-notes" className="input min-h-[64px]" placeholder="Anything else worth recording" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
          </div>

          {balanceCheck.exceedsBalance ? (
            <div className="rounded-2xl border border-[#F0BFBF] bg-[#FDECEC] p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#A82B2B]">
                <ShieldAlert size={15} /> Spending limit warning
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8A3030]">
                This expense is larger than the recorded balance. Only continue if the group has
                explicitly approved it (for example money was collected in cash and not yet recorded).
              </p>
              <label className="mt-2 flex items-start gap-2.5 rounded-xl bg-white p-2.5">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#A82B2B]" checked={override} onChange={(e) => setOverride(e.target.checked)} data-testid="expense-override" />
                <span className="text-[12px] font-semibold leading-snug text-navy-900">
                  I have authorisation to record an expense above the recorded balance.
                </span>
              </label>
              {override ? (
                <textarea
                  className="input mt-2 min-h-[64px]"
                  placeholder="Explain the exception, e.g. approved at the 12 October meeting; cash received but not yet recorded."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  maxLength={250}
                  data-testid="expense-override-reason"
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-xl bg-[#F7FAFE] p-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-navy-500" />
            <p className="text-[11.5px] font-semibold text-slate-600">Balance reduces by this amount once.</p>
          </div>

          <button type="submit" className="btn-primary min-h-[52px]" data-testid="expense-review">
            <Receipt size={16} />
            Save Expense
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm this expense"
        message={
          <div className="space-y-1.5">
            <p className="text-[15px] font-extrabold text-navy-950">{title}</p>
            <p className="money text-[18px] font-extrabold text-[#A82B2B]">{formatGHS(amountValue)}</p>
            <p>{reason}</p>
            <p className="text-[12.5px] text-slate-500">
              Date: {formatDateShort(expenseDate)} · Category: {category}
              {vendor ? ` · Paid to: ${vendor}` : ''}
            </p>
            <p className="text-[12.5px] text-slate-500">
              Evidence: {evidence ? evidence.fileName : 'none attached'}
            </p>
            <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#F7FAFE] px-2 py-1.5 text-[12px] font-semibold text-navy-900">
              <Check size={13} className="text-[#137447]" />
              Balance after posting: {formatGHS(balanceCheck.currentBalance - amountValue)}
            </div>
            {balanceCheck.exceedsBalance ? (
              <p className="text-[12px] font-semibold text-[#A82B2B]">
                Authorised exception: {overrideReason}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Save & post expense"
        tone="primary"
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
