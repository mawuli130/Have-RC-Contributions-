import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, ShieldOff, UserCheck, UserX, Users } from 'lucide-react';
import {
  Alert,
  Avatar,
  ConfirmDialog,
  EmptyState,
  ScreenHeader,
  SectionHeader,
  SimplePill,
  StatusPill,
  Sheet,
} from '../../components/ui';
import { useApp, useServiceData } from '../../context/AppContext';
import {
  ServiceError,
  approveMember,
  getAdminMemberRows,
  rejectMember,
  setMemberRole,
  type AdminMemberRow,
} from '../../services/databaseService';
import { formatDateShort, formatGHS } from '../../utils/formatters';
import { isLiveSupabaseConfigured } from '../../services/supabaseClient';
import {
  liveApproveMember,
  liveListMembers,
  liveRejectMember,
  liveSetMemberRole,
} from '../../services/liveAuth';
import type { AppRole } from '../../types/database';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function ManageMembersScreen() {
  const { goBack, toast, refresh, refreshKey, session } = useApp();
  const rows = useServiceData<AdminMemberRow[]>(() =>
    isLiveSupabaseConfigured ? [] : getAdminMemberRows()
  );
  // Live mode: the real member list comes from Supabase profiles.
  const [liveRows, setLiveRows] = useState<AdminMemberRow[] | null>(null);
  useEffect(() => {
    if (!isLiveSupabaseConfigured) return;
    let active = true;
    liveListMembers()
      .then((list) => {
        if (active) setLiveRows(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load members.');
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const memberList = isLiveSupabaseConfigured ? (liveRows ?? []) : (rows.data ?? []);
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [approveTarget, setApproveTarget] = useState<AdminMemberRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminMemberRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [roleTarget, setRoleTarget] = useState<AdminMemberRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = memberList;
    const q = query.trim().toLowerCase();
    return list
      .filter((r) => (filter === 'all' ? true : r.membership_status === filter))
      .filter((r) => (q ? r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) : true));
  }, [memberList, filter, query]);

  const counts = useMemo(() => {
    const list = memberList;
    return {
      pending: list.filter((r) => r.membership_status === 'pending').length,
      approved: list.filter((r) => r.membership_status === 'approved').length,
      rejected: list.filter((r) => r.membership_status === 'rejected').length,
      all: list.length,
    };
  }, [memberList]);

  const doApprove = async () => {
    if (!approveTarget) return;
    setBusy(true);
    try {
      if (isLiveSupabaseConfigured) {
        await liveApproveMember(approveTarget.user_id);
      } else {
        approveMember(approveTarget.user_id);
      }
      toast.success(`${approveTarget.full_name} has been approved.`);
      setApproveTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Could not approve this member.');
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      if (isLiveSupabaseConfigured) {
        await liveRejectMember(rejectTarget.user_id, rejectReason);
      } else {
        rejectMember(rejectTarget.user_id, rejectReason);
      }
      toast.info(`${rejectTarget.full_name} was not approved.`);
      setRejectTarget(null);
      setRejectReason('');
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Could not update this member.');
    } finally {
      setBusy(false);
    }
  };

  const doRole = async (role: AppRole) => {
    if (!roleTarget) return;
    setBusy(true);
    try {
      if (isLiveSupabaseConfigured) {
        await liveSetMemberRole(roleTarget.user_id, role);
      } else {
        setMemberRole(roleTarget.user_id, role);
      }
      toast.success(`${roleTarget.full_name} is now ${role}.`);
      setRoleTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Could not change this role.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="Manage Members" subtitle="Approve accounts and assign roles" onBack={goBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search members"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { key: 'pending', label: `Pending (${counts.pending})` },
              { key: 'approved', label: `Approved (${counts.approved})` },
              { key: 'rejected', label: `Not approved (${counts.rejected})` },
              { key: 'all', label: `All (${counts.all})` },
            ] as Array<{ key: Filter; label: string }>
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold ${
                filter === f.key ? 'border-navy-900 bg-navy-900 text-white' : 'border-[#D8E2F0] bg-white text-navy-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <SectionHeader
            title={filter === 'pending' ? 'Awaiting approval' : 'Members'}
            caption={`${filtered.length} shown`}
          />
          {filtered.length === 0 ? (
            <div className="card-flat bg-white">
              <EmptyState
                icon={<Users size={22} />}
                title={filter === 'pending' ? 'No one is waiting' : 'No members here'}
                description={filter === 'pending' ? 'Every registration has been reviewed. New sign-ups will appear here.' : 'Try a different filter or search term.'}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => (
                <div key={m.user_id} className="card">
                  <div className="flex items-start gap-3">
                    <Avatar name={m.full_name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-bold text-navy-950">{m.full_name}</p>
                          <p className="truncate text-[11.5px] text-slate-500">{m.email}</p>
                        </div>
                        <SimplePill
                          tone={
                            m.membership_status === 'approved'
                              ? 'paid'
                              : m.membership_status === 'pending'
                                ? 'pending'
                                : 'unpaid'
                          }
                        >
                          {m.membership_status === 'approved' ? 'Approved' : m.membership_status === 'pending' ? 'Pending' : 'Not approved'}
                        </SimplePill>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Registered {formatDateShort(m.created_at)}
                        {m.phone ? ` · ${m.phone}` : ''} · {m.role}
                      </p>

                      {m.membership_status === 'approved' ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[11.5px] text-slate-600">
                            Paid <span className="money font-bold text-[#137447]">{formatGHS(m.total_verified_paid)}</span> · Owing{' '}
                            <span className="money font-bold text-[#A82B2B]">{formatGHS(m.outstanding)}</span>
                          </p>
                          <StatusPill status={m.status_label} />
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.membership_status === 'pending' ? (
                          <>
                            <button type="button" onClick={() => setApproveTarget(m)} className="btn-success btn-sm" data-testid={`approve-${m.user_id}`}>
                              <UserCheck size={13} /> Approve
                            </button>
                            <button type="button" onClick={() => setRejectTarget(m)} className="btn-outline btn-sm">
                              <UserX size={13} /> Decline
                            </button>
                          </>
                        ) : null}
                        {m.membership_status === 'approved' && session?.role === 'admin' ? (
                          <button type="button" onClick={() => setRoleTarget(m)} className="btn-outline btn-sm">
                            <ShieldOff size={13} /> Change role
                          </button>
                        ) : null}
                        {m.membership_status === 'rejected' ? (
                          <button type="button" onClick={() => setApproveTarget(m)} className="btn-outline btn-sm">
                            <UserCheck size={13} /> Approve anyway
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-[#E3D2A8] bg-[#FFFBF0] p-3.5">
          <p className="text-[12.5px] font-bold text-[#8A5A08]">Admin rights are never automatic</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#7A5A20]">
            No one becomes an administrator by registering first or choosing an option at signup. New
            accounts always start as pending members. The very first administrator is created securely in
            the Supabase SQL editor — see <strong>docs/SUPABASE_SETUP.md</strong>.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="Approve this member?"
        message={
          <>
            <strong>{approveTarget?.full_name}</strong> will be able to see group contributions, member
            payment status and all posted expenses.
            {approveTarget ? (
              <span className="mt-1.5 block text-[12.5px] text-slate-500">
                Contribution obligations will be created automatically if a schedule is active.
              </span>
            ) : null}
          </>
        }
        confirmLabel="Approve member"
        tone="success"
        busy={busy}
        onConfirm={doApprove}
        onCancel={() => setApproveTarget(null)}
      />

      <Sheet
        open={Boolean(rejectTarget)}
        title="Decline membership"
        onClose={() => setRejectTarget(null)}
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setRejectTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger flex-1" onClick={doReject} disabled={busy}>
              Decline
            </button>
          </div>
        }
      >
        <p className="text-[13px] text-slate-600">
          Give a short reason for <strong>{rejectTarget?.full_name}</strong>. This is sent to them as a
          notification.
        </p>
        <textarea
          className="input mt-2 min-h-[80px]"
          placeholder="e.g. We could not confirm you are a member of the 2022 year group."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={250}
        />
      </Sheet>

      <Sheet open={Boolean(roleTarget)} title="Change role" onClose={() => setRoleTarget(null)}>
        <p className="text-[13px] text-slate-600">
          Set the role for <strong>{roleTarget?.full_name}</strong>. Roles control what they can do.
        </p>
        <div className="mt-3 space-y-2">
          {(
            [
              { role: 'member' as AppRole, label: 'Member', desc: 'Can submit payments and view group records' },
              { role: 'treasurer' as AppRole, label: 'Treasurer', desc: 'Can verify payments and post expenses' },
              { role: 'admin' as AppRole, label: 'Administrator', desc: 'Full access, including managing members and roles' },
            ]
          ).map((opt) => (
            <button
              key={opt.role}
              type="button"
              onClick={() => doRole(opt.role)}
              className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left ${
                roleTarget?.role === opt.role ? 'border-navy-900 bg-navy-50' : 'border-[#D8E2F0] bg-white'
              }`}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-navy-300">
                {roleTarget?.role === opt.role ? <Check size={13} className="text-navy-900" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-navy-950">{opt.label}</span>
                <span className="block text-[11.5px] leading-snug text-slate-500">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
