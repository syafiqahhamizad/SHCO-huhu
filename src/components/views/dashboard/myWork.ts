import { useMemo } from 'react';
import type { Case, Task, TaskChecklistItem } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { identityTokens, isMine } from '../../../lib/identity';
import { localIso, toLocalIso } from '../../../lib/localDate';

/**
 * "My work" rows for My Dashboard (design: My Work 3a). Every row comes from a real record:
 * case tasks and file deadlines assigned to me, hearings and sign-offs on my files, statutory
 * deadlines, approvals waiting on a partner, my unbilled time, files with no next step, and my
 * own private to-dos (kept on my private staff profile). Used by the My work tab and by the
 * dashboard's quick-tab status dot.
 */

export type Bucket = 'overdue' | 'today' | 'week' | 'later';
export type Stream = 'hearing' | 'deadline' | 'task' | 'approval' | 'signature' | 'unbilled' | 'matter' | 'private';

export interface WorkRow {
  id: string;
  stream: Stream;
  title: string;
  matterRef?: string;
  matterTitle?: string;
  caseId?: string;
  dueDate: string;
  status: string;
  view: string;
  /** Case task (or file deadline) — checkable, opens the task form. */
  task?: { caseId: string; taskId: string; rec: Task };
  /** Private to-do — checkable, opens the task form. */
  priv?: Task;
  done: boolean;
  priority?: Task['priority'];
  checklist?: TaskChecklistItem[];
  bucket: Bucket;
}

const DONE = ['Done', 'Completed', 'Approved', 'Cancelled'];
export const isTaskDone = (t: Pick<Task, 'status'>) => t.status === 'Completed' || t.status === 'Done';

/** Ticked off today (so it stays on the list, struck through, until tomorrow). */
const doneToday = (t: Task, todayStr: string) => isTaskDone(t) && (t.doneOn === todayStr || (!!t.completedAt && toLocalIso(t.completedAt) === todayStr));

export const addDaysIso = (base: string, n: number) => {
  const [y, m, d] = base.split('-').map(Number);
  return localIso(new Date(y, m - 1, d + n));
};

export const bucketOf = (due: string, todayStr: string, weekStr: string): Bucket =>
  !due ? 'later' : due < todayStr ? 'overdue' : due === todayStr ? 'today' : due <= weekStr ? 'week' : 'later';

