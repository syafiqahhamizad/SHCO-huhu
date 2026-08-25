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

import { ReimbursementsClaimsView } from './components/views/ReimbursementsView';

import {
  TimeView,
  InvoicesView,
  PaymentsView,
  ReceiptsView,
  RetainersView,
  StatementView,
  OfficeAccountsView,
  CoaView,
  GLView,
  TrialBalanceView,
  BalanceSheetView,
  CashFlowView,
  BillingReportsView,
  TrustReportsView,
  OfficeReportsView,
} from './components/views/AccountingViews';

import {
  WorkspaceView,
  SecurityView,
  SettingsView,
  UsersAndPermissionsView,
} from './components/views/SystemViews';
import { PracticeSettingsView } from './components/views/PracticeSettingsView';
import { BankAccountsView } from './components/views/BankAccountsView';
import { BankReconciliationView } from './components/views/BankReconciliationView';
import { TrustAuditLogsView } from './components/views/TrustAuditLogsView';
import { InventoryView } from './components/views/InventoryView';
import { StaffPortalView } from './components/views/StaffPortalView';
import { MyAccountView } from './components/views/MyAccountView';
import { AboutAppView } from './components/views/AboutAppView';
import { ActivityLogsView } from './components/views/ActivityLogsView';

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
        <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-2xl mx-auto my-12 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-[#16223A]">
              Access Restricted — Insufficient Role Privileges
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
              Your assigned user role (<strong>{currentUser.role}</strong>) does not have permission to view or access the <strong>{currentView}</strong> module.
            </p>
          </div>

          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-left text-xs space-y-1 font-mono">
            <div className="font-bold text-amber-900 font-sans">Role Policy Enforcement:</div>
            <div className="text-[#16223A]">• Current User: <strong>{currentUser.name}</strong> ({currentUser.email})</div>
            <div className="text-[#16223A]">• Access Control Authority: <strong>Super Admin Syafiqah Hamizad</strong> (syafiqahhamizad@shcolaw.com)</div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-5 py-2.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      // Core Practice
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

      // Accounting & Finance
      case 'bankAccounts':
      case 'bank-accounts':
        return <BankAccountsView />;
      case 'bankReconciliation':
      case 'bank-reconciliation':
        return <BankReconciliationView />;
      case 'trustAuditLogs':
      case 'trust-audit-logs':
        return <TrustAuditLogsView />;
      case 'inventory':
        return <InventoryView />;
      case 'reimbursements':
      case 'reimbursements-claims':
      case 'claimsManagement':
      case 'claims-management':
        return <ReimbursementsClaimsView initialTab="OVERVIEW" />;
      case 'travelClaims':
      case 'travel-claims':
        return <ReimbursementsClaimsView initialTab="TRAVEL" />;
      case 'expenses':
        return <ReimbursementsClaimsView initialTab="DISBURSEMENTS" />;
      case 'paymentVouchers':
      case 'pv':
        return <ReimbursementsClaimsView initialTab="VOUCHERS" />;
      case 'time':
        return <TimeView />;
      case 'invoices':
        return <InvoicesView />;
      case 'payments':
        return <PaymentsView />;
      case 'receipts':
        return <ReceiptsView />;
      case 'retainers':
        return <RetainersView />;
      case 'statement':
        return <StatementView />;
      case 'officeAccounts':
      case 'office-accounts':
        return <OfficeAccountsView />;
      case 'coa':
        return <CoaView />;
      case 'gl':
        return <GLView />;
      case 'tb':
      case 'trialBalance':
        return <TrialBalanceView />;
      case 'balanceSheet':
      case 'balance-sheet':
        return <BalanceSheetView />;
      case 'cashFlow':
      case 'cashflow':
        return <CashFlowView />;

      // Partner Reports
      case 'billingReports':
      case 'reports-billing':
        return <BillingReportsView />;
      case 'trustReports':
      case 'reports-trust':
        return <TrustReportsView />;
      case 'officeReports':
      case 'reports-office':
        return <OfficeReportsView />;

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
    <div className="flex min-h-screen bg-[#F6F4EE] text-slate-800 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto">
          <Header />
          {renderView()}
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
