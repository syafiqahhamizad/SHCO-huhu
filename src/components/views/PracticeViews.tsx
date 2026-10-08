import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, User } from '../../types';
import { getUsername } from '../../lib/stringUtils';
import {
  Clock,
  Calendar as CalendarIcon,
  Activity,
  Flag,
  Share2,
  FolderX,
  Plus,
  ExternalLink,
  History,
  Columns,
  List,
  GripVertical,
  ArrowRight,
  Download,
} from 'lucide-react';

/* ================= 1. HEARINGS VIEW ================= */
export const HearingsView: React.FC = () => {
  const { cases, setCurrentCaseId, setCurrentView, setCaseSubTab } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  const allHearings: { caseRef: string; caseId: string; date: string; time: string; purpose: string; status: string; clientRole?: string }[] = [];
  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      allHearings.push({
        caseRef: c.ref,
        caseId: c.id,
        date: h.date,
        time: h.time,
        purpose: h.purpose,
        status: h.status,
        clientRole: c.clientRole,
      });
    });
  });

  allHearings.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#3D6B9C]" />
          All Court Hearings &amp; Appearances
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Firm-wide list of scheduled court management sessions and trials.</p>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Time</th>
              <th className="p-3 font-bold">Matter Reference</th>
              <th className="p-3 font-bold">Purpose</th>
              <th className="p-3 font-bold">Timing Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allHearings.map((h, i) => {
              const isToday = h.date === todayStr;
              const isPast = h.date < todayStr;

              return (
                <tr
                  key={i}
                  onClick={() => {
                    setCaseSubTab('court');
                    setCurrentCaseId(h.caseId);
                    setCurrentView('cases');
                  }}
                  className="hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                >
                  <td className="p-3 font-mono font-semibold text-slate-800">{h.date}</td>
                  <td className="p-3 font-semibold text-slate-800">{h.time}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="ref-seal">{h.caseRef}</span>
                      {h.clientRole && (
                        <span className="text-[9.5px] font-extrabold text-[#3D6B9C] bg-[#FBF2E9] border border-[#3D6B9C]/30 px-1.5 py-0.2 rounded w-max">
                          Representing: {h.clientRole}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-800">{h.purpose}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isToday
                          ? 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                          : isPast
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-[#E7EEF6] text-[#3D6B9C]'
                      }`}
                    >
                      {isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 2. CALENDAR VIEW ================= */
export const CalendarView: React.FC = () => {
  const { cases } = useApp();
  const [calendarMode, setCalendarMode] = useState<'embed' | 'grid'>('embed');
  const firmCalendarEmbedUrl =
    'https://calendar.google.com/calendar/embed?src=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com&ctz=Asia%2FKuala_Lumpur';
  // Direct subscription link for logged-in Google Calendar users
  const firmCalendarSubscribeUrl =
    'https://calendar.google.com/calendar/u/0/r?cid=c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668%40group.calendar.google.com';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);

  // Calendar Event Label Helper
  const getEventLabel = (purpose: string) => {
    const p = (purpose || '').toLowerCase();
    if (p.includes('trial') || p.includes('bicara')) {
      return { tag: 'Trial / Bicara', color: 'bg-[#FBEDE9] text-[#B23A2E] border-[#B23A2E]' };
    }
    if (p.includes('hearing') || p.includes('pendengaran') || p.includes('injunction') || p.includes('appeal')) {
      return { tag: 'Hearing', color: 'bg-[#FBF2E9] text-[#8A6D3B] border-[#8A6D3B]' };
    }
    if (p.includes('ptcm') || p.includes('mention') || p.includes('sebutan') || p.includes('case management')) {
      return { tag: 'PTCM / Mention', color: 'bg-[#E7EEF6] text-[#3D6B9C] border-[#3D6B9C]' };
    }
    if (p.includes('deadline') || p.includes('filing') || p.includes('compliance') || p.includes('had masa')) {
      return { tag: 'Filing Deadline', color: 'bg-[#F1EBF6] text-[#6B3D8C] border-[#6B3D8C]' };
    }
    return { tag: 'Consultation', color: 'bg-[#E6EFE9] text-[#2F6F4E] border-[#2F6F4E]' };
  };

  const eventsByDate: Record<string, { ref: string; fullRef: string; time: string; purpose: string }[]> = {};

  (cases || []).forEach((c) => {
    (c.hearings || []).forEach((h) => {
      if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
      eventsByDate[h.date].push({
        ref: c.ref.split('/')[3] || c.ref,
        fullRef: c.ref,
        time: h.time,
        purpose: h.purpose,
      });
    });
  });

  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = eventsByDate[dStr] || [];
    const isToday = dStr === todayStr;

    cells.push(
      <div
        key={d}
        className={`cal-cell flex flex-col justify-between p-2 min-h-[90px] border border-[#DDE3EB]/60 rounded-lg ${
          isToday ? 'bg-[#FBF2E9]/80 border-[#8A6D3B] ring-2 ring-amber-300 font-bold' : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-slate-700 font-bold text-xs">{d}</span>
          {evs.length > 0 && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-[#F1EBF6] text-[#6B3D8C] rounded border border-[#F1EBF6]">
              {evs.length} Event{evs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-1 overflow-y-auto max-h-[80px]">
          {evs.map((e, idx) => {
            const labelInfo = getEventLabel(e.purpose);
            return (
              <div
                key={idx}
                className="bg-[#16223A]/8 hover:bg-[#16223A]/15 border border-[#3D6B9C]/30 p-1 rounded text-[9.5px] font-bold text-[#16223A] transition-colors"
                title={`${e.fullRef} — ${e.purpose}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{e.time} {e.ref}</span>
                  <span className={`text-[8px] font-extrabold border px-1 rounded flex items-center shrink-0 ${labelInfo.color}`}>
                    {labelInfo.tag}
                  </span>
                </div>
                <div className="text-[8.5px] font-normal text-slate-600 truncate mt-0.5">
                  {e.purpose}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner with Google Calendar Status Label */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#3D6B9C]" />
            <h2 className="font-serif text-lg font-bold text-[#16223A]">
              Messrs Syafiqah Hamizad &amp; Co — Official Firm Google Calendar
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization with firm court dates, hearings, client consultations, and statutory filing deadlines.
          </p>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F6F8FA] p-1 rounded-lg border border-[#DDE3EB]">
            <button
              type="button"
              onClick={() => setCalendarMode('embed')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'embed'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#8A6D3B]" />
              <span>Live Google Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                calendarMode === 'grid'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#3D6B9C]" />
              <span>Court Diary Grid</span>
            </button>
          </div>

          <a
            href={firmCalendarSubscribeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#2F6F4E] hover:bg-[#2F6F4E] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#E6EFE9]" />
            <span>Add / Open in Signed-In Google Calendar</span>
          </a>
        </div>
      </div>

      {/* Main Content Area: Embedded Google Calendar vs Interactive Grid */}
      {calendarMode === 'embed' ? (
        <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#F6F8FA] p-3 rounded-lg border border-[#DDE3EB] text-xs gap-2">
            <span className="font-bold text-[#16223A] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2F6F4E] animate-pulse" />
              Connected Google Calendar: <code className="font-mono text-[11px] text-[#3D6B9C] bg-[#E7EEF6] px-1.5 py-0.5 rounded border border-[#E7EEF6]">c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668@group.calendar.google.com</code>
            </span>
            <span className="text-slate-600 text-[11px] font-semibold bg-[#FBF2E9] text-[#8A6D3B] px-2 py-0.5 rounded border border-[#8A6D3B]">
              Timezone: Asia/Kuala_Lumpur
            </span>
          </div>

          {/* Color Labels Guideline Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>🎨 Firm Google Calendar Color Taxonomy:</span>
              <span className="text-[10.5px] font-normal text-slate-500">(Colors display as set in your signed-in Google Calendar UI)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]">
                🔴 Trial / Bicara (Flamingo Red)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]">
                🟡 Hearing / Pendengaran (Banana Amber)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E7EEF6] text-[#3D6B9C] border border-[#3D6B9C]">
                🔵 PTCM / Mention (Peacock Blue)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1EBF6] text-[#6B3D8C] border border-[#6B3D8C]">
                🟣 Filing Deadline (Grape Purple)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E6EFE9] text-[#2F6F4E] border border-[#2F6F4E]">
                🟢 Client Consultation (Sage Green)
              </span>
            </div>
          </div>

          <div className="w-full rounded-lg overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
            <iframe
              src={firmCalendarEmbedUrl}
              style={{ border: 0 }}
              width="100%"
              height="700"
              frameBorder="0"
              scrolling="no"
              title="Messrs Syafiqah Hamizad & Co Firm Google Calendar"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-wrap justify-between items-center text-xs font-bold text-[#16223A] gap-2">
            <span className="font-serif text-sm">
              {now.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
            </span>

            {/* Color-Coded Google Calendar Label Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]">
                🔴 Trial / Bicara
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]">
                🟡 Hearing / Pendengaran
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E7EEF6] text-[#3D6B9C] border border-[#3D6B9C]">
                🔵 PTCM / Mention
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1EBF6] text-[#6B3D8C] border border-[#6B3D8C]">
                🟣 Filing Deadline
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E6EFE9] text-[#2F6F4E] border border-[#2F6F4E]">
                🟢 Consultation
              </span>
            </div>
          </div>

          <div className="cal-grid text-center font-bold text-[10px] text-slate-500 uppercase pb-1.5 border-b border-slate-200">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="cal-grid gap-1">{cells}</div>
        </div>
      )}
    </div>
  );
};

// Partner In Charge Helper derived from Ref
const getPartnerInChargeFromRef = (refStr: string): string => {
  if (!refStr) return 'Messrs. Syafiqah Hamizad & Co';
  const parts = refStr.split('/');
  if (parts.length >= 3) {
    const partnerSegment = parts[2];
    const codes = partnerSegment.split('-');
    const partnerNames = codes.map((code) => {
      const c = code.toUpperCase();
      if (c === 'SH') return 'Syafiqah Hamizad';
      if (c === 'AH') return 'Amer Haiqal';
      if (c === 'ZA') return 'Zulaikha Afendi';
      return code;
    });
    return partnerNames.join(' & ');
  }
  return 'Syafiqah Hamizad';
};

/* ================= 5. CASE STATUS VIEW ================= */
interface ActionHistoryLog {
  id: string;
  timestamp: string;
  taskTitle: string;
  caseRef: string;
  caseTitle: string;
  fromStatus: string;
  toStatus: string;
  updatedBy: string;
}

export const CaseStatusView: React.FC<{ matterCaseId?: string }> = ({ matterCaseId }) => {
  const { cases, users, currentUser, currentPartnerCode, isAdmin, updateCase, setCurrentCaseId, setCurrentView, setCaseSubTab, showToast, addNotification, addDeadline, addCaseActivityLog } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLawyer, setSelectedLawyer] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  // Layout View Mode: 'kanban' or 'table'
  const [viewLayout, setViewLayout] = useState<'kanban' | 'table'>('kanban');

  // History Log Modal & State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [actionHistoryLogs, setActionHistoryLogs] = useState<ActionHistoryLog[]>([]);

  // Drag & Drop State
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // New Action Modal State
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [newTaskCaseId, setNewTaskCaseId] = useState<string>(cases[0]?.id || '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskReviewer, setNewTaskReviewer] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskChecklist, setNewTaskChecklist] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeMentionField, setActiveMentionField] = useState<'assignee' | 'reviewer' | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Manual per-task stage tag: a free-text label typed in by the user, never auto-set
  const [editingStageTagTaskId, setEditingStageTagTaskId] = useState<string | null>(null);
  const [stageTagDraft, setStageTagDraft] = useState('');


  // Color palette for assignee badges
  const ASSIGNEE_COLORS = [
    'bg-[#3D6B9C]',
    'bg-[#6B3D8C]',
    'bg-pink-500',
    'bg-[#2F6F4E]',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-[#6B3D8C]',
    'bg-[#B23A2E]',
  ];

  const getColorForAssignee = (name: string, index: number): string => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ASSIGNEE_COLORS[(hash + index) % ASSIGNEE_COLORS.length];
  };

  const pushTaggedNotification = (targetName: string, title: string, message: string, caseId: string) => {
    addNotification({
      title,
      message: `@${targetName} ${message}`,
      type: 'system',
      linkTab: 'tasks',
      linkId: caseId,
      to: [targetName],
    });
  };

  const parseTaggedNames = (text: string): string[] => {
    const tags = (text.match(/@([^,@\n]+)/g) || [])
      .map((tag) => tag.replace('@', '').trim())
      .filter(Boolean);
    return Array.from(new Set(tags));
  };

  const mentionSuggestions = (value: string) => {
    const fragment = value.split(/[@,\s]/).pop()?.toLowerCase() || '';
    return users
      .filter((user) => user.status === 'Active' && user.role !== 'Client')
      .filter((user) => getUsername(user).toLowerCase().includes(fragment) || user.name.toLowerCase().includes(fragment))
      .slice(0, 6);
  };

  const selectMention = (field: 'assignee' | 'reviewer', user: User) => {
    const mention = `@${getUsername(user)} `;
    if (field === 'assignee') setNewTaskAssignee((current) => `${current.replace(/@[^,@\n\s]*$/, '')}${mention}`);
    else setNewTaskReviewer((current) => `${current.replace(/@[^,@\n\s]*$/, '')}${mention}`);
    setActiveMentionField(null);
  };

  const resolveTaggedNames = (tags: string[]) => tags.map((tag) => {
    const user = users.find((candidate) => getUsername(candidate).toLowerCase() === tag.toLowerCase() || candidate.name.toLowerCase() === tag.toLowerCase());
    return user?.name || tag;
  });

  // WhatsApp Share State
  const [waModalObj, setWaModalObj] = useState<{ ref: string; client: string; text: string; phone: string } | null>(null);

  const STAGES_LIST = [
    'Pleading Stage',
    'Interlocutory Application',
    'Case Management / PTCM',
    'Discovery & Inspection',
    'Mediation / Settlement',
    'Trial / Bicara',
    'Written Submissions',
    'Decision / Judgment',
    'Appeal Stage',
    'Execution / Enforcement',
  ];

  // Manually-assigned per-task stage tag options (never inferred by the system)

  const LAWYERS_LIST = [
    'Syafiqah Hamizad',
    'Amer Haiqal',
    'Zulaikha Afendi',
    'Nurul Huda',
    'Aiman Hakim',
    'Intan Safiyah',
  ];

  const filteredCases = (cases || []).filter((cs) => {
    if (matterCaseId && cs.id !== matterCaseId) return false;

    // Role-based visibility: only admins see every matter firm-wide; everyone
    // else only sees matters where they are assigned (lawyer in charge / task assignee).
    if (!matterCaseId && !isAdmin) {
      const userTags = [currentUser?.name, currentUser?.email?.split('@')[0], currentPartnerCode]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const matchesUser = (value?: string) => Boolean(value && userTags.some((tag) => value.toLowerCase().includes(tag)));
      const matchLawyerInCharge = cs.lawyerInCharge ? matchesUser(cs.lawyerInCharge) : false;
      const matchLawyersList = cs.lawyers ? cs.lawyers.some((lawyer) => matchesUser(lawyer)) : false;
      const matchAssignedTask = (cs.tasks || []).some((t) => matchesUser(t.assignedTo) || matchesUser(t.reviewer));
      if (!matchLawyerInCharge && !matchLawyersList && !matchAssignedTask) return false;
    }

    const partnerInCharge = getPartnerInChargeFromRef(cs.ref || '');
    const lawyerInCharge = cs.lawyerInCharge || 'Syafiqah Hamizad';
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (cs.ref || '').toLowerCase().includes(term) ||
      (cs.title || '').toLowerCase().includes(term) ||
      (cs.clientName || '').toLowerCase().includes(term);

    const matchesCategory = selectedCategory === 'ALL' || (cs.practiceArea || cs.type) === selectedCategory;
    const matchesLawyer =
      selectedLawyer === 'ALL' ||
      lawyerInCharge === selectedLawyer ||
      partnerInCharge.includes(selectedLawyer);
    const matchesStage = selectedStage === 'ALL' || cs.stage === selectedStage;

    return matchesSearch && matchesCategory && matchesLawyer && matchesStage;
  });

  // Extract all tasks across filtered cases
  const allCaseActions = filteredCases.flatMap((cs) => {
    return (cs.tasks || []).map((t) => ({
      task: t,
      caseId: cs.id,
      caseRef: cs.ref,
      caseTitle: cs.title,
      clientName: cs.clientName,
      court: cs.court,
      lawyerInCharge: cs.lawyerInCharge || 'Syafiqah Hamizad',
    }));
  });

  const pendingTasks = allCaseActions.filter(
    (item) => item.task.status !== 'In Progress' && item.task.status !== 'In Review' && item.task.status !== 'Under Review' && item.task.status !== 'Completed' && item.task.status !== 'Done'
  );

  const inProgressTasks = allCaseActions.filter(
    (item) => item.task.status === 'In Progress'
  );

  const reviewTasks = allCaseActions.filter(
    (item) => item.task.status === 'In Review' || item.task.status === 'Under Review'
  );

  const completedTasks = allCaseActions.filter(
    (item) => item.task.status === 'Completed' || item.task.status === 'Done'
  );


  // Status Change Handler with Automatic History Logging
  const handleMoveTaskStatus = (
    targetCaseId: string,
    taskId: string,
    newStatus: 'Pending' | 'In Progress' | 'In Review' | 'Completed'
  ) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;

    const currentTask = (cs.tasks || []).find((t) => t.id === taskId);
    if (!currentTask) return;

    const oldStatus = currentTask.status || 'Pending';
    if (oldStatus === newStatus) return;

    const updatedTasks = (cs.tasks || []).map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus as any,
          completedAt: newStatus === 'Completed' ? new Date().toISOString() : t.completedAt,
          lastUpdatedBy: 'Syafiqah Hamizad (Partner)',
          lastUpdatedAt: new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return t;
    });

    updateCase(targetCaseId, { tasks: updatedTasks });

    // Keep the linked calendar deadline entry in step with the task's status
    addDeadline({
      id: `DL-TASK-${taskId}`,
      caseId: targetCaseId,
      title: `Task Due: ${currentTask.title}`,
      type: 'Filing',
      dueDate: currentTask.dueDate,
      priority: currentTask.priority === 'High' ? 'High' : currentTask.priority === 'Low' ? 'Low' : 'Normal',
      status: newStatus === 'Completed' ? 'Completed' : newStatus === 'In Review' ? 'In Review' : 'In Progress',
      reminderDays: 3,
      notes: currentTask.description || 'Auto-synced from Matter Task due date',
      partner: getPartnerInChargeFromRef(cs.ref || '') || cs.lawyerInCharge || '',
      lawyer: currentTask.assignedTo || '',
    });

    if (newStatus === 'In Review' && currentTask.reviewer) {
      currentTask.reviewer.split(',').map((name) => name.trim()).filter(Boolean).forEach((reviewerName) => {
        pushTaggedNotification(
          reviewerName,
          'Task ready for review',
          `task "${currentTask.title}" for ${cs.ref} is ready for your review.`,
          targetCaseId,
        );
      });
    }

    // Automatic Audit Trail History Logging
    const nowStr = new Date().toLocaleString('en-MY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newLog: ActionHistoryLog = {
      id: `LOG-${Date.now()}`,
      timestamp: nowStr,
      taskTitle: currentTask.title,
      caseRef: cs.ref,
      caseTitle: cs.title,
      fromStatus: oldStatus,
      toStatus: newStatus,
      updatedBy: 'Syafiqah Hamizad (Partner)',
    };

    setActionHistoryLogs((prev) => [newLog, ...prev]);
    showToast(`Updated action status to '${newStatus}' & logged in audit history.`);
  };

  // Manual stage tag: set purely by the user, never inferred/changed automatically by the system
  const handleSetTaskStageTag = (targetCaseId: string, taskId: string, stageTag: string) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;
    const updatedTasks = (cs.tasks || []).map((t) => (t.id === taskId ? { ...t, stageTag } : t));
    updateCase(targetCaseId, { tasks: updatedTasks });
    showToast(`Tagged stage as "${stageTag}"`);
  };

  // Drag and Drop Events
  const handleDragStart = (e: React.DragEvent, caseId: string, taskId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ caseId, taskId }));
  };

  const handleDragOver = (e: React.DragEvent, colName: string) => {
    e.preventDefault();
    if (dragOverColumn !== colName) {
      setDragOverColumn(colName);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: 'Pending' | 'In Progress' | 'In Review' | 'Completed') => {
    e.preventDefault();
    setDragOverColumn(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { caseId, taskId } = JSON.parse(dataStr);
      handleMoveTaskStatus(caseId, taskId, targetStatus);
    } catch (err) {
      console.error('Drag and drop parse error', err);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskAssignee(task.assignedTo ? task.assignedTo.split(',').map((name) => `@${name.trim()}`).join(' ') : '');
    setNewTaskReviewer(task.reviewer ? task.reviewer.split(',').map((name) => `@${name.trim()}`).join(' ') : '');
    setNewTaskNotes(task.notes || task.description || '');
    setNewTaskChecklist((task.checklist || []).map((item) => item.title).join('\n'));
    setNewTaskDueDate(task.dueDate);
    setNewTaskPriority(task.priority);
    setIsAddActionOpen(true);
  };

  const handleDeleteTask = (targetCaseId: string, taskId: string, taskTitle: string) => {
    const cs = cases.find((c) => c.id === targetCaseId);
    if (!cs) return;

    const confirmed = window.confirm(`Delete task "${taskTitle}" from ${cs.ref}? This cannot be undone.`);
    if (!confirmed) return;

    const updatedTasks = (cs.tasks || []).filter((task) => task.id !== taskId);
    updateCase(targetCaseId, { tasks: updatedTasks });
    showToast(`Task deleted: ${taskTitle}`);
  };

  const handleOpenNewTaskForm = () => {
    setEditingTaskId(null);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskReviewer('');
    setNewTaskNotes('');
    setNewTaskChecklist('');
    setNewTaskDueDate(new Date().toISOString().slice(0, 10));
    setNewTaskPriority('High');
    setIsAddActionOpen(true);
  };

  const handleCreateNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCaseId = matterCaseId || newTaskCaseId;
    if (!newTaskTitle.trim() || !targetCaseId) return;
    
    const targetCase = cases.find((c) => c.id === targetCaseId);
    if (!targetCase) return;

    const taggedAssignees = resolveTaggedNames(parseTaggedNames(newTaskAssignee));
    const taggedReviewers = resolveTaggedNames(parseTaggedNames(newTaskReviewer));

    const existingTask = editingTaskId ? (targetCase.tasks || []).find((task) => task.id === editingTaskId) : undefined;
    const createdTask: Task = {
      id: existingTask?.id || `TASK-${Date.now()}`,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      status: existingTask?.status || 'Pending',
      dueDate: newTaskDueDate,
      assignedTo: taggedAssignees.join(', '),
      taskType: 'Action Item',
      description: newTaskNotes.trim(),
      notes: newTaskNotes.trim(),
      checklist: newTaskChecklist.split('\n').map((title) => title.trim()).filter(Boolean).map((title, index) => ({
        id: existingTask?.checklist?.[index]?.id || `CK-${Date.now()}-${index}`,
        title,
        completed: existingTask?.checklist?.[index]?.completed || false,
        completedBy: existingTask?.checklist?.[index]?.completedBy,
        completedAt: existingTask?.checklist?.[index]?.completedAt,
      })),
      reviewer: taggedReviewers.length > 0 ? taggedReviewers.join(', ') : undefined,
      reviewStatus: taggedReviewers.length > 0 ? 'Needs Review' : undefined,
    };

    const updatedTasks = existingTask
      ? (targetCase.tasks || []).map((task) => task.id === existingTask.id ? createdTask : task)
      : [...(targetCase.tasks || []), createdTask];
    updateCase(targetCaseId, { tasks: updatedTasks });

    // Sync task deadline to the firm calendar/statutory deadlines register
    addDeadline({
      id: `DL-TASK-${createdTask.id}`,
      caseId: targetCaseId,
      title: `Task Due: ${createdTask.title}`,
      type: 'Filing',
      dueDate: createdTask.dueDate,
      priority: createdTask.priority === 'High' ? 'High' : createdTask.priority === 'Low' ? 'Low' : 'Normal',
      status: createdTask.status === 'Completed' ? 'Completed' : 'In Progress',
      reminderDays: 3,
      notes: createdTask.description || 'Auto-synced from Matter Task due date',
      partner: getPartnerInChargeFromRef(targetCase.ref || '') || targetCase.lawyerInCharge || '',
      lawyer: createdTask.assignedTo || '',
    });

    // History Log
    const newLog: ActionHistoryLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-MY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      taskTitle: newTaskTitle.trim(),
      caseRef: targetCase.ref,
      caseTitle: targetCase.title,
      fromStatus: 'Created',
      toStatus: 'Pending',
      updatedBy: 'Syafiqah Hamizad (Partner)',
    };

    setActionHistoryLogs((prev) => [newLog, ...prev]);

    setIsAddActionOpen(false);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskReviewer('');
    setNewTaskNotes('');
    setNewTaskChecklist('');
    setEditingTaskId(null);
    taggedAssignees.forEach((assignee) => {
      pushTaggedNotification(
        assignee,
        'Matter task assigned',
        `you were assigned "${createdTask.title}" for ${targetCase.ref}.`,
        targetCase.id,
      );
    });
    taggedReviewers.forEach((reviewer) => {
      pushTaggedNotification(
        reviewer,
        'Reviewer tagged',
        `you were tagged as reviewer for "${createdTask.title}" in ${targetCase.ref}.`,
        targetCase.id,
      );
    });
    
    // Show success toast
    showToast(`${existingTask ? 'Task updated' : 'Task created'} for ${targetCase.ref}${taggedAssignees.length ? `. Assigned to ${taggedAssignees.join(', ')}` : '. Unassigned'}.`);
  };

  // Manual stage tag: a free-text chip typed in by the user, purely custom and never inferred by the system
  const renderStageTagPicker = (task: Task, caseId: string) => {
    if (editingStageTagTaskId === task.id) {
      return (
        <input
          type="text"
          autoFocus
          value={stageTagDraft}
          placeholder="Type custom tag..."
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setStageTagDraft(e.target.value)}
          onBlur={() => {
            handleSetTaskStageTag(caseId, task.id, stageTagDraft.trim());
            setEditingStageTagTaskId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSetTaskStageTag(caseId, task.id, stageTagDraft.trim());
              setEditingStageTagTaskId(null);
            }
            if (e.key === 'Escape') setEditingStageTagTaskId(null);
          }}
          className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded border bg-white text-[#6B3D8C] border-[#6B3D8C] w-28 outline-none"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setStageTagDraft(task.stageTag || '');
          setEditingStageTagTaskId(task.id);
        }}
        className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded border bg-[#F1EBF6] text-[#6B3D8C] border-[#F1EBF6] cursor-pointer hover:bg-[#F1EBF6]"
        title="Click to type a custom stage tag"
      >
        {task.stageTag ? task.stageTag : '+ Tag Stage'}
      </button>
    );
  };


  const renderTaskChecklist = (task: Task, caseId: string) => {
    if (!task.checklist?.length) return null;
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-slate-600">Checklist</span>
          <span className="text-[10px] font-bold text-[#2F6F4E]">{task.checklist.filter((item) => item.completed).length}/{task.checklist.length} done</span>
        </div>
        <div className="space-y-1.5">
          {task.checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition group"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {
                  const targetCase = cases.find((cs) => cs.id === caseId);
                  if (!targetCase) return;
                  const actor = currentUser?.name || 'System User';
                  const doneAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
                  updateCase(caseId, {
                    tasks: (targetCase.tasks || []).map((currentTask) =>
                      currentTask.id === task.id
                        ? {
                            ...currentTask,
                            checklist: (currentTask.checklist || []).map((checkItem) =>
                              checkItem.id === item.id
                                ? {
                                    ...checkItem,
                                    completed: !checkItem.completed,
                                    completedBy: !checkItem.completed ? actor : undefined,
                                    completedAt: !checkItem.completed ? doneAt : undefined,
                                  }
                                : checkItem
                            ),
                          }
                        : currentTask
                    ),
                  });
                }}
                className="mt-1 w-4 h-4 rounded border-2 border-slate-300 cursor-pointer accent-emerald-600 group-hover:border-[#2F6F4E] transition"
              />
              <div className="flex-1">
                <span className={`text-[10px] font-medium block ${
                  item.completed ? 'line-through text-slate-400' : 'text-slate-700'
                }`}>
                  {item.title}
                </span>
                {item.completedBy && item.completedAt && (
                  <span className="text-[8px] text-[#2F6F4E] font-medium block mt-0.5">✓ {item.completedBy} · {item.completedAt}</span>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs pb-10">
      {/* Header Banner & Mode Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#8A6D3B] text-[#16223A] font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
              Interactive Kanban &amp; Status Matrix
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Drag &amp; Drop Enabled</span>
          </div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#3D6B9C]" />
            Firm-Wide Case Actions &amp; Kanban Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag case actions between columns, trigger automatic status updates, and view audit history logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewLayout('kanban')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'kanban'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-[#8A6D3B]" />
              <span>Kanban Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'table'
                  ? 'bg-[#16223A] text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5 text-[#8A6D3B]" />
              <span>Table Matrix</span>
            </button>
          </div>

          {/* History Modal Trigger Button */}
          <button
            type="button"
            onClick={() => setHistoryModalOpen(true)}
            className="bg-[#FBF2E9] hover:bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <History className="w-3.5 h-3.5 text-[#8A6D3B]" />
            <span>Action History Log ({actionHistoryLogs.length})</span>
          </button>

          {/* New Action Item Button */}
          <button
            type="button"
            onClick={() => handleOpenNewTaskForm()}
            className="bg-[#16223A] hover:bg-[#16223A] text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#8A6D3B]" />
            <span>Add Case Action</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      {!matterCaseId && (
      <div className="bg-white border border-[#DDE3EB] p-3 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search Ref, Title, or Client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-[#3D6B9C]"
            />
            <Activity className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Practice Areas</option>
            <option value="Litigation">Litigation</option>
            <option value="Conveyancing">Conveyancing</option>
            <option value="Corporate">Corporate</option>
            <option value="Syariah">Syariah</option>
            <option value="Advisory">Advisory</option>
          </select>

          {/* Filter Lawyer in Charge */}
          <select
            value={selectedLawyer}
            onChange={(e) => setSelectedLawyer(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Lawyers in Charge</option>
            {LAWYERS_LIST.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Filter Stage */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs"
          >
            <option value="ALL">All Case Stages</option>
            {STAGES_LIST.map((stg) => (
              <option key={stg} value={stg}>
                {stg}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
          Total Actions: {allCaseActions.length} | Pending: {pendingTasks.length} | Active: {inProgressTasks.length} | Done: {completedTasks.length}
        </div>
      </div>
      )}

      {matterCaseId && (
        <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block">
          Task: {pendingTasks.length} | Active: {inProgressTasks.length} | Done: {completedTasks.length}
        </div>
      )}

      {/* ================= LAYOUT 1: KANBAN BOARD ================= */}
      {viewLayout === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[600px] items-start">
          {/* COLUMN 1: PENDING */}
          <div
            onDragOver={(e) => handleDragOver(e, 'Pending')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Pending')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'Pending'
                ? 'border-[#8A6D3B] bg-[#FBF2E9]/50 ring-2 ring-amber-300'
                : 'border-[#DDE3EB]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8A6D3B] inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ⏳ Task
                </h3>
              </div>
              <span className="bg-[#8A6D3B] text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {pendingTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Task Here
                </div>
              ) : (
                pendingTasks.map(({ task, caseId, caseRef, caseTitle }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-[#DDE3EB] hover:border-[#3D6B9C] rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-[#8A6D3B] bg-[#FBF2E9] px-1.5 py-0.5 rounded border border-[#FBF2E9]">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]'
                              : 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCaseSubTab('tasks');
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-[#8A6D3B] hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                                <div className="text-[10.5px] text-slate-500 font-medium truncate">
                                  Matter: <strong className="text-slate-800">{caseTitle}</strong>
                                </div>
                                {task.status === 'In Review' && (
                                  <div className="bg-[#F1EBF6] border border-[#F1EBF6] rounded-md px-2 py-1.5 text-[10px] text-[#6B3D8C] font-bold">
                                    Review ready{task.reviewer ? ` • Reviewer: ${task.reviewer}` : ' • Reviewer not assigned'}
                                  </div>
                                )}
                                {renderTaskChecklist(task, caseId)}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-[#B23A2E] font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-[#FBF2E9] hover:bg-[#FBF2E9] text-[#8A6D3B] font-bold rounded text-[9.5px] border border-[#FBF2E9] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-[#FBEDE9] hover:bg-[#FBEDE9] text-[#B23A2E] font-bold rounded text-[9.5px] border border-[#FBEDE9] cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-[#E7EEF6] hover:bg-[#E7EEF6] text-[#3D6B9C] font-bold rounded text-[9.5px] border border-[#E7EEF6] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Start ⚡</span>
                        <ArrowRight className="w-2.5 h-2.5 text-[#3D6B9C]" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div
            onDragOver={(e) => handleDragOver(e, 'In Progress')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'In Progress')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'In Progress'
                ? 'border-[#3D6B9C] bg-[#E7EEF6]/50 ring-2 ring-blue-300'
                : 'border-[#DDE3EB]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3D6B9C] inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ⚡ In Progress / Active
                </h3>
              </div>
              <span className="bg-[#3D6B9C] text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {inProgressTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {inProgressTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Active Actions Here
                </div>
              ) : (
                inProgressTasks.map(({ task, caseId, caseRef, caseTitle }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-[#DDE3EB] hover:border-[#3D6B9C] rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-[#3D6B9C] bg-[#E7EEF6] px-1.5 py-0.5 rounded border border-[#E7EEF6]">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]'
                              : 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCaseSubTab('tasks');
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-[#3D6B9C] hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-[#B23A2E] font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-[#FBF2E9] hover:bg-[#FBF2E9] text-[#8A6D3B] font-bold rounded text-[9.5px] border border-[#FBF2E9] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-[#FBEDE9] hover:bg-[#FBEDE9] text-[#B23A2E] font-bold rounded text-[9.5px] border border-[#FBEDE9] cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'Pending')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ← Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Review')}
                        className="px-2 py-0.5 bg-[#6B3D8C] hover:bg-[#6B3D8C] text-white font-bold rounded text-[9.5px] flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Send for Review 🔍</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: IN REVIEW */}
          <div
            onDragOver={(e) => handleDragOver(e, 'In Review')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'In Review')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'In Review'
                ? 'border-[#6B3D8C] bg-[#F1EBF6]/50 ring-2 ring-purple-300'
                : 'border-[#DDE3EB]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6B3D8C] inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  🔍 In Review
                </h3>
              </div>
              <span className="bg-[#6B3D8C] text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {reviewTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {reviewTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Actions Awaiting Review Here
                </div>
              ) : (
                reviewTasks.map(({ task, caseId, caseRef, caseTitle }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-white border border-[#F1EBF6] hover:border-[#6B3D8C] rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-[#6B3D8C] bg-[#F1EBF6] px-1.5 py-0.5 rounded border border-[#F1EBF6]">
                          {caseRef}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            task.priority === 'High'
                              ? 'bg-[#FBEDE9] text-[#B23A2E] border border-[#B23A2E]'
                              : 'bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B]'
                          }`}
                        >
                          {task.priority || 'Medium'} Priority
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCaseSubTab('tasks');
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-[#16223A] hover:text-[#6B3D8C] hover:underline block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="bg-[#F1EBF6] border border-[#F1EBF6] rounded-md px-2 py-1.5 text-[10px] text-[#6B3D8C] font-bold">
                      Reviewer: {task.reviewer || 'Not assigned'}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong className="text-[#16223A]">{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-[#B23A2E] font-mono font-bold">Due: {task.dueDate}</span>
                    </div>

                    {/* Quick Move Buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-[#FBF2E9] hover:bg-[#FBF2E9] text-[#8A6D3B] font-bold rounded text-[9.5px] border border-[#FBF2E9] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-[#FBEDE9] hover:bg-[#FBEDE9] text-[#B23A2E] font-bold rounded text-[9.5px] border border-[#FBEDE9] cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ← In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'Completed')}
                        className="px-2 py-0.5 bg-[#2F6F4E] hover:bg-[#2F6F4E] text-white font-bold rounded text-[9.5px] flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Approve ✓</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 4: COMPLETED */}
          <div
            onDragOver={(e) => handleDragOver(e, 'Completed')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Completed')}
            className={`bg-slate-100/90 border rounded-xl p-3 flex flex-col gap-3 min-h-[550px] transition-all ${
              dragOverColumn === 'Completed'
                ? 'border-[#2F6F4E] bg-[#E6EFE9]/50 ring-2 ring-emerald-300'
                : 'border-[#DDE3EB]'
            }`}
          >
            {/* Column Header */}
            <div className="bg-[#16223A] text-white p-3 rounded-lg flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2F6F4E] inline-block" />
                <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-white">
                  ✅ Completed / Scratched
                </h3>
              </div>
              <span className="bg-[#2F6F4E] text-[#16223A] font-extrabold text-[10.5px] px-2 py-0.5 rounded-full">
                {completedTasks.length}
              </span>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3 flex-1">
              {completedTasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">
                  Drop Completed Actions Here
                </div>
              ) : (
                completedTasks.map(({ task, caseId, caseRef, caseTitle }) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, caseId, task.id)}
                    className="bg-[#E6EFE9]/40 border border-[#E6EFE9] hover:border-[#2F6F4E] rounded-xl p-3 shadow-xs space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[10px] text-[#2F6F4E] bg-[#E6EFE9] px-1.5 py-0.5 rounded border border-[#2F6F4E]">
                          {caseRef}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#E6EFE9] text-[#2F6F4E] uppercase">
                          ✓ Done
                        </span>
                        {renderStageTagPicker(task, caseId)}
                      </div>

                      <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCaseSubTab('tasks');
                        setCurrentCaseId(caseId);
                        setCurrentView('cases');
                      }}
                      className="font-serif font-bold text-xs text-slate-600 line-through hover:text-[#2F6F4E] block leading-snug"
                    >
                      {task.title}
                    </a>

                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      Matter: <strong className="text-slate-800">{caseTitle}</strong>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E6EFE9] text-[10px]">
                      <span className="text-slate-600 font-semibold">
                        PIC: <strong>{task.assignedTo || 'Unassigned'}</strong>
                      </span>
                      <span className="text-[#2F6F4E] font-mono font-bold">Done Date: {task.dueDate}</span>
                    </div>

                    {/* Reopen Action Button */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-0.5 bg-[#FBF2E9] hover:bg-[#FBF2E9] text-[#8A6D3B] font-bold rounded text-[9.5px] border border-[#FBF2E9] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(caseId, task.id, task.title)}
                        className="px-2 py-0.5 bg-[#FBEDE9] hover:bg-[#FBEDE9] text-[#B23A2E] font-bold rounded text-[9.5px] border border-[#FBEDE9] cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTaskStatus(caseId, task.id, 'In Progress')}
                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded text-[9.5px] cursor-pointer"
                      >
                        ↩ Reopen Action
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= LAYOUT 2: TABLE MATRIX ================= */}
      {viewLayout === 'table' && (
        <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
                  <th className="p-3 border-r border-[#16223A] w-[220px]">Matter Ref &amp; File Title</th>
                  <th className="p-3 border-r border-[#16223A] w-[210px]">Partners &amp; Lawyers In Charge</th>
                  <th className="p-3 border-r border-[#16223A] min-w-[280px]">Current Action</th>
                  <th className="p-3 border-r border-[#16223A] min-w-[260px]">Current Status</th>
                  <th className="p-3 border-r border-[#16223A] min-w-[240px]">Next Action</th>
                  <th className="p-3 text-center w-[160px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCases.map((cs) => {
                  const partnerInCharge = getPartnerInChargeFromRef(cs.ref);
                  const assignedLawyersList = cs.lawyerInCharge
                    ? cs.lawyerInCharge.split(',').map((s) => s.trim())
                    : ['Syafiqah Hamizad'];

                  return (
                    <tr key={cs.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Ref & Title */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="ref-seal font-mono text-[10.5px]">{cs.ref}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-[#E7EEF6] text-[#3D6B9C] border border-[#E7EEF6]">
                            {cs.practiceArea || cs.type}
                          </span>
                        </div>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCaseSubTab('status');
                            setCurrentCaseId(cs.id);
                            setCurrentView('cases');
                          }}
                          className="font-serif font-bold text-sm text-[#16223A] hover:text-[#8A6D3B] hover:underline block mt-1"
                        >
                          {cs.title}
                        </a>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Client: <strong className="text-slate-800">{cs.clientName}</strong>
                        </div>
                      </td>

                      {/* 2. Partners & Multiple Lawyers In Charge */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <div>
                          <span className="font-bold text-slate-400 uppercase text-[9px] block">Partner(s) In Charge</span>
                          <span className="font-bold text-[#8A6D3B] text-[10.5px] bg-[#FBF2E9] px-2 py-0.5 rounded border border-[#FBF2E9] inline-block mt-0.5">
                            {partnerInCharge}
                          </span>
                        </div>

                        <div>
                          <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">Assigned Lawyers</span>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {assignedLawyersList.map((lawyer, lIdx) => (
                              <span
                                key={lIdx}
                                className="px-2 py-0.5 bg-[#E7EEF6] text-[#3D6B9C] font-bold text-[10px] rounded border border-[#E7EEF6] flex items-center gap-1"
                              >
                                <span>{lawyer}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* 3. Current Action: task list with manual stage tag & status toggle */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <div className="space-y-1.5">
                          {(cs.tasks || []).length === 0 ? (
                            <div className="text-slate-400 italic text-[11px]">No action items yet</div>
                          ) : (
                            (cs.tasks || []).map((t) => (
                              <div
                                key={t.id}
                                className="bg-slate-50 p-2 rounded border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div>
                                  <div className="font-bold text-[#16223A]">{t.title}</div>
                                  <div className="text-[10px] text-slate-500">
                                    PIC: {t.assignedTo} | Due: {t.dueDate}
                                  </div>
                                  {renderStageTagPicker(t, cs.id)}
                                </div>
                                <select
                                  value={t.status === 'Completed' ? 'Completed' : t.status === 'In Review' || t.status === 'Under Review' ? 'In Review' : t.status === 'In Progress' ? 'In Progress' : 'Pending'}
                                  onChange={(e) =>
                                    handleMoveTaskStatus(
                                      cs.id,
                                      t.id,
                                      e.target.value as 'Pending' | 'In Progress' | 'In Review' | 'Completed'
                                    )
                                  }
                                  className="text-[10.5px] font-bold p-1 rounded border border-slate-300 bg-white"
                                >
                                  <option value="Pending">⏳ Pending</option>
                                  <option value="In Progress">⚡ In Progress</option>
                                  <option value="In Review">🔍 In Review</option>
                                  <option value="Completed">✅ Completed</option>
                                </select>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* 4. Current Status (notes) */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <textarea
                          rows={3}
                          value={cs.notes || 'Pleadings closed. Preparing affidavit in support.'}
                          onChange={(e) => updateCase(cs.id, { notes: e.target.value })}
                          className="w-full p-2 bg-[#FBF2E9]/50 border border-[#FBF2E9] rounded text-xs font-sans text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#3D6B9C]"
                        />
                      </td>

                      {/* 5. Next Action */}
                      <td className="p-3 border-r border-slate-200 align-top space-y-2">
                        <textarea
                          rows={3}
                          value={cs.nextAction || ''}
                          placeholder="e.g. Fix Pre-Trial Case Management & submit bundle of documents"
                          onChange={(e) => updateCase(cs.id, { nextAction: e.target.value })}
                          className="w-full p-2 bg-[#E7EEF6]/40 border border-[#E7EEF6] rounded text-xs font-sans text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-400"
                        />
                      </td>

                      {/* 6. Action: push the current status & next action to the client, and sync it to their Client Portal log */}
                      <td className="p-3 align-top text-center space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            const waText = `Salam & Good day, ${cs.clientName}. Weekly status update for matter [${cs.ref}]:\n\nCurrent Status: ${cs.notes || 'In progress'}\nNext Action: ${cs.nextAction || 'To be advised'}\nAssigned Lawyers: ${cs.lawyerInCharge || 'To be advised'}\n\nMessrs Syafiqah Hamizad & Co`;
                            setWaModalObj({
                              ref: cs.ref,
                              client: cs.clientName,
                              text: waText,
                              phone: '+60123456789',
                            });
                            addCaseActivityLog(cs.id, {
                              title: 'Client Status Update Sent (WhatsApp)',
                              description: `Current Status: ${cs.notes || 'In progress'} | Next Action: ${cs.nextAction || 'To be advised'}`,
                              type: 'Status Update',
                              actor: currentUser?.name || 'Firm',
                              badgeColor: 'bg-[#E6EFE9] text-[#2F6F4E]',
                            });
                          }}
                          className="w-full bg-[#2F6F4E] hover:bg-[#2F6F4E] text-white font-bold text-[10.5px] py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>Send WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const subject = `Case Status Update: ${cs.title} [${cs.ref}]`;
                            const body = `Dear ${cs.clientName || 'Valued Client'},\n\nCurrent Status: ${cs.notes || 'In progress'}\nNext Action: ${cs.nextAction || 'To be advised'}\nAssigned Lawyers: ${cs.lawyerInCharge || 'To be advised'}\n\nThank you for trusting Messrs Syafiqah Hamizad & Co.`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            addCaseActivityLog(cs.id, {
                              title: 'Client Status Update Sent (Email)',
                              description: `Current Status: ${cs.notes || 'In progress'} | Next Action: ${cs.nextAction || 'To be advised'}`,
                              type: 'Status Update',
                              actor: currentUser?.name || 'Firm',
                              badgeColor: 'bg-[#E7EEF6] text-[#3D6B9C]',
                            });
                            showToast(`Client update logged to Case Status Log for ${cs.ref}`);
                          }}
                          className="w-full bg-[#16223A] hover:bg-[#16223A] text-white font-bold text-[10.5px] py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>Send Email</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= ACTION HISTORY AUDIT LOG MODAL ================= */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-[#DDE3EB] space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                  <History className="w-5 h-5 text-[#3D6B9C]" />
                  Action History &amp; Status Movement Audit Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Automated chronological audit log for all Kanban status transitions across firm matters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Audit Table */}
            <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#16223A] text-white uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Action Item Title</th>
                    <th className="p-2.5">Matter Ref &amp; Case Title</th>
                    <th className="p-2.5">Status Transition</th>
                    <th className="p-2.5">Updated By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actionHistoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No history records found yet. Drag items in Kanban board to log history.
                      </td>
                    </tr>
                  ) : (
                    actionHistoryLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FBF2E9]/50 transition-colors">
                        <td className="p-2.5 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="p-2.5 font-bold text-[#16223A]">{log.taskTitle}</td>
                        <td className="p-2.5">
                          <div className="font-mono text-[#8A6D3B] font-bold text-[10.5px]">{log.caseRef}</div>
                          <div className="text-slate-500 text-[10px] truncate max-w-[180px]">{log.caseTitle}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                              {log.fromStatus}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="px-1.5 py-0.2 bg-[#E6EFE9] text-[#2F6F4E] rounded text-[10px] font-extrabold">
                              {log.toStatus}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700">{log.updatedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const csvContent =
                    'Timestamp,Task Title,Case Ref,From Status,To Status,Updated By\n' +
                    actionHistoryLogs
                      .map(
                        (l) =>
                          `"${l.timestamp}","${l.taskTitle}","${l.caseRef}","${l.fromStatus}","${l.toStatus}","${l.updatedBy}"`
                      )
                      .join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Action_History_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Exported Action History Audit Log to CSV');
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export Audit CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 bg-[#16223A] text-white rounded-md font-semibold cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD NEW ACTION ITEM MODAL ================= */}
      {isAddActionOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-[#FBF2E9]">
            <div className="bg-white px-7 py-6 border-b border-[#DDE3EB] sticky top-0 z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#3D6B9C] font-extrabold mb-1">Matter Workflow</p>
                  <h3 className="font-serif text-xl font-bold text-[#16223A] flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#3D6B9C]" />
                    {editingTaskId ? 'Edit Case Action Item' : 'Create New Case Action Item'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Assign the work, add context, and define the finish line.</p>
                </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#F6F8FA] border border-[#DDE3EB] text-[10px] font-bold text-[#3D6B9C]">{editingTaskId ? 'EDIT TASK' : 'NEW TASK'}</span>
              </div>
            </div>
            <form onSubmit={handleCreateNewTask} className="space-y-3 text-xs">
              {!matterCaseId && <div className="px-7 pt-5">
                <label className="font-bold text-slate-700 block uppercase mb-2">Select Legal Matter File</label>
                <select
                  value={newTaskCaseId}
                  onChange={(e) => setNewTaskCaseId(e.target.value)}
                  className="w-full font-bold p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition cursor-pointer"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.ref}] {c.title}
                    </option>
                  ))}
                </select>
              </div>}

              <div className="px-7 pt-5">
                <label className="font-bold text-slate-700 block uppercase mb-2">Action Title / Instruction</label>
                <textarea
                  required
                  placeholder="e.g. Draft Affidavit in Support, File Notice of Appeal..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  rows={3}
                  className="w-full min-h-28 font-bold p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition text-base leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 px-7">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-2">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition cursor-pointer"
                  >
                    <option value="High">🔴 High Priority</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🟢 Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-2">Target Due Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl font-mono font-bold shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition"
                  />
                </div>
              </div>

              <div className="relative px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Assignee(s)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder="Type manually: @Syafiqah Hamizad, @Amer Haiqal"
                    onFocus={() => setActiveMentionField('assignee')}
                    className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition"
                  />
                  {/* Display selected assignees as colored badges */}
                  {parseTaggedNames(newTaskAssignee).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 pb-1">
                      {resolveTaggedNames(parseTaggedNames(newTaskAssignee)).map((assignee, index) => (
                        <div
                          key={`${assignee}-${index}`}
                          className={`${getColorForAssignee(assignee, index)} text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md`}
                        >
                          ✓ {assignee}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {activeMentionField === 'assignee' && newTaskAssignee.includes('@') && mentionSuggestions(newTaskAssignee).length > 0 && (
                  <div className="absolute left-7 right-7 top-full mt-1 z-20 bg-white border border-[#FBF2E9] rounded-xl shadow-xl overflow-hidden">
                    {mentionSuggestions(newTaskAssignee).map((user) => (
                      <button type="button" key={user.id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectMention('assignee', user)} className="w-full px-3 py-2 text-left hover:bg-[#F6F8FA] flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-[#16223A]">@{getUsername(user)}</span><span className="text-[10px] text-slate-500">{user.name} · {user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Reviewer(s)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTaskReviewer}
                    onChange={(e) => setNewTaskReviewer(e.target.value)}
                    placeholder="Type manually: @Reviewer Name"
                    onFocus={() => setActiveMentionField('reviewer')}
                    className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl font-bold shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition"
                  />
                  {/* Display selected reviewers as colored badges */}
                  {parseTaggedNames(newTaskReviewer).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 pb-1">
                      {resolveTaggedNames(parseTaggedNames(newTaskReviewer)).map((reviewer, index) => (
                        <div
                          key={`${reviewer}-${index}`}
                          className={`${getColorForAssignee(reviewer, index)} text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md`}
                        >
                          ✓ {reviewer}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {activeMentionField === 'reviewer' && newTaskReviewer.includes('@') && mentionSuggestions(newTaskReviewer).length > 0 && (
                  <div className="absolute left-7 right-7 top-full mt-1 z-20 bg-white border border-[#FBF2E9] rounded-xl shadow-xl overflow-hidden">
                    {mentionSuggestions(newTaskReviewer).map((user) => (
                      <button type="button" key={user.id} onMouseDown={(e) => e.preventDefault()} onClick={() => selectMention('reviewer', user)} className="w-full px-3 py-2 text-left hover:bg-[#F6F8FA] flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-[#16223A]">@{getUsername(user)}</span><span className="text-[10px] text-slate-500">{user.name} · {user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Notes / Instructions <span className="text-slate-400 text-[11px] font-normal">(Optional)</span></label>
                <textarea 
                  rows={5} 
                  value={newTaskNotes} 
                  onChange={(e) => setNewTaskNotes(e.target.value)} 
                  placeholder="Explain the work, expected output, documents, and completion criteria." 
                  className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition resize-none"
                />
              </div>

              <div className="px-7">
                <label className="font-bold text-slate-700 block uppercase mb-2">Task Checklist <span className="text-slate-400 text-[11px] font-normal">(Optional)</span></label>
                <textarea 
                  rows={5} 
                  value={newTaskChecklist} 
                  onChange={(e) => setNewTaskChecklist(e.target.value)} 
                  placeholder={'One task per line\nReview source documents\nPrepare draft\nSubmit for review'} 
                  className="w-full p-3 bg-gradient-to-br from-[#F6F8FA] to-[#F6F8FA] border-2 border-[#FBF2E9] rounded-xl shadow-sm focus:ring-2 focus:ring-[#3D6B9C]/20 transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 px-7 pb-7 border-t border-[#DDE3EB]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddActionOpen(false);
                    setEditingTaskId(null);
                    setNewTaskTitle('');
                    setNewTaskAssignee('');
                    setNewTaskReviewer('');
                    setNewTaskNotes('');
                    setNewTaskChecklist('');
                  }}
                  className="px-4 py-2.5 border-2 border-[#DDE3EB] text-slate-700 rounded-lg font-semibold cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#16223A] to-[#16223A] hover:from-[#16223A] hover:to-[#16223A] text-white rounded-lg font-bold cursor-pointer shadow-lg transition transform hover:scale-105"
                >
                  {editingTaskId ? 'Save Changes' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {waModalObj && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#DDE3EB]">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-serif font-bold text-base text-[#16223A]">Client Weekly Update (WhatsApp)</h3>
              <button onClick={() => setWaModalObj(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Generated Client Update Message:</label>
              <textarea
                rows={5}
                value={waModalObj.text}
                onChange={(e) => setWaModalObj({ ...waModalObj, text: e.target.value })}
                className="w-full text-xs font-sans p-2 border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWaModalObj(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(waModalObj.text)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showToast('Opened WhatsApp web client update window');
                  setWaModalObj(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-[#2F6F4E] hover:bg-[#2F6F4E] text-white rounded flex items-center gap-1.5"
              >
                <span>Send via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


/* ================= 6. DEADLINES VIEW ================= */
export const DeadlinesView: React.FC = () => {
  const { deadlines, cases, setCurrentCaseId, setCurrentView, setCaseSubTab } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Flag className="w-5 h-5 text-[#B23A2E]" />
          Statutory Limitations &amp; Court Filing Deadlines
        </h2>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Matter Ref</th>
              <th className="p-3 font-bold">Title</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Due Date</th>
              <th className="p-3 font-bold">Countdown</th>
              <th className="p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deadlines.map((d) => {
              const cs = cases.find((c) => c.id === d.caseId);
              const days = Math.round((new Date(d.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000);

              return (
                <tr
                  key={d.id}
                  onClick={() => {
                    if (cs) {
                      setCaseSubTab('tasks');
                      setCurrentCaseId(cs.id);
                      setCurrentView('cases');
                    }
                  }}
                  className="hover:bg-[#F6F8FA] cursor-pointer"
                >
                  <td className="p-3">
                    <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                  </td>
                  <td className="p-3 font-bold text-[#16223A]">{d.title}</td>
                  <td className="p-3 font-semibold text-[#6B3D8C]">{d.type}</td>
                  <td className="p-3 font-mono">{d.dueDate}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        days < 0
                          ? 'bg-[#FBEDE9] text-[#B23A2E]'
                          : days <= 7
                          ? 'bg-[#FBF2E9] text-[#8A6D3B]'
                          : 'bg-[#E6EFE9] text-[#2F6F4E]'
                      }`}
                    >
                      {days < 0 ? `Overdue ${Math.abs(days)}d` : `${days}d remaining`}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-[#E7EEF6] text-[#3D6B9C] rounded text-[10px] font-bold">
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 8. REFERRAL VIEW ================= */
export const ReferralView: React.FC = () => {
  const { referralPartners = [], cases = [], addReferralPartner } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refName, setRefName] = useState('');
  const [refType, setRefType] = useState<'External' | 'Partner' | 'Internal Staff'>('External');
  const [refContact, setRefContact] = useState('');
  const [refCommType, setRefCommType] = useState<'Percentage' | 'Flat' | 'None'>('Percentage');
  const [refCommVal, setRefCommVal] = useState('10');
  const [refAmountOwed, setRefAmountOwed] = useState('0');
  const [refPayStatus, setRefPayStatus] = useState<'Paid' | 'Owing' | 'N/A'>('Owing');
  const [refNotes, setRefNotes] = useState('');

  const matterCounts: Record<string, number> = {};
  (cases || []).forEach((cs) => {
    if (cs.referredBy) matterCounts[cs.referredBy] = (matterCounts[cs.referredBy] || 0) + 1;
  });

  const handleSaveReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName.trim()) return;

    addReferralPartner({
      id: `REF-${Date.now()}`,
      name: refName.trim(),
      type: refType,
      contact: refContact,
      commissionType: refCommType,
      commissionValue: parseFloat(refCommVal) || 0,
      amountOwed: parseFloat(refAmountOwed) || 0,
      paymentStatus: refPayStatus,
      lastPaymentDate: new Date().toISOString().slice(0, 10),
      notes: refNotes,
      active: true,
    });

    setIsModalOpen(false);
    setRefName('');
    setRefContact('');
    setRefNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#3D6B9C]" />
            Referral Sources &amp; Commission Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key in referral partners, introduced leads, and commission details.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#16223A] hover:bg-[#16223A] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Record Referral</span>
        </button>
      </div>

      <div className="bg-white border border-[#DDE3EB] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F8FA] border-b border-[#DDE3EB] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Referral Partner</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Contact</th>
              <th className="p-3 font-bold">Arrangement</th>
              <th className="p-3 font-bold text-right">Matters Brought In</th>
              <th className="p-3 font-bold text-right">Amount Owed (RM)</th>
              <th className="p-3 font-bold">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(referralPartners || []).map((r) => (
              <tr key={r.id} className="hover:bg-[#F6F8FA]">
                <td className="p-3 font-bold text-[#16223A]">
                  <div>{r.name}</div>
                  {r.notes && <div className="text-[10px] font-normal text-slate-500">{r.notes}</div>}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-[#F1EBF6] text-[#6B3D8C] rounded text-[10px] font-bold">
                    {r.type}
                  </span>
                </td>
                <td className="p-3 text-slate-700">{r.contact || '—'}</td>
                <td className="p-3 text-slate-700">
                  {r.commissionType} ({r.commissionValue}{r.commissionType === 'Percentage' ? '%' : ' RM'})
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-800">
                  {matterCounts[r.id] || 0}
                </td>
                <td className="p-3 text-right font-mono text-slate-800">
                  RM {r.amountOwed.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.paymentStatus === 'Paid' ? 'bg-[#E6EFE9] text-[#2F6F4E]' : 'bg-[#FBF2E9] text-[#8A6D3B]'
                    }`}
                  >
                    {r.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Referral Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#DDE3EB]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">Key In New Referral Source / Partner</h3>
            <form onSubmit={handleSaveReferral} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Referral / Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dato' Roslan / Maybank Legal Dept"
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Source Type</label>
                  <select
                    value={refType}
                    onChange={(e) => setRefType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="External">External Agent / Outsider</option>
                    <option value="Partner">Firm Partner</option>
                    <option value="Internal Staff">Internal Staff</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Contact Details</label>
                  <input
                    type="text"
                    placeholder="e.g. 012-3456789 / email"
                    value={refContact}
                    onChange={(e) => setRefContact(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Model</label>
                  <select
                    value={refCommType}
                    onChange={(e) => setRefCommType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Flat">Flat Fee (RM)</option>
                    <option value="None">None / Goodwill</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Commission Rate/Value</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10"
                    value={refCommVal}
                    onChange={(e) => setRefCommVal(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount Owed (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={refAmountOwed}
                    onChange={(e) => setRefAmountOwed(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Payment Status</label>
                  <select
                    value={refPayStatus}
                    onChange={(e) => setRefPayStatus(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Owing">Owing</option>
                    <option value="Paid">Paid</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Notes / Introduced Client</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes or referred client details..."
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#DDE3EB] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#16223A] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 9. FILE CLOSING CHECKLIST (MALAYSIAN BAR RISK MANAGEMENT COMPLIANT) ================= */
export const FileClosingView: React.FC = () => {
  const { cases, updateCase, showToast, setCurrentView, setCurrentCaseId, setCaseSubTab } = useApp();
  const closeRequests = cases.filter((c) => c.closeRequest?.status === 'Pending');

  const [checkedItems, setCheckedItems] = useState<Record<string, { inv: boolean; trust: boolean; docs: boolean; letter: boolean; boxNo: string }>>({});

  const toggleCheck = (caseId: string, field: 'inv' | 'trust' | 'docs' | 'letter') => {
    setCheckedItems((prev) => {
      const current = prev[caseId] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
      return {
        ...prev,
        [caseId]: { ...current, [field]: !current[field] },
      };
    });
  };

  const handleSetBoxNo = (caseId: string, val: string) => {
    setCheckedItems((prev) => {
      const current = prev[caseId] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
      return {
        ...prev,
        [caseId]: { ...current, boxNo: val },
      };
    });
  };

  const handleCloseMatter = (cs: any) => {
    const c = checkedItems[cs.id] || { inv: false, trust: false, docs: false, letter: false, boxNo: '' };
    if (!c.inv || !c.trust || !c.docs || !c.letter) {
      return alert('All 4 Malaysian Bar Council Risk Management compliance checks MUST be verified before closing the matter file!');
    }

    const closedDate = new Date();
    const retainUntilDate = new Date(closedDate.getFullYear() + 7, closedDate.getMonth(), closedDate.getDate());

    updateCase(cs.id, {
      status: 'Closed',
      closedDate: closedDate.toISOString().slice(0, 10),
      archiveBoxNo: c.boxNo || `ARCH-${closedDate.getFullYear()}-${cs.id.slice(-4)}`,
    });
    showToast(`Matter ${cs.ref} successfully CLOSED & ARCHIVED under Malaysian Bar Council Rules. Retain until ${retainUntilDate.toISOString().slice(0, 10)} (Box: ${c.boxNo || 'ARCH-7YR'}).`);
  };

  const openCases = cases.filter((c) => c.status !== 'Closed' && c.status !== 'Archive');

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner with Malaysian Bar Risk Management Seal */}
      <div className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#DDE3EB] pb-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <FolderX className="w-5 h-5 text-[#3D6B9C]" />
              Malaysian Bar Council Risk Management &amp; File Closing Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full compliance with Malaysian Bar Practice Circulars, Professional Indemnity Insurance (PII) guidelines, &amp; Legal Profession Act 1976.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FBF2E9] text-[#8A6D3B] border border-[#8A6D3B] flex items-center gap-1.5 shrink-0 shadow-2xs">
            🛡️ Bar Council PCCN Guidelines Compliant
          </span>
        </div>

        {/* Audit Guidelines Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 bg-[#F6F8FA] border border-[#DDE3EB] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">1. Trust Account Zero Balance</span>
            <span className="text-[10px] text-slate-600">Solicitors' Account Rules 1990 r.11 requirement. Client balance must equal RM 0.00.</span>
          </div>
          <div className="p-2.5 bg-[#F6F8FA] border border-[#DDE3EB] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">2. 7-Year Statutory Retention</span>
            <span className="text-[10px] text-slate-600">Files must be securely retained for minimum 7 years from closure before destruction notice.</span>
          </div>
          <div className="p-2.5 bg-[#F6F8FA] border border-[#DDE3EB] rounded-lg">
            <span className="font-bold text-[#16223A] block text-[11px]">3. Original Documents Handover</span>
            <span className="text-[10px] text-slate-600">Original titles, wills, &amp; agreements returned against signed Acknowledgement (Borang Serahan).</span>
          </div>
        </div>
      </div>

      {/* Close requests sent from a Working File (Request to close) — the partner approves there. */}
      {closeRequests.length > 0 && (
        <div className="bg-white border border-[#E8D9B8] p-4 rounded-xl space-y-2">
          <h3 className="font-serif text-sm font-bold text-[#16223A]">Close requests waiting for partner approval ({closeRequests.length})</h3>
          {closeRequests.map((cs) => (
            <div key={cs.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
              <span className="ref-seal">{cs.ref}</span>
              <span className="font-bold text-[#16223A]">{cs.title}</span>
              <span className="text-slate-500">Requested by {cs.closeRequest?.requestedBy} · {cs.closeRequest?.requestedAt} · {cs.closeRequest?.outcome}</span>
              <button
                type="button"
                onClick={() => { setCaseSubTab('overview'); setCurrentCaseId(cs.id); setCurrentView('cases'); }}
                className="ml-auto rounded-lg bg-[#16223A] px-3 py-1.5 text-xs font-bold text-white"
              >
                Open file to approve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Case Files Pending Audit List */}
      <div className="space-y-3">
        {openCases.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-[#DDE3EB] text-center text-slate-500 font-semibold">
            All matter files are fully audited and closed.
          </div>
        ) : (
          openCases.map((cs) => {
            const checks = checkedItems[cs.id] || { inv: false, trust: false, docs: false, pii: false, letter: false, boxNo: '' };
            const allChecked = checks.inv && checks.trust && checks.docs && checks.letter;

            return (
              <div key={cs.id} className="bg-white border border-[#DDE3EB] p-4 rounded-xl shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="ref-seal">{cs.ref}</span>
                    <span className="font-bold text-[#16223A] text-sm">{cs.title}</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Lead Partner: Syafiqah Hamizad
                  </span>
                </div>

                {/* 4-Step Bar Risk Compliance Audit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-[#FBF2E9]/40 p-3 rounded-lg border border-[#FBF2E9]/80">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-[#FBF2E9]/50">
                    <input
                      type="checkbox"
                      checked={checks.inv}
                      onChange={() => toggleCheck(cs.id, 'inv')}
                      className="rounded text-[#3D6B9C] mt-0.5"
                    />
                    <div>
                      <span>1. Final Tax Invoice Issued &amp; Fully Settled</span>
                      <span className="block text-[10px] font-normal text-slate-500">Zero outstanding fee balance on office ledger.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-[#FBF2E9]/50">
                    <input
                      type="checkbox"
                      checked={checks.trust}
                      onChange={() => toggleCheck(cs.id, 'trust')}
                      className="rounded text-[#3D6B9C] mt-0.5"
                    />
                    <div>
                      <span>2. Client Trust Account Clearance (RM 0.00 Balance)</span>
                      <span className="block text-[10px] font-normal text-slate-500">Verified zero remaining client money under SAR 1990.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-[#FBF2E9]/50">
                    <input
                      type="checkbox"
                      checked={checks.docs}
                      onChange={() => toggleCheck(cs.id, 'docs')}
                      className="rounded text-[#3D6B9C] mt-0.5"
                    />
                    <div>
                      <span>3. Return of Original Titles &amp; Documents</span>
                      <span className="block text-[10px] font-normal text-slate-500">Original land titles / wills returned with signed Acknowledgement Receipt.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-slate-800 p-1 rounded hover:bg-[#FBF2E9]/50">
                    <input
                      type="checkbox"
                      checked={checks.letter}
                      onChange={() => toggleCheck(cs.id, 'letter')}
                      className="rounded text-[#3D6B9C] mt-0.5"
                    />
                    <div>
                      <span>4. Formal File Closing &amp; Discharge Letter Sent to Client</span>
                      <span className="block text-[10px] font-normal text-slate-500">Formal closing letter advising client of completion &amp; 7-year document retention period.</span>
                    </div>
                  </label>
                </div>

                {/* Firm Archival Designation */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-700">Archive Box Designation:</label>
                    <input
                      type="text"
                      placeholder="e.g. BOX #104"
                      value={checks.boxNo}
                      onChange={(e) => handleSetBoxNo(cs.id, e.target.value)}
                      className="bg-slate-50 border border-slate-300 font-mono font-bold text-xs px-2.5 py-1 rounded w-48"
                    />
                  </div>

                  <button
                    onClick={() => handleCloseMatter(cs)}
                    disabled={!allChecked}
                    className={`font-bold px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-xs ${
                      allChecked
                        ? 'bg-[#16223A] hover:bg-[#16223A] text-white'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                    }`}
                  >
                    <FolderX className="w-4 h-4 text-[#3D6B9C]" />
                    <span>Approve &amp; Close Matter (Bar Council Risk Clearance)</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
