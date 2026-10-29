import React, { useState } from 'react';
import { Download, FileSpreadsheet, Info, Printer, ShieldCheck } from 'lucide-react';
import { Alert, ScreenHeader, SectionHeader, SimplePill, StatusPill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import {
  buildAuditLogCsv,
  buildExpenseReportCsv,
  buildFinancialSummaryCsv,
  buildLedgerCsv,
  buildMemberReportCsv,
  buildOutstandingReportCsv,
  buildPaymentHistoryCsv,
  downloadCsv,
  getGroupSummary,
  getPublicMembers,
} from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import type { GroupFinancialSummary, PublicMemberPaymentSummary } from '../../types/database';

export function FinancialReportsScreen() {
  const { goBack, toast } = useApp();
  const summary = useServiceData<GroupFinancialSummary>(() => getGroupSummary());
  const members = useServiceData<PublicMemberPaymentSummary[]>(() => getPublicMembers());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const stamp = new Date().toISOString().slice(0, 10);
  const s = summary.data;

  const exports: Array<{ label: string; desc: string; run: () => void; file: string }> = [
    {
      label: 'Financial summary',
      desc: 'Income, expenses and the current recorded balance',
      file: `summary-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-summary-${stamp}.csv`, buildFinancialSummaryCsv()),
    },
    {
      label: 'Member payment status',
      desc: 'Every approved member: paid, outstanding and status',
      file: `members-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-members-${stamp}.csv`, buildMemberReportCsv()),
    },
    {
      label: 'Outstanding balances',
      desc: 'Members who still owe contributions',
      file: `outstanding-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-outstanding-${stamp}.csv`, buildOutstandingReportCsv()),
    },
    {
      label: 'Payment history',
      desc: 'All payment submissions with status',
      file: `payments-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-payments-${stamp}.csv`, buildPaymentHistoryCsv()),
    },
    {
      label: 'Expense history',
      desc: 'Expenses including the selected date range',
      file: `expenses-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-expenses-${stamp}.csv`, buildExpenseReportCsv(from || undefined, to || undefined)),
    },
    {
      label: 'Financial ledger',
      desc: 'Every income and expense entry, signed',
      file: `ledger-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-ledger-${stamp}.csv`, buildLedgerCsv(from || undefined, to || undefined)),
    },
    {
      label: 'Admin activity log',
      desc: 'All administrative actions for auditing',
      file: `audit-${stamp}.csv`,
      run: () => downloadCsv(`have-rc-jhs-2022-audit-${stamp}.csv`, buildAuditLogCsv()),
    },
  ];

  return (
    <div className="app-shell">
      <ScreenHeader title="Financial Reports" subtitle="Figures and CSV exports" onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Generated</p>
          <p className="text-[13px] font-bold text-navy-950">{formatDateShort(new Date().toISOString())}</p>
          <div className="mt-2.5 space-y-1.5">
            <Row label="Total verified contributions" value={formatGHS(s?.total_verified_contributions_ghs ?? 0)} />
            <Row label="Other recorded income" value={formatGHS(s?.other_recorded_income_ghs ?? 0)} />
            <Row label="Total recorded income" value={formatGHS(s?.total_recorded_income_ghs ?? 0)} />
            <Row label="Total posted expenses" value={`−${formatGHS(s?.total_posted_expenses_ghs ?? 0)}`} />
            <Row label="Other recorded outflows" value={formatGHS(s?.other_recorded_outflows_ghs ?? 0)} />
            <div className="mt-1 flex items-center justify-between rounded-lg bg-[#F7FAFE] px-2.5 py-2">
              <span className="text-[12.5px] font-bold text-navy-950">Current recorded balance</span>
              <span className="money text-[14px] font-extrabold text-navy-950">{formatGHS(s?.current_recorded_balance_ghs ?? 0)}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Balance = total recorded income − total posted expenses − other recorded outflows. Pending
            payments are excluded.
          </p>
        </div>

        <div className="mt-3">
          <Alert tone="warning" title="Contains individual payment details">
            Reports with member balances are confidential to administrators and treasurers. Share them
            only through private channels, never in a group chat.
          </Alert>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="rep-from">Expense from</label>
            <input id="rep-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rep-to">Expense to</label>
            <input id="rep-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <SectionHeader title="Download CSV" caption="Opens in Excel, Google Sheets or Numbers" />
          <div className="card-flat overflow-hidden bg-white">
            {exports.map((x) => (
              <button
                key={x.label}
                type="button"
                onClick={() => {
                  x.run();
                  toast.success(`${x.label} downloaded.`);
                }}
                className="list-row"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E4F6EC] text-[#137447]">
                  <FileSpreadsheet size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-navy-950">{x.label}</p>
                  <p className="truncate text-[11.5px] text-slate-500">{x.desc}</p>
                </div>
                <Download size={16} className="shrink-0 text-navy-500" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <SectionHeader
            title="Member payment status"
            caption={`${(members.data ?? []).length} approved members`}
            action={
              <button type="button" onClick={() => window.print()} className="flex items-center gap-1 text-[12px] font-bold text-navy-700">
                <Printer size={13} /> Print
              </button>
            }
          />
          <div className="card-flat overflow-hidden bg-white">
            {(members.data ?? []).map((m) => (
              <div key={m.member_id} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-navy-950">{m.full_name}</p>
                  <p className="text-[11px] text-slate-500">
                    Paid {formatGHS(m.total_verified_paid_ghs)} · Owing {formatGHS(m.outstanding_amount_ghs)}
                  </p>
                </div>
                <StatusPill status={m.payment_status} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <SectionHeader title="Group health" />
          <div className="grid grid-cols-2 gap-2">
            <div className="card-flat p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fully paid</p>
              <p className="text-[19px] font-extrabold text-navy-950">{s?.members_fully_paid_count ?? 0}</p>
            </div>
            <div className="card-flat p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Partially paid</p>
              <p className="text-[19px] font-extrabold text-navy-950">{s?.members_partially_paid_count ?? 0}</p>
            </div>
            <div className="card-flat p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">With balance</p>
              <p className="text-[19px] font-extrabold text-navy-950">{s?.members_yet_to_pay_count ?? 0}</p>
            </div>
            <div className="card-flat p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Overdue</p>
              <p className="text-[19px] font-extrabold text-[#A82B2B]">{s?.members_overdue_count ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            Every export is generated from the same database records the app displays — nothing is
            retyped or estimated.
          </p>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Info size={12} /> No payment receipts or transaction references are included in CSV exports.
        </div>

        <div className="mt-2 flex justify-center">
          <SimplePill tone="info">Report date {formatDateShort(new Date().toISOString())}</SimplePill>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F1F5FA] pb-1.5 last:border-b-0">
      <span className="truncate text-[12.5px] text-slate-600">{label}</span>
      <span className="money shrink-0 text-[12.5px] font-bold text-navy-950">{value}</span>
    </div>
  );
}
