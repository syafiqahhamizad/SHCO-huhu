import React, { useState } from 'react';
import type { ApItem, FinanceCtrl, PayItem } from './useFinanceController';
import { css, rm, rm2 } from './financeModel';
import { twoSignatoryThreshold } from '../../../services/templateService';
import { DOC_TYPE_COLORS, FINANCE_DOC_TYPES, financeDocType, matchesYearType, yearOf, yearOptions } from '../../../lib/claimFilters';
import { folderUrl } from '../../../lib/driveLayout';

const SEL = 'border:1px solid #DDE3EB;border-radius:6px;padding:4px 6px;font-size:11px;color:#16223A;background:#fff;font-family:inherit';
const driveLink = (id?: string) => (id ? <a href={folderUrl(id)} target="_blank" rel="noopener noreferrer" title="Open the Google Drive folder" style={css('display:inline-block;font-size:10px;font-weight:700;color:#3D6B9C')}>Drive folder ↗</a> : null);

export const ApprovalsTab = ({ F }: { F: FinanceCtrl }) => {
  const { apF, setApF } = F;
  const thr = twoSignatoryThreshold();
  const lim = thr % 1000 === 0 ? `RM ${thr / 1000}k` : `RM ${thr.toLocaleString('en-MY')}`;
  const T: Record<ApItem['type'], [string, string]> = { 'Staff claim': ['#E7EEF6', '#2F5680'], 'Payment voucher': ['#F1EBF6', '#6B3D8C'], 'Referral fees': ['#F7E9EE', '#8C2F4C'], 'Client account': ['#FBEDE9', '#B23A2E'], 'Write-off': ['#FBF2E9', '#8A6534'] };
  const pendingKeys = new Set(F.apItems.map((a) => a.key));
  const all = [...F.apItems.map((item) => ({ item, d: undefined as undefined | 'ok' | 'no' })), ...Object.values(F.decided).filter((x) => !pendingKeys.has(x.item.key)).map((x) => ({ item: x.item, d: x.d }))];
  const [yearF, setYearF] = useState('All');
  const [payType, setPayType] = useState('All');
  const rows = all.filter((a) => (apF === 'All' || a.item.type === apF) && (yearF === 'All' || yearOf(a.item.date) === yearF));

  const MC: Record<PayItem['method'], [string, string]> = { 'Bank transfer': ['#E7EEF6', '#2F5680'], 'Online portal': ['#F1EBF6', '#6B3D8C'], Cheque: ['#FBF2E9', '#8A6534'], 'To staff bank': ['#E6EFE9', '#2F6F4E'] };
  const FC: Record<PayItem['from'], [string, string]> = { Disbursement: ['#E4F1F1', '#2F7A7A'], Office: ['#E7EEF6', '#2F5680'], 'Client account': ['#FBEDE9', '#B23A2E'] };
  const openKeys = new Set(F.toPay.map((p) => p.key));
  const payAll = [...F.toPay.map((p) => ({ p, done: '' })), ...Object.values(F.paidNow).filter((x) => !openKeys.has(x.item.key)).map((x) => ({ p: x.item, done: x.file }))];
  const payTypeOf = (p: PayItem) => financeDocType(p.kind, p.from === 'Client account');
  const payRows = payAll.filter(({ p }) => matchesYearType({ date: p.date, docType: payTypeOf(p) }, { year: yearF, type: payType }));
  const years = yearOptions<{ date?: string }>([...all.map((a) => a.item), ...payAll.map((x) => x.p)], (x) => x.date);
  const P: Record<string, [string, string]> = { 'Partner drawings': ['#E7EEF6', '#2F5680'], Payslip: ['#E6EFE9', '#2F6F4E'], Voucher: ['#F1EBF6', '#6B3D8C'] };

  /** Staff claim for a quoted file: how it tallies with the quote. */
  const quoteNote = (a: (typeof all)[number]['item']) => {
    const q = F.claimQuote(a);
    if (!q) return null;
    const e = q.e;
    const txt = e.quoteCovered != null
      ? (e.quoteCovered > 0 ? `Inside the quote (${e.quoteLine}) RM ${e.quoteCovered.toFixed(2)}` + (q.amt - e.quoteCovered > 0.005 ? ` · RM ${(q.amt - e.quoteCovered).toFixed(2)} above the quote, to bill` : '') : 'Not part of the quote · billed to the client in full')
      : `Quote ${q.pot.source.join(', ')}: RM ${Math.max(0, q.pot.left).toFixed(2)} left of RM ${q.pot.quoted.toFixed(2)}` + (q.above > 0.005 ? ` · this claim is RM ${q.above.toFixed(2)} above the quote` : ' · fits inside the quote');
    const red = e.quoteCovered != null ? q.amt - e.quoteCovered > 0.005 : q.above > 0.005;
    return <span style={css(`display:block;font-size:10px;font-weight:700;color:${red ? '#B23A2E' : '#2F6F4E'}`)}>{txt}</span>;
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;align-items:center;gap:4px;flex-wrap:wrap')}>{([['w', 'Waiting for approval', F.pendingAp], ['p', 'Approved · to pay', F.toPay.length], ['r', 'Referral fees', F.referral.rows.length]] as ['w' | 'p' | 'r', string, number][]).map(([k, label, n]) => { const on = F.apSub === k; return <button key={k} type="button" onClick={() => F.setApSub(k)} style={css(`display:flex;align-items:center;gap:6px;border-radius:16px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}{!!n && <span style={css(`font-size:10px;padding:0 6px;border-radius:9px;background:${on ? '#fff' : '#EEF1F5'};color:${on ? '#16223A' : '#5B6478'}`)}>{n}</span>}</button>; })}
        {F.apSub !== 'r' && <span style={css('margin-left:auto;display:flex;align-items:center;gap:8px;font-size:11px;color:#5B6478')}>
          <label style={css('display:flex;align-items:center;gap:5px')}>Year<select aria-label="Year" value={yearF} onChange={(e) => setYearF(e.target.value)} style={css(SEL)}><option value="All">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
          {F.apSub === 'p' && <label style={css('display:flex;align-items:center;gap:5px')}>Type<select aria-label="Type" value={payType} onChange={(e) => setPayType(e.target.value)} style={css(SEL)}><option value="All">All types</option>{FINANCE_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>}
        </span>}</div>
      {F.apSub === 'w' && (
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Waiting for approval</strong>
          <div style={css('display:flex;flex-wrap:wrap;gap:4px;margin-left:auto')}>{['All', 'Staff claim', 'Payment voucher', 'Client account', 'Referral fees', 'Write-off'].map((f) => { const on = apF === f; return <button key={f} type="button" onClick={() => setApF(f)} style={css(`white-space:nowrap;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{f}</button>; })}</div></div>
        {rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing waiting for approval.</div>}
        {rows.map(({ item: a, d }) => { const mine = F.canSignItem(a); const pending = !d && mine; const done = !!d || !mine; return (
          <div key={a.key} style={css(`display:grid;grid-template-columns:120px minmax(0,1.5fr) 100px 90px minmax(230px,auto);gap:12px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5;opacity:${d ? 0.55 : 1}`)}>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${T[a.type][0]};color:${T[a.type][1]}`)}>{a.type}</span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{a.title}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{a.sub}</span><span style={css('display:block;font-size:10px;color:#8A6534')}>{F.apRule(a)}</span>{quoteNote(a)}{driveLink(a.folderId)}</span>
            <span style={css('text-align:right;font-size:12.5px;font-weight:700;color:#16223A')}>{rm(a.amount)}</span>
            <span style={css('display:flex;flex-direction:column;gap:2px;font-size:10.5px;color:#5B6478')}>by {a.by}{!d && (a.kind === 'travel' || a.kind === 'expense' || a.kind === 'pv') && <span style={css('display:flex;gap:8px')}><button type="button" onClick={() => F.editApItem(a.kind as 'travel', a.id)} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#2F4F7A')}>Edit</button>{F.isAdminUser && <button type="button" onClick={() => F.deleteApItem(a.kind as 'travel', a.id, a.title)} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#B23A2E')}>Delete</button>}</span>}</span>
            {pending && <div style={css('display:flex;gap:6px;justify-content:flex-end')}><button type="button" title={F.me} onClick={() => F.approve(a, true)} style={css('border:1px solid #B9D7C5;border-radius:6px;padding:5px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Approve</button><button type="button" onClick={() => F.approve(a, false)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Reject</button></div>}
            {done && <span style={css(`justify-self:end;font-size:10.5px;font-weight:700;color:${d === 'ok' ? '#2F6F4E' : d ? '#B23A2E' : '#8A6534'}`)}>{d === 'ok' ? 'Approved ✓' : d ? 'Rejected' : 'With ' + F.ruleFor(F.apId(a)).label + ' to approve'}</span>}
          </div>
        ); })}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Under {lim}: any partner · {lim} and above, or anything from the client account: Super Admin + 1 more signatory · items set up in Firm &amp; Practice Settings › Who approves follow that list</div>
      </div>
      )}
      {F.apSub === 'p' && (
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Approved · to pay</strong><span style={css('font-size:10.5px;color:#5B6478')}>staff claims and payment requests (PV) approved by partners · details come straight from the staff form</span><span style={css('margin-left:auto;font-size:12px;font-weight:700;color:#16223A')}>{rm2(F.toPay.reduce((s, x) => s + x.amount, 0))} to pay</span></div>
        <div style={css('display:grid;grid-template-columns:104px minmax(0,1.2fr) 118px minmax(0,1.3fr) 118px 90px 150px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Form no.</span><span>Pay to · for</span><span>How</span><span>Payment details</span><span>Paid from</span><span style={css('text-align:right')}>Amount</span><span></span></div>
        {payRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>{payAll.length ? 'Nothing for this year / type.' : 'Nothing approved and waiting to be paid.'}</div>}
        {payRows.map(({ p, done }) => (
          <div key={p.key} style={css(`display:grid;grid-template-columns:104px minmax(0,1.2fr) 118px minmax(0,1.3fr) 118px 90px 150px;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5;opacity:${done ? 0.6 : 1}`)}>
            <span style={css('font-size:11px;font-weight:700;color:#16223A;overflow:hidden;text-overflow:ellipsis')}>{p.no}</span>
            <span style={css('min-width:0')}><span style={css('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#16223A')}><span title="Type" style={css(`flex-shrink:0;font-size:9.5px;font-weight:700;padding:0 6px;border-radius:8px;background:${DOC_TYPE_COLORS[payTypeOf(p)][0]};color:${DOC_TYPE_COLORS[payTypeOf(p)][1]}`)}>{payTypeOf(p)}</span>{p.payee}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{p.what}</span>{driveLink(p.folderId)}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${MC[p.method][0]};color:${MC[p.method][1]}`)}>{p.method}</span>
            <span style={css('font-size:10.5px;line-height:1.4;color:#16223A')}>{p.details}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${FC[p.from][0]};color:${FC[p.from][1]}`)}>{p.from === 'Client account' ? 'Client A/C' : p.from}</span>
            <span style={css('display:flex;flex-direction:column;align-items:flex-end;gap:2px')}><span style={css('font-size:12px;font-weight:700;color:#16223A')}>{rm2(p.amount)}</span>{!done && <span style={css('display:flex;gap:8px')}><button type="button" onClick={() => F.editApItem(p.kind, p.id)} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#2F4F7A')}>Edit</button>{F.isAdminUser && <button type="button" onClick={() => F.deleteApItem(p.kind, p.id, p.no)} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#B23A2E')}>Delete</button>}</span>}</span>
            {!done && <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); F.markPaid(p, e.dataTransfer.files && e.dataTransfer.files[0]); }} title="Drag the receipt here or click to choose" style={css('justify-self:end;border:1.5px dashed #2F6F4E;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#2F6F4E;cursor:pointer;white-space:nowrap')}>{p.method === 'Online portal' ? 'Paid · drop portal receipt' : p.method === 'Cheque' ? 'Issued · drop cheque copy' : 'Paid · drop bank slip'}<input type="file" accept="image/*,.pdf" onChange={(e) => F.markPaid(p, e.target.files && e.target.files[0])} style={css('display:none')} /></label>}
            {done && <span style={css('justify-self:end;font-size:10.5px;font-weight:700;color:#2F6F4E;text-align:right')}>Paid ✓ · {done}</span>}
          </div>
        ))}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478')}>Drop or choose the bank / portal receipt to mark it paid. It posts to the cash book of the account it was paid from (email to the staff member isn't connected yet). Online portal payments (e-Filing, e-Tanah, STAMPS) need no bank details.</div>
      </div>
      )}
      {F.apSub === 'r' && (
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>{F.monthName} referral fees</strong><span style={css('font-size:10.5px;color:#5B6478')}>from Leads &amp; Referrals · % is of professional fees actually received this month (excl. disbursements &amp; SST)</span><span style={css('margin-left:auto;font-size:12px;font-weight:700;color:#16223A')}>Total {rm(F.referral.total)}{F.refDecision ? ` · ${F.refDecision.status} by ${F.refDecision.by}` : ''}</span></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px minmax(0,1.3fr) 110px 80px 100px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Referrer</span><span>Type</span><span>Files paid this month</span><span style={css('text-align:right')}>Fees received</span><span style={css('text-align:right')}>Rate</span><span style={css('text-align:right')}>Referral fee</span><span>Paid through</span></div>
        {F.referral.rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No fees received this month on referred files.</div>}
        {F.referral.rows.map((r) => (
          <div key={r.id} style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px minmax(0,1.3fr) 110px 80px 100px 110px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{r.name}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{r.type}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{r.files}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm(r.base)}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{r.flat ? 'flat' : r.rate + '%'}</span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm(r.fee)}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${P[r.via][0]};color:${P[r.via][1]}`)}>{r.via}</span>
          </div>
        ))}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Staff fees go on the {F.lastDayLabel} payslip · partner fees go to partner drawings · outside referrers get a payment voucher.</div>
      </div>
      )}
    </div>
  );
};
