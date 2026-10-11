import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, MON, MONTHS, num0, periodKey, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';
import { isPartnerType, PARTNER_PAYS, STAFF_PAYS, type FsPerson } from '../../../lib/feeSharing';
import { payslipHtml } from './payslipHtml';

const chip = (on: boolean) => `border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`;
const CARD = 'overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff';
const H = 'font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A';
const first = (n: string) => String(n || '').split(/\s+/)[0];

/** Payroll — design: Staff payslips · Partner pay · Fee sharing. */
export const PayrollTab = ({ F }: { F: FinanceCtrl }) => {
  const subs: ['sl' | 'pp' | 'fs', string][] = [['sl', 'Staff payslips'], ['pp', 'Partner pay'], ['fs', 'Fee sharing']];
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;align-items:center;gap:4px;flex-wrap:wrap')}>{subs.map(([k, label]) => <button key={k} type="button" onClick={() => F.setPaySub(k)} style={css(`border-radius:16px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;${chip(F.paySub === k)}`)}>{label}</button>)}</div>
      {F.paySub === 'sl' && <StaffPayslips F={F} />}
      {F.paySub === 'pp' && <PartnerPay F={F} />}
      {F.paySub === 'fs' && <FeeSharing F={F} />}
    </div>
  );
};

/* ------------------------------ Staff payslips ------------------------------ */
const StaffPayslips = ({ F }: { F: FinanceCtrl }) => {
  const year = F.now.getFullYear();
  const STEPS = ['Draft', 'Checked', 'Approved', 'Paid'];
  const allPaid = F.periodSlips.length > 0 && F.periodSlips.every((p) => p.status === 'Paid');
  const step = allPaid ? 4 : F.payStep;
  const prule = F.ruleFor('payroll');
  const payBtn = ['Mark as checked', 'Approve payroll · ' + prule.label, 'Mark as paid & release payslips', 'Payslips paid ✓', 'Payslips paid ✓'][step];
  const lock = step > 0;
  const rows = F.staff.map((u) => { const p = F.slipOf(u.id); return { u, p, c: F.slipCalc(p) }; });
  const tot = rows.reduce((a, r) => (r.c ? { net: a.net + r.c.net, er: a.er + r.c.er, gross: a.gross + r.c.gross } : a), { net: 0, er: 0, gross: 0 });
  const partners = F.app.users.filter((u) => u.status !== 'Inactive' && u.role === 'Partner').map((u) => first(u.name));
  const partnersNote = partners.length ? (partners.length === 1 ? partners[0] + ' is a partner' : partners.slice(0, -1).join(', ') + ' & ' + partners[partners.length - 1] + ' are partners') + ': paid by share statement, not payslip' : '';
  const [draft, setDraft] = useState<Record<string, string>>({});
  const k = (id: string, f: string) => id + ':' + f;
  const val = (id: string, f: string, cur: number) => (draft[k(id, f)] ?? (cur ? String(Math.round(cur * 100) / 100) : ''));
  const commit = (id: string, f: 'allow' | 'bonus' | 'pcb' | 'zakat' | 'oth') => {
    const v = draft[k(id, f)]; if (v == null) return;
    if (!F.canPrepare) { F.toastMsg('Payslips are keyed in by Accounts.'); return; }
    F.saveSlipPatch(id, { [f]: num0(v) });
    setDraft((d) => { const n = { ...d }; delete n[k(id, f)]; return n; });
  };
  /* bonus for everyone */
  const [bulk, setBulk] = useState({ mode: 'rm', amt: '', who: 'All staff' });
  const roles = [...new Set(rows.map((r) => r.u.staffProfile?.designation || r.u.role))];
  const tgt = rows.filter((r) => (r.p ? r.p.basic : r.u.staffProfile?.pay?.basicSalary) && (bulk.who === 'All staff' || (r.u.staffProfile?.designation || r.u.role) === bulk.who));
  const basicOf = (r: (typeof rows)[number]) => Number(r.p ? r.p.basic : r.u.staffProfile?.pay?.basicSalary || 0);
  const amt = num0(bulk.amt);
  const bon = (r: (typeof rows)[number]) => Math.round((bulk.mode === 'rm' ? amt : bulk.mode === 'pct' ? basicOf(r) * amt / 100 : basicOf(r) * amt) * 100) / 100;
  const btot = tgt.reduce((s, r) => s + bon(r), 0);
  const applyBonus = (clear: boolean) => { if (!F.canPrepare) { F.toastMsg('Payslips are keyed in by Accounts.'); return; } if (!clear && !amt) { F.toastMsg('Type the bonus amount first'); return; } tgt.forEach((r) => F.saveSlipPatch(r.u.id, { bonus: clear ? 0 : bon(r) })); F.toastMsg(clear ? 'Bonuses cleared for ' + tgt.length + ' staff' : 'Bonus applied to ' + tgt.length + ' staff · ' + rm(btot)); };
  const openForm = (userId: string) => {
    if (!F.canPrepare) { F.toastMsg('Payslips are keyed in by Accounts.'); return; }
    const p = F.slipOf(userId); const u = F.staffUser(userId);
    if (p && p.status !== 'Draft') { F.toastMsg('Only Draft payslips can be changed.'); return; }
    const suggestedRef = u ? F.refFeeFor(u) : 0; const hr = u?.staffProfile?.pay;
    const hrAllow = (hr?.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
    F.openForm('payslip', { userId, name: u?.name, basic: p ? String(p.basic) : hr?.basicSalary ? String(hr.basicSalary) : '', allow: p ? String((p.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0)) : hrAllow ? String(hrAllow) : '', ref: p ? String(p.referralFee) : suggestedRef ? String(Math.round(suggestedRef * 100) / 100) : '', refNote: p?.referralNote || (suggestedRef ? 'see Approvals · ' + F.monthName + ' referral fees' : ''), ps: p ? String(p.profitShare) : '', psNote: p?.profitShareNote || '', bonus: p ? String(p.bonus || '') : '', bonusNote: p?.bonusNote || '', pcb: p ? String(p.pcb) : '', zakat: p ? String(p.zakat) : hr?.zakatMonthly ? String(hr.zakatMonthly) : '', otherDed: p ? String((p.otherDeductions || []).reduce((s, a) => s + Number(a.amount || 0), 0) || '') : '', otherDedName: p?.otherDeductions?.[0]?.name || '', epf: p ? String(p.epfEmployee) : '', epfEr: p ? String(p.epfEmployer) : '', socso: p ? String(p.socsoEis) : '', socsoEr: p?.socsoEisEmployer != null ? String(p.socsoEisEmployer) : '', stOverride: !!(p?.statutory && p.statutory.auto === false), stReason: p?.statutory?.overrideReason || '' });
  };
  const viewSlip = (r: (typeof rows)[number]) => {
    if (!r.p || !r.c) { F.toastMsg('No payslip keyed in for ' + r.u.name + ' yet.'); return; }
    const html = payslipHtml(r.u, r.p, `${F.monthName} ${year}`, F.lastDayLabel + ' ' + year, r.c);
    F.setPaper({ title: `Payslip · ${r.u.name} · ${F.monthName} ${year}`, sub: 'exactly as printed / PDF · same as Staff Portal', html, pdf: () => SD.pdf(`Payslip ${r.u.name} ${F.monShort} ${year}`, html) });
  };
  const IN = (lockIt: boolean, red: boolean) => `width:100%;min-width:0;border:1px solid ${lockIt ? '#EEF1F5' : '#DDE3EB'};border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;color:${red ? '#B23A2E' : '#16223A'};background:${lockIt ? '#F6F8FA' : '#fff'};text-align:right;outline:none;box-sizing:border-box`;
  const G = 'display:grid;grid-template-columns:minmax(130px,1.4fr) 64px 64px 62px 70px 64px 72px 58px 62px 60px 58px 64px 76px 60px;gap:6px;';
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;align-items:center;gap:12px;border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:12px 16px;flex-wrap:wrap')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px;color:#16223A')}>{F.monthName} {year} payroll</strong><span style={css('font-size:10.5px;color:#5B6478')}>pay date {F.lastDayLabel} · {F.staff.length} staff{partnersNote ? ' · ' + partnersNote : ''}</span>
        <div style={css('display:flex;align-items:center;gap:6px;margin-left:16px')}>{STEPS.map((label, i) => { const bg = i < step ? '#E6EFE9' : i === step ? '#16223A' : '#F0F2F5'; const fg = i < step ? '#2F6F4E' : i === step ? '#fff' : '#5B6478'; return <span key={label} style={css(`display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:12px;background:${bg};color:${fg}`)}>{i < step ? '✓' : String(i + 1)} {label}</span>; })}</div>
        <button type="button" onClick={() => F.payNext()} style={css('margin-left:auto;border:0;border-radius:6px;padding:7px 14px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>{payBtn}</button>
      </div>
      {!lock && (
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:10px 16px')}>
          <strong style={css('font-size:12px;color:#16223A')}>Bonus for everyone</strong>
          <select value={bulk.mode} onChange={(e) => setBulk({ ...bulk, mode: e.target.value })} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer')}><option value="rm">Same amount (RM)</option><option value="pct">% of basic salary</option><option value="mo">Months of basic</option></select>
          <input value={bulk.amt} onChange={(e) => setBulk({ ...bulk, amt: e.target.value.replace(/[^0-9.]/g, '') })} placeholder={bulk.mode === 'rm' ? 'RM' : bulk.mode === 'pct' ? '%' : 'months'} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;width:90px;text-align:right')} />
          <span style={css('font-size:11px;color:#5B6478')}>for</span>
          <select value={bulk.who} onChange={(e) => setBulk({ ...bulk, who: e.target.value })} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer')}>{['All staff', ...roles].map((o) => <option key={o}>{o}</option>)}</select>
          <span style={css('font-size:10.5px;color:#5B6478')}>{tgt.length} staff{amt ? ' · total ' + rm(btot) : ''} · only staff with a basic salary</span>
          <div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={() => applyBonus(true)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit')}>Clear bonuses</button><button type="button" onClick={() => applyBonus(false)} style={css('border:0;border-radius:6px;padding:6px 14px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Apply bonus</button></div>
        </div>
      )}
      <div style={css(CARD)}>
        <div style={css(G + 'padding:8px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Staff</span><span style={css('text-align:right')}>Basic</span><span style={css('text-align:right')}>Allow.</span><span style={css('text-align:right')}>Referral</span><span style={css('text-align:right')}>Fee sharing</span><span style={css('text-align:right')}>Bonus</span><span style={css('text-align:right')}>Gross</span><span style={css('text-align:right')}>EPF</span><span style={css('text-align:right')}>SOCSO + EIS</span><span style={css('text-align:right')}>PCB</span><span style={css('text-align:right')}>Zakat</span><span style={css('text-align:right')}>Other ded.</span><span style={css('text-align:right')}>Net pay</span><span></span></div>
        {rows.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No active staff users (partners are paid by share statement).</div>}
        {rows.map((r) => { const { u, p, c } = r; const l = lock || (!!p && p.status !== 'Draft'); const oth = (p?.otherDeductions || []).reduce((s, a) => s + Number(a.amount || 0), 0); const field = (f: 'allow' | 'bonus' | 'pcb' | 'zakat' | 'oth', cur: number, red = false) => <input value={val(u.id, f, cur)} readOnly={l} onChange={(e) => setDraft({ ...draft, [k(u.id, f)]: e.target.value.replace(/[^0-9.]/g, '') })} onBlur={() => commit(u.id, f)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="0" style={css(IN(l, red))} />; return (
          <div key={u.id} style={css(G + 'align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
            <button type="button" onClick={() => openForm(u.id)} title="Key in / edit this payslip (Draft only)" style={css('min-width:0;border:0;background:none;padding:0;text-align:left;cursor:pointer;font-family:inherit')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{u.name}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{(u.staffProfile?.designation || u.role) + (p ? '' : ' · no payslip yet')}</span></button>
            <span style={css('text-align:right;font-size:11px;color:#16223A')}>{rm(p ? p.basic : Number(u.staffProfile?.pay?.basicSalary || 0))}</span>
            {field('allow', c ? c.allow : (u.staffProfile?.pay?.allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0))}
            <span style={css(`text-align:right;font-size:11px;font-weight:700;color:${p?.referralFee ? '#8C2F4C' : '#94A3B8'}`)}>{p?.referralFee ? rm(p.referralFee) : '—'}</span>
            <span style={css('text-align:right;font-size:11px;color:#16223A')}>{p?.profitShare ? rm(p.profitShare) : '—'}</span>
            {field('bonus', Number(p?.bonus || 0))}
            <span style={css('text-align:right;font-size:11px;font-weight:700;color:#16223A')}>{c ? rm(c.gross) : '—'}</span>
            <span style={css('text-align:right;font-size:11px;color:#B23A2E')}>{p ? rm(p.epfEmployee) : '—'}</span>
            <span style={css('text-align:right;font-size:11px;color:#B23A2E')}>{p ? rm(p.socsoEis) : '—'}</span>
            {field('pcb', Number(p?.pcb || 0), true)}
            {field('zakat', Number(p?.zakat || 0), true)}
            {field('oth', oth, true)}
            <span style={css('text-align:right;font-size:12px;font-weight:800;color:#2F6F4E')}>{c ? rm(c.net) : '—'}</span>
            <button type="button" onClick={() => viewSlip(r)} style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Payslip</button>
          </div>
        ); })}
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 14px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>Total net pay <strong>{rm(tot.net)}</strong> · employer EPF + SOCSO + EIS <strong>{rm(tot.er)}</strong> · payslips are shown in Staff Portal · {lock ? 'figures locked after checking' : 'type allowance, bonus, PCB, zakat and other deductions while in Draft'}</span><span style={css('font-weight:700')}>Cost to firm {rm(tot.gross + tot.er)}</span></div>
        <div style={css('padding:8px 14px;font-size:10px;line-height:1.5;color:#8A6534;border-top:1px solid #EEF1F5')}>EPF and SOCSO + EIS are worked out from the official KWSP and PERKESO tables. Click a name to key in the full payslip (basic pay, notes, or an override with a reason).</div>
      </div>
    </div>
  );
};

/* ------------------------------ Partner pay ------------------------------ */
const PartnerPay = ({ F }: { F: FinanceCtrl }) => {
  const per = F.period; const r = F.feeShareFor(per); const approved = F.fsApproved(per);
  const people = r.people.filter((p) => isPartnerType(p.t));
  const FS = F.settings.feeSharing || {};
  const setD = (p: FsPerson, key: string, v: string) => F.saveFs({ people: { ...(FS.people || {}), [p.id]: { ...((FS.people || {})[p.id] || {}), ded: { ...(p.ded || {}), [key]: num0(v) } } } });
  const stmt = (p: FsPerson) => {
    const q = r.pp[p.id]; if (!q) return;
    const t = r.tot[p.id];
    const rows: (string | number)[][] = [['PAID THIS MONTH', '', ''], ...(q.base ? [[q.baseLabel, '', rm2(q.base)]] : []), ...(q.mode === 'Monthly drawing + profit share' ? [[q.topLabel, 'fee sharing ' + rm2(q.feeOnly) + ' + firm profit ' + rm2(q.fsh) + ' less drawing', rm2(q.top)]] : [['Fee sharing', t.files.length + (t.files.length === 1 ? ' file' : ' files') + ' · fees collected', rm2(q.feeOnly)], ['Share of firm profit', q.pct + '% of ' + rm2(r.dist) + ' after office costs', rm2(q.fsh)]]), ['TOTAL PAID', '', rm2(q.gross)], ...q.ded.filter((d) => d[1]).map((d) => ['Less: ' + d[0], '', rm2(d[1])]), ['NET PAID TO YOU', '', rm2(q.net)], ...(q.carried ? [['Drawing taken ahead of share (carried in your current account)', '', rm2(Math.abs(q.carried))]] : []), ...t.files.map((f) => [f[0] + ' · ' + f[1], f[2] + ' · collected ' + rm2(f[3]), rm2(f[4])])];
    const html = SD.tableHtml('Partner Pay Statement · ' + p.name, `${F.monthName} ${F.now.getFullYear()} · paid as: ${q.mode}. No EPF, SOCSO, EIS or PCB is compulsory for partners. Declare in your Form B; the firm reports it in Form P.`, ['Item', 'Detail', 'MYR'], rows);
    F.setPaper({ title: 'Partner Pay Statement · ' + p.name, sub: `${F.monthName} ${F.now.getFullYear()}`, html, pdf: () => SD.pdf('Partner pay statement - ' + p.name, html), xls: () => { SD.csv('Partner pay statement - ' + p.name, [['Item', 'Detail', 'MYR'], ...rows]); F.toastMsg('Excel downloaded'); } });
  };
  const IN = 'width:100%;border:1px solid #DDE3EB;border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit;color:#16223A;text-align:right;outline:none;box-sizing:border-box';
  const G = 'display:grid;grid-template-columns:minmax(0,1.3fr) 110px 100px 110px 74px 74px 74px 74px 110px 96px;gap:8px;';
  return (
    <div style={css(CARD)}>
      <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Partner pay · {F.monthName} {F.now.getFullYear()}</strong><span style={css(`font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:10px;background:${approved ? '#E6EFE9' : '#FBF2E9'};color:${approved ? '#2F6F4E' : '#8A6534'}`)}>{approved ? 'Approved · paid from partner current accounts' : 'Draft · approve in Fee sharing first'}</span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>change how each partner is paid in Fee sharing › People &amp; pay</span><button type="button" onClick={() => F.setPaySub('fs')} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Open fee sharing</button></div>
      <div style={css(G + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Partner · paid by</span><span style={css('text-align:right')}>Salary / drawing</span><span style={css('text-align:right')}>Profit share</span><span style={css('text-align:right')}>Total paid</span><span style={css('text-align:right')}>i-Saraan</span><span style={css('text-align:right')}>CP500</span><span style={css('text-align:right')}>Zakat</span><span style={css('text-align:right')}>Advance</span><span style={css('text-align:right')}>Net paid</span><span></span></div>
      {!people.length && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No partners set up.</div>}
      {people.map((p) => { const q = r.pp[p.id]; if (!q) return null; return (
        <div key={p.id} style={css(G + 'align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5')}>
          <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{p.name}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{q.mode}</span>{!!q.carried && <span style={css('display:block;font-size:10px;font-weight:700;color:#8A6534')}>{rm2(Math.abs(q.carried))} drawn ahead of share</span>}</span>
          <span style={css('text-align:right;font-size:11.5px;color:#16223A')}>{q.base ? rm2(q.base) : '—'}</span>
          <span style={css('text-align:right;font-size:11.5px;color:#2F5680;display:flex;flex-direction:column')}><span>{rm2(q.top)}</span><span style={css('font-size:9.5px;color:#5B6478')}>fee {rm2(q.feeOnly)} · firm {rm2(q.fsh)}</span></span>
          <strong style={css('text-align:right;font-size:11.5px;color:#16223A')}>{rm2(q.gross)}</strong>
          {(['epf', 'cp500', 'zakat', 'adv'] as const).map((key) => <input key={key} defaultValue={p.ded[key] ? String(p.ded[key]) : ''} onBlur={(e) => { if (num0(e.target.value) !== Number(p.ded[key] || 0)) setD(p, key, e.target.value); }} placeholder="0" style={css(IN)} />)}
          <strong style={css('text-align:right;font-size:12.5px;color:#2F6F4E')}>{rm2(q.net)}</strong>
          <button type="button" onClick={() => stmt(p)} style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Statement</button>
        </div>
      ); })}
      <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#F6F8FA;font-size:11px;color:#16223A')}><span>Total net to partners <strong>{rm2(Object.values(r.pp).reduce((t, q) => t + q.net, 0))}</strong></span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>No EPF, SOCSO or PCB is compulsory for partners. i-Saraan, CP500, zakat and advances are optional deductions you type in.</span></div>
    </div>
  );
};

/* ------------------------------ Fee sharing ------------------------------ */
const FeeSharing = ({ F }: { F: FinanceCtrl }) => {
  const [tab, setTab] = useState<'m' | 'r' | 'p'>('m');
  const [monIdx, setMonIdx] = useState(0);
  const mons = Array.from({ length: 5 }, (_, i) => new Date(F.now.getFullYear(), F.now.getMonth() - i, 1));
  const m = mons[monIdx]; const per = periodKey(m); const cur = monIdx === 0;
  const r = F.feeShareFor(per);
  const FS = F.settings.feeSharing || {};
  const rules = { own: 70, intro: 20, hand: 50, ...(FS.rules || {}) };
  const rule = F.ruleFor('feeShare'); const sg = F.signoffs('feeShare:' + per); const approved = rule.done(sg);
  const [wq, setWq] = useState(''); const [rf, setRf] = useState<'all' | 'p' | 'a' | 's'>('all'); const [fq, setFq] = useState(''); const [pq, setPq] = useState('');
  const [open, setOpen] = useState<{ id: string; kind: 'i' | 'h' } | null>(null); const [q, setQ] = useState('');
  const nm = (id: string) => r.people.find((p) => p.id === id)?.name || id;
  const coll = r.total, firmK = r.firm;
  const sign = (code: string) => {
    if (code !== F.myCode) { F.toastMsg((rule.people.find((p) => p.code === code)?.name || code) + ' approves this in their own login.'); return; }
    if (!sg[code]) { if (!r.allOk) { F.toastMsg('Handler % on a file must add up to 100'); return; } if (!r.splitOk) { F.toastMsg("Partners' split must add up to 100%"); return; } }
    F.signOff('feeShare', per, () => { const n = F.applyFeeShareToSlips(per); F.toastMsg('Approved · commission added to ' + n + ' Draft payslip' + (n === 1 ? '' : 's') + ', statements ready'); });
  };
  const signBtns = () => <>{cur && <><span style={css('font-size:10.5px;color:#5B6478')}>{approved ? 'approved ·' : rule.count(sg) ? rule.count(sg) + ' of ' + rule.need + ' approvals ·' : rule.rule + ' ·'}</span>{rule.people.map((p) => { const on = !!sg[p.code]; return <button key={p.code} type="button" title={on ? p.name + ' approved · click to undo' : p.name + ' checks the files below, then approves'} onClick={() => sign(p.code)} style={css(`border:1px solid ${on ? '#B9D7C5' : '#16223A'};border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:${on ? '#E6EFE9' : '#16223A'};color:${on ? '#2F6F4E' : '#fff'};cursor:pointer;font-family:inherit`)}>{on ? p.code + ' ✓ approved' : 'Approve as ' + p.code}</button>; })}</>}{!cur && <span style={css('font-size:10.5px;color:#5B6478')}>{approved ? 'approved by ' + Object.keys(sg).join(' & ') : 'not approved'}</span>}</>;
  const roleOk = (p: FsPerson) => rf === 'all' || (rf === 'p' ? isPartnerType(p.t) : rf === 'a' ? p.t === 'Associate' : p.t === 'Staff');
  const PL = r.people.filter((p) => r.tot[p.id]?.amt || r.pp[p.id]?.fsh);
  const list = PL.filter((p) => roleOk(p) && (!wq || p.name.toLowerCase().includes(wq.toLowerCase()))).map((p) => { const eq = isPartnerType(p.t); const a = eq && r.pp[p.id] ? r.pp[p.id].fee : r.tot[p.id].amt; return { p, eq, a, n: r.tot[p.id].files.length, ref: r.tot[p.id].ref }; }).sort((x, y) => y.a - x.a);
  const fMatch = (row: (typeof r.rows)[number]) => !fq || [row.client, row.ref, row.intro ? nm(row.intro) : 'firm', ...row.hands.map(nm)].join(' ').toLowerCase().includes(fq.toLowerCase());
  const viewPerson = (p: FsPerson, eq: boolean) => { const t = r.tot[p.id]; const rows = t.files.map((f) => [f[0], f[1], f[2], rm2(f[3]), rm2(f[4])]); const title = eq ? "Partner's Share Statement" : 'Fee Sharing Commission Statement'; const sub = `${MONTHS[m.getMonth()]} ${m.getFullYear()} · ${p.name} (${p.t}) · ` + (eq ? "Partner's share of profit. No EPF, SOCSO, EIS or PCB. Declare in your Form B; the firm reports it in Form P." : 'Paid with the payslip as commission. EPF, SOCSO, EIS and PCB apply.'); const html = SD.tableHtml(title, sub, ['File', 'Client', 'Role', 'Fees collected MYR', 'Share MYR'], [...rows, ['TOTAL', '', '', '', rm2(t.amt)]]); F.setPaper({ title: title + ' · ' + p.name, sub: `${MONTHS[m.getMonth()]} ${m.getFullYear()}`, html, pdf: () => SD.pdf(title + ' - ' + p.name, html), xls: () => { SD.csv(title + ' - ' + p.name, [['File', 'Client', 'Role', 'Fees collected MYR', 'Share MYR'], ...rows]); F.toastMsg('Excel downloaded'); } }); };
  const editable = cur && !approved;
  const setFile = (id: string, p: Record<string, unknown>) => (editable ? F.setFsFile(per, id, p) : F.toastMsg(approved ? 'This month is approved and locked.' : 'Past months are locked.'));
  const numIn = 'border:1px solid #DDE3EB;border-radius:5px;padding:2px 4px;font-size:10.5px;font-family:inherit;text-align:right;outline:none';
  const handlerPool = r.people.filter((p) => p.t !== 'Staff');
  const pplRows = r.people.filter((p) => !pq || p.name.toLowerCase().includes(pq.toLowerCase()) || p.t.toLowerCase().includes(pq.toLowerCase()));
  const setPerson = (p: FsPerson, patch: Record<string, unknown>) => F.saveFs({ people: { ...(FS.people || {}), [p.id]: { ...((FS.people || {})[p.id] || {}), ...patch } } });
  const fsMonths = Array.from({ length: 9 }, (_, i) => { const d = new Date(F.now.getFullYear(), F.now.getMonth() + 1 + i, 1); return MON[d.getMonth()] + ' ' + d.getFullYear(); });
  const GF = 'display:grid;grid-template-columns:minmax(0,1.3fr) 100px minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.4fr) 90px;gap:10px;';
  return (
    <div style={css('display:flex;flex-direction:column;gap:14px')}>
      <div style={css('display:flex;gap:4px;flex-wrap:wrap')}>{([['m', 'This month'], ['r', 'Rules'], ['p', 'People & pay']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} style={css(`border-radius:16px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;${chip(tab === k)}`)}>{l}</button>)}</div>
      {tab === 'm' && <div style={css('display:flex;flex-direction:column;gap:14px')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>Month</span><select value={String(monIdx)} onChange={(e) => setMonIdx(Number(e.target.value))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer')}>{mons.map((d, i) => { const ok = F.fsApproved(periodKey(d)); return <option key={i} value={String(i)}>{MONTHS[d.getMonth()]} {d.getFullYear()} · {ok ? 'approved' : 'draft'}</option>; })}</select><span style={css(`font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:10px;background:${approved ? '#E6EFE9' : '#FBF2E9'};color:${approved ? '#2F6F4E' : '#8A6534'}`)}>{approved ? 'Approved · locked for payroll' : cur ? 'Draft' : 'Not approved'}</span>{signBtns()}<span style={css('margin-left:auto;font-size:11px;color:#16223A')}>Collected <strong>{rm2(coll)}</strong> · paid out <strong>{rm2(coll - firmK)}</strong> · firm kept <strong>{rm2(firmK)}</strong></span></div>
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>What each person gets · {MONTHS[m.getMonth()]} {m.getFullYear()}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{list.length} of {PL.length} people · highest first</span>
            <div style={css('margin-left:auto;display:flex;gap:4px;flex-wrap:wrap')}>{([['all', 'All'], ['p', 'Partners'], ['a', 'Associates'], ['s', 'Staff']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setRf(k)} style={css(`border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;${chip(rf === k)}`)}>{l}</button>)}</div>
            <input value={wq} onChange={(e) => setWq(e.target.value)} placeholder="Search person…" style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;width:170px')} /></div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1.4fr) 90px 50px 110px 110px 120px minmax(0,1.3fr) 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Person</span><span>Role</span><span style={css('text-align:right')}>Files</span><span style={css('text-align:right')}>Referral</span><span style={css('text-align:right')}>Fee sharing</span><span style={css('text-align:right')}>Total</span><span>Paid via</span><span></span></div>
          <div style={css('max-height:420px;overflow:auto')}>{list.map(({ p, eq, a, n, ref }) => <div key={p.id} style={css('display:grid;grid-template-columns:minmax(0,1.4fr) 90px 50px 110px 110px 120px minmax(0,1.3fr) 110px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}><strong style={css('min-width:0;font-size:11.5px;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</strong><span style={css('font-size:11px;color:#5B6478')}>{p.t}</span><span style={css('text-align:right;font-size:11px;color:#16223A')}>{n}</span><span style={css('text-align:right;font-size:11px;color:#8C2F4C;font-weight:600')}>{ref ? rm2(ref) : '—'}</span><span style={css('text-align:right;font-size:11px;color:#16223A')}>{a - ref ? rm2(a - ref) : '—'}</span><span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm2(a)}</span><span style={css(`font-size:10.5px;font-weight:600;color:${eq ? '#2F5680' : '#2F6F4E'}`)}>{eq ? "Partner's share statement · no EPF / PCB" : 'Payslip commission · EPF, SOCSO & PCB'}</span><button type="button" onClick={() => viewPerson(p, eq)} style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>View statement</button></div>)}
            {!list.length && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>{PL.length ? 'No one matches.' : 'No professional fees collected in this month.'}</div>}</div>
        </div>
        <div style={css(CARD)}>
          <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Files with fees collected · {MONTHS[m.getMonth()]} {m.getFullYear()}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{r.rows.filter(fMatch).length} of {r.rows.length} files</span><input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Search file, client or lawyer…" style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;width:220px')} /></div>
          <div style={css(GF + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>File</span><span style={css('text-align:right')}>Collected</span><span>Brought in by · referral</span><span>Handled by</span><span>Shares</span><span style={css('text-align:right')}>Firm's share</span></div>
          <div style={css('max-height:560px;overflow:auto')}>{r.rows.filter(fMatch).map((row) => { const shares = Object.keys(row.sh).map((c) => first(nm(c)) + ' ' + rm2(row.sh[c])).join(' · ') || '—'; const ruleTxt = (row.custom ? 'custom · ' : '') + (row.hands.length === 1 && row.intro === row.hands[0] ? 'brought & handled ' + row.rf.own + '% · firm ' + (100 - row.rf.own) + '%' : (row.intro ? 'introducer ' + row.rf.intro + '% · ' : 'no introducer · ') + 'handlers ' + row.rf.hand + '% · firm ' + row.firmPct + '%'); const qq = q.trim().toLowerCase(); const iOpen = open?.id === row.id && open.kind === 'i'; const hOpen = open?.id === row.id && open.kind === 'h'; return (
            <div key={row.id} style={css(GF + 'align-items:start;padding:9px 14px;border-bottom:1px solid #F0F2F5')}>
              <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.client}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.ref}</span></span>
              <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm2(row.amount)}</span>
              {editable ? <div style={css('position:relative;min-width:0')}><button type="button" onClick={() => { setOpen(iOpen ? null : { id: row.id, kind: 'i' }); setQ(''); }} style={css('width:100%;display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer;text-align:left')}><span style={css('flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.intro ? nm(row.intro) : 'Firm / walk-in'}</span><span style={css('font-size:9px;color:#5B6478')}>▼</span></button>
                {iOpen && <div style={css('position:absolute;z-index:20;top:calc(100% + 4px);left:0;right:0;min-width:200px;display:flex;flex-direction:column;padding:6px;border:1px solid #DDE3EB;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(22,34,58,.14)')}><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={css('width:100%;box-sizing:border-box;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;margin-bottom:4px')} /><div style={css('max-height:220px;overflow:auto;display:flex;flex-direction:column')}>{[{ id: '', name: 'Firm / walk-in', t: '' }, ...r.people].filter((p) => !qq || p.name.toLowerCase().includes(qq)).map((p) => <button key={p.id || 'firm'} type="button" className="hover:bg-[#F6F8FA]" onClick={() => { setFile(row.id, { intro: p.id }); setOpen(null); }} style={css(`display:flex;align-items:center;gap:6px;border:0;border-radius:5px;padding:6px 8px;font-size:11px;font-family:inherit;color:#16223A;background:${(row.intro || '') === p.id ? '#E7EEF6' : '#fff'};cursor:pointer;text-align:left`)}><span style={css('flex:1')}>{p.name}</span><span style={css('font-size:9.5px;color:#5B6478')}>{p.t}</span></button>)}</div></div>}</div>
                : <span style={css('font-size:11px;color:#16223A')}>{row.intro ? nm(row.intro) : 'Firm / walk-in'}</span>}
              <div style={css('display:flex;flex-direction:column;gap:5px')}>
                {editable ? <div style={css('position:relative')}><button type="button" onClick={() => { setOpen(hOpen ? null : { id: row.id, kind: 'h' }); setQ(''); }} style={css('width:100%;display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer;text-align:left')}><span style={css('flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.hands.map((h) => first(nm(h))).join(', ') || 'no handler'}</span><span style={css('font-size:9px;color:#5B6478')}>▼</span></button>
                  {hOpen && <div style={css('position:absolute;z-index:20;top:calc(100% + 4px);left:0;right:0;min-width:180px;display:flex;flex-direction:column;padding:4px;border:1px solid #DDE3EB;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(22,34,58,.14)')}><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={css('width:100%;box-sizing:border-box;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;margin-bottom:4px')} /><div style={css('max-height:220px;overflow:auto;display:flex;flex-direction:column')}>{handlerPool.filter((p) => !qq || row.hands.includes(p.id) || p.name.toLowerCase().includes(qq)).sort((a, b) => Number(row.hands.includes(b.id)) - Number(row.hands.includes(a.id))).map((p) => { const on = row.hands.includes(p.id); return <label key={p.id} className="hover:bg-[#F6F8FA]" style={css('display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;font-size:11px;color:#16223A;cursor:pointer')}><input type="checkbox" checked={on} onChange={() => { const nh = on ? row.hands.filter((x) => x !== p.id) : [...row.hands, p.id]; if (nh.length) setFile(row.id, { hands: nh, cu: {} }); else F.toastMsg('Keep at least one handler'); }} style={css('margin:0;accent-color:#16223A;cursor:pointer')} />{p.name}<span style={css('margin-left:auto;font-size:9.5px;color:#5B6478')}>{p.t}</span></label>; })}</div><button type="button" onClick={() => setOpen(null)} style={css('margin-top:2px;border:0;border-top:1px solid #EEF1F5;padding:6px 8px;font-size:10.5px;font-weight:700;background:#fff;color:#3D6B9C;cursor:pointer;font-family:inherit;text-align:right')}>Done</button></div>}</div>
                  : <span style={css('font-size:11px;color:#16223A')}>{row.hands.map(nm).join(', ') || '—'}</span>}
                {row.hands.length > 1 && <div style={css('display:flex;flex-wrap:wrap;gap:6px')}>{row.hands.map((c) => <label key={c} style={css('display:flex;align-items:center;gap:3px;font-size:10px;color:#5B6478')}>{first(nm(c))}<input defaultValue={String(row.cu?.[c] != null ? row.cu[c] : Math.round(10000 / row.hands.length) / 100)} readOnly={!editable} onBlur={(e) => { if (editable) setFile(row.id, { cu: { ...(row.cu || {}), [c]: num0(e.target.value) } }); }} style={css(numIn + ';width:42px')} />%</label>)}</div>}
                {!row.sumOk && <span style={css('font-size:10px;font-weight:700;color:#B23A2E')}>handler % must add up to 100</span>}
              </div>
              <span style={css('display:flex;flex-direction:column;gap:3px')}><span style={css('font-size:11px;font-weight:600;color:#16223A')}>{shares}</span><span style={css(`font-size:10px;color:${row.custom ? '#8A6534' : '#5B6478'}`)}>{ruleTxt}</span>
                {row.custom && <span style={css('display:flex;flex-wrap:wrap;gap:6px;font-size:10px;color:#5B6478')}>{(['own', 'intro', 'hand'] as const).map((kk) => <label key={kk} style={css('display:flex;align-items:center;gap:2px')}>{kk === 'own' ? 'both' : kk === 'intro' ? 'intro' : 'handlers'}<input defaultValue={String(row.rf[kk])} readOnly={!editable} onBlur={(e) => setFile(row.id, { rules: { ...row.rf, [kk]: num0(e.target.value) } })} style={css(numIn + ';width:38px')} />%</label>)}</span>}
                {editable && <button type="button" onClick={() => setFile(row.id, { rules: row.custom ? undefined : { ...row.rf } })} style={css('align-self:flex-start;border:0;background:none;padding:0;font-size:10px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit')}>{row.custom ? 'Use firm rules' : 'Set % for this file'}</button>}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#5B6478')}>{rm2(row.firm)}</span>
            </div>
          ); })}
          {!r.rows.length && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No professional fees collected in this month.</div>}</div>
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#F6F8FA')}><span style={css('font-size:11px;color:#16223A')}>Collected <strong>{rm2(coll)}</strong> · firm's share <strong>{rm2(firmK)}</strong></span><span style={css('margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>{signBtns()}</span></div>
        </div>
      </div>}
      {tab === 'r' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Fee sharing rules</strong><span style={css('font-size:10.5px;color:#5B6478')}>on professional fees collected in the month · SST and disbursements excluded · change here, applies to every file</span></div>
        <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr))')}>
          {([['own', 'Brought in & handled the file', '% to the lawyer', "firm's share " + (100 - rules.own) + '%'], ['intro', 'Brought it in only', '% referral to introducer', 'partner, lawyer or staff'], ['hand', 'Handled it', '% shared by the handlers', "firm's share " + (100 - rules.intro - rules.hand) + '% · equal split, or set % per file']] as const).map(([key, h, unit, note], i) => <div key={key} style={css(`padding:12px 14px;${i < 2 ? 'border-right:1px solid #EEF1F5;' : ''}display:flex;flex-direction:column;gap:6px`)}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>{h}</span><div style={css('display:flex;align-items:center;gap:6px')}><input key={rules[key]} defaultValue={String(rules[key])} onBlur={(e) => { const v = Math.max(0, Math.min(100, num0(e.target.value))); if (v !== rules[key]) F.saveFs({ rules: { ...rules, [key]: v } }); }} style={css('width:52px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 6px;font-size:13px;font-weight:700;font-family:inherit;color:#16223A;text-align:right;outline:none')} /><span style={css('font-size:12px;color:#16223A')}>{unit}</span></div><span style={css('font-size:10.5px;color:#5B6478')}>{note}</span></div>)}
        </div>
        <div style={css('border-top:1px solid #EEF1F5;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:#FBFCFD')}>
          <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>Partners' split of the firm's share</span><span style={css('font-size:10.5px;color:#5B6478')}>after office costs, the rest is shared between partners every month</span></div>
          <div style={css('display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:#16223A')}>
            <span>Firm's share <strong>{rm2(r.firm)}</strong></span><span style={css('color:#5B6478')}>−</span>
            <label style={css('display:flex;align-items:center;gap:6px')}>Office costs this month RM<input key={r.costs} defaultValue={String(r.costs)} onBlur={(e) => { const v = num0(e.target.value); if (v !== r.costs) F.saveFs({ costs: { ...(FS.costs || {}), [F.period]: v } }); }} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 6px;font-size:13px;font-weight:700;font-family:inherit;color:#16223A;text-align:right;outline:none;width:90px')} /></label><span style={css('color:#5B6478')}>=</span>
            <span>Profit to share <strong style={css(`color:${r.firmProfit < 0 ? '#B23A2E' : '#16223A'}`)}>{rm2(r.firmProfit)}</strong></span>
          </div>
          <div style={css('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>{Object.keys(r.SPL).map((id) => <label key={id} style={css('display:flex;align-items:center;gap:6px;font-size:12px;color:#16223A')}><strong>{nm(id)}</strong><input key={r.SPL[id]} defaultValue={String(r.SPL[id])} onBlur={(e) => { const v = num0(e.target.value); if (v !== r.SPL[id]) F.saveFs({ psplit: { ...r.SPL, [id]: v } }); }} style={css('width:64px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 6px;font-size:13px;font-weight:700;font-family:inherit;color:#16223A;text-align:right;outline:none')} />%<span style={css('font-size:11px;color:#2F5680;font-weight:700')}>{rm2(r.pp[id]?.fsh || 0)}</span></label>)}</div>
          {!r.splitOk && <span style={css('font-size:10.5px;font-weight:700;color:#B23A2E')}>Partners' % add up to {r.splitSum}%. Make it 100%.</span>}
          {r.firmProfit < 0 && <span style={css('font-size:10.5px;font-weight:700;color:#B23A2E')}>Costs are more than what the firm kept this month, so there's no profit to share. The shortfall stays with the firm.</span>}
          <span style={css('font-size:10px;color:#5B6478')}>Office costs start from this month's Profit &amp; loss expenses; type a different figure if needed.</span>
        </div>
      </div>}
      {tab === 'p' && <div style={css(CARD)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>People &amp; pay</strong><span style={css('font-size:10.5px;color:#5B6478')}>how each person is paid now, and any salary you plan to start</span><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search name or role…" style={css('margin-left:auto;width:200px;border:1px solid #DDE3EB;border-radius:6px;padding:6px 9px;font-size:11px;font-family:inherit;color:#16223A;background:#fff')} /></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 120px 210px 110px minmax(0,1.6fr);gap:10px;padding:7px 14px;background:#F6F8FA;border-bottom:1px solid #EEF1F5;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}><span>Person</span><span>Role</span><span>Paid by</span><span>Monthly amount</span><span>Planned change</span></div>
        {pplRows.map((p) => { const isP = isPartnerType(p.t); const hasSal = isP ? p.pay !== 'Profit share only' : p.pay !== 'Fee sharing only'; const o = (FS.people || {})[p.id] || {}; const SEL = 'border:1px solid #DDE3EB;border-radius:6px;padding:4px 6px;font-size:11px;font-family:inherit;color:#16223A;background:#fff;cursor:pointer;width:100%'; return (
          <div key={p.id} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 120px 210px 110px minmax(0,1.6fr);gap:10px;align-items:center;padding:6px 14px;border-top:1px solid #F4F6F8')}>
            <strong style={css('font-size:11.5px;color:#16223A')}>{p.name}</strong>
            <select value={p.t} onChange={(e) => setPerson(p, { t: e.target.value })} style={css(SEL)}>{['Owner', 'Partner', 'Associate', 'Staff'].map((x) => <option key={x}>{x}</option>)}</select>
            <select value={p.pay} onChange={(e) => setPerson(p, { pay: e.target.value })} style={css(SEL)}>{(isP ? PARTNER_PAYS : STAFF_PAYS).map((x) => <option key={x}>{x}</option>)}</select>
            {hasSal ? <input key={p.sal} defaultValue={p.sal ? String(p.sal) : ''} onBlur={(e) => { const v = num0(e.target.value); if (v !== p.sal) setPerson(p, { sal: v }); }} placeholder="RM" style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:4px 7px;font-size:11px;font-family:inherit;color:#16223A;outline:none;box-sizing:border-box')} /> : <span style={css('font-size:10.5px;color:#94A3B8')}>none yet</span>}
            <div style={css('display:flex;align-items:center;gap:6px')}><input defaultValue={o.nsal || ''} onBlur={(e) => { if (e.target.value !== (o.nsal || '')) setPerson(p, { nsal: e.target.value.replace(/[^0-9.]/g, '') }); }} placeholder="new RM / month" style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 7px;font-size:11px;font-family:inherit;color:#16223A;outline:none;box-sizing:border-box;width:110px')} /><span style={css('font-size:10.5px;color:#5B6478')}>from</span><select value={o.nfrom || fsMonths[2]} onChange={(e) => setPerson(p, { nfrom: e.target.value })} style={css(SEL + ';width:100px')}>{fsMonths.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
        ); })}
        {!pplRows.length && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No one matches.</div>}
        <div style={css('padding:8px 14px;font-size:10px;line-height:1.5;color:#5B6478;background:#FBFCFD;border-top:1px solid #EEF1F5')}>Owner and partners: their share is paid by a partner's share statement, with no EPF, SOCSO, EIS or PCB; each partner declares it in Form B and the firm files Form P. Partners can be paid by profit share only, a monthly salary plus profit share, or a monthly drawing (an advance taken off their share). Switch any time; it all goes on the Partner Pay Statement. Associates and staff: fee sharing is commission on their payslip, with EPF, SOCSO, EIS &amp; PCB; a planned salary adds basic pay from that month.</div>
      </div>}
    </div>
  );
};
