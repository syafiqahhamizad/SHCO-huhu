import React, { useMemo, useRef, useState } from 'react';
import { useQuickCreate } from '../../../lib/quickCreate';
import { FolderX } from 'lucide-react';
import { can, isSuper } from '../settings/permissionModel';
import {
  Calendar,
  CalendarX,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Clock,
  DollarSign,
  FileSignature,
  Flag,
  FolderOpen,
  Gavel,
  Inbox,
  Plus,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  Target,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { Case, Meeting, PrivateTodo, Task } from '../../../types';
import { isMine, partnerCode } from '../../../lib/identity';
import { Donut, MiniBarChart, ProgressBar, TaskFormModal, blankTaskDraft } from '../../ui';
import type { TaskDraft } from '../../ui';
import { palette, serifFont, tint } from '../../../lib/designTokens';
import { parseLocal, toLocalMonth } from '../../../lib/localDate';
import { caseFinder, isIssued, owedBalance, paidByInvoice } from '../../../lib/financeMetrics';
import { canSeeClientBilling, finGrants, canSeeFinanceView, finRoleKey, isFinanceView } from '../../../lib/financeAccess';
import { driveViewUrl } from '../../../services/googleDriveService';
import { deleteGoogleTask, upsertGoogleTask } from '../../../services/googleTasksService';
import { googleErrorMessage, hasValidGoogleToken } from '../../../services/googleWorkspaceAuth';
import { deriveMatchKey, staffOf } from '../cases/caseModel';
import { histEntry } from '../cases/wf';
import { syncTask, unsyncTask, type TaskSyncCtx } from '../cases/clientComms';
import { addDaysIso, isTaskDone, type Bucket, type Stream, type WorkRow } from './myWork';

type FilterValue = 'all' | Bucket | 'hearing' | 'unbilled';

const STREAM_META: Record<Stream, { label: string; icon?: React.ElementType; color: string }> = {
  hearing: { label: 'Court date', icon: Gavel, color: palette.red },
  deadline: { label: 'Statutory deadline', icon: Flag, color: palette.red },
  task: { label: 'Task', color: palette.navy },
  approval: { label: 'Awaiting your approval', icon: ShieldCheck, color: palette.blue },
  signature: { label: 'Awaiting your sign-off', icon: FileSignature, color: palette.blue },
  unbilled: { label: 'Unbilled work', icon: Receipt, color: palette.green },
  matter: { label: 'Open matter', icon: FolderOpen, color: palette.navy },
  private: { label: 'Private', color: '#2E7D7A' },
};

/** Group heads (design GM): bar colour, tint, text colour, icon, note. */
const GROUP_META: Record<Bucket, { label: string; color: string; tint: string; fg: string; icon: React.ElementType; note: string }> = {
  overdue: { label: 'Overdue', color: '#B23A2E', tint: '#FBEDE9', fg: '#B23A2E', icon: CircleAlert, note: 'Past due, clear these first' },
  today: { label: 'Today', color: '#8A6D3B', tint: '#FBF2E9', fg: '#8A6534', icon: Clock, note: 'Due before close of business' },
  week: { label: 'This week', color: '#3D6B9C', tint: '#E7EEF6', fg: '#2F5680', icon: Calendar, note: 'Next seven days' },
  later: { label: 'Later', color: '#5B6478', tint: '#F0F2F5', fg: '#5B6478', icon: Calendar, note: 'Beyond this week or undated' },
};

/** Row urgency (design U): bar / text, pill background, row background, icon. */
const URGENCY: Record<Bucket, [string, string, string, React.ElementType]> = {
  overdue: ['#B23A2E', '#FBEDE9', '#FFF8F6', CircleAlert],
  today: ['#8A6534', '#FBF2E9', '#FFFCF7', Clock],
  week: ['#2F5680', '#E7EEF6', '#fff', Calendar],
  later: ['#5B6478', '#F0F2F5', '#fff', Calendar],
};

const PRIORITY_COLOR: Record<string, string> = { High: '#B23A2E', Medium: '#8A6D3B', Low: '#5B6478' };
const BUCKETS: Bucket[] = ['overdue', 'today', 'week', 'later'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const daysBetween = (a: string, b: string) => Math.round((parseLocal(b) - parseLocal(a)) / 86400000);
/** "Wed 7 Oct" */
const fmtDay = (d: string) => {
  const dt = new Date(parseLocal(d));
  return `${WEEKDAY[dt.getDay()]} ${dt.getDate()} ${MONTH[dt.getMonth()]}`;
};

const urgencyLabel = (r: WorkRow, todayStr: string) => {
  if (r.done) return 'Done';
  if (!r.dueDate) return 'No date';
  if (r.bucket === 'overdue') {
    const d = daysBetween(r.dueDate, todayStr);
    return d === 1 ? '1 day overdue' : `${d} days overdue`;
  }
  if (r.bucket === 'today') return 'Due today';
  const inDays = daysBetween(todayStr, r.dueDate);
  if (inDays === 1) return 'Tomorrow';
  if (r.bucket === 'week') return `In ${inDays} days · ${fmtDay(r.dueDate).split(' ')[0]}`;
  return fmtDay(r.dueDate);
};

/** Short file reference, e.g. SHCO/SH/ZA/CIV/009/06-2026 → CIV/009. */
const shortRef = (ref?: string) => (ref || '').split('/').slice(3, 5).join('/') || ref || '';

const MEETING_TYPE: Record<Meeting['type'], [string, string]> = {
  Internal: ['#E7EEF6', '#2F5680'],
  Network: ['#F7E9EE', '#8C2F4C'],
  Client: ['#E6EFE9', '#2F6F4E'],
  Team: ['#F1EBF6', '#6B3D8C'],
  Growth: ['#E6EFE9', '#2F6F4E'],
  Compliance: ['#FBF2E9', '#8A6534'],
};
const MEETING_TYPES = Object.keys(MEETING_TYPE) as Meeting['type'][];

/** Free hour-long slots in office hours (9:00–5:00, lunch at 1:00 left out) on one day. */
const OFFICE_SLOTS = [9, 10, 11, 12, 14, 15, 16];
const freeSlots = (day: string, list: Meeting[]) => {
  const busy = list.filter((m) => m.date === day && m.time).map((m) => {
    const [h, mm] = m.time.split(':').map(Number);
    const start = h * 60 + (mm || 0);
    return [start, start + (m.durationMinutes || 60)] as const;
  });
  return OFFICE_SLOTS.filter((h) => busy.every(([s, e]) => e <= h * 60 || s >= h * 60 + 60));
};
const hourLabel = (h: number) => `${h > 12 ? h - 12 : h}:00`;

type DecisionItem = {
  id: string;
  title: string;
  sub: React.ReactNode;
  icon: React.ElementType;
  tint: string;
  color: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  /** Approvals / sign-offs decided on their own page: one "Open" button, nothing to mark here. */
  link?: boolean;
};

type TaskFormState = { draft: TaskDraft; scope: 'matter' | 'private'; editing?: { kind: 'case'; caseId: string; task: Task } | { kind: 'private'; task: Task } };

interface Props {
  rows: WorkRow[];
  todayStr: string;
  weekStr: string;
  me: Set<string>;
  isPartner: boolean;
}

/** My Dashboard → "My work" (design: My Work 3a). */
export const MyWorkTab: React.FC<Props> = ({ rows, todayStr, weekStr, me, isPartner }) => {
  const {
    cases,
    invoices,
    payments,
    leads,
    users,
    leaveApplications,
    updateLeaveApplication,
    addNotification,
    updateQuotation,
    quotations,
    meetings,
    addMeeting,
    currentUser,
    currentRole,
    isAdmin,
    setCurrentView,
    setCurrentCaseId,
    setCaseSubTab,
    updateCase,
    updateUserStaffProfile,
    savePrivateTodos,
    showToast,
    canViewModule,
    rolesMatrix,
  } = useApp() as any;
  const mine = (v?: unknown) => isMine(v, me);

  const [filter, setFilter] = useState<FilterValue>('all');
  const [list, setList] = useState<'matter' | 'private'>('matter');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTargets, setEditingTargets] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [meetingTab, setMeetingTab] = useState<'today' | 'week'>('today');
  const [meetingFormOpen, setMeetingFormOpen] = useState(false);
  const [meetingDraft, setMeetingDraft] = useState({ title: '', date: '', time: '', location: '', note: '', type: 'Internal' as Meeting['type'] });
  /** Decisions made on this visit stay on the panel, greyed out, with what was decided. */
  const [decided, setDecided] = useState<Record<string, { item: DecisionItem; yes: boolean }>>({});

  const myName: string = currentUser?.name || '';
  const meId: string = currentUser?.id || '';
  const staff = useMemo(() => staffOf(users || []), [users]);
  const meCode = staff.find((p) => p.name === myName)?.code || '';
  const toast = (m: string) => setTimeout(() => showToast?.(m), 0);

  // Latest records for saves that happen after an await (Google calls).
  const casesRef = useRef<Case[]>(cases || []);
  casesRef.current = cases || [];
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  // Files I handle (lawyer, team or partner in charge).
  const myOwnCases: Case[] = useMemo(
    () => (cases || []).filter((c: Case) => mine(c.lawyerInCharge) || mine(c.lawyers as any) || mine(c.partners as any)),
    [cases, me]
  );
  // Files a new matter to-do can go on: my own files; partners may pick any file.
  const pickableCases: Case[] = isPartner ? cases || [] : myOwnCases;

  /* ---------------------------------------------------------------- saving tasks */

  const syncCtx = (c: Case): TaskSyncCtx => ({
    c,
    me: myName,
    meCode,
    meId,
    toast,
    saveWith: (fn) => {
      const now = casesRef.current.find((x) => x.id === c.id) || c;
      updateCase(c.id, fn(now));
    },
  });

  // Private to-dos live in their own owner-only store (nobody else can read them).
  const savePrivate = (fn: (list: Task[]) => Task[]) => {
    const email = String(userRef.current?.email || '').toLowerCase();
    if (!email) return;
    savePrivateTodos((prev: PrivateTodo[]) => {
      const others = prev.filter((t) => t.ownerEmail !== email);
      const mine = prev.filter((t) => t.ownerEmail === email);
      return [...others, ...fn(mine).map((t) => ({ ...t, ownerEmail: email }))];
    });
  };

  const syncPrivate = async (t: Task) => {
    if (!t.syncToGoogle && !t.googleTaskIds?.[meId]) return;
    try {
      const r = await upsertGoogleTask({ googleTaskId: t.googleTaskIds?.[meId], title: t.title, notes: t.description, due: t.dueDate || undefined, completed: isTaskDone(t) });
      savePrivate((l) => l.map((x) => (x.id === t.id ? { ...x, googleTaskIds: { ...(x.googleTaskIds || {}), [meId]: r.googleTaskId } } : x)));
    } catch (e) {
      toast('Saved here, but Google Tasks did not update: ' + googleErrorMessage(e));
    }
  };

  const newTaskId = () => `T-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const toggleRow = (r: WorkRow) => {
    const now = new Date().toISOString();
    const patchOf = (t: Task): Task =>
      isTaskDone(t)
        ? { ...t, status: 'Not Started', completedAt: undefined, doneOn: undefined, lastUpdatedBy: myName, lastUpdatedAt: now }
        : { ...t, status: 'Completed', completedAt: now, doneOn: todayStr, lastUpdatedBy: myName, lastUpdatedAt: now };
    if (r.priv) {
      const upd = patchOf(r.priv);
      savePrivate((l) => l.map((x) => (x.id === upd.id ? upd : x)));
      void syncPrivate(upd);
      return;
    }
    if (!r.task) return;
    const c: Case | undefined = casesRef.current.find((x) => x.id === r.task!.caseId);
    const t = c?.tasks?.find((x) => x.id === r.task!.taskId);
    if (!c || !t) return;
    const upd = patchOf(t);
    updateCase(c.id, {
      tasks: (c.tasks || []).map((x) => (x.id === t.id ? upd : x)),
      activityLogs: [histEntry((isTaskDone(upd) ? 'Task done: ' : 'Task reopened: ') + t.title, myName, 'Milestone Completion'), ...(c.activityLogs || [])],
    });
    if (upd.syncToGoogle || upd.googleTaskIds?.[meId]) void syncTask(syncCtx(c), upd);
  };

  const openTaskForm = (scope: 'matter' | 'private', preset?: Partial<TaskDraft>) => {
    const defaultCase = [...myOwnCases].sort((a, b) => String(b.lastAccessed || '').localeCompare(String(a.lastAccessed || '')))[0];
    setTaskForm({ scope, draft: { ...blankTaskDraft(myName), caseId: scope === 'matter' ? defaultCase?.id || '' : '', kind: 'Task', syncGoogle: true, ...preset } });
  };
  useQuickCreate(['task'], () => openTaskForm('matter'));

  const draftOf = (t: Task, caseId: string): TaskDraft => ({
    title: t.title,
    caseId,
    assignedTo: staff.find((p) => p.code === t.assignedTo)?.name || t.assignedTo,
    dueDate: t.dueDate || '',
    priority: t.priority,
    status: (isTaskDone(t) ? 'Completed' : t.status === 'In Progress' || t.status === 'In Review' ? t.status : t.status === 'Under Review' ? 'In Review' : 'Not Started') as TaskDraft['status'],
    taskType: t.taskType || 'Standard',
    description: t.description || '',
    checklist: t.checklist || [],
    syncGoogle: !!t.syncToGoogle,
    kind: t.kind || 'Task',
  });

  const openRowTask = (r: WorkRow) => {
    if (r.priv) setTaskForm({ scope: 'private', draft: draftOf(r.priv, ''), editing: { kind: 'private', task: r.priv } });
    else if (r.task) setTaskForm({ scope: 'matter', draft: draftOf(r.task.rec, r.task.caseId), editing: { kind: 'case', caseId: r.task.caseId, task: r.task.rec } });
  };

  const saveTaskForm = (again: boolean) => {
    if (!taskForm) return;
    const { draft: d, scope, editing } = taskForm;
    if (!d.title.trim()) return;
    const kind = scope === 'matter' ? d.kind || 'Task' : 'Task';
    if (kind !== 'Task' && !d.dueDate) { toast('A deadline needs a due date'); return; }
    const now = new Date().toISOString();
    const base = {
      title: d.title.trim(),
      priority: d.priority,
      status: d.status,
      dueDate: d.dueDate,
      assignedTo: scope === 'private' ? myName : d.assignedTo || myName,
      taskType: d.taskType,
      description: d.description.trim() || undefined,
      checklist: d.checklist.length ? d.checklist : undefined,
      kind,
      remindDaysBefore: kind !== 'Task' ? (kind === 'Limitation' ? 30 : 3) : undefined,
      matchKey: kind !== 'Task' ? deriveMatchKey(d.title) : undefined,
      syncToGoogle: d.syncGoogle,
      lastUpdatedBy: myName,
      lastUpdatedAt: now,
      completedAt: d.status === 'Completed' ? now : undefined,
      doneOn: d.status === 'Completed' ? todayStr : undefined,
    };
    const again_ = () => setTaskForm(again ? { scope, draft: { ...blankTaskDraft(myName), caseId: scope === 'matter' ? d.caseId : '', kind: 'Task', syncGoogle: false } } : null);

    if (scope === 'private') {
      if (editing?.kind === 'private') {
        const upd: Task = { ...editing.task, ...base, doneOn: d.status === 'Completed' ? editing.task.doneOn || todayStr : undefined, completedAt: d.status === 'Completed' ? editing.task.completedAt || now : undefined };
        savePrivate((l) => l.map((x) => (x.id === upd.id ? upd : x)));
        setTaskForm(null);
        void syncPrivate(upd);
        toast('Task updated' + (upd.syncToGoogle ? ' · synced to Google Tasks' : ''));
        return;
      }
      const t: Task = { id: newTaskId(), ...base, createdBy: myName, createdAt: now };
      savePrivate((l) => [...l, t]);
      again_();
      void syncPrivate(t);
      toast('Task added' + (t.syncToGoogle ? ' · synced to Google Tasks' : ''));
      return;
    }

    const caseId = editing?.kind === 'case' ? editing.caseId : d.caseId;
    const c: Case | undefined = casesRef.current.find((x) => x.id === caseId);
    if (!c) { toast('Pick the matter this task belongs to.'); return; }
    const firstName = base.assignedTo.split(' ')[0];
    if (editing?.kind === 'case') {
      const t = editing.task;
      const upd: Task = { ...t, ...base, doneOn: d.status === 'Completed' ? t.doneOn || todayStr : undefined, completedAt: d.status === 'Completed' ? t.completedAt || now : undefined };
      updateCase(c.id, { tasks: (c.tasks || []).map((x) => (x.id === t.id ? upd : x)), activityLogs: [histEntry('Task updated: ' + upd.title, myName, 'Milestone Completion'), ...(c.activityLogs || [])] });
      setTaskForm(null);
      if (upd.syncToGoogle || t.googleTaskIds?.[meId]) void syncTask(syncCtx(c), upd);
      toast('Task updated · shows in ' + firstName + "'s My Work and the file");
      return;
    }
    const task: Task = { id: newTaskId(), ...base, createdBy: myName, createdAt: now };
    updateCase(c.id, { tasks: [...(c.tasks || []), task], activityLogs: [histEntry((kind === 'Task' ? 'Task added: ' : 'Deadline added: ') + task.title, myName, 'Milestone Completion'), ...(c.activityLogs || [])] });
    again_();
    if (task.syncToGoogle) void syncTask(syncCtx(c), task);
    if (task.assignedTo && task.assignedTo !== myName) {
      addNotification({ title: (kind === 'Task' ? 'New task: ' : 'New deadline: ') + task.title, message: myName + ' gave you ' + (kind === 'Task' ? 'a task' : 'a deadline') + ' on ' + c.ref + ' (' + c.title + ')' + (task.dueDate ? ', due ' + task.dueDate : '') + '.', type: 'system', linkTab: 'tasks', linkId: c.id, to: [task.assignedTo] });
    }
    toast((kind === 'Task' ? 'Task' : 'Deadline') + ' added · shows in ' + firstName + "'s My Work and the file");
  };

  const deleteFormTask = () => {
    const e = taskForm?.editing;
    if (!e || !window.confirm('Delete this task?')) return;
    if (e.kind === 'private') {
      savePrivate((l) => l.filter((x) => x.id !== e.task.id));
      const gid = e.task.googleTaskIds?.[meId];
      if (gid) void deleteGoogleTask(gid).catch((err) => toast('Deleted here, but not from Google Tasks: ' + googleErrorMessage(err)));
    } else {
      const c = casesRef.current.find((x) => x.id === e.caseId);
      if (c) updateCase(c.id, { tasks: (c.tasks || []).filter((x) => x.id !== e.task.id), activityLogs: [histEntry('Task deleted: ' + e.task.title, myName), ...(c.activityLogs || [])] });
      void unsyncTask({ meId, toast }, e.task);
    }
    setTaskForm(null);
    toast('Task deleted');
  };

  const quickAdd = () => {
    const title = quickTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    // Only sync straight away when Google Tasks is already signed in (no pop-up on Enter).
    const sync = hasValidGoogleToken('tasks');
    const t: Task = { id: newTaskId(), title, priority: 'Medium', status: 'Not Started', dueDate: todayStr, assignedTo: myName, taskType: 'Standard', kind: 'Task', syncToGoogle: sync, createdBy: myName, createdAt: now };
    if (list === 'private') {
      savePrivate((l) => [...l, t]);
      if (sync) void syncPrivate(t);
    } else {
      const c = [...myOwnCases].sort((a, b) => String(b.lastAccessed || '').localeCompare(String(a.lastAccessed || '')))[0];
      if (!c) { toast('No matters available to attach this task to. Use “More details” to pick one.'); return; }
      updateCase(c.id, { tasks: [...(c.tasks || []), t], activityLogs: [histEntry('Task added: ' + title, myName, 'Milestone Completion'), ...(c.activityLogs || [])] });
      if (sync) void syncTask(syncCtx(c), t);
    }
    setQuickTitle('');
    toast('Task added' + (sync ? ' · synced to Google Tasks' : ''));
  };

  /* ---------------------------------------------------------------- navigation */

  const finRk = finRoleKey(currentRole, currentUser, isAdmin);
  // Billed / collected / receivables come from invoices and payments: partners, Accounts and
  // reviewers only (lawyers and assistants get no billing records, so the tiles are hidden).
  const seeBilling = canSeeClientBilling(finRk, finGrants(currentUser));
  const canOpen = (view: string) => !isFinanceView(view) || canSeeFinanceView(view, finRk);
  const CASE_TAB: Partial<Record<Stream, string>> = { task: 'tasks', deadline: 'tasks', hearing: 'court', signature: 'letters', matter: 'overview', unbilled: 'time', approval: 'time' };
  // Roles without Cases (e.g. Accounts) must not be sent to a page that only says Access Restricted.
  const canCases = canViewModule('cases');
  const openCase = (caseId: string, sub = 'overview') => {
    if (!canCases) { showToast('Cases is not open to your role.'); return; }
    setCaseSubTab(sub);
    setCurrentCaseId(caseId);
    setCurrentView('cases');
  };
  const openMatter = (r: WorkRow) => {
    if (r.caseId && (r.view === 'cases' || !canOpen(r.view) || !canViewModule(r.view))) { openCase(r.caseId, CASE_TAB[r.stream] || 'overview'); return; }
    if (!r.view || !canOpen(r.view) || !canViewModule(r.view)) return;
    setCurrentCaseId(null);
    setCurrentView(r.view);
  };

  /* ---------------------------------------------------------------- lists & counts */

  const open = (l: WorkRow[]) => l.filter((r) => !r.done);
  // Approvals and sign-offs are decisions, not tasks: they show under "Needs your decision".
  const isDecisionRow = (r: WorkRow) => r.stream === 'approval' || r.stream === 'signature';
  const matterRows = rows.filter((r) => r.stream !== 'private' && !isDecisionRow(r));
  const approvalRows = open(rows).filter(isDecisionRow);
  const privRows = rows.filter((r) => r.stream === 'private');
  const cnt = (l: WorkRow[], b: Bucket) => open(l).filter((r) => r.bucket === b).length;
  const hearingsWeek = open(matterRows).filter((r) => r.stream === 'hearing' && r.bucket !== 'later').length;
  const doneTodayCount = rows.filter((r) => r.done).length;

  const streamF: Partial<Record<FilterValue, (r: WorkRow) => boolean>> = {
    hearing: (r) => r.stream === 'hearing',
    unbilled: (r) => r.stream === 'unbilled',
  };
  const isStream = !!streamF[filter];
  const src = list === 'matter' ? matterRows : privRows;
  const q = searchQuery.trim().toLowerCase();
  let shown = src.filter((r) => !q || [r.title, r.matterRef, r.matterTitle].some((v) => (v || '').toLowerCase().includes(q)));
  if (isStream) shown = shown.filter(streamF[filter]!);
  const groupKeys: Bucket[] = filter === 'all' || isStream ? BUCKETS : [filter as Bucket];
  const groups = groupKeys
    .map((b) => ({ b, rows: shown.filter((r) => r.bucket === b).sort((x, y) => (x.dueDate || '9999').localeCompare(y.dueDate || '9999')) }))
    .filter((g) => g.rows.length);

  /* ---------------------------------------------------------------- money & performance */

  const monthStr = todayStr.slice(0, 7);
  const billing = useMemo(() => {
    const findCase = caseFinder(cases || []);
    const myCaseIds = new Set(myOwnCases.map((c) => c.id));
    const myInvoices = (invoices || []).filter((i: any) => isIssued(i) && myCaseIds.has(findCase(i.caseId, i.fileRef)?.id || ''));
    const myInvoiceIds = new Set(myInvoices.map((i: any) => i.id));
    const paidMap = paidByInvoice(payments || []);
    const paidFor = (invId: string) => paidMap.get(invId) || 0;
    const billedThisMonth = myInvoices.filter((i: any) => toLocalMonth(i.date) === monthStr).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const collectedThisMonth = (payments || []).filter((p: any) => myInvoiceIds.has(p.invoiceId) && toLocalMonth(p.date) === monthStr).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const buckets = { current: 0, d31: 0, d61: 0, d91: 0, over120: 0 };
    myInvoices.forEach((i: any) => {
      const balance = owedBalance(i, paidFor(i.id));
      if (balance <= 0.005) return;
      const due = i.dueDate || i.date;
      const days = due ? Math.max(0, daysBetween(due, todayStr)) : 0;
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
  }, [myOwnCases, cases, invoices, payments, monthStr, todayStr]);

  const myReferrals = useMemo(() => {
    const myLeads = (leads || []).filter((l: any) => mine(l.assignedTo));
    const converted = myLeads.filter((l: any) => l.stage === 'Converted');
    const bySource = new Map<string, number>();
    myLeads.forEach((l: any) => bySource.set(l.referralSourceCategory || 'Other', (bySource.get(l.referralSourceCategory || 'Other') || 0) + 1));
    return { broughtIn: myLeads.length, converted: converted.length, rate: myLeads.length ? Math.round((converted.length / myLeads.length) * 100) : 0, bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]) };
  }, [leads, me]);

  const filesBroughtIn = useMemo(() => myOwnCases.filter((c) => c.referredBy && mine(c.lawyerInCharge)).length, [myOwnCases, me]);

  // No invented targets: zero until the person sets their own with "Edit targets".
  const targets = currentUser?.staffProfile?.targets || { billed: 0, collected: 0, files: 0, referrals: 0 };
  const setTargets = (patch: Partial<typeof targets>) => {
    if (!currentUser?.id) return;
    updateUserStaffProfile(currentUser.id, { ...(currentUser.staffProfile || {}), targets: { ...targets, ...patch } } as any);
  };

  // Today's completion + this week's streak, from my own case tasks.
  const productivity = useMemo(() => {
    const myTasks: Task[] = [];
    (cases || []).forEach((c: Case) => (c.tasks || []).forEach((t) => { if (mine(t.assignedTo)) myTasks.push(t); }));
    const dueToday = myTasks.filter((t) => t.dueDate === todayStr);
    const doneToday = dueToday.filter(isTaskDone);
    const pct = dueToday.length ? Math.round((doneToday.length / dueToday.length) * 100) : 100;
    const weekday = (new Date(parseLocal(todayStr)).getDay() + 6) % 7; // Monday = 0
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
      const dStr = addDaysIso(todayStr, i - weekday);
      const due = myTasks.filter((t) => t.dueDate === dStr);
      const done = due.filter(isTaskDone);
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
  }, [cases, me, todayStr]);

  /* ---------------------------------------------------------------- decisions */

  const decisions: DecisionItem[] = useMemo(() => {
    const nowIso = new Date().toISOString();
    const out: DecisionItem[] = approvalRows.map((r) => ({
      id: 'dec-' + r.id,
      title: r.title,
      sub: [r.matterRef, r.matterTitle, r.status].filter(Boolean).join(' · '),
      icon: r.stream === 'signature' ? FileSignature : ShieldCheck,
      tint: '#E7EEF6',
      color: '#3D6B9C',
      yes: r.stream === 'signature' ? 'Open to sign off' : 'Open to approve',
      no: '',
      link: true,
      onYes: () => openMatter(r),
      onNo: () => undefined,
    }));
    // Requests to close a file, for whoever may approve it (Settings › Permissions; partners: their own files).
    const myCode = partnerCode(currentUser) || '';
    const mayClose = (c: Case) => isSuper(currentUser) || (can(rolesMatrix || ({} as never), currentUser, 'cases.approveClose') && (currentRole !== 'Partner' || (c.partners || []).includes(myCode as never)));
    (cases || []).filter((c: Case) => c.closeRequest?.status === 'Pending' && mayClose(c)).forEach((c: Case) => out.push({
      id: 'dec-close-' + c.id, title: 'Close file: ' + c.ref, sub: [c.title, c.closeRequest?.outcome, 'asked by ' + c.closeRequest?.requestedBy].filter(Boolean).join(' · '),
      icon: FolderX, tint: '#F0F2F5', color: '#16223A', yes: 'Open to decide', no: '', link: true, onYes: () => openCase(c.id, 'overview'), onNo: () => undefined,
    }));
    if (!isPartner) return out;
    (leaveApplications || []).forEach((l: any) => {
      if (l.status !== 'Pending') return;
      const applicant = (users || []).find((u: any) => u.id === l.userId)?.name || l.userId || 'Staff';
      const range = l.startDate + (l.endDate && l.endDate !== l.startDate ? ' – ' + l.endDate : '');
      const docUrl = l.attachment ? driveViewUrl(l.attachment) : undefined;
      out.push({
        id: `dec-leave-${l.id}`,
        title: `Leave: ${applicant}`,
        sub: (
          <>
            {range} · {l.days} day(s) · {l.reason || l.leaveType}
            {l.attachmentName && !l.attachment ? ` · ${l.attachmentName} (name only)` : ''}
            {docUrl && <> · <a href={docUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#2F4F7A] underline">{l.attachment?.name || 'Supporting document'}</a></>}
          </>
        ),
        icon: CalendarX,
        tint: '#F1EBF6',
        color: '#6B3D8C',
        yes: 'Approve',
        no: 'Reject',
        onYes: () => {
          updateLeaveApplication(l.id, { status: 'Approved', reviewedBy: currentUser?.name, reviewedAt: nowIso });
          addNotification({ title: 'Leave approved', message: (currentUser?.name || 'Your partner') + ' approved your leave ' + range + '.', type: 'system', linkTab: 'staffPortal', to: [l.userId || '', applicant] });
        },
        onNo: () => {
          updateLeaveApplication(l.id, { status: 'Rejected', reviewedBy: currentUser?.name, reviewedAt: nowIso });
          addNotification({ title: 'Leave not approved', message: (currentUser?.name || 'Your partner') + ' did not approve your leave ' + range + '. Speak to them for details.', type: 'system', linkTab: 'staffPortal', to: [l.userId || '', applicant] });
        },
      });
    });
    // A quotation is decided by the partner in charge of its file only (and only with billing
    // access). One not linked to a file yet (e.g. for a new client) goes to the Super Admin.
    const superAdmin = String(currentUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com' || !!currentUser?.isSuperAdmin;
    (quotations || []).forEach((qq: any) => {
      if (qq.approvalStatus !== 'Pending' || !seeBilling) return;
      const file = (cases || []).find((c: Case) => (qq.caseId && (c.id === qq.caseId || c.ref === qq.caseId)) || (qq.fileRef && c.ref === qq.fileRef));
      if (file ? !mine(file.partners) : !superAdmin) return;
      out.push({
        id: `dec-quote-${qq.id}`,
        title: `Fee quote · RM ${Number(qq.total || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        sub: `${qq.clientName || 'Client'}${qq.practiceArea ? ` · ${qq.practiceArea}` : ''}`,
        icon: Scale,
        tint: '#E7EEF6',
        color: '#3D6B9C',
        yes: 'Approve',
        no: 'Discuss',
        onYes: () => updateQuotation(qq.id, { approvalStatus: 'Approved', approvedBy: currentUser?.name || '', approvedDate: todayStr }),
        onNo: () => setCurrentView('quotations'),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPartner, leaveApplications, quotations, users, currentUser, todayStr, cases, seeBilling, me, rows]);

  const decide = (d: DecisionItem, yes: boolean) => {
    if (d.link) { d.onYes(); return; }
    setDecided((m) => ({ ...m, [d.id]: { item: d, yes } }));
    (yes ? d.onYes : d.onNo)();
  };
  const decisionList = [...decisions.filter((d) => !decided[d.id]), ...Object.values(decided).map((x: { item: DecisionItem }) => x.item)];
  const pendingDecisions = decisions.filter((d) => !decided[d.id]).length;

  /* ---------------------------------------------------------------- meetings & agenda */

  // Meetings I booked or am invited to (meetings with no attendee list are firm-wide).
  const myMeetings: Meeting[] = useMemo(
    () => (meetings || []).filter((m: Meeting) => mine(m.createdBy) || !m.attendees?.length || (m.attendees || []).some((a) => mine(a))),
    [meetings, me]
  );
  const meetingsInRange = useMemo(() => {
    const l = myMeetings.filter((m) => (meetingTab === 'today' ? m.date === todayStr : m.date >= todayStr && m.date <= weekStr));
    return l.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [myMeetings, meetingTab, todayStr, weekStr]);
  const openSlots = useMemo(() => {
    if (meetingTab === 'today') {
      const nowH = new Date().getHours();
      const s = freeSlots(todayStr, myMeetings).filter((h) => h > nowH);
      return s.length ? s.map(hourLabel).join(', ') : 'none left today';
    }
    let n = 0;
    for (let i = 0; i <= 7; i++) {
      const d = addDaysIso(todayStr, i);
      const wd = new Date(parseLocal(d)).getDay();
      if (wd === 0 || wd === 6) continue;
      n += freeSlots(d, myMeetings).length;
    }
    return `${n} slot${n === 1 ? '' : 's'} this week`;
  }, [meetingTab, myMeetings, todayStr]);

  const openMeetingForm = () => {
    setMeetingDraft({ title: '', date: todayStr, time: '', location: '', note: '', type: 'Internal' });
    setMeetingFormOpen(true);
  };
  const saveMeeting = () => {
    if (!meetingDraft.title.trim() || !meetingDraft.date || !meetingDraft.time) { showToast('Add a title, date and time for the meeting.'); return; }
    addMeeting({ id: `MTG-${Date.now()}`, title: meetingDraft.title.trim(), date: meetingDraft.date, time: meetingDraft.time, location: meetingDraft.location.trim() || undefined, note: meetingDraft.note.trim() || undefined, type: meetingDraft.type, createdBy: currentUser?.name });
    setMeetingFormOpen(false);
  };

  const agenda = open(matterRows)
    .filter((r) => (r.stream === 'hearing' || r.stream === 'deadline') && r.bucket !== 'later')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const recent = [...myOwnCases].filter((c) => c.lastAccessed).sort((a, b) => String(b.lastAccessed).localeCompare(String(a.lastAccessed))).slice(0, 4);

  /* ---------------------------------------------------------------- KPI tiles */

  const kpis: { label: string; value: React.ReactNode; note: string; desc: string; icon: React.ElementType; color: string; filter?: FilterValue; view?: string; scrollTo?: string }[] = [
    { label: 'My active matters', value: myOwnCases.filter((c) => c.status === 'Active').length, note: 'assigned', desc: 'Assigned to your queue', icon: FolderOpen, color: '#16223A', view: 'cases' },
    { label: 'Deadlines this week', value: cnt(matterRows, 'overdue') + cnt(matterRows, 'today') + cnt(matterRows, 'week'), note: `${cnt(matterRows, 'overdue')} overdue`, desc: 'Requires your attention this week', icon: Flag, color: '#B23A2E', filter: 'overdue' },
    { label: 'My hearings', value: hearingsWeek, note: 'this week', desc: 'Requires your attention this week', icon: Gavel, color: '#6B3D8C', filter: 'hearing' },
    { label: 'To-do open', value: open(matterRows).filter((r) => r.stream === 'task').length, note: 'tasks', desc: 'Requires your attention this week', icon: CheckCircle2, color: '#2E7D7A', filter: 'all' },
    { label: 'Waiting on you', value: pendingDecisions, note: 'decisions', desc: 'Approvals, sign-offs and leave', icon: Inbox, color: '#8A6D3B', scrollTo: 'my-decisions' },
    { label: 'Unbilled time', value: open(matterRows).filter((r) => r.stream === 'unbilled').length, note: 'matters', desc: 'Billable write-ups awaiting billing', icon: Timer, color: '#2F6F4E', filter: 'unbilled' },
    ...(seeBilling ? [
      { label: 'My billed (RM)', value: billing.billedThisMonth.toLocaleString(), note: '', desc: '', icon: DollarSign, color: '#8A6D3B' },
      { label: 'My collected (RM)', value: billing.collectedThisMonth.toLocaleString(), note: '', desc: '', icon: DollarSign, color: '#3D6B9C' },
    ] : []),
    { label: 'Files I brought', value: filesBroughtIn, note: '', desc: '', icon: FolderOpen, color: '#16223A' },
  ];

  const serif = { fontFamily: serifFont };
  const card = 'overflow-hidden rounded-xl border border-[#DDE3EB] bg-white';

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const ringOn = k.filter && k.filter !== 'all' && filter === k.filter;
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => {
                if (k.scrollTo) document.getElementById(k.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else if (k.filter) { setFilter((f) => (f === k.filter ? 'all' : k.filter!)); setList('matter'); }
                else if (k.view && canViewModule(k.view)) { setCurrentCaseId(null); setCurrentView(k.view); }
              }}
              className="flex min-h-[142px] flex-col gap-2 rounded-xl p-4 text-left text-white hover:brightness-110"
              style={{ backgroundColor: k.color, boxShadow: `0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1),0 0 0 ${ringOn ? '3px #FBF2E9' : '1px rgba(0,0,0,.05)'}` }}
            >
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/15"><k.icon className="h-4 w-4" /></span>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.12em]">{k.label}</span>
              </span>
              <span className="flex items-baseline gap-1.5 text-[30px] font-bold leading-none" style={serif}>
                {k.value} {k.note ? <small className="font-sans text-[10.5px] font-normal">{k.note}</small> : null}
              </span>
              {k.desc && <span className="text-[10.5px] leading-relaxed">{k.desc}</span>}
            </button>
          );
        })}
      </section>

      {decisionList.length > 0 && (
        <div id="my-decisions" className={card}>
          <div className="flex flex-wrap items-center gap-2 bg-[#16223A] px-3.5 py-2" style={{ backgroundColor: '#16223A' }}>
            <Gavel className="h-3.5 w-3.5 text-white" />
            <strong className="text-[12.5px] text-white">Needs your decision</strong>
            <span className="rounded-[10px] bg-[#B23A2E] px-2 text-[10.5px] font-bold text-white">{pendingDecisions}</span>
            <span className="ml-auto text-[10.5px] text-white/75">Leave and quotes: decide here · claims, vouchers and bills: “Open” takes you to them</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {decisionList.map((d, i) => {
              const done = decided[d.id];
              return (
                <div key={d.id} className="flex flex-col gap-1.5 px-3 py-2.5" style={{ borderLeft: i ? '1px solid #EEF1F5' : undefined, opacity: done ? 0.55 : 1 }}>
                  <span className="flex items-center gap-[7px]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: d.tint }}><d.icon className="h-[13px] w-[13px]" style={{ color: d.color }} /></span>
                    <span className="text-[11.5px] font-bold leading-tight text-[#16223A]">{d.title}</span>
                  </span>
                  <span className="flex-1 text-[10.5px] leading-snug text-[#5B6478]">{d.sub}</span>
                  {done ? (
                    <span className="text-[10.5px] font-bold" style={{ color: done.yes ? '#2F6F4E' : '#5B6478' }}>{done.yes ? `✓ ${d.yes}d` : `${d.no} · sent back`}</span>
                  ) : (
                    <div className="flex gap-[5px]">
                      <button type="button" onClick={() => decide(d, true)} className="flex-1 rounded-md bg-[#2F6F4E] px-1.5 py-[5px] text-[10.5px] font-bold text-white">{d.yes}</button>
                      {d.no && <button type="button" onClick={() => decide(d, false)} className="flex-1 rounded-md border border-[#DDE3EB] bg-white px-1.5 py-[5px] text-[10.5px] font-bold text-[#16223A]">{d.no}</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* My to-do */}
          <div className={`${card} shadow-[0_1px_3px_rgba(0,0,0,.06)]`}>
            <div className="flex flex-wrap items-center gap-2.5 bg-[#16223A] px-3.5 py-2.5 text-white" style={{ backgroundColor: '#16223A' }}>
              <Scale className="h-4 w-4 text-[#FBF2E9]" />
              <div>
                <strong className="block text-[14.5px]" style={serif}>My to-do</strong>
                <span className="text-[10.5px] text-white/75">Tasks and court dates · approvals are under “Needs your decision” · syncs with Google Tasks</span>
              </div>
              <div className="ml-auto flex rounded-[7px] bg-white/10 p-0.5">
                {(['matter', 'private'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setList(l)} className={`rounded-[5px] px-2.5 py-[5px] text-[11px] font-bold ${list === l ? 'shco-nav-ink bg-white text-[#16223A]' : ''}`} style={{ backgroundColor: list === l ? '#fff' : 'transparent', color: list === l ? '#16223A' : 'rgba(255,255,255,.8)' }}>
                    {l === 'matter' ? 'Matter' : 'Private'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => openTaskForm(list)} className="flex items-center gap-1 rounded-md bg-[#3D6B9C] px-3 py-[7px] text-[11.5px] font-bold">
                <Plus className="h-3 w-3" />New task
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-[#DDE3EB] px-3.5 py-2">
              {([['all', 'All'], ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['later', 'Later']] as [Bucket | 'all', string][]).map(([fv, label]) => {
                const on = filter === fv || (fv === 'all' && isStream);
                const count = fv === 'all' ? open(src).length : cnt(src, fv);
                return (
                  <button key={fv} type="button" onClick={() => setFilter(fv)} className="flex items-center gap-1.5 rounded-[20px] px-[11px] py-[5px] text-[11px] font-bold" style={{ backgroundColor: on ? '#16223A' : '#F6F8FA', color: on ? '#fff' : '#5B6478' }}>
                    {label}
                    <span className="rounded-[10px] px-1.5 text-[10px] font-bold" style={{ backgroundColor: on ? 'rgba(255,255,255,.18)' : '#E7EBF0', color: on ? '#fff' : '#5B6478' }}>{count}</span>
                  </button>
                );
              })}
              {isStream && (
                <button type="button" onClick={() => setFilter('all')} className="flex items-center gap-1 rounded-[20px] border border-[#DDE3EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#16223A]">
                  {{ hearing: 'Court dates only', unbilled: 'Unbilled only' }[filter as 'hearing']} ✕
                </button>
              )}
              <label className="relative ml-auto w-[190px]">
                <Search className="absolute left-[9px] top-[7px] h-[13px] w-[13px] text-[#94A3B8]" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter to-do…" className="w-full rounded-md border border-[#DDE3EB] bg-[#F6F8FA] py-[5px] pl-7 pr-2 text-[11px] text-[#16223A] outline-none" />
              </label>
            </div>

            {groups.map((g) => {
              const meta = GROUP_META[g.b];
              return (
                <div key={g.b}>
                  {groupKeys.length > 1 && (
                    <div className="flex items-center gap-2 border-b border-[#EEF1F5] py-[7px] pl-[11px] pr-3.5 text-[10px] font-bold uppercase tracking-[.1em]" style={{ backgroundColor: meta.tint, borderLeft: `3px solid ${meta.color}`, color: meta.fg }}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                      <span className="rounded-[10px] bg-white px-[7px] text-[10px] tracking-normal">{open(g.rows).length}</span>
                      <span className="text-[10.5px] font-semibold normal-case tracking-[.02em] text-[#5B6478]">{meta.note}</span>
                    </div>
                  )}
                  {g.rows.map((r) => {
                    const sm = STREAM_META[r.stream];
                    const checkable = !!r.task || !!r.priv;
                    const [uFg, uBg, uRow, UIcon] = URGENCY[r.bucket];
                    const pillFg = r.done ? '#2F6F4E' : uFg;
                    const PillIcon = r.done ? CircleCheck : UIcon;
                    const chk = r.checklist?.length ? `${r.checklist.filter((c) => c.completed).length}/${r.checklist.length}` : '';
                    const actLabel = checkable ? 'Open' : r.stream === 'approval' ? 'Approve' : r.stream === 'signature' ? 'Sign off' : r.stream === 'unbilled' ? 'Write up' : 'Open';
                    return (
                      <div key={r.id} className="flex items-center gap-2.5 border-b border-[#F0F2F5] py-2 pl-[11px] pr-3.5" style={{ borderLeft: `3px solid ${r.done ? '#DDE3EB' : uFg}`, backgroundColor: r.done ? '#fff' : uRow, opacity: r.done ? 0.45 : 1 }}>
                        {checkable ? (
                          <button type="button" onClick={() => toggleRow(r)} title={r.done ? 'Mark not done' : 'Mark complete'} className="grid h-4 w-4 shrink-0 place-items-center rounded p-0 text-[11px] leading-none text-white" style={{ border: `1.5px solid ${r.done ? '#2F6F4E' : '#CBD5E1'}`, backgroundColor: r.done ? '#2F6F4E' : '#fff' }}>
                            {r.done ? '✓' : ''}
                          </button>
                        ) : (
                          <span className="grid h-4 w-4 shrink-0 place-items-center">{sm.icon && <sm.icon className="h-3.5 w-3.5" style={{ color: sm.color }} />}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold leading-[1.35] text-[#16223A]" style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.title}</p>
                          <p className="mt-px flex gap-1.5 overflow-hidden whitespace-nowrap text-[10.5px] text-[#5B6478]">
                            <span className="font-semibold" style={{ color: sm.color }}>{sm.label}</span>
                            {r.matterRef && <span className="font-mono font-semibold text-[#3D6B9C]">{r.matterRef}</span>}
                            {r.matterTitle && <span className="truncate">{r.matterTitle}</span>}
                          </p>
                        </div>
                        {chk && <span className="shrink-0 rounded border border-[#DDE3EB] px-[5px] py-px text-[10px] font-semibold text-[#5B6478]">☑ {chk}</span>}
                        {r.priority && (
                          <span className="flex shrink-0 items-center gap-[3px] text-[10px] font-bold" style={{ color: PRIORITY_COLOR[r.priority] || '#5B6478' }}>
                            <Flag className="h-[11px] w-[11px]" />{r.priority}
                          </span>
                        )}
                        <span className="flex w-[124px] shrink-0 justify-end">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[20px] px-[9px] py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: r.done ? '#E6EFE9' : uBg, color: pillFg }}>
                            <PillIcon className="h-[11px] w-[11px]" />{urgencyLabel(r, todayStr)}
                          </span>
                        </span>
                        <button type="button" onClick={() => (checkable ? openRowTask(r) : openMatter(r))} className="w-[60px] shrink-0 text-right text-[10.5px] font-bold text-[#8A6D3B] hover:underline">
                          {actLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {groups.length === 0 && <p className="m-0 px-4 py-6 text-center text-[11px] text-[#94A3B8]">Nothing here. You&apos;re all caught up.</p>}

            <div className="flex items-center gap-2.5 border-b border-[#F0F2F5] px-3.5 py-2">
              <Plus className="h-4 w-4 shrink-0 text-[#3D6B9C]" />
              <input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
                placeholder="Add a task… press Enter to save (due today)"
                className="flex-1 border-0 bg-transparent py-1 text-[12px] text-[#16223A] outline-none"
              />
              <button type="button" onClick={() => { openTaskForm(list, { title: quickTitle }); setQuickTitle(''); }} className="shrink-0 rounded-md border border-[#DDE3EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3D6B9C]">
                More details
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[#F6F8FA] px-3.5 py-[9px] text-[10.5px] text-[#5B6478]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#2F6F4E]" />
              <span>{open(matterRows).length} open matter items · {open(privRows).length} private · {doneTodayCount} completed today</span>
              {(list !== 'matter' || canCases) && (
                <button type="button" onClick={() => (list === 'matter' ? setCurrentView('tasks') : window.open('https://tasks.google.com/', '_blank', 'noopener'))} className="ml-auto font-bold text-[#8A6D3B]">
                  {list === 'matter' ? 'All matter tasks ->' : 'Open in Google Tasks ->'}
                </button>
              )}
            </div>
          </div>

          {/* Recently accessed */}
          <div className={card}>
            <div className="flex items-center gap-2 border-b border-[#DDE3EB] px-3.5 py-2.5">
              <Clock className="h-3.5 w-3.5 text-[#8A6D3B]" />
              <strong className="text-[14px] text-[#16223A]" style={serif}>Recently accessed</strong>
              {canCases && <button type="button" onClick={() => { setCurrentCaseId(null); setCurrentView('cases'); }} className="ml-auto text-[10.5px] font-bold text-[#8A6D3B]">My matters -&gt;</button>}
            </div>
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#94A3B8]">No recently accessed matters.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {recent.map((c, i) => (
                  <button key={c.id} type="button" onClick={() => openCase(c.id)} className="px-3.5 py-2 text-left hover:bg-[#F6F8FA]" style={{ borderTop: i > 1 ? '1px solid #F0F2F5' : undefined, borderRight: i % 2 === 0 ? '1px solid #F0F2F5' : undefined }}>
                    <p className="truncate text-[12px] font-semibold text-[#16223A]">{c.title}</p>
                    <p className="mt-px text-[10.5px] text-[#5B6478]"><span className="font-mono font-semibold text-[#3D6B9C]">{c.ref}</span> · {c.practiceArea || c.type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {/* Your meetings */}
          <div className={`${card} flex flex-col`}>
            <div className="flex items-center gap-2 border-b border-[#EEF1F5] px-3.5 py-2">
              <Calendar className="h-3.5 w-3.5 text-[#16223A]" />
              <strong className="text-[12.5px] text-[#16223A]">Your meetings</strong>
              <div className="ml-1.5 flex rounded-md bg-[#F0F2F5] p-0.5">
                {(['today', 'week'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setMeetingTab(t)} className="whitespace-nowrap rounded px-[9px] py-[3px] text-[10.5px] font-bold" style={{ backgroundColor: meetingTab === t ? '#fff' : 'transparent', color: meetingTab === t ? '#16223A' : '#5B6478' }}>
                    {t === 'today' ? 'Today' : 'This week'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={openMeetingForm} className="ml-auto whitespace-nowrap rounded-md bg-[#16223A] px-[9px] py-[5px] text-[10.5px] font-bold text-white">+ Book slot</button>
            </div>
            {meetingsInRange.length === 0 ? (
              <p className="px-4 py-5 text-center text-[11px] text-[#94A3B8]">No meetings {meetingTab === 'today' ? 'today' : 'this week'}.</p>
            ) : (
              meetingsInRange.map((m, i) => {
                const [tbg, color] = MEETING_TYPE[m.type] || MEETING_TYPE.Internal;
                const when = meetingTab === 'today' ? m.time : `${WEEKDAY[new Date(parseLocal(m.date)).getDay()]} ${m.time}`;
                return (
                  <div key={m.id} className="grid items-center gap-2.5 px-3.5 py-[7px]" style={{ gridTemplateColumns: '62px minmax(0,1fr) auto', borderTop: i ? '1px solid #F0F2F5' : undefined, borderLeft: `3px solid ${color}` }}>
                    <span className="text-[10.5px] font-bold leading-[1.3] text-[#16223A]">{when}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] font-bold text-[#16223A]">{m.title}</span>
                      <span className="block truncate text-[10px] text-[#5B6478]">{[m.location, m.note].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="rounded-[10px] px-[7px] py-px text-[9.5px] font-bold" style={{ background: tbg, color }}>{m.type}</span>
                  </div>
                );
              })
            )}
            <div className="mt-auto bg-[#F6F8FA] px-3.5 py-[7px] text-[10px] text-[#5B6478]">Booked in the portal · open slots: {openSlots}</div>
          </div>

          {/* Court & deadlines */}
          <div className={card}>
            <div className="flex items-center gap-2 border-b border-[#DDE3EB] px-3.5 py-2.5">
              <Gavel className="h-[15px] w-[15px] text-[#6B3D8C]" />
              <strong className="text-[14px] text-[#16223A]" style={serif}>Court &amp; deadlines</strong>
              <span className="text-[10.5px] text-[#5B6478]">next 7 days</span>
              {canViewModule('calendar') && <button type="button" onClick={() => setCurrentView('calendar')} className="ml-auto text-[10.5px] font-bold text-[#8A6D3B]">Calendar -&gt;</button>}
            </div>
            {agenda.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#94A3B8]">No court dates or deadlines in the next 7 days.</p>
            ) : (
              agenda.map((e, i) => {
                const isHearing = e.stream === 'hearing';
                const color = isHearing ? '#6B3D8C' : '#B23A2E';
                const bg = isHearing ? '#F1EBF6' : '#FBEDE9';
                const dt = new Date(parseLocal(e.dueDate));
                const rel = e.bucket === 'overdue' ? `${daysBetween(e.dueDate, todayStr)}d overdue` : e.bucket === 'today' ? 'Today' : urgencyLabel(e, todayStr);
                return (
                  <button key={e.id} type="button" onClick={() => openMatter(e)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left" style={{ borderTop: i ? '1px solid #F0F2F5' : undefined }}>
                    <div className="w-9 shrink-0 rounded-md py-[3px] text-center" style={{ backgroundColor: bg }}>
                      <div className="text-[8.5px] font-bold uppercase" style={{ color }}>{MONTH[dt.getMonth()]}</div>
                      <div className="text-[15px] font-bold leading-[1.1]" style={{ color, ...serif }}>{dt.getDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-[#16223A]">{e.title}</p>
                      <p className="mt-px truncate text-[10.5px] text-[#5B6478]">
                        <span className="font-semibold" style={{ color }}>{isHearing ? 'Hearing' : 'Deadline'} · {rel}</span> · {isHearing ? e.matterTitle : shortRef(e.matterRef)}
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
              <strong className="text-[14px] text-[#16223A]" style={serif}>My Performance</strong>
              <span className="text-[10.5px] text-[#5B6478]">{MONTH[new Date(parseLocal(todayStr)).getMonth()]} {todayStr.slice(0, 4)}</span>
              <button type="button" onClick={() => setEditingTargets((v) => !v)} className="ml-auto rounded-md border border-[#DDE3EB] bg-white px-2 py-[3px] text-[10.5px] font-bold text-[#3D6B9C]">
                {editingTargets ? 'Done' : '✎ Edit targets'}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-[11px]">
              {([
                ...(seeBilling ? [
                  ['Billed', billing.billedThisMonth, targets.billed, '#8A6D3B', (v: number) => setTargets({ billed: v }), 'RM'],
                  ['Collected', billing.collectedThisMonth, targets.collected, '#2F6F4E', (v: number) => setTargets({ collected: v }), 'RM'],
                ] as const : []),
                ['New files brought', filesBroughtIn, targets.files, '#3D6B9C', (v: number) => setTargets({ files: v }), ''],
                ['Referrals converted', myReferrals.converted, targets.referrals, '#6B3D8C', (v: number) => setTargets({ referrals: v }), ''],
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
                        <input type="number" defaultValue={target} onBlur={(e) => onSet(Number(e.target.value) || 0)} className="w-16 rounded border border-[#DDE3EB] px-1.5 py-0.5 text-[11px]" />
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
                ...(seeBilling ? [
                  { label: 'billing', gap: targets.billed - billing.billedThisMonth, prefix: 'RM ' },
                  { label: 'collections', gap: targets.collected - billing.collectedThisMonth, prefix: 'RM ' },
                ] : []),
                { label: 'new files', gap: targets.files - filesBroughtIn, prefix: '' },
                { label: 'referrals', gap: targets.referrals - myReferrals.converted, prefix: '' },
              ].filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
              const g = gaps[0];
              if (!g) return null;
              return (
                <p className="mt-3 rounded-lg px-2.5 py-[7px] text-[10.5px] leading-[1.45]" style={{ backgroundColor: tint.red, color: palette.red }}>
                  ⚠ {g.prefix}{g.gap.toLocaleString()} more {g.label === 'billing' || g.label === 'collections' ? `in ${g.label}` : g.label} needed this month to hit target — biggest gap is {g.label}.
                </p>
              );
            })()}
          </div>

          {/* Collection + aging (billing readers only) */}
          {seeBilling && <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-center gap-3">
              <Donut segments={[{ label: 'Collected', value: billing.collectionRate, color: palette.green }]} size={64} thickness={10} centerLabel={`${billing.collectionRate}%`} />
              <div>
                <p className="text-[12px] font-bold text-[#16223A]">My collection rate</p>
                <p className="mt-[3px] text-[10.5px] leading-[1.45] text-[#5B6478]">RM {billing.totalCollected.toLocaleString()} collected of RM {billing.totalBilled.toLocaleString()} billed</p>
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
          </div>}

          {/* Productivity */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#16223A]"><Zap className="h-[13px] w-[13px] text-[#8A6D3B]" />Productivity</span>
              <span className="rounded-full bg-[#E6EFE9] px-[9px] py-0.5 text-[10px] font-bold text-[#2F6F4E]">{productivity.pct >= 100 ? 'On track today' : `${productivity.pct}% today`}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {productivity.days.map((d, i) => (
                <span key={i} className="flex-1 rounded py-1 text-center text-[9.5px] font-bold" style={{ backgroundColor: d.state === 'done' ? '#2F6F4E' : d.state === 'partial' ? '#8A6D3B' : '#F0F2F5', color: d.state === 'none' ? '#9AA3AE' : '#fff' }}>{d.label}</span>
              ))}
            </div>
            <p className="mt-1.5 text-[10.5px] text-[#5B6478]">{productivity.doneToday} of {productivity.dueToday} tasks due today completed · {productivity.streak}-day streak</p>
          </div>

          {/* My referrals */}
          <div className="rounded-xl border border-[#DDE3EB] bg-white p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="whitespace-nowrap text-[12px] font-bold text-[#16223A]">🔗 My referrals</span>
              <span className="text-[10.5px] text-[#5B6478]"><strong className="text-[#16223A]">{myReferrals.broughtIn}</strong> in · <strong className="text-[#2F6F4E]">{myReferrals.converted}</strong> converted ({myReferrals.rate}%)</span>
            </div>
            {myReferrals.bySource.length === 0 ? (
              <p className="mt-2.5 text-center text-[11px] text-[#94A3B8]">No leads attributed to you yet.</p>
            ) : (
              <div className="mt-1.5 flex flex-col">
                {myReferrals.bySource.map(([source, count], i) => (
                  <div key={source} className="flex justify-between py-1 text-[11px]" style={{ borderTop: i ? '1px solid #F0F2F5' : undefined }}>
                    <span><span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full" style={{ backgroundColor: ['#3D6B9C', '#8A6D3B', '#6B3D8C', '#2F6F4E', '#B23A2E'][i % 5] }} />{source}</span>
                    <span className="text-[#5B6478]">{count} lead{count === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      {taskForm && (
        <TaskFormModal
          open
          scope={taskForm.scope}
          draft={taskForm.draft}
          setDraft={(fn) => setTaskForm((s) => (s ? { ...s, draft: typeof fn === 'function' ? fn(s.draft) : fn } : s))}
          matterOptions={pickableCases.map((c) => ({ ref: c.ref, full: `${c.ref} — ${c.title}`, caseId: c.id }))}
          assignees={taskForm.scope === 'private' ? [{ code: meCode || myName.slice(0, 2).toUpperCase(), name: myName }] : staff.map((p) => ({ code: p.code, name: p.name }))}
          onClose={() => setTaskForm(null)}
          onCreate={() => saveTaskForm(false)}
          onCreateAnother={() => saveTaskForm(true)}
          fixedMatterLabel={taskForm.editing?.kind === 'case' ? (() => { const c = (cases || []).find((x: Case) => x.id === (taskForm.editing as { caseId: string }).caseId); return c ? `${c.ref} — ${c.title}` : undefined; })() : undefined}
          showKind={taskForm.scope === 'matter'}
          editing={!!taskForm.editing}
          onDelete={deleteFormTask}
          allowCompleted={!!taskForm.editing}
          onScopeChange={(scope) => setTaskForm((s) => (s ? { ...s, scope, draft: { ...s.draft, kind: 'Task', assignedTo: scope === 'private' ? myName : s.draft.assignedTo } } : s))}
          googleTasksNote={taskForm.scope === 'matter' && taskForm.draft.assignedTo && taskForm.draft.assignedTo !== myName ? 'Google Tasks: only tasks assigned to you sync to your Google Tasks' : undefined}
        />
      )}

      {meetingFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16223A]/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#DDE3EB] px-4 py-3">
              <strong className="text-[14px] text-[#16223A]" style={serif}>Book a slot</strong>
              <button type="button" onClick={() => setMeetingFormOpen(false)} className="ml-auto text-[#5B6478] hover:text-[#16223A]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2.5 p-4">
              <input autoFocus value={meetingDraft.title} onChange={(e) => setMeetingDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Meeting title" className="w-full rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={meetingDraft.date} onChange={(e) => setMeetingDraft((d) => ({ ...d, date: e.target.value }))} className="rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12px]" />
                <input type="time" value={meetingDraft.time} onChange={(e) => setMeetingDraft((d) => ({ ...d, time: e.target.value }))} className="rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12px]" />
              </div>
              <input value={meetingDraft.location} onChange={(e) => setMeetingDraft((d) => ({ ...d, location: e.target.value }))} placeholder="Location / link (optional)" className="w-full rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]" />
              <input value={meetingDraft.note} onChange={(e) => setMeetingDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Note (optional)" className="w-full rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]" />
              <div className="flex flex-wrap gap-1.5">
                {MEETING_TYPES.map((t) => {
                  const on = meetingDraft.type === t;
                  return (
                    <button key={t} type="button" onClick={() => setMeetingDraft((d) => ({ ...d, type: t }))} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ border: `1px solid ${on ? palette.navy : palette.border}`, backgroundColor: on ? palette.navy : '#fff', color: on ? '#fff' : palette.slate }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#DDE3EB] bg-[#F6F8FA] px-4 py-3">
              <button type="button" onClick={() => setMeetingFormOpen(false)} className="rounded-lg border border-[#DDE3EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5B6478]">Cancel</button>
              <button type="button" onClick={saveMeeting} className="ml-auto rounded-lg bg-[#16223A] px-4 py-1.5 text-[12px] font-bold text-white">Book slot</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