export function useMyWorkRows() {
  const { cases, deadlines, timeEntries, expenses, paymentVouchers, travelClaims, invoices, currentUser, currentRole } = useApp() as any;
  const todayStr = localIso(new Date());
  const weekStr = addDaysIso(todayStr, 7);
  const me = useMemo(() => identityTokens(currentUser), [currentUser]);
  const isPartner = currentRole === 'Partner' || Boolean(currentUser?.isAdmin) || Boolean(currentUser?.isSuperAdmin);
  const privateTodos: Task[] = currentUser?.staffProfile?.privateTodos || [];

  const rows: WorkRow[] = useMemo(() => {
    const mine = (v?: unknown) => isMine(v, me);
    const out: Omit<WorkRow, 'bucket'>[] = [];
    const caseById = new Map((cases || []).map((c: Case) => [c.id, c]));
    const caseByRef = new Map((cases || []).map((c: Case) => [c.ref, c]));

    (cases || []).forEach((c: Case) => {
      (c.tasks || []).forEach((t: Task) => {
        if (!mine(t.assignedTo)) return;
        const done = isTaskDone(t);
        if (DONE.includes(t.status) && !doneToday(t, todayStr)) return;
        const dl = !!t.kind && t.kind !== 'Task';
        out.push({
          id: `task-${c.id}-${t.id}`,
          stream: dl ? 'deadline' : 'task',
          title: t.title,
          matterRef: c.ref,
          matterTitle: c.title,
          caseId: c.id,
          dueDate: t.dueDate || '',
          status: t.status,
          view: 'cases',
          task: { caseId: c.id, taskId: t.id, rec: t },
          done,
          priority: t.priority,
          checklist: t.checklist,
        });
      });

      const onMyMatter = mine(c.lawyerInCharge) || mine(c.lawyers as any) || mine(c.partners as any);
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
          done: false,
        });
      });

      // Matter documents routed to me for signature.
      (c.documents || []).forEach((d: any) => {
        if (!d.signatureStatus || d.signatureStatus === 'Signed' || d.signatureStatus === 'Not Required') return;
        if (d.signatureBy && !mine(d.signatureBy)) return;
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
          done: false,
        });
      });

      // Open matters with no scheduled next step.
      if (c.status === 'Active' && !(c.tasks || []).some((t) => !isTaskDone(t)) && !(c.hearings || []).some((h) => h.status === 'Scheduled')) {
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
          done: false,
        });
      }
    });

    // Statutory deadlines where I am partner or lawyer of record.
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
        done: false,
      });
    });

    // Approvals and sign-offs (partners / admins only).
    if (isPartner) {
      const pending = (s?: string) => s === 'Pending Approval' || s === 'Pending PIC Approval';
      (timeEntries || []).forEach((t: any) => {
        if (!pending(t.approvalStatus)) return;
        const c: any = caseById.get(t.caseId);
        out.push({ id: `appr-time-${t.id}`, stream: 'approval', title: `Time entry · ${t.hours}h by ${t.feeEarner}`, matterRef: c?.ref, matterTitle: t.description, caseId: t.caseId, dueDate: t.date || '', status: 'Pending approval', view: 'cases', done: false });
      });
      (expenses || []).forEach((e: any) => {
        if (!pending(e.approvalStatus)) return;
        out.push({ id: `appr-exp-${e.id}`, stream: 'approval', title: `Expense · RM ${Number(e.amount || 0).toLocaleString()} ${e.category || ''}`.trim(), matterRef: e.fileRef || (caseById.get(e.caseId) as any)?.ref, matterTitle: e.description, caseId: e.caseId, dueDate: e.date || '', status: 'Pending approval', view: 'approvals', done: false });
      });
      (travelClaims || []).forEach((t: any) => {
        if (!pending(t.approvalStatus)) return;
        out.push({ id: `appr-travel-${t.id}`, stream: 'approval', title: `Travel claim · RM ${Number(t.total || 0).toLocaleString()} (${t.claimant})`, matterRef: t.fileRef, matterTitle: t.purpose, dueDate: t.date || '', status: 'Pending approval', view: 'approvals', done: false });
      });
      // Vouchers go to the partner(s) in charge of the file when there is one, else any partner.
      (paymentVouchers || []).forEach((v: any) => {
        if (v.approved || v.approvalStatus === 'Approved') return;
        if (v.approvalStatus !== 'Pending Approval' && v.approvalStatus !== 'Draft') return;
        const c: any = v.fileRef ? caseByRef.get(v.fileRef) : undefined;
        if (c?.partners?.length && !mine(c.partners as any)) return;
        out.push({ id: `sign-pv-${v.id}`, stream: 'signature', title: `Payment voucher ${v.id} · RM ${Number(v.amount || 0).toLocaleString()}`, matterRef: v.fileRef, matterTitle: v.payee || v.description, caseId: c?.id, dueDate: v.date || '', status: 'Needs sign-off', view: 'approvals', done: false });
      });
      (invoices || []).forEach((i: any) => {
        if (i.status !== 'Pending Review') return;
        const c: any = caseById.get(i.caseId);
        out.push({ id: `sign-inv-${i.id}`, stream: 'signature', title: `Invoice ${i.id} · RM ${Number(i.total || 0).toLocaleString()}`, matterRef: i.fileRef || c?.ref, matterTitle: i.partyName || c?.clientName, caseId: i.caseId, dueDate: i.dueDate || i.date || '', status: 'Pending review', view: 'time', done: false });
      });
    }

    // My unbilled write-ups, one row per matter.
    const unbilled = new Map<string, { hours: number; amount: number }>();
    (timeEntries || []).forEach((t: any) => {
      if (!t.billable || t.billed || t.approvalStatus === 'Rejected' || !mine(t.feeEarner)) return;
      const agg = unbilled.get(t.caseId) || { hours: 0, amount: 0 };
      agg.hours += Number(t.hours || 0);
      agg.amount += Number(t.hours || 0) * Number(t.rate || 0);
      unbilled.set(t.caseId, agg);
    });
    unbilled.forEach((agg, caseId) => {
      const c: any = caseById.get(caseId);
      out.push({ id: `unbilled-${caseId}`, stream: 'unbilled', title: `${agg.hours.toFixed(1)}h unbilled · RM ${agg.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, matterRef: c?.ref || caseId, matterTitle: c?.title, caseId, dueDate: '', status: 'Write up', view: 'time', done: false });
    });

    // My private to-dos.
    privateTodos.forEach((t) => {
      if (isTaskDone(t) && !doneToday(t, todayStr)) return;
      out.push({ id: `priv-${t.id}`, stream: 'private', title: t.title, matterTitle: 'Yours only', dueDate: t.dueDate || '', status: t.status, view: '', priv: t, done: isTaskDone(t), priority: t.priority, checklist: t.checklist });
    });

    return out.map((r) => ({ ...r, bucket: bucketOf(r.dueDate, todayStr, weekStr) }));
  }, [cases, deadlines, timeEntries, expenses, paymentVouchers, travelClaims, invoices, privateTodos, me, isPartner, todayStr, weekStr]);

  return { rows, todayStr, weekStr, me, isPartner };
}
