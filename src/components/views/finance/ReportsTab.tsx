import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, fd, findCase, glCode, inPeriod, MON, parseDate, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';
import { invoiceComposition } from '../../../lib/financeCalc';

/** Reports — design: report cards with View / PDF / Excel; View opens the report on A4 paper.
 * Every figure comes from real records (same definitions as Finance Home and Accounting). */
export const ReportsTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, lk } = F;
  const { invoices, payments, payslips, generalLedger, chartOfAccounts, retainers } = app;
  const year = F.now.getFullYear();
  const [tbYear, setTbYear] = useState(year);
  const [plScope, setPlScope] = useState<'month' | 'ytd' | 'last'>('month');
  const [bsScope, setBsScope] = useState<'now' | 'last'>('now');
  const [psMode, setPsMode] = useState<'person' | 'file'>('person');
  const [viewing, setViewing] = useState<string | null>(null);
  /* ------------------------------ reports (real data) ------------------------------ */
  const prev2 = [new Date(year, F.now.getMonth() - 2, 1), new Date(year, F.now.getMonth() - 1, 1)];
  const sstPeriod = `${MON[prev2[0].getMonth()]}–${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`;
  const inYear = (d: unknown) => { const t = parseDate(d); return !!t && new Date(t).getFullYear() === year; };
  const neg = (n: number) => (n ? '(' + rm(Math.abs(n)) + ')' : rm(0));
  /** Account balances (debit +, credit −) for GL entries dated in [from, to]. */
  const glBalancesBetween = (from: number, to: number) => { const b = new Map<string, number>(); generalLedger.forEach((g) => { const t = parseDate(g.date); if (t && (t < from || t > to)) return; b.set(g.debit, (b.get(g.debit) || 0) + Number(g.amount || 0)); b.set(g.credit, (b.get(g.credit) || 0) - Number(g.amount || 0)); }); return [...b.entries()].map(([a, v]) => [a, Math.round(v * 100) / 100] as [string, number]).sort((a, c) => glCode(a[0]).localeCompare(glCode(c[0]))); };
  const glBalancesTo = (to: number) => glBalancesBetween(-Infinity, to);
  const coaType = (acct: string) => chartOfAccounts.find((c) => c.code === glCode(acct))?.type || ({ '1': 'Asset', '2': 'Liability', '3': 'Equity', '4': 'Income', '5': 'Expense' } as Record<string, string>)[glCode(acct).slice(0, 1)] || 'Other';
  const noGL: [string, string][] = [['No postings in the general ledger yet', '—']];

  const report = (name: string): { period: string; cols: string[]; rows: (string | number)[][]; extra?: { title: string; cols: string[]; rows: (string | number)[][] } } => {
    if (name === 'Profit & loss') {
      // Same definition as Finance Home (F.pnl): fee income excludes SST and disbursements.
      const rng = (d: unknown) => (plScope === 'month' ? inPeriod(d, F.period) : (() => { const t = parseDate(d); const y = plScope === 'last' ? year - 1 : year; return !!t && new Date(t).getFullYear() === y; })());
      const p = F.pnl(rng);
      const sgn = (n: number) => (n < 0 ? '(' + rm(Math.abs(n)) + ')' : rm(n));
      return { period: plScope === 'month' ? `${F.monShort} ${year}` : plScope === 'last' ? `FY ${year - 1} (closed)` : `${year} to date`, cols: ['Item', 'Amount'], rows: [
        ['Fee income received (professional fees + reimbursements, excl. SST)', rm(p.feeIncome)], ['Other office receipts', rm(p.otherIn)], ['Total income', rm(p.income)],
        ['Salaries & employer EPF/SOCSO/EIS (payslips)', neg(p.payroll)], ...[...p.cats.entries()].map(([k, v]) => [k, neg(v)]), ['Staff claims paid', neg(p.claims)], ['Payment vouchers paid (office costs)', neg(p.pvs)], ['Total expenses', neg(p.expensesTotal)], ['Net profit', sgn(p.net)],
        ['— Not income or costs —', ''], ['SST collected (owed to Customs)', rm(p.sstCollected)], ['Disbursements recovered from clients', rm(p.disbRecovered)], ['Proforma money received this period (fees in advance: income when applied to the invoice)', rm(p.advanceReceived)],
      ] };
    }
    if (name === 'Balance sheet') {
      // As at today. Income & expense accounts: this financial (calendar) year → current year
      // profit; earlier years → retained profit. Accounts outside the chart (e.g. 9990 journal
      // adjustments) are shown as suspense on the side their balance falls, so it always balances.
      const asAt = bsScope === 'last' ? new Date(year - 1, 11, 31, 23, 59).getTime() : Date.now(); const by = bsScope === 'last' ? year - 1 : year;
      const all = glBalancesTo(asAt);
      const cy = glBalancesBetween(new Date(by, 0, 1).getTime(), asAt);
      const isPL = (a: string) => ['Income', 'Expense'].includes(coaType(a));
      const plTotal = (b: [string, number][]) => b.filter(([a]) => isPL(a)).reduce((s, [, v]) => s - v, 0);
      const cyProfit = plTotal(cy), allProfit = plTotal(all);
      const rows: (string | number)[][] = []; let assets = 0, liab = 0, equity = 0;
      all.filter(([a]) => !isPL(a) && Math.abs(all.find((x) => x[0] === a)![1]) > 0.004).forEach(([a, v]) => {
        const t = coaType(a);
        if (t === 'Asset' || (t === 'Other' && v > 0)) { rows.push([t === 'Asset' ? 'Asset' : 'Asset (suspense)', a, rm2(v)]); assets += v; }
        else if (t === 'Equity') { rows.push(['Equity', a, rm2(-v)]); equity -= v; }
        else { rows.push([t === 'Liability' ? 'Liability' : 'Liability (suspense)', a, rm2(-v)]); liab -= v; }
      });
      rows.push(['Equity', 'Retained profit (previous years)', rm2(allProfit - cyProfit)]);
      rows.push(['Equity', `Current year profit (${by}, from GL income − expenses)`, rm2(cyProfit)]);
      equity += allProfit;
      const ok = Math.abs(assets - (liab + equity)) < 0.01;
      rows.push(['Total', 'Total assets', rm2(assets)], ['Total', 'Total liabilities', rm2(liab)], ['Total', 'Total equity', rm2(equity)], ['Check', 'Assets = Liabilities + Equity', ok ? 'Balanced ✓' : 'Difference ' + rm2(assets - liab - equity)]);
      return { period: fd(asAt), cols: ['Type', 'Account', 'Balance'], rows: generalLedger.length ? rows : noGL.map((r) => ['', ...r]) };
    }
    if (name === 'Fees by fee earner & practice area') {
      const g = new Map<string, { billed: number; collected: number; unbilled: number }>();
      const key = (caseKey?: string, ref?: string) => { const k = findCase(lk, caseKey, ref); return `${(k?.partners || [])[0] || '—'} · ${k?.practiceArea || k?.type || 'Unclassified'}`; };
      const add = (k: string, f: 'billed' | 'collected' | 'unbilled', v: number) => { const x = g.get(k) || { billed: 0, collected: 0, unbilled: 0 }; x[f] += v; g.set(k, x); };
      invoices.filter((i) => i.status !== 'Voided' && F.invIssued(i) && inYear(i.date)).forEach((i) => add(key(i.caseId, i.fileRef), 'billed', Number(i.total || 0)));
      payments.filter((p) => inYear(p.date)).forEach((p) => { const i = invoices.find((x) => x.id === p.invoiceId); if (i && i.status !== 'Voided') add(key(i.caseId, i.fileRef), 'collected', Number(p.amount || 0)); });
      F.unbilled.forEach((u) => add(key(u.caseId), 'unbilled', u.time + u.disb));
      return { period: 'YTD ' + year, cols: ['Partner · practice area', 'Billed', 'Collected', 'Unbilled'], rows: [...g.entries()].map(([k, v]) => [k, rm(v.billed), rm(v.collected), rm(v.unbilled)]) };
    }
    if (name === 'Profit sharing') {
      const r = F.feeShareFor(F.period);
      const nm = (id: string) => r.people.find((p) => p.id === id)?.name || id;
      if (psMode === 'file') return { period: `${F.monShort} ${year}`, cols: ['File', 'Client', 'Collected', 'Shares', "Firm's share"], rows: r.rows.map((x) => [x.ref, x.client, rm2(x.amount), Object.keys(x.sh).map((c) => nm(c) + ' ' + rm2(x.sh[c])).join(' · ') || '—', rm2(x.firm)]) };
      return { period: `${F.monShort} ${year}`, cols: ['Person', 'Role', 'Files', 'Referral', 'Fee sharing', "Share of firm profit", 'Total'], rows: r.people.filter((p) => r.tot[p.id]?.amt || r.pp[p.id]?.fsh).map((p) => { const t = r.tot[p.id]; const fsh = r.pp[p.id]?.fsh || 0; return [p.name, p.t, t.files.length, rm2(t.ref), rm2(t.amt - t.ref), rm2(fsh), rm2(t.amt + fsh)]; }) };
    }
    if (name === 'Aged debtors') return { period: fd(Date.now()), cols: ['Invoice', 'Client', 'Issued', 'Days', 'Age', 'Balance'], rows: F.openInvoices.map((i) => { const d = F.ageDays(i); return [i.id, i.partyName || F.clientName(i.clientId) || '—', fd(i.date), d, d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+', rm2(F.invBal(i))]; }) };
    if (name === 'Unbilled work (WIP)') return { period: fd(Date.now()), cols: ['Matter', 'Client', 'Time', 'Disbursements', 'Total', 'Oldest (days)'], rows: F.unbilled.map((u) => [u.ref + (u.title ? ' · ' + u.title : ''), u.client, rm(u.time), rm(u.disb), rm(u.time + u.disb), u.oldest]) };
    if (name === 'Client account reconciliation') {
      const rows = prev2.concat([new Date(year, F.now.getMonth(), 1)]).map((mm) => { const r = F.reconFor(mm); const tick = (F.settings.monthEndClose || {})[`${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, '0')}:c7`]; return [`${MON[mm.getMonth()]} ${mm.getFullYear()}`, rm2(r.ledgers), rm2(r.cash), r.bank == null ? '— (no statement)' : rm2(r.bank), r.status, tick ? `${tick.by} ${fd(tick.at)}` : '—']; });
      return { period: `${MON[prev2[0].getMonth()]}–${F.monShort} ${year}`, cols: ['Month', 'Client ledgers', 'Cash book', 'Bank statement', 'Status', 'Signed off'], rows };
    }
    if (name === "Accountant's report pack") return { period: String(year), cols: ['Client', 'Matter', 'Balance', 'Last movement', 'Entries'], rows: F.ledgers.map((l) => [l.client, l.ref, rm2(l.balance), fd(l.last), l.entries.length]), extra: { title: 'Client account movements ' + year, cols: ['Date', 'Client', 'Type', 'Amount', 'Voucher', 'Details'], rows: retainers.filter((r) => inYear(r.date)).map((r) => [fd(r.date), F.clientName(r.clientId) || r.clientId, r.type, rm2(Number(r.amount || 0)), r.voucherNo || r.id, r.remarks || '']) } };
    if (name === 'SST return (SST-02)') {
      const rows = invoices.filter((i) => i.status !== 'Voided' && F.invIssued(i) && Number(i.tax || 0) > 0 && prev2.some((mm) => inPeriod(i.date, `${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, '0')}`))).map((i) => { const c = invoiceComposition(i); return [i.id, fd(i.date), i.partyName || F.clientName(i.clientId) || '—', rm2(c.fees + c.reimb), rm2(Number(i.tax || 0))]; });
      return { period: sstPeriod, cols: ['Invoice', 'Date', 'Client', 'Taxable (fees + reimbursements)', 'SST charged'], rows: rows.length ? rows : [[F.settings.sstRegistered ? 'No SST charged in this period' : 'Firm not SST-registered (Firm & Practice Settings)', '', '', '', '']] };
    }
    if (name === 'EPF, SOCSO, EIS & PCB') return { period: `${F.monShort} ${year}`, cols: ['Staff', 'EPF (employee)', 'EPF (employer)', 'SOCSO + EIS (employee)', 'SOCSO + EIS (employer)', 'PCB', 'Zakat'], rows: F.periodSlips.map((p) => [F.staffUser(p.userId)?.name || p.userId, rm2(p.epfEmployee), rm2(p.epfEmployer), rm2(p.socsoEis), p.socsoEisEmployer != null ? rm2(p.socsoEisEmployer) : '—', rm2(p.pcb), rm2(p.zakat)]) };
    if (name === 'EA forms (year end)') {
      const g = new Map<string, number[]>();
      payslips.filter((p) => p.period.startsWith(String(year)) && p.status === 'Paid').forEach((p) => { const c = F.slipCalc(p)!; const x = g.get(p.userId) || [0, 0, 0, 0, 0]; x[0] += c.gross; x[1] += Number(p.epfEmployee || 0); x[2] += Number(p.socsoEis || 0); x[3] += Number(p.pcb || 0); x[4] += Number(p.zakat || 0); g.set(p.userId, x); });
      return { period: String(year), cols: ['Staff', 'Gross pay', 'EPF', 'SOCSO + EIS', 'PCB', 'Zakat'], rows: [...g.entries()].map(([u, x]) => [F.staffUser(u)?.name || u, ...x.map(rm2)]) };
    }
    if (name === 'Trial balance & general ledger') {
      // Trial balance for the selected year: balance-sheet accounts as at 31 Dec, income &
      // expense accounts for that year only, earlier years' profit as retained profit b/f.
      const y = tbYear; const start = new Date(y, 0, 1).getTime(), end = new Date(y, 11, 31).getTime();
      const isPL = (a: string) => ['Income', 'Expense'].includes(coaType(a));
      const before = glBalancesBetween(-Infinity, start - 1);
      const bf = before.filter(([a]) => isPL(a)).reduce((s, [, v]) => s + v, 0);
      const bals: [string, number][] = [...glBalancesTo(end).filter(([a]) => !isPL(a)), ...glBalancesBetween(start, end).filter(([a]) => isPL(a))].filter(([, v]) => Math.abs(v) > 0.004);
      if (Math.abs(bf) > 0.004) bals.push(['Retained profit brought forward (before ' + y + ')', bf]);
      let dr = 0, cr = 0;
      const tb = bals.map(([a, v]) => { if (v > 0) dr += v; else cr -= v; return [a, v > 0 ? rm2(v) : '', v < 0 ? rm2(-v) : '']; });
      tb.push(['Total', rm2(dr), rm2(cr)]);
      const glRows = generalLedger.filter((g) => { const t = parseDate(g.date); return t >= start && t <= end; }).sort((a, b) => a.glNo - b.glNo);
      return { period: 'Year ' + y + (y === year ? ' (to date)' : ''), cols: ['Account', 'Debit', 'Credit'], rows: generalLedger.length ? tb : noGL.map((r) => [...r, '']), extra: { title: 'General ledger ' + y, cols: ['GL no.', 'Date', 'Doc', 'Debit', 'Credit', 'Amount', 'Details'], rows: glRows.map((g) => [g.glNo, fd(g.date), `${g.docType} ${g.docNo}`, g.debit, g.credit, rm2(Number(g.amount || 0)), g.description]) } };
    }
    if (name === 'Referral fees paid') { const r = F.referralFor(inYear); return { period: 'YTD ' + year, cols: ['Referrer', 'Type', 'Files', 'Fees received', 'Rate', 'Referral fee', 'Paid through'], rows: r.rows.map((x) => [x.name, x.type, x.files, rm(x.base), x.flat ? 'flat' : x.rate + '%', rm(x.fee), x.via]) }; }
    return { period: '', cols: ['Item'], rows: [] };
  };

  const toggles = (name: string) => name === 'Profit & loss' ? ([['month', 'This month'], ['ytd', year + ' to date'], ['last', 'FY ' + (year - 1) + ' (closed)']] as const).map(([k, l]) => ({ label: l, on: plScope === k, go: () => setPlScope(k) }))
    : name === 'Balance sheet' ? ([['now', 'As at today'], ['last', '31 Dec ' + (year - 1)]] as const).map(([k, l]) => ({ label: l, on: bsScope === k, go: () => setBsScope(k) }))
    : name === 'Trial balance & general ledger' ? [year, year - 1].map((y) => ({ label: y === year ? year + ' to date' : 'FY ' + y + ' (closed)', on: tbYear === y, go: () => setTbYear(y) }))
    : name === 'Profit sharing' ? ([['person', 'By person'], ['file', 'By file']] as const).map(([k, l]) => ({ label: l, on: psMode === k, go: () => setPsMode(k) })) : [];
  const htmlOf = (name: string) => { const r = report(name); const rows = r.rows.length ? r.rows : [['No records for this period', ...r.cols.slice(1).map(() => '')]]; return { r, html: SD.tableHtml(name, r.period, r.cols, rows) + (r.extra ? '<div style="page-break-after:always"></div>' + SD.tableHtml(r.extra.title, r.period, r.extra.cols, r.extra.rows.length ? r.extra.rows : [['No records', ...r.extra.cols.slice(1).map(() => '')]]) : ''), rows }; };
  const run = (name: string, kind: 'pdf' | 'xls') => {
    const { r, html, rows } = htmlOf(name);
    if (kind === 'pdf') SD.pdf(name, html);
    else { SD.csv(name, [r.cols, ...rows]); if (r.extra) SD.csv(r.extra.title, [r.extra.cols, ...r.extra.rows]); F.toastMsg(name + '.csv downloaded'); }
  };
  // Re-render the open report when its toggle changes.
  React.useEffect(() => { if (!viewing) return; const { r, html } = htmlOf(viewing); F.setPaper({ title: viewing, sub: r.period, html, toggles: toggles(viewing), pdf: () => run(viewing, 'pdf'), xls: () => run(viewing, 'xls') }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viewing, plScope, bsScope, tbYear, psMode]);
  const hadPaper = React.useRef(false);
  React.useEffect(() => { if (F.paper) hadPaper.current = true; else if (hadPaper.current) { hadPaper.current = false; setViewing(null); } }, [F.paper]);
  const asAt = `${F.now.getDate()} ${F.monShort} ${year}`;
  const reports: [string, string, string, string, string][] = [
    ['Performance · for tax accountant', '#2F6F4E', 'Profit & loss', 'Income and expenses for any month, quarter or year.', `${F.monShort} ${year}`],
    ['Performance · for tax accountant', '#2F6F4E', 'Balance sheet', 'What the firm owns and owes at a date.', asAt],
    ['Performance · internal', '#2F6F4E', 'Profit sharing', 'Who got what this month. Switch between By person and By file in View; PDF and Excel follow your choice.', `${F.monShort} ${year}`],
    ['Performance · internal', '#2F6F4E', 'Fees by fee earner & practice area', 'Fees billed and collected by each lawyer, by practice area. Shows performance only; not profit sharing.', 'YTD'],
    ['Money owed', '#8A6534', 'Aged debtors', 'Who owes us, grouped by 0–30, 31–60, 61–90, 90+ days.', asAt],
    ['Money owed', '#8A6534', 'Unbilled work (WIP)', 'Time and disbursements not yet invoiced, by matter.', asAt],
    ['Client account · for auditor', '#B23A2E', 'Client account reconciliation', '3-way reconciliation with sign-off, for the auditor.', `${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`],
    ['Client account · for auditor', '#B23A2E', "Accountant's report pack", "Client account only, for the auditor (Bar Council accountant's report). Cash book, every client ledger, 3-way reconciliations and client-to-office transfers.", String(year)],
    ['Tax & statutory', '#3D6B9C', 'SST return (SST-02)', 'Taxable professional fees and SST collected.', sstPeriod],
    ['Tax & statutory', '#3D6B9C', 'EPF, SOCSO, EIS & PCB', 'Monthly contribution files ready to upload.', `${F.monShort} ${year}`],
    ['Tax & statutory', '#3D6B9C', 'EA forms (year end)', 'Annual pay statement for every staff member.', String(year)],
    ['Books · for tax accountant', '#5B6478', 'Trial balance & general ledger', 'For the accountant at year end.', 'YTD'],
    ['Books · for tax accountant', '#5B6478', 'Referral fees paid', 'Every referral fee by referrer and file.', 'YTD'],
  ];
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <section style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px')}>
        {reports.map(([group, gc, name, note, period]) => (
          <div key={name} style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:6px')}>
            <span style={css(`font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${gc}`)}>{group}</span>
            <strong style={css('font-size:13px;color:#16223A')}>{name}</strong>
            <span style={css('flex:1;font-size:10.5px;line-height:1.45;color:#5B6478')}>{note}</span>
            <div style={css('display:flex;gap:6px;margin-top:4px')}><button type="button" onClick={() => setViewing(name)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>View</button><button type="button" onClick={() => run(name, 'pdf')} style={css('border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>PDF</button><button type="button" onClick={() => run(name, 'xls')} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Excel</button><span style={css('margin-left:auto;align-self:center;font-size:10px;color:#5B6478')}>{period}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
};
