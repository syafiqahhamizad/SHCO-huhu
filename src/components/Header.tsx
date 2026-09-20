import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  Plus,
  Building2,
  FolderOpen,
  User,
  Crown,
  Bell,
  CheckCheck,
  Gavel,
  FileText,
  X,
  CheckCircle2,
  Trash2,
  Archive,
  LogOut,
} from 'lucide-react';
import { RecycleBinModal } from './RecycleBinModal';
import { HelpCircle } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentView,
    currentPartnerCode,
    isAdmin,
    globalSearch,
    setGlobalSearch,
    setCurrentView,
    setCurrentCaseId,
    cases = [],
    clients = [],
    invoices = [],
    quotations = [],
    currentUser,
    logoutUser,
    showToast,
    notifications = [],
    unreadNotificationsCount = 0,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deletedRecords = [],
    users,
    isUserPreview,
    previewUserId,
    startUserPreview,
    exitUserPreview,
    canEditFirmStartCentre,
    firmStartCentreEditMode,
    setFirmStartCentreEditMode,
  } = useApp();

  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'hearing' | 'invoice'>('all');

  // Global search — was previously write-only (typed into `globalSearch`, read nowhere).
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const query = globalSearch.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!query) return { matters: [] as typeof cases, clientsList: [] as typeof clients, documents: [] as { id: string; label: string; sub: string; view: string }[] };
    const matters = cases
      .filter((c: any) => [c.ref, c.title, c.clientName, c.practiceArea].some((v: any) => String(v || '').toLowerCase().includes(query)))
      .slice(0, 5);
    const clientsList = clients
      .filter((c: any) => [c.name, c.id, c.email, c.phone].some((v: any) => String(v || '').toLowerCase().includes(query)))
      .slice(0, 5);
    const documents = [
      ...quotations.filter((q: any) => [q.id, q.clientName, q.fileRef].some((v: any) => String(v || '').toLowerCase().includes(query))).map((q: any) => ({ id: q.id, label: q.id, sub: q.clientName || 'Quotation', view: 'billing' })),
      ...invoices.filter((i: any) => [i.id, i.partyName, i.fileRef].some((v: any) => String(v || '').toLowerCase().includes(query))).map((i: any) => ({ id: i.id, label: i.id, sub: i.partyName || 'Invoice', view: 'billing' })),
    ].slice(0, 5);
    return { matters, clientsList, documents };
  }, [query, cases, clients, quotations, invoices]);

  const hasResults = searchResults.matters.length > 0 || searchResults.clientsList.length > 0 || searchResults.documents.length > 0;

  const goToMatter = (caseId: string) => {
    setCurrentCaseId(caseId);
    setCurrentView('cases');
    setIsSearchOpen(false);
    setGlobalSearch('');
  };
  const goToClients = () => {
    setCurrentView('clients');
    setIsSearchOpen(false);
    setGlobalSearch('');
  };
  const goToBilling = () => {
    setCurrentView('billing');
    setIsSearchOpen(false);
    setGlobalSearch('');
  };

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const getViewInfo = () => {
    switch (currentView) {
      case 'firmStartCentre':
        return { title: 'Firm Start Centre', sub: 'Announcements, workspaces and firm resources in one place' };
      case 'myDashboard':
        return { title: 'My Dashboard', sub: 'Your tasks, court dates, approvals and unbilled work' };
      case 'dashboard':
        return { title: 'My Dashboard', sub: 'Your tasks, court dates, approvals and unbilled work' };
      case 'firmDashboard':
        return { title: 'Firm-Wide Dashboard', sub: 'Firm-wide operational and financial snapshot' };
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
      case 'billing':
        return { title: 'Billing', sub: 'Quotation to Proforma Invoice to Official Receipt' };
      case 'time':
        return { title: 'Time Entries', sub: 'Fee earner billable hours and activities' };
      case 'expenses':
        return { title: 'Expenses & Disbursements', sub: 'Out-of-pocket costs billed back to clients' };
      case 'travelClaims':
        return { title: 'Travel / Mileage Claims', sub: 'Mileage at RM 0.60/km for client matters vs firm business' };
      case 'paymentVouchers':
        return { title: 'Payment Vouchers (PV)', sub: 'Disbursements and firm expenses with partner sign-off' };
      case 'retainers':
        return { title: 'Client Account (Trust)', sub: "Solicitors' Account Rules 1990 Trust Ledger & 3-Way Reconciliation" };
      case 'trialBalance':
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
  const isPrivilegedHeader = Boolean(currentUser?.isAdmin || currentUser?.isSuperAdmin);
  // Firm Start Centre has its own hero, tab nav, reload button, and contextual edit toggles —
  // this shared header (title, search, notifications, role switcher, sign-out) is fully redundant
  // there. Every other view keeps it unchanged.
  if (currentView === 'firmStartCentre') return null;

  return (
    <header className={`sticky top-0 z-20 mb-4 sm:mb-6 rounded-2xl border border-[#16223A] bg-[#16223A] text-[#F6F8FA] px-4 sm:px-6 py-3 flex flex-col justify-start gap-2.5 overflow-visible shadow-[0_12px_24px_-16px_rgba(22,34,58,.8)] ${isPrivilegedHeader ? 'items-stretch' : 'md:flex-row md:items-center'}`}>
      <div className={`min-w-0 ${isPrivilegedHeader ? 'w-full order-1' : ''}`}>
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 font-serif text-lg sm:text-xl font-bold text-[#F6F8FA] tracking-tight">{info.title}</h1>
        </div>
        <p className="text-xs text-[#DDE3EB] mt-0.5 line-clamp-2">{info.sub}</p>
      </div>

      <div className={`flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:gap-2 ${isPrivilegedHeader ? 'order-2 border-t border-white/10 pt-2' : 'md:ml-8 md:w-auto md:shrink-0'}`}>
        {canEditFirmStartCentre && (
          <button
            type="button"
            onClick={() => setFirmStartCentreEditMode((enabled) => !enabled)}
            className={`order-last flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold cursor-pointer transition ${firmStartCentreEditMode ? 'border-[#FBF2E9] bg-[#FBF2E9] text-[#16223A]' : 'border-white/20 bg-white/10 text-[#F6F8FA] hover:bg-white/20'}`}
            title="Toggle Firm Start Centre content editing"
          >
            {firmStartCentreEditMode ? 'Done editing' : 'Edit content'}
          </button>
        )}
        {/* Global Search Bar */}
        <div ref={searchBoxRef} className="relative group w-full min-w-0 sm:flex-1 md:w-auto md:flex-none">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#3D6B9C] transition-colors" />
          <input
            type="text"
            placeholder="Search matters, clients, docs..."
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsSearchOpen(false); }}
            className="w-full max-w-full pl-8 pr-3 py-1.5 text-xs bg-white/95 border border-white/20 text-[#16223A] placeholder:text-slate-400 rounded-md sm:w-48 md:w-60 md:focus:w-64 transition-all focus:outline-none focus:border-[#FBF2E9] focus:ring-1 focus:ring-[#FBF2E9]/30"
            aria-label="Global search for matters, clients, documents"
          />

          {isSearchOpen && query && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[280px] rounded-lg border border-[#DDE3EB] bg-white text-left shadow-xl">
              {!hasResults ? (
                <p className="px-3 py-4 text-center text-[11.5px] text-slate-400">No matters, clients or documents match &ldquo;{globalSearch}&rdquo;.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1.5">
                  {searchResults.matters.length > 0 && (
                    <div className="px-1">
                      <p className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Matters</p>
                      {searchResults.matters.map((c: any) => (
                        <button key={c.id} type="button" onClick={() => goToMatter(c.id)} className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-[#F6F8FA] cursor-pointer">
                          <span className="font-mono text-[10px] font-bold text-[#3D6B9C]">{c.ref}</span>
                          <span className="text-[12px] font-semibold text-[#16223A]">{c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.clientsList.length > 0 && (
                    <div className="border-t border-[#F0F2F5] px-1 pt-1">
                      <p className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Clients</p>
                      {searchResults.clientsList.map((c: any) => (
                        <button key={c.id} type="button" onClick={goToClients} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#F6F8FA] cursor-pointer">
                          <span className="text-[12px] font-semibold text-[#16223A]">{c.name}</span>
                          <span className="font-mono text-[10px] text-[#5B6478]">{c.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.documents.length > 0 && (
                    <div className="border-t border-[#F0F2F5] px-1 pt-1">
                      <p className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Quotations &amp; Invoices</p>
                      {searchResults.documents.map((d) => (
                        <button key={d.id} type="button" onClick={goToBilling} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#F6F8FA] cursor-pointer">
                          <span className="font-mono text-[11px] font-bold text-[#3D6B9C]">{d.label}</span>
                          <span className="text-[11px] text-[#5B6478]">{d.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reload latest saved data */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          title="Reload latest saved data"
          aria-label="Reload latest saved data"
          className="shrink-0 rounded p-1.5 text-[#DDE3EB] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FBF2E9] cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Recycle Bin & Data Recovery Vault */}
        <button
          onClick={() => setIsRecycleBinOpen(true)}
          className="p-2 rounded-lg bg-white border border-[#DDE3EB] text-slate-700 hover:text-[#16223A] hover:border-[#8A6D3B] focus:outline-none focus:ring-2 focus:ring-[#8A6D3B] transition-all relative shadow-2xs cursor-pointer flex items-center gap-1"
          aria-label={`Data recovery vault with ${deletedRecords.length} deleted items`}
          title="Recycle Bin"
        >
          <Archive className="w-4 h-4 text-[#3D6B9C]" />
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
            className="p-1.5 rounded-md bg-white border border-[#DDE3EB] text-slate-700 hover:text-[#16223A] hover:border-[#8A6D3B] focus:outline-none focus:ring-2 focus:ring-[#8A6D3B] transition-all relative shadow-2xs cursor-pointer"
            aria-label={`Notifications: ${unreadNotificationsCount} unread alerts`}
            aria-expanded={isNotifOpen}
            aria-controls="notifications-dropdown"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-[#8A6D3B] dark:text-amber-300" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white shadow-sm">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isNotifOpen && (
            <div id="notifications-dropdown" className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#DDE3EB] rounded-xl shadow-2xl z-50 overflow-hidden" role="region" aria-label="Notifications panel">
              <div className="bg-[#16223A] text-white p-3.5 flex items-center justify-between border-b border-amber-400/30">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-300" />
                  <span className="font-serif font-bold text-xs">Notifications</span>
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
              <div className="flex bg-[#F6F8FA] border-b border-[#DDE3EB] px-3 pt-2 text-[11px] font-semibold text-slate-600 gap-3">
                <button
                  onClick={() => setNotifFilter('all')}
                  className={`pb-1.5 border-b-2 transition-all ${
                    notifFilter === 'all'
                      ? 'border-[#3D6B9C] text-[#16223A] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter('hearing')}
                  className={`pb-1.5 border-b-2 transition-all flex items-center gap-1 ${
                    notifFilter === 'hearing'
                      ? 'border-[#3D6B9C] text-[#16223A] font-bold'
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
                      ? 'border-[#3D6B9C] text-[#16223A] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3 h-3 text-emerald-700" />
                  Paid Invoices
                </button>
              </div>

              {/* List items */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#DDE3EB]">
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
                          !n.read ? 'bg-amber-50/80 border-l-2 border-[#3D6B9C]' : 'bg-white'
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

              <div className="p-2 bg-[#F6F8FA] border-t border-[#DDE3EB] text-center text-[10px] text-slate-500">
                Court and billing notifications
              </div>
            </div>
          )}
        </div>

        {/* Current User & Role Badge / SSO Login Trigger */}
        <div className="flex min-w-0 max-w-full items-center gap-1.5">
          {isUserPreview ? (
            <button type="button" onClick={exitUserPreview} className="rounded-md border border-amber-300 bg-[#16223A] px-2 py-1.5 text-[10px] font-bold text-[#FBF2E9] shadow-2xs cursor-pointer" title="Exit full-system user preview">
              Exit preview
            </button>
          ) : (currentUser?.isAdmin || currentUser?.isSuperAdmin) ? (
            <label className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-semibold text-[#F6F8FA]">
              <span>View as</span>
              <select value={previewUserId || ''} onChange={(event) => { if (event.target.value) startUserPreview(event.target.value); }} className="max-w-[120px] cursor-pointer bg-transparent text-[10px] font-bold text-white outline-none">
                <option value="" className="text-[#16223A]">My view</option>
                {users.map((user) => <option key={user.id} value={user.id} className="text-[#16223A]">{user.name}</option>)}
              </select>
            </label>
          ) : null}
          <div
            className="flex min-w-0 max-w-[15rem] items-center gap-1.5 bg-white border border-[#DDE3EB] px-2 py-1.5 rounded-md text-xs shadow-2xs"
            title="Current signed-in user"
          >
            <div className="w-5 h-5 rounded-full bg-[#16223A] text-white flex items-center justify-center font-bold text-[10px]">
              {currentUser?.isSuperAdmin ? <Crown className="w-3 h-3 text-amber-400" /> : <User className="w-3 h-3 text-amber-300" />}
            </div>
            <div className="text-left leading-tight min-w-0">
              <div className="font-bold text-[#16223A] flex min-w-0 items-center gap-1">
                <span className="whitespace-nowrap text-[#16223A]">{currentUser?.name || 'User'}</span>
                {currentUser?.isSuperAdmin && (
                  <span className="bg-[#16223A] text-[#FBF2E9] border border-[#3D6B9C] text-[8px] font-bold px-1 rounded shrink-0">
                    SUPER ADMIN
                  </span>
                )}
              </div>
              <div className="hidden max-w-[12rem] truncate text-[10px] text-slate-600 font-mono sm:block">{currentUser?.email}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={logoutUser}
            className="flex shrink-0 items-center gap-1 bg-[#3D6B9C] hover:bg-[#3D6B9C] text-white border border-[#3D6B9C] px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer shadow-2xs transition-all"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-[#3D6B9C]" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

      </div>

      <RecycleBinModal isOpen={isRecycleBinOpen} onClose={() => setIsRecycleBinOpen(false)} />
    </header>
  );
};
