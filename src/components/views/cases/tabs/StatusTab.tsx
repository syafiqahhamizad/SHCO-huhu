import React, { useMemo, useState } from 'react';
import type { Case, MatterWeeklyStatus, TaskKind } from '../../../../types';
import { css, S, Card, Modal, boxStyle } from '../caseUi';
import { P, stamp, addDays, avatarOf, courtOf, daysFrom, fmt, isDeadline, isDone, isoOf, mondayOf, practiceOf, short, stageIndexOf, stageKey, stageMessage, stagesFor, todayIso } from '../caseModel';
import { histEntry, prepUpdate, type WF } from '../wf';
import { autoSend, emailUpdate, updateStatus } from '../clientComms';
import { whatsappLink } from '../../../../lib/whatsapp';

const HC: Record<string, string> = { 'On track': '#1F5A3B', 'At risk': '#B7791F', Stuck: '#8E2A20' };
const OP: Record<string, { bg: string; fg: string }> = { Done: P.g, 'In progress': P.b, Slipped: P.r };
const FLAGS = ['None', 'Waiting on client', 'Waiting on court', 'Waiting on other side', 'Client not responding', 'Fees outstanding'];
const NEXT_PH: Record<string, string> = { Conveyancing: 'e.g. Obtain consent to transfer from PTG', 'Probate & Estates': 'e.g. File petition for letters of administration', Corporate: 'e.g. Send first draft SHA to client', Family: 'e.g. Serve petition on respondent', Syariah: 'e.g. Attend sulh session', Employment: 'e.g. Attend conciliation at JPP' };

const PRE: Record<string, [string, string, TaskKind, number][]> = {
  'Civil Litigation': [['Limitation date', 'Limitation period expires', 'Limitation', 0], ['Court order deadline', '', 'Court order', 14], ['Appeal deadline (1 month)', 'Notice of appeal deadline', 'Rules of Court', 30], ['Trial date', 'Trial', 'Key date', 0]],
  Conveyancing: [['Completion (3 months)', 'Completion date (3 months from SPA)', 'Key date', 90], ['Extended completion (+1 month)', 'Extended completion date (+1 month, late interest)', 'Key date', 120], ['Stamp duty (30 days)', 'Pay stamp duty on SPA', 'Key date', 30], ['Consent to transfer', 'Apply for state consent to transfer', 'Key date', 14]],
  Corporate: [['Long-stop date', 'Long-stop date', 'Key date', 60], ['Conditions precedent', 'Conditions precedent to be fulfilled', 'Key date', 30], ['SSM lodgement (14 days)', 'Lodge forms with SSM', 'Key date', 14]],
  Family: [['Appeal deadline (14 days)', 'Appeal deadline', 'Rules of Court', 14], ['Decree absolute (3 months)', 'Apply for decree absolute', 'Key date', 90], ['Mediation date', 'Mediation / counselling session', 'Key date', 0]],
  Syariah: [['Appeal deadline (14 days)', 'Rayuan: deadline to file', 'Rules of Court', 14], ['Sulh session', 'Sulh session', 'Key date', 0], ['Order compliance', 'Deadline to comply with order', 'Court order', 30]],
  'Probate & Estates': [['Petition filing', 'File petition', 'Key date', 30], ['Estate duty / tax filing', 'Estate tax filing', 'Key date', 60], ['Distribution', 'Distribute estate', 'Key date', 90]],
  Employment: [['Representation (60 days)', 'File representation at JPP (s.20 IRA)', 'Limitation', 60], ['Award compliance', 'Comply with award', 'Court order', 30]],
  Criminal: [['Appeal deadline (14 days)', 'Notice of appeal deadline', 'Rules of Court', 14], ['Trial date', 'Trial', 'Key date', 0]],
};

export const weeklyInfo = (c: Case) => {
  const wk = [...(c.weeklyStatus || [])].sort((a, b) => (a.week < b.week ? 1 : -1));
  const now = mondayOf();
  const cur = wk.find((x) => x.week === now);
  const prev = wk.find((x) => x.week < now);
  const ago = prev ? Math.round((new Date(now).getTime() - new Date(prev.week).getTime()) / 864e5) : 99;
  const due = cur ? { label: 'Updated this week', ...P.g } : ago >= 14 ? { label: 'Weekly update overdue', ...P.r } : { label: 'Weekly update due', ...P.a };
  return { wk, now, cur, prev, due };
};

