/**
 * Accounts & Finance controller — the React equivalent of the design prototype's `Component`
 * class (state, derived values and every interaction), but reading and writing REAL app data
 * through useApp(). Tabs and modals are pure renderers of what this returns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type {
  Case, Expense, FinanceProof, FinanceSignatory, GeneralLedgerEntry, Invoice, ManualJournal, Payslip,
  PaymentVoucher, Quotation, Receipt, Retainer, TravelClaim, User,
} from '../../../types';
import { getPracticeSettings, savePracticeSettings, twoSignatoryThreshold, type SinkingFund } from '../../../services/templateService';
import { computeTotals } from '../../../lib/billingEngine';
import { identityTokens, isMine } from '../../../lib/identity';
import * as SD from '../../../lib/financeDocs';
import { statutoryForPayslip, STATUTORY_VERSION } from '../../../lib/statutory';
import { finRoleKey, finTabsFor, FIN_TABS, type FinTab } from '../../../lib/financeAccess';
import {
  GLA, MONTHS, MON, SC, addrOf, cashAccountGL, daysSince, dShort, expenseGL, fd, filesToProofs, findCase, initials,
  invoiceToDoc, inPeriod, isoOf, itemAmount, linesToItems, monthEnd, num0, parseDate, periodKey, picColor, proofUrl,
  quotationToDoc, receiptAccount, receiptToDoc, recordSstRate, recordTotals, rememberProofUrls, rm, rm2, todayIso, type Lookups,
} from './financeModel';

export type DocKind = 'quotation' | 'invoice' | 'receipt';
export interface DocRef { kind: DocKind; id: string }
export interface EditorState {
  kind?: DocKind; id?: string; type: 'Quotation' | 'Proforma' | 'Invoice';
  client: string; ref: string; matter: string; area: string; account: 'Office' | 'Client account';
  lines: SD.DocLines; yourRef: string; tin: string; subject: string; desc: string; arrangement: string; sstRate: number;
  inst: SD.DocInstalments | null;
}
export interface FormState { kind: string; vals: Record<string, any> }
export interface ImportState { src: 'Template' | 'Bank' | 'Software'; acc: 'Office' | 'Client account' | 'Petty cash'; raw: string[][] | null; fileName: string }

export interface ApItem {
  key: string; kind: 'travel' | 'expense' | 'pv' | 'journal' | 'writeoff' | 'referral'; id: string;
  type: 'Staff claim' | 'Payment voucher' | 'Client account' | 'Referral fees' | 'Write-off';
  title: string; sub: string; amount: number; by: string; clientAccount: boolean; signatories: FinanceSignatory[];
}
export interface PayItem {
  key: string; kind: 'travel' | 'expense' | 'pv'; id: string; no: string; payee: string; what: string;
  method: 'Bank transfer' | 'Online portal' | 'Cheque' | 'To staff bank'; details: string; from: 'Office' | 'Disbursement' | 'Client account'; amount: number;
}
export interface CbRow {
  key: string; t: number; who: string; what: string; no: string; inn: number; out: number; src: 'Auto' | 'Historical' | 'Manual';
  proofs: FinanceProof[]; owner: string; open?: () => void; attach?: (files: FileList | null) => void;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const CASH_ACCS = ['Office', 'Client account', 'Disbursement', 'Petty cash'] as const;
export type CashAcc = (typeof CASH_ACCS)[number];

export function useFinanceController(initialTab: FinTab) {
  const app = useApp();
  const {
    currentUser, currentRole, isAdmin, currentPartnerCode, users, clients, cases, quotations, invoices, payments, receipts,
    paymentVouchers, retainers, timeEntries, expenses, travelClaims, bankAccounts, bankReconciliationEntries, generalLedger,
    threeWayRec, referralPartners, payslips, manualJournals, setCurrentView,
  } = app;

  const rk = finRoleKey(currentRole, currentUser, isAdmin);
  const isMP = rk === 'M';
  const canApprove = rk === 'M' || rk === 'P';
  const canPrepare = rk === 'M' || rk === 'A';
  const me = currentUser?.name || 'You';
  const TABS = finTabsFor(rk);

  /* ------------------------------ UI state ------------------------------ */
  const [tab, setTabState] = useState<FinTab>(initialTab);
  useEffect(() => { setTabState(initialTab); }, [initialTab]);
  const visibleTab: FinTab = TABS.some((t) => t[0] === tab) ? tab : (TABS[0]?.[0] || 'overview');
  const go = useCallback((t: FinTab) => { setTabState(t); const row = FIN_TABS.find((x) => x[0] === t); if (row) setCurrentView(row[3]); }, [setCurrentView]);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const toastMsg = useCallback((m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2800); }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { SD.loadLogos(); }, []);

  const [docT, setDocT] = useState<'Quotation' | 'Proforma' | 'Invoice' | 'Receipt'>('Invoice');
  const [invF, setInvF] = useState('All');
  const [apF, setApF] = useState('All');
  const [ledgerKey, setLedgerKey] = useState<string>('');
  const [slipUser, setSlipUser] = useState<string>('');
  const [cbAcc, setCbAcc] = useState<CashAcc>('Office');
  const [fundEdit, setFundEdit] = useState(false);
  const [fundsDraft, setFundsDraft] = useState<SinkingFund[] | null>(null);
  const [view, setView] = useState<DocRef | null>(null);
  const [ed, setEd] = useState<EditorState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [imp, setImp] = useState<ImportState | null>(null);
  const [billed, setBilled] = useState<Record<string, { inv: string; u: any }>>({});
  const [decided, setDecided] = useState<Record<string, { d: 'ok' | 'no'; item: ApItem }>>({});
  const [paidNow, setPaidNow] = useState<Record<string, { item: PayItem; file: string }>>({});
  const faKey = 'SHCO_FINANCE_ALERTS_READ_' + (currentUser?.id || 'me');
  const [faRead, setFaRead] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(faKey) || '{}'); } catch { return {}; } });
  const markRead = (ids: string[]) => setFaRead((prev) => { const next = { ...prev }; ids.forEach((i) => { next[i] = true; }); try { localStorage.setItem(faKey, JSON.stringify(next)); } catch { /* storage unavailable */ } return next; });

  /* ------------------------------ settings (sinking funds, close checklist…) ------------------------------ */
  const [settingsV, setSettingsV] = useState(0);
  useEffect(() => { const on = () => setSettingsV((v) => v + 1); window.addEventListener('shco-practice-settings-updated', on); return () => window.removeEventListener('shco-practice-settings-updated', on); }, []);
  const settings = useMemo(() => getPracticeSettings(), [settingsV]);
  const saveSettings = (patch: Partial<ReturnType<typeof getPracticeSettings>>) => savePracticeSettings({ ...getPracticeSettings(), ...patch });

  /* ------------------------------ dates ------------------------------ */
  const now = new Date();
  const period = periodKey(now);
  const monthName = MONTHS[now.getMonth()];
  const monShort = MON[now.getMonth()];
  const lastDay = monthEnd(now);
  const lastDayLabel = lastDay.getDate() + ' ' + monShort;
  const nextMonShort = MON[(now.getMonth() + 1) % 12];
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = periodKey(prevDate);

  /* ------------------------------ lookups & scope ------------------------------ */
  const lk: Lookups = useMemo(() => ({
    clientById: new Map(clients.map((c) => [c.id, c] as [string, typeof c])),
    clientByName: new Map(clients.map((c) => [norm(c.name), c] as [string, typeof c])),
    caseById: new Map(cases.map((c) => [c.id, c] as [string, Case])),
    caseByRef: new Map(cases.map((c) => [c.ref, c] as [string, Case])),
  }), [clients, cases]);
  const tokens = useMemo(() => identityTokens(currentUser), [currentUser]);
  /** Partners see only the files they handle ("Own files"); everyone else sees all. */
  const ownCase = (c?: Case) => rk !== 'P' || (!!c && ((c.partners || []).includes(currentPartnerCode) || isMine(c.lawyerInCharge, tokens) || isMine(c.lawyers, tokens)));
  const clientName = (id?: string) => (id && lk.clientById.get(id)?.name) || '';
  const staffUser = (nameOrId?: string): User | undefined => users.find((u) => u.id === nameOrId || norm(u.name) === norm(nameOrId));

  /* ------------------------------ invoices & payments ------------------------------ */
  const paidByInvoice = useMemo(() => { const m = new Map<string, number>(); payments.forEach((p) => m.set(p.invoiceId, (m.get(p.invoiceId) || 0) + Number(p.amount || 0))); return m; }, [payments]);
  const invPaid = (inv: Invoice) => paidByInvoice.get(inv.id) || 0;
  /** Remaining balance — voided invoices never count; part-paid count only what is left. */
  const invBal = (inv: Invoice) => (inv.status === 'Voided' ? 0 : Math.max(0, Number(inv.total || 0) - invPaid(inv) - Number(inv.writtenOff || 0)));
  const invIssued = (inv: Invoice) => !['Draft', 'Pending Review', 'Voided'].includes(inv.status);
  const invStatus = (inv: Invoice): string => {
    if (inv.status === 'Voided') return 'Voided';
    if (inv.status === 'Draft' || inv.status === 'Pending Review') return 'Draft';
    const bal = invBal(inv);
    if (bal <= 0.005) return (inv.writtenOff || 0) > 0 && invPaid(inv) < Number(inv.total || 0) - 0.005 ? 'Written off' : 'Paid';
    const due = parseDate(inv.dueDate);
    if (due && due < Date.now() - 86400000) return 'Overdue';
    if (invPaid(inv) > 0) return 'Part-paid';
    return inv.historical ? 'Historical' : 'Sent';
  };
  const invCase = (inv: Invoice) => findCase(lk, inv.caseId, inv.fileRef);
  const scopedInvoices = useMemo(() => invoices.filter((i) => ownCase(invCase(i))), [invoices, rk, lk, currentPartnerCode]);
  /** Debtor ageing — AccountingCentreView's rule (days from due date, else issue date). */
  const ageDays = (inv: Invoice) => { const due = inv.dueDate || inv.date; return due ? Math.max(0, daysSince(due)) : 0; };
  const openInvoices = scopedInvoices.filter((i) => invIssued(i) && invBal(i) > 0.005);
  const owedTotal = openInvoices.reduce((s, i) => s + invBal(i), 0);
  const aging = [[0, 30], [31, 60], [61, 90], [91, Infinity]].map(([a, b]) => openInvoices.filter((i) => { const d = ageDays(i); return d >= a && d <= b; }).reduce((s, i) => s + invBal(i), 0));

  /* ------------------------------ quotations / proformas / receipts ------------------------------ */
  const qCase = (q: Quotation) => findCase(lk, q.caseId, q.fileRef);
  const receiptsFor = (docId: string) => receipts.filter((r) => r.quotationId === docId || r.forNo === docId);
  const proformaPaid = (q: Quotation) => receiptsFor(q.id).reduce((s, r) => s + Number(r.amount || 0), 0);
  const qStatus = (q: Quotation): string => {
    if (q.documentType === 'Proforma') {
      if (['Draft', 'Pending Approval'].includes(q.status)) return 'Draft';
      if (q.status === 'Declined') return 'Declined';
      return proformaPaid(q) >= Number(q.total || 0) - 0.005 && q.total > 0 ? 'Paid' : 'Unpaid';
    }
    if (invoices.some((i) => i.quotationId === q.id && i.status !== 'Voided')) return 'Invoiced';
    if (quotations.some((p) => p.documentType === 'Proforma' && p.sourceQuotationId === q.id)) return 'Proforma made';
    if (q.status === 'Sent' && daysSince(q.documentSentDate || q.date) > (q.validityDays || Number(settings.quotationValidityDays) || 30)) return 'Expired';
    return q.status;
  };
  const scopedQuotations = useMemo(() => quotations.filter((q) => q.subtype !== 'Consultation' || true).filter((q) => ownCase(qCase(q))), [quotations, rk, lk, currentPartnerCode]);
  const scopedReceipts = useMemo(() => receipts.filter((r) => ownCase(findCase(lk, r.caseId, r.fileRef))), [receipts, rk, lk, currentPartnerCode]);

  const actionsFor = (kind: DocKind, rec: Quotation | Invoice | Receipt): string[] => {
    if (kind === 'receipt') return ['View'];
    if (kind === 'invoice') { const S = invStatus(rec as Invoice); return S === 'Draft' ? ['Issue'] : S === 'Paid' ? ['View receipt'] : S === 'Voided' || S === 'Written off' ? ['View'] : S === 'Overdue' ? ['Remind', 'Record paid'] : ['Record paid', 'Remind']; }
    const q = rec as Quotation, S = qStatus(q);
    if (q.documentType === 'Proforma') return S === 'Draft' ? ['Send'] : S === 'Paid' ? ['View receipt'] : S === 'Declined' ? ['View'] : ['Record payment', 'Remind'];
    return ['Draft', 'Pending Approval', 'Ready'].includes(S) ? ['Send'] : S === 'Sent' ? ['Mark accepted', 'Resend'] : S === 'Accepted' ? ['Make proforma', 'Convert to invoice'] : S === 'Expired' ? ['Resend'] : ['View'];
  };

  /* ------------------------------ documents (FinanceDoc for docHtml) ------------------------------ */
  const docProofs = (owner: string, proofs?: FinanceProof[]) => (proofs || []).map((p) => ({ name: p.name, url: proofUrl(owner, p.name) }));
  const buildDoc = (ref: DocRef): SD.FinanceDoc | null => {
    if (ref.kind === 'invoice') { const inv = invoices.find((i) => i.id === ref.id); return inv ? invoiceToDoc(inv, lk, invStatus(inv)) : null; }
    if (ref.kind === 'quotation') { const q = quotations.find((i) => i.id === ref.id); return q ? quotationToDoc(q, lk, qStatus(q)) : null; }
    const r = receipts.find((i) => i.id === ref.id); return r ? receiptToDoc(r, lk, docProofs(r.id, r.proofs)) : null;
  };
  const recordOf = (ref: DocRef): Quotation | Invoice | Receipt | undefined => (ref.kind === 'invoice' ? invoices.find((i) => i.id === ref.id) : ref.kind === 'quotation' ? quotations.find((i) => i.id === ref.id) : receipts.find((i) => i.id === ref.id));

  /* ------------------------------ GL posting ------------------------------ */
  const postGL = (entries: Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>[]) => {
    let base = generalLedger.length ? Math.max(...generalLedger.map((g) => Number(g.glNo) || 0)) : 1000;
    entries.filter((e) => Number(e.amount) > 0).forEach((e) => { base += 1; app.addGeneralLedgerEntry({ ...e, amount: Math.round(Number(e.amount) * 100) / 100, reconciled: 'N', glNo: base }); });
  };
  /** Several ids of one kind inside a single action (getNextSequenceId only advances on re-render). */
  const seqIds = (type: Parameters<typeof app.getNextSequenceId>[0], n: number): string[] => {
    const first = app.getNextSequenceId(type);
    const m = first.match(/^(.*?)(\d+)$/);
    if (!m || n <= 1) return [first];
    const out = [first];
    for (let i = 1; i < n; i++) out.push(m[1] + String(Number(m[2]) + i).padStart(m[2].length, '0'));
    return out;
  };

  /* ------------------------------ client account (SAR 1990) ------------------------------ */
  interface Ledger { key: string; clientId: string; caseId: string; client: string; ref: string; balance: number; last: string; entries: Retainer[] }
  const ledgers: Ledger[] = useMemo(() => {
    const m = new Map<string, Ledger>();
    retainers.forEach((r) => {
      const key = `${r.clientId}|${r.caseId || ''}`;
      const g = m.get(key) || { key, clientId: r.clientId, caseId: r.caseId || '', client: clientName(r.clientId) || r.clientId || '—', ref: '', balance: 0, last: '', entries: [] };
      g.balance += r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0);
      if (!g.last || parseDate(r.date) > parseDate(g.last)) g.last = r.date;
      g.entries.push(r);
      m.set(key, g);
    });
    return [...m.values()].map((g) => { const k = findCase(lk, g.caseId); return { ...g, ref: k ? `${k.ref}${k.title ? ' · ' + k.title : ''}` : g.caseId ? g.caseId : 'no matter linked' }; })
      .filter((g) => ownCase(findCase(lk, g.caseId)) || rk !== 'P')
      .sort((a, b) => b.balance - a.balance);
  }, [retainers, lk, rk]);
  const clientLedgerBalance = (clientId: string, caseId?: string) => retainers.filter((r) => r.clientId === clientId && (caseId == null || (r.caseId || '') === (caseId || ''))).reduce((s, r) => s + (r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);
  const trustTotal = retainers.reduce((s, r) => s + (r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);
  const ledgerTotalAt = (end: Date) => retainers.filter((r) => { const t = parseDate(r.date); return t && t <= end.getTime(); }).reduce((s, r) => s + (r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);

  /* ------------------------------ work not billed (WIP) ------------------------------ */
  interface Unbilled { caseId: string; kase?: Case; client: string; ref: string; title: string; pic: string; time: number; disb: number; oldest: number; te: typeof timeEntries; ex: Expense[] }
  const unbilled: Unbilled[] = useMemo(() => {
    const m = new Map<string, Unbilled>();
    const get = (caseId: string) => { const k = findCase(lk, caseId); const key = k?.id || caseId || '—'; let u = m.get(key); if (!u) { u = { caseId: key, kase: k, client: k ? (clientName(k.clientId.split(',')[0].trim()) || k.clientName || '—') : '—', ref: k?.ref || caseId || '—', title: k?.title || '', pic: k ? ((k.partners || [])[0] || initials(k.lawyerInCharge)) : '—', time: 0, disb: 0, oldest: 0, te: [], ex: [] }; m.set(key, u); } return u; };
    timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff).forEach((t) => { const u = get(t.caseId); u.time += Number(t.hours || 0) * Number(t.rate || 0); u.te.push(t); u.oldest = Math.max(u.oldest, daysSince(t.date)); });
    expenses.filter((e) => e.billable && !e.billed && !e.writtenOff).forEach((e) => { const u = get(e.caseId || e.fileRef || ''); u.disb += Number(e.amount || 0); u.ex.push(e); u.oldest = Math.max(u.oldest, daysSince(e.date)); });
    return [...m.values()].filter((u) => u.time + u.disb > 0 && (rk !== 'P' || ownCase(u.kase))).sort((a, b) => b.oldest - a.oldest);
  }, [timeEntries, expenses, lk, rk]);
  const wipTotal = unbilled.reduce((s, u) => s + u.time + u.disb, 0);

  /* ------------------------------ bank accounts ------------------------------ */
  const activeBanks = bankAccounts.filter((b) => b.status !== 'Archived');
  const bankKind = (b: (typeof bankAccounts)[number]): CashAcc => ((b.functions || []).includes('Petty Cash') ? 'Petty cash' : (b.functions || []).includes('Disbursement') ? 'Disbursement' : b.type === 'Trust' || (b.functions || []).includes('Trust Account') ? 'Client account' : 'Office');
  const banksOf = (k: CashAcc) => activeBanks.filter((b) => bankKind(b) === k);
  const bankBal = (k: CashAcc): number | null => { const l = banksOf(k); return l.length ? l.reduce((s, b) => s + Number(b.currentBalance || 0), 0) : null; };
  const lastRecon = (bankId: string) => { const r = bankReconciliationEntries.filter((e) => e.bankAccountId === bankId && e.status === 'Reconciled' && e.reconciledDate).map((e) => e.reconciledDate as string).sort(); return r.length ? r[r.length - 1] : ''; };
  const officeCash = bankBal('Office');

  /* ------------------------------ approvals ------------------------------ */
  const sigLine = (s?: FinanceSignatory[]) => ((s || []).length ? ' · signed by ' + (s || []).map((x) => x.name).join(', ') : '');
  const pvIsClient = (v: PaymentVoucher) => v.accountSet === 'CLIENT';
  const referralFor = (inRange: (date: string) => boolean) => {
    const rows = referralPartners.filter((p) => p.active !== false && p.commissionType !== 'None').map((p) => {
      const cs = cases.filter((c) => c.referredBy && (norm(c.referredBy) === norm(p.name) || norm(c.referredBy) === norm(p.id)));
      const csIds = new Set(cs.flatMap((c) => [c.id, c.ref]));
      const invs = invoices.filter((i) => i.status !== 'Voided' && (csIds.has(i.caseId) || csIds.has(i.fileRef || '')));
      const invById = new Map<string, Invoice>(invs.map((i) => [i.id, i] as [string, Invoice]));
      const pays = payments.filter((pm) => invById.has(pm.invoiceId) && inRange(pm.date));
      const base = pays.reduce((s, pm) => { const inv = invById.get(pm.invoiceId)!; const t = inv.lineItems?.length ? computeTotals(inv.lineItems, false).fees : Number(inv.total || 0) - Number(inv.tax || 0); const ratio = Number(inv.total || 0) > 0 ? Math.min(1, t / Number(inv.total)) : 1; return s + Number(pm.amount || 0) * ratio; }, 0);
      const fee = p.commissionType === 'Percentage' ? base * Number(p.commissionValue || 0) / 100 : base > 0 ? Number(p.commissionValue || 0) : 0;
      const files = [...new Set(pays.map((pm) => { const inv = invById.get(pm.invoiceId)!; return inv.partyName || clientName(inv.clientId) || inv.fileRef || inv.id; }))].join(', ');
      const type = p.type === 'Partner' ? 'Partner' : p.type === 'Internal Staff' ? 'Staff' : 'Outside';
      const via = type === 'Partner' ? 'Partner drawings' : type === 'Staff' ? 'Payslip' : 'Voucher';
      return { id: p.id, name: p.name, type, files, base, flat: p.commissionType === 'Flat', rate: Number(p.commissionValue || 0), fee, via };
    }).filter((r) => r.base > 0);
    return { rows, total: rows.reduce((s, r) => s + r.fee, 0) };
  };
  const referral = useMemo(() => referralFor((d) => inPeriod(d, period)), [referralPartners, cases, invoices, payments, period]);
  const refDecision = (settings.referralFeeApprovals || {})[period];

  const apItems: ApItem[] = useMemo(() => {
    const out: ApItem[] = [];
    travelClaims.filter((t) => t.approvalStatus === 'Pending Approval' || t.approvalStatus === 'Pending PIC Approval').forEach((t) => out.push({ key: 'travel:' + t.id, kind: 'travel', id: t.id, type: 'Staff claim', title: `${t.type === 'Mileage' ? 'Mileage' : t.type}: ${t.purpose || t.to || ''}`.trim(), sub: `${t.claimant} · ${fd(t.date)}${t.fileRef ? ' · ' + t.fileRef : ''}${t.billableClientTotal ? ' · billable' : ''}${sigLine(t.signatories)}`, amount: Number(t.total || 0), by: t.claimant, clientAccount: false, signatories: t.signatories || [] }));
    expenses.filter((e) => e.approvalStatus === 'Pending Approval').forEach((e) => out.push({ key: 'expense:' + e.id, kind: 'expense', id: e.id, type: 'Staff claim', title: e.description || e.category, sub: `${e.claimant || e.payee || '—'} · ${fd(e.date)}${e.fileRef ? ' · ' + e.fileRef : ''}${e.billable ? ' · billable' : ''}${sigLine(e.signatories)}`, amount: Number(e.amount || 0), by: e.claimant || '—', clientAccount: false, signatories: e.signatories || [] }));
    paymentVouchers.filter((v) => v.approvalStatus === 'Pending Approval' && !v.historical).forEach((v) => out.push({ key: 'pv:' + v.id, kind: 'pv', id: v.id, type: pvIsClient(v) ? 'Client account' : 'Payment voucher', title: v.voucherCategory === 'Legal Fees Transfer' ? `Transfer to office for ${v.invoiceId || v.description}` : `${v.payee ? 'Pay ' + v.payee + ': ' : ''}${v.description}`, sub: `${v.id} · ${pvIsClient(v) ? (clientName(v.clientId) || v.clientId) + ' ledger · needs 2 signatories' : v.voucherCategory}${sigLine(v.signatories)}`, amount: Number(v.amount || 0), by: v.preparedBy || '—', clientAccount: pvIsClient(v), signatories: v.signatories || [] }));
    manualJournals.filter((j) => j.status === 'Pending Approval').forEach((j) => out.push({ key: 'journal:' + j.id, kind: 'journal', id: j.id, type: 'Payment voucher', title: `Manual journal ${j.id}: ${j.details}`, sub: `${j.account} · ${j.direction} · ${j.reason || 'adjustment'}${sigLine(j.signatories)}`, amount: Number(j.amount || 0), by: j.preparedBy, clientAccount: j.account === 'Client account', signatories: j.signatories || [] }));
    invoices.filter((i) => i.writeOffRequest?.status === 'Pending').forEach((i) => out.push({ key: 'writeoff:' + i.id, kind: 'writeoff', id: i.id, type: 'Write-off', title: `${i.partyName || clientName(i.clientId) || i.id} unpaid balance`, sub: `${i.id} · ${ageDays(i)} days old · ${i.writeOffRequest!.reason || ''}`, amount: Number(i.writeOffRequest!.amount || 0), by: i.writeOffRequest!.requestedBy, clientAccount: false, signatories: [] }));
    if (referral.total > 0 && !refDecision) out.push({ key: 'referral:' + period, kind: 'referral', id: period, type: 'Referral fees', title: `${monthName} referral fees (${referral.rows.length} referrer${referral.rows.length === 1 ? '' : 's'})`, sub: 'see breakdown below', amount: referral.total, by: 'System', clientAccount: false, signatories: [] });
    return out;
  }, [travelClaims, expenses, paymentVouchers, manualJournals, invoices, referral, refDecision, lk]);
  const pendingAp = apItems.length;

  const approve = (item: ApItem, ok: boolean) => {
    if (!canApprove) { toastMsg('Only partners approve. Accounts prepare.'); return; }
    const at = new Date().toISOString();
    if (!ok) {
      if (item.kind === 'travel') app.updateTravelClaim(item.id, { approvalStatus: 'Rejected', approvedBy: me, approvedAt: at });
      else if (item.kind === 'expense') app.updateExpense(item.id, { approvalStatus: 'Rejected', approvedBy: me, approvedAt: at });
      else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { approvalStatus: 'Rejected', approved: false, rejectedBy: me });
      else if (item.kind === 'journal') app.updateManualJournal(item.id, { status: 'Rejected', decidedBy: me, decidedAt: at });
      else if (item.kind === 'writeoff') { const inv = invoices.find((i) => i.id === item.id); if (inv?.writeOffRequest) app.updateInvoice(inv.id, { writeOffRequest: { ...inv.writeOffRequest, status: 'Rejected', decidedBy: me, decidedAt: at } }); }
      else if (item.kind === 'referral') saveSettings({ referralFeeApprovals: { ...(settings.referralFeeApprovals || {}), [period]: { status: 'Rejected', by: me, at, total: item.amount } } });
      setDecided((d) => ({ ...d, [item.key]: { d: 'no', item } }));
      toastMsg(item.title + ' rejected');
      return;
    }
    if ((item.kind === 'writeoff' || item.kind === 'referral') && !isMP) { toastMsg(item.kind === 'writeoff' ? 'Write-offs need the Managing Partner.' : 'Referral fees are approved by the Managing Partner.'); return; }
    if (item.signatories.some((s) => norm(s.name) === norm(me))) { toastMsg('You have already signed this. It needs another signatory.'); return; }
    const sigs = [...item.signatories, { name: me, at, isManagingPartner: isMP }];
    // Threshold from Firm & Practice Settings → Permissions & limits (default RM 5,000).
    const needTwo = item.clientAccount || item.amount >= twoSignatoryThreshold();
    const complete = item.kind === 'writeoff' || item.kind === 'referral' ? isMP : needTwo ? sigs.length >= 2 && sigs.some((s) => s.isManagingPartner) : true;
    // Client-account payments: the ledger can never go below zero.
    if (item.kind === 'pv' && item.clientAccount) {
      const v = paymentVouchers.find((x) => x.id === item.id);
      if (v && clientLedgerBalance(v.clientId, v.caseId) < Number(v.amount || 0) - 0.005) { toastMsg('Not enough in this client ledger: the client account can never go below zero.'); return; }
    }
    if (!complete) {
      if (item.kind === 'travel') app.updateTravelClaim(item.id, { signatories: sigs });
      else if (item.kind === 'expense') app.updateExpense(item.id, { signatories: sigs });
      else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { signatories: sigs });
      else if (item.kind === 'journal') app.updateManualJournal(item.id, { signatories: sigs });
      toastMsg('Signed · needs the Managing Partner + 1 more signatory');
      return;
    }
    if (item.kind === 'travel') app.updateTravelClaim(item.id, { approvalStatus: 'Approved', approvedBy: me, approvedAt: at, signatories: sigs });
    else if (item.kind === 'expense') app.updateExpense(item.id, { approvalStatus: 'Approved', approvedBy: me, approvedAt: at, signatories: sigs });
    else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { approvalStatus: 'Approved', approved: true, approvedBy: sigs.map((s) => s.name).join(' + '), signatories: sigs });
    else if (item.kind === 'journal') {
      const j = manualJournals.find((x) => x.id === item.id);
      app.updateManualJournal(item.id, { status: 'Approved', decidedBy: me, decidedAt: at, signatories: sigs });
      if (j) postGL([{ date: j.date, docType: 'JV', docNo: j.id, accountSet: j.account === 'Client account' ? 'CLIENT' : 'OFFICE', debit: j.direction === 'Money in' ? cashAccountGL(j.account) : GLA.suspense, credit: j.direction === 'Money in' ? GLA.suspense : cashAccountGL(j.account), amount: j.amount, clientId: '', fileRef: '', description: `Manual journal: ${j.details} · ${j.reason}` }]);
    } else if (item.kind === 'writeoff') {
      const inv = invoices.find((i) => i.id === item.id);
      if (inv?.writeOffRequest) {
        const amt = Math.min(Number(inv.writeOffRequest.amount || 0), invBal(inv));
        app.updateInvoice(inv.id, { writtenOff: Number(inv.writtenOff || 0) + amt, writeOffRequest: { ...inv.writeOffRequest, status: 'Approved', decidedBy: me, decidedAt: at } });
        postGL([{ date: todayIso(), docType: 'JV', docNo: inv.id, accountSet: 'OFFICE', debit: GLA.other, credit: GLA.ar, amount: amt, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Bad debt written off: ${inv.id}` }]);
      }
    } else if (item.kind === 'referral') saveSettings({ referralFeeApprovals: { ...(settings.referralFeeApprovals || {}), [period]: { status: 'Approved', by: me, at, total: item.amount } } });
    setDecided((d) => ({ ...d, [item.key]: { d: 'ok', item } }));
    toastMsg(item.title + ' approved');
  };

  /* ------------------------------ approved · to pay ------------------------------ */
  const pvMethod = (v: PaymentVoucher): PayItem['method'] => (/portal|e-?filing|stamps|e-?tanah|fpx|online/i.test(v.paymentMethod || '') ? 'Online portal' : /cheque/i.test(v.paymentMethod || '') ? 'Cheque' : 'Bank transfer');
  const toPay: PayItem[] = useMemo(() => {
    const out: PayItem[] = [];
    travelClaims.filter((t) => t.approvalStatus === 'Approved' && !t.paidAt).forEach((t) => out.push({ key: 'travel:' + t.id, kind: 'travel', id: t.id, no: t.id, payee: `${t.claimant} (claim)`, what: `${t.purpose || t.type}${t.fileRef ? ' · ' + t.fileRef : ''}`, method: 'To staff bank', details: 'Staff bank details from their profile (not stored in the app)', from: 'Office', amount: Number(t.total || 0) }));
    expenses.filter((e) => e.approvalStatus === 'Approved' && !!e.claimant && !e.paidAt).forEach((e) => out.push({ key: 'expense:' + e.id, kind: 'expense', id: e.id, no: e.id, payee: `${e.claimant} (claim)`, what: `${e.description || e.category}${e.fileRef ? ' · ' + e.fileRef : ''}`, method: 'To staff bank', details: 'Staff bank details from their profile (not stored in the app)', from: 'Office', amount: Number(e.amount || 0) }));
    paymentVouchers.filter((v) => v.approvalStatus === 'Approved' && !v.paidAt && !v.historical).forEach((v) => out.push({ key: 'pv:' + v.id, kind: 'pv', id: v.id, no: v.id, payee: v.voucherCategory === 'Legal Fees Transfer' ? 'Office account (transfer)' : v.payee || '—', what: `${v.description}${v.fileRef ? ' · ' + v.fileRef : ''}`, method: v.voucherCategory === 'Legal Fees Transfer' ? 'Bank transfer' : pvMethod(v), details: v.voucherCategory === 'Legal Fees Transfer' ? `Client A/C ${SD.BANK['Client account'][2]} → Office A/C ${SD.BANK.Office[2]}` : v.bankRef || v.paymentMethod || '—', from: pvIsClient(v) ? 'Client account' : v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? 'Disbursement' : 'Office', amount: Number(v.amount || 0) }));
    return out;
  }, [travelClaims, expenses, paymentVouchers]);

  const markPaid = (item: PayItem, file?: File | null) => {
    if (!file) return;
    if (!canPrepare) { toastMsg('Payments are made and recorded by Accounts.'); return; }
    const at = new Date().toISOString(), date = todayIso();
    const [proof] = filesToProofs(item.kind + ':' + item.id, [file]);
    if (item.kind === 'travel') { const t = travelClaims.find((x) => x.id === item.id); app.updateTravelClaim(item.id, { paidAt: at, paidProof: proof }); postGL([{ date, docType: 'PV', docNo: item.id, accountSet: 'OFFICE', debit: GLA.other, credit: GLA.office, amount: item.amount, clientId: '', fileRef: t?.fileRef || '', description: `Staff claim paid: ${t?.claimant || ''} ${item.id}` }]); }
    else if (item.kind === 'expense') { const e = expenses.find((x) => x.id === item.id); app.updateExpense(item.id, { paidAt: at, paidProof: proof }); postGL([{ date, docType: 'PV', docNo: item.id, accountSet: 'OFFICE', debit: e?.billable ? '1200 - Unbilled Disbursements' : expenseGL(e?.category || ''), credit: GLA.office, amount: item.amount, clientId: '', fileRef: e?.fileRef || '', description: `Staff claim paid: ${e?.claimant || ''} ${item.id}` }]); }
    else {
      const v = paymentVouchers.find((x) => x.id === item.id);
      if (!v) return;
      if (pvIsClient(v)) {
        if (clientLedgerBalance(v.clientId, v.caseId) < Number(v.amount || 0) - 0.005) { toastMsg('Not enough in this client ledger: the client account can never go below zero.'); return; }
        app.addRetainer({ id: 'RET-' + v.id, clientId: v.clientId, caseId: v.caseId || '', type: 'Apply', amount: Number(v.amount || 0), date, remarks: v.voucherCategory === 'Legal Fees Transfer' ? `Transfer to office for ${v.invoiceId || ''}` : `${v.payee ? 'Paid ' + v.payee + ' · ' : ''}${v.description}`, voucherNo: v.id });
        if (v.voucherCategory === 'Legal Fees Transfer' && v.invoiceId) {
          const inv = invoices.find((i) => i.id === v.invoiceId);
          app.addPayment({ id: 'PAY-' + v.id, invoiceId: v.invoiceId, amount: Number(v.amount || 0), date, method: 'Transfer from client account' });
          app.addReceipt({ id: app.getNextSequenceId('receipt'), date, accountSet: 'OFFICE', receivedFrom: inv?.partyName || clientName(v.clientId) || '—', description: `Transfer from client account for ${v.invoiceId}`, amount: Number(v.amount || 0), debit: GLA.office, credit: GLA.ar, clientId: v.clientId, fileRef: v.fileRef || '', bankRef: v.id, receivedBy: me, paymentMethod: 'Transfer from client account', forNo: v.invoiceId, invoiceId: v.invoiceId, caseId: v.caseId, proofs: [proof] });
          postGL([
            { date, docType: 'PV', docNo: v.id, accountSet: 'CLIENT', debit: GLA.clientFunds, credit: GLA.clientBank, amount: v.amount, clientId: v.clientId, fileRef: v.fileRef || '', description: `Transfer to office for ${v.invoiceId}` },
            { date, docType: 'OR', docNo: v.id, accountSet: 'OFFICE', debit: GLA.office, credit: GLA.ar, amount: v.amount, clientId: v.clientId, fileRef: v.fileRef || '', description: `Fees received from client account for ${v.invoiceId}` },
          ]);
        } else postGL([{ date, docType: 'PV', docNo: v.id, accountSet: 'CLIENT', debit: GLA.clientFunds, credit: GLA.clientBank, amount: v.amount, clientId: v.clientId, fileRef: v.fileRef || '', description: `Paid for client: ${v.payee || ''} ${v.description}` }]);
      } else postGL([{ date, docType: 'PV', docNo: v.id, accountSet: 'OFFICE', debit: v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? '1200 - Unbilled Disbursements' : GLA.other, credit: v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? GLA.disb : GLA.office, amount: v.amount, clientId: v.clientId || '', fileRef: v.fileRef || '', description: `${v.payee || ''} ${v.description}`.trim() }]);
      app.updatePaymentVoucher(item.id, { paidAt: at, paidProof: proof, approvalStatus: 'Posted to GL', postedToGl: true });
    }
    setPaidNow((p) => ({ ...p, [item.key]: { item, file: file.name } }));
    toastMsg(`${item.no} paid · ${file.name} attached · posted to the cash book`);
  };

  /* ------------------------------ payroll ------------------------------ */
  const staff = users.filter((u) => u.status !== 'Inactive' && u.role !== 'Client' && u.role !== 'Partner' && !u.isSuperAdmin);
  const slipOf = (userId: string) => payslips.find((p) => p.userId === userId && p.period === period);
  const slipCalc = (p?: Payslip) => {
    if (!p) return null;
    const allow = (p.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const gross = Number(p.basic || 0) + allow + Number(p.referralFee || 0) + Number(p.profitShare || 0) + Number(p.bonus || 0);
    const other = (p.otherDeductions || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    const ded = Number(p.epfEmployee || 0) + Number(p.socsoEis || 0) + Number(p.pcb || 0) + Number(p.zakat || 0) + other;
    const erEpf = Number(p.epfEmployer || 0), erSocso = Number(p.socsoEisEmployer || 0);
    // er = everything the firm pays on top of gross pay (employer EPF + employer SOCSO/EIS).
    return { allow, gross, ded, other, net: gross - ded, er: erEpf + erSocso, erEpf, erSocso };
  };
  /** EPF / SOCSO / EIS for a payslip being keyed in (form values are strings). src/lib/statutory.ts. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slipStatutory = (userId: string, vals: Record<string, any>) => {
    const sp = staffUser(userId)?.staffProfile;
    return statutoryForPayslip({ basic: num0(vals.basic), allowances: num0(vals.allow), referralFee: num0(vals.ref), profitShare: num0(vals.ps), bonus: num0(vals.bonus) }, { birthday: sp?.birthday, nric: sp?.nric, nationality: sp?.nationality }, period);
  };
  const periodSlips = payslips.filter((p) => p.period === period && staff.some((u) => u.id === p.userId));
  const PAY_STEPS: Payslip['status'][] = ['Draft', 'Checked', 'Approved', 'Paid'];
  const payStep = periodSlips.length ? Math.min(...periodSlips.map((p) => PAY_STEPS.indexOf(p.status))) : 0;
  const payNext = () => {
    if (!periodSlips.length) { toastMsg('No payslips for ' + monthName + ' yet. Click a staff row to key in their payslip.'); return; }
    if (payStep >= 3) return;
    if (payStep === 0 && !canPrepare) { toastMsg('Payroll is checked by Accounts or the Managing Partner.'); return; }
    if (payStep === 1 && !isMP) { toastMsg('Payroll is approved by the Managing Partner.'); return; }
    if (payStep === 2 && !canPrepare) { toastMsg('Not available for your role.'); return; }
    if (payStep === 0 && staff.some((u) => !slipOf(u.id))) { toastMsg('Every staff member needs a payslip before payroll is checked.'); return; }
    const ids = periodSlips.filter((p) => PAY_STEPS.indexOf(p.status) === payStep).map((p) => p.id);
    app.advancePayslipStatus(ids);
    if (payStep === 2) {
      const tot = periodSlips.reduce((a, p) => { const c = slipCalc(p)!; return { net: a.net + c.net, stat: a.stat + c.ded + c.er }; }, { net: 0, stat: 0 });
      postGL([
        { date: todayIso(), docType: 'PV', docNo: 'PAYROLL-' + period, accountSet: 'OFFICE', debit: GLA.salaries, credit: GLA.office, amount: tot.net, clientId: '', fileRef: '', description: `${monthName} ${now.getFullYear()} payroll · net pay` },
        { date: todayIso(), docType: 'JV', docNo: 'PAYROLL-' + period, accountSet: 'OFFICE', debit: GLA.salaries, credit: GLA.statutory, amount: tot.stat, clientId: '', fileRef: '', description: `${monthName} ${now.getFullYear()} payroll · EPF/SOCSO/EIS/PCB/zakat due` },
      ]);
    }
    toastMsg(['Payroll checked', 'Payroll approved', 'Payroll marked paid · payslips show in Staff Portal'][payStep]);
  };
  const refFeeFor = (u: User) => referral.rows.filter((r) => r.type === 'Staff' && norm(r.name) === norm(u.name)).reduce((s, r) => s + r.fee, 0);

  /* ------------------------------ cash book ------------------------------ */
  const attachTo = (kind: string, id: string) => (files: FileList | null) => {
    const owner = kind + ':' + id;
    const nf = filesToProofs(kind === 'receipt' ? id : owner, files);
    if (!nf.length) return;
    if (kind === 'receipt') { const r = receipts.find((x) => x.id === id); if (r) app.updateReceipt(id, { proofs: [...(r.proofs || []), ...nf] }); }
    else if (kind === 'expense') { const e = expenses.find((x) => x.id === id); app.updateExpense(id, { paidProof: nf[0], documents: [...(e?.documents || []), ...nf.map((p, i) => ({ id: `DOC-${id}-${Date.now()}-${i}`, name: p.name, url: '', type: p.type, size: p.size, uploadedAt: p.uploadedAt, category: 'Receipt Photo' as const }))] }); }
    else if (kind === 'pv') { const v = paymentVouchers.find((x) => x.id === id); app.updatePaymentVoucher(id, { proofs: [...(v?.proofs || []), ...nf], paidProof: v?.paidProof || nf[0] }); }
    else if (kind === 'travel') app.updateTravelClaim(id, { paidProof: nf[0] });
    else if (kind === 'journal') { const j = manualJournals.find((x) => x.id === id); app.updateManualJournal(id, { proofs: [...(j?.proofs || []), ...nf] }); }
    toastMsg(nf.length + ' file(s) attached');
  };
  const receiptProofList = (r: Receipt) => r.proofs || [];

  const cashBook = (acc: CashAcc): CbRow[] => {
    const R: CbRow[] = [];
    const matchedPay = new Set<string>();
    receipts.filter((r) => receiptAccount(r) === acc || (acc === 'Office' && r.accountSet !== 'CLIENT' && receiptAccount(r) === 'Office')).forEach((r) => {
      if (receiptAccount(r) !== acc) return;
      if (r.invoiceId) payments.filter((p) => p.invoiceId === r.invoiceId && Math.abs(Number(p.amount) - Number(r.amount)) < 0.01 && !matchedPay.has(p.id)).slice(0, 1).forEach((p) => matchedPay.add(p.id));
      R.push({ key: 'r:' + r.id, t: parseDate(r.date), who: r.receivedFrom || '—', what: 'Receipt · ' + (r.forNo || r.description || '') + (r.paymentMethod ? ' · ' + r.paymentMethod : ''), no: r.id, inn: Number(r.amount || 0), out: 0, src: r.historical ? 'Historical' : 'Auto', proofs: receiptProofList(r), owner: r.id, open: () => setView({ kind: 'receipt', id: r.id }), attach: attachTo('receipt', r.id) });
    });
    if (acc === 'Office') payments.filter((p) => !matchedPay.has(p.id) && !receipts.some((r) => r.bankRef === p.id || (r.invoiceId === p.invoiceId && Math.abs(Number(r.amount) - Number(p.amount)) < 0.01 && r.date === p.date))).forEach((p) => { const inv = invoices.find((i) => i.id === p.invoiceId); if (inv?.status === 'Voided') return; R.push({ key: 'p:' + p.id, t: parseDate(p.date), who: inv?.partyName || clientName(inv?.clientId) || '—', what: `Payment for ${p.invoiceId}${p.method ? ' · ' + p.method : ''}`, no: p.id, inn: Number(p.amount || 0), out: 0, src: 'Auto', proofs: [], owner: 'payment:' + p.id }); });
    const expAcc = (e: Expense): CashAcc | null => (e.billable && !e.claimant ? 'Disbursement' : /petty/i.test(e.paidFrom || '') ? 'Petty cash' : /disb/i.test(e.paidFrom || '') ? 'Disbursement' : e.claimant ? (e.paidAt ? 'Office' : null) : 'Office');
    expenses.filter((e) => e.approvalStatus !== 'Rejected' && e.approvalStatus !== 'Pending Approval' && expAcc(e) === acc && (!e.claimant || e.paidAt)).forEach((e) => R.push({ key: 'e:' + e.id, t: parseDate(e.paidAt && e.claimant ? e.paidAt : e.date), who: e.payee || e.claimant || '—', what: `${e.category}${e.description ? ' · ' + e.description : ''}`, no: e.id, inn: 0, out: Number(e.amount || 0), src: 'Auto', proofs: e.paidProof ? [e.paidProof] : (e.documents || []).map((d) => ({ name: d.name, uploadedAt: d.uploadedAt || '' })), owner: 'expense:' + e.id, attach: attachTo('expense', e.id) }));
    paymentVouchers.filter((v) => (v.paidAt || v.historical || v.approvalStatus === 'Posted to GL') && v.approvalStatus !== 'Rejected').forEach((v) => {
      const from: CashAcc = pvIsClient(v) ? 'Client account' : v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? 'Disbursement' : /petty/i.test(v.bankAccountName || '') ? 'Petty cash' : 'Office';
      if (from === acc) R.push({ key: 'v:' + v.id, t: parseDate(v.paidAt || v.date), who: v.voucherCategory === 'Legal Fees Transfer' ? 'Transfer to office account' : v.payee || clientName(v.clientId) || '—', what: `${pvIsClient(v) ? 'Paid for client · ' : ''}${v.description}`, no: v.id, inn: 0, out: Number(v.amount || 0), src: v.historical ? 'Historical' : 'Auto', proofs: [...(v.paidProof ? [v.paidProof] : []), ...(v.proofs || [])], owner: 'pv:' + v.id, attach: attachTo('pv', v.id) });
    });
    if (acc === 'Office') travelClaims.filter((t) => t.paidAt).forEach((t) => R.push({ key: 't:' + t.id, t: parseDate(t.paidAt), who: t.claimant, what: `Staff claim · ${t.purpose || t.type}`, no: t.id, inn: 0, out: Number(t.total || 0), src: 'Auto', proofs: t.paidProof ? [t.paidProof] : [], owner: 'travel:' + t.id, attach: attachTo('travel', t.id) }));
    if (acc === 'Office') {
      const byPeriod = new Map<string, Payslip[]>();
      payslips.filter((p) => p.status === 'Paid').forEach((p) => byPeriod.set(p.period, [...(byPeriod.get(p.period) || []), p]));
      byPeriod.forEach((list, per) => { const net = list.reduce((s, p) => s + (slipCalc(p)?.net || 0), 0); const t = parseDate(list[0].paidAt) || parseDate(per + '-28'); R.push({ key: 'pay:' + per, t, who: 'Payroll', what: `Net salaries ${per} · ${list.length} staff`, no: 'PAYROLL-' + per, inn: 0, out: net, src: 'Auto', proofs: [], owner: 'payroll:' + per }); });
    }
    if (acc === 'Client account') retainers.filter((r) => !r.voucherNo && !receipts.some((x) => x.id === r.id)).forEach((r) => R.push({ key: 'l:' + r.id, t: parseDate(r.date), who: clientName(r.clientId) || r.clientId || '—', what: `Client ledger · ${r.type}${r.remarks ? ' · ' + r.remarks : ''}`, no: r.id, inn: r.type === 'Deposit' ? Number(r.amount || 0) : 0, out: r.type === 'Deposit' ? 0 : Number(r.amount || 0), src: 'Auto', proofs: [], owner: 'retainer:' + r.id }));
    manualJournals.filter((j) => j.account === acc && j.status !== 'Rejected').forEach((j) => R.push({ key: 'j:' + j.id, t: parseDate(j.date), who: 'Manual journal', what: `${j.details}${j.reason ? ' · ' + j.reason : ''}${j.status === 'Pending Approval' ? ' · waiting for approval' : ''}`, no: j.id, inn: j.direction === 'Money in' ? j.amount : 0, out: j.direction === 'Money out' ? j.amount : 0, src: 'Manual', proofs: j.proofs || [], owner: 'journal:' + j.id, attach: attachTo('journal', j.id) }));
    return R.sort((a, b) => a.t - b.t);
  };
  const openingBalance = (acc: CashAcc) => banksOf(acc).reduce((s, b) => s + Number(b.openingBalance || 0), 0);

  /* ------------------------------ document actions ------------------------------ */
  const clientByName = (name: string) => lk.clientByName.get(norm(name));
  const caseForRef = (ref: string) => lk.caseByRef.get(ref.trim()) || lk.caseById.get(ref.trim());
  const mailto = (email: string | undefined, subject: string, body: string) => { try { window.location.href = `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; } catch { /* no mail client */ } };

  const act = (kind: DocKind, rec: Quotation | Invoice | Receipt, a: string) => {
    const docNo = rec.id;
    if (a === 'View') { if (kind === 'quotation') { const p = quotations.find((x) => x.documentType === 'Proforma' && x.sourceQuotationId === rec.id); setView({ kind: 'quotation', id: p ? p.id : rec.id }); } else setView({ kind, id: rec.id }); return; }
    if (rk === 'R') { toastMsg('Read-only access.'); return; }
    if (a === 'Send' || a === 'Resend') { const q = rec as Quotation; app.updateQuotation(q.id, { status: 'Sent', documentSentDate: todayIso(), documentSentBy: me }); toastMsg(`${docNo} marked as sent to ${q.clientName} · email the PDF from your mailbox`); return; }
    if (a === 'Mark accepted') { app.updateQuotation(rec.id, { status: 'Accepted' }); toastMsg(docNo + ' accepted'); return; }
    if (a === 'Remind') { const c = kind === 'invoice' ? lk.clientById.get((rec as Invoice).clientId) || clientByName((rec as Invoice).partyName || '') : clientByName((rec as Quotation).clientName); const bal = kind === 'invoice' ? invBal(rec as Invoice) : Number((rec as Quotation).total || 0) - proformaPaid(rec as Quotation); mailto(c?.email, `Payment reminder: ${docNo}`, `Dear ${c?.contactPerson || c?.name || 'Sir/Madam'},\n\nThis is a reminder that ${docNo} has an outstanding balance of ${rm2(bal)}.\n\nPayment to: ${SD.BANK.Office[0]}, ${SD.BANK.Office[1]}, A/C ${SD.BANK.Office[2]}.\n\nThank you.\n${SD.FIRM.name}`); toastMsg('Payment reminder email draft opened for ' + (c?.name || 'the client')); return; }
    if (a === 'Record payment' || a === 'Record paid') { const bal = kind === 'invoice' ? invBal(rec as Invoice) : Number((rec as Quotation).total || 0) - proformaPaid(rec as Quotation); setForm({ kind: 'pay', vals: { docKind: kind, docId: rec.id, title: docNo, amount: String(Math.round(bal * 100) / 100), date: fd(Date.now()) } }); return; }
    if (a === 'View receipt') { const r = receipts.find((x) => x.invoiceId === rec.id || x.quotationId === rec.id || x.forNo === rec.id); if (r) setView({ kind: 'receipt', id: r.id }); else toastMsg('No receipt yet'); return; }
    if (a === 'Issue') {
      const inv = rec as Invoice; const terms = Number(settings.paymentTermDays) || 30;
      app.updateInvoice(inv.id, { status: 'Unpaid', date: todayIso(), dueDate: isoOf(Date.now() + terms * 86400000) });
      const items = inv.lineItems || []; const t = items.length ? recordTotals(items, recordSstRate(inv)) : null;
      const fees = t ? t.fees + t.reimbursements : Number(inv.amount || inv.total || 0) - 0; const disb = t ? t.disbursements : 0; const sst = t ? t.sst : Number(inv.tax || 0);
      postGL([
        { date: todayIso(), docType: 'INV', docNo: inv.id, accountSet: 'OFFICE', debit: GLA.ar, credit: GLA.fees, amount: t ? fees : Number(inv.total || 0) - sst, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Invoice ${inv.id} · professional fees & reimbursements` },
        { date: todayIso(), docType: 'INV', docNo: inv.id, accountSet: 'OFFICE', debit: GLA.ar, credit: GLA.disbRec, amount: disb, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Invoice ${inv.id} · disbursements` },
        { date: todayIso(), docType: 'INV', docNo: inv.id, accountSet: 'OFFICE', debit: GLA.ar, credit: GLA.sst, amount: sst, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Invoice ${inv.id} · SST` },
      ]);
      toastMsg(`${inv.id} issued · e-Invoice (LHDN MyInvois) not connected yet`);
      return;
    }
    if (a === 'Make proforma') {
      const q = rec as Quotation; const t = recordTotals(q.lineItems || [], recordSstRate(q));
      const made: Quotation[] = [];
      const want = [t.fees > 0, t.disbursements > 0].filter(Boolean).length;
      const ids = seqIds('quotation', Math.max(1, want));
      const base = { documentType: 'Proforma' as const, sourceQuotationId: q.id, partyType: q.partyType || 'Client' as const, partyId: q.partyId, date: todayIso(), practiceArea: q.practiceArea, fileRef: q.fileRef, leadId: q.leadId || '', clientName: q.clientName, status: 'Draft' as const, billedSoFar: 0, courtLevel: '', stage: '', feeMethod: 'Template' as const, subtype: q.subtype || '', approvalStatus: 'Pending' as const, approvedBy: '', approvedDate: '', sstApplied: false, caseId: q.caseId, matter: q.matter, subject: q.subject, yourRef: q.yourRef, tin: q.tin, scope: '', terms: [] };
      if (t.fees > 0) { const amt = Math.round(t.fees / 2); made.push({ ...base, id: ids[made.length], total: amt, remaining: amt, payInto: 'Office', lineItems: [{ description: `Retainer: 50% of quoted professional fees (${q.id})`, category: 'Fee - Fixed', amount: amt, quantity: 1, unitPrice: amt, chargeType: 'Fixed' }] }); }
      if (t.disbursements > 0) { const items = (q.lineItems || []).filter((i) => i.category === 'Disbursement'); made.push({ ...base, id: ids[made.length], total: t.disbursements, remaining: t.disbursements, payInto: 'Client account', lineItems: items }); }
      if (!made.length) { toastMsg('Nothing to ask for: the quotation has no fees or disbursements.'); return; }
      made.forEach((p) => app.addQuotation(p));
      setView({ kind: 'quotation', id: made[0].id }); setDocT('Proforma');
      toastMsg(made.map((x) => x.id).join(' + ') + ' created' + (made.length > 1 ? ' (fees → office, disbursements → client account)' : ''));
      return;
    }
    if (a === 'Convert to invoice') {
      const q = rec as Quotation; const rate = recordSstRate(q); const t = recordTotals(q.lineItems || [], rate); const id = app.getNextSequenceId('invoice'); const kase = qCase(q);
      app.addInvoice({ id, clientId: q.partyId || kase?.clientId || '', caseId: kase?.id || q.caseId || q.fileRef || '', fileRef: q.fileRef, quotationId: q.id, partyType: q.partyType || 'Client', partyName: q.clientName, amount: t.fees + t.disbursements + t.reimbursements, discount: 0, tax: t.sst, total: t.grandTotal, date: todayIso(), dueDate: todayIso(), status: 'Draft', lineItems: q.lineItems, sstRate: rate || undefined, matter: q.matter, subject: q.subject, yourRef: q.yourRef, tin: q.tin, scope: q.scope, payInto: 'Office' });
      setView({ kind: 'invoice', id }); setDocT('Invoice');
      toastMsg('Draft ' + id + ' created');
      return;
    }
    if (a === 'Request write-off') { const inv = rec as Invoice; setForm({ kind: 'writeoff', vals: { docId: inv.id, title: inv.id, amount: String(Math.round(invBal(inv) * 100) / 100) } }); return; }
    if (a === 'Edit') { editDoc(kind, rec as Quotation | Invoice); return; }
  };

  const openNew = (type: 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt') => {
    if (!(canPrepare || rk === 'P')) { toastMsg('Not available for your role.'); return; }
    const area = 'Litigation';
    setView(null);
    setEd({ type: type === 'Receipt' ? 'Invoice' : type, client: '', ref: '', matter: '', area, account: 'Office', lines: SD.fromTemplate(area), yourRef: 'Kindly Advised', tin: '-', subject: '', desc: SD.AREAS[area].desc, arrangement: '', sstRate: SD.defaultSstRate(), inst: null });
  };
  const editDoc = (kind: DocKind, rec: Quotation | Invoice) => {
    const ref: DocRef = { kind, id: rec.id }; const d = buildDoc(ref); if (!d || d.type === 'Receipt') return;
    setView(null);
    setEd({ kind, id: rec.id, type: d.type, client: d.client, ref: d.ref || '', matter: d.matter || '', area: d.area || 'Litigation', account: d.account === 'Client account' ? 'Client account' : 'Office', yourRef: d.yourRef || 'Kindly Advised', tin: d.tin || '-', subject: d.subject || '', desc: d.desc || '', arrangement: d.arrangement || '', sstRate: d.sstRate || 0, inst: d.inst ? { ...d.inst } : null, lines: { prof: SD.clone(d.lines?.prof), disb: SD.clone(d.lines?.disb), reimb: SD.clone(d.lines?.reimb) } });
  };
  const saveEd = (andView: boolean) => {
    const e = ed; if (!e) return;
    const client = clientByName(e.client); const kase = caseForRef(e.ref);
    const rate = e.sstRate || 0;
    const subject = e.subject || String(e.matter || '').toUpperCase();
    if (e.id && e.kind === 'invoice') {
      const inv = invoices.find((i) => i.id === e.id); if (!inv) return;
      const items = linesToItems(e.lines, inv.lineItems); const t = recordTotals(items, rate);
      app.updateInvoice(inv.id, { partyName: e.client, clientId: client?.id || inv.clientId, caseId: kase?.id || inv.caseId, fileRef: e.ref, matter: e.matter, lineItems: items, amount: t.fees + t.disbursements + t.reimbursements, tax: t.sst, total: t.grandTotal, sstRate: rate || undefined, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, feeArrangement: e.inst });
      setEd(null); if (andView) setView({ kind: 'invoice', id: inv.id }); toastMsg('Changes saved'); return;
    }
    if (e.id && e.kind === 'quotation') {
      const q = quotations.find((i) => i.id === e.id); if (!q) return;
      const items = linesToItems(e.lines, q.lineItems); const t = recordTotals(items, rate);
      app.updateQuotation(q.id, { clientName: e.client, partyId: client?.id || q.partyId, caseId: kase?.id || q.caseId, fileRef: e.ref, matter: e.matter, practiceArea: e.area, lineItems: items, total: t.grandTotal, remaining: t.grandTotal - (q.billedSoFar || 0), sstApplied: rate > 0, sstRate: rate || undefined, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, feeArrangement: e.inst });
      setEd(null); if (andView) setView({ kind: 'quotation', id: q.id }); toastMsg('Changes saved'); return;
    }
    const items = linesToItems(e.lines); const t = recordTotals(items, rate);
    if (e.type === 'Invoice') {
      const id = app.getNextSequenceId('invoice');
      app.addInvoice({ id, clientId: client?.id || '', caseId: kase?.id || e.ref || '', fileRef: e.ref, partyType: 'Client', partyName: e.client || 'New client', amount: t.fees + t.disbursements + t.reimbursements, discount: 0, tax: t.sst, total: t.grandTotal, date: todayIso(), dueDate: todayIso(), status: 'Draft', lineItems: items, sstRate: rate || undefined, matter: e.matter, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, feeArrangement: e.inst });
      setEd(null); setView(andView ? { kind: 'invoice', id } : null); setDocT('Invoice'); setInvF('All'); go('billing'); toastMsg(id + ' saved as draft');
    } else {
      const id = app.getNextSequenceId('quotation');
      app.addQuotation({ id, documentType: e.type, partyType: 'Client', partyId: client?.id, date: todayIso(), practiceArea: e.area, fileRef: e.ref, leadId: '', clientName: e.client || 'New client', status: 'Draft', total: t.grandTotal, billedSoFar: 0, remaining: t.grandTotal, courtLevel: '', stage: '', feeMethod: 'Template', subtype: '', approvalStatus: 'Pending', approvedBy: '', approvedDate: '', lineItems: items, sstApplied: rate > 0, sstRate: rate || undefined, validityDays: Number(settings.quotationValidityDays) || 30, caseId: kase?.id, matter: e.matter, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, terms: e.type === 'Quotation' ? SD.TERMS.slice() : [], feeArrangement: e.inst, payInto: e.account });
      setEd(null); setView(andView ? { kind: 'quotation', id } : null); setDocT(e.type); go('billing'); toastMsg(id + ' saved as draft');
    }
  };

  const billMatter = (u: Unbilled) => {
    if (!(canPrepare || rk === 'P')) { toastMsg('Not available for your role.'); return; }
    const k = u.kase; const id = app.getNextSequenceId('invoice');
    const area = SD.areaFromName(k?.practiceArea || k?.type, k?.ref);
    const lines: SD.DocLines = { prof: u.te.map((t) => [`${t.description || 'Professional services'} (${fd(t.date)}, ${t.hours}h)`, Math.round(Number(t.hours || 0) * Number(t.rate || 0) * 100) / 100] as SD.DocLine), disb: u.ex.map((x) => [x.description || x.category, Number(x.amount || 0)] as SD.DocLine), reimb: [] };
    const items = linesToItems(lines); const rate = SD.defaultSstRate(); const t = recordTotals(items, rate);
    const cid = k ? k.clientId.split(',')[0].trim() : '';
    app.addInvoice({ id, clientId: cid, caseId: k?.id || u.caseId, fileRef: k?.ref, partyType: 'Client', partyName: u.client, amount: t.fees + t.disbursements + t.reimbursements, discount: 0, tax: t.sst, total: t.grandTotal, date: todayIso(), dueDate: todayIso(), status: 'Draft', lineItems: items, sstRate: rate || undefined, matter: k?.title, subject: String(k?.title || '').toUpperCase(), yourRef: 'Kindly Advised', tin: '-', scope: SD.AREAS[area]?.desc || '', payInto: 'Office' });
    u.te.forEach((t) => app.updateTimeEntry(t.id, { billed: true, invoiceId: id }));
    u.ex.forEach((x) => app.updateExpense(x.id, { billed: true }));
    setBilled((b) => ({ ...b, [u.caseId]: { inv: id, u } }));
    setView({ kind: 'invoice', id });
    toastMsg('Draft ' + id + ' created from unbilled work');
  };

  /* ------------------------------ forms ------------------------------ */
  const openForm = (kind: string, vals: Record<string, any> = {}) => setForm({ kind, vals });
  const saveForm = () => {
    if (!form) return;
    const { kind, vals } = form; const amt = num0(vals.amount);
    const dateIso = isoOf(parseDate(vals.date)) || todayIso();
    const proofs: FinanceProof[] = vals.proofs || [];
    if (rk === 'R' || rk === 'S') { toastMsg('Read-only access.'); return; }
    if (kind === 'moneyIn') {
      if (!canPrepare) { toastMsg('Receipts are recorded by Accounts.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount received.'); return; }
      const acc: 'Office' | 'Client account' = vals.account || 'Office';
      const c = clientByName(vals.client || ''); const forNo = String(vals.forNo || '').trim();
      const inv = invoices.find((i) => i.id === forNo); const pf = quotations.find((q) => q.id === forNo);
      const kase = vals.caseId ? findCase(lk, vals.caseId) : inv ? invCase(inv) : pf ? qCase(pf) : caseForRef(forNo);
      if (acc === 'Office' && inv) { if (inv.status === 'Voided') { toastMsg(inv.id + ' is voided.'); return; } if (amt > invBal(inv) + 0.01) { toastMsg('Payment cannot exceed the invoice balance (' + rm2(invBal(inv)) + ').'); return; } }
      if (acc === 'Client account' && !c) { toastMsg('Client money must be linked to a registered client (client ledger).'); return; }
      const id = app.getNextSequenceId('receipt');
      rememberProofUrls('form', id, proofs);
      app.addReceipt({ id, date: dateIso, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: vals.client || c?.name || '—', description: forNo || 'Payment received', amount: amt, debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : inv ? GLA.ar : GLA.fees, clientId: c?.id || inv?.clientId || '', fileRef: kase?.ref || inv?.fileRef || '', bankRef: '', receivedBy: me, paymentMethod: vals.method || 'Online transfer', forNo, invoiceId: inv?.id, quotationId: pf?.id, caseId: kase?.id, proofs });
      if (acc === 'Office' && inv) app.addPayment({ id: 'PAY-' + id, invoiceId: inv.id, amount: amt, date: dateIso, method: vals.method || 'Online transfer' });
      if (acc === 'Client account' && c) app.addRetainer({ id: 'RET-' + id, clientId: c.id, caseId: kase?.id || '', type: 'Deposit', amount: amt, date: dateIso, remarks: forNo || 'Money received into client account', voucherNo: id });
      postGL([{ date: dateIso, docType: 'OR', docNo: id, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : inv ? GLA.ar : GLA.fees, amount: amt, clientId: c?.id || '', fileRef: kase?.ref || '', description: `Receipt ${id} · ${forNo || 'payment received'}` }]);
      setForm(null); setView({ kind: 'receipt', id });
      toastMsg('Receipt ' + id + ' issued' + (proofs.length ? '' : ' · no proof attached yet'));
    } else if (kind === 'pay') {
      if (!canPrepare) { toastMsg('Payments are recorded by Accounts.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount received.'); return; }
      const id = app.getNextSequenceId('receipt'); rememberProofUrls('form', id, proofs);
      if (vals.docKind === 'invoice') {
        const inv = invoices.find((i) => i.id === vals.docId); if (!inv) return;
        if (amt > invBal(inv) + 0.01) { toastMsg('Payment cannot exceed the invoice balance (' + rm2(invBal(inv)) + ').'); return; }
        app.addPayment({ id: 'PAY-' + id, invoiceId: inv.id, amount: amt, date: dateIso, method: vals.method || 'Online transfer' });
        app.addReceipt({ id, date: dateIso, accountSet: 'OFFICE', receivedFrom: inv.partyName || clientName(inv.clientId) || '—', description: `Payment for ${inv.id}`, amount: amt, debit: GLA.office, credit: GLA.ar, clientId: inv.clientId, fileRef: inv.fileRef || '', bankRef: 'PAY-' + id, receivedBy: me, paymentMethod: vals.method || 'Online transfer', forNo: inv.id, invoiceId: inv.id, caseId: invCase(inv)?.id, proofs });
        postGL([{ date: dateIso, docType: 'OR', docNo: id, accountSet: 'OFFICE', debit: GLA.office, credit: GLA.ar, amount: amt, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Receipt ${id} for ${inv.id}` }]);
      } else {
        const q = quotations.find((i) => i.id === vals.docId); if (!q) return;
        const acc = q.payInto || 'Office'; const kase = qCase(q); const cid = q.partyId || kase?.clientId?.split(',')[0].trim() || '';
        if (acc === 'Client account' && !cid) { toastMsg('Link this proforma to a registered client before taking client money.'); return; }
        app.addReceipt({ id, date: dateIso, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: q.clientName, description: `Payment for ${q.id}`, amount: amt, debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : GLA.fees, clientId: cid, fileRef: q.fileRef || '', bankRef: '', receivedBy: me, paymentMethod: vals.method || 'Online transfer', forNo: q.id, quotationId: q.id, caseId: kase?.id, proofs });
        if (acc === 'Client account') app.addRetainer({ id: 'RET-' + id, clientId: cid, caseId: kase?.id || '', type: 'Deposit', amount: amt, date: dateIso, remarks: `Deposit for ${q.id}`, voucherNo: id });
        postGL([{ date: dateIso, docType: 'OR', docNo: id, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : GLA.fees, amount: amt, clientId: cid, fileRef: q.fileRef || '', description: `Receipt ${id} for ${q.id}` }]);
      }
      setForm(null); setView({ kind: 'receipt', id });
      toastMsg('Receipt ' + id + ' issued' + (proofs.length ? ' with proof' : ' · no proof attached yet'));
    } else if (kind === 'journal') {
      if (!canPrepare) { toastMsg('Journals are prepared by Accounts.'); return; }
      if (amt <= 0 || !String(vals.details || '').trim()) { toastMsg('Enter the details and amount.'); return; }
      const id = app.getNextSequenceId('journal');
      app.addManualJournal({ id, date: dateIso, account: vals.account || 'Office', direction: vals.dir || 'Money out', details: vals.details || '', amount: amt, reason: vals.reason || '', preparedBy: me, createdAt: new Date().toISOString(), status: 'Pending Approval' });
      setForm(null); toastMsg(id + ' posted · sent to Approvals');
    } else if (kind === 'payOut' || kind === 'transfer') {
      if (!canPrepare) { toastMsg('Client account payments are prepared by Accounts.'); return; }
      const c = clientByName(vals.client || '');
      if (!c) { toastMsg('Pick a registered client: client money is paid out per client ledger.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      const caseId: string | undefined = vals.caseId;
      const bal = clientLedgerBalance(c.id, caseId);
      if (amt > bal + 0.005) { toastMsg(`Not enough in ${c.name}'s ledger (${rm2(bal)}): the client account can never go below zero.`); return; }
      const kase = caseId ? findCase(lk, caseId) : undefined;
      let inv: Invoice | undefined;
      if (kind === 'transfer') {
        inv = invoices.find((i) => i.id === String(vals.forNo || '').trim());
        if (!inv) { toastMsg('Client money can only move to office after an invoice: enter the invoice number.'); return; }
        if (inv.clientId !== c.id && norm(inv.partyName) !== norm(c.name)) { toastMsg(inv.id + ' is not this client’s invoice.'); return; }
        if (!invIssued(inv)) { toastMsg(inv.id + ' has not been issued yet.'); return; }
        if (amt > invBal(inv) + 0.01) { toastMsg('Transfer cannot exceed the invoice balance (' + rm2(invBal(inv)) + ').'); return; }
      }
      const id = app.getNextSequenceId('voucher');
      app.addPaymentVoucher({ id, date: todayIso(), accountSet: 'CLIENT', voucherCategory: kind === 'transfer' ? 'Legal Fees Transfer' : 'Client Disb', payee: kind === 'transfer' ? 'Office account' : vals.payee || '', paymentMethod: vals.method || 'Bank transfer', description: kind === 'transfer' ? `Transfer to office for ${inv!.id}` : vals.purpose || 'payment', amount: amt, debit: GLA.clientFunds, credit: GLA.clientBank, clientId: c.id, fileRef: kase?.ref || '', caseId: kase?.id || caseId, invoiceId: inv?.id, preparedBy: me, approvalStatus: 'Pending Approval', approved: false });
      setForm(null); toastMsg('Sent to Approvals (needs 2 signatories)');
    } else if (kind === 'expense') {
      if (!canPrepare) { toastMsg('Office expenses are recorded by Accounts.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      const id = app.getNextSequenceId('expense'); const from = vals.from || 'Hong Leong'; const cat = vals.cat || 'Utilities';
      app.addExpense({ id, caseId: '', date: dateIso, category: cat, amount: amt, billable: false, description: vals.what || '', payee: vals.payee || '', accountSet: 'OFFICE', paidFrom: from, approvalStatus: 'Posted to GL', postedToGl: true, paidProof: proofs[0], documents: proofs.map((p, i) => ({ id: `DOC-${id}-${i}`, name: p.name, url: '', type: p.type, size: p.size, uploadedAt: p.uploadedAt, category: 'Receipt Photo' as const })) });
      rememberProofUrls('form', 'expense:' + id, proofs);
      postGL([{ date: dateIso, docType: 'PV', docNo: id, accountSet: 'OFFICE', debit: expenseGL(cat), credit: /petty/i.test(from) ? GLA.petty : GLA.office, amount: amt, clientId: '', fileRef: '', description: `${vals.payee || ''} · ${vals.what || cat}` }]);
      setForm(null); toastMsg(proofs.length ? 'Expense recorded with receipt.' : 'Expense recorded. Attach the receipt to complete it.');
    } else if (kind === 'fund') {
      const fund: SinkingFund = { id: `fund-${Date.now()}`, name: vals.name || 'New fund', note: 'added by ' + me, target: num0(vals.target), balance: num0(vals.saved), due: vals.due || '—', monthly: num0(vals.monthly) };
      const next = [...(settings.sinkingFunds || []), fund];
      saveSettings({ sinkingFunds: next }); if (fundsDraft) setFundsDraft([...fundsDraft, fund]);
      setForm(null); toastMsg('Fund added');
    } else if (kind === 'writeoff') {
      const inv = invoices.find((i) => i.id === vals.docId); if (!inv) return;
      if (amt <= 0 || amt > invBal(inv) + 0.01) { toastMsg('Write-off must be between RM 0 and the balance (' + rm2(invBal(inv)) + ').'); return; }
      app.updateInvoice(inv.id, { writeOffRequest: { amount: amt, reason: vals.reason || '', requestedBy: me, requestedAt: new Date().toISOString(), status: 'Pending' } });
      setForm(null); setView(null); toastMsg('Write-off sent to the Managing Partner (Approvals)');
    } else if (kind === 'payslip') {
      const u = staffUser(vals.userId); if (!u) return;
      const existing = slipOf(u.id);
      if (existing && existing.status !== 'Draft') { toastMsg('Only Draft payslips can be changed.'); return; }
      // EPF and SOCSO + EIS are recalculated here from the official tables (never trusted from the
      // form) unless Accounts ticked "Override", which needs a reason. PCB and zakat stay manual.
      const st = slipStatutory(u.id, vals);
      const override = !!vals.stOverride || !st.ok;
      if (vals.stOverride && !String(vals.stReason || '').trim()) { toastMsg('Give a reason for overriding the calculated EPF / SOCSO / EIS.'); return; }
      const statutory: NonNullable<Payslip['statutory']> = override
        ? { auto: false, version: STATUTORY_VERSION, ...(String(vals.stReason || '').trim() ? { overrideReason: String(vals.stReason).trim() } : {}) }
        : { auto: true, version: STATUTORY_VERSION, socsoEmployee: st.socso.employee, eisEmployee: st.eis.employee, socsoEmployer: st.socso.employer, eisEmployer: st.eis.employer };
      const p: Payslip = { id: existing?.id || `PS-${period}-${u.id}`, userId: u.id, period, status: 'Draft', basic: num0(vals.basic), allowances: num0(vals.allow) ? [{ name: 'Allowances', amount: num0(vals.allow) }] : [], referralFee: num0(vals.ref), referralNote: vals.refNote || undefined, profitShare: num0(vals.ps), profitShareNote: vals.psNote || undefined, bonus: num0(vals.bonus), bonusNote: vals.bonusNote || undefined, epfEmployee: override ? num0(vals.epf) : st.epfEmployee, epfEmployer: override ? num0(vals.epfEr) : st.epfEmployer, socsoEis: override ? num0(vals.socso) : st.socsoEisEmployee, socsoEisEmployer: override ? num0(vals.socsoEr) : st.socsoEisEmployer, statutory, pcb: num0(vals.pcb), zakat: num0(vals.zakat), otherDeductions: num0(vals.otherDed) ? [{ name: vals.otherDedName || 'Other deduction', amount: num0(vals.otherDed) }] : [] };
      if (existing) app.updatePayslip(existing.id, p); else app.addPayslip(p);
      setForm(null); toastMsg('Payslip saved for ' + u.name);
    }
  };

  /* ------------------------------ import past transactions ------------------------------ */
  const importFile = async (file: File) => { try { const rows = await SD.readSheet(file); setImp((s) => (s ? { ...s, fileName: file.name, raw: rows } : s)); } catch { toastMsg('Could not read ' + file.name); } };
  interface ImpRow { date: string; t: number; type: string; acc: string; client: string; ref: string; no: string; desc: string; amt: number; method: string; proof: string; ok: boolean; status: string; sbg: string; sfg: string }
  const importRows = (I0: ImportState): ImpRow[] => {
    if (!I0.raw || I0.raw.length < 2) return [];
    const hdr = I0.raw[0].map((x) => String(x).toLowerCase()); const col = (...k: string[]) => hdr.findIndex((x) => k.some((y) => x.includes(y)));
    const c = { date: col('date', 'tarikh'), type: col('type'), acc: col('account'), client: col('client', 'name', 'payer'), ref: col('our ref'), no: col('document', 'doc', 'receipt no', 'invoice no'), desc: col('desc', 'particular', 'details', 'narration'), amt: col('amount'), method: col('method'), proof: col('proof'), cr: col('credit', 'deposit'), dr: col('debit', 'withdraw') };
    const g = (r: string[], i: number) => (i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''); const nm = (v: string) => Number(String(v || '').replace(/[^0-9.-]/g, '')) || 0;
    const seen = new Set<string>();
    return I0.raw.slice(1).map((r) => {
      let amt = nm(g(r, c.amt)), tp = g(r, c.type);
      if (c.cr >= 0 || c.dr >= 0) { const cr = nm(g(r, c.cr)), dr = nm(g(r, c.dr)); if (cr || dr) { amt = Math.abs(cr || dr); tp = cr ? 'Receipt' : 'Payment'; } }
      const type = /inv/i.test(tp) ? 'Invoice' : /rec|in\b|credit/i.test(tp) ? 'Receipt' : /pay|out|debit|pv/i.test(tp) ? 'Payment' : '';
      const av = g(r, c.acc); const acc2 = av ? (/client/i.test(av) ? 'Client account' : /petty/i.test(av) ? 'Petty cash' : 'Office') : I0.acc;
      const t = parseDate(g(r, c.date)); const client = g(r, c.client); const no = g(r, c.no);
      const dup = !!no && (seen.has(no) || invoices.some((x) => x.id === no) || receipts.some((x) => x.id === no) || paymentVouchers.some((x) => x.id === no)); if (no) seen.add(no);
      const issue = !t ? 'No date' : !amt ? 'No amount' : !type ? 'Type?' : dup ? 'Doc no. exists' : type === 'Receipt' && acc2 === 'Client account' && !clientByName(client) ? 'Client not found' : '';
      const warn = !issue && !client ? 'Match client later' : !issue && !g(r, c.proof) ? 'No proof ref' : '';
      return { date: fd(t), t, type: type || '?', acc: acc2, client, ref: g(r, c.ref), no, desc: g(r, c.desc), amt, method: g(r, c.method), proof: g(r, c.proof), ok: !issue, status: issue || warn || 'Ready', sbg: issue ? '#FBEDE9' : warn ? '#FBF2E9' : '#E6EFE9', sfg: issue ? '#B23A2E' : warn ? '#8A6534' : '#2F6F4E' };
    });
  };
  const postImport = (list: ImpRow[]) => {
    if (!canPrepare) { toastMsg('Imports are posted by Accounts.'); return; }
    const ok = list.filter((r) => r.ok); if (!ok.length) return;
    const nR = ok.filter((r) => r.type === 'Receipt' && !r.no).length, nI = ok.filter((r) => r.type === 'Invoice' && !r.no).length, nP = ok.filter((r) => r.type === 'Payment' && !r.no).length;
    const rIds = nR ? seqIds('receipt', nR) : [], iIds = nI ? seqIds('invoice', nI) : [], pIds = nP ? seqIds('voucher', nP) : [];
    const gl: Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>[] = [];
    ok.forEach((r) => {
      const dateIso = isoOf(r.t); const c = clientByName(r.client); const kase = r.ref ? caseForRef(r.ref) : undefined; const client = r.acc === 'Client account';
      const proofs: FinanceProof[] = r.proof ? [{ name: r.proof, uploadedAt: new Date().toISOString() }] : [];
      if (r.type === 'Receipt') {
        const id = r.no || rIds.shift()!;
        app.addReceipt({ id, date: dateIso, accountSet: client ? 'CLIENT' : 'OFFICE', receivedFrom: r.client || '—', description: r.desc || 'Historical receipt', amount: r.amt, debit: cashAccountGL(r.acc), credit: client ? GLA.clientFunds : GLA.ar, clientId: c?.id || '', fileRef: r.ref, bankRef: '', receivedBy: me, paymentMethod: r.method || '—', forNo: r.desc, caseId: kase?.id, proofs, historical: true });
        if (client && c) app.addRetainer({ id: 'RET-' + id, clientId: c.id, caseId: kase?.id || '', type: 'Deposit', amount: r.amt, date: dateIso, remarks: r.desc || 'Historical receipt', voucherNo: id });
        gl.push({ date: dateIso, docType: 'OR', docNo: id, accountSet: client ? 'CLIENT' : 'OFFICE', debit: cashAccountGL(r.acc), credit: client ? GLA.clientFunds : GLA.ar, amount: r.amt, clientId: c?.id || '', fileRef: r.ref, description: 'Historical receipt · ' + (r.desc || '') });
      } else if (r.type === 'Invoice') {
        const id = r.no || iIds.shift()!;
        app.addInvoice({ id, clientId: c?.id || '', caseId: kase?.id || r.ref || '', fileRef: r.ref, partyType: 'Client', partyName: r.client || '—', amount: r.amt, discount: 0, tax: 0, total: r.amt, date: dateIso, dueDate: dateIso, status: 'Unpaid', historical: true, matter: r.desc, lineItems: [{ description: r.desc || 'Professional fees', category: 'Fee - Fixed', amount: r.amt, quantity: 1, unitPrice: r.amt, chargeType: 'Fixed' }] });
        gl.push({ date: dateIso, docType: 'INV', docNo: id, accountSet: 'OFFICE', debit: GLA.ar, credit: GLA.fees, amount: r.amt, clientId: c?.id || '', fileRef: r.ref, description: 'Historical invoice · ' + (r.desc || '') });
      } else {
        const id = r.no || pIds.shift()!;
        app.addPaymentVoucher({ id, date: dateIso, accountSet: client ? 'CLIENT' : 'OFFICE', voucherCategory: client ? 'Client Disb' : 'Office Operating', payee: r.client || '', paymentMethod: r.method || '', description: r.desc || 'Historical payment', amount: r.amt, debit: client ? GLA.clientFunds : GLA.other, credit: cashAccountGL(r.acc), clientId: c?.id || '', fileRef: r.ref, caseId: kase?.id, bankAccountName: r.acc === 'Petty cash' ? 'Petty cash' : undefined, preparedBy: me, approvalStatus: 'Approved', approved: true, historical: true, paidAt: dateIso, proofs });
        if (client && c) app.addRetainer({ id: 'RET-' + id, clientId: c.id, caseId: kase?.id || '', type: 'Apply', amount: r.amt, date: dateIso, remarks: r.desc || 'Historical payment', voucherNo: id });
        gl.push({ date: dateIso, docType: 'PV', docNo: id, accountSet: client ? 'CLIENT' : 'OFFICE', debit: client ? GLA.clientFunds : GLA.other, credit: cashAccountGL(r.acc), amount: r.amt, clientId: c?.id || '', fileRef: r.ref, description: 'Historical payment · ' + (r.desc || '') });
      }
    });
    postGL(gl);
    setImp(null);
    toastMsg(ok.length + ' historical entries posted to the cash book & ledgers');
  };

  /* ------------------------------ month-end close ------------------------------ */
  const closeKey = (id: string) => `${period}:${id}`;
  const toggleClose = (id: string) => {
    if (!canPrepare) { toastMsg('The month-end checklist is kept by Accounts and the Managing Partner.'); return; }
    const cur = { ...(settings.monthEndClose || {}) };
    if (cur[closeKey(id)]) delete cur[closeKey(id)]; else cur[closeKey(id)] = { by: me, at: new Date().toISOString() };
    saveSettings({ monthEndClose: cur });
  };

  return {
    app, rk, isMP, canApprove, canPrepare, me, TABS, tab: visibleTab, go, toast, toastMsg,
    now, period, prevPeriod, prevDate, monthName, monShort, lastDay, lastDayLabel, nextMonShort, settings, saveSettings,
    lk, ownCase, clientName, staffUser,
    invBal, invPaid, invStatus, invIssued, invCase, scopedInvoices, openInvoices, owedTotal, aging, ageDays,
    qStatus, qCase, proformaPaid, scopedQuotations, scopedReceipts, actionsFor, act, buildDoc, recordOf, receiptProofList,
    ledgers, trustTotal, ledgerTotalAt, clientLedgerBalance, threeWayRec,
    unbilled, wipTotal, billMatter, billed: billed as Record<string, { inv: string; u: any }>,
    activeBanks, bankKind, banksOf, bankBal, lastRecon, officeCash,
    apItems, pendingAp, approve, decided: decided as Record<string, { d: 'ok' | 'no'; item: ApItem }>, referral, referralFor, refDecision, toPay, markPaid, paidNow: paidNow as Record<string, { item: PayItem; file: string }>,
    staff, slipOf, slipCalc, slipStatutory, periodSlips, payStep, payNext, refFeeFor, slipUser, setSlipUser,
    cashBook, openingBalance, cbAcc, setCbAcc, attachTo,
    docT, setDocT, invF, setInvF, apF, setApF, ledgerKey, setLedgerKey, fundEdit, setFundEdit, fundsDraft, setFundsDraft,
    view, setView, ed, setEd, saveEd, openNew, editDoc, form, setForm, openForm, saveForm,
    imp, setImp, importFile, importRows, postImport,
    faRead, markRead, toggleClose, closeKey,
    SC, picColor, rm, rm2, fd, dShort,
    itemAmount,
    // unused-but-available helpers for tabs
    addrOf, filesToProofs,
  };
}

export type FinanceCtrl = ReturnType<typeof useFinanceController>;
export type { TravelClaim, ManualJournal };
