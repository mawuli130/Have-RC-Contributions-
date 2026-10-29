import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  Plus,
  Receipt,
  ShieldCheck,
  X,
} from 'lucide-react';
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
  getAllPayments,
  getPaymentEvidence,
  rejectPayment,
  verifyPayment,
} from '../../services/databaseService';
import { formatDateShort, formatDateTimeShort, formatGHS } from '../../utils/formatters';
import type { PaymentSubmission } from '../../types/database';

export function ReviewPaymentsScreen() {
  const { goBack, toast, refresh, navigate } = useApp();
  const payments = useServiceData<PaymentSubmission[]>(() => getAllPayments());
  const [tab, setTab] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [open, setOpen] = useState<PaymentSubmission | null>(null);
  const [evidence, setEvidence] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => (payments.data ?? []).filter((p) => p.status === tab), [payments.data, tab]);
  const pendingTotal = useMemo(
    () => (payments.data ?? []).filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount_ghs, 0),
    [payments.data]
  );

  const verify = (payment: PaymentSubmission) => {
    setBusy(true);
    setError(null);
    try {
      verifyPayment(payment.id);
      toast.success(`Verified ${formatGHS(payment.amount_ghs)} for ${payment.member_name}.`);
      setOpen(null);
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const reject = (payment: PaymentSubmission) => {
    setBusy(true);
    setError(null);
    try {
      rejectPayment(payment.id, reason);
      toast.info(`Payment from ${payment.member_name} rejected.`);
      setOpen(null);
      setRejectMode(false);
      setReason('');
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Could not reject this payment.');
    } finally {
      setBusy(false);
    }
  };

  const viewEvidence = (id: string) => {
    try {
      const found = getPaymentEvidence(id);
      if (!found) {
        toast.info('No receipt attached to this payment.');
        return;
      }
      setEvidence(found);
    } catch {
      toast.error('Evidence is restricted.');
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader
        title="Review Payments"
        subtitle="Private references and receipts stay with you"
        onBack={goBack}
        right={
          <button type="button" onClick={() => navigate('admin-record-payment')} className="btn-gold btn-sm shrink-0">
            <Plus size={14} /> Cash
          </button>
        }
      />
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-navy-900 p-3.5 text-white">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-navy-200">Pending submissions</p>
              <p className="money mt-0.5 text-[22px] font-extrabold">
                {formatGHS(pendingTotal)}
              </p>
              <p className="text-[11.5px] text-navy-300">
                {(payments.data ?? []).filter((p) => p.status === 'pending').length} payment(s) waiting
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-navy-950">
              <Clock size={19} />
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {(
            [
              { key: 'pending', label: 'Pending' },
              { key: 'verified', label: 'Verified' },
              { key: 'rejected', label: 'Rejected' },
            ] as Array<{ key: 'pending' | 'verified' | 'rejected'; label: string }>
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-xl border px-2 py-2 text-[12.5px] font-bold ${
                tab === t.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-700'
              }`}
            >
              {t.label} ({(payments.data ?? []).filter((p) => p.status === t.key).length})
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-3">
            <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <div className="mt-3">
          {list.length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<CheckCircle2 size={22} />}
                title={tab === 'pending' ? 'Nothing waiting for review' : `No ${tab} payments`}
                description={tab === 'pending' ? 'New member submissions will appear here for verification.' : 'Payments you process will be listed here.'}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => { setOpen(p); setRejectMode(false); setReason(''); }} className="card w-full text-left">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={p.member_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-bold text-navy-950">{p.member_name}</p>
                          <p className="text-[11.5px] text-slate-500">
                            {formatDateShort(p.payment_date)} · {p.payment_method}
                            {p.is_offline_entry ? ' · cash entry' : ''}
                          </p>
                        </div>
                        <p className="money shrink-0 text-[15px] font-extrabold text-navy-950">{formatGHS(p.amount_ghs)}</p>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          {p.has_evidence ? <FileSearch size={12} /> : <Receipt size={12} />}
                          {p.has_evidence ? 'Receipt attached' : 'No receipt'}
                        </span>
                        <span className="flex items-center gap-1 text-[11.5px] font-bold text-navy-600">
                          <Eye size={12} /> Review
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <InfoNote>
            Verifying posts the payment to the ledger exactly once and allocates it to the member&apos;s
            oldest unpaid periods. Rejecting never changes any balance.
          </InfoNote>
        </div>
      </div>

      <Sheet
        open={Boolean(open)}
        title={open ? `${open.member_name} · ${formatGHS(open.amount_ghs)}` : 'Payment'}
        onClose={() => setOpen(null)}
        footer={
          open && open.status === 'pending' ? (
            rejectMode ? (
              <div className="flex gap-2">
                <button type="button" className="btn-outline flex-1" onClick={() => setRejectMode(false)}>Back</button>
                <button type="button" className="btn-danger flex-1" onClick={() => reject(open)} disabled={busy}>
                  Confirm reject
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" className="btn-outline flex-1" onClick={() => setRejectMode(true)} disabled={busy}>
                  <X size={15} /> Reject
                </button>
                <button type="button" className="btn-success flex-1" onClick={() => verify(open)} disabled={busy} data-testid="verify-payment">
                  <Check size={15} /> Verify
                </button>
              </div>
            )
          ) : null
        }
      >
        {open ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="money text-[22px] font-extrabold text-navy-950">{formatGHS(open.amount_ghs)}</p>
              <SimplePill tone={open.status === 'verified' ? 'paid' : open.status === 'pending' ? 'pending' : 'unpaid'}>
                {open.status === 'verified' ? 'Verified' : open.status === 'pending' ? 'Pending' : 'Rejected'}
              </SimplePill>
            </div>

            {rejectMode ? (
              <div>
                <label className="label" htmlFor="reject-reason">Reason for rejection</label>
                <textarea
                  id="reject-reason"
                  className="input min-h-[80px]"
                  placeholder="e.g. The amount was not received in the group Mobile Money account."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={250}
                />
                <p className="field-help">The member receives this reason. Be factual and respectful.</p>
              </div>
            ) : (
              <>
                <dl className="space-y-1.5 text-[13px]">
                  <Row label="Payment date" value={formatDateShort(open.payment_date)} />
                  <Row label="Method" value={open.payment_method} />
                  <Row label="Submitted" value={formatDateTimeShort(open.created_at)} />
                  <Row label="Transaction reference" value={open.transaction_reference || 'Not provided'} badge="Private" />
                  {open.notes ? <Row label="Member note" value={open.notes} /> : null}
                  {open.is_offline_entry ? <Row label="Entry type" value="Cash / offline (recorded by treasurer)" /> : null}
                  {open.reviewed_at ? <Row label="Reviewed" value={`${open.reviewed_by_name} · ${formatDateTimeShort(open.reviewed_at)}`} /> : null}
                  {open.status === 'verified' ? <Row label="Applied to periods" value={formatGHS(open.allocated_amount_ghs)} /> : null}
                </dl>

                {open.has_evidence ? (
                  <button type="button" onClick={() => viewEvidence(open.id)} className="btn-outline">
                    <FileSearch size={15} /> View receipt (private)
                  </button>
                ) : (
                  <p className="rounded-xl bg-[#F7FAFE] p-3 text-[12px] text-slate-500">No receipt attached to this payment.</p>
                )}

                {open.status === 'pending' ? (
                  <div className="flex items-start gap-2 rounded-xl border border-[#E3D2A8] bg-[#FFFBF0] p-3">
                    <Banknote size={15} className="mt-0.5 shrink-0 text-[#8A5A08]" />
                    <p className="text-[12px] leading-relaxed text-[#7A5A20]">
                      Confirm you have actually received this money before verifying. Verifying adds it to
                      the member&apos;s paid total and the group balance immediately.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={Boolean(evidence)} title={evidence?.fileName ?? 'Receipt'} onClose={() => setEvidence(null)}>
        {evidence ? (
          <>
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-navy-50 px-2 py-1.5 text-[11px] font-semibold text-navy-700">
              <ShieldCheck size={13} /> Private — member and authorised administrators only
            </div>
            <img src={evidence.dataUrl} alt="Payment receipt" className="w-full rounded-xl" />
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F1F5FA] pb-1.5 last:border-b-0">
      <dt className="shrink-0 text-slate-500">
        {label}
        {badge ? <span className="ml-1 rounded bg-navy-50 px-1 py-0.5 text-[9.5px] font-bold uppercase text-navy-600">{badge}</span> : null}
      </dt>
      <dd className="break-words text-right font-semibold text-navy-950">{value}</dd>
    </div>
  );
}
