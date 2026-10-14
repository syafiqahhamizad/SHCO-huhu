import { extractMatterRunningNumber } from '../services/matterService';

/**
 * Where every upload goes in the firm's three Google Shared Drives (pure helpers, no Drive calls):
 *
 *  SHCO Portal (all staff)
 *    Case files/<Practice area>/<NNN> - <Matter title>/{sub-folders by practice area, see matterSubfolders}
 *    Clients KYC/<Client no.> - <Client name>/KYC
 *  SHCO Finance (partners / Accounts) — or "Finance/" inside SHCO Portal until it is set
 *    Books/<Office Account|Disbursement Account|…>/
 *        Pending/<entry>/ · Rejected/<entry>/
 *        <YYYY>/<YYYY-MM Month>/{Money In, Money Out, Bank Statement}/<entry>/
 *    Client Files/<NNN> - <Matter title>/   (quotations, invoices; links to the file's money entries)
 *    Payroll/<YYYY>/<YYYY-MM Month>/{Payslips, Statutory, Partner Drawings}/
 *    Accounts & Tax Reports/ · Firm Records/ · Backups/
 *    (an <entry> folder is named "DDMMYYYY <doc no.> <file code> <what> RM<amount>", see entryName)
 *    Before "Set up finance folders": <YYYY>/Claims|Payment Vouchers|Bank-in Proofs|Client Account/
 *  SHCO HR
 *    <Staff ID> - <Name>/
 */

/** Characters Google Drive (and the Windows / Mac Drive desktop apps) dislike in names. */
export const driveSafeName = (s: string) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 150) || 'unnamed';

/**
 * Top folders in SHCO Portal, as the firm named them on Drive: every file under
 * "Case files/<practice area>/<NNN - title>", every client under "Clients KYC/<client no. - name>/KYC".
 */
export const CASE_FILES_ROOT = 'Case files';
export const CLIENTS_ROOT = 'Clients KYC';

/** Sub-folders of a court matter (litigation, criminal, syariah, family, estates…) — the firm's own. */
export const MATTER_SUBFOLDERS = ['Cause Papers', 'Cause Papers/Draft', 'Cause Papers/Extracted', 'Correspondences', 'Correspondences/Draft', 'Correspondences/Acknowledgment', 'Documents', 'Documents/Due Diligence'] as const;
/** A matter sub-folder, or a path under it ("Correspondences/Acknowledgment"). */
export type MatterSub = string;
/** Where service proofs go, in every file. */
export const ACK_FOLDER = 'Correspondences/Acknowledgment';
/** Each file's signed letter of engagement. */
export const LOE_FOLDER = 'Letter of Engagement';
/** Court memos (court work only). */
export const MEMO_FOLDER = 'Court Memo';

/** Court work, conveyancing or corporate — decides a file's folders, tabs and court details. */
export type PracticeKind = 'court' | 'conveyancing' | 'corporate';
export const practiceKind = (area?: string): PracticeKind => {
  const a = String(area || '').toLowerCase();
  if (/convey|property|real estate|tenancy|land/.test(a)) return 'conveyancing';
  if (/corporate|commercial|advisory|company|tech|fintech/.test(a)) return 'corporate';
  return 'court';
};
const SUBS: Record<PracticeKind, readonly string[]> = {
  court: MATTER_SUBFOLDERS,
  conveyancing: ['Documents', 'Documents/Due Diligence', 'Correspondences', 'Correspondences/Draft', 'Correspondences/Acknowledgment'],
  corporate: ['Agreement', 'Agreement/Draft', 'Correspondences', 'Correspondences/Draft', 'Correspondences/Acknowledgment', 'Documents', 'Documents/Due Diligence'],
};
/** The sub-folders a new matter folder gets, by practice area. */
export const matterSubfolders = (area?: string): string[] => [...SUBS[practiceKind(area)]];
/** Every folder a document can be uploaded to in a file (the sub-folders, plus the ones made on first use). */
export const uploadFolders = (area?: string): string[] => [...new Set([...matterSubfolders(area), ACK_FOLDER, ...(practiceKind(area) === 'court' ? [MEMO_FOLDER] : []), LOE_FOLDER])];
/** "Correspondences/Acknowledgment" → "Correspondences › Acknowledgment". */
export const folderLabel = (sub: string) => sub.split('/').join(' › ');

