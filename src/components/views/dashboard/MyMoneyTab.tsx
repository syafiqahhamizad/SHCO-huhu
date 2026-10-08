import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, Invoice, Payslip } from '../../../types';
import { identityTokens, isMine } from '../../../lib/identity';
import { serifFont } from '../../../lib/designTokens';
import { caseFinder, feeIncomeOfPayment, moneyInEvents, payslipCounts } from '../../../lib/financeMetrics';
import { moneyForFile } from '../../../lib/moneyByFile';
import { localIso, parseLocal, toLocalYear } from '../../../lib/localDate';
import { buildFileDirectory, buildMyClaimRows, dedOf, dMonY, MONTHS_SHORT, netOf, periodLabel } from '../staff/staffPortalShared';

/**
 * My Dashboard → Finance for a Partner (their own files only) or for staff (their own money only).
 * Design: My Dashboard → isMoney / moneyMine. The Managing Partner sees the whole-firm FinanceTab.
 *
 *  Partner — files where they are a partner in charge. Billed = fees on issued bills this year
 *  (fees + reimbursements, excl. SST and disbursements, moneyByFile); collected = fee income from
 *  payments this year (financeMetrics.feeIncomeOfPayment); cost = billable time at charge-out
 *  rate this year (same basis as the firm Finance tab); owed = outstanding on issued bills.
 *  Profit share = what their own approved / paid payslips paid this year.
 *
 *  Staff — only their own approved / paid payslips and their own claims.
 */

const G = '#2F6F4E';
const R = '#B23A2E';
const N = '#16223A';
const GOLD = '#8A6D3B';
const rm = (n: number) => 'RM ' + Math.round(n).toLocaleString('en-MY');
const daysSince = (d: string, today: string) => Math.round((parseLocal(today) - parseLocal(d)) / 86400000);

type Kpi = [string, string, string, string];
type Col = [string, 'left' | 'right'];
type TRow = { a: string; sub: string; b: string; c: string; d: string; e: string; f: string; ec: string; fc: string; bg: string };

