import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { ClaimAttachment, LeaveApplication } from '../../../types';
import { DRIVE_REQUIRED_MSG, isUploadReady, prepareStorage, storeLeaveDocument, useStorageLabel, validateClaimFile } from '../../../services/fileStorageService';
import { isMine } from '../../../lib/identity';
import { resolveApproval } from '../../../lib/approvers';
import { usePracticeSettings } from '../settings/settingsShared';
import { card, cardTitle, ddmmyyyy, isoOf, labelWrap, LEAVE_COLORS, LEAVE_TYPES, getPublicHolidays } from './staffPortalShared';

const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const INP: React.CSSProperties = { border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' };
const HALVES = ['Full day', 'Half day (AM)', 'Half day (PM)'];
const NEED_DOC = ['Medical', 'Hospitalisation', 'Study / exam', 'Hajj', 'Umrah', 'Maternity'];

interface Props {
  myLeaves: LeaveApplication[];
  used: (type: string) => number;
  me: Set<string>;
}

const statusLabel = (s: LeaveApplication['status']) => (s === 'Pending' ? 'Waiting' : s);

export const StaffLeaveTab: React.FC<Props> = ({ myLeaves, used, me }) => {
  const { currentUser, users, cases, clients, addLeaveApplication, addNotification, showToast } = useApp();
  const [lv, setLv] = useState({ type: 'Annual', from: '', to: '', half: 'Full day', pic: '', mc: '' });
  const setL = (p: Partial<typeof lv>) => setLv((s) => ({ ...s, ...p }));
  const [dragOn, setDragOn] = useState(false);
  const [mcFile, setMcFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const storage = useStorageLabel();
  // Firm & Practice Settings → Who approves → Staff leave; until it is set, any partner approves.
  const [settings] = usePracticeSettings();
  const rule = resolveApproval('leave', users, settings.approvers);
  /** Keeps the picked supporting document; blocked (with the reason) when Drive is not set up or the file is not allowed. */
  const pickMc = (f0?: File | null) => {
    if (!f0) return;
    if (!isUploadReady()) { showToast(DRIVE_REQUIRED_MSG); return; }
    const problem = validateClaimFile(f0);
    if (problem) { showToast(problem); return; }
    setMcFile(f0);
    setL({ mc: f0.name });
  };

  // Court dates on matters this person is on (lawyer in charge, team lawyer or partner).
  const COURT = useMemo(() => {
    const m: Record<string, string[]> = {};
    cases.forEach((c) => {
      if (!(isMine(c.lawyerInCharge, me) || isMine(c.lawyers as unknown, me) || isMine(c.partners as unknown, me))) return;
      const who = c.clientName || clients.find((cl) => cl.id === c.clientId)?.name || c.title || c.ref;
      (c.hearings || []).forEach((h) => {
        if (!h.date || h.status === 'Cancelled' || h.status === 'Completed') return;
        const d = h.date.slice(0, 10);
        (m[d] = m[d] || []).push('Court: ' + who + ' (' + (c.court || h.purpose) + ')');
      });
    });
    return m;
  }, [cases, clients, me]);

  const colleagues = users
    .filter((u) => u.id !== currentUser.id && u.role !== 'Client' && u.status === 'Active')
    .map((u) => ({ value: u.name, label: u.name + (u.role === 'Partner' ? ' (Partner)' : '') }));

  const T0 = LEAVE_TYPES.find((x) => x[0] === lv.type) || LEAVE_TYPES[0];
  const cal = T0[2] === 'calendar';
  const toD = (iso: string) => (iso ? new Date(iso + 'T00:00:00') : null);
  const s = toD(lv.from);
  const e = toD(lv.to || lv.from) || s;
  let days = 0;
  const hols: string[] = [];
  const PUBLIC_HOLIDAYS = getPublicHolidays();
  const clash: string[] = [];
  if (s && e && e >= s) {
    for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const k = isoOf(d);
      const off = d.getDay() === 0 || d.getDay() === 6 || !!PUBLIC_HOLIDAYS[k];
      if (cal || !off) days++;
      else if (PUBLIC_HOLIDAYS[k]) hols.push(PUBLIC_HOLIDAYS[k]);
      if (COURT[k]) clash.push(...COURT[k]);
    }
  }
  const oneDay = !!s && (!lv.to || lv.to === lv.from) && !cal;
  if (oneDay && lv.half !== 'Full day' && days) days = 0.5;
  const left = T0[1] ? T0[1] - used(T0[0]) : Infinity;
  const over = days > left;
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const needMc = NEED_DOC.includes(T0[0]);
  const mcLabel = (lv.mc ? '✓ ' : '') + 'Attach ' + (T0[0] === 'Medical' ? 'MC' : T0[0] === 'Hospitalisation' ? 'discharge note' : T0[0] === 'Study / exam' ? 'exam slip' : T0[0] === 'Hajj' ? 'Tabung Haji letter' : T0[0] === 'Umrah' ? 'travel confirmation' : 'doctor’s letter');
  const rangeLabel = s && e ? fmt(s) + (e > s ? ' → ' + fmt(e) : '') + (oneDay && lv.half !== 'Full day' ? ' · ' + lv.half.replace('Half day ', '').replace(/[()]/g, '') : '') : 'Choose the first and last day';
  const daysLabel = s ? days + (cal ? ' calendar' : ' working') + ' day' + (days === 1 ? '' : 's') : '';
  const warn = over
    ? 'Not enough ' + T0[0].toLowerCase() + ' leave left (' + left + ' days).'
    : clash.length
      ? 'Clash: ' + clash.join(' · ') + '. Your PIC and partner will be told.'
      : hols.length
        ? 'Public holiday not counted: ' + hols.join(', ') + '.'
        : cal
          ? 'Counted in calendar days (weekends included).'
          : 'Weekends and public holidays are not counted.';
  const wc = over || clash.length ? '#B23A2E' : '#5B6478';

  const submit = async () => {
    if (busy) return;
    if (!s || !e) return showToast('Choose your dates');
    if (e < s) return showToast('The “To” date is before “From”');
    if (!days) return showToast('No working days in those dates');
    if (over) return showToast('Not enough leave balance');
    if (needMc && !mcFile) return showToast('Please attach the supporting document');
    if (!lv.pic) return showToast('Choose the PIC covering your files');
    const end = lv.to || lv.from;
    const id = 'LV-' + Date.now();
    // The supporting document goes to the firm Google Drive (Leave/<YYYY>/<staff>/); only its
    // metadata is kept on the leave record. Blocked until Drive storage is set up.
    let attachment: ClaimAttachment | undefined;
    if (needMc && mcFile) {
      setBusy(true);
      try {
        await prepareStorage();
        attachment = await storeLeaveDocument({ email: currentUser.email, staffId: currentUser.staffProfile?.staffId, name: currentUser.name }, mcFile, id);
      } catch (err) {
        setBusy(false);
        return showToast('Not sent: ' + (err instanceof Error ? err.message : String(err)));
      }
      setBusy(false);
    }
    addLeaveApplication({
      id,
      attachment,
      userId: currentUser.id,
      leaveType: lv.type as LeaveApplication['leaveType'],
      startDate: lv.from,
      endDate: end,
      days,
      reason: '',
      status: 'Pending',
      submittedAt: new Date().toISOString(),
      pic: lv.pic,
      halfDay: days === 0.5 ? (lv.half.includes('AM') ? 'AM' : 'PM') : undefined,
      attachmentName: lv.mc || undefined,
    });
    addNotification({
      title: 'Leave request · ' + currentUser.name,
      message: currentUser.name + ' applied for ' + lv.type + ' leave ' + ddmmyyyy(lv.from) + (end !== lv.from ? ' – ' + ddmmyyyy(end) : '') + ' (' + days + ' day' + (days === 1 ? '' : 's') + '). PIC covering files: ' + lv.pic + '.' + (clash.length ? ' Clash: ' + clash.join(' · ') + '.' : ''),
      type: 'system',
      // Partners approve leave under My Dashboard → Needs your decision.
      linkTab: 'dashboard',
      to: [...(rule ? rule.people.map((u) => u.id) : ['role:Partner']), lv.pic],
    });
    setLv((x) => ({ ...x, from: '', to: '', half: 'Full day', pic: '', mc: '' }));
    setMcFile(null);
    showToast('Leave request sent to your partner and ' + lv.pic);
  };

  const addCal = (l: LeaveApplication) => {
    const a0 = l.startDate.replace(/-/g, '');
    const nd = new Date((l.endDate || l.startDate) + 'T00:00:00');
    nd.setDate(nd.getDate() + 1);
    const end = isoOf(nd).replace(/-/g, '');
    const why = l.pic ? 'PIC: ' + l.pic : l.reason;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SH & Co//Staff Portal//EN', 'BEGIN:VEVENT', 'UID:' + a0 + '-' + l.leaveType.replace(/\W+/g, '') + '@shcolaw.com', 'DTSTART;VALUE=DATE:' + a0, 'DTEND;VALUE=DATE:' + end, 'SUMMARY:' + l.leaveType + ' leave' + (l.status === 'Pending' ? ' (pending)' : ''), 'DESCRIPTION:' + why, 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const u = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const el = document.createElement('a');
    el.href = u;
    el.download = l.leaveType + ' leave ' + a0 + '.ics';
    el.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };

  const leaves = [...myLeaves].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 10 }}>
        {LEAVE_TYPES.map(([label, total]) => {
          const C = LEAVE_COLORS[label] || ['#5B6478', '#EEF1F5'];
          const u = used(label);
          const lft = Math.max(0, total - u);
          const low = total && lft / total <= 0.25;
          return (
            <div key={label} style={{ borderRadius: 12, border: '1px solid #DDE3EB', borderTop: '3px solid ' + C[0], background: '#fff', padding: '10px 13px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#5B6478' }}>{label}</span>
              <span style={{ fontFamily: 'ui-serif, Georgia, serif', fontSize: 19, fontWeight: 700, color: low ? '#B23A2E' : '#16223A' }}>
                {total ? lft : u} <span style={{ fontSize: 10.5, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#5B6478' }}>{total ? 'of ' + total + ' days left' : label === 'Unpaid' ? 'days taken' : 'taken · subject to approval'}</span>
              </span>
              <div style={{ height: 5, borderRadius: 3, background: C[1] }}><div style={{ height: 5, borderRadius: 3, background: C[0], width: (total ? Math.round((lft / total) * 100) : 0) + '%' }} /></div>
            </div>
          );
        })}
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}><strong style={cardTitle}>My leave</strong></div>
          {!leaves.length && <div style={{ padding: '8px 14px', fontSize: 11, color: '#5B6478', borderBottom: '1px solid #F0F2F5' }}>No leave applications yet.</div>}
          {leaves.map((l) => {
            const st = statusLabel(l.status);
            const why = l.pic ? 'PIC: ' + l.pic : l.reason;
            const canCal = l.status === 'Approved' || l.status === 'Pending';
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 44px 170px', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#16223A' }}>{ddmmyyyy(l.startDate) + (l.endDate && l.endDate !== l.startDate ? ' – ' + ddmmyyyy(l.endDate) : '') + (l.days === 0.5 ? ' (½)' : '')}</span>
                <span style={{ fontSize: 11, color: '#5B6478' }}>{l.leaveType}{why ? ' · ' + why : ''}</span>
                <span style={{ fontSize: 11, color: '#16223A' }}>{l.days}d</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: st === 'Approved' ? '#E6EFE9' : st === 'Waiting' ? '#FBF2E9' : '#FBEDE9', color: st === 'Approved' ? '#2F6F4E' : st === 'Waiting' ? '#8A6534' : '#B23A2E' }}>{st}</span>
                  {canCal && <button type="button" onClick={() => addCal(l)} title="Download to Google / Outlook / Apple calendar" style={{ border: 0, background: 'none', padding: 0, fontSize: 10, fontWeight: 700, color: '#3D6B9C', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ My calendar</button>}
                </span>
              </div>
            );
          })}
        </div>
        <div style={card}>
          <div style={{ padding: '10px 14px', background: '#16223A' }}><strong style={{ fontSize: 13, color: '#fff' }}>Apply for leave</strong></div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={labelWrap}><span style={LBL}>Type of leave</span>
              <select value={lv.type} onChange={(ev) => { setL({ type: ev.target.value, mc: '' }); setMcFile(null); }} style={INP}>
                {LEAVE_TYPES.map(([t]) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 10.5, lineHeight: 1.45, color: '#5B6478' }}>{T0[3]}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <label style={labelWrap}><span style={LBL}>From</span><input type="date" value={lv.from} onChange={(ev) => { const v = ev.target.value; setL({ from: v, to: lv.to && lv.to < v ? v : lv.to }); }} style={INP} /></label>
              <label style={labelWrap}><span style={LBL}>To</span><input type="date" value={lv.to} min={lv.from} onChange={(ev) => setL({ to: ev.target.value })} style={INP} /></label>
            </div>
            {oneDay && (
              <div style={{ display: 'flex', gap: 4 }}>
                {HALVES.map((label) => (
                  <button key={label} type="button" onClick={() => setL({ half: label })} style={{ flex: 1, borderRadius: 6, padding: '5px 8px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (lv.half === label ? '#16223A' : '#DDE3EB'), background: lv.half === label ? '#16223A' : '#fff', color: lv.half === label ? '#fff' : '#16223A' }}>{label}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: '#F6F8FA', padding: '8px 10px' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{rangeLabel}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{daysLabel}</span>
            </div>
            {needMc && (
              <div
                onDragOver={(ev) => { ev.preventDefault(); if (!dragOn) setDragOn(true); }}
                onDragLeave={() => setDragOn(false)}
                onDrop={(ev) => { ev.preventDefault(); const f0 = ev.dataTransfer.files && ev.dataTransfer.files[0]; setDragOn(false); pickMc(f0); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1.5px dashed ' + (dragOn ? '#16223A' : '#C9D3E0'), borderRadius: 8, background: dragOn ? '#EEF3F9' : '#FAFBFC', padding: '9px 11px' }}
              >
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16223A' }}>{mcLabel}: drop here</span>
                  <span style={{ fontSize: 10.5, color: lv.mc ? '#2F6F4E' : '#5B6478' }}>{lv.mc || 'photo or PDF, up to 10 MB'}</span>
                  <span style={{ fontSize: 10, color: storage.startsWith('Uploads blocked') ? '#B23A2E' : '#5B6478' }}>{storage}</span>
                </span>
                <label style={{ marginLeft: 'auto', border: '1px solid #DDE3EB', borderRadius: 6, padding: '5px 10px', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  or choose file<input type="file" accept="image/*,.pdf" onChange={(ev) => { const f0 = ev.target.files && ev.target.files[0]; ev.target.value = ''; pickMc(f0); }} style={{ display: 'none' }} />
                </label>
              </div>
            )}
            <label style={labelWrap}><span style={LBL}>PIC covering my files</span>
              <select value={lv.pic} onChange={(ev) => setL({ pic: ev.target.value })} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', fontFamily: 'inherit', outline: 'none' }}>
                <option value="">Choose a colleague…</option>
                {colleagues.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: wc }}>{warn}</span>
            <button type="button" disabled={busy} onClick={() => { void submit(); }} style={{ border: 0, borderRadius: 6, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, background: '#16223A', color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>{busy ? 'Uploading…' : 'Send to partner'}</button>
            <span style={{ fontSize: 10, lineHeight: 1.45, color: '#5B6478' }}>{rule ? 'Approved by ' + rule.label + '. ' : ''}Once approved, it goes on the firm calendar so partners and your PIC can see it. You can add it to your own Google / Outlook calendar from “My leave”.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
