import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { identityTokens, isMine, partnerCode as toPartnerCode } from '../../../lib/identity';
import { palette } from '../../../lib/designTokens';
import { ProgressBar } from '../../ui';
import { caseFinder, isIssued, partnerShare, receivedWithinDays } from '../../../lib/financeMetrics';
import { parseLocal, toLocalYear } from '../../../lib/localDate';
import {
  getPracticeSettings,
  setPartnerKpiTarget,
  DEFAULT_PARTNER_KPI_TARGETS,
  DEFAULT_PARTNER_KPI_WEIGHTS,
  PARTNER_KPI_METRICS,
  type PartnerKpiMetric,
} from '../../../services/templateService';

/** Partner-code -> avatar color. Mirrors the fixed 'SH' | 'AH' | 'ZA' partner codes in
 * types.ts. Falls back to a rotation for any other partner. */
const CODE_COLOR: Record<string, string> = { SH: palette.navy, AH: palette.blue, ZA: palette.purple };
const FALLBACK_COLORS = [palette.gold, palette.red, palette.green];

const METRIC_META: Record<PartnerKpiMetric, { label: string; unit: 'RM k' | '%' | 'h' | '★' | 'count' }> = {
  feesBilled: { label: 'Fees billed', unit: 'RM k' },
  collectedWithin60: { label: 'Collected within 60 days', unit: '%' },
  newClients: { label: 'New clients brought', unit: 'count' },
  billableHours: { label: 'Billable hours', unit: 'h' },
  clientRating: { label: 'Client rating', unit: '★' },
  complianceOnTime: { label: 'Compliance items on time', unit: '%' },
  mentoring: { label: 'Mentoring (1-to-1s held)', unit: 'count' },
};

const fmt = (metric: PartnerKpiMetric, v: number) => {
  const u = METRIC_META[metric].unit;
  if (u === 'RM k') return `RM ${Math.round(v / 1000)}k`;
  if (u === '%') return `${Math.round(v)}%`;
  if (u === 'h') return `${Math.round(v)} h`;
  if (u === '★') return `${v.toFixed(1)}★`;
  return String(Math.round(v));
};

interface PartnerScorecard {
  code: string;
  userId: string;
  name: string;
  role: string;
  color: string;
  metrics: Partial<Record<PartnerKpiMetric, { actual: number; target: number } | null>>;
}

/**
 * My Dashboard -> Partner KPIs. Mirrors My Dashboard.dc.html's `isKpi` block (mockup lines
 * ~192-208): one scorecard per partner with 7 weighted KPI bars.
 *
 * scope === 'all' (Managing Partner): every partner's scorecard.
 * scope === 'own' (Partner): only the current user's own scorecard.
 *
 * Fees billed / collected-within-60 / billable hours / new clients are derived from the same
 * real Case.partners attribution and Invoice/Payment/TimeEntry data PartnerDashboardView.tsx
 * already uses for partnersKPIMatrix, so the numbers stay consistent with the rest of the app.
 * Client rating and mentoring have no data model anywhere in this codebase (grepped for
 * "rating"/"mentor" in types.ts — nothing) and compliance-on-time only counts when the firm's
 * compliance register has items owned by that partner, so those render an honest "Not yet
 * tracked" state instead of an invented number, and are excluded from the weighted overall
 * score rather than silently treated as 0.
 */
