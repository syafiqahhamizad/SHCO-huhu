import React, { useEffect, useMemo, useState } from 'react';
import { Compass, LayoutDashboard, Landmark, ShieldCheck, Target, Users as UsersIcon, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Invoice, Retainer } from '../../types';
import { identityTokens, isMine } from '../../lib/identity';
import { caseFinder, isIssued, owedBalance, paidByInvoice } from '../../lib/financeMetrics';
import { parseLocal } from '../../lib/localDate';
import { canSeeClientBilling, finGrants, finRoleKey } from '../../lib/financeAccess';
import { getPracticeSettings } from '../../services/templateService';
import ClientAccountTab from './dashboard/ClientAccountTab';
import ComplianceTab, { complianceStatusOf } from './dashboard/ComplianceTab';
import FinanceTab from './dashboard/FinanceTab';
import TeamTab from './dashboard/TeamTab';
import PartnerKpisTab from './dashboard/PartnerKpisTab';
import DirectionTab from './dashboard/DirectionTab';
import { MyWorkTab } from './dashboard/MyWorkTab';
import { PartnerMoney, StaffMoney } from './dashboard/MyMoneyTab';
import { useMyWorkRows } from './dashboard/myWork';

type QKey = 'mine' | 'money' | 'cacc' | 'people' | 'kpi' | 'safety' | 'dir';
type Tier = 'mp' | 'partner' | 'staff';

const GREEN = '#2F6F4E';
const GOLD = '#8A6534';
const RED = '#B23A2E';
const GREY = '#C9D1DC';
const DOT_TITLE: Record<string, string> = { [GREEN]: 'All good', [GOLD]: 'Worth a look', [RED]: 'Needs attention', [GREY]: 'No alerts for this tab' };

/** [key, label, sub, icon, Managing Partner only (🔒)] — design: My Dashboard → Qall. */
const QTABS: [QKey, string, string, React.ElementType, boolean][] = [
  ['mine', 'My work', 'Tasks, meetings, approvals', LayoutDashboard, false],
  ['money', 'Finance', 'Margin, cash, funds', Wallet, false],
  ['cacc', 'Client account', 'Balances & items to check', Landmark, false],
  ['people', 'Team', 'Workload, pay, goals', UsersIcon, true],
  ['kpi', 'Partner KPIs', 'Scorecards', Target, false],
  ['safety', 'Compliance', 'Checklist & submissions', ShieldCheck, false],
  ['dir', 'Direction', 'Vision, roadmap, growth', Compass, true],
];

/** Which quick tabs each person gets (design ALLOW). */
const ALLOW: Record<Tier, QKey[]> = {
  mp: ['mine', 'money', 'cacc', 'people', 'kpi', 'safety', 'dir'],
  partner: ['mine', 'money', 'cacc', 'kpi', 'safety'],
  staff: ['mine', 'money'],
};

