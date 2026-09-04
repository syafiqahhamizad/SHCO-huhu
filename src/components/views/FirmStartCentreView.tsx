import React from 'react';
import {
  ArrowDown,
  BookMarked,
  Building2,
  CalendarDays,
  CalendarX2,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Package,
  Plus,
  PartyPopper,
  Receipt,
  Scale,
  Search,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FirmAnnouncement } from '../../types';

interface QuickLinkGroup {
  title: string;
  links: { label: string; url: string }[];
}

interface LauncherTile {
  label: string;
  detail: string;
  view: string;
  icon: React.ElementType;
  bg: string;
  module?: string;
}

const TONE = {
  navy: '#16223A',
  slate: '#33415C',
  brass: '#A9814A',
  clay: '#8C4A32',
  forest: '#2F6F4E',
  teal: '#276E77',
  plum: '#5A3A55',
  olive: '#5E6B33',
  rust: '#A15A2B',
  ink: '#243A55',
};

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });

const QUICK_LINK_GROUPS: QuickLinkGroup[] = [
  { title: 'Due diligence', links: [
    { label: 'eInsolvency', url: 'https://e-insolvensi.mdi.gov.my/' },
    { label: 'SSM e-Info', url: 'https://www.ssm-einfo.my/' },
  ] },
  { title: 'Bar', links: [
    { label: 'Malaysian Bar', url: 'https://login.malaysianbar.org.my/' },
    { label: 'Selangor Bar', url: 'https://member.selangorbar.org/login' },
  ] },
  { title: 'Litigation', links: [
    { label: 'EFS', url: 'https://efs.kehakiman.gov.my/EFSWeb/' },
    { label: 'Malaysian Judiciary', url: 'https://www.kehakiman.gov.my/' },
  ] },
  { title: 'Case files', links: [
    { label: 'Litigation', url: 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link' },
    { label: 'Conveyancing', url: 'https://drive.google.com/drive/folders/1duXHdC0jqZABBWXKI2z0omu-VuDx8eiO?usp=drive_link' },
    { label: 'Corporate', url: 'https://drive.google.com/drive/folders/13sZXUs4X0yoMEk8pBMEwwwZZAsjHHDey?usp=drive_link' },
    { label: 'Probate & Administration', url: 'https://drive.google.com/drive/folders/1cp39TLlUvvm0M3-2BDh7d6kq8s7_EhJV?usp=drive_link' },
    { label: 'Criminal', url: 'https://drive.google.com/drive/folders/1ysK_PbGNmfi8VxdM535CykjNUB4gxUwN?usp=drive_link' },
    { label: 'YBGK', url: 'https://drive.google.com/drive/folders/1cZTgUZZUQ2nNl4SwKcgFr61kfSh0C4l9?usp=drive_link' },
  ] },
  { title: 'Library', links: [
    { label: 'Practice Directions', url: 'https://intranet.kehakiman.gov.my/EAA/search.php?lang=en' },
    { label: 'Legislation (AGC)', url: 'https://lom.agc.gov.my/' },
    { label: 'eLaw', url: 'https://www.elaw.my/Default.aspx?returnUrl=https://www.elaw.my/elawquicksearch.aspx' },
    { label: 'Lexis Nexis & eBook', url: 'https://member.selangorbar.org/login' },
    { label: 'CLJ', url: 'https://www.cljlaw.com/' },
  ] },
  { title: 'Conveyancing', links: [
    { label: 'SRO 2023', url: 'https://www.malaysianbar.org.my/cms/upload_files/document/Solicitors%20Remuneration%20Order%202023.pdf' },
    { label: 'E-Tanah Selangor', url: 'https://etanah.selangor.gov.my/etanah-awam/AwamLoginForm.xhtml?isLogout=true' },
    { label: 'Smartbox Selangor', url: 'https://smartbox.selangor.gov.my/' },
    { label: 'PTG Kuala Lumpur', url: 'https://www.ptgwp.gov.my/portal/ms/' },
  ] },
  { title: 'Google Workspace', links: [
    { label: 'Gmail', url: 'https://mail.google.com/' },
    { label: 'Google Calendar', url: 'https://calendar.google.com/' },
    { label: 'Google Drive', url: 'https://drive.google.com/' },
    { label: 'Google Docs', url: 'https://docs.google.com/' },
    { label: 'Google Sheets', url: 'https://sheets.google.com/' },
    { label: 'Google Meet', url: 'https://meet.google.com/' },
    { label: 'Google Forms', url: 'https://forms.google.com/' },
  ] },
  { title: 'More resources', links: [
    { label: 'Attorney General’s Chambers', url: 'https://www.agc.gov.my/' },
    { label: 'Malaysian Bar Council', url: 'https://www.malaysianbar.org.my/' },
    { label: 'Google Admin Console', url: 'https://admin.google.com/' },
    { label: 'Google Vault', url: 'https://ediscovery.google.com/' },
  ] },
];

const LAUNCHER_TILES: LauncherTile[] = [
  { label: 'My Dashboard', detail: 'Matters and worklist', view: 'dashboard', icon: LayoutDashboard, bg: TONE.navy },
  { label: 'Staff Portal', detail: 'Leave, claims, personnel', view: 'staff-portal', icon: UserCog, bg: TONE.teal, module: 'staffPortal' },
  { label: 'Client Portal', detail: 'What clients see', view: 'client-portal', icon: UserCheck, bg: TONE.plum },
  { label: 'Practice', detail: 'Cases, clients, hearings', view: 'cases', icon: Scale, bg: TONE.brass },
  { label: 'Calendar', detail: 'Hearings and firm dates', view: 'calendar', icon: CalendarDays, bg: TONE.olive },
  { label: 'Claims', detail: 'Disbursements', view: 'reimbursements', icon: Receipt, bg: TONE.rust, module: 'reimbursements' },
  { label: 'Billing', detail: 'Quotations, invoices, receipts', view: 'invoices', icon: FileSpreadsheet, bg: TONE.clay, module: 'invoices' },
  { label: 'Accounting', detail: 'Firm and client account', view: 'accountingCentre', icon: Building2, bg: TONE.forest, module: 'accountingCentre' },
  { label: 'Firm Inventory', detail: 'Assets and office stock', view: 'inventory', icon: Package, bg: TONE.slate, module: 'inventory' },
  // TODO: point Library at a dedicated view once one exists; it currently opens the Law Library tab of Inventory.
  { label: 'Library', detail: 'Research and legislation', view: 'inventory', icon: BookMarked, bg: TONE.ink, module: 'inventory' },
];

export const FirmStartCentreView: React.FC = () => {
  const {
    currentUser,
    currentRole,
    users,
    announcements,
    setCurrentView,
    setIsNewCaseModalOpen,
    canViewModule,
  } = useApp() as ReturnType<typeof useApp> & { canViewModule?: (module: string) => boolean };

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const internal = announcements.filter((a: FirmAnnouncement) => a.published && a.internalOnly);
  const dateOf = (a: FirmAnnouncement) => a.eventDate || a.createdAt.slice(0, 10);
  const holidays = internal
    .filter((a) => a.category === 'Holiday')
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const notices = internal
    .filter((a) => a.category !== 'Holiday')
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
    .slice(0, 2);
  const [nextHoliday, ...laterHolidays] = holidays;
  const daysAway = nextHoliday
    ? Math.round((new Date(`${dateOf(nextHoliday)}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86400000)
    : null;

  const celebrations = users
    .flatMap((user) => {
      if (user.staffProfile?.celebrationOptOut) return [];
      const annual = (value: string) => `${today.getFullYear()}-${value.slice(5)}`;
      const items: { id: string; name: string; detail: string; date: string }[] = [];
      if (user.staffProfile?.birthday) items.push({ id: `${user.id}-b`, name: user.name, detail: 'Birthday', date: annual(user.staffProfile.birthday) });
      if (user.staffProfile?.callToBarDate) items.push({ id: `${user.id}-c`, name: user.name, detail: 'Call to the Bar', date: annual(user.staffProfile.callToBarDate) });
      if (user.staffProfile?.joinDate) items.push({ id: `${user.id}-j`, name: user.name, detail: 'Firm anniversary', date: annual(user.staffProfile.joinDate) });
      return items;
    })
    .filter((item) => item.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const canOpen = (module?: string) => !module || !canViewModule || canViewModule(module);
  const tiles = LAUNCHER_TILES.filter((tile) => canOpen(tile.module));

  return (
    <div className="w-full space-y-3.5 pb-8 text-xs">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-[#304362] bg-[#16223A] px-6 py-5 text-white shadow-lg">
        <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-gradient-to-l from-[#A9814A]/25 to-transparent sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-2xl flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B97755]">
              <Scale className="h-4 w-4" /> Firm Start Centre
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-wider text-slate-300">{currentRole}</span>
            </div>
            <h1 className="font-serif text-[27px] font-bold -tracking-[0.02em]">{greeting}, {currentUser.name.split(' ')[0]}</h1>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button type="button" onClick={() => setIsNewCaseModalOpen(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#A9814A] px-3 py-2 font-bold text-white transition hover:bg-[#C29A5A]">
                <Plus className="h-3.5 w-3.5" /> New matter
              </button>
              <button type="button" onClick={() => setCurrentView('cases')} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-bold text-white transition hover:bg-white/20">
                <Search className="h-3.5 w-3.5" /> Find a record
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-2 text-right">
            <span className="font-serif text-lg font-bold">{today.toLocaleDateString('en-MY', { weekday: 'long' })}</span>
            <span className="font-mono text-xs text-slate-300">{today.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* urgent strip */}
        <div className="relative mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2 border-t border-white/15 pt-3">
          {nextHoliday && (
            <span className="flex min-w-0 items-center gap-2">
              <CalendarX2 className="h-3.5 w-3.5 shrink-0 text-[#C98D70]" />
              <span className="text-xs text-white">
                <strong className="font-bold">Office closed {formatDay(dateOf(nextHoliday))}</strong>
                <span className="text-slate-300"> — {nextHoliday.title}</span>
              </span>
            </span>
          )}
          {nextHoliday && notices.length > 0 && <span className="h-3.5 w-px bg-white/20" />}
          {notices[0] && (
            <span className="flex min-w-0 items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-[#C98D70]" />
              <span className="truncate text-xs text-slate-300">{notices[0].title}</span>
            </span>
          )}
          <a href="#announcements" className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#E4C79A] no-underline">
            All announcements <ArrowDown className="h-3 w-3" />
          </a>
        </div>
      </section>

      {/* ANNOUNCEMENTS — holidays / notices / celebrations */}
      <section id="announcements" className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]">
              <Megaphone className="h-4 w-4 text-[#A9814A]" /> Firm announcements
            </h2>
            <p className="mt-1 text-slate-500">Internal notices, celebrations and firm dates.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* holidays — dominant */}
          <div className="flex flex-col gap-3 rounded-xl bg-[#16223A] p-4 text-white">
            <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#C98D70]">
              <CalendarX2 className="h-3.5 w-3.5" /> Holidays &amp; office closures
            </div>
            {nextHoliday ? (
              <>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold leading-none tabular-nums">
                      {new Date(`${dateOf(nextHoliday)}T00:00:00`).getDate()}
                    </span>
                    <span className="font-serif text-[17px] font-semibold text-[#E4D9C6]">
                      {new Date(`${dateOf(nextHoliday)}T00:00:00`).toLocaleDateString('en-MY', { month: 'short' })}
                    </span>
                    {daysAway !== null && (
                      <span className="ml-auto rounded-full border border-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">
                        {daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-serif text-[17px] font-semibold -tracking-[0.01em]">{nextHoliday.title}</h3>
                  <p className="mt-1 leading-relaxed text-slate-300">{nextHoliday.body}</p>
                </div>
                {laterHolidays.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-white/15 pt-2.5">
                    {laterHolidays.slice(0, 3).map((holiday) => (
                      <div key={holiday.id} className="flex items-baseline justify-between gap-2.5">
                        <span className="truncate text-[#EDE9DD]">{holiday.title}</span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-400">{formatDay(dateOf(holiday))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-300">No upcoming closures recorded.</p>
            )}
          </div>

          {/* firm notices */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E8D9CE] bg-white p-4">
            <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#8A8578]">
              <Megaphone className="h-3.5 w-3.5 text-[#A9814A]" /> Firm notices
            </div>
            {notices.length ? (
              <div className="flex flex-col gap-3">
                {notices.map((notice, index) => (
                  <React.Fragment key={notice.id}>
                    {index > 0 && <div className="h-px bg-[#F1EBE0]" />}
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#7A5D34]">{notice.category}</span>
                        <span className="font-mono text-[10px] text-[#A6A091]">{formatDay(dateOf(notice))}</span>
                      </div>
                      <h3 className="mt-0.5 font-serif text-[14.5px] font-semibold text-[#16223A]">{notice.title}</h3>
                      <p className="mt-0.5 leading-relaxed text-[#5B6478]">{notice.body}</p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">No notices published.</p>
            )}
          </div>

          {/* celebrations */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E8D9CE] bg-white p-4">
            <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#8A8578]">
              <PartyPopper className="h-3.5 w-3.5 text-[#A9814A]" /> Celebrations
            </div>
            {celebrations.length ? (
              <div className="flex flex-col gap-2.5">
                {celebrations.map((celebration, index) => (
                  <React.Fragment key={celebration.id}>
                    {index > 0 && <div className="h-px bg-[#F1EBE0]" />}
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E7D7BA] bg-[#F8F2E7] font-serif text-xs font-semibold text-[#7A5D34]">
                        {initials(celebration.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[13px] font-semibold text-[#16223A]">{celebration.name}</strong>
                        <span className="block text-[10.5px] text-[#7A8296]">{celebration.detail}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-[#5B6478]">{formatDay(celebration.date)}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">Nothing coming up.</p>
            )}
          </div>
        </div>
      </section>

      {/* LAUNCHER + QUICK LINKS RAIL */}
      <div className="flex flex-wrap items-start gap-3.5">
        <div className="min-w-0 flex-1 basis-[560px]">
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-bold -tracking-[0.015em] text-[#16223A]">Everything in the firm</h2>
                <p className="mt-1 text-[#7A8296]">Every module you can open, in one place.</p>
              </div>
              <LayoutGrid className="h-5 w-5 text-[#A9814A]" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-2.5">
              {tiles.map(({ label, detail, view, icon: Icon, bg }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  style={{ backgroundColor: bg }}
                  className="flex min-h-[104px] cursor-pointer items-center gap-3 rounded-2xl p-3.5 text-left text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-[13px] font-bold leading-tight">{label}</strong>
                    <span className="mt-0.5 block text-[10px] leading-snug text-white/70">{detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex min-w-[250px] basis-[296px] flex-col overflow-hidden rounded-2xl border border-[#E1DCCF] bg-[#FDFBF7]">
          <div className="flex items-center justify-between gap-2.5 border-b border-[#EDE6DA] px-4 py-3.5">
            <div>
              <h2 className="font-serif text-[15px] font-bold text-[#16223A]">Quick links</h2>
              <p className="mt-0.5 text-[10.5px] text-[#7A8296]">Portals, folders and Workspace</p>
            </div>
            <Globe2 className="h-4 w-4 shrink-0 text-[#A9814A]" />
          </div>
          <div className="flex max-h-[560px] flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
            {QUICK_LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-[#A6A091]">{group.title}</div>
                <div className="flex flex-wrap gap-[5px]">
                  {group.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E8D9CE] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#2C241F] no-underline transition hover:border-[#A9814A] hover:bg-[#F6F1E9] hover:text-[#16223A]"
                    >
                      <span className="truncate">{link.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
