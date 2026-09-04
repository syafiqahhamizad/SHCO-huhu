import { readCloudState, subscribeToCloudState, writeCloudState, type CloudState } from '../services/firestoreSyncService';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { normalizeClientName } from '../lib/stringUtils';
import { generateNextMatterSequenceNumber, syncClientMatterLinks } from '../services/matterService';
import {
  Role,
  PartnerCode,
  Lead,
  Client,
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
  Court,
  Judge,
  TimeEntry,
  Expense,
  Invoice,
  Payment,
  Retainer,
  User,
  ActivityLog,
  RolePermissionsMatrix,
  LawFirmRegistryEntry,
  NotificationItem,
  BankAccount,
  TrustAuditLog,
  InventoryItem,
  BankReconciliationEntry,
  SequenceCounters,
  ThemePreference,
  DeletedRecord,
  AuditLogEntry,
  AttendanceRecord,
  LeaveApplication,
  FirmAnnouncement,
} from '../types';
import {
  getCurrentFirebaseAccessClaims,
  getCurrentFirebaseClaims,
  getFirebaseAuthErrorMessage,
  signInClientWithPassword,
  signInExternalWithPassword,
  signInStaffWithGoogle,
  signOutFromFirebase,
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
  INITIAL_COURTS,
  INITIAL_JUDGES,
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
} from '../data/initialData';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
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
  addUser: (newUser: User) => boolean;
  deleteUser: (userId: string) => boolean;
  updateUserStaffProfile: (userId: string, profile: User['staffProfile']) => void;
  addAttendanceRecord: (record: AttendanceRecord) => void;
  addLeaveApplication: (application: LeaveApplication) => void;
  updateLeaveApplication: (id: string, updates: Partial<LeaveApplication>) => void;
  canViewModule: (viewId: string) => boolean;
  updateRolePermission: (role: Role, moduleKey: string, action: 'v' | 'a' | 'e', value: number) => void;
  customRoles: string[];
  addCustomRole: (roleName: string) => boolean;
  updateUserNavOverride: (userId: string, moduleKey: string, action: 'v' | 'a' | 'e', value: number) => void;

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
  courts: Court[];
  judges: Judge[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  invoices: Invoice[];
  payments: Payment[];
  retainers: Retainer[];
  users: User[];
  attendanceRecords: AttendanceRecord[];
  leaveApplications: LeaveApplication[];
  logs: ActivityLog[];
  rolesMatrix: RolePermissionsMatrix;
  lawFirmRegistry: LawFirmRegistryEntry[];
  bankAccounts: BankAccount[];
  trustAuditLogs: TrustAuditLog[];
  inventoryItems: InventoryItem[];
  bankReconciliationEntries: BankReconciliationEntry[];
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

  isNewCaseModalOpen: boolean;
  setIsNewCaseModalOpen: (open: boolean) => void;
  newCasePrefill: NewCasePrefill | null;
  setNewCasePrefill: (prefill: NewCasePrefill | null) => void;
  openNewCaseWithPrefill: (prefill: NewCasePrefill) => void;

  isRegisterClientModalOpen: boolean;
  setIsRegisterClientModalOpen: (open: boolean) => void;

  // Actions
  resetClientPassword: (clientIdentifier: string, newPass: string) => { success: boolean; message: string };
  redeemInvitation: (codeOrEmail: string, newPasswordInput: string) => { success: boolean; message: string };
  addBankAccount: (acc: Omit<BankAccount, 'id'>) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  archiveBankAccount: (id: string) => void;
  addTrustAuditLog: (entry: Omit<TrustAuditLog, 'id' | 'timestamp'>) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  toggleReconcileEntry: (id: string) => void;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  sendClientPortalInvite: (clientId: string) => { success: boolean; inviteDate: string; tempPass: string };
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
  getNextSequenceId: (type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead') => string;
  incrementSequenceCounter: (type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead') => void;
  resetSequenceCounters: () => void;
  factoryResetSystem: () => Promise<void>;
  resetAllData: () => void;
  clearAllDataToBlank: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'SHCO_PRACTICE_SYSTEM_DATA_V1';
const SESSION_STORAGE_KEY = 'SHCO_PRACTICE_SYSTEM_SESSION_V1';

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

  // Synchronize document theme class for accessibility and dark mode support
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
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
      currentUser,
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

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    readStored(STORAGE_KEY + '_attendance', [])
  );
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>(() =>
    readStored(STORAGE_KEY + '_leaveApplications', [])
  );

  // SSO Login for Firm Staff - STRICTLY @shcolaw.com
  const loginWithGoogleSSO = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const firebaseUser = await signInStaffWithGoogle();
      const access = await getCurrentFirebaseAccessClaims(firebaseUser);
      const email = access.email || firebaseUser.email?.toLowerCase() || '';
      const claimRole = normalizeRoleClaim(String(access.role || 'Partner'));
      const existingUser = users.find((u) => u.email.toLowerCase() === email);
      const signedInUser: User = {
        ...(existingUser || {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
          email,
          status: 'Active',
        }),
        id: existingUser?.id || firebaseUser.uid,
        name: existingUser?.name || firebaseUser.displayName || email.split('@')[0].replace('.', ' '),
        email,
        role: existingUser?.role || claimRole,
        isAdmin: Boolean(existingUser ? existingUser.isAdmin || access.isAdmin : access.isAdmin),
        isSuperAdmin: Boolean(existingUser ? existingUser.isSuperAdmin || access.isSuperAdmin : access.isSuperAdmin),
        status: 'Active',
      };

      if (!existingUser) setUsers((prev) => [...prev, signedInUser]);
      setCurrentUser(signedInUser);
      setCurrentRole(signedInUser.role);
      setIsAdmin(Boolean(signedInUser.isAdmin));
      setIsAuthenticated(true);
      setCurrentView('firmStartCentre');
      showToast(`Welcome back, ${signedInUser.name}.`);
      return { success: true };
    } catch (error) {
      const errorMsg = getFirebaseAuthErrorMessage(error);
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  // Client Password Login - Login to Client Portal
  const loginClientPassword = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim().toLowerCase();
    const matchedUser = users.find((u) => u.role === 'Client' && u.email.toLowerCase() === email);
    const matchedClient = clients.find(
      (c) => c.email.toLowerCase() === email || c.id.toLowerCase() === email
    );

    if (!matchedClient && !matchedUser) {
      const errorMsg = 'Use a registered client email address or Client ID for portal access.';
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const firebaseUser = await signInClientWithPassword(email, passwordInput);
      const access = await getCurrentFirebaseAccessClaims(firebaseUser);
      const claimRole = normalizeRoleClaim(String(access.role || 'Client'));

      if (claimRole !== 'Client') {
        throw new Error('This account is not configured for client portal access.');
      }

      const clientName = matchedUser?.name || matchedClient?.name || 'Valued Client';
      const clientEmail = matchedUser?.email || matchedClient?.email || email;
      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

      if (matchedClient) {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id === matchedClient.id || c.email.toLowerCase() === email) {
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

      const clientSessionUser: User = matchedUser || {
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

  const loginExternalUser = async (emailInput: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim().toLowerCase();
    const approvedUser = users.find(
      (user) => user.email.toLowerCase() === email && (user.role === 'Reviewer' || user.role === 'Assistant') && user.status === 'Active'
    );

    if (!approvedUser) {
      const errorMsg = 'This external account is not approved. Ask a firm administrator to create an active Reviewer or Assistant account first.';
      showToast(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      await signInExternalWithPassword(email, passwordInput);
      const claims = await getCurrentFirebaseClaims();
      const approvedEmail = (approvedUser.email || '').toLowerCase();
      const adminEmails = normalizeClaimEmailList(claims.adminEmails);
      const superAdminEmails = normalizeClaimEmailList(claims.superAdminEmails);
      const claimRole = normalizeRoleClaim(String(claims.role || approvedUser.role));
      const effectiveUser = {
        ...approvedUser,
        role: claimRole,
        isAdmin: Boolean(claims.admin || approvedUser.isAdmin) && (adminEmails.includes(approvedEmail) || superAdminEmails.includes(approvedEmail)),
        isSuperAdmin: Boolean(claims.superAdmin || approvedUser.isSuperAdmin) && superAdminEmails.includes(approvedEmail),
      };

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

  const redeemInvitation = (codeOrEmail: string, newPasswordInput: string): { success: boolean; message: string } => {
    const term = codeOrEmail.trim().toLowerCase();
    const userMatch = users.find(
      (u) => u.email.toLowerCase() === term || u.id.toLowerCase() === term || u.name.toLowerCase().includes(term)
    );
    const clientMatch = clients.find(
      (c) => c.email.toLowerCase() === term || c.id.toLowerCase() === term || c.name.toLowerCase().includes(term)
    );

    if (!userMatch && !clientMatch) {
      return { success: false, message: 'Invalid or expired invitation token or email address.' };
    }

    if (userMatch) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userMatch.id ? { ...u, status: 'Active', clientPassword: newPasswordInput } : u))
      );
      setCurrentUser({ ...userMatch, status: 'Active', clientPassword: newPasswordInput });
      setCurrentRole(userMatch.role);
      setIsAdmin(userMatch.isAdmin);
      setIsAuthenticated(true);
      setCurrentView(userMatch.role === 'Client' ? 'clientPortal' : 'firmStartCentre');
      showToast(`Invitation redeemed! Welcome, ${userMatch.name}.`);
      return { success: true, message: `Welcome ${userMatch.name}! Your account password has been activated.` };
    }

    if (clientMatch) {
      const clientUser: User = {
        id: clientMatch.id,
        name: clientMatch.name,
        email: clientMatch.email || `${clientMatch.id.toLowerCase()}@client.shcolaw.com`,
        role: 'Client',
        isAdmin: false,
        isSuperAdmin: false,
        status: 'Active',
        clientPassword: newPasswordInput,
      };
      setUsers((prev) => [...prev, clientUser]);
      setCurrentUser(clientUser);
      setCurrentRole('Client');
      setIsAdmin(false);
      setIsAuthenticated(true);
      setCurrentView('clientPortal');
      showToast(`Invitation redeemed! Welcome to Client Portal, ${clientMatch.name}.`);
      return { success: true, message: `Welcome ${clientMatch.name}! Your Client Portal account is active.` };
    }

    return { success: false, message: 'Unable to process invitation redemption.' };
  };

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

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) {
          return {
            ...u,
            role: newRole,
            isAdmin: newIsAdmin,
            isSuperAdmin: newIsSuperAdmin !== undefined ? newIsSuperAdmin : u.isSuperAdmin,
          };
        }
        return u;
      })
    );

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
    logAuditEvent('DELETE', 'USERS', target.id, target.name, 'User account removed by Super Admin.');
    addActivityLog('User Removed', `${target.name} (${target.email})`);
    showToast(`User ${target.name} removed.`);
    return true;
  };

  const updateUserStaffProfile = (userId: string, profile: User['staffProfile']) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, staffProfile: profile } : user)));
    if (userId === currentUser.id) setCurrentUser((prev) => ({ ...prev, staffProfile: profile }));
    logAuditEvent('UPDATE', 'USERS', userId, profile?.staffId || userId, 'Staff profile updated.');
    showToast('Staff profile saved.');
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

  // Load state from localStorage if available
  const [leads, setLeads] = useState<Lead[]>(() => {
    return readStored(STORAGE_KEY + '_leads', INITIAL_LEADS);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_clients');
    const baseClients: Client[] = saved ? (() => {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CLIENTS;
      }
    })() : INITIAL_CLIENTS;

    return baseClients.map((c) => ({
      ...c,
      name: normalizeClientName(c.name),
      contactPerson: c.contactPerson ? normalizeClientName(c.contactPerson) : c.contactPerson,
    }));
  });

  const [cases, setCases] = useState<Case[]>(() => {
    return readStored(STORAGE_KEY + '_cases', INITIAL_CASES);
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    return readStored(STORAGE_KEY + '_quotations', INITIAL_QUOTATIONS);
  });

  const [quoteTemplates] = useState<QuoteTemplate[]>(INITIAL_QUOTE_TEMPLATES);
  const [referralPartners, setReferralPartners] = useState<ReferralPartner[]>(() => {
    return readStored(STORAGE_KEY + '_referrals', INITIAL_REFERRALS);
  });
  const [officeBuckets] = useState<OfficeBucket[]>(INITIAL_OFFICE_BUCKETS);
  const [chartOfAccounts] = useState<ChartOfAccount[]>(INITIAL_CHART_OF_ACCOUNTS);

  const [travelClaims, setTravelClaims] = useState<TravelClaim[]>(() => {
    return readStored(STORAGE_KEY + '_travelClaims', INITIAL_TRAVEL_CLAIMS);
  });

  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    return readStored(STORAGE_KEY + '_receipts', INITIAL_RECEIPTS);
  });

  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>(() => {
    return readStored(STORAGE_KEY + '_paymentVouchers', INITIAL_PAYMENT_VOUCHERS);
  });

  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerEntry[]>(INITIAL_GENERAL_LEDGER);
  const [trialBalance] = useState<TrialBalanceRow[]>(INITIAL_TRIAL_BALANCE);
  const [cashFlowOffice] = useState<CashFlowRow[]>(INITIAL_CASH_FLOW);
  const [threeWayRec] = useState<ThreeWayRecRow[]>(INITIAL_3WAY_REC);
  const [docTemplates] = useState<DocTemplate[]>(INITIAL_DOC_TEMPLATES);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return readStored(STORAGE_KEY + '_notifications', [
          {
            id: 'NOTIF-101',
            title: 'Upcoming Hearing Alert',
            message: 'High Court Trial for Kapal Mewah Sdn Bhd (Ref: SHC/LIT/KAPAL009/2025) is scheduled for 18.08.2026 before YA Dato\' Azman.',
            type: 'hearing',
            timestamp: '2026-08-11 09:30',
            read: false,
            linkTab: 'hearings',
            linkId: 'LIT-002',
          },
          {
            id: 'NOTIF-102',
            title: 'Invoice Marked as Paid',
            message: 'Tax Invoice INV-2026-003 for Encik Farid Iskandar (RM 18,500.00) has been verified and marked as PAID by Finance.',
            type: 'invoice',
            timestamp: '2026-08-11 11:15',
            read: false,
            linkTab: 'invoices',
            linkId: 'INV-2026-003',
          },
          {
            id: 'NOTIF-103',
            title: 'Approaching Hearing Date',
            message: 'Case Management for Tan Ah Kow (Ref: SHC/LIT/TAN001/2026) scheduled on 22.08.2026 at Shah Alam High Court 4.',
            type: 'hearing',
            timestamp: '2026-08-10 16:45',
            read: true,
            linkTab: 'hearings',
            linkId: 'LIT-001',
          },
        ]);
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
    return [
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
    ];
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
    const canPublish = currentUser.isSuperAdmin || currentUser.isAdmin || currentRole === 'Partner';
    if (!canPublish) {
      showToast('Only Partners and Super Admin can publish firm announcements.');
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
    return readStored(STORAGE_KEY + '_deadlines', INITIAL_DEADLINES);
  });

  const [courts] = useState<Court[]>(INITIAL_COURTS);
  const [judges] = useState<Judge[]>(INITIAL_JUDGES);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(INITIAL_TIME_ENTRIES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    return readStored(STORAGE_KEY + '_invoices', INITIAL_INVOICES);
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    return readStored(STORAGE_KEY + '_payments', INITIAL_PAYMENTS);
  });

  const [retainers, setRetainers] = useState<Retainer[]>(() => {
    return readStored(STORAGE_KEY + '_retainers', INITIAL_RETAINERS);
  });

  const [logs, setLogs] = useState<ActivityLog[]>(INITIAL_LOGS);
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
    });
    return storedCounters.caseSeq >= 1000 ? { ...storedCounters, caseSeq: 1 } : storedCounters;
  });

  const [cloudSyncReady, setCloudSyncReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_sequenceCounters', JSON.stringify(sequenceCounters));
  }, [sequenceCounters]);

  const getNextSequenceId = (
    type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead'
  ): string => {
    const key = (type + 'Seq') as keyof SequenceCounters;
    const current = sequenceCounters[key] || 0;
    const nextNum = current === 0 ? 1 : current;
    switch (type) {
      case 'invoice':
        return `INV-2026-${String(nextNum).padStart(4, '0')}`;
      case 'quotation':
        return `QUOT-2026-${String(nextNum).padStart(4, '0')}`;
      case 'case': {
        const registeredCases = cases.filter((caseRecord) => caseRecord.id.startsWith('CASE-'));
        return generateNextMatterSequenceNumber(registeredCases, 1);
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
      default:
        return String(nextNum);
    }
  };

  const incrementSequenceCounter = (
    type: 'invoice' | 'quotation' | 'case' | 'receipt' | 'voucher' | 'claim' | 'client' | 'lead'
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
    partnerDashboard: 'dashboard',
    clientPortal: 'clientPortal',
    leads: 'leads',
    clients: 'clients',
    cases: 'cases',
    documents: 'cases',
    hearings: 'cases',
    calendar: 'cases',
    caseStatus: 'cases',
    deadlines: 'cases',
    courts: 'cases',
    lawFirmRegistry: 'cases',
    referral: 'cases',
    fileClosing: 'cases',
    predispute: 'predispute',
    counselRegistry: 'counselRegistry',
    templates: 'templates',
    accountingCentre: 'finance',
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
    about: 'settings',
    account: 'settings',
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

  const isSensitiveAdminModule = (moduleKey: string): boolean => {
    return ['retainers', 'settings', 'users', 'logs'].includes(moduleKey);
  };

  const isSyafiqahOnlyModule = (moduleKey: string): boolean => {
    return ['retainers', 'courts'].includes(moduleKey);
  };

  const isSyafiqahSuperAdmin = currentUser.name.trim().toLowerCase() === 'syafiqah hamizad';

  const canViewModule = (viewId: string): boolean => {
    // Effective active role perspective
    const effectiveRole: Role = currentRole || currentUser.role || 'Partner';
    const moduleKey = VIEW_TO_MODULE_MAP[viewId] || 'dashboard';

    // Client role is strictly restricted to clientPortal
    if (effectiveRole === 'Client') {
      return viewId === 'clientPortal';
    }

    if (isSyafiqahOnlyModule(moduleKey) && !isSyafiqahSuperAdmin) {
      return false;
    }

    if (viewId === 'staffPortal' || viewId === 'staff-portal') {
      return true;
    }

    if (isSensitiveAdminModule(moduleKey)) {
      const isAuthorizedAdmin = Boolean(currentUser.isSuperAdmin || currentUser.isAdmin || currentRole === 'Partner' || currentUser.role === 'Partner');
      if (!isAuthorizedAdmin) return false;
    }

    // If logged in user is Super Admin / Admin AND current active role perspective is Partner, allow full firm access
    if ((currentUser.isSuperAdmin || currentUser.isAdmin) && effectiveRole === 'Partner') {
      return true;
    }

    // 1. Check explicit user navigation overrides first if set for current user
    if (currentUser?.navOverrides && currentUser.navOverrides[viewId]) {
      return currentUser.navOverrides[viewId].v === 1;
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

    if (isSyafiqahOnlyModule(moduleKey) && !isSyafiqahSuperAdmin) {
      return false;
    }

    if (isSensitiveAdminModule(moduleKey)) {
      const isAuthorizedAdmin = Boolean(currentUser.isSuperAdmin || currentUser.isAdmin || currentRole === 'Partner' || currentUser.role === 'Partner');
      if (!isAuthorizedAdmin) return false;
    }

    if ((currentUser.isSuperAdmin || currentUser.isAdmin) && effectiveRole === 'Partner') {
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
    localStorage.setItem(STORAGE_KEY + '_rolesMatrix', JSON.stringify(rolesMatrix));
  }, [rolesMatrix]);

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
    if (!isAuthenticated) return;

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
      if (Array.isArray(state.notifications)) setNotifications(state.notifications as NotificationItem[]);
      if (Array.isArray(state.lawFirmRegistry)) setLawFirmRegistry((state.lawFirmRegistry as LawFirmRegistryEntry[]).filter((firm) => isActive('Law Firm', firm)));
      if (state.sequenceCounters && typeof state.sequenceCounters === 'object') setSequenceCounters(state.sequenceCounters as SequenceCounters);
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
            leaveApplications, notifications, lawFirmRegistry, sequenceCounters, deletedRecords,
          });
        }

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
        console.error('Cloud state unavailable; signing out to prevent local-only data entry.', error);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setCloudSyncReady(false);
        setIsAuthenticated(false);
      }
    };

    void sync();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!cloudSyncReady) return;
    void writeCloudState({
      leads, clients, cases, quotations, referralPartners, paymentVouchers, travelClaims,
      receipts, deadlines, invoices, payments, retainers, users, attendanceRecords,
      leaveApplications, notifications, lawFirmRegistry, sequenceCounters, deletedRecords,
    }).catch((error) => {
      console.error('Cloud state save failed; signing out to prevent unsynced data entry.', error);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setCloudSyncReady(false);
      setIsAuthenticated(false);
    });
  }, [cloudSyncReady, leads, clients, cases, quotations, referralPartners, paymentVouchers, travelClaims, receipts, deadlines, invoices, payments, retainers, users, attendanceRecords, leaveApplications, notifications, lawFirmRegistry, sequenceCounters, deletedRecords]);

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
    const updatedUsers = users.filter(
      (u) =>
        !(
          u.role === 'Client' &&
          (u.email.toLowerCase() === clientToDelete.email.toLowerCase() || u.id === clientToDelete.id)
        )
    );
    setUsers(updatedUsers);
    localStorage.setItem(STORAGE_KEY + '_users', JSON.stringify(sanitizeClientPasswordsForStorage(updatedUsers)));

    // 3. Log audit trail
    addActivityLog('Client Deleted & Archived', `${clientToDelete.name} (${clientToDelete.id})`);

    // 4. Logout if currently logged in as this client
    if (
      currentUser.role === 'Client' &&
      (currentUser.email.toLowerCase() === clientToDelete.email.toLowerCase() || currentUser.id === clientToDelete.id)
    ) {
      logoutUser();
    }

    showToast(`Client "${clientToDelete.name}" moved to Recycle Bin.`);
  };

  const sendClientPortalInvite = (clientId: string) => {
    const inviteDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const tempPass = 'shcolaw2026';

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          return {
            ...c,
            lastPortalInviteSent: inviteDate,
            portalAccessEnabled: true,
          };
        }
        return c;
      })
    );

    const clientObj = clients.find((c) => c.id === clientId);
    if (clientObj) {
      addActivityLog(
        'Portal Invitation Sent',
        `Sent automated Client Portal login invite email to ${clientObj.name} (${clientObj.email || 'Client Email'})`
      );
      showToast(`Client Portal email invitation sent to ${clientObj.email || clientObj.name}!`);
    }

    return { success: true, inviteDate, tempPass };
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

    const defaultDriveUrl = category === 'Litigation'
      ? 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link'
      : `https://drive.google.com/drive/folders/gdrive_${category.toLowerCase()}_master`;

    const folderId = caseObj.gdriveFolderId || (category === 'Litigation' ? '1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h' : `gdrive_${category.toLowerCase()}_${Date.now()}`);
    const folderUrl = caseObj.gdriveFolderUrl || defaultDriveUrl;

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
    addActivityLog('Matter Opened', `${enhancedCase.ref} — ${enhancedCase.title} [Google Drive: ${category} Folder]`);
    showToast(`Matter created & linked to Google Drive (${category} Folder)`);

    try {
      fetch('/api/drive/create-case-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseRef: enhancedCase.ref,
          caseTitle: enhancedCase.title,
          practiceArea: enhancedCase.type,
        }),
      }).catch((e) => console.log('Backend sync non-blocking error:', e));
    } catch (e) {
      // Non-blocking
    }
  };

  const updateCase = (id: string, updates: Partial<Case>) => {
    if (!hasModulePermission('cases', 'e')) {
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
    setQuotations((prev) => [q, ...prev]);
    addActivityLog('Quotation Created', `${q.id} — RM ${q.total.toLocaleString()}`);
    showToast('Quotation created');
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    setQuotations((prev) => prev.map((quotation) => (quotation.id === id ? { ...quotation, ...updates } : quotation)));
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
    // Auto mark invoice paid if fully covered
    setInvoices((prevInvs) =>
      prevInvs.map((inv) => (inv.id === p.invoiceId ? { ...inv, status: 'Paid' } : inv))
    );
    addNotification({
      title: 'Invoice Payment Verified & Marked Paid',
      message: `Tax Invoice ${p.invoiceId} (RM ${p.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}) has been marked as PAID by Finance.`,
      type: 'invoice',
      linkTab: 'invoices',
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

  const addDeadline = (d: Deadline) => {
    setDeadlines((prev) => {
      // Upsert: tasks re-sync their linked deadline entry on every due-date edit instead of duplicating it
      const exists = prev.some((existing) => existing.id === d.id);
      return exists ? prev.map((existing) => (existing.id === d.id ? d : existing)) : [d, ...prev];
    });
    showToast('Deadline added');
  };

  const resetAllData = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_KEY)) localStorage.removeItem(key);
    });
    setLeads(INITIAL_LEADS);
    setClients(INITIAL_CLIENTS);
    setCases(INITIAL_CASES);
    setQuotations(INITIAL_QUOTATIONS);
    setTravelClaims(INITIAL_TRAVEL_CLAIMS);
    setReceipts(INITIAL_RECEIPTS);
    setPaymentVouchers(INITIAL_PAYMENT_VOUCHERS);
    setGeneralLedger(INITIAL_GENERAL_LEDGER);
    setDeadlines(INITIAL_DEADLINES);
    setTimeEntries(INITIAL_TIME_ENTRIES);
    setExpenses(INITIAL_EXPENSES);
    setInvoices(INITIAL_INVOICES);
    setPayments(INITIAL_PAYMENTS);
    setRetainers(INITIAL_RETAINERS);
    setLawFirmRegistry(INITIAL_LAW_FIRM_REGISTRY);
    setAttendanceRecords([]);
    setLeaveApplications([]);
    setLogs(INITIAL_LOGS);
    showToast('System data reset to initial benchmark state');
  };

  const clearAllDataToBlank = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_KEY)) localStorage.removeItem(key);
    });
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
    setAttendanceRecords([]);
    setLeaveApplications([]);
    setLogs([]);
    showToast('All system records cleared. Ready for new live data entry.');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
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
        redeemInvitation,
        updateUserRoleAndAdmin,
        addUser,
        deleteUser,
        updateUserStaffProfile,
        addAttendanceRecord,
        addLeaveApplication,
        updateLeaveApplication,
        canViewModule,
        updateRolePermission,
        customRoles,
        addCustomRole,
        updateUserNavOverride,
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
        courts,
        judges,
        timeEntries,
        expenses,
        invoices,
        payments,
        retainers,
        users,
        attendanceRecords,
        leaveApplications,
        logs,
        rolesMatrix,
        lawFirmRegistry,
        bankAccounts,
        trustAuditLogs,
        inventoryItems,
        bankReconciliationEntries,
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
        resetClientPassword,
        addBankAccount,
        updateBankAccount,
        archiveBankAccount,
        addTrustAuditLog,
        addInventoryItem,
        updateInventoryItem,
        toggleReconcileEntry,
        addLead,
        updateLead,
        deleteLead,
        addClient,
        updateClient,
        deleteClient,
        sendClientPortalInvite,
        addCase,
        updateCase,
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
        resetAllData,
        clearAllDataToBlank,
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
