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
  referralSourceCategory?: 'Social Media' | 'Existing Client' | 'Referral Partner' | 'Walk-In' | 'Website' | 'Event / Seminar' | 'Other';
  socialMediaPlatform?: 'Facebook' | 'Instagram' | 'TikTok' | 'LinkedIn' | 'XiaoHongShu / XHS' | 'YouTube' | 'WhatsApp / Telegram' | 'Other';
  referralDetail?: string;
  warmth?: LeadWarmth;
  warmthLevel?: number; // 1 to 3 (1: Cold, 2: Warm, 3: Hot)
  stage: 'Inquiry' | 'Pending' | 'Contacted' | 'Consultation' | 'Quoted' | 'Converted' | 'Lost';
  autoConflictMatches?: ConflictMatch[];
  conflictCheck: ConflictCheck;
  quoteAmount: number;
  assignedTo?: string;
  followupDate: string;
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
  lastLoginAt?: string;
  autoConflictMatches?: ConflictMatch[];
  conflictCheck?: ConflictCheck;
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
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined';
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
  status: 'Draft' | 'Pending Review' | 'Ready' | 'Unpaid' | 'Partial' | 'Paid' | 'Voided';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  lineItems?: QuotationLineItem[];
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
}

export interface Retainer {
  id: string;
  clientId: string;
  caseId: string;
  type: 'Deposit' | 'Apply' | 'Refund';
  amount: number;
  date: string;
  remarks: string;
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
  leaveType: 'Annual' | 'Medical' | 'Emergency' | 'Unpaid' | 'Replacement';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerNote?: string;
}

export interface ActivityLog {
  ts: string;
  user: string;
  action: string;
  details: string;
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

export interface SequenceCounters {
  invoiceSeq: number;
  quotationSeq: number;
  caseSeq: number;
  receiptSeq: number;
  voucherSeq: number;
  claimSeq: number;
  clientSeq: number;
  leadSeq: number;
}

export interface PracticeAreaConfig {
  id: string;
  name: string;
  code: string;
  color?: string;
  description?: string;
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

