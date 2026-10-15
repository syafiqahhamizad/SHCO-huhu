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
  /** Optional link (Google Drive document, form, website). */
  link?: string;
}

export interface FirmStartCentrePage {
  id: string;
  label: string;
  icon: string; // lucide-react icon name, e.g. "UserPlus"
  cards: FirmStartCentreCard[];
}

interface ConflictCheck {
  /** 'Pending Partner Review': a possible match was found (e.g. at registration) and a partner
   * still has to decide. */
  status: 'Not Started' | 'Clear' | 'Flagged' | 'Pending Partner Review';
  notes: string;
  checkedBy: string;
  checkedDate: string;
}

export interface ConflictMatch {
  label: string;
  detail: string;
}

type LeadWarmth = 'Hot' | 'Warm' | 'Cold';

export interface NewCasePrefill {
  clientId?: string;
  clientName?: string;
  caseTitle?: string;
  practiceArea?: string;
  opponentName?: string;
}

interface PartyRecord {
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
  /** Where the file is, as a readable path (e.g. "Clients/Ahmad (HQ-C001)/KYC"). */
  driveFolder: string;
  /** The file in the firm Google Drive (Clients/<name (id)>/KYC/). New uploads always have it. */
  driveFileId?: string;
  webViewLink?: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  /** LEGACY, read-only: older uploads kept the whole file inline as a data URL (in the shared
   * Firestore document). Still opens; never written any more. */
  dataUrl?: string;
  mimeType?: string;
  /** Clients › KYC: which required document this is (KYC_REQUIREMENTS key, e.g. 'nric', 'ssm').
   * Older uploads have none and are matched by `type`. */
  requirement?: string;
  /** Clients › KYC review state. Absent on older uploads (read as verified when the client's CDD
   * records a verification, otherwise as waiting to be verified). */
  status?: 'To verify' | 'Verified';
  verifiedBy?: string;
  verifiedAt?: string;
}

/** Customer due diligence (AMLA 2001 / Bar Council AML/CFT guidance) captured on the client record. */
interface ClientCdd {
  riskRating?: 'Low' | 'Medium' | 'High';
  /** Politically exposed person (or family member / close associate of one). */
  pep?: 'No' | 'Yes' | 'Not checked';
  pepDetails?: string;
  sourceOfFunds?: string;
  sourceOfWealth?: string;
  purposeOfRelationship?: string;
  /** How identity was verified, e.g. "Original NRIC sighted", "SSM e-Info extract". */
  verificationMethod?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  /** Enhanced due diligence applied (high risk / PEP). */
  enhancedDueDiligence?: boolean;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
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
  /** Internal key (never changes; files, bills and receipts point to it). */
  id: string;
  /** Client number shown to people, CL<YY><NNN> (e.g. CL26833) (see lib/clientNumbers). */
  clientNo?: string;
  /** Where the client came from: a key of the Lead sources list (Settings › Lists & sources). */
  source?: string;
  /** Who referred them / which platform or event (from the registered lists). */
  sourceDetail?: string;
  name: string;
  type: 'Individual' | 'Corporate';
  entityCategory?: CorporateEntityCategory;
  registrationNo?: string;
  taxSstNo?: string;
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
  /** KYC documents this client needs (keys); not set = the firm's usual list for the client type. */
  kycRequired?: string[];
  /** Extra KYC documents named for this client only. */
  kycCustom?: { key: string; label: string; hint?: string }[];
  /** Customer due diligence (risk rating, PEP, source of funds, verification). */
  cdd?: ClientCdd;
  tags?: string[];
  status?: 'Active' | 'Inactive' | 'Pending KYC' | 'Archived';
  createdAt?: string;
  lastPortalInviteSent?: string;
  portalAccessEnabled?: boolean;
  portalUpdates?: ClientPortalUpdate[];
  lastLoginAt?: string;
  autoConflictMatches?: ConflictMatch[];
  conflictCheck?: ConflictCheck;
  /** Client Portal access (staff side, Clients › Portal access). Read by the Client Portal.
   * Older records without it fall back to portalAccessEnabled / lastPortalInviteSent. */
  portal?: { status: 'Not set up' | 'Invited' | 'Active' | 'Disabled'; loginEmail?: string; invitedAt?: string; visibility: { progress: boolean; documents: boolean; bills: boolean; statement: boolean; messages: boolean } };
  /** Clients › History: every change made to this record, newest first. */
  history?: ClientHistoryEntry[];
}

