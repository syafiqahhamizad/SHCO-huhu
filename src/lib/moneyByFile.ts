/**
 * Money by file — the ONE source for a file's (and a client's) money figures.
 *
 * Read by Clients › Money, Accounts & Finance › Billing › Fees by file and the Working File ›
 * Money tab, so the same file shows the same numbers everywhere. Pure (no React, no Firebase).
 * Nothing here is stored: every total is summed from the real records each time.
 *
 *   agreed          = accepted quotation(s) / letter of engagement on the file; when none is
 *                     accepted yet, the latest quotation that is not declined (a revised quote
 *                     replaces the earlier one; proformas excluded)
 *   billed          = sum of issued invoices (not Draft / Pending Review / Voided)
 *   received        = payments + proforma deposits applied on those invoices
 *   outstanding     = sum of owedBalance (total − paid − written off − deposit applied, floor 0),
 *                     the same rule as the finance dashboards
 *   client account  = sum of the client ledger (retainer) entries: Deposit +, Apply / Refund −
 *
 * Invoice ↔ file uses invoiceOnCase (caseId = id or ref, or fileRef = ref).
 */
import type { Case, Client, Invoice, Payment, Quotation, Receipt, Retainer } from '../types';
import { invoiceComposition, parseDate, round2 } from './financeCalc';
import { invoiceOnCase, isIssued, owedBalance } from './financeMetrics';

export interface MoneySources {
  invoices: Invoice[];
  payments: Payment[];
  retainers: Retainer[];
  quotations: Quotation[];
  /** Optional: official receipt numbers shown under each bill. */
  receipts?: Receipt[];
}

interface MoneyBill {
  id: string;
  date: string;
  /** What the bill is for (subject / matter), '' when not recorded. */
  what: string;
  caseId?: string;
  fees: number; disb: number; sst: number; total: number;
  /** Payments + deposit applied. */
  paid: number;
  writtenOff: number;
  /** What the client still owes on it (0 for drafts). */
  bal: number;
  status: string;
  issued: boolean;
  receiptNos: string[];
  inv: Invoice;
}

interface LedgerLine { id: string; date: string; doc: string; desc: string; dr: number; cr: number; /** signed: + in, − out */ amount: number; bal: number; caseId?: string }
interface OfficeLine { date: string; doc: string; desc: string; dr: number; cr: number; bal: number }

interface MoneyTotals { agreed: number; billed: number; received: number; outstanding: number; writtenOff: number; clientAccount: number }

interface FileMoney extends MoneyTotals {
  caseId: string;
  ref: string;
  bills: MoneyBill[];
  quotes: Quotation[];
  accepted: Quotation[];
  clientLedger: LedgerLine[];
  officeLedger: OfficeLine[];
  /** Kept for the Working File (same value as clientAccount). */
  clientBalance: number;
}

const byDate = <T extends { date: string }>(a: T, b: T) => parseDate(a.date) - parseDate(b.date);
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + (Number(x) || 0), 0));

const onFile = (c: Pick<Case, 'id' | 'ref'>, caseId?: string, fileRef?: string) =>
  (!!caseId && (caseId === c.id || caseId === c.ref)) || (!!fileRef && fileRef === c.ref);

/** Signed client-ledger amount of one retainer entry. */
const retainerSigned = (r: Pick<Retainer, 'type' | 'amount'>) => (r.type === 'Deposit' ? 1 : -1) * Number(r.amount || 0);

/** One invoice as a bill row (voided invoices are left out by the callers). */
const billOf = (inv: Invoice, payments: Payment[], receipts: Receipt[] = []): MoneyBill => {
  const comp = invoiceComposition(inv);
  const paidOnly = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + Number(p.amount || 0), 0);
  const issued = isIssued(inv);
  const paid = round2(paidOnly + (issued ? Number(inv.depositApplied || 0) : 0));
  const bal = issued ? owedBalance(inv, paidOnly) : 0;
  const status = !issued ? inv.status : bal <= 0.005 ? 'Paid' : paid > 0 ? 'Part-paid' : inv.status === 'Partial' ? 'Part-paid' : inv.status;
  return {
    id: inv.id, date: inv.issuedAt || inv.date, what: inv.subject || inv.matter || '', caseId: inv.caseId,
    fees: round2(comp.fees + comp.reimb), disb: comp.disb, sst: comp.sst, total: Number(inv.total || 0),
    paid, writtenOff: issued ? Number(inv.writtenOff || 0) : 0, bal, status, issued,
    receiptNos: receipts.filter((r) => r.invoiceId === inv.id).map((r) => r.id),
    inv,
  };
};

