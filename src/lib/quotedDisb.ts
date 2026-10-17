import type { Case, Expense, Invoice, Quotation, TravelClaim } from '../types';
import { invoiceOnCase, isIssued } from './financeMetrics';
import { isReimbursementCategory } from './financeCalc';

/**
 * Disbursements and reimbursements the client was quoted for on a file (e.g. Bankruptcy search
 * RM 10, Photocopy RM 50), against the costs actually paid for each. Source, first that has lines
 * of that kind: accepted quotations → proformas → issued invoices (past ones count). A past paper
 * keyed with one total shows one line, "Disbursements (as quoted)" / "Reimbursements (as quoted)".
 *
 * Each quoted total is one pot: the items are a guide, the work may differ. Any cost counts against
 * the pot. Disbursement: only what goes above the total is billed. Reimbursement: what the client
 * was charged minus what it really cost the firm is the firm's profit.
 */
export type CostKind = 'Disbursement' | 'Reimbursement';
export interface QuotedDisbRow { desc: string; quoted: number; paid: number; left: number }
export interface QuotedDisb { kind: CostKind; source: string[]; rows: QuotedDisbRow[]; extras: Expense[]; quoted: number; paid: number; left: number }
/** A cost inside the quoted pot that is not one of the listed items. */
export const OTHER_COST = 'Other cost (not listed)';
const TRAVEL = 'Travel (staff claims)';

const r2 = (n: number) => Math.round(n * 100) / 100;
const onFile = (c: Pick<Case, 'id' | 'ref'>, caseId?: string, fileRef?: string) =>
  (!!caseId && (caseId === c.id || caseId === c.ref)) || (!!fileRef && fileRef === c.ref);
const lineAmt = (i: { amount?: number; quantity?: number; unitPrice?: number }) => Number(i.amount ?? Number(i.quantity || 1) * Number(i.unitPrice || 0)) || 0;
/** A past paper's single total reads better as "… (as quoted)". */
export const quotedLabel = (d: string) => (/^disbursements?$/i.test(d.trim()) ? 'Disbursements (as quoted)' : /^reimbursements?$/i.test(d.trim()) ? 'Reimbursements (as quoted)' : d.trim());
/** Our own cost re-charged (photocopy, courier, travel…) vs a disbursement paid to others. */
export const isReimbCost = (e: Pick<Expense, 'category' | 'description'>) => e.category === 'Reimbursement' || isReimbursementCategory(e.category, e.description);

/** What is still to bill for a cost: all of it, or (a staff claim checked at approval) only the part above the quote. */
export const billPart = (e: Pick<Expense, 'amount' | 'quoteCovered'>) => (e.quoteCovered != null ? r2(Math.max(0, Number(e.amount || 0) - e.quoteCovered)) : Number(e.amount || 0));

type Line = { category?: string; description?: string; amount?: number; quantity?: number; unitPrice?: number };
type Doc = { id: string; lineItems?: Line[] };
const docsWith = (c: Pick<Case, 'id' | 'ref'>, kind: CostKind | 'Fee', quotations: Quotation[], invoices: Invoice[]): Doc[] => {
  const has = (items?: Line[]) => (items || []).some((i) => (kind === 'Fee' ? /^Fee/.test(String(i.category || '')) : i.category === kind));
  const quotes = quotations.filter((q) => q.documentType !== 'Proforma' && q.status === 'Accepted' && onFile(c, q.caseId, q.fileRef) && has(q.lineItems));
  const pfs = quotations.filter((q) => q.documentType === 'Proforma' && !['Draft', 'Declined', 'Pending Approval'].includes(String(q.status)) && onFile(c, q.caseId, q.fileRef) && has(q.lineItems));
  const invs = invoices.filter((i) => i.status !== 'Voided' && isIssued(i) && invoiceOnCase(i, c) && has(i.lineItems));
  return quotes.length ? quotes : pfs.length ? pfs : invs;
};

export const quotedCosts = (c: Pick<Case, 'id' | 'ref'>, quotations: Quotation[], invoices: Invoice[], expenses: Expense[], kind: CostKind = 'Disbursement', travel: TravelClaim[] = []): QuotedDisb => {
  const docs = docsWith(c, kind, quotations, invoices);
  const byDesc = new Map<string, number>();
  docs.forEach((d) => (d.lineItems || []).filter((i) => i.category === kind).forEach((i) => { const k = quotedLabel(String(i.description || kind + 's')); byDesc.set(k, r2((byDesc.get(k) || 0) + lineAmt(i))); }));
  const costs = expenses.filter((e) => onFile(c, e.caseId, e.fileRef) && !e.writtenOff && (kind === 'Disbursement' ? e.category === 'Disbursement' && !isReimbCost(e) : isReimbCost(e) && (e.billable || e.category === 'Reimbursement')));
  // Each cost's parts: several items under one receipt, or one item for the whole amount.
  const parts = costs.flatMap((e) => (e.quoteLines?.length ? e.quoteLines.map((p) => ({ desc: quotedLabel(p.desc), amount: Number(p.amount || 0) })) : e.quoteLine ? [{ desc: quotedLabel(e.quoteLine), amount: Number(e.quoteCovered ?? e.amount ?? 0) }] : []));
  const rows = [...byDesc.entries()].map(([desc, quoted]) => {
    const paid = r2(parts.filter((p) => p.desc === desc).reduce((s, p) => s + p.amount, 0));
    return { desc, quoted, paid, left: r2(quoted - paid) };
  });
  const other = r2(parts.filter((p) => !byDesc.has(p.desc)).reduce((s, p) => s + p.amount, 0));
  if (other > 0) rows.push({ desc: OTHER_COST, quoted: 0, paid: other, left: -other });
  // Reimbursements: staff travel for this file (what the firm paid out) counts as our cost too.
  const trav = kind === 'Reimbursement' ? r2(travel.filter((t) => t.purposeType === 'Client Matter' && t.fileRef === c.ref && t.approvalStatus !== 'Rejected' && t.approvalStatus !== 'Draft').reduce((s, t) => s + Number(t.total || 0), 0)) : 0;
  if (trav > 0) rows.push({ desc: TRAVEL, quoted: 0, paid: trav, left: -trav });
  // Not part of the quote, or the part of a staff claim above it.
  const extras = costs.filter((e) => (!e.quoteLine && !e.quoteLines?.length) || (e.quoteCovered != null && billPart(e) > 0.005));
  const quoted = r2(rows.reduce((s, x) => s + x.quoted, 0)), paid = r2(rows.reduce((s, x) => s + x.paid, 0));
  return { kind, source: docs.map((d) => d.id), rows: byDesc.size ? rows : [], extras, quoted, paid, left: r2(quoted - paid) };
};
/** Disbursements only (the "Paid for a client file" pot). */
export const quotedDisbursements = (c: Pick<Case, 'id' | 'ref'>, quotations: Quotation[], invoices: Invoice[], expenses: Expense[]) => quotedCosts(c, quotations, invoices, expenses, 'Disbursement');

/** Professional fees quoted on the file (same source rule). */
export const quotedFees = (c: Pick<Case, 'id' | 'ref'>, quotations: Quotation[], invoices: Invoice[]) =>
  r2(docsWith(c, 'Fee', quotations, invoices).reduce((s, d) => s + (d.lineItems || []).filter((i) => /^Fee/.test(String(i.category || ''))).reduce((a, i) => a + lineAmt(i), 0), 0));
