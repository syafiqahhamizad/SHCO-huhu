import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { palette, tintText, serifFont } from '../../../lib/designTokens';
import { getPracticeSettings } from '../../../services/templateService';
import type { Case, FirmGoal, Milestone } from '../../../types';
import { StatusBadge } from '../../ui';
import { X } from 'lucide-react';

/**
 * "Direction" sub-tab of My Dashboard, Managing Partner only, with Growth merged in.
 * Replicates the isDir block of design/My Dashboard.dc.html (lines ~294-421) exactly: Vision
 * / Mission / 2028 target, the Business roadmap 2026-2028, "2026 plan" goal cards, Practice
 * areas (Grow / Hold / Rethink), Client concentration, private partner notes, then the
 * Growth half — Panelships, "Where to put money", the enquiry funnel, practice-area lead
 * mix, Google reviews and Social media & website.
 *
 * Vision/mission/target, the roadmap, 2026 goals, panelships and investment channels are
 * firm-maintained content persisted on PracticeSettings (services/templateService.ts) via
 * AppContext mutators — there is no other real data source for a multi-year plan or a
 * marketing-spend ledger, so every one of these starts empty until the Managing Partner
 * fills it in (never seeded with sample content). Practice areas, client concentration, the
 * 2026 goals that map to something measurable (fee income, new clients) and the enquiry
 * funnel are all computed from real useApp() data (cases, invoices, payments, timeEntries,
 * expenses, clients, leads) — nothing there is fabricated.
 *
 * Two sections could not be built as the mockup literally shows them because the data they'd
 * need doesn't exist in this system yet, and inventing it would violate the "never fabricate"
 * rule:
 *  - "Growing practice areas" needs each lead's enquiry date to bucket by month; `Lead` has no
 *    creation/enquiry date field. This renders today's lead mix by practice area instead of a
 *    6-month trend, with a note explaining why.
 *  - Google reviews and Social media & website need a Google Business Profile / Meta / TikTok
 *    / Analytics connection, none of which exists in this codebase. Both render an honest
 *    "Not connected yet" state instead of a fabricated rating or follower counts.
 */
