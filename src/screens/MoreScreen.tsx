import React from 'react';
import {
  Bell,
  ChevronRight,
  Download,
  FileText,
  History,
  LogOut,
  Receipt,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { Avatar, InfoNote, SectionHeader, SimplePill } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getMyComputation, getNotifications, reseedDemoData } from '../services/databaseService';
import { formatGHS } from '../utils/formatters';

export function MoreScreen() {
  const { session, navigate, logout, isAdmin, refresh, toast } = useApp();
  const mine = useServiceData(() => getMyComputation());
  const notifications = useServiceData(() => getNotifications());
  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;

  const adminItems = [
    { label: 'Admin dashboard', desc: 'Overview of group finances and pending work', icon: <ShieldCheck size={17} />, screen: 'admin-dashboard' as const },
    { label: 'Manage members', desc: 'Approve, decline and assign roles', icon: <Users size={17} />, screen: 'admin-members' as const },
    { label: 'Contribution settings', desc: 'Amount, frequency, due day and activation', icon: <Wallet size={17} />, screen: 'admin-contribution-settings' as const },
    { label: 'Review payments', desc: 'Verify or reject submitted payments', icon: <Receipt size={17} />, screen: 'admin-review-payments' as const },
    { label: 'Outstanding members', desc: 'See balances and send reminders', icon: <Bell size={17} />, screen: 'admin-outstanding' as const },
    { label: 'Add expense', desc: 'Record a group expense with evidence', icon: <Wallet size={17} />, screen: 'admin-add-expense' as const },
    { label: 'Expense history', desc: 'Correct or reverse posted expenses', icon: <FileText size={17} />, screen: 'admin-expense-history' as const },
    { label: 'Financial reports', desc: 'Summary figures and CSV exports', icon: <Download size={17} />, screen: 'admin-reports' as const },
    { label: 'Admin activity log', desc: 'Every administrative action, dated', icon: <History size={17} />, screen: 'admin-audit-log' as const },
  ];

  const memberItems = [
    { label: 'Notifications', desc: unread > 0 ? `${unread} unread updates` : 'Payment and contribution updates', icon: <Bell size={17} />, screen: 'notifications' as const },
    { label: 'My payment history', desc: 'Everything you have submitted', icon: <Receipt size={17} />, screen: 'payment-history' as const },
    { label: 'Financial history', desc: 'All group income and expenses', icon: <History size={17} />, screen: 'financial-history' as const },
    { label: 'Privacy notice', desc: 'What is shared and what stays private', icon: <Shield size={17} />, screen: 'privacy' as const },
    { label: 'Edit my profile', desc: 'Name, phone number and photo', icon: <UserCog size={17} />, screen: 'profile-edit' as const },
  ];

  return (
    <div className="app-shell">
      <header className="rounded-b-3xl bg-navy-900 px-4 pb-5 pt-5 text-white">
        <div className="flex items-center gap-3">
          <Avatar name={session?.profile.full_name ?? 'Member'} src={session?.profile.avatar_url} size={54} ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold">{session?.profile.full_name}</p>
            <p className="truncate text-[11.5px] text-navy-300">{session?.profile.email}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="pill bg-white/15 text-white">
                {session?.role === 'admin' ? 'Administrator' : session?.role === 'treasurer' ? 'Treasurer' : 'Member'}
              </span>
              <span className="pill bg-[#1E9E63] text-white">Approved</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-navy-200">My verified paid</p>
            <p className="money text-[15px] font-extrabold">{formatGHS(mine.data?.total_verified_paid ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-navy-200">My outstanding</p>
            <p className="money text-[15px] font-extrabold text-gold-300">{formatGHS(mine.data?.outstanding ?? 0)}</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <SectionHeader title="My account" />
        <div className="card-flat overflow-hidden bg-white">
          {memberItems.map((item) => (
            <button key={item.label} type="button" onClick={() => navigate(item.screen)} className="list-row" data-testid={`more-nav-${item.screen}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-navy-950">{item.label}</p>
                <p className="truncate text-[11.5px] text-slate-500">{item.desc}</p>
              </div>
              <ChevronRight size={17} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-5">
            <SectionHeader
              title="Admin portal"
              caption="Only administrators and treasurers can open these"
              action={<SimplePill tone="info">{session?.role === 'admin' ? 'Admin' : 'Treasurer'}</SimplePill>}
            />
            <div className="card-flat overflow-hidden bg-white">
              {adminItems.map((item) => (
                <button key={item.label} type="button" onClick={() => navigate(item.screen)} className="list-row" data-testid={`admin-menu-${item.screen}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-[#8A5A08]">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-navy-950">{item.label}</p>
                    <p className="truncate text-[11.5px] text-slate-500">{item.desc}</p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <SectionHeader title="About & data" />
          <div className="card space-y-2">
            <button
              type="button"
              onClick={() => {
                reseedDemoData();
                toast.info('Demo records restored. Please log in again.');
                logout();
              }}
              className="btn-outline btn-sm w-full"
            >
              <Sparkles size={14} />
              Restore demo records
            </button>
            <button type="button" onClick={logout} className="btn-danger btn-sm w-full" data-testid="logout-button">
              <LogOut size={14} />
              Logout
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Have R/C JHS 2022 Contribution & Group Fund · v1.0
            </p>
          </div>
        </div>

        <div className="mt-3">
          <InfoNote>
            This app records contributions and expenses. It is not a bank and does not hold money.
            Always confirm the real balance with the treasurer.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