export interface ClientHistoryEntry {
  /** ISO timestamp. */
  at: string;
  by: string;
  what: string;
  /** Dot colour on the History tab. */
  kind?: 'edit' | 'kyc' | 'conflict' | 'portal' | 'file';
}

interface ClientPortalUpdate {
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
  /** Cases redesign (additive): days before the date the PIC wants a reminder (shown in My Work; e-mail reminders are not connected). */
  remindDaysBefore?: number;
  /** Where this hearing came from, e.g. "Court memo 2 Sep 2026". Absent = added by hand. */
  source?: string;
  /** Google Calendar (court diary) event id — set only after Google confirmed the event was created. */
  googleEventId?: string;
  googleEventLink?: string;
  /** Who added it and when. */
  addedBy?: string;
  addedAt?: string;
}

export interface CaseDocument {
  id: string;
  name: string;
  category: string;
  uploadedDate: string;
  driveUrl?: string;
  dataUrl?: string;
  mimeType?: string;
  /** Stored copy in Google Drive (driveFileId). storagePath = legacy Firebase Storage copy, read-only. */
  driveFileId?: string;
  storagePath?: string;
  /** Staff ticked "Share with client": the document shows in the Client Portal. Absent = not shared. */
  sharedWithClient?: boolean;
}

interface OpposingSolicitorRecord {
  id: string;
  partyRepresented: string; // e.g. "1st Defendant", "2nd Defendant", "3rd Respondent", "Intervener", "Co-Counsel"
  firmName: string; // Opposing Law Firm Name
  solicitors: string; // Attending Advocates, Associates, Pupils, Chambering Students, Interns
  firmRef?: string;
  contactNumber?: string;
  email?: string;
  isPrimary?: boolean;
}