/** The file's running number from its ref, padded to 3 digits ('' when the ref has none). */
export const matterNumber = (ref?: string): string => {
  const n = extractMatterRunningNumber(ref);
  return n >= 0 ? String(n).padStart(3, '0') : '';
};

/** "<NNN> - <Matter title>" (falls back to the ref when it has no running number). */
export const matterFolderName = (ref: string, title?: string): string => {
  const no = matterNumber(ref);
  const head = no || String(ref || '').replace(/\//g, '-');
  return driveSafeName([head, String(title || '').trim()].filter(Boolean).join(' - ')).slice(0, 120);
};

/** Practice-area folder: the name set in Firm Settings for that area, else the area name itself. */
export const practiceFolderName = (area: string | undefined, names: Record<string, string> = {}): string => {
  const a = String(area || '').trim();
  const custom = a ? String(names[a] || '').trim() : '';
  return driveSafeName(custom || a || 'Other');
};

export interface MatterLike { ref: string; title?: string; practiceArea?: string; type?: string }

/** Path of a matter's folder in SHCO Portal: Case files/<area>/<NNN - title>. */
export const matterFolderPath = (m: MatterLike, names: Record<string, string> = {}): string[] =>
  [CASE_FILES_ROOT, practiceFolderName(m.practiceArea || m.type, names), matterFolderName(m.ref, m.title)];

/** Folder description: the full file ref (and title), so the folder can be found from the ref. */
export const matterFolderDescription = (m: MatterLike) => 'File ref: ' + m.ref + (m.title ? ' · ' + m.title : '');

/**
 * Where a matter document goes, from its category / kind. 'finance' = SHCO Finance/Files/<NNN - title>
 * (engagement letters, quotations, invoices, receipts, billing).
 */
export const matterSubFor = (category?: string, area?: string): MatterSub | 'finance' => {
  const c = String(category || '').toLowerCase();
  if (/letter of engagement|engagement letter|\bloe\b/.test(c)) return LOE_FOLDER;
  if (/billing|quotation|invoice|receipt|proforma|\bfees?\b/.test(c)) return 'finance';
  const same = uploadFolders(area).find((x) => x.toLowerCase() === c);
  if (same) return same;
  const kind = practiceKind(area);
  if (/acknowledg|served|service|received/.test(c)) return ACK_FOLDER;
  if (kind === 'court' && /court memo|memo|minute|hearing note/.test(c)) return MEMO_FOLDER;
  if (/due diligence|diligence|search/.test(c)) return 'Documents/Due Diligence';
  if (kind === 'court' && /extracted|sealed/.test(c)) return 'Cause Papers/Extracted';
  if (/draft/.test(c)) {
    if (/letter|correspond|email|e-mail|reply/.test(c) || kind === 'conveyancing') return 'Correspondences/Draft';
    return kind === 'corporate' ? 'Agreement/Draft' : 'Cause Papers/Draft';
  }
  if (kind === 'court' && /filing|filed|pleading|cause paper|affidavit|order|writ|petition|summons|court paper/.test(c)) return 'Cause Papers';
  if (kind === 'corporate' && /agreement|contract|deed|nda|draft|term sheet/.test(c)) return 'Agreement';
  if (/client|kyc|document|evidence|title|search|spa|agreement|loan|stamp|research/.test(c)) return 'Documents';
  return 'Correspondences';
};

/** "<Client ID> - <Client name>". */
export const clientFolderName = (name: string, id: string) =>
  driveSafeName([String(id || '').trim(), String(name || '').trim()].filter(Boolean).join(' - ')).slice(0, 120);

/** "<Staff ID> - <Name>" (email when neither is known). */
export const staffFolderName = (s: { staffId?: string; name?: string; email?: string }) =>
  driveSafeName([s.staffId, s.name].map((x) => String(x || '').trim()).filter(Boolean).join(' - ') || s.email || 'Unknown staff');

/** What a finance upload is, which decides its folder in SHCO Finance. */
export type FinanceKind = 'claim' | 'pv' | 'bankin' | 'clientAccount';

/** Path inside the finance base (SHCO Finance root, or SHCO Portal/Finance). */
export const financeFolderPath = (kind: FinanceKind, year: string | number, ref?: string): string[] => {
  const y = String(year);
  const r = String(ref || '').trim();
  if (kind === 'claim') return [y, 'Claims', ...(r ? [r] : [])];
  if (kind === 'pv') return [y, 'Payment Vouchers', ...(r ? [r] : [])];
  if (kind === 'clientAccount') return [y, 'Client Account'];
  return [y, 'Bank-in Proofs'];
};

/* ------------------------------------------------------------------ finance books (SHCO Finance) */

export const FIN = { books: 'Books', clientFiles: 'Client Files', payroll: 'Payroll', reports: 'Accounts & Tax Reports', records: 'Firm Records' } as const;
/** The first set-up used numbered names ("Books" …); they are renamed to the plain names once. */
export const OLD_FIN_NAMES: [string, string][] = [['1 Books', FIN.books], ['2 Client Files', FIN.clientFiles], ['3 Payroll', FIN.payroll], ['4 Accounts & Tax Reports', FIN.reports], ['5 Firm Records', FIN.records]];
/** The bank accounts the books are kept by (Client Account filing is postponed for now). */
export type FinAccount = 'Office' | 'Client account' | 'Disbursement' | 'Petty cash' | 'Emergency';
const ACCOUNT_FOLDER: Record<FinAccount, string> = { Office: 'Office Account', 'Client account': 'Client Account', Disbursement: 'Disbursement Account', 'Petty cash': 'Petty Cash', Emergency: 'Emergency Account' };
export const accountFolderName = (a: FinAccount) => ACCOUNT_FOLDER[a];
export type BookFlow = 'Money In' | 'Money Out' | 'Bank Statement';
export type PayrollPart = 'Payslips' | 'Statutory' | 'Partner Drawings';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (iso: string) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? { y: m[1], m: m[2], d: m[3] } : null; };
/** "2026-10-14" → "2026-10 October" (sorts in month order in Drive). */
export const monthFolderName = (iso: string) => { const x = ymd(iso); return x ? `${x.y}-${x.m} ${MONTH_NAMES[Number(x.m) - 1]}` : 'Undated'; };
const yearOf = (iso: string) => ymd(iso)?.y || 'Undated';
/** Books/<account>/<YYYY>/<YYYY-MM Month>/<Money In | Money Out | Bank Statement>. */
export const booksMonthPath = (acc: FinAccount, iso: string, flow: BookFlow, type?: OutType) => [FIN.books, accountFolderName(acc), yearOf(iso), monthFolderName(iso), flow, ...(type ? [type] : [])];
/** Books/<account>/Pending (submitted / approved, not paid yet) or /Rejected, split by type. */
export const booksStatusPath = (acc: FinAccount, status: 'Pending' | 'Rejected', type?: OutType) => [FIN.books, accountFolderName(acc), status, ...(type ? [type] : [])];
/** Money Out (and Pending / Rejected) is split by what was paid. Money In stays one folder: it is all official receipts. */
export type OutType = 'Claims' | 'Payment Vouchers' | 'Office Costs' | 'Disbursements';
/** Payroll/<YYYY>/<YYYY-MM Month>/<Payslips | Statutory | Partner Drawings>. */
export const payrollMonthPath = (iso: string, part: PayrollPart) => [FIN.payroll, yearOf(iso), monthFolderName(iso), part];
/** Client Files/<NNN - title>: a file's quotations / invoices, and links to its money entries. */
export const clientFilesPath = (m: MatterLike) => [FIN.clientFiles, matterFolderName(m.ref, m.title)];
/** Kept for older callers: a matter's billing papers now live in Client Files. */
export const financeMatterPath = clientFilesPath;

