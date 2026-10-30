import React, { useMemo, useState } from 'react';
import { Clock, Eye, FileSearch, Receipt, ShieldCheck, X } from 'lucide-react';
import {
  Alert,
  EmptyState,
  InfoNote,
  ScreenHeader,
  Sheet,
  SimplePill,
  StatusPill,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getLedgerEntries, getMyPayments, getPaymentEvidence } from '../services/databaseService';
import { formatDateShort, formatDateTimeShort, formatGHS, formatPaymentLine, shortActivityTitle } from '../utils/formatters';
import type { PaymentSubmission } from '../types/database';

const STATUS_TONE: Record<string, 'paid' | 'pending' | 'unpaid'> = {
  verified: 'paid',
  pending: 'pending',
  rejected: 'unpaid',
};

export function PaymentHistoryScreen() {
  const { goBack, session, toast } = useApp();
  const payments = useServiceData<PaymentSubmission[]>(() => getMyPayments());
  const [evidence, setEvidence] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'mine' | 'group'>('all');
  const groupEntries = useServiceData(() => getLedgerEntries({ type: 'income' }));

  const totals = useMemo(() => {
    const list = payments.data ?? [];
    return {
      verified: list.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount_ghs, 0),
      pending: list.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount_ghs, 0),
      rejected: list.filter((p) => p.status === 'rejected').length,
    };
  }, [payments.data]);

  const viewEvidence = (paymentId: string) => {
    try {
      const found = getPaymentEvidence(paymentId);
      if (!found) {
        toast.info('No receipt was attached to this payment.');
        return;
      }
      setEvidence(found);
    } catch {
      toast.error('You cannot access this receipt.');
    }
  };

  const open = (payments.data ?? []).find((p) => p.id === openId) ?? null;

  return (
    <div className="app-shell">
      <ScreenHeader title="Payment History" subtitle="My payment history" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#137447]">Verified</p>
            <p className="money text-[14px] font-extrabold text-navy-950">{formatGHS(totals.verified)}</p>
          </div>
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A5B06]">Pending</p>
            <p className="money text-[14px] font-extrabold text-navy-950">{formatGHS(totals.pending)}</p>
          </div>
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#A82B2B]">Rejected</p>
            <p className="money text-[14px] font-extrabold text-navy-950">{totals.rejected}</p>
          </div>
        </div>

        <div className="mt-3 flex rounded-full bg-[#EAF1FB] p-1" role="tablist" aria-label="Payment history filter">
          {([['all', 'All'], ['mine', 'My Payments'], ['group', 'Group']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-[38px] flex-1 rounded-full text-[13px] font-bold ${tab === key ? 'bg-navy-900 text-white shadow' : 'text-navy-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'group' ? (
          <div className="mt-3 space-y-2">
            {(groupEntries.data ?? []).length === 0 ? (
              <div className="card-flat bg-white"><EmptyState icon={<Receipt size={22} />} title="No payments yet" description="" /></div>
            ) : (groupEntries.data ?? []).map((e) => (
              <div key={e.id} className="card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-500">{formatDateShort(e.entry_date)}</p>
                  <p className="truncate text-[13px] font-bold text-navy-950">{shortActivityTitle(e.description)}</p>
                  <p className="text-[11px] text-slate-500">{formatPaymentLine(e.entry_date, e.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="pill-paid">Verified</span>
                  <p className="money mt-1 text-[14px] font-extrabold text-[#137447]">{formatGHS(e.amount_ghs)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab !== 'group' && (payments.data ?? []).length === 0 ? (
          <div className="card-flat mt-3 bg-white">
            <EmptyState
              icon={<Receipt size={22} />}
              title="No payments yet"
description="No payments yet."
            />
          </div>
        ) : tab === 'group' ? null : (
          <div className="mt-3 space-y-2">
            {(payments.data ?? []).map((p) => (
              <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="card w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="money text-[17px] font-extrabold text-navy-950">{formatGHS(p.amount_ghs)}</p>
                    <p className="text-[11.5px] text-slate-500">
                      {formatPaymentLine(p.payment_date, p.created_at)}
                      {p.is_offline_entry ? ' · recorded by treasurer' : ''}
                    </p>
                  </div>
                  <SimplePill tone={STATUS_TONE[p.status]}>
                    {p.status === 'verified' ? 'Verified' : p.status === 'pending' ? 'Pending' : 'Rejected'}
                  </SimplePill>
                </div>
                {p.status === 'verified' ? (
                  <p className="mt-1.5 text-[11.5px] text-slate-500">
                    Applied to periods: <span className="money font-semibold text-navy-900">{formatGHS(p.allocated_amount_ghs)}</span>
                    {p.unallocated_credit_ghs > 0 ? ` · credit ${formatGHS(p.unallocated_credit_ghs)}` : ''}
                  </p>
                ) : null}
                {p.status === 'rejected' && p.rejection_reason ? (
                  <p className="mt-1.5 rounded-lg bg-[#FDECEC] px-2 py-1.5 text-[11.5px] text-[#A82B2B]">
                    Reason: {p.rejection_reason}
                  </p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    {p.has_evidence ? (
                      <>
                        <FileSearch size={12} /> Receipt attached
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> Submitted {formatDateTimeShort(p.created_at)}
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-navy-600">
                    <Eye size={12} /> Details
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}


      </div>

      <Sheet open={Boolean(open)} title="Payment details" onClose={() => setOpenId(null)}>
        {open ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="money text-[22px] font-extrabold text-navy-950">{formatGHS(open.amount_ghs)}</p>
              <SimplePill tone={STATUS_TONE[open.status]}>
                {open.status === 'verified' ? 'Verified' : open.status === 'pending' ? 'Pending Verification' : 'Rejected'}
              </SimplePill>
            </div>
            {open.status === 'pending' ? (
              <Alert tone="warning" title="Awaiting verification">
                Not counted yet.
              </Alert>
            ) : null}
            <dl className="space-y-2 text-[13px]">
              <Detail label="Payment date" value={formatDateShort(open.payment_date)} />
              <Detail label="Method" value={open.payment_method} />
              <Detail label="Transaction reference" value={open.transaction_reference || 'Not provided'} privateField />
              <Detail label="Applied to periods" value={formatGHS(open.allocated_amount_ghs)} />
              {open.unallocated_credit_ghs > 0 ? (
                <Detail label="Credit carried forward" value={formatGHS(open.unallocated_credit_ghs)} />
              ) : null}
              <Detail label="Submitted" value={formatDateTimeShort(open.created_at)} />
              {open.reviewed_at ? (
                <Detail
                  label="Reviewed by"
                  value={`${open.reviewed_by_name ?? 'Treasurer'} · ${formatDateTimeShort(open.reviewed_at)}`}
                />
              ) : null}
              {open.notes ? <Detail label="Note" value={open.notes} /> : null}
              {open.rejection_reason ? <Detail label="Rejection reason" value={open.rejection_reason} /> : null}
            </dl>
            {open.has_evidence ? (
              <button type="button" onClick={() => viewEvidence(open.id)} className="btn-outline">
                <FileSearch size={15} />
                View my receipt
              </button>
            ) : (
              <p className="rounded-xl bg-[#F7FAFE] p-3 text-[12px] text-slate-500">No receipt was attached.</p>
            )}

          </div>
        ) : null}
      </Sheet>

      <Sheet open={Boolean(evidence)} title={evidence?.fileName ?? 'Receipt'} onClose={() => setEvidence(null)}>
        {evidence ? (
          <>
            <img src={evidence.dataUrl} alt="Payment receipt" className="w-full rounded-xl" />
            <button type="button" onClick={() => setEvidence(null)} className="btn-outline mt-3">
              <X size={15} /> Close
            </button>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

export function Detail({ label, value, privateField }: { label: string; value: string; privateField?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F1F5FA] pb-1.5 last:border-b-0">
      <dt className="shrink-0 text-slate-500">
        {label}
        {privateField ? <span className="ml-1 rounded bg-navy-50 px-1 py-0.5 text-[9.5px] font-bold uppercase text-navy-600">private</span> : null}
      </dt>
      <dd className="break-words text-right font-semibold text-navy-950">{value}</dd>
    </div>
  );
}

export { StatusPill };
