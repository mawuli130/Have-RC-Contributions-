import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Info, Loader2, Power, Save, Smartphone } from 'lucide-react';
import { Alert, ConfirmDialog, ScreenHeader, SectionHeader, SimplePill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { ServiceError, getContributionRule, saveContributionRule } from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import { todayISO } from '../../services/localStore';
import type { ContributionRule, PaymentFrequency } from '../../types/database';

const FREQUENCIES: Array<{ value: PaymentFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Yearly' },
  { value: 'one_time', label: 'One-off' },
];

export function ContributionSettingsScreen() {
  const { goBack, toast, refresh } = useApp();
  const rule = useServiceData<ContributionRule | null>(() => getContributionRule());

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDay, setDueDay] = useState('28');
  const [grace, setGrace] = useState('5');
  const [isActive, setIsActive] = useState(false);
  const [momoNumber, setMomoNumber] = useState('');
  const [momoName, setMomoName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || rule.data === undefined) return;
    const r = rule.data;
    setTitle(r?.title ?? 'Have R/C JHS 2022 Contribution');
    setAmount(r?.amount_ghs != null ? String(r.amount_ghs) : '');
    setFrequency(r?.frequency ?? 'monthly');
    setStartDate(r?.start_date ?? todayISO());
    setDueDay(String(r?.due_day ?? 28));
    setGrace(String(r?.grace_period_days ?? 5));
    setIsActive(Boolean(r?.is_active));
    setMomoNumber(r?.treasurer_momo_number ?? '');
    setMomoName(r?.treasurer_momo_name ?? '');
    setHydrated(true);
  }, [rule.data, hydrated]);

  const amountValue = amount.trim() === '' ? null : Number(amount);

  const save = () => {
    setError(null);
    setBusy(true);
    try {
      const result = saveContributionRule({
        title,
        amountGhs: amountValue,
        frequency,
        startDate,
        dueDay: Number(dueDay),
        gracePeriodDays: Number(grace),
        isActive,
        momoNumber,
        momoName,
      });
      toast.success(
        result.periodsCreated > 0
          ? `Settings saved. ${result.periodsCreated} new period(s) created and obligations generated.`
          : 'Contribution settings saved.'
      );
      refresh();
      goBack();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Settings could not be saved.');
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const r = rule.data;

  return (
    <div className="app-shell">
      <ScreenHeader title="Contribution Settings" subtitle="Amount, schedule and activation" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className={`card ${r?.is_active ? 'border-[#A9DFC2] bg-[#F4FBF7]' : 'bg-[#FFFBF0] border-[#EFE0BC]'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Current status</p>
              <p className="mt-0.5 text-[14px] font-extrabold text-navy-950">
                {r?.is_active ? 'Active — obligations are being generated' : 'Not active — no obligations generated'}
              </p>
              <p className="mt-1 text-[12px] text-slate-600">
                {r?.amount_ghs != null ? `${formatGHS(r.amount_ghs)} ${r.frequency.replace('_', ' ')}` : 'Amount not set yet'}
                {r?.start_date ? ` · started ${formatDateShort(r.start_date)}` : ''}
              </p>
            </div>
            <SimplePill tone={r?.is_active ? 'paid' : 'pending'}>{r?.is_active ? 'Active' : 'Unset'}</SimplePill>
          </div>
        </div>

        {!r?.is_active ? (
          <div className="mt-2.5">
            <Alert tone="info" title="The amount can stay unset">
              The group has not yet agreed on a contribution amount. Leave the amount blank and keep the
              schedule inactive — no member will be charged and no obligations will be generated. Come
              back when the amount is agreed.
            </Alert>
          </div>
        ) : null}

        {error ? (
          <div className="mt-2.5">
            <Alert tone="error" title="Please check" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <form
          className="mt-4 space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmOpen(true);
          }}
        >
          <div>
            <label className="label" htmlFor="rule-title">Rule name</label>
            <input id="rule-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="rule-amount">
              Contribution amount (GHS)
            </label>
            <input
              id="rule-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className="input money text-[19px] font-extrabold"
              placeholder="Leave blank — not decided yet"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="rule-amount"
            />
            <p className="field-help">
              Leave this blank to keep the amount unset. No obligations are created until an amount is
              saved with the schedule active.
            </p>
          </div>

          <div>
            <span className="label">Payment frequency</span>
            <div className="grid grid-cols-3 gap-1.5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`min-h-[44px] rounded-xl border px-1 text-[12.5px] font-bold ${
                    frequency === f.value ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="rule-start">First start date</label>
              <input id="rule-start" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rule-due">Due day</label>
              <input id="rule-due" type="number" min="1" max="31" className="input" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="rule-grace">Grace period (days)</label>
            <input id="rule-grace" type="number" min="0" max="60" className="input" value={grace} onChange={(e) => setGrace(e.target.value)} />
            <p className="field-help">Members become &ldquo;Overdue&rdquo; only after the due date plus this grace period.</p>
          </div>

          <div className="rounded-2xl border border-[#E8EEF7] bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy-950">
              <Smartphone size={15} className="text-navy-600" /> Payment details shown to members
            </p>
            <div className="mt-2 space-y-2.5">
              <div>
                <label className="label" htmlFor="rule-momo">Mobile Money / account number</label>
                <input id="rule-momo" className="input" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="024 000 0000" />
              </div>
              <div>
                <label className="label" htmlFor="rule-momo-name">Account name</label>
                <input id="rule-momo-name" className="input" value={momoName} onChange={(e) => setMomoName(e.target.value)} placeholder="Have R/C JHS 2022 Welfare Fund" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left ${
              isActive ? 'border-[#A9DFC2] bg-[#F4FBF7]' : 'border-[#D8E2F0] bg-white'
            }`}
            data-testid="rule-active-toggle"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-navy-950">
                <Power size={15} /> Schedule active
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">
                {isActive
                  ? 'Obligations are generated for every approved member.'
                  : 'While inactive, no new obligations are generated.'}
              </span>
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isActive ? 'bg-[#1E9E63]' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${isActive ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {isActive && amountValue === null ? (
            <Alert tone="warning" title="Amount required to activate">
              Enter the agreed contribution amount before switching the schedule on.
            </Alert>
          ) : null}

          <div className="flex items-start gap-2 rounded-xl bg-[#F7FAFE] p-3">
            <CalendarClock size={15} className="mt-0.5 shrink-0 text-navy-500" />
            <p className="text-[11.5px] leading-relaxed text-slate-600">
              Saving with the schedule active creates one obligation per approved member for every period
              from the start date up to today. Periods are never created twice, and future periods are not
              charged in advance.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={busy} data-testid="rule-save">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Review and save settings
          </button>
        </form>

        <div className="mt-4">
          <SectionHeader title="How members see this" />
          <div className="card space-y-1.5 text-[12.5px] leading-relaxed text-slate-600">
            <p>Amount: <strong className="text-navy-950">{amountValue !== null ? formatGHS(amountValue) : 'Not set yet'}</strong></p>
            <p>Frequency: <strong className="capitalize text-navy-950">{frequency.replace('_', ' ')}</strong></p>
            <p>Due: <strong className="text-navy-950">day {dueDay}, {grace} day grace period</strong></p>
            <p>Status: <strong className="text-navy-950">{isActive ? 'Active' : 'Inactive'}</strong></p>
          </div>
        </div>

        <div className="mt-3">
          <Alert tone="warning" title="Changing an active amount">
            Updating the amount affects only <em>new</em> periods. Existing obligations keep the amount they
            were created with, so the group&apos;s history stays accurate.
          </Alert>
        </div>

        <div className="mt-3 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            Only administrators and treasurers can open this page. Every change is written to the admin
            activity log.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Save contribution settings?"
        message={
          <div className="space-y-1.5">
            <p>
              Amount: <strong>{amountValue !== null ? formatGHS(amountValue) : 'Not set (blank)'}</strong>
            </p>
            <p>Frequency: <strong className="capitalize">{frequency.replace('_', ' ')}</strong></p>
            <p>Start date: <strong>{formatDateShort(startDate)}</strong></p>
            <p>Schedule: <strong>{isActive ? 'Active' : 'Inactive'}</strong></p>
            {isActive ? (
              <p className="flex items-start gap-1.5 pt-1 text-[12px] text-[#8A5A08]">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Activating will generate obligations for all approved members.
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Save settings"
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
