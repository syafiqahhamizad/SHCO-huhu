import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Case, PartnerCode, Hearing, Task, CourtDiaryEntry, ServiceRecord, MeetingNote, InternalNote, OpposingSolicitorRecord, PartyRecord, CaseActivityLog } from '../../types';
import { scanClientConflicts } from '../../lib/conflictUtils';
import { exportToWordDoc } from '../../lib/exportUtils';
import { useConfirmation } from '../../hooks/useConfirmation';
import { getPracticeSettings } from '../../services/templateService';
import { CourtMemoModal } from '../modals/CourtMemoModal';
import { FileCoverModal } from '../modals/FileCoverModal';
import { NewCaseModal } from '../NewCaseModal';
import {
  Scale,
  Plus,
  ArrowLeft,
  Calendar as CalendarIcon,
  FolderOpen,
  BookOpen,
  CheckSquare,
  Building,
  Send,
  FileText,
  Mail,
  MessageSquare,
  Printer,
  Users,
  RefreshCw,
  Briefcase,
  History,
  CheckCircle2,
  UserCheck,
  Activity,
  Table,
  ChevronDown,
  Sparkles,
  ExternalLink,
  CreditCard,
  ShieldCheck,
  Search,
  Trash2,
  Edit3,
  Archive,
  Layers,
} from 'lucide-react';
import { RecycleBinModal } from '../RecycleBinModal';
import { CaseStatusView } from './PracticeViews';

export const PRACTICE_CLIENT_ROLES: Record<string, string[]> = {
  'Civil Litigation': [
    'Plaintiff',
    'Defendant',
    'Appellant',
    'Applicant',
    'Respondent',
    'Intervener',
    'Petitioner',
    'Judgment Creditor',
    'Judgment Debtor',
    'Third Party',
    'Other',
  ],
  'Conveyancing': [
    'Purchaser',
    'Seller / Vendor',
    'Borrower',
    'Lender / Bank',
    'Landlord',
    'Tenant',
    'Assignor',
    'Assignee',
    'Other',
  ],
  'Criminal': [
    'OKT (Accused)',
    'Complainant',
    'Victim',
    'Appellant',
    'Respondent / Appellee',
    'Other',
  ],
  'Corporate/Commercial': [
    'Company / Firm',
    'Director / Shareholder',
    'Investor',
    'Contractor',
    'Client / Party A',
    'Other Party',
    'Other',
  ],
  'Probate/Estate': [
    'Executor / Administrator',
    'Beneficiary',
    'Applicant / Petitioner',
    'Caveator / Objector',
    'Other',
  ],
  'Dispute Resolution': [
    'Claimant',
    'Respondent',
    'Applicant',
    'Intervener',
    'Other',
  ],
  'Syariah': [
    'Pemohon (Applicant)',
    'Responden (Respondent)',
    'Plaintif',
    'Defendan',
    'Other',
  ],
  'Technology/AI/Fintech': [
    'Client',
    'Plaintiff / Claimant',
    'Defendant',
    'Applicant',
    'Respondent',
    'Other',
  ],
};

