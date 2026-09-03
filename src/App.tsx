import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { NewCaseModal } from './components/NewCaseModal';
import { NewClientModal } from './components/NewClientModal';
import { SignInPortal } from './components/SignInPortal';
import { ShieldAlert } from 'lucide-react';

// Views
import { DashboardView } from './components/views/DashboardView';
import { PartnerDashboardView } from './components/views/PartnerDashboardView';
import { LeadsView } from './components/views/LeadsView';
import { ClientsView } from './components/views/ClientsView';
import { CasesView } from './components/views/CasesView';
import { QuotationsView } from './components/views/QuotationsView';
import { ClientPortalView } from './components/views/ClientPortalView';

import {
  HearingsView,
  CalendarView,
  DocumentsView,
  TemplatesView,
  CaseStatusView,
  TasksView,
  DeadlinesView,
  CourtsView,
  ReferralView,
  FileClosingView,
} from './components/views/PracticeViews';

import { SimplifiedAccountingView } from './components/views/SimplifiedAccountingView';
import { SimplifiedAccountingCentreView } from './components/views/SimplifiedAccountingCentreView';

import {
  WorkspaceView,
  SecurityView,
  SettingsView,
  UsersAndPermissionsView,
} from './components/views/SystemViews';
import { PracticeSettingsView } from './components/views/PracticeSettingsView';
import { TrustAuditLogsView } from './components/views/TrustAuditLogsView';
import { InventoryView } from './components/views/InventoryView';
import { StaffPortalView } from './components/views/StaffPortalView';
import { MyAccountView } from './components/views/MyAccountView';
import { AboutAppView } from './components/views/AboutAppView';
import { ActivityLogsView } from './components/views/ActivityLogsView';
import { FirmStartCentreView } from './components/views/FirmStartCentreView';

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
      case 'dashboard':
        return <DashboardView />;
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
      case 'invoices':
      case 'payments':
      case 'receipts':
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
        return <PracticeSettingsView />;
      case 'firmSettings':
      case 'firm-settings':
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutAppView />;
      case 'account':
        return <MyAccountView />;

      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F6F4EE] dark:bg-[#0A0E1A] text-slate-800 dark:text-[#E8ECFF] font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F6F4EE] dark:bg-[#0A0E1A]">
        <main className="flex-1 p-4 pt-16 sm:p-6 sm:pt-6 overflow-y-auto bg-[#F6F4EE] dark:bg-[#0A0E1A]">
          <Header />
          <div className="mt-4 sm:mt-6">
            {renderView()}
          </div>
        </main>
      </div>
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
      />
      <NewClientModal
        isOpen={isRegisterClientModalOpen}
        onClose={() => setIsRegisterClientModalOpen(false)}
      />
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
