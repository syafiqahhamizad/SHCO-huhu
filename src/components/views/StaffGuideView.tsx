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
  { id: 'day', title: 'Your day starts on My Dashboard', roles: 'all', steps: [
    'Click *My Dashboard*. *My work* lists every task, deadline and hearing assigned to you, across all your files.',
    'Use the filters *Overdue*, *Today* and *This week*.',
    'Click a row to open that file on the right tab. Tick a task when it is done.',
  ] },

  /* ---------------------------------------------------------------- partner */
  { id: 'decide', title: 'Decisions waiting for you', roles: ['partner'], steps: [
    'On *My Dashboard*, open *Needs your decision*: leave requests, time to approve, quotations and other approvals.',
    'Approve or reject each one. The person who asked is notified straight away.',
  ] },
  { id: 'assign', title: 'Assigning a file', roles: ['partner'], steps: [
    'Open the file in *Cases* → [[Edit matter details]].',
    'Click names under *Partner in charge* and *Lawyers in charge*. Several people are allowed.',
    'If the people changed, the file number can be rebuilt (admins) with a reason.',
    'Save. Everyone newly added gets a notification and sees the file in *My work*.',
  ] },
  { id: 'conflict', title: 'Clearing a conflict check', roles: ['partner'], steps: [
    'A new client that matches an existing client or opposing party is saved as *Pending Partner Review*.',
    'Open the client in *Clients* → *Profile* → the conflict banner → *Review*.',
    'Choose *Clear*, *Partner review* or *Flagged*, add a note and save. It is kept in the client’s History.',
  ] },
  { id: 'approvals', title: 'Approving claims and payments', roles: ['partner'], steps: [
    'Open *Approvals* in the Finance menu. You are also notified for each new claim or payment request.',
    'Check the items and receipts, then approve or reject.',
    'Large amounts need a second signatory (set in Settings → Permissions & limits).',
  ] },
  { id: 'close', title: 'Approving a file closure', roles: ['partner'], steps: [
    'A lawyer uses [[Request to close]] on a file. The file’s partners are notified.',
    'Open the file, check the close panel (open tasks, money left), then approve or send it back with a note.',
  ] },

  /* ---------------------------------------------------------------- lawyer + partner: running a file */
  { id: 'file', title: 'Opening a file', roles: ['partner', 'lawyer'], steps: [
    'In *Cases*, click [[Open new file]].',
    'Pick the client (register them first if new), the practice area, the partners and the lawyers.',
    'The portal checks conflicts, gives the file its number and creates its Google Drive folder.',
  ] },
  { id: 'tabs', title: 'Inside a file', roles: ['partner', 'lawyer', 'assistant'], intro: 'Tabs along the top: *Overview* (parties, client updates), *Status* (stage and weekly update), *Court* (hearings), *Filing & service*, *Tasks*, *Time & costs*, *Money* (partners, lawyers and Accounts), *Notes*, *Letters & e-sign* and *History* (every change).' },
  { id: 'tasks', title: 'Tasks and deadlines', roles: ['partner', 'lawyer', 'assistant'], steps: [
    'Open the file → *Tasks* → [[+ New task]].',
    'Write what needs doing, who it is for, the due date and the priority. Choose a deadline type for court or limitation dates so reminders go out in time.',
    'Save. It appears in that person’s *My work* and they are notified.',
  ], tip: 'Tick “Google Tasks” on a task assigned to you to see it on your phone too.' },
  { id: 'court', title: 'Hearings', roles: ['partner', 'lawyer', 'assistant'], steps: [
    'Open the file → *Court* → [[+ Add hearing]], fill in the date, time, court and purpose → [[Save hearing]].',
    'It goes into the court diary. *Hearings* and *Calendar* in the menu show all upcoming dates.',
    'After the hearing, add a [[+ New court memo]] with what happened and the next date.',
  ] },
  { id: 'weekly', title: 'Weekly status update', roles: ['partner', 'lawyer'], steps: [
    'Open the file → *Status* → [[Do this week’s update]]. Tick what progressed and write the next step.',
    'To tell the client, use [[+ Send update]] on *Overview* (WhatsApp or e-mail).',
    'The *Case Status* page shows which of your files still need this week’s update.',
  ] },
  { id: 'time', title: 'Recording time and costs', roles: ['partner', 'lawyer'], steps: [
    'Open the file → *Time & costs* → [[+ Log time]] → enter hours and the work done → [[Save time]].',
    'Paid something for the file? Use [[+ Claim a cost →]]. It opens My Claims with the file filled in.',
  ] },

  /* ---------------------------------------------------------------- assistant */
  { id: 'service', title: 'Filing and service', roles: ['assistant', 'lawyer'], steps: [
    'Open the file → *Filing & service* → [[+ Log service]].',
    'Record the document, when it was filed or served, on whom and by whom. Add the stamped copy.',
    'The *Service Log* page lists filing and service across all files.',
  ] },
  { id: 'clients', title: 'Registering a client and KYC', roles: ['assistant', 'lawyer', 'partner'], steps: [
    'Click *Clients* → [[Register new client]]. Type the name as on the IC or SSM, without Mr, Ms, Encik or Puan.',
    'As you type, the portal checks for conflicts. A possible match is saved as *Pending Partner Review* for a partner to clear.',
    'Open the client → *KYC* → [[Upload]] each document. Files are saved in Google Drive.',
  ], tip: 'KYC never blocks a file. You can open the file and finish KYC while it runs.' },
  { id: 'diary', title: 'Keeping the diary', roles: ['assistant'], intro: '*Hearings*, *Calendar* and *Deadlines* in the menu show everything coming up across the files you support. Add hearings and deadlines from inside the file so the right lawyer is reminded.' },

  /* ---------------------------------------------------------------- accounts */
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
  { id: 'claims', title: 'Claims (My Claims)', roles: 'all', steps: [
    'Click *My Claims* → [[+ New claim form]] (you paid) or [[+ Payment request (PV)]] (the firm pays someone).',
    'Add each item with its date, amount, purpose, file and a photo of the receipt.',
    '[[Submit claim form]]. Approvers and Accounts are notified; you are told when it is approved or rejected.',
  ] },
  { id: 'leave', title: 'Leave and payslips (Staff Portal)', roles: 'all', steps: [
    '*Staff Portal* → *Leave* → pick the type, dates and who covers your files → attach the MC for medical leave → [[Apply for leave]].',
    'You are notified when it is approved. *Payslips* shows your own payslips; *Goals & wellbeing* holds your goals and monthly check-in.',
  ] },
  { id: 'alerts', title: 'Notifications', roles: 'all', intro: 'The bell shows a red number when something needs you; click it to go straight there. Each notification is also e-mailed to your @shcolaw.com address from *SHCO Portal*.' },
  { id: 'help', title: 'Getting help', roles: 'all', intro: 'Something looks wrong? Press refresh at the top first. Still wrong, or a menu you need is missing? Send a screenshot to an admin. Deleted something by mistake? Admins can restore it from the Recycle Bin.' },
];

/** *bold* and [[Button]] → styled spans. */
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
            <h3 className="m-0 mb-2 flex items-baseline gap-2 font-serif text-[17px] font-bold text-[#16223A]"><span className="font-mono text-[12px] font-medium text-[#8A6D3B]">{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
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
