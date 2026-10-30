import React, { useState } from 'react';
import { Bell, BellRing, CheckCheck, Megaphone, Receipt, Send, ShieldCheck } from 'lucide-react';
import { EmptyState, ScreenHeader } from '../components/ui';
import { useApp, useServiceData } from '../context/AppContext';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/databaseService';
import { formatDateTimeShort } from '../utils/formatters';
import type { AppNotification } from '../types/database';
import {
  notificationPermission,
  requestNotificationPermission,
  showTestBrowserNotification,
  type NotificationSupport,
} from '../pwa/browserNotifications';
import { pushConfigured, subscribeToPush } from '../pwa/pushNotifications';

const ICONS: Record<string, React.ReactNode> = {
  membership_approved: <ShieldCheck size={16} />,
  payment_submitted: <Receipt size={16} />,
  payment_verified: <Receipt size={16} />,
  payment_rejected: <Receipt size={16} />,
  contribution_due: <Bell size={16} />,
  outstanding_reminder: <Megaphone size={16} />,
  expense_recorded: <Receipt size={16} />,
  system: <Bell size={16} />,
};

export function NotificationsScreen() {
  const { goBack, refresh, session, toast } = useApp();
  const notifications = useServiceData<AppNotification[]>(() => getNotifications());
  const unread = (notifications.data ?? []).filter((n) => !n.is_read).length;
  const [perm, setPerm] = useState<NotificationSupport>(() => notificationPermission());
  const [enabling, setEnabling] = useState(false);

  const enableNotifications = async () => {
    setEnabling(true);
    try {
      const result = await requestNotificationPermission();
      setPerm(result);
      if (result === 'granted') {
        if (session) await subscribeToPush(session.profile.id);
        toast.success('Phone notifications are on.');
      } else if (result === 'denied') {
        toast.error('Notifications are blocked. Allow them in your browser site settings.');
      }
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        onBack={goBack}
        right={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => {
                markAllNotificationsRead();
                refresh();
              }}
              className="flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-bold text-navy-700"
            >
              <CheckCheck size={15} /> Read all
            </button>
          ) : null
        }
      />
      <div className="px-4 pt-4">
        <div className="card mb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-400">
              <BellRing size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-navy-950">Phone notifications</p>
              <p className="text-[12px] leading-relaxed text-slate-500">
                {perm === 'granted'
                  ? 'On. New payments and updates will pop up at the top of your phone.'
                  : perm === 'denied'
                    ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.'
                    : perm === 'unsupported'
                      ? 'Not supported in this browser. Install the app for the best experience.'
                      : 'Get an alert at the top of your phone when a payment is submitted or a week is due.'}
              </p>
              {pushConfigured ? (
                <p className="mt-0.5 text-[11px] text-slate-400">Includes alerts while the app is closed.</p>
              ) : null}
            </div>
          </div>
          {perm !== 'granted' && perm !== 'unsupported' ? (
            <button type="button" className="btn-gold btn-sm mt-3 w-full" onClick={enableNotifications} disabled={enabling}>
              <BellRing size={14} /> Turn on notifications
            </button>
          ) : null}
          {perm === 'granted' ? (
            <button
              type="button"
              className="btn-outline btn-sm mt-3 w-full"
              onClick={async () => {
                const ok = await showTestBrowserNotification();
                if (ok) toast.success('Test sent — look at the top of your phone.');
                else toast.error('Could not send a test notification.');
              }}
            >
              <Send size={14} /> Send a test notification
            </button>
          ) : null}
        </div>

        {(notifications.data ?? []).length === 0 ? (
          <div className="card-flat bg-white">
            <EmptyState
              icon={<Bell size={22} />}
              title="No notifications"
              description="Nothing yet."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {(notifications.data ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  markNotificationRead(n.id);
                  refresh();
                }}
                className={`card w-full text-left ${n.is_read ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      n.type === 'payment_rejected'
                        ? 'bg-[#FDECEC] text-[#A82B2B]'
                        : n.type === 'payment_verified' || n.type === 'membership_approved'
                          ? 'bg-[#E4F6EC] text-[#137447]'
                          : 'bg-navy-50 text-navy-700'
                    }`}
                  >
                    {ICONS[n.type] ?? <Bell size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-bold text-navy-950">{n.title}</p>
                      {!n.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold-500" /> : null}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{n.message}</p>
                    <p className="mt-1 text-[10.5px] text-slate-400">{formatDateTimeShort(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
