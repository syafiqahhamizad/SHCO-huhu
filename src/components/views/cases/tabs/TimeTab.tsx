import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import { isApprovedForBilling } from '../../../../lib/billingEngine';
import { css, S, Card, Field } from '../caseUi';
import { P, isoOf, rm, short, todayIso } from '../caseModel';
import { newId, type WF } from '../wf';

/** Time is logged here (TimeEntry). Disbursements come in from approved claims / payment
 * requests (Expense / TravelClaim records on this file) — nothing is keyed in twice. */
export const TimeTab: React.FC<{ w: WF }> = ({ w }) => {
  const { addTimeEntry, timeEntries = [], setCurrentView } = useApp();
  const { c, staff, me, money, ro } = w;
  const lastRate = (name: string) => {
    const mine = timeEntries.filter((t) => t.feeEarner === name && Number(t.rate) > 0).sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));
    return mine[0] ? Number(mine[0].rate) : 0;
  };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({ date: todayIso(), desc: '', by: me, hrs: '1', rate: String(lastRate(me) || '') }));
  const myRate = lastRate(me);

  const saveC = () => {
    if (!f.desc.trim()) { w.toast('Add what was done'); return; }
    const hours = Number(f.hrs) || 0;
    if (hours <= 0) { w.toast('Add the hours'); return; }
    addTimeEntry({ id: newId('T'), caseId: c.id, feeEarner: f.by, date: f.date, hours, rate: Number(f.rate) || 0, billable: true, billed: false, description: f.desc.trim(), createdAt: new Date().toISOString() });
    setF({ date: todayIso(), desc: '', by: me, hrs: '1', rate: String(lastRate(me) || '') });
    setOpen(false);
    w.toast('Time logged: ' + f.desc.trim() + ' (' + hours + ' h)');
  };

  type Row = { key: string; date: string; kind: 'Time' | 'Disbursement'; desc: string; src: string; by: string; hrs: string; amt: number; status: string; tone: { bg: string; fg: string } };
  const rows: Row[] = [
    ...money.te.map((t) => ({ key: 't' + t.id, date: t.date, kind: 'Time' as const, desc: t.description || 'Time', src: 'Logged here', by: t.feeEarner, hrs: String(t.hours), amt: Number(t.hours || 0) * Number(t.rate || 0), status: t.billed ? 'Billed' : t.writtenOff ? 'Written off' : !isApprovedForBilling(t.approvalStatus) ? (t.approvalStatus || 'Pending') : 'Unbilled', tone: t.billed ? P.g : t.writtenOff ? P.r : P.n })),
    ...money.ex.map((e) => ({ key: 'e' + e.id, date: e.date, kind: 'Disbursement' as const, desc: e.description || e.category, src: e.formNo ? (/^PV/i.test(e.formNo) ? 'Payment request ' + e.formNo : 'Claim ' + e.formNo + ' (My Claims)') : 'Accounts & Finance', by: e.claimant || e.payee || '—', hrs: '—', amt: Number(e.amount || 0), status: e.billed ? 'Billed' : e.writtenOff ? 'Written off' : !isApprovedForBilling(e.approvalStatus) ? (e.approvalStatus === 'Rejected' ? 'Rejected' : 'Awaiting approval') : e.billable ? 'Unbilled' : 'Not billable', tone: e.billed ? P.g : !isApprovedForBilling(e.approvalStatus) ? P.a : P.n })),
    ...money.tc.map((t) => ({ key: 'c' + t.id, date: t.date, kind: 'Disbursement' as const, desc: t.purpose || 'Travel', src: 'Claim ' + (t.formNo || t.id) + ' (My Claims)', by: t.claimant, hrs: '—', amt: Math.max(0, Number(t.billableClientTotal || 0)), status: t.billed === 'Y' ? 'Billed' : !isApprovedForBilling(t.approvalStatus) ? (t.approvalStatus === 'Rejected' ? 'Rejected' : 'Awaiting approval') : 'Unbilled', tone: t.billed === 'Y' ? P.g : !isApprovedForBilling(t.approvalStatus) ? P.a : P.n })),
  ].sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));

  const stats: [string, string][] = [
    ['Unbilled time', money.ubHours + ' hrs'],
    ['Unbilled time value', rm(money.ubFees)],
    ['Unbilled costs', rm(money.ubDisb)],
    ['Hourly rate (' + w.meCode + ')', myRate ? rm(myRate) : 'Not set yet'],
  ];
  const cols = 'display:grid;grid-template-columns:90px 110px minmax(0,1fr) 130px 70px 100px 110px;min-width:860px;';
  return (
    <>
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px')}>
        {stats.map(([k, v]) => <div key={k} style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:12px 16px;display:flex;flex-direction:column;gap:4px')}><span style={css(S.label)}>{k}</span><strong style={css('font-size:18px;color:#16223A')}>{v}</strong></div>)}
      </div>
      <Card style="overflow-x:auto">
        <div style={css(S.head)}>
          <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Time &amp; costs</strong>
          <span style={css(S.sub)}>Time is logged here. Costs come in from approved claims and PVs, so nothing is keyed in twice.</span>
          <div style={css('margin-left:auto;display:flex;gap:8px;flex-wrap:wrap')}>
            {w.canOpenFin('billing') && <button type="button" onClick={() => { setCurrentView('billing'); w.toast('Billing & Collections opened. Bill unbilled work for ' + c.ref + ' from Work not billed'); }} style={css(S.btnSec)}>Bill unbilled items</button>}
            {!ro && <button type="button" onClick={() => setOpen(!open)} style={css(S.btnPri)}>+ Log time</button>}
            <button type="button" onClick={() => setCurrentView('reimbursements')} style={css(S.btnSec)}>+ Claim a cost →</button>
          </div>
        </div>
        {open && (
          <div style={css(S.formGrid(160))}>
            <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Work done" span="span 2"><input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="e.g. Drafting written submissions" style={css(S.input)} /></Field>
            <Field label="By"><select value={f.by} onChange={(e) => setF({ ...f, by: e.target.value, rate: String(lastRate(e.target.value) || '') })} style={css(S.input)}>{staff.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}{!staff.some((p) => p.name === f.by) && <option value={f.by}>{f.by}</option>}</select></Field>
            <Field label="Hours"><input type="number" step="0.25" min="0" value={f.hrs} onChange={(e) => setF({ ...f, hrs: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Rate (RM / h)"><input type="number" step="1" min="0" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} placeholder="Last used rate" style={css(S.input)} /></Field>
            <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => setOpen(false)} style={css(S.btnSecL)}>Cancel</button><button type="button" onClick={saveC} style={css(S.btnPriL)}>Save time</button></div>
          </div>
        )}
        <div style={css(cols + S.th)}><span>Date</span><span>Type</span><span>Description · source</span><span>By</span><span>Hours</span><span>Amount</span><span>Status</span></div>
        {rows.map((r) => (
          <div key={r.key} style={css(cols + 'align-items:center;' + S.row)}>
            <span style={css('color:#16223A')}>{short(r.date)}</span>
            <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${r.kind === 'Time' ? P.b.bg : P.a.bg};color:${r.kind === 'Time' ? P.b.fg : P.a.fg}`)}>{r.kind}</span>
            <div style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('color:#16223A')}>{r.desc}</span><span style={css('font-size:11.5px;color:#4A5468')}>{r.src}</span></div>
            <span style={css('color:#16223A')}>{r.by}</span>
            <span style={css('color:#16223A')}>{r.hrs}</span>
            <strong style={css('color:#16223A')}>{r.amt ? rm(r.amt) : r.kind === 'Time' ? 'Rate not set' : rm(0)}</strong>
            <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${r.tone.bg};color:${r.tone.fg}`)}>{r.status}</span>
          </div>
        ))}
        {!rows.length && <div style={css(S.empty)}>No time or costs on this file yet.</div>}
      </Card>
    </>
  );
};
