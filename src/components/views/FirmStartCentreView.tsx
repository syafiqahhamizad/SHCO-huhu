import React from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Book,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Building2,
  Calendar,
  CalendarDays,
  CalendarX2,
  ChevronRight,
  Clipboard,
  Contact,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  FileText,
  Files,
  Folder,
  FolderOpen,
  Gavel,
  Globe2,
  GraduationCap,
  HardDrive,
  Home,
  House,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Library,
  ListChecks,
  Mail,
  Map,
  MapPin,
  Megaphone,
  Network,
  Package,
  PartyPopper,
  Plus,
  Receipt,
  Scale,
  ScrollText,
  Search,
  SearchCheck,
  Settings,
  ShieldCheck,
  Table,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  UsersRound,
  Video,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FirmAnnouncement, FirmAnnouncementCategory } from '../../types';

interface QuickLink {
  label: string;
  url: string;
  icon: React.ElementType;
}
interface QuickLinkGroup {
  title: string;
  icon: React.ElementType;
  links: QuickLink[];
}
interface LauncherTile {
  label: string;
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
  deepTeal: '#1E5C5A',
  plum: '#5A3A55',
  olive: '#5E6B33',
  rust: '#A15A2B',
  ink: '#243A55',
};

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });

const HOME_TAB = { id: 'home', label: 'Overview', icon: Home } as const;

// Icons available when adding/editing a Firm Start Centre page or card; falls back to BookOpen.
const START_CENTRE_ICONS: Record<string, React.ElementType> = {
  UserPlus, BookOpen, Network, ShieldCheck, ListChecks, GraduationCap, FolderOpen, Scale, Contact, Package, Building2,
};
const iconFor = (name: string) => START_CENTRE_ICONS[name] || BookOpen;
const LinkIconFallback = FileText;

