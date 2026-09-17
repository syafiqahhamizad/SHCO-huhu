import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ListChecks,
  Timer,
  Wallet,
  Landmark,
  Building,
  Receipt as ReceiptIcon,
  AlertTriangle,
  Play,
  Square,
  CreditCard,
  BadgeCheck,
  ArrowRight,
} from 'lucide-react';
import { StatCard, Donut, MiniBarChart, TabPills } from '../ui';
import { palette, tint, tintText } from '../../lib/designTokens';
import { TimeView, PaymentVouchersView, RetainersView, CoaView, OfficeAccountsView, ReceiptsView } from './AccountingViews';

type AccTab = 'dashboard' | 'unbilled' | 'timebilling' | 'claims' | 'trust' | 'office' | 'vouchers';

const TABS: { id: AccTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'unbilled', label: 'Unbilled Items' },
  { id: 'timebilling', label: 'Time Billing' },
  { id: 'claims', label: 'Staff Claims' },
  { id: 'trust', label: 'Client Trust' },
  { id: 'office', label: 'Office Account' },
  { id: 'vouchers', label: 'Receipts & Payments' },
];

const fmt = (n: number) => `RM ${Math.round(n).toLocaleString()}`;

/** SHCO Accounting Centre — the redesigned 7-tab module (Dashboard/Unbilled Items/Time Billing/
 *  Staff Claims/Client Trust/Office Account/Receipts & Payments) from design/shco-portal-redesign.
 *  Wraps the existing, already-correctly-wired AccountingViews.tsx exports under the mockup's IA,
 *  and adds the two sections that didn't exist yet: the Dashboard tab and a firm-wide Unbilled Items list. */
