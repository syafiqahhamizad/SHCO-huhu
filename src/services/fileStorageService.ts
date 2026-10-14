import { useEffect, useState } from 'react';
import { getPracticeSettings } from './templateService';
import type { ClaimAttachment, FinanceProof, HrDocument } from '../types';
import {
  getClaimAttachmentUrl,
  openClaimAttachment,
  validateClaimFile,
} from './firebaseStorageService';
import {
  DRIVE_TOKEN_EVENT, downloadDriveFile, driveViewUrl, ensureFolderPath, getDriveAccessToken, getDriveConfig, grantReader, hasValidDriveToken, isDriveAccessError, isDriveConfigured, ensureShortcut, moveDriveItem, renameChildFolder, uploadToDrive,
} from './googleDriveService';
import {
  CLIENTS_ROOT, FIN, OLD_FIN_NAMES, booksMonthPath, clientFilesPath, matterSubfolders, clientFolderName as layoutClientFolderName, financeFolderPath, folderUrl, matterFolderDescription, matterFolderPath,
  staffFolderName, type FinanceKind, type MatterLike, type MatterSub,
} from '../lib/driveLayout';

/**
 * One place that decides where uploaded files go: the firm's Google Shared Drives, and nowhere
 * else (firm decision, Oct 2026). Folder layout: lib/driveLayout.ts.
 *
 * - SHCO Portal (root folder, all staff): Case files/<area>/<NNN - title>/<sub>, Clients KYC/<client no. - name>/KYC.
 * - SHCO Finance (partners / Accounts; Finance/ inside SHCO Portal until it is set): claims,
 *   payment vouchers, bank-in proofs, client account, engagement & billing papers, backups.
 * - SHCO HR (HR folder setting; HR/ inside SHCO Portal until it is set): <Staff ID - Name>/.
 * Records keep only metadata ({ name, driveFileId, webViewLink, driveFolderId, size, contentType,
 * uploadedAt, uploadedBy }). Records made before this layout keep their stored links, which
 * still open. When Drive is not set up, uploads are BLOCKED with DRIVE_REQUIRED_MSG.
 * Legacy, read-only: Firebase Storage `path` / `storagePath`, or a `dataUrl`.
 */

/** Shown wherever an upload is attempted before Drive storage is set up. */
export const DRIVE_REQUIRED_MSG = 'Set up Google Drive in Firm & Practice Settings → Google, e-mail & backup before uploading.';

/** Metadata kept on a record for one uploaded file. */
interface StoredFileMeta { name: string; driveFileId: string; webViewLink?: string; driveFolderId?: string; size: number; contentType: string; uploadedAt: string; uploadedBy: string }

type StorageBackend = 'drive' | 'none';
export const activeStorage = (): StorageBackend => (isDriveConfigured() ? 'drive' : 'none');
/** True once Drive storage is set up (uploads allowed). */
export const isUploadReady = () => isDriveConfigured();

/** Throws DRIVE_REQUIRED_MSG when Drive storage is not set up; returns the Drive config. */
const requireDrive = () => {
  if (!isDriveConfigured()) throw new Error(DRIVE_REQUIRED_MSG);
  return getDriveConfig();
};

/** "Saved to Google Drive · SHCO Portal", or the blocking message when Drive is not set up. */
export const storageLabel = (): string => {
  if (activeStorage() !== 'drive') return 'Uploads blocked: ' + DRIVE_REQUIRED_MSG;
  const c = getDriveConfig();
  return 'Saved to Google Drive · ' + (c.rootFolderName || 'firm Shared Drive');
};

/** Re-renders when Firm Settings change (e.g. the owner switches Drive on). */
export const useStorageLabel = (): string => {
  const [label, setLabel] = useState(storageLabel);
  useEffect(() => {
    const on = () => setLabel(storageLabel());
    window.addEventListener('shco-practice-settings-updated', on);
    return () => window.removeEventListener('shco-practice-settings-updated', on);
  }, []);
  return label;
};

