import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { finRoleKey } from '../../lib/financeAccess';
import { usePracticeSettings } from './settings/settingsShared';

/**
 * "How to use the portal" — the staff guide, by role. Opens on the reader's own role; the other
 * roles are one click away. Wording uses the exact button and menu names in the app.
 *
 * Text markup: [[Button]] shows a button label, *bold* shows bold text.
 */
type GuideRole = 'partner' | 'lawyer' | 'assistant' | 'accounts';
const ROLES: [GuideRole, string, string][] = [
  ['partner', 'Partner', 'Run files, decide and approve'],
  ['lawyer', 'Lawyer', 'Run your files day to day'],
  ['assistant', 'Assistant', 'Filing, service, diary and clients'],
  ['accounts', 'Accounts', 'Billing, payments and payroll'],
];

/** One step; `sub` are the small points under it (what you will see, what to pick). */
type Step = string | { t: string; sub?: string[] };
interface Section {
  id: string; title: string; roles: GuideRole[] | 'all';
  /** Detailed topics: what it is, who does it, and what you need before you start. */
  what?: string; who?: string; before?: string[];
  intro?: string; steps?: Step[];
  /** "If … → do …" for the different situations you may meet. */
  cases?: [string, string][];
  /** "You see … → what it means / what to do" (error messages, missing buttons). */
  stuck?: [string, string][];
  mistakes?: string[];
  tip?: string;
}

