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
import { formatDateShort, formatGHS, formatDateTimeShort } from '../utils/formatters';
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
      <header className="sticky top-0 z-30 border-b border-[#E8EEF7] bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-[17px] font-extrabold text-navy-950">My Contributions</h1>
        <p className="text-[12px] text-slate-500">
          {r?.title ?? 'Contribution schedule not set'}
        </p>
      </header>

      <div className="px-4 pt-4">
        {!scheduleActive ? (
          <Alert tone="info" title="The contribution amount is not set yet">
            The group has not yet agreed on a contribution amount, so no balances have been generated.
            You can still submit a voluntary payment, and the treasurer will allocate it once the
            schedule is activated.
          </Alert>
        ) : (
          <div className="rounded-2xl bg-navy-900 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-200">
                  Contribution per period
                </p>
                <p className="money mt-0.5 text-[26px] font-extrabold leading-tight">
                  {formatGHS(r?.amount_ghs ?? 0)}
                </p>
                <p className="mt-0.5 text-[12px] capitalize text-navy-300">
                  {r?.frequency.replace('_', ' ')} · due day {r?.due_day} · {r?.grace_period_days} day grace
                </p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-navy-950">
                <HandCoins size={19} />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/10 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-navy-200">Paid</p>
                <p className="money text-[14px] font-extrabold">{formatGHS(m?.total_verified_paid ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-navy-200">Outstanding</p>
                <p className="money text-[14px] font-extrabold text-gold-300">{formatGHS(m?.outstanding ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-navy-200">Due</p>
                <p className="money text-[14px] font-extrabold">{formatGHS(m?.total_due ?? 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => navigate('submit-payment')} className="btn-gold" data-testid="submit-payment-button">
            <CircleDollarSign size={16} />
            Submit payment
          </button>
          <button type="button" onClick={() => navigate('payment-history')} className="btn-outline">
            <History size={16} />
            Payment history
          </button>
        </div>

        {/* Payment instructions */}
        <div className="card mt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy-950">
            <Smartphone size={15} className="text-navy-600" />
            How to pay
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
          <ol className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-600">
            <li>1. Send your contribution using Mobile Money or hand it to the treasurer.</li>
            <li>2. Tap <strong>Submit payment</strong> and enter the amount and date.</li>
            <li>3. Keep your transaction reference. It stays private to you and the treasurer.</li>
            <li>4. Your payment shows <strong>Pending Verification</strong> until confirmed.</li>
          </ol>
        </div>

        {/* Pending submissions */}
        {pending.length > 0 ? (
          <div className="mt-5">
            <SectionHeader title="Awaiting verification" caption="These are not counted until verified" />
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="money text-[16px] font-extrabold text-navy-950">{formatGHS(p.amount_ghs)}</p>
                      <p className="text-[11.5px] text-slate-500">
                        Paid {formatDateShort(p.payment_date)} · {p.payment_method}
                      </p>
                    </div>
                    <StatusPill status="Pending Verification" />
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-slate-500">
                    <Clock size={12} />
                    Sent {formatDateTimeShort(p.created_at)} · private reference{' '}
                    {p.transaction_reference ? 'saved' : 'not provided'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Period breakdown */}
        <div className="mt-5">
          <SectionHeader
            title="Period by period"
            caption={
              (obligations.data ?? []).length > 0
                ? 'Tap a period to see what was applied'
                : 'No periods created yet'
            }
          />
          {(obligations.data ?? []).length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<CalendarClock size={22} />}
                title="No schedule yet"
                description="Contribution periods appear here after an administrator sets the amount and activates the schedule."
              />
            </div>
          ) : (
            <div className="card-flat overflow-hidden bg-white">
              {(obligations.data ?? []).map((o) => {
                const remaining = Math.max(0, o.amount_due_ghs - o.amount_paid_ghs);
                const isOpen = expandedPeriod === o.id;
                const statusLabel = o.status === 'paid' ? 'Paid' : o.is_overdue ? 'Overdue' : o.status === 'partially_paid' ? 'Partially Paid' : 'Not Yet Paid';
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
                          Due {formatDateShort(o.due_date)} · paid {formatGHS(o.amount_paid_ghs)}
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
                        <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                          Grace period ends {formatDateShort(o.due_date)} + {o.grace_period_days} days.
                          Partial payments are applied to the oldest unpaid period first.
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <Info size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <div className="text-[12px] leading-relaxed text-slate-500">
            <p className="font-semibold text-navy-800">Partial and multi-period payments are supported.</p>
            <p className="mt-0.5">
              A payment covering several periods is split across them oldest-first, and each cedi is
              counted exactly once.
            </p>
          </div>
        </div>

        <button type="button" onClick={() => navigate('financial-history')} className="btn-ghost mt-2">
          <Wallet size={16} />
          See group financial history
          <ArrowRight size={15} />
        </button>

        <div className="mt-2">
          <InfoNote>
            Only verified payments are added to your total. Pending or rejected submissions never
            increase your paid amount or the group balance.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
