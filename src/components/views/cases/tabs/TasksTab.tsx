import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import type { Task } from '../../../../types';
import { css, S, Card, Avatar, boxStyle } from '../caseUi';
import { P, avatarOf, daysFrom, fmt, isDeadline, isDone, todayIso } from '../caseModel';
import { histEntry, type WF } from '../wf';
import { syncTask } from '../clientComms';

export const TasksTab: React.FC<{ w: WF }> = ({ w }) => {
  const { setCurrentView } = useApp();
  const { c, staff, me, ro } = w;
  const [filter, setFilter] = useState<'open' | 'mine' | 'dl' | 'done'>('open');
  const all = c.tasks || [];
  const mine = (t: Task) => { const a = avatarOf(staff, t.assignedTo); return a.name === me || t.assignedTo === w.meCode; };
  const TF: Record<string, (t: Task) => boolean> = { open: (t) => !isDone(t), mine: (t) => !isDone(t) && mine(t), dl: (t) => !isDone(t) && isDeadline(t), done: (t) => isDone(t) };
  const list = all.filter(TF[filter]).sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || ((a.dueDate || '9') > (b.dueDate || '9') ? 1 : -1));

  const toggle = (t: Task) => {
    const done = !isDone(t);
    const upd: Task = { ...t, status: done ? 'Completed' : 'Not Started', doneOn: done ? todayIso() : undefined, completedAt: done ? new Date().toISOString() : undefined, lastUpdatedBy: me, lastUpdatedAt: new Date().toISOString() };
    w.save({
      tasks: all.map((x) => (x.id === t.id ? upd : x)),
      activityLogs: [histEntry((done ? 'Task done: ' : 'Task reopened: ') + t.title, me, 'Milestone Completion'), ...(c.activityLogs || [])],
    });
    if (t.googleTaskIds?.[w.meId]) void syncTask(w, upd);
  };

  const cols = 'display:grid;grid-template-columns:28px minmax(0,1fr) 110px 80px 170px 100px;min-width:820px;';
  return (
    <Card style="overflow-x:auto">
      <div style={css(S.head + ';min-width:820px')}>
        <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Tasks</strong>
        <span style={css(S.sub)}>Tasks and court deadlines for this file. The same list shows in each person's My Work.</span>
        <button type="button" onClick={() => setCurrentView('dashboard')} style={css('border:0;background:none;padding:0;font-size:12px;font-weight:700;color:#16223A;cursor:pointer;font-family:inherit;text-decoration:underline')}>Open My Work →</button>
        {!ro && <button type="button" onClick={() => w.openTask()} style={css('margin-left:auto;' + S.btnPri)}>+ New task</button>}
      </div>
      <div style={css('display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid #EEF1F5;flex-wrap:wrap;min-width:820px')}>
        {([['open', 'Open'], ['mine', 'Assigned to me'], ['dl', 'Deadlines'], ['done', 'Completed']] as const).map(([k, label]) => {
          const on = filter === k;
          return <button key={k} type="button" onClick={() => setFilter(k)} style={css(`display:flex;align-items:center;gap:6px;border:0;border-radius:20px;padding:5px 11px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${on ? '#16223A' : '#F6F8FA'};color:${on ? '#fff' : '#4A5468'}`)}>{label}<span style={css(`font-size:10.5px;padding:0 6px;border-radius:10px;background:${on ? 'rgba(255,255,255,.18)' : '#E7EBF0'}`)}>{all.filter(TF[k]).length}</span></button>;
        })}
      </div>
      <div style={css(cols + S.th)}><span /><span>Task</span><span>Status</span><span>Priority</span><span>Assigned to</span><span>Due</span></div>
      {list.map((t) => {
        const done = isDone(t);
        const n = t.dueDate ? daysFrom(t.dueDate) : 99;
        const bar = done ? '#DDE3EB' : n < 0 ? '#B23A2E' : n <= 3 ? '#8A6D3B' : '#DDE3EB';
        const dc = done ? '#4A5468' : n < 0 ? '#B23A2E' : n <= 3 ? '#8A6D3B' : '#16223A';
        const av = avatarOf(staff, t.assignedTo);
        const chk = t.checklist || [];
        const src = isDeadline(t) ? (done ? '' : 'Reminders ' + (t.remindDaysBefore || (t.kind === 'Limitation' ? 30 : 3)) + 'd before') : t.source ? 'From ' + t.source : '';
        const status = done ? 'Completed' : t.status === 'Pending' ? 'Not Started' : t.status === 'Under Review' ? 'In Review' : t.status;
        const sp = done ? P.g : status === 'In Progress' ? P.b : status === 'In Review' ? P.a : P.n;
        return (
          <div key={t.id} style={css(cols + 'gap:12px;align-items:center;padding:10px 16px;border-top:1px solid #F0F2F5;font-size:12.5px;border-left:3px solid ' + bar)}>
            <button type="button" disabled={ro} onClick={() => toggle(t)} style={boxStyle(done)}>{done ? '✓' : ''}</button>
            <button type="button" onClick={() => w.openTask(t)} style={css('display:flex;flex-direction:column;gap:3px;min-width:0;border:0;background:none;padding:0;text-align:left;cursor:pointer;font-family:inherit')}>
              <div style={css('display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>
                {isDeadline(t) && <span style={css('padding:1px 7px;border-radius:9px;font-size:10.5px;font-weight:800;background:#F6E4E1;color:#8E2A20')}>DEADLINE · {String(t.kind).toUpperCase()}</span>}
                <span style={css(`color:${done ? '#4A5468' : '#16223A'};font-weight:600;text-decoration:${done ? 'line-through' : 'none'}`)}>{t.title}</span>
              </div>
              <span style={css('display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#4A5468')}><span>{t.taskType || 'Standard'}</span>{chk.length > 0 && <span style={css('border:1px solid #DDE3EB;border-radius:4px;padding:0 5px')}>☑ {chk.filter((x) => x.completed).length}/{chk.length}</span>}{src && <span>{src}</span>}{t.googleTaskIds?.[w.meId] && <span style={css('color:#2F4F7A;font-weight:600')}>✓ Google Tasks</span>}</span>
            </button>
            <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${sp.bg};color:${sp.fg}`)}>{status}</span>
            <span style={css(`font-weight:700;color:${t.priority === 'High' ? '#8E2A20' : t.priority === 'Medium' ? '#8A6D3B' : '#4A5468'}`)}>{t.priority}</span>
            <span style={css('display:flex;align-items:center;gap:7px;min-width:0')}><Avatar code={av.code} color={av.color} /><span style={css('color:#16223A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{av.name}</span></span>
            <span style={css(`color:${dc};font-weight:600`)}>{t.dueDate ? (done ? fmt(t.dueDate) : n < 0 ? -n + 'd overdue' : n === 0 ? 'Today' : fmt(t.dueDate)) : 'No date'}</span>
          </div>
        );
      })}
      {!list.length && <div style={css(S.empty)}>{all.length ? 'Nothing here.' : 'No tasks on this file yet.'}</div>}
    </Card>
  );
};
