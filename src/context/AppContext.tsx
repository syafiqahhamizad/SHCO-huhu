import { readCloudState, subscribeToCloudState, writeCloudState, type CloudState } from '../services/firestoreSyncService';
import { applyCloudPracticeSettings, getPracticeSettings, savePracticeSettings, type PracticeSettings } from '../services/templateService';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  ACCESS_OWNER_EMAIL,
  accessRoleToAppRole,
  applyAccessChanges,
  buildAccessList,
  diffAccessLists,
  emailToAccessKey,
  publishAccessList,
  readAccessList,
  readOwnAccessEntry,
  type AccessChange,
  type AccessEntry,
  type AccessUsers,
} from '../services/accessListService';
import { normalizeClientName } from '../lib/stringUtils';
import { partnerCode } from '../lib/identity';
import { generateNextMatterSequenceNumber, syncClientMatterLinks } from '../services/matterService';
import {
  Role,
  PartnerCode,
  Lead,
  Client,
  ClientPortalUpdate,
  Case,
  NewCasePrefill,
  CaseActivityLog,
  Quotation,
  QuoteTemplate,
  ReferralPartner,
  OfficeBucket,
  ChartOfAccount,
  TravelClaim,
  Receipt,
  PaymentVoucher,
  GeneralLedgerEntry,
  TrialBalanceRow,
  CashFlowRow,
  ThreeWayRecRow,
  DocTemplate,
  Deadline,
  TimeEntry,
  Expense,
  Invoice,
  Payment,
  Retainer,
  User,
  StaffGoal,
  ActivityLog,
  RolePermissionsMatrix,
  ModulePermissions,
  LawFirmRegistryEntry,
  NotificationItem,
  BankAccount,
  TrustAuditLog,
  InventoryItem,
  BankReconciliationEntry,
  Payslip,
  ComplianceItem,
  ComplaintRecord,
  Milestone,
  Panelship,
  InvestmentChannel,
  FirmGoal,
  ClientAccountCheck,
  ManualJournal,
  SequenceCounters,
  ThemePreference,
  DeletedRecord,
  AuditLogEntry,
  AttendanceRecord,
  LeaveApplication,
  Meeting,
  Programme,
  FirmAnnouncement,
  FirmStartCentrePage,
  FirmStartCentreCard,
} from '../types';
import {
  getCurrentFirebaseClaims,
  getFirebaseAuthErrorMessage,
  getGoogleWorkspaceAccessClaims,
  signInClientWithPassword,
  signInExternalWithPassword,
  signInStaffWithGoogle,
  signOutFromFirebase,
  provisionFirebaseUser,
  ensureEmailVerified,
  describeProvisionedAccount,
  firebaseAuth,
} from '../services/firebaseAuthService';
import {
  INITIAL_LEADS,
  INITIAL_CLIENTS,
  INITIAL_CASES,
  INITIAL_QUOTATIONS,
  INITIAL_QUOTE_TEMPLATES,
  INITIAL_REFERRALS,
  INITIAL_OFFICE_BUCKETS,
  INITIAL_CHART_OF_ACCOUNTS,
  INITIAL_TRAVEL_CLAIMS,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENT_VOUCHERS,
  INITIAL_GENERAL_LEDGER,
  INITIAL_TRIAL_BALANCE,
  INITIAL_CASH_FLOW,
  INITIAL_3WAY_REC,
  INITIAL_DOC_TEMPLATES,
  INITIAL_DEADLINES,
  INITIAL_MEETINGS,
  INITIAL_PROGRAMMES,
  INITIAL_TIME_ENTRIES,
  INITIAL_EXPENSES,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_RETAINERS,
  INITIAL_USERS,
  INITIAL_LOGS,
  INITIAL_ROLES_MATRIX,
  INITIAL_LAW_FIRM_REGISTRY,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_TRUST_AUDIT_LOGS,
  INITIAL_INVENTORY_ITEMS,
  INITIAL_BANK_RECONCILIATION_ENTRIES,
  INITIAL_FIRM_ANNOUNCEMENTS,
  INITIAL_FIRM_START_CENTRE_PAGES,
} from '../data/initialData';

