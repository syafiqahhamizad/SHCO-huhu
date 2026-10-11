import React, { useState } from 'react';
import { PeoplePicker } from '../PeoplePicker';
import type { CourtDiaryEntry, Hearing, MatterCourtChange, MatterParty, Task } from '../../../../types';
import { css, S, Card, Field } from '../caseUi';
import { COURT_LEVELS, P, courtOf, daysFrom, fmt, isoOf, legacyFromParties, short, stagesFor, stageIndexOf, practiceOf, todayIso } from '../caseModel';
import { histEntry, newId, prepUpdate, type WF } from '../wf';
import { autoSend, isCourtDiaryConfigured } from '../clientComms';

const R = {
  coram: ['Transferred to another judge / registrar', 'Judge / registrar retired or promoted', 'Case moved to another court'],
  sol: ['Notice of change of solicitors filed', 'Opposing party now acting in person', 'Firm merged / renamed'],
};

const printMemo = (m: CourtDiaryEntry, ref: string, title: string) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const e = (s: string) => String(s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  const rows: [string, string][] = [['Court date', fmt(m.date)], ['Medium', m.medium || ''], ['Coram', m.corum], ['Our lawyer', m.ourLawyerAttendance], ['Opponent counsel', m.opponentCounselAttendance], ['Client', m.clientAttendance], ['Court directions', m.courtDirections], ['Instructions / notes', m.instructions], ['Next court date', fmt(m.nextDate)], ['Task from memo', m.tasks]];
  win.document.write(`<html><head><title>Court memo ${e(fmt(m.date))}</title><style>body{font-family:Inter,Arial,sans-serif;color:#16223A;padding:40px}h1{font-family:Georgia,serif;font-size:16px;letter-spacing:.06em;margin:0}.k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468}.v{font-size:13px;line-height:1.45;margin-top:3px}.g{display:grid;grid-template-columns:1fr 1fr;border:1px solid #16223A;border-radius:6px}.c{padding:9px 14px;border-bottom:1px solid #EEF1F5;border-right:1px solid #EEF1F5}.h{display:flex;align-items:center;border-bottom:2px solid #16223A;padding:12px 0;margin-bottom:12px}</style></head><body><div class="h"><div><h1>SYAFIQAH HAMIZAD &amp; CO</h1><div class="k" style="color:#8A6D3B;letter-spacing:.12em">COURT MEMO</div></div><div style="margin-left:auto;font-family:ui-monospace,monospace;font-weight:700">${e(ref)}</div></div><div class="v" style="margin-bottom:12px">${e(title)}</div><div class="g">${rows.map(([k, v]) => `<div class="c"><div class="k">${e(k)}</div><div class="v">${e(v)}</div></div>`).join('')}</div></body></html>`);
  win.document.close();
  win.focus();
  win.print();
};

