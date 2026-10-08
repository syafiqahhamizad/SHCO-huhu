import React, { useState } from 'react';
import type { CashAcc, FinanceCtrl } from './useFinanceController';
import { css, fd, MON, proofLink, proofMissingMsg } from './financeModel';
import type { FinanceProof } from '../../../types';
import * as SD from '../../../lib/financeDocs';

/**
 * Cash book (design: Client Account › Cash book and Office Account › Cash book). Fills in by itself
 * from receipts, expenses, vouchers, claims, payroll and journals (F.cashBook). One month or all.
 */
export const CashBookCard = ({ F, accs, sub }: { F: FinanceCtrl; accs: CashAcc[]; sub: string }) => {
  const acc: CashAcc = accs.includes(F.cbAcc) ? F.cbAcc : accs[0];
  const [mon, setMon] = useState('all');
  const m = SD.money;
  const SRC: Record<string, [string, string]> = { Auto: ['#E7EEF6', '#2F5680'], Historical: ['#F1EBF6', '#6B3D8C'], Manual: ['#FBF2E9', '#8A6534'] };
  const LABEL: Record<CashAcc, string> = { Office: `Office A/C · HLB ${SD.BANK.Office[2]}`, 'Client account': `Client A/C · HLB ${SD.BANK['Client account'][2]}`, Disbursement: 'Disbursement A/C', 'Petty cash': 'Petty cash' };
  const all = F.cashBook(acc);
  const ym = (t: number) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const months = [...new Set(all.filter((r) => r.t).map((r) => ym(r.t)))].sort().reverse();
  const monLabel = (k: string) => MON[Number(k.slice(5)) - 1] + ' ' + k.slice(0, 4);
  const cur = mon !== 'all' && !months.includes(mon) ? 'all' : mon;
  const pre = cur === 'all' ? 0 : all.filter((r) => ym(r.t) < cur).reduce((s, r) => s + r.inn - r.out, 0);
  const R = cur === 'all' ? all : all.filter((r) => ym(r.t) === cur);
  const OPEN = F.openingBalance(acc) + pre;
  const hasOpen = F.banksOf(acc).length > 0 || F.firmBanksOf(acc).length > 0;
  let bal = OPEN, tin = 0, tout = 0;
  const rows = R.map((r) => { bal += r.inn - r.out; tin += r.inn; tout += r.out; return { ...r, bal }; });
  const missing = R.filter((r) => !(r.proofs || []).length).length;
  const openProofs = (owner: string, proofs: FinanceProof[]) => proofs.forEach((q) => { const u = proofLink(owner, q); if (u) window.open(u, '_blank', 'noopener'); else F.toastMsg(proofMissingMsg(q.name)); });
  const exportX = () => { SD.csv('Cash book ' + acc + (cur === 'all' ? '' : ' ' + monLabel(cur)), [['Date', 'Details', 'Doc no.', 'Source', 'In', 'Out', 'Balance', 'Proof'], ['—', 'Opening balance', '', 'Historical', '', '', m(OPEN), ''], ...rows.map((r) => [fd(r.t), r.who + ' · ' + r.what, r.no, r.src, r.inn ? m(r.inn) : '', r.out ? m(r.out) : '', m(r.bal), r.proofs.map((p) => p.name).join('; ')])]); F.toastMsg('Cash book exported'); };
  const G = 'display:grid;grid-template-columns:84px minmax(0,1.6fr) 110px 96px 100px 100px 110px 150px;gap:10px;';
  return (
    <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
      <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Cash book</strong><span style={css('font-size:10.5px;color:#5B6478')}>{sub}</span>
        <div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{accs.map((k) => { const on = k === acc; return <button key={k} type="button" onClick={() => F.setCbAcc(k)} style={css(`border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{LABEL[k]}</button>; })}</div>
        <div style={css('margin-left:auto;display:flex;gap:6px')}><select value={cur} onChange={(e) => setMon(e.target.value)} title="Show one month" style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer')}><option value="all">All months</option>{months.map((k) => <option key={k} value={k}>{monLabel(k)}</option>)}</select><button type="button" onClick={exportX} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Excel</button></div>
      </div>
      <div style={css(G + 'padding:7px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Details</span><span>Doc no.</span><span>Source</span><span style={css('text-align:right')}>In</span><span style={css('text-align:right')}>Out</span><span style={css('text-align:right')}>Balance</span><span>Proof</span></div>
      <div style={css(G + 'align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;background:#FAFBFC')}>
        <span style={css('font-size:11px;color:#5B6478')}>—</span>
        <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>Opening balance</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{cur !== 'all' ? 'brought forward to ' + monLabel(cur) : hasOpen ? 'brought forward from previous books' : 'no opening balance set on the bank account'}</span></span>
        <span></span>
        <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${SRC.Historical[0]};color:${SRC.Historical[1]}`)}>Historical</span>
        <span></span><span></span>
        <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{m(OPEN)}</span>
        <span></span>
      </div>
      {rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No entries in this cash book yet.</div>}
      <div style={css('max-height:520px;overflow:auto')}>
        {rows.map((r) => { const pf = r.proofs || []; return (
          <div key={r.key} style={css(G + `align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;background:${pf.length ? '#fff' : '#FFF8F6'}`)}>
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
      <div style={css('display:flex;gap:16px;flex-wrap:wrap;padding:9px 14px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>{'Money in ' + m(tin) + ' · money out ' + m(tout) + ' · balance ' + m(bal) + (missing ? ' · ' + missing + ' without proof' : ' · all entries have proof')}</span><span style={css('margin-left:auto;color:#5B6478')}>Each entry also posts to the client ledger (Client Account tab) and to the chart of accounts.</span></div>
    </div>
  );
};
