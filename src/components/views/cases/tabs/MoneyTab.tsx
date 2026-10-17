import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { canSeeFinanceView, finRoleKey } from '../../../../lib/financeAccess';
import { css, S, Card, Seg } from '../caseUi';
import { P, fmt, num2, rm, short } from '../caseModel';
import type { WF } from '../wf';
import { billPart, quotedCosts, quotedFees, type QuotedDisb } from '../../../../lib/quotedDisb';

/** Money for this file — read-only, from real invoices / payments / retainers / quotations
 * using the finance module's rules. Actions open Accounts & Finance; nothing is created here. */
export const MoneyTab: React.FC<{ w: WF }> = ({ w }) => {
  const { setCurrentView, currentRole, currentUser, isAdmin, quotations = [], invoices = [], expenses = [], travelClaims = [], paymentVouchers = [] } = useApp();
  const { c, money } = w;
  const [led, setLed] = useState<'client' | 'office' | 'disb'>('client');
  // Quoted disbursements vs what was actually paid for each.
  const qd = quotedCosts(c, quotations, invoices, expenses, 'Disbursement');
  const qr = quotedCosts(c, quotations, invoices, expenses, 'Reimbursement', travelClaims);
  const feesQ = quotedFees(c, quotations, invoices);
  const refunded = paymentVouchers.filter((v) => v.voucherCategory === 'Client Refund' && (v.caseId === c.id || v.fileRef === c.ref)).reduce((t, v) => t + Number(v.amount || 0), 0);
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
  const dq = 'display:grid;grid-template-columns:minmax(0,1.6fr) 100px 100px 140px;gap:12px;min-width:640px;';
  // One box per kind: quoted items vs what was actually paid. Reimbursement: what is left is profit.
  const costBox = (q: QuotedDisb) => { const R = q.kind === 'Reimbursement'; return (
    <Card key={q.kind} style="overflow-x:auto">
      <div style={css(S.head + ';min-width:640px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>{R ? 'Reimbursements: charged vs our cost' : 'Disbursements: quoted vs paid'}</strong><span style={css(S.sub)}>{q.source.length ? 'from ' + q.source.join(', ') : 'nothing quoted'} · the total is what counts: items are a guide{R ? '' : '; anything above the total is billed'}</span></div>
      <div style={css(dq + S.th)}><span>Item</span><span>{R ? 'Charged' : 'Quoted'}</span><span>{R ? 'Our cost' : 'Paid'}</span><span>Status</span></div>
      {q.rows.map((r) => { const st = r.quoted <= 0 ? ['Within the total', P.b] : r.paid <= 0.005 ? ['Not used yet', P.n] : r.left < -0.005 ? ['RM ' + num2(-r.left) + ' more than listed', P.a] : r.left > 0.005 ? ['RM ' + num2(r.left) + (R ? ' profit' : ' not used'), R ? P.g : P.a] : ['Used', P.g]; const pill = st[1] as { bg: string; fg: string }; return (
        <div key={r.desc} style={css(dq + 'align-items:center;' + S.row + ';color:#16223A')}><span>{r.desc}</span><span>{num2(r.quoted)}</span><span>{num2(r.paid) || '—'}</span><span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{st[0] as string}</span></div>
      ); })}
      {q.extras.map((e) => <div key={e.id} style={css(dq + 'align-items:center;' + S.row + ';color:#16223A')}><span>{e.description || e.category}{e.quoteCovered != null && e.quoteLine ? <span style={css('color:#8E2A20;font-size:11.5px')}> · staff claim {e.id}: part above the quote</span> : !/above the quoted/.test(e.description || '') && <span style={css('color:#4A5468;font-size:11.5px')}> · not part of the quote</span>}</span><span>—</span><span>{num2(billPart(e))}</span><span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${P.b.bg};color:${P.b.fg}`)}>{e.billed ? 'Billed' : 'To bill'}</span></div>)}
      {q.rows.length > 0 && <div style={css(dq + 'align-items:center;padding:9px 16px;border-top:1px solid #DDE3EB;font-size:12.5px;font-weight:700;color:#16223A')}><span>Total {R ? 'reimbursements charged' : 'disbursements quoted'}</span><span>{num2(q.quoted)}</span><span>{num2(q.paid) || '—'}</span><span style={css('color:' + (q.left >= -0.005 ? '#1F5A3B' : '#8E2A20'))}>{R ? (q.left >= -0.005 ? 'Profit RM ' + (num2(q.left) || '0.00') : 'Loss RM ' + num2(-q.left)) : q.left >= -0.005 ? 'Within the quote · RM ' + (num2(q.left) || '0.00') + ' left' : 'RM ' + num2(-q.left) + ' above the quote'}</span></div>}
    </Card>
  ); };
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
      {[qd, qr].map((q) => (q.rows.length > 0 || q.extras.length > 0) && costBox(q))}
      {(feesQ > 0 || qr.quoted > 0 || qd.quoted > 0) && <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>What this file makes</strong><span style={css(S.sub)}>from the quotation · before fee sharing</span></div>
        <div style={css(dq + S.row + ';color:#16223A')}><span>Professional fees quoted</span><span></span><span></span><strong>{num2(feesQ) || '0.00'}</strong></div>
        <div style={css(dq + S.row + ';color:#16223A')}><span>Reimbursement profit <span style={css('color:#4A5468;font-size:11.5px')}>(charged {num2(qr.quoted) || '0.00'} − our cost {num2(qr.paid) || '0.00'})</span></span><span></span><span></span><strong style={css('color:' + (qr.left < -0.005 ? '#8E2A20' : '#1F5A3B'))}>{qr.left < -0.005 ? '−' + num2(-qr.left) : num2(qr.left) || '0.00'}</strong></div>
        <div style={css(dq + 'padding:9px 16px;border-top:1px solid #DDE3EB;font-size:13px;font-weight:700;color:#16223A')}><span>File profit (fees + reimbursement profit)</span><span></span><span></span><span>RM {num2(feesQ + qr.left) || '0.00'}</span></div>
        <div style={css(dq + S.row + ';color:#16223A')}><span>Received so far <span style={css('color:#4A5468;font-size:11.5px')}>(all payments on this file, fees + reimbursements + disbursements)</span></span><span></span><span></span><strong style={css('color:#1F5A3B')}>{num2(money.received) || '0.00'}</strong></div>
        {refunded > 0 && <div style={css(dq + S.row + ';color:#16223A')}><span>Refunded to client</span><span></span><span></span><strong style={css('color:#8E2A20')}>−{num2(refunded)}</strong></div>}
        {qd.quoted > 0 && <div style={css('padding:8px 16px;font-size:11.5px;color:#4A5468')}>Disbursements are not profit: RM {num2(Math.max(0, qd.left)) || '0.00'} of the RM {num2(qd.quoted)} quoted is not used yet.</div>}
      </Card>}
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
