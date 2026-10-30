import React from 'react';
import { CalendarCheck, CheckCircle2, Clock, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { Alert, Avatar, EmptyState, InfoNote, MiniStat, ScreenHeader, SectionHeader, StatusPill } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getPublicMembers } from '../services/databaseService';
import { formatDateShort, formatGHS } from '../utils/formatters';
import type { PublicMemberPaymentSummary } from '../types/database';

export function MemberDetailScreen({ memberId }: { memberId: string }) {
  const { goBack, session } = useApp();
  const members = useServiceData<PublicMemberPaymentSummary[]>(() => getPublicMembers());
  const member = (members.data ?? []).find((m) => m.member_id === memberId);
  const isMe = memberId === session?.profile.id;

  if (!member) {
    return (
      <div className="app-shell">
        <ScreenHeader title="Member" onBack={goBack} />
        <div className="px-4 pt-4">
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Member not available"
            description="Not found."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ScreenHeader title={member.full_name} subtitle={member.relevant_period_label} onBack={goBack} />
      <div className="px-4 pt-4">
        <div className="card text-center">
          <div className="flex justify-center">
            <Avatar name={member.full_name} src={member.avatar_url} size={72} ring />
          </div>
          <p className="mt-2 text-[16px] font-extrabold text-navy-950">{member.full_name}</p>
          <div className="mt-1.5 flex justify-center">
            <StatusPill status={member.payment_status} />
          </div>
          <p className="mt-1.5 text-[12px] text-slate-500">
            {member.role === 'admin' ? 'Administrator' : member.role === 'treasurer' ? 'Treasurer' : 'Member'}
            {isMe ? ' · This is you' : ''}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MiniStat label="Total verified paid" value={formatGHS(member.total_verified_paid_ghs)} tone="text-[#137447]" />
          <MiniStat
            label="Outstanding"
            value={formatGHS(member.outstanding_amount_ghs)}
            tone={member.outstanding_amount_ghs > 0 ? 'text-[#A82B2B]' : 'text-[#137447]'}
          />
          <MiniStat label="Total due" value={formatGHS(member.total_due_ghs)} />
          <MiniStat label="Periods fully paid" value={`${member.periods_fully_paid}`} />
        </div>

        <div className="mt-4">
          <SectionHeader title="Periods" />
          <div className="card space-y-2">
            <Row icon={<CheckCircle2 size={15} />} label="Periods fully paid" value={`${member.periods_fully_paid}`} />
            <Row icon={<Clock size={15} />} label="Periods partially paid" value={`${member.periods_partially_paid}`} />
            <Row icon={<CalendarCheck size={15} />} label="Periods not yet paid" value={`${member.periods_not_yet_paid}`} />
            <Row icon={<Clock size={15} />} label="Overdue periods" value={`${member.overdue_periods_count}`} />
            <Row
              icon={<Wallet size={15} />}
              label="Latest verified payment"
              value={
                member.latest_verified_payment_amount_ghs != null
                  ? `${formatGHS(member.latest_verified_payment_amount_ghs)} · ${formatDateShort(member.latest_verified_payment_date)}`
                  : 'None yet'
              }
            />
          </div>
        </div>

        <div className="mt-3">
          <Alert tone="warning" title="Some details stay private">
            {isMe
              ? 'Your receipts, transaction references and notes are only visible to you and the treasurer. Open Contributions to see them.'
              : `Payment receipts, transaction references and personal contact details for ${member.full_name} are private to them and the treasurer.`}
          </Alert>
        </div>

        {member.pending_submissions_count > 0 ? (
          <div className="mt-3">
            <Alert tone="info">
              {member.pending_submissions_count} payment submission
              {member.pending_submissions_count === 1 ? ' is' : 's are'} awaiting verification. Pending
              amounts are not counted as paid.
            </Alert>
          </div>
        ) : null}

        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <Lock size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            This page shows only the figures the group agreed to share. No one can change another
            member&apos;s financial record from the app.
          </p>
        </div>

        <div className="mt-2">
          <InfoNote>Figures are recalculated from verified records each time the app opens.</InfoNote>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F1F5FA] pb-2 last:border-b-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-slate-600">
        <span className="text-navy-400">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[12.5px] font-bold text-navy-950">{value}</span>
    </div>
  );
}
