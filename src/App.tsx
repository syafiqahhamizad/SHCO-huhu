import React, { Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PageToolbar } from './components/PageToolbar';
import { Toast } from './components/Toast';
import { DASHBOARD_TAB_VIEWS, DashboardTabs } from './components/DashboardTabs';
import { SignInPortal } from './components/SignInPortal';
import { ShieldAlert } from 'lucide-react';
import { FINANCE_VIEW_TO_TAB, isFinanceView } from './lib/financeAccess';

const ComprehensiveDashboardView = React.lazy(() => import('./components/views/ComprehensiveDashboardView').then((module) => ({ default: module.ComprehensiveDashboardView })));
const LeadsReferralsView = React.lazy(() => import('./components/views/LeadsReferralsView').then((module) => ({ default: module.LeadsReferralsView })));
const ClientsView = React.lazy(() => import('./components/views/ClientsView').then((module) => ({ default: module.ClientsView })));
const CasesView = React.lazy(() => import('./components/views/CasesView').then((module) => ({ default: module.CasesView })));
const ServiceLogPage = React.lazy(() => import('./components/views/cases/ServiceLogPage').then((module) => ({ default: module.ServiceLogPage })));
const ClientPortalView = React.lazy(() => import('./components/views/ClientPortalView').then((module) => ({ default: module.ClientPortalView })));
const PracticeViews = import('./components/views/PracticeViews');
const HearingsView = React.lazy(() => PracticeViews.then((module) => ({ default: module.HearingsView })));
const CalendarView = React.lazy(() => PracticeViews.then((module) => ({ default: module.CalendarView })));
const CaseStatusView = React.lazy(() => PracticeViews.then((module) => ({ default: module.CaseStatusView })));
const DeadlinesView = React.lazy(() => PracticeViews.then((module) => ({ default: module.DeadlinesView })));
const ReferralView = React.lazy(() => PracticeViews.then((module) => ({ default: module.ReferralView })));
const FileClosingView = React.lazy(() => PracticeViews.then((module) => ({ default: module.FileClosingView })));
const SimplifiedAccountingView = React.lazy(() => import('./components/views/SimplifiedAccountingView').then((module) => ({ default: module.SimplifiedAccountingView })));
// Accounts & Finance (design pack finance_latest) replaces Accounting Centre, Finance & Billing,
// Quotations, reimbursement approvals and the trust pages as what users see. The old view files
// are kept (not deleted) but no longer routed to for these ids.
const AccountsFinanceView = React.lazy(() => import('./components/views/finance/AccountsFinanceView').then((module) => ({ default: module.AccountsFinanceView })));
const PracticeSettingsView = React.lazy(() => import('./components/views/PracticeSettingsView').then((module) => ({ default: module.PracticeSettingsView })));
const TrustAuditLogsView = React.lazy(() => import('./components/views/TrustAuditLogsView').then((module) => ({ default: module.TrustAuditLogsView })));
const InventoryView = React.lazy(() => import('./components/views/InventoryView').then((module) => ({ default: module.InventoryView })));
const StaffPortalView = React.lazy(() => import('./components/views/staff/StaffPortalView').then((module) => ({ default: module.StaffPortalView })));
const MyClaimsView = React.lazy(() => import('./components/views/staff/MyClaimsView').then((module) => ({ default: module.MyClaimsView })));
const MyAccountView = React.lazy(() => import('./components/views/MyAccountView').then((module) => ({ default: module.MyAccountView })));
const AboutAppView = React.lazy(() => import('./components/views/AboutAppView').then((module) => ({ default: module.AboutAppView })));
const ActivityLogsView = React.lazy(() => import('./components/views/ActivityLogsView').then((module) => ({ default: module.ActivityLogsView })));
const FirmStartCentreView = React.lazy(() => import('./components/views/FirmStartCentreView').then((module) => ({ default: module.FirmStartCentreView })));
const MyDashboardView = React.lazy(() => import('./components/views/MyDashboardView').then((module) => ({ default: module.MyDashboardView })));
const NewClientModal = React.lazy(() => import('./components/NewClientModal').then((module) => ({ default: module.NewClientModal })));

const SETTINGS_VIEWS = ['users', 'roles', 'practiceSettings', 'practice-settings', 'firmSettings', 'firm-settings', 'settings'];

