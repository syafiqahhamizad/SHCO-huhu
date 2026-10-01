import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { palette, tint, tintText, serifFont } from '../../../lib/designTokens';
import { getPracticeSettings } from '../../../services/templateService';
import type { ComplianceItem } from '../../../types';
import { StatusBadge } from '../../ui';
import { localIso } from '../../../lib/localDate';

/** Partner-code -> avatar color. Mirrors the fixed 'SH' | 'AH' | 'ZA' partner codes in
 * types.ts (see PartnerCode) — not a design token because it keys off partner identity,
 * not semantic meaning. Falls back to slate for any other owner code. */
const OWNER_COLOR: Record<string, string> = {
  SH: palette.navy,
  AH: palette.blue,
  ZA: palette.purple,
};

/** Register name + regulator/body line shown in the group header. Fixed per the README's
 * "Compliance" section — not stored per item, since every item in a group shares it. */
const GROUP_META: Record<ComplianceItem['group'], { name: string; body: string }> = {
  AMLA: { name: 'AMLA', body: 'Bank Negara Malaysia' },
  'Client account': { name: 'Client account', body: "Solicitors' Account Rules" },
  'Bar Council': { name: 'Bar Council', body: 'practice' },
  PDPA: { name: 'PDPA', body: 'personal data' },
  'Tax/payroll/licences': { name: 'Tax, payroll & licences', body: 'LHDN · KWSP · PERKESO · PBT' },
};

const GROUP_ORDER: ComplianceItem['group'][] = ['AMLA', 'Client account', 'Bar Council', 'PDPA', 'Tax/payroll/licences'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtDue = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const todayIso = () => localIso(new Date()); // local date, not UTC

const daysBetween = (fromIso: string, toIso: string) => {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86400000);
};

/** An item ticked for a prior recurring period is treated as reset once its due date has
 * passed — a simple date check on read, not a cron job, per the register's own rule
 * ("Monthly and annual items reset automatically for the next period; the history is
 * kept."). toggleComplianceItem in AppContext applies the same rule when writing. */
const isCurrentlyDone = (item: ComplianceItem, today: string) => {
  const stale = item.frequency !== 'One-off' && item.done && item.due < today;
  return item.done && !stale;
};

type StatusKey = 'done' | 'overdue' | 'dueSoon' | 'scheduled';

const statusOf = (item: ComplianceItem, today: string): StatusKey => {
  if (isCurrentlyDone(item, today)) return 'done';
  if (item.due < today) return 'overdue';
  if (daysBetween(today, item.due) <= 30) return 'dueSoon';
  return 'scheduled';
};

const STATUS_META: Record<StatusKey, { label: string; tone: 'green' | 'red' | 'gold' | 'blue'; mark: string }> = {
  done: { label: 'Done', tone: 'green', mark: '✓' },
  overdue: { label: 'Overdue', tone: 'red', mark: '!' },
  dueSoon: { label: 'Due soon', tone: 'gold', mark: '!' },
  scheduled: { label: 'Scheduled', tone: 'blue', mark: '•' },
};

const TONE_COLOR: Record<'green' | 'red' | 'gold' | 'blue', string> = {
  green: palette.green,
  red: palette.red,
  gold: tintText.gold,
  blue: tintText.blue,
};

const SEGMENTS: { key: 'all' | 'action' | 'ok'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Needs action' },
  { key: 'ok', label: 'Done' },
];

const FREQUENCIES: ComplianceItem['frequency'][] = ['Monthly', 'Quarterly', 'Annual', 'One-off'];

/**
 * "Compliance" sub-tab of My Dashboard — visible to partners + the Managing Partner.
 * Replicates the isSafety block of design/My Dashboard.dc.html (lines ~245-292) exactly:
 * 4 KPI tiles, an editable "Office compliance register" grouped by AMLA / Client account /
 * Bar Council / PDPA / Tax, payroll & licences with a segmented All / Needs action / Done
 * filter, a "Coming up · next 90 days" mini calendar, and "Complaints & client feedback".
 *
 * Register + complaints live in PracticeSettings (services/templateService.ts), which is
 * not part of AppContext's reactive state, so this component keeps its own copy and
 * refreshes it on the 'shco-practice-settings-updated' event — the same pattern
 * PracticeSettingsView.tsx uses.
 */
