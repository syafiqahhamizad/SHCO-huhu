import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, CaseActivityLog, Task } from '../../../types';
import { TaskFormModal, blankTaskDraft, type TaskDraft } from '../../ui/TaskFormModal';
import { FileCoverModal } from '../../modals/FileCoverModal';
import { activeStorage, ensureMatterFolder, prepareStorage } from '../../../services/fileStorageService';
import { css } from './caseUi';
import { canSeeFinanceView, finRoleKey } from '../../../lib/financeAccess';
import {
  courtOf, deriveMatchKey, fmt, isDone, lawyerOf, matterMoney, openedOf, partiesOf, partnerNames, practiceOf, rm, short, stageIndexOf, stagesFor, staffOf, todayIso,
} from './caseModel';
import { histEntry, newId, type WF } from './wf';
import { OverviewTab } from './tabs/OverviewTab';
import { StatusTab, WeeklyStatusModal, weeklyInfo } from './tabs/StatusTab';
import { CourtTab } from './tabs/CourtTab';
import { FilingTab } from './tabs/FilingTab';
import { TasksTab } from './tabs/TasksTab';
import { TimeTab } from './tabs/TimeTab';
import { MoneyTab } from './tabs/MoneyTab';
import { NotesTab } from './tabs/NotesTab';
import { LettersTab } from './tabs/LettersTab';
import { HistoryTab } from './tabs/HistoryTab';
import { ClosedBanner, CloseRequestPanel, RequestCloseModal } from './CloseFlow';
import { DeleteMatterModal, EditMatterModal } from './MatterModals';
import { syncTask, unsyncTask } from './clientComms';

/** Old workspace sub-tab ids (still used by links from other pages) → new Working File tabs. */
const TAB_ALIAS: Record<string, string> = {
  overview: 'overview', status: 'status', court: 'court', hearings: 'court', diary: 'court', service: 'service', tasks: 'tasks',
  time: 'time', matterActivities: 'time', matterDisbursements: 'time', matterUnbilled: 'time', money: 'money', ledger: 'money', matterInvoices: 'money',
  notes: 'notes', meetings: 'notes', research: 'notes', internal: 'notes', memo: 'notes', letters: 'letters', documents: 'letters', history: 'history', activity: 'history',
};
const ST: Record<string, { bg: string; fg: string }> = { Active: { bg: '#E6EFE9', fg: '#1F5A3B' }, Pending: { bg: '#F6EEDC', fg: '#8A6D3B' }, Closed: { bg: '#EEF1F5', fg: '#4A5468' }, Archive: { bg: '#F6E4E1', fg: '#8E2A20' } };

