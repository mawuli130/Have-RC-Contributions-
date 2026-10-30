import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  FileClock,
  HandCoins,
  History,
  Info,
  Smartphone,
  Wallet,
} from 'lucide-react';
import {
  Alert,
  EmptyState,
  InfoNote,
  MiniStat,
  SectionHeader,
  SimplePill,
  StatusPill,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import {
  getContributionRule,
  getMyComputation,
  getMyObligations,
  getMyPayments,
  getWalletRecipient,
} from '../services/databaseService';
import { formatDateShort, formatGHS, formatDateTimeShort, formatPaymentLine } from '../utils/formatters';
import type { ContributionObligation, ContributionRule, PaymentSubmission } from '../types/database';
import type { MemberComputation } from '../services/calculations';

export function ContributionsScreen() {
  const { navigate, toast } = useApp();
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const mine = useServiceData<MemberComputation | null>(() => getMyComputation());
  const rule = useServiceData<ContributionRule | null>(() => getContributionRule());
  const obligations = useServiceData<ContributionObligation[]>(() => getMyObligations());
  const payments = useServiceData<PaymentSubmission[]>(() => getMyPayments());
  const wallet = useServiceData(() => getWalletRecipient());

  const r = rule.data;
  const m = mine.data;
  const scheduleActive = Boolean(r?.is_active && r.amount_ghs !== null);
  const pending = useMemo(() => (payments.data ?? []).filter((p) => p.status === 'pending'), [payments.data]);

  const copyMomo = async () => {
    try {
      await navigator.clipboard.writeText(wallet.data?.momoNumber ?? '');
      toast.success('Mobile Money number copied.');
    } catch {
      toast.info(`Send to: ${wallet.data?.momoNumber ?? ''}`);
    }
  };

  if (mine.error) {
    return (
      <div className="app-shell px-4 pt-4">
        <Alert tone="error" title="Cannot load contributions">
          {mine.error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-navy-900 px-4 py-3.5 text-white shadow-pop">
        <h1 className="text-[17px] font-extrabold">Contributions</h1>
        <p className="text-[12px] text-navy-200">My Contributions · {r?.title ?? 'Contribution schedule not set'}</p>
      </header>

      <div className="px-4 pt-4">
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-gold-400"><HandCoins size={18} /></span>
              <div>
                <p className="text-[14px] font-extrabold text-navy-950">Contribution Rule</p>
                <p className="text-[12px] text-slate-500">Amount: {scheduleActive ? formatGHS(r?.amount_ghs ?? 0) : 'Not set yet'}</p>
                <p className="text-[12px] capitalize text-slate-500">{scheduleActive ? (r?.frequency === 'weekly' ? ((r.every_weeks ?? 1) >= 2 ? 'Every 2 weeks' : 'Every week') : r?.frequency.replace('_',' ')) : 'Not set'}</p>
              </div>
            </div>
            <span className="text-slate-300" aria-hidden>›</span>
          </div>
          {!scheduleActive ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#FFF6E6] px-3 py-2 text-[12px] font-medium leading-snug text-[#8A5A08]">
              <Info size={14} className="mt-0.5 shrink-0" /> The group has not set the contribution amount yet.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <h2 className="section-title">Your Contribution Summary</h2>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <div className="rounded-[20px] bg-[#E4F6EC] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#137447]">Total Paid</p>
              <p className="money mt-1 text-[19px] font-extrabold text-[#137447]">{formatGHS(m?.total_verified_paid ?? 0)}</p>
            </div>
            <div className="rounded-[20px] bg-[#FFF2DF] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9A5B06]">Outstanding (missed)</p>
              <p className="money mt-1 text-[19px] font-extrabold text-[#9A5B06]">{formatGHS(m?.outstanding ?? 0)}</p>
            </div>
            <div className="card-flat p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Periods Paid</p>
              <p className="mt-1 text-[22px] font-extrabold leading-none text-navy-950">{m?.periods_fully_paid ?? 0}</p>
            </div>
            <div className="card-flat p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Periods Due</p>
              <p className="mt-1 text-[22px] font-extrabold leading-none text-navy-950">{m ? m.periods_partially_paid + m.periods_not_yet_paid : 0}</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('submit-payment')} className="btn-primary mt-3 min-h-[52px]" data-testid="submit-payment-button">
            Submit Payment
          </button>
        </div>

        <button type="button" onClick={() => navigate('payment-history')} className="btn-outline mt-3">
          <History size={16} />
          Payment history
        </button>

        {/* Payment instructions */}
        <div className="card mt-3 !p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy-950">
            <Smartphone size={15} className="text-navy-600" />
            Pay to
          </p>
          <div className="mt-2 rounded-xl bg-[#F7FAFE] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Send Mobile Money to</p>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="money truncate text-[16px] font-extrabold text-navy-950">
                  {wallet.data?.momoNumber ?? '—'}
                </p>
                <p className="truncate text-[11.5px] text-slate-500">{wallet.data?.momoName}</p>
              </div>
              <button type="button" onClick={copyMomo} className="btn-ghost btn-sm shrink-0">
                <Copy size={14} />
                Copy
              </button>
            </div>
          </div>

        </div>

        {/* Pending submissions */}
        {pending.length > 0 ? (
          <div className="mt-5">
            <SectionHeader title="Pending" />
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="money text-[16px] font-extrabold text-navy-950">{formatGHS(p.amount_ghs)}</p>
                      <p className="text-[11.5px] text-slate-500">
                        {formatPaymentLine(p.payment_date, p.created_at)}
                      </p>
                    </div>
                    <StatusPill status="Pending Verification" />
                  </div>

                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Period breakdown */}
        <div className="mt-5">
          <SectionHeader title="Weeks / Periods" />
          {(obligations.data ?? []).length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<CalendarClock size={22} />}
                title="No schedule yet"
description="No periods yet."
              />
            </div>
          ) : (
            <div className="card-flat overflow-hidden bg-white">
              {(obligations.data ?? []).map((o) => {
                const remaining = Math.max(0, o.amount_due_ghs - o.amount_paid_ghs);
                const isOpen = expandedPeriod === o.id;
                const statusLabel = o.status === 'paid' ? 'Paid' : o.is_overdue ? 'Outstanding' : o.status === 'partially_paid' ? 'Partial' : 'Not paid';
                return (
                  <div key={o.id} className="border-b border-[#EDF2F9] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setExpandedPeriod(isOpen ? null : o.id)}
                      className="list-row"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          o.status === 'paid'
                            ? 'bg-[#E4F6EC] text-[#137447]'
                            : o.is_overdue
                              ? 'bg-[#FDECEC] text-[#A82B2B]'
                              : 'bg-[#FFF2DF] text-[#9A5B06]'
                        }`}
                      >
                        {o.status === 'paid' ? <CheckCircle2 size={16} /> : <CalendarCheck size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-navy-950">{o.period_label}</p>
                        <p className="text-[11.5px] text-slate-500">
                          By {formatDateShort(o.due_date)} · Paid {formatGHS(o.amount_paid_ghs)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`money text-[13px] font-extrabold ${remaining > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}`}>
                          {remaining > 0 ? formatGHS(remaining) : 'Settled'}
                        </p>
                        <p className="text-[10.5px] text-slate-400">{statusLabel}</p>
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="animate-fade-in bg-[#F9FBFE] px-4 pb-3 pt-2">
                        <div className="grid grid-cols-3 gap-2">
                          <MiniStat label="Amount due" value={formatGHS(o.amount_due_ghs)} />
                          <MiniStat label="Verified paid" value={formatGHS(o.amount_paid_ghs)} />
                          <MiniStat
                            label="Remaining"
                            value={formatGHS(remaining)}
                            tone={remaining > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}
                          />
                        </div>

                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button type="button" onClick={() => navigate('financial-history')} className="btn-ghost mt-2">
          <Wallet size={16} />
          Financial Activity
          <ArrowRight size={15} />
        </button>

      </div>
    </div>
  );
}
