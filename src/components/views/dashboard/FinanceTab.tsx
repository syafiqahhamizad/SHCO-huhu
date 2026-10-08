import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { palette, tint, serifFont } from '../../../lib/designTokens';
import {
  getPracticeSettings,
  savePracticeSettings,
  type SinkingFund,
  type Commitment,
} from '../../../services/templateService';
import type { Invoice } from '../../../types';
import { Plus, X } from 'lucide-react';
import {
  SALARY_CAT,
  caseFinder,
  feeIncomeOfPayment,
  moneyInEvents,
  fundProgress,
  isIssued,
  isOfficeExpense,
  isOverheadVoucher,
  isPaidClaim,
  monthlyFixedCost,
  officeCash,
  officeExpenseDate,
  owedBalance,
  paidByInvoice,
  payslipCost,
  payslipCounts,
  pctChange,
  runwayLabel,
} from '../../../lib/financeMetrics';
import { inRange, parseLocal } from '../../../lib/localDate';
import { esc, printHtml } from '../staff/staffPortalShared';

/**
 * "Finance" sub-tab of My Dashboard for the Managing Partner (whole firm; partners and staff get
 * MyMoneyTab instead). Replicates the moneyFirm block
 * of design/My Dashboard.dc.html (lines ~57-151) exactly: period selector, 4 P&L KPI cards,
 * a Profit & loss table, a Net-profit-by-month chart, "Money position today", "Cash reserve
 * & sinking funds" (editable), "Commitments" (editable), and 3 "Profit by X" cards.
 *
 * Every figure is derived from real useApp() data (invoices, payments, receipts, expenses,
 * payslips, payment vouchers, travel claims, bank accounts, timeEntries, cases, retainers,
 * programmes) — nothing here is sample/fabricated. Definitions are shared with the rest of
 * the app through src/lib/financeMetrics.ts:
 *  - Fee income = payment × (fees + reimbursements) ÷ invoice total (no SST, no disbursements).
 *    Disbursements paid for clients and their recoveries net to zero, so neither is in the P&L.
 *  - Staff cost = payroll cost from approved/paid payslips for the period (gross + employer
 *    EPF + employer SOCSO/EIS) plus salary/statutory office expenses — not hours × charge-out rate.
 *  - Overheads = Finance Home's office spending: approved/paid non-billable expenses (staff
 *    claims once paid back), paid office payment vouchers (not client disbursements) and paid
 *    staff travel claims. Rejected / pending items never count.
 *  - Unpaid invoices = issued invoices' owed balance (total − payments − written off). The two
 * editable tables (sinking funds & commitments) are firm-maintained settings persisted on
 * PracticeSettings (services/templateService.ts) — there is no other real data source for a
 * fund's target/monthly-contribution amount or a commitment's due date, so they start empty
 * until the Managing Partner adds one, exactly like sstRegistered/sstRate already work.
 */

/* ----------------------------- formatting helpers ----------------------------- */

