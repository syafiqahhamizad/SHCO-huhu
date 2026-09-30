import React from 'react';
import type { CashAcc, FinanceCtrl } from './useFinanceController';
import { css, fd, findCase, glCode, inPeriod, MON, monthEnd, parseDate, proofUrl, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';
import { computeTotals } from '../../../lib/billingEngine';
import type { Invoice } from '../../../types';

export const BooksReportsTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, cbAcc, setCbAcc, lk } = F;
  const { invoices, payments, receipts, expenses, payslips, paymentVouchers, travelClaims, generalLedger, chartOfAccounts, retainers, threeWayRec } = app;
  const m = SD.money;
  const year = F.now.getFullYear();

  /* ------------------------------ cash book ------------------------------ */
  const SRC: Record<string, [string, string]> = { Auto: ['#E7EEF6', '#2F5680'], Historical: ['#F1EBF6', '#6B3D8C'], Manual: ['#FBF2E9', '#8A6534'] };
  const R = F.cashBook(cbAcc);
  const OPEN = F.openingBalance(cbAcc);
  const hasOpen = F.banksOf(cbAcc).length > 0;
  let bal = OPEN, tin = 0, tout = 0;
  const cbRows = R.map((r) => { bal += r.inn - r.out; tin += r.inn; tout += r.out; return { ...r, bal }; });
  const missing = R.filter((r) => !(r.proofs || []).length).length;
  const cbAccs: [CashAcc, string][] = [['Office', `Office A/C · HLB ${SD.BANK.Office[2]}`], ['Client account', `Client A/C · HLB ${SD.BANK['Client account'][2]}`], ['Disbursement', 'Disbursement A/C'], ['Petty cash', 'Petty cash']];
  const openProofs = (owner: string, proofs: { name: string }[]) => proofs.forEach((q) => { const u = proofUrl(owner, q.name); if (u) window.open(u, '_blank'); else F.toastMsg(q.name + ' (file not stored: object storage is not connected, only the file name is kept)'); });
  const cbExport = () => { SD.csv('Cash book ' + cbAcc, [['Date', 'Details', 'Doc no.', 'Source', 'In', 'Out', 'Balance', 'Proof'], ['—', 'Opening balance', '', 'Historical', '', '', m(OPEN), ''], ...cbRows.map((r) => [fd(r.t), r.who + ' · ' + r.what, r.no, r.src, r.inn ? m(r.inn) : '', r.out ? m(r.out) : '', m(r.bal), r.proofs.map((p) => p.name).join('; ')])]); F.toastMsg('Cash book exported'); };

  /* ------------------------------ reports (real data) ------------------------------ */
  const prev2 = [new Date(year, F.now.getMonth() - 2, 1), new Date(year, F.now.getMonth() - 1, 1)];
  const sstPeriod = `${MON[prev2[0].getMonth()]}–${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`;
  const inYear = (d: unknown) => { const t = parseDate(d); return !!t && new Date(t).getFullYear() === year; };
  const neg = (n: number) => (n ? '(' + rm(Math.abs(n)) + ')' : rm(0));
  const glBalances = () => { const b = new Map<string, number>(); generalLedger.forEach((g) => { b.set(g.debit, (b.get(g.debit) || 0) + Number(g.amount || 0)); b.set(g.credit, (b.get(g.credit) || 0) - Number(g.amount || 0)); }); return [...b.entries()].sort((a, c) => glCode(a[0]).localeCompare(glCode(c[0]))); };
  const coaType = (acct: string) => chartOfAccounts.find((c) => c.code === glCode(acct))?.type || ({ '1': 'Asset', '2': 'Liability', '3': 'Equity', '4': 'Income', '5': 'Expense' } as Record<string, string>)[glCode(acct).slice(0, 1)] || 'Other';
  const noGL: [string, string][] = [['No postings in the general ledger yet', '—']];

  const report = (name: string): { period: string; cols: string[]; rows: (string | number)[][]; extra?: { title: string; cols: string[]; rows: (string | number)[][] } } => {
    if (name === 'Profit & loss') {
      const per = F.period; const invById = new Map<string, Invoice>(invoices.map((i: Invoice) => [i.id, i] as [string, Invoice]));
      const fees = payments.filter((p) => inPeriod(p.date, per) && invById.get(p.invoiceId)?.status !== 'Voided').reduce((s, p) => s + Number(p.amount || 0), 0);
      const otherIn = receipts.filter((r) => r.accountSet !== 'CLIENT' && !r.invoiceId && inPeriod(r.date, per)).reduce((s, r) => s + Number(r.amount || 0), 0);
      const sal = payslips.filter((p) => p.status === 'Paid' && inPeriod(p.paidAt, per)).reduce((s, p) => s + (F.slipCalc(p)?.gross || 0) + Number(p.epfEmployer || 0) + Number(p.socsoEisEmployer || 0), 0);
      const cats = new Map<string, number>();
      expenses.filter((e) => !e.billable && !e.claimant && e.approvalStatus !== 'Rejected' && inPeriod(e.date, per)).forEach((e) => cats.set(e.category || 'Other', (cats.get(e.category || 'Other') || 0) + Number(e.amount || 0)));
      const claims = travelClaims.filter((t) => t.paidAt && inPeriod(t.paidAt, per)).reduce((s, t) => s + Number(t.total || 0), 0) + expenses.filter((e) => e.claimant && e.paidAt && !e.billable && inPeriod(e.paidAt, per)).reduce((s, e) => s + Number(e.amount || 0), 0);
      const pvs = paymentVouchers.filter((v) => v.accountSet !== 'CLIENT' && v.voucherCategory !== 'Disbursement' && v.voucherCategory !== 'Client Disb' && v.paidAt && inPeriod(v.paidAt, per)).reduce((s, v) => s + Number(v.amount || 0), 0);
      const expTot = sal + [...cats.values()].reduce((s, v) => s + v, 0) + claims + pvs;
      return { period: `${F.monShort} ${year}`, cols: ['Item', 'Amount'], rows: [['Fees received (invoices)', rm(fees)], ['Other office receipts', rm(otherIn)], ['Total income', rm(fees + otherIn)], ['Salaries & statutory', neg(sal)], ...[...cats.entries()].map(([k, v]) => [k, neg(v)]), ['Staff claims paid', neg(claims)], ['Payment vouchers paid', neg(pvs)], ['Total expenses', neg(expTot)], ['Net profit', (fees + otherIn - expTot < 0 ? '(' : '') + rm(Math.abs(fees + otherIn - expTot)) + (fees + otherIn - expTot < 0 ? ')' : '')]] };
    }
    if (name === 'Balance sheet') {
      const rows = glBalances().filter(([a]) => ['Asset', 'Liability', 'Equity'].includes(coaType(a))).map(([a, v]) => [coaType(a), a, coaType(a) === 'Asset' ? rm2(v) : rm2(-v)]);
      const pl = glBalances().filter(([a]) => ['Income', 'Expense'].includes(coaType(a))).reduce((s, [, v]) => s - v, 0);
      return { period: fd(Date.now()), cols: ['Type', 'Account', 'Balance'], rows: generalLedger.length ? [...rows, ['Equity', 'Current year profit (from GL income − expenses)', rm2(pl)]] : noGL.map((r) => ['', ...r]) };
    }
    if (name === 'Fees by partner & practice area') {
      const g = new Map<string, { billed: number; collected: number; unbilled: number }>();
      const key = (caseKey?: string, ref?: string) => { const k = findCase(lk, caseKey, ref); return `${(k?.partners || [])[0] || '—'} · ${k?.practiceArea || k?.type || 'Unclassified'}`; };
      const add = (k: string, f: 'billed' | 'collected' | 'unbilled', v: number) => { const x = g.get(k) || { billed: 0, collected: 0, unbilled: 0 }; x[f] += v; g.set(k, x); };
      invoices.filter((i) => i.status !== 'Voided' && F.invIssued(i) && inYear(i.date)).forEach((i) => add(key(i.caseId, i.fileRef), 'billed', Number(i.total || 0)));
      payments.filter((p) => inYear(p.date)).forEach((p) => { const i = invoices.find((x) => x.id === p.invoiceId); if (i && i.status !== 'Voided') add(key(i.caseId, i.fileRef), 'collected', Number(p.amount || 0)); });
      F.unbilled.forEach((u) => add(key(u.caseId), 'unbilled', u.time + u.disb));
      return { period: 'YTD ' + year, cols: ['Partner · practice area', 'Billed', 'Collected', 'Unbilled'], rows: [...g.entries()].map(([k, v]) => [k, rm(v.billed), rm(v.collected), rm(v.unbilled)]) };
    }
    if (name === 'Aged debtors') return { period: fd(Date.now()), cols: ['Invoice', 'Client', 'Issued', 'Days', 'Age', 'Balance'], rows: F.openInvoices.map((i) => { const d = F.ageDays(i); return [i.id, i.partyName || F.clientName(i.clientId) || '—', fd(i.date), d, d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+', rm2(F.invBal(i))]; }) };
    if (name === 'Unbilled work (WIP)') return { period: fd(Date.now()), cols: ['Matter', 'Client', 'Time', 'Disbursements', 'Total', 'Oldest (days)'], rows: F.unbilled.map((u) => [u.ref + (u.title ? ' · ' + u.title : ''), u.client, rm(u.time), rm(u.disb), rm(u.time + u.disb), u.oldest]) };
    if (name === 'Client account reconciliation') {
      const cb = F.cashBook('Client account'); const open = F.openingBalance('Client account');
      const rows = prev2.concat([new Date(year, F.now.getMonth(), 1)]).map((mm) => { const end = monthEnd(mm); const led = F.ledgerTotalAt(end); const cash = open + cb.filter((r) => r.t && r.t <= end.getTime()).reduce((s, r) => s + r.inn - r.out, 0); const row = threeWayRec.find((r) => String(r.month).toLowerCase().startsWith(MON[mm.getMonth()].toLowerCase()) && String(r.month).includes(String(mm.getFullYear()))); const bank = row ? Number(row.bankStatement || 0) : null; const tick = (F.settings.monthEndClose || {})[`${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, '0')}:c7`]; return [`${MON[mm.getMonth()]} ${mm.getFullYear()}`, rm2(led), rm2(cash), bank == null ? '— (no statement)' : rm2(bank), bank == null ? 'Not started' : Math.abs(led - cash) < 0.01 && Math.abs(cash - bank) < 0.01 ? 'Balanced' : 'Difference', tick ? `${tick.by} ${fd(tick.at)}` : '—']; });
      return { period: `${MON[prev2[0].getMonth()]}–${F.monShort} ${year}`, cols: ['Month', 'Client ledgers', 'Cash book', 'Bank statement', 'Status', 'Signed off'], rows };
    }
    if (name === "Accountant's report pack") return { period: String(year), cols: ['Client', 'Matter', 'Balance', 'Last movement', 'Entries'], rows: F.ledgers.map((l) => [l.client, l.ref, rm2(l.balance), fd(l.last), l.entries.length]), extra: { title: 'Client account movements ' + year, cols: ['Date', 'Client', 'Type', 'Amount', 'Voucher', 'Details'], rows: retainers.filter((r) => inYear(r.date)).map((r) => [fd(r.date), F.clientName(r.clientId) || r.clientId, r.type, rm2(Number(r.amount || 0)), r.voucherNo || r.id, r.remarks || '']) } };
    if (name === 'SST return (SST-02)') {
      const rows = invoices.filter((i) => i.status !== 'Voided' && F.invIssued(i) && Number(i.tax || 0) > 0 && prev2.some((mm) => inPeriod(i.date, `${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, '0')}`))).map((i) => { const t = i.lineItems?.length ? computeTotals(i.lineItems, true, SD.defaultSstRate() || 0.08) : null; return [i.id, fd(i.date), i.partyName || F.clientName(i.clientId) || '—', rm2(t ? t.fees + t.reimbursements : Number(i.total || 0) - Number(i.tax || 0)), rm2(Number(i.tax || 0))]; });
      return { period: sstPeriod, cols: ['Invoice', 'Date', 'Client', 'Taxable (fees + reimbursements)', 'SST charged'], rows: rows.length ? rows : [[F.settings.sstRegistered ? 'No SST charged in this period' : 'Firm not SST-registered (Firm & Practice Settings)', '', '', '', '']] };
    }
    if (name === 'EPF, SOCSO, EIS & PCB') return { period: `${F.monShort} ${year}`, cols: ['Staff', 'EPF (employee)', 'EPF (employer)', 'SOCSO + EIS (employee)', 'SOCSO + EIS (employer)', 'PCB', 'Zakat'], rows: F.periodSlips.map((p) => [F.staffUser(p.userId)?.name || p.userId, rm2(p.epfEmployee), rm2(p.epfEmployer), rm2(p.socsoEis), p.socsoEisEmployer != null ? rm2(p.socsoEisEmployer) : '—', rm2(p.pcb), rm2(p.zakat)]) };
    if (name === 'EA forms (year end)') {
      const g = new Map<string, number[]>();
      payslips.filter((p) => p.period.startsWith(String(year)) && p.status === 'Paid').forEach((p) => { const c = F.slipCalc(p)!; const x = g.get(p.userId) || [0, 0, 0, 0, 0]; x[0] += c.gross; x[1] += Number(p.epfEmployee || 0); x[2] += Number(p.socsoEis || 0); x[3] += Number(p.pcb || 0); x[4] += Number(p.zakat || 0); g.set(p.userId, x); });
      return { period: String(year), cols: ['Staff', 'Gross pay', 'EPF', 'SOCSO + EIS', 'PCB', 'Zakat'], rows: [...g.entries()].map(([u, x]) => [F.staffUser(u)?.name || u, ...x.map(rm2)]) };
    }
    if (name === 'Trial balance & general ledger') {
      const tb = glBalances().map(([a, v]) => [a, v > 0 ? rm2(v) : '', v < 0 ? rm2(-v) : '']);
      return { period: 'YTD ' + year, cols: ['Account', 'Debit', 'Credit'], rows: generalLedger.length ? tb : noGL.map((r) => [...r, '']), extra: { title: 'General ledger', cols: ['GL no.', 'Date', 'Doc', 'Debit', 'Credit', 'Amount', 'Details'], rows: generalLedger.slice().sort((a, b) => a.glNo - b.glNo).map((g) => [g.glNo, fd(g.date), `${g.docType} ${g.docNo}`, g.debit, g.credit, rm2(Number(g.amount || 0)), g.description]) } };
    }
    if (name === 'Referral fees paid') { const r = F.referralFor(inYear); return { period: 'YTD ' + year, cols: ['Referrer', 'Type', 'Files', 'Fees received', 'Rate', 'Referral fee', 'Paid through'], rows: r.rows.map((x) => [x.name, x.type, x.files, rm(x.base), x.flat ? 'flat' : x.rate + '%', rm(x.fee), x.via]) }; }
    return { period: '', cols: ['Item'], rows: [] };
  };
  const run = (name: string, kind: 'pdf' | 'xls') => {
    const r = report(name); const rows = r.rows.length ? r.rows : [['No records for this period', ...r.cols.slice(1).map(() => '')]];
    if (kind === 'pdf') SD.pdf(name, SD.tableHtml(name, r.period, r.cols, rows) + (r.extra ? '<div style="page-break-after:always"></div>' + SD.tableHtml(r.extra.title, r.period, r.extra.cols, r.extra.rows.length ? r.extra.rows : [['No records', ...r.extra.cols.slice(1).map(() => '')]]) : ''));
    else { SD.csv(name, [r.cols, ...rows]); if (r.extra) SD.csv(r.extra.title, [r.extra.cols, ...r.extra.rows]); F.toastMsg(name + '.csv downloaded'); }
  };
  const reports: [string, string, string, string, string][] = [
    ['Performance', '#2F6F4E', 'Profit & loss', 'Income and expenses for any month, quarter or year.', `${F.monShort} ${year}`],
    ['Performance', '#2F6F4E', 'Balance sheet', 'What the firm owns and owes at a date.', `${F.now.getDate()} ${F.monShort} ${year}`],
    ['Performance', '#2F6F4E', 'Fees by partner & practice area', 'Billed, collected and unbilled per fee earner.', 'YTD'],
    ['Money owed', '#8A6534', 'Aged debtors', 'Who owes us, grouped by 0–30, 31–60, 61–90, 90+ days.', `${F.now.getDate()} ${F.monShort} ${year}`],
    ['Money owed', '#8A6534', 'Unbilled work (WIP)', 'Time and disbursements not yet invoiced, by matter.', `${F.now.getDate()} ${F.monShort} ${year}`],
    ['Client account', '#B23A2E', 'Client account reconciliation', '3-way reconciliation with sign-off, for the auditor.', `${MON[prev2[1].getMonth()]} ${prev2[1].getFullYear()}`],
    ['Client account', '#B23A2E', "Accountant's report pack", "Everything the reporting accountant needs for the Bar Council accountant's report.", String(year)],
    ['Tax & statutory', '#3D6B9C', 'SST return (SST-02)', 'Taxable professional fees and SST collected.', sstPeriod],
    ['Tax & statutory', '#3D6B9C', 'EPF, SOCSO, EIS & PCB', 'Monthly contribution list from payroll (keyed in from official tables).', `${F.monShort} ${year}`],
    ['Tax & statutory', '#3D6B9C', 'EA forms (year end)', 'Annual pay statement for every staff member.', String(year)],
    ['Books', '#5B6478', 'Trial balance & general ledger', 'For the accountant at year end.', 'YTD'],
    ['Books', '#5B6478', 'Referral fees paid', 'Every referral fee by referrer and file.', 'YTD'],
  ];

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}>
          <strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Cash book</strong><span style={css('font-size:10.5px;color:#5B6478')}>fills in by itself from receipts, payments &amp; transfers</span>
          <div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{cbAccs.map(([k, label]) => { const on = k === cbAcc; return <button key={k} type="button" onClick={() => setCbAcc(k)} style={css(`border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}</div>
          <div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={() => (F.canPrepare ? F.setImp({ src: 'Template', acc: 'Office', raw: null, fileName: 'No file chosen' }) : F.toastMsg('Imports are posted by Accounts.'))} style={css('border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Import past transactions</button><button type="button" onClick={() => (F.canPrepare ? F.openForm('journal', { account: cbAcc }) : F.toastMsg('Journals are prepared by Accounts.'))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Manual journal</button><button type="button" onClick={cbExport} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Excel</button></div>
        </div>
        <div style={css('display:grid;grid-template-columns:84px minmax(0,1.6fr) 110px 96px 100px 100px 110px 150px;gap:10px;padding:7px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Details</span><span>Doc no.</span><span>Source</span><span style={css('text-align:right')}>In</span><span style={css('text-align:right')}>Out</span><span style={css('text-align:right')}>Balance</span><span>Proof</span></div>
        <div style={css('display:grid;grid-template-columns:84px minmax(0,1.6fr) 110px 96px 100px 100px 110px 150px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;background:#FAFBFC')}>
          <span style={css('font-size:11px;color:#5B6478')}>—</span>
          <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>Opening balance</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{hasOpen ? 'brought forward from previous books' : 'no opening balance set on the bank account'}</span></span>
          <span></span>
          <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${SRC.Historical[0]};color:${SRC.Historical[1]}`)}>Historical</span>
          <span></span><span></span>
          <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{m(OPEN)}</span>
          <span></span>
        </div>
        {cbRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No entries in this cash book yet.</div>}
        <div style={css('max-height:520px;overflow:auto')}>
          {cbRows.map((r) => { const pf = r.proofs || []; return (
            <div key={r.key} style={css(`display:grid;grid-template-columns:84px minmax(0,1.6fr) 110px 96px 100px 100px 110px 150px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;background:${pf.length ? '#fff' : '#FFF8F6'}`)}>
              <span style={css('font-size:11px;color:#5B6478')}>{fd(r.t)}</span>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.who}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.what}</span></span>
              <button type="button" onClick={r.open || undefined} style={css(`justify-self:start;border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:${r.open ? 'underline' : 'none'};overflow:hidden;text-overflow:ellipsis;max-width:110px`)}>{r.no}</button>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${SRC[r.src][0]};color:${SRC[r.src][1]}`)}>{r.src}</span>
              <span style={css('text-align:right;font-size:11.5px;color:#2F6F4E')}>{r.inn ? m(r.inn) : ''}</span>
              <span style={css('text-align:right;font-size:11.5px;color:#B23A2E')}>{r.out ? m(r.out) : ''}</span>
              <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{m(r.bal)}</span>
              <span style={css('min-width:0;display:flex;align-items:center;gap:4px')}>
                {pf.length > 0 && <button type="button" onClick={() => openProofs(r.owner, pf)} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#2F6F4E;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px')}>✓ {pf.length > 1 ? pf.length + ' files' : pf[0].name}</button>}
                {r.attach && <label style={css('font-size:10.5px;font-weight:700;color:#B23A2E;cursor:pointer;white-space:nowrap')}>+ Attach<input type="file" multiple accept="image/*,.pdf" onChange={(e) => r.attach && r.attach(e.target.files)} style={css('display:none')} /></label>}
              </span>
            </div>
          ); })}
        </div>
        <div style={css('display:flex;gap:16px;flex-wrap:wrap;padding:9px 14px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>{'Money in ' + m(tin) + ' · money out ' + m(tout) + ' · balance ' + m(bal) + (missing ? ' · ' + missing + ' without proof' : ' · all entries have proof')}</span><span style={css('margin-left:auto;color:#5B6478')}>Each entry also posts to the client ledger (Client Account tab) and the general ledger (Trial balance &amp; GL below).</span></div>
      </div>
      <section style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px')}>
        {reports.map(([group, gc, name, note, period]) => (
          <div key={name} style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:6px')}>
            <span style={css(`font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${gc}`)}>{group}</span>
            <strong style={css('font-size:13px;color:#16223A')}>{name}</strong>
            <span style={css('flex:1;font-size:10.5px;line-height:1.45;color:#5B6478')}>{note}</span>
            <div style={css('display:flex;gap:6px;margin-top:4px')}><button type="button" onClick={() => run(name, 'pdf')} style={css('border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>PDF</button><button type="button" onClick={() => run(name, 'xls')} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Excel</button><span style={css('margin-left:auto;align-self:center;font-size:10px;color:#5B6478')}>{period}</span></div>
          </div>
        ))}
      </section>
    </div>
  );
};
