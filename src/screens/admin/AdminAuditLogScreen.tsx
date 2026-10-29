import React, { useState } from 'react';
import { Download, History, Search, ShieldCheck } from 'lucide-react';
import { EmptyState, InfoNote, ScreenHeader, SectionHeader, SimplePill } from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import { buildAuditLogCsv, downloadCsv, getAuditLogs } from '../../services/databaseService';
import { formatDateTimeShort } from '../../utils/formatters';
import type { AuditLogEntry } from '../../types/database';

const TONE: Record<string, 'paid' | 'pending' | 'unpaid' | 'info' | 'neutral'> = {
  VERIFY_PAYMENT: 'paid',
  REJECT_PAYMENT: 'unpaid',
  POST_EXPENSE: 'pending',
  REVERSE_EXPENSE: 'unpaid',
  ADJUST_EXPENSE: 'pending',
  APPROVE_MEMBER: 'paid',
  REJECT_MEMBER: 'unpaid',
  SET_CONTRIBUTION_RULE: 'info',
  SET_ROLE: 'info',
  RECORD_OFFLINE_PAYMENT: 'paid',
  SEND_REMINDER: 'neutral',
  SUBMIT_PAYMENT: 'neutral',
  UPDATE_PROFILE: 'neutral',
  CHANGE_PASSWORD: 'neutral',
  REGISTER: 'neutral',
  BOOTSTRAP_ADMIN: 'info',
};

export function AdminAuditLogScreen() {
  const { goBack, toast } = useApp();
  const logs = useServiceData<AuditLogEntry[]>(() => getAuditLogs(200));
  const [query, setQuery] = useState('');

  const filtered = (logs.data ?? []).filter((l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      l.actor_name.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q) ||
      l.action_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-shell">
      <ScreenHeader
        title="Admin Activity Log"
        subtitle="Every administrative action"
        onBack={goBack}
        right={
          <button
            type="button"
            onClick={() => {
              downloadCsv(`have-rc-jhs-2022-audit-${new Date().toISOString().slice(0, 10)}.csv`, buildAuditLogCsv());
              toast.success('Audit log CSV downloaded.');
            }}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-bold text-navy-700"
          >
            <Download size={15} /> CSV
          </button>
        }
      />
      <div className="px-4 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search actions or names" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search audit log" />
        </div>

        <div className="mt-3">
          <SectionHeader title="Activity" caption={`${filtered.length} of ${(logs.data ?? []).length} entries`} />
          {filtered.length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState icon={<History size={22} />} title="Nothing recorded" description="Administrative actions will be logged here automatically." />
            </div>
          ) : (
            <div className="card-flat overflow-hidden bg-white">
              {filtered.map((l) => (
                <div key={l.id} className="border-b border-[#EDF2F9] px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-bold leading-snug text-navy-950">{l.summary}</p>
                    <SimplePill tone={TONE[l.action_type] ?? 'neutral'}>
                      {l.action_type.replace(/_/g, ' ').toLowerCase()}
                    </SimplePill>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {l.actor_name} · {formatDateTimeShort(l.created_at)}
                  </p>
                  {Object.keys(l.metadata).length > 0 ? (
                    <p className="mt-1 truncate rounded bg-[#F7FAFE] px-1.5 py-1 text-[10.5px] text-slate-500">
                      {Object.entries(l.metadata)
                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            The audit log records who did what and when: approvals, payment decisions, expense postings,
            corrections, rule changes and reminders. It cannot be edited from the app.
          </p>
        </div>

        <div className="mt-2">
          <InfoNote>Only administrators and treasurers can read this log.</InfoNote>
        </div>
      </div>
    </div>
  );
}
