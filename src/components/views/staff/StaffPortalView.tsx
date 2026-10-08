import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Payslip } from '../../../types';
import { identityTokens } from '../../../lib/identity';
import { annualLeaveBalance } from '../../../lib/teamMetrics';
import { getPracticeSettings } from '../../../services/templateService';
import {
  buildEaHtml, buildFileDirectory, buildMyClaimRows, buildPayslipHtml, card, cardTitle, dedLines, dedOf, dMonY, earnLines, FirmLetterhead,
  grossOf, MONTHS_SHORT, netOf, periodLabel, printHtml, rm, serif, staffIdentity,
} from './staffPortalShared';
import { StaffClaimsTab } from './StaffClaimsTab';
import { StaffLeaveTab } from './StaffLeaveTab';
import { StaffGoalsTab } from './StaffGoalsTab';
import { StaffAttendanceTab } from './StaffAttendanceTab';
import { StaffProfileTab } from './StaffProfileTab';
import { personBits } from '../settings/permissionModel';

type Tab = 'pay' | 'claims' | 'leave' | 'attendance' | 'goals' | 'profile';
// Design order (Payslips, My Claims, Leave, Goals & wellbeing); Attendance and the HR-only
// Employee records are kept from before the design.
const TABS: [Tab, string][] = [['pay', 'Payslips'], ['claims', 'My Claims'], ['leave', 'Leave'], ['attendance', 'Attendance'], ['goals', 'Goals & wellbeing'], ['profile', 'Employee records']];
const PAY_GRID = 'minmax(0,1fr) 100px 90px 90px 90px 100px';
const LH_PATH = import.meta.env.BASE_URL + 'assets/sh-name.png';

/** Letterhead artwork as a data URL so the print iframe never waits on a network fetch. */
const useLetterhead = () => {
  const [src, setSrc] = useState(() => new URL(LH_PATH, window.location.href).href);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')?.drawImage(img, 0, 0);
        setSrc(c.toDataURL('image/png'));
      } catch {
        /* keep the absolute URL */
      }
    };
    img.src = LH_PATH;
  }, []);
  return src;
};

