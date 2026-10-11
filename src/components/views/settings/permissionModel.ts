import type { ModulePermissions, RolePermissionsMatrix, User } from '../../../types';

/**
 * Permission rows from firm-settings.dc.html (ROWS): [key, label, parent?, design default mask].
 * Top-level keys are the app's real module keys (rolesMatrix / canViewModule / hasModulePermission
 * read them). Sub-tab keys ('leads.pipeline', 'finance.billing', …) are stored in the same
 * rolesMatrix but no screen reads them yet.
 */
export const PERM_ROWS: [string, string, string?, string?][] = [
  ['dashboard', 'My Dashboard'], ['dashboard.myWork', 'My work', 'dashboard'], ['dashboard.finance', 'Finance (firm P&L, cash)', 'dashboard', '000000'], ['dashboard.clientAccount', 'Client account', 'dashboard', '100000'], ['dashboard.team', 'Team (workload, leave, pay)', 'dashboard', '000000'], ['dashboard.partnerKpis', 'Partner KPIs (own only for Partners)', 'dashboard', '100000'], ['dashboard.firmWide', 'Firm-wide', 'dashboard', '100000'],
  ['leads', 'Leads & Referrals'], ['leads.overview', 'Overview', 'leads'], ['leads.pipeline', 'Pipeline', 'leads'], ['leads.programmes', 'Programmes', 'leads'], ['leads.referrers', 'Referrers & fees', 'leads', '110000'],
  ['clients', 'Clients'], ['clients.clearConflict', 'Clear a conflict check (client profile and new file)', 'clients', '100000'], ['clients.delete', 'Delete clients', 'clients', '000000'], ['cases', 'Cases'], ['cases.overview', 'Overview', 'cases'], ['cases.court', 'Court dates', 'cases'], ['cases.documents', 'Documents', 'cases'], ['cases.tasks', 'Tasks & notes', 'cases'], ['cases.money', 'Money on the file', 'cases', '100110'], ['cases.approveClose', 'Approve closing a file (partners: their own files)', 'cases', '100000'], ['cases.reopen', 'Reopen a closed file', 'cases', '100000'], ['cases.delete', 'Delete a file (others send a request)', 'cases', '100000'],
  ['finance', 'Accounts & Finance'], ['finance.overview', 'Overview', 'finance'], ['finance.billing', 'Billing & Collections', 'finance'], ['officeFinance', 'Office & Expenses', 'finance'], ['finance.approvals', 'Approvals', 'finance'], ['finance.payroll', 'Payroll', 'finance'], ['finance.reports', 'Books & Reports', 'finance'],
  ['retainers', 'Client Account (SAR 1990)'], ['clientPortal', 'Client Portal'],
  ['settings', 'Firm & Practice Settings'], ['users', 'Users & Roles', 'settings'], ['settings.permissions', 'Permissions & limits', 'settings', '000000'], ['settings.firm', 'Firm & Letterhead', 'settings'], ['settings.banks', 'Banks, Numbering & SST', 'settings'], ['settings.areas', 'Practice areas & codes', 'settings'], ['settings.templates', 'Fee templates', 'settings'], ['settings.lists', 'Lists & sources', 'settings'],
  ['logs', 'Activity Logs'], ['firmStartCentreEdit', 'Firm Start Centre (edit)'],
  ['hrRecords', 'HR records (employee profiles)'],
  ['viewAs', 'View as (see the app as another person)'],
];

/** Keys an admin always has in full on top of their role (design ADMK). */
const ADMIN_KEYS = ['clients.delete', 'settings', 'users', 'logs', 'hrRecords', 'settings.firm', 'settings.banks', 'settings.templates', 'settings.lists', 'settings.permissions'];

/** The design's fixed role order; index 1.. maps to the app's own roles. */
export const FIXED_ROLE_COLS: [string, string][] = [['Super Admin', ''], ['Partner', 'Partner'], ['Lawyer', 'Lawyer'], ['Assistant', 'Assistant'], ['Accountant', 'Accountant'], ['Reviewer', 'Reviewer'], ['Client', 'Client']];
const MASK_IDX: Record<string, number> = { Partner: 0, Lawyer: 1, Assistant: 2, Accountant: 3, Reviewer: 4, Client: 5 };

