/**
 * Types for SHCO Legal Practice Management System
 * Full compliance with Malaysian Law (Solicitors' Account Rules 1990, SRO 2023, LPA)
 */

// Allows the fixed base roles plus any firm-defined custom role name
export type Role = 'Partner' | 'Lawyer' | 'Assistant' | 'Reviewer' | 'Client' | (string & {});
export type PartnerCode = 'SH' | 'AH' | 'ZA';
export type ThemePreference = 'light' | 'dark' | 'system';

export type FirmAnnouncementCategory = 'Announcement' | 'Birthday' | 'Call to the Bar' | 'Work Anniversary' | 'Firm Anniversary' | 'Holiday' | 'Policy' | 'Alert';

export interface FirmAnnouncement {
  id: string;
  title: string;
  body: string;
  category: FirmAnnouncementCategory;
  eventDate?: string;
  createdAt: string;
  createdBy: string;
  published: boolean;
  internalOnly: boolean;
}

export interface FirmStartCentreCard {
  id: string;
  title: string;
  detail: string;
}

export interface FirmStartCentrePage {
  id: string;
  label: string;
  icon: string; // lucide-react icon name, e.g. "UserPlus"
  cards: FirmStartCentreCard[];
}

export interface ConflictCheck {
  status: 'Not Started' | 'Clear' | 'Flagged';
  notes: string;
  checkedBy: string;
  checkedDate: string;
}

export interface ConflictMatch {
  label: string;
  detail: string;
}

export type LeadWarmth = 'Hot' | 'Warm' | 'Cold';

export interface NewCasePrefill {
  clientId?: string;
  clientName?: string;
  caseTitle?: string;
  practiceArea?: string;
  opponentName?: string;
}

export interface PartyRecord {
  id: string;
  clientId?: string; // Reference to Client.id in firm client database
  name: string;
  role: string; // e.g. "1st Plaintiff", "2nd Plaintiff (Next Friend)", "1st Defendant", "2nd Defendant", "3rd Respondent", "Purchaser", "Vendor"
  icOrRegNo?: string;
  phone?: string;
  email?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  practiceArea: string;
  source: string;
  /** Lead source ("cat" in the Leads & Referrals design). Widened with `string & {}` so the
   * firm-editable source list (PracticeSettings.leadSources — Partner, Staff, Outside Referrer,
   * BNI, or any custom source added via "Edit lists") can be stored without a type change. */
  referralSourceCategory?: 'Social Media' | 'Existing Client' | 'Referral Partner' | 'Walk-In' | 'Website' | 'Event / Seminar' | 'Other' | (string & {});
  /** Widened for the firm-editable platform list (PracticeSettings.leadSocialPlatforms). */
  socialMediaPlatform?: 'Facebook' | 'Instagram' | 'TikTok' | 'LinkedIn' | 'XiaoHongShu / XHS' | 'YouTube' | 'WhatsApp / Telegram' | 'Other' | (string & {});
  referralDetail?: string;
  warmth?: LeadWarmth;
  warmthLevel?: number; // 1 to 3 (1: Cold, 2: Warm, 3: Hot)
  stage: 'Inquiry' | 'Pending' | 'Contacted' | 'Consultation' | 'Quoted' | 'Converted' | 'Lost';
  autoConflictMatches?: ConflictMatch[];
  conflictCheck: ConflictCheck;
  quoteAmount: number;
  assignedTo?: string;
  followupDate: string;
  // --- Leads & Referrals page (additive, all optional) ---
  /** "Reached us through" (design `ch`) — Direct / in person, WhatsApp, Instagram, Facebook,
   * TikTok, Event. Required for Partner / Staff / Existing Client / Outside Referrer leads;
   * BNI leads are always "BNI". */
  channel?: string;
  /** Programme the lead came from (source = Event / Seminar). */
  programmeId?: string;
  /** Client record created/linked when the lead was converted. */
  clientId?: string;
  /** Matter (file) opened for this lead, when known. */
  caseId?: string;
  /** ISO date (YYYY-MM-DD) the enquiry was received. */
  createdAt?: string;
  /** Consultation booking as "YYYY-MM-DD|h:mm AM". */
  consultationBooked?: string;
  /** Why the lead was lost (stage = Lost). */
  lostReason?: string;
}

/** One person registered for a Programme (Leads & Referrals -> Programmes). */
export interface ProgrammeAttendee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  /** How they registered: "Link", "QR code", "Staff entry". */
  via?: string;
  interest?: string;
  attended?: boolean;
  wantsConsultation?: boolean;
}

