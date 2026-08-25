import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Clock, Calendar, X, ArrowRight, BellRing } from 'lucide-react';

export const UrgentDeadlinesToast: React.FC = () => {
  const { cases, deadlines, setCurrentView, setCurrentCaseId } = useApp();
  const [dismissed, setDismissed] = useState(false);

  // Compute urgent deadlines within next 48 hours
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const targetDateStr = fortyEightHoursLater.toISOString().slice(0, 10);

  interface UrgentItem {
    id: string;
    caseId?: string;
    caseRef: string;
    title: string;
    dueDate: string;
    assignedTo: string;
    type: 'Task' | 'Hearing' | 'Statutory Deadline';
    isOverdue: boolean;
  }

  const urgentList: UrgentItem[] = [];

  // 1. Scan case tasks
  (cases || []).forEach((c) => {
    (c.tasks || []).forEach((t) => {
      if (t.status !== 'Done' && t.status !== 'Completed' && t.dueDate) {
        if (t.dueDate <= targetDateStr) {
          urgentList.push({
            id: `task-${t.id}`,
            caseId: c.id,
            caseRef: c.ref,
            title: t.title,
            dueDate: t.dueDate,
            assignedTo: t.assignedTo || 'Lawyer-in-charge',
            type: 'Task',
            isOverdue: t.dueDate < todayStr,
          });
        }
      }
    });

    // 2. Scan case court hearings
    (c.hearings || []).forEach((h) => {
      if (h.status === 'Scheduled' && h.date) {
        if (h.date <= targetDateStr) {
          urgentList.push({
            id: `hearing-${h.id}`,
            caseId: c.id,
            caseRef: c.ref,
            title: `Court Hearing: ${h.purpose}`,
            dueDate: h.date,
            assignedTo: 'Litigation Counsel',
            type: 'Hearing',
            isOverdue: h.date < todayStr,
          });
        }
      }
    });
  });

  // 3. Scan statutory deadlines
  (deadlines || []).forEach((d) => {
    if (d.status !== 'Done' && d.status !== 'Completed' && d.dueDate) {
      if (d.dueDate <= targetDateStr) {
        urgentList.push({
          id: `deadline-${d.id}`,
          caseRef: d.caseRef || 'HQ-GENERAL',
          title: d.title,
          dueDate: d.dueDate,
          assignedTo: d.assignedTo || 'In-Charge',
          type: 'Statutory Deadline',
          isOverdue: d.dueDate < todayStr,
        });
      }
    }
  });

  // Sort: overdue items first, then earliest due date
  urgentList.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  if (dismissed || urgentList.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-[#16223A] text-white border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl animate-bounce-once space-y-3">
      <div className="flex items-start justify-between border-b border-amber-500/30 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 animate-pulse">
            <BellRing className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-sm text-amber-300 flex items-center gap-1.5">
              <span>Urgent Deadlines Alert</span>
              <span className="bg-amber-500/30 text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-500/50">
                Next 48 Hours ({urgentList.length})
              </span>
            </h4>
            <p className="text-[11px] text-slate-300 font-medium">
              Case tasks or court events requiring immediate action.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Urgent Items List */}
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {urgentList.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className={`p-2.5 rounded-xl border transition-all text-xs space-y-1 ${
              item.isOverdue
                ? 'bg-rose-950/60 border-rose-500/80 text-rose-100'
                : 'bg-slate-800/80 border-amber-500/40 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-500/30">
                {item.caseRef}
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                  item.isOverdue
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {item.isOverdue ? `OVERDUE (${item.dueDate})` : `Due: ${item.dueDate}`}
              </span>
            </div>

            <p className="font-bold text-xs text-white leading-tight">{item.title}</p>

            <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-medium pt-1 border-t border-white/10">
              <span>Assigned: {item.assignedTo}</span>
              {item.caseId && (
                <button
                  onClick={() => {
                    setCurrentCaseId(item.caseId!);
                    setCurrentView('cases');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <span>View Matter</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {urgentList.length > 4 && (
          <div className="text-center text-[11px] text-amber-400 font-bold pt-1">
            + {urgentList.length - 4} more urgent items pending.
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs">
        <button
          onClick={() => setCurrentView('deadlines')}
          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer text-xs"
        >
          <span>Open Full Deadlines Control Room</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-200 text-[11px] font-semibold cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
