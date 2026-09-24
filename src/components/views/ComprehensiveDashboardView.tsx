import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatCard, Donut, MiniBarChart } from '../ui';
import { palette } from '../../lib/designTokens';

const money = (value: number) => `RM ${Math.round(value).toLocaleString()}`;
const dateLabel = (value?: string) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : 'Undated';

export const ComprehensiveDashboardView: React.FC = () => {
  const app = useApp() as any;
  const {
    cases = [], clients = [], deadlines = [], timeEntries = [], expenses = [], users = [], leads = [],
    setCurrentView, setCurrentCaseId,
  } = app;

  const [unbilledFilter, setUnbilledFilter] = useState<'All' | 'Time entries' | 'Disbursements' | 'Vouchers'>('All');

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const openMatter = (id: string) => { setCurrentCaseId(id); setCurrentView('cases'); };

  const activeMatters = cases.filter((c: any) => c.status === 'Active');
  const dormantFiles = cases.filter((c: any) => c.status === 'Pending');
  const openTasks = cases.flatMap((c: any) => (c.tasks || []).filter((t: any) => !['Done', 'Completed'].includes(t.status)));
  const weekDeadlines = deadlines.filter((d: any) => d.status !== 'Completed' && d.dueDate <= weekEnd).sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate));
  const overdueDeadlines = deadlines.filter((d: any) => d.status !== 'Completed' && d.dueDate < today);
  const weekHearings = cases.flatMap((c: any) => (c.hearings || []).filter((h: any) => h.status === 'Scheduled' && h.date >= today && h.date <= weekEnd).map((h: any) => ({ ...h, ref: c.ref, caseId: c.id })));
  const unbilledTime = timeEntries.filter((t: any) => t.billable && !t.billed).reduce((s: number, t: any) => s + Number(t.hours || 0) * Number(t.rate || 0), 0);

  const practiceAreaBreakdown = useMemo(() => {
    const byArea = new Map<string, number>();
    cases.forEach((c: any) => { const area = c.practiceArea || c.type || 'Other'; byArea.set(area, (byArea.get(area) || 0) + 1); });
    const colors = [palette.blue, palette.green, palette.purple, '#B2542F', palette.red, palette.gold];
    return Array.from(byArea.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [cases]);

  const fileStatusBreakdown = useMemo(() => {
    const statuses: { label: string; status: string; color: string }[] = [
      { label: 'Active', status: 'Active', color: palette.green },
      { label: 'Pending', status: 'Pending', color: palette.blue },
      { label: 'Archive', status: 'Archive', color: palette.gold },
      { label: 'Closed', status: 'Closed', color: palette.slate },
    ];
    return statuses.map((s) => ({ label: s.label, value: cases.filter((c: any) => c.status === s.status).length, color: s.color }));
  }, [cases]);

  const staffWorkload = useMemo(() => {
    const staff = users.filter((u: any) => u.status === 'Active' && (u.role === 'Partner' || u.role === 'Lawyer' || u.role === 'Paralegal' || u.staffProfile));
    const colors = [palette.blue, palette.green, palette.purple, palette.gold, '#B2542F'];
    const rows = staff.map((u: any) => ({
      name: u.name,
      role: u.staffProfile?.designation || u.role,
      count: activeMatters.filter((c: any) => c.lawyerInCharge === u.name || (c.lawyers || []).includes(u.name)).length,
    })).filter((r: any) => r.count > 0).sort((a: any, b: any) => b.count - a.count).slice(0, 6);
    const max = Math.max(1, ...rows.map((r: any) => r.count));
    return rows.map((r: any, i: number) => ({ ...r, pct: Math.round((r.count / max) * 100), color: colors[i % colors.length] }));
  }, [users, activeMatters]);

  const referralRows = useMemo(() => {
    const bySource = new Map<string, { source: string; leads: number; converted: number; broughtBy: string }>();
    leads.forEach((l: any) => {
      const key = l.referralSourceCategory || l.source || 'Other';
      const existing = bySource.get(key) || { source: key, leads: 0, converted: 0, broughtBy: l.assignedTo || '' };
      existing.leads += 1;
      if (l.stage === 'Converted') existing.converted += 1;
      bySource.set(key, existing);
    });
    const colors = [palette.blue, palette.green, palette.purple, palette.gold, '#B2542F'];
    return Array.from(bySource.values()).sort((a, b) => b.leads - a.leads).slice(0, 5).map((r, i) => ({ ...r, color: colors[i % colors.length], pct: r.leads ? Math.round((r.converted / r.leads) * 100) : 0 }));
  }, [leads]);

  const topReferringPartner = useMemo(() => {
    const byAssignee = new Map<string, number>();
    leads.forEach((l: any) => { if (l.assignedTo) byAssignee.set(l.assignedTo, (byAssignee.get(l.assignedTo) || 0) + 1); });
    const sorted = Array.from(byAssignee.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] || null;
  }, [leads]);

  const topSource = referralRows[0] || null;

  const unbilledRows = useMemo(() => {
    const timeRows = timeEntries.filter((t: any) => t.billable && !t.billed).map((t: any) => {
      const cs = cases.find((c: any) => c.id === t.caseId);
      return { id: t.id, kind: 'Time entries' as const, ref: cs?.ref || t.caseId, description: t.description || 'Time entry', amount: Number(t.hours || 0) * Number(t.rate || 0) };
    });
    const disbRows = expenses.filter((e: any) => e.billable && !e.billed).map((e: any) => {
      const cs = cases.find((c: any) => c.id === e.caseId);
      return { id: e.id, kind: 'Disbursements' as const, ref: cs?.ref || e.caseId, description: e.description || e.category || 'Disbursement', amount: Number(e.amount || 0) };
    });
    return [...timeRows, ...disbRows];
  }, [timeEntries, expenses, cases]);
  const filteredUnbilled = unbilledFilter === 'All' ? unbilledRows : unbilledRows.filter((r) => r.kind === unbilledFilter);
  const unbilledCounts = {
    All: unbilledRows.length,
    'Time entries': unbilledRows.filter((r) => r.kind === 'Time entries').length,
    Disbursements: unbilledRows.filter((r) => r.kind === 'Disbursements').length,
    Vouchers: 0,
  };

  return (
    <div className="space-y-4 pb-10 text-xs text-[#16223A]">
      <div>
        <h1 className="font-serif text-[17px] font-bold text-[#16223A]">Firm-wide overview</h1>
        <p className="mt-0.5 text-[11.5px] text-[#5B6478]">Everything, across every partner and fee earner — matters, deadlines, hearings, tasks, billing and clients.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Firm active matters" value={activeMatters.length} color={palette.navy} />
        <StatCard label="Deadlines this week" value={weekDeadlines.length} color={palette.red} />
        <StatCard label="Hearings" value={weekHearings.length} color={palette.purple} />
        <StatCard label="Open tasks" value={openTasks.length} color="#2E7D7A" />
        <StatCard label="Unbilled time" value={money(unbilledTime)} color={palette.gold} />
        <StatCard label="Clients" value={clients.length} color={palette.green} />
        <StatCard label="Dormant files" value={dormantFiles.length} color={palette.gold} />
        <StatCard label="Deadlines overdue" value={overdueDeadlines.length} color={palette.red} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <p className="font-bold text-[14.5px] text-[#16223A]">Practice area</p>
          <p className="mt-0.5 text-[10.5px] text-[#5B6478]">By registered practice area / case file category</p>
          <div className="mt-3 flex flex-col items-center gap-3.5">
            <Donut segments={practiceAreaBreakdown} centerLabel={cases.length} centerSub="matters" />
            <div className="flex w-full flex-col gap-1.5 text-[11.5px]">
              {practiceAreaBreakdown.map((seg) => (
                <span key={seg.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />{seg.label} — {cases.length ? Math.round((seg.value / cases.length) * 100) : 0}% ({seg.value} files)</span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <p className="font-bold text-[14.5px] text-[#16223A]">File status &amp; retention</p>
          <p className="mt-0.5 text-[11px] text-[#5B6478]">Dormant, open, active, closed files archived within 7 years.</p>
          <div className="mt-3 flex flex-col items-center gap-3.5">
            <Donut segments={fileStatusBreakdown} centerLabel={cases.length} centerSub="files" />
            <div className="flex w-full flex-col gap-1.5 text-[11.5px]">
              {fileStatusBreakdown.map((seg) => (
                <span key={seg.label} className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />{seg.label}</span><strong>{seg.value} ({cases.length ? Math.round((seg.value / cases.length) * 100) : 0}%)</strong></span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <p className="font-bold text-[14.5px] text-[#16223A]">Firm workload — active files by staff</p>
          <p className="mb-3 mt-0.5 text-[11px] text-[#5B6478]">Active files assigned to each partner, lawyer, and assistant.</p>
          <div className="flex flex-col gap-2.5">
            {staffWorkload.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-[12px]">
                  <span><strong>{s.name}</strong> <span className="text-[10.5px] text-[#5B6478]">· {s.role}</span></span>
                  <strong>{s.count} files</strong>
                </div>
                <div className="mt-1.5 h-[7px] rounded bg-[#F0F2F5]"><div className="h-[7px] rounded" style={{ width: `${s.pct}%`, backgroundColor: s.color }} /></div>
              </div>
            ))}
            {!staffWorkload.length && <p className="py-4 text-center text-[11px] text-slate-400">No active matter assignments yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center justify-between px-4 py-2.5 text-[13px] font-bold text-white" style={{ backgroundColor: palette.navy }}>
              <span>Matter to-do · firm-wide</span>
              <button type="button" onClick={() => setCurrentView('tasks')} className="cursor-pointer text-[11px] font-bold text-white">All →</button>
            </div>
            {openTasks.slice(0, 6).map((task: any, i: number) => (
              <div key={task.id || i} className="border-b border-[#F0F2F5] px-4 py-2.5 last:border-0">
                <p className="text-[12px] font-bold">{task.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[#5B6478]">{task.description || ''}</p>
              </div>
            ))}
            {!openTasks.length && <p className="px-4 py-6 text-center text-[11px] text-slate-400">No open firm-wide tasks.</p>}
          </div>
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center justify-between px-4 py-2.5 text-[13px] font-bold text-white" style={{ backgroundColor: palette.purple }}>
              <span>Hearings · firm-wide</span>
              <button type="button" onClick={() => setCurrentView('hearings')} className="cursor-pointer text-[11px] font-bold text-white">All →</button>
            </div>
            {weekHearings.slice(0, 6).map((h: any) => (
              <button type="button" key={h.id} onClick={() => openMatter(h.caseId)} className="flex w-full items-center justify-between gap-3 border-b border-[#F0F2F5] px-4 py-2.5 text-left last:border-0 hover:bg-[#F6F8FA]">
                <div><p className="text-[12px] font-bold">{h.title || h.purpose}</p><p className="mt-0.5 text-[10.5px] text-[#5B6478]">{dateLabel(h.date)} · {h.ref}</p></div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: '#F1EBF6', color: palette.purple }}>{h.type || 'Hearing'}</span>
              </button>
            ))}
            {!weekHearings.length && <p className="px-4 py-6 text-center text-[11px] text-slate-400">No hearings in the next seven days.</p>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center justify-between px-4 py-2.5 text-[13px] font-bold text-white" style={{ backgroundColor: palette.red }}>
              <span>Deadlines this week</span>
              <button type="button" onClick={() => setCurrentView('deadlines')} className="cursor-pointer text-[11px] font-bold text-white">All →</button>
            </div>
            {weekDeadlines.slice(0, 6).map((d: any) => (
              <div key={d.id} className="border-b border-[#F0F2F5] px-4 py-2.5 last:border-0">
                <p className="text-[12px] font-bold">{d.title}</p>
                <p className="mt-0.5 text-[10.5px] text-[#5B6478]">{d.type || 'Deadline'} · {dateLabel(d.dueDate)}</p>
              </div>
            ))}
            {!weekDeadlines.length && <p className="px-4 py-6 text-center text-[11px] text-slate-400">No deadlines due this week.</p>}
          </div>
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center justify-between border-b border-[#DDE3EB] px-4 py-2.5 text-[13px] font-bold text-[#16223A]">
              <span>Recently accessed matters · firm-wide</span>
              <button type="button" onClick={() => setCurrentView('cases')} className="cursor-pointer text-[11px] font-bold text-[#8A6D3B]">All →</button>
            </div>
            {[...cases].filter((c: any) => c.lastAccessed).sort((a: any, b: any) => String(b.lastAccessed).localeCompare(String(a.lastAccessed))).slice(0, 6).map((c: any) => (
              <button type="button" key={c.id} onClick={() => openMatter(c.id)} className="flex w-full items-center justify-between gap-3 border-b border-[#F0F2F5] px-4 py-2.5 text-left last:border-0 hover:bg-[#F6F8FA]">
                <span><strong className="mr-1.5 font-mono text-[10.5px]" style={{ color: palette.blue }}>{c.ref}</strong>{c.title}</span>
                <span>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EB] bg-white p-5">
        <p className="font-serif text-[16px] font-bold text-[#16223A]">Referral Sources — firm-wide</p>
        <p className="mb-3 mt-0.5 text-[12px] text-[#5B6478]">Every lead source across the firm — who brought it in, and how many converted.</p>
        <div className="mb-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-[#F4F6F9] p-3">
            <p className="text-[10px] font-bold uppercase text-[#5B6478]">🏆 Top referring partner</p>
            <p className="mt-1 text-[15px] font-bold text-[#16223A]">{topReferringPartner?.[0] || '—'}</p>
            <p className="mt-0.5 text-[11px] text-[#5B6478]">{topReferringPartner?.[1] || 0} leads brought in</p>
          </div>
          <div className="rounded-lg bg-[#F4F6F9] p-3">
            <p className="text-[10px] font-bold uppercase text-[#5B6478]">🥇 Top source</p>
            <p className="mt-1 text-[15px] font-bold text-[#16223A]">{topSource?.source || '—'}</p>
            <p className="mt-0.5 text-[11px] text-[#5B6478]">{topSource?.leads || 0} leads · {topSource?.pct || 0}% converted</p>
          </div>
        </div>
        <table className="w-full text-left text-[11px]">
          <thead><tr className="text-[#5B6478]"><th className="pb-1.5">Source</th><th className="pb-1.5">Brought by</th><th className="pb-1.5 text-right">Leads</th><th className="pb-1.5 text-right">Converted</th><th className="pb-1.5 text-right">%</th></tr></thead>
          <tbody>
            {referralRows.map((r) => (
              <tr key={r.source} className="border-t border-[#F0F2F5]">
                <td className="py-1.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />{r.source}</td>
                <td className="py-1.5 text-[#5B6478]">{r.broughtBy || '—'}</td>
                <td className="py-1.5 text-right">{r.leads}</td>
                <td className="py-1.5 text-right">{r.converted}</td>
                <td className="py-1.5 text-right font-bold">{r.pct}%</td>
              </tr>
            ))}
            {!referralRows.length && <tr><td colSpan={5} className="py-4 text-center text-slate-400">No referral leads recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[#DDE3EB] bg-white p-5">
        <p className="font-serif text-[16px] font-bold text-[#16223A]">Unbilled items — firm-wide</p>
        <p className="mb-3 mt-0.5 text-[12px] text-[#5B6478]">Filterable by category, to ensure timely billing across the firm.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['All', 'Time entries', 'Disbursements', 'Vouchers'] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setUnbilledFilter(label)}
              className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${unbilledFilter === label ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-[#DDE3EB] bg-white text-[#5B6478]'}`}
            >
              {label} ({unbilledCounts[label]})
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {filteredUnbilled.slice(0, 8).map((r) => (
            <div key={r.id} className="flex items-center justify-between border-t border-[#F0F2F5] py-2 text-[12.5px] first:border-t-0">
              <span><strong className="mr-1.5 font-mono text-[11px]" style={{ color: palette.blue }}>{r.ref}</strong>{r.kind === 'Time entries' ? 'Time entry' : 'Disbursement'} — {r.description}</span>
              <strong>{money(r.amount)}</strong>
            </div>
          ))}
          {!filteredUnbilled.length && <p className="py-6 text-center text-[11px] text-slate-400">Nothing unbilled in this category.</p>}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveDashboardView;
