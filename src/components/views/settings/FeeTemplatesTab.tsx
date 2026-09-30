import React, { useMemo, useState } from 'react';
import type { FeeTemplate } from '../../../services/templateService';
import { builtInFeeTemplates } from '../../../lib/financeDocs';
import { css, S, Txt, Area, type SettingsCtx } from './settingsShared';
import { practiceAreasOf } from './AreasTab';

type Sec = 'prof' | 'disb' | 'reimb';
const SECTIONS: [Sec, string][] = [['prof', 'Professional fees'], ['disb', 'Disbursement'], ['reimb', 'Reimbursement']];
const EMPTY: FeeTemplate = { desc: '', prof: [], disb: [], reimb: [] };

export const FeeTemplatesTab = ({ C }: { C: SettingsCtx }) => {
  const pas = practiceAreasOf(C.settings);
  const [area, setArea] = useState(0);
  const builtIn = useMemo(() => builtInFeeTemplates(), []);
  const saved = C.settings.feeTemplates || {};
  const T = (tag: string): FeeTemplate | undefined => saved[tag] || builtIn[tag];
  const areaI = Math.min(area, pas.length - 1);
  const PA = pas[areaI];
  const KEY = PA?.code || '';
  const A = T(KEY) || EMPTY;
  const isNew = !T(KEY);

  const upd = (f: (a: FeeTemplate) => FeeTemplate, what: string) => {
    const cur = T(KEY) || EMPTY;
    const cp = (l: FeeTemplate['prof']) => (l || []).map((x) => ({ d: x.d, a: x.a }));
    C.save({ feeTemplates: { ...saved, [KEY]: f({ desc: cur.desc, prof: cp(cur.prof), disb: cp(cur.disb), reimb: cp(cur.reimb) }) } }, 'Fee Template Changed', PA.name + ' · ' + what);
  };
  const edit = (k: Sec, li: number, ci: 0 | 1, v: string) => upd((a) => ({ ...a, [k]: a[k].map((l, y) => (y === li ? (ci === 1 ? { d: l.d, a: Number(String(v).replace(/[^0-9.]/g, '')) || 0 } : { d: v, a: l.a }) : l)) }), (ci === 1 ? 'amount' : 'line') + ': ' + v);

  if (!PA) return <div style={css(S.card + ';padding:14px;font-size:11px;color:#5B6478')}>No practice areas yet. Add one in Practice areas &amp; codes first.</div>;

  return (
    <div style={css('display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css(S.card)}>
        {pas.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setArea(i)} style={css(`width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-bottom:1px solid #F0F2F5;cursor:pointer;font-family:inherit;text-align:left;background:${areaI === i ? '#F6F8FA' : '#fff'};border-left:3px solid ${areaI === i ? '#16223A' : 'transparent'}`)}><span style={css('display:flex;flex-direction:column;min-width:0')}><span style={css('font-size:12px;font-weight:700;color:#16223A')}>{p.name}</span><span style={css('font-size:9.5px;color:#94A3B8')}>{T(p.code) ? '' : 'no template yet'}</span></span><span style={css('margin-left:auto;padding:2px 7px;border-radius:5px;background:#16223A;color:#E9C46A;font-family:ui-monospace, monospace;font-size:10px;font-weight:700')}>{p.code}</span></button>
        ))}
        <div style={css('padding:9px 14px;font-size:10.5px;line-height:1.5;color:#5B6478')}>Areas come from Practice areas &amp; codes. Add a new area there first.</div>
      </div>
      <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>{PA.name} · default quotation</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>loads when staff pick this practice area; can still be changed per document</span></div>
        <div style={css('padding:12px 14px;display:flex;flex-direction:column;gap:10px')}>
          {isNew && <div style={css('padding:8px 12px;border-radius:8px;background:#FFFBF3;border:1px solid #EAD9B8;font-size:11px;color:#8A6534')}>No default quotation for this area yet. Add lines below and they'll load for new quotations.</div>}
          {SECTIONS.map(([k, title]) => (
            <div key={k} style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
              <div style={css('padding:6px 12px;background:#F6F8FA;font-size:11px;font-weight:700;color:#16223A')}>{title}</div>
              {k === 'prof' && <label style={css('display:flex;flex-direction:column;gap:4px;padding:8px 12px;border-top:1px solid #F0F2F5')}><span style={css(S.fieldLabel)}>Scope of work</span><Area value={A.desc} rows={4} onCommit={(v) => upd((a) => ({ ...a, desc: v }), 'scope of work')} style="border:1px solid #DDE3EB;border-radius:6px;padding:7px 9px;font-size:11.5px;line-height:1.45;color:#16223A;resize:vertical;font-family:inherit" /></label>}
              {A[k].map(({ d, a }, li) => (
                <div key={k + li} style={css('display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px;padding:4px 12px;border-top:1px solid #F0F2F5')}>
                  <Txt value={d} onCommit={(v) => edit(k, li, 0, v)} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A" />
                  <Txt value={String(a)} onCommit={(v) => edit(k, li, 1, v)} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;text-align:right" />
                </div>
              ))}
              <div style={css('padding:5px 12px;border-top:1px solid #F0F2F5')}><button type="button" onClick={() => upd((a) => ({ ...a, [k]: [...a[k], { d: '', a: 0 }] }), 'added a ' + title.toLowerCase() + ' line')} style={css(S.addLink)}>+ Add line</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
