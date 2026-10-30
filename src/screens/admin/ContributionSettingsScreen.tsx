import React, { useEffect, useState } from 'react';
import { Loader2, Power, Save } from 'lucide-react';
import { Alert, ConfirmDialog, ScreenHeader, SimplePill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { ServiceError, getContributionRule, saveContributionRule } from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import { addDays, addMonths, todayISO } from '../../services/localStore';
import type { ContributionRule, PaymentFrequency } from '../../types/database';

type OptionKey = 'weekly1' | 'weekly2' | 'monthly' | 'quarterly' | 'annual' | 'one_time';

const OPTIONS: Array<{ key: OptionKey; label: string; frequency: PaymentFrequency; everyWeeks: number }> = [
  { key: 'weekly1', label: 'Every week', frequency: 'weekly', everyWeeks: 1 },
  { key: 'weekly2', label: 'Every 2 weeks', frequency: 'weekly', everyWeeks: 2 },
  { key: 'monthly', label: 'Every month', frequency: 'monthly', everyWeeks: 1 },
  { key: 'quarterly', label: 'Every 3 months', frequency: 'quarterly', everyWeeks: 1 },
  { key: 'annual', label: 'Every year', frequency: 'annual', everyWeeks: 1 },
  { key: 'one_time', label: 'One-off', frequency: 'one_time', everyWeeks: 1 },
];

function optionFor(r: ContributionRule | null | undefined): OptionKey {
  if (!r) return 'weekly1';
  if (r.frequency === 'weekly') return (r.every_weeks ?? 1) >= 2 ? 'weekly2' : 'weekly1';
  return r.frequency as OptionKey;
}

function optionLabel(key: OptionKey): string {
  return OPTIONS.find((o) => o.key === key)?.label ?? 'Every week';
}

export function ContributionSettingsScreen() {
  const { goBack, toast, refresh } = useApp();
  const rule = useServiceData<ContributionRule | null>(() => getContributionRule());

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [option, setOption] = useState<OptionKey>('weekly1');
  const [startDate, setStartDate] = useState(todayISO());
  const [duration, setDuration] = useState('');
  const [dueDay, setDueDay] = useState('28');
  const [grace, setGrace] = useState('0');
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
    setTitle(r?.title ?? 'Weekly Contribution');
    setAmount(r?.amount_ghs != null ? String(r.amount_ghs) : '');
    setOption(optionFor(r));
    setStartDate(r?.start_date ?? todayISO());
    setDuration(r?.duration_periods != null ? String(r.duration_periods) : '');
    setDueDay(String(r?.due_day ?? 28));
    setGrace(String(r?.grace_period_days ?? 0));
    setIsActive(Boolean(r?.is_active));
    setMomoNumber(r?.treasurer_momo_number ?? '');
    setMomoName(r?.treasurer_momo_name ?? '');
    setHydrated(true);
  }, [rule.data, hydrated]);

  const selected = OPTIONS.find((o) => o.key === option) ?? OPTIONS[0];
  const amountValue = amount.trim() === '' ? null : Number(amount);
  const durationValue = duration.trim() === '' ? null : Number(duration);
  const isWeekly = selected.frequency === 'weekly';
  const unit = selected.frequency === 'weekly' ? (selected.everyWeeks === 1 ? 'weeks' : 'payments') : selected.frequency === 'monthly' ? 'months' : selected.frequency === 'quarterly' ? 'quarters' : selected.frequency === 'annual' ? 'years' : 'payment';

  const endDate = (() => {
    if (!startDate || durationValue === null || !Number.isFinite(durationValue) || durationValue < 1) return null;
    if (selected.frequency === 'weekly') return addDays(startDate, 7 * selected.everyWeeks * durationValue - 1);
    if (selected.frequency === 'monthly') return addMonths(startDate, durationValue - 1);
    if (selected.frequency === 'quarterly') return addMonths(startDate, 3 * (durationValue - 1));
    if (selected.frequency === 'annual') return addMonths(startDate, 12 * (durationValue - 1));
    return startDate;
  })();

  const pickOption = (key: OptionKey) => {
    setOption(key);
    const next = OPTIONS.find((o) => o.key === key);
    if (next?.frequency === 'weekly') setGrace('0');
  };

  const save = () => {
    setError(null);
    setBusy(true);
    try {
      const result = saveContributionRule({
        title,
        amountGhs: amountValue,
        frequency: selected.frequency,
        everyWeeks: selected.everyWeeks,
        durationPeriods: durationValue,
        startDate,
        dueDay: Number(dueDay),
        gracePeriodDays: Number(grace),
        isActive,
        momoNumber,
        momoName,
      });
      toast.success(result.periodsCreated > 0 ? `Saved. ${result.periodsCreated} new week(s) added.` : 'Saved.');
      refresh();
      goBack();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const r = rule.data;

  return (
    <div className="app-shell">
      <ScreenHeader title="Contribution Settings" subtitle="Admin only" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-extrabold text-navy-950">
              {r?.amount_ghs != null ? formatGHS(r.amount_ghs) : 'No amount'}
              {r ? ` · ${optionLabel(optionFor(r))}` : ''}
            </p>
            <p className="text-[12px] text-slate-500">
              {r?.start_date ? `Starts ${formatDateShort(r.start_date)}` : 'Not started'}
              {r?.duration_periods ? ` · ${r.duration_periods} ${unit}` : ''}
            </p>
          </div>
          <SimplePill tone={r?.is_active ? 'paid' : 'pending'}>{r?.is_active ? 'On' : 'Off'}</SimplePill>
        </div>

        {error ? (
          <div className="mt-3">
            <Alert tone="error" title="Check" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmOpen(true);
          }}
        >
          <div>
            <label className="label" htmlFor="rule-title">Name</label>
            <input id="rule-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="rule-amount">Amount (GH₵)</label>
            <input
              id="rule-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className="input money text-[19px] font-extrabold"
              placeholder="e.g. 10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="rule-amount"
            />
          </div>

          <div>
            <span className="label">How often</span>
            <div className="grid grid-cols-3 gap-1.5">
              {OPTIONS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => pickOption(f.key)}
                  className={`min-h-[44px] rounded-xl border px-1 text-[12.5px] font-bold ${
                    option === f.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="rule-start">{isWeekly ? 'First week starts' : 'Start date'}</label>
              <input id="rule-start" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rule-duration">How many {unit}</label>
              <input
                id="rule-duration"
                type="number"
                min="1"
                max="260"
                className="input"
                placeholder="No end"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                data-testid="rule-duration"
              />
              <p className="field-help">Blank = no end.</p>
            </div>
          </div>

          {endDate ? (
            <p className="-mt-2 text-[12px] font-semibold text-slate-500">Ends: {formatDateShort(endDate)}</p>
          ) : null}

          {!isWeekly && selected.frequency !== 'one_time' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="label" htmlFor="rule-due">Due day</label>
                <input id="rule-due" type="number" min="1" max="31" className="input" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="rule-grace">Extra days</label>
                <input id="rule-grace" type="number" min="0" max="60" className="input" value={grace} onChange={(e) => setGrace(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <p className="label">Pay by</p>
              <p className="rounded-xl bg-[#F7FAFE] px-3.5 py-3 text-[13px] font-bold text-navy-950">
                {selected.frequency === 'one_time' ? 'On the date' : 'Last day of the week'}
              </p>
              <div className="mt-2.5">
                <label className="label" htmlFor="rule-grace">Extra days</label>
                <input id="rule-grace" type="number" min="0" max="60" className="input" value={grace} onChange={(e) => setGrace(e.target.value)} />
                <p className="field-help">0 = outstanding the next day.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label" htmlFor="rule-momo">MoMo number</label>
              <input id="rule-momo" className="input" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="024 000 0000" />
            </div>
            <div>
              <label className="label" htmlFor="rule-momo-name">MoMo name</label>
              <input id="rule-momo-name" className="input" value={momoName} onChange={(e) => setMomoName(e.target.value)} placeholder="Treasurer" />
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
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-navy-950">
              <Power size={15} /> Start payments
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isActive ? 'bg-[#1E9E63]' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${isActive ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {isActive && amountValue === null ? (
            <Alert tone="warning" title="Add amount first">Payments cannot start without an amount.</Alert>
          ) : null}

          <button type="submit" className="btn-primary" disabled={busy} data-testid="rule-save">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Save?"
        message={
          <div className="space-y-1 text-[13.5px]">
            <p>Amount: <strong>{amountValue !== null ? formatGHS(amountValue) : '—'}</strong></p>
            <p>How often: <strong>{optionLabel(option)}</strong></p>
            <p>Starts: <strong>{formatDateShort(startDate)}</strong></p>
            <p>How long: <strong>{durationValue !== null ? `${durationValue} ${unit}` : 'No end'}</strong></p>
            {endDate ? <p>Ends: <strong>{formatDateShort(endDate)}</strong></p> : null}
            <p>Payments: <strong>{isActive ? 'On' : 'Off'}</strong></p>
          </div>
        }
        confirmLabel="Save"
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