export interface Programme {
  id: string;
  title: string;
  type: 'Seminar' | 'Networking' | 'BNI' | 'Webinar' | 'Other' | 'Talk' | 'Roadshow' | 'Booth / exhibition';
  date: string;
  location?: string;
  registrations: number;
  attendance?: number;
  notes?: string;
  // --- Leads & Referrals page (additive, all optional) ---
  /** "Firm" or "Joint with <partner>". */
  organiser?: string;
  time?: string;
  capacity?: number;
  /** Person in charge — user display name. */
  pic?: string;
  slug?: string;
  /** Fields the registration form asks attendees for. */
  askFields?: string[];
  /** Auto-create a lead when a registrant asks for a consultation. */
  autoCreateLeads?: boolean;
  attendees?: ProgrammeAttendee[];
}

export interface KycDoc {
  id: string;
  name: string;
  type: string;
  uploadedDate: string;
  driveFolder: string;
  dataUrl?: string;
  mimeType?: string;
}

export type CorporateEntityCategory =
  | 'Sdn Bhd'
  | 'Berhad'
  | 'Enterprise'
  | 'Sole Proprietorship'
  | 'Partnership'
  | 'LLP'
  | 'Society/Association'
  | 'Foreign Corp'
  | 'Government / Statutory Body'
  | 'Cooperative (Koperasi)';

export interface Client {
  id: string;
  name: string;
  type: 'Individual' | 'Corporate';
  entityCategory?: CorporateEntityCategory;
  registrationNo?: string;
  taxSstNo?: string;
  salutation?: string;
  icNo?: string;
  icNumber?: string;
  nationality?: string;
  occupation?: string;
  contactPerson: string;
  contactPersonDesignation?: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  emergencyContactRelationship?: string;
  notes: string;
  associatedCases?: string[];
  associatedCaseRefs?: string[];
  kyc: KycDoc[];
  tags?: string[];
  status?: 'Active' | 'Inactive' | 'Pending KYC' | 'Archived';
  createdAt?: string;
  lastPortalInviteSent?: string;
  portalAccessEnabled?: boolean;
  portalUpdates?: ClientPortalUpdate[];
  lastLoginAt?: string;
  autoConflictMatches?: ConflictMatch[];
  conflictCheck?: ConflictCheck;
}

export interface ClientPortalUpdate {
  id: string;
  title: string;
  message: string;
  date: string;
  source: 'Billing' | 'Matter' | 'Firm';
}

export interface Hearing {
  id: string;
  purpose: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'Completed' | 'Adjourned' | 'Cancelled' | 'Postponed';
  outcome: string;
  clientAttendanceRequired?: 'Compulsory' | 'Optional' | 'Not Required';
  hearingReasonNote?: string;
}

export interface CaseDocument {
  id: string;
  name: string;
  category: string;
  uploadedDate: string;
  driveUrl?: string;
  dataUrl?: string;
  mimeType?: string;
}