export const DirectionTab: React.FC = () => {
  const {
    cases,
    invoices,
    payments,
    timeEntries,
    expenses,
    clients,
    leads,
    updateDirectionStatement,
    updatePartnersNotes,
    addMilestone,
    updateMilestone,
    cycleMilestoneStatus,
    addFirmGoal,
    updateFirmGoal,
    removeFirmGoal,
    addPanelship,
    updatePanelship,
    removePanelship,
    addInvestmentChannel,
    updateInvestmentChannel,
    removeInvestmentChannel,
  } = useApp();

  const [settings, setSettings] = useState(() => getPracticeSettings());
  const [editingGoals, setEditingGoals] = useState(false);

  useEffect(() => {
    const onUpdate = () => setSettings(getPracticeSettings());
    window.addEventListener('shco-practice-settings-updated', onUpdate);
    return () => window.removeEventListener('shco-practice-settings-updated', onUpdate);
  }, []);

  const roadmap = settings.roadmap || [];
  const firmGoals = settings.firmGoals || [];
  const panelships = settings.panelships || [];
  const investmentChannels = settings.investmentChannels || [];

  /* ----------------------------- formatting helpers ----------------------------- */

  const fmtCompact = (n: number): string => {
    const neg = n < 0;
    const abs = Math.abs(n);
    let s: string;
    if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'm';
    else if (abs >= 10_000) s = Math.round(abs / 1000) + 'k';
    else if (abs >= 1000) s = (abs / 1000).toFixed(1) + 'k';
    else s = Math.round(abs).toLocaleString('en-MY');
    return (neg ? '−' : '') + 'RM ' + s;
  };

  const formatGoalValue = (label: string, value: number): string => {
    const l = label.toLowerCase();
    if (l.includes('rate') || l.includes('%') || l.includes('percent')) return `${Math.round(value)}%`;
    if (l.includes('fee') || l.includes('rm') || l.includes('unpaid') || l.includes('billed') || l.includes('collect')) return fmtCompact(value);
    return Math.round(value).toLocaleString('en-MY');
  };

  /* ----------------------------- date bounds ----------------------------- */

  const now = useMemo(() => new Date(), []);
  const yearStart = useMemo(() => new Date(now.getFullYear(), 0, 1), [now]);
  const ytdEnd = useMemo(() => new Date(now.getTime() + 86_400_000), [now]); // exclusive, includes today
  const lastYearStart = useMemo(() => new Date(now.getFullYear() - 1, 0, 1), [now]);
  const lastYtdEnd = useMemo(() => new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1), [now]);

  const inRange = (dateStr: string | undefined, start: Date, end: Date): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d < end;
  };

  /* ----------------------------- shared lookups ----------------------------- */

  const caseById = useMemo(() => new Map<string, Case>(cases.map((c) => [c.id, c])), [cases]);
  const practiceAreaOf = (c?: Case) => c?.practiceArea || c?.type || 'Unclassified';
  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const validInvoices = useMemo(() => invoices.filter((i) => i.status !== 'Voided'), [invoices]);
  const invoiceMeta = useMemo(() => {
    const m = new Map<string, { area: string; clientId: string }>();
    validInvoices.forEach((inv) => {
      m.set(inv.id, { area: practiceAreaOf(caseById.get(inv.caseId)), clientId: inv.clientId });
    });
    return m;
  }, [validInvoices, caseById]);

  /* ----------------------------- Practice areas (real, year to date) ----------------------------- */

  const practiceAreas = useMemo(() => {
    const feesYtd = new Map<string, number>();
    const feesLastYtd = new Map<string, number>();
    payments.forEach((p) => {
      const meta = invoiceMeta.get(p.invoiceId);
      if (!meta) return;
      if (inRange(p.date, yearStart, ytdEnd)) feesYtd.set(meta.area, (feesYtd.get(meta.area) || 0) + Number(p.amount || 0));
      if (inRange(p.date, lastYearStart, lastYtdEnd)) feesLastYtd.set(meta.area, (feesLastYtd.get(meta.area) || 0) + Number(p.amount || 0));
    });

    const timeCost = new Map<string, number>();
    timeEntries
      .filter((t) => t.billable && inRange(t.date, yearStart, ytdEnd))
      .forEach((t) => {
        const area = practiceAreaOf(caseById.get(t.caseId));
        timeCost.set(area, (timeCost.get(area) || 0) + Number(t.hours || 0) * Number(t.rate || 0));
      });

    const directExp = new Map<string, number>();
    expenses
      .filter((e) => e.billable && inRange(e.date, yearStart, ytdEnd))
      .forEach((e) => {
        const area = practiceAreaOf(caseById.get(e.caseId));
        directExp.set(area, (directExp.get(area) || 0) + Number(e.amount || 0));
      });

    const areaNames = new Set<string>([...cases.map((c) => practiceAreaOf(c)), ...feesYtd.keys()]);
    const totalFees = [...feesYtd.values()].reduce((s, v) => s + v, 0);
    const maxFees = Math.max(1, ...feesYtd.values());

    const rows = [...areaNames].map((name) => {
      const fees = feesYtd.get(name) || 0;
      const lastFees = feesLastYtd.get(name) || 0;
      const cost = (timeCost.get(name) || 0) + (directExp.get(name) || 0);
      const margin = fees > 0 ? Math.round(((fees - cost) / fees) * 100) : cost > 0 ? -100 : 0;
      const growth = lastFees > 0 ? Math.round(((fees - lastFees) / lastFees) * 100) : fees > 0 ? 100 : 0;
      // Signal rule (no equivalent formula in the mockup, which hand-assigned these):
      // Grow = growing fees and a healthy margin; Rethink = shrinking or thin margin; else Hold.
      const signal: 'Grow' | 'Hold' | 'Rethink' = growth > 10 && margin >= 30 ? 'Grow' : growth < -10 || margin < 15 ? 'Rethink' : 'Hold';
      return { name, fees, share: totalFees > 0 ? Math.round((fees / totalFees) * 100) : 0, w: Math.round((fees / maxFees) * 100), growth, margin, signal };
    });

    rows.sort((a, b) => b.fees - a.fees);
    return { rows, totalFees };
  }, [cases, payments, invoiceMeta, timeEntries, expenses, caseById, yearStart, ytdEnd, lastYearStart, lastYtdEnd]);

  const SIGNAL_TONE: Record<'Grow' | 'Hold' | 'Rethink', 'green' | 'blue' | 'red'> = { Grow: 'green', Hold: 'blue', Rethink: 'red' };

  /* ----------------------------- Client concentration (real, year to date) ----------------------------- */

  const concentration = useMemo(() => {
    const feesByClient = new Map<string, number>();
    payments.forEach((p) => {
      const meta = invoiceMeta.get(p.invoiceId);
      if (!meta || !inRange(p.date, yearStart, ytdEnd)) return;
      feesByClient.set(meta.clientId, (feesByClient.get(meta.clientId) || 0) + Number(p.amount || 0));
    });
    const sorted = [...feesByClient.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    const top3 = sorted.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    const next7 = sorted.slice(3, 10).reduce((s, [, v]) => s + v, 0);
    const rest = Math.max(0, total - top3 - next7);
    const restCount = Math.max(0, sorted.length - 10);
    const top1 = sorted[0];
    const top1Pct = total > 0 && top1 ? Math.round((top1[1] / total) * 100) : 0;
    const top1Name = top1 ? clientNameById.get(top1[0]) || 'that client' : '';
    return {
      total,
      top3Pct: total > 0 ? Math.round((top3 / total) * 100) : 0,
      next7Pct: total > 0 ? Math.round((next7 / total) * 100) : 0,
      restPct: total > 0 ? Math.round((rest / total) * 100) : 0,
      restCount,
      top1Pct,
      top1Name,
      clientCount: sorted.length,
    };
  }, [payments, invoiceMeta, yearStart, ytdEnd, clientNameById]);

  const concentrationTone: 'green' | 'gold' | 'red' =
    concentration.top1Pct >= 25 ? 'red' : concentration.top1Pct >= 15 ? 'gold' : 'green';
  const concentrationLabel = concentration.top1Pct >= 25 ? 'High risk' : concentration.top1Pct >= 15 ? 'Watch' : 'Healthy';

  /* ----------------------------- 2026 plan goals ----------------------------- */

  const newClientsYtd = useMemo(() => clients.filter((c) => c.createdAt && inRange(c.createdAt, yearStart, ytdEnd)).length, [clients, yearStart, ytdEnd]);

  const isComputedGoal = (label: string) => /fee|client/i.test(label);
  const computedGoalNow = (g: FirmGoal): number => {
    const l = g.label.toLowerCase();
    if (l.includes('client')) return newClientsYtd;
    if (l.includes('fee')) return practiceAreas.totalFees;
    return g.now;
  };

  const GOAL_STATUS_OPTIONS = ['On track', 'Behind', 'At risk'] as const;
  const GOAL_STATUS_TONE: Record<string, 'green' | 'gold' | 'red'> = { 'On track': 'green', Behind: 'gold', 'At risk': 'red' };
  const GOAL_STATUS_COLOR: Record<string, string> = { 'On track': palette.green, Behind: tintText.gold, 'At risk': palette.red };

  const currentYear = now.getFullYear();
  const monthsIn = now.getMonth() + 1;
  const dayOfYear = Math.floor((now.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  const daysInYear = Math.round((new Date(currentYear + 1, 0, 1).getTime() - yearStart.getTime()) / 86_400_000);
  const pctYearElapsed = Math.max(0, Math.min(100, Math.round((dayOfYear / daysInYear) * 100)));

  /* ----------------------------- Roadmap ----------------------------- */

  const ROADMAP_YEARS = [2026, 2027, 2028];
  const MILESTONE_TONE: Record<Milestone['status'], 'slate' | 'blue' | 'red' | 'green'> = {
    'Not started': 'slate',
    'On track': 'blue',
    Behind: 'red',
    Done: 'green',
  };
  const roadmapByYear = useMemo(() => {
    const map = new Map<number, Milestone[]>();
    ROADMAP_YEARS.forEach((y) => map.set(y, []));
    roadmap.forEach((m) => {
      const arr = map.get(m.year) || [];
      arr.push(m);
      map.set(m.year, arr);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap]);
  const rmSummary = useMemo(() => {
    const count = (k: Milestone['status']) => roadmap.filter((m) => m.status === k).length;
    return `${count('Done')} done · ${count('On track')} on track · ${count('Behind')} behind · ${count('Not started')} not started`;
  }, [roadmap]);

  /* ----------------------------- Growth: panelships & investment ----------------------------- */

  const PANEL_STATUS_OPTIONS = ['Appointed', 'Tender open', 'Interview', 'Target', 'Rejected'] as const;
  const PANEL_STATUS_TONE: Record<string, 'green' | 'gold' | 'blue' | 'slate' | 'red'> = {
    Appointed: 'green',
    'Tender open': 'gold',
    Interview: 'blue',
    Target: 'slate',
    Rejected: 'red',
  };
  const appointedCount = panelships.filter((p) => p.status === 'Appointed').length;
  const inProgressCount = panelships.filter((p) => p.status === 'Tender open' || p.status === 'Interview').length;

  const investRows = useMemo(
    () =>
      investmentChannels.map((c) => {
        const ret = c.spend > 0 ? c.feesWon / c.spend : null;
        // Return-based signal — the mockup's own footnote: "Anything above 5x is worth scaling."
        const signal: 'Scale' | 'Hold' | 'Fix' | 'Cut' = ret === null ? 'Hold' : ret >= 5 ? 'Scale' : ret >= 3 ? 'Hold' : ret >= 1.5 ? 'Fix' : 'Cut';
        return { ...c, ret, signal };
      }),
    [investmentChannels]
  );
  const INVEST_TONE: Record<'Scale' | 'Hold' | 'Fix' | 'Cut', 'green' | 'blue' | 'gold' | 'red'> = { Scale: 'green', Hold: 'blue', Fix: 'gold', Cut: 'red' };

  /* ----------------------------- Growth: enquiry funnel (real, from leads) ----------------------------- */

  const funnel = useMemo(() => {
    const total = leads.length;
    const contactedPlus = leads.filter((l) => ['Contacted', 'Consultation', 'Quoted', 'Converted'].includes(l.stage)).length;
    const consultationPlus = leads.filter((l) => ['Consultation', 'Quoted', 'Converted'].includes(l.stage)).length;
    const converted = leads.filter((l) => l.stage === 'Converted').length;
    const rows = [
      { label: 'Enquiries', n: total, color: '#C9D3E0' },
      { label: 'Called back / contacted', n: contactedPlus, color: '#94A3B8' },
      { label: 'Consultations', n: consultationPlus, color: palette.blue },
      { label: 'Became clients', n: converted, color: palette.green },
    ];
    return rows.map((r) => ({ ...r, w: total > 0 ? Math.round((r.n / total) * 100) : 0 }));
  }, [leads]);

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const funnelPeriodLabel = `${MONTH_NAMES[now.getMonth()]} ${currentYear}`;

  /* ----------------------------- Growth: lead mix by practice area (real, snapshot) ----------------------------- */

  const leadMix = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => map.set(l.practiceArea || 'Unclassified', (map.get(l.practiceArea || 'Unclassified') || 0) + 1));
    const rows = [...map.entries()].map(([name, n]) => ({ name, n }));
    rows.sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, w: Math.round((r.n / max) * 100) }));
  }, [leads]);

  /* ============================================================================================= */

  return (
    <div className="flex flex-col gap-4 pb-8 text-[12px]">
      {/* Vision / Mission / 2028 target */}
      <section className="grid grid-cols-3 gap-4">
        {([
          { key: 'vision' as const, label: 'Vision', placeholder: 'Where the firm is going' },
          { key: 'mission' as const, label: 'Mission', placeholder: 'What we promise clients' },
          { key: 'target2028' as const, label: 'Where we want to be by 2028', placeholder: 'A concrete 2028 target' },
        ]).map((v) => (
          <div key={v.key} className="flex flex-col gap-1.5 overflow-hidden rounded-xl border bg-white p-3.5" style={{ borderColor: palette.border }}>
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: '#8A6D3B' }}>
              {v.label}
            </span>
            <textarea
              value={(settings[v.key] as string) || ''}
              onChange={(e) => updateDirectionStatement(v.key, e.target.value)}
              placeholder={v.placeholder}
              rows={3}
              className="w-full resize-y rounded-lg p-2"
              style={{ border: '1px solid #E3E7EC', fontSize: '12.5px', lineHeight: 1.5, fontFamily: serifFont, color: palette.navy, background: '#FBFCFD' }}
            />
          </div>
        ))}
      </section>

      {/* Business roadmap 2026-2028 */}
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
          <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
            Business roadmap 2026–2028
          </strong>
          <span className="text-[10.5px]" style={{ color: palette.slate }}>
            {rmSummary}
          </span>
        </div>
        <div className="grid grid-cols-3">
          {ROADMAP_YEARS.map((year, yi) => {
            const items = roadmapByYear.get(year) || [];
            return (
              <div key={year} className="px-3.5 pb-3 pt-2.5" style={{ borderLeft: yi ? '1px solid #EEF1F5' : '0' }}>
                <div className="mb-1.5 flex items-center gap-2">
                  <strong className="text-[16px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                    {year}
                  </strong>
                </div>
                {items.length === 0 && (
                  <p className="m-0 py-1.5 text-[10.5px]" style={{ color: palette.slate }}>
                    No milestones yet.
                  </p>
                )}
                {items.map((m, ii) => (
                  <div key={m.id} className="flex items-center gap-2 py-1" style={{ borderTop: ii ? '1px solid #F0F2F5' : '0' }}>
                    <button
                      type="button"
                      onClick={() => cycleMilestoneStatus(m.id)}
                      title="Click to change status"
                      className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-bold"
                    >
                      <StatusBadge label={m.status} tone={MILESTONE_TONE[m.status]} />
                    </button>
                    <input
                      value={m.text}
                      onChange={(e) => updateMilestone(m.id, { text: e.target.value })}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[11.5px] outline-none"
                      style={{ color: palette.navy }}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => addMilestone(year)} className="mt-1.5 text-[10.5px] font-bold" style={{ color: '#8A6D3B' }}>
                  + Add milestone
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2026 plan */}
      <div className="mt-1 flex items-center gap-2.5">
        <strong className="text-[18px]" style={{ fontFamily: serifFont, color: palette.navy }}>
          {currentYear} plan · {monthsIn} month{monthsIn === 1 ? '' : 's'} in
        </strong>
        <span className="text-[10.5px]" style={{ color: palette.slate }}>
          Goals are set by you and can be edited
        </span>
        <button
          type="button"
          onClick={() => setEditingGoals((v) => !v)}
          className="ml-auto whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-[11px] font-bold"
          style={{ borderColor: palette.border, color: palette.navy }}
        >
          {editingGoals ? 'Done editing' : 'Edit goals'}
        </button>
      </div>

      {firmGoals.length === 0 ? (
        <div className="rounded-xl border bg-white p-4 text-center" style={{ borderColor: palette.border }}>
          <p className="m-0 text-[11.5px]" style={{ color: palette.slate }}>
            No {currentYear} goals set yet.
          </p>
          <button
            type="button"
            onClick={() => addFirmGoal({ label: 'New goal', now: 0, goal: 0, status: 'On track', note: '' })}
            className="mt-2 text-[10.5px] font-bold"
            style={{ color: '#8A6D3B' }}
          >
            + Add your first goal
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-4 gap-3">
          {firmGoals.map((g) => {
            const now2 = computedGoalNow(g);
            const computed = isComputedGoal(g.label);
            const w = g.goal > 0 ? Math.min(100, Math.round((now2 / g.goal) * 100)) : 0;
            const tone = GOAL_STATUS_TONE[g.status] || 'blue';
            const color = GOAL_STATUS_COLOR[g.status] || palette.blue;
            return (
              <div key={g.id} className="flex flex-col gap-1.5 rounded-xl border bg-white p-3.5" style={{ borderColor: palette.border }}>
                {editingGoals ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={g.label}
                        onChange={(e) => updateFirmGoal(g.id, { label: e.target.value })}
                        className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold"
                        style={{ border: '1px solid #E3E7EC', color: palette.navy }}
                      />
                      <button type="button" onClick={() => removeFirmGoal(g.id)} title="Remove" style={{ color: '#94A3B8' }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <label className="flex items-center justify-between text-[10px]" style={{ color: palette.slate }}>
                      Now
                      <input
                        type="number"
                        value={g.now}
                        disabled={computed}
                        onChange={(e) => updateFirmGoal(g.id, { now: Number(e.target.value) || 0 })}
                        className="w-24 rounded px-1.5 py-0.5 text-right text-[11px]"
                        style={{ border: '1px solid #E3E7EC', color: palette.navy, background: computed ? '#F6F8FA' : '#fff' }}
                        title={computed ? 'Computed automatically from real data' : undefined}
                      />
                    </label>
                    <label className="flex items-center justify-between text-[10px]" style={{ color: palette.slate }}>
                      Goal
                      <input
                        type="number"
                        value={g.goal}
                        onChange={(e) => updateFirmGoal(g.id, { goal: Number(e.target.value) || 0 })}
                        className="w-24 rounded px-1.5 py-0.5 text-right text-[11px]"
                        style={{ border: '1px solid #E3E7EC', color: palette.navy }}
                      />
                    </label>
                    <select
                      value={g.status}
                      onChange={(e) => updateFirmGoal(g.id, { status: e.target.value })}
                      className="rounded px-1.5 py-0.5 text-[10.5px]"
                      style={{ border: '1px solid #E3E7EC', color: palette.navy }}
                    >
                      {GOAL_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      value={g.note || ''}
                      onChange={(e) => updateFirmGoal(g.id, { note: e.target.value })}
                      placeholder="Note"
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ border: '1px solid #E3E7EC', color: palette.slate }}
                    />
                  </div>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: palette.slate }}>
                        {g.label}
                      </span>
                      <span className="ml-auto">
                        <StatusBadge label={g.status} tone={tone} />
                      </span>
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[22px] font-bold" style={{ fontFamily: serifFont, color: palette.navy }}>
                        {formatGoalValue(g.label, now2)}
                      </span>
                      <span className="whitespace-nowrap text-[11px]" style={{ color: palette.slate }}>
                        of {formatGoalValue(g.label, g.goal)}
                      </span>
                    </span>
                    <span className="relative block h-1.5 rounded" style={{ background: '#EEF1F5' }}>
                      <span className="absolute left-0 top-0 block h-1.5 rounded" style={{ background: color, width: `${w}%` }} />
                      <span className="absolute" style={{ top: '-3px', width: '2px', height: '12px', background: palette.navy, left: `${pctYearElapsed}%` }} />
                    </span>
                    <span className="text-[10.5px]" style={{ color: palette.slate }}>
                      {g.note}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}
      <p className="-mt-2 text-[10.5px]" style={{ color: palette.slate }}>
        Black tick = where you should be by now ({pctYearElapsed}% of the year).
      </p>

      {/* Practice areas + Client concentration + Notes */}
      <section className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Practice areas
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              where to grow, hold or rethink · year to date
            </span>
          </div>
          <div
            className="grid gap-3 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
            style={{ gridTemplateColumns: 'minmax(0,1.2fr) 90px 70px 80px 80px 96px', background: palette.page, borderBottom: '1px solid #EEF1F5', color: palette.slate }}
          >
            <span>Area</span>
            <span className="text-right">Fees</span>
            <span className="text-right">Share</span>
            <span className="text-right">vs {currentYear - 1}</span>
            <span className="text-right">Margin</span>
            <span>Signal</span>
          </div>
          {practiceAreas.rows.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No billed fees recorded yet.
            </div>
          )}
          {practiceAreas.rows.map((a, i) => (
            <div
              key={a.name}
              className="grid items-center gap-3 px-3.5 py-2"
              style={{ gridTemplateColumns: 'minmax(0,1.2fr) 90px 70px 80px 80px 96px', borderBottom: i < practiceAreas.rows.length - 1 ? '1px solid #F0F2F5' : '0' }}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[12px] font-bold" style={{ color: palette.navy }}>
                  {a.name}
                </span>
                <span className="block h-1 rounded" style={{ background: '#EEF1F5' }}>
                  <span className="block h-1 rounded" style={{ background: palette.navy, width: `${a.w}%` }} />
                </span>
              </span>
              <span className="text-right text-[12px] font-bold" style={{ color: palette.navy }}>
                {fmtCompact(a.fees)}
              </span>
              <span className="text-right text-[11.5px]" style={{ color: palette.slate }}>
                {a.share}%
              </span>
              <span className="text-right text-[12px] font-bold" style={{ color: a.growth < 0 ? palette.red : a.growth > 20 ? palette.green : palette.navy }}>
                {a.growth > 0 ? '+' : ''}
                {a.growth}%
              </span>
              <span className="text-right text-[11.5px]" style={{ color: palette.navy }}>
                {a.margin}%
              </span>
              <span className="justify-self-start">
                <StatusBadge label={a.signal} tone={SIGNAL_TONE[a.signal]} />
              </span>
            </div>
          ))}
          <div className="px-3.5 py-2.5 text-[10.5px]" style={{ background: palette.page, color: palette.slate }}>
            Margin = fees collected minus staff time cost and direct expenses for that area.
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Client concentration */}
          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
            <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Client concentration
              </strong>
              <span className="ml-auto">
                <StatusBadge label={concentrationLabel} tone={concentrationTone} />
              </span>
            </div>
            <div className="p-3.5">
              {concentration.total === 0 ? (
                <p className="m-0 py-3 text-center text-[11px]" style={{ color: palette.slate }}>
                  No billing data yet to compute client concentration.
                </p>
              ) : (
                <>
                  <div className="flex h-4 overflow-hidden rounded">
                    <span style={{ width: `${concentration.top3Pct}%`, background: palette.red }} />
                    <span style={{ width: `${concentration.next7Pct}%`, background: '#C9A86A' }} />
                    <span style={{ width: `${concentration.restPct}%`, background: '#C9D3E0' }} />
                  </div>
                  <div className="mt-2.5 flex flex-col gap-1.5 text-[11.5px]" style={{ color: palette.navy }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: palette.red }} />
                      Top 3 clients
                      <strong className="ml-auto">{concentration.top3Pct}%</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: '#C9A86A' }} />
                      Next 7 clients
                      <strong className="ml-auto">{concentration.next7Pct}%</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: '#C9D3E0' }} />
                      All others ({concentration.restCount})
                      <strong className="ml-auto">{concentration.restPct}%</strong>
                    </span>
                  </div>
                  <p className="m-0 mt-2.5 text-[10.5px] leading-snug" style={{ color: palette.slate }}>
                    Losing {concentration.top1Name} alone would cut fees by {concentration.top1Pct}%.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Notes for partners' meeting */}
          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
            <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Notes for partners' meeting
              </strong>
              <span className="text-[10.5px]" style={{ color: palette.slate }}>
                only you can see these
              </span>
            </div>
            <textarea
              value={settings.partnersNotes || ''}
              onChange={(e) => updatePartnersNotes(e.target.value)}
              placeholder="e.g. Push employment law via BNI; review conveyancing pricing; hire 3rd associate?"
              className="block w-full resize-y border-0 p-3.5 outline-none"
              style={{ minHeight: 120, fontSize: '12px', lineHeight: 1.55, color: palette.navy }}
            />
          </div>
        </div>
      </section>

      {/* Growth */}
      <div className="mt-1 flex items-center gap-2">
        <strong className="text-[17px]" style={{ fontFamily: serifFont, color: palette.navy }}>
          Growth
        </strong>
        <span className="text-[10.5px]" style={{ color: palette.slate }}>
          panels, where to invest, reputation
        </span>
      </div>

      <section className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        {/* Panelships */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Panelships
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              banks, insurers, GLCs
            </span>
          </div>
          <div
            className="grid gap-3 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
            style={{ gridTemplateColumns: 'minmax(0,1.3fr) 100px 60px 90px 1fr 24px', background: palette.page, borderBottom: '1px solid #EEF1F5', color: palette.slate }}
          >
            <span>Panel</span>
            <span>Status</span>
            <span className="text-right">Files</span>
            <span className="text-right">Fees YTD</span>
            <span>Next step</span>
            <span />
          </div>
          {panelships.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No panelships tracked yet.
            </div>
          )}
          {panelships.map((p, i) => (
            <div
              key={p.id}
              className="grid items-center gap-3 px-3.5 py-1.5"
              style={{ gridTemplateColumns: 'minmax(0,1.3fr) 100px 60px 90px 1fr 24px', borderBottom: i < panelships.length - 1 ? '1px solid #F0F2F5' : '0' }}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <input
                  value={p.name}
                  onChange={(e) => updatePanelship(p.id, { name: e.target.value })}
                  className="border-0 bg-transparent p-0 text-[11.5px] font-bold outline-none"
                  style={{ color: palette.navy }}
                />
                <input
                  value={p.kind}
                  onChange={(e) => updatePanelship(p.id, { kind: e.target.value })}
                  placeholder="e.g. Bank · loans"
                  className="border-0 bg-transparent p-0 text-[10px] outline-none"
                  style={{ color: palette.slate }}
                />
              </span>
              <select
                value={p.status}
                onChange={(e) => updatePanelship(p.id, { status: e.target.value })}
                className="rounded px-1 py-0.5 text-[10px] font-bold"
                style={{ border: '1px solid #E3E7EC', color: tintText[PANEL_STATUS_TONE[p.status] as keyof typeof tintText] || palette.slate, background: '#fff' }}
              >
                {PANEL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={p.files}
                onChange={(e) => updatePanelship(p.id, { files: Number(e.target.value) || 0 })}
                className="w-full rounded px-1 py-0.5 text-right text-[12px] font-bold"
                style={{ border: '1px solid #E3E7EC', color: palette.navy }}
              />
              <input
                type="number"
                value={p.feesYtd}
                onChange={(e) => updatePanelship(p.id, { feesYtd: Number(e.target.value) || 0 })}
                className="w-full rounded px-1 py-0.5 text-right text-[12px] font-bold"
                style={{ border: '1px solid #E3E7EC', color: palette.navy }}
              />
              <input
                value={p.nextStep}
                onChange={(e) => updatePanelship(p.id, { nextStep: e.target.value })}
                className="min-w-0 rounded px-1 py-0.5 text-[10.5px]"
                style={{ border: '1px solid #E3E7EC', color: palette.slate }}
              />
              <button type="button" onClick={() => removePanelship(p.id)} title="Remove" style={{ color: '#94A3B8' }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-4 px-3.5 py-2.5" style={{ background: palette.page }}>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Appointed <strong style={{ color: palette.green }}>{appointedCount}</strong>
            </span>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              In progress <strong style={{ color: tintText.gold }}>{inProgressCount}</strong>
            </span>
            <button
              type="button"
              onClick={() => addPanelship({ name: 'New panel', kind: '', status: 'Target', files: 0, feesYtd: 0, nextStep: '' })}
              className="ml-auto text-[10.5px] font-bold"
              style={{ color: '#8A6D3B' }}
            >
              + Add panel
            </button>
          </div>
        </div>

        {/* Where to put money */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Where to put money
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              spend vs fees it brought in · year to date
            </span>
          </div>
          <div
            className="grid gap-2.5 px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
            style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 80px 56px 74px 24px', background: palette.page, borderBottom: '1px solid #EEF1F5', color: palette.slate }}
          >
            <span>Channel</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Fees won</span>
            <span className="text-right">Return</span>
            <span>Signal</span>
            <span />
          </div>
          {investRows.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No spend channels tracked yet.
            </div>
          )}
          {investRows.map((r, i) => (
            <div
              key={r.id}
              className="grid items-center gap-2.5 px-3.5 py-1.5"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 80px 56px 74px 24px', borderBottom: i < investRows.length - 1 ? '1px solid #F0F2F5' : '0' }}
            >
              <input
                value={r.name}
                onChange={(e) => updateInvestmentChannel(r.id, { name: e.target.value })}
                className="min-w-0 border-0 bg-transparent p-0 text-[11.5px] font-semibold outline-none"
                style={{ color: palette.navy }}
              />
              <input
                type="number"
                value={r.spend}
                onChange={(e) => updateInvestmentChannel(r.id, { spend: Number(e.target.value) || 0 })}
                className="w-full rounded px-1 py-0.5 text-right text-[11px]"
                style={{ border: '1px solid #E3E7EC', color: palette.slate }}
              />
              <input
                type="number"
                value={r.feesWon}
                onChange={(e) => updateInvestmentChannel(r.id, { feesWon: Number(e.target.value) || 0 })}
                className="w-full rounded px-1 py-0.5 text-right text-[11px] font-bold"
                style={{ border: '1px solid #E3E7EC', color: palette.navy }}
              />
              <span className="text-right text-[12px] font-extrabold" style={{ color: r.ret === null ? palette.slate : INVEST_TONE[r.signal] === 'green' ? palette.green : INVEST_TONE[r.signal] === 'red' ? palette.red : tintText[INVEST_TONE[r.signal] as keyof typeof tintText] }}>
                {r.ret === null ? '—' : `${r.ret.toFixed(1)}×`}
              </span>
              <span className="justify-self-start">
                <StatusBadge label={r.signal} tone={INVEST_TONE[r.signal]} />
              </span>
              <button type="button" onClick={() => removeInvestmentChannel(r.id)} title="Remove" style={{ color: '#94A3B8' }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 px-3.5 py-2.5" style={{ background: palette.page }}>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Return = fees won ÷ money spent. Anything above 5× is worth scaling.
            </span>
            <button
              type="button"
              onClick={() => addInvestmentChannel({ name: 'New channel', spend: 0, feesWon: 0 })}
              className="ml-auto whitespace-nowrap text-[10.5px] font-bold"
              style={{ color: '#8A6D3B' }}
            >
              + Add
            </button>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 md:grid-cols-2">
        {/* From enquiry to client */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              From enquiry to client
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              {funnelPeriodLabel}
            </span>
          </div>
          {leads.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No leads recorded yet.
            </div>
          ) : (
            funnel.map((f) => (
              <div key={f.label} className="px-3.5 py-2">
                <div className="flex text-[11.5px]" style={{ color: palette.navy }}>
                  <span>{f.label}</span>
                  <strong className="ml-auto">{f.n}</strong>
                </div>
                <div className="mt-1 h-2.5 rounded" style={{ background: '#EEF1F5' }}>
                  <div className="h-2.5 rounded" style={{ background: f.color, width: `${f.w}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Growing practice areas */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Growing practice areas
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              current pipeline by practice area
            </span>
          </div>
          {leadMix.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No leads recorded yet.
            </div>
          ) : (
            leadMix.map((t, i) => (
              <div
                key={t.name}
                className="grid items-center gap-3 px-3.5 py-2"
                style={{ gridTemplateColumns: '140px minmax(0,1fr) 40px', borderBottom: i < leadMix.length - 1 ? '1px solid #F0F2F5' : '0' }}
              >
                <span className="truncate text-[11.5px] font-semibold" style={{ color: palette.navy }}>
                  {t.name}
                </span>
                <div className="h-2 rounded" style={{ background: '#EEF1F5' }}>
                  <div className="h-2 rounded" style={{ background: palette.blue, width: `${t.w}%` }} />
                </div>
                <span className="text-right text-[11.5px] font-bold" style={{ color: palette.navy }}>
                  {t.n}
                </span>
              </div>
            ))
          )}
          <p className="m-0 px-3.5 pb-2.5 pt-1.5 text-[10.5px] leading-snug" style={{ color: palette.slate, background: palette.page }}>
            Monthly trend needs each lead's enquiry date, which isn't tracked yet — showing today's pipeline mix instead.
          </p>
        </div>
      </section>

      <section className="grid items-start gap-4 md:grid-cols-2">
        {/* Google reviews — not connected */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Google reviews
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Google Business Profile
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-3.5 py-6 text-center">
            <span className="text-[11.5px] font-bold" style={{ color: palette.slate }}>
              Not connected yet
            </span>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Connect Google Business Profile to see your rating and reviews here.
            </span>
          </div>
        </div>

        {/* Social media & website — not connected */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Social media &amp; website
            </strong>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Meta, TikTok, Google Analytics
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 px-3.5 py-6 text-center">
            <span className="text-[11.5px] font-bold" style={{ color: palette.slate }}>
              Not connected yet
            </span>
            <span className="text-[10.5px]" style={{ color: palette.slate }}>
              Connect Meta, TikTok and Google Analytics to see followers, reach and enquiries here.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DirectionTab;
