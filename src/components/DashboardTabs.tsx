import React from 'react';
import { Building2, Crown, Landmark, LayoutDashboard } from 'lucide-react';
import { useApp } from '../context/AppContext';

type DashboardTabsProps = {
  myDashboardCount?: number;
};

export const DASHBOARD_TAB_VIEWS = [
  'dashboard',
  'myDashboard',
  'firmDashboard',
  'partnerDashboard',
  'partner-dashboard',
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
] as const;

export const DashboardTabs: React.FC<DashboardTabsProps> = ({ myDashboardCount }) => {
  const { currentView, setCurrentView } = useApp() as any;

  const isAccountingView = DASHBOARD_TAB_VIEWS.includes(currentView);

  const tabs = [
    {
      key: 'myDashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      action: () => setCurrentView('dashboard'),
      active: currentView === 'dashboard' || currentView === 'myDashboard',
      count: myDashboardCount,
    },
    {
      key: 'partnerDashboard',
      label: 'Partner Dashboard',
      icon: Crown,
      action: () => setCurrentView('partnerDashboard'),
      active: currentView === 'partnerDashboard' || currentView === 'partner-dashboard',
    },
    {
      key: 'firmDashboard',
      label: 'Firm-Wide Dashboard',
      icon: Building2,
      action: () => setCurrentView('firmDashboard'),
      active: currentView === 'firmDashboard',
    },
    {
      key: 'accountingCentre',
      label: 'Accounts & Compliance',
      icon: Landmark,
      action: () => setCurrentView('accountingCentre'),
      active: isAccountingView,
    },
  ];

  return (
    <section aria-label="Dashboard sections" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E1DCCF] bg-white p-2 shadow-[0_1px_2px_rgba(22,34,58,.05)]">
      {tabs.map(({ key, label, icon: TabIcon, action, active, count }) => (
        <button
          key={key}
          type="button"
          onClick={action}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-2.5 text-[12px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#A9814A] ${
            active ? 'bg-[#16223A] text-white shadow-sm' : 'bg-transparent text-[#4C5361] hover:bg-[#F9F7F2] hover:text-[#16223A]'
          }`}
        >
          <TabIcon className="h-3.5 w-3.5" />
          <span>{label}</span>
          {count !== undefined && <span className={`rounded px-1.5 py-0.5 text-[9.5px] ${active ? 'bg-[#E4C79A] text-[#16223A]' : 'bg-[#EDE8DD] text-[#5B6478]'}`}>{count}</span>}
        </button>
      ))}
      <span className="ml-auto flex items-center gap-1.5 pr-1 text-[10.5px] text-[#5B6478]">
        <span className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] text-[#0E4C55]">↻</span>
        Google Tasks synced <strong className="font-bold text-[#0E4C55]">just now</strong>
      </span>
    </section>
  );
};