const fmtFull = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`;

/** Matches the mockup's fm(): round to nearest RM 100, one decimal of "k", parens for negative. */
const fmtK = (v: number) => {
  const neg = v < 0;
  const val = Math.round(Math.abs(v) / 100) / 10;
  return (neg ? '(' : '') + 'RM ' + val + 'k' + (neg ? ')' : '');
};


const GREEN = '#2F6F4E';
const RED = '#B23A2E';
const NAVY = '#16223A';
const SLATE = '#5B6478';
const GOLD = '#8A6534';

/* ----------------------------- period math ----------------------------- */

type PeriodKind = 'month' | 'quarter' | 'year';

interface Bounds {
  start: Date;
  end: Date; // exclusive
  shortLabel: string;
  fullLabel: string;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

const monthBounds = (year: number, month: number): Bounds => ({
  start: new Date(year, month, 1),
  end: new Date(year, month + 1, 1),
  shortLabel: `${MONTH_SHORT[month]} ${year}`,
  fullLabel: `${MONTH_NAMES[month]} ${year}`,
});
const quarterBounds = (year: number, q: number): Bounds => ({
  start: new Date(year, q * 3, 1),
  end: new Date(year, q * 3 + 3, 1),
  shortLabel: `Q${q + 1} ${year}`,
  fullLabel: `Q${q + 1} ${year}`,
});
const yearBounds = (year: number, toDate: boolean): Bounds => ({
  start: new Date(year, 0, 1),
  end: new Date(year + 1, 0, 1),
  shortLabel: String(year),
  fullLabel: toDate ? `${year} to date` : String(year),
});

const periodBounds = (kind: PeriodKind, offset: number, now: Date): Bounds => {
  if (kind === 'month') {
    const total = now.getFullYear() * 12 + now.getMonth() - offset;
    return monthBounds(Math.floor(total / 12), ((total % 12) + 12) % 12);
  }
  if (kind === 'quarter') {
    const curQ = Math.floor(now.getMonth() / 3);
    const total = now.getFullYear() * 4 + curQ - offset;
    return quarterBounds(Math.floor(total / 4), ((total % 4) + 4) % 4);
  }
  return yearBounds(now.getFullYear() - offset, offset === 0);
};

/** Same period, one year earlier. For 'year' this is identical to the previous period. */
const lastYearBounds = (kind: PeriodKind, offset: number, now: Date): Bounds => {
  if (kind === 'year') return periodBounds('year', offset + 1, now);
  if (kind === 'month') {
    const total = now.getFullYear() * 12 + now.getMonth() - offset - 12;
    return monthBounds(Math.floor(total / 12), ((total % 12) + 12) % 12);
  }
  const curQ = Math.floor(now.getMonth() / 3);
  const total = now.getFullYear() * 4 + curQ - offset - 4;
  return quarterBounds(Math.floor(total / 4), ((total % 4) + 4) % 4);
};

/** Local-date bucketing: date-only strings are local days, UTC timestamps are converted first. */
const inBounds = (dateStr: string | undefined, b: Bounds): boolean => inRange(dateStr, b.start, b.end);

/* ----------------------------- P&L aggregation ----------------------------- */

interface PeriodAgg {
  feesCollected: number;
  /** Office receipts not tied to an invoice (e.g. proforma / advance fees), as Finance Home counts them. */
  otherIncome: number;
  staffCost: number;
  overheadByCategory: Map<string, number>;
  overheadTotal: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const emptyAgg = (): PeriodAgg => ({
  feesCollected: 0,
  otherIncome: 0,
  staffCost: 0,
  overheadByCategory: new Map(),
  overheadTotal: 0,
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
});

/* ----------------------------- component ----------------------------- */

const FinanceTab: React.FC = () => {
  const { invoices, payments, receipts, expenses, payslips, paymentVouchers, travelClaims, bankAccounts, timeEntries, cases, retainers, programmes, setCurrentView } = useApp();

  const now = useMemo(() => new Date(), []);

  const [perKind, setPerKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const [cm, setCm] = useState<'Monthly' | 'Annual'>('Monthly');

  // Firm-maintained settings (sinking funds & commitments) — same get/save pattern as every
  // other PracticeSettings-backed screen (PracticeSettingsView.tsx, QuotationsView.tsx, ...).
  const [settingsVersion, setSettingsVersion] = useState(0);
  const settings = useMemo(() => getPracticeSettings(), [settingsVersion]);
  const funds = settings.sinkingFunds || [];
  const commits = settings.commitments || [];

  useEffect(() => {
    const onUpdate = () => setSettingsVersion((v) => v + 1);
    window.addEventListener('shco-practice-settings-updated', onUpdate);
    return () => window.removeEventListener('shco-practice-settings-updated', onUpdate);
  }, []);

  const persistFunds = (next: SinkingFund[]) => savePracticeSettings({ ...getPracticeSettings(), sinkingFunds: next });
  const persistCommits = (next: Commitment[]) => savePracticeSettings({ ...getPracticeSettings(), commitments: next });

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  const paidForInvoice = useMemo(() => paidByInvoice(payments), [payments]);
  const moneyIn = useMemo(() => moneyInEvents(invoices, payments), [invoices, payments]);
  const findCase = useMemo(() => caseFinder(cases), [cases]);

  /* --- P&L aggregation for an arbitrary bounds window --- */
  const computeAgg = React.useCallback(
    (b: Bounds): PeriodAgg => {
      const agg = emptyAgg();
      const addOverhead = (cat: string, amt: number) => agg.overheadByCategory.set(cat, (agg.overheadByCategory.get(cat) || 0) + amt);
      moneyIn.forEach((p) => {
        if (!inBounds(p.date, b)) return;
        const inv = invoiceById.get(p.invoiceId);
        if (inv) agg.feesCollected += feeIncomeOfPayment(p.amount, inv);
      });
      receipts.forEach((r) => {
        if (r.accountSet === 'CLIENT' || r.invoiceId || !inBounds(r.date, b)) return;
        agg.otherIncome += Number(r.amount || 0);
      });
      // Payroll cost for the period the payslip is for (gross + employer EPF + SOCSO/EIS).
      payslips.forEach((p) => {
        if (!payslipCounts(p) || !inBounds(`${p.period}-01`, b)) return;
        agg.staffCost += payslipCost(p);
      });
      expenses.forEach((e) => {
        if (!isOfficeExpense(e) || !inBounds(officeExpenseDate(e), b)) return;
        if (SALARY_CAT.test(e.category || '')) agg.staffCost += Number(e.amount || 0);
        else addOverhead(e.category || 'Other costs', Number(e.amount || 0));
      });
      paymentVouchers.forEach((v) => {
        if (!isOverheadVoucher(v) || !inBounds(v.paidAt, b)) return;
        addOverhead(v.voucherCategory === 'Office Operating' ? 'Office bills (payment vouchers)' : 'Other payment vouchers', Number(v.amount || 0));
      });
      travelClaims.forEach((t) => {
        if (!isPaidClaim(t) || !inBounds(t.paidAt, b)) return;
        addOverhead('Staff travel claims', Number(t.total || 0));
      });
      agg.overheadTotal = [...agg.overheadByCategory.values()].reduce((s, v) => s + v, 0);
      agg.totalIncome = agg.feesCollected + agg.otherIncome;
      agg.totalExpense = agg.staffCost + agg.overheadTotal;
      agg.netProfit = agg.totalIncome - agg.totalExpense;
      return agg;
    },
    [moneyIn, invoiceById, receipts, payslips, expenses, paymentVouchers, travelClaims]
  );

  const curBounds = useMemo(() => periodBounds(perKind, offset, now), [perKind, offset, now]);
  const prevBounds = useMemo(() => periodBounds(perKind, offset + 1, now), [perKind, offset, now]);
  const lyBounds = useMemo(() => lastYearBounds(perKind, offset, now), [perKind, offset, now]);

  const cur = useMemo(() => computeAgg(curBounds), [computeAgg, curBounds]);
  const prev = useMemo(() => computeAgg(prevBounds), [computeAgg, prevBounds]);
  const ly = useMemo(() => computeAgg(lyBounds), [computeAgg, lyBounds]);

  const margin = (agg: PeriodAgg) => (agg.totalIncome > 0 ? Math.round((agg.netProfit / agg.totalIncome) * 100) : 0);
  const marginLabel = (agg: PeriodAgg) => (agg.totalIncome > 0 ? `${margin(agg)}%` : '—');
  /** Margin change in points; "—" when either period has no income (no margin to compare). */
  const marginDelta = (a: PeriodAgg, b: PeriodAgg) => {
    if (!(a.totalIncome > 0) || !(b.totalIncome > 0)) return '—';
    const d = margin(a) - margin(b);
    return `${d >= 0 ? '+' : ''}${d} pts`;
  };

  /* --- Profit & loss table rows --- */
  const overheadRows = useMemo(() => {
    const allCats = new Set<string>([...cur.overheadByCategory.keys(), ...prev.overheadByCategory.keys(), ...ly.overheadByCategory.keys()]);
    const sorted = [...allCats].sort((a, b) => (cur.overheadByCategory.get(b) || 0) - (cur.overheadByCategory.get(a) || 0));
    const MAX_ROWS = 6;
    const top = sorted.slice(0, MAX_ROWS);
    const rest = sorted.slice(MAX_ROWS);
    const rows = top.map((cat) => ({
      label: cat,
      t: cur.overheadByCategory.get(cat) || 0,
      p: prev.overheadByCategory.get(cat) || 0,
      l: ly.overheadByCategory.get(cat) || 0,
    }));
    if (rest.length) {
      const sum = (m: Map<string, number>) => rest.reduce((s, c) => s + (m.get(c) || 0), 0);
      rows.push({ label: 'Other overhead', t: sum(cur.overheadByCategory), p: sum(prev.overheadByCategory), l: sum(ly.overheadByCategory) });
    }
    return rows;
  }, [cur, prev, ly]);

  interface PlRow {
    label: string;
    t: number | null;
    p: number | null;
    l: number | null;
    kind: 'head' | 'row' | 'total' | 'net';
    cost?: boolean;
  }

  const plRows: PlRow[] = useMemo(
    () => [
      { label: 'Income', t: null, p: null, l: null, kind: 'head' },
      { label: 'Fee income collected (fees + reimbursements, excl. SST)', t: cur.feesCollected, p: prev.feesCollected, l: ly.feesCollected, kind: 'row' },
      { label: 'Other office receipts (not against an invoice)', t: cur.otherIncome, p: prev.otherIncome, l: ly.otherIncome, kind: 'row' },
      { label: 'Total income', t: cur.totalIncome, p: prev.totalIncome, l: ly.totalIncome, kind: 'total' },
      { label: 'Expenses', t: null, p: null, l: null, kind: 'head' },
      { label: 'Staff cost (payroll incl. employer EPF/SOCSO/EIS)', t: -cur.staffCost, p: -prev.staffCost, l: -ly.staffCost, kind: 'row', cost: true },
      ...overheadRows.map((r) => ({ label: r.label, t: -r.t, p: -r.p, l: -r.l, kind: 'row' as const, cost: true })),
      { label: 'Total expenses', t: -cur.totalExpense, p: -prev.totalExpense, l: -ly.totalExpense, kind: 'total', cost: true },
      { label: 'Net profit', t: cur.netProfit, p: prev.netProfit, l: ly.netProfit, kind: 'net' },
    ],
    [cur, prev, ly, overheadRows]
  );

  /* --- Net profit by month chart (12 months of current vs prior calendar year) --- */
  // Fixed costs per month = monthly commitments + annual commitments ÷ 12.
  const monthlyCommitTotal = useMemo(() => monthlyFixedCost(commits), [commits]);

  const monthChart = useMemo(() => {
    const year = now.getFullYear();
    const curMonthIdx = now.getMonth();
    const rows = MONTH_SHORT.map((label, i) => {
      const isFuture = i > curMonthIdx;
      let value: number;
      if (!isFuture) {
        value = computeAgg(monthBounds(year, i)).netProfit;
      } else {
        // Real, derived "forecast": issued invoices' owed balance (after payments and
        // write-offs) due that month, less fixed costs per month — never a fabricated number.
        const dueThisMonth = invoices
          .filter((inv) => isIssued(inv))
          .filter((inv) => inBounds(inv.dueDate, monthBounds(year, i)))
          .reduce((s, inv) => s + owedBalance(inv, paidForInvoice.get(inv.id) || 0), 0);
        value = dueThisMonth - monthlyCommitTotal;
      }
      const priorValue = computeAgg(monthBounds(year - 1, i)).netProfit;
      return { label, value, priorValue, isFuture };
    });
    const maxAbs = Math.max(1, ...rows.map((r) => Math.max(Math.abs(r.value), Math.abs(r.priorValue))));
    return { rows, maxAbs, curMonthIdx };
  }, [now, computeAgg, invoices, paidForInvoice, monthlyCommitTotal]);

  /* --- Money position today --- */
  // Office cash: the same "Office bank" figure Finance Home shows (office bank accounts'
  // current balance). officeBuckets is never populated, so it is not used.
  const officeBanks = useMemo(() => (bankAccounts || []).filter((b) => b.status !== 'Archived' && !(b.functions || []).includes('Petty Cash') && !(b.functions || []).includes('Disbursement') && !(b.type === 'Trust' || (b.functions || []).includes('Trust Account'))), [bankAccounts]);
  const officeAccountBalance = useMemo(() => officeCash(bankAccounts || []), [bankAccounts]);

  const unpaidInvoicesInfo = useMemo(() => {
    let total = 0;
    let over60 = 0;
    let n = 0;
    invoices.forEach((inv) => {
      if (!isIssued(inv)) return;
      const balance = owedBalance(inv, paidForInvoice.get(inv.id) || 0);
      if (balance <= 0.005) return;
      total += balance;
      n++;
      const t = parseLocal(inv.dueDate || inv.date);
      const days = t ? Math.floor((Date.now() - t) / 86400000) : 0;
      if (days > 60) over60 += balance;
    });
    return { total, n, over60Pct: total > 0 ? Math.round((over60 / total) * 100) : 0 };
  }, [invoices, paidForInvoice]);

  const wip = useMemo(() => {
    const activities = timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff).reduce((s, t) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);
    const disb = expenses.filter((e) => e.billable && !e.billed && !e.writtenOff).reduce((s, e) => s + Number(e.amount || 0), 0);
    const files = new Set([
      ...timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff).map((t) => findCase(t.caseId)?.id || t.caseId),
      ...expenses.filter((e) => e.billable && !e.billed && !e.writtenOff).map((e) => findCase(e.caseId, e.fileRef)?.id || e.caseId || e.fileRef),
    ]).size;
    return { total: activities + disb, files };
  }, [timeEntries, expenses, findCase]);

  const clientAccountBalance = useMemo(() => retainers.reduce((s, r) => s + (r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0), [retainers]);

  const position = [
    officeAccountBalance == null
      ? { label: 'Office account', note: 'no office bank account set up · see Accounts & Finance → Office Account', amt: 'See Office Account', c: SLATE }
      : { label: 'Office account', note: `${officeBanks.map((b) => b.bankName).join(' + ')} · covers ${runwayLabel(officeAccountBalance, commits)} of fixed costs`, amt: fmtFull(officeAccountBalance), c: GREEN },
    { label: 'Unpaid invoices', note: `${unpaidInvoicesInfo.n} issued invoice${unpaidInvoicesInfo.n === 1 ? '' : 's'} · ${unpaidInvoicesInfo.over60Pct}% over 60 days past due`, amt: fmtFull(unpaidInvoicesInfo.total), c: RED },
    { label: 'Work not billed yet', note: `time & disbursements recorded, no invoice · ${wip.files} file${wip.files === 1 ? '' : 's'}`, amt: fmtFull(wip.total), c: GOLD },
    { label: 'Client account', note: `${retainers.length} entries · trust balance`, amt: fmtFull(clientAccountBalance), c: NAVY },
  ];

  /* --- Cash reserve & sinking funds handlers --- */
  const updateFund = (id: string, patch: Partial<SinkingFund>) => persistFunds(funds.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addFund = () => persistFunds([...funds, { id: `fund-${Date.now()}`, name: 'New fund', target: 0, monthly: 0, balance: 0 }]);
  const deleteFund = (id: string) => persistFunds(funds.filter((f) => f.id !== id));

  const reserveTotal = funds.reduce((s, f) => s + Number(f.balance || 0), 0);
  const operatingFund = funds[0];
  const runway = operatingFund ? runwayLabel(Number(operatingFund.balance || 0), commits) : '—';

  /* --- Commitments handlers --- */
  const filteredCommits = commits.filter((c) => c.frequency === cm);
  const updateCommit = (id: string, patch: Partial<Commitment>) => persistCommits(commits.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addCommit = () => persistCommits([...commits, { id: `commit-${Date.now()}`, name: 'New item', amount: 0, due: '', paid: false, frequency: cm }]);
  const deleteCommit = (id: string) => persistCommits(commits.filter((c) => c.id !== id));
  const cmTotal = filteredCommits.reduce((s, c) => s + Number(c.amount || 0), 0);
  const cmPaidCount = filteredCommits.filter((c) => c.paid).length;

  /* --- Profit by practice area / file / programme (year to date) --- */
  const ytdBounds = useMemo(() => yearBounds(now.getFullYear(), true), [now]);

  const caseProfits = useMemo(() => {
    // Invoices match a file by caseId (id or ref) or fileRef.
    const invByCase = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      if (inv.status === 'Voided') return;
      const k = findCase(inv.caseId, inv.fileRef);
      if (!k) return;
      const arr = invByCase.get(k.id) || [];
      arr.push(inv);
      invByCase.set(k.id, arr);
    });
    return cases
      .map((c) => {
        const invs = new Map((invByCase.get(c.id) || []).map((i) => [i.id, i] as [string, Invoice]));
        // Fee income (fees + reimbursements, excl. SST and disbursements).
        const fees = moneyIn.filter((p) => invs.has(p.invoiceId) && inBounds(p.date, ytdBounds)).reduce((s, p) => s + feeIncomeOfPayment(p.amount, invs.get(p.invoiceId)), 0);
        // Billable time at charge-out rate — the same basis as Dashboard → Direction. Client
        // disbursements are recovered and excluded from fees, so they are excluded from cost too.
        const timeCost = timeEntries.filter((t) => t.billable && findCase(t.caseId)?.id === c.id && inBounds(t.date, ytdBounds)).reduce((s, t) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);
        const cost = timeCost;
        const profit = fees - cost;
        const margin2 = fees > 0 ? Math.round((profit / fees) * 100) : cost > 0 ? -100 : 0;
        return {
          id: c.id,
          name: `${c.ref}${c.title ? ' · ' + c.title : ''}`,
          practiceArea: c.practiceArea || c.type || 'Unclassified',
          fees,
          profit,
          margin: margin2,
        };
      })
      .filter((cp) => cp.fees > 0 || cp.profit !== 0);
  }, [cases, invoices, moneyIn, timeEntries, findCase, ytdBounds]);

  const areaProfits = useMemo(() => {
    const map = new Map<string, { fees: number; profit: number }>();
    caseProfits.forEach((cp) => {
      const g = map.get(cp.practiceArea) || { fees: 0, profit: 0 };
      g.fees += cp.fees;
      g.profit += cp.profit;
      map.set(cp.practiceArea, g);
    });
    return [...map.entries()]
      .map(([name, v]) => ({ name, profit: v.profit, margin: v.fees > 0 ? Math.round((v.profit / v.fees) * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [caseProfits]);

  const fileProfits = useMemo(() => {
    const sorted = [...caseProfits].sort((a, b) => b.profit - a.profit);
    if (sorted.length <= 6) return sorted;
    return [...sorted.slice(0, 3), ...sorted.slice(-3)];
  }, [caseProfits]);

  const profitCards = [
    { title: 'Profit by practice area', sub: 'year to date', col: 'Area', rows: areaProfits, foot: 'Profit = fee income collected (excl. SST & disbursements) − billable time at charge-out rate. Margin = profit ÷ fee income.' },
    { title: 'Profit by file', sub: 'best & worst this year', col: 'File', rows: fileProfits.map((r) => ({ name: r.name, profit: r.profit, margin: r.margin })), foot: 'Year to date · same calculation, per matter.' },
    {
      title: 'Profit by programme',
      sub: 'seminars & talks',
      col: 'Programme',
      rows: programmes.map((p) => ({ name: `${p.title} (${p.date ? p.date.slice(0, 7) : '—'})`, profit: null as number | null, margin: null as number | null })),
      foot: programmes.length === 0 ? 'No programmes recorded yet.' : 'Profit tracking needs files linked to a programme, which isn’t recorded yet — showing programmes only.',
    },
  ];

  /* ----------------------------- render helpers ----------------------------- */

  const cardStyle: React.CSSProperties = { borderRadius: 12, border: `1px solid ${palette.border}`, background: '#fff', overflow: 'hidden' };
  const headStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #EEF1F5' };
  const titleStyle: React.CSSProperties = { fontFamily: serifFont, fontSize: 14.5, color: NAVY, fontWeight: 700 };

  /** Profit & loss as a printable page (the browser's print dialog saves it as PDF). */
  const exportPdf = () => {
    const cell = (v: number | null, bold = false) => `<td style="text-align:right;padding:4px 8px;${bold ? 'font-weight:700' : ''}">${v == null ? '' : esc(fmtFull(v))}</td>`;
    const body = plRows
      .map((r) =>
        r.kind === 'head'
          ? `<tr><td colspan="4" style="padding:10px 8px 2px;font-size:8.5pt;font-weight:700;text-transform:uppercase;color:#5B6478">${esc(r.label)}</td></tr>`
          : `<tr style="${r.kind === 'row' ? '' : 'border-top:1px solid #DDE3EB'}"><td style="padding:4px 8px;${r.kind === 'row' ? 'padding-left:18px' : 'font-weight:700'}">${esc(r.label)}</td>${cell(r.t, r.kind !== 'row')}${cell(r.p)}${cell(r.l)}</tr>`
      )
      .join('');
    printHtml(
      'Profit and loss ' + curBounds.fullLabel,
      `<div style="font-family:Georgia,serif;color:#16223A"><h2 style="margin:0 0 4px">Profit &amp; loss · ${esc(curBounds.fullLabel)}</h2><p style="margin:0 0 12px;font-size:9pt;color:#5B6478">Compared with ${esc(prevBounds.shortLabel)} and ${esc(lyBounds.shortLabel)} · printed ${esc(new Date().toLocaleDateString('en-GB'))}</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:10pt"><tr style="font-size:8.5pt;color:#5B6478"><th></th><th style="text-align:right;padding:4px 8px">${esc(curBounds.shortLabel)}</th><th style="text-align:right;padding:4px 8px">${esc(prevBounds.shortLabel)}</th><th style="text-align:right;padding:4px 8px">${esc(lyBounds.shortLabel)}</th></tr>${body}</table></div>`
    );
  };

  const deltaColor = (curV: number, otherV: number, higherIsGood: boolean) => (curV >= otherV === higherIsGood ? GREEN : RED);

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-[7px] p-0.5" style={{ background: '#E3E7EC' }}>
          {(['month', 'quarter', 'year'] as PeriodKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPerKind(k);
                setOffset(0);
              }}
              className="rounded-[5px] px-3 py-1.5 text-[11.5px] font-bold"
              style={{ background: perKind === k ? '#fff' : 'transparent', color: perKind === k ? NAVY : SLATE, boxShadow: perKind === k ? '0 1px 2px rgba(22,34,58,.12)' : 'none' }}
            >
              {k === 'month' ? 'Month' : k === 'quarter' ? 'Quarter' : 'Year'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOffset((o) => o + 1)} className="h-7 w-7 rounded-md" style={{ border: `1px solid ${palette.border}`, background: '#fff', color: NAVY }}>
          ‹
        </button>
        <strong className="min-w-[150px] text-center" style={{ fontFamily: serifFont, fontSize: 17, color: NAVY }}>
          {curBounds.fullLabel}
        </strong>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          className="h-7 w-7 rounded-md"
          style={{ border: `1px solid ${palette.border}`, background: '#fff', color: NAVY, opacity: offset === 0 ? 0.35 : 1 }}
        >
          ›
        </button>
        <span className="text-[10.5px]" style={{ color: SLATE }}>
          compared with {prevBounds.shortLabel} and {lyBounds.shortLabel}
        </span>
        <span className="ml-auto text-[10.5px]" style={{ color: SLATE }}>
          From Accounts &amp; Compliance ·{' '}
          <button type="button" onClick={() => setCurrentView('accountingCentre')} className="font-semibold" style={{ color: '#3D6B9C' }}>open full accounts -&gt;</button>
        </span>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Income', v: cur.totalIncome, p: prev.totalIncome, l: ly.totalIncome, vc: NAVY, higherGood: true },
          { label: 'Expenses', v: cur.totalExpense, p: prev.totalExpense, l: ly.totalExpense, vc: NAVY, higherGood: false },
          { label: 'Net profit', v: cur.netProfit, p: prev.netProfit, l: ly.netProfit, vc: GREEN, higherGood: true },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1.5" style={{ ...cardStyle, padding: '14px 16px' }}>
            <span className="text-[9.5px] font-bold uppercase tracking-[.1em]" style={{ color: SLATE }}>{k.label}</span>
            <span style={{ fontFamily: serifFont, fontSize: 24, fontWeight: 700, color: k.vc, lineHeight: 1.1 }}>{fmtK(k.label === 'Expenses' ? -k.v : k.v)}</span>
            <span className="flex gap-2.5 whitespace-nowrap text-[10.5px]" style={{ color: SLATE }}>
              <span>vs prev <strong style={{ color: deltaColor(k.v, k.p, k.higherGood) }}>{pctChange(k.v, k.p)}</strong></span>
              <span>vs last yr <strong style={{ color: deltaColor(k.v, k.l, k.higherGood) }}>{pctChange(k.v, k.l)}</strong></span>
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-1.5" style={{ ...cardStyle, padding: '14px 16px' }}>
          <span className="text-[9.5px] font-bold uppercase tracking-[.1em]" style={{ color: SLATE }}>Profit margin</span>
          <span style={{ fontFamily: serifFont, fontSize: 24, fontWeight: 700, color: GREEN, lineHeight: 1.1 }}>{marginLabel(cur)}</span>
          <span className="flex gap-2.5 whitespace-nowrap text-[10.5px]" style={{ color: SLATE }}>
            <span>vs prev <strong style={{ color: deltaColor(margin(cur), margin(prev), true) }}>{marginDelta(cur, prev)}</strong></span>
            <span>vs last yr <strong style={{ color: deltaColor(margin(cur), margin(ly), true) }}>{marginDelta(cur, ly)}</strong></span>
          </span>
        </div>
      </section>

      {/* P&L table + Net profit chart / Money position */}
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div style={cardStyle}>
          <div style={headStyle}>
            <span style={titleStyle}>Profit &amp; loss</span>
            <span className="text-[10.5px]" style={{ color: SLATE }}>{curBounds.shortLabel}</span>
            <button type="button" onClick={exportPdf} className="ml-auto rounded-md px-[9px] py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${palette.border}`, background: '#fff', color: NAVY }}>Export PDF</button>
          </div>
          <div
            className="grid gap-3 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.08em]"
            style={{ gridTemplateColumns: 'minmax(0,1fr) 100px 100px 100px 80px', color: SLATE, background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}
          >
            <span />
            <span className="text-right">{curBounds.shortLabel}</span>
            <span className="text-right">{prevBounds.shortLabel}</span>
            <span className="text-right">{lyBounds.shortLabel}</span>
            <span className="text-right">vs last yr</span>
          </div>
          {plRows.map((r, i) => {
            if (r.kind === 'head') {
              return (
                <div key={i} className="px-3.5 pb-0.5 pt-2 text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: SLATE, borderTop: i ? '1px solid #F0F2F5' : undefined }}>
                  {r.label}
                </div>
              );
            }
            const isTotal = r.kind === 'total' || r.kind === 'net';
            const delta = pctChange(r.cost ? Math.abs(r.t || 0) : r.t || 0, r.cost ? Math.abs(r.l || 0) : r.l || 0);
            const dColor = r.l ? deltaColor(r.cost ? -(r.t || 0) : r.t || 0, r.cost ? -r.l : r.l, true) : SLATE;
            return (
              <div
                key={i}
                className="grid items-center gap-3 px-3.5"
                style={{
                  gridTemplateColumns: 'minmax(0,1fr) 100px 100px 100px 80px',
                  padding: isTotal ? '9px 14px' : '6px 14px',
                  borderTop: isTotal ? `1px solid ${palette.border}` : 'none',
                  background: r.kind === 'net' ? '#EEF5F0' : '#fff',
                }}
              >
                <span style={{ fontSize: isTotal ? 12 : 11.5, fontWeight: isTotal ? 800 : 400, color: NAVY, paddingLeft: isTotal ? 0 : 10 }}>{r.label}</span>
                <span className="text-right" style={{ fontSize: 12, fontWeight: isTotal ? 800 : 400, color: r.kind === 'net' ? GREEN : NAVY }}>{fmtK(r.t || 0)}</span>
                <span className="text-right text-[11.5px]" style={{ color: SLATE }}>{fmtK(r.p || 0)}</span>
                <span className="text-right text-[11.5px]" style={{ color: SLATE }}>{fmtK(r.l || 0)}</span>
                <span className="text-right text-[11px] font-bold" style={{ color: dColor }}>{delta}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          {/* Net profit by month */}
          <div style={cardStyle}>
            <div style={headStyle}>
              <span style={titleStyle}>Net profit by month</span>
              <span className="ml-auto flex gap-2.5 text-[10px]" style={{ color: SLATE }}>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: GREEN }} />{now.getFullYear()}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: '#C9D3E0' }} />{now.getFullYear() - 1}</span>
              </span>
            </div>
            <div className="grid items-end gap-1.5 px-3.5 pb-1.5 pt-3" style={{ gridTemplateColumns: 'repeat(12,minmax(0,1fr))', height: 150 }}>
              {monthChart.rows.map((m, i) => {
                const h = Math.max(2, Math.round((Math.max(0, m.value) / monthChart.maxAbs) * 110));
                const lh = Math.max(2, Math.round((Math.max(0, m.priorValue) / monthChart.maxAbs) * 110));
                return (
                  <div key={m.label} className="flex flex-col items-center gap-1">
                    <div className="flex w-full items-end gap-0.5" style={{ height: 110 }}>
                      <span className="flex-1 rounded-t-sm" style={{ background: '#C9D3E0', height: lh }} />
                      <span className="flex-1 rounded-t-sm" style={{ background: m.isFuture ? '#A7CDB6' : GREEN, height: h }} />
                    </div>
                    <span className="text-[9.5px]" style={{ color: i === monthChart.curMonthIdx ? NAVY : SLATE, fontWeight: i === monthChart.curMonthIdx ? 700 : 400 }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-3.5 py-2 text-[10.5px]" style={{ background: '#F6F8FA', borderTop: '1px solid #EEF1F5', color: SLATE }}>
              {MONTH_SHORT[monthChart.curMonthIdx + 1] ? `${MONTH_SHORT[monthChart.curMonthIdx + 1]}–${MONTH_SHORT[11]} ${now.getFullYear()}` : 'Remaining months'} shows a forecast (lighter bars), from invoices due and fixed monthly commitments.
            </div>
          </div>

          {/* Money position today */}
          <div style={cardStyle}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
              <span style={titleStyle}>Money position today</span>
            </div>
            {position.map((p, i) => (
              <div key={p.label} className="flex items-center gap-2 px-3.5 py-2" style={{ borderTop: i ? '1px solid #F0F2F5' : 'none' }}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px]" style={{ color: NAVY }}>{p.label}</span>
                  <span className="block text-[10px]" style={{ color: SLATE }}>{p.note}</span>
                </span>
                <strong className="text-[12.5px]" style={{ color: p.c }}>{p.amt}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cash reserve & sinking funds / Commitments */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div style={cardStyle}>
          <div style={headStyle}>
            <span style={titleStyle}>Cash reserve &amp; sinking funds</span>
            <span className="text-[10.5px]" style={{ color: SLATE }}>office account</span>
            <span className="ml-auto text-[12px] font-extrabold" style={{ color: GREEN }}>{fmtFull(reserveTotal)}</span>
          </div>
          <div className="grid gap-2 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ gridTemplateColumns: 'minmax(0,1.6fr) 80px 70px 80px 100px 20px', color: SLATE, background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Fund</span><span className="text-right">Target</span><span className="text-right">Monthly</span><span className="text-right">Balance</span><span>Progress</span><span />
          </div>
          {funds.length === 0 && (
            <div className="px-3.5 py-4 text-center text-[11px]" style={{ color: SLATE }}>No reserve funds set up yet. Add one below.</div>
          )}
          {funds.map((f) => {
            const { pct, label: eta } = fundProgress(f);
            const color = !(Number(f.target) > 0) ? '#C9D3E0' : pct >= 75 ? GREEN : pct >= 40 ? '#C9A86A' : '#B2542F';
            return (
              <div key={f.id} className="grid items-center gap-2 px-3.5 py-1.5" style={{ gridTemplateColumns: 'minmax(0,1.6fr) 80px 70px 80px 100px 20px', borderBottom: '1px solid #F0F2F5' }}>
                <input value={f.name} onChange={(e) => updateFund(f.id, { name: e.target.value })} className="w-full rounded-[5px] px-1.5 py-1 text-[11px] font-semibold" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
                <input type="number" value={f.target} onChange={(e) => updateFund(f.id, { target: Number(e.target.value) })} className="w-full rounded-[5px] px-1.5 py-1 text-right text-[11px]" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
                <input type="number" value={f.monthly} onChange={(e) => updateFund(f.id, { monthly: Number(e.target.value) })} className="w-full rounded-[5px] px-1.5 py-1 text-right text-[11px]" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
                <input type="number" value={f.balance} onChange={(e) => updateFund(f.id, { balance: Number(e.target.value) })} className="w-full rounded-[5px] px-1.5 py-1 text-right text-[11px] font-bold" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
                <span className="flex flex-col gap-0.5">
                  <span className="block h-1.5 rounded-[3px]" style={{ background: '#EEF1F5' }}>
                    <span className="block h-1.5 rounded-[3px]" style={{ background: color, width: `${pct}%` }} />
                  </span>
                  <span className="text-[9.5px]" style={{ color: SLATE }}>{eta}</span>
                </span>
                <button type="button" onClick={() => deleteFund(f.id)} title="Remove" className="text-[12px]" style={{ color: '#94A3B8' }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <div className="flex items-center gap-2.5 px-3.5 py-2" style={{ background: '#F6F8FA' }}>
            <button type="button" onClick={addFund} className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#8A6D3B' }}>
              <Plus className="h-3 w-3" /> Add fund
            </button>
            <span className="ml-auto text-[10.5px]" style={{ color: SLATE }}>
              Operating cash {operatingFund ? fmtFull(operatingFund.balance) : '—'} · covers <strong style={{ color: NAVY }}>{runway}</strong> of fixed costs
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={headStyle}>
            <span style={titleStyle}>Commitments</span>
            <span className="text-[10.5px]" style={{ color: SLATE }}>fixed costs you must pay</span>
            <div className="ml-auto flex rounded-md p-0.5" style={{ background: '#F0F2F5' }}>
              {(['Monthly', 'Annual'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setCm(s)} className="rounded px-2.5 py-1 text-[10.5px] font-bold" style={{ background: cm === s ? '#fff' : 'transparent', color: cm === s ? NAVY : SLATE }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ gridTemplateColumns: 'minmax(0,1.3fr) 86px 90px 70px 20px', color: SLATE, background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Item</span><span className="text-right">Amount</span><span>Due</span><span>Paid</span><span />
          </div>
          {filteredCommits.length === 0 && (
            <div className="px-3.5 py-4 text-center text-[11px]" style={{ color: SLATE }}>No {cm.toLowerCase()} commitments recorded yet. Add one below.</div>
          )}
          {filteredCommits.map((c) => (
            <div key={c.id} className="grid items-center gap-2 px-3.5 py-1.5" style={{ gridTemplateColumns: 'minmax(0,1.3fr) 86px 90px 70px 20px', borderBottom: '1px solid #F0F2F5' }}>
              <input value={c.name} onChange={(e) => updateCommit(c.id, { name: e.target.value })} className="w-full rounded-[5px] px-1.5 py-1 text-[11px]" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
              <input type="number" value={c.amount} onChange={(e) => updateCommit(c.id, { amount: Number(e.target.value) })} className="w-full rounded-[5px] px-1.5 py-1 text-right text-[11px]" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
              <input value={c.due} onChange={(e) => updateCommit(c.id, { due: e.target.value })} className="w-full rounded-[5px] px-1.5 py-1 text-[11px]" style={{ border: '1px solid #E3E7EC', color: NAVY }} />
              <button
                type="button"
                onClick={() => updateCommit(c.id, { paid: !c.paid })}
                className="justify-self-start rounded-[10px] px-2 py-0.5 text-[10px] font-bold"
                style={{ border: `1px solid ${c.paid ? '#CFE3D6' : '#EBD9BF'}`, background: c.paid ? tint.green : tint.gold, color: c.paid ? GREEN : GOLD }}
              >
                {c.paid ? '✓ Paid' : 'Due'}
              </button>
              <button type="button" onClick={() => deleteCommit(c.id)} title="Remove" style={{ color: '#94A3B8' }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2.5 px-3.5 py-2" style={{ background: '#F6F8FA' }}>
            <button type="button" onClick={addCommit} className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#8A6D3B' }}>
              <Plus className="h-3 w-3" /> Add commitment
            </button>
            <span className="ml-auto text-[10.5px]" style={{ color: SLATE }}>
              Total <strong style={{ color: NAVY }}>{fmtFull(cmTotal)}{cm === 'Monthly' ? ' / month' : ' / year'}</strong> · {cmPaidCount} of {filteredCommits.length} paid
            </span>
          </div>
        </div>
      </section>

      {/* Profit by X cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {profitCards.map((card) => (
          <div key={card.title} style={cardStyle}>
            <div style={headStyle}>
              <span style={titleStyle}>{card.title}</span>
              <span className="text-[10.5px]" style={{ color: SLATE }}>{card.sub}</span>
            </div>
            <div className="grid gap-2 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 64px', color: SLATE, background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
              <span>{card.col}</span><span className="text-right">Profit</span><span className="text-right">Margin</span>
            </div>
            {card.rows.length === 0 && (
              <div className="px-3.5 py-4 text-center text-[11px]" style={{ color: SLATE }}>No data recorded yet.</div>
            )}
            {card.rows.map((r, i) => {
              const c = r.profit == null ? SLATE : r.profit < 0 ? RED : (r.margin ?? 0) >= 35 ? GREEN : NAVY;
              return (
                <div key={i} className="grid items-center gap-2 px-3.5 py-1.5" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 64px', borderBottom: '1px solid #F0F2F5' }}>
                  <span className="min-w-0 truncate text-[11.5px] font-semibold" style={{ color: NAVY }}>{r.name}</span>
                  <span className="text-right text-[11.5px] font-bold" style={{ color: c }}>{r.profit == null ? '—' : fmtK(r.profit)}</span>
                  <span className="text-right text-[11px] font-bold" style={{ color: c }}>{r.margin == null ? '—' : `${r.margin}%`}</span>
                </div>
              );
            })}
            <div className="px-3.5 py-2 text-[10px]" style={{ background: '#F6F8FA', color: SLATE }}>{card.foot}</div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default FinanceTab;
