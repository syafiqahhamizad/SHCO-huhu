import React, { useEffect, useMemo, useState } from 'react';
import { useQuickCreate } from '../../../lib/quickCreate';
import {
  CalendarDays,
  ChartPie,
  CircleCheck,
  Compass,
  Download,
  Kanban,
  List,
  Plus,
  Search,
  Settings2,
  Share2,
  Smartphone,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { clientsNav } from '../clients/clientModel';
import { clientRef } from '../../../lib/clientNumbers';
import { useApp } from '../../../context/AppContext';
import type { Case, Client, ConflictMatch, Lead, Programme, ProgrammeAttendee, User } from '../../../types';
import {
  DEFAULT_LEAD_SOCIAL_PLATFORMS,
  DEFAULT_LEAD_SOURCES,
  whichOf,
  getPracticeSettings,
  savePracticeSettings,
  type LeadPlatformDef,
  type LeadSourceDef,
} from '../../../services/templateService';
import { scanClientConflicts } from '../../../lib/conflictUtils';
import { identityTokens, isMine, partnerCode } from '../../../lib/identity';
import { exportToCsv } from '../../../lib/exportUtils';
import { stripSalutation } from '../../../lib/legacyCleanup';
import { useConfirmation } from '../../../hooks/useConfirmation';

/**
 * Leads & Referrals (tab under My Dashboard). 1:1 build of
 * other_pages_latest/Leads and Referrals.dc.html + LEADS_AND_REFERRALS.md, wired to real
 * `leads`, `programmes`, `users`, `clients`, `cases` and PracticeSettings (editable source /
 * platform lists, booking links). No sample data: every count is derived from real records.
 */

// ---------------------------------------------------------------------------------------------
// Constants (exact values from the design's script block)
// ---------------------------------------------------------------------------------------------

const SERIF = 'ui-serif, Georgia, Cambria, serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const CHS = ['Direct / in person', 'WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'Event'];
const CHC: Record<string, string> = {
  BNI: '#A33B5B',
  'Direct / in person': '#16223A',
  WhatsApp: '#2F6F4E',
  Instagram: '#B2542F',
  Facebook: '#3D6B9C',
  TikTok: '#6B3D8C',
  Event: '#8A6D3B',
  LinkedIn: '#2E7D7A',
};
/** Sources that need "Reached us through" (channel). */
const REFC = ['Partner', 'Staff', 'Existing Client', 'Outside Referrer'];
const OUTC = ['Existing Client', 'Outside Referrer'];
const NOT_RECORDED = 'Not recorded';

type StageKey = 'Inquiry' | 'Contacted' | 'Consultation' | 'Quoted' | 'Converted' | 'Lost';
const STAGES: [StageKey, string][] = [
  ['Inquiry', '#5B6478'],
  ['Contacted', '#3D6B9C'],
  ['Consultation', '#6B3D8C'],
  ['Quoted', '#8A6D3B'],
  ['Converted', '#2F6F4E'],
  ['Lost', '#B23A2E'],
];
const STC: Record<StageKey, [string, string]> = {
  Inquiry: ['#F0F2F5', '#5B6478'],
  Contacted: ['#E7EEF6', '#2F5680'],
  Consultation: ['#F1EBF6', '#6B3D8C'],
  Quoted: ['#FBF2E9', '#8A6534'],
  Converted: ['#E6EFE9', '#2F6F4E'],
  Lost: ['#FBEDE9', '#B23A2E'],
};
const PC: Record<string, string> = { SH: '#16223A', AH: '#3D6B9C', ZA: '#6B3D8C' };

