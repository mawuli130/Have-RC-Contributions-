import React, { useMemo, useState } from 'react';
import { ChevronRight, Receipt, Search } from 'lucide-react';
import { EmptyState, InfoNote, ScreenHeader } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getExpenses } from '../services/databaseService';
import { formatDateShort, formatGHS } from '../utils/formatters';
import type { ExpenseRecord } from '../types/database';

const CATEGORY_STYLE: Record<string, string> = {
  Education: 'bg-navy-50 text-navy-700',
  Support: 'bg-[#E4F6EC] text-[#137447]',
  Meeting: 'bg-[#FFF2DF] text-[#9A5B06]',
  Welfare: 'bg-[#FDECEC] text-[#A82B2B]',
};

/** Member-facing, read-only expense history (reference: Expenses screen). */
export function ExpensesScreen() {
  const { goBack, navigate, isAdmin } = useApp();
  const expenses = useServiceData<ExpenseRecord[]>(() => getExpenses());
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (expenses.data ?? []).filter(
      (e) => !q || e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    );
  }, [expenses.data, query]);

  return (
    <div className="app-shell">
      <ScreenHeader title="Expenses" subtitle="Posted group expenses · read-only" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search expenses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search expenses"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="card-flat mt-3 bg-white">
            <EmptyState
              icon={<Receipt size={22} />}
              title={query ? 'No expenses match this search' : 'No expenses have been posted'}
description=""
            />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate('expense-detail', { id: e.id })}
                className="card flex w-full items-center gap-3 text-left"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF7E0] text-[20px]" aria-hidden>
                  🧾
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-navy-950">{e.title}</span>
                  <span className="money block text-[13px] font-extrabold text-navy-900">{formatGHS(e.effective_amount_ghs)}</span>
                  <span className="block text-[11.5px] text-slate-500">{formatDateShort(e.expense_date)}</span>
                </span>
                <span className={`pill shrink-0 ${CATEGORY_STYLE[e.category] ?? 'bg-navy-50 text-navy-700'}`}>{e.category}</span>
                <ChevronRight size={17} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        )}


      </div>
    </div>
  );
}