export const SUPER_EMAIL = 'syafiqahhamizad@shcolaw.com';
export const isSuper = (u?: Partial<User> | null) => !!u && ((u.email || '').trim().toLowerCase() === SUPER_EMAIL.toLowerCase() || !!u.isSuperAdmin);
/** Managing Partner = the Super Admin partner only. Admin is a separate system right (settings,
 * users, logs, HR records) and does not make a partner Managing Partner. */
export const isManagingPartner = (u?: Partial<User> | null) => !!u && u.role === 'Partner' && isSuper(u);
/** Role name shown in the design's role dropdown. */
export const designRole = (u: Partial<User>): string => (isManagingPartner(u) ? 'Super Admin' : u.role === 'Reviewer' ? 'Reviewer (auditor)' : String(u.role || ''));

const toBits = (p?: ModulePermissions | null) => (p ? `${p.v ? 1 : 0}${p.a ? 1 : 0}${p.e ? 1 : 0}` : '000');
export const fromBits = (b: string): ModulePermissions => ({ v: b[0] === '1' ? 1 : 0, a: b[1] === '1' ? 1 : 0, e: b[2] === '1' ? 1 : 0 });
export const flipBit = (b: string, i: number) => b.split('').map((c, y) => (y === i ? (c === '1' ? '0' : '1') : c)).join('');
const andBits = (a: string, b: string) => a.split('').map((c, y) => (c === '1' && b[y] === '1' ? '1' : '0')).join('');

const row = (key: string) => PERM_ROWS.find((r) => r[0] === key);
export const parentOf = (key: string) => row(key)?.[2];

/** What a role's own cell holds for a key (before the tab cap). Top-level keys read the real
 * rolesMatrix (missing = no access, exactly as canViewModule treats it); sub-tab keys fall back
 * to the design default (the tab's value, masked). */
export const roleOwnBits = (matrix: RolePermissionsMatrix, role: string, key: string): string => {
  const stored = matrix[role]?.[key];
  if (stored) return toBits(stored);
  const r = row(key);
  if (!r || !r[2]) return '000';
  const parentBits = toBits(matrix[role]?.[r[2]]);
  const mask = r[3];
  if (!mask) return parentBits;
  const i = MASK_IDX[role];
  return i !== undefined && mask[i] === '1' ? parentBits : '000';
};

/** A role's effective bits for a key: own cell capped by its tab. */
const roleBits = (matrix: RolePermissionsMatrix, role: string, key: string): string => {
  const own = roleOwnBits(matrix, role, key);
  const p = parentOf(key);
  return p ? andBits(own, roleOwnBits(matrix, role, p)) : own;
};

/** What a person gets from their role (+ admin keys) before their own changes. */
export const personRoleBits = (matrix: RolePermissionsMatrix, u: Partial<User>, key: string): string => {
  if (isManagingPartner(u)) return '111';
  if ((u.isAdmin || isSuper(u)) && ADMIN_KEYS.includes(key)) return '111';
  return roleBits(matrix, String(u.role || ''), key);
};

/** Effective bits for a person: their own override if set, else the role's. */
export const personBits = (matrix: RolePermissionsMatrix, u: Partial<User>, key: string): string => {
  if (isManagingPartner(u)) return '111';
  const o = u.navOverrides?.[key];
  return o ? toBits(o) : personRoleBits(matrix, u, key);
};

/** Can this person do this job? (Super Admin always; everyone else by role, then their own setting.) */
export const can = (matrix: RolePermissionsMatrix, u: Partial<User> | null | undefined, key: string): boolean =>
  !!u && (isSuper(u) || personBits(matrix, u, key) !== '000');

/** Active staff allowed to do this job — for sending them the request. */
export const peopleWho = (matrix: RolePermissionsMatrix, users: User[], key: string): User[] =>
  users.filter((u) => u.status !== 'Inactive' && u.role !== 'Client' && can(matrix, u, key));

/** Number of keys where this person differs from their role. */
export const personChanges = (matrix: RolePermissionsMatrix, u: Partial<User>) =>
  isManagingPartner(u) ? 0 : PERM_ROWS.filter(([k]) => u.navOverrides?.[k] && toBits(u.navOverrides[k]) !== personRoleBits(matrix, u, k)).length;

/** "View as" (see the app as another person): Managing Partner always; others only if granted. */
export const canViewAs = (matrix: RolePermissionsMatrix, u?: Partial<User> | null) =>
  !!u && (isManagingPartner(u) || isSuper(u) || personBits(matrix, u, 'viewAs') !== '000');
