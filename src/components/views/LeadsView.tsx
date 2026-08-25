import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lead, ConflictMatch, LeadWarmth } from '../../types';
import {
  UserCheck,
  Plus,
  AlertTriangle,
  ShieldCheck,
  UserPlus,
  Search,
  Share2,
  Flame,
  Thermometer,
  Download,
  Pencil,
  Trash2,
  Calendar,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileText,
  User,
  FolderOpen,
  X,
} from 'lucide-react';
import { exportToCsv } from '../../lib/exportUtils';
import { processGoogleFormSubmission } from '../../services/googleFormService';
import { useConfirmation } from '../../hooks/useConfirmation';
import { scanClientConflicts } from '../../lib/conflictUtils';
import { getPracticeSettings } from '../../services/templateService';

const HONORIFIC_PREFIXES = [
  'en', 'encik', 'puan', 'pn', 'cik', 'mr', 'mrs', 'ms', 'dr', 'dato', 'datuk',
  'tan sri', 'puan sri', 'datin', 'ir', 'ar', 'bin', 'binti', 'bte', 'bt'
];

export const LeadsView: React.FC = () => {
  const { leads, clients, cases, addLead, updateLead, deleteLead, addClient, addDeadline, openNewCaseWithPrefill, showToast, currentUser } = useApp();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [conflictLead, setConflictLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  // Edit Lead State
  const [editLead, setEditLead] = useState<Lead | null>(null);

  // Standardized Non-blocking Confirmation hook
  const { confirm, ConfirmationModal } = useConfirmation();

  const handleDeleteLead = async (l: Lead) => {
    const confirmed = await confirm({
      title: 'Confirm Delete Lead Record',
      message: 'Are you sure you want to delete this prospective lead? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Lead Permanently',
      details: [
        { label: 'Lead Ref', value: l.id },
        { label: 'Lead Name', value: l.name },
        { label: 'Practice Area', value: l.practiceArea || 'General' },
        { label: 'Contact', value: l.phone || l.email || 'N/A' },
      ],
    });

    if (confirmed) {
      deleteLead(l.id);
      showToast(`Lead record for "${l.name}" deleted permanently.`);
    }
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Google Form Consultation Link Modal State
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Google Form Simulation State (Client Filling Consultation Booking)
  const [gfName, setGfName] = useState('');
  const [gfPhone, setGfPhone] = useState('');
  const [gfEmail, setGfEmail] = useState('');
  const [gfPracticeArea, setGfPracticeArea] = useState('Civil Litigation');
  const [gfConsultationDate, setGfConsultationDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [gfConsultationTime, setGfConsultationTime] = useState('10:00 AM');
  const [gfLawyerPreference, setGfLawyerPreference] = useState('Syafiqah Hamizad');
  const [gfCaseSummary, setGfCaseSummary] = useState('');
  const [gfMode, setGfMode] = useState<'In-Person (Firm Office)' | 'Virtual (Google Meet)'>('In-Person (Firm Office)');

  // Warmth Filter State
  const [filterWarmth, setFilterWarmth] = useState<'All' | 'Hot' | 'Warm' | 'Cold'>('All');

  // New Lead Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [practiceArea, setPracticeArea] = useState('Civil Litigation');
  const [warmthLevel, setWarmthLevel] = useState<number>(3); // 1 to 3 scale

  // Referral Granularity State
  const [referralCategory, setReferralCategory] = useState<
    'Social Media' | 'Existing Client' | 'Referral Partner' | 'Walk-In' | 'Website' | 'Event / Seminar' | 'Other'
  >('Social Media');
  const [socialPlatform, setSocialPlatform] = useState<
    'Facebook' | 'Instagram' | 'TikTok' | 'LinkedIn' | 'XiaoHongShu / XHS' | 'YouTube' | 'WhatsApp / Telegram' | 'Other'
  >('Facebook');
  const [referralDetail, setReferralDetail] = useState('');

  const [liveMatches, setLiveMatches] = useState<ConflictMatch[]>([]);
  const [isSearchingConflicts, setIsSearchingConflicts] = useState(false);
  const [lastSearchedName, setLastSearchedName] = useState('');

  const handleQuickConflictSearch = () => {
    if (!name.trim()) {
      showToast('⚠️ Please enter a Client / Lead name first to execute a conflict search.');
      return;
    }
    setIsSearchingConflicts(true);
    setTimeout(() => {
      const matches = scanForConflicts(name);
      setLiveMatches(matches);
      setLastSearchedName(name.trim());
      setIsSearchingConflicts(false);
      if (matches.length === 0) {
        showToast(`✅ Conflict Check CLEAR for "${name.trim()}". No matches in active cases or client registry.`);
      } else {
        showToast(`⚠️ Conflict Check FLAGGED: Found ${matches.length} potential relationship/conflict match(es).`);
      }
    }, 200);
  };

  // Conflict Review Form State
  const [ccStatus, setCcStatus] = useState<'Not Started' | 'Clear' | 'Flagged'>('Not Started');
  const [ccBy, setCcBy] = useState('Syafiqah Hamizad');
  const [ccNotes, setCcNotes] = useState('');

  // Conversion Form State
  const [cvName, setCvName] = useState('');
  const [cvType, setCvType] = useState<'Individual' | 'Corporate'>('Individual');
  const [cvAddress, setCvAddress] = useState('');
  const [cvEmergName, setCvEmergName] = useState('');
  const [cvEmergPhone, setCvEmergPhone] = useState('');
  const [cvEmergEmail, setCvEmergEmail] = useState('');
  const [cvEmergRelation, setCvEmergRelation] = useState('');

  /**
   * Smart conflict check engine that strips honorifics and tokenizes queries.
   */
  const scanForConflicts = (term: string): ConflictMatch[] => {
    if (!term || term.trim().length < 2) return [];

    const rawTokens = term
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const cleanTokens = rawTokens.filter((t) => !HONORIFIC_PREFIXES.includes(t));
    if (cleanTokens.length === 0) return [];

    const matches: ConflictMatch[] = [];

    // 1. Check Clients
    clients.forEach((c) => {
      const cNameNorm = (c.name || '').toLowerCase();
      const matchFound = cleanTokens.some((token) => cNameNorm.includes(token));
      if (matchFound) {
        matches.push({
          label: c.name,
          detail: `Existing Client (${c.id}) — ${c.phone || c.email || 'Registered Client'}`,
        });
      }
    });

    // 2. Check Cases (Opposing Parties & Title & Counsel)
    cases.forEach((cs) => {
      const opposingNorm = (cs.opposingParty || '').toLowerCase();
      const titleNorm = (cs.title || '').toLowerCase();
      const allOpposingList = (cs.opposingParties || []).map((p) => (p || '').toLowerCase()).join(' ');

      const matchFound = cleanTokens.some(
        (token) => opposingNorm.includes(token) || titleNorm.includes(token) || allOpposingList.includes(token)
      );

      if (matchFound) {
        matches.push({
          label: cs.opposingParty || cs.title,
          detail: `Opposing Party in Matter ${cs.ref} (${cs.title})`,
        });
      }
    });

    // 3. Check Existing Leads
    leads.forEach((l) => {
      const lNameNorm = (l.name || '').toLowerCase();
      if (lNameNorm !== (term || '').toLowerCase()) {
        if (cleanTokens.some((token) => lNameNorm.includes(token))) {
          matches.push({
            label: l.name,
            detail: `Existing Prospective Lead (${l.id}) — Stage: ${l.stage}`,
          });
        }
      }
    });

    return matches;
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setLiveMatches(scanForConflicts(val));
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Lead name is required');

    const autoMatches = scanForConflicts(name);
    const sourceSummary =
      referralCategory === 'Social Media'
        ? `Social Media — ${socialPlatform}${referralDetail ? ` (${referralDetail})` : ''}`
        : `${referralCategory}${referralDetail ? ` (${referralDetail})` : ''}`;

    const warmthCategory: LeadWarmth = warmthLevel === 3 ? 'Hot' : warmthLevel === 2 ? 'Warm' : 'Cold';

    const newLeadObj: Lead = {
      id: `LD-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim(),
      phone,
      email,
      practiceArea,
      source: sourceSummary,
      referralSourceCategory: referralCategory,
      socialMediaPlatform: referralCategory === 'Social Media' ? socialPlatform : undefined,
      referralDetail,
      warmth: warmthCategory,
      warmthLevel: warmthLevel,
      stage: 'Inquiry',
      autoConflictMatches: autoMatches,
      conflictCheck: {
        status: autoMatches.length ? 'Flagged' : 'Not Started',
        notes: autoMatches.length ? `Auto-scan flagged ${autoMatches.length} match(es)` : 'Pending partner conflict review',
        checkedBy: '',
        checkedDate: '',
      },
      quoteAmount: 0,
      followupDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    };

    addLead(newLeadObj);
    setIsNewModalOpen(false);
    setName('');
    setPhone('');
    setEmail('');
    setReferralDetail('');
  };

  const handleSaveEditLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead || !editLead.name.trim()) return;

    updateLead(editLead.id, {
      name: editLead.name.trim(),
      phone: editLead.phone,
      email: editLead.email,
      practiceArea: editLead.practiceArea,
      source: editLead.source,
      stage: editLead.stage,
      quoteAmount: editLead.quoteAmount,
      followupDate: editLead.followupDate,
      warmthLevel: editLead.warmthLevel,
      warmth: editLead.warmthLevel === 3 ? 'Hot' : editLead.warmthLevel === 2 ? 'Warm' : 'Cold',
    });

    setEditLead(null);
    showToast(`Lead "${editLead.name}" updated successfully.`);
  };

  // Google Form Consultation Submission via Google Form Service Layer
  const handleGoogleFormConsultationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gfName.trim() || !gfPhone.trim()) {
      showToast('⚠️ Client Name and Telephone Number are required for consultation booking.');
      return;
    }

    processGoogleFormSubmission(
      {
        clientName: gfName.trim(),
        phone: gfPhone.trim(),
        email: gfEmail.trim(),
        practiceArea: gfPracticeArea,
        preferredLawyer: gfLawyerPreference,
        consultationDate: gfConsultationDate,
        consultationTime: gfConsultationTime,
        consultationVenue: gfMode,
        caseSummary: gfCaseSummary,
        source: 'Google Form Consultation Link',
      },
      {
        addLead,
        addDeadline,
        scanConflicts: scanForConflicts,
        showToast,
      }
    );

    setIsGoogleFormModalOpen(false);

    // Reset Form
    setGfName('');
    setGfPhone('');
    setGfEmail('');
    setGfCaseSummary('');
  };

  const handleOpenConflictModal = (l: Lead) => {
    setConflictLead(l);
    setCcStatus(l.conflictCheck.status);
    setCcBy(l.conflictCheck.checkedBy || 'Syafiqah Hamizad');
    setCcNotes(l.conflictCheck.notes || '');
  };

  const handleSaveConflictCheck = () => {
    if (!conflictLead) return;
    updateLead(conflictLead.id, {
      conflictCheck: {
        status: ccStatus,
        notes: ccNotes,
        checkedBy: ccBy,
        checkedDate: new Date().toISOString().slice(0, 10),
      },
    });
    setConflictLead(null);
  };

  const handleOpenConvertModal = (l: Lead) => {
    if (l.conflictCheck.status !== 'Clear') {
      return alert('Conflict check MUST be marked "Clear" by a partner before converting lead to a client!');
    }
    setConvertLead(l);
    setCvName(l.name);
  };

  const handleDoConvert = () => {
    if (!convertLead) return;
    const clientId = `HQ-C${Math.floor(100 + Math.random() * 900)}`;

    addClient({
      id: clientId,
      name: cvName,
      type: cvType,
      contactPerson: '',
      phone: convertLead.phone,
      email: convertLead.email,
      address: cvAddress,
      emergencyContact: cvEmergName ? `${cvEmergName} (${cvEmergPhone})` : '',
      emergencyContactName: cvEmergName,
      emergencyContactPhone: cvEmergPhone,
      emergencyContactEmail: cvEmergEmail,
      emergencyContactRelationship: cvEmergRelation,
      notes: `Converted from Lead ${convertLead.id}. Source: ${convertLead.source}`,
      kyc: [],
    });

    updateLead(convertLead.id, { stage: 'Converted' });
    setConvertLead(null);
  };

  // Warmth counters calculation
  const totalLeadsCount = leads.length;
  const hotCount = leads.filter((l) => (l.warmthLevel === 3 || l.warmth === 'Hot')).length;
  const warmCount = leads.filter((l) => (l.warmthLevel === 2 || l.warmth === 'Warm')).length;
  const coldCount = leads.filter((l) => (l.warmthLevel === 1 || l.warmth === 'Cold' || (!l.warmthLevel && !l.warmth))).length;

  const filteredLeads = leads.filter((l) => {
    const lvl = l.warmthLevel ?? (l.warmth === 'Hot' ? 3 : l.warmth === 'Warm' ? 2 : 1);
    if (filterWarmth === 'Hot' && !(lvl === 3 || l.warmth === 'Hot')) return false;
    if (filterWarmth === 'Warm' && !(lvl === 2 || l.warmth === 'Warm')) return false;
    if (filterWarmth === 'Cold' && !(lvl === 1 || l.warmth === 'Cold')) return false;

    if (filterStatus !== 'All' && l.stage !== filterStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (l.name || '').toLowerCase().includes(q);
      const phoneMatch = (l.phone || '').toLowerCase().includes(q);
      const emailMatch = (l.email || '').toLowerCase().includes(q);
      const areaMatch = (l.practiceArea || '').toLowerCase().includes(q);
      const sourceMatch = (l.source || '').toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !emailMatch && !areaMatch && !sourceMatch) {
        return false;
      }
    }

    return true;
  });

  const getStageBadgeStyle = (stage: string) => {
    switch (stage) {
      case 'Pending':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Contacted':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'Inquiry':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'Consultation':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Quoted':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'Converted':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Lost':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handleConvertToCase = (l: Lead) => {
    // 1. Client Registration Validation Step
    let targetClient = clients.find(
      (c) =>
        c.name.toLowerCase().trim() === l.name.toLowerCase().trim() ||
        (l.phone && c.phone === l.phone) ||
        (l.email && c.email && c.email.toLowerCase().trim() === l.email.toLowerCase().trim())
    );

    let targetClientId = targetClient?.id;
    let targetClientName = targetClient?.name || l.name;

    if (!targetClientId) {
      // Auto conflict check before converting to client
      const autoConflicts = scanClientConflicts({ name: l.name, email: l.email, contactPerson: l.name }, clients, cases);

      targetClientId = `HQ-C${Math.floor(100 + Math.random() * 900)}`;
      targetClientName = l.name;

      addClient({
        id: targetClientId,
        name: l.name,
        type: 'Individual',
        contactPerson: l.name,
        phone: l.phone || '',
        email: l.email || '',
        address: 'Registered Client Address',
        emergencyContact: '',
        notes: `Converted to Client from Prospective Lead ${l.id} (${l.source}). Area: ${l.practiceArea || 'General'}.`,
        kyc: [],
        conflictCheck: {
          status: autoConflicts.length > 0 ? 'Flagged' : 'Clear',
          notes: autoConflicts.length > 0
            ? `Auto-flagged ${autoConflicts.length} potential conflict match(es) during conversion.`
            : `Auto-screened against firm database & cleared upon conversion from Lead ${l.id}.`,
          checkedBy: currentUser?.name || 'Firm Partner',
          checkedDate: new Date().toISOString().split('T')[0],
        },
        autoConflictMatches: autoConflicts,
      });

      showToast(`Registered new Client "${l.name}" (${targetClientId}). Opening Case File setup...`);
    } else {
      showToast(`Validated existing Client "${targetClientName}" (${targetClientId}). Opening Case File setup...`);
    }

    // Mark lead stage as Converted
    updateLead(l.id, { stage: 'Converted' });

    // 2. Open New Case Modal prefilled with client details
    openNewCaseWithPrefill({
      clientId: targetClientId,
      clientName: targetClientName,
      practiceArea: l.practiceArea || 'Civil Litigation',
      caseTitle: `${l.practiceArea || 'Legal Matter'} — ${l.name}`,
    });
  };

  const handleConvertToClient = (l: Lead) => {
    if (l.stage === 'Converted') {
      showToast(`Lead "${l.name}" is already converted into a registered Client.`);
      return;
    }

    let targetClient = clients.find(
      (c) =>
        c.name.toLowerCase().trim() === l.name.toLowerCase().trim() ||
        (l.phone && c.phone === l.phone) ||
        (l.email && c.email && c.email.toLowerCase().trim() === l.email.toLowerCase().trim())
    );

    let targetClientId = targetClient?.id;

    if (!targetClientId) {
      // Auto conflict check before converted to client
      const autoConflicts = scanClientConflicts({ name: l.name, email: l.email, contactPerson: l.name }, clients, cases);
      targetClientId = `HQ-C${Math.floor(100 + Math.random() * 900)}`;

      addClient({
        id: targetClientId,
        name: l.name,
        type: 'Individual',
        contactPerson: l.name,
        phone: l.phone || '',
        email: l.email || '',
        address: 'Registered Client Address',
        emergencyContact: '',
        notes: `Converted from Consultation Lead ${l.id} (${l.source}). Interest Area: ${l.practiceArea || 'General'}.`,
        kyc: [],
        conflictCheck: {
          status: autoConflicts.length > 0 ? 'Flagged' : 'Clear',
          notes: autoConflicts.length > 0
            ? `Auto conflict check flagged ${autoConflicts.length} potential relationship match(es).`
            : `Auto conflict check cleared against firm database.`,
          checkedBy: l.conflictCheck?.checkedBy || currentUser?.name || 'Firm Partner',
          checkedDate: l.conflictCheck?.checkedDate || new Date().toISOString().split('T')[0],
        },
        autoConflictMatches: autoConflicts,
      });

      if (autoConflicts.length > 0) {
        showToast(`⚠️ Lead "${l.name}" converted to Client (${targetClientId}) with ${autoConflicts.length} conflict match(es) flagged!`, 'warning');
      } else {
        showToast(`✅ Lead "${l.name}" successfully converted to Client (${targetClientId})! Conflict screening CLEAR.`);
      }
    } else {
      showToast(`Client profile for "${l.name}" is already registered in Firm Database (${targetClientId}).`);
    }

    updateLead(l.id, { stage: 'Converted' });
  };

  const getWarmthBadge = (l: Lead) => {
    const lvl = l.warmthLevel ?? (l.warmth === 'Hot' ? 3 : l.warmth === 'Warm' ? 2 : 1);
    if (lvl === 3 || l.warmth === 'Hot') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[10.5px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 w-max shadow-2xs">
          <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-500" /> 🔥 Level 3: Hot / High Intent
        </span>
      );
    }
    if (lvl === 2 || l.warmth === 'Warm') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-max shadow-2xs">
          🟧 Level 2: Warm / Consultation
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-md text-[10.5px] font-medium bg-sky-100 text-sky-900 border border-sky-300 flex items-center gap-1 w-max shadow-2xs">
        ❄️ Level 1: Cold / New Inquiry
      </span>
    );
  };

  const handleWarmthChange = (leadId: string, newLvl: number) => {
    const category: LeadWarmth = newLvl === 3 ? 'Hot' : newLvl === 2 ? 'Warm' : 'Cold';
    updateLead(leadId, { warmthLevel: newLvl, warmth: category });
    showToast(`Updated Lead rating to Level ${newLvl} (${category}).`);
  };

  const handleExportLeads = () => {
    const data = filteredLeads.map((l) => ({
      'Lead ID': l.id,
      Name: l.name,
      Phone: l.phone,
      Email: l.email || '—',
      'Practice Area': l.practiceArea,
      Source: l.source,
      'Referral Category': l.referralSourceCategory || '—',
      'Social Media': l.socialMediaPlatform || '—',
      'Warmth Rating': `Level ${l.warmthLevel || (l.warmth === 'Hot' ? 3 : l.warmth === 'Warm' ? 2 : 1)} (${l.warmth || 'Cold'})`,
      'Status / Stage': l.stage,
      'Conflict Screening Status': l.conflictCheck?.status || 'Not Started',
      'Conflict Notes': l.conflictCheck?.notes || '—',
      'Follow-up Date': l.followupDate,
    }));
    exportToCsv('SHCO_Consultation_Leads', data);
    showToast(`Exported ${filteredLeads.length} consultation lead(s) to CSV!`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#A9814A]" />
            Leads &amp; Client Intake Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic conflict screening against existing firm matters and opposing parties under Malaysian Bar rules.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsGoogleFormModalOpen(true)}
            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs border border-emerald-900"
            title="Open Client Consultation Booking Intake & Portal Link"
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span>Client Consultation Booking Intake</span>
          </button>

          <button
            type="button"
            onClick={handleExportLeads}
            className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#A9814A]" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-[#F6F4EE] text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* KPI Heatmap & Warmth Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E1DCCF] p-3.5 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Active Leads</span>
          <div className="text-xl font-bold text-[#16223A] mt-1">{totalLeadsCount}</div>
          <span className="text-[10.5px] text-slate-500">In Pipeline</span>
        </div>

        <div
          onClick={() => setFilterWarmth('Hot')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            filterWarmth === 'Hot'
              ? 'bg-rose-100/70 border-rose-400 ring-2 ring-rose-300'
              : 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-900 uppercase">🔥 Level 3: Hot Leads</span>
            <Flame className="w-4 h-4 text-rose-600 fill-rose-500" />
          </div>
          <div className="text-xl font-extrabold text-rose-900 mt-1">{hotCount}</div>
          <span className="text-[10.5px] font-semibold text-rose-700">High Intent / Ready to Retain</span>
        </div>

        <div
          onClick={() => setFilterWarmth('Warm')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            filterWarmth === 'Warm'
              ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-300'
              : 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-900 uppercase">🟧 Level 2: Warm Leads</span>
            <Thermometer className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-900 mt-1">{warmCount}</div>
          <span className="text-[10.5px] font-semibold text-amber-800">In Consultation / Quoted</span>
        </div>

        <div
          onClick={() => setFilterWarmth('Cold')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
            filterWarmth === 'Cold'
              ? 'bg-sky-100/70 border-sky-400 ring-2 ring-sky-300'
              : 'bg-sky-50/50 border-sky-200 hover:bg-sky-100/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-900 uppercase">❄️ Level 1: Cold Leads</span>
            <span className="text-xs">❄️</span>
          </div>
          <div className="text-xl font-extrabold text-sky-900 mt-1">{coldCount}</div>
          <span className="text-[10.5px] font-semibold text-sky-800">Initial Inquiry / Price Checking</span>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center gap-1.5 bg-white border border-[#E1DCCF] p-1.5 rounded-xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setFilterWarmth('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            filterWarmth === 'All' ? 'bg-[#16223A] text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Leads ({totalLeadsCount})
        </button>
        <button
          onClick={() => setFilterWarmth('Hot')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
            filterWarmth === 'Hot' ? 'bg-rose-600 text-white' : 'text-rose-800 hover:bg-rose-50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Level 3: Hot ({hotCount})</span>
        </button>
        <button
          onClick={() => setFilterWarmth('Warm')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
            filterWarmth === 'Warm' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          <span>🟧 Level 2: Warm ({warmCount})</span>
        </button>
        <button
          onClick={() => setFilterWarmth('Cold')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
            filterWarmth === 'Cold' ? 'bg-sky-700 text-white' : 'text-sky-800 hover:bg-sky-50'
          }`}
        >
          <span>❄️ Level 1: Cold ({coldCount})</span>
        </button>
      </div>

      {/* Search Bar & Status Filter Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-[#E1DCCF] p-3 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by client name, telephone, email, practice area, or referral source..."
              className="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A9814A]/40 bg-slate-50/50 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-600 uppercase hidden sm:inline">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#A9814A]/40 cursor-pointer shadow-2xs"
            >
              <option value="All">All Statuses ({leads.length})</option>
              <option value="Pending">🟡 Pending</option>
              <option value="Contacted">🔵 Contacted</option>
              <option value="Inquiry">🟣 Inquiry</option>
              <option value="Consultation">⚖️ Consultation</option>
              <option value="Quoted">💼 Quoted</option>
              <option value="Converted">✅ Converted</option>
              <option value="Lost">❌ Lost</option>
            </select>
          </div>
        </div>

        {/* Download CSV Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportLeads}
            className="w-full md:w-auto bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Download current filtered consultation leads list as CSV"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">ID</th>
              <th className="p-3 font-bold">Name &amp; Contacts</th>
              <th className="p-3 font-bold">Warmth Level (1-3)</th>
              <th className="p-3 font-bold">Practice Area</th>
              <th className="p-3 font-bold">Source of Referral</th>
              <th className="p-3 font-bold">Status / Stage</th>
              <th className="p-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeads.map((l) => {
              const currentLvl = l.warmthLevel ?? (l.warmth === 'Hot' ? 3 : l.warmth === 'Warm' ? 2 : 1);

              return (
                <tr key={l.id} className="hover:bg-[#FAF8F2] transition-colors">
                  <td className="p-3 font-mono font-medium text-slate-700">{l.id}</td>
                  <td className="p-3 font-bold text-[#16223A]">
                    {l.name}
                    <div className="text-[10.5px] text-slate-500 font-normal">
                      {l.phone} • {l.email || 'No email'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {getWarmthBadge(l)}
                      <div className="flex items-center gap-1">
                        <span className="text-[9.5px] text-slate-400 font-medium">Lvl:</span>
                        <select
                          value={currentLvl}
                          onChange={(e) => handleWarmthChange(l.id, Number(e.target.value))}
                          className="text-[10px] border border-slate-200 rounded px-1 py-0.5 font-bold bg-white text-slate-700 cursor-pointer"
                        >
                          <option value={3}>🔥 Lvl 3 (Hot)</option>
                          <option value={2}>🟧 Lvl 2 (Warm)</option>
                          <option value={1}>❄️ Lvl 1 (Cold)</option>
                        </select>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-800">{l.practiceArea}</td>
                  <td className="p-3 text-slate-700">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-semibold text-[10.5px]">
                      {l.source}
                    </span>
                  </td>
                  <td className="p-3">
                    {/* Status Indicator Badge Dropdown */}
                    <select
                      value={l.stage}
                      onChange={(e) => {
                        const newStage = e.target.value as any;
                        updateLead(l.id, { stage: newStage });
                        showToast(`Updated Lead "${l.name}" status to "${newStage}".`);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold border cursor-pointer transition-all shadow-2xs focus:outline-none ${getStageBadgeStyle(l.stage)}`}
                      title="Click to update consultation lead status"
                    >
                      <option value="Pending">🟡 Pending</option>
                      <option value="Contacted">🔵 Contacted</option>
                      <option value="Inquiry">🟣 Inquiry</option>
                      <option value="Consultation">⚖️ Consultation</option>
                      <option value="Quoted">💼 Quoted</option>
                      <option value="Converted">✅ Converted</option>
                      <option value="Lost">❌ Lost</option>
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {/* CONVERT TO CLIENT BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleConvertToClient(l)}
                        className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-800 hover:bg-emerald-900 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Convert lead into registered client profile in firm database"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
                        <span>{l.stage === 'Converted' ? 'Converted Client' : 'Convert to Client'}</span>
                      </button>

                      {/* EDIT LEAD BUTTON */}
                      <button
                        type="button"
                        onClick={() => setEditLead(l)}
                        className="p-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Edit Lead Particulars"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      </button>

                      {/* DELETE LEAD BUTTON */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLead(l);
                        }}
                        className="p-1.5 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* EDIT LEAD MODAL */}
      {editLead && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] my-8">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#A9814A]" />
                <span>Edit Lead Particulars — {editLead.id}</span>
              </h3>
              <button
                onClick={() => setEditLead(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLead} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Client / Lead Name</label>
                <input
                  type="text"
                  required
                  value={editLead.name}
                  onChange={(e) => setEditLead({ ...editLead, name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editLead.phone}
                    onChange={(e) => setEditLead({ ...editLead, phone: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editLead.email}
                    onChange={(e) => setEditLead({ ...editLead, email: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area</label>
                  <select
                    value={editLead.practiceArea}
                    onChange={(e) => setEditLead({ ...editLead, practiceArea: e.target.value })}
                    className="w-full"
                  >
                    <option>Civil Litigation</option>
                    <option>Conveyancing</option>
                    <option>Corporate &amp; Commercial</option>
                    <option>Criminal</option>
                    <option>Probate &amp; Estate</option>
                    <option>Dispute Resolution / Arbitration</option>
                    <option>Syariah</option>
                    <option>Technology / IP / Fintech</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Pipeline Stage</label>
                  <select
                    value={editLead.stage}
                    onChange={(e) => setEditLead({ ...editLead, stage: e.target.value as any })}
                    className="w-full"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Inquiry">Inquiry</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Source of Referral</label>
                  <input
                    type="text"
                    value={editLead.source}
                    onChange={(e) => setEditLead({ ...editLead, source: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Warmth Rating Level</label>
                  <select
                    value={editLead.warmthLevel || 2}
                    onChange={(e) => setEditLead({ ...editLead, warmthLevel: Number(e.target.value) })}
                    className="w-full"
                  >
                    <option value={3}>🔥 Level 3 (Hot / High Intent)</option>
                    <option value={2}>🟧 Level 2 (Warm / Consultation)</option>
                    <option value={1}>❄️ Level 1 (Cold / New Inquiry)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Estimated Fee Quote (RM)</label>
                  <input
                    type="number"
                    value={editLead.quoteAmount || 0}
                    onChange={(e) => setEditLead({ ...editLead, quoteAmount: Number(e.target.value) })}
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Follow-up Target Date</label>
                  <input
                    type="date"
                    value={editLead.followupDate || ''}
                    onChange={(e) => setEditLead({ ...editLead, followupDate: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditLead(null)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold rounded-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standardized Non-Blocking Confirmation Modal Overlay */}
      {ConfirmationModal}

      {/* GOOGLE FORM CONSULTATION INTAKE MODAL */}
      {isGoogleFormModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-[#E1DCCF] my-8 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#16223A]">Google Form Consultation Intake Portal</h3>
                  <p className="text-xs text-slate-500">Live Client Consultation Booking Engine &amp; Calendar Synchronization</p>
                </div>
              </div>
              <button
                onClick={() => setIsGoogleFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Share Link Strip */}
            {(() => {
              const currentLink = getPracticeSettings().consultationFormLink || 'https://forms.google.com/shcolaw-consultation-intake';
              return (
                <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <LinkIcon className="w-4 h-4 text-[#A9814A] shrink-0" />
                    <span className="font-mono text-slate-700 truncate">{currentLink}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentLink);
                      setCopiedLink(true);
                      showToast('Consultation Intake link copied to clipboard!');
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-3 py-1 bg-[#16223A] hover:bg-[#203050] text-amber-300 font-bold rounded-lg shrink-0 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              );
            })()}

            {/* Consultation Intake Simulation Form */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="font-bold text-[#16223A] text-xs uppercase flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <FileText className="w-4 h-4 text-[#A9814A]" />
                <span>Fill Client Consultation Form (Simulated Intake)</span>
              </div>

              <form onSubmit={handleGoogleFormConsultationSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Prospective Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Datin Rohani Ahmad"
                    value={gfName}
                    onChange={(e) => setGfName(e.target.value)}
                    className="w-full bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Telephone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 012-9876543"
                      value={gfPhone}
                      onChange={(e) => setGfPhone(e.target.value)}
                      className="w-full bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. rohani@example.com"
                      value={gfEmail}
                      onChange={(e) => setGfEmail(e.target.value)}
                      className="w-full bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Practice Area / Legal Concern</label>
                    <select
                      value={gfPracticeArea}
                      onChange={(e) => setGfPracticeArea(e.target.value)}
                      className="w-full bg-white"
                    >
                      <option>Civil Litigation</option>
                      <option>Conveyancing</option>
                      <option>Corporate &amp; Commercial</option>
                      <option>Criminal</option>
                      <option>Probate &amp; Estate</option>
                      <option>Dispute Resolution / Arbitration</option>
                      <option>Syariah</option>
                      <option>Technology / IP / Fintech</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Preferred Counsel</label>
                    <select
                      value={gfLawyerPreference}
                      onChange={(e) => setGfLawyerPreference(e.target.value)}
                      className="w-full bg-white"
                    >
                      <option value="Syafiqah Hamizad">Puan Syafiqah Hamizad (Partner)</option>
                      <option value="Amer Haiqal">Encik Amer Haiqal (Partner)</option>
                      <option value="Zulaikha Afendi">Pn. Zulaikha Afendi (Partner)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Requested Date *</label>
                    <input
                      type="date"
                      required
                      value={gfConsultationDate}
                      onChange={(e) => setGfConsultationDate(e.target.value)}
                      className="w-full bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Time Slot *</label>
                    <select
                      value={gfConsultationTime}
                      onChange={(e) => setGfConsultationTime(e.target.value)}
                      className="w-full bg-white"
                    >
                      <option value="09:30 AM">09:30 AM</option>
                      <option value="10:30 AM">10:30 AM</option>
                      <option value="02:30 PM">02:30 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Consultation Venue</label>
                    <select
                      value={gfMode}
                      onChange={(e) => setGfMode(e.target.value as any)}
                      className="w-full bg-white"
                    >
                      <option value="In-Person (Firm Office)">In-Person Office</option>
                      <option value="Virtual (Google Meet)">Virtual Google Meet</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">Brief Case Summary / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Brief background of dispute, tenancy issue, land sale, or contract breach..."
                    value={gfCaseSummary}
                    onChange={(e) => setGfCaseSummary(e.target.value)}
                    className="w-full bg-white"
                  />
                </div>

                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[10.5px] text-emerald-900 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Submitting this form automatically adds the lead to your register AND schedules a Consultation Event on the Firm Calendar.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsGoogleFormModalOpen(false)}
                    className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>Confirm Consultation Booking &amp; Calendar Sync</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] my-8">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-4">New Lead &amp; Client Intake</h3>
            <form onSubmit={handleSaveLead} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Client / Lead Name (Person or Entity)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Encik Farid Iskandar or Syarikat Mega Sdn Bhd"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={handleQuickConflictSearch}
                    disabled={isSearchingConflicts}
                    className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold px-3 py-2 rounded-md text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Search className={`w-3.5 h-3.5 text-amber-400 ${isSearchingConflicts ? 'animate-spin' : ''}`} />
                    <span>{isSearchingConflicts ? 'Scanning...' : 'Quick Conflict Search'}</span>
                  </button>
                </div>
              </div>

              {/* Live Smart Conflict Screening Results */}
              {name.trim().length >= 2 && (
                <div className="p-3 rounded-lg border text-[11px] space-y-1.5 bg-slate-50 border-slate-200">
                  <div className="font-bold flex items-center justify-between text-slate-800 border-b border-slate-200 pb-1">
                    <span className="flex items-center gap-1.5 text-[#A9814A]">
                      <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                      <span>Firm Registry Conflict Screening Engine</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Scanned {cases.length} Cases &amp; {clients.length} Clients
                    </span>
                  </div>

                  {liveMatches.length === 0 ? (
                    <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>NO CONFLICT IDENTIFIED — CLEAR TO PROCEED</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono">Bar Council Rule 28 Compliant</span>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <div className="text-rose-900 font-bold text-[10.5px] flex items-center gap-1 text-rose-800 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>POTENTIAL RELATIONSHIP / CONFLICT MATCHES FLAGGED ({liveMatches.length}):</span>
                      </div>
                      {liveMatches.map((m, idx) => (
                        <div key={idx} className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-950 font-medium text-[11px] flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold block text-rose-900">{m.label}</span>
                            <span className="text-slate-700 text-[10px] block">{m.detail}</span>
                          </div>
                          <span className="px-1.5 py-0.5 bg-rose-200 text-rose-950 rounded font-mono font-bold text-[9px] uppercase shrink-0">
                            Match Flag
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Phone Number</label>
                  <input type="text" placeholder="e.g. 012-3456789" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Email Address</label>
                  <input type="email" placeholder="e.g. farid@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area</label>
                <select value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} className="w-full">
                  <option>Civil Litigation</option>
                  <option>Conveyancing</option>
                  <option>Corporate &amp; Commercial</option>
                  <option>Criminal</option>
                  <option>Probate &amp; Estate</option>
                  <option>Dispute Resolution / Arbitration</option>
                  <option>Syariah</option>
                  <option>Technology / IP / Fintech</option>
                </select>
              </div>

              {/* Lead Warmth Rating (1 to 3 level indicator) */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#16223A] block uppercase text-[10.5px] flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-500" />
                    <span>Lead Temperature / Warmth Level (1 - 3 Scale)</span>
                  </label>
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900">
                    Level {warmthLevel}/3 ({warmthLevel === 3 ? '🔥 Hot' : warmthLevel === 2 ? '🟧 Warm' : '❄️ Cold'})
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { lvl: 1, label: '❄️ Level 1', sub: 'Cold Inquiry' },
                    { lvl: 2, label: '🟧 Level 2', sub: 'Warm Consultation' },
                    { lvl: 3, label: '🔥 Level 3', sub: 'Hot Intent' },
                  ].map((item) => (
                    <button
                      key={item.lvl}
                      type="button"
                      onClick={() => setWarmthLevel(item.lvl)}
                      className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${
                        warmthLevel === item.lvl
                          ? item.lvl === 3
                            ? 'bg-rose-600 text-white border-rose-700 font-bold shadow-xs'
                            : item.lvl === 2
                            ? 'bg-amber-600 text-white border-amber-700 font-bold shadow-xs'
                            : 'bg-sky-600 text-white border-sky-700 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[9.5px] opacity-90">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source of Referral Granularity */}
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg space-y-2.5">
                <label className="font-bold text-[#16223A] block uppercase text-[10.5px]">
                  Source of Referral Details
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Source Category</label>
                    <select
                      value={referralCategory}
                      onChange={(e) => setReferralCategory(e.target.value as any)}
                      className="w-full text-xs"
                    >
                      <option value="Social Media">Social Media</option>
                      <option value="Existing Client">Existing Client</option>
                      <option value="Referral Partner">Referral Partner / Firm</option>
                      <option value="Walk-In">Walk-In</option>
                      <option value="Website">Firm Website</option>
                      <option value="Event / Seminar">Event / Seminar</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {referralCategory === 'Social Media' ? (
                    <div>
                      <label className="text-slate-600 block text-[10px] font-semibold mb-1">Social Media Platform</label>
                      <select
                        value={socialPlatform}
                        onChange={(e) => setSocialPlatform(e.target.value as any)}
                        className="w-full text-xs"
                      >
                        <option value="Facebook">Facebook</option>
                        <option value="Instagram">Instagram</option>
                        <option value="TikTok">TikTok</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="XiaoHongShu / XHS">XiaoHongShu (XHS)</option>
                        <option value="YouTube">YouTube</option>
                        <option value="WhatsApp / Telegram">WhatsApp / Telegram</option>
                        <option value="Other">Other Platform</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-600 block text-[10px] font-semibold mb-1">Referral Specifics</label>
                      <input
                        type="text"
                        placeholder="e.g. Name of Client or Partner firm"
                        value={referralDetail}
                        onChange={(e) => setReferralDetail(e.target.value)}
                        className="w-full text-xs"
                      />
                    </div>
                  )}
                </div>

                {referralCategory === 'Social Media' && (
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Ad Campaign / Post Detail (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Conveyancing Promo Ad August 2025"
                      value={referralDetail}
                      onChange={(e) => setReferralDetail(e.target.value)}
                      className="w-full text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Review Modal */}
      {conflictLead && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-2">
              Conflict of Interest Check — {conflictLead.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Formal partner determination under Legal Profession Act 1976 and Bar Council Guidelines.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Conflict Determination</label>
                <select
                  value={ccStatus}
                  onChange={(e) => setCcStatus(e.target.value as any)}
                  className="w-full"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="Clear">Clear (No conflict of interest)</option>
                  <option value="Flagged">Flagged (Direct / Potential Conflict)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Reviewed By Partner</label>
                <select value={ccBy} onChange={(e) => setCcBy(e.target.value)} className="w-full">
                  <option value="Syafiqah Hamizad">Syafiqah Hamizad (SH)</option>
                  <option value="Amer Haiqal">Amer Haiqal (AH)</option>
                  <option value="Zulaikha Afendi">Zulaikha Afendi (ZA)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Partner Review Notes</label>
                <textarea
                  rows={3}
                  value={ccNotes}
                  onChange={(e) => setCcNotes(e.target.value)}
                  className="w-full"
                  placeholder="Record conflict search checks, IC cross-checks, and partner reasoning..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setConflictLead(null)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConflictCheck}
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save Determination
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert Lead Modal */}
      {convertLead && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] my-8">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-700" />
              Convert Lead to Registered Client
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter official client details and emergency contact info.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Client Official Name</label>
                <input
                  type="text"
                  value={cvName}
                  onChange={(e) => setCvName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Client Entity Type</label>
                  <select
                    value={cvType}
                    onChange={(e) => setCvType(e.target.value as any)}
                    className="w-full"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Corporate">Corporate / Sdn Bhd</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Correspondence Address</label>
                  <input
                    type="text"
                    placeholder="Full residential or business address"
                    value={cvAddress}
                    onChange={(e) => setCvAddress(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Emergency Contact Separated Boxes */}
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg space-y-2.5">
                <label className="font-bold text-[#16223A] block uppercase text-[10.5px]">
                  Emergency Contact Details
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Puan Aminah Razak"
                      value={cvEmergName}
                      onChange={(e) => setCvEmergName(e.target.value)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 019-8765432"
                      value={cvEmergPhone}
                      onChange={(e) => setCvEmergPhone(e.target.value)}
                      className="w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. aminah@example.com"
                      value={cvEmergEmail}
                      onChange={(e) => setCvEmergEmail(e.target.value)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block text-[10px] font-semibold mb-1">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse / Sibling / Director"
                      value={cvEmergRelation}
                      onChange={(e) => setCvEmergRelation(e.target.value)}
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setConvertLead(null)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDoConvert}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-semibold cursor-pointer"
                >
                  Confirm Client Registration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