export const ComplianceTab: React.FC = () => {
  const { currentUser, toggleComplianceItem, updateComplianceItem, addComplianceItem } = useApp();
  const [settings, setSettings] = useState(() => getPracticeSettings());
  const [seg, setSeg] = useState<'all' | 'action' | 'ok'>('all');
  const today = useMemo(() => todayIso(), []);

  useEffect(() => {
    const onUpdate = () => setSettings(getPracticeSettings());
    window.addEventListener('shco-practice-settings-updated', onUpdate);
    return () => window.removeEventListener('shco-practice-settings-updated', onUpdate);
  }, []);

  const register = settings.complianceRegister || [];
  const complaints = settings.complaints || [];

  const withStatus = useMemo(
    () => register.map((item) => ({ item, status: statusOf(item, today), done: isCurrentlyDone(item, today) })),
    [register, today]
  );

  const overdueCount = withStatus.filter((r) => r.status === 'overdue').length;
  const dueSoonCount = withStatus.filter((r) => r.status === 'dueSoon').length;
  const okCount = withStatus.filter((r) => r.done).length;
  const openComplaints = complaints.filter((c) => c.status === 'Open');

  const overdueLabels = withStatus.filter((r) => r.status === 'overdue').map((r) => r.item.label);
  const nextDueSoon = withStatus
    .filter((r) => r.status === 'dueSoon')
    .sort((a, b) => (a.item.due < b.item.due ? -1 : 1))[0];

  const groupNames = Array.from(new Set(register.map((i) => GROUP_META[i.group]?.name || i.group)));

  const kpis = [
    {
      label: 'Register items OK',
      value: `${okCount} / ${register.length}`,
      note: register.length ? `across ${groupNames.join(', ')}` : 'No register items yet',
      color: palette.navy,
    },
    {
      label: 'Overdue',
      value: String(overdueCount),
      note: overdueCount ? overdueLabels.slice(0, 2).join(' · ') : 'Nothing overdue',
      color: overdueCount ? palette.red : palette.green,
    },
    {
      label: 'Due in 30 days',
      value: String(dueSoonCount),
      note: nextDueSoon ? `next: ${nextDueSoon.item.label}` : 'Nothing due soon',
      color: dueSoonCount ? tintText.gold : palette.green,
    },
    {
      label: 'Open complaints',
      value: String(openComplaints.length),
      note: openComplaints.length ? 'see Complaints & client feedback' : 'None open',
      color: openComplaints.length ? tintText.gold : palette.green,
    },
  ];

  const groups = useMemo(() => {
    return GROUP_ORDER.map((groupKey) => {
      const meta = GROUP_META[groupKey];
      const rows = withStatus.filter((r) => r.item.group === groupKey);
      const visibleRows = rows.filter((r) => {
        if (seg === 'all') return true;
        if (seg === 'ok') return r.done;
        return !r.done; // 'action'
      });
      const lateCount = rows.filter((r) => r.status === 'overdue').length;
      const dueCount = rows.filter((r) => r.status === 'dueSoon').length;
      const summary = lateCount ? `${lateCount} overdue` : dueCount ? `${dueCount} due soon` : rows.length ? 'all good' : 'no items';
      const summaryColor = lateCount ? palette.red : dueCount ? tintText.gold : palette.green;
      return { groupKey, meta, rows: visibleRows, summary, summaryColor, total: rows.length };
    }).filter((g) => g.rows.length > 0 || seg === 'all');
  }, [withStatus, seg]);

  const comingUp90 = useMemo(() => {
    return withStatus
      .filter((r) => !r.done && r.item.due >= today && daysBetween(today, r.item.due) <= 90)
      .sort((a, b) => (a.item.due < b.item.due ? -1 : 1))
      .map((r) => {
        const d = new Date(r.item.due);
        const color = TONE_COLOR[STATUS_META[r.status].tone];
        return {
          key: r.item.id,
          mon: MONTHS[d.getMonth()],
          day: String(d.getDate()),
          label: r.item.label,
          color,
        };
      });
  }, [withStatus, today]);

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'ME';

  const handleAdd = (group: ComplianceItem['group']) => {
    addComplianceItem(group, {
      label: 'New item',
      note: '',
      frequency: 'Annual',
      due: today,
      owner: initialsOf(currentUser?.name || ''),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI row */}
      <section className="grid grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-xl border p-3.5" style={{ borderColor: palette.border, background: palette.card }}>
            <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: palette.slate }}>
              {k.label}
            </span>
            <span className="text-[23px] font-bold leading-tight" style={{ fontFamily: serifFont, color: k.color }}>
              {k.value}
            </span>
            <span className="truncate text-[10.5px] leading-snug" style={{ color: palette.slate }} title={k.note}>
              {k.note}
            </span>
          </div>
        ))}
      </section>

      <section className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        {/* Office compliance register */}
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
            <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
              Office compliance register
            </strong>
            <div className="ml-auto flex gap-0.5 rounded-md p-0.5" style={{ background: '#F0F2F5' }}>
              {SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSeg(s.key)}
                  className="rounded px-2.5 py-1 text-[10.5px] font-bold"
                  style={{ background: seg === s.key ? '#fff' : 'transparent', color: seg === s.key ? palette.navy : palette.slate }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {register.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
              No compliance register set up yet.
            </div>
          )}

          {groups.map((g) => (
            <div key={g.groupKey}>
              <div
                className="flex items-center gap-2 border-b border-t px-3.5 py-1.5"
                style={{ background: palette.page, borderColor: '#EEF1F5' }}
              >
                <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: palette.navy }}>
                  {g.meta.name}
                </span>
                <span className="text-[10px]" style={{ color: palette.slate }}>
                  {g.meta.body}
                </span>
                <span className="ml-auto text-[10px] font-bold" style={{ color: g.summaryColor }}>
                  {g.summary}
                </span>
              </div>

              {g.rows.map(({ item, status, done }) => {
                const meta = STATUS_META[status];
                const tone = meta.tone;
                return (
                  <div
                    key={item.id}
                    className="grid items-center gap-2.5 border-b px-3.5 py-1.5"
                    style={{ gridTemplateColumns: '22px minmax(0,1fr) 92px 130px 92px 34px', borderColor: '#F0F2F5' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleComplianceItem(item.id)}
                      title="Tick when done"
                      className="grid h-[18px] w-[18px] place-items-center rounded"
                      style={{
                        border: `1.5px solid ${done ? palette.green : '#CBD5E1'}`,
                        background: done ? palette.green : '#fff',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      {done ? '✓' : ''}
                    </button>

                    <span className="flex min-w-0 flex-col gap-0.5">
                      <input
                        value={item.label}
                        onChange={(e) => updateComplianceItem(item.id, { label: e.target.value })}
                        className="border-0 bg-transparent p-0 text-[11.5px] font-semibold outline-none"
                        style={{ color: palette.navy, textDecoration: done ? 'line-through' : 'none' }}
                      />
                      <input
                        value={item.note || ''}
                        onChange={(e) => updateComplianceItem(item.id, { note: e.target.value })}
                        placeholder="Add a note"
                        className="border-0 bg-transparent p-0 text-[10px] outline-none"
                        style={{ color: palette.slate }}
                      />
                    </span>

                    <select
                      value={item.frequency}
                      onChange={(e) => updateComplianceItem(item.id, { frequency: e.target.value as ComplianceItem['frequency'] })}
                      className="rounded px-1 py-0.5 text-[10.5px]"
                      style={{ border: '1px solid #E3E7EC', color: palette.navy, background: '#fff' }}
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={item.due}
                      onChange={(e) => updateComplianceItem(item.id, { due: e.target.value })}
                      className="min-w-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold"
                      style={{ border: '1px solid #E3E7EC', color: TONE_COLOR[tone], background: '#fff' }}
                    />

                    <span className="justify-self-start">
                      <StatusBadge label={meta.label} tone={tone} />
                    </span>

                    <span
                      className="grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: OWNER_COLOR[item.owner] || palette.slate }}
                      title={item.owner}
                    >
                      {item.owner}
                    </span>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => handleAdd(g.groupKey)}
                className="ml-[46px] mb-2 mt-1.5 text-[10.5px] font-bold"
                style={{ color: '#8A6D3B' }}
              >
                + Add item to {g.meta.name}
              </button>
            </div>
          ))}

          {register.length > 0 && (
            <div className="px-3.5 py-2.5 text-[10.5px]" style={{ background: palette.page, color: palette.slate }}>
              Tick an item when it's submitted. Monthly and annual items reset automatically for the next period; the history is kept.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Coming up · next 90 days */}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
            <div className="border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Coming up · next 90 days
              </strong>
            </div>
            {comingUp90.length === 0 && (
              <div className="px-3.5 py-6 text-center text-[11px]" style={{ color: palette.slate }}>
                Nothing due in the next 90 days.
              </div>
            )}
            {comingUp90.map((c, i) => (
              <div key={c.key} className="flex items-center gap-2.5 px-3.5 py-2" style={{ borderTop: i ? '1px solid #F0F2F5' : '0' }}>
                <div className="w-10 flex-shrink-0 rounded-md py-0.5 text-center" style={{ background: `${c.color}1A` }}>
                  <div className="text-[8.5px] font-bold uppercase" style={{ color: c.color }}>
                    {c.mon}
                  </div>
                  <div className="text-[15px] font-bold leading-tight" style={{ fontFamily: serifFont, color: c.color }}>
                    {c.day}
                  </div>
                </div>
                <span className="min-w-0 flex-1 text-[11.5px]" style={{ color: palette.navy }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          {/* Complaints & client feedback */}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: palette.border, background: palette.card }}>
            <div className="border-b px-3.5 py-2.5" style={{ borderColor: '#EEF1F5' }}>
              <strong className="text-[14.5px]" style={{ fontFamily: serifFont, color: palette.navy }}>
                Complaints &amp; client feedback
              </strong>
            </div>
            <div className="grid grid-cols-3">
              {[
                { label: 'Open', value: openComplaints.length, color: openComplaints.length ? palette.red : palette.green },
                { label: 'Resolved', value: complaints.filter((c) => c.status === 'Resolved').length, color: palette.green },
                { label: 'Total logged', value: complaints.length, color: palette.navy },
              ].map((v, i) => (
                <div key={v.label} className="px-3.5 py-3" style={{ borderLeft: i ? '1px solid #F0F2F5' : '0' }}>
                  <div className="text-[20px] font-bold" style={{ fontFamily: serifFont, color: v.color }}>
                    {v.value}
                  </div>
                  <div className="text-[10.5px]" style={{ color: palette.slate }}>
                    {v.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="m-0 px-3.5 pb-3 pt-2 text-[10.5px] leading-snug" style={{ borderTop: '1px solid #F0F2F5', color: palette.slate }}>
              {openComplaints.length === 0 ? (
                'No open complaints.'
              ) : (
                <>
                  Open: <strong style={{ color: palette.navy }}>{openComplaints[0].summary}</strong>
                  {' · received '}
                  {fmtDue(openComplaints[0].receivedDate)}
                  {openComplaints[0].owner ? ` · ${openComplaints[0].owner} replying` : ''}
                  {openComplaints.length > 1 ? ` · +${openComplaints.length - 1} more open` : ''}
                </>
              )}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ComplianceTab;
