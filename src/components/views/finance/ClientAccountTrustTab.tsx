import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, daysSince, DRIVE_REQUIRED_MSG, fd, findCase, MON, MONTHS, monthEnd, parseDate, periodKey, proofUploadBlocked, rm, rm2 } from './financeModel';
import { CashBookCard } from './CashBookCard';
import { storeFinanceProof } from '../../../services/fileStorageService';
import * as SD from '../../../lib/financeDocs';

type Ledger = FinanceCtrl['ledgers'][number];
const chip = (on: boolean) => `border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`;

/** Client Account (Solicitors' Account Rules 1990) — design: KPI strip, then Client ledgers ·
 * Cash book · 3-way reconciliation · Monthly statements. */
export const ClientAccountTrustTab = ({ F }: { F: FinanceCtrl }) => {
  const { lk } = F;
  const viewOnly = !F.canPrepare;
  const [q, setQ] = useState('');
  const [lgF, setLgF] = useState<'all' | 'attn' | 'bill' | 'dorm'>('attn');
  const [pg, setPg] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [per, setPer] = useState<'all' | 'year' | 'last' | 'month' | 'custom'>('all');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [rcOpen, setRcOpen] = useState(false);
  const [stMonIdx, setStMonIdx] = useState(1);

  /* ---- flags (same rules as before) ---- */
  const ledgerFlag = (l: Ledger): [string, string, string] => {
    const client = lk.clientById.get(l.clientId); const kase = findCase(lk, l.caseId);
    if (l.balance < -0.005) return ['Overdrawn', '#FBEDE9', '#B23A2E'];
    if (client?.status === 'Pending KYC') return ['AML check pending', '#FBEDE9', '#B23A2E'];
    if (l.balance > 0.005 && daysSince(l.last) > 365) return ['Dormant 12m+', '#FBEDE9', '#B23A2E'];
    if (l.balance > 0.005 && kase?.status === 'Closed') return ['File closed: refund due', '#FBF2E9', '#8A6534'];
    if (l.balance > 0.005 && F.app.invoices.some((i) => (i.clientId === l.clientId || (!!l.caseId && (i.caseId === l.caseId || i.fileRef === kase?.ref))) && F.invIssued(i) && F.invBal(i) > 0.005)) return ['Bill issued: can transfer', '#FBF2E9', '#8A6534'];
    return ['OK', '#E6EFE9', '#2F6F4E'];
  };
  const flagged = F.ledgers.map((l) => ({ l, f: ledgerFlag(l) }));
  const attn = flagged.filter((x) => x.f[0] !== 'OK');

  /* ---- reconciliation: the two months before this one (design: Aug balanced · Sep to do) ---- */
  const recMonths = [new Date(F.now.getFullYear(), F.now.getMonth() - 2, 1), F.prevDate];
  const recSign = (m: Date) => F.signoffs('recon:' + periodKey(m));
  const rule = F.ruleFor('recon');
  const recRows = recMonths.map((m, i) => {
    const key = periodKey(m); const r = F.reconFor(m); const st = (F.settings.clientBankStatements || {})[key];
    const signed = rule.done(recSign(m));
    const status = signed && r.status === 'Balanced' ? 'Balanced' : r.bank == null && !st?.proof ? 'Not started' : r.status === 'Balanced' && !signed ? 'In progress' : r.status === 'Difference' ? 'In progress' : r.status;
    const [sbg, sfg] = status === 'Balanced' ? ['#E6EFE9', '#2F6F4E'] : ['#FBF2E9', '#8A6534'];
    const signers = Object.entries(recSign(m)).map(([c]) => c).join(' & ');
    const note = signed ? `signed off by ${signers}` : r.bank == null ? `bank statement not keyed in · due 15 ${MON[(m.getMonth() + 1) % 12]}` : r.status === 'Difference' ? `difference ${rm2(Math.abs(r.cash - (r.bank || 0)))} still to explain` : 'balanced · waiting for partner sign-off';
    return { m, key, r, st, status, sbg, sfg, note, signed, canRec: i === 1, label: `${MONTHS[m.getMonth()]} ${m.getFullYear()}`, bl: i ? '1px solid #EEF1F5' : '0' };
  });
  const lastRec = recRows[1];

  /* ---- KPIs ---- */
  const clientBank = F.firmBanksOf('Client account')[0];
  const trKpis: [string, string, string, string][] = [
    ['Client money held', rm(F.trustTotal), clientBank ? `${clientBank.bankName} ${clientBank.accountNo ? '· ' + String(clientBank.accountNo).replace(/^(\d{4})\d+(\d{4})$/, '$1 **** $2') : ''}` : `HLB Client A/C ${SD.BANK['Client account'][2]}`, '#16223A'],
    ['Client ledgers', String(F.ledgers.length), attn.length + ' need attention', '#16223A'],
    [`${MONTHS[lastRec.m.getMonth()]} reconciliation`, lastRec.signed ? 'Balanced' : lastRec.status, lastRec.signed ? 'signed off by ' + Object.keys(recSign(lastRec.m)).join(' & ') : 'due 15 ' + F.monShort, lastRec.signed ? '#2F6F4E' : '#8A6534'],
    ['Next statements', '1 ' + F.nextMonShort, 'every client with a balance', '#16223A'],
  ];
  const subs: ['l' | 'c' | 'r' | 's', string, number, boolean][] = [['l', 'Client ledgers', attn.length, true], ['c', 'Cash book', 0, false], ['r', '3-way reconciliation', lastRec.signed ? 0 : 1, true], ['s', 'Monthly statements', 0, false]];

  /* ---- ledger list ---- */
  const FL: Record<typeof lgF, [string, (x: { f: [string, string, string] }) => boolean]> = { all: ['All', () => true], attn: ['Needs attention', (x) => x.f[0] !== 'OK'], bill: ['Can transfer', (x) => /bill issued/i.test(x.f[0])], dorm: ['Dormant', (x) => /dormant/i.test(x.f[0])] };
  const lq = q.trim().toLowerCase();
  const list = flagged.filter(FL[lgF][1]).filter((x) => !lq || (x.l.client + ' ' + x.l.ref).toLowerCase().includes(lq));
  const PG = 15, page = Math.min(pg, Math.max(0, Math.ceil(list.length / PG) - 1));

  /* ---- statement / ledger rows with a period ---- */
  const dmy = (s: string) => { const m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0; };
  const y = F.now.getFullYear();
  const P: Record<typeof per, [string, number, number]> = { all: ['All time', 0, 0], year: ['This year', new Date(y, 0, 1).getTime(), new Date(y, 11, 31, 23, 59).getTime()], month: ['This month', new Date(y, F.now.getMonth(), 1).getTime(), monthEnd(F.now).getTime() + 86399999], last: ['Last month', F.prevDate.getTime(), monthEnd(F.prevDate).getTime() + 86399999], custom: ['Custom', dmy(from), dmy(to) ? dmy(to) + 86399999 : 0] };
  const [, pF, pT] = P[per];
  const perLabel = per === 'all' ? 'All time · from first entry to ' + fd(Date.now()) : fd(pF) + ' to ' + (pT ? fd(pT) : fd(Date.now()));
  const ledgerRows = (l: Ledger, fromT = 0, toT = 0) => {
    let bal = 0, open: number | null = null;
    const rows: { id: string; date: string; desc: string; v: string; out: string; inn: string; bal: string; outN: number; innN: number }[] = [];
    l.entries.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date)).forEach((r) => {
      const t = parseDate(r.date); const inn = r.type === 'Deposit' ? Number(r.amount || 0) : 0, out = r.type === 'Deposit' ? 0 : Number(r.amount || 0);
      bal += inn - out;
      if (fromT && t < fromT) { open = bal; return; }
      if (toT && t > toT) return;
      rows.push({ id: r.id, date: F.dShort(r.date), desc: r.remarks || r.type, v: r.voucherNo || '—', out: out ? rm2(out) : '', inn: inn ? rm2(inn) : '', bal: rm2(bal), outN: out, innN: inn });
    });
    return { rows, open };
  };
  const sel = openKey ? F.ledgers.find((l) => l.key === openKey) : undefined;
  const selR = sel ? ledgerRows(sel, pF, pT) : { rows: [], open: null };
  const stmtHtml = (l: Ledger, fromT = pF, toT = pT, label = perLabel) => { const r = ledgerRows(l, fromT, toT); return SD.tableHtml('Statement of account · ' + l.client, l.ref + ' · ' + label, ['Date', 'Details', 'Voucher', 'Out', 'In', 'Balance'], [...(r.open != null ? [['', 'Balance brought forward', '', '', '', rm2(r.open)]] : []), ...r.rows.map((x) => [x.date, x.desc, x.v, x.out, x.inn, x.bal])]); };
  const stmtCsv = (l: Ledger, fromT = pF, toT = pT) => { const r = ledgerRows(l, fromT, toT); SD.csv('Statement ' + l.client, [['Date', 'Details', 'Voucher', 'Out', 'In', 'Balance'], ...(r.open != null ? [['', 'Balance brought forward', '', '', '', rm2(r.open)]] : []), ...r.rows.map((x) => [x.date, x.desc, x.v, x.out, x.inn, x.bal])]); F.toastMsg('Excel downloaded'); };
  const glAll = () => { SD.csv('General Ledger - Client Account', [['Date', 'Client', 'File', 'Details', 'Voucher', 'Out', 'In'], ...F.app.retainers.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date)).map((r) => [fd(r.date), F.clientName(r.clientId) || r.clientId, findCase(lk, r.caseId)?.ref || '', r.remarks || r.type, r.voucherNo || r.id, r.type === 'Deposit' ? '' : rm2(Number(r.amount || 0)), r.type === 'Deposit' ? rm2(Number(r.amount || 0)) : ''])]); F.toastMsg('General ledger downloaded'); };

  /* ---- statements of a month ---- */
  const stMonths = Array.from({ length: 9 }, (_, i) => new Date(y, F.now.getMonth() - 1 - i, 1));
  const sm = stMonths[Math.min(stMonIdx - 1, 8)] || F.prevDate;
  const smKey = periodKey(sm), smEnd = monthEnd(sm).getTime() + 86399999, isCur = stMonIdx === 1;
  const runs = F.settings.clientStatementRuns || {};
  const run = runs[smKey];
  const balAt = (l: Ledger) => l.entries.filter((r) => parseDate(r.date) <= smEnd).reduce((s, r) => s + (r.type === 'Deposit' ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);
  const stmts = F.ledgers.map((l) => ({ l, b: balAt(l) })).filter((x) => x.b > 0.005 || (isCur && x.l.balance > 0.005));
  const sentOn = '1 ' + MON[(sm.getMonth() + 1) % 12];
  const sendStmts = () => {
    if (viewOnly) { F.toastMsg('Statements are sent by Accounts.'); return; }
    if (run) { F.toastMsg(`${MONTHS[sm.getMonth()]} statements were generated on ${fd(run.at)}.`); return; }
    if (!stmts.length) { F.toastMsg('No client has money in the client account.'); return; }
    SD.pdf('Client statements ' + smKey, stmts.map((x) => stmtHtml(x.l, 0, smEnd, 'to ' + fd(smEnd))).join('<div style="page-break-after:always"></div>'));
    F.saveSettings({ clientStatementRuns: { ...runs, [smKey]: { at: new Date().toISOString(), by: F.me, count: stmts.length } } });
    F.toastMsg(stmts.length + ' statements generated as one PDF · send them from your mailbox');
  };
  const stRule = F.ruleFor('clientStmt');
  const viewStmt = (l: Ledger, fromT: number, toT: number, label: string) => {
    const key = 'clientStmt:' + l.key + '|' + periodKey(new Date(toT || Date.now()));
    const sg = F.signoffs(key); const done = stRule.done(sg);
    F.setPaper({ title: l.client, sub: l.ref, html: stmtHtml(l, fromT, toT, label), pdf: () => SD.pdf('Statement ' + l.client, stmtHtml(l, fromT, toT, label)), xls: () => stmtCsv(l, fromT, toT),
      extra: <>
        <span style={css('align-self:center;font-size:10px;color:#C9D3E0')}>{done ? 'approved · send it to the client from your mailbox' : (stRule.count(sg) ? stRule.count(sg) + ' of ' + stRule.need + ' · ' : '') + stRule.rule}</span>
        {done ? <span style={css('align-self:center;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:800;background:#2F6F4E;color:#fff;white-space:nowrap')}>Approved ✓ · {Object.keys(sg).join(' & ')}</span>
          : stRule.people.map((p) => <button key={p.code} type="button" title={p.name} onClick={() => { F.signOff('clientStmt', key.slice('clientStmt:'.length)); F.setPaper(null); }} style={css('border:0;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:800;background:#C9A227;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>{sg[p.code] ? p.code + ' ✓' : 'Approve · ' + p.code}</button>)}
      </> });
  };

  const LBL = 'font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
  return (
    <div style={css('display:flex;flex-direction:column;gap:14px')}>
      <section style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow:hidden')}>{trKpis.map(([l, v, n, c]) => <div key={l} style={css('padding:12px 16px;border-right:1px solid #EEF1F5;display:flex;flex-direction:column;gap:3px')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{l}</span><span style={css(`font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:${c}`)}>{v}</span><span style={css('font-size:10.5px;color:#5B6478')}>{n}</span></div>)}</section>
      <div style={css('display:flex;align-items:center;gap:4px;flex-wrap:wrap')}>{subs.map(([k, label, n, warn]) => { const on = F.trSub === k; return <button key={k} type="button" onClick={() => { F.setTrSub(k); if (k === 'c') F.setCbAcc('Client account'); }} style={css(`display:flex;align-items:center;gap:6px;border-radius:16px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;${chip(on)}`)}>{label}{!!n && <span style={css(`font-size:10px;padding:0 6px;border-radius:9px;background:${on ? '#fff' : warn ? '#FBF2E9' : '#EEF1F5'};color:${on ? '#16223A' : warn ? '#8A6534' : '#5B6478'}`)}>{n}</span>}</button>; })}</div>

      {F.trSub === 'l' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #EEF1F5')}>
            <div style={css('display:flex;align-items:center;gap:8px;flex:1;min-width:240px;max-width:380px;border:1px solid #DDE3EB;border-radius:8px;padding:7px 10px')}><span style={css('width:9px;height:9px;border:1.5px solid #5B6478;border-radius:50%;flex-shrink:0')}></span><input value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} placeholder="Search client name or file ref" style={css('flex:1;min-width:0;border:0;outline:none;font-size:12px;font-family:inherit;color:#16223A;background:transparent')} /></div>
            <div style={css('display:flex;gap:4px;flex-wrap:wrap')}>{(Object.keys(FL) as (typeof lgF)[]).map((k) => <button key={k} type="button" onClick={() => { setLgF(k); setPg(0); }} style={css(`border-radius:16px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;${chip(lgF === k)}`)}>{FL[k][0]} · {flagged.filter(FL[k][1]).length}</button>)}</div>
            <div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={glAll} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>General ledger · Excel</button></div>
          </div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.4fr) 130px 110px 170px 20px;gap:12px;padding:8px 16px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Client</span><span>File</span><span style={css('text-align:right')}>Balance held</span><span>Last activity</span><span>Status</span><span></span></div>
          {list.slice(page * PG, page * PG + PG).map(({ l, f }) => (
            <button key={l.key} type="button" onClick={() => setOpenKey(l.key)} className="hover:bg-[#F8FAFC]" style={css('width:100%;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.4fr) 130px 110px 170px 20px;gap:12px;align-items:center;padding:10px 16px;border:0;border-bottom:1px solid #F0F2F5;background:#fff;cursor:pointer;font-family:inherit;text-align:left')}>
              <span style={css('font-size:12px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{l.client}</span>
              <span style={css('font-size:11px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{l.ref}</span>
              <span style={css(`text-align:right;font-size:12.5px;font-weight:700;color:${l.balance < 0 ? '#B23A2E' : '#16223A'};white-space:nowrap`)}>{rm(l.balance)}</span>
              <span style={css('font-size:11px;color:#5B6478;white-space:nowrap')}>{F.dShort(l.last)}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;white-space:nowrap;background:${f[1]};color:${f[2]}`)}>{f[0]}</span>
              <span style={css('font-size:14px;color:#9AA3B2')}>›</span>
            </button>
          ))}
          {!list.length && <div style={css('padding:24px;text-align:center;font-size:11.5px;color:#5B6478')}>{F.ledgers.length ? 'No ledger matches.' : 'No client money held yet. Use “Money in” with a deposit to open a ledger.'}</div>}
          <div style={css('display:flex;align-items:center;gap:8px;padding:9px 16px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}><span>{list.length ? 'Showing ' + (page * PG + 1) + '–' + Math.min(list.length, page * PG + PG) + ' of ' + list.length : 'Nothing to show'}</span><div style={css('margin-left:auto;display:flex;gap:4px')}><button type="button" onClick={() => setPg(Math.max(0, page - 1))} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;opacity:${page > 0 ? 1 : 0.4}`)}>‹ Prev</button><button type="button" onClick={() => setPg((page + 1) * PG < list.length ? page + 1 : page)} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;opacity:${(page + 1) * PG < list.length ? 1 : 0.4}`)}>Next ›</button></div></div>
        </div>
      )}
      {sel && (
        <>
          <div onClick={() => setOpenKey(null)} style={css('position:fixed;inset:0;z-index:55;background:rgba(22,34,58,.35)')}></div>
          <div style={css('position:fixed;top:0;right:0;bottom:0;z-index:56;width:760px;max-width:92vw;background:#fff;box-shadow:-16px 0 40px rgba(22,34,58,.18);overflow-y:auto;display:flex;flex-direction:column')}>
            <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;background:#16223A;position:sticky;top:0;z-index:1')}><strong style={css('color:#fff;font-size:13px')}>{sel.client}</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>{sel.ref}</span><button type="button" onClick={() => setOpenKey(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>Close</button></div>
            <div style={css('display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #EEF1F5;background:#F6F8FA')}><span style={css(LBL + ';margin-right:2px')}>Period</span>
              {(['all', 'year', 'last', 'month', 'custom'] as const).map((k) => <button key={k} type="button" onClick={() => { setPer(k); if (k === 'custom' && !from) { setFrom(fd(new Date(y, 0, 1).getTime()).replace(/\./g, '/')); setTo(fd(Date.now()).replace(/\./g, '/')); } }} style={css(`border-radius:16px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;${chip(per === k)}`)}>{P[k][0]}</button>)}
              {per === 'custom' && <><input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="dd/mm/yyyy" style={css('width:110px;border:1px solid #DDE3EB;border-radius:6px;padding:4px 7px;font-size:11px;font-family:inherit;color:#16223A;outline:none')} /><span style={css('font-size:10.5px;color:#5B6478')}>to</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="dd/mm/yyyy" style={css('width:110px;border:1px solid #DDE3EB;border-radius:6px;padding:4px 7px;font-size:11px;font-family:inherit;color:#16223A;outline:none')} /></>}
              <span style={css('flex-basis:100%;font-size:10px;color:#5B6478')}>{perLabel} · statement, PDF and Excel use this period</span></div>
            <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Ledger: {sel.client}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{sel.ref}</span>
              <div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={() => viewStmt(sel, pF, pT, perLabel)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>View statement</button><button type="button" onClick={() => SD.pdf('Statement ' + sel.client, stmtHtml(sel))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>PDF</button><button type="button" onClick={() => stmtCsv(sel)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Excel</button></div></div>
            <div style={css('display:grid;grid-template-columns:90px minmax(0,1.6fr) 110px 100px 100px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Details</span><span>Voucher</span><span style={css('text-align:right')}>Out</span><span style={css('text-align:right')}>In</span><span style={css('text-align:right')}>Balance</span></div>
            <div style={css('max-height:420px;overflow-y:auto')}>
              {selR.open != null && <div style={css('display:flex;padding:8px 14px;border-bottom:1px solid #F0F2F5;font-size:11px;font-style:italic;color:#5B6478')}><span>Balance brought forward</span><span style={css('margin-left:auto;font-weight:700;font-style:normal;color:#16223A')}>{rm2(selR.open)}</span></div>}
              {!selR.rows.length && <div style={css('padding:20px;text-align:center;font-size:11px;color:#5B6478')}>No entries in this period.</div>}
              {selR.rows.map((r) => (
                <div key={r.id} style={css('display:grid;grid-template-columns:90px minmax(0,1.6fr) 110px 100px 100px 110px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
                  <span style={css('font-size:11px;color:#5B6478')}>{r.date}</span><span style={css('font-size:11.5px;color:#16223A')}>{r.desc}</span><span style={css('font-size:10.5px;color:#3D6B9C;font-weight:600')}>{r.v}</span><span style={css('text-align:right;font-size:11.5px;color:#B23A2E')}>{r.out}</span><span style={css('text-align:right;font-size:11.5px;color:#2F6F4E')}>{r.inn}</span><span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{r.bal}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {F.trSub === 'c' && <CashBookCard F={F} accs={['Client account']} sub="client money only · fills in by itself from deposits, pay-outs & transfers" />}

      {F.trSub === 'r' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>3-way reconciliation</strong><span style={css('font-size:10.5px;color:#5B6478')}>Solicitors' Account Rules 1990</span></div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr))')}>
            {recRows.map((r) => (
              <div key={r.key} style={css(`padding:12px 14px;border-left:${r.bl};display:flex;flex-direction:column;gap:6px`)}>
                <span style={css('display:flex;align-items:center;gap:6px')}><strong style={css('font-size:12px;color:#16223A')}>{r.label}</strong><span style={css(`margin-left:auto;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${r.sbg};color:${r.sfg}`)}>{r.status}</span></span>
                {([['Client ledgers total', r.r.ledgers], ['Cash book', r.r.cash], ['Bank statement', r.r.bank]] as [string, number | null][]).map(([label, a]) => <span key={label} style={css('display:flex;font-size:11px;color:#5B6478')}><span>{label}</span><strong style={css('margin-left:auto;color:#16223A')}>{a == null ? '—' : rm(a)}</strong></span>)}
                <span style={css('font-size:10px;color:#5B6478')}>{r.note}</span>
                {r.canRec && <button type="button" onClick={() => setRcOpen(true)} style={css('align-self:flex-start;margin-top:2px;border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{r.signed ? 'View reconciliation' : r.st ? 'Continue reconciling' : 'Reconcile ' + MONTHS[r.m.getMonth()]}</button>}
              </div>
            ))}
          </div>
          <div style={css('padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:10.5px;line-height:1.5;color:#5B6478')}>Client money is never office income. It may only be moved to office after an invoice is issued to that same client, and every transfer needs two signatories.</div>
        </div>
      )}
      {rcOpen && <ReconcileModal F={F} m={lastRec.m} onClose={() => setRcOpen(false)} />}

      {F.trSub === 's' && (
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Monthly client statements</strong><span style={css('font-size:10.5px;color:#5B6478')}>every client with money in the client account gets one</span>
          <select value={String(stMonIdx)} onChange={(e) => setStMonIdx(Number(e.target.value))} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer')}>{stMonths.map((d, i) => <option key={i} value={String(i + 1)}>{MONTHS[d.getMonth()]} {d.getFullYear()}{i === 0 ? ' · current' : ''}</option>)}</select>
          <span style={css('font-size:10.5px;color:#5B6478')}>{run ? `${run.count} of ${run.count} generated ${fd(run.at)}` : `${stmts.length} clients have a balance`}</span>
          {isCur && <button type="button" onClick={sendStmts} style={css(`border:0;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:${run ? '#2F6F4E' : '#16223A'};color:#fff;cursor:pointer;font-family:inherit`)}>{run ? 'Sent ✓' : `Send ${MONTHS[sm.getMonth()]} statements`}</button>}</div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 110px 110px 120px 110px 70px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Client</span><span style={css('text-align:right')}>Balance {monthEnd(sm).getDate()} {MON[sm.getMonth()]}</span><span>Send by</span><span>Last sent</span><span>{MONTHS[sm.getMonth()]}</span><span></span></div>
          {!stmts.length && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No client had money in the client account at the end of {MONTHS[sm.getMonth()]}.</div>}
          {stmts.map(({ l, b }) => { const c = lk.clientById.get(l.clientId); const via = c?.email ? (c?.address ? 'Email + post' : 'Email') : c?.address ? 'Post (no email)' : 'No contact on file'; const nil = b <= 0.005; const [sbg, sfg, st] = nil ? ['#F0F2F5', '#5B6478', 'No balance · skipped'] : run ? ['#E6EFE9', '#2F6F4E', 'Sent ' + sentOn] : ['#FBF2E9', '#8A6534', 'Due ' + sentOn]; return (
            <div key={l.key} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 110px 110px 120px 110px 70px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
              <span style={css('font-size:11.5px;font-weight:600;color:#16223A')}>{l.client}{l.caseId ? ' · ' + (findCase(lk, l.caseId)?.ref || '') : ''}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{rm(b)}</span>
              <span style={css('font-size:10.5px;color:#5B6478')}>{via}</span>
              <span style={css('font-size:10.5px;color:#5B6478')}>{run ? fd(run.at) : '—'}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${sbg};color:${sfg}`)}>{st}</span>
              <button type="button" onClick={() => viewStmt(l, sm.getTime(), smEnd, fd(sm.getTime()) + ' to ' + fd(smEnd))} style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>View</button>
            </div>
          ); })}
          <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Statements are generated on the 1st for every ledger with a balance, as PDF, and logged. Clients with RM 0 balance are skipped. Email sending isn't connected yet: send the PDFs from your mailbox.</div></div>
      )}
    </div>
  );
};

/* ------------------------------ Reconcile a month (design: 4 steps with partner sign-off) ------------------------------ */
const ReconcileModal = ({ F, m, onClose }: { F: FinanceCtrl; m: Date; onClose: () => void }) => {
  const key = periodKey(m); const end = monthEnd(m);
  const r = F.reconFor(m);
  const st = (F.settings.clientBankStatements || {})[key];
  const rule = F.ruleFor('recon'); const sign = F.signoffs('recon:' + key); const signed = rule.done(sign);
  const [bankIn, setBankIn] = useState(r.bank == null ? '' : String(r.bank));
  const save = (patch: Partial<NonNullable<typeof st>>) => { if (!F.canPrepare) { F.toastMsg('The reconciliation is prepared by Accounts.'); return; } const cur = { balance: st?.balance ?? (r.bank ?? 0), by: F.me, at: new Date().toISOString(), ...(st || {}), ...patch }; F.saveSettings({ clientBankStatements: { ...(F.settings.clientBankStatements || {}), [key]: cur } }); };
  // Cash-book entries of the month that may not be on the bank statement yet (deposits in transit / unpresented).
  const items = F.cashBook('Client account').filter((x) => x.t && x.t >= m.getTime() && x.t <= end.getTime() + 86399999);
  const out = new Set(st?.outstanding || []);
  const listed = items.filter((x) => out.has(x.key)).reduce((s, x) => s + x.inn - x.out, 0);
  const bank = r.bank;
  const adj = (bank || 0) + listed; const diff = Math.round((r.cash - adj) * 100) / 100;
  const bal = bank != null && Math.abs(diff) < 0.005 && Math.abs(r.ledgers - r.cash) < 0.005;
  const ready = bal && !!st?.proof;
  const onStmt = async (f?: File | null) => {
    if (!f) return; if (proofUploadBlocked()) { F.toastMsg(DRIVE_REQUIRED_MSG); return; }
    try { const meta = await storeFinanceProof(f, F.me, 'Client account statement ' + key); save({ proof: { name: f.name, driveFileId: meta.driveFileId, webViewLink: meta.webViewLink } }); F.toastMsg(f.name + ' saved to Google Drive'); } catch (e) { F.toastMsg('Could not save ' + f.name + ': ' + (e instanceof Error ? e.message : 'upload failed')); }
  };
  const label = `${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
  const LBL = 'font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
  const pdf = () => SD.pdf('3-way reconciliation ' + label, SD.tableHtml('3-way reconciliation · Client account · ' + label, 'as at ' + fd(end.getTime()), ['Item', 'RM'], [['Client ledgers total', rm2(r.ledgers)], ['Cash book balance', rm2(r.cash)], ['Bank statement balance', bank == null ? '—' : rm2(bank)], ['Add / less: items not yet on the statement', rm2(listed)], ['Adjusted bank balance', rm2(adj)], ['Difference', rm2(diff)], ['Signed off', signed ? Object.keys(sign).join(' & ') : 'Pending']]));
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <div style={css('width:760px;max-width:calc(100% - 32px);align-self:flex-start;border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;background:#16223A')}><strong style={css('color:#fff;font-size:13px')}>Reconcile {label}</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>Client account · as at {fd(end.getTime())}</span><div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={pdf} style={css('border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>PDF</button><button type="button" onClick={onClose} style={css('border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>Close</button></div></div>
        <div style={css('padding:16px;display:flex;flex-direction:column;gap:16px')}>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(LBL)}>1 · The three figures</span>
            <div style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
              {([['Client ledgers total', 'sum of all ' + F.ledgers.length + ' client ledgers', rm2(r.ledgers)], ['Cash book', 'client account column, Client Account › Cash book', rm2(r.cash)]] as [string, string, string][]).map(([l, n, a]) => <div key={l} style={css('display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #F0F2F5')}><span style={css('display:flex;flex-direction:column')}><strong style={css('font-size:11.5px;color:#16223A')}>{l}</strong><span style={css('font-size:10px;color:#5B6478')}>{n}</span></span><strong style={css('margin-left:auto;font-size:12px;color:#16223A')}>{a}</strong></div>)}
              <div style={css('display:flex;align-items:center;gap:10px;padding:8px 12px')}><span style={css('display:flex;flex-direction:column')}><strong style={css('font-size:11.5px;color:#16223A')}>Bank statement</strong><span style={css('font-size:10px;color:#5B6478')}>closing balance {fd(end.getTime())} · key it in from the statement</span></span><input value={bankIn} disabled={!F.canPrepare || signed} onChange={(e) => setBankIn(e.target.value)} onBlur={() => { if (bankIn !== (r.bank == null ? '' : String(r.bank))) F.setStatement(m, bankIn); }} placeholder="0.00" style={css('margin-left:auto;width:130px;text-align:right;border:1px solid #DDE3EB;border-radius:6px;padding:4px 7px;font-size:12px;font-weight:700;color:#16223A;font-family:inherit;background:#fff')} /></div>
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(LBL)}>2 · Upload the bank statement</span>
            <div style={css('display:flex;align-items:center;gap:10px;border:1px dashed #C9D3E0;border-radius:8px;padding:10px 12px')}><label style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Choose PDF / Excel<input type="file" accept=".pdf,.xlsx,.xls,.csv" disabled={!F.canPrepare || signed} onChange={(e) => onStmt(e.target.files && e.target.files[0])} style={css('display:none')} /></label>{st?.proof ? (st.proof.webViewLink ? <a href={st.proof.webViewLink} target="_blank" rel="noopener noreferrer" style={css('font-size:11px')}>{st.proof.name}</a> : <span style={css('font-size:11px;color:#5B6478')}>{st.proof.name}</span>) : <span style={css('font-size:11px;color:#5B6478')}></span>}{st?.proof && <span style={css('margin-left:auto;font-size:10.5px;font-weight:700;color:#2F6F4E')}>Attached</span>}</div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(LBL)}>3 · Explain the difference · tick items in the cash book but not yet on the bank statement</span>
            <div style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
              {!items.length && <div style={css('padding:8px 12px;font-size:11px;color:#5B6478')}>No cash-book entries in {label}.</div>}
              <div style={css('max-height:240px;overflow:auto')}>
                {items.map((x) => { const on = out.has(x.key); return <button key={x.key} type="button" disabled={signed} onClick={() => { const n = new Set(out); if (on) n.delete(x.key); else n.add(x.key); save({ outstanding: [...n] }); }} style={css('width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;border:0;border-bottom:1px solid #F0F2F5;background:#fff;cursor:pointer;font-family:inherit;text-align:left')}><span style={css(`font-size:15px;color:${on ? '#2F6F4E' : '#16223A'}`)}>{on ? '☑' : '☐'}</span><span style={css('display:flex;flex-direction:column;min-width:0')}><strong style={css('font-size:11.5px;color:#16223A')}>{x.who} · {x.what}</strong><span style={css('font-size:10px;color:#5B6478')}>{fd(x.t)} · {x.no} · {x.inn ? 'deposit not yet credited' : 'payment not yet presented'}</span></span><strong style={css('margin-left:auto;font-size:12px;color:#16223A')}>{rm2(x.inn || -x.out)}</strong></button>; })}
              </div>
              <div style={css('display:flex;padding:8px 12px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>Adjusted bank balance</span><strong style={css('margin-left:auto')}>{bank == null ? '—' : rm2(adj)}</strong></div>
              <div style={css(`display:flex;padding:8px 12px;font-size:11px;font-weight:700;color:${bal ? '#2F6F4E' : '#B23A2E'}`)}><span>{bal ? 'Difference · balanced' : 'Difference · still to explain'}</span><span style={css('margin-left:auto')}>{bank == null ? '—' : rm2(Math.abs(diff))}</span></div>
            </div>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(LBL)}>4 · Partner sign-off ({rule.rule})</span>
            <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px')}>{rule.people.map((p) => { const on = !!sign[p.code]; const mine = p.userId === F.app.currentUser?.id; return (
              <div key={p.code} style={css('display:flex;align-items:center;gap:8px;border:1px solid #DDE3EB;border-radius:8px;padding:9px 12px')}><span style={css('display:flex;flex-direction:column')}><strong style={css('font-size:11.5px;color:#16223A')}>{p.name}</strong><span style={css('font-size:10px;color:#5B6478')}>{p.isMP ? 'Super Admin' : 'Partner'}</span></span>
                <button type="button" onClick={() => { if (!mine) { F.toastMsg(p.name + ' signs this in their own login.'); return; } if (!on && !ready) { F.toastMsg('Upload the bank statement and explain the difference first'); return; } F.signOff('recon', key); }} style={css(`margin-left:auto;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:${on ? '#E6EFE9' : '#16223A'};color:${on ? '#2F6F4E' : '#fff'};cursor:pointer;font-family:inherit`)}>{on ? 'Signed ' + fd(sign[p.code].at) : 'Sign off'}</button></div>
            ); })}</div>
            {!ready && !signed && <span style={css('font-size:10.5px;color:#5B6478')}>Sign-off opens once the statement is attached and the difference is RM 0.00.</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
