import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';

export const PayrollTab = ({ F }: { F: FinanceCtrl }) => {
  const year = F.now.getFullYear();
  const STEPS = ['Draft', 'Checked', 'Approved', 'Paid'];
  const step = F.payStep;
  const allPaid = F.periodSlips.length > 0 && F.periodSlips.every((p) => p.status === 'Paid');
  const shownStep = allPaid ? 4 : step;
  const payBtn = ['Mark as checked', 'Approve payroll', 'Mark as paid & release payslips', 'Payslips paid ✓', 'Payslips paid ✓'][shownStep];

  const rows = F.staff.map((u) => { const p = F.slipOf(u.id); return { u, p, c: F.slipCalc(p) }; });
  const selId = F.slipUser && rows.some((r) => r.u.id === F.slipUser) ? F.slipUser : rows[0]?.u.id;
  const sel = rows.find((r) => r.u.id === selId);
  const tot = rows.reduce((a, r) => (r.c ? { net: a.net + r.c.net, er: a.er + r.c.er, gross: a.gross + r.c.gross } : a), { net: 0, er: 0, gross: 0 });

  const openSlip = (userId: string) => {
    if (!F.canPrepare) { F.toastMsg('Payslips are keyed in by Accounts.'); return; }
    const p = F.slipOf(userId); const u = F.staffUser(userId);
    if (p && p.status !== 'Draft') { F.toastMsg('Only Draft payslips can be changed.'); return; }
    const suggestedRef = u ? F.refFeeFor(u) : 0;
    F.openForm('payslip', { userId, name: u?.name, basic: p ? String(p.basic) : '', allow: p ? String((p.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0)) : '', ref: p ? String(p.referralFee) : suggestedRef ? String(Math.round(suggestedRef * 100) / 100) : '', refNote: p?.referralNote || (suggestedRef ? 'see Approvals · ' + F.monthName + ' referral fees' : ''), ps: p ? String(p.profitShare) : '', psNote: p?.profitShareNote || '', bonus: p ? String(p.bonus) : '', bonusNote: p?.bonusNote || '', epf: p ? String(p.epfEmployee) : '', epfEr: p ? String(p.epfEmployer) : '', socso: p ? String(p.socsoEis) : '', pcb: p ? String(p.pcb) : '', zakat: p ? String(p.zakat) : '', otherDed: p ? String((p.otherDeductions || []).reduce((s, a) => s + Number(a.amount || 0), 0) || '') : '', otherDedName: p?.otherDeductions?.[0]?.name || '' });
  };

  const earn: [string, string, number][] = sel?.p ? [['Basic salary', '', Number(sel.p.basic || 0)], ...(sel.p.allowances || []).map((a) => [a.name, '', Number(a.amount || 0)] as [string, string, number]), ...(sel.p.referralFee ? [['Referral fees', sel.p.referralNote || 'see Approvals · referral fees', Number(sel.p.referralFee)] as [string, string, number]] : []), ...(sel.p.profitShare ? [['Profit sharing', sel.p.profitShareNote || '', Number(sel.p.profitShare)] as [string, string, number]] : []), ...(sel.p.bonus ? [['Bonus', sel.p.bonusNote || '', Number(sel.p.bonus)] as [string, string, number]] : [])] : [];
  const ded: [string, number][] = sel?.p ? ([['EPF (employee)', Number(sel.p.epfEmployee || 0)], ['SOCSO + EIS', Number(sel.p.socsoEis || 0)], ['PCB (income tax)', Number(sel.p.pcb || 0)], ['Zakat (via employer)', Number(sel.p.zakat || 0)], ...(sel.p.otherDeductions || []).map((d) => [d.name, Number(d.amount || 0)] as [string, number])] as [string, number][]).filter((d) => d[1]) : [];
  const slipPdf = () => { if (!sel?.p || !sel.c) { F.toastMsg('No payslip keyed in for this person yet.'); return; } SD.pdf('Payslip ' + sel.u.name, SD.tableHtml('Payslip · ' + sel.u.name, `${F.monthName} ${year}`, ['Item', 'Amount'], [...earn.map(([l, , a]) => [l, rm2(a)]), ...ded.map(([l, a]) => [l, '- ' + rm2(a)]), ['Net pay', rm2(sel.c.net)]])); };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;align-items:center;gap:12px;border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:12px 16px')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px;color:#16223A')}>{F.monthName} {year} payroll</strong><span style={css('font-size:10.5px;color:#5B6478')}>pay date {F.lastDayLabel} · {F.staff.length} staff</span>
        <div style={css('display:flex;align-items:center;gap:6px;margin-left:16px')}>{STEPS.map((label, i) => { const bg = i < shownStep ? '#E6EFE9' : i === shownStep ? '#16223A' : '#F0F2F5'; const fg = i < shownStep ? '#2F6F4E' : i === shownStep ? '#fff' : '#5B6478'; return <span key={label} style={css(`display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:12px;background:${bg};color:${fg}`)}>{i < shownStep ? '✓' : String(i + 1)} {label}</span>; })}</div>
        <button type="button" onClick={F.payNext} style={css('margin-left:auto;border:0;border-radius:6px;padding:7px 14px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{payBtn}</button>
      </div>
      <section style={css('display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start')}>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:grid;grid-template-columns:minmax(120px,1.4fr) 66px 56px 62px 56px 70px 58px 58px 48px 74px;gap:6px;padding:8px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Staff</span><span style={css('text-align:right')}>Basic</span><span style={css('text-align:right')}>Allow.</span><span style={css('text-align:right')}>Referral</span><span style={css('text-align:right')}>Profit sh. + bonus</span><span style={css('text-align:right')}>Gross</span><span style={css('text-align:right')}>EPF</span><span style={css('text-align:right')}>SOCSO +EIS</span><span style={css('text-align:right')}>PCB</span><span style={css('text-align:right')}>Net pay</span></div>
          {rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No active staff users (partners take drawings, not salary).</div>}
          {rows.map(({ u, p, c }) => { const on = u.id === selId; const psb = p ? Number(p.profitShare || 0) + Number(p.bonus || 0) : 0; return (
            <button key={u.id} type="button" onClick={() => (on ? openSlip(u.id) : F.setSlipUser(u.id))} title={on ? 'Click again to key in / edit this payslip' : ''} style={css(`width:100%;display:grid;grid-template-columns:minmax(120px,1.4fr) 66px 56px 62px 56px 70px 58px 58px 48px 74px;gap:6px;align-items:center;padding:8px 14px;border:0;border-bottom:1px solid #F0F2F5;cursor:pointer;font-family:inherit;text-align:left;background:${on ? '#F6F8FA' : '#fff'};border-left:3px solid ${on ? '#16223A' : 'transparent'};opacity:${p ? 1 : 0.7}`)}>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{u.name}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p ? (u.staffProfile?.designation || u.role) + ' · ' + p.status : 'no payslip yet'}</span></span>
              <span style={css('text-align:right;font-size:11px;color:#16223A')}>{p ? rm(p.basic) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;color:#16223A')}>{c ? rm(c.allow) : '—'}</span>
              <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${p?.referralFee ? '#8C2F4C' : '#94A3B8'}`)}>{p?.referralFee ? rm(p.referralFee) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;color:#16223A')}>{psb ? rm(psb) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;font-weight:700;color:#16223A')}>{c ? rm(c.gross) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;color:#B23A2E')}>{p ? rm(p.epfEmployee) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;color:#B23A2E')}>{p ? rm(p.socsoEis) : '—'}</span>
              <span style={css('text-align:right;font-size:11px;color:#B23A2E')}>{p?.pcb ? rm(p.pcb) : '—'}</span>
              <span style={css('text-align:right;font-size:12px;font-weight:800;color:#2F6F4E')}>{c ? rm(c.net) : '—'}</span>
            </button>
          ); })}
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 14px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>Total net pay <strong>{rm(tot.net)}</strong> · employer EPF <strong>{rm(tot.er)}</strong></span><span style={css('font-weight:700')}>Cost to firm {rm(tot.gross + tot.er)}</span></div>
          <div style={css('padding:8px 14px;font-size:10px;line-height:1.5;color:#8A6534;border-top:1px solid #EEF1F5')}>EPF, SOCSO, EIS and PCB are keyed in per payslip from the official KWSP, PERKESO and LHDN tables — they are not calculated here. Click a selected row to key in or edit its payslip (Draft only).</div>
        </div>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;background:#16223A')}><strong style={css('font-size:12.5px;color:#fff')}>Payslip · {F.monthName} {year}</strong><button type="button" onClick={() => sel && openSlip(sel.u.id)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit')}>{sel?.p ? 'Edit' : 'Key in'}</button><button type="button" onClick={slipPdf} style={css('border:0;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#C9A86A;color:#16223A;cursor:pointer;font-family:inherit')}>PDF</button></div>
          <div style={css('padding:12px 14px;border-bottom:1px solid #EEF1F5')}><div style={css('font-size:13px;font-weight:700;color:#16223A')}>{sel ? sel.u.name : '—'}</div><div style={css('font-size:10.5px;color:#5B6478')}>{sel ? (sel.u.staffProfile?.designation || sel.u.role) : ''} · SH &amp; Co · pay date {F.lastDayLabel} {year}</div></div>
          {!sel?.p && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No payslip keyed in for {F.monthName} yet.</div>}
          {sel?.p && <>
            <div style={css('padding:6px 14px 2px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>Earnings</div>
            {earn.map(([label, note, a], i) => <div key={label + i} style={css('display:flex;padding:4px 14px;font-size:11.5px;color:#16223A')}><span>{label}<span style={css('display:block;font-size:10px;color:#5B6478')}>{note}</span></span><strong style={css('margin-left:auto')}>{rm2(a)}</strong></div>)}
            <div style={css('padding:8px 14px 2px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478;border-top:1px solid #F0F2F5;margin-top:6px')}>Deductions</div>
            {ded.map(([label, a], i) => <div key={label + i} style={css('display:flex;padding:4px 14px;font-size:11.5px;color:#16223A')}><span>{label}</span><strong style={css('margin-left:auto;color:#B23A2E')}>- {rm2(a)}</strong></div>)}
            <div style={css('display:flex;align-items:center;margin-top:8px;padding:11px 14px;background:#EEF5F0;font-size:12.5px;color:#16223A')}><span style={css('font-weight:700')}>Net pay</span><strong style={css('margin-left:auto;font-family:ui-serif, Georgia, serif;font-size:18px;color:#2F6F4E')}>{rm2(sel.c!.net)}</strong></div>
            <div style={css('padding:8px 14px 12px;font-size:10px;line-height:1.5;color:#5B6478')}>Employer pays EPF {rm(sel.c!.er)} on top (employer SOCSO + EIS isn't recorded on the payslip). Payslip is shown in Staff Portal; emailing it isn't connected yet.</div>
          </>}
        </div>
      </section>
    </div>
  );
};
