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

interface Section { id: string; title: string; roles: GuideRole[] | 'all'; intro?: string; steps?: string[]; tip?: string }

const SECTIONS: Section[] = [
  { id: 'signin', title: 'Signing in', roles: 'all', steps: [
    'Open *portal.shcolaw.com* in Chrome.',
    'Click [[Continue with Google Workspace]] and choose your *@shcolaw.com* account.',
    'If it says you are not on the access list, ask an admin to add you in Users & Roles.',
  ], tip: 'The first time you use Drive, Calendar or Tasks, Google asks once for permission. Click Allow.' },
  { id: 'screen', title: 'Finding your way around', roles: 'all', intro: 'The menu on the left lists only what your role can open. The top bar has the search box (file no., title or client), a refresh button that loads colleagues’ latest changes, and the bell for notifications.' },
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
            {s.intro && <p className="m-0 max-w-[72ch]">{rich(s.intro)}</p>}
            {s.steps && (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {s.steps.map((t, j) => (
                  <li key={j} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
                    <span className="mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border border-[#8A6D3B] bg-[#FBF5EA] font-mono text-[11px] text-[#8A6D3B]">{j + 1}</span>
                    <span className="max-w-[72ch]">{rich(t)}</span>
                  </li>
                ))}
              </ol>
            )}
            {s.tip && <p className="m-0 mt-3 max-w-[72ch] rounded-r-lg border-l-[3px] border-[#8A6D3B] bg-[#FBF5EA] px-3 py-2 text-[13px]">{rich(s.tip)}</p>}
          </section>
        ))}
      </div>
    </div>
  );
};

export default StaffGuideView;
