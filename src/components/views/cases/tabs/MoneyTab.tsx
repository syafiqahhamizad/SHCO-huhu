import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { canSeeFinanceView, finRoleKey } from '../../../../lib/financeAccess';
import { css, S, Card, Seg } from '../caseUi';
import { P, fmt, num2, rm, short } from '../caseModel';
import type { WF } from '../wf';

/** Money for this file — read-only, from real invoices / payments / retainers / quotations
 * using the finance module's rules. Actions open Accounts & Finance; nothing is created here. */
export const MoneyTab: React.FC<{ w: WF }> = ({ w }) => {
  const { setCurrentView, currentRole, currentUser, isAdmin } = useApp();
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
    ['Received', rm(money.received), 'Payments and deposits applied', '#1F5A3B'],
    ['Outstanding', rm(money.outstanding), 'Debtor balance', '#8E2A20'],
    ['Client account', rm(money.clientBalance), 'Held for this client (SAR 1990)', '#2F4F7A'],
  ];
  const rows = led === 'client' ? money.clientLedger : led === 'disb' ? money.disbLedger : money.officeLedger;
  const bc = 'display:grid;grid-template-columns:110px 90px 100px 100px 80px 110px 100px 100px 90px;min-width:960px;';
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
        <div style={css(S.head + ';min-width:960px')}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Bills</strong><span style={css(S.sub)}>Fees, disbursements and SST on each bill</span></div>
        <div style={css(bc + S.th)}><span>Bill no.</span><span>Date</span><span>Prof. fees</span><span>Disb.</span><span>SST</span><span>Total</span><span>Paid</span><span>Balance</span><span>Status</span></div>
        {money.bills.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((b) => {
          const pill = b.status === 'Paid' ? P.g : b.status === 'Part-paid' ? P.a : b.issued ? P.b : P.n;
          return (
            <div key={b.id} style={css(bc + 'align-items:center;' + S.row + ';color:#16223A')}>
              <span style={css('font-family:ui-monospace, monospace')}>{b.id}</span><span>{fmt(b.date)}</span><span>{num2(b.fees) || '—'}</span><span>{num2(b.disb) || '—'}</span><span>{num2(b.sst) || '—'}</span><strong>{num2(b.total) || '0.00'}</strong><span style={css('color:#1F5A3B')}>{num2(b.paid) || '—'}</span><strong style={css(`color:${b.bal ? '#8E2A20' : '#1F5A3B'}`)}>{b.issued ? num2(b.bal) || '0.00' : '—'}</strong>
              <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{b.status}</span>
            </div>
          );
        })}
        {!money.bills.length && <div style={css(S.empty)}>No bills on this file yet.</div>}
      </Card>
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
