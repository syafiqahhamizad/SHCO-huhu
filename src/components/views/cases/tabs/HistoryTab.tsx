import React from 'react';
import { useApp } from '../../../../context/AppContext';
import { css, S, Card } from '../caseUi';
import { whenF } from '../caseModel';
import type { WF } from '../wf';

/** File history: the file's own activity log plus create / delete / restore events from the
 * firm audit log. Read-only. */
export const HistoryTab: React.FC<{ w: WF }> = ({ w }) => {
  const { auditLogs = [] } = useApp();
  const { c } = w;
  const rows = [
    ...(c.activityLogs || []).map((a) => ({ key: a.id, at: a.timestamp, who: a.actor, what: a.title + (a.description && a.description !== a.title ? ' — ' + a.description : '') })),
    ...auditLogs.filter((a) => a.recordId === c.id && a.action !== 'UPDATE').map((a) => ({ key: a.id, at: a.timestamp, who: a.performedBy, what: a.details })),
  ].sort((a, b) => (String(a.at).replace(' ', 'T') < String(b.at).replace(' ', 'T') ? 1 : -1));
  return (
    <Card>
      <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>File history</strong><span style={css(S.sub)}>Every change on this file, recorded automatically. Entries can't be edited or deleted.</span></div>
      <div style={css('display:grid;grid-template-columns:170px 150px minmax(0,1fr);' + S.th)}><span>When</span><span>Who</span><span>What happened</span></div>
      {rows.map((a) => (
        <div key={a.key} style={css('display:grid;grid-template-columns:170px 150px minmax(0,1fr);gap:12px;padding:9px 16px;border-top:1px solid #F0F2F5;font-size:12.5px')}>
          <span style={css('color:#4A5468')}>{whenF(a.at)}</span><span style={css('color:#16223A;font-weight:600')}>{a.who || '—'}</span><span style={css('color:#16223A')}>{a.what}</span>
        </div>
      ))}
      {!rows.length && <div style={css(S.empty)}>Nothing recorded yet.</div>}
    </Card>
  );
};
