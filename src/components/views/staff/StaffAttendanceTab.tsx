import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { AttendanceRecord } from '../../../types';
import { card, cardTitle, ddmmyyyy, dMonY, isoOf, labelWrap, serif, todayIso } from './staffPortalShared';

type Status = AttendanceRecord['status'];
const STATUSES: [Status, string][] = [
  ['Present', 'In the office'],
  ['Remote', 'Working remotely / court / site'],
  ['Late', 'In, but after the usual start time'],
  ['Leave', 'On leave today'],
  ['Absent', 'Not working today'],
];
const WORKING: Status[] = ['Present', 'Remote', 'Late'];
const SC: Record<Status, [string, string]> = {
  Present: ['#E6EFE9', '#2F6F4E'], Remote: ['#E7EEF6', '#2F5680'], Late: ['#FBF2E9', '#8A6534'], Leave: ['#F1EBF6', '#6B3D8C'], Absent: ['#FBEDE9', '#B23A2E'],
};
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const INP: React.CSSProperties = { border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const HIST = '110px 90px 70px 70px 60px minmax(0,1fr)';

const pad = (n: number) => String(n).padStart(2, '0');
const nowHm = () => {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};
/** Minutes since midnight from '09:05', '9:05 am' or '05:30 pm'. */
const minutesOf = (t?: string) => {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?/i);
  if (!m) return null;
  let h = Number(m[1]) % 24;
  const ap = (m[3] || '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12;
  if (ap.startsWith('a') && h === 12) h = 0;
  return h * 60 + Number(m[2]);
};
const hoursOf = (r: AttendanceRecord) => {
  const a = minutesOf(r.checkIn);
  const b = minutesOf(r.checkOut);
  if (a === null || b === null || b <= a) return '';
  const m = b - a;
  return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
};

const Pill: React.FC<{ s: Status }> = ({ s }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: SC[s][0], color: SC[s][1], whiteSpace: 'nowrap' }}>{s}</span>
);

