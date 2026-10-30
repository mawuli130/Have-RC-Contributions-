import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Filter, History, SlidersHorizontal } from 'lucide-react';
import { EmptyState, InfoNote, ScreenHeader, SectionHeader, SimplePill } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getLedgerEntries } from '../services/databaseService';
import { formatDateShort, formatGHS, formatPaymentLine, shortActivityTitle } from '../utils/formatters';
import type { FinancialLedgerEntry } from '../types/database';

type TypeFilter = 'all' | 'income' | 'expense';
type RangeFilter = 'all' | '30d' | '90d' | 'custom';

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function FinancialHistoryScreen() {
  const { goBack } = useApp();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [range, setRange] = useState<RangeFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rangeBounds = useMemo(() => {
    if (range === '30d') return { from: daysAgoISO(30), to: undefined };
    if (range === '90d') return { from: daysAgoISO(90), to: undefined };
    if (range === 'custom') return { from: from || undefined, to: to || undefined };
    return { from: undefined, to: undefined };
  }, [range, from, to]);

  const entries = useServiceData<FinancialLedgerEntry[]>(
    () => getLedgerEntries({ type: typeFilter, from: rangeBounds.from, to: rangeBounds.to }),
    [typeFilter, rangeBounds.from, rangeBounds.to]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FinancialLedgerEntry[]>();
    (entries.data ?? []).forEach((e) => {
      const key = e.entry_date;
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries.data]);

  const totals = useMemo(() => {
    const list = entries.data ?? [];
    return {
      in: list.filter((e) => e.signed_amount_ghs > 0).reduce((s, e) => s + e.signed_amount_ghs, 0),
      out: list.filter((e) => e.signed_amount_ghs < 0).reduce((s, e) => s + Math.abs(e.signed_amount_ghs), 0),
      net: list.reduce((s, e) => s + e.signed_amount_ghs, 0),
    };
  }, [entries.data]);

  return (
    <div className="app-shell">
      <ScreenHeader
        title="Financial Activity"
        subtitle="Financial history · Contributions and expenses in date order"
        onBack={goBack}
      />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#137447]">Money in</p>
            <p className="money text-[13.5px] font-extrabold text-navy-950">{formatGHS(totals.in)}</p>
          </div>
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#A82B2B]">Money out</p>
            <p className="money text-[13.5px] font-extrabold text-navy-950">{formatGHS(totals.out)}</p>
          </div>
          <div className="card-flat p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-navy-600">Net</p>
            <p className="money text-[13.5px] font-extrabold text-navy-950">{formatGHS(totals.net)}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'income', label: 'Contributions' },
              { key: 'expense', label: 'Expenses' },
            ] as Array<{ key: TypeFilter; label: string }>
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                typeFilter === f.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-700'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-[#D8E2F0]" />
          {(
            [
              { key: 'all', label: 'Any date' },
              { key: '30d', label: 'Last 30 days' },
              { key: '90d', label: 'Last 90 days' },
              { key: 'custom', label: 'Choose dates' },
            ] as Array<{ key: RangeFilter; label: string }>
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setRange(f.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                range === f.key ? 'border-gold-500 bg-gold-500 text-navy-950' : 'border-[#D8E2F0] bg-white text-navy-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {range === 'custom' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="hist-from">From</label>
              <input id="hist-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="hist-to">To</label>
              <input id="hist-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <SectionHeader
            title="Activity" 
            action={
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-slate-400">
                <Filter size={12} /> filtered
              </span>
            }
          />
          {(entries.data ?? []).length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<SlidersHorizontal size={22} />}
                title="Nothing to show"
description="Nothing here."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('all');
                      setRange('all');
                    }}
                    className="btn-outline"
                  >
                    Reset filters
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([date, list]) => {
                const dayNet = list.reduce((s, e) => s + e.signed_amount_ghs, 0);
                return (
                  <div key={date}>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                        {formatDateShort(date)}
                      </p>
                      <p className={`money text-[11.5px] font-bold ${dayNet >= 0 ? 'text-[#137447]' : 'text-[#A82B2B]'}`}>
                        {dayNet >= 0 ? '+' : '−'}
                        {formatGHS(Math.abs(dayNet))}
                      </p>
                    </div>
                    <div className="card-flat overflow-hidden bg-white">
                      {list.map((e) => {
                        const isIncome = e.signed_amount_ghs > 0;
                        return (
                          <div key={e.id} className="list-row relative">
                            <span className={`absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-white ${isIncome ? 'bg-[#1E9E63]' : 'bg-[#CF3C3C]'}`} aria-hidden />
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                isIncome ? 'bg-[#E4F6EC] text-[#137447]' : 'bg-[#FDECEC] text-[#A82B2B]'
                              }`}
                            >
                              {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold text-navy-950">
                                {shortActivityTitle(e.description)}
                              </p>
                              <p className="truncate text-[11px] text-slate-500">
                                {formatPaymentLine(e.entry_date, e.created_at)}
                              </p>
                            </div>
                            <span className={`money shrink-0 text-[13.5px] font-extrabold ${isIncome ? 'text-[#137447]' : 'text-[#A82B2B]'}`}>
                              {isIncome ? '+' : '−'}
                              {formatGHS(Math.abs(e.signed_amount_ghs))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
