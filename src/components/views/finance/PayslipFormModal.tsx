import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, num0, rm2 } from './financeModel';
import { EPCB_URL, STATUTORY_AS_AT, STATUTORY_SOURCES } from '../../../lib/statutory';

const INPUT = 'width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff';
const LBL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
const BTN = 'border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap';
const BTN_DARK = 'border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap';
const SEC = 'font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478;padding-top:4px';

/**
 * Payslip editor (Finance → Payroll). EPF and SOCSO + EIS are worked out from the official
 * KWSP / PERKESO tables (src/lib/statutory.ts) as the wage lines are typed. Accounts can
 * override them with a reason. PCB and zakat are keyed in.
 */
export const PayslipFormModal = ({ F }: { F: FinanceCtrl }) => {
  const f = F.form!;
  const v = f.vals;
  const set = (patch: Record<string, unknown>) => F.setForm({ ...f, vals: { ...v, ...patch } });
  const st = F.slipStatutory(v.userId, v);
  const manual = !!v.stOverride || !st.ok;
  const epfEe = manual ? num0(v.epf) : st.epfEmployee;
  const epfEr = manual ? num0(v.epfEr) : st.epfEmployer;
  const sEe = manual ? num0(v.socso) : st.socsoEisEmployee;
  const sEr = manual ? num0(v.socsoEr) : st.socsoEisEmployer;
  const gross = num0(v.basic) + num0(v.allow) + num0(v.ref) + num0(v.ps) + num0(v.bonus);
  const ded = epfEe + sEe + num0(v.pcb) + num0(v.zakat) + num0(v.otherDed);

  const field = (k: string, label: string, ph = '') => (
    <label key={k} style={css('display:flex;flex-direction:column;gap:4px;min-width:0')}><span style={css(LBL)}>{label}</span><input value={v[k] ?? ''} onChange={(e) => set({ [k]: e.target.value })} placeholder={ph} style={css(INPUT)} /></label>
  );
  const toggleOverride = () => {
    if (v.stOverride) { set({ stOverride: false }); return; }
    // Start the override from the calculated figures so Accounts only changes what differs.
    const fill = (k: string, n: number) => (String(v[k] ?? '').trim() ? v[k] : st.ok ? String(n) : '');
    set({ stOverride: true, epf: fill('epf', st.epfEmployee), epfEr: fill('epfEr', st.epfEmployer), socso: fill('socso', st.socsoEisEmployee), socsoEr: fill('socsoEr', st.socsoEisEmployer) });
  };
  const row = (label: string, ee: number, er: number, sub?: string) => (
    <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px 90px;gap:8px;padding:3px 0;font-size:11.5px;color:#16223A')}>
      <span>{label}{sub && <span style={css('display:block;font-size:10px;color:#5B6478')}>{sub}</span>}</span>
      <strong style={css('text-align:right')}>{rm2(ee)}</strong><span style={css('text-align:right;color:#5B6478')}>{rm2(er)}</span>
    </div>
  );

  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);display:flex;align-items:flex-start;justify-content:center;padding-top:48px;padding-bottom:40px;overflow:auto')}>
      <div style={css('width:620px;max-width:calc(100vw - 32px);border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('padding:12px 16px;background:#16223A')}><strong style={css('font-size:13.5px;color:#fff')}>Payslip · {v.name || ''} · {F.monthName} {F.now.getFullYear()}</strong></div>
        <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:10px')}>
          <div style={css(SEC)}>Earnings</div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px')}>
            {field('basic', 'Basic salary (RM)')}{field('allow', 'Allowances (RM)')}
            {field('ref', 'Referral fees (RM)')}{field('refNote', 'Referral fee note')}
            {field('ps', 'Profit sharing (RM)')}{field('psNote', 'Profit sharing note')}
            {field('bonus', 'Bonus (RM)')}{field('bonusNote', 'Bonus note')}
          </div>

          <div style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
            <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}>
              <strong style={css('font-size:11.5px;color:#16223A')}>EPF, SOCSO &amp; EIS</strong>
              {!manual && <span title={STATUTORY_SOURCES} style={css('font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:#E6EFE9;color:#2F6F4E')}>Auto · KWSP/PERKESO tables as at {STATUTORY_AS_AT}</span>}
              {manual && <span style={css('font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:#FBF1E3;color:#8A6534')}>{st.ok ? 'Overridden by Accounts' : 'Key in manually'}</span>}
              {st.ok && <label style={css('margin-left:auto;display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:#16223A;cursor:pointer')}><input type="checkbox" checked={!!v.stOverride} onChange={toggleOverride} />Override</label>}
            </div>
            <div style={css('padding:8px 12px;display:flex;flex-direction:column;gap:4px')}>
              {!st.ok && <p style={css('margin:0;font-size:10.5px;line-height:1.5;color:#B23A2E;font-weight:600')}>{st.reason}</p>}
              {st.ok && <span style={css('font-size:10.5px;color:#5B6478')}>Age {st.age} · EPF on {rm2(st.wagesEpf)} (Third Schedule Part {st.epf.part}) · SOCSO {st.socso.category === 2 ? 'second category' : 'first category'} and EIS on {rm2(Math.min(st.wagesSocso, 6000))}{st.wagesSocso > 6000 ? ' (RM6,000 ceiling)' : ''}{st.eis.exempt ? ' · EIS not payable (' + st.eis.exempt + ')' : ''}</span>}
              <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px 90px;gap:8px;padding-top:4px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478')}><span></span><span style={css('text-align:right')}>Employee</span><span style={css('text-align:right')}>Employer</span></div>
              {!manual && <>
                {row('EPF (KWSP)', st.epf.employee, st.epf.employer)}
                {row('SOCSO (PERKESO, Act 4)', st.socso.employee, st.socso.employer, st.socso.skbbk ? `employee share includes LINDUNG 24 Jam ${rm2(st.socso.skbbk)}` : undefined)}
                {row('EIS (PERKESO, Act 800)', st.eis.employee, st.eis.employer)}
                <div style={css('border-top:1px solid #EEF1F5;margin-top:2px')}>{row('On the payslip: EPF · SOCSO + EIS', st.epfEmployee + st.socsoEisEmployee, st.epfEmployer + st.socsoEisEmployer, `employee ${rm2(st.epfEmployee)} + ${rm2(st.socsoEisEmployee)} · employer ${rm2(st.epfEmployer)} + ${rm2(st.socsoEisEmployer)}`)}</div>
              </>}
              {manual && <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px')}>
                {field('epf', 'EPF, employee (RM)')}{field('epfEr', 'EPF, employer (RM)')}
                {field('socso', 'SOCSO + EIS, employee (RM)')}{field('socsoEr', 'SOCSO + EIS, employer (RM)')}
                {st.ok && <div style={css('grid-column:1 / 3')}>{field('stReason', 'Reason for override (required)', 'e.g. staff elected EPF employee rate above 11%')}</div>}
                {st.ok && <span style={css('grid-column:1 / 3;font-size:10px;color:#5B6478')}>Calculated: EPF {rm2(st.epfEmployee)} / {rm2(st.epfEmployer)} · SOCSO + EIS {rm2(st.socsoEisEmployee)} / {rm2(st.socsoEisEmployer)} (employee / employer)</span>}
              </div>}
              {st.warnings.map((w) => <p key={w} style={css('margin:0;font-size:10px;line-height:1.45;color:#8A6534')}>⚠ {w}</p>)}
            </div>
          </div>

          <div style={css(SEC)}>Other deductions (keyed in)</div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px')}>
            <div style={css('display:flex;flex-direction:column;gap:4px')}>{field('pcb', 'PCB / income tax (RM)')}<span style={css('font-size:10px;color:#5B6478')}>Work out with LHDN's <a href={EPCB_URL} target="_blank" rel="noreferrer" style={css('color:#3D6B9C;font-weight:700')}>e-PCB calculator (MyTax)</a>.</span></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}>{field('zakat', 'Zakat via employer (RM)')}<span style={css('font-size:10px;color:#5B6478')}>Prefilled from the employee record (Pay &amp; statutory).</span></div>
            {field('otherDedName', 'Other deduction (name)')}{field('otherDed', 'Other deduction (RM)')}
          </div>

          <div style={css('display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;background:#EEF5F0;font-size:11.5px;color:#16223A')}>
            <span>Gross {rm2(gross)} · deductions {rm2(ded)}</span>
            <strong style={css('margin-left:auto;font-size:13px;color:#2F6F4E')}>Net pay {rm2(gross - ded)}</strong>
          </div>
          <span style={css('font-size:10px;color:#5B6478')}>Firm also pays employer EPF {rm2(epfEr)} + SOCSO/EIS {rm2(sEr)} = {rm2(epfEr + sEr)} to KWSP and PERKESO.</span>
          <div style={css('display:flex;gap:8px;justify-content:flex-end;margin-top:4px')}><button type="button" onClick={() => F.setForm(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={F.saveForm} style={css(BTN_DARK)}>Save</button></div>
        </div>
      </div>
    </div>
  );
};
