import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { StaffGoal, StaffProfile } from '../../../types';
import { card, cardTitle, labelWrap, periodLabel, thisPeriod } from './staffPortalShared';
import { isSuper } from '../settings/permissionModel';

type GoalStatus = NonNullable<StaffGoal['status']>;
const GS: GoalStatus[] = ['Not started', 'On track', 'Behind', 'Done'];
const GC: Record<GoalStatus, [string, string]> = { 'Not started': ['#F0F2F5', '#5B6478'], 'On track': ['#E7EEF6', '#2F5680'], Behind: ['#FBEDE9', '#B23A2E'], Done: ['#E6EFE9', '#2F6F4E'] };
const MOODS = ['Great', 'Good', 'Okay', 'Stretched', 'Struggling'];
const TOPICS = ['Workload', 'Deadlines', 'Team', 'Clients', 'Learning', 'Health', 'Family', 'Idea for the firm'];
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };

/** Stored mood is 5 = Great … 1 = Struggling, 0 = no rating. */
const moodName = (m: number) => (m >= 1 && m <= 5 ? MOODS[5 - m] : 'No rating');

export const StaffGoalsTab: React.FC = () => {
  const { currentUser, users, addStaffGoal, updateStaffGoal, deleteStaffGoal, updateUserStaffProfile, addNotification, showToast } = useApp();
  // Check-ins go to the Super Admin.
  const inCharge = users.filter((u) => isSuper(u) && u.status !== 'Inactive');
  const goals = currentUser.staffProfile?.goals || [];
  const checkins = currentUser.staffProfile?.moodCheckins || [];
  const [mood, setMood] = useState(-1);
  const [w, setWb] = useState({ text: '', topics: [] as string[], anon: false, chat: false });
  const setW = (p: Partial<typeof w>) => setWb((s) => ({ ...s, ...p }));

  const latest = [...checkins].sort((a, b) => b.at.localeCompare(a.at))[0];
  const last = latest
    ? (latest.period === thisPeriod() ? 'Sent: ' : 'Last check-in: ') + periodLabel(latest.period) + ' · “' + moodName(latest.mood) + '”' + (latest.anonymous ? ' · anonymous' : '') + (latest.chatRequested ? ' · chat requested' : '')
    : 'No check-in yet.';

  const groups: [StaffGoal['type'], string, string][] = [
    ['Career', 'Career goals', 'reviewed every quarter'],
    ['Personal', 'Personal goals', 'what you want in life: the firm will try to help'],
  ];

  const commit = (g: StaffGoal, patch: Partial<StaffGoal>) => {
    if (Object.entries(patch).every(([k, v]) => (g as unknown as Record<string, unknown>)[k] === v)) return;
    updateStaffGoal(currentUser.id, g.id, patch);
  };

  const send = () => {
    if (mood < 0 && !w.text.trim()) return showToast('Pick how you feel or write something first');
    const period = thisPeriod();
    const entry = {
      period,
      mood: mood >= 0 ? 5 - mood : 0,
      note: w.text.trim() || undefined,
      at: new Date().toISOString(),
      topics: w.topics.length ? w.topics : undefined,
      anonymous: w.anon || undefined,
      chatRequested: w.chat || undefined,
    };
    const base = currentUser.staffProfile || ({} as StaffProfile);
    updateUserStaffProfile(currentUser.id, { ...base, moodCheckins: [...checkins.filter((c) => c.period !== period), entry] });
    if (inCharge.length) {
      const who = w.anon ? 'Someone in the team' : currentUser.name;
      addNotification({
        title: 'Monthly check-in' + (w.anon ? '' : ' · ' + currentUser.name) + (w.chat ? ' · wants a private chat' : ''),
        message: who + ' feels “' + moodName(entry.mood) + '” this month.' + (entry.topics ? ' About: ' + entry.topics.join(', ') + '.' : '') + (entry.note ? ' “' + entry.note + '”' : '') + (w.chat ? ' They would like a private chat: please reach out.' : ''),
        type: 'system',
        linkTab: 'staffPortal',
        to: inCharge.map((u) => u.id),
        anonymous: w.anon,
      });
    }
    setW({ text: '', topics: [] });
    showToast(w.chat ? 'Sent. ' + (inCharge[0]?.name || 'The Super Admin') + ' will reach out for a private chat.' : 'Thank you for sharing.');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      {groups.map(([type, title, note]) => (
        <div key={type} style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
            <strong style={cardTitle}>{title}</strong>
            <span style={{ display: 'block', fontSize: 10.5, color: '#5B6478' }}>{note}</span>
          </div>
          {goals.filter((g) => g.type === type).map((g) => {
            const s2: GoalStatus = g.status || 'Not started';
            return (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 130px 90px 44px', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
                <input key={'t' + g.text} defaultValue={g.text} onBlur={(e) => commit(g, { text: e.target.value })} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '5px 7px', fontSize: 11.5, color: '#16223A', background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
                <input type="date" title={g.by && !/^\d{4}-\d{2}-\d{2}$/.test(g.by) ? 'Was: ' + g.by : 'By when'} aria-label="By when" value={/^\d{4}-\d{2}-\d{2}$/.test(g.by || '') ? g.by : ''} onChange={(e) => commit(g, { by: e.target.value })} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '4px 6px', fontSize: 11, color: '#16223A', background: '#fff', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <button
                  type="button"
                  onClick={() => { const next = GS[(GS.indexOf(s2) + 1) % GS.length]; updateStaffGoal(currentUser.id, g.id, next === 'Done' ? { status: next, pct: 100 } : { status: next }); }}
                  style={{ border: 0, borderRadius: 10, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: GC[s2][0], color: GC[s2][1] }}
                >{s2}</button>
                <button type="button" title="Delete this goal" onClick={() => { if (window.confirm('Delete this goal?')) deleteStaffGoal(currentUser.id, g.id); }} style={{ border: 0, background: 'none', padding: 0, fontSize: 11, fontWeight: 700, color: '#B23A2E', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            );
          })}
          <div style={{ padding: '7px 14px' }}>
            <button type="button" onClick={() => addStaffGoal(currentUser.id, { id: 'G-' + Date.now(), type, text: '', pct: 0, help: '', by: '', status: 'Not started' })} style={{ border: 0, background: 'none', fontSize: 11, fontWeight: 700, color: '#8A6D3B', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add goal</button>
          </div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / 3', borderRadius: 12, border: '1px solid #DDE3EB', background: '#fff', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid #EEF1F5' }}>
          <strong style={cardTitle}>How are you feeling at work this month?</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MOODS.map((label, i) => (
              <button key={label} type="button" onClick={() => setMood(i)} style={{ borderRadius: 16, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (mood === i ? '#16223A' : '#DDE3EB'), background: mood === i ? '#16223A' : '#fff', color: mood === i ? '#fff' : '#16223A' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, padding: '12px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={labelWrap}>
              <span style={LBL}>Anything you want to share? (optional)</span>
              <textarea value={w.text} onChange={(e) => setW({ text: e.target.value })} rows={4} placeholder={mood >= 3 ? 'What is weighing on you? Workload, a file, a colleague, something at home… Nothing is too small.' : 'A win this month, an idea for the firm, or something that could be better…'} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '6px 8px', fontSize: 11.5, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, outline: 'none' }} />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TOPICS.map((label) => {
                const onT = w.topics.includes(label);
                return (
                  <button key={label} type="button" onClick={() => setW({ topics: onT ? w.topics.filter((x) => x !== label) : [...w.topics, label] })} style={{ borderRadius: 14, padding: '3px 10px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (onT ? '#16223A' : '#DDE3EB'), background: onT ? '#EEF3F9' : '#fff', color: '#16223A' }}>{label}</button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={LBL}>Who sees this · it goes to {inCharge.map((u) => u.name).join(', ') || 'the Super Admin'} only</span>
            {([[false, 'With my name', 'Shown with your name so someone can follow up'], [true, 'Anonymous', 'Only the message is shown, not your name']] as [boolean, string, string][]).map(([k, label, sub]) => (
              <button key={label} type="button" onClick={() => setW({ anon: k, chat: k ? false : w.chat })} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left', border: '1px solid ' + (w.anon === k ? '#16223A' : '#DDE3EB'), borderRadius: 6, padding: '7px 9px', background: w.anon === k ? '#F6F8FA' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ flex: 'none', width: 12, height: 12, marginTop: 1, borderRadius: 9999, border: '1.5px solid #16223A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 9999, background: w.anon === k ? '#16223A' : 'transparent' }} />
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>{sub}</span>
                </span>
              </button>
            ))}
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 11.5, color: '#16223A', cursor: 'pointer' }}>
              <input type="checkbox" checked={w.chat} onChange={(e) => setW({ chat: e.target.checked })} style={{ cursor: 'pointer', padding: 0 }} />I’d like a private chat
            </label>
            <button type="button" onClick={send} style={{ border: 0, borderRadius: 6, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Send check-in</button>
            <span style={{ fontSize: 10, lineHeight: 1.45, color: '#5B6478' }}>{last}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
