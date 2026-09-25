import React, { useState } from 'react';
import { Activity, Calendar, Flag, FolderOpen, Tag, User, X } from 'lucide-react';
import { TaskChecklistItem } from '../../types';
import { palette, tint, tintText } from '../../lib/designTokens';

export interface TaskDraft {
  title: string;
  caseId: string;
  assignedTo: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not Started' | 'In Progress' | 'In Review';
  taskType: string;
  description: string;
  checklist: TaskChecklistItem[];
  syncGoogle: boolean;
}

export const blankTaskDraft = (defaultAssignee = ''): TaskDraft => ({
  title: '',
  caseId: '',
  assignedTo: defaultAssignee,
  dueDate: '',
  priority: 'Medium',
  status: 'Not Started',
  taskType: 'Standard',
  description: '',
  checklist: [],
  syncGoogle: true,
});

const TASK_TYPES = ['Standard', 'Review', 'Drafting', 'Filing', 'Research', 'Appearance'];
const ASSIGNEE_COLORS = [palette.blue, palette.green, palette.purple, palette.gold];

interface Assignee {
  code: string;
  name: string;
}

interface MatterOption {
  ref: string;
  full: string;
  caseId: string;
}

interface TaskFormModalProps {
  open: boolean;
  scope: 'matter' | 'private';
  draft: TaskDraft;
  setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>;
  matterOptions: MatterOption[];
  assignees: Assignee[];
  onClose: () => void;
  onCreate: () => void;
  onCreateAnother: () => void;
}