const SECTIONS: Section[] = [
  { id: 'signin', title: 'Signing in (and signing out)', roles: 'all',
    what: 'The portal is the firm’s own system for files, clients, court dates, claims, leave and billing. Staff sign in with their firm Google account (the same one you use for your @shcolaw.com Gmail). There is no separate portal password.',
    who: 'Everyone in the firm. Clients and outside people (e.g. the auditor) sign in differently — see “Other situations” below.',
    before: [
      'Your *@shcolaw.com* Google account and its password (the one for your firm Gmail). A personal Gmail will not work.',
      'An admin has added you in *Firm & Practice Settings → Users & Roles* with your role (Partner, Lawyer, Assistant, Accountant…). New staff: ask on your first day, before you try.',
      'A computer with *Google Chrome*. The portal also opens on a phone browser, but use a computer for daily work.',
    ],
    steps: [
      { t: 'Open Chrome and type *portal.shcolaw.com* in the address bar at the top, then press Enter.', sub: ['Tip: bookmark it (the ☆ star at the end of the address bar) so next time it is one click.'] },
      { t: 'You see the sign-in page: *SYAFIQAH HAMIZAD & CO · FIRM PRACTICE PORTAL* on the left, and a white box *Welcome back* on the right.', sub: ['The white box has three tabs: *Staff SSO*, *Client Access* and *External Access*. Staff always use *Staff SSO* (it is already selected).'] },
      { t: 'Click the button [[Continue with Google Workspace]].', sub: ['A small Google window opens on top of the page. If nothing opens, see “Nothing happens” below.'] },
      { t: 'In the Google window, click your *@shcolaw.com* account.', sub: ['Not in the list? Click *Use another account*, type your full firm e-mail (e.g. *name@shcolaw.com*), click *Next*, type your Google password, click *Next*.', 'If Google asks for a code from your phone (2-step verification), enter it. This is Google’s own check, not the portal’s.'] },
      { t: 'The Google window closes by itself and the portal opens on the *Firm Start Centre* (the home page). A message at the bottom says *Welcome back, <your name>.*', sub: ['The menu on the left shows only the parts your role may open — colleagues may see a different menu. That is normal.'] },
      { t: 'The first time you upload a file to Google Drive, or add something to your Calendar, a Google window asks for permission. Choose your @shcolaw.com account and click *Allow*. It asks only once.' },
      { t: 'You stay signed in on this computer, even after closing Chrome, until you sign out.' },
      { t: 'To sign out: scroll to the bottom of the left menu, where your name is, and click [[Sign out]].', sub: ['Always sign out on a shared or office front-desk computer, and before lending your laptop.'] },
    ],
    cases: [
      ['Clients', 'They use the *Client Access* tab with their registered e-mail (or Client ID) and the password the firm sent them. They only see their own files and bills. You invite them from the client’s profile (Clients → Client Portal).'],
      ['Outside people (e.g. the auditor)', 'They use *External Access* with the e-mail and password the admin created. The first time, they must click the link in the verification e-mail before signing in.'],
      ['New computer or phone', 'Same steps. Sign out on the old one if you no longer use it.'],
    ],
    stuck: [
      ['Nothing happens when I click Continue with Google Workspace', 'Chrome blocked the pop-up window. Look at the right end of the address bar for a small blocked-window icon, click it, choose *Always allow pop-ups from portal.shcolaw.com*, then click the button again.'],
      ['“Staff access is restricted to verified @shcolaw.com Google Workspace accounts.”', 'You chose a personal Gmail. Click the button again and pick (or type) your @shcolaw.com account.'],
      ['“Waiting for access” page after signing in', 'You signed in correctly, but the admin has not given you access yet (or it is still being saved). Ask an admin to check you in Users & Roles, then click [[Try again]]. Use [[Sign out]] if you picked the wrong account.'],
      ['“…has no role assigned yet, so you’ve been given limited (Reviewer) access.”', 'You are not in Users & Roles yet. Tell an admin your name and role; after they add you, sign out and sign in again.'],
      ['“This staff account has been deactivated.”', 'Your account was switched off. Ask the Super Admin.'],
      ['“This email is registered as a Client account.”', 'This e-mail is set up as a client. Use your own @shcolaw.com account instead.'],
      ['“Google sign-in was cancelled.”', 'The Google window was closed before you picked an account. Click the button again.'],
      ['“Network error while contacting Google.”', 'Check the Wi-Fi / internet, then try again.'],
      ['A menu I need is missing', 'Your role or your personal access does not include it. Ask an admin; it is set in Firm & Practice Settings → Permissions & limits.'],
    ],
    mistakes: [
      'Signing in with a personal Gmail instead of the @shcolaw.com account.',
      'Clicking *Client Access* or *External Access* — staff always use *Staff SSO*.',
      'Leaving the portal signed in on a shared computer.',
    ],
    tip: 'Forgot your Google password? The portal cannot reset it — it is your firm Google account. Ask the admin to reset it in the Google Workspace admin page.' },
  { id: 'screen', title: 'Finding your way around', roles: 'all',
    what: 'Every page has the same three parts: the *menu* on the left (dark blue), the *top bar* (page name, search, refresh, recycle bin, bell) and the *page* itself in the middle. Learn these once and every page feels the same.',
    who: 'Everyone. What you see in the menu depends on your role and on what the admin has allowed you — a colleague may see more or fewer items. That is normal.',
    steps: [
      { t: 'After signing in you land on the *Firm Start Centre* — the firm’s home page. You can always come back to it: click *Firm Start Centre* at the top of the left menu.', sub: [
        'Top: *Good morning, <your name>* and a link to *My Dashboard* (your own files and tasks).',
        '*How to use the portal* → [[Open guide →]] opens this guide.',
        '*Every part of the practice, one click away*: coloured tiles (Practice, Calendar, Billing, Claims, Trust Account, Staff Portal…). Click a tile to open that part. You only see tiles you are allowed to open.',
        '*Internal notices, celebrations and firm dates*: the next public holiday / office closure, birthdays and call-to-the-Bar dates, and notices from the firm.',
        '*Shelves*: firm policies, SOPs, precedents and templates. Click a shelf to see the documents inside.',
        '*Quick links*: Gmail, Google Drive, Calendar, the Judiciary, Malaysian Bar, PTG and other sites the firm uses, opened in a new tab.',
        '*Today at the firm*: who is in the office, in court or on leave today.',
      ] },
      { t: 'The *left menu* is grouped. Click any item to open it; the item you are on is highlighted.', sub: [
        '*General*: Firm Start Centre · My Dashboard (your work) · Client Access Portal · Staff Portal (leave, payslips, profile) · My Claims.',
        '*Practice*: Leads & Referrals · Clients · Cases (all files) · Hearings · Calendar · Case Status · Deadlines · Service Log · File Closing.',
        '*Finance & Accounts* (only for people allowed to see billing and money): Finance Home · Billing & Collections · Client Account (SAR 1990) · Office Account · Approvals · Payroll · Accounting · Reports.',
        '*System*: Firm & Practice Settings (admins) · Office Inventory & Library · Activity Logs · Staff Guide · About App · My Account.',
        'At the very bottom: your initials, name and role, and [[Sign out]].',
      ] },
      { t: 'On a phone or small window the menu is hidden. Tap the blue *☰* button at the top-left to open it; tap a menu item or anywhere outside the menu to close it.' },
      { t: 'The *top bar* shows the name of the page you are on and one line about what it is for.' },
      { t: 'To find anything, click the search box *Search matters, clients, docs...* in the top bar and start typing — a file number (e.g. *012/2025*), part of the title, a client’s name or a quotation / invoice number.', sub: [
        'Results appear under the box in groups: *Matters*, *Clients*, and *Quotations & Invoices* (the last one only for people with billing access).',
        'Click a result to open it. Press Esc or click elsewhere to close the list.',
      ] },
      { t: 'The round-arrows button next to the search (*Reload latest saved data*) loads the latest changes your colleagues made. Use it if someone says “I’ve updated it” and you don’t see it yet.', sub: ['Your own changes save by themselves — there is no Save-all button. If a change could not be saved, a red message tells you.'] },
      { t: 'The box button (*Recycle Bin*) shows how many things were deleted. Open it to see deleted items and put one back with [[Restore Record]].' },
      { t: 'The *bell* shows a red number when something needs you (new hearing, task, approval, claim decision…).', sub: [
        'Click the bell. Tabs at the top: *All*, *Hearings* and *Paid Invoices* (the last one only for people with billing access).',
        'Click a notification to go straight to that file or page. It is then marked as read.',
        '*Mark all read* clears the red number.',
        'The same notifications are also e-mailed to your @shcolaw.com address.',
      ] },
      { t: 'Some people also see a [[View as…]] button under the top bar. It lets them see the portal exactly as another colleague or role sees it (to check what they can open). Click [[Hide view tools]] to go back to your own view. Only people allowed in *Settings › Permissions* have it.' },
    ],
    stuck: [
      ['A menu item a colleague talks about is not in my menu', 'Your role or your own access does not include it. Ask an admin (Firm & Practice Settings → Permissions & limits).'],
      ['I clicked something and got “Access Restricted” / “not open to your role”', 'That page is not open to you. Go back with the menu. If you need it for your work, ask an admin.'],
      ['Search finds nothing', 'Check the spelling, try fewer words (just the client’s first name, or only the number part like 012/2025), or press refresh and search again.'],
      ['The page looks old or a colleague’s change is missing', 'Press the round-arrows refresh button. Still missing? Close the tab and open portal.shcolaw.com again.'],
      ['I deleted something by mistake', 'Open the Recycle Bin (box button in the top bar) and click Restore Record on it. If you cannot see it there, tell an admin.'],
    ],
    mistakes: [
      'Opening several browser tabs of the portal and editing the same file in two of them — use one tab.',
      'Looking for a Save button: changes save by themselves.',
      'Ignoring the bell — court dates, approvals and claim decisions arrive there first.',
    ],
    tip: 'Fastest way to any file: click the search box, type the file number, press the first result.' },

  { id: 'day', title: 'Your day starts on My Dashboard', roles: 'all',
    what: '*My Dashboard* is your own page: everything waiting for *you* across all your files — tasks, court dates, deadlines, approvals — in one list, sorted by how urgent it is.',
    who: 'Everyone. Partners and people with billing access see a few extra tabs and figures.',
    steps: [
      { t: 'Click *My Dashboard* in the left menu (General). It opens on *My work*.', sub: ['The row of buttons at the top are tabs. Everyone has *My work* and *Finance* (for staff, Finance shows only your own pay, claims and bonus). Partners may also see *Client account*, *Partner KPIs* and *Compliance*.', 'The small coloured dot on each tab: green = all fine, gold = worth a look, red = needs attention.'] },
      { t: 'The coloured tiles give you the count at a glance: *My active matters*, *Deadlines this week*, *My hearings*, *To-do open*, *Waiting on you*, *Unbilled time*.', sub: ['Click a tile to filter the list below to just those items (e.g. *My hearings* shows court dates only). Click it again — or the ✕ on the grey chip — to see everything again.'] },
      { t: 'If you approve things (leave, quotations…), a dark bar *Needs your decision* appears with a button for each: e.g. [[Approve]] or [[Discuss]]. The person who asked is told straight away.' },
      { t: 'The main box is *My to-do*. At the top-right choose *Matter* (work on files, everyone involved can see it) or *Private* (your own reminders — nobody else can see them).' },
      { t: 'Use the round filters *All · Overdue · Today · This week · Later* (the number shows how many). The list is grouped the same way:', sub: ['*Overdue* (red) — past due, clear these first.', '*Today* — due before close of business.', '*This week* — the next seven days.', '*Later* — beyond this week or with no date.', 'Type in *Filter to-do…* to find one item by its words or file number.'] },
      { t: 'Each row shows: the task, the type (Task, Hearing, Statutory deadline…), the file number and title, the priority flag, and a coloured pill with the due date (e.g. *Due today*, *3 days overdue*).' },
      { t: 'Finished a task? Click the small square on the left of the row. It is ticked, crossed out and counted in *completed today*. Clicked by mistake? Click it again (*Mark not done*).', sub: ['Court dates, deadlines and approvals have no square — they are done on the file or in Approvals. Click the gold word on the right (*Open*, *Approve*, *Sign off*, *Write up*) to go there.'] },
      { t: 'To add a task quickly: click the line *Add a task… press Enter to save (due today)*, type it, press Enter.', sub: ['For a date, file, person, priority or checklist click [[More details]] instead, or [[New task]] at the top.', 'If you use Google Tasks, your own tasks also appear there (two-way). The first time, Google asks permission — click Allow.'] },
      { t: 'On the right: *Recently accessed* files (click to reopen), *Your meetings* ([[+ Book slot]] to book one), and *Court & deadlines* for the next 7 days ([[Calendar ->]] opens the full calendar).' },
      { t: 'People with billing access also see *My Performance* (billed, collected, new files, referrals against your targets — [[Edit targets]] to set them), *My collection rate* and *My aging receivables*. *Productivity* shows today’s tasks done and your streak.' },
    ],
    cases: [
      ['A file has a next step but no task yet', 'It shows with the next action written on the file. Make it a proper task on the file (Tasks tab) so it has a date and a person.'],
      ['Something is in my list that is not mine', 'You are named as partner or lawyer on that file, or the task is assigned to you. Ask the partner to change the file’s people, or reassign the task.'],
    ],
    stuck: [
      ['“Nothing here. You’re all caught up.”', 'Nothing is due for you. If you expected something, check the filter (click *All*) and that the task was assigned to you.'],
      ['“Cases is not open to your role.”', 'You clicked a file but your role cannot open Cases. Ask an admin if you need it.'],
      ['“Saved here, but Google Tasks did not update”', 'The task is saved in the portal. Google Tasks needs permission again — add any task once and click Allow when Google asks.'],
    ],
    mistakes: [
      'Putting file work in *Private* — colleagues covering for you cannot see it. Use *Matter* for anything about a file.',
      'Ticking a task done when only part is finished. Use the checklist inside the task instead.',
    ],
    tip: 'Start every day with the *Overdue* and *Today* filters, and end the day with nothing red.' },
  { id: 'alerts', title: 'Notifications (the bell and e-mails)', roles: 'all',
    what: 'When something needs you — a new task, a court date, a decision, a claim approved or rejected, a file assigned to you — the portal tells you in two places: the *bell* at the top, and an *e-mail* to your @shcolaw.com address from *SHCO Portal*.',
    who: 'Everyone. You only get notifications meant for you.',
    steps: [
      { t: 'Look at the bell at the top-right of any page. A red number = how many you have not read.' },
      { t: 'Click the bell. The list opens with the newest first; unread ones are highlighted with *UNREAD*.', sub: ['Tabs: *All*, *Hearings*, and *Paid Invoices* (only people with billing access).'] },
      { t: 'Click a notification. It opens the file or page it is about and is marked as read.' },
      { t: 'Click *Mark all read* to clear the red number once you have seen everything.' },
      { t: 'The e-mail has the same message and a link. Clicking the link opens the portal (sign in if asked).' },
    ],
    stuck: [
      ['I get no e-mails', 'Check Spam / Promotions in Gmail and mark *SHCO Portal* as “Not spam”. Still nothing? Tell an admin (Settings → Google, e-mail & backup).'],
      ['Clicking a notification shows “Access Restricted”', 'It is about a page your role cannot open. Ask whoever sent it, or an admin.'],
      ['Amounts show as “RM •••”', 'That is on purpose: amounts are only shown to people with billing access.'],
    ],
    mistakes: ['Clearing the bell with *Mark all read* without opening the court-date or approval ones.'] },
  { id: 'leave', title: 'Staff Portal: leave, attendance, payslips, goals and my profile', roles: 'all',
    what: '*Staff Portal* is your own HR page: apply for leave, record attendance, see your payslips and EA form, set goals, do the monthly check-in, and see your own employee record.',
    who: 'Every staff member (not clients). You see only your own things. HR people also see *Employee records* for everyone.',
    steps: [
      { t: 'Click *Staff Portal* in the left menu (General). The cards at the top show your last *Net pay*, *Annual leave left*, *Claims waiting* and *Goals on track*.' },
      { t: '*Apply for leave*: open the *Leave* tab and fill in the *Apply for leave* box:', sub: [
        '*Type of leave*: Annual, Medical, Hospitalisation, Study / exam, Hajj, Umrah, Unpaid…',
        'Full day, or *Half day (AM)* / *Half day (PM)*.',
        '*From* and *To*: the first and last day. Weekends and public holidays are not counted.',
        '*PIC covering my files*: choose the colleague who will look after your files.',
        'Medical leave: attach the MC. Hajj: attach the Tabung Haji letter (photo is fine).',
        'Click [[Send to partner]]. Your partner (or whoever the firm set in *Who approves*) and your cover person are notified.',
      ] },
      { t: 'Your requests are listed under *My leave* with the status: *Waiting*, *Approved* (by whom), *Rejected* or *Cancelled*. You get a notification when it is decided. [[+ My calendar]] downloads it into your Google / Outlook / Apple calendar.' },
      { t: '*Attendance* tab: when you arrive click *Clock in*; when you leave click *Clock out*. Working remotely, in court or on site? Choose *Remote*. On leave or not working? Choose *Leave* or *Absent*. Add a note if needed.', sub: ['The time comes from your computer’s clock when you press the button.'] },
      { t: '*Payslips* tab: one line per month. Click [[View payslip]] to see it exactly as printed, [[PDF / Print]] to save or print, and [[Download EA form]] at year end.', sub: ['A month shows *Not yet* until Accounts sends the payslips. Claims are paid back separately — they are not in your salary.'] },
      { t: '*Goals & wellbeing* tab: [[+ Add goal]] for personal or career goals (status: Not started, On track, Behind, Done). Once a month answer *How are you feeling at work this month?*, pick topics, write anything you want, choose *With my name* or *Anonymous*, then [[Send check-in]].' },
      { t: '*My profile* tab: your own employee record (personal, work, payslip and practice details) and your documents (IC, offer letter, contract, practising certificate…). It is read-only — if something is wrong or out of date, tell HR / the admin to correct it.' },
    ],
    stuck: [
      ['“Not enough leave balance”', 'You asked for more days than you have left. Choose fewer days, or Unpaid leave, or speak to your partner.'],
      ['“No working days in those dates”', 'The dates are all weekend or public holidays. Check the From / To dates.'],
      ['“Please attach the supporting document”', 'This leave type needs a document (MC, letter). Attach it, then send.'],
      ['“Uploads blocked”', 'Files cannot be uploaded right now (storage not set up or no permission). Tell an admin; send the document to them meanwhile.'],
      ['“Staff Portal is available to staff accounts only.”', 'You are signed in with a client account. Sign out and use your @shcolaw.com account.'],
    ],
    mistakes: ['Applying for leave without choosing who covers your files.', 'Forgetting to clock out — use *Update clock-out to now* the next morning and add a note.'] },
  { id: 'claims', title: 'My Claims: getting paid back, and asking the firm to pay someone', roles: 'all',
    what: '*My Claims* is where you (1) claim back money *you* paid for the firm or a file — mileage, parking, tolls, filing fees, despatch, office items — and (2) ask the firm to pay a vendor directly (*Payment request (PV)*). Approved claims are paid back separately from salary.',
    who: 'Every staff member. You see only your own claims. Whoever is set in *Who approves* approves them; Accounts pays.',
    before: ['Your receipts (photo or e-receipt is fine).', 'The file number if the cost is for a client file — it can then be billed to the client.'],
    steps: [
      { t: 'Click *My Claims* in the left menu. You see your list, and *My updates* (approved, paid, rejected messages).' },
      { t: 'Choose what you need:', sub: ['[[+ New claim form]] — *I already paid · the firm pays me back*.', '[[+ Payment request (PV)]] — *The firm pays the vendor directly* (you have not paid).'] },
      { t: 'Claim form — *C. Items*: fill in one item at a time:', sub: [
        '*Date* of the expense.',
        'Type: *Travelling* (mileage, parking, toll), *Disbursement* (for a client file, e.g. filing fee, search) or *Office* (firm overhead, not billed to any client).',
        '*File*: search by file no., client or matter. Leave it as office if it is not for a client.',
        'Travelling: enter *Distance (km)*, *Parking (RM)* and *Toll (RM)* — the amount is worked out (staff paid RM 1.00/km).',
        'Others: *Description* and *Amount (RM)*.',
        'Receipt: drop the photo into *Receipts: drop here* (or click it to choose the file).',
        'Click [[+ Add item to form]]. Repeat for each receipt.',
      ] },
      { t: 'Check the *TOTAL*, then click [[Submit claim form]]. You see *Claim Form Submitted* and the approver is notified.' },
      { t: 'Payment request (PV): fill in *Pay to (vendor)*, the amount and description, the file, attach *their invoice or quotation*, and choose *How it is paid*:', sub: ['*Bank transfer* — their bank and account no.', '*Online portal* — which portal (e.g. e-Filing, e-Tanah, STAMPS); Accounts pays there and attaches the portal receipt.', '*Cheque* — who the cheque is payable to.', '*Paid from*: Office account, or Client account if it is the client’s money.', 'Click [[Submit payment request]].'] },
      { t: 'Follow the status in your list:', sub: ['*Waiting* — with the approver (it says who).', '*Approved* — now with Accounts to pay.', '*Paid* — Accounts has paid you (or the vendor).', '*Rejected* — the reason is in *My updates*.'] },
      { t: 'Use the *All years* and *All types* filters to find an old claim. [[Drive folder ↗]] opens the folder in Google Drive where its receipts are kept.' },
    ],
    cases: [
      ['Wrong amount after submitting', 'Ask the approver to reject it with a note, then submit a new one with the right amount.'],
      ['Cost is for a client', 'Always pick the file — it then appears as a disbursement to bill the client (mileage is billed at RM 1.50/km, parking and tolls at cost).'],
      ['Where are my receipts saved?', 'In the firm’s Google Drive: Finance › <year> › Claims › <form no.> (payment requests: Payment Vouchers › <PV no.>).'],
    ],
    stuck: [
      ['“Add at least one item”', 'Fill in the item and press *+ Add item to form* before submitting.'],
      ['“Attach the receipt for this item”', 'Each item needs its receipt photo.'],
      ['“Fill in who to pay and their bank”', 'For a bank-transfer PV, fill in the vendor and their bank account.'],
      ['“Stored on the device it was uploaded from”', 'Google Drive is not set up yet, so the receipt is only on that computer. Tell an admin.'],
    ],
    mistakes: ['Putting several receipts into one item — one receipt, one item.', 'Choosing *Office* for a client cost — the firm then cannot bill it.'] },
  { id: 'calendar', title: 'Calendar and Hearings', roles: 'all',
    what: '*Hearings* is the firm-wide list of court dates. *Calendar* shows them on a month grid, and also the firm’s live Google Calendar (court diary).',
    who: 'Everyone who can open Cases. Court dates are added on the file (Court tab) — these pages only show them.',
    steps: [
      { t: 'Click *Hearings* in the left menu (Practice). You see every scheduled court date in the firm: *Date*, *Time*, *Matter Reference*, *Purpose* and *Timing Status* (*Today* / *Upcoming*).' },
      { t: 'Click *Calendar*. Choose the view with the two buttons at the top:', sub: ['*Court Diary Grid* — the month from the portal’s own court dates, coloured by type (Hearing, PTCM / Mention, Trial / Bicara, Filing Deadline, Consultation). Hover a date to see the file and purpose.', '*Live Google Calendar* — the firm’s Google court diary inside the page. You must be signed in to Chrome with your @shcolaw.com account, and the firm calendar must be shared with you.'] },
      { t: '[[Add / Open in Signed-In Google Calendar]] opens the court diary in Google Calendar itself, where you can add it to your own list.' },
    ],
    stuck: [
      ['The Live Google Calendar is blank or asks me to sign in', 'Sign in to Chrome / Google with your @shcolaw.com account (not a personal one) and reload. Still blank? Ask the admin to share the firm court diary with you.'],
      ['A court date is missing', 'It was not entered on the file. Open the file → Court tab and add it (or ask the lawyer in charge).'],
    ],
    mistakes: ['Adding court dates only in Google Calendar — always add them on the file so reminders, My work and Hearings know about them.'] },
  { id: 'help', title: 'My Account, getting help and undoing a mistake', roles: 'all',
    what: 'Where to see your account, change how the portal looks, and what to do when something goes wrong.',
    who: 'Everyone.',
    steps: [
      { t: '*My Account* (bottom of the left menu, System) shows your name, e-mail and role. Under *Appearance* choose *Light*, *Dark* or *System* (follows your computer).' },
      { t: 'Something looks wrong or old? First press the round-arrows *refresh* button at the top. Still wrong? Close the tab and open portal.shcolaw.com again.' },
      { t: 'Deleted something by mistake? Click the box button (*Recycle Bin*) at the top, find it, click [[Restore Record]].' },
      { t: 'Still stuck? Take a screenshot (Mac: Cmd+Shift+4, Windows: Win+Shift+S) and send it to an admin with the file number and what you clicked.', sub: ['A missing menu or button is usually access: an admin can change it in Firm & Practice Settings → Permissions & limits.'] },
    ],
    mistakes: ['Working around a problem in WhatsApp or paper instead of telling an admin — the portal then has the wrong information.'] },

  /* ---------------------------------------------------------------- Part B: running files */
  { id: 'clients', title: 'Registering a client and KYC', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every person or company we act for has one client record, shared by all their files. KYC (know your client) documents are kept on that record and in the client’s Google Drive folder.',
    who: 'Whoever takes the new client in — usually the lawyer or assistant. Anyone who can open Clients.',
    before: ['Individual: full name as in NRIC, NRIC / passport no., phone, e-mail, address.', 'Company: registered name, SSM / ROC no., the person who instructs us and their designation.', 'Scans or photos of the KYC documents.'],
    steps: [
      { t: 'Open *Clients* (left menu, Practice) and click [[Register new client]].' },
      { t: 'Choose *Individual* or *Corporate*, then fill in the name, NRIC / passport no. (or SSM / ROC no.), phone and e-mail.', sub: ['The *conflict check runs as you type*: if the name matches an existing client or an opposing party in any file, a red *Possible conflict* box appears. The client is then saved as *Needs review* (see the next topic).'] },
      { t: 'Click [[Save client]]. You see *Client registered. Upload KYC documents next* and the client’s profile opens.' },
      { t: 'The profile has tabs: *Profile* (details), *Files*, *Money* (only people with billing access), *KYC*, *Portal access* and *History*.', sub: ['Edit any detail by clicking it on *Profile*. Changes save automatically and are logged in History.', '*Instructions & notes*: how the client likes to be contacted, billing instructions, board-resolution conditions.'] },
      { t: 'Open the *KYC* tab. It lists what this client needs:', sub: ['Individual: NRIC / passport copy (front and back), proof of address (not older than 3 months), source of funds declaration (conveyancing and client-account deposits).', 'Company: SSM certificate, SSM company profile (not older than 3 months), board resolution appointing the firm, NRIC of directors / signatories.'] },
      { t: 'For each document click [[Upload]] and choose the file. It goes to the client’s Google Drive folder (Clients › <ID - name> › KYC) and shows *To verify*.' },
      { t: 'A second person checks the copy against the original and clicks [[Mark verified]]. When every row is *Verified* the tab says *All required documents verified*.', sub: ['[[View]] opens a document; [[Open Drive folder]] opens the whole folder.'] },
      { t: 'Fill in *Customer due diligence*: risk rating, PEP details, source of funds / wealth, purpose, how and by whom it was verified, and enhanced due diligence if high risk.' },
    ],
    cases: [
      ['Client already exists', 'Search the client list first (name, client ID, NRIC, SSM no., phone or e-mail). Never register the same client twice — open a new file for the existing client.'],
      ['Client registered by mistake', 'The bin icon on the profile deletes it, but only if it has no open files (and only people allowed to delete clients).'],
      ['Find clients with work to do', 'Use the filters above the list: *KYC to finish*, *Conflict to review*, *No portal login*, and *Owes us* (billing people).'],
    ],
    stuck: [
      ['“Cannot delete: this client has open files.”', 'Close or move the files first.'],
      ['“Only the name of this document was recorded. There is no stored copy.”', 'An old entry from before Drive uploads. Upload the document again.'],
      ['Upload fails or says Drive is not set up', 'Tell an admin (Settings → Google Drive storage). Keep the copy safe meanwhile.'],
    ],
    mistakes: ['Opening a file before KYC is finished — finish it before the next file is opened.', 'Verifying your own upload: a second person should verify.'] },
  { id: 'conflict', title: 'Clearing a conflict check', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Before we act for someone we check they are not the other side in another of our files, and the other side is not our client. If there is a match the portal stops and asks someone to look at it.',
    who: 'Anyone can see a possible conflict. Only people allowed in *Settings › Permissions › Clients › Clear a conflict check* can clear it (partners by default; the admin can give it to others).',
    steps: [
      { t: 'You will see it in one of two places:', sub: ['When registering a client or opening a new file: a red / orange *Possible conflict* box naming what matched, e.g. *ALI BIN ABU is the other side in 012/2025…*', 'On the client list / profile: the *Conflict* column shows *Needs review* or *Flagged*.'] },
      { t: 'Open the matching file or client in a new tab (search the number or name at the top) and compare: same NRIC / company no.? Same address? Same matter?' },
      { t: 'On the client: *Profile* → the conflict box → [[Review conflict check]]. Choose:', sub: ['*Clear* — not the same person, or no clash (e.g. an old unrelated matter). Only allowed people can choose this.', '*Needs review* — you are not sure; send it to someone allowed to decide.', '*Flagged* — a real clash; we must not act.', 'Write in *Notes* why, then [[Save decision]]. Your name, the date and the note go into the client’s History.'] },
      { t: 'On the new-file screen: if you are allowed, click [[Reviewed, safe to act]] after checking. If you are not, it says *Needs review by someone allowed to clear conflicts* and the file cannot be opened until they do.' },
    ],
    stuck: [
      ['“You do not have permission to clear a conflict check.”', 'Choose *Needs review* and tell the person who clears conflicts (usually the partner in charge).'],
      ['The *Open file* button stays grey with “Conflict needs review”', 'Someone allowed must review it first.'],
    ],
    mistakes: ['Clicking safe without opening the matching file.', 'Leaving the note empty — the note is your record if anyone asks later.'] },
  { id: 'file', title: 'Opening a new file', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Opening a file gives the matter its file number, its team, its Google Drive folder and (if you want) a Letter of Engagement ready to print.',
    who: 'Partners and lawyers (and anyone else allowed to open files).',
    before: ['The client is registered (previous topics) and its conflict check is clear.', 'The other side’s name, the practice area and the partner in charge.'],
    steps: [
      { t: 'Open *Cases* → [[Open new file]] (or on the client’s profile → [[+ Open new file]]).' },
      { t: '*1. Client*: search the client by name, IC or company no. (or [[+ New client]]). Type the *client initials* used in the file number (e.g. *AH*). Fill in the other side — the conflict check runs straight away.' },
      { t: '*2. Matter*: choose the *Practice area*, then the *Matter code*. Type the *Matter title*, e.g. *Client name v. Other side (nature of claim)*. Fill in the extra boxes for that area (court and suit no. for litigation, title no. and price for conveyancing, deceased name for probate…).' },
      { t: '*3. Team*: pick one or more *Partner in charge* (type a name or code), and the *Lawyer in charge* if any.', sub: ['Watch *File no. preview* at the top — it builds the number from the partner, lawyer, client initials and running number.'] },
      { t: '*4. Letter of Engagement*: tick *Prepare Letter of Engagement* and choose the *Language* (English / Bahasa Malaysia) if you want it ready when the file opens. Fees come from the file’s quotation in Billing; if none is made yet it says “as per our quotation”.' },
      { t: 'Click [[Open file]]. You see *File opened* and *What happens next*:', sub: ['*Quotation* — make it in Billing & Collections (billing people).', '*Engagement letter* — print it for the client to sign; upload the signed copy in the file’s Letters tab.', '*File cover* — print and put on the physical file.', 'The Google Drive folder is created automatically: SHCO Portal › Matters › <practice area> › <NNN - title>, with Court Papers, Correspondence, Client Documents, Research and Closing.'] },
      { t: 'Click [[Go to the file]] to start working on it.' },
    ],
    stuck: [
      ['The Open file button is grey', 'The message next to it says what is missing: *Choose the client*, *Type the client initials…*, *Choose a matter code*, *Enter a matter title*, *Pick a partner in charge*, or *Conflict needs review*.'],
      ['“That file no. is already in use. Check the running number.”', 'Someone opened a file with the same number. Refresh and try again; if it repeats tell an admin.'],
      ['“File opened, but the Drive folder was not created”', 'The file is fine. On the file click *Create Drive folder*, or ask an admin to check Drive in Settings.'],
    ],
    mistakes: ['Registering the client again instead of searching for them.', 'A vague title — use “Client v. Other side (nature)”, it is used in letters and court papers.'] },
  { id: 'tabs', title: 'Inside a file: the tabs', roles: ['partner', 'lawyer', 'assistant'],
    what: 'A file opens on one page with tabs along the top. Each tab is one part of the work; everything is saved on the file and in its History.',
    who: 'Everyone who can open Cases. *Money* shows only for people with billing access.',
    steps: [
      { t: 'Open a file from *Cases* (click its row), the search box, My Dashboard or a notification. The top shows the file no., title, status, the team, and buttons [[Edit matter details]], [[Print file cover]], [[Request to close]] and delete / request deletion.' },
      { t: 'The tabs:', sub: [
        '*Overview* — parties (used in letters, court papers and the conflict check), client updates, next court date, open tasks.',
        '*Status* — the weekly status update and stages.',
        '*Court* — court details, hearings and court memos.',
        '*Filing & service* — what was filed and served, with proof.',
        '*Tasks* — the file’s tasks and deadlines.',
        '*Time & costs* — time logged and costs from claims.',
        '*Money* — bills and the matter ledger (billing people only).',
        '*Notes* — meeting notes, research, internal notes. Never sent to the client.',
        '*Letters & e-sign* — Letter of Engagement, letter templates and uploaded documents.',
        '*History* — every change, recorded automatically; cannot be edited or deleted.',
      ] },
      { t: 'The number in a tab name (e.g. *Court (2)*, *Tasks (3 open)*) tells you how much is in it.' },
      { t: 'A closed or archived file is read-only: you can look, not change.' },
    ],
    mistakes: ['Keeping notes in WhatsApp or on paper — put them in *Notes* so the next person can see them.'] },
  { id: 'assign', title: 'Editing file details and the team', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Change a file’s title, practice area, status (Active / Pending on hold), partner(s) and lawyers in charge, and its Google Drive and old-drive links.',
    who: 'Anyone who can edit the file. The file no. and date opened can only be changed by an admin.',
    steps: [
      { t: 'On the file click [[Edit matter details]].' },
      { t: 'Change what you need:', sub: ['*Partner in charge* and *Lawyers in charge*: type a name or code and click it; × removes someone. Several people are allowed.', '*File status*: Active, or *Pending (on hold)*.', '*Google Drive folder*: paste the folder link if it is missing.', '*Old folder (optional)*: the link to this file’s folder in an old drive (nothing there is moved).'] },
      { t: 'Write a *Reason for change* (e.g. *File reassigned*) and click [[Save changes]]. Everyone newly added is notified and sees the file in My work; the change is in History.' },
      { t: 'If the people changed, the file number does not change by itself. Admins see [[Rebuild from partners & lawyer]] to update it with a reason; linked bills, receipts and claims move with it.' },
    ],
    cases: [['Parties, court, suit no., coram or opposing solicitors', 'Not here: parties are edited in *Overview*, court details in the *Court* tab so their history is kept.']],
    mistakes: ['Changing the team without a reason — the reason is the only record of why.'] },
  { id: 'tasks', title: 'Tasks and deadlines on a file', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every piece of work with a date is a task on the file. Tasks show on the file and in the assigned person’s *My work*.',
    who: 'Anyone working on the file.',
    steps: [
      { t: 'Open the file → *Tasks* tab → [[+ New task]].' },
      { t: 'Fill in the *Task name*, the *Assignee*, the *Kind* (a normal *Task*, or a deadline: *Court order*, *Rules of Court*, *Limitation*, or a *Key date*), the *Due date* (quick buttons *Today*, *Tomorrow*, *Next week*), *Priority*, *Task type* (Drafting, Filing, Research, Appearance…) and a *Description*.', sub: ['Deadlines remind earlier (limitation: 30 days before; others: 3 days before).'] },
      { t: 'Save. The assigned person is notified and sees it in My work. If it is assigned to you and you use Google Tasks, it also appears there (*✓ Google Tasks*).' },
      { t: 'To update: click the task, change its status (Not Started, In Progress, In Review, Completed) or tick checklist items. Done: tick it on the file or in My work.' },
      { t: '[[Open My Work →]] jumps to your own list across all files.' },
    ],
    mistakes: ['A task with no due date — it sinks to *Later* and gets forgotten.', 'Assigning to “the team” in the text instead of a person.'] },
  { id: 'court', title: 'Court: hearings and court memos', roles: ['partner', 'lawyer', 'assistant'],
    what: 'The *Court* tab holds the court details (court, suit no., coram, opposing solicitors), every hearing, and a court memo for each court date (what happened and what is next).',
    who: 'Lawyers and assistants on the file.',
    steps: [
      { t: 'Open the file → *Court* tab. Check *Court details* (court level, location, division, suit no., address). [[Edit court details]] to fix them.' },
      { t: 'Coram or opposing solicitors changed? Click [[Change]] next to them, choose the *Effective from* date and the *Reason*. The old one is kept in history.' },
      { t: 'Add a hearing: [[+ Add hearing]] → date, time, purpose (e.g. Case management, Mention, Trial) → tick *Add to Google Calendar* to put it in the firm court diary and invite the person in charge → [[Save hearing]]. It shows in My work, Hearings and Calendar.' },
      { t: 'After the court date write the memo: [[+ New court memo]] and fill in:', sub: [
        '*Court date*, *Coram (judge / registrar)*, *Medium* (in chambers, open court, e-Review, online…).',
        '*Our lawyer attending*: type and pick one or more partners / lawyers.',
        '*Opponent counsel* and whether the *Client* was present.',
        '*Court directions*: what the court ordered.',
        '*Instructions / notes*: e.g. client to hand over originals.',
        '*Next court date*: it is added to Hearings automatically.',
        '*Task from this memo* (optional): e.g. *File written submissions*, *Task for* and *Task due*.',
        'Save. The memo can be printed (*COURT MEMO*) for the physical file.',
      ] },
    ],
    stuck: [['“Set up the court diary in Firm Settings”', 'The Google Calendar box is off because the firm court diary is not set up. The hearing is still saved; tell an admin.']],
    mistakes: ['Not writing the memo on the day — directions and the next date get lost.', 'Putting the next date only in Google Calendar — use *Next court date* in the memo.'] },
  { id: 'service', title: 'Filing and service, and the Service Log', roles: ['partner', 'lawyer', 'assistant'],
    what: 'Every document filed in court or served on a party is logged with its proof (sealed copy, CMS receipt, acknowledgement, affidavit of service). The *Service Log* is the same list for the whole firm.',
    who: 'Assistants / clerks and lawyers.',
    steps: [
      { t: 'On the file → *Filing & service* tab → add an entry: *What happened* (filed, served, received), *Date*, *Document* (e.g. Affidavit in reply, Encl. 18), the party / solicitor, *Method* (by hand, e-filing, post, e-mail…).' },
      { t: 'Attach the proof: *Proof type* and [[Choose file]]. It is saved to the file’s Court Papers folder in Drive. Add *Notes* if useful, then save.' },
      { t: 'Firm-wide: *Service Log* in the left menu shows every entry from every file. [[+ Add entry]] → *Pick the file…* → same boxes. Search with *Search document, file, party…*; click a file no. to open the file.' },
      { t: 'Entries made in the Service Log show on the file, and the other way round.' },
    ],
    stuck: [['“Proof not uploaded”', 'The entry is saved without the proof. Open it again and attach the file, or tell an admin if uploads fail.']],
    mistakes: ['Logging service without the proof — it is the first thing the court asks for.'] },
  { id: 'weekly', title: 'Weekly status update and Case Status', roles: ['partner', 'lawyer'],
    what: 'Once a week each active file gets a short status: did last week’s step happen, what moved, the next step, anything holding it up. It is the firm’s record and feeds *Case Status* (all files at a glance).',
    who: 'The lawyer in charge (partners review).',
    steps: [
      { t: 'On the file → *Status* tab → [[Do this week’s update]] (also on Overview).' },
      { t: '*You said the next step was …* — *Did it happen?* If not, write why (e.g. client has not sent bank statements).' },
      { t: 'On the left, tick what happened on the file since the last update, then [[Add ticked to progress →]]. Edit the *Progress this week* text.' },
      { t: 'Set the *Stage* and *Health*, the *Next step*, and *Anything holding it up?*' },
      { t: 'Optional: *Also send to client* with the *Message to client* (e-mail, or open in WhatsApp). Save.' },
      { t: 'Firm-wide: *Case Status* in the left menu shows every file as a *Kanban Board* (drag a file between stages) or *Table Matrix*, with filters by practice area, lawyer and stage.' },
    ],
    mistakes: ['Writing “no update” — say what is waiting and on whom.'] },
  { id: 'letters', title: 'Letters, Letter of Engagement and documents', roles: ['partner', 'lawyer', 'assistant'],
    what: 'The *Letters & e-sign* tab makes the Letter of Engagement and common letters from the file’s details, and holds the file’s uploaded documents (saved to its Google Drive folder).',
    who: 'Everyone on the file.',
    steps: [
      { t: 'Open the file → *Letters & e-sign*.' },
      { t: 'Letter of Engagement: choose it in *Generate from template*, pick *EN* or *BM*, then view, print or save as PDF / Word. The fee breakdown and payment plan come from the file’s accepted (else latest) quotation; if you cannot see quotations it says “as per our quotation”.' },
      { t: 'Other letters: choose the template (next court date to client, letter to opposing solicitors, blank affidavit with intitulement, notice of change, closing letter) → [[Generate draft]]. A Word draft downloads, filled from the file — finish it in Word.' },
      { t: 'Upload a document (signed letter of engagement, correspondence, court papers…): choose the *category* — it decides the Drive folder (Correspondence, Court Papers, Client Documents, Research, Closing, or *Engagement & Billing* which goes to the private Finance drive) — then choose the file.' },
      { t: 'Tick *Share with client* on a document to show it in the client’s portal.' },
      { t: '*E-signature* is not connected yet: print, get it signed, scan and upload.' },
    ],
    stuck: [['Engagement & Billing upload fails', 'You are not a member of the Finance drive. Ask a partner or Accounts to upload it.']],
    mistakes: ['Uploading into the wrong category — the file then sits in the wrong Drive folder.'] },
  { id: 'time', title: 'Time and costs on a file', roles: ['partner', 'lawyer'],
    what: 'Time spent on a file is logged here; costs (filing fees, mileage, searches) come in automatically from approved claims and payment requests, so nothing is typed twice. Unbilled items are then billed.',
    who: 'Lawyers and partners log time. Billing is done by people with billing access.',
    steps: [
      { t: 'Open the file → *Time & costs* → [[+ Log time]].' },
      { t: 'Fill in *Date*, *Work done* (e.g. Drafting written submissions), *By*, *Hours*, and *Rate (RM / h)* (it remembers the last rate). [[Save time]].' },
      { t: 'A cost you paid yourself? [[+ Claim a cost →]] opens My Claims with this file chosen.' },
      { t: 'The cards show *Unbilled time*, *Unbilled time value* and *Unbilled costs*. People with billing access click [[Bill unbilled items]] to put them on a bill.' },
    ],
    mistakes: ['Logging a week’s time at the end of the month — log it the same day.'] },
  { id: 'close', title: 'Closing, reopening and deleting a file', roles: ['partner', 'lawyer', 'assistant'],
    what: 'A finished file is *closed* (kept 7 years), not deleted. The lawyer asks to close; someone allowed approves after a checklist. Delete is only for files opened in error or duplicates.',
    who: 'Anyone on the file can ask. Approving, reopening and deleting are set in *Settings › Permissions* (partners by default; partners only for their own files).',
    steps: [
      { t: 'On the file click [[Request to close]]. The checklist shows what the system checked (open tasks, future court dates, bills, money in the client account) and what you tick yourself (original documents returned, closing letter sent).' },
      { t: 'Choose the *Outcome*, write a *Note to the approver*, click [[Send for approval]]. The approvers are notified.' },
      { t: 'The approver opens the file (or *File Closing* in the left menu, which lists every close request). They see the checklist and either [[Approve & close file]] or write a reason and *Send back*.' },
      { t: 'Closed: the file is read-only. Fill in *Archive*: archive box no., where it is kept, destroy-after date (7 years from closing). [[Print file cover]] for the box.' },
      { t: 'Reopen: someone allowed clicks [[Reopen file]] on the closed file.' },
      { t: 'Delete (opened in error or duplicate only): [[Delete matter]] → choose the reason → type the file no. to confirm. Others see *Request deletion*, which goes to the partner in charge. Deleted files go to the Recycle Bin.' },
    ],
    stuck: [
      ['“Checklist not clear yet”', 'Clear the items (or send it back) before approving.'],
      ['“Client account holds a balance…”', 'Refund or transfer the client’s money in Accounts & Finance first.'],
      ['No approve button / “Waiting for approval”', 'You are not allowed to approve this file. The approver has been notified.'],
    ],
    mistakes: ['Deleting a finished file instead of closing it.'] },
  { id: 'leads', title: 'Leads and referrals', roles: ['partner', 'lawyer', 'assistant'],
    what: '*Leads & Referrals* tracks enquiries before they become clients: where they came from (referrer, platform, programme), the stage, and whether they became a client.',
    who: 'Whoever takes enquiries.',
    steps: [
      { t: 'Open *Leads & Referrals*. Tabs: *Overview* (where leads come from and the conversion rate), *All leads*, *Programmes* (seminars, talks) and *Referrers*.' },
      { t: 'New enquiry: [[New lead]] → name, phone, e-mail, *Interested in*, *Came from* (source / referrer), *How hot?*, *Person in charge*. The conflict check runs as you type.' },
      { t: 'Move it through the stages with the arrows: *Inquiry → Contacted → Consultation → Quoted → Converted* (or *Lost*).' },
      { t: 'When they instruct us: [[Convert]]. It checks for conflicts again (you must confirm *No Conflict, Proceed*), creates the client record and links it to the lead. Then open the file from the client (topic “Opening a new file”).' },
      { t: 'Programmes: *New programme* creates a public registration link and QR code; registrations flow in as leads.' },
    ],
    mistakes: ['Not recording who referred the client — referral fees and reports depend on it.'] },

  { id: 'finhome', title: 'Finance Home', roles: ['accounts', 'partner'], intro: '*Finance Home* shows what needs attention: overdue bills, payments to match, approvals waiting and month-end items. Each tab is also in the menu: *Billing & Collections*, *Client Account (SAR 1990)*, *Office Account*, *Approvals*, *Payroll* and *Books & Reports*.' },
  { id: 'billing', title: 'Billing and collections', roles: ['accounts'], steps: [
    'In *Billing & Collections*, *Fees by file* shows agreed, billed, received and owing for every file.',
    'Bill from the file’s unbilled time and costs, or from an accepted quotation.',
    'Record each payment against its invoice. The file’s partners are notified when an invoice is paid.',
  ] },
  { id: 'prepare', title: 'Preparing payments for approval', roles: ['accounts'], steps: [
    'Claims and payment requests arrive in *Approvals*. Accounts prepare and check; partners approve.',
    'Once approved, pay from the right account and attach the proof. The claimant is notified.',
  ], tip: 'The client account can never go below zero for a client or file. The portal blocks it.' },
  { id: 'payroll', title: 'Payroll', roles: ['accounts'], steps: [
    'Open *Payroll*. EPF, SOCSO and EIS are worked out from the official tables; PCB and zakat are entered by hand.',
    'Check the month, then send it for approval. Staff see only their own payslips in the Staff Portal.',
  ] },
  { id: 'books', title: 'Books and month end', roles: ['accounts'], intro: '*Books & Reports* holds the ledger, trial balance and reports. Work through the month-end checklist there before closing the month.' },

  /* ---------------------------------------------------------------- everyone */
];

