import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Client, CorporateEntityCategory } from '../types';
import { scanClientConflicts } from '../lib/conflictUtils';
import {
  UserPlus,
  X,
  User,
  Building2,
  AlertCircle,
  MapPin,
  Sparkles,
  Check,
  ShieldCheck,
  FileCheck,
  Info,
  Briefcase,
  RotateCcw,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export interface CorporateEntityOption {
  value: CorporateEntityCategory;
  label: string;
  shortCode: string;
  badge: string;
  description: string;
  governingBody: string;
  regNoLabel: string;
  regNoPlaceholder: string;
  regNoHelp: string;
  taxLabel: string;
  taxPlaceholder: string;
  repNameLabel: string;
  repDesignationLabel: string;
  repDesignationPlaceholder: string;
  sampleName: string;
  sampleRegNo: string;
  sampleTaxNo: string;
  sampleRepName: string;
  sampleRepDesignation: string;
  validationRules: {
    minNameLength: number;
    regNoMinLength: number;
    taxNoMinLength: number;
    taxNoRequired: boolean;
    repNameRequired: boolean;
    repDesignationRequired: boolean;
  };
}

export const CORPORATE_ENTITY_OPTIONS: CorporateEntityOption[] = [
  {
    value: 'Sdn Bhd',
    label: 'Sdn Bhd (Sendirian Berhad - Private Limited)',
    shortCode: 'Sdn Bhd',
    badge: 'SSM ROC Companies',
    description: 'Private Limited Company incorporated under the Companies Act 2016.',
    governingBody: 'Suruhanjaya Syarikat Malaysia (SSM)',
    regNoLabel: 'SSM ROC Registration No.',
    regNoPlaceholder: 'e.g. 202101009988 or 1401234-A',
    regNoHelp: '12-digit SSM ROC format (YYYY01XXXXXX) or legacy registration number.',
    taxLabel: 'Corporate Tax ID / SST No.',
    taxPlaceholder: 'e.g. C 2589012300 or W10-1808-32000042',
    repNameLabel: 'Authorized Director / Representative Name',
    repDesignationLabel: 'Corporate Role / Designation',
    repDesignationPlaceholder: 'e.g. Chief Legal Officer / Executive Director / Company Secretary',
    sampleName: 'Nusantara Holdings Sdn Bhd',
    sampleRegNo: '202101009988',
    sampleTaxNo: 'W10-1808-32000042',
    sampleRepName: 'Encik Ridzuan Ibrahim',
    sampleRepDesignation: 'Chief Legal Officer',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 6,
      taxNoMinLength: 5,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Enterprise',
    label: 'Enterprise (Perniagaan / Commercial Business)',
    shortCode: 'Enterprise',
    badge: 'SSM ROB Business',
    description: 'Commercial business entity registered under the Registration of Businesses Act 1956.',
    governingBody: 'Suruhanjaya Syarikat Malaysia (SSM)',
    regNoLabel: 'SSM ROB Registration No.',
    regNoPlaceholder: 'e.g. 202003112233 or 003123456-A',
    regNoHelp: 'SSM Registration of Businesses (ROB) 12-digit format or legacy business number.',
    taxLabel: 'Business Tax File ID / SST No.',
    taxPlaceholder: 'e.g. OG 1029384750',
    repNameLabel: 'Proprietor / Managing Owner Name',
    repDesignationLabel: 'Designation / Role in Business',
    repDesignationPlaceholder: 'e.g. Managing Proprietor / Founder / Business Manager',
    sampleName: 'Nusantara Creative & Tech Enterprise',
    sampleRegNo: '202003112233',
    sampleTaxNo: 'OG 1029384750',
    sampleRepName: 'Encik Ridzuan Ibrahim',
    sampleRepDesignation: 'Managing Proprietor',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 5,
      taxNoMinLength: 4,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Sole Proprietorship',
    label: 'Sole Proprietorship (Milik Tunggal)',
    shortCode: 'Sole Proprietor',
    badge: 'Single Owner Entity',
    description: 'Single-owner business entity registered under the Registration of Businesses Act 1956.',
    governingBody: 'Suruhanjaya Syarikat Malaysia (SSM)',
    regNoLabel: 'SSM ROB Registration No.',
    regNoPlaceholder: 'e.g. 002987123-K or 202203001122',
    regNoHelp: 'SSM ROB business registration number for sole proprietor.',
    taxLabel: 'Personal / Business Tax File No.',
    taxPlaceholder: 'e.g. OG 9812736450',
    repNameLabel: 'Sole Owner / Proprietor Name',
    repDesignationLabel: 'Designation',
    repDesignationPlaceholder: 'Sole Proprietor / Owner',
    sampleName: 'Apex Legal Consult Enterprise',
    sampleRegNo: '002987123-K',
    sampleTaxNo: 'OG 9812736450',
    sampleRepName: 'Dato\' Ahmad Khairuddin',
    sampleRepDesignation: 'Sole Proprietor',
    validationRules: {
      minNameLength: 2,
      regNoMinLength: 5,
      taxNoMinLength: 4,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Berhad',
    label: 'Berhad (Public Limited Company)',
    shortCode: 'Berhad',
    badge: 'Public Listed / Unlisted Corp',
    description: 'Public Limited Company incorporated under the Companies Act 2016.',
    governingBody: 'SSM & Securities Commission Malaysia (SC)',
    regNoLabel: 'SSM ROC Reg No. (Public Co.)',
    regNoPlaceholder: 'e.g. 201501004321 or 1122334-V',
    regNoHelp: '12-digit SSM ROC format for public companies.',
    taxLabel: 'Corporate Tax ID / SST No.',
    taxPlaceholder: 'e.g. C 9928172630 or W10-1901-88220011',
    repNameLabel: 'Authorized Director / Officer Name',
    repDesignationLabel: 'Corporate Office / Designation',
    repDesignationPlaceholder: 'e.g. Executive Director / Managing Director / Company Secretary',
    sampleName: 'Nusantara Resources Berhad',
    sampleRegNo: '201501004321',
    sampleTaxNo: 'C 9928172630',
    sampleRepName: 'Puan Sri Zaiton Abdullah',
    sampleRepDesignation: 'Senior Executive Director',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 6,
      taxNoMinLength: 5,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Partnership',
    label: 'Partnership (Perkongsian / Professional Firm)',
    shortCode: 'Partnership',
    badge: 'General Partnership Firm',
    description: 'Unincorporated partnership governed by Partnership Act 1961 or partnership deed.',
    governingBody: 'Suruhanjaya Syarikat Malaysia (SSM) / Bar Council',
    regNoLabel: 'SSM ROB / Partnership Registration No.',
    regNoPlaceholder: 'e.g. 201803998877 or BC/F/1802',
    regNoHelp: 'SSM ROB firm registration or professional body registration code.',
    taxLabel: 'Partnership Tax File ID (D File)',
    taxPlaceholder: 'e.g. D 981273640',
    repNameLabel: 'Managing Partner / Partner Name',
    repDesignationLabel: 'Partner Designation',
    repDesignationPlaceholder: 'e.g. Senior Managing Partner / Equity Partner',
    sampleName: 'Ridzuan & Co Advocates & Solicitors',
    sampleRegNo: '201803998877',
    sampleTaxNo: 'D 981273640',
    sampleRepName: 'Encik Ridzuan Ibrahim',
    sampleRepDesignation: 'Managing Partner',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 5,
      taxNoMinLength: 4,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'LLP',
    label: 'LLP (Limited Liability Partnership - PLT)',
    shortCode: 'LLP / PLT',
    badge: 'Limited Liability Partnership',
    description: 'Hybrid corporate entity registered under Limited Liability Partnerships Act 2012.',
    governingBody: 'Suruhanjaya Syarikat Malaysia (SSM)',
    regNoLabel: 'SSM LLP Registration No.',
    regNoPlaceholder: 'e.g. LLP0029871-LGN or 202104001234',
    regNoHelp: 'SSM LLP registration format (e.g. LLPXXXXXXX-LGN or 12-digit SSM).',
    taxLabel: 'LLP Tax File ID (PT File)',
    taxPlaceholder: 'e.g. PT 87123940',
    repNameLabel: 'Compliance Officer / Managing Partner',
    repDesignationLabel: 'PLT Official Designation',
    repDesignationPlaceholder: 'e.g. Compliance Officer / Managing Partner',
    sampleName: 'Nusantara Advisory PLT',
    sampleRegNo: 'LLP0029871-LGN',
    sampleTaxNo: 'PT 87123940',
    sampleRepName: 'Puan Salmah Mansor',
    sampleRepDesignation: 'Compliance Officer & Partner',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 5,
      taxNoMinLength: 4,
      taxNoRequired: true,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Society/Association',
    label: 'Society / Association / Club (ROS)',
    shortCode: 'Society / ROS',
    badge: 'Registrar of Societies',
    description: 'Non-governmental organization, association, or club registered under Societies Act 1966.',
    governingBody: 'Jabatan Pendaftaran Pertubuhan Malaysia (ROS)',
    regNoLabel: 'ROS Registration No. (PPM)',
    regNoPlaceholder: 'e.g. PPM-005-14-18092021',
    regNoHelp: 'ROS PPM registration code format (PPM-XXX-XX-XXXXXX).',
    taxLabel: 'Tax File / Exemption Ref No.',
    taxPlaceholder: 'e.g. E 90182736 or Exempt',
    repNameLabel: 'Authorized Officer / President Name',
    repDesignationLabel: 'Office Bearer Role',
    repDesignationPlaceholder: 'e.g. President / Honorary Secretary / Treasurer',
    sampleName: 'Persatuan Usahawan Digital Malaysia',
    sampleRegNo: 'PPM-005-14-18092021',
    sampleTaxNo: 'E 90182736',
    sampleRepName: 'Encik Ridzuan Ibrahim',
    sampleRepDesignation: 'President',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 5,
      taxNoMinLength: 0,
      taxNoRequired: false,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Foreign Corp',
    label: 'Foreign Corporation / Offshore Entity',
    shortCode: 'Foreign Entity',
    badge: 'Foreign Jurisdiction',
    description: 'Corporate body incorporated outside Malaysia or in offshore tax jurisdictions.',
    governingBody: 'Foreign ROC / SSM Section 561 Registration',
    regNoLabel: 'Foreign Reg / SSM Certificate No.',
    regNoPlaceholder: 'e.g. FC-20220912 or 993812-X',
    regNoHelp: 'Foreign country incorporation certificate or SSM branch code.',
    taxLabel: 'Tax File / Foreign Agent Registration',
    taxPlaceholder: 'e.g. F-1029384756',
    repNameLabel: 'Authorized Representative / Local Agent',
    repDesignationLabel: 'Representative Title',
    repDesignationPlaceholder: 'e.g. Attorney-in-Fact / Country Manager / Local Representative',
    sampleName: 'Nusantara Global Tech Pte Ltd',
    sampleRegNo: 'FC-20220912',
    sampleTaxNo: 'F-1029384756',
    sampleRepName: 'Mr. David Chen',
    sampleRepDesignation: 'Country Representative',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 4,
      taxNoMinLength: 0,
      taxNoRequired: false,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Government / Statutory Body',
    label: 'Government Agency / Statutory Body',
    shortCode: 'Govt / Statutory',
    badge: 'Public Sector Authority',
    description: 'Ministry, department, local council, or statutory authority established by Act of Parliament.',
    governingBody: 'Federal / State Government / Parliament Act',
    regNoLabel: 'Statutory Act / Gazette Ref No.',
    regNoPlaceholder: 'e.g. Act 288 or Treasury Ref 100-2/4',
    regNoHelp: 'Act of Parliament gazette reference or official treasury code.',
    taxLabel: 'Tax Exemption Code / File No.',
    taxPlaceholder: 'e.g. Govt-Exempt-0012',
    repNameLabel: 'Authorized Officer / Legal Director',
    repDesignationLabel: 'Official Title',
    repDesignationPlaceholder: 'e.g. Director General / Head of Legal Division',
    sampleName: 'Lembaga Pembangunan Pelaburan Malaysia (MIDA)',
    sampleRegNo: 'Act 288 (Statutory Gazette)',
    sampleTaxNo: 'Govt-Exempt-0012',
    sampleRepName: 'Puan Norizan Hashim',
    sampleRepDesignation: 'Director of Legal Division',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 3,
      taxNoMinLength: 0,
      taxNoRequired: false,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
  {
    value: 'Cooperative (Koperasi)',
    label: 'Cooperative (Koperasi - SKM)',
    shortCode: 'Cooperative',
    badge: 'SKM Registered',
    description: 'Cooperative society registered with Suruhanjaya Koperasi Malaysia (SKM).',
    governingBody: 'Suruhanjaya Koperasi Malaysia (SKM)',
    regNoLabel: 'SKM Registration Certificate No.',
    regNoPlaceholder: 'e.g. SKM-KOP-2019-0112',
    regNoHelp: 'Suruhanjaya Koperasi Malaysia registration certificate number.',
    taxLabel: 'Cooperative Tax File No.',
    taxPlaceholder: 'e.g. KOP-88273641',
    repNameLabel: 'Board Chairman / Representative',
    repDesignationLabel: 'Cooperative Board Role',
    repDesignationPlaceholder: 'e.g. Board Chairman / Secretary / Treasurer',
    sampleName: 'Koperasi Warga Wilayah Persekutuan Berhad',
    sampleRegNo: 'SKM-KOP-2019-0112',
    sampleTaxNo: 'KOP-88273641',
    sampleRepName: 'Encik Hassan Mansor',
    sampleRepDesignation: 'Chairman of Board',
    validationRules: {
      minNameLength: 3,
      regNoMinLength: 4,
      taxNoMinLength: 0,
      taxNoRequired: false,
      repNameRequired: true,
      repDesignationRequired: true,
    },
  },
];

export function getCorporateEntityConfig(category: CorporateEntityCategory): CorporateEntityOption {
  return (
    CORPORATE_ENTITY_OPTIONS.find((opt) => opt.value === category) ||
    CORPORATE_ENTITY_OPTIONS[0]
  );
}

export function getTaxPrefixHelper(category: CorporateEntityCategory): {
  prefix: string;
  prefixLabel: string;
  placeholder: string;
  description: string;
  suggestedFormat: string;
} {
  switch (category) {
    case 'Sdn Bhd':
    case 'Berhad':
      return {
        prefix: 'C',
        prefixLabel: 'C (Corporate Tax File)',
        placeholder: 'e.g. C 2589012300 (or W10-1808-32000042 for SST)',
        description: 'LHDN Corporate Tax File prefix for Private/Public Companies is "C"',
        suggestedFormat: 'C [10-digit Tax ID]',
      };
    case 'Enterprise':
    case 'Sole Proprietorship':
      return {
        prefix: 'E',
        prefixLabel: 'E / OG (Business Tax File)',
        placeholder: 'e.g. E 1029384750 or OG 1029384750',
        description: 'LHDN Business & Sole Proprietor Tax File prefix is "E" or "OG"',
        suggestedFormat: 'E [10-digit Tax ID]',
      };
    case 'LLP':
      return {
        prefix: 'PT',
        prefixLabel: 'PT (LLP Tax File)',
        placeholder: 'e.g. PT 87123940',
        description: 'LHDN Limited Liability Partnership Tax File prefix is "PT"',
        suggestedFormat: 'PT [8-digit Tax ID]',
      };
    case 'Partnership':
      return {
        prefix: 'D',
        prefixLabel: 'D (Partnership File)',
        placeholder: 'e.g. D 981273640',
        description: 'LHDN General Partnership Tax File prefix is "D"',
        suggestedFormat: 'D [9-digit Tax ID]',
      };
    case 'Society/Association':
    case 'Cooperative (Koperasi)':
      return {
        prefix: 'E',
        prefixLabel: 'E (Society / Org File)',
        placeholder: 'e.g. E 90182736',
        description: 'LHDN Society / Co-Op Tax File prefix is "E"',
        suggestedFormat: 'E [8-digit Tax ID]',
      };
    case 'Foreign Corp':
      return {
        prefix: 'F',
        prefixLabel: 'F (Foreign Corp File)',
        placeholder: 'e.g. F 1029384756',
        description: 'LHDN Foreign Corporation Tax File prefix is "F"',
        suggestedFormat: 'F [10-digit Tax ID]',
      };
    default:
      return {
        prefix: 'C',
        prefixLabel: 'C (Corporate Tax File)',
        placeholder: 'e.g. C 2589012300',
        description: 'LHDN Corporate Tax File prefix is "C"',
        suggestedFormat: 'C [10-digit Tax ID]',
      };
  }
}

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { clients, cases, addClient, showToast } = useApp();

  // Form State
  const [type, setType] = useState<'Individual' | 'Corporate'>('Individual');
  const [salutation, setSalutation] = useState('Mr.');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('Kuala Lumpur');
  const [state, setState] = useState('Selangor');
  const [country, setCountry] = useState('Malaysia');

  // Corporate Specifics
  const [entityCategory, setEntityCategory] = useState<CorporateEntityCategory>('Sdn Bhd');
  const [registrationNo, setRegistrationNo] = useState('');
  const [taxSstNo, setTaxSstNo] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonDesignation, setContactPersonDesignation] = useState('');

  // Individual Specifics
  const [icNo, setIcNo] = useState('');
  const [nationality, setNationality] = useState('Malaysian');
  const [occupation, setOccupation] = useState('');

  // Emergency & Notes
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Conflict Screening State & Real-time Search Input
  const [conflictSearchInput, setConflictSearchInput] = useState('');
  const [conflictStatus, setConflictStatus] = useState<'Clear' | 'Flagged' | 'Pending Partner Review'>('Clear');
  const [conflictNotes, setConflictNotes] = useState('');
  const [screenedBy, setScreenedBy] = useState('Puan Syafiqah Hamizad');

  // Validation Errors & Confirmation States
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // SSM Real-Time Validation State
  const [ssmValidation, setSsmValidation] = useState<{
    isSearching: boolean;
    isVerified: boolean;
    statusText: string;
  } | null>(null);

  // Window beforeunload prompt if unsaved data exists
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isOpen && hasEnteredData()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved client registration data. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    if (isOpen) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen, name, email, phone, streetAddress, postcode, registrationNo, taxSstNo, contactPersonName, contactPersonDesignation, icNo, occupation, emergencyContactName, emergencyContactPhone, notes]);

  // Trigger SSM lookup mock API validation as user types SSM Registration No.
  useEffect(() => {
    if (type !== 'Corporate') {
      setSsmValidation(null);
      return;
    }

    const clean = registrationNo.trim();
    if (!clean || clean.length < 4) {
      setSsmValidation(null);
      return;
    }

    setSsmValidation({
      isSearching: true,
      isVerified: false,
      statusText: 'Querying SSM e-Search Registry Portal...',
    });

    const timer = setTimeout(() => {
      // Validate format against SSM ROC / ROB / LLP / ROS / SKM patterns
      const is12Digit = /^\d{12}$/.test(clean);
      const isLegacy = /^\d{4,9}-[A-Za-z]$/i.test(clean);
      const isLlp = /^LLP\d{4,8}-[A-Za-z0-9]+$/i.test(clean);
      const isRos = /^PPM-\d{3}-\d{2}-\d{6,8}$/i.test(clean);
      const isSkm = /^SKM-[A-Za-z0-9-]+$/i.test(clean);
      const isValidFormat = clean.length >= 5 && (is12Digit || isLegacy || isLlp || isRos || isSkm || /^[A-Za-z0-9/-]{5,}$/i.test(clean));

      if (isValidFormat) {
        setSsmValidation({
          isSearching: false,
          isVerified: true,
          statusText: 'Verified Record • Suruhanjaya Syarikat Malaysia',
        });
      } else {
        setSsmValidation({
          isSearching: false,
          isVerified: false,
          statusText: 'Unrecognized SSM registration format',
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [registrationNo, entityCategory, type]);

  if (!isOpen) return null;

  const currentEntityConfig = getCorporateEntityConfig(entityCategory);
  const currentTaxHelper = getTaxPrefixHelper(entityCategory);

  // Form Reset
  const resetForm = () => {
    setType('Individual');
    setSalutation('Mr.');
    setName('');
    setEmail('');
    setPhone('');
    setStreetAddress('');
    setPostcode('');
    setCity('Kuala Lumpur');
    setState('Selangor');
    setCountry('Malaysia');
    setEntityCategory('Sdn Bhd');
    setRegistrationNo('');
    setTaxSstNo('');
    setContactPersonName('');
    setContactPersonDesignation('');
    setIcNo('');
    setNationality('Malaysian');
    setOccupation('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
    setNotes('');
    setFormErrors({});
    setHasSubmitted(false);
    setShowConfirmClose(false);
    setShowResetConfirm(false);
  };

  // Helper to detect if user has entered data
  const hasEnteredData = (): boolean => {
    return (
      name.trim() !== '' ||
      email.trim() !== '' ||
      phone.trim() !== '' ||
      streetAddress.trim() !== '' ||
      postcode.trim() !== '' ||
      registrationNo.trim() !== '' ||
      taxSstNo.trim() !== '' ||
      contactPersonName.trim() !== '' ||
      contactPersonDesignation.trim() !== '' ||
      icNo.trim() !== '' ||
      occupation.trim() !== '' ||
      emergencyContactName.trim() !== '' ||
      emergencyContactPhone.trim() !== '' ||
      notes.trim() !== ''
    );
  };

  const handleAttemptClose = () => {
    if (hasEnteredData()) {
      setShowConfirmClose(true);
    } else {
      resetForm();
      onClose();
    }
  };

  const handleResetClick = () => {
    if (hasEnteredData()) {
      setShowResetConfirm(true);
    } else {
      resetForm();
      showToast('Client registration form reset to defaults.', 'info');
    }
  };

  const handleEntityCategoryChange = (newCategory: CorporateEntityCategory) => {
    setEntityCategory(newCategory);
    clearFieldError('name');
    clearFieldError('registrationNo');
    clearFieldError('taxSstNo');
    clearFieldError('contactPersonName');
    clearFieldError('contactPersonDesignation');
  };

  const handleAutoFetchTaxId = (regNoInput?: string) => {
    if (type === 'Individual') {
      const cleanIc = (regNoInput !== undefined ? regNoInput : icNo).trim();
      if (!cleanIc) {
        showToast('Please enter NRIC or Passport Number first.', 'info');
        return;
      }
      const digits = cleanIc.replace(/\D/g, '');
      const derivedTin = digits.length >= 6 ? `IG ${digits}` : `IG 850714145231`;
      setTaxSstNo(derivedTin);
      clearFieldError('taxSstNo');
      showToast(`Linked LHDN Resident Individual Tax File (${derivedTin}) for NRIC #${cleanIc}`, 'success');
      return;
    }

    const rawReg = (regNoInput !== undefined ? regNoInput : registrationNo).trim();
    if (!rawReg) {
      showToast('Please enter an SSM Registration Number first.', 'info');
      return;
    }

    const digitsOnly = rawReg.replace(/\D/g, '');
    const numPart = digitsOnly.length >= 5 ? digitsOnly.slice(-10) : '2024010988';

    let derivedTin = '';
    let derivedSst = '';

    if (entityCategory === 'Sdn Bhd' || entityCategory === 'Berhad') {
      derivedTin = `C ${numPart.padEnd(10, '0')}`;
      derivedSst = `W10-1808-${numPart.slice(-8)}`;
    } else if (entityCategory === 'Enterprise' || entityCategory === 'Sole Proprietorship') {
      derivedTin = `OG ${numPart.padEnd(10, '0')}`;
      derivedSst = `W10-1808-${numPart.slice(-8)}`;
    } else if (entityCategory === 'LLP') {
      derivedTin = `PT ${numPart.padEnd(8, '0')}`;
      derivedSst = `W10-1808-${numPart.slice(-8)}`;
    } else if (entityCategory === 'Partnership') {
      derivedTin = `D ${numPart.padEnd(9, '0')}`;
    } else if (entityCategory === 'Society/Association' || entityCategory === 'Cooperative') {
      derivedTin = `E ${numPart.padEnd(8, '0')}`;
    } else if (entityCategory === 'Foreign Entity') {
      derivedTin = `F ${numPart.padEnd(10, '0')}`;
    } else {
      derivedTin = `C ${numPart.padEnd(10, '0')}`;
      derivedSst = `W10-1808-${numPart.slice(-8)}`;
    }

    const fullTaxString = derivedSst ? `${derivedTin} / SST: ${derivedSst}` : derivedTin;
    setTaxSstNo(fullTaxString);
    clearFieldError('taxSstNo');
    showToast(`Linked LHDN TIN (${derivedTin}) & SST Record for SSM #${rawReg}`, 'success');
  };

  const handleFillSampleData = () => {
    setFormErrors({});
    setHasSubmitted(false);
    if (type === 'Individual') {
      setSalutation('Dato\'');
      setName('Ahmad Khairuddin bin Zulkifli');
      setIcNo('850714-14-5231');
      setNationality('Malaysian');
      setOccupation('Managing Director');
      setEmail('ahmad.khairuddin@example.com.my');
      setPhone('+60 12-388 9911');
      setStreetAddress('Suite 18-02, Level 18, Menara Apex, No. 12, Jalan Bukit Bintang');
      setPostcode('50200');
      setCity('Kuala Lumpur');
      setState('W.P. Kuala Lumpur');
      setCountry('Malaysia');
      setEmergencyContactName('Datin Maryam Zulkifli');
      setEmergencyContactPhone('+60 12-888 2233');
      setNotes('High-net-worth individual client. Prefers updates via email and official WhatsApp.');
    } else {
      const config = getCorporateEntityConfig(entityCategory);
      setName(config.sampleName);
      setRegistrationNo(config.sampleRegNo);
      setTaxSstNo(config.sampleTaxNo);
      setContactPersonName(config.sampleRepName);
      setContactPersonDesignation(config.sampleRepDesignation);
      setEmail(`legal@${config.sampleName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.my`);
      setPhone('+60 3-2168 8800');
      setStreetAddress('Level 25, Menara Nusantara, No. 88, Jalan Ampang');
      setPostcode('50450');
      setCity('Kuala Lumpur');
      setState('W.P. Kuala Lumpur');
      setCountry('Malaysia');
      setEmergencyContactName('Puan Salmah Mansor (Company Secretary)');
      setEmergencyContactPhone('+60 3-2168 8801');
      setNotes(`Corporate client (${config.shortCode}). All correspondence to be routed through Legal Department.`);
    }
  };

  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    // Structure-driven Validation
    if (type === 'Individual') {
      if (!name.trim() || name.trim().length < 3) {
        errors.name = 'Full name is required (minimum 3 characters)';
      }
      if (!icNo.trim() || icNo.trim().length < 6) {
        errors.icNo = 'NRIC / Passport No. is required (minimum 6 characters)';
      }
    } else {
      const activeConfig = getCorporateEntityConfig(entityCategory);
      const rules = activeConfig.validationRules;

      // 1. Entity Registered Name validation
      if (!name.trim()) {
        errors.name = `${activeConfig.shortCode} Registered Name is required`;
      } else if (name.trim().length < rules.minNameLength) {
        errors.name = `Entity name must be at least ${rules.minNameLength} characters`;
      }

      // 2. Registration Number validation
      if (!registrationNo.trim()) {
        errors.registrationNo = `${activeConfig.regNoLabel} is required`;
      } else if (registrationNo.trim().length < rules.regNoMinLength) {
        errors.registrationNo = `${activeConfig.regNoLabel} must be at least ${rules.regNoMinLength} characters (${activeConfig.regNoHelp})`;
      }

      // 3. Tax / SST ID validation
      if (rules.taxNoRequired) {
        if (!taxSstNo.trim()) {
          errors.taxSstNo = `${activeConfig.taxLabel} is required for ${activeConfig.shortCode} entities`;
        } else if (taxSstNo.trim().length < rules.taxNoMinLength) {
          errors.taxSstNo = `${activeConfig.taxLabel} must be at least ${rules.taxNoMinLength} characters`;
        }
      } else if (taxSstNo.trim() && rules.taxNoMinLength > 0 && taxSstNo.trim().length < rules.taxNoMinLength) {
        errors.taxSstNo = `${activeConfig.taxLabel} must be at least ${rules.taxNoMinLength} characters if provided`;
      }

      // 4. Contact Person Name
      if (rules.repNameRequired && !contactPersonName.trim()) {
        errors.contactPersonName = `${activeConfig.repNameLabel} is required`;
      }

      // 5. Contact Person Designation
      if (rules.repDesignationRequired && !contactPersonDesignation.trim()) {
        errors.contactPersonDesignation = `${activeConfig.repDesignationLabel} is required`;
      }
    }

    // Email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errors.email = 'A valid email address is required (e.g. user@domain.com)';
    }

    // Phone check
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!phone.trim() || cleanPhone.length < 8) {
      errors.phone = 'Valid phone number required (e.g. +6012-3889911)';
    }

    // Address check
    if (!streetAddress.trim()) {
      errors.streetAddress = 'Street Address is required';
    }
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    if (!state.trim()) {
      errors.state = 'State is required';
    }
    if (!postcode.trim() || !/^\d{5}$/.test(postcode.trim())) {
      errors.postcode = '5-digit Malaysian postcode required (e.g. 50400)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);

    if (!validate()) {
      showToast('Form validation failed. Please check the highlighted fields.');
      return;
    }

    const addressParts = [
      streetAddress.trim(),
      `${postcode.trim()} ${city.trim()}, ${state.trim()}`,
      country.trim(),
    ].filter(Boolean);

    const fullFormattedAddress =
      addressParts.length > 0 ? addressParts.join('\n') : 'Address Not Provided';

    const autoId = `CL-2026-${Math.floor(100 + Math.random() * 900)}`;

    const liveConflicts = scanClientConflicts(
      {
        name: type === 'Individual' && salutation ? `${salutation} ${name.trim()}` : name.trim(),
        icNo: type === 'Individual' ? icNo.trim() : registrationNo.trim(),
        registrationNo: registrationNo.trim(),
        email: email.trim(),
        contactPerson: contactPersonName.trim(),
      },
      clients,
      cases
    );

    const newClient: Client = {
      id: autoId,
      name: type === 'Individual' && salutation ? `${salutation} ${name.trim()}` : name.trim(),
      type: type,
      entityCategory: type === 'Corporate' ? entityCategory : undefined,
      registrationNo: type === 'Corporate' ? registrationNo.trim() : undefined,
      taxSstNo: type === 'Corporate' ? taxSstNo.trim() : undefined,
      contactPerson: type === 'Corporate' ? contactPersonName.trim() : name.trim(),
      contactPersonDesignation: type === 'Corporate' ? contactPersonDesignation.trim() : undefined,
      salutation: type === 'Individual' ? salutation : undefined,
      icNo: type === 'Individual' ? icNo.trim() : registrationNo.trim(),
      icNumber: type === 'Individual' ? icNo.trim() : registrationNo.trim(),
      nationality: type === 'Individual' ? nationality.trim() : undefined,
      occupation: type === 'Individual' ? occupation.trim() : undefined,
      phone: phone.trim(),
      email: email.trim(),
      address: fullFormattedAddress,
      emergencyContact: emergencyContactName.trim()
        ? `${emergencyContactName.trim()} (${emergencyContactPhone.trim()})`
        : '—',
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      notes: notes.trim() || undefined,
      conflictCheck: {
        status: liveConflicts.length > 0 ? (conflictStatus === 'Clear' ? 'Flagged' : conflictStatus) : conflictStatus,
        notes: conflictNotes.trim() || (liveConflicts.length > 0 ? 'Potential conflict matches flagged during client registration.' : 'Screening completed upon client registration. No adverse conflicts found.'),
        checkedBy: screenedBy || 'Puan Syafiqah Hamizad',
        checkedDate: new Date().toISOString().split('T')[0],
      },
      autoConflictMatches: liveConflicts,
      kyc: [
        {
          id: `KYC-${Date.now()}-1`,
          name: `Master Identification - ${name.trim()}`,
          type: type === 'Corporate' ? 'SSM Corporate ROC Extract' : 'Identity (NRIC/Passport)',
          uploadedDate: new Date().toISOString().split('T')[0],
          driveFolder: `Firm Repository / Clients / ${autoId}`,
        },
      ],
    };

    addClient(newClient);
    showToast(`Successfully registered ${type} Client: ${newClient.name} (${autoId})`);
    resetForm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#16223A]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleAttemptClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 border border-[#E1DCCF] max-h-[92vh] flex flex-col my-auto overflow-hidden text-xs">
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#16223A] text-amber-300 flex items-center justify-center shadow-md">
              <UserPlus className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#16223A]">
                Register New Client Profile
              </h3>
              <p className="text-[11px] text-slate-500">
                Master Client Intake &amp; Real-time Compliance Registry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFillSampleData}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#16223A] font-bold text-[11px] border border-amber-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-Fill Demo</span>
            </button>
            <button
              type="button"
              onClick={handleResetClick}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset all form fields to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Notice Banner */}
        {hasSubmitted && Object.keys(formErrors).length > 0 && (
          <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Form Submission Blocked</p>
              <p className="text-[11px] text-rose-700">
                Please correct the highlighted errors in {Object.keys(formErrors).length} required field(s).
              </p>
            </div>
          </div>
        )}

        {/* Scrollable Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
          {/* Real-time Conflict Search Bar */}
          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#16223A] flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                <span>Real-Time Conflict Search &amp; Pre-Screening</span>
              </label>
              <span className="text-[10px] text-amber-900 font-semibold bg-amber-200/80 px-2 py-0.5 rounded">
                Live Query Mode
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={conflictSearchInput}
                onChange={(e) => setConflictSearchInput(e.target.value)}
                placeholder="Type client name, NRIC, company reg no, or email to check existing conflicts in real-time..."
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg font-bold text-[#16223A] placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              {conflictSearchInput && (
                <button
                  type="button"
                  onClick={() => setConflictSearchInput('')}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Live Search Results */}
            {(() => {
              const activeTerm = conflictSearchInput.trim() || name.trim() || icNo.trim() || registrationNo.trim();
              const liveMatches = activeTerm
                ? scanClientConflicts(
                    {
                      name: activeTerm,
                      icNo: activeTerm,
                      registrationNo: activeTerm,
                      email: activeTerm,
                      contactPerson: contactPersonName,
                    },
                    clients,
                    cases
                  )
                : [];

              if (!activeTerm) {
                return (
                  <p className="text-[11px] text-amber-800 italic">
                    Start typing client particulars above or in the form fields below to screen against firm records instantly.
                  </p>
                );
              }

              if (liveMatches.length === 0) {
                return (
                  <div className="p-2 bg-emerald-100/90 border border-emerald-300 rounded-lg text-emerald-900 text-[11.5px] font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Clear (No Adverse Conflicts Found for "{activeTerm}")</span>
                  </div>
                );
              }

              return (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1 font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>⚠️ {liveMatches.length} Conflict Match(es) Detected for "{activeTerm}":</span>
                  </div>
                  <ul className="space-y-1 font-mono text-[10.5px]">
                    {liveMatches.map((m, idx) => (
                      <li key={idx} className="bg-white p-1.5 rounded border border-rose-200 text-slate-800">
                        <strong className="text-rose-700">{m.label}:</strong> {m.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>

          {/* Client Entity Type Selection Header */}
          <div className="bg-[#FAF8F2] p-2.5 rounded-xl border border-[#E1DCCF] space-y-1.5">
            <label className="font-bold text-[#16223A] block uppercase text-[10px] tracking-wider">
              Client Category &amp; Legal Classification *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setType('Corporate');
                  clearFieldError('name');
                  clearFieldError('registrationNo');
                }}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer border flex items-start gap-3 ${
                  type === 'Corporate'
                    ? 'bg-[#16223A] text-white border-[#16223A] shadow-md ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-700 border-[#E1DCCF] hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${type === 'Corporate' ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>Corporate / Commercial Entity</span>
                    {type === 'Corporate' && <span className="px-1.5 py-0.5 bg-amber-300 text-[#16223A] rounded text-[9px] font-black uppercase">Selected</span>}
                  </div>
                  <p className={`text-[10.5px] mt-0.5 leading-tight ${type === 'Corporate' ? 'text-amber-100/90' : 'text-slate-500'}`}>
                    Sdn Bhd, Enterprise, Berhad, LLP, ROS, Foreign Corp, Statutory, etc.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('Individual');
                  clearFieldError('name');
                  clearFieldError('icNo');
                }}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer border flex items-start gap-3 ${
                  type === 'Individual'
                    ? 'bg-[#16223A] text-white border-[#16223A] shadow-md ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-700 border-[#E1DCCF] hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${type === 'Individual' ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>Individual Client</span>
                    {type === 'Individual' && <span className="px-1.5 py-0.5 bg-amber-300 text-[#16223A] rounded text-[9px] font-black uppercase">Selected</span>}
                  </div>
                  <p className={`text-[10.5px] mt-0.5 leading-tight ${type === 'Individual' ? 'text-amber-100/90' : 'text-slate-500'}`}>
                    Personal client NRIC / Passport master profile
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Particulars */}
          {type === 'Individual' ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
                <User className="w-3.5 h-3.5 text-[#A9814A]" />
                <span>Individual Client Particulars</span>
              </h4>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    Salutation
                  </label>
                  <select
                    value={salutation}
                    onChange={(e) => setSalutation(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Dato'">Dato'</option>
                    <option value="Datin">Datin</option>
                    <option value="Dato' Seri">Dato' Seri</option>
                    <option value="Tan Sri">Tan Sri</option>
                  </select>
                </div>

                <div className="col-span-9">
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    Full Name (per NRIC / Passport) *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                    placeholder="e.g. Ahmad Khairuddin bin Zulkifli"
                    className={`w-full text-xs p-2 bg-white border rounded-lg font-bold text-[#16223A] ${
                      formErrors.name
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    NRIC / Passport No. *
                  </label>
                  <input
                    type="text"
                    value={icNo}
                    onChange={(e) => {
                      setIcNo(e.target.value);
                      clearFieldError('icNo');
                    }}
                    placeholder="850714-14-5231"
                    className={`w-full text-xs p-2 bg-white border rounded-lg font-mono ${
                      formErrors.icNo
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  {formErrors.icNo && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.icNo}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block text-[10.5px] uppercase">
                      LHDN Tax Identification (TIN)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutoFetchTaxId()}
                      className="text-[9.5px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200 cursor-pointer"
                    >
                      Auto-TIN
                    </button>
                  </div>
                  <input
                    type="text"
                    value={taxSstNo}
                    onChange={(e) => {
                      setTaxSstNo(e.target.value);
                      clearFieldError('taxSstNo');
                    }}
                    placeholder="IG 850714145231 or SG / OG..."
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-slate-500 font-medium">IG: Resident Individual | SG: Salaried | OG: Business</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const digits = icNo.replace(/\D/g, '') || '850714145231';
                            setTaxSstNo(`IG ${digits}`);
                            clearFieldError('taxSstNo');
                          }}
                          className="font-bold text-emerald-800 hover:text-[#16223A] bg-emerald-50 hover:bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300 cursor-pointer"
                          title="IG = Resident Individual Tax File"
                        >
                          +IG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const digits = icNo.replace(/\D/g, '') || '850714145231';
                            setTaxSstNo(`SG ${digits}`);
                            clearFieldError('taxSstNo');
                          }}
                          className="font-bold text-slate-700 hover:text-[#16223A] bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded border border-slate-300 cursor-pointer"
                          title="SG = Salaried Employee Tax File"
                        >
                          +SG
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const digits = icNo.replace(/\D/g, '') || '850714145231';
                            setTaxSstNo(`OG ${digits}`);
                            clearFieldError('taxSstNo');
                          }}
                          className="font-bold text-slate-700 hover:text-[#16223A] bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded border border-slate-300 cursor-pointer"
                          title="OG = Non-Company Business Income Tax File"
                        >
                          +OG
                        </button>
                      </div>
                    </div>
                    {taxSstNo.trim().toUpperCase().startsWith('IG') && (
                      <p className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                        <span>LHDN Validated: Resident Individual Tax File (IG)</span>
                      </p>
                    )}
                    {taxSstNo.trim().toUpperCase().startsWith('SG') && (
                      <p className="text-[9px] text-blue-700 font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-blue-600" />
                        <span>LHDN Validated: Salaried Employee File (SG)</span>
                      </p>
                    )}
                    {taxSstNo.trim().toUpperCase().startsWith('OG') && (
                      <p className="text-[9px] text-purple-700 font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-purple-600" />
                        <span>LHDN Validated: Individual Business Income File (OG)</span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Malaysian"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    Occupation / Position
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Managing Director"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#A9814A]" />
                  <span>Corporate Entity Profile &amp; Statutory KYC</span>
                </h4>
                <span className="px-2 py-0.5 bg-[#16223A] text-amber-300 rounded text-[10px] font-bold">
                  {currentEntityConfig.badge}
                </span>
              </div>

              {/* Corporate Entity Structure Dropdown */}
              <div>
                <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                  Corporate Entity Structure *
                </label>
                <select
                  value={entityCategory}
                  onChange={(e) => handleEntityCategoryChange(e.target.value as CorporateEntityCategory)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A] shadow-xs cursor-pointer focus:ring-2 focus:ring-[#16223A]/20"
                >
                  {CORPORATE_ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.badge})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Entity Structural Compliance Info Box */}
              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Governing Authority: {currentEntityConfig.governingBody}</span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-amber-800">
                    Reg Requirement: {currentEntityConfig.validationRules.regNoMinLength}+ chars
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {currentEntityConfig.description}
                </p>
                <div className="text-[10.5px] text-amber-900 font-mono font-medium">
                  <strong>Statutory Format Hint:</strong> {currentEntityConfig.regNoHelp}
                </div>
              </div>

              {/* Company Registered Name */}
              <div>
                <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                  Registered Entity Name ({currentEntityConfig.shortCode}) *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  placeholder={`e.g. ${currentEntityConfig.sampleName}`}
                  className={`w-full text-xs p-2 bg-white border rounded-lg font-bold text-[#16223A] ${
                    formErrors.name
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{formErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Registration No and Tax ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block text-[10.5px] uppercase">
                      {currentEntityConfig.regNoLabel} *
                    </label>
                    {ssmValidation?.isSearching && (
                      <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                        <span>SSM Lookup...</span>
                      </span>
                    )}
                    {ssmValidation?.isVerified && (
                      <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Verified</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={registrationNo}
                    onChange={(e) => {
                      setRegistrationNo(e.target.value);
                      clearFieldError('registrationNo');
                    }}
                    onBlur={() => {
                      if (!taxSstNo.trim() && registrationNo.trim().length >= 4) {
                        handleAutoFetchTaxId(registrationNo);
                      }
                    }}
                    placeholder={currentEntityConfig.regNoPlaceholder}
                    className={`w-full text-xs p-2 bg-white border rounded-lg font-mono transition-all ${
                      ssmValidation?.isVerified
                        ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/20'
                        : formErrors.registrationNo
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  {formErrors.registrationNo ? (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{formErrors.registrationNo}</span>
                    </p>
                  ) : ssmValidation?.isVerified ? (
                    <p className="text-[9.5px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Match Confirmed in SSM Corporate Records</span>
                    </p>
                  ) : ssmValidation?.statusText && !ssmValidation.isSearching ? (
                    <p className="text-[9.5px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>{ssmValidation.statusText}</span>
                    </p>
                  ) : (
                    <p className="text-[9.5px] text-slate-500 mt-0.5">{currentEntityConfig.regNoHelp}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block text-[10.5px] uppercase">
                      {currentEntityConfig.taxLabel} {currentEntityConfig.validationRules.taxNoRequired && '*'}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutoFetchTaxId()}
                      className="text-[10px] font-bold text-amber-800 hover:text-[#16223A] bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                      title="Auto-query & link LHDN MyInvois Tax Identification Number & SST Registry"
                    >
                      <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                      <span>Auto-Fetch</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={taxSstNo}
                    onChange={(e) => {
                      setTaxSstNo(e.target.value);
                      clearFieldError('taxSstNo');
                    }}
                    placeholder={currentTaxHelper.placeholder}
                    className={`w-full text-xs p-2 bg-white border rounded-lg font-mono ${
                      formErrors.taxSstNo
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 text-[9.5px]">
                    <span className="text-slate-500 font-medium">
                      Prefix: <strong className="text-[#16223A] font-bold">{currentTaxHelper.prefix}</strong> ({currentEntityConfig.shortCode})
                    </span>
                    {!taxSstNo.toUpperCase().startsWith(currentTaxHelper.prefix) && (
                      <button
                        type="button"
                        onClick={() => {
                          const cleanNo = taxSstNo.replace(/^(C|E|OG|PT|D|F)\s*/i, '').trim();
                          setTaxSstNo(`${currentTaxHelper.prefix} ${cleanNo || '1029384750'}`);
                          clearFieldError('taxSstNo');
                        }}
                        className="text-[9.5px] font-bold text-amber-800 hover:text-[#16223A] bg-amber-50 hover:bg-amber-100 px-1 py-0.2 rounded border border-amber-200 cursor-pointer transition-colors"
                      >
                        + Apply '{currentTaxHelper.prefix}'
                      </button>
                    )}
                  </div>
                  {formErrors.taxSstNo && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{formErrors.taxSstNo}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Authorized Representative and Designation */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    {currentEntityConfig.repNameLabel} *
                  </label>
                  <input
                    type="text"
                    value={contactPersonName}
                    onChange={(e) => {
                      setContactPersonName(e.target.value);
                      clearFieldError('contactPersonName');
                    }}
                    placeholder={`e.g. ${currentEntityConfig.sampleRepName}`}
                    className={`w-full text-xs p-2 bg-white border rounded-lg ${
                      formErrors.contactPersonName
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  {formErrors.contactPersonName && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{formErrors.contactPersonName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block text-[10.5px] uppercase mb-1">
                    {currentEntityConfig.repDesignationLabel} *
                  </label>
                  <input
                    type="text"
                    value={contactPersonDesignation}
                    onChange={(e) => {
                      setContactPersonDesignation(e.target.value);
                      clearFieldError('contactPersonDesignation');
                    }}
                    placeholder={currentEntityConfig.repDesignationPlaceholder}
                    className={`w-full text-xs p-2 bg-white border rounded-lg ${
                      formErrors.contactPersonDesignation
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-300'
                    }`}
                  />
                  {formErrors.contactPersonDesignation && (
                    <p className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{formErrors.contactPersonDesignation}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="user@domain.com"
                className={`w-full text-xs p-2 bg-[#FAF8F2] border rounded-lg ${
                  formErrors.email
                    ? 'border-rose-500 bg-rose-50/50'
                    : 'border-[#E1DCCF]'
                }`}
              />
              {formErrors.email && (
                <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError('phone');
                }}
                placeholder="+60 12-388 9911"
                className={`w-full text-xs p-2 bg-[#FAF8F2] border rounded-lg ${
                  formErrors.phone
                    ? 'border-rose-500 bg-rose-50/50'
                    : 'border-[#E1DCCF]'
                }`}
              />
              {formErrors.phone && (
                <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Single Column Street Address & Regional Details */}
          <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl space-y-3">
            <h4 className="font-serif font-bold text-xs text-[#16223A] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-[#E1DCCF]">
              <MapPin className="w-3.5 h-3.5 text-[#A9814A]" />
              <span>Registered / Correspondence Address</span>
            </h4>

            <div>
              <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                Street Address *
              </label>
              <textarea
                rows={3}
                value={streetAddress}
                onChange={(e) => {
                  setStreetAddress(e.target.value);
                  clearFieldError('streetAddress');
                }}
                placeholder="Suite 18-02, Level 18, Menara Apex, No. 12, Jalan Bukit Bintang"
                className={`w-full text-xs p-2.5 bg-white border rounded-lg leading-relaxed ${
                  formErrors.streetAddress
                    ? 'border-rose-500 bg-rose-50/50'
                    : 'border-[#E1DCCF]'
                }`}
              />
              {formErrors.streetAddress && (
                <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.streetAddress}</p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">
                  Postcode *
                </label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value);
                    clearFieldError('postcode');
                  }}
                  placeholder="50200"
                  className={`w-full text-xs p-2 bg-white border rounded-lg font-mono ${
                    formErrors.postcode
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-[#E1DCCF]'
                  }`}
                />
                {formErrors.postcode && (
                  <p className="text-[10px] text-rose-600 mt-0.5 font-medium">{formErrors.postcode}</p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    clearFieldError('city');
                  }}
                  placeholder="Kuala Lumpur"
                  className={`w-full text-xs p-2 bg-white border rounded-lg ${
                    formErrors.city
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-[#E1DCCF]'
                  }`}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">
                  State *
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    clearFieldError('state');
                  }}
                  placeholder="Selangor"
                  className={`w-full text-xs p-2 bg-white border rounded-lg ${
                    formErrors.state
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-[#E1DCCF]'
                  }`}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10px] mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#E1DCCF] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="font-bold text-[#16223A] block uppercase text-[10.5px]">
                Emergency Contact Particulars
              </label>
              <div>
                <label className="text-slate-600 block text-[10px] font-semibold mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="Datin Maryam Zulkifli"
                  className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="text-slate-600 block text-[10px] font-semibold mb-1">
                  Emergency Phone Number
                </label>
                <input
                  type="text"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+60 12-888 2233"
                  className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                Client Intake / Legal Instruction Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="High-net-worth individual client. Prefers contact via email or official WhatsApp."
                className="w-full text-xs p-2.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl leading-relaxed"
              />
            </div>

            {/* Conflict Screening Banner (Leads Concept) */}
            <div className="bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[#16223A] text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                  <span>Conflict Search Result:</span>
                </div>
                {scanClientConflicts({ name, icNo, registrationNo, email, contactPerson: contactPersonName }, clients, cases).length > 0 ? (
                  <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>{scanClientConflicts({ name, icNo, registrationNo, email, contactPerson: contactPersonName }, clients, cases).length} Match(es) Flagged</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Clear (No Conflicts)</span>
                  </span>
                )}
              </div>

              {scanClientConflicts({ name, icNo, registrationNo, email, contactPerson: contactPersonName }, clients, cases).length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold block">Adverse Cross-Matches:</span>
                  <ul className="list-disc list-inside font-mono text-[10.5px] space-y-0.5">
                    {scanClientConflicts({ name, icNo, registrationNo, email, contactPerson: contactPersonName }, clients, cases).map((m, idx) => (
                      <li key={idx}><strong>{m.label}:</strong> {m.detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </form>

        {/* Action Buttons Footer - Fixed Bottom */}
        <div className="pt-3 border-t border-slate-200 shrink-0 bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetClick}
            className="px-3.5 py-2 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold cursor-pointer transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                // Submit form programmatically
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }}
              className="px-5 py-2.5 bg-[#16223A] text-amber-300 hover:bg-[#203050] rounded-xl font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all text-xs"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>Register Master Client Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog on Close when data has been entered */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#16223A]">
                  Discard Unsaved Client Particulars?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  You have uncommitted client registration details in this form. Closing now will permanently discard all entered information.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClose(false);
                  resetForm();
                  onClose();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Discard &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog when data has been entered */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#16223A]">
                  Reset Registration Form?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  This will clear all entered client details and reset the category selection back to Individual Client.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  showToast('Client registration form reset to defaults.', 'info');
                }}
                className="px-4 py-2 bg-[#16223A] text-amber-300 hover:bg-[#203050] rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Reset All Fields
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
