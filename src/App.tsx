import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { Alert, ToastStack } from './components/ui';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen, RegisterScreen } from './screens/AuthScreens';
import { AwaitingApprovalScreen } from './screens/AwaitingApprovalScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ContributionsScreen } from './screens/ContributionsScreen';
import { GroupFundScreen } from './screens/GroupFundScreen';
import { MembersScreen } from './screens/MembersScreen';
import { MemberDetailScreen } from './screens/MemberDetailScreen';
import { MoreScreen } from './screens/MoreScreen';
import { SubmitPaymentScreen } from './screens/SubmitPaymentScreen';
import { PaymentHistoryScreen } from './screens/PaymentHistoryScreen';
import { FinancialHistoryScreen } from './screens/FinancialHistoryScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { ExpenseDetailScreen } from './screens/ExpenseDetailScreen';
import { ExpenseEditScreen } from './screens/ExpenseEditScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { AdminDashboardScreen } from './screens/admin/AdminDashboardScreen';
import { ManageMembersScreen } from './screens/admin/ManageMembersScreen';
import { ContributionSettingsScreen } from './screens/admin/ContributionSettingsScreen';
import { ReviewPaymentsScreen } from './screens/admin/ReviewPaymentsScreen';
import { OutstandingMembersScreen } from './screens/admin/OutstandingMembersScreen';
import { AddExpenseScreen } from './screens/admin/AddExpenseScreen';
import { ExpenseHistoryAdminScreen } from './screens/admin/ExpenseHistoryAdminScreen';
import { FinancialReportsScreen } from './screens/admin/FinancialReportsScreen';
import { AdminAuditLogScreen } from './screens/admin/AdminAuditLogScreen';
import { RecordOfflinePaymentScreen } from './screens/admin/RecordOfflinePaymentScreen';
import { getPendingPayments, getSessionUser } from './services/databaseService';
import { isLiveSupabaseConfigured } from './services/supabaseClient';
import { liveGetSessionUser } from './services/liveAuth';
import { Crest } from './components/Crest';

/** Screens that are reachable only by authorized administrators/treasurers. */
const ADMIN_ROUTES = new Set([
  'admin-dashboard',
  'admin-members',
  'admin-contribution-settings',
  'admin-review-payments',
  'admin-outstanding',
  'admin-add-expense',
  'admin-expense-history',
  'admin-reports',
  'admin-audit-log',
  'admin-record-payment',
]);

function GuardedAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, goBack } = useApp();
  if (!isAdmin) {
    return (
      <div className="app-shell px-4 pt-4">
        <Alert tone="error" title="Administrator access required">
          You do not have permission to open this page. Only administrators and treasurers can manage
          members, contribution rules, payments and expenses.
        </Alert>
        <button type="button" onClick={goBack} className="btn-outline mt-3">
          Go back
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function isAdminSafe(): boolean {
  const latest = getSessionUser();
  if (!latest) return false;
  return latest.role === 'admin' || latest.role === 'treasurer';
}

function ScreenRouter() {
  const { session, authReady, route, tab, goBack, navigate, setSession, switchTab, toast, logout } = useApp();

  // Live mode only: brief splash while the Supabase session is restored.
  if (!authReady) {
    return (
      <div className="app-shell app-fixed flex flex-col items-center justify-center bg-navy-950 px-6 text-center">
        <Crest size={72} />
        <p className="mt-4 text-[15px] font-bold text-white">Have R/C JHS 2022</p>
        <p className="mt-1 text-[12.5px] text-navy-200">Loading your account…</p>
      </div>
    );
  }

  // Stay in sync if the session changes underneath us (approval, role change).
  useEffect(() => {
    const latest = getSessionUser();
    if (latest && session && latest.profile.membership_status !== session.profile.membership_status) {
      setSession(latest);
    }
  }, [session, setSession]);

  // Unauthenticated: welcome / login / register
  if (!session) {
    if (route?.name === 'login') {
      return (
        <LoginScreen
          onBack={goBack}
          onSuccess={() => setSession(getSessionUser())}
          onRegister={() => navigate('register')}
        />
      );
    }
    if (route?.name === 'register') {
      return (
        <RegisterScreen
          onBack={goBack}
          onLogin={() => navigate('login')}
          onRegistered={(name) => {
            toast.success(`Welcome ${name}! Your account is awaiting approval.`);
            setSession(getSessionUser());
          }}
        />
      );
    }
    return <WelcomeScreen onJoin={() => navigate('register')} onLogin={() => navigate('login')} />;
  }

  // Authenticated but not approved: hard stop on all financial data.
  if (session.profile.membership_status !== 'approved') {
    return (
      <AwaitingApprovalScreen
        profile={session.profile}
        rejected={session.profile.membership_status === 'rejected'}
        onRefresh={() => {
          if (isLiveSupabaseConfigured) {
            void liveGetSessionUser().then((latest) => {
              if (latest?.profile.membership_status === 'approved') {
                setSession(latest);
                toast.success('Your membership has been approved. Welcome!');
              } else {
                if (latest) setSession(latest);
                toast.info('Still awaiting approval. Please check again shortly.');
              }
            });
            return;
          }
          const latest = getSessionUser();
          if (latest?.profile.membership_status === 'approved') {
            setSession(latest);
            toast.success('Your membership has been approved. Welcome!');
          } else {
            toast.info('Still awaiting approval. Please check again shortly.');
          }
        }}
        onLogout={logout}
      />
    );
  }

  // Sub-routes (modals/pushed screens)
  if (route) {
    switch (route.name) {
      case 'submit-payment':
        return <SubmitPaymentScreen />;
      case 'payment-history':
        return <PaymentHistoryScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'financial-history':
        return <FinancialHistoryScreen />;
      case 'expense-detail':
        return <ExpenseDetailScreen expenseId={route.params?.id ?? ''} />;
      case 'expense-edit':
        return (
          <GuardedAdmin>
            <ExpenseEditScreen expenseId={route.params?.id ?? ''} />
          </GuardedAdmin>
        );
      case 'member-detail':
        return <MemberDetailScreen memberId={route.params?.id ?? ''} />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'profile-edit':
        return <ProfileEditScreen />;
      case 'privacy':
        return <PrivacyScreen onBack={goBack} />;
      case 'login':
      case 'register':
      case 'welcome':
        break;
      case 'admin-dashboard':
        return (
          <GuardedAdmin>
            <AdminDashboardScreen />
          </GuardedAdmin>
        );
      case 'admin-members':
        return (
          <GuardedAdmin>
            <ManageMembersScreen />
          </GuardedAdmin>
        );
      case 'admin-contribution-settings':
        return (
          <GuardedAdmin>
            <ContributionSettingsScreen />
          </GuardedAdmin>
        );
      case 'admin-review-payments':
        return (
          <GuardedAdmin>
            <ReviewPaymentsScreen />
          </GuardedAdmin>
        );
      case 'admin-outstanding':
        return (
          <GuardedAdmin>
            <OutstandingMembersScreen />
          </GuardedAdmin>
        );
      case 'admin-add-expense':
        return (
          <GuardedAdmin>
            <AddExpenseScreen />
          </GuardedAdmin>
        );
      case 'admin-expense-history':
        return (
          <GuardedAdmin>
            <ExpenseHistoryAdminScreen />
          </GuardedAdmin>
        );
      case 'admin-reports':
        return (
          <GuardedAdmin>
            <FinancialReportsScreen />
          </GuardedAdmin>
        );
      case 'admin-audit-log':
        return (
          <GuardedAdmin>
            <AdminAuditLogScreen />
          </GuardedAdmin>
        );
      case 'admin-record-payment':
        return (
          <GuardedAdmin>
            <RecordOfflinePaymentScreen />
          </GuardedAdmin>
        );
      default:
        break;
    }
  }

  // Tab screens — pending count is only available to authorised administrators.
  const pendingCount = isAdminSafe() ? getPendingPayments().length : 0;

  return (
    <>
      {tab === 'home' ? <HomeScreen /> : null}
      {tab === 'contributions' ? <ContributionsScreen /> : null}
      {tab === 'fund' ? <GroupFundScreen /> : null}
      {tab === 'members' ? <MembersScreen /> : null}
      {tab === 'more' ? <MoreScreen /> : null}
      <BottomNav active={tab} onChange={switchTab} pendingCount={pendingCount} />
    </>
  );
}

function AppChrome() {
  const { toast } = useApp();
  return (
    <>
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
      <ScreenRouter />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppChrome />
    </AppProvider>
  );
}

export { ADMIN_ROUTES };
