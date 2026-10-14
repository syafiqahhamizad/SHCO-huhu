import { extractMatterRunningNumber } from '../services/matterService';

/**
 * Where every upload goes in the firm's three Google Shared Drives (pure helpers, no Drive calls):
 *
 *  SHCO Portal (all staff)
 *    Case files/<Practice area>/<NNN> - <Matter title>/{sub-folders by practice area, see matterSubfolders}
 *    Clients/<Client ID> - <Client name>/KYC
 *  SHCO Finance (partners / Accounts) — or "Finance/" inside SHCO Portal until it is set
 *    <YYYY>/Claims/<claim form no>/
 *    <YYYY>/Payment Vouchers/<PV no>/
 *    <YYYY>/Bank-in Proofs/
 *    <YYYY>/Client Account/
 *    Files/<NNN> - <Matter title>/          (engagement & billing papers)
 *    Backups/
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
export const MATTER_SUBFOLDERS = ['Cause Papers', 'Cause Papers/Draft', 'Cause Papers/Extracted', 'Correspondences', 'Correspondences/Draft', 'Documents', 'Documents/Due Diligence'] as const;
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
  conveyancing: ['Documents', 'Documents/Due Diligence', 'Correspondences', 'Correspondences/Draft'],
  corporate: ['Agreement', 'Agreement/Draft', 'Correspondences', 'Correspondences/Draft', 'Documents', 'Documents/Due Diligence'],
};
/** The sub-folders a new matter folder gets, by practice area. */
export const matterSubfolders = (area?: string): string[] => [...SUBS[practiceKind(area)]];
/** Every folder a document can be uploaded to in a file (the sub-folders, plus the ones made on first use). */
export const uploadFolders = (area?: string): string[] => [...matterSubfolders(area), ACK_FOLDER, ...(practiceKind(area) === 'court' ? [MEMO_FOLDER] : []), LOE_FOLDER];
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

/** SHCO Finance/Files/<NNN - title> for a matter's engagement & billing papers. */
export const financeMatterPath = (m: MatterLike) => ['Files', matterFolderName(m.ref, m.title)];

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
