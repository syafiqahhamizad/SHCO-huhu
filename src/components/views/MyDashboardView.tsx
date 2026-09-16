import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  FileSignature,
  FolderOpen,
  Flag,
  Gavel,
  Inbox,
  LayoutDashboard,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Target,
  Timer,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Case, Task } from '../../types';
import { identityTokens, isMine } from '../../lib/identity';
import { DashboardTabs } from '../DashboardTabs';
import { StatCard, Donut, MiniBarChart, ProgressBar } from '../ui';
import { palette } from '../../lib/designTokens';

const TONE = {
  navy: '#16223A',
  slate: '#16223A',
  brass: '#3D6B9C',
  clay: '#B23A2E',
  forest: '#2F6F4E',
  cream: '#F6F8FA',
};

type Bucket = 'overdue' | 'today' | 'week' | 'later';

type Stream =
  | 'hearing'
  | 'deadline'
  | 'task'
  | 'approval'
  | 'signature'
  | 'unbilled'
  | 'matter';

interface Row {
  id: string;
  stream: Stream;
  title: string;
  matterRef?: string;
  matterTitle?: string;
  caseId?: string;
  dueDate: string;
  status: string;
  view: string;
  /** present only for case tasks — enables inline complete */
  task?: { caseId: string; taskId: string };
}

const STREAM_META: Record<Stream, { label: string; icon: React.ElementType; color: string }> = {
  hearing: { label: 'Court date', icon: Gavel, color: TONE.clay },
  deadline: { label: 'Statutory deadline', icon: AlertTriangle, color: TONE.clay },
  task: { label: 'Task', icon: ClipboardList, color: TONE.navy },
  approval: { label: 'Awaiting your approval', icon: ShieldCheck, color: TONE.brass },
  signature: { label: 'Awaiting your sign-off', icon: FileSignature, color: TONE.brass },
  unbilled: { label: 'Unbilled work', icon: Receipt, color: TONE.forest },
  matter: { label: 'Open matter', icon: FolderOpen, color: TONE.slate },
};

