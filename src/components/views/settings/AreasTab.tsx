import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { DEFAULT_PRACTICE_SETTINGS, type PracticeSettings } from '../../../services/templateService';
import { css, S, type SettingsCtx } from './settingsShared';

type PA = NonNullable<PracticeSettings['practiceAreas']>[number];
type MC = NonNullable<PracticeSettings['matterCodes']>[number];

const BUILTIN_PA = new Set((DEFAULT_PRACTICE_SETTINGS.practiceAreas || []).map((p) => p.id));
const BUILTIN_MC = new Set((DEFAULT_PRACTICE_SETTINGS.matterCodes || []).map((m) => m.id));
/** Same normalising the New case form uses to match matter codes to a practice area. */
const normArea = (v: string) => (v || '').toLowerCase().replace(/&/g, ' and ').replace(/[()]/g, '').replace(/\s+/g, ' ').replace(/\/commercial/g, '').replace(/civil\s+/g, '').trim();
export const practiceAreasOf = (s: PracticeSettings): PA[] => (s.practiceAreas && s.practiceAreas.length ? s.practiceAreas : DEFAULT_PRACTICE_SETTINGS.practiceAreas || []);
const matterCodesOf = (s: PracticeSettings): MC[] => (s.matterCodes && s.matterCodes.length ? s.matterCodes : DEFAULT_PRACTICE_SETTINGS.matterCodes || []);
const mcInArea = (m: MC, pa: PA) => normArea(m.practiceArea) === normArea(pa.name) || m.practiceArea === pa.code;