/** "SHC/SH/CORP/SZ/002/04-25" → "SZ-002" (client code - running number); '' when the ref has neither. */
export const fileCodeOf = (ref?: string): string => {
  const parts = String(ref || '').split('/').map((x) => x.trim());
  const n = extractMatterRunningNumber(ref);
  if (n < 0) return '';
  const i = parts.findIndex((x) => /^\d{1,6}$/.test(x) && Number(x) === n);
  const code = i > 0 && /^[A-Za-z][A-Za-z0-9&]*$/.test(parts[i - 1]) ? parts[i - 1].toUpperCase() + '-' : '';
  return code + String(n).padStart(3, '0');
};
/** "HQ-OR-0003" → "OR-0003" (the firm prefix is dropped in file names; numbers are unchanged). */
export const shortDocNo = (no?: string) => String(no || '').trim().replace(/^HQ-/i, '');
/** "2026-10-14" → "14102026". */
export const dmyCompact = (iso: string) => { const x = ymd(iso); return x ? x.d + x.m + x.y : ''; };
/** 3000 → "RM3,000"; 45.5 → "RM45.50". */
export const rmLabel = (n: number) => { const v = Math.round((Number(n) || 0) * 100) / 100; return 'RM' + v.toLocaleString('en-MY', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
/** Entry folder / file name: "DDMMYYYY <doc no.> <file code> <what> RM<amount>". */
export const entryName = (e: { date: string; docNo?: string; ref?: string; what?: string; amount: number }) =>
  driveSafeName([dmyCompact(e.date), shortDocNo(e.docNo), fileCodeOf(e.ref), String(e.what || '').trim(), rmLabel(e.amount)].filter(Boolean).join(' ')).slice(0, 150);

/** Which Money Out types each account has (pending: only what waits for approval). */
const outTypesFor = (a: FinAccount, pending = false): OutType[] =>
  a === 'Client account' ? ['Payment Vouchers'] : a === 'Disbursement' ? ['Payment Vouchers', 'Disbursements'] : pending ? ['Claims', 'Payment Vouchers', 'Office Costs'] : ['Claims', 'Payment Vouchers', 'Office Costs', 'Disbursements'];

/** Every folder "Set up finance folders" creates, from `from` to `to` ("YYYY-MM"), for these accounts. */
export const financeSkeleton = (from: string, to: string, accounts: FinAccount[]): string[][] => {
  const out: string[][] = [[FIN.clientFiles], [FIN.reports], [FIN.records]];
  accounts.forEach((a) => { (['Pending', 'Rejected'] as const).forEach((st) => outTypesFor(a, true).forEach((t) => out.push(booksStatusPath(a, st, t)))); });
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    accounts.forEach((a) => { out.push(booksMonthPath(a, iso, 'Money In'), booksMonthPath(a, iso, 'Bank Statement')); outTypesFor(a).forEach((t) => out.push(booksMonthPath(a, iso, 'Money Out', t))); });
    (['Payslips', 'Statutory', 'Partner Drawings'] as PayrollPart[]).forEach((p) => out.push(payrollMonthPath(iso, p)));
    if (m === 12) { y += 1; m = 1; } else m += 1;
  }
  return out;
};

/**
 * Finance proof owners are "<kind>:<id>" (or a bare receipt id / 'form'). Staff claim payments go
 * with the claim, PV payments with the PV, everything else is a bank-in / payment proof.
 */
export const financeKindFromOwner = (owner: string): { kind: FinanceKind; ref: string } => {
  const i = owner.indexOf(':');
  const k = i >= 0 ? owner.slice(0, i) : '';
  const ref = i >= 0 ? owner.slice(i + 1) : owner === 'form' ? '' : owner;
  if (k === 'travel' || k === 'expense') return { kind: 'claim', ref };
  if (k === 'pv') return { kind: 'pv', ref };
  return { kind: 'bankin', ref };
};

export const folderUrl = (id: string) => 'https://drive.google.com/drive/folders/' + encodeURIComponent(id);