const totalsOfBills = (bills: MoneyBill[]) => {
  const issued = bills.filter((b) => b.issued);
  return {
    billed: sum(issued.map((b) => b.total)),
    received: sum(issued.map((b) => b.paid)),
    outstanding: sum(issued.map((b) => b.bal)),
    writtenOff: sum(issued.map((b) => b.writtenOff)),
  };
};

/** Running client-account ledger, oldest first. */
const clientLedgerOf = (entries: Retainer[]): LedgerLine[] => {
  let run = 0;
  return [...entries].sort(byDate).map((r) => {
    const amount = retainerSigned(r);
    run = round2(run + amount);
    return { id: r.id, date: r.date, doc: r.voucherNo || r.id, desc: r.remarks || r.type, dr: amount < 0 ? -amount : 0, cr: amount > 0 ? amount : 0, amount, bal: run, caseId: r.caseId };
  });
};

/** Agreed fees on a file: accepted quotation(s), else quotations not declined (no proformas). */
const agreedOf = (c: Pick<Case, 'id' | 'ref'>, quotations: Quotation[]) => {
  const quotes = quotations.filter((q) => q.documentType !== 'Proforma' && onFile(c, q.caseId, q.fileRef) && q.status !== 'Declined');
  const accepted = quotes.filter((q) => q.status === 'Accepted');
  // Nothing accepted yet: use only the newest quote, so a revised quote is not added on top of the first.
  const latest = [...quotes].sort((a, b) => parseDate(b.date) - parseDate(a.date) || String(b.id).localeCompare(String(a.id)))[0];
  const agreed = accepted.length ? sum(accepted.map((q) => Number(q.total || 0))) : Number(latest?.total || 0);
  return { quotes, accepted, agreed };
};

/** Every money figure for one file. */
export const moneyForFile = (c: Pick<Case, 'id' | 'ref'>, m: MoneySources): FileMoney => {
  const invs = m.invoices.filter((i) => invoiceOnCase(i, c));
  const bills = invs.filter((i) => i.status !== 'Voided').map((inv) => billOf(inv, m.payments, m.receipts));
  const t = totalsOfBills(bills);
  const clientLedger = clientLedgerOf(m.retainers.filter((r) => onFile(c, r.caseId)));
  const clientAccount = clientLedger.length ? clientLedger[clientLedger.length - 1].bal : 0;

  const officeRows: Omit<OfficeLine, 'bal'>[] = [];
  invs.filter(isIssued).forEach((inv) => {
    officeRows.push({ date: inv.issuedAt || inv.date, doc: inv.id, desc: 'Bill: ' + (inv.subject || inv.matter || 'professional fees, disbursements & SST'), dr: Number(inv.total || 0), cr: 0 });
    if (Number(inv.depositApplied || 0) > 0) officeRows.push({ date: inv.issuedAt || inv.date, doc: inv.id, desc: 'Deposit received applied', dr: 0, cr: Number(inv.depositApplied || 0) });
    if (Number(inv.writtenOff || 0) > 0) officeRows.push({ date: inv.writeOffRequest?.decidedAt || inv.date, doc: inv.id, desc: 'Written off', dr: 0, cr: Number(inv.writtenOff || 0) });
    m.payments.filter((p) => p.invoiceId === inv.id).forEach((p) => officeRows.push({ date: p.date, doc: p.id, desc: 'Received: ' + (p.method || 'payment') + ' for ' + inv.id, dr: 0, cr: Number(p.amount || 0) }));
  });
  let orun = 0;
  const officeLedger = officeRows.sort(byDate).map((r) => { orun = round2(orun + r.dr - r.cr); return { ...r, bal: orun }; });

  const { quotes, accepted, agreed } = agreedOf(c, m.quotations);
  return { caseId: c.id, ref: c.ref, agreed, ...t, clientAccount, clientBalance: clientAccount, bills, quotes, accepted, clientLedger, officeLedger };
};

