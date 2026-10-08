import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, inPeriod, picColor, rm } from './financeModel';
import type { Quotation, Receipt } from '../../../types';
import * as SD from '../../../lib/financeDocs';
import { useApp } from '../../../context/AppContext';
import { FEES_FILTERS, billedPct, feesFilter, isOpenFile, moneyForFile, sumMoney, type FeesFilter } from '../../../lib/moneyByFile';

type DocKind = 'quotation' | 'invoice' | 'receipt';
type MenuState = { kind: DocKind; id: string; top: number; left: number } | null;

/** Design: the row action is a split button — main action + ▾ "More actions". */
const Split = ({ label, onAct, onMenu, open }: { label: string; onAct: () => void; onMenu: (e: React.MouseEvent<HTMLButtonElement>) => void; open: boolean }) => (
  <span style={css('justify-self:end;display:flex;align-items:stretch;border:1px solid #DDE3EB;border-radius:6px;background:#fff;overflow:hidden')}>
    <button type="button" onClick={onAct} className="hover:bg-[#F6F8FA]" style={css('white-space:nowrap;border:0;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{label}</button>
    <button type="button" onClick={onMenu} title="More actions" aria-label="More actions" className="hover:bg-[#F6F8FA]" style={css(`border:0;border-left:1px solid #DDE3EB;padding:0 7px;background:${open ? '#F1F4F7' : '#fff'};cursor:pointer;display:grid;place-items:center`)}><span style={css('width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid #5B6478')}></span></button>
  </span>
);

export const BillingTab = ({ F }: { F: FinanceCtrl }) => {
  const { docT, setDocT, invF, setInvF, SC } = F;
  const [menu, setMenu] = useState<MenuState>(null);
  const openMenu = (kind: DocKind, id: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)); const top = r.bottom + 4 + 260 > window.innerHeight ? Math.max(8, r.top - 264) : r.bottom + 4;
    setMenu((m) => (m && m.id === id ? null : { kind, id, top, left }));
  };
  const menuRec = menu ? (menu.kind === 'invoice' ? F.app.invoices.find((i) => i.id === menu.id) : menu.kind === 'quotation' ? F.app.quotations.find((q) => q.id === menu.id) : F.app.receipts.find((r) => r.id === menu.id)) : undefined;
  const menuItems = (): { label: string; go: () => void; fw: number; fg: string; sep: boolean }[] => {
    if (!menu || !menuRec) return [];
    const kind = menu.kind;
    const st = kind === 'invoice' ? F.invStatus(menuRec as import('../../../types').Invoice) : kind === 'quotation' ? F.qStatus(menuRec as Quotation) : 'Issued';
    const acts = F.actionsFor(kind, menuRec as Quotation).filter((a) => a !== 'View' && a !== 'Void');
    const run = (fn: () => void) => () => { setMenu(null); fn(); };
    const canEdit = kind !== 'receipt' && F.rk !== 'R' && ['Draft', 'Sent', 'Accepted', 'Unpaid', 'Ready', 'Pending Approval', 'Overdue', 'Part-paid'].includes(st);
    const doc = () => F.buildDoc({ kind, id: menuRec.id });
    const more: [string, () => void][] = [['View', () => F.setView({ kind, id: menuRec.id })], ...(canEdit ? [['Edit', () => F.editDoc(kind, menuRec as Quotation)] as [string, () => void]] : []), ['Download PDF', () => { const d = doc(); if (d) SD.pdf(d.no, SD.docHtml(d)); }], ...(kind === 'quotation' && (menuRec as Quotation).documentType !== 'Proforma' ? [['Letter of Engagement', () => F.setLoe(menuRec.id)] as [string, () => void]] : []), ...(kind !== 'receipt' && F.rk !== 'R' ? [['Duplicate', () => F.duplicateDoc(kind, menuRec as Quotation)] as [string, () => void]] : [])];
    const danger = F.actionsFor(kind, menuRec as Quotation).includes('Void') ? [{ label: 'Void (credit note)', go: run(() => F.act(kind, menuRec as Quotation, 'Void')), fw: 600, fg: '#B23A2E', sep: true }] : [];
    return [...acts.map((a, i) => ({ label: a, go: run(() => F.act(kind, menuRec as Quotation, a)), fw: i ? 500 : 700, fg: '#16223A', sep: false })), ...more.map(([label, fn], i) => ({ label, go: run(fn), fw: 500, fg: '#16223A', sep: i === 0 })), ...danger];
  };
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
  const invFilters = ['All', 'Overdue', 'Part-paid', 'Sent', 'Paid', 'Draft', 'Voided'];
  const invRows = invAll.filter((v) => invF === 'All' || F.invStatus(v) === invF);

  /* ---- other documents ---- */
  const X: Record<string, [string, string]> = { Office: ['#E7EEF6', '#2F5680'], 'Client account': ['#E6EFE9', '#2F6F4E'] };
  const D = {
    Quotation: { title: 'Quotations', sub: 'accepted quotes become the matter budget', col: 'Pay into', newL: '+ New quotation', foot: 'Accepted quotation → proforma for the deposit, or straight to invoice when work is done.' },
    Proforma: { title: 'Proforma invoices', sub: 'a request to pay first · not income yet, no SST', col: 'Pay into', newL: '+ New proforma', foot: 'Deposit for our fees → office account. Deposit for disbursements or purchase price → client account. Paid proforma turns into a receipt; the final invoice deducts it.' },
    Receipt: { title: 'Receipts', sub: 'every ringgit in gets a receipt, numbered by account', col: 'Account', newL: '+ Record money in', foot: 'Office and client account receipts are both numbered HQ-OR-… and tagged by account (Solicitors’ Account Rules 1990 keep the two separate).' },
    Invoice: { title: '', sub: '', col: '', newL: '', foot: '' },
  }[docT];
  type Row = { kind: DocKind; key: string; no: string; client: string; ref: string; date: string; amt: string; x: string; status: string; action: string; onAct: () => void; view: () => void };
  const docRows: Row[] = docT === 'Receipt'
    ? F.scopedReceipts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r: Receipt) => { const acc = r.accountSet === 'CLIENT' ? 'Client account' : 'Office'; return { kind: 'receipt' as DocKind, key: r.id, no: r.id, client: r.receivedFrom || '—', ref: 'for ' + (r.forNo || r.description || '—') + ' · ' + (r.paymentMethod || '—'), date: F.dShort(r.date), amt: rm(Number(r.amount || 0)), x: acc, status: r.historical ? 'Historical' : 'Issued', action: 'View', onAct: () => F.setView({ kind: 'receipt', id: r.id }), view: () => F.setView({ kind: 'receipt', id: r.id }) }; })
    : docT === 'Invoice' ? [] : (docT === 'Quotation' ? quotes : proformas).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((q: Quotation) => { const a = F.actionsFor('quotation', q)[0]; const kase = F.qCase(q); return { kind: 'quotation' as DocKind, key: q.id, no: q.id, client: q.clientName || '—', ref: `${q.fileRef || kase?.ref || '—'} · ${q.practiceArea || '—'}`, date: F.dShort(q.date), amt: rm(Number(q.total || 0)), x: q.payInto || 'Office', status: F.qStatus(q), action: a, onAct: () => F.act('quotation', q, a), view: () => F.setView({ kind: 'quotation', id: q.id }) }; });
  /* ---- fees by file (lib/moneyByFile: same figures as each file's Money tab) ---- */
  const { cases = [], invoices = [], payments = [], retainers = [], quotations = [], setCurrentCaseId, setCaseSubTab, setCurrentView } = useApp();
  const [bfF, setBfF] = useState<FeesFilter>('All');
  const byFileAll = cases.filter((c) => F.ownCase(c)).map((c) => ({ c, m: moneyForFile(c, { invoices, payments, retainers, quotations }) }))
    .filter(({ c, m }) => (isOpenFile(c) && (m.agreed > 0 || m.billed > 0)) || m.outstanding > 0.005)
    .sort((a, b) => b.m.agreed - a.m.agreed || b.m.billed - a.m.billed);
  const byFile = byFileAll.filter(({ m }) => feesFilter(bfF, m));
  const bfTot = sumMoney(byFile.map((x) => x.m));
  const openFile = (id: string) => { setCaseSubTab('money'); setCurrentCaseId(id); setCurrentView('cases'); };
  const BF = 'display:grid;grid-template-columns:minmax(0,1.6fr) 44px 92px 92px 92px 96px 120px 104px;gap:10px;';

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
                <span style={css('text-align:right;font-size:11.5px;color:#5B6478')}>{paid + F.invDeposit(d) ? rm(paid + F.invDeposit(d)) : '—'}</span>
                <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{st === 'Voided' ? '—' : F.invCredit(d) > 0.005 ? <span title="Received more than the invoice total: owed back to the client" style={css('color:#B23A2E')}>credit {rm(F.invCredit(d))}</span> : rm(F.invBal(d))}</span>
                <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${days > 90 ? '#B23A2E' : days > 60 ? '#8A6534' : '#5B6478'}`)}>{['Paid', 'Draft', 'Voided', 'Written off'].includes(st) ? '—' : days + 'd'}</span>
                <span style={css('justify-self:start;display:flex;flex-direction:column;gap:2px')}><span style={css(`align-self:flex-start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${c[0]};color:${c[1]}`)}>{st}</span>{!!(d.reminders || []).length && <span style={css('font-size:9.5px;color:#8A6534')}>{'Reminded ' + d.reminders![d.reminders!.length - 1].split(' · ')[0] + (d.reminders!.length > 1 ? ' (' + d.reminders!.length + 'x)' : '')}</span>}</span>
                <span style={css(`font-size:10.5px;font-weight:600;color:${einv === 'Validated' ? '#2F6F4E' : einv === 'Pending' ? '#8A6534' : '#94A3B8'}`)}>{einv}</span>
                <Split label={a} onAct={() => F.act('invoice', d, a)} onMenu={openMenu('invoice', d.id)} open={menu?.id === d.id} />
              </div>
            );
          })}
        </div>
      )}

      {docT !== 'Invoice' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>{D.title}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{D.sub}</span><button type="button" onClick={docNewClick} style={css('margin-left:auto;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{D.newL}</button></div>
          <div style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 190px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>No.</span><span>Client · matter</span><span>Date</span><span style={css('text-align:right')}>Amount</span><span>{D.col}</span><span>Status</span><span></span></div>
          {docRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No {D.title.toLowerCase()} yet.</div>}
          {docRows.map((r) => { const c = SC[r.status] || SC.Draft; const x = X[r.x] || X.Office; return (
            <div key={r.key} style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 190px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
              <button type="button" onClick={r.view} style={css('border:0;background:none;padding:0;text-align:left;font-size:11px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:underline;overflow:hidden;text-overflow:ellipsis')}>{r.no}</button>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.client}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{r.ref}</span></span>
              <span style={css('font-size:11px;color:#5B6478')}>{r.date}</span>
              <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{r.amt}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${x[0]};color:${x[1]}`)}>{r.x}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${c[0]};color:${c[1]}`)}>{r.status}</span>
              <Split label={r.action} onAct={r.onAct} onMenu={openMenu(r.kind, r.key)} open={menu?.id === r.key} />
            </div>
          ); })}
          <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>{D.foot}</div></div>
      )}

      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Fees by file</strong><span style={css('font-size:10.5px;color:#5B6478')}>same figures as each file's Money tab · click to open the file</span>
          <div style={css('display:flex;gap:4px;margin-left:auto')}>{FEES_FILTERS.map((k) => { const on = bfF === k; return <button key={k} type="button" onClick={() => setBfF(k)} style={css(`white-space:nowrap;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{k} · {byFileAll.filter(({ m }) => feesFilter(k, m)).length}</button>; })}</div></div>
        <div style={css(BF + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>File · client</span><span>PIC</span><span style={css('text-align:right')}>Agreed</span><span style={css('text-align:right')}>Billed</span><span style={css('text-align:right')}>Received</span><span style={css('text-align:right')}>Outstanding</span><span>Billed of agreed</span><span style={css('text-align:right')}>Client acct</span></div>
        {byFile.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{byFileAll.length ? 'No files match this filter.' : 'No files with agreed fees or bills yet.'}</div>}
        {byFile.map(({ c, m }) => { const pic = (c.partners || [])[0] || ''; const pct = billedPct(m); const client = F.clientName(String(c.clientId || '').split(',')[0].trim()) || c.clientName || '—'; return (
          <div key={c.id} onClick={() => openFile(c.id)} className="hover:bg-[#F6F8FA]" style={css(BF + 'align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;cursor:pointer')}>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{c.title}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{client} · {c.ref}</span></span>
            <span style={css(`width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;color:#fff;background:${picColor(pic)}`)}>{pic || '—'}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(m.agreed)}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(m.billed)}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#2F6F4E')}>{rm(m.received)}</span>
            <span style={css(`text-align:right;font-size:12px;font-weight:700;color:${m.outstanding > 0 ? '#8E2A20' : '#5B6478'}`)}>{rm(m.outstanding)}</span>
            <span style={css('display:flex;align-items:center;gap:6px')}><span style={css('flex:1;height:6px;border-radius:3px;background:#EEF1F5')}><span style={css(`display:block;height:6px;border-radius:3px;background:#3D6B9C;width:${pct}%`)} /></span><span style={css('font-size:10px;color:#5B6478;width:30px;text-align:right')}>{m.agreed > 0 ? Math.round((m.billed / m.agreed) * 100) + '%' : '—'}</span></span>
            <span style={css('text-align:right;font-size:11.5px;color:#2F5680')}>{m.clientAccount ? rm(m.clientAccount) : '—'}</span>
          </div>
        ); })}
        <div style={css(BF + 'padding:9px 14px;background:#F6F8FA;font-size:11.5px;font-weight:700;color:#16223A')}><span>{byFile.length} {byFile.length === 1 ? 'file' : 'files'}</span><span></span><span style={css('text-align:right')}>{rm(bfTot.agreed)}</span><span style={css('text-align:right')}>{rm(bfTot.billed)}</span><span style={css('text-align:right;color:#2F6F4E')}>{rm(bfTot.received)}</span><span style={css('text-align:right;color:#8E2A20')}>{rm(bfTot.outstanding)}</span><span></span><span style={css('text-align:right;color:#2F5680')}>{rm(bfTot.clientAccount)}</span></div>
      </div>

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
      {menu && menuRec && (
        <>
          <div onClick={() => setMenu(null)} style={css('position:fixed;inset:0;z-index:70')}></div>
          <div style={css(`position:fixed;top:${menu.top}px;left:${menu.left}px;z-index:71;width:190px;background:#fff;border:1px solid #DDE3EB;border-radius:8px;box-shadow:0 12px 28px rgba(22,34,58,.16);padding:4px;display:flex;flex-direction:column`)}>
            <span style={css('padding:6px 10px 4px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>{menuRec.id} · {menu.kind === 'invoice' ? F.invStatus(menuRec as import('../../../types').Invoice) : menu.kind === 'quotation' ? F.qStatus(menuRec as Quotation) : 'Issued'}</span>
            {menuItems().map((m) => (
              <React.Fragment key={m.label}>
                {m.sep && <div style={css('height:1px;background:#EEF1F5;margin:4px 0')}></div>}
                <button type="button" onClick={m.go} className="hover:bg-[#F6F8FA]" style={css(`text-align:left;border:0;background:none;border-radius:5px;padding:7px 10px;font-size:11.5px;font-weight:${m.fw};color:${m.fg};cursor:pointer;font-family:inherit`)}>{m.label}</button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