export { validateClaimFile };

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const typeOf = (file: File) => file.type || (isPdf(file) ? 'application/pdf' : 'application/octet-stream');
const yyyy = () => String(new Date().getFullYear());
/** Wraps an upload error with the file name, keeping the Drive error as `cause`. */
const errOf = (file: File, err: unknown) => Object.assign(new Error(file.name + ': ' + (err instanceof Error ? err.message : String(err))), { cause: err });

/**
 * Checks Drive is set up, then warms up the Drive token from inside a click handler (so Google's
 * small sign-in popup is allowed by the browser) before any slower work starts.
 * Throws DRIVE_REQUIRED_MSG when Drive is not set up.
 */
export async function prepareStorage(): Promise<void> {
  requireDrive();
  await getDriveAccessToken();
}

/** Uploads one file into `parts` under `baseId` (default: the SHCO Portal root folder). */
async function storeIn(parts: string[], file: File, uploadedBy: string, opts: { baseId?: string; name?: string; description?: string } = {}): Promise<StoredFileMeta> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const c = requireDrive();
  try {
    const folder = await ensureFolderPath(opts.baseId || c.rootFolderId, parts);
    const f = await uploadToDrive(folder, file, opts.name || file.name, typeOf(file), opts.description || ('Uploaded by ' + uploadedBy));
    return { name: file.name, driveFileId: f.id, webViewLink: f.webViewLink, driveFolderId: folder, size: file.size, contentType: typeOf(file), uploadedAt: new Date().toISOString(), uploadedBy };
  } catch (err) {
    throw errOf(file, err);
  }
}

/* ------------------------------------------------------------------ finance base */

/**
 * Where finance files live: the SHCO Finance Shared Drive, or `Finance/` inside SHCO Portal when
 * no Finance drive is set (Firm Settings warns that staff could then see them).
 */
const financeBase = (): { baseId: string; prefix: string[]; separate: boolean } => {
  const c = getDriveConfig();
  return c.financeFolderId
    ? { baseId: c.financeFolderId, prefix: [], separate: true }
    : { baseId: c.rootFolderId, prefix: ['Finance'], separate: false };
};

/** Creates (or finds) a folder inside the finance base, e.g. ['Backups']. */
export async function ensureFinanceFolder(parts: string[]): Promise<string> {
  requireDrive();
  const b = financeBase();
  return ensureFolderPath(b.baseId, [...b.prefix, ...parts]);
}

