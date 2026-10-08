import type { User } from '../types';
import { partnerCode } from './identity';

/**
 * "Who approves" (Firm & Practice Settings → Who approves). One list per item that needs
 * approval: the people who may approve it and how many of them must (0 = all of them).
 * Saved in Firm & Practice Settings (`approvers`, keyed by item id, people by user id).
 * An item nobody has set up yet keeps the portal's existing routing (`fallback`).
 */
export interface ApproverRule {
  approvers: string[];
  need: number;
}

/** [id, what needs approval, where it is approved, what happens until it is set]. */
export const APPROVAL_ITEMS: [string, string, string, string][] = [
  ['feeShare', 'Monthly fee sharing', 'Accounts › Payroll › Fee sharing', 'Finance approval rules apply'],
  ['payroll', 'Staff payroll (before payslips go out)', 'Accounts › Payroll › Staff payslips', 'Finance approval rules apply'],
  ['partnerPay', 'Partner pay statements', 'Accounts › Payroll › Partner pay', 'Finance approval rules apply'],
  ['officePay', 'Office payments (payment vouchers)', 'Accounts › Approvals', 'Finance approval rules apply'],
  ['clientPay', 'Client account payments', 'Accounts › Client account', 'Finance approval rules apply'],
  ['recon', 'Monthly 3-way reconciliation sign-off', 'Accounts › Client account › Reconciliation', 'Finance approval rules apply'],
  ['referral', 'Referral fees', 'Accounts › Approvals › Referral fees', 'Finance approval rules apply'],
  ['claims', 'Staff claims', 'Staff Portal › My Claims', 'partner in charge of each file'],
  ['writeOff', 'Write-offs & credit notes', 'Accounts › Billing', 'Finance approval rules apply'],
  ['emergency', 'Emergency fund withdrawals', 'Accounts › Office account › Emergency fund', 'Finance approval rules apply'],
  ['investment', 'Investment deposits & withdrawals', 'Accounts › Office account › Investment', 'Finance approval rules apply'],
  ['clientStmt', 'Client account statements (sent to client)', 'Accounts › Client account › Statement', 'Finance approval rules apply'],
  ['leave', 'Staff leave', 'Staff Portal › Leave', 'any partner'],
];

/** People who can be picked as approvers: any active staff member (the Super Admin decides),
 * Super Admin first, then partners, Accounts, everyone else. Clients and the outside reviewer are left out. */
const POOL_ORDER: Record<string, number> = { Partner: 0, Accountant: 1 };
export const approverPool = (users: User[]): User[] =>
  users
    .filter((u) => u.status !== 'Inactive' && u.role !== 'Client' && u.role !== 'Reviewer')
    .sort((a, b) => Number(!!b.isSuperAdmin) - Number(!!a.isSuperAdmin) || (POOL_ORDER[a.role] ?? 2) - (POOL_ORDER[b.role] ?? 2) || a.name.localeCompare(b.name));

/** Short code shown on the chips: the user code, else initials (bin / binti left out). */
export const approverCode = (u: Partial<User>): string =>
  partnerCode(u) ||
  String(u.name || '')
    .split(/\s+/)
    .filter((w) => w && !/^(bin|binti|bt|bte|a\/l|a\/p)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** "SH", "SH & ZA", "SH, ZA & AH" or "any 1 of SH, ZA, AH". */
export const ruleLabel = (codes: string[], need: number): string => {
  const n = codes.length;
  const k = need ? Math.min(need, n) : n;
  if (k === n) return n === 1 ? codes[0] : codes.slice(0, -1).join(', ') + ' & ' + codes[n - 1];
  return 'any ' + k + ' of ' + codes.join(', ');
};

interface ResolvedApproval {
  people: User[];
  codes: string[];
  /** How many must approve (already capped to the number of people). */
  need: number;
  label: string;
}

/** The set-up approvers for an item, or null when nobody has set it up (keep the existing routing). */
export const resolveApproval = (id: string, users: User[], rules: Record<string, ApproverRule> | undefined): ResolvedApproval | null => {
  const r = rules?.[id];
  if (!r || !Array.isArray(r.approvers)) return null;
  const pool = approverPool(users);
  const people = r.approvers.map((uid) => pool.find((u) => u.id === uid)).filter((u): u is User => !!u);
  if (!people.length) return null;
  const codes = people.map(approverCode);
  const need = r.need ? Math.min(r.need, people.length) : people.length;
  return { people, codes, need, label: ruleLabel(codes, r.need) };
};
