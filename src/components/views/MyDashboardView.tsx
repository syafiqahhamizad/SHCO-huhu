import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock,
  DollarSign,
  FileSignature,
  FolderOpen,
  Flag,
  Gavel,
  Inbox,
  Plus,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  Target,
  Timer,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Case, Task, TaskChecklistItem } from '../../types';
import { identityTokens, isMine, partnerCode } from '../../lib/identity';
import { Donut, MiniBarChart, ProgressBar, TaskFormModal, blankTaskDraft } from '../ui';
import type { TaskDraft } from '../ui';
import { palette, tint, tintText } from '../../lib/designTokens';
import { useConfirmation } from '../../hooks/useConfirmation';

type Bucket = 'overdue' | 'today' | 'week' | 'later';
type FilterValue = 'all' | Bucket | 'hearing' | 'waiting' | 'unbilled';

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
  priority?: Task['priority'];
  checklist?: TaskChecklistItem[];
}

type RowWithBucket = Row & { bucket: Bucket };
type DisplayRow = RowWithBucket & { isGhost?: boolean };

const STREAM_META: Record<Stream, { label: string; icon: React.ElementType; color: string }> = {
  hearing: { label: 'Court date', icon: Gavel, color: palette.red },
  deadline: { label: 'Statutory deadline', icon: AlertTriangle, color: palette.red },
  task: { label: 'Task', icon: ClipboardList, color: palette.navy },
  approval: { label: 'Awaiting your approval', icon: ShieldCheck, color: palette.blue },
  signature: { label: 'Awaiting your sign-off', icon: FileSignature, color: palette.blue },
  unbilled: { label: 'Unbilled work', icon: Receipt, color: palette.green },
  matter: { label: 'Open matter', icon: FolderOpen, color: palette.slate },
};

