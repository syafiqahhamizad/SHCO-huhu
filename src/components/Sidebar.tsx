import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FIN_TABS, FINANCE_VIEW_TO_TAB, canSeeFinanceNav, finGrants, finRoleKey, isFinanceView } from '../lib/financeAccess';
import {
  Home,
  LayoutDashboard,
  UserCheck,
  UserCog,
  Receipt,
  Users,
  Scale,
  Clock,
  Calendar,
  Activity,
  Flag,
  FileCheck2,
  Landmark,
  FolderX,
  BarChart3,
  FileText,
  Building,
  BadgeCheck,
  Wallet,
  BookOpen,
  Settings,
  BookMarked,
  History,
  Info,
  LifeBuoy,
  User,
  LogOut,
  Menu,
  X,
  FolderOpen,
} from 'lucide-react';

/* Navigation shell (design pack `SHCO Sidebar.dc.html`). User identity and Sign out live ONLY in
   the footer of this sidebar — no header or page renders its own sign-out control. */

const AMBER = '#FCD34D';
const EMERALD_400 = '#34D399';
const EMERALD_300 = '#6EE7B7';
const BLUE_300 = '#93C5FD';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Icon tint when inactive (default #DDE3EB). The active item's icon is always white. */
  color?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// Firm decisions on top of the design-pack menu: no "AI Agent" (AI was removed from the app);
// no "Courts & Judges" (removed); "Referral" dropped from the menu (route kept);
// "Users & Roles" lives inside Firm & Practice Settings.
const NAV_GROUPS: NavGroup[] = [
  {
    group: 'General',
    items: [
      { id: 'firmStartCentre', label: 'Firm Start Centre', icon: Home, color: AMBER },
      { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      { id: 'clientPortal', label: 'Client Access Portal', icon: UserCheck, color: AMBER },
      { id: 'staffPortal', label: 'Staff Portal', icon: UserCog, color: AMBER },
      { id: 'reimbursements', label: 'My Claims', icon: Receipt, color: AMBER },
    ],
  },
  {
    group: 'Practice',
    items: [
      { id: 'leadsReferrals', label: 'Leads & Referrals', icon: UserCheck },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'cases', label: 'Cases', icon: Scale },
      { id: 'hearings', label: 'Hearings', icon: Clock },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'caseStatus', label: 'Case Status', icon: Activity },
      { id: 'deadlines', label: 'Deadlines', icon: Flag },
      { id: 'serviceLog', label: 'Service Log', icon: FileCheck2 },
      { id: 'fileClosing', label: 'File Closing', icon: FolderX },
    ],
  },
  {
    // Visibility per role comes from lib/financeAccess (hidden, not just locked).
    group: 'Finance & Accounts',
    items: [
      { id: 'accountingCentre', label: 'Finance Home', icon: BarChart3, color: AMBER },
      { id: 'billing', label: 'Billing & Collections', icon: FileText, color: AMBER },
      { id: 'retainers', label: 'Client Account (SAR 1990)', icon: Building, color: EMERALD_400 },
      { id: 'officeAccounts', label: 'Office Account', icon: Landmark, color: BLUE_300 },
      { id: 'approvals', label: 'Approvals', icon: BadgeCheck, color: AMBER },
      { id: 'payroll', label: 'Payroll', icon: Wallet, color: EMERALD_300 },
      { id: 'accounting', label: 'Accounting', icon: BookOpen, color: BLUE_300 },
      { id: 'reports', label: 'Reports', icon: FolderOpen, color: BLUE_300 },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'practiceSettings', label: 'Firm & Practice Settings', icon: Settings },
      { id: 'inventory', label: 'Office Inventory & Library', icon: BookMarked },
      { id: 'logs', label: 'Activity Logs', icon: History },
      { id: 'guide', label: 'Staff Guide', icon: LifeBuoy },
      { id: 'about', label: 'About App', icon: Info },
      { id: 'account', label: 'My Account', icon: User },
    ],
  },
];

/** Routed view ids (aliases and sub-pages) → the sidebar item that should show as active. */
const VIEW_ALIASES: Record<string, string> = {
  myDashboard: 'dashboard',
  firmDashboard: 'dashboard',
  'client-portal': 'clientPortal',
  'staff-portal': 'staffPortal',
  leads: 'leadsReferrals',
  'leads-referrals': 'leadsReferrals',
  referral: 'leadsReferrals',
  referrals: 'leadsReferrals',
  tasks: 'caseStatus',
  'case-status': 'caseStatus',
  'file-closing': 'fileClosing',
  users: 'practiceSettings',
  roles: 'practiceSettings',
  settings: 'practiceSettings',
  firmSettings: 'practiceSettings',
  'firm-settings': 'practiceSettings',
  'practice-settings': 'practiceSettings',
  bankAccounts: 'officeAccounts',
  'bank-accounts': 'officeAccounts',
  bankReconciliation: 'officeAccounts',
  'bank-reconciliation': 'officeAccounts',
  trustAuditLogs: 'retainers',
  'trust-audit-logs': 'retainers',
};