/** Files that belong to a client: Case.clientId (comma list), the parties list, or the client name. */
export const casesOfClient = (client: Pick<Client, 'id' | 'name'>, cases: Case[]): Case[] => {
  const nm = (client.name || '').trim().toLowerCase();
  return cases.filter((cs) => {
    if (String(cs.clientId || '').split(',').map((s) => s.trim()).includes(client.id)) return true;
    if ((cs.clientsList || []).some((p) => p.clientId === client.id || p.id === client.id || (!!nm && (p.name || '').trim().toLowerCase() === nm))) return true;
    if ((cs.caseParties || []).some((p) => p.side === 'client' && (p.clientId === client.id || (!!nm && (p.name || '').trim().toLowerCase() === nm)))) return true;
    return !!nm && (cs.clientName || '').trim().toLowerCase() === nm;
  });
};

/** True while a file is still open (not closed or archived). */
export const isOpenFile = (c: Pick<Case, 'status'>) => c.status === 'Active' || c.status === 'Pending';

interface ClientMoney extends MoneyTotals {
  files: FileMoney[];
  /** Every bill for the client (its files, plus bills raised to the client without a file), newest first. */
  bills: MoneyBill[];
  /** Client-account entries for the client (its files, plus entries with no file), oldest first. */
  ledger: LedgerLine[];
}

/** Totals across a client's files. Bills / ledger entries tagged to the client but to no file count too. */
export const moneyForClient = (client: Pick<Client, 'id' | 'name'>, cases: Case[], m: MoneySources): ClientMoney => {
  const mine = casesOfClient(client, cases);
  const files = mine.map((c) => moneyForFile(c, m));
  const onMine = (caseId?: string, fileRef?: string) => mine.some((c) => onFile(c, caseId, fileRef));
  const invs = m.invoices.filter((i) => i.status !== 'Voided' && (mine.some((c) => invoiceOnCase(i, c)) || i.clientId === client.id));
  const bills = invs.map((inv) => billOf(inv, m.payments, m.receipts)).sort((a, b) => byDate(b, a));
  const ledger = clientLedgerOf(m.retainers.filter((r) => onMine(r.caseId) || r.clientId === client.id));
  const t = totalsOfBills(bills);
  return {
    files, bills, ledger,
    agreed: sum(files.map((f) => f.agreed)),
    ...t,
    clientAccount: ledger.length ? ledger[ledger.length - 1].bal : 0,
  };
};

/** Sum of several files' figures (Fees by file totals row). */
export const sumMoney = (list: MoneyTotals[]): MoneyTotals => ({
  agreed: sum(list.map((x) => x.agreed)),
  billed: sum(list.map((x) => x.billed)),
  received: sum(list.map((x) => x.received)),
  outstanding: sum(list.map((x) => x.outstanding)),
  writtenOff: sum(list.map((x) => x.writtenOff)),
  clientAccount: sum(list.map((x) => x.clientAccount)),
});

/** Billing › Fees by file filters. "Not billed" = billed less than 25% of the agreed fee. */
export type FeesFilter = 'All' | 'Owing' | 'Not billed';
export const FEES_FILTERS: FeesFilter[] = ['All', 'Owing', 'Not billed'];
export const feesFilter = (f: FeesFilter, x: Pick<MoneyTotals, 'agreed' | 'billed' | 'outstanding'>): boolean =>
  f === 'All' ? true : f === 'Owing' ? x.outstanding > 0.005 : x.agreed > 0 && x.billed < x.agreed * 0.25;

/** Billed as a whole % of agreed (0 when nothing agreed), capped at 100 for the bar. */
export const billedPct = (x: Pick<MoneyTotals, 'agreed' | 'billed'>) => (x.agreed > 0 ? Math.min(100, Math.round((x.billed / x.agreed) * 100)) : 0);
