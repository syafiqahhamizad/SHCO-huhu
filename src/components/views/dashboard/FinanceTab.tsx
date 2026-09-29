import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { palette, tint, serifFont } from '../../../lib/designTokens';
import {
  getPracticeSettings,
  savePracticeSettings,
  type SinkingFund,
  type Commitment,
} from '../../../services/templateService';
import type { Invoice, QuotationLineItem } from '../../../types';
import { Plus, X } from 'lucide-react';

/**
 * "Finance" sub-tab of My Dashboard, Managing Partner only. Replicates the moneyFirm block
 * of design/My Dashboard.dc.html (lines ~57-151) exactly: period selector, 4 P&L KPI cards,
 * a Profit & loss table, a Net-profit-by-month chart, "Money position today", "Cash reserve
 * & sinking funds" (editable), "Commitments" (editable), and 3 "Profit by X" cards.
 *
 * Every figure is derived from real useApp() data (invoices, payments, expenses, timeEntries,
 * cases, officeBuckets, retainers, programmes) — nothing here is sample/fabricated. The two
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

const pctChange = (a: number, b: number): string => {
  if (!b) return a === 0 ? '0%' : a > 0 ? '+100%' : '-100%';
  const p = Math.round(((a - b) / Math.abs(b)) * 100);
  return (p > 0 ? '+' : '') + p + '%';
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

const inBounds = (dateStr: string | undefined, b: Bounds): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d >= b.start && d < b.end;
};

/* ----------------------------- P&L aggregation ----------------------------- */

/** Fraction of an invoice's line items that are "Fee" (vs Disbursement/Reimbursement).
 * Falls back to 100% fee when the invoice has no itemised lines (most invoices don't). */
const invoiceFeeRatio = (inv: Invoice | undefined): number => {
  const items: QuotationLineItem[] | undefined = inv?.lineItems;
  if (!items || items.length === 0) return 1;
  const total = items.reduce((s, li) => s + Number(li.amount || 0), 0);
  if (total <= 0) return 1;
  const feeAmt = items
    .filter((li) => li.category === 'Fee - Fixed' || li.category === 'Fee - SRO')
    .reduce((s, li) => s + Number(li.amount || 0), 0);
  return feeAmt / total;
};