const PartnerKpisTab: React.FC<{ scope: 'all' | 'own' }> = ({ scope }) => {
  const { currentUser, users, cases, invoices, payments, timeEntries, showToast } = useApp();
  const [settings, setSettings] = useState(() => getPracticeSettings());
  const [editing, setEditing] = useState(false);

  const weights = settings.partnerKpiWeights || DEFAULT_PARTNER_KPI_WEIGHTS;
  const targetsByCode = settings.partnerKpiTargets || {};

  const findCase = useMemo(() => caseFinder(cases), [cases]);
  const thisYear = new Date().getFullYear();

  const ownCode = toPartnerCode(currentUser);

  /** Each client's earliest-opened matter (clientId may list several clients, comma-separated). */
  const firstMatterByClient = useMemo(() => {
    const m = new Map<string, (typeof cases)[number]>();
    cases.forEach((c) => {
      const t = parseLocal(c.fileOpenedDate || c.createdDate);
      if (!t) return;
      String(c.clientId || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((id) => {
        const cur = m.get(id);
        if (!cur || t < parseLocal(cur.fileOpenedDate || cur.createdDate)) m.set(id, c);
      });
    });
    return m;
  }, [cases]);

  const scorecards: PartnerScorecard[] = useMemo(() => {
    const partnerUsers = (users || []).filter((u) => u.role === 'Partner');
    return partnerUsers
      .filter((u) => scope === 'all' || toPartnerCode(u) === ownCode)
      .map((u, i) => {
        const code = toPartnerCode(u) || u.id;
        const tokens = identityTokens(u);
        const target = (metric: PartnerKpiMetric) => targetsByCode[code]?.[metric] ?? DEFAULT_PARTNER_KPI_TARGETS[metric];

        // Year to date, issued invoices only (not Draft / Pending Review / Voided). A file with
        // several partners splits each invoice equally between them, so the firm's fees are
        // never counted twice across scorecards.
        const pInvoices = invoices
          .filter((inv) => isIssued(inv) && toLocalYear(inv.date) === thisYear)
          .map((inv) => ({ inv, share: partnerShare(findCase(inv.caseId, inv.fileRef)?.partners as string[] | undefined, code) }))
          .filter((x) => x.share > 0);
        const billed = pInvoices.reduce((s, x) => s + Number(x.inv.total || 0) * x.share, 0);
        // Collected within 60 days = money received within 60 days of the invoice date ÷ billed
        // YTD. Partial payments count for what was received in time.
        const collectedWithin60Amt = pInvoices.reduce(
          (s, x) => s + Math.min(Number(x.inv.total || 0), receivedWithinDays(x.inv, payments || [], 60, parseLocal)) * x.share,
          0
        );
        const collectedWithin60Pct = billed > 0 ? (collectedWithin60Amt / billed) * 100 : 0;

        // New clients = clients whose FIRST matter with the firm was opened this year, credited
        // to the partner(s) on that first matter.
        const newClientIds = new Set<string>();
        firstMatterByClient.forEach((c, clientId) => {
          if (toLocalYear(c.fileOpenedDate || c.createdDate) === thisYear && c.partners?.includes(code as any)) newClientIds.add(clientId);
        });

        const billableHours = (timeEntries || [])
          .filter((t) => isMine(t.feeEarner, tokens) && t.billable && toLocalYear(t.date) === thisYear)
          .reduce((s, t) => s + (t.hours || 0), 0);

        const complianceItems = (settings.complianceRegister || []).filter((c) => isMine(c.owner, tokens));
        const complianceOnTimePct = complianceItems.length ? (complianceItems.filter((c) => c.done).length / complianceItems.length) * 100 : null;

        const metrics: PartnerScorecard['metrics'] = {
          feesBilled: { actual: billed, target: target('feesBilled') },
          collectedWithin60: { actual: collectedWithin60Pct, target: target('collectedWithin60') },
          newClients: { actual: newClientIds.size, target: target('newClients') },
          billableHours: { actual: billableHours, target: target('billableHours') },
          clientRating: null,
          complianceOnTime: complianceOnTimePct == null ? null : { actual: complianceOnTimePct, target: target('complianceOnTime') },
          mentoring: null,
        };

        return {
          code,
          userId: u.id,
          name: u.name,
          role: u.staffProfile?.designation || u.role,
          color: CODE_COLOR[code] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          metrics,
        };
      });
  }, [users, scope, ownCode, invoices, payments, cases, timeEntries, findCase, firstMatterByClient, targetsByCode, settings.complianceRegister, thisYear]);

  const scoreFor = (card: PartnerScorecard) => {
    let weighted = 0;
    let weightSum = 0;
    PARTNER_KPI_METRICS.forEach((m) => {
      const entry = card.metrics[m];
      if (!entry || entry.target <= 0) return;
      const r = Math.min(1.1, entry.actual / entry.target);
      weighted += r * (weights[m] ?? 0);
      weightSum += weights[m] ?? 0;
    });
    return weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;
  };

  const onEditTarget = (code: string, metric: PartnerKpiMetric, value: number) => {
    setPartnerKpiTarget(code, metric, value);
    setSettings(getPracticeSettings());
    showToast('Target updated.');
  };

  if (scope === 'own' && !ownCode) {
    return (
      <div className="mx-auto my-12 max-w-xl space-y-4 rounded-xl border border-[#DDE3EB] bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#FBEDE9] bg-[#FBEDE9] text-[#B23A2E]">
          <Lock className="h-8 w-8" />
        </div>
        <p className="text-xs text-slate-600">Your name doesn't map to a registered partner code (SH / AH / ZA), so no scorecard can be shown.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      <div className="flex items-center gap-2.5">
        <strong className="font-serif text-[18px] text-[#16223A]">Partner scorecards · {thisYear} year to date</strong>
        <span className="text-[10.5px] text-[#5B6478]">{scope === 'own' ? 'You see your own scorecard; the Super Admin sees all.' : 'Partners see only their own scorecard.'}</span>
        {scope === 'all' && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="ml-auto whitespace-nowrap rounded-md border border-[#DDE3EB] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#16223A]"
          >
            {editing ? 'Done editing' : 'Edit targets'}
          </button>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scorecards.map((card) => {
          const score = scoreFor(card);
          const scoreColor = score >= 90 ? palette.green : score >= 75 ? palette.gold : palette.red;
          return (
            <div key={card.code} className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
              <div className="flex items-center gap-2.5 border-b border-[#EEF1F5] px-3.5 py-3">
                <span className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: card.color, width: 34, height: 34 }}>
                  {card.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[#16223A]">{card.name}</span>
                  <span className="block text-[10.5px] text-[#5B6478]">{card.role}</span>
                </span>
                <span className="text-right">
                  <span className="block font-serif text-[22px] font-bold" style={{ color: scoreColor }}>
                    {score}
                  </span>
                  <span className="block text-[9.5px] text-[#5B6478]">overall</span>
                </span>
              </div>

              {PARTNER_KPI_METRICS.map((metric) => {
                const entry = card.metrics[metric];
                const meta = METRIC_META[metric];
                if (!entry) {
                  return (
                    <div key={metric} className="border-t border-[#F0F2F5] px-3.5 py-2">
                      <div className="flex items-baseline gap-1.5 text-[11px]">
                        <span className="flex-1 font-semibold text-[#16223A]">{meta.label}</span>
                        <span className="text-[#5B6478]">Not yet tracked</span>
                      </div>
                      <div className="mt-1 h-[5px] rounded bg-[#EEF1F5]" />
                    </div>
                  );
                }
                const pct = entry.target > 0 ? Math.min(100, Math.round((entry.actual / entry.target) * 100)) : 0;
                const ratio = entry.target > 0 ? entry.actual / entry.target : 0;
                const color = ratio >= 1 ? palette.green : ratio >= 0.8 ? palette.gold : palette.red;
                return (
                  <div key={metric} className="border-t border-[#F0F2F5] px-3.5 py-2">
                    {editing ? (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="flex-1 font-semibold text-[#16223A]">{meta.label}</span>
                        <span className="font-bold text-[#16223A]">{fmt(metric, entry.actual)}</span>
                        <span className="text-[#5B6478]">/</span>
                        <input
                          type="number"
                          defaultValue={entry.target}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v)) onEditTarget(card.code, metric, v);
                          }}
                          className="w-16 rounded border border-[#E3E7EC] px-1 py-0.5 text-right text-[11px]"
                        />
                      </div>
                    ) : (
                      <ProgressBar
                        label={meta.label}
                        valueLabel={
                          <>
                            <span className="font-bold text-[#16223A]">{fmt(metric, entry.actual)}</span>
                            <span className="text-[#5B6478]"> / {fmt(metric, entry.target)}</span>
                          </>
                        }
                        pct={pct}
                        color={color}
                        barHeight={5}
                      />
                    )}
                  </div>
                );
              })}

              <div className="bg-[#F6F8FA] px-3.5 py-2 text-[10.5px] leading-relaxed text-[#5B6478]">
                Client rating and mentoring have no data source yet — excluded from the overall score above.
                {(!card.metrics.complianceOnTime) && ' No compliance items are owned by this partner yet either.'}
              </div>
            </div>
          );
        })}
        {scorecards.length === 0 && <p className="text-[11.5px] text-[#5B6478]">No partner users on record.</p>}
      </section>

      <p className="text-[10.5px] text-[#5B6478]">
        Weighting: Fees {weights.feesBilled}% · Collections {weights.collectedWithin60}% · New clients {weights.newClients}% · Hours {weights.billableHours}% · Client rating{' '}
        {weights.clientRating}% · Compliance {weights.complianceOnTime}% · Mentoring {weights.mentoring}%. You can change weights and targets.
      </p>
    </div>
  );
};

export default PartnerKpisTab;