const BUCKET_META: Record<Bucket, { label: string; accent: string; note: string }> = {
  overdue: { label: 'Overdue', accent: TONE.clay, note: 'Past due — clear these first' },
  today: { label: 'Today', accent: TONE.navy, note: 'Due before close of business' },
  week: { label: 'This week', accent: TONE.brass, note: 'Next seven days' },
  later: { label: 'Later', accent: TONE.slate, note: 'Beyond this week or undated' },
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DONE = ['Done', 'Completed', 'Approved', 'Cancelled'];

export const MyDashboardView: React.FC = () => {
  const {
    cases,
    deadlines,
    timeEntries,
    expenses,
    paymentVouchers,
    travelClaims,
    quotations,
    invoices,
    payments,
    leads,
    referralPartners,
    leaveApplications,
    currentUser,
    setCurrentView,
    setCurrentCaseId,
    updateCase,
    updateUserStaffProfile,
    currentView,
  } = useApp() as any;

  const [open, setOpen] = useState<Record<Bucket, boolean>>({
    overdue: true,
    today: true,
    week: true,
    later: false,
  });
  const [composing, setComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState({ title: '', caseId: '', dueDate: '', assignedTo: '' });
  const [editingTargets, setEditingTargets] = useState(false);

  const todayStr = iso(new Date());
  const weekStr = iso(new Date(Date.now() + 7 * 86400000));

  // See src/lib/identity.ts — upstream stores the same person as a display name,
  // a partner code or an id depending on the collection.
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const mine = (v?: unknown) => isMine(v, me);

  const isPartner = (currentUser?.role || '') === 'Partner' || currentUser?.isAdmin;

  const myCases: Case[] = useMemo(
    () =>
      (cases || []).filter(
        (c: Case) =>
          mine(c.lawyerInCharge) ||
          mine(c.lawyers as any) ||
          mine(c.partners as any) ||
          isPartner
      ),
    [cases, me, isPartner]
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const caseById = new Map((cases || []).map((c: Case) => [c.id, c]));

    // 1 + 3 — case tasks assigned to me, and hearings on my matters
    (cases || []).forEach((c: Case) => {
      (c.tasks || []).forEach((t: Task) => {
        if (DONE.includes(t.status)) return;
        if (!mine(t.assignedTo)) return;
        out.push({
          id: `task-${c.id}-${t.id}`,
          stream: 'task',
          title: t.title,
          matterRef: c.ref,
          matterTitle: c.title,
          caseId: c.id,
          dueDate: t.dueDate || '',
          status: t.status,
          view: 'cases',
          task: { caseId: c.id, taskId: t.id },
        });
      });

      const onMyMatter =
        mine(c.lawyerInCharge) || mine(c.lawyers as any) || mine(c.partners as any);
      if (!onMyMatter) return;

      (c.hearings || []).forEach((h) => {
        if (h.status !== 'Scheduled' || !h.date) return;
        out.push({
          id: `hearing-${c.id}-${h.id}`,
          stream: 'hearing',
          title: `${h.purpose}${h.time ? ` · ${h.time}` : ''}`,
          matterRef: c.ref,
          matterTitle: c.court || c.title,
          caseId: c.id,
          dueDate: h.date,
          status: h.clientAttendanceRequired === 'Compulsory' ? 'Client must attend' : 'Scheduled',
          view: 'cases',
        });
      });

      // 5a — matter documents routed to me for signature
      (c.documents || []).forEach((d: any) => {
        if (!d.signatureStatus) return;
        if (d.signatureStatus === 'Signed' || d.signatureStatus === 'Not Required') return;
        if (d.signatureBy && !mine(d.signatureBy)) return;
        if (!d.signatureBy && !onMyMatter) return;
        out.push({
          id: `sign-doc-${c.id}-${d.id}`,
          stream: 'signature',
          title: `${d.name}${d.category ? ` · ${d.category}` : ''}`,
          matterRef: c.ref,
          matterTitle: c.title,
          caseId: c.id,
          dueDate: d.signatureDueDate || '',
          status: d.signatureStatus,
          view: 'cases',
        });
      });

      // 7 — open matters with no scheduled next step
      if (c.status === 'Active' && !(c.tasks || []).length && !(c.hearings || []).some((h) => h.status === 'Scheduled')) {
        out.push({
          id: `matter-${c.id}`,
          stream: 'matter',
          title: c.nextAction || 'No next action recorded',
          matterRef: c.ref,
          matterTitle: c.title,
          caseId: c.id,
          dueDate: c.caseStatusDetails?.nextActionDueDate || '',
          status: c.stage || 'Active',
          view: 'cases',
        });
      }
    });

    // 2 — statutory deadlines where I am partner or lawyer of record
    (deadlines || []).forEach((d: any) => {
      if (DONE.includes(d.status)) return;
      if (!mine(d.lawyer) && !mine(d.partner)) return;
      const c: any = caseById.get(d.caseId);
      out.push({
        id: `deadline-${d.id}`,
        stream: 'deadline',
        title: `${d.title} · ${d.type}`,
        matterRef: c?.ref || d.caseId,
        matterTitle: c?.title,
        caseId: d.caseId,
        dueDate: d.dueDate || '',
        status: d.priority === 'Urgent' ? 'Urgent' : d.status,
        view: 'deadlines',
      });
    });

    // 4 — approvals I have to give (partners / admins only)
    if (isPartner) {
      const pending = (s?: string) =>
        s === 'Pending Approval' || s === 'Pending PIC Approval';

      (timeEntries || []).forEach((t: any) => {
        if (!pending(t.approvalStatus)) return;
        const c: any = caseById.get(t.caseId);
        out.push({
          id: `appr-time-${t.id}`,
          stream: 'approval',
          title: `Time entry · ${t.hours}h by ${t.feeEarner}`,
          matterRef: c?.ref,
          matterTitle: t.description,
          caseId: t.caseId,
          dueDate: t.date || '',
          status: 'Pending approval',
          view: 'timeTracking',
        });
      });

      (expenses || []).forEach((e: any) => {
        if (!pending(e.approvalStatus)) return;
        out.push({
          id: `appr-exp-${e.id}`,
          stream: 'approval',
          title: `Expense · RM ${Number(e.amount || 0).toLocaleString()} ${e.category || ''}`.trim(),
          matterRef: e.fileRef || (caseById.get(e.caseId) as any)?.ref,
          matterTitle: e.description,
          caseId: e.caseId,
          dueDate: e.date || '',
          status: 'Pending approval',
          view: 'reimbursements',
        });
      });

      (travelClaims || []).forEach((t: any) => {
        if (!pending(t.approvalStatus)) return;
        out.push({
          id: `appr-travel-${t.id}`,
          stream: 'approval',
          title: `Travel claim · RM ${Number(t.total || 0).toLocaleString()} (${t.claimant})`,
          matterRef: t.fileRef,
          matterTitle: t.purpose,
          dueDate: t.date || '',
          status: 'Pending approval',
          view: 'reimbursements',
        });
      });

      (quotations || []).forEach((q: any) => {
        if (q.approvalStatus !== 'Pending') return;
        out.push({
          id: `appr-quote-${q.id}`,
          stream: 'approval',
          title: `Quotation · RM ${Number(q.total || 0).toLocaleString()} (${q.clientName})`,
          matterRef: q.fileRef,
          matterTitle: q.practiceArea,
          dueDate: q.date || '',
          status: 'Pending approval',
          view: 'quotations',
        });
      });

      (leaveApplications || []).forEach((l: any) => {
        if (l.status !== 'Pending') return;
        out.push({
          id: `appr-leave-${l.id}`,
          stream: 'approval',
          title: `${l.leaveType} leave · ${l.days} day(s)`,
          matterTitle: l.reason,
          dueDate: l.startDate || '',
          status: 'Pending approval',
          view: 'staffPortal',
        });
      });

      // 5 — vouchers and invoices waiting on a signature / release
      (paymentVouchers || []).forEach((v: any) => {
        if (v.approved || v.approvalStatus === 'Approved') return;
        if (v.approvalStatus !== 'Pending Approval' && v.approvalStatus !== 'Draft') return;
        out.push({
          id: `sign-pv-${v.id}`,
          stream: 'signature',
          title: `Payment voucher ${v.id} · RM ${Number(v.amount || 0).toLocaleString()}`,
          matterRef: v.fileRef,
          matterTitle: v.payee || v.description,
          dueDate: v.date || '',
          status: 'Needs sign-off',
          view: 'paymentVouchers',
        });
      });

      (invoices || []).forEach((i: any) => {
        if (i.status !== 'Pending Review') return;
        const c: any = caseById.get(i.caseId);
        out.push({
          id: `sign-inv-${i.id}`,
          stream: 'signature',
          title: `Invoice ${i.id} · RM ${Number(i.total || 0).toLocaleString()}`,
          matterRef: i.fileRef || c?.ref,
          matterTitle: i.partyName || c?.clientName,
          caseId: i.caseId,
          dueDate: i.dueDate || i.date || '',
          status: 'Pending review',
          view: 'billingPipeline',
        });
      });
    }

    // 6 — my unbilled write-ups, one row per matter
    const unbilled = new Map<string, { hours: number; amount: number }>();
    (timeEntries || []).forEach((t: any) => {
      if (!t.billable || t.billed || t.approvalStatus === 'Rejected') return;
      if (!mine(t.feeEarner)) return;
      const agg = unbilled.get(t.caseId) || { hours: 0, amount: 0 };
      agg.hours += Number(t.hours || 0);
      agg.amount += Number(t.hours || 0) * Number(t.rate || 0);
      unbilled.set(t.caseId, agg);
    });
    unbilled.forEach((agg, caseId) => {
      const c: any = caseById.get(caseId);
      out.push({
        id: `unbilled-${caseId}`,
        stream: 'unbilled',
        title: `${agg.hours.toFixed(1)}h unbilled · RM ${agg.amount.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}`,
        matterRef: c?.ref || caseId,
        matterTitle: c?.title,
        caseId,
        dueDate: '',
        status: 'Write up',
        view: 'billingPipeline',
      });
    });

    return out;
  }, [cases, deadlines, timeEntries, expenses, paymentVouchers, travelClaims, quotations, invoices, leaveApplications, me, isPartner]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, Row[]> = { overdue: [], today: [], week: [], later: [] };
    rows.forEach((r) => {
      let b: Bucket = 'later';
      if (!r.dueDate) b = 'later';
      else if (r.dueDate < todayStr) b = 'overdue';
      else if (r.dueDate === todayStr) b = 'today';
      else if (r.dueDate <= weekStr) b = 'week';
      g[b].push(r);
    });
    (Object.keys(g) as Bucket[]).forEach((k) =>
      g[k].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    );
    return g;
  }, [rows, todayStr, weekStr]);

  const monthStr = todayStr.slice(0, 7); // YYYY-MM

  // Today's task completion + this-week completion streak, from real Task.status/dueDate/completedAt.
  const productivity = useMemo(() => {
    const myTaskList: Task[] = [];
    myCases.forEach((c) => (c.tasks || []).forEach((t) => myTaskList.push(t)));
    const dueToday = myTaskList.filter((t) => t.dueDate === todayStr);
    const doneToday = dueToday.filter((t) => DONE.includes(t.status));
    const pct = dueToday.length ? Math.round((doneToday.length / dueToday.length) * 100) : 100;

    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = iso(d);
      const due = myTaskList.filter((t) => t.dueDate === dStr);
      const done = due.filter((t) => DONE.includes(t.status));
      const state: 'done' | 'partial' | 'none' = due.length === 0 ? 'none' : done.length === due.length ? 'done' : 'partial';
      return { label, state, isFuture: dStr > todayStr };
    });
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].isFuture) continue;
      if (days[i].state !== 'done') break;
      streak++;
    }
    return { pct, dueToday: dueToday.length, doneToday: doneToday.length, days, streak };
  }, [myCases, todayStr]);

  // My billed / collected / aging receivables — this month, from real invoices + payments on my matters.
  const billing = useMemo(() => {
    const myCaseIds = new Set(myCases.map((c) => c.id));
    const myInvoices = (invoices || []).filter((i: any) => myCaseIds.has(i.caseId));
    const paidFor = (invId: string) => (payments || []).filter((p: any) => p.invoiceId === invId).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    const billedThisMonth = myInvoices.filter((i: any) => (i.date || '').startsWith(monthStr)).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const collectedThisMonth = (payments || [])
      .filter((p: any) => myInvoices.some((i: any) => i.id === p.invoiceId) && (p.date || '').startsWith(monthStr))
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    const buckets = { current: 0, d31: 0, d61: 0, d91: 0, over120: 0 };
    myInvoices.forEach((i: any) => {
      if (i.status === 'Paid' || i.status === 'Voided') return;
      const balance = Number(i.total || 0) - paidFor(i.id);
      if (balance <= 0) return;
      const due = i.dueDate || i.date;
      const days = due ? Math.floor((new Date(todayStr).getTime() - new Date(due).getTime()) / 86400000) : 0;
      if (days <= 30) buckets.current += balance;
      else if (days <= 60) buckets.d31 += balance;
      else if (days <= 90) buckets.d61 += balance;
      else if (days <= 120) buckets.d91 += balance;
      else buckets.over120 += balance;
    });

    const totalBilled = myInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalCollected = myInvoices.reduce((s: number, i: any) => s + paidFor(i.id), 0);
    const collectionRate = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;

    return { billedThisMonth, collectedThisMonth, buckets, totalBilled, totalCollected, collectionRate };
  }, [myCases, invoices, payments, monthStr, todayStr]);

  // My referrals — Lead.assignedTo (mine) grouped by real referralSourceCategory, converted = stage === 'Converted'.
  const myReferrals = useMemo(() => {
    const myLeads = (leads || []).filter((l: any) => mine(l.assignedTo));
    const converted = myLeads.filter((l: any) => l.stage === 'Converted');
    const bySource = new Map<string, number>();
    myLeads.forEach((l: any) => {
      const src = l.referralSourceCategory || 'Other';
      bySource.set(src, (bySource.get(src) || 0) + 1);
    });
    return {
      broughtIn: myLeads.length,
      converted: converted.length,
      rate: myLeads.length ? Math.round((converted.length / myLeads.length) * 100) : 0,
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [leads, me]);

  const filesBroughtIn = useMemo(() => myCases.filter((c) => c.referredBy && mine(c.lawyerInCharge)).length, [myCases, me]);

  const targets = currentUser?.staffProfile?.targets || { billed: 50000, collected: 30000, files: 25, referrals: 10 };
  const setTargets = (patch: Partial<typeof targets>) => {
    if (!currentUser?.id) return;
    updateUserStaffProfile(currentUser.id, { ...(currentUser.staffProfile || {}), targets: { ...targets, ...patch } } as any);
  };

  const openMatter = (r: Row) => {
    if (r.caseId) setCurrentCaseId(r.caseId);
    setCurrentView(r.view);
  };

  const completeTask = (r: Row) => {
    if (!r.task) return;
    const c: Case | undefined = (cases || []).find((x: Case) => x.id === r.task!.caseId);
    if (!c) return;
    updateCase(c.id, {
      tasks: (c.tasks || []).map((t) =>
        t.id === r.task!.taskId
          ? { ...t, status: 'Completed' as Task['status'], completedAt: new Date().toISOString() }
          : t
      ),
    });
  };

  const addTask = () => {
    const c: Case | undefined = (cases || []).find((x: Case) => x.id === draft.caseId);
    if (!c || !draft.title.trim()) return;
    const task: Task = {
      id: `T-${Date.now()}`,
      title: draft.title.trim(),
      priority: 'Medium',
      status: 'Not Started',
      dueDate: draft.dueDate,
      assignedTo: draft.assignedTo || currentUser?.name || '',
      taskType: 'Standard',
    };
    updateCase(c.id, { tasks: [...(c.tasks || []), task] });
    setDraft({ title: '', caseId: '', dueDate: '', assignedTo: '' });
    setComposing(false);
  };

  const overdueCount = grouped.overdue.length;
  const todayCount = grouped.today.length;
  const waitingCount = rows.filter((row) => row.stream === 'approval' || row.stream === 'signature').length;
  const unbilledRows = rows.filter((row) => row.stream === 'unbilled');
  const renderRows = (list: Row[], emptyLabel: string) => (
    list.filter((row) => {
      const query = searchQuery.trim().toLowerCase();
      return !query || [row.title, row.matterRef, row.matterTitle, row.status].some((value) => value?.toLowerCase().includes(query));
    }).length === 0 ? (
      <p className="px-4 py-6 text-center text-[11px] text-slate-400">{emptyLabel}</p>
    ) : (
      <div className="divide-y divide-[#F6F8FA]">
        {list.filter((row) => {
          const query = searchQuery.trim().toLowerCase();
          return !query || [row.title, row.matterRef, row.matterTitle, row.status].some((value) => value?.toLowerCase().includes(query));
        }).slice(0, 6).map((row) => {
          const meta = STREAM_META[row.stream];
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
              {row.task && (
                <button type="button" onClick={() => completeTask(row)} title="Mark complete" className="grid h-5 w-5 shrink-0 place-items-center rounded border border-slate-300 text-slate-400 hover:border-emerald-600 hover:text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                </button>
              )}
              <div className="min-w-[160px] flex-1">
                <p className="text-[12px] font-semibold leading-snug text-[#16223A]">{row.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px] text-[#5B6478]">
                  <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  {row.matterRef && <span className="font-mono font-semibold">{row.matterRef}</span>}
                  {row.matterTitle && <span className="truncate">{row.matterTitle}</span>}
                </p>
              </div>
              <span className="shrink-0 text-[10.5px] font-semibold text-[#5B6478]">{row.dueDate || 'Undated'}</span>
              <button type="button" onClick={() => openMatter(row)} className="shrink-0 text-[10.5px] font-bold text-[#8A6D3B] hover:underline">Open</button>
            </div>
          );
        })}
      </div>
    )
  );

  return (
    <div className="space-y-[18px] pb-8 text-[12px]">
      <div className="my-dashboard-dark-panel flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-[#16223A] bg-[#16223A] px-[18px] py-3.5 text-white shadow-lg">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[19px] font-bold">My Dashboard</h1>
          <p className="mt-0.5 text-[11.5px] text-slate-300">Your week at a glance - to-do, deadlines, hearings and matters</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[160px] max-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search matters, clients, docs..." className="w-full rounded-md border border-[#DDE3EB] bg-[#F6F8FA] py-1.5 pl-8 pr-2 text-[11px] text-[#16223A] outline-none focus:border-[#3D6B9C]" />
          </label>
          <button type="button" title="Refresh dashboard" onClick={() => window.location.reload()} className="p-1.5 text-slate-300 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" title="Open activity notifications" onClick={() => setCurrentView('activityLogs')} className="rounded-md border border-white/20 bg-white/10 p-1.5 text-[#8A6D3B] hover:bg-white/20"><Bell className="h-4 w-4" /></button>
          <div className="ml-auto flex min-w-0 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1.5">
            <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15"><ShieldCheck className="h-3 w-3 text-[#8A6D3B]" /></div>
            <span className="truncate text-[11px] font-bold">{currentUser?.name || 'Team member'}</span>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['My active matters', myCases.filter((c) => c.status === 'Active').length, 'assigned', FolderOpen, '#16223A'],
          ['Deadlines this week', grouped.overdue.length + grouped.today.length + grouped.week.length, `${overdueCount} overdue`, Flag, '#B23A2E'],
          ['My hearings', rows.filter((r) => r.stream === 'hearing').length, 'this week', Gavel, '#6B3D8C'],
          ['To-do open', rows.filter((r) => r.stream === 'task').length, 'tasks', CheckCircle2, '#3D6B9C'],
          ['Waiting on you', waitingCount, 'approvals', Inbox, '#8A6D3B'],
          ['Unbilled time', unbilledRows.length, 'matters', Timer, '#2F6F4E'],
        ].map(([label, value, note, Icon, color]) => {
          const MetricIcon = Icon as React.ElementType;
          return <div key={String(label)} className="my-dashboard-dark-panel flex min-h-[142px] flex-col gap-2 rounded-xl p-4 text-white shadow-lg ring-1 ring-black/5" style={{ backgroundColor: String(color) }}><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-md bg-white/15"><MetricIcon className="h-4 w-4" /></span><span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/85">{String(label)}</span></span><span className="flex items-baseline gap-1.5 font-serif text-[30px] font-bold leading-none">{String(value)} <small className="font-sans text-[10.5px] font-normal text-white/75">{String(note)}</small></span><span className="text-[10.5px] leading-relaxed text-white/80">{label === 'My active matters' ? 'Assigned to your current practice queue' : label === 'Unbilled time' ? 'Billable write-ups awaiting billing' : 'Requires your attention this week'}</span></div>;
        })}
      </section>

      {composing && (
        <div className="border-b border-[#DDE3EB] bg-[#F6F8FA] p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-sm font-bold" style={{ color: TONE.navy }}>
              New task
            </h3>
            <button onClick={() => setComposing(false)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What needs doing"
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] md:col-span-2"
            />
            <select
              value={draft.caseId}
              onChange={(e) => setDraft({ ...draft, caseId: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
            >
              <option value="">Select matter…</option>
              {myCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ref} — {c.title}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={draft.assignedTo}
              onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })}
              placeholder={`Assign to (default: ${currentUser?.name || 'me'})`}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[13px]"
            />
            <button
              onClick={addTask}
              disabled={!draft.title.trim() || !draft.caseId}
              className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: TONE.navy }}
            >
              Save task
            </button>
          </div>
        </div>
      )}

      <section className="grid gap-3.5 xl:grid-cols-2">
        {[['Matter to-do', grouped.overdue.concat(grouped.today, grouped.week), TONE.navy, 'All matter tasks', Scale, true], ['Private to-do', [], '#3D6B9C', 'Open in Google Tasks', User, false]].map(([title, list, color, link, Icon, canAdd]) => {
          const PanelIcon = Icon as React.ElementType;
          return <div key={String(title)} className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white shadow-sm"><div className="my-dashboard-dark-panel flex items-center gap-2.5 px-3.5 py-3 text-white" style={{ backgroundColor: String(color) }}><PanelIcon className="h-4 w-4 text-[#FBF2E9]" /><div><strong className="block font-serif text-[14.5px]">{String(title)}</strong><span className="text-[10.5px] text-white/70">{canAdd ? 'Tied to a file · two-way sync with Google Tasks' : 'No file attached · yours only · Google Tasks'}</span></div>{canAdd && <button type="button" onClick={() => setComposing((v) => !v)} className="ml-auto flex items-center gap-1 rounded-md bg-[#3D6B9C] px-2.5 py-1.5 text-[11px] font-bold"><Plus className="h-3 w-3" /> Add</button>}</div>{canAdd && composing ? null : renderRows(list as Row[], 'Nothing here.')}<div className="flex items-center gap-2 border-t border-[#DDE3EB] bg-[#F6F8FA] px-3.5 py-2.5 text-[10.5px] text-[#5B6478]"><CheckCircle2 className="h-3.5 w-3.5 text-[#2F6F4E]" /><span>{(list as Row[]).length} open items</span><button type="button" onClick={() => setCurrentView(canAdd ? 'tasks' : 'activityLogs')} className="ml-auto font-bold text-[#8A6D3B]">{String(link)} -&gt;</button></div></div>;
        })}
      </section>

      <section className="grid gap-3.5 xl:grid-cols-2">
        {[['Deadlines this week', grouped.overdue.concat(grouped.today, grouped.week), '#B23A2E', Flag], ['My hearings', rows.filter((r) => r.stream === 'hearing'), '#6B3D8C', Gavel]].map(([title, list, color, Icon]) => { const PanelIcon = Icon as React.ElementType; return <div key={String(title)} className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white shadow-sm"><div className="my-dashboard-dark-panel flex items-center gap-2.5 px-3.5 py-2.5 text-white" style={{ backgroundColor: String(color) }}><PanelIcon className="h-4 w-4" /><strong className="font-serif text-[14px]">{String(title)}</strong><button type="button" onClick={() => setCurrentView(String(title).startsWith('My') ? 'hearings' : 'deadlines')} className="ml-auto text-[10.5px] font-bold text-white/80 hover:underline">Open -&gt;</button></div>{renderRows(list as Row[], 'No items scheduled.')}</div>; })}
      </section>

      <section className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white shadow-sm"><div className="flex items-center gap-2.5 border-b border-[#DDE3EB] bg-[#F6F8FA] px-3.5 py-2.5"><Clock className="h-4 w-4 text-[#8A6D3B]" /><strong className="font-serif text-[14px] text-[#16223A]">Recently accessed matters</strong><button type="button" onClick={() => setCurrentView('cases')} className="ml-auto text-[10.5px] font-bold text-[#8A6D3B]">My matters -&gt;</button></div>{renderRows(myCases.filter((c) => c.lastAccessed).slice(0, 5).map((c) => ({ id: c.id, stream: 'matter', title: c.title, matterRef: c.ref, matterTitle: c.practiceArea || c.stage, caseId: c.id, dueDate: '', status: c.status, view: 'cases' })), 'No recently accessed matters.')}</section>

      <section className="grid gap-3.5 xl:grid-cols-2">
        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#16223A]"><Zap className="h-3.5 w-3.5 text-[#8A6D3B]" /> My productivity rate</span>
            <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: '#E6EFE9', color: palette.green }}>
              {productivity.pct >= 100 ? 'On track today' : `${productivity.pct}% today`}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3.5">
            <Donut segments={[{ label: 'Done', value: productivity.pct, color: palette.green }]} size={64} thickness={10} centerLabel={`${productivity.pct}%`} />
            <p className="text-[11px] text-[#5B6478]">{productivity.doneToday} of {productivity.dueToday} tasks due today<br />completed</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
          <span className="text-[13px] font-bold text-[#16223A]">🔥 Completion streak — this week</span>
          <div className="mt-3 flex gap-1.5">
            {productivity.days.map((d, i) => (
              <span
                key={i}
                className="flex flex-1 items-center justify-center rounded-md py-1.5 text-[10.5px] font-bold"
                style={{
                  backgroundColor: d.state === 'done' ? palette.green : d.state === 'partial' ? palette.gold : '#F0F2F5',
                  color: d.state === 'none' ? '#9AA3AE' : '#fff',
                }}
              >
                {d.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-[#5B6478]">{productivity.streak}-day streak — green days finished 100% of tasks due.</p>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-[15px] font-bold" style={{ color: palette.navy }}>My Performance</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="My billed (RM)" value={billing.billedThisMonth.toLocaleString()} color={palette.gold} />
          <StatCard label="My collected (RM)" value={billing.collectedThisMonth.toLocaleString()} color={palette.green} />
          <StatCard label="Files I brought" value={filesBroughtIn} color={palette.blue} />
          <StatCard label="My collection rate" value={`${billing.collectionRate}%`} color={palette.navy} />
        </div>
        <div className="mt-3 grid gap-3.5 xl:grid-cols-2">
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-4 text-center">
            <p className="mb-2.5 text-[12.5px] font-bold text-[#16223A]">My collection rate</p>
            <Donut
              segments={[{ label: 'Collected', value: billing.collectionRate, color: palette.green }]}
              size={110}
              centerLabel={`${billing.collectionRate}%`}
            />
            <p className="mt-2.5 text-[11px] text-[#5B6478]">RM {billing.totalCollected.toLocaleString()} collected of RM {billing.totalBilled.toLocaleString()} billed</p>
          </div>
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-4">
            <p className="mb-2.5 text-[12.5px] font-bold text-[#16223A]">My aging receivables</p>
            <MiniBarChart
              data={[
                { label: 'Current', value: billing.buckets.current, color: palette.blue },
                { label: '31-60', value: billing.buckets.d31, color: palette.blue },
                { label: '61-90', value: billing.buckets.d61, color: palette.blue },
                { label: '91-120', value: billing.buckets.d91, color: palette.blue },
                { label: 'Above 120', value: billing.buckets.over120, color: palette.red },
              ]}
              formatValue={(v) => `RM ${v.toLocaleString()}`}
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[#DDE3EB] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[#16223A]"><Target className="mr-1 inline h-3.5 w-3.5 text-[#8A6D3B]" />My progress to target — {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button
              type="button"
              onClick={() => setEditingTargets((v) => !v)}
              className="rounded-md border border-[#DDE3EB] px-2.5 py-1 text-[11px] font-bold text-[#3D6B9C]"
            >
              {editingTargets ? 'Done' : '✎ Edit targets'}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {([
              ['Billed', billing.billedThisMonth, targets.billed, palette.gold, (v: number) => setTargets({ billed: v }), 'RM'],
              ['Collected', billing.collectedThisMonth, targets.collected, palette.green, (v: number) => setTargets({ collected: v }), 'RM'],
              ['New files brought', filesBroughtIn, targets.files, palette.blue, (v: number) => setTargets({ files: v }), ''],
              ['Referrals converted', myReferrals.converted, targets.referrals, palette.purple, (v: number) => setTargets({ referrals: v }), ''],
            ] as const).map(([label, value, target, color, onSet, prefix]) => (
              <ProgressBar
                key={label}
                label={label}
                pct={target ? (value / target) * 100 : 0}
                color={color}
                valueLabel={
                  <>
                    <strong>{prefix}{value.toLocaleString()}</strong>
                    <span className="text-[#5B6478]"> / {prefix}</span>
                    {editingTargets ? (
                      <input
                        type="number"
                        defaultValue={target}
                        onBlur={(e) => onSet(Number(e.target.value) || 0)}
                        className="w-16 rounded border border-[#DDE3EB] px-1.5 py-0.5 text-[11px]"
                      />
                    ) : (
                      <strong>{target.toLocaleString()}</strong>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[#DDE3EB] bg-white p-4">
          <span className="text-[12.5px] font-bold text-[#16223A]">🔗 My referrals</span>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#F6F8FA] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-[#5B6478]">Leads brought in</p>
              <p className="mt-1 text-lg font-bold">{myReferrals.broughtIn}</p>
            </div>
            <div className="rounded-lg bg-[#F6F8FA] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-[#5B6478]">Converted</p>
              <p className="mt-1 text-lg font-bold" style={{ color: palette.green }}>{myReferrals.converted} <span className="text-[11px] font-normal text-[#5B6478]">({myReferrals.rate}%)</span></p>
            </div>
          </div>
          {myReferrals.bySource.length === 0 ? (
            <p className="mt-3 text-center text-[11px] text-slate-400">No leads attributed to you yet.</p>
          ) : (
            <div className="mt-2.5 flex flex-col">
              {myReferrals.bySource.map(([source, count], i) => (
                <div key={source} className="flex justify-between border-t border-[#F0F2F5] py-1.5 text-[12px] first:border-t-0">
                  <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: [palette.blue, palette.gold, palette.purple, palette.green, palette.red][i % 5] }} />{source}</span>
                  <span>{count} lead{count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          <p className="font-serif text-sm font-bold" style={{ color: TONE.navy }}>
            Your queue is clear
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Nothing is assigned to you across matters, deadlines, approvals or billing.
          </p>
        </div>
      )}
    </div>
  );
};

export default MyDashboardView;