export const StaffAttendanceTab: React.FC = () => {
  const { currentUser, users, isAdmin, attendanceRecords, addAttendanceRecord, leaveApplications, deleteAttendanceRecord } = useApp();
  const admin = Boolean(isAdmin || currentUser.isSuperAdmin);
  const today = todayIso();
  const all = attendanceRecords || [];

  const mine = useMemo(() => all.filter((r) => r.userId === currentUser.id), [all, currentUser.id]);
  // Newest record for today wins if a day somehow has more than one.
  const rec = mine.filter((r) => r.date === today).sort((a, b) => b.id.localeCompare(a.id))[0];
  const [pick, setPick] = useState<Status>(rec?.status || 'Present');
  const [note, setNote] = useState('');
  const status = pick;
  const working = WORKING.includes(status);

  const since = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return isoOf(d);
  })();
  const history = mine.filter((r) => r.date >= since && r.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const count = (s: Status) => history.filter((r) => r.status === s).length;

  const save = (patch: Partial<AttendanceRecord>) => {
    const base: AttendanceRecord = rec || { id: 'ATT-' + Date.now(), userId: currentUser.id, date: today, checkIn: '', status };
    addAttendanceRecord({ ...base, ...patch });
  };
  const noteOf = () => note.trim() || rec?.notes || undefined;

  const clockIn = () => {
    save({ status, checkIn: nowHm(), checkOut: undefined, notes: noteOf() || undefined });
    setNote('');
  };
  const clockOut = () => {
    save({ checkOut: nowHm(), notes: noteOf() });
    setNote('');
  };
  const recordDay = () => {
    save({ status, checkIn: working ? rec?.checkIn || nowHm() : '', checkOut: working ? rec?.checkOut : undefined, notes: noteOf() });
    setNote('');
  };

  // What the main button does, based on today's record.
  let action: { label: string; run: () => void } | null = null;
  if (!rec) action = working ? { label: 'Clock in · ' + status, run: clockIn } : { label: 'Record ' + status.toLowerCase() + ' for today', run: recordDay };
  else if (rec.status !== status) action = { label: 'Change today to ' + status, run: recordDay };
  else if (WORKING.includes(rec.status) && !rec.checkOut) action = { label: 'Clock out', run: clockOut };

  const todayLine = !rec
    ? 'Not recorded yet'
    : WORKING.includes(rec.status)
      ? (rec.checkIn ? 'In ' + rec.checkIn : 'In —') + (rec.checkOut ? ' · Out ' + rec.checkOut + (hoursOf(rec) ? ' · ' + hoursOf(rec) : '') : ' · not clocked out')
      : 'Recorded as ' + rec.status.toLowerCase();

  /* ---------------- admin: everyone on a date ---------------- */
  const [day, setDay] = useState(today);
  const team = useMemo(() => users.filter((u) => u.role !== 'Client' && u.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)), [users]);
  const dayRows = team.map((u) => {
    const r = all.filter((x) => x.userId === u.id && x.date === day).sort((a, b) => b.id.localeCompare(a.id))[0];
    const lv = (leaveApplications || []).find((l) => l.userId === u.id && l.status === 'Approved' && l.startDate <= day && (l.endDate || l.startDate) >= day);
    return { u, r, lv };
  });
  const recorded = dayRows.filter((x) => x.r).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
            <strong style={cardTitle}>My attendance</strong>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>last 30 days</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {STATUSES.map(([s]) => count(s) > 0 && (
                <span key={s} style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: SC[s][0], color: SC[s][1] }}>{count(s) + ' ' + s.toLowerCase()}</span>
              ))}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: HIST, gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478', background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Date</span><span>Status</span><span>In</span><span>Out</span><span>Hours</span><span>Note</span>
          </div>
          {!history.length && <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#5B6478', borderBottom: '1px solid #F0F2F5' }}>No attendance recorded in the last 30 days.</div>}
          {history.map((r) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: HIST, gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #F0F2F5', background: r.date === today ? '#F6F8FA' : '#fff' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{ddmmyyyy(r.date)}</span>
              <span><Pill s={r.status} /></span>
              <span style={{ fontSize: 11.5, color: '#16223A' }}>{r.checkIn || '—'}</span>
              <span style={{ fontSize: 11.5, color: '#16223A' }}>{r.checkOut || '—'}</span>
              <span style={{ fontSize: 11, color: '#5B6478' }}>{hoursOf(r) || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={{ fontSize: 11, color: '#5B6478', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || ''}</span>{admin && <button type="button" title="Delete this entry (e.g. a test)" onClick={() => { if (window.confirm('Delete the attendance entry for ' + ddmmyyyy(r.date) + '?')) deleteAttendanceRecord(r.id); }} style={{ marginLeft: 'auto', flexShrink: 0, border: 0, background: 'none', padding: 0, fontSize: 10, fontWeight: 700, color: '#8E2A20', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}</span>
            </div>
          ))}
          <div style={{ padding: '9px 14px', background: '#F6F8FA', fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>Times are taken from this device’s clock when you press the button.</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#16223A' }}>
            <strong style={{ fontSize: 13, color: '#fff' }}>Today · {dMonY(today)}</strong>
            {rec && <span style={{ marginLeft: 'auto' }}><Pill s={rec.status} /></span>}
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: '#F6F8FA', padding: '9px 10px' }}>
              <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: '#16223A' }}>{todayLine}</span>
            </div>
            <span style={LBL}>Status</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {STATUSES.map(([s, sub]) => (
                <button key={s} type="button" onClick={() => setPick(s)} style={{ display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', border: '1px solid ' + (status === s ? '#16223A' : '#DDE3EB'), borderRadius: 6, padding: '6px 9px', background: status === s ? '#F6F8FA' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 'none', width: 12, height: 12, borderRadius: 9999, border: '1.5px solid #16223A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 9999, background: status === s ? '#16223A' : 'transparent' }} />
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{s}</span>
                  <span style={{ fontSize: 10.5, color: '#5B6478' }}>{sub}</span>
                </button>
              ))}
            </div>
            <label style={labelWrap}>
              <span style={LBL}>Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={rec?.notes || 'e.g. Shah Alam High Court in the morning'} style={INP} />
            </label>
            {action ? (
              <button type="button" onClick={action.run} style={{ border: 0, borderRadius: 6, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{action.label}</button>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2F6F4E' }}>Today is fully recorded.</span>
            )}
            {rec && rec.status === status && WORKING.includes(rec.status) && rec.checkOut && (
              <button type="button" onClick={clockOut} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>Update clock-out to now</button>
            )}
            <span style={{ fontSize: 10, lineHeight: 1.45, color: '#5B6478' }}>Clock in when you start and clock out when you leave. On leave or not working? Pick Leave or Absent and record the day.</span>
          </div>
        </div>
      </div>

      {admin && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
            <strong style={cardTitle}>Team attendance</strong>
            <span style={{ fontSize: 10.5, color: '#5B6478' }}>{recorded + ' of ' + team.length + ' recorded · admins only'}</span>
            <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} style={{ ...INP, width: 150, marginLeft: 'auto', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) 100px 70px 70px 60px minmax(0,1fr)', gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478', background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Staff</span><span>Status</span><span>In</span><span>Out</span><span>Hours</span><span>Note</span>
          </div>
          {!team.length && <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#5B6478' }}>No active staff accounts.</div>}
          {dayRows.map(({ u, r, lv }) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) 100px 70px 70px 60px minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{u.name}</span>
                <span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>{[u.staffProfile?.staffId, u.staffProfile?.designation || u.role].filter(Boolean).join(' · ')}</span>
              </span>
              <span>{r ? <Pill s={r.status} /> : <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Not recorded</span>}</span>
              <span style={{ fontSize: 11.5, color: '#16223A' }}>{r?.checkIn || '—'}</span>
              <span style={{ fontSize: 11.5, color: '#16223A' }}>{r?.checkOut || '—'}</span>
              <span style={{ fontSize: 11, color: '#5B6478' }}>{r ? hoursOf(r) || '—' : '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: '#5B6478', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[r?.notes, lv ? 'Approved ' + lv.leaveType.toLowerCase() + ' leave' : ''].filter(Boolean).join(' · ')}</span>
                {admin && r && <button type="button" title="Delete this entry (e.g. a test)" onClick={() => { if (window.confirm('Delete the attendance entry for ' + ddmmyyyy(r.date) + '?')) deleteAttendanceRecord(r.id); }} style={{ marginLeft: 'auto', flexShrink: 0, border: 0, background: 'none', padding: 0, fontSize: 10, fontWeight: 700, color: '#8E2A20', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
