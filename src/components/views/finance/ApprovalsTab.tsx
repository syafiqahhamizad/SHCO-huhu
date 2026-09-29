import React from 'react';
import type { ApItem, FinanceCtrl, PayItem } from './useFinanceController';
import { css, rm, rm2 } from './financeModel';

export const ApprovalsTab = ({ F }: { F: FinanceCtrl }) => {
  const { apF, setApF, rk } = F;
  const T: Record<ApItem['type'], [string, string]> = { 'Staff claim': ['#E7EEF6', '#2F5680'], 'Payment voucher': ['#F1EBF6', '#6B3D8C'], 'Referral fees': ['#F7E9EE', '#8C2F4C'], 'Client account': ['#FBEDE9', '#B23A2E'], 'Write-off': ['#FBF2E9', '#8A6534'] };
  const pendingKeys = new Set(F.apItems.map((a) => a.key));
  const all = [...F.apItems.map((item) => ({ item, d: undefined as undefined | 'ok' | 'no' })), ...Object.values(F.decided).filter((x) => !pendingKeys.has(x.item.key)).map((x) => ({ item: x.item, d: x.d }))];
  const rows = all.filter((a) => apF === 'All' || a.item.type === apF);

  const MC: Record<PayItem['method'], [string, string]> = { 'Bank transfer': ['#E7EEF6', '#2F5680'], 'Online portal': ['#F1EBF6', '#6B3D8C'], Cheque: ['#FBF2E9', '#8A6534'], 'To staff bank': ['#E6EFE9', '#2F6F4E'] };
  const FC: Record<PayItem['from'], [string, string]> = { Disbursement: ['#E4F1F1', '#2F7A7A'], Office: ['#E7EEF6', '#2F5680'], 'Client account': ['#FBEDE9', '#B23A2E'] };
  const openKeys = new Set(F.toPay.map((p) => p.key));
  const payRows = [...F.toPay.map((p) => ({ p, done: '' })), ...Object.values(F.paidNow).filter((x) => !openKeys.has(x.item.key)).map((x) => ({ p: x.item, done: x.file }))];
  const P: Record<string, [string, string]> = { 'Partner drawings': ['#E7EEF6', '#2F5680'], Payslip: ['#E6EFE9', '#2F6F4E'], Voucher: ['#F1EBF6', '#6B3D8C'] };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Waiting for approval</strong>
          <div style={css('display:flex;flex-wrap:wrap;gap:4px;margin-left:auto')}>{['All', 'Staff claim', 'Payment voucher', 'Client account', 'Referral fees', 'Write-off'].map((f) => { const on = apF === f; return <button key={f} type="button" onClick={() => setApF(f)} style={css(`white-space:nowrap;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{f}</button>; })}</div></div>
        {rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing waiting for approval.</div>}
        {rows.map(({ item: a, d }) => { const pending = !d && rk !== 'A'; const done = !!d || rk === 'A'; return (
          <div key={a.key} style={css(`display:grid;grid-template-columns:120px minmax(0,1.5fr) 100px 110px 190px;gap:12px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5;opacity:${d ? 0.55 : 1}`)}>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${T[a.type][0]};color:${T[a.type][1]}`)}>{a.type}</span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{a.title}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{a.sub}</span></span>
            <span style={css('text-align:right;font-size:12.5px;font-weight:700;color:#16223A')}>{rm(a.amount)}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>by {a.by}</span>
            {pending && <div style={css('display:flex;gap:6px;justify-content:flex-end')}><button type="button" onClick={() => F.approve(a, true)} style={css('border:0;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:#2F6F4E;color:#fff;cursor:pointer;font-family:inherit')}>Approve</button><button type="button" onClick={() => F.approve(a, false)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Reject</button></div>}
            {done && <span style={css(`justify-self:end;font-size:10.5px;font-weight:700;color:${d === 'ok' ? '#2F6F4E' : d ? '#B23A2E' : '#8A6534'}`)}>{d === 'ok' ? 'Approved ✓' : d ? 'Rejected' : 'With partner to approve'}</span>}
          </div>
        ); })}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Under RM 5k: any partner · RM 5k and above, or anything from the client account: Managing Partner + 1 more signatory</div>
      </div>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Approved · to pay</strong><span style={css('font-size:10.5px;color:#5B6478')}>staff claims and payment requests (PV) approved by partners · details come straight from the staff form</span><span style={css('margin-left:auto;font-size:12px;font-weight:700;color:#16223A')}>{rm2(F.toPay.reduce((s, x) => s + x.amount, 0))} to pay</span></div>
        <div style={css('display:grid;grid-template-columns:104px minmax(0,1.2fr) 118px minmax(0,1.3fr) 118px 90px 150px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Form no.</span><span>Pay to · for</span><span>How</span><span>Payment details</span><span>Paid from</span><span style={css('text-align:right')}>Amount</span><span></span></div>
        {payRows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing approved and waiting to be paid.</div>}
        {payRows.map(({ p, done }) => (
          <div key={p.key} style={css(`display:grid;grid-template-columns:104px minmax(0,1.2fr) 118px minmax(0,1.3fr) 118px 90px 150px;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5;opacity:${done ? 0.6 : 1}`)}>
            <span style={css('font-size:11px;font-weight:700;color:#16223A;overflow:hidden;text-overflow:ellipsis')}>{p.no}</span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{p.payee}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{p.what}</span></span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${MC[p.method][0]};color:${MC[p.method][1]}`)}>{p.method}</span>
            <span style={css('font-size:10.5px;line-height:1.4;color:#16223A')}>{p.details}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${FC[p.from][0]};color:${FC[p.from][1]}`)}>{p.from === 'Client account' ? 'Client A/C' : p.from}</span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm2(p.amount)}</span>
            {!done && <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); F.markPaid(p, e.dataTransfer.files && e.dataTransfer.files[0]); }} title="Drag the receipt here or click to choose" style={css('justify-self:end;border:1.5px dashed #2F6F4E;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#2F6F4E;cursor:pointer;white-space:nowrap')}>{p.method === 'Online portal' ? 'Paid · drop portal receipt' : p.method === 'Cheque' ? 'Issued · drop cheque copy' : 'Paid · drop bank slip'}<input type="file" accept="image/*,.pdf" onChange={(e) => F.markPaid(p, e.target.files && e.target.files[0])} style={css('display:none')} /></label>}
            {done && <span style={css('justify-self:end;font-size:10.5px;font-weight:700;color:#2F6F4E;text-align:right')}>Paid ✓ · {done}</span>}
          </div>
        ))}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478')}>Drop or choose the bank / portal receipt to mark it paid. It posts to the cash book of the account it was paid from (email to the staff member isn't connected yet). Online portal payments (e-Filing, e-Tanah, STAMPS) need no bank details.</div>
      </div>
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
    </div>
  );
};
