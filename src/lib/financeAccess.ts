/**
 * Accounts & Finance access rules (design pack `Finance Workflow.dc.html` → "Who sees what",
 * and `Accounts and Finance.dc.html` TAB / SHCO Sidebar role strings).
 *
 *   Managing Partner (M) & Accounts (A): every tab.
 *   Partner (P): Billing & Collections (own files), Client Account (view), Approvals.
 *   Reviewer / external auditor (R): read-only Client Account + Accounting + Reports.
 *   Staff (S) and clients: nothing (they use My Claims / Staff Portal).
 *
 * Pages a role can't use are hidden from the menu, not just locked.
 */
import type { User } from '../types';

export type FinRoleKey = 'M' | 'P' | 'A' | 'R' | 'S';
export type FinTab = 'overview' | 'billing' | 'trust' | 'office' | 'approvals' | 'payroll' | 'books' | 'reports';

/** [tab key, tab label, roles that see the tab, sidebar view id, roles that see the sidebar item] */
export const FIN_TABS: [FinTab, string, string, string, string][] = [
  ['overview', 'Finance Home', 'MA', 'accountingCentre', 'MA'],
  ['billing', 'Billing & Collections', 'MAP', 'billing', 'MAP'],
  ['trust', 'Client Account', 'MAPR', 'retainers', 'MAPR'],
  ['office', 'Office Account', 'MA', 'officeAccounts', 'MA'],
  ['approvals', 'Approvals', 'MPA', 'approvals', 'MP'],
  ['payroll', 'Payroll', 'MA', 'payroll', 'MA'],
  ['books', 'Accounting', 'MAR', 'accounting', 'MAR'],
  ['reports', 'Reports', 'MAR', 'reports', 'MAR'],
];

/** Every app view id that now opens a tab of the Accounts & Finance module. */
export const FINANCE_VIEW_TO_TAB: Record<string, FinTab> = {
  accountingCentre: 'overview',
  'accounting-centre': 'overview',
  billing: 'billing',
  quotations: 'billing',
  time: 'billing',
  retainers: 'trust',
  statement: 'trust',
  officeAccounts: 'office',
  'office-accounts': 'office',
  approvals: 'approvals',
  payroll: 'payroll',
  reports: 'reports',
  accounting: 'books',
  books: 'books',
  coa: 'books',
  gl: 'books',
  tb: 'books',
  trialBalance: 'books',
  balanceSheet: 'reports',
  'balance-sheet': 'reports',
  cashFlow: 'reports',
  cashflow: 'reports',
  trustReports: 'reports',
  'reports-trust': 'reports',
  officeReports: 'reports',
  'reports-office': 'reports',
};

export const isFinanceView = (viewId: string) => Object.prototype.hasOwnProperty.call(FINANCE_VIEW_TO_TAB, viewId);

/** Role key used by the finance module. Managing Partner = a Partner with the firm admin /
 * super-admin flag (same rule My Dashboard uses for its Managing Partner-only tiles). */
export const finRoleKey = (currentRole: string | undefined, currentUser: Partial<User> | undefined, isAdmin: boolean): FinRoleKey => {
  const role = String(currentRole || currentUser?.role || '');
  if (role === 'Client') return 'S';
  if (/account/i.test(role)) return 'A';
  if (role === 'Reviewer') return 'R';
  // Managing Partner = the Super Admin only; an admin partner is still a Partner here.
  if (role === 'Partner') return currentUser?.isSuperAdmin || String(currentUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com' ? 'M' : 'P';
  return 'S';
};

/**
 * Finance pages granted to one person on top of their role (owner's choice "whoever I allow"):
 * Settings › Permissions › By person › "Books & Reports" (finance.reports) set to View opens
 * Accounting and Reports for that person.
 */
export const finGrants = (u?: Partial<User> | null): FinTab[] => (u?.navOverrides?.['finance.reports']?.v ? ['books', 'reports'] : []);

export const finTabsFor = (rk: FinRoleKey, grants: FinTab[] = []) => FIN_TABS.filter((t) => t[2].includes(rk) || grants.includes(t[0]));

export const canSeeFinanceView = (viewId: string, rk: FinRoleKey, grants: FinTab[] = []): boolean => {
  const tab = FINANCE_VIEW_TO_TAB[viewId];
  if (!tab) return false;
  const row = FIN_TABS.find((t) => t[0] === tab);
  return !!row && (row[2].includes(rk) || grants.includes(tab));
};

/** Sidebar visibility (the design's sidebar role strings — Approvals is hidden for Accounts,
 * who prepare but never approve). */
export const canSeeFinanceNav = (viewId: string, rk: FinRoleKey, grants: FinTab[] = []): boolean => {
  const row = FIN_TABS.find((t) => t[3] === viewId);
  return !!row && (row[4].includes(rk) || grants.includes(row[0]));
};


/**
 * Client billing (quotations, invoices, payments, receipts, client-account entries) is for
 * Managing Partner, partners, Accounts and reviewers only — the same people who see the Client
 * Account page. Lawyers, assistants and clients get none of these records from the database
 * (firestore.rules: books tier), so screens hide bills and money figures for them.
 */
export const canSeeClientBilling = (rk: FinRoleKey, grants: FinTab[] = []): boolean => canSeeFinanceView('retainers', rk, grants);