/** The sidebar item id that matches the current view. */
const activeNavId = (view: string): string => {
  if (isFinanceView(view)) {
    const tab = FINANCE_VIEW_TO_TAB[view];
    return FIN_TABS.find((t) => t[0] === tab)?.[3] || view;
  }
  return VIEW_ALIASES[view] || view;
};

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    setCurrentCaseId,
    currentRole,
    isAdmin,
    canViewModule,
    currentUser,
    logoutUser,
  } = useApp();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const rk = finRoleKey(currentRole, currentUser, isAdmin);
  const active = activeNavId(currentView);
  const roleLabel = rk === 'M' ? 'Managing Partner' : String(currentRole || currentUser?.role || 'Staff');
  const userName = currentUser?.name || 'User';

  const handleNavItemClick = (itemId: string) => {
    setCurrentView(itemId);
    setCurrentCaseId(null);
    setIsMobileSidebarOpen(false);
  };

  // Finance items follow lib/financeAccess; everything else follows canViewModule. Groups left
  // empty for the role are hidden.
  const groups = NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => (isFinanceView(item.id) ? canSeeFinanceNav(item.id, rk, finGrants(currentUser)) : canViewModule(item.id))),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile menu toggle — small screens only */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 bg-[#3D6B9C] text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3D6B9C]"
        aria-label={isMobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileSidebarOpen}
        aria-controls="sidebar-nav"
      >
        {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isMobileSidebarOpen && (
        <button
          className="md:hidden fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px]"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        id="sidebar-nav"
        className={`fixed top-0 left-0 h-screen overflow-y-auto md:relative md:h-auto md:min-h-screen md:overflow-visible w-[min(86vw,280px)] md:w-[242px] shrink-0 box-border bg-[#16223A] text-[#DDE3EB] p-5 flex flex-col justify-between border-r border-amber-900/20 shadow-xl select-none font-sans transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 z-40' : '-translate-x-full md:translate-x-0'
        }`}
        aria-label="Main navigation"
      >
        <div>
          {/* Firm mark */}
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/10">
            <div className="w-8 h-8 rounded-full border-[1.5px] border-[#3D6B9C] flex items-center justify-center font-serif font-bold text-xs text-[#3D6B9C] bg-[#3D6B9C]/10 shrink-0 shadow-inner box-border">
              SH
            </div>
            <div>
              <div className="shco-brand-name font-roxborough text-[13px] font-bold leading-tight tracking-wide uppercase" style={{ color: '#8FB3DE' }}>
                SYAFIQAH HAMIZAD &amp; CO
              </div>
              <div className="shco-brand-subtitle font-termes text-[10px] tracking-tight font-medium italic mt-0.5" style={{ color: '#8FB3DE' }}>
                Advocates &amp; Solicitors | Syarie Counsel
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {groups.map((group) => (
              <div key={group.group}>
                <div className="shco-nav-ink text-[9.5px] uppercase tracking-[0.1em] text-[color:#5B6478] p-2 mb-1 font-bold">{group.group}</div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive = active === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavItemClick(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        title={item.label}
                        className={`shco-nav-ink w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] text-left cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB3DE] ${
                          isActive
                            ? 'bg-[#3D6B9C] text-white font-semibold shadow-md'
                            : 'font-medium text-[#DDE3EB] hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? '#FFFFFF' : item.color || '#DDE3EB' }} aria-hidden />
                        <span className="shco-nav-ink truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — the ONLY place for user identity and Sign out */}
        <div className="mt-6 pt-3 border-t border-white/[0.12] flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shco-nav-ink w-7 h-7 rounded-full bg-[#3D6B9C] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              {initialsOf(userName)}
            </div>
            <div className="min-w-0 leading-[1.3]">
              <div className="shco-nav-ink text-[12px] font-semibold text-white truncate" title={userName}>{userName}</div>
              <div className="shco-nav-ink text-[10px] text-[#8FA0B8] truncate" title={`${roleLabel} · ${currentUser?.email || ''}`}>
                {roleLabel} · {currentUser?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { void logoutUser(); }}
            title="Sign out"
            className="shco-nav-ink flex items-center justify-center gap-1.5 w-full px-2.5 py-[7px] rounded-md border border-white/[0.18] bg-transparent text-[#DDE3EB] text-[12px] font-semibold cursor-pointer transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB3DE]"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            <span className="shco-nav-ink">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
