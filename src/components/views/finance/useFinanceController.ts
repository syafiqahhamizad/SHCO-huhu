/**
 * Accounts & Finance controller — the React equivalent of the design prototype's `Component`
 * class (state, derived values and every interaction), but reading and writing REAL app data
 * through useApp(). Tabs and modals are pure renderers of what this returns.
 */
import type React from 'react';
import { pickDate } from '../../ui/pickDate';
import { applyFiled, nextFilingJob } from './financeFiling';
import { fileFinanceEntry, hasFinanceDrive, prepareStorage, storeEngagementFile } from '../../../services/fileStorageService';
import { grantReader } from '../../../services/googleDriveService';
import { askForm } from '../../ui/askForm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type {
  Case, Expense, FinanceProof, FinanceSignatory, GeneralLedgerEntry, Invoice, Payslip,
  PaymentVoucher, Quotation, Receipt, Retainer, TravelClaim, User,
} from '../../../types';
import { getPracticeSettings, savePracticeSettings, twoSignatoryThreshold, type SinkingFund } from '../../../services/templateService';
import { isApprovedForBilling } from '../../../lib/billingEngine';
import { claimFormTotal, invoiceComposition, isNonExpensePv, isReimbursementCategory, isStatutoryCategory, needsTwoSignatories, PV_DRAWINGS, PV_SST, PV_STATUTORY, round2, splitReceipt } from '../../../lib/financeCalc';
import { identityTokens, isMine } from '../../../lib/identity';
import { firstDriveFolderId } from '../../../lib/claimFilters';
import * as SD from '../../../lib/financeDocs';
import { whatsappLink } from '../../../lib/whatsapp';
import { queueClientEmail, watchClientEmail } from '../../../services/clientMailService';
import { statutoryForPayslip, STATUTORY_VERSION } from '../../../lib/statutory';
import { finRoleKey, finGrants, finTabsFor, FIN_TABS, type FinTab } from '../../../lib/financeAccess';
import { approverCode } from '../../../lib/approvers';
import { computeFeeSharing, DEFAULT_RULES, isPartnerType, professionalFeesPart, type FsFile, type FsPerson, type PersonType } from '../../../lib/feeSharing';
import { configuredSign, finRule, type FinApprovalId } from '../../../lib/financeApproval';
import {
  GLA,
  travelClaimGL,
  MONTHS,
  MON,
  SC,
  addrOf,
  cashAccountGL,
  daysSince,
  dShort,
  expenseGL,
  fd,
  DRIVE_REQUIRED_MSG,
  filesToProofs,
  findCase,
  proofUploadBlocked,
  initials,
  invoiceToDoc,
  inPeriod,
  isoOf,
  itemAmount,
  linesToItems,
  monthEnd,
  num0,
  parseDate,
  periodKey,
  picColor,
  proofLink,
  proofSig,
  proofUploadResults,
  setProofUploader,
  subscribeProofUploads,
  pvDebitGL,
  quotationToDoc,
  receiptAccount,
  receiptToDoc,
  recordSstRate,
  recordTotals,
  rememberProofUrls,
  rm,
  rm2,
  todayIso,
  type Lookups,
} from './financeModel';

import { defaultPlanFor, planRows, type PlanRow } from '../../../lib/engagementLetter';
import type { QuotationPaymentPlan } from '../../../types';

export type DocKind = 'quotation' | 'invoice' | 'receipt';
interface DocRef { kind: DocKind; id: string }
export interface EditorState {
  kind?: DocKind; id?: string; type: 'Quotation' | 'Proforma' | 'Invoice';
  /** Document date (yyyy-mm-dd); empty = today. */
  date?: string;
  client: string; ref: string; matter: string; area: string; account: 'Office' | 'Client account';
  lines: SD.DocLines; yourRef: string; tin: string; subject: string; desc: string; arrangement: string; sstRate: number;
  inst: SD.DocInstalments | null;
  /** Quotation only: how the client pays. */
  plan: QuotationPaymentPlan;
}
interface FormState { kind: string; vals: Record<string, any> }
interface PaperState { title: string; sub: string; html: string; wide?: boolean; pdf?: () => void; xls?: () => void; toggles?: { label: string; on: boolean; go: () => void }[]; extra?: React.ReactNode }
interface ImportState { src: 'Template' | 'Bank' | 'Software'; acc: 'Office' | 'Client account' | 'Petty cash'; raw: string[][] | null; fileName: string; /** 'reference' (default) = kept to look back at, never counted; 'books' = posted to the cash book and ledgers. */ mode?: 'reference' | 'books' }

export interface ApItem {
  key: string; kind: 'travel' | 'expense' | 'pv' | 'journal' | 'writeoff' | 'referral'; id: string;
  type: 'Staff claim' | 'Payment voucher' | 'Client account' | 'Referral fees' | 'Write-off';
  title: string; sub: string; amount: number; by: string; clientAccount: boolean; signatories: FinanceSignatory[];
  /** Record date (Year filter) and the Drive folder its files were saved in, when known. */
  date?: string; folderId?: string;
}
export interface PayItem {
  key: string; kind: 'travel' | 'expense' | 'pv'; id: string; no: string; payee: string; what: string;
  method: 'Bank transfer' | 'Online portal' | 'Cheque' | 'To staff bank'; details: string; from: 'Office' | 'Disbursement' | 'Client account'; amount: number;
  date?: string; folderId?: string;
}
interface CbRow {
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
  const TABS = finTabsFor(rk, finGrants(app.currentUser));

  /* ------------------------------ UI state ------------------------------ */
  const [tab, setTabState] = useState<FinTab>(initialTab);
  useEffect(() => { setTabState(initialTab); }, [initialTab]);
  const visibleTab: FinTab = TABS.some((t) => t[0] === tab) ? tab : (TABS[0]?.[0] || 'overview');
  const go = useCallback((t: FinTab) => { setTabState(t); const row = FIN_TABS.find((x) => x[0] === t); if (row) setCurrentView(row[3]); }, [setCurrentView]);

