/**
 * Starter Guide: the first day in the portal, in 8 short topics. Each topic is also one short
 * video: `do` is what to click on screen, `say` is the voice-over. Printed by
 * `npm run guide:starter` (PDF, video scripts and voice-over files).
 * Text markup: [[Button]] shows a button label, *bold* shows bold text.
 */
export interface StarterTopic {
  id: string;
  title: string;
  who: string;
  /** About how long the video is. */
  minutes: string;
  /** Steps shown in the PDF and done on screen while recording. */
  do: string[];
  /** Voice-over for the video, in plain spoken English. */
  say: string;
}

export const STARTER: StarterTopic[] = [
  {
    id: 'signin', title: 'Sign in', who: 'Everyone', minutes: '1',
    do: [
      'Open Google Chrome and go to *portal.shcolaw.com*.',
      'Staff: on the *Staff SSO* tab press [[Continue with Google Workspace]] and pick your *@shcolaw.com* account.',
      'Outside people (auditor, client): use the *External Access* or *Client Access* tab with the e-mail and temporary password from the portal e-mail, then set your own password.',
      'You land on the *Firm Start Centre*. To sign out, press [[Sign out]] at the bottom of the left menu.',
    ],
    say: 'Welcome to the SHCO portal. Open Google Chrome and go to portal dot shcolaw dot com. If you are staff, stay on the Staff S S O tab, press Continue with Google Workspace, and choose your shcolaw dot com account. Outside people, such as our auditor or a client, use the External Access or Client Access tab with the e-mail and temporary password the portal sent them. Once you are in, you land on the Firm Start Centre. To sign out, use the button at the bottom of the left menu.',
  },
  {
    id: 'screen', title: 'Find your way around', who: 'Everyone', minutes: '1½',
    do: [
      'Left menu: *General* (your own things), *Practice* (clients, files, court), *Finance & Accounts* (only if you have billing access), *System* (settings, guide).',
      'Top bar: the search box finds files, clients and documents.',
      'Gold [[New]] button: make anything new from any page (client, file, lead, task, quotation, money in or out, claim).',
      'The round arrows reload the latest data. The box is the *Recycle Bin* (undo a delete). The bell is your notifications.',
    ],
    say: 'Here is how the screen works. The left menu has four groups. General is your own work. Practice is clients, files and court. Finance and Accounts only shows if you have billing access. System has settings and this guide. At the top, the search box finds any file, client or document. The gold New button makes anything new from any page: a client, a file, a lead, a task, a quotation, or money in or out. The round arrows reload the latest data, the box is the Recycle Bin if you delete something by mistake, and the bell shows your notifications.',
  },
  {
    id: 'day', title: 'Your day: My Dashboard', who: 'Everyone', minutes: '2',
    do: [
      'Click *My Dashboard*. *My work* opens first.',
      'The coloured tiles count your matters, deadlines, hearings and things waiting on you. Click a tile to filter.',
      '*Needs your decision*: leave, quotes, claims, vouchers and close requests waiting for you. Approve here, or [[Open]] to go to it.',
      '*My to-do*: your tasks and court dates, grouped Overdue, Today, This week, Later. Tick when done. [[+ New task]] adds one (it can go to your Google Tasks).',
      'On the right: your meetings, court dates for the week and your performance.',
    ],
    say: 'Start every day on My Dashboard. My work opens first. The coloured tiles count your matters, deadlines, hearings and anything waiting on you, and clicking a tile filters the list. Needs your decision shows leave, quotes, claims, vouchers and close requests that are waiting for you: approve them here, or press Open to go to them. My to-do lists your tasks and court dates, overdue first. Tick a task when it is done, and use New task to add one. On the right you see your meetings and court dates for the week.',
  },
  {
    id: 'file', title: 'Open a file and its tabs', who: 'Partners, lawyers and assistants', minutes: '2½',
    do: [
      'Click *Cases*, search the file number or client, and click the file.',
      'The tabs along the top: *Status* (weekly update), *Court* (hearings and court memos), *Filing & service*, *Tasks*, *Time & costs*, *Money*, *Notes*, *Letters & e-sign*, *History*.',
      'Every hearing, memo, note and filing has [[Edit]] and [[Delete]].',
      'Each week, open *Status* and fill in progress, next step and health. The *Case Status* page in the left menu shows every file’s latest status in one list.',
    ],
    say: 'To work on a file, click Cases, search the file number or the client, and open it. Along the top are the tabs: Status for the weekly update, Court for hearings and court memos, Filing and service, Tasks, Time and costs, Money, Notes, Letters, and History. Every hearing, memo, note and filing can be edited or deleted. Once a week, open the Status tab and write the progress, the next step and how healthy the file is. The Case Status page in the left menu then shows every file in one list.',
  },
  {
    id: 'new', title: 'New client and new file', who: 'Partners, lawyers and assistants', minutes: '2',
    do: [
      '[[New]] → *New client*: name, IC or company number, contact. A conflict check runs as you type.',
      'In the client’s *KYC* tab: the usual list is NRIC / passport and bankruptcy search (companies: SSM and directors’ NRIC). [[Not needed]] drops one, *+ Add a document* adds one. Upload each.',
      '[[New]] → *New file*: pick the client, practice area, partner and lawyer in charge, *Date opened*. The file number is made for you and a Google Drive folder is created.',
    ],
    say: 'To take on new work, press New, then New client. Type the name, IC or company number and contact details; the portal checks for conflicts as you type. In the client’s KYC tab, the usual documents are NRIC or passport and a bankruptcy search, or SSM and the directors’ NRIC for a company. Drop what is not needed, add anything else, and upload each one. Then press New, New file. Pick the client, practice area, partner and lawyer in charge, and the date it opened. The file number and its Google Drive folder are made for you.',
  },
  {
    id: 'staff', title: 'Leave, claims and my profile', who: 'Everyone', minutes: '2',
    do: [
      '*Staff Portal* → *Leave*: pick the type and dates, choose who covers your files, [[Send to partner]]. You can [[Cancel]] it while it waits.',
      '*My Claims* → [[+ New claim form]]: travelling has *Going* and *Return* (km each) and a *Purpose*. Attach receipts, add each item, then submit. Waiting or rejected claims can be edited or withdrawn.',
      '*Staff Portal* also has your payslips, attendance, goals and the monthly check-in.',
    ],
    say: 'For your own things, open Staff Portal. Under Leave, choose the type and the dates, pick who covers your files, and send it to your partner; you can cancel it while it is waiting. To claim money back, open My Claims and start a new claim form. For travel, fill in where you went and the kilometres, tick return trip, and write the purpose. Attach the receipts, add each item, and submit. While a claim is waiting, you can still edit or withdraw it. Staff Portal also has your payslips, attendance and goals.',
  },
  {
    id: 'money', title: 'Billing and money (billing access only)', who: 'Partners and Accounts', minutes: '3',
    do: [
      '*Billing & Collections*: three sub-tabs — *Quotations, invoices & receipts*, *Fees by file*, *Work not billed yet*.',
      '[[New]] → *Quotation*: pick the client or lead (the file ref fills itself), fees, then [[Send]] to e-mail or WhatsApp it. [[+ Consultation proforma]] for a consultation fee.',
      'Accepted quotation → proforma for the deposit → invoice when work is done → receipt when paid. [[Issue]] asks for the date.',
      '[[New]] → *Money in* / *Money out*: pick the client, the date, attach the slip or bill.',
      '*Approvals*: approve claims and vouchers, then drop the bank receipt to mark them paid.',
    ],
    say: 'If you have billing access, open Billing and Collections. It has three parts: quotations, invoices and receipts; fees by file; and work not billed yet. To quote, press New, Quotation. Pick the client or lead and the file number fills itself; add the fees and press Send to e-mail or WhatsApp it. An accepted quotation becomes a proforma for the deposit, then an invoice when the work is done, and a receipt when it is paid. Use New, Money in or Money out to record any payment with its slip. In Approvals, approve claims and vouchers, then drop in the bank receipt to mark them paid.',
  },
  {
    id: 'help', title: 'Getting help', who: 'Everyone', minutes: '1',
    do: [
      '*Staff Guide* (left menu, System): every topic step by step, for your role.',
      'Deleted something by mistake? The box button at the top → find it → [[Restore Record]].',
      'Something looks old? Press the round arrows. Still stuck? Screenshot it and send it to an admin with the file number.',
    ],
    say: 'If you are not sure how to do something, open Staff Guide at the bottom of the left menu: every topic is there, step by step, for your role. If you delete something by mistake, press the box button at the top and restore it. If something looks out of date, press the round arrows to reload. Still stuck? Take a screenshot and send it to an admin with the file number. That is everything you need for your first day.',
  },
];
