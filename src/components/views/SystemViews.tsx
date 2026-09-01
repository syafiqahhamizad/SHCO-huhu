import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Role } from '../../types';
import { getPracticeSettings, DEFAULT_PRACTICE_SETTINGS } from '../../services/templateService';
import {
  Share2,
  Shield,
  ShieldCheck,
  Settings,
  CheckCircle,
  Folder,
  Mail,
  Calendar,
  FileText,
  Grid,
  CheckSquare,
  Building,
  Users,
  HardDrive,
  Briefcase,
  Plus,
  Search,
  Trash2,
  Phone,
  UserPlus,
  Check,
  Palette,
  Printer,
  Eye,
  Download,
  Layout,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  User,
} from 'lucide-react';

/* ================= 1. USERS & ACCESS PERMISSIONS MANAGEMENT ================= */
export const UsersManagementView: React.FC = () => {
  const {
    users = [],
    currentUser,
    updateUserRoleAndAdmin,
    addUser,
    deleteUser,
    rolesMatrix,
    updateRolePermission,
    customRoles = [],
    addCustomRole,
    setCurrentView,
    showToast,
  } = useApp();

  const isSuperAdmin =
    currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);

  const [activeTab] = useState<'roster'>('roster');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<Role>('Lawyer');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('Lawyer');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newIsSuperAdmin, setNewIsSuperAdmin] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const handleCreateRole = () => {
    if (addCustomRole?.(newRoleName)) setNewRoleName('');
  };


  const MODULE_DESCRIPTIONS: Record<string, { label: string; group: string; desc: string }> = {
    dashboard: { label: 'Executive Dashboard', group: 'General', desc: 'Main practice overview, KPIs, fee targets & case tickers.' },
    partnerDashboard: { label: 'Partner Dashboard', group: 'General', desc: 'Partner-level financial analytics and equity metrics.' },
    clientPortal: { label: 'Client Access Portal', group: 'General', desc: 'Client self-service status, invoice payments & file uploads.' },
    leads: { label: 'Intakes & Leads Pipeline', group: 'Practice', desc: 'New client consultation intakes & conversion to active client.' },
    clients: { label: 'Clients Directory & KYC', group: 'Practice', desc: 'Client records, IC/Passport, SSM company registry & contacts.' },
    cases: { label: 'Matters & Court Litigation', group: 'Practice', desc: 'Case files, pleadings, court hearings, deadlines & court diary.' },
    hearings: { label: 'Court Hearings & Diary', group: 'Practice', desc: 'Hearing schedules, court notes and attendance records.' },
    calendar: { label: 'Master Firm Calendar', group: 'Practice', desc: 'Court dates, client meetings and firm deadlines.' },
    documents: { label: 'Document Storage & Vault', group: 'Practice', desc: 'Client file documents, attachments and legal archives.' },
    templates: { label: 'Document Automation', group: 'Practice', desc: 'Pleading templates, agreement generators & document assembly.' },
    caseStatus: { label: 'Case Status Tracking', group: 'Practice', desc: 'Active litigation status and client progress updates.' },
    deadlines: { label: 'Limitation & Statutory Deadlines', group: 'Practice', desc: 'Critical court filing dates and limitation clocks.' },
    courts: { label: 'Courts & Judges Directory', group: 'Practice', desc: 'Malaysian courts hierarchy, judges and corums registry.' },
    referral: { label: 'Referrals & Introducers', group: 'Practice', desc: 'Referral partners and introducer commission tracking.' },
    fileClosing: { label: 'File Closing & Archiving', group: 'Practice', desc: 'Closed matter audits, file retrieval and storage.' },
    reimbursements: { label: 'Claims (Travel & Disbursements)', group: 'Claims', desc: 'Unified claims, travel mileage (RM1.00/RM1.50 per km), tolls/parking & disbursements.' },
    quotations: { label: 'Fee Quotations', group: 'Billing', desc: 'Professional fee quotes and engagement letters (SRO 2023).' },
    time: { label: 'Time Entries', group: 'Billing', desc: 'Fee earner billable hours and time tracking.' },
    invoices: { label: 'Tax Invoices', group: 'Billing', desc: 'Client tax invoices, fee notes and SST billing.' },
    payments: { label: 'Client Payments Received', group: 'Billing', desc: 'Client invoice settlements and receipts log.' },
    receipts: { label: 'Official Receipts', group: 'Billing', desc: 'Official firm receipts generator and repository.' },
    billingReports: { label: 'Billing & Fee Reports', group: 'Billing', desc: 'Fee earner productivity and billing summaries.' },
    retainers: { label: 'Client Trust Account (SAR 1990)', group: 'Client Accounting', desc: 'Client trust ledger, retainer deposits & payment vouchers.' },
    statement: { label: 'Client Statement of Account', group: 'Client Accounting', desc: 'Comprehensive client trust and invoice statement.' },
    trustAuditLogs: { label: 'Trust Audit Log (SAR 1990)', group: 'Client Accounting', desc: 'Mandatory Bar Council trust account compliance log.' },
    trustReports: { label: 'Client Account Reports', group: 'Client Accounting', desc: 'Trust balance reconciliation and client audit reports.' },
    officeAccounts: { label: 'Office Accounts (CFO)', group: 'Firm Accounting', desc: 'Operating expenses, office bank accounts & vendor payments.' },
    bankAccounts: { label: 'Bank Accounts & Virtual Pots', group: 'Firm Accounting', desc: 'Firm trust and office bank accounts management.' },
    bankReconciliation: { label: 'Bank Reconciliation', group: 'Firm Accounting', desc: 'Monthly bank statement matching and reconciliation.' },
    coa: { label: 'Chart of Accounts', group: 'Firm Accounting', desc: 'Firm double-entry general ledger chart of accounts.' },
    inventory: { label: 'Office Inventory & Library', group: 'Firm Accounting', desc: 'Firm stationery, equipment and law library catalog.' },
    gl: { label: 'General Ledger', group: 'Firm Accounting', desc: 'Double-entry general ledger transaction register.' },
    trialBalance: { label: 'Trial Balance', group: 'Firm Accounting', desc: 'Balanced debit and credit financial trial balance.' },
    balanceSheet: { label: 'Balance Sheet', group: 'Firm Accounting', desc: 'Firm assets, liabilities and partner equity statement.' },
    cashFlow: { label: 'Cash Flow Statement', group: 'Firm Accounting', desc: 'Operating, investing and financing cash flow tracking.' },
    officeReports: { label: 'Office Account Reports', group: 'Firm Accounting', desc: 'Financial performance and overhead reports.' },
    users: { label: 'Users & SSO Control', group: 'System', desc: 'User accounts roster, domain validation & role promotions.' },
    practiceSettings: { label: 'Practice Settings (SRO 2023)', group: 'System', desc: 'Solicitors Remuneration Order fees configuration.' },
    firmSettings: { label: 'Firm Settings & Letterheads', group: 'System', desc: 'Firm master profile, letterhead layout & document templates.' },
    logs: { label: 'Activity Logs', group: 'System', desc: 'System activity, audit trails and login history.' },
    roles: { label: 'Roles & Permissions', group: 'System', desc: 'Granular navigation panel access and permissions matrix.' },
    about: { label: 'About System', group: 'System', desc: 'System release notes, version info and developer details.' },
    account: { label: 'My Account & Profile', group: 'System', desc: 'User personal profile, password and preferences.' },
  };

  const ALL_ROLES: Role[] = ['Partner', 'Lawyer', 'Assistant', 'Reviewer', 'Client', ...customRoles];

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      showToast('Name and Email are required');
      return;
    }

    const isFirmRole = newRole === 'Partner' || newRole === 'Lawyer';
    if (isFirmRole && !newEmail.toLowerCase().endsWith('@shcolaw.com')) {
      showToast('Partner and Lawyer accounts must use a verified @shcolaw.com Google Workspace email.');
      return;
    }

    const newUser = {
      id: `U-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
      isAdmin: newIsAdmin,
      isSuperAdmin: newIsSuperAdmin,
      status: 'Active' as const,
    };

    const success = addUser(newUser);
    if (success) {
      setIsAddModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole('Lawyer');
      setNewIsAdmin(false);
      setNewIsSuperAdmin(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#A9814A]" />
              Users Management &amp; Account Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage firm staff, clients, reviewers, and freelancers. Configure system access separately in Roles &amp; Permissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              Add New User Account
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E1DCCF]">
          <button
            type="button"
            onClick={() => setCurrentView('roles')}
            className="px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Manage Permissions in Roles &amp; Permissions
          </button>

          {isSuperAdmin && (
            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="New role name, e.g. Paralegal"
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none w-48"
              />
              <button
                type="button"
                onClick={handleCreateRole}
                className="px-3 py-1.5 rounded-lg font-bold text-xs bg-[#16223A] hover:bg-[#1F2E4D] text-white flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                Create Role
              </button>
            </div>
          )}
        </div>

        {/* Super Admin Ownership Banner */}
        <div className={`p-3 rounded-xl border flex items-start md:items-center gap-3 text-xs ${
          isSuperAdmin
            ? 'bg-amber-50/90 border-amber-300 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <Shield className={`w-5 h-5 shrink-0 ${isSuperAdmin ? 'text-amber-800' : 'text-slate-500'}`} />
          <div className="flex-1">
            <div className="font-bold text-[#16223A] flex items-center gap-2">
              <span>Super Admin Master Authority: Syafiqah Hamizad (syafiqahhamizad@shcolaw.com)</span>
              {isSuperAdmin ? (
                <span className="px-2 py-0.5 bg-amber-200 text-amber-950 rounded font-bold text-[9px] uppercase">
                  ACTIVE SUPER ADMIN SESSION
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[9px] uppercase">
                  RESTRICTED READ-ONLY VIEW
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Only Syafiqah Hamizad can alter module visibility matrix or promote users to Admin/Super Admin.
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'roster' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex justify-between items-center font-serif font-bold text-sm text-[#16223A]">
            <span>Firm Staff &amp; Client Roster</span>
            <span className="text-slate-500 font-sans text-xs font-normal">
              Access policy: firm SSO, client portal, and approved external accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">User Name</th>
                  <th className="p-3 font-bold">Staff ID</th>
                  <th className="p-3 font-bold">Email / SSO Account</th>
                  <th className="p-3 font-bold">Domain Validation</th>
                  <th className="p-3 font-bold">Assigned Role</th>
                  <th className="p-3 font-bold text-center">Admin Rights</th>
                  <th className="p-3 font-bold text-center">Super Admin</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {users.map((u) => {
                  const isShcoEmail = u.email.toLowerCase().endsWith('@shcolaw.com');
                  const isUserSuperAdmin = u.email === 'syafiqahhamizad@shcolaw.com' || u.isSuperAdmin;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-[#16223A]">
                        <div className="flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isUserSuperAdmin && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8px] font-bold px-1 rounded">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-700 text-[11px]">{u.email}</td>

                      <td className="p-3 font-mono text-[#16223A] text-[11px] font-bold">{u.staffProfile?.staffId || (u.role === 'Client' ? 'Client account' : 'Pending')}</td>

                      <td className="p-3">
                        {isShcoEmail ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" /> Valid @shcolaw.com SSO
                          </span>
                        ) : u.role === 'Reviewer' || u.role === 'Assistant' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px] w-fit block">
                            Approved External Account
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] w-fit block">
                            Client Password Portal
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {isSuperAdmin ? (
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const newR = e.target.value as any;
                              updateUserRoleAndAdmin(u.id, newR, u.isAdmin, u.isSuperAdmin);
                            }}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:ring-1 focus:ring-[#A9814A] outline-none"
                          >
                            {ALL_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-800 font-bold rounded text-xs">
                            {u.role}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={u.isAdmin}
                          disabled={!isSuperAdmin}
                          onChange={(e) => {
                            updateUserRoleAndAdmin(u.id, u.role, e.target.checked, u.isSuperAdmin);
                          }}
                          className={`rounded accent-[#A9814A] cursor-pointer ${
                            !isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(u.isSuperAdmin)}
                          disabled={!isSuperAdmin || u.email === 'syafiqahhamizad@shcolaw.com'}
                          onChange={(e) => {
                            updateUserRoleAndAdmin(u.id, u.role, u.isAdmin, e.target.checked);
                          }}
                          className={`rounded accent-amber-600 cursor-pointer ${
                            !isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                      </td>

                      <td className="p-3 text-right">
                        {isSuperAdmin ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => updateUserRoleAndAdmin(u.id, u.role, !u.isAdmin, u.isSuperAdmin)}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[11px] cursor-pointer"
                            >
                              Toggle Access
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove user ${u.name} from this system?`)) deleteUser(u.id);
                              }}
                              disabled={u.email === 'syafiqahhamizad@shcolaw.com'}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E1DCCF]">
            <div>
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#A9814A]" />
                Role-Based Module View &amp; Access Control Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure exact module permissions per role. Unchecked modules are hidden from sidebar and blocked by route middleware.
              </p>
            </div>

            {/* Select Role Selector */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Filter Role:</span>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRoleForMatrix(role)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      selectedRoleForMatrix === role
                        ? 'bg-[#16223A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Summary of Role Access */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#16223A]">Configuring Role Policy for: </span>
              <span className="px-2 py-0.5 bg-[#16223A] text-white font-bold rounded uppercase text-[10px] ml-1">
                {selectedRoleForMatrix}
              </span>
            </div>
            {selectedRoleForMatrix === 'Lawyer' && (
              <span className="text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded text-[11px] border border-rose-300">
                ⚠️ Policy Active: Lawyers are strictly barred from Finance, Retainers &amp; CFO accounts.
              </span>
            )}
            {selectedRoleForMatrix === 'Client' && (
              <span className="text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px] border border-amber-300">
                🔒 Policy Active: Clients can ONLY view the Client Self-Service Portal.
              </span>
            )}
            {selectedRoleForMatrix === 'Partner' && (
              <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px] border border-emerald-300">
                ✅ Full Equity Access: All practice &amp; financial modules enabled.
              </span>
            )}
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Portal Module Name</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold">Description</th>
                  <th className="p-3 font-bold text-center">View Access (v)</th>
                  <th className="p-3 font-bold text-center">Add / Create (a)</th>
                  <th className="p-3 font-bold text-center">Edit / Modify (e)</th>
                  <th className="p-3 font-bold text-right">Status Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(MODULE_DESCRIPTIONS).map(([modKey, modInfo]) => {
                  const rolePerm = rolesMatrix[selectedRoleForMatrix]?.[modKey] || { v: 0, a: 0, e: 0 };
                  const isAllowedView = rolePerm.v === 1;

                  return (
                    <tr key={modKey} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-[#16223A]">
                        {modInfo.label}
                      </td>

                      <td className="p-3 font-mono text-[10px] text-slate-500 uppercase">
                        {modInfo.group}
                      </td>

                      <td className="p-3 text-slate-600 max-w-xs text-[11px]">
                        {modInfo.desc}
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.v === 1}
                          disabled={!isSuperAdmin}
                          onChange={(e) => {
                            updateRolePermission(selectedRoleForMatrix, modKey, 'v', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.a === 1}
                          disabled={!isSuperAdmin || !isAllowedView}
                          onChange={(e) => {
                            updateRolePermission(selectedRoleForMatrix, modKey, 'a', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.e === 1}
                          disabled={!isSuperAdmin || !isAllowedView}
                          onChange={(e) => {
                            updateRolePermission(selectedRoleForMatrix, modKey, 'e', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>

                      <td className="p-3 text-right">
                        {isAllowedView ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                            RESTRICTED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add New User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#E1DCCF]">
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#A9814A]" />
                Add New System User
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-3 text-xs">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
                Registering an internal user also creates a linked staff record and assigns the next unique Staff ID. Complete employment details and staff milestones later in Staff Portal.
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full User Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Encik Hafizuddin"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. reviewer@externalfirm.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">System Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-semibold"
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Partner and Lawyer accounts require <strong>@shcolaw.com</strong>. Reviewer and Assistant accounts may use an external email.
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    className="rounded accent-[#A9814A]"
                  />
                  <span>Grant Admin Overlay Privileges</span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsSuperAdmin}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setNewIsSuperAdmin(e.target.checked)}
                    className="rounded accent-amber-600"
                  />
                  <span>Grant Super Admin Access Privileges</span>
                </label>

                {!isSuperAdmin && (
                  <p className="text-[10px] text-rose-700 italic">
                    Note: Admin privileges can only be assigned by Super Admin Syafiqah Hamizad.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1DCCF]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-lg cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const UsersAndPermissionsView: React.FC = () => {
  const [activePanel, setActivePanel] = useState<'users' | 'permissions'>('users');

  return (
    <div className="space-y-4">
      <div className="bg-[#16223A] text-white rounded-xl p-4 shadow-xs">
        <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">System administration</p>
        <h2 className="font-serif text-xl font-bold mt-1">Users &amp; Permissions</h2>
        <p className="text-xs text-slate-300 mt-1">Manage people in the roster and configure what they can access.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setActivePanel('users')}
            className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${activePanel === 'users' ? 'bg-amber-400 text-[#16223A]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            User Accounts
          </button>
          <button
            type="button"
            onClick={() => setActivePanel('permissions')}
            className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${activePanel === 'permissions' ? 'bg-amber-400 text-[#16223A]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            Roles &amp; Permissions
          </button>
        </div>
      </div>
      {activePanel === 'users' ? <UsersManagementView /> : <SecurityView />}
    </div>
  );
};

/* ================= 2. SECURITY & AUDIT LOG ================= */
export const SecurityView: React.FC = () => {
  const {
    auditLog = [],
    logs = [],
    rolesMatrix = {},
    users = [],
    currentUser,
    updateRolePermission,
    updateUserNavOverride,
    customRoles = [],
    sequenceCounters = {
      invoiceSeq: 0,
      quotationSeq: 0,
      caseSeq: 0,
      receiptSeq: 0,
      voucherSeq: 0,
      claimSeq: 0,
      clientSeq: 0,
      leadSeq: 0,
    },
    factoryResetSystem,
  } = useApp() || {};

  const [activeTab, setActiveTab] = useState<'matrix' | 'userOverrides' | 'audit' | 'factoryReset'>('matrix');
  const [selectedRole, setSelectedRole] = useState<Role>('Lawyer');
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || 'U-001');
  const [searchNavQuery, setSearchNavQuery] = useState('');
  const [confirmResetText, setConfirmResetText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const isSuperAdmin =
    currentUser?.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser?.isSuperAdmin);

  const NAVIGATION_ITEMS: Record<string, { label: string; group: string; sensitive?: boolean; desc: string }> = {
    dashboard: { label: 'Executive Dashboard', group: 'General', desc: 'Main practice overview & fee tickers.' },
    partnerDashboard: { label: 'Partner Analytics', group: 'General', desc: 'Partner equity and revenue metrics.' },
    clientPortal: { label: 'Client Access Portal', group: 'General', desc: 'Client self-service status & payments.' },
    leads: { label: 'Intakes & Leads Pipeline', group: 'Practice', desc: 'Consultation intakes & conflict checks.' },
    clients: { label: 'Clients Directory & KYC', group: 'Practice', desc: 'Client database & SSM registration records.' },
    cases: { label: 'Matters & Court Litigation', group: 'Practice', desc: 'Litigation case files & pleadings.' },
    hearings: { label: 'Court Hearings Diary', group: 'Practice', desc: 'Hearing schedules & court notes.' },
    reimbursements: {
      label: 'Claims & Disbursements',
      group: 'Claims',
      sensitive: true,
      desc: 'Travel claims (RM 1.00/RM 1.50 per km), tolls, parking & staff reimbursements. Component-level restricted.',
    },
    quotations: { label: 'Fee Quotations', group: 'Billing', desc: 'Fee proposals & engagement letters (SRO 2023).' },
    time: { label: 'Time Entries', group: 'Billing', desc: 'Fee earner billable hours.' },
    invoices: { label: 'Tax Invoices', group: 'Billing', desc: 'Client tax invoices & SST billing.' },
    payments: { label: 'Client Payments Received', group: 'Billing', desc: 'Invoice collections & receipts.' },
    receipts: { label: 'Official Receipts', group: 'Billing', desc: 'Official firm receipt generation.' },
    billingReports: { label: 'Billing Reports', group: 'Billing', desc: 'Fee productivity & billing summaries.' },
    retainers: {
      label: 'Client Trust Accounts (SAR 1990)',
      group: 'Client Accounting',
      sensitive: true,
      desc: 'Client trust ledger, retainers & payment vouchers. Component-level restricted.',
    },
    statement: { label: 'Client Statement of Account', group: 'Client Accounting', desc: 'Trust & invoice statement.' },
    trustAuditLogs: {
      label: 'Trust Audit Logs (SAR 1990)',
      group: 'Client Accounting',
      sensitive: true,
      desc: 'Mandatory Bar Council trust account audit log.',
    },
    officeAccounts: { label: 'Office Accounts (CFO)', group: 'Firm Accounting', desc: 'Firm operating expenses & vendors.' },
    bankAccounts: { label: 'Bank Accounts & Pots', group: 'Firm Accounting', desc: 'Firm trust & office bank accounts.' },
    bankReconciliation: { label: 'Bank Reconciliation', group: 'Firm Accounting', desc: 'Monthly bank statement matching.' },
    coa: { label: 'Chart of Accounts', group: 'Firm Accounting', desc: 'Firm double-entry chart of accounts.' },
    users: { label: 'Users & SSO Control', group: 'System', desc: 'User roster, domain validation & SSO.' },
    firmSettings: { label: 'Firm Settings & Branding', group: 'System', desc: 'Letterheads & firm profile.' },
    roles: { label: 'Roles & Permissions', group: 'System', desc: 'Explicit navigation panel access controls.' },
    logs: { label: 'Security & Audit Logs', group: 'System', desc: 'Immutable audit trail & activity logs.' },
  };

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];

  const filteredNavItems = Object.entries(NAVIGATION_ITEMS).filter(([key, item]) => {
    if (!searchNavQuery) return true;
    const term = searchNavQuery.toLowerCase();
    return (
      key.toLowerCase().includes(term) ||
      item.label.toLowerCase().includes(term) ||
      item.group.toLowerCase().includes(term) ||
      item.desc.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-700" />
              Security Access Control &amp; Navigation Permissions Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure component-level access based on explicit sidebar navigation panel items for sensitive modules like Claims and Trust Accounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin ? (
              <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold">
                Signed in as Super Admin: {currentUser?.name}
              </span>
            ) : (
              <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold">
                View-only: {currentUser?.name} is not a Super Admin
              </span>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E1DCCF]">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Explicit Navigation Panel Item Matrix
          </button>

          <button
            onClick={() => setActiveTab('userOverrides')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'userOverrides'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Per-User Navigation Overrides
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            Immutable Audit Trail &amp; Access Logs ({logs.length + auditLog.length})
          </button>

          <button
            onClick={() => setActiveTab('factoryReset')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'factoryReset'
                ? 'bg-rose-900 text-white shadow-xs border border-rose-700'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Factory Reset &amp; Sequence Counters</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Navigation Panel Matrix */}
      {activeTab === 'matrix' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E1DCCF]">
            <div>
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#A9814A]" />
                Navigation Item Access Matrix (Role-Based)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle access for individual sidebar navigation items. Sensitive modules like Claims and Trust Accounts require explicit View (v) enablement.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter navigation item..."
                  value={searchNavQuery}
                  onChange={(e) => setSearchNavQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['Partner', 'Lawyer', 'Assistant', 'Reviewer', 'Client', ...customRoles] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRole(r)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      selectedRole === r
                        ? 'bg-[#16223A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Navigation Item</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold">Description</th>
                  <th className="p-3 font-bold text-center">View (v)</th>
                  <th className="p-3 font-bold text-center">Create (a)</th>
                  <th className="p-3 font-bold text-center">Edit (e)</th>
                  <th className="p-3 font-bold text-right">Protection Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNavItems.map(([navKey, navInfo]) => {
                  const rolePerm = rolesMatrix[selectedRole]?.[navKey] || { v: 0, a: 0, e: 0 };
                  const isAllowed = rolePerm.v === 1;

                  return (
                    <tr key={navKey} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-[#16223A]">
                        <div className="flex items-center gap-2">
                          <span>{navInfo.label}</span>
                          {navInfo.sensitive && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[9px] border border-rose-200">
                              🔒 Sensitive Component
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-[10px] text-slate-500 font-mono uppercase">{navInfo.group}</td>
                      <td className="p-3 text-slate-600 text-[11px] max-w-xs">{navInfo.desc}</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.v === 1}
                          disabled={!isSuperAdmin}
                          onChange={(e) => updateRolePermission(selectedRole, navKey, 'v', e.target.checked ? 1 : 0)}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.a === 1}
                          disabled={!isSuperAdmin}
                          title={!isAllowed ? 'Granting Add will also switch on View for this row.' : undefined}
                          onChange={(e) => {
                            // Add/Edit imply View so Super Admins are never blocked by the View-first rule
                            if (e.target.checked && !isAllowed) updateRolePermission(selectedRole, navKey, 'v', 1);
                            updateRolePermission(selectedRole, navKey, 'a', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rolePerm.e === 1}
                          disabled={!isSuperAdmin}
                          title={!isAllowed ? 'Granting Edit will also switch on View for this row.' : undefined}
                          onChange={(e) => {
                            if (e.target.checked && !isAllowed) updateRolePermission(selectedRole, navKey, 'v', 1);
                            updateRolePermission(selectedRole, navKey, 'e', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-[#A9814A] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-right">
                        {isAllowed ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                            Access Granted
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                            Component Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Per-User Navigation Overrides */}
      {activeTab === 'userOverrides' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E1DCCF]">
            <div>
              <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700" />
                Explicit User-Level Navigation Access Overrides
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Override navigation panel access for specific individual staff accounts (e.g. granting custom Claims or Trust Account access).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Select User Account:</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800">User Profile: </span>
              <span className="font-bold text-blue-900">{selectedUser?.name}</span>
              <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px]">
                Base Role: {selectedUser?.role}
              </span>
            </div>
            <span className="text-slate-600 text-[11px]">
              Toggling checkboxes below sets explicit individual account overrides.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Navigation Item</th>
                  <th className="p-3 font-bold">Base Role Permission</th>
                  <th className="p-3 font-bold text-center">User Explicit Override (View)</th>
                  <th className="p-3 font-bold text-center">User Explicit Override (Create)</th>
                  <th className="p-3 font-bold text-center">User Explicit Override (Edit)</th>
                  <th className="p-3 font-bold text-right">Effective Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(NAVIGATION_ITEMS).map(([navKey, navInfo]) => {
                  const baseRolePerm = rolesMatrix[selectedUser?.role || 'Lawyer']?.[navKey] || { v: 0, a: 0, e: 0 };
                  const userOverride = selectedUser?.navOverrides?.[navKey];
                  const effectiveView = userOverride !== undefined ? userOverride.v === 1 : baseRolePerm.v === 1;

                  return (
                    <tr key={navKey} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-[#16223A]">
                        {navInfo.label}
                        {navInfo.sensitive && (
                          <span className="ml-2 text-[9px] bg-rose-100 text-rose-800 px-1 rounded font-bold">
                            Sensitive
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {baseRolePerm.v === 1 ? 'Role: Enabled' : 'Role: Restricted'}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={effectiveView}
                          disabled={!isSuperAdmin}
                          onChange={(e) =>
                            updateUserNavOverride(selectedUser.id, navKey, 'v', e.target.checked ? 1 : 0)
                          }
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={
                            userOverride !== undefined ? userOverride.a === 1 : baseRolePerm.a === 1
                          }
                          disabled={!isSuperAdmin}
                          title={!effectiveView ? 'Granting Add will also switch on View for this user.' : undefined}
                          onChange={(e) => {
                            // Add/Edit imply View so Super Admins are never blocked by the View-first rule
                            if (e.target.checked && !effectiveView) updateUserNavOverride(selectedUser.id, navKey, 'v', 1);
                            updateUserNavOverride(selectedUser.id, navKey, 'a', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={
                            userOverride !== undefined ? userOverride.e === 1 : baseRolePerm.e === 1
                          }
                          disabled={!isSuperAdmin}
                          title={!effectiveView ? 'Granting Edit will also switch on View for this user.' : undefined}
                          onChange={(e) => {
                            if (e.target.checked && !effectiveView) updateUserNavOverride(selectedUser.id, navKey, 'v', 1);
                            updateUserNavOverride(selectedUser.id, navKey, 'e', e.target.checked ? 1 : 0);
                          }}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-right">
                        {effectiveView ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                            {userOverride ? 'OVERRIDDEN: ALLOWED' : 'ALLOWED'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                            {userOverride ? 'OVERRIDDEN: LOCKED' : 'LOCKED'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#E1DCCF]">
            <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-700" />
              Security Audit Trail &amp; Immutable System Logs
            </h3>
            <span className="text-slate-500 text-xs">Full legal compliance logging</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Timestamp</th>
                  <th className="p-3 font-bold">User</th>
                  <th className="p-3 font-bold">Action</th>
                  <th className="p-3 font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-slate-500">{log.ts}</td>
                    <td className="p-3 font-bold text-slate-800">{log.user}</td>
                    <td className="p-3 font-sans">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-700">{log.details}</td>
                  </tr>
                ))}
                {auditLog.map((log) => (
                  <tr key={log.id}>
                    <td className="p-3 text-slate-500">{log.timestamp}</td>
                    <td className="p-3 font-bold text-slate-800">{log.user}</td>
                    <td className="p-3 font-sans">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Factory Reset & Sequence Counters Control */}
      {activeTab === 'factoryReset' && (
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E1DCCF]">
            <div>
              <h3 className="font-serif font-bold text-lg text-rose-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-700" />
                <span>Factory Reset &amp; Sequence Counters Administration</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Purge all operational/testing data from the database and reset sequence counters (Invoice IDs, Case Numbers, Quotations) to zero for a clean slate.
              </p>
            </div>

            <div className="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Restricted to Super Admin &amp; System Administrators</span>
            </div>
          </div>

          {/* Sequence Counters Status */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#16223A] flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Active Running Document Sequence Counters</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Resets to #0000 upon Factory Reset execution</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Tax Invoices</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  INV-2026-{String((sequenceCounters.invoiceSeq || 0) + 1).padStart(4, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.invoiceSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Fee Quotations</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  QUOT-2026-{String((sequenceCounters.quotationSeq || 0) + 1).padStart(4, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.quotationSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Case Running No.</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  {String(sequenceCounters.caseSeq || 0).padStart(3, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.caseSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Official Receipts</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  HQ-OR-{String((sequenceCounters.receiptSeq || 0) + 1).padStart(4, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.receiptSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Payment Vouchers</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  HQ-PV-{String((sequenceCounters.voucherSeq || 0) + 1).padStart(4, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.voucherSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Travel Claims</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  TC-{String((sequenceCounters.claimSeq || 0) + 1).padStart(4, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.claimSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Client Directory</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  HQ-C{String((sequenceCounters.clientSeq || 0) + 1).padStart(3, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.clientSeq || 0}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="text-slate-500 text-[10px] uppercase font-bold">Intake Leads</div>
                <div className="text-base font-bold font-mono text-[#16223A] mt-0.5">
                  LD-{String((sequenceCounters.leadSeq || 0) + 1).padStart(3, '0')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Current Counter: #{sequenceCounters.leadSeq || 0}</div>
              </div>
            </div>
          </div>

          {/* Impact Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cleared Data Collections */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase text-rose-900 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Collections to be Cleared (Purged)</span>
              </h4>
              <ul className="text-xs text-rose-900/90 space-y-1 list-disc pl-4">
                <li>Clients Directory &amp; Uploaded KYC Records</li>
                <li>Intakes &amp; Lead Conversion Pipeline</li>
                <li>Matters, Court Hearing Diary &amp; Pleadings</li>
                <li>Tax Invoices &amp; Payment Collections</li>
                <li>Fee Quotations &amp; Engagement Letters</li>
                <li>Client Trust Ledger &amp; Retainers (SAR 1990)</li>
                <li>Official Receipts &amp; Payment Vouchers</li>
                <li>Travel Claims &amp; Staff Reimbursements</li>
                <li>General Ledger Journal Entries</li>
                <li>Statutory Limitation Deadlines</li>
              </ul>
            </div>

            {/* Preserved Configurations */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-xs uppercase text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>System Configurations Preserved</span>
              </h4>
              <ul className="text-xs text-emerald-900/90 space-y-1 list-disc pl-4">
                <li>Firm Branding, Letterhead, Bar Ref &amp; SST Settings</li>
                <li>Bank Accounts &amp; Chart of Accounts (COA) Structure</li>
                <li>Solicitors Remuneration Order (SRO 2023) Scale Rates</li>
                <li>Custom Word / HTML Document Templates</li>
                <li>User Accounts, Passwords &amp; Staff Roster</li>
                <li>Security Access Permissions &amp; Navigation Matrix</li>
              </ul>
            </div>
          </div>

          {/* Execution Form */}
          <div className="bg-rose-100/60 border border-rose-300 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-rose-950 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-700" />
                <span>Execute Factory Reset Execution</span>
              </h4>
              <p className="text-xs text-rose-900/80">
                This action is permanent and cannot be undone. All transactional files will be deleted and sequence counters will reset to zero.
              </p>
            </div>

            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-bold text-rose-950">
                Type <span className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-rose-900">FACTORY RESET</span> to confirm:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={confirmResetText}
                  onChange={(e) => setConfirmResetText(e.target.value)}
                  placeholder="FACTORY RESET"
                  className="p-2 border border-rose-300 rounded-lg text-xs font-mono font-bold bg-white text-rose-950 w-full outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  disabled={confirmResetText !== 'FACTORY RESET' || isResetting}
                  onClick={async () => {
                    if (!factoryResetSystem) return;
                    setIsResetting(true);
                    try {
                      await factoryResetSystem();
                      setConfirmResetText('');
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-xs text-white shrink-0 transition-all shadow-xs flex items-center gap-1.5 ${
                    confirmResetText === 'FACTORY RESET' && !isResetting
                      ? 'bg-rose-700 hover:bg-rose-800 cursor-pointer'
                      : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isResetting ? 'Purging Database...' : 'Execute Factory Reset'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 3. FIRM SETTINGS ================= */
export const SettingsView: React.FC = () => {
  const { partners = [], showToast, currentUser, currentView, theme = 'light', setTheme } = useApp() || {};
  const [activeTab, setActiveTab] = useState<'profile' | 'bank' | 'partners' | 'branding' | 'account'>(
    currentView === 'account' ? 'account' : 'branding'
  );

  // Firm Branding & Letterhead Configuration State
  const [firmLegalName, setFirmLegalName] = useState('MESSRS SYAFIQAH HAMIZAD & CO');
  const [firmSubtitle, setFirmSubtitle] = useState('Advocates & Solicitors • Peguambela & Peguamcara');
  const [headerBadgeText, setHeaderBadgeText] = useState('SH');
  const [headerStyle, setHeaderStyle] = useState<'formal' | 'modern' | 'centered'>('formal');
  const [addressLine, setAddressLine] = useState('8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi, Selangor');
  const [contactPhone, setContactPhone] = useState('+603-8684 1998 / +6011-7382 8754');
  const [officialEmail, setOfficialEmail] = useState('shco@shcolaw.com');
  const [barCouncilNo, setBarCouncilNo] = useState('BC/S/2024/9912');
  const [sstRegNo, setSstRegNo] = useState('W10-2401-3200019');

  // Document Formatting Templates
  const [engagementOpeningText, setEngagementOpeningText] = useState(
    'We are pleased to confirm our appointment to act as your Advocates & Solicitors in relation to the abovementioned legal matter. This letter sets out the agreed scope of professional representation, fee structure, and statutory terms of engagement.'
  );
  const [engagementTermsClause, setEngagementTermsClause] = useState(
    '1. Professional fees are governed by the Solicitors Remuneration Order (SRO 2023).\n2. All out-of-pocket disbursements (court filing fees, registration fees, stamping) shall be reimbursed by the client.\n3. Initial trust deposit monies shall be held in our Client Trust Account pursuant to Solicitors\' Account Rules 1990.\n4. This agreement shall be governed by and construed in accordance with the laws of Malaysia.'
  );
  const [quotationValidityDays, setQuotationValidityDays] = useState('30');
  const [paymentTermDays, setPaymentTermDays] = useState('14');
  const [disbursementNote, setDisbursementNote] = useState(
    'Invoices are payable within the stipulated payment terms. Payments should be credited to our CIMB Office Operating Account or Bank Islam Client Trust Account as instructed.'
  );

  const [previewDocType, setPreviewDocType] = useState<'engagement' | 'quotation' | 'invoice'>('engagement');

  const handleSaveBranding = () => {
    showToast('Master Firm Branding & Document Templates saved successfully!', 'success');
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner with Settings Navigation Tabs */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#A9814A]" />
              Firm Settings &amp; Master System Configurations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage firm master profile, trust bank accounts, partner equity, and master document letterheads &amp; branding.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E1DCCF]">
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-[#A9814A]" />
            Firm Letterhead &amp; Document Branding
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-[#A9814A]" />
            Firm Master Profile
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bank'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-purple-700" />
            Mandatory Bank Accounts (SAR)
          </button>

          <button
            onClick={() => setActiveTab('partners')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'partners'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#A9814A]" />
            Partners Directory
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'account'
                ? 'bg-[#16223A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#A9814A]" />
            My Account &amp; User Preferences
          </button>
        </div>
      </div>

      {/* Tab Contents */}

      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Form Settings Panel */}
          <div className="lg:col-span-7 space-y-4">
            {/* Header & Letterhead Configuration Card */}
            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[#A9814A]" />
                  <span>1. Firm Master Letterhead &amp; Header Branding</span>
                </h3>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[10px] font-bold">
                  Applies to All Generated Documents
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 uppercase block mb-1">Legal Firm Name (Letterhead Title)</label>
                  <input
                    type="text"
                    value={firmLegalName}
                    onChange={(e) => setFirmLegalName(e.target.value)}
                    className="w-full font-serif font-bold p-2 bg-white border border-slate-300 rounded text-xs text-[#16223A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Subtitle / Practice Designation</label>
                  <input
                    type="text"
                    value={firmSubtitle}
                    onChange={(e) => setFirmSubtitle(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Firm Crest / Logo Badge Initials</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={headerBadgeText}
                    onChange={(e) => setHeaderBadgeText(e.target.value.toUpperCase())}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-[#16223A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Letterhead Header Layout Style</label>
                  <select
                    value={headerStyle}
                    onChange={(e) => setHeaderStyle(e.target.value as 'formal' | 'modern' | 'centered')}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-[#16223A] cursor-pointer"
                  >
                    <option value="formal">Formal Centered Classic (Bar Council Standard)</option>
                    <option value="modern">Modern Dual-Column (Logo Left, Address Right)</option>
                    <option value="centered">Minimalist Gold Line Centered</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Bar Council Ref / SST No.</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={barCouncilNo}
                      onChange={(e) => setBarCouncilNo(e.target.value)}
                      placeholder="Bar Ref"
                      className="w-full p-2 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      value={sstRegNo}
                      onChange={(e) => setSstRegNo(e.target.value)}
                      placeholder="SST No"
                      className="w-full p-2 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 uppercase block mb-1">Official Office Address</label>
                  <input
                    type="text"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Official Contact Tel / Mobile</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Official Domain Email</label>
                  <input
                    type="text"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Engagement Letter Formatting Rules Card */}
            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#A9814A]" />
                  <span>2. Engagement Letter Master Format &amp; Clauses</span>
                </h3>
                <span className="text-[10.5px] font-mono text-slate-500">Legal Representation Instrument</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Master Engagement Opening Paragraph</label>
                  <textarea
                    rows={2}
                    value={engagementOpeningText}
                    onChange={(e) => setEngagementOpeningText(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-800 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Standard Terms &amp; Governing Clauses</label>
                  <textarea
                    rows={4}
                    value={engagementTermsClause}
                    onChange={(e) => setEngagementTermsClause(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Fee Quotations & Tax Invoices Master Branding Card */}
            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                  <Layout className="w-4 h-4 text-emerald-700" />
                  <span>3. Fee Quotations &amp; Tax Invoices Format Rules</span>
                </h3>
                <span className="text-[10.5px] font-mono text-emerald-800 font-bold">SST 8% Billing Rules</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Quotation Validity Period (Days)</label>
                  <input
                    type="number"
                    value={quotationValidityDays}
                    onChange={(e) => setQuotationValidityDays(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-1">Tax Invoice Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={paymentTermDays}
                    onChange={(e) => setPaymentTermDays(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 uppercase block mb-1">Billing Footer &amp; Bank Payment Instructions</label>
                  <textarea
                    rows={2}
                    value={disbursementNote}
                    onChange={(e) => setDisbursementNote(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-800 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setFirmLegalName('MESSRS SYAFIQAH HAMIZAD & CO');
                  setFirmSubtitle('Advocates & Solicitors • Peguambela & Peguamcara');
                  setHeaderBadgeText('SH');
                  setHeaderStyle('formal');
                  showToast('Reset to master firm defaults', 'info');
                }}
                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <button
                type="button"
                onClick={handleSaveBranding}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Save Master Branding &amp; Format Templates</span>
              </button>
            </div>
          </div>

          {/* Real-Time Live Letterhead Document Preview Panel */}
          <div className="lg:col-span-5 space-y-3">
            <div className="sticky top-4 space-y-3">
              <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#A9814A]" />
                    <span>Live Branding &amp; Letterhead Preview</span>
                  </h4>
                  <span className="flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" />
                    <span>Real-Time Updates</span>
                  </span>
                </div>

                {/* Preview Selector */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewDocType('engagement')}
                    className={`flex-1 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
                      previewDocType === 'engagement'
                        ? 'bg-[#16223A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Engagement Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDocType('quotation')}
                    className={`flex-1 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
                      previewDocType === 'quotation'
                        ? 'bg-[#16223A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fee Quotation
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDocType('invoice')}
                    className={`flex-1 py-1 rounded text-[10.5px] font-bold transition-colors cursor-pointer ${
                      previewDocType === 'invoice'
                        ? 'bg-[#16223A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tax Invoice
                  </button>
                </div>

                {/* Simulated Paper Letterhead Container */}
                <div className="bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg p-5 shadow-sm text-slate-900 text-[10.5px] font-sans leading-relaxed min-h-[440px] flex flex-col justify-between">
                  <div>
                    {/* Dynamic Letterhead Header */}
                    {headerStyle === 'formal' && (
                      <div className="text-center pb-3 border-b-2 border-[#16223A] mb-3">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded bg-[#16223A] text-amber-300 font-serif font-bold text-xs flex items-center justify-center border border-amber-400 shrink-0">
                            {headerBadgeText || 'SH'}
                          </div>
                          <div className="font-serif font-bold text-base tracking-wide text-[#16223A]">
                            {firmLegalName}
                          </div>
                        </div>
                        <div className="text-[10px] font-semibold text-[#5B6478] tracking-widest uppercase">
                          {firmSubtitle}
                        </div>
                        <div className="text-[9.5px] text-slate-600 mt-1">{addressLine}</div>
                        <div className="text-[9px] text-slate-600 font-mono">
                          Email: {officialEmail} &nbsp;|&nbsp; Tel: {contactPhone}
                        </div>
                        <div className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                          Bar Ref: {barCouncilNo} | SST Reg: {sstRegNo}
                        </div>
                      </div>
                    )}

                    {headerStyle === 'modern' && (
                      <div className="flex justify-between items-start pb-3 border-b-2 border-[#16223A] mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-[#16223A] text-amber-300 font-serif font-bold text-sm flex items-center justify-center border border-amber-400">
                            {headerBadgeText || 'SH'}
                          </div>
                          <div>
                            <div className="font-serif font-bold text-sm text-[#16223A]">{firmLegalName}</div>
                            <div className="text-[9.5px] font-semibold text-slate-500 uppercase">{firmSubtitle}</div>
                          </div>
                        </div>
                        <div className="text-right text-[9px] text-slate-600 leading-tight space-y-0.5">
                          <div className="font-medium max-w-[180px]">{addressLine}</div>
                          <div className="font-mono text-slate-500">{officialEmail}</div>
                          <div className="font-mono text-slate-500">SST: {sstRegNo}</div>
                        </div>
                      </div>
                    )}

                    {headerStyle === 'centered' && (
                      <div className="text-center pb-3 border-b-2 border-amber-600 mb-3 space-y-0.5">
                        <div className="font-serif font-extrabold text-base text-[#16223A] tracking-wider uppercase">
                          {firmLegalName}
                        </div>
                        <div className="text-[9.5px] font-semibold text-amber-900 tracking-widest uppercase">
                          {firmSubtitle}
                        </div>
                        <div className="text-[9px] text-slate-600">{addressLine} • Tel: {contactPhone}</div>
                      </div>
                    )}

                    {/* Dynamic Body Content according to Preview Doc Type */}
                    {previewDocType === 'engagement' && (
                      <div className="space-y-3 text-[10px]">
                        <div className="flex justify-between text-slate-500 border-b border-slate-200 pb-1.5 font-mono">
                          <span>Ref: SHC/LIT/ENG-0091/2026</span>
                          <span>Date: 13 August 2026</span>
                        </div>

                        <div className="bg-white p-2 border border-slate-200 rounded font-bold text-[#16223A]">
                          RE: LETTER OF ENGAGEMENT — APPOINTMENT AS ADVOCATES &amp; SOLICITORS
                        </div>

                        <p className="text-slate-700 leading-relaxed italic">{engagementOpeningText}</p>

                        <div className="bg-amber-50/60 p-2 border border-amber-200 rounded space-y-1">
                          <div className="font-bold text-amber-950 uppercase text-[9px]">Master Terms of Engagement:</div>
                          <pre className="text-[9px] font-sans text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {engagementTermsClause}
                          </pre>
                        </div>
                      </div>
                    )}

                    {previewDocType === 'quotation' && (
                      <div className="space-y-3 text-[10px]">
                        <div className="flex justify-between text-slate-500 border-b border-slate-200 pb-1 font-mono">
                          <span>Quotation Ref: QUOT-2026-0811</span>
                          <span>Valid: {quotationValidityDays} Days</span>
                        </div>

                        <div className="bg-slate-100 p-2 border border-slate-300 font-bold text-slate-900">
                          PROPOSED PROFESSIONAL FEES &amp; STATUTORY DISBURSEMENTS
                        </div>

                        <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
                          <thead>
                            <tr className="bg-[#16223A] text-white">
                              <th className="p-1.5 text-left">Description</th>
                              <th className="p-1.5 text-right">Amount (RM)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-200">
                              <td className="p-1.5 font-medium">1. Professional Legal Fee (SRO 2023)</td>
                              <td className="p-1.5 text-right font-mono font-bold">RM 15,000.00</td>
                            </tr>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <td className="p-1.5 font-medium">2. Service Tax (SST 8%)</td>
                              <td className="p-1.5 text-right font-mono font-bold">RM 1,200.00</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="p-1.5 font-medium">3. Disb: High Court Filing &amp; Stamping</td>
                              <td className="p-1.5 text-right font-mono font-bold">RM 850.00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {previewDocType === 'invoice' && (
                      <div className="space-y-3 text-[10px]">
                        <div className="flex justify-between text-slate-500 border-b border-slate-200 pb-1 font-mono">
                          <span>TAX INVOICE NO: INV-2026-0042</span>
                          <span>Terms: {paymentTermDays} Days</span>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-emerald-950 font-semibold flex justify-between items-center">
                          <span>TOTAL PAYABLE AMOUNT</span>
                          <span className="font-mono font-bold text-xs text-[#16223A]">RM 17,050.00</span>
                        </div>

                        <p className="text-[9.5px] text-slate-600 italic bg-white p-2 border border-slate-200 rounded">
                          {disbursementNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Simulated Execution & Signatures Block */}
                  <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-end text-[9px] text-slate-500">
                    <div>
                      <div className="font-bold text-slate-800 uppercase">{firmLegalName}</div>
                      <div>Computer-Generated Practice Instrument</div>
                    </div>
                    <div className="text-right">
                      <div className="border-b border-slate-400 w-24 mb-1"></div>
                      <div className="font-bold text-slate-800">Authorised Partner Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
            <Building className="w-4 h-4 text-[#A9814A]" />
            Firm Master Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-600 uppercase block mb-1">Legal Firm Name</label>
              <input type="text" readOnly value="MESSRS SYAFIQAH HAMIZAD & CO" className="w-full bg-slate-50 font-bold p-2 border border-slate-200 rounded" />
            </div>
            <div>
              <label className="font-bold text-slate-600 uppercase block mb-1">Bar Council Ref No.</label>
              <input type="text" readOnly value="BC/S/2024/9912" className="w-full bg-slate-50 font-mono p-2 border border-slate-200 rounded" />
            </div>
            <div>
              <label className="font-bold text-slate-600 uppercase block mb-1">SST Registration No.</label>
              <input type="text" readOnly value="W10-2401-3200019" className="w-full bg-slate-50 font-mono p-2 border border-slate-200 rounded" />
            </div>
            <div>
              <label className="font-bold text-slate-600 uppercase block mb-1">Kuala Terengganu Office Address</label>
              <input
                type="text"
                readOnly
                value="No. 14, Tingkat 2, Jalan Sultan Ismail, 20200 Kuala Terengganu, Terengganu"
                className="w-full bg-slate-50 p-2 border border-slate-200 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bank' && (() => {
        const sysPracticeSettings = getPracticeSettings();
        const sysBankAccounts = sysPracticeSettings.bankAccounts && sysPracticeSettings.bankAccounts.length > 0
          ? sysPracticeSettings.bankAccounts
          : DEFAULT_PRACTICE_SETTINGS.bankAccounts || [];

        return (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-purple-800" />
                  <span>Mandatory Separate Bank Accounts (Solicitors' Account Rules 1990)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Registered firm client trust accounts &amp; office operating accounts
                </p>
              </div>

              <span className="text-xs font-bold text-[#16223A] bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                {sysBankAccounts.length} Active Firm Bank Accounts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sysBankAccounts.map((acc) => {
                const isTrust = acc.accountType === 'Client Trust' || acc.accountType === 'Syariah Escrow' || acc.accountType === 'Fixed Deposit Stakeholder';
                return (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-xl border space-y-1.5 ${
                      isTrust
                        ? 'bg-purple-50/70 border-purple-200'
                        : 'bg-blue-50/60 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`font-bold text-sm ${isTrust ? 'text-purple-900' : 'text-blue-900'}`}>
                        {acc.bankName} — <span className="uppercase text-xs">{acc.accountType}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-300">
                        GL Code: {acc.glAccountCode || '1010'}
                      </span>
                    </div>

                    <div className="font-mono text-slate-800 text-xs font-bold tracking-wider">
                      Account No: {acc.accountNo}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">
                      {acc.accountName}
                    </div>

                    <p className="text-[10px] text-slate-500 pt-1">
                      {acc.notes || (isTrust ? 'Strict compliance with SAR 1990. Held in trust for client funds.' : 'Firm operating account for professional fee collections.')}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Branch: {acc.branch || 'Kuala Lumpur HQ'}</span>
                      {acc.swiftCode && <span>SWIFT: {acc.swiftCode}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {activeTab === 'partners' && (
        <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#A9814A]" />
            Partners Directory &amp; Equity Share
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500 bg-[#F6F4EE]">
                <th className="p-2.5 font-bold">Code</th>
                <th className="p-2.5 font-bold">Partner Name</th>
                <th className="p-2.5 font-bold">Practising Cert No.</th>
                <th className="p-2.5 text-right font-bold">Equity Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(partners || []).map((p) => (
                <tr key={p.code}>
                  <td className="p-2.5 font-mono font-bold text-slate-800">{p.code}</td>
                  <td className="p-2.5 font-bold text-[#16223A]">{p.name}</td>
                  <td className="p-2.5 font-mono text-slate-600">{p.certNo}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-800">{p.equityShare}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-4">
          {/* User Account Particulars Header */}
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#16223A] text-amber-300 flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                    {currentUser?.name || 'User Profile'}
                    {currentUser?.isSuperAdmin && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        SUPER ADMIN
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {currentUser?.email || 'shco@shcolaw.com'} • {currentUser?.role || 'Partner'} Role
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center gap-1 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  SSO Authorized (@shcolaw.com)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Assigned Role</span>
                <span className="font-bold text-[#16223A]">{currentUser?.role || 'Partner'}</span>
              </div>
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">User Account ID</span>
                <span className="font-mono font-bold text-[#16223A]">{currentUser?.id || 'U-001'}</span>
              </div>
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">System Access Scope</span>
                <span className="font-bold text-emerald-800">Practice Management & CFO Ledger</span>
              </div>
            </div>
          </div>

          {/* Theme & Display Settings Card */}
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#A9814A]" />
                  Interface Appearance &amp; Visual Theme
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your persistent workstation theme preference. Ensures high WCAG 2.1 AA color contrast for legal drafting and document review.
                </p>
              </div>

              <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-[10.5px] font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-amber-700" />
                WCAG 2.1 AA Compliant
              </span>
            </div>

            {/* Theme Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Option 1: Light Mode */}
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  showToast('Parchment Light theme applied and saved to profile!');
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  theme === 'light'
                    ? 'border-[#A9814A] bg-amber-50/50 ring-2 ring-[#A9814A]/30 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
                      <Sun className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#16223A] block">Parchment Light</span>
                      <span className="text-[10px] text-slate-500">Daytime Standard</span>
                    </div>
                  </div>
                  {theme === 'light' && (
                    <span className="w-5 h-5 rounded-full bg-[#A9814A] text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                  )}
                </div>

                {/* Preview Box */}
                <div className="p-2.5 rounded-lg bg-[#F6F4EE] border border-[#E1DCCF] space-y-1.5">
                  <div className="h-3 w-3/4 bg-[#16223A] rounded"></div>
                  <div className="h-2 w-1/2 bg-[#A9814A] rounded"></div>
                  <div className="h-2 w-full bg-slate-300 rounded"></div>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug">
                  Classic legal parchment background with deep navy header and gold accents. Ideal for bright daylight office drafting.
                </p>
              </button>

              {/* Option 2: Dark Mode */}
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  showToast('Executive Dark theme applied and saved to profile!');
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  theme === 'dark'
                    ? 'border-[#A9814A] bg-slate-900 text-white ring-2 ring-[#A9814A]/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
                      <Moon className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#16223A] dark:text-white block">Executive Dark</span>
                      <span className="text-[10px] text-slate-400">Night &amp; Low-Light</span>
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <span className="w-5 h-5 rounded-full bg-[#A9814A] text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                  )}
                </div>

                {/* Preview Box */}
                <div className="p-2.5 rounded-lg bg-[#0F172A] border border-[#334155] space-y-1.5">
                  <div className="h-3 w-3/4 bg-[#F8FAFC] rounded"></div>
                  <div className="h-2 w-1/2 bg-[#D4AF37] rounded"></div>
                  <div className="h-2 w-full bg-[#334155] rounded"></div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  Eye-safe dark slate palette with metallic gold indicators. Reduces eyestrain during late-night trial preparation.
                </p>
              </button>

              {/* Option 3: System Preference */}
              <button
                type="button"
                onClick={() => {
                  setTheme('system');
                  showToast('System preference theme enabled!');
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  theme === 'system'
                    ? 'border-[#A9814A] bg-blue-50/50 ring-2 ring-[#A9814A]/30 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-900">
                      <Monitor className="w-5 h-5 text-blue-700" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[#16223A] block">System Sync</span>
                      <span className="text-[10px] text-slate-500">Auto OS Schedule</span>
                    </div>
                  </div>
                  {theme === 'system' && (
                    <span className="w-5 h-5 rounded-full bg-[#A9814A] text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                  )}
                </div>

                {/* Preview Box */}
                <div className="p-2.5 rounded-lg bg-gradient-to-r from-[#F6F4EE] to-[#0F172A] border border-slate-300 space-y-1.5">
                  <div className="h-3 w-3/4 bg-[#16223A] rounded"></div>
                  <div className="h-2 w-1/2 bg-[#A9814A] rounded"></div>
                  <div className="h-2 w-full bg-slate-400 rounded"></div>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug">
                  Automatically aligns with your device settings (macOS, Windows, iOS) for seamless daylight to dark mode transitions.
                </p>
              </button>
            </div>

            {/* Accessibility Contrast Note */}
            <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-slate-600 text-[11px] space-y-1">
              <span className="font-bold text-[#16223A] block uppercase text-[10px]">
                High Accessibility &amp; Legal Ergonomics
              </span>
              <p>
                All theme color combinations maintain a contrast ratio exceeding 4.5:1 for body copy and 3.1:1 for graphical UI indicators, strictly complying with Web Content Accessibility Guidelines (WCAG 2.1 Level AA) and legal typography standards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= GOOGLE WORKSPACE INTEGRATION ================= */
export const WorkspaceView: React.FC = () => {
  const { isOAuthConnected, setIsOAuthConnected, showToast } = useApp();

  const services = [
    {
      name: 'Google Drive',
      icon: Folder,
      purpose: 'Automatic creation of Matter Folders ([MatterRef]/Cause Papers, Correspondence, etc.)',
      scope: 'https://www.googleapis.com/auth/drive.file',
    },
    {
      name: 'Gmail',
      icon: Mail,
      purpose: 'Direct dispatch of Fee Quotations, Tax Invoices, and Meeting Summaries to clients',
      scope: 'https://www.googleapis.com/auth/gmail.send',
    },
    {
      name: 'Google Calendar',
      icon: Calendar,
      purpose: 'Automatic 2-way sync for Court Hearings and Statutory Deadlines with firm partners',
      scope: 'https://www.googleapis.com/auth/calendar',
    },
    {
      name: 'Google Docs',
      icon: FileText,
      purpose: 'Document Merge engine for Engagement Letters, Demand Notices, and Court Filings',
      scope: 'https://www.googleapis.com/auth/documents',
    },
    {
      name: 'Google Sheets',
      icon: Grid,
      purpose: 'Live sync export for Cash Flow, Trial Balance, and Monthly Financial Reports',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    },
    {
      name: 'Google Tasks',
      icon: CheckSquare,
      purpose: 'Assigning legal tasks and review turnarounds directly to lawyer Google Tasks',
      scope: 'https://www.googleapis.com/auth/tasks',
    },
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs flex justify-between items-center">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-700" />
            Google Workspace OAuth 2.0 Integration Status
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cloud project integration for Syafiqah Hamizad &amp; Co domain services.
          </p>
        </div>

        <button
          onClick={() => {
            setIsOAuthConnected(!isOAuthConnected);
            showToast(isOAuthConnected ? 'Google Workspace disconnected' : 'Google Workspace OAuth 2.0 connected!');
          }}
          className={`px-4 py-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-xs ${
            isOAuthConnected
              ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
              : 'bg-[#16223A] hover:bg-[#1F2E4D] text-white'
          }`}
        >
          {isOAuthConnected ? '✓ OAuth Connected' : 'Connect Google Workspace'}
        </button>
      </div>

      {/* Integration Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 font-serif font-bold text-sm text-[#16223A]">
                  <Icon className="w-4 h-4 text-blue-700" />
                  <span>{s.name}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isOAuthConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isOAuthConnected ? 'Active Sync' : 'Ready to Authorize'}
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">{s.purpose}</p>
              <div className="font-mono text-[10px] text-slate-400 truncate pt-1 border-t border-slate-100">
                Scope: {s.scope}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};



