import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Gavel,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const COLORS = {
  navy: '#16223A',
  ink: '#243A55',
  brass: '#A9814A',
  green: '#2F6F4E',
  clay: '#8C4A32',
  border: '#E1DCCF',
  paper: '#FAF8F2',
};

const money = (value: number) => `RM ${value.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
const dateLabel = (value?: string) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : 'Undated';

type MetricProps = { label: string; value: string | number; note: string; color?: string; icon: React.ElementType };

const Metric = ({ label, value, note, color = COLORS.brass, icon: Icon }: MetricProps) => (
  <div className="border bg-white p-4 shadow-sm" style={{ borderColor: COLORS.border, borderTop: `3px solid ${color}` }}>
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <p className="mt-2 font-serif text-2xl font-bold" style={{ color: COLORS.navy }}>{value}</p>
    <p className="mt-1 text-[11px] text-slate-500">{note}</p>
  </div>
);

const Panel = ({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: () => void; children: React.ReactNode }) => (
  <section className="border bg-white shadow-sm" style={{ borderColor: COLORS.border }}>
    <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
      <div>
        <h2 className="font-serif text-base font-bold" style={{ color: COLORS.navy }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {action && <button type="button" onClick={action} className="flex items-center gap-1 text-[11px] font-bold" style={{ color: COLORS.brass }}>Open <ArrowRight className="h-3 w-3" /></button>}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export const ComprehensiveDashboardView: React.FC = () => {
  const app = useApp() as any;
  const { cases = [], clients = [], deadlines = [], timeEntries = [], expenses = [], invoices = [], payments = [], currentUser, currentRole, isAdmin, setCurrentView, setCurrentCaseId } = app;
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const isPartner = isAdmin || currentRole === 'Partner';
  const userTerms = [currentUser?.name, currentUser?.email?.split('@')[0], app.currentPartnerCode].filter(Boolean).map((v: string) => v.toLowerCase());
  const mine = (value?: unknown) => Boolean(value && userTerms.some((term: string) => String(value).toLowerCase().includes(term)));
  const myCases = useMemo(() => cases.filter((item: any) => isAdmin || mine(item.lawyerInCharge) || (item.lawyers || []).some((person: string) => mine(person))), [cases, isAdmin, currentUser, app.currentPartnerCode]);
  const myCaseIds = new Set(myCases.map((item: any) => item.id));
  const openTasks = myCases.flatMap((item: any) => (item.tasks || []).filter((task: any) => !['Done', 'Completed'].includes(task.status)).map((task: any) => ({ ...task, ref: item.ref, titleMatter: item.title, caseId: item.id })));
  const weekDeadlines = deadlines.filter((item: any) => item.status !== 'Completed' && item.dueDate <= weekEnd && (!item.caseId || myCaseIds.has(item.caseId))).sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate));
  const weekHearings = myCases.flatMap((item: any) => (item.hearings || []).filter((hearing: any) => hearing.status === 'Scheduled' && hearing.date >= today && hearing.date <= weekEnd).map((hearing: any) => ({ ...hearing, ref: item.ref, caseId: item.id })));
  const activeMatters = myCases.filter((item: any) => item.status === 'Active');
  const unbilled = timeEntries.filter((entry: any) => entry.billable && !entry.billed && myCaseIds.has(entry.caseId)).reduce((sum: number, entry: any) => sum + Number(entry.hours || 0) * Number(entry.rate || 0), 0) + expenses.filter((entry: any) => entry.billable && myCaseIds.has(entry.caseId)).reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
  const outstanding = invoices.filter((item: any) => item.status !== 'Paid' && (!item.fileRef || myCases.some((matter: any) => matter.ref === item.fileRef))).reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
  const collected = payments.filter((payment: any) => invoices.some((invoice: any) => invoice.id === payment.invoiceId)).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const recent = [...myCases].filter((item: any) => item.lastAccessed).sort((a: any, b: any) => String(b.lastAccessed).localeCompare(String(a.lastAccessed))).slice(0, 5);
  const openMatter = (id: string) => { setCurrentCaseId(id); setCurrentView('cases'); };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5" style={{ borderColor: COLORS.border }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: COLORS.brass }}>My Dashboard</p>
          <h1 className="mt-1 font-serif text-3xl font-bold" style={{ color: COLORS.navy }}>Your week at a glance</h1>
          <p className="mt-1 text-sm text-slate-500">To-do, deadlines, hearings and matters that need your attention.</p>
        </div>
        <div className="text-right text-xs text-slate-500"><p className="font-bold" style={{ color: COLORS.ink }}>{currentUser?.name || 'Team member'}</p><p>{currentUser?.email || currentRole}</p></div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="My active matters" value={activeMatters.length} note={`${myCases.length} assigned total`} icon={BriefcaseBusiness} />
        <Metric label="Deadlines this week" value={weekDeadlines.length} note={`${weekDeadlines.filter((item: any) => item.dueDate < today).length} overdue`} color={COLORS.clay} icon={AlertTriangle} />
        <Metric label="My hearings" value={weekHearings.length} note="next seven days" color={COLORS.ink} icon={Gavel} />
        <Metric label="Open tasks" value={openTasks.length} note="matter to-do" color={COLORS.green} icon={CheckCircle2} />
        <Metric label="Unbilled time" value={money(unbilled)} note="time and expenses" color={COLORS.brass} icon={Clock3} />
        <Metric label="Clients" value={new Set(myCases.map((item: any) => item.clientId)).size || clients.length} note="connected to matters" color={COLORS.ink} icon={Users} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Matter to-do" subtitle="Open tasks tied to your files" action={() => setCurrentView('tasks')}>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {openTasks.slice(0, 6).map((task: any) => <button type="button" key={`${task.caseId}-${task.id}`} onClick={() => openMatter(task.caseId)} className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-[#FAF8F2]">
              <span className="min-w-0"><span className="mr-2 font-mono text-[10px] font-bold" style={{ color: COLORS.brass }}>{task.ref}</span><span className="text-sm font-semibold text-slate-800">{task.title}</span><span className="mt-0.5 block text-[11px] text-slate-500">{task.titleMatter}</span></span><span className="shrink-0 text-[11px] text-slate-500">{dateLabel(task.dueDate)}</span>
            </button>)}
            {!openTasks.length && <p className="py-6 text-center text-sm text-slate-500">Your matter to-do is clear.</p>}
          </div>
        </Panel>
        <Panel title="Deadlines this week" action={() => setCurrentView('deadlines')}>
          <div className="space-y-3">{weekDeadlines.slice(0, 5).map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 border-l-2 pl-3" style={{ borderColor: item.dueDate < today ? COLORS.clay : COLORS.brass }}><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="text-[11px] text-slate-500">{item.type || 'Deadline'} · {dateLabel(item.dueDate)}</p></div><span className="text-[10px] font-bold uppercase" style={{ color: item.dueDate < today ? COLORS.clay : COLORS.brass }}>{item.dueDate < today ? 'Overdue' : item.priority || 'Due'}</span></div>)}{!weekDeadlines.length && <p className="py-6 text-center text-sm text-slate-500">No deadlines due this week.</p>}</div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="My hearings" subtitle="Scheduled court appearances" action={() => setCurrentView('hearings')}>
          <div className="space-y-3">{weekHearings.slice(0, 5).map((hearing: any) => <button type="button" key={hearing.id} onClick={() => openMatter(hearing.caseId)} className="flex w-full items-center gap-3 border-b pb-3 text-left last:border-0 last:pb-0" style={{ borderColor: COLORS.border }}><span className="w-12 text-center font-serif text-lg font-bold" style={{ color: COLORS.navy }}>{dateLabel(hearing.date)}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{hearing.title || hearing.purpose}</strong><span className="text-[11px] text-slate-500">{hearing.ref} · {hearing.court || 'Court'} · {hearing.time || 'Time pending'}</span></span></button>)}{!weekHearings.length && <p className="py-6 text-center text-sm text-slate-500">No hearings in the next seven days.</p>}</div>
        </Panel>
        <Panel title="Recently accessed matters" action={() => setCurrentView('cases')}>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>{recent.map((matter: any) => <button type="button" key={matter.id} onClick={() => openMatter(matter.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[#FAF8F2]"><span><span className="mr-2 font-mono text-[10px] font-bold" style={{ color: COLORS.brass }}>{matter.ref}</span><span className="text-sm font-semibold text-slate-800">{matter.title}</span><span className="mt-0.5 block text-[11px] text-slate-500">{matter.practiceArea || matter.stage || 'Matter'}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></button>)}{!recent.length && <p className="py-6 text-center text-sm text-slate-500">No recently accessed matters.</p>}</div>
        </Panel>
      </div>

      {isPartner && <>
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: COLORS.border }}><LayoutDashboard className="h-4 w-4" style={{ color: COLORS.brass }} /><h2 className="font-serif text-xl font-bold" style={{ color: COLORS.navy }}>Partner & firm performance</h2><span className="text-xs text-slate-500">Partner-only view</span></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Revenue billed" value={money(invoices.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0))} note="all recorded invoices" icon={CircleDollarSign} /><Metric label="Cash collected" value={money(collected)} note="recorded payments" color={COLORS.green} icon={ShieldCheck} /><Metric label="Aged receivables" value={money(outstanding)} note="unpaid invoices" color={COLORS.clay} icon={FileWarning} /><Metric label="Open firm matters" value={cases.filter((item: any) => item.status === 'Active').length} note="firm-wide" color={COLORS.ink} icon={Scale} /></div>
        <div className="grid gap-6 xl:grid-cols-2"><Panel title="Firm workload" subtitle="Matter distribution across the firm" action={() => setCurrentView('cases')}><div className="space-y-3"><div className="flex justify-between text-sm"><span>Active matters</span><strong>{cases.filter((item: any) => item.status === 'Active').length}</strong></div><div className="h-2 bg-slate-100"><div className="h-2" style={{ width: `${Math.min(100, cases.length ? (cases.filter((item: any) => item.status === 'Active').length / cases.length) * 100 : 0)}%`, backgroundColor: COLORS.brass }} /></div><div className="flex justify-between text-sm"><span>Active clients</span><strong>{clients.length}</strong></div><div className="flex justify-between text-sm"><span>Unassigned matters</span><strong>{cases.filter((item: any) => !item.lawyerInCharge).length}</strong></div></div></Panel><Panel title="Financial & commercial decisions" subtitle="Signals that need partner attention"><div className="space-y-3 text-sm"><p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: COLORS.clay }} /> {invoices.filter((item: any) => item.status !== 'Paid').length} invoices remain unpaid.</p><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: COLORS.brass }} /> {timeEntries.filter((item: any) => item.billable && !item.billed).length} billable entries are not yet billed.</p><p className="flex items-center gap-2"><FileWarning className="h-4 w-4" style={{ color: COLORS.ink }} /> {deadlines.filter((item: any) => item.dueDate < today && item.status !== 'Completed').length} firm deadlines are overdue.</p></div></Panel></div>
      </>}

      {isAdmin && <Panel title="Firm-wide risk watch" subtitle="Admin and Super Admin view"><div className="grid gap-3 md:grid-cols-3"><div className="border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.paper }}><p className="text-[10px] font-bold uppercase text-slate-500">Dormant files</p><p className="mt-2 font-serif text-2xl font-bold" style={{ color: COLORS.navy }}>{cases.filter((item: any) => item.status === 'Dormant').length}</p></div><div className="border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.paper }}><p className="text-[10px] font-bold uppercase text-slate-500">Firm deadlines</p><p className="mt-2 font-serif text-2xl font-bold" style={{ color: COLORS.navy }}>{deadlines.filter((item: any) => item.status !== 'Completed').length}</p></div><div className="border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.paper }}><p className="text-[10px] font-bold uppercase text-slate-500">Clients</p><p className="mt-2 font-serif text-2xl font-bold" style={{ color: COLORS.navy }}>{clients.length}</p></div></div></Panel>}
    </div>
  );
};

export default ComprehensiveDashboardView;