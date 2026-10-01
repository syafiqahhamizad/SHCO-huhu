/**
 * Shared, pure finance definitions for the dashboards — so the same figure means the same
 * thing on My Dashboard, Dashboard → Finance / Partner KPIs / Direction and Finance Home.
 *
 * The rules are copied from the Accounts & Finance module (finance/useFinanceController.ts
 * and finance/FinanceHomeTab.tsx) rather than imported, because those live inside a React
 * hook. Keep them in step:
 *   - issued invoice  = not Draft, not Pending Review, not Voided          (invIssued)
 *   - owed balance    = total − payments − written off, floor 0; voided = 0 (invBal)
 *   - invoice ↔ file  = caseId (id or ref) OR fileRef                      (findCase)
 *   - office overheads = Finance Home's "Office money in & out" filters
 *   - payroll cost    = gross + employer EPF + employer SOCSO/EIS          (slipCalc)
 */
import type { Case, Expense, Invoice, Payment, PaymentVoucher, Payslip, TravelClaim } from '../types';
import { invoiceComposition, isNonExpensePv, round2 } from './financeCalc';
import { computeTotals } from './billingEngine';

/* ------------------------------ invoices ------------------------------ */

export const isIssued = (inv: Pick<Invoice, 'status'>): boolean => !['Draft', 'Pending Review', 'Voided'].includes(inv.status);

/** Payments per invoice id. */
export const paidByInvoice = (payments: Pick<Payment, 'invoiceId' | 'amount'>[]): Map<string, number> => {
  const m = new Map<string, number>();
  payments.forEach((p) => m.set(p.invoiceId, (m.get(p.invoiceId) || 0) + Number(p.amount || 0)));
  return m;
};

/** What the client still owes: total − payments − written off − proforma deposit applied,
 * never below 0; voided = 0. Same rule as the finance module's invBal. */
export const owedBalance = (inv: Pick<Invoice, 'status' | 'total' | 'writtenOff' | 'depositApplied'>, paid: number): number =>
  inv.status === 'Voided' ? 0 : Math.max(0, round2(Number(inv.total || 0) - Number(paid || 0) - Number(inv.writtenOff || 0) - Number(inv.depositApplied || 0)));

/** Money received against invoices: payments plus proforma deposits applied (dated on issue),
 * the same events the finance module counts as fee income. */
export const moneyInEvents = (
  invoices: Pick<Invoice, 'id' | 'status' | 'date' | 'issuedAt' | 'depositApplied'>[],
  payments: Pick<Payment, 'invoiceId' | 'date' | 'amount'>[],
): { invoiceId: string; date: string; amount: number }[] => [
  ...payments.map((p) => ({ invoiceId: p.invoiceId, date: p.date, amount: Number(p.amount || 0) })),
  ...invoices
    .filter((i) => isIssued(i) && Number(i.depositApplied || 0) > 0)
    .map((i) => ({ invoiceId: i.id, date: i.issuedAt || i.date, amount: Number(i.depositApplied || 0) })),
];

/** Invoice belongs to the file when its caseId is the file's id or ref, or its fileRef is the ref. */
export const invoiceOnCase = (inv: Pick<Invoice, 'caseId' | 'fileRef'>, c: Pick<Case, 'id' | 'ref'>): boolean =>
  (!!inv.caseId && (inv.caseId === c.id || inv.caseId === c.ref)) || (!!inv.fileRef && inv.fileRef === c.ref);

/** Lookup: the Case an invoice (or anything with caseId / fileRef) belongs to. */
export const caseFinder = (cases: Case[]) => {
  const byId = new Map(cases.map((c) => [c.id, c] as [string, Case]));
  const byRef = new Map(cases.map((c) => [c.ref, c] as [string, Case]));
  return (caseId?: string, fileRef?: string): Case | undefined =>
    (caseId && (byId.get(caseId) || byRef.get(caseId))) || (fileRef ? byRef.get(fileRef) || byId.get(fileRef) : undefined);
};

/**
 * Share of an invoice that is fee income: (fees + reimbursements) ÷ invoice total — i.e.
 * excluding SST and disbursements. Invoices without itemised lines: (total − tax) ÷ total.
 * Clamped to [0, 1]; 0 when the total is 0.
 */
export const feeShare = (inv: Pick<Invoice, 'total' | 'tax' | 'lineItems'> | undefined): number => {
  if (!inv) return 0;
  const c = invoiceComposition(inv);
  if (!(c.total > 0)) return 0;
  return Math.min(1, Math.max(0, (c.fees + c.reimb) / c.total));
};

/** Fee income in one payment: payment × (fees + reimbursements) ÷ invoice total. */
export const feeIncomeOfPayment = (amount: number, inv: Pick<Invoice, 'total' | 'tax' | 'lineItems' | 'status'> | undefined): number =>
  !inv || inv.status === 'Voided' ? 0 : Number(amount || 0) * feeShare(inv);

