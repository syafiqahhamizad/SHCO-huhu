import React, { useState } from 'react';
import type { MatterNote, Task } from '../../../../types';
import { css, S, Card } from '../caseUi';
import { P, addDays, fmt, isoOf, short, todayIso } from '../caseModel';
import { histEntry, newId, type WF } from '../wf';

const NK: MatterNote['kind'][] = ['Meeting', 'Phone call', 'Client instructions', 'Opposing side', 'Legal research', 'Internal'];
const WHO_L: Record<string, string> = { Meeting: 'Attendees', 'Phone call': 'Spoke with', 'Client instructions': 'Instructed by', 'Legal research': 'Sources', Internal: 'For', 'Opposing side': 'Spoke with' };
const WHO_PH: Record<string, string> = { Meeting: 'e.g. Client, DH, SH', 'Phone call': 'e.g. Ms. Tan (opposing solicitors)', 'Client instructions': 'e.g. the client', 'Legal research': 'e.g. CLJ, MLJ, ROC 2012', Internal: 'e.g. Partner SH', 'Opposing side': 'e.g. counsel for the other side' };
const TXT_PH: Record<string, string> = { Meeting: 'What was discussed, what was agreed, next steps', 'Phone call': 'Summary of the call', 'Client instructions': 'Exactly what the client instructed. Keep for the record.', 'Legal research': 'Issue, authorities, conclusion', Internal: 'Internal note for the team', 'Opposing side': 'Without-prejudice talks, offers, positions' };
const PILL: Record<string, { bg: string; fg: string }> = { Meeting: P.b, 'Phone call': P.b, 'Client instructions': P.g, 'Legal research': P.a, Internal: P.r, 'Opposing side': P.n };

type Row = { key: string; kind: MatterNote['kind']; date: string; by: string; title: string; who?: string; text: string };