async function storeFinance(parts: string[], file: File, uploadedBy: string, opts: { name?: string; description?: string; fallbackToPortal?: boolean } = {}): Promise<StoredFileMeta> {
  requireDrive();
  const b = financeBase();
  try {
    return await storeIn([...b.prefix, ...parts], file, uploadedBy, { baseId: b.baseId, name: opts.name, description: opts.description });
  } catch (err) {
    // Staff who submit a claim are usually not members of SHCO Finance: their own receipts then
    // go to Finance/ inside SHCO Portal (where every staff member can add files).
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    if (opts.fallbackToPortal && b.separate && isDriveAccessError(cause)) {
      return storeIn(['Finance', ...parts], file, uploadedBy, { name: opts.name, description: opts.description });
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ finance books filing */

/**
 * Files one money entry (claim, PV, office expense, receipt) in the finance books: its entry folder
 * "<DDMMYYYY doc no. file what RM>" goes under `path` (Pending, Rejected, or the month's Money In /
 * Money Out), its papers are moved into it and renamed, and a file's entry gets a link in
 * Client Files/<file>. Safe to repeat: an existing entry folder is moved / renamed, not duplicated.
 */
/** Renames the first set-up's numbered folders ("Books" → "Books" …) once per visit, so nothing is duplicated. */
let oldNamesDone: Promise<void> | null = null;
const renameOldFinanceRoots = (b: { baseId: string; prefix: string[] }) => {
  if (!oldNamesDone) {
    oldNamesDone = (async () => {
      const parentId = b.prefix.length ? await ensureFolderPath(b.baseId, b.prefix) : b.baseId;
      for (const [from, to] of OLD_FIN_NAMES) await renameChildFolder(parentId, from, to);
    })().catch((e) => { oldNamesDone = null; throw e; });
  }
  return oldNamesDone;
};

export async function fileFinanceEntry(o: { path: string[]; name: string; folderId?: string; papers: { id: string; name: string }[]; matter?: MatterLike; matters?: MatterLike[] }): Promise<{ folderId: string; papers: { id: string; webViewLink?: string }[] }> {
  requireDrive();
  const b = financeBase();
  await renameOldFinanceRoots(b);
  const parentId = await ensureFolderPath(b.baseId, [...b.prefix, ...o.path]);
  let folderId = '';
  if (o.folderId) { try { folderId = (await moveDriveItem(o.folderId, parentId, o.name)).id; } catch { folderId = ''; } }
  if (!folderId) folderId = await ensureFolderPath(parentId, [o.name]);
  const papers: { id: string; webViewLink?: string }[] = [];
  for (const p of o.papers) papers.push(await moveDriveItem(p.id, folderId, p.name));
  for (const m of o.matters || (o.matter ? [o.matter] : [])) {
    const cf = await ensureFolderPath(b.baseId, [...b.prefix, ...clientFilesPath(m)]);
    await ensureShortcut(cf, folderId, o.name);
  }
  return { folderId, papers };
}

/** "Set up finance folders": creates every folder in `paths` (inside the finance base). */
export async function ensureFinanceFolders(paths: string[][], onProgress?: (done: number, total: number) => void): Promise<void> {
  requireDrive();
  const b = financeBase();
  await renameOldFinanceRoots(b);
  for (let i = 0; i < paths.length; i += 1) { await ensureFolderPath(b.baseId, [...b.prefix, ...paths[i]]); onProgress?.(i + 1, paths.length); }
}

/** True when a separate SHCO Finance drive is set (filing into the books only happens there). */
export const hasFinanceDrive = () => activeStorage() === 'drive' && !!getDriveConfig().financeFolderId;

/** Once "Set up finance folders" is done, new finance uploads wait in Books/Incoming until they are
 * filed (the finance pages move them into their entry folder). Client-account papers keep their old place. */
const financeUploadPath = (kind: FinanceKind, ref?: string): string[] => {
  if (!getPracticeSettings().financeFiling) return financeFolderPath(kind, yyyy(), ref);
  // The month's client bank statement goes straight to Client Account › <year> › <month> › Bank Statement.
  const ym = kind === 'clientAccount' ? String(ref || '').match(/(\d{4})-(\d{2})/) : null;
  if (ym) return booksMonthPath('Client account', ym[1] + '-' + ym[2] + '-01', 'Bank Statement');
  return [FIN.books, 'Incoming'];
};

/* ------------------------------------------------------------------ claims */

/**
 * A claim / payment-request receipt. Drive: SHCO Finance `<YYYY>/Claims/<form no.>/`
 * (or `<YYYY>/Payment Vouchers/<form no.>/` for a payment request).
 */
export async function storeClaimReceipt(opts: { userId: string; recordId: string; formNo: string; file: File; uploadedBy: string; kind?: 'claim' | 'pv' }): Promise<ClaimAttachment> {
  return storeFinance(financeUploadPath(opts.kind || 'claim', opts.formNo || opts.recordId), opts.file, opts.uploadedBy, {
    name: opts.recordId + ' - ' + opts.file.name,
    description: 'Receipt for ' + opts.recordId + ' (' + (opts.formNo || '') + ') uploaded by ' + opts.uploadedBy,
    fallbackToPortal: true,
  });
}

/* ------------------------------------------------------------------ HR */

interface HrStaffRef { email: string; staffId?: string; name: string }

/**
 * An HR document or staff photo. Drive: SHCO HR `<Staff ID> - <Name>/` (or `HR/<Staff ID> - <Name>/`
 * inside SHCO Portal when no HR drive is set). When `shareWithStaff` is true the staff
 * member gets reader access to that one file, so they can open it from their own record even
 * if they are not a member of the HR Shared Drive.
 */
export async function storeHrFile(staff: HrStaffRef, file: File, uploadedBy: string, opts: { shareWithStaff?: boolean } = {}): Promise<Omit<HrDocument, 'type'> & { shareWarning?: string }> {
  const c = requireDrive();
  const folder = staffFolderName(staff);
  const up = c.hrFolderId
    ? await storeIn([folder], file, uploadedBy, { baseId: c.hrFolderId, description: 'HR file for ' + staff.name + ' uploaded by ' + uploadedBy })
    : await storeIn(['HR', folder], file, uploadedBy, { description: 'HR file for ' + staff.name + ' uploaded by ' + uploadedBy });
  let shareWarning: string | undefined;
  if (opts.shareWithStaff && staff.email) {
    try { await grantReader(up.driveFileId, staff.email); } catch (e) { shareWarning = 'Saved, but ' + staff.name + ' could not be given access to open it (' + (e instanceof Error ? e.message : String(e)) + ').'; }
  }
  return { ...up, shareWarning };
}

/**
 * A leave supporting document (MC, discharge note, exam slip…) uploaded by the staff member
 * themselves. Drive: `Leave/<YYYY>/<Staff ID> - <Name>/` in SHCO Portal (not the HR drive,
 * which is partners-only), so every staff member can upload their own.
 */
export async function storeLeaveDocument(staff: HrStaffRef, file: File, leaveId: string): Promise<StoredFileMeta> {
  return storeIn(['Leave', yyyy(), staffFolderName(staff)], file, staff.name, {
    name: leaveId + ' - ' + file.name,
    description: 'Leave supporting document for ' + leaveId + ' uploaded by ' + staff.name,
  });
}

/* ------------------------------------------------------------------ finance proofs */

/**
 * A finance proof. Drive (SHCO Finance): bank-in / payment proofs `<YYYY>/Bank-in Proofs/`,
 * PV documents `<YYYY>/Payment Vouchers/<PV no.>/`, claim payments `<YYYY>/Claims/<no.>/`,
 * client account statements / reconciliation proofs `<YYYY>/Client Account/`.
 */
export async function storeFinanceProof(file: File, uploadedBy: string, ref?: string, kind: FinanceKind = 'bankin'): Promise<Pick<FinanceProof, 'driveFileId' | 'webViewLink' | 'uploadedBy' | 'driveFolderId'>> {
  const up = await storeFinance(financeUploadPath(kind, ref), file, uploadedBy, {
    name: (ref ? ref + ' - ' : '') + file.name,
    description: 'Finance proof' + (ref ? ' for ' + ref : '') + ' uploaded by ' + uploadedBy,
  });
  return { driveFileId: up.driveFileId, webViewLink: up.webViewLink, uploadedBy, driveFolderId: up.driveFolderId };
}

/* ------------------------------------------------------------------ clients (KYC / CDD) */

/** Drive folder name for a client: "<client id> - <name>". */
export const clientFolderName = (name: string, id: string) => layoutClientFolderName(name, id);

/** A client's KYC / CDD document (IC, SSM extract, proof of address…). Drive: `Clients KYC/<client no. - name>/KYC/`. */
export async function storeClientKycFile(client: { id: string; name: string }, file: File, uploadedBy: string): Promise<StoredFileMeta> {
  return storeIn([CLIENTS_ROOT, clientFolderName(client.name, client.id), 'KYC'], file, uploadedBy, { description: 'KYC document for ' + client.name + ' (' + client.id + ') uploaded by ' + uploadedBy });
}

/** Creates (or finds) the client's KYC folder, `Clients KYC/<client no. - name>/KYC/`. Null when Drive is not set up. */
export async function ensureClientKycFolder(client: { id: string; name: string }): Promise<{ id: string; url: string } | null> {
  if (activeStorage() !== 'drive') return null;
  const c = getDriveConfig();
  const id = await ensureFolderPath(c.rootFolderId, [CLIENTS_ROOT, clientFolderName(client.name, client.id), 'KYC']);
  return { id, url: folderUrl(id) };
}

/** Renames a client's Drive folder `<old no> - name` → `<new no> - name` (Clients/). True when renamed. */
export async function renameClientFolder(name: string, fromNo: string, toNo: string): Promise<boolean> {
  if (activeStorage() !== 'drive') return false;
  const c = getDriveConfig();
  const clientsId = await ensureFolderPath(c.rootFolderId, [CLIENTS_ROOT]);
  return renameChildFolder(clientsId, clientFolderName(name, fromNo), clientFolderName(name, toNo));
}

/* ------------------------------------------------------------------ firm letterhead */

/**
 * The original letterhead header image for a branch. Drive: `Firm/Letterhead/`.
 * Exception to "metadata only": documents are printed / turned into PDFs in an iframe without
 * a Drive token, so the caller ALSO keeps a small compressed data-URL copy in Firm Settings for
 * rendering. The Drive copy is the original of record.
 */
export async function storeLetterheadImage(branchName: string, file: File, uploadedBy: string): Promise<StoredFileMeta> {
  return storeIn(['Firm', 'Letterhead'], file, uploadedBy, { name: branchName + ' - ' + file.name, description: 'Letterhead header for ' + branchName + ' uploaded by ' + uploadedBy });
}

/* ------------------------------------------------------------------ matter files */


/** "Case files › Civil Litigation › 042 - Title" (for "Goes to …" hints). */
export const matterDriveLabel = (m: MatterLike) => matterFolderPath(m, getDriveConfig().practiceFolderNames).join(' › ');

/**
 * Creates (or finds) the matter's folder in SHCO Portal, `Case files/<Practice area>/<NNN> - <title>/`,
 * with its sub-folders for the practice area (court work, conveyancing or corporate), and puts the full file ref in the folder description.
 * Returns null when Drive is not set up in Firm Settings.
 */
export async function ensureMatterFolder(m: MatterLike): Promise<{ id: string; url: string } | null> {
  if (activeStorage() !== 'drive') return null;
  const c = getDriveConfig();
  const id = await ensureFolderPath(c.rootFolderId, matterFolderPath(m, c.practiceFolderNames), matterFolderDescription(m));
  for (const sub of matterSubfolders(m.practiceArea || m.type)) await ensureFolderPath(id, sub.split('/'));
  return { id, url: folderUrl(id) };
}

/** `storagePath` is legacy (Firebase Storage, read-only); new files always have driveFileId. */
export interface StoredMatterFile { name: string; driveFileId?: string; webViewLink?: string; driveFolderId?: string; storagePath?: string; size: number; contentType: string; uploadedAt: string; uploadedBy: string }

/**
 * A file kept on a matter. Drive: `<matter folder>/<sub>/` — the matter's own folder when it has
 * one (gdriveFolderId), else `Case files/<area>/<NNN - title>/<sub>/` in SHCO Portal.
 * Subs: see matterSubfolders (e.g. Cause Papers, Correspondences/Acknowledgment, Letter of Engagement).
 */
export async function storeMatterFile(opts: MatterLike & { folderId?: string; sub: MatterSub; file: File; uploadedBy: string }): Promise<StoredMatterFile> {
  const description = opts.sub + ' for ' + opts.ref + ' uploaded by ' + opts.uploadedBy;
  if (opts.folderId) return storeIn(opts.sub.split('/'), opts.file, opts.uploadedBy, { baseId: opts.folderId, description });
  const c = requireDrive();
  const folder = await ensureFolderPath(c.rootFolderId, matterFolderPath(opts, c.practiceFolderNames), matterFolderDescription(opts));
  return storeIn(opts.sub.split('/'), opts.file, opts.uploadedBy, { baseId: folder, description });
}

/**
 * Engagement & billing papers of a matter (signed Letter of Engagement, quotations, invoices,
 * receipts). Drive: SHCO Finance `Files/<NNN> - <title>/`.
 */
export async function storeEngagementFile(m: MatterLike, file: File, uploadedBy: string): Promise<StoredMatterFile> {
  try {
    return await storeFinance(clientFilesPath(m), file, uploadedBy, { description: 'Engagement & billing for ' + m.ref + ' uploaded by ' + uploadedBy });
  } catch (err) {
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    if (financeBase().separate && isDriveAccessError(cause)) throw new Error(file.name + ': engagement & billing papers go to the SHCO Finance Shared Drive, and your Google account cannot add files there. Ask a partner or Accounts to upload it.');
    throw err;
  }
}

/* ------------------------------------------------------------------ opening */

type StoredFileRef = { path?: string; driveFileId?: string; webViewLink?: string };

/** Stable key for lists (Drive id, else Storage path, else name). */
export const storedFileKey = (f: StoredFileRef & { name?: string }) => f.driveFileId || f.path || f.name || '';
export const sameStoredFile = (a: StoredFileRef, b: StoredFileRef) =>
  (!!a.driveFileId && a.driveFileId === b.driveFileId) || (!a.driveFileId && !b.driveFileId && !!a.path && a.path === b.path);

/**
 * Opens a stored file in a new tab. Drive files open their Drive page (Drive checks the
 * viewer is allowed); legacy Firebase Storage files use a download URL (read-only support).
 * Returns an error message, or null on success.
 */
export async function openStoredFile(f: StoredFileRef): Promise<string | null> {
  const drive = driveViewUrl(f);
  if (drive) {
    // Opened synchronously inside the click, so popup blockers allow it.
    window.open(drive, '_blank', 'noopener');
    return null;
  }
  if (f.path) return openClaimAttachment({ path: f.path });
  return 'This file has no stored copy (only its name was kept).';
}

/**
 * Opens a legacy file that was kept inline as a data URL (old KYC / case documents, before
 * uploads moved to Drive). Read-only support: shown in a new tab through a Blob URL, since
 * browsers block navigating to data: URLs directly. Returns an error message, or null.
 */
export function openLegacyDataUrl(dataUrl: string, name = 'document'): string | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return 'This file could not be read.';
  try {
    const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: m[1] || 'application/octet-stream' }));
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  } catch {
    return 'This file could not be read.';
  }
}

