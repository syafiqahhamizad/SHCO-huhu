import React, { useMemo } from 'react';
import { useRemembered } from '../../../lib/navHistory';
import { useApp } from '../../../context/AppContext';
import type { Case } from '../../../types';
import { identityTokens, isMine } from '../../../lib/identity';
import { isOpenFile } from '../../../lib/moneyByFile';
import { lawyerOf, practiceOf, short, stageIndexOf, stageSet, stagesFor } from './caseModel';
import { HC, weeklyInfo } from './tabs/StatusTab';

/**
 * Case Status (left menu): every open file's status in one list — exactly what each file's
 * Status tab shows (stage, health, this week's progress, next step, flag, whether the weekly
 * update is due). Updates are made on the file's Status tab; click a row to go there.
 */
export const CaseStatusPage: React.FC = () => {
  const { cases = [], currentUser, setCurrentCaseId, setCaseSubTab, setCurrentView } = useApp();
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const [mine, setMine] = useRemembered('status.mine', true);
  const [q, setQ] = useRemembered('status.q', '');
  const [area, setArea] = useRemembered('status.area', 'All');
  const [show, setShow] = useRemembered<'all' | 'due' | 'risk'>('status.show', 'all');

  const rows = useMemo(() => (cases as Case[]).filter(isOpenFile).map((c) => {
    const { cur, prev, due } = weeklyInfo(c);
    const last = cur || prev;
    const stages = stagesFor(practiceOf(c));
    // Nothing is shown as a stage until someone sets it in the file's Status tab.
    const si = stageSet(c) ? stageIndexOf(c) : -1;
    return { c, last, due, stage: si >= 0 ? stages[si] || '—' : 'Not set yet', stageNo: si + 1, stages: stages.length, area: practiceOf(c) || 'Other' };
  }), [cases]);
  const areas = useMemo(() => ['All', ...[...new Set(rows.map((r) => r.area))].sort()], [rows]);
  const mineOf = (c: Case) => isMine(c.lawyerInCharge, me) || isMine(c.lawyers as unknown, me) || isMine(c.partners as unknown, me);
  const lq = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => !mine || mineOf(r.c))
    .filter((r) => area === 'All' || r.area === area)
    .filter((r) => show === 'all' || (show === 'due' ? r.due.label !== 'Updated this week' : r.last && r.last.health !== 'On track'))
    .filter((r) => !lq || [r.c.ref, r.c.title, r.c.clientName, lawyerOf(r.c)].some((x) => String(x || '').toLowerCase().includes(lq)))
    .sort((a, b) => (a.due.label === b.due.label ? String(a.c.ref).localeCompare(String(b.c.ref)) : a.due.label === 'Weekly update overdue' ? -1 : b.due.label === 'Weekly update overdue' ? 1 : 0));
  const open = (c: Case) => { setCaseSubTab('status'); setCurrentCaseId(c.id); setCurrentView('cases'); };
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[11px] font-bold ${on ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-[#DDE3EB] bg-white text-[#16223A]'}`;
  const G = 'grid grid-cols-[minmax(0,1.4fr)_150px_110px_minmax(0,1.6fr)_minmax(0,1.2fr)_130px] gap-3';

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DDE3EB] bg-white px-3.5 py-2.5">
        <button type="button" className={chip(mine)} onClick={() => setMine(true)}>My files</button>
        <button type="button" className={chip(!mine)} onClick={() => setMine(false)}>All files</button>
        <span className="mx-1 h-4 w-px bg-[#DDE3EB]" />
        <button type="button" className={chip(show === 'all')} onClick={() => setShow('all')}>All</button>
        <button type="button" className={chip(show === 'due')} onClick={() => setShow('due')}>Weekly update due</button>
        <button type="button" className={chip(show === 'risk')} onClick={() => setShow('risk')}>At risk / stuck</button>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-md border border-[#DDE3EB] bg-white px-2 py-1 text-[11px]">{areas.map((a) => <option key={a}>{a}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file ref, client, lawyer…" className="ml-auto min-w-[200px] rounded-md border border-[#DDE3EB] px-2.5 py-1.5 text-[11.5px]" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#DDE3EB] bg-white">
        <div className={G + ' min-w-[1050px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-3.5 py-2 text-[9.5px] font-bold uppercase tracking-[.08em] text-[#5B6478]'}>
          <span>File</span><span>Stage</span><span>Health</span><span>This week</span><span>Next step</span><span>Weekly update</span>
        </div>
        {shown.map(({ c, last, due, stage, stageNo, stages }) => (
          <button key={c.id} type="button" onClick={() => open(c)} className={G + ' min-w-[1050px] w-full items-start border-b border-[#F0F2F5] px-3.5 py-2.5 text-left hover:bg-[#F6F8FA]'}>
            <span className="min-w-0"><span className="block truncate font-mono text-[11px] font-bold text-[#3D6B9C]">{c.ref}</span><span className="block truncate text-[12px] font-semibold text-[#16223A]">{c.title}</span><span className="block text-[10.5px] text-[#5B6478]">{lawyerOf(c) || '—'}</span></span>
            <span><span className="block text-[11.5px] font-semibold text-[#16223A]">{stage}</span><span className="block text-[10px] text-[#5B6478]">{stageNo > 0 ? 'stage ' + stageNo + ' of ' + stages : 'set it in the file’s Status tab'}</span></span>
            <span className="text-[11.5px] font-bold" style={{ color: last ? HC[last.health] : '#94A3B8' }}>{last ? last.health : '—'}{last?.flag && last.flag !== 'None' && <span className="block text-[10px] font-semibold text-[#8A6534]">{last.flag}</span>}</span>
            <span className="text-[11.5px] leading-relaxed text-[#16223A]">{last?.progress || <span className="text-[#94A3B8]">No update yet</span>}</span>
            <span className="text-[11.5px] text-[#16223A]">{last?.next ? <>{last.next}<span className="block text-[10px] text-[#5B6478]">by {short(last.nextBy)}</span></> : '—'}</span>
            <span className="justify-self-start rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: due.bg, color: due.fg }}>{due.label}</span>
          </button>
        ))}
        {!shown.length && <div className="px-3.5 py-6 text-center text-[12px] text-[#5B6478]">{rows.length ? 'No file matches.' : 'No open files.'}</div>}
        <div className="bg-[#F6F8FA] px-3.5 py-2 text-[10.5px] text-[#5B6478]">The same status as each file’s <strong>Status</strong> tab. To update a file, click it and use its Status tab.</div>
      </div>
    </div>
  );
};