export const StaffPortalView: React.FC = () => {
  const { currentUser, users, payslips, travelClaims, expenses, paymentVouchers, cases, clients, leaveApplications, showToast, isAdmin, rolesMatrix, currentView, setCurrentView } = useApp();
  // Employee records are HR-only: admins, or people granted "HR records" in Permissions & limits.
  const canHr = Boolean(isAdmin) || personBits(rolesMatrix || {}, currentUser, 'hrRecords')[0] === '1';
  const tabs = TABS.filter(([k]) => k !== 'profile' || canHr);
  const [innerTab, setInnerTab] = useState<Exclude<Tab, 'claims'>>('pay');
  // My Claims is the claims tab of this page: the sidebar's "My Claims" opens it and stays highlighted.
  const tab: Tab = currentView === 'reimbursements' ? 'claims' : innerTab;
  const setTab = (t: Tab) => {
    if (t === 'claims') return setCurrentView('reimbursements');
    setInnerTab(t);
    if (currentView === 'reimbursements') setCurrentView('staffPortal');
  };
  const lh = useLetterhead();

  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const dir = useMemo(() => buildFileDirectory(cases || [], clients || [], users || []), [cases, clients, users]);
  const claimRows = useMemo(
    () => buildMyClaimRows(me, travelClaims || [], expenses || [], paymentVouchers || [], dir),
    [me, travelClaims, expenses, paymentVouchers, dir]
  );

  // Only this person's own payslips, and only once payroll has approved / paid them.
  const mySlips = useMemo(
    () => (payslips || []).filter((p) => p.userId === currentUser.id && (p.status === 'Approved' || p.status === 'Paid')).sort((a, b) => b.period.localeCompare(a.period)),
    [payslips, currentUser.id]
  );
  const myLeaves = useMemo(() => (leaveApplications || []).filter((l) => l.userId === currentUser.id), [leaveApplications, currentUser.id]);
  const thisYear = String(new Date().getFullYear());
  const used = (type: string) =>
    myLeaves.filter((l) => l.leaveType === type && l.status !== 'Rejected' && l.status !== 'Cancelled' && (l.startDate || '').startsWith(thisYear)).reduce((s, l) => s + Number(l.days || 0), 0);
  const goals = currentUser.staffProfile?.goals || [];

  if (currentUser.role === 'Client') return <div style={{ padding: 32, textAlign: 'center' }}>Staff Portal is available to staff accounts only.</div>;

  const latest = mySlips[0];
  // Only money owed back to this person (travel / own-pocket claims) — vendor payment requests (PVs) are not theirs to receive.
  const waiting = claimRows.filter((c) => c.status === 'Waiting' && c.source !== 'pv');
  const al = annualLeaveBalance(leaveApplications || [], currentUser.id);
  const tiles: [string, string, string, string, Tab][] = [
    latest
      ? ['Net pay · ' + MONTHS_SHORT[Number(latest.period.slice(5, 7)) - 1], rm(netOf(latest)), latest.paidAt ? 'paid ' + dMonY(latest.paidAt) : 'approved · not paid yet', '#2F6F4E', 'pay']
      : [MONTHS_SHORT[new Date().getMonth()] + ' payslip', 'Not yet', 'appears here once Accounts sends payslips', '#8A6534', 'pay'],
    ['Claims waiting', rm(waiting.reduce((s, x) => s + x.amt, 0)), waiting.length + ' item(s) with partner', '#8A6534', 'claims'],
    ['Annual leave left', al.left + ' days', `of ${al.entitlement} this year${al.pending ? ` · ${al.pending} pending approval` : ''}`, '#3D6B9C', 'leave'],
    ['Goals on track', goals.filter((g) => g.status === 'On track' || g.status === 'Done').length + ' of ' + goals.length, 'personal & career', '#6B3D8C', 'goals'],
  ];

  return (
    // lineHeight 'normal' matches the design canvas (the app shell's preflight sets 1.5).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: '#1E293B', fontSize: 12, lineHeight: 'normal' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        {tiles.map(([label, value, note, c, t]) => (
          <button key={label} type="button" onClick={() => setTab(t)} style={{ textAlign: 'left', borderRadius: 12, border: '1px solid #DDE3EB', background: '#fff', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', fontFamily: 'inherit', borderTop: '3px solid ' + c }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#5B6478' }}>{label}</span>
            <span style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: '#16223A' }}>{value}</span>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>{note}</span>
          </button>
        ))}
      </section>
      <section style={{ display: 'flex', gap: 4, borderBottom: '1px solid #DDE3EB' }}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{ border: 0, background: 'none', padding: '9px 14px', marginBottom: -1, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: tab === k ? '#16223A' : '#5B6478', borderBottom: '2px solid ' + (tab === k ? '#16223A' : 'transparent') }}>{label}</button>
        ))}
      </section>

      {tab === 'pay' && <PayslipsTab slips={mySlips} lh={lh} showToast={showToast} />}
      {tab === 'claims' && <StaffClaimsTab rows={claimRows} dir={dir} />}
      {tab === 'leave' && <StaffLeaveTab myLeaves={myLeaves} used={used} me={me} />}
      {tab === 'attendance' && <StaffAttendanceTab />}
      {tab === 'goals' && <StaffGoalsTab />}
      {tab === 'profile' && canHr && <StaffProfileTab lh={lh} />}
    </div>
  );
};

/* ================================================================== Payslips */

