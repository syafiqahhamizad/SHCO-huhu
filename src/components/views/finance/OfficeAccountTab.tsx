import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, fd, findCase, num0, parseDate, rm, rm2, todayIso } from './financeModel';
import { CashBookCard } from './CashBookCard';
import { invoiceComposition, monthlyCommitments, splitReceipt } from '../../../lib/financeCalc';
import { fundBalance, investmentSummary, moveAmount, splitFee } from '../../../lib/officeFunds';
import type { FundMove, SinkingFund } from '../../../services/templateService';

const chip = (on: boolean) => `border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`;
const IN = 'border:1px solid #DDE3EB;border-radius:6px;padding:7px 9px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff';
const FLBL = 'display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
const CARD = 'overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff';
const H = 'font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A';
const mx2 = (n: number) => rm2(n);
const dm = (iso: string) => { const t = parseDate(iso); if (!t) return '—'; const d = new Date(t); return String(d.getDate()).padStart(2, '0') + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; };

/** Office Account — design: bank cards, then Office expenses · Cash book · Disbursements ·
 * Sinking funds · Emergency fund · Investment. */
const LINK = 'border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit';
export const OfficeAccountTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, lk } = F;
  const { expenses, paymentVouchers, invoices, receipts } = app;

  /* ---- bank balances (Firm Settings opening balance + every cash-book movement) ---- */
  const mask = (no: string) => { const d = String(no || '').replace(/\s+/g, ''); return d.length > 8 ? d.slice(0, 4) + ' **** ' + d.slice(-4) : d || 'account no. to be set'; };
  const KINDS = ['Office', 'Disbursement', 'Petty cash'] as const;
  const banks = KINDS.flatMap((k) => {
    const legacy = F.banksOf(k); const firm = F.firmBanksOf(k); const bal = F.bankBal(k);
    if (!legacy.length && !firm.length) return [];
    const recs = legacy.map((b) => F.lastRecon(b.id)).filter(Boolean).sort(); const r = recs[recs.length - 1] || '';
    const names = (firm.length ? firm : legacy).map((b) => `${b.bankName}${b.accountName ? ' · ' + b.accountName : ''}`).join(' + ');
    return [{ key: k, kind: k, name: names || k, bal: bal == null ? '—' : rm(bal), acc: (firm.length ? firm : legacy).map((b) => mask(b.accountNo)).join(' · '), rec: r ? 'Reconciled ' + F.dShort(r) : 'Not reconciled', rc: r ? '#2F6F4E' : '#8A6534' }];
  });

  /* ---- disbursements ---- */
  const caseBalance = (caseKey?: string) => invoices.filter((i) => (i.caseId === caseKey || i.fileRef === caseKey) && F.invIssued(i)).reduce((s, i) => s + F.invBal(i), 0);
  const DB = [
    ...paymentVouchers.filter((v) => v.accountSet !== 'CLIENT' && (v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb') && v.approvalStatus !== 'Rejected').map((v) => ({ key: 'v' + v.id, t: parseDate(v.paidAt || v.date), no: v.id, what: v.description, file: [v.fileRef, F.clientName(v.clientId)].filter(Boolean).join(' · ') || '—', to: v.payee || '—', amt: Number(v.amount || 0), billed: '', rec: '—' })),
    ...expenses.filter((e) => e.billable && !e.claimant && e.approvalStatus !== 'Rejected').map((e) => { const k = findCase(lk, e.caseId, e.fileRef); const inv = e.billed ? invoices.find((i) => (i.sourceItems?.expenses || []).includes(e.id)) : undefined; const owes = e.billed ? caseBalance(k?.id) + caseBalance(k?.ref) : 0; return { key: 'e' + e.id, t: parseDate(e.date), no: e.id, what: e.description || e.category, file: [k?.ref || e.fileRef, k ? F.clientName(k.clientId.split(',')[0].trim()) : ''].filter(Boolean).join(' · ') || '—', to: e.payee || '—', amt: Number(e.amount || 0), billed: e.billed ? inv?.id || 'Billed' : '', rec: e.billed ? (owes > 0.005 ? 'Client owes' : 'Recovered') : '—' }; }),
  ].sort((a, b) => b.t - a.t);
  const dbUnbilled = DB.filter((x) => !x.billed).reduce((s, x) => s + x.amt, 0);
  const dbOwed = DB.filter((x) => x.rec === 'Client owes').reduce((s, x) => s + x.amt, 0);
  const disbBal = F.bankBal('Disbursement');

  /* ---- emergency fund & investment (movements in Firm Settings sync) ---- */
  const EF = F.settings.emergencyFund || {};
  const emBal = fundBalance(EF.log);
  const FIX = monthlyCommitments(F.settings.commitments || []);
  const emM = EF.months || 3, emT = FIX * emM;
  const IV = F.settings.investments || {};
  const ivS = investmentSummary(IV.log);

  /* ---- sinking funds ---- */
  const persisted = F.settings.sinkingFunds || [];
  const funds: SinkingFund[] = F.fundEdit ? (F.fundsDraft || persisted) : persisted;
  const setAside = persisted.reduce((s, f) => s + Number(f.balance || 0), 0);
  const free = F.officeCash == null ? null : F.officeCash - setAside - emBal;
  const reserve: [string, string, string, string][] = [
    ['Office cash', F.officeCash == null ? '—' : rm(F.officeCash), F.banksOf('Office').map((b) => b.bankName).join(' + ') || F.firmBanksOf('Office').map((b) => b.bankName).join(' + ') || 'no office bank balance recorded', '#16223A'],
    ['Set aside in sinking funds', rm(setAside), 'plus ' + rm(emBal) + ' in emergency fund', '#8A6534'],
    ['Free cash after funds', free == null ? '—' : rm(free), free == null ? 'needs the office bank balance' : 'for day-to-day running costs', '#16223A'],
  ];
  const toggleFunds = () => {
    if (!F.canPrepare) { F.toastMsg('Sinking funds are kept by Accounts and admins.'); return; }
    if (F.fundEdit) { if (F.fundsDraft) F.saveSettings({ sinkingFunds: F.fundsDraft }); F.setFundsDraft(null); F.setFundEdit(false); F.toastMsg('Funds saved'); }
    else { F.setFundsDraft(persisted.map((f) => ({ ...f }))); F.setFundEdit(true); }
  };
  const setF = (i: number, k: keyof SinkingFund, v: string) => F.setFundsDraft(funds.map((f, j) => (j === i ? { ...f, [k]: ['target', 'balance', 'monthly', 'pct'].includes(k) ? num0(v) : v } : f)));

  /* ---- fees waiting to be split into the funds ---- */
  const totalPct = persisted.reduce((s, f) => s + Number(f.pct || 0), 0) + Number(EF.pct || 0);
  const splits = F.settings.fundSplits || {};
  const since = new Date(F.now.getFullYear(), F.now.getMonth() - 1, 1).getTime();
  const feeRows = receipts.filter((r) => r.accountSet !== 'CLIENT' && !!r.invoiceId && !r.historical && parseDate(r.date) >= since).map((r) => { const inv = invoices.find((i) => i.id === r.invoiceId); const amt = inv ? Math.round(splitReceipt(Number(r.amount || 0), invoiceComposition(inv)).income * 100) / 100 : Number(r.amount || 0); return { r, amt }; }).filter((x) => x.amt > 0.005).sort((a, b) => parseDate(b.r.date) - parseDate(a.r.date));
  const targets = [...persisted.map((f) => ({ key: f.id, name: f.name, pct: Number(f.pct || 0), target: Number(f.target || 0), balance: Number(f.balance || 0) })), { key: '__emergency', name: 'Emergency fund', pct: Number(EF.pct || 0), target: emT, balance: emBal }];
  const [splitOpen, setSplitOpen] = useState<string | null>(null);
  const confirmSplit = (id: string, amt: number) => {
    if (!F.canPrepare) { F.toastMsg('Fees are split by Accounts.'); return; }
    const s = splitFee(amt, targets);
    const next = persisted.map((f) => { const p = s.parts.find((x) => x.key === f.id); return p && p.amount ? { ...f, balance: Math.round((Number(f.balance || 0) + p.amount) * 100) / 100 } : f; });
    const ep = s.parts.find((p) => p.key === '__emergency' && p.amount);
    const at = new Date().toISOString();
    F.saveSettings({ sinkingFunds: next, fundSplits: { ...splits, [id]: { at, by: F.me, total: s.used } }, ...(ep ? { emergencyFund: { ...EF, log: [{ id: 'em-' + Date.now(), date: todayIso(), kind: 'Deposit', place: 'From fee split', amount: ep.amount, note: 'Top-up · ' + ep.pct + '% of ' + id, by: F.me, at }, ...(EF.log || [])] } } : {}) });
    setSplitOpen(null); F.toastMsg(rm2(s.used) + ' moved into ' + s.parts.filter((p) => p.amount).length + ' funds');
  };

  /* ---- office expenses ---- */
  const expRows = expenses.filter((e) => !e.billable && !e.claimant && e.approvalStatus !== 'Rejected').slice().sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, 60);

  const subs: ['e' | 'c' | 'd' | 'f' | 'm' | 'i', string, number][] = [['e', 'Office expenses', 0], ['c', 'Cash book', 0], ['d', 'Disbursements', DB.filter((x) => !x.billed).length], ['f', 'Sinking funds', 0], ['m', 'Emergency fund', 0], ['i', 'Investment', 0]];
  const sub = F.ofSub;
  return (
    <div style={css('display:flex;flex-direction:column;gap:14px')}>
      <section style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px')}>
        {banks.length === 0 && <div style={css('grid-column:1 / -1;border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;font-size:11.5px;color:#5B6478')}>No office bank accounts set up yet. Add them in Firm &amp; Practice Settings › Banks.</div>}
        {banks.map((b) => (
          <div key={b.key} style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:5px')}>
            <span style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{b.kind}</span><span style={css(`margin-left:auto;font-size:10px;font-weight:700;color:${b.rc}`)}>{b.rec}</span></span>
            <span style={css('font-size:12px;font-weight:700;color:#16223A')}>{b.name}</span>
            <span style={css('font-family:ui-serif, Georgia, serif;font-size:21px;font-weight:700;color:#16223A')}>{b.bal}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{b.acc}</span>
          </div>
        ))}
      </section>
      <div style={css('display:flex;align-items:center;gap:4px;flex-wrap:wrap')}>{subs.map(([k, label, n]) => { const on = sub === k; return <button key={k} type="button" onClick={() => { F.setOfSub(k); if (k === 'c' && F.cbAcc === 'Client account') F.setCbAcc('Office'); }} style={css(`display:flex;align-items:center;gap:6px;border-radius:16px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;${chip(on)}`)}>{label}{!!n && <span style={css(`font-size:10px;padding:0 6px;border-radius:9px;background:${on ? '#fff' : '#EEF1F5'};color:${on ? '#16223A' : '#5B6478'}`)}>{n}</span>}</button>; })}</div>

      {sub === 'e' && (
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Office expenses</strong><span style={css('font-size:10.5px;color:#5B6478')}>latest first</span></div>
          <div style={css('display:grid;grid-template-columns:70px minmax(0,1.4fr) 110px 90px 80px 76px 92px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Paid to · for</span><span>Category</span><span style={css('text-align:right')}>Amount</span><span>From</span><span>Receipt</span></div>
          {expRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No office expenses recorded yet. Use “Money out” › Office expense.</div>}
          {expRows.map((e) => { const has = !!(e.paidProof || (e.documents || []).length || e.attachmentUrl || e.attachmentName); return (
            <div key={e.id} style={css('display:grid;grid-template-columns:70px minmax(0,1.4fr) 110px 90px 80px 76px 92px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
              <span style={css('font-size:11px;color:#5B6478')}>{F.dShort(e.date)}</span>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>{e.payee || '—'}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{e.description || ''}</span></span>
              <span style={css('font-size:10.5px;color:#16223A')}>{e.category}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{rm(Number(e.amount || 0))}</span>
              <span style={css('font-size:10.5px;color:#5B6478')}>{e.paidFrom || (e.accountSet === 'CLIENT' ? 'Client A/C' : 'Office')}</span>
              <span style={css(`font-size:10.5px;font-weight:700;color:${has ? '#2F6F4E' : '#B23A2E'}`)}>{has ? 'Attached' : 'Missing'}</span>
              <span style={css('display:flex;gap:8px;justify-content:flex-end')}>{F.canPrepare && <button type="button" onClick={() => void F.editEntry('expense', e.id)} style={css(LINK)}>Edit</button>}{F.canDeleteBills && <button type="button" onClick={() => F.deleteEntry('expense', e.id)} style={css(LINK + ';color:#B23A2E')}>Delete</button>}</span>
            </div>
          ); })}
        </div>
      )}

      {sub === 'c' && <CashBookCard F={F} accs={['Office', 'Disbursement', 'Petty cash']} sub="firm money · fills in by itself from receipts, expenses & disbursements" />}

      {sub === 'd' && (
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Disbursement account</strong><span style={css('font-size:10.5px;color:#5B6478')}>court filing, searches, stamp duty, despatch paid for client files · billed back to clients</span><span style={css('margin-left:auto;display:flex;gap:14px;font-size:11px;color:#5B6478')}><span>Balance <strong style={css('color:#16223A')}>{disbBal == null ? '—' : rm(disbBal)}</strong></span><span>Waiting to be billed <strong style={css('color:#B23A2E')}>{rm2(dbUnbilled)}</strong></span><span>Billed, not yet paid <strong style={css('color:#8A6534')}>{rm2(dbOwed)}</strong></span></span></div>
          <div style={css('display:grid;grid-template-columns:70px 104px minmax(0,1.3fr) minmax(0,1fr) 90px 120px 110px 92px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>PV no.</span><span>What · file</span><span>Paid to</span><span style={css('text-align:right')}>Amount</span><span>Billed on</span><span>Recovered</span></div>
          {DB.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No disbursements paid for client files yet.</div>}
          {DB.slice(0, 40).map((d) => { const [rbg, rfg] = d.rec === 'Recovered' ? ['#E6EFE9', '#2F6F4E'] : d.rec === 'Client owes' ? ['#FBF2E9', '#8A6534'] : ['#F0F2F5', '#5B6478']; return (
            <div key={d.key} style={css('display:grid;grid-template-columns:70px 104px minmax(0,1.3fr) minmax(0,1fr) 90px 120px 110px 92px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
              <span style={css('font-size:11px;color:#5B6478')}>{d.t ? fd(d.t).slice(0, 5) : '—'}</span>
              <span style={css('font-size:11px;font-weight:700;color:#16223A;overflow:hidden;text-overflow:ellipsis')}>{d.no}</span>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>{d.what}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{d.file}</span></span>
              <span style={css('font-size:10.5px;color:#16223A')}>{d.to}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{rm2(d.amt)}</span>
              <span style={css(`font-size:10.5px;font-weight:700;color:${d.billed ? '#16223A' : '#B23A2E'}`)}>{d.billed || 'Not billed yet'}</span>
              <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${rbg};color:${rfg}`)}>{d.rec}</span>
              <span style={css('display:flex;gap:8px;justify-content:flex-end')}>{F.canPrepare && <button type="button" onClick={() => void F.editEntry(d.key[0] === 'v' ? 'pv' : 'expense', d.key.slice(1))} style={css(LINK)}>Edit</button>}{F.canDeleteBills && <button type="button" onClick={() => F.deleteEntry(d.key[0] === 'v' ? 'pv' : 'expense', d.key.slice(1))} style={css(LINK + ';color:#B23A2E')}>Delete</button>}</span>
            </div>
          ); })}
          <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Unbilled items are added automatically to the next invoice for that file. Top up from the office account when the balance falls below RM 5,000.</div>
        </div>
      )}

      {sub === 'f' && (
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <div style={css(CARD)}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Sinking funds</strong><span style={css('font-size:10.5px;color:#5B6478')}>saving ahead for bills we know are coming</span><button type="button" onClick={() => (F.canPrepare ? F.openForm('fund', {}) : F.toastMsg('Sinking funds are kept by Accounts and admins.'))} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Add fund</button><button type="button" onClick={toggleFunds} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{F.fundEdit ? 'Done' : 'Edit funds'}</button></div>
            <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #EEF1F5')}>{reserve.map(([label, value, note, c], i) => <div key={label} style={css(`padding:12px 14px;border-left:${i ? '1px solid #EEF1F5' : '0'}`)}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{label}</div><div style={css(`font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:${c}`)}>{value}</div><div style={css('font-size:10.5px;color:#5B6478')}>{note}</div></div>)}</div>
            <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 64px 90px;gap:12px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Fund</span><span style={css('text-align:right')}>Target</span><span>Saved</span><span>Due</span><span style={css('text-align:right')}>Set aside / month</span><span style={css('text-align:right')}>Split %</span><span>Status</span></div>
            {!F.fundEdit && funds.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No sinking funds yet. Use “+ Add fund”.</div>}
            {!F.fundEdit && funds.map((f) => { const t = Number(f.target || 0), s = Number(f.balance || 0), m = Number(f.monthly || 0); const w = t > 0 ? Math.round(s / t * 100) : 0, short = m > 0 && w < 60; const c = w >= 100 ? '#2F6F4E' : short ? '#B23A2E' : '#8A6534'; return (
              <div key={f.id} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 64px 90px;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
                <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{f.name}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{f.note || ''}</span></span>
                <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(t)}</span>
                <span style={css('display:flex;align-items:center;gap:8px')}><span style={css('flex:1;height:6px;border-radius:3px;background:#EEF1F5')}><span style={css(`display:block;height:6px;border-radius:3px;background:${c};width:${Math.min(100, w)}%`)}></span></span><span style={css('font-size:11px;font-weight:700;color:#16223A;white-space:nowrap')}>{rm(s)} · {w}%</span></span>
                <span style={css('font-size:10.5px;color:#5B6478')}>{f.due || '—'}</span>
                <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{m ? rm(m) : '—'}</span><span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#8A6534')}>{f.pct ? f.pct + '%' : '—'}</span>
                <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${w >= 100 ? '#E6EFE9' : short ? '#FBEDE9' : '#FBF2E9'};color:${c}`)}>{w >= 100 ? 'Ready' : short ? 'Behind' : 'On track'}</span>
              </div>
            ); })}
            {F.fundEdit && funds.map((f, i) => (
              <div key={f.id} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 64px 90px;gap:12px;align-items:center;padding:6px 14px;border-bottom:1px solid #F0F2F5')}>
                {([['name', f.name, false], ['target', String(f.target), true], ['balance', String(f.balance), true], ['due', f.due || '', false], ['monthly', String(f.monthly), true], ['pct', String(f.pct || 0), true]] as [keyof SinkingFund, string, boolean][]).map(([k, v, right]) => <input key={k} value={v} onChange={(e) => setF(i, k, e.target.value)} style={css(`width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff${right ? ';text-align:right' : ''}`)} />)}
                <button type="button" onClick={() => F.setFundsDraft(funds.filter((_, j) => j !== i))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit;white-space:nowrap')}>Remove</button>
              </div>
            ))}
            <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Funds sit in the office account as virtual pots. Same funds show on My Dashboard → Profit &amp; loss.</div></div>
          <div style={css(CARD)}>
            <div style={css('display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Fees waiting to be split</strong><span style={css('font-size:10.5px;color:#5B6478')}>{totalPct}% to funds · {Math.max(0, 100 - totalPct)}% for running costs</span></div>
            {!feeRows.length && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No fees received since 1 {F.prevDate.toLocaleString('en-GB', { month: 'short' })}.</div>}
            {feeRows.map(({ r, amt }) => { const d = splits[r.id]; const open = !d && splitOpen === r.id; const s = splitFee(amt, targets); return (
              <React.Fragment key={r.id}>
                <div style={css('display:grid;grid-template-columns:56px minmax(0,1fr) 110px 170px;gap:12px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5')}>
                  <span style={css('font-size:10.5px;color:#5B6478')}>{dm(r.date)}</span>
                  <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.receivedFrom} · {r.invoiceId}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{r.id} · professional fees (SST &amp; disbursements left out)</span></span>
                  <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{mx2(amt)}</span>
                  {d ? <span style={css('justify-self:end;font-size:10.5px;font-weight:700;color:#2F6F4E;text-align:right')}>Split {fd(d.at).slice(0, 5)} · {mx2(d.total)} to funds</span>
                    : <button type="button" onClick={() => setSplitOpen(open ? null : r.id)} style={css(`justify-self:end;border:1px solid #16223A;border-radius:6px;padding:4px 12px;font-size:10.5px;font-weight:700;background:${open ? '#fff' : '#16223A'};color:${open ? '#16223A' : '#fff'};cursor:pointer;font-family:inherit`)}>{open ? 'Hide' : 'Split'}</button>}
                </div>
                {open && (
                  <div style={css('display:flex;flex-direction:column;gap:8px;padding:10px 14px 12px;background:#FBFCFD;border-bottom:1px solid #F0F2F5')}>
                    <div style={css('display:flex;flex-wrap:wrap;gap:6px')}>
                      {s.parts.map((p) => <span key={p.key} style={css('display:flex;flex-direction:column;gap:1px;min-width:120px;padding:6px 10px;border:1px solid #DDE3EB;border-radius:8px;background:#fff')}><span style={css('font-size:10px;color:#5B6478')}>{p.name} · {p.pct}%</span><span style={css(`font-size:12px;font-weight:700;color:${p.full ? '#9AA4B2' : '#16223A'}`)}>{p.full ? 'full · skipped' : mx2(p.amount)}</span></span>)}
                      <span style={css('display:flex;flex-direction:column;gap:1px;min-width:120px;padding:6px 10px;border:1px dashed #AEB7C4;border-radius:8px;background:#F6F8FA')}><span style={css('font-size:10px;color:#5B6478')}>Left for running costs</span><span style={css('font-size:12px;font-weight:700;color:#16223A')}>{mx2(s.rest)}</span></span>
                    </div>
                    <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}><span style={css('font-size:10.5px;color:#5B6478')}>{s.parts.length ? 'A fund that has reached its target is skipped and its share stays as free cash.' : 'No fund has a Split % yet: set it with “Edit funds”.'}</span><button type="button" onClick={() => confirmSplit(r.id, amt)} style={css('margin-left:auto;border:0;border-radius:6px;padding:6px 14px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Move {mx2(s.used)} to funds</button></div>
                  </div>
                )}
              </React.Fragment>
            ); })}
          </div>
        </div>
      )}

      {sub === 'm' && <EmergencyFund F={F} emBal={emBal} emT={emT} emM={emM} fix={FIX} />}
      {sub === 'i' && <Investment F={F} s={ivS} />}
    </div>
  );
};

/* ------------------------------ approvals on fund movements ------------------------------ */
const useMoves = (F: FinanceCtrl, which: 'emergencyFund' | 'investments') => {
  const cur = (F.settings[which] || {}) as { log?: FundMove[]; pending?: FundMove[] };
  const rule = F.ruleFor(which === 'emergencyFund' ? 'emergency' : 'investment');
  const save = (patch: object) => F.saveSettings({ [which]: { ...cur, ...patch } } as never);
  const sign = (k: number) => {
    const p = (cur.pending || [])[k]; if (!p) return;
    if (!rule.canSign(F.app.currentUser)) { F.toastMsg('This ' + rule.rule + '.'); return; }
    if (p.sign?.[F.myCode]) { F.toastMsg('You have already approved this.'); return; }
    const sg = { ...(p.sign || {}), [F.myCode]: { by: F.me, at: new Date().toISOString() } };
    if (rule.done(sg)) { save({ pending: (cur.pending || []).filter((_, j) => j !== k), log: [{ ...p, sign: sg, note: [p.note, 'Approved ' + Object.keys(sg).join(' & ')].filter(Boolean).join(' · ') }, ...(cur.log || [])] }); F.toastMsg('Approved by ' + Object.keys(sg).join(' & ')); }
    else { save({ pending: (cur.pending || []).map((x, j) => (j === k ? { ...x, sign: sg } : x)) }); F.toastMsg('Approved by you · waiting for ' + (rule.need - rule.count(sg)) + ' more'); }
  };
  const reject = (k: number) => { if (!rule.canSign(F.app.currentUser)) { F.toastMsg('This ' + rule.rule + '.'); return; } save({ pending: (cur.pending || []).filter((_, j) => j !== k) }); F.toastMsg('Rejected'); };
  const signs = (p: FundMove, k: number) => rule.people.map((x) => { const on = !!p.sign?.[x.code]; return <button key={x.code} type="button" title={x.name} onClick={() => !on && sign(k)} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${on ? '#E6EFE9' : '#fff'};color:${on ? '#2F6F4E' : '#16223A'}`)}>{on ? x.code + ' ✓' : 'Approve · ' + x.code}</button>; });
  return { cur, rule, save, signs, reject };
};
const MoveRow = ({ m }: { m: FundMove }) => { const a = moveAmount(m); return <div style={css('display:grid;grid-template-columns:56px minmax(0,1fr) 130px;gap:12px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:10.5px;color:#5B6478')}>{dm(m.date)}</span><span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{m.kind === 'Deposit' && !m.note?.startsWith('Top-up') ? 'Deposit · ' + (m.place || '') : m.note?.startsWith('Top-up') ? m.note.split(' · ').slice(0, 2).join(' · ') : m.kind + (m.place ? ' · ' + m.place : '')}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{m.note || '—'}</span></span><span style={css(`text-align:right;font-size:12px;font-weight:700;color:${a < 0 ? '#B23A2E' : '#2F6F4E'}`)}>{(a < 0 ? '− ' : '+ ') + mx2(Math.abs(a))}</span></div>; };

const EmergencyFund = ({ F, emBal, emT, emM, fix }: { F: FinanceCtrl; emBal: number; emT: number; emM: number; fix: number }) => {
  const { cur, rule, save, signs } = useMoves(F, 'emergencyFund');
  const EF = F.settings.emergencyFund || {};
  const [tab, setTab] = useState<'o' | 'l'>('o');
  const [form, setForm] = useState(false); const [amt, setAmt] = useState(''); const [why, setWhy] = useState('');
  const [ea, setEa] = useState({ date: todayIso(), amt: '', src: 'Transfer from office account', ref: '', note: '' });
  const emW = emT > 0 ? Math.min(100, Math.round(emBal / emT * 100)) : 0;
  const cover = fix > 0 ? emBal / fix : 0;
  const submit = () => { const a = num0(amt); if (!a || !why.trim()) { F.toastMsg('Add an amount and a reason'); return; } if (a > emBal) { F.toastMsg('More than the fund holds'); return; } save({ pending: [...(cur.pending || []), { id: 'em-' + Date.now(), date: todayIso(), kind: 'Withdrawal', amount: a, note: why.trim(), by: F.me, at: new Date().toISOString() }] }); setForm(false); setAmt(''); setWhy(''); F.toastMsg('Sent to ' + rule.label + ' for approval'); };
  const addMoney = () => { if (!F.canPrepare) { F.toastMsg('The emergency fund is kept by Accounts.'); return; } const a = num0(ea.amt); if (!a) { F.toastMsg('Enter an amount'); return; } save({ log: [{ id: 'em-' + Date.now(), date: ea.date, kind: 'Deposit', place: ea.src, amount: a, note: ['Top-up · ' + ea.src.toLowerCase(), ea.ref, ea.note].filter(Boolean).join(' · '), by: F.me, at: new Date().toISOString() }, ...(cur.log || [])] }); setEa({ ...ea, amt: '', ref: '', note: '' }); setTab('l'); F.toastMsg(mx2(a) + ' added to emergency fund'); };
  const setMon = (n: number) => { if (!F.canPrepare) { F.toastMsg('The emergency fund is kept by Accounts.'); return; } save({ months: n }); };
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;gap:4px;flex-wrap:wrap')}>{([['o', 'Overview'], ['l', 'Add money & movements']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} style={css(`border-radius:16px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;${chip(tab === k)}`)}>{l}</button>)}</div>
      {tab === 'l' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Add money to emergency fund</strong><span style={css('font-size:10.5px;color:#5B6478')}>record a transfer into the emergency account</span></div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:14px')}>
          <label style={css(FLBL)}>Date<input type="date" value={ea.date} onChange={(e) => setEa({ ...ea, date: e.target.value })} style={css(IN)} /></label>
          <label style={css(FLBL)}>Amount (RM)<input value={ea.amt} onChange={(e) => setEa({ ...ea, amt: e.target.value })} placeholder="0.00" style={css(IN)} /></label>
          <label style={css(FLBL)}>Money from<select value={ea.src} onChange={(e) => setEa({ ...ea, src: e.target.value })} style={css(IN)}>{['Transfer from office account', 'Opening balance', 'Interest / dividend', 'Partner capital', 'Repayment of earlier withdrawal'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label style={css(FLBL)}>Reference<input value={ea.ref} onChange={(e) => setEa({ ...ea, ref: e.target.value })} placeholder="e.g. PV no. / bank ref" style={css(IN)} /></label>
          <label style={css(FLBL + ';grid-column:1 / -1')}>Note<input value={ea.note} onChange={(e) => setEa({ ...ea, note: e.target.value })} placeholder="optional" style={css(IN)} /></label>
        </div>
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5')}><span style={css('font-size:10.5px;color:#5B6478')}>Balance now {mx2(emBal)} · fee splits add to this fund automatically</span><button type="button" onClick={addMoney} style={css('margin-left:auto;border:0;border-radius:6px;padding:7px 16px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Add to fund</button></div>
      </div>}
      {tab === 'o' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Emergency fund</strong><span style={css('font-size:10.5px;color:#5B6478')}>for the unexpected only · planned bills come from sinking funds</span><button type="button" onClick={() => setForm(!form)} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;background:#fff;color:#B23A2E')}>{form ? 'Cancel' : 'Request withdrawal'}</button></div>
        <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #EEF1F5')}>
          <div style={css('padding:12px 14px')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Balance</div><div style={css('font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:#16223A')}>{mx2(emBal)}</div><div style={css('font-size:10.5px;color:#5B6478')}>separate from the office account</div></div>
          <div style={css('padding:12px 14px;border-left:1px solid #EEF1F5')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Target</div><div style={css('font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:#16223A')}>{fix > 0 ? mx2(emT) : '—'}</div><div style={css('font-size:10.5px;color:#5B6478')}>{fix > 0 ? emM + ' months × ' + mx2(fix) + ' fixed costs' : 'add commitments on My Dashboard → Finance'}</div></div>
          <div style={css('padding:12px 14px;border-left:1px solid #EEF1F5')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Covers</div><div style={css(`font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:${emW >= 100 ? '#2F6F4E' : cover < 1 ? '#B23A2E' : '#8A6534'}`)}>{fix > 0 ? cover.toFixed(1) + ' months' : '—'}</div><div style={css('font-size:10.5px;color:#5B6478')}>{fix > 0 ? (emW >= 100 ? 'target reached · split skips this fund' : 'short by ' + mx2(emT - emBal)) : ''}</div></div>
        </div>
        <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #EEF1F5')}>
          <div style={css('flex:1;min-width:200px;height:8px;border-radius:4px;background:#EEF1F5;overflow:hidden')}><div style={css(`height:100%;width:${emW}%;background:#8A6534`)}></div></div>
          <span style={css('font-size:10.5px;color:#5B6478')}>Target</span>
          <div style={css('display:flex;gap:4px')}>{[3, 6].map((n) => <button key={n} type="button" onClick={() => setMon(n)} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${emM === n ? '#16223A' : '#fff'};color:${emM === n ? '#fff' : '#16223A'}`)}>{n} months</button>)}</div>
        </div>
        <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px 14px;background:#FBFCFD;border-bottom:1px solid #EEF1F5')}>
          <div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-size:11px;color:#16223A')}>Fills from</strong><span style={css('font-size:10.5px;color:#5B6478')}><input value={String(EF.pct || 0)} onChange={(e) => (F.canPrepare ? save({ pct: Math.min(100, num0(e.target.value)) }) : F.toastMsg('The emergency fund is kept by Accounts.'))} style={css('width:38px;border:1px solid #DDE3EB;border-radius:5px;padding:1px 4px;font-size:10.5px;font-family:inherit;text-align:right')} />% of every fee received, until target is reached</span></div>
          <div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-size:11px;color:#16223A')}>Withdrawals</strong><span style={css('font-size:10.5px;color:#5B6478')}>{rule.rule}</span></div>
          <div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-size:11px;color:#16223A')}>After use</strong><span style={css('font-size:10.5px;color:#5B6478')}>refilled first, before other sinking funds</span></div>
        </div>
        {form && <div style={css('display:grid;grid-template-columns:140px minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px 14px;background:#FBEDE9;border-bottom:1px solid #EEF1F5')}><input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount (RM)" style={css(IN)} /><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What is the emergency?" style={css(IN)} /><button type="button" onClick={submit} style={css('border:0;border-radius:6px;padding:7px 14px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Send for approval</button></div>}
        {(cur.pending || []).map((p, k) => <div key={p.id} style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 14px;background:#FBF2E9;border-bottom:1px solid #EEF1F5')}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8A6534')}>Waiting</span><span style={css('flex:1;min-width:0;font-size:11.5px;font-weight:700;color:#16223A')}>{p.note}</span><span style={css('font-size:12px;font-weight:700;color:#B23A2E')}>{mx2(p.amount)}</span>{signs(p, k)}</div>)}
      </div>}
      {tab === 'l' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Movements</strong><span style={css('font-size:10.5px;color:#5B6478')}>{mx2(emBal)} balance</span></div>
        {!(cur.log || []).length && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No movements yet.</div>}
        {(cur.log || []).map((m) => <React.Fragment key={m.id}><MoveRow m={m} /></React.Fragment>)}
      </div>}
    </div>
  );
};

const Investment = ({ F, s }: { F: FinanceCtrl; s: ReturnType<typeof investmentSummary> }) => {
  const { cur, rule, save, signs, reject } = useMoves(F, 'investments');
  const IV = F.settings.investments || {};
  const [tab, setTab] = useState<'o' | 'l'>('o');
  const [goal, setGoal] = useState({ name: IV.goalName || '', amt: IV.goalAmt ? String(IV.goalAmt) : '' });
  const [ia, setIa] = useState({ date: todayIso(), type: 'Deposit' as FundMove['kind'], place: 'Fixed deposit', amt: '', ref: '', note: '' });
  const goalAmt = num0(goal.amt); const w = goalAmt ? Math.min(100, Math.round(s.value / goalAmt * 100)) + '%' : '0%';
  const saveGoal = () => { if (!F.canPrepare && !F.isMP) return; save({ goalName: goal.name, goalAmt: goalAmt || undefined }); };
  const saveIa = () => {
    if (!F.canPrepare) { F.toastMsg('Investment entries are kept by Accounts.'); return; }
    const raw = ia.amt; const neg = /^\s*-/.test(raw); const a0 = num0(raw.replace('-', '')); if (!a0) { F.toastMsg('Enter an amount'); return; }
    const a = ia.type === 'Value change' && neg ? -a0 : a0;
    if (ia.type === 'Withdrawal' && a > (s.byPlace.find(([p]) => p === ia.place)?.[1] || 0)) { F.toastMsg('More than is held in ' + ia.place); return; }
    const mv: FundMove = { id: 'iv-' + Date.now(), date: ia.date, kind: ia.type, place: ia.place, amount: a, note: [ia.ref, ia.note].filter(Boolean).join(' · '), by: F.me, at: new Date().toISOString() };
    if (ia.type === 'Deposit' || ia.type === 'Withdrawal') { save({ pending: [...(cur.pending || []), mv] }); F.toastMsg('Sent to ' + rule.label + ' for approval'); }
    else { save({ log: [mv, ...(cur.log || [])] }); F.toastMsg(ia.type + ' saved'); }
    setIa({ ...ia, amt: '', ref: '', note: '' });
  };
  const pendN = (cur.pending || []).length;
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;gap:4px;flex-wrap:wrap')}>{([['o', 'Overview'], ['l', 'Add money & movements']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} style={css(`border-radius:16px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;${chip(tab === k)}`)}>{l}</button>)}</div>
      {tab === 'o' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Investment</strong><span style={css('font-size:10.5px;color:#5B6478')}>long-term money for the firm's future · not for running costs</span></div>
        <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #EEF1F5')}>
          <div style={css('padding:12px 14px')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Current value</div><div style={css('font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:#16223A')}>{mx2(s.value)}</div><div style={css('font-size:10.5px;color:#5B6478')}>as at last statement</div></div>
          <div style={css('padding:12px 14px;border-left:1px solid #EEF1F5')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Put in</div><div style={css('font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:#16223A')}>{mx2(s.putIn)}</div><div style={css('font-size:10.5px;color:#5B6478')}>deposits less withdrawals</div></div>
          <div style={css('padding:12px 14px;border-left:1px solid #EEF1F5')}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Returns</div><div style={css(`font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:${s.returns < 0 ? '#B23A2E' : '#2F6F4E'}`)}>{(s.returns < 0 ? '− ' : '+ ') + mx2(Math.abs(s.returns))}</div><div style={css('font-size:10.5px;color:#5B6478')}>{s.putIn ? (s.returns / s.putIn * 100).toFixed(1) + '% on money put in' : '—'}</div></div>
        </div>
        <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #EEF1F5')}>
          <span style={css('font-size:10.5px;color:#5B6478')}>Goal</span><input value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} onBlur={saveGoal} placeholder="e.g. own office premises deposit" style={css(IN + ';width:200px')} /><input value={goal.amt} onChange={(e) => setGoal({ ...goal, amt: e.target.value })} onBlur={saveGoal} placeholder="RM" style={css(IN + ';width:110px;text-align:right')} />
          <div style={css('flex:1;min-width:160px;height:8px;border-radius:4px;background:#EEF1F5;overflow:hidden')}><div style={css(`height:100%;width:${w};background:#3D6B9C`)}></div></div><span style={css('font-size:11px;font-weight:700;color:#16223A')}>{w}</span>
        </div>
        <div style={css('padding:10px 14px 4px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Where it is held</div>
        {!s.byPlace.length && <div style={css('padding:8px 14px 12px;font-size:11.5px;color:#5B6478')}>Nothing invested yet.</div>}
        {s.byPlace.map(([name, v]) => <div key={name} style={css('display:grid;grid-template-columns:minmax(0,1fr) 130px 50px;gap:12px;align-items:center;padding:8px 14px;border-top:1px solid #F0F2F5')}><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{name}</span><span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{mx2(v)}</span><span style={css('text-align:right;font-size:10.5px;color:#5B6478')}>{s.value ? Math.round(v / s.value * 100) + '%' : ''}</span></div>)}
        {pendN > 0 && <div style={css('padding:9px 14px;background:#FBF2E9;border-top:1px solid #E9D3B4;font-size:10.5px;font-weight:700;color:#8A6534')}>{pendN} waiting for approval · not counted until approved</div>}
        <div style={css('padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:10.5px;color:#5B6478')}>New investments and withdrawals {rule.rule}.</div>
      </div>}
      {tab === 'l' && <>
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Add entry</strong><span style={css('font-size:10.5px;color:#5B6478')}>money in, money out, dividends or a change in value</span></div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;padding:14px')}>
            <label style={css(FLBL)}>Date<input type="date" value={ia.date} onChange={(e) => setIa({ ...ia, date: e.target.value })} style={css(IN)} /></label>
            <label style={css(FLBL)}>Type<select value={ia.type} onChange={(e) => setIa({ ...ia, type: e.target.value as FundMove['kind'] })} style={css(IN)}>{['Deposit', 'Withdrawal', 'Dividend', 'Value change'].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label style={css(FLBL)}>Amount (RM)<input value={ia.amt} onChange={(e) => setIa({ ...ia, amt: e.target.value })} placeholder={ia.type === 'Value change' ? 'use − for a drop, e.g. -500' : '0.00'} style={css(IN)} /></label>
            <label style={css(FLBL)}>Where<select value={ia.place} onChange={(e) => setIa({ ...ia, place: e.target.value })} style={css(IN)}>{['Fixed deposit', 'ASB / ASN', 'Unit trust', 'Gold', 'Shares', 'Property', 'Other'].map((o) => <option key={o}>{o}</option>)}</select></label>
            <label style={css(FLBL)}>Reference<input value={ia.ref} onChange={(e) => setIa({ ...ia, ref: e.target.value })} placeholder="e.g. PV no. / cert no." style={css(IN)} /></label>
            <label style={css(FLBL)}>Note<input value={ia.note} onChange={(e) => setIa({ ...ia, note: e.target.value })} placeholder="optional" style={css(IN)} /></label>
          </div>
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5')}><span style={css('font-size:10.5px;color:#5B6478')}>{ia.type === 'Deposit' || ia.type === 'Withdrawal' ? 'Deposits and withdrawals go to ' + rule.label + ' for approval first' : 'Dividends and value changes are saved straight away'}</span><button type="button" onClick={saveIa} style={css('margin-left:auto;border:0;border-radius:6px;padding:7px 16px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Save entry</button></div>
        </div>
        {pendN > 0 && <div style={css('overflow:hidden;border-radius:12px;border:1px solid #E9D3B4;background:#fff')}>
          <div style={css('display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:10px 14px;background:#FBF2E9;border-bottom:1px solid #E9D3B4')}><strong style={css(H)}>Waiting for approval</strong><span style={css('font-size:10.5px;color:#8A6534')}>{pendN} waiting for approval · not counted until approved</span></div>
          {(cur.pending || []).map((p, k) => { const a = moveAmount(p); return <div key={p.id} style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('flex:1;min-width:160px')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{p.kind} · {p.place}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{dm(p.date)}{p.note ? ' · ' + p.note : ''}</span></span><span style={css(`font-size:12px;font-weight:700;color:${a < 0 ? '#B23A2E' : '#2F6F4E'}`)}>{(a < 0 ? '− ' : '+ ') + mx2(Math.abs(a))}</span>{signs(p, k)}<button type="button" onClick={() => reject(k)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;background:#fff;color:#B23A2E')}>Reject</button></div>; })}
        </div>}
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Movements</strong><span style={css('font-size:10.5px;color:#5B6478')}>{mx2(s.value)} current value</span></div>
          {!(cur.log || []).length && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No movements yet.</div>}
          {(cur.log || []).map((m) => <React.Fragment key={m.id}><MoveRow m={m} /></React.Fragment>)}
        </div>
      </>}
    </div>
  );
};
