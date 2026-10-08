/**
 * Accounts & Finance — shared derivations over REAL app data (useApp()).
 *
 * Every number here comes from existing records: invoices / payments / receipts / quotations /
 * retainers (client account) / time entries / expenses / vouchers / claims / payslips / GL.
 * Where the app keeps an existing calculation, it is reused exactly so figures match across
 * the app:
 *   - client-account balance: Deposit − Apply − Refund per client/matter (AccountingViews
 *     RetainersView, dashboard/ClientAccountTab);
 *   - debtor ageing: balance = total − payments, days from due date (AccountingCentreView),
 *     voided invoices excluded, part-paid invoices count only their remaining balance;
 *   - work not billed: billable && !billed && !writtenOff time + expenses (dashboard/FinanceTab);
 *   - SST: billingEngine.computeTotals (fees + reimbursements, never disbursements).
 */
import type React from 'react';
import type { Invoice, Quotation, QuotationLineItem, Receipt, Case, Client, FinanceProof } from '../../../types';
import { DRIVE_REQUIRED_MSG, activeStorage, storeFinanceProof } from '../../../services/fileStorageService';
import { driveViewUrl } from '../../../services/googleDriveService';
import { computeTotals } from '../../../lib/billingEngine';
import { type DocLines, type DocLine, type FinanceDoc, areaFromName, TERMS, defaultSstRate } from '../../../lib/financeDocs';