export const AreasTab = ({ C }: { C: SettingsCtx }) => {
  const { cases = [] } = useApp();
  const pas = practiceAreasOf(C.settings);
  const mcs = matterCodesOf(C.settings);
  const [paSel, setPaSel] = useState(0);
  const [paNew, setPaNew] = useState<[string, string]>(['', '']);
  const [mcNew, setMcNew] = useState<[string, string]>(['', '']);
  const sel = Math.min(paSel, pas.length - 1);
  const SA = pas[sel];

  // Active files per area — counted from the file's saved practice area / type / ref tag.
  const filesFor = (pa: PA) => cases.filter((c) => {
    if (c.status === 'Closed' || c.status === 'Archive') return false;
    const t = String((c as { practiceArea?: string }).practiceArea || c.type || '').toLowerCase();
    const ref = (c.ref || '').toLowerCase();
    const n = pa.name.toLowerCase(), k = pa.code.toLowerCase();
    return t === n || t === k || t.includes(n) || ref.includes(`/${k}/`);
  }).length;

  const mine = SA ? mcs.filter((m) => mcInArea(m, SA)) : [];

  const addPa = () => {
    const n = paNew[0].trim(), c = paNew[1].trim().toUpperCase();
    if (!n || !c) return C.msg('Enter a name and a tag');
    if (pas.some((p) => p.code.toUpperCase() === c || p.name.toLowerCase() === n.toLowerCase())) return C.msg(c + ' or ' + n + ' already exists');
    C.save({ practiceAreas: [...pas, { id: `pa_${Date.now()}`, name: n, code: c, color: '#16223A', description: '' }] }, 'Practice Area Added', `${n} (${c})`);
    setPaNew(['', '']);
    setPaSel(pas.length);
    C.msg('Added practice area "' + n + '"');
  };
  const delPa = (pa: PA, files: number) => {
    if (files) return C.msg(pa.name + ' has active files and cannot be removed');
    C.save({ practiceAreas: pas.filter((p) => p.id !== pa.id), matterCodes: mcs.filter((m) => BUILTIN_MC.has(m.id) || !mcInArea(m, pa)) }, 'Practice Area Removed', `${pa.name} (${pa.code})`);
    setPaSel(0);
    C.msg('Removed practice area "' + pa.name + '"');
  };
  const addMc = () => {
    const n = mcNew[0].trim(), c = mcNew[1].trim().toUpperCase();
    if (!n || !c) return C.msg('Enter a matter type and a code');
    if (mcs.some((m) => m.code.toLowerCase() === c.toLowerCase())) return C.msg('Matter code ' + c + ' already exists');
    C.save({ matterCodes: [...mcs, { id: `mc_${Date.now()}`, name: n, code: c, practiceArea: SA.name }] }, 'Matter Code Added', `${c} · ${n} (${SA.name})`);
    setMcNew(['', '']);
    C.msg('Added matter code ' + c);
  };
  const delMc = (m: MC) => {
    C.save({ matterCodes: mcs.filter((x) => x.id !== m.id) }, 'Matter Code Removed', `${m.code} · ${m.name}`);
    C.msg('Removed matter code ' + m.code);
  };

  const GRID = 'display:grid;grid-template-columns:minmax(0,1fr) 70px minmax(0,1.3fr) 64px 64px;gap:8px;';
  const INP = 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;min-width:0;background:#fff';

  return (
    <div style={css('display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Practice areas</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>Shown when opening a file, on quotations, reports and dashboards. Active files are counted from the file tag.</span></div>
        <div style={css(GRID + 'padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Practice area</span><span>Tag</span><span>Covers</span><span style={css('text-align:right')}>Active files</span><span></span></div>
        {pas.map((p, i) => {
          const files = filesFor(p);
          const builtIn = BUILTIN_PA.has(p.id);
          return (
            <div key={p.id} onClick={() => setPaSel(i)} style={css(GRID + `align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5;cursor:pointer;background:${sel === i ? '#F6F8FA' : '#fff'};box-shadow:inset 3px 0 0 ${sel === i ? '#16223A' : 'transparent'}`)}>
              <span style={css('display:flex;align-items:center;gap:7px;min-width:0')}><span style={css(`width:8px;height:8px;flex-shrink:0;border-radius:9999px;background:${p.color || '#16223A'}`)}></span><span style={css('font-size:11.5px;font-weight:700;color:#16223A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{p.name}</span></span>
              <span style={css('justify-self:start;' + S.tag)}>{p.code}</span>
              <span style={css('font-size:10.5px;color:#5B6478;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{p.description || '—'}</span>
              <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{String(files)}</span>
              {builtIn ? <span style={css('font-size:10px;color:#94A3B8;text-align:center')}>Built-in</span> : <button type="button" onClick={(e) => { e.stopPropagation(); delPa(p, files); }} style={css(S.remove)}>Remove</button>}
            </div>
          );
        })}
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center;padding:9px 14px;background:#FAFBFC')}>
          <input value={paNew[0]} onChange={(e) => setPaNew([e.target.value, paNew[1]])} placeholder="New practice area, e.g. Employment" style={css(INP)} />
          <input value={paNew[1]} onChange={(e) => setPaNew([paNew[0], e.target.value.toUpperCase()])} onKeyDown={(e) => e.key === 'Enter' && addPa()} placeholder="Tag, e.g. EMP" style={css(INP + ';font-family:ui-monospace, monospace;font-weight:700')} />
          <button type="button" onClick={addPa} style={css(S.darkBtn)}>Add area</button>
        </div>
      </div>
      <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Matter codes · {SA?.name || ''}</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>Picked when opening a file · part 4 of the file reference, e.g. {'SHC/SH/NM/' + ((mine[0] && mine[0].code) || SA?.code || 'CODE') + '/QA/001/09-26'}</span></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px 64px;gap:8px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Matter type</span><span>Code</span><span></span></div>
        {mine.map((m) => (
          <div key={m.id} style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px 64px;gap:8px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11.5px;font-weight:600;color:#16223A;min-width:0')}>{m.name}</span>
            <span style={css('justify-self:start;' + S.tag)}>{m.code}</span>
            {BUILTIN_MC.has(m.id) ? <span style={css('font-size:10px;color:#94A3B8;text-align:center')}>Built-in</span> : <button type="button" onClick={() => delMc(m)} style={css(S.remove)}>Remove</button>}
          </div>
        ))}
        {!mine.length && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No matter codes yet. Add one below; until then, staff type a custom code when opening a file.</div>}
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center;padding:9px 14px;background:#FAFBFC')}>
          <input value={mcNew[0]} onChange={(e) => setMcNew([e.target.value, mcNew[1]])} placeholder="Matter type, e.g. Perfection of Charge" style={css(INP)} />
          <input value={mcNew[1]} onChange={(e) => setMcNew([mcNew[0], e.target.value.toUpperCase()])} onKeyDown={(e) => e.key === 'Enter' && addMc()} placeholder="e.g. POC" style={css(INP + ';font-family:ui-monospace, monospace;font-weight:700')} />
          <button type="button" onClick={addMc} style={css(S.darkBtn)}>Add code</button>
        </div>
        <div style={css('padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:10.5px;line-height:1.5;color:#5B6478')}>Codes must be unique across the firm. Built-in areas and codes can't be removed. Existing files keep their reference.</div>
      </div>
    </div>
  );
};