const WeekCard: React.FC<{ w?: MatterWeeklyStatus; head: string; emptyTxt: string; onDo: () => void; ro: boolean }> = ({ w, head, emptyTxt, onDo, ro }) => (
  <div style={css(`display:flex;flex-direction:column;gap:7px;padding:12px 14px;border-radius:10px;border:1px solid ${w ? '#DDE3EB' : '#E8D9B8'};background:${w ? '#fff' : '#FBF7EE'};min-width:0`)}>
    <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
      <span style={css(S.label)}>{head}</span>
      {w && <><span style={css(`display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:${HC[w.health] || '#4A5468'}`)}><span style={css(`width:8px;height:8px;border-radius:9999px;background:${HC[w.health] || '#4A5468'}`)} />{w.health}</span><span style={css('margin-left:auto;font-size:11.5px;color:#4A5468')}>{w.by} · {short(w.saved || w.week)}</span></>}
    </div>
    {w ? (
      <>
        <span style={css('font-size:12.5px;line-height:1.5;color:#16223A')}>{w.progress}</span>
        {w.outcome && <span style={css('font-size:12px;color:#4A5468')}>Last week's step: <strong style={css('color:#16223A')}>{w.prevNext}</strong> <span style={css(`padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${(OP[w.outcome] || P.n).bg};color:${(OP[w.outcome] || P.n).fg}`)}>{w.outcome}</span> {w.why ? '· ' + w.why : ''}</span>}
        <div style={css('display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:#4A5468;padding-top:7px;border-top:1px solid #EEF1F5')}><span>Next: <strong style={css('color:#16223A')}>{w.next}</strong> by {short(w.nextBy)}</span>{w.flag && w.flag !== 'None' && <span style={css('padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;background:#F6EEDC;color:#8A6D3B')}>{w.flag}</span>}</div>
      </>
    ) : (
      <>
        <span style={css('font-size:12.5px;line-height:1.5;color:#4A5468')}>{emptyTxt}</span>
        {!ro && <button type="button" onClick={onDo} style={css('align-self:start;border:1px solid #16223A;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Do this week's update</button>}
      </>
    )}
  </div>
);

export const StatusTab: React.FC<{ w: WF }> = ({ w }) => {
  const { c, staff } = w;
  const { wk, now, cur, prev, due } = weeklyInfo(c);
  const stages = stagesFor(practiceOf(c));
  const key = stageKey(practiceOf(c));
  const kd = (c.tasks || []).filter((t) => isDeadline(t) && !isDone(t) && t.dueDate).map((t) => ({ title: t.title, due: isoOf(t.dueDate), kind: t.kind === 'Key date' ? 'Key date' : t.kind === 'Limitation' ? 'Limitation' : 'Deadline: ' + String(t.kind).toLowerCase(), who: avatarOf(staff, t.assignedTo).name.split(' ')[0], open: () => w.openTask(t) }));
  const nh = (c.hearings || []).filter((h) => daysFrom(h.date) >= 0 && h.status !== 'Cancelled' && h.status !== 'Completed').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  if (nh) kd.push({ title: 'Court: ' + nh.purpose, due: isoOf(nh.date), kind: 'Court date', who: nh.time || '', open: () => w.setTab('court') });
  kd.sort((a, b) => (a.due > b.due ? 1 : -1));
  return (
    <div style={css('display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start')}>
      <div style={css('flex:1 1 560px;display:flex;flex-direction:column;gap:16px;min-width:0')}>
        <Card>
          <div style={css(S.head)}>
            <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Weekly status</strong>
            <span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${due.bg};color:${due.fg}`)}>{due.label}</span>
            <span style={css(S.sub)}>Firm record, also in Case Status firm-wide</span>
            {!w.ro && <button type="button" onClick={w.openWeekly} style={css('margin-left:auto;' + S.btnPri)}>{cur ? 'Edit this week' : 'Weekly update'}</button>}
          </div>
          <div style={css('padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px')}>
            <WeekCard w={prev} head={'Last week' + (prev ? ' · w/c ' + short(prev.week) : '')} emptyTxt="No update last week." onDo={w.openWeekly} ro={w.ro} />
            <WeekCard w={cur} head={'This week · w/c ' + short(now)} emptyTxt={prev ? 'Not done yet. Last week you said: ' + prev.next + ' by ' + short(prev.nextBy) + '.' : 'Not done yet.'} onDo={w.openWeekly} ro={w.ro} />
          </div>
        </Card>
        <Card>
          <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Status log</strong><span style={css(S.sub)}>{wk.length} week{wk.length === 1 ? '' : 's'} recorded</span></div>
          {wk.map((x, i) => (
            <div key={x.week} style={css(`display:grid;grid-template-columns:100px minmax(0,1fr);gap:14px;padding:12px 14px;border-top:1px solid ${i ? '#F0F2F5' : 'transparent'}`)}>
              <div style={css('display:flex;flex-direction:column;gap:3px')}><strong style={css('font-size:12.5px;color:#16223A')}>w/c {short(x.week)}</strong><span style={css(`display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:${HC[x.health] || '#4A5468'}`)}><span style={css(`width:8px;height:8px;border-radius:9999px;background:${HC[x.health] || '#4A5468'}`)} />{x.health}</span><span style={css('font-size:11.5px;color:#4A5468')}>{x.by}</span></div>
              <div style={css('display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12.5px;line-height:1.5;color:#16223A')}>
                <div style={css('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}><span style={css('font-weight:700')}>{x.stageName}</span>{x.flag && x.flag !== 'None' && <span style={css('padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;background:#F6EEDC;color:#8A6D3B')}>{x.flag}</span>}<span style={css('margin-left:auto;font-size:11.5px;color:#4A5468')}>{x.clientUpdatePrepared ? 'Client update recorded (see Client updates)' : 'Firm record only'}</span></div>
                <span>{x.progress}</span>
                {x.outcome && <span style={css('font-size:12px;color:#4A5468')}>Previous step: {x.prevNext} <span style={css(`padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${(OP[x.outcome] || P.n).bg};color:${(OP[x.outcome] || P.n).fg}`)}>{x.outcome}</span> {x.why ? '· ' + x.why : ''}</span>}
                <span style={css('font-size:12px;color:#4A5468')}>Next: <strong style={css('color:#16223A')}>{x.next}</strong> by {short(x.nextBy)}</span>
              </div>
            </div>
          ))}
          {!wk.length && <div style={css(S.empty)}>No weekly updates yet. The first one sets the stage and the next step.</div>}
        </Card>
      </div>
      <div style={css('flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:16px')}>
        <Card>
          <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Key dates</strong><span style={css(S.sub)}>{practiceOf(c)}</span></div>
          {kd.map((k, i) => {
            const d = daysFrom(k.due);
            const cd = d < 0 ? { bg: '#8E2A20', fg: '#fff' } : d <= 7 ? P.r : d <= 30 ? P.a : P.n;
            return (
              <button key={i} type="button" onClick={k.open} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:10px 16px;border:0;border-top:1px solid #F0F2F5;background:#fff;text-align:left;cursor:pointer;font-family:inherit')}>
                <div style={css(`flex-shrink:0;width:58px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 0;border-radius:8px;background:${cd.bg}`)}><strong style={css(`font-size:17px;line-height:1;color:${cd.fg}`)}>{d < 0 ? -d : d === 0 ? '!' : d}</strong><span style={css(`font-size:10px;font-weight:700;text-transform:uppercase;color:${cd.fg}`)}>{d < 0 ? 'days late' : d === 0 ? 'today' : d === 1 ? 'day' : 'days'}</span></div>
                <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:12.5px;font-weight:600;color:#16223A;line-height:1.35')}>{k.title}</span><span style={css('font-size:11.5px;color:#4A5468')}>{fmt(k.due)} · {k.kind}{k.who ? ' · ' + k.who : ''}</span></div>
              </button>
            );
          })}
          {!kd.length && <div style={css('padding:14px 16px;font-size:12.5px;color:#4A5468')}>No key dates yet.</div>}
          {!w.ro && (
            <div style={css('display:flex;flex-direction:column;gap:8px;padding:12px 16px;border-top:1px solid #EEF1F5;background:#F6F8FA;border-radius:0 0 12px 12px')}>
              <span style={css(S.label)}>Add a key date</span>
              <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>
                {(PRE[key] || PRE['Civil Litigation']).map(([label, title, kind, n]) => (
                  <button key={label} type="button" onClick={() => w.openTask(undefined, { title, kind, dueDate: addDays(n), priority: 'High' })} style={css('border:1px solid #C9D1DC;border-radius:20px;padding:5px 11px;font-size:11.5px;font-weight:600;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ {label}</button>
                ))}
              </div>
              <span style={css('font-size:11.5px;line-height:1.45;color:#4A5468')}>Key dates go into Tasks and the assignee's My Work. Reminder e-mails are not connected yet.</span>
            </div>
          )}
        </Card>
        <Card>
          <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Stages</strong><span style={css(S.sub)}>{courtOf(c).name || practiceOf(c)}</span></div>
          {stages.map((s, i) => { const at = stageIndexOf(c); return <div key={s} style={css(`display:flex;align-items:center;gap:10px;padding:8px 16px;border-top:1px solid #F0F2F5;font-size:12.5px;color:${i <= at ? '#16223A' : '#4A5468'};font-weight:${i === at ? 800 : 500}`)}><span style={css(`width:10px;height:10px;border-radius:3px;background:${i < at ? '#1F5A3B' : i === at ? '#16223A' : '#DDE3EB'}`)} />{s}</div>; })}
        </Card>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ weekly status modal */

export const WeeklyStatusModal: React.FC<{ w: WF; onClose: () => void }> = ({ w, onClose }) => {
  const { c, parties } = w;
  const { now, cur, prev, wk } = weeklyInfo(c);
  const stages = stagesFor(practiceOf(c));
  const at = stageIndexOf(c);
  const last = wk[0];
  const auto = c.clientUpdatesAuto !== false;
  const nb = addDays(7);
  const [f, setF] = useState(() => ({
    stage: stages[at], health: (cur?.health || 'On track') as MatterWeeklyStatus['health'], out: (cur?.outcome || '') as MatterWeeklyStatus['outcome'], why: cur?.why || '',
    prog: cur?.progress || '', next: cur?.next || last?.next || '', nextBy: cur?.nextBy || (last && last.nextBy > todayIso() ? last.nextBy : nb), flag: cur?.flag || 'None',
  }));
  const [send, setSend] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ch, setCh] = useState({ wa: true, em: true });
  const [off, setOff] = useState<Record<string, boolean>>({});
  const first = parties.find((p) => p.side === 'client' && !p.dischargedOn);
  const court = courtOf(c);
  const nh = (c.hearings || []).filter((h) => daysFrom(h.date) >= 0 && h.status !== 'Cancelled').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  const changed = stages.indexOf(f.stage) !== at;
  const defMsg = 'Dear ' + (first?.name || 'client') + ', an update on your case' + (court.suit ? ' (' + court.suit + ')' : ' (' + c.ref + ')') + ': ' + stageMessage(f.stage) + (nh ? ' Next court date: ' + fmt(nh.date) + '.' : '') + ' ' + (w.me || '') + ', Syafiqah Hamizad & Co.';
  const message = msg ?? defMsg;

  const since = prev ? prev.saved || prev.week : '0000-00-00';
  const acts = useMemo(() => {
    const A: { d: string; src: string; text: string }[] = [];
    w.money.te.forEach((t) => isoOf(t.date) > since && A.push({ d: isoOf(t.date), src: 'Time', text: (t.description || 'Time logged') + ' (' + t.hours + ' h)' }));
    (c.fileNotes || []).forEach((n) => n.date > since && A.push({ d: n.date, src: 'Note', text: n.title || n.text.slice(0, 120) }));
    (c.documents || []).forEach((d) => isoOf(d.uploadedDate) > since && A.push({ d: isoOf(d.uploadedDate), src: 'Doc', text: d.name }));
    (c.serviceRecord || []).forEach((r) => isoOf(r.date) > since && A.push({ d: isoOf(r.date), src: r.action === 'Filed' ? 'Filed' : 'Service', text: (r.action || 'Served') + ': ' + r.documentServed }));
    (c.hearings || []).forEach((h) => isoOf(h.date) > since && daysFrom(h.date) <= 0 && A.push({ d: isoOf(h.date), src: 'Court', text: h.purpose + (h.outcome ? ': ' + h.outcome : '') }));
    (c.courtDiary || []).forEach((m) => isoOf(m.date) > since && A.push({ d: isoOf(m.date), src: 'Memo', text: 'Court memo: ' + (m.courtDirections || '').slice(0, 120) }));
    (c.tasks || []).forEach((t) => { const d = isoOf(t.doneOn || t.completedAt); if (isDone(t) && d && d > since) A.push({ d, src: 'Task', text: 'Done: ' + t.title }); });
    return A.sort((a, b) => (a.d < b.d ? 1 : -1)).map((x, i) => ({ ...x, k: x.src + x.d + i }));
  }, [c, w.money.te, since]);

  const missing = [prev && !f.out && "say if last week's step happened", !f.prog.trim() && 'add progress', !f.next.trim() && 'add next step'].filter(Boolean).join(', ');
  const ok = (!prev || f.out) && f.prog.trim() && f.next.trim();

  const saveIt = () => {
    if (prev && !f.out) { w.toast("Say whether last week's step happened"); return; }
    if (!f.prog.trim()) { w.toast('Add progress this week'); return; }
    if (!f.next.trim()) { w.toast('Add the next step'); return; }
    const i = stages.indexOf(f.stage);
    const willPrepare = send || (changed && auto);
    const entry: MatterWeeklyStatus = { week: now, saved: todayIso(), by: w.me, stage: i, stageName: f.stage, health: f.health, outcome: prev ? f.out : '', prevNext: prev?.next || '', why: f.why, progress: f.prog.trim(), next: f.next.trim(), nextBy: f.nextBy, flag: f.flag, clientUpdatePrepared: willPrepare };
    const channels = [ch.wa && 'whatsapp', ch.em && 'email'].filter(Boolean) as ('whatsapp' | 'email')[];
    if (send && !channels.length) { w.toast('Pick WhatsApp and/or e-mail'); return; }
    if (send && ch.em && !first?.email && !ch.wa) { w.toast('No e-mail address for the client. Add it in Parties.'); return; }
    let up = willPrepare ? prepUpdate({ trigger: send ? (changed ? 'MANUAL_STATUS' : 'MANUAL') : 'AUTO_STATUS', title: changed ? 'Status: ' + f.stage : 'Update: ' + f.stage, message }, w.me, send ? channels : ['whatsapp', 'email']) : null;
    // WhatsApp must open inside the click (before any await). Recorded as "Opened in WhatsApp" only.
    if (up && send && ch.wa) {
      const link = whatsappLink(first?.phone, message);
      if (link) { window.open(link, '_blank', 'noopener'); up = { ...up, whatsappOpenedAt: stamp() }; up = { ...up, deliveryStatus: updateStatus(up) }; }
      else w.toast('No valid WhatsApp number for the client. Add it in Parties.');
    }
    const hist = [histEntry('Weekly update saved' + (changed ? '. Stage now ' + f.stage : '') + (up ? '. Client update ' + (up.whatsappOpenedAt ? 'opened in WhatsApp' : 'prepared') : ''), w.me)];
    w.save({
      weeklyStatus: [entry, ...(c.weeklyStatus || []).filter((x) => x.week !== now)],
      statusStage: i, statusStageName: f.stage, stage: f.stage,
      notes: f.prog.trim(), nextAction: f.next.trim(),
      caseStatusDetails: { currentStatus: f.prog.trim(), nextAction: f.next.trim(), nextActionDueDate: f.nextBy, assignedTo: c.caseStatusDetails?.assignedTo || w.me, priority: c.caseStatusDetails?.priority || 'Medium', reviewer: c.caseStatusDetails?.reviewer || '', reviewStatus: c.caseStatusDetails?.reviewStatus || 'Pending Review' },
      ...(up ? { clientUpdates: [up, ...(c.clientUpdates || [])] } : {}),
      activityLogs: [...hist, ...(c.activityLogs || [])],
    });
    onClose();
    w.toast('Weekly update saved' + (changed ? '. Stage now ' + f.stage : '') + (up && !send ? '. Client update prepared: send it from Client updates' : ''));
    if (up && send && ch.em && first?.email) void emailUpdate(w, up, first.email);
    else if (up && !send) void autoSend(w, up, first?.email);
  };

  const chip = (on: boolean) => `border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#C9D1DC'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`;
  return (
    <Modal onClose={onClose} width={940}>
      <div style={css('padding:16px 20px;border-bottom:1px solid #EEF1F5;display:flex;align-items:center;gap:10px;flex-wrap:wrap')}><strong style={css('font-family:Georgia, serif;font-size:17px;color:#16223A')}>Weekly status update</strong><span style={css('font-size:12.5px;color:#4A5468')}>{practiceOf(c)} · w/c {short(now)} · saved to the firm record</span><button type="button" onClick={onClose} style={css('margin-left:auto;background:none;border:0;cursor:pointer;color:#4A5468;font-size:15px')}>✕</button></div>
      <div style={css('flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))')}>
        <div style={css('display:flex;flex-direction:column;gap:14px;padding:16px 20px;background:#F6F8FA;border-right:1px solid #EEF1F5')}>
          <span style={css(S.label)}>Last week · w/c {prev ? short(prev.week) : '—'}</span>
          {prev ? (
            <>
              <div style={css('display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:10px;background:#fff;border:1px solid #DDE3EB')}><span style={css('font-size:12.5px;line-height:1.5;color:#16223A')}>{prev.progress}</span><span style={css('font-size:11.5px;color:#4A5468')}>{prev.by} · {prev.stageName} · {prev.health}</span></div>
              <div style={css('display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:10px;background:#fff;border:1px solid #16223A')}>
                <span style={css('font-size:12px;color:#4A5468')}>You said the next step was</span>
                <strong style={css('font-size:13px;color:#16223A')}>{prev.next} <span style={css('font-weight:500;color:#4A5468')}>by {short(prev.nextBy)}</span></strong>
                <span style={css(S.label)}>Did it happen?</span>
                <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{(['Done', 'In progress', 'Slipped'] as const).map((o) => { const on = f.out === o; return <button key={o} type="button" onClick={() => setF({ ...f, out: o })} style={css(`border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid ${on ? OP[o].fg : '#C9D1DC'};background:${on ? OP[o].fg : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{o}</button>; })}</div>
                {(f.out === 'Slipped' || f.out === 'In progress') && <input value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="Why? e.g. Client has not sent bank statements" style={css(S.input)} />}
              </div>
            </>
          ) : <span style={css('font-size:12.5px;color:#4A5468')}>No earlier weekly update on this file.</span>}
          <div style={css('display:flex;flex-direction:column;gap:6px')}>
            <div style={css('display:flex;align-items:center;gap:8px')}><span style={css(S.label)}>On the file since last update</span><button type="button" onClick={() => { const on = acts.filter((x) => !off[x.k]); if (!on.length) { w.toast('Tick at least one item'); return; } const txt = on.slice().reverse().map((x) => x.text.replace(/\.$/, '')).join('. ') + '.'; setF({ ...f, prog: f.prog.trim() ? f.prog.trim() + ' ' + txt : txt }); }} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:12px;font-weight:700;color:#2F4F7A;cursor:pointer;font-family:inherit')}>Add ticked to progress →</button></div>
            <div style={css('display:flex;flex-direction:column;border:1px solid #DDE3EB;border-radius:10px;background:#fff')}>
              {acts.map((a) => (
                <button key={a.k} type="button" onClick={() => setOff({ ...off, [a.k]: !off[a.k] })} style={css('display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border:0;border-top:1px solid #F0F2F5;background:none;text-align:left;cursor:pointer;font-family:inherit')}>
                  <span style={boxStyle(!off[a.k], 15)}>{!off[a.k] ? '✓' : ''}</span>
                  <span style={css('flex:1;min-width:0;font-size:12.5px;line-height:1.4;color:#16223A')}>{a.text}</span>
                  <span style={css('flex-shrink:0;font-size:11px;font-weight:700;color:#4A5468')}>{a.src} · {short(a.d)}</span>
                </button>
              ))}
              {!acts.length && <span style={css('padding:10px 12px;font-size:12.5px;color:#8E2A20')}>Nothing recorded on the file since the last update.</span>}
            </div>
          </div>
        </div>
        <div style={css('display:flex;flex-direction:column;gap:14px;padding:16px 20px')}>
          <span style={css(S.label)}>This week · w/c {short(now)}</span>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Stage</span><select value={f.stage} onChange={(e) => { setF({ ...f, stage: e.target.value }); setMsg(null); }} style={css(S.input)}>{stages.map((n, i) => <option key={n} value={n}>{n + (i === at ? ' (current)' : '')}</option>)}</select></label>
            <div style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Health</span><div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{(['On track', 'At risk', 'Stuck'] as const).map((h) => <button key={h} type="button" onClick={() => setF({ ...f, health: h })} style={css('display:flex;align-items:center;gap:6px;' + chip(f.health === h))}><span style={css(`width:8px;height:8px;border-radius:9999px;background:${HC[h]}`)} />{h}</button>)}</div></div>
          </div>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Progress this week</span><textarea value={f.prog} onChange={(e) => setF({ ...f, prog: e.target.value })} rows={4} placeholder="What moved on the file this week. Tick items on the left to fill this in." style={css(S.input + ';resize:vertical;line-height:1.5')} /></label>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Next step</span><input value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} placeholder={NEXT_PH[stageKey(practiceOf(c))] || 'e.g. File affidavit in reply'} style={css(S.input)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>By</span><input type="date" value={f.nextBy} onChange={(e) => setF({ ...f, nextBy: e.target.value })} style={css(S.input)} /></label>
          </div>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(S.label)}>Anything holding it up?</span><div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{FLAGS.map((x) => <button key={x} type="button" onClick={() => setF({ ...f, flag: x })} style={css(chip(f.flag === x))}>{x}</button>)}</div></div>
          <button type="button" onClick={() => setSend(!send)} style={css('display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #DDE3EB;border-radius:8px;background:#F6F8FA;cursor:pointer;font-family:inherit;text-align:left')}>
            <span style={css(`width:30px;height:17px;flex-shrink:0;border-radius:9px;display:flex;align-items:center;padding:2px;background:${send ? '#1F5A3B' : '#C9D1DC'};justify-content:${send ? 'flex-end' : 'flex-start'}`)}><span style={css('width:13px;height:13px;border-radius:9999px;background:#fff')} /></span>
            <span style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-size:12.5px;color:#16223A')}>Also send to client</strong><span style={css('font-size:11.5px;color:#4A5468')}>{send ? 'E-mail goes from your Gmail; WhatsApp opens with the message for you to press Send' : changed && auto ? 'Stage changed. Auto-send will prepare one (and e-mail it if you are signed in to Gmail)' : 'Off. This update stays in the firm record'}</span></span>
          </button>
          {send && (
            <>
              <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Message to client</span><textarea value={message} onChange={(e) => setMsg(e.target.value)} rows={5} style={css(S.input + ';resize:vertical;line-height:1.5')} /></label>
              <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
                {([['wa', 'WhatsApp · ' + (first?.phone || 'no number on file')], ['em', 'E-mail · ' + (first?.email || 'no e-mail on file')]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setCh({ ...ch, [k]: !ch[k] })} style={css('display:flex;align-items:center;gap:8px;border:1px solid #C9D1DC;border-radius:8px;padding:7px 11px;font-size:12.5px;font-weight:600;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}><span style={boxStyle(ch[k], 16)}>{ch[k] ? '✓' : ''}</span>{label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={css('padding:14px 20px;border-top:1px solid #EEF1F5;display:flex;align-items:center;gap:10px')}>
        <span style={css('font-size:12px;color:#4A5468')}>{missing ? missing.charAt(0).toUpperCase() + missing.slice(1) : ''}</span>
        <button type="button" onClick={onClose} style={css('margin-left:auto;' + S.btnSecL)}>Cancel</button>
        <button type="button" onClick={saveIt} style={css(S.btnPriL + `;opacity:${ok ? 1 : 0.4}`)}>{send ? 'Save & send to client' : 'Save weekly update'}</button>
      </div>
    </Modal>
  );
};