/** My Dashboard (design: My Dashboard.html). Quick tabs by role; "My work" is the default. */
export const MyDashboardView: React.FC = () => {
  const { cases, invoices, payments, retainers, leaveApplications, quotations, currentUser, currentRole } = useApp() as any;

  // Managing Partner = the Super Admin only (an admin partner is not MP), and only while in the
  // Partner role (switching role previews that role's dashboard) — same rule as financeAccess.
  const isMP = finRoleKey(currentRole, currentUser, false) === 'M';
  const tier: Tier = isMP ? 'mp' : currentRole === 'Partner' ? 'partner' : 'staff';
  // Billing & money switched off for this person (Users & Roles): only their own pay.
  const seesBilling = canSeeClientBilling(finRoleKey(currentRole, currentUser, false), finGrants(currentUser));
  const allowed = useMemo(() => ALLOW[tier].filter((k) => seesBilling || !['cacc', 'kpi'].includes(k)), [tier, seesBilling]);

  const [q, setQ] = useState<QKey>('mine');
  useEffect(() => {
    if (!allowed.includes(q)) setQ('mine');
  }, [allowed, q]);

  const work = useMyWorkRows();
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);

  /* ---------- status dots: worked out from the same records each tab shows ---------- */
  const dots = useMemo(() => {
    const todayStr = work.todayStr;
    const open = work.rows.filter((r) => !r.done && r.stream !== 'private');
    const decisionsPending = work.isPartner
      ? (leaveApplications || []).filter((l: any) => l.status === 'Pending').length + (quotations || []).filter((x: any) => x.approvalStatus === 'Pending').length
      : 0;
    const mine = open.some((r) => r.bucket === 'overdue') ? RED : open.some((r) => r.bucket === 'today') || decisionsPending ? GOLD : GREEN;

    // Finance: unpaid bills by age (whole firm for the MP, own files for a partner).
    let money = GREEN;
    if (tier !== 'staff') {
      const findCase = caseFinder(cases || []);
      const paid = paidByInvoice(payments || []);
      let worst = 0;
      (invoices || []).forEach((i: Invoice) => {
        if (!isIssued(i)) return;
        if (tier === 'partner' && !isMine(findCase(i.caseId, i.fileRef)?.partners as any, me)) return;
        if (owedBalance(i, paid.get(i.id) || 0) <= 0.005) return;
        const days = Math.round((parseLocal(todayStr) - parseLocal(i.dueDate || i.date)) / 86400000);
        worst = Math.max(worst, days);
      });
      money = worst > 90 ? RED : worst > 60 ? GOLD : GREEN;
    }

    // Client account: an overdrawn matter ledger needs attention; a dormant balance is worth a look.
    const groups = new Map<string, { bal: number; last: string }>();
    (retainers || []).forEach((r: Retainer) => {
      const k = `${r.clientId || ''}|${r.caseId || ''}`;
      const g = groups.get(k) || { bal: 0, last: '' };
      g.bal += (r.type === 'Deposit' ? 1 : -1) * Number(r.amount || 0);
      if (!g.last || parseLocal(r.date) > parseLocal(g.last)) g.last = r.date;
      groups.set(k, g);
    });
    const gl = [...groups.values()];
    const cacc = gl.some((g) => g.bal < -0.005) ? RED : gl.some((g) => g.bal > 0.005 && (parseLocal(todayStr) - parseLocal(g.last)) / 86400000 > 365) ? GOLD : GREEN;

    const settings = getPracticeSettings();
    const st = (settings.complianceRegister || []).map((i) => complianceStatusOf(i, todayStr));
    const safety = st.includes('overdue') ? RED : st.includes('dueSoon') ? GOLD : GREEN;
    const people = (leaveApplications || []).some((l: any) => l.status === 'Pending') ? GOLD : GREEN;
    const rm = settings.roadmap || [];
    const goals = settings.firmGoals || [];
    const dir = goals.some((g) => g.status === 'At risk') ? RED : rm.some((m) => m.status === 'Behind') || goals.some((g) => g.status === 'Behind') ? GOLD : GREEN;
    return { mine, money, cacc, people, kpi: GREY, safety, dir } as Record<QKey, string>;
  }, [work, tier, cases, invoices, payments, retainers, leaveApplications, quotations, me]);

  const tabs = QTABS.filter(([k]) => allowed.includes(k));

  return (
    <div className="flex flex-col gap-4 pb-8 text-[12px]">
      <section className="flex flex-wrap gap-2">
        {tabs.map(([key, label, sub, Icon, mpOnly]) => {
          const on = q === key;
          const dot = dots[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setQ(key)}
              className="flex min-w-[150px] flex-1 items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left"
              style={{ borderColor: on ? '#16223A' : '#DDE3EB', background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A' }}
            >
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg" style={{ background: on ? 'rgba(255,255,255,.14)' : '#F0F2F5' }}>
                <Icon className="h-[15px] w-[15px]" style={{ color: on ? '#fff' : '#16223A' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold">{label}{mpOnly ? ' 🔒' : ''}</span>
                <span className="block truncate text-[10.5px] opacity-75">{sub}</span>
              </span>
              <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: dot }} title={DOT_TITLE[dot]} />
            </button>
          );
        })}
      </section>

      {q === 'mine' && <MyWorkTab rows={work.rows} todayStr={work.todayStr} weekStr={work.weekStr} me={work.me} isPartner={work.isPartner} />}
      {q === 'money' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-[#D5E0EC] bg-[#EEF3F9] px-3.5 py-[9px]">
            <strong className="text-[12px] text-[#16223A]">{tier === 'mp' ? 'Whole firm' : tier === 'partner' && seesBilling ? `Your files only · ${currentUser?.name || ''}` : `Your own money · ${currentUser?.name || ''}`}</strong>
            <span className="text-[11px] text-[#3D5A7A]">
              {tier === 'mp'
                ? 'You see every partner, file and account. Partners see their own files; staff see their own pay.'
                : tier === 'partner' && seesBilling
                  ? 'Figures cover matters where you are the partner in charge. Firm-wide P&L, cash and funds are for the admin.'
                  : 'Only your pay, claims, referral fees and bonus. Nobody else’s figures are shown.'}
            </span>
          </div>
          {tier === 'mp' ? <FinanceTab /> : tier === 'partner' && seesBilling ? <PartnerMoney /> : <StaffMoney />}
        </div>
      )}
      {q === 'cacc' && <ClientAccountTab />}
      {q === 'people' && <TeamTab />}
      {q === 'kpi' && <PartnerKpisTab scope={isMP ? 'all' : 'own'} />}
      {q === 'safety' && <ComplianceTab />}
      {q === 'dir' && <DirectionTab />}

    </div>
  );
};