export const AccountingCentreView: React.FC<{ initialTab?: AccTab }> = ({ initialTab = 'dashboard' }) => {
  const [tab, setTab] = useState<AccTab>(initialTab);
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  return (
    <div className="space-y-4 pb-10 text-xs text-[#16223A]">
      <div className="rounded-2xl p-5 text-white shadow-md bg-transparent" style={{ backgroundColor: palette.navy }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl font-bold">Accounting</h1>
            <p className="mt-1 max-w-2xl text-[12px] text-slate-300">
              Client trust (SAR 1990) &amp; office accounts, billing and receivables.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 p-1">
            {(['month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${period === p ? 'bg-white text-[#16223A]' : 'text-slate-300'}`}
              >
                {p === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <QuickActionsPanel onNavigate={setTab} />

      <TabPills items={TABS} activeId={tab} onSelect={(id) => setTab(id as AccTab)} />

      {tab === 'dashboard' && <AccountingDashboardTab period={period} />}
      {tab === 'unbilled' && <UnbilledItemsFirmWideTab />}
      {tab === 'timebilling' && <TimeBillingTab />}
      {tab === 'claims' && <PaymentVouchersView />}
      {tab === 'trust' && <ClientTrustTab />}
      {tab === 'office' && (
        <div className="space-y-4">
          <OfficeAccountsView />
          <CoaView />
        </div>
      )}
      {tab === 'vouchers' && <ReceiptsView />}
    </div>
  );
};

/* ================= Quick Actions — "start here" guided entry points ================= */
/** Answers "which of the 7 tabs do I open?" for the most common tasks, instead of making
 *  the user know the Accounting Centre's structure. "Bill a client" is a full inline guided
 *  flow (pick matter -> see its unbilled total -> generate invoice) rather than a bare link,
 *  since that's the task people actually get stuck on. */
const QuickActionsPanel: React.FC<{ onNavigate: (tab: AccTab) => void }> = ({ onNavigate }) => {
  const { cases, timeEntries, expenses, invoices, getNextSequenceId, addInvoice, updateTimeEntry, updateExpense, showToast, clients } = useApp() as any;
  const [billOpen, setBillOpen] = useState(false);
  const [caseId, setCaseId] = useState('');

  const billableCases = useMemo(() => {
    return (cases || [])
      .map((c: any) => {
        const acts = (timeEntries || []).filter((t: any) => t.caseId === c.id && t.billable && !t.billed);
        const disb = (expenses || []).filter((e: any) => e.caseId === c.id && e.billable && !e.billed);
        const total = acts.reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.rate || 0), 0) + disb.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
        return { case: c, acts, disb, total };
      })
      .filter((row: any) => row.total > 0)
      .sort((a: any, b: any) => b.total - a.total);
  }, [cases, timeEntries, expenses]);

  const selected = billableCases.find((row: any) => row.case.id === caseId) || billableCases[0];

  const generateInvoice = () => {
    if (!selected) return;
    const invId = getNextSequenceId('invoice');
    const clientObj = (clients || []).find((c: any) => c.id === selected.case.clientId);
    addInvoice({
      id: invId, clientId: selected.case.clientId, caseId: selected.case.id, fileRef: selected.case.ref,
      partyType: 'Client', partyName: selected.case.clientName || clientObj?.name, amount: selected.total, discount: 0, tax: 0, total: selected.total,
      date: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: 'Unpaid',
    });
    selected.acts.forEach((t: any) => updateTimeEntry(t.id, { billed: true, invoiceId: invId }));
    selected.disb.forEach((e: any) => updateExpense(e.id, { billed: true }));
    showToast?.(`Invoice ${invId} generated for ${selected.case.ref}.`);
    setBillOpen(false);
    setCaseId('');
  };

  const actions = [
    { id: 'bill', label: 'Bill a client', note: `${billableCases.length} matter${billableCases.length === 1 ? '' : 's'} with unbilled work`, icon: CreditCard, color: palette.gold, onClick: () => setBillOpen((v) => !v) },
    { id: 'payment', label: 'Record a payment', note: 'Issue a receipt or payment voucher', icon: Wallet, color: palette.green, onClick: () => onNavigate('vouchers') },
    { id: 'claim', label: 'Approve a staff claim', note: 'Review pending disbursement vouchers', icon: BadgeCheck, color: palette.blue, onClick: () => onNavigate('claims') },
    { id: 'trust', label: 'Check trust balance', note: 'SAR 1990 client trust ledger', icon: Landmark, color: palette.purple, onClick: () => onNavigate('trust') },
  ];

  return (
    <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#5B6478]">Start here</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map(({ id, label, note, icon: Icon, color, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="flex flex-col items-start gap-2 rounded-lg border border-[#DDE3EB] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white bg-transparent" style={{ backgroundColor: color }}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-[12px] font-bold text-[#16223A]">{label}</span>
            <span className="text-[10.5px] text-[#5B6478]">{note}</span>
          </button>
        ))}
      </div>

      {billOpen && (
        <div className="mt-4 rounded-lg border border-[#DDE3EB] bg-[#F6F8FA] p-3.5">
          {billableCases.length === 0 ? (
            <p className="text-center text-[11.5px] text-slate-400">No matters have unbilled work right now.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-[220px] text-[11px] font-bold text-[#5B6478]">
                Matter
                <select value={selected?.case.id || ''} onChange={(e) => setCaseId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[12px] font-normal text-[#16223A]">
                  {billableCases.map((row: any) => (
                    <option key={row.case.id} value={row.case.id}>{row.case.ref} — {row.case.title} ({fmt(row.total)} unbilled)</option>
                  ))}
                </select>
              </label>
              <div className="text-[11px] text-[#5B6478]">
                Unbilled total<br /><span className="text-[16px] font-bold text-[#16223A]">{fmt(selected?.total || 0)}</span>
              </div>
              <button type="button" onClick={generateInvoice} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold text-white bg-transparent" style={{ backgroundColor: palette.navy }}>
                Generate Invoice <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ================= Accounting Dashboard (new — didn't exist before) ================= */
const AccountingDashboardTab: React.FC<{ period: 'month' | 'year' }> = ({ period }) => {
  const { retainers, timeEntries, expenses, receipts, payments, invoices } = useApp() as any;

  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return d.getFullYear() === now.getFullYear();
  };

  const trustBalance = useMemo(
    () => (retainers || []).reduce((s: number, r: any) => s + (r.type === 'Deposit' ? r.amount : -r.amount), 0),
    [retainers]
  );

  const unbilledActivities = useMemo(
    () => (timeEntries || []).filter((t: any) => t.billable && !t.billed && !t.writtenOff).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.rate || 0), 0),
    [timeEntries]
  );
  const unbilledDisbursements = useMemo(
    () => (expenses || []).filter((e: any) => e.billable && !e.billed && !e.writtenOff).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    [expenses]
  );

  const collectedThisPeriod = useMemo(
    () => (receipts || []).filter((r: any) => inPeriod(r.date)).reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
    [receipts, period]
  );

  const paidForInvoice = (invId: string) => (payments || []).filter((p: any) => p.invoiceId === invId).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const agedOver90 = useMemo(() => {
    return (invoices || [])
      .filter((i: any) => i.status !== 'Paid' && i.status !== 'Voided')
      .reduce((s: number, i: any) => {
        const balance = Number(i.total || 0) - paidForInvoice(i.id);
        if (balance <= 0) return s;
        const due = i.dueDate || i.date;
        const days = due ? Math.floor((Date.now() - new Date(due).getTime()) / 86400000) : 0;
        return days > 90 ? s + balance : s;
      }, 0);
  }, [invoices, payments]);

  const agingBuckets = useMemo(() => {
    const buckets = { b1: 0, b31: 0, b61: 0, b91: 0, over120: 0 };
    (invoices || []).forEach((i: any) => {
      if (i.status === 'Paid' || i.status === 'Voided') return;
      const balance = Number(i.total || 0) - paidForInvoice(i.id);
      if (balance <= 0) return;
      const due = i.dueDate || i.date;
      const days = due ? Math.floor((Date.now() - new Date(due).getTime()) / 86400000) : 0;
      if (days <= 30) buckets.b1 += balance;
      else if (days <= 60) buckets.b31 += balance;
      else if (days <= 90) buckets.b61 += balance;
      else if (days <= 120) buckets.b91 += balance;
      else buckets.over120 += balance;
    });
    return buckets;
  }, [invoices, payments]);

  const billed = (invoices || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const unbilledTotal = unbilledActivities + unbilledDisbursements;
  const billedPct = billed + unbilledTotal > 0 ? Math.round((billed / (billed + unbilledTotal)) * 100) : 0;

  const monthlyFees = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' }));
    return months.map((label, i) => ({
      label,
      value: (invoices || []).filter((inv: any) => inv.date && new Date(inv.date).getMonth() === i).reduce((s: number, inv: any) => s + Number(inv.total || 0), 0),
      color: palette.gold,
    }));
  }, [invoices]);

  const needsAttention: string[] = [];
  if (agedOver90 > 0) needsAttention.push(`RM ${Math.round(agedOver90).toLocaleString()} in receivables aged above 90 days`);
  if (trustBalance < 0) needsAttention.push('Client trust ledger is overdrawn — review immediately');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Trust balance" value={fmt(trustBalance)} color={palette.navy} />
        <StatCard label="Unbilled activities" value={fmt(unbilledActivities)} color={palette.gold} />
        <StatCard label="Unbilled disbursements" value={fmt(unbilledDisbursements)} color="#B2542F" />
        <StatCard label={`Collected this ${period}`} value={fmt(collectedThisPeriod)} color={palette.green} />
        <StatCard label="Aged > 90 days" value={fmt(agedOver90)} color={palette.purple} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <p className="mb-3 text-[12.5px] font-bold text-[#16223A]">Billed vs Unbilled ratio</p>
          <div className="flex items-center gap-4">
            <Donut segments={[{ label: 'Billed', value: billedPct, color: palette.green }, { label: 'Unbilled', value: 100 - billedPct, color: palette.red }]} centerLabel={`${billedPct}%`} />
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.green }} />Billed {billedPct}%</div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.red }} />Unbilled {100 - billedPct}%</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <p className="mb-3 text-[12.5px] font-bold text-[#16223A]">Aging summary — unbilled &amp; receivables</p>
          <MiniBarChart
            data={[
              { label: '1-30', value: agingBuckets.b1, color: palette.blue },
              { label: '31-60', value: agingBuckets.b31, color: palette.blue },
              { label: '61-90', value: agingBuckets.b61, color: palette.blue },
              { label: '91-120', value: agingBuckets.b91, color: palette.blue },
              { label: 'Above 120', value: agingBuckets.over120, color: palette.red },
            ]}
            formatValue={(v) => `RM ${v.toLocaleString()}`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
        <p className="mb-3 text-[12.5px] font-bold text-[#16223A]">Fees — by month, 2026</p>
        <MiniBarChart data={monthlyFees} formatValue={(v) => `RM ${(v / 1000).toFixed(0)}k`} />
      </div>

      {needsAttention.length > 0 && (
        <div className="rounded-xl border p-4" style={{ backgroundColor: tint.red, borderColor: '#F0C9C2' }}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: tintText.red }}>
            <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-[11.5px]" style={{ color: tintText.red }}>
            {needsAttention.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ================= Unbilled Items — firm-wide (new) ================= */
const UnbilledItemsFirmWideTab: React.FC = () => {
  const { timeEntries, expenses, cases, clients, updateTimeEntry, updateExpense, setCurrentCaseId, setCurrentView, showToast } = useApp() as any;
  const [clientFilter, setClientFilter] = useState('All');
  const [matterFilter, setMatterFilter] = useState('All');
  const [dueDaysFilter, setDueDaysFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Activity' | 'Disbursement'>('All');

  const caseById = useMemo(() => new Map((cases || []).map((c: any) => [c.id, c])), [cases]);

  const rows = useMemo(() => {
    const out: { id: string; kind: 'Activity' | 'Disbursement'; date: string; user: string; caseId: string; description: string; amount: number }[] = [];
    (timeEntries || []).forEach((t: any) => {
      if (!t.billable || t.billed || t.writtenOff) return;
      out.push({ id: t.id, kind: 'Activity', date: t.date, user: t.feeEarner, caseId: t.caseId, description: t.description || 'Time entry', amount: Number(t.hours || 0) * Number(t.rate || 0) });
    });
    (expenses || []).forEach((e: any) => {
      if (!e.billable || e.billed || e.writtenOff) return;
      out.push({ id: e.id, kind: 'Disbursement', date: e.date, user: e.claimant || '', caseId: e.caseId, description: e.description || e.category || 'Disbursement', amount: Number(e.amount || 0) });
    });
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [timeEntries, expenses]);

  const filtered = rows.filter((r) => {
    const cs = caseById.get(r.caseId);
    if (clientFilter !== 'All' && cs?.clientId !== clientFilter) return false;
    if (matterFilter !== 'All' && r.caseId !== matterFilter) return false;
    if (typeFilter !== 'All' && r.kind !== typeFilter) return false;
    if (dueDaysFilter !== 'All') {
      const days = r.date ? Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000) : 0;
      if (dueDaysFilter === '120+' && days <= 120) return false;
      if (dueDaysFilter === '90' && days <= 90) return false;
      if (dueDaysFilter === '30' && days <= 30) return false;
    }
    return true;
  });

  const activitiesTotal = filtered.filter((r) => r.kind === 'Activity').reduce((s, r) => s + r.amount, 0);
  const disbTotal = filtered.filter((r) => r.kind === 'Disbursement').reduce((s, r) => s + r.amount, 0);

  const writeOff = (r: (typeof rows)[number]) => {
    if (r.kind === 'Activity') updateTimeEntry(r.id, { writtenOff: true });
    else updateExpense(r.id, { writtenOff: true });
    showToast?.(`Written off: ${r.description}`);
  };

  const openMatter = (caseId: string) => {
    setCurrentCaseId(caseId);
    setCurrentView('cases');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DDE3EB] bg-white p-4">
        <p className="text-[13px] font-bold text-[#16223A]">Unbilled Items — Firm Wide</p>
        <p className="text-[11px] text-[#5B6478]">Select a matter's rows, then open it to generate an invoice from Matter Workspace → Unbilled Items.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]">
          <option value="All">Client — All</option>
          {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={matterFilter} onChange={(e) => setMatterFilter(e.target.value)} className="rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]">
          <option value="All">Matter — All</option>
          {(cases || []).map((c: any) => <option key={c.id} value={c.id}>{c.ref}</option>)}
        </select>
        <select value={dueDaysFilter} onChange={(e) => setDueDaysFilter(e.target.value)} className="rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]">
          <option value="All">Due (days) — All</option>
          <option value="30">Above 30</option>
          <option value="90">Above 90</option>
          <option value="120+">Above 120</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]">
          <option value="All">Type — All</option>
          <option value="Activity">Activities</option>
          <option value="Disbursement">Disbursements</option>
        </select>
        <div className="ml-auto flex items-center gap-4 text-[12px] font-bold text-[#16223A]">
          <span>Activities {fmt(activitiesTotal)}</span>
          <span>Disbursements {fmt(disbTotal)}</span>
          <span style={{ color: palette.navy }}>Total {fmt(activitiesTotal + disbTotal)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#DDE3EB] bg-white">
        <table className="w-full min-w-[720px] text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-[#DDE3EB] text-[10px] uppercase text-[#5B6478]">
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5">User</th>
              <th className="p-2.5">Matter</th>
              <th className="p-2.5">Description</th>
              <th className="p-2.5 text-right">Amount</th>
              <th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">No unbilled items match these filters.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="p-2.5">{r.date}</td>
                  <td className="p-2.5 font-bold">{r.kind === 'Activity' ? 'A' : 'D'}</td>
                  <td className="p-2.5">{r.user}</td>
                  <td className="p-2.5">
                    <button type="button" onClick={() => openMatter(r.caseId)} className="font-mono font-bold" style={{ color: palette.blue }}>
                      {caseById.get(r.caseId)?.ref || r.caseId}
                    </button>
                  </td>
                  <td className="p-2.5">{r.description}</td>
                  <td className="p-2.5 text-right font-mono font-bold">{fmt(r.amount)}</td>
                  <td className="p-2.5 text-right">
                    <button type="button" onClick={() => writeOff(r)} className="rounded-md border border-[#DDE3EB] px-2 py-1 text-[10.5px] font-bold text-[#5B6478] hover:bg-slate-50">
                      Write off
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= Time Billing = TimeView + Quick Timer widget ================= */
const TimeBillingTab: React.FC = () => {
  const { cases, addTimeEntry, currentUser, showToast } = useApp() as any;
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [caseId, setCaseId] = useState('');
  const [description, setDescription] = useState('');
  const timerRef = React.useRef<number | null>(null);

  const toggle = () => {
    if (running) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setRunning(false);
    } else {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setRunning(true);
    }
  };

  const submit = () => {
    if (!caseId) return;
    const cs = (cases || []).find((c: any) => c.id === caseId);
    addTimeEntry({
      id: `T-${Date.now()}`,
      caseId,
      feeEarner: currentUser?.name || '',
      date: new Date().toISOString().slice(0, 10),
      hours: Math.round((seconds / 3600) * 100) / 100,
      rate: 0,
      billable: true,
      billed: false,
      description: description || 'Timed entry',
    });
    showToast?.(`Logged ${(seconds / 3600).toFixed(2)}h to ${cs?.ref || caseId}`);
    setSeconds(0);
    setDescription('');
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRunning(false);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2"><TimeView /></div>
      <div className="h-fit rounded-xl border border-[#DDE3EB] bg-white p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[#16223A]"><Timer className="h-3.5 w-3.5" /> Quick Timer</p>
        <p className="mb-3 text-center font-mono text-3xl font-bold" style={{ color: palette.green }}>{hh}:{mm}:{ss}</p>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mb-2 w-full rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]">
          <option value="">Matter*</option>
          {(cases || []).map((c: any) => <option key={c.id} value={c.id}>{c.ref} — {c.title}</option>)}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="mb-3 w-full rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]" />
        <div className="flex gap-2">
          <button type="button" onClick={toggle} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11.5px] font-bold text-white bg-transparent" style={{ backgroundColor: palette.green }}>
            {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {running ? 'Stop' : 'Start'}
          </button>
          <button type="button" onClick={submit} disabled={!caseId || seconds === 0} className="flex-1 rounded-lg py-2 text-[11.5px] font-bold text-white disabled:opacity-40 bg-transparent" style={{ backgroundColor: palette.navy }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================= Client Trust = RetainersView + itemized SAR 1990 ledger ================= */
const ClientTrustTab: React.FC = () => {
  const { retainers, clients } = useApp() as any;
  const [filter, setFilter] = useState('');

  const clientById = useMemo(() => new Map((clients || []).map((c: any) => [c.id, c])), [clients]);

  const ledger = useMemo(() => {
    const sorted = [...(retainers || [])].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    let balance = 0;
    return sorted.map((r: any) => {
      const debit = r.type !== 'Deposit' ? r.amount : 0;
      const credit = r.type === 'Deposit' ? r.amount : 0;
      balance += credit - debit;
      return { ...r, debit, credit, balance, clientName: clientById.get(r.clientId)?.name || r.clientId };
    });
  }, [retainers, clientById]);

  const filteredLedger = ledger.filter((r) => !filter || r.clientName?.toLowerCase().includes(filter.toLowerCase()) || (r.date || '').includes(filter));

  return (
    <div className="space-y-4">
      <RetainersView />
      <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-bold text-[#16223A]">Ledger — Client Trust Account (SAR 1990)</p>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by client or date..." className="rounded-lg border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-[#DDE3EB] text-[10px] uppercase text-[#5B6478]">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Matter / Client</th>
                <th className="p-2.5 text-right">Debit</th>
                <th className="p-2.5 text-right">Credit</th>
                <th className="p-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLedger.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-400">No trust ledger entries.</td></tr>
              ) : (
                filteredLedger.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2.5">{r.date}</td>
                    <td className="p-2.5">{r.clientName}</td>
                    <td className="p-2.5 text-right font-mono" style={{ color: r.debit ? palette.red : undefined }}>{r.debit ? fmt(r.debit) : '—'}</td>
                    <td className="p-2.5 text-right font-mono" style={{ color: r.credit ? palette.green : undefined }}>{r.credit ? fmt(r.credit) : '—'}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{fmt(r.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountingCentreView;
