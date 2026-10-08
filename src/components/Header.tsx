import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { clientsNav, useSelectedClientId } from './views/clients/clientModel';
import {
  Search,
  RefreshCw,
  Bell,
  CheckCheck,
  Gavel,
  FileText,
  Archive,
} from 'lucide-react';
import { RecycleBinModal } from './RecycleBinModal';
import { canSeeFinanceView, finRoleKey, isFinanceView } from '../lib/financeAccess';

export const Header: React.FC = () => {
  const {
    currentView,
    globalSearch,
    setGlobalSearch,
    setCurrentView,
    setCurrentCaseId,
    setCaseSubTab,
    cases = [],
    clients = [],
    invoices = [],
    quotations = [],
    currentUser,
    currentRole,
    isAdmin,
    canViewModule,
    currentCaseId,
    notifications = [],
    unreadNotificationsCount = 0,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deletedRecords = [],
    isNewCaseModalOpen,
    setIsNewCaseModalOpen,
  } = useApp();
  const selectedClientId = useSelectedClientId();
  const selectedClient = currentView === 'clients' && selectedClientId ? clients.find((c: any) => c.id === selectedClientId) : undefined;
  const selectedCase = currentView === 'cases' && currentCaseId ? cases.find((c: any) => c.id === currentCaseId) : undefined;

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
    const clientsList = !canViewModule('clients') ? [] : clients
      .filter((c: any) => [c.name, c.id, c.email, c.phone].some((v: any) => String(v || '').toLowerCase().includes(query)))
      .slice(0, 5);
    // Quotations / invoices open Billing — only for people who can use it.
    const documents = !canSeeFinanceView('billing', finRoleKey(currentRole, currentUser, isAdmin)) ? [] : [
      ...quotations.filter((q: any) => [q.id, q.clientName, q.fileRef].some((v: any) => String(v || '').toLowerCase().includes(query))).map((q: any) => ({ id: q.id, label: q.id, sub: q.clientName || 'Quotation', view: 'billing' })),
      ...invoices.filter((i: any) => [i.id, i.partyName, i.fileRef].some((v: any) => String(v || '').toLowerCase().includes(query))).map((i: any) => ({ id: i.id, label: i.id, sub: i.partyName || 'Invoice', view: 'billing' })),
    ].slice(0, 5);
    return { matters, clientsList, documents };
  }, [query, cases, clients, quotations, invoices, currentRole, currentUser, isAdmin, canViewModule]);

  const hasResults = searchResults.matters.length > 0 || searchResults.clientsList.length > 0 || searchResults.documents.length > 0;

  // A notification about a file opens that file on the matching tab (hearing → Court, tag → Tasks);
  // anything else opens the page named in linkTab.
  const openNotification = (n: { linkTab?: string; linkId?: string }) => {
    const kase = n.linkId ? cases.find((c: any) => c.id === n.linkId) : undefined;
    if (kase) {
      setCaseSubTab(n.linkTab === 'hearings' ? 'court' : n.linkTab === 'tasks' ? 'tasks' : 'overview');
      setCurrentCaseId(kase.id);
      setCurrentView('cases');
    } else if (n.linkTab) {
      setCurrentCaseId(null);
      setCurrentView(n.linkTab);
    } else return;
    setIsNotifOpen(false);
  };

  const goToMatter = (caseId: string) => {
    setCaseSubTab('overview');
    setCurrentCaseId(caseId);
    setCurrentView('cases');
    setIsSearchOpen(false);
    setGlobalSearch('');
  };
  const goToClients = (clientId?: string) => {
    clientsNav.set(clientId || null);
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

  // Titles stay short (they must not wrap past 2 lines at a 900px main column); the sub is one line.
  // Long names (e.g. a matter's title) belong in the page content, not the header.
  const getViewInfo = (): { title: string; sub: string; crumb?: string; onCrumb?: () => void } => {
    if (isFinanceView(currentView)) {
      return { title: 'Finance & Accounts', sub: 'Restricted: Accounts, Partners and Managing Partner only' };
    }
    switch (currentView) {
      case 'firmStartCentre':
        return { title: 'Firm Start Centre', sub: 'Announcements, people, policies and portals' };
      case 'myDashboard':
      case 'dashboard':
      {
        const rk = finRoleKey(currentRole, currentUser, isAdmin);
        return {
          title: 'My Dashboard',
          sub: rk === 'M' ? 'Your work, plus how the firm is doing' : rk === 'P' ? 'Your work, your team and your new business' : 'Your tasks, meetings and court dates',
        };
      }
      case 'firmDashboard':
        return { title: 'Firm-Wide Dashboard', sub: 'Firm-wide operational and financial snapshot' };
      case 'leads':
      case 'leadsReferrals':
      case 'leads-referrals':
        return { title: 'Leads & Referrals', sub: 'Every enquiry, where it came from, and whether it became a client' };
      case 'clients':
        return selectedClient
          ? { title: 'Client profile', sub: 'Particulars, files, money, KYC and portal access', crumb: 'Clients', onCrumb: () => clientsNav.set(null) }
          : { title: 'Clients', sub: 'Client records, KYC, conflict checks and portal access' };
      case 'cases':
        if (isNewCaseModalOpen) return { title: 'Open a new file', sub: 'Client, parties, court and team for the new matter', crumb: 'Cases', onCrumb: () => { setIsNewCaseModalOpen(false); setCurrentCaseId(null); } };
        return selectedCase
          ? { title: 'Working file', sub: 'Everything on this matter in one place', crumb: 'Cases', onCrumb: () => setCurrentCaseId(null) }
          : { title: 'Cases', sub: 'Every open and closed matter, by file reference' };
      case 'hearings':
        return { title: 'Hearings', sub: 'Court appearances and case management sessions' };
      case 'calendar':
        return { title: 'Calendar', sub: 'Hearings and compliance deadlines together' };
      case 'tasks':
      case 'caseStatus':
      case 'case-status':
        return { title: 'Case Status', sub: 'Where every matter stands and what happens next' };
      case 'deadlines':
        return { title: 'Deadlines', sub: 'Limitation periods and court filing dates' };
      case 'serviceLog':
        return { title: 'Service Log', sub: 'Every document served and received, across all files' };
      case 'referral':
      case 'referrals':
        return { title: 'Referral Partners', sub: 'Who refers matters and what commission is owed' };
      case 'fileClosing':
      case 'file-closing':
        return { title: 'File Closing', sub: 'Invoice, client account and document checks before closing a file' };
      case 'bankAccounts':
      case 'bank-accounts':
      case 'bankReconciliation':
      case 'bank-reconciliation':
        return { title: 'Bank Accounts', sub: 'Bank balances and reconciliation' };
      case 'trustAuditLogs':
      case 'trust-audit-logs':
        return { title: 'Client Account Audit Log', sub: 'SAR 1990 audit trail of client account entries' };
      case 'users':
      case 'roles':
      case 'practiceSettings':
      case 'practice-settings':
      case 'firmSettings':
      case 'firm-settings':
      case 'settings':
        return { title: 'Firm & Practice Settings', sub: 'Admins only · every change is saved to the Activity Log' };
      case 'reimbursements':
        return { title: 'My Claims', sub: 'Your claims and payment requests · approvals happen in Finance → Approvals' };
      case 'staffPortal':
      case 'staff-portal':
        return { title: 'Staff Portal', sub: [currentUser?.name, currentUser?.staffProfile?.designation || currentUser?.role, 'only your own records are shown here'].filter(Boolean).join(' · ') };
      case 'inventory':
        return { title: 'Office Inventory & Library', sub: 'Office equipment, supplies and the firm library' };
      case 'logs':
        return { title: 'Activity Logs', sub: 'Audit trail of user actions' };
      case 'guide':
        return { title: 'Staff Guide', sub: 'How to use the portal, step by step for your role' };
      case 'about':
        return { title: 'About App', sub: 'About this practice management system' };
      case 'account':
        return { title: 'My Account', sub: 'Your profile and preferences' };
      case 'clientPortal':
      case 'client-portal':
        return { title: 'Client Access Portal', sub: 'Read-only matter progress and shared documents' };
      default:
        return { title: 'SHCO Practice System', sub: 'Malaysian legal practice management' };
    }
  };

  const info = getViewInfo();

  // Navigation shell header (design pack `SHCO Header.dc.html`): title block + tools only.
  // No page actions, no user chip, no sign out — those live in the page toolbar / sidebar footer.
  // Navy is set inline, not via bg-[#16223A]: index.css whitens dark text under that class, which made the
  // white search results, notifications and recycle bin unreadable (white on white).
  return (
    <header style={{ background: '#16223A' }} className="sticky top-0 z-20 box-border rounded-2xl border border-[#16223A] text-[#F6F8FA] px-4 sm:px-6 py-3 flex flex-row flex-wrap items-center justify-start gap-x-6 gap-y-2.5 shadow-[0_12px_24px_-16px_rgba(22,34,58,.8)] font-sans">
      <div className="min-w-0 flex-[1_1_280px]">
        {info.crumb && (
          <button
            type="button"
            onClick={info.onCrumb}
            className="shco-nav-ink inline-block mb-0.5 p-0 bg-transparent border-0 text-[11px] font-semibold tracking-[.02em] text-[#8FB3DE] hover:text-white cursor-pointer"
          >
            ‹ {info.crumb}
          </button>
        )}
        <h1 className="shco-nav-ink m-0 font-serif text-[20px] leading-[28px] font-bold tracking-tight text-[#F6F8FA]">{info.title}</h1>
        <p className="shco-nav-ink mt-0.5 mb-0 text-[12px] leading-4 text-[#DDE3EB] truncate" title={info.sub}>{info.sub}</p>
      </div>

      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 ml-auto shrink">
        {/* Global Search Bar */}
        <div ref={searchBoxRef} className="relative group w-[240px] max-w-full min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#3D6B9C] transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder="Search matters, clients, docs..."
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsSearchOpen(false); }}
            className="box-border w-full pl-8 pr-3 py-1.5 text-xs leading-4 bg-white/95 border border-white/20 text-[#16223A] placeholder:text-slate-400 rounded-md transition-all focus:outline-none focus:border-[#FBF2E9] focus:ring-1 focus:ring-[#FBF2E9]/30"
            aria-label="Global search for matters, clients, documents"
            // Inline so the unlayered global `input {}` rule in index.css can't override the design.
            style={{ padding: '6px 12px 6px 32px', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}
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
                        <button key={c.id} type="button" onClick={() => goToClients(c.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#F6F8FA] cursor-pointer">
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
          className="shco-nav-ink shrink-0 rounded p-1.5 text-[#DDE3EB] transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FBF2E9] cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Recycle Bin & Data Recovery Vault */}
        <button
          onClick={() => setIsRecycleBinOpen(true)}
          className="shco-nav-ink p-2 rounded-lg bg-white border border-[#DDE3EB] hover:border-[#8A6D3B] focus:outline-none focus:ring-2 focus:ring-[#8A6D3B] transition-all relative shadow-2xs cursor-pointer flex items-center gap-1"
          aria-label={`Data recovery vault with ${deletedRecords.length} deleted items`}
          title="Recycle Bin"
        >
          <Archive className="w-4 h-4 text-[#3D6B9C]" />
          {deletedRecords.length > 0 && (
            <span className="shco-nav-ink bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] px-1.5 rounded-full">
              {deletedRecords.length}
            </span>
          )}
        </button>

        {/* Real-Time Hearing & Invoice Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="shco-nav-ink p-1.5 rounded-md bg-white border border-[#DDE3EB] hover:border-[#8A6D3B] focus:outline-none focus:ring-2 focus:ring-[#8A6D3B] transition-all relative shadow-2xs cursor-pointer"
            aria-label={`Notifications: ${unreadNotificationsCount} unread alerts`}
            aria-expanded={isNotifOpen}
            aria-controls="notifications-dropdown"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-[#8A6D3B]" />
            {unreadNotificationsCount > 0 && (
              <span className="shco-nav-ink absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white shadow-sm">
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
                          openNotification(n);
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

      </div>

      <RecycleBinModal isOpen={isRecycleBinOpen} onClose={() => setIsRecycleBinOpen(false)} />
    </header>
  );
};
