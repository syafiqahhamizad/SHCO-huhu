import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NewCaseModal } from '../NewCaseModal';
import { UrgentDeadlinesToast } from '../UrgentDeadlinesToast';
import {
  Scale,
  CheckCircle,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Calendar as CalendarIcon,
  Briefcase,
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [isCaseIntakeOpen, setIsCaseIntakeOpen] = useState(false);
  const {
    cases,
    clients,
    deadlines,
    timeEntries,
    expenses,
    invoices,
    payments,
    logs,
    currentUser,
    currentRole,
    currentPartnerCode,
    isAdmin,
    setCurrentView,
    setCurrentCaseId,
  } = useApp();

  const isPartner = currentRole === 'Partner' || isAdmin;

  const userTags = [currentUser?.name, currentUser?.email?.split('@')[0], currentPartnerCode]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  const matchesUser = (value?: string) => Boolean(value && userTags.some((tag) => value.toLowerCase().includes(tag)));
  const assignedCases = (cases || []).filter((matter) =>
    isAdmin ||
    matter.lawyerInCharge && matchesUser(matter.lawyerInCharge) ||
    matter.lawyers?.some((lawyer) => matchesUser(lawyer))
  );

  const totalCases = assignedCases.length;
  const activeMatters = assignedCases.filter((c) => c.status === 'Active').length;
  const assignedClientIds = new Set(assignedCases.map((matter) => matter.clientId));
  const totalClients = (clients || []).filter((client) => assignedClientIds.has(client.id)).length;
  const totalHearings = assignedCases.reduce((acc, c) => acc + (c.hearings ? c.hearings.length : 0), 0);

  const todayStr = new Date().toISOString().slice(0, 10);

  const overdueTasks = assignedCases.reduce(
    (acc, c) =>
      acc +
      (c.tasks || []).filter((t) => t.status !== 'Done' && t.dueDate < todayStr).length,
    0
  );

  const assignedCaseIds = new Set(assignedCases.map((matter) => matter.id));
  const deadlines30 = (deadlines || []).filter((d) => d.status !== 'Completed' && (!d.caseId || assignedCaseIds.has(d.caseId))).length;

  const outstandingBilling = (invoices || []).filter((invoice) => !invoice.fileRef || assignedCases.some((matter) => matter.ref === invoice.fileRef)).reduce(
    (acc, i) => acc + (i.status !== 'Paid' ? i.total : 0),
    0
  );

  const collectionMonth = (payments || []).filter((payment) => invoices.some((invoice) => invoice.id === payment.invoiceId && (!invoice.fileRef || assignedCases.some((matter) => matter.ref === invoice.fileRef)))).reduce((acc, p) => acc + p.amount, 0);

  const unbilledWork =
    (timeEntries || []).filter((t) => t.billable && assignedCaseIds.has(t.caseId)).reduce((s, t) => s + t.hours * t.rate, 0) +
    (expenses || []).filter((e) => e.billable && assignedCaseIds.has(e.caseId)).reduce((s, e) => s + e.amount, 0);

  // My Recent Cases
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  const relevantCases = assignedCases
    .filter(
      (c) =>
        c.lastAccessed &&
        new Date(c.lastAccessed) >= cutoff
    )
    .sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());

  // Today's Hearings
  const todayHearings: { caseRef: string; caseId: string; purpose: string; time: string }[] = [];
  assignedCases.forEach((c) => {
    (c.hearings || []).forEach((h) => {
      if (h.date === todayStr) {
        todayHearings.push({ caseRef: c.ref, caseId: c.id, purpose: h.purpose, time: h.time });
      }
    });
  });

  // Deadlines at risk
  const deadlinesAtRisk = (deadlines || [])
    .filter((d) => d.status !== 'Completed')
    .map((d) => {
      const days = Math.round((new Date(d.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000);
      return { ...d, days };
    })
    .sort((a, b) => a.days - b.days);

  // My Tasks
  const myTasks: { caseRef: string; caseId: string; title: string; priority: string; taskType: string; description?: string; dueDate: string; reviewer?: string; reviewStatus?: string }[] = [];
  (cases || []).forEach((c) => {
    (c.tasks || []).forEach((t) => {
      if (t.status !== 'Done' && (isAdmin || t.assignedTo === currentPartnerCode || matchesUser(t.assignedTo) || matchesUser(t.reviewer))) {
        myTasks.push({
          caseRef: c.ref,
          caseId: c.id,
          title: t.title,
          priority: t.priority,
          taskType: t.taskType,
          description: t.description,
          dueDate: t.dueDate,
          reviewer: t.reviewer,
          reviewStatus: t.reviewStatus,
        });
      }
    });
  });
  myTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-6">
      {/* Prominent Case Intake Quick Launch Banner */}
      <div className="bg-gradient-to-r from-[#16223A] to-[#203050] text-white p-5 rounded-2xl border border-amber-400/40 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 border border-blue-400 flex items-center justify-center text-white shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-amber-300">Process Case Intake &amp; Onboarding</h2>
            <p className="text-xs text-slate-200 mt-0.5">
              Onboard new legal matters per-case, assign unique file references (e.g. SHC/CV/SH/2026/894), and generate official Warrant of Appointment documents.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCaseIntakeOpen(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer shrink-0 transition-all border border-blue-400"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Process Case Intake</span>
        </button>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-[#A9814A] rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Total Matters</span>
            <Scale className="w-3.5 h-3.5 text-[#A9814A]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{totalCases}</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-emerald-700 rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Active Matters</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="font-serif text-2xl font-bold text-emerald-800">{activeMatters}</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-blue-700 rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Clients</span>
            <Users className="w-3.5 h-3.5 text-blue-700" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{totalClients}</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-purple-700 rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Hearings</span>
            <Clock className="w-3.5 h-3.5 text-purple-700" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{totalHearings}</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-rose-600 rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Overdue Tasks</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className={`font-serif text-2xl font-bold ${overdueTasks ? 'text-rose-700' : 'text-slate-800'}`}>
            {overdueTasks}
          </div>
        </div>

        {isPartner && (
          <>
            <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-amber-600 rounded-lg p-3.5 shadow-xs col-span-2 md:col-span-1">
              <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
                <span>Outstanding Fees</span>
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="font-serif text-xl font-bold text-rose-700">
                RM {outstandingBilling.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-emerald-600 rounded-lg p-3.5 shadow-xs col-span-2 md:col-span-1">
              <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
                <span>Collection (Month)</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="font-serif text-xl font-bold text-emerald-800">
                RM {collectionMonth.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </>
        )}

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-[#A9814A] rounded-lg p-3.5 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Deadlines (30 Days)</span>
            <CalendarIcon className="w-3.5 h-3.5 text-[#A9814A]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{deadlines30}</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] border-l-4 border-l-blue-600 rounded-lg p-3.5 shadow-xs col-span-2 md:col-span-2">
          <div className="text-[10px] uppercase font-bold text-[#5B6478] tracking-wider mb-1 flex items-center justify-between">
            <span>Unbilled Work (Time + Expenses)</span>
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="font-serif text-xl font-bold text-blue-900">
            RM {unbilledWork.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Grid Section 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Cases */}
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#A9814A]" />
              {isAdmin ? 'Recently Accessed Matters (Firm-Wide)' : 'My Recent Matters'}
            </h3>
            <button
              onClick={() => setCurrentView('cases')}
              className="text-[11px] text-[#A9814A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {relevantCases.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No recent matters accessed</div>
            ) : (
              relevantCases.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setCurrentCaseId(c.id);
                    setCurrentView('cases');
                  }}
                  className="py-2.5 flex items-center justify-between hover:bg-[#FAF8F2] px-2 rounded-md cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="ref-seal mr-2">{c.ref}</span>
                    <span className="font-medium text-slate-800">{c.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{c.lastAccessed}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Hearings */}
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#A9814A]" />
              Today's Court Hearings
            </h3>
            <button
              onClick={() => setCurrentView('hearings')}
              className="text-[11px] text-[#A9814A] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {todayHearings.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No court hearings scheduled today ({todayStr})</div>
            ) : (
              todayHearings.map((h, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="ref-seal">{h.caseRef}</span>
                    <span className="font-semibold text-slate-800">{h.time}</span>
                    <span className="text-slate-600">— {h.purpose}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    Scheduled
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deadlines At Risk */}
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Deadlines & Statutory Limits At Risk
            </h3>
            <button
              onClick={() => setCurrentView('deadlines')}
              className="text-[11px] text-[#A9814A] hover:underline font-semibold cursor-pointer"
            >
              View Deadlines
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {deadlinesAtRisk.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No open deadlines</div>
            ) : (
              deadlinesAtRisk.slice(0, 5).map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{d.title}</span>
                    <span className="text-[10px] text-slate-500 block font-mono">Due: {d.dueDate}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      d.days < 0
                        ? 'bg-rose-100 text-rose-800'
                        : d.days <= 7
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {d.days < 0 ? `Overdue ${Math.abs(d.days)}d` : `${d.days}d left`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Open Tasks */}
        <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#A9814A]" />
              My Assigned Matter Tasks
            </h3>
            <button
              onClick={() => setCurrentView('tasks')}
              className="text-[11px] text-[#A9814A] hover:underline font-semibold cursor-pointer"
            >
              All Tasks
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {myTasks.length === 0 ? (
              <div className="py-6 text-center text-slate-500">No open tasks assigned</div>
            ) : (
              myTasks.map((t) => (
                <button
                  type="button"
                  key={`${t.caseId}-${t.title}-${t.dueDate}`}
                  onClick={() => {
                    setCurrentCaseId(t.caseId);
                    setCurrentView('cases');
                  }}
                  className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F2] cursor-pointer px-2 rounded"
                  title={t.description || 'Open matter task'}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="ref-seal">{t.caseRef}</span>
                    {t.taskType === 'Review' && (
                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[9px] font-bold rounded">
                        Review
                      </span>
                    )}
                    {t.reviewer && matchesUser(t.reviewer) && (
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">Reviewer</span>
                    )}
                    <span className="text-slate-800 font-medium truncate" title={t.description || t.title}>{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">Due {t.dueDate}</span>
                    <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.priority === 'High'
                        ? 'bg-rose-100 text-rose-800'
                        : t.priority === 'Medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.priority}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity Stream Footer */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl p-4 shadow-xs">
        <h3 className="font-serif font-bold text-sm text-[#16223A] mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#A9814A]" />
          Recent Firm Activity Stream
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          {logs.slice(0, 4).map((l, idx) => (
            <div key={idx} className="py-2 flex justify-between items-center">
              <div>
                <strong className="text-[#16223A]">{l.user}</strong>{' '}
                <span className="text-slate-700">{l.action}</span> —{' '}
                <span className="text-slate-500">{l.details}</span>
              </div>
              <span className="font-mono text-[10.5px] text-slate-400">{l.ts}</span>
            </div>
          ))}
        </div>
      </div>

      <NewCaseModal
        isOpen={isCaseIntakeOpen}
        onClose={() => setIsCaseIntakeOpen(false)}
      />

      <UrgentDeadlinesToast />
    </div>
  );
};
