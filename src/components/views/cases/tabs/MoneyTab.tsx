import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { canSeeFinanceView, finRoleKey } from '../../../../lib/financeAccess';
import { css, S, Card, Seg } from '../caseUi';
import { P, fmt, num2, rm, short } from '../caseModel';
import type { WF } from '../wf';

/** Money for this file — read-only, from real invoices / payments / retainers / quotations
 * using the finance module's rules. Actions open Accounts & Finance; nothing is created here. */
export const MoneyTab: React.FC<{ w: WF }> = ({ w }) => {
  const { setCurrentView, currentRole, currentUser, isAdmin, quotations = [], pastInvoices = [], pastReceipts = [] } = useApp();
  const { c, money } = w;
  const [led, setLed] = useState<'client' | 'office' | 'disb'>('client');
  const rk = finRoleKey(currentRole, currentUser, isAdmin);
  const go = (view: string, what: string) => {
    if (!canSeeFinanceView(view, rk)) { w.toast(what + ' is done by Accounts / a partner in Accounts & Finance'); return; }
    setCurrentView(view);
    w.toast(what + ': Accounts & Finance opened. Choose file ' + c.ref + ' there');
  };
  const acts: [string, string, string][] = [['+ Official receipt', 'billing', 'Official receipt'], ['+ Payment voucher', 'retainers', 'Payment voucher'], ['Transfer client → office', 'retainers', 'Client-to-office transfer'], ['Statement of account', 'retainers', 'Statement of account']];
  const q = money.accepted[0] || money.quotes[0];
  const stats: [string, string, string, string][] = [
    ['Agreed fees', money.agreed ? rm(money.agreed) : '—', q ? (money.accepted.length ? 'Accepted quotation ' : 'Quotation ' + q.status.toLowerCase() + ' ') + q.id : 'No quotation linked to this file', '#16223A'],
    ['Billed', rm(money.billed), money.bills.filter((b) => b.issued).length + ' bill(s) incl. SST', '#16223A'],
    ['Received', rm(money.received), money.advance ? 'incl. ' + rm(money.advance) + ' paid in advance (proforma)' : 'Payments and deposits applied', '#1F5A3B'],
    ['Outstanding', rm(money.outstanding), 'Debtor balance', '#8E2A20'],
    ['Client account', rm(money.clientBalance), 'Held for this client (SAR 1990)', '#2F4F7A'],
  ];
  const rows = led === 'client' ? money.clientLedger : led === 'disb' ? money.disbLedger : money.officeLedger;
  const bc = 'display:grid;grid-template-columns:110px 90px 100px 90px 90px 80px 110px 100px 100px 90px;min-width:1050px;';
  const pc = 'display:grid;grid-template-columns:120px 90px minmax(0,1fr) 110px 100px 100px 90px;gap:12px;min-width:720px;';
  // Papers from before the portal on this file, by category (for reference; past invoices / receipts are not counted above).
  const onThis = (caseId?: string, ref?: string) => (!!caseId && (caseId === c.id || caseId === c.ref)) || (!!ref && ref === c.ref);
  type PI = { category?: string; amount?: number; quantity?: number; unitPrice?: number };
  const split = (items: PI[] = []) => { const amt = (i: PI) => Number(i.amount ?? (Number(i.quantity || 1) * Number(i.unitPrice || 0))) || 0; const d = items.filter((i) => i.category === 'Disbursement').reduce((a, i) => a + amt(i), 0); const r = items.filter((i) => i.category === 'Reimbursement').reduce((a, i) => a + amt(i), 0); const f = items.filter((i) => !['Disbursement', 'Reimbursement', 'Tax'].includes(String(i.category))).reduce((a, i) => a + amt(i), 0); return { f, r, d }; };
  const past = [
    ...quotations.filter((q) => q.historical && onThis(q.caseId, q.fileRef)).map((q) => ({ type: q.documentType === 'Proforma' ? 'Proforma' : 'Quotation', no: q.id, date: q.date, ...split(q.lineItems as PI[]), sst: 0, total: Number(q.total || 0), file: q.pastFile })),
    ...pastInvoices.filter((i) => onThis(i.caseId, i.fileRef)).map((i) => ({ type: 'Invoice', no: i.pastNo || i.id, date: i.date, ...split(i.lineItems as PI[]), sst: Number(i.tax || 0), total: Number(i.total || 0), file: i.pastFile })),
    ...pastReceipts.filter((r) => onThis(r.caseId, r.fileRef)).map((r) => ({ type: 'Receipt', no: r.pastNo || r.id, date: r.date, f: 0, r: 0, d: 0, sst: 0, total: Number(r.amount || 0), file: r.pastFile })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const pc2 = 'display:grid;grid-template-columns:90px 130px 90px 90px 80px 90px 70px 100px 70px;gap:10px;min-width:900px;';
  const lc = 'display:grid;grid-template-columns:90px 120px minmax(0,1fr) 100px 100px 110px;min-width:720px;';
  return (
    <>
      <div style={css('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
        <span style={css('font-size:12px;color:#4A5468')}>Money for this file only. Firm-wide books are in Accounts &amp; Finance.</span>
        <div style={css('margin-left:auto;display:flex;gap:8px;flex-wrap:wrap')}>{acts.map(([l, v, what]) => <button key={l} type="button" onClick={() => go(v, what)} style={css(S.btnSec)}>{l}</button>)}</div>
      </div>
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px')}>
        {stats.map(([k, v, sub, col]) => <div key={k} style={css('display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><span style={css(S.label)}>{k}</span><strong style={css(`font-size:18px;color:${col}`)}>{v}</strong><span style={css('font-size:11.5px;color:#4A5468')}>{sub}</span></div>)}
      </div>
      <Card style="overflow-x:auto">
        <div style={css(S.head + ';min-width:1050px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Bills</strong><span style={css(S.sub)}>Fees, reimbursements, disbursements and SST on each bill</span></div>
        <div style={css(bc + S.th)}><span>Bill no.</span><span>Date</span><span>Prof. fees</span><span>Reimb.</span><span>Disb.</span><span>SST</span><span>Total</span><span>Paid</span><span>Balance</span><span>Status</span></div>
        {money.bills.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((b) => {
          const pill = b.status === 'Paid' ? P.g : b.status === 'Part-paid' ? P.a : b.issued ? P.b : P.n;
          return (
            <div key={b.id} style={css(bc + 'align-items:center;' + S.row + ';color:#16223A')}>
              <span style={css('font-family:ui-monospace, monospace')}>{b.id}</span><span>{fmt(b.date)}</span><span>{num2(b.prof) || '—'}</span><span>{num2(b.reimb) || '—'}</span><span>{num2(b.disb) || '—'}</span><span>{num2(b.sst) || '—'}</span><strong>{num2(b.total) || '0.00'}</strong><span style={css('color:#1F5A3B')}>{num2(b.paid) || '—'}</span><strong style={css(`color:${b.bal ? '#8E2A20' : '#1F5A3B'}`)}>{b.issued ? num2(b.bal) || '0.00' : '—'}</strong>
              <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{b.status}</span>
            </div>
          );
        })}
        {!money.bills.length && <div style={css(S.empty)}>No bills on this file yet.</div>}
      </Card>
      {money.proformas.length > 0 && <Card style="overflow-x:auto">
        <div style={css(S.head + ';min-width:720px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Proformas</strong><span style={css(S.sub)}>requests to pay first · money paid here is held in advance until the invoice uses it</span></div>
        <div style={css(pc + S.th)}><span>Proforma no.</span><span>Date</span><span>For</span><span>Pay into</span><span>Amount</span><span>Paid</span><span>Status</span></div>
        {money.proformas.map((p) => {
          const pill = p.status === 'Paid' ? P.g : p.status === 'Part-paid' ? P.a : p.status === 'Unpaid' ? P.b : P.n;
          return (
            <div key={p.id} style={css(pc + 'align-items:center;' + S.row + ';color:#16223A')}>
              <span style={css('font-family:ui-monospace, monospace')}>{p.id}</span><span>{fmt(p.date)}</span><span>{p.what || '—'}</span><span>{p.payInto}</span><strong>{num2(p.total) || '0.00'}</strong><span style={css('color:#1F5A3B')}>{num2(p.paid) || '—'}</span>
              <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{p.status}</span>
            </div>
          );
        })}
      </Card>}
      {past.length > 0 && <Card style="overflow-x:auto">
        <div style={css(S.head + ';min-width:900px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Before the portal</strong><span style={css(S.sub)}>past quotations, proformas, invoices and receipts on this file, by category · for reference</span></div>
        <div style={css(pc2 + S.th)}><span>Type</span><span>No.</span><span>Date</span><span>Prof. fees</span><span>Reimb.</span><span>Disb.</span><span>SST</span><span>Total</span><span>PDF</span></div>
        {past.map((x) => (
          <div key={x.type + x.no} style={css(pc2 + 'align-items:center;' + S.row + ';color:#16223A')}>
            <span><span style={css('padding:1px 7px;border-radius:8px;background:#F1EBF6;color:#6B3D8C;font-size:10px;font-weight:800')}>PAST</span> {x.type}</span><span style={css('font-family:ui-monospace, monospace')}>{x.no}</span><span>{fmt(x.date)}</span><span>{num2(x.f) || '—'}</span><span>{num2(x.r) || '—'}</span><span>{num2(x.d) || '—'}</span><span>{num2(x.sst) || '—'}</span><strong>{num2(x.total) || '0.00'}</strong>
            <span>{x.file && (x.file.webViewLink || x.file.driveFileId) ? <a href={x.file.webViewLink || 'https://drive.google.com/file/d/' + x.file.driveFileId + '/view'} target="_blank" rel="noopener noreferrer" style={css('font-weight:700;color:#3D6B9C')}>View</a> : '—'}</span>
          </div>
        ))}
      </Card>}
      <Card style="overflow-x:auto">
        <div style={css(S.head + ';min-width:720px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Matter ledger</strong><Seg items={[['client', 'Client account'], ['office', 'Office account'], ['disb', 'Disbursement account']]} value={led} onChange={(k) => setLed(k as 'client' | 'office' | 'disb')} /><span style={css('margin-left:auto;font-size:12px;color:#4A5468')}>{led === 'client' ? 'Client money in and out. Can never go below zero.' : led === 'disb' ? 'Paid out for the client, and paid back by them. Balance = still to recover.' : 'Fees and SST billed, and payments received.'}</span></div>
        <div style={css(lc + S.th)}><span>Date</span><span>Doc no.</span><span>Description</span><span>Debit</span><span>Credit</span><span>Balance</span></div>
        {rows.map((l, i) => (
          <div key={i} style={css(lc + 'gap:12px;align-items:center;padding:9px 16px;border-top:1px solid #F0F2F5;font-size:12.5px;color:#16223A')}>
            <span>{short(l.date)}</span><span style={css('font-family:ui-monospace, monospace;font-size:11.5px;color:#8A6D3B')}>{l.doc}</span><span>{l.desc}</span><span style={css('color:#8E2A20')}>{num2(l.dr)}</span><span style={css('color:#1F5A3B')}>{num2(l.cr)}</span><strong>{rm(l.bal)}</strong>
          </div>
        ))}
        {!rows.length && <div style={css(S.empty)}>{led === 'client' ? 'No client money held or paid out on this file.' : led === 'disb' ? 'No disbursements paid for this file yet.' : 'No bills issued on this file yet.'}</div>}
      </Card>
    </>
  );
};