const AREA_OPTS = ['Civil Litigation', 'Conveyancing', 'Corporate', 'Family', 'Syariah', 'Wills & Estate', 'Criminal'];
const PROG_TYPES: Programme['type'][] = ['Seminar', 'Talk', 'Webinar', 'Roadshow', 'Booth / exhibition'];
const ASK_FIELDS = ['Full name', 'Phone', 'Email', 'IC number', 'Area of interest', 'Question for the speaker'];
const ASK_DEFAULT: Record<string, boolean> = {
  'Full name': true,
  Phone: true,
  Email: true,
  'IC number': false,
  'Area of interest': true,
  'Question for the speaker': false,
};
const NEW_SRC_PAL: [string, string, string][] = [
  ['#0E7490', '#E0F2F5', '#0B5E75'],
  ['#9D174D', '#FBE7EF', '#831843'],
  ['#4D7C0F', '#EEF5E1', '#3F6212'],
  ['#7C2D12', '#FBEDE6', '#7C2D12'],
  ['#1E40AF', '#E6ECFA', '#1E3A8A'],
];
const DETAIL_PH: Record<string, string> = {
  'Existing Client': 'Client who referred them, e.g. Lim Wei Jie',
  'Walk-In': 'Optional note, e.g. walked in to Bangi office',
  Website: 'Page or form, e.g. Website enquiry',
};

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const norm = (s?: string | null) => String(s ?? '').trim().toLowerCase();
const codeOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
const rm = (v: number) => Math.round(v).toLocaleString('en-MY');
const k1 = (v: number) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v));
const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const asDate = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00');
const validIso = (iso?: string) => !!iso && /^\d{4}-\d{2}-\d{2}/.test(iso) && !isNaN(asDate(iso).getTime());
const fmtDM = (iso?: string) => (validIso(iso) ? asDate(iso!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
const conicDonut = (entries: { label: string; n: number; color: string }[]) => {
  const tot = entries.reduce((s, e) => s + e.n, 0) || 1;
  let a = 0;
  const stops = entries
    .filter((e) => e.n > 0)
    .map((e) => {
      const s = a;
      a += (e.n / tot) * 360;
      return `${e.color} ${s.toFixed(1)}deg ${a.toFixed(1)}deg`;
    });
  return { bg: `conic-gradient(${stops.join(', ') || '#EEF1F5 0deg 360deg'})`, legend: entries };
};
const userColor = (u?: Partial<User> | null) => {
  if (!u?.name) return '#2E7D7A';
  const c = codeOf(u.name);
  if (PC[c] && u.role === 'Partner') return PC[c];
  return u.role === 'Partner' || u.role === 'Lawyer' ? '#2E7D7A' : '#5E6F2F';
};
const roleLabel = (u: Partial<User>) => u.staffProfile?.designation || String(u.role || '');

/** Normalised view of a real Lead, in the design's field vocabulary. */
interface LV {
  raw: Lead;
  id: string;
  name: string;
  area: string;
  cat: string;
  detailRaw: string;
  detail: string;
  ch: string;
  picName: string;
  picCode: string;
  picColor: string;
  stage: StageKey;
  quote: number;
  clientId?: string;
  fileRef?: string;
  date: string;
  booked?: string;
  lostReason?: string;
  warmth: 'Hot' | 'Warm' | 'Cold';
}

interface Person {
  code: string;
  name: string;
  role: string;
  color: string;
  grp: 'Partner' | 'Staff' | 'Outside';
  mine: LV[];
  /** Registered referral partner: fee rate and what is owed. */
  fee?: string;
}

interface LeadDraft {
  name: string;
  phone: string;
  email: string;
  area: string;
  warmth: 'Hot' | 'Warm' | 'Cold';
  cat: string;
  detail: string;
  ch?: string;
  pic: string;
}

interface ProgDraft {
  title: string;
  type: Programme['type'];
  org: 'Firm' | 'Joint';
  partner: string;
  date: string;
  time: string;
  venue: string;
  cap: number | string;
  pic: string;
  fields: Record<string, boolean>;
  auto: boolean;
}

type Tab = 'overview' | 'leads' | 'programmes' | 'referrers';

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export const LeadsReferralsPage: React.FC = () => {
  const {
    leads,
    programmes,
    users,
    clients,
    cases,
    currentUser,
    isAdmin,
    addLead,
    updateLead,
    deleteLead,
    addClient,
    addProgramme,
    updateProgramme,
    getNextSequenceId,
    openNewCaseWithPrefill,
    setCurrentCaseId,
    setCaseSubTab,
    setCurrentView,
    updateClient,
    showToast,
    logAuditEvent,
    referralPartners,
  } = useApp();
  const { confirm, ConfirmationModal } = useConfirmation();

  const canAdmin = Boolean(isAdmin || currentUser?.isSuperAdmin);
  const todayStr = localIso();
  const year = new Date().getFullYear();

  // --- Practice settings (source list, platform list, booking links) ---------------------------
  const [settings, setSettings] = useState(() => getPracticeSettings());
  useEffect(() => {
    const onUpdate = () => setSettings(getPracticeSettings());
    window.addEventListener('shco-practice-settings-updated', onUpdate);
    return () => window.removeEventListener('shco-practice-settings-updated', onUpdate);
  }, []);
  const cats: LeadSourceDef[] = settings.leadSources?.length ? settings.leadSources : DEFAULT_LEAD_SOURCES;
  const plats: LeadPlatformDef[] = settings.leadSocialPlatforms?.length ? settings.leadSocialPlatforms : DEFAULT_LEAD_SOCIAL_PLATFORMS;
  const platLabel = (key?: string) => (key ? plats.find((p) => p.key === key)?.label || key : '');

  // --- Firm people (Staff Portal = registered users) ---------------------------------------------
  const firmUsers = useMemo(
    () => (users || []).filter((u) => u.role !== 'Client' && u.status !== 'Inactive'),
    [users]
  );
  const shUser = useMemo(
    () =>
      firmUsers.find((u) => norm(u.email) === 'syafiqahhamizad@shcolaw.com') ||
      firmUsers.find((u) => norm(u.name) === 'syafiqah hamizad') ||
      firmUsers.find((u) => u.role === 'Partner' && partnerCode(u) === 'SH'),
    [firmUsers]
  );
  const SH_NAME = shUser?.name || 'Syafiqah Hamizad';
  const userByName = (name?: string) => firmUsers.find((u) => norm(u.name) === norm(name));
  const userForPic = (value?: string) => {
    if (!value) return undefined;
    return userByName(value) || firmUsers.find((u) => isMine(value, identityTokens(u)));
  };
  const partners = useMemo(() => {
    const ps = firmUsers.filter((u) => u.role === 'Partner');
    return [...ps].sort((a, b) => (a === shUser ? -1 : b === shUser ? 1 : a.name.localeCompare(b.name)));
  }, [firmUsers, shUser]);
  const staff = useMemo(() => firmUsers.filter((u) => u.role !== 'Partner'), [firmUsers]);

  const progById = useMemo(() => Object.fromEntries((programmes || []).map((p) => [p.id, p])), [programmes]);

  // --- Source key resolution (legacy "Referral Partner" → Partner / Staff / Outside Referrer) ---
  const catOf = (l: Lead): string => {
    const c = l.referralSourceCategory;
    if (!c) return 'Other';
    if (c === 'Referral Partner') {
      const u = userByName(l.referralDetail);
      if (u) return u.role === 'Partner' ? 'Partner' : 'Staff';
      return 'Outside Referrer';
    }
    return c;
  };

  const matchClient = (l: Lead): Client | undefined =>
    (clients || []).find(
      (c) =>
        norm(c.name) === norm(l.name) ||
        (!!l.phone && c.phone === l.phone) ||
        (!!l.email && !!c.email && norm(c.email) === norm(l.email))
    );
  const fileCaseOf = (l: Lead, clientId?: string): Case | undefined =>
    (l.caseId && (cases || []).find((c) => c.id === l.caseId)) ||
    (clientId ? (cases || []).find((c) => c.clientId === clientId) : undefined);

  const L: LV[] = useMemo(
    () =>
      (leads || []).map((l) => {
        const cat = catOf(l);
        const stage: StageKey = l.stage === 'Pending' ? 'Inquiry' : (l.stage as StageKey);
        const detailRaw =
          cat === 'Social Media'
            ? l.socialMediaPlatform || l.referralDetail || ''
            : cat === 'Event / Seminar'
            ? l.programmeId || l.referralDetail || ''
            : l.referralDetail || '';
        let detail: string;
        if (cat === 'Social Media') detail = platLabel(l.socialMediaPlatform) || l.referralDetail || '—';
        else if (cat === 'Event / Seminar')
          detail = (l.programmeId && progById[l.programmeId]?.title) || l.referralDetail || '—';
        else if (cat === 'BNI') detail = 'BNI';
        else if (cat === 'Walk-In') detail = l.referralDetail || 'Walk-in';
        else if (cat === 'Website') detail = l.referralDetail || 'Website enquiry';
        else detail = l.referralDetail || '—';
        const ch = cat === 'BNI' ? 'BNI' : !REFC.includes(cat) ? '' : l.channel || NOT_RECORDED;
        const picUser = cat === 'BNI' ? shUser : userForPic(l.assignedTo);
        const picName = cat === 'BNI' ? SH_NAME : picUser?.name || l.assignedTo || '';
        const picCode = picName ? codeOf(picName) : '—';
        const clientId = stage === 'Converted' ? l.clientId || matchClient(l)?.id : l.clientId;
        const fc = stage === 'Converted' ? fileCaseOf(l, clientId) : undefined;
        const warmth: LV['warmth'] =
          l.warmth || (l.warmthLevel === 3 ? 'Hot' : l.warmthLevel === 2 ? 'Warm' : 'Cold');
        return {
          raw: l,
          id: l.id,
          name: l.name,
          area: l.practiceArea || '—',
          cat,
          detailRaw,
          detail,
          ch,
          picName,
          picCode,
          picColor: picUser ? (PC[picCode] && picUser.role === 'Partner' ? PC[picCode] : '#2E7D7A') : PC[picCode] || '#2E7D7A',
          stage: STC[stage] ? stage : 'Inquiry',
          quote: Number(l.quoteAmount) || 0,
          clientId,
          fileRef: fc?.ref,
          date: validIso(l.createdAt) ? l.createdAt!.slice(0, 10) : '',
          booked: l.consultationBooked,
          lostReason: l.lostReason,
          warmth,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, progById, plats, firmUsers, shUser, clients, cases]
  );

  // Clients are leads that converted. A client with a source (Clients › Came to us through) that no
  // lead points to is counted here as a converted lead, so Overview and Referrers show everyone.
  const LA: LV[] = useMemo(() => {
    const linked = new Set(L.map((l) => l.clientId).filter(Boolean));
    const extra = (clients || []).filter((c) => c.source && !linked.has(c.id)).map((c): LV => {
      const d = (c.sourceDetail || '').trim();
      const detailRaw = c.source === 'Social Media' ? plats.find((p) => norm(p.label) === norm(d))?.key || d : c.source === 'Event / Seminar' ? ((programmes || []).find((p) => norm(p.title) === norm(d))?.id || d) : d;
      const picName = c.source === 'BNI' ? SH_NAME : '';
      return {
        raw: { id: 'client:' + c.id, name: c.name, phone: c.phone || '', email: c.email || '', referralDetail: d, stage: 'Converted', clientId: c.id } as unknown as Lead,
        id: 'client:' + c.id, name: c.name, area: '—', cat: c.source!, detailRaw, detail: d || (c.source === 'BNI' ? 'BNI' : '—'), ch: '',
        picName, picCode: picName ? codeOf(picName) : '—', picColor: '#2E7D7A', stage: 'Converted', quote: 0, clientId: c.id, fileRef: (cases || []).find((k) => String(k.clientId || '').split(',').map((x) => x.trim()).includes(c.id))?.ref,
        date: validIso(c.createdAt) ? c.createdAt!.slice(0, 10) : '', warmth: 'Warm',
      };
    });
    return [...L, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, clients, cases, plats, programmes]);
  const conv = (l: LV) => l.stage === 'Converted';
  const isOpenL = (l: LV) => l.stage !== 'Converted' && l.stage !== 'Lost';
  const byDateDesc = (a: LV, b: LV) => (b.date || '').localeCompare(a.date || '');

  // Source metadata incl. any source a lead uses that's no longer / never was in the list.
  const allCats: LeadSourceDef[] = useMemo(() => {
    const known = new Set(cats.map((c) => c.key));
    const extra = Array.from(new Set(L.map((l) => l.cat).filter((k) => !known.has(k))));
    return [...cats, ...extra.map((k) => ({ key: k, label: k, color: '#94A3B8', tint: '#F0F2F5', fg: '#5B6478' }))];
  }, [cats, L]);
  const CAT = (key: string) =>
    allCats.find((c) => c.key === key) || { key, label: key, color: '#94A3B8', tint: '#F0F2F5', fg: '#5B6478' };

  // --- UI state -------------------------------------------------------------------------------
  const [tab, setTab] = useState<Tab>('overview');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [lf, setLf] = useState<'all' | 'open' | 'client' | 'lost'>('all');
  const [ls, setLs] = useState('All');
  const [lp, setLp] = useState('All');
  const [lq, setLq] = useState('');
  const [src, setSrc] = useState<string | null>('Event / Seminar');
  const [srcF, setSrcF] = useState('All');
  const [delId, setDelId] = useState<string | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const [sel, setSel] = useState<string | null>(null);
  const [attF, setAttF] = useState<'all' | 'wants' | 'notlead'>('all');
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);

  const blankLead = (): LeadDraft => {
    const c0 = cats.find((c) => c.key === 'Social Media') ? 'Social Media' : cats[0]?.key || 'Social Media';
    return {
      name: '',
      phone: '',
      email: '',
      area: 'Civil Litigation',
      warmth: 'Warm',
      cat: c0,
      detail: c0 === 'Social Media' ? plats[0]?.key || '' : '',
      pic: currentUser?.name || SH_NAME,
    };
  };
  const blankProg = (): ProgDraft => ({
    title: '',
    type: 'Seminar',
    org: 'Firm',
    partner: '',
    date: todayStr,
    time: '9:30 AM',
    venue: '',
    cap: 60,
    pic: currentUser?.name || SH_NAME,
    fields: { ...ASK_DEFAULT },
    auto: true,
  });
  const [leadModal, setLeadModal] = useState(false);
  const [N, setNState] = useState<LeadDraft>(blankLead);
  useQuickCreate(['lead'], () => { setNState(blankLead()); setLeadModal(true); });
  const setN = (p: Partial<LeadDraft>) => setNState((s) => ({ ...s, ...p }));
  const [modal, setModal] = useState(false);
  const [F, setFState] = useState<ProgDraft>(blankProg);
  const setF = (p: Partial<ProgDraft>) => setFState((s) => ({ ...s, ...p }));
  const [pickers, setPickers] = useState<Record<string, { q: string; open: boolean }>>({});

  const [manage, setManage] = useState(false);
  const [draftCats, setDraftCats] = useState<LeadSourceDef[]>([]);
  const [draftPlats, setDraftPlats] = useState<LeadPlatformDef[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newPlat, setNewPlat] = useState('');

  const [bookModal, setBookModal] = useState(false);
  const [bk, setBk] = useState({ form: '', cal: '' });
  const bkOn = Boolean(settings.leadBookingFormLink?.trim());

  // --- Programmes view model ------------------------------------------------------------------
  const progLeads = (p: Programme) =>
    LA.filter(
      (l) => l.cat === 'Event / Seminar' && (l.raw.programmeId ? l.raw.programmeId === p.id : norm(l.raw.referralDetail) === norm(p.title))
    );
  const progs = useMemo(() => [...(programmes || [])].sort((a, b) => b.date.localeCompare(a.date)), [programmes]);
  const progRow = (p: Programme, i: number) => {
    const valid = validIso(p.date);
    const d = valid ? asDate(p.date) : null;
    const up = p.date >= todayStr;
    const pl = progLeads(p);
    const att = p.attendees || [];
    const reg = att.length ? Math.max(att.length, Number(p.registrations) || 0) : Number(p.registrations) || 0;
    const attended = att.length ? att.filter((a) => a.attended).length : Number(p.attendance) || 0;
    const cap = Number(p.capacity) || 0;
    const picU = userForPic(p.pic);
    return {
      p,
      id: p.id,
      title: p.title,
      type: p.type,
      organiser: p.organiser || 'Firm',
      time: p.time || '—',
      venue: p.location || 'Venue TBC',
      pic: picU ? codeOf(picU.name) : p.pic ? codeOf(p.pic) : '—',
      picName: picU?.name || p.pic || '',
      reg,
      attended,
      cap,
      up,
      status: up ? 'Upcoming' : 'Completed',
      bt: i ? '1px solid #F0F2F5' : '0',
      mon: d ? d.toLocaleDateString('en-GB', { month: 'short' }) : '—',
      day: d ? d.getDate() : '',
      dateLabel: d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      tint: up ? '#E7EEF6' : '#F0F2F5',
      tc: up ? '#2F5680' : '#5B6478',
      sbg: up ? '#E7EEF6' : '#E6EFE9',
      sfg: up ? '#2F5680' : '#2F6F4E',
      summary: up
        ? cap
          ? `${reg} / ${cap} registered`
          : `${reg} registered`
        : `${attended} attended · ${pl.length} leads · ${pl.filter(conv).length} files`,
      leads: pl,
    };
  };
  const progList = progs.map(progRow);
  const Pp = progList.find((p) => p.id === sel) || progList[0];

  // --- Referrers ------------------------------------------------------------------------------
  const refPeople: Person[] = useMemo(() => {
    const mk = (u: User, grp: 'Partner' | 'Staff'): Person => {
      const isSH = grp === 'Partner' && u === shUser;
      const mine = LA.filter((l) => (l.cat === grp && norm(l.detailRaw) === norm(u.name)) || (isSH && l.cat === 'BNI')).sort(byDateDesc);
      return { code: codeOf(u.name), name: u.name, role: roleLabel(u), color: grp === 'Partner' ? PC[codeOf(u.name)] || '#2E7D7A' : '#5E6F2F', grp, mine };
    };
    return [...partners.map((u) => mk(u, 'Partner')), ...staff.map((u) => mk(u, 'Staff'))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, staff, LA, shUser]);
  // BNI still counts under SH's referrals even if SH isn't a registered user yet.
  const bniOrphans = !shUser ? LA.filter((l) => l.cat === 'BNI') : [];
  const outsiders: Person[] = useMemo(() => {
    const m = new Map<string, { name: string; arr: LV[] }>();
    LA.filter((l) => OUTC.includes(l.cat) && l.raw.referralDetail?.trim()).forEach((l) => {
      const k = norm(l.raw.referralDetail);
      if (!m.has(k)) m.set(k, { name: l.raw.referralDetail!.trim(), arr: [] });
      m.get(k)!.arr.push(l);
    });
    // Outside referral partners registered in Referral partners & fee rates show even with no lead yet.
    const ext = (referralPartners || []).filter((p) => p.type === 'External' && p.active !== false);
    ext.forEach((p) => { const k = norm(p.name); if (!m.has(k)) m.set(k, { name: p.name, arr: [] }); });
    const feeOf = (name: string) => {
      const p = ext.find((x) => norm(x.name) === norm(name));
      if (!p) return undefined;
      const rate = p.commissionType === 'Percentage' ? p.commissionValue + '% of fees' : p.commissionType === 'Flat' ? 'RM ' + Number(p.commissionValue || 0).toLocaleString('en-MY') + ' per file' : 'no fee';
      return rate + (Number(p.amountOwed || 0) > 0 ? ' · owed RM ' + Number(p.amountOwed).toLocaleString('en-MY', { minimumFractionDigits: 2 }) : p.paymentStatus === 'Paid' ? ' · paid' + (p.lastPaymentDate ? ' ' + p.lastPaymentDate : '') : '');
    };
    return Array.from(m.values())
      .sort((a, b) => b.arr.length - a.arr.length)
      .map(({ name, arr }) => ({
        code: codeOf(name),
        name,
        role: arr[0]?.cat === 'Existing Client' ? 'Existing client' : 'Outside referrer',
        color: '#8A6D3B',
        grp: 'Outside' as const,
        mine: [...arr].sort(byDateDesc),
        fee: feeOf(name),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LA, referralPartners]);
  const allPeople = [...refPeople, ...outsiders];
  const teamReferred =
    refPeople.reduce((s, p) => s + p.mine.length, 0) + bniOrphans.length;

  // --- Overview -------------------------------------------------------------------------------
  const convL = LA.filter(conv);
  const regTotal = progList.reduce((s, p) => s + p.reg, 0);
  const sources = allCats
    .map((c) => {
      const lsx = LA.filter((l) => l.cat === c.key);
      const cv = lsx.filter(conv);
      const open = src === c.key;
      const groups = new Map<string, LV[]>();
      lsx.forEach((l) => {
        const k = l.detail;
        groups.set(k, [...(groups.get(k) || []), l]);
      });
      const subs = Array.from(groups.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name, arr], i) => {
          const cvv = arr.filter(conv);
          const platKey = c.key === 'Social Media' ? arr[0].detailRaw : '';
          return {
            name,
            line: `${arr.length} lead${arr.length > 1 ? 's' : ''} · ${cvv.length} became client${cvv.length === 1 ? '' : 's'}`,
            bt: i ? '1px solid #F0F2F5' : '0',
            open: () => {
              setTab('leads');
              setView('list');
              setLf('all');
              setLs(c.key);
              setLp(c.key === 'Social Media' ? platKey || 'All' : 'All');
              setLq(c.key === 'Social Media' ? '' : name === '—' ? '' : name);
            },
          };
        });
      const pct = lsx.length ? Math.round((cv.length / lsx.length) * 100) : 0;
      return {
        key: c.key,
        name: c.label,
        color: c.color,
        total: lsx.length,
        conv: cv.length,
        pct,
        grade: pct >= 50 ? 'good' : pct >= 30 ? 'fair' : 'low',
        pbg: pct >= 50 ? '#E6EFE9' : pct >= 30 ? '#FBF2E9' : '#FBEDE9',
        pc: pct >= 50 ? '#2F6F4E' : pct >= 30 ? '#8A6534' : '#B23A2E',
        open,
        subs,
      };
    })
    .sort((a, b) => b.total - a.total);
  // The donut can show leads, or every registered client by where they came from.
  const dSrc = conicDonut(sources.map((s) => ({ label: s.name, n: s.total, color: s.color })));

  const soc = LA.filter((l) => l.cat === 'Social Media');
  const platKeys = [...plats.map((p) => p.key), ...Array.from(new Set(soc.map((l) => l.detailRaw).filter((k) => k && !plats.some((p) => p.key === k))))];
  const pMax = Math.max(1, ...platKeys.map((k) => soc.filter((l) => l.detailRaw === k).length));
  const platforms = platKeys
    .map((k) => {
      const lsx = soc.filter((l) => l.detailRaw === k);
      return { key: k, name: platLabel(k), total: lsx.length, conv: lsx.filter(conv).length, w: (lsx.length / pMax) * 100 };
    })
    .sort((a, b) => b.total - a.total);

  // "Leads · YTD" = enquiries received this calendar year (by the lead's enquiry date). Leads
  // with no enquiry date can't be placed in a year: they are reported as "undated", not
  // silently counted as this year's.
  const ytdYear = todayStr.slice(0, 4);
  const ytdLeads = LA.filter((l) => l.date && l.date.slice(0, 4) === ytdYear && l.date <= todayStr);
  const undatedLeads = LA.filter((l) => !l.date).length;
  const kpis: { label: string; value: number; note: string; Icon: React.ElementType; color: string; onClick: () => void }[] = [
    {
      label: 'Leads · YTD',
      value: ytdLeads.length,
      note: `enquiries${undatedLeads ? ` · ${undatedLeads} undated not counted` : ''}`,
      Icon: UserPlus,
      color: '#16223A',
      onClick: () => goLeads({ lf: 'all' }),
    },
    {
      label: 'Converted to files',
      value: convL.length,
      note: `${LA.length ? Math.round((convL.length / LA.length) * 100) : 0}% conversion`,
      Icon: CircleCheck,
      color: '#2F6F4E',
      onClick: () => goLeads({ lf: 'client' }),
    },
    {
      label: 'Programme sign-ups',
      value: regTotal,
      note: `${progList.length} programmes`,
      Icon: CalendarDays,
      color: '#B2542F',
      onClick: () => setTab('programmes'),
    },
    {
      label: 'Referred by team',
      value: teamReferred,
      note: 'partners & staff',
      Icon: Users,
      color: '#6B3D8C',
      onClick: () => setTab('referrers'),
    },
  ];

  function goLeads(p: { lf?: typeof lf; ls?: string; lp?: string; lq?: string }) {
    setTab('leads');
    setView('list');
    setLs(p.ls ?? 'All');
    setLp(p.lp ?? 'All');
    setLq(p.lq ?? '');
    setLf(p.lf ?? 'all');
  }

  // --- All leads (list) -----------------------------------------------------------------------
  const q = lq.trim().toLowerCase();
  const base = LA.filter((l) => ls === 'All' || l.cat === ls)
    .filter((l) => ls !== 'Social Media' || lp === 'All' || l.detailRaw === lp)
    .filter((l) => !q || [l.name, l.id, l.detail, l.area, l.picCode, l.picName].some((v) => (v || '').toLowerCase().includes(q)));
  let rows = base;
  if (lf === 'open') rows = rows.filter(isOpenL);
  else if (lf === 'client') rows = rows.filter(conv);
  else if (lf === 'lost') rows = rows.filter((l) => l.stage === 'Lost');
  rows = [...rows].sort(byDateDesc);
  const segC = {
    all: base.length,
    open: base.filter(isOpenL).length,
    client: base.filter(conv).length,
    lost: base.filter((l) => l.stage === 'Lost').length,
  };
  const hasFilter = ls !== 'All' || lq !== '' || lf !== 'all';

  const openNote = (l: LV) => {
    if (l.booked) {
      const [d, t] = l.booked.split('|');
      const dl = validIso(d) ? asDate(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : d;
      return { text: `Consultation booked · ${dl}${t ? ', ' + t : ''}`, c: '#2F5680', w: 700 };
    }
    if (l.quote) return { text: `Quoted RM ${rm(l.quote)}`, c: '#94A3B8', w: 400 };
    return { text: 'Follow up to qualify', c: '#94A3B8', w: 400 };
  };

  // --- Conflict screening (clients, opposing parties, other leads) ----------------------------
  const conflictHits = (name: string): string[] => {
    const nm = name.trim().toLowerCase();
    if (nm.length < 4) return [];
    const leadHits = (leads || [])
      .filter((l) => l.name.toLowerCase().includes(nm) || nm.includes(l.name.toLowerCase()))
      .map((l) => `${l.id} ${l.name}`);
    const other = scanClientConflicts({ name: name.trim(), contactPerson: name.trim() }, clients || [], cases || []).map((m) => m.label);
    return [...leadHits, ...other];
  };
  const conflictMatches = (name: string, email?: string): ConflictMatch[] => {
    const nm = name.trim().toLowerCase();
    const leadHits: ConflictMatch[] =
      nm.length >= 4
        ? (leads || [])
            .filter((l) => l.name.toLowerCase().includes(nm) || nm.includes(l.name.toLowerCase()))
            .map((l) => ({ label: l.name, detail: `Existing Prospective Lead (${l.id}) — Stage: ${l.stage}` }))
        : [];
    return [...scanClientConflicts({ name: name.trim(), email, contactPerson: name.trim() }, clients || [], cases || []), ...leadHits];
  };

  // --- Convert → client/file (keeps LeadsView's Bar Council conflict gate) ---------------------
  const convertLead = async (lv: LV) => {
    const l = lv.raw;
    const existing = matchClient(l);
    let clientId = existing?.id;
    if (!clientId) {
      const autoConflicts = scanClientConflicts({ name: l.name, email: l.email, contactPerson: l.name }, clients || [], cases || []);
      if (autoConflicts.length > 0) {
        const proceed = await confirm({
          title: 'Potential Conflict of Interest',
          message: `Auto conflict screening flagged ${autoConflicts.length} potential match(es) against the firm's existing clients/opposing parties for "${l.name}". A partner must confirm this can proceed before the client record is created.`,
          variant: 'danger',
          confirmText: 'Confirm — No Conflict, Proceed',
          details: autoConflicts.slice(0, 5).map((c) => ({ label: c.label, value: c.detail })),
        });
        if (!proceed) {
          showToast(`Conversion of "${l.name}" cancelled — conflict not cleared.`);
          return;
        }
      }
      clientId = getNextSequenceId('client');
      addClient({
        id: clientId,
        name: l.name,
        type: 'Individual',
        contactPerson: l.name,
        phone: l.phone || '',
        email: l.email || '',
        address: '',
        emergencyContact: '',
        notes: `Converted from Lead ${l.id} (${l.source || CAT(lv.cat).label}). Interest Area: ${l.practiceArea || 'General'}.`,
        source: lv.cat || undefined,
        sourceDetail: lv.detail || l.referralDetail || undefined,
        kyc: [],
        conflictCheck: {
          status: autoConflicts.length > 0 ? 'Flagged' : 'Clear',
          notes:
            autoConflicts.length > 0
              ? `Auto conflict check flagged ${autoConflicts.length} potential relationship match(es); partner confirmed to proceed.`
              : 'Auto conflict check cleared against firm database.',
          checkedBy: currentUser?.name || 'Firm Partner',
          checkedDate: localIso(),
        },
        autoConflictMatches: autoConflicts,
      });
    }
    updateLead(l.id, { stage: 'Converted', clientId });
  };

  const openFile = (lv: LV) => {
    const c = fileCaseOf(lv.raw, lv.clientId);
    if (c) {
      setCaseSubTab('overview');
      setCurrentCaseId(c.id);
      setCurrentView('cases');
      return;
    }
    const client = (clients || []).find((x) => x.id === lv.clientId);
    openNewCaseWithPrefill({
      clientId: lv.clientId,
      clientName: client?.name || lv.name,
      practiceArea: lv.raw.practiceArea || 'Civil Litigation',
      caseTitle: `${lv.raw.practiceArea || 'Legal Matter'} — ${lv.name}`,
    });
  };

  const move = (lv: LV, d: number) => {
    const i = STAGES.findIndex((x) => x[0] === lv.stage);
    const n = Math.max(0, Math.min(STAGES.length - 1, i + d));
    const ns = STAGES[n][0];
    if (ns === lv.stage) return;
    if (lv.id.startsWith('client:')) { showToast(lv.name + ' is a registered client (not a lead), so it stays under Client.'); return; }
    if (ns === 'Converted') {
      void convertLead(lv);
      return;
    }
    updateLead(lv.id, { stage: ns });
  };

  const handleExport = () => {
    if (!rows.length) {
      showToast('No leads to export.');
      return;
    }
    exportToCsv(
      'SHCO_Leads_and_Referrals',
      rows.map((l) => ({
        'Lead ID': l.id,
        Name: l.name,
        Phone: l.raw.phone || '',
        Email: l.raw.email || '',
        'Interested in': l.area,
        'Came from': CAT(l.cat).label,
        Detail: l.detail,
        'Reached us through': l.ch,
        PIC: l.picName,
        Stage: l.stage,
        'Became a client?': conv(l) ? `Yes · ${l.clientId || ''}` : l.stage === 'Lost' ? 'No · Lost' : 'Not yet',
        File: l.fileRef || '',
        Received: l.date,
      }))
    );
  };

  // --- New lead -------------------------------------------------------------------------------
  // Each source's "which" list is set in Settings › Lists & sources (whichOf): nothing is fixed here.
  const DOPT: Record<string, [string, { v: string; l: string }[]]> = Object.fromEntries(cats.flatMap((c) => {
    const nm = (xs: string[]) => xs.filter(Boolean).map((x) => ({ v: x, l: x }));
    const w = whichOf(c);
    const v: [string, { v: string; l: string }[]] | null =
      w === 'platforms' ? ['Which platform?', plats.map((p) => ({ v: p.key, l: p.label }))]
      : w === 'partners' ? ['Which partner?', partners.map((u) => ({ v: u.name, l: u.name }))]
      : w === 'staff' ? ['Which staff member?', staff.map((u) => ({ v: u.name, l: u.name }))]
      : w === 'programmes' ? ['Which programme?', progs.map((p) => ({ v: p.id, l: p.title }))]
      : w === 'clients' ? ['Which client?', nm((clients || []).map((x) => x.name).sort())]
      : w === 'referrers' ? ['Which referrer?', nm((referralPartners || []).map((r) => r.name))]
      : w === 'own' ? ['Which?', nm(c.options || [])]
      : null;
    return v ? [[c.key, v]] : [];
  }));
  const dopt = DOPT[N.cat];
  const ccHits = conflictHits(N.name);
  const cc = !N.name.trim()
    ? { text: 'Type a name to run the conflict check against clients, leads and opposing parties.', bg: '#F6F8FA', fg: '#5B6478' }
    : ccHits.length
    ? { text: `⚠ Possible conflict: matches ${ccHits.join(', ')}. Check before accepting.`, bg: '#FBEDE9', fg: '#B23A2E' }
    : { text: '✓ No conflict found in clients, leads or opposing parties.', bg: '#E6EFE9', fg: '#2F6F4E' };

  const saveLead = () => {
    if (!N.name.trim()) return;
    // Firm rule: names are saved without a salutation (Mr, Ms, Encik, Puan …).
    const name = stripSalutation(N.name.trim());
    const cat = N.cat;
    const isSocial = cat === 'Social Media';
    const isProg = cat === 'Event / Seminar';
    const prog = isProg ? progById[N.detail] : undefined;
    const referralDetail = isSocial
      ? ''
      : isProg
      ? prog?.title || ''
      : cat === 'BNI'
      ? 'BNI'
      : N.detail.trim() || (cat === 'Walk-In' ? 'Walk-in' : cat === 'Website' ? 'Website enquiry' : '');
    const shown = isSocial ? platLabel(N.detail) : referralDetail;
    const matches = conflictMatches(name, N.email);
    const lead: Lead = {
      id: getNextSequenceId('lead'),
      name,
      phone: N.phone,
      email: N.email,
      practiceArea: N.area,
      source: `${CAT(cat).label}${shown && shown !== CAT(cat).label ? ` — ${shown}` : ''}`,
      referralSourceCategory: cat,
      socialMediaPlatform: isSocial ? N.detail : undefined,
      referralDetail,
      programmeId: isProg ? prog?.id : undefined,
      channel: cat === 'BNI' ? 'BNI' : REFC.includes(cat) ? N.ch || CHS[0] : undefined,
      warmth: N.warmth,
      warmthLevel: N.warmth === 'Hot' ? 3 : N.warmth === 'Warm' ? 2 : 1,
      stage: 'Inquiry',
      autoConflictMatches: matches,
      conflictCheck: {
        status: matches.length ? 'Flagged' : 'Not Started',
        notes: matches.length ? `Auto-scan flagged ${matches.length} match(es)` : 'Pending partner conflict review',
        checkedBy: '',
        checkedDate: '',
      },
      quoteAmount: 0,
      assignedTo: cat === 'BNI' ? SH_NAME : N.pic,
      followupDate: localIso(new Date(Date.now() + 7 * 86400000)),
      createdAt: localIso(),
    };
    addLead(lead);
    setLeadModal(false);
    setNState(blankLead());
    goLeads({});
  };

  // Searchable PIC picker over every registered user.
  const mkPicker = (key: string, curName: string, set: (name: string) => void, locked: boolean) => {
    const st = pickers[key] || { q: '', open: false };
    const qq = st.q.trim().toLowerCase();
    const open = st.open && !locked;
    const selU = userForPic(curName);
    const sel = selU
      ? { code: codeOf(selU.name), name: selU.name, role: roleLabel(selU), color: userColor(selU) }
      : { code: curName ? codeOf(curName) : '—', name: curName || 'Unassigned', role: '', color: PC[codeOf(curName || '')] || '#2E7D7A' };
    const res = firmUsers
      .filter((u) => !qq || `${u.name} ${roleLabel(u)} ${codeOf(u.name)}`.toLowerCase().includes(qq))
      .slice(0, 8);
    const setSt = (p: Partial<{ q: string; open: boolean }>) => setPickers((s) => ({ ...s, [key]: { ...(s[key] || { q: '', open: false }), ...p } }));
    return {
      sel,
      q: st.q,
      locked,
      bd: open ? '#3D6B9C' : '#DDE3EB',
      ph: locked ? `Locked to ${SH_NAME} for BNI` : 'Search by name or role…',
      open,
      none: res.length === 0,
      onQ: (e: React.ChangeEvent<HTMLInputElement>) => setSt({ q: e.target.value, open: true }),
      onOpen: () => setSt({ open: true }),
      results: res.map((u, i) => ({
        key: u.id,
        code: codeOf(u.name),
        name: u.name,
        role: roleLabel(u),
        color: userColor(u),
        bt: i ? '1px solid #F0F2F5' : '0',
        bg: selU && u.id === selU.id ? '#E7EEF6' : '#fff',
        pick: () => {
          set(u.name);
          setSt({ q: '', open: false });
        },
      })),
    };
  };
  const picL = mkPicker('picL', N.cat === 'BNI' ? SH_NAME : N.pic, (n) => setN({ pic: n }), N.cat === 'BNI');
  const picP = mkPicker('picP', F.pic, (n) => setF({ pic: n }), false);
  const showCh = REFC.includes(N.cat);

  // --- New programme --------------------------------------------------------------------------
  const joint = F.org === 'Joint';
  const createProg = () => {
    if (!F.title.trim()) return;
    const id = `PRG-${Date.now()}`;
    const slug = F.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
    addProgramme({
      id,
      title: F.title.trim(),
      type: F.type,
      organiser: joint ? `Joint with ${F.partner.trim() || 'partner'}` : 'Firm',
      date: F.date,
      time: F.time,
      location: F.venue.trim() || undefined,
      capacity: Number(F.cap) || 0,
      pic: F.pic,
      slug,
      askFields: Object.entries(F.fields).filter(([, on]) => on).map(([k]) => k),
      autoCreateLeads: F.auto,
      registrations: 0,
      attendees: [],
    });
    setModal(false);
    setTab('programmes');
    setSel(id);
    setFState(blankProg());
  };

  // --- Programme detail -----------------------------------------------------------------------
  const leadNames = Object.fromEntries((leads || []).map((l) => [norm(l.name), l.id]));
  const Praw = Pp?.p;
  const up = Pp?.up ?? false;
  const attCount = up ? 0 : Pp?.attended ?? 0;
  const pLeads = Pp?.leads || [];
  const funnel = Pp
    ? (
        [
          ['Registered', Pp.reg, Pp.cap ? `of ${Pp.cap} seats` : 'no seat limit', '#3D6B9C', Pp.cap ? (Pp.reg / Pp.cap) * 100 : 0],
          ['Attended', up ? '—' : attCount, up ? 'after the event' : `${Pp.reg ? Math.round((attCount / Pp.reg) * 100) : 0}% turn-up`, '#2E7D7A', up || !Pp.reg ? 0 : (attCount / Pp.reg) * 100],
          [
            'Became leads',
            pLeads.length,
            up ? 'so far' : `${Math.round((pLeads.length / Math.max(1, attCount)) * 100)}% of attendees`,
            '#B2542F',
            (pLeads.length / Math.max(1, up ? Pp.reg : attCount)) * 100,
          ],
          ['Became files', pLeads.filter(conv).length, 'new clients', '#2F6F4E', (pLeads.filter(conv).length / Math.max(1, pLeads.length)) * 100],
        ] as [string, number | string, string, string, number][]
      ).map(([label, value, note, color, pct], i) => ({ label, value, note, color, pct: Math.min(100, pct), br: i < 3 ? '1px solid #F0F2F5' : '0' }))
    : [];
  const allAtt: ProgrammeAttendee[] = Praw?.attendees || [];
  let people = allAtt;
  if (attF === 'wants') people = people.filter((a) => a.wantsConsultation);
  if (attF === 'notlead') people = people.filter((a) => !leadNames[norm(a.name)]);
  const wantsOpen = allAtt.filter((a) => a.wantsConsultation && !leadNames[norm(a.name)]).length;
  const setAttendees = (fn: (a: ProgrammeAttendee[]) => ProgrammeAttendee[]) => {
    if (!Praw) return;
    const next = fn(Praw.attendees || []);
    updateProgramme(Praw.id, { attendees: next, attendance: next.filter((a) => a.attended).length });
  };
  const makeLeadFromAttendee = (a: ProgrammeAttendee) => {
    if (!Praw) return;
    const name = stripSalutation(a.name.trim());
    const matches = conflictMatches(name, a.email);
    addLead({
      id: getNextSequenceId('lead'),
      name,
      phone: a.phone || '',
      email: a.email || '',
      practiceArea: a.interest || 'General',
      source: `Programme — ${Praw.title}`,
      referralSourceCategory: 'Event / Seminar',
      referralDetail: Praw.title,
      programmeId: Praw.id,
      warmth: a.wantsConsultation ? 'Warm' : 'Cold',
      warmthLevel: a.wantsConsultation ? 2 : 1,
      stage: 'Inquiry',
      autoConflictMatches: matches,
      conflictCheck: {
        status: matches.length ? 'Flagged' : 'Not Started',
        notes: matches.length ? `Auto-scan flagged ${matches.length} match(es)` : 'Pending partner conflict review',
        checkedBy: '',
        checkedDate: '',
      },
      quoteAmount: 0,
      assignedTo: Praw.pic || currentUser?.name,
      followupDate: localIso(new Date(Date.now() + 3 * 86400000)),
      createdAt: localIso(),
    });
  };
  const formFields = Praw?.askFields?.length
    ? Praw.askFields.map((f) => (f === 'Phone' ? 'Phone number' : f))
    : ['Full name', 'Phone number', 'Email', 'Area of interest'];

  // --- Edit lists -----------------------------------------------------------------------------
  const openManage = () => {
    setDraftCats(cats.map((c) => ({ ...c })));
    setDraftPlats(plats.map((p) => ({ ...p })));
    setNewCat('');
    setNewPlat('');
    setManage(true);
  };
  const closeManage = () => {
    const cleanCats = draftCats.map((c) => ({ ...c, label: c.label.trim() || c.key }));
    const cleanPlats = draftPlats.map((p) => ({ ...p, label: p.label.trim() || p.key }));
    const changed = JSON.stringify(cleanCats) !== JSON.stringify(cats) || JSON.stringify(cleanPlats) !== JSON.stringify(plats);
    if (changed) {
      savePracticeSettings({ ...getPracticeSettings(), leadSources: cleanCats, leadSocialPlatforms: cleanPlats });
      logAuditEvent('UPDATE', 'SETTINGS', 'leadSources', 'Lead sources & platforms', 'Leads & Referrals lists edited (sources / social media platforms).');
    }
    setManage(false);
  };
  const catCount = (key: string) => L.filter((l) => l.cat === key).length;
  const platCount = (key: string) => soc.filter((l) => l.detailRaw === key).length;
  const addCat = () => {
    const v = newCat.trim();
    if (!v) return;
    const c = NEW_SRC_PAL[draftCats.length % NEW_SRC_PAL.length];
    setDraftCats((s) => [...s, { key: 'c' + Date.now(), label: v, color: c[0], tint: c[1], fg: c[2] }]);
    setNewCat('');
  };
  const addPlat = () => {
    const v = newPlat.trim();
    if (!v || draftPlats.some((p) => norm(p.label) === norm(v) || norm(p.key) === norm(v))) return;
    setDraftPlats((s) => [...s, { key: v, label: v }]);
    setNewPlat('');
  };

  // --- Booking link ---------------------------------------------------------------------------
  const openBook = () => {
    setBk({ form: settings.leadBookingFormLink || '', cal: settings.leadBookingCalendarLink || '' });
    setBookModal(true);
  };
  const saveBook = () => {
    if (!bk.form.trim()) return;
    savePracticeSettings({ ...getPracticeSettings(), leadBookingFormLink: bk.form.trim(), leadBookingCalendarLink: bk.cal.trim() });
    logAuditEvent('UPDATE', 'SETTINGS', 'leadBooking', 'Consultation booking link', 'Online consultation booking link saved.');
    setBookModal(false);
  };
  const hearLabel = (c: LeadSourceDef) =>
    c.key === 'Event / Seminar'
      ? 'Seminar / talk'
      : c.key === 'Partner'
      ? 'A partner of the firm'
      : c.key === 'Staff'
      ? 'Someone who works at the firm'
      : c.key === 'Existing Client'
      ? 'A friend who is a client'
      : c.label;

  // --- Delete (admin only, soft delete → Recycle Bin + audit log via deleteLead) ---------------
  const delLead = L.find((l) => l.id === delId);
  const confirmDel = () => {
    if (delId && canAdmin) deleteLead(delId);
    setDelId(null);
  };

  // --- Tabs -----------------------------------------------------------------------------------
  const tabsD: [Tab, string, React.ElementType, number | ''][] = [
    ['overview', 'Overview', ChartPie, ''],
    ['leads', 'All leads', List, LA.length],
    ['programmes', 'Programmes', CalendarDays, progList.length],
    ['referrers', 'Referrers', Share2, allPeople.length],
  ];

  // ---------------------------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------------------------

  const fieldLabel = 'text-[11px] font-semibold text-[#5B6478]';
  // index.css has an unlayered global `input, select, textarea { background; border; padding }`
  // rule that beats Tailwind utilities, so every form control's design styles go inline.
  const inputSt: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid #DDE3EB',
    padding: '8px 10px',
    fontSize: 12.5,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1E293B',
  };
  const smallInputSt: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    borderRadius: 6,
    border: '1px solid #DDE3EB',
    padding: '5px 8px',
    fontSize: 11.5,
    fontFamily: 'inherit',
    color: '#16223A',
    background: '#fff',
  };
  const titleInputSt: React.CSSProperties = {
    width: '100%',
    border: 0,
    borderRadius: 0,
    outline: 'none',
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: 700,
    color: '#16223A',
    padding: '4px 0',
    background: 'transparent',
  };
  const modalShell = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(22,34,58,.45)] px-4 pt-[130px] pb-8';

  const PicPicker = (pk: ReturnType<typeof mkPicker>) => (
    <div className="relative" style={{ gridColumn: 'span 3' }}>
      <div className="flex items-center gap-[8px] rounded-[8px] bg-white px-[8px] py-[5px]" style={{ border: `1px solid ${pk.bd}` }}>
        <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-[9.5px] font-bold" style={{ color: '#fff', background: pk.sel.color }}>
          {pk.sel.code}
        </span>
        <span className="shrink-0 text-[12px] font-bold text-[#16223A]">{pk.sel.name}</span>
        <span className="shrink-0 text-[10.5px] text-[#5B6478]">{pk.sel.role}</span>
        <input
          value={pk.q}
          onChange={pk.onQ}
          onFocus={pk.onOpen}
          disabled={pk.locked}
          placeholder={pk.ph}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            borderRadius: 0,
            borderLeft: '1px solid #EEF1F5',
            outline: 'none',
            fontSize: 12,
            fontFamily: 'inherit',
            color: '#16223A',
            background: 'transparent',
            padding: '4px 0 4px 8px',
          }}
        />
        <Search className="h-[13px] w-[13px] shrink-0" color="#94A3B8" />
      </div>
      {pk.open && (
        <div
          className="absolute right-0 left-0 z-[5] max-h-[220px] overflow-auto rounded-[8px] border border-[#DDE3EB] bg-white"
          style={{ bottom: 'calc(100% + 4px)', boxShadow: '0 12px 24px -8px rgba(22,34,58,.25)' }}
        >
          {pk.results.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={r.pick}
              className="flex w-full cursor-pointer items-center gap-[8px] border-0 px-[10px] py-[7px] text-left hover:bg-[#F6F8FA]!"
              style={{ borderTop: r.bt, background: r.bg, fontFamily: 'inherit' }}
            >
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-bold" style={{ color: '#fff', background: r.color }}>
                {r.code}
              </span>
              <span className="text-[12px] font-semibold text-[#16223A]">{r.name}</span>
              <span className="text-[10.5px] text-[#5B6478]">{r.role}</span>
            </button>
          ))}
          {pk.none && <p className="m-0 p-[10px] text-[11px] text-[#94A3B8]">No one matches. Staff are added in Staff Portal.</p>}
        </div>
      )}
    </div>
  );

  const ChOptions = () => (
    <>
      <span className={fieldLabel}>Reached us through</span>
      <div className="flex flex-wrap gap-[6px]" style={{ gridColumn: 'span 3' }}>
        {CHS.map((c) => {
          const on = (N.ch || CHS[0]) === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setN({ ch: c })}
              className="flex cursor-pointer items-center gap-[6px] rounded-[6px] px-[10px] py-[5px] text-[11.5px] font-semibold"
              style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? '#fff' : CHC[c] }} />
              {c}
            </button>
          );
        })}
      </div>
    </>
  );

  const segBtn = (on: boolean) => ({
    background: on ? '#fff' : 'transparent',
    color: on ? '#16223A' : '#5B6478',
    boxShadow: on ? '0 1px 2px rgba(22,34,58,.12)' : 'none',
    fontFamily: 'inherit',
  });

  const whoGroups: { label: string; people: Person[] }[] = [
    { label: 'Partners', people: refPeople.filter((p) => p.grp === 'Partner') },
    { label: 'Staff (from Staff Portal)', people: refPeople.filter((p) => p.grp === 'Staff') },
    { label: 'Outside referrers (clients, friends, others)', people: outsiders },
  ];

  return (
    <div className="relative flex flex-col gap-[16px] text-[12px] text-[#1E293B]">
      {ConfirmationModal}

      {/* Sub-tabs + actions */}
      <section className="mt-[-4px] flex items-center gap-[6px] border-b border-[#DDE3EB] pb-0">
        {tabsD.map(([k, label, Icon, count]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="mb-[-1px] flex cursor-pointer items-center gap-[7px] border-0 bg-transparent px-[12px] py-[8px] text-[12px] font-bold"
              style={{ borderBottom: `2px solid ${on ? '#16223A' : 'transparent'}`, color: on ? '#16223A' : '#5B6478', fontFamily: 'inherit' }}
            >
              <Icon className="h-[14px] w-[14px]" color={on ? '#16223A' : '#5B6478'} />
              <span>{label}</span>
              <span
                className="rounded-[10px] px-[6px] text-[10px]"
                style={{ background: count === '' ? 'transparent' : on ? '#E7EEF6' : '#EEF1F5', color: on ? '#16223A' : '#5B6478' }}
              >
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto flex gap-[8px] pt-0 pb-[6px]">
          {canAdmin && (
            <button
              type="button"
              onClick={openManage}
              className="flex cursor-pointer items-center gap-[5px] rounded-[6px] border border-[#DDE3EB] bg-white px-[12px] py-[7px] text-[11.5px] font-bold whitespace-nowrap text-[#16223A]"
              style={{ fontFamily: 'inherit' }}
            >
              <Settings2 className="h-[13px] w-[13px]" color="#16223A" />
              Edit lists
            </button>
          )}
          {tab === 'programmes' ? (
            <button
              type="button"
              onClick={() => setModal(true)}
              className="flex cursor-pointer items-center gap-[5px] rounded-[6px] border-0 bg-[#16223A] px-[12px] py-[7px] text-[11.5px] font-bold whitespace-nowrap text-white"
              style={{ fontFamily: 'inherit' }}
            >
              <Plus className="h-[13px] w-[13px]" color="#FFFFFF" />
              New programme
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNState(blankLead());
                setLeadModal(true);
              }}
              className="flex cursor-pointer items-center gap-[5px] rounded-[6px] border-0 bg-[#16223A] px-[12px] py-[7px] text-[11.5px] font-bold whitespace-nowrap text-white"
              style={{ fontFamily: 'inherit' }}
            >
              <Plus className="h-[13px] w-[13px]" color="#FFFFFF" />
              New lead
            </button>
          )}
        </span>
      </section>

      {/* ============================== OVERVIEW ============================== */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-[16px]">
          <section className="grid gap-[12px]" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
            {kpis.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={k.onClick}
                className="flex min-h-[112px] cursor-pointer flex-col gap-[8px] rounded-[12px] border-0 px-[16px] py-[14px] text-left hover:brightness-[1.08]"
                style={{ color: '#fff', background: k.color, boxShadow: '0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)', fontFamily: 'inherit' }}
              >
                <span className="flex items-center gap-[8px]">
                  <span className="grid h-[28px] w-[28px] place-items-center rounded-[6px]" style={{ background: 'rgba(255,255,255,.15)' }}>
                    <k.Icon className="h-[15px] w-[15px]" color="#FFFFFF" />
                  </span>
                  <span className="text-[9.5px] font-bold tracking-[.12em] uppercase">{k.label}</span>
                </span>
                <span className="text-[28px] leading-none font-bold whitespace-nowrap" style={{ fontFamily: SERIF }}>
                  {k.value}
                </span>
                <span className="mt-[-2px] text-[10.5px]">{k.note}</span>
              </button>
            ))}
          </section>

          <section className="grid items-start gap-[16px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
            <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
              <div className="flex items-center gap-[8px] bg-[#16223A] px-[14px] py-[10px] text-white">
                <Compass className="h-[16px] w-[16px]" color="#FBF2E9" />
                <strong className="text-[14.5px] text-white" style={{ fontFamily: SERIF }}>
                  Where leads come from
                </strong>
                <span className="text-[10.5px]" style={{ color: 'rgba(255,255,255,.75)' }}>
                  Year to date {year}
                </span>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '190px minmax(0,1fr)' }}>
                <div className="flex flex-col items-center gap-[10px] border-r border-[#EEF1F5] px-[16px] py-[18px]">
                  <div className="grid h-[130px] w-[130px] shrink-0 place-items-center rounded-full" style={{ background: dSrc.bg }}>
                    <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white text-center">
                      <div>
                        <div className="text-[24px] leading-none font-bold text-[#16223A]" style={{ fontFamily: SERIF }}>
                          {LA.length}
                        </div>
                        <div className="text-[9.5px] text-[#5B6478]">leads &amp; clients</div>
                      </div>
                    </div>
                  </div>
                  <p className="m-0 text-center text-[10.5px] leading-[1.4] text-[#5B6478]">Colours match the rows</p>
                </div>
                <div className="min-w-0">
                  <div
                    className="grid gap-[14px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[7px] text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 60px 100px 130px' }}
                  >
                    <span>Where they came from</span>
                    <span className="text-right">Leads</span>
                    <span className="text-right">Became clients</span>
                    <span className="text-right">CONVERSION RATE</span>
                  </div>
                  {sources.map((s) => (
                    <div key={s.key}>
                      <button
                        type="button"
                        onClick={() => setSrc(s.open ? null : s.key)}
                        className="grid w-full cursor-pointer items-center gap-[14px] border-0 border-b border-[#F0F2F5] px-[14px] py-[9px] text-left hover:bg-[#F6F8FA]!"
                        style={{ gridTemplateColumns: 'minmax(0,1fr) 60px 100px 130px', background: s.open ? '#F6F8FA' : '#fff', borderBottom: '1px solid #F0F2F5', fontFamily: 'inherit' }}
                      >
                        <span className="flex items-center gap-[8px] text-[12px] font-bold text-[#16223A]">
                          <span className="w-[8px] text-[9px] text-[#5B6478]">{s.open ? '▼' : '▶'}</span>
                          <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: s.color }} />
                          {s.name}
                        </span>
                        <span className="text-right text-[13px] font-bold text-[#16223A]">{s.total}</span>
                        <span className="text-right text-[13px] font-bold text-[#2F6F4E]">{s.conv}</span>
                        <span className="flex justify-end">
                          <span className="rounded-[20px] px-[8px] py-[2px] text-[11px] font-bold whitespace-nowrap" style={{ background: s.pbg, color: s.pc }}>
                            {s.pct}% · {s.grade}
                          </span>
                        </span>
                      </button>
                      {s.open && (
                        <div className="border-b border-[#EEF1F5] bg-[#FBFCFD] pt-[6px] pr-[14px] pb-[10px] pl-[36px]">
                          <div className="pt-[2px] pb-[4px] text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase">Who or what sent them</div>
                          {s.subs.map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={b.open}
                              className="grid w-full cursor-pointer items-center gap-[14px] border-0 bg-transparent px-0 py-[5px] text-left text-[11.5px]"
                              style={{ gridTemplateColumns: 'minmax(0,1fr) 170px 80px', borderTop: b.bt, fontFamily: 'inherit' }}
                            >
                              <span className="font-semibold text-[#16223A]">{b.name}</span>
                              <span className="text-[#5B6478]">{b.line}</span>
                              <span className="text-right text-[10.5px] font-bold text-[#8A6D3B]">See leads -&gt;</span>
                            </button>
                          ))}
                          {s.subs.length === 0 && <p className="m-0 py-[5px] text-[11px] text-[#94A3B8]">No leads from this source yet.</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex bg-[#F6F8FA] px-[14px] py-[9px] text-[10.5px] text-[#5B6478]">
                <span>Click any row to see who or what sent those leads.</span>
                <button
                  type="button"
                  onClick={() => {
                    setTab('leads');
                    setView('board');
                  }}
                  className="ml-auto cursor-pointer border-0 bg-transparent text-[10.5px] font-bold text-[#8A6D3B]"
                  style={{ fontFamily: 'inherit' }}
                >
                  Open pipeline -&gt;
                </button>
              </div>
            </div>

            <aside className="flex flex-col gap-[12px]">
              <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
                <div className="flex items-center gap-[8px] border-b border-[#DDE3EB] px-[14px] py-[10px]">
                  <Smartphone className="h-[14px] w-[14px]" color="#6B3D8C" />
                  <strong className="text-[14px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                    Social media, by platform
                  </strong>
                </div>
                <div
                  className="grid gap-[8px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[6px] text-[9px] font-bold tracking-[.06em] text-[#5B6478] uppercase"
                  style={{ gridTemplateColumns: 'minmax(0,1fr) 50px 56px' }}
                >
                  <span>Platform</span>
                  <span className="text-right">Leads</span>
                  <span className="text-right">Clients</span>
                </div>
                {platforms.map((p, i) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => goLeads({ ls: 'Social Media', lp: p.key })}
                    className="grid w-full cursor-pointer items-center gap-[8px] border-0 bg-white px-[14px] py-[7px] text-left hover:bg-[#F6F8FA]!"
                    style={{ gridTemplateColumns: 'minmax(0,1fr) 50px 56px', borderTop: i ? '1px solid #F0F2F5' : '0', fontFamily: 'inherit' }}
                  >
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="overflow-hidden text-[11.5px] font-bold text-ellipsis whitespace-nowrap text-[#16223A]">{p.name}</span>
                      <span className="h-[4px] rounded-[2px] bg-[#F0F2F5]">
                        <span className="block h-[4px] rounded-[2px] bg-[#6B3D8C]" style={{ width: `${p.w}%` }} />
                      </span>
                    </span>
                    <span className="text-right text-[12px] font-bold text-[#16223A]">{p.total}</span>
                    <span className="text-right text-[12px] font-bold text-[#2F6F4E]">{p.conv}</span>
                  </button>
                ))}
                <div className="border-t border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[7px] text-[10.5px] text-[#5B6478]">Click a platform to see those leads</div>
              </div>
              <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
                <div className="flex items-center gap-[8px] border-b border-[#DDE3EB] px-[14px] py-[10px]">
                  <CalendarDays className="h-[15px] w-[15px]" color="#8A6D3B" />
                  <strong className="text-[14px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                    Programmes
                  </strong>
                  <button
                    type="button"
                    onClick={() => setTab('programmes')}
                    className="ml-auto cursor-pointer border-0 bg-transparent text-[10.5px] font-bold text-[#8A6D3B]"
                    style={{ fontFamily: 'inherit' }}
                  >
                    All programmes -&gt;
                  </button>
                </div>
                {progList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setTab('programmes');
                      setSel(p.id);
                    }}
                    className="flex w-full cursor-pointer items-center gap-[10px] border-0 bg-white px-[14px] py-[9px] text-left hover:bg-[#F6F8FA]!"
                    style={{ borderTop: p.bt, fontFamily: 'inherit' }}
                  >
                    <div className="w-[38px] shrink-0 rounded-[6px] py-[3px] text-center" style={{ background: p.tint }}>
                      <div className="text-[8.5px] font-bold uppercase" style={{ color: p.tc }}>
                        {p.mon}
                      </div>
                      <div className="text-[15px] leading-[1.1] font-bold" style={{ fontFamily: SERIF, color: p.tc }}>
                        {p.day}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 overflow-hidden text-[11.5px] font-bold text-ellipsis whitespace-nowrap text-[#16223A]">{p.title}</p>
                      <p className="mt-[1px] mb-0 text-[10.5px] text-[#5B6478]">{p.summary}</p>
                    </div>
                    <span className="rounded-[10px] px-[7px] py-[1px] text-[9.5px] font-bold" style={{ background: p.sbg, color: p.sfg }}>
                      {p.status}
                    </span>
                  </button>
                ))}
                {progList.length === 0 && <p className="m-0 px-[14px] py-[12px] text-[11px] text-[#94A3B8]">No programmes yet.</p>}
              </div>
            </aside>
          </section>
        </div>
      )}

      {/* ============================== ALL LEADS ============================== */}
      {tab === 'leads' && (
        <div className="flex items-center gap-[10px]">
          <div className="flex rounded-[7px] bg-[#E3E7EC] p-[2px]">
            {(
              [
                ['list', 'List', List],
                ['board', 'Board', Kanban],
              ] as ['list' | 'board', string, React.ElementType][]
            ).map(([k, label, Icon]) => {
              const on = view === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  className="flex cursor-pointer items-center gap-[6px] rounded-[5px] border-0 px-[12px] py-[5px] text-[11.5px] font-bold"
                  style={segBtn(on)}
                >
                  <Icon className="h-[13px] w-[13px]" color={on ? '#16223A' : '#5B6478'} />
                  {label}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-[#5B6478]">
            {view === 'list' ? 'Every lead, and whether it became a client' : 'Drag-free board: use ‹ › to move a lead between stages'}
          </span>
          <button
            type="button"
            onClick={openBook}
            className="ml-auto flex cursor-pointer items-center gap-[6px] rounded-[6px] px-[10px] py-[6px] text-[11px] font-bold"
            style={{
              border: `1px solid ${bkOn ? '#2F6F4E' : '#DDE3EB'}`,
              background: bkOn ? '#E6EFE9' : '#fff',
              color: bkOn ? '#2F6F4E' : '#16223A',
              fontFamily: 'inherit',
            }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: bkOn ? '#2F6F4E' : '#CBD5E1' }} />
            {bkOn ? 'Online booking connected' : 'Set up online booking'}
          </button>
        </div>
      )}

      {tab === 'leads' && view === 'list' && (
        <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div className="flex flex-wrap items-center gap-[8px] border-b border-[#DDE3EB] px-[14px] py-[10px]">
            <div className="flex rounded-[7px] bg-[#F0F2F5] p-[2px]">
              {(
                [
                  ['all', 'All'],
                  ['open', 'Still open'],
                  ['client', 'Became client'],
                  ['lost', 'Lost'],
                ] as [typeof lf, string][]
              ).map(([k, label]) => {
                const on = lf === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLf(k)}
                    className="flex cursor-pointer items-center gap-[5px] rounded-[5px] border-0 px-[11px] py-[5px] text-[11px] font-bold"
                    style={segBtn(on)}
                  >
                    {label}
                    <span className="rounded-[8px] px-[5px] text-[10px]" style={{ background: on ? '#E7EEF6' : '#E3E7EC' }}>
                      {segC[k]}
                    </span>
                  </button>
                );
              })}
            </div>
            <select
              value={ls}
              onChange={(e) => {
                setLs(e.target.value);
                setLp('All');
              }}
              style={{ borderRadius: 6, border: '1px solid #DDE3EB', padding: '6px 8px', fontSize: 11.5, fontFamily: 'inherit', background: '#fff', color: '#16223A' }}
            >
              <option value="All">All sources</option>
              {allCats.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            {ls === 'Social Media' && (
              <select
                value={lp}
                onChange={(e) => setLp(e.target.value)}
                style={{
                  borderRadius: 6,
                  border: '1px solid #6B3D8C',
                  padding: '6px 8px',
                  fontSize: 11.5,
                  fontFamily: 'inherit',
                  background: '#F1EBF6',
                  color: '#6B3D8C',
                  fontWeight: 600,
                }}
              >
                <option value="All">All platforms</option>
                {platKeys.map((k) => (
                  <option key={k} value={k}>
                    {platLabel(k)}
                  </option>
                ))}
              </select>
            )}
            <label className="relative w-[220px]">
              <Search className="absolute top-[8px] left-[9px] h-[13px] w-[13px]" color="#94A3B8" />
              <input
                value={lq}
                onChange={(e) => setLq(e.target.value)}
                placeholder="Search name, ID, referrer, PIC…"
                style={{
                  width: '100%',
                  borderRadius: 6,
                  border: '1px solid #DDE3EB',
                  background: '#F6F8FA',
                  padding: '6px 8px 6px 28px',
                  fontSize: 11.5,
                  color: '#16223A',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </label>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setLs('All');
                  setLp('All');
                  setLq('');
                  setLf('all');
                }}
                className="cursor-pointer border-0 bg-transparent text-[11px] font-bold text-[#B23A2E]"
                style={{ fontFamily: 'inherit' }}
              >
                Clear filters ✕
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="ml-auto flex cursor-pointer items-center gap-[5px] rounded-[6px] border border-[#DDE3EB] bg-white px-[10px] py-[6px] text-[11px] font-bold text-[#16223A]"
              style={{ fontFamily: 'inherit' }}
            >
              <Download className="h-[13px] w-[13px]" color="#16223A" />
              Export CSV
            </button>
          </div>
          <div
            className="grid gap-[12px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[7px] text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase"
            style={{ gridTemplateColumns: 'minmax(0,1.3fr) 110px minmax(0,1.2fr) 44px 104px minmax(0,1.4fr) 76px 28px' }}
          >
            <span>Lead</span>
            <span>Interested in</span>
            <span>Came from</span>
            <span>PIC</span>
            <span>Stage</span>
            <span>Became a client?</span>
            <span />
            <span />
          </div>
          {rows.map((l) => {
            const cm = CAT(l.cat);
            const isClient = conv(l);
            const isLost = l.stage === 'Lost';
            const isOpen = isOpenL(l);
            const on = openNote(l);
            const detailName = l.cat === 'BNI' ? 'BNI' : l.detail + (l.ch && l.cat !== 'Social Media' ? ' · via ' + l.ch : '');
            return (
              <div
                key={l.id}
                className="grid items-center gap-[12px] border-b border-[#F0F2F5] px-[14px] py-[9px]"
                style={{ gridTemplateColumns: 'minmax(0,1.3fr) 110px minmax(0,1.2fr) 44px 104px minmax(0,1.4fr) 76px 28px' }}
              >
                <div className="min-w-0">
                  <p className="m-0 overflow-hidden text-[12px] font-bold text-ellipsis whitespace-nowrap text-[#16223A]">{l.name}</p>
                  <p className="mt-[1px] mb-0 text-[10.5px] text-[#5B6478]">
                    <span className="font-semibold text-[#3D6B9C]" style={{ fontFamily: MONO }}>
                      {l.id.startsWith('client:') ? clientRef((clients || []).find((x) => x.id === l.clientId) || { id: l.clientId || '' }) : l.id}
                    </span>
                    {l.date ? ' · received ' + fmtDM(l.date) : ''}
                  </p>
                </div>
                <span className="text-[11px] text-[#16223A]">{l.area}</span>
                <div className="flex min-w-0 flex-col items-start gap-[2px]">
                  <span className="rounded-[4px] px-[6px] py-[1px] text-[9.5px] font-bold" style={{ background: cm.tint, color: cm.fg }}>
                    {cm.label}
                  </span>
                  <span className="max-w-full overflow-hidden text-[11.5px] font-semibold text-ellipsis whitespace-nowrap text-[#16223A]">{detailName}</span>
                </div>
                <span
                  title={l.picName}
                  className="grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-bold"
                  style={{ color: '#fff', background: l.picColor }}
                >
                  {l.picCode}
                </span>
                <span
                  className="justify-self-start rounded-[20px] px-[8px] py-[2px] text-[10.5px] font-bold whitespace-nowrap"
                  style={{ background: STC[l.stage][0], color: STC[l.stage][1] }}
                >
                  {l.stage}
                </span>
                <div className="min-w-0">
                  {isClient && (
                    <div className="flex flex-col gap-[1px]">
                      <span className="text-[11.5px] font-bold text-[#2F6F4E]">✓ Yes · Client {l.clientId || ''}</span>
                      <span className="overflow-hidden text-[10px] font-semibold text-ellipsis whitespace-nowrap text-[#3D6B9C]" style={{ fontFamily: MONO }}>
                        {l.fileRef || 'New file to be opened'}
                      </span>
                    </div>
                  )}
                  {isLost && (
                    <div className="flex flex-col gap-[1px]">
                      <span className="text-[11.5px] font-bold text-[#B23A2E]">✕ No · Lost</span>
                      <span className="text-[10.5px] text-[#5B6478]">{l.lostReason || 'Reason not recorded'}</span>
                    </div>
                  )}
                  {isOpen && (
                    <div className="flex flex-col gap-[1px]">
                      <span className="text-[11.5px] font-semibold text-[#5B6478]">Not yet</span>
                      <span className="text-[10.5px]" style={{ color: on.c, fontWeight: on.w }}>
                        {on.text}
                      </span>
                    </div>
                  )}
                </div>
                <span className="flex justify-end">
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => void convertLead(l)}
                      className="cursor-pointer rounded-[6px] border-0 bg-[#2F6F4E] px-[8px] py-[4px] text-[10.5px] font-bold whitespace-nowrap text-white"
                      style={{ fontFamily: 'inherit' }}
                    >
                      Convert
                    </button>
                  )}
                  {l.id.startsWith('client:') && (
                    <button
                      type="button"
                      onClick={() => { clientsNav.set(l.clientId || null); setCurrentView('clients'); }}
                      title="Change where this client came from"
                      className="mr-[8px] cursor-pointer border-0 bg-transparent text-[10.5px] font-bold text-[#3D6B9C]"
                      style={{ fontFamily: 'inherit' }}
                    >
                      Edit
                    </button>
                  )}
                  {isClient && (
                    <button
                      type="button"
                      onClick={() => openFile(l)}
                      className="cursor-pointer border-0 bg-transparent text-[10.5px] font-bold text-[#8A6D3B]"
                      style={{ fontFamily: 'inherit' }}
                    >
                      Open file
                    </button>
                  )}
                </span>
                <span className="flex justify-center">
                  {l.id.startsWith('client:') && (
                    <button
                      type="button"
                      onClick={() => { const cl = (clients || []).find((x) => x.id === l.clientId); if (!cl || !window.confirm('Remove ' + cl.name + ' from Leads & Referrals? Only their "Came to us through" is cleared; the client stays in Clients.')) return; updateClient(cl.id, { source: undefined, sourceDetail: undefined }); showToast(cl.name + ' removed from Leads & Referrals'); }}
                      title="Remove from Leads & Referrals (the client stays)"
                      className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded-[6px] bg-transparent p-0 text-[#B23A2E] hover:border-[#F0C9C2]! hover:bg-[#FBEDE9]!"
                      style={{ border: '1px solid transparent', fontFamily: 'inherit' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  )}
                  {canAdmin && !l.id.startsWith('client:') && (
                    <button
                      type="button"
                      onClick={() => setDelId(l.id)}
                      title="Delete lead (admin only)"
                      className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded-[6px] bg-transparent p-0 text-[#B23A2E] hover:border-[#F0C9C2]! hover:bg-[#FBEDE9]!"
                      style={{ border: '1px solid transparent', fontFamily: 'inherit' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {rows.length === 0 && <p className="m-0 p-[28px] text-center text-[11.5px] text-[#94A3B8]">No leads match these filters.</p>}
          {delId && (
            <div className="fixed inset-0 z-[60] grid place-items-center" style={{ background: 'rgba(22,34,58,.45)' }}>
              <div className="w-[400px] overflow-hidden rounded-[12px] bg-white" style={{ boxShadow: '0 20px 40px -10px rgba(22,34,58,.4)' }}>
                <div className="px-[18px] py-[16px]">
                  <strong className="text-[15px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                    Delete {delLead?.name || ''}?
                  </strong>
                  <p className="mt-[6px] mb-0 text-[11.5px] leading-[1.5] text-[#5B6478]">
                    This removes the lead from all lists and counts. It's kept in the audit log. Only admins can do this.
                  </p>
                </div>
                <div className="flex justify-end gap-[8px] border-t border-[#EEF1F5] bg-[#F6F8FA] px-[18px] py-[10px]">
                  <button
                    type="button"
                    onClick={() => setDelId(null)}
                    className="cursor-pointer rounded-[6px] border border-[#DDE3EB] bg-white px-[12px] py-[6px] text-[11.5px] font-bold text-[#16223A]"
                    style={{ fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDel}
                    className="cursor-pointer rounded-[6px] border-0 bg-[#B23A2E] px-[12px] py-[6px] text-[11.5px] font-bold text-white"
                    style={{ fontFamily: 'inherit' }}
                  >
                    Delete lead
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-[6px] bg-[#F6F8FA] px-[14px] py-[9px] text-[10.5px] text-[#5B6478]">
            <span>
              Showing <strong className="text-[#16223A]">{rows.length}</strong> of {LA.length} leads &amp; clients
            </span>
            <span>·</span>
            <span>
              {segC.client} became clients · {segC.open} still open · {segC.lost} lost
            </span>
          </div>
        </div>
      )}

      {tab === 'leads' && view === 'board' && (
        <div className="flex flex-col gap-[12px]">
          <div className="flex flex-wrap items-center gap-[6px]">
            <span className="mr-[4px] text-[11px] font-bold text-[#5B6478]">Source</span>
            {[{ key: 'All', label: 'All sources', color: '#16223A' }, ...allCats].map((c) => {
              const on = srcF === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSrcF(c.key)}
                  className="flex cursor-pointer items-center gap-[6px] rounded-[20px] px-[11px] py-[4px] text-[11px] font-semibold"
                  style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                >
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: on ? '#fff' : c.color }} />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="grid items-start gap-[10px]" style={{ gridTemplateColumns: 'repeat(6,minmax(0,1fr))' }}>
            {STAGES.map(([label, color], si) => {
              const cards = LA.filter((l) => (srcF === 'All' || l.cat === srcF) && l.stage === label);
              const sum = cards.reduce((s, l) => s + l.quote, 0);
              return (
                <div key={label} className="flex min-h-[420px] flex-col gap-[8px] rounded-[12px] bg-[#EEF1F5] p-[8px]">
                  <div className="flex items-center gap-[6px] px-[4px] py-[2px]">
                    <span className="h-[8px] w-[8px] rounded-[2px]" style={{ background: color }} />
                    <span className="text-[11.5px] font-bold text-[#16223A]">{label}</span>
                    <span className="rounded-[10px] bg-white px-[6px] text-[10px] font-bold text-[#5B6478]">{cards.length}</span>
                    <span className="ml-auto text-[10px] text-[#5B6478]">{sum ? 'RM ' + k1(sum) : ''}</span>
                  </div>
                  {cards.map((l) => {
                    const cm = CAT(l.cat);
                    return (
                      <div
                        key={l.id}
                        className="flex flex-col gap-[6px] rounded-[8px] border border-[#DDE3EB] bg-white px-[10px] py-[9px]"
                        style={{ boxShadow: '0 1px 2px rgba(22,34,58,.05)' }}
                      >
                        <div className="flex items-start gap-[6px]">
                          <span className="flex-1 text-[11.5px] leading-[1.3] font-bold text-[#16223A]">{l.name}</span>
                          <span
                            title={l.warmth}
                            className="mt-[3px] h-[8px] w-[8px] shrink-0 rounded-full"
                            style={{ background: l.warmth === 'Hot' ? '#B23A2E' : l.warmth === 'Warm' ? '#D08A2E' : '#94A3B8' }}
                          />
                        </div>
                        <span className="text-[10.5px] text-[#5B6478]">{l.area}</span>
                        {l.stage === 'Converted' && !!l.clientId && <span className="text-[10px] font-bold text-[#2F6F4E]">✓ Client {l.clientId}</span>}
                        <span
                          className="flex max-w-full items-center gap-[5px] self-start rounded-[4px] px-[7px] py-[1px] text-[10px] font-semibold"
                          style={{ background: cm.tint, color: cm.fg }}
                        >
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {cm.label} · {l.detail}
                          </span>
                        </span>
                        <div className="flex items-center gap-[6px] border-t border-[#F0F2F5] pt-[6px]">
                          <span
                            title={l.picName}
                            className="grid h-[20px] w-[20px] place-items-center rounded-full text-[8.5px] font-bold"
                            style={{ color: '#fff', background: l.picColor }}
                          >
                            {l.picCode}
                          </span>
                          <span className="text-[10.5px] font-bold text-[#16223A]">{l.quote ? 'RM ' + rm(l.quote) : 'No quote yet'}</span>
                          <span className="ml-auto flex gap-[2px]">
                            <button
                              type="button"
                              onClick={() => move(l, -1)}
                              title="Move back"
                              className="h-[20px] w-[20px] cursor-pointer rounded-[4px] border border-[#DDE3EB] bg-white p-0 text-[10px] text-[#5B6478]"
                              style={{ opacity: si === 0 ? 0.35 : 1 }}
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              onClick={() => move(l, 1)}
                              title="Move forward"
                              className="h-[20px] w-[20px] cursor-pointer rounded-[4px] border border-[#DDE3EB] bg-white p-0 text-[10px] text-[#16223A]"
                              style={{ opacity: si === STAGES.length - 1 ? 0.35 : 1 }}
                            >
                              ›
                            </button>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================== PROGRAMMES ============================== */}
      {tab === 'programmes' && (
        <section className="grid items-start gap-[16px]" style={{ gridTemplateColumns: '300px minmax(0,1fr)' }}>
          <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
            <div className="flex items-center gap-[8px] border-b border-[#DDE3EB] px-[14px] py-[10px]">
              <strong className="text-[14px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                Programmes
              </strong>
              <span className="text-[10.5px] text-[#5B6478]">{progList.filter((p) => p.p.date.slice(0, 4) === String(year)).length} this year</span>
            </div>
            {progList.map((p) => {
              const on = Pp?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSel(p.id);
                    setPreview(false);
                    setCopied(false);
                    setAttF('all');
                  }}
                  className="flex w-full cursor-pointer flex-col gap-[4px] border-0 py-[10px] pr-[14px] pl-[11px] text-left"
                  style={{ borderTop: p.bt, borderLeft: `3px solid ${on ? '#16223A' : 'transparent'}`, background: on ? '#F6F8FA' : '#fff', fontFamily: 'inherit' }}
                >
                  <span className="flex items-center gap-[6px]">
                    <span className="rounded-[10px] px-[7px] py-[1px] text-[9.5px] font-bold" style={{ background: p.sbg, color: p.sfg }}>
                      {p.status}
                    </span>
                    <span className="text-[10px] text-[#5B6478]">{p.type}</span>
                  </span>
                  <span className="text-[12px] leading-[1.35] font-bold text-[#16223A]">{p.title}</span>
                  <span className="text-[10.5px] text-[#5B6478]">
                    {p.dateLabel} · {p.summary}
                  </span>
                </button>
              );
            })}
            {progList.length === 0 && <p className="m-0 px-[14px] py-[12px] text-[11px] text-[#94A3B8]">No programmes yet.</p>}
          </div>

          {Pp ? (
            <div className="flex min-w-0 flex-col gap-[14px]">
              <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
                <div className="flex items-start gap-[16px] border-b border-[#F0F2F5] px-[16px] py-[14px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-[6px]">
                      <span className="rounded-[10px] px-[7px] py-[1px] text-[9.5px] font-bold" style={{ background: Pp.sbg, color: Pp.sfg }}>
                        {Pp.status}
                      </span>
                      <span className="text-[10.5px] font-semibold text-[#5B6478]">
                        {Pp.type} · {Pp.organiser}
                      </span>
                    </div>
                    <h2 className="mt-[6px] mb-0 text-[19px] font-bold text-[#16223A]" style={{ fontFamily: SERIF }}>
                      {Pp.title}
                    </h2>
                    <p className="mt-[4px] mb-0 text-[11.5px] text-[#5B6478]">
                      {Pp.dateLabel} · {Pp.time} · {Pp.venue} · PIC {Pp.pic}
                    </p>
                  </div>
                  <div className="flex w-[340px] shrink-0 flex-col gap-[6px] rounded-[10px] border border-[#DDE3EB] bg-[#F6F8FA] px-[12px] py-[10px]">
                    <span className="text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase">Public registration link</span>
                    <span className="overflow-hidden text-[11px] font-semibold text-ellipsis whitespace-nowrap text-[#3D6B9C]" style={{ fontFamily: MONO }}>
                      Not connected yet
                    </span>
                    <div className="flex gap-[6px]">
                      <button
                        type="button"
                        onClick={() => {
                          setCopied(false);
                          showToast('No public registration link yet — the online registration form is not connected.');
                        }}
                        className="flex-1 cursor-pointer rounded-[6px] border border-[#16223A] px-[6px] py-[5px] text-[11px] font-bold whitespace-nowrap"
                        style={{ background: copied ? '#16223A' : '#fff', color: copied ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                      >
                        {copied ? 'Copied ✓' : 'Copy link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast('QR poster needs a public registration link — not connected yet.')}
                        className="flex-1 cursor-pointer rounded-[6px] border border-[#DDE3EB] bg-white px-[6px] py-[5px] text-[11px] font-bold whitespace-nowrap text-[#16223A]"
                        style={{ fontFamily: 'inherit' }}
                      >
                        QR poster
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreview((v) => !v)}
                        className="flex-1 cursor-pointer rounded-[6px] border border-[#DDE3EB] bg-white px-[6px] py-[5px] text-[11px] font-bold whitespace-nowrap text-[#16223A]"
                        style={{ fontFamily: 'inherit' }}
                      >
                        Preview form
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
                  {funnel.map((f) => (
                    <div key={f.label} className="px-[16px] py-[12px]" style={{ borderRight: f.br }}>
                      <div className="text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase">{f.label}</div>
                      <div className="mt-[4px] flex items-baseline gap-[6px]">
                        <span className="text-[24px] font-bold" style={{ fontFamily: SERIF, color: f.color }}>
                          {f.value}
                        </span>
                        <span className="text-[10.5px] text-[#5B6478]">{f.note}</span>
                      </div>
                      <div className="mt-[6px] h-[5px] rounded-[3px] bg-[#F0F2F5]">
                        <div className="h-[5px] rounded-[3px]" style={{ width: `${f.pct}%`, background: f.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {preview && (
                <div className="grid gap-[20px] rounded-[12px] border border-dashed border-[#3D6B9C] bg-white p-[16px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px' }}>
                  <div className="max-w-[420px]">
                    <span className="text-[9.5px] font-bold tracking-[.08em] text-[#3D6B9C] uppercase">What the public sees</span>
                    <h3 className="mt-[6px] mb-[2px] text-[16px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                      {Pp.title}
                    </h3>
                    <p className="mt-0 mb-[10px] text-[11px] text-[#5B6478]">
                      {Pp.dateLabel} · {Pp.time} · {Pp.venue}
                    </p>
                    <div className="flex flex-col gap-[8px]">
                      {formFields.map((ff) => (
                        <div key={ff}>
                          <div className="mb-[3px] text-[10.5px] font-semibold text-[#16223A]">{ff}</div>
                          <div className="h-[30px] rounded-[6px] border border-[#DDE3EB] bg-[#F6F8FA]" />
                        </div>
                      ))}
                      <div className="flex items-center gap-[8px] text-[11px] text-[#16223A]">
                        <span className="h-[14px] w-[14px] rounded-[3px]" style={{ border: '1.5px solid #CBD5E1' }} />
                        I'd like a free consultation after the programme
                      </div>
                      <div className="rounded-[6px] bg-[#16223A] p-[8px] text-center text-[12px] font-bold text-white">Register</div>
                    </div>
                  </div>
                  <div className="border-l border-[#F0F2F5] pl-[20px] text-[11px] leading-[1.55] text-[#5B6478]">
                    <strong className="text-[#16223A]">How registrations flow in</strong>
                    <br />
                    Anyone with the link or QR code can register. Each registration is added to the attendee list below with source "{Pp.title}".
                    <br />
                    <br />
                    If someone ticks <em>free consultation</em>, they're flagged here. With <strong>auto-create leads</strong> on, they also go straight into the
                    pipeline as an Inquiry.
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
                <div className="flex items-center gap-[8px] border-b border-[#DDE3EB] px-[14px] py-[10px]">
                  <strong className="text-[14px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                    Registrations
                  </strong>
                  <span className="text-[10.5px] text-[#5B6478]">
                    showing {people.length} of {Pp.reg} · {wantsOpen} want a consultation and aren't leads yet
                  </span>
                  <div className="ml-auto flex rounded-[7px] bg-[#F0F2F5] p-[2px]">
                    {(
                      [
                        ['all', 'All'],
                        ['wants', 'Wants consultation'],
                        ['notlead', 'Not yet a lead'],
                      ] as [typeof attF, string][]
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setAttF(k)}
                        className="cursor-pointer rounded-[5px] border-0 px-[10px] py-[4px] text-[11px] font-bold"
                        style={segBtn(attF === k)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="grid gap-[12px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[7px] text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase"
                  style={{ gridTemplateColumns: 'minmax(0,1.6fr) 110px 80px minmax(0,1fr) 70px 120px' }}
                >
                  <span>Name</span>
                  <span>Phone</span>
                  <span>Via</span>
                  <span>Interested in</span>
                  <span className="text-center">Attended</span>
                  <span className="text-right">Lead</span>
                </div>
                {people.map((a) => {
                  const lid = leadNames[norm(a.name)];
                  const wants = !!a.wantsConsultation;
                  return (
                    <div
                      key={a.id}
                      className="grid items-center gap-[12px] border-b border-[#F0F2F5] px-[14px] py-[8px]"
                      style={{ gridTemplateColumns: 'minmax(0,1.6fr) 110px 80px minmax(0,1fr) 70px 120px', background: wants && !lid ? '#FFFCF7' : '#fff' }}
                    >
                      <span className="flex min-w-0 flex-col items-start gap-[2px]">
                        <span className="max-w-full overflow-hidden text-[12px] font-semibold text-ellipsis whitespace-nowrap text-[#16223A]">{a.name}</span>
                        {wants && (
                          <span className="shrink-0 rounded-[4px] bg-[#FBF2E9] px-[6px] py-[1px] text-[9.5px] font-bold text-[#8A6534]">Wants consultation</span>
                        )}
                      </span>
                      <span className="text-[11px] text-[#5B6478]" style={{ fontFamily: MONO }}>
                        {a.phone || '—'}
                      </span>
                      <span className="text-[11px] text-[#5B6478]">{a.via || '—'}</span>
                      <span className="text-[11px] text-[#16223A]">{a.interest || '—'}</span>
                      <span className="flex justify-center">
                        {!up && (
                          <button
                            type="button"
                            onClick={() => setAttendees((ps) => ps.map((x) => (x.id === a.id ? { ...x, attended: !x.attended } : x)))}
                            className="grid h-[16px] w-[16px] cursor-pointer place-items-center rounded-[4px] p-0 text-[11px] leading-none"
                            style={{ color: '#fff', border: `1.5px solid ${a.attended ? '#2F6F4E' : '#CBD5E1'}`, background: a.attended ? '#2F6F4E' : '#fff' }}
                          >
                            {a.attended ? '✓' : ''}
                          </button>
                        )}
                        {up && <span className="text-[10.5px] text-[#94A3B8]">Upcoming</span>}
                      </span>
                      <span className="flex justify-end">
                        {lid ? (
                          <span className="rounded-[20px] bg-[#E6EFE9] px-[8px] py-[2px] text-[10.5px] font-bold text-[#2F6F4E]">✓ {lid}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => makeLeadFromAttendee(a)}
                            className="cursor-pointer rounded-[6px] px-[10px] py-[4px] text-[10.5px] font-bold"
                            style={{
                              border: `1px solid ${wants ? '#16223A' : '#DDE3EB'}`,
                              background: wants ? '#16223A' : '#fff',
                              color: wants ? '#fff' : '#16223A',
                              fontFamily: 'inherit',
                            }}
                          >
                            + Make lead
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                {people.length === 0 && <p className="m-0 p-[20px] text-center text-[11.5px] text-[#94A3B8]">No registrations yet.</p>}
                <div className="bg-[#F6F8FA] px-[14px] py-[9px] text-[10.5px] text-[#5B6478]">
                  {up
                    ? 'Tick attendance on the day. People who asked for a consultation are highlighted, so follow them up first.'
                    : 'Leads created here are tagged to this programme, so it gets credit in Overview when they convert.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#DDE3EB] bg-white p-[28px] text-center text-[11.5px] text-[#94A3B8]">
              No programmes yet. Use New programme to add one.
            </div>
          )}
        </section>
      )}

      {/* ============================== REFERRERS ============================== */}
      {tab === 'referrers' && (
        <div className="flex flex-col gap-[14px]">
          <div className="overflow-hidden rounded-[12px] border border-[#DDE3EB] bg-white">
            <div className="flex items-center gap-[8px] bg-[#16223A] px-[14px] py-[10px] text-white">
              <Share2 className="h-[15px] w-[15px]" color="#FBF2E9" />
              <strong className="text-[14.5px] text-white" style={{ fontFamily: SERIF }}>
                Referrers
              </strong>
              <span className="text-[10.5px]" style={{ color: 'rgba(255,255,255,.75)' }}>
                Partners, staff and outside referrers · year to date · click a name to see their leads
              </span>
              <button
                type="button"
                onClick={() => setCurrentView('referral')}
                className="ml-auto cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[10.5px] font-bold"
                style={{ color: '#FBF2E9' }}
              >
                Referral partners &amp; fee rates →
              </button>
            </div>
            <div
              className="grid gap-[14px] border-b border-[#EEF1F5] bg-[#F6F8FA] px-[14px] py-[7px] text-[9.5px] font-bold tracking-[.08em] text-[#5B6478] uppercase"
              style={{ gridTemplateColumns: 'minmax(0,1.6fr) 80px 110px 90px 28px' }}
            >
              <span>Name</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Became clients</span>
              <span className="text-right">Still open</span>
              <span />
            </div>
            {whoGroups.map((g) => (
              <div key={g.label}>
                <div className="border-b border-[#EEF1F5] bg-[#FBFCFD] px-[14px] py-[6px] text-[9.5px] font-bold tracking-[.1em] text-[#5B6478] uppercase">{g.label}</div>
                {g.people.map((p) => {
                  const rk = `${p.grp}:${p.name}`;
                  const open = openRef === rk;
                  const mine = p.mine;
                  const m = new Map<string, number>();
                  mine.forEach((l) => {
                    const c = l.ch || NOT_RECORDED;
                    m.set(c, (m.get(c) || 0) + 1);
                  });
                  const chart = conicDonut(
                    Array.from(m.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, n]) => ({ label, n, color: CHC[label] || '#94A3B8' }))
                  );
                  return (
                    <div key={rk} className="border-b border-[#F0F2F5]">
                      <button
                        type="button"
                        onClick={() => setOpenRef(open ? null : rk)}
                        className="grid w-full cursor-pointer items-center gap-[14px] border-0 px-[14px] py-[9px] text-left hover:bg-[#F6F8FA]!"
                        style={{ gridTemplateColumns: 'minmax(0,1.6fr) 80px 110px 90px 28px', background: open ? '#F6F8FA' : '#fff', fontFamily: 'inherit' }}
                      >
                        <span className="flex min-w-0 items-center gap-[8px]">
                          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ color: '#fff', background: p.color }}>
                            {p.code}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-bold text-[#16223A]">{p.name}</span>
                            <span className="block text-[10.5px] whitespace-nowrap text-[#5B6478]">{p.role}{p.fee ? ' · ' + p.fee : ''}</span>
                          </span>
                        </span>
                        <span className="text-right text-[13px] font-bold text-[#16223A]">{mine.length}</span>
                        <span className="text-right text-[13px] font-bold text-[#2F6F4E]">{mine.filter(conv).length}</span>
                        <span className="text-right text-[12px] font-semibold text-[#5B6478]">{mine.filter(isOpenL).length}</span>
                        <span className="text-center text-[9px] text-[#5B6478]">{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div
                          className="grid items-start gap-[20px] border-t border-[#EEF1F5] bg-[#FBFCFD] py-[10px] pr-[14px] pl-[48px]"
                          style={{ gridTemplateColumns: '170px minmax(0,1fr)' }}
                        >
                          <div className="flex flex-col items-center gap-[8px]">
                            <div className="grid h-[92px] w-[92px] place-items-center rounded-full" style={{ background: chart.bg }}>
                              <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[#FBFCFD] text-center">
                                <div>
                                  <div className="text-[18px] leading-none font-bold text-[#16223A]" style={{ fontFamily: SERIF }}>
                                    {mine.length}
                                  </div>
                                  <div className="text-[9px] text-[#5B6478]">leads</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex w-full flex-col gap-[3px]">
                              {chart.legend.map((e) => (
                                <div key={e.label} className="flex items-center gap-[6px] text-[10.5px] text-[#16223A]">
                                  <span className="h-[8px] w-[8px] rounded-[2px]" style={{ background: e.color }} />
                                  <span className="flex-1">{e.label}</span>
                                  <strong>{e.n}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            {mine.map((l, i) => {
                              const isC = conv(l);
                              return (
                                <div
                                  key={l.id}
                                  className="grid items-center gap-[14px] py-[6px]"
                                  style={{ gridTemplateColumns: 'minmax(0,1.2fr) 130px minmax(0,1.2fr) 90px 70px', borderTop: i ? '1px solid #F0F2F5' : '0' }}
                                >
                                  <span className="overflow-hidden text-[11.5px] font-semibold text-ellipsis whitespace-nowrap text-[#16223A]">{l.name}</span>
                                  <span className="flex items-center gap-[5px] text-[10.5px] font-semibold whitespace-nowrap text-[#16223A]">
                                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: CHC[l.ch] || '#94A3B8' }} />
                                    {l.ch || NOT_RECORDED}
                                  </span>
                                  <span
                                    className="overflow-hidden text-[10.5px] font-semibold text-ellipsis whitespace-nowrap"
                                    style={{ color: isC ? '#3D6B9C' : '#5B6478', fontFamily: isC ? MONO : 'inherit' }}
                                  >
                                    {isC ? l.fileRef || '—' : l.area}
                                  </span>
                                  <span
                                    className="justify-self-start rounded-[20px] px-[8px] py-[1px] text-[10px] font-bold"
                                    style={{ background: STC[l.stage][0], color: STC[l.stage][1] }}
                                  >
                                    {isC ? 'Client' : l.stage}
                                  </span>
                                  <span className="text-right text-[10.5px] text-[#5B6478]">{fmtDM(l.date)}</span>
                                </div>
                              );
                            })}
                            {mine.length === 0 && <p className="mt-[6px] mb-0 text-[11px] text-[#94A3B8]">No referrals yet this year.</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex flex-wrap gap-[6px] bg-[#F6F8FA] px-[14px] py-[9px] text-[10.5px] text-[#5B6478]">
              <span>
                Everyone registered in <strong className="text-[#16223A]">Staff Portal</strong> appears here automatically.
              </span>
              <span>
                Outside referrers are added in <strong className="text-[#16223A]">Referral partners &amp; fee rates</strong> (top right), or appear when a lead names them.
              </span>
              <span>
                <strong className="text-[#16223A]">Referral fees:</strong> worked out each month from money received on the files they referred, then approved in Accounts &amp; Finance → Approvals. Outside referrers are paid by voucher, staff in their payslip, partners as drawings.
              </span>
              <button type="button" onClick={() => setCurrentView('approvals')} className="cursor-pointer border-0 bg-transparent p-0 text-[10.5px] font-bold text-[#3D6B9C]" style={{ fontFamily: 'inherit' }}>
                See this month's referral fees →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== EDIT LISTS ============================== */}
      {manage && canAdmin && (
        <div className={modalShell}>
          <div className="w-[720px] overflow-hidden rounded-[14px] bg-white" style={{ boxShadow: '0 30px 60px -20px rgba(22,34,58,.5)' }}>
            <div className="flex items-center gap-[10px] border-b border-[#DDE3EB] px-[20px] py-[14px]">
              <strong className="text-[16px] text-[#16223A]" style={{ fontFamily: SERIF }}>
                Edit lists
              </strong>
              <span className="text-[11px] text-[#5B6478]">Rename, add, or remove unused sources. Staff and partners come from Staff Portal automatically.</span>
              <button type="button" onClick={closeManage} className="ml-auto flex cursor-pointer border-0 bg-transparent p-[4px]">
                <X className="h-[18px] w-[18px]" color="#5B6478" />
              </button>
            </div>
            <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
              <div className="border-r border-[#F0F2F5] px-[18px] py-[14px]">
                <div className="mb-[8px] text-[10px] font-bold tracking-[.08em] text-[#5B6478] uppercase">Lead sources</div>
                <div className="flex flex-col gap-[6px]">
                  {draftCats.map((c) => {
                    const n = catCount(c.key);
                    return (
                      <div key={c.key} className="flex items-center gap-[6px]">
                        <span className="h-[9px] w-[9px] shrink-0 rounded-[2px]" style={{ background: c.color }} />
                        <input
                          value={c.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftCats((s) => s.map((x) => (x.key === c.key ? { ...x, label: v } : x)));
                          }}
                          style={smallInputSt}
                        />
                        <span className="w-[52px] shrink-0 text-right text-[10px] text-[#5B6478]">
                          {n} lead{n === 1 ? '' : 's'}
                        </span>
                        {n === 0 ? (
                          <button
                            type="button"
                            onClick={() => setDraftCats((s) => s.filter((x) => x.key !== c.key))}
                            title="Remove"
                            className="h-[22px] w-[40px] shrink-0 cursor-pointer rounded-[5px] border border-[#DDE3EB] bg-white p-0 text-[12px] text-[#B23A2E]"
                          >
                            ×
                          </button>
                        ) : (
                          <span title="In use: rename instead" className="w-[40px] shrink-0 text-center text-[10px] whitespace-nowrap text-[#94A3B8]">
                            in use
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-[8px] flex gap-[6px]">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="New source, e.g. Radio ad"
                    style={smallInputSt}
                  />
                  <button
                    type="button"
                    onClick={addCat}
                    className="shrink-0 cursor-pointer rounded-[6px] border-0 bg-[#16223A] px-[10px] py-[5px] text-[11px] font-bold text-white"
                    style={{ fontFamily: 'inherit' }}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="px-[18px] py-[14px]">
                <div className="mb-[8px] text-[10px] font-bold tracking-[.08em] text-[#5B6478] uppercase">Social media platforms</div>
                <div className="flex flex-col gap-[6px]">
                  {draftPlats.map((p) => {
                    const n = platCount(p.key);
                    return (
                      <div key={p.key} className="flex items-center gap-[6px]">
                        <input
                          value={p.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftPlats((s) => s.map((x) => (x.key === p.key ? { ...x, label: v } : x)));
                          }}
                          style={smallInputSt}
                        />
                        <span className="w-[52px] shrink-0 text-right text-[10px] text-[#5B6478]">
                          {n} lead{n === 1 ? '' : 's'}
                        </span>
                        {n === 0 ? (
                          <button
                            type="button"
                            onClick={() => setDraftPlats((s) => s.filter((x) => x.key !== p.key))}
                            title="Remove"
                            className="h-[22px] w-[40px] shrink-0 cursor-pointer rounded-[5px] border border-[#DDE3EB] bg-white p-0 text-[12px] text-[#B23A2E]"
                          >
                            ×
                          </button>
                        ) : (
                          <span title="In use: rename instead" className="w-[40px] shrink-0 text-center text-[10px] whitespace-nowrap text-[#94A3B8]">
                            in use
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-[8px] flex gap-[6px]">
                  <input
                    value={newPlat}
                    onChange={(e) => setNewPlat(e.target.value)}
                    placeholder="New platform, e.g. Threads"
                    style={smallInputSt}
                  />
                  <button
                    type="button"
                    onClick={addPlat}
                    className="shrink-0 cursor-pointer rounded-[6px] border-0 bg-[#16223A] px-[10px] py-[5px] text-[11px] font-bold text-white"
                    style={{ fontFamily: 'inherit' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-[#DDE3EB] bg-[#F6F8FA] px-[20px] py-[12px]">
              <button
                type="button"
                onClick={closeManage}
                className="cursor-pointer rounded-[8px] border-0 bg-[#16223A] px-[18px] py-[8px] text-[12px] font-bold text-white"
                style={{ fontFamily: 'inherit' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== BOOKING LINK ============================== */}
      {bookModal && (
        <div className={modalShell}>
          <div className="w-[760px] overflow-hidden rounded-[14px] bg-white" style={{ boxShadow: '0 30px 60px -20px rgba(22,34,58,.5)' }}>
            <div className="flex items-center gap-[10px] border-b border-[#DDE3EB] px-[20px] py-[14px]">
              <span className="rounded-[6px] bg-[#E6EFE9] px-[8px] py-[4px] text-[11px] font-bold text-[#2F6F4E]">Consultation booking</span>
              <span className="text-[11px] text-[#5B6478]">Clients book online, and each booking becomes a lead here</span>
              <button type="button" onClick={() => setBookModal(false)} className="ml-auto flex cursor-pointer border-0 bg-transparent p-[4px]">
                <X className="h-[18px] w-[18px]" color="#5B6478" />
              </button>
            </div>
            <div className="flex flex-col gap-[16px] px-[20px] py-[16px]">
              <div className="grid gap-[12px]" style={{ gridTemplateColumns: '28px minmax(0,1fr)' }}>
                <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#16223A] text-[11px] font-bold text-white">1</span>
                <div>
                  <div className="text-[12.5px] font-bold text-[#16223A]">
                    Google Form link <span className="font-normal text-[#5B6478]">(enquiry details)</span>
                  </div>
                  <input
                    value={bk.form}
                    onChange={(e) => setBk((b) => ({ ...b, form: e.target.value }))}
                    placeholder="https://forms.gle/…"
                    style={{ ...inputSt, marginTop: 6, width: '100%', fontFamily: MONO }}
                  />
                  <p className="mt-[5px] mb-0 text-[10.5px] text-[#5B6478]">
                    Where to find it: open the form in Google Forms → <strong>Send</strong> → link icon → <strong>Copy</strong>.
                  </p>
                </div>
              </div>
              <div className="grid gap-[12px]" style={{ gridTemplateColumns: '28px minmax(0,1fr)' }}>
                <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#16223A] text-[11px] font-bold text-white">2</span>
                <div>
                  <div className="text-[12.5px] font-bold text-[#16223A]">
                    Appointment booking page <span className="font-normal text-[#5B6478]">(lets them pick a slot)</span>
                  </div>
                  <input
                    value={bk.cal}
                    onChange={(e) => setBk((b) => ({ ...b, cal: e.target.value }))}
                    placeholder="https://calendar.app.google/…"
                    style={{ ...inputSt, marginTop: 6, width: '100%', fontFamily: MONO }}
                  />
                  <p className="mt-[5px] mb-0 text-[10.5px] leading-[1.5] text-[#5B6478]">
                    Google Forms can't hold time slots, but <strong>Google Calendar → Create → Appointment schedule</strong> can. Set your free consultation hours
                    there, then <strong>Share → Copy link</strong>. Booked slots appear on the lead as "Consultation booked" and in the firm Calendar.
                  </p>
                </div>
              </div>
              <div className="grid gap-[12px]" style={{ gridTemplateColumns: '28px minmax(0,1fr)' }}>
                <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#16223A] text-[11px] font-bold text-white">3</span>
                <div>
                  <div className="text-[12.5px] font-bold text-[#16223A]">Ask "How did you hear about us?"</div>
                  <p className="mt-[3px] mb-[6px] text-[10.5px] text-[#5B6478]">Use exactly these answer options in your form so each booking gets the right source:</p>
                  <div className="flex flex-wrap gap-[6px]">
                    {cats.map((c) => (
                      <span key={c.key} className="flex items-center gap-[5px] rounded-[20px] border border-[#DDE3EB] px-[10px] py-[3px] text-[11px] font-semibold text-[#16223A]">
                        <span className="h-[6px] w-[6px] rounded-full" style={{ background: c.color }} />
                        {hearLabel(c)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-[10px] border-t border-[#DDE3EB] bg-[#F6F8FA] px-[20px] py-[12px]">
              <span className="text-[11px] text-[#5B6478]">
                New bookings arrive as <strong className="text-[#16223A]">Inquiry</strong>, with the conflict check already run.
              </span>
              <button
                type="button"
                onClick={() => setBookModal(false)}
                className="ml-auto cursor-pointer rounded-[8px] border border-[#DDE3EB] bg-white px-[14px] py-[8px] text-[12px] font-semibold text-[#5B6478]"
                style={{ fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveBook}
                className="cursor-pointer rounded-[8px] border-0 bg-[#16223A] px-[18px] py-[8px] text-[12px] font-bold text-white"
                style={{ opacity: bk.form.trim() ? 1 : 0.4, fontFamily: 'inherit' }}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== NEW LEAD ============================== */}
      {leadModal && (
        <div className={modalShell}>
          <div className="w-[760px] overflow-hidden rounded-[14px] bg-white" style={{ boxShadow: '0 30px 60px -20px rgba(22,34,58,.5)' }}>
            <div className="flex items-center gap-[10px] border-b border-[#DDE3EB] px-[20px] py-[14px]">
              <span className="rounded-[6px] bg-[#E7EEF6] px-[8px] py-[4px] text-[11px] font-bold text-[#2F5680]">New lead</span>
              <span className="text-[11px] text-[#5B6478]">Conflict check runs as you type</span>
              <button type="button" onClick={() => setLeadModal(false)} className="ml-auto flex cursor-pointer border-0 bg-transparent p-[4px]">
                <X className="h-[18px] w-[18px]" color="#5B6478" />
              </button>
            </div>
            <div className="px-[20px] pt-[18px] pb-[6px]">
              <input
                value={N.name}
                onChange={(e) => setN({ name: e.target.value })}
                placeholder="Full name or company"
                style={titleInputSt}
              />
            </div>
            <div className="px-[20px] pb-[10px]">
              <div className="rounded-[8px] px-[12px] py-[8px] text-[11.5px] font-semibold" style={{ background: cc.bg, color: cc.fg }}>
                {cc.text}
              </div>
            </div>
            <div className="grid items-center gap-x-[14px] gap-y-[12px] px-[20px] pt-[6px] pb-[16px]" style={{ gridTemplateColumns: '110px minmax(0,1fr) 110px minmax(0,1fr)' }}>
              <span className={fieldLabel}>Phone</span>
              <input value={N.phone} onChange={(e) => setN({ phone: e.target.value })} placeholder="012-345 6789" style={inputSt} />
              <span className={fieldLabel}>Email</span>
              <input value={N.email} onChange={(e) => setN({ email: e.target.value })} placeholder="name@email.com" style={inputSt} />
              <span className={fieldLabel}>Interested in</span>
              <select value={N.area} onChange={(e) => setN({ area: e.target.value })} style={inputSt}>
                {AREA_OPTS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <span className={fieldLabel}>How hot?</span>
              <div className="flex gap-[6px]">
                {(
                  [
                    ['Hot', '#B23A2E', '#FBEDE9'],
                    ['Warm', '#8A6534', '#FBF2E9'],
                    ['Cold', '#5B6478', '#F0F2F5'],
                  ] as ['Hot' | 'Warm' | 'Cold', string, string][]
                ).map(([w, c, t]) => {
                  const on = N.warmth === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setN({ warmth: w })}
                      className="cursor-pointer rounded-[6px] px-[12px] py-[6px] text-[11.5px] font-bold"
                      style={{ border: `1.5px solid ${on ? c : '#DDE3EB'}`, background: on ? t : '#fff', color: c, fontFamily: 'inherit' }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
              <span className={fieldLabel}>Came from</span>
              <div className="flex flex-wrap gap-[6px]" style={{ gridColumn: 'span 3' }}>
                {cats.map((c) => {
                  const on = N.cat === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() =>
                        setN({
                          cat: c.key,
                          detail: DOPT[c.key] ? DOPT[c.key][1][0]?.v || '' : c.key === 'BNI' ? 'BNI' : '',
                          pic: c.key === 'BNI' ? SH_NAME : N.pic,
                        })
                      }
                      className="flex cursor-pointer items-center gap-[6px] rounded-[20px] px-[12px] py-[5px] text-[11.5px] font-semibold"
                      style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: on ? '#fff' : c.color }} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {N.cat !== 'BNI' && <span className={fieldLabel}>{dopt ? dopt[0] : 'Details'}</span>}
              {N.cat !== 'BNI' && <div style={{ gridColumn: 'span 3' }}>
                {dopt && (
                  <div className="flex flex-wrap gap-[6px]">
                    {dopt[1].map((o) => {
                      const on = N.detail === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setN({ detail: o.v })}
                          className="cursor-pointer rounded-[6px] px-[10px] py-[5px] text-[11.5px] font-semibold"
                          style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                        >
                          {o.l}
                        </button>
                      );
                    })}
                    {dopt[1].length === 0 && <span className="text-[11px] text-[#94A3B8]">None yet.</span>}
                  </div>
                )}
                {dopt && !['platforms', 'programmes'].includes(whichOf(cats.find((c) => c.key === N.cat))) && (
                  <input
                    value={dopt[1].some((o) => o.v === N.detail) ? '' : N.detail}
                    onChange={(e) => setN({ detail: e.target.value })}
                    placeholder="Not in the list? Type the name"
                    style={{ ...inputSt, width: '100%', marginTop: 6 }}
                  />
                )}
                {!dopt && N.cat !== 'BNI' && (
                  <input
                    value={N.detail}
                    onChange={(e) => setN({ detail: e.target.value })}
                    placeholder={DETAIL_PH[N.cat] || ''}
                    style={{ ...inputSt, width: '100%' }}
                  />
                )}
              </div>}
              {showCh && <ChOptions />}
              <span className={fieldLabel}>Person in charge</span>
              {PicPicker(picL)}
            </div>
            <div className="flex items-center gap-[10px] border-t border-[#DDE3EB] bg-[#F6F8FA] px-[20px] py-[12px]">
              <span className="text-[11px] text-[#5B6478]">
                Saved as <strong className="text-[#16223A]">Inquiry</strong>. Convert to client from the list later.
              </span>
              <button
                type="button"
                onClick={() => setLeadModal(false)}
                className="ml-auto cursor-pointer rounded-[8px] border border-[#DDE3EB] bg-white px-[14px] py-[8px] text-[12px] font-semibold text-[#5B6478]"
                style={{ fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLead}
                className="cursor-pointer rounded-[8px] border-0 bg-[#16223A] px-[18px] py-[8px] text-[12px] font-bold text-white"
                style={{ opacity: N.name.trim() ? 1 : 0.4, fontFamily: 'inherit' }}
              >
                Save lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================== NEW PROGRAMME ============================== */}
      {modal && (
        <div className={modalShell}>
          <div className="w-[760px] overflow-hidden rounded-[14px] bg-white" style={{ boxShadow: '0 30px 60px -20px rgba(22,34,58,.5)' }}>
            <div className="flex items-center gap-[10px] border-b border-[#DDE3EB] px-[20px] py-[14px]">
              <span className="rounded-[6px] bg-[#E7EEF6] px-[8px] py-[4px] text-[11px] font-bold text-[#2F5680]">New programme</span>
              <span className="text-[11px] text-[#5B6478]">Creates a public registration link &amp; QR code</span>
              <button type="button" onClick={() => setModal(false)} className="ml-auto flex cursor-pointer border-0 bg-transparent p-[4px]">
                <X className="h-[18px] w-[18px]" color="#5B6478" />
              </button>
            </div>
            <div className="px-[20px] pt-[18px] pb-[6px]">
              <input
                value={F.title}
                onChange={(e) => setF({ title: e.target.value })}
                placeholder="Programme name, e.g. Seminar Harta Pusaka"
                style={titleInputSt}
              />
            </div>
            <div className="grid items-center gap-x-[14px] gap-y-[12px] px-[20px] pt-[10px] pb-[16px]" style={{ gridTemplateColumns: '110px minmax(0,1fr) 110px minmax(0,1fr)' }}>
              <span className={fieldLabel}>Type</span>
              <div className="flex flex-wrap gap-[6px]" style={{ gridColumn: 'span 3' }}>
                {PROG_TYPES.map((t) => {
                  const on = F.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setF({ type: t })}
                      className="cursor-pointer rounded-[20px] px-[12px] py-[5px] text-[11.5px] font-semibold"
                      style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <span className={fieldLabel}>Organised by</span>
              <div className="flex gap-[6px]">
                {(
                  [
                    ['Firm', 'Firm'],
                    ['Joint', 'Joint programme'],
                  ] as ['Firm' | 'Joint', string][]
                ).map(([k, l]) => {
                  const on = F.org === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setF({ org: k })}
                      className="cursor-pointer rounded-[6px] px-[12px] py-[6px] text-[11.5px] font-semibold"
                      style={{ border: `1px solid ${on ? '#16223A' : '#DDE3EB'}`, background: on ? '#16223A' : '#fff', color: on ? '#fff' : '#16223A', fontFamily: 'inherit' }}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] font-semibold" style={{ color: joint ? '#5B6478' : '#B8C0CC' }}>
                Joint partner
              </span>
              <input
                value={F.partner}
                onChange={(e) => setF({ partner: e.target.value })}
                disabled={!joint}
                placeholder="e.g. Bank Rakyat Kajang"
                style={{ ...inputSt, background: joint ? '#fff' : '#F6F8FA' }}
              />
              <span className={fieldLabel}>Date</span>
              <input type="date" value={F.date} onChange={(e) => setF({ date: e.target.value })} style={inputSt} />
              <span className={fieldLabel}>Time</span>
              <input value={F.time} onChange={(e) => setF({ time: e.target.value })} placeholder="9:30 AM" style={inputSt} />
              <span className={fieldLabel}>Venue / link</span>
              <input
                value={F.venue}
                onChange={(e) => setF({ venue: e.target.value })}
                placeholder="Hall name, address, or Zoom link"
                style={{ ...inputSt, gridColumn: 'span 3' }}
              />
              <span className={fieldLabel}>Capacity</span>
              <input type="number" value={F.cap} onChange={(e) => setF({ cap: e.target.value })} style={inputSt} />
              {showCh && <ChOptions />}
              <span className={fieldLabel}>Person in charge</span>
              {PicPicker(picP)}
              <span className={fieldLabel}>Ask attendees</span>
              <div className="flex flex-wrap gap-[6px]" style={{ gridColumn: 'span 3' }}>
                {ASK_FIELDS.map((label) => {
                  const on = !!F.fields[label];
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setF({ fields: { ...F.fields, [label]: !on } })}
                      className="cursor-pointer rounded-[6px] px-[10px] py-[5px] text-[11.5px] font-semibold"
                      style={{ border: `1px solid ${on ? '#3D6B9C' : '#DDE3EB'}`, background: on ? '#E7EEF6' : '#fff', color: on ? '#2F5680' : '#5B6478', fontFamily: 'inherit' }}
                    >
                      {on ? '✓' : '+'} {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-[10px] border-t border-[#DDE3EB] bg-[#F6F8FA] px-[20px] py-[12px]">
              <button
                type="button"
                onClick={() => setF({ auto: !F.auto })}
                className="flex cursor-pointer items-center gap-[8px] border-0 bg-transparent p-0 text-left text-[11.5px] text-[#16223A]"
                style={{ fontFamily: 'inherit' }}
              >
                <span className="relative h-[17px] w-[30px] shrink-0 rounded-[9px]" style={{ background: F.auto ? '#2F6F4E' : '#CBD5E1' }}>
                  <span className="absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white" style={{ left: F.auto ? 15 : 2 }} />
                </span>
                Auto-create a lead when someone asks for a consultation
              </button>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="ml-auto cursor-pointer rounded-[8px] border border-[#DDE3EB] bg-white px-[14px] py-[8px] text-[12px] font-semibold text-[#5B6478]"
                style={{ fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createProg}
                className="cursor-pointer rounded-[8px] border-0 bg-[#16223A] px-[18px] py-[8px] text-[12px] font-bold text-white"
                style={{ opacity: F.title.trim() ? 1 : 0.4, fontFamily: 'inherit' }}
              >
                Create &amp; get link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