const Shell: React.FC<{ kpis: Kpi[]; title: string; note: React.ReactNode; cols: Col[]; rows: TRow[]; empty: string }> = ({ kpis, title, note, cols, rows, empty }) => (
  <div className="flex flex-col gap-4">
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map(([label, value, sub, vc]) => (
        <div key={label} className="flex flex-col gap-1 rounded-xl border border-[#DDE3EB] bg-white px-[15px] py-[13px]">
          <span className="text-[9.5px] font-bold uppercase tracking-[.08em] text-[#5B6478]">{label}</span>
          <span className="text-[21px] font-bold" style={{ fontFamily: serifFont, color: vc }}>{value}</span>
          <span className="text-[10.5px] leading-[1.4] text-[#5B6478]">{sub}</span>
        </div>
      ))}
    </section>
    <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1F5] px-3.5 py-2.5">
        <strong className="text-[14.5px] text-[#16223A]" style={{ fontFamily: serifFont }}>{title}</strong>
        <span className="text-[10.5px] text-[#5B6478]">{note}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid gap-2.5 border-b border-[#EEF1F5] bg-[#F6F8FA] px-3.5 py-[7px] text-[9.5px] font-bold uppercase tracking-[.08em] text-[#5B6478]" style={{ gridTemplateColumns: 'minmax(0,1.6fr) repeat(5,minmax(0,1fr))' }}>
            {cols.map(([label, al]) => <span key={label} style={{ textAlign: al }}>{label}</span>)}
          </div>
          {rows.length === 0 && <div className="px-3.5 py-4 text-center text-[11px] text-[#5B6478]">{empty}</div>}
          {rows.map((r, i) => (
            <div key={i} className="grid items-center gap-2.5 border-b border-[#F0F2F5] px-3.5 py-2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) repeat(5,minmax(0,1fr))', background: r.bg }}>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-bold text-[#16223A]">{r.a}</span>
                <span className="block text-[10px] text-[#5B6478]">{r.sub}</span>
              </span>
              <span className="text-right text-[11.5px] text-[#16223A]">{r.b}</span>
              <span className="text-right text-[11.5px] text-[#16223A]">{r.c}</span>
              <span className="text-right text-[11.5px] text-[#16223A]">{r.d}</span>
              <span className="text-right text-[11.5px] font-bold" style={{ color: r.ec }}>{r.e}</span>
              <span className="text-right text-[11.5px] font-bold" style={{ color: r.fc }}>{r.f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const PartnerMoney: React.FC = () => {
  const { cases, clients, invoices, payments, retainers, quotations, timeEntries, payslips, currentUser } = useApp() as any;
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const today = localIso(new Date());
  const year = Number(today.slice(0, 4));
  const monthsSoFar = Number(today.slice(5, 7));

  const data = useMemo(() => {
    const myFiles: Case[] = (cases || []).filter((c: Case) => isMine(c.partners as any, me));
    const findCase = caseFinder(cases || []);
    const moneyIn = moneyInEvents(invoices || [], payments || []);
    const invById = new Map<string, Invoice>((invoices || []).map((i: Invoice) => [i.id, i]));
    const src = { invoices: invoices || [], payments: payments || [], retainers: retainers || [], quotations: quotations || [] };
    const clientName = (c: Case) => (clients || []).find((x: any) => String(c.clientId || '').split(',').map((s) => s.trim()).includes(x.id))?.name || (c as any).clientName || c.title;

    let billed = 0, collected = 0, owed = 0, owed60 = 0, unbilled = 0;
    const unbilledFiles = new Set<string>();
    const unbilledOld = new Set<string>();
    const rows = myFiles.map((c) => {
      const m = moneyForFile(c, src);
      const fBilled = m.bills.filter((b) => b.issued && toLocalYear(b.date) === year).reduce((s, b) => s + b.fees, 0);
      const ids = new Set(m.bills.map((b) => b.id));
      const fColl = moneyIn.filter((p) => ids.has(p.invoiceId) && toLocalYear(p.date) === year).reduce((s, p) => s + feeIncomeOfPayment(p.amount, invById.get(p.invoiceId)), 0);
      m.bills.filter((b) => b.issued && b.bal > 0.005).forEach((b) => {
        owed += b.bal;
        if (daysSince(b.inv.dueDate || b.date, today) > 60) owed60 += b.bal;
      });
      const fileTime = (timeEntries || []).filter((t: any) => findCase(t.caseId)?.id === c.id);
      const cost = fileTime.filter((t: any) => t.billable && toLocalYear(t.date) === year).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);
      fileTime.forEach((t: any) => {
        if (!t.billable || t.billed || t.approvalStatus === 'Rejected') return;
        unbilled += Number(t.hours || 0) * Number(t.rate || 0);
        unbilledFiles.add(c.id);
        if (t.date && daysSince(t.date, today) > 60) unbilledOld.add(c.id);
      });
      billed += fBilled;
      collected += fColl;
      const profit = fColl - cost;
      const margin = fColl > 0 ? Math.round((profit / fColl) * 100) : null;
      return { c, client: clientName(c), fBilled, fColl, cost, profit, margin };
    }).filter((r) => r.fBilled || r.fColl || r.cost);

    const share = (payslips || [])
      .filter((p: Payslip) => p.userId === currentUser?.id && payslipCounts(p) && p.period.startsWith(String(year)))
      .reduce((s: number, p: Payslip) => s + Number(p.profitShare || 0), 0);
    return { rows: rows.sort((a, b) => b.fBilled - a.fBilled), billed, collected, owed, owed60, unbilled, unbilledFiles: unbilledFiles.size, unbilledOld: unbilledOld.size, share, files: myFiles.length };
  }, [cases, clients, invoices, payments, retainers, quotations, timeEntries, payslips, me, currentUser, year, today]);

  const target = Number(currentUser?.staffProfile?.targets?.billed || 0) * monthsSoFar;
  const kpis: Kpi[] = [
    ['Fees billed YTD', rm(data.billed), target ? `target ${rm(target)} · ${Math.round((data.billed / target) * 100)}%` : `${data.files} file${data.files === 1 ? '' : 's'} in your charge`, N],
    ['Collected YTD', rm(data.collected), data.billed ? `${Math.round((data.collected / data.billed) * 100)}% of billed` : 'nothing billed yet this year', G],
    ['Owed by my clients', rm(data.owed), `${rm(data.owed60)} over 60 days`, R],
    ['Work not billed', rm(data.unbilled), `${data.unbilledFiles} file${data.unbilledFiles === 1 ? '' : 's'} · ${data.unbilledOld} over 60 days`, GOLD],
    ['My profit share', rm(data.share), `on your payslips in ${year}`, G],
  ];
  const rows: TRow[] = data.rows.map((r) => ({
    a: r.client,
    sub: `${r.c.ref} · ${r.c.practiceArea || r.c.type || '—'}${r.c.status === 'Closed' ? ' · closed' : ''}`,
    b: rm(r.fBilled),
    c: rm(r.fColl),
    d: rm(r.cost),
    e: rm(r.profit),
    f: r.margin == null ? '—' : `${r.margin}%`,
    ec: r.profit < 0 ? R : G,
    fc: r.margin != null && r.margin < 30 ? R : G,
    bg: r.profit < 0 ? '#FFF8F6' : '#fff',
  }));
  return (
    <Shell
      kpis={kpis}
      title="Profit by file"
      note={`${year} to date · fees collected minus time recorded at charge-out rate`}
      cols={[['File · client', 'left'], ['Billed', 'right'], ['Collected', 'right'], ['Cost', 'right'], ['Profit', 'right'], ['Margin', 'right']]}
      rows={rows}
      empty="No billing or time recorded on your files this year yet."
    />
  );
};

export const StaffMoney: React.FC = () => {
  const { payslips, travelClaims, expenses, paymentVouchers, cases, clients, users, currentUser, setCurrentView } = useApp() as any;
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const year = String(new Date().getFullYear());

  const slips: Payslip[] = useMemo(
    () => (payslips || []).filter((p: Payslip) => p.userId === currentUser?.id && payslipCounts(p)).sort((a: Payslip, b: Payslip) => b.period.localeCompare(a.period)),
    [payslips, currentUser]
  );
  const claims = useMemo(() => {
    const dir = buildFileDirectory(cases || [], clients || [], users || []);
    return buildMyClaimRows(me, travelClaims || [], expenses || [], paymentVouchers || [], dir).filter((c) => c.source !== 'pv');
  }, [me, travelClaims, expenses, paymentVouchers, cases, clients, users]);

  const latest = slips[0];
  const ytd = slips.filter((s) => s.period.startsWith(year));
  const sum = (f: (s: Payslip) => number) => ytd.reduce((t, s) => t + f(s), 0);
  const waiting = claims.filter((c) => c.status === 'Waiting');
  const approved = claims.filter((c) => c.status === 'Approved');
  const owedClaims = [...waiting, ...approved].reduce((s, c) => s + c.amt, 0);
  const referralFiles = ytd.filter((s) => s.referralFee > 0).length;

  const kpis: Kpi[] = [
    ['Net pay' + (latest ? ' · ' + MONTHS_SHORT[Number(latest.period.slice(5, 7)) - 1] : ''), latest ? rm(netOf(latest)) : '—', latest ? (latest.paidAt ? 'paid ' + dMonY(latest.paidAt) : 'approved · not paid yet') : 'No payslips issued yet', N],
    ['Claims', rm(owedClaims), claims.length ? `${approved.length} approved · ${waiting.length} waiting` : 'no claims made', G],
    ['Referral fees YTD', rm(sum((s) => s.referralFee || 0)), referralFiles ? `on ${referralFiles} payslip${referralFiles === 1 ? '' : 's'}` : 'none this year', '#8C2F4C'],
    ['Bonus ' + year, rm(sum((s) => s.bonus || 0)), 'on your payslips this year', N],
    ['EPF YTD (you + firm)', rm(sum((s) => (s.epfEmployee || 0) + (s.epfEmployer || 0))), 'from payslips', N],
  ];
  const paidClaimsIn = (period: string) => claims.filter((c) => c.status === 'Paid' && (c.iso || '').startsWith(period)).reduce((s, c) => s + c.amt, 0);
  const rows: TRow[] = slips.slice(0, 12).map((s) => {
    const basic = (s.basic || 0) + (s.allowances || []).reduce((t, a) => t + (a.amount || 0), 0);
    const cl = paidClaimsIn(s.period);
    return {
      a: periodLabel(s.period),
      sub: s.paidAt ? 'paid ' + dMonY(s.paidAt) : 'approved · not paid yet',
      b: rm(basic),
      c: s.referralFee ? rm(s.referralFee) : '—',
      d: cl ? rm(cl) : '—',
      e: '- ' + rm(dedOf(s)),
      f: rm(netOf(s)),
      ec: R,
      fc: G,
      bg: '#fff',
    };
  });
  return (
    <Shell
      kpis={kpis}
      title="My payslips"
      note={<>open <button type="button" onClick={() => setCurrentView('staffPortal')} className="font-bold text-[#3D6B9C] hover:underline">Staff Portal</button> to download each payslip · claims are paid back separately</>}
      cols={[['Month', 'left'], ['Basic + allow.', 'right'], ['Referral', 'right'], ['Claims', 'right'], ['Deductions', 'right'], ['Net pay', 'right']]}
      rows={rows}
      empty="No payslips issued yet."
    />
  );
};