  // Tabs open from the URL hash too (#overview, #billing, #trust, #office, #approvals, #payroll,
  // #reports), and the hash follows the open tab so a link / reload lands on the same tab.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const fromHash = () => {
      const h = decodeURIComponent((window.location.hash || '').slice(1));
      if (FIN_TABS.some((x) => x[0] === h)) goRef.current(h as FinTab);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      if (FIN_TABS.some((x) => '#' + x[0] === window.location.hash)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
  }, []);
  useEffect(() => {
    if (window.location.hash !== '#' + visibleTab) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + visibleTab);
  }, [visibleTab]);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const toastMsg = useCallback((m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2800); }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => { SD.loadLogos(); }, []);

  /* ------------------------------ proofs → Google Drive ------------------------------ */
  // filesToProofs() starts a background Drive upload for each attached proof (when Drive storage
  // is set up). Once one finishes, write its Drive id / link onto every record holding that proof.
  setProofUploader(me);
  const [proofTick, setProofTick] = useState(0);
  const reportedProofErrors = useRef(new Set<string>());
  useEffect(() => subscribeProofUploads(() => setProofTick((t) => t + 1)), []);
  useEffect(() => {
    const results = proofUploadResults();
    if (!results.size) return;
    results.forEach((r, sig) => {
      if ('error' in r && !reportedProofErrors.current.has(sig)) { reportedProofErrors.current.add(sig); toastMsg(r.name + ' was attached but not saved to Google Drive: ' + r.error); }
    });
    const fix = (p?: FinanceProof): FinanceProof | null => {
      if (!p || p.driveFileId) return null;
      const r = results.get(proofSig(p));
      return r && 'driveFileId' in r ? { ...p, driveFileId: r.driveFileId, webViewLink: r.webViewLink, uploadedBy: r.uploadedBy, ...(r.driveFolderId ? { driveFolderId: r.driveFolderId } : {}) } : null;
    };
    const fixList = (list?: FinanceProof[]) => { if (!list?.length) return null; let changed = false; const out = list.map((p) => { const f = fix(p); if (f) changed = true; return f || p; }); return changed ? out : null; };
    receipts.forEach((x) => { const l = fixList(x.proofs); if (l) app.updateReceipt(x.id, { proofs: l }); });
    expenses.forEach((x) => { const f = fix(x.paidProof); if (f) app.updateExpense(x.id, { paidProof: f }); });
    travelClaims.forEach((x) => { const f = fix(x.paidProof); if (f) app.updateTravelClaim(x.id, { paidProof: f }); });
    paymentVouchers.forEach((x) => { const f = fix(x.paidProof), l = fixList(x.proofs); if (f || l) app.updatePaymentVoucher(x.id, { ...(f ? { paidProof: f } : {}), ...(l ? { proofs: l } : {}) }); });
    manualJournals.forEach((x) => { const l = fixList(x.proofs); if (l) app.updateManualJournal(x.id, { proofs: l }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofTick, receipts, expenses, travelClaims, paymentVouchers, manualJournals]);

  const [docT, setDocT] = useState<'Quotation' | 'Proforma' | 'Invoice' | 'Receipt'>('Invoice');
  const [invF, setInvF] = useState('All');
  const [apF, setApF] = useState('All');
  const [cbAcc, setCbAcc] = useState<CashAcc>('Office');
  const [fundEdit, setFundEdit] = useState(false);
  const [fundsDraft, setFundsDraft] = useState<SinkingFund[] | null>(null);
  const [view, setView] = useState<DocRef | null>(null);
  /** Sub-pages (design: chips under the page): Client Account, Office Account, Approvals, Payroll. */
  const [trSub, setTrSub] = useState<'l' | 'c' | 'r' | 's'>('l');
  const [ofSub, setOfSub] = useState<'e' | 'c' | 'd' | 'f' | 'm' | 'i'>('e');
  const [apSub, setApSub] = useState<'w' | 'p' | 'r'>('w');
  const [paySub, setPaySub] = useState<'sl' | 'pp' | 'fs'>('sl');
  /** "How money moves, A to Z" guide page. */
  const [guide, setGuide] = useState(false);
  /** Payment reminder (email / WhatsApp) for an invoice or proforma. */
  const [rem, setRem] = useState<{ kind: DocKind; id: string; to: string; subj: string; body: string; attach: boolean; viaE: boolean; viaW: boolean; phone: string; wa: string; send?: boolean } | null>(null);
  /** A4 paper viewer (reports, statements, payslips): html + PDF / Excel actions. */
  const [paper, setPaper] = useState<PaperState | null>(null);
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

  /* ------------------------------ finance books filing (Google Drive) ------------------------------ */
  // Once the Super Admin has set up the finance folders, each claim / PV / office expense / receipt is
  // filed in Books (Pending, Rejected, or the month it was paid), renamed, and linked in its client
  // file. Runs in the background for Accounts (who can open SHCO Finance), one entry at a time.
  const filingBusy = useRef(false);
  const filingSkip = useRef(new Set<string>());
  const filingStopped = useRef(false);
  const [filingTick, setFilingTick] = useState(0);
  /** What the filer is doing, shown on Finance Home so a stuck filing is never silent. */
  const [filingLog, setFilingLog] = useState<{ done: number; last?: string; problem?: string; working?: string }>({ done: 0 });
  const filingOff = !settings.financeFiling ? 'Finance folders are not set up yet (Settings → Google, e-mail & backup → Set up finance folders).'
    : !canPrepare ? 'Papers are filed when Accounts or the Super Admin opens the finance pages.'
    : !hasFinanceDrive() ? 'The SHCO Finance drive is not linked (Settings → Google, e-mail & backup).' : '';
  const retryFiling = () => { filingSkip.current.clear(); filingStopped.current = false; setFilingLog((x) => ({ ...x, problem: undefined })); setFilingTick((x) => x + 1); };
  useEffect(() => {
    const ff = settings.financeFiling;
    if (!ff || !canPrepare || !hasFinanceDrive() || filingBusy.current || filingStopped.current) return;
    const job = nextFilingJob({ travel: travelClaims, expense: expenses, pv: paymentVouchers, receipt: receipts }, {
      from: ff.from,
      matterOf: (caseId, ref) => { const k = findCase(lk, caseId, ref); return k ? { ref: k.ref, title: k.title, practiceArea: k.practiceArea, type: k.type } : ref ? { ref } : undefined; },
    }, filingSkip.current);
    if (!job) { setFilingLog((x) => (x.working ? { ...x, working: undefined } : x)); return; }
    filingBusy.current = true;
    setFilingLog((x) => ({ ...x, working: job.name }));
    void (async () => {
      try {
        const res = await fileFinanceEntry({ path: job.path, name: job.name, folderId: job.folderId, papers: job.papers, matter: job.matter, matters: job.matters });
        // Every record of the unit (one record, or all items of a claim / payment-request form).
        for (const r of job.recs || [{ kind: job.kind, recId: job.recId }]) {
          if (r.kind === 'travel') {
            const t = travelClaims.find((x) => x.id === r.recId);
            if (t) { app.updateTravelClaim(t.id, applyFiled(t, job, res, 'travel')); const em = staffUser(t.claimant)?.email; if (em) job.papers.forEach((p, i) => { if (p.recId === t.id && res.papers[i]) void grantReader(res.papers[i].id, em).catch(() => undefined); }); }
          } else if (r.kind === 'expense') {
            const e = expenses.find((x) => x.id === r.recId);
            if (e) { app.updateExpense(e.id, applyFiled(e, job, res, 'expense')); const em = e.claimant ? staffUser(e.claimant)?.email : ''; if (em) job.papers.forEach((p, i) => { if (p.recId === e.id && res.papers[i]) void grantReader(res.papers[i].id, em).catch(() => undefined); }); }
          } else if (r.kind === 'pv') { const v = paymentVouchers.find((x) => x.id === r.recId); if (v) app.updatePaymentVoucher(v.id, applyFiled(v, job, res, 'pv')); }
          else { const x = receipts.find((y) => y.id === r.recId); if (x) app.updateReceipt(x.id, applyFiled(x, job, res, 'receipt')); }
        }
        setFilingLog((x) => ({ ...x, done: x.done + 1, last: job.path.slice(1).join(' › ') + ' › ' + job.name }));
      } catch (err) {
        filingSkip.current.add(job.unit || job.kind + ':' + job.recId);
        const m = err instanceof Error ? err.message : String(err);
        setFilingLog((x) => ({ ...x, problem: job.name + ': ' + m }));
        if (/permission|access|401|403|not found|insufficient/i.test(m)) { filingStopped.current = true; toastMsg('Finance filing paused: ' + m); }
      } finally {
        filingBusy.current = false;
        setFilingTick((x) => x + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, canPrepare, travelClaims, expenses, paymentVouchers, receipts, lk, filingTick]);

  /* ------------------------------ invoices & payments ------------------------------ */
  const paidByInvoice = useMemo(() => { const m = new Map<string, number>(); payments.forEach((p) => m.set(p.invoiceId, (m.get(p.invoiceId) || 0) + Number(p.amount || 0))); return m; }, [payments]);
  const invPaid = (inv: Invoice) => paidByInvoice.get(inv.id) || 0;
  /** Proforma money (fees received in advance) applied to the invoice. */
  const invDeposit = (inv: Invoice) => (inv.status === 'Voided' ? 0 : Number(inv.depositApplied || 0));
  const invSettled = (inv: Invoice) => invPaid(inv) + invDeposit(inv) + Number(inv.writtenOff || 0);
  /** Remaining balance — voided invoices never count; part-paid count only what is left; the
   * proforma deposit applied is deducted. */
  const invBal = (inv: Invoice) => (inv.status === 'Voided' ? 0 : Math.max(0, round2(Number(inv.total || 0) - invSettled(inv))));
  /** Money received above the invoice total: a credit owed to the client (not hidden by clamping). */
  const invCredit = (inv: Invoice) => (inv.status === 'Voided' ? 0 : Math.max(0, round2(invSettled(inv) - Number(inv.total || 0))));
  const invIssued = (inv: Invoice) => !['Draft', 'Pending Review', 'Voided'].includes(inv.status);
  const invStatus = (inv: Invoice): string => {
    if (inv.status === 'Voided') return 'Voided';
    if (inv.status === 'Draft' || inv.status === 'Pending Review') return 'Draft';
    const bal = invBal(inv);
    if (bal <= 0.005) return (inv.writtenOff || 0) > 0 && invPaid(inv) + invDeposit(inv) < Number(inv.total || 0) - 0.005 ? 'Written off' : 'Paid';
    const due = parseDate(inv.dueDate);
    if (due && due < Date.now() - 86400000) return 'Overdue';
    if (invPaid(inv) > 0) return 'Part-paid';
    return inv.historical ? 'Historical' : 'Sent';
  };
  const invCase = (inv: Invoice) => findCase(lk, inv.caseId, inv.fileRef);
  /** Money received against invoices, split into fee income / SST / disbursements recovered:
   * every payment, plus the proforma deposit applied (dated on the invoice issue date). */
  interface MoneyIn { inv: Invoice; date: string; amount: number; income: number; sst: number; disb: number; kind: 'payment' | 'deposit' }
  const moneyReceived = (invs: Invoice[]): MoneyIn[] => {
    const ids = new Map<string, Invoice>(invs.filter((i) => i.status !== 'Voided').map((i) => [i.id, i] as [string, Invoice]));
    const out: MoneyIn[] = [];
    payments.forEach((pm) => { const inv = ids.get(pm.invoiceId); if (!inv) return; const sp = splitReceipt(Number(pm.amount || 0), invoiceComposition(inv)); out.push({ inv, date: pm.date, amount: Number(pm.amount || 0), ...sp, kind: 'payment' }); });
    ids.forEach((inv) => { const d = Number(inv.depositApplied || 0); if (d > 0 && invIssued(inv)) { const sp = splitReceipt(d, invoiceComposition(inv)); out.push({ inv, date: inv.issuedAt || inv.date, amount: d, ...sp, kind: 'deposit' }); } });
    return out;
  };
  const scopedInvoices = useMemo(() => invoices.filter((i) => ownCase(invCase(i))), [invoices, rk, lk, currentPartnerCode]);
  /** Debtor ageing — AccountingCentreView's rule (days from due date, else issue date). */
  const ageDays = (inv: Invoice) => { const due = inv.dueDate || inv.date; return due ? Math.max(0, daysSince(due)) : 0; };
  const openInvoices = scopedInvoices.filter((i) => invIssued(i) && invBal(i) > 0.005);
  const owedTotal = openInvoices.reduce((s, i) => s + invBal(i), 0);
  const aging = [[0, 30], [31, 60], [61, 90], [91, Infinity]].map(([a, b]) => openInvoices.filter((i) => { const d = ageDays(i); return d >= a && d <= b; }).reduce((s, i) => s + invBal(i), 0));

  /* ------------------------------ quotations / proformas / receipts ------------------------------ */
  const qCase = (q: Quotation) => findCase(lk, q.caseId, q.fileRef);
  const receiptsFor = (docId: string) => receipts.filter((r) => r.quotationId === docId || r.forNo === docId);
  /** The quotation a proforma was made from (itself for a quotation / stand-alone proforma). */
  const rootQuoteId = (q: Quotation) => (q.documentType === 'Proforma' && q.sourceQuotationId ? q.sourceQuotationId : q.id);
  const proformasOf = (rootId: string) => quotations.filter((p) => p.documentType === 'Proforma' && (p.id === rootId || p.sourceQuotationId === rootId));
  /** The live invoice made straight from this quotation / proforma (stage billing: one per proforma). */
  const invoiceForDoc = (docId: string) => invoices.find((i) => i.status !== 'Voided' && i.quotationId === docId);
  const invoiceForQuote = (rootId: string) => { const pf = new Set(proformasOf(rootId).map((p) => p.id)); return invoices.find((i) => i.status !== 'Voided' && !!i.quotationId && (i.quotationId === rootId || pf.has(i.quotationId))); };
  /** Office-account proforma receipts for this quotation not yet applied to another live invoice
   * (client-account money stays client money: it reaches an invoice only by a transfer). */
  const depositReceipts = (rootId: string, exceptInvoiceId?: string) => {
    const pfIds = new Set([rootId, ...proformasOf(rootId).map((p) => p.id)]);
    const used = new Set(invoices.filter((i) => i.status !== 'Voided' && i.id !== exceptInvoiceId).flatMap((i) => i.depositReceiptIds || []));
    return receipts.filter((r) => r.accountSet !== 'CLIENT' && !r.invoiceId && !!(r.quotationId ? pfIds.has(r.quotationId) : r.forNo && pfIds.has(r.forNo)) && !used.has(r.id));
  };
  /** Deposit to apply on an invoice for quotation `rootId`: never more than the invoice total. */
  const depositFor = (rootId: string | undefined, total: number, exceptInvoiceId?: string) => {
    if (!rootId) return { amount: 0, ids: [] as string[] };
    const recs = depositReceipts(rootId, exceptInvoiceId);
    return { amount: Math.min(round2(recs.reduce((s2, r) => s2 + Number(r.amount || 0), 0)), round2(total)), ids: recs.map((r) => r.id) };
  };
  /** Payment-plan rows of a quotation (stages / months) with the proforma already issued for each. */
  const planOf = (q: Quotation): QuotationPaymentPlan | undefined => q.paymentPlan || (q.feeArrangement && q.feeArrangement.on ? { kind: 'Instalments', months: q.feeArrangement.months, upfront: q.feeArrangement.upfront } : undefined);
  const planStatus = (q: Quotation): (PlanRow & { proforma?: Quotation })[] => {
    const plan = planOf(q);
    if (!plan || plan.kind === 'Full') return [];
    const pfs = quotations.filter((p) => p.documentType === 'Proforma' && p.sourceQuotationId === q.id && p.status !== 'Declined' && p.planRowKey);
    return planRows(plan, Number(q.total || 0)).map((r) => ({ ...r, proforma: pfs.find((p) => p.planRowKey === r.key) }));
  };
  const proformaPaid = (q: Quotation) => receiptsFor(q.id).reduce((s, r) => s + Number(r.amount || 0), 0);
  const qStatus = (q: Quotation): string => {
    if (q.documentType === 'Proforma') {
      if (q.historical) return 'Past';
      if (['Draft', 'Pending Approval'].includes(q.status)) return 'Draft';
      if (q.status === 'Declined') return 'Declined';
      return proformaPaid(q) >= Number(q.total || 0) - 0.005 && q.total > 0 ? 'Paid' : 'Unpaid';
    }
    if (invoiceForDoc(q.id)) return 'Invoiced';
    if (quotations.some((p) => p.documentType === 'Proforma' && p.sourceQuotationId === q.id)) return 'Proforma made';
    if (q.status === 'Sent' && daysSince(q.documentSentDate || q.date) > (q.validityDays || Number(settings.quotationValidityDays) || 30)) return 'Expired';
    return q.status;
  };
  const scopedQuotations = useMemo(() => quotations.filter((q) => q.subtype !== 'Consultation' || true).filter((q) => ownCase(qCase(q))), [quotations, rk, lk, currentPartnerCode]);
  const scopedReceipts = useMemo(() => receipts.filter((r) => ownCase(findCase(lk, r.caseId, r.fileRef))), [receipts, rk, lk, currentPartnerCode]);

  /** A quotation / proforma can be deleted within 10 minutes of making it, or any time while it is a draft
   * nothing was made from (no proforma, invoice or money received). Quotations are never voided. */
  // Delete: admins (Super Admin or anyone marked Admin in Users & Roles). Quotations, bills and
  // receipts can also be deleted by Accounts.
  const isAdminUser = !!(app.isAdmin || currentUser?.isSuperAdmin);
  const canDeleteBills = isAdminUser || rk === 'A';
  const canDeleteQuote = (q: Quotation): boolean => canDeleteBills && !invoiceForQuote(q.id) && !quotations.some((p) => p.sourceQuotationId === q.id) && receiptsFor(q.id).length === 0;
  const deleteQuote = (q: Quotation) => {
    if (!canDeleteQuote(q)) { toastMsg(canDeleteBills ? 'Something was made from it (a proforma, invoice or receipt): delete that first.' : 'Only an admin or Accounts can delete.'); return; }
    if (typeof window !== 'undefined' && !window.confirm('Delete ' + q.id + (q.clientName ? ' for ' + q.clientName : '') + '? It goes to the Recycle Bin.')) return;
    app.deleteQuotation(q.id);
    setView(null);
  };

  /** Reverses every posting made under a document number (any type), so the books still balance. */
  const reverseDoc = (docNo: string, why: string) => {
    const m = new Map<string, Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>>();
    generalLedger.filter((g) => g.docNo === docNo).forEach((g) => {
      const back = m.get(g.credit + '|' + g.debit + '|' + g.accountSet);
      if (back && back.amount > 0.004) { back.amount = round2(back.amount - Number(g.amount || 0)); return; }
      const k = g.debit + '|' + g.credit + '|' + g.accountSet;
      const x = m.get(k) || { date: todayIso(), docType: g.docType, docNo, accountSet: g.accountSet, debit: g.debit, credit: g.credit, amount: 0, clientId: g.clientId, fileRef: g.fileRef, description: '' };
      x.amount = round2(x.amount + Number(g.amount || 0)); m.set(k, x);
    });
    const rows = [...m.values()].filter((x) => x.amount > 0.004).map((x) => ({ ...x, debit: x.credit, credit: x.debit, description: `Reversal (${why}) of ${docNo}` }));
    if (rows.length) postGL(rows);
  };
  const deleteInvoice = (inv: Invoice) => {
    if (!canDeleteBills) { toastMsg('Only an admin or Accounts can delete.'); return; }
    if (invPaid(inv) > 0.005) { toastMsg(inv.id + ' has money received: delete those receipts first.'); return; }
    if (!window.confirm('Delete ' + inv.id + '? Its postings are reversed and its work goes back to "Work not billed yet". It stays in the Recycle Bin.')) return;
    reverseDoc(inv.id, 'deleted');
    const si = inv.sourceItems || {};
    (si.time || []).forEach((id) => app.updateTimeEntry(id, { billed: false, invoiceId: undefined }));
    (si.expenses || []).forEach((id) => app.updateExpense(id, { billed: false }));
    (si.travel || []).forEach((id) => app.updateTravelClaim(id, { billed: 'N', invoiceNo: '' }));
    app.removeFinanceRecords({ invoices: [inv.id] }, 'Invoice deleted by ' + me);
    setView(null); toastMsg(inv.id + ' deleted · postings reversed');
  };
  const deleteReceipt = (r: Receipt) => {
    if (!canDeleteBills) { toastMsg('Only an admin or Accounts can delete.'); return; }
    if (!window.confirm('Delete receipt ' + r.id + ' (' + rm2(Number(r.amount || 0)) + ')? The payment it recorded and its postings are reversed. It stays in the Recycle Bin.')) return;
    if (r.accountSet === 'CLIENT' && r.clientId && clientLedgerBalance(r.clientId, r.caseId || '') - Number(r.amount || 0) < -0.005) { toastMsg(r.id + ' was already used (paid out or transferred). Deleting it would take the client ledger below zero: correct it with a journal on the Client Account page.'); return; }
    reverseDoc(r.id, 'deleted');
    app.removeFinanceRecords({ receipts: [r.id], payments: payments.filter((p) => p.id === 'PAY-' + r.id).map((p) => p.id), retainers: retainers.filter((x) => x.id === 'RET-' + r.id).map((x) => x.id) }, 'Receipt deleted by ' + me);
    setView(null); toastMsg(r.id + ' deleted · postings reversed');
  };
  const editReceipt = async (r: Receipt) => {
    const v = await askForm('Edit receipt ' + r.id, [{ key: 'date', label: 'Date', type: 'date', value: isoOf(parseDate(r.date) || Date.now()), required: true }, { key: 'desc', label: 'Details on the receipt', value: r.description || '' }], { note: 'To change the amount, delete the receipt and record it again.' });
    if (!v) return;
    app.updateReceipt(r.id, { date: v.date, description: v.desc.trim() || r.description });
    const old = isoOf(parseDate(r.date) || Date.now());
    if (v.date && v.date !== old) redateDoc(r.id, v.date);
    toastMsg(r.id + ' updated' + (v.date && v.date !== old ? ' · book entries moved to the new date' : '') + ' · to change the amount, delete it and record it again');
  };

  /* ------------------------------ edit / delete any money entry ------------------------------ */
  /** Moves a document's postings to a new date: reversed on their own date, posted again on the new one. */
  const redateDoc = (docNo: string, newDate: string) => {
    const rows = generalLedger.filter((g) => g.docNo === docNo);
    if (!rows.length) return;
    const copy = (g: GeneralLedgerEntry) => ({ docType: g.docType, docNo, accountSet: g.accountSet, amount: g.amount, clientId: g.clientId, fileRef: g.fileRef });
    postGL(rows.map((g) => ({ ...copy(g), date: g.date, debit: g.credit, credit: g.debit, description: `Date changed to ${newDate}: ${g.description}` })));
    postGL(rows.map((g) => ({ ...copy(g), date: newDate, debit: g.debit, credit: g.credit, description: g.description })));
  };
  type MoneyKind = 'expense' | 'pv' | 'travel' | 'receipt';
  /** Cash-book row key ("e:EX-0001", "v:…", "t:…", "r:…") → the record behind it. */
  const entryOf = (key: string): { kind: MoneyKind; id: string } | null => {
    const i = key.indexOf(':'); const p = key.slice(0, i), id = key.slice(i + 1);
    return p === 'e' ? { kind: 'expense', id } : p === 'v' ? { kind: 'pv', id } : p === 't' ? { kind: 'travel', id } : p === 'r' ? { kind: 'receipt', id } : null;
  };
  const isClientMoney = (kind: MoneyKind, id: string) => (kind === 'expense' ? expenses.find((x) => x.id === id)?.accountSet === 'CLIENT' : kind === 'pv' ? paymentVouchers.find((x) => x.id === id)?.accountSet === 'CLIENT' : kind === 'receipt' ? receipts.find((x) => x.id === id)?.accountSet === 'CLIENT' : false);
  /** Edit the date, who and details of a money entry (amounts: delete and record again, so the books stay clean). */
  const editEntry = async (kind: MoneyKind, id: string) => {
    if (!canPrepare) { toastMsg('Money entries are corrected by Accounts.'); return; }
    if (kind === 'receipt') { const r = receipts.find((x) => x.id === id); if (r) await editReceipt(r); return; }
    const clientPv = kind === 'pv' && isClientMoney(kind, id);
    if (isClientMoney(kind, id) && !clientPv) { toastMsg('This line belongs to a client-account payment: edit that payment instead.'); return; }
    const rec = kind === 'expense' ? expenses.find((x) => x.id === id) : kind === 'pv' ? paymentVouchers.find((x) => x.id === id) : travelClaims.find((x) => x.id === id);
    if (!rec) return;
    const t = kind === 'travel' ? (rec as TravelClaim) : null, e = kind === 'expense' ? (rec as Expense) : null, v = kind === 'pv' ? (rec as PaymentVoucher) : null;
    const v0 = { date: isoOf(parseDate(rec.date) || Date.now()), who: t ? t.claimant : (e?.payee || v?.payee || ''), what: t ? t.purpose : (e?.description || v?.description || '') };
    const f = await askForm('Edit ' + id, [
      ...(clientPv ? [] : [{ key: 'date', label: 'Date', type: 'date' as const, value: v0.date, required: true }]),
      ...(t ? [] : [{ key: 'who', label: 'Paid to', value: v0.who }]),
      { key: 'what', label: 'Details', value: v0.what, required: true },
    ], { note: clientPv ? 'Client money: the date and amount stay as recorded (they are in the client ledger). To correct those, use a journal on the Client Account page.' : 'To change the amount, delete this entry and record it again (its book entries are reversed).', ok: 'Save' });
    if (!f) return;
    const date = f.date || v0.date;
    if (t) app.updateTravelClaim(id, { date, purpose: f.what.trim() });
    else if (e) app.updateExpense(id, { date, payee: (f.who || '').trim() || e.payee, description: f.what.trim() });
    else if (v) app.updatePaymentVoucher(id, { date, payee: (f.who || '').trim() || v.payee, description: f.what.trim() });
    if (date !== v0.date) redateDoc(id, date);
    toastMsg(id + ' updated' + (date !== v0.date ? ' · book entries moved to ' + fd(parseDate(date)) : ''));
  };
  /** Delete a money entry: its book entries are reversed and it goes to the Recycle Bin. Admins and Accounts. */
  const deleteEntry = (kind: MoneyKind, id: string) => {
    if (!canDeleteBills) { toastMsg('Only an admin or Accounts can delete.'); return; }
    if (kind === 'receipt') { const r = receipts.find((x) => x.id === id); if (r) deleteReceipt(r); return; }
    if (kind === 'pv' && isClientMoney(kind, id)) {
      const v = paymentVouchers.find((x) => x.id === id);
      if (v && (v.paidAt || v.postedToGl || v.approvalStatus === 'Posted to GL')) { toastMsg(id + ' was paid out of client money: correct it with a journal on the Client Account page (the ledger, cash book and bank must agree).'); return; }
    } else if (isClientMoney(kind, id)) { toastMsg('This line belongs to a client-account payment: delete that payment instead.'); return; }
    const onBill = invoices.find((i) => [...(i.sourceItems?.expenses || []), ...(i.sourceItems?.travel || [])].includes(id) && invStatus(i) !== 'Voided');
    if (onBill) { toastMsg(id + ' is on bill ' + onBill.id + ': delete or void that bill first.'); return; }
    if (!window.confirm('Delete ' + id + '? Its book entries are reversed and it goes to the Recycle Bin.')) return;
    reverseDoc(id, 'deleted');
    if (kind === 'pv') {
      const v = paymentVouchers.find((x) => x.id === id);
      // The billing line made with a payment request (same form, amount and description) goes too.
      const twin = v?.formNo ? expenses.filter((x) => x.formNo === v.formNo && x.isClaimantAdvance === false && Number(x.amount) === Number(v.amount) && x.description === v.description && !x.billed).map((x) => x.id) : [];
      app.removeFinanceRecords({ paymentVouchers: [id], expenses: twin }, 'Deleted by ' + me);
    } else if (kind === 'travel') app.removeFinanceRecords({ travelClaims: [id] }, 'Deleted by ' + me);
    else app.removeFinanceRecords({ expenses: [id] }, 'Deleted by ' + me);
    toastMsg(id + ' deleted · book entries reversed');
  };

  const actionsFor = (kind: DocKind, rec: Quotation | Invoice | Receipt): string[] => {
    if (kind === 'receipt') return ['View'];
    if (kind === 'invoice') {
      const inv = rec as Invoice, S = invStatus(inv);
      // Void: issued invoices with no money received (refund / reallocate money first).
      const canVoid = S !== 'Draft' && S !== 'Voided' && invPaid(inv) < 0.005 && !(inv.writtenOff || 0);
      const base = S === 'Draft' ? ['Issue', 'Record paid'] : S === 'Paid' ? ['View receipt'] : S === 'Voided' || S === 'Written off' ? ['View'] : S === 'Overdue' ? ['Remind', 'Record paid'] : ['Record paid', 'Remind'];
      return canVoid ? [...base, 'Void'] : base;
    }
    const q = rec as Quotation, S = qStatus(q);
    if (q.historical) return ['View'];
    if (q.documentType === 'Proforma') {
      const invoiced = !!invoiceForDoc(q.id);
      // Sending is offered, never required: a draft proforma can be paid or invoiced straight away.
      const base = S === 'Draft' ? ['Send', 'Record payment'] : S === 'Paid' ? ['View receipt'] : S === 'Declined' ? ['View'] : ['Record payment', 'Remind'];
      return S !== 'Declined' && !invoiced ? [...base, 'Convert to invoice'] : base;
    }
    // Stages / instalments: one proforma per row ("Issue proforma: <stage / month>"), next row first.
    const next = (S === 'Accepted' || S === 'Proforma made') ? planStatus(q).find((r) => !r.proforma) : undefined;
    const planActs = next ? ['Issue proforma: ' + next.label] : [];
    // Sending is offered, never required, and quotations need no approval: mark accepted directly.
    if (planStatus(q).length) return S === 'Accepted' || S === 'Proforma made' ? [...planActs, 'Convert to invoice'] : ['Draft', 'Pending Approval', 'Ready'].includes(S) ? ['Send', 'Mark accepted'] : S === 'Sent' ? ['Mark accepted', 'Resend'] : S === 'Expired' ? ['Resend'] : ['View'];
    return ['Draft', 'Pending Approval', 'Ready'].includes(S) ? ['Send', 'Mark accepted'] : S === 'Sent' ? ['Mark accepted', 'Resend'] : S === 'Accepted' ? ['Make proforma', 'Convert to invoice'] : S === 'Proforma made' ? ['Convert to invoice', 'View'] : S === 'Expired' ? ['Resend'] : ['View'];
  };

  /* ------------------------------ documents (FinanceDoc for docHtml) ------------------------------ */
  const docProofs = (owner: string, proofs?: FinanceProof[]) => (proofs || []).map((p) => ({ name: p.name, url: proofLink(owner, p) }));
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
  /** What is currently posted for an invoice: its INV entries with reversals (same pair swapped)
   * netted off. */
  const netInvGL = (docNo: string) => {
    const m = new Map<string, { debit: string; credit: string; amount: number; clientId: string; fileRef: string }>();
    generalLedger.filter((g) => g.docType === 'INV' && g.docNo === docNo).slice().sort((a, b) => a.glNo - b.glNo).forEach((g) => {
      const rev = m.get(g.credit + '|' + g.debit);
      if (rev && rev.amount > 0.004) { rev.amount = round2(rev.amount - Number(g.amount || 0)); return; }
      const k = g.debit + '|' + g.credit;
      const x = m.get(k) || { debit: g.debit, credit: g.credit, amount: 0, clientId: g.clientId, fileRef: g.fileRef };
      x.amount = round2(x.amount + Number(g.amount || 0)); m.set(k, x);
    });
    return [...m.values()].filter((x) => x.amount > 0.004);
  };
  /** Reversing entries (debit / credit swapped) for everything currently posted on an invoice. */
  const reversalOf = (docNo: string, date: string, why: string): Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>[] =>
    netInvGL(docNo).map((x) => ({ date, docType: 'INV', docNo, accountSet: 'OFFICE', debit: x.credit, credit: x.debit, amount: x.amount, clientId: x.clientId, fileRef: x.fileRef, description: `Reversal (${why}) of ${docNo}` }));
  /** Issue postings: fees + reimbursements → fee income; disbursements clear 1200 (recovered from
   * the client, never income); SST → SST payable; proforma deposit applied → Dr 2110 / Cr AR. */
  const issueGL = (inv: Invoice, date: string): Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>[] => {
    const c = invoiceComposition(inv);
    const base = { date, docType: 'INV' as const, docNo: inv.id, accountSet: 'OFFICE' as const, clientId: inv.clientId, fileRef: inv.fileRef || '' };
    const out: Omit<GeneralLedgerEntry, 'glNo' | 'reconciled'>[] = [
      { ...base, debit: GLA.ar, credit: GLA.fees, amount: round2(Number(inv.total || 0) - c.sst - c.disb), description: `Invoice ${inv.id} · professional fees & reimbursements` },
      { ...base, debit: GLA.ar, credit: GLA.unbilledDisb, amount: c.disb, description: `Invoice ${inv.id} · disbursements billed (recovered from client)` },
      { ...base, debit: GLA.ar, credit: GLA.sst, amount: c.sst, description: `Invoice ${inv.id} · SST` },
    ];
    const dep = Number(inv.depositApplied || 0);
    if (dep > 0) {
      // Proforma receipts booked before this fix were credited to fee income (4000): applying
      // those reverses that income instead, so the fee is counted once (on this invoice).
      const legacy = receipts.filter((r) => (inv.depositReceiptIds || []).includes(r.id) && r.credit === GLA.fees).reduce((s2, r) => s2 + Number(r.amount || 0), 0);
      const legacyAmt = round2(Math.min(dep, legacy));
      out.push({ ...base, debit: GLA.fees, credit: GLA.ar, amount: legacyAmt, description: `Invoice ${inv.id} · proforma deposit applied (old receipt booked to fee income)` });
      out.push({ ...base, debit: GLA.feesAdvance, credit: GLA.ar, amount: round2(dep - legacyAmt), description: `Invoice ${inv.id} · proforma deposit applied` });
    }
    return out;
  };
  /** Several ids of one kind inside a single action (getNextSequenceId only advances on re-render). */
  const seqIds = (type: Parameters<typeof app.getNextSequenceId>[0], n: number, date?: string): string[] => {
    const first = app.getNextSequenceId(type, date);
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
  interface Unbilled { caseId: string; kase?: Case; client: string; ref: string; title: string; pic: string; time: number; disb: number; oldest: number; te: typeof timeEntries; ex: Expense[]; tc: TravelClaim[] }
  /** Work already on a draft invoice (it is marked billed only when that invoice is issued). */
  const onDraft = useMemo(() => {
    const ids = new Set<string>();
    invoices.filter((i) => i.status === 'Draft' || i.status === 'Pending Review').forEach((i) => { const si = i.sourceItems || {}; [...(si.time || []), ...(si.expenses || []), ...(si.travel || [])].forEach((x) => ids.add(x)); });
    return ids;
  }, [invoices]);
  const travelBillable = (t: TravelClaim) => Math.max(0, Number(t.billableClientTotal || 0));
  const unbilled: Unbilled[] = useMemo(() => {
    const m = new Map<string, Unbilled>();
    const get = (caseId: string) => { const k = findCase(lk, caseId, caseId); const key = k?.id || caseId || '—'; let u = m.get(key); if (!u) { u = { caseId: key, kase: k, client: k ? (clientName(k.clientId.split(',')[0].trim()) || k.clientName || '—') : '—', ref: k?.ref || caseId || '—', title: k?.title || '', pic: k ? ((k.partners || [])[0] || initials(k.lawyerInCharge)) : '—', time: 0, disb: 0, oldest: 0, te: [], ex: [], tc: [] }; m.set(key, u); } return u; };
    // Same rule as billingEngine: billable, not billed / written off, approved (not rejected / pending).
    timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff && isApprovedForBilling(t.approvalStatus) && !onDraft.has(t.id)).forEach((t) => { const u = get(t.caseId); u.time += Number(t.hours || 0) * Number(t.rate || 0); u.te.push(t); u.oldest = Math.max(u.oldest, daysSince(t.date)); });
    expenses.filter((e) => e.billable && !e.billed && !e.writtenOff && isApprovedForBilling(e.approvalStatus) && !onDraft.has(e.id)).forEach((e) => { const u = get(e.caseId || e.fileRef || ''); u.disb += Number(e.amount || 0); u.ex.push(e); u.oldest = Math.max(u.oldest, daysSince(e.date)); });
    // Billable travel (mileage at the client rate + toll + parking) from approved staff claims.
    travelClaims.filter((t) => travelBillable(t) > 0 && t.billed !== 'Y' && !!t.fileRef && t.fileRef !== 'FIRM_OPERATIONS' && isApprovedForBilling(t.approvalStatus) && !onDraft.has(t.id)).forEach((t) => { const u = get(t.fileRef); u.disb += travelBillable(t); u.tc.push(t); u.oldest = Math.max(u.oldest, daysSince(t.date)); });
    return [...m.values()].filter((u) => u.time + u.disb > 0 && (rk !== 'P' || ownCase(u.kase))).sort((a, b) => b.oldest - a.oldest);
  }, [timeEntries, expenses, travelClaims, onDraft, lk, rk]);
  const wipTotal = unbilled.reduce((s, u) => s + u.time + u.disb, 0);

  /* ------------------------------ bank accounts ------------------------------ */
  const activeBanks = bankAccounts.filter((b) => b.status !== 'Archived');
  const bankKind = (b: (typeof bankAccounts)[number]): CashAcc => ((b.functions || []).includes('Petty Cash') ? 'Petty cash' : (b.functions || []).includes('Disbursement') ? 'Disbursement' : b.type === 'Trust' || (b.functions || []).includes('Trust Account') ? 'Client account' : 'Office');
  // One bank list: Firm & Practice Settings → Banks. The old bank records are only used while no bank
  // is set there (they are kept, not deleted).
  const banksOf = (k: CashAcc) => ((settings.bankAccounts || []).some((b) => b.isActive !== false) ? [] : activeBanks.filter((b) => bankKind(b) === k));
  /** "Paid from" choices: the firm's own bank accounts in Settings → Banks (not the client account). */
  const paidFromOptions = (() => {
    const l = (settings.bankAccounts || []).filter((b) => b.isActive !== false && !['Client Trust', 'Syariah Escrow', 'Fixed Deposit Stakeholder'].includes(b.accountType))
      .map((b) => `${b.bankName}${b.typeLabel || b.accountType ? ' · ' + (b.typeLabel || b.accountType) : ''}${b.accountNo ? ' (…' + String(b.accountNo).replace(/\s+/g, '').slice(-4) + ')' : ''}`);
    return l.length ? l : ['Office account'];
  })();
  /** Firm & Practice Settings → Banks: the bank accounts whose opening balances are kept there. */
  const firmBankKind = (b: { accountType: string; typeLabel?: string }): CashAcc | null => (/petty/i.test(b.typeLabel || '') ? 'Petty cash' : b.accountType === 'Client Trust' ? 'Client account' : b.accountType === 'Disbursement' ? 'Disbursement' : b.accountType === 'Office Operating' ? 'Office' : null);
  const firmBanksOf = (k: CashAcc) => (settings.bankAccounts || []).filter((b) => b.isActive !== false && firmBankKind(b) === k);
  /** Cash-book entries on or before this date are already inside the opening balance. */
  const openingAsAt = settings.bankOpeningBalancesAsAt ? parseDate(settings.bankOpeningBalancesAsAt) : 0;
  /** Book balance = opening balance (Firm Settings) + every cash-book movement to date. */
  const bankBal = (k: CashAcc): number | null => {
    if (!banksOf(k).length && !firmBanksOf(k).length) return null;
    return round2(openingBalance(k) + cashBook(k).filter((r) => r.t <= Date.now()).reduce((s2, r) => s2 + r.inn - r.out, 0));
  };
  const lastRecon = (bankId: string) => { const r = bankReconciliationEntries.filter((e) => e.bankAccountId === bankId && e.status === 'Reconciled' && e.reconciledDate).map((e) => e.reconciledDate as string).sort(); return r.length ? r[r.length - 1] : ''; };

  /* ------------------------------ approvals ------------------------------ */
  const sigLine = (s?: FinanceSignatory[]) => ((s || []).length ? ' · signed by ' + (s || []).map((x) => x.name).join(', ') : '');
  const pvIsClient = (v: PaymentVoucher) => v.accountSet === 'CLIENT';
  const referralFor = (inRange: (date: string) => boolean) => {
    const rows = referralPartners.filter((p) => p.active !== false && p.commissionType !== 'None').map((p) => {
      const cs = cases.filter((c) => c.referredBy && (norm(c.referredBy) === norm(p.name) || norm(c.referredBy) === norm(p.id)));
      const csIds = new Set(cs.flatMap((c) => [c.id, c.ref]));
      const invs = invoices.filter((i) => i.status !== 'Voided' && invIssued(i) && (csIds.has(i.caseId) || csIds.has(i.fileRef || '')));
      // Money received for the referred matters: invoice payments + proforma deposits applied
      // (dated when applied, i.e. the invoice issue date).
      const money = moneyReceived(invs);
      const inRangeMoney = money.filter((x) => inRange(x.date));
      // % is of fee income only (excl. SST and disbursements).
      const base = inRangeMoney.reduce((s, x) => s + x.income, 0);
      // A flat fee is paid ONCE per matter: in the period of the first money received for it.
      const firstByMatter = new Map<string, number>();
      money.forEach((x) => { const k = x.inv.caseId || x.inv.fileRef || x.inv.id; const t = parseDate(x.date); if (t && (!firstByMatter.has(k) || t < firstByMatter.get(k)!)) firstByMatter.set(k, t); });
      const flatMatters = [...firstByMatter.values()].filter((t) => inRange(isoOf(t))).length;
      const fee = p.commissionType === 'Percentage' ? base * Number(p.commissionValue || 0) / 100 : flatMatters * Number(p.commissionValue || 0);
      const files = [...new Set(inRangeMoney.map((x) => x.inv.partyName || clientName(x.inv.clientId) || x.inv.fileRef || x.inv.id))].join(', ');
      const type = p.type === 'Partner' ? 'Partner' : p.type === 'Internal Staff' ? 'Staff' : 'Outside';
      const via = type === 'Partner' ? 'Partner drawings' : type === 'Staff' ? 'Payslip' : 'Voucher';
      return { id: p.id, name: p.name, type, files, base, flat: p.commissionType === 'Flat', rate: Number(p.commissionValue || 0), fee, via };
    }).filter((r) => r.base > 0 || r.fee > 0);
    return { rows, total: rows.reduce((s, r) => s + r.fee, 0) };
  };
  const referral = useMemo(() => referralFor((d) => inPeriod(d, period)), [referralPartners, cases, invoices, payments, period]);
  const refDecision = (settings.referralFeeApprovals || {})[period];

  /** The approval limit applies to the whole claim / PV FORM: total of every live item on it. */
  const formTotalOf = (item: Pick<ApItem, 'kind' | 'id' | 'amount'>): { total: number; formNo?: string } => {
    if (item.kind === 'travel' || item.kind === 'expense') {
      const formNo = item.kind === 'travel' ? travelClaims.find((t) => t.id === item.id)?.formNo : expenses.find((e) => e.id === item.id)?.formNo;
      const all = [...travelClaims.map((t) => ({ id: t.id, formNo: t.formNo, amount: Number(t.total || 0), rejected: t.approvalStatus === 'Rejected' })), ...expenses.map((e) => ({ id: e.id, formNo: e.formNo, amount: Number(e.amount || 0), rejected: e.approvalStatus === 'Rejected' }))];
      return { total: claimFormTotal(all, formNo, item.amount), formNo };
    }
    if (item.kind === 'pv') {
      const formNo = paymentVouchers.find((v) => v.id === item.id)?.formNo;
      return { total: claimFormTotal(paymentVouchers.map((v) => ({ id: v.id, formNo: v.formNo, amount: Number(v.amount || 0), rejected: v.approvalStatus === 'Rejected' })), formNo, item.amount), formNo };
    }
    return { total: item.amount };
  };
  const apItems: ApItem[] = useMemo(() => {
    const out: ApItem[] = [];
    travelClaims.filter((t) => t.approvalStatus === 'Pending Approval' || t.approvalStatus === 'Pending PIC Approval').forEach((t) => out.push({ key: 'travel:' + t.id, date: t.date, folderId: firstDriveFolderId(t.attachments, t.paidProof ? [t.paidProof] : []) || undefined, kind: 'travel', id: t.id, type: 'Staff claim', title: `${t.type === 'Mileage' ? 'Mileage' : t.type}: ${t.purpose || t.to || ''}`.trim(), sub: `${t.claimant} · ${fd(t.date)}${t.fileRef ? ' · ' + t.fileRef : ''}${t.billableClientTotal ? ' · billable' : ''}${sigLine(t.signatories)}`, amount: Number(t.total || 0), by: t.claimant, clientAccount: false, signatories: t.signatories || [] }));
    expenses.filter((e) => e.approvalStatus === 'Pending Approval').forEach((e) => out.push({ key: 'expense:' + e.id, date: e.date, folderId: firstDriveFolderId(e.attachments, e.paidProof ? [e.paidProof] : []) || undefined, kind: 'expense', id: e.id, type: 'Staff claim', title: e.description || e.category, sub: `${e.claimant || e.payee || '—'} · ${fd(e.date)}${e.fileRef ? ' · ' + e.fileRef : ''}${e.billable ? ' · billable' : ''}${sigLine(e.signatories)}`, amount: Number(e.amount || 0), by: e.claimant || '—', clientAccount: false, signatories: e.signatories || [] }));
    paymentVouchers.filter((v) => v.approvalStatus === 'Pending Approval' && !v.historical).forEach((v) => out.push({ key: 'pv:' + v.id, date: v.date, folderId: firstDriveFolderId(v.attachments, v.proofs, v.paidProof ? [v.paidProof] : []) || undefined, kind: 'pv', id: v.id, type: pvIsClient(v) ? 'Client account' : 'Payment voucher', title: v.voucherCategory === 'Legal Fees Transfer' ? `Transfer to office for ${v.invoiceId || v.description}` : `${v.payee ? 'Pay ' + v.payee + ': ' : ''}${v.description}`, sub: `${v.id} · ${pvIsClient(v) ? (clientName(v.clientId) || v.clientId) + ' ledger · needs 2 signatories' : v.voucherCategory}${sigLine(v.signatories)}`, amount: Number(v.amount || 0), by: v.preparedBy || '—', clientAccount: pvIsClient(v), signatories: v.signatories || [] }));
    manualJournals.filter((j) => j.status === 'Pending Approval').forEach((j) => out.push({ key: 'journal:' + j.id, date: j.date, folderId: firstDriveFolderId(j.proofs) || undefined, kind: 'journal', id: j.id, type: 'Payment voucher', title: `Manual journal ${j.id}: ${j.details}`, sub: `${j.account} · ${j.direction} · ${j.reason || 'adjustment'}${sigLine(j.signatories)}`, amount: Number(j.amount || 0), by: j.preparedBy, clientAccount: j.account === 'Client account', signatories: j.signatories || [] }));
    invoices.filter((i) => i.writeOffRequest?.status === 'Pending').forEach((i) => out.push({ key: 'writeoff:' + i.id, date: i.writeOffRequest?.requestedAt || i.date, kind: 'writeoff', id: i.id, type: 'Write-off', title: `${i.partyName || clientName(i.clientId) || i.id} unpaid balance`, sub: `${i.id} · ${ageDays(i)} days old · ${i.writeOffRequest!.reason || ''}`, amount: Number(i.writeOffRequest!.amount || 0), by: i.writeOffRequest!.requestedBy, clientAccount: false, signatories: [] }));
    out.forEach((it) => { const f = formTotalOf(it); if (f.formNo && Math.abs(f.total - it.amount) > 0.004) it.sub += ` · form ${f.formNo} total ${rm2(f.total)}`; });
    if (referral.total > 0 && !refDecision) out.push({ key: 'referral:' + period, kind: 'referral', id: period, type: 'Referral fees', title: `${monthName} referral fees (${referral.rows.length} referrer${referral.rows.length === 1 ? '' : 's'})`, sub: 'see breakdown below', amount: referral.total, by: 'System', clientAccount: false, signatories: [] });
    return out;
  }, [travelClaims, expenses, paymentVouchers, manualJournals, invoices, referral, refDecision, lk]);
  const pendingAp = apItems.length;

  /** "Who approves" item for a record waiting in Approvals. */
  const apId = (item: Pick<ApItem, 'kind' | 'clientAccount'>): FinApprovalId => (item.kind === 'travel' || item.kind === 'expense' ? 'claims' : item.kind === 'writeoff' ? 'writeOff' : item.kind === 'referral' ? 'referral' : item.clientAccount ? 'clientPay' : 'officePay');
  /** Rule for an approval: Firm Settings → Who approves when set, else the finance defaults. */
  const ruleFor = (id: FinApprovalId) => finRule(id, users, settings.approvers);
  const myCode = currentUser ? approverCode(currentUser) : '';
  /** Settings-held sign-offs (payroll, fee sharing, reconciliation, statements…). */
  const signoffs = (key: string) => (settings.financeSignoffs || {})[key] || {};
  const signOff = (id: FinApprovalId, key: string, onDone?: () => void) => {
    const r = ruleFor(id);
    if (!r.canSign(currentUser)) { toastMsg('This ' + r.rule + '.'); return false; }
    const cur = { ...signoffs(id + ':' + key) };
    if (cur[myCode]) delete cur[myCode]; else cur[myCode] = { by: me, at: new Date().toISOString() };
    saveSettings({ financeSignoffs: { ...(settings.financeSignoffs || {}), [id + ':' + key]: cur } });
    const done = r.done(cur);
    toastMsg(!cur[myCode] ? 'Your approval was removed' : done ? 'Approved by ' + Object.keys(cur).join(' & ') : 'Approved by you · waiting for ' + (r.need - r.count(cur)) + ' more');
    if (done && cur[myCode] && onDone) onDone();
    return done;
  };
  /** The approval rule shown under an item ("needs approval from …"). */
  const apRule = (item: ApItem) => {
    const r = ruleFor(apId(item));
    if (r.configured) return r.rule;
    if (item.kind === 'writeoff' || item.kind === 'referral') return r.rule;
    return needsTwoSignatories(formTotalOf(item).total, twoSignatoryThreshold(), item.clientAccount) ? 'needs the Super Admin + 1 more signatory' : 'any partner can approve';
  };
  /** Can the signed-in person sign this item now? */
  const canSignItem = (item: ApItem) => { const r = ruleFor(apId(item)); return r.configured ? r.canSign(currentUser) : item.kind === 'writeoff' || item.kind === 'referral' ? isMP : canApprove; };
  const approve = (item: ApItem, ok: boolean) => {
    const rule = ruleFor(apId(item));
    if (rule.configured ? !rule.canSign(currentUser) : !canApprove) { toastMsg(rule.configured ? 'This ' + rule.rule + ' (Firm & Practice Settings › Who approves).' : 'Only partners approve. Accounts prepare.'); return; }
    const at = new Date().toISOString();
    if (!ok) {
      if (item.kind === 'travel') app.updateTravelClaim(item.id, { approvalStatus: 'Rejected', approvedBy: me, approvedAt: at });
      else if (item.kind === 'expense') app.updateExpense(item.id, { approvalStatus: 'Rejected', approvedBy: me, approvedAt: at });
      else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { approvalStatus: 'Rejected', approved: false, rejectedBy: me });
      else if (item.kind === 'journal') app.updateManualJournal(item.id, { status: 'Rejected', decidedBy: me, decidedAt: at });
      else if (item.kind === 'writeoff') { const inv = invoices.find((i) => i.id === item.id); if (inv?.writeOffRequest) app.updateInvoice(inv.id, { writeOffRequest: { ...inv.writeOffRequest, status: 'Rejected', decidedBy: me, decidedAt: at } }); }
      else if (item.kind === 'referral') saveSettings({ referralFeeApprovals: { ...(settings.referralFeeApprovals || {}), [period]: { status: 'Rejected', by: me, at, total: item.amount } } });
      setDecided((d) => ({ ...d, [item.key]: { d: 'no', item } }));
      if (item.kind !== 'referral' && item.by && item.by !== 'System') app.addNotification({ title: 'Rejected: ' + item.title, message: me + ' rejected ' + item.title + ' (' + rm2(item.amount) + ').', type: 'invoice', linkTab: 'reimbursements', linkId: item.id, to: [item.by] });
      toastMsg(item.title + ' rejected');
      return;
    }
    // Write-offs stay admin-level even when listed in Who approves.
    if (item.kind === 'writeoff' && !(isMP || (rule.configured && isAdmin))) { toastMsg('Write-offs need an admin partner.'); return; }
    if (!rule.configured && item.kind === 'referral' && !isMP) { toastMsg('Referral fees are approved by an admin.'); return; }
    if (item.signatories.some((s) => (s.userId ? s.userId === currentUser?.id : norm(s.name) === norm(me)))) { toastMsg('You have already signed this. It needs another signatory.'); return; }
    const sigs = [...item.signatories, { name: me, at, isManagingPartner: isMP, ...(currentUser?.id ? { userId: currentUser.id } : {}) }];
    let complete: boolean;
    if (rule.configured) {
      const step = configuredSign(rule, { id: currentUser?.id || '', name: me }, item.signatories);
      if ('msg' in step) { toastMsg(step.msg); return; }
      complete = step.complete;
    } else {
      // Threshold from Firm & Practice Settings → Permissions & limits (default RM 5,000).
      // Per claim / PV FORM (sum of its items), Super Admin + 1 at the threshold and above.
      const needTwo = needsTwoSignatories(formTotalOf(item).total, twoSignatoryThreshold(), item.clientAccount);
      complete = item.kind === 'writeoff' || item.kind === 'referral' ? isMP : needTwo ? sigs.length >= 2 && sigs.some((s) => s.isManagingPartner) : true;
    }
    // Client-account payments: the ledger can never go below zero.
    if (item.kind === 'pv' && item.clientAccount) {
      const v = paymentVouchers.find((x) => x.id === item.id);
      if (v && clientLedgerBalance(v.clientId, v.caseId || '') < Number(v.amount || 0) - 0.005) { toastMsg('Not enough in this matter’s client ledger: the client account can never go below zero.'); return; }
      const tInv = v?.voucherCategory === 'Legal Fees Transfer' && v.invoiceId ? invoices.find((i) => i.id === v.invoiceId) : undefined;
      if (tInv && Number(v!.amount || 0) > invBal(tInv) + 0.01) { toastMsg(`${tInv.id} balance is now ${rm2(invBal(tInv))}: the transfer would overpay it. Reject and prepare a new transfer.`); return; }
    }
    if (item.kind === 'journal') {
      const j = manualJournals.find((x) => x.id === item.id);
      if (j && j.account === 'Client account') {
        if (!j.clientId) { toastMsg('Client-account journals must name the client ledger (client + matter). Reject this one and prepare it again.'); return; }
        if (j.direction === 'Money out' && clientLedgerBalance(j.clientId, j.caseId || '') < Number(j.amount || 0) - 0.005) { toastMsg('Not enough in this client ledger: the client account can never go below zero.'); return; }
      }
    }
    if (!complete) {
      if (item.kind === 'travel') app.updateTravelClaim(item.id, { signatories: sigs });
      else if (item.kind === 'expense') app.updateExpense(item.id, { signatories: sigs });
      else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { signatories: sigs });
      else if (item.kind === 'journal') app.updateManualJournal(item.id, { signatories: sigs });
      toastMsg(rule.configured ? 'Signed · ' + rule.rule : 'Signed · needs the Super Admin + 1 more signatory');
      return;
    }
    if (item.kind === 'travel') app.updateTravelClaim(item.id, { approvalStatus: 'Approved', approvedBy: me, approvedAt: at, signatories: sigs });
    else if (item.kind === 'expense') app.updateExpense(item.id, { approvalStatus: 'Approved', approvedBy: me, approvedAt: at, signatories: sigs });
    else if (item.kind === 'pv') app.updatePaymentVoucher(item.id, { approvalStatus: 'Approved', approved: true, approvedBy: sigs.map((s) => s.name).join(' + '), signatories: sigs });
    else if (item.kind === 'journal') {
      const j = manualJournals.find((x) => x.id === item.id);
      app.updateManualJournal(item.id, { status: 'Approved', decidedBy: me, decidedAt: at, signatories: sigs });
      if (j && j.account === 'Client account') {
        // Client money always moves with its client ledger: 1020 (bank) and 2010 (owed to
        // clients) move together, so ledgers = cash book = bank stays possible.
        const kase = findCase(lk, j.caseId);
        app.addRetainer({ id: 'RET-' + j.id, clientId: j.clientId || '', caseId: j.caseId || '', type: j.direction === 'Money in' ? 'Deposit' : 'Apply', amount: Number(j.amount || 0), date: j.date, remarks: `Manual journal: ${j.details}${j.reason ? ' · ' + j.reason : ''}`, voucherNo: j.id });
        postGL([{ date: j.date, docType: 'JV', docNo: j.id, accountSet: 'CLIENT', debit: j.direction === 'Money in' ? GLA.clientBank : GLA.clientFunds, credit: j.direction === 'Money in' ? GLA.clientFunds : GLA.clientBank, amount: j.amount, clientId: j.clientId || '', fileRef: kase?.ref || '', description: `Manual journal: ${j.details} · ${j.reason}` }]);
      } else if (j) postGL([{ date: j.date, docType: 'JV', docNo: j.id, accountSet: 'OFFICE', debit: j.direction === 'Money in' ? cashAccountGL(j.account) : GLA.suspense, credit: j.direction === 'Money in' ? GLA.suspense : cashAccountGL(j.account), amount: j.amount, clientId: '', fileRef: '', description: `Manual journal: ${j.details} · ${j.reason}` }]);
    } else if (item.kind === 'writeoff') {
      const inv = invoices.find((i) => i.id === item.id);
      if (inv?.writeOffRequest) {
        const amt = Math.min(Number(inv.writeOffRequest.amount || 0), invBal(inv));
        app.updateInvoice(inv.id, { writtenOff: Number(inv.writtenOff || 0) + amt, writeOffRequest: { ...inv.writeOffRequest, status: 'Approved', decidedBy: me, decidedAt: at } });
        postGL([{ date: isoOf(Date.now()), docType: 'JV', docNo: inv.id, accountSet: 'OFFICE', debit: GLA.other, credit: GLA.ar, amount: amt, clientId: inv.clientId, fileRef: inv.fileRef || '', description: `Bad debt written off: ${inv.id}` }]);
      }
    } else if (item.kind === 'referral') saveSettings({ referralFeeApprovals: { ...(settings.referralFeeApprovals || {}), [period]: { status: 'Approved', by: me, at, total: item.amount } } });
    setDecided((d) => ({ ...d, [item.key]: { d: 'ok', item } }));
    toastMsg(item.title + ' approved');
    if (item.kind !== 'referral' && item.by && item.by !== 'System') app.addNotification({ title: 'Approved: ' + item.title, message: sigs.map((s) => s.name).join(' + ') + ' approved ' + item.title + ' (' + rm2(item.amount) + '). Accounts will arrange payment.', type: 'invoice', linkTab: 'reimbursements', linkId: item.id, to: [item.by, 'role:Accountant'] });
  };

  /* ------------------------------ approved · to pay ------------------------------ */
  const pvMethod = (v: PaymentVoucher): PayItem['method'] => (/portal|e-?filing|stamps|e-?tanah|fpx|online/i.test(v.paymentMethod || '') ? 'Online portal' : /cheque/i.test(v.paymentMethod || '') ? 'Cheque' : 'Bank transfer');
  const toPay: PayItem[] = useMemo(() => {
    const out: PayItem[] = [];
    travelClaims.filter((t) => t.approvalStatus === 'Approved' && !t.paidAt).forEach((t) => out.push({ key: 'travel:' + t.id, date: t.date, folderId: firstDriveFolderId(t.attachments, t.paidProof ? [t.paidProof] : []) || undefined, kind: 'travel', id: t.id, no: t.id, payee: `${t.claimant} (claim)`, what: `${t.purpose || t.type}${t.fileRef ? ' · ' + t.fileRef : ''}`, method: 'To staff bank', details: 'Staff bank details from their profile (not stored in the app)', from: 'Office', amount: Number(t.total || 0) }));
    expenses.filter((e) => e.approvalStatus === 'Approved' && !!e.claimant && !e.paidAt).forEach((e) => out.push({ key: 'expense:' + e.id, date: e.date, folderId: firstDriveFolderId(e.attachments, e.paidProof ? [e.paidProof] : []) || undefined, kind: 'expense', id: e.id, no: e.id, payee: `${e.claimant} (claim)`, what: `${e.description || e.category}${e.fileRef ? ' · ' + e.fileRef : ''}`, method: 'To staff bank', details: 'Staff bank details from their profile (not stored in the app)', from: 'Office', amount: Number(e.amount || 0) }));
    paymentVouchers.filter((v) => v.approvalStatus === 'Approved' && !v.paidAt && !v.historical).forEach((v) => out.push({ key: 'pv:' + v.id, date: v.date, folderId: firstDriveFolderId(v.attachments, v.proofs, v.paidProof ? [v.paidProof] : []) || undefined, kind: 'pv', id: v.id, no: v.id, payee: v.voucherCategory === 'Legal Fees Transfer' ? 'Office account (transfer)' : v.payee || '—', what: `${v.description}${v.fileRef ? ' · ' + v.fileRef : ''}`, method: v.voucherCategory === 'Legal Fees Transfer' ? 'Bank transfer' : pvMethod(v), details: v.voucherCategory === 'Legal Fees Transfer' ? `Client A/C ${SD.BANK['Client account'][2]} → Office A/C ${SD.BANK.Office[2]}` : v.bankRef || v.paymentMethod || '—', from: pvIsClient(v) ? 'Client account' : v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? 'Disbursement' : 'Office', amount: Number(v.amount || 0) }));
    return out;
  }, [travelClaims, expenses, paymentVouchers]);

  /** A billable expense is a disbursement (recoverable, 1200) unless its category is one of our own
   * re-charged costs (photocopy, courier, mileage…: a reimbursement, i.e. an expense billed as income). */
  const expenseIsDisb = (e?: Expense) => !!e?.billable && !isReimbursementCategory(e.category, e.description);
  const expenseDebitGL = (e?: Expense) => (expenseIsDisb(e) ? GLA.unbilledDisb : expenseGL(e?.category || ''));
  /** Approvals: change the amount or details of a claim / voucher that is not paid yet. A new
   * amount goes back for approval. */
  const editApItem = (kind: 'travel' | 'expense' | 'pv', id: string) => {
    const rec = kind === 'travel' ? travelClaims.find((x) => x.id === id) : kind === 'expense' ? expenses.find((x) => x.id === id) : paymentVouchers.find((x) => x.id === id);
    if (!rec) return;
    const amt0 = kind === 'travel' ? Number((rec as TravelClaim).total || 0) : Number((rec as Expense).amount || 0);
    const what0 = kind === 'travel' ? (rec as TravelClaim).purpose : (rec as Expense).description;
    void askForm('Edit ' + id, [{ key: 'what', label: 'Details', value: what0 || '', required: true }, { key: 'amt', label: 'Amount (RM)', type: 'number', value: String(amt0), required: true }], { note: 'A new amount goes back for approval.' }).then((v) => { if (v) applyApEdit(kind, id, v.what, num0(v.amt), amt0); });
  };
  const applyApEdit = (kind: 'travel' | 'expense' | 'pv', id: string, what: string, amt: number, amt0: number) => { if (!(amt > 0)) { toastMsg('Enter an amount above 0'); return; }
    const again = Math.abs(amt - amt0) > 0.004 ? { approvalStatus: 'Pending Approval' as const } : {};
    if (kind === 'travel') app.updateTravelClaim(id, { purpose: what.trim(), total: amt, ...again });
    else if (kind === 'expense') app.updateExpense(id, { description: what.trim(), amount: amt, ...again });
    else app.updatePaymentVoucher(id, { description: what.trim(), amount: amt, ...(again.approvalStatus ? { ...again, approved: false } : {}) });
    toastMsg(again.approvalStatus ? 'Saved · the new amount goes back for approval' : 'Saved');
  };
  const deleteApItem = (kind: 'travel' | 'expense' | 'pv', id: string, no: string) => {
    if (!isAdminUser) { toastMsg('Only an admin can delete.'); return; }
    if (!window.confirm('Delete ' + no + '? It is not paid yet, so nothing is posted. Vouchers stay in the Recycle Bin.')) return;
    app.withdrawClaimRecord(kind, id, true);
  };

  const markPaid = (item: PayItem, file?: File | null, on?: string) => {
    if (!file) return;
    if (!canPrepare) { toastMsg('Payments are made and recorded by Accounts.'); return; }
    if (proofUploadBlocked()) { toastMsg(DRIVE_REQUIRED_MSG); return; }
    if (!on) { void pickDate('Date paid · ' + item.no, { note: 'The date on the bank slip or transfer.' }).then((d) => { if (d) markPaid(item, file, d); }); return; }
    const at = new Date().toISOString(), date = on;
    const [proof] = filesToProofs(item.kind + ':' + item.id, [file]);
    if (item.kind === 'travel') { const t = travelClaims.find((x) => x.id === item.id); app.updateTravelClaim(item.id, { paidAt: at, paidProof: proof }); postGL([{ date, docType: 'PV', docNo: item.id, accountSet: 'OFFICE', debit: travelClaimGL(t?.type), credit: GLA.office, amount: item.amount, clientId: '', fileRef: t?.fileRef || '', description: `Staff claim paid: ${t?.claimant || ''} ${item.id}` }]); }
    else if (item.kind === 'expense') { const e = expenses.find((x) => x.id === item.id); app.updateExpense(item.id, { paidAt: at, paidProof: proof }); postGL([{ date, docType: 'PV', docNo: item.id, accountSet: 'OFFICE', debit: expenseDebitGL(e), credit: GLA.office, amount: item.amount, clientId: '', fileRef: e?.fileRef || '', description: `Staff claim paid: ${e?.claimant || ''} ${item.id}` }]); }
    else {
      const v = paymentVouchers.find((x) => x.id === item.id);
      if (!v) return;
      if (pvIsClient(v)) {
        if (clientLedgerBalance(v.clientId, v.caseId || '') < Number(v.amount || 0) - 0.005) { toastMsg('Not enough in this matter’s client ledger: the client account can never go below zero.'); return; }
        // Re-check at payment time: the invoice may have been paid since the transfer was prepared.
        const tInv = v.voucherCategory === 'Legal Fees Transfer' && v.invoiceId ? invoices.find((i) => i.id === v.invoiceId) : undefined;
        if (tInv && Number(v.amount || 0) > invBal(tInv) + 0.01) { toastMsg(`${tInv.id} balance is now ${rm2(invBal(tInv))}: this transfer would overpay it. Not paid.`); return; }
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
      } else postGL([{ date, docType: 'PV', docNo: v.id, accountSet: 'OFFICE', debit: pvDebitGL(v.voucherCategory), credit: v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb' ? GLA.disb : GLA.office, amount: v.amount, clientId: v.clientId || '', fileRef: v.fileRef || '', description: `${v.payee || ''} ${v.description}`.trim() }]);
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
  const payNext = (paidOn?: string) => {
    if (!periodSlips.length) { toastMsg('No payslips for ' + monthName + ' yet. Click a staff row to key in their payslip.'); return; }
    if (payStep >= 3) return;
    if (payStep === 0 && !canPrepare) { toastMsg('Payroll is checked by Accounts or the Super Admin.'); return; }
    if (payStep === 1) {
      // Payroll approval follows Who approves (default: Super Admin); several approvers sign in turn.
      const r = ruleFor('payroll');
      if (!r.canSign(currentUser)) { toastMsg('Payroll ' + r.rule + '.'); return; }
      if (r.need > 1) { const cur = signoffs('payroll:' + period); if (cur[myCode]) { toastMsg('You have already approved. Waiting for ' + (r.need - r.count(cur)) + ' more.'); return; } if (!signOff('payroll', period)) return; }
    }
    if (payStep === 2 && !canPrepare) { toastMsg('Not available for your role.'); return; }
    if (payStep === 2 && !paidOn) { void pickDate('Date salaries were paid · ' + monthName, { note: 'The day the money left the office account.' }).then((d) => { if (d) payNext(d); }); return; }
    if (payStep === 0 && staff.some((u) => !slipOf(u.id))) { toastMsg('Every staff member needs a payslip before payroll is checked.'); return; }
    const ids = periodSlips.filter((p) => PAY_STEPS.indexOf(p.status) === payStep).map((p) => p.id);
    app.advancePayslipStatus(ids);
    if (payStep === 2) {
      const tot = periodSlips.reduce((a, p) => { const c = slipCalc(p)!; return { net: a.net + c.net, stat: a.stat + c.ded + c.er }; }, { net: 0, stat: 0 });
      postGL([
        { date: paidOn || todayIso(), docType: 'PV', docNo: 'PAYROLL-' + period, accountSet: 'OFFICE', debit: GLA.salaries, credit: GLA.office, amount: tot.net, clientId: '', fileRef: '', description: `${monthName} ${now.getFullYear()} payroll · net pay` },
        { date: paidOn || todayIso(), docType: 'JV', docNo: 'PAYROLL-' + period, accountSet: 'OFFICE', debit: GLA.salaries, credit: GLA.statutory, amount: tot.stat, clientId: '', fileRef: '', description: `${monthName} ${now.getFullYear()} payroll · EPF/SOCSO/EIS/PCB/zakat due` },
      ]);
    }
    toastMsg(['Payroll checked', 'Payroll approved', 'Payroll marked paid · payslips show in Staff Portal'][payStep]);
  };
  /** Save one Draft payslip from inline edits (design: Staff payslips grid). EPF / SOCSO / EIS are
   * recalculated from the official tables unless the payslip carries an override. */
  const saveSlipPatch = (userId: string, patch: Partial<Pick<Payslip, 'basic' | 'referralFee' | 'profitShare' | 'bonus' | 'pcb' | 'zakat'>> & { allow?: number; oth?: number; profitShareNote?: string; referralNote?: string; bonusNote?: string }, per = period) => {
    const u = staffUser(userId); if (!u) return false;
    const existing = payslips.find((p) => p.userId === userId && p.period === per);
    if (existing && existing.status !== 'Draft') { toastMsg('Only Draft payslips can be changed.'); return false; }
    const hr = u.staffProfile?.pay;
    const base = existing || { basic: Number(hr?.basicSalary || 0), allowances: (hr?.allowances || []).map((a) => ({ name: a.name || 'Allowances', amount: Number(a.amount || 0) })), referralFee: 0, profitShare: 0, bonus: 0, pcb: 0, zakat: 0, otherDeductions: [] as { name: string; amount: number }[] } as Partial<Payslip>;
    const allowTotal = patch.allow != null ? patch.allow : (base.allowances || []).reduce((s2, a) => s2 + Number(a.amount || 0), 0);
    const next = { basic: patch.basic ?? Number(base.basic || 0), referralFee: patch.referralFee ?? Number(base.referralFee || 0), profitShare: patch.profitShare ?? Number(base.profitShare || 0), bonus: patch.bonus ?? Number(base.bonus || 0), pcb: patch.pcb ?? Number(base.pcb || 0), zakat: patch.zakat ?? Number(base.zakat || 0) };
    const sp = u.staffProfile;
    const st = statutoryForPayslip({ basic: next.basic, allowances: allowTotal, referralFee: next.referralFee, profitShare: next.profitShare, bonus: next.bonus }, { birthday: sp?.birthday, nric: sp?.nric, nationality: sp?.nationality }, per);
    const keepOverride = existing?.statutory && existing.statutory.auto === false;
    const p: Payslip = {
      ...(existing || {}), id: existing?.id || `PS-${per}-${u.id}`, userId: u.id, period: per, status: 'Draft', ...next,
      allowances: patch.allow != null ? (patch.allow ? [{ name: 'Allowances', amount: patch.allow }] : []) : base.allowances || [],
      otherDeductions: patch.oth != null ? (patch.oth ? [{ name: (base.otherDeductions || [])[0]?.name || 'Other deduction', amount: patch.oth }] : []) : base.otherDeductions || [],
      ...(patch.profitShareNote != null ? { profitShareNote: patch.profitShareNote } : {}), ...(patch.referralNote != null ? { referralNote: patch.referralNote } : {}), ...(patch.bonusNote != null ? { bonusNote: patch.bonusNote } : {}),
      ...(keepOverride || !st.ok ? { epfEmployee: Number(existing?.epfEmployee || 0), epfEmployer: Number(existing?.epfEmployer || 0), socsoEis: Number(existing?.socsoEis || 0), socsoEisEmployer: existing?.socsoEisEmployer, statutory: existing?.statutory || { auto: false, version: STATUTORY_VERSION } }
        : { epfEmployee: st.epfEmployee, epfEmployer: st.epfEmployer, socsoEis: st.socsoEisEmployee, socsoEisEmployer: st.socsoEisEmployer, statutory: { auto: true, version: STATUTORY_VERSION, socsoEmployee: st.socso.employee, eisEmployee: st.eis.employee, socsoEmployer: st.socso.employer, eisEmployer: st.eis.employer } }),
    } as Payslip;
    if (existing) app.updatePayslip(existing.id, p); else app.addPayslip(p);
    return true;
  };

  /* ------------------------------ fee sharing (Payroll › Fee sharing) ------------------------------ */
  const FS = settings.feeSharing || {};
  const fsPeople: FsPerson[] = users.filter((u) => u.status !== 'Inactive' && u.role !== 'Client' && u.role !== 'Reviewer').map((u) => {
    const o = (FS.people || {})[u.id] || {};
    const t0: PersonType = u.role === 'Partner' ? (u.isSuperAdmin ? 'Owner' : 'Partner') : u.role === 'Lawyer' ? 'Associate' : 'Staff';
    const t = (o.t as PersonType) || t0;
    const isP = isPartnerType(t);
    const okPay = isP ? ['Profit share only', 'Monthly salary + profit share', 'Monthly drawing + profit share'].includes(o.pay || '') : ['Salary + fee sharing', 'Salary only', 'Fee sharing only'].includes(o.pay || '');
    return { id: u.id, code: approverCode(u), name: u.name, t, pay: okPay ? o.pay! : isP ? 'Profit share only' : 'Salary + fee sharing', sal: o.sal != null ? Number(o.sal) : Number(u.staffProfile?.pay?.basicSalary || 0), ded: o.ded || {} };
  });
  const personFor = (s0?: string) => { const n = norm(s0); if (!n) return undefined; return fsPeople.find((p) => p.id === s0 || norm(p.name) === n || norm(p.code) === n); };
  const fsFilesFor = (per: string): FsFile[] => {
    const by = new Map<string, FsFile>();
    moneyReceived(invoices).filter((x) => inPeriod(x.date, per) && x.income > 0.004).forEach((x) => {
      const k = invCase(x.inv); const id = k?.id || x.inv.caseId || x.inv.fileRef || x.inv.id;
      let f = by.get(id);
      if (!f) {
        const o = ((FS.files || {})[per] || {})[id] || {};
        const handDefault = k ? [...new Set([personFor(k.lawyerInCharge)?.id, ...(k.partners || []).map((c) => fsPeople.find((p) => p.code === String(c).toUpperCase())?.id)].filter(Boolean) as string[])] : [];
        f = { id, ref: k?.ref || x.inv.fileRef || x.inv.id, client: x.inv.partyName || clientName(x.inv.clientId) || '—', matter: k?.title || x.inv.matter || '', amount: 0, intro: o.intro !== undefined ? o.intro : personFor(k?.referredBy)?.id || '', hands: o.hands && o.hands.length ? o.hands : handDefault, cu: o.cu, rules: o.rules };
        by.set(id, f);
      }
      f.amount = round2(f.amount + professionalFeesPart(x.income, invoiceComposition(x.inv)));
    });
    return [...by.values()].sort((a, b) => b.amount - a.amount);
  };
  const fsCostsFor = (per: string) => { const v = (FS.costs || {})[per]; return v != null ? Number(v) : round2(pnl((d) => inPeriod(d, per)).expensesTotal); };
  const feeShareFor = (per: string) => ({ people: fsPeople, ...computeFeeSharing(fsPeople, fsFilesFor(per), { ...DEFAULT_RULES, ...(FS.rules || {}) }, { psplit: FS.psplit, costs: fsCostsFor(per) }) });
  const fsApproved = (per: string) => ruleFor('feeShare').done(signoffs('feeShare:' + per));
  const saveFs = (patch: Partial<NonNullable<typeof settings.feeSharing>>) => { if (!canPrepare && !isMP) { toastMsg('Fee sharing is kept by Accounts and admins.'); return; } if (fsApproved(period)) { toastMsg('This month is approved and locked. Remove an approval to change it.'); return; } saveSettings({ feeSharing: { ...FS, ...patch } }); };
  const setFsFile = (per: string, id: string, p: Record<string, unknown>) => saveFs({ files: { ...(FS.files || {}), [per]: { ...((FS.files || {})[per] || {}), [id]: { ...(((FS.files || {})[per] || {})[id] || {}), ...p } } } });
  /** Approved fee sharing → commission on each staff member's Draft payslip for that month. */
  const applyFeeShareToSlips = (per: string) => {
    const r = feeShareFor(per); let n = 0;
    fsPeople.filter((p) => !isPartnerType(p.t) && p.pay !== 'Salary only').forEach((p) => {
      const t = r.tot[p.id]; if (!t || t.amt <= 0.004) return;
      const ok = saveSlipPatch(p.id, { profitShare: round2(t.amt), profitShareNote: t.files.length + (t.files.length === 1 ? ' file' : ' files') + ' · fees collected ' + MON[Number(per.slice(5)) - 1] }, per);
      if (ok) n++;
    });
    return n;
  };

  const refFeeFor = (u: User) => referral.rows.filter((r) => r.type === 'Staff' && norm(r.name) === norm(u.name)).reduce((s, r) => s + r.fee, 0);

  /* ------------------------------ cash book ------------------------------ */
  const attachTo = (kind: string, id: string) => (files: FileList | null) => {
    const owner = kind + ':' + id;
    if (files && files.length && proofUploadBlocked()) { toastMsg(DRIVE_REQUIRED_MSG); return; }
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
    const expAcc = (e: Expense): CashAcc | null => (e.billable && !e.claimant && (!e.paidFrom || /disb/i.test(e.paidFrom)) ? 'Disbursement' : /petty/i.test(e.paidFrom || '') ? 'Petty cash' : /disb/i.test(e.paidFrom || '') ? 'Disbursement' : e.claimant ? (e.paidAt ? 'Office' : null) : 'Office');
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
    // Journals only move the balance once approved (a pending one is listed with its amount in the text).
    manualJournals.filter((j) => j.account === acc && j.status !== 'Rejected').forEach((j) => { const ok = j.status === 'Approved'; R.push({ key: 'j:' + j.id, t: parseDate(j.date), who: 'Manual journal', what: `${j.details}${j.reason ? ' · ' + j.reason : ''}${ok ? '' : ` · ${j.direction.toLowerCase()} ${rm2(Number(j.amount || 0))} waiting for approval`}`, no: j.id, inn: ok && j.direction === 'Money in' ? j.amount : 0, out: ok && j.direction === 'Money out' ? j.amount : 0, src: 'Manual', proofs: j.proofs || [], owner: 'journal:' + j.id, attach: attachTo('journal', j.id) }); });
    // Entries on or before the opening-balance date are already inside the opening balance.
    return R.filter((r) => !openingAsAt || r.t > openingAsAt).sort((a, b) => a.t - b.t);
  };
  /** Opening balance from Firm & Practice Settings → Banks (per bank account, by account type);
   * falls back to the legacy bank-account record value when Firm Settings has none. */
  const openingBalance = (acc: CashAcc) => {
    const ob = settings.bankOpeningBalances || {};
    const firm = firmBanksOf(acc).filter((b) => ob[b.id] != null);
    if (firm.length) return round2(firm.reduce((s2, b) => s2 + Number(ob[b.id] || 0), 0));
    return banksOf(acc).reduce((s2, b) => s2 + Number(b.openingBalance || 0), 0);
  };
  const officeCash = bankBal('Office');

  /* ------------------------------ 3-way reconciliation (client account) ------------------------------ */
  /** Client bank statement closing balance for a month: keyed in on the Client Account tab
   * (Firm Settings sync), else a legacy reconciliation row. */
  const statementFor = (m: Date): number | null => {
    const st = (settings.clientBankStatements || {})[periodKey(m)];
    if (st) return Number(st.balance);
    const row = threeWayRec.find((r) => String(r.month).toLowerCase().startsWith(MON[m.getMonth()].toLowerCase()) && String(r.month).includes(String(m.getFullYear())));
    return row ? Number(row.bankStatement || 0) : null;
  };
  const setStatement = (m: Date, value: string) => {
    if (!canPrepare) { toastMsg('Bank statement balances are keyed in by Accounts.'); return; }
    const key = periodKey(m); const cur = { ...(settings.clientBankStatements || {}) };
    if (!String(value).trim()) delete cur[key]; else cur[key] = { balance: round2(num0(value)), by: me, at: new Date().toISOString() };
    saveSettings({ clientBankStatements: cur });
    toastMsg(String(value).trim() ? `${MONTHS[m.getMonth()]} statement balance saved` : 'Statement balance cleared');
  };
  /** Ledgers total vs cash book vs bank statement at month end, compared to the sen. */
  const reconFor = (m: Date) => {
    const end = monthEnd(m);
    const ledgers = round2(ledgerTotalAt(end));
    const cash = round2(openingBalance('Client account') + cashBook('Client account').filter((r) => r.t && r.t <= end.getTime()).reduce((s2, r) => s2 + r.inn - r.out, 0));
    const bank = statementFor(m);
    const status = bank == null ? 'Not started' : ledgers === cash && cash === round2(bank) ? 'Balanced' : 'Difference';
    return { ledgers, cash, bank, status };
  };

  /* ------------------------------ document actions ------------------------------ */
  const clientByName = (name: string) => lk.clientByName.get(norm(name));
  const caseForRef = (ref: string) => lk.caseByRef.get(ref.trim()) || lk.caseById.get(ref.trim());
  /** A client's e-mail and phone: from the client record, else from their lead (already registered there). */
  const contactFor = (clientId?: string, name?: string, leadId?: string) => {
    const nmx = (x?: string) => String(x || '').trim().toLowerCase();
    const c = (clientId && lk.clientById.get(clientId)) || clientByName(name || '');
    const lead = (app.leads || []).find((l) => (!!leadId && l.id === leadId) || (!!c && l.clientId === c.id) || (!!name && nmx(l.name) === nmx(name)) || (!!c && nmx(l.name) === nmx(c.name)));
    return { c, email: (c?.email || '').trim() || (lead?.email || '').trim(), phone: (c?.phone || '').trim() || (lead?.phone || '').trim() };
  };

  /** Actions that used to stamp today ask for the date first (past entries can be keyed in). */
  const DATED_ACTS = ['Issue', 'Make proforma'];
  const act = (kind: DocKind, rec: Quotation | Invoice | Receipt, a: string, on?: string) => {
    if (!on && (DATED_ACTS.includes(a) || a.startsWith('Issue proforma'))) {
      void pickDate(a === 'Issue' ? 'Issue date for ' + rec.id : 'Proforma date', { note: 'Today, or the date on the paper document.' }).then((d) => { if (d) act(kind, rec, a, d); });
      return;
    }
    const onDate = on || todayIso();
    const docNo = rec.id;
    if (a === 'View' && kind === 'quotation' && (rec as Quotation).historical) {
      const pf = (rec as Quotation).pastFile;
      if (pf?.webViewLink || pf?.driveFileId) { window.open(pf.webViewLink || 'https://drive.google.com/file/d/' + pf.driveFileId + '/view', '_blank', 'noopener'); return; }
      // No PDF yet: pick it now; it is saved to the file's folder and opens from then on.
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,image/*';
      inp.onchange = () => { const fl = inp.files?.[0]; if (fl) attachPastFile('quotation', rec as Quotation, fl); };
      toastMsg(rec.id + ' has no PDF yet · choose it now'); inp.click(); return;
    }
    if (a === 'View') { if (kind === 'quotation') { const p = quotations.find((x) => x.documentType === 'Proforma' && x.sourceQuotationId === rec.id); setView({ kind: 'quotation', id: p ? p.id : rec.id }); } else setView({ kind, id: rec.id }); return; }
    if (rk === 'R') { toastMsg('Read-only access.'); return; }
    if (a === 'Send' || a === 'Resend') {
      // Opens the e-mail / WhatsApp window with the message ready; marked Sent once it goes.
      const q = rec as Quotation; const c = clientByName(q.clientName); const lead = (app.leads || []).find((l) => l.id === q.leadId || l.name === q.clientName);
      const who = c?.contactPerson || c?.name || q.clientName || 'Sir/Madam'; const what = q.documentType === 'Proforma' ? 'proforma invoice' : 'quotation';
      const ct = contactFor(q.partyId, q.clientName, q.leadId || lead?.id); const email = ct.email; const phone = ct.phone;
      setRem({ kind, id: q.id, send: true, to: email, subj: (q.documentType === 'Proforma' ? 'Proforma invoice ' : 'Quotation ') + docNo + (q.matter ? ' · ' + q.matter : ''), body: `Dear ${who},\n\nThank you for your enquiry. Please find attached our ${what} ${docNo}${q.matter ? ' for ' + q.matter : ''} amounting to ${rm2(Number(q.total || 0))}.\n\nDo let us know if you have any questions, or reply to confirm and we will proceed.\n\nYours faithfully,\n${SD.FIRM.name}`, attach: true, viaE: true, viaW: !!phone && !email, phone, wa: `Salam / Hi ${who}, ${SD.FIRM.name} here. Our ${what} ${docNo} (${rm2(Number(q.total || 0))}) has been e-mailed to you. Please let us know if you have any questions. Thank you.` });
      return;
    }
    if (a === 'Mark accepted') { app.updateQuotation(rec.id, { status: 'Accepted' }); toastMsg(docNo + ' accepted'); return; }
    if (a === 'Remind') {
      // Design: a reminder window (email and / or WhatsApp) with the message ready to edit.
      const inv = kind === 'invoice' ? (rec as Invoice) : undefined;
      const ct = inv ? contactFor(inv.clientId, inv.partyName) : contactFor((rec as Quotation).partyId, (rec as Quotation).clientName, (rec as Quotation).leadId);
      const c = ct.c;
      const bal = inv ? invBal(inv) : Number((rec as Quotation).total || 0) - proformaPaid(rec as Quotation);
      const n = (inv?.reminders || []).length; const amt = rm2(bal); const days = inv ? ageDays(inv) : 0;
      const who = c?.contactPerson || c?.name || (inv ? inv.partyName : (rec as Quotation).clientName) || 'Sir/Madam';
      const bank = `${SD.BANK.Office[0]} · ${SD.BANK.Office[1]} · ${SD.BANK.Office[2]}`;
      setRem({ kind, id: rec.id, to: ct.email, subj: (n ? 'Second reminder' : 'Payment reminder') + ': ' + docNo + ' · ' + amt + ' outstanding', body: `Dear ${who},\n\nRe: ${(inv?.matter || (rec as Quotation).matter || '')}\n\nOur records show that ${docNo} dated ${fd(rec.date)} has an outstanding balance of ${amt}${inv ? ', now ' + days + ' days past due' : ''}.\n\nWe would be grateful if payment could be made to our office account:\n${bank}\nPlease quote ${docNo} as the payment reference.\n\nIf payment has already been made, kindly send us the bank-in slip and disregard this reminder.\n\nThank you.\n\nYours faithfully,\n${SD.FIRM.name}`, attach: true, viaE: !!ct.email || !ct.phone, viaW: !!ct.phone, phone: ct.phone, wa: `Salam / Hi ${who}, a reminder from ${SD.FIRM.name}: ${docNo} has ${amt} outstanding${inv ? ' (' + days + ' days overdue)' : ''}. Please pay to ${SD.BANK.Office[0]} ${SD.BANK.Office[2]} (${SD.BANK.Office[1]}) quoting ${docNo}. If already paid, kindly send us the bank-in slip. Thank you.` });
      return;
    }
    if (a === 'Record paid' && kind === 'invoice' && invStatus(rec as Invoice) === 'Draft') act(kind, rec, 'Issue', todayIso()); // paying a draft issues it today
    if (a === 'Record payment' || a === 'Record paid') { const bal = kind === 'invoice' ? invBal(rec as Invoice) : Number((rec as Quotation).total || 0) - proformaPaid(rec as Quotation); setForm({ kind: 'pay', vals: { docKind: kind, docId: rec.id, title: docNo, amount: String(Math.round(bal * 100) / 100), date: fd(Date.now()) } }); return; }
    if (a === 'View receipt') { const r = receipts.find((x) => x.invoiceId === rec.id || x.quotationId === rec.id || x.forNo === rec.id); if (r) setView({ kind: 'receipt', id: r.id }); else toastMsg('No receipt yet'); return; }
    if (a === 'Issue') {
      const inv = rec as Invoice; const terms = Number(settings.paymentTermDays) || 30; const date = onDate;
      // SST is decided on the ISSUE date (Firm Settings rate & SST start date), not the draft's.
      const items = inv.lineItems || [];
      const rate = SD.defaultSstRate();
      const t = items.length ? recordTotals(items, rate) : null;
      const total = t ? t.grandTotal : Number(inv.total || 0), tax = t ? t.sst : Number(inv.tax || 0);
      // Proforma money received for this quotation is applied now (refreshed: more may have come in).
      const dep = inv.quotationId ? depositFor(inv.quotationId, total, inv.id) : { amount: Number(inv.depositApplied || 0), ids: inv.depositReceiptIds || [] };
      const issued: Invoice = { ...inv, status: 'Unpaid', date, issuedAt: date, dueDate: isoOf((parseDate(date) || Date.now()) + terms * 86400000), ...(t ? { amount: round2(t.fees + t.disbursements + t.reimbursements), tax, total, sstRate: rate || undefined } : {}), depositApplied: dep.amount || undefined, depositReceiptIds: dep.ids.length ? dep.ids : undefined };
      app.updateInvoice(inv.id, { status: issued.status, date, issuedAt: date, dueDate: issued.dueDate, amount: issued.amount, tax: issued.tax, total: issued.total, sstRate: issued.sstRate, depositApplied: issued.depositApplied, depositReceiptIds: issued.depositReceiptIds });
      postGL(issueGL(issued, date));
      // Work on this invoice is billed only now (a draft leaves it in "Work not billed").
      const si = inv.sourceItems || {};
      (si.time || []).forEach((id) => app.updateTimeEntry(id, { billed: true, invoiceId: inv.id }));
      (si.expenses || []).forEach((id) => app.updateExpense(id, { billed: true }));
      (si.travel || []).forEach((id) => app.updateTravelClaim(id, { billed: 'Y', invoiceNo: inv.id }));
      const rateNote = t && Math.abs(rate - recordSstRate(inv)) > 0.0001 ? ` · SST ${Math.round(rate * 100)}% applied as at issue date` : '';
      toastMsg(`${inv.id} issued${dep.amount ? ' · deposit ' + rm2(dep.amount) + ' deducted' : ''}${rateNote} · e-Invoice (LHDN MyInvois) not connected yet`);
      return;
    }
    if (a === 'Void') {
      const inv = rec as Invoice;
      if (!(canPrepare || isMP)) { toastMsg('Invoices are voided by Accounts or the Super Admin.'); return; }
      if (invPaid(inv) > 0.005) { toastMsg(inv.id + ' has payments: refund or reallocate them before voiding.'); return; }
      void (async () => {
        const v = await askForm('Void ' + inv.id, [{ key: 'reason', label: 'Reason', required: true, placeholder: 'e.g. wrong client, replaced by INV-…' }, { key: 'date', label: 'Date of the void', type: 'date', value: todayIso(), required: true }], { note: 'It stays on file as Voided and its postings are reversed.', ok: 'Void invoice' });
        if (!v) return;
        const reason = v.reason, date = v.date;
        app.updateInvoice(inv.id, { status: 'Voided', voidReason: reason.trim(), voidedBy: me, voidedAt: new Date().toISOString() });
        postGL(reversalOf(inv.id, date, 'void'));
        // Its work goes back to "Work not billed"; any proforma deposit becomes available again.
        const si = inv.sourceItems || {};
        (si.time || []).forEach((id) => app.updateTimeEntry(id, { billed: false, invoiceId: undefined }));
        (si.expenses || []).forEach((id) => app.updateExpense(id, { billed: false }));
        (si.travel || []).forEach((id) => app.updateTravelClaim(id, { billed: 'N', invoiceNo: '' }));
        timeEntries.filter((te) => te.invoiceId === inv.id && !(si.time || []).includes(te.id)).forEach((te) => app.updateTimeEntry(te.id, { billed: false, invoiceId: undefined }));
        setView(null); toastMsg(inv.id + ' voided · postings reversed');
      })();
      return;
    }
    if (a.startsWith('Issue proforma: ') || a.startsWith('Issue proforma #')) {
      const q = rec as Quotation;
      const rows = planStatus(q);
      const row = a.startsWith('Issue proforma #') ? rows.find((r) => r.key === a.slice('Issue proforma #'.length)) : rows.find((r) => !r.proforma && r.label === a.slice('Issue proforma: '.length));
      if (!row) { toastMsg('That payment-plan row was not found.'); return; }
      if (row.proforma) { toastMsg(row.label + ' already has proforma ' + row.proforma.id + '.'); return; }
      if (!(row.amount > 0)) { toastMsg(row.label + ' has no amount: set its % or RM on the quotation first.'); return; }
      const what = (row.key.startsWith('stage:') ? `Stage ${Number(row.key.slice(6)) + 1}: ${row.label}${row.pct != null ? ' (' + row.pct + '% of ' + q.id + ')' : ' (' + q.id + ')'}` : `Instalment ${row.label} (${q.id})`) + (row.due ? ' · payable ' + row.due : '');
      // Disbursements are asked for separately (client account, SAR 1990): this row's share of the
      // quotation's disbursements goes on its own proforma, the rest (fees) on the office proforma.
      const qItems = q.lineItems || [];
      const disbAll = round2(qItems.filter((x) => x.category === 'Disbursement').reduce((a2, x) => a2 + Number(x.amount || 0), 0));
      const allAmt = round2(qItems.reduce((a2, x) => a2 + Number(x.amount || 0), 0));
      const dPart = allAmt > 0 && disbAll > 0 ? round2(row.amount * (disbAll / allAmt)) : 0;
      const fPart = round2(row.amount - dPart);
      const parts: [number, 'Office' | 'Client account', string][] = [...(fPart > 0.005 ? [[fPart, 'Office', what] as [number, 'Office' | 'Client account', string]] : []), ...(dPart > 0.005 ? [[dPart, 'Client account', 'Disbursements · ' + what] as [number, 'Office' | 'Client account', string]] : [])];
      const ids = seqIds('proforma', parts.length);
      // On the office proforma, reimbursements are shown on their own line (still firm income).
      const reimbAll = round2(qItems.filter((x) => x.category === 'Reimbursement').reduce((a2, x) => a2 + Number(x.amount || 0), 0));
      const rPart = allAmt > 0 && reimbAll > 0 ? Math.min(fPart, round2(row.amount * (reimbAll / allAmt))) : 0;
      const linesFor = (amt: number, into: string, desc: string): Quotation['lineItems'] => (into === 'Client account'
        ? [{ description: desc, category: 'Disbursement', amount: amt, quantity: 1, unitPrice: amt, chargeType: 'Fixed' }]
        : [{ description: desc, category: 'Fee - Fixed', amount: round2(amt - rPart), quantity: 1, unitPrice: round2(amt - rPart), chargeType: 'Fixed' }, ...(rPart > 0.005 ? [{ description: 'Reimbursements · ' + what, category: 'Reimbursement', amount: rPart, quantity: 1, unitPrice: rPart, chargeType: 'Fixed' }] : [])]) as Quotation['lineItems'];
      parts.forEach(([amt, into, desc], n) => app.addQuotation({ id: ids[n], documentType: 'Proforma', sourceQuotationId: q.id, planRowKey: row.key, planRowLabel: row.label, partyType: q.partyType || 'Client', partyId: q.partyId, date: onDate, practiceArea: q.practiceArea, fileRef: q.fileRef, leadId: q.leadId || '', clientName: q.clientName, status: 'Draft', total: amt, billedSoFar: 0, remaining: amt, courtLevel: '', stage: row.label, feeMethod: 'Template', subtype: q.subtype || '', approvalStatus: 'Pending', approvedBy: '', approvedDate: '', sstApplied: false, caseId: q.caseId, matter: q.matter, subject: q.subject, yourRef: q.yourRef, tin: q.tin, scope: q.scope || '', terms: [], payInto: into, language: q.language, lineItems: linesFor(amt, into, desc) }));
      setView({ kind: 'quotation', id: ids[0] }); setDocT('Proforma');
      toastMsg(ids.join(' + ') + ' created for ' + row.label + ' · ' + rm2(row.amount) + (parts.length > 1 ? ' (fees → office, disbursements → client account)' : ''));
      return;
    }
    if (a === 'Make proforma') {
      const q = rec as Quotation; const t = recordTotals(q.lineItems || [], recordSstRate(q));
      const made: Quotation[] = [];
      const want = [t.fees > 0, t.disbursements > 0].filter(Boolean).length;
      const ids = seqIds('proforma', Math.max(1, want));
      const base = { documentType: 'Proforma' as const, sourceQuotationId: q.id, partyType: q.partyType || 'Client' as const, partyId: q.partyId, date: onDate, practiceArea: q.practiceArea, fileRef: q.fileRef, leadId: q.leadId || '', clientName: q.clientName, status: 'Draft' as const, billedSoFar: 0, courtLevel: '', stage: '', feeMethod: 'Template' as const, subtype: q.subtype || '', approvalStatus: 'Pending' as const, approvedBy: '', approvedDate: '', sstApplied: false, caseId: q.caseId, matter: q.matter, subject: q.subject, yourRef: q.yourRef, tin: q.tin, scope: q.scope || '', terms: [] };
      // The office proforma copies the quotation's fee lines in full (no automatic percentage); change it with Edit before sending.
      if (t.fees > 0) { const items = (q.lineItems || []).filter((i) => i.category !== 'Disbursement'); const amt = round2(items.reduce((a2, i) => a2 + Number(i.amount || 0), 0)); made.push({ ...base, id: ids[made.length], total: amt, remaining: amt, payInto: 'Office', lineItems: items }); }
      if (t.disbursements > 0) { const items = (q.lineItems || []).filter((i) => i.category === 'Disbursement'); made.push({ ...base, id: ids[made.length], total: t.disbursements, remaining: t.disbursements, payInto: 'Client account', lineItems: items }); }
      if (!made.length) { toastMsg('Nothing to ask for: the quotation has no fees or disbursements.'); return; }
      made.forEach((p) => app.addQuotation(p));
      setView({ kind: 'quotation', id: made[0].id }); setDocT('Proforma');
      toastMsg(made.map((x) => x.id).join(' + ') + ' created' + (made.length > 1 ? ' (fees → office, disbursements → client account)' : ''));
      return;
    }
    if (a === 'Convert to invoice') {
      // We bill by stage / month. From a PROFORMA the invoice bills that proforma's lines (as edited)
      // and deducts what was paid on it. From a QUOTATION (no stage billing) it bills the whole quotation.
      const src = rec as Quotation; const isPf = src.documentType === 'Proforma'; const rootId = rootQuoteId(src);
      const done = isPf ? invoiceForDoc(src.id) : invoiceForQuote(rootId);
      if (done) { toastMsg((isPf ? 'This proforma' : 'This quotation') + ' already has an invoice (' + done.id + ').' + (isPf ? '' : ' For stage billing, convert each proforma.')); return; }
      const q = isPf ? src : quotations.find((x) => x.id === rootId) || src;
      const items = (q.lineItems || []).filter((i) => (i.category as string) !== 'Tax');
      const rate = SD.defaultSstRate(); const t = recordTotals(items, rate); const date = todayIso(); const id = app.getNextSequenceId('invoice', date); const kase = qCase(q) || qCase(src);
      const dep = depositFor(isPf ? src.id : rootId, t.grandTotal);
      app.addInvoice({ id, clientId: q.partyId || src.partyId || kase?.clientId?.split(',')[0].trim() || '', caseId: kase?.id || q.caseId || q.fileRef || '', fileRef: q.fileRef || src.fileRef, quotationId: isPf ? src.id : rootId, partyType: q.partyType || 'Client', partyName: q.clientName, amount: round2(t.fees + t.disbursements + t.reimbursements), discount: 0, tax: t.sst, total: t.grandTotal, date, dueDate: date, status: 'Draft', lineItems: items, sstRate: rate || undefined, matter: q.matter, subject: q.subject, yourRef: q.yourRef, tin: q.tin, scope: q.scope, payInto: 'Office', ...(dep.amount ? { depositApplied: dep.amount, depositReceiptIds: dep.ids } : {}) });
      setView({ kind: 'invoice', id }); setDocT('Invoice');
      toastMsg('Draft ' + id + ' created from ' + src.id + (dep.amount ? ` · ${rm2(dep.amount)} already paid on it will be deducted` : ''));
      return;
    }
    if (a === 'Request write-off') { const inv = rec as Invoice; setForm({ kind: 'writeoff', vals: { docId: inv.id, title: inv.id, amount: String(Math.round(invBal(inv) * 100) / 100) } }); return; }
    if (a === 'Edit') { editDoc(kind, rec as Quotation | Invoice); return; }
  };

  /** Send the reminder: mail draft and / or WhatsApp chat; logged on the invoice. */
  const sendReminder = () => {
    const r = rem; if (!r) return;
    if (!r.viaE && !r.viaW) { toastMsg('Choose email, WhatsApp or both'); return; }
    if (r.viaE && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((r.to || '').trim())) { toastMsg("Enter the client's email address"); return; }
    const link = r.viaW ? whatsappLink(r.phone, r.wa) : null;
    if (r.viaW && !link) { toastMsg("Enter the client's mobile number, e.g. 012-345 6789"); return; }
    if (link) window.open(link, '_blank', 'noopener');
    const done = (via: string) => {
      if (r.send) app.updateQuotation(r.id, { status: 'Sent', documentSentDate: todayIso(), documentSentBy: me });
      else if (r.kind === 'invoice') { const inv = invoices.find((i) => i.id === r.id); if (inv) app.updateInvoice(inv.id, { reminders: [...(inv.reminders || []), fd(Date.now()) + ' · ' + via] }); }
    };
    setRem(null);
    if (!r.viaE) { done('WhatsApp'); toastMsg('WhatsApp opened with the message · press Send there'); return; }
    // E-mail is really sent from the portal mailbox (not a draft). The document goes inside the e-mail.
    const esc2 = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const d = r.attach ? buildDoc({ kind: r.kind, id: r.id }) : null;
    let docPart = d ? SD.docHtml(d) : '';
    if (docPart.length > 280000) docPart = '';
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16223A;white-space:pre-wrap">${esc2(r.body)}</div>${docPart ? '<hr style="margin:24px 0;border:0;border-top:1px solid #DDE3EB">' + docPart : ''}`;
    toastMsg('Sending email to ' + r.to + '…');
    void queueClientEmail({ to: r.to, subject: r.subj, text: r.body, html, docId: r.id, kind: r.send ? 'send' : 'reminder', createdBy: currentUser?.email || '' }).then((id) => {
      const stop = watchClientEmail(id, (st, err) => {
        if (st === 'SUCCESS') { stop(); done(r.viaW ? 'email & WhatsApp' : 'email'); toastMsg('Email sent to ' + r.to + (r.send ? ' · ' + r.id + ' marked sent' : ' · reminder recorded')); }
        if (st === 'ERROR') { stop(); toastMsg('Email NOT sent: ' + (err || 'unknown error') + (r.viaW ? ' (WhatsApp was opened)' : '')); }
      });
      setTimeout(stop, 120000);
    }).catch((e) => toastMsg('Email NOT sent: ' + (e instanceof Error ? e.message : String(e)) + '. Only people who may edit billing can email clients.'));
  };

  const openNew = (type: 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt') => {
    if (!(canPrepare || rk === 'P')) { toastMsg('Not available for your role.'); return; }
    const area = 'Litigation';
    setView(null);
    setEd({ type: type === 'Receipt' ? 'Invoice' : type, client: '', ref: '', matter: '', area, account: 'Office', lines: SD.fromTemplate(area), yourRef: 'Kindly Advised', tin: '-', subject: '', desc: SD.AREAS[area].desc, arrangement: '', sstRate: SD.defaultSstRate(), inst: null, plan: defaultPlanFor(area) });
  };
  const editDoc = (kind: DocKind, rec: Quotation | Invoice, copy = false) => {
    const ref: DocRef = { kind, id: rec.id }; const d = buildDoc(ref); if (!d || d.type === 'Receipt') return;
    setView(null);
    setEd({ ...(copy ? {} : { kind, id: rec.id, date: isoOf(parseDate(rec.date) || Date.now()) }), type: d.type, client: d.client, ref: d.ref || '', matter: d.matter || '', area: d.area || 'Litigation', account: d.account === 'Client account' ? 'Client account' : 'Office', yourRef: d.yourRef || 'Kindly Advised', tin: d.tin || '-', subject: d.subject || '', desc: d.desc || '', arrangement: d.arrangement || '', sstRate: d.sstRate || 0, inst: d.inst ? { ...d.inst } : null, lines: { prof: SD.clone(d.lines?.prof), disb: SD.clone(d.lines?.disb), reimb: SD.clone(d.lines?.reimb) },
      plan: kind === 'quotation' ? (planOf(rec as Quotation) || { kind: 'Full' }) : { kind: d.inst && d.inst.on ? 'Instalments' : 'Full' } });
  };
  /** Quotation fields saved from the editor: payment plan (instalments also as the fee arrangement). */
  const planFields = (e: EditorState): Partial<Quotation> => {
    const inst = e.plan.kind === 'Instalments' ? { on: true, months: e.inst?.months || 8, upfront: e.inst?.upfront || 0, terms: e.inst?.terms ?? SD.ARR_TERMS } : null;
    const paymentPlan: QuotationPaymentPlan = e.plan.kind === 'Instalments' ? { kind: 'Instalments', months: inst!.months, upfront: inst!.upfront } : e.plan.kind === 'Stages' ? { kind: 'Stages', stages: (e.plan.stages || []).map((x) => ({ label: x.label, ...(x.amount != null ? { amount: x.amount } : { pct: Number(x.pct) || 0 }), ...(x.due ? { due: x.due } : {}) })) } : { kind: 'Full' };
    return { paymentPlan, feeArrangement: inst };
  };
  const saveEd = (andView: boolean) => {
    const e = ed; if (!e) return;
    const client = clientByName(e.client); const kase = caseForRef(e.ref);
    const rate = e.sstRate || 0;
    const subject = e.subject || String(e.matter || '').toUpperCase();
    if (e.id && e.kind === 'invoice') {
      const inv = invoices.find((i) => i.id === e.id); if (!inv) return;
      const items = linesToItems(e.lines, inv.lineItems); const t = recordTotals(items, rate);
      const patch: Partial<Invoice> = { ...(e.date ? { date: e.date } : {}), partyName: e.client, clientId: client?.id || inv.clientId, caseId: kase?.id || inv.caseId, fileRef: e.ref, matter: e.matter, lineItems: items, amount: round2(t.fees + t.disbursements + t.reimbursements), tax: t.sst, total: t.grandTotal, sstRate: rate || undefined, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, feeArrangement: e.inst };
      if (invIssued(inv)) {
        // Issued invoice: the change is booked like a credit note + reissue — the old postings are
        // reversed and the new amounts posted, so AR / fee income / SST follow the document.
        if (inv.status === 'Voided') { toastMsg('A voided invoice cannot be changed.'); return; }
        const dep = Math.min(Number(inv.depositApplied || 0), t.grandTotal);
        if (t.grandTotal + 0.005 < invPaid(inv) + dep + Number(inv.writtenOff || 0)) { toastMsg(`The new total (${rm2(t.grandTotal)}) is below what has already been received / written off. Refund or reallocate first.`); return; }
        const date = todayIso();
        const next: Invoice = { ...inv, ...patch, depositApplied: dep || undefined };
        app.updateInvoice(inv.id, { ...patch, depositApplied: dep || undefined });
        postGL([...reversalOf(inv.id, date, 'amended'), ...issueGL(next, date)]);
        setEd(null); if (andView) setView({ kind: 'invoice', id: inv.id }); toastMsg('Changes saved · previous postings reversed and the amended invoice re-posted'); return;
      }
      app.updateInvoice(inv.id, patch);
      setEd(null); if (andView) setView({ kind: 'invoice', id: inv.id }); toastMsg('Changes saved'); return;
    }
    if (e.id && e.kind === 'quotation') {
      const q = quotations.find((i) => i.id === e.id); if (!q) return;
      const items = linesToItems(e.lines, q.lineItems); const t = recordTotals(items, rate);
      app.updateQuotation(q.id, { ...(e.date ? { date: e.date } : {}), clientName: e.client, partyId: client?.id || q.partyId, caseId: kase?.id || q.caseId, fileRef: e.ref, matter: e.matter, practiceArea: e.area, lineItems: items, total: t.grandTotal, remaining: t.grandTotal - (q.billedSoFar || 0), sstApplied: rate > 0, sstRate: rate || undefined, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, ...(q.documentType === 'Proforma' ? { feeArrangement: e.inst } : planFields(e)) });
      setEd(null); if (andView) setView({ kind: 'quotation', id: q.id }); toastMsg('Changes saved'); return;
    }
    const items = linesToItems(e.lines); const t = recordTotals(items, rate);
    if (e.type === 'Invoice') {
      const id = app.getNextSequenceId('invoice');
      app.addInvoice({ id, clientId: client?.id || '', caseId: kase?.id || e.ref || '', fileRef: e.ref, partyType: 'Client', partyName: e.client || 'New client', amount: t.fees + t.disbursements + t.reimbursements, discount: 0, tax: t.sst, total: t.grandTotal, date: e.date || todayIso(), dueDate: todayIso(), status: 'Draft', lineItems: items, sstRate: rate || undefined, matter: e.matter, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, payInto: e.account, feeArrangement: e.inst });
      setEd(null); setView(andView ? { kind: 'invoice', id } : null); setDocT('Invoice'); setInvF('All'); go('billing'); toastMsg(id + ' saved as draft');
    } else {
      const id = app.getNextSequenceId(e.type === 'Proforma' ? 'proforma' : 'quotation');
      app.addQuotation({ id, createdAt: new Date().toISOString(), documentType: e.type, partyType: 'Client', partyId: client?.id, date: e.date || todayIso(), practiceArea: e.area, fileRef: e.ref, leadId: (app.leads || []).find((l) => l.name === e.client)?.id || '', clientName: e.client || 'New client', status: 'Draft', total: t.grandTotal, billedSoFar: 0, remaining: t.grandTotal, courtLevel: '', stage: '', feeMethod: 'Template', subtype: '', approvalStatus: 'Pending', approvedBy: '', approvedDate: '', lineItems: items, sstApplied: rate > 0, sstRate: rate || undefined, validityDays: Number(settings.quotationValidityDays) || 30, caseId: kase?.id, matter: e.matter, subject, yourRef: e.yourRef, tin: e.tin, scope: e.desc, terms: e.type === 'Quotation' ? SD.TERMS.slice() : [], feeArrangement: e.inst, payInto: e.account, ...(e.type === 'Quotation' ? planFields(e) : {}) });
      setEd(null); setView(andView ? { kind: 'quotation', id } : null); setDocT(e.type); go('billing'); toastMsg(id + ' saved as draft');
    }
  };

  const billMatter = (u: Unbilled) => {
    if (!(canPrepare || rk === 'P')) { toastMsg('Not available for your role.'); return; }
    const k = u.kase; const id = app.getNextSequenceId('invoice');
    const area = SD.areaFromName(k?.practiceArea || k?.type, k?.ref);
    // Disbursements (paid to third parties, no SST) vs reimbursements (our own costs re-charged:
    // photocopy, courier, mileage / travel…, SST-able) by expense category.
    const exLine = (x: Expense) => [x.description || x.category, Number(x.amount || 0)] as SD.DocLine;
    const lines: SD.DocLines = {
      prof: u.te.map((t) => [`${t.description || 'Professional services'} (${fd(t.date)}, ${t.hours}h)`, round2(Number(t.hours || 0) * Number(t.rate || 0))] as SD.DocLine),
      disb: u.ex.filter((x) => expenseIsDisb(x)).map(exLine),
      reimb: [...u.ex.filter((x) => !expenseIsDisb(x)).map(exLine), ...u.tc.map((t) => [`Travelling: ${t.purpose || t.to || t.type} (${fd(t.date)})`, round2(travelBillable(t))] as SD.DocLine)],
    };
    const items = linesToItems(lines); const rate = SD.defaultSstRate(); const t = recordTotals(items, rate);
    const cid = k ? k.clientId.split(',')[0].trim() : '';
    // The work is marked billed when this draft is ISSUED (until then it stays off "Work not
    // billed" because it is on the draft, and comes back if the draft is voided).
    app.addInvoice({ id, clientId: cid, caseId: k?.id || u.caseId, fileRef: k?.ref, partyType: 'Client', partyName: u.client, amount: round2(t.fees + t.disbursements + t.reimbursements), discount: 0, tax: t.sst, total: t.grandTotal, date: todayIso(), dueDate: todayIso(), status: 'Draft', lineItems: items, sstRate: rate || undefined, matter: k?.title, subject: String(k?.title || '').toUpperCase(), yourRef: 'Kindly Advised', tin: '-', scope: SD.AREAS[area]?.desc || '', payInto: 'Office', sourceItems: { time: u.te.map((x) => x.id), expenses: u.ex.map((x) => x.id), travel: u.tc.map((x) => x.id) } });
    setBilled((b) => ({ ...b, [u.caseId]: { inv: id, u } }));
    setView({ kind: 'invoice', id });
    toastMsg('Draft ' + id + ' created from unbilled work');
  };

  /* ------------------------------ forms ------------------------------ */
  /** Attach the PDF to a past invoice / receipt keyed in without one (e.g. from a bulk import). */
  const attachPastFile = (kind: 'invoice' | 'receipt' | 'quotation', rec: { id: string; caseId?: string; pastNo?: string }, file: File) => {
    const kase = rec.caseId ? lk.caseById.get(rec.caseId) : undefined;
    void (async () => {
      try {
        await prepareStorage();
        const up = await storeEngagementFile(kase ? { ref: kase.ref, title: kase.title } : { ref: '', title: kind === 'invoice' ? 'Past invoices' : 'Past receipts' }, file, me);
        const pastFile = { name: up.name, driveFileId: up.driveFileId, webViewLink: up.webViewLink };
        if (kind === 'invoice') app.updateInvoice(rec.id, { pastFile }); else if (kind === 'quotation') app.updateQuotation(rec.id, { pastFile }); else app.updateReceipt(rec.id, { pastFile });
        toastMsg('PDF saved for ' + (rec.pastNo || rec.id));
      } catch (e) { toastMsg('PDF not uploaded: ' + (e instanceof Error ? e.message : String(e))); }
    })();
  };
  const openPastFile = (pf?: { driveFileId?: string; webViewLink?: string }) => {
    if (pf?.webViewLink || pf?.driveFileId) window.open(pf.webViewLink || 'https://drive.google.com/file/d/' + pf.driveFileId + '/view', '_blank', 'noopener');
    else toastMsg('No PDF attached yet.');
  };
  const openForm = (kind: string, vals: Record<string, any> = {}) => setForm({ kind, vals });
  const saveForm = () => {
    if (!form) return;
    const { kind, vals } = form;
    // Past papers are keyed in by part (fees, reimbursements, disbursements, SST) so each file shows them by category.
    const isPast = ['pastQuote', 'pastProforma', 'pastInvoice'].includes(kind);
    const pFees = num0(vals.fees), pReimb = num0(vals.reimb), pDisb = num0(vals.disb), pSst = num0(vals.sst);
    const amt = isPast ? round2(pFees + pReimb + pDisb + pSst) : num0(vals.amount);
    const pastLines = (feeDesc: string): Quotation['lineItems'] => [
      ...(pFees > 0 ? [{ description: feeDesc, category: 'Fee - Fixed', amount: pFees, quantity: 1, unitPrice: pFees, chargeType: 'Fixed' }] : []),
      ...(pReimb > 0 ? [{ description: 'Reimbursements', category: 'Reimbursement', amount: pReimb, quantity: 1, unitPrice: pReimb, chargeType: 'Fixed' }] : []),
      ...(pDisb > 0 ? [{ description: 'Disbursements', category: 'Disbursement', amount: pDisb, quantity: 1, unitPrice: pDisb, chargeType: 'Fixed' }] : []),
    ] as Quotation['lineItems'];
    const dateIso = isoOf(parseDate(vals.date)) || todayIso();
    const proofs: FinanceProof[] = vals.proofs || [];
    if (rk === 'R' || rk === 'S') { toastMsg('Read-only access.'); return; }
    if (kind === 'pastProforma') {
      // A proforma made before the portal: kept with its PDF for reference, never counted as unpaid.
      if (!canPrepare) { toastMsg('Proformas are recorded by Accounts.'); return; }
      const no = String(vals.no || '').trim();
      if (!no) { toastMsg('Enter the proforma number as printed.'); return; }
      if (quotations.some((q) => q.id.toLowerCase() === no.toLowerCase())) { toastMsg(no + ' is already in the list.'); return; }
      if (!String(vals.client || '').trim()) { toastMsg('Enter the client.'); return; }
      if (amt <= 0) { toastMsg('Enter the amounts (at least one).'); return; }
      const c = clientByName(vals.client || ''); const kase = vals.matter ? caseForRef(String(vals.matter)) : undefined;
      const into = vals.payInto === 'Client account' ? 'Client account' : 'Office';
      app.addQuotation({
        id: no, historical: true, documentType: 'Proforma', partyType: 'Client', partyId: c?.id, date: dateIso, createdAt: new Date().toISOString(),
        practiceArea: kase?.practiceArea || kase?.type || '', fileRef: kase?.ref || '', caseId: kase?.id, matter: kase?.title, leadId: '', clientName: c?.name || String(vals.client).trim(),
        status: 'Sent', total: amt, billedSoFar: 0, remaining: amt, courtLevel: '', stage: '', feeMethod: 'Fixed', subtype: '', payInto: into,
        approvalStatus: 'Approved', approvedBy: me, approvedDate: dateIso, lineItems: pastLines(String(vals.what || '').trim() || 'As per proforma ' + no),
      } as Quotation);
      const pdf = ((vals.pdf || []) as (FinanceProof & { file?: File })[]).find((p) => p.file)?.file;
      if (pdf) {
        void (async () => {
          try {
            await prepareStorage();
            const up = await storeEngagementFile(kase ? { ref: kase.ref, title: kase.title } : { ref: '', title: 'Past proformas' }, pdf, me);
            app.updateQuotation(no, { pastFile: { name: up.name, driveFileId: up.driveFileId, webViewLink: up.webViewLink } });
          } catch (e) { toastMsg(no + ' saved, but its PDF was not uploaded: ' + (e instanceof Error ? e.message : String(e))); }
        })();
      }
      setForm(null); toastMsg(no + ' recorded (for reference)' + (pdf ? ' · PDF saving to Google Drive' : ''));
      return;
    }
    if (kind === 'pastQuote') {
      if (!canPrepare) { toastMsg('Quotations are recorded by Accounts.'); return; }
      const no = String(vals.no || '').trim();
      if (!no) { toastMsg('Enter the quotation number as printed.'); return; }
      if (quotations.some((q) => q.id.toLowerCase() === no.toLowerCase())) { toastMsg(no + ' is already in the list.'); return; }
      if (!String(vals.client || '').trim()) { toastMsg('Enter the client.'); return; }
      if (amt <= 0) { toastMsg('Enter the amounts (at least one).'); return; }
      const c = clientByName(vals.client || ''); const kase = vals.matter ? caseForRef(String(vals.matter)) : undefined;
      const status = (['Accepted', 'Sent', 'Declined'].includes(vals.status) ? vals.status : 'Accepted') as Quotation['status'];
      app.addQuotation({
        id: no, historical: true, documentType: 'Quotation', partyType: 'Client', partyId: c?.id, date: dateIso, createdAt: new Date().toISOString(),
        practiceArea: kase?.practiceArea || kase?.type || '', fileRef: kase?.ref || '', caseId: kase?.id, matter: kase?.title, leadId: '', clientName: c?.name || String(vals.client).trim(),
        status, total: amt, billedSoFar: 0, remaining: amt, courtLevel: '', stage: '', feeMethod: 'Fixed', subtype: '',
        approvalStatus: 'Approved', approvedBy: me, approvedDate: dateIso, lineItems: pastLines('Professional fees as per quotation ' + no),
      });
      const pdf = ((vals.pdf || []) as (FinanceProof & { file?: File })[]).find((p) => p.file)?.file;
      if (pdf) {
        void (async () => {
          try {
            await prepareStorage();
            const up = await storeEngagementFile(kase ? { ref: kase.ref, title: kase.title } : { ref: '', title: 'Past quotations' }, pdf, me);
            app.updateQuotation(no, { pastFile: { name: up.name, driveFileId: up.driveFileId, webViewLink: up.webViewLink } });
          } catch (e) { toastMsg(no + ' saved, but its PDF was not uploaded: ' + (e instanceof Error ? e.message : String(e))); }
        })();
      }
      setForm(null); toastMsg(no + ' recorded' + (pdf ? ' · PDF saving to Google Drive' : ''));
      return;
    }
    if (kind === 'pastInvoice' || kind === 'pastReceipt') {
      // Record only: kept with its PDF for reference. Never posted, never counted, numbers untouched.
      const inv = kind === 'pastInvoice'; const what = inv ? 'invoice' : 'receipt';
      if (!canPrepare) { toastMsg('Past papers are recorded by Accounts.'); return; }
      const no = String(vals.no || '').trim();
      if (!no) { toastMsg('Enter the ' + what + ' number as printed.'); return; }
      const past = inv ? (app.pastInvoices || []) : (app.pastReceipts || []);
      if (past.some((x) => String(x.pastNo || '').toLowerCase() === no.toLowerCase())) { toastMsg(no + ' is already recorded.'); return; }
      if (!String(vals.client || '').trim()) { toastMsg('Enter the client.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      const c = clientByName(vals.client || ''); const kase = vals.matter ? caseForRef(String(vals.matter)) : undefined;
      const id = 'PAST ' + no; const name = c?.name || String(vals.client).trim(); const desc = String(vals.what || '').trim();
      type PastFile = { name: string; driveFileId?: string; webViewLink?: string };
      const save = (pastFile?: PastFile) => {
        if (inv) app.addInvoice({ id, recordOnly: true, pastNo: no, pastFile, historical: true, clientId: c?.id || '', caseId: kase?.id || '', fileRef: kase?.ref || '', partyType: 'Client', partyName: name, amount: round2(amt - pSst), discount: 0, tax: pSst, total: amt, date: dateIso, dueDate: dateIso, status: vals.status === 'Paid' ? 'Paid' : vals.status === 'Part paid' ? 'Partial' : 'Unpaid', matter: desc || kase?.title, lineItems: pastLines(desc || 'Professional fees') } as Invoice);
        else app.addReceipt({ id, recordOnly: true, pastNo: no, pastFile, historical: true, date: dateIso, accountSet: vals.account === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: name, description: desc || 'Past receipt', amount: amt, debit: '', credit: '', clientId: c?.id || '', fileRef: kase?.ref || '', bankRef: '', receivedBy: me, paymentMethod: vals.method || '—', forNo: desc, caseId: kase?.id } as unknown as Receipt);
      };
      // The PDF goes to the file's folder in Client Files first, then the record is saved with its link.
      const pdf = ((vals.pdf || []) as (FinanceProof & { file?: File })[]).find((p) => p.file)?.file;
      if (pdf) {
        void (async () => {
          try {
            await prepareStorage();
            const up = await storeEngagementFile(kase ? { ref: kase.ref, title: kase.title } : { ref: '', title: inv ? 'Past invoices' : 'Past receipts' }, pdf, me);
            save({ name: up.name, driveFileId: up.driveFileId, webViewLink: up.webViewLink });
          } catch (e) { save(); toastMsg(no + ' saved, but its PDF was not uploaded: ' + (e instanceof Error ? e.message : String(e))); }
        })();
      } else save();
      setForm(null); toastMsg(no + ' recorded (for reference, not counted)' + (pdf ? ' · PDF saving to Google Drive' : ''));
      return;
    }
    if (kind === 'moneyIn') {
      if (!canPrepare) { toastMsg('Receipts are recorded by Accounts.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount received.'); return; }
      // Design: "This money is" Payment of an invoice (office) / Deposit / money held for client.
      const acc: 'Office' | 'Client account' = vals.kind === 'Deposit / money held for client' ? 'Client account' : vals.kind ? 'Office' : vals.account || 'Office';
      const c = clientByName(vals.client || ''); const forNo = String(vals.forNo || '').trim();
      if (acc === 'Client account' && /^(INV|IV)-/i.test(forNo)) { toastMsg('Payment for an issued invoice goes to the office account. Choose "Payment of an invoice", or give the purpose for a deposit.'); return; }
      const inv = invoices.find((i) => i.id === forNo); const pf = quotations.find((q) => q.id === forNo);
      const kase = vals.caseId ? findCase(lk, vals.caseId) : inv ? invCase(inv) : pf ? qCase(pf) : caseForRef(forNo);
      if (acc === 'Office' && inv) { if (inv.status === 'Voided') { toastMsg(inv.id + ' is voided.'); return; } if (amt > invBal(inv) + 0.01) { toastMsg('Payment cannot exceed the invoice balance (' + rm2(invBal(inv)) + ').'); return; } }
      if (acc === 'Client account' && !c) { toastMsg('Client money must be linked to a registered client (client ledger).'); return; }
      const id = app.getNextSequenceId('receipt');
      rememberProofUrls('form', id, proofs);
      app.addReceipt({ id, date: dateIso, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: vals.client || c?.name || '—', description: forNo || 'Payment received', amount: amt, debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : inv ? GLA.ar : pf ? GLA.feesAdvance : GLA.fees, clientId: c?.id || inv?.clientId || '', fileRef: kase?.ref || inv?.fileRef || '', bankRef: '', receivedBy: me, paymentMethod: vals.method || 'Online transfer', forNo, invoiceId: inv?.id, quotationId: pf?.id, caseId: kase?.id, proofs });
      if (acc === 'Office' && inv) app.addPayment({ id: 'PAY-' + id, invoiceId: inv.id, amount: amt, date: dateIso, method: vals.method || 'Online transfer' });
      if (acc === 'Client account' && c) app.addRetainer({ id: 'RET-' + id, clientId: c.id, caseId: kase?.id || '', type: 'Deposit', amount: amt, date: dateIso, remarks: forNo || 'Money received into client account', voucherNo: id });
      postGL([{ date: dateIso, docType: 'OR', docNo: id, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : inv ? GLA.ar : pf ? GLA.feesAdvance : GLA.fees, amount: amt, clientId: c?.id || '', fileRef: kase?.ref || '', description: `Receipt ${id} · ${forNo || 'payment received'}` }]);
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
        app.addReceipt({ id, date: dateIso, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: q.clientName, description: `Payment for ${q.id}`, amount: amt, debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : GLA.feesAdvance, clientId: cid, fileRef: q.fileRef || '', bankRef: '', receivedBy: me, paymentMethod: vals.method || 'Online transfer', forNo: q.id, quotationId: q.id, caseId: kase?.id, proofs });
        if (acc === 'Client account') app.addRetainer({ id: 'RET-' + id, clientId: cid, caseId: kase?.id || '', type: 'Deposit', amount: amt, date: dateIso, remarks: `Deposit for ${q.id}`, voucherNo: id });
        postGL([{ date: dateIso, docType: 'OR', docNo: id, accountSet: acc === 'Client account' ? 'CLIENT' : 'OFFICE', debit: cashAccountGL(acc), credit: acc === 'Client account' ? GLA.clientFunds : GLA.feesAdvance, amount: amt, clientId: cid, fileRef: q.fileRef || '', description: `Receipt ${id} for ${q.id}` }]);
      }
      setForm(null); setView({ kind: 'receipt', id });
      toastMsg('Receipt ' + id + ' issued' + (proofs.length ? ' with proof' : ' · no proof attached yet'));
    } else if (kind === 'journal') {
      if (!canPrepare) { toastMsg('Journals are prepared by Accounts.'); return; }
      if (amt <= 0 || !String(vals.details || '').trim()) { toastMsg('Enter the details and amount.'); return; }
      const account = vals.account || 'Office'; const direction = vals.dir || 'Money out';
      let jClient: string | undefined, jCase: string | undefined;
      if (account === 'Client account') {
        // Client money must always sit in a client ledger: a client-account journal names the
        // client and matter, and its ledger entry is written when it is approved.
        const c = clientByName(vals.client || '');
        if (!c) { toastMsg('Client-account journals must name a registered client (the client ledger it adjusts).'); return; }
        const kase = vals.matter ? caseForRef(String(vals.matter)) : undefined;
        if (vals.matter && !kase) { toastMsg('Matter ' + vals.matter + ' not found: pick the file reference from the list.'); return; }
        if (!kase && !ledgers.some((l) => l.clientId === c.id && !l.caseId)) { toastMsg('Pick the matter (file reference) this client-ledger adjustment belongs to.'); return; }
        jClient = c.id; jCase = kase?.id || '';
        if (direction === 'Money out' && clientLedgerBalance(c.id, jCase) < amt - 0.005) { toastMsg(`Not enough in ${c.name}'s ledger for this matter (${rm2(clientLedgerBalance(c.id, jCase))}): the client account can never go below zero.`); return; }
      }
      const id = app.getNextSequenceId('journal', dateIso);
      app.addManualJournal({ id, date: dateIso, account, direction, details: vals.details || '', amount: amt, reason: vals.reason || '', preparedBy: me, createdAt: new Date().toISOString(), status: 'Pending Approval', ...(jClient ? { clientId: jClient, caseId: jCase } : {}) });
      setForm(null); toastMsg(id + ' posted · sent to Approvals');
    } else if (kind === 'payOut' || kind === 'transfer') {
      if (!canPrepare) { toastMsg('Client account payments are prepared by Accounts.'); return; }
      const c = clientByName(vals.client || '');
      if (!c) { toastMsg('Pick a registered client: client money is paid out per client ledger.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      // Always a specific matter ledger (a client-wide total could overdraw one matter with
      // another matter's money). '' = the client's "no matter linked" ledger, opened from it.
      const typed = String(vals.matter || '').trim();
      const typedCase = typed ? caseForRef(typed) : undefined;
      if (typed && !typedCase) { toastMsg('Matter ' + typed + ' not found: pick the file reference from the list.'); return; }
      const caseId: string | undefined = typedCase ? typedCase.id : vals.caseId;
      if (caseId == null) { toastMsg('Pick the matter: client money is paid out of one matter’s ledger.'); return; }
      const bal = clientLedgerBalance(c.id, caseId);
      if (amt > bal + 0.005) { toastMsg(`Not enough in ${c.name}'s ledger for this matter (${rm2(bal)}): the client account can never go below zero.`); return; }
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
      app.addPaymentVoucher({ id, date: dateIso, accountSet: 'CLIENT', voucherCategory: kind === 'transfer' ? 'Legal Fees Transfer' : 'Client Disb', payee: kind === 'transfer' ? 'Office account' : vals.payee || '', paymentMethod: vals.method || 'Bank transfer', description: kind === 'transfer' ? `Transfer to office for ${inv!.id}` : vals.purpose || 'payment', amount: amt, debit: GLA.clientFunds, credit: GLA.clientBank, clientId: c.id, fileRef: kase?.ref || '', caseId: kase?.id || caseId, invoiceId: inv?.id, preparedBy: me, approvalStatus: 'Pending Approval', approved: false, ...(proofs.length ? { proofs } : {}) });
      setForm(null); toastMsg('Sent to Approvals (needs 2 signatories)');
    } else if (kind === 'disb') {
      // Paid on behalf of a client: a billable disbursement (3200 / recoverable), billed back on the
      // next invoice for that file. Paid from the Disbursement account.
      if (!canPrepare) { toastMsg('Disbursements are recorded by Accounts.'); return; }
      const c = clientByName(vals.client || '');
      if (!String(vals.client || '').trim()) { toastMsg('Name the client. This is billed back to them.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      const kase = vals.matter ? caseForRef(String(vals.matter)) : cases.find((k) => c && k.clientId.split(',').map((x) => x.trim()).includes(c.id) && k.status !== 'Closed');
      const id = app.getNextSequenceId('expense');
      const fromBank = String(vals.from || paidFromOptions[0] || 'Disbursement');
      app.addExpense({ id, caseId: kase?.id || '', fileRef: kase?.ref, date: dateIso, category: 'Disbursement', amount: amt, billable: true, description: vals.what || 'Disbursement', payee: vals.payee || '', accountSet: 'OFFICE', paidFrom: fromBank, approvalStatus: 'Posted to GL', postedToGl: true, paidProof: proofs[0], documents: proofs.map((p, i) => ({ id: `DOC-${id}-${i}`, name: p.name, url: '', type: p.type, size: p.size, uploadedAt: p.uploadedAt, category: 'Receipt Photo' as const })) });
      rememberProofUrls('form', 'expense:' + id, proofs);
      postGL([{ date: dateIso, docType: 'PV', docNo: id, accountSet: 'OFFICE', debit: GLA.unbilledDisb, credit: /disb/i.test(fromBank) ? GLA.disb : /petty/i.test(fromBank) ? GLA.petty : GLA.office, amount: amt, clientId: c?.id || '', fileRef: kase?.ref || '', description: `Disbursement for ${vals.client}: ${vals.what || ''} · paid to ${vals.payee || '—'}` }]);
      setForm(null); toastMsg(`${id} recorded · billed back to ${vals.client} on the next invoice${kase ? '' : ' (link it to a file to bill it)'}`);
    } else if (kind === 'expense') {
      if (!canPrepare) { toastMsg('Office expenses are recorded by Accounts.'); return; }
      if (amt <= 0) { toastMsg('Enter the amount.'); return; }
      const kindOf = String(vals.kind || 'Office expense');
      if (kindOf === PV_STATUTORY || kindOf === PV_SST || kindOf === PV_DRAWINGS) {
        // Remittances / drawings settle what is already owed (2300 statutory, 2200 SST) or are
        // equity (3100): recorded as a paid voucher, never as an office expense.
        const from = vals.from || paidFromOptions[0]; const id = app.getNextSequenceId('voucher');
        const debit = pvDebitGL(kindOf); const credit = /petty/i.test(from) ? GLA.petty : GLA.office;
        app.addPaymentVoucher({ id, date: dateIso, accountSet: 'OFFICE', voucherCategory: kindOf as PaymentVoucher['voucherCategory'], payee: vals.payee || '', paymentMethod: 'Bank transfer', description: vals.what || kindOf, amount: amt, debit, credit, clientId: '', fileRef: '', bankAccountName: /petty/i.test(from) ? 'Petty cash' : from, preparedBy: me, approvalStatus: 'Posted to GL', approved: true, postedToGl: true, paidAt: dateIso, paidProof: proofs[0], proofs });
        rememberProofUrls('form', 'pv:' + id, proofs);
        postGL([{ date: dateIso, docType: 'PV', docNo: id, accountSet: 'OFFICE', debit, credit, amount: amt, clientId: '', fileRef: '', description: `${vals.payee || ''} · ${vals.what || kindOf}` }]);
        setForm(null); toastMsg(`${id} recorded (${kindOf}) · not an office expense`); return;
      }
      if (vals.cat === 'Other' && !String(vals.catOther || '').trim()) { toastMsg('Category is Other: say what it is.'); return; }
      const id = app.getNextSequenceId('expense'); const from = vals.from || paidFromOptions[0]; const cat = vals.cat === 'Other' ? 'Other: ' + String(vals.catOther).trim() : vals.cat || 'Utilities';
      if (isStatutoryCategory(cat)) { toastMsg('EPF / SOCSO / EIS / PCB payments: choose "' + PV_STATUTORY + '" as the type (they settle payroll amounts already booked).'); return; }
      app.addExpense({ id, caseId: '', date: dateIso, category: cat, amount: amt, billable: false, description: vals.what || '', payee: vals.payee || '', accountSet: 'OFFICE', paidFrom: from, approvalStatus: 'Posted to GL', postedToGl: true, paidProof: proofs[0], documents: proofs.map((p, i) => ({ id: `DOC-${id}-${i}`, name: p.name, url: '', type: p.type, size: p.size, uploadedAt: p.uploadedAt, category: 'Receipt Photo' as const })) });
      rememberProofUrls('form', 'expense:' + id, proofs);
      postGL([{ date: dateIso, docType: 'PV', docNo: id, accountSet: 'OFFICE', debit: expenseGL(cat), credit: /petty/i.test(from) ? GLA.petty : GLA.office, amount: amt, clientId: '', fileRef: '', description: `${vals.payee || ''} · ${vals.what || cat}` }]);
      setForm(null); toastMsg(proofs.length ? 'Expense recorded with receipt.' : 'Expense recorded. Attach the receipt to complete it.');
    } else if (kind === 'fund') {
      const fund: SinkingFund = { id: `fund-${Date.now()}`, name: vals.name || 'New fund', note: 'added by ' + me, target: num0(vals.target), balance: num0(vals.saved), due: vals.due || '—', monthly: num0(vals.monthly), pct: num0(vals.pct) || undefined };
      const next = [...(settings.sinkingFunds || []), fund];
      saveSettings({ sinkingFunds: next }); if (fundsDraft) setFundsDraft([...fundsDraft, fund]);
      setForm(null); toastMsg('Fund added');
    } else if (kind === 'writeoff') {
      const inv = invoices.find((i) => i.id === vals.docId); if (!inv) return;
      if (amt <= 0 || amt > invBal(inv) + 0.01) { toastMsg('Write-off must be between RM 0 and the balance (' + rm2(invBal(inv)) + ').'); return; }
      app.updateInvoice(inv.id, { writeOffRequest: { amount: amt, reason: vals.reason || '', requestedBy: me, requestedAt: new Date().toISOString(), status: 'Pending' } });
      setForm(null); setView(null); toastMsg('Write-off sent to Approvals');
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

  /* ------------------------------ profit & loss (ONE definition) ------------------------------ */
  /**
   * Office income & costs for a period, used by Finance Home AND Books & Reports → Profit & loss.
   * - Fee income = money received × (fees + reimbursements) ÷ invoice total: SST collected and
   *   disbursements recovered are shown separately and are NOT income. Proforma deposits count
   *   when applied to the invoice; until then they are fees received in advance (a liability).
   * - Costs: approved / paid only. Payroll once (payslips: gross + employer EPF/SOCSO/EIS);
   *   statutory remittances, SST to Customs, partner drawings and disbursements are not costs.
   */
  const pnl = (inRange: (d: unknown) => boolean) => {
    const recv = moneyReceived(invoices).filter((x) => inRange(x.date));
    const feeIncome = round2(recv.reduce((s2, x) => s2 + x.income, 0));
    const sstCollected = round2(recv.reduce((s2, x) => s2 + x.sst, 0));
    const disbRecovered = round2(recv.reduce((s2, x) => s2 + x.disb, 0));
    const officeRec = receipts.filter((r) => r.accountSet !== 'CLIENT' && !r.invoiceId && inRange(r.date));
    const isAdvance = (r: Receipt) => !!r.quotationId || r.credit === GLA.feesAdvance;
    const advanceReceived = round2(officeRec.filter(isAdvance).reduce((s2, r) => s2 + Number(r.amount || 0), 0));
    const otherIn = round2(officeRec.filter((r) => !isAdvance(r)).reduce((s2, r) => s2 + Number(r.amount || 0), 0));
    const slipsPaid = payslips.filter((p) => p.status === 'Paid' && inRange(p.paidAt));
    let payroll = slipsPaid.reduce((s2, p) => s2 + (slipCalc(p)?.gross || 0) + Number(p.epfEmployer || 0) + Number(p.socsoEisEmployer || 0), 0);
    const approvedExp = expenses.filter((e) => isApprovedForBilling(e.approvalStatus) && (!e.claimant || !!e.paidAt) && inRange(e.claimant ? e.paidAt : e.date) && !expenseIsDisb(e) && !(e.billable && !e.claimant) && !isStatutoryCategory(e.category));
    // Salary paid outside payslips (only when no payslips were paid that month — never twice).
    const salaryExp = approvedExp.filter((e) => /salar|payroll|wage/i.test(e.category));
    if (!slipsPaid.length) payroll += salaryExp.reduce((s2, e) => s2 + Number(e.amount || 0), 0);
    const cats = new Map<string, number>();
    approvedExp.filter((e) => !e.claimant && !/salar|payroll|wage/i.test(e.category)).forEach((e) => cats.set(e.category || 'Other', (cats.get(e.category || 'Other') || 0) + Number(e.amount || 0)));
    const claims = round2(travelClaims.filter((t) => t.paidAt && inRange(t.paidAt)).reduce((s2, t) => s2 + Number(t.total || 0), 0) + approvedExp.filter((e) => !!e.claimant && !/salar|payroll|wage/i.test(e.category)).reduce((s2, e) => s2 + Number(e.amount || 0), 0));
    const pvs = round2(paymentVouchers.filter((v) => v.accountSet !== 'CLIENT' && !isNonExpensePv(v.voucherCategory) && v.approvalStatus !== 'Rejected' && (v.paidAt || v.historical) && inRange(v.paidAt || v.date)).reduce((s2, v) => s2 + Number(v.amount || 0), 0));
    payroll = round2(payroll);
    const rent = round2([...cats.entries()].filter(([k]) => /rent|utilit|electric|water/i.test(k)).reduce((s2, [, v]) => s2 + v, 0));
    const catTotal = round2([...cats.values()].reduce((s2, v) => s2 + v, 0));
    const income = round2(feeIncome + otherIn);
    const expensesTotal = round2(payroll + catTotal + claims + pvs);
    return { feeIncome, sstCollected, disbRecovered, advanceReceived, otherIn, income, payroll, cats, rent, otherCosts: round2(catTotal - rent + claims + pvs), claims, pvs, expensesTotal, net: round2(income - expensesTotal) };
  };

  /* ------------------------------ import past transactions ------------------------------ */
  const importFile = async (file: File) => { try { const rows = await SD.readSheet(file); setImp((s) => (s ? { ...s, fileName: file.name, raw: rows } : s)); } catch { toastMsg('Could not read ' + file.name); } };
  interface ImpRow { date: string; t: number; type: string; acc: string; client: string; ref: string; no: string; desc: string; amt: number; method: string; proof: string; ok: boolean; status: string; sbg: string; sfg: string; /** Past invoice paid status from the file (Paid / Part paid / Not paid). */ pst: string }
  const importRows = (I0: ImportState): ImpRow[] => {
    if (!I0.raw || I0.raw.length < 2) return [];
    const hdr = I0.raw[0].map((x) => String(x).toLowerCase()); const col = (...k: string[]) => hdr.findIndex((x) => k.some((y) => x.includes(y)));
    const c = { date: col('date', 'tarikh'), type: col('type'), acc: col('account'), client: col('client', 'name', 'payer'), ref: col('our ref'), no: col('document', 'doc', 'receipt no', 'invoice no'), desc: col('desc', 'particular', 'details', 'narration'), amt: col('amount'), method: col('method'), proof: col('proof'), cr: col('credit', 'deposit'), dr: col('debit', 'withdraw'), pst: col('payment status', 'paid') };
    const g = (r: string[], i: number) => (i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''); const nm = (v: string) => Number(String(v || '').replace(/[^0-9.-]/g, '')) || 0;
    const seen = new Set<string>();
    return I0.raw.slice(1).map((r) => {
      let amt = nm(g(r, c.amt)), tp = g(r, c.type);
      if (c.cr >= 0 || c.dr >= 0) { const cr = nm(g(r, c.cr)), dr = nm(g(r, c.dr)); if (cr || dr) { amt = Math.abs(cr || dr); tp = cr ? 'Receipt' : 'Payment'; } }
      const type = /inv/i.test(tp) ? 'Invoice' : /rec|in\b|credit/i.test(tp) ? 'Receipt' : /pay|out|debit|pv/i.test(tp) ? 'Payment' : '';
      const av = g(r, c.acc); const acc2 = av ? (/client/i.test(av) ? 'Client account' : /petty/i.test(av) ? 'Petty cash' : 'Office') : I0.acc;
      const t = parseDate(g(r, c.date)); const client = g(r, c.client); const no = g(r, c.no);
      const ref0 = I0.mode !== 'books';
      const dup = !!no && (seen.has(no) || invoices.some((x) => x.id === no) || receipts.some((x) => x.id === no) || paymentVouchers.some((x) => x.id === no) || [...(app.pastInvoices || []), ...(app.pastReceipts || [])].some((x) => String(x.pastNo || '').toLowerCase() === no.toLowerCase())); if (no) seen.add(no);
      const issue = !t ? 'No date' : !amt ? 'No amount' : !type ? 'Type?' : dup ? 'Doc no. exists' : ref0 && type === 'Payment' ? 'Payments: use Into the books' : ref0 && !no ? 'No doc no.' : type === 'Receipt' && acc2 === 'Client account' && !clientByName(client) ? 'Client not found' : '';
      const warn = !issue && !client ? 'Match client later' : !issue && !g(r, c.proof) ? 'No proof ref' : '';
      return { pst: g(r, c.pst), date: fd(t), t, type: type || '?', acc: acc2, client, ref: g(r, c.ref), no, desc: g(r, c.desc), amt, method: g(r, c.method), proof: g(r, c.proof), ok: !issue, status: issue || warn || 'Ready', sbg: issue ? '#FBEDE9' : warn ? '#FBF2E9' : '#E6EFE9', sfg: issue ? '#B23A2E' : warn ? '#8A6534' : '#2F6F4E' };
    });
  };
  const postImport = (list: ImpRow[]) => {
    if (!canPrepare) { toastMsg('Imports are posted by Accounts.'); return; }
    const ok = list.filter((r) => r.ok); if (!ok.length) return;
    if (imp?.mode !== 'books') {
      // For reference only: kept with their old numbers, never counted (same as + Past invoice / + Past receipt).
      ok.forEach((r) => {
        const dateIso = isoOf(r.t); const c = clientByName(r.client); const kase = r.ref ? caseForRef(r.ref) : undefined; const name = c?.name || r.client || '—';
        if (r.type === 'Invoice') app.addInvoice({ id: 'PAST ' + r.no, recordOnly: true, pastNo: r.no, historical: true, clientId: c?.id || '', caseId: kase?.id || '', fileRef: kase?.ref || r.ref, partyType: 'Client', partyName: name, amount: r.amt, discount: 0, tax: 0, total: r.amt, date: dateIso, dueDate: dateIso, status: /part/i.test(r.pst) ? 'Partial' : /paid/i.test(r.pst) && !/not|un/i.test(r.pst) ? 'Paid' : 'Unpaid', matter: r.desc || kase?.title, lineItems: [{ description: r.desc || 'Professional fees', category: 'Fee - Fixed', amount: r.amt, quantity: 1, unitPrice: r.amt, chargeType: 'Fixed' }] } as Invoice);
        else app.addReceipt({ id: 'PAST ' + r.no, recordOnly: true, pastNo: r.no, historical: true, date: dateIso, accountSet: r.acc === 'Client account' ? 'CLIENT' : 'OFFICE', receivedFrom: name, description: r.desc || 'Past receipt', amount: r.amt, debit: '', credit: '', clientId: c?.id || '', fileRef: kase?.ref || r.ref, bankRef: '', receivedBy: me, paymentMethod: r.method || '—', forNo: r.desc, caseId: kase?.id } as unknown as Receipt);
      });
      setImp(null);
      toastMsg(ok.length + ' past papers recorded for reference (not counted). Attach each PDF from Billing › Past invoices / Past receipts.');
      return;
    }
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
    if (!canPrepare) { toastMsg('The month-end checklist is kept by Accounts and the Super Admin.'); return; }
    const cur = { ...(settings.monthEndClose || {}) };
    if (cur[closeKey(id)]) delete cur[closeKey(id)]; else cur[closeKey(id)] = { by: me, at: new Date().toISOString() };
    saveSettings({ monthEndClose: cur });
  };

  return {
    app, rk, isMP, canApprove, canPrepare, me, TABS, tab: visibleTab, go, toast, toastMsg,
    now, period, prevPeriod, prevDate, monthName, monShort, lastDay, lastDayLabel, nextMonShort, settings, saveSettings,
    lk, ownCase, clientName, staffUser,
    invBal, invPaid, invDeposit, invCredit, invStatus, invIssued, invCase, scopedInvoices, openInvoices, owedTotal, aging, ageDays,
    pnl, moneyReceived, openingAsAt, firmBanksOf, statementFor, setStatement, reconFor,
    qStatus, qCase, proformaPaid, scopedQuotations, scopedReceipts, actionsFor, canDeleteQuote, canDeleteBills, entryOf, editEntry, deleteEntry, deleteQuote, deleteInvoice, deleteReceipt, editReceipt, editApItem, deleteApItem, isAdminUser, act, buildDoc, recordOf, receiptProofList,
    ledgers, trustTotal, ledgerTotalAt, clientLedgerBalance, threeWayRec,
    unbilled, wipTotal, billMatter, billed: billed as Record<string, { inv: string; u: any }>,
    activeBanks, bankKind, banksOf, paidFromOptions, bankBal, lastRecon, officeCash,
    filingLog, filingOff, retryFiling, openPastFile, attachPastFile,
    apItems, pendingAp, approve, apId, apRule, canSignItem, ruleFor, signoffs, signOff, myCode,
    trSub, setTrSub, ofSub, setOfSub, apSub, setApSub, paySub, setPaySub, guide, setGuide, rem, setRem, paper, setPaper, decided: decided as Record<string, { d: 'ok' | 'no'; item: ApItem }>, referral, referralFor, refDecision, toPay, markPaid, paidNow: paidNow as Record<string, { item: PayItem; file: string }>,
    saveSlipPatch, feeShareFor, fsFilesFor, fsPeople, fsCostsFor, fsApproved, saveFs, setFsFile, applyFeeShareToSlips,
    staff, slipOf, slipCalc, slipStatutory, periodSlips, payStep, payNext, refFeeFor,
    cashBook, openingBalance, cbAcc, setCbAcc, attachTo,
    docT, setDocT, invF, setInvF, apF, setApF, fundEdit, setFundEdit, fundsDraft, setFundsDraft,
    view, setView, planStatus, planOf, ed, setEd, saveEd, sendReminder, duplicateDoc: (kind: DocKind, rec: Quotation | Invoice) => { editDoc(kind, rec, true); toastMsg(rec.id + ' copied · save it as a new draft'); }, openNew, editDoc, form, setForm, openForm, saveForm,
    imp, setImp, importFile, importRows, postImport,
    faRead, markRead, toggleClose, closeKey,
    SC, picColor, rm, rm2, fd, dShort,
    itemAmount,
    // unused-but-available helpers for tabs
    addrOf, filesToProofs,
  };
}

export type FinanceCtrl = ReturnType<typeof useFinanceController>;
