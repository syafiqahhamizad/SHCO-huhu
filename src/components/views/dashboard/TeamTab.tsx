import React, { useMemo, useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { identityTokens, isMine, partnerCode } from '../../../lib/identity';
import { palette, tint, tintText } from '../../../lib/designTokens';
import { StatCard } from '../../ui';
import type { StaffGoal, User } from '../../../types';
import { inRange, parseLocal, todayLocal } from '../../../lib/localDate';
import { annualLeaveBalance, ANNUAL_LEAVE_DAYS, proRatedTarget } from '../../../lib/teamMetrics';
import { payslipCost, payslipCounts } from '../../../lib/financeMetrics';

/**
 * My Dashboard -> Team (Managing Partner only). Mirrors My Dashboard.dc.html's `isPeople`
 * block (mockup lines ~210-243): 4 KPI tiles, then "Your team" — one row per staff member,
 * expandable into files / goals / "why this workload status" / pay & rewards.
 *
 * Data honesty: there is no payroll/salary, happiness check-in, or retention-scoring data
 * model anywhere in this codebase (grepped — nothing under those names). Rather than invent
 * numbers, those columns render an explicit "Not yet recorded" / "Not tracked" state. Workload
 * is the one column the README gives an exact, computable rule for, so it is derived from real
 * TimeEntry hours, real overdue Task/Deadline counts and StaffProfile.targetHoursPerMonth.
 */

// README "Team (MP only)" workload rule, copied verbatim:
// Healthy = 85-110% of target hours, fewer than 2 overdue tasks, under 10h overtime.
// Busy = one of these slips. Overloaded = over 110% for 3 months or 15+h overtime.
// Under target = below 70% of hours.
const DEFAULT_TARGET_HOURS_PER_MONTH = 160;
// Annual leave: same entitlement and rule as the Staff Portal tile (src/lib/teamMetrics.ts) —
// approved and pending applications both reduce the balance; pending is labelled.

const AVATAR_COLORS = [palette.blue, palette.green, palette.gold, palette.purple, palette.red, palette.navy];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const LOAD_META: Record<'Healthy' | 'Busy' | 'Overloaded' | 'Under target', { bg: string; fg: string }> = {
  Healthy: { bg: tint.green, fg: tintText.green },
  Busy: { bg: tint.gold, fg: tintText.gold },
  Overloaded: { bg: tint.red, fg: tintText.red },
  'Under target': { bg: tint.blue, fg: tintText.blue },
};

function monthBounds(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  return { start, end };
}

interface TeamRow {
  user: User;
  code: string;
  color: string;
  initials: string;
  years: string;
  load: 'Healthy' | 'Busy' | 'Overloaded' | 'Under target';
  hoursThisMonth: number;
  targetHours: number;
  overtimeHours: number;
  overdueTasks: number;
  leaveLeft: number;
  leavePending: number;
  filesCount: number;
  files: { name: string; ref: string; stage: string }[];
  why: string[];
}

const TeamTab: React.FC = () => {
  const { currentUser, users, cases, timeEntries, leaveApplications, payslips, addStaffGoal, showToast } = useApp();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<{ type: StaffGoal['type']; text: string; help: string }>({ type: 'Career', text: '', help: '' });
  const [addingGoalFor, setAddingGoalFor] = useState<string | null>(null);

  // Managing Partner = the Super Admin only (an admin partner is not MP).
  const isMP = Boolean(currentUser?.isSuperAdmin) || String(currentUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com';

  const rows: TeamRow[] = useMemo(() => {
    const today = todayLocal();
    const now = new Date();
    return (users || [])
      .filter((u) => u.status === 'Active')
      .map((u, i) => {
        const tokens = identityTokens(u);
        const code = partnerCode(u) || u.staffProfile?.staffId || initialsOf(u.name);
        const targetHours = u.staffProfile?.targetHoursPerMonth ?? DEFAULT_TARGET_HOURS_PER_MONTH;

        const hoursInMonth = (offset: number) => {
          const { start, end } = monthBounds(offset);
          return (timeEntries || [])
            .filter((t) => isMine(t.feeEarner, tokens))
            .filter((t) => inRange(t.date, start, end))
            .reduce((sum, t) => sum + (t.hours || 0), 0);
        };
        const hoursThisMonth = Math.round(hoursInMonth(0) * 10) / 10;
        // The current month is compared with a PRO-RATED target (target × working days elapsed ÷
        // working days in the month) — comparing 10 days of hours with a full month's target
        // made everyone look "Under target" early in the month.
        const targetToDate = Math.round(proRatedTarget(targetHours, now) * 10) / 10;
        const ratio0 = targetToDate > 0 ? hoursThisMonth / targetToDate : 0;
        // "Over 110% for 3 months" uses the last three COMPLETE months against the full target.
        const pastRatios = [1, 2, 3].map((o) => (targetHours > 0 ? hoursInMonth(o) / targetHours : 0));
        const overtimeHours = Math.max(0, Math.round((hoursThisMonth - targetToDate) * 10) / 10);

        const overdueTasks = (cases || []).reduce(
          (n, c) => n + (c.tasks || []).filter((t) => isMine(t.assignedTo, tokens) && t.dueDate && t.dueDate < today && !['Completed', 'Done'].includes(t.status)).length,
          0
        );

        let load: TeamRow['load'];
        if (pastRatios.every((r) => r > 1.1) || overtimeHours >= 15) load = 'Overloaded';
        else if (ratio0 < 0.7) load = 'Under target';
        else if (ratio0 >= 0.85 && ratio0 <= 1.1 && overdueTasks < 2 && overtimeHours < 10) load = 'Healthy';
        else load = 'Busy';

        const leave = annualLeaveBalance(leaveApplications || [], u.id, now.getFullYear());
        const leaveLeft = leave.left;

        const userCases = (cases || []).filter(
          (c) => c.status !== 'Archive' && (isMine(c.lawyerInCharge, tokens) || (c.lawyers || []).some((l) => isMine(l, tokens)) || (partnerCode(u) && c.partners?.includes(partnerCode(u) as any)))
        );

        const why = [
          `Hours ${hoursThisMonth} h this month vs ${targetToDate} h expected so far (${targetHours} h full month) — ${Math.round(ratio0 * 100)}% of target to date`,
          `Last 3 complete months: ${pastRatios.map((r) => Math.round(r * 100) + '%').join(', ')} of target`,
          `${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'}`,
          `${overtimeHours} h over the pro-rated target this month`,
          `Annual leave: ${leave.left} of ${ANNUAL_LEAVE_DAYS} days left${leave.pending ? ` (${leave.pending} pending approval)` : ''}`,
        ];

        return {
          user: u,
          code,
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          initials: initialsOf(u.name),
          years: u.staffProfile?.joinDate
            ? `${Math.max(0, now.getFullYear() - new Date(parseLocal(u.staffProfile.joinDate) || Date.now()).getFullYear())} yrs`
            : '—',
          load,
          hoursThisMonth,
          targetHours: targetToDate,
          overtimeHours,
          overdueTasks,
          leaveLeft,
          leavePending: leave.pending,
          filesCount: userCases.length,
          files: userCases.slice(0, 8).map((c) => ({ name: c.title, ref: c.ref, stage: c.stage || c.status })),
          why,
        };
      });
  }, [users, cases, timeEntries, leaveApplications]);

  /** Payroll cost (gross + employer EPF + SOCSO/EIS) of the latest month with approved/paid payslips. */
  const payroll = useMemo(() => {
    const counted = (payslips || []).filter(payslipCounts);
    if (!counted.length) return null;
    const period = counted.map((p) => p.period).sort().slice(-1)[0];
    const list = counted.filter((p) => p.period === period);
    return { period, total: list.reduce((s, p) => s + payslipCost(p), 0), n: list.length };
  }, [payslips]);

  const peopleKpis = useMemo(() => {
    const active = rows.length;
    // Leavers: people whose last working day is within the last 12 months. Users marked
    // Inactive without a last working day can't be dated, so they are reported separately.
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const leftUsers = (users || []).filter((u) => u.status === 'Inactive' || ['Resigned', 'Terminated'].includes(u.staffProfile?.employment?.status || ''));
    const lwd = (u: User) => parseLocal(u.staffProfile?.employment?.lastWorkingDay);
    const leftDated = leftUsers.filter((u) => { const t = lwd(u); return t && t >= yearAgo.getTime() && t <= Date.now(); }).length;
    const undated = leftUsers.filter((u) => !lwd(u)).length;
    const motivationFlags = rows.filter((r) => r.overtimeHours >= 15 || r.leaveLeft <= 2 || r.overdueTasks >= 2).length;
    return [
      { label: 'Headcount', value: String(active), note: `${active} active staff on record`, vc: palette.navy },
      payroll
        ? { label: 'Monthly payroll', value: `RM ${Math.round(payroll.total).toLocaleString('en-MY')}`, note: `${payroll.period} · ${payroll.n} payslip${payroll.n === 1 ? '' : 's'} · gross + employer EPF/SOCSO/EIS`, vc: palette.navy }
        : { label: 'Monthly payroll', value: '—', note: 'no approved or paid payslips yet', vc: palette.slate },
      { label: 'Left in last 12 months', value: String(leftDated), note: undated ? `by last working day · ${undated} inactive with no last working day recorded (not counted)` : 'by last working day (HR record)', vc: leftDated > 0 ? palette.gold : palette.green },
      { label: 'Motivation flags', value: String(motivationFlags), note: '15h+ overtime, 2 or fewer leave days left, or 2+ overdue tasks', vc: motivationFlags > 0 ? palette.red : palette.green },
    ];
  }, [rows, users, payroll]);

  if (!isMP) {
    return (
      <div className="mx-auto my-12 max-w-xl space-y-4 rounded-xl border border-[#DDE3EB] bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#FBEDE9] bg-[#FBEDE9] text-[#B23A2E]">
          <Lock className="h-8 w-8" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-[#16223A]">Team is Managing-Partner only</h2>
          <p className="mt-1 text-xs text-slate-600">Workload, pay and goals for every staff member are restricted to the Managing Partner.</p>
        </div>
      </div>
    );
  }

  const submitGoal = (userId: string) => {
    if (!goalDraft.text.trim()) {
      showToast('Add a goal description first.');
      return;
    }
    addStaffGoal(userId, { id: `GOAL-${Date.now()}`, type: goalDraft.type, text: goalDraft.text.trim(), pct: 0, help: goalDraft.help.trim() || '—' });
    setGoalDraft({ type: 'Career', text: '', help: '' });
    setAddingGoalFor(null);
  };

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {peopleKpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} note={k.note} color="#fff" onColor={palette.slate} className="border border-[#DDE3EB] text-[#16223A]" />
        ))}
      </section>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
        <div className="flex items-center gap-2 border-b border-[#EEF1F5] px-3.5 py-2.5">
          <strong className="font-serif text-[14.5px] text-[#16223A]">Your team</strong>
          <span className="text-[10.5px] text-[#5B6478]">click a person to see their files and goals · year to date</span>
        </div>

        <div className="grid grid-cols-[minmax(0,1.3fr)_104px_50px_62px_64px_80px_84px_84px_60px_76px_18px] gap-2 border-b border-[#EEF1F5] bg-[#F6F8FA] px-3.5 py-2 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">
          <span>Name</span>
          <span>Workload</span>
          <span>Files</span>
          <span>Overtime</span>
          <span>Leave left</span>
          <span>Monthly pay</span>
          <span>Profit share</span>
          <span>Total paid</span>
          <span>Happy</span>
          <span>Retention</span>
          <span />
        </div>

        {rows.length === 0 && <div className="px-3.5 py-6 text-center text-[11.5px] text-[#5B6478]">No active staff on record yet.</div>}

        {rows.map((r) => {
          const open = openCode === r.user.id;
          const loadMeta = LOAD_META[r.load];
          return (
            <div key={r.user.id} className="border-b border-[#F0F2F5]">
              <button
                type="button"
                onClick={() => setOpenCode(open ? null : r.user.id)}
                className="grid w-full grid-cols-[minmax(0,1.3fr)_104px_50px_62px_64px_80px_84px_84px_60px_76px_18px] items-center gap-2 px-3.5 py-2.5 text-left"
                style={{ background: open ? '#F6F8FA' : '#fff' }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-[9.5px] font-bold text-white" style={{ backgroundColor: r.color, width: 26, height: 26 }}>
                    {r.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-bold text-[#16223A]">{r.user.name}</span>
                    <span className="block text-[10px] text-[#5B6478]">
                      {r.user.staffProfile?.designation || r.user.role} · {r.years}
                    </span>
                  </span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="self-start rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: loadMeta.bg, color: loadMeta.fg }}>
                    {r.load}
                  </span>
                  <span className="text-[9.5px] text-[#5B6478]" title="target pro-rated to working days so far this month">{r.hoursThisMonth} / {r.targetHours} h to date</span>
                </span>
                <span className="text-[12px] font-bold text-[#16223A]">{r.filesCount}</span>
                <span className="text-[11.5px] font-bold" style={{ color: r.overtimeHours >= 15 ? palette.red : r.overtimeHours >= 10 ? palette.gold : palette.navy }}>
                  {r.overtimeHours} h
                </span>
                <span className="text-[11.5px] font-bold" style={{ color: r.leaveLeft <= 2 || r.leaveLeft >= 20 ? palette.gold : palette.navy }}>
                  {r.leaveLeft} d{r.leavePending > 0 && <span className="block text-[9px] font-normal text-[#5B6478]">{r.leavePending} pending</span>}
                </span>
                <span className="text-[11px] text-[#5B6478]">Not tracked</span>
                <span className="text-[11px] text-[#5B6478]">Not tracked</span>
                <span className="text-[11px] font-bold text-[#5B6478]">Not tracked</span>
                <span className="text-[11px] text-[#5B6478]">Not recorded</span>
                <span className="self-center justify-self-start rounded-full bg-[#F0F2F5] px-1.5 py-0.5 text-[10px] font-bold text-[#5B6478]">Not assessed</span>
                <span className="text-[9px] text-[#5B6478]">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
              </button>

              {open && (
                <div className="grid grid-cols-1 gap-4 border-t border-[#EEF1F5] bg-[#FBFCFD] px-3.5 py-3 pl-12 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Files ({r.filesCount})</div>
                    {r.files.length === 0 && <div className="text-[10.5px] text-[#5B6478]">No open files.</div>}
                    {r.files.map((c, i) => (
                      <div key={c.ref + i} className="flex items-center gap-2 border-t border-[#F0F2F5] py-1 first:border-t-0">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-[#16223A]">{c.name}</span>
                          <span className="block font-mono text-[9.5px] text-[#3D6B9C]">{c.ref}</span>
                        </span>
                        <span className="text-[10px] font-bold text-[#3D6B9C]">{c.stage}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Goals: career &amp; personal</div>
                    {(r.user.staffProfile?.goals || []).length === 0 && <div className="text-[10.5px] text-[#5B6478]">No goals recorded yet.</div>}
                    {(r.user.staffProfile?.goals || []).map((g) => (
                      <div key={g.id} className="py-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#16223A]">
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                            style={{ backgroundColor: g.type === 'Career' ? tint.blue : tint.purple, color: g.type === 'Career' ? tintText.blue : tintText.purple }}
                          >
                            {g.type}
                          </span>
                          <span className="flex-1">{g.text}</span>
                          <strong>{g.pct}%</strong>
                        </div>
                        <div className="mt-1 h-1 rounded bg-[#EEF1F5]">
                          <div className="h-1 rounded" style={{ width: `${Math.max(0, Math.min(100, g.pct))}%`, backgroundColor: palette.purple }} />
                        </div>
                        <div className="mt-0.5 text-[9.5px] text-[#5B6478]">How you can help: {g.help}</div>
                      </div>
                    ))}
                    {addingGoalFor === r.user.id ? (
                      <div className="mt-1.5 space-y-1.5 rounded-lg border border-[#E3E7EC] bg-white p-2">
                        <select
                          value={goalDraft.type}
                          onChange={(e) => setGoalDraft((d) => ({ ...d, type: e.target.value as StaffGoal['type'] }))}
                          className="w-full rounded border border-[#E3E7EC] px-1.5 py-1 text-[10.5px]"
                        >
                          <option value="Career">Career</option>
                          <option value="Personal">Personal</option>
                        </select>
                        <input
                          value={goalDraft.text}
                          onChange={(e) => setGoalDraft((d) => ({ ...d, text: e.target.value }))}
                          placeholder="Goal"
                          className="w-full rounded border border-[#E3E7EC] px-1.5 py-1 text-[10.5px]"
                        />
                        <input
                          value={goalDraft.help}
                          onChange={(e) => setGoalDraft((d) => ({ ...d, help: e.target.value }))}
                          placeholder="How you can help"
                          className="w-full rounded border border-[#E3E7EC] px-1.5 py-1 text-[10.5px]"
                        />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => submitGoal(r.user.id)} className="rounded bg-[#16223A] px-2 py-1 text-[10.5px] font-bold text-white">
                            Save
                          </button>
                          <button type="button" onClick={() => setAddingGoalFor(null)} className="rounded border border-[#DDE3EB] px-2 py-1 text-[10.5px] font-bold text-[#16223A]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingGoalFor(r.user.id)}
                        className="mt-1 flex items-center gap-1 text-[10.5px] font-bold text-[#8A6D3B]"
                      >
                        <Plus className="h-3 w-3" /> Add goal
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Why "{r.load}"</div>
                    {r.why.map((t, i) => (
                      <div key={i} className="flex gap-1.5 py-0.5 text-[10.5px] leading-relaxed text-[#16223A]">
                        <span className="font-extrabold" style={{ color: r.load === 'Healthy' ? palette.green : palette.red }}>
                          {r.load === 'Healthy' ? '✓' : '!'}
                        </span>
                        <span>{t}</span>
                      </div>
                    ))}
                    <div className="mt-2 text-[9.5px] font-bold uppercase tracking-wide text-[#5B6478]">Pay &amp; rewards</div>
                    <div className="py-1 text-[10.5px] text-[#5B6478]">No payroll data model yet — salary, profit share, bonus and referral fees are not tracked here.</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="bg-[#F6F8FA] px-3.5 py-2 text-[10.5px] leading-relaxed text-[#5B6478]">
          <strong className="text-[#16223A]">How workload is decided:</strong> Healthy = 85–110% of target hours (pro-rated to working days so far this month), under 2 overdue tasks, under 10 h overtime. Busy = one of these
          slips. Overloaded = over 110% in each of the last 3 complete months, or 15+ h over the pro-rated target. Under target = below 70% hours. Happiness comes from a 2-question monthly check-in in Staff Portal —
          not yet built, so it is shown as "Not recorded" until that exists.
        </div>
      </div>
    </div>
  );
};

export default TeamTab;
