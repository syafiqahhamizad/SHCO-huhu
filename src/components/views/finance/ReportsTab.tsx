import React, { useState } from 'react';
import { localToday, pickDate } from '../../ui/pickDate';
import type { FinanceCtrl } from './useFinanceController';
import { css, fd, findCase, inPeriod, MON, parseDate, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';
import { invoiceComposition } from '../../../lib/financeCalc';
import * as R from '../../../lib/acctReports';
import { acctsOf, bankReconOf, debtorDocsOf, invoiceLinesOf, postingsOf } from './reportData';

/** Reports — design: report cards with View / PDF / Excel; View opens the report on A4 paper.
 * Every figure comes from real records (same definitions as Finance Home and Accounting). */
export const ReportsTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, lk } = F;
  const { invoices, payments, payslips, retainers } = app;
  const year = F.now.getFullYear();
  // Any period can be reported: quick choices plus "Pick dates…".
  type PlScope = 'month' | 'lastMonth' | 'qtr' | 'lastQtr' | 'ytd' | 'last' | 'last2' | 'custom';
  type BsScope = 'now' | 'eom' | 'last' | 'last2' | 'custom';
  const [plScope, setPlScope] = useState<PlScope>('month');
  const [bsScope, setBsScope] = useState<BsScope>('now');
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null);
  const [customAt, setCustomAt] = useState<number | null>(null);
  const toT = (v: string) => new Date(v + 'T00:00:00').getTime();
  const pickRange = async () => {
    const f = await pickDate('Report from', { initial: year + '-01-01' }); if (!f) return;
    const t = await pickDate('Report to', { initial: f > localToday() ? f : localToday() }); if (!t) return;
    if (t < f) { F.toastMsg('"To" is before "From"'); return; }
    setCustom({ from: toT(f), to: new Date(toT(t)).setHours(23, 59, 59, 999) }); setPlScope('custom');
  };
  const pickAt = async () => { const t = await pickDate('As at'); if (!t) return; setCustomAt(new Date(toT(t)).setHours(23, 59, 59, 999)); setBsScope('custom'); };
  const [psMode, setPsMode] = useState<'person' | 'file'>('person');
  const [viewing, setViewing] = useState<string | null>(null);
  /* ------------------------------ reports (real data) ------------------------------ */
  const prev2 = [new Date(year, F.now.getMonth() - 2, 1), new Date(year, F.now.getMonth() - 1, 1)];
  const sstPeriod = `${MON[prev2[0].getMonth()]}–${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`;
  const inYear = (d: unknown) => { const t = parseDate(d); return !!t && new Date(t).getFullYear() === year; };

  const report = (name: string): { period: string; cols: string[]; rows: (string | number)[][]; extra?: { title: string; cols: string[]; rows: (string | number)[][] } } => {
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
    if (name === 'Referral fees by month') {
      // Each referrer's fee month by month (what to pay: voucher for outsiders, payslip for staff, drawings for partners).
      const months = Array.from({ length: 12 }, (_, m) => m);
      const per = months.map((m) => F.referralFor((d) => { const t = parseDate(d); return !!t && new Date(t).getFullYear() === year && new Date(t).getMonth() === m; }));
      const names = [...new Set(per.flatMap((r) => r.rows.map((x) => x.name)))].sort();
      const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const feeOf = (n: string, m: number) => per[m].rows.find((x) => x.name === n)?.fee || 0;
      const rows = names.map((n) => { const via = per.flatMap((r) => r.rows).find((x) => x.name === n)?.via || ''; const tot = months.reduce((a2, m) => a2 + feeOf(n, m), 0); return [n, via, ...months.map((m) => (feeOf(n, m) ? rm(feeOf(n, m)) : '—')), rm(tot)]; });
      if (rows.length) rows.push(['Total', '', ...months.map((m) => { const t = per[m].total; return t ? rm(t) : '—'; }), rm(per.reduce((a2, r) => a2 + r.total, 0))]);
      return { period: String(year), cols: ['Referrer', 'Paid through', ...MON, 'Total'], rows };
    }
    if (name === 'Referral fees paid') { const r = F.referralFor(inYear); return { period: 'YTD ' + year, cols: ['Referrer', 'Type', 'Files', 'Fees received', 'Rate', 'Referral fee', 'Paid through'], rows: r.rows.map((x) => [x.name, x.type, x.files, rm(x.base), x.flat ? 'flat' : x.rate + '%', rm(x.fee), x.via]) }; }
    return { period: '', cols: ['Item'], rows: [] };
  };

  /* ------------------------------ accountant's layout (Bukku style) ------------------------------ */
  const FIRM = 'Syafiqah Hamizad & Co.';
  const day = (d: Date) => d.getTime();
  const monthRange = (y: number, m: number, n = 1): [number, number] => [day(new Date(y, m, 1)), day(new Date(y, m + n, 0, 23, 59, 59))];
  const range = (): [number, number] => {
    const y = F.now.getFullYear(), mo = F.now.getMonth(), q0 = Math.floor(mo / 3) * 3;
    if (plScope === 'month') return monthRange(y, mo);
    if (plScope === 'lastMonth') return monthRange(y, mo - 1);
    if (plScope === 'qtr') return monthRange(y, q0, 3);
    if (plScope === 'lastQtr') return monthRange(y, q0 - 3, 3);
    if (plScope === 'last') return [day(new Date(year - 1, 0, 1)), day(new Date(year - 1, 11, 31, 23, 59, 59))];
    if (plScope === 'last2') return [day(new Date(year - 2, 0, 1)), day(new Date(year - 2, 11, 31, 23, 59, 59))];
    if (plScope === 'custom' && custom) return [custom.from, custom.to];
    return [day(new Date(year, 0, 1)), Date.now()];
  };
  /** [as-at date, start of that date's financial year]. */
  const asAt = (): [number, number] => {
    const at = bsScope === 'last' ? day(new Date(year - 1, 11, 31, 23, 59, 59)) : bsScope === 'last2' ? day(new Date(year - 2, 11, 31, 23, 59, 59))
      : bsScope === 'eom' ? day(new Date(year, F.now.getMonth(), 0, 23, 59, 59)) : bsScope === 'custom' && customAt ? customAt : Date.now();
    return [at, day(new Date(new Date(at).getFullYear(), 0, 1))];
  };
  const reconMonth = () => (bsScope === 'now' ? new Date(F.now.getFullYear(), F.now.getMonth(), 1) : bsScope === 'custom' && customAt ? new Date(new Date(customAt).getFullYear(), new Date(customAt).getMonth(), 1) : new Date(F.now.getFullYear(), F.now.getMonth() - 1, 1));
  const BANK_NAME = (acc: 'Office' | 'Client account') => { const b = (F.settings.banks || []).find((x) => (acc === 'Office' ? !/client/i.test(String(x.type || x.name)) : /client/i.test(String(x.type || x.name)))); return b ? String(b.name || '') + (b.accountNo ? ' - ' + b.accountNo : '') : acc === 'Office' ? 'Office Account' : 'Client Account'; };
  /** Reports in the accountant's layout; null = one of the firm's own reports (simple table). */
  const acctReport = (name: string): R.Report | null => {
    if (name === 'Profit & loss') { const [f, t] = range(); return R.profitAndLoss(FIRM, acctsOf(F), postingsOf(F), f, t); }
    if (name === 'Balance sheet') { const [t, fy] = asAt(); return R.balanceSheet(FIRM, acctsOf(F), postingsOf(F), t, fy); }
    if (name === 'Trial balance') { const [t, fy] = asAt(); return R.trialBalance(FIRM, acctsOf(F), postingsOf(F), t, fy); }
    if (name === 'General ledger') { const [f, t] = range(); return R.generalLedger(FIRM, acctsOf(F), postingsOf(F), f, t); }
    if (name === 'Debtor ledger') { const [f, t] = range(); return R.debtorLedger(FIRM, debtorDocsOf(F), f, t); }
    if (name === 'Invoice summary') { const [f, t] = range(); return R.invoiceSummary(FIRM, invoiceLinesOf(F), f, t); }
    if (name === 'Bank reconciliation · Office account' || name === 'Bank reconciliation · Client account') {
      const acc = name.endsWith('Office account') ? 'Office' : 'Client account';
      const x = bankReconOf(F, acc, reconMonth());
      return R.bankReconciliation(FIRM, BANK_NAME(acc), x.asAt, x.portal, x.statement, x.notCredited, x.unpresented);
    }
    return null;
  };
  const PERIOD_REPORTS = ['Profit & loss', 'General ledger', 'Debtor ledger', 'Invoice summary'];
  const ASAT_REPORTS = ['Balance sheet', 'Trial balance'];
  const fmtD = (t: number) => fd(t);
  const toggles = (name: string) => PERIOD_REPORTS.includes(name) ? [
      ...([['month', 'This month'], ['lastMonth', 'Last month'], ['qtr', 'This quarter'], ['lastQtr', 'Last quarter'], ['ytd', year + ' to date'], ['last', 'FY ' + (year - 1)], ['last2', 'FY ' + (year - 2)]] as const).map(([k, l]) => ({ label: l, on: plScope === k, go: () => setPlScope(k) })),
      { label: plScope === 'custom' && custom ? fmtD(custom.from) + ' – ' + fmtD(custom.to) : 'Pick dates…', on: plScope === 'custom', go: () => void pickRange() },
    ]
    : ASAT_REPORTS.includes(name) ? [
      ...([['now', 'As at today'], ['eom', 'End of last month'], ['last', '31 Dec ' + (year - 1)], ['last2', '31 Dec ' + (year - 2)]] as const).map(([k, l]) => ({ label: l, on: bsScope === k, go: () => setBsScope(k) })),
      { label: bsScope === 'custom' && customAt ? 'As at ' + fmtD(customAt) : 'Pick a date…', on: bsScope === 'custom', go: () => void pickAt() },
    ]
    : name.startsWith('Bank reconciliation') ? [
      ...([['now', 'This month'], ['eom', 'Last month']] as const).map(([k, l]) => ({ label: l, on: bsScope === k || (k === 'eom' && (bsScope === 'last' || bsScope === 'last2')), go: () => setBsScope(k) })),
      { label: bsScope === 'custom' && customAt ? 'Month of ' + fmtD(customAt) : 'Pick a month…', on: bsScope === 'custom', go: () => void pickAt() },
    ]
    : name === 'Profit sharing' ? ([['person', 'By person'], ['file', 'By file']] as const).map(([k, l]) => ({ label: l, on: psMode === k, go: () => setPsMode(k) })) : [];
  /** Every report as the accountant's layout (the firm's own reports as a simple table in the same style). */
  const reportsOf = (name: string): R.Report[] => {
    const a = acctReport(name);
    if (a) return [a];
    const r = report(name);
    const main = R.simpleReport(FIRM, name, r.period, r.cols, r.rows as R.Cell[][]);
    return r.extra ? [main, R.simpleReport(FIRM, r.extra.title, r.period, r.extra.cols, r.extra.rows as R.Cell[][])] : [main];
  };
  const htmlOf = (name: string) => { const rs = reportsOf(name); return { rs, html: rs.map((x) => R.reportHtml(x, F.me || 'SHCO Portal')).join('<div style="page-break-after:always"></div>') }; };
  const run = (name: string, kind: 'pdf' | 'xls') => {
    const { rs, html } = htmlOf(name);
    if (kind === 'pdf') SD.pdf(name, html);
    else { void SD.xlsx(name, rs.flatMap((x, i) => [...(i ? [[]] : []), ...R.reportSheet(x, F.me || 'SHCO Portal')])).then(() => F.toastMsg(name + '.xlsx downloaded')).catch(() => F.toastMsg('Excel could not be made (no internet?). Try again.')); }
  };
  // Re-render the open report when its toggle changes.
  React.useEffect(() => { if (!viewing) return; const { rs, html } = htmlOf(viewing); F.setPaper({ title: viewing, sub: rs[0].period, html, wide: !!rs[0].landscape, toggles: toggles(viewing), pdf: () => run(viewing, 'pdf'), xls: () => run(viewing, 'xls') }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viewing, plScope, bsScope, psMode, custom, customAt]);
  const hadPaper = React.useRef(false);
  React.useEffect(() => { if (F.paper) hadPaper.current = true; else if (hadPaper.current) { hadPaper.current = false; setViewing(null); } }, [F.paper]);
  const asAt0 = `${F.now.getDate()} ${F.monShort} ${year}`;
  const reports: [string, string, string, string, string][] = [
    ['Performance · for tax accountant', '#2F6F4E', 'Profit & loss', 'Income and expenses for any month, quarter or year.', `${F.monShort} ${year}`],
    ['Performance · for tax accountant', '#2F6F4E', 'Balance sheet', 'What the firm owns and owes at a date.', asAt0],
    ['Performance · internal', '#2F6F4E', 'Profit sharing', 'Who got what this month. Switch between By person and By file in View; PDF and Excel follow your choice.', `${F.monShort} ${year}`],
    ['Performance · internal', '#2F6F4E', 'Fees by fee earner & practice area', 'Fees billed and collected by each lawyer, by practice area. Shows performance only; not profit sharing.', 'YTD'],
    ['Money owed', '#8A6534', 'Aged debtors', 'Who owes us, grouped by 0–30, 31–60, 61–90, 90+ days.', asAt0],
    ['Money owed', '#8A6534', 'Unbilled work (WIP)', 'Time and disbursements not yet invoiced, by matter.', asAt0],
    ['Client account · for auditor', '#B23A2E', 'Client account reconciliation', '3-way reconciliation with sign-off, for the auditor.', `${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`],
    ['Client account · for auditor', '#B23A2E', "Accountant's report pack", "Client account only, for the auditor (Bar Council accountant's report). Cash book, every client ledger, 3-way reconciliations and client-to-office transfers.", String(year)],
    ['Tax & statutory', '#3D6B9C', 'SST return (SST-02)', 'Taxable professional fees and SST collected.', sstPeriod],
    ['Tax & statutory', '#3D6B9C', 'EPF, SOCSO, EIS & PCB', 'Monthly contribution files ready to upload.', `${F.monShort} ${year}`],
    ['Tax & statutory', '#3D6B9C', 'EA forms (year end)', 'Annual pay statement for every staff member.', String(year)],
    ['Books · for tax accountant', '#5B6478', 'Trial balance', 'Every account’s debit or credit balance, as at a date.', asAt0],
    ['Books · for tax accountant', '#5B6478', 'General ledger', 'Every posting, account by account, with opening and running balances.', 'YTD'],
    ['Books · for tax accountant', '#5B6478', 'Debtor ledger', 'Each client’s invoices and payments, with opening and running balances.', 'YTD'],
    ['Books · for tax accountant', '#5B6478', 'Invoice summary', 'Every invoice issued, with what is still unpaid.', 'YTD'],
    ['Books · for tax accountant', '#5B6478', 'Bank reconciliation · Office account', 'Statement balance against the portal’s office cash book.', `${F.monShort} ${year}`],
    ['Books · for tax accountant', '#5B6478', 'Bank reconciliation · Client account', 'Statement balance, deposits not credited and unpresented cheques, against the client cash book.', `${F.monShort} ${year}`],
    ['Books · for tax accountant', '#5B6478', 'Referral fees paid', 'Every referral fee by referrer and file.', 'YTD'],
    ['Books · for tax accountant', '#5B6478', 'Referral fees by month', 'Each referrer’s fee month by month, to pay by voucher, payslip or drawings.', String(year)],
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
