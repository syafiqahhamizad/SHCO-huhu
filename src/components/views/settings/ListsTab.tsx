import React, { useState } from 'react';
import { DEFAULT_CLAIM_TYPES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_LEAD_SOURCES, type LeadSourceDef } from '../../../services/templateService';
import { DEFAULT_PUBLIC_HOLIDAYS, getLeaveTypes } from '../staff/staffPortalShared';
import { css, S, Txt, type SettingsCtx } from './settingsShared';

interface ListDef {
  title: string;
  note: string;
  items: string[];
  rename: (i: number, v: string) => void;
  remove: (i: number) => void;
  add: () => void;
}

export const ListsTab = ({ C }: { C: SettingsCtx }) => {
  const s = C.settings;
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');
  const [pick, setPick] = useState('Expense categories');
  const sources: LeadSourceDef[] = s.leadSources && s.leadSources.length ? s.leadSources : DEFAULT_LEAD_SOURCES;
  const exp = s.expenseCategories && s.expenseCategories.length ? s.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
  const claims = s.claimTypes && s.claimTypes.length ? s.claimTypes : DEFAULT_CLAIM_TYPES;

  const strList = (title: string, note: string, items: string[], field: 'expenseCategories' | 'claimTypes'): ListDef => ({
    title, note, items,
    rename: (i, v) => C.save({ [field]: items.map((x, k) => (k === i ? v.trim() : x)) }, title + ' Changed', (items[i] || '—') + ' → ' + (v.trim() || '—')),
    remove: (i) => { C.save({ [field]: items.filter((_, k) => k !== i) }, title + ' Changed', 'Removed ' + (items[i] || '(blank)')); C.msg('Removed ' + (items[i] || 'item')); },
    add: () => C.save({ [field]: [...items, ''] }, title + ' Changed', 'Added a new item'),
  });

  const lists: ListDef[] = [
    {
      title: 'Lead sources', note: 'shown when logging a lead', items: sources.map((x) => x.label),
      // The key saved on each lead never changes, so renaming keeps old leads linked.
      rename: (i, v) => C.save({ leadSources: sources.map((x, k) => (k === i ? { ...x, label: v.trim() } : x)) }, 'Lead Sources Changed', (sources[i]?.label || '—') + ' → ' + (v.trim() || '—')),
      remove: (i) => { C.save({ leadSources: sources.filter((_, k) => k !== i) }, 'Lead Sources Changed', 'Removed ' + (sources[i]?.label || '(blank)') + ' (existing leads keep it)'); C.msg('Removed ' + (sources[i]?.label || 'item')); },
      add: () => C.save({ leadSources: [...sources, { key: `src_${Date.now()}`, label: '', color: '#5B6478', tint: '#F0F2F5', fg: '#5B6478' }] }, 'Lead Sources Changed', 'Added a new source'),
    },
    strList('Expense categories', 'Office Account & cash book', exp, 'expenseCategories'),
    strList('Claim types', 'My Claims', claims, 'claimTypes'),
  ];

  const holidays = s.publicHolidays ?? DEFAULT_PUBLIC_HOLIDAYS;
  const saveHolidays = (next: Record<string, string> | undefined, what: string) => C.save({ publicHolidays: next }, 'Public Holidays Changed', what);
  const addHoliday = () => {
    if (!hDate || !hName.trim()) return C.msg('Pick a date and enter the holiday name.');
    saveHolidays({ ...holidays, [hDate]: hName.trim() }, 'Added ' + hDate + ' ' + hName.trim());
    setHDate(''); setHName('');
    C.msg('Public holiday added.');
  };
  // Leave types: the built-in list is copied in on the first change, then edited here.
  const leaveTypes = s.leaveTypes && s.leaveTypes.length ? s.leaveTypes : getLeaveTypes().map(([name, days, basis, note]) => ({ name, days, basis, note }));
  const saveLeave = (next: typeof leaveTypes, what: string) => C.save({ leaveTypes: next }, 'Leave Types Changed', what);
  const setLeave = (i: number, p: Partial<(typeof leaveTypes)[number]>) => saveLeave(leaveTypes.map((t, k) => (k === i ? { ...t, ...p } : t)), (leaveTypes[i]?.name || 'Leave type') + ' changed');
  const fmtD = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

  const PICKS = [...lists.map((g) => [g.title, g.items.length] as [string, number]), ['Leave types', leaveTypes.length] as [string, number], ['Public holidays', Object.keys(holidays).length] as [string, number]];
  return (
    <div style={css('display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css(S.card + ';padding:6px')}>
        {PICKS.map(([t, n]) => { const on = pick === t; return <button key={t} type="button" onClick={() => setPick(t)} style={css(`display:flex;width:100%;align-items:center;justify-content:space-between;border:0;border-radius:6px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;text-align:left;background:${on ? '#16223A' : 'transparent'};color:${on ? '#fff' : '#16223A'}`)}><span>{t}</span><span style={css(`font-size:10px;font-weight:700;color:${on ? '#C9D3E0' : '#94A3B8'}`)}>{n}</span></button>; })}
      </div>
      <div style={css('max-width:760px')}>
      {lists.filter((g) => g.title === pick).map((g) => (
        <div key={g.title} style={css(S.card)}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>{g.title}</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{g.note}</span></div>
          {g.items.map((v, ii) => (
            <div key={g.title + ii} style={css('display:grid;grid-template-columns:minmax(0,1fr) 60px;gap:8px;align-items:center;padding:5px 14px;border-bottom:1px solid #F0F2F5')}><Txt value={v} onCommit={(x) => g.rename(ii, x)} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A" /><button type="button" onClick={() => g.remove(ii)} style={css(S.remove)}>Remove</button></div>
          ))}
          <div style={css('padding:7px 14px')}><button type="button" onClick={g.add} style={css(S.addLink)}>+ Add</button></div>
        </div>
      ))}
      {pick === 'Leave types' && <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Leave types</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>what staff can apply for in Staff Portal → Leave · days a year (0 = no fixed limit) · how days are counted{s.leaveTypes ? '' : ' · built-in list'}</span></div>
        {leaveTypes.map((t, i) => (
          <div key={i} style={css('display:grid;grid-template-columns:140px 60px 110px minmax(0,1fr) 60px;gap:8px;align-items:center;padding:5px 14px;border-bottom:1px solid #F0F2F5')}>
            <Txt value={t.name} onCommit={(x) => setLeave(i, { name: x.trim() })} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;font-weight:700;color:#16223A" />
            <Txt value={String(t.days)} onCommit={(x) => setLeave(i, { days: Math.max(0, Number(x) || 0) })} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;text-align:right" />
            <select value={t.basis} onChange={(e) => setLeave(i, { basis: e.target.value as 'working' | 'calendar' })} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 6px;font-size:11px;color:#16223A;background:#fff;font-family:inherit')}><option value="working">Working days</option><option value="calendar">Calendar days</option></select>
            <Txt value={t.note} onCommit={(x) => setLeave(i, { note: x })} placeholder="Rule shown to staff" style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A" />
            <button type="button" onClick={() => { if (window.confirm('Remove ' + (t.name || 'this leave type') + '? Leave already applied keeps its type.')) saveLeave(leaveTypes.filter((_, k) => k !== i), 'Removed ' + t.name); }} style={css(S.remove)}>Remove</button>
          </div>
        ))}
        <div style={css('display:flex;gap:14px;padding:7px 14px')}>
          <button type="button" onClick={() => saveLeave([...leaveTypes, { name: 'New leave', days: 0, basis: 'working', note: '' }], 'Added a leave type')} style={css(S.addLink)}>+ Add leave type</button>
          {s.leaveTypes && <button type="button" onClick={() => { if (window.confirm('Go back to the built-in leave types?')) C.save({ leaveTypes: undefined }, 'Leave Types Changed', 'Restored the built-in list'); }} style={css(S.addLink)}>Restore built-in list</button>}
        </div>
      </div>}
      {pick === 'Public holidays' && <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Public holidays</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>skipped when Staff Portal counts leave days{s.publicHolidays ? '' : ' · built-in 2026–2027 list'}</span></div>
        {Object.keys(holidays).sort().map((d) => (
          <div key={d} style={css('display:grid;grid-template-columns:120px minmax(0,1fr) 60px;gap:8px;align-items:center;padding:5px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:10.5px;color:#5B6478;font-family:ui-monospace, Menlo, monospace')}>{fmtD(d)}</span><span style={css('font-size:11px;color:#16223A;min-width:0')}>{holidays[d]}</span><button type="button" onClick={() => { const next = { ...holidays }; delete next[d]; saveHolidays(next, 'Removed ' + d + ' ' + holidays[d]); C.msg('Public holiday removed.'); }} style={css(S.remove)}>Remove</button></div>
        ))}
        {Object.keys(holidays).length === 0 && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No public holidays listed.</div>}
        <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 14px;background:#FAFBFC')}>
          <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:4px 6px;font-size:11px;color:#16223A;min-width:0;font-family:inherit;background:#fff')} />
          <input value={hName} onChange={(e) => setHName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHoliday()} placeholder="Holiday name, e.g. Hari Raya Aidilfitri" style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;min-width:0;background:#fff')} />
          <button type="button" onClick={addHoliday} style={css(S.darkBtn)}>Add</button>
        </div>
        {s.publicHolidays && <div style={css('padding:7px 14px')}><button type="button" onClick={() => { if (window.confirm('Replace your list with the built-in 2026–2027 list?')) { saveHolidays(undefined, 'Restored the built-in list'); C.msg('Built-in holiday list restored.'); } }} style={css(S.addLink)}>Restore built-in list</button></div>}
      </div>}
      </div>
    </div>
  );
};
