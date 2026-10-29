import React from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { InfoNote, ScreenHeader, SectionHeader } from '../components/ui';

export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="app-shell">
      <ScreenHeader title="Privacy notice" subtitle="What the group can and cannot see" onBack={onBack} />
      <div className="px-4 pt-4">
        <div className="card">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-navy-950">
            <ShieldCheck size={16} className="text-[#137447]" />
            Our promise to you
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
            The Have R/C JHS 2022 Old Students group shares contribution status so that everyone can see
            that the fund is fair and honest. Nothing more than that is shared.
          </p>
        </div>

        <div className="mt-4">
          <SectionHeader title="Visible to approved members" />
          <div className="card">
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-slate-700">
              {[
                'Your full name and optional profile photo.',
                'Your total verified contribution amount.',
                'Your outstanding balance and payment status label.',
                'The contribution periods you have paid, part-paid or not paid.',
                'Posted group expenses, their reasons, amounts and dates.',
                'Posted group income and the current recorded balance.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Eye size={14} className="mt-0.5 shrink-0 text-[#137447]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <SectionHeader title="Never shown to other members" />
          <div className="card">
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-slate-700">
              {[
                'Your email address and phone number (administrators only, for group administration).',
                'Payment receipts and screenshots you upload.',
                'Mobile Money or bank transaction references.',
                'Notes you write to the treasurer, and rejection reasons.',
                'Your password — it is never stored in readable form.',
                'Administrative notes and audit log details (administrators only).',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <EyeOff size={14} className="mt-0.5 shrink-0 text-[#A82B2B]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <SectionHeader title="Who can change what" />
          <div className="card space-y-2 text-[12.5px] leading-relaxed text-slate-700">
            <p>
              <strong>Members</strong> can submit payments and edit their own name, phone and photo. They
              cannot change any financial record, role or approval status.
            </p>
            <p>
              <strong>Administrators and treasurers</strong> can approve members, set contribution rules,
              verify or reject payments, post expenses, and correct records through an audited process.
            </p>
            <p>
              <strong>Nobody</strong> can delete a posted financial record. Corrections create new audited
              entries so the history stays complete.
            </p>
            <p>
              <strong>Database rules</strong> (Supabase Row Level Security) enforce all of this — not just
              the screens you see.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <Lock size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12px] leading-relaxed text-slate-500">
            Want a correction to a figure on your record? Contact the treasurer. Anything they change is
            logged with a reason and their name.
          </p>
        </div>

        <div className="mt-3">
          <InfoNote>
            Labels used in this app are factual: &ldquo;Paid&rdquo;, &ldquo;Partially Paid&rdquo;, &ldquo;Not Yet Paid&rdquo;,
            &ldquo;Overdue&rdquo;. No member is ever described as dishonest.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
