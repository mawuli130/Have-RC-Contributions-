import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthenticatedUser } from '../types/database';
import { getSessionUser, signOut } from '../services/databaseService';
import { useToasts, type Toast } from '../hooks/useApp';

export type TabKey = 'home' | 'contributions' | 'fund' | 'members' | 'more';

export type ScreenName =
  | 'welcome'
  | 'login'
  | 'register'
  | 'awaiting'
  | 'submit-payment'
  | 'payment-history'
  | 'financial-history'
  | 'expense-detail'
  | 'expense-edit'
  | 'notifications'
  | 'profile-edit'
  | 'privacy'
  | 'reminders'
  | 'member-detail'
  | 'admin-dashboard'
  | 'admin-members'
  | 'admin-contribution-settings'
  | 'admin-review-payments'
  | 'admin-outstanding'
  | 'admin-add-expense'
  | 'admin-expense-history'
  | 'admin-reports'
  | 'admin-audit-log'
  | 'admin-record-payment';

export interface Route {
  name: ScreenName;
  params?: Record<string, string>;
}

export const TAB_SCREEN: Record<TabKey, Route> = {
  home: { name: 'welcome' },
  contributions: { name: 'welcome' },
  fund: { name: 'welcome' },
  members: { name: 'welcome' },
  more: { name: 'welcome' },
};

interface AppContextValue {
  session: AuthenticatedUser | null;
  tab: TabKey;
  route: Route | null;
  canGoBack: boolean;
  refreshKey: number;
  refresh: () => void;
  navigate: (name: ScreenName, params?: Record<string, string>) => void;
  goBack: () => void;
  switchTab: (tab: TabKey) => void;
  setSession: (session: AuthenticatedUser | null) => void;
  logout: () => void;
  toast: {
    toasts: Toast[];
    dismiss: (id: string) => void;
    success: (text: string) => void;
    error: (text: string) => void;
    info: (text: string) => void;
  };
  isAdmin: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthenticatedUser | null>(() => getSessionUser());
  const [tab, setTab] = useState<TabKey>('home');
  const [route, setRoute] = useState<Route | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToasts();
  const historyRef = useRef<Route[]>([]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const refreshSession = useCallback(() => {
    setSessionState(getSessionUser());
    setRefreshKey((k) => k + 1);
  }, []);

  const navigate = useCallback((name: ScreenName, params?: Record<string, string>) => {
    setRoute((current) => {
      if (current) historyRef.current.push(current);
      return { name, params };
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const goBack = useCallback(() => {
    const previous = historyRef.current.pop();
    setRoute(previous ?? null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const switchTab = useCallback((next: TabKey) => {
    historyRef.current = [];
    setRoute(null);
    setTab(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const setSession = useCallback((next: AuthenticatedUser | null) => {
    setSessionState(next);
    historyRef.current = [];
    setRoute(null);
    setTab('home');
    setRefreshKey((k) => k + 1);
  }, []);

  const logout = useCallback(() => {
    signOut();
    setSession(null);
  }, [setSession]);

  // Keep the session fresh if another tab/window approved the member
  useEffect(() => {
    const onFocus = () => {
      const latest = getSessionUser();
      if (latest?.profile.membership_status !== session?.profile.membership_status || latest?.role !== session?.role) {
        refreshSession();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session, refreshSession]);

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      tab,
      route,
      canGoBack: historyRef.current.length > 0,
      refreshKey,
      refresh,
      navigate,
      goBack,
      switchTab,
      setSession,
      logout,
      toast,
      isAdmin: Boolean(session && (session.role === 'admin' || session.role === 'treasurer')),
    }),
    [session, tab, route, refreshKey, refresh, navigate, goBack, switchTab, setSession, logout, toast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Runs a service read on mount and whenever the global refresh key changes. */
export function useServiceData<T>(loader: () => T, deps: React.DependencyList = []): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const { refreshKey } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localKey, setLocalKey] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    try {
      setData(loaderRef.current());
      setError(null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Something went wrong while loading this screen.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, localKey, ...deps]);

  const reload = useCallback(() => setLocalKey((k) => k + 1), []);
  return { data, error, reload };
}
