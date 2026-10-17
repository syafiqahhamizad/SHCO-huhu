import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, inPeriod, picColor, rm } from './financeModel';
import type { Quotation, Receipt } from '../../../types';
import * as SD from '../../../lib/financeDocs';
import { useApp } from '../../../context/AppContext';
import { useListFilter } from '../../ui/ListFilters';
import { DEFAULT_DOC_FORMATS } from '../../../lib/docNumbers';
import { FEES_FILTERS, billedPct, feesFilter, isOpenFile, moneyForFile, sumMoney, type FeesFilter } from '../../../lib/moneyByFile';
import { billPart } from '../../../lib/quotedDisb';

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
  // Sub-tabs: the documents, fees by file, and work not billed yet.
  const [part, setPart] = useState<'docs' | 'files' | 'wip'>('docs');
  // Work not billed: which row is opened to show its items.
  const [openWip, setOpenWip] = useState('');
  const openMenu = (kind: DocKind, id: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)); const top = r.bottom + 4 + 260 > window.innerHeight ? Math.max(8, r.top - 264) : r.bottom + 4;
    setMenu((m) => (m && m.id === id ? null : { kind, id, top, left }));
  };
  const menuRec = menu ? (menu.kind === 'invoice' ? F.app.invoices.find((i) => i.id === menu.id) : menu.kind === 'quotation' ? F.app.quotations.find((q) => q.id === menu.id) : F.app.receipts.find((r) => r.id === menu.id)) : undefined;
  const pastMenuRec = menu && menu.kind === 'receipt' && !menuRec ? (F.app.pastReceipts || []).find((r) => r.id === menu.id) : undefined;
  const menuItems = (): { label: string; go: () => void; fw: number; fg: string; sep: boolean }[] => {
    if (pastMenuRec) {
      const r = pastMenuRec; const go = (fn: () => void) => () => { setMenu(null); fn(); };
      return [
        ...(r.pastFile ? [{ label: 'View PDF', go: go(() => F.openPastFile(r.pastFile)), fw: 500, fg: '#16223A', sep: false }] : []),
        ...(F.canPrepare ? [{ label: r.pastFile ? 'Replace PDF' : 'Attach PDF', go: go(() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,image/*'; inp.onchange = () => { const fl = inp.files?.[0]; if (fl) F.attachPastFile('receipt', r, fl); }; inp.click(); }), fw: 500, fg: '#16223A', sep: false }] : []),
        ...(F.canDeleteBills ? [{ label: 'Delete', go: go(() => { if (window.confirm('Delete past receipt ' + (r.pastNo || r.id) + '? (Recycle Bin keeps a copy. The PDF stays in Drive.)')) F.app.removeFinanceRecords({ receipts: [r.id] }, 'Past receipt deleted'); }), fw: 600, fg: '#B23A2E', sep: true }] : []),
      ];
    }
    if (!menu || !menuRec) return [];
    const kind = menu.kind;
    const st = kind === 'invoice' ? F.invStatus(menuRec as import('../../../types').Invoice) : kind === 'quotation' ? F.qStatus(menuRec as Quotation) : 'Issued';
    const acts = F.actionsFor(kind, menuRec as Quotation).filter((a) => a !== 'View' && a !== 'Void');
    const run = (fn: () => void) => () => { setMenu(null); fn(); };
    const canEdit = kind !== 'receipt' && F.rk !== 'R' && ['Draft', 'Sent', 'Accepted', 'Unpaid', 'Ready', 'Pending Approval', 'Overdue', 'Part-paid'].includes(st);
    const doc = () => F.buildDoc({ kind, id: menuRec.id });
    // Send to client is always offered (never required), except for papers from before the portal.
    const past = !!((menuRec as Quotation).historical || (menuRec as { recordOnly?: boolean }).recordOnly);
    const canSend = !past && F.rk !== 'R' && !acts.includes('Send') && !acts.includes('Resend');
    const more: [string, () => void][] = [...(canSend ? [['Send to client', () => F.act(kind, menuRec as Quotation, 'Send')] as [string, () => void]] : []), ['View', () => F.setView({ kind, id: menuRec.id })], ...(canEdit ? [['Edit', () => F.editDoc(kind, menuRec as Quotation)] as [string, () => void]] : []), ['Download PDF', () => { const d = doc(); if (d) SD.pdf(d.no, SD.docHtml(d)); }], ...(kind !== 'receipt' && F.rk !== 'R' ? [['Duplicate', () => F.duplicateDoc(kind, menuRec as Quotation)] as [string, () => void]] : [])];
    const del = (fn: () => void) => ({ label: 'Delete', go: run(fn), fw: 600, fg: '#B23A2E', sep: true });
    const danger = [
      ...(F.actionsFor(kind, menuRec as Quotation).includes('Void') ? [{ label: 'Void (credit note)', go: run(() => F.act(kind, menuRec as Quotation, 'Void')), fw: 600, fg: '#B23A2E', sep: true }] : []),
      // Delete: admins only. Postings are reversed; the record goes to the Recycle Bin.
      ...(F.canDeleteBills && kind === 'quotation' ? [del(() => F.deleteQuote(menuRec as Quotation))] : []),
      ...(F.canDeleteBills && kind === 'invoice' ? [del(() => F.deleteInvoice(menuRec as import('../../../types').Invoice))] : []),
      ...(F.canDeleteBills && kind === 'receipt' ? [del(() => F.deleteReceipt(menuRec as Receipt))] : []),
    ];
    if (kind === 'receipt' && F.rk !== 'R') more.push(['Edit', () => void F.editReceipt(menuRec as Receipt)]);
    return [...acts.map((a, i) => ({ label: a, go: run(() => F.act(kind, menuRec as Quotation, a)), fw: i ? 500 : 700, fg: '#16223A', sep: false })), ...more.map(([label, fn], i) => ({ label, go: run(fn), fw: 500, fg: '#16223A', sep: i === 0 })), ...danger];
  };
  const quotes = F.scopedQuotations.filter((q) => q.documentType !== 'Proforma');
  const proformas = F.scopedQuotations.filter((q) => q.documentType === 'Proforma');
  const invAll = F.scopedInvoices;

  /* ---- document flow cards ---- */
  const qS = quotes.map((q) => F.qStatus(q));
  const pUnpaid = proformas.filter((q) => ['Unpaid', 'Ready'].includes(F.qStatus(q)));
  // The number prefix shown on each box follows Settings › Document numbering.
  const pre = (k: string) => (F.settings.docNumbering?.[k] || DEFAULT_DOC_FORMATS[k] || '').split('{')[0];
  const DT: [typeof docT, string, string, string, string][] = [
    ['Quotation', pre('quotation'), 'fee estimate before we start', `${qS.filter((s) => ['Draft', 'Pending Approval', 'Ready', 'Sent'].includes(s)).length} open · ${qS.filter((s) => s === 'Accepted').length} accepted`, '#8A6D3B'],
    ['Proforma', pre('proforma'), 'ask for deposit or retainer', `${pUnpaid.length} unpaid · ${rm(pUnpaid.reduce((s, q) => s + Math.max(0, Number(q.total || 0) - F.proformaPaid(q)), 0))}`, '#3D6B9C'],
    ['Invoice', pre('invoice'), 'bill for work done (e-Invoice)', `${F.openInvoices.length} open · ${rm(F.owedTotal)}`, '#16223A'],
    ['Receipt', pre('receipt'), 'proof we received money', `${F.scopedReceipts.filter((r) => inPeriod(r.date, F.period)).length} issued in ${F.monthName}`, '#2F6F4E'],
  ];

  /* ---- invoices ---- */
  const invFilters = ['All', 'Overdue', 'Part-paid', 'Sent', 'Paid', 'Draft', 'Voided'];
  // One filter bar for every list on this page: dates, client, search.
  const LF = useListFilter({ who: [...invAll.map((v) => v.partyName || F.clientName(v.clientId) || ''), ...F.scopedQuotations.map((q) => q.clientName || ''), ...F.scopedReceipts.map((r) => r.receivedFrom || '')] });
  const invRows = invAll.filter((v) => invF === 'All' || F.invStatus(v) === invF).filter((v) => LF.match({ date: v.date, who: v.partyName || F.clientName(v.clientId), text: [v.id, v.partyName, F.clientName(v.clientId), v.fileRef, v.subject, v.matter] }));

  /* ---- other documents ---- */
  const X: Record<string, [string, string]> = { Office: ['#E7EEF6', '#2F5680'], 'Client account': ['#E6EFE9', '#2F6F4E'] };
  const D = {
    Quotation: { title: 'Quotations', sub: 'accepted quotes become the matter budget', col: 'Pay into', newL: '+ New quotation', foot: 'Accepted quotation → proforma for the deposit, or straight to invoice when work is done.' },
    Proforma: { title: 'Proforma invoices', sub: 'a request to pay first · not income yet, no SST', col: 'Pay into', newL: '+ New proforma', foot: 'Deposit for our fees → office account. Deposit for disbursements or purchase price → client account. Paid proforma turns into a receipt; the final invoice deducts it.' },
    Receipt: { title: 'Receipts', sub: 'every ringgit in gets a receipt, numbered by account', col: 'Account', newL: '+ Record money in', foot: 'Office and client account receipts are both numbered HQ-OR-… and tagged by account (Solicitors’ Account Rules 1990 keep the two separate).' },
    Invoice: { title: '', sub: '', col: '', newL: '', foot: '' },
  }[docT];
  type Row = { past?: boolean; kind: DocKind; key: string; no: string; client: string; ref: string; date: string; amt: string; x: string; status: string; action: string; onAct: () => void; view: () => void };
  const pastReceipts = F.app.pastReceipts || [];
  const pastRcpts = pastReceipts.filter((x) => !x.caseId || F.ownCase(F.app.cases.find((k) => k.id === x.caseId)));
  // A past receipt: open its PDF, or pick the PDF to attach when it has none yet.
  const pastPdf = (r: typeof pastReceipts[number]) => {
    if (r.pastFile) { F.openPastFile(r.pastFile); return; }
    if (!F.canPrepare) { F.openPastFile(undefined); return; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,image/*';
    inp.onchange = () => { const fl = inp.files?.[0]; if (fl) F.attachPastFile('receipt', r, fl); };
    inp.click();
  };
  const rawDate = (r: Row) => (r.kind === 'receipt' ? (F.scopedReceipts.find((x) => x.id === r.key) || pastReceipts.find((x) => x.id === r.key))?.date : F.scopedQuotations.find((x) => x.id === r.key)?.date);
  const docRowsAll: Row[] = docT === 'Receipt'
    ? F.scopedReceipts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((r: Receipt) => { const acc = r.accountSet === 'CLIENT' ? 'Client account' : 'Office'; return { kind: 'receipt' as DocKind, key: r.id, no: r.id, client: r.receivedFrom || '—', ref: 'for ' + (r.forNo || r.description || '—') + ' · ' + (r.paymentMethod || '—'), date: F.dShort(r.date), amt: rm(Number(r.amount || 0)), x: acc, status: r.historical ? 'Historical' : 'Issued', action: 'View', onAct: () => F.setView({ kind: 'receipt', id: r.id }), view: () => F.setView({ kind: 'receipt', id: r.id }) }; })
      .concat(pastRcpts.map((r) => ({ past: true, kind: 'receipt' as DocKind, key: r.id, no: r.pastNo || r.id, client: r.receivedFrom || '—', ref: [r.fileRef, r.description].filter(Boolean).join(' · ') || '—', date: F.dShort(r.date), amt: rm(Number(r.amount || 0)), x: r.accountSet === 'CLIENT' ? 'Client account' : 'Office', status: 'Issued', action: r.pastFile ? 'View PDF' : 'Attach PDF', onAct: () => pastPdf(r), view: () => pastPdf(r) })))
      .sort((a, b) => String(rawDate(b)).localeCompare(String(rawDate(a))))
    : docT === 'Invoice' ? [] : (docT === 'Quotation' ? quotes : proformas).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((q: Quotation) => { const a = F.actionsFor('quotation', q)[0]; const kase = F.qCase(q); return { past: !!q.historical, kind: 'quotation' as DocKind, key: q.id, no: q.id, client: q.clientName || '—', ref: `${q.fileRef || kase?.ref || '—'} · ${q.practiceArea || '—'}`, date: F.dShort(q.date), amt: rm(Number(q.total || 0)), x: q.payInto || 'Office', status: F.qStatus(q), action: a, onAct: () => F.act('quotation', q, a), view: () => (q.historical ? F.act('quotation', q, 'View') : F.setView({ kind: 'quotation', id: q.id })) }; });
  const docRows = docRowsAll.filter((r) => LF.match({ date: rawDate(r), who: r.client, text: [r.no, r.client, r.ref] }));
  /* ---- fees by file (lib/moneyByFile: same figures as each file's Money tab) ---- */
  const { cases = [], invoices = [], payments = [], retainers = [], quotations = [], receipts = [], setCurrentCaseId, setCaseSubTab, setCurrentView, canViewModule } = useApp();
  const [bfF, setBfF] = useState<FeesFilter>('All');
  const byFileAll = cases.filter((c) => F.ownCase(c)).map((c) => ({ c, m: moneyForFile(c, { invoices, payments, retainers, quotations, receipts }) }))
    .filter(({ c, m }) => (isOpenFile(c) && (m.agreed > 0 || m.billed > 0)) || m.outstanding > 0.005)
    .sort((a, b) => b.m.agreed - a.m.agreed || b.m.billed - a.m.billed);
  const byFile = byFileAll.filter(({ m }) => feesFilter(bfF, m));
  const bfTot = sumMoney(byFile.map((x) => x.m));
  // Accounts have no Cases page, so for them the rows are not links.
  const canOpenFile = canViewModule('cases');
  const openFile = (id: string) => { if (!canOpenFile) return; setCaseSubTab('money'); setCurrentCaseId(id); setCurrentView('cases'); };
  const BF = 'display:grid;grid-template-columns:minmax(0,1.6fr) 44px 92px 92px 92px 96px 120px 104px;gap:10px;';

  const docNewClick = () => (docT === 'Receipt' ? F.openForm('moneyIn', { account: 'Office' }) : F.openNew(docT));

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{([['docs', 'Quotations, invoices & receipts'], ['files', 'Fees by file'], ['wip', 'Work not billed yet' + (F.unbilled.length ? ' · ' + F.unbilled.length : '')]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setPart(k)} style={css(`border-radius:16px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${part === k ? '#16223A' : '#DDE3EB'};background:${part === k ? '#16223A' : '#fff'};color:${part === k ? '#fff' : '#16223A'}`)}>{l}</button>)}</div>
      {part === 'docs' && <>
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
            <span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>e-Invoice: LHDN MyInvois not connected yet</span>{F.canPrepare && <button type="button" title="Many past invoices / receipts at once from Excel" onClick={() => F.setImp({ src: 'Template', acc: 'Office', raw: null, fileName: 'No file chosen', mode: 'reference' })} style={css('margin-left:6px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Import many (Excel)</button>}{F.canPrepare && <button type="button" title="An invoice made before the portal: its own number, amounts and the PDF. Counted like any invoice." onClick={() => F.openForm('pastInvoice', {})} style={css('margin-left:6px;border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Past invoice</button>}</div>
          {LF.bar}
          <div style={css('display:grid;grid-template-columns:86px minmax(0,1.4fr) 84px 90px 90px 90px 70px 90px 84px 100px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>No.</span><span>Client · matter</span><span>Issued</span><span style={css('text-align:right')}>Total</span><span style={css('text-align:right')}>Paid</span><span style={css('text-align:right')}>Balance</span><span style={css('text-align:right')}>Days</span><span>Status</span><span>e-Invoice</span><span></span></div>
          {invRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{invAll.length ? (LF.active ? 'Nothing matches the filter.' : 'No invoices with this status.') : 'No invoices yet. Create one from unbilled work below, or with “New quotation or invoice”.'}</div>}
          {invRows.map((d) => {
            const st = F.invStatus(d); const paid = F.invPaid(d); const a = F.actionsFor('invoice', d)[0]; const c = SC[st] || SC.Draft; const kase = F.invCase(d);
            const days = F.ageDays(d); const einv = d.eInvoiceStatus && d.eInvoiceStatus !== 'Not Submitted' ? d.eInvoiceStatus : '—';
            return (
              <div key={d.id} style={css(`display:grid;grid-template-columns:86px minmax(0,1.4fr) 84px 90px 90px 90px 70px 90px 84px 100px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;opacity:${st === 'Voided' ? 0.55 : 1}`)}>
                <button type="button" onClick={() => (d.historical ? F.act('invoice', d, 'View') : F.setView({ kind: 'invoice', id: d.id }))} style={css('border:0;background:none;padding:0;text-align:left;font-size:11px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:underline;overflow:hidden;text-overflow:ellipsis')}>{d.id}{d.historical && <span title="Made before the portal" style={css('display:inline-block;margin-left:5px;padding:0 6px;border-radius:8px;background:#F1EBF6;color:#6B3D8C;font-size:9.5px;font-weight:800;text-decoration:none')}>PAST</span>}</button>
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
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>{D.title}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{D.sub}</span>{D.title === 'Proforma invoices' && F.canPrepare && <button type="button" title="A proforma made before the portal: its own number, amount and the PDF" onClick={() => F.openForm('pastProforma', { payInto: 'Office' })} style={css('margin-left:auto;border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Past proforma</button>}{D.title === 'Quotations' && F.canPrepare && <button type="button" title="A quotation made before the portal: its own number, amount and the PDF" onClick={() => F.openForm('pastQuote', { status: 'Accepted' })} style={css('margin-left:auto;border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Past quotation</button>}{D.title === 'Receipts' && F.canPrepare && <><button type="button" title="Many past invoices / receipts at once from Excel" onClick={() => F.setImp({ src: 'Template', acc: 'Office', raw: null, fileName: 'No file chosen', mode: 'reference' })} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Import many (Excel)</button><button type="button" title="A receipt made before the portal: its own number, amount and the PDF" onClick={() => F.openForm('pastReceipt', { account: 'Office', method: 'Online transfer' })} style={css('border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Past receipt</button></>}<button type="button" onClick={docNewClick} style={css(((D.title === 'Quotations' || D.title === 'Proforma invoices' || D.title === 'Receipts') && F.canPrepare ? '' : 'margin-left:auto;') + 'border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{D.newL}</button></div>
          {LF.bar}
          <div style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 190px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>No.</span><span>Client · matter</span><span>Date</span><span style={css('text-align:right')}>Amount</span><span>{D.col}</span><span>Status</span><span></span></div>
          {docRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{LF.active && docRowsAll.length ? 'Nothing matches the filter.' : 'No ' + D.title.toLowerCase() + ' yet.'}</div>}
          {docRows.map((r) => { const c = SC[r.status] || SC.Draft; const x = X[r.x] || X.Office; return (
            <div key={r.key} style={css('display:grid;grid-template-columns:96px minmax(0,1.5fr) 80px 100px 110px 110px 190px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
              <button type="button" onClick={r.view} style={css('border:0;background:none;padding:0;text-align:left;font-size:11px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit;text-decoration:underline;overflow:hidden;text-overflow:ellipsis')}>{r.no}{r.past && <span title="Made before the portal" style={css('display:inline-block;margin-left:5px;padding:0 6px;border-radius:8px;background:#F1EBF6;color:#6B3D8C;font-size:9.5px;font-weight:800;text-decoration:none')}>PAST</span>}</button>
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


      </>}

      {part === 'files' && (
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Fees by file</strong><span style={css('font-size:10.5px;color:#5B6478')}>same figures as each file's Money tab · click to open the file</span>
          <div style={css('display:flex;gap:4px;margin-left:auto')}>{FEES_FILTERS.map((k) => { const on = bfF === k; return <button key={k} type="button" onClick={() => setBfF(k)} style={css(`white-space:nowrap;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{k} · {byFileAll.filter(({ m }) => feesFilter(k, m)).length}</button>; })}</div></div>
        <div style={css(BF + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>File · client</span><span>PIC</span><span style={css('text-align:right')}>Agreed</span><span style={css('text-align:right')}>Billed</span><span style={css('text-align:right')}>Received</span><span style={css('text-align:right')}>Outstanding</span><span>Billed of agreed</span><span style={css('text-align:right')}>Client acct</span></div>
        {byFile.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{byFileAll.length ? 'No files match this filter.' : 'No files with agreed fees or bills yet.'}</div>}
        {byFile.map(({ c, m }) => { const pic = (c.partners || [])[0] || ''; const pct = billedPct(m); const client = F.clientName(String(c.clientId || '').split(',')[0].trim()) || c.clientName || '—'; return (
          <div key={c.id} onClick={() => openFile(c.id)} className={canOpenFile ? 'hover:bg-[#F6F8FA]' : undefined} style={css(BF + 'align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;' + (canOpenFile ? 'cursor:pointer' : ''))}>
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

      )}

      {part === 'wip' && (
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Work not billed yet</strong><span style={css('font-size:10.5px;color:#5B6478')}>time + disbursements recorded in Matters, oldest first</span><span style={css('margin-left:auto;font-size:12px;font-weight:700;color:#16223A')}>{rm(F.unbilled.reduce((s, u) => s + u.time + u.disb, 0))} still to bill</span></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1.5fr) 44px 90px 90px 90px 80px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Matter</span><span>PIC</span><span style={css('text-align:right')}>Time</span><span style={css('text-align:right')}>Disb.</span><span style={css('text-align:right')}>Total</span><span style={css('text-align:right')}>Oldest</span><span></span></div>
        {F.unbilled.length === 0 && Object.keys(F.billed).length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing unbilled: no billable time or disbursements are waiting.</div>}
        {[...F.unbilled, ...Object.values(F.billed).map((b) => b.u as (typeof F.unbilled)[number]).filter((b) => !F.unbilled.some((u) => u.key === b.key))].map((u) => { const inv = F.billed[u.key]?.inv; return (
          <React.Fragment key={u.key}><div style={css(`display:grid;grid-template-columns:minmax(0,1.5fr) 44px 90px 90px 90px 80px 110px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5;opacity:${inv ? 0.6 : 1}`)}>
            <button type="button" onClick={() => setOpenWip(openWip === u.key ? '' : u.key)} title="Show the items" style={css('min-width:0;border:0;background:none;padding:0;text-align:left;cursor:pointer;font-family:inherit')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{openWip === u.key ? '▾ ' : '▸ '}{u.client}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{u.ref}{u.title ? ' · ' + u.title : ''}</span></button>
            <span style={css(`width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;color:#fff;background:${picColor(u.pic)}`)}>{u.pic}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(u.time)}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(u.disb)}</span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm(u.time + u.disb)}</span>
            <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${u.oldest > 60 ? '#B23A2E' : u.oldest > 30 ? '#8A6534' : '#5B6478'}`)}>{u.oldest} days</span>
            {!inv && <button type="button" onClick={() => F.billMatter(u)} style={css('justify-self:end;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Create invoice</button>}
            {inv && <button type="button" onClick={() => F.setView({ kind: 'invoice', id: inv })} style={css('justify-self:end;border:0;background:none;font-size:10.5px;font-weight:700;color:#2F6F4E;cursor:pointer;font-family:inherit;text-decoration:underline')}>Draft {inv}</button>}
          </div>
          {openWip === u.key && (() => {
            // Each item: date, what, paid to, amount, its receipt (Drive), Edit, Delete.
            const L = 'display:grid;grid-template-columns:80px minmax(0,1.4fr) minmax(0,1fr) 90px 150px 110px;gap:10px;align-items:center;padding:6px 14px 6px 30px;border-bottom:1px solid #F0F2F5;background:#FBFCFD;font-size:11px;color:#16223A';
            const lnk = 'border:0;background:none;padding:0;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;';
            const receipt = (e: (typeof u.ex)[number]) => e.driveFiling?.folderId
              ? <a href={'https://drive.google.com/drive/folders/' + e.driveFiling.folderId} target="_blank" rel="noopener noreferrer" style={css(lnk + 'color:#3D6B9C')}>View receipt ↗</a>
              : e.paidProof || (e.documents || []).length ? <span title="Filed into Google Drive: Finance › Books › the bank it was paid from › year › month › Money Out, and a link in the file's Client Files › Costs paid. Filing runs while Accounts has a finance page open." style={css('font-size:10.5px;color:#8A6534')}>Receipt saving to Drive…</span>
              : F.canPrepare ? <label style={css(lnk + 'color:#8A6D3B')}>Attach receipt<input type="file" accept=".pdf,image/*" onChange={(ev) => { F.attachTo('expense', e.id)(ev.target.files); ev.target.value = ''; }} style={css('display:none')} /></label> : <span style={css('font-size:10.5px;color:#94A3B8')}>No receipt</span>;
            return <>
              {u.ex.map((e) => (
                <div key={e.id} style={css(L)}>
                  <span style={css('color:#5B6478')}>{F.dShort(e.date)}</span>
                  <span style={css('overflow:hidden;text-overflow:ellipsis;white-space:nowrap')} title={e.description}>{e.description || e.category}</span>
                  <span style={css('overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5B6478')}>{e.payee || '—'}</span>
                  <span style={css('text-align:right;font-weight:700')} title={e.quoteCovered ? 'Claim ' + rm(Number(e.amount || 0)) + ' · ' + rm(e.quoteCovered) + ' inside the quote' : undefined}>{rm(billPart(e))}</span>
                  <span>{receipt(e)}</span>
                  <span style={css('display:flex;gap:10px;justify-content:flex-end')}>{F.canPrepare && <button type="button" onClick={() => F.editEntry('expense', e.id)} style={css(lnk + 'color:#3D6B9C')}>Edit</button>}{F.canDeleteBills && <button type="button" onClick={() => F.deleteEntry('expense', e.id)} style={css(lnk + 'color:#B23A2E')}>Delete</button>}</span>
                </div>
              ))}
              {u.tc.map((t) => (
                <div key={t.id} style={css(L)}><span style={css('color:#5B6478')}>{F.dShort(t.date)}</span><span>Travel: {t.purpose || t.to || '—'}</span><span style={css('color:#5B6478')}>{t.claimant || '—'}</span><span style={css('text-align:right;font-weight:700')}>—</span><span style={css('font-size:10.5px;color:#5B6478')}>staff claim</span><span style={css('font-size:10.5px;color:#5B6478;text-align:right')}>change in My Claims</span></div>
              ))}
              {u.te.map((t) => (
                <div key={t.id} style={css(L)}><span style={css('color:#5B6478')}>{F.dShort(t.date)}</span><span>{t.description || 'Time'}</span><span style={css('color:#5B6478')}>{t.hours}h</span><span style={css('text-align:right;font-weight:700')}>{rm(Number(t.hours || 0) * Number(t.rate || 0))}</span><span></span><span style={css('font-size:10.5px;color:#5B6478;text-align:right')}>change in the file's Time & costs</span></div>
              ))}
            </>;
          })()}
          </React.Fragment>
        ); })}
      </div>
      )}
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
