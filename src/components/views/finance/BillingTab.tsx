import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, inPeriod, picColor, rm } from './financeModel';
import type { Quotation, Receipt } from '../../../types';

export const BillingTab = ({ F }: { F: FinanceCtrl }) => {
  const { docT, setDocT, invF, setInvF, SC } = F;
  const quotes = F.scopedQuotations.filter((q) => q.documentType !== 'Proforma');
  const proformas = F.scopedQuotations.filter((q) => q.documentType === 'Proforma');
  const invAll = F.scopedInvoices;

  /* ---- document flow cards ---- */
  const qS = quotes.map((q) => F.qStatus(q));
  const pUnpaid = proformas.filter((q) => F.qStatus(q) === 'Unpaid');
  const DT: [typeof docT, string, string, string, string][] = [
    ['Quotation', 'QUOT-', 'fee estimate before we start', `${qS.filter((s) => ['Draft', 'Pending Approval', 'Ready', 'Sent'].includes(s)).length} open · ${qS.filter((s) => s === 'Accepted').length} accepted`, '#8A6D3B'],
    ['Proforma', 'QUOT-', 'ask for deposit or retainer', `${pUnpaid.length} unpaid · ${rm(pUnpaid.reduce((s, q) => s + Math.max(0, Number(q.total || 0) - F.proformaPaid(q)), 0))}`, '#3D6B9C'],
    ['Invoice', 'INV-', 'bill for work done (e-Invoice)', `${F.openInvoices.length} open · ${rm(F.owedTotal)}`, '#16223A'],
    ['Receipt', 'HQ-OR-', 'proof we received money', `${F.scopedReceipts.filter((r) => inPeriod(r.date, F.period)).length} issued in ${F.monthName}`, '#2F6F4E'],
  ];

  /* ---- invoices ---- */
  const invFilters = ['All', 'Overdue', 'Part-paid', 'Sent', 'Paid', 'Draft'];
  const invRows = invAll.filter((v) => invF === 'All' || F.invStatus(v) === invF);

  /* ---- other documents ---- */
  const X: Record<string, [string, string]> = { Office: ['#E7EEF6', '#2F5680'], 'Client account': ['#E6EFE9', '#2F6F4E'] };
  const D = {
    Quotation: { title: 'Quotations', sub: 'accepted quotes become the matter budget', col: 'Pay into', newL: '+ New quotation', foot: 'Accepted quotation → proforma for the deposit, or straight to invoice when work is done.' },
    Proforma: { title: 'Proforma invoices', sub: 'a request to pay first · not income yet, no SST', col: 'Pay into', newL: '+ New proforma', foot: 'Deposit for our fees → office account. Deposit for disbursements or purchase price → client account. Paid proforma turns into a receipt; the final invoice deducts it.' },
    Receipt: { title: 'Receipts', sub: 'every ringgit in gets a receipt, numbered by account', col: 'Account', newL: '+ Record money in', foot: 'Office and client account receipts are both numbered HQ-OR-… and tagged by account (Solicitors’ Account Rules 1990 keep the two separate).' },
    Invoice: { title: '', sub: '', col: '', newL: '', foot: '' },
  }[docT];
  type Row = { key: string; no: string; client: string; ref: string; date: string; amt: string; x: string; status: string; action: string; onAct: () => void; view: () => void };
  const docRows: Row[] = docT === 'Receipt'
    ? F.scopedReceipts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r: Receipt) => { const acc = r.accountSet === 'CLIENT' ? 'Client account' : 'Office'; return { key: r.id, no: r.id, client: r.receivedFrom || '—', ref: 'for ' + (r.forNo || r.description || '—') + ' · ' + (r.paymentMethod || '—'), date: F.dShort(r.date), amt: rm(Number(r.amount || 0)), x: acc, status: r.historical ? 'Historical' : 'Issued', action: 'View', onAct: () => F.setView({ kind: 'receipt', id: r.id }), view: () => F.setView({ kind: 'receipt', id: r.id }) }; })
    : docT === 'Invoice' ? [] : (docT === 'Quotation' ? quotes : proformas).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((q: Quotation) => { const a = F.actionsFor('quotation', q)[0]; const kase = F.qCase(q); return { key: q.id, no: q.id, client: q.clientName || '—', ref: `${q.fileRef || kase?.ref || '—'} · ${q.practiceArea || '—'}`, date: F.dShort(q.date), amt: rm(Number(q.total || 0)), x: q.payInto || 'Office', status: F.qStatus(q), action: a, onAct: () => F.act('quotation', q, a), view: () => F.setView({ kind: 'quotation', id: q.id }) }; });
  const docNewClick = () => (docT === 'Receipt' ? F.openForm('moneyIn', { account: 'Office' }) : F.openNew(docT));

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <section style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px')}>
        {DT.map(([label, prefix, what, stat, color], i) => { const on = docT === label; return (
          <button key={label} type="button" onClick={() => setDocT(label)} style={css(`position:relative;display:flex;flex-direction:column;gap:4px;text-align:left;border-radius:12px;padding:12px 14px;cursor:pointer;font-family:inherit;border:1.5px solid ${on ? color : '#DDE3EB'};background:${on ? '#fff' : '#FBFCFD'}`)}>
            <span style={css('display:flex;align-items:center;gap:6px')}><span style={css(`width:20px;height:20px;border-radius:9999px;display:grid;place-items:center;font-size:10px;font-weight:800;color:#fff;background:${color}`)}>{i + 1}</span><strong style={css('font-size:13px;color:#16223A')}>{label}</strong><span style={css('margin-left:auto;font-size:10px;color:#5B6478')}>{prefix}</span></span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{what}</span>
            <span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{stat}</span>
          </button>
        ); })}
      </section>

      {docT === 'Invoice' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Invoices</strong>
            <div style={css('display:flex;gap:4px;margin-left:8px')}>{invFilters.map((f) => { const on = invF === f; const n = f === 'All' ? invAll.length : invAll.filter((v) => F.invStatus(v) === f).length; return <button key={f} type="button" onClick={() => setInvF(f)} style={css(`white-space:nowrap;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{f} · {n}</button>; })}</div>
            <span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>e-Invoice: LHDN MyInvois not connected yet</span></div>
          <div style={css('display:grid;grid-template-columns:86px minmax(0,1.4fr) 84px 90px 90px 90px 70px 90px 84px 100px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>No.</span><span>Client · matter</span><span>Issued</span><span style={css('text-align:right')}>Total</span><span style={css('text-align:right')}>Paid</span><span style={css('text-align:right')}>Balance</span><span style={css('text-align:right')}>Days</span><span>Status</span><span>e-Invoice</span><span></span></div>
          {invRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{invAll.length ? 'No invoices with this status.' : 'No invoices yet. Create one from unbilled work below, or with “New quotation or invoice”.'}</div>}
          {invRows.map((d) => {
            const st = F.invStatus(d); const paid = F.invPaid(d); const a = F.actionsFor('invoice', d)[0]; const c = SC[st] || SC.Draft; const kase = F.invCase(d);
            const days = F.ageDays(d); const einv = d.eInvoiceStatus && d.eInvoiceStatus !== 'Not Submitted' ? d.eInvoiceStatus : '—';
            return (
              <div key={d.id} style={css(`display:grid;grid-template-columns:86px minmax(0,1.4fr) 84px 90px 90px 90px 70px 90px 84px 100px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;opacity:${st === 'Voided' ? 0.55 : 1}`)}>
                <button type="button" onClick={() => F.setView({ kind: 'invoice', id: d.id })} style={css('border:0;background:none;padding:0;text-align:left;font-size:11px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:underline;overflow:hidden;text-overflow:ellipsis')}>{d.id}</button>
                <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{d.partyName || F.clientName(d.clientId) || '—'}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{(d.fileRef || kase?.ref || '—') + ' · ' + (kase?.practiceArea || kase?.type || '—')}</span></span>
                <span style={css('font-size:11px;color:#5B6478')}>{st === 'Draft' ? '—' : F.dShort(d.date)}</span>
                <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(Number(d.total || 0))}</span>
                <span style={css('text-align:right;font-size:11.5px;color:#5B6478')}>{paid ? rm(paid) : '—'}</span>
                <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{st === 'Voided' ? '—' : rm(F.invBal(d))}</span>
                <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${days > 90 ? '#B23A2E' : days > 60 ? '#8A6534' : '#5B6478'}`)}>{['Paid', 'Draft', 'Voided', 'Written off'].includes(st) ? '—' : days + 'd'}</span>
                <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${c[0]};color:${c[1]}`)}>{st}</span>
                <span style={css(`font-size:10.5px;font-weight:600;color:${einv === 'Validated' ? '#2F6F4E' : einv === 'Pending' ? '#8A6534' : '#94A3B8'}`)}>{einv}</span>
                <button type="button" onClick={() => F.act('invoice', d, a)} style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{a}</button>
              </div>
            );
          })}
        </div>
      )}

      {docT !== 'Invoice' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>{D.title}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{D.sub}</span><button type="button" onClick={docNewClick} style={css('margin-left:auto;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{D.newL}</button></div>
          <div style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>No.</span><span>Client · matter</span><span>Date</span><span style={css('text-align:right')}>Amount</span><span>{D.col}</span><span>Status</span><span></span></div>
          {docRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No {D.title.toLowerCase()} yet.</div>}
          {docRows.map((r) => { const c = SC[r.status] || SC.Draft; const x = X[r.x] || X.Office; return (
            <div key={r.key} style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 110px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
              <button type="button" onClick={r.view} style={css('border:0;background:none;padding:0;text-align:left;font-size:11px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:underline;overflow:hidden;text-overflow:ellipsis')}>{r.no}</button>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.client}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{r.ref}</span></span>
              <span style={css('font-size:11px;color:#5B6478')}>{r.date}</span>
              <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{r.amt}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${x[0]};color:${x[1]}`)}>{r.x}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${c[0]};color:${c[1]}`)}>{r.status}</span>
              <button type="button" onClick={r.onAct} style={css('justify-self:end;white-space:nowrap;border:1px solid #DDE3EB;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{r.action}</button>
            </div>
          ); })}
          <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>{D.foot}</div></div>
      )}

      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Work not billed yet</strong><span style={css('font-size:10.5px;color:#5B6478')}>time + disbursements recorded in Matters, oldest first</span><span style={css('margin-left:auto;font-size:12px;font-weight:700;color:#16223A')}>{rm(F.unbilled.reduce((s, u) => s + u.time + u.disb, 0))} still to bill</span></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1.5fr) 44px 90px 90px 90px 80px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Matter</span><span>PIC</span><span style={css('text-align:right')}>Time</span><span style={css('text-align:right')}>Disb.</span><span style={css('text-align:right')}>Total</span><span style={css('text-align:right')}>Oldest</span><span></span></div>
        {F.unbilled.length === 0 && Object.keys(F.billed).length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing unbilled: no billable time or disbursements are waiting.</div>}
        {[...F.unbilled, ...Object.values(F.billed).map((b) => b.u as (typeof F.unbilled)[number]).filter((b) => !F.unbilled.some((u) => u.caseId === b.caseId))].map((u) => { const inv = F.billed[u.caseId]?.inv; return (
          <div key={u.caseId} style={css(`display:grid;grid-template-columns:minmax(0,1.5fr) 44px 90px 90px 90px 80px 110px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;opacity:${inv ? 0.6 : 1}`)}>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{u.client}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{u.ref}{u.title ? ' · ' + u.title : ''}</span></span>
            <span style={css(`width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;color:#fff;background:${picColor(u.pic)}`)}>{u.pic}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(u.time)}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(u.disb)}</span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm(u.time + u.disb)}</span>
            <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${u.oldest > 60 ? '#B23A2E' : u.oldest > 30 ? '#8A6534' : '#5B6478'}`)}>{u.oldest} days</span>
            {!inv && <button type="button" onClick={() => F.billMatter(u)} style={css('justify-self:end;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Create invoice</button>}
            {inv && <button type="button" onClick={() => F.setView({ kind: 'invoice', id: inv })} style={css('justify-self:end;border:0;background:none;font-size:10.5px;font-weight:700;color:#2F6F4E;cursor:pointer;font-family:inherit;text-decoration:underline')}>Draft {inv}</button>}
          </div>
        ); })}
      </div>
    </div>
  );
};