export const NotesTab: React.FC<{ w: WF }> = ({ w }) => {
  const { c, me, ro } = w;
  const [kind, setKind] = useState<'All' | MatterNote['kind']>('All');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: 'Meeting' as MatterNote['kind'], title: '', date: todayIso(), who: '', text: '', task: '', taskDue: '' });

  // New notes + the notes kept by the earlier matter workspace (meeting / research / internal / memo).
  const rows: Row[] = [
    ...(c.fileNotes || []).map((n) => ({ key: n.id, kind: n.kind, date: n.date, by: n.by, title: n.title || n.kind, who: n.with, text: n.text })),
    ...(c.meetingNotes || []).map((m) => ({ key: m.id, kind: 'Meeting' as const, date: m.date, by: m.recordedBy, title: 'Meeting', who: [m.ourLawyers, m.clientAttendees].filter(Boolean).join(', '), text: [m.meetingNotes, m.decisions ? 'Decisions: ' + m.decisions : ''].filter(Boolean).join('\n') })),
    ...(c.researchNotes || []).map((r) => ({ key: r.id, kind: 'Legal research' as const, date: r.date, by: r.preparedBy, title: r.title, who: r.partiesAndCourts, text: [r.issues && 'Issues: ' + r.issues, r.findingsAndRatio && 'Findings: ' + r.findingsAndRatio, r.applicationToCase && 'Application: ' + r.applicationToCase].filter(Boolean).join('\n') })),
    ...(c.internalNotes || []).map((n) => ({ key: n.id, kind: 'Internal' as const, date: n.date, by: n.recordedBy, title: n.noteType || 'Internal', text: n.content })),
    ...(c.memos || []).map((m) => ({ key: m.id, kind: 'Internal' as const, date: m.date, by: '', title: m.type, text: m.description })),
  ].sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));
  const list = rows.filter((r) => kind === 'All' || r.kind === kind);

  const saveN = () => {
    if (!f.text.trim()) { w.toast('Write the note'); return; }
    let task: Task | null = null;
    if (f.task.trim()) task = { id: newId('T'), title: f.task.trim(), priority: 'Medium', status: 'Not Started', dueDate: f.taskDue || addDays(7), assignedTo: me, taskType: 'Standard', kind: 'Task', source: f.kind + ' note ' + short(f.date), createdBy: me, createdAt: todayIso() };
    const note: MatterNote = { id: newId('N'), kind: f.kind, date: f.date, title: f.title.trim() || undefined, with: f.who.trim() || undefined, text: f.text.trim(), by: me, createdAt: new Date().toISOString(), taskId: task?.id };
    w.save({
      fileNotes: [note, ...(c.fileNotes || [])],
      ...(task ? { tasks: [...(c.tasks || []), task] } : {}),
      activityLogs: [histEntry(f.kind + ' note added' + (note.title ? ': ' + note.title : ''), me, 'Note Added'), ...(c.activityLogs || [])],
    });
    setF({ kind: f.kind, title: '', date: todayIso(), who: '', text: '', task: '', taskDue: '' });
    setOpen(false);
    w.toast('Note saved' + (task ? '. Follow-up task added to your My Work' : ''));
  };

  const inp = 'width:100%;border:1px solid #C9D1DC;border-radius:8px;padding:10px 12px;font-size:13.5px;color:#16223A;background:#fff;font-family:inherit';
  return (
    <Card>
      <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Notes</strong><span style={css(S.sub)}>Meeting notes, legal research and internal notes. Never sent to the client.</span>{!ro && <button type="button" onClick={() => setOpen(!open)} style={css('margin-left:auto;' + S.btnPri)}>+ Add note</button>}</div>
      <div style={css('display:flex;gap:4px;padding:10px 16px;border-bottom:1px solid #EEF1F5;flex-wrap:wrap')}>
        {(['All', ...NK] as const).map((k) => { const on = kind === k; return <button key={k} type="button" onClick={() => setKind(k)} style={css(`border:0;border-radius:14px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:${on ? '#16223A' : '#EEF1F5'};color:${on ? '#fff' : '#16223A'}`)}>{k}{k !== 'All' ? ' (' + rows.filter((r) => r.kind === k).length + ')' : ''}</button>; })}
      </div>
      {open && (
        <div style={css('display:flex;flex-direction:column;gap:14px;padding:18px 20px;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}>
          <div style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(S.label)}>Type</span><div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{NK.map((k) => { const on = f.kind === k; return <button key={k} type="button" onClick={() => setF({ ...f, kind: k })} style={css(`border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'};border:1px solid ${on ? '#16223A' : '#C9D1DC'}`)}>{k}</button>; })}</div></div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
            <label style={css('display:flex;flex-direction:column;gap:5px;grid-column:span 2')}><span style={css(S.label)}>Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Meeting with client on affidavit in reply" style={css(inp)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Date</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={css(inp)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>{WHO_L[f.kind]}</span><input value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} placeholder={WHO_PH[f.kind]} style={css(inp)} /></label>
          </div>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Note</span><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={10} placeholder={TXT_PH[f.kind]} style={css(inp + ';resize:vertical;line-height:1.6;min-height:220px')} /></label>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:12px')}>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Follow-up task (optional)</span><input value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} placeholder="e.g. Client to send bank statements" style={css(inp)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Task due</span><input type="date" value={f.taskDue} onChange={(e) => setF({ ...f, taskDue: e.target.value })} style={css(inp)} /></label>
          </div>
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}><span style={css('font-size:12px;color:#4A5468')}>Internal only. Never shown on the Client Portal or sent to the client.</span><button type="button" onClick={() => setOpen(false)} style={css('margin-left:auto;' + S.btnSecL)}>Cancel</button><button type="button" onClick={saveN} style={css(S.btnPriL)}>Save note</button></div>
        </div>
      )}
      {list.map((n) => (
        <div key={n.key} style={css('display:flex;flex-direction:column;gap:6px;padding:12px 16px;border-top:1px solid #F0F2F5')}>
          <div style={css('display:flex;align-items:center;gap:10px;font-size:12px')}><span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${PILL[n.kind].bg};color:${PILL[n.kind].fg}`)}>{n.kind}</span><strong style={css('color:#16223A')}>{fmt(n.date)}</strong><span style={css('color:#4A5468')}>{n.by}</span></div>
          <strong style={css('font-size:13.5px;color:#16223A')}>{n.title}</strong>
          {n.who && <span style={css('font-size:12px;color:#4A5468')}>{WHO_L[n.kind]}: {n.who}</span>}
          <span style={css('font-size:13px;color:#16223A;line-height:1.6;white-space:pre-line')}>{n.text}</span>
        </div>
      ))}
      {!list.length && <div style={css(S.empty)}>No notes yet.</div>}
    </Card>
  );
};
