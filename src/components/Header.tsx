import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../types';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  Plus,
  Building2,
  FolderOpen,
  User,
  Crown,
  Shield,
  Bell,
  CheckCheck,
  Gavel,
  FileText,
  X,
  CheckCircle2,
  Sparkles,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Archive,
  LogOut,
} from 'lucide-react';
import { RecycleBinModal } from './RecycleBinModal';
import { OnboardingTourModal } from './OnboardingTourModal';
import { HelpCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentView,
    currentRole,
    setCurrentRole,
    currentPartnerCode,
    isAdmin,
    globalSearch,
    setGlobalSearch,
    setCurrentView,
    setCurrentCaseId,
    currentUser,
    logoutUser,
    showToast,
    theme,
    setTheme,
    notifications = [],
    unreadNotificationsCount = 0,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deletedRecords = [],
    customRoles = [],
  } = useApp();

  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'hearing' | 'invoice'>('all');

  const getViewInfo = () => {
    switch (currentView) {
      case 'dashboard':
        return { title: 'Dashboard', sub: 'Firm-wide operational & financial snapshot' };
      case 'leads':
        return { title: 'Leads / Intake', sub: 'Conflict of interest check starts here before conversion' };
      case 'clients':
        return { title: 'Clients', sub: 'Client profiles, KYC due diligence documents & instructions' };
      case 'cases':
        return { title: 'Cases & Matters', sub: 'Matter reference format: SHCO/[PARTNER IN CHARGE]/[LAWYER IN CHARGE]/[MATTER TYPE]/[RUNNING NO.]/[MONTH-YEAR FILE OPEN]' };
      case 'hearings':
        return { title: 'Court Hearings', sub: 'Schedule of court appearances and management sessions' };
      case 'calendar':
        return { title: 'Calendar', sub: 'Integrated hearings and compliance deadlines' };
      case 'documents':
        return { title: 'Documents', sub: 'Centralized Google Drive document repository per matter' };
      case 'templates':
        return { title: 'Doc Templates', sub: 'Merge-field templates for Notices, Fee Agreements & Engagement letters' };
      case 'tasks':
        return { title: 'Tasks', sub: 'Matter tasks, assignments and turnarounds' };
      case 'deadlines':
        return { title: 'Deadlines', sub: 'Statutory limitation periods and court filing dates' };
      case 'courts':
        return { title: 'Courts & Judges', sub: 'Directory of Malaysian Courts and Presiding Officers' };
      case 'referral':
        return { title: 'Referral Sources', sub: 'Track lead & matter originators and commission status' };
      case 'fileClosing':
        return { title: 'File Closing Checklist', sub: 'Invoice, Trust & Document return verifications before matter closure' };
      case 'quotations':
        return { title: 'Quotations', sub: 'SRO 2023 Scale Fee Calculator & Fee Quoting Templates' };
      case 'time':
        return { title: 'Time Entries', sub: 'Fee earner billable hours and activities' };
      case 'expenses':
        return { title: 'Expenses & Disbursements', sub: 'Out-of-pocket costs billed back to clients' };
      case 'travelClaims':
        return { title: 'Travel / Mileage Claims', sub: 'Mileage at RM 0.60/km for client matters vs firm business' };
      case 'invoices':
        return { title: 'Tax Invoices', sub: 'Issued bills and payment status tracking' };
      case 'payments':
        return { title: 'Payments Received', sub: 'Collections applied against tax invoices' };
      case 'receipts':
        return { title: 'Official Receipts (OR)', sub: 'Official receipt entries for Client & Office accounts' };
      case 'paymentVouchers':
        return { title: 'Payment Vouchers (PV)', sub: 'Disbursements and firm expenses with partner sign-off' };
      case 'retainers':
        return { title: 'Client Account (Trust)', sub: "Solicitors' Account Rules 1990 Trust Ledger & 3-Way Reconciliation" };
        return { title: 'Trial Balance', sub: 'Debits vs Credits balancing ledger' };
      case 'balanceSheet':
        return { title: 'Balance Sheet', sub: 'Assets = Liabilities + Partner Equity' };
      case 'cashFlow':
        return { title: 'Cash Flow Statement', sub: 'Actual monthly office cash movements' };
      case 'billingReports':
        return { title: 'Billing Reports', sub: 'Partner financial performance & collections breakdown' };
      case 'trustReports':
        return { title: 'Trust Account Reports', sub: 'SAR 1990 compliance audit trail' };
      case 'officeReports':
        return { title: 'Office Account Reports', sub: 'Firm overhead & cash bucket reserves analysis' };
      case 'users':
        return { title: 'Users Management', sub: 'Firm members and admin privileges' };
      case 'staffPortal':
      case 'staff-portal':
        return { title: 'Staff Portal', sub: 'Staff profiles, attendance, leave and internal operations' };
      case 'settings':
        return { title: 'System Settings', sub: 'Practice references & system preferences' };
      case 'logs':
        return { title: 'Activity Logs', sub: 'Audit trail of user actions' };
      case 'clientPortal':
      case 'client-portal':
        return { title: 'Client Access Portal (Read-Only)', sub: 'Privileged real-time matter progress tracking and shared document access' };
      case 'roles':
        return { title: 'Roles & Permissions', sub: 'Module permission matrix (View, Add, Edit)' };
      default:
        return { title: 'SHCO Practice System', sub: 'Malaysian Legal Practice Management System' };
    }
  };

  const info = getViewInfo();

  return (
    <header className="mb-6 pb-4 border-b border-[#E1DCCF] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#16223A] tracking-tight">{info.title}</h1>
        <p className="text-xs text-[#5B6478] mt-0.5">{info.sub}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Global Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search matters, clients, docs..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E1DCCF] rounded-md w-48 md:w-60 focus:w-64 transition-all focus:outline-none focus:border-[#A9814A]"
          />
        </div>

        {/* Guided System Tour Button */}
        <button
          onClick={() => setIsTourOpen(true)}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 hover:bg-amber-500/20 transition-all font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Guided Tour</span>
        </button>

        {/* Recycle Bin & Data Recovery Vault */}
        <button
          onClick={() => setIsRecycleBinOpen(true)}
          className="p-2 rounded-lg bg-white border border-[#E1DCCF] text-slate-700 hover:text-[#16223A] hover:border-[#A9814A] transition-all relative shadow-2xs cursor-pointer flex items-center gap-1"
          title="Data Recovery Vault & Recycle Bin History Tracking"
        >
          <Archive className="w-4 h-4 text-[#A9814A]" />
          {deletedRecords.length > 0 && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] px-1.5 py-0.2 rounded-full">
              {deletedRecords.length}
            </span>
          )}
        </button>

        {/* Real-Time Hearing & Invoice Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="p-2 rounded-lg bg-white border border-[#E1DCCF] text-slate-700 hover:text-[#16223A] hover:border-[#A9814A] transition-all relative shadow-2xs cursor-pointer"
            title="Real-Time Hearing & Invoice Payment Alerts"
          >
            <Bell className="w-4 h-4 text-[#16223A]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white shadow-sm">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#E1DCCF] rounded-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
              <div className="bg-[#16223A] text-white p-3.5 flex items-center justify-between border-b border-amber-400/30">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-300" />
                  <span className="font-serif font-bold text-xs">Real-Time Firm Alerts</span>
                  {unreadNotificationsCount > 0 && (
                    <span className="bg-amber-400/20 text-amber-300 text-[9.5px] font-bold px-1.5 py-0.2 rounded border border-amber-400/40">
                      {unreadNotificationsCount} New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsAsRead()}
                      className="text-[10px] text-amber-300 hover:underline font-semibold flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-[#FAF8F2] border-b border-[#E1DCCF] px-3 pt-2 text-[11px] font-semibold text-slate-600 gap-3">
                <button
                  onClick={() => setNotifFilter('all')}
                  className={`pb-1.5 border-b-2 transition-all ${
                    notifFilter === 'all'
                      ? 'border-[#A9814A] text-[#16223A] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter('hearing')}
                  className={`pb-1.5 border-b-2 transition-all flex items-center gap-1 ${
                    notifFilter === 'hearing'
                      ? 'border-[#A9814A] text-[#16223A] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Gavel className="w-3 h-3 text-amber-700" />
                  Hearings
                </button>
                <button
                  onClick={() => setNotifFilter('invoice')}
                  className={`pb-1.5 border-b-2 transition-all flex items-center gap-1 ${
                    notifFilter === 'invoice'
                      ? 'border-[#A9814A] text-[#16223A] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3 h-3 text-emerald-700" />
                  Paid Invoices
                </button>
              </div>

              {/* List items */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#E1DCCF]">
                {notifications
                  .filter((n) => (notifFilter === 'all' ? true : n.type === notifFilter))
                  .length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No active notifications in this category
                  </div>
                ) : (
                  notifications
                    .filter((n) => (notifFilter === 'all' ? true : n.type === notifFilter))
                    .map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          if (n.linkTab) {
                            setCurrentView(n.linkTab);
                            setIsNotifOpen(false);
                          }
                        }}
                        className={`p-3 text-left hover:bg-amber-50/50 cursor-pointer transition-all flex gap-2.5 items-start ${
                          !n.read ? 'bg-amber-50/80 border-l-2 border-[#A9814A]' : 'bg-white'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs mt-0.5 ${
                            n.type === 'hearing'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {n.type === 'hearing' ? <Gavel className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-[#16223A] truncate">{n.title}</span>
                            <span className="text-[9.5px] font-mono text-slate-400 shrink-0">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{n.message}</p>
                          {!n.read && (
                            <span className="inline-block mt-1 text-[9px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                              UNREAD
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="p-2 bg-[#FAF8F2] border-t border-[#E1DCCF] text-center text-[10px] text-slate-500">
                Live push notifications enabled for Court Diary &amp; Accounts Ledger
              </div>
            </div>
          )}
        </div>

        {/* Role Perspective Selector */}
        <div className="flex items-center gap-1.5 bg-white border border-[#E1DCCF] px-2.5 py-1 rounded-lg text-xs shadow-2xs">
          <Shield className="w-3.5 h-3.5 text-[#A9814A] shrink-0" />
          <span className="text-[11px] text-slate-500 font-bold hidden sm:inline">Active Role:</span>
          <select
            value={currentRole}
            disabled={!currentUser?.isSuperAdmin && currentUser?.email !== 'syafiqahhamizad@shcolaw.com'}
            onChange={(e) => {
              const newRole = e.target.value as Role;
              setCurrentRole(newRole);
              showToast(`Switched active portal view perspective to: ${newRole}`);
              if (newRole === 'Client') {
                setCurrentView('clientPortal');
              } else if (currentView === 'clientPortal') {
                setCurrentView('dashboard');
              }
            }}
            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-[#16223A] rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-[#A9814A] cursor-pointer"
            title="Switch Active Role Perspective to test dynamic sidebar filtering & access policies"
          >
            <option value="Partner">Partner (Full Firm & CFO)</option>
            <option value="Lawyer">Lawyer (Practice & Matters Only)</option>
            <option value="Assistant">Assistant (Intake & Support)</option>
            <option value="Reviewer">Reviewer (Audit & Compliance)</option>
            <option value="Client">Client (Client Portal Only)</option>
            {customRoles.map((role) => (
              <option key={role} value={role}>{role} (Custom Role)</option>
            ))}
          </select>
        </div>

        {/* Quick Theme Toggle Button */}
        <button
          onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
            setTheme(nextTheme);
            showToast(`Theme preference set to: ${nextTheme === 'light' ? 'Parchment Light' : nextTheme === 'dark' ? 'Executive Dark' : 'System Default'}`);
          }}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-[#E1DCCF] px-2.5 py-1.5 rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
          title={`Active Theme: ${theme.toUpperCase()} (Click to cycle Light / Dark / System)`}
          aria-label="Toggle dark/light theme preference"
        >
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-amber-400" />
          ) : theme === 'light' ? (
            <Sun className="w-4 h-4 text-amber-600" />
          ) : (
            <Monitor className="w-4 h-4 text-blue-600" />
          )}
          <span className="font-bold text-[11px] text-[#16223A] hidden md:inline capitalize">
            {theme}
          </span>
        </button>

        {/* Current User & Role Badge / SSO Login Trigger */}
        <div
          className="flex items-center gap-2 bg-white border border-[#E1DCCF] px-3 py-1.5 rounded-lg text-xs shadow-2xs"
          title="Current signed-in user"
        >
          <div className="w-5 h-5 rounded-full bg-[#16223A] text-white flex items-center justify-center font-bold text-[10px]">
            {currentUser?.isSuperAdmin ? <Crown className="w-3 h-3 text-amber-400" /> : <User className="w-3 h-3 text-amber-300" />}
          </div>
          <div className="text-left leading-tight">
            <div className="font-bold text-[#16223A] flex items-center gap-1">
              <span>{currentUser?.name || 'User'}</span>
              {currentUser?.isSuperAdmin && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8px] font-bold px-1 rounded">
                  SUPER ADMIN
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {currentUser?.email}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={logoutUser}
          className="flex items-center gap-1.5 bg-[#16223A] hover:bg-[#253653] text-white border border-[#A9814A]/50 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs transition-all"
          title="Sign out and return to the main portal"
        >
          <LogOut className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>

        {/* Reload latest saved data without changing the session */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          title="Reload latest saved data"
          aria-label="Reload latest saved data"
          className="p-2 text-slate-500 hover:text-[#16223A] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <RecycleBinModal isOpen={isRecycleBinOpen} onClose={() => setIsRecycleBinOpen(false)} />
      <OnboardingTourModal isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </header>
  );
};
