import React, { useState } from 'react';
import { CheckCircle2, Clock, Info, Loader2, Send, ShieldCheck, Smartphone } from 'lucide-react';
import {
  Alert,
  FilePicker,
  InfoNote,
  ScreenHeader,
  type PickedFile,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import {
  ServiceError,
  getContributionRule,
  getMyComputation,
  getMyObligations,
  getWalletRecipient,
  submitPayment,
} from '../services/databaseService';
import { formatDateShort, formatGHS } from '../utils/formatters';
import { todayISO } from '../services/localStore';

const METHODS = ['Mobile Money', 'Bank transfer', 'Cash to treasurer', 'Other'];

export function SubmitPaymentScreen() {
  const { goBack, toast, refresh, navigate } = useApp();
  const mine = useServiceData(() => getMyComputation());
  const obligations = useServiceData(() => getMyObligations());
  const rule = useServiceData(() => getContributionRule());
  const wallet = useServiceData(() => getWalletRecipient());

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [method, setMethod] = useState('Mobile Money');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<PickedFile | null>(null);
  const [targetPeriod, setTargetPeriod] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ amount: number } | null>(null);

  const scheduleActive = Boolean(rule.data?.is_active && rule.data?.amount_ghs !== null);
  const unpaidPeriods = (obligations.data ?? []).filter((o) => o.status !== 'paid');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount you paid, for example 100.');
      return;
    }
    setBusy(true);
    try {
      const payment = submitPayment({
        amountGhs: value,
        paymentDate,
        paymentMethod: method,
        transactionReference: reference,
        notes,
        evidence,
        targetPeriodId: targetPeriod || null,
      });
      setSubmitted({ amount: payment.amount_ghs });
      refresh();
      toast.success('Payment submitted for verification.');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Your payment could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Payment submitted" onBack={() => navigate('payment-history')} />
        <div className="px-4 pt-6">
          <div className="card text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF2DF] text-[#9A5B06]">
              <Clock size={28} />
            </div>
            <h1 className="mt-3 text-[18px] font-extrabold text-navy-950">Pending Verification</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Thank you. Your payment of <strong>{formatGHS(submitted.amount)}</strong> was submitted.
              The treasurer will check it and confirm your record.
            </p>
            <div className="mt-3 rounded-xl bg-[#F7FAFE] p-3 text-left">
              <p className="text-[12px] leading-relaxed text-slate-600">
                This payment is <strong>not yet counted</strong> in your paid total or in the group
                balance. You will get a notification as soon as it is verified.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button type="button" onClick={() => navigate('payment-history')} className="btn-primary">
              View my payment history
            </button>
            <button type="button" onClick={() => { setSubmitted(null); setAmount(''); setReference(''); setNotes(''); setEvidence(null); }} className="btn-outline">
              Submit another payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ScreenHeader title="Submit a payment" subtitle="Tell the treasurer what you paid" onBack={goBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" title="Please check the form" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}

        {mine.data && scheduleActive ? (
          <div className="card mb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Your outstanding balance
                </p>
                <p className="money text-[20px] font-extrabold text-navy-950">
                  {formatGHS(mine.data.outstanding)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAmount(String(mine.data?.outstanding ?? ''))}
                className="btn-outline btn-sm shrink-0"
              >
                Pay full balance
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-slate-500">
              Period: {mine.data.relevant_period_label}
            </p>
          </div>
        ) : (
          <Alert tone="info" title="Voluntary payment">
            The contribution amount is not set yet. You can still submit a payment now and the
            treasurer will allocate it once the schedule is active.
          </Alert>
        )}

        <form onSubmit={submit} className="mt-3 space-y-3.5">
          <div>
            <label className="label" htmlFor="pay-amount">
              Amount paid (GHS)
            </label>
            <input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className="input money text-[20px] font-extrabold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              data-testid="payment-amount"
            />
            <p className="field-help">
              Partial payments are allowed. A payment covering several periods is split automatically.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="pay-date">
              Date you paid
            </label>
            <input
              id="pay-date"
              type="date"
              className="input"
              value={paymentDate}
              max={todayISO()}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              data-testid="payment-date"
            />
          </div>

          <div>
            <span className="label">Payment method</span>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`min-h-[46px] rounded-xl border px-2 py-2 text-[13px] font-semibold ${
                    method === m
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-[#D8E2F0] bg-white text-navy-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {unpaidPeriods.length > 0 ? (
            <div>
              <label className="label" htmlFor="pay-period">
                Apply to a specific period <span className="font-normal normal-case text-slate-400">(optional)</span>
              </label>
              <select
                id="pay-period"
                className="input"
                value={targetPeriod}
                onChange={(e) => setTargetPeriod(e.target.value)}
              >
                <option value="">Oldest unpaid period first (recommended)</option>
                {unpaidPeriods.map((o) => (
                  <option key={o.period_id} value={o.period_id}>
                    {o.period_label} — {formatGHS(o.amount_due_ghs - o.amount_paid_ghs)} left
                  </option>
                ))}
              </select>
              <p className="field-help">Any extra amount is applied to the next unpaid period.</p>
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="pay-ref">
              Transaction reference <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              id="pay-ref"
              className="input"
              placeholder="e.g. MoMo transaction ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              data-testid="payment-reference"
            />
            <p className="field-help">
              Private: only you and the treasurer can see this reference.
            </p>
          </div>

          <FilePicker
            label="Receipt or screenshot (optional)"
            hint="A photo helps the treasurer confirm quickly. Private to you and the treasurer."
            value={evidence}
            onChange={setEvidence}
          />

          <div>
            <label className="label" htmlFor="pay-notes">
              Note to the treasurer <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <textarea
              id="pay-notes"
              className="input min-h-[72px]"
              placeholder="Any extra information about this payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="rounded-xl bg-[#F7FAFE] p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-navy-900">
              <Smartphone size={14} /> Pay the treasurer directly
            </p>
            <p className="mt-1 text-[12px] text-slate-600">
              {wallet.data?.momoNumber} · {wallet.data?.momoName}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-[#E3D2A8] bg-[#FFFBF0] p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#8A5A08]" />
            <p className="text-[12px] leading-relaxed text-[#7A5A20]">
              Your submission will show as <strong>Pending Verification</strong>. It only affects your
              balance and the group fund after the treasurer verifies it.
            </p>
          </div>

          <button type="submit" className="btn-gold" disabled={busy} data-testid="payment-submit">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            Submit for verification
          </button>
        </form>

        <div className="mt-3">
          <InfoNote>
            Paid today but forgot to submit? Add it now — the treasurer can match it to the payment
            date you enter ({formatDateShort(todayISO())} or earlier).
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
