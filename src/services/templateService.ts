// Practice Settings & Document Template Service
import { writeCloudState } from './firestoreSyncService';
import type { ComplianceItem, ComplaintRecord, Milestone, Panelship, InvestmentChannel, FirmGoal } from '../types';
import type { ApproverRule } from '../lib/approvers';
import type { LetterheadPartner } from '../lib/engagementLetter';

export interface FirmBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  swiftCode?: string;
  branch?: string;
  accountType: 'Office Operating' | 'Client Trust' | 'Fixed Deposit Stakeholder' | 'Syariah Escrow' | 'Disbursement' | 'Other';
  glAccountCode?: string;
  isDefaultOffice?: boolean;
  isDefaultClient?: boolean;
  notes?: string;
  isActive?: boolean;
  /** Type as typed in Firm & Practice Settings (e.g. "Petty cash"); accountType is derived. */
  typeLabel?: string;
}

interface DefaultBillingItem {
  id: string;
  description: string;
  category: 'Disbursement' | 'Reimbursement';
  unitPrice: number;
  quantity: number;
  chargeType: 'Per Quantity' | 'Fixed';
}

/** A firm cash-reserve / sinking fund line, edited on the Managing Partner's Finance
 * dashboard ("Cash reserve & sinking funds"). Purely firm-maintained figures — there is no
 * other real data source for target/monthly-contribution amounts, so these are entered and
 * persisted here rather than computed. */
export interface SinkingFund {
  id: string;
  name: string;
  target: number;
  monthly: number;
  balance: number;
  /** Accounts & Finance → Office Account: short note under the fund name and its due date
   * (free text, e.g. "Dec 2026"). Optional/additive. */
  note?: string;
  due?: string;
  /** Office Account → Sinking funds "Split %": share of each fee received set aside into this fund. */
  pct?: number;
}

/** One movement of the emergency fund or the firm investment (Office Account). Balances are the
 * sum of movements, never stored. Deposits / withdrawals wait for approval in `pending` first. */
export interface FundMove {
  id: string;
  date: string;
  kind: 'Deposit' | 'Withdrawal' | 'Dividend' | 'Value change';
  /** Investment: where it is held (Fixed deposit, ASB / ASN…). Emergency fund: money from. */
  place?: string;
  amount: number;
  note?: string;
  by: string;
  at: string;
  /** Signatures (by approver code) while pending; who approved once moved to the log. */
  sign?: Record<string, { by: string; at: string }>;
}

/** Payroll › Fee sharing (Accounts & Finance). Rules and per-file / per-person choices only:
 * every amount is worked out from fees actually collected (lib/feeSharing). */
interface FeeSharingSettings {
  rules?: { own: number; intro: number; hand: number };
  /** Per month 'YYYY-MM' → per file (case id): introducer / handlers / own % rules. */
  files?: Record<string, Record<string, { intro?: string; hands?: string[]; cu?: Record<string, number>; rules?: { own: number; intro: number; hand: number } }>>;
  /** Per person (user id): type and how they are paid. */
  people?: Record<string, { t?: string; pay?: string; sal?: number; nsal?: string; nfrom?: string; ded?: Record<string, number> }>;
  /** Partners' split of the firm's profit, % per user id. */
  psplit?: Record<string, number>;
  /** Office costs for the month, 'YYYY-MM' → RM (typed by Accounts). */
  costs?: Record<string, number>;
}

/** A recurring firm commitment (fixed cost), edited on the Managing Partner's Finance
 * dashboard ("Commitments"). Same rationale as SinkingFund — firm-maintained, not derived. */
export interface Commitment {
  id: string;
  name: string;
  amount: number;
  due: string;
  paid: boolean;
  frequency: 'Monthly' | 'Annual';
}