interface AdvocateCounsel {
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

interface OpposingSolicitorHistory {
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
  /** Cases redesign (additive): reminder days before the next court date (data only). */
  remindDaysBefore?: number;
  /** Task created from this memo (Case.tasks id). */
  taskId?: string;
  recordedBy?: string;
  recordedAt?: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface TaskAttachment {
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
  /** Cases redesign (additive). 'Task' = ordinary to-do; anything else is a deadline
   * (court order / Rules of Court / limitation / key date) shown with a red DEADLINE tag. */
  kind?: TaskKind;
  /** Reminder lead time in days for deadlines (3 by default, 30 for limitation). Data only. */
  remindDaysBefore?: number;
  /** Lower-case phrase; logging a filing whose document contains it ticks this deadline off. */
  matchKey?: string;
  /** Where the task came from, e.g. "Court memo 2 Sep 2026" or "Meeting note 26 Sep". */
  source?: string;
  createdBy?: string;
  createdAt?: string;
  /** Date it was completed (YYYY-MM-DD). */
  doneOn?: string;
  /** User asked for Google Tasks sync (only the assignee's own Google Tasks can be written). */
  syncToGoogle?: boolean;
  /** Google Tasks id per user id (Google Tasks is per user) — set only after Google confirmed. */
  googleTaskIds?: Record<string, string>;
  /** The firm-calendar event this deadline is linked to (an event typed in Google before the portal had it). */
  googleEventId?: string;
}

/** Cases redesign: Task kinds. */
export type TaskKind = 'Task' | 'Court order' | 'Rules of Court' | 'Limitation' | 'Key date';

export interface ServiceRecord {
  id: string;
  date: string;
  documentServed: string;
  /** Party served on / received from — or, for a filing, the court. */
  servedOn: string;
  method: string;
  servedBy: string;
  proofObtained: 'Y' | 'N';
  notes: string;
  /** Cases redesign (additive). Absent on older records = 'Served'. */
  action?: 'Filed' | 'Served' | 'Received';
  proofType?: string;
  proofFileName?: string;
  /** Proof stored in the firm Google Drive (Case files/<file>/Filing or /Service). */
  driveFileId?: string;
  webViewLink?: string;
  /** LEGACY: proof stored in Firebase Storage before uploads moved to Google Drive (read-only). */
  storagePath?: string;
  recordedBy?: string;
  recordedAt?: string;
}

/** Cases redesign — one party on a file (clients we act for, opposing parties, opposing solicitors). */
export interface MatterParty {
  id: string;
  side: 'client' | 'opposing' | 'solicitor';
  name: string;
  /** NRIC / passport / company no. */
  idNo?: string;
  /** e.g. "1st Plaintiff", "2nd Defendant", "For 1st Defendant". */
  role: string;
  /** Phone / e-mail / counsel — free text shown under the name. */
  contact?: string;
  phone?: string;
  email?: string;
  /** Solicitors: which party they act for. */
  actsFor?: string;
  /** Firm ref (solicitors). */
  firmRef?: string;
  clientId?: string;
  since?: string;
  /** Set when a firm is replaced (notice of change). The firm stays listed, struck through. */
  dischargedOn?: string;
}

/** Cases redesign — court details kept beside the legacy Case.court / judge / courtCaseNo fields. */
interface MatterCourtDetails {
  level?: string;
  location?: string;
  address?: string;
  division?: string;
  coramSince?: string;
}

export interface MatterCourtChange {
  id: string;
  date: string;
  field: 'Coram' | 'Opp. solicitors' | 'Court details';
  from: string;
  to: string;
  reason: string;
  by?: string;
}

/** A client update on the file. Prepared first; "Sent by e-mail" only after Gmail confirmed
 * the send; WhatsApp only ever "Opened in WhatsApp" (the portal can't see delivery / read). */
export interface MatterClientUpdate {
  id: string;
  at: string;
  trigger: 'AUTO_STATUS' | 'AUTO_COURT_DATE' | 'MANUAL' | 'MANUAL_STATUS';
  title: string;
  message: string;
  channels: ('whatsapp' | 'email')[];
  deliveryStatus: 'Prepared — not sent' | 'Sent by e-mail' | 'Opened in WhatsApp' | 'Sent by e-mail · Opened in WhatsApp';
  by?: string;
  emailTo?: string;
  emailSentAt?: string;
  emailMessageId?: string;
  emailError?: string;
  whatsappOpenedAt?: string;
}

export interface MatterNote {
  id: string;
  kind: 'Meeting' | 'Phone call' | 'Client instructions' | 'Opposing side' | 'Legal research' | 'Internal';
  date: string;
  title?: string;
  /** Attendees / spoke with / instructed by / sources / for (label depends on kind). */
  with?: string;
  text: string;
  by: string;
  createdAt?: string;
  taskId?: string;
}

export interface MatterWeeklyStatus {
  /** Monday of the week (YYYY-MM-DD). */
  week: string;
  saved: string;
  by: string;
  stage: number;
  stageName: string;
  health: 'On track' | 'At risk' | 'Stuck';
  /** Did last week's next step happen. */
  outcome?: 'Done' | 'In progress' | 'Slipped' | '';
  prevNext?: string;
  why?: string;
  progress: string;
  next: string;
  nextBy: string;
  flag: string;
  /** A client update was prepared from this entry (not sent — messaging not connected). */
  clientUpdatePrepared?: boolean;
}

export interface MatterCloseCheck {
  label: string;
  ok: boolean;
  detail: string;
}

interface MatterCloseRequest {
  status: 'Pending' | 'Sent back' | 'Approved';
  requestedBy: string;
  requestedAt: string;
  outcome: string;
  note?: string;
  checklist: MatterCloseCheck[];
  /** The date the file is closed on (picked; can be a past date). */
  closeDate?: string;
  decidedBy?: string;
  decidedAt?: string;
  sendBackReason?: string;
}

interface MeetingNote {
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

interface InternalNote {
  id: string;
  date: string;
  noteType: string;
  content: string;
  recordedBy: string;
}

interface ResearchNote {
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

interface CaseStatusDetails {
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
  /** Earlier reference numbers of this file (after an admin changed the ref). */
  previousRefs?: string[];
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
  /** Dates typed straight into the firm Google Calendar that look like this file's (by file no. or suit no.), waiting for someone to add or ignore them. */
  calendarFromGoogle?: { eventId: string; title: string; date: string; time?: string }[];
  /** Google Calendar events someone chose to ignore for this file. */
  calendarIgnored?: string[];
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
  /** Link to the file's folder in an old drive (kept untouched, never moved or renamed). */
  oldDriveFolderUrl?: string;
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