/** *bold* and [[Button]] → styled spans. */
const VIDEO_URL = /^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//;

const rich = (text: string): React.ReactNode[] =>
  text.split(/(\[\[[^\]]+\]\]|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('[[')) return <span key={i} className="whitespace-nowrap rounded bg-[#16223A] px-1.5 py-0.5 text-[12px] font-bold !text-white">{part.slice(2, -2)}</span>;
    if (part.startsWith('*')) return <strong key={i} className="font-semibold text-[#16223A]">{part.slice(1, -1)}</strong>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

const roleOf = (key: string, role: string): GuideRole =>
  key === 'M' || key === 'P' ? 'partner' : /accountant/i.test(role) ? 'accounts' : /assistant/i.test(role) ? 'assistant' : 'lawyer';

export const StaffGuideView: React.FC = () => {
  const { currentRole, currentUser, isAdmin, addActivityLog } = useApp();
  const [settings, saveSettings] = usePracticeSettings();
  const canEditVideo = Boolean(currentUser?.isAdmin || currentUser?.isSuperAdmin);
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const mine = roleOf(finRoleKey(currentRole, currentUser, isAdmin), String(currentUser?.role || currentRole || ''));
  const [role, setRole] = useState<GuideRole>(mine);
  const sections = useMemo(() => SECTIONS.filter((s) => s.roles === 'all' || s.roles.includes(role)), [role]);
  const video = settings.guideVideos?.[role] || '';
  const roleLabel = ROLES.find(([k]) => k === role)?.[1] || '';
  const topicVideos = settings.guideTopicVideos || {};
  /** Admins paste a Google Drive / YouTube link for one topic (empty = remove). */
  const setTopicVideo = (id: string, title: string) => {
    const url = window.prompt('Video link for “' + title + '” (Google Drive or YouTube). Leave empty to remove.', topicVideos[id] || '');
    if (url === null) return;
    const v = url.trim();
    if (v && !VIDEO_URL.test(v)) { window.alert('Paste a Google Drive or YouTube link.'); return; }
    const next = { ...topicVideos };
    if (v) next[id] = v; else delete next[id];
    saveSettings({ guideTopicVideos: next });
    addActivityLog('Staff Guide Video ' + (v ? 'Set' : 'Removed'), title);
  };
  const saveVideo = () => {
    const url = videoDraft.trim();
    if (url && !/^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//.test(url)) return;
    saveSettings({ guideVideos: { ...(settings.guideVideos || {}), [role]: url || undefined } });
    addActivityLog('Staff Guide Video ' + (url ? 'Set' : 'Removed'), roleLabel);
    setEditingVideo(false);
  };

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-5 text-[14px] leading-relaxed text-[#1E2A40]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A6D3B]">Staff guide</span>
        <h2 className="m-0 font-serif text-2xl font-bold text-[#16223A]">How to use the portal</h2>
        <p className="m-0 max-w-[68ch] text-[#5B6478]">Step by step, for your role. Button names match what you see on screen. Pick another role to see how colleagues work.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Guide by role">
        {ROLES.map(([k, label, sub]) => {
          const on = role === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setRole(k)}
              className={`flex cursor-pointer flex-col items-start rounded-lg border px-3.5 py-2 text-left transition ${on ? 'border-[#16223A] bg-[#16223A]' : 'border-[#DDE3EB] bg-white hover:border-[#8A6D3B]'}`}>
              <span className={`text-[13px] font-bold ${on ? '!text-white' : 'text-[#16223A]'}`}>{label}{k === mine ? ' · you' : ''}</span>
              <span className={`text-[11px] ${on ? '!text-[#DDE3EB]' : 'text-[#5B6478]'}`}>{sub}</span>
            </button>
          );
        })}
      </div>

      {(video || canEditVideo) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#DDE3EB] bg-white px-4 py-3">
          <span className="min-w-0 flex-1">
            <strong className="block text-[13.5px] text-[#16223A]">Video walkthrough · {roleLabel}</strong>
            <span className="block text-[12px] text-[#5B6478]">{video ? 'A short screen video of the steps below.' : 'No video yet. Record one, save it in the firm’s Google Drive and paste its link here.'}</span>
          </span>
          {video && <a href={video} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#16223A] px-3 py-2 text-[12.5px] font-bold !text-white no-underline">▶ Watch the video</a>}
          {canEditVideo && !editingVideo && <button type="button" onClick={() => { setVideoDraft(video); setEditingVideo(true); }} className="cursor-pointer rounded-lg border border-[#DDE3EB] bg-white px-3 py-2 text-[12px] font-bold text-[#16223A]">{video ? 'Change link' : 'Add video link'}</button>}
          {canEditVideo && editingVideo && (
            <span className="flex w-full flex-wrap items-center gap-2">
              <input id="guide-video-url" value={videoDraft} onChange={(e) => setVideoDraft(e.target.value)} placeholder="https://drive.google.com/file/d/… or a YouTube link" className="min-w-0 flex-1 rounded-md border border-[#DDE3EB] px-2.5 py-1.5 text-[12.5px] text-[#16223A]" />
              <button type="button" onClick={saveVideo} className="cursor-pointer rounded-md bg-[#16223A] px-3 py-1.5 text-[12px] font-bold !text-white">Save</button>
              <button type="button" onClick={() => setEditingVideo(false)} className="cursor-pointer rounded-md border border-[#DDE3EB] bg-white px-3 py-1.5 text-[12px] font-bold text-[#16223A]">Cancel</button>
              {videoDraft.trim() && !/^https:\/\/(drive\.google\.com|docs\.google\.com|(www\.)?youtube\.com|youtu\.be)\//.test(videoDraft.trim()) && <span className="w-full text-[11.5px] text-[#B23A2E]">Paste a Google Drive or YouTube link.</span>}
            </span>
          )}
        </div>
      )}

      <nav className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[#DDE3EB] pb-3 text-[12.5px]" aria-label="Sections">
        {sections.map((s, i) => (
          <a key={s.id} href={'#guide-' + s.id} onClick={(e) => { e.preventDefault(); document.getElementById('guide-' + s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="text-[#3D6B9C] hover:underline">{i + 1}. {s.title}</a>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        {sections.map((s, i) => (
          <section key={s.id} id={'guide-' + s.id} className="scroll-mt-4 rounded-xl border border-[#DDE3EB] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="m-0 flex flex-1 items-baseline gap-2 font-serif text-[17px] font-bold text-[#16223A]"><span className="font-mono text-[12px] font-medium text-[#8A6D3B]">{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
              {topicVideos[s.id] && <a href={topicVideos[s.id]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#16223A] px-3 py-1.5 text-[12px] font-bold !text-white no-underline">▶ Watch video</a>}
              {canEditVideo && <button type="button" onClick={() => setTopicVideo(s.id, s.title)} className="cursor-pointer rounded-lg border border-[#DDE3EB] bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-[#16223A]">{topicVideos[s.id] ? 'Change video' : '+ Video'}</button>}
            </div>
            {(s.what || s.who) && (
              <div className="mb-3 flex max-w-[72ch] flex-col gap-1.5">
                {s.what && <p className="m-0"><strong className="text-[#16223A]">What it is: </strong>{rich(s.what)}</p>}
                {s.who && <p className="m-0"><strong className="text-[#16223A]">Who: </strong>{rich(s.who)}</p>}
              </div>
            )}
            {s.before && (
              <div className="mb-3 max-w-[72ch] rounded-lg border border-[#DDE3EB] bg-[#F6F8FA] px-3 py-2">
                <strong className="mb-1 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Before you start</strong>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5">{s.before.map((t, j) => <li key={j}>{rich(t)}</li>)}</ul>
              </div>
            )}
            {s.intro && <p className="m-0 max-w-[72ch]">{rich(s.intro)}</p>}
            {s.steps && (
              <>
                {s.what && <strong className="mb-2 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Step by step</strong>}
                <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {s.steps.map((st, j) => {
                    const t = typeof st === 'string' ? st : st.t;
                    const sub = typeof st === 'string' ? undefined : st.sub;
                    return (
                      <li key={j} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
                        <span className="mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-[#8A6D3B] bg-[#FBF5EA] font-mono text-[11px] text-[#8A6D3B]">{j + 1}</span>
                        <span className="max-w-[72ch]">
                          {rich(t)}
                          {sub && <ul className="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-[#4A5468]">{sub.map((x, y) => <li key={y}>{rich(x)}</li>)}</ul>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            {s.cases && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1.5 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Other situations</strong>
                <dl className="m-0 flex flex-col gap-1.5">{s.cases.map(([k, v], j) => <div key={j} className="grid gap-0.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3"><dt className="font-semibold text-[#16223A]">{rich(k)}</dt><dd className="m-0">{rich(v)}</dd></div>)}</dl>
              </div>
            )}
            {s.stuck && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1.5 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">If you see this</strong>
                <dl className="m-0 flex flex-col divide-y divide-[#EEF1F5] rounded-lg border border-[#DDE3EB]">{s.stuck.map(([k, v], j) => <div key={j} className="flex flex-col gap-0.5 px-3 py-2"><dt className="font-semibold text-[#8E2A20]">{rich(k)}</dt><dd className="m-0 text-[13px]">{rich(v)}</dd></div>)}</dl>
              </div>
            )}
            {s.mistakes && (
              <div className="mt-4 max-w-[72ch]">
                <strong className="mb-1 block text-[12px] uppercase tracking-[0.08em] text-[#5B6478]">Common mistakes</strong>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5">{s.mistakes.map((t, j) => <li key={j}>{rich(t)}</li>)}</ul>
              </div>
            )}
            {s.tip && <p className="m-0 mt-3 max-w-[72ch] rounded-r-lg border-l-[3px] border-[#8A6D3B] bg-[#FBF5EA] px-3 py-2 text-[13px]">{rich(s.tip)}</p>}
          </section>
        ))}
      </div>
    </div>
  );
};