export interface OpposingSolicitorRecord {
  id: string;
  partyRepresented: string; // e.g. "1st Defendant", "2nd Defendant", "3rd Respondent", "Intervener", "Co-Counsel"
  firmName: string; // Opposing Law Firm Name
  solicitors: string; // Attending Advocates, Associates, Pupils, Chambering Students, Interns
  firmRef?: string;
  contactNumber?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface AdvocateCounsel {
  id: string;
  name: string;
  roleTitle?: string;
  phone?: string;
  email?: string;
}

export interface LawFirmRegistryEntry {
  id: string;
  firmName: string;
  registrationNo?: string;
  address?: string;
  cityState?: string;
  phone?: string;
  email?: string;
  defaultRefFormat?: string;
  counsels?: AdvocateCounsel[];
  notes?: string;
}

export interface OpposingSolicitorHistory {
  id: string;
  firmName: string;
  solicitorName?: string;
  firmRef?: string;
  contactNumber?: string;
  email?: string;
  effectiveDate: string; // e.g. "2026-08-04"
  remarks?: string; // e.g. "Notice of Change of Solicitor filed"
}

export interface CourtDiaryEntry {
  id: string;
  date: string;
  caseNo: string;
  court: string;
  matter: string;
  corum: string;
  medium?: 'OPEN COURT' | 'IN CHAMBERS' | 'E-REVIEW';
  clientRole?: string;
  opposingFirm?: string;
  opposingCounselName?: string;
  ourLawyerAttendance: string;
  opponentCounselAttendance: string;
  plaintifApplicant?: string;
  defendantRespondent?: string;
  clientName?: string;
  clientAttendance: 'Present' | 'Not Present';
  opponentName?: string;
  opponentAttendance: 'Present' | 'Not Present';
  caseStatus: string;
  instructions: string;
  courtDirections: string;
  nextDate: string;
  tasks: string;
  links: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not Started' | 'In Progress' | 'In Review' | 'Completed' | 'Pending' | 'Under Review' | 'Done';
  stageTag?: 'PTCM' | 'Pleading Stage' | 'Settlement' | 'Mediation' | 'Trial' | 'Submissions' | 'Pending Decision' | 'Decision' | string;
  categoryTag?: string;
  dueDate: string;
  assignedTo: string; // Full name display (e.g. Syafiqah Hamizad)
  taskType: 'Standard' | 'Review' | 'Drafting' | 'Filing' | 'Research' | 'Appearance' | string;
  description?: string;
  notes?: string;
  checklist?: TaskChecklistItem[];
  attachments?: TaskAttachment[];
  reviewer?: string;
  reviewStatus?: 'Needs Review' | 'In Review' | 'Approved' | 'Changes Requested';
  reviewerComments?: string;
  googleTasksSynced?: boolean;
  completedAt?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export interface ServiceRecord {
  id: string;
  date: string;
  documentServed: string;
  servedOn: string;
  method: string;
  servedBy: string;
  proofObtained: 'Y' | 'N';
  notes: string;
}

export interface MeetingNote {
  id: string;
  date: string;
  ourLawyers: string;
  clientAttendees: string;
  meetingNotes: string;
  decisions: string;
  recordedBy: string;
  gdriveDocUrl?: string;
  isAiGenerated?: boolean;
}

export interface InternalNote {
  id: string;
  date: string;
  noteType: string;
  content: string;
  recordedBy: string;
}

export interface ResearchNote {
  id: string;
  date: string;
  title: string;
  issues: string;
  partiesAndCourts: string;
  findingsAndRatio: string;
  applicationToCase: string;
  fullCaseDownloadUrl?: string;
  gdriveLibraryRef?: string;
  preparedBy: string;
}

export interface CaseStatusDetails {
  currentStatus: string;
  nextAction: string;
  nextActionDueDate: string;
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
  reviewer: string;
  reviewStatus: 'Pending Review' | 'In Review' | 'Approved' | 'Changes Requested';
}

export interface CaseActivityLog {
  id: string;
  timestamp: string;
  type: 'Document Upload' | 'Milestone Completion' | 'Status Update' | 'Court Event' | 'Service Record' | 'Compliance Check' | 'Financial Transaction' | 'Meeting Recorded' | 'Note Added';
  title: string;
  description: string;
  actor: string;
  badgeColor?: string;
  metadata?: Record<string, any>;
}

export interface Case {
  id: string;
  ref: string;
  title: string;
  createdDate?: string;
  fileOpenedDate?: string;
  clientId: string;
  clientName?: string;
  clientsList?: PartyRecord[]; // Multiple clients represented by SHCO in this matter
  type: string; // Practice Area
  practiceArea?: string; // Explicit reporting/filter tag, separate from matter code
  matterCode?: string; // Specific matter/work type code within the practice area
  lawyerInCharge?: string; // Assigned lawyer/file handler controlling matter access
  clientRole?: string; // e.g. Plaintiff, Defendant, Appellant, Applicant, Respondent, Purchaser, Vendor, OKT, etc.
  subtype?: string; // e.g. SPA, MOT, TENANCY, LOAN, POC, etc.
  customSubtype?: string;
  courtCaseNo?: string;
  court: string;
  judge: string;
  opposingParty: string;
  opposingParties?: string[];
  opposingPartiesList?: PartyRecord[]; // Multiple opposing parties (1st Defendant, 2nd Defendant, etc.)
  opposingCounsel: string[];
  opposingCounselFirms?: string[];
  opposingSolicitorsFirm?: string;
  opposingSolicitorsName?: string;
  opposingSolicitorsRef?: string;
  opposingSolicitorsPhone?: string;
  opposingSolicitorsEmail?: string;
  opposingSolicitorsHistory?: OpposingSolicitorHistory[];
  opposingSolicitorsRegistry?: OpposingSolicitorRecord[];
  partners: PartnerCode[];
  lawyers: string[];
  status: 'Active' | 'Pending' | 'Closed' | 'Archive';
  nextHearing: string;
  lastAccessed: string;
  referredBy?: string;
  caseNotes: string;
  stage?: string;
  notes?: string;
  nextAction?: string;
  caseStatusDetails?: CaseStatusDetails;
  hearings: Hearing[];
  documents: CaseDocument[];
  courtDiary: CourtDiaryEntry[];
  tasks: Task[];
  serviceRecord: ServiceRecord[];
  meetingNotes: MeetingNote[];
  internalNotes: InternalNote[];
  researchNotes?: ResearchNote[];
  memos?: { id: string; type: 'Notes' | 'Status' | 'Court Minutes' | 'File Location'; date: string; description: string }[];
  activityLogs?: CaseActivityLog[];
  disbursementCapAmount?: number;
  disbursementAgreedWithClient?: number;
  gdriveFolderId?: string;
  gdriveFolderUrl?: string;
  gdriveCategory?: 'Litigation' | 'Conveyancing' | 'Criminal' | 'Corporate' | string;
  gdriveParentFolderName?: string;