/**
 * Image URL for a stored image (staff photo). Drive images are fetched with the viewer's
 * Drive token and shown through an object URL (Drive links do not render in <img> without
 * auth). Loading a photo never opens Google's sign-in popup on its own: if there is no Drive
 * token yet this session, `needsDrive` is true and `connect()` (call it from a click) gets one.
 * Legacy Firebase Storage photos (`path`) still load through a download URL.
 * `url` is null (show the initial avatar) whenever the image cannot be loaded.
 */
export const useStoredImageUrl = (f?: StoredFileRef | null): { url: string | null; needsDrive: boolean; connect: () => void } => {
  const [url, setUrl] = useState<string | null>(null);
  const [needsDrive, setNeedsDrive] = useState(false);
  const [tick, setTick] = useState(0);
  const driveId = f?.driveFileId || '';
  const path = f?.path || '';
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(DRIVE_TOKEN_EVENT, on);
    return () => window.removeEventListener(DRIVE_TOKEN_EVENT, on);
  }, []);
  useEffect(() => {
    let live = true;
    let objectUrl = '';
    setUrl(null);
    setNeedsDrive(false);
    if (driveId) {
      if (!isDriveConfigured()) { /* Drive switched off: nothing to fetch with */ }
      else if (!hasValidDriveToken()) setNeedsDrive(true);
      else downloadDriveFile(driveId)
        .then((b) => { if (live) { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); } })
        .catch(() => live && setUrl(null));
    } else if (path) {
      getClaimAttachmentUrl(path).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    }
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [driveId, path, tick]);
  const connect = () => { void getDriveAccessToken().catch(() => undefined); };
  return { url, needsDrive, connect };
};