  /* ---------------- Cases redesign (Working File) — all optional/additive ---------------- */
  /** Parties on the file. When absent, the parties are read from the legacy single-client /
   * opposing fields above (clientsList, opposingPartiesList, opposingSolicitorsRegistry…). */
  caseParties?: MatterParty[];
  courtDetails?: MatterCourtDetails;
  courtChanges?: MatterCourtChange[];
  clientUpdates?: MatterClientUpdate[];
  /** Prepare a client update automatically on status change / next court date. Default on. */
  clientUpdatesAuto?: boolean;
  fileNotes?: MatterNote[];
  /** Index into the practice area's status stages (File opened … Enforcement / closed). */
  statusStage?: number;
  statusStageName?: string;
  weeklyStatus?: MatterWeeklyStatus[];
  closeRequest?: MatterCloseRequest;
  closedDate?: string;
  closedBy?: string;
  closeOutcome?: string;
  archiveBoxNo?: string;
  archiveLocation?: string;
  destroyAfter?: string;
  deletionRequest?: { by: string; at: string; reason: string };
  /** Practice-specific intake answers from the New File form (label → value). */
  intakeDetails?: Record<string, string>;
  /** Partner review of a possible conflict when the file was opened. */
  conflictReview?: { status: 'Clear' | 'Reviewed'; detail?: string; by?: string; at?: string };
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

/** Quotation › payment plan (how the client pays the quoted total). Instalments use the monthly
 * schedule of lib/engagementLetter.schedule (also printed as the FEE ARRANGEMENT). */
export interface QuotationPaymentStage {
  label: string;
  /** Percentage of the quotation total, or… */
  pct?: number;
  /** …a fixed amount in RM (wins over pct when both are set). */
  amount?: number;
  /** When it is payable (free text, e.g. "On signing this letter"). */
  due?: string;
}
export interface QuotationPaymentPlan {
  kind: 'Full' | 'Stages' | 'Instalments';
  stages?: QuotationPaymentStage[];
  months?: number;
  upfront?: number;
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
  /** When it was made (delete is allowed for a few minutes after). */
  createdAt?: string;
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
  /** Language last chosen for client documents (kept on older quotations; the Letter of Engagement picks its own in Cases). */
  language?: 'EN' | 'BM';
  /** How the client pays: in full, by stages or by monthly instalments. */
  paymentPlan?: QuotationPaymentPlan;
  /** Proforma only: the payment-plan row it asks for (e.g. "stage:0", "month:3") and its label. */
  planRowKey?: string;
  planRowLabel?: string;
  /** A quotation made before the portal: recorded with its own number and the original PDF (View opens it). */
  historical?: boolean;
  pastFile?: { name: string; driveFileId?: string; webViewLink?: string };
  /** The firm's own short name for this bill (e.g. "Balance after trial"), used for the Drive file name. */
  label?: string;
  /** PDF copy of a document made in the portal, saved to the file's Client Files folder (see useFinanceController). */
  driveCopy?: { name: string; driveFileId?: string; webViewLink?: string; savedAt: string; /** What the saved copy was made from; a change saves a new copy. */ sig?: string };
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

/** A receipt / supporting file. New uploads are in Google Drive (driveFileId / webViewLink); older ones
 * kept in Firebase Storage have `path`, the Storage fullPath
 * (e.g. 'confidential/claims/{userId}/{recordId}/{timestamp}-{file}'); open it through
 * getDownloadURL so it works on every device. */
export interface ClaimAttachment {
  name: string;
  /** Firebase Storage fullPath (files uploaded before Google Drive was set up). */
  path?: string;
  size?: number;
  contentType?: string;
  /** Google Drive file (uploads once Drive storage is set up in Firm Settings). */
  driveFileId?: string;
  webViewLink?: string;
  /** Drive folder the file was saved in (for the "Drive folder" link). */
  driveFolderId?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface Expense {
  id: string;
  caseId: string;
  fileRef?: string;
  date: string;
  category: string;
  /** Type picked on the staff claim form (e.g. Accommodation, Meals). */
  claimKind?: string;
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
  /** Receipts in Google Drive (older ones: Firebase Storage, read-only). Openable on any device. */
  attachments?: ClaimAttachment[];
  isClientUpfrontCovered?: boolean;
  clientTrustBalanceSnapshot?: number;
  /** Staff Portal claim form this item was submitted on (e.g. 'CF-26-0413'). */
  formNo?: string;
  /** Accounts & Finance additions (optional/additive). Office expense: which account paid it. */
  paidFrom?: string;
  signatories?: FinanceSignatory[];
  paidAt?: string;
  paidProof?: FinanceProof;
  /** Filed in the finance books (Books › …), see DriveFiling. */
  driveFiling?: DriveFiling;
}

export interface Invoice {
  id: string;
  /** A paper from before the portal, kept for reference only: never counted in totals, books or running numbers. */
  recordOnly?: boolean;
  /** Its number as printed (the id is "PAST …" so it never clashes with the portal's numbers). */
  pastNo?: string;
  pastFile?: { name: string; driveFileId?: string; webViewLink?: string };
  /** The firm's own short name for this bill (e.g. "Balance after trial"), used for the Drive file name. */
  label?: string;
  /** PDF copy of a document made in the portal, saved to the file's Client Files folder (see useFinanceController). */
  driveCopy?: { name: string; driveFileId?: string; webViewLink?: string; savedAt: string; /** What the saved copy was made from; a change saves a new copy. */ sig?: string };
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
  /** Payment reminders sent from Billing & Collections ("dd.mm.yyyy · email & WhatsApp"). */
  reminders?: string[];
  /** Office-account proforma money (fees received in advance) applied to this invoice — printed
   * as "LESS: DEPOSIT RECEIVED" and deducted from the balance. Posted Dr 2110 / Cr 1100 on issue. */
  depositApplied?: number;
  /** Receipts (proforma payments) making up depositApplied. */
  depositReceiptIds?: string[];
  /** Unbilled work this invoice was built from; marked billed only when the invoice is issued. */
  sourceItems?: { time?: string[]; expenses?: string[]; travel?: string[] };
  /** Date the invoice was issued (status left Draft). */
  issuedAt?: string;
  /** Payment slips the client uploaded from the Client Portal (Drive: SHCO Finance <YYYY>/Bank-in Proofs/).
   * The bill shows "Checking payment" until Accounts records the payment. */
  clientPaymentSlips?: { name: string; driveFileId: string; webViewLink?: string; uploadedAt: string; uploadedBy: string }[];
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
  /** A paper from before the portal, kept for reference only (see Invoice.recordOnly). */
  recordOnly?: boolean;
  pastNo?: string;
  pastFile?: { name: string; driveFileId?: string; webViewLink?: string };
  /** The firm's own short name for this bill (e.g. "Balance after trial"), used for the Drive file name. */
  label?: string;
  /** PDF copy of a document made in the portal, saved to the file's Client Files folder (see useFinanceController). */
  driveCopy?: { name: string; driveFileId?: string; webViewLink?: string; savedAt: string; /** What the saved copy was made from; a change saves a new copy. */ sig?: string };
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
  /** Filed in the finance books (Books › …), see DriveFiling. */
  driveFiling?: DriveFiling;
}

export interface PaymentVoucher {
  id: string;
  date: string;
  accountSet: 'OFFICE' | 'CLIENT';
  voucherCategory: 'Office Account' | 'Client Account' | 'Disbursement' | 'Travelling' | 'Office Operating' | 'Client Disb' | 'Legal Fees Transfer' | 'Statutory (EPF/SOCSO/EIS/PCB)' | 'SST to Customs' | 'Partner drawings';
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
  /** Supporting files in Google Drive (older ones: Firebase Storage, read-only). Openable on any device. */
  attachments?: ClaimAttachment[];
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
  /** Filed in the finance books (Books › …), see DriveFiling. */
  driveFiling?: DriveFiling;
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
  /** Receipts in Google Drive (older ones: Firebase Storage, read-only). Openable on any device. */
  attachments?: ClaimAttachment[];
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
  /** Filed in the finance books (Books › …), see DriveFiling. */
  driveFiling?: DriveFiling;
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
  /** Short unique staff code (e.g. SH, AH, NF) used in file refs and across the system. */
  code?: string;
  /** Office this person works from (a name from PracticeSettings.branches, e.g. 'Bangi'). */
  branch?: string;
  /** Last successful sign-in, 'YYYY-MM-DD HH:MM' (recorded from now on; absent = not recorded). */
  lastLoginAt?: string;
  /** Firm & Practice Settings → "2-step login" flag. Recorded here only; the sign-in itself is
   * enforced by the Google Workspace / Firebase account, not by this app. */
  twoStepLogin?: boolean;
  /** Billing & money access set by the Super Admin for this person ('' / absent = by role:
   * partners, Accounts and reviewers see; partners and Accounts edit). Enforced by firestore.rules. */
  billingAccess?: '' | 'none' | 'view' | 'edit';
}

export interface StaffProfile {
  staffId: string;
  /** Legal full name (as per IC) for payslips / EA forms. `User.name` is the display name. */
  fullName?: string;
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

