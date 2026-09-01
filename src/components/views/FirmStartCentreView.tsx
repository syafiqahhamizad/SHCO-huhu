import React from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Plus,
  Scale,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FirmAnnouncement } from '../../types';

const formatDate = (value?: string) => {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const FirmStartCentreView: React.FC = () => {
  const {
    cases,
    deadlines,
    notifications,
    currentUser,
    currentRole,
    isOAuthConnected,
    users,
    announcements,
    addAnnouncement,
    setCurrentView,
    setCurrentCaseId,
    setIsNewCaseModalOpen,
    setIsRegisterClientModalOpen,
  } = useApp();
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = React.useState(false);
  const [announcementTitle, setAnnouncementTitle] = React.useState('');
  const [announcementBody, setAnnouncementBody] = React.useState('');
  const [announcementCategory, setAnnouncementCategory] = React.useState<FirmAnnouncement['category']>('Announcement');
  const canPublish = Boolean(currentUser.isSuperAdmin || currentUser.isAdmin || currentRole === 'Partner');

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const inThirtyDays = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const activeCases = cases.filter((matter) => matter.status === 'Active');
  const openDeadlines = deadlines
    .filter((deadline) => deadline.status !== 'Completed' && deadline.dueDate <= inThirtyDays)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const openTasks = cases.flatMap((matter) =>
    (matter.tasks || [])
      .filter((task) => !['Completed', 'Done'].includes(task.status))
      .map((task) => ({ ...task, caseId: matter.id, caseRef: matter.ref }))
  ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const urgentNotifications = notifications.filter((notification) => !notification.read).slice(0, 5);
  const upcomingHearings = activeCases.flatMap((matter) =>
    (matter.hearings || [])
      .filter((hearing) => hearing.date >= todayKey && hearing.date <= inThirtyDays)
      .map((hearing) => ({ ...hearing, caseId: matter.id, caseRef: matter.ref, caseTitle: matter.title }))
  ).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 5);
  const upcomingCelebrations = users.flatMap((user) => {
    if (user.staffProfile?.celebrationOptOut) return [];
    const items: { id: string; title: string; date: string; detail: string }[] = [];
    const thisYear = today.getFullYear();
    const annualDate = (value: string) => `${thisYear}-${value.slice(5)}`;
    if (user.staffProfile?.birthday) items.push({ id: `${user.id}-birthday`, title: `${user.name}'s birthday`, date: annualDate(user.staffProfile.birthday), detail: 'Birthday' });
    if (user.staffProfile?.callToBarDate) items.push({ id: `${user.id}-bar`, title: `${user.name}'s call-to-the-bar anniversary`, date: annualDate(user.staffProfile.callToBarDate), detail: 'Call to the Bar' });
    if (user.staffProfile?.joinDate) items.push({ id: `${user.id}-work`, title: `${user.name}'s firm anniversary`, date: annualDate(user.staffProfile.joinDate), detail: 'Firm Anniversary' });
    return items;
  }).filter((item) => item.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const visibleAnnouncements = announcements.filter((announcement) => announcement.published && announcement.internalOnly).slice(0, 6);

  const publishAnnouncement = (event: React.FormEvent) => {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    if (addAnnouncement({ title: announcementTitle.trim(), body: announcementBody.trim(), category: announcementCategory, published: true, internalOnly: true })) {
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementCategory('Announcement');
      setIsAnnouncementFormOpen(false);
    }
  };

  const openMatter = (caseId: string) => {
    setCurrentCaseId(caseId);
    setCurrentView('cases');
  };

  return (
    <div className="w-full space-y-5 pb-8 text-xs">
      <section className="relative overflow-hidden rounded-2xl border border-[#304362] bg-[#16223A] p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#A9814A]/20 to-transparent" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <Scale className="h-4 w-4" /> Firm Start Centre
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-wider text-slate-300">{currentRole}</span>
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-normal">{today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {currentUser.name.split(' ')[0]}</h1>
            <p className="max-w-xl leading-relaxed text-slate-300">Your daily operating desk for matters, deadlines, tasks and the firm’s connected Workspace.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Today</div>
            <div className="mt-1 font-serif text-xl font-bold">{today.toLocaleDateString('en-MY', { weekday: 'long' })}</div>
            <div className="font-mono text-xs text-slate-300">{formatDate(todayKey)}</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active matters', value: activeCases.length, icon: Briefcase, tone: 'text-blue-700 bg-blue-50 border-blue-200', view: 'cases' },
          { label: 'Open tasks', value: openTasks.length, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', view: 'caseStatus' },
          { label: 'Due in 30 days', value: openDeadlines.length, icon: Clock3, tone: 'text-amber-700 bg-amber-50 border-amber-200', view: 'deadlines' },
          { label: 'Unread alerts', value: notifications.filter((notification) => !notification.read).length, icon: Bell, tone: 'text-rose-700 bg-rose-50 border-rose-200', view: 'logs' },
        ].map((metric) => (
          <button key={metric.label} type="button" onClick={() => setCurrentView(metric.view)} className="flex items-center justify-between rounded-xl border border-[#E1DCCF] bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
            <div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</div><div className="mt-1 font-mono text-2xl font-bold text-[#16223A]">{metric.value}</div></div>
            <span className={`rounded-lg border p-2 ${metric.tone}`}><metric.icon className="h-4 w-4" /></span>
          </button>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-3">
        <span className="mr-1 self-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick actions</span>
        <button type="button" onClick={() => setIsNewCaseModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-[#16223A] px-3 py-2 font-bold text-white cursor-pointer"><Plus className="h-3.5 w-3.5 text-amber-300" /> New matter</button>
        <button type="button" onClick={() => setIsRegisterClientModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-[#E1DCCF] bg-white px-3 py-2 font-bold text-[#16223A] cursor-pointer"><Users className="h-3.5 w-3.5 text-[#A9814A]" /> New client</button>
        <button type="button" onClick={() => setCurrentView('quotations')} className="flex items-center gap-1.5 rounded-lg border border-[#E1DCCF] bg-white px-3 py-2 font-bold text-[#16223A] cursor-pointer"><FileText className="h-3.5 w-3.5 text-[#A9814A]" /> New quotation</button>
        <button type="button" onClick={() => setCurrentView('calendar')} className="flex items-center gap-1.5 rounded-lg border border-[#E1DCCF] bg-white px-3 py-2 font-bold text-[#16223A] cursor-pointer"><CalendarDays className="h-3.5 w-3.5 text-[#A9814A]" /> Open calendar</button>
      </section>

      <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]"><Bell className="h-4 w-4 text-[#A9814A]" /> Firm announcements</h2><p className="mt-1 text-slate-500">Internal notices, celebrations and firm dates.</p></div>
          {canPublish && <button type="button" onClick={() => setIsAnnouncementFormOpen((open) => !open)} className="flex items-center gap-1.5 self-start rounded-lg bg-[#16223A] px-3 py-2 font-bold text-white cursor-pointer"><Plus className="h-3.5 w-3.5 text-amber-300" /> Publish announcement</button>}
        </div>
        {isAnnouncementFormOpen && <form onSubmit={publishAnnouncement} className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 md:grid-cols-[180px_1fr]">
          <select value={announcementCategory} onChange={(event) => setAnnouncementCategory(event.target.value as FirmAnnouncement['category'])} className="rounded-lg border border-[#E1DCCF] bg-white p-2 text-xs font-bold"><option>Announcement</option><option>Birthday</option><option>Call to the Bar</option><option>Work Anniversary</option><option>Firm Anniversary</option><option>Holiday</option><option>Policy</option><option>Alert</option></select>
          <input required value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Announcement title" className="rounded-lg border border-[#E1DCCF] p-2" />
          <textarea required value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Write the internal announcement..." rows={3} className="rounded-lg border border-[#E1DCCF] p-2 md:col-span-2" />
          <button type="submit" className="rounded-lg bg-[#16223A] p-2 font-bold text-white md:col-span-2 cursor-pointer">Publish internally</button>
        </form>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleAnnouncements.map((announcement) => { const tone = announcement.category === 'Alert' ? 'border-rose-200 bg-rose-50/60' : announcement.category === 'Holiday' ? 'border-blue-200 bg-blue-50/60' : announcement.category === 'Policy' ? 'border-purple-200 bg-purple-50/60' : 'border-amber-200 bg-amber-50/60'; const badge = announcement.category === 'Alert' ? 'bg-rose-100 text-rose-900' : announcement.category === 'Holiday' ? 'bg-blue-100 text-blue-900' : announcement.category === 'Policy' ? 'bg-purple-100 text-purple-900' : 'bg-amber-100 text-amber-900'; return <article key={announcement.id} className={`rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${tone}`}><div className="flex items-center justify-between gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}>{announcement.category}</span><span className="font-mono text-[10px] text-slate-400">{formatDate(announcement.eventDate || announcement.createdAt.slice(0, 10))}</span></div><h3 className="mt-2 font-bold text-[#16223A]">{announcement.title}</h3><p className="mt-1 leading-relaxed text-slate-600">{announcement.body}</p></article>; })}
          {upcomingCelebrations.map((celebration) => <article key={celebration.id} className="group rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="flex items-center justify-between gap-2"><span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">{celebration.detail}</span><span className="font-mono text-[10px] text-slate-500">{formatDate(celebration.date)}</span></div><h3 className="mt-2 font-bold text-[#16223A]">{celebration.title}</h3><p className="mt-1 text-slate-600">An upcoming moment to recognise together.</p></article>)}
          {!visibleAnnouncements.length && !upcomingCelebrations.length && <div className="py-6 text-slate-400">No announcements or celebrations to show.</div>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3"><div><h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]"><CalendarDays className="h-4 w-4 text-[#A9814A]" /> Upcoming hearings</h2><p className="mt-1 text-slate-500">Next 30 days across active matters.</p></div><button type="button" onClick={() => setCurrentView('calendar')} className="text-[10px] font-bold text-blue-700 cursor-pointer">View calendar <ArrowRight className="inline h-3 w-3" /></button></div>
          <div className="space-y-2">{upcomingHearings.length ? upcomingHearings.map((hearing) => <button key={`${hearing.caseId}-${hearing.id}`} type="button" onClick={() => openMatter(hearing.caseId)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 bg-[#FAF8F2] p-3 text-left hover:border-amber-300 cursor-pointer"><div><div className="font-bold text-[#16223A]">{hearing.purpose}</div><div className="mt-1 text-[10px] text-slate-500">{hearing.caseRef} · {hearing.caseTitle}</div></div><div className="shrink-0 text-right"><div className="font-mono font-bold text-amber-800">{formatDate(hearing.date)}</div><div className="text-[10px] text-slate-500">{hearing.time}</div></div></button>) : <div className="py-8 text-center text-slate-400">No upcoming hearings.</div>}</div>
        </section>

        <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3"><div><h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]"><Clock3 className="h-4 w-4 text-[#A9814A]" /> Deadlines and tasks</h2><p className="mt-1 text-slate-500">The next actions needing attention.</p></div><button type="button" onClick={() => setCurrentView('deadlines')} className="text-[10px] font-bold text-blue-700 cursor-pointer">View all <ArrowRight className="inline h-3 w-3" /></button></div>
          <div className="space-y-2">{[...openDeadlines.slice(0, 3).map((deadline) => ({ id: `deadline-${deadline.id}`, title: deadline.title, detail: `Deadline · ${deadline.caseId || 'Firm-wide'}`, date: deadline.dueDate, action: () => setCurrentView('deadlines') })), ...openTasks.slice(0, 3).map((task) => ({ id: `task-${task.id}`, title: task.title, detail: `Task · ${task.caseRef}`, date: task.dueDate, action: () => openMatter(task.caseId) }))].slice(0, 5).map((item) => <button key={item.id} type="button" onClick={item.action} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-amber-300 cursor-pointer"><div><div className="font-bold text-[#16223A]">{item.title}</div><div className="mt-1 text-[10px] text-slate-500">{item.detail}</div></div><span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] font-bold text-amber-900">{formatDate(item.date)}</span></button>)}{!openDeadlines.length && !openTasks.length && <div className="py-8 text-center text-slate-400">No open deadlines or tasks.</div>}</div>
        </section>

        <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]"><LinkIcon className="h-4 w-4 text-[#A9814A]" /> Google Workspace launchpad</h2><p className="mt-1 text-slate-500">Open the firm’s connected tools from one place.</p></div><div className="flex items-center gap-3"><span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isOAuthConnected ? 'text-emerald-700' : 'text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${isOAuthConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{isOAuthConnected ? 'Workspace connected' : 'Connection required'}</span><button type="button" onClick={() => setCurrentView('workspace')} className="text-[10px] font-bold text-blue-700 cursor-pointer">Workspace settings <ArrowRight className="inline h-3 w-3" /></button></div></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">{[
            ['Calendar', 'https://calendar.google.com', CalendarDays],
            ['Drive', 'https://drive.google.com', FolderOpen],
            ['Gmail', 'https://mail.google.com', Bell],
            ['Docs', 'https://docs.google.com', FileText],
            ['Sheets', 'https://sheets.google.com', Activity],
            ['Meet', 'https://meet.google.com', Users],
            ['Tasks', 'https://tasks.google.com', CheckCircle2],
          ].map(([label, url, Icon]) => <a key={label as string} href={url as string} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[#FAF8F2] px-3 py-3 font-bold text-[#16223A] hover:border-amber-300 hover:bg-amber-50"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#A9814A]" />{label as string}</span><ExternalLink className="h-3 w-3 text-slate-400" /></a>)}
          </div>
        </section>

        <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs xl:col-span-2">
          <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3"><div><h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]"><Bell className="h-4 w-4 text-[#A9814A]" /> Notifications</h2><p className="mt-1 text-slate-500">Unread alerts from the existing firm notification stream.</p></div><button type="button" onClick={() => setCurrentView('logs')} className="text-[10px] font-bold text-blue-700 cursor-pointer">Open activity <ArrowRight className="inline h-3 w-3" /></button></div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{urgentNotifications.length ? urgentNotifications.map((notification) => <button key={notification.id} type="button" onClick={() => notification.linkId ? openMatter(notification.linkId) : setCurrentView(notification.linkTab || 'logs')} className="rounded-lg border border-slate-100 bg-[#FAF8F2] p-3 text-left hover:border-amber-300 cursor-pointer"><div className="font-bold text-[#16223A]">{notification.title}</div><div className="mt-1 leading-relaxed text-slate-600">{notification.message}</div><div className="mt-2 font-mono text-[10px] text-slate-400">{new Date(notification.timestamp).toLocaleString('en-MY')}</div></button>) : <div className="py-6 text-slate-400">You are all caught up.</div>}</div>
        </section>
      </div>
    </div>
  );
};