export interface PracticeSettings {
  logoUrl: string; // Base64 data URI or HTTP image URL
  primaryColor: string; // Header & Primary Accents (e.g., #16223A)
  accentColor: string; // Secondary Accents (e.g., #A9814A)
  backgroundColor: string; // Background canvas (e.g., #FAF8F2)
  fontFamily: string; // Custom Font Family (e.g., 'Plus Jakarta Sans', 'Playfair Display', 'Times New Roman', 'Calibri')
  fontSizePt: number; // Base Font Size in pt (9, 10, 11, 12, 14)
  headingSizePt: number; // Heading Font Size in pt (14, 16, 18, 20)
  lineHeight: number; // Line Height (1.3, 1.5, 1.8)
  firmName: string;
  firmSubtitle: string;
  address: string;
  phone: string;
  email: string;
  barRef: string;
  sstNo: string;
  /** Whether the firm is SST-registered yet. Defaults false — set true once registration
   * actually goes through. This is the firm-wide default for the "Apply SST" tick on new
   * documents; each document can still be ticked/unticked individually. */
  sstRegistered: boolean;
  /** Decimal rate, e.g. 0.08 for 8%, 0.06 for 6%. Only meaningful when sstRegistered (or a
   * document's own SST tick) is on. */
  sstRate: number;
  /** ISO date -> holiday name. Leave counting skips these. Absent = built-in list. */
  publicHolidays?: Record<string, string>;
  /** Firm Start Centre content shared by everyone (was saved per browser before). */
  startCentre?: {
    shelves?: { id: string; title: string; detail: string; docs?: { id: string; title: string; url?: string; note?: string }[] }[];
    quickLinks?: { title: string; links: { label: string; url: string }[] }[];
    tiles?: { label: string; view: string; bg: string }[];
  };
  /** Leave types offered in Staff Portal (name, days a year, 0 = no fixed limit, how days are counted, note). Built-in list until set. */
  leaveTypes?: { name: string; days: number; basis: 'working' | 'calendar'; note: string }[];
  bankName: string;
  bankAccountNo: string;
  bankAccounts?: FirmBankAccount[];
  headerStyle: 'formal' | 'modern' | 'centered';
  headerBadgeText?: string;
  consultationFormLink?: string;
  engagementOpeningText?: string;
  engagementTermsClause?: string;
  quotationValidityDays?: string;
  paymentTermDays?: string;
  disbursementNote?: string;
  /** Default disbursement & reimbursement rows auto-inserted into every new quotation. */
  defaultBillingItems?: DefaultBillingItem[];
  practiceAreas?: Array<{
    id: string;
    name: string;
    code: string;
    color?: string;
    description?: string;
  }>;
  matterCodes?: Array<{
    id: string;
    name: string;
    code: string;
    practiceArea: string;
    description?: string;
  }>;
  /** Per-partner KPI scorecard targets (My Dashboard -> Partner KPIs), editable by the Managing
   * Partner ("Edit targets"). Keyed by partner code (e.g. 'SH'), then by metric key
   * ('feesBilled' | 'collectedWithin60' | 'newClients' | 'billableHours' | 'clientRating' |
   * 'complianceOnTime' | 'mentoring'). Additive — falls back to DEFAULT_PARTNER_KPI_TARGETS
   * per metric when a partner or metric has no override yet. */
  partnerKpiTargets?: Record<string, Record<string, number>>;
  /** KPI scorecard weights (My Dashboard -> Partner KPIs footer: "Weighting: Fees 25% ·
   * Collections 20% · New clients 15% · Hours 10% · Client rating 10% · Compliance 10% ·
   * Mentoring 10%"), editable by the Managing Partner. Falls back to DEFAULT_PARTNER_KPI_WEIGHTS. */
  partnerKpiWeights?: Record<string, number>;
  /** Cash reserve & sinking fund lines (My Dashboard -> Finance, Managing Partner only:
   * "Cash reserve & sinking funds"). Firm-maintained — no other real data source for
   * target/monthly-contribution amounts. Empty until the Managing Partner adds one. */
  sinkingFunds?: SinkingFund[];
  /** Recurring firm commitments / fixed costs (My Dashboard -> Finance, Managing Partner
   * only: "Commitments"). Firm-maintained — empty until the Managing Partner adds one. */
  commitments?: Commitment[];
  /** Office compliance register (My Dashboard -> Compliance, partners + Managing Partner),
   * grouped by AMLA, Client account, Bar Council, PDPA and Tax/payroll/licences. Seeded with
   * the firm's real statutory obligations; ticked/edited/added to from the Compliance tab. */
  complianceRegister?: ComplianceItem[];
  /** Client complaints / feedback logged from My Dashboard -> Compliance. Starts empty — no
   * sample complaints; only what partners actually log. */
  complaints?: ComplaintRecord[];
  /** My Dashboard -> Direction (Managing Partner only, Growth merged in): editable Vision /
   * Mission / 2028 target statements. Firm-maintained — starts blank until set. */
  vision?: string;
  mission?: string;
  target2028?: string;
  /** Business roadmap 2026-2028 milestones. Firm-maintained — empty until the Managing
   * Partner adds one ("+ Add milestone"). */
  roadmap?: Milestone[];
  /** "2026 plan" targets shown as the 4 stat cards under the roadmap. `now` is recomputed
   * from real data at render time where a goal maps to something measurable (fee income,
   * new clients); otherwise the partner-entered figure is used as-is. */
  firmGoals?: FirmGoal[];
  /** Growth -> Panelships table (banks, insurers, GLCs). Firm-maintained. */
  panelships?: Panelship[];
  /** Growth -> "Where to put money" spend-vs-fees-won table. Firm-maintained. */
  investmentChannels?: InvestmentChannel[];
  /** Direction -> "Notes for partners' meeting" — private to the Managing Partner. */
  partnersNotes?: string;
  /** Leads & Referrals -> "Edit lists" (admin only): lead sources. `key` is what
   * Lead.referralSourceCategory stores and never changes; `label` is renamable. Falls back to
   * DEFAULT_LEAD_SOURCES when unset. */
  leadSources?: LeadSourceDef[];
  /** Leads & Referrals -> "Edit lists": social media platforms. `key` is what
   * Lead.socialMediaPlatform stores. Falls back to DEFAULT_LEAD_SOCIAL_PLATFORMS when unset. */
  leadSocialPlatforms?: LeadPlatformDef[];
  /** Leads & Referrals -> "Set up online booking": pasted Google Form link. */
  leadBookingFormLink?: string;
  /** Leads & Referrals -> "Set up online booking": pasted Google Calendar appointment / Calendly link. */
  leadBookingCalendarLink?: string;
  /** Accounts & Finance → Finance Home month-end close checklist ticks, keyed
   * `${'YYYY-MM'}:${itemId}`. Firm-maintained, shared through the settings sync. */
  monthEndClose?: Record<string, { by: string; at: string }>;
  /** Month-end checklist changes: built-in items removed / renamed, and the firm's own items. */
  monthEndEdits?: { hidden?: string[]; names?: Record<string, string>; own?: { id: string; label: string; note: string; due: string; owner: string }[] };
  /** Accounts & Finance → Client Account monthly client statement runs, keyed by 'YYYY-MM'. */
  clientStatementRuns?: Record<string, { at: string; by: string; count: number }>;
  /** Accounts & Finance → Approvals monthly referral-fee batch decisions, keyed by 'YYYY-MM'. */
  referralFeeApprovals?: Record<string, { status: 'Approved' | 'Rejected'; by: string; at: string; total: number }>;
  /** Accounts & Finance sign-offs held in settings (payroll, fee sharing, partner pay, 3-way
   * reconciliation, client statements), keyed `${approval id}:${period or record}` → approver code. */
  financeSignoffs?: Record<string, Record<string, { by: string; at: string }>>;
  /** Accounts & Finance → Payroll › Fee sharing rules and choices. */
  feeSharing?: FeeSharingSettings;
  /** Accounts & Finance → Office Account › Emergency fund: target in months of fixed costs,
   * movements and withdrawals waiting for approval. */
  emergencyFund?: { months?: number; pct?: number; log?: FundMove[]; pending?: FundMove[] };
  /** Accounts & Finance → Office Account › Investment: goal, movements, pending deposits/withdrawals. */
  investments?: { goalName?: string; goalAmt?: number; log?: FundMove[]; pending?: FundMove[] };
  /** Office Account › Sinking funds "Fees waiting to be split": receipt id → when it was split. */
  fundSplits?: Record<string, { at: string; by: string; total: number }>;
  /** Accounting › Chart of accounts edits: renamed / re-coded / archived accounts (keyed by the
   * original code, so past postings keep their account), added accounts and a change log. */
  coaEdits?: { overrides?: Record<string, { code?: string; name?: string; arch?: boolean }>; added?: { code: string; name: string; type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' }[]; log?: { t: string; who: string; when: string }[] };

  /* ---- Firm & Practice Settings (design pack firm-settings.dc.html). All optional/additive. ---- */
  /** Firm registration number printed on finance documents and payslips ("Firm Reg. No."). */
  firmRegNo?: string;
  /** Letterhead tagline lines printed under the firm name on finance documents / payslips. */
  taglineLine1?: string;
  taglineLine2?: string;
  /** Partners column on the letterhead (Firm & Letterhead tab), printed on the Letter
   * of Engagement. Unset → lib/engagementLetter DEFAULT_LETTERHEAD_PARTNERS. */
  letterheadPartners?: LetterheadPartner[];
  /** Firm offices. Users pick one (User.branch = branch name); documents use the HQ letterhead. */
  branches?: FirmBranch[];
  /** "Emails by purpose" (Firm & Letterhead tab). */
  purposeEmails?: PurposeEmail[];
  /** Opening balances per bank account id (Banks, Numbering & SST tab). */
  bankOpeningBalances?: Record<string, number>;
  /** Date (ISO yyyy-mm-dd) the opening balances are as at. Cash-book entries on or before it are
   * already inside the opening balance. */
  bankOpeningBalancesAsAt?: string;
  /** Accounts & Finance → Client Account 3-way reconciliation: client bank statement closing
   * balance per month, keyed 'YYYY-MM'. */
  clientBankStatements?: Record<string, { balance: number; by: string; at: string; proof?: { name: string; driveFileId?: string; webViewLink?: string }; outstanding?: string[] }>;
  /** Document numbering formats, keyed by DOC_NUMBERING key. Stored only: record ids are still
   * issued by AppContext.getNextSequenceId in its existing format. */
  docNumbering?: Record<string, string>;
  /** SST start date (dd.mm.yyyy). Before this date the firm default SST rate stays 0. */
  sstStartDate?: string;
  /** Approval limits (Permissions & limits tab), as typed. `mpPlusOneAbove` drives the finance
   * Approvals two-signatory threshold. */
  approvalLimits?: ApprovalLimits;
  /** Who approves (Who approves tab), keyed by item id (lib/approvers APPROVAL_ITEMS); people are
   * user ids. An item that is not here keeps the existing routing. */
  approvers?: Record<string, ApproverRule>;
  /** Per-practice-area default quotation (Fee templates tab), keyed by practice-area tag (L, CONV,
   * EST, …). Overrides the built-in templates in lib/financeDocs AREAS. */
  feeTemplates?: Record<string, FeeTemplate>;
  /** Lists & sources: Office Account expense categories and My Claims claim types. */
  expenseCategories?: string[];
  claimTypes?: string[];
  /** Google Drive storage (Google, e-mail & backup tab). When a root folder and an OAuth client ID
   * are set, new uploads (claim receipts, HR documents, staff photos, finance proofs, backups)
   * go to this Shared Drive folder instead of Firebase Storage. */
  driveRootFolderId?: string;
  /** Folder name as read back by "Test connection" (display only). */
  driveRootFolderName?: string;
  /** Optional separate folder (ideally its own Shared Drive, partners/admin only) for HR
   * documents and staff photos. Blank = `HR/` inside the root folder. */
  driveHrFolderId?: string;
  driveHrFolderName?: string;
  /** "SHCO Finance" Shared Drive (partners / Accounts only): claims, payment vouchers, bank-in
   * proofs, client account, engagement & billing papers, backups. Blank = `Finance/` inside the
   * root folder (all staff can see it). */
  driveFinanceFolderId?: string;
  driveFinanceFolderName?: string;
  /** Practice area name → folder name under `Case files/` in SHCO Portal (blank = the area name). */
  drivePracticeFolderNames?: Record<string, string>;
  /** OAuth 2.0 Web client ID used for Google Drive access (overridden by VITE_GOOGLE_OAUTH_CLIENT_ID). */
  googleOAuthClientId?: string;
  /** Result of the last "Test connection". */
  driveLastTest?: { at: string; by: string; ok: boolean; message: string };
  /** Google Calendar ID of the firm's shared "SHCO Court Diary" calendar (Google, e-mail & backup →
   * Google Calendar, Tasks & Gmail). Hearings / court dates are written here. */
  courtDiaryCalendarId?: string;
  /** Calendar name (display only; filled in by the Calendar test or typed by the owner). */
  courtDiaryCalendarName?: string;
  /** Result of the last test per service on the "Google Calendar, Tasks & Gmail" card. */
  googleWorkspaceLastTests?: Partial<Record<'calendar' | 'tasks' | 'gmail', { at: string; by: string; ok: boolean; message: string }>>;
  /** "Export all firm data" (Google, e-mail & backup tab). */
  lastBackup?: { at: string; by: string; fileName: string; driveFileId?: string; webViewLink?: string };
  /** Staff Guide: a walkthrough video link per role (Google Drive or YouTube), set by admins on the guide page. */
  guideVideos?: Partial<Record<'partner' | 'lawyer' | 'assistant' | 'accounts', string>>;
  /** Staff Guide: one short video per topic (topic id → Google Drive / YouTube link). */
  guideTopicVideos?: Record<string, string>;
  /** "Set up finance folders" (Super Admin): the finance books in Drive start from `from` (YYYY-MM); money entries from then on are filed there. */
  financeFiling?: { from: string; to: string; at: string; by: string };
}

export interface FirmBranch {
  id: string;
  name: string;
  hq?: boolean;
  address: string;
  /**
   * Uploaded letterhead header image: a small compressed data URL kept here ONLY as a render
   * cache (print / PDF iframes cannot fetch from Drive), and its original file name.
   * The original is stored in Google Drive (Firm/Letterhead/): letterheadDriveFileId / link.
   */
  letterheadImage?: string;
  letterheadFileName?: string;
  letterheadDriveFileId?: string;
  letterheadWebViewLink?: string;
}

export interface PurposeEmail {
  purpose: string;
  email: string;
  usedFor: string;
}

export interface ApprovalLimits {
  anyPartnerUpTo?: string;
  mpPlusOneAbove?: string;
  clientAccount?: string;
  writeOffs?: string;
  staffClaimsFlag?: string;
}

/** One template line. Stored as an object — Firestore rejects nested arrays. */
interface FeeLine {
  d: string;
  a: number;
}

export interface FeeTemplate {
  desc: string;
  prof: FeeLine[];
  disb: FeeLine[];
  reimb: FeeLine[];
}

export const DEFAULT_BRANCHES: FirmBranch[] = [
  { id: 'br-bangi', name: 'Bangi', hq: true, address: '8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi' },
  { id: 'br-terengganu', name: 'Terengganu', address: 'Lot 7076, Taman Safiah Murni, Bukit Payong, 21400 Marang' },
];

export const DEFAULT_PURPOSE_EMAILS: PurposeEmail[] = [
  { purpose: 'General enquiries', email: '', usedFor: 'Website, Google profile, general letters' },
  { purpose: 'Billing & receipts', email: '', usedFor: 'Printed on finance documents; sends invoices, receipts and payment reminders' },
  { purpose: 'Payroll & HR', email: '', usedFor: 'Sends payslips and EA forms to staff' },
  { purpose: 'Client portal', email: '', usedFor: 'Portal invites and file updates to clients (no replies)' },
  { purpose: 'New leads', email: '', usedFor: 'Website form and new-lead alerts to the person in charge' },
];

/** [key, label, default format] — Banks, Numbering & SST → Document numbering. */
export const DOC_NUMBERING: [string, string, string][] = [
  ['quotation', 'Quotation', 'QT-{YY}-{0000}'],
  ['proforma', 'Proforma invoice', 'PF-{YY}-{0000}'],
  ['invoice', 'Invoice', 'INV-{YY}-{0000}'],
  ['receiptOffice', 'Receipt (office)', 'OR-O-{YY}-{0000}'],
  ['receiptClient', 'Receipt (client a/c)', 'OR-C-{YY}-{0000}'],
  ['pvOffice', 'Payment voucher (office)', 'PV-O-{YY}-{0000}'],
  ['pvClient', 'Payment voucher (client a/c)', 'PV-C-{YY}-{0000}'],
  ['pvDisb', 'Payment voucher (disbursement)', 'PV-D-{YY}-{0000}'],
  ['journal', 'Journal', 'JV-{YY}-{0000}'],
];

export const DEFAULT_APPROVAL_LIMITS: Required<ApprovalLimits> = {
  anyPartnerUpTo: 'RM 5,000',
  mpPlusOneAbove: 'RM 5,000',
  clientAccount: 'Super Admin + 1, any amount',
  writeOffs: 'Super Admin only',
  staffClaimsFlag: 'RM 1,000',
};

/** Office expense categories used by Accounts & Finance → Record office expense. */
/** Office expense categories = the accountant's (Bukku) expense accounts (see finance/financeModel BUKKU_EXPENSES). */
export const DEFAULT_EXPENSE_CATEGORIES = ['Advertising and marketing', 'Bank charges', 'Course and seminar', 'Entertainment', 'Professional legal fees', 'Runner fees / delivery fees', 'Statutory / regulatory fees', 'Consulting fees – marketing', 'Accounting fee', 'Gift, donation & sponsorship', 'Insurance', 'License and registration fee', 'Computer & software', 'Office supplies', 'Printing and stationeries', 'Rental of office', 'Upkeep of office', 'Water and electricity', 'Telephone and internet charges', 'Reimbursement Expenses', 'Mileage claims', 'Petrol, toll and parking', 'Accomodation', 'Other'];
/** Claim types offered in My Claims (Staff Portal). */
export const DEFAULT_CLAIM_TYPES = ['Travelling', 'Grab / taxi / train', 'Accommodation', 'Meals (client meeting)', 'Courier & postage', 'Printing & photocopy', 'Phone & internet', 'Training / CPD', 'Disbursement', 'Office'];

/** First number found in a typed amount ("RM 5,000" -> 5000); fallback when none. */
const parseAmount = (v: unknown, fallback: number): number => {
  const m = String(v ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : fallback;
};

/** Finance Approvals: amount at/above which Managing Partner + 1 more signatory is needed. */
export const twoSignatoryThreshold = (settings: PracticeSettings = getPracticeSettings()): number =>
  parseAmount(settings.approvalLimits?.mpPlusOneAbove ?? DEFAULT_APPROVAL_LIMITS.mpPlusOneAbove, 5000);

export interface LeadSourceDef {
  key: string;
  label: string;
  /** Swatch / dot colour. */
  color: string;
  /** Pill background. */
  tint: string;
  /** Pill text colour. */
  fg: string;
}

export interface LeadPlatformDef {
  key: string;
  label: string;
}

/** Default lead sources (Leads and Referrals.dc.html, exact colours and order). */
/** The firm's source list (Settings › Lists & sources › Lead sources), also used for where clients came from. */
export const getLeadSources = (): LeadSourceDef[] => { const l = getPracticeSettings().leadSources; return l && l.length ? l : DEFAULT_LEAD_SOURCES; };
export const leadSourceLabel = (key?: string) => (key ? getLeadSources().find((x) => x.key === key)?.label || key : '');

export const DEFAULT_LEAD_SOURCES: LeadSourceDef[] = [
  { key: 'Partner', label: 'Partner', color: '#3D6B9C', tint: '#E7EEF6', fg: '#2F5680' },
  { key: 'Staff', label: 'Staff', color: '#5E6F2F', tint: '#EEF1E3', fg: '#4E5C26' },
  { key: 'Existing Client', label: 'Existing client', color: '#2F6F4E', tint: '#E6EFE9', fg: '#2F6F4E' },
  { key: 'Event / Seminar', label: 'Programme', color: '#B2542F', tint: '#FBEDE4', fg: '#9A4526' },
  { key: 'Social Media', label: 'Social media', color: '#6B3D8C', tint: '#F1EBF6', fg: '#6B3D8C' },
  { key: 'Walk-In', label: 'Walk-in', color: '#8A6D3B', tint: '#FBF2E9', fg: '#8A6534' },
  { key: 'Website', label: 'Website', color: '#2E7D7A', tint: '#E3F1F0', fg: '#236462' },
  { key: 'BNI', label: 'BNI', color: '#A33B5B', tint: '#F7E9EE', fg: '#8C2F4C' },
  { key: 'Outside Referrer', label: 'Outside referrer', color: '#8A6D3B', tint: '#F5EFE3', fg: '#6F5730' },
];

export const DEFAULT_LEAD_SOCIAL_PLATFORMS: LeadPlatformDef[] = [
  'Facebook',
  'Instagram',
  'TikTok',
  'LinkedIn',
  'XiaoHongShu / XHS',
  'YouTube',
  'WhatsApp / Telegram',
].map((p) => ({ key: p, label: p }));

/** Metric keys used by the Partner KPIs scorecard, in mockup display order. */
export const PARTNER_KPI_METRICS = [
  'feesBilled',
  'collectedWithin60',
  'newClients',
  'billableHours',
  'clientRating',
  'complianceOnTime',
  'mentoring',
] as const;
export type PartnerKpiMetric = (typeof PARTNER_KPI_METRICS)[number];

/** Weighting: Fees 25% · Collections 20% · New clients 15% · Hours 10% · Client rating 10% ·
 * Compliance 10% · Mentoring 10% (My Dashboard.dc.html isKpi footer, exact). */
export const DEFAULT_PARTNER_KPI_WEIGHTS: Record<PartnerKpiMetric, number> = {
  feesBilled: 25,
  collectedWithin60: 20,
  newClients: 15,
  billableHours: 10,
  clientRating: 10,
  complianceOnTime: 10,
  mentoring: 10,
};

/** Default per-partner targets, used until the Managing Partner sets real ones via "Edit targets". */
export const DEFAULT_PARTNER_KPI_TARGETS: Record<PartnerKpiMetric, number> = {
  feesBilled: 360000,
  collectedWithin60: 90,
  newClients: 15,
  billableHours: 1100,
  clientRating: 4.5,
  complianceOnTime: 100,
  mentoring: 12,
};

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  logoUrl: '',
  primaryColor: '#16223A',
  accentColor: '#A9814A',
  backgroundColor: '#FAF8F2',
  fontFamily: 'Plus Jakarta Sans',
  fontSizePt: 11,
  headingSizePt: 18,
  lineHeight: 1.5,
  firmName: 'MESSRS SYAFIQAH HAMIZAD & CO',
  firmSubtitle: 'Advocates & Solicitors | Syarie Counsel · Peguambela & Peguamcara | Peguam Syarie',
  address: '8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi, Selangor',
  phone: '+603-8684 1998 / +6011-7382 8754',
  email: 'billing@shcolaw.com',
  barRef: 'BC/S/2024/9912',
  sstNo: 'W10-2401-3200019',
  sstRegistered: false,
  sstRate: 0.08,
  bankName: 'Hong Leong Bank Berhad',
  bankAccountNo: 'Office: 36301134253 | Client A/C: 36301136440',
  headerStyle: 'formal',
  headerBadgeText: 'SH',
  consultationFormLink: 'https://forms.google.com/shcolaw-consultation-intake',
  engagementOpeningText: 'We are pleased to confirm our appointment to act as your Advocates & Solicitors in relation to the abovementioned legal matter. This letter sets out the agreed scope of professional representation, fee structure, and statutory terms of engagement.',
  engagementTermsClause: '1. Professional fees are governed by the Solicitors Remuneration Order (SRO 2023).\n2. All out-of-pocket disbursements (court filing fees, registration fees, stamping) shall be reimbursed by the client.\n3. Initial trust deposit monies shall be held in our Client Trust Account pursuant to Solicitors\' Account Rules 1990.\n4. This agreement shall be governed by and construed in accordance with the laws of Malaysia.',
  quotationValidityDays: '30',
  paymentTermDays: '14',
  disbursementNote: 'Invoices are payable within the stipulated payment terms. Payments should be credited to our Hong Leong Bank Office Account or Hong Leong Bank Client Account as instructed.',
  defaultBillingItems: [
    { id: 'db-reimb-photocopy', description: 'Photocopy and printing charges', category: 'Reimbursement', unitPrice: 200, quantity: 1, chargeType: 'Fixed' },
    { id: 'db-reimb-travel', description: 'Travelling expenses', category: 'Reimbursement', unitPrice: 500, quantity: 1, chargeType: 'Fixed' },
    { id: 'db-reimb-tel-courier', description: 'Telephone, fax, courier, Runner & Postage charges', category: 'Reimbursement', unitPrice: 300, quantity: 1, chargeType: 'Fixed' },
    { id: 'db-reimb-misc', description: 'Miscellaneous', category: 'Reimbursement', unitPrice: 100, quantity: 1, chargeType: 'Fixed' },
    { id: 'db-disb-bankruptcy', description: 'Bankruptcy search', category: 'Disbursement', unitPrice: 10, quantity: 1, chargeType: 'Per Quantity' },
    { id: 'db-disb-ssm', description: 'SSM search', category: 'Disbursement', unitPrice: 15.4, quantity: 1, chargeType: 'Per Quantity' },
    { id: 'db-disb-jpn', description: 'JPN search', category: 'Disbursement', unitPrice: 50, quantity: 1, chargeType: 'Per Quantity' },
  ],
  practiceAreas: [
    { id: 'pa-1', name: 'Civil Litigation', code: 'L', color: '#16223A', description: 'Court litigation, dispute resolution & appeals' },
    { id: 'pa-2', name: 'Estate Administration', code: 'EST', color: '#854D0E', description: 'Probate, Letters of Administration & Wasiat' },
    { id: 'pa-3', name: 'Conveyancing', code: 'CONV', color: '#15803D', description: 'Sale & Purchase, Loans, Leases & MOT' },
    { id: 'pa-4', name: 'Corporate', code: 'CORP', color: '#1E40AF', description: 'M&A, Contracts, Advisory & Joint Ventures' },
    { id: 'pa-5', name: 'Criminal', code: 'CR', color: '#B91C1C', description: 'Penal Code, MACC, Traffic & Trial Defense' },
    { id: 'pa-6', name: 'Syariah', code: 'SY', color: '#6B21A8', description: 'Perceraian, Hadhanah, Faraid & Mal' },
  ],
  matterCodes: [
    { id: 'mc-litigation', name: 'Litigation', code: 'L', practiceArea: 'Litigation' },
    { id: 'mc-conveyancing', name: 'Conveyancing', code: 'CONV', practiceArea: 'Conveyancing' },
    { id: 'mc-mot', name: 'Memorandum of Transfer', code: 'MOT', practiceArea: 'Conveyancing' },
    { id: 'mc-poc', name: 'Perfection of Charge', code: 'POC', practiceArea: 'Conveyancing' },
    { id: 'mc-doc', name: 'Discharge of Charge', code: 'DOC', practiceArea: 'Conveyancing' },
    { id: 'mc-loan', name: 'Loan', code: 'LOAN', practiceArea: 'Conveyancing' },
    { id: 'mc-criminal', name: 'Criminal', code: 'CR', practiceArea: 'Criminal' },
    { id: 'mc-ybgk', name: 'YBGK', code: 'YBGK', practiceArea: 'Criminal' },
    { id: 'mc-corporate', name: 'Corporate', code: 'CORP', practiceArea: 'Corporate' },
    { id: 'mc-estate', name: 'Estate Administration', code: 'EST', practiceArea: 'Estate Administration' },
    { id: 'mc-ofs', name: 'Order For Sale', code: 'OFS', practiceArea: 'Estate Administration' },
    { id: 'mc-vo', name: 'Vesting Order', code: 'VO', practiceArea: 'Estate Administration' },
    { id: 'mc-la', name: 'Letter of Administration', code: 'LA', practiceArea: 'Estate Administration' },
    { id: 'mc-prb', name: 'Probate', code: 'PRB', practiceArea: 'Estate Administration' },
  ],
  bankAccounts: [
    {
      id: 'bank_hl_office',
      bankName: 'Hong Leong Bank Berhad',
      accountName: 'Syafiqah Hamizad & Co',
      accountNo: '36301134253',
      swiftCode: 'HLBBMYKL',
      branch: 'Bandar Baru Bangi Branch',
      accountType: 'Office Operating',
      glAccountCode: '1010',
      isDefaultOffice: true,
      isDefaultClient: false,
      notes: 'Main Operating Account for billing collections & firm office expenses',
      isActive: true,
    },
    {
      id: 'bank_hl_client',
      bankName: 'Hong Leong Bank Berhad',
      accountName: 'Syafiqah Hamizad & Co – Client A/C',
      accountNo: '36301136440',
      swiftCode: 'HLBBMYKL',
      branch: 'Bandar Baru Bangi Branch',
      accountType: 'Client Trust',
      glAccountCode: '1020',
      isDefaultOffice: false,
      isDefaultClient: true,
      notes: 'Solicitors Account Rules 1990 — Mandatory Client Monies & Stakeholder Deposits',
      isActive: true,
    },
  ],
  sinkingFunds: [],
  commitments: [],
  complianceRegister: [
    // AMLA — Bank Negara Malaysia (Anti-Money Laundering Act obligations)
    { id: 'cmp-amla-officer', group: 'AMLA', label: 'Compliance officer appointed', note: 'Zulaikha Afendi · notified to BNM', frequency: 'One-off', due: '2025-01-15', owner: 'ZA', done: true },
    { id: 'cmp-amla-dcr', group: 'AMLA', label: 'Data & Compliance Report (DCR)', note: 'Annual return to BNM', frequency: 'Annual', due: '2027-03-31', owner: 'ZA', done: false },
    { id: 'cmp-amla-cdd', group: 'AMLA', label: 'CDD / KYC on new clients', note: 'Verify ID on all new client onboardings', frequency: 'Monthly', due: '2026-09-15', owner: 'AH', done: false },
    { id: 'cmp-amla-risk', group: 'AMLA', label: 'Firm-wide AML risk assessment', note: 'Yearly review', frequency: 'Annual', due: '2027-02-28', owner: 'ZA', done: true, history: [{ period: '2026', completedAt: '2026-02-20', completedBy: 'Zulaikha Afendi' }] },
    { id: 'cmp-amla-training', group: 'AMLA', label: 'Staff AML/CFT training', note: 'All fee-earning staff', frequency: 'Annual', due: '2026-09-20', owner: 'ZA', done: false },
    { id: 'cmp-amla-str', group: 'AMLA', label: 'Suspicious transaction reports (STR) log', note: 'Reviewed and kept up to date', frequency: 'Monthly', due: '2026-09-30', owner: 'ZA', done: true },
    // Client account — Solicitors' Account Rules 1990
    { id: 'cmp-cacc-recon', group: 'Client account', label: 'Monthly client account reconciliation', note: 'Bank vs ledgers', frequency: 'Monthly', due: '2026-10-15', owner: 'SH', done: false },
    { id: 'cmp-cacc-audit', group: 'Client account', label: "Accountant's report to Bar Council", note: 'Auditor: Tan & Co', frequency: 'Annual', due: '2026-10-02', owner: 'SH', done: false },
    { id: 'cmp-cacc-unclaimed', group: 'Client account', label: 'Unclaimed client money review', note: 'Dormant balances over 12 months — Registrar of Unclaimed Moneys', frequency: 'Annual', due: '2026-10-31', owner: 'SH', done: false },
    // Bar Council
    { id: 'cmp-bc-pc', group: 'Bar Council', label: 'Practising certificates renewal', note: 'All practising lawyers', frequency: 'Annual', due: '2026-12-31', owner: 'SH', done: false },
    { id: 'cmp-bc-pii', group: 'Bar Council', label: 'Professional indemnity insurance (PII)', note: 'Mandatory scheme renewal', frequency: 'Annual', due: '2027-01-01', owner: 'SH', done: false },
    { id: 'cmp-bc-cpd', group: 'Bar Council', label: 'CPD points', note: 'Minimum points per lawyer', frequency: 'Annual', due: '2026-12-31', owner: 'AH', done: false },
    // PDPA
    { id: 'cmp-pdpa-register', group: 'PDPA', label: 'Personal data register', note: 'Reviewed annually', frequency: 'Annual', due: '2027-06-15', owner: 'ZA', done: true, history: [{ period: '2026', completedAt: '2026-06-15', completedBy: 'Zulaikha Afendi' }] },
    { id: 'cmp-pdpa-notice', group: 'PDPA', label: 'Privacy notice on forms & website', note: 'Incl. online booking & registration', frequency: 'Annual', due: '2027-01-01', owner: 'ZA', done: true },
    { id: 'cmp-pdpa-breach', group: 'PDPA', label: 'Data breach log', note: 'No incidents on record', frequency: 'Monthly', due: '2026-09-30', owner: 'ZA', done: true },
    // Tax, payroll & licences — LHDN · KWSP · PERKESO · PBT
    { id: 'cmp-tax-sst', group: 'Tax/payroll/licences', label: 'SST return', note: 'Filed bi-monthly', frequency: 'Quarterly', due: '2026-11-30', owner: 'SH', done: true, history: [{ period: 'Jul–Aug 2026', completedAt: '2026-09-30', completedBy: 'Syafiqah Hamizad' }] },
    { id: 'cmp-tax-einvoice', group: 'Tax/payroll/licences', label: 'e-Invoicing (LHDN MyInvois)', note: 'Set up ahead of go-live for firm size', frequency: 'One-off', due: '2027-01-01', owner: 'SH', done: false },
    { id: 'cmp-tax-statutory', group: 'Tax/payroll/licences', label: 'EPF, SOCSO, EIS & PCB', note: 'Monthly statutory contributions', frequency: 'Monthly', due: '2026-10-15', owner: 'SH', done: false },
    { id: 'cmp-tax-premises', group: 'Tax/payroll/licences', label: 'Business premises licence', note: 'Majlis Perbandaran Kajang', frequency: 'Annual', due: '2027-01-31', owner: 'SH', done: true },
    { id: 'cmp-tax-insurance', group: 'Tax/payroll/licences', label: 'Fire & office insurance', note: 'Firm premises cover', frequency: 'Annual', due: '2027-03-01', owner: 'SH', done: true },
    { id: 'cmp-tax-formp', group: 'Tax/payroll/licences', label: 'Annual tax return (Form P)', note: 'Partnership return', frequency: 'Annual', due: '2027-06-30', owner: 'SH', done: true },
  ],
  complaints: [],
  vision: '',
  mission: '',
  target2028: '',
  roadmap: [],
  firmGoals: [],
  panelships: [],
  investmentChannels: [],
  partnersNotes: '',
};

// Helper to retrieve settings from localStorage or fallback to default
export function getPracticeSettings(): PracticeSettings {
  try {
    const saved = localStorage.getItem('shco_practice_settings');
    if (saved) {
      return { ...DEFAULT_PRACTICE_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load practice settings:', e);
  }
  return DEFAULT_PRACTICE_SETTINGS;
}

/**
 * Finance records kept with the settings but stored apart: firm/main/financeConfig/main, which only
 * partners, Accounts, admins and the owner can read or write (same people as Finance). The rest of
 * the settings stays readable by all staff.
 */
const FINANCE_SETTING_KEYS = ['financeSignoffs', 'feeSharing', 'emergencyFund', 'investments', 'fundSplits', 'coaEdits', 'clientBankStatements'] as const;
type FinanceKey = (typeof FINANCE_SETTING_KEYS)[number];
const pickFinance = (s: Partial<PracticeSettings>) => Object.fromEntries(FINANCE_SETTING_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])) as Partial<Pick<PracticeSettings, FinanceKey>>;
const omitFinance = (s: PracticeSettings) => { const o = { ...s } as Record<string, unknown>; FINANCE_SETTING_KEYS.forEach((k) => delete o[k]); return o as unknown as PracticeSettings; };
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function savePracticeSettings(settings: PracticeSettings): void {
  const prev = getPracticeSettings();
  try {
    localStorage.setItem('shco_practice_settings', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('shco-practice-settings-updated'));
  } catch (e) {
    console.error('Failed to save practice settings:', e);
  }
  // Was local-only (this browser's localStorage) forever — nobody else in the firm ever
  // saw a Firm & Practice Settings change. Pushes it into the same shared cloud document
  // everything else already syncs through.
  // Finance records go to their protected document, and only when they actually changed, so a
  // settings save by someone outside Finance can never overwrite them.
  const financeChanged = FINANCE_SETTING_KEYS.some((k) => !same(prev[k], settings[k]));
  void writeCloudState({ practiceSettings: omitFinance(settings), ...(financeChanged ? { financeSettings: pickFinance(settings) } : {}) }).catch((e) => {
    console.error('Practice settings cloud sync failed; this change may only be visible on this device.', e);
  });
}

/** Finance records arriving from their protected document (only for people who may read them). */
export function applyCloudFinanceSettings(fin: Partial<PracticeSettings>): void {
  try {
    const cur = getPracticeSettings();
    localStorage.setItem('shco_practice_settings', JSON.stringify({ ...omitFinance(cur), ...pickFinance(fin) }));
    window.dispatchEvent(new CustomEvent('shco-practice-settings-updated'));
  } catch (e) {
    console.error('Failed to apply cloud finance settings:', e);
  }
}

/**
 * Applies a practice-settings update that arrived FROM the cloud (another device/session)
 * — writes to localStorage and notifies existing listeners, but does NOT re-push to the
 * cloud, which would otherwise create an update loop with the original writer's own save.
 */
export function applyCloudPracticeSettings(settings: PracticeSettings): void {
  try {
    // Keep the finance records this person already has (they arrive separately).
    localStorage.setItem('shco_practice_settings', JSON.stringify({ ...omitFinance(settings), ...pickFinance(getPracticeSettings()) }));
    window.dispatchEvent(new CustomEvent('shco-practice-settings-updated'));
  } catch (e) {
    console.error('Failed to apply cloud practice settings:', e);
  }
}

/** Merge a partial per-partner KPI target update into settings and persist (My Dashboard ->
 * Partner KPIs -> "Edit targets", Managing Partner only). Follows the same
 * get-merge-savePracticeSettings pattern as every other Practice Settings editor. */
export function setPartnerKpiTarget(partnerCode: string, metric: PartnerKpiMetric, value: number): void {
  const settings = getPracticeSettings();
  const next: PracticeSettings = {
    ...settings,
    partnerKpiTargets: {
      ...(settings.partnerKpiTargets || {}),
      [partnerCode]: { ...(settings.partnerKpiTargets?.[partnerCode] || {}), [metric]: value },
    },
  };
  savePracticeSettings(next);
}