  /* ---- Employee record (Staff Portal -> My profile). HR-maintained, all optional. ---- */
  gender?: 'Male' | 'Female';
  nationality?: string;
  race?: string;
  religion?: string;
  /** Marital status and number of children feed PCB tax reliefs. */
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  children?: number;
  /** Staff photo in Google Drive (HR/<staff>/). Older photos: Firebase Storage confidential/hr/..., read-only. */
  photo?: HrDocument;
  homeAddress?: string;
  personalEmail?: string;
  /** Structured emergency contact. The older free-text `emergencyContact` is kept in sync as a summary. */
  emergency?: { name?: string; relationship?: string; phone?: string };
  employment?: {
    probationEndDate?: string;
    confirmationDate?: string;
    /** User id of the person this staff member reports to. */
    reportingTo?: string;
    /** HR status only — login access is controlled separately in Users & Permissions. */
    status?: 'Active' | 'Resigned' | 'Terminated';
    lastWorkingDay?: string;
  };
  pay?: {
    /** RM per month. Default for new payslips in Finance -> Payroll. */
    basicSalary?: number;
    /** Fixed monthly allowances (RM). Default for new payslips in Finance -> Payroll. */
    allowances?: { name: string; amount: number }[];
    /** LHDN income tax no. */
    taxNo?: string;
    taxResidency?: 'Resident' | 'Non-resident';
    /** PCB category 1 / 2 / 3. */
    pcbCategory?: '1' | '2' | '3';
    /** Zakat deducted via employer, RM per month. */
    zakatMonthly?: number;
    bankAccountHolder?: string;
  };
  professional?: {
    /** Advocate & Solicitor roll no. */
    rollNo?: string;
    practisingCertNo?: string;
    practisingCertExpiry?: string;
    syarieCertNo?: string;
    syarieCertExpiry?: string;
    /** CPD points by calendar year, e.g. { '2026': 12 }. */
    cpdPoints?: Record<string, number>;
  };
  education?: { qualification: string; institution: string; year: string }[];
  workHistory?: { employer: string; position: string; from: string; to: string }[];
  /** Ticked when the person has no previous employment (e.g. a fresh graduate or pupil). */
  noPriorEmployment?: boolean;
  /** Scanned HR documents in Google Drive (older ones: Firebase Storage). Only the reference is stored here. */
  hrDocuments?: HrDocument[];
  hrUpdatedAt?: string;
  hrUpdatedBy?: string;
}

/** A file attached to a staff member's HR record (Google Drive; older ones Firebase Storage). */
export interface HrDocument {
  name: string;
  /** Firebase Storage fullPath (older uploads). Drive uploads use driveFileId instead. */
  path?: string;
  driveFileId?: string;
  webViewLink?: string;
  size?: number;
  contentType?: string;
  /** Document type label, e.g. 'IC copy', 'Offer letter'. */
  type: string;
  uploadedAt: string;
  uploadedBy: string;
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
  /** One of the firm's leave types (Settings → Lists & sources; built-in list until changed). */
  leaveType: string;
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
  /** Supporting document (MC, discharge note, exam slip...) file name. Older requests kept only this name. */
  attachmentName?: string;
  /** The supporting document itself, in the firm Google Drive (Leave/<YYYY>/<staff>/). Metadata only. */
  attachment?: ClaimAttachment;
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
  type: 'Internal' | 'Network' | 'Client' | 'Team' | 'Growth' | 'Compliance';
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

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'hearing' | 'invoice' | 'system';
  timestamp: string;
  read: boolean;
  linkTab?: string;
  linkId?: string;
  /** User ids this is for. Missing = everyone (older notifications). */
  to?: string[];
  /** User ids who have read it (per person; `read` is only used for older notifications). */
  readBy?: string[];
  /** Name of the person whose action raised it. */
  from?: string;
}

type BankAccountType = 'Trust' | 'Office';
type BankAccountFunction =
  | 'Office Account'
  | 'Trust Account'
  | 'Petty Cash'
  | 'Sinking Fund'
  | 'Disbursement'
  | 'Partner Draws'
  | 'Payroll';

interface VirtualPot {
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
  entityType: 'Case' | 'Lead' | 'Client' | 'Invoice' | 'Quotation' | 'Payment Voucher' | 'Receipt' | 'Expense' | 'Time Entry' | 'Law Firm' | 'Travel Claim';
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
  /** PDF of the released payslip in Finance › Payroll › year › month › Payslips. */
  driveCopy?: { name: string; driveFileId?: string; webViewLink?: string; savedAt: string };
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
  /** Employer's SOCSO + EIS share (firm cost, remitted to PERKESO). Absent on older payslips. */
  socsoEisEmployer?: number;
  /** How EPF / SOCSO / EIS were worked out (src/lib/statutory.ts). Absent on older, hand-keyed payslips. */
  statutory?: {
    /** true = figures came from the built-in KWSP / PERKESO tables; false = keyed in by Accounts. */
    auto: boolean;
    /** STATUTORY_VERSION of the tables used. */
    version: string;
    /** Why Accounts overrode the calculated figures (e.g. staff elected a higher EPF rate). */
    overrideReason?: string;
    /** Breakdown for the payslip (PERKESO asks for Act 4 and Act 800 to be shown separately). */
    socsoEmployee?: number;
    eisEmployee?: number;
    socsoEmployer?: number;
    eisEmployer?: number;
  };
  pcb: number;
  zakat: number;
  otherDeductions: { name: string; amount: number }[];
  paidAt?: string;
}

/* ---------------- Accounts & Finance module additions ---------------- */

/** Where a money entry is filed in the finance books (Google Drive): its entry folder and the
 * place it was filed to (path + name), so the portal only moves it when that changes. */
export interface DriveFiling {
  key: string;
  folderId: string;
}

/** One approver's sign-off on a finance item (claims, vouchers, client-account payments,
 * journals). Approval rule: < RM5k any partner; >= RM5k or anything from the client account
 * = Managing Partner + 1 more signatory. */
export interface FinanceSignatory {
  name: string;
  at: string;
  isManagingPartner: boolean;
  /** Signer's user id (newer signatures), so "Who approves" lists can be matched exactly. */
  userId?: string;
}

/** Proof-of-payment file reference. Only metadata is synced — the firm has no object storage
 * connected yet, so the file itself is only viewable in the session it was attached in. */
export interface FinanceProof {
  name: string;
  size?: number;
  type?: string;
  uploadedAt: string;
  /** Set once the file has been saved to Google Drive (SHCO Finance <YYYY>/…). Without it,
   * only the file name is kept and the file is viewable in the session that attached it. */
  driveFileId?: string;
  webViewLink?: string;
  uploadedBy?: string;
  /** Drive folder the file was saved in (SHCO Finance <YYYY>/…). */
  driveFolderId?: string;
}

interface FinanceFeeArrangement {
  on: boolean;
  months: number;
  upfront: number;
  terms: string;
}

interface WriteOffRequest {
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
  /** Client-account journals: the client ledger (client + matter) the adjustment belongs to. */
  clientId?: string;
  caseId?: string;
}

/** My Dashboard → My to-do → Private: a person's own to-do with no file attached. Stored in its own
 * owner-only collection: nobody else can read it, not even partners or admins. */
export interface PrivateTodo extends Task { ownerEmail: string }
