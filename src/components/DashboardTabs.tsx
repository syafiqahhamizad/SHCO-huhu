import React from 'react';
import { Building2, Landmark, LayoutDashboard, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { finRoleKey, finGrants, finTabsFor } from '../lib/financeAccess';

/** Views that show the dashboard tab strip above the page. */
export const DASHBOARD_TAB_VIEWS: string[] = [
  'dashboard',
  'myDashboard',
  'leadsReferrals',
  'leads-referrals',
  'firmDashboard',
];

/** Dashboard tab strip (design: My Dashboard → dashTabs). */
export const DashboardTabs: React.FC = () => {
  const { currentView, setCurrentView, canViewModule, currentRole, currentUser, isAdmin } = useApp() as any;

  // "Accounts & Compliance" opens the first Accounts & Finance tab this person may use
  // (none for staff, so the tab is left out for them).
  const finView = finTabsFor(finRoleKey(currentRole, currentUser, isAdmin), finGrants(currentUser))[0]?.[3];

  const tabs = [
    {
      key: 'myDashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      action: () => setCurrentView('dashboard'),
      active: currentView === 'dashboard' || currentView === 'myDashboard',
      visible: canViewModule('myDashboard'),
    },
    {
      key: 'leadsReferrals',
      label: 'Leads & Referrals',
      icon: Share2,
      action: () => setCurrentView('leadsReferrals'),
      active: currentView === 'leadsReferrals' || currentView === 'leads-referrals',
      visible: canViewModule('leadsReferrals'),
    },
    {
      key: 'firmDashboard',
      label: 'Firm-Wide Dashboard',
      icon: Building2,
      action: () => setCurrentView('firmDashboard'),
      active: currentView === 'firmDashboard',
      visible: canViewModule('firmDashboard'),
    },
    {
      key: 'accounts',
      label: 'Accounts & Compliance',
      icon: Landmark,
      action: () => finView && setCurrentView(finView),
      active: false,
      visible: !!finView && canViewModule(finView),
    },
  ].filter((t) => t.visible);

  return (
    <section aria-label="Dashboard sections" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DDE3EB] bg-white p-1.5 shadow-[0_1px_2px_rgba(22,34,58,.05)]">
      {tabs.map(({ key, label, icon: TabIcon, action, active }) => (
        <button
          key={key}
          type="button"
          onClick={action}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-[34px] items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-[#3D6B9C] ${
            active ? 'bg-[#16223A] text-white' : 'bg-transparent text-[#5B6478] hover:text-[#16223A]'
          }`}
        >
          <TabIcon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </section>
  );
};
