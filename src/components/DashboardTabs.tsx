import React from 'react';
import { BriefcaseBusiness, FolderOpen, LayoutDashboard, Receipt } from 'lucide-react';
import { useApp } from '../context/AppContext';

type DashboardTabsProps = {
  myDashboardCount?: number;
};

export const DashboardTabs: React.FC<DashboardTabsProps> = ({ myDashboardCount }) => {
  const { currentView, setCurrentView } = useApp() as any;

  const isAccountingView = [
    'accountingCentre',
    'accounting-centre',
    'accounting',
    'bankAccounts',
    'bank-accounts',
    'bankReconciliation',
    'bank-reconciliation',
    'reimbursements',
    'reimbursements-claims',
    'claimsManagement',
    'claims-management',
    'travelClaims',
    'travel-claims',
    'expenses',
    'paymentVouchers',
    'pv',
    'time',
    'retainers',
    'statement',
    'officeAccounts',
    'office-accounts',
    'coa',
    'gl',
    'tb',
    'trialBalance',
    'balanceSheet',
    'balance-sheet',
    'cashFlow',
    'cashflow',
    'billingReports',
    'reports-billing',
    'trustReports',
    'reports-trust',
    'officeReports',
    'reports-office',
  ].includes(currentView);

  const tabs = [
    {
      key: 'myDashboard',
      label: 'My Dashboard',
      icon: FolderOpen,
      action: () => setCurrentView('dashboard'),
      active: currentView === 'dashboard' || currentView === 'myDashboard',
      count: myDashboardCount,
    },
    {
      key: 'partnerDashboard',
      label: 'Partner Dashboard',
      icon: LayoutDashboard,
      action: () => setCurrentView('partnerDashboard'),
      active: currentView === 'partnerDashboard' || currentView === 'partner-dashboard',
    },
    {
      key: 'firmDashboard',
      label: 'Firm-Wide Matters',
      icon: BriefcaseBusiness,
      action: () => setCurrentView('firmDashboard'),
      active: currentView === 'firmDashboard',
    },
    {
      key: 'accountingCentre',
      label: 'Accounting Centre',
      icon: Receipt,
      action: () => setCurrentView('accountingCentre'),
      active: isAccountingView,
    },
  ];

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D9D3C4] bg-white p-2.5 shadow-md">
      {tabs.map(({ key, label, icon: TabIcon, action, active, count }) => (
        <button
          key={key}
          type="button"
          onClick={action}
          className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#A9814A] ${
            active ? 'bg-[#A9814A] text-[#1A1204] shadow-md' : 'text-[#33415C] hover:bg-[#F9F7F2] hover:text-[#16223A]'
          }`}
        >
          <TabIcon className="h-4 w-4" />
          <span>{label}</span>
          {count !== undefined && <span className="rounded bg-white/35 px-1.5 py-0.5 text-[10px]">{count}</span>}
        </button>
      ))}
      <span className="ml-auto flex items-center gap-1.5 pr-1 text-[10.5px] text-[#5B6478]">
        <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#0E4C55] text-[8px] text-white">✓</span>
        Google Tasks synced just now
      </span>
    </section>
  );
};
