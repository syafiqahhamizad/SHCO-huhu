import { extractMatterRunningNumber } from '../services/matterService';

/**
 * Where every upload goes in the firm's three Google Shared Drives (pure helpers, no Drive calls):
 *
 *  SHCO Portal (all staff)
 *    Matters/<Practice area>/<NNN> - <Matter title>/{Court Papers, Correspondence, Client Documents, Research, Closing}
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

/** The five working sub-folders every matter folder gets (no numbering). */
export const MATTER_SUBFOLDERS = ['Court Papers', 'Correspondence', 'Client Documents', 'Research', 'Closing'] as const;
export type MatterSub = (typeof MATTER_SUBFOLDERS)[number];

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

/** Path of a matter's folder in SHCO Portal: Matters/<area>/<NNN - title>. */
export const matterFolderPath = (m: MatterLike, names: Record<string, string> = {}): string[] =>
  ['Matters', practiceFolderName(m.practiceArea || m.type, names), matterFolderName(m.ref, m.title)];

/** Folder description: the full file ref (and title), so the folder can be found from the ref. */
export const matterFolderDescription = (m: MatterLike) => 'File ref: ' + m.ref + (m.title ? ' · ' + m.title : '');

/**
 * Where a matter document goes, from its category / kind. 'finance' = SHCO Finance/Files/<NNN - title>
 * (engagement letters, quotations, invoices, receipts, billing).
 */
export const matterSubFor = (category?: string): MatterSub | 'finance' => {
  const c = String(category || '').toLowerCase();
  if (/engagement|billing|quotation|invoice|receipt|proforma|fee/.test(c)) return 'finance';
  if (/filing|filed|service|served|court|pleading|cause paper|affidavit|order/.test(c)) return 'Court Papers';
  if (/research|authorit|case law|memo/.test(c)) return 'Research';
  if (/closing|closed/.test(c)) return 'Closing';
  if (/client|kyc|document|evidence|title|agreement/.test(c)) return 'Client Documents';
  return 'Correspondence';
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
