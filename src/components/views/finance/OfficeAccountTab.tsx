import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, fd, findCase, inPeriod, num0, parseDate, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';
import { monthlyCommitments, monthsCovered } from '../../../lib/financeCalc';
import type { SinkingFund } from '../../../services/templateService';

export const OfficeAccountTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, lk } = F;
  const { expenses, paymentVouchers, payslips, travelClaims, invoices } = app;

  /* ---- bank balances ---- */
  const mask = (no: string) => { const d = String(no || '').replace(/\s+/g, ''); return d.length > 8 ? d.slice(0, 4) + ' **** ' + d.slice(-4) : d || 'account no. to be set'; };
  // Book balance per account type = Firm Settings opening balance + every cash-book movement
  // (the stored bank-account "current balance" is never updated, so it is not used).
  const KINDS = ['Office', 'Client account', 'Disbursement', 'Petty cash'] as const;
  const kindCards = KINDS.filter((k) => F.banksOf(k).length || F.firmBanksOf(k).length).map((k) => {
    const legacy = F.banksOf(k); const firm = F.firmBanksOf(k); const bal = F.bankBal(k);
    const recs = legacy.map((b) => F.lastRecon(b.id)).filter(Boolean).sort(); const r = recs[recs.length - 1] || '';
    const names = (firm.length ? firm.map((b) => `${b.bankName}${b.accountName ? ' · ' + b.accountName : ''}`) : legacy.map((b) => `${b.bankName}${b.accountName ? ' · ' + b.accountName : ''}`)).join(' + ');
    const nos = (firm.length ? firm.map((b) => b.accountNo) : legacy.map((b) => b.accountNo)).map(mask).join(' · ');
    return { key: k, kind: k, name: names || k, bal: bal == null ? '—' : rm(bal), acc: nos, rec: r ? 'Reconciled ' + F.dShort(r) : 'Not reconciled', rc: r ? '#2F6F4E' : '#8A6534' };
  });
  const banks = kindCards.length
    ? kindCards
    : ([['Office', 'Hong Leong Current', SD.BANK.Office[2]], ['Client account', "Hong Leong Clients' A/C", SD.BANK['Client account'][2]], ['Office', 'CIMB Current', ''], ['Disbursement', 'Disbursement A/C', ''], ['Petty cash', 'Front desk', '']] as [string, string, string][]).map(([kind, name, no]) => ({ key: kind + name, kind, name, bal: '—', acc: mask(no), rec: 'No balance recorded', rc: '#8A6534' }));

  /* ---- disbursement account ---- */
  const caseBalance = (caseKey?: string) => invoices.filter((i) => (i.caseId === caseKey || i.fileRef === caseKey) && F.invIssued(i)).reduce((s, i) => s + F.invBal(i), 0);
  const DB = [
    ...paymentVouchers.filter((v) => v.accountSet !== 'CLIENT' && (v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb') && v.approvalStatus !== 'Rejected').map((v) => ({ key: 'v' + v.id, t: parseDate(v.paidAt || v.date), no: v.id, what: v.description, file: [v.fileRef, F.clientName(v.clientId)].filter(Boolean).join(' · ') || '—', to: v.payee || '—', amt: Number(v.amount || 0), billed: '—', rec: '—' })),
    ...expenses.filter((e) => e.billable && !e.claimant && e.approvalStatus !== 'Rejected').map((e) => { const k = findCase(lk, e.caseId, e.fileRef); const owes = e.billed ? caseBalance(k?.id) + caseBalance(k?.ref) : 0; return { key: 'e' + e.id, t: parseDate(e.date), no: e.id, what: e.description || e.category, file: [k?.ref || e.fileRef, k ? F.clientName(k.clientId.split(',')[0].trim()) : ''].filter(Boolean).join(' · ') || '—', to: e.payee || '—', amt: Number(e.amount || 0), billed: e.billed ? 'Billed' : '', rec: e.billed ? (owes > 0.005 ? 'Client owes' : 'Recovered') : '—' }; }),
  ].sort((a, b) => b.t - a.t);
  const dbUnbilled = DB.filter((x) => !x.billed).reduce((s, x) => s + x.amt, 0);
  const dbOwed = DB.filter((x) => x.rec === 'Client owes').reduce((s, x) => s + x.amt, 0);
  const disbBal = F.bankBal('Disbursement');

  /* ---- sinking funds (same PracticeSettings.sinkingFunds as My Dashboard → Finance) ---- */
  const persisted = F.settings.sinkingFunds || [];
  const funds: SinkingFund[] = F.fundEdit ? (F.fundsDraft || persisted) : persisted;
  const setAside = persisted.reduce((s, f) => s + Number(f.balance || 0), 0);
  // Monthly equivalent of ALL commitments: monthly + annual ÷ 12.
  const fixedMonthly = monthlyCommitments(F.settings.commitments || []);
  const covered = monthsCovered(F.officeCash == null ? null : F.officeCash - persisted.reduce((s, f) => s + Number(f.balance || 0), 0), F.settings.commitments || []);
  const free = F.officeCash == null ? null : F.officeCash - setAside;
  const reserve: [string, string, string, string][] = [
    ['Office cash', F.officeCash == null ? '—' : rm(F.officeCash), F.banksOf('Office').map((b) => b.bankName).join(' + ') || 'no office bank balance recorded', '#16223A'],
    ['Already set aside', rm(setAside), 'in sinking funds', '#8A6534'],
    ['Free cash after funds', free == null ? '—' : rm(free), free == null ? 'needs the office bank balance' : covered != null ? '= ' + covered.toFixed(1) + ' months of fixed costs (monthly + annual ÷ 12) · target 3' : '— months covered: add commitments on My Dashboard → Finance', free != null && fixedMonthly > 0 && free < fixedMonthly * 3 ? '#B23A2E' : '#2F6F4E'],
  ];
  const toggleFunds = () => {
    if (!F.canPrepare) { F.toastMsg('Sinking funds are kept by Accounts and the Managing Partner.'); return; }
    if (F.fundEdit) { if (F.fundsDraft) F.saveSettings({ sinkingFunds: F.fundsDraft }); F.setFundsDraft(null); F.setFundEdit(false); F.toastMsg('Funds saved'); }
    else { F.setFundsDraft(persisted.map((f) => ({ ...f }))); F.setFundEdit(true); }
  };
  const setF = (i: number, k: keyof SinkingFund, v: string) => F.setFundsDraft((funds.map((f, j) => (j === i ? { ...f, [k]: ['target', 'balance', 'monthly'].includes(k) ? num0(v) : v } : f))));

  /* ---- where the money went (this month) ---- */
  // Same costs as the Profit & loss (F.pnl); disbursements paid for clients are listed apart (not a cost).
  const P = F.pnl((d) => inPeriod(d, F.period));
  const cats = new Map<string, number>();
  const add = (k: string, v: number) => { if (v > 0) cats.set(k, (cats.get(k) || 0) + v); };
  add('Salaries & EPF/SOCSO', P.payroll);
  P.cats.forEach((v, k) => add(k, v));
  add('Staff claims', P.claims);
  add('Payment vouchers', P.pvs);
  const disbPaidMonth = paymentVouchers.filter((v) => v.accountSet !== 'CLIENT' && (v.voucherCategory === 'Disbursement' || v.voucherCategory === 'Client Disb') && v.paidAt && inPeriod(v.paidAt, F.period)).reduce((s, v) => s + Number(v.amount || 0), 0);
  const EC = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  const ecMax = Math.max(1, ...EC.map((x) => x[1]));

  /* ---- office expenses ---- */
  const expRows = expenses.filter((e) => !e.billable && !e.claimant && e.approvalStatus !== 'Rejected').slice().sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, 40);

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <section style={css('display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px')}>
        {banks.map((b) => (
          <div key={b.key} role="button" tabIndex={0} title="Open bank accounts & reconciliation" onClick={() => F.app.setCurrentView('bankAccounts')} style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:5px;cursor:pointer')}>
            <span style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{b.kind}</span><span style={css(`margin-left:auto;font-size:10px;font-weight:700;color:${b.rc}`)}>{b.rec}</span></span>
            <span style={css('font-size:12px;font-weight:700;color:#16223A')}>{b.name}</span>
            <span style={css('font-family:ui-serif, Georgia, serif;font-size:21px;font-weight:700;color:#16223A')}>{b.bal}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{b.acc}</span>
          </div>
        ))}
      </section>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Disbursement account</strong><span style={css('font-size:10.5px;color:#5B6478')}>court filing, searches, stamp duty, despatch paid for client files · billed back to clients</span><span style={css('margin-left:auto;display:flex;gap:14px;font-size:11px;color:#5B6478')}><span>Balance <strong style={css('color:#16223A')}>{disbBal == null ? '—' : rm(disbBal)}</strong></span><span>Waiting to be billed <strong style={css('color:#B23A2E')}>{rm2(dbUnbilled)}</strong></span><span>Billed, not yet paid <strong style={css('color:#8A6534')}>{rm2(dbOwed)}</strong></span></span></div>
        <div style={css('display:grid;grid-template-columns:70px 104px minmax(0,1.3fr) minmax(0,1fr) 90px 120px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>PV no.</span><span>What · file</span><span>Paid to</span><span style={css('text-align:right')}>Amount</span><span>Billed on</span><span>Recovered</span></div>
        {DB.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No disbursements paid for client files yet.</div>}
        {DB.slice(0, 30).map((d) => { const [rbg, rfg] = d.rec === 'Recovered' ? ['#E6EFE9', '#2F6F4E'] : d.rec === 'Client owes' ? ['#FBF2E9', '#8A6534'] : ['#F0F2F5', '#5B6478']; return (
          <div key={d.key} style={css('display:grid;grid-template-columns:70px 104px minmax(0,1.3fr) minmax(0,1fr) 90px 120px 110px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11px;color:#5B6478')}>{d.t ? fd(d.t).slice(0, 5) : '—'}</span>
            <span style={css('font-size:11px;font-weight:700;color:#16223A;overflow:hidden;text-overflow:ellipsis')}>{d.no}</span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>{d.what}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{d.file}</span></span>
            <span style={css('font-size:10.5px;color:#16223A')}>{d.to}</span>
            <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{rm2(d.amt)}</span>
            <span style={css(`font-size:10.5px;font-weight:700;color:${d.billed ? '#16223A' : '#B23A2E'}`)}>{d.billed || 'Not billed yet'}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${rbg};color:${rfg}`)}>{d.rec}</span>
          </div>
        ); })}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Unbilled items are added automatically to the next invoice for that file. Top up from the office account when the balance falls below RM 5,000.</div>
      </div>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Cash reserve &amp; sinking funds</strong><span style={css('font-size:10.5px;color:#5B6478')}>money set aside so we always have enough before it is due</span><button type="button" onClick={toggleFunds} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{F.fundEdit ? 'Done' : 'Edit funds'}</button></div>
        <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #EEF1F5')}>
          {reserve.map(([label, value, note, c], i) => <div key={label} style={css(`padding:12px 14px;border-left:${i ? '1px solid #EEF1F5' : '0'}`)}><div style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{label}</div><div style={css(`font-family:ui-serif, Georgia, serif;font-size:20px;font-weight:700;color:${c}`)}>{value}</div><div style={css('font-size:10.5px;color:#5B6478')}>{note}</div></div>)}
        </div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 90px;gap:12px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Fund</span><span style={css('text-align:right')}>Target</span><span>Saved</span><span>Due</span><span style={css('text-align:right')}>Set aside / month</span><span>Status</span></div>
        {!F.fundEdit && funds.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No sinking funds yet. Use “Edit funds” → “+ Add fund”.</div>}
        {!F.fundEdit && funds.map((f) => { const t = Number(f.target || 0), s = Number(f.balance || 0), m = Number(f.monthly || 0); const w = t > 0 ? Math.round(s / t * 100) : 0, short = m > 0 && w < 60; const c = w >= 100 ? '#2F6F4E' : short ? '#B23A2E' : '#8A6534'; return (
          <div key={f.id} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 90px;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{f.name}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{f.note || ''}</span></span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(t)}</span>
            <span style={css('display:flex;align-items:center;gap:8px')}><span style={css('flex:1;height:6px;border-radius:3px;background:#EEF1F5')}><span style={css(`display:block;height:6px;border-radius:3px;background:${c};width:${Math.min(100, w)}%`)}></span></span><span style={css('font-size:11px;font-weight:700;color:#16223A;white-space:nowrap')}>{rm(s)} · {w}%</span></span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{f.due || '—'}</span>
            <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{m ? rm(m) : '—'}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${w >= 100 ? '#E6EFE9' : short ? '#FBEDE9' : '#FBF2E9'};color:${c}`)}>{w >= 100 ? 'Ready' : short ? 'Behind' : 'On track'}</span>
          </div>
        ); })}
        {F.fundEdit && (
          <>
            {funds.map((f, i) => (
              <div key={f.id} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) 90px 110px 90px;gap:12px;align-items:center;padding:6px 14px;border-bottom:1px solid #F0F2F5')}>
                <input value={f.name} onChange={(e) => setF(i, 'name', e.target.value)} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff')} /><input value={String(f.target)} onChange={(e) => setF(i, 'target', e.target.value)} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff;text-align:right')} /><input value={String(f.balance)} onChange={(e) => setF(i, 'balance', e.target.value)} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff;text-align:right')} /><input value={f.due || ''} onChange={(e) => setF(i, 'due', e.target.value)} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff')} /><input value={String(f.monthly)} onChange={(e) => setF(i, 'monthly', e.target.value)} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff;text-align:right')} /><button type="button" onClick={() => F.setFundsDraft(funds.filter((_, j) => j !== i))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit;white-space:nowrap')}>Remove</button>
              </div>
            ))}
            <div style={css('padding:8px 14px')}><button type="button" onClick={() => F.openForm('fund', {})} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>+ Add fund</button></div>
          </>
        )}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Funds sit in the office account as virtual pots. Same funds show on My Dashboard → Profit &amp; loss.</div></div>
      <section style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:16px;align-items:start')}>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Where the money went · {F.monthName}</strong></div>
          {EC.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No office spending recorded this month.</div>}
          {EC.map(([label, a]) => (
            <div key={label} style={css('display:grid;grid-template-columns:150px minmax(0,1fr) 80px;gap:10px;align-items:center;padding:7px 14px')}><span style={css('font-size:11.5px;color:#16223A')}>{label}</span><div style={css('height:8px;border-radius:3px;background:#EEF1F5')}><div style={css(`height:8px;border-radius:3px;background:#3D6B9C;width:${Math.round(a / ecMax * 100)}%`)}></div></div><strong style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(a)}</strong></div>
          ))}
          <div style={css('display:flex;padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:11.5px;color:#16223A')}><span>Total</span><strong style={css('margin-left:auto')}>{rm(EC.reduce((s, x) => s + x[1], 0))}</strong></div>
          {disbPaidMonth > 0 && <div style={css('padding:7px 14px;font-size:10.5px;color:#5B6478')}>Plus {rm(disbPaidMonth)} disbursements paid for client files (recovered on invoices, not a cost).</div>}
        </div>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Office expenses</strong><span style={css('font-size:10.5px;color:#5B6478')}>latest first</span><button type="button" onClick={() => F.openForm('expense', {})} style={css('margin-left:auto;border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>+ Record expense</button></div>
          <div style={css('display:grid;grid-template-columns:70px minmax(0,1.4fr) 110px 90px 80px 76px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Paid to · for</span><span>Category</span><span style={css('text-align:right')}>Amount</span><span>From</span><span>Receipt</span></div>
          {expRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No office expenses recorded yet.</div>}
          {expRows.map((e) => { const has = !!(e.paidProof || (e.documents || []).length || e.attachmentUrl || e.attachmentName); return (
            <div key={e.id} style={css('display:grid;grid-template-columns:70px minmax(0,1.4fr) 110px 90px 80px 76px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
              <span style={css('font-size:11px;color:#5B6478')}>{F.dShort(e.date)}</span>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:600;color:#16223A')}>{e.payee || '—'}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{e.description || ''}</span></span>
              <span style={css('font-size:10.5px;color:#16223A')}>{e.category}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{rm(Number(e.amount || 0))}</span>
              <span style={css('font-size:10.5px;color:#5B6478')}>{e.paidFrom || (e.accountSet === 'CLIENT' ? 'Client A/C' : 'Office')}</span>
              <span style={css(`font-size:10.5px;font-weight:700;color:${has ? '#2F6F4E' : '#B23A2E'}`)}>{has ? 'Attached' : 'Missing'}</span>
            </div>
          ); })}
        </div>
      </section>
    </div>
  );
};
