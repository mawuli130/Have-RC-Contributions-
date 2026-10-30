import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleDollarSign,
  FileText,
  Image as ImageIcon,
  Info,
  Paperclip,
  Plus,
  Receipt,
  Settings2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  Alert,
  EmptyState,
  InfoNote,
  MiniStat,
  SectionHeader,
  Sheet,
} from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import {
  getExpenseEvidence,
  getExpenses,
  getGroupSummary,
  getLedgerEntries,
} from '../services/databaseService';
import { formatDateShort, formatGHS, formatSignedGHS } from '../utils/formatters';
import type { ExpenseRecord, GroupFinancialSummary } from '../types/database';

export function GroupFundScreen() {
  const { navigate, isAdmin, toast } = useApp();
  const summary = useServiceData<GroupFinancialSummary>(() => getGroupSummary());
  const expenses = useServiceData<ExpenseRecord[]>(() => getExpenses());
  const income = useServiceData(() => getLedgerEntries({ type: 'income' }));
  const [evidence, setEvidence] = useState<{ dataUrl: string; fileName: string } | null>(null);

  const s = summary.data;

  const viewEvidence = (expenseId: string) => {
    try {
      const found = getExpenseEvidence(expenseId);
      if (!found) {
        toast.error('No evidence file is attached to this expense.');
        return;
      }
      setEvidence(found);
    } catch {
      toast.error('Evidence is not available.');
    }
  };

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 bg-navy-900 px-4 py-3.5 text-white shadow-pop">
        <h1 className="text-[17px] font-extrabold">Group Fund</h1>
        <p className="text-[12px] text-navy-200">Recorded income and expenses</p>
      </header>

      <div className="px-4 pt-4">
        {/* Balance card */}
        <div className="rounded-[24px] bg-navy-900 p-4 text-white shadow-pop">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-gold-400"><Wallet size={20} /></span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-200">Current Balance</p>
              <p className="money text-[26px] font-extrabold leading-tight">{formatGHS(s?.current_recorded_balance_ghs ?? 0)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 py-2">
              <p className="text-[10px] uppercase tracking-wide text-navy-200">Contributions</p>
              <p className="money text-[13px] font-extrabold">
                {formatGHS(s?.total_verified_contributions_ghs ?? 0)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 py-2">
              <p className="text-[10px] uppercase tracking-wide text-navy-200">Expenses</p>
              <p className="money text-[13px] font-extrabold text-[#FFC9C4]">
                {formatGHS(s?.total_posted_expenses_ghs ?? 0)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 py-2">
              <p className="text-[10px] uppercase tracking-wide text-navy-200">Other income</p>
              <p className="money text-[13px] font-extrabold">{formatGHS(s?.other_recorded_income_ghs ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="card-flat p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Contributions</p>
            <p className="money mt-0.5 text-[16px] font-extrabold text-navy-950">{formatGHS(s?.total_verified_contributions_ghs ?? 0)}</p>
          </div>
          <div className="card-flat p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Expenses</p>
            <p className="money mt-0.5 text-[16px] font-extrabold text-[#A82B2B]">{formatGHS(s?.total_posted_expenses_ghs ?? 0)}</p>
          </div>
          <div className="card-flat p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Other Income</p>
            <p className="money mt-0.5 text-[16px] font-extrabold text-navy-950">{formatGHS(s?.other_recorded_income_ghs ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-[#A9DFC2] bg-[#E4F6EC] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#137447]">Recorded Balance</p>
            <p className="money mt-0.5 text-[16px] font-extrabold text-[#137447]">{formatGHS(s?.current_recorded_balance_ghs ?? 0)}</p>
          </div>
        </div>

        {/* Expense history */}
        <div className="mt-5">
          <SectionHeader
            title="Recent Expenses"
            action={
              <button
                type="button"
                onClick={() => navigate('expenses')}
                className="flex items-center gap-0.5 text-[12.5px] font-bold text-navy-700"
              >
                View All <ArrowRight size={14} />
              </button>
            }
          />
          {(expenses.data ?? []).length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<Receipt size={22} />}
                title="No expenses yet"
                description=""
                action={
                  isAdmin ? (
                    <button type="button" onClick={() => navigate('admin-add-expense')} className="btn-primary">
                      Record first expense
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {(expenses.data ?? []).slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate('expense-detail', { id: e.id })}
                  className="card w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-navy-950">{e.title}</p>
                    </div>
                    <span className="money shrink-0 text-[15px] font-extrabold text-[#A82B2B]">
                      −{formatGHS(e.effective_amount_ghs)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="pill-info">{e.category}</span>
                    {e.status === 'reversed' ? <span className="pill-unpaid">Reversed</span> : null}
                    {e.status === 'adjusted' ? <span className="pill-pending">Adjusted</span> : null}
                    {e.has_evidence ? (
                      <span className="pill-neutral">
                        <Paperclip size={11} /> Evidence
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {formatDateShort(e.expense_date)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {isAdmin ? (
          <button type="button" onClick={() => navigate('admin-add-expense')} className="btn-gold mt-4 min-h-[52px]" data-testid="fund-add-expense">
            <Plus size={17} /> Add Expense
          </button>
        ) : (
          <p className="mt-4 text-center text-[12px] font-medium text-slate-400">Admins only can add expenses.</p>
        )}

      </div>

      <Sheet open={Boolean(evidence)} title={evidence?.fileName ?? 'Receipt'} onClose={() => setEvidence(null)}>
        {evidence ? (
          evidence.dataUrl.startsWith('data:image') ? (
            <img src={evidence.dataUrl} alt="Expense receipt" className="w-full rounded-xl" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ImageIcon size={28} className="text-navy-400" />
              <p className="text-[13px] font-semibold text-navy-950">{evidence.fileName}</p>
              <a href={evidence.dataUrl} download={evidence.fileName} className="btn-outline btn-sm mt-1">
                Download file
              </a>
            </div>
          )
        ) : null}
      </Sheet>
    </div>
  );
}

function FundRow({
  label,
  value,
  icon,
  strong,
  danger,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F1F5FA] pb-2 last:border-b-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-slate-600">
        <span className="text-navy-400">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`money shrink-0 text-[13.5px] ${strong ? 'font-extrabold text-navy-950' : danger ? 'font-bold text-[#A82B2B]' : 'font-bold text-navy-900'}`}
      >
        {value}
      </span>
    </div>
  );
}
