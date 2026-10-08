/**
 * Accounts & Finance — pure calculation helpers (no React, no Firebase, no settings).
 *
 * Shared by the finance controller / tabs and by src/lib/finance.test.ts, so every screen uses
 * ONE definition of: local-date bucketing, invoice composition (fees / reimbursements /
 * disbursements / SST), fee income from money received, claim-form approval totals and months
 * of fixed costs covered.
 */

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Timestamp (local midnight) of a date value. Pure 'YYYY-MM-DD' strings are taken as written;
 * full ISO timestamps (e.g. `paidAt` = '2026-09-30T23:30:00.000Z', which is 1 Oct 07:30 in
 * Malaysia) are converted to the LOCAL calendar day, never by cutting the UTC date part.
 * Also reads dd.mm.yyyy / dd/mm/yyyy and "12 Jun 2026". 0 when unknown.
 */
export const parseDate = (s: unknown): number => {
  if (typeof s === 'number') { if (!s) return 0; const d = new Date(s); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  const str = String(s || '').trim();
  if (!str) return 0;
  if (/^\d{4}-\d{1,2}-\d{1,2}[T ]\d{1,2}:\d{2}/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  let q = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (q) return new Date(+q[1], +q[2] - 1, +q[3]).getTime();
  q = str.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (q) return new Date(+(q[3].length === 2 ? '20' + q[3] : q[3]), +q[2] - 1, +q[1]).getTime();
  q = str.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s*(\d{4})?/);
  if (q) { const mi = MON.indexOf(q[2].toLowerCase()); return new Date(+(q[3] || new Date().getFullYear()), Math.max(0, mi), +q[1]).getTime(); }
  const t = new Date(str).getTime();
  return Number.isNaN(t) ? 0 : t;
};
/** Local 'YYYY-MM-DD' of any date value ('' when unknown). */
export const localIso = (s: unknown): string => {
  const t = parseDate(s); if (!t) return '';
  const x = new Date(t);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const periodKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/** True when the value falls in month `key` ('YYYY-MM'), using the local calendar day. */
export const inPeriod = (s: unknown, key: string) => { const t = parseDate(s); return !!t && periodKey(new Date(t)) === key; };

/* ------------------------------ invoice composition ------------------------------ */
interface LineLike { category?: string; amount?: number; quantity?: number; unitPrice?: number; chargeType?: string }
const lineTotal = (i: LineLike) => {
  const q = Number(i.quantity ?? 1), u = Number(i.unitPrice ?? i.amount ?? 0);
  const t = i.chargeType === 'Per Quantity' ? q * u : u;
  return Number.isFinite(t) ? t : 0;
};
interface Composition { fees: number; reimb: number; disb: number; sst: number; total: number }
/**
 * What an invoice is made of. `fees + reimb` is the firm's income (SST-able), `disb` is money
 * paid out for the client (recovered, never income), `sst` is owed to Customs.
 * Old invoices may carry a {category:'Tax'} line: it is ignored (SST is the stored `tax`).
 */
export const invoiceComposition = (inv: { lineItems?: LineLike[]; total?: number; tax?: number }): Composition => {
  const total = Number(inv.total || 0), sst = Number(inv.tax || 0);
  const items = (inv.lineItems || []).filter((i) => i.category !== 'Tax');
  if (!items.length) return { fees: round2(total - sst), reimb: 0, disb: 0, sst, total };
  let fees = 0, reimb = 0, disb = 0;
  items.forEach((i) => { const a = lineTotal(i); if (i.category === 'Disbursement') disb += a; else if (i.category === 'Reimbursement') reimb += a; else fees += a; });
  return { fees: round2(fees), reimb: round2(reimb), disb: round2(disb), sst, total };
};
/** Splits money received against an invoice into fee income / SST collected / disbursement recovered. */
export const splitReceipt = (amount: number, c: Composition) => {
  const a = Number(amount || 0);
  const base = c.total > 0 ? c.total : c.fees + c.reimb + c.disb + c.sst;
  if (!(base > 0)) return { income: a, sst: 0, disb: 0 };
  const sst = a * c.sst / base, disb = a * c.disb / base;
  return { income: a - sst - disb, sst, disb };
};

/* ------------------------------ expenses / vouchers ------------------------------ */
/** Our own costs re-charged to the client (SST-able "reimbursements"), as opposed to disbursements paid to third parties. */
export const isReimbursementCategory = (cat?: string, desc?: string) => /photocop|print|courier|despatch|dispatch|postage|mileage|travel|toll|parking|telephone|\bfax\b|runner/i.test(`${cat || ''} ${desc || ''}`) && !/filing|stamp|search|court fee|registration/i.test(String(cat || ''));
/** Office-expense categories that are really remittances of amounts already owed (not new costs). */
export const isStatutoryCategory = (cat?: string) => /\bepf\b|kwsp|socso|perkeso|\beis\b|\bpcb\b|lhdn|zakat|statutory/i.test(String(cat || ''));
export const PV_STATUTORY = 'Statutory (EPF/SOCSO/EIS/PCB)';
export const PV_SST = 'SST to Customs';
export const PV_DRAWINGS = 'Partner drawings';
/** Voucher categories that settle a liability / equity, never a P&L expense. */
export const isNonExpensePv = (cat?: string) => cat === PV_STATUTORY || cat === PV_SST || cat === PV_DRAWINGS || cat === 'Disbursement' || cat === 'Client Disb' || cat === 'Legal Fees Transfer';

/* ------------------------------ approvals ------------------------------ */
/** Sum of every live item on the same claim / PV form (an approval limit applies per FORM, not per item). */
export const claimFormTotal = (items: { formNo?: string; amount: number; rejected?: boolean; id?: string }[], formNo: string | undefined, fallback: number) => {
  if (!formNo) return fallback;
  return round2(items.filter((i) => i.formNo === formNo && !i.rejected).reduce((s, i) => s + Number(i.amount || 0), 0));
};
/** Managing Partner + 1 needed AT and above the threshold. */
export const needsTwoSignatories = (formTotal: number, threshold: number, clientAccount = false) => clientAccount || formTotal >= threshold;

/* ------------------------------ runway ------------------------------ */
/** Monthly equivalent of fixed commitments: monthly + annual / 12. */
export const monthlyCommitments = (list: { amount: number; frequency: 'Monthly' | 'Annual' | string }[]) =>
  round2((list || []).reduce((s, c) => s + (c.frequency === 'Annual' ? Number(c.amount || 0) / 12 : c.frequency === 'Monthly' ? Number(c.amount || 0) : 0), 0));
/** Months of fixed costs covered by free cash; null when there are no commitments (show "—"). */
export const monthsCovered = (free: number | null, list: { amount: number; frequency: string }[]): number | null => {
  const m = monthlyCommitments(list as { amount: number; frequency: 'Monthly' | 'Annual' }[]);
  if (free == null || !(m > 0)) return null;
  return free / m;
};
