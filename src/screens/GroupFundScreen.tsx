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
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[#E8EEF7] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold text-navy-950">Group Fund</h1>
          <p className="text-[12px] text-slate-500">Recorded income and expenses</p>
        </div>
        {isAdmin ? (
          <button type="button" onClick={() => navigate('admin-add-expense')} className="btn-gold btn-sm shrink-0" data-testid="fund-add-expense">
            <Plus size={15} />
            Add Expense
          </button>
        ) : null}
      </header>

      <div className="px-4 pt-4">
        {/* Balance card */}
        <div className="rounded-3xl bg-navy-900 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-200">
            Current recorded balance
          </p>
          <p className="money mt-0.5 text-[30px] font-extrabold leading-tight">
            {formatGHS(s?.current_recorded_balance_ghs ?? 0)}
          </p>
          <p className="mt-1 text-[11.5px] leading-snug text-navy-300">
            Total recorded income − total posted expenses − other recorded outflows
          </p>
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

        <div className="mt-2.5">
          <Alert tone="info">
            These are <strong>recorded</strong> figures. They are not a confirmed bank or Mobile Money
            balance until a separate reconciliation is done by the treasurer.
          </Alert>
        </div>

        {/* Breakdown */}
        <div className="mt-4">
          <SectionHeader title="How the fund stands" caption="Each figure comes from the ledger" />
          <div className="card space-y-2">
            <FundRow label="Total verified contributions" value={formatGHS(s?.total_verified_contributions_ghs ?? 0)} icon={<CircleDollarSign size={15} />} />
            <FundRow label="Other recorded income" value={formatGHS(s?.other_recorded_income_ghs ?? 0)} icon={<BadgeCheck size={15} />} />
            <FundRow label="Total recorded income" value={formatGHS(s?.total_recorded_income_ghs ?? 0)} icon={<Building2 size={15} />} strong />
            <FundRow label="Total posted expenses" value={`−${formatGHS(s?.total_posted_expenses_ghs ?? 0)}`} icon={<TrendingDown size={15} />} danger />
            <FundRow label="Other recorded outflows" value={formatGHS(s?.other_recorded_outflows_ghs ?? 0)} icon={<Wallet size={15} />} />
            <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-[#F7FAFE] px-3 py-2.5">
              <span className="text-[13px] font-bold text-navy-950">Current recorded balance</span>
              <span className="money text-[15px] font-extrabold text-navy-950">
                {formatGHS(s?.current_recorded_balance_ghs ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Expense history */}
        <div className="mt-5">
          <SectionHeader
            title="Expense history"
            caption={`${(expenses.data ?? []).length} posted expense${(expenses.data ?? []).length === 1 ? '' : 's'}`}
            action={
              <button
                type="button"
                onClick={() => navigate('financial-history')}
                className="flex items-center gap-0.5 text-[12.5px] font-bold text-navy-700"
              >
                History <ArrowRight size={14} />
              </button>
            }
          />
          {(expenses.data ?? []).length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<Receipt size={22} />}
                title="No expenses recorded"
                description="When the group spends money, the treasurer records it here with the reason and date."
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
              {(expenses.data ?? []).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate('expense-detail', { id: e.id })}
                  className="card w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-navy-950">{e.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-600">{e.reason}</p>
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
                    {formatDateShort(e.expense_date)} · recorded by {e.created_by_name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Admin quick tools */}
        {isAdmin ? (
          <div className="mt-5">
            <SectionHeader title="Treasurer tools" caption="Only administrators and treasurers see this" />
            <div className="card grid grid-cols-2 gap-2">
              <button type="button" onClick={() => navigate('admin-expense-history')} className="btn-outline btn-sm">
                <FileText size={14} />
                Expense records
              </button>
              <button type="button" onClick={() => navigate('admin-contribution-settings')} className="btn-outline btn-sm">
                <Settings2 size={14} />
                Settings
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <InfoNote>
            Posted expenses cannot be silently deleted. Corrections go through an audited
            reversal/adjustment process that keeps the original entry visible.
          </InfoNote>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="Verified income entries" value={`${(income.data ?? []).length}`} />
          <MiniStat label="Ledger net" value={formatSignedGHS(s?.current_recorded_balance_ghs ?? 0)} />
        </div>
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