const BUCKET_META: Record<Bucket, { label: string; accent: string; tint: string; text: string; icon: React.ElementType; note: string }> = {
  overdue: { label: 'Overdue', accent: palette.red, tint: tint.red, text: palette.red, icon: CircleAlert, note: 'Past due, clear these first' },
  today: { label: 'Today', accent: palette.gold, tint: tint.gold, text: tintText.gold, icon: Clock, note: 'Due before close of business' },
  week: { label: 'This week', accent: palette.blue, tint: tint.blue, text: tintText.blue, icon: Calendar, note: 'Next seven days' },
  later: { label: 'Later', accent: palette.slate, tint: '#F0F2F5', text: palette.slate, icon: Calendar, note: 'Beyond this week or undated' },
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DONE = ['Done', 'Completed', 'Approved', 'Cancelled'];

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const dueLabelFor = (bucket: Bucket, dueDate: string, todayStr: string): { label: string; bg: string; fg: string } => {
  if (!dueDate) return { label: 'No date', bg: '#F0F2F5', fg: palette.slate };
  if (bucket === 'overdue') {
    const d = daysBetween(dueDate, todayStr);
    return { label: d <= 1 ? '1 day overdue' : `${d} days overdue`, bg: tint.red, fg: palette.red };
  }
  if (bucket === 'today') return { label: 'Due today', bg: tint.gold, fg: tintText.gold };
  if (bucket === 'week') {
    const d = daysBetween(todayStr, dueDate);
    if (d <= 1) return { label: 'Tomorrow', bg: tint.blue, fg: tintText.blue };
    const wd = WEEKDAY[new Date(dueDate).getDay()];
    return { label: `In ${d} days · ${wd}`, bg: tint.blue, fg: tintText.blue };
  }
  const dt = new Date(dueDate);
  return { label: `${WEEKDAY[dt.getDay()]} ${dt.getDate()} ${MONTH[dt.getMonth()]}`, bg: '#F0F2F5', fg: palette.slate };
};

const relativeShort = (bucket: Bucket, dueDate: string, todayStr: string): string => {
  if (bucket === 'today') return 'Today';
  if (bucket === 'overdue') return `${Math.max(1, daysBetween(dueDate, todayStr))}d overdue`;
  if (bucket === 'week') {
    const d = daysBetween(todayStr, dueDate);
    return d <= 1 ? 'Tomorrow' : `In ${d}d`;
  }
  return dueDate || 'Undated';
};

const rowBg = (bucket: Bucket) => (bucket === 'overdue' ? '#FFF8F6' : bucket === 'today' ? '#FFFCF7' : '#fff');

const PRIORITY_META: Record<string, { color: string }> = {
  High: { color: palette.red },
  Medium: { color: palette.gold },
  Low: { color: palette.slate },
};

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
    users,
    leaveApplications,
    currentUser,
    setCurrentView,
    setCurrentCaseId,
    updateCase,
    updateUserStaffProfile,
    showToast,
  } = useApp() as any;

  const [filter, setFilter] = useState<FilterValue>('all');
  const [list, setList] = useState<'matter' | 'private'>('matter');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTargets, setEditingTargets] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => blankTaskDraft(currentUser?.name || ''));
  const [quickTitle, setQuickTitle] = useState('');
  const [ghostDone, setGhostDone] = useState<Record<string, { row: RowWithBucket; priorStatus: Task['status'] }>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { confirm, ConfirmationModal } = useConfirmation();

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
    const caseByRef = new Map((cases || []).map((c: Case) => [c.ref, c]));

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
          priority: t.priority,
          checklist: t.checklist,
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

      // 5 — vouchers and invoices waiting on a signature / release.
      // Route to the partner(s) in charge of the matter when the voucher is tied to
      // one; only fall back to "any partner" when there's no matter/partner to route to.
      (paymentVouchers || []).forEach((v: any) => {
        if (v.approved || v.approvalStatus === 'Approved') return;
        if (v.approvalStatus !== 'Pending Approval' && v.approvalStatus !== 'Draft') return;
        const c: any = v.fileRef ? caseByRef.get(v.fileRef) : undefined;
        if (c?.partners?.length && !mine(c.partners as any)) return;
        out.push({
          id: `sign-pv-${v.id}`,
          stream: 'signature',
          title: `Payment voucher ${v.id} · RM ${Number(v.amount || 0).toLocaleString()}`,
          matterRef: v.fileRef,
          matterTitle: v.payee || v.description,
          caseId: c?.id,
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

  const rowsWithBucket: RowWithBucket[] = useMemo(
    () =>
      rows.map((r) => {
        let b: Bucket = 'later';
        if (!r.dueDate) b = 'later';
        else if (r.dueDate < todayStr) b = 'overdue';
        else if (r.dueDate === todayStr) b = 'today';
        else if (r.dueDate <= weekStr) b = 'week';
        return { ...r, bucket: b };
      }),
    [rows, todayStr, weekStr]
  );

  const grouped = useMemo(() => {
    const g: Record<Bucket, RowWithBucket[]> = { overdue: [], today: [], week: [], later: [] };
    rowsWithBucket.forEach((r) => g[r.bucket].push(r));
    (Object.keys(g) as Bucket[]).forEach((k) =>
      g[k].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    );
    return g;
  }, [rowsWithBucket]);

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

  const completeTask = (r: RowWithBucket) => {
    if (!r.task) return;
    setGhostDone((g) => ({ ...g, [r.id]: { row: r, priorStatus: r.status as Task['status'] } }));
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

  const undoTask = (r: DisplayRow) => {
    const ghost = ghostDone[r.id];
    if (!ghost || !r.task) return;
    setGhostDone((g) => {
      const n = { ...g };
      delete n[r.id];
      return n;
    });
    const c: Case | undefined = (cases || []).find((x: Case) => x.id === r.task!.caseId);
    if (!c) return;
    updateCase(c.id, {
      tasks: (c.tasks || []).map((t) =>
        t.id === r.task!.taskId ? { ...t, status: ghost.priorStatus, completedAt: undefined } : t
      ),
    });
  };

  const deleteTask = async (r: DisplayRow) => {
    if (!r.task) return;
    const confirmed = await confirm({
      title: 'Delete task',
      message: 'This removes the task permanently. This cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Task',
      details: [
        { label: 'Task', value: r.title },
        ...(r.matterRef ? [{ label: 'Matter', value: r.matterRef }] : []),
      ],
    });
    if (!confirmed) return;
    const c: Case | undefined = (cases || []).find((x: Case) => x.id === r.task!.caseId);
    if (!c) return;
    updateCase(c.id, { tasks: (c.tasks || []).filter((t) => t.id !== r.task!.taskId) });
    setGhostDone((g) => {
      if (!g[r.id]) return g;
      const n = { ...g };
      delete n[r.id];
      return n;
    });
  };

  const toggleRowSelected = (rowId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const deleteSelectedTasks = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = await confirm({
      title: `Delete ${count} task${count === 1 ? '' : 's'}`,
      message: 'This removes the selected tasks permanently. This cannot be undone.',
      variant: 'danger',
      confirmText: `Delete ${count} Task${count === 1 ? '' : 's'}`,
    });
    if (!confirmed) return;

    const taskIdsByCase = new Map<string, Set<string>>();
    const addToPlan = (row: RowWithBucket) => {
      if (!row.task || !selectedIds.has(row.id)) return;
      const set = taskIdsByCase.get(row.task.caseId) || new Set<string>();
      set.add(row.task.taskId);
      taskIdsByCase.set(row.task.caseId, set);
    };
    rowsWithBucket.forEach(addToPlan);
    const ghostEntriesForDelete: { row: RowWithBucket; priorStatus: Task['status'] }[] = Object.values(ghostDone);
    ghostEntriesForDelete.forEach((g) => addToPlan(g.row));

    taskIdsByCase.forEach((taskIds, caseId) => {
      const c: Case | undefined = (cases || []).find((x: Case) => x.id === caseId);
      if (!c) return;
      updateCase(c.id, { tasks: (c.tasks || []).filter((t) => !taskIds.has(t.id)) });
    });

    setGhostDone((g) => {
      const n = { ...g };
      selectedIds.forEach((id) => delete n[id]);
      return n;
    });
    exitSelectMode();
  };

  // ---- Task form modal wiring -------------------------------------------------
  const matterOptions = useMemo(
    () => myCases.map((c) => ({ ref: c.ref, full: `${c.ref} — ${c.title}`, caseId: c.id })),
    [myCases]
  );
  const assignees = useMemo(
    () =>
      (users || [])
        .filter((u: any) => u.role === 'Partner')
        .map((u: any) => ({ code: partnerCode(u) || u.name.slice(0, 2).toUpperCase(), name: u.name })),
    [users]
  );

  const openTaskBlank = (scope: 'matter' | 'private') => {
    setList(scope);
    setTaskDraft(blankTaskDraft(currentUser?.name || ''));
    setTaskFormOpen(true);
  };
  const openTaskFromQuick = () => {
    setTaskDraft({ ...blankTaskDraft(currentUser?.name || ''), title: quickTitle });
    setQuickTitle('');
    setTaskFormOpen(true);
  };

  const saveTaskDraft = (): boolean => {
    if (!taskDraft.title.trim() || list !== 'matter') return false;
    const caseId = taskDraft.caseId || myCases[0]?.id;
    if (!caseId) {
      showToast?.('No matters available to attach this task to.');
      return false;
    }
    const c = (cases || []).find((x: Case) => x.id === caseId);
    if (!c) return false;
    const task: Task = {
      id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: taskDraft.title.trim(),
      priority: taskDraft.priority,
      status: taskDraft.status,
      dueDate: taskDraft.dueDate,
      assignedTo: taskDraft.assignedTo || currentUser?.name || '',
      taskType: taskDraft.taskType,
      description: taskDraft.description.trim() || undefined,
      checklist: taskDraft.checklist.length ? taskDraft.checklist : undefined,
    };
    updateCase(c.id, { tasks: [...(c.tasks || []), task] });
    return true;
  };

  const createTask = () => {
    if (saveTaskDraft()) setTaskFormOpen(false);
  };
  const createTaskAndAnother = () => {
    if (saveTaskDraft()) setTaskDraft(blankTaskDraft(currentUser?.name || ''));
  };

  const onQuickKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const title = quickTitle.trim();
    if (!title || list !== 'matter') return;
    const c = myCases[0];
    if (!c) {
      showToast?.('No matters available to attach this task to.');
      return;
    }
    const task: Task = {
      id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      priority: 'Medium',
      status: 'Not Started',
      dueDate: todayStr,
      assignedTo: currentUser?.name || '',
      taskType: 'Standard',
    };
    updateCase(c.id, { tasks: [...(c.tasks || []), task] });
    setQuickTitle('');
  };

  // ---- Filtering + grouping for display ---------------------------------------
  const isBucketFilter = filter === 'all' || filter === 'overdue' || filter === 'today' || filter === 'week' || filter === 'later';

  const passesSearch = (r: Row) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || [r.title, r.matterRef, r.matterTitle, r.status].some((v) => v?.toLowerCase().includes(q));
  };
  const passesFilter = (r: RowWithBucket) => {
    if (filter === 'all') return true;
    if (filter === 'hearing') return r.stream === 'hearing';
    if (filter === 'waiting') return r.stream === 'approval' || r.stream === 'signature';
    if (filter === 'unbilled') return r.stream === 'unbilled';
    return r.bucket === filter;
  };

  const matterRowsWithBucket = list === 'matter' ? rowsWithBucket : [];
  const matchingRealRows = matterRowsWithBucket.filter((r) => passesFilter(r) && passesSearch(r));
  const ghostEntries: { row: RowWithBucket; priorStatus: Task['status'] }[] = Object.values(ghostDone);
  const ghostRowsList: DisplayRow[] = list === 'matter'
    ? ghostEntries.map((g) => ({ ...g.row, isGhost: true })).filter((r) => passesFilter(r) && passesSearch(r))
    : [];

  const groups: { key: string; bucket: Bucket; showHead: boolean; rows: DisplayRow[] }[] = isBucketFilter
    ? (filter === 'all' ? (['overdue', 'today', 'week', 'later'] as Bucket[]) : [filter as Bucket])
        .map((b) => ({
          key: b,
          bucket: b,
          showHead: true,
          rows: [...matchingRealRows, ...ghostRowsList]
            .filter((r) => r.bucket === b)
            .sort((a, c) => (a.dueDate || '9999').localeCompare(c.dueDate || '9999')),
        }))
        .filter((g) => g.rows.length > 0)
    : (() => {
        const flat = [...matchingRealRows, ...ghostRowsList].sort((a, c) => (a.dueDate || '9999').localeCompare(c.dueDate || '9999'));
        return flat.length ? [{ key: 'flat', bucket: 'later' as Bucket, showHead: false, rows: flat }] : [];
      })();

  const overdueCount = grouped.overdue.length;
  const todayCount = grouped.today.length;
  const weekCount = grouped.week.length;
  const laterCount = grouped.later.length;
  const waitingCount = rows.filter((row) => row.stream === 'approval' || row.stream === 'signature').length;
  const unbilledRows = rows.filter((row) => row.stream === 'unbilled');
  const hearingCount = rows.filter((row) => row.stream === 'hearing').length;
  const allCount = list === 'matter' ? rows.length : 0;

  const tabCounts: Record<'all' | Bucket, number> = list === 'matter'
    ? { all: allCount, overdue: overdueCount, today: todayCount, week: weekCount, later: laterCount }
    : { all: 0, overdue: 0, today: 0, week: 0, later: 0 };

  const streamFilterLabel: Partial<Record<FilterValue, string>> = {
    hearing: 'Court dates only',
    waiting: 'Waiting on you only',
    unbilled: 'Unbilled only',
  };

  const toggleFilter = (fv: FilterValue) => setFilter((f) => (f === fv ? 'all' : fv));

  const kpis: { label: string; value: React.ReactNode; note: string; desc: string; icon: React.ElementType; color: string; filter?: FilterValue; onClickView?: string }[] = [
    { label: 'My active matters', value: myCases.filter((c) => c.status === 'Active').length, note: 'assigned', desc: 'Assigned to your queue', icon: FolderOpen, color: palette.navy, onClickView: 'cases' },
    { label: 'Deadlines this week', value: overdueCount + todayCount + weekCount, note: `${overdueCount} overdue`, desc: 'Requires your attention this week', icon: Flag, color: palette.red, filter: 'overdue' },
    { label: 'My hearings', value: hearingCount, note: 'this week', desc: 'Requires your attention this week', icon: Gavel, color: palette.purple, filter: 'hearing' },
    { label: 'To-do open', value: rows.filter((r) => r.stream === 'task').length, note: 'tasks', desc: 'Requires your attention this week', icon: CheckCircle2, color: '#2E7D7A', filter: 'all' },
    { label: 'Waiting on you', value: waitingCount, note: 'approvals', desc: 'Requires your attention this week', icon: Inbox, color: palette.gold, filter: 'waiting' },
    { label: 'Unbilled time', value: unbilledRows.length, note: 'matters', desc: 'Billable write-ups awaiting billing', icon: Timer, color: palette.green, filter: 'unbilled' },
    { label: 'My billed (RM)', value: billing.billedThisMonth.toLocaleString(), note: '', desc: '', icon: DollarSign, color: palette.gold, onClickView: 'billingPipeline' },
    { label: 'My collected (RM)', value: billing.collectedThisMonth.toLocaleString(), note: '', desc: '', icon: DollarSign, color: palette.blue, onClickView: 'billingPipeline' },
    { label: 'Files I brought', value: filesBroughtIn, note: '', desc: '', icon: FolderOpen, color: palette.navy, onClickView: 'cases' },
  ];

  // Court & deadlines — hearing + deadline rows in overdue/today/week buckets, sorted by date.
  const agenda = useMemo(
    () =>
      rowsWithBucket
        .filter((r) => (r.stream === 'hearing' || r.stream === 'deadline') && r.bucket !== 'later')
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
    [rowsWithBucket]
  );

  const recent = myCases.filter((c) => c.lastAccessed).slice(0, 4);

  return (
    <div className="space-y-4 pb-8 text-[12px]">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const active = k.filter && k.filter !== 'all' ? filter === k.filter : k.filter === 'all' && filter === 'all';
          const ring = k.filter ? (filter === k.filter ? `0 0 0 3px ${tint.gold}` : 'none') : 'none';
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => {
                if (k.filter) toggleFilter(k.filter);
                else if (k.onClickView) setCurrentView(k.onClickView);
              }}
              className="flex min-h-[142px] flex-col gap-2 rounded-xl p-4 text-left text-white shadow-lg ring-1 ring-black/5"
              style={{ backgroundColor: k.color, boxShadow: ring !== 'none' ? `${ring}, 0 10px 15px -3px rgba(0,0,0,.1)` : undefined }}
            >
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-white/15"><k.icon className="h-4 w-4" /></span>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/85">{k.label}</span>
              </span>
              <span className="flex items-baseline gap-1.5 font-serif text-[30px] font-bold leading-none">
                {k.value} {k.note ? <small className="font-sans text-[10.5px] font-normal text-white/75">{k.note}</small> : null}
              </span>
              {k.desc && <span className="text-[10.5px] leading-relaxed text-white/80">{k.desc}</span>}
            </button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* My to-do */}
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white shadow-sm">
            <div className="flex items-center gap-2.5 bg-[#16223A] px-3.5 py-2.5 text-white">
              <Scale className="h-4 w-4 text-[#FBF2E9]" />
              <div>
                <strong className="block font-serif text-[14.5px]">My to-do</strong>
                <span className="text-[10.5px] text-white/75">Tasks, court dates, approvals &amp; sign-offs · two-way sync with Google Tasks</span>
              </div>
              <div className="ml-auto flex rounded-[7px] bg-white/10 p-0.5">
                {(['matter', 'private'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setList(l);
                      setSelectedIds(new Set());
                    }}
                    className="rounded-[5px] px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: list === l ? '#fff' : 'transparent', color: list === l ? palette.navy : 'rgba(255,255,255,.8)' }}
                  >
                    {l === 'matter' ? 'Matter' : 'Private'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className="rounded-md px-2.5 py-1.5 text-[11.5px] font-bold"
                style={{ backgroundColor: selectMode ? '#fff' : 'rgba(255,255,255,.1)', color: selectMode ? palette.navy : '#fff' }}
              >
                {selectMode ? 'Cancel' : 'Select'}
              </button>
              <button type="button" onClick={() => openTaskBlank(list)} className="flex items-center gap-1 rounded-md bg-[#3D6B9C] px-3 py-1.5 text-[11.5px] font-bold">
                <Plus className="h-3 w-3" />New task
              </button>
            </div>

            {selectMode && (
              <div className="flex items-center gap-2.5 border-b border-[#DDE3EB] bg-[#F6F8FA] px-3.5 py-2">
                <span className="text-[11px] font-semibold text-[#16223A]">{selectedIds.size} selected</span>
                <span className="text-[10.5px] text-[#5B6478]">Only tasks can be bulk-deleted — not court dates, deadlines, approvals or unbilled items.</span>
                <button
                  type="button"
                  onClick={deleteSelectedTasks}
                  disabled={selectedIds.size === 0}
                  className="ml-auto flex items-center gap-1.5 rounded-md bg-[#B23A2E] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />Delete selected
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 border-b border-[#DDE3EB] px-3.5 py-2">
              {([
                ['all', 'All'],
                ['overdue', 'Overdue'],
                ['today', 'Today'],
                ['week', 'This week'],
                ['later', 'Later'],
              ] as [Bucket | 'all', string][]).map(([fv, label]) => {
                const active = filter === fv;
                return (
                  <button
                    key={fv}
                    type="button"
                    onClick={() => setFilter(fv)}
                    className="flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: active ? palette.navy : '#F6F8FA', color: active ? '#fff' : palette.slate }}
                  >
                    {label}
                    <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ backgroundColor: active ? 'rgba(255,255,255,.2)' : '#E7EBF0', color: active ? '#fff' : palette.slate }}>
                      {tabCounts[fv as 'all' | Bucket]}
                    </span>
                  </button>
                );
              })}
              {!isBucketFilter && (
                <button type="button" onClick={() => setFilter('all')} className="flex items-center gap-1 rounded-[20px] border border-[#DDE3EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#16223A]">
                  {streamFilterLabel[filter]} ✕
                </button>
              )}
              <label className="relative ml-auto w-[190px]">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter to-do…"
                  className="w-full rounded-md border border-[#DDE3EB] bg-[#F6F8FA] py-1 pl-7 pr-2 text-[11px] text-[#16223A] outline-none"
                />
              </label>
            </div>

            {groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">Nothing here. You&apos;re all caught up.</p>
            ) : (
              groups.map((g) => {
                const meta = BUCKET_META[g.bucket];
                const HeadIcon = meta.icon;
                return (
                  <div key={g.key}>
                    {g.showHead && (
                      <div
                        className="flex items-center gap-2 border-b border-[#EEF1F5] py-1.5 pl-[11px] pr-3.5 text-[10px] font-bold uppercase tracking-[.1em]"
                        style={{ backgroundColor: meta.tint, borderLeft: `3px solid ${meta.accent}`, color: meta.text }}
                      >
                        <HeadIcon className="h-3 w-3" />
                        {meta.label}
                        <span className="rounded-full bg-white px-1.5 text-[10px]" style={{ color: meta.text }}>{g.rows.length}</span>
                        <span className="text-[10.5px] font-semibold normal-case tracking-normal text-[#5B6478]">{meta.note}</span>
                      </div>
                    )}
                    {g.rows.map((r) => {
                      const streamMeta = STREAM_META[r.stream];
                      const StreamIcon = streamMeta.icon;
                      const isCheckable = r.stream === 'task' && !!r.task;
                      const due = r.isGhost ? { label: 'Done', bg: tint.green, fg: palette.green } : dueLabelFor(r.bucket, r.dueDate, todayStr);
                      const actionLabel = r.isGhost ? 'Undo' : r.stream === 'approval' ? 'Approve' : r.stream === 'signature' ? 'Sign off' : r.stream === 'unbilled' ? 'Write up' : 'Open';
                      const checklistDone = r.checklist?.filter((c) => c.completed).length ?? 0;
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2.5 border-b border-[#F0F2F5] py-2 pl-[11px] pr-3.5"
                          style={{ borderLeft: `3px solid ${BUCKET_META[r.bucket].accent}`, backgroundColor: r.isGhost ? '#fff' : rowBg(r.bucket), opacity: r.isGhost ? 0.45 : 1 }}
                        >
                          {isCheckable && selectMode ? (
                            <button
                              type="button"
                              onClick={() => toggleRowSelected(r.id)}
                              title="Select task"
                              className="grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] text-white"
                              style={{ border: `1.5px solid ${selectedIds.has(r.id) ? palette.blue : '#CBD5E1'}`, backgroundColor: selectedIds.has(r.id) ? palette.blue : '#fff' }}
                            >
                              {selectedIds.has(r.id) ? '✓' : ''}
                            </button>
                          ) : isCheckable ? (
                            <button type="button" onClick={() => completeTask(r)} title="Mark complete" className="grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 bg-white">
                              <span />
                            </button>
                          ) : (
                            <span className="grid h-4 w-4 shrink-0 place-items-center"><StreamIcon className="h-3.5 w-3.5" style={{ color: streamMeta.color }} /></span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold leading-snug text-[#16223A]" style={{ textDecoration: r.isGhost ? 'line-through' : 'none' }}>{r.title}</p>
                            <p className="mt-0.5 flex gap-1.5 overflow-hidden text-[10.5px] text-[#5B6478]">
                              <span className="font-semibold" style={{ color: streamMeta.color }}>{streamMeta.label}</span>
                              {r.matterRef && <span className="shrink-0 font-mono font-semibold text-[#3D6B9C]">{r.matterRef}</span>}
                              {r.matterTitle && <span className="truncate">{r.matterTitle}</span>}
                            </p>
                          </div>
                          {r.checklist && r.checklist.length > 0 && (
                            <span className="shrink-0 rounded border border-[#DDE3EB] px-1.5 text-[10px] font-semibold text-[#5B6478]">☑ {checklistDone}/{r.checklist.length}</span>
                          )}
                          {r.priority && (
                            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold" style={{ color: PRIORITY_META[r.priority]?.color }}>
                              <Flag className="h-2.5 w-2.5" />{r.priority}
                            </span>
                          )}
                          <span className="flex w-[124px] shrink-0 justify-end">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: due.bg, color: due.fg }}>{due.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => (r.isGhost ? undoTask(r) : openMatter(r))}
                            className="w-[60px] shrink-0 text-right text-[10.5px] font-bold hover:underline"
                            style={{ color: palette.gold }}
                          >
                            {actionLabel}
                          </button>
                          {isCheckable && (
                            <button
                              type="button"
                              onClick={() => deleteTask(r)}
                              title="Delete task"
                              className="shrink-0 text-slate-300 hover:text-[#B23A2E]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            <div className="flex items-center gap-2.5 border-b border-[#F0F2F5] px-3.5 py-2">
              <Plus className="h-4 w-4 shrink-0 text-[#3D6B9C]" />
              <input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={onQuickKey}
                disabled={list === 'private'}
                placeholder={list === 'private' ? 'Private to-do isn’t wired up yet — use Google Tasks' : 'Add a task… press Enter to save (due today)'}
                className="flex-1 border-0 bg-transparent py-1 text-[12px] text-[#16223A] outline-none disabled:opacity-50"
              />
              <button type="button" onClick={openTaskFromQuick} className="shrink-0 rounded-md border border-[#DDE3EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3D6B9C]">
                More details
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[#F6F8FA] px-3.5 py-2.5 text-[10.5px] text-[#5B6478]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#2F6F4E]" />
              <span>{list === 'matter' ? `${rows.length} open matter items` : '0 open items'}</span>
              <button type="button" onClick={() => setCurrentView(list === 'matter' ? 'tasks' : 'activityLogs')} className="ml-auto font-bold text-[#8A6D3B]">
                {list === 'matter' ? 'All matter tasks ->' : 'Open in Google Tasks ->'}
              </button>
            </div>
          </div>

          {/* Recently accessed */}
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center gap-2 border-b border-[#DDE3EB] px-3.5 py-2.5">
              <Clock className="h-3.5 w-3.5 text-[#8A6D3B]" />
              <strong className="font-serif text-[14px] text-[#16223A]">Recently accessed</strong>
              <button type="button" onClick={() => setCurrentView('cases')} className="ml-auto text-[10.5px] font-bold text-[#8A6D3B]">My matters -&gt;</button>
            </div>
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">No recently accessed matters.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {recent.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCurrentCaseId(c.id);
                      setCurrentView('cases');
                    }}
                    className="border-t border-[#F0F2F5] px-3.5 py-2 text-left hover:bg-[#F6F8FA]"
                    style={{ borderTop: i < 2 ? 'none' : undefined }}
                  >
                    <p className="truncate text-[12px] font-semibold text-[#16223A]">{c.title}</p>
                    <p className="mt-0.5 text-[10.5px] text-[#5B6478]"><span className="font-mono font-semibold text-[#3D6B9C]">{c.ref}</span> · {c.practiceArea || c.type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {/* Court & deadlines */}
          <div className="overflow-hidden rounded-xl border border-[#DDE3EB] bg-white">
            <div className="flex items-center gap-2 border-b border-[#DDE3EB] px-3.5 py-2.5">
              <Gavel className="h-[15px] w-[15px] text-[#6B3D8C]" />
              <strong className="font-serif text-[14px] text-[#16223A]">Court &amp; deadlines</strong>
              <span className="text-[10.5px] text-[#5B6478]">next 7 days</span>
              <button type="button" onClick={() => setCurrentView('calendar')} className="ml-auto text-[10.5px] font-bold text-[#8A6D3B]">Calendar -&gt;</button>
            </div>
            {agenda.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">No court dates or deadlines in the next 7 days.</p>
            ) : (
              agenda.map((e, i) => {
                const isHearing = e.stream === 'hearing';
                const color = isHearing ? palette.purple : palette.red;
                const bg = isHearing ? tint.purple : tint.red;
                const dt = e.dueDate ? new Date(e.dueDate) : null;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openMatter(e)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left"
                    style={{ borderTop: i ? '1px solid #F0F2F5' : 'none' }}
                  >
                    <div className="w-9 shrink-0 rounded-md py-0.5 text-center" style={{ backgroundColor: bg }}>
                      <div className="text-[8.5px] font-bold uppercase" style={{ color }}>{dt ? MONTH[dt.getMonth()] : '--'}</div>
                      <div className="font-serif text-[15px] font-bold leading-tight" style={{ color }}>{dt ? dt.getDate() : '-'}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-[#16223A]">{e.title}</p>
                      <p className="truncate text-[10.5px] text-[#5B6478]">
                        <span className="font-semibold" style={{ color }}>{isHearing ? 'Hearing' : 'Deadline'}</span> · {relativeShort(e.bucket, e.dueDate, todayStr)} · {isHearing ? e.matterTitle : e.matterRef}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* My Performance */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-[#8A6D3B]" />
              <strong className="font-serif text-[14px] text-[#16223A]">My Performance</strong>
              <span className="text-[10.5px] text-[#5B6478]">{new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}</span>
              <button type="button" onClick={() => setEditingTargets((v) => !v)} className="ml-auto rounded-md border border-[#DDE3EB] px-2 py-0.5 text-[10.5px] font-bold text-[#3D6B9C]">
                {editingTargets ? 'Done' : '✎ Edit targets'}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {([
                ['Billed', billing.billedThisMonth, targets.billed, palette.gold, (v: number) => setTargets({ billed: v }), 'RM'],
                ['Collected', billing.collectedThisMonth, targets.collected, palette.green, (v: number) => setTargets({ collected: v }), 'RM'],
                ['New files brought', filesBroughtIn, targets.files, palette.blue, (v: number) => setTargets({ files: v }), ''],
                ['Referrals converted', myReferrals.converted, targets.referrals, palette.purple, (v: number) => setTargets({ referrals: v }), ''],
              ] as const).map(([label, value, target, color, onSet, prefix]) => (
                <ProgressBar
                  key={label}
                  label={label}
                  barHeight={6}
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
                        <strong className="font-semibold text-[#5B6478]">{target.toLocaleString()}</strong>
                      )}
                    </>
                  }
                />
              ))}
            </div>
            {(() => {
              const gaps = [
                { label: 'billing', gap: targets.billed - billing.billedThisMonth, prefix: 'RM ' },
                { label: 'collections', gap: targets.collected - billing.collectedThisMonth, prefix: 'RM ' },
                { label: 'new files', gap: targets.files - filesBroughtIn, prefix: '' },
                { label: 'referrals', gap: targets.referrals - myReferrals.converted, prefix: '' },
              ].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
              const biggest = gaps[0];
              if (!biggest) return null;
              return (
                <p className="mt-3 rounded-lg px-2.5 py-[7px] text-[10.5px] leading-snug" style={{ backgroundColor: tint.red, color: palette.red }}>
                  ⚠ {biggest.prefix}{biggest.gap.toLocaleString()} more {biggest.label === 'billing' || biggest.label === 'collections' ? `in ${biggest.label}` : biggest.label} needed this month to hit target — biggest gap is {biggest.label}.
                </p>
              );
            })()}
          </div>

          {/* Collection + aging */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-center gap-3">
              <Donut segments={[{ label: 'Collected', value: billing.collectionRate, color: palette.green }]} size={64} thickness={10} centerLabel={`${billing.collectionRate}%`} />
              <div>
                <p className="text-[12px] font-bold text-[#16223A]">My collection rate</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-[#5B6478]">RM {billing.totalCollected.toLocaleString()} collected of RM {billing.totalBilled.toLocaleString()} billed</p>
              </div>
            </div>
            <p className="mb-1.5 mt-3.5 text-[11.5px] font-bold text-[#16223A]">My aging receivables</p>
            <MiniBarChart
              height={56}
              showValue
              formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
              data={[
                { label: 'Current', value: billing.buckets.current, color: palette.blue },
                { label: '31-60', value: billing.buckets.d31, color: palette.blue },
                { label: '61-90', value: billing.buckets.d61, color: palette.blue },
                { label: '91-120', value: billing.buckets.d91, color: palette.blue },
                { label: '>120', value: billing.buckets.over120, color: palette.red },
              ]}
            />
          </div>

          {/* Productivity */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#16223A]"><Zap className="h-[13px] w-[13px] text-[#8A6D3B]" />Productivity</span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: tint.green, color: palette.green }}>
                {productivity.pct >= 100 ? 'On track today' : `${productivity.pct}% today`}
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              {productivity.days.map((d, i) => (
                <span
                  key={i}
                  className="flex-1 rounded py-1 text-center text-[9.5px] font-bold"
                  style={{ backgroundColor: d.state === 'done' ? palette.green : d.state === 'partial' ? palette.gold : '#F0F2F5', color: d.state === 'none' ? '#9AA3AE' : '#fff' }}
                >
                  {d.label}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10.5px] text-[#5B6478]">{productivity.doneToday} of {productivity.dueToday} tasks due today completed · {productivity.streak}-day streak</p>
          </div>

          {/* My referrals */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="whitespace-nowrap text-[12px] font-bold text-[#16223A]">🔗 My referrals</span>
              <span className="text-[10.5px] text-[#5B6478]"><strong className="text-[#16223A]">{myReferrals.broughtIn}</strong> in · <strong style={{ color: palette.green }}>{myReferrals.converted}</strong> converted ({myReferrals.rate}%)</span>
            </div>
            {myReferrals.bySource.length === 0 ? (
              <p className="mt-2.5 text-center text-[11px] text-slate-400">No leads attributed to you yet.</p>
            ) : (
              <div className="mt-1.5 flex flex-col">
                {myReferrals.bySource.map(([source, count], i) => (
                  <div key={source} className="flex justify-between py-1 text-[11px]" style={{ borderTop: i ? '1px solid #F0F2F5' : 'none' }}>
                    <span><span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full" style={{ backgroundColor: [palette.blue, palette.gold, palette.purple, palette.green, palette.red][i % 5] }} />{source}</span>
                    <span className="text-[#5B6478]">{count} lead{count === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <TaskFormModal
        open={taskFormOpen}
        scope={list}
        draft={taskDraft}
        setDraft={setTaskDraft}
        matterOptions={matterOptions}
        assignees={assignees}
        onClose={() => setTaskFormOpen(false)}
        onCreate={createTask}
        onCreateAnother={createTaskAndAnother}
      />
      {ConfirmationModal}
    </div>
  );
};

export default MyDashboardView;