const PayslipsTab: React.FC<{ slips: Payslip[]; lh: string; showToast: (m: string) => void }> = ({ slips, lh, showToast }) => {
  const { currentUser } = useApp();
  const years: number[] = Array.from(new Set<number>(slips.map((s) => Number(s.period.slice(0, 4))))).sort((a, b) => b - a);
  const nowYear = new Date().getFullYear();
  const [pickedYear, setPayYear] = useState<number>(years[0] || nowYear);
  const [slipId, setSlipId] = useState<string | undefined>(slips[0]?.id);
  const [showSlip, setShowSlip] = useState(false);
  // Payslips can arrive after mount (cloud sync) — fall back to the latest year that has any.
  const payYear = years.includes(pickedYear) ? pickedYear : years[0] || nowYear;

  const YS = slips.filter((s) => Number(s.period.slice(0, 4)) === payYear);
  const S0 = YS.find((s) => s.id === slipId) || YS[0];
  const who = staffIdentity(currentUser);
  const settings = getPracticeSettings();
  const firm: FirmLetterhead = { address: settings.address, email: settings.email, phone: settings.phone };
  const slipHtml = S0 ? buildPayslipHtml(S0, who, lh, firm) : '';
  const month = S0 ? periodLabel(S0.period) : '—';

  const joined = currentUser.staffProfile?.joinDate;
  const joinedTxt = joined && /^\d{4}-\d{2}/.test(joined) ? ' (' + MONTHS_SHORT[Number(joined.slice(5, 7)) - 1] + ' ' + joined.slice(0, 4) + ')' : '';
  const sumY = (f: (p: Payslip) => number) => YS.reduce((x, s) => x + f(s), 0);
  const eaReady = YS.length > 0 && payYear < nowYear;
  const eaNote = !YS.length ? 'No EA form yet: no payslips issued.' : eaReady ? 'EA form ' + payYear + ' is ready.' : 'EA form ' + payYear + ' will be ready by end Feb ' + (payYear + 1) + '.';

  const slipPdf = () => {
    if (!S0) return;
    printHtml('Payslip ' + month, slipHtml);
  };
  const eaForm = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!YS.length) return;
    printHtml('EA form ' + payYear, buildEaHtml(payYear, YS, who, lh, firm));
    showToast('EA form ' + payYear + ' ready to save as PDF');
  };

  const cell = (v: number, color: string, extra: React.CSSProperties = {}) => (
    <span style={{ textAlign: 'right', fontSize: 11.5, color, ...extra }}>{v ? rm(v) : '—'}</span>
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
            <strong style={cardTitle}>My payslips</strong>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>every month since you joined{joinedTxt}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {years.map((y) => (
                <button key={y} type="button" onClick={() => { setPayYear(y); setSlipId(slips.find((s) => Number(s.period.slice(0, 4)) === y)?.id); }} style={{ borderRadius: 14, padding: '3px 11px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (payYear === y ? '#16223A' : '#DDE3EB'), background: payYear === y ? '#16223A' : '#fff', color: payYear === y ? '#fff' : '#16223A' }}>{y}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: PAY_GRID, gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478', background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Month</span><span style={{ textAlign: 'right' }}>Gross</span><span style={{ textAlign: 'right' }}>Referral</span><span style={{ textAlign: 'right' }}>Profit / fee share</span><span style={{ textAlign: 'right' }}>Bonus</span><span style={{ textAlign: 'right' }}>Net pay</span>
          </div>
          {!YS.length && <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#5B6478', borderBottom: '1px solid #F0F2F5' }}>No payslips issued yet</div>}
          {YS.map((s) => {
            const on = S0?.id === s.id;
            return (
              <button key={s.id} type="button" onClick={() => setSlipId(s.id)} style={{ width: '100%', display: 'grid', gridTemplateColumns: PAY_GRID, gap: 10, alignItems: 'center', padding: '8px 14px', border: 0, borderBottom: '1px solid #F0F2F5', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: on ? '#F6F8FA' : '#fff', borderLeft: '3px solid ' + (on ? '#16223A' : 'transparent') }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{periodLabel(s.period)}</span>
                <span style={{ textAlign: 'right', fontSize: 11.5, color: '#16223A' }}>{rm(grossOf(s))}</span>
                {cell(s.referralFee, '#8C2F4C')}
                {cell(s.profitShare, '#2F5680')}
                {cell(s.bonus, '#8C2F4C')}
                <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#2F6F4E' }}>{rm(netOf(s))}</span>
              </button>
            );
          })}
          {YS.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: PAY_GRID, gap: 10, alignItems: 'center', padding: '9px 14px', background: '#F6F8FA', borderTop: '1px solid #DDE3EB' }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#16223A' }}>{'Total ' + payYear + ' (' + YS.length + ' months)'}</span>
              <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{rm(sumY(grossOf))}</span>
              <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#8C2F4C' }}>{rm(sumY((s) => s.referralFee || 0))}</span>
              <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#2F5680' }}>{rm(sumY((s) => s.profitShare || 0))}</span>
              <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#8C2F4C' }}>{rm(sumY((s) => s.bonus || 0))}</span>
              <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#2F6F4E' }}>{rm(sumY(netOf))}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '9px 14px', fontSize: 10.5, lineHeight: 1.5, color: '#5B6478', borderTop: '1px solid #EEF1F5' }}>
            <span>Claims are not salary: they are paid back separately once approved (see My Claims).</span>
            <span>{eaNote}</span>
            {eaReady && <a href="#" onClick={eaForm} style={{ color: '#3D6B9C', fontWeight: 600 }}>Download EA form</a>}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#16223A' }}>
            <strong style={{ fontSize: 12.5, color: '#fff' }}>Payslip · {month}</strong>
            {S0 && (
              <>
                <button type="button" onClick={() => setShowSlip(true)} style={{ marginLeft: 'auto', border: '1px solid rgba(255,255,255,.35)', borderRadius: 6, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>View payslip</button>
                <button type="button" onClick={slipPdf} style={{ border: 0, borderRadius: 6, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, background: '#C9A86A', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>PDF</button>
              </>
            )}
          </div>
          {!S0 && <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#5B6478' }}>No payslips issued yet</div>}
          {S0 && (
            <>
              <div style={{ padding: '6px 14px 2px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#5B6478' }}>Earnings</div>
              {earnLines(S0).map((l, i) => (
                <div key={i} style={{ display: 'flex', padding: '4px 14px', fontSize: 11.5, color: '#16223A' }}>
                  <span>{l.k}<span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>{l.n}</span></span>
                  <strong style={{ marginLeft: 'auto' }}>{rm(l.v)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', margin: '4px 14px 0', padding: '6px 0 2px', borderTop: '1px solid #DDE3EB', fontSize: 11.5, color: '#16223A' }}>
                <strong>Total earnings</strong><strong style={{ marginLeft: 'auto', color: '#16223A' }}>{rm(grossOf(S0))}</strong>
              </div>
              <div style={{ padding: '8px 14px 2px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#5B6478', borderTop: '1px solid #F0F2F5', marginTop: 6 }}>Deductions</div>
              {dedLines(S0).map((l, i) => (
                <div key={i} style={{ display: 'flex', padding: '4px 14px', fontSize: 11.5, color: '#16223A' }}>
                  <span>{l.k}</span><strong style={{ marginLeft: 'auto', color: '#B23A2E' }}>{'- ' + rm(l.v)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', margin: '4px 14px 0', padding: '6px 0 2px', borderTop: '1px solid #DDE3EB', fontSize: 11.5, color: '#16223A' }}>
                <strong>Total deductions</strong><strong style={{ marginLeft: 'auto', color: '#B23A2E' }}>{'- ' + rm(dedOf(S0))}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, padding: '11px 14px', background: '#EEF5F0' }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>Net pay</span>
                <strong style={{ marginLeft: 'auto', fontFamily: serif, fontSize: 18, color: '#2F6F4E' }}>{rm(netOf(S0))}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {showSlip && S0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(22,34,58,.6)', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '24px 0 40px' }}>
          <div style={{ width: 794, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16223A', borderRadius: 10, padding: '8px 12px' }}>
              <strong style={{ color: '#fff', fontSize: 13 }}>Payslip · {month}</strong>
              <span style={{ fontSize: 10.5, color: '#C9D3E0' }}>exactly as printed / PDF</span>
              <button type="button" onClick={slipPdf} style={{ marginLeft: 'auto', border: '1px solid #B23A2E', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#B23A2E', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>PDF / Print</button>
              <button type="button" onClick={() => setShowSlip(false)} style={{ border: '1px solid rgba(255,255,255,.35)', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Close</button>
            </div>
            {/* Same HTML string the PDF prints — screen and paper can't drift apart. */}
            <div style={{ width: 794, minHeight: 1123, background: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,.3)', padding: '48px 56px', boxSizing: 'border-box' }} dangerouslySetInnerHTML={{ __html: slipHtml }} />
          </div>
        </div>
      )}
    </>
  );
};
