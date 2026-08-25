import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Case, CaseDocument, PartyRecord, OpposingSolicitorRecord } from '../types';
import { scanOpposingPartyConflicts } from '../lib/conflictUtils';
import { getPracticeSettings } from '../services/templateService';
import {
  X,
  CheckCircle2,
  Copy,
  Briefcase,
  ArrowRight,
  UserPlus,
  FileCheck2,
  FileSignature,
  FileText,
  Printer,
  PenTool,
  Info,
  ShieldCheck,
  Check,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose }) => {
  const { clients, cases, users, addCase, updateCase, setCurrentCaseId, setCurrentView, showToast, bankAccounts, addTrustAuditLog, currentUser, newCasePrefill, setNewCasePrefill, getNextSequenceId, incrementSequenceCounter, lawFirmRegistry, addLawFirmRegistryEntry } = useApp();

  // Dynamically compute firm staff members, partners, lawyers, and file handlers from useApp() users state
  const firmStaffMembers = React.useMemo(() => {
    const activeStaff = (users || []).filter((u) => u.status !== 'Inactive' && u.role !== 'Client');

    const formatted = activeStaff.map((u) => {
      let code = 'STAFF';
      const nameUpper = u.name.toUpperCase();
      if (nameUpper.includes('SYAFIQAH')) code = 'SH';
      else if (nameUpper.includes('ZULAIKHA')) code = 'ZA';
      else if (nameUpper.includes('AMER')) code = 'AH';
      else {
        const parts = u.name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          code = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0].length >= 2) {
          code = parts[0].substring(0, 2).toUpperCase();
        }
      }
      const roleTitle = u.staffProfile?.designation || u.role || 'Legal Staff';
      const isPartner = u.role === 'Partner' || roleTitle.toLowerCase().includes('partner') || u.isAdmin || u.isSuperAdmin;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: roleTitle,
        code,
        isPartner,
      };
    });

    const defaultLeaders = [
      { id: 'USR-001', name: 'Syafiqah Hamizad', email: 'syafiqahhamizad@shcolaw.com', role: 'Managing Partner', code: 'SH', isPartner: true },
      { id: 'USR-002', name: 'Zulaikha Afendi', email: 'zulaikha@shcolaw.com', role: 'Partner', code: 'ZA', isPartner: true },
      { id: 'USR-003', name: 'Amer Haiqal', email: 'amer@shcolaw.com', role: 'Partner', code: 'AH', isPartner: true },
    ];

    defaultLeaders.forEach((d) => {
      if (!formatted.some((s) => s.name.toLowerCase() === d.name.toLowerCase() || s.code === d.code)) {
        formatted.push(d);
      }
    });

    return formatted;
  }, [users]);

  const dynamicPartnerOptions = React.useMemo(() => {
    return firmStaffMembers.filter((s) => s.isPartner || s.role.toLowerCase().includes('partner'));
  }, [firmStaffMembers]);

  const dynamicLawyerOptions = React.useMemo(() => {
    return firmStaffMembers;
  }, [firmStaffMembers]);

  const dynamicStaffOptions = React.useMemo(() => {
    return firmStaffMembers.map((s) => ({
      name: s.name,
      role: s.role,
      code: s.code,
      email: s.email,
    }));
  }, [firmStaffMembers]);

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3 | 4>(1);
  const [showEngagementLetterDoc, setShowEngagementLetterDoc] = useState(false);
  const [, setSettingsRevision] = useState(0);

  useEffect(() => {
    const refreshSettings = () => setSettingsRevision((revision) => revision + 1);
    window.addEventListener('shco-practice-settings-updated', refreshSettings);
    return () => window.removeEventListener('shco-practice-settings-updated', refreshSettings);
  }, []);

  // Form Fields
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(clients[0]?.id ? [clients[0].id] : []);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState<boolean>(false);
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);

  const [caseTitle, setCaseTitle] = useState('Datuk Dr. Robert Wong v. Apex Holdings Sdn Bhd & Anor');
  const [opponentName, setOpponentName] = useState('Apex Holdings Sdn Bhd');
  
  // Practice Area Selection (LIT / CONV / CORP / CR / SY)
  const [practiceArea, setPracticeArea] = useState<string>('Civil Litigation');

  // React effect to apply prefill data if present
  useEffect(() => {
    if (isOpen) {
      if (newCasePrefill) {
        if (newCasePrefill.clientId) {
          setSelectedClientIds([newCasePrefill.clientId]);
        }
        if (newCasePrefill.caseTitle) {
          setCaseTitle(newCasePrefill.caseTitle);
        }
        if (newCasePrefill.practiceArea) {
          setPracticeArea(newCasePrefill.practiceArea);
        }
        if (newCasePrefill.opponentName) {
          setOpponentName(newCasePrefill.opponentName);
        }
      }
      setCurrentStep(1);
      setIntakeStep(1);
    }
  }, [isOpen, newCasePrefill]);

  // Sub-Category Code (Optional, leave blank if none)
  const [matterSubCode, setMatterSubCode] = useState<string>('L');
  const [customMatterCode, setCustomMatterCode] = useState<string>('');

  // Multi-Partner Selection (Searchable Multi-Select)
  const [selectedPartners, setSelectedPartners] = useState<string[]>(['SH']);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>('');
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState<boolean>(false);
  const partnerDropdownRef = useRef<HTMLDivElement | null>(null);

  // Multi-Lawyer Selection (Searchable Multi-Select, Optional)
  const [selectedLawyers, setSelectedLawyers] = useState<string[]>([]);
  const [lawyerSearchQuery, setLawyerSearchQuery] = useState<string>('');
  const [isLawyerDropdownOpen, setIsLawyerDropdownOpen] = useState<boolean>(false);
  const lawyerDropdownRef = useRef<HTMLDivElement | null>(null);

  const [forum, setForum] = useState('High Court');
  const [suiteNo, setSuiteNo] = useState('WA-22NCvC-402-08/2026');
  
  // Multi-File Handler Selection (Multiple Lawyers / Pupils / Interns / Partners)
  const [assignedHandlers, setAssignedHandlers] = useState<string[]>([]);
  const [handlerSearchQuery, setHandlerSearchQuery] = useState<string>('');
  const [isHandlerDropdownOpen, setIsHandlerDropdownOpen] = useState<boolean>(false);
  const handlerDropdownRef = useRef<HTMLDivElement | null>(null);

  // Click Outside Listener for Dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target as Node)) {
        setIsPartnerDropdownOpen(false);
      }
      if (lawyerDropdownRef.current && !lawyerDropdownRef.current.contains(event.target as Node)) {
        setIsLawyerDropdownOpen(false);
      }
      if (handlerDropdownRef.current && !handlerDropdownRef.current.contains(event.target as Node)) {
        setIsHandlerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleClient = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      if (selectedClientIds.length === 1) {
        showToast('At least one client must be selected for the case file.');
        return;
      }
      setSelectedClientIds(selectedClientIds.filter((id) => id !== clientId));
    } else {
      setSelectedClientIds([...selectedClientIds, clientId]);
    }
  };

  const toggleFileHandler = (name: string) => {
    if (assignedHandlers.includes(name)) {
      setAssignedHandlers(assignedHandlers.filter((h) => h !== name));
    } else {
      setAssignedHandlers([...assignedHandlers, name]);
    }
  };
  // Practice-Specific Form Intake State Variables
  // Conveyancing fields
  const [convTransactionType, setConvTransactionType] = useState('Subsale Sale & Purchase (SPA)');
  const [convPropertyTitleNo, setConvPropertyTitleNo] = useState('');
  const [convPropertyAddress, setConvPropertyAddress] = useState('');
  const [convVendorName, setConvVendorName] = useState('');
  const [convPurchaserName, setConvPurchaserName] = useState('');
  const [convFinancierBank, setConvFinancierBank] = useState('');
  const [convPurchasePrice, setConvPurchasePrice] = useState<number>(0);
  const [convLoanAmount, setConvLoanAmount] = useState<number>(0);
  const [convCustomNotes, setConvCustomNotes] = useState('');

  // Litigation fields
  const [litSuitMatterRefNo, setLitSuitMatterRefNo] = useState('');
  const [litCourtLevel, setLitCourtLevel] = useState('High Court / Mahkamah Tinggi');
  const [litCourtRegistry, setLitCourtRegistry] = useState('Kuala Lumpur');
  const [litOpposingParties, setLitOpposingParties] = useState<string[]>(['1st Defendant: ABC Corp Sdn Bhd']);

  // Criminal fields
  const [crimSuitMatterRefNo, setCrimSuitMatterRefNo] = useState('');
  const [crimCourtLevel, setCrimCourtLevel] = useState('Sessions Court / Mahkamah Sesyen');
  const [crimCourtRegistry, setCrimCourtRegistry] = useState('Kuala Lumpur');
  const [crimOpposingParties, setCrimOpposingParties] = useState<string[]>(['Prosecution / Public Prosecutor (Pendakwa Raya)']);
  const [crimOffenceSection, setCrimOffenceSection] = useState('Penal Code Sec 420 (Cheating)');

  // Syariah fields
  const [syariahCourtLevel, setSyariahCourtLevel] = useState('Mahkamah Tinggi Syariah');
  const [syariahCourtRegistry, setSyariahCourtRegistry] = useState('Gombak');
  const [syariahNoKes, setSyariahNoKes] = useState('');
  const [syariahJenisTuntutan, setSyariahJenisTuntutan] = useState('Perceraian (Fasakh/Talaq) & Harta Sepencarian');
  const [syariahOpposingParties, setSyariahOpposingParties] = useState<string[]>(['Responden: Ahmad Bin Razak']);

  // Corporate fields
  const [corpTransactionType, setCorpTransactionType] = useState(''); // REMAIN BLANK TO FILL UP MANUALLY
  const [corpParties, setCorpParties] = useState<string[]>(['1st Party: ABC Capital Sdn Bhd', '2nd Party: XYZ Holdings Ltd']);
  const [corpTargetEntity, setCorpTargetEntity] = useState('');
  const [corpDealValue, setCorpDealValue] = useState<number>(0);

  // Estate fields
  const [estateSuitMatterRefNo, setEstateSuitMatterRefNo] = useState('');
  const [estateCourtLevel, setEstateCourtLevel] = useState('High Court / Mahkamah Tinggi');
  const [estateCourtRegistry, setEstateCourtRegistry] = useState('Kuala Lumpur');
  const [estateOpposingParties, setEstateOpposingParties] = useState<string[]>(['1st Caveator / Beneficiary: Ahmad Bin Ali']);
  const [estateProceedingType, setEstateProceedingType] = useState('Grant of Probate');
  const [estateDeceasedName, setEstateDeceasedName] = useState('');
  const [estateGrossValue, setEstateGrossValue] = useState<number>(0);

  const [claimAmount, setClaimAmount] = useState<number>(750000);
  const [scope, setScope] = useState('Legal representation in High Court civil action for breach of director fiduciary duties, injunction application, and recovery of damages.');
  const [retainerAmount, setRetainerAmount] = useState<number>(10000);
  const [assignedBankAccountId, setAssignedBankAccountId] = useState<string>(bankAccounts[0]?.id || 'BANK-TRUST-01');
  const [specialTerms, setSpecialTerms] = useState('Initial retainer to be deposited into Syafiqah Hamizad & Co Client Trust Account prior to filing court appearances / initial documentation.');

  // Opposing Solicitors / Law Firm on Record (feeds the Overview tab's Opposing Solicitors Registry)
  const [opposingFirmName, setOpposingFirmName] = useState('');
  const [opposingSolicitorName, setOpposingSolicitorName] = useState('');

  // Signature & PDF State
  const [signerName, setSignerName] = useState('');
  const [signerIc, setSignerIc] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [isSigned, setIsSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Output State
  const [generatedCaseRef, setGeneratedCaseRef] = useState<string>('');
  const [createdCaseId, setCreatedCaseId] = useState<string>('');
  const [warrantText, setWarrantText] = useState<string>('');
  const [isPdfSavedInFolder, setIsPdfSavedInFolder] = useState(false);

  const selectedClients = clients.filter((c) => selectedClientIds.includes(c.id));
  const primaryClient = selectedClients[0] || clients[0];

  // Helper to derive initial from client name
  const deriveClientInitialsFromName = (name: string): string => {
    if (!name) return 'CL';
    const cleaned = name
      .replace(/Sdn Bhd|Bhd|Datuk|Dato'|Dr\.|Encik|Puan|Tan Sri|Syarikat/gi, '')
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return 'CL';
  };

  const cInitials = selectedClients.length > 0
    ? selectedClients.map((c) => deriveClientInitialsFromName(c.name)).join('/')
    : deriveClientInitialsFromName(primaryClient?.name || '');

  // Sync client initials whenever selected client(s) change
  const [clientInitials, setClientInitials] = useState<string>('');

  useEffect(() => {
    if (selectedClients.length > 0) {
      const autoInitials = selectedClients.map((c) => deriveClientInitialsFromName(c.name)).join('/');
      setClientInitials(autoInitials);
    }
  }, [selectedClientIds.join(',')]);

  // File Creation Date picker (calendar dropdown allowing historical backdating)
  const [fileOpeningDate, setFileOpeningDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const fileMonth = fileOpeningDate ? fileOpeningDate.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, '0');
  const fileYear = fileOpeningDate ? fileOpeningDate.slice(0, 4) : String(new Date().getFullYear());

  // Map Practice Area to exact codes: L (Litigation), EST (Estate), CONV, CORP, CR, SY, or Custom
  const getPracticeAreaCode = (area: string): string => {
    try {
      const savedSettings = getPracticeSettings();
      const customAreas = savedSettings.practiceAreas || [];
      const matched = customAreas.find(
        (pa) => pa.name.toLowerCase() === area.toLowerCase() || pa.code.toLowerCase() === area.toLowerCase()
      );
      if (matched) return matched.code.toUpperCase();
    } catch (e) {
      // Fallback to default mapping
    }

    const norm = (area || '').toLowerCase();
    if (norm.includes('litig') || norm.includes('civil') || norm === 'l' || norm === 'lit') return 'L';
    if (norm.includes('estate') || norm.includes('probate') || norm === 'est' || norm === 'ea') return 'EST';
    if (norm.includes('convey') || norm.includes('property') || norm === 'conv') return 'CONV';
    if (norm.includes('corp') || norm === 'corp') return 'CORP';
    if (norm.includes('crim') || norm === 'cr') return 'CR';
    if (norm.includes('syariah') || norm === 'sy') return 'SY';
    return 'L';
  };

  // Get Sub-code options based on practice area
  const normalizePracticeName = (value: string) =>
    (value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[()]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\/commercial/g, '')
      .replace(/civil\s+/g, '')
      .trim();

  const getSubCodeOptions = (area: string): { code: string; label: string }[] => {
    try {
      const configuredCodes = getPracticeSettings().matterCodes || [];
      if (configuredCodes.length > 0) {
        const normalizedArea = normalizePracticeName(area);
        const aliasGroups: Record<string, string[]> = {
          'litigation': ['litigation', 'civil litigation'],
          'civil litigation': ['litigation', 'civil litigation'],
          'conveyancing': ['conveyancing', 'property', 'sale and purchase'],
          'corporate': ['corporate', 'corporate and commercial', 'commercial'],
          'estate administration': ['estate administration', 'probate', 'estate', 'probate and estate'],
          'criminal': ['criminal', 'criminal defence', 'criminal defense'],
          'syariah': ['syariah'],
        };
        const allowedAreas = aliasGroups[normalizedArea] || [normalizedArea];

        const matchingCodes: { code: string; label: string }[] = [];
        const otherRegisteredCodes: { code: string; label: string }[] = [];

        configuredCodes.forEach((matter) => {
          const configuredArea = normalizePracticeName(matter.practiceArea || '');
          const isMatch = allowedAreas.includes(configuredArea) || configuredArea === normalizedArea;
          const labelText = `${matter.code} (${matter.name}${!isMatch && matter.practiceArea ? ` - ${matter.practiceArea}` : ''})`;
          const item = { code: matter.code, label: labelText };
          if (isMatch) {
            matchingCodes.push(item);
          } else {
            otherRegisteredCodes.push(item);
          }
        });

        const combined = [...matchingCodes, ...otherRegisteredCodes];
        const seen = new Set<string>();
        const result: { code: string; label: string }[] = [];
        for (const item of combined) {
          if (!seen.has(item.code)) {
            seen.add(item.code);
            result.push(item);
          }
        }
        if (result.length > 0) return result;
      }
    } catch (e) {
      console.error('Failed to parse registered matter codes:', e);
    }
    const code = getPracticeAreaCode(area);
    switch (code) {
      case 'EST':
        return [
          { code: 'LA', label: 'LA (Letters of Administration)' },
          { code: 'PROB', label: 'PROB (Grant of Probate)' },
          { code: 'VO', label: 'VO (Vesting Order / Valuation)' },
          { code: 'OFS', label: 'OFS (Order for Sale)' },
        ];
      case 'CONV':
        return [
          { code: 'SPA', label: 'SPA (Sale & Purchase Agreement)' },
          { code: 'LOAN', label: 'LOAN (Banking & Facility Agreement)' },
          { code: 'MOT', label: 'MOT (Memorandum of Transfer)' },
          { code: 'DOC', label: 'DOC (Legal Documentation)' },
          { code: 'TENANCY', label: 'TENANCY (Lease / Tenancy Agreement)' },
          { code: 'MISC', label: 'MISC (Conveyancing Misc)' },
        ];
      case 'L':
        return [
          { code: 'L', label: 'L (Civil Litigation)' },
          { code: 'APPEAL', label: 'APPEAL (Court Appeal / Federal Court)' },
          { code: 'EXEC', label: 'EXEC (Execution / Enforcement)' },
        ];
      case 'CR':
        return [
          { code: 'CR', label: 'CR (Criminal Defense)' },
          { code: 'TRIAL', label: 'TRIAL (Criminal Defense Trial)' },
          { code: 'APPEAL', label: 'APPEAL (Criminal Appeal)' },
        ];
      case 'SY':
        return [
          { code: 'SY', label: 'SY (Syariah Dispute)' },
          { code: 'DIVORCE', label: 'DIVORCE (Perceraian / Harta Sepencarian)' },
          { code: 'H', label: 'H (Hadhanah - Hak Jagaan Anak)' },
          { code: 'FARAID', label: 'FARAID (Pembahagian Harta Pusaka)' },
          { code: 'INJ', label: 'INJ (Injunksi Syariah)' },
          { code: 'MISC', label: 'MISC (Syariah Misc)' },
        ];
      case 'CORP':
        return [
          { code: 'CORP', label: 'CORP (Corporate)' },
          { code: 'M&A', label: 'M&A (Mergers & Acquisitions)' },
          { code: 'ADVISORY', label: 'ADVISORY (Regulatory & Advisory)' },
          { code: 'CONTRACT', label: 'CONTRACT (Corporate Contracts)' },
          { code: 'JV', label: 'JV (Joint Venture)' },
        ];
      default:
        return [];
    }
  };

  // Format sequence for multi-selected initials (e.g. SH/ZA) - Syafiqah (SH) is always prioritized first
  const computeInitialsSequence = (list: string[]): string => {
    if (!list || list.length === 0) return '';
    const unique = Array.from(new Set(list));
    unique.sort((a, b) => {
      if (a === 'SH') return -1;
      if (b === 'SH') return 1;
      return 0;
    });
    return unique.join('/');
  };

  const toggleLawyer = (code: string) => {
    if (selectedPartners.includes(code)) {
      showToast('Selected partner cannot also be assigned as lawyer-in-charge.');
      return;
    }
    if (selectedLawyers.includes(code)) {
      setSelectedLawyers(selectedLawyers.filter((l) => l !== code));
    } else {
      setSelectedLawyers([...selectedLawyers, code]);
    }
  };

  // Automated Running No. (e.g. 0001, 0002 based on system cases)
  const autoRunningNo = getNextSequenceId('case');

  // File Month-Year string formatted as MM/YYYY
  const autoMonthYear = `${fileMonth}-${fileYear}`;

  // Format: SHC / Partner / Lawyer or File Handler / Matter Code / Client Initials / Running No. / MM-YYYY
  const partnerPart = computeInitialsSequence(selectedPartners);
  const clientInitialsPart = (clientInitials || cInitials || 'CLIENT').trim().toUpperCase();
  const lawyerCodeSequence = computeInitialsSequence(selectedLawyers);
  const selectedMatterCode = matterSubCode === 'CUSTOM' ? customMatterCode : matterSubCode;
  const selectedLawyerNames = selectedLawyers.map((code) => firmStaffMembers.find((lawyer) => lawyer.code === code)?.name || code);
  const primaryLawyerNames = selectedLawyerNames.length > 0 ? selectedLawyerNames : assignedHandlers;
  const allFileHandlerNames = Array.from(new Set([...primaryLawyerNames, ...assignedHandlers]));

  const generateFileReference = () => [
    'SHC',
    partnerPart,
    lawyerCodeSequence,
    selectedMatterCode.trim().toUpperCase(),
    clientInitialsPart,
    autoRunningNo,
    autoMonthYear,
  ].filter(Boolean).join('/');

  const computedRef = generateFileReference();

  const togglePartner = (code: string) => {
    if (selectedPartners.includes(code)) {
      setSelectedPartners(selectedPartners.filter((p) => p !== code));
    } else {
      const nextPartners = [...selectedPartners, code];
      setSelectedPartners(nextPartners);
      // Remove from lawyer list if present
      if (selectedLawyers.includes(code)) {
        setSelectedLawyers(selectedLawyers.filter((l) => l !== code));
      }
    }
  };

  const getPartnerFullNames = (codes: string[]) => {
    const sequence = computeInitialsSequence(codes);
    const parts = sequence.split('/');
    return parts
      .map((code) => {
        const match = firmStaffMembers.find((l) => l.code === code);
        return match ? `${match.name} (${match.role})` : code;
      })
      .join(', ');
  };

  // Signature Canvas Helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#16223A';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
      setIsSigned(true);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData('');
    setIsSigned(false);
  };

  const handleRegisterCase = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClients.length === 0) {
      showToast('Please select at least one client from the Client Registry first.');
      return;
    }

    if (!caseTitle || !opponentName) {
      showToast('Please enter the case title and opposing party.');
      return;
    }

    if (!selectedMatterCode.trim()) {
      showToast('Please choose a Matter Code before registering the case.');
      return;
    }

    const caseRef = computedRef;
    const caseId = `CASE-${Date.now()}`;

    let practiceIntakeSummary = '';
    const normPA = practiceArea.toLowerCase();
    if (normPA.includes('convey') || normPA.includes('property')) {
      practiceIntakeSummary = `[CONVEYANCING PRACTICE INTAKE]
Category: ${convTransactionType}
Title/Lot: ${convPropertyTitleNo || 'N/A'}
Property Address: ${convPropertyAddress || 'N/A'}
Vendor/Landowner: ${convVendorName || 'N/A'}
Purchaser/Borrower: ${convPurchaserName || 'N/A'}
Financier Bank: ${convFinancierBank || 'N/A'}
Purchase Price: RM ${convPurchasePrice.toLocaleString('en-MY')} | Facility Amount: RM ${convLoanAmount.toLocaleString('en-MY')}
Custom Particulars / Registered System Notes: ${convCustomNotes || 'None'}`;
    } else if (normPA.includes('litig') || normPA.includes('civil')) {
      practiceIntakeSummary = `[CIVIL LITIGATION PRACTICE INTAKE]
Suit Matter Ref No: ${litSuitMatterRefNo || 'N/A'}
Court Forum Level: ${litCourtLevel || 'N/A'}
Court Registry Location: ${litCourtRegistry || 'N/A'}
Opposing Parties / Defendants: ${litOpposingParties.filter(Boolean).join('; ') || 'N/A'}`;
    } else if (normPA.includes('crim')) {
      practiceIntakeSummary = `[CRIMINAL DEFENSE PRACTICE INTAKE]
Suit Matter / Charge Ref No: ${crimSuitMatterRefNo || 'N/A'}
Court Forum Level: ${crimCourtLevel || 'N/A'}
Court Registry Location: ${crimCourtRegistry || 'N/A'}
Prosecution / Opposing Parties / Co-Accused: ${crimOpposingParties.filter(Boolean).join('; ') || 'N/A'}
Offence & Statute Section: ${crimOffenceSection || 'N/A'}`;
    } else if (normPA.includes('syariah')) {
      practiceIntakeSummary = `[SYARIAH PRACTICE INTAKE]
Court Level: ${syariahCourtLevel || 'N/A'}
Court Location / Branch: ${syariahCourtRegistry || 'N/A'}
No. Saman / Kes Syariah: ${syariahNoKes || 'N/A'}
Jenis Tuntutan Syariah: ${syariahJenisTuntutan || 'N/A'}
Pihak Penentang / Responden / Plaintif: ${syariahOpposingParties.filter(Boolean).join('; ') || 'N/A'}`;
    } else if (normPA.includes('corp')) {
      practiceIntakeSummary = `[CORPORATE PRACTICE INTAKE]
Transaction Type: ${corpTransactionType || 'N/A'}
Contracting Parties: ${corpParties.filter(Boolean).join('; ') || 'N/A'}
Target Entity / Company SSM: ${corpTargetEntity || 'N/A'}
Deal Value / Consideration: RM ${corpDealValue.toLocaleString('en-MY')}`;
    } else if (normPA.includes('estate') || normPA.includes('probate')) {
      practiceIntakeSummary = `[ESTATE ADMINISTRATION INTAKE]
Suit Matter Ref No: ${estateSuitMatterRefNo || 'N/A'}
Court Forum Level: ${estateCourtLevel || 'N/A'}
Registry Location: ${estateCourtRegistry || 'N/A'}
Opposing Parties / Caveators / Beneficiaries: ${estateOpposingParties.filter(Boolean).join('; ') || 'N/A'}
Proceeding Type: ${estateProceedingType || 'N/A'}
Deceased Name: ${estateDeceasedName || 'N/A'}
Gross Estate Value: RM ${estateGrossValue.toLocaleString('en-MY')}`;
    }

    const fullScopeWithIntake = `${scope}\n\n${practiceIntakeSummary}`.trim();

    const partnersLabel = getPartnerFullNames(selectedPartners);

    const clientNamesCombined = selectedClients.map((c) => c.name).join(' & ');
    const clientIdsCombined = selectedClients.map((c) => c.id).join(', ');
    const clientContactPersonsCombined = selectedClients
      .map((c) => c.contactPerson || '')
      .filter(Boolean)
      .join(', ');

    const primaryOpposingParty = 
      litOpposingParties[0] || 
      crimOpposingParties[0] || 
      estateOpposingParties[0] || 
      syariahOpposingParties[0] || 
      corpParties[1] || 
      opponentName ||
      'N/A';

    const allOpposingPartiesList = 
      litOpposingParties.length > 0 ? litOpposingParties :
      crimOpposingParties.length > 0 ? crimOpposingParties :
      estateOpposingParties.length > 0 ? estateOpposingParties :
      syariahOpposingParties.length > 0 ? syariahOpposingParties :
      corpParties.length > 0 ? corpParties :
      [opponentName || 'N/A'];

    const activeCourtCaseNo = 
      litSuitMatterRefNo || 
      crimSuitMatterRefNo || 
      estateSuitMatterRefNo || 
      syariahNoKes || 
      suiteNo ||
      'N/A';

    const activeCourtLevel = 
      litCourtLevel || 
      crimCourtLevel || 
      estateCourtLevel || 
      syariahCourtLevel || 
      forum ||
      'N/A';

    // Parse the "Role: Name" intake strings into structured, individually editable roster records
    const opposingPartiesRoster: PartyRecord[] = allOpposingPartiesList.map((entry, idx) => {
      const separatorIdx = entry.indexOf(':');
      const role = separatorIdx > -1 ? entry.slice(0, separatorIdx).trim() : `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Defendant`;
      const name = separatorIdx > -1 ? entry.slice(separatorIdx + 1).trim() : entry.trim();
      return {
        id: `OP-${caseId}-${idx}`,
        name: name || 'Opposing Party',
        role: role || 'Opposing Party',
      };
    });

    const opposingSolicitorsRoster: OpposingSolicitorRecord[] = opposingFirmName.trim()
      ? [
          {
            id: `OSR-${caseId}-primary`,
            partyRepresented: opposingPartiesRoster[0]?.role || 'Opposing Party',
            firmName: opposingFirmName.trim(),
            solicitors: opposingSolicitorName.trim(),
            isPrimary: true,
          },
        ]
      : [];

    if (opposingFirmName.trim()) {
      const trimmedFirm = opposingFirmName.trim();
      const existingFirm = lawFirmRegistry.find((f) => f.firmName.toLowerCase() === trimmedFirm.toLowerCase());
      if (!existingFirm) {
        addLawFirmRegistryEntry({
          id: `LFR-${Date.now()}`,
          firmName: trimmedFirm,
          counsels: opposingSolicitorName.trim()
            ? [{ id: `counsel-${Date.now()}`, name: opposingSolicitorName.trim(), roleTitle: 'Advocate & Solicitor' }]
            : [],
          notes: 'Auto-linked during matter intake registration',
        });
      }
    }

    const docText = `SYAFIQAH HAMIZAD & CO
Advocates & Solicitors • Peguambela & Peguamcara
Level 12, Menara SHCO, Jalan Ampang, 50450 Kuala Lumpur
Email: office@shcolaw.com | Tel: +60 3-2166 8800

================================================================================
OFFICIAL ENGAGEMENT LETTER & WARRANT OF APPOINTMENT TO ACT
================================================================================

DATE OF REGISTRATION: ${new Date().toLocaleDateString('en-GB')}
CASE FILE REFERENCE: ${caseRef}
PARTNER(S) IN CHARGE: ${partnersLabel.toUpperCase()}
COURT / FORUM: ${activeCourtLevel.toUpperCase()}
SUIT / MATTER NO.: ${activeCourtCaseNo}

CLIENT(S) / INSTRUCTING PARTIES:
Name(s): ${clientNamesCombined.toUpperCase()}
Client Initials Code: ${clientInitialsPart}
Client ID(s): ${clientIdsCombined}
Identity / Reg No.: ${clientContactPersonsCombined || 'Registered in Client Registry'}
Email(s): ${selectedClients.map((c) => c.email || 'N/A').join(', ')}
Tel: ${selectedClients.map((c) => c.phone || 'N/A').join(', ')}
Address(es): ${selectedClients.map((c) => c.address || 'N/A').join('; ')}

OPPOSING PARTY / DEFENDANT:
Name: ${primaryOpposingParty.toUpperCase()}

RE: WARRANT OF APPOINTMENT TO ACT AS ADVOCATES & SOLICITORS
MATTER TITLE: ${caseTitle.toUpperCase()}

We refer to your formal registration of instructions with Syafiqah Hamizad & Co on ${new Date().toLocaleDateString('en-GB')}. Syafiqah Hamizad & Co hereby accepts your authorization to act as your advocates and solicitors in respect of the above-captioned legal matter.

1. SCOPE OF LEGAL SERVICES FOR THIS CASE
${scope}

2. LEGAL FEES & RETAINER DEPOSIT
An initial case retainer deposit of RM ${retainerAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })} is required to be remitted to Syafiqah Hamizad & Co Client Trust Account. Professional fees for pleadings, court appearances, and trial representation shall be billed according to progress milestones or scale fee agreements.

3. SPECIAL CASE TERMS & INSTRUCTIONS
${specialTerms}

4. ADVOCATES & PARTNERS IN CHARGE
Lead Partner(s) in Charge: ${partnersLabel}
Lawyer(s) in Charge: ${primaryLawyerNames.join(', ') || 'Unassigned'}
Additional File Handlers: ${assignedHandlers.filter((name) => !primaryLawyerNames.includes(name)).join(', ') || 'None'}

Kindly execute this Engagement Letter & Warrant of Appointment to signify your formal authorization for us to enter appearance and act on your behalf.

Yours faithfully,
SYAFIQAH HAMIZAD & CO.


___________________________
ADVOCATES & SOLICITORS
(Signed on behalf of Syafiqah Hamizad & Co)


CLIENT AUTHORIZATION & ACKNOWLEDGEMENT:
We/I, ${clientNamesCombined.toUpperCase()}, hereby authorize Syafiqah Hamizad & Co to act as my legal counsel in ${caseTitle}.`;

    const newCaseItem: Case = {
      id: caseId,
      ref: caseRef,
      title: caseTitle,
      createdDate: fileOpeningDate || new Date().toISOString().split('T')[0],
      fileOpenedDate: fileOpeningDate || new Date().toISOString().split('T')[0],
      clientName: clientNamesCombined,
      clientId: clientIdsCombined,
      clientsList: selectedClients.map((c) => ({
        id: c.id,
        clientId: c.id,
        name: c.name,
        icNo: c.icNo || c.icNumber || '',
        phone: c.phone || '',
        email: c.email || '',
        role: 'Client / Principal',
      })),
      type: practiceArea,
      practiceArea,
      matterCode: selectedMatterCode || undefined,
      lawyerInCharge: primaryLawyerNames.join(', ') || undefined,
      courtCaseNo: activeCourtCaseNo,
      court: activeCourtLevel,
      judge: 'Presiding Officer / Registrar',
      opposingParty: primaryOpposingParty,
      opposingParties: allOpposingPartiesList,
      opposingPartiesList: opposingPartiesRoster,
      opposingCounsel: opposingSolicitorsRoster.map((r) => r.firmName),
      opposingSolicitorsRegistry: opposingSolicitorsRoster,
      opposingSolicitorsFirm: opposingSolicitorsRoster[0]?.firmName,
      opposingSolicitorsName: opposingSolicitorsRoster[0]?.solicitors,
      partners: selectedPartners,
      lawyers: allFileHandlerNames,
      status: 'Active',
      nextHearing: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      lastAccessed: new Date().toISOString(),
      caseNotes: fullScopeWithIntake,
      hearings: [],
      documents: [],
      courtDiary: [],
      tasks: [],
      serviceRecord: [],
      meetingNotes: [],
      internalNotes: [],
    };

    addCase(newCaseItem);
    incrementSequenceCounter('case');

    // Audit Log for Trust account if retainer > 0 and account selected
    const targetBank = bankAccounts.find((b) => b.id === assignedBankAccountId) || bankAccounts[0];
    if (targetBank && retainerAmount > 0 && targetBank.type === 'TRUST') {
      addTrustAuditLog({
        user: currentUser?.name || 'Syafiqah Hamizad',
        action: `RETAINER DEPOSIT FOR NEW CASE: ${caseRef} (${clientNamesCombined})`,
        bankAccountId: targetBank.id,
        bankAccountName: `${targetBank.bankName} - ${targetBank.accountName} (${targetBank.accountNumber})`,
        amount: retainerAmount,
        accountBalanceAfter: targetBank.currentBalance + retainerAmount,
      });
    }

    setGeneratedCaseRef(caseRef);
    setCreatedCaseId(caseId);
    setWarrantText(docText);
    setSignerName(clientNamesCombined);
    setSignerIc(clientContactPersonsCombined || 'Verified');
    setCurrentStep(2);
    setShowEngagementLetterDoc(false);
    setIsPdfSavedInFolder(false);
    showToast(`New Case Registered Successfully! File Ref: ${caseRef}`);
  };

  const handleSignAndSavePdfToFolder = () => {
    if (!createdCaseId) return;

    // Create a new CaseDocument object
    const newDoc: CaseDocument = {
      id: `DOC-ENG-${Date.now()}`,
      name: `Signed_Engagement_Letter_${generatedCaseRef.replace(/\//g, '_')}.pdf`,
      category: 'Engagement Letters',
      uploadedDate: new Date().toISOString().split('T')[0],
      driveUrl: 'https://drive.google.com/shcolaw/cases/' + generatedCaseRef.replace(/\//g, '_') + '/Engagement_Letter.pdf',
    };

    // Retrieve existing case documents and update in AppContext
    const targetCase = cases.find((c) => c.id === createdCaseId);
    const existingDocs = targetCase?.documents || [];
    updateCase(createdCaseId, {
      documents: [newDoc, ...existingDocs],
    });

    setIsPdfSavedInFolder(true);
    showToast(`Signed Engagement Letter automatically saved to Case File Documents folder!`);

    // Trigger Print / PDF Download dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Engagement Letter - ${generatedCaseRef}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; color: #111; line-height: 1.6; font-size: 13px; }
              h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
              h2 { font-size: 14px; text-align: center; font-weight: normal; margin-top: 0; }
              .signature-box { margin-top: 40px; border-top: 1px dashed #666; padding-top: 20px; }
            </style>
          </head>
          <body>
            <h1>SYAFIQAH HAMIZAD & CO</h1>
            <h2>Advocates & Solicitors • Peguambela & Peguamcara</h2>
            <hr />
            <pre style="white-space: pre-wrap; font-family: inherit;">${warrantText}</pre>
            <div class="signature-box">
              <p><strong>CLIENT SIGNATURE ACKNOWLEDGEMENT:</strong></p>
              <p>Signed By: ${signerName || selectedClients.map((c) => c.name).join(' & ')}</p>
              <p>NRIC / Reg No.: ${signerIc || 'Verified'}</p>
              <p>Date Signed: ${new Date().toLocaleDateString('en-GB')}</p>
              ${signatureData ? `<img src="${signatureData}" style="max-height: 80px; margin-top: 10px;" />` : '<p>[Digitally Executed Signature on File]</p>'}
            </div>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleResetModal = () => {
    setCurrentStep(1);
    setIntakeStep(1);
    setShowEngagementLetterDoc(false);
    setIsPdfSavedInFolder(false);
    if (setNewCasePrefill) setNewCasePrefill(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#16223A]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 border border-[#E1DCCF] max-h-[92vh] flex flex-col my-auto overflow-hidden text-xs">
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#16223A] text-amber-300 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#16223A]">Case Intake & Registration</h3>
              <p className="text-[11px] text-slate-500">Register matter details, assign partners, &amp; generate PDF Engagement Letter</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetModal}
            className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Header - Fixed Top */}
        <div className="grid grid-cols-2 gap-3 text-center text-xs font-bold py-2 shrink-0">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 ${
              currentStep === 1
                ? 'bg-[#16223A] text-amber-300 border-[#16223A]'
                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>1. Register Case Particulars</span>
          </div>
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 ${
              currentStep === 2
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]">
              2
            </span>
            <span>2. Engagement Letter &amp; PDF Sign-off</span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-3.5">

        {/* STEP 1: Case Intake Registration Form with Interactive Stepper */}
        {currentStep === 1 && (
          <form onSubmit={handleRegisterCase} className="space-y-3 text-xs">
            {/* Intake Form Stepper Header Bar */}
            <div className="bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl p-2 shadow-2xs">
              <div className="flex items-center justify-between gap-1 overflow-x-auto text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setIntakeStep(1)}
                  className={`flex-1 min-w-[120px] p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    intakeStep === 1
                      ? 'bg-[#16223A] text-amber-300 border-[#16223A] shadow-xs'
                      : intakeStep > 1
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      intakeStep === 1 ? 'bg-amber-400 text-[#16223A]' : intakeStep > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {intakeStep > 1 ? '✓' : '1'}
                    </span>
                    <span className="truncate">1. Client & Practice</span>
                  </div>
                </button>

                <div className="text-slate-300 text-xs shrink-0">›</div>

                <button
                  type="button"
                  onClick={() => setIntakeStep(2)}
                  className={`flex-1 min-w-[120px] p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    intakeStep === 2
                      ? 'bg-[#16223A] text-amber-300 border-[#16223A] shadow-xs'
                      : intakeStep > 2
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      intakeStep === 2 ? 'bg-amber-400 text-[#16223A]' : intakeStep > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {intakeStep > 2 ? '✓' : '2'}
                    </span>
                    <span className="truncate">2. Handlers & Ref</span>
                  </div>
                </button>

                <div className="text-slate-300 text-xs shrink-0">›</div>

                <button
                  type="button"
                  onClick={() => setIntakeStep(3)}
                  className={`flex-1 min-w-[120px] p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    intakeStep === 3
                      ? 'bg-[#16223A] text-amber-300 border-[#16223A] shadow-xs'
                      : intakeStep > 3
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      intakeStep === 3 ? 'bg-amber-400 text-[#16223A]' : intakeStep > 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {intakeStep > 3 ? '✓' : '3'}
                    </span>
                    <span className="truncate">3. Practice Intake</span>
                  </div>
                </button>

                <div className="text-slate-300 text-xs shrink-0">›</div>

                <button
                  type="button"
                  onClick={() => setIntakeStep(4)}
                  className={`flex-1 min-w-[120px] p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    intakeStep === 4
                      ? 'bg-[#16223A] text-amber-300 border-[#16223A] shadow-xs'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      intakeStep === 4 ? 'bg-amber-400 text-[#16223A]' : 'bg-slate-200 text-slate-600'
                    }`}>
                      4
                    </span>
                    <span className="truncate">4. Terms & Retainer</span>
                  </div>
                </button>
              </div>

              {/* Progress Bar Line */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-[#A9814A] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(intakeStep / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* INTAKE SUB-STEP 1: Client Selection & Practice Area */}
            {intakeStep === 1 && (
              <div className="space-y-3.5">
                <div className="p-3.5 bg-[#16223A] border border-[#A9814A]/60 rounded-xl text-white space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="font-bold text-amber-300 block uppercase text-[10px] tracking-wider">1. Choose Practice Area *</label>
                  <p className="text-[11px] text-slate-300 mt-0.5">The intake fields and Matter Code will follow this selection.</p>
                </div>
                <select
                  value={practiceArea}
                  onChange={(e) => {
                    setPracticeArea(e.target.value);
                    setMatterSubCode('');
                    setCustomMatterCode('');
                  }}
                  className="w-52 text-xs p-2 bg-white border border-amber-300 rounded-lg font-bold text-[#16223A]"
                >
                  <option value="Civil Litigation">Litigation</option>
                  <option value="Conveyancing">Conveyancing</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Criminal">Criminal</option>
                  <option value="Syariah">Syariah</option>
                  <option value="Estate Administration">Estate Administration</option>
                </select>
              </div>
            </div>
            {clients.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                <p className="text-amber-900 font-bold">No Registered Clients in Client Registry</p>
                <p className="text-slate-600 text-[11px]">
                  Please register a client profile first in the Client Registry before creating a case file.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleResetModal();
                    setCurrentView('clients');
                  }}
                  className="px-3 py-1.5 bg-[#16223A] text-amber-300 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Go to Client Registry</span>
                </button>
              </div>
            ) : (
              <div className="relative" ref={clientDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-slate-700 uppercase">Select Registered Client(s) *</label>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#16223A] text-amber-300">
                      {selectedClientIds.length} Selected
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleResetModal();
                      setCurrentView('clients');
                    }}
                    className="text-[11px] text-blue-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Manage Clients in Registry</span>
                  </button>
                </div>

                {/* Selected Client Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedClients.map((client) => (
                    <span
                      key={client.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-[#16223A] border border-amber-300 rounded-lg text-xs font-bold shadow-2xs"
                    >
                      <span>{client.name}</span>
                      <span className="text-[10px] font-mono text-amber-800 bg-amber-200/60 px-1 rounded">
                        {client.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleClient(client.id)}
                        className="text-amber-800 hover:text-red-700 hover:bg-amber-200/80 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Remove client"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Search & Toggle Input Bar */}
                <div
                  className="relative flex items-center bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg focus-within:ring-2 focus-within:ring-[#A9814A] cursor-pointer"
                  onClick={() => setIsClientDropdownOpen(true)}
                >
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    placeholder="Search client registry by name, ID, or company..."
                    className="w-full text-xs pl-8 pr-8 py-2 bg-transparent focus:outline-none text-[#16223A] font-medium"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsClientDropdownOpen(!isClientDropdownOpen);
                    }}
                    className="absolute right-2 text-slate-400 hover:text-slate-700 p-1 rounded-md"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Options List */}
                {isClientDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1DCCF] rounded-xl shadow-lg z-30 max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const filtered = clients.filter(
                        (c) =>
                          c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          (c.contactPerson && c.contactPerson.toLowerCase().includes(clientSearchQuery.toLowerCase())) ||
                          (c.type && c.type.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="p-3 text-center text-slate-500 text-xs">
                            <p>No registered clients found matching "{clientSearchQuery}"</p>
                            {clientSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setClientSearchQuery('')}
                                className="mt-1 text-[11px] text-blue-700 font-bold hover:underline"
                              >
                                Show All Clients ({clients.length})
                              </button>
                            )}
                          </div>
                        );
                      }

                      return filtered.map((c) => {
                        const isSelected = selectedClientIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              toggleClient(c.id);
                              setClientSearchQuery('');
                            }}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-50/70 hover:bg-amber-100/70 text-[#16223A]'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{c.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                                  {c.id}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {c.type} {c.contactPerson ? `• ${c.contactPerson}` : ''}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-[#16223A] text-amber-300'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>+ Select</span>
                              )}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Controls for Intake Sub-Step 1 */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetModal}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedClientIds.length === 0) {
                    showToast('Please select at least one registered client.', 'error');
                    return;
                  }
                  setIntakeStep(2);
                }}
                className="px-5 py-2.5 bg-[#16223A] text-amber-300 hover:bg-[#203050] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Next: Handlers &amp; File Reference</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* INTAKE SUB-STEP 2: Handlers, Matter Code & File Ref */}
        {intakeStep === 2 && (
          <div className="space-y-3.5">
            {/* PARTNER-IN-CHARGE & LAWYER-IN-CHARGE SELECTION & FILE REF DISPLAY */}
            <div className="p-3.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#E1DCCF]">
                <span className="font-bold text-[#16223A] text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                  Generated File Reference Code
                </span>
                <span className="text-xs font-mono font-extrabold bg-[#16223A] text-amber-300 px-3 py-1 rounded-lg shadow-xs">
                  {computedRef}
                </span>
              </div>

              {/* Partner(s) in Charge Selection (Searchable Multi-Select) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block text-[10px] uppercase">
                    Partner(s) in Charge
                  </label>
                </div>

                {/* Selected Partner Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedPartners.map((code) => {
                    const match = firmStaffMembers.find((l) => l.code === code);
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#16223A] text-amber-300 rounded-lg text-xs font-bold shadow-2xs border border-[#16223A]"
                      >
                        <span>{code}</span>
                        <span className="text-[10.5px] text-slate-300 font-normal">
                          ({match ? match.name : code})
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePartner(code)}
                          className="ml-1 text-amber-300/80 hover:text-white cursor-pointer font-bold text-sm"
                          title="Remove partner"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {selectedPartners.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-200">
                      Optional: No partner selected
                    </span>
                  )}
                </div>

                {/* Search Input & Dynamic Dropdown for Partners */}
                <div className="relative" ref={partnerDropdownRef}>
                  <div
                    onClick={() => setIsPartnerDropdownOpen((prev) => !prev)}
                    className="flex items-center bg-white border border-[#E1DCCF] rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#16223A] cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={partnerSearchQuery}
                      onChange={(e) => {
                        setPartnerSearchQuery(e.target.value);
                        setIsPartnerDropdownOpen(true);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPartnerDropdownOpen(true);
                      }}
                      onFocus={() => setIsPartnerDropdownOpen(true)}
                      placeholder="Search or click to view partners (e.g. Syafiqah, SH)..."
                      className="w-full text-xs outline-hidden text-[#16223A] placeholder:text-slate-400 font-medium cursor-pointer"
                    />
                    {partnerSearchQuery ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPartnerSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                        title="Clear search"
                      >
                        ×
                      </button>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer" />
                    )}
                  </div>

                  {/* Partner Dropdown Options */}
                  {isPartnerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1DCCF] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {(() => {
                        const filtered = dynamicPartnerOptions.filter(
                          (l) => !selectedLawyers.includes(l.code)
                        ).filter(
                          (l) =>
                            l.name.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
                            l.code.toLowerCase().includes(partnerSearchQuery.toLowerCase()) ||
                            l.role.toLowerCase().includes(partnerSearchQuery.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-slate-500">
                              <p>No partner matching "{partnerSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => setPartnerSearchQuery('')}
                                className="mt-1 text-amber-800 font-bold hover:underline cursor-pointer"
                              >
                                Show All Partners
                              </button>
                            </div>
                          );
                        }

                        return filtered.map((partner) => {
                          const isSelected = selectedPartners.includes(partner.code);
                          return (
                            <button
                              key={partner.code}
                              type="button"
                              onClick={() => {
                                togglePartner(partner.code);
                                setPartnerSearchQuery('');
                              }}
                              className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-50/70 text-[#16223A]'
                                  : 'hover:bg-[#FAF8F2] text-[#16223A]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold px-1.5 py-0.5 bg-[#16223A] text-amber-300 rounded text-[10px]">
                                  {partner.code}
                                </span>
                                <span className="font-bold">{partner.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal">({partner.role})</span>
                              </div>
                              {isSelected ? (
                                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                  ✓ Added
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-800 font-bold hover:underline">
                                  + Select
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

              {/* Lawyer(s) in Charge Selection (Excludes Partners Strictly) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block text-[10px] uppercase">
                    Lawyer(s) in Charge
                  </label>
                </div>

                {/* Selected Lawyer Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedLawyers.map((code) => {
                    const match = firmStaffMembers.find((l) => l.code === code);
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#16223A] text-amber-300 rounded-lg text-xs font-bold shadow-2xs border border-[#16223A]"
                      >
                        <span>{code}</span>
                        <span className="text-[10.5px] text-slate-300 font-normal">
                          ({match ? match.name : code})
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleLawyer(code)}
                          className="ml-1 text-amber-300/80 hover:text-white cursor-pointer font-bold text-sm"
                          title="Remove lawyer"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {selectedLawyers.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-200">
                      Optional: No lawyer selected
                    </span>
                  )}
                </div>

                {/* Search Input & Dynamic Dropdown for Lawyers */}
                <div className="relative" ref={lawyerDropdownRef}>
                  <div
                    onClick={() => setIsLawyerDropdownOpen((prev) => !prev)}
                    className="flex items-center bg-white border border-[#E1DCCF] rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#16223A] cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={lawyerSearchQuery}
                      onChange={(e) => {
                        setLawyerSearchQuery(e.target.value);
                        setIsLawyerDropdownOpen(true);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLawyerDropdownOpen(true);
                      }}
                      onFocus={() => setIsLawyerDropdownOpen(true)}
                      placeholder="Search or click to view lawyers (e.g. Nurman, NM)..."
                      className="w-full text-xs outline-hidden text-[#16223A] placeholder:text-slate-400 font-medium cursor-pointer"
                    />
                    {lawyerSearchQuery ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLawyerSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                        title="Clear search"
                      >
                        ×
                      </button>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer" />
                    )}
                  </div>

                  {/* Dropdown Options List */}
                  {isLawyerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1DCCF] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {(() => {
                        const filtered = dynamicLawyerOptions.filter(
                          (l) => !selectedPartners.includes(l.code)
                        ).filter(
                          (l) =>
                            l.name.toLowerCase().includes(lawyerSearchQuery.toLowerCase()) ||
                            l.code.toLowerCase().includes(lawyerSearchQuery.toLowerCase()) ||
                            l.role.toLowerCase().includes(lawyerSearchQuery.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-slate-500">
                              <p>No non-partner lawyer matching "{lawyerSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => setLawyerSearchQuery('')}
                                className="mt-1 text-blue-800 font-bold hover:underline cursor-pointer"
                              >
                                Show All Lawyers
                              </button>
                            </div>
                          );
                        }

                        return filtered.map((lawyer) => {
                          const isSelected = selectedLawyers.includes(lawyer.code);
                          return (
                            <button
                              key={lawyer.code}
                              type="button"
                              onClick={() => {
                                toggleLawyer(lawyer.code);
                                setLawyerSearchQuery('');
                              }}
                              className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50/70 text-[#16223A]'
                                  : 'hover:bg-[#FAF8F2] text-[#16223A]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold px-1.5 py-0.5 bg-[#16223A] text-amber-300 rounded text-[10px]">
                                  {lawyer.code}
                                </span>
                                <span className="font-bold">{lawyer.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal">({lawyer.role})</span>
                              </div>
                              {isSelected ? (
                                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                  ✓ Added
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-800 font-bold hover:underline">
                                  + Select
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

              {/* Matter, Client Initials, Running No & File Opening Date Picker */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="hidden">
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Practice Area *</label>
                  <select
                    value={practiceArea}
                    onChange={(e) => {
                      setPracticeArea(e.target.value);
                      setMatterSubCode('');
                      setCustomMatterCode('');
                    }}
                    className="w-full text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg font-bold text-[#16223A]"
                  >
                    <option value="Civil Litigation">Litigation (L)</option>
                    <option value="Conveyancing">Conveyancing (CONV)</option>
                    <option value="Corporate">Corporate (CORP)</option>
                    <option value="Criminal">Criminal (CR)</option>
                    <option value="Syariah">Syariah (SY)</option>
                    <option value="Estate Administration">Estate Administration (EST)</option>
                    {(() => {
                      try {
                        const saved = getPracticeSettings();
                        const defaultNames = ['civil litigation', 'conveyancing', 'corporate', 'criminal', 'syariah', 'estate administration'];
                        const customAreas = (saved.practiceAreas || []).filter((pa) => !defaultNames.includes(pa.name.toLowerCase()));
                        return customAreas.map((pa) => (
                          <option key={pa.id} value={pa.name}>
                            {pa.name} ({pa.code})
                          </option>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Matter Code *</label>
                  <select
                    required
                    value={matterSubCode}
                    onChange={(e) => setMatterSubCode(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg font-mono font-bold text-[#16223A]"
                  >
                    <option value="">Select code</option>
                    {getSubCodeOptions(practiceArea).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code} - {option.label.replace(`${option.code} (`, '').replace(/\)$/, '')}
                      </option>
                    ))}
                    <option value="CUSTOM">CUSTOM - Enter below</option>
                  </select>
                  {matterSubCode === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. JV, PTP, ADJ"
                      value={customMatterCode}
                      onChange={(e) => setCustomMatterCode(e.target.value.toUpperCase())}
                      className="w-full mt-2 text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg font-mono font-bold text-[#16223A]"
                    />
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">
                    Client Initials *
                  </label>
                  <input
                    type="text"
                    value={clientInitials}
                    onChange={(e) => setClientInitials(e.target.value.toUpperCase())}
                    placeholder="e.g. QAL, ANG, TAK"
                    className="w-full text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg font-mono font-bold text-[#16223A] uppercase focus:ring-2 focus:ring-[#A9814A] focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5 truncate" title={`Auto from ${selectedClients.map((c) => c.name).join(', ')}`}>
                    Auto: {cInitials}
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">
                    Running No. <span className="text-emerald-700 font-normal">(Auto)</span>
                  </label>
                  <div className="w-full text-xs p-2 bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-[#16223A] flex items-center justify-between">
                    <span>{autoRunningNo}</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">
                    Open File Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={fileOpeningDate}
                    onChange={(e) => setFileOpeningDate(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg font-mono font-bold text-[#16223A] focus:ring-2 focus:ring-[#A9814A] cursor-pointer"
                    title="Select open file date (auto-sets month/year code)"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                    Ref Code Date: {autoMonthYear}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Multi-Select Assigned File Handler(s) / In-Charge */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block text-[10px] uppercase">
                    Assigned File Handler(s) / In-Charge
                  </label>
                </div>

                {/* Selected File Handler Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {assignedHandlers.map((handler) => (
                    <span
                      key={handler}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#16223A] text-amber-300 rounded-lg text-xs font-bold shadow-2xs border border-[#16223A]"
                    >
                      <span>{handler}</span>
                      <button
                        type="button"
                        onClick={() => toggleFileHandler(handler)}
                        className="ml-1 text-amber-300/80 hover:text-white cursor-pointer font-bold text-sm"
                        title="Remove handler"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {assignedHandlers.length === 0 && (
                    <span className="text-[11px] text-amber-800 italic bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      No handler selected. Pick at least one member in charge.
                    </span>
                  )}
                </div>

                {/* Handler Search Input & Dropdown */}
                <div className="relative" ref={handlerDropdownRef}>
                  <div
                    onClick={() => setIsHandlerDropdownOpen((prev) => !prev)}
                    className="flex items-center bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#16223A] cursor-pointer"
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
                      placeholder="Search or click to view members (e.g. Syafiqah, Siti Yasmin)..."
                      className="w-full text-xs outline-hidden text-[#16223A] placeholder:text-slate-400 font-medium bg-transparent cursor-pointer"
                    />
                    {handlerSearchQuery ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHandlerSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                        title="Clear search"
                      >
                        ×
                      </button>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer" />
                    )}
                  </div>

                  {/* Handler Dropdown Options */}
                  {isHandlerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E1DCCF] rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {(() => {
                        const filtered = dynamicStaffOptions.filter(
                          (s) =>
                            s.name.toLowerCase().includes(handlerSearchQuery.toLowerCase()) ||
                            s.role.toLowerCase().includes(handlerSearchQuery.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-slate-500">
                              <p>No member matching "{handlerSearchQuery}"</p>
                              <button
                                type="button"
                                onClick={() => setHandlerSearchQuery('')}
                                className="mt-1 text-blue-800 font-bold hover:underline cursor-pointer"
                              >
                                Show All Members
                              </button>
                            </div>
                          );
                        }

                        return filtered.map((staff) => {
                          const isSelected = assignedHandlers.includes(staff.name);
                          return (
                            <button
                              key={staff.name}
                              type="button"
                              onClick={() => {
                                toggleFileHandler(staff.name);
                                setHandlerSearchQuery('');
                              }}
                              className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected ? 'bg-amber-50/70 text-[#16223A]' : 'hover:bg-[#FAF8F2] text-[#16223A]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{staff.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal">({staff.role})</span>
                              </div>
                              {isSelected ? (
                                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                  ✓ Selected
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-800 font-bold hover:underline">
                                  + Select
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
            </div>

            {/* Navigation Controls for Intake Sub-Step 2 */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIntakeStep(1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Client Selection</span>
              </button>
              <button
                type="button"
                onClick={() => setIntakeStep(3)}
                className="px-5 py-2.5 bg-[#16223A] text-amber-300 hover:bg-[#203050] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Next: Practice Intake Particulars</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* INTAKE SUB-STEP 3: Case Title & Practice-Specific Particulars */}
        {intakeStep === 3 && (
          <div className="space-y-3.5">
            <div>
              <label className="font-bold text-slate-700 block uppercase mb-1">Case / Matter Title *</label>
              <input
                type="text"
                required
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                placeholder="e.g. Ahmad Bin Abdullah v. Syarikat Property Sdn Bhd"
                className="w-full text-xs p-2 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg font-bold text-[#16223A]"
              />
            </div>

            {/* DYNAMIC PRACTICE AREA INTAKE FORM */}
            {(() => {
              const norm = practiceArea.toLowerCase();

              // Helper for Multiple Opposing Parties Manager
              const renderOpposingPartiesManager = (
                partiesList: string[],
                setPartiesList: React.Dispatch<React.SetStateAction<string[]>>,
                label: string = 'Opposing Party / Defendant (Multiple Allowed)'
              ) => (
                <div className="sm:col-span-2 space-y-2 bg-white/60 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block text-[10px] uppercase">
                      {label}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPartiesList([
                          ...partiesList,
                          `${partiesList.length + 1}${
                            partiesList.length === 0 ? 'st' : partiesList.length === 1 ? 'nd' : partiesList.length === 2 ? 'rd' : 'th'
                          } Party / Defendant: `,
                        ])
                      }
                      className="text-[10px] bg-[#16223A] text-amber-300 font-bold px-2 py-0.5 rounded flex items-center gap-1 hover:bg-[#203050]"
                    >
                      + Add Party
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {partiesList.map((party, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={party}
                          onChange={(e) => {
                            const updated = [...partiesList];
                            updated[idx] = e.target.value;
                            setPartiesList(updated);
                          }}
                          placeholder={`e.g. ${idx + 1}st Defendant / Opposing Party Name`}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-[#16223A] font-medium"
                        />
                        {partiesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPartiesList(partiesList.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
                            title="Remove Party"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );

              // 1. CONVEYANCING INTAKE
              if (norm.includes('convey') || norm.includes('property')) {
                return (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-700 text-white rounded-md font-bold text-xs">CONV</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Conveyancing Practice Intake Form</h4>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                        Property &amp; SPA Particulars
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Transaction Category *</label>
                        <select
                          value={convTransactionType}
                          onChange={(e) => setConvTransactionType(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="Subsale Sale & Purchase (SPA)">Subsale Sale &amp; Purchase (SPA)</option>
                          <option value="Direct Developer Purchase (Schedule H/G)">Direct Developer Purchase (Schedule H/G)</option>
                          <option value="Banking Loan & Facility Agreement">Banking Loan &amp; Facility Agreement</option>
                          <option value="Perfection of Charge & MOT">Perfection of Charge &amp; MOT</option>
                          <option value="Discharge of Charge & Deed of Reassignment">Discharge of Charge &amp; Deed of Reassignment</option>
                          <option value="Tenancy & Commercial Lease Agreement">Tenancy &amp; Commercial Lease Agreement</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Title / Lot No. &amp; Mukim / State</label>
                        <input
                          type="text"
                          value={convPropertyTitleNo}
                          onChange={(e) => setConvPropertyTitleNo(e.target.value)}
                          placeholder="e.g. Geran 12345, Lot 88, Mukim Ampang, KL"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Property Address</label>
                        <input
                          type="text"
                          value={convPropertyAddress}
                          onChange={(e) => setConvPropertyAddress(e.target.value)}
                          placeholder="e.g. Unit 12-03, Residensi Park, Jalan Ampang, Kuala Lumpur"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Vendor / Landowner Name</label>
                        <input
                          type="text"
                          value={convVendorName}
                          onChange={(e) => setConvVendorName(e.target.value)}
                          placeholder="e.g. Tan Ah Kow / Developer Corp"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Purchaser / Borrower Name</label>
                        <input
                          type="text"
                          value={convPurchaserName}
                          onChange={(e) => setConvPurchaserName(e.target.value)}
                          placeholder="e.g. Ahmad Bin Ali & Anor"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Financier / End Financier Bank</label>
                        <input
                          type="text"
                          value={convFinancierBank}
                          onChange={(e) => setConvFinancierBank(e.target.value)}
                          placeholder="e.g. Maybank Islamic Berhad / CIMB Bank"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Purchase Price (RM)</label>
                          <input
                            type="number"
                            value={convPurchasePrice}
                            onChange={(e) => setConvPurchasePrice(Number(e.target.value))}
                            placeholder="500000"
                            className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Loan Amount (RM)</label>
                          <input
                            type="number"
                            value={convLoanAmount}
                            onChange={(e) => setConvLoanAmount(Number(e.target.value))}
                            placeholder="450000"
                            className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">
                          Custom Particulars &amp; Registered System Notes
                        </label>
                        <textarea
                          rows={2}
                          value={convCustomNotes}
                          onChange={(e) => setConvCustomNotes(e.target.value)}
                          placeholder="Enter any custom property details, state consent conditions, redemption numbers, or specific registered system particulars..."
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-[#16223A]"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // 2. CIVIL COURT LITIGATION INTAKE
              if (norm.includes('litig') || norm.includes('civil')) {
                return (
                  <div className="p-3.5 bg-blue-50/80 border border-blue-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#16223A] text-amber-300 rounded-md font-bold text-xs">LIT</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Civil Court Litigation Intake Form</h4>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                        Court Action Particulars
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Suit Matter Reference No. *</label>
                        <input
                          type="text"
                          value={litSuitMatterRefNo}
                          onChange={(e) => setLitSuitMatterRefNo(e.target.value)}
                          placeholder="e.g. WA-22NCvC-123-08/2026"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Forum Level *</label>
                        <select
                          value={litCourtLevel}
                          onChange={(e) => setLitCourtLevel(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="High Court / Mahkamah Tinggi">High Court / Mahkamah Tinggi</option>
                          <option value="Sessions Court / Mahkamah Sesyen">Sessions Court / Mahkamah Sesyen</option>
                          <option value="Magistrates Court / Mahkamah Majistret">Magistrates Court / Mahkamah Majistret</option>
                          <option value="Court of Appeal / Mahkamah Rayuan">Court of Appeal / Mahkamah Rayuan</option>
                          <option value="Federal Court / Mahkamah Persekutuan">Federal Court / Mahkamah Persekutuan</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Registry Location *</label>
                        <input
                          type="text"
                          value={litCourtRegistry}
                          onChange={(e) => setLitCourtRegistry(e.target.value)}
                          placeholder="e.g. Kuala Lumpur, Shah Alam, Johor Bahru, Penang, Ipoh"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      {renderOpposingPartiesManager(
                        litOpposingParties,
                        setLitOpposingParties,
                        'Opposing Party / Defendant (Allow Multiple Opposing Parties)'
                      )}
                    </div>
                  </div>
                );
              }

              // 3. CRIMINAL DEFENSE INTAKE
              if (norm.includes('crim')) {
                return (
                  <div className="p-3.5 bg-rose-50/80 border border-rose-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-rose-800 text-white rounded-md font-bold text-xs">CRIM</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Criminal Defense Intake Form</h4>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded font-mono font-bold">
                        Charge Sheet &amp; Court Forum
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Suit Matter / Charge Reference No.</label>
                        <input
                          type="text"
                          value={crimSuitMatterRefNo}
                          onChange={(e) => setCrimSuitMatterRefNo(e.target.value)}
                          placeholder="e.g. Court Suit Ref / IP-88231 / Charge No. 83"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Forum Level *</label>
                        <select
                          value={crimCourtLevel}
                          onChange={(e) => setCrimCourtLevel(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="Sessions Court / Mahkamah Sesyen">Sessions Court / Mahkamah Sesyen</option>
                          <option value="Magistrates Court / Mahkamah Majistret">Magistrates Court / Mahkamah Majistret</option>
                          <option value="High Court / Mahkamah Tinggi">High Court / Mahkamah Tinggi</option>
                          <option value="Court of Appeal / Mahkamah Rayuan">Court of Appeal / Mahkamah Rayuan</option>
                          <option value="Federal Court / Mahkamah Persekutuan">Federal Court / Mahkamah Persekutuan</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Registry Location *</label>
                        <input
                          type="text"
                          value={crimCourtRegistry}
                          onChange={(e) => setCrimCourtRegistry(e.target.value)}
                          placeholder="e.g. Kuala Lumpur, Shah Alam, Kajang"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      {renderOpposingPartiesManager(
                        crimOpposingParties,
                        setCrimOpposingParties,
                        'Prosecution / Complainant / Co-Accused (Multiple Allowed)'
                      )}

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Offence &amp; Statute Section *</label>
                        <input
                          type="text"
                          value={crimOffenceSection}
                          onChange={(e) => setCrimOffenceSection(e.target.value)}
                          placeholder="e.g. Penal Code Sec 420 (Cheating) / MACC Act Sec 17(a)"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // 4. SYARIAH COURT INTAKE
              if (norm.includes('syariah')) {
                return (
                  <div className="p-3.5 bg-purple-50/80 border border-purple-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-800 text-white rounded-md font-bold text-xs">SYARIAH</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Borang Pendaftaran Kes Syariah</h4>
                      </div>
                      <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                        Mahkamah &amp; Tuntutan Syariah
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Level *</label>
                        <select
                          value={syariahCourtLevel}
                          onChange={(e) => setSyariahCourtLevel(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="Mahkamah Rendah Syariah">Mahkamah Rendah Syariah</option>
                          <option value="Mahkamah Tinggi Syariah">Mahkamah Tinggi Syariah</option>
                          <option value="Mahkamah Rayuan Syariah">Mahkamah Rayuan Syariah</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Which Court Location (Manually Entered) *</label>
                        <input
                          type="text"
                          value={syariahCourtRegistry}
                          onChange={(e) => setSyariahCourtRegistry(e.target.value)}
                          placeholder="e.g. Gombak, Kuala Lumpur, Shah Alam, Bangi, Hulu Langat"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">No. Saman / Kes Syariah *</label>
                        <input
                          type="text"
                          value={syariahNoKes}
                          onChange={(e) => setSyariahNoKes(e.target.value)}
                          placeholder="e.g. 10001-054-0129-2026"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Jenis Tuntutan Syariah *</label>
                        <input
                          type="text"
                          value={syariahJenisTuntutan}
                          onChange={(e) => setSyariahJenisTuntutan(e.target.value)}
                          placeholder="e.g. Perceraian, Hadhanah (Hak Jagaan), Harta Sepencarian, Faraid"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      {renderOpposingPartiesManager(
                        syariahOpposingParties,
                        setSyariahOpposingParties,
                        'Pihak Penentang / Responden / Plaintif (Multiple Allowed)'
                      )}
                    </div>
                  </div>
                );
              }

              // 5. CORPORATE PRACTICE INTAKE
              if (norm.includes('corp')) {
                return (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-800 text-white rounded-md font-bold text-xs">CORP</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Corporate Practice Intake Form</h4>
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                        Transaction &amp; Contracting Parties
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">
                          Corporate Transaction Type (Fill Up Manually)
                        </label>
                        <input
                          type="text"
                          value={corpTransactionType}
                          onChange={(e) => setCorpTransactionType(e.target.value)}
                          placeholder="Fill up manually e.g. M&A Share Sale Agreement, JV, Tech License..."
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-[#16223A] font-bold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Target Entity / Company Name (SSM No)</label>
                        <input
                          type="text"
                          value={corpTargetEntity}
                          onChange={(e) => setCorpTargetEntity(e.target.value)}
                          placeholder="e.g. Global Tech Solutions Sdn Bhd (20220109283)"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      {renderOpposingPartiesManager(
                        corpParties,
                        setCorpParties,
                        'Contracting Parties (1st Party, 2nd Party - Multiple Allowed)'
                      )}

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Transaction Value / Consideration (RM)</label>
                        <input
                          type="number"
                          value={corpDealValue}
                          onChange={(e) => setCorpDealValue(Number(e.target.value))}
                          placeholder="2000000"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // 6. ESTATE ADMINISTRATION INTAKE
              if (norm.includes('estate') || norm.includes('probate')) {
                return (
                  <div className="p-3.5 bg-stone-50/90 border border-stone-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-stone-800 text-white rounded-md font-bold text-xs">EST</span>
                        <h4 className="font-bold text-[#16223A] text-xs uppercase">Estate Administration Intake Form</h4>
                      </div>
                      <span className="text-[10px] bg-stone-200 text-stone-900 border border-stone-300 px-2 py-0.5 rounded font-mono font-bold">
                        Probate &amp; Court Forum
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Suit Matter Reference No.</label>
                        <input
                          type="text"
                          value={estateSuitMatterRefNo}
                          onChange={(e) => setEstateSuitMatterRefNo(e.target.value)}
                          placeholder="e.g. WA-24NCvC-88-2026"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Court Forum Level *</label>
                        <select
                          value={estateCourtLevel}
                          onChange={(e) => setEstateCourtLevel(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="High Court / Mahkamah Tinggi">High Court / Mahkamah Tinggi</option>
                          <option value="JKPT Land Office / Pejabat Tanah (Small Estate)">JKPT Land Office / Pejabat Tanah (Small Estate)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Registry Location *</label>
                        <input
                          type="text"
                          value={estateCourtRegistry}
                          onChange={(e) => setEstateCourtRegistry(e.target.value)}
                          placeholder="e.g. Kuala Lumpur, Shah Alam, Johor Bahru"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      {renderOpposingPartiesManager(
                        estateOpposingParties,
                        setEstateOpposingParties,
                        'Opposing Party / Caveators / Beneficiaries (Multiple Allowed)'
                      )}

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Proceeding Type *</label>
                        <select
                          value={estateProceedingType}
                          onChange={(e) => setEstateProceedingType(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        >
                          <option value="Grant of Probate">Grant of Probate</option>
                          <option value="Letters of Administration (Intestate - No Will)">Letters of Administration (Intestate - No Will)</option>
                          <option value="Small Estate Distribution (JKPT)">Small Estate Distribution (JKPT)</option>
                          <option value="Order for Sale">Order for Sale</option>
                          <option value="Vesting Order">Vesting Order</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Deceased Full Name</label>
                        <input
                          type="text"
                          value={estateDeceasedName}
                          onChange={(e) => setEstateDeceasedName(e.target.value)}
                          placeholder="e.g. Late Tan Sri Ahmad Bin Hashim"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Gross Estate Value (RM)</label>
                        <input
                          type="number"
                          value={estateGrossValue}
                          onChange={(e) => setEstateGrossValue(Number(e.target.value))}
                          placeholder="1500000"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#16223A]"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            <div className="p-3.5 bg-amber-50/60 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <h4 className="font-bold text-[#16223A] text-xs uppercase">Opposing Solicitors / Law Firm on Record (Optional)</h4>
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                  Syncs to Overview Roster
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Opposing Law Firm Name</label>
                  <input
                    type="text"
                    value={opposingFirmName}
                    onChange={(e) => setOpposingFirmName(e.target.value)}
                    placeholder="e.g. Messrs. Tan & Partners"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-[#16223A]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Attending Solicitor / Counsel</label>
                  <input
                    type="text"
                    value={opposingSolicitorName}
                    onChange={(e) => setOpposingSolicitorName(e.target.value)}
                    placeholder="e.g. Encik Roslan Ahmad"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-[#16223A]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block uppercase mb-1">Scope of Legal Representation</label>
              <textarea
                rows={2}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="e.g. Full representation in court litigation up to trial and judgment..."
                className="w-full p-2 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-xs font-medium text-[#16223A]"
              />
            </div>

            {/* Navigation Controls for Intake Sub-Step 3 */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIntakeStep(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Handlers &amp; File Ref</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!caseTitle.trim()) {
                    showToast('Please enter a Case / Matter Title.', 'error');
                    return;
                  }
                  setIntakeStep(4);
                }}
                className="px-5 py-2.5 bg-[#16223A] text-amber-300 hover:bg-[#203050] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Next: Retainer &amp; Terms</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* INTAKE SUB-STEP 4: Retainer, Bank Account & Confirmation */}
        {intakeStep === 4 && (
          <div className="space-y-3.5">
            {/* Case Confirmation Summary Card */}
            <div className="p-3.5 bg-[#16223A] border border-amber-400/40 rounded-xl text-white space-y-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] uppercase font-mono font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-amber-300" />
                  Intake Registry Summary Review
                </span>
                <span className="text-xs font-mono font-extrabold bg-amber-400 text-[#16223A] px-2.5 py-0.5 rounded">
                  Ref: {computedRef}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Client(s)</span>
                  <span className="font-bold text-amber-200">
                    {selectedClients.map(c => c.name).join(', ') || 'No Client Selected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Practice Area</span>
                  <span className="font-bold text-white">{practiceArea}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[9px] uppercase">Matter Title</span>
                  <span className="font-bold text-slate-100 truncate block">{caseTitle || 'Untitled Matter'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Case Retainer Deposit (RM)</label>
                <input
                  type="number"
                  value={retainerAmount}
                  onChange={(e) => setRetainerAmount(Number(e.target.value))}
                  className="w-full text-xs p-2 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg font-mono font-bold text-[#16223A]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Assign Firm Bank Account</label>
                <select
                  value={assignedBankAccountId}
                  onChange={(e) => setAssignedBankAccountId(e.target.value)}
                  className="w-full text-xs p-2 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg font-bold text-[#16223A]"
                >
                  {bankAccounts.filter(b => b.status === 'ACTIVE').map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      [{acc.type}] {acc.bankName} - {acc.accountName} ({acc.accountNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block uppercase mb-1">Special Case Terms</label>
              <input
                type="text"
                value={specialTerms}
                onChange={(e) => setSpecialTerms(e.target.value)}
                placeholder="e.g. Subject to Bar Council Ruling 2026 / Installment terms..."
                className="w-full text-xs p-2 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-[#16223A]"
              />
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIntakeStep(3)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Practice Details</span>
              </button>

              <button
                type="submit"
                disabled={clients.length === 0}
                className="px-6 py-3 bg-[#16223A] hover:bg-[#203050] text-amber-300 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-amber-300" />
                <span>Register Case &amp; Proceed to Summary</span>
              </button>
            </div>
          </div>
        )}
          </form>
        )}

        {/* STEP 2: Success Summary Screen & Engagement Letter PDF Generation + Signatures */}
        {currentStep === 2 && (
          <div className="space-y-4 text-xs">
            {/* Banner */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-sm text-emerald-950 block">New Case Registered Successfully!</span>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Assigned File Reference: <span className="font-mono font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded">{generatedCaseRef}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Case Details Summary Card */}
            <div className="p-4 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl space-y-3">
              <div className="font-serif font-bold text-[#16223A] text-sm border-b border-[#E1DCCF] pb-2 flex items-center justify-between">
                <span>Case Intake Particulars</span>
                <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded bg-[#16223A] text-amber-300">Active Status</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Client Name(s)</span>
                  <span className="font-bold text-[#16223A]">{selectedClients.map((c) => c.name).join(' & ') || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Partner(s) in Charge</span>
                  <span className="font-bold text-[#16223A]">{getPartnerFullNames(selectedPartners)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Practice Code / Sub-Code</span>
                  <span className="font-bold text-[#16223A]">{practiceArea}{matterSubCode ? ` / ${matterSubCode}` : ''}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Client Initial / Running No</span>
                  <span className="font-mono font-bold text-[#16223A]">{cInitials} / {autoRunningNo}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Matter Title</span>
                  <span className="font-bold text-[#16223A]">{caseTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Opposing Party</span>
                  <span className="font-bold text-[#16223A]">{opponentName}</span>
                </div>
              </div>
            </div>

            {/* Action Trigger Section */}
            {!showEngagementLetterDoc ? (
              <div className="p-5 bg-gradient-to-r from-[#16223A] to-[#1F2E4D] text-white rounded-2xl space-y-3 border border-[#A9814A]/40 shadow-lg text-center">
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="font-serif font-bold text-base text-amber-300 flex items-center justify-center gap-2">
                    <FileSignature className="w-5 h-5 text-amber-300" />
                    <span>Generate Engagement Letter &amp; PDF Sign-off</span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    Review engagement terms, execute digital signature, and export PDF directly into case document folder.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEngagementLetterDoc(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-300 text-[#16223A] font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95"
                  >
                    <FileSignature className="w-4 h-4 text-[#16223A]" />
                    <span>Generate &amp; Sign Engagement Letter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCaseId(createdCaseId);
                      setCurrentView('cases');
                      handleResetModal();
                    }}
                    className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Skip to Case File</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Generated Engagement Letter Text & Signature View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-[#16223A] text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#A9814A]" />
                    Official Engagement Letter &amp; Warrant of Appointment Document
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                    Official SHCO Document
                  </span>
                </div>

                <div className="p-4 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto shadow-inner">
                  {warrantText}
                </div>

                {/* DIGITAL SIGNATURE BLOCK */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-[#16223A] text-xs flex items-center gap-1.5">
                      <PenTool className="w-4 h-4 text-[#A9814A]" />
                      Client Execution &amp; Digital Signature
                    </span>
                    <span className="text-[10px] text-slate-500">Sign below or confirm client authorization</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block uppercase mb-1">Authorized Signatory Name</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block uppercase mb-1">NRIC / Registration No.</label>
                      <input
                        type="text"
                        value={signerIc}
                        onChange={(e) => setSignerIc(e.target.value)}
                        placeholder="e.g. 880101-14-5566"
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {/* Canvas Pad */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Draw Signature on Screen</label>
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                      >
                        Clear Signature
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={90}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-24 bg-white border border-slate-300 rounded-lg cursor-crosshair touch-none"
                    />
                  </div>
                </div>

                {/* PDF & FOLDER AUTO-SAVE ACTION BUTTONS */}
                <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(warrantText);
                      showToast('Engagement Letter copied to clipboard');
                    }}
                    className="px-3.5 py-2 bg-white border border-[#E1DCCF] hover:border-[#A9814A] rounded-xl text-xs font-bold flex items-center gap-1.5 text-slate-700 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#A9814A]" />
                    <span>Copy Text</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSignAndSavePdfToFolder}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                        isPdfSavedInFolder
                          ? 'bg-emerald-800 text-amber-300 border border-emerald-600'
                          : 'bg-[#16223A] hover:bg-[#203050] text-amber-300'
                      }`}
                    >
                      {isPdfSavedInFolder ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>PDF Saved to Folder &amp; Printed</span>
                        </>
                      ) : (
                        <>
                          <Printer className="w-4 h-4 text-amber-300" />
                          <span>Sign &amp; Save PDF to Case Folder</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentCaseId(createdCaseId);
                        setCurrentView('cases');
                        handleResetModal();
                      }}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Open Case Folder</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isPdfSavedInFolder && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] text-emerald-950 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Signed PDF document saved in case folder: <strong className="font-mono">Signed_Engagement_Letter_{generatedCaseRef.replaceAll('/', '_')}.pdf</strong> under Category <strong className="font-serif">Engagement Letters</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