interface PeriodAgg {
  feesCollected: number;
  reimbCollected: number;
  staffCost: number;
  overheadByCategory: Map<string, number>;
  overheadTotal: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

const emptyAgg = (): PeriodAgg => ({
  feesCollected: 0,
  reimbCollected: 0,
  staffCost: 0,
  overheadByCategory: new Map(),
  overheadTotal: 0,
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
});

/* ----------------------------- component ----------------------------- */

export const FinanceTab: React.FC = () => {
  const { invoices, payments, expenses, timeEntries, cases, officeBuckets, retainers, programmes } = useApp();

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

  const paidForInvoice = useMemo(() => {
    const m = new Map<string, number>();
    payments.forEach((p) => m.set(p.invoiceId, (m.get(p.invoiceId) || 0) + Number(p.amount || 0)));
    return m;
  }, [payments]);

  /* --- P&L aggregation for an arbitrary bounds window --- */
  const computeAgg = React.useCallback(
    (b: Bounds): PeriodAgg => {
      const agg = emptyAgg();
      payments.forEach((p) => {
        if (!inBounds(p.date, b)) return;
        const inv = invoiceById.get(p.invoiceId);
        if (inv && inv.status === 'Voided') return;
        const ratio = invoiceFeeRatio(inv);
        agg.feesCollected += Number(p.amount || 0) * ratio;
        agg.reimbCollected += Number(p.amount || 0) * (1 - ratio);
      });
      timeEntries.forEach((t) => {
        if (!inBounds(t.date, b)) return;
        agg.staffCost += Number(t.hours || 0) * Number(t.rate || 0);
      });
      expenses.forEach((e) => {
        if (e.billable) return; // client-billable direct costs aren't firm overhead
        if (!inBounds(e.date, b)) return;
        const cat = e.category || 'Other costs';
        agg.overheadByCategory.set(cat, (agg.overheadByCategory.get(cat) || 0) + Number(e.amount || 0));
      });
      agg.overheadTotal = [...agg.overheadByCategory.values()].reduce((s, v) => s + v, 0);
      agg.totalIncome = agg.feesCollected + agg.reimbCollected;
      agg.totalExpense = agg.staffCost + agg.overheadTotal;
      agg.netProfit = agg.totalIncome - agg.totalExpense;
      return agg;
    },
    [payments, invoiceById, timeEntries, expenses]
  );

  const curBounds = useMemo(() => periodBounds(perKind, offset, now), [perKind, offset, now]);
  const prevBounds = useMemo(() => periodBounds(perKind, offset + 1, now), [perKind, offset, now]);
  const lyBounds = useMemo(() => lastYearBounds(perKind, offset, now), [perKind, offset, now]);

  const cur = useMemo(() => computeAgg(curBounds), [computeAgg, curBounds]);
  const prev = useMemo(() => computeAgg(prevBounds), [computeAgg, prevBounds]);
  const ly = useMemo(() => computeAgg(lyBounds), [computeAgg, lyBounds]);

  const margin = (agg: PeriodAgg) => (agg.totalIncome > 0 ? Math.round((agg.netProfit / agg.totalIncome) * 100) : 0);

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
      { label: 'Fees collected', t: cur.feesCollected, p: prev.feesCollected, l: ly.feesCollected, kind: 'row' },
      { label: 'Disbursements & reimbursements collected', t: cur.reimbCollected, p: prev.reimbCollected, l: ly.reimbCollected, kind: 'row' },
      { label: 'Total income', t: cur.totalIncome, p: prev.totalIncome, l: ly.totalIncome, kind: 'total' },
      { label: 'Expenses', t: null, p: null, l: null, kind: 'head' },
      { label: 'Staff cost (time recorded)', t: -cur.staffCost, p: -prev.staffCost, l: -ly.staffCost, kind: 'row', cost: true },
      ...overheadRows.map((r) => ({ label: r.label, t: -r.t, p: -r.p, l: -r.l, kind: 'row' as const, cost: true })),
      { label: 'Total expenses', t: -cur.totalExpense, p: -prev.totalExpense, l: -ly.totalExpense, kind: 'total', cost: true },
      { label: 'Net profit', t: cur.netProfit, p: prev.netProfit, l: ly.netProfit, kind: 'net' },
    ],
    [cur, prev, ly, overheadRows]
  );

  /* --- Net profit by month chart (12 months of current vs prior calendar year) --- */
  const monthlyCommitTotal = useMemo(() => commits.filter((c) => c.frequency === 'Monthly').reduce((s, c) => s + Number(c.amount || 0), 0), [commits]);

  const monthChart = useMemo(() => {
    const year = now.getFullYear();
    const curMonthIdx = now.getMonth();
    const rows = MONTH_SHORT.map((label, i) => {
      const isFuture = i > curMonthIdx;
      let value: number;
      if (!isFuture) {
        value = computeAgg(monthBounds(year, i)).netProfit;
      } else {
        // Real, derived "forecast": unpaid invoice balances due that month, less fixed
        // monthly commitments — never a fabricated number.
        const dueThisMonth = invoices
          .filter((inv) => inv.status !== 'Paid' && inv.status !== 'Voided')
          .filter((inv) => inBounds(inv.dueDate, monthBounds(year, i)))
          .reduce((s, inv) => s + (Number(inv.total || 0) - (paidForInvoice.get(inv.id) || 0)), 0);
        value = dueThisMonth - monthlyCommitTotal;
      }
      const priorValue = computeAgg(monthBounds(year - 1, i)).netProfit;
      return { label, value, priorValue, isFuture };
    });
    const maxAbs = Math.max(1, ...rows.map((r) => Math.max(Math.abs(r.value), Math.abs(r.priorValue))));
    return { rows, maxAbs, curMonthIdx };
  }, [now, computeAgg, invoices, paidForInvoice, monthlyCommitTotal]);

  /* --- Money position today --- */
  const officeAccountBalance = useMemo(() => officeBuckets.reduce((s, b) => s + b.balance, 0), [officeBuckets]);

  const unpaidInvoicesInfo = useMemo(() => {
    let total = 0;
    let over60 = 0;
    invoices.forEach((inv) => {
      if (inv.status === 'Paid' || inv.status === 'Voided') return;
      const balance = Number(inv.total || 0) - (paidForInvoice.get(inv.id) || 0);
      if (balance <= 0) return;
      total += balance;
      const due = inv.dueDate || inv.date;
      const days = due ? Math.floor((Date.now() - new Date(due).getTime()) / 86400000) : 0;
      if (days > 60) over60 += balance;
    });
    return { total, over60Pct: total > 0 ? Math.round((over60 / total) * 100) : 0 };
  }, [invoices, paidForInvoice]);

  const wip = useMemo(() => {
    const activities = timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff).reduce((s, t) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);
    const disb = expenses.filter((e) => e.billable && !e.billed && !e.writtenOff).reduce((s, e) => s + Number(e.amount || 0), 0);
    const files = new Set([
      ...timeEntries.filter((t) => t.billable && !t.billed && !t.writtenOff).map((t) => t.caseId),
      ...expenses.filter((e) => e.billable && !e.billed && !e.writtenOff).map((e) => e.caseId),
    ]).size;
    return { total: activities + disb, files };
  }, [timeEntries, expenses]);

  const clientAccountBalance = useMemo(() => retainers.reduce((s, r) => s + (r.type === 'Deposit' ? r.amount : -r.amount), 0), [retainers]);

  const position = [
    { label: 'Office account', note: `${officeBuckets.length} bucket${officeBuckets.length === 1 ? '' : 's'} · covers ${(officeAccountBalance / Math.max(1, monthlyCommitTotal || 1)).toFixed(1)} months of fixed costs`, amt: fmtFull(officeAccountBalance), c: GREEN },
    { label: 'Unpaid invoices', note: `${unpaidInvoicesInfo.over60Pct}% over 60 days`, amt: fmtFull(unpaidInvoicesInfo.total), c: RED },
    { label: 'Work not billed yet', note: `time & disbursements recorded, no invoice · ${wip.files} file${wip.files === 1 ? '' : 's'}`, amt: fmtFull(wip.total), c: GOLD },
    { label: 'Client account', note: `${retainers.length} entries · trust balance`, amt: fmtFull(clientAccountBalance), c: NAVY },
  ];

  /* --- Cash reserve & sinking funds handlers --- */
  const updateFund = (id: string, patch: Partial<SinkingFund>) => persistFunds(funds.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addFund = () => persistFunds([...funds, { id: `fund-${Date.now()}`, name: 'New fund', target: 0, monthly: 0, balance: 0 }]);
  const deleteFund = (id: string) => persistFunds(funds.filter((f) => f.id !== id));

  const reserveTotal = funds.reduce((s, f) => s + Number(f.balance || 0), 0);
  const operatingFund = funds[0];
  const runway = operatingFund && monthlyCommitTotal > 0 ? `${(Number(operatingFund.balance || 0) / monthlyCommitTotal).toFixed(1)} months` : '—';

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
    const invByCase = new Map<string, Invoice[]>();
    invoices.forEach((inv) => {
      if (inv.status === 'Voided') return;
      const arr = invByCase.get(inv.caseId) || [];
      arr.push(inv);
      invByCase.set(inv.caseId, arr);
    });
    return cases
      .map((c) => {
        const invIds = new Set((invByCase.get(c.id) || []).map((i) => i.id));
        const fees = payments.filter((p) => invIds.has(p.invoiceId) && inBounds(p.date, ytdBounds)).reduce((s, p) => s + Number(p.amount || 0), 0);
        const timeCost = timeEntries.filter((t) => t.caseId === c.id && inBounds(t.date, ytdBounds)).reduce((s, t) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);
        const directExp = expenses.filter((e) => e.caseId === c.id && e.billable && inBounds(e.date, ytdBounds)).reduce((s, e) => s + Number(e.amount || 0), 0);
        const cost = timeCost + directExp;
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
  }, [cases, invoices, payments, timeEntries, expenses, ytdBounds]);

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
    { title: 'Profit by practice area', sub: 'year to date', col: 'Area', rows: areaProfits, foot: 'Profit = fees collected − staff time cost − direct expenses.' },
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

  const deltaColor = (curV: number, otherV: number, higherIsGood: boolean) => (curV >= otherV === higherIsGood ? GREEN : RED);

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      {/* Scope banner */}
      <div className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5" style={{ background: '#EEF3F9', border: '1px solid #D5E0EC' }}>
        <strong className="text-[12px]" style={{ color: NAVY }}>Whole firm</strong>
        <span className="text-[11px]" style={{ color: '#3D5A7A' }}>
          You see every partner, file and account. Partners see their own files; staff see their own pay.
        </span>
      </div>

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
          <span style={{ fontFamily: serifFont, fontSize: 24, fontWeight: 700, color: GREEN, lineHeight: 1.1 }}>{margin(cur)}%</span>
          <span className="flex gap-2.5 whitespace-nowrap text-[10.5px]" style={{ color: SLATE }}>
            <span>vs prev <strong style={{ color: deltaColor(margin(cur), margin(prev), true) }}>{margin(cur) - margin(prev) >= 0 ? '+' : ''}{margin(cur) - margin(prev)} pts</strong></span>
            <span>vs last yr <strong style={{ color: deltaColor(margin(cur), margin(ly), true) }}>{margin(cur) - margin(ly) >= 0 ? '+' : ''}{margin(cur) - margin(ly)} pts</strong></span>
          </span>
        </div>
      </section>

      {/* P&L table + Net profit chart / Money position */}
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div style={cardStyle}>
          <div style={headStyle}>
            <span style={titleStyle}>Profit &amp; loss</span>
            <span className="text-[10.5px]" style={{ color: SLATE }}>{curBounds.shortLabel}</span>
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
            const delta = r.l ? pctChange(r.cost ? Math.abs(r.t || 0) : r.t || 0, r.cost ? Math.abs(r.l) : r.l) : '';
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
          {funds.map((f, i) => {
            const pct = Math.min(100, Math.round((Number(f.balance || 0) / Math.max(1, Number(f.target || 0))) * 100));
            const m = f.monthly > 0 ? Math.ceil((f.target - f.balance) / f.monthly) : null;
            const color = pct >= 75 ? GREEN : pct >= 40 ? '#C9A86A' : '#B2542F';
            const eta = pct >= 100 ? 'reached' : m && m > 0 ? `${pct}% · full in ${m} mo` : `${pct}%`;
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