export const CourtTab: React.FC<{ w: WF }> = ({ w }) => {
  const { c, parties, staff, ro } = w;
  const court = courtOf(c);
  const sols = parties.filter((p) => p.side === 'solicitor' && !p.dischargedOn);
  const today = todayIso();

  /* ---------- court details ---------- */
  const [cd, setCd] = useState<null | { level: string; loc: string; div: string; suit: string; addr: string }>(null);
  const saveCd = () => {
    if (!cd) return;
    const before = [court.level, court.location, court.division, court.suit, court.address];
    const after = [cd.level, cd.loc, cd.div, cd.suit, cd.addr];
    const changed = after.some((v, i) => (v || '') !== (before[i] || ''));
    const change: MatterCourtChange | null = changed ? { id: newId('CC'), date: today, field: 'Court details', from: before.filter(Boolean).join(', ') || '—', to: after.filter(Boolean).join(', ') || '—', reason: 'Edited', by: w.me } : null;
    w.save({
      courtDetails: { ...(c.courtDetails || {}), level: cd.level || undefined, location: cd.loc || undefined, division: cd.div || undefined, address: cd.addr || undefined },
      court: [cd.level, cd.loc].filter(Boolean).join(' ') || c.court,
      courtCaseNo: cd.suit || undefined,
      ...(change ? { courtChanges: [change, ...(c.courtChanges || [])] } : {}),
    }, changed ? 'Court details edited' : undefined);
    setCd(null);
    w.toast('Court details saved');
  };

  /* ---------- coram / solicitor change ---------- */
  const chg = w.courtChange;
  const [cg, setCg] = useState({ name: '', date: today, why: '', sub: '', repl: '' });
  const repl = cg.repl || (sols[0] ? sols[0].id : '__add');
  const replP = sols.find((p) => p.id === repl);
  const openChg = (k: 'coram' | 'sol') => { setCg({ name: '', date: today, why: R[k][0], sub: '', repl: '' }); w.setCourtChange(k); };
  React.useEffect(() => { if (chg && !cg.why) setCg((s) => ({ ...s, why: R[chg][0] })); }, [chg, cg.why]);
  const saveChg = () => {
    if (!chg) return;
    const why = cg.why || R[chg][0];
    const selfRep = chg === 'sol' && why === 'Opposing party now acting in person';
    if (!cg.name.trim() && !selfRep) { w.toast('Add the new ' + (chg === 'sol' ? 'firm' : 'judge / registrar')); return; }
    const to = selfRep ? 'Acting in person' : cg.name.trim();
    const from = chg === 'sol' ? (replP ? replP.name : 'Acting in person') : court.coram || '—';
    const entry: MatterCourtChange = { id: newId('CC'), date: cg.date, field: chg === 'sol' ? 'Opp. solicitors' : 'Coram', from, to, reason: why, by: w.me };
    if (chg === 'coram') {
      w.save({ judge: to, courtDetails: { ...(c.courtDetails || {}), coramSince: cg.date }, courtChanges: [entry, ...(c.courtChanges || [])] }, 'Coram changed to ' + to + ' (' + why + ')');
    } else {
      const next: MatterParty[] = parties.map((p) => (replP && p.id === replP.id ? { ...p, dischargedOn: cg.date } : p));
      if (!selfRep) next.push({ id: newId('PTY'), side: 'solicitor', name: to, role: replP ? replP.role : 'Counsel on record', actsFor: replP?.actsFor, contact: cg.sub.trim(), since: cg.date });
      w.save({ ...legacyFromParties(next, c), courtChanges: [entry, ...(c.courtChanges || [])], opposingSolicitorsHistory: replP ? [{ id: newId('OSH'), firmName: replP.name, effectiveDate: cg.date, remarks: why }, ...(c.opposingSolicitorsHistory || [])] : c.opposingSolicitorsHistory }, 'Opposing solicitors changed: ' + from + ' → ' + to + ' (' + why + ')');
    }
    w.setCourtChange('');
    w.toast((chg === 'sol' ? 'Opposing solicitors' : 'Coram') + ' changed to ' + to);
  };
  const chgLog = [
    ...(c.courtChanges || []),
    ...(c.opposingSolicitorsHistory || []).filter((h) => !(c.courtChanges || []).some((x) => x.field === 'Opp. solicitors' && x.from === h.firmName)).map((h) => ({ id: h.id, date: h.effectiveDate, field: 'Opp. solicitors' as const, from: h.firmName, to: '—', reason: h.remarks || '' })),
  ].sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));

  /* ---------- court diary (Google Calendar) ---------- */
  const diaryOn = isCourtDiaryConfigured();
  // Hearings and next court dates go to the firm calendar (SHCO HQ) by themselves (useCalendarAutoSync).
  const CalNote: React.FC<{ label: string }> = ({ label }) => (
    <span title={diaryOn ? 'Synced automatically, both ways' : 'Set up the court diary in Firm Settings'} style={css('display:flex;align-items:center;gap:8px;border:1px solid #DDE3EB;border-radius:8px;padding:7px 11px;font-size:12.5px;font-weight:600;background:#F6F8FA;color:' + (diaryOn ? '#2F6F4E' : '#94A3B8'))}>{diaryOn ? '✓ ' + label : label + ' (set up the firm calendar in Firm Settings)'}</span>
  );

  /* ---------- hearings ---------- */
  const [hOpen, setHOpen] = useState(false);
  const blankH = { purpose: '', date: '', time: '09:00', attend: 'Not Required' as NonNullable<Hearing['clientAttendanceRequired']>, remind: '3', cal: true, status: 'Scheduled' as Hearing['status'], outcome: '' };
  const [hf, setHf] = useState(blankH);
  const [editH, setEditH] = useState<string | null>(null);
  const nextOf = (list: Hearing[]) => list.filter((x) => daysFrom(x.date) >= 0 && x.status === 'Scheduled').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  const startEditH = (h: Hearing) => {
    setEditH(h.id);
    setHf({ purpose: h.purpose, date: isoOf(h.date), time: h.time || '09:00', attend: h.clientAttendanceRequired || 'Not Required', remind: String(h.remindDaysBefore ?? 3), cal: false, status: h.status, outcome: h.outcome || '' });
    setHOpen(true);
  };
  const deleteH = (h: Hearing) => {
    if (!window.confirm('Delete the hearing on ' + fmt(h.date) + '?' )) return;
    const hearings = (c.hearings || []).filter((x) => x.id !== h.id);
    const up = nextOf(hearings);
    w.save({ hearings, nextHearing: up ? up.date : undefined }, 'Hearing deleted: ' + h.purpose + ' on ' + fmt(h.date), 'Court Event');
    if (editH === h.id) { setEditH(null); setHOpen(false); }
    w.toast('Hearing deleted');
  };
  const saveH = () => {
    if (!hf.purpose.trim() || !hf.date) { w.toast('Add a purpose and date'); return; }
    if (editH) {
      const hearings = (c.hearings || []).map((x) => (x.id === editH ? { ...x, purpose: hf.purpose.trim(), date: hf.date, time: hf.time, status: hf.status, outcome: hf.outcome.trim(), clientAttendanceRequired: hf.attend, remindDaysBefore: Number(hf.remind) } : x));
      const up = nextOf(hearings);
      w.save({ hearings, nextHearing: up ? up.date : undefined }, 'Hearing edited: ' + hf.purpose.trim() + ' on ' + fmt(hf.date), 'Court Event');
      setEditH(null); setHf(blankH); setHOpen(false);
      w.toast('Hearing updated. The firm calendar follows by itself');
      return;
    }
    const h: Hearing = { id: newId('H'), purpose: hf.purpose.trim(), date: hf.date, time: hf.time, status: 'Scheduled', outcome: '', clientAttendanceRequired: hf.attend, remindDaysBefore: Number(hf.remind), addedBy: w.me, addedAt: today };
    const hearings = [...(c.hearings || []), h];
    const upcoming = hearings.filter((x) => daysFrom(x.date) >= 0 && x.status === 'Scheduled').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
    w.save({ hearings, ...(upcoming ? { nextHearing: upcoming.date } : {}) }, 'Hearing added: ' + h.purpose + ' on ' + fmt(h.date), 'Court Event');
    setHf({ ...blankH, cal: hf.cal });
    setHOpen(false);
    w.toast('Hearing saved. It shows in My Work for the team');
  };
  const hs = [...(c.hearings || [])].sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));

  /* ---------- court memos ---------- */
  const ourDefault = w.me;
  const oppDefault = sols.map((p) => p.name).join(', ');
  const blankM = () => ({ cal: true, date: today, coram: court.coram, medium: 'IN CHAMBERS' as NonNullable<CourtDiaryEntry['medium']>, ours: ourDefault, opp: oppDefault, client: 'Not Present' as CourtDiaryEntry['clientAttendance'], dir: '', instr: '', next: '', task: '', taskWho: w.me, taskDue: '', remind: '3' });
  const [mOpen, setMOpen] = useState(false);
  const [mf, setMf] = useState(blankM);
  const [view, setView] = useState<string | null>(null);
  const [editM, setEditM] = useState<string | null>(null);
  const startEditM = (m: CourtDiaryEntry) => {
    setEditM(m.id);
    setMf({ ...blankM(), cal: false, date: isoOf(m.date), coram: m.corum || '', medium: m.medium || 'IN CHAMBERS', ours: m.ourLawyerAttendance || '', opp: m.opponentCounselAttendance || '', client: m.clientAttendance, dir: m.courtDirections || '', instr: m.instructions || '', next: m.nextDate ? isoOf(m.nextDate) : '', task: '', remind: String(m.remindDaysBefore ?? 3) });
    setMOpen(true);
  };
  const deleteM = (m: CourtDiaryEntry) => {
    if (!window.confirm('Delete the court memo for ' + fmt(m.date) + '? The hearing it added (if any) stays in Hearings; delete it there if needed.')) return;
    w.save({ courtDiary: (c.courtDiary || []).filter((x) => x.id !== m.id), activityLogs: [histEntry('Court memo deleted for ' + fmt(m.date), w.me, 'Court Event'), ...(c.activityLogs || [])] });
    if (view === m.id) setView(null);
    if (editM === m.id) { setEditM(null); setMOpen(false); }
    w.toast('Court memo deleted');
  };
  const saveM = () => {
    if (!mf.dir.trim()) { w.toast('Add the court directions'); return; }
    if (editM) {
      const was = (c.courtDiary || []).find((x) => x.id === editM);
      const courtDiary = (c.courtDiary || []).map((x) => (x.id === editM ? { ...x, date: mf.date, corum: mf.coram, medium: mf.medium, ourLawyerAttendance: mf.ours, opponentCounselAttendance: mf.opp, clientAttendance: mf.client, courtDirections: mf.dir.trim(), instructions: mf.instr.trim(), nextDate: mf.next, remindDaysBefore: mf.next ? Number(mf.remind) : undefined } : x));
      // A new or changed next date is added to Hearings (the old one stays; delete it there if wrong).
      const newNext = mf.next && mf.next !== (was?.nextDate ? isoOf(was.nextDate) : '');
      const nextH: Hearing | null = newNext ? { id: newId('H'), purpose: 'Next court date', date: mf.next, time: '09:00', status: 'Scheduled', outcome: '', clientAttendanceRequired: 'Not Required', source: 'Court memo ' + short(mf.date), remindDaysBefore: Number(mf.remind), addedBy: w.me, addedAt: today } : null;
      const hearings = nextH ? [...(c.hearings || []), nextH] : c.hearings || [];
      const up = nextOf(hearings);
      w.save({ courtDiary, ...(nextH ? { hearings, nextHearing: up ? up.date : undefined } : {}), activityLogs: [histEntry('Court memo edited for ' + fmt(mf.date), w.me, 'Court Event'), ...(c.activityLogs || [])] });
      setEditM(null); setMOpen(false); setMf(blankM()); setView(editM);
      w.toast('Court memo updated' + (nextH ? '. New next date added to Hearings' : ''));
      return;
    }
    const first = parties.find((p) => p.side === 'client' && !p.dischargedOn);
    const stages = stagesFor(practiceOf(c));
    let task: Task | null = null;
    if (mf.task.trim()) {
      task = { id: newId('T'), title: mf.task.trim(), priority: 'High', status: 'Not Started', dueDate: mf.taskDue || mf.next || mf.date, assignedTo: mf.taskWho, taskType: 'Standard', kind: 'Task', source: 'Court memo ' + fmt(mf.date), createdBy: w.me, createdAt: today };
    }
    const memo: CourtDiaryEntry = {
      id: newId('CM'), date: mf.date, caseNo: court.suit, court: court.name, matter: 'Court memo', corum: mf.coram || court.coram, medium: mf.medium,
      ourLawyerAttendance: mf.ours, opponentCounselAttendance: mf.opp, clientName: first?.name, clientAttendance: mf.client, opponentAttendance: mf.opp ? 'Present' : 'Not Present',
      caseStatus: stages[stageIndexOf(c)], instructions: mf.instr.trim(), courtDirections: mf.dir.trim(), nextDate: mf.next, tasks: mf.task.trim(), links: '',
      remindDaysBefore: mf.next ? Number(mf.remind) : undefined, taskId: task?.id, recordedBy: w.me, recordedAt: today,
    };
    let hearings = (c.hearings || []).map((h) => (isoOf(h.date) === mf.date && h.status === 'Scheduled' ? { ...h, status: 'Completed' as const, outcome: mf.dir.trim() } : h));
    const nextH: Hearing | null = mf.next ? { id: newId('H'), purpose: 'Next court date', date: mf.next, time: '09:00', status: 'Scheduled', outcome: '', clientAttendanceRequired: 'Not Required', source: 'Court memo ' + short(mf.date), remindDaysBefore: Number(mf.remind), addedBy: w.me, addedAt: today } : null;
    if (nextH) hearings = [...hearings, nextH];
    const auto = c.clientUpdatesAuto !== false;
    const up = mf.next && auto ? prepUpdate({ trigger: 'AUTO_COURT_DATE', title: 'Next court date: ' + fmt(mf.next), message: 'Dear ' + (first?.name || 'client') + ', an update on your case' + (court.suit ? ' (' + court.suit + ')' : '') + ': the next court date is ' + fmt(mf.next) + '. We will tell you if you need to attend. ' + w.me + ', Syafiqah Hamizad & Co.' }, w.me) : null;
    const upcoming = hearings.filter((x) => daysFrom(x.date) >= 0 && x.status === 'Scheduled').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
    w.save({
      courtDiary: [memo, ...(c.courtDiary || [])],
      hearings,
      ...(upcoming ? { nextHearing: upcoming.date } : {}),
      ...(task ? { tasks: [...(c.tasks || []), task] } : {}),
      ...(up ? { clientUpdates: [up, ...(c.clientUpdates || [])] } : {}),
      activityLogs: [histEntry('Court memo saved for ' + fmt(mf.date) + (mf.next ? '. Next date ' + fmt(mf.next) : ''), w.me, 'Court Event'), ...(c.activityLogs || [])],
    });
    setMOpen(false);
    setMf(blankM());
    setView(memo.id);
    w.toast('Court memo saved' + (task ? '. Task added to ' + mf.taskWho + "'s My Work" : '') + (mf.next ? '. Next date added to Hearings' : '') + (up ? '. Client update prepared: send it from Client updates' : ''));
    if (up) void autoSend(w, up, first?.email);
  };
  const memos = [...(c.courtDiary || [])].sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));
  const vm = memos.find((m) => m.id === view);

  const facts = [
    { k: 'Court', v: court.name || 'Not set', since: court.address },
    { k: 'Division / court no.', v: court.division || '—', since: '' },
    { k: 'Suit no.', v: court.suit || '—', since: '' },
    { k: 'Coram (judge / registrar)', v: court.coram || 'Not recorded', since: court.coramSince ? 'Since ' + fmt(court.coramSince) : '', change: () => openChg('coram') },
    { k: 'Opp. solicitors', v: sols.length ? sols.map((p) => p.name + ' (' + p.role.replace(/^For\s+/i, '') + ')').join('\n') : 'None on record', since: sols.length + ' firm(s) on record', change: () => openChg('sol') },
  ];

  return (
    <>
      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Court details</strong>{!ro && <button type="button" onClick={() => setCd({ level: court.level, loc: court.location, div: court.division, suit: court.suit, addr: court.address })} style={css('margin-left:auto;' + S.btnSec)}>Edit court details</button>}</div>
        {cd && (
          <div style={css(S.formGrid(200))}>
            <Field label="Court level"><select value={cd.level} onChange={(e) => setCd({ ...cd, level: e.target.value })} style={css(S.input)}><option value="">—</option>{COURT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}{cd.level && !COURT_LEVELS.includes(cd.level) && <option value={cd.level}>{cd.level}</option>}</select></Field>
            <Field label="Location"><input value={cd.loc} onChange={(e) => setCd({ ...cd, loc: e.target.value })} placeholder="e.g. Shah Alam" style={css(S.input)} /></Field>
            <Field label="Division / court no."><input value={cd.div} onChange={(e) => setCd({ ...cd, div: e.target.value })} placeholder="e.g. NCvC 3" style={css(S.input)} /></Field>
            <Field label="Suit no."><input value={cd.suit} onChange={(e) => setCd({ ...cd, suit: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Court address" span="span 2"><input value={cd.addr} onChange={(e) => setCd({ ...cd, addr: e.target.value })} style={css(S.input)} /></Field>
            <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => setCd(null)} style={css(S.btnSec)}>Cancel</button><button type="button" onClick={saveCd} style={css(S.btnPri)}>Save</button></div>
          </div>
        )}
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;padding:14px 16px')}>
          {facts.map((f) => (
            <div key={f.k} style={css('display:flex;flex-direction:column;gap:4px;min-width:0')}>
              <div style={css('display:flex;align-items:center;gap:8px;min-height:22px')}><span style={css(S.label)}>{f.k}</span>{f.change && !ro && <button type="button" onClick={f.change} style={css(S.btnSm)}>Change</button>}</div>
              <span style={css('font-size:13px;font-weight:600;color:#16223A;line-height:1.4;white-space:pre-line')}>{f.v}</span>
              {f.since && <span style={css('font-size:11.5px;color:#4A5468')}>{f.since}</span>}
            </div>
          ))}
        </div>
        {chg && (
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;padding:14px 16px;background:#F6F8FA;border-top:1px solid #EEF1F5')}>
            <strong style={css('grid-column:1/-1;font-size:13px;color:#16223A')}>{chg === 'sol' ? 'Change opposing solicitors' : 'Change coram'}</strong>
            <Field label={'New ' + (chg === 'sol' ? 'firm' : 'judge / registrar')}><input value={cg.name} onChange={(e) => setCg({ ...cg, name: e.target.value })} placeholder={chg === 'sol' ? 'e.g. Messrs. Ravi & Co' : "e.g. YA Dato' Hakim Abdullah"} style={css(S.input)} /></Field>
            <Field label="Effective from"><input type="date" value={cg.date} onChange={(e) => setCg({ ...cg, date: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Reason"><select value={cg.why || R[chg][0]} onChange={(e) => setCg({ ...cg, why: e.target.value })} style={css(S.input)}>{R[chg].map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
            {chg === 'sol' && <Field label="Replacing"><select value={repl} onChange={(e) => setCg({ ...cg, repl: e.target.value })} style={css(S.input)}>{sols.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}<option value="__add">None. Add another firm</option></select></Field>}
            {chg === 'sol' && <Field label="Counsel & contact"><input value={cg.sub} onChange={(e) => setCg({ ...cg, sub: e.target.value })} placeholder="e.g. Mr. Ravi · 03-7788 1122" style={css(S.input)} /></Field>}
            <span style={css('grid-column:1/-1;font-size:12px;color:#4A5468;line-height:1.5')}>{chg === 'sol' ? 'The old firm stays in Parties as discharged. Letters, service and court papers will use the new firm from the effective date.' : 'Past court memos keep the old coram. New memos and hearings will use this one.'}</span>
            <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => w.setCourtChange('')} style={css(S.btnSec)}>Cancel</button><button type="button" onClick={saveChg} style={css(S.btnPri)}>Save change</button></div>
          </div>
        )}
        {chgLog.length > 0 && (
          <div style={css('border-top:1px solid #EEF1F5')}>
            <div style={css('padding:9px 16px;' + S.label)}>Change history</div>
            {chgLog.map((x) => (
              <div key={x.id} style={css('display:grid;grid-template-columns:100px 120px minmax(0,1fr);gap:12px;padding:8px 16px;border-top:1px solid #F0F2F5;font-size:12.5px')}><strong style={css('color:#16223A')}>{fmt(x.date)}</strong><span style={css('color:#4A5468')}>{x.field}</span><span style={css('color:#16223A')}>{x.from} → <strong>{x.to}</strong> <span style={css('color:#4A5468')}>· {x.reason}</span></span></div>
            ))}
          </div>
        )}
      </Card>

      {!ro && (c.calendarFromGoogle || []).length > 0 && (
        <Card>
          <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>From the firm calendar</strong><span style={css(S.sub)}>dates typed straight into Google Calendar that look like this file’s · add them, or ignore</span></div>
          {(c.calendarFromGoogle || []).map((g) => (
            <div key={g.eventId} style={css('display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid #EEF1F5;font-size:12.5px')}>
              <span style={css('min-width:92px;font-weight:700;color:#16223A')}>{fmt(g.date)}{g.time ? ' · ' + g.time : ''}</span>
              <span style={css('flex:1;min-width:0;color:#16223A')}>{g.title}</span>
              <button type="button" onClick={() => {
                const purpose = (g.title.split('|').slice(1).join('|').replace(/[()]/g, '').trim()) || g.title;
                const h: Hearing = { id: newId('H'), purpose, date: g.date, time: g.time || '', status: 'Scheduled', outcome: '', clientAttendanceRequired: 'Not Required', remindDaysBefore: 3, source: 'Google Calendar', googleEventId: g.eventId, addedBy: w.me, addedAt: new Date().toISOString() };
                w.save({ hearings: [...(c.hearings || []), h], calendarFromGoogle: (c.calendarFromGoogle || []).filter((x) => x.eventId !== g.eventId) }, 'Court date added from the firm calendar: ' + purpose + ' on ' + fmt(g.date), 'Court Event');
                w.toast('Added to Hearings. The calendar event is now linked to this file.');
              }} style={css(S.btnPri)}>Add to file</button>
              <button type="button" onClick={() => { w.save({ calendarFromGoogle: (c.calendarFromGoogle || []).filter((x) => x.eventId !== g.eventId), calendarIgnored: [...(c.calendarIgnored || []), g.eventId] }, 'Firm calendar event ignored for this file: ' + g.title); }} style={css('border:1px solid #DDE3EB;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#fff;color:#4A5468;cursor:pointer;font-family:inherit')}>Ignore</button>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Hearings</strong>{!ro && <button type="button" onClick={() => { if (editH) { setEditH(null); setHf(blankH); setHOpen(true); } else setHOpen(!hOpen); }} style={css('margin-left:auto;' + S.btnPri)}>+ Add hearing</button>}</div>
        {hOpen && (
          <div style={css(S.formGrid(150))}>
            <Field label="Purpose" span="1/-1"><input value={hf.purpose} onChange={(e) => setHf({ ...hf, purpose: e.target.value })} placeholder="e.g. Case management, Hearing of application, Trial" style={css(S.input)} /></Field>
            <Field label="Date"><input type="date" value={hf.date} onChange={(e) => setHf({ ...hf, date: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Time"><input type="time" value={hf.time} onChange={(e) => setHf({ ...hf, time: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Client attendance"><select value={hf.attend} onChange={(e) => setHf({ ...hf, attend: e.target.value as typeof hf.attend })} style={css(S.input)}><option value="Not Required">Not required</option><option value="Optional">Optional</option><option value="Compulsory">Compulsory</option></select></Field>
            <Field label="Remind PIC"><select value={hf.remind} onChange={(e) => setHf({ ...hf, remind: e.target.value })} style={css(S.input)}>{['1', '3', '7', '14'].map((d) => <option key={d} value={d}>{d} day{d === '1' ? '' : 's'} before</option>)}</select></Field>
            {editH && <Field label="Status"><select value={hf.status} onChange={(e) => setHf({ ...hf, status: e.target.value as Hearing['status'] })} style={css(S.input)}>{(['Scheduled', 'Completed', 'Adjourned', 'Postponed', 'Cancelled'] as Hearing['status'][]).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>}
            {editH && <Field label="Outcome" span="span 2"><input value={hf.outcome} onChange={(e) => setHf({ ...hf, outcome: e.target.value })} placeholder="What happened" style={css(S.input)} /></Field>}
            <div style={css('grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
              {!editH && <CalNote label="Goes into the firm Google Calendar automatically (team invited)" />}
              {editH && <button type="button" onClick={() => { setEditH(null); setHf(blankH); setHOpen(false); }} style={css('margin-left:auto;' + S.btnSecL)}>Cancel</button>}
              <button type="button" onClick={saveH} style={css((editH ? '' : 'margin-left:auto;') + S.btnPriL)}>{editH ? 'Save changes' : 'Save hearing'}</button>
            </div>
          </div>
        )}
        <div style={css('display:grid;grid-template-columns:110px minmax(0,1fr) 110px 120px;' + S.th)}><span>Date</span><span>Purpose &amp; outcome</span><span>Status</span><span /></div>
        {hs.map((h) => {
          const up = daysFrom(h.date) >= 0 && h.status === 'Scheduled';
          const status = up ? 'Upcoming' : h.status === 'Scheduled' ? 'Done' : h.status;
          const pill = up ? P.b : h.status === 'Adjourned' || h.status === 'Postponed' ? P.a : h.status === 'Cancelled' ? P.r : P.n;
          const sub = [h.outcome || h.hearingReasonNote, h.source, up ? 'Client: ' + (h.clientAttendanceRequired || 'Not required') : ''].filter(Boolean).join(' · ');
          return (
            <div key={h.id} style={css('display:grid;grid-template-columns:110px minmax(0,1fr) 110px 120px;align-items:start;' + S.row)}>
              <div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('color:#16223A')}>{fmt(h.date)}</strong><span style={css('color:#4A5468')}>{h.time}</span></div>
              <div style={css('display:flex;flex-direction:column;gap:3px;min-width:0')}><span style={css('color:#16223A;font-weight:600')}>{h.purpose}</span>{sub && <span style={css('color:#4A5468')}>{sub}</span>}</div>
              <div style={css('display:flex;flex-direction:column;gap:4px;align-items:flex-start')}><span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{status}</span>
                {h.googleEventId ? (h.googleEventLink ? <a href={h.googleEventLink} target="_blank" rel="noopener noreferrer" style={css('font-size:11px;font-weight:600;color:#2F4F7A')}>✓ Google Calendar</a> : <span style={css('font-size:11px;font-weight:600;color:#2F4F7A')}>✓ Google Calendar</span>)
                  : up && diaryOn && !ro ? <span title="Synced automatically with the firm Google Calendar" style={css('font-size:11px;font-weight:600;color:#2F4F7A')}>📅 Firm calendar (auto)</span> : null}
              </div>
              {!ro ? <span style={css('justify-self:end;display:flex;gap:6px')}><button type="button" onClick={() => startEditH(h)} style={css(S.btnSm)}>Edit</button><button type="button" onClick={() => deleteH(h)} style={css(S.btnSm + ';color:#B23A2E')}>Delete</button></span> : <span />}
            </div>
          );
        })}
        {!hs.length && <div style={css(S.empty)}>No hearings on this file yet.</div>}
      </Card>

      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Court memos</strong><span style={css(S.sub)}>Record what happened at each court date. The next date goes to Hearings automatically.</span>{!ro && <button type="button" onClick={() => { if (editM) { setEditM(null); setMf(blankM()); setMOpen(true); } else setMOpen(!mOpen); }} style={css('margin-left:auto;' + S.btnPri)}>+ New court memo</button>}</div>
        {mOpen && (
          <div style={css(S.formGrid(180))}>
            <Field label="Court date"><input type="date" value={mf.date} onChange={(e) => setMf({ ...mf, date: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Coram (judge / registrar)"><input value={mf.coram} onChange={(e) => setMf({ ...mf, coram: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Medium"><select value={mf.medium} onChange={(e) => setMf({ ...mf, medium: e.target.value as typeof mf.medium })} style={css(S.input)}><option value="OPEN COURT">Open court</option><option value="IN CHAMBERS">In chambers</option><option value="E-REVIEW">e-Review</option></select></Field>
            <Field label="Our lawyer attending"><PeoplePicker id="memo-ours" options={staff.filter((p) => p.isPartner || p.role === 'Lawyer').map((p) => ({ value: p.name, label: p.name, hint: p.isPartner ? 'Partner' : 'Lawyer' }))} value={String(mf.ours || '').split(',').map((x) => x.trim()).filter(Boolean)} onChange={(v) => setMf({ ...mf, ours: v.join(', ') })} placeholder="Search partners and lawyers" /></Field>
            <Field label="Opponent counsel"><input value={mf.opp} onChange={(e) => setMf({ ...mf, opp: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Client"><select value={mf.client} onChange={(e) => setMf({ ...mf, client: e.target.value as typeof mf.client })} style={css(S.input)}><option value="Not Present">Not present</option><option value="Present">Present</option></select></Field>
            <Field label="Court directions" span="1/-1"><textarea value={mf.dir} onChange={(e) => setMf({ ...mf, dir: e.target.value })} rows={3} placeholder="What the court ordered or directed" style={css(S.input + ';resize:vertical')} /></Field>
            <Field label="Instructions / notes" span="1/-1"><input value={mf.instr} onChange={(e) => setMf({ ...mf, instr: e.target.value })} placeholder="e.g. Client to hand over originals" style={css(S.input)} /></Field>
            <Field label="Next court date"><input type="date" value={mf.next} onChange={(e) => setMf({ ...mf, next: e.target.value })} style={css(S.input)} /></Field>
            <Field label="Task from this memo (optional)" span="span 2"><input value={mf.task} onChange={(e) => setMf({ ...mf, task: e.target.value })} placeholder="e.g. File written submissions" style={css(S.input)} /></Field>
            <Field label="Task for"><select value={mf.taskWho} onChange={(e) => setMf({ ...mf, taskWho: e.target.value })} style={css(S.input)}>{staff.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}{!staff.some((p) => p.name === mf.taskWho) && <option value={mf.taskWho}>{mf.taskWho}</option>}</select></Field>
            <Field label="Task due"><input type="date" value={mf.taskDue} onChange={(e) => setMf({ ...mf, taskDue: e.target.value })} style={css(S.input)} /></Field>
            <div style={css('grid-column:1/-1')}><CalNote label="The next court date goes into the firm Google Calendar automatically" /></div>
            <Field label="Remind PIC"><select value={mf.remind} onChange={(e) => setMf({ ...mf, remind: e.target.value })} style={css(S.input)}><option value="0">No reminder</option><option value="1">1 day before next date</option><option value="3">3 days before next date</option><option value="7">7 days before next date</option></select></Field>
            <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => { setMOpen(false); setEditM(null); setMf(blankM()); }} style={css(S.btnSecL)}>Cancel</button><button type="button" onClick={saveM} style={css(S.btnPriL)}>{editM ? 'Save changes' : <>Save &amp; generate court memo</>}</button></div>
          </div>
        )}
        <div style={css('display:grid;grid-template-columns:110px 150px minmax(0,1fr) 110px 190px;' + S.th)}><span>Date</span><span>Coram</span><span>Directions</span><span>Next date</span><span /></div>
        {memos.map((m) => (
          <div key={m.id} style={css('display:grid;grid-template-columns:110px 150px minmax(0,1fr) 110px 190px;align-items:start;' + S.row)}>
            <div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('color:#16223A')}>{fmt(m.date)}</strong><span style={css('color:#4A5468')}>{m.medium || ''}</span></div>
            <span style={css('color:#16223A')}>{m.corum || '—'}</span>
            <span style={css('color:#16223A;line-height:1.45')}>{m.courtDirections || '—'}</span>
            <strong style={css('font-family:ui-monospace, monospace;color:#8E2A20')}>{m.nextDate ? fmt(m.nextDate) : '—'}</strong>
            <span style={css('justify-self:end;display:flex;gap:6px')}>
              <button type="button" onClick={() => setView(view === m.id ? null : m.id)} style={css(S.btnSm)}>{view === m.id ? 'Hide' : 'View'}</button>
              {!ro && <button type="button" onClick={() => startEditM(m)} style={css(S.btnSm)}>Edit</button>}
              {!ro && <button type="button" onClick={() => deleteM(m)} style={css(S.btnSm + ';color:#B23A2E')}>Delete</button>}
            </span>
          </div>
        ))}
        {!memos.length && <div style={css(S.empty)}>No court memos yet.</div>}
        {vm && (
          <div style={css('margin:4px 16px 16px;border:1px solid #16223A;border-radius:6px;background:#fff')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:2px solid #16223A')}><div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-family:Georgia, serif;font-size:14px;letter-spacing:.06em;color:#16223A')}>SYAFIQAH HAMIZAD &amp; CO</strong><span style={css('font-size:11px;font-weight:700;letter-spacing:.12em;color:#8A6D3B')}>COURT MEMO</span></div><span style={css('margin-left:auto;font-family:ui-monospace, monospace;font-size:12px;font-weight:700;color:#16223A')}>{c.ref}</span><button type="button" onClick={() => printMemo(vm, c.ref, c.title)} style={css('border:1px solid #C9D1DC;border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Print / PDF</button></div>
            <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))')}>
              {([['Court date', fmt(vm.date)], ['Medium', vm.medium || '—'], ['Coram', vm.corum || '—'], ['Our lawyer', vm.ourLawyerAttendance || '—'], ['Opponent counsel', vm.opponentCounselAttendance || '—'], ['Client', vm.clientAttendance], ['Court directions', vm.courtDirections || '—'], ['Instructions / notes', vm.instructions || '—'], ['Next court date', vm.nextDate ? fmt(vm.nextDate) : '—'], ['Task from memo', vm.tasks || '—'], ['Reminder', vm.remindDaysBefore ? vm.remindDaysBefore + ' day(s) before ' + fmt(vm.nextDate) + ' (reminder e-mails not connected yet)' : vm.nextDate ? 'None' : '—'], ['Recorded by', vm.recordedBy || '—']] as [string, string][]).map(([k, v]) => (
                <div key={k} style={css('display:flex;flex-direction:column;gap:3px;padding:9px 16px;border-bottom:1px solid #EEF1F5;border-right:1px solid #EEF1F5')}><span style={css('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468')}>{k}</span><span style={css('font-size:12.5px;color:#16223A;line-height:1.45;white-space:pre-line')}>{v}</span></div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
};
