/**
 * Quick guide: one short card per left-menu tab, in plain words, by role.
 * The long step-by-step guide stays in guideContent.ts ("Full guide").
 * Text markup: [[Button]] shows a button label, *bold* shows bold text.
 */
import type { GuideRole } from './guideContent';

export interface QuickTab {
  /** The left-menu item it explains (Sidebar id). */
  id: string;
  group: 'General' | 'Practice' | 'Finance & Accounts' | 'System';
  label: string;
  /** Who has this tab. 'admin' = admins only; 'billing' = partners, Accounts or anyone given billing access. */
  roles: GuideRole[] | 'all' | 'admin' | 'billing';
  /** One line: what this tab is. */
  what: string;
  /** What everyone does here. */
  steps: string[];
  /** Extra lines for one role only. */
  byRole?: Partial<Record<GuideRole, string[]>>;
}

export const QUICK_TABS: QuickTab[] = [
  /* ---------------------------------------------------------------- General */
  { id: 'firmStartCentre', group: 'General', label: 'Firm Start Centre', roles: 'all',
    what: 'The firm’s home page. You land here after signing in.',
    steps: [
      'Click a coloured tile to open that part of the portal.',
      'See who is on leave or in court today, and the next public holiday.',
      'Open firm policies, SOPs and templates on the *shelves*.',
      '*Quick links* open Gmail, Drive, Calendar, the court and PTG sites.',
    ] },
  { id: 'dashboard', group: 'General', label: 'My Dashboard', roles: 'all',
    what: 'Your own to-do list: everything waiting for *you*, most urgent first.',
    steps: [
      'Start each day with *Overdue* and *Today*.',
      'Done? Click the small square on the left of the task.',
      'New task: type in *Add a task…* and press Enter.',
      '*Matter* tasks are seen by the team. *Private* tasks are only yours.',
    ],
    byRole: {
      partner: ['Leave, quotations and other requests wait in *Needs your decision*. Click [[Approve]] or [[Discuss]].'],
    } },
  { id: 'clientPortal', group: 'General', label: 'Client Access Portal', roles: ['partner', 'lawyer', 'assistant'],
    what: 'What your clients see when they sign in: their files, court dates, bills and documents.',
    steps: [
      'Invite a client from their profile: *Clients* → the client → *Client Portal*.',
      'Clients sign in on the *Client Access* tab with their client number. They can only look, not change.',
    ] },
  { id: 'staffPortal', group: 'General', label: 'Staff Portal', roles: 'all',
    what: 'Your own HR page: leave, attendance, payslips and goals.',
    steps: [
      '*Leave*: choose the type and dates, pick who covers your files, click [[Send to partner]].',
      '*Attendance*: [[Clock in]] when you arrive, [[Clock out]] when you leave.',
      '*Payslips*: [[View payslip]] or [[PDF / Print]]. Shows *Not yet* until Accounts sends it.',
      '*Goals & wellbeing*: add goals and do the monthly check-in.',
      'Wrong leave or attendance entry? An admin can [[Delete]] it.',
    ] },
  { id: 'reimbursements', group: 'General', label: 'My Claims', roles: 'all',
    what: 'Get your money back, or ask the firm to pay someone.',
    steps: [
      'You paid already → [[+ New claim form]]. The firm pays the vendor → [[+ Payment request (PV)]].',
      'One receipt = one item. Pick the *file* if the cost is for a client, so it can be billed.',
      'Click [[+ Add item to form]] for each receipt, then [[Submit claim form]].',
      'Follow the status: *Waiting* → *Approved* → *Paid* (or *Rejected* with a reason).',
    ] },

  /* ---------------------------------------------------------------- Practice */
  { id: 'leadsReferrals', group: 'Practice', label: 'Leads & Referrals', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Enquiries before they become clients, and who referred them.',
    steps: [
      'Add every enquiry, with where it came from.',
      'Move it along the stages. When they sign up, make them a client.',
    ] },
  { id: 'clients', group: 'Practice', label: 'Clients', roles: ['partner', 'lawyer', 'assistant'],
    what: 'One record for each person or company we act for. All their files hang under it.',
    steps: [
      'New client: fill in the name, IC / SSM no., contact and address.',
      'Upload the KYC documents on the client. They are saved in Google Drive › *Clients KYC*.',
      'Each client gets a client number (e.g. CL26833) used for the client login.',
    ] },
  { id: 'cases', group: 'Practice', label: 'Cases', roles: ['partner', 'lawyer', 'assistant'],
    what: 'All the files. Open one to work on it.',
    steps: [
      'Find a file with the search box or the practice-area filter.',
      'Inside a file, the tabs along the top are the parts of the work: overview, parties, court, letters, tasks, status…',
      '*Parties*: pick our client from the list, type the other side’s name, choose the role (e.g. 1st Defendant).',
      'Documents you upload go to the file’s own Google Drive folder (Cause Papers, Correspondences, Documents…).',
      '‹ Back (top) takes you to the page you were on before.',
    ],
    byRole: {
      partner: ['Open a new file from the [[+ New]] button. Approve closing a file when the lawyer asks.'],
      lawyer: ['Write the weekly status on each of your active files.'],
      assistant: ['Log every filing and service with its proof (it goes into *Correspondences › Acknowledgment*).'],
    } },
  { id: 'hearings', group: 'Practice', label: 'Hearings', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every court date in the firm, in one list.',
    steps: [
      'Court dates are added inside the file (*Court* tab). This page only shows them.',
      'After each hearing, write the court memo on the file.',
    ] },
  { id: 'calendar', group: 'Practice', label: 'Calendar', roles: 'all',
    what: 'The month view: hearings, deadlines, meetings, leave and office closures.',
    steps: [
      'Everything dated in the portal goes to the firm’s Google Calendar by itself.',
      'The first time, Google asks permission. Click *Allow*.',
    ] },
  { id: 'caseStatus', group: 'Practice', label: 'Case Status', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Where every file stands, at a glance.',
    steps: [
      'A file shows *Not started* until its first weekly status is written.',
      'Update the status inside the file once a week.',
    ] },
  { id: 'deadlines', group: 'Practice', label: 'Deadlines', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every deadline across the files, nearest first.',
    steps: ['Red = overdue. Clear those first.', 'Open the file to deal with it.'] },
  { id: 'serviceLog', group: 'Practice', label: 'Service Log', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every document filed in court or served, for the whole firm.',
    steps: ['Log it on the file with its proof (sealed copy, acknowledgment).', 'This page is the firm-wide list.'] },

  /* ---------------------------------------------------------------- Finance */
  { id: 'accountingCentre', group: 'Finance & Accounts', label: 'Finance Home', roles: 'billing',
    what: 'The money front page: alerts, what is owed, and the Drive filing line.',
    steps: [
      'Read the *Alerts for Accounts* and clear them.',
      '*Drive filing* at the top: shows papers being filed into Google Drive. If it shows a problem, click [[Try again]].',
    ],
    byRole: {
      accounts: ['Keep this page open sometimes: papers are filed into Drive while Accounts has a finance page open.'],
    } },
  { id: 'billing', group: 'Finance & Accounts', label: 'Billing & Collections', roles: 'billing',
    what: 'Quotation → proforma → invoice → receipt.',
    steps: [
      'Click the box you need at the top: 1 Quotation, 2 Proforma, 3 Invoice, 4 Receipt.',
      'Money came in? [[+ Record money in]], pick the client and which bill.',
      'Old papers from before the portal: [[+ Past quotation]], [[+ Past invoice]] or [[+ Past receipt]], with the PDF. These are for reference only and don’t change any totals.',
      '*Fees by file*: what was agreed, billed and paid per file.',
    ],
    byRole: {
      partner: ['Prepare and send quotations for your files.'],
      accounts: ['Issue invoices and record money in. Admin and Accounts can delete a wrong quotation or bill.'],
    } },
  { id: 'retainers', group: 'Finance & Accounts', label: 'Client Account (SAR 1990)', roles: 'billing',
    what: 'Money we hold for clients. It is never office money.',
    steps: [
      'A client’s balance can never go below zero.',
      'Paying out of client money needs two signatures.',
      'Fees move to office only after an invoice to that same client.',
    ] },
  { id: 'officeAccounts', group: 'Finance & Accounts', label: 'Office Account', roles: 'billing',
    what: 'The firm’s own money: office costs, payments for client files, the cash book.',
    steps: [
      'Money out → choose *Office cost*, *Paid for a client file* or *Staff claim or salary*.',
      'Attach the bill or receipt every time. It is filed in Drive by itself.',
      'Wrong entry? Use *Edit* or *Delete* on its row.',
    ] },
  { id: 'approvals', group: 'Finance & Accounts', label: 'Approvals', roles: 'billing',
    what: 'Claims and payments waiting for a signature.',
    steps: [
      '*Waiting for approval*: click [[Approve]] or [[Reject]] (with a reason).',
      '*Approved · to pay*: Accounts pays, then marks it paid with the transfer proof.',
      '[[Drive folder ↗]] opens the receipts in Google Drive.',
    ],
    byRole: {
      partner: ['You only see the items you are set to approve (Settings › Who approves).'],
      accounts: ['Pay what is approved, then attach the payment proof.'],
    } },
  { id: 'payroll', group: 'Finance & Accounts', label: 'Payroll', roles: ['partner', 'accounts'],
    what: 'Monthly salaries and payslips.',
    steps: ['Make each payslip (EPF, SOCSO, EIS worked out for you), then send it.', 'Staff see it in *Staff Portal › Payslips*.'] },
  { id: 'accounting', group: 'Finance & Accounts', label: 'Accounting', roles: ['partner', 'accounts'],
    what: 'The books: every account and what posted to it.',
    steps: [
      '[[Manual journal]] only for corrections. It always goes to Approvals.',
      '[[Import past transactions]] brings in old entries from Excel.',
    ] },
  { id: 'reports', group: 'Finance & Accounts', label: 'Reports', roles: ['partner', 'accounts'],
    what: 'Ready-made reports to view, print or send to the accountant.',
    steps: ['Pick the report and the period.'] },

  /* ---------------------------------------------------------------- System */
  { id: 'practiceSettings', group: 'System', label: 'Firm & Practice Settings', roles: 'admin',
    what: 'How the portal is set up. Admins only.',
    steps: [
      'Each tab has a menu on the left. Pick one section at a time.',
      '*Users & Roles*: add people, switch them off, choose their role.',
      '*Who approves*: who signs claims, payments and leave.',
      '*Banks, Numbering & SST*: bank accounts (pick the type from the list), document numbers, SST.',
      '*Google, e-mail & backup › Backup & tools*: [[Export all firm data]], [[Finance folders…]], [[Client numbers…]].',
      '*Lists & sources*: expense categories, claim types, leave types, public holidays.',
    ] },
  { id: 'inventory', group: 'System', label: 'Office Inventory & Library', roles: 'all',
    what: 'Office items and the law library.',
    steps: ['Find a book or item, and see where it is.'] },
  { id: 'logs', group: 'System', label: 'Activity Logs', roles: 'admin',
    what: 'Who did what, and when.',
    steps: ['Search by person, page or date.', 'Deleted something by mistake? The *Recycle Bin* (box button at the top) can put it back.'] },
  { id: 'guide', group: 'System', label: 'Staff Guide', roles: 'all',
    what: 'This guide. *Quick guide* = short, by tab. *Full guide* = every step.',
    steps: ['Pick a tab on the left to read about it.'] },
  { id: 'account', group: 'System', label: 'My Account', roles: 'all',
    what: 'Your name, sign-in e-mail and role.',
    steps: ['Something wrong? Ask an admin to fix it in Users & Roles.', 'Sign out at the bottom of the left menu.'] },
];
