import React from 'react';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  FolderOpen,
  Gavel,
  Globe2,
  HardDrive,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FirmAnnouncement } from '../../types';

interface QuickLink {
  label: string;
  url: string;
}

interface QuickLinkGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  tone: string;
  links: QuickLink[];
}

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
    currentUser,
    currentRole,
    users,
    announcements,
    addAnnouncement,
    setCurrentView,
    setIsNewCaseModalOpen,
  } = useApp();
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = React.useState(false);
  const [announcementTitle, setAnnouncementTitle] = React.useState('');
  const [announcementBody, setAnnouncementBody] = React.useState('');
  const [announcementCategory, setAnnouncementCategory] = React.useState<FirmAnnouncement['category']>('Announcement');
  const canPublish = Boolean(currentUser.isSuperAdmin || currentUser.isAdmin || currentRole === 'Partner');

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
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
  const workspaceApps = [
    { label: 'Dashboard', detail: 'Firm overview and key signals', view: 'dashboard', icon: LayoutDashboard, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Cases & Matters', detail: 'Open files and matter activity', view: 'cases', icon: FolderKanban, tone: 'bg-amber-50 text-amber-800 border-amber-200' },
    { label: 'Clients', detail: 'Profiles, KYC and instructions', view: 'clients', icon: Users, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Calendar', detail: 'Hearings and compliance dates', view: 'calendar', icon: CalendarDays, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
    { label: 'Tasks', detail: 'Assignments and turnaround', view: 'tasks', icon: ListChecks, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: 'Documents', detail: 'Matter files and templates', view: 'documents', icon: FileText, tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ];
  const quickLinkGroups: QuickLinkGroup[] = [
    { title: 'Due diligence', description: 'Company and insolvency searches', icon: ShieldCheck, tone: 'bg-rose-100 text-rose-700 border-rose-300', links: [
      { label: 'eInsolvency', url: 'https://e-insolvensi.mdi.gov.my/' },
      { label: 'SSM e-Info', url: 'https://www.ssm-einfo.my/' },
    ] },
    { title: 'Bar', description: 'Professional body member portals', icon: Users, tone: 'bg-emerald-100 text-emerald-700 border-emerald-300', links: [
      { label: 'Malaysian Bar', url: 'https://login.malaysianbar.org.my/' },
      { label: 'Selangor Bar', url: 'https://member.selangorbar.org/login' },
    ] },
    { title: 'Litigation', description: 'Court systems and litigation workspaces', icon: Gavel, tone: 'bg-violet-100 text-violet-700 border-violet-300', links: [
      { label: 'EFS', url: 'https://efs.kehakiman.gov.my/EFSWeb/' },
      { label: 'Malaysian Judiciary', url: 'https://www.kehakiman.gov.my/' },
    ] },
    { title: 'Case files', description: 'Shared Google Drive matter folders', icon: FolderOpen, tone: 'bg-blue-100 text-blue-700 border-blue-300', links: [
      { label: 'Litigation', url: 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link' },
      { label: 'Conveyancing', url: 'https://drive.google.com/drive/folders/1duXHdC0jqZABBWXKI2z0omu-VuDx8eiO?usp=drive_link' },
      { label: 'Corporate', url: 'https://drive.google.com/drive/folders/13sZXUs4X0yoMEk8pBMEwwwZZAsjHHDey?usp=drive_link' },
      { label: 'Probate & Administration', url: 'https://drive.google.com/drive/folders/1cp39TLlUvvm0M3-2BDh7d6kq8s7_EhJV?usp=drive_link' },
      { label: 'Criminal', url: 'https://drive.google.com/drive/folders/1ysK_PbGNmfi8VxdM535CykjNUB4gxUwN?usp=drive_link' },
      { label: 'YBGK', url: 'https://drive.google.com/drive/folders/1cZTgUZZUQ2nNl4SwKcgFr61kfSh0C4l9?usp=drive_link' },
    ] },
    { title: 'Library', description: 'Research, legislation and legal databases', icon: BookOpen, tone: 'bg-amber-100 text-amber-800 border-amber-300', links: [
      { label: 'Practice Directions', url: 'https://intranet.kehakiman.gov.my/EAA/search.php?lang=en' },
      { label: 'Legislation (AGC)', url: 'https://lom.agc.gov.my/' },
      { label: 'eLaw', url: 'https://www.elaw.my/Default.aspx?returnUrl=https://www.elaw.my/elawquicksearch.aspx' },
      { label: 'Lexis Nexis & eBook', url: 'https://member.selangorbar.org/login' },
      { label: 'CLJ', url: 'https://www.cljlaw.com/' },
    ] },
    { title: 'Conveyancing', description: 'Land, remuneration and state portals', icon: Landmark, tone: 'bg-cyan-100 text-cyan-700 border-cyan-300', links: [
      { label: 'SRO 2023', url: 'https://www.malaysianbar.org.my/cms/upload_files/document/Solicitors%20Remuneration%20Order%202023.pdf' },
      { label: 'E-Tanah Selangor', url: 'https://etanah.selangor.gov.my/etanah-awam/AwamLoginForm.xhtml?isLogout=true' },
      { label: 'Smartbox Selangor', url: 'https://smartbox.selangor.gov.my/' },
      { label: 'PTG Kuala Lumpur', url: 'https://www.ptgwp.gov.my/portal/ms/' },
    ] },
    { title: 'Google Workspace', description: 'Everyday firm collaboration tools', icon: HardDrive, tone: 'bg-sky-100 text-sky-700 border-sky-300', links: [
      { label: 'Gmail', url: 'https://mail.google.com/' },
      { label: 'Google Calendar', url: 'https://calendar.google.com/' },
      { label: 'Google Drive', url: 'https://drive.google.com/' },
      { label: 'Google Docs', url: 'https://docs.google.com/' },
      { label: 'Google Sheets', url: 'https://sheets.google.com/' },
      { label: 'Google Meet', url: 'https://meet.google.com/' },
      { label: 'Google Forms', url: 'https://forms.google.com/' },
    ] },
    { title: 'More resources', description: 'Useful regulatory and professional sites', icon: Globe2, tone: 'bg-slate-200 text-slate-700 border-slate-300', links: [
      { label: 'Attorney General’s Chambers', url: 'https://www.agc.gov.my/' },
      { label: 'Malaysian Bar Council', url: 'https://www.malaysianbar.org.my/' },
      { label: 'Google Admin Console', url: 'https://admin.google.com/' },
      { label: 'Google Vault', url: 'https://ediscovery.google.com/' },
    ] },
  ];

  const featuredLinks = [
    { label: 'EFS', url: 'https://efs.kehakiman.gov.my/EFSWeb/', accent: 'bg-violet-100 text-violet-700 border-violet-300' },
    { label: 'Google Drive', url: 'https://drive.google.com/', accent: 'bg-blue-100 text-blue-700 border-blue-300' },
    { label: 'SSM', url: 'https://www.ssm-einfo.my/', accent: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { label: 'Legislation', url: 'https://lom.agc.gov.my/', accent: 'bg-amber-100 text-amber-800 border-amber-300' },
    { label: 'Gmail', url: 'https://mail.google.com/', accent: 'bg-rose-100 text-rose-700 border-rose-300' },
  ];

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

  return (
    <div className="w-full space-y-5 pb-8 text-xs">
      <section className="relative overflow-hidden rounded-2xl border border-[#304362] bg-[#16223A] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-gradient-to-l from-[#A9814A]/25 to-transparent sm:block" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300"><Scale className="h-4 w-4" /> Firm Start Centre <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-wider text-slate-300">{currentRole}</span></div>
            <h1 className="font-serif text-3xl font-bold tracking-normal sm:text-4xl">{today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {currentUser.name.split(' ')[0]}</h1>
            <p className="max-w-xl leading-relaxed text-slate-300">Everything your firm needs for today, in one connected workspace.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => setIsNewCaseModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-[#A9814A] px-3 py-2 font-bold text-white shadow-sm transition hover:bg-[#C29A5A] cursor-pointer"><Plus className="h-3.5 w-3.5" /> New matter</button>
              <button type="button" onClick={() => setCurrentView('cases')} className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-bold text-white transition hover:bg-white/20 cursor-pointer"><Search className="h-3.5 w-3.5" /> Find a record</button>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 lg:min-w-44 lg:text-right">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200 lg:justify-end"><Clock3 className="h-3.5 w-3.5" /> Today</div>
            <div className="mt-1 font-serif text-xl font-bold">{today.toLocaleDateString('en-MY', { weekday: 'long' })}</div>
            <div className="font-mono text-xs text-slate-300">{formatDate(todayKey)}</div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-serif text-xl font-bold text-[#16223A]">Your workspace</h2><p className="mt-1 text-slate-500">Jump into the places you use most.</p></div><BriefcaseBusiness className="h-5 w-5 text-[#A9814A]" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspaceApps.map(({ label, detail, view, icon: Icon, tone }) => <button key={view} type="button" onClick={() => setCurrentView(view)} className="group flex items-center gap-3 rounded-xl border border-[#E1DCCF] bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#A9814A] hover:shadow-md cursor-pointer"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#16223A]">{label}</strong><span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{detail}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#A9814A]" /></button>)}
        </div>
      </section>

      <section className="firm-announcements rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
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

      <section className="firm-quick-links rounded-2xl border border-[#E1DCCF] bg-gradient-to-br from-[#fef3ee] via-[#fffdf8] to-[#eef7ff] p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E7D7BA] bg-[#fdf0d8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A5D34]">
              <ExternalLink className="h-3.5 w-3.5" /> featured
            </div>
            <h2 className="font-serif text-xl font-bold text-[#16223A]">Firm quick links</h2>
            <p className="mt-1 text-slate-500">Most-used legal portals, matter folders and daily Google Workspace tools.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#E1DCCF] bg-white px-2.5 py-2 text-[10px] font-bold text-slate-600">
            <Globe2 className="h-3.5 w-3.5 text-[#A9814A]" /> 8 groups
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {featuredLinks.map(({ label, url, accent }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer" className={`featured-link flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent}`}>
              <span className="truncate">{label}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinkGroups.map(({ title, description, icon: Icon, tone, links }) => (
            <div key={title} className="quick-link-card group rounded-2xl border border-[#E1DCCF] bg-gradient-to-br from-white via-[#fffdf8] to-[#f8f5ff] p-3 shadow-[0_2px_0_rgba(22,34,58,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D7B77F] hover:shadow-md">
              <div className="mb-3 flex items-start gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-sm font-bold text-[#16223A]">{title}</h3>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {links.map((link) => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="group/link flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-gradient-to-r from-white to-[#fffaf2] px-2.5 py-2 text-[11px] font-bold text-[#16223A] transition hover:border-[#A9814A] hover:from-[#fffaf2] hover:to-[#fdf1e7]">
                    <span className="truncate">{link.label}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 transition group-hover/link:text-[#A9814A]" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};
