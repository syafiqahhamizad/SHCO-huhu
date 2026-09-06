import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  FileSignature,
  FolderOpen,
  Gavel,
  Plus,
  Receipt,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Case, Task } from '../../types';
import { identityTokens, isMine } from '../../lib/identity';

const TONE = {
  navy: '#16223A',
  slate: '#33415C',
  brass: '#A9814A',
  clay: '#8C4A32',
  forest: '#2F6F4E',
  cream: '#F7F4EE',
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
    leaveApplications,
    currentUser,
    setCurrentView,
    setCurrentCaseId,
    updateCase,
  } = useApp() as any;

  const [open, setOpen] = useState<Record<Bucket, boolean>>({
    overdue: true,
    today: true,
    week: true,
    later: false,
  });
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ title: '', caseId: '', dueDate: '', assignedTo: '' });

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

  return (
    <div className="space-y-5 pb-10">
      {/* Hero */}
      <div
        className="rounded-2xl px-6 py-5 text-white flex flex-wrap items-center justify-between gap-4"
        style={{ backgroundColor: TONE.navy }}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: TONE.brass }}>
            My Dashboard
          </p>
          <h1 className="font-serif text-2xl font-bold leading-tight">
            {currentUser?.name ? `Good day, ${String(currentUser.name).split(' ')[0]}` : 'Your work queue'}
          </h1>
          <p className="mt-1 text-[12.5px] text-slate-300">
            Everything waiting on you — court dates, deadlines, sign-offs and unbilled work.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center">
            <p className="text-xl font-extrabold" style={{ color: overdueCount ? '#E4A08A' : '#9FBFAB' }}>
              {overdueCount}
            </p>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300">Overdue</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center">
            <p className="text-xl font-extrabold text-white">{todayCount}</p>
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300">Today</p>
          </div>
          <button
            onClick={() => setComposing((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: TONE.brass }}
          >
            <Plus className="h-4 w-4" />
            <span>Add task</span>
          </button>
        </div>
      </div>

      {/* Task composer */}
      {composing && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
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

      {/* Buckets */}
      {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => {
        const meta = BUCKET_META[bucket];
        const list = grouped[bucket];
        return (
          <section key={bucket} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              onClick={() => setOpen((o) => ({ ...o, [bucket]: !o[bucket] }))}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
              style={{ borderLeft: `4px solid ${meta.accent}` }}
            >
              <div className="flex items-center gap-3">
                {open[bucket] ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <h2 className="font-serif text-[15px] font-bold" style={{ color: meta.accent }}>
                  {meta.label}
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white"
                  style={{ backgroundColor: meta.accent }}
                >
                  {list.length}
                </span>
              </div>
              <span className="text-[11.5px] font-medium text-slate-500">{meta.note}</span>
            </button>

            {open[bucket] && (
              <div className="border-t border-slate-100">
                {list.length === 0 ? (
                  <p className="flex items-center gap-2 px-6 py-5 text-[12.5px] text-slate-400">
                    <CheckCircle2 className="h-4 w-4" style={{ color: TONE.forest }} />
                    Nothing here.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {list.map((r) => {
                      const sm = STREAM_META[r.stream];
                      const Icon = sm.icon;
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                        >
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{ backgroundColor: `${sm.color}1A`, color: sm.color }}
                            title={sm.label}
                          >
                            <Icon className="h-4 w-4" />
                          </span>

                          <div className="min-w-[220px] flex-1">
                            <p className="text-[13.5px] font-bold leading-snug" style={{ color: TONE.navy }}>
                              {r.title}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
                              <span className="font-semibold uppercase tracking-wide" style={{ color: sm.color }}>
                                {sm.label}
                              </span>
                              {r.matterRef && <span className="font-mono font-bold">{r.matterRef}</span>}
                              {r.matterTitle && <span className="truncate">{r.matterTitle}</span>}
                            </p>
                          </div>

                          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                            {r.dueDate ? (
                              <>
                                <CalendarClock className="h-3.5 w-3.5" />
                                {r.dueDate}
                              </>
                            ) : (
                              <>
                                <Timer className="h-3.5 w-3.5" />
                                Undated
                              </>
                            )}
                          </span>

                          <span
                            className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                            style={{ borderColor: `${sm.color}55`, color: sm.color, backgroundColor: `${sm.color}0F` }}
                          >
                            {r.status}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {r.task && (
                              <button
                                onClick={() => completeTask(r)}
                                title="Mark complete"
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition-colors hover:border-emerald-300 hover:text-emerald-600"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openMatter(r)}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors hover:bg-slate-100"
                              style={{ color: TONE.brass }}
                            >
                              <span>Open</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}

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
