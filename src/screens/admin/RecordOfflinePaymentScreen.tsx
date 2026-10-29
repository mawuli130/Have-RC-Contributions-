import React, { useState } from 'react';
import { Banknote, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Alert, ConfirmDialog, ScreenHeader, SectionHeader } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import {
  getAdminMemberRows,
  getMyObligations,
  recordOfflinePayment,
  ServiceError,
  type AdminMemberRow,
} from '../../services/databaseService';
import { formatGHS } from '../../utils/formatters';
import { todayISO } from '../../services/localStore';

const METHODS = ['Cash', 'Mobile Money', 'Bank transfer', 'Cheque'];

export function RecordOfflinePaymentScreen() {
  const { goBack, toast, refresh } = useApp();
  const members = useServiceData<AdminMemberRow[]>(() => getAdminMemberRows());
  const approved = (members.data ?? []).filter((m) => m.membership_status === 'approved');

  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const selected = approved.find((m) => m.user_id === memberId);
  const amountValue = Number(amount) || 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!memberId) {
      setError('Choose the member who made the payment.');
      return;
    }
    if (!(amountValue > 0)) {
      setError('Enter the amount received.');
      return;
    }
    if (paymentDate > todayISO()) {
      setError('The payment date cannot be in the future.');
      return;
    }
    setConfirm(true);
  };

  const save = () => {
    setBusy(true);
    try {
      recordOfflinePayment({
        memberId,
        amountGhs: amountValue,
        paymentDate,
        paymentMethod: method,
        notes,
      });
      toast.success(`Payment of ${formatGHS(amountValue)} recorded for ${selected?.full_name}.`);
      refresh();
      goBack();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'The payment could not be recorded.');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Record Cash Payment" subtitle="For payments received offline" onBack={goBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" title="Please check" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <Alert tone="info" title="This payment is verified immediately">
          Only use this when you have physically received the money (cash handed to you, or a transfer you
          have confirmed). It is posted straight to the ledger and the member&apos;s record.
        </Alert>

        <form onSubmit={submit} className="mt-3 space-y-3.5">
          <div>
            <label className="label" htmlFor="off-member">Member</label>
            <select id="off-member" className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
              <option value="">Select a member</option>
              {approved.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name} — owing {formatGHS(m.outstanding)}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="card py-2.5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-500">Verified paid</span>
                <span className="money font-bold text-[#137447]">{formatGHS(selected.total_verified_paid)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12.5px]">
                <span className="text-slate-500">Outstanding</span>
                <span className="money font-bold text-[#A82B2B]">{formatGHS(selected.outstanding)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12.5px]">
                <span className="text-slate-500">Status</span>
                <span className="font-bold text-navy-950">{selected.status_label}</span>
              </div>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="off-amount">Amount received (GHS)</label>
            <input
              id="off-amount"
              type="number"
              step="0.01"
              min="0.01"
              className="input money text-[19px] font-extrabold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              data-testid="offline-amount"
            />
            {selected && selected.outstanding > 0 ? (
              <button type="button" onClick={() => setAmount(String(selected.outstanding))} className="mt-1 text-[11.5px] font-bold text-navy-700 underline">
                Fill full outstanding balance ({formatGHS(selected.outstanding)})
              </button>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="off-date">Date received</label>
            <input id="off-date" type="date" className="input" value={paymentDate} max={todayISO()} onChange={(e) => setPaymentDate(e.target.value)} required />
          </div>

          <div>
            <span className="label">Method</span>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`min-h-[46px] rounded-xl border px-2 text-[13px] font-semibold ${
                    method === m ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="off-notes">
              Note <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <textarea id="off-notes" className="input min-h-[64px]" placeholder="e.g. Cash handed over after the October meeting" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={250} />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-[#F7FAFE] p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy-500" />
            <p className="text-[11.5px] leading-relaxed text-slate-600">
              The member is notified that the treasurer recorded this payment. The action appears in the
              admin activity log with your name.
            </p>
          </div>

          <button type="submit" className="btn-primary">
            <Banknote size={16} />
            Review payment
          </button>
        </form>

        <div className="mt-4">
          <SectionHeader title="Good practice" />
          <div className="card text-[12px] leading-relaxed text-slate-600">
            <p>• Record cash the same day it is received.</p>
            <p className="mt-1">• Write the member&apos;s name in your cash book too.</p>
            <p className="mt-1">• Never record a payment you have not actually received.</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Record this payment?"
        message={
          <div className="space-y-1.5">
            <p className="text-[14px] font-bold text-navy-950">{selected?.full_name}</p>
            <p className="money text-[18px] font-extrabold text-[#137447]">{formatGHS(amountValue)}</p>
            <p>{method} · received {paymentDate}</p>
            <p className="text-[12px] text-slate-500">
              This posts to the ledger immediately and updates the member&apos;s balance.
            </p>
          </div>
        }
        confirmLabel="Record payment"
        tone="success"
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