const MainContent: React.FC = () => {
  const {
    isAuthenticated,
    currentView,
    setCurrentView,
    currentUser,
    currentRole,
    canViewModule,
    isNewCaseModalOpen,
    setIsNewCaseModalOpen,
    isRegisterClientModalOpen,
    setIsRegisterClientModalOpen,
    cloudAccessNotice,
    retryCloudSync,
    logoutUser,
    setCurrentCaseId,
  } = useApp();

  // "Open new file" (from anywhere, incl. Leads → open a file with prefill) is a page in Cases.
  React.useEffect(() => {
    if (isNewCaseModalOpen && currentView !== 'cases') {
      setCurrentCaseId(null);
      setCurrentView('cases');
    }
  }, [isNewCaseModalOpen, currentView, setCurrentView, setCurrentCaseId]);
  // Leaving Cases while the New File page is open closes it.
  const prevView = React.useRef(currentView);
  React.useEffect(() => {
    if (prevView.current === 'cases' && currentView !== 'cases' && isNewCaseModalOpen) setIsNewCaseModalOpen(false);
    prevView.current = currentView;
  }, [currentView, isNewCaseModalOpen, setIsNewCaseModalOpen]);

  if (!isAuthenticated) {
    return (
      <>
        <SignInPortal />
        <Toast />
      </>
    );
  }

  // Signed in, but the firm's cloud data refused this person at startup (usually: the access
  // list hasn't been published for them yet). Block the app rather than let them work unsynced.
  if (cloudAccessNotice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#F6F8FA' }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#fff', border: '1px solid #DDE3EB', borderRadius: 12, padding: 24, color: '#16223A', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Waiting for access</div>
          <p style={{ margin: '0 0 8px' }}>Signed in as <strong>{currentUser.email}</strong>.</p>
          <p style={{ margin: '0 0 16px', color: '#5B6478' }}>{cloudAccessNotice}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => logoutUser()} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer' }}>Sign out</button>
            <button type="button" onClick={() => retryCloudSync()} style={{ border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer' }}>Try again</button>
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  // Client Portal: the client-facing page has its own shell (no firm Sidebar / Header).
  if ((currentView === 'clientPortal' || currentView === 'client-portal') && canViewModule('clientPortal')) {
    return (
      <>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F4F1EA' }} />}>
          <ClientPortalView />
        </Suspense>
        <Toast />
      </>
    );
  }

  const renderView = () => {
    // Finance & Accounts decides access itself (Managing Partner & Accounts: all tabs; Partners:
    // Billing, Client Account, Approvals; Reviewer: Client Account + Books) — see lib/financeAccess.
    if (isFinanceView(currentView)) {
      return <AccountsFinanceView initialTab={FINANCE_VIEW_TO_TAB[currentView]} />;
    }
    // Firm & Practice Settings (incl. Users & Roles, which replaced Users & Permissions) gates
    // itself and tells everyone else it is Managing Partner only.
    if (SETTINGS_VIEWS.includes(currentView)) {
      return <PracticeSettingsView />;
    }
    if (!canViewModule(currentView)) {
      return (
        <div className="bg-white border border-rose-200 rounded-lg sm:rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto my-6 sm:my-12 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-lg sm:text-xl text-[#16223A]">
              Access Restricted
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
              Your assigned user role (<strong>{currentRole || currentUser.role}</strong>) does not have permission to view the <strong>{currentView}</strong> module.
            </p>
          </div>

          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-left text-xs space-y-1 font-mono overflow-x-auto">
            <div className="font-bold text-amber-900 font-sans">Role Policy:</div>
            <div className="text-[#16223A] break-words">User: <strong>{currentUser.name}</strong></div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-lg text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#16223A]"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      // Core Practice
      case 'firmStartCentre':
        return <FirmStartCentreView />;
      case 'myDashboard':
        return <MyDashboardView />;
      case 'dashboard':
        return <MyDashboardView />;
      case 'firmDashboard':
        return <ComprehensiveDashboardView />;
      case 'staffPortal':
      case 'staff-portal':
        return <StaffPortalView />;
      case 'reimbursements':
        return <MyClaimsView />;
      case 'leads':
      case 'leadsReferrals':
      case 'leads-referrals':
        return <LeadsReferralsView />;
      case 'clients':
        return <ClientsView />;
      case 'cases':
        return <CasesView />;
      case 'hearings':
        return <HearingsView />;
      case 'calendar':
        return <CalendarView />;
      case 'tasks':
      case 'caseStatus':
      case 'case-status':
        return <CaseStatusView />;
      case 'deadlines':
        return <DeadlinesView />;
      case 'serviceLog':
        return <ServiceLogPage />;
      case 'referral':
      case 'referrals':
        return <ReferralView />;
      case 'fileClosing':
      case 'file-closing':
        return <FileClosingView />;

      // Accounts & Finance ids (accountingCentre, billing, quotations, time, retainers, statement,
      // officeAccounts, approvals, payroll, reports, coa, gl, trialBalance, …) are handled above.
      // Bank accounts / reconciliation and staff claims entry stay on SimplifiedAccountingView.
      case 'bankAccounts':
      case 'bank-accounts':
      case 'bankReconciliation':
      case 'bank-reconciliation':
        return <SimplifiedAccountingView />;

      case 'trustAuditLogs':
      case 'trust-audit-logs':
        return <TrustAuditLogsView />;
      case 'inventory':
        return <InventoryView />;

      // System Integrations
      case 'logs':
        return <ActivityLogsView />;
      case 'users':
      case 'roles':
      case 'practiceSettings':
      case 'practice-settings':
      case 'firmSettings':
      case 'firm-settings':
      case 'settings':
        return <PracticeSettingsView />;
      case 'about':
        return <AboutAppView />;
      case 'account':
        return <MyAccountView />;

      default:
        return <MyDashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F6F8FA] dark:bg-[#0A0E1A] text-slate-800 dark:text-[#E8ECFF] font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F6F8FA] dark:bg-[#0A0E1A]">
        {/* Navigation shell: Header first, then the optional page toolbar, then the page. */}
        <main className="flex-1 min-w-0 flex flex-col gap-4 p-4 pt-16 md:px-7 md:pt-6 md:pb-12 overflow-y-auto bg-[#F6F8FA] dark:bg-[#0A0E1A]">
          <Header />
          <PageToolbar />
          {DASHBOARD_TAB_VIEWS.includes(currentView) && !isFinanceView(currentView) && <DashboardTabs />}
          <div className="min-w-0">
            <Suspense
              fallback={(
                <div className="rounded-xl border border-[#E1DCCF] bg-white p-8 text-center text-xs font-semibold text-slate-500">
                  Loading module...
                </div>
              )}
            >
              {renderView()}
            </Suspense>
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        {isRegisterClientModalOpen && (
          <NewClientModal
            isOpen={isRegisterClientModalOpen}
            onClose={() => setIsRegisterClientModalOpen(false)}
          />
        )}
      </Suspense>
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
