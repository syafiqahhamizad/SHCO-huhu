import React, { Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { DASHBOARD_TAB_VIEWS, DashboardTabs } from './components/DashboardTabs';
import { SignInPortal } from './components/SignInPortal';
import { ShieldAlert } from 'lucide-react';

const PartnerDashboardView = React.lazy(() => import('./components/views/PartnerDashboardView').then((module) => ({ default: module.PartnerDashboardView })));
const ComprehensiveDashboardView = React.lazy(() => import('./components/views/ComprehensiveDashboardView').then((module) => ({ default: module.ComprehensiveDashboardView })));
const LeadsView = React.lazy(() => import('./components/views/LeadsView').then((module) => ({ default: module.LeadsView })));
const ClientsView = React.lazy(() => import('./components/views/ClientsView').then((module) => ({ default: module.ClientsView })));
const CasesView = React.lazy(() => import('./components/views/CasesView').then((module) => ({ default: module.CasesView })));
const QuotationsView = React.lazy(() => import('./components/views/QuotationsView').then((module) => ({ default: module.QuotationsView })));
const ClientPortalView = React.lazy(() => import('./components/views/ClientPortalView').then((module) => ({ default: module.ClientPortalView })));
const AIAgentView = React.lazy(() => import('./components/views/AIAgentView').then((module) => ({ default: module.AIAgentView })));
const PracticeViews = import('./components/views/PracticeViews');
const HearingsView = React.lazy(() => PracticeViews.then((module) => ({ default: module.HearingsView })));
const CalendarView = React.lazy(() => PracticeViews.then((module) => ({ default: module.CalendarView })));
const DocumentsView = React.lazy(() => PracticeViews.then((module) => ({ default: module.DocumentsView })));
const TemplatesView = React.lazy(() => PracticeViews.then((module) => ({ default: module.TemplatesView })));
const CaseStatusView = React.lazy(() => PracticeViews.then((module) => ({ default: module.CaseStatusView })));
const TasksView = React.lazy(() => PracticeViews.then((module) => ({ default: module.TasksView })));
const DeadlinesView = React.lazy(() => PracticeViews.then((module) => ({ default: module.DeadlinesView })));
const CourtsView = React.lazy(() => PracticeViews.then((module) => ({ default: module.CourtsView })));
const ReferralView = React.lazy(() => PracticeViews.then((module) => ({ default: module.ReferralView })));
const FileClosingView = React.lazy(() => PracticeViews.then((module) => ({ default: module.FileClosingView })));
const SimplifiedAccountingView = React.lazy(() => import('./components/views/SimplifiedAccountingView').then((module) => ({ default: module.SimplifiedAccountingView })));
const SimplifiedAccountingCentreView = React.lazy(() => import('./components/views/SimplifiedAccountingCentreView').then((module) => ({ default: module.SimplifiedAccountingCentreView })));
const SystemViews = import('./components/views/SystemViews');
const WorkspaceView = React.lazy(() => SystemViews.then((module) => ({ default: module.WorkspaceView })));
const SecurityView = React.lazy(() => SystemViews.then((module) => ({ default: module.SecurityView })));
const UsersAndPermissionsView = React.lazy(() => SystemViews.then((module) => ({ default: module.UsersAndPermissionsView })));
const PracticeSettingsView = React.lazy(() => import('./components/views/PracticeSettingsView').then((module) => ({ default: module.PracticeSettingsView })));
const TrustAuditLogsView = React.lazy(() => import('./components/views/TrustAuditLogsView').then((module) => ({ default: module.TrustAuditLogsView })));
const InventoryView = React.lazy(() => import('./components/views/InventoryView').then((module) => ({ default: module.InventoryView })));
const StaffPortalView = React.lazy(() => import('./components/views/StaffPortalView').then((module) => ({ default: module.StaffPortalView })));
const MyAccountView = React.lazy(() => import('./components/views/MyAccountView').then((module) => ({ default: module.MyAccountView })));
const AboutAppView = React.lazy(() => import('./components/views/AboutAppView').then((module) => ({ default: module.AboutAppView })));
const ActivityLogsView = React.lazy(() => import('./components/views/ActivityLogsView').then((module) => ({ default: module.ActivityLogsView })));
const FirmStartCentreView = React.lazy(() => import('./components/views/FirmStartCentreView').then((module) => ({ default: module.FirmStartCentreView })));
const MyDashboardView = React.lazy(() => import('./components/views/MyDashboardView').then((module) => ({ default: module.MyDashboardView })));
const NewCaseModal = React.lazy(() => import('./components/NewCaseModal').then((module) => ({ default: module.NewCaseModal })));
const NewClientModal = React.lazy(() => import('./components/NewClientModal').then((module) => ({ default: module.NewClientModal })));

const MainContent: React.FC = () => {
  const {
    isAuthenticated,
    currentView,
    setCurrentView,
    currentUser,
    canViewModule,
    isNewCaseModalOpen,
    setIsNewCaseModalOpen,
    isRegisterClientModalOpen,
    setIsRegisterClientModalOpen,
  } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <SignInPortal />
        <Toast />
      </>
    );
  }

  const renderView = () => {
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
              Your assigned user role (<strong>{currentUser.role}</strong>) does not have permission to view the <strong>{currentView}</strong> module.
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
      case 'partnerDashboard':
      case 'partner-dashboard':
        return <PartnerDashboardView />;
      case 'clientPortal':
      case 'client-portal':
        return <ClientPortalView />;
      case 'staffPortal':
      case 'staff-portal':
        return <StaffPortalView />;
      case 'leads':
        return <LeadsView />;
      case 'clients':
        return <ClientsView />;
      case 'cases':
        return <CasesView />;
      case 'quotations':
      case 'billing':
        return <QuotationsView />;
      case 'hearings':
        return <HearingsView />;
      case 'calendar':
        return <CalendarView />;
      case 'documents':
        return <DocumentsView />;
      case 'templates':
        return <TemplatesView />;
      case 'tasks':
      case 'caseStatus':
      case 'case-status':
        return <CaseStatusView />;
      case 'deadlines':
        return <DeadlinesView />;
      case 'courts':
        return <CourtsView />;
      case 'referral':
      case 'referrals':
        return <ReferralView />;
      case 'fileClosing':
      case 'file-closing':
        return <FileClosingView />;

      // Accounting & Finance (Simplified)
      case 'accountingCentre':
      case 'accounting-centre':
      case 'accounting':
        return <SimplifiedAccountingCentreView />;
      case 'bankAccounts':
      case 'bank-accounts':
      case 'bankReconciliation':
      case 'bank-reconciliation':
      case 'reimbursements':
      case 'reimbursements-claims':
      case 'claimsManagement':
      case 'claims-management':
      case 'travelClaims':
      case 'travel-claims':
      case 'expenses':
      case 'paymentVouchers':
      case 'pv':
      case 'time':
      case 'retainers':
      case 'statement':
      case 'officeAccounts':
      case 'office-accounts':
      case 'coa':
      case 'gl':
      case 'tb':
      case 'trialBalance':
      case 'balanceSheet':
      case 'balance-sheet':
      case 'cashFlow':
      case 'cashflow':
      case 'billingReports':
      case 'reports-billing':
      case 'trustReports':
      case 'reports-trust':
      case 'officeReports':
      case 'reports-office':
        return <SimplifiedAccountingView />;
      
      case 'trustAuditLogs':
      case 'trust-audit-logs':
        return <TrustAuditLogsView />;
      case 'inventory':
        return <InventoryView />;

      // System Integrations
      case 'workspace':
        return <WorkspaceView />;
      case 'security':
        return <SecurityView />;
      case 'logs':
        return <ActivityLogsView />;
      case 'users':
      case 'roles':
        return <UsersAndPermissionsView />;
      case 'practiceSettings':
      case 'practice-settings':
      case 'firmSettings':
      case 'firm-settings':
      case 'settings':
        return <PracticeSettingsView />;
      case 'aiAgent':
      case 'ai-agent':
        return <AIAgentView />;
      case 'about':
        return <AboutAppView />;
      case 'account':
        return <MyAccountView />;

      default:
        return <MyDashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F6F4EE] dark:bg-[#0A0E1A] text-slate-800 dark:text-[#E8ECFF] font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F6F4EE] dark:bg-[#0A0E1A]">
        <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-6 overflow-y-auto bg-[#F6F4EE] dark:bg-[#0A0E1A]">
          <Header />
          {DASHBOARD_TAB_VIEWS.includes(currentView) && (
            <div className="mt-4 sm:mt-6">
              <DashboardTabs />
            </div>
          )}
          <div className="mt-4 sm:mt-6">
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
        {isNewCaseModalOpen && (
          <NewCaseModal
            isOpen={isNewCaseModalOpen}
            onClose={() => setIsNewCaseModalOpen(false)}
          />
        )}
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