const QUICK_LINK_GROUPS: QuickLinkGroup[] = [
  { title: 'Due diligence', icon: SearchCheck, links: [
    { label: 'eInsolvency', icon: FileSearch, url: 'https://e-insolvensi.mdi.gov.my/' },
    { label: 'SSM e-Info', icon: Building2, url: 'https://www.ssm-einfo.my/' },
  ] },
  { title: 'Bar', icon: Scale, links: [
    { label: 'Malaysian Bar', icon: Landmark, url: 'https://login.malaysianbar.org.my/' },
    { label: 'Selangor Bar', icon: Landmark, url: 'https://member.selangorbar.org/login' },
  ] },
  { title: 'Litigation', icon: Gavel, links: [
    { label: 'EFS', icon: FileStack, url: 'https://efs.kehakiman.gov.my/EFSWeb/' },
    { label: 'Malaysian Judiciary', icon: Landmark, url: 'https://www.kehakiman.gov.my/' },
  ] },
  { title: 'Case files', icon: FolderOpen, links: [
    { label: 'Litigation', icon: Folder, url: 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link' },
    { label: 'Conveyancing', icon: Folder, url: 'https://drive.google.com/drive/folders/1duXHdC0jqZABBWXKI2z0omu-VuDx8eiO?usp=drive_link' },
    { label: 'Corporate', icon: Folder, url: 'https://drive.google.com/drive/folders/13sZXUs4X0yoMEk8pBMEwwwZZAsjHHDey?usp=drive_link' },
    { label: 'Probate & Administration', icon: Folder, url: 'https://drive.google.com/drive/folders/1cp39TLlUvvm0M3-2BDh7d6kq8s7_EhJV?usp=drive_link' },
    { label: 'Criminal', icon: Folder, url: 'https://drive.google.com/drive/folders/1ysK_PbGNmfi8VxdM535CykjNUB4gxUwN?usp=drive_link' },
    { label: 'YBGK', icon: Folder, url: 'https://drive.google.com/drive/folders/1cZTgUZZUQ2nNl4SwKcgFr61kfSh0C4l9?usp=drive_link' },
  ] },
  { title: 'Library', icon: BookMarked, links: [
    { label: 'Practice Directions', icon: ScrollText, url: 'https://intranet.kehakiman.gov.my/EAA/search.php?lang=en' },
    { label: 'Legislation (AGC)', icon: Book, url: 'https://lom.agc.gov.my/' },
    { label: 'eLaw', icon: Search, url: 'https://www.elaw.my/Default.aspx?returnUrl=https://www.elaw.my/elawquicksearch.aspx' },
    { label: 'Lexis Nexis & eBook', icon: Library, url: 'https://member.selangorbar.org/login' },
    { label: 'CLJ', icon: BookOpen, url: 'https://www.cljlaw.com/' },
  ] },
  { title: 'Conveyancing', icon: House, links: [
    { label: 'SRO 2023', icon: FileText, url: 'https://www.malaysianbar.org.my/cms/upload_files/document/Solicitors%20Remuneration%20Order%202023.pdf' },
    { label: 'E-Tanah Selangor', icon: Map, url: 'https://etanah.selangor.gov.my/etanah-awam/AwamLoginForm.xhtml?isLogout=true' },
    { label: 'Smartbox Selangor', icon: Package, url: 'https://smartbox.selangor.gov.my/' },
    { label: 'PTG Kuala Lumpur', icon: MapPin, url: 'https://www.ptgwp.gov.my/portal/ms/' },
  ] },
  { title: 'Google Workspace', icon: LayoutGrid, links: [
    { label: 'Gmail', icon: Mail, url: 'https://mail.google.com/' },
    { label: 'Google Calendar', icon: Calendar, url: 'https://calendar.google.com/' },
    { label: 'Google Drive', icon: HardDrive, url: 'https://drive.google.com/' },
    { label: 'Google Docs', icon: FileText, url: 'https://docs.google.com/' },
    { label: 'Google Sheets', icon: Table, url: 'https://sheets.google.com/' },
    { label: 'Google Meet', icon: Video, url: 'https://meet.google.com/' },
    { label: 'Google Forms', icon: Clipboard, url: 'https://forms.google.com/' },
  ] },
  { title: 'More resources', icon: BookMarked, links: [
    { label: 'Attorney General’s Chambers', icon: Landmark, url: 'https://www.agc.gov.my/' },
    { label: 'Malaysian Bar Council', icon: UsersRound, url: 'https://www.malaysianbar.org.my/' },
    { label: 'Google Admin Console', icon: Settings, url: 'https://admin.google.com/' },
    { label: 'Google Vault', icon: HardDrive, url: 'https://ediscovery.google.com/' },
  ] },
];

const SMALL_TILES: LauncherTile[] = [
  { label: 'Practice', view: 'cases', icon: Scale, bg: TONE.brass },
  { label: 'Calendar', view: 'calendar', icon: CalendarDays, bg: TONE.olive },
  { label: 'Billing', view: 'invoices', icon: FileSpreadsheet, bg: TONE.clay, module: 'invoices' },
  { label: 'Claims', view: 'reimbursements', icon: Receipt, bg: TONE.rust, module: 'reimbursements' },
  { label: 'Accounting', view: 'accountingCentre', icon: Building2, bg: TONE.forest, module: 'accountingCentre' },
  { label: 'Trust Account', view: 'clientAccount', icon: ShieldCheck, bg: TONE.deepTeal, module: 'clientAccount' },
  { label: 'Staff Portal', view: 'staff-portal', icon: UserCog, bg: TONE.teal, module: 'staffPortal' },
  { label: 'Client Portal', view: 'client-portal', icon: UserCheck, bg: TONE.plum },
  { label: 'Firm Inventory', view: 'inventory', icon: Package, bg: TONE.slate, module: 'inventory' },
  // TODO: point Library at a dedicated view once one exists; it currently opens the Law Library tab of Inventory.
  { label: 'Library', view: 'inventory', icon: BookMarked, bg: TONE.ink, module: 'inventory' },
];

const SHELVES = [
  { icon: ShieldCheck, title: 'Firm policies', detail: 'Leave, conflicts, IT & data, AMLA obligations, client care.' },
  { icon: ListChecks, title: 'Department SOPs', detail: 'Step-by-step for litigation, conveyancing, corporate, probate, criminal.' },
  { icon: Files, title: 'Precedents & templates', detail: 'Pleadings, agreements, standard letters and engagement packs.' },
  { icon: Scale, title: 'Compliance — SAR 1990 & AMLA', detail: 'Trust account rules, reporting duties, audit checklists.' },
  { icon: UserPlus, title: 'HR & onboarding', detail: 'New joiner packs, pupillage guide, appraisal and claims forms.' },
  { icon: GraduationCap, title: 'Training & CPD', detail: 'Recorded sessions, CPD tracking and Bar circular digests.' },
];

const STATUS_TONE: Record<string, string> = {
  'In court': '#33415C',
  'In office': '#2F6F4E',
  Leave: '#8C3F1F',
};

export const FirmStartCentreView: React.FC = () => {
  const {
    currentUser,
    currentRole,
    users,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    setCurrentView,
    setIsNewCaseModalOpen,
    canViewModule,
    firmStartCentrePages,
    canEditFirmStartCentre,
    addStartCentrePage,
    updateStartCentrePageLabel,
    deleteStartCentrePage,
    addStartCentreCard,
    updateStartCentreCard,
    deleteStartCentreCard,
  } = useApp() as ReturnType<typeof useApp> & { canViewModule?: (module: string) => boolean };

  const canEditStartCentre = canEditFirmStartCentre;

  const [openGroup, setOpenGroup] = React.useState<number>(3);
  const [directoryOpen, setDirectoryOpen] = React.useState(false);
  const [page, setPage] = React.useState<string>('home');
  const [editMode, setEditMode] = React.useState(false);
  const [newTabLabel, setNewTabLabel] = React.useState('');
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [tabLabelDraft, setTabLabelDraft] = React.useState('');
  const [cardDraft, setCardDraft] = React.useState<{ pageId: string; cardId: string | null; title: string; detail: string } | null>(null);
  const [quickLinkGroups, setQuickLinkGroups] = React.useState<QuickLinkGroup[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('shco_firm_start_quick_links') || 'null');
      if (Array.isArray(stored)) return stored.map((group, index) => ({ ...group, icon: QUICK_LINK_GROUPS[index]?.icon || BookMarked, links: (group.links || []).map((link: QuickLink) => ({ ...link, icon: FileText })) }));
    } catch { }
    return QUICK_LINK_GROUPS;
  });
  const [launcherTiles, setLauncherTiles] = React.useState<LauncherTile[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('shco_firm_start_modules') || 'null');
      if (Array.isArray(stored)) return stored.map((tile, index) => ({ ...tile, icon: SMALL_TILES[index]?.icon || LayoutGrid }));
    } catch { }
    return SMALL_TILES;
  });
  const [shelves, setShelves] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('shco_firm_start_shelves') || 'null');
      if (Array.isArray(stored)) return stored.map((shelf) => ({ ...shelf, icon: BookOpen }));
    } catch { }
    return SHELVES;
  });

  React.useEffect(() => { localStorage.setItem('shco_firm_start_quick_links', JSON.stringify(quickLinkGroups.map(({ title, links }) => ({ title, links: links.map(({ label, url }) => ({ label, url })) })))); }, [quickLinkGroups]);
  React.useEffect(() => { localStorage.setItem('shco_firm_start_modules', JSON.stringify(launcherTiles.map(({ label, view, bg, module }) => ({ label, view, bg, module })))); }, [launcherTiles]);
  React.useEffect(() => { localStorage.setItem('shco_firm_start_shelves', JSON.stringify(shelves.map(({ title, detail }) => ({ title, detail })))); }, [shelves]);
  const [announcementOpen, setAnnouncementOpen] = React.useState(false);
  const [announcementDraft, setAnnouncementDraft] = React.useState({
    title: '',
    body: '',
    category: 'Announcement' as FirmAnnouncementCategory,
    eventDate: '',
  });

  const activePage = firmStartCentrePages.find((p) => p.id === page);

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

  // Presence: staffProfile.presence is expected to be 'In office' | 'In court' | 'Leave'.
  const presence = users.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.staffProfile?.designation || user.role || '',
    status: (user.staffProfile as { presence?: string } | undefined)?.presence || 'In office',
    extension: (user.staffProfile as { extension?: string } | undefined)?.extension || '',
    mobile: (user.staffProfile as { mobile?: string } | undefined)?.mobile || '',
  }));
  const count = (status: string) => presence.filter((p) => p.status === status).length;

  const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const canOpen = (module?: string) => !module || !canViewModule || canViewModule(module);
  const tiles = launcherTiles.filter((tile) => canOpen(tile.module));

  return (
    <div className="w-full space-y-5 pb-8 text-xs">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-[#4D5870] bg-gradient-to-br from-[#16223A] via-[#1C2B48] to-[#263857] px-[18px] py-3.5 text-[#F6F1E9] shadow-[0_18px_35px_-20px_rgba(22,34,58,.9)]">
        <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-gradient-to-l from-[#C9A46B]/25 via-[#A9814A]/10 to-transparent sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-3.5">
          <div className="flex max-w-2xl flex-col gap-[7px]">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#B97755]">
              <Scale className="h-4 w-4" /> Firm Start Centre
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] tracking-wider text-slate-300">{currentRole}</span>
            </div>
            <h1 className="font-serif text-xl font-bold -tracking-[0.02em] text-[#F6F1E9]">{greeting}, {currentUser.name.split(' ')[0]}</h1>
            <p className="max-w-[56ch] text-[11.5px] leading-normal text-slate-300">
              Notices, people, policies and portals. Your own matters and tasks are on{' '}
              <button type="button" onClick={() => setCurrentView('dashboard')} className="cursor-pointer font-semibold text-[#E4C79A]">
                My Dashboard →
              </button>
            </p>
            <div className="flex flex-wrap gap-1.5 pt-px">
              <button type="button" onClick={() => setIsNewCaseModalOpen(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#A9814A] px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-[#C29A5A]">
                <Plus className="h-3.5 w-3.5" /> New matter
              </button>
              <button type="button" onClick={() => { setDirectoryOpen(true); document.getElementById('people')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4C79A]/40 bg-[#E4C79A]/15 px-2.5 py-1.5 text-[11.5px] font-bold text-[#F6F1E9] transition hover:bg-[#E4C79A]/25">
                <Contact className="h-3.5 w-3.5" /> Staff directory
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-2 text-right">
            <span className="font-serif text-sm font-bold">{today.toLocaleDateString('en-MY', { weekday: 'long' })}</span>
            <span className="font-mono text-[11px] text-slate-300">{today.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="relative mt-2.5 flex items-center gap-3 overflow-hidden border-t border-white/15 pt-[9px]">
          {nextHoliday && (
            <span className="flex shrink-0 items-center gap-2">
              <CalendarX2 className="h-3.5 w-3.5 shrink-0 text-[#C98D70]" />
              <span className="text-[11.5px] text-white">
                <strong className="font-bold">Office closed {formatDay(dateOf(nextHoliday))}</strong>
                <span className="text-slate-300"> — {nextHoliday.title}</span>
              </span>
            </span>
          )}
          {nextHoliday && notices.length > 0 && <span className="h-3.5 w-px bg-white/20" />}
          {notices[0] && (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-[#C98D70]" />
              <span className="truncate text-[11.5px] text-slate-300">{notices[0].title}</span>
            </span>
          )}
          <a href="#announcements" className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#E4C79A] no-underline">
            All announcements <ArrowDown className="h-3 w-3" />
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* TAB NAV */}
          <nav className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#304362] bg-[#16223A] px-2.5 py-2">
            {[HOME_TAB, ...firmStartCentrePages].map((tab) => {
              const on = tab.id === page;
              const TabIcon = tab.id === 'home' ? Home : iconFor((tab as { icon: string }).icon);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPage(tab.id)}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    on ? 'border-[#E4C79A] bg-[#E4C79A] text-[#16223A]' : 'border-[#304362] bg-transparent text-[#E4C79A]'
                  }`}
                >
                  <TabIcon className="h-[13px] w-[13px]" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            {canEditStartCentre && (
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={`ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  editMode ? 'border-white bg-white text-[#16223A]' : 'border-[#304362] bg-transparent text-white/70'
                }`}
              >
                {editMode ? 'Done editing' : 'Edit tabs & content'}
              </button>
            )}
          </nav>

          {editMode && (
            <section className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#C9A46B] bg-[#FDFBF7] px-3.5 py-2.5">
              <input
                type="text"
                value={newTabLabel}
                onChange={(e) => setNewTabLabel(e.target.value)}
                placeholder="New tab name..."
                className="min-w-0 flex-1 rounded-lg border border-[#E8D9CE] bg-white px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (addStartCentrePage(newTabLabel)) setNewTabLabel('');
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#16223A] px-3 py-1.5 text-xs font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add tab
              </button>
              {page !== 'home' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTabId(page);
                      setTabLabelDraft(activePage?.label || '');
                    }}
                    className="shrink-0 cursor-pointer rounded-lg border border-[#E8D9CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#16223A]"
                  >
                    Rename current tab
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (deleteStartCentrePage(page)) setPage('home');
                    }}
                    className="shrink-0 cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600"
                  >
                    Delete current tab
                  </button>
                </>
              )}
              {editingTabId && (
                <div className="flex w-full items-center gap-2">
                  <input
                    type="text"
                    value={tabLabelDraft}
                    onChange={(e) => setTabLabelDraft(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[#E8D9CE] bg-white px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (updateStartCentrePageLabel(editingTabId, tabLabelDraft)) setEditingTabId(null);
                    }}
                    className="shrink-0 cursor-pointer rounded-lg bg-[#16223A] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Save name
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTabId(null)}
                    className="shrink-0 cursor-pointer rounded-lg border border-[#E8D9CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#16223A]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>
          )}

          {page === 'home' && (
            <>

          {/* ANNOUNCEMENTS */}
          <section id="announcements" className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]">
                  <Megaphone className="h-4 w-4 text-[#A9814A]" /> Firm announcements
                </h2>
                <p className="mt-1 text-slate-500">Internal notices, celebrations and firm dates.</p>
              </div>
              {canEditStartCentre && (
                <button type="button" onClick={() => setAnnouncementOpen((open) => !open)} className="flex cursor-pointer items-center gap-1.5 self-start rounded-lg bg-[#16223A] px-3 py-2 text-xs font-bold text-white">
                  <Plus className="h-3.5 w-3.5 text-[#E4C79A]" /> {announcementOpen ? 'Close form' : 'Publish announcement'}
                </button>
              )}
            </div>

            {announcementOpen && (
              <form
                className="mb-4 grid gap-3 rounded-xl border border-[#D8C5A5] bg-[#FDFBF7] p-4 shadow-sm sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (addAnnouncement({ ...announcementDraft, published: true, internalOnly: true })) {
                    setAnnouncementDraft({ title: '', body: '', category: 'Announcement', eventDate: '' });
                    setAnnouncementOpen(false);
                  }
                }}
              >
                <div className="sm:col-span-2">
                  <div className="font-serif text-sm font-bold text-[#16223A]">Publish a firm notice</div>
                  <p className="mt-0.5 text-[11px] text-[#7A8296]">Use this for internal notices, policies, alerts, and office closure dates.</p>
                </div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8296]">Title<input required value={announcementDraft.title} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, title: event.target.value })} placeholder="e.g. Updated file-closing checklist" className="mt-1 w-full rounded-lg border border-[#E8D9CE] bg-white px-3 py-2 text-xs normal-case tracking-normal text-[#2C241F]" /></label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8296]">Type<select value={announcementDraft.category} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, category: event.target.value as FirmAnnouncementCategory })} className="mt-1 w-full rounded-lg border border-[#E8D9CE] bg-white px-3 py-2 text-xs normal-case tracking-normal text-[#2C241F]">
                  {['Announcement', 'Holiday', 'Policy', 'Alert', 'Birthday', 'Call to the Bar', 'Work Anniversary', 'Firm Anniversary'].map((category) => <option key={category}>{category}</option>)}
                </select></label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8296] sm:col-span-2">Details<textarea required value={announcementDraft.body} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, body: event.target.value })} placeholder="Write the notice or closure details" rows={3} className="mt-1 w-full rounded-lg border border-[#E8D9CE] bg-white px-3 py-2 text-xs normal-case tracking-normal text-[#2C241F]" /></label>
                <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8296]">Event date<input type="date" value={announcementDraft.eventDate} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, eventDate: event.target.value })} className="mt-1 block rounded-lg border border-[#E8D9CE] bg-white px-3 py-1.5 text-xs normal-case tracking-normal text-[#2C241F]" /></label>
                    <p className="mt-1 text-[10px] text-[#8A8578]">Birthdays and call-to-the-bar dates come from Staff Portal profiles.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAnnouncementOpen(false)} className="rounded-lg border border-[#E8D9CE] bg-white px-3 py-2 text-xs font-semibold text-[#16223A]">Cancel</button>
                    <button type="submit" className="rounded-lg bg-[#16223A] px-3 py-2 text-xs font-bold text-white shadow-sm">Publish notice</button>
                  </div>
                </div>
              </form>
            )}

            <div className="flex flex-wrap items-stretch gap-3">
              {/* holidays — dominant, full height of the left half */}
              <div className="flex min-w-0 flex-1 basis-[150px]">
                <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl bg-[#16223A] p-4 text-white">
                  <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#C98D70]">
                    <CalendarX2 className="h-3.5 w-3.5" /> Holidays &amp; office closures
                  </div>
                  {nextHoliday ? (
                    <>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-[32px] font-bold leading-none tabular-nums">
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
                        <div className="flex items-start justify-between gap-2"><h3 className="mt-1.5 font-serif text-base font-semibold -tracking-[0.01em]">{nextHoliday.title}</h3>{canEditStartCentre && <button type="button" onClick={() => { if (window.confirm(`Delete “${nextHoliday.title}”?`)) deleteAnnouncement(nextHoliday.id); }} title="Delete closure" aria-label={`Delete ${nextHoliday.title}`} className="shrink-0 cursor-pointer rounded-md p-1 text-slate-300 transition hover:bg-white/10 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
                        <p className="mt-1 leading-relaxed text-slate-300">{nextHoliday.body}</p>
                      </div>
                      {laterHolidays.length > 0 && (
                        <div className="flex flex-col gap-2 border-t border-white/15 pt-2.5">
                          {laterHolidays.slice(0, 3).map((holiday) => (
                            <div key={holiday.id} className="flex items-baseline justify-between gap-2.5">
                              <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-[#EDE9DD]">{holiday.title}</span>{canEditStartCentre && <button type="button" onClick={() => { if (window.confirm(`Delete “${holiday.title}”?`)) deleteAnnouncement(holiday.id); }} title="Delete closure" aria-label={`Delete ${holiday.title}`} className="shrink-0 cursor-pointer text-slate-400 hover:text-red-200"><Trash2 className="h-3 w-3" /></button>}</span>
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
              </div>

              {/* notices + celebrations stacked in the right half */}
              <div className="flex min-w-0 flex-1 basis-[150px] flex-col gap-3">
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
                            <div className="flex items-start justify-between gap-2"><h3 className="mt-0.5 font-serif text-[14.5px] font-semibold text-[#16223A]">{notice.title}</h3>{canEditStartCentre && <button type="button" onClick={() => { if (window.confirm(`Delete “${notice.title}”?`)) deleteAnnouncement(notice.id); }} title="Delete announcement" aria-label={`Delete ${notice.title}`} className="shrink-0 cursor-pointer rounded-md p-1 text-[#A6A091] transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
                            <p className="mt-0.5 leading-relaxed text-[#5B6478]">{notice.body}</p>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No notices published.</p>
                  )}
                </div>

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
            </div>
          </section>

          {/* TODAY AT THE FIRM */}
          <section id="people" className="flex flex-col gap-2.5 rounded-xl border border-[#E8D9CE] bg-white px-4 py-3.5 shadow-xs scroll-mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-[7px] text-[9.5px] font-bold uppercase tracking-[0.13em] text-[#8A8578]">
                <UsersRound className="h-3.5 w-3.5 text-[#A9814A]" /> Today at the firm
              </span>
              <span className="flex flex-wrap gap-1.5 text-[9.5px] font-bold">
                <span className="rounded-full bg-[#EEF4EE] px-[7px] py-0.5 text-[#2F6F4E]">{count('In office')} in</span>
                <span className="rounded-full bg-[#F1F4F9] px-[7px] py-0.5 text-[#33415C]">{count('In court')} court</span>
                <span className="rounded-full bg-[#FFF4EE] px-[7px] py-0.5 text-[#8C3F1F]">{count('Leave')} leave</span>
              </span>
              <button type="button" onClick={() => { setDirectoryOpen(true); document.getElementById('people')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="ml-auto cursor-pointer text-[10.5px] font-bold text-[#8A6534]">
                All {presence.length} →
              </button>
            </div>
            <div className="flex flex-col gap-[7px]">
              {presence.slice(0, 5).map((person, index) => (
                <React.Fragment key={person.id}>
                  {index > 0 && <div className="h-px bg-[#F1EBE0]" />}
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E7D7BA] bg-[#F8F2E7] font-serif text-[10px] font-semibold text-[#7A5D34]">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[#16223A]">{person.name}</span>
                    <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: STATUS_TONE[person.status] || '#5B6478' }}>
                      {person.status}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* LAUNCHER */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-serif text-xl font-bold -tracking-[0.015em] text-[#16223A]">
                  <LayoutGrid className="h-[18px] w-[18px] text-[#A9814A]" /> Go to a module
                </h2>
                <p className="mt-1 text-[#7A8296]">Every part of the practice, one click away.</p>
              </div>
              {canEditStartCentre && <button type="button" onClick={() => { const label = window.prompt('Module name'); const view = label && window.prompt('App view ID, e.g. cases or calendar'); if (label?.trim() && view?.trim()) setLauncherTiles((items) => [...items, { label: label.trim(), view: view.trim(), icon: LayoutGrid, bg: TONE.ink }]); }} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#16223A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5 text-[#E4C79A]" /> Add module</button>}
            </div>
            <div className="flex flex-wrap items-stretch gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="flex min-w-[180px] flex-1 basis-[200px] cursor-pointer flex-col justify-between gap-4 rounded-2xl bg-[#16223A] p-[18px] text-left text-white shadow-lg transition hover:-translate-y-0.5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                  <LayoutDashboard className="h-[22px] w-[22px]" />
                </span>
                <span className="block">
                  <strong className="block font-serif text-[19px] font-bold leading-tight text-white">My Dashboard</strong>
                  <span className="mt-1 block text-[11.5px] leading-snug text-white/70">Your matters, tasks and deadlines for today</span>
                </span>
              </button>
              <div className="grid min-w-0 flex-1 basis-[300px] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] content-start gap-2">
                {tiles.map(({ label, view, icon: Icon, bg }) => (
                  <div key={label} className="relative">
                    <button type="button" onClick={() => setCurrentView(view)} style={{ backgroundColor: bg }} className="flex min-h-[82px] w-full cursor-pointer flex-col gap-2 rounded-xl p-3 text-left text-white transition hover:-translate-y-0.5 hover:shadow-lg">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white/20"><Icon className="h-3.5 w-3.5" /></span>
                      <strong className="text-xs font-bold leading-tight text-white">{label}</strong>
                    </button>
                    {canEditStartCentre && <div className="absolute right-1 top-1 flex gap-1"><button type="button" onClick={() => { const nextLabel = window.prompt('Module name', label); const nextView = nextLabel && window.prompt('App view ID', view); if (nextLabel?.trim() && nextView?.trim()) setLauncherTiles((items) => items.map((item) => item.label === label ? { ...item, label: nextLabel.trim(), view: nextView.trim() } : item)); }} className="rounded bg-white/90 px-1 text-[9px] font-bold text-[#16223A]">Edit</button><button type="button" onClick={() => { if (window.confirm(`Delete module “${label}”?`)) setLauncherTiles((items) => items.filter((item) => item.label !== label)); }} className="rounded bg-white/90 px-1 text-[9px] font-bold text-red-700">Delete</button></div>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* HOW THE FIRM WORKS */}
          <section className="rounded-2xl border border-[#E1DCCF] bg-[#FDFBF7] p-[18px] pb-4 shadow-xs">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EDE6DA] pb-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-serif text-xl font-bold -tracking-[0.015em] text-[#16223A]">
                  <BookOpenCheck className="h-[18px] w-[18px] text-[#A9814A]" /> How the firm works
                </h2>
                <p className="mt-1 text-[#7A8296]">Six shelves. Open one to browse every document inside it.</p>
              </div>
              {canEditStartCentre && <button type="button" onClick={() => { const title = window.prompt('Shelf name'); const detail = title && window.prompt('Shelf description'); if (title?.trim() && detail?.trim()) setShelves((items) => [...items, { icon: BookOpen, title: title.trim(), detail: detail.trim() }]); }} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#16223A] px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5 text-[#E4C79A]" /> Add shelf</button>}
              <div className="relative flex min-w-0 flex-1 basis-[260px] items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#A6A091]" />
                <input
                  type="text"
                  placeholder="Search policies and SOPs..."
                  className="w-full min-w-0 rounded-lg border border-[#E8D9CE] bg-white py-2 pl-8 pr-3 text-xs"
                />
              </div>
            </div>
            <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] items-stretch gap-2.5">
              {shelves.map(({ icon: Icon, title, detail }, shelfIndex) => (
                <div key={title} className="relative">
                  <button type="button" className="flex min-h-full w-full cursor-pointer flex-col gap-2.5 rounded-xl border border-[#E8D9CE] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#C9A46B] hover:shadow-lg">
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#F1E8DA] text-[#8A6534]"><Icon className="h-[15px] w-[15px]" /></span>
                    <strong className="font-serif text-sm font-bold leading-tight text-[#16223A]">{title}</strong>
                    <span className="text-[11px] leading-relaxed text-[#5B6478]">{detail}</span>
                  </button>
                  {canEditStartCentre && <div className="absolute right-2 top-2 flex gap-1"><button type="button" onClick={() => { const nextTitle = window.prompt('Shelf name', title); const nextDetail = nextTitle && window.prompt('Shelf description', detail); if (nextTitle?.trim() && nextDetail?.trim()) setShelves((items) => items.map((item, itemIndex) => itemIndex === shelfIndex ? { ...item, title: nextTitle.trim(), detail: nextDetail.trim() } : item)); }} className="rounded bg-white px-1 text-[9px] font-bold text-[#16223A] shadow">Edit</button><button type="button" onClick={() => { if (window.confirm(`Delete shelf “${title}”?`)) setShelves((items) => items.filter((_, itemIndex) => itemIndex !== shelfIndex)); }} className="rounded bg-white px-1 text-[9px] font-bold text-red-700 shadow">Delete</button></div>}
                </div>
              ))}
            </div>
          </section>

          {/* PEOPLE & THE PROFESSION */}
          <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-base font-bold text-[#16223A]">
                  <Contact className="h-4 w-4 text-[#A9814A]" /> People &amp; the profession
                </h2>
                <p className="mt-1 text-slate-500">Staff directory, roles and extensions.</p>
              </div>
              <button
                type="button"
                onClick={() => setDirectoryOpen((open) => !open)}
                className="flex cursor-pointer items-center gap-1.5 self-start rounded-lg bg-[#16223A] px-3 py-2 text-xs font-bold text-white"
              >
                <Contact className="h-3.5 w-3.5 text-[#B97755]" /> Directory
                <ChevronRight className={`h-3 w-3 text-[#B97755] transition-transform ${directoryOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>
            {directoryOpen && (
              <div className="mt-4">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_54px_minmax(0,110px)] gap-2.5 px-2.5 pb-1.5 text-[8.5px] font-bold uppercase tracking-[0.11em] text-[#A6A091]">
                  <span>Name</span><span>Role</span><span>Ext</span><span>Mobile</span>
                </div>
                {presence.map((person) => (
                  <div key={person.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_54px_minmax(0,110px)] items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[#FAF5ED]">
                    <span className="min-w-0 truncate text-xs font-semibold text-[#16223A]">{person.name}</span>
                    <span className="min-w-0 truncate text-[11px] text-[#7A8296]">{person.role}</span>
                    <span className="font-mono text-[11.5px] font-bold text-[#8A6534]">{person.extension || '—'}</span>
                    <span className="truncate font-mono text-[11px] text-[#5B6478]">{person.mobile || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
            </>
          )}

          {activePage && (
            <section className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[#E1DCCF] bg-[#FDFBF7] p-5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-[#8A8578]">{activePage.label}</span>
                <h2 className="mt-1.5 font-serif text-xl font-bold -tracking-[0.015em] text-[#16223A]">{activePage.label}</h2>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
                {activePage.cards.map((card) => {
                  const isEditing = cardDraft?.pageId === activePage.id && cardDraft.cardId === card.id;
                  return (
                    <div key={card.id} className="relative flex flex-col gap-1.5 rounded-xl border border-[#E8D9CE] bg-white p-4">
                      {editMode && !isEditing && (
                        <div className="absolute right-2 top-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => setCardDraft({ pageId: activePage.id, cardId: card.id, title: card.title, detail: card.detail })}
                            className="cursor-pointer rounded-md border border-[#E8D9CE] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#16223A]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStartCentreCard(activePage.id, card.id)}
                            className="cursor-pointer rounded-md border border-red-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={cardDraft.title}
                            onChange={(e) => setCardDraft({ ...cardDraft, title: e.target.value })}
                            className="rounded-lg border border-[#E8D9CE] px-2.5 py-1.5 font-serif text-[14.5px] text-[#16223A]"
                            placeholder="Title"
                          />
                          <textarea
                            value={cardDraft.detail}
                            onChange={(e) => setCardDraft({ ...cardDraft, detail: e.target.value })}
                            className="rounded-lg border border-[#E8D9CE] px-2.5 py-1.5 text-[11.5px] text-[#5B6478]"
                            placeholder="Detail"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (updateStartCentreCard(activePage.id, card.id, { title: cardDraft.title, detail: cardDraft.detail })) setCardDraft(null);
                              }}
                              className="cursor-pointer rounded-lg bg-[#16223A] px-2.5 py-1 text-[11px] font-bold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setCardDraft(null)}
                              className="cursor-pointer rounded-lg border border-[#E8D9CE] px-2.5 py-1 text-[11px] font-semibold text-[#16223A]"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <strong className="font-serif text-[14.5px] text-[#16223A]">{card.title}</strong>
                          <span className="text-[11.5px] leading-relaxed text-[#5B6478]">{card.detail}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                {editMode && (
                  cardDraft?.pageId === activePage.id && cardDraft.cardId === null ? (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-[#C9A46B] bg-white p-4">
                      <input
                        type="text"
                        value={cardDraft.title}
                        onChange={(e) => setCardDraft({ ...cardDraft, title: e.target.value })}
                        className="rounded-lg border border-[#E8D9CE] px-2.5 py-1.5 font-serif text-[14.5px] text-[#16223A]"
                        placeholder="Title"
                      />
                      <textarea
                        value={cardDraft.detail}
                        onChange={(e) => setCardDraft({ ...cardDraft, detail: e.target.value })}
                        className="rounded-lg border border-[#E8D9CE] px-2.5 py-1.5 text-[11.5px] text-[#5B6478]"
                        placeholder="Detail"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (addStartCentreCard(activePage.id, { title: cardDraft.title, detail: cardDraft.detail })) setCardDraft(null);
                          }}
                          className="cursor-pointer rounded-lg bg-[#16223A] px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          Add card
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardDraft(null)}
                          className="cursor-pointer rounded-lg border border-[#E8D9CE] px-2.5 py-1 text-[11px] font-semibold text-[#16223A]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCardDraft({ pageId: activePage.id, cardId: null, title: '', detail: '' })}
                      className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9A46B] bg-white p-4 text-[#8A6534]"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-[11px] font-semibold">Add card</span>
                    </button>
                  )
                )}
              </div>
            </section>
          )}
        </div>

        {/* QUICK LINKS RAIL */}
        {page === 'home' && (
        <aside className="flex min-w-0 flex-col self-start overflow-hidden rounded-2xl border border-[#E1DCCF] bg-[#FDFBF7] xl:sticky xl:top-0">
          <div className="flex items-center justify-between gap-2.5 border-b border-[#EDE6DA] bg-gradient-to-b from-[#FFFDF9] to-[#FAF5ED] px-4 py-3.5">
            <div>
              <h2 className="font-serif text-[15px] font-bold text-[#16223A]">Quick links</h2>
              <p className="mt-0.5 text-[10.5px] text-[#7A8296]">Portals, folders and Workspace</p>
            </div>
            <div className="flex items-center gap-2">
              {canEditStartCentre && <button type="button" onClick={() => { const title = window.prompt('New quick-link group name'); if (title?.trim()) setQuickLinkGroups((groups) => [...groups, { title: title.trim(), icon: BookMarked, links: [] }]); }} className="rounded-md p-1 text-[#8A6534] hover:bg-[#F1E8DA]" title="Add quick-link group" aria-label="Add quick-link group"><Plus className="h-3.5 w-3.5" /></button>}
              <Globe2 className="h-4 w-4 shrink-0 text-[#A9814A]" />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 px-2.5 pb-3 pt-2">
            {quickLinkGroups.map((group, index) => {
              const isOpen = index === openGroup;
              const GroupIcon = group.icon;
              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(isOpen ? -1 : index)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left transition ${isOpen ? 'bg-[#16223A] text-[#F6F1E9]' : 'text-[#2C241F] hover:bg-[#F6F1E9]'}`}
                  >
                    <GroupIcon className="h-3.5 w-3.5 shrink-0 opacity-85" />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{group.title}</span>
                    <span className={`shrink-0 text-[9.5px] font-bold ${isOpen ? 'text-[#D8AE6E]' : 'text-[#B4AB9A]'}`}>{group.links.length}</span>
                    <ChevronRight className={`h-3 w-3 shrink-0 opacity-70 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {canEditStartCentre && (
                    <div className="flex items-center justify-end gap-1 px-2.5 pb-1">
                      <button type="button" onClick={() => { const title = window.prompt('Rename quick-link group', group.title); if (title?.trim()) setQuickLinkGroups((groups) => groups.map((item, itemIndex) => itemIndex === index ? { ...item, title: title.trim() } : item)); }} className="text-[9px] font-semibold text-[#8A6534] hover:underline">Edit group</button>
                      <button type="button" onClick={() => { if (window.confirm(`Delete quick-link group “${group.title}”?`)) setQuickLinkGroups((groups) => groups.filter((_, itemIndex) => itemIndex !== index)); }} className="text-[9px] font-semibold text-red-600 hover:underline">Delete</button>
                      <button type="button" onClick={() => { const label = window.prompt('Link name'); const url = label && window.prompt('Link URL'); if (label?.trim() && url?.trim()) setQuickLinkGroups((groups) => groups.map((item, itemIndex) => itemIndex === index ? { ...item, links: [...item.links, { label: label.trim(), url: url.trim(), icon: LinkIconFallback }] } : item)); }} className="text-[9px] font-semibold text-[#8A6534] hover:underline">Add link</button>
                    </div>
                  )}
                  {isOpen && (
                    <div className="mb-2 ml-2.5 mt-1 flex flex-col gap-px border-l-2 border-[#E3D3BC] pl-[11px]">
                      {group.links.map(({ label, url, icon: LinkIcon }, linkIndex) => (
                        <div key={label} className="flex items-center gap-1">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[#2C241F] no-underline transition hover:bg-[#F4EEE4] hover:text-[#16223A]">
                            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[#F1E8DA] text-[#8A6534]"><LinkIcon className="h-3 w-3" /></span>
                            <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{label}</span>
                            <ArrowUpRight className="h-3 w-3 shrink-0 text-[#C0B7A6]" />
                          </a>
                          {canEditStartCentre && <><button type="button" onClick={() => { const nextLabel = window.prompt('Rename link', label); const nextUrl = nextLabel && window.prompt('Link URL', url); if (nextLabel?.trim() && nextUrl?.trim()) setQuickLinkGroups((groups) => groups.map((item, itemIndex) => itemIndex === index ? { ...item, links: item.links.map((link, currentIndex) => currentIndex === linkIndex ? { ...link, label: nextLabel.trim(), url: nextUrl.trim() } : link) } : item)); }} className="text-[9px] font-semibold text-[#8A6534]">Edit</button><button type="button" onClick={() => setQuickLinkGroups((groups) => groups.map((item, itemIndex) => itemIndex === index ? { ...item, links: item.links.filter((_, currentIndex) => currentIndex !== linkIndex) } : item))} className="text-[9px] font-semibold text-red-600">Delete</button></>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
        )}
      </div>
    </div>
  );
};