export const WorkingFile: React.FC<{ c: Case }> = ({ c }) => {
  const app = useApp();
  const { users = [], clients = [], currentUser, currentRole, isAdmin, caseSubTab, setCaseSubTab, setCurrentCaseId, updateCase, showToast, invoices = [], payments = [], retainers = [], quotations = [], timeEntries = [], expenses = [], travelClaims = [] } = app;
  const staff = useMemo(() => staffOf(users), [users]);
  const me = currentUser?.name || '';
  const meP = staff.find((p) => p.name === me);
  const meCode = meP?.code || '';
  const firmAdmin = Boolean(isAdmin || currentUser?.isSuperAdmin);
  const isPartner = currentRole === 'Partner' || firmAdmin;
  const isClerk = currentRole === 'Assistant';
  const seeFin = !isClerk;
  const finRk = finRoleKey(currentRole, currentUser, isAdmin);
  const canOpenFin = (view: string) => canSeeFinanceView(view, finRk);
  const ro = c.status === 'Closed' || c.status === 'Archive';
  const canApprove = firmAdmin || (currentRole === 'Partner' && (c.partners || []).some((p) => p === meCode));
  const parties = useMemo(() => partiesOf(c, clients), [c, clients]);
  const money = useMemo(() => matterMoney(c, { invoices, payments, retainers, quotations, timeEntries, expenses, travelClaims }), [c, invoices, payments, retainers, quotations, timeEntries, expenses, travelClaims]);

  const tab0 = TAB_ALIAS[caseSubTab] || 'overview';
  const tab = !seeFin && tab0 === 'money' ? 'overview' : tab0;
  const setTab = (t: string) => setCaseSubTab(t);
  const [courtChange, setCourtChange] = useState<'' | 'coram' | 'sol'>('');
  const [modal, setModal] = useState<'' | 'edit' | 'del' | 'cover' | 'close' | 'weekly'>('');
  const [taskForm, setTaskForm] = useState<{ draft: TaskDraft; editing?: Task } | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  useEffect(() => { window.scrollTo?.(0, 0); }, [c.id]);

  // Latest case (for saves after an await, e.g. Google calls) — updated on every render.
  const latest = useRef(c);
  latest.current = c;
  const casesRef = useRef(app.cases);
  casesRef.current = app.cases;
  const save = (patch: Partial<Case>, what?: string, type: CaseActivityLog['type'] = 'Status Update') => {
    const base = latest.current;
    const logs = what ? [histEntry(what, me, type), ...(patch.activityLogs || base.activityLogs || [])] : patch.activityLogs;
    updateCase(c.id, { ...patch, ...(logs ? { activityLogs: logs } : {}) });
  };
  const saveWith = (fn: (latestCase: Case) => Partial<Case>, what?: string, type: CaseActivityLog['type'] = 'Status Update') => {
    const now = (casesRef.current || []).find((x) => x.id === c.id) || latest.current;
    const patch = fn(now);
    const logs = what ? [histEntry(what, me, type), ...(patch.activityLogs || now.activityLogs || [])] : patch.activityLogs;
    updateCase(c.id, { ...patch, ...(logs ? { activityLogs: logs } : {}) });
  };
  const toast = (m: string) => setTimeout(() => showToast(m), 0);

  const openTask = (t?: Task, preset?: Partial<TaskDraft>) => {
    if (t) {
      const st = isDone(t) ? 'Completed' : t.status === 'In Progress' || t.status === 'In Review' ? t.status : t.status === 'Under Review' ? 'In Review' : 'Not Started';
      setTaskForm({ editing: t, draft: { title: t.title, caseId: c.id, assignedTo: staff.find((p) => p.code === t.assignedTo)?.name || t.assignedTo, dueDate: t.dueDate || '', priority: t.priority, status: st as TaskDraft['status'], taskType: t.taskType || 'Standard', description: t.description || '', checklist: t.checklist || [], syncGoogle: !!t.syncToGoogle, kind: t.kind || 'Task' } });
    } else setTaskForm({ draft: { ...blankTaskDraft(me), caseId: c.id, kind: 'Task', syncGoogle: false, ...preset } });
  };
  const saveTask = (again: boolean) => {
    if (!taskForm) return;
    const d = taskForm.draft;
    if (!d.title.trim()) return;
    const kind = d.kind || 'Task';
    if (kind !== 'Task' && !d.dueDate) { toast('A deadline needs a due date'); return; }
    const now = new Date().toISOString();
    const base = {
      title: d.title.trim(), priority: d.priority, status: d.status, dueDate: d.dueDate, assignedTo: d.assignedTo || me, taskType: d.taskType,
      description: d.description.trim() || undefined, checklist: d.checklist.length ? d.checklist : undefined, kind,
      remindDaysBefore: kind !== 'Task' ? (kind === 'Limitation' ? 30 : 3) : undefined, matchKey: kind !== 'Task' ? deriveMatchKey(d.title) : undefined,
      syncToGoogle: d.syncGoogle, lastUpdatedBy: me, lastUpdatedAt: now,
      doneOn: d.status === 'Completed' ? todayIso() : undefined, completedAt: d.status === 'Completed' ? now : undefined,
    };
    if (taskForm.editing) {
      const t = taskForm.editing;
      const upd = { ...t, ...base, doneOn: d.status === 'Completed' ? t.doneOn || todayIso() : undefined };
      save({ tasks: (c.tasks || []).map((x) => (x.id === t.id ? upd : x)) }, 'Task updated: ' + base.title, 'Milestone Completion');
      setTaskForm(null);
      if (d.syncGoogle || t.googleTaskIds?.[meId]) void syncTask(w, upd);
      toast('Task updated · shows in ' + base.assignedTo.split(' ')[0] + "'s My Work and this file");
      return;
    }
    const task: Task = { id: newId('T'), ...base, createdBy: me, createdAt: now };
    save({ tasks: [...(c.tasks || []), task] }, (kind === 'Task' ? 'Task added: ' : 'Deadline added: ') + task.title, 'Milestone Completion');
    setTaskForm(again ? { draft: { ...blankTaskDraft(base.assignedTo), caseId: c.id, kind: 'Task', syncGoogle: false } } : null);
    if (d.syncGoogle) void syncTask(w, task);
    toast((kind === 'Task' ? 'Task' : 'Deadline') + ' added · shows in ' + base.assignedTo.split(' ')[0] + "'s My Work and this file");
  };
  const deleteTask = () => {
    const t = taskForm?.editing;
    if (!t || !window.confirm('Delete this task?')) return;
    save({ tasks: (c.tasks || []).filter((x) => x.id !== t.id) }, 'Task deleted: ' + t.title);
    setTaskForm(null);
    void unsyncTask(w, t);
  };

  const meId = currentUser?.id || '';
  const w: WF = { c, saveWith, meId, staff, me, meCode, isPartner, isClerk, seeFin, canOpenFin, ro, parties, money, save, toast, setTab, openTask, openWeekly: () => setModal('weekly'), courtChange, setCourtChange };

  const court = courtOf(c);
  const stages = stagesFor(practiceOf(c));
  const at = stageIndexOf(c);
  const { cur, due } = weeklyInfo(c);
  const lastUp = [...(c.clientUpdates || [])].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  const nClients = parties.filter((p) => p.side === 'client' && !p.dischargedOn).length;
  const nOpp = parties.filter((p) => p.side === 'opposing').length;
  const nFirms = parties.filter((p) => p.side === 'solicitor' && !p.dischargedOn).length;
  const pNames = partnerNames(c, staff);
  const openTasks = (c.tasks || []).filter((t) => !isDone(t)).length;
  const isCourtStage = /Litigation|Syariah|Family|Employment|Criminal/.test(practiceOf(c)) || at >= 0;
  const st = ST[c.status] || ST.Closed;

  const createDrive = async () => {
    setDriveBusy(true);
    try {
      await prepareStorage();
      const f = await ensureMatterFolder(c.ref, c.title);
      if (f) { save({ gdriveFolderId: f.id, gdriveFolderUrl: f.url }, 'Google Drive folder created'); toast('Drive folder created under Matters'); }
    } catch (e) { toast('Drive folder not created: ' + (e instanceof Error ? e.message : String(e))); }
    setDriveBusy(false);
  };

  const tabs: [string, string][] = [
    ['overview', 'Overview'], ['status', 'Status'], ['court', 'Court (' + (c.hearings || []).length + ')'], ['service', 'Filing & service (' + (c.serviceRecord || []).length + ')'],
    ['tasks', 'Tasks (' + openTasks + ' open)'], ['time', 'Time & costs'], ...(seeFin ? [['money', 'Money'] as [string, string]] : []),
    ['notes', 'Notes (' + ((c.fileNotes || []).length + (c.meetingNotes || []).length + (c.researchNotes || []).length + (c.internalNotes || []).length + (c.memos || []).length) + ')'], ['letters', 'Letters & e-sign'], ['history', 'History'],
  ];
  const meta: [string, React.ReactNode][] = [
    ['Clients', nClients], ['Opposing', nOpp + ' part' + (nOpp === 1 ? 'y' : 'ies') + ' · ' + nFirms + ' firm' + (nFirms === 1 ? '' : 's')], ['Practice', practiceOf(c) || '—'],
    ...(court.name ? [['Court', court.name] as [string, React.ReactNode]] : []), ...(court.suit ? [['Suit', court.suit] as [string, React.ReactNode]] : []),
    ['Opened', fmt(openedOf(c))], ['PIC', ['Partner ' + ((c.partners || []).join(', ') || '—'), lawyerOf(c)].filter(Boolean).join(' · ')],
  ];
  const bal = money.bills.filter((b) => b.issued && b.bal > 0);
  const strip: [string, string, string, string][] = [
    ['Unbilled fees', rm(money.ubFees), money.ubHours + ' h of time not billed yet', '#8A6D3B'],
    ['Unbilled disbursements', rm(money.ubDisb), 'From approved claims and PVs', '#8E2A20'],
    ['Debtor balance', rm(money.outstanding), bal.length ? 'Outstanding on ' + bal.map((b) => b.id).join(', ') : 'Nothing outstanding', '#1F5A3B'],
  ];
  const btn = 'flex-shrink:0;border:1px solid #C9D1DC;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit';

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;color:#16223A')}>
      <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
        <button type="button" onClick={() => setCurrentCaseId(null)} style={css('border:0;background:none;padding:0;font-size:12.5px;color:#4A5468;cursor:pointer;font-family:inherit')}>Cases</button><span style={css('color:#4A5468')}>/</span>
        <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>{c.title}</strong>
        <span style={css('margin-left:auto;font-size:12px;color:#4A5468')}>Viewing as <strong style={css('color:#16223A')}>{me || '—'} ({isClerk ? 'Clerk' : isPartner ? 'Partner' : currentRole})</strong></span>
      </div>

      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:18px 20px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap')}>
        <div style={css('display:flex;flex-direction:column;gap:5px;min-width:280px;flex:1 1 420px')}>
          <span style={css('font-family:ui-monospace, monospace;font-size:13px;font-weight:800;color:#8A6D3B')}>{c.ref}</span>
          <strong style={css('font-family:Georgia, serif;font-size:20px;color:#16223A')}>{c.title}</strong>
          <div style={css('display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:#4A5468')}>
            {meta.map(([k, v]) => <span key={k} style={css('white-space:nowrap')}>{k} <strong style={css('color:#16223A')}>{v}</strong></span>)}
            {c.gdriveFolderUrl ? <a href={c.gdriveFolderUrl} target="_blank" rel="noopener noreferrer" style={css('font-weight:700;color:#2F4F7A;white-space:nowrap')}>Open in Google Drive ↗</a>
              : activeStorage() === 'drive' && !ro ? <button type="button" disabled={driveBusy} onClick={createDrive} style={css('border:0;background:none;padding:0;font-weight:700;color:#2F4F7A;cursor:pointer;font-family:inherit;font-size:12.5px;white-space:nowrap')}>{driveBusy ? 'Creating…' : 'Create Drive folder'}</button> : null}
          </div>
        </div>
        <span style={css(`flex-shrink:0;padding:4px 11px;border-radius:10px;font-size:12px;font-weight:700;background:${st.bg};color:${st.fg}`)}>{c.status}</span>
        {!ro && <button type="button" onClick={() => setModal('edit')} style={css(btn)}>Edit matter details</button>}
        <button type="button" onClick={() => setModal('cover')} style={css(btn)}>Print file cover</button>
        {!ro && <button type="button" onClick={() => setModal('close')} style={css(btn)}>{c.closeRequest?.status === 'Pending' ? 'Close requested' : 'Request to close'}</button>}
        {!ro && <button type="button" onClick={() => setModal('del')} title={isPartner ? 'Partners only. Removes the file from all lists.' : 'Sends a deletion request to the partner in charge'} style={css('flex-shrink:0;border:1px solid #E7C3BE;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#8E2A20;cursor:pointer;font-family:inherit')}>{isPartner ? 'Delete matter' : c.deletionRequest ? 'Deletion requested' : 'Request deletion'}</button>}
        <div style={css('flex-basis:100%;display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid #EEF1F5')}>
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
            <span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468')}>{isCourtStage && /Litigation|Syariah|Family|Employment|Criminal/.test(practiceOf(c)) ? 'Case status' : 'Matter status'}</span>
            <strong style={css('font-size:13px;color:#16223A')}>{stages[at]}</strong>
            <span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${due.bg};color:${due.fg}`)}>{due.label}</span>
            <span style={css('font-size:12px;color:#4A5468')}>Client last updated {lastUp ? short(lastUp.at) + ' (' + lastUp.deliveryStatus + ')' : 'never'}</span>
            <button type="button" onClick={() => setTab('status')} style={css('margin-left:auto;border:1px solid #C9D1DC;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{cur ? 'Status →' : 'Do weekly update →'}</button>
          </div>
          <div style={css('display:flex;gap:4px')}>
            {stages.map((label, i) => (
              <div key={label} style={css('flex:1 1 0;display:flex;flex-direction:column;gap:6px;min-width:0')}>
                <div style={css(`height:6px;border-radius:3px;background:${i < at ? '#1F5A3B' : i === at ? '#16223A' : '#DDE3EB'}`)} />
                <span style={css(`font-size:11.5px;font-weight:${i === at ? 800 : 500};color:${i <= at ? '#16223A' : '#4A5468'};line-height:1.3`)}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ClosedBanner key={c.status + (c.closedDate || "")} w={w} canReopen={isPartner} onPrint={() => setModal('cover')} />
      <CloseRequestPanel w={w} canApprove={canApprove} onEdit={() => setModal('close')} />

      {seeFin && (
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px')}>
          {strip.map(([k, v, sub, col]) => <div key={k} style={css('display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468')}>{k}</span><strong style={css(`font-size:20px;color:${col}`)}>{v}</strong><span style={css('font-size:11.5px;color:#4A5468')}>{sub}</span></div>)}
        </div>
      )}

      <div style={css('display:flex;gap:2px;border-bottom:1px solid #DDE3EB;flex-wrap:wrap')}>
        {tabs.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} style={css(`border:0;background:none;padding:10px 14px;font-size:13px;font-family:inherit;cursor:pointer;margin-bottom:-1px;font-weight:${tab === k ? 700 : 500};color:${tab === k ? '#16223A' : '#4A5468'};border-bottom:2px solid ${tab === k ? '#16223A' : 'transparent'}`)}>{label}</button>)}
      </div>

      {tab === 'overview' && <OverviewTab w={w} />}
      {tab === 'status' && <StatusTab w={w} />}
      {tab === 'court' && <CourtTab w={w} />}
      {tab === 'service' && <FilingTab w={w} />}
      {tab === 'tasks' && <TasksTab w={w} />}
      {tab === 'time' && <TimeTab w={w} />}
      {tab === 'money' && seeFin && <MoneyTab w={w} />}
      {tab === 'notes' && <NotesTab w={w} />}
      {tab === 'letters' && <LettersTab w={w} />}
      {tab === 'history' && <HistoryTab w={w} />}

      {modal === 'edit' && <EditMatterModal w={w} onClose={() => setModal('')} />}
      {modal === 'del' && <DeleteMatterModal w={w} onClose={() => setModal('')} />}
      {modal === 'close' && <RequestCloseModal w={w} onClose={() => setModal('')} />}
      {modal === 'weekly' && <WeeklyStatusModal w={w} onClose={() => setModal('')} />}
      <FileCoverModal isOpen={modal === 'cover'} onClose={() => setModal('')} selectedCase={c} clients={clients} partnerNames={pNames} onPrinted={(n) => save({}, 'File cover printed (' + n + ' cop' + (n === 1 ? 'y' : 'ies') + ')', 'Document Upload')} />
      {taskForm && (
        <TaskFormModal
          open
          scope="matter"
          draft={taskForm.draft}
          setDraft={(fn) => setTaskForm((s) => (s ? { ...s, draft: typeof fn === 'function' ? fn(s.draft) : fn } : s))}
          matterOptions={[{ ref: c.ref, full: c.ref + ' — ' + c.title, caseId: c.id }]}
          assignees={staff.map((p) => ({ code: p.code, name: p.name }))}
          onClose={() => setTaskForm(null)}
          onCreate={() => saveTask(false)}
          onCreateAnother={() => saveTask(true)}
          fixedMatterLabel={c.ref + ' — ' + c.title}
          showKind
          editing={!!taskForm.editing}
          onDelete={deleteTask}
          allowCompleted={!!taskForm.editing}
          googleTasksNote={taskForm.draft.assignedTo && taskForm.draft.assignedTo !== me ? 'Google Tasks: only tasks assigned to you sync to your Google Tasks' : undefined}
        />
      )}
    </div>
  );
};
