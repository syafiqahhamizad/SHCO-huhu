import type { Case, Expense, Invoice, Quotation } from '../types';
import { invoiceOnCase, isIssued } from './financeMetrics';

/**
 * Disbursements the client was quoted for on a file (e.g. Bankruptcy search RM 10, SSM search RM 30),
 * against the costs actually paid for each. Source, first that has disbursement lines: accepted
 * quotations → proformas → issued invoices (past ones count). A past paper keyed with one total shows
 * one line, "Disbursements (as quoted)".
 *
 * The quoted total is one pot: the items are a guide, the work may differ (a filing not done, a
 * search not quoted). Any cost counts against the pot; only what goes above the quoted total is
 * billed to the client.
 */
export interface QuotedDisbRow { desc: string; quoted: number; paid: number; left: number }
export interface QuotedDisb { source: string[]; rows: QuotedDisbRow[]; extras: Expense[]; quoted: number; paid: number; left: number }
/** A cost inside the quoted pot that is not one of the listed items. */
export const OTHER_COST = 'Other cost (not listed)';

const r2 = (n: number) => Math.round(n * 100) / 100;
const onFile = (c: Pick<Case, 'id' | 'ref'>, caseId?: string, fileRef?: string) =>
  (!!caseId && (caseId === c.id || caseId === c.ref)) || (!!fileRef && fileRef === c.ref);
const lineAmt = (i: { amount?: number; quantity?: number; unitPrice?: number }) => Number(i.amount ?? Number(i.quantity || 1) * Number(i.unitPrice || 0)) || 0;
/** "Disbursements" (a past paper's single total) reads better as "Disbursements (as quoted)". */
export const quotedLabel = (d: string) => (/^disbursements?$/i.test(d.trim()) ? 'Disbursements (as quoted)' : d.trim());

export const quotedDisbursements = (c: Pick<Case, 'id' | 'ref'>, quotations: Quotation[], invoices: Invoice[], expenses: Expense[]): QuotedDisb => {
  const disbOf = (items?: { category?: string; description?: string; amount?: number; quantity?: number; unitPrice?: number }[]) => (items || []).filter((i) => i.category === 'Disbursement');
  const quotes = quotations.filter((q) => q.documentType !== 'Proforma' && q.status === 'Accepted' && onFile(c, q.caseId, q.fileRef) && disbOf(q.lineItems).length);
  const pfs = quotations.filter((q) => q.documentType === 'Proforma' && !['Draft', 'Declined', 'Pending Approval'].includes(String(q.status)) && onFile(c, q.caseId, q.fileRef) && disbOf(q.lineItems).length);
  const invs = invoices.filter((i) => i.status !== 'Voided' && isIssued(i) && invoiceOnCase(i, c) && disbOf(i.lineItems).length);
  const docs: { id: string; lineItems?: Quotation['lineItems'] }[] = quotes.length ? quotes : pfs.length ? pfs : invs;
  const byDesc = new Map<string, number>();
  docs.forEach((d) => disbOf(d.lineItems).forEach((i) => { const k = quotedLabel(String(i.description || 'Disbursements')); byDesc.set(k, r2((byDesc.get(k) || 0) + lineAmt(i))); }));
  const costs = expenses.filter((e) => onFile(c, e.caseId, e.fileRef) && e.category === 'Disbursement' && !e.writtenOff);
  const rows = [...byDesc.entries()].map(([desc, quoted]) => {
    const paid = r2(costs.filter((e) => e.quoteLine && quotedLabel(e.quoteLine) === desc).reduce((s, e) => s + Number(e.amount || 0), 0));
    return { desc, quoted, paid, left: r2(quoted - paid) };
  });
  const other = r2(costs.filter((e) => e.quoteLine && !byDesc.has(quotedLabel(e.quoteLine))).reduce((s, e) => s + Number(e.amount || 0), 0));
  if (other > 0) rows.push({ desc: OTHER_COST, quoted: 0, paid: other, left: -other });
  const extras = costs.filter((e) => !e.quoteLine);
  const quoted = r2(rows.reduce((s, x) => s + x.quoted, 0)), paid = r2(rows.reduce((s, x) => s + x.paid, 0));
  return { source: docs.map((d) => d.id), rows: byDesc.size ? rows : [], extras, quoted, paid, left: r2(quoted - paid) };
};