/** ClickUp / Planner-style task form modal — full properties grid, checklist, and Google Tasks sync toggle. */
export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  open,
  scope,
  draft,
  setDraft,
  matterOptions,
  assignees,
  onClose,
  onCreate,
  onCreateAnother,
}) => {
  const [newCheck, setNewCheck] = useState('');

  if (!open) return null;

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const addCheckItem = () => {
    const text = newCheck.trim();
    if (!text) return;
    const item: TaskChecklistItem = { id: `CHK-${Date.now()}`, title: text, completed: false };
    set('checklist', [...draft.checklist, item]);
    setNewCheck('');
  };

  const toggleCheckItem = (id: string) => {
    set(
      'checklist',
      draft.checklist.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c))
    );
  };

  const removeCheckItem = (id: string) => {
    set('checklist', draft.checklist.filter((c) => c.id !== id));
  };

  const dueChips: { label: string; date: string }[] = (() => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return [
      { label: 'Today', date: iso(today) },
      { label: 'Tomorrow', date: iso(tomorrow) },
      { label: 'Next week', date: iso(nextWeek) },
      { label: 'No date', date: '' },
    ];
  })();

  const checkedCount = draft.checklist.filter((c) => c.completed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#16223A]/45 pt-[120px]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="max-h-[calc(100vh-160px)] w-[760px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[14px] bg-white shadow-[0_30px_60px_-20px_rgba(22,34,58,.5)]">
        <div className="flex items-center gap-2.5 border-b border-[#DDE3EB] px-5 py-3.5">
          <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ backgroundColor: tint.blue, color: tintText.blue }}>
            {scope === 'private' ? 'Private to-do' : 'Matter to-do'}
          </span>
          <span className="text-[11px] text-[#5B6478]">New task · syncs to Google Tasks</span>
          <button type="button" onClick={onClose} className="ml-auto flex p-1 text-[#5B6478] hover:text-[#16223A]">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-5 pb-1.5 pt-4.5">
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Task name"
            className="w-full border-0 bg-transparent py-1 font-serif text-[22px] font-bold text-[#16223A] outline-none"
          />
        </div>

        <div className="grid grid-cols-[110px_minmax(0,1fr)_110px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 px-5 py-4">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><FolderOpen className="h-[13px] w-[13px]" />Matter</span>
          <div className="col-span-3">
            {scope === 'matter' ? (
              <select
                value={draft.caseId}
                onChange={(e) => set('caseId', e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]"
              >
                <option value="">Select matter…</option>
                {matterOptions.map((m) => (
                  <option key={m.caseId} value={m.caseId}>{m.full}</option>
                ))}
              </select>
            ) : (
              <span className="text-[12px] text-[#5B6478]">Private: no file attached, only you can see it</span>
            )}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><User className="h-[13px] w-[13px]" />Assignee</span>
          <div className="col-span-3 flex flex-wrap gap-2">
            {assignees.map((a, i) => {
              const selected = draft.assignedTo === a.name;
              const color = ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length];
              return (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => set('assignedTo', a.name)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold text-[#16223A]"
                  style={{ border: `1.5px solid ${selected ? palette.blue : palette.border}`, backgroundColor: selected ? tint.blue : '#fff' }}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{a.code}</span>
                  {a.name}
                </button>
              );
            })}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><Calendar className="h-[13px] w-[13px]" />Due date</span>
          <div className="col-span-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]"
            />
            {dueChips.map((c) => {
              const active = draft.dueDate === c.date;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => set('dueDate', c.date)}
                  className="rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold"
                  style={{
                    border: `1px solid ${active ? palette.navy : palette.border}`,
                    backgroundColor: active ? palette.navy : '#fff',
                    color: active ? '#fff' : '#16223A',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><Flag className="h-[13px] w-[13px]" />Priority</span>
          <div className="flex gap-1.5">
            {([
              ['High', palette.red, tint.red],
              ['Medium', palette.gold, tint.gold],
              ['Low', palette.slate, '#F0F2F5'],
            ] as const).map(([label, color, bg]) => {
              const active = draft.priority === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set('priority', label)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-bold"
                  style={{ border: `1.5px solid ${active ? color : palette.border}`, backgroundColor: active ? bg : '#fff', color: active ? color : '#5B6478' }}
                >
                  <Flag className="h-[11px] w-[11px]" />
                  {label}
                </button>
              );
            })}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><Activity className="h-[13px] w-[13px]" />Status</span>
          <select
            value={draft.status}
            onChange={(e) => set('status', e.target.value as TaskDraft['status'])}
            className="rounded-lg border border-[#DDE3EB] px-2.5 py-2 text-[12.5px] text-[#16223A]"
          >
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
          </select>

          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6478]"><Tag className="h-[13px] w-[13px]" />Task type</span>
          <div className="col-span-3 flex flex-wrap gap-1.5">
            {TASK_TYPES.map((type) => {
              const active = draft.taskType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => set('taskType', type)}
                  className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
                  style={{ border: `1px solid ${active ? palette.navy : palette.border}`, backgroundColor: active ? palette.navy : '#fff', color: active ? '#fff' : '#5B6478' }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-3.5">
          <div className="mb-1.5 text-[11px] font-semibold text-[#5B6478]">Description</div>
          <textarea
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="Add details, instructions for the assignee, or links to documents…"
            className="w-full resize-y rounded-lg border border-[#DDE3EB] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#16223A] outline-none"
          />
        </div>

        <div className="px-5 pb-4.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#5B6478]">Checklist</span>
            <span className="text-[10.5px] text-slate-400">{checkedCount}/{draft.checklist.length}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#DDE3EB]">
            {draft.checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 border-b border-[#F0F2F5] px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleCheckItem(c.id)}
                  className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded text-[10px] text-white"
                  style={{ border: `1.5px solid ${c.completed ? palette.green : palette.border}`, backgroundColor: c.completed ? palette.green : '#fff' }}
                >
                  {c.completed ? '✓' : ''}
                </button>
                <span className="flex-1 text-[12px] text-[#16223A]" style={{ textDecoration: c.completed ? 'line-through' : 'none' }}>{c.title}</span>
                <button type="button" onClick={() => removeCheckItem(c.id)} className="text-[13px] text-slate-400 hover:text-slate-600">✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2.5 px-3 py-1.5">
              <input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCheckItem();
                  }
                }}
                placeholder="Add checklist item, e.g. Obtain signed affidavit (Enter)"
                className="flex-1 border-0 bg-transparent text-[12px] text-[#16223A] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-[#DDE3EB] bg-[#F6F8FA] px-5 py-3">
          <button
            type="button"
            onClick={() => set('syncGoogle', !draft.syncGoogle)}
            className="flex items-center gap-2 text-[11.5px] text-[#16223A]"
          >
            <span className="relative h-[17px] w-[30px] rounded-full" style={{ backgroundColor: draft.syncGoogle ? palette.green : '#CBD5E1' }}>
              <span className="absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-all" style={{ left: draft.syncGoogle ? 15 : 2 }} />
            </span>
            Sync to Google Tasks
          </button>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-[#DDE3EB] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#5B6478]">
            Cancel
          </button>
          <button type="button" onClick={onCreateAnother} disabled={!draft.title.trim()} className="rounded-lg border border-[#16223A] bg-white px-3.5 py-2 text-[12px] font-bold text-[#16223A] disabled:opacity-40">
            Create &amp; add another
          </button>
          <button type="button" onClick={onCreate} disabled={!draft.title.trim()} className="rounded-lg bg-[#16223A] px-4.5 py-2 text-[12px] font-bold text-white disabled:opacity-40">
            Create task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskFormModal;