export interface AccessListStatus {
  state: 'idle' | 'preview' | 'not-owner' | 'updating' | 'published' | 'review' | 'failed';
  message?: string;
  /** Changes that give someone more access and were not made in this owner session. */
  pending?: AccessChange[];
  /** Roster people left out because their role is a custom role the rules don't know. */
  skipped?: { name: string; email: string; role: string }[];
  /** Entries in the published list. */
  count?: number;
  at?: string;
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isUserPreview: boolean;
  previewUserId: string | null;
  startUserPreview: (userId: string) => boolean;
  exitUserPreview: () => void;
  firmStartCentreEditMode: boolean;
  setFirmStartCentreEditMode: (enabled: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentPartnerCode: PartnerCode;
  setCurrentPartnerCode: (code: PartnerCode) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  isOAuthConnected: boolean;
  setIsOAuthConnected: (val: boolean) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  currentCaseId: string | null;
  setCurrentCaseId: (id: string | null) => void;
  caseSubTab: string;
  setCaseSubTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;

  toastMessage: string | null;
  showToast: (msg?: string) => void;

  assignmentToastData: { assignees: string[]; count: number } | null;
  showAssignmentSuccessToast: (assignees: string[]) => void;

  // Appearance & Theme Preferences
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Auth & Roles Actions
  loginWithGoogleSSO: () => Promise<{ success: boolean; error?: string }>;
  loginClientPassword: (emailInput: string, passwordInput: string) => Promise<{ success: boolean; error?: string }>;
  loginExternalUser: (emailInput: string, passwordInput: string) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => void;
  updateUserRoleAndAdmin: (
    targetUserId: string,
    newRole: Role,
    newIsAdmin: boolean,
    newIsSuperAdmin?: boolean
  ) => boolean;
  /** Owner-managed access list (practiceSystem/access) publish status, for Users & Roles. */
  accessListStatus: AccessListStatus;
  /** Owner only: publish the access list now, including changes made from other sessions. */
  publishAccessListNow: () => Promise<void>;
  /** Set when the cloud data refused this person at startup (e.g. access list not published yet). */
  cloudAccessNotice: string | null;
  /** Re-try the cloud-data startup after a cloudAccessNotice. */
  retryCloudSync: () => void;
  addUser: (newUser: User) => boolean;
  deleteUser: (userId: string) => boolean;
  updateUserStaffProfile: (userId: string, profile: User['staffProfile']) => void;
  updateUserIdentity: (userId: string, updates: { name?: string; code?: string }) => boolean;
  renameCaseRef: (caseId: string, newRef: string, reason: string) => boolean;
  addStaffGoal: (userId: string, goal: StaffGoal) => void;
  updateStaffGoal: (userId: string, goalId: string, updates: Partial<StaffGoal>) => void;
  addAttendanceRecord: (record: AttendanceRecord) => void;
  addLeaveApplication: (application: LeaveApplication) => void;
  updateLeaveApplication: (id: string, updates: Partial<LeaveApplication>) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  addProgramme: (programme: Programme) => void;
  updateProgramme: (id: string, updates: Partial<Programme>) => void;
  deleteProgramme: (id: string) => void;
  canViewModule: (viewId: string) => boolean;
  updateRolePermission: (role: Role, moduleKey: string, action: 'v' | 'a' | 'e', value: number) => void;
  customRoles: string[];
  addCustomRole: (roleName: string) => boolean;
  updateUserNavOverride: (userId: string, moduleKey: string, action: 'v' | 'a' | 'e', value: number) => void;
  /** Firm & Practice Settings: set all three bits of one role/module cell at once (no toast). */
  setRoleModulePermissions: (role: Role, moduleKey: string, perms: ModulePermissions) => void;
  /** Firm & Practice Settings: set (or with null, clear) one person's own permission for a key. */
  setUserNavOverride: (userId: string, moduleKey: string, perms: ModulePermissions | null) => void;
  /** Firm & Practice Settings: drop all of one person's own changes ("Reset to role"). */
  resetUserNavOverrides: (userId: string) => void;
  /** Firm & Practice Settings → Users & Roles: active/switched off, branch, 2-step flag. */
  updateUserAccount: (userId: string, patch: { status?: User['status']; branch?: string; twoStepLogin?: boolean }) => boolean;

  // Data State
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  quotations: Quotation[];
  quoteTemplates: QuoteTemplate[];
  referralPartners: ReferralPartner[];
  officeBuckets: OfficeBucket[];
  chartOfAccounts: ChartOfAccount[];
  travelClaims: TravelClaim[];
  receipts: Receipt[];
  paymentVouchers: PaymentVoucher[];
  generalLedger: GeneralLedgerEntry[];
  trialBalance: TrialBalanceRow[];
  cashFlowOffice: CashFlowRow[];
  threeWayRec: ThreeWayRecRow[];
  docTemplates: DocTemplate[];
  deadlines: Deadline[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  invoices: Invoice[];
  payments: Payment[];
  retainers: Retainer[];
  users: User[];
  attendanceRecords: AttendanceRecord[];
  leaveApplications: LeaveApplication[];
  meetings: Meeting[];
  programmes: Programme[];
  logs: ActivityLog[];
  rolesMatrix: RolePermissionsMatrix;
  lawFirmRegistry: LawFirmRegistryEntry[];
  bankAccounts: BankAccount[];
  trustAuditLogs: TrustAuditLog[];
  inventoryItems: InventoryItem[];
  bankReconciliationEntries: BankReconciliationEntry[];
  clientAccountChecks: ClientAccountCheck[];
  toggleClientAccountCheck: (itemKey: string) => void;
  /** Accounts & Finance → Payroll. */
  payslips: Payslip[];
  addPayslip: (p: Payslip) => void;
  updatePayslip: (id: string, updates: Partial<Payslip>) => void;
  /** Moves the given payslips one step along Draft → Checked → Approved → Paid. */
  advancePayslipStatus: (ids: string[]) => void;
  /** Accounts & Finance → Books & Reports → Manual journal (goes to Approvals). */
  manualJournals: ManualJournal[];
  addManualJournal: (j: ManualJournal) => void;
  updateManualJournal: (id: string, updates: Partial<ManualJournal>) => void;
  deletedRecords: DeletedRecord[];
  restoreDeletedRecord: (id: string) => void;
  purgeDeletedRecordPermanently: (id: string) => void;
  emptyTrashRecycleBin: () => void;
  auditLogs: AuditLogEntry[];
  logAuditEvent: (
    action: AuditLogEntry['action'],
    collection: AuditLogEntry['collection'],
    recordId: string,
    recordTitle: string,
    details: string,
    changes?: Record<string, any>
  ) => void;

  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  addNotification: (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  announcements: FirmAnnouncement[];
  addAnnouncement: (announcement: Omit<FirmAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => boolean;
  deleteAnnouncement: (announcementId: string) => boolean;

  firmStartCentrePages: FirmStartCentrePage[];
  canEditFirmStartCentre: boolean;
  addStartCentrePage: (label: string) => boolean;
  updateStartCentrePageLabel: (pageId: string, label: string) => boolean;
  deleteStartCentrePage: (pageId: string) => boolean;
  addStartCentreCard: (pageId: string, card: Omit<FirmStartCentreCard, 'id'>) => boolean;
  updateStartCentreCard: (pageId: string, cardId: string, card: Omit<FirmStartCentreCard, 'id'>) => boolean;
  deleteStartCentreCard: (pageId: string, cardId: string) => boolean;

  isNewCaseModalOpen: boolean;
  setIsNewCaseModalOpen: (open: boolean) => void;
  newCasePrefill: NewCasePrefill | null;
  setNewCasePrefill: (prefill: NewCasePrefill | null) => void;
  openNewCaseWithPrefill: (prefill: NewCasePrefill) => void;

  isRegisterClientModalOpen: boolean;
  setIsRegisterClientModalOpen: (open: boolean) => void;

  // Actions
  resetClientPassword: (clientIdentifier: string, newPass: string) => { success: boolean; message: string };
  addBankAccount: (acc: Omit<BankAccount, 'id'>) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  archiveBankAccount: (id: string) => void;
  addTrustAuditLog: (entry: Omit<TrustAuditLog, 'id' | 'timestamp'>) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  toggleReconcileEntry: (id: string) => void;
  toggleComplianceItem: (id: string) => void;
  updateComplianceItem: (id: string, patch: Partial<ComplianceItem>) => void;
  addComplianceItem: (group: ComplianceItem['group'], item: Partial<Omit<ComplianceItem, 'id' | 'group'>>) => void;
  addComplaint: (complaint: Omit<ComplaintRecord, 'id'>) => void;
  updateComplaint: (id: string, patch: Partial<ComplaintRecord>) => void;
  updateDirectionStatement: (field: 'vision' | 'mission' | 'target2028', text: string) => void;
  updatePartnersNotes: (text: string) => void;
  addMilestone: (year: number, text?: string) => void;
  updateMilestone: (id: string, patch: Partial<Omit<Milestone, 'id'>>) => void;
  cycleMilestoneStatus: (id: string) => void;
  addFirmGoal: (goal: Omit<FirmGoal, 'id'>) => void;
  updateFirmGoal: (id: string, patch: Partial<Omit<FirmGoal, 'id'>>) => void;
  removeFirmGoal: (id: string) => void;
  addPanelship: (panel: Omit<Panelship, 'id'>) => void;
  updatePanelship: (id: string, patch: Partial<Omit<Panelship, 'id'>>) => void;
  removePanelship: (id: string) => void;
  addInvestmentChannel: (channel: Omit<InvestmentChannel, 'id'>) => void;
  updateInvestmentChannel: (id: string, patch: Partial<Omit<InvestmentChannel, 'id'>>) => void;
  removeInvestmentChannel: (id: string) => void;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addClientPortalUpdate: (clientId: string, update: Omit<ClientPortalUpdate, 'id' | 'date'>) => void;
  deleteClient: (id: string) => void;
  sendClientPortalInvite: (
    clientId: string
  ) => Promise<{ success: boolean; inviteDate?: string; email?: string; tempPass?: string; error?: string; message?: string }>;
  addCase: (caseObj: Case) => void;
  updateCase: (id: string, updates: Partial<Case>) => void;
  deleteCase: (id: string) => void;
  addCaseActivityLog: (caseId: string, log: Omit<CaseActivityLog, 'id' | 'timestamp'>) => void;
  addLawFirmRegistryEntry: (entry: LawFirmRegistryEntry) => void;
  updateLawFirmRegistryEntry: (id: string, updates: Partial<LawFirmRegistryEntry>) => void;
  deleteLawFirmRegistryEntry: (id: string) => void;
  addQuotation: (q: Quotation) => void;
  updateQuotation: (id: string, updates: Partial<Quotation>) => void;
  addReferralPartner: (rp: ReferralPartner) => void;
  addTravelClaim: (tc: TravelClaim) => void;
  updateTravelClaim: (id: string, updates: Partial<TravelClaim>) => void;
  addReceipt: (r: Receipt) => void;
  /** Additive (Accounts & Finance): attach proof of payment etc. to an existing receipt. */
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  addPaymentVoucher: (pv: PaymentVoucher) => void;
  updatePaymentVoucher: (id: string, updates: Partial<PaymentVoucher>) => void;
  approvePaymentVoucher: (id: string, approvedBy: string) => void;
  addRetainer: (r: Retainer) => void;
  addInvoice: (inv: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  addPayment: (p: Payment) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  addTimeEntry: (te: TimeEntry) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  addExpense: (ex: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addGeneralLedgerEntry: (gl: Omit<GeneralLedgerEntry, 'glNo'> | GeneralLedgerEntry) => void;
  addDeadline: (d: Deadline) => void;
  addActivityLog: (action: string, details: string) => void;
  sequenceCounters: SequenceCounters;
  /** `date` (any date string) picks the year for year-numbered documents (invoice, quotation,
   * journal): the running number restarts at 0001 each year per prefix. Defaults to today. */
  getNextSequenceId: (type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead' | 'expense' | 'journal', date?: string) => string;
  incrementSequenceCounter: (type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead' | 'expense') => void;
  resetSequenceCounters: () => void;
  factoryResetSystem: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'SHCO_PRACTICE_SYSTEM_DATA_V1';
const SESSION_STORAGE_KEY = 'SHCO_PRACTICE_SYSTEM_SESSION_V1';
// Opt-in, local-only QA bypass: ?preview=1 skips real Google sign-in and loads
// sample data instead of live Firestore, so the app can be reviewed without
// Firebase credentials. Off by default; never touches real auth or data.
// Hostname-gated so this can never bypass sign-in on the real deployed domains —
// only localhost / 127.0.0.1 (the local dev server) can use it.
const IS_LOCAL_DEV_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname.toLowerCase());
const SAFE_PREVIEW_MODE = IS_LOCAL_DEV_HOST && new URLSearchParams(window.location.search).get('preview') === '1';
const LOAD_DEMO_OPERATIONAL_DATA = SAFE_PREVIEW_MODE;

function operationalFallback<T>(seedData: T[]): T[] {
  return LOAD_DEMO_OPERATIONAL_DATA ? seedData : [];
}

function sanitizeClientPasswordsForStorage<T extends { role?: string; clientPassword?: string }>(items: T[]): T[] {
  return items.map((item) => {
    if (item.role === 'Client') {
      const { clientPassword: _clientPassword, ...rest } = item as T & { clientPassword?: string };
      return rest as T;
    }
    return item;
  });
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as T;
    if (Array.isArray(parsed)) {
      return sanitizeClientPasswordsForStorage(parsed as Array<{ role?: string; clientPassword?: string }>) as unknown as T;
    }
    return parsed;
  } catch (error) {
    console.warn(`Ignoring invalid stored data for ${key}.`, error);
    return fallback;
  }
}

function normalizeRoleClaim(roleValue?: string): Role {
  const value = roleValue?.trim();
  if (!value) return 'Partner';

  const normalized = value.toLowerCase();
  if (normalized === 'partner') return 'Partner';
  if (normalized === 'lawyer') return 'Lawyer';
  if (normalized === 'assistant') return 'Assistant';
  if (normalized === 'accountant') return 'Accountant';
  if (normalized === 'reviewer') return 'Reviewer';
  if (normalized === 'client') return 'Client';

  return value as Role;
}

function normalizeClaimEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (SAFE_PREVIEW_MODE) return true;

    const loginPreviewRequested = new URLSearchParams(window.location.search).get('login') === '1';
    if (loginPreviewRequested) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.isAuthenticated === true) {
          return true;
        }
      } catch (e) {}
    }
    return false;
  });

  // Session Persistence Layer (Restores staff and client sessions across browser refreshes)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.currentUser?.id && parsed?.currentUser?.email) {
          return parsed.currentUser;
        }
      } catch (e) {
        console.error('Failed to parse saved session:', e);
      }
    }
    return INITIAL_USERS[0]; // Default seeded staff account (Syafiqah Hamizad)
  });
  const previewOrigin = React.useRef<{ user: User; role: Role; partnerCode: PartnerCode; isAdmin: boolean } | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [firmStartCentreEditMode, setFirmStartCentreEditMode] = useState(false);

  const [currentRole, setCurrentRole] = useState<Role>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.currentRole) return parsed.currentRole;
      } catch (e) {}
    }
    return 'Partner';
  });

  const [currentPartnerCode, setCurrentPartnerCode] = useState<PartnerCode>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.currentPartnerCode) return parsed.currentPartnerCode;
      } catch (e) {}
    }
    return 'AH';
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (typeof parsed?.isAdmin === 'boolean') return parsed.isAdmin;
      } catch (e) {}
    }
    return INITIAL_USERS[0]?.isAdmin ?? false;
  });

  const [isOAuthConnected, setIsOAuthConnected] = useState<boolean>(true);

  // Appearance Theme Preference State
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved as ThemePreference;
    }
    return 'light';
  });

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY + '_theme', newTheme);
  };

  // Synchronize document theme class for accessibility and dark mode support.
  // Dark/system mode are disabled for now (day mode only, matching the redesign
  // mockup, which has no dark variant) — the toggle is removed from the UI and
  // this ignores any 'dark'/'system' value left over in localStorage from before.
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      const isDark = false;
      if (isDark) {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  const [currentView, setCurrentView] = useState<string>(() => {
    const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.currentView) return parsed.currentView;
      } catch (e) {}
    }
    return 'dashboard';
  });

  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [caseSubTab, setCaseSubTab] = useState<string>('overview');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [newCasePrefill, setNewCasePrefill] = useState<NewCasePrefill | null>(null);

  const openNewCaseWithPrefill = (prefill: NewCasePrefill) => {
    setNewCasePrefill(prefill);
    setIsNewCaseModalOpen(true);
  };

  const [isRegisterClientModalOpen, setIsRegisterClientModalOpen] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg = 'Saved successfully') => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const [assignmentToastData, setAssignmentToastData] = useState<{ assignees: string[]; count: number } | null>(null);

  const showAssignmentSuccessToast = (assignees: string[]) => {
    setAssignmentToastData({
      assignees: assignees.filter(Boolean), // Filter out empty strings
      count: assignees.filter(Boolean).length,
    });
    setTimeout(() => setAssignmentToastData(null), 3000); // Slightly longer for more info
  };

  // Automatically save current user session to localStorage whenever key parameters change
  useEffect(() => {
    const sessionData = {
      isAuthenticated,
      currentUser: previewOrigin.current?.user || currentUser,
      currentRole,
      currentPartnerCode,
      isAdmin,
      currentView,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  }, [isAuthenticated, currentUser, currentRole, currentPartnerCode, isAdmin, currentView]);

  const [users, setUsers] = useState<User[]>(() => {
    const storedUsers = readStored<User[]>(STORAGE_KEY + '_users', INITIAL_USERS);
    const usedStaffIds = new Set<string>();
    let nextStaffNumber = 1;
    return storedUsers.map((user) => {
      if (user.role === 'Client') return user;
      let staffId = user.staffProfile?.staffId;
      if (!staffId || usedStaffIds.has(staffId)) {
        do {
          staffId = `SHCO-ST-${String(nextStaffNumber).padStart(4, '0')}`;
          nextStaffNumber += 1;
        } while (usedStaffIds.has(staffId));
      }
      usedStaffIds.add(staffId);
      return {
        ...user,
        staffProfile: user.staffProfile || {
          staffId,
          designation: user.role,
          department: 'Legal Practice',
          phone: '',
          emergencyContact: '',
          joinDate: '',
          employmentType: 'Permanent',
          officeLocation: 'Kuala Lumpur Office',
          bio: '',
        },
      };
    });
  });

  const startUserPreview = (userId: string) => {
    const target = users.find((user) => user.id === userId);
    if (!target || (!currentUser.isAdmin && !currentUser.isSuperAdmin) || previewOrigin.current) return false;
    previewOrigin.current = { user: currentUser, role: currentRole, partnerCode: currentPartnerCode, isAdmin };
    setCurrentUser(target);
    setCurrentRole(target.role);
    setCurrentPartnerCode((target.staffProfile?.staffId as PartnerCode) || currentPartnerCode);
    setIsAdmin(Boolean(target.isAdmin || target.isSuperAdmin));
    setPreviewUserId(target.id);
    return true;
  };

  const exitUserPreview = () => {
    const origin = previewOrigin.current;
    if (!origin) return;
    setCurrentUser(origin.user);
    setCurrentRole(origin.role);
    setCurrentPartnerCode(origin.partnerCode);
    setIsAdmin(origin.isAdmin);
    previewOrigin.current = null;
    setPreviewUserId(null);
  };

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    readStored(STORAGE_KEY + '_attendance', [])
  );
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>(() =>
    readStored(STORAGE_KEY + '_leaveApplications', [])
  );
  const [meetings, setMeetings] = useState<Meeting[]>(() =>
    readStored(STORAGE_KEY + '_meetings', operationalFallback(INITIAL_MEETINGS))
  );
  const [programmes, setProgrammes] = useState<Programme[]>(() =>
    readStored(STORAGE_KEY + '_programmes', operationalFallback(INITIAL_PROGRAMMES))
  );

  // The roster on this device may be stale or a first-visit seed; once the person is signed
  // in and on the published access list they may read the shared roster, so look there too.
  const findRosterUser = async (email: string): Promise<User | undefined> => {
    const local = users.find((u) => u.email.toLowerCase() === email);
    if (local) return local;
    try {
      const cloud = await readCloudState();
      const cloudUsers = Array.isArray(cloud?.users) ? (cloud!.users as User[]) : [];
      return cloudUsers.find((u) => (u.email || '').toLowerCase() === email);
    } catch {
      return undefined;
    }
  };

  const notOnAccessListMessage = (email: string) =>
    `${email} is not on the firm's published access list yet (or has been switched off). Ask the Managing Partner to add you in Firm & Practice Settings → Users & Roles.`;

  const userFromAccessEntry = (entry: AccessEntry, base: User | undefined, fallback: { id: string; name: string }): User => {
    const isOwner = entry.email === ACCESS_OWNER_EMAIL;
    return {
      ...(base || { id: fallback.id, name: fallback.name, email: entry.email, status: 'Active' as const }),
      id: base?.id || fallback.id,
      name: base?.name || fallback.name,
      email: entry.email,
      role: isOwner ? 'Partner' : accessRoleToAppRole(entry.role),
      isAdmin: isOwner || entry.admin,
      isSuperAdmin: isOwner || (entry.admin && Boolean(base?.isSuperAdmin)),
      status: 'Active',
    } as User;
  };

  // SSO Login for Firm Staff - STRICTLY @shcolaw.com
  const loginWithGoogleSSO = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const firebaseUser = await signInStaffWithGoogle();
      // signInStaffWithGoogle already enforces the @shcolaw.com Google Workspace domain
      // (via the Google `hd` param and a client-side endsWith check), so by this point the
      // signed-in account is a verified firm identity even if Firebase custom claims for
      // it were never set — which is expected the very FIRST time a real staff member signs
      // in, since their Firebase Auth record and any custom claims can only be created
      // after that first sign-in.
      const access = await getGoogleWorkspaceAccessClaims(firebaseUser);
      const email = access.email || firebaseUser.email?.toLowerCase() || '';
      // The owner-published access list (practiceSystem/access) is the source of truth for
      // role/admin. Legacy custom claims and the local roster are only fallbacks.
      const listed = await readOwnAccessEntry(email).catch(() => ({ entry: null, readable: false }));
      const listedEntry = listed.entry && listed.entry.active ? listed.entry : null;
      const existingUser = listed.readable ? await findRosterUser(email) : users.find((u) => u.email.toLowerCase() === email);

      if (listedEntry?.role === 'client' || (!listedEntry && existingUser?.role === 'Client')) {
        throw new Error('This email is registered as a Client account. Staff SSO is not available for it.');
      }
      if (!listedEntry && existingUser && existingUser.status === 'Inactive') {
        throw new Error('This staff account has been deactivated. Ask a Partner to reactivate it.');
      }

      let signedInUser: User;
      let provisionedAtLowestPrivilege = false;

      if (listedEntry) {
        // Normal path: the Managing Partner has published this person's role/admin.
        signedInUser = userFromAccessEntry(listedEntry, existingUser, {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
        });
      } else if (access.hasProvisionedRole) {
        // Transitional path: Firebase custom claims already carry a real, Super-Admin-assigned role.
        const claimRole = normalizeRoleClaim(String(access.role || ''));
        signedInUser = {
          ...(existingUser || {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
            email,
            status: 'Active',
          }),
          id: existingUser?.id || firebaseUser.uid,
          name: existingUser?.name || firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
          email,
          role: claimRole,
          isAdmin: access.isAdmin,
          isSuperAdmin: access.isSuperAdmin,
          status: 'Active',
        };
      } else if (existingUser) {
        // Verified @shcolaw.com sign-in that isn't on the published access list yet. They
        // already have a role in the firm's own roster, so honour that in the app; the cloud
        // data will stay closed to them (with a clear message) until the Managing Partner
        // publishes the access list from Users & Roles.
        signedInUser = { ...existingUser, email, status: 'Active' };
      } else {
        // Genuinely new @shcolaw.com Google Workspace account with no roster entry at all.
        // Provision at the lowest-privilege real staff role rather than rejecting a
        // legitimate domain-verified sign-in outright, and flag it for a Partner to assign
        // proper access.
        provisionedAtLowestPrivilege = true;
        signedInUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
          email,
          role: 'Reviewer',
          isAdmin: false,
          isSuperAdmin: false,
          status: 'Active',
        };
      }

      // Firm & Practice Settings → Users & Roles "Last login" column.
      signedInUser = { ...signedInUser, lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' ') };
      if (!existingUser) setUsers((prev) => [...prev, signedInUser]);
      else setUsers((prev) => prev.map((u) => (u.id === existingUser.id ? { ...u, lastLoginAt: signedInUser.lastLoginAt } : u)));
      setCurrentUser(signedInUser);
      setCurrentRole(signedInUser.role);
      setIsAdmin(Boolean(signedInUser.isAdmin));
      setIsAuthenticated(true);
      setCurrentView('firmStartCentre');
      if (provisionedAtLowestPrivilege) {
        showToast(`Welcome, ${signedInUser.name}. Your @shcolaw.com account was verified but has no role assigned yet, so you've been given limited (Reviewer) access. Ask the Managing Partner to set your correct role in Firm & Practice Settings → Users & Roles.`);
      } else {
        showToast(`Welcome back, ${signedInUser.name}.`);
      }
      return { success: true };
    } catch (error) {
      const errorMsg = getFirebaseAuthErrorMessage(error);
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  // Password sign-ins (clients and external Reviewer/Assistant/Accountant) must have a
  // verified email — the access-list rules refuse unverified password accounts. Accounts
  // from the old Cloud Function that still carry a role claim are let through on that
  // claim (transitional), with a nudge to verify.
  const readPasswordAccountAccess = async (firebaseUser: import('firebase/auth').User, email: string) => {
    if (await ensureEmailVerified(firebaseUser)) return readOwnAccessEntry(email);
    const claims = await getCurrentFirebaseClaims();
    if (claims.role) {
      showToast(`Please click the verification link we've emailed to ${email} — it will soon be required to sign in.`);
      return { entry: null, readable: false };
    }
    await signOutFromFirebase().catch(() => undefined);
    throw new Error(`Please verify your email first. We've sent a verification link to ${email} — click it, then sign in again. (Check your spam folder if it isn't in your inbox.)`);
  };

  // Client Password Login - Login to Client Portal
  const loginClientPassword = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const term = emailInput.trim().toLowerCase();
    // A Client ID is accepted as a convenience when this device already knows the client.
    const email = term.includes('@')
      ? term
      : (clients.find((c) => c.id.toLowerCase() === term)?.email || '').trim().toLowerCase();

    if (!email) {
      const errorMsg = 'Use a registered client email address or Client ID for portal access.';
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const firebaseUser = await signInClientWithPassword(email, passwordInput);
      const listed = await readPasswordAccountAccess(firebaseUser, email);
      let isClientAccess = false;
      if (listed.entry) {
        isClientAccess = listed.entry.active && listed.entry.role === 'client';
      } else {
        // Transitional fallback: logins created by the old Cloud Function carry a role claim.
        const access = await getGoogleWorkspaceAccessClaims(firebaseUser);
        isClientAccess = access.role === 'Client';
        if (!access.hasProvisionedRole) {
          await signOutFromFirebase().catch(() => undefined);
          throw new Error(notOnAccessListMessage(email));
        }
      }

      if (!isClientAccess) {
        await signOutFromFirebase().catch(() => undefined);
        throw new Error('This account is not configured for client portal access.');
      }

      const matchedUser = users.find((u) => u.role === 'Client' && u.email.toLowerCase() === email)
        || (listed.readable ? await findRosterUser(email) : undefined);
      const matchedClient = clients.find((c) => (c.email || '').toLowerCase() === email);
      const clientName = matchedUser?.name || matchedClient?.name || 'Valued Client';
      const clientEmail = matchedUser?.email || matchedClient?.email || email;
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

      if (matchedClient) {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id === matchedClient.id || (c.email || '').toLowerCase() === email) {
              return {
                ...c,
                lastLoginAt: nowStr,
                portalAccessEnabled: true,
              };
            }
            return c;
          })
        );
      }

      const clientSessionUser: User = matchedUser && matchedUser.role === 'Client' ? matchedUser : {
        id: matchedClient?.id || `U-client-${Date.now()}`,
        name: clientName,
        email: clientEmail,
        role: 'Client',
        isAdmin: false,
        isSuperAdmin: false,
        status: 'Active',
      };

      setCurrentUser(clientSessionUser);
      setCurrentRole('Client');
      setIsAdmin(false);
      setIsAuthenticated(true);
      setCurrentView('clientPortal');
      showToast(`Welcome ${clientName}! Logged into Client Access Portal.`);
      return { success: true };
    } catch (error) {
      const errorMsg = getFirebaseAuthErrorMessage(error);
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const EXTERNAL_ROLES: Role[] = ['Reviewer', 'Assistant', 'Accountant'];

  const loginExternalUser = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim().toLowerCase();

    try {
      const firebaseUser = await signInExternalWithPassword(email, passwordInput);
      const listed = await readPasswordAccountAccess(firebaseUser, email);
      const rosterUser = listed.readable ? await findRosterUser(email) : users.find((u) => u.email.toLowerCase() === email);
      let effectiveUser: User;

      if (listed.entry) {
        const role = accessRoleToAppRole(listed.entry.role);
        if (!listed.entry.active || !EXTERNAL_ROLES.includes(role)) {
          await signOutFromFirebase().catch(() => undefined);
          throw new Error('This external account is not approved. Ask a firm administrator to give it an active Reviewer, Assistant or Accountant role.');
        }
        effectiveUser = userFromAccessEntry(listed.entry, rosterUser, { id: firebaseUser.uid, name: email.split('@')[0] });
      } else {
        // Transitional fallback: logins created by the old Cloud Function carry claims.
        const claims = await getCurrentFirebaseClaims();
        const claimRole = normalizeRoleClaim(String(claims.role || ''));
        const approvedUser = rosterUser && EXTERNAL_ROLES.includes(rosterUser.role) && rosterUser.status === 'Active' ? rosterUser : undefined;
        if (!claims.role || !approvedUser || claimRole !== approvedUser.role) {
          await signOutFromFirebase().catch(() => undefined);
          throw new Error(notOnAccessListMessage(email));
        }
        const adminEmails = normalizeClaimEmailList(claims.adminEmails);
        const superAdminEmails = normalizeClaimEmailList(claims.superAdminEmails);
        effectiveUser = {
          ...approvedUser,
          role: claimRole,
          isAdmin: Boolean(claims.admin) && (adminEmails.includes(email) || superAdminEmails.includes(email)),
          isSuperAdmin: Boolean(claims.superAdmin) && superAdminEmails.includes(email),
        };
      }

      effectiveUser = { ...effectiveUser, lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' ') };
      setUsers((prev) => prev.map((u) => (u.id === effectiveUser.id ? { ...u, lastLoginAt: effectiveUser.lastLoginAt } : u)));
      setCurrentUser(effectiveUser);
      setCurrentRole(effectiveUser.role);
      setIsAdmin(Boolean(effectiveUser.isAdmin));
      setIsAuthenticated(true);
      setCurrentView('firmStartCentre');
      showToast(`Welcome, ${effectiveUser.name}.`);
      return { success: true };
    } catch (error) {
      const errorMsg = getFirebaseAuthErrorMessage(error);
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logoutUser = async () => {
    await signOutFromFirebase().catch(() => undefined);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_session');
    setCloudAccessNotice(null);
    setIsAuthenticated(false);
    setCurrentUser(INITIAL_USERS[0]);
    setCurrentRole('Partner');
    setIsAdmin(true);
    setCurrentView('dashboard');
    showToast('Signed out of session.');
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + '_session');
      setIsAuthenticated(false);
    }
  }, []);

  // Super Admin privilege control - ONLY Syafiqah Hamizad can assign or modify Admin/Super Admin rights
  const updateUserRoleAndAdmin = (
    targetUserId: string,
    newRole: Role,
    newIsAdmin: boolean,
    newIsSuperAdmin?: boolean
  ): boolean => {
    const isSuperAdminUser =
      currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);

    if (!isSuperAdminUser) {
      showToast('Access Denied: Only Super Admin (Syafiqah Hamizad — syafiqahhamizad@shcolaw.com) can assign Admin or Super Admin access.');
      return false;
    }

    const targetUser = users.find((u) => u.id === targetUserId);
    // Super Admin (= Managing Partner) is reserved for the owner identity.
    const resolvedIsSuperAdmin =
      (targetUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com' &&
      (newIsSuperAdmin !== undefined ? newIsSuperAdmin : targetUser?.isSuperAdmin);

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) {
          return {
            ...u,
            role: newRole,
            isAdmin: newIsAdmin,
            isSuperAdmin: resolvedIsSuperAdmin,
          };
        }
        return u;
      })
    );

    // Publish the change to the access list right away (owner session only).
    if (targetUser?.email) approveAccessChange(targetUser.email);

    showToast('User role & access updated successfully by Super Admin.');
    return true;
  };

  const addUser = (newUser: User): boolean => {
    const isSuperAdminUser =
      currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);

    if (newUser.isAdmin && !isSuperAdminUser) {
      showToast('Access Denied: Only Super Admin (Syafiqah Hamizad) can create or assign Admin accounts.');
      return false;
    }

    if (users.some((user) => user.email.toLowerCase() === newUser.email.toLowerCase())) {
      showToast(`${newUser.email} is already in the roster.`);
      return false;
    }
    if (newUser.code && users.some((user) => (partnerCode(user) || '') === newUser.code!.toUpperCase())) {
      showToast(`Code ${newUser.code.toUpperCase()} is already used by someone else.`);
      return false;
    }

    setUsers((prev) => {
      const staffUsers = prev.filter((user) => user.role !== 'Client');
      const usedStaffIds = new Set(staffUsers.map((user) => user.staffProfile?.staffId).filter(Boolean));
      let nextNumber = staffUsers.length + 1;
      let staffId = `SHCO-ST-${String(nextNumber).padStart(4, '0')}`;
      while (usedStaffIds.has(staffId)) {
        nextNumber += 1;
        staffId = `SHCO-ST-${String(nextNumber).padStart(4, '0')}`;
      }
      const staffProfile = newUser.role === 'Client'
        ? newUser.staffProfile
        : {
            staffId,
            fullName: newUser.staffProfile?.fullName,
            designation: newUser.staffProfile?.designation || newUser.role,
            department: newUser.staffProfile?.department || 'Legal Practice',
            phone: newUser.staffProfile?.phone || '',
            emergencyContact: newUser.staffProfile?.emergencyContact || '',
            joinDate: newUser.staffProfile?.joinDate || new Date().toISOString().slice(0, 10),
            employmentType: newUser.staffProfile?.employmentType || 'Permanent',
            officeLocation: newUser.staffProfile?.officeLocation || 'Kuala Lumpur Office',
            bio: newUser.staffProfile?.bio || '',
            birthday: newUser.staffProfile?.birthday,
            callToBarDate: newUser.staffProfile?.callToBarDate,
            celebrationOptOut: newUser.staffProfile?.celebrationOptOut,
          };
      return [...prev, { ...newUser, staffProfile }];
    });
    approveAccessChange(newUser.email);
    showToast(`User ${newUser.name} added to practice system with a unique staff ID.`);
    return true;
  };

  const deleteUser = (userId: string): boolean => {
    const isSuperAdminUser =
      currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);
    if (!isSuperAdminUser) {
      showToast('Access Denied: Only the Super Admin can remove user accounts.');
      return false;
    }
    if (userId === currentUser.id) {
      showToast('The active Super Admin account cannot be removed.');
      return false;
    }
    const target = users.find((user) => user.id === userId);
    if (!target) return false;
    setUsers((prev) => prev.filter((user) => user.id !== userId));
    if (target.email) approveAccessChange(target.email);
    logAuditEvent('DELETE', 'USERS', target.id, target.name, 'User account removed by Super Admin.');
    addActivityLog('User Removed', `${target.name} (${target.email})`);
    showToast(`User ${target.name} removed.`);
    return true;
  };

  // HR-owned identity fields — display name and staff code. Admins only; codes stay unique.
  const updateUserIdentity = (userId: string, updates: { name?: string; code?: string }): boolean => {
    if (!(isAdmin || currentUser.isSuperAdmin)) {
      showToast('Only an admin can change a staff member\'s name or code.');
      return false;
    }
    const code = updates.code?.trim().toUpperCase();
    if (code !== undefined) {
      if (!/^[A-Z]{2,4}$/.test(code)) {
        showToast('Code must be 2–4 letters, e.g. SH or NFA.');
        return false;
      }
      if (users.some((u) => u.id !== userId && (partnerCode(u) || '') === code)) {
        showToast(`Code ${code} is already used by someone else.`);
        return false;
      }
    }
    const patch: Partial<User> = {
      ...(updates.name?.trim() ? { name: updates.name.trim() } : {}),
      ...(code ? { code } : {}),
    };
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, ...patch }));
    logAuditEvent('UPDATE', 'USERS', userId, patch.name || userId, `Staff identity updated${code ? ` (code ${code})` : ''}.`);
    return true;
  };

  const updateUserStaffProfile = (userId: string, profile: User['staffProfile']) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, staffProfile: profile } : user)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, staffProfile: profile }));
    logAuditEvent('UPDATE', 'USERS', userId, profile?.staffId || userId, 'Staff profile updated.');
    showToast('Staff profile saved.');
  };

  // Career/personal development goal on a staff member's profile (My Dashboard -> Team ->
  // expanded row -> "+ Add goal"). Follows the same setUsers/setCurrentUser mirror pattern as
  // updateUserStaffProfile above, just scoped to the nested staffProfile.goals array.
  const addStaffGoal = (userId: string, goal: StaffGoal) => {
    const apply = (profile: User['staffProfile']): User['staffProfile'] => ({
      ...(profile || ({} as NonNullable<User['staffProfile']>)),
      goals: [...(profile?.goals || []), goal],
    });
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, staffProfile: apply(user.staffProfile) } : user)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, staffProfile: apply(prev.staffProfile) }));
    logAuditEvent('UPDATE', 'USERS', userId, goal.id, `Goal added: ${goal.text}`);
    showToast('Goal added.');
  };

  const updateStaffGoal = (userId: string, goalId: string, updates: Partial<StaffGoal>) => {
    const apply = (profile: User['staffProfile']): User['staffProfile'] => ({
      ...(profile || ({} as NonNullable<User['staffProfile']>)),
      goals: (profile?.goals || []).map((g) => (g.id === goalId ? { ...g, ...updates } : g)),
    });
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, staffProfile: apply(user.staffProfile) } : user)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, staffProfile: apply(prev.staffProfile) }));
    logAuditEvent('UPDATE', 'USERS', userId, goalId, 'Goal updated.');
  };

  const addAttendanceRecord = (record: AttendanceRecord) => {
    setAttendanceRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
    addActivityLog('Attendance Recorded', `${record.date} - ${record.status}`);
    showToast('Attendance recorded.');
  };

  const addLeaveApplication = (application: LeaveApplication) => {
    setLeaveApplications((prev) => [application, ...prev]);
    addActivityLog('Leave Application Submitted', `${application.leaveType} - ${application.startDate}`);
    showToast('Leave application submitted.');
  };

  const updateLeaveApplication = (id: string, updates: Partial<LeaveApplication>) => {
    setLeaveApplications((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    showToast('Leave application updated.');
  };

  const addMeeting = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev.filter((item) => item.id !== meeting.id)]);
    addActivityLog('Meeting Booked', `${meeting.title} · ${meeting.date} ${meeting.time}`);
    showToast('Meeting booked.');
  };

  const updateMeeting = (id: string, updates: Partial<Meeting>) => {
    setMeetings((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    showToast('Meeting updated.');
  };

  const deleteMeeting = (id: string) => {
    setMeetings((prev) => prev.filter((item) => item.id !== id));
    showToast('Meeting removed.');
  };

  const addProgramme = (programme: Programme) => {
    setProgrammes((prev) => [programme, ...prev.filter((item) => item.id !== programme.id)]);
    addActivityLog('Programme Added', `${programme.title} · ${programme.date}`);
    showToast('Programme added.');
  };

  const updateProgramme = (id: string, updates: Partial<Programme>) => {
    setProgrammes((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    showToast('Programme updated.');
  };

  const deleteProgramme = (id: string) => {
    setProgrammes((prev) => prev.filter((item) => item.id !== id));
    showToast('Programme removed.');
  };

  // Load state from localStorage if available
  const [leads, setLeads] = useState<Lead[]>(() => {
    return readStored(STORAGE_KEY + '_leads', operationalFallback(INITIAL_LEADS));
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_clients');
    const baseClients: Client[] = saved ? (() => {
      try {
        return JSON.parse(saved);
      } catch {
        // A corrupt local cache must never bring sample clients into the live app; the
        // Firestore shared state replaces this on load.
        return operationalFallback(INITIAL_CLIENTS);
      }
    })() : operationalFallback(INITIAL_CLIENTS);

    return baseClients.map((c) => ({
      ...c,
      name: normalizeClientName(c.name),
      contactPerson: c.contactPerson ? normalizeClientName(c.contactPerson) : c.contactPerson,
    }));
  });

  const [cases, setCases] = useState<Case[]>(() => {
    return readStored(STORAGE_KEY + '_cases', operationalFallback(INITIAL_CASES));
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    return readStored(STORAGE_KEY + '_quotations', operationalFallback(INITIAL_QUOTATIONS));
  });

  const [quoteTemplates] = useState<QuoteTemplate[]>(INITIAL_QUOTE_TEMPLATES);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>(() => {
    return readStored(STORAGE_KEY + '_referrals', operationalFallback(INITIAL_REFERRALS));
  });
  const [officeBuckets] = useState<OfficeBucket[]>(INITIAL_OFFICE_BUCKETS);
  const [chartOfAccounts] = useState<ChartOfAccount[]>(INITIAL_CHART_OF_ACCOUNTS);

  const [travelClaims, setTravelClaims] = useState<TravelClaim[]>(() => {
    return readStored(STORAGE_KEY + '_travelClaims', operationalFallback(INITIAL_TRAVEL_CLAIMS));
  });

  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    return readStored(STORAGE_KEY + '_receipts', operationalFallback(INITIAL_RECEIPTS));
  });

  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>(() => {
    return readStored(STORAGE_KEY + '_paymentVouchers', operationalFallback(INITIAL_PAYMENT_VOUCHERS));
  });

  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerEntry[]>(() =>
    readStored(STORAGE_KEY + '_generalLedger', operationalFallback(INITIAL_GENERAL_LEDGER))
  );
  const [trialBalance] = useState<TrialBalanceRow[]>(operationalFallback(INITIAL_TRIAL_BALANCE));
  const [cashFlowOffice] = useState<CashFlowRow[]>(operationalFallback(INITIAL_CASH_FLOW));
  const [threeWayRec] = useState<ThreeWayRecRow[]>(operationalFallback(INITIAL_3WAY_REC));
  const [docTemplates] = useState<DocTemplate[]>(INITIAL_DOC_TEMPLATES);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return readStored(STORAGE_KEY + '_notifications', operationalFallback<NotificationItem>([
          // Preview-only samples (?preview=1), pointing at the preview matter CS-001.
          {
            id: 'NOTIF-101',
            title: 'Upcoming Hearing Alert',
            message: "Case management for Putrie Nur Armanie Qaliesya (minor) v Shukrina Binti Sa'ad & Ors is coming up.",
            type: 'hearing',
            timestamp: '2026-08-11 09:30',
            read: false,
            linkTab: 'hearings',
            linkId: 'CS-001',
          },
          {
            id: 'NOTIF-102',
            title: 'Invoice Marked as Paid',
            message: 'A tax invoice has been verified and marked as PAID by Finance.',
            type: 'invoice',
            timestamp: '2026-08-11 11:15',
            read: false,
            linkTab: 'billing',
          },
        ]));
  });

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const [announcements, setAnnouncements] = useState<FirmAnnouncement[]>(() =>
    readStored(STORAGE_KEY + '_firmAnnouncements', INITIAL_FIRM_ANNOUNCEMENTS)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_firmAnnouncements', JSON.stringify(announcements));
  }, [announcements]);

  // Global Database Collection Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_auditLogs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
    return operationalFallback<AuditLogEntry>([
      {
        id: 'AUD-1001',
        timestamp: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
        action: 'CREATE',
        collection: 'CASES',
        recordId: 'CASE-001',
        recordTitle: 'SHC/LIT/TAN001/2026 - Tan Ah Kow & Anor v. ABC Realty Sdn Bhd',
        details: 'New court litigation matter created under Civil Litigation practice area.',
        performedBy: 'Syafiqah Hamizad (Partner)',
      },
      {
        id: 'AUD-1002',
        timestamp: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
        action: 'UPDATE',
        collection: 'CASES',
        recordId: 'CASE-001',
        recordTitle: 'SHC/LIT/TAN001/2026 - Tan Ah Kow & Anor v. ABC Realty Sdn Bhd',
        details: 'Updated Hearing Date to 22.08.2026 and assigned Coram: High Court Judge YA Dato\' Lee.',
        performedBy: 'Syafiqah Hamizad (Partner)',
      },
      {
        id: 'AUD-1003',
        timestamp: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
        action: 'CREATE',
        collection: 'CLIENTS',
        recordId: 'CLI-001',
        recordTitle: 'Tan Ah Kow',
        details: 'Client registered into primary firm database with IC 750812-10-5431.',
        performedBy: 'Amer Haiqal (Partner)',
      },
    ]);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_auditLogs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const logAuditEvent = (
    action: AuditLogEntry['action'],
    collection: AuditLogEntry['collection'],
    recordId: string,
    recordTitle: string,
    details: string,
    changes?: Record<string, any>
  ) => {
    const newEntry: AuditLogEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
      action,
      collection,
      recordId,
      recordTitle,
      details,
      performedBy: currentUser?.name || 'Firm Partner',
      changes,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const addAnnouncement = (announcement: Omit<FirmAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => {
    const canPublish = currentUser.isSuperAdmin || currentUser.isAdmin;
    if (!canPublish) {
      showToast('Only Admin and Super Admin can publish firm announcements.');
      return false;
    }
    const created: FirmAnnouncement = {
      ...announcement,
      id: `ANN-${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      internalOnly: true,
    };
    setAnnouncements((previous) => [created, ...previous]);
    logAuditEvent('CREATE', 'SYSTEM', created.id, created.title, `Firm announcement published by ${currentUser.name}.`);
    showToast('Firm announcement published.');
    return true;
  };

  const deleteAnnouncement = (announcementId: string) => {
    const canPublish = currentUser.isSuperAdmin || currentUser.isAdmin;
    if (!canPublish) {
      showToast('Only Admin and Super Admin can delete firm announcements.');
      return false;
    }
    const announcement = announcements.find((item) => item.id === announcementId);
    if (!announcement) return false;
    setAnnouncements((previous) => previous.filter((item) => item.id !== announcementId));
    logAuditEvent('DELETE', 'SYSTEM', announcement.id, announcement.title, `Firm announcement deleted by ${currentUser.name}.`);
    showToast('Firm announcement deleted.');
    return true;
  };

  const [firmStartCentrePages, setFirmStartCentrePages] = useState<FirmStartCentrePage[]>(() =>
    readStored(STORAGE_KEY + '_firmStartCentrePages', INITIAL_FIRM_START_CENTRE_PAGES)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_firmStartCentrePages', JSON.stringify(firmStartCentrePages));
  }, [firmStartCentrePages]);

  const canEditStartCentre = () => {
    return Boolean(currentUser.isSuperAdmin || currentUser.isAdmin);
  };
  const requireStartCentreEditAccess = () => {
    if (!canEditStartCentre()) {
      showToast('You do not have edit access to the Firm Start Centre. Ask an Admin or Super Admin to grant it under Firm & Practice Settings → Permissions & limits.');
      return false;
    }
    return true;
  };

  const addStartCentrePage = (label: string) => {
    if (!requireStartCentreEditAccess()) return false;
    const trimmed = label.trim();
    if (!trimmed) return false;
    const created: FirmStartCentrePage = { id: `page-${Date.now()}`, label: trimmed, icon: 'BookOpen', cards: [] };
    setFirmStartCentrePages((previous) => [...previous, created]);
    return true;
  };

  const updateStartCentrePageLabel = (pageId: string, label: string) => {
    if (!requireStartCentreEditAccess()) return false;
    const trimmed = label.trim();
    if (!trimmed) return false;
    setFirmStartCentrePages((previous) => previous.map((page) => (page.id === pageId ? { ...page, label: trimmed } : page)));
    return true;
  };

  const deleteStartCentrePage = (pageId: string) => {
    if (!requireStartCentreEditAccess()) return false;
    setFirmStartCentrePages((previous) => previous.filter((page) => page.id !== pageId));
    return true;
  };

  const addStartCentreCard = (pageId: string, card: Omit<FirmStartCentreCard, 'id'>) => {
    if (!requireStartCentreEditAccess()) return false;
    if (!card.title.trim()) return false;
    const created: FirmStartCentreCard = { ...card, id: `card-${Date.now()}` };
    setFirmStartCentrePages((previous) =>
      previous.map((page) => (page.id === pageId ? { ...page, cards: [...page.cards, created] } : page))
    );
    return true;
  };

  const updateStartCentreCard = (pageId: string, cardId: string, card: Omit<FirmStartCentreCard, 'id'>) => {
    if (!requireStartCentreEditAccess()) return false;
    if (!card.title.trim()) return false;
    setFirmStartCentrePages((previous) =>
      previous.map((page) =>
        page.id === pageId
          ? { ...page, cards: page.cards.map((existing) => (existing.id === cardId ? { ...existing, ...card } : existing)) }
          : page
      )
    );
    return true;
  };

  const deleteStartCentreCard = (pageId: string, cardId: string) => {
    if (!requireStartCentreEditAccess()) return false;
    setFirmStartCentrePages((previous) =>
      previous.map((page) => (page.id === pageId ? { ...page, cards: page.cards.filter((c) => c.id !== cardId) } : page))
    );
    return true;
  };

  // Recycle Bin / Deleted Items Archive State
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_deletedRecords');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load deleted records:', e);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_deletedRecords', JSON.stringify(deletedRecords));
  }, [deletedRecords]);

  const trackDeletedRecord = (
    entityType: DeletedRecord['entityType'],
    title: string,
    details: string,
    rawData: any
  ) => {
    if (!rawData) return;
    const entry: DeletedRecord = {
      id: `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recordId: rawData.id || String(Date.now()),
      entityType,
      title: title || rawData.title || rawData.name || rawData.ref || 'Untitled Record',
      details: details || `Deleted from ${entityType} registry`,
      deletedAt: new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }),
      deletedBy: currentUser?.name || 'Firm Partner',
      data: rawData,
    };
    setDeletedRecords((prev) => [entry, ...prev]);
  };

  const restoreDeletedRecord = (delId: string) => {
    const target = deletedRecords.find((r) => r.id === delId);
    if (!target) return;

    const { entityType, data } = target;

    if (entityType === 'Case') {
      setCases((prev) => [data, ...prev]);
      localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify([data, ...cases]));
    } else if (entityType === 'Lead') {
      setLeads((prev) => [data, ...prev]);
      localStorage.setItem(STORAGE_KEY + '_leads', JSON.stringify([data, ...leads]));
    } else if (entityType === 'Client') {
      setClients((prev) => [data, ...prev]);
      localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify([data, ...clients]));
    } else if (entityType === 'Law Firm') {
      setLawFirmRegistry((prev) => [data, ...prev]);
    } else if (entityType === 'Invoice') {
      setInvoices((prev) => [data, ...prev]);
    } else if (entityType === 'Quotation') {
      setQuotations((prev) => [data, ...prev]);
    } else if (entityType === 'Payment Voucher') {
      setPaymentVouchers((prev) => [data, ...prev]);
    } else if (entityType === 'Receipt') {
      setReceipts((prev) => [data, ...prev]);
    } else if (entityType === 'Expense') {
      setExpenses((prev) => [data, ...prev]);
    } else if (entityType === 'Time Entry') {
      setTimeEntries((prev) => [data, ...prev]);
    }

    setDeletedRecords((prev) => prev.filter((r) => r.id !== delId));
    logAuditEvent('RESTORE', entityType.toUpperCase(), data.id || delId, target.title, `Restored ${entityType} record from Recycle Bin back into active database.`);
    addActivityLog('Record Restored', `Restored ${entityType}: ${target.title}`);
    showToast(`✅ Successfully retrieved and restored ${entityType} "${target.title}"!`);
  };

  const purgeDeletedRecordPermanently = (delId: string) => {
    const target = deletedRecords.find((r) => r.id === delId);
    setDeletedRecords((prev) => prev.filter((r) => r.id !== delId));
    showToast(`Permanently purged record "${target?.title || delId}".`);
  };

  const emptyTrashRecycleBin = () => {
    setDeletedRecords([]);
    showToast('Recycle Bin emptied. All deleted records permanently purged.');
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNotification = (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...notif,
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const [deadlines, setDeadlines] = useState<Deadline[]>(() => {
    return readStored(STORAGE_KEY + '_deadlines', operationalFallback(INITIAL_DEADLINES));
  });

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() =>
    readStored(STORAGE_KEY + '_timeEntries', operationalFallback(INITIAL_TIME_ENTRIES))
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    readStored(STORAGE_KEY + '_expenses', operationalFallback(INITIAL_EXPENSES))
  );

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    return readStored(STORAGE_KEY + '_invoices', operationalFallback(INITIAL_INVOICES));
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    return readStored(STORAGE_KEY + '_payments', operationalFallback(INITIAL_PAYMENTS));
  });

  const [retainers, setRetainers] = useState<Retainer[]>(() => {
    return readStored(STORAGE_KEY + '_retainers', operationalFallback(INITIAL_RETAINERS));
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() =>
    readStored(STORAGE_KEY + '_logs', operationalFallback(INITIAL_LOGS))
  );
  const [rolesMatrix, setRolesMatrix] = useState<RolePermissionsMatrix>(() => {
    return readStored(STORAGE_KEY + '_rolesMatrix', INITIAL_ROLES_MATRIX);
  });

  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    return readStored(STORAGE_KEY + '_customRoles', [] as string[]);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_customRoles', JSON.stringify(customRoles));
  }, [customRoles]);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    return readStored(STORAGE_KEY + '_bankAccounts', INITIAL_BANK_ACCOUNTS);
  });

  const [trustAuditLogs, setTrustAuditLogs] = useState<TrustAuditLog[]>(() => {
    return readStored(STORAGE_KEY + '_trustAuditLogs', INITIAL_TRUST_AUDIT_LOGS);
  });

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    return readStored(STORAGE_KEY + '_inventoryItems', INITIAL_INVENTORY_ITEMS);
  });

  const [bankReconciliationEntries, setBankReconciliationEntries] = useState<BankReconciliationEntry[]>(() => {
    return readStored(STORAGE_KEY + '_bankReconciliationEntries', INITIAL_BANK_RECONCILIATION_ENTRIES);
  });

  const [clientAccountChecks, setClientAccountChecks] = useState<ClientAccountCheck[]>(() => {
    return readStored(STORAGE_KEY + '_clientAccountChecks', [] as ClientAccountCheck[]);
  });

  // Payroll payslips (Accounts & Finance -> Payroll owns the mutators; Staff Portal only reads
  // the current user's Approved/Paid slips). Starts empty — no sample payslips.
  const [payslips, setPayslips] = useState<Payslip[]>(() => {
    return readStored(STORAGE_KEY + '_payslips', [] as Payslip[]);
  });

  const [manualJournals, setManualJournals] = useState<ManualJournal[]>(() => {
    return readStored(STORAGE_KEY + '_manualJournals', [] as ManualJournal[]);
  });

  const [sequenceCounters, setSequenceCounters] = useState<SequenceCounters>(() => {
    const storedCounters = readStored(STORAGE_KEY + '_sequenceCounters', {
      invoiceSeq: 5,
      quotationSeq: 3,
      caseSeq: 1,
      receiptSeq: 3,
      voucherSeq: 4,
      claimSeq: 2,
      clientSeq: 3,
      leadSeq: 3,
      expenseSeq: 1,
    });
    return storedCounters.caseSeq >= 1000 ? { ...storedCounters, caseSeq: 1 } : storedCounters;
  });

  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [cloudAccessNotice, setCloudAccessNotice] = useState<string | null>(null);
  const [cloudSyncAttempt, setCloudSyncAttempt] = useState(0);
  const retryCloudSync = () => setCloudSyncAttempt((n) => n + 1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_sequenceCounters', JSON.stringify(sequenceCounters));
  }, [sequenceCounters]);

  // Highest N found in ids already shaped "<prefix><digits>" (case-insensitive) — lets
  // getNextSequenceId stay correct even when real records were seeded/imported with ids
  // in its own numbering scheme instead of being created through it.
  const highestNumericSuffix = (ids: string[], prefix: string): number => {
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i');
    return ids.reduce((max, id) => {
      const m = id.match(re);
      if (!m) return max;
      const n = Number(m[1]);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
  };

  // Year-numbered documents (INV-YYYY-, QUOT-YYYY-, JV-YYYY-): the year comes from the
  // document date and the running number restarts each year. The next number is derived from
  // the highest existing id for that prefix+year across all synced records, plus a per-year
  // counter on this device (covers several ids handed out before the records re-render).
  const yearSeqKey = STORAGE_KEY + '_yearSequenceCounters';
  const nextYearSequenceId = (type: 'invoice' | 'quotation' | 'journal', date?: string): string => {
    const m = String(date || '').match(/(\d{4})-\d{1,2}-\d{1,2}/) || String(date || '').match(/\d{1,2}[./-]\d{1,2}[./-](\d{4})/);
    const year = m ? Number(m[1]) : new Date().getFullYear();
    const prefix = type === 'invoice' ? `INV-${year}-` : type === 'quotation' ? `QUOT-${year}-` : `JV-${year}-`;
    const ids = type === 'invoice' ? invoices.map((i) => i.id) : type === 'quotation' ? quotations.map((q) => q.id) : manualJournals.map((j) => j.id);
    const highestReal = highestNumericSuffix(ids, prefix);
    let store: Record<string, number> = {};
    try { store = JSON.parse(localStorage.getItem(yearSeqKey) || '{}') || {}; } catch { store = {}; }
    const k = `${type}:${year}`;
    // Before per-year counters existed, 2026 used the single all-time counter.
    const legacy = year === 2026 && store[k] == null ? Number(sequenceCounters[(type + 'Seq') as keyof SequenceCounters] || 0) : 0;
    const nextNum = Math.max(1, highestReal + 1, Number(store[k] || 0), legacy);
    store[k] = nextNum + 1;
    try { localStorage.setItem(yearSeqKey, JSON.stringify(store)); } catch { /* storage unavailable */ }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  };

  const getNextSequenceId = (
    type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead' | 'expense' | 'journal',
    date?: string
  ): string => {
    if (type === 'invoice' || type === 'quotation' || type === 'journal') return nextYearSequenceId(type, date);
    const key = (type + 'Seq') as keyof SequenceCounters;
    const counterValue = sequenceCounters[key] || 0;
    // Nothing ever called incrementSequenceCounter() for any of these types (only 'case'
    // does, and that branch below ignores the counter entirely anyway) — every call to
    // getNextSequenceId('invoice'/'quotation'/etc.) was returning the exact same first ID
    // forever, so a second invoice/quotation/receipt/voucher/client/lead would silently
    // get the same id as the first.
    //
    // The counter alone also isn't enough: seed/imported data (e.g. INITIAL_LEADS'
    // 'LD-001'..'LD-003') already occupies ids in this exact scheme without ever having
    // advanced the counter, so a naive counter-only fix can still hand out an id that
    // collides with an existing real record. Take whichever is higher.
    const highestReal = (() => {
      switch (type) {
        case 'receipt': return highestNumericSuffix(receipts.map((r) => r.id), 'HQ-OR-');
        case 'voucher': return highestNumericSuffix(paymentVouchers.map((v) => v.id), 'HQ-PV-');
        case 'claim': return highestNumericSuffix(travelClaims.map((t) => t.id), 'TC-');
        case 'client': return highestNumericSuffix(clients.map((c) => c.id), 'HQ-C');
        case 'lead': return highestNumericSuffix(leads.map((l) => l.id), 'LD-');
        case 'expense': return highestNumericSuffix(expenses.map((e) => e.id), 'EX-');
        default: return 0;
      }
    })();
    const nextNum = Math.max(counterValue === 0 ? 1 : counterValue, highestReal + 1);
    if (type !== 'case') {
      setSequenceCounters((prev) => ({ ...prev, [key]: nextNum + 1 }));
    }
    switch (type) {
      case 'case': {
        // Every existing file counts (real files use ids like CS-001), so running numbers never
        // repeat; 4 digits to match the firm's refs (…/0001/08-2026).
        return generateNextMatterSequenceNumber(cases, 1).padStart(4, '0');
      }
      case 'receipt':
        return `HQ-OR-${String(nextNum).padStart(4, '0')}`;
      case 'voucher':
        return `HQ-PV-${String(nextNum).padStart(4, '0')}`;
      case 'claim':
        return `TC-${String(nextNum).padStart(4, '0')}`;
      case 'client':
        return `HQ-C${String(nextNum).padStart(3, '0')}`;
      case 'lead':
        return `LD-${String(nextNum).padStart(3, '0')}`;
      case 'expense':
        return `EX-${String(nextNum).padStart(4, '0')}`;
      default:
        return String(nextNum);
    }
  };

  const incrementSequenceCounter = (
    type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead' | 'expense' | 'journal'
  ) => {
    const key = (type + 'Seq') as keyof SequenceCounters;
    setSequenceCounters((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1,
    }));
  };

  const resetSequenceCounters = () => {
    const zeros: SequenceCounters = {
      invoiceSeq: 0,
      quotationSeq: 0,
      caseSeq: 0,
      receiptSeq: 0,
      voucherSeq: 0,
      claimSeq: 0,
      clientSeq: 0,
      leadSeq: 0,
      expenseSeq: 0,
    };
    setSequenceCounters(zeros);
    localStorage.setItem(STORAGE_KEY + '_sequenceCounters', JSON.stringify(zeros));
  };

  const factoryResetSystem = async () => {
    // 1. Clear operational local storage keys (preserving configuration and users)
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith(STORAGE_KEY) &&
        !key.endsWith('_practiceSettings') &&
        !key.endsWith('_users') &&
        !key.endsWith('_rolesMatrix')
      ) {
        localStorage.removeItem(key);
      }
    });

    // 2. Reset sequence counters to zero
    resetSequenceCounters();

    // 3. Clear data collections
    setLeads([]);
    setClients([]);
    setCases([]);
    setQuotations([]);
    setTravelClaims([]);
    setReceipts([]);
    setPaymentVouchers([]);
    setGeneralLedger([]);
    setDeadlines([]);
    setTimeEntries([]);
    setExpenses([]);
    setInvoices([]);
    setPayments([]);
    setRetainers([]);
    setLawFirmRegistry([]);

    // 4. Create audit log entry
    const resetLog: ActivityLog = {
      ts: new Date().toISOString().slice(0, 16).replace('T', ' '),
      user: currentUser?.name || 'Super Admin (Syafiqah Hamizad)',
      action: 'Factory Reset Executed',
      details:
        'Full Factory Reset Executed: Cleared all transactional collections (Leads, Clients, Cases, Invoices, Vouchers, Receipts, Trust Ledger) and reset running sequence counters to 0.',
    };
    setLogs([resetLog]);

    showToast('Factory Reset Complete! All operational data purged and sequence counters reset to zero.');
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_bankAccounts', JSON.stringify(bankAccounts));
  }, [bankAccounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_trustAuditLogs', JSON.stringify(trustAuditLogs));
  }, [trustAuditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_inventoryItems', JSON.stringify(inventoryItems));
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_bankReconciliationEntries', JSON.stringify(bankReconciliationEntries));
  }, [bankReconciliationEntries]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_clientAccountChecks', JSON.stringify(clientAccountChecks));
  }, [clientAccountChecks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_payslips', JSON.stringify(payslips));
  }, [payslips]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_manualJournals', JSON.stringify(manualJournals));
  }, [manualJournals]);

  const addBankAccount = (acc: Omit<BankAccount, 'id'>) => {
    const newAcc: BankAccount = { ...acc, id: `BANK-${Date.now()}` };
    setBankAccounts((prev) => [...prev, newAcc]);
    addActivityLog('Bank Account Created', `${newAcc.bankName} (${newAcc.accountNo})`);
    showToast(`Added bank account: ${newAcc.accountName}`);
  };

  const updateBankAccount = (id: string, updates: Partial<BankAccount>) => {
    setBankAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    showToast('Bank account updated');
  };

  const archiveBankAccount = (id: string) => {
    setBankAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Archived' } : a)));
    addActivityLog('Bank Account Archived', id);
    showToast('Bank account archived');
  };

  const addTrustAuditLog = (entry: Omit<TrustAuditLog, 'id' | 'timestamp'>) => {
    const newEntry: TrustAuditLog = {
      ...entry,
      id: `TAL-${Date.now()}`,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    setTrustAuditLogs((prev) => [newEntry, ...prev]);
  };

  const addInventoryItem = (item: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = { ...item, id: `INV-${Date.now()}` };
    setInventoryItems((prev) => [...prev, newItem]);
    addActivityLog('Inventory Added', newItem.name);
    showToast(`Added inventory item: ${newItem.name}`);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventoryItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    showToast('Inventory item updated');
  };

  const toggleReconcileEntry = (id: string) => {
    setBankReconciliationEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: e.status === 'Reconciled' ? 'Unreconciled' : 'Reconciled',
              reconciledBy: currentUser.name,
              reconciledDate: new Date().toISOString().slice(0, 10),
            }
          : e
      )
    );
    showToast('Reconciliation status updated');
  };

  /** Advance a recurring compliance item's due date by one period. */
  const advanceComplianceDue = (dueISO: string, freq: ComplianceItem['frequency']): string => {
    const d = new Date(dueISO);
    if (Number.isNaN(d.getTime())) return dueISO;
    if (freq === 'Monthly') d.setMonth(d.getMonth() + 1);
    else if (freq === 'Quarterly') d.setMonth(d.getMonth() + 3);
    else if (freq === 'Annual') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  };

  /**
   * Toggles a compliance register item. Recurring items (Monthly/Quarterly/Annual) that were
   * ticked for a prior period but whose due date has since passed are treated as reset (not
   * done for the current period) — a simple date check done here on read, not a cron job. So
   * "toggle" always acts on the item's *current-period* done state: ticking a stale item marks
   * it done for the new period (logs history, rolls the due date forward); ticking a genuinely
   * done item un-ticks it.
   */
  const toggleComplianceItem = (id: string) => {
    const settings = getPracticeSettings();
    const register = settings.complianceRegister || [];
    const idx = register.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = register[idx];
    const today = new Date().toISOString().slice(0, 10);
    const stale = item.frequency !== 'One-off' && item.done && item.due < today;
    const currentlyDone = item.done && !stale;
    const updated: ComplianceItem = currentlyDone
      ? { ...item, done: false }
      : {
          ...item,
          done: true,
          due: item.frequency === 'One-off' ? item.due : advanceComplianceDue(item.due, item.frequency),
          history: [...(item.history || []), { period: item.due, completedAt: today, completedBy: currentUser.name }],
        };
    const newRegister = register.map((i, x) => (x === idx ? updated : i));
    savePracticeSettings({ ...settings, complianceRegister: newRegister });
    addActivityLog('Compliance Item Updated', `${item.label} marked ${updated.done ? 'done' : 'open'}`);
    showToast(updated.done ? 'Marked as done' : 'Marked as open');
  };

  const updateComplianceItem = (id: string, patch: Partial<ComplianceItem>) => {
    const settings = getPracticeSettings();
    const register = (settings.complianceRegister || []).map((i) => (i.id === id ? { ...i, ...patch } : i));
    savePracticeSettings({ ...settings, complianceRegister: register });
  };

  const addComplianceItem = (group: ComplianceItem['group'], item: Partial<Omit<ComplianceItem, 'id' | 'group'>>) => {
    const settings = getPracticeSettings();
    const newItem: ComplianceItem = {
      id: `CMP-${Date.now()}`,
      group,
      label: item.label || 'New item',
      note: item.note || '',
      frequency: item.frequency || 'Annual',
      due: item.due || new Date().toISOString().slice(0, 10),
      owner: item.owner || currentUser.name,
      done: item.done ?? false,
      history: item.history || [],
    };
    savePracticeSettings({ ...settings, complianceRegister: [...(settings.complianceRegister || []), newItem] });
    addActivityLog('Compliance Item Added', `${newItem.label} (${group})`);
    showToast(`Added item to ${group}`);
  };

  const addComplaint = (complaint: Omit<ComplaintRecord, 'id'>) => {
    const settings = getPracticeSettings();
    const newComplaint: ComplaintRecord = { ...complaint, id: `CMPLT-${Date.now()}` };
    savePracticeSettings({ ...settings, complaints: [...(settings.complaints || []), newComplaint] });
    addActivityLog('Complaint Logged', newComplaint.summary);
    showToast('Complaint logged');
  };

  const updateComplaint = (id: string, patch: Partial<ComplaintRecord>) => {
    const settings = getPracticeSettings();
    const complaints = (settings.complaints || []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    savePracticeSettings({ ...settings, complaints });
    showToast('Complaint updated');
  };

  // --- My Dashboard -> Direction (Managing Partner only, Growth merged in) -----------------
  // Same rationale/pattern as the Compliance register above: PracticeSettings is the only
  // store for this firm-maintained content, so mutators read-modify-write via
  // getPracticeSettings/savePracticeSettings rather than going through the reducer state.

  const updateDirectionStatement = (field: 'vision' | 'mission' | 'target2028', text: string) => {
    const settings = getPracticeSettings();
    savePracticeSettings({ ...settings, [field]: text });
  };

  const updatePartnersNotes = (text: string) => {
    const settings = getPracticeSettings();
    savePracticeSettings({ ...settings, partnersNotes: text });
  };

  const addMilestone = (year: number, text = 'New milestone') => {
    const settings = getPracticeSettings();
    const newMilestone: Milestone = { id: `MS-${Date.now()}`, year, text, status: 'Not started' };
    savePracticeSettings({ ...settings, roadmap: [...(settings.roadmap || []), newMilestone] });
    addActivityLog('Milestone Added', `${text} (${year})`);
  };

  const updateMilestone = (id: string, patch: Partial<Omit<Milestone, 'id'>>) => {
    const settings = getPracticeSettings();
    const roadmap = (settings.roadmap || []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    savePracticeSettings({ ...settings, roadmap });
  };

  const cycleMilestoneStatus = (id: string) => {
    const ORDER: Milestone['status'][] = ['Not started', 'On track', 'Behind', 'Done'];
    const settings = getPracticeSettings();
    const roadmap = (settings.roadmap || []).map((m) =>
      m.id === id ? { ...m, status: ORDER[(ORDER.indexOf(m.status) + 1) % ORDER.length] } : m
    );
    savePracticeSettings({ ...settings, roadmap });
  };

  const addFirmGoal = (goal: Omit<FirmGoal, 'id'>) => {
    const settings = getPracticeSettings();
    const newGoal: FirmGoal = { ...goal, id: `GOAL-${Date.now()}` };
    savePracticeSettings({ ...settings, firmGoals: [...(settings.firmGoals || []), newGoal] });
  };

  const updateFirmGoal = (id: string, patch: Partial<Omit<FirmGoal, 'id'>>) => {
    const settings = getPracticeSettings();
    const firmGoals = (settings.firmGoals || []).map((g) => (g.id === id ? { ...g, ...patch } : g));
    savePracticeSettings({ ...settings, firmGoals });
  };

  const removeFirmGoal = (id: string) => {
    const settings = getPracticeSettings();
    savePracticeSettings({ ...settings, firmGoals: (settings.firmGoals || []).filter((g) => g.id !== id) });
  };

  const addPanelship = (panel: Omit<Panelship, 'id'>) => {
    const settings = getPracticeSettings();
    const newPanel: Panelship = { ...panel, id: `PANEL-${Date.now()}` };
    savePracticeSettings({ ...settings, panelships: [...(settings.panelships || []), newPanel] });
    addActivityLog('Panelship Added', newPanel.name);
  };

  const updatePanelship = (id: string, patch: Partial<Omit<Panelship, 'id'>>) => {
    const settings = getPracticeSettings();
    const panelships = (settings.panelships || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    savePracticeSettings({ ...settings, panelships });
  };

  const removePanelship = (id: string) => {
    const settings = getPracticeSettings();
    savePracticeSettings({ ...settings, panelships: (settings.panelships || []).filter((p) => p.id !== id) });
  };

  const addInvestmentChannel = (channel: Omit<InvestmentChannel, 'id'>) => {
    const settings = getPracticeSettings();
    const newChannel: InvestmentChannel = { ...channel, id: `INV-${Date.now()}` };
    savePracticeSettings({ ...settings, investmentChannels: [...(settings.investmentChannels || []), newChannel] });
  };

  const updateInvestmentChannel = (id: string, patch: Partial<Omit<InvestmentChannel, 'id'>>) => {
    const settings = getPracticeSettings();
    const investmentChannels = (settings.investmentChannels || []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    savePracticeSettings({ ...settings, investmentChannels });
  };

  const removeInvestmentChannel = (id: string) => {
    const settings = getPracticeSettings();
    savePracticeSettings({ ...settings, investmentChannels: (settings.investmentChannels || []).filter((c) => c.id !== id) });
  };

  const toggleClientAccountCheck = (itemKey: string) => {
    setClientAccountChecks((prev) => {
      const already = prev.some((c) => c.itemKey === itemKey);
      if (already) return prev.filter((c) => c.itemKey !== itemKey);
      return [...prev, { itemKey, checkedBy: currentUser.name, checkedAt: new Date().toISOString() }];
    });
  };

  const resetClientPassword = (clientIdentifier: string, newPass: string): { success: boolean; message: string } => {
    const term = clientIdentifier.trim().toLowerCase();
    let updated = false;
    setUsers((prev) =>
      prev.map((u) => {
        if (
          u.role === 'Client' &&
          (u.email.toLowerCase() === term || u.id.toLowerCase() === term || u.name.toLowerCase().includes(term))
        ) {
          updated = true;
          return { ...u, clientPassword: newPass };
        }
        return u;
      })
    );

    if (updated) {
      showToast('Client password reset successfully.');
      return { success: true, message: 'Your password has been updated successfully. You may now log in with your new password.' };
    } else {
      // If client not yet in users array, add/update
      const newClientUser: User = {
        id: `U-client-${Date.now()}`,
        name: clientIdentifier.split('@')[0],
        email: term.includes('@') ? term : `${term}@client.com`,
        role: 'Client',
        isAdmin: false,
        clientPassword: newPass,
        status: 'Active',
      };
      setUsers((prev) => [...prev, newClientUser]);
      showToast('Client account password initialized.');
      return { success: true, message: 'Password set successfully for client account.' };
    }
  };

  const VIEW_TO_MODULE_MAP: Record<string, string> = {
    firmStartCentre: 'dashboard',
    dashboard: 'dashboard',
    firmDashboard: 'dashboard',
    partnerDashboard: 'dashboard',
    clientPortal: 'clientPortal',
    // URL-style aliases routed in App.tsx must gate the same as their main id (unmapped ids
    // fall back to the always-visible 'dashboard' module).
    myDashboard: 'dashboard',
    'client-portal': 'clientPortal',
    tasks: 'cases',
    'case-status': 'cases',
    'file-closing': 'cases',
    referrals: 'cases',
    'bank-accounts': 'officeFinance',
    'bank-reconciliation': 'officeFinance',
    'trust-audit-logs': 'retainers',
    leads: 'leads',
    leadsReferrals: 'leads',
    'leads-referrals': 'leads',
    clients: 'clients',
    cases: 'cases',
    documents: 'cases',
    hearings: 'cases',
    calendar: 'cases',
    caseStatus: 'cases',
    deadlines: 'cases',
    serviceLog: 'cases',
    lawFirmRegistry: 'cases',
    referral: 'cases',
    fileClosing: 'cases',
    predispute: 'predispute',
    counselRegistry: 'counselRegistry',
    templates: 'templates',
    accountingCentre: 'finance',
    billing: 'finance',
    quotations: 'finance',
    time: 'finance',
    expenses: 'finance',
    travelClaims: 'finance',
    claimsManagement: 'finance',
    invoices: 'finance',
    payments: 'finance',
    receipts: 'finance',
    billingReports: 'finance',
    retainers: 'retainers',
    statement: 'retainers',
    paymentVouchers: 'retainers',
    trustReports: 'retainers',
    trustAuditLogs: 'retainers',
    coa: 'officeFinance',
    officeAccounts: 'officeFinance',
    bankAccounts: 'officeFinance',
    bankReconciliation: 'officeFinance',
    inventory: 'officeFinance',
    gl: 'officeFinance',
    trialBalance: 'officeFinance',
    balanceSheet: 'officeFinance',
    cashFlow: 'officeFinance',
    officeReports: 'officeFinance',
    users: 'users',
    settings: 'settings',
    practiceSettings: 'settings',
    firmSettings: 'settings',
    logs: 'logs',
    roles: 'logs',
    // Personal pages: every staff member can open their own account and the About page.
    about: 'dashboard',
    account: 'dashboard',
  };

  const addCustomRole = (roleName: string): boolean => {
    const isSuperAdminUser =
      currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);
    if (!isSuperAdminUser) {
      showToast('Only a Super Admin can create new roles.');
      return false;
    }

    const trimmedName = roleName.trim();
    if (!trimmedName) {
      showToast('Role name cannot be empty.');
      return false;
    }

    const fixedRoles = ['Partner', 'Lawyer', 'Assistant', 'Reviewer', 'Client'];
    const existingRoles = [...fixedRoles, ...customRoles];
    if (existingRoles.some((role) => role.toLowerCase() === trimmedName.toLowerCase())) {
      showToast(`Role "${trimmedName}" already exists.`);
      return false;
    }

    setCustomRoles((prev) => [...prev, trimmedName]);
    // New roles start with no module access; grant permissions explicitly from Roles & Permissions.
    setRolesMatrix((prev) => ({ ...prev, [trimmedName]: {} }));
    addActivityLog('Custom Role Created', trimmedName);
    showToast(`Role "${trimmedName}" created. Configure its access under Roles & Permissions.`);
    return true;
  };

  const updateRolePermission = (
    role: Role,
    moduleKey: string,
    action: 'v' | 'a' | 'e',
    value: number
  ) => {
    setRolesMatrix((prev) => {
      const rolePerms = prev[role] || {};
      const modulePerms = rolePerms[moduleKey] || { v: 0, a: 0, e: 0 };
      return {
        ...prev,
        [role]: {
          ...rolePerms,
          [moduleKey]: {
            ...modulePerms,
            [action]: value,
          },
        },
      };
    });
    showToast(`Updated permissions for ${role} -> ${moduleKey}`);
  };

  const updateUserNavOverride = (
    userId: string,
    moduleKey: string,
    action: 'v' | 'a' | 'e',
    value: number
  ) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentOverrides = u.navOverrides || {};
          const currentModPerm = currentOverrides[moduleKey] || { v: 0, a: 0, e: 0 };
          return {
            ...u,
            navOverrides: {
              ...currentOverrides,
              [moduleKey]: {
                ...currentModPerm,
                [action]: value,
              },
            },
          };
        }
        return u;
      })
    );
    showToast(`Updated user explicit navigation override.`);
  };

  const setRoleModulePermissions = (role: Role, moduleKey: string, perms: ModulePermissions) => {
    setRolesMatrix((prev) => ({ ...prev, [role]: { ...(prev[role] || {}), [moduleKey]: { v: perms.v, a: perms.a, e: perms.e } } }));
  };

  const setUserNavOverride = (userId: string, moduleKey: string, perms: ModulePermissions | null) => {
    const apply = (u: User): User => {
      const next = { ...(u.navOverrides || {}) };
      if (perms) next[moduleKey] = { v: perms.v, a: perms.a, e: perms.e };
      else delete next[moduleKey];
      return { ...u, navOverrides: next };
    };
    setUsers((prev) => prev.map((u) => (u.id === userId ? apply(u) : u)));
    if (userId === currentUser.id) setCurrentUser((prev) => apply(prev));
  };

  const resetUserNavOverrides = (userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, navOverrides: {} } : u)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, navOverrides: {} }));
  };

  const updateUserAccount = (userId: string, patch: { status?: User['status']; branch?: string; twoStepLogin?: boolean }): boolean => {
    const isSuperAdminUser = currentUser.email === 'syafiqahhamizad@shcolaw.com' || Boolean(currentUser.isSuperAdmin);
    if (!(isSuperAdminUser || currentUser.isAdmin)) {
      showToast('Only an admin can change user accounts.');
      return false;
    }
    const target = users.find((u) => u.id === userId);
    if (!target) return false;
    if (patch.status === 'Inactive') {
      if (!isSuperAdminUser) {
        showToast('Only the Super Admin can switch a user off.');
        return false;
      }
      if (target.email === 'syafiqahhamizad@shcolaw.com' || target.id === currentUser.id) {
        showToast('The Managing Partner is always Super admin and cannot be switched off.');
        return false;
      }
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, ...patch }));
    if (patch.status !== undefined && target.email) approveAccessChange(target.email);
    logAuditEvent('UPDATE', 'USERS', userId, target.name, `Account updated: ${Object.entries(patch).map(([k, v]) => `${k} = ${v}`).join(', ')}.`);
    return true;
  };

  // 'settings' / 'users' / 'logs' need Admin or Super Admin specifically — being a
  // Partner alone is no longer enough (a regular Partner shouldn't be able to create
  // accounts, change roles, or read the firm-wide activity log). 'retainers' (client
  // trust account — also covers Payment Vouchers, Trust Reports, Trust Audit Log,
  // Client Statement) keeps the Partner-role bypass, since every partner is expected to
  // see client trust money; Reviewer additionally gets a read-only carve-out for it,
  // since the Reviewer role is this app's external/auditor login and auditing the trust
  // account is exactly what an auditor is for.
  const isSensitiveAdminModule = (moduleKey: string): boolean => {
    return ['retainers', 'settings', 'users', 'logs'].includes(moduleKey);
  };

  const isPartnerLevelSensitiveModule = (moduleKey: string): boolean => moduleKey === 'retainers';

  const canViewModule = (viewId: string): boolean => {
    // Effective active role perspective
    const effectiveRole: Role = currentRole || currentUser.role || 'Partner';
    const moduleKey = VIEW_TO_MODULE_MAP[viewId] || 'dashboard';

    // Client role is strictly restricted to clientPortal
    if (effectiveRole === 'Client') {
      return viewId === 'clientPortal';
    }

    if (viewId === 'staffPortal' || viewId === 'staff-portal') {
      return true;
    }

    if (isSensitiveAdminModule(moduleKey)) {
      const isAuthorizedAdmin = Boolean(
        currentUser.isSuperAdmin || currentUser.isAdmin ||
        (isPartnerLevelSensitiveModule(moduleKey) && (currentRole === 'Partner' || currentUser.role === 'Partner'))
      );
      const isAuditorReadOnly = moduleKey === 'retainers' && effectiveRole === 'Reviewer';
      if (!isAuthorizedAdmin && !isAuditorReadOnly) return false;
    }

    // If logged in user is Super Admin / Admin AND current active role perspective is Partner, allow full firm access
    if ((currentUser.isSuperAdmin || currentUser.isAdmin) && effectiveRole === 'Partner') {
      return true;
    }

    // 1. Check explicit user navigation overrides first if set for current user
    if (currentUser?.navOverrides && currentUser.navOverrides[viewId]) {
      return currentUser.navOverrides[viewId].v === 1;
    }
    // Per-person overrides saved from Firm & Practice Settings use module keys (e.g. 'leads').
    if (currentUser?.navOverrides && currentUser.navOverrides[moduleKey]) {
      return currentUser.navOverrides[moduleKey].v === 1;
    }

    // 2. Check exact viewId in roleMatrix
    const roleMatrix = rolesMatrix[effectiveRole];
    if (roleMatrix && roleMatrix[viewId]) {
      return roleMatrix[viewId].v === 1;
    }

    // 3. Fallback to mapped category key
    if (!roleMatrix) return false;

    const modulePerm = roleMatrix[moduleKey];
    if (!modulePerm) return false;

    return modulePerm.v === 1;
  };

  const hasModulePermission = (moduleKey: string, action: 'v' | 'a' | 'e'): boolean => {
    const effectiveRole: Role = currentRole || currentUser.role || 'Partner';
    const roleMatrix = rolesMatrix[effectiveRole] || {};

    if (effectiveRole === 'Client') {
      return moduleKey === 'clientPortal' && action === 'v';
    }

    if (isSensitiveAdminModule(moduleKey)) {
      const isAuthorizedAdmin = Boolean(
        currentUser.isSuperAdmin || currentUser.isAdmin ||
        (isPartnerLevelSensitiveModule(moduleKey) && (currentRole === 'Partner' || currentUser.role === 'Partner'))
      );
      const isAuditorReadOnly = moduleKey === 'retainers' && effectiveRole === 'Reviewer' && action === 'v';
      if (!isAuthorizedAdmin && !isAuditorReadOnly) return false;
    }

    // Admin accounts retain full module access even when their active role is not in the matrix.
    if (currentUser.isSuperAdmin || currentUser.isAdmin) {
      return true;
    }

    const modulePerm = roleMatrix[moduleKey] || { v: 0, a: 0, e: 0 };
    const permissionValue = modulePerm[action];
    return permissionValue === 1;
  };

  const [lawFirmRegistry, setLawFirmRegistry] = useState<LawFirmRegistryEntry[]>(() => {
    return readStored(STORAGE_KEY + '_lawFirmRegistry', INITIAL_LAW_FIRM_REGISTRY);
  });

  // Save to localStorage whenever critical collections change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    const safeUsers = sanitizeClientPasswordsForStorage(users);
    localStorage.setItem(STORAGE_KEY + '_users', JSON.stringify(safeUsers));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_attendance', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_leaveApplications', JSON.stringify(leaveApplications));
  }, [leaveApplications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_meetings', JSON.stringify(meetings));
  }, [meetings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_programmes', JSON.stringify(programmes));
  }, [programmes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_rolesMatrix', JSON.stringify(rolesMatrix));
  }, [rolesMatrix]);

  // timeEntries/expenses/generalLedger/logs never persisted at all (no readStored on
  // init, no write effect) — every billable hour, expense claim and GL posting reverted
  // to seed data on refresh. These four effects plus the readStored() on their useState
  // above fix that; the cloud-sync additions below cover the multi-device side of it.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_timeEntries', JSON.stringify(timeEntries));
  }, [timeEntries]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_generalLedger', JSON.stringify(generalLedger));
  }, [generalLedger]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify(cases));
  }, [cases]);

  // Keep client matter links derived from the current case and client collections.
  useEffect(() => {
    if (cases.length > 0 && clients.length > 0) {
      setClients((prevClients) => {
        const synced = syncClientMatterLinks(cases, prevClients);
        return synced;
      });
    }
  }, [cases, clients.length]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_lawFirmRegistry', JSON.stringify(lawFirmRegistry));
  }, [lawFirmRegistry]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_quotations', JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_referrals', JSON.stringify(referralPartners));
  }, [referralPartners]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_paymentVouchers', JSON.stringify(paymentVouchers));
  }, [paymentVouchers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_travelClaims', JSON.stringify(travelClaims));
  }, [travelClaims]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_receipts', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_deadlines', JSON.stringify(deadlines));
  }, [deadlines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_retainers', JSON.stringify(retainers));
  }, [retainers]);
  useEffect(() => {
    if (!isAuthenticated || SAFE_PREVIEW_MODE) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const applyCloudState = (state: CloudState) => {
      const cloudDeletedRecords = Array.isArray(state.deletedRecords) ? state.deletedRecords as DeletedRecord[] : [];
      const deletedKeys = new Set([...deletedRecords, ...cloudDeletedRecords].map((record) => `${record.entityType}:${record.recordId}`));
      const isActive = (entityType: DeletedRecord['entityType'], record: { id?: string }) => !deletedKeys.has(`${entityType}:${record.id}`);

      if (cloudDeletedRecords.length > 0) {
        setDeletedRecords((previous) => Array.from(new Map([...previous, ...cloudDeletedRecords].map((record) => [record.id, record])).values()));
      }
      if (Array.isArray(state.leads)) setLeads((state.leads as Lead[]).filter((lead) => isActive('Lead', lead)));
      if (Array.isArray(state.clients)) setClients((state.clients as Client[]).filter((client) => isActive('Client', client)));
      if (Array.isArray(state.cases)) setCases((state.cases as Case[]).filter((caseObj) => isActive('Case', caseObj)));
      if (Array.isArray(state.quotations)) setQuotations((state.quotations as Quotation[]).filter((quotation) => isActive('Quotation', quotation)));
      if (Array.isArray(state.referralPartners)) setReferralPartners(state.referralPartners as ReferralPartner[]);
      if (Array.isArray(state.paymentVouchers)) setPaymentVouchers((state.paymentVouchers as PaymentVoucher[]).filter((voucher) => isActive('Payment Voucher', voucher)));
      if (Array.isArray(state.travelClaims)) setTravelClaims(state.travelClaims as TravelClaim[]);
      if (Array.isArray(state.receipts)) setReceipts((state.receipts as Receipt[]).filter((receipt) => isActive('Receipt', receipt)));
      if (Array.isArray(state.deadlines)) setDeadlines(state.deadlines as Deadline[]);
      if (Array.isArray(state.invoices)) setInvoices((state.invoices as Invoice[]).filter((invoice) => isActive('Invoice', invoice)));
      if (Array.isArray(state.payments)) setPayments(state.payments as Payment[]);
      if (Array.isArray(state.retainers)) setRetainers(state.retainers as Retainer[]);
      if (Array.isArray(state.users)) setUsers(state.users as User[]);
      if (Array.isArray(state.attendanceRecords)) setAttendanceRecords(state.attendanceRecords as AttendanceRecord[]);
      if (Array.isArray(state.leaveApplications)) setLeaveApplications(state.leaveApplications as LeaveApplication[]);
      if (Array.isArray(state.meetings)) setMeetings(state.meetings as Meeting[]);
      if (Array.isArray(state.programmes)) setProgrammes(state.programmes as Programme[]);
      // The following were local-localStorage-only (same bug class as meetings/programmes
      // above) — never reached anyone else in the firm, and timeEntries/expenses/
      // generalLedger/logs didn't even persist locally (readStored() added on their
      // useState declarations above; see the write effects added alongside them).
      if (Array.isArray(state.timeEntries)) setTimeEntries(state.timeEntries as TimeEntry[]);
      if (Array.isArray(state.expenses)) setExpenses(state.expenses as Expense[]);
      if (Array.isArray(state.generalLedger)) setGeneralLedger(state.generalLedger as GeneralLedgerEntry[]);
      if (Array.isArray(state.logs)) setLogs(state.logs as ActivityLog[]);
      if (Array.isArray(state.announcements)) setAnnouncements(state.announcements as FirmAnnouncement[]);
      if (Array.isArray(state.auditLogs)) setAuditLogs(state.auditLogs as AuditLogEntry[]);
      if (Array.isArray(state.firmStartCentrePages)) setFirmStartCentrePages(state.firmStartCentrePages as FirmStartCentrePage[]);
      if (Array.isArray(state.bankAccounts)) setBankAccounts(state.bankAccounts as BankAccount[]);
      if (Array.isArray(state.trustAuditLogs)) setTrustAuditLogs(state.trustAuditLogs as TrustAuditLog[]);
      if (Array.isArray(state.inventoryItems)) setInventoryItems(state.inventoryItems as InventoryItem[]);
      if (Array.isArray(state.bankReconciliationEntries)) setBankReconciliationEntries(state.bankReconciliationEntries as BankReconciliationEntry[]);
      if (Array.isArray(state.clientAccountChecks)) setClientAccountChecks(state.clientAccountChecks as ClientAccountCheck[]);
      if (Array.isArray(state.payslips)) setPayslips(state.payslips as Payslip[]);
      if (Array.isArray(state.manualJournals)) setManualJournals(state.manualJournals as ManualJournal[]);
      if (Array.isArray(state.notifications)) setNotifications(state.notifications as NotificationItem[]);
      if (Array.isArray(state.lawFirmRegistry)) setLawFirmRegistry((state.lawFirmRegistry as LawFirmRegistryEntry[]).filter((firm) => isActive('Law Firm', firm)));
      if (state.sequenceCounters && typeof state.sequenceCounters === 'object') setSequenceCounters(state.sequenceCounters as SequenceCounters);
      // Role/permission changes (Roles & Permissions matrix, custom roles) were only ever
      // saved to the editing admin's own browser localStorage — never shared with anyone
      // else. Without this, promoting/restricting a role on one device would silently do
      // nothing for every other person's session.
      if (state.rolesMatrix && typeof state.rolesMatrix === 'object') setRolesMatrix(state.rolesMatrix as RolePermissionsMatrix);
      if (Array.isArray(state.customRoles)) setCustomRoles(state.customRoles as string[]);
      // Firm & Practice Settings (letterhead, practice areas, billing defaults, bank
      // accounts, etc.) was pure localStorage via templateService.ts — completely
      // disconnected from this sync loop, so it never reached anyone else either.
      if (state.practiceSettings && typeof state.practiceSettings === 'object') {
        applyCloudPracticeSettings(state.practiceSettings as PracticeSettings);
      }
    };

    const sync = async () => {
      try {
        const cloudState = await readCloudState();
        if (cancelled) return;

        if (cloudState) {
          applyCloudState(cloudState);
        } else {
          await writeCloudState({
            leads, clients, cases, quotations, referralPartners, paymentVouchers, travelClaims,
            receipts, deadlines, invoices, payments, retainers, users, attendanceRecords,
            leaveApplications, meetings, programmes, notifications, lawFirmRegistry, sequenceCounters, deletedRecords,
            rolesMatrix, customRoles, practiceSettings: getPracticeSettings(),
            timeEntries, expenses, generalLedger, logs, announcements, auditLogs,
            firmStartCentrePages, bankAccounts, trustAuditLogs, inventoryItems, bankReconciliationEntries, clientAccountChecks,
            payslips, manualJournals,
          });
        }

        setCloudAccessNotice(null);
        setCloudSyncReady(true);
        unsubscribe = subscribeToCloudState((state) => {
          if (!cancelled) applyCloudState(state);
        }, (error) => {
          console.error('Cloud state subscription unavailable; signing out to prevent local-only data entry.', error);
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          setCloudSyncReady(false);
          setIsAuthenticated(false);
        });
      } catch (error) {
        if (cancelled) return;
        const code = String((error as { code?: string })?.code || '');
        if (code === 'permission-denied') {
          // At startup this almost always means the person isn't on the published access
          // list yet (or their password account's email isn't verified). Don't bounce them
          // back to the sign-in page with no explanation: keep the session but block the app
          // (cloudSyncReady stays false, so nothing is saved) and say what to do.
          console.warn('Cloud state refused at startup (permission-denied); showing the access notice.', error);
          setCloudSyncReady(false);
          setCloudAccessNotice(
            "Your access hasn't been published yet — ask the Managing Partner to open Firm & Practice Settings → Users & Roles. " +
            'If you sign in with an email and password, also make sure you have clicked the link in the verification email.'
          );
          return;
        }
        console.error('Cloud state unavailable; signing out to prevent local-only data entry.', error);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setCloudSyncReady(false);
        setIsAuthenticated(false);
        showToast(`Couldn't reach the firm's cloud data, so you've been signed out to avoid unsaved work. Please try again.${code ? ` (${code})` : ''}`);
      }
    };

    void sync();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, cloudSyncAttempt]);

  useEffect(() => {
    if (!cloudSyncReady) return;
    void writeCloudState({
      leads, clients, cases, quotations, referralPartners, paymentVouchers, travelClaims,
      receipts, deadlines, invoices, payments, retainers, users, attendanceRecords,
      leaveApplications, meetings, programmes, notifications, lawFirmRegistry, sequenceCounters, deletedRecords,
      rolesMatrix, customRoles,
      timeEntries, expenses, generalLedger, logs, announcements, auditLogs,
      firmStartCentrePages, bankAccounts, trustAuditLogs, inventoryItems, bankReconciliationEntries, clientAccountChecks,
      payslips, manualJournals,
    }).catch((error) => {
      console.error('Cloud state save failed; signing out to prevent unsynced data entry.', error);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setCloudSyncReady(false);
      setIsAuthenticated(false);
    });
  }, [cloudSyncReady, leads, clients, cases, quotations, referralPartners, paymentVouchers, travelClaims, receipts, deadlines, invoices, payments, retainers, users, attendanceRecords, leaveApplications, meetings, programmes, notifications, lawFirmRegistry, sequenceCounters, deletedRecords, rolesMatrix, customRoles, timeEntries, expenses, generalLedger, logs, announcements, auditLogs, firmStartCentrePages, bankAccounts, trustAuditLogs, inventoryItems, bankReconciliationEntries, clientAccountChecks, payslips, manualJournals]);

  // ---------------------------------------------------------------------------------------
  // Owner-managed access list (practiceSystem/access)
  //
  // While the Managing Partner (verified owner) is signed in, the list is derived from the
  // real Users & Roles roster and published when it differs. The roster lives in the shared
  // document that every firm user can write, so to stop anyone granting themselves access
  // through it, only these changes publish automatically:
  //   - anything the owner changed in THIS session (add / role / admin / switch off / remove),
  //   - anything that only REDUCES access (fail-closed).
  // Other changes that GRANT access wait in Users & Roles for the owner to press Publish.
  // ---------------------------------------------------------------------------------------
  const [accessListStatus, setAccessListStatus] = useState<AccessListStatus>({ state: 'idle' });
  const [accessPublishNonce, setAccessPublishNonce] = useState(0);
  const publishedAccessRef = useRef<AccessUsers | null | undefined>(undefined);
  const ownerApprovedAccessKeys = useRef<Set<string>>(new Set());
  const accessReconcileRunning = useRef(false);
  const accessReconcileAgain = useRef<null | { publishAll: boolean }>(null);
  const usersRef = useRef(users);
  usersRef.current = users;

  const isVerifiedOwnerSession = () => {
    if (SAFE_PREVIEW_MODE) return false;
    const fu = firebaseAuth.currentUser;
    return Boolean(fu && fu.emailVerified && (fu.email || '').toLowerCase() === ACCESS_OWNER_EMAIL);
  };

  function approveAccessChange(email: string) {
    if (!email || !isVerifiedOwnerSession()) return;
    ownerApprovedAccessKeys.current.add(emailToAccessKey(email));
    setAccessPublishNonce((n) => n + 1);
  }

  const reconcileAccessList = async (opts: { publishAll?: boolean } = {}): Promise<void> => {
    if (!isVerifiedOwnerSession()) return;
    if (accessReconcileRunning.current) {
      accessReconcileAgain.current = { publishAll: Boolean(opts.publishAll || accessReconcileAgain.current?.publishAll) };
      return;
    }
    accessReconcileRunning.current = true;
    // Snapshot: approvals that arrive while this run is in flight are kept for the re-run.
    const approved = new Set(ownerApprovedAccessKeys.current);
    try {
      // Always start from what is actually published (another tab/device may have changed it).
      const published = await readAccessList();
      publishedAccessRef.current = published;
      const { users: desired, skipped } = buildAccessList(usersRef.current);
      const changes = diffAccessLists(published, desired);
      const toApply = opts.publishAll ? changes : changes.filter((c) => !c.grants || approved.has(c.key));
      const pending = changes.filter((c) => !toApply.includes(c));
      const skippedInfo = skipped.map((u) => ({ name: u.name, email: u.email, role: String(u.role) }));
      if (toApply.length > 0) {
        setAccessListStatus({ state: 'updating', pending, skipped: skippedInfo });
        const next = applyAccessChanges(published, toApply);
        await publishAccessList(next, ACCESS_OWNER_EMAIL);
        publishedAccessRef.current = next;
      }
      approved.forEach((key) => ownerApprovedAccessKeys.current.delete(key));
      const count = Object.keys(publishedAccessRef.current || {}).length;
      setAccessListStatus({
        state: pending.length ? 'review' : publishedAccessRef.current ? 'published' : 'review',
        pending,
        skipped: skippedInfo,
        count,
        at: new Date().toISOString(),
      });
    } catch (error) {
      const code = String((error as { code?: string })?.code || '');
      publishedAccessRef.current = undefined; // re-read next time
      setAccessListStatus({
        state: 'failed',
        message: code === 'permission-denied'
          ? 'Firestore refused the write — the deployed firestore.rules may be out of date, or this sign-in is not the verified Managing Partner account.'
          : error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      accessReconcileRunning.current = false;
      const again = accessReconcileAgain.current;
      accessReconcileAgain.current = null;
      if (again) void reconcileAccessList(again);
    }
  };

  const publishAccessListNow = () => reconcileAccessList({ publishAll: true });

  useEffect(() => {
    if (SAFE_PREVIEW_MODE) {
      const { users: desired } = buildAccessList(users);
      setAccessListStatus({ state: 'preview', count: Object.keys(desired).length });
      return;
    }
    if (!isAuthenticated) {
      publishedAccessRef.current = undefined;
      setAccessListStatus({ state: 'idle' });
      return;
    }
    if (!cloudSyncReady) return;
    if (!isVerifiedOwnerSession()) {
      setAccessListStatus({ state: 'not-owner' });
      return;
    }
    const immediate = ownerApprovedAccessKeys.current.size > 0;
    const timer = window.setTimeout(() => { void reconcileAccessList(); }, immediate ? 50 : 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, cloudSyncReady, users, accessPublishNonce]);

  const addActivityLog = (action: string, details: string) => {
    const newLog: ActivityLog = {
      ts: new Date().toISOString().slice(0, 16).replace('T', ' '),
      user: currentPartnerCode,
      action,
      details,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const addLead = (lead: Lead) => {
    if (!hasModulePermission('leads', 'a')) {
      showToast('Access denied: you do not have lead creation permission.');
      return;
    }

    setLeads((prev) => [lead, ...prev]);
    logAuditEvent('CREATE', 'LEADS', lead.id, lead.name, `New lead intake record logged for ${lead.name} (${lead.practiceArea}).`);
    addActivityLog('Lead Created', `${lead.name} (${lead.practiceArea})`);
    showToast('Lead recorded');
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    if (!hasModulePermission('leads', 'e')) {
      showToast('Access denied: you do not have lead edit permission.');
      return;
    }

    const target = leads.find((l) => l.id === id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    logAuditEvent('UPDATE', 'LEADS', id, target?.name || id, `Updated lead details or status.`);
    addActivityLog('Lead Updated', id);
    showToast('Lead updated');
  };

  const deleteLead = (id: string) => {
    if (!hasModulePermission('leads', 'e')) {
      showToast('Access denied: you do not have lead delete permission.');
      return;
    }

    const target = leads.find((l) => l.id === id);
    if (target) {
      trackDeletedRecord('Lead', target.name, `Lead Contact (${target.phone || target.email || 'No contact info'})`, target);
      logAuditEvent('DELETE', 'LEADS', id, target.name, `Lead record deleted and archived in Recycle Bin.`);
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    addActivityLog('Lead Deleted', id);
    showToast(`Lead "${target?.name || id}" moved to Recycle Bin.`);
  };

  const addClient = (client: Client) => {
    if (!hasModulePermission('clients', 'a')) {
      showToast('Access denied: you do not have client creation permission.');
      return;
    }

    const normalizedClient: Client = {
      ...client,
      createdAt: client.createdAt || new Date().toISOString(),
      name: normalizeClientName(client.name),
      contactPerson: client.contactPerson ? normalizeClientName(client.contactPerson) : client.contactPerson,
    };
    setClients((prev) => [normalizedClient, ...prev]);
    logAuditEvent('CREATE', 'CLIENTS', normalizedClient.id, normalizedClient.name, `New client registered: ${normalizedClient.name}.`);
    addActivityLog('Client Added', normalizedClient.name);
    showToast(`Client "${normalizedClient.name}" added to registry.`);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    if (!hasModulePermission('clients', 'e')) {
      showToast('Access denied: you do not have client edit permission.');
      return;
    }

    const target = clients.find((c) => c.id === id);
    const normalizedUpdates: Partial<Client> = {
      ...updates,
      ...(updates.name ? { name: normalizeClientName(updates.name) } : {}),
      ...(updates.contactPerson ? { contactPerson: normalizeClientName(updates.contactPerson) } : {}),
    };
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...normalizedUpdates } : c)));
    logAuditEvent('UPDATE', 'CLIENTS', id, target?.name || id, `Client record updated.`);
    showToast('Client details updated.');
  };

  const addClientPortalUpdate = (clientId: string, update: Omit<ClientPortalUpdate, 'id' | 'date'>) => {
    const portalUpdate: ClientPortalUpdate = {
      ...update,
      id: `PORTAL-${Date.now()}`,
      date: new Date().toISOString(),
    };
    setClients((prev) => prev.map((client) => (
      client.id === clientId
        ? { ...client, portalUpdates: [portalUpdate, ...(client.portalUpdates || [])] }
        : client
    )));
    addActivityLog('Client Portal Updated', `${clientId} — ${update.title}`);
  };

  const deleteClient = (id: string) => {
    if (!hasModulePermission('clients', 'e')) {
      showToast('Access denied: you do not have client delete permission.');
      return;
    }

    const clientToDelete = clients.find((c) => c.id === id);
    if (!clientToDelete) return;

    // Track in recycle bin
    trackDeletedRecord('Client', clientToDelete.name, `Client ID: ${clientToDelete.id} | Email: ${clientToDelete.email || 'N/A'}`, clientToDelete);
    logAuditEvent('DELETE', 'CLIENTS', id, clientToDelete.name, `Client record deleted and archived to Recycle Bin.`);

    // 1. Purge client record and write immediately to localStorage
    const updatedClients = clients.filter((c) => c.id !== id);
    setClients(updatedClients);
    localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(updatedClients));

    // 2. Purge associated portal user login accounts
    const clientEmail = (clientToDelete.email || '').trim().toLowerCase();
    const updatedUsers = users.filter(
      (u) =>
        !(
          u.role === 'Client' &&
          ((!!clientEmail && (u.email || '').toLowerCase() === clientEmail) || u.id === clientToDelete.id)
        )
    );
    setUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEY + '_users', JSON.stringify(sanitizeClientPasswordsForStorage(updatedUsers)));

    // 3. Log audit trail
    addActivityLog('Client Deleted & Archived', `${clientToDelete.name} (${clientToDelete.id})`);

    // 4. Logout if currently logged in as this client
    if (
      currentUser.role === 'Client' &&
      ((!!clientEmail && (currentUser.email || '').toLowerCase() === clientEmail) || currentUser.id === clientToDelete.id)
    ) {
      logoutUser();
    }

    showToast(`Client "${clientToDelete.name}" moved to Recycle Bin.`);
  };

  // Creates the client's real Firebase login (email/password, created from this browser via a
  // secondary Firebase app — see provisionFirebaseUser) and adds them to the roster, which
  // puts them on the access list as role 'client'. Firebase sends a verification email; the
  // caller shows the temporary password so the firm can pass it on privately.
  const sendClientPortalInvite = async (
    clientId: string
  ): Promise<{ success: boolean; inviteDate?: string; email?: string; tempPass?: string; error?: string; message?: string }> => {
    const fail = (error: string) => {
      showToast(error);
      return { success: false, error };
    };
    const clientObj = clients.find((c) => c.id === clientId);
    if (!clientObj) return fail('Client not found.');
    const email = (clientObj.email || '').trim().toLowerCase();
    if (!email) return fail(`Add an email address to ${clientObj.name}'s record first — it becomes their portal login.`);
    if (!(currentUser.email === 'syafiqahhamizad@shcolaw.com' || currentUser.isSuperAdmin)) {
      return fail('Only the Super Admin can create client portal logins.');
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return fail(`${email} already has a portal login.`);
    }

    try {
      const provisioned = await provisionFirebaseUser({
        name: clientObj.name,
        email,
        role: 'Client',
        isAdmin: false,
        isSuperAdmin: false,
      });
      const inviteDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setUsers((prev) => [
        ...prev,
        { id: provisioned.id, name: clientObj.name, email, role: 'Client', isAdmin: false, isSuperAdmin: false, status: 'Active' },
      ]);
      approveAccessChange(email);
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, lastPortalInviteSent: inviteDate, portalAccessEnabled: true } : c))
      );
      addActivityLog('Client Portal Login Created', `${clientObj.name} (${email})`);
      logAuditEvent('CREATE', 'CLIENTS', clientObj.id, clientObj.name, `Client Portal login created for ${email}.`);
      return { success: true, inviteDate, email, tempPass: provisioned.temporaryPassword, message: describeProvisionedAccount(provisioned, { signInWhere: 'portal.shcolaw.com → Client Access' }) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Unable to create the client portal login.');
    }
  };

  const addCase = async (caseObj: Case) => {
    if (!hasModulePermission('cases', 'a')) {
      showToast('Access denied: you do not have matter creation permission.');
      return;
    }

    let category: 'Litigation' | 'Conveyancing' | 'Criminal' | 'Corporate' = 'Corporate';
    let parentFolder = 'SHCO Practice - Corporate & Advisory';
    const lowerArea = (caseObj.type || '').toLowerCase();

    if (
      lowerArea.includes('litigation') ||
      lowerArea.includes('civil') ||
      lowerArea.includes('dispute') ||
      lowerArea.includes('court') ||
      lowerArea.includes('appeal')
    ) {
      category = 'Litigation';
      parentFolder = 'SHCO Practice - Litigation Cases';
    } else if (
      lowerArea.includes('convey') ||
      lowerArea.includes('property') ||
      lowerArea.includes('spa') ||
      lowerArea.includes('land') ||
      lowerArea.includes('tenancy')
    ) {
      category = 'Conveyancing';
      parentFolder = 'SHCO Practice - Conveyancing & Property';
    } else if (
      lowerArea.includes('criminal') ||
      lowerArea.includes('defence') ||
      lowerArea.includes('macc') ||
      lowerArea.includes('bail') ||
      lowerArea.includes('penal')
    ) {
      category = 'Criminal';
      parentFolder = 'SHCO Practice - Criminal Defence';
    }

    // Only a real folder link given on the case is kept — no placeholder folders are invented.
    const folderId = caseObj.gdriveFolderId || undefined;
    const folderUrl = caseObj.gdriveFolderUrl || undefined;

    const enhancedCase: Case = {
      ...caseObj,
      gdriveCategory: category,
      gdriveParentFolderName: parentFolder,
      gdriveFolderId: folderId,
      gdriveFolderUrl: folderUrl,
    };

    setCases((prev) => {
      const updatedCases = [enhancedCase, ...prev];
      localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify(updatedCases));

      // Unified Data Sync: Update client master records with associated matter links
      setClients((prevClients) => {
        const syncedClients = syncClientMatterLinks(updatedCases, prevClients);
        localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(syncedClients));
        return syncedClients;
      });

      return updatedCases;
    });
    logAuditEvent('CREATE', 'CASES', enhancedCase.id, `${enhancedCase.ref} — ${enhancedCase.title}`, `New matter opened under practice area: ${enhancedCase.type}.`);
    addActivityLog('Matter Opened', `${enhancedCase.ref} — ${enhancedCase.title}`);
    showToast('Matter created.');
  };

  // Changes a file's reference number (admins / Super Admin only) and re-points every record
  // that links to the file by reference, so invoices, receipts, vouchers, claims, quotations
  // and ledger lines stay attached. Old refs are kept on the case for lookup and history.
  const renameCaseRef = (caseId: string, newRefInput: string, reason: string): boolean => {
    if (!(isAdmin || currentUser.isSuperAdmin)) {
      showToast('Only an admin can change a file reference number.');
      return false;
    }
    const target = cases.find((c) => c.id === caseId);
    const newRef = newRefInput.trim().replace(/\s+/g, '');
    if (!target) return false;
    if (!newRef) { showToast('Enter the new reference number.'); return false; }
    if (!reason.trim()) { showToast('Give a reason for changing the reference.'); return false; }
    const oldRef = target.ref;
    if (newRef === oldRef) return true;
    if (cases.some((c) => c.id !== caseId && (c.ref || '').toLowerCase() === newRef.toLowerCase())) {
      showToast(`${newRef} is already used by another file.`);
      return false;
    }
    const swap = <T extends { fileRef?: string }>(list: T[]) =>
      list.map((r) => (r.fileRef === oldRef ? { ...r, fileRef: newRef } : r));
    setQuotations((prev) => swap(prev));
    setExpenses((prev) => swap(prev));
    setInvoices((prev) => swap(prev));
    setReceipts((prev) => swap(prev));
    setPaymentVouchers((prev) => swap(prev));
    setTravelClaims((prev) => swap(prev));
    setGeneralLedger((prev) => swap(prev));
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setCases((prev) => {
      const updated = prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              ref: newRef,
              previousRefs: Array.from(new Set([...(c.previousRefs || []), oldRef].filter(Boolean))),
              activityLogs: [
                { id: `CAL-${Date.now()}`, timestamp: stamp, type: 'Status Update' as const, title: 'Reference number changed', description: `${oldRef} → ${newRef} (${reason.trim()})`, actor: currentUser.name },
                ...(c.activityLogs || []),
              ],
            }
          : c
      );
      setClients((prevClients) => syncClientMatterLinks(updated, prevClients));
      return updated;
    });
    logAuditEvent('UPDATE', 'CASES', caseId, newRef, `Reference changed from ${oldRef} to ${newRef}: ${reason.trim()}`);
    showToast(`Reference changed to ${newRef}. Linked invoices, receipts, vouchers and claims updated.`);
    return true;
  };

  const updateCase = (id: string, updates: Partial<Case>) => {
    const hasCaseOverride = Boolean(currentUser.isAdmin || currentUser.isSuperAdmin);
    if (!hasCaseOverride && !hasModulePermission('cases', 'e')) {
      showToast('Access denied: you do not have matter edit permission.');
      return;
    }

    const targetCase = cases.find((c) => c.id === id);
    setCases((prev) => {
      const updatedCases = prev.map((c) => {
        if (c.id === id) {
          if (updates.nextHearing && updates.nextHearing !== c.nextHearing) {
            addNotification({
              title: 'Hearing Date Updated',
              message: `Hearing for matter ${c.ref} (${c.title}) updated to ${updates.nextHearing}.`,
              type: 'hearing',
              linkTab: 'hearings',
              linkId: c.id,
            });
          }
          return { ...c, ...updates };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify(updatedCases));
      setClients((prevClients) => {
        const syncedClients = syncClientMatterLinks(updatedCases, prevClients);
        localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(syncedClients));
        return syncedClients;
      });
      return updatedCases;
    });
    if (targetCase) {
      logAuditEvent('UPDATE', 'CASES', id, `${targetCase.ref} — ${targetCase.title}`, `Updated case record fields.`);
    }
    showToast('Case updated');
  };

  const deleteCase = (id: string) => {
    if (!hasModulePermission('cases', 'e')) {
      showToast('Access denied: you do not have matter delete permission.');
      return;
    }

    const caseToDelete = cases.find((c) => c.id === id);
    if (caseToDelete) {
      trackDeletedRecord('Case', `${caseToDelete.ref} — ${caseToDelete.title}`, `Practice Area: ${caseToDelete.type || 'N/A'} | Client: ${caseToDelete.clientName || 'N/A'}`, caseToDelete);
      logAuditEvent('DELETE', 'CASES', id, `${caseToDelete.ref} — ${caseToDelete.title}`, `Matter record deleted and moved to Recycle Bin.`);
    }
    setCases((prev) => {
      const updatedCases = prev.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify(updatedCases));
      setClients((prevClients) => {
        const syncedClients = syncClientMatterLinks(updatedCases, prevClients);
        localStorage.setItem(STORAGE_KEY + '_clients', JSON.stringify(syncedClients));
        return syncedClients;
      });
      return updatedCases;
    });
    if (caseToDelete) {
      addActivityLog('Matter File Deleted', `Deleted case ${caseToDelete.ref} — ${caseToDelete.title}`);
    }
    if (currentCaseId === id) {
      setCurrentCaseId(null);
    }
    showToast('Matter file moved to Recycle Bin');
  };

  const addCaseActivityLog = (caseId: string, log: Omit<CaseActivityLog, 'id' | 'timestamp'>) => {
    const newLogItem: CaseActivityLog = {
      ...log,
      id: `CAL-${Date.now()}`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };

    setCases((prev) => {
      const updatedCases = prev.map((c) => {
        if (c.id === caseId) {
          const existingLogs = c.activityLogs || [];
          return {
            ...c,
            activityLogs: [newLogItem, ...existingLogs],
          };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY + '_cases', JSON.stringify(updatedCases));
      return updatedCases;
    });
    showToast(`Logged activity: ${log.title}`);
  };

  const addLawFirmRegistryEntry = (entry: LawFirmRegistryEntry) => {
    setLawFirmRegistry((prev) => [entry, ...prev]);
    addActivityLog('Law Firm Registered', entry.firmName);
    showToast('Law Firm & Counsel registered');
  };

  const updateLawFirmRegistryEntry = (id: string, updates: Partial<LawFirmRegistryEntry>) => {
    setLawFirmRegistry((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    showToast('Registry entry updated');
  };

  const deleteLawFirmRegistryEntry = (id: string) => {
    setLawFirmRegistry((prev) => prev.filter((f) => f.id !== id));
    showToast('Registry entry deleted');
  };

  const addQuotation = (q: Quotation) => {
    const editedQuotation: Quotation = {
      ...q,
      lastEditedBy: q.lastEditedBy || currentUser?.name || 'System',
      lastEditedAt: q.lastEditedAt || new Date().toISOString(),
    };
    setQuotations((prev) => [editedQuotation, ...prev]);
    addActivityLog('Quotation Created', `${q.id} — RM ${q.total.toLocaleString()}`);
    showToast('Quotation created');
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    const editedUpdates: Partial<Quotation> = {
      ...updates,
      lastEditedBy: currentUser?.name || 'System',
      lastEditedAt: new Date().toISOString(),
    };
    setQuotations((prev) => prev.map((quotation) => (quotation.id === id ? { ...quotation, ...editedUpdates } : quotation)));
    addActivityLog('Quotation Updated', `${id} — ${updates.documentType || 'Quotation'} status changed`);
    showToast(`Quotation ${id} updated.`);
  };

  const addReferralPartner = (rp: ReferralPartner) => {
    setReferralPartners((prev) => [rp, ...prev]);
    addActivityLog('Referral Registered', `${rp.name} (${rp.type})`);
    showToast('Referral Partner recorded successfully');
  };

  const addTravelClaim = (tc: TravelClaim) => {
    setTravelClaims((prev) => [tc, ...prev]);
    addActivityLog('Travel Claim Submitted', `${tc.id} — RM ${tc.total}`);
    showToast('Travel claim submitted');
  };

  const updateTravelClaim = (id: string, updates: Partial<TravelClaim>) => {
    setTravelClaims((prev) => prev.map((tc) => (tc.id === id ? { ...tc, ...updates } : tc)));
    showToast('Travel claim updated');
  };

  const addReceipt = (r: Receipt) => {
    setReceipts((prev) => [r, ...prev]);
    addActivityLog('Receipt Issued', `${r.id} (${r.accountSet}) — RM ${r.amount}`);
    showToast('Official Receipt generated');
  };

  const updateReceipt = (id: string, updates: Partial<Receipt>) => {
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const addPaymentVoucher = (pv: PaymentVoucher) => {
    setPaymentVouchers((prev) => [pv, ...prev]);
    addActivityLog('Payment Voucher Created', `${pv.id} (${pv.voucherCategory}) — RM ${pv.amount}`);
    showToast('Payment Voucher created');
  };

  const updatePaymentVoucher = (id: string, updates: Partial<PaymentVoucher>) => {
    setPaymentVouchers((prev) => prev.map((pv) => (pv.id === id ? { ...pv, ...updates } : pv)));
    showToast('Payment Voucher updated');
  };

  const approvePaymentVoucher = (id: string, approvedBy: string) => {
    setPaymentVouchers((prev) =>
      prev.map((pv) => (pv.id === id ? { ...pv, approved: true, approvedBy, approvalStatus: 'Approved' } : pv))
    );
    addActivityLog('PV Approved', `${id} approved by ${approvedBy}`);
    showToast('Payment Voucher Approved');
  };

  const addRetainer = (r: Retainer) => {
    setRetainers((prev) => [r, ...prev]);
    addActivityLog('Trust Transaction', `${r.type} — RM ${r.amount}`);
    showToast('Trust transaction recorded');
  };

  const addInvoice = (inv: Invoice) => {
    setInvoices((prev) => [inv, ...prev]);
    addActivityLog('Invoice Created', `${inv.id} — RM ${inv.total}`);
    showToast('Invoice created');
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const target = invoices.find((invoice) => invoice.id === id);
    if (!target || target.status === 'Paid' || target.status === 'Voided') {
      showToast('Paid or voided invoices cannot be edited.');
      return;
    }
    setInvoices((prev) => prev.map((invoice) => (invoice.id === id ? { ...invoice, ...updates } : invoice)));
    addActivityLog('Invoice Updated', `${id} — ${updates.total ?? target.total}`);
    showToast(`Invoice ${id} updated`);
  };

  const addPayment = (p: Payment) => {
    setPayments((prev) => [p, ...prev]);
    setInvoices((prevInvs) => prevInvs.map((inv) => {
      if (inv.id !== p.invoiceId) return inv;
      const collected = payments
        .filter((payment) => payment.invoiceId === p.invoiceId)
        .reduce((sum, payment) => sum + payment.amount, 0) + p.amount;
      const status = collected >= inv.total ? 'Paid' : collected > 0 ? 'Partial' : 'Unpaid';
      return { ...inv, status };
    }));
    addNotification({
      title: 'Invoice Payment Verified & Marked Paid',
      message: `Tax Invoice ${p.invoiceId} (RM ${p.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}) has been marked as PAID by Finance.`,
      type: 'invoice',
      linkTab: 'billing',
      linkId: p.invoiceId,
    });
    addActivityLog('Payment Recorded', `${p.id} against ${p.invoiceId}`);
    showToast('Payment recorded & invoice updated');
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    showToast('Payment updated');
  };

  const deletePayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
    // Revert invoice back to unpaid if this was its last recorded payment
    if (target) {
      const hasOtherPayments = payments.some((p) => p.invoiceId === target.invoiceId && p.id !== id);
      if (!hasOtherPayments) {
        setInvoices((prev) => prev.map((inv) => (inv.id === target.invoiceId && inv.status === 'Paid' ? { ...inv, status: 'Unpaid' } : inv)));
      }
    }
    showToast('Payment removed');
  };

  const addTimeEntry = (te: TimeEntry) => {
    setTimeEntries((prev) => [te, ...prev]);
    showToast('Time entry logged');
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    setTimeEntries((prev) => prev.map((te) => (te.id === id ? { ...te, ...updates } : te)));
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries((prev) => prev.filter((te) => te.id !== id));
    showToast('Time entry removed');
  };

  const addExpense = (ex: Expense) => {
    setExpenses((prev) => [ex, ...prev]);
    showToast('Expense logged');
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex)));
    showToast('Expense updated');
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((ex) => ex.id !== id));
    showToast('Expense record removed');
  };

  const addGeneralLedgerEntry = (entry: Omit<GeneralLedgerEntry, 'glNo'> | GeneralLedgerEntry) => {
    const nextGlNo = generalLedger.length > 0 ? Math.max(...generalLedger.map((g) => g.glNo)) + 1 : 1001;
    const newEntry: GeneralLedgerEntry = {
      glNo: 'glNo' in entry && typeof entry.glNo === 'number' ? entry.glNo : nextGlNo,
      ...entry,
    };
    setGeneralLedger((prev) => [newEntry, ...prev]);
    addActivityLog('GL Entry Posted', `GL #${newEntry.glNo} [${newEntry.docType} ${newEntry.docNo}] — RM ${newEntry.amount}`);
    showToast(`Posted to General Ledger (GL #${newEntry.glNo})`);
  };

  const addPayslip = (p: Payslip) => {
    setPayslips((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    addActivityLog('Payslip Created', `${p.id} (${p.period})`);
  };

  const updatePayslip = (id: string, updates: Partial<Payslip>) => {
    setPayslips((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const PAYSLIP_FLOW: Payslip['status'][] = ['Draft', 'Checked', 'Approved', 'Paid'];
  const advancePayslipStatus = (ids: string[]) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setPayslips((prev) => prev.map((p) => {
      if (!idSet.has(p.id)) return p;
      const i = PAYSLIP_FLOW.indexOf(p.status);
      if (i < 0 || i >= PAYSLIP_FLOW.length - 1) return p;
      const next = PAYSLIP_FLOW[i + 1];
      return next === 'Paid' ? { ...p, status: next, paidAt: now } : { ...p, status: next };
    }));
    addActivityLog('Payroll Status Changed', `${ids.length} payslip(s) moved to the next step`);
  };

  const addManualJournal = (j: ManualJournal) => {
    setManualJournals((prev) => [j, ...prev]);
    addActivityLog('Manual Journal Prepared', `${j.id} — RM ${j.amount} (${j.account}) · sent to Approvals`);
  };

  const updateManualJournal = (id: string, updates: Partial<ManualJournal>) => {
    setManualJournals((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  const addDeadline = (d: Deadline) => {
    setDeadlines((prev) => {
      // Upsert: tasks re-sync their linked deadline entry on every due-date edit instead of duplicating it
      const exists = prev.some((existing) => existing.id === d.id);
      return exists ? prev.map((existing) => (existing.id === d.id ? d : existing)) : [d, ...prev];
    });
    showToast('Deadline added');
  };





  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isUserPreview: Boolean(previewOrigin.current),
        previewUserId,
        startUserPreview,
        exitUserPreview,
        firmStartCentreEditMode,
        setFirmStartCentreEditMode,
        isAuthenticated,
        setIsAuthenticated,
        currentRole,
        setCurrentRole,
        currentPartnerCode,
        setCurrentPartnerCode,
        isAdmin,
        setIsAdmin,
        isOAuthConnected,
        setIsOAuthConnected,
        currentView,
        setCurrentView,
        currentCaseId,
        setCurrentCaseId,
        caseSubTab,
        setCaseSubTab,
        globalSearch,
        setGlobalSearch,
        isNewCaseModalOpen,
        setIsNewCaseModalOpen,
        newCasePrefill,
        setNewCasePrefill,
        openNewCaseWithPrefill,
        isRegisterClientModalOpen,
        setIsRegisterClientModalOpen,
        toastMessage,
        showToast,
        assignmentToastData,
        showAssignmentSuccessToast,
        theme,
        setTheme,
        loginWithGoogleSSO,
        loginClientPassword,
        loginExternalUser,
        logoutUser,
        updateUserRoleAndAdmin,
        accessListStatus,
        publishAccessListNow,
        cloudAccessNotice,
        retryCloudSync,
        addUser,
        deleteUser,
        updateUserStaffProfile,
        updateUserIdentity,
        addStaffGoal,
        updateStaffGoal,
        addAttendanceRecord,
        addLeaveApplication,
        updateLeaveApplication,
        addMeeting,
        updateMeeting,
        deleteMeeting,
        addProgramme,
        updateProgramme,
        deleteProgramme,
        canViewModule,
        updateRolePermission,
        customRoles,
        addCustomRole,
        updateUserNavOverride,
        setRoleModulePermissions,
        setUserNavOverride,
        resetUserNavOverrides,
        updateUserAccount,
        leads,
        clients,
        cases,
        quotations,
        quoteTemplates,
        referralPartners,
        officeBuckets,
        chartOfAccounts,
        travelClaims,
        receipts,
        paymentVouchers,
        generalLedger,
        trialBalance,
        cashFlowOffice,
        threeWayRec,
        docTemplates,
        deadlines,
        timeEntries,
        expenses,
        invoices,
        payments,
        retainers,
        users,
        attendanceRecords,
        leaveApplications,
        meetings,
        programmes,
        logs,
        rolesMatrix,
        lawFirmRegistry,
        bankAccounts,
        trustAuditLogs,
        inventoryItems,
        bankReconciliationEntries,
        clientAccountChecks,
        toggleClientAccountCheck,
        payslips,
        addPayslip,
        updatePayslip,
        advancePayslipStatus,
        manualJournals,
        addManualJournal,
        updateManualJournal,
        deletedRecords,
        restoreDeletedRecord,
        purgeDeletedRecordPermanently,
        emptyTrashRecycleBin,
        auditLogs,
        logAuditEvent,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNotification,
        announcements,
        addAnnouncement,
        deleteAnnouncement,
        firmStartCentrePages,
        canEditFirmStartCentre: canEditStartCentre(),
        addStartCentrePage,
        updateStartCentrePageLabel,
        deleteStartCentrePage,
        addStartCentreCard,
        updateStartCentreCard,
        deleteStartCentreCard,
        resetClientPassword,
        addBankAccount,
        updateBankAccount,
        archiveBankAccount,
        addTrustAuditLog,
        addInventoryItem,
        updateInventoryItem,
        toggleReconcileEntry,
        toggleComplianceItem,
        updateComplianceItem,
        addComplianceItem,
        addComplaint,
        updateComplaint,
        updateDirectionStatement,
        updatePartnersNotes,
        addMilestone,
        updateMilestone,
        cycleMilestoneStatus,
        addFirmGoal,
        updateFirmGoal,
        removeFirmGoal,
        addPanelship,
        updatePanelship,
        removePanelship,
        addInvestmentChannel,
        updateInvestmentChannel,
        removeInvestmentChannel,
        addLead,
        updateLead,
        deleteLead,
        addClient,
        updateClient,
        addClientPortalUpdate,
        deleteClient,
        sendClientPortalInvite,
        addCase,
        updateCase,
        renameCaseRef,
        deleteCase,
        addCaseActivityLog,
        addLawFirmRegistryEntry,
        updateLawFirmRegistryEntry,
        deleteLawFirmRegistryEntry,
        addQuotation,
        updateQuotation,
        addReferralPartner,
        addTravelClaim,
        updateTravelClaim,
        addReceipt,
        updateReceipt,
        addPaymentVoucher,
        updatePaymentVoucher,
        approvePaymentVoucher,
        addRetainer,
        addInvoice,
        updateInvoice,
        addPayment,
        updatePayment,
        deletePayment,
        addTimeEntry,
        updateTimeEntry,
        deleteTimeEntry,
        addExpense,
        updateExpense,
        deleteExpense,
        addGeneralLedgerEntry,
        addDeadline,
        addActivityLog,
        sequenceCounters,
        getNextSequenceId,
        incrementSequenceCounter,
        resetSequenceCounters,
        factoryResetSystem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
