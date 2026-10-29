import React from 'react';
import { Clock3, LogOut, Lock, PhoneCall, RefreshCw } from 'lucide-react';
import { ScreenHeader } from '../components/ui';
import { formatDateShort } from '../utils/formatters';
import type { Profile } from '../types/database';

export function AwaitingApprovalScreen({
  profile,
  onRefresh,
  onLogout,
  rejected,
}: {
  profile: Profile;
  onRefresh: () => void;
  onLogout: () => void;
  rejected?: boolean;
}) {
  return (
    <div className="app-shell min-h-screen">
      <ScreenHeader title="Membership" subtitle="Account status" right={<button type="button" onClick={onLogout} className="flex h-10 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-[#A82B2B]"><LogOut size={15} /> Logout</button>} />
      <div className="px-4 pt-6">
        <div className={`rounded-3xl p-5 text-center ${rejected ? 'bg-[#FDECEC]' : 'bg-[#FFF6E6]'}`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${rejected ? 'bg-[#F3C7C7] text-[#A82B2B]' : 'bg-[#F5DFB0] text-[#8A5A08]'}`}>
            {rejected ? <Lock size={28} /> : <Clock3 size={28} />}
          </div>
          <h1 className="mt-3 text-[20px] font-extrabold text-navy-950">
            {rejected ? 'Membership not approved' : 'Awaiting Approval'}
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
            {rejected
              ? 'Your membership request was declined. Please contact an administrator or the treasurer of the Have R/C JHS 2022 Old Students group for help. Group financial data stays hidden.'
              : 'Thank you for registering, your account has been created. An administrator needs to approve you before you can see group contributions and financial records. Group financial data stays hidden until then.'}
          </p>
        </div>

        <div className="card mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Registered details</p>
          <dl className="mt-2 space-y-2 text-[13.5px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Full name</dt>
              <dd className="truncate font-semibold text-navy-950">{profile.full_name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="truncate font-semibold text-navy-950">{profile.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-semibold text-navy-950">{profile.phone || 'Not provided'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Registered</dt>
              <dd className="font-semibold text-navy-950">{formatDateShort(profile.created_at)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <span className={rejected ? 'pill-unpaid' : 'pill-pending'}>
                  {rejected ? 'Not approved' : 'Pending approval'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={onRefresh} className="btn-primary">
            <RefreshCw size={16} />
            Check my approval status
          </button>
          <button type="button" onClick={onLogout} className="btn-outline">
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-3.5 border border-[#E8EEF7]">
          <PhoneCall size={15} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            To speed things up, call or message the group treasurer. Group financial data stays hidden
            until your membership is approved.
          </p>
        </div>
      </div>
    </div>
  );
}
