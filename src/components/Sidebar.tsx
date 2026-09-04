import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role, PartnerCode } from '../types';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Scale,
  Clock,
  Calendar,
  FolderOpen,
  FileSignature,
  Activity,
  Flag,
  Landmark,
  Share2,
  FolderX,
  FileText,
  Timer,
  Receipt,
  Car,
  FileSpreadsheet,
  CreditCard,
  Building,
  Shield,
  FileCheck2,
  PieChart,
  BookOpen,
  BarChart3,
  BookMarked,
  LineChart,
  TrendingUp,
  UserCog,
  Settings,
  History,
  ShieldCheck,
  Info,
  User,
  Sparkles,
  Palette,
  Home,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  partnerOnly?: boolean;
  systemOnly?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    setCurrentCaseId,
    currentRole,
    setCurrentRole,
    currentPartnerCode,
    setCurrentPartnerCode,
    isAdmin,
    setIsAdmin,
    canViewModule,
    currentUser,
    logoutUser,
  } = useApp();

  const isPartner = currentRole === 'Partner' || isAdmin || currentUser.role === 'Partner' || currentUser.isSuperAdmin;
  const isClient = currentRole === 'Client' || currentUser.role === 'Client';
  
  // Mobile and accessibility state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavItemClick = (itemId: string) => {
    setCurrentView(itemId);
    setCurrentCaseId(null);
    setIsMobileSidebarOpen(false);
  };

  const NAV_GROUPS: NavGroup[] = [
    {
      group: 'General',
      items: [
        { id: 'firmStartCentre', label: 'Firm Start Centre', icon: <Home className="w-3.5 h-3.5 text-amber-300" /> },
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
        { id: 'partnerDashboard', label: 'Partner Dashboard', icon: <BarChart3 className="w-3.5 h-3.5" />, partnerOnly: true },
        { id: 'clientPortal', label: 'Client Access Portal', icon: <UserCheck className="w-3.5 h-3.5 text-amber-300" /> },
        { id: 'staffPortal', label: 'Staff Portal', icon: <UserCog className="w-3.5 h-3.5 text-amber-300" /> },
      ],
    },
    {
      group: 'Practice',
      items: [
        { id: 'leads', label: 'Leads / Intake', icon: <UserCheck className="w-3.5 h-3.5" /> },
        { id: 'clients', label: 'Clients', icon: <Users className="w-3.5 h-3.5" /> },
        { id: 'cases', label: 'Cases', icon: <Scale className="w-3.5 h-3.5" /> },
        { id: 'hearings', label: 'Hearings', icon: <Clock className="w-3.5 h-3.5" /> },
        { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
        { id: 'caseStatus', label: 'Case Status', icon: <Activity className="w-3.5 h-3.5" /> },
        { id: 'deadlines', label: 'Deadlines', icon: <Flag className="w-3.5 h-3.5" /> },
        { id: 'courts', label: 'Courts & Judges', icon: <Landmark className="w-3.5 h-3.5" /> },
        { id: 'referral', label: 'Referral', icon: <Share2 className="w-3.5 h-3.5" /> },
        { id: 'fileClosing', label: 'File Closing', icon: <FolderX className="w-3.5 h-3.5" /> },
      ],
    },
    {
      group: 'Claims',
      items: [
        { id: 'reimbursements', label: 'Claims', icon: <Receipt className="w-3.5 h-3.5 text-amber-300 font-bold" /> },
      ],
    },
    {
      group: 'Billing',
      items: [
        { id: 'accountingCentre', label: 'Accounting Centre', icon: <BarChart3 className="w-3.5 h-3.5 text-amber-300" /> },
        { id: 'quotations', label: 'Quotations', icon: <FileText className="w-3.5 h-3.5" /> },
        { id: 'time', label: 'Time Entries', icon: <Timer className="w-3.5 h-3.5" /> },
        { id: 'invoices', label: 'Invoices', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
        { id: 'payments', label: 'Client Payments Received', icon: <CreditCard className="w-3.5 h-3.5" /> },
        { id: 'receipts', label: 'Official Receipts', icon: <Receipt className="w-3.5 h-3.5" /> },
        { id: 'billingReports', label: 'Billing Reports', icon: <BarChart3 className="w-3.5 h-3.5" />, partnerOnly: true },
      ],
    },
    {
      group: 'Client Accounting (Trust Account)',
      items: [
        { id: 'retainers', label: 'Client Trust Account (SAR 1990)', icon: <Building className="w-3.5 h-3.5 text-emerald-400" /> },
        { id: 'statement', label: 'Client Statement', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
        { id: 'trustAuditLogs', label: 'Trust Audit Log (SAR 1990)', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> },
        { id: 'trustReports', label: 'Client Account Reports', icon: <PieChart className="w-3.5 h-3.5" />, partnerOnly: true },
      ],
    },
    {
      group: 'Firm Accounting (Office & GL)',
      items: [
        { id: 'officeAccounts', label: 'Office Accounts (CFO)', icon: <Building className="w-3.5 h-3.5" /> },
        { id: 'bankAccounts', label: 'Bank Accounts & Virtual Pots', icon: <Landmark className="w-3.5 h-3.5 text-amber-300" /> },
        { id: 'bankReconciliation', label: 'Bank Reconciliation', icon: <FileCheck2 className="w-3.5 h-3.5 text-blue-300" /> },
        { id: 'coa', label: 'Chart of Accounts', icon: <BookOpen className="w-3.5 h-3.5" /> },
        { id: 'inventory', label: 'Office Inventory & Library', icon: <BookMarked className="w-3.5 h-3.5 text-emerald-300" /> },
        { id: 'gl', label: 'General Ledger', icon: <BookMarked className="w-3.5 h-3.5" /> },
        { id: 'trialBalance', label: 'Trial Balance', icon: <Scale className="w-3.5 h-3.5" /> },
        { id: 'balanceSheet', label: 'Balance Sheet', icon: <LineChart className="w-3.5 h-3.5" /> },
        { id: 'cashFlow', label: 'Cash Flow', icon: <TrendingUp className="w-3.5 h-3.5" /> },
        { id: 'officeReports', label: 'Office Account Reports', icon: <BarChart3 className="w-3.5 h-3.5" />, partnerOnly: true },
      ],
    },
    {
      group: 'System',
      items: [
        { id: 'users', label: 'Users & Permissions', icon: <UserCog className="w-3.5 h-3.5" />, systemOnly: true },
        { id: 'aiAgent', label: 'AI Agent', icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" /> },
        { id: 'practiceSettings', label: 'Practice Settings (SRO 2023)', icon: <Palette className="w-3.5 h-3.5" /> },
        { id: 'firmSettings', label: 'Firm Settings & Accounts', icon: <Settings className="w-3.5 h-3.5" /> },
        { id: 'logs', label: 'Activity Logs', icon: <History className="w-3.5 h-3.5" /> },
        { id: 'about', label: 'About App', icon: <Info className="w-3.5 h-3.5" /> },
        { id: 'account', label: 'My Account', icon: <User className="w-3.5 h-3.5" /> },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Menu Toggle Button - Visible only on small screens */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 bg-[#A9814A] text-white rounded-lg hover:bg-[#C29A5A] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A9814A]"
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

      {/* Sidebar - Hidden on mobile by default, visible on desktop */}
      <aside
        id="sidebar-nav"
        className={`fixed md:relative w-[min(86vw,280px)] md:w-[242px] shrink-0 bg-[#16223A] dark:bg-[#16223A] text-[#EDE9DD] dark:text-[#E8ECFF] p-5 min-h-screen overflow-visible flex flex-col justify-between border-r border-amber-900/20 dark:border-[#2D3748] shadow-xl select-none transition-all duration-300 ease-in-out ${
          isMobileSidebarOpen
            ? 'translate-x-0 z-40'
            : '-translate-x-full md:translate-x-0'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/10 dark:border-[#2D3748] group">
            <div className="w-8 h-8 rounded-full border-[1.5px] border-[#A9814A] dark:border-[#B7925A] flex items-center justify-center font-serif font-bold text-xs text-[#A9814A] dark:text-[#D5B07A] bg-[#A9814A]/10 dark:bg-[#B7925A]/10 shrink-0 shadow-inner group-hover:shadow-md group-hover:border-[#D4AF37] dark:group-hover:border-[#C89A63] transition-all">
              SH
            </div>
            <div>
              <div className="font-roxborough text-[13px] font-bold leading-tight text-white dark:text-[#EEF3FF] tracking-wide uppercase">
                SYAFIQAH HAMIZAD &amp; CO
              </div>
              <div className="font-termes text-[10px] text-[#ffd29e] dark:text-[#C89A63] tracking-tight font-medium italic flex items-center gap-1 mt-0.5">
                Advocates &amp; Solicitors | Syarie Counsel
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4 px-2">
            <input
              type="text"
              placeholder="Search navigation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
              className="w-full px-3 py-1.5 text-xs bg-white/10 dark:bg-[#171E2A] border border-white/20 dark:border-[#2F3A4B] text-white dark:text-[#EEF3FF] placeholder:text-slate-400 dark:placeholder:text-[#7A86A1] rounded-md focus:outline-none focus:border-[#A9814A] dark:focus:border-[#B7925A] focus:ring-1 focus:ring-[#A9814A]/50 dark:focus:ring-[#B7925A]/50 transition-all"
              aria-label="Search navigation menu"
            />
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2" role="menubar">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) => {
                if (item.partnerOnly && !isPartner) return false;
                if (item.systemOnly && !isAdmin) return false;
                if (searchQuery && !item.label.toLowerCase().includes(searchQuery)) return false;
                return canViewModule(item.id);
              });

              if (visibleItems.length === 0) return null;

              return (
                <div key={group.group}>
                  <div className="w-full flex items-center text-[9.5px] uppercase tracking-widest text-[#7A8296] dark:text-[#A3ADC3] px-2 py-2 mb-1 font-bold">
                    <span>{group.group}</span>
                  </div>
                  <div id={`group-${group.group}`} className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = currentView === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavItemClick(item.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A9814A] dark:focus:ring-[#B7925A] focus:ring-offset-[#16223A] dark:focus:ring-offset-[#121821] ${
                            isActive
                              ? 'bg-[#A9814A] dark:bg-[#B7925A] text-[#1A1204] dark:text-[#121821] font-semibold shadow-md'
                              : 'text-[#C7CCDC] dark:text-[#C3CDE3] hover:bg-white/10 dark:hover:bg-[#1B2330] hover:text-white dark:hover:text-[#EEF3FF] focus:text-white dark:focus:text-[#EEF3FF]'
                          }`}
                          role="menuitem"
                          aria-current={isActive ? 'page' : undefined}
                          title={item.label}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Role & Access Switcher Panel */}
        <div className="mt-6 pt-3 border-t border-white/12 space-y-2.5 text-xs">
          {isClient ? (
            <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl text-xs space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px]">
                  Client Portal Session
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">
                  ACTIVE
                </span>
              </div>
              <div className="text-[11px] text-slate-200">
                Logged in as <strong className="text-white">{currentUser.name}</strong>
              </div>
              <button
                onClick={() => {
                  setCurrentRole('Partner');
                  setCurrentView('dashboard');
                  logoutUser();
                }}
                className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 text-[#16223A] font-extrabold rounded-lg text-[11px] transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 focus:ring-offset-[#16223A]"
                title="Sign out from client portal"
              >
                Sign Out / Exit Portal
              </button>
            </div>
          ) : currentUser.isSuperAdmin ? (
            <>
              <div>
                <label htmlFor="role-select" className="text-[9.5px] uppercase tracking-wider text-[#8B93A8] block mb-1 font-semibold">
                  Viewing as Role
                </label>
                <select
                  id="role-select"
                  value={currentRole}
                  disabled={!isAdmin && !currentUser.isSuperAdmin}
                  onChange={(e) => {
                    const newRole = e.target.value as Role;
                    setCurrentRole(newRole);
                    if (newRole === 'Client') {
                      setCurrentView('clientPortal');
                    } else if (currentView === 'clientPortal') {
                      setCurrentView('dashboard');
                    }
                  }}
                  className="w-full bg-white/8 text-white border border-white/20 rounded-md px-2 py-1 text-[11.5px] focus:outline-none focus:border-[#A9814A] focus:ring-1 focus:ring-[#A9814A]/50 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  aria-label="Select your viewing role"
                >
                  <option value="Partner" className="bg-[#16223A]">Partner (Full Firm Oversight)</option>
                  <option value="Lawyer" className="bg-[#16223A]">Lawyer (Matters & Practice Only)</option>
                  <option value="Assistant" className="bg-[#16223A]">Assistant (Support & Intake)</option>
                  <option value="Reviewer" className="bg-[#16223A]">Reviewer (External/Auditor)</option>
                  <option value="Client" className="bg-[#16223A]">Client (Read-Only Portal)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-[#C7CCDC] cursor-pointer hover:text-white transition-colors focus-within:text-white">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="rounded border-white/20 text-[#A9814A] focus:ring-1 focus:ring-[#A9814A]/50 accent-[#A9814A] cursor-pointer"
                  aria-label="Enable admin overlay access"
                />
                <span>Also has Admin overlay access</span>
              </label>

              <div>
                <label htmlFor="partner-select" className="text-[9.5px] uppercase tracking-wider text-[#8B93A8] block mb-1 font-semibold">
                  Partner Identity ("My Cases")
                </label>
                <select
                  id="partner-select"
                  value={currentPartnerCode}
                  onChange={(e) => setCurrentPartnerCode(e.target.value as PartnerCode)}
                  className="w-full bg-white/8 text-white border border-white/20 rounded-md px-2 py-1 text-[11.5px] focus:outline-none focus:border-[#A9814A] focus:ring-1 focus:ring-[#A9814A]/50 transition-all"
                  aria-label="Select your partner identity"
                >
                  <option value="SH" className="bg-[#16223A]">SH — Syafiqah Hamizad</option>
                  <option value="AH" className="bg-[#16223A]">AH — Amer Haiqal</option>
                  <option value="ZA" className="bg-[#16223A]">ZA — Zulaikha Afendi</option>
                </select>
              </div>

              <div className="text-[9.5px] text-[#7A8296] leading-snug pt-1">
                Malaysian Law compliant. Admin overlay reveals firm-wide cases & system views. Reviewer = read-only auditor view.
              </div>
            </>
          ) : null}
        </div>
      </aside>

    </>
  );
};