/** Amount received within `days` days of the invoice date (partial payments count). */
export const receivedWithinDays = (
  inv: Pick<Invoice, 'id' | 'date'>,
  payments: Pick<Payment, 'invoiceId' | 'amount' | 'date'>[],
  days: number,
  parse: (s: unknown) => number
): number => {
  const t0 = parse(inv.date);
  if (!t0) return 0;
  return payments
    .filter((p) => p.invoiceId === inv.id)
    .filter((p) => { const t = parse(p.date); return !!t && (t - t0) / 86400000 <= days; })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
};

/** Each listed partner gets an equal share of a co-partnered file (1 / n). */
export const partnerShare = (partners: readonly string[] | undefined, code: string): number => {
  const list = [...new Set((partners || []).filter(Boolean))];
  return list.includes(code) ? 1 / list.length : 0;
};

/* ------------------------------ % change / runway ------------------------------ */

/** "+12%" / "-5%"; a zero base gives "new" (something from nothing) or "—" (nothing either way). */
export const pctChange = (cur: number, base: number): string => {
  if (!base) return cur ? 'new' : '—';
  const p = Math.round(((cur - base) / Math.abs(base)) * 100);
  return (p > 0 ? '+' : '') + p + '%';
};

/** Fixed costs per month: monthly commitments + annual commitments ÷ 12. */
export const monthlyFixedCost = (commits: { amount: number; frequency: 'Monthly' | 'Annual' }[]): number =>
  commits.reduce((s, c) => s + (c.frequency === 'Annual' ? Number(c.amount || 0) / 12 : Number(c.amount || 0)), 0);

/** How many months `balance` covers fixed costs; null when there are no commitments. */
export const runwayMonths = (balance: number, commits: { amount: number; frequency: 'Monthly' | 'Annual' }[]): number | null => {
  const m = monthlyFixedCost(commits);
  return m > 0 ? balance / m : null;
};
export const runwayLabel = (balance: number | null, commits: { amount: number; frequency: 'Monthly' | 'Annual' }[]): string => {
  if (balance == null) return '—';
  const r = runwayMonths(balance, commits);
  return r == null ? '—' : `${r.toFixed(1)} months`;
};

/** Sinking-fund progress; a fund with no target is never "reached". */
export const fundProgress = (f: { target: number; balance: number; monthly: number }): { pct: number; label: string } => {
  const target = Number(f.target || 0), bal = Number(f.balance || 0), monthly = Number(f.monthly || 0);
  if (!(target > 0)) return { pct: 0, label: 'no target set' };
  const pct = Math.min(100, Math.round((bal / target) * 100));
  if (bal >= target) return { pct, label: 'reached' };
  const m = monthly > 0 ? Math.ceil((target - bal) / monthly) : null;
  return { pct, label: m ? `${pct}% · full in ${m} mo` : `${pct}%` };
};

/* ------------------------------ payroll & overheads ------------------------------ */

/** Firm's cost of one payslip: gross + employer EPF + employer SOCSO/EIS (slipCalc in Finance). */
export const payslipCost = (p: Payslip): number => {
  const allow = (p.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
  const gross = Number(p.basic || 0) + allow + Number(p.referralFee || 0) + Number(p.profitShare || 0) + Number(p.bonus || 0);
  return gross + Number(p.epfEmployer || 0) + Number(p.socsoEisEmployer || 0);
};
/** Payslips that count as the firm's payroll cost for their period (approved or paid). */
export const payslipCounts = (p: Payslip) => p.status === 'Approved' || p.status === 'Paid';

export const SALARY_CAT = /salar|epf|socso|payroll/i;

/** Finance Home's office-expense filter: not client-billable, approved/paid only, claims once paid. */
export const isOfficeExpense = (e: Expense): boolean =>
  !e.billable && e.approvalStatus !== 'Rejected' && e.approvalStatus !== 'Pending Approval' && e.approvalStatus !== 'Draft' && (!e.claimant || !!e.paidAt);
/** The date an office expense hits the books (claims: when paid back). */
export const officeExpenseDate = (e: Expense): string | undefined => (e.claimant ? e.paidAt : e.date);

/** Office PVs that are firm overheads: paid, not from the client account, not a disbursement paid for a client. */
export const isOverheadVoucher = (v: PaymentVoucher): boolean =>
  v.accountSet !== 'CLIENT' && !!v.paidAt && v.approvalStatus !== 'Rejected' && !isNonExpensePv(v.voucherCategory);

/** Staff travel claims count once paid back (Finance Home). */
export const isPaidClaim = (t: TravelClaim): boolean => !!t.paidAt && t.approvalStatus !== 'Rejected';

/** Office cash = sum of office bank accounts' current balance (Finance Home "Office bank"); null when none set up. */
export const officeCash = (banks: { status?: string; type?: string; functions?: string[]; currentBalance?: number }[]): number | null => {
  const office = banks.filter((b) => b.status !== 'Archived').filter((b) => {
    const f = b.functions || [];
    return !f.includes('Petty Cash') && !f.includes('Disbursement') && !(b.type === 'Trust' || f.includes('Trust Account'));
  });
  return office.length ? office.reduce((s, b) => s + Number(b.currentBalance || 0), 0) : null;
};