export const CasesView: React.FC = () => {
  const {
    cases,
    clients,
    users,
    addClient,
    currentUser,
    lawFirmRegistry = [],
    addLawFirmRegistryEntry,
    updateLawFirmRegistryEntry,
    currentCaseId,
    setCurrentCaseId,
    caseSubTab,
    setCaseSubTab,
    currentPartnerCode,
    isAdmin,
    currentRole,
    addCase,
    updateCase,
    deleteCase,
    addCaseActivityLog,
    quotations,
    travelClaims,
    expenses,
    retainers,
    addRetainer,
    addExpense,
    addDeadline,
    setCurrentView,
    showToast,
    addNotification,
    isNewCaseModalOpen,
    setIsNewCaseModalOpen,
    deletedRecords = [],
    auditLogs = [],
  } = useApp();

  const staffUsersList = React.useMemo(() => {
    const activeStaff = (users || []).filter((u) => u.status !== 'Inactive' && u.role !== 'Client');
    if (activeStaff.length > 0) return activeStaff;
    return [
      { id: 'USR-001', name: 'Syafiqah Hamizad', role: 'Managing Partner' },
      { id: 'USR-002', name: 'Zulaikha Afendi', role: 'Partner' },
      { id: 'USR-003', name: 'Amer Haiqal', role: 'Partner' },
    ];
  }, [users]);

  const registeredStaff = React.useMemo(
    () => (users || []).filter((user) => user.status === 'Active' && user.role !== 'Client'),
    [users]
  );
  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);

  const exportMatterDocument = (filename: string, title: string, body: string) => {
    const safeBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
    exportToWordDoc(filename, `<div class="header-title">${title}</div><div class="firm-sub">${selectedCase?.ref || ''} | ${selectedCase?.title || ''}</div><div>${safeBody}</div>`);
  };

  const printMatterDocument = (title: string, body: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const safeBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
    printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:Georgia,serif;color:#16223A;padding:48px;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #A9814A;padding-bottom:12px}.meta{color:#64748B;font:12px Arial,sans-serif;margin-bottom:28px}</style></head><body><h1>${title}</h1><div class="meta">${selectedCase?.ref || ''} | ${selectedCase?.title || ''}</div><div>${safeBody}</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const parseAnyDate = (val?: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed) return null;

    // ISO string YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // MM/YYYY or MM-YYYY
    const myMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{4})/);
    if (myMatch) {
      const month = parseInt(myMatch[1], 10) - 1;
      const year = parseInt(myMatch[2], 10);
      const d = new Date(year, month, 1);
      if (!isNaN(d.getTime())) return d;
    }

    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime())) return nativeDate;

    return null;
  };

  const getCaseOpenDateString = (cs: any): string => {
    if (!cs) return '';
    if (cs.fileOpenedDate) return cs.fileOpenedDate;

    // Extract Open File Date (MM-YYYY or MM/YYYY or MM-YY or YY) from reference number generator code
    if (cs.ref && typeof cs.ref === 'string') {
      const mmYyyyMatch = cs.ref.match(/(\d{2})[\/\-](\d{4})$/);
      if (mmYyyyMatch) {
        return `${mmYyyyMatch[2]}-${mmYyyyMatch[1]}-01`;
      }
      const mmYyMatch = cs.ref.match(/(\d{2})[\/\-](\d{2})$/);
      if (mmYyMatch) {
        const yr = 2000 + parseInt(mmYyMatch[2], 10);
        return `${yr}-${mmYyMatch[1]}-01`;
      }
      const yyMatch = cs.ref.match(/[\/\-](\d{2})$/);
      if (yyMatch) {
        const yr = 2000 + parseInt(yyMatch[1], 10);
        return `${yr}-01-01`;
      }
    }

    return cs.createdDate || cs.createdAt || cs.dateOpened || '';
  };

  const calculateFileAge = (cs: any): string => {
    if (!cs) return 'N/A';
    const openDateStr = getCaseOpenDateString(cs);
    const startDate = parseAnyDate(openDateStr);

    if (!startDate || isNaN(startDate.getTime())) {
      return '1 day';
    }

    const today = new Date();
    if (startDate.getTime() > today.getTime()) {
      return 'Today (0 days)';
    }

    let years = today.getFullYear() - startDate.getFullYear();
    let months = today.getMonth() - startDate.getMonth();
    let days = today.getDate() - startDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const totalDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (totalDays <= 0) return 'Today (0 days)';
    if (years === 0 && months === 0) return `${days} ${days === 1 ? 'day' : 'days'}`;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
    if (years === 0 && months < 3 && days > 0) {
      parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }

    return parts.join(' ') || '1 day';
  };

  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isMatterDetailsEditOpen, setIsMatterDetailsEditOpen] = useState(false);
  const [matterEditTitle, setMatterEditTitle] = useState('');
  const [matterEditPracticeArea, setMatterEditPracticeArea] = useState('');
  const [matterEditClientName, setMatterEditClientName] = useState('');
  const [matterEditClientRole, setMatterEditClientRole] = useState('');
  const [matterEditCourt, setMatterEditCourt] = useState('');
  const [matterEditJudge, setMatterEditJudge] = useState('');
  const [matterEditCourtCaseNo, setMatterEditCourtCaseNo] = useState('');
  const [matterEditLawyer, setMatterEditLawyer] = useState('');
  const [matterEditHandlers, setMatterEditHandlers] = useState<string[]>([]);
  const [matterEditStage, setMatterEditStage] = useState('');
  const [matterEditNextHearing, setMatterEditNextHearing] = useState('');
  const [matterEditNotes, setMatterEditNotes] = useState('');
  const [matterEditCode, setMatterEditCode] = useState('');
  const [matterEditSubtype, setMatterEditSubtype] = useState('');
  const [matterEditPropertyTitleNo, setMatterEditPropertyTitleNo] = useState('');
  const [matterEditPropertyAddress, setMatterEditPropertyAddress] = useState('');
  const [matterEditPurchasePrice, setMatterEditPurchasePrice] = useState('');
  const [matterEditFinancierBank, setMatterEditFinancierBank] = useState('');
  const [matterEditCorporateMatterType, setMatterEditCorporateMatterType] = useState('');
  const [matterEditContractValue, setMatterEditContractValue] = useState('');
  const [matterEditRegulatoryAuthority, setMatterEditRegulatoryAuthority] = useState('');
  const [matterEditGoverningLaw, setMatterEditGoverningLaw] = useState('');

  const isPartner = currentRole === 'Partner' || isAdmin;

  // List view filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [casesViewMode, setCasesViewMode] = useState<'status' | 'registry'>('registry');

  // Process Case Intake Modal State
  const [isCaseIntakeModalOpen, setIsCaseIntakeModalOpen] = useState(false);

  // New Case Form Fields State
  const [ncClientId, setNcClientId] = useState(clients[0]?.id || '');
  const [ncPracticeArea, setNcPracticeArea] = useState('Civil Litigation');
  const [ncMatterCode, setNcMatterCode] = useState('L');
  const [ncClientRole, setNcClientRole] = useState('Plaintiff');
  const [ncCustomRole, setNcCustomRole] = useState('');
  const [ncSubtype, setNcSubtype] = useState('');
  const [ncClientTag, setNcClientTag] = useState('QAL');
  const [ncSelectedPartners, setNcSelectedPartners] = useState<PartnerCode[]>(['SH']);
  const [ncLawyerInCharge, setNcLawyerInCharge] = useState<PartnerCode>('SH');
  const [ncCourt, setNcCourt] = useState('Sessions Court Kuala Terengganu');
  const [ncJudge, setNcJudge] = useState('YA Puan Hakim Zarina');
  const [ncCourtCaseNo, setNcCourtCaseNo] = useState('');
  const [ncPropertyTitleNo, setNcPropertyTitleNo] = useState('');
  const [ncPropertyAddress, setNcPropertyAddress] = useState('');
  const [ncPurchasePrice, setNcPurchasePrice] = useState('');
  const [ncFinancierBank, setNcFinancierBank] = useState('');
  const [ncCorporateMatterType, setNcCorporateMatterType] = useState('');
  const [ncContractValue, setNcContractValue] = useState('');
  const [ncRegulatoryAuthority, setNcRegulatoryAuthority] = useState('');
  const [ncGoverningLaw, setNcGoverningLaw] = useState('');
  const [ncOpposing, setNcOpposing] = useState('');
  const [ncOpposingFirm, setNcOpposingFirm] = useState('');
  const [ncOpposingSolicitor, setNcOpposingSolicitor] = useState('');
  const [ncOpposingRef, setNcOpposingRef] = useState('');

  // Multi Opposing Party State during New Case Creation
  const [ncOpposingPartiesList, setNcOpposingPartiesList] = useState<PartyRecord[]>([]);
  const [ncAddOppPartyName, setNcAddOppPartyName] = useState<string>('');
  const [ncAddOppPartyRole, setNcAddOppPartyRole] = useState<string>('1st Defendant');

  // Multi-Client Representation (Our Side - SHCO) during New Case Creation State
  const [ncClientsList, setNcClientsList] = useState<PartyRecord[]>([]);
  const [ncAddClientSelectId, setNcAddClientSelectId] = useState<string>(''); // existing client id
  const [ncAddClientRole, setNcAddClientRole] = useState<string>('1st Plaintiff');

  // Change Opposing Solicitors Modal State
  const [isChangeOpposingModalOpen, setIsChangeOpposingModalOpen] = useState(false);
  const [chgFirmName, setChgFirmName] = useState('');
  const [chgSolicitorName, setChgSolicitorName] = useState('');
  const [chgFirmRef, setChgFirmRef] = useState('');
  const [chgPhone, setChgPhone] = useState('');
  const [chgEmail, setChgEmail] = useState('');
  const [chgEffectiveDate, setChgEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [chgRemarks, setChgRemarks] = useState('');

  // Opposing Solicitors Registry Modal State (Multi Lawfirm / Multi Solicitor)
  const [isRegOpposingModalOpen, setIsRegOpposingModalOpen] = useState(false);
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [regPartyRepresented, setRegPartyRepresented] = useState('1st Defendant');
  const [regFirmName, setRegFirmName] = useState('');
  const [regSolicitors, setRegSolicitors] = useState('');
  const [regFirmRef, setRegFirmRef] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Multi-Client (Our Side) Modal & State
  const [isClientPartyModalOpen, setIsClientPartyModalOpen] = useState(false);
  const [editingClientPartyId, setEditingClientPartyId] = useState<string | null>(null);
  const [cpSelectedClientId, setCpSelectedClientId] = useState<string>(''); // 'NEW' or existing client id
  const [cpName, setCpName] = useState('');
  const [cpRole, setCpRole] = useState('1st Plaintiff');
  const [cpIc, setCpIc] = useState('');
  const [cpPhone, setCpPhone] = useState('');
  const [cpEmail, setCpEmail] = useState('');


  // Multi-Opposing Party (Their Side) Modal & State
  const [isOppPartyModalOpen, setIsOppPartyModalOpen] = useState(false);
  const [editingOppPartyId, setEditingOppPartyId] = useState<string | null>(null);
  const [opName, setOpName] = useState('');
  const [opRole, setOpRole] = useState('1st Defendant');
  const [opIc, setOpIc] = useState('');

  // SHCO Lawyer attendance helpers in Court Diary
  const [shcoSelectedLawyer, setShcoSelectedLawyer] = useState('Syafiqah Hamizad (SH)');
  const [shcoCustomLawyer, setShcoCustomLawyer] = useState('');

  // New Case Modal - Multiple Opposing Solicitors Registry State & Builder
  const [ncOpposingRegistry, setNcOpposingRegistry] = useState<OpposingSolicitorRecord[]>([]);
  const [ncAddPartyRep, setNcAddPartyRep] = useState('2nd Defendant');
  const [ncAddFirmName, setNcAddFirmName] = useState('');
  const [ncAddSolicitors, setNcAddSolicitors] = useState('');
  const [ncAddFirmRef, setNcAddFirmRef] = useState('');

  // Folder state in Documents tab
  const [openDocFolder, setOpenDocFolder] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Sub-tab modals
  const [isAddHearingModalOpen, setIsAddHearingModalOpen] = useState(false);
  const [isAddDiaryModalOpen, setIsAddDiaryModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isAddMeetingModalOpen, setIsAddMeetingModalOpen] = useState(false);
  const [isAddInternalModalOpen, setIsAddInternalModalOpen] = useState(false);
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);

  // Case Deletion & Activity Log state
  const { confirm, ConfirmationModal } = useConfirmation();

  const handleDeleteCase = async (cs: Case) => {
    const confirmed = await confirm({
      title: 'Confirm Matter File Deletion',
      message: 'Are you sure you want to delete this case? Use this feature if a matter file was wrongly entered or created by mistake.',
      variant: 'danger',
      confirmText: 'Delete Matter File Permanently',
      details: [
        { label: 'Ref Seal', value: cs.ref },
        { label: 'Title', value: cs.title },
        { label: 'Practice Area', value: cs.type },
        { label: 'Client', value: cs.clientName || 'Unspecified' },
      ],
    });

    if (confirmed) {
      if (currentCaseId === cs.id) {
        setCurrentCaseId(null);
      }
      deleteCase(cs.id);
      showToast(`Matter file ${cs.ref} deleted permanently.`);
    }
  };

  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);
  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actType, setActType] = useState<CaseActivityLog['type']>('Compliance Check');

  // Sharing Modals inside subtabs
  const [waShareText, setWaShareText] = useState<string | null>(null);
  const [emailShareObj, setEmailShareObj] = useState<{ subject: string; body: string } | null>(null);

  // Form states for modals
  const [hfPurpose, setHfPurpose] = useState('Case Management');
  const [hfDate, setHfDate] = useState(new Date().toISOString().slice(0, 10));
  const [hfTime, setHfTime] = useState('09:00');
  const [hfStatus, setHfStatus] = useState<any>('Scheduled');

  // Court Diary form
  const [selectedMemoEntry, setSelectedMemoEntry] = useState<CourtDiaryEntry | null>(null);
  const [dfDate, setDfDate] = useState(new Date().toISOString().slice(0, 10));
  const [dfMatter, setDfMatter] = useState('');
  const [dfCorum, setDfCorum] = useState('');
  const [dfMedium, setDfMedium] = useState<'OPEN COURT' | 'IN CHAMBERS' | 'E-REVIEW'>('OPEN COURT');
  const [dfOurLawyer, setDfOurLawyer] = useState('');
  const [dfOppLawyer, setDfOppLawyer] = useState('');
  const [dfPlaintifApplicant, setDfPlaintifApplicant] = useState('');
  const [dfDefendantRespondent, setDfDefendantRespondent] = useState('');
  const [dfClientName, setDfClientName] = useState('');
  const [dfClientAtt, setDfClientAtt] = useState<'Present' | 'Not Present'>('Present');
  const [dfOpponentName, setDfOpponentName] = useState('');
  const [dfOppAtt, setDfOppAtt] = useState<'Present' | 'Not Present'>('Present');
  const [dfStatus, setDfStatus] = useState('');
  const [dfNextDate, setDfNextDate] = useState('');
  const [dfInstructions, setDfInstructions] = useState('');
  const [dfDirections, setDfDirections] = useState('');
  const [dfTask, setDfTask] = useState('');

  // Task form
  const [tkTitle, setTkTitle] = useState('');
  const [tkType, setTkType] = useState<'Standard' | 'Review'>('Standard');
  const [tkAssignedTo, setTkAssignedTo] = useState<string[]>([]);
  const [tkPriority, setTkPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [tkDue, setTkDue] = useState(new Date().toISOString().slice(0, 10));
  const [tkReviewer, setTkReviewer] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Service Record form
  const [svcDate, setSvcDate] = useState(new Date().toISOString().slice(0, 10));
  const [svcDoc, setSvcDoc] = useState('');
  const [svcServedOn, setSvcServedOn] = useState('');
  const [svcMethod, setSvcMethod] = useState('Personal Service');
  const [svcServedBy, setSvcServedBy] = useState('');
  const [svcProof, setSvcProof] = useState<'Y' | 'N'>('Y');

  // Meeting note form
  const [mnDate, setMnDate] = useState(new Date().toISOString().slice(0, 10));
  const [mnOurLawyers, setMnOurLawyers] = useState('');
  const [mnLawyerSearch, setMnLawyerSearch] = useState('');
  const [mnClientAttendees, setMnClientAttendees] = useState('');
  const [mnNotes, setMnNotes] = useState('');
  const [mnDecisions, setMnDecisions] = useState('');

  // Internal note form
  const [inDate, setInDate] = useState(new Date().toISOString().slice(0, 10));
  const [inType, setInType] = useState('Research');
  const [inContent, setInContent] = useState('');

  // Physical File Cover Modal State
  const [isFileCoverModalOpen, setIsFileCoverModalOpen] = useState(false);

  // Legal Research Form & Modal State
  const [isAddResearchModalOpen, setIsAddResearchModalOpen] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resIssues, setResIssues] = useState('');
  const [resPartiesAndCourts, setResPartiesAndCourts] = useState('');
  const [resFindingsAndRatio, setResFindingsAndRatio] = useState('');
  const [resApplicationToCase, setResApplicationToCase] = useState('');
  const [resLexisUrl, setResLexisUrl] = useState('');

  // AI Meeting Summarizer State
  const [isAiMeetingModalOpen, setIsAiMeetingModalOpen] = useState(false);
  const [rawMeetingTranscript, setRawMeetingTranscript] = useState('');
  const [isGeneratingAiMeeting, setIsGeneratingAiMeeting] = useState(false);

  // Enhanced Task State
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [matterTaskLayout, setMatterTaskLayout] = useState<'kanban' | 'table'>('kanban');
  const [draggedMatterTaskId, setDraggedMatterTaskId] = useState<string | null>(null);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [tkStageTag, setTkStageTag] = useState<string>('PTCM');
  const [tkCategoryTag, setTkCategoryTag] = useState<string>('Civil Litigation');
  const [tkDescription, setTkDescription] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Weekly Case Status Custom Manual Entries State & Lawyer Filter
  const [statusDoneThisWeekManual, setStatusDoneThisWeekManual] = useState('');
  const [statusNextActionsManual, setStatusNextActionsManual] = useState('');
  const [statusLawyerFilter, setStatusLawyerFilter] = useState<string>('ALL');

  // Cashbook Entry Modal State
  const [isAddCashbookModalOpen, setIsAddCashbookModalOpen] = useState(false);
  const [cbType, setCbType] = useState<'Office' | 'Client'>('Office');
  const [cbDate, setCbDate] = useState(new Date().toISOString().slice(0, 10));
  const [cbRef, setCbRef] = useState('');
  const [cbDesc, setCbDesc] = useState('');
  const [cbAmount, setCbAmount] = useState('');
  const [cbDirection, setCbDirection] = useState<'Debit' | 'Credit'>('Debit');

  // File Closing Letter Modal State
  const [isClosingLetterModalOpen, setIsClosingLetterModalOpen] = useState(false);

  // Doc upload form
  const [docName, setDocName] = useState('');
  const [docFolderCategory, setDocFolderCategory] = useState('Cause Papers');

  // Search & Multi-select Handler Dropdown State for Edit Matter Modal
  const [handlerSearchQuery, setHandlerSearchQuery] = useState('');
  const [isHandlerDropdownOpen, setIsHandlerDropdownOpen] = useState(false);

  const selectedCase = cases.find((c) => c.id === currentCaseId);

  const handleOpenMatterDetailsEdit = () => {
    if (!selectedCase) return;
    setMatterEditTitle(selectedCase.title || '');
    setMatterEditPracticeArea(selectedCase.practiceArea || selectedCase.type || '');
    setMatterEditClientName(selectedCase.clientName || '');
    setMatterEditClientRole(selectedCase.clientRole || '');
    setMatterEditCourt(selectedCase.court || '');
    setMatterEditJudge(selectedCase.judge || '');
    setMatterEditCourtCaseNo(selectedCase.courtCaseNo || '');
    const storedHandlers = selectedCase.lawyers?.filter(Boolean) || [];
    const registeredLawyers = selectedCase.lawyerInCharge?.split(',').map((name) => name.trim()).filter(Boolean) || [];
    setMatterEditHandlers(storedHandlers.length > 0 ? storedHandlers : registeredLawyers);
    setMatterEditLawyer(registeredLawyers[0] || storedHandlers[0] || '');
    setMatterEditStage(selectedCase.stage || 'PTCM');
    setMatterEditNextHearing(selectedCase.nextHearing || '');
    setMatterEditNotes(selectedCase.caseNotes || '');
    setMatterEditCode(selectedCase.matterCode || '');
    setMatterEditSubtype(selectedCase.subtype || selectedCase.customSubtype || '');
    setMatterEditPropertyTitleNo(selectedCase.propertyTitleNo || '');
    setMatterEditPropertyAddress(selectedCase.propertyAddress || '');
    setMatterEditPurchasePrice(String(selectedCase.purchasePrice || ''));
    setMatterEditFinancierBank(selectedCase.financierBank || '');
    setMatterEditCorporateMatterType(selectedCase.corporateMatterType || '');
    setMatterEditContractValue(String(selectedCase.contractValue || ''));
    setMatterEditRegulatoryAuthority(selectedCase.regulatoryAuthority || '');
    setMatterEditGoverningLaw(selectedCase.governingLaw || '');
    setHandlerSearchQuery('');
    setIsHandlerDropdownOpen(false);
    setIsMatterDetailsEditOpen(true);
  };

  const handleSaveMatterDetails = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCase || !matterEditTitle.trim()) return;
    const fileHandlers = Array.from(new Set(matterEditHandlers.filter(Boolean)));

    updateCase(selectedCase.id, {
      title: matterEditTitle.trim(),
      type: matterEditPracticeArea.trim() || selectedCase.type,
      practiceArea: matterEditPracticeArea.trim() || selectedCase.practiceArea,
      clientName: matterEditClientName.trim(),
      clientRole: matterEditClientRole.trim(),
      court: matterEditCourt.trim(),
      judge: matterEditJudge.trim(),
      courtCaseNo: matterEditCourtCaseNo.trim() || undefined,
      lawyers: fileHandlers,
      stage: matterEditStage.trim(),
      caseNotes: matterEditNotes.trim(),
      propertyTitleNo: matterEditPropertyTitleNo.trim() || undefined,
      propertyAddress: matterEditPropertyAddress.trim() || undefined,
      purchasePrice: matterEditPurchasePrice.trim() || undefined,
      financierBank: matterEditFinancierBank.trim() || undefined,
      corporateMatterType: matterEditCorporateMatterType.trim() || undefined,
      contractValue: matterEditContractValue.trim() || undefined,
      regulatoryAuthority: matterEditRegulatoryAuthority.trim() || undefined,
      governingLaw: matterEditGoverningLaw.trim() || undefined,
    });
    setIsMatterDetailsEditOpen(false);
    showToast(`Matter ${selectedCase.ref} details updated.`);
  };

  const isPartnerOrAdmin = isAdmin;

  // Sort cases in descending order (latest registered cases at the top for Admin/Partner view)
  const sortedCases = [...cases].sort((a, b) => {
    const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
    const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return b.id.localeCompare(a.id);
  });

  // Role-based visibility scoping:
  // - Only administrators see firm-wide data
  // - Partners and other staff see only matters assigned to them
  const scopedCases = isPartnerOrAdmin
    ? sortedCases
    : sortedCases.filter((cs) => {
        const userTags = [
          currentUser?.name,
          currentUser?.email?.split('@')[0],
          currentPartnerCode,
        ]
          .filter(Boolean)
          .map((value) => value!.toLowerCase());
        const matchesUser = (value?: string) =>
          Boolean(value && userTags.some((tag) => value.toLowerCase().includes(tag)));
        const matchLawyerInCharge = cs.lawyerInCharge
          ? matchesUser(cs.lawyerInCharge)
          : false;
        const matchLawyersList = cs.lawyers
          ? cs.lawyers.some((lawyer) => matchesUser(lawyer))
          : false;
        return matchLawyerInCharge || matchLawyersList;
      });

  const filteredCasesList = scopedCases.filter((c) => {
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    const matchesLawyer =
      statusLawyerFilter && statusLawyerFilter !== 'ALL'
        ? c.lawyerInCharge === statusLawyerFilter ||
          (c.lawyers && c.lawyers.includes(statusLawyerFilter)) ||
          (c.tasks && c.tasks.some((t) => t.assignedTo === statusLawyerFilter))
        : true;
    return matchesStatus && matchesLawyer;
  });

  // Reference Generator Helper
  const PRACTICE_CODE_MAP: Record<string, string> = {
    'Civil Litigation': 'L',
    'Litigation': 'L',
    'Conveyancing': 'CONV',
    'Corporate/Commercial': 'CORP',
    'Corporate': 'CORP',
    'Criminal': 'CR',
    'Estate Administration': 'EST',
    'Estate': 'EST',
    'Probate/Estate': 'EST',
    'Probate / Estate Administration': 'EST',
    'Dispute Resolution': 'L',
    'Syariah': 'SY',
    'Technology/AI/Fintech': 'TECH',
  };

  const MATTER_CODES_BY_PRACTICE: Record<string, { code: string; label: string }[]> = {
    'Civil Litigation': [
      { code: 'CIV', label: 'Civil Claim / Defence' },
      { code: 'INJ', label: 'Injunction / Interlocutory Application' },
      { code: 'APP', label: 'Appeal' },
      { code: 'ENF', label: 'Enforcement / Judgment' },
      { code: 'MED', label: 'Mediation / Settlement' },
    ],
    Conveyancing: [
      { code: 'SPA', label: 'Sale & Purchase Agreement' },
      { code: 'MOT', label: 'Transfer / Memorandum of Transfer' },
      { code: 'LOAN', label: 'Loan / Financing Documentation' },
      { code: 'TEN', label: 'Tenancy / Lease' },
      { code: 'DIS', label: 'Property Dispute' },
    ],
    'Corporate/Commercial': [
      { code: 'SSA', label: 'Share Sale / Subscription' },
      { code: 'AGM', label: 'Corporate Secretarial / Governance' },
      { code: 'AGR', label: 'Commercial Agreement' },
      { code: 'M&A', label: 'Merger & Acquisition' },
      { code: 'ADV', label: 'Corporate Advisory' },
    ],
    Criminal: [
      { code: 'CRIM', label: 'Criminal Defence' },
      { code: 'BAIL', label: 'Bail Application' },
      { code: 'MACC', label: 'MACC / Investigation' },
      { code: 'APPEAL', label: 'Criminal Appeal' },
    ],
    'Probate/Estate': [
      { code: 'PROB', label: 'Grant of Probate' },
      { code: 'LA', label: 'Letters of Administration' },
      { code: 'EST', label: 'Estate Administration' },
      { code: 'WILL', label: 'Will / Estate Planning' },
    ],
    Syariah: [
      { code: 'DIV', label: 'Syariah Divorce / Fasakh' },
      { code: 'HAD', label: 'Hadahanah / Custody' },
      { code: 'NAF', label: 'Maintenance / Nafkah' },
      { code: 'HRT', label: 'Harta Sepencarian' },
    ],
    'Dispute Resolution': [
      { code: 'MED', label: 'Mediation' },
      { code: 'ARB', label: 'Arbitration' },
      { code: 'ADJ', label: 'Adjudication' },
      { code: 'SET', label: 'Settlement / Negotiation' },
    ],
    'Technology/AI/Fintech': [
      { code: 'TECH', label: 'Technology Advisory' },
      { code: 'DATA', label: 'Data Protection / Privacy' },
      { code: 'FIN', label: 'Fintech Regulatory' },
      { code: 'IP', label: 'Technology IP / Licensing' },
    ],
  };

  const getMatterCodes = (practice: string) => MATTER_CODES_BY_PRACTICE[practice] || [
    { code: 'GEN', label: 'General Matter' },
    { code: 'ADV', label: 'Advisory' },
  ];

  const normalizePracticeKey = (value: string) =>
    (value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[()]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\/commercial/g, '')
      .replace(/civil\s+/g, '')
      .trim();

  const getConfiguredMatterCodes = (practice: string) => {
    try {
      const configuredCodes = getPracticeSettings().matterCodes || [];
      const normalizedPractice = normalizePracticeKey(practice);
      const aliasGroups: Record<string, string[]> = {
        'litigation': ['litigation', 'civil litigation'],
        'civil litigation': ['litigation', 'civil litigation'],
        'conveyancing': ['conveyancing', 'property', 'sale and purchase'],
        'corporate': ['corporate', 'corporate and commercial', 'commercial'],
        'estate administration': ['estate administration', 'probate', 'estate', 'probate and estate'],
        'criminal': ['criminal', 'criminal defence', 'criminal defense'],
        'syariah': ['syariah'],
      };

      const matchingCodes = configuredCodes.filter((matter) => {
        const configuredPractice = normalizePracticeKey(matter.practiceArea || '');
        const allowedPracticeNames = aliasGroups[normalizedPractice] || [normalizedPractice];
        return allowedPracticeNames.includes(configuredPractice) || configuredPractice === normalizedPractice;
      });
      if (matchingCodes.length > 0) return matchingCodes.map((matter) => ({ code: matter.code, label: matter.name }));
    } catch (e) {
      // Use the built-in starter list if settings cannot be read.
    }
    return getMatterCodes(practice);
  };

  const generateRefString = (practice: string, subtype: string, partners: PartnerCode[], lawyer: PartnerCode, tag: string) => {
    let practiceCode = PRACTICE_CODE_MAP[practice];
    if (!practiceCode) {
      try {
        const savedSettings = getPracticeSettings();
        const customAreas = savedSettings.practiceAreas || [];
        const matched = customAreas.find(
          (pa) => pa.name.toLowerCase() === practice.toLowerCase() || pa.code.toLowerCase() === practice.toLowerCase()
        );
        if (matched) practiceCode = matched.code.toUpperCase();
      } catch (e) {
        // Fallback
      }
    }
    if (!practiceCode) practiceCode = 'L';

    const partnerCode = partners.length > 0 ? [...partners].sort((a, b) => (a === 'SH' ? -1 : 0) - (b === 'SH' ? -1 : 0)).join('/') : '';
    const matterCode = subtype.trim() ? subtype.trim().toUpperCase() : 'GEN';
    const clientCode = tag.trim() ? tag.trim().toUpperCase() : 'CLIENT';
    const runningNo = String(cases.length).padStart(3, '0');
    const now = new Date();
    const mmYY = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const parts = [
      'SHC',
      ...(partnerCode ? [partnerCode] : []),
      lawyer,
      matterCode,
      clientCode,
      runningNo,
      mmYY,
    ];
    return parts.join('/');
  };

  const handlePracticeAreaChange = (area: string) => {
    setNcPracticeArea(area);
    setNcMatterCode(getConfiguredMatterCodes(area)[0]?.code || getMatterCodes(area)[0].code);
    const availableRoles = PRACTICE_CLIENT_ROLES[area] || ['Client'];
    setNcClientRole(availableRoles[0]);
    setNcCustomRole('');
  };

  // Helper: Sync opposing firm & counsel details into central Law Firm Registry
  const syncOpposingFirmToRegistry = (
    firmName: string,
    solicitorName?: string,
    phone?: string,
    email?: string
  ) => {
    if (!firmName || !firmName.trim()) return;
    const trimmedFirm = firmName.trim();
    const existing = lawFirmRegistry.find(
      (f) => f.firmName.toLowerCase() === trimmedFirm.toLowerCase()
    );

    if (existing) {
      let updatedCounsels = existing.counsels ? [...existing.counsels] : [];
      if (solicitorName && solicitorName.trim()) {
        const names = solicitorName.split(',').map((s) => s.trim()).filter(Boolean);
        names.forEach((n) => {
          if (!updatedCounsels.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
            updatedCounsels.push({
              id: `counsel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: n,
              roleTitle: 'Advocate & Solicitor',
              phone: phone || '',
              email: email || '',
            });
          }
        });
      }
      updateLawFirmRegistryEntry(existing.id, {
        counsels: updatedCounsels,
        phone: phone || existing.phone,
        email: email || existing.email,
      });
    } else {
      const newEntryId = `LFR-${Math.floor(1000 + Math.random() * 9000)}`;
      const counselsArr = solicitorName
        ? solicitorName.split(',').map((s) => s.trim()).filter(Boolean).map((n) => ({
            id: `counsel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: n,
            roleTitle: 'Advocate & Solicitor',
            phone: phone || '',
            email: email || '',
          }))
        : [];

      addLawFirmRegistryEntry({
        id: newEntryId,
        firmName: trimmedFirm,
        phone: phone || '',
        email: email || '',
        counsels: counselsArr,
        notes: 'Auto-linked during matter record entry',
      });
    }
  };

  const handleSaveNewCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (ncSelectedPartners.length === 0) return alert('Select at least one partner in charge');

    const clientObj = clients.find((c) => c.id === ncClientId);
    const clientNameStr = clientObj ? clientObj.name : 'Client';
    const selectedMatterCode = ncMatterCode === 'CUSTOM' ? ncSubtype : ncMatterCode;
    if (!selectedMatterCode.trim()) {
      showToast('Enter a custom Matter Code before registering this matter.');
      return;
    }
    const generatedRef = generateRefString(ncPracticeArea, selectedMatterCode, ncSelectedPartners, ncLawyerInCharge, ncClientTag);

    const finalRole = ncClientRole === 'Other' ? (ncCustomRole.trim() || 'Client') : ncClientRole;

    // Ensure represented clients list is populated
    const finalClientsList: PartyRecord[] = ncClientsList.length > 0
      ? ncClientsList
      : [
          {
            id: `CP-init-${Date.now()}`,
            clientId: ncClientId,
            name: clientNameStr,
            role: finalRole,
            phone: clientObj?.phone,
            email: clientObj?.email,
          },
        ];

    const leadClientName = finalClientsList[0]?.name || clientNameStr;
    const leadClientId = finalClientsList[0]?.clientId || ncClientId;

    const finalOpposingPartiesList: PartyRecord[] = ncOpposingPartiesList.length > 0
      ? ncOpposingPartiesList
      : [
          {
            id: `OP-init-${Date.now()}`,
            name: ncOpposing.trim() || 'Opposing Party',
            role: '1st Defendant',
          },
        ];

    const leadOpposingName = finalOpposingPartiesList[0]?.name || ncOpposing.trim() || 'Opposing Party';

    const newCaseId = `CS-${Math.floor(100 + Math.random() * 900)}`;
    const builtRegistry: OpposingSolicitorRecord[] = [];
    if (ncOpposingFirm.trim()) {
      builtRegistry.push({
        id: `OSR-primary-${Date.now()}`,
        partyRepresented: finalOpposingPartiesList[0]?.role ? `Representing ${finalOpposingPartiesList[0].name} (${finalOpposingPartiesList[0].role})` : 'Opposing Party Representative',
        firmName: ncOpposingFirm.trim(),
        solicitors: '',
        firmRef: ncOpposingRef.trim(),
        isPrimary: true,
      });

      // Sync with Law Firm Registry database!
      syncOpposingFirmToRegistry(ncOpposingFirm);
    }

    if (ncOpposingRegistry.length > 0) {
      builtRegistry.push(...ncOpposingRegistry);
      ncOpposingRegistry.forEach((reg) => {
        syncOpposingFirmToRegistry(reg.firmName, '', reg.contactNumber, reg.email);
      });
    }

    const clientKycDocs = (clients || []).find((c) => c.id === leadClientId)?.kyc || [];
    const autoDriveDocs = [
      {
        id: `DOC-${Date.now()}-1`,
        name: `[DRAFT] Writ of Summons & Statement of Claim.docx`,
        category: '01. Cause Papers/Drafts',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_CP_Draft_1`,
      },
      {
        id: `DOC-${Date.now()}-2`,
        name: `[EXTRACTED] Sealed Writ of Summons & Court Seal.pdf`,
        category: '01. Cause Papers/Extracted',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_CP_Extracted_1`,
      },
      {
        id: `DOC-${Date.now()}-3`,
        name: `[DRAFT] Notice of Demand to Opposing Party.docx`,
        category: '02. Correspondences/Drafts',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_Corr_Draft_1`,
      },
      {
        id: `DOC-${Date.now()}-4`,
        name: `Signed Retainer Agreement & Authority to Act (${leadClientName}).pdf`,
        category: '03. Client Documents',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_Client_Docs_1`,
      },
      {
        id: `DOC-${Date.now()}-5`,
        name: `Client Identity Record & NRIC Copy (KYC Sync).pdf`,
        category: '04. Client KYC & Identification',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_KYC_1`,
      },
      {
        id: `DOC-${Date.now()}-6`,
        name: `Initial Legal Strategy Opinion & Precedents Research.pdf`,
        category: '05. Research & Memos',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_Research_1`,
      },
      {
        id: `DOC-${Date.now()}-7`,
        name: `Client Intake & Case Strategy Consultation Minutes.pdf`,
        category: '06. Meeting Notes & Minutes',
        uploadedDate: new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/${generatedRef}_MeetingNotes_1`,
      },
    ];

    (clientKycDocs || []).forEach((k: any, idx: number) => {
      autoDriveDocs.push({
        id: `DOC-KYC-${Date.now()}-${idx}`,
        name: `[Client Database KYC] ${k.name || 'KYC Document'} (${k.type || 'Identity Verification'})`,
        category: '04. Client KYC & Identification',
        uploadedDate: k.uploadedDate || new Date().toISOString().slice(0, 10),
        driveUrl: `https://drive.google.com/file/d/KYC_${k.id || idx}`,
      });
    });

    const newCaseObj: Case = {
      id: newCaseId,
      ref: generatedRef,
      title: `${leadClientName} — ${ncPracticeArea} (${finalRole})`,
      clientId: leadClientId,
      clientName: leadClientName,
      clientsList: finalClientsList,
      createdDate: new Date().toISOString(),
      type: ncPracticeArea,
      practiceArea: ncPracticeArea,
      matterCode: selectedMatterCode.toUpperCase(),
      clientRole: finalRole,
      court: ncCourt,
      judge: ncJudge,
      courtCaseNo: ncCourtCaseNo || undefined,
      propertyTitleNo: ncPropertyTitleNo || undefined,
      propertyAddress: ncPropertyAddress || undefined,
      purchasePrice: ncPurchasePrice || undefined,
      financierBank: ncFinancierBank || undefined,
      corporateMatterType: ncCorporateMatterType || undefined,
      contractValue: ncContractValue || undefined,
      regulatoryAuthority: ncRegulatoryAuthority || undefined,
      governingLaw: ncGoverningLaw || undefined,
      opposingParty: leadOpposingName,
      opposingPartiesList: finalOpposingPartiesList,
      opposingCounsel: Array.from(new Set(builtRegistry.map((r) => r.firmName))),
      opposingSolicitorsFirm: builtRegistry[0]?.firmName || ncOpposingFirm.trim() || undefined,
      opposingSolicitorsName: undefined,
      opposingSolicitorsRef: builtRegistry[0]?.firmRef || ncOpposingRef.trim() || undefined,
      opposingSolicitorsRegistry: builtRegistry,
      opposingSolicitorsHistory: ncOpposingFirm.trim()
        ? [
            {
              id: `OSH-${Date.now()}`,
              firmName: ncOpposingFirm.trim(),
              solicitorName: '',
              firmRef: ncOpposingRef.trim(),
              effectiveDate: new Date().toISOString().slice(0, 10),
              remarks: 'Initial appointment upon file opening',
            },
          ]
        : [],
      partners: ncSelectedPartners,
      lawyers: [ncLawyerInCharge === 'SH' ? 'Syafiqah Hamizad' : ncLawyerInCharge === 'AH' ? 'Amer Haiqal' : 'Zulaikha Afendi'],
      lawyerInCharge: ncLawyerInCharge === 'SH' ? 'Syafiqah Hamizad' : ncLawyerInCharge === 'AH' ? 'Amer Haiqal' : 'Zulaikha Afendi',
      status: 'Active',
      nextHearing: '',
      lastAccessed: new Date().toISOString().slice(0, 10),
      caseNotes: '',
      hearings: [],
      documents: autoDriveDocs,
      courtDiary: [],
      tasks: [],
      serviceRecord: [],
      meetingNotes: [],
      internalNotes: [],
    };

    addCase(newCaseObj);
    showToast(`Matter ${generatedRef} created! Google Drive folder hierarchy generated automatically with Cause Papers (Drafts & Extracted), Correspondences (Drafts), Client Documents, KYC (Synced), Research, & Meeting Notes.`);
    setIsNewCaseModalOpen(false);
    setCurrentCaseId(newCaseId);
  };

  // Opposing Solicitors Management
  const openChangeOpposingModal = () => {
    if (!selectedCase) return;
    setChgFirmName(selectedCase.opposingSolicitorsFirm || (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0 ? selectedCase.opposingCounsel.join(', ') : ''));
    setChgSolicitorName(selectedCase.opposingSolicitorsName || '');
    setChgFirmRef(selectedCase.opposingSolicitorsRef || '');
    setChgPhone(selectedCase.opposingSolicitorsPhone || '');
    setChgEmail(selectedCase.opposingSolicitorsEmail || '');
    setChgEffectiveDate(new Date().toISOString().slice(0, 10));
    setChgRemarks('Filed Notice of Change of Solicitor (Notis Pertukaran Peguambela & Peguamcara)');
    setIsChangeOpposingModalOpen(true);
  };

  const handleSaveChangeOpposing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!chgFirmName.trim()) {
      showToast('Please enter the opposing law firm name.');
      return;
    }

    const newHistoryItem = {
      id: `OSH-${Date.now()}`,
      firmName: chgFirmName.trim(),
      solicitorName: chgSolicitorName.trim(),
      firmRef: chgFirmRef.trim(),
      contactNumber: chgPhone.trim(),
      email: chgEmail.trim(),
      effectiveDate: chgEffectiveDate,
      remarks: chgRemarks.trim(),
    };

    const updatedHistory = [newHistoryItem, ...(selectedCase.opposingSolicitorsHistory || [])];

    updateCase(selectedCase.id, {
      opposingSolicitorsFirm: chgFirmName.trim(),
      opposingSolicitorsName: chgSolicitorName.trim(),
      opposingSolicitorsRef: chgFirmRef.trim(),
      opposingSolicitorsPhone: chgPhone.trim(),
      opposingSolicitorsEmail: chgEmail.trim(),
      opposingCounsel: [chgFirmName.trim()],
      opposingSolicitorsHistory: updatedHistory,
    });

    // Auto-sync into central Law Firm Registry!
    syncOpposingFirmToRegistry(chgFirmName, chgSolicitorName, chgPhone, chgEmail);

    setIsChangeOpposingModalOpen(false);
    showToast(`Opposing solicitors updated to ${chgFirmName}. Notice of Change recorded.`);
  };

  const handleOpenAddRegOpposing = () => {
    setEditingRegId(null);
    setRegPartyRepresented('1st Defendant');
    setRegFirmName('');
    setRegSolicitors('');
    setRegFirmRef('');
    setRegPhone('');
    setRegEmail('');
    setIsRegOpposingModalOpen(true);
  };

  const handleEditRegOpposing = (reg: OpposingSolicitorRecord) => {
    setEditingRegId(reg.id);
    setRegPartyRepresented(reg.partyRepresented || '1st Defendant');
    setRegFirmName(reg.firmName || '');
    setRegSolicitors(reg.solicitors || '');
    setRegFirmRef(reg.firmRef || '');
    setRegPhone(reg.contactNumber || '');
    setRegEmail(reg.email || '');
    setIsRegOpposingModalOpen(true);
  };

  const handleSaveRegOpposing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!regFirmName.trim()) {
      showToast('Please enter law firm name.');
      return;
    }

    const currentRegistry = (selectedCase.opposingSolicitorsRegistry && selectedCase.opposingSolicitorsRegistry.length > 0)
      ? selectedCase.opposingSolicitorsRegistry
      : [
          {
            id: 'default-1',
            partyRepresented: 'Opposing Party',
            firmName: selectedCase.opposingSolicitorsFirm || (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0 ? selectedCase.opposingCounsel.join(', ') : 'Messrs. Opposing & Co'),
            solicitors: selectedCase.opposingSolicitorsName || 'Attending Advocates',
            firmRef: selectedCase.opposingSolicitorsRef,
            contactNumber: selectedCase.opposingSolicitorsPhone,
            email: selectedCase.opposingSolicitorsEmail,
            isPrimary: true,
          },
        ];

    let updatedRegistry: OpposingSolicitorRecord[];
    if (editingRegId) {
      updatedRegistry = currentRegistry.map((r) =>
        r.id === editingRegId
          ? {
              ...r,
              partyRepresented: regPartyRepresented.trim() || 'Opposing Party',
              firmName: regFirmName.trim(),
              solicitors: regSolicitors.trim(),
              firmRef: regFirmRef.trim(),
              contactNumber: regPhone.trim(),
              email: regEmail.trim(),
            }
          : r
      );
    } else {
      const newRecord: OpposingSolicitorRecord = {
        id: `OSR-${Date.now()}`,
        partyRepresented: regPartyRepresented.trim() || 'Opposing Party',
        firmName: regFirmName.trim(),
        solicitors: regSolicitors.trim(),
        firmRef: regFirmRef.trim(),
        contactNumber: regPhone.trim(),
        email: regEmail.trim(),
      };
      updatedRegistry = [...currentRegistry, newRecord];
    }

    updateCase(selectedCase.id, {
      opposingSolicitorsRegistry: updatedRegistry,
      opposingCounsel: Array.from(new Set(updatedRegistry.map((r) => r.firmName))),
      opposingSolicitorsFirm: updatedRegistry[0]?.firmName || regFirmName.trim(),
      opposingSolicitorsName: updatedRegistry[0]?.solicitors || regSolicitors.trim(),
      opposingSolicitorsRef: updatedRegistry[0]?.firmRef || regFirmRef.trim(),
      opposingSolicitorsPhone: updatedRegistry[0]?.contactNumber || regPhone.trim(),
      opposingSolicitorsEmail: updatedRegistry[0]?.email || regEmail.trim(),
    });

    // Auto-sync into central Law Firm Registry!
    syncOpposingFirmToRegistry(regFirmName, regSolicitors, regPhone, regEmail);

    setIsRegOpposingModalOpen(false);
    setEditingRegId(null);
    setRegPartyRepresented('1st Defendant');
    setRegFirmName('');
    setRegSolicitors('');
    setRegFirmRef('');
    setRegPhone('');
    setRegEmail('');
    showToast(editingRegId ? `Updated details for ${regFirmName}.` : `Registered ${regFirmName}.`);
  };

  // Client Parties (Our Firm) Handlers
  const handleOpenAddClientParty = () => {
    setEditingClientPartyId(null);
    setCpSelectedClientId('');
    setCpName('');
    setCpRole('2nd Plaintiff');
    setCpIc('');
    setCpPhone('');
    setCpEmail('');
    setIsClientPartyModalOpen(true);
  };

  const handleEditClientParty = (party: any) => {
    setEditingClientPartyId(party.id);
    setCpSelectedClientId(party.clientId || '');
    setCpName(party.name || '');
    setCpRole(party.role || 'Client');
    setCpIc(party.icOrRegNo || '');
    setCpPhone(party.phone || '');
    setCpEmail(party.email || '');
    setIsClientPartyModalOpen(true);
  };

  const handleSaveClientParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    let targetClientId: string | undefined = undefined;
    let targetName = cpName.trim();

    if (cpSelectedClientId && cpSelectedClientId !== 'NEW') {
      const foundClient = clients.find((c) => c.id === cpSelectedClientId);
      if (foundClient) {
        targetClientId = foundClient.id;
        targetName = foundClient.name;
      }
    } else if (targetName) {
      // Check if client exists in database or register new
      const existing = clients.find((c) => c.name.toLowerCase() === targetName.toLowerCase());
      if (existing) {
        targetClientId = existing.id;
      } else {
        // Auto-register in central clients database with conflict search screening!
        const newClientId = `HQ-C${Math.floor(100 + Math.random() * 900)}`;
        const autoConflicts = scanClientConflicts({ name: targetName, email: cpEmail }, clients, cases);
        const newClientObj = {
          id: newClientId,
          name: targetName,
          type: 'Individual' as const,
          contactPerson: targetName,
          phone: cpPhone.trim() || '012-0000000',
          email: cpEmail.trim() || 'client@shco.law',
          address: 'Registered Client Address',
          emergencyContact: '',
          notes: 'Registered via Case Roster Addition',
          kyc: [],
          conflictCheck: {
            status: autoConflicts.length > 0 ? 'Flagged' : 'Clear',
            notes: autoConflicts.length > 0
              ? `Potential conflict matches flagged during roster client registration (${autoConflicts.length} match(es)).`
              : 'Screened against firm database & active matters roster. No adverse conflict detected.',
            checkedBy: currentUser?.name || 'Firm Administrator',
            checkedDate: new Date().toISOString().split('T')[0],
          },
          autoConflictMatches: autoConflicts,
        };
        addClient(newClientObj);
        targetClientId = newClientId;
      }
    }

    if (!targetName) {
      showToast('Please specify client name');
      return;
    }

    const baseList: any[] = (selectedCase.clientsList && selectedCase.clientsList.length > 0)
      ? selectedCase.clientsList
      : [
          {
            id: 'cp-primary',
            clientId: selectedCase.clientId,
            name: selectedCase.clientName || 'Primary Client',
            role: selectedCase.clientRole || '1st Plaintiff',
          },
        ];

    let updatedList: any[];
    if (editingClientPartyId) {
      updatedList = baseList.map((p) =>
        p.id === editingClientPartyId
          ? {
              ...p,
              clientId: targetClientId || p.clientId,
              name: targetName,
              role: cpRole.trim() || 'Client',
              icOrRegNo: cpIc.trim(),
              phone: cpPhone.trim(),
              email: cpEmail.trim(),
            }
          : p
      );
    } else {
      const newParty = {
        id: `CP-${Date.now()}`,
        clientId: targetClientId,
        name: targetName,
        role: cpRole.trim() || 'Co-Client',
        icOrRegNo: cpIc.trim(),
        phone: cpPhone.trim(),
        email: cpEmail.trim(),
      };
      updatedList = [...baseList, newParty];
    }

    updateCase(selectedCase.id, {
      clientsList: updatedList,
      clientId: updatedList[0]?.clientId || selectedCase.clientId,
      clientName: updatedList[0]?.name || targetName,
      clientRole: updatedList[0]?.role || cpRole.trim(),
    });

    setIsClientPartyModalOpen(false);
    setEditingClientPartyId(null);
    showToast(editingClientPartyId ? `Updated client ${targetName}.` : `Registered & added client ${targetName} to matter.`);
  };

  const handleRemoveClientParty = (partyId: string) => {
    if (!selectedCase) return;
    const baseList = selectedCase.clientsList || [];
    const updatedList = baseList.filter((p) => p.id !== partyId);
    updateCase(selectedCase.id, { clientsList: updatedList });
    showToast('Removed client from matter roster.');
  };

  // Opposing Parties Handlers
  const handleOpenAddOppParty = () => {
    setEditingOppPartyId(null);
    setOpName('');
    setOpRole('2nd Defendant');
    setOpIc('');
    setIsOppPartyModalOpen(true);
  };

  const handleEditOppParty = (party: any) => {
    setEditingOppPartyId(party.id);
    setOpName(party.name || '');
    setOpRole(party.role || 'Opposing Party');
    setOpIc(party.icOrRegNo || '');
    setIsOppPartyModalOpen(true);
  };

  const handleSaveOppParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !opName.trim()) return;

    const baseList: any[] = (selectedCase.opposingPartiesList && selectedCase.opposingPartiesList.length > 0)
      ? selectedCase.opposingPartiesList
      : [
          {
            id: 'op-primary',
            name: selectedCase.opposingParty || 'Opposing Party',
            role: '1st Defendant',
          },
        ];

    let updatedList: any[];
    if (editingOppPartyId) {
      updatedList = baseList.map((p) =>
        p.id === editingOppPartyId
          ? {
              ...p,
              name: opName.trim(),
              role: opRole.trim() || 'Opposing Party',
              icOrRegNo: opIc.trim(),
            }
          : p
      );
    } else {
      const newParty = {
        id: `OP-${Date.now()}`,
        name: opName.trim(),
        role: opRole.trim() || 'Opposing Party',
        icOrRegNo: opIc.trim(),
      };
      updatedList = [...baseList, newParty];
    }

    const summaryText = updatedList.map((p) => `${p.name}`).join(' & ');

    updateCase(selectedCase.id, {
      opposingPartiesList: updatedList,
      opposingParty: summaryText,
      opposingParties: updatedList.map((p) => `${p.role}: ${p.name}`),
    });

    setIsOppPartyModalOpen(false);
    setEditingOppPartyId(null);
    showToast(editingOppPartyId ? `Updated opposing party ${opName}.` : `Added opposing party ${opName}.`);
  };

  const handleRemoveOppParty = (partyId: string) => {
    if (!selectedCase) return;
    const baseList = selectedCase.opposingPartiesList || [];
    const updatedList = baseList.filter((p) => p.id !== partyId);
    const summaryText = updatedList.map((p) => p.name).join(' & ');
    updateCase(selectedCase.id, {
      opposingPartiesList: updatedList,
      opposingParty: summaryText || selectedCase.opposingParty,
    });
    showToast('Removed opposing party.');
  };

  const handleRemoveRegOpposing = (id: string) => {
    if (!selectedCase) return;
    const currentRegistry = selectedCase.opposingSolicitorsRegistry || [];
    const updatedRegistry = currentRegistry.filter((r) => r.id !== id);
    updateCase(selectedCase.id, { opposingSolicitorsRegistry: updatedRegistry });
    showToast('Opposing solicitor removed from registry.');
  };

  const handleQuickInsertOpposing = (
    reg: OpposingSolicitorRecord,
    targetCounsel?: string,
    label?: string
  ) => {
    const chosenCounsel = targetCounsel || reg.solicitors || 'Attending Advocate';
    const formattedEntry = `${reg.firmName} (${chosenCounsel}) [${reg.partyRepresented}] present`;
    const formattedShort = `${reg.firmName} (${chosenCounsel})`;

    setDfDefendantRespondent((prev) => (prev ? `${prev}; ${formattedEntry}` : formattedEntry));
    setDfOppLawyer((prev) => (prev ? `${prev}; ${formattedShort}` : formattedShort));
    showToast(`Inserted ${reg.firmName} into diary attendance!`);
  };

  const SHCO_LAWYER_LIST = [
    'Syafiqah Hamizad (SH)',
    'Amer Haiqal (AH)',
    'Zulaikha Afendi (ZA)',
  ];

  const handleAddSHCOAttendance = () => {
    const lawyerToAdd = shcoSelectedLawyer === 'Custom' ? shcoCustomLawyer.trim() : shcoSelectedLawyer;
    if (!lawyerToAdd) return;
    const entry = `${lawyerToAdd} present`;
    setDfPlaintifApplicant((prev) => (prev ? `${prev}; ${entry}` : entry));
    setDfOurLawyer((prev) => (prev ? `${prev}; ${entry}` : entry));
    showToast(`Added ${lawyerToAdd} to SHCO lawyer attendance!`);
  };

  const openAddDiaryModal = () => {
    if (!selectedCase) return;
    setDfDate(new Date().toISOString().slice(0, 10));
    setDfMatter('Case Management');
    setDfCorum(selectedCase.judge || '');
    setDfMedium('OPEN COURT');
    setDfOurLawyer('AH represented Plaintiff');
    
    const oppFirm = selectedCase.opposingSolicitorsFirm || (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0 ? selectedCase.opposingCounsel.join(', ') : '');
    const oppCounsel = selectedCase.opposingSolicitorsName || '';
    const combinedOpp = oppFirm ? `${oppFirm}${oppCounsel ? ` (${oppCounsel})` : ''}` : '';
    
    setDfOppLawyer(combinedOpp ? `${combinedOpp} attended` : 'Opposing counsel attended');
    setDfPlaintifApplicant('');
    setDfDefendantRespondent(combinedOpp ? `${combinedOpp} attended` : '');
    setDfClientName('');
    setDfClientAtt('Present');
    setDfOpponentName(selectedCase.opposingParty || '');
    setDfOppAtt('Present');
    setDfStatus('Active');
    setDfNextDate('');
    setDfInstructions('');
    setDfDirections('');
    setDfTask('');
    setIsAddDiaryModalOpen(true);
  };

  // Subtab Handlers
  const handleSaveHearing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    const newH: Hearing = {
      id: `H${Math.floor(100 + Math.random() * 900)}`,
      purpose: hfPurpose,
      date: hfDate,
      time: hfTime,
      status: hfStatus,
      outcome: '',
    };

    const updatedHearings = [...(selectedCase.hearings || []), newH];
    updateCase(selectedCase.id, { hearings: updatedHearings, nextHearing: hfDate });
    setIsAddHearingModalOpen(false);
    showToast('Hearing saved and added to the in-app calendar and deadlines. Google Calendar connection is not configured.');
  };

  const handleSaveDiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    const newDiary: CourtDiaryEntry = {
      id: `CD${Math.floor(100 + Math.random() * 900)}`,
      date: dfDate,
      caseNo: selectedCase.courtCaseNo || selectedCase.ref,
      court: selectedCase.court,
      matter: dfMatter,
      corum: dfCorum,
      medium: dfMedium,
      clientRole: selectedCase.clientRole || 'Client',
      opposingFirm: selectedCase.opposingSolicitorsFirm || (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0 ? selectedCase.opposingCounsel.join(', ') : ''),
      opposingCounselName: selectedCase.opposingSolicitorsName || '',
      ourLawyerAttendance: dfOurLawyer,
      opponentCounselAttendance: dfOppLawyer,
      plaintifApplicant: dfPlaintifApplicant || dfOurLawyer,
      defendantRespondent: dfDefendantRespondent || dfOppLawyer,
      clientName: dfClientName || selectedCase.clientId,
      clientAttendance: dfClientAtt,
      opponentName: dfOpponentName || selectedCase.opposingParty,
      opponentAttendance: dfOppAtt,
      caseStatus: dfStatus,
      instructions: dfInstructions,
      courtDirections: dfDirections,
      nextDate: dfNextDate,
      tasks: dfTask,
      links: '',
    };

    const updatedDiary = [newDiary, ...(selectedCase.courtDiary || [])];
    const updates: Partial<Case> = { courtDiary: updatedDiary };

    if (dfNextDate) {
      updates.nextHearing = dfNextDate;
      const autoHearing: Hearing = {
        id: `H${Math.floor(100 + Math.random() * 900)}`,
        purpose: dfMatter,
        date: dfNextDate,
        time: '09:00',
        status: 'Scheduled',
        outcome: '',
      };
      updates.hearings = [...(selectedCase.hearings || []), autoHearing];

      // Auto add compliance deadline
      addDeadline({
        id: `DL${Math.floor(100 + Math.random() * 900)}`,
        caseId: selectedCase.id,
        title: `Comply per court directions — ${dfMatter}`,
        type: 'Compliance',
        dueDate: dfNextDate,
        priority: 'High',
        status: 'In Progress',
        reminderDays: 7,
        notes: 'Auto-created from Court Diary directions',
        partner: selectedCase.partners[0] || 'SH',
        lawyer: '',
      });
    }

    updateCase(selectedCase.id, updates);
    setIsAddDiaryModalOpen(false);
    showToast('Court Memo / Diary entry recorded & next compliance deadline updated');
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !tkTitle.trim()) return;

    // Full name lookup for assignees
    const nameMap: Record<string, string> = {
      SH: 'Syafiqah Hamizad',
      AH: 'Amer Haiqal',
      ZA: 'Zulaikha Afendi',
      NH: 'Nurul Huda',
      AIMAN: 'Aiman Hakim',
      INTAN: 'Intan Safiyah',
    };

    const selectedAssignees = tkAssignedTo.map((value) => users.find((user) => user.id === value || user.name === value)?.name || nameMap[value] || value);
    const finalAssignedTo = selectedAssignees.join(', ');
    const selectedReviewers = tkReviewer.map((value) => users.find((user) => user.id === value || user.name === value)?.name || value);

    const newTask: Task = {
      id: `T${Math.floor(100 + Math.random() * 900)}`,
      title: tkTitle.trim(),
      priority: tkPriority,
      status: 'Not Started',
      dueDate: tkDue,
      assignedTo: finalAssignedTo,
      taskType: tkType || 'Standard',
      stageTag: tkStageTag,
      categoryTag: tkCategoryTag || selectedCase.type,
      description: tkDescription,
      checklist: newChecklistItem.split('\n').map((item) => item.trim()).filter(Boolean).map((title, index) => ({ id: `CK-${Date.now()}-${index}`, title, completed: false })),
      attachments: [],
      reviewer: selectedReviewers.length > 0 ? selectedReviewers.join(', ') : undefined,
      reviewStatus: selectedReviewers.length > 0 ? 'Needs Review' : undefined,
      googleTasksSynced: true,
    };

    updateCase(selectedCase.id, { tasks: [...(selectedCase.tasks || []), newTask] });

    // Sync task deadline to the firm calendar/statutory deadlines register
    addDeadline({
      id: `DL-TASK-${newTask.id}`,
      caseId: selectedCase.id,
      title: `Task Due: ${newTask.title}`,
      type: 'Filing',
      dueDate: newTask.dueDate,
      priority: newTask.priority === 'High' ? 'High' : newTask.priority === 'Low' ? 'Low' : 'Normal',
      status: 'In Progress',
      reminderDays: 3,
      notes: newTask.description || 'Auto-synced from Matter Task due date',
      partner: selectedCase.partners[0] || 'SH',
      lawyer: finalAssignedTo || '',
    });

    setIsAddTaskModalOpen(false);
    setTkTitle('');
    setTkDescription('');
    setTkAssignedTo([]);
    setTkReviewer([]);
    setNewChecklistItem('');
    // Only send notifications if there are assignees or reviewers
    if (selectedAssignees.length > 0 || selectedReviewers.length > 0) {
      addNotification({
        title: 'Matter task assigned',
        message: `${finalAssignedTo} was assigned "${newTask.title}" for ${selectedCase.ref}.${selectedReviewers.length > 0 ? ` Reviewers: ${selectedReviewers.join(', ')}.` : ''}`,
        type: 'system',
        linkTab: 'cases',
        linkId: selectedCase.id,
      });
      const recipientEmails = users.filter((user) => selectedAssignees.includes(user.name) || selectedReviewers.includes(user.name)).map((user) => user.email).filter(Boolean);
      if (recipientEmails.length > 0) {
        window.location.href = `mailto:${recipientEmails.join(',')}?subject=${encodeURIComponent(`Matter task assigned: ${selectedCase.ref}`)}&body=${encodeURIComponent(`You have been assigned: ${newTask.title}\n\nInstructions:\n${newTask.description || 'No additional instructions.'}\n\nDue: ${newTask.dueDate}`)}`;
      }
    }
    showToast(`Task created & synced with Google Tasks${selectedAssignees.length > 0 ? ` for ${finalAssignedTo}` : ' (unassigned)'}`);
    e.preventDefault();
    if (!selectedCase || !draggedMatterTaskId) return;
    const updatedTasks = (selectedCase.tasks || []).map((task) =>
      task.id === draggedMatterTaskId
        ? { ...task, status, completedAt: status === 'Completed' ? new Date().toISOString() : undefined }
        : task
    );
    updateCase(selectedCase.id, { tasks: updatedTasks });
    setDraggedMatterTaskId(null);
    showToast(`Task moved to ${status}.`);
  };

  const handleMatterTaskStatusChange = (taskId: string, status: Task['status']) => {
    if (!selectedCase) return;
    const updatedTasks = (selectedCase.tasks || []).map((task) =>
      task.id === taskId
        ? { ...task, status, completedAt: status === 'Completed' ? new Date().toISOString() : undefined }
        : task
    );
    updateCase(selectedCase.id, { tasks: updatedTasks });
  };

  const handleSaveResearchNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resTitle.trim()) return;

    const newRes = {
      id: `RES-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      title: resTitle.trim(),
      issues: resIssues.trim(),
      partiesAndCourts: resPartiesAndCourts.trim(),
      findingsAndRatio: resFindingsAndRatio.trim(),
      applicationToCase: resApplicationToCase.trim(),
      fullCaseDownloadUrl: resLexisUrl.trim() || undefined,
      gdriveLibraryRef: `GDrive/Central Research Library/${selectedCase.type}/${resTitle.trim()}`,
      preparedBy: currentPartnerCode,
    };

    const updatedResearch = [newRes, ...(selectedCase.researchNotes || [])];
    updateCase(selectedCase.id, { researchNotes: updatedResearch });
    setIsAddResearchModalOpen(false);
    setResTitle('');
    setResIssues('');
    setResPartiesAndCourts('');
    setResFindingsAndRatio('');
    setResApplicationToCase('');
    setResLexisUrl('');
    showToast('Legal research note saved & archived to Central Research Library!');
  };

  const handleGenerateAiMeetingNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !rawMeetingTranscript.trim()) return;

    setIsGeneratingAiMeeting(true);

    setTimeout(() => {
      const gdocUrl = `https://docs.google.com/document/d/ai-gen-${Date.now()}`;
      const newM: MeetingNote = {
        id: `MN-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        ourLawyers: 'Syafiqah Hamizad & Amer Haiqal',
        clientAttendees: selectedCase.clientName || 'Client',
        meetingNotes: `[AI Summarized Transcript]\n${rawMeetingTranscript.slice(0, 300)}...\n\nDiscussion Points:\n1. Reviewed key evidence and pleadings for court filing.\n2. Addressed client questions regarding timeline and court directions.\n3. Confirmed legal strategy and affidavits preparation.`,
        decisions: 'Agreed to file Affidavit in Reply by next Friday. Client approved draft settlement terms.',
        recordedBy: currentPartnerCode,
        gdriveDocUrl: gdocUrl,
        isAiGenerated: true,
      };

      updateCase(selectedCase.id, { meetingNotes: [newM, ...(selectedCase.meetingNotes || [])] });
      setIsGeneratingAiMeeting(false);
      setIsAiMeetingModalOpen(false);
      setRawMeetingTranscript('');
      showToast('AI Meeting Notes generated & saved to Google Drive folder!');
    }, 800);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!svcDoc.trim()) {
      showToast('Please enter the document served before logging the service record.');
      return;
    }

    const newSvc: ServiceRecord = {
      id: `SR${Math.floor(100 + Math.random() * 900)}`,
      date: svcDate,
      documentServed: svcDoc,
      servedOn: svcServedOn,
      method: svcMethod,
      servedBy: svcServedBy,
      proofObtained: svcProof,
      notes: '',
    };

    updateCase(selectedCase.id, { serviceRecord: [...(selectedCase.serviceRecord || []), newSvc] });
    setIsAddServiceModalOpen(false);
    setSvcDate(new Date().toISOString().slice(0, 10));
    setSvcDoc('');
    setSvcServedOn('');
    setSvcMethod('Personal Service');
    setSvcServedBy('');
    setSvcProof('Y');
    showToast(`Service record logged: "${newSvc.documentServed}" served on ${newSvc.servedOn || 'the party'}.`);
  };

  const openServiceRecord = () => {
    setCaseSubTab('service');
    setIsAddServiceModalOpen(false);
    setIsAddMeetingModalOpen(false);
    setIsAiMeetingModalOpen(false);
    setIsAddResearchModalOpen(false);
    setIsAddInternalModalOpen(false);
    setIsAddCashbookModalOpen(false);
    setIsAddServiceModalOpen(true);
  };

  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    const newM: MeetingNote = {
      id: `MN${Math.floor(100 + Math.random() * 900)}`,
      date: mnDate,
      ourLawyers: mnOurLawyers,
      clientAttendees: mnClientAttendees,
      meetingNotes: mnNotes,
      decisions: mnDecisions,
      recordedBy: currentPartnerCode,
    };

    updateCase(selectedCase.id, { meetingNotes: [...(selectedCase.meetingNotes || []), newM] });
    setIsAddMeetingModalOpen(false);
    setMnOurLawyers('');
    setMnLawyerSearch('');
    setMnNotes('');
    setMnDecisions('');
  };

  const handleSaveInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !inContent.trim()) return;

    const newI: InternalNote = {
      id: `IN${Math.floor(100 + Math.random() * 900)}`,
      date: inDate,
      noteType: inType,
      content: inContent,
      recordedBy: currentRole,
    };

    updateCase(selectedCase.id, { internalNotes: [...(selectedCase.internalNotes || []), newI] });
    setIsAddInternalModalOpen(false);
    setInContent('');
  };

  const handleSaveCashbook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !cbDesc.trim() || !Number(cbAmount)) return;
    const amount = Number(cbAmount);
    const clientId = (selectedCase.clientId || '').split(',')[0].trim();
    if (cbType === 'Client') {
      addRetainer({
        id: `RET-${Date.now()}`,
        clientId,
        caseId: selectedCase.id,
        type: cbDirection === 'Credit' ? 'Deposit' : 'Apply',
        amount,
        date: cbDate,
        remarks: `${cbRef ? `${cbRef}: ` : ''}${cbDesc.trim()}`,
      });
    } else {
      addExpense({
        id: `EXP-${Date.now()}`,
        caseId: selectedCase.id,
        fileRef: selectedCase.ref,
        date: cbDate,
        category: 'Cashbook',
        amount,
        billable: false,
        description: `${cbRef ? `${cbRef}: ` : ''}${cbDesc.trim()}`,
        accountSet: 'OFFICE',
      });
    }
    setIsAddCashbookModalOpen(false);
    setCbDesc('');
    setCbAmount('');
    setCbRef('');
    showToast('Cashbook transaction saved to this matter.');
  };

  const handleSaveDocUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !docName.trim()) return;

    const practice = (selectedCase.gdriveCategory || selectedCase.practiceArea || selectedCase.type || '').toLowerCase();
    const driveUrl = selectedCase.gdriveFolderUrl || (practice.includes('litigation') || practice.includes('civil')
      ? 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link'
      : 'https://drive.google.com/drive/folders/0ANq_mzZTq_HeUk9PVA');

    const newDoc = {
      id: `D${Math.floor(100 + Math.random() * 900)}`,
      name: docName.trim(),
      category: docFolderCategory,
      uploadedDate: new Date().toISOString().slice(0, 10),
      driveUrl: driveUrl,
    };

    updateCase(selectedCase.id, { documents: [...(selectedCase.documents || []), newDoc] });
    setIsAddDocModalOpen(false);
    setDocName('');
    showToast(`Registered index for "${newDoc.name}"! Opening Google Drive for direct upload...`);
    window.open(driveUrl, '_blank');
  };

  // If a case is selected, render Matter Detail Workspace
  if (selectedCase) {
    const linkedClientIds = (selectedCase.clientId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const clientObj = clients.find((c) => linkedClientIds.includes(c.id))
      || clients.find((c) => selectedCase.clientsList?.some((party) => party.clientId === c.id || party.id === c.id));

    // Disbursements vs Budget calculation for this matter
    let quotedDisbursementBudget = 0;
    quotations.forEach((q) => {
      if (q.fileRef === selectedCase.ref && q.lineItems) {
        q.lineItems.forEach((li) => {
          if (li.category === 'Disbursement') quotedDisbursementBudget += li.amount;
        });
      }
    });

    const travelSpent = travelClaims
      .filter((t) => t.purposeType === 'Client Matter' && t.fileRef === selectedCase.ref)
      .reduce((s, t) => s + t.total, 0);

    const expenseSpent = expenses
      .filter((e) => e.caseId === selectedCase.id)
      .reduce((s, e) => s + e.amount, 0);

    const totalSpent = travelSpent + expenseSpent;
    const remainingBudget = quotedDisbursementBudget - totalSpent;
    const unbilledDisbursement = Math.max(0, totalSpent - quotedDisbursementBudget);

    // Trust balance for this matter
    const trustEntries = retainers.filter((r) => r.caseId === selectedCase.id);
    const trustBalance = trustEntries.reduce(
      (s, r) => s + (r.type === 'Deposit' ? r.amount : -r.amount),
      0
    );

    // Practice-area detection drives which sub tabs are relevant for this matter
    const practiceAreaLower = (selectedCase.gdriveCategory || selectedCase.practiceArea || selectedCase.type || '').toLowerCase();
    const isConveyancing = practiceAreaLower.includes('convey') || practiceAreaLower.includes('property') || practiceAreaLower.includes('spa') || practiceAreaLower.includes('land') || practiceAreaLower.includes('tenancy') || practiceAreaLower.includes('real estate') || practiceAreaLower.includes('loan') || practiceAreaLower.includes('subsale');
    const isCorporate = practiceAreaLower.includes('corporate') || practiceAreaLower.includes('advisory') || practiceAreaLower.includes('commercial') || practiceAreaLower.includes('secretarial') || practiceAreaLower.includes('governance') || practiceAreaLower.includes('compliance') || practiceAreaLower.includes('m&a') || practiceAreaLower.includes('agreement');
    const isLitigation = !isConveyancing && !isCorporate;
    // Conveyancing / corporate matters never go before a court, so hide court-only tabs
    const needsCourtTabs = isLitigation;

    const FOLDERS = [
      '01. Cause Papers/Drafts',
      '01. Cause Papers/Extracted',
      '02. Correspondences/Drafts',
      '02. Correspondences/Sent & Received',
      '03. Client Documents',
      '04. Client KYC & Identification',
      '05. Research & Memos',
      '06. Meeting Notes & Minutes',
    ];

    return (
      <div className="w-full space-y-4">
        {/* Back Button */}
        <button
          onClick={() => setCurrentCaseId(null)}
          className="text-xs font-semibold text-slate-700 hover:text-[#16223A] flex items-center gap-1.5 cursor-pointer bg-white border border-[#E1DCCF] px-3 py-1.5 rounded-md w-max"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Matters</span>
        </button>

        {/* Matter Header Banner */}
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="ref-seal text-xs px-2.5 py-0.5">{selectedCase.ref}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedCase.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedCase.status}
                </span>
                {selectedCase.clientRole && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-[#16223A] border border-[#A9814A]/40 uppercase tracking-wider flex items-center gap-1">
                    <Scale className="w-3 h-3 text-[#A9814A]" />
                    Representing: {selectedCase.clientRole}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-lg font-bold text-[#16223A]">{selectedCase.title}</h2>
              <div className="text-xs text-slate-500 font-medium">
                Client: <strong>{clientObj ? clientObj.name : '—'}</strong> ({selectedCase.clientRole || 'Client'}) | Practice: <strong>{selectedCase.type}</strong> | Court:{' '}
                <strong>{selectedCase.court}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-600 font-bold uppercase ml-2">Status:</label>
              <select
                value={selectedCase.status}
                onChange={(e) => updateCase(selectedCase.id, { status: e.target.value as any })}
                className="text-xs p-1.5 bg-white border border-[#E1DCCF] rounded-lg font-bold"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
                <option value="Archive">Archive</option>
              </select>
              <button
                type="button"
                onClick={handleOpenMatterDetailsEdit}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ml-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Matter Details</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (selectedCase) {
                    handleDeleteCase(selectedCase);
                  }
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ml-1"
                title="Delete case file if wrongly entered"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Matter</span>
              </button>
            </div>
          </div>

          {/* Workspace Subtabs */}
          <div className="flex flex-wrap gap-2 border-b border-[#E1DCCF] mt-5 -mb-4 text-xs font-semibold overflow-x-auto pb-1">
            {[
              { id: 'overview', label: 'Overview & Matter Details' },
              ...(needsCourtTabs ? [{ id: 'hearings', label: `Hearings (${(selectedCase.hearings || []).length})` }] : []),
              ...(needsCourtTabs ? [{ id: 'diary', label: `Court Diary (${(selectedCase.courtDiary || []).length})` }] : []),
              { id: 'tasks', label: `Matter Tasks & Case Status (${(selectedCase.tasks || []).length})` },
              { id: 'ledger', label: 'Client Trust & Cashbook Ledger' },
              { id: 'service', label: `Service Record (${(selectedCase.serviceRecord || []).length})` },
              { id: 'meetings', label: `Meeting Notes (${(selectedCase.meetingNotes || []).length})` },
              { id: 'research', label: `Legal Research (${(selectedCase.researchNotes || []).length})` },
              { id: 'internal', label: `Internal Notes (${(selectedCase.internalNotes || []).length})` },
              { id: 'activity', label: `Activity Feed (${(selectedCase.activityLogs || []).length})` },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCaseSubTab(tab.id);
                  setOpenDocFolder(null);
                }}
                className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  caseSubTab === tab.id
                    ? 'border-[#A9814A] text-[#16223A]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isMatterDetailsEditOpen && (
          <div className="fixed inset-0 z-50 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E1DCCF] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between border-b border-[#E1DCCF] pb-3 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#16223A]">Edit Matter Details</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Update the registration details for {selectedCase.ref}. Roster and task records stay attached.</p>
                </div>
                <button type="button" onClick={() => setIsMatterDetailsEditOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer">×</button>
              </div>
              <form onSubmit={handleSaveMatterDetails} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Title *</label>
                  <input required value={matterEditTitle} onChange={(e) => setMatterEditTitle(e.target.value)} className="w-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area *</label>
                    <select
                      value={matterEditPracticeArea}
                      onChange={(e) => setMatterEditPracticeArea(e.target.value)}
                      className="w-full font-bold bg-white border border-[#E1DCCF] rounded-lg p-2 text-xs"
                    >
                      <option value="Civil Litigation">Civil Litigation</option>
                      <option value="Conveyancing">Conveyancing</option>
                      <option value="Corporate/Commercial">Corporate/Commercial</option>
                      <option value="Criminal">Criminal</option>
                      <option value="Probate/Estate">Probate/Estate</option>
                      <option value="Syariah">Syariah</option>
                      <option value="Dispute Resolution">Dispute Resolution</option>
                      <option value="Technology/AI/Fintech">Technology/AI/Fintech</option>
                      {getPracticeSettings().practiceAreas?.map((pa) => (
                        <option key={pa.id} value={pa.name}>{pa.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Client Role</label>
                    <input value={matterEditClientRole} onChange={(e) => setMatterEditClientRole(e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Client / Represented Party</label>
                    <input value={matterEditClientName} onChange={(e) => setMatterEditClientName(e.target.value)} className="w-full" />
                  </div>
                </div>

                {/* Conditional Fields Based on Practice Area */}
                {(() => {
                  const pAreaLower = (matterEditPracticeArea || '').toLowerCase();
                  const isEditConveyancing = pAreaLower.includes('convey') || pAreaLower.includes('property') || pAreaLower.includes('spa') || pAreaLower.includes('land') || pAreaLower.includes('tenancy') || pAreaLower.includes('real estate') || pAreaLower.includes('subsale') || pAreaLower.includes('loan');
                  const isEditCorporate = pAreaLower.includes('corporate') || pAreaLower.includes('advisory') || pAreaLower.includes('commercial') || pAreaLower.includes('secretarial') || pAreaLower.includes('governance') || pAreaLower.includes('m&a') || pAreaLower.includes('agreement');
                  const isEditLitigation = !isEditConveyancing && !isEditCorporate;

                  if (isEditLitigation) {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                        <div>
                          <label className="font-bold text-amber-900 block uppercase mb-1">Court / Forum</label>
                          <input value={matterEditCourt} onChange={(e) => setMatterEditCourt(e.target.value)} placeholder="e.g. High Court of Malaya" className="w-full bg-white" />
                        </div>
                        <div>
                          <label className="font-bold text-amber-900 block uppercase mb-1">Presiding Judge / Magistrate</label>
                          <input value={matterEditJudge} onChange={(e) => setMatterEditJudge(e.target.value)} placeholder="e.g. Y.A. Dato' Justice S. Ramanathan" className="w-full bg-white" />
                        </div>
                        <div>
                          <label className="font-bold text-amber-900 block uppercase mb-1">Suit / Court Case No.</label>
                          <input value={matterEditCourtCaseNo} onChange={(e) => setMatterEditCourtCaseNo(e.target.value)} placeholder="e.g. TA-A51NCvC-16-10/2025" className="w-full font-mono bg-white" />
                        </div>
                      </div>
                    );
                  }

                  if (isEditConveyancing) {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                        <div>
                          <label className="font-bold text-emerald-900 block uppercase mb-1">Property Title / Lot No.</label>
                          <input value={matterEditPropertyTitleNo} onChange={(e) => setMatterEditPropertyTitleNo(e.target.value)} placeholder="e.g. H.S.(D) 10492 / Lot 8812" className="w-full bg-white font-mono" />
                        </div>
                        <div>
                          <label className="font-bold text-emerald-900 block uppercase mb-1">Property Address</label>
                          <input value={matterEditPropertyAddress} onChange={(e) => setMatterEditPropertyAddress(e.target.value)} placeholder="e.g. No. 18, Jalan Astaka 3, BRP" className="w-full bg-white" />
                        </div>
                        <div>
                          <label className="font-bold text-emerald-900 block uppercase mb-1">Purchase Price / Consideration</label>
                          <input value={matterEditPurchasePrice} onChange={(e) => setMatterEditPurchasePrice(e.target.value)} placeholder="e.g. RM 650,000.00" className="w-full bg-white font-mono" />
                        </div>
                        <div>
                          <label className="font-bold text-emerald-900 block uppercase mb-1">Financier / Loan Bank</label>
                          <input value={matterEditFinancierBank} onChange={(e) => setMatterEditFinancierBank(e.target.value)} placeholder="e.g. Maybank Islamic Berhad" className="w-full bg-white" />
                        </div>
                      </div>
                    );
                  }

                  if (isEditCorporate) {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-purple-200 bg-purple-50/40 p-3">
                        <div>
                          <label className="font-bold text-purple-900 block uppercase mb-1">Corporate Matter Type</label>
                          <input value={matterEditCorporateMatterType} onChange={(e) => setMatterEditCorporateMatterType(e.target.value)} placeholder="e.g. Share Sale Agreement & Advisory" className="w-full bg-white" />
                        </div>
                        <div>
                          <label className="font-bold text-purple-900 block uppercase mb-1">Contract / Transaction Value</label>
                          <input value={matterEditContractValue} onChange={(e) => setMatterEditContractValue(e.target.value)} placeholder="e.g. RM 2,500,000.00" className="w-full bg-white font-mono" />
                        </div>
                        <div>
                          <label className="font-bold text-purple-900 block uppercase mb-1">Regulatory Authority</label>
                          <input value={matterEditRegulatoryAuthority} onChange={(e) => setMatterEditRegulatoryAuthority(e.target.value)} placeholder="e.g. Suruhanjaya Syarikat Malaysia (SSM)" className="w-full bg-white" />
                        </div>
                        <div>
                          <label className="font-bold text-purple-900 block uppercase mb-1">Governing Law</label>
                          <input value={matterEditGoverningLaw} onChange={(e) => setMatterEditGoverningLaw(e.target.value)} placeholder="e.g. Laws of Malaysia" className="w-full bg-white" />
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Searchable Multi-Select Dropdown for Additional File Handlers */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                  <label className="font-bold text-blue-900 block uppercase text-xs">Additional File Handlers</label>
                  <p className="text-[10.5px] text-slate-500">
                    Select staff members and lawyers assigned to handle this matter. Assigned handlers from registration intake are prefilled.
                  </p>

                  {/* Selected Handler Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {matterEditHandlers.map((handlerName) => (
                      <span
                        key={handlerName}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#16223A] text-amber-300 rounded-lg text-xs font-bold shadow-2xs border border-[#16223A]"
                      >
                        <span>{handlerName}</span>
                        <button
                          type="button"
                          onClick={() => setMatterEditHandlers((prev) => prev.filter((name) => name !== handlerName))}
                          className="ml-1 text-amber-300/80 hover:text-white cursor-pointer font-bold text-sm"
                          title="Remove handler"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {matterEditHandlers.length === 0 && (
                      <span className="text-[11px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-200">
                        No additional file handlers assigned
                      </span>
                    )}
                  </div>

                  {/* Search Input & Dropdown */}
                  <div className="relative">
                    <div
                      onClick={() => setIsHandlerDropdownOpen((prev) => !prev)}
                      className="flex items-center bg-white border border-[#E1DCCF] rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#16223A] cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={handlerSearchQuery}
                        onChange={(e) => {
                          setHandlerSearchQuery(e.target.value);
                          setIsHandlerDropdownOpen(true);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsHandlerDropdownOpen(true);
                        }}
                        onFocus={() => setIsHandlerDropdownOpen(true)}
                        placeholder="Search staff or lawyers to assign (e.g. Syafiqah, Amer, Zulaikha)..."
                        className="w-full text-xs outline-hidden text-[#16223A] placeholder:text-slate-400 font-medium cursor-pointer"
                      />
                      {handlerSearchQuery ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHandlerSearchQuery('');
                          }}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                        >
                          ×
                        </button>
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer" />
                      )}
                    </div>

                    {/* Dropdown Options List */}
                    {isHandlerDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1DCCF] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {(() => {
                          const availableStaff = users
                            .filter((u) => u.status === 'Active' && u.role !== 'Client')
                            .filter((u) =>
                              u.name.toLowerCase().includes(handlerSearchQuery.toLowerCase()) ||
                              u.role.toLowerCase().includes(handlerSearchQuery.toLowerCase())
                            );

                          if (availableStaff.length === 0) {
                            return (
                              <div className="p-3 text-center text-xs text-slate-500">
                                No staff matching "{handlerSearchQuery}"
                              </div>
                            );
                          }

                          return availableStaff.map((user) => {
                            const isSelected = matterEditHandlers.includes(user.name);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => {
                                  setMatterEditHandlers((prev) =>
                                    isSelected
                                      ? prev.filter((name) => name !== user.name)
                                      : [...prev, user.name]
                                  );
                                  setHandlerSearchQuery('');
                                }}
                                className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-50/70 text-[#16223A]'
                                    : 'hover:bg-[#FAF8F2] text-[#16223A]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{user.name}</span>
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    ({user.role})
                                  </span>
                                </div>
                                {isSelected ? (
                                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                    ✓ Assigned
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-800 font-bold hover:underline">
                                    + Assign
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Stage</label>
                  <input value={matterEditStage} onChange={(e) => setMatterEditStage(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Case Notes</label>
                  <textarea rows={4} value={matterEditNotes} onChange={(e) => setMatterEditNotes(e.target.value)} className="w-full resize-y" />
                </div>
                <div className="flex justify-end gap-2 border-t border-[#E1DCCF] pt-4">
                  <button type="button" onClick={() => setIsMatterDetailsEditOpen(false)} className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-lg font-semibold cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-lg font-bold cursor-pointer">Save Matter Details</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 1: Overview & Physical Legal File Cover Preview */}
        {caseSubTab === 'overview' && (() => {
          return (
            <div className="space-y-6 text-xs">
              {/* Visual Realistic Physical File Jacket / Folder Cover */}
              <div className="bg-[#FAF8F5] border-2 border-[#A9814A]/40 rounded-2xl p-6 shadow-md relative overflow-hidden">
                {/* Top Practice Color Bar */}
                <div className={`absolute top-0 left-0 right-0 h-3 bg-gradient-to-r ${
                  isConveyancing ? 'from-[#2F6F4E] via-[#A9814A] to-[#2F6F4E]' :
                  isCorporate ? 'from-[#3B1E54] via-[#A9814A] to-[#3B1E54]' :
                  'from-[#16223A] via-[#A9814A] to-[#16223A]'
                }`} />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E1DCCF] pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#16223A] text-amber-300 rounded-xl flex items-center justify-center font-serif font-extrabold text-lg border border-[#A9814A] shadow-xs">
                      SH
                    </div>
                    <div>
                      <h3 className="font-serif font-black text-base text-[#16223A] tracking-wide">
                        MESSRS SYAFIQAH HAMIZAD &amp; CO
                      </h3>
                      <p className="text-[10.5px] font-bold text-[#A9814A] tracking-wider uppercase">
                        Advocates &amp; Solicitors
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono bg-white border border-[#E1DCCF] px-3 py-1.5 rounded-lg shadow-2xs">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">File Ref Seal</span>
                      <span className="font-extrabold text-sm text-[#16223A]">{selectedCase.ref}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFileCoverModalOpen(true)}
                      className="bg-[#16223A] hover:bg-[#1F2E4D] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all shrink-0"
                    >
                      <Printer className="w-4 h-4 text-[#A9814A]" />
                      <span>Print File Cover</span>
                    </button>
                  </div>
                </div>

                {/* Physical Jacket Grid Content */}
                <div className="grid grid-cols-1 gap-5">
                  {/* File Title & Particulars */}
                  <div className="w-full bg-white border border-[#E1DCCF] p-5 rounded-xl space-y-4 shadow-2xs">
                    <div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                        isConveyancing ? 'text-emerald-800 bg-emerald-50 border-emerald-200' :
                        isCorporate ? 'text-purple-800 bg-purple-50 border-purple-200' :
                        'text-amber-800 bg-amber-50 border-amber-200'
                      }`}>
                        {isConveyancing ? 'Physical File Cover Jacket Details (Conveyancing & Property)' :
                         isCorporate ? 'Physical File Cover Jacket Details (Corporate & Advisory)' :
                         'Physical File Cover Jacket Details (Litigation)'}
                      </span>
                      <h2 className="font-serif text-lg font-bold text-[#16223A] mt-1.5">
                        {selectedCase.title}
                      </h2>
                    </div>

                    {/* PRACTICE-SPECIFIC FIELDS */}
                    {isLitigation && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Court Case No.</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {selectedCase.courtCaseNo || 'TA-A51NCvC-16-10/2025'}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Court / Forum</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedCase.court || 'High Court of Malaya'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Presiding Judge / Magistrate</span>
                          <span className="font-medium text-slate-800 text-xs">{selectedCase.judge || "Y.A. Dato' Justice S. Ramanathan"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Practice Area Category</span>
                          <span className="font-bold text-blue-900 text-xs">{selectedCase.practiceArea || selectedCase.type || 'Litigation'}</span>
                        </div>
                      </div>
                    )}

                    {isConveyancing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Property Title / Lot No.</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {selectedCase.propertyTitleNo || 'H.S.(D) 10492 / Lot 8812'}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Property Address</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedCase.propertyAddress || 'No. 18, Jalan Astaka 3, Bukit Rahman Putra'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Purchase Price / Consideration</span>
                          <span className="font-semibold text-emerald-800 text-xs font-mono">{selectedCase.purchasePrice || 'RM 650,000.00'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Financier / Loan Bank</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedCase.financierBank || 'Maybank Islamic Berhad'}</span>
                        </div>
                      </div>
                    )}

                    {isCorporate && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Corporate Advisory Nature</span>
                          <span className="font-bold text-purple-900 text-xs">
                            {selectedCase.corporateMatterType || selectedCase.type || 'Corporate Advisory & Share Sale Agreement'}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Contract / Transaction Value</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">{selectedCase.contractValue || 'RM 2,500,000.00'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Key Regulatory Authority</span>
                          <span className="font-medium text-slate-800 text-xs">{selectedCase.regulatoryAuthority || 'Suruhanjaya Syarikat Malaysia (SSM)'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 uppercase text-[10px] block">Governing Law &amp; Jurisdiction</span>
                          <span className="font-bold text-slate-900 text-xs">{selectedCase.governingLaw || 'Laws of Malaysia / High Court of Malaya'}</span>
                        </div>
                      </div>
                    )}

                    {/* Parties Summary Box */}
                    <div className="bg-[#FAF8F2] p-3.5 rounded-lg border border-[#E1DCCF] space-y-2">
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="font-bold text-blue-900 uppercase">
                          {isConveyancing ? 'Purchaser / Borrower (Client):' : isCorporate ? 'Retaining Client:' : 'Represented Client(s):'}
                        </span>
                        <span className="font-bold text-slate-800">{selectedCase.clientName} ({selectedCase.clientRole || (isConveyancing ? 'Purchaser' : isCorporate ? 'Client' : 'Plaintiff')})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="font-bold text-rose-900 uppercase">
                          {isConveyancing ? 'Vendor / Developer / Counterparty:' : isCorporate ? 'Counterparty / Target Entity:' : 'Opposing Party:'}
                        </span>
                        <span className="font-bold text-slate-800">{selectedCase.opposingParty || (isConveyancing ? 'Vendor / Developer' : isCorporate ? 'Target Entity' : 'Opposing Defendant')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Read-Only Overview & Editable Particulars Form */}
              <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-[#E1DCCF] pb-3">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#16223A]">
                      {isConveyancing ? 'Conveyancing & Property Particulars' :
                       isCorporate ? 'Corporate & Advisory Particulars' :
                       'Matter Particulars & Registration Info'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isConveyancing ? 'Key conveyancing details, property title, SPA consideration & bank financier.' :
                       isCorporate ? 'Key corporate advisory, contract valuation, regulatory authority & terms.' :
                       'Read-only overview mode. Click edit to modify specific fields.'}
                    </p>
                  </div>
                </div>

                {/* EDITABLE FORM FIELDS FOR LITIGATION */}
                {isLitigation && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#FAF8F2] p-4 rounded-xl border border-[#E1DCCF]">
                    <div>
                      <label className="font-bold text-slate-500 block uppercase text-[10px]">Court Case No.</label>
                      <input
                        type="text"
                        value={selectedCase.courtCaseNo || ''}
                        onChange={(e) => updateCase(selectedCase.id, { courtCaseNo: e.target.value })}
                        placeholder="e.g. TA-A51NCvC-16-10/2025"
                        className="w-full font-mono font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block uppercase text-[10px]">Court Forum</label>
                      <input
                        type="text"
                        value={selectedCase.court || ''}
                        onChange={(e) => updateCase(selectedCase.id, { court: e.target.value })}
                        placeholder="e.g. High Court of Malaya"
                        className="w-full font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block uppercase text-[10px]">Presiding Judge / Magistrate</label>
                      <input
                        type="text"
                        value={selectedCase.judge || ''}
                        onChange={(e) => updateCase(selectedCase.id, { judge: e.target.value })}
                        placeholder="e.g. Y.A. Dato' Justice S. Ramanathan"
                        className="w-full text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-500 block uppercase text-[10px]">PIC (Partner-in-Charge)</label>
                      <select
                        value={selectedCase.lawyerInCharge || ''}
                        onChange={(e) => updateCase(selectedCase.id, { lawyerInCharge: e.target.value })}
                        className="w-full font-bold text-xs bg-white mt-1"
                      >
                        <option value="">Unassigned</option>
                        {users.filter(u => u.status === 'Active' && u.role !== 'Client').map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* EDITABLE FORM FIELDS FOR CONVEYANCING */}
                {isConveyancing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Property Title / Lot No.</label>
                      <input
                        type="text"
                        value={selectedCase.propertyTitleNo || ''}
                        onChange={(e) => updateCase(selectedCase.id, { propertyTitleNo: e.target.value })}
                        placeholder="e.g. H.S.(D) 10492 / Lot 8812"
                        className="w-full font-mono font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Property Address</label>
                      <input
                        type="text"
                        value={selectedCase.propertyAddress || ''}
                        onChange={(e) => updateCase(selectedCase.id, { propertyAddress: e.target.value })}
                        placeholder="e.g. No. 18, Jalan Astaka 3, BRP"
                        className="w-full font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Purchase Price / SPA Consideration</label>
                      <input
                        type="text"
                        value={selectedCase.purchasePrice || ''}
                        onChange={(e) => updateCase(selectedCase.id, { purchasePrice: e.target.value })}
                        placeholder="e.g. RM 650,000.00"
                        className="w-full text-xs font-mono font-bold bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Financier / Loan Bank</label>
                      <input
                        type="text"
                        value={selectedCase.financierBank || ''}
                        onChange={(e) => updateCase(selectedCase.id, { financierBank: e.target.value })}
                        placeholder="e.g. Maybank Islamic Berhad"
                        className="w-full font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Developer / Vendor Name</label>
                      <input
                        type="text"
                        value={selectedCase.developerName || ''}
                        onChange={(e) => updateCase(selectedCase.id, { developerName: e.target.value })}
                        placeholder="e.g. Syarikat Perumahan Sdn Bhd"
                        className="w-full text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">Target Completion / SPA Date</label>
                      <input
                        type="date"
                        value={selectedCase.completionDate || ''}
                        onChange={(e) => updateCase(selectedCase.id, { completionDate: e.target.value })}
                        className="w-full font-mono text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">MOT / Redemption Status</label>
                      <input
                        type="text"
                        value={selectedCase.motStatus || ''}
                        onChange={(e) => updateCase(selectedCase.id, { motStatus: e.target.value })}
                        placeholder="e.g. Pending Redemption Statement"
                        className="w-full text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-emerald-900 block uppercase text-[10px]">PIC (Partner-in-Charge)</label>
                      <select
                        value={selectedCase.lawyerInCharge || ''}
                        onChange={(e) => updateCase(selectedCase.id, { lawyerInCharge: e.target.value })}
                        className="w-full font-bold text-xs bg-white mt-1"
                      >
                        <option value="">Unassigned</option>
                        {users.filter(u => u.status === 'Active' && u.role !== 'Client').map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* EDITABLE FORM FIELDS FOR CORPORATE */}
                {isCorporate && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-purple-50/40 p-4 rounded-xl border border-purple-200">
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Advisory / Transaction Type</label>
                      <input
                        type="text"
                        value={selectedCase.corporateMatterType || ''}
                        onChange={(e) => updateCase(selectedCase.id, { corporateMatterType: e.target.value })}
                        placeholder="e.g. Share Sale Agreement & Advisory"
                        className="w-full font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Contract / Deal Value</label>
                      <input
                        type="text"
                        value={selectedCase.contractValue || ''}
                        onChange={(e) => updateCase(selectedCase.id, { contractValue: e.target.value })}
                        placeholder="e.g. RM 2,500,000.00"
                        className="w-full font-mono font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Regulatory Authority</label>
                      <input
                        type="text"
                        value={selectedCase.regulatoryAuthority || ''}
                        onChange={(e) => updateCase(selectedCase.id, { regulatoryAuthority: e.target.value })}
                        placeholder="e.g. Suruhanjaya Syarikat Malaysia (SSM)"
                        className="w-full text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Governing Law &amp; Forum</label>
                      <input
                        type="text"
                        value={selectedCase.governingLaw || ''}
                        onChange={(e) => updateCase(selectedCase.id, { governingLaw: e.target.value })}
                        placeholder="e.g. Laws of Malaysia"
                        className="w-full font-bold text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Target Closing / Execution Date</label>
                      <input
                        type="date"
                        value={selectedCase.targetClosingDate || ''}
                        onChange={(e) => updateCase(selectedCase.id, { targetClosingDate: e.target.value })}
                        className="w-full font-mono text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">Retainer Status</label>
                      <input
                        type="text"
                        value={selectedCase.retainerStatus || ''}
                        onChange={(e) => updateCase(selectedCase.id, { retainerStatus: e.target.value })}
                        placeholder="e.g. Retainer Signed & Effective"
                        className="w-full text-xs bg-white mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-purple-900 block uppercase text-[10px]">PIC (Partner-in-Charge)</label>
                      <select
                        value={selectedCase.lawyerInCharge || ''}
                        onChange={(e) => updateCase(selectedCase.id, { lawyerInCharge: e.target.value })}
                        className="w-full font-bold text-xs bg-white mt-1"
                      >
                        <option value="">Unassigned</option>
                        {users.filter(u => u.status === 'Active' && u.role !== 'Client').map(u => (
                          <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Represented Clients Roster */}
                <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-blue-200 pb-2">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        {isConveyancing ? 'Purchaser(s) / Borrower(s) Represented by SHCO' :
                         isCorporate ? 'Retaining Client(s) Represented by SHCO' :
                         'Clients Represented by SHCO (Multi-Party Roster)'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddClientParty}
                      className="bg-[#16223A] hover:bg-[#1F2E4D] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Represented Client</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {((selectedCase.clientsList && selectedCase.clientsList.length > 0)
                      ? selectedCase.clientsList
                      : [
                          {
                            id: 'cp-primary',
                            name: selectedCase.clientName || 'Primary Client',
                            role: selectedCase.clientRole || (isConveyancing ? 'Purchaser' : isCorporate ? 'Client' : '1st Plaintiff'),
                          },
                        ]
                    ).map((cParty, idx) => (
                      <div key={cParty.id || idx} className="bg-white p-3 rounded-lg border border-blue-200 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#16223A] text-xs">{cParty.name}</span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              {cParty.role}
                            </span>
                          </div>
                          {(cParty.phone || cParty.email || cParty.icOrRegNo) && (
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              {cParty.icOrRegNo && `IC/Reg: ${cParty.icOrRegNo} `}
                              {cParty.phone && `• Tel: ${cParty.phone} `}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClientParty(cParty)}
                            className="p-1 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded cursor-pointer text-[11px] font-medium"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opposing Parties / Counterparties Roster */}
                <div className="bg-rose-50/30 border border-rose-200 p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-rose-200 pb-2">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-rose-600" />
                        {isConveyancing ? 'Vendor / Developer / Counterparties Roster' :
                         isCorporate ? 'Counterparty & Target Entities Roster' :
                         'Opposing Parties (Multi-Opponent Roster)'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddOppParty}
                      className="bg-[#16223A] hover:bg-[#1F2E4D] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isConveyancing ? 'Add Counterparty / Vendor' : isCorporate ? 'Add Counterparty / Entity' : 'Add Opposing Party'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {((selectedCase.opposingPartiesList && selectedCase.opposingPartiesList.length > 0)
                      ? selectedCase.opposingPartiesList
                      : [
                          {
                            id: 'op-primary',
                            name: selectedCase.opposingParty || (isConveyancing ? 'Vendor / Developer' : isCorporate ? 'Counterparty' : 'Opposing Party'),
                            role: isConveyancing ? 'Vendor / Developer' : isCorporate ? 'Target Entity' : '1st Defendant',
                          },
                        ]
                    ).map((opParty, idx) => (
                      <div key={opParty.id || idx} className="bg-white p-3 rounded-lg border border-rose-200 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#16223A] text-xs">{opParty.name}</span>
                            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              {opParty.role}
                            </span>
                          </div>
                          {opParty.icOrRegNo && (
                            <div className="text-[10.5px] text-slate-500 mt-0.5">
                              IC / Reg No: {opParty.icOrRegNo}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditOppParty(opParty)}
                            className="p-1 text-slate-600 hover:text-rose-700 hover:bg-slate-100 rounded cursor-pointer text-[11px] font-medium"
                          >
                            Edit
                          </button>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOppParty(opParty.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer text-[11px]"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External Solicitors / Legal Advisory Registry */}
                <div className="bg-[#16223A]/5 border border-[#E1DCCF] p-4 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E1DCCF] pb-2">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-[#A9814A]" />
                        {isConveyancing ? "External / Counterparty Solicitors Registry (Vendor's / Purchaser's / Bank's Counsel)" :
                         isCorporate ? 'Counterparty Counsel & Advisory Firms Registry' :
                         'Opposing Solicitors Registry (Multi-Lawfirm & Multi-Counsel)'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRegOpposingModalOpen(true)}
                        className="bg-[#16223A] hover:bg-[#1F2E4D] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register New Firm / Counsel</span>
                      </button>
                      <button
                        type="button"
                        onClick={openChangeOpposingModal}
                        className="bg-[#A9814A] hover:bg-[#8E6B3B] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Notice of Change</span>
                      </button>
                    </div>
                  </div>

                  {/* Registered Opposing Firms Grid / List */}
                  <div className="space-y-2">
                    {((selectedCase.opposingSolicitorsRegistry && selectedCase.opposingSolicitorsRegistry.length > 0)
                      ? selectedCase.opposingSolicitorsRegistry
                      : [
                          {
                            id: 'default-1',
                            partyRepresented: isConveyancing ? "Vendor's Solicitors" : isCorporate ? 'Counterparty Counsel' : 'Opposing Party',
                            firmName:
                              selectedCase.opposingSolicitorsFirm ||
                              (selectedCase.opposingCounsel && selectedCase.opposingCounsel.length > 0
                                ? selectedCase.opposingCounsel.join(', ')
                                : 'Messrs. Opposing & Co'),
                            solicitors: selectedCase.opposingSolicitorsName || 'Attending Advocates',
                            firmRef: selectedCase.opposingSolicitorsRef,
                            contactNumber: selectedCase.opposingSolicitorsPhone,
                            email: selectedCase.opposingSolicitorsEmail,
                            isPrimary: true,
                          },
                        ]
                    ).map((reg) => (
                      <div
                        key={reg.id}
                        className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                      >
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {reg.firmName}
                            </span>
                            <span className="text-[10.5px] font-bold text-[#A9814A] bg-amber-50 border border-[#A9814A]/40 px-2 py-0.5 rounded">
                              {reg.partyRepresented}
                            </span>
                            {reg.isPrimary && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Primary Counsel on Record
                              </span>
                            )}
                          </div>
                          
                          {/* Advocates roster */}
                          {reg.solicitors && (
                            <div className="text-xs text-slate-800 font-semibold flex items-start gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                              <span>Counsel / Lawyer: <strong className="text-slate-900">{reg.solicitors}</strong></span>
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium flex-wrap pt-0.5">
                            {reg.firmRef && <span>File Ref: <strong className="font-mono text-slate-800">{reg.firmRef}</strong></span>}
                            {reg.contactNumber && <span>Tel: {reg.contactNumber}</span>}
                            {reg.email && <span>Email: <span className="text-blue-600">{reg.email}</span></span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditRegOpposing(reg)}
                            className="px-3 py-1.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Edit Details</span>
                          </button>
                          {reg.id !== 'default-1' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRegOpposing(reg.id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold cursor-pointer border border-rose-200 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-600 block uppercase mb-1">Matter Case Notes</label>
                  <textarea
                    rows={3}
                    value={selectedCase.caseNotes || ''}
                    onChange={(e) => updateCase(selectedCase.id, { caseNotes: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          );
        })()}



        {/* Tab 2: Hearings */}
        {caseSubTab === 'activity' && (() => {
          const explicitLogs: CaseActivityLog[] = selectedCase.activityLogs || [];
          const combinedLogs: CaseActivityLog[] = [...explicitLogs];

          (selectedCase.tasks || []).forEach((t) => {
            combinedLogs.push({
              id: `CAL-TASK-${t.id}`,
              timestamp: t.completedAt || t.dueDate || selectedCase.createdDate || '2026-08-15 10:00',
              type: t.status === 'Completed' ? 'Milestone Completion' : 'Status Update',
              title: `Task: ${t.title}`,
              description: `Assigned to ${t.assignedTo}. Status: ${t.status}. Priority: ${t.priority}.`,
              actor: t.assignedTo || 'Assigned Lawyer',
              badgeColor: t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800',
            });
          });

          (selectedCase.hearings || []).forEach((h) => {
            combinedLogs.push({
              id: `CAL-H-${h.id}`,
              timestamp: `${h.date} ${h.time || '09:00'}`,
              type: 'Court Event',
              title: `Court Hearing: ${h.purpose}`,
              description: `Status: ${h.status}. Outcome: ${h.outcome || 'Pending court appearance'}.`,
              actor: 'Litigation Team',
              badgeColor: 'bg-amber-100 text-amber-800',
            });
          });

          (selectedCase.serviceRecord || []).forEach((s) => {
            combinedLogs.push({
              id: `CAL-SRV-${s.id}`,
              timestamp: s.date || selectedCase.createdDate || '2026-08-10',
              type: 'Service Record',
              title: `Document Service: ${s.documentServed}`,
              description: `Served on ${s.servedOn} via ${s.method}. Proof obtained: ${s.proofObtained}.`,
              actor: s.servedBy || 'Litigation Clerk',
              badgeColor: 'bg-purple-100 text-purple-800',
            });
          });

          (selectedCase.meetingNotes || []).forEach((m) => {
            combinedLogs.push({
              id: `CAL-MTG-${m.id}`,
              timestamp: m.date,
              type: 'Meeting Recorded',
              title: `Client / Case Meeting: ${m.meetingNotes.slice(0, 80) || 'Meeting'}`,
              description: m.decisions || m.meetingNotes || 'Meeting conducted.',
              actor: m.ourLawyers || m.clientAttendees || 'Lawyer in charge',
              badgeColor: 'bg-[#16223A] text-amber-300',
            });
          });

          combinedLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

          return (
            <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-5 text-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#A9814A]" />
                    <span>Case Activity Feed & Compliance Audit Log</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive chronological record of case updates, document submissions, milestones, and compliance checks for regulatory oversight.
                  </p>
                </div>
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsAddActivityModalOpen(true)}
                    className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-300" />
                    <span>Log Compliance / Activity</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 bg-slate-50 px-3 py-1.5 rounded-md">Audit feed is view-only</span>
                )}
              </div>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                {combinedLogs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs font-medium">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  combinedLogs.map((log) => (
                    <div key={log.id} className="relative pl-8 pb-2 group">
                      <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-[#A9814A] border-2 border-white shadow-2xs group-hover:scale-125 transition-transform" />
                      <div className="bg-[#FAF8F5] border border-[#E1DCCF] p-3.5 rounded-xl space-y-1.5 hover:shadow-2xs transition-shadow">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                            {log.type}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-500">{log.timestamp}</span>
                        </div>
                        <h4 className="font-bold text-xs text-[#16223A]">{log.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{log.description}</p>
                        <div className="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-200/60 flex justify-between items-center">
                          <span>Logged by: {log.actor}</span>
                          <span className="font-mono text-slate-400">Ref: {selectedCase.ref}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {caseSubTab === 'history' && (() => {
          const caseLogs = auditLogs.filter(
            (l) => l.recordId === selectedCase.id || (l.recordTitle && l.recordTitle.includes(selectedCase.ref)) || (l.details && l.details.includes(selectedCase.ref))
          );

          return (
            <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-[#E1DCCF] pb-3">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#A9814A]" />
                    <span>Matter System Audit Trail &amp; Database Change History</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Immutable activity log tracking every creation, edit, update, deletion, and restoration for matter #{selectedCase.ref}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-[#16223A] text-amber-300 px-2.5 py-1 rounded-lg">
                  {caseLogs.length} Audit Events Logged
                </span>
              </div>

              <div className="space-y-3">
                {caseLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-[#FAF8F2] rounded-xl border border-dashed border-[#E1DCCF] text-xs">
                    No system audit logs recorded for this matter yet. Future CRUD operations on this matter will automatically record audit events here.
                  </div>
                ) : (
                  caseLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[9.5px] font-bold font-mono rounded ${
                            log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            log.action === 'DELETE' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                            'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-[#16223A]">{log.recordTitle || log.collection}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-mono text-[10.5px]">ID: {log.recordId}</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-sans text-xs">{log.details}</p>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 pt-1">
                          <span>Performed By: <strong className="text-slate-800">{log.performedBy?.name || 'System Admin'} ({log.performedBy?.role || 'Partner'})</strong></span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {needsCourtTabs && caseSubTab === 'hearings' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A]">Court Hearings Schedule</h3>
                <p className="text-xs text-slate-500">
                  Adding a hearing automatically syncs to firm Google Calendar.
                </p>
              </div>
              <button
                onClick={() => setIsAddHearingModalOpen(true)}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Hearing</span>
              </button>
            </div>

            {isAddServiceModalOpen && (
              <form onSubmit={handleSaveService} className="border border-[#A9814A]/40 bg-[#FAF8F2] rounded-lg p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="font-bold text-slate-700">Date Served
                    <input type="date" value={svcDate} onChange={(e) => setSvcDate(e.target.value)} className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg font-normal" />
                  </label>
                  <label className="font-bold text-slate-700">Proof Status
                    <select value={svcProof} onChange={(e) => setSvcProof(e.target.value as 'Y' | 'N')} className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg">
                      <option value="Y">Proof Obtained</option>
                      <option value="N">Pending Proof</option>
                    </select>
                  </label>
                </div>
                <label className="font-bold text-slate-700 block">Document Served *
                  <input required value={svcDoc} onChange={(e) => setSvcDoc(e.target.value)} placeholder="Statement of Claim or Notice of Application" className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg font-normal" />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="font-bold text-slate-700">Served On
                    <input value={svcServedOn} onChange={(e) => setSvcServedOn(e.target.value)} placeholder="Party / solicitor" className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg font-normal" />
                  </label>
                  <label className="font-bold text-slate-700">Served By
                    <input value={svcServedBy} onChange={(e) => setSvcServedBy(e.target.value)} placeholder="Process server" className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg font-normal" />
                  </label>
                  <label className="font-bold text-slate-700">Service Method
                    <input value={svcMethod} onChange={(e) => setSvcMethod(e.target.value)} placeholder="Personal Service" className="mt-1 w-full p-2 border border-[#E1DCCF] rounded-lg font-normal" />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddServiceModalOpen(false)} className="px-3 py-1.5 border border-[#E1DCCF] rounded-lg font-bold text-slate-700 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-3 py-1.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-lg font-bold cursor-pointer">Log Service Record</button>
                </div>
              </form>
            )}

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500">
                  <th className="py-2">Date</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Purpose / Stage</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedCase.hearings || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No hearings scheduled
                    </td>
                  </tr>
                ) : (
                  [...(selectedCase.hearings || [])]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((h) => (
                      <tr key={h.id}>
                        <td className="py-2.5 font-mono font-semibold text-slate-800">{h.date}</td>
                        <td className="py-2.5 font-semibold text-slate-800">{h.time}</td>
                        <td className="py-2.5 text-slate-800">{h.purpose}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() =>
                              setWaShareText(
                                `Dear ${clientObj ? clientObj.name : 'Client'},\n\nYour hearing for matter ${selectedCase.ref} is scheduled on ${h.date} at ${h.time} for ${h.purpose}.\n\nSyafiqah Hamizad & Co`
                              )
                            }
                            className="bg-[#2F6F4E] hover:bg-emerald-800 text-white text-[11px] font-medium px-2 py-1 rounded cursor-pointer"
                          >
                            WhatsApp Client
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Court Diary */}
        {needsCourtTabs && caseSubTab === 'diary' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A]">Official Court Diary</h3>
                <p className="text-xs text-slate-500">
                  Comprehensive hearing notes, corum, attendance and court directions log.
                </p>
              </div>
              <button
                onClick={openAddDiaryModal}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Diary Entry</span>
              </button>
            </div>

            <div className="space-y-3">
              {(selectedCase.courtDiary || []).length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No court diary entries recorded yet</div>
              ) : (
                (selectedCase.courtDiary || []).map((e) => (
                  <div key={e.id} className="diary-entry text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#16223A] font-mono">{e.date} — {e.matter}</span>
                        {e.medium && (
                          <span className="bg-[#16223A] text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                            {e.medium}
                          </span>
                        )}
                        <span className="bg-amber-100 text-[#16223A] border border-[#A9814A]/40 text-[9.5px] px-2 py-0.5 rounded font-extrabold uppercase">
                          Representing: {e.clientRole || selectedCase.clientRole || 'Plaintiff'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] text-slate-500 font-semibold">{e.court} ({e.corum})</span>
                        <button
                          onClick={() => setSelectedMemoEntry(e)}
                          className="px-2 py-1 bg-[#A9814A] hover:bg-[#8e6b3b] text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                          <span>View Court Memo</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-700">
                      <div>
                        <span className="text-slate-500 font-bold block text-[9.5px] uppercase">Our Lawyer Attendance:</span>
                        {e.ourLawyerAttendance || '—'}
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[9.5px] uppercase">Opponent Counsel:</span>
                        {e.opponentCounselAttendance || '—'}
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[9.5px] uppercase">Next Compliance Date:</span>
                        <span className="font-mono font-bold text-rose-700">{e.nextDate || '—'}</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">Court Directions:</div>
                      <div className="text-slate-800 font-medium">{e.courtDirections}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Matter Tasks (Kanban board synced with the firm-wide Case Status panel) */}
        {caseSubTab === 'tasks' && selectedCase && <CaseStatusView matterCaseId={selectedCase.id} />}

        {/* Tab 6: Client Trust & Cashbook Ledger */}
        {caseSubTab === 'ledger' && (
          <div className="space-y-5 text-xs">
            {/* Header and Add Transaction Control */}
            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
                  <CreditCard className="w-4.5 h-4.5 text-[#A9814A]" />
                  <span>Matter Cashbook &amp; Client Trust Account Ledger</span>
                </h3>
                <p className="text-slate-500 text-xs">
                  Legal Profession Act 1976 &amp; Solicitors' Account Rules compliant financial tracking.
                </p>
              </div>

              <span className="px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider shrink-0">
                View-only ledger
              </span>
            </div>

            {/* Account Balances Overview Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Office Disbursement Account Card */}
              <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-2">
                <div className="flex justify-between items-start border-b border-[#E1DCCF] pb-2">
                  <div>
                    <span className="font-serif font-bold text-sm text-[#16223A] block">1. Office Account (Disbursements)</span>
                    <span className="text-[10.5px] text-slate-500">Firm advanced costs &amp; client billables</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px]">
                    Cap: RM {(selectedCase.disbursementCapAmount || 2000).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="text-[9.5px] font-sans font-bold text-slate-500 uppercase">Total Spent</div>
                    <div className="text-sm font-bold text-slate-900">
                      RM {totalSpent.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="text-[9.5px] font-sans font-bold text-slate-500 uppercase">Net Balance</div>
                    <div className="text-sm font-bold text-emerald-800">
                      RM {(5000 - totalSpent).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Trust Account Card */}
              <div className="bg-white border border-purple-200 p-4 rounded-xl shadow-xs space-y-2">
                <div className="flex justify-between items-start border-b border-purple-200 pb-2">
                  <div>
                    <span className="font-serif font-bold text-sm text-purple-950 block">2. Client Account (Trust)</span>
                    <span className="text-[10.5px] text-purple-800">Client trust deposits held in Bank A/C 1020</span>
                  </div>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 rounded font-bold text-[10px]">
                    Sol. Act 1970
                  </span>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex justify-between items-center">
                  <span className="font-bold text-purple-900 text-xs">Client Trust Account Balance:</span>
                  <span className="font-mono font-extrabold text-lg text-purple-950">
                    RM {trustBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Office Account Cashbook Table */}
            <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#16223A] border-b border-[#E1DCCF] pb-2 flex items-center justify-between">
                <span>Office Account Cashbook (Disbursements &amp; Expenses)</span>
                <span className="text-[10px] font-mono font-normal text-slate-500">Ref: {selectedCase.ref}</span>
              </h4>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500 font-bold bg-[#FAF8F2]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-2">Voucher / Ref</th>
                    <th className="py-2.5 px-3">Description / Particulars</th>
                    <th className="py-2.5 px-3 text-right">Debit Out (RM)</th>
                    <th className="py-2.5 px-3 text-right">Credit In (RM)</th>
                    <th className="py-2.5 px-3 text-right">Balance After Deduction (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 text-slate-700">2025-10-15</td>
                    <td className="py-2.5 px-2 text-slate-600">OR-9912</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">Firm Disbursement Float Allocation</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">2,000.00</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">2,000.00</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-700">2025-10-18</td>
                    <td className="py-2.5 px-2 text-slate-600">PV-1022</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">Court Filing Fee (Writ &amp; Statement of Claim)</td>
                    <td className="py-2.5 px-3 text-right text-rose-700 font-bold">400.00</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">1,600.00</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-700">2025-11-02</td>
                    <td className="py-2.5 px-2 text-slate-600">PV-1088</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">Process Server Travel &amp; Service Expenses</td>
                    <td className="py-2.5 px-3 text-right text-rose-700 font-bold">150.00</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">1,450.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Client Account Cashbook Table */}
            <div className="bg-white border border-purple-200 p-5 rounded-xl shadow-xs space-y-3">
              <h4 className="font-serif font-bold text-sm text-purple-950 border-b border-purple-200 pb-2 flex items-center justify-between">
                <span>Client Account (Trust) Cashbook</span>
                <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Client Bank A/C No. 1020
                </span>
              </h4>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-200 text-[10px] uppercase text-purple-900 font-bold bg-purple-50/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-2">Official Receipt / PV</th>
                    <th className="py-2.5 px-3">Particulars / Client Trust Transaction</th>
                    <th className="py-2.5 px-3 text-right">Deposit In (RM)</th>
                    <th className="py-2.5 px-3 text-right">Withdrawal / Fee Transfer (RM)</th>
                    <th className="py-2.5 px-3 text-right">Client Trust Balance (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 text-slate-700">2025-10-15</td>
                    <td className="py-2.5 px-2 text-purple-900 font-bold">OR-TRUST-881</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                      Client Trust Deposit Received ({clientObj?.name || 'Client'})
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">5,000.00</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-950">5,000.00</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-700">2025-11-10</td>
                    <td className="py-2.5 px-2 text-purple-900 font-bold">PV-TRUST-042</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                      Transfer to Office Account for Interlocutory Interim Legal Fees
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                    <td className="py-2.5 px-3 text-right text-rose-700 font-bold">1,500.00</td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-950">3,500.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Service Record */}
        {caseSubTab === 'service' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A]">Formal Service Record</h3>
                <p className="text-xs text-slate-500">Service of cause papers &amp; notices on opposing parties.</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openServiceRecord();
                }}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Service Log</span>
              </button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500">
                  <th className="py-2">Date Served</th>
                  <th className="py-2">Document</th>
                  <th className="py-2">Served On</th>
                  <th className="py-2">Method</th>
                  <th className="py-2">Proof Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedCase.serviceRecord || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No service records logged yet
                    </td>
                  </tr>
                ) : (
                  (selectedCase.serviceRecord || []).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 font-mono text-slate-700">{s.date}</td>
                      <td className="py-2.5 font-semibold text-slate-800">{s.documentServed}</td>
                      <td className="py-2.5 text-slate-700">{s.servedOn}</td>
                      <td className="py-2.5 text-slate-600">{s.method}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.proofObtained === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.proofObtained === 'Y' ? 'Proof Obtained' : 'Pending Proof'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 8: Client Meeting Notes & AI Summarizer */}
        {caseSubTab === 'meetings' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E1DCCF] pb-3">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A]">Client Consultation Minutes &amp; AI Summarizer</h3>
                <p className="text-xs text-slate-500">Record consultation notes or generate AI summaries saved directly to Google Drive.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAiMeetingModalOpen(true)}
                  className="bg-[#A9814A] hover:bg-[#8E6B3B] text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Meeting Summarizer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMeetingModalOpen(true)}
                  className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Meeting Note</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {(selectedCase.meetingNotes || []).length === 0 ? (
                <div className="py-6 text-center text-slate-500">No client meeting notes logged yet</div>
              ) : (
                (selectedCase.meetingNotes || []).map((m) => (
                  <div key={m.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex justify-between items-center font-bold text-[#16223A]">
                      <div className="flex items-center gap-2">
                        <span>{m.date}</span>
                        {m.isAiGenerated && (
                          <span className="px-2 py-0.5 bg-amber-100 text-[#16223A] border border-[#A9814A]/40 rounded text-[9.5px] font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#A9814A]" />
                            AI Summarized
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[11px] font-normal">Recorded by {m.recordedBy}</span>
                    </div>

                    <div className="text-slate-800 leading-relaxed whitespace-pre-line">{m.meetingNotes}</div>
                    <div className="font-semibold text-emerald-800">Decisions &amp; Directions: {m.decisions}</div>

                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <button
                        onClick={() =>
                          setEmailShareObj({
                            subject: `Meeting Summary (${m.date}) — ${selectedCase.ref}`,
                            body: `Dear ${clientObj ? clientObj.name : 'Client'},\n\nSummary of our meeting on ${m.date}:\n${m.meetingNotes}\n\nDecisions:\n${m.decisions}\n\nWarm regards,\nSyafiqah Hamizad & Co`,
                          })
                        }
                        className="px-2.5 py-1 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded text-[11px] font-medium cursor-pointer"
                      >
                        Email Recap
                      </button>
                      <button
                        onClick={() =>
                          setWaShareText(
                            `Dear ${clientObj ? clientObj.name : 'Client'},\n\nSummary of our meeting on ${m.date}:\n${m.meetingNotes}\n\nSyafiqah Hamizad & Co`
                          )
                        }
                        className="px-2.5 py-1 bg-[#2F6F4E] hover:bg-emerald-800 text-white rounded text-[11px] font-medium cursor-pointer"
                      >
                        WhatsApp Recap
                      </button>
                      {m.gdriveDocUrl && (
                        <a
                          href={m.gdriveDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-bold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Google Drive Doc</span>
                        </a>
                      )}
                      <button type="button" onClick={() => printMatterDocument(`Meeting Minutes - ${m.date}`, `SHCO Lawyers Present: ${m.ourLawyers}\nClient Attendees: ${m.clientAttendees}\n\nMeeting Notes:\n${m.meetingNotes}\n\nDecisions & Next Steps:\n${m.decisions}`)} className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold text-slate-600 cursor-pointer">PDF</button>
                      <button type="button" onClick={() => exportMatterDocument(`Meeting-${m.id}`, `Meeting Minutes - ${m.date}`, `SHCO Lawyers Present: ${m.ourLawyers}\nClient Attendees: ${m.clientAttendees}\n\nMeeting Notes:\n${m.meetingNotes}\n\nDecisions & Next Steps:\n${m.decisions}`)} className="px-2.5 py-1 border border-slate-200 rounded text-[11px] font-bold text-slate-600 cursor-pointer">Word</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 9: Legal Research & Central Library */}
        {caseSubTab === 'research' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E1DCCF] pb-3">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#A9814A]" />
                  <span>Legal Research &amp; Central Library</span>
                </h3>
                <p className="text-slate-500">
                  Store legal research notes, ratio decidendi, and link downloaded Lexis/CLJ judgments in the firm's Central Research Library on Google Drive.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={selectedCase.gdriveFolderUrl || 'https://drive.google.com/drive/my-drive'} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded flex items-center gap-1.5 font-bold">
                  <ExternalLink className="w-3.5 h-3.5" /> Library
                </a>
                <button type="button" onClick={() => setIsAddResearchModalOpen(true)} className="bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Research Note
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {(selectedCase.researchNotes || []).length === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  No research notes recorded for this matter yet. Click "Add Research Note" to archive legal authority.
                </div>
              ) : (
                (selectedCase.researchNotes || []).map((res) => (
                  <div key={res.id} className="p-4 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-[#16223A]">{res.title}</h4>
                        <div className="text-[11px] text-slate-500 font-mono">Date: {res.date} • Prepared by {res.preparedBy}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => printMatterDocument(res.title, `Legal Issues:\n${res.issues}\n\nFindings / Ratio:\n${res.findingsAndRatio}\n\nApplication:\n${res.applicationToCase}`)} className="px-2 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">PDF</button>
                        <button type="button" onClick={() => exportMatterDocument(`Research-${res.id}`, res.title, `Legal Issues:\n${res.issues}\n\nFindings / Ratio:\n${res.findingsAndRatio}\n\nApplication:\n${res.applicationToCase}`)} className="px-2 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Word</button>
                      </div>
                      {res.fullCaseDownloadUrl && (
                        <a
                          href={res.fullCaseDownloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-amber-100 text-[#16223A] border border-[#A9814A]/40 rounded text-[10.5px] font-bold flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3 text-[#A9814A]" />
                          <span>Lexis / CLJ Judgment</span>
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="bg-white p-2.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-700 uppercase text-[9.5px] block">Legal Issues Raised:</span>
                        <p className="text-slate-800">{res.issues}</p>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-700 uppercase text-[9.5px] block">Parties &amp; Courts / Authorities:</span>
                        <p className="text-slate-800">{res.partiesAndCourts}</p>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-700 uppercase text-[9.5px] block">Key Findings &amp; Ratio Decidendi:</span>
                        <p className="text-slate-800">{res.findingsAndRatio}</p>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-slate-200">
                        <span className="font-bold text-slate-700 uppercase text-[9.5px] block">Application to Current Matter:</span>
                        <p className="text-slate-800">{res.applicationToCase}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 14: Internal Notes */}
        {caseSubTab === 'internal' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A]">Internal Research &amp; Strategy</h3>
                <p className="text-xs text-slate-500">Confidential internal legal research notes.</p>
              </div>
              <button
                onClick={() => setIsAddInternalModalOpen(true)}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {(selectedCase.internalNotes || []).length === 0 ? (
                <div className="py-6 text-center text-slate-500">No internal research notes</div>
              ) : (
                (selectedCase.internalNotes || []).map((n) => (
                  <div key={n.id} className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="font-bold text-[#16223A]">{n.noteType}</span>
                      <div className="flex items-center gap-1.5"><span className="text-[10px] text-slate-500 font-mono">{n.date}</span><button type="button" onClick={() => printMatterDocument(`Internal Note - ${n.noteType}`, n.content)} className="px-2 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 cursor-pointer">PDF</button><button type="button" onClick={() => exportMatterDocument(`Internal-${n.id}`, `Internal Note - ${n.noteType}`, n.content)} className="px-2 py-1 border border-slate-200 rounded text-[10px] font-bold text-slate-600 cursor-pointer">Word</button></div>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Subtab Modals */}
        {isAddHearingModalOpen && (
          <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
              <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">Add Court Hearing</h3>
              <form onSubmit={handleSaveHearing} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Purpose / Stage</label>
                  <input
                    type="text"
                    required
                    value={hfPurpose}
                    onChange={(e) => setHfPurpose(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Date</label>
                    <input
                      type="date"
                      value={hfDate}
                      onChange={(e) => setHfDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Time</label>
                    <input
                      type="time"
                      value={hfTime}
                      onChange={(e) => setHfTime(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddHearingModalOpen(false)}
                    className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                  >
                    Save &amp; Sync Calendar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isAddDiaryModalOpen && (
          <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
              <h3 className="font-serif text-lg font-bold text-[#16223A] mb-1">New Court Memo / Court Diary Entry</h3>
              <p className="text-xs text-slate-500 mb-3">Format strictly follows official Syafiqah Hamizad &amp; Co Court Memo standard.</p>
              
              <form onSubmit={handleSaveDiary} className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={dfDate}
                      onChange={(e) => setDfDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Medium</label>
                    <select
                      value={dfMedium}
                      onChange={(e) => setDfMedium(e.target.value as any)}
                      className="w-full font-bold text-slate-800"
                    >
                      <option value="OPEN COURT">OPEN COURT</option>
                      <option value="IN CHAMBERS">IN CHAMBERS</option>
                      <option value="E-REVIEW">E-REVIEW</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Corum / Presiding</label>
                    <input
                      type="text"
                      placeholder="e.g. YA Puan Hakim Zarina"
                      value={dfCorum}
                      onChange={(e) => setDfCorum(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter / Hearing Purpose</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hearing of Application for Injunction (Encl. 5)"
                    value={dfMatter}
                    onChange={(e) => setDfMatter(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Consolidated Lawyer & Counsel Attendance */}
                <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
                  <div className="font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#A9814A]" />
                      Lawyer &amp; Counsel Attendance
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-normal">Pick our SHCO attending lawyer &amp; opposing counsel</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* SHCO Lawyer Attendance Dropdown */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                      <label className="font-bold text-blue-900 block uppercase text-[10.5px] flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-blue-600" />
                        SHCO Lawyer(s) Attending
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={shcoSelectedLawyer}
                          onChange={(e) => setShcoSelectedLawyer(e.target.value)}
                          className="w-full text-xs font-semibold bg-blue-50/50 border-blue-200"
                        >
                          {SHCO_LAWYER_LIST.map((lawyer) => (
                            <option key={lawyer} value={lawyer}>
                              {lawyer}
                            </option>
                          ))}
                          <option value="Custom">Custom / Other Lawyer...</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleAddSHCOAttendance}
                          className="px-2.5 py-1 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                      {shcoSelectedLawyer === 'Custom' && (
                        <input
                          type="text"
                          placeholder="Type lawyer / pupil / intern name..."
                          value={shcoCustomLawyer}
                          onChange={(e) => setShcoCustomLawyer(e.target.value)}
                          className="w-full text-xs"
                        />
                      )}
                      <div>
                        <label className="font-semibold text-slate-500 text-[10px] block mb-0.5">
                          Plaintiff / Applicant Attendance Record:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Syafiqah Hamizad (SH) present"
                          value={dfPlaintifApplicant}
                          onChange={(e) => {
                            setDfPlaintifApplicant(e.target.value);
                            setDfOurLawyer(e.target.value);
                          }}
                          className="w-full bg-slate-50 font-semibold text-xs"
                        />
                      </div>
                    </div>

                    {/* Opposing Counsel Attendance Quick Select */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-purple-900 uppercase text-[10.5px] flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                          Opposing Counsel Attending
                        </label>
                        <button
                          type="button"
                          onClick={handleOpenAddRegOpposing}
                          className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                        >
                          + Add Firm
                        </button>
                      </div>

                      {/* Quick Select Buttons from Registered Opposing Firms */}
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {((selectedCase?.opposingSolicitorsRegistry && selectedCase.opposingSolicitorsRegistry.length > 0)
                          ? selectedCase.opposingSolicitorsRegistry
                          : [
                              {
                                id: 'default-quick',
                                partyRepresented: 'Opposing Party',
                                firmName: selectedCase?.opposingSolicitorsFirm || (selectedCase?.opposingCounsel && selectedCase.opposingCounsel.length > 0 ? selectedCase.opposingCounsel.join(', ') : 'Messrs. Opposing & Co'),
                                solicitors: selectedCase?.opposingSolicitorsName || 'Attending Advocate',
                                firmRef: selectedCase?.opposingSolicitorsRef,
                              },
                            ]
                        ).map((reg) => (
                          <div
                            key={reg.id}
                            className="p-1.5 bg-amber-50/70 rounded border border-amber-200 flex justify-between items-center text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                                <span>{reg.firmName}</span>
                                <span className="text-[9.5px] text-amber-800 bg-amber-100 px-1 py-0.2 rounded font-semibold">
                                  {reg.partyRepresented}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-600">
                                Advocates: {reg.solicitors || 'Advocate'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickInsertOpposing(reg, reg.solicitors, reg.partyRepresented)}
                              className="px-2 py-0.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold text-[10px] rounded shrink-0 cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Insert</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="font-semibold text-slate-500 text-[10px] block mb-0.5">
                          Defendant / Respondent Attendance Record:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Messrs. Aziz & Co (Encik Abdul Aziz) [1st Defendant] present"
                          value={dfDefendantRespondent}
                          onChange={(e) => {
                            setDfDefendantRespondent(e.target.value);
                            setDfOppLawyer(e.target.value);
                          }}
                          className="w-full bg-slate-50 font-semibold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client & Opponent Attendance */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200/80">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">
                      Client Status
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Client Name"
                        value={dfClientName}
                        onChange={(e) => setDfClientName(e.target.value)}
                        className="w-full bg-white text-xs"
                      />
                      <select
                        value={dfClientAtt}
                        onChange={(e) => setDfClientAtt(e.target.value as any)}
                        className="bg-white font-bold text-xs"
                      >
                        <option value="Present">PRESENT</option>
                        <option value="Not Present">NOT PRESENT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">
                      Opponent Status
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Opponent Name"
                        value={dfOpponentName}
                        onChange={(e) => setDfOpponentName(e.target.value)}
                        className="w-full bg-white text-xs"
                      />
                      <select
                        value={dfOppAtt}
                        onChange={(e) => setDfOppAtt(e.target.value as any)}
                        className="bg-white font-bold text-xs"
                      >
                        <option value="Present">PRESENT</option>
                        <option value="Not Present">NOT PRESENT</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Case Status</label>
                    <textarea
                      rows={3}
                      placeholder="Summary of court proceedings and current status..."
                      value={dfStatus}
                      onChange={(e) => setDfStatus(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Instructions</label>
                    <textarea
                      rows={3}
                      placeholder="Client or Partner instructions..."
                      value={dfInstructions}
                      onChange={(e) => setDfInstructions(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="font-bold text-slate-700 block uppercase mb-1">Court's Direction</label>
                    <textarea
                      rows={2}
                      placeholder="Directions given by Judge / Registrar..."
                      value={dfDirections}
                      onChange={(e) => setDfDirections(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Next Date</label>
                    <input
                      type="date"
                      value={dfNextDate}
                      onChange={(e) => setDfNextDate(e.target.value)}
                      className="w-full font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddDiaryModalOpen(false)}
                    className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                  >
                    Save &amp; Generate Court Memo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isAddTaskModalOpen && (
          <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
              <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">Add Matter Task</h3>
              <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={tkTitle}
                    onChange={(e) => setTkTitle(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Task Type</label>
                    <select
                      value={tkType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setTkType(val);
                        if (val === 'Review') {
                          // Auto set 7 day turnaround
                          setTkDue(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
                        }
                      }}
                      className="w-full"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Review">Review (7-day default)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Assignee</label>
                    <select multiple value={tkAssignedTo} onChange={(e) => setTkAssignedTo(Array.from(e.target.selectedOptions).map((option) => (option as HTMLOptionElement).value))} className="w-full min-h-20">
                      {users.filter((user) => user.status === 'Active' && user.role !== 'Client').map((user) => (
                        <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={tkDue}
                    onChange={(e) => setTkDue(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Instructions</label>
                  <textarea
                    rows={4}
                    required
                    value={tkDescription}
                    onChange={(e) => setTkDescription(e.target.value)}
                    placeholder="Describe the required work, expected output, documents, and completion criteria."
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Checklist Bullets</label>
                  <div className="flex gap-2">
                    <textarea rows={3} value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder={'One checklist item per line\ne.g. Obtain signed affidavit'} className="w-full" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Reviewer (optional)</label>
                  <select multiple value={tkReviewer} onChange={(e) => setTkReviewer(Array.from(e.target.selectedOptions).map((option) => (option as HTMLOptionElement).value))} className="w-full min-h-20">
                    <option value="">No reviewer</option>
                    {users.filter((user) => user.status === 'Active' && user.role !== 'Client').map((user) => (
                      <option key={user.id} value={user.name}>{user.name} ({user.role})</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddTaskModalOpen(false)}
                    className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}



        {/* WhatsApp & Email Quick Share Modals */}
        {waShareText && (
          <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
              <h3 className="font-serif text-lg font-bold text-[#16223A] mb-2 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-700" />
                WhatsApp Message Preview
              </h3>
              <textarea
                rows={5}
                value={waShareText}
                onChange={(e) => setWaShareText(e.target.value)}
                className="w-full text-xs font-sans"
              />
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setWaShareText(null)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast('WhatsApp notification sent');
                    setWaShareText(null);
                  }}
                  className="px-4 py-2 bg-[#2F6F4E] hover:bg-emerald-800 text-white rounded-md font-semibold cursor-pointer"
                >
                  Send via WhatsApp Business
                </button>
              </div>
            </div>
          </div>
        )}

        {emailShareObj && (
          <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
              <h3 className="font-serif text-lg font-bold text-[#16223A] mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-700" />
                Draft Gmail Message
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailShareObj.subject}
                    onChange={(e) => setEmailShareObj({ ...emailShareObj, subject: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Body</label>
                  <textarea
                    rows={5}
                    value={emailShareObj.body}
                    onChange={(e) => setEmailShareObj({ ...emailShareObj, body: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEmailShareObj(null)}
                    className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      showToast('Email sent via Gmail integration');
                      setEmailShareObj(null);
                    }}
                    className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                  >
                    Send Gmail
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Physical Legal File Cover Modal */}
        {isFileCoverModalOpen && (
          <FileCoverModal
            isOpen={isFileCoverModalOpen}
            onClose={() => setIsFileCoverModalOpen(false)}
            selectedCase={selectedCase}
            client={clientObj}
            onUpdateCase={updateCase}
          />
        )}

      {/* Change / Substitute Opposing Solicitors Modal */}
      {isChangeOpposingModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="w-5 h-5 text-[#A9814A]" />
              <h3 className="font-serif text-lg font-bold text-[#16223A]">
                Change Opposing Solicitors
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Record Notice of Change of Solicitor (Notis Pertukaran Peguambela &amp; Peguamcara) or update advocate details for opposing party.
            </p>

            <form onSubmit={handleSaveChangeOpposing} className="space-y-3 text-xs">
              {lawFirmRegistry.length > 0 && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <label className="text-[10px] font-bold text-purple-900 block mb-0.5 uppercase">
                    Select Pre-Registered Law Firm (Counsel &amp; Firm Registry):
                  </label>
                  <select
                    onChange={(e) => {
                      const firmId = e.target.value;
                      if (!firmId) return;
                      const selectedFirm = lawFirmRegistry.find((f) => f.id === firmId);
                      if (selectedFirm) {
                        setChgFirmName(selectedFirm.firmName);
                        if (selectedFirm.counsels && selectedFirm.counsels.length > 0) {
                          setChgSolicitorName(selectedFirm.counsels.map((c) => c.name).join(', '));
                        }
                        if (selectedFirm.defaultRefFormat) {
                          setChgFirmRef(selectedFirm.defaultRefFormat);
                        }
                        if (selectedFirm.phone) setChgPhone(selectedFirm.phone);
                        if (selectedFirm.email) setChgEmail(selectedFirm.email);
                        showToast(`Selected from Registry: ${selectedFirm.firmName}`);
                      }
                    }}
                    className="w-full bg-white border border-purple-300 font-semibold text-xs text-purple-950"
                  >
                    <option value="">-- Choose from Registry --</option>
                    {lawFirmRegistry.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firmName} ({f.counsels?.length || 0} Counsels)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  New Opposing Law Firm Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Messrs. Lee, Tan & Partners"
                  value={chgFirmName}
                  onChange={(e) => setChgFirmName(e.target.value)}
                  className="w-full font-bold text-[#16223A]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Lead Solicitor / Counsel Name(s)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Encik Ahmad / Ms. Brenda Lim"
                  value={chgSolicitorName}
                  onChange={(e) => setChgSolicitorName(e.target.value)}
                  className="w-full font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Firm Reference No.</label>
                  <input
                    type="text"
                    placeholder="e.g. LTP/LIT/2026/88"
                    value={chgFirmRef}
                    onChange={(e) => setChgFirmRef(e.target.value)}
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={chgEffectiveDate}
                    onChange={(e) => setChgEffectiveDate(e.target.value)}
                    className="w-full font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Telephone Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. 03-2161 9999"
                    value={chgPhone}
                    onChange={(e) => setChgPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. litigation@ltp.com.my"
                    value={chgEmail}
                    onChange={(e) => setChgEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Reason / Filing Remarks (e.g. Notice of Change)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Notice of Change of Solicitor filed by Defendant on 04/08/2026."
                  value={chgRemarks}
                  onChange={(e) => setChgRemarks(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsChangeOpposingModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A9814A] hover:bg-[#8E6B3B] text-white rounded-md font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Update &amp; Record Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register / Edit Opposing Law Firm & Advocates Modal */}
      {isRegOpposingModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-5 h-5 text-[#A9814A]" />
              <h3 className="font-serif text-lg font-bold text-[#16223A]">
                {editingRegId ? 'Edit Opposing Law Firm & Advocates' : 'Register Opposing Law Firm & Advocates'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {editingRegId
                ? 'Update law firm details, file reference, and list of attending advocates.'
                : 'Add opposing law firm & counsel to matter registry for instant click-and-select during Court Diary creation.'}
            </p>

            <form onSubmit={handleSaveRegOpposing} className="space-y-3 text-xs">
              {lawFirmRegistry.length > 0 && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <label className="text-[10px] font-bold text-purple-900 block mb-0.5 uppercase">
                    Select Pre-Registered Law Firm (Counsel &amp; Firm Registry):
                  </label>
                  <select
                    onChange={(e) => {
                      const firmId = e.target.value;
                      if (!firmId) return;
                      const selectedFirm = lawFirmRegistry.find((f) => f.id === firmId);
                      if (selectedFirm) {
                        setRegFirmName(selectedFirm.firmName);
                        if (selectedFirm.counsels && selectedFirm.counsels.length > 0) {
                          setRegSolicitors(selectedFirm.counsels.map((c) => c.name).join(', '));
                        }
                        if (selectedFirm.defaultRefFormat) {
                          setRegFirmRef(selectedFirm.defaultRefFormat);
                        }
                        if (selectedFirm.phone) setRegPhone(selectedFirm.phone);
                        if (selectedFirm.email) setRegEmail(selectedFirm.email);
                        showToast(`Selected from Registry: ${selectedFirm.firmName}`);
                      }
                    }}
                    className="w-full bg-white border border-purple-300 font-semibold text-xs text-purple-950"
                  >
                    <option value="">-- Choose from Registry --</option>
                    {lawFirmRegistry.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firmName} ({f.counsels?.length || 0} Counsels)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">
                    Party Represented *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1st Defendant, 2nd Respondent, Co-Counsel"
                    value={regPartyRepresented}
                    onChange={(e) => setRegPartyRepresented(e.target.value)}
                    className="w-full font-bold text-[#16223A]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Firm File Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. LTR/LIT/2026/888"
                    value={regFirmRef}
                    onChange={(e) => setRegFirmRef(e.target.value)}
                    className="w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Opposing Law Firm Full Name * (Supports Lengthy Names)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Messrs. Lee, Tan, Ramli & Associates Advocates & Solicitors"
                  value={regFirmName}
                  onChange={(e) => setRegFirmName(e.target.value)}
                  className="w-full font-bold text-[#16223A]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Attending Advocates / Associates / Counsel List
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Encik Abdul Aziz bin Omar, Encik Roslan Ahmad, Ms Sarah Wong (Pupil)"
                  value={regSolicitors}
                  onChange={(e) => setRegSolicitors(e.target.value)}
                  className="w-full font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Telephone Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. 03-2161 9999"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. litigation@leetan.com.my"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegOpposingModalOpen(false);
                    setEditingRegId(null);
                  }}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingRegId ? 'Save Changes' : 'Register Opposing Firm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Represented Client Modal (Our Side) */}
      {isClientPartyModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] my-8">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>{editingClientPartyId ? 'Edit Represented Client Details' : 'Add Represented Client / Co-Party'}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Specify party capacity (e.g. 1st Plaintiff, 2nd Plaintiff, Purchaser, Next Friend) under SHCO representation.
            </p>

            <form onSubmit={handleSaveClientParty} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Select Existing Client or Register New</label>
                <select
                  value={cpSelectedClientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCpSelectedClientId(id);
                    if (id && id !== 'NEW') {
                      const selected = clients.find((c) => c.id === id);
                      if (selected) {
                        setCpName(selected.name);
                        setCpPhone(selected.phone || '');
                        setCpEmail(selected.email || '');
                      }
                    } else if (id === 'NEW') {
                      setCpName('');
                      setCpPhone('');
                      setCpEmail('');
                    }
                  }}
                  className="w-full font-bold text-[#16223A] bg-blue-50/80 border border-blue-300 mb-2"
                >
                  <option value="">-- Choose from Firm Clients Database --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                  <option value="NEW">+ Register New Client into Firm Database</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Party Name (Person or Entity) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Putrie Nur Armanie Qaliesya or Syarikat ABC Sdn Bhd"
                  value={cpName}
                  onChange={(e) => setCpName(e.target.value)}
                  className="w-full font-bold text-[#16223A]"
                />
                {cpSelectedClientId === 'NEW' && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-1">
                    ✨ Entering a new client name here will automatically register them in our central Clients Database.
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Capacity / Role in Proceedings</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1st Plaintiff, 2nd Plaintiff (Next Friend), 1st Purchaser, Intervener"
                  value={cpRole}
                  onChange={(e) => setCpRole(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">IC / Company Registration No.</label>
                <input
                  type="text"
                  placeholder="e.g. 950101-14-5566 or 20240109988"
                  value={cpIc}
                  onChange={(e) => setCpIc(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 012-3456789"
                    value={cpPhone}
                    onChange={(e) => setCpPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. client@example.com"
                    value={cpEmail}
                    onChange={(e) => setCpEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsClientPartyModalOpen(false);
                    setEditingClientPartyId(null);
                  }}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingClientPartyId ? 'Save Changes' : 'Add Client to Matter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Opposing Party Modal (Opposing Side) */}
      {isOppPartyModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] my-8">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              <span>{editingOppPartyId ? 'Edit Opposing Party Details' : 'Add Opposing Party / Co-Defendant'}</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add individual opposing parties (e.g. 1st Defendant, 2nd Defendant, 3rd Respondent).
            </p>

            <form onSubmit={handleSaveOppParty} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Opposing Party Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shukrina Binti Sa'ad or Sekolah Menengah Kebangsaan"
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Role / Capacity in Court</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1st Defendant, 2nd Defendant, Co-Respondent"
                  value={opRole}
                  onChange={(e) => setOpRole(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">IC / Reg No. (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 880202-08-9988"
                  value={opIc}
                  onChange={(e) => setOpIc(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsOppPartyModalOpen(false);
                    setEditingOppPartyId(null);
                  }}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingOppPartyId ? 'Save Changes' : 'Add Opposing Party'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Court Memo Official Modal */}
      {selectedMemoEntry && (
        <CourtMemoModal
          entry={selectedMemoEntry}
          caseObj={selectedCase}
          onClose={() => setSelectedMemoEntry(null)}
        />
      )}

      {selectedCase && (isAddResearchModalOpen || isAddInternalModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-[#16223A]">{isAddResearchModalOpen ? 'Add Legal Research' : isAddInternalModalOpen ? 'Add Internal Note' : 'Add Cashbook Transaction'}</h3>
              <button type="button" onClick={() => { setIsAddResearchModalOpen(false); setIsAddInternalModalOpen(false); setIsAddCashbookModalOpen(false); }} className="text-slate-500 text-xl cursor-pointer">×</button>
            </div>
            {isAddResearchModalOpen && <form onSubmit={handleSaveResearchNote} className="space-y-3 text-xs"><input required value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder="Research title" className="w-full" /><textarea value={resIssues} onChange={(e) => setResIssues(e.target.value)} placeholder="Issues" className="w-full" rows={2} /><textarea required value={resFindingsAndRatio} onChange={(e) => setResFindingsAndRatio(e.target.value)} placeholder="Findings / ratio" className="w-full" rows={4} /><textarea value={resApplicationToCase} onChange={(e) => setResApplicationToCase(e.target.value)} placeholder="Application to this case" className="w-full" rows={3} /><button type="submit" className="w-full bg-[#16223A] text-white p-2 rounded font-bold cursor-pointer">Save Research</button></form>}
            {isAddInternalModalOpen && <form onSubmit={handleSaveInternal} className="space-y-3 text-xs"><select value={inType} onChange={(e) => setInType(e.target.value)} className="w-full"><option>Research</option><option>Strategy</option><option>Directive</option><option>Confidential</option></select><textarea required value={inContent} onChange={(e) => setInContent(e.target.value)} placeholder="Internal note" className="w-full" rows={6} /><button type="submit" className="w-full bg-[#16223A] text-white p-2 rounded font-bold cursor-pointer">Save Internal Note</button></form>}
          </div>
        </div>
      )}

      {/* Add Service Record — self-contained modal, isolated from the multi-purpose modal above */}
      {false && selectedCase && isAddServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-[#16223A]">Add Service Record</h3>
              <button type="button" onClick={() => setIsAddServiceModalOpen(false)} className="text-slate-500 text-xl cursor-pointer">×</button>
            </div>
            <form onSubmit={handleSaveService} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date Served</label>
                  <input type="date" value={svcDate} onChange={(e) => setSvcDate(e.target.value)} className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proof Status</label>
                  <select value={svcProof} onChange={(e) => setSvcProof(e.target.value as 'Y' | 'N')} className="w-full p-2 border border-[#E1DCCF] rounded-lg">
                    <option value="Y">Proof Obtained</option>
                    <option value="N">Pending Proof</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Document Served *</label>
                <input required value={svcDoc} onChange={(e) => setSvcDoc(e.target.value)} placeholder="e.g. Statement of Claim, Notice of Application" className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Served On</label>
                <input value={svcServedOn} onChange={(e) => setSvcServedOn(e.target.value)} placeholder="Party / solicitor served" className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Served By</label>
                <input value={svcServedBy} onChange={(e) => setSvcServedBy(e.target.value)} placeholder="Process server / staff name" className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Method</label>
                <input value={svcMethod} onChange={(e) => setSvcMethod(e.target.value)} placeholder="Personal Service, AR Registered Post, e-Filing, etc." className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
              </div>
              <button type="submit" className="w-full bg-[#16223A] hover:bg-[#1F2E4D] text-white p-2 rounded-lg font-bold cursor-pointer">Log Service Record</button>
            </form>
          </div>
        </div>
      )}

      {/* New Meeting Note — self-contained modal, isolated from the multi-purpose modal above */}
      {selectedCase && isAddMeetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-[#16223A]">Add Meeting Note</h3>
              <button type="button" onClick={() => setIsAddMeetingModalOpen(false)} className="text-slate-500 text-xl cursor-pointer">×</button>
            </div>
            <form onSubmit={handleSaveMeeting} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">SHCO Lawyers Present</label>
                <div className="rounded-lg border border-[#E1DCCF] p-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {mnOurLawyers.split(',').map((name) => name.trim()).filter(Boolean).map((name) => (
                      <button key={name} type="button" onClick={() => setMnOurLawyers(mnOurLawyers.split(',').map((item) => item.trim()).filter((item) => item && item !== name).join(', '))} className="bg-[#16223A] text-amber-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer">{name} x</button>
                    ))}
                  </div>
                  <input value={mnLawyerSearch} onChange={(e) => setMnLawyerSearch(e.target.value)} placeholder="Search registered SHCO lawyers..." className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
                  {mnLawyerSearch.trim() && (
                    <div className="max-h-28 overflow-y-auto border-t border-slate-100 pt-1">
                      {registeredStaff.filter((user) => user.name.toLowerCase().includes(mnLawyerSearch.toLowerCase())).map((user) => (
                        <button key={user.id} type="button" onClick={() => { setMnOurLawyers(Array.from(new Set([...mnOurLawyers.split(',').map((item) => item.trim()).filter(Boolean), user.name])).join(', ')); setMnLawyerSearch(''); }} className="block w-full text-left px-2 py-1.5 hover:bg-amber-50 text-xs cursor-pointer">{user.name} <span className="text-slate-400">({user.role})</span></button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Client Attendees</label>
                <input value={mnClientAttendees} onChange={(e) => setMnClientAttendees(e.target.value)} placeholder="Client representatives present" className="w-full p-2 border border-[#E1DCCF] rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Meeting Notes *</label>
                <textarea required value={mnNotes} onChange={(e) => setMnNotes(e.target.value)} placeholder="Discussion summary" className="w-full p-2 border border-[#E1DCCF] rounded-lg" rows={5} />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Decisions &amp; Next Steps</label>
                <textarea value={mnDecisions} onChange={(e) => setMnDecisions(e.target.value)} placeholder="Agreed action items" className="w-full p-2 border border-[#E1DCCF] rounded-lg" rows={3} />
              </div>
              <button type="submit" className="w-full bg-[#16223A] hover:bg-[#1F2E4D] text-white p-2 rounded-lg font-bold cursor-pointer">Save Meeting Note</button>
            </form>
          </div>
        </div>
      )}

      {/* AI Meeting Summarizer — self-contained modal, isolated from the multi-purpose modal above */}
      {selectedCase && isAiMeetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-serif font-bold text-[#16223A]">Generate AI Meeting Summary</h3>
              <button type="button" onClick={() => setIsAiMeetingModalOpen(false)} className="text-slate-500 text-xl cursor-pointer">×</button>
            </div>
            <form onSubmit={handleGenerateAiMeetingNote} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Meeting Transcript *</label>
                <textarea required value={rawMeetingTranscript} onChange={(e) => setRawMeetingTranscript(e.target.value)} placeholder="Paste the meeting transcript here" className="w-full p-2 border border-[#E1DCCF] rounded-lg" rows={8} />
              </div>
              <button type="submit" disabled={isGeneratingAiMeeting} className="w-full bg-[#16223A] hover:bg-[#1F2E4D] text-white p-2 rounded-lg font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">{isGeneratingAiMeeting ? 'Generating...' : 'Generate Summary'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Standardized Non-Blocking Confirmation Modal Overlay */}
      {ConfirmationModal}

      {/* Add Compliance / Activity Log Modal */}
      {isSuperAdmin && isAddActivityModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E1DCCF] space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#A9814A]" />
                <span>Log Compliance &amp; Case Activity Event</span>
              </h3>
              <button
                onClick={() => setIsAddActivityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!actTitle.trim()) return;
                addCaseActivityLog(selectedCase.id, {
                  title: actTitle.trim(),
                  description: actDesc.trim() || 'Recorded by compliance team.',
                  type: actType,
                  actor: currentPartnerCode || 'Compliance Officer',
                  badgeColor: 'bg-emerald-100 text-emerald-800',
                });
                setActTitle('');
                setActDesc('');
                setIsAddActivityModalOpen(false);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Activity Event Type</label>
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value as any)}
                  className="w-full p-2 border border-[#E1DCCF] rounded-lg font-bold text-[#16223A]"
                >
                  <option value="Compliance Check">Compliance Check / KYC Verification</option>
                  <option value="Document Upload">Document Submission / Filing</option>
                  <option value="Milestone Completion">Key Case Milestone Reached</option>
                  <option value="Status Update">Weekly Status / Strategy Update</option>
                  <option value="Court Event">Court Ruling / Orders Obtained</option>
                  <option value="Service Record">Service of Process Completed</option>
                  <option value="Financial Transaction">Trust / Disbursement Transaction</option>
                  <option value="Meeting Recorded">Client / Counsel Consultation</option>
                  <option value="Note Added">Internal Note / Directive</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SRA Compliance Clearance or Notice of Trial Filed"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  className="w-full p-2 border border-[#E1DCCF] rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Details &amp; Notes</label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed summary or compliance outcome..."
                  value={actDesc}
                  onChange={(e) => setActDesc(e.target.value)}
                  className="w-full p-2 border border-[#E1DCCF] rounded-lg font-normal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddActivityModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save Activity Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    );
  }

  // Master Cases View
  return (
    <div className="space-y-4">
      {/* Top Banner & View Switcher Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#A9814A]" />
            <span>Firm Legal Matter Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized management of active, closed, and archived legal files
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRecycleBinOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-[#16223A] border border-[#E1DCCF] font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Open Data Recovery Vault to retrieve deleted cases and matters"
          >
            <Archive className="w-4 h-4 text-[#A9814A]" />
            <span>Recycle Bin ({deletedRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewCaseModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#203050] text-amber-300 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Register New Case / Case Intake</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E1DCCF] p-3 rounded-lg text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 uppercase text-[10px]">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-[#FAF8F2] border border-[#E1DCCF] rounded px-2 py-1 font-semibold text-[#16223A] outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Closed">Closed</option>
              <option value="Archive">Archive</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600 uppercase text-[10px]">Filter PIC:</span>
            <select
              value={statusLawyerFilter}
              onChange={(e) => setStatusLawyerFilter(e.target.value)}
              className="text-xs bg-[#FAF8F2] border border-[#E1DCCF] rounded px-2 py-1 font-semibold text-[#16223A] outline-none cursor-pointer"
            >
              <option value="ALL">All PICs</option>
              {staffUsersList.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name} ({(u as any).staffProfile?.designation || u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-slate-500 text-[11px] font-medium">
          Showing <strong>{filteredCasesList.length}</strong> of <strong>{cases.length}</strong> firm matters
        </span>
      </div>

      {/* View Mode 1: Case Status Horizontal Table Layout */}
      {casesViewMode === 'status' ? (
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-[#16223A] text-white flex justify-between items-center text-xs">
            <span className="font-serif font-bold tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Weekly Case Status &amp; Stage Tracking Table</span>
            </span>
            <span className="text-[10px] text-slate-300 italic">
              Scroll horizontally for complete status details &amp; editable stage controls ➔
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
              <thead className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-700 font-serif font-bold">
                <tr>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[220px]">Matter Ref &amp; Client Title</th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[150px]">Practice Area</th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[200px] bg-amber-100/50 text-amber-950">
                    Case Stage (Editable Dropdown)
                  </th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[180px]">PIC</th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[110px]">Status</th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[220px]">Completed Actions This Week</th>
                  <th className="p-3 border-r border-[#E1DCCF] min-w-[220px]">Next Action Plan &amp; Target Dates</th>
                  <th className="p-3 text-right min-w-[130px]">Client Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCasesList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                      No matters found matching the current role or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCasesList.map((cs) => (
                    <tr key={cs.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* 1. Matter Ref & Title / Client */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <div
                          onClick={() => {
                            setCurrentCaseId(cs.id);
                            setCaseSubTab('overview');
                          }}
                          className="cursor-pointer group"
                        >
                          <span className="ref-seal text-[11px] px-2 py-0.5 group-hover:bg-[#16223A] group-hover:text-white transition-colors">
                            {cs.ref}
                          </span>
                          <span className="font-bold text-[#16223A] text-xs block mt-1.5 group-hover:text-[#A9814A]">
                            {cs.title}
                          </span>
                          <span className="text-[10.5px] text-slate-500 block mt-1">
                            Client: <strong>{cs.clientName || 'Valued Client'}</strong>
                          </span>
                        </div>
                      </td>

                      {/* 2. Practice Area */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <span className="font-semibold text-slate-800 text-xs block">{cs.type}</span>
                        {cs.clientRole && (
                          <span className="mt-1.5 inline-block text-[9.5px] font-extrabold text-[#A9814A] bg-amber-50 border border-[#A9814A]/30 px-1.5 py-0.5 rounded">
                            Side: {cs.clientRole}
                          </span>
                        )}
                      </td>

                      {/* 3. Matter Stage (EDITABLE DROPDOWN) */}
                      <td className="p-3 border-r border-slate-200 align-top bg-amber-50/30">
                        <label className="text-[9.5px] font-bold text-amber-900 uppercase block mb-1">
                          Current Stage:
                        </label>
                        <select
                          value={cs.stage || 'PTCM'}
                          onChange={(e) => {
                            const newStage = e.target.value;
                            updateCase(cs.id, { stage: newStage });
                            showToast(`Matter ${cs.ref} stage updated to "${newStage}"`);
                          }}
                          className="w-full bg-white border border-amber-300 font-extrabold text-amber-950 p-1.5 rounded-md text-xs shadow-2xs focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer"
                        >
                          <option value="PTCM">PTCM (Pre-Trial Case Management)</option>
                          <option value="Pleading stage">Pleading Stage (Writ / Defence)</option>
                          <option value="Discovery & Inspection">Discovery &amp; Inspection</option>
                          <option value="Interlocutory Application">Interlocutory Application</option>
                          <option value="Settlement Negotiation">Settlement Negotiation</option>
                          <option value="Mediation">Court Mediation</option>
                          <option value="Trial & Cross-Examination">Trial &amp; Cross-Examination</option>
                          <option value="Submissions">Written Submissions</option>
                          <option value="Decision / Judgment">Decision / Judgment</option>
                          <option value="Appeal">Court of Appeal / Federal Court Appeal</option>
                          <option value="Execution / Enforcement">Execution / Enforcement</option>
                          <option value="Closed / Discharged">Closed / File Discharged</option>
                        </select>
                        <span className="text-[9px] text-slate-500 block mt-1">Direct user editable dropdown</span>
                      </td>

                      {/* 4. PIC (EDITABLE DROPDOWN) */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-1">
                          PIC Assigned:
                        </label>
                        <select
                          value={cs.lawyerInCharge || 'Syafiqah Hamizad'}
                          onChange={(e) => {
                            const newLawyer = e.target.value;
                            updateCase(cs.id, { lawyerInCharge: newLawyer });
                            showToast(`Assigned lawyer updated to "${newLawyer}"`);
                          }}
                          className="w-full bg-white border border-slate-300 font-bold text-slate-900 p-1.5 rounded-md text-xs shadow-2xs cursor-pointer"
                        >
                          {staffUsersList.map((u) => (
                            <option key={u.id} value={u.name}>
                              {u.name} ({(u as any).staffProfile?.designation || u.role})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 5. Status */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <select
                          value={cs.status}
                          onChange={(e) => {
                            updateCase(cs.id, { status: e.target.value as any });
                            showToast(`Status updated to ${e.target.value}`);
                          }}
                          className={`w-full px-1.5 py-1 rounded text-[10.5px] font-bold border cursor-pointer ${
                            cs.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : cs.status === 'Pending'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="Pending">Pending</option>
                          <option value="Closed">Closed</option>
                          <option value="Archive">Archive</option>
                        </select>
                      </td>

                      {/* 6. Completed Actions This Week */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <div className="space-y-1">
                          {(() => {
                            const completedTasks = (cs.tasks || []).filter((t) => t.status === 'Completed');
                            if (completedTasks.length === 0) {
                              return (
                                <div className="text-slate-500 italic text-[10.5px] bg-slate-50 p-1.5 rounded border border-slate-200">
                                  • Filed pleadings &amp; served opposing counsel
                                </div>
                              );
                            }
                            return completedTasks.map((t) => (
                              <div
                                key={t.id}
                                className="bg-emerald-50 p-1.5 rounded border border-emerald-200 text-emerald-950 font-medium text-[10.5px] flex items-start gap-1.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={true}
                                  onChange={() => {
                                    const updatedTasks = (cs.tasks || []).map((tk) =>
                                      tk.id === t.id ? { ...tk, status: 'In Progress' as const } : tk
                                    );
                                    updateCase(cs.id, { tasks: updatedTasks });
                                    showToast(`Task "${t.title}" re-opened.`);
                                  }}
                                  className="mt-0.5 rounded text-emerald-700 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <span className="font-bold line-through text-slate-600">{t.title}</span>
                                  <span className="block text-[9px] text-emerald-700 font-semibold">Done by: {t.assignedTo}</span>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </td>

                      {/* 7. Next Action Plan & Matter Tasks */}
                      <td className="p-3 border-r border-slate-200 align-top">
                        <div className="space-y-1.5">
                          {cs.nextHearing && (
                            <div className="bg-rose-50 p-1.5 rounded border border-rose-200 text-rose-950 font-bold text-[10.5px]">
                              ⚖️ Next Court Date: {cs.nextHearing}
                            </div>
                          )}
                          {(() => {
                            const pendingTasks = (cs.tasks || []).filter((t) => t.status !== 'Completed');
                            if (pendingTasks.length === 0) {
                              return (
                                <div className="text-slate-500 italic text-[10.5px] bg-slate-50 p-1.5 rounded border border-slate-200">
                                  • Awaiting court directions
                                </div>
                              );
                            }
                            return pendingTasks.map((t) => (
                              <div
                                key={t.id}
                                className="bg-blue-50 p-1.5 rounded border border-blue-200 text-blue-950 font-medium text-[10.5px] flex items-start gap-1.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => {
                                    const updatedTasks = (cs.tasks || []).map((tk) =>
                                      tk.id === t.id ? { ...tk, status: 'Completed' as const } : tk
                                    );
                                    updateCase(cs.id, { tasks: updatedTasks });
                                    showToast(`Task "${t.title}" marked completed!`);
                                  }}
                                  className="mt-0.5 rounded text-blue-700 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <span className="font-bold block text-[#16223A]">{t.title}</span>
                                  <span className="block text-[9px] text-blue-800 font-mono">
                                    Due: {t.dueDate} ({t.assignedTo})
                                  </span>
                                </div>
                              </div>
                            ));
                          })()}

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentCaseId(cs.id);
                              setIsAddTaskModalOpen(true);
                            }}
                            className="w-full mt-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded font-bold text-[10px] py-1 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-[#A9814A]" />
                            <span>+ Add Matter Task</span>
                          </button>
                        </div>
                      </td>

                      {/* 8. Client Update Actions */}
                      <td className="p-3 align-top text-right space-y-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const completed =
                              (cs.tasks || [])
                                .filter((t) => t.status === 'Completed')
                                .map((t) => `• ${t.title}`)
                                .join('\n') || '• Progression of court pleadings & documentation';
                            const upcoming =
                              (cs.tasks || [])
                                .filter((t) => t.status !== 'Completed')
                                .map((t) => `• ${t.title} (Target: ${t.dueDate})`)
                                .join('\n') || '• Awaiting next court directions & filing';
                            const text = `Dear ${cs.clientName || 'Valued Client'},\n\nWeekly Update for Matter ${cs.ref} (${cs.title}):\n\nLAWYER IN CHARGE: ${cs.lawyerInCharge || 'Syafiqah Hamizad'}\nSTAGE: ${cs.stage || 'PTCM'}\n\nACTIONS COMPLETED THIS WEEK:\n${completed}\n\nNEXT ACTIONS & SCHEDULED DATES:\n${upcoming}\n\nShould you have any queries, please feel free to reach out.\n\nWarm regards,\nMessrs. Syafiqah Hamizad & Co`;
                            setWaShareText(text);
                          }}
                          className="w-full bg-[#2F6F4E] hover:bg-emerald-800 text-white font-bold px-2 py-1 rounded text-[10.5px] flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const completed =
                              (cs.tasks || [])
                                .filter((t) => t.status === 'Completed')
                                .map((t) => `• ${t.title}`)
                                .join('\n') || '• Progression of court pleadings & documentation';
                            const upcoming =
                              (cs.tasks || [])
                                .filter((t) => t.status !== 'Completed')
                                .map((t) => `• ${t.title} (Target: ${t.dueDate})`)
                                .join('\n') || '• Awaiting next court directions & filing';
                            setEmailShareObj({
                              subject: `Weekly Case Progress Update: ${cs.title} [${cs.ref}]`,
                              body: `Dear ${cs.clientName || 'Valued Client'},\n\nWeekly Status Update for your matter ${cs.ref}:\nLawyer in Charge: ${cs.lawyerInCharge || 'Syafiqah Hamizad'}\nCurrent Stage: ${cs.stage || 'PTCM'}\n\nACTIONS COMPLETED THIS WEEK:\n${completed}\n\nNEXT ACTIONS FOR COMING WEEK:\n${upcoming}\n\nThank you for trusting Messrs Syafiqah Hamizad & Co.`,
                            });
                          }}
                          className="w-full bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold px-2 py-1 rounded text-[10.5px] flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteCase(cs);
                          }}
                          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-2 py-1 rounded text-[10.5px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Delete Matter Record"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* View Mode 2: Standard Master Registry Table */
        <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
                <th className="p-3 font-bold">Matter Reference</th>
                <th className="p-3 font-bold">Title / Matter Subject</th>
                <th className="p-3 font-bold">Practice Area</th>
                <th className="p-3 font-bold">PIC</th>
                <th className="p-3 font-bold">File Age</th>
                <th className="p-3 font-bold">Status</th>
                <th className="p-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCasesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No matters found matching filter criteria
                  </td>
                </tr>
              ) : (
                filteredCasesList.map((cs) => (
                  <tr
                    key={cs.id}
                    onClick={() => {
                      setCurrentCaseId(cs.id);
                      setCaseSubTab('overview');
                    }}
                    className="hover:bg-[#FAF8F2] transition-colors cursor-pointer"
                  >
                    <td className="p-3">
                      <span className="ref-seal">{cs.ref}</span>
                    </td>
                    <td className="p-3 font-bold text-[#16223A]">{cs.title}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-800">{cs.type}</span>
                        {cs.clientRole && (
                          <span className="text-[9.5px] font-extrabold text-[#A9814A] bg-amber-50 border border-[#A9814A]/30 px-1.5 py-0.2 rounded w-max">
                            Side: {cs.clientRole}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-800">{cs.lawyerInCharge || 'Syafiqah Hamizad'}</td>
                    <td className="p-3 font-mono font-bold text-[#16223A]">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        {calculateFileAge(cs)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cs.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cs.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cs.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteCase(cs);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        title="Delete Matter Record"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Case Modal handled globally in App.tsx */}
      {false && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3">
              Open New Matter &amp; Generate Reference
            </h3>
            <form onSubmit={handleSaveNewCase} className="space-y-3.5 text-xs">
              {/* Primary Client & Practice Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Primary Client *</label>
                  <select
                    value={ncClientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setNcClientId(id);
                      const cObj = clients.find((c) => c.id === id);
                      if (cObj) {
                        setNcClientsList((prev) => {
                          if (prev.length === 0) {
                            return [
                              {
                                id: `CP-init-${Date.now()}`,
                                clientId: cObj.id,
                                name: cObj.name,
                                role: ncClientRole || '1st Plaintiff',
                                phone: cObj.phone,
                                email: cObj.email,
                              },
                            ];
                          } else {
                            return prev.map((item, idx) =>
                              idx === 0
                                ? {
                                    ...item,
                                    clientId: cObj.id,
                                    name: cObj.name,
                                    phone: cObj.phone,
                                    email: cObj.email,
                                  }
                                : item
                            );
                          }
                        });
                      }
                    }}
                    className="w-full font-bold text-[#16223A]"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area</label>
                  <select
                    value={ncPracticeArea}
                    onChange={(e) => handlePracticeAreaChange(e.target.value)}
                    className="w-full font-semibold"
                  >
                    <option>Civil Litigation</option>
                    <option>Conveyancing</option>
                    <option>Corporate/Commercial</option>
                    <option>Criminal</option>
                    <option>Probate/Estate</option>
                    <option>Dispute Resolution</option>
                    <option>Syariah</option>
                    <option>Technology/AI/Fintech</option>
                  </select>
                </div>
              </div>

              {/* Client Role & Side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">
                    Client Role / Side (Whom We Represent)
                  </label>
                  <select
                    value={ncClientRole}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setNcClientRole(newRole);
                      setNcClientsList((prev) =>
                        prev.map((item, idx) => (idx === 0 ? { ...item, role: newRole } : item))
                      );
                    }}
                    className="w-full font-bold text-[#16223A] bg-amber-50 border border-amber-300"
                  >
                    {(PRACTICE_CLIENT_ROLES[ncPracticeArea] || ['Client', 'Other']).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {ncClientRole === 'Other' ? (
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Specify Custom Role</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Co-Defendant, Intervener 2, Trustee"
                      value={ncCustomRole}
                      onChange={(e) => setNcCustomRole(e.target.value)}
                      className="w-full font-semibold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Client Abbreviation Tag</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. QAL, ANGR"
                      value={ncClientTag}
                      onChange={(e) => setNcClientTag(e.target.value.toUpperCase())}
                      className="w-full font-mono"
                    />
                  </div>
                )}
              </div>

              {/* SHCO Multi-Client Representation Builder */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                  <div>
                    <label className="font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      Clients Represented by Us (SHCO Multi-Client Roster)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      All clients must be registered in the Client Panel first. Select client to set their role (1st Plaintiff, 2nd Appellant, etc.).
                    </p>
                  </div>
                </div>

                {/* Display List of Clients in Matter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(ncClientsList.length > 0
                    ? ncClientsList
                    : [
                        {
                          id: 'cp-default',
                          clientId: ncClientId,
                          name: clients.find((c) => c.id === ncClientId)?.name || 'Primary Client',
                          role: ncClientRole || '1st Plaintiff',
                        },
                      ]
                  ).map((cp, idx) => (
                    <div
                      key={cp.id || idx}
                      className="bg-white p-2.5 rounded-lg border border-blue-300 flex justify-between items-center text-xs shadow-2xs"
                    >
                      <div>
                        <div className="font-bold text-[#16223A] flex items-center gap-1.5">
                          <span>{cp.name}</span>
                          <span className="text-[9.5px] bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded font-bold">
                            {cp.role}
                          </span>
                        </div>
                        {(cp.phone || cp.email || cp.clientId) && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {cp.clientId && <span className="font-mono text-blue-700 mr-1">[{cp.clientId}]</span>}
                            {cp.phone && `Tel: ${cp.phone} `}
                            {cp.email && `• ${cp.email}`}
                          </div>
                        )}
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setNcClientsList(ncClientsList.filter((_, i) => i !== idx))}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 rounded border border-rose-200 cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Additional Client Form (Selected strictly from Client Panel) */}
                <div className="bg-white p-3 rounded-lg border border-blue-200 space-y-2 text-xs">
                  <div className="font-bold text-[11px] text-[#16223A] uppercase flex items-center justify-between">
                    <span>+ Add Represented Client (From Client Panel Registry)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 text-[10px] block mb-0.5">
                        Select Client from Client Panel *
                      </label>
                      <select
                        value={ncAddClientSelectId}
                        onChange={(e) => setNcAddClientSelectId(e.target.value)}
                        className="w-full bg-slate-50 font-semibold text-xs"
                      >
                        <option value="">-- Select Registered Client --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 text-[10px] block mb-0.5">
                        Role / Capacity in Proceedings *
                      </label>
                      <select
                        value={ncAddClientRole}
                        onChange={(e) => setNcAddClientRole(e.target.value)}
                        className="w-full bg-slate-50 font-semibold text-xs"
                      >
                        <option value="1st Plaintiff">1st Plaintiff</option>
                        <option value="2nd Plaintiff">2nd Plaintiff</option>
                        <option value="3rd Plaintiff">3rd Plaintiff</option>
                        <option value="1st Defendant">1st Defendant</option>
                        <option value="2nd Defendant">2nd Defendant</option>
                        <option value="1st Appellant">1st Appellant</option>
                        <option value="2nd Appellant">2nd Appellant</option>
                        <option value="1st Respondent">1st Respondent</option>
                        <option value="2nd Respondent">2nd Respondent</option>
                        <option value="Intervener">Intervener</option>
                        <option value="Co-Applicant">Co-Applicant</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic">
                    Note: To represent a new client, register them at the Client Panel first, then select them here to assign their capacity in the case.
                  </p>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!ncAddClientSelectId) {
                          showToast('Please select a client from the Client Panel registry.');
                          return;
                        }
                        const existing = clients.find((c) => c.id === ncAddClientSelectId);
                        if (!existing) return;
                        if (ncClientsList.some((c) => c.clientId === existing.id)) {
                          showToast(`${existing.name} is already added to this matter.`);
                          return;
                        }
                        const partyRec: PartyRecord = {
                          id: `CP-nc-${Date.now()}`,
                          clientId: existing.id,
                          name: existing.name,
                          role: ncAddClientRole.trim() || 'Co-Client',
                          phone: existing.phone,
                          email: existing.email,
                        };
                        setNcClientsList((prev) => [...prev, partyRec]);
                        setNcAddClientSelectId('');
                        showToast(`Added client ${existing.name} as ${partyRec.role}!`);
                      }}
                      className="text-xs bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Client to Matter Roster</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Code *</label>
                  <select
                    value={ncMatterCode}
                    onChange={(e) => setNcMatterCode(e.target.value)}
                    className="w-full font-mono font-bold"
                  >
                    {getConfiguredMatterCodes(ncPracticeArea).map((matter) => (
                      <option key={matter.code} value={matter.code}>
                        {matter.code} — {matter.label}
                      </option>
                    ))}
                    <option value="CUSTOM">CUSTOM — Enter below</option>
                  </select>
                  {ncMatterCode === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. JV, PTP, ADJ"
                      value={ncSubtype}
                      onChange={(e) => setNcSubtype(e.target.value.toUpperCase())}
                      className="w-full mt-2 font-mono"
                    />
                  )}
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Partner(s) In Charge * (Select One, Multiple, or All)</label>
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-amber-50/80 border border-amber-300 rounded-lg text-xs">
                    {[
                      { code: 'SH' as PartnerCode, name: 'Syafiqah Hamizad (Partner)' },
                      { code: 'AH' as PartnerCode, name: 'Amer Haiqal (Partner)' },
                      { code: 'ZA' as PartnerCode, name: 'Zulaikha Afendi (Partner)' },
                    ].map((p) => {
                      const isSelected = ncSelectedPartners.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className={`flex items-center gap-1.5 font-bold cursor-pointer px-2.5 py-1 rounded border text-xs transition-all ${
                            isSelected
                              ? 'bg-[#16223A] text-white border-[#16223A] shadow-2xs'
                              : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (!ncSelectedPartners.includes(p.code)) {
                                  setNcSelectedPartners([...ncSelectedPartners, p.code]);
                                }
                              } else {
                                if (ncSelectedPartners.length > 1) {
                                  setNcSelectedPartners(ncSelectedPartners.filter((x) => x !== p.code));
                                } else {
                                  showToast('At least one Partner in Charge must be selected.');
                                }
                              }
                            }}
                            className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                          />
                          <span>{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Lawyer In Charge *</label>
                  <select
                    value={ncLawyerInCharge}
                    onChange={(e) => setNcLawyerInCharge(e.target.value as PartnerCode)}
                    className="w-full font-bold"
                  >
                    <option value="SH">Syafiqah Hamizad (SH)</option>
                    <option value="AH">Amer Haiqal (AH)</option>
                    <option value="ZA">Zulaikha Afendi (ZA)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Live Reference Preview */}
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Generated Reference Format Preview:
                </span>
                <span className="ref-seal text-xs font-mono font-bold text-[#16223A]">
                  {generateRefString(ncPracticeArea, ncMatterCode === 'CUSTOM' ? ncSubtype : ncMatterCode, ncSelectedPartners, ncLawyerInCharge, ncClientTag)}
                </span>
              </div>

              {/* PRACTICE AREA SPECIFIC PARTICULAR FIELDS */}
              {(() => {
                const paLower = (ncPracticeArea || '').toLowerCase();
                const isConv = paLower.includes('convey') || paLower.includes('property') || paLower.includes('spa') || paLower.includes('tenancy') || paLower.includes('land');
                const isCorp = paLower.includes('corporate') || paLower.includes('advisory') || paLower.includes('commercial') || paLower.includes('secretarial');

                if (isConv) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                      <div>
                        <label className="font-bold text-emerald-900 block uppercase mb-1 text-[10px]">Property Title / Lot No.</label>
                        <input
                          type="text"
                          placeholder="e.g. H.S.(D) 10492 / Lot 8812"
                          value={ncPropertyTitleNo}
                          onChange={(e) => setNcPropertyTitleNo(e.target.value)}
                          className="w-full font-mono text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-900 block uppercase mb-1 text-[10px]">Property Address</label>
                        <input
                          type="text"
                          placeholder="e.g. No. 18, Jalan Astaka 3, BRP"
                          value={ncPropertyAddress}
                          onChange={(e) => setNcPropertyAddress(e.target.value)}
                          className="w-full text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-900 block uppercase mb-1 text-[10px]">Purchase Price / Consideration</label>
                        <input
                          type="text"
                          placeholder="e.g. RM 650,000.00"
                          value={ncPurchasePrice}
                          onChange={(e) => setNcPurchasePrice(e.target.value)}
                          className="w-full font-mono text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-900 block uppercase mb-1 text-[10px]">Financier / Loan Bank</label>
                        <input
                          type="text"
                          placeholder="e.g. Maybank Islamic Berhad"
                          value={ncFinancierBank}
                          onChange={(e) => setNcFinancierBank(e.target.value)}
                          className="w-full text-xs bg-white"
                        />
                      </div>
                    </div>
                  );
                }

                if (isCorp) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
                      <div>
                        <label className="font-bold text-purple-900 block uppercase mb-1 text-[10px]">Corporate Advisory Nature</label>
                        <input
                          type="text"
                          placeholder="e.g. Share Sale Agreement & Advisory"
                          value={ncCorporateMatterType}
                          onChange={(e) => setNcCorporateMatterType(e.target.value)}
                          className="w-full text-xs font-semibold bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-purple-900 block uppercase mb-1 text-[10px]">Contract / Transaction Value</label>
                        <input
                          type="text"
                          placeholder="e.g. RM 2,500,000.00"
                          value={ncContractValue}
                          onChange={(e) => setNcContractValue(e.target.value)}
                          className="w-full font-mono text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-purple-900 block uppercase mb-1 text-[10px]">Regulatory Authority</label>
                        <input
                          type="text"
                          placeholder="e.g. SSM / Securities Commission"
                          value={ncRegulatoryAuthority}
                          onChange={(e) => setNcRegulatoryAuthority(e.target.value)}
                          className="w-full text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-purple-900 block uppercase mb-1 text-[10px]">Governing Law &amp; Forum</label>
                        <input
                          type="text"
                          placeholder="e.g. Laws of Malaysia"
                          value={ncGoverningLaw}
                          onChange={(e) => setNcGoverningLaw(e.target.value)}
                          className="w-full text-xs bg-white"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                    <div>
                      <label className="font-bold text-amber-950 block uppercase mb-1 text-[10px]">Court Case No.</label>
                      <input
                        type="text"
                        placeholder="e.g. TA-A51NCvC-16-10/2025"
                        value={ncCourtCaseNo}
                        onChange={(e) => setNcCourtCaseNo(e.target.value)}
                        className="w-full font-mono text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-amber-950 block uppercase mb-1 text-[10px]">Court / Forum</label>
                      <input
                        type="text"
                        placeholder="e.g. High Court of Malaya"
                        value={ncCourt}
                        onChange={(e) => setNcCourt(e.target.value)}
                        className="w-full text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-amber-950 block uppercase mb-1 text-[10px]">Presiding Judge / Magistrate</label>
                      <input
                        type="text"
                        placeholder="e.g. Y.A. Dato' Justice S. Ramanathan"
                        value={ncJudge}
                        onChange={(e) => setNcJudge(e.target.value)}
                        className="w-full text-xs bg-white"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Multi-Opposing Party Section */}
              <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                  <div>
                    <label className="font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-rose-600" />
                      Opposing Parties Roster (Multi-Opposing Party Support)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Record all opposing parties (1st Defendant, 2nd Defendant, 2nd Appellant, etc.) in this matter.
                    </p>
                  </div>
                </div>

                {/* Opposing Party Roster List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(ncOpposingPartiesList.length > 0
                    ? ncOpposingPartiesList
                    : [
                        {
                          id: 'op-default',
                          name: ncOpposing.trim() || '1st Defendant / Opposing Party',
                          role: '1st Defendant',
                        },
                      ]
                  ).map((op, idx) => (
                    <div
                      key={op.id || idx}
                      className="bg-white p-2.5 rounded-lg border border-rose-300 flex justify-between items-center text-xs shadow-2xs"
                    >
                      <div>
                        <div className="font-bold text-[#16223A] flex items-center gap-1.5">
                          <span>{op.name}</span>
                          <span className="text-[9.5px] bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded font-bold">
                            {op.role}
                          </span>
                        </div>
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setNcOpposingPartiesList(ncOpposingPartiesList.filter((_, i) => i !== idx))}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 rounded border border-rose-200 cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Opposing Party Form */}
                <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-600 text-[10px] block mb-0.5">
                        Opposing Party Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Shukrina Binti Sa'ad or Syarikat Megah Bina"
                        value={ncAddOppPartyName}
                        onChange={(e) => {
                          setNcAddOppPartyName(e.target.value);
                          if (!ncOpposing) setNcOpposing(e.target.value);
                        }}
                        className="w-full bg-slate-50 font-semibold text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-600 text-[10px] block mb-0.5">
                        Role / Capacity in Case *
                      </label>
                      <select
                        value={ncAddOppPartyRole}
                        onChange={(e) => setNcAddOppPartyRole(e.target.value)}
                        className="w-full bg-slate-50 font-semibold text-xs"
                      >
                        <option value="1st Defendant">1st Defendant</option>
                        <option value="2nd Defendant">2nd Defendant</option>
                        <option value="3rd Defendant">3rd Defendant</option>
                        <option value="1st Respondent">1st Respondent</option>
                        <option value="2nd Respondent">2nd Respondent</option>
                        <option value="1st Appellant">1st Appellant</option>
                        <option value="2nd Appellant">2nd Appellant</option>
                        <option value="Intervener">Intervener</option>
                        <option value="Co-Opposing Party">Co-Opposing Party</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!ncAddOppPartyName.trim()) {
                          showToast('Please enter opposing party name.');
                          return;
                        }
                        const partyRec: PartyRecord = {
                          id: `OP-nc-${Date.now()}`,
                          name: ncAddOppPartyName.trim(),
                          role: ncAddOppPartyRole.trim() || '2nd Defendant',
                        };
                        setNcOpposingPartiesList((prev) => [...prev, partyRec]);
                        setNcAddOppPartyName('');
                        showToast(`Added opposing party ${partyRec.name}!`);
                      }}
                      className="text-xs bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Opposing Party</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Unified Opposing Legal Representatives Roster Section */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                  <div>
                    <div className="font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-[#A9814A]" />
                      <span>Opposing Legal Representatives (Law Firm Roster)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Record all law firms representing opposing parties. Multiple parties can be represented by the same firm or different firms.
                    </p>
                  </div>
                  {lawFirmRegistry.length > 0 && (
                    <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
                      Linked with Registry
                    </span>
                  )}
                </div>

                {/* Display Roster of Opposing Representatives */}
                <div className="space-y-2">
                  {ncOpposingRegistry.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ncOpposingRegistry.map((reg, idx) => (
                        <div
                          key={reg.id || idx}
                          className="bg-white p-2.5 rounded-lg border border-amber-300 text-xs flex justify-between items-center shadow-2xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-[#16223A] flex items-center gap-1.5 flex-wrap">
                              <span>{reg.firmName}</span>
                              <span className="text-[9.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                                {reg.partyRepresented}
                              </span>
                            </div>
                            {reg.firmRef && (
                              <div className="text-[11px] font-mono text-slate-600">
                                Ref: {reg.firmRef}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNcOpposingRegistry(ncOpposingRegistry.filter((_, i) => i !== idx))}
                            className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 rounded border border-rose-200 cursor-pointer shrink-0 ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : ncOpposingFirm.trim() ? (
                    <div className="bg-white p-2.5 rounded-lg border border-amber-300 text-xs flex justify-between items-center shadow-2xs">
                      <div>
                        <div className="font-bold text-[#16223A] flex items-center gap-1.5">
                          <span>{ncOpposingFirm}</span>
                          <span className="text-[9.5px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                            1st Defendant / Opposing Representative
                          </span>
                        </div>
                        {ncOpposingRef && <div className="text-[11px] font-mono text-slate-600">Ref: {ncOpposingRef}</div>}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Inline Builder & Quick Select Form */}
                <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-2.5 text-xs">
                  <div className="font-semibold text-slate-700 text-[11px] uppercase flex items-center justify-between border-b border-amber-100 pb-1">
                    <span>+ Add / Select Opposing Law Firm</span>
                    {lawFirmRegistry.length > 0 && (
                      <span className="text-[10px] text-amber-800 font-normal">Select pre-registered firm or enter details</span>
                    )}
                  </div>

                  {/* Quick Select from Law Firm Registry */}
                  {lawFirmRegistry.length > 0 && (
                    <div>
                      <label className="text-[10px] font-semibold text-amber-900 block mb-0.5">
                        Quick Select Pre-Registered Law Firm:
                      </label>
                      <select
                        onChange={(e) => {
                          const firmId = e.target.value;
                          if (!firmId) return;
                          const selectedFirm = lawFirmRegistry.find((f) => f.id === firmId);
                          if (selectedFirm) {
                            setNcAddFirmName(selectedFirm.firmName);
                            if (selectedFirm.defaultRefFormat) {
                              setNcAddFirmRef(selectedFirm.defaultRefFormat);
                            }
                            showToast(`Auto-selected firm: ${selectedFirm.firmName}`);
                          }
                        }}
                        className="w-full bg-amber-50/50 border border-amber-300 text-amber-950 font-semibold text-xs py-1 px-2 rounded"
                      >
                        <option value="">-- Choose from Firm Registry --</option>
                        {lawFirmRegistry.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.firmName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-0.5">
                        Party Represented *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1st Defendant, 2nd Defendant, 3rd Respondent"
                        value={ncAddPartyRep}
                        onChange={(e) => setNcAddPartyRep(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-0.5">
                        Law Firm File Reference Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AC/2026/101 or RKP/CV/2026/904"
                        value={ncAddFirmRef}
                        onChange={(e) => setNcAddFirmRef(e.target.value)}
                        className="w-full text-xs font-mono bg-slate-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-0.5">
                      Opposing Law Firm Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Messrs. Aziz & Co or Messrs. Ramli, Kamarudin & Partners"
                      value={ncAddFirmName}
                      onChange={(e) => {
                        setNcAddFirmName(e.target.value);
                        if (!ncOpposingFirm) setNcOpposingFirm(e.target.value);
                      }}
                      className="w-full text-xs font-bold text-[#16223A] bg-slate-50"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!ncAddFirmName.trim()) {
                          showToast('Please enter the opposing law firm name.');
                          return;
                        }
                        const newRecord: OpposingSolicitorRecord = {
                          id: `OSR-nc-${Date.now()}`,
                          partyRepresented: ncAddPartyRep.trim() || '1st Defendant',
                          firmName: ncAddFirmName.trim(),
                          solicitors: '',
                          firmRef: ncAddFirmRef.trim() || undefined,
                        };
                        setNcOpposingRegistry([...ncOpposingRegistry, newRecord]);
                        if (!ncOpposingFirm) {
                          setNcOpposingFirm(newRecord.firmName);
                          if (newRecord.firmRef) setNcOpposingRef(newRecord.firmRef);
                        }
                        setNcAddFirmName('');
                        setNcAddFirmRef('');
                        setNcAddPartyRep('2nd Defendant');
                        showToast(`Added ${newRecord.firmName} (${newRecord.partyRepresented}) to matter roster!`);
                      }}
                      className="text-xs bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold px-3.5 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Opposing Representative</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Create Matter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Recycle Bin Data Recovery Modal */}
      <RecycleBinModal isOpen={isRecycleBinOpen} onClose={() => setIsRecycleBinOpen(false)} />
      {ConfirmationModal}
    </div>
  );
};