/* ------------------------------ inline-style helper ------------------------------ */
// The design's inline styles are final — they are copied verbatim as CSS strings and turned
// into React style objects here, so every value stays byte-identical to the design.
const cssCache = new Map<string, React.CSSProperties>();
export const css = (s: string): React.CSSProperties => {
  const hit = cssCache.get(s);
  if (hit) return hit;
  const out: Record<string, string> = {};
  s.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    out[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  cssCache.set(s, out as React.CSSProperties);
  return out as React.CSSProperties;
};

/* ------------------------------ formatting ------------------------------ */
export const rm = (n: number) => 'RM ' + Math.round(n || 0).toLocaleString('en-MY');
export const rm2 = (n: number) => 'RM ' + (n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON = MONTHS.map((m) => m.slice(0, 3));

/** Date parsing / month bucketing: lib/financeCalc (full ISO timestamps → LOCAL day, so a
 * payment at 07:30 MYT on the 1st is on the 1st, not the previous day). */
export { parseDate, periodKey, inPeriod } from '../../../lib/financeCalc';
import { parseDate, isStatutoryCategory } from '../../../lib/financeCalc';
export const isoOf = (t: number) => { if (!t) return ''; const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const todayIso = () => isoOf(Date.now());
/** dd.mm.yyyy — the firm's document date format. */
export const fd = (s: unknown) => { const t = typeof s === 'number' ? s : parseDate(s); if (!t) return '—'; const x = new Date(t); return String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear(); };
/** "12 Jun" */
export const dShort = (s: unknown) => { const t = typeof s === 'number' ? s : parseDate(s); if (!t) return '—'; const x = new Date(t); return x.getDate() + ' ' + MON[x.getMonth()]; };
export const daysSince = (s: unknown, now = Date.now()) => { const t = parseDate(s); return t ? Math.floor((now - t) / 86400000) : 0; };
export const monthEnd = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const initials = (name?: string) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '—';
export const num0 = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

/* ------------------------------ colours (design maps) ------------------------------ */
export const SC: Record<string, [string, string]> = { Overdue: ['#FBEDE9', '#B23A2E'], 'Part-paid': ['#FBF2E9', '#8A6534'], Sent: ['#E7EEF6', '#2F5680'], Paid: ['#E6EFE9', '#2F6F4E'], Draft: ['#F0F2F5', '#5B6478'], Accepted: ['#E6EFE9', '#2F6F4E'], Expired: ['#F0F2F5', '#5B6478'], Unpaid: ['#FBF2E9', '#8A6534'], Issued: ['#E6EFE9', '#2F6F4E'], 'Proforma made': ['#E7EEF6', '#2F5680'], Invoiced: ['#E7EEF6', '#2F5680'], 'Pending Approval': ['#FBF2E9', '#8A6534'], Ready: ['#E7EEF6', '#2F5680'], Declined: ['#F0F2F5', '#5B6478'], Voided: ['#F0F2F5', '#94A3B8'], Historical: ['#F1EBF6', '#6B3D8C'] };
const PC: Record<string, string> = { SH: '#16223A', AH: '#3D6B9C', ZA: '#6B3D8C' };
export const picColor = (code: string) => PC[code] || '#2E7D7A';

/* ------------------------------ documents ------------------------------ */
export const itemAmount = (i: QuotationLineItem) => {
  const q = Number(i.quantity ?? 1), u = Number(i.unitPrice ?? i.amount ?? 0);
  const t = i.chargeType === 'Per Quantity' ? q * u : (i.unitPrice != null ? u : Number(i.amount || 0));
  return Number.isFinite(t) ? t : 0;
};
const itemsToLines = (items?: QuotationLineItem[], fallback?: { desc: string; amount: number }): DocLines => {
  const L: DocLines = { prof: [], disb: [], reimb: [] };
  (items || []).forEach((i) => {
    // Old invoices stored SST as a {category:'Tax'} line: SST is recomputed, so never turn it into a fee.
    if ((i.category as string) === 'Tax') return;
    const row: DocLine = [i.description || '', itemAmount(i)];
    if (i.category === 'Disbursement') L.disb.push(row);
    else if (i.category === 'Reimbursement') L.reimb.push(row);
    else L.prof.push(row);
  });
  if (!L.prof.length && !L.disb.length && !L.reimb.length && fallback && fallback.amount) L.prof.push([fallback.desc, fallback.amount]);
  return L;
};
export const linesToItems = (L: DocLines, previous?: QuotationLineItem[]): QuotationLineItem[] => {
  const sro = new Set((previous || []).filter((p) => p.category === 'Fee - SRO').map((p) => p.description));
  const mk = (cat: QuotationLineItem['category']) => ([d, a]: DocLine): QuotationLineItem => ({ description: d, category: cat === 'Fee - Fixed' && sro.has(d) ? 'Fee - SRO' : cat, amount: Number(a) || 0, quantity: 1, unitPrice: Number(a) || 0, chargeType: 'Fixed' });
  return [...L.prof.map(mk('Fee - Fixed')), ...L.disb.map(mk('Disbursement')), ...L.reimb.map(mk('Reimbursement'))].filter((i) => i.description.trim() || i.amount);
};
/** Stored totals for a record — billingEngine.computeTotals (SST on fees + reimbursements only). */
export const recordTotals = (items: QuotationLineItem[], rate: number) => computeTotals(items, rate > 0, rate || 0.08);

/** SST rate actually used by an existing record. */
export const recordSstRate = (r: { sstApplied?: boolean; sstRate?: number; tax?: number; total?: number; amount?: number }, fallback = defaultSstRate()): number => {
  if ('sstApplied' in r && r.sstApplied === false) return 0;
  if (r.sstRate != null) return r.sstRate;
  if ('sstApplied' in r && r.sstApplied) return fallback || 0.08;
  if (r.tax && r.tax > 0) return fallback || 0.08;
  return 0;
};

export interface Lookups {
  clientById: Map<string, Client>;
  clientByName: Map<string, Client>;
  caseById: Map<string, Case>;
  caseByRef: Map<string, Case>;
}
export const findCase = (lk: Lookups, key?: string, ref?: string) => (key && (lk.caseById.get(key) || lk.caseByRef.get(key))) || (ref ? lk.caseByRef.get(ref) : undefined);
export const addrOf = (c?: Client) => (c?.address || '').trim();

export const quotationToDoc = (q: Quotation, lk: Lookups, status: string): FinanceDoc => {
  const kase = findCase(lk, q.caseId, q.fileRef);
  const client = (q.partyId && lk.clientById.get(q.partyId)) || lk.clientByName.get((q.clientName || '').toLowerCase());
  const area = areaFromName(q.practiceArea, q.fileRef);
  const rate = recordSstRate(q);
  return {
    id: q.id, type: q.documentType === 'Proforma' ? 'Proforma' : 'Quotation', no: q.id, date: fd(q.date), client: q.clientName || '—', addr: addrOf(client),
    ref: q.fileRef || '', matter: q.matter || kase?.title || q.subtype || '', area, account: q.payInto || 'Office', status,
    lines: itemsToLines(q.lineItems, { desc: 'Professional fees', amount: q.total }), sstRate: rate,
    subject: q.subject, yourRef: q.yourRef, tin: q.tin, desc: q.scope ?? '', terms: q.terms || (q.documentType === 'Proforma' ? [] : TERMS.slice()), inst: !q.paymentPlan || q.paymentPlan.kind === 'Instalments' ? q.feeArrangement || null : null, plan: q.paymentPlan,
    proofs: [],
  };
};
export const invoiceToDoc = (inv: Invoice, lk: Lookups, status: string): FinanceDoc => {
  const kase = findCase(lk, inv.caseId, inv.fileRef);
  const client = lk.clientById.get(inv.clientId) || lk.clientByName.get((inv.partyName || '').toLowerCase());
  const area = areaFromName(kase?.practiceArea || kase?.type, inv.fileRef || kase?.ref);
  return {
    id: inv.id, type: 'Invoice', no: inv.id, date: fd(inv.date), client: inv.partyName || client?.name || '—', addr: addrOf(client),
    ref: inv.fileRef || kase?.ref || '', matter: inv.matter || kase?.title || '', area, account: inv.payInto || 'Office', status,
    lines: itemsToLines(inv.lineItems, { desc: 'Professional fees', amount: Number(inv.amount || inv.total || 0) }), sstRate: recordSstRate(inv),
    subject: inv.subject, yourRef: inv.yourRef, tin: inv.tin, desc: inv.scope ?? '', inst: inv.feeArrangement || null,
    deposit: Number(inv.depositApplied || 0) || undefined,
    due: inv.dueDate ? fd(inv.dueDate) : undefined, einv: inv.eInvoiceStatus && inv.eInvoiceStatus !== 'Not Submitted' ? inv.eInvoiceStatus : '—',
  };
};
export const receiptAccount = (r: Receipt) => (r.accountSet === 'CLIENT' ? 'Client account' : 'Office') as 'Office' | 'Client account';
export const receiptToDoc = (r: Receipt, lk: Lookups, proofs: { name: string; url: string }[]): FinanceDoc => {
  const client = lk.clientById.get(r.clientId) || lk.clientByName.get((r.receivedFrom || '').toLowerCase());
  const kase = findCase(lk, r.caseId, r.fileRef);
  return {
    id: r.id, type: 'Receipt', no: r.id, date: fd(r.date), client: r.receivedFrom || client?.name || '—', addr: addrOf(client),
    ref: r.fileRef || '', matter: kase?.title || r.description || '', area: kase ? areaFromName(kase.practiceArea || kase.type, kase.ref) : '',
    account: receiptAccount(r), status: 'Issued', amount: Number(r.amount || 0), method: r.paymentMethod || (r as unknown as { method?: string }).method || '-',
    forNo: r.forNo || r.invoiceId || r.quotationId || r.description, proofs, historical: r.historical,
  };
};

/* ------------------------------ proofs (session file cache + Google Drive) ------------------------------ */
// Proof metadata is synced on the record. The file is uploaded to the firm Google Drive
// (`Finance proofs/<YYYY>/`) in the background and the record is then patched with the Drive
// file id / link (see useFinanceController's proof-upload effect), so it opens on any device;
// until then it is viewable in this session through an object URL. Attaching is BLOCKED when
// Drive storage is not set up (callers check proofUploadBlocked() first; filesToProofs then
// returns nothing), so no record ends up holding a name-only proof any more.
const proofUrls = new Map<string, string>();
const proofKey = (owner: string, name: string) => owner + '::' + name;
/** Identifies one attached file across records (the same proof object can be copied onto a receipt too). */
export const proofSig = (p: Pick<FinanceProof, 'name' | 'size' | 'uploadedAt'>) => p.name + '|' + (p.size || 0) + '|' + p.uploadedAt;
type ProofUpload = { ok: true; driveFileId?: string; webViewLink?: string; uploadedBy?: string } | { ok: false; error: string; name: string };
const proofUploads = new Map<string, ProofUpload>();
const proofListeners = new Set<() => void>();
let proofUploader = '';
/** Who is attaching proofs in this session (set by the finance controller). */
export const setProofUploader = (name: string) => { proofUploader = name; };
const driveProofFor = (p: Pick<FinanceProof, 'name' | 'size' | 'uploadedAt'>) => { const r = proofUploads.get(proofSig(p)); return r && 'driveFileId' in r ? r : undefined; };
export const proofUploadResults = () => proofUploads;
export const subscribeProofUploads = (fn: () => void) => { proofListeners.add(fn); return () => { proofListeners.delete(fn); }; };
const notifyProofs = () => proofListeners.forEach((fn) => fn());
export const filesToProofs = (owner: string, files: FileList | File[] | null | undefined): FinanceProof[] => {
  const arr = files ? Array.from(files as ArrayLike<File>) : [];
  if (proofUploadBlocked()) return [];
  return arr.map((f) => {
    proofUrls.set(proofKey(owner, f.name), URL.createObjectURL(f));
    const p: FinanceProof = { name: f.name, size: f.size, type: f.type, uploadedAt: new Date().toISOString() };
    const sig = proofSig(p);
    const ref = owner === 'form' ? '' : owner.slice(owner.indexOf(':') + 1);
    storeFinanceProof(f, proofUploader || 'Accounts', ref)
      .then((r) => { proofUploads.set(sig, { ok: true, ...r }); notifyProofs(); })
      .catch((e) => { proofUploads.set(sig, { ok: false, name: f.name, error: e instanceof Error ? e.message : String(e) }); notifyProofs(); });
    return p;
  });
};
/** Proofs can only be attached once Google Drive storage is set up (message: DRIVE_REQUIRED_MSG). */
export const proofUploadBlocked = () => activeStorage() !== 'drive';
export { DRIVE_REQUIRED_MSG };
const proofUrl = (owner: string, name: string) => proofUrls.get(proofKey(owner, name)) || '';
/** Best link for a proof: its Drive page (saved on the record, or just uploaded), else this session's copy. */
export const proofLink = (owner: string, p: Pick<FinanceProof, 'name' | 'size' | 'uploadedAt' | 'webViewLink' | 'driveFileId'>) =>
  driveViewUrl(p) || driveViewUrl(driveProofFor(p) || {}) || proofUrl(owner, p.name);
/** What to say when a proof has no openable copy. */
export const proofMissingMsg = (name: string) => name + (activeStorage() === 'drive'
  ? ' (only the file name was kept: it was attached before Google Drive storage was set up, or its upload did not finish)'
  : ' (file not stored: only the file name was kept, from before uploads went to Google Drive)');
export const rememberProofUrls = (fromOwner: string, toOwner: string, proofs: FinanceProof[]) => {
  proofs.forEach((p) => { const u = proofUrls.get(proofKey(fromOwner, p.name)); if (u) proofUrls.set(proofKey(toOwner, p.name), u); });
};

/* ------------------------------ GL accounts (Chart of Accounts codes) ------------------------------ */
export const GLA = {
  office: '1010 - Office Bank — General',
  petty: '1013 - Petty Cash',
  disb: '1014 - Disbursement Bucket',
  clientBank: '1020 - Client Bank — Trust',
  ar: '1100 - Accounts Receivable',
  unbilledDisb: '1200 - Unbilled Disbursements',
  clientFunds: '2010 - Client Funds Held',
  referral: '2020 - Referral Fees Payable',
  payable: '2100 - Accounts Payable',
  feesAdvance: '2110 - Fees Received in Advance',
  sst: '2200 - SST Payable',
  statutory: '2300 - Statutory Payable (EPF/SOCSO/EIS/PCB)',
  drawings: "3100 - Partners' Drawings",
  fees: '4000 - Fee Income',
  disbRec: '4100 - Disbursement Recovery',
  salaries: '5000 - Salaries & Wages',
  software: '5200 - Software & Subscriptions',
  other: '5900 - Other Expenses',
  suspense: '9990 - Journal Adjustments',
} as const;
export const glCode = (s: string) => (String(s || '').match(/^\s*(\d{3,5})/) || [])[1] || '';
export const cashAccountGL = (acc: string) => (acc === 'Client account' ? GLA.clientBank : acc === 'Petty cash' ? GLA.petty : acc === 'Disbursement' ? GLA.disb : GLA.office);
export const expenseGL = (cat: string) => (isStatutoryCategory(cat) ? GLA.statutory : /salar|payroll|wage/i.test(cat) ? GLA.salaries : /\bit\b|software|subscri/i.test(cat) ? GLA.software : GLA.other);

/** GL debit for an office payment voucher when it is paid. Disbursements are recoverable from the
 * client (asset 1200, cleared when billed); statutory / SST remittances settle what is owed
 * (2300 / 2200); partner drawings are equity (3100). Everything else is an office expense. */
export const pvDebitGL = (cat?: string) => (cat === 'Disbursement' || cat === 'Client Disb' ? GLA.unbilledDisb : cat === 'Statutory (EPF/SOCSO/EIS/PCB)' ? GLA.statutory : cat === 'SST to Customs' ? GLA.sst : cat === 'Partner drawings' ? GLA.drawings : GLA.other);