  // Conveyancing & Property specifics
  propertyTitleNo?: string;
  propertyAddress?: string;
  purchasePrice?: number | string;
  financierBank?: string;
  developerName?: string;
  completionDate?: string;
  spaDate?: string;
  redemptionStatus?: string;
  motStatus?: string;

  // Corporate & Advisory specifics
  corporateMatterType?: string;
  contractValue?: number | string;
  regulatoryAuthority?: string;
  governingLaw?: string;
  targetClosingDate?: string;
  retainerStatus?: string;
}

export interface QuotationLineItem {
  description: string;
  category: 'Fee - Fixed' | 'Fee - SRO' | 'Disbursement' | 'Reimbursement';
  amount: number;
  /** Number of units billed (e.g. 3 searches). Defaults to 1. */
  quantity?: number;
  /** Price per unit. Amount is auto-counted as quantity × unitPrice. */
  unitPrice?: number;
  /** 'Per Quantity' auto-counts amount from quantity × unitPrice; 'Fixed' locks the charge. */
  chargeType?: 'Per Quantity' | 'Fixed';
}

export interface Quotation {
  id: string;
  documentType?: 'Quotation' | 'Proforma';
  sourceQuotationId?: string;
  partyType?: 'Client' | 'Prospect';
  partyId?: string;
  formatMode?: 'Standard' | 'General';
  notes?: string;
  paymentTerms?: string;
  validityDays?: number;
  consultationDate?: string;
  consultationType?: 'Initial Consultation' | 'Follow-up Consultation' | 'Urgent Consultation' | 'Document Review' | 'Video Consultation';
  consultationDurationMinutes?: number;
  date: string;
  practiceArea: string;
  fileRef: string;
  leadId: string;
  clientName: string;
  status: 'Draft' | 'Pending Approval' | 'Ready' | 'Sent' | 'Accepted' | 'Declined';
  total: number;
  billedSoFar: number;
  remaining: number;
  courtLevel: string;
  stage: string;
  feeMethod: 'SRO Scale' | 'Fixed' | 'Template';
  subtype: string;
  approvalStatus: 'Pending' | 'Approved';
  approvedBy: string;
  approvedDate: string;
  lineItems: QuotationLineItem[];
  /** Whether SST was ticked on for this document — the firm isn't SST-registered yet, so
   * this defaults false; `total` already has SST baked in when true (see computeTotals). */
  sstApplied?: boolean;
  lastEditedBy?: string;
  lastEditedAt?: string;
  documents?: ClaimDocument[];
  documentSentDate?: string;
  documentSentBy?: string;
  /** Accounts & Finance document fields (finance-docs format). All optional/additive. */
  caseId?: string;
  /** Matter title shown on the document (e.g. "SPA Taman Bangi"). */
  matter?: string;
  subject?: string;
  yourRef?: string;
  tin?: string;
  /** Scope-of-work paragraph printed under PROFESSIONAL FEES. */
  scope?: string;
  terms?: string[];
  feeArrangement?: FinanceFeeArrangement | null;
  /** Which bank account the client pays into (Office vs Client account). */
  payInto?: 'Office' | 'Client account';
  /** Per-document SST rate actually used (0.06 / 0.08) when sstApplied. */
  sstRate?: number;
}

export interface QuoteTemplate {
  id: string;
  practiceArea: string;
  courtLevel: string;
  stage: string;
  description: string;
  category: 'Fee - Fixed' | 'Disbursement' | 'Reimbursement';
  amount: number;
}

export interface ReferralPartner {
  id: string;
  name: string;
  type: 'External' | 'Partner' | 'Internal Staff';
  contact: string;
  commissionType: 'Percentage' | 'Flat' | 'None';
  commissionValue: number;
  amountOwed: number;
  paymentStatus: 'Paid' | 'Owing' | 'N/A';
  lastPaymentDate: string;
  notes: string;
  active: boolean;
}

export interface Deadline {
  id: string;
  caseId: string;
  title: string;
  type: 'Filing' | 'Compliance' | 'Limitation' | 'Court Order';
  dueDate: string;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low';
  status: 'In Progress' | 'In Review' | 'Completed';
  reminderDays: number;
  notes: string;
  partner: string;
  lawyer: string;
}

export interface Court {
  id: string;
  name: string;
  city: string;
}

export interface Judge {
  id: string;
  name: string;
  courtId: string;
}

export interface TimeEntry {
  id: string;
  caseId: string;
  feeEarner: string;
  date: string;
  hours: number;
  rate: number;
  billable: boolean;
  billed?: boolean;
  writtenOff?: boolean;
  invoiceId?: string;
  description?: string;
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Billed' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  url: string;
  type?: string;
  category?: 'Receipt Photo' | 'Toll Slip' | 'Parking Voucher' | 'Official Invoice' | 'Other Document';
  size?: number;
  uploadedAt?: string;
}

export interface Expense {
  id: string;
  caseId: string;
  fileRef?: string;
  date: string;
  category: string;
  amount: number;
  billable: boolean;
  billed?: boolean;
  writtenOff?: boolean;
  description?: string;
  claimant?: string;
  isClaimantAdvance?: boolean;
  payee?: string;
  accountSet?: 'CLIENT' | 'OFFICE';
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Posted to GL' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  postedToGl?: boolean;
  attachmentName?: string;
  attachmentUrl?: string;
  documents?: ClaimDocument[];
  isClientUpfrontCovered?: boolean;
  clientTrustBalanceSnapshot?: number;
  /** Staff Portal claim form this item was submitted on (e.g. 'CF-26-0413'). */
  formNo?: string;
  /** Accounts & Finance additions (optional/additive). Office expense: which account paid it. */
  paidFrom?: string;
  signatories?: FinanceSignatory[];
  paidAt?: string;
  paidProof?: FinanceProof;
}

export interface Invoice {
  id: string;
  clientId: string;
  caseId: string;
  fileRef?: string;
  quotationId?: string;
  partyType?: 'Client' | 'Prospect';
  partyName?: string;
  amount: number;
  discount: number;
  tax: number;
  total: number;
  date: string;
  dueDate: string;
  status: 'Draft' | 'Pending Review' | 'Ready' | 'Sent' | 'Unpaid' | 'Partial' | 'Paid' | 'Voided';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  eInvoiceStatus?: 'Not Submitted' | 'Pending' | 'Validated' | 'Rejected';
  eInvoiceUuid?: string;
  eInvoiceQrUrl?: string;
  eInvoiceSubmittedAt?: string;
  lineItems?: QuotationLineItem[];
  /** Accounts & Finance document fields (finance-docs format). All optional/additive. */
  matter?: string;
  subject?: string;
  yourRef?: string;
  tin?: string;
  scope?: string;
  payInto?: 'Office' | 'Client account';
  sstRate?: number;
  feeArrangement?: FinanceFeeArrangement | null;
  /** Keyed in from previous books via Books & Reports → Import past transactions. */
  historical?: boolean;
  /** Amount written off (approved by the Managing Partner) — reduces the debtor balance. */
  writtenOff?: number;
  writeOffRequest?: WriteOffRequest;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
}

export interface Receipt {
  id: string;
  date: string;
  accountSet: 'OFFICE' | 'CLIENT';
  receivedFrom: string;
  description: string;
  amount: number;
  debit: string;
  credit: string;
  clientId: string;
  fileRef: string;
  bankRef: string;
  bankAccountId?: string;
  bankAccountName?: string;
  receivedBy: string;
  /** Accounts & Finance additions (optional/additive). */
  paymentMethod?: string;
  /** Document this receipt is for (invoice / proforma number, or free text e.g. "deposit"). */
  forNo?: string;
  invoiceId?: string;
  quotationId?: string;
  caseId?: string;
  proofs?: FinanceProof[];
  historical?: boolean;
}

export interface PaymentVoucher {
  id: string;
  date: string;
  accountSet: 'OFFICE' | 'CLIENT';
  voucherCategory: 'Office Account' | 'Client Account' | 'Disbursement' | 'Travelling' | 'Office Operating' | 'Client Disb' | 'Legal Fees Transfer';
  payee?: string;
  paymentMethod?: string;
  description: string;
  amount: number;
  debit: string;
  credit: string;
  clientId: string;
  fileRef: string;
  bankRef?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  preparedBy?: string;
  approvedBy?: string;
  approved?: boolean;
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Posted to GL' | 'Rejected';
  postedToGl?: boolean;
  attachmentName?: string;
  attachmentUrl?: string;
  documents?: ClaimDocument[];
  /** Staff Portal payment request (PV) form number, e.g. 'PV-O-26-0012'. */
  formNo?: string;
  /** Staff Portal payment request type. */
  requestKind?: 'Despatch' | 'Disbursement' | 'Office bill';
  /** Vendor's bank + account no. (bank-transfer payment requests). */
  vendorBank?: string;
  /** Case / bill / assessment no. (online-portal payment requests). */
  portalRef?: string;
  /** Accounts & Finance additions (optional/additive). */
  caseId?: string;
  invoiceId?: string;
  signatories?: FinanceSignatory[];
  rejectedBy?: string;
  paidAt?: string;
  paidProof?: FinanceProof;
  historical?: boolean;
  proofs?: FinanceProof[];
}

export interface TravelClaim {
  id: string;
  date: string;
  claimant: string;
  purposeType: 'Client Matter' | 'Firm/Internal';
  fileRef: string;
  firmCategory?: string;
  type: 'Mileage' | 'Parking/Toll' | 'Other';
  purpose: string;
  from: string;
  to: string;
  km: number;
  rate: number;
  mileageAmount: number;
  tollAmount?: number;
  parkingAmount?: number;
  otherAmount: number;
  total: number;
  billableClientTotal?: number;
  paidFrom: string;
  billed: 'Y' | 'N' | 'N/A' | 'BILLABLE_EXCEEDED';
  invoiceNo: string;
  postedRef: string;
  attachmentName?: string;
  attachmentUrl?: string;
  documents?: ClaimDocument[];
  isClientUpfrontCovered?: boolean;
  clientTrustBalanceSnapshot?: number;
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Posted to GL' | 'Rejected' | 'Pending PIC Approval';
  approvedBy?: string;
  approvedAt?: string;
  postedToGl?: boolean;
  /** Staff Portal claim form this item was submitted on (e.g. 'CF-26-0413'). */
  formNo?: string;
  /** Accounts & Finance additions (optional/additive). */
  signatories?: FinanceSignatory[];
  paidAt?: string;
  paidProof?: FinanceProof;
}

export interface Retainer {
  id: string;
  clientId: string;
  caseId: string;
  type: 'Deposit' | 'Apply' | 'Refund';
  amount: number;
  date: string;
  remarks: string;
  /** True when a receipt/deposit came in without a clear client/matter link and could not
   * be auto-matched to this clientId/caseId. Nothing in the app sets this yet — the
   * "Items to check" list on My Dashboard → Client account shows an honest empty state
   * until an intake flow starts flagging these. */
  unidentified?: boolean;
  /** Receipt / voucher number this ledger line came from (OR / PV). */
  voucherNo?: string;
}

export interface OfficeBucket {
  code: string;
  name: string;
  balance: number;
  target: number | null;
  purpose: string;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  notes: string;
}

export interface GeneralLedgerEntry {
  glNo: number;
  date: string;
  docType: 'OR' | 'PV' | 'INV' | 'JV';
  docNo: string;
  accountSet: 'OFFICE' | 'CLIENT';
  debit: string;
  credit: string;
  amount: number;
  clientId: string;
  fileRef: string;
  description: string;
  reconciled: 'Y' | 'N';
}

export interface TrialBalanceRow {
  code: string;
  account: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CashFlowRow {
  month: string;
  opening: number;
  moneyIn: number;
  moneyOut: number;
  closing: number;
}

export interface ThreeWayRecRow {
  month: string;
  bankStatement: number;
  depositsNotCleared: number;
  paymentsNotPresented: number;
  adjustedBank: number;
  cashBookGL: number;
  matterLedgerTotal: number;
  bankVsCashBook: number;
  cashBookVsLedger: number;
  status: 'MATCHED' | 'UNMATCHED';
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  clientPassword?: string;
  status: 'Active' | 'Inactive';
  navOverrides?: Record<string, ModulePermissions>;
  staffProfile?: StaffProfile;
}

export interface StaffProfile {
  staffId: string;
  designation: string;
  department: string;
  phone: string;
  emergencyContact: string;
  joinDate: string;
  employmentType: 'Permanent' | 'Contract' | 'Freelance' | 'Intern';
  officeLocation: string;
  bio: string;
  birthday?: string;
  callToBarDate?: string;
  celebrationOptOut?: boolean;
  /** Monthly performance targets this person sets for themselves (My Dashboard -> My Performance). */
  targets?: {
    billed: number;
    collected: number;
    files: number;
    referrals: number;
  };
  /** Target billable hours per month used by the Team tab's workload rule (My Dashboard -> Team).
   * Additive field — no target-hours data existed before, so this defaults to 160 (a standard
   * full-time month) rather than being fabricated per person. */
  targetHoursPerMonth?: number;
  /** Career & personal development goals shown on the Team tab's expanded row (My Dashboard -> Team).
   * Added and edited by the Managing Partner via addStaffGoal/updateStaffGoal. */
  goals?: StaffGoal[];
  /** Monthly wellbeing check-ins from Staff Portal -> Goals & wellbeing. Only the Managing
   * Partner should see these. `period` is 'YYYY-MM' (one per month); `mood` is 1-5 where
   * 5 = Great, 4 = Good, 3 = Okay, 2 = Stretched, 1 = Struggling, and 0 = no rating given.
   * When `anonymous` is true, MP-facing views must show the note without the staff name. */
  moodCheckins?: { period: string; mood: number; note?: string; at: string; topics?: string[]; anonymous?: boolean; chatRequested?: boolean }[];
  /** Payroll identity shown on the Staff Portal payslip / EA form. Blank until HR fills them in. */
  nric?: string;
  epfNo?: string;
  socsoNo?: string;
  bankName?: string;
  bankAccountNo?: string;
}

export interface StaffGoal {
  id: string;
  type: 'Career' | 'Personal';
  text: string;
  /** Progress toward the goal, 0-100. */
  pct: number;
  /** "How you can help" note — what the Managing Partner/firm can do to support this goal. */
  help: string;
  /** Target date, free text as typed in Staff Portal (e.g. 'Mar 2027'). */
  by?: string;
  /** Staff Portal status pill. */
  status?: 'Not started' | 'On track' | 'Behind' | 'Done';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'Present' | 'Late' | 'Absent' | 'Remote' | 'Leave';
  notes?: string;
}

export interface LeaveApplication {
  id: string;
  userId: string;
  leaveType: 'Annual' | 'Medical' | 'Emergency' | 'Unpaid' | 'Replacement' | 'Hospitalisation' | 'Maternity' | 'Paternity' | 'Compassionate' | 'Marriage' | 'Study / exam' | 'Hajj' | 'Umrah';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerNote?: string;
  /** Colleague covering this person's files while away (Staff Portal). */
  pic?: string;
  /** Half-day leave on a single day. */
  halfDay?: 'AM' | 'PM';
  /** Supporting document (MC, discharge note, exam slip...) file name. */
  attachmentName?: string;
}

export interface ActivityLog {
  ts: string;
  user: string;
  action: string;
  details: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, 24h
  durationMinutes?: number;
  location?: string;
  note?: string;
  type: 'Internal' | 'Network' | 'Client' | 'Team';
  attendees?: string[];
  caseId?: string;
  createdBy?: string;
}

export interface ModulePermissions {
  v: number; // View
  a: number; // Add
  e: number; // Edit
}

export type RolePermissionsMatrix = Record<Role, Record<string, ModulePermissions>>;

export interface DocTemplate {
  id: string;
  name: string;
  category: string;
  contentSnippet?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'hearing' | 'invoice' | 'system';
  timestamp: string;
  read: boolean;
  linkTab?: string;
  linkId?: string;
}

export type BankAccountType = 'Trust' | 'Office';
export type BankAccountFunction =
  | 'Office Account'
  | 'Trust Account'
  | 'Petty Cash'
  | 'Sinking Fund'
  | 'Disbursement'
  | 'Partner Draws'
  | 'Payroll';

export interface VirtualPot {
  id: string;
  name: string;
  allocatedAmount: number;
  targetAmount?: number;
  purpose: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  type: BankAccountType;
  functions: BankAccountFunction[];
  branch: string;
  swiftCode?: string;
  openingBalance: number;
  currentBalance: number;
  status: 'Active' | 'Archived';
  notes?: string;
  virtualPots?: VirtualPot[];
}

export interface TrustAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  clientName: string;
  caseRef: string;
  bankAccountId: string;
  bankAccountName: string;
  action: 'Deposit' | 'Disbursal' | 'Transfer' | 'Reconciliation' | 'Adjustment';
  amount: number;
  previousBalance: number;
  newBalance: number;
  remarks: string;
  complianceStatus: 'Compliant' | 'Flagged' | 'Reviewed';
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Stationery' | 'Law Library' | 'IT Equipment' | 'Office Supply' | 'Pleadings Bundle';
  quantity: number;
  unit: string;
  minThreshold: number;
  location: string;
  lastRestocked: string;
  unitPrice: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  isbnOrSerial?: string;
  notes?: string;
  borrowedBy?: string;
}

export interface BankReconciliationEntry {
  id: string;
  date: string;
  bankAccountId: string;
  bankAccountName: string;
  description: string;
  referenceNo: string;
  debit: number;
  credit: number;
  matchedGlNo?: number;
  status: 'Reconciled' | 'Unreconciled';
  reconciledBy?: string;
  reconciledDate?: string;
}

/** Audit trail for a "My Dashboard → Client account → Items to check" row being marked
 * checked. itemKey identifies the flagged item (e.g. `overdrawn:<clientId>:<caseId>`,
 * `dormant:<clientId>:<caseId>`, `stakeholder:<clientId>:<caseId>`). Additive — does not
 * change how the underlying Retainer balances are computed. */
export interface ClientAccountCheck {
  itemKey: string;
  checkedBy: string;
  checkedAt: string;
}

export interface SequenceCounters {
  invoiceSeq: number;
  quotationSeq: number;
  caseSeq: number;
  receiptSeq: number;
  voucherSeq: number;
  claimSeq: number;
  clientSeq: number;
  leadSeq: number;
  expenseSeq: number;
  journalSeq?: number;
}

export interface PracticeAreaConfig {
  id: string;
  name: string;
  code: string;
  color?: string;
  description?: string;
}

/** One row in the firm's office compliance register (My Dashboard → Compliance sub-tab). */
export interface ComplianceItem {
  id: string;
  group: 'AMLA' | 'Client account' | 'Bar Council' | 'PDPA' | 'Tax/payroll/licences';
  label: string;
  note?: string;
  frequency: 'Monthly' | 'Quarterly' | 'Annual' | 'One-off';
  due: string; // ISO date (yyyy-mm-dd) — the current period's due date
  owner: string; // staff initials/code
  done: boolean;
  history?: { period: string; completedAt: string; completedBy: string }[];
}

/** A client complaint or piece of feedback logged from the Compliance sub-tab. */
export interface ComplaintRecord {
  id: string;
  matterRef?: string;
  summary: string;
  receivedDate: string; // ISO date
  status: 'Open' | 'Resolved';
  owner?: string;
}

export interface DeletedRecord {
  id: string;
  recordId: string;
  entityType: 'Case' | 'Lead' | 'Client' | 'Invoice' | 'Quotation' | 'Payment Voucher' | 'Receipt' | 'Expense' | 'Time Entry' | 'Law Firm';
  title: string;
  details: string;
  deletedAt: string;
  deletedBy: string;
  data: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'STATUS_CHANGE';
  collection: 'CASES' | 'CLIENTS' | 'LEADS' | 'INVOICES' | 'USERS' | 'SETTINGS' | string;
  recordId: string;
  recordTitle: string;
  details: string;
  performedBy: string;
  changes?: Record<string, any>;
}

/** One roadmap item on the firm's Business roadmap 2026-2028 (My Dashboard -> Direction,
 * Managing Partner only). Grouped by `year`; status is cycled Not started -> On track ->
 * Behind -> Done by clicking the pill. Firm-maintained — no other real data source for
 * a multi-year plan, so this starts empty until the Managing Partner adds milestones. */
export interface Milestone {
  id: string;
  year: number;
  text: string;
  status: 'Not started' | 'On track' | 'Behind' | 'Done';
}

/** A bank/insurer/GLC panel appointment tracked on My Dashboard -> Direction -> Growth ->
 * Panelships. Files and fees are partner-entered until Case/Invoice records carry a
 * panel reference — firm-maintained, not derived. */
export interface Panelship {
  id: string;
  name: string;
  kind: string;
  status: string;
  files: number;
  feesYtd: number;
  nextStep: string;
}

/** A marketing/business-development spend channel tracked on My Dashboard -> Direction ->
 * Growth -> "Where to put money". Firm-maintained — spend and fees won have no other real
 * data source in this system. */
export interface InvestmentChannel {
  id: string;
  name: string;
  spend: number;
  feesWon: number;
}

/** A 2026-plan target on My Dashboard -> Direction (Managing Partner only). `now` is
 * overridden with a computed value at render time for goals the app can measure for
 * real (fee income, new clients); otherwise it is the partner-entered figure. */
export interface FirmGoal {
  id: string;
  label: string;
  now: number;
  goal: number;
  status: string;
  note?: string;
}


export interface Payslip {
  id: string;
  userId: string;
  period: string; // 'YYYY-MM'
  status: 'Draft' | 'Checked' | 'Approved' | 'Paid';
  basic: number;
  allowances: { name: string; amount: number }[];
  referralFee: number;
  referralNote?: string;
  profitShare: number;
  profitShareNote?: string;
  bonus: number;
  bonusNote?: string;
  epfEmployee: number;
  epfEmployer: number;
  socsoEis: number;
  pcb: number;
  zakat: number;
  otherDeductions: { name: string; amount: number }[];
  paidAt?: string;
}

/* ---------------- Accounts & Finance module additions ---------------- */

/** One approver's sign-off on a finance item (claims, vouchers, client-account payments,
 * journals). Approval rule: < RM5k any partner; >= RM5k or anything from the client account
 * = Managing Partner + 1 more signatory. */
export interface FinanceSignatory {
  name: string;
  at: string;
  isManagingPartner: boolean;
}

/** Proof-of-payment file reference. Only metadata is synced — the firm has no object storage
 * connected yet, so the file itself is only viewable in the session it was attached in. */
export interface FinanceProof {
  name: string;
  size?: number;
  type?: string;
  uploadedAt: string;
}

export interface FinanceFeeArrangement {
  on: boolean;
  months: number;
  upfront: number;
  terms: string;
}

export interface WriteOffRequest {
  amount: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decidedBy?: string;
  decidedAt?: string;
}

/** Books & Reports → Manual journal (corrections only). Goes to Approvals; posts to the GL
 * (docType 'JV') once approved. Nothing is ever hard-deleted — rejected ones stay on file. */
export interface ManualJournal {
  id: string;
  date: string; // ISO yyyy-mm-dd
  account: 'Office' | 'Client account' | 'Disbursement' | 'Petty cash';
  direction: 'Money in' | 'Money out';
  details: string;
  amount: number;
  reason: string;
  preparedBy: string;
  createdAt: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  signatories?: FinanceSignatory[];
  decidedBy?: string;
  decidedAt?: string;
  proofs?: FinanceProof[];
}
