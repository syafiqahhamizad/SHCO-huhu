import { useEffect, useState } from 'react';
import type { ClaimAttachment, FinanceProof, HrDocument } from '../types';
import {
  getClaimAttachmentUrl,
  openClaimAttachment,
  validateClaimFile,
} from './firebaseStorageService';
import {
  DRIVE_TOKEN_EVENT, downloadDriveFile, driveSafeName, driveViewUrl, ensureFolderPath, getDriveAccessToken, getDriveConfig, grantReader, hasValidDriveToken, isDriveConfigured, uploadToDrive,
} from './googleDriveService';

/**
 * One place that decides where uploaded files go: the firm's Google Drive (Shared Drive), and
 * nowhere else (firm decision, Oct 2026).
 *
 * - Every upload goes to the Shared Drive the Managing Partner set up in Firm & Practice
 *   Settings → Google, e-mail & backup → Google Drive storage. Records keep only metadata
 *   ({ name, driveFileId, webViewLink, size, contentType, uploadedAt, uploadedBy }).
 * - When Drive is not set up, uploads are BLOCKED with DRIVE_REQUIRED_MSG. There is no
 *   Firebase Storage fallback any more, and nothing new is kept as a data URL / base64 copy
 *   (one exception: the letterhead header image, see storeLetterheadImage).
 * - Legacy, read-only: records made before the switch may still carry a Firebase Storage
 *   `path` / `storagePath`, or a `dataUrl`. Those still open (openStoredFile, useStoredImageUrl,
 *   openLegacyDataUrl); nothing new is written that way.
 */

/** Shown wherever an upload is attempted before Drive storage is set up. */
export const DRIVE_REQUIRED_MSG = 'Set up Google Drive in Firm & Practice Settings → Google, e-mail & backup before uploading.';

/** Metadata kept on a record for one uploaded file. */
export interface StoredFileMeta { name: string; driveFileId: string; webViewLink?: string; size: number; contentType: string; uploadedAt: string; uploadedBy: string }

export type StorageBackend = 'drive' | 'none';
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
const errOf = (file: File, err: unknown) => new Error(file.name + ': ' + (err instanceof Error ? err.message : String(err)));

/**
 * Checks Drive is set up, then warms up the Drive token from inside a click handler (so Google's
 * small sign-in popup is allowed by the browser) before any slower work starts.
 * Throws DRIVE_REQUIRED_MSG when Drive is not set up.
 */
export async function prepareStorage(): Promise<void> {
  requireDrive();
  await getDriveAccessToken();
}

/** Uploads one file into `parts` under `baseId` (default: the firm root folder). */
async function storeIn(parts: string[], file: File, uploadedBy: string, opts: { baseId?: string; name?: string; description?: string } = {}): Promise<StoredFileMeta> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const c = requireDrive();
  try {
    const folder = await ensureFolderPath(opts.baseId || c.rootFolderId, parts);
    const f = await uploadToDrive(folder, file, opts.name || file.name, typeOf(file), opts.description || ('Uploaded by ' + uploadedBy));
    return { name: file.name, driveFileId: f.id, webViewLink: f.webViewLink, size: file.size, contentType: typeOf(file), uploadedAt: new Date().toISOString(), uploadedBy };
  } catch (err) {
    throw errOf(file, err);
  }
}

/* ------------------------------------------------------------------ claims */

/** A claim / payment-request receipt. Drive: `Claims/<YYYY>/<form no.>/`. */
export async function storeClaimReceipt(opts: { userId: string; recordId: string; formNo: string; file: File; uploadedBy: string }): Promise<ClaimAttachment> {
  return storeIn(['Claims', yyyy(), opts.formNo || opts.recordId], opts.file, opts.uploadedBy, {
    name: opts.recordId + ' - ' + opts.file.name,
    description: 'Receipt for ' + opts.recordId + ' (' + (opts.formNo || '') + ') uploaded by ' + opts.uploadedBy,
  });
}

/* ------------------------------------------------------------------ HR */

export interface HrStaffRef { email: string; staffId?: string; name: string }
const staffFolderName = (staff: HrStaffRef) => [staff.staffId, staff.name].filter(Boolean).join(' ') || staff.email || 'Unknown staff';

/**
 * An HR document or staff photo. Drive: `HR/<Staff ID> <Display name>/` inside the HR folder
 * (if the owner set a separate one) or the root folder. When `shareWithStaff` is true the staff
 * member gets reader access to that one file, so they can open it from their own record even
 * if they are not a member of the HR Shared Drive.
 */
export async function storeHrFile(staff: HrStaffRef, file: File, uploadedBy: string, opts: { shareWithStaff?: boolean } = {}): Promise<Omit<HrDocument, 'type'> & { shareWarning?: string }> {
  const c = requireDrive();
  const up = c.hrFolderId
    ? await storeIn([staffFolderName(staff)], file, uploadedBy, { baseId: c.hrFolderId, description: 'HR file for ' + staff.name + ' uploaded by ' + uploadedBy })
    : await storeIn(['HR', staffFolderName(staff)], file, uploadedBy, { description: 'HR file for ' + staff.name + ' uploaded by ' + uploadedBy });
  let shareWarning: string | undefined;
  if (opts.shareWithStaff && staff.email) {
    try { await grantReader(up.driveFileId, staff.email); } catch (e) { shareWarning = 'Saved, but ' + staff.name + ' could not be given access to open it (' + (e instanceof Error ? e.message : String(e)) + ').'; }
  }
  return { ...up, shareWarning };
}

/**
 * A leave supporting document (MC, discharge note, exam slip…) uploaded by the staff member
 * themselves. Drive: `Leave/<YYYY>/<Staff ID> <Name>/` under the firm root (not the HR folder,
 * which may be partners-only), so every staff member can upload their own.
 */
export async function storeLeaveDocument(staff: HrStaffRef, file: File, leaveId: string): Promise<StoredFileMeta> {
  return storeIn(['Leave', yyyy(), staffFolderName(staff)], file, staff.name, {
    name: leaveId + ' - ' + file.name,
    description: 'Leave supporting document for ' + leaveId + ' uploaded by ' + staff.name,
  });
}

/* ------------------------------------------------------------------ finance proofs */

/** A bank-in slip / payment proof. Drive: `Finance proofs/<YYYY>/`. */
export async function storeFinanceProof(file: File, uploadedBy: string, ref?: string): Promise<Pick<FinanceProof, 'driveFileId' | 'webViewLink' | 'uploadedBy'>> {
  const up = await storeIn(['Finance proofs', yyyy()], file, uploadedBy, { name: (ref ? ref + ' - ' : '') + file.name, description: 'Finance proof uploaded by ' + uploadedBy });
  return { driveFileId: up.driveFileId, webViewLink: up.webViewLink, uploadedBy };
}

/* ------------------------------------------------------------------ clients (KYC / CDD) */

/** Drive folder name for a client: "<name> (<client id>)". */
export const clientFolderName = (name: string, id: string) => driveSafeName([name, id ? '(' + id + ')' : ''].filter(Boolean).join(' ')).slice(0, 120);

/** A client's KYC / CDD document (IC, SSM extract, proof of address…). Drive: `Clients/<name (id)>/KYC/`. */
export async function storeClientKycFile(client: { id: string; name: string }, file: File, uploadedBy: string): Promise<StoredFileMeta> {
  return storeIn(['Clients', clientFolderName(client.name, client.id), 'KYC'], file, uploadedBy, { description: 'KYC document for ' + client.name + ' (' + client.id + ') uploaded by ' + uploadedBy });
}

/** Creates (or finds) the client's KYC folder, `Clients/<name (id)>/KYC/`. Null when Drive is not set up. */
export async function ensureClientKycFolder(client: { id: string; name: string }): Promise<{ id: string; url: string } | null> {
  if (activeStorage() !== 'drive') return null;
  const c = getDriveConfig();
  const id = await ensureFolderPath(c.rootFolderId, ['Clients', clientFolderName(client.name, client.id), 'KYC']);
  return { id, url: 'https://drive.google.com/drive/folders/' + encodeURIComponent(id) };
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

/** Drive folder name for a matter: "<file ref, / as -> - <title>". */
const matterFolderName = (ref: string, title?: string) => driveSafeName([String(ref || '').replace(/\//g, '-'), title].filter(Boolean).join(' - ')).slice(0, 120);

/**
 * Creates (or finds) the matter's own folder in the firm Shared Drive: `Matters/<ref - title>/`.
 * Returns null when Drive is not set up in Firm Settings.
 */
export async function ensureMatterFolder(ref: string, title?: string): Promise<{ id: string; url: string } | null> {
  if (activeStorage() !== 'drive') return null;
  const c = getDriveConfig();
  const id = await ensureFolderPath(c.rootFolderId, ['Matters', matterFolderName(ref, title)]);
  return { id, url: 'https://drive.google.com/drive/folders/' + encodeURIComponent(id) };
}

/** `storagePath` is legacy (Firebase Storage, read-only); new files always have driveFileId. */
export interface StoredMatterFile { name: string; driveFileId?: string; webViewLink?: string; storagePath?: string; size: number; contentType: string; uploadedAt: string; uploadedBy: string }

/**
 * A file kept on a matter (filing / service proof, correspondence, documents).
 * Drive: `<matter folder>/<sub>/` — the matter's own folder when it has one, else
 * `Matters/<ref - title>/<sub>/` under the firm root.
 */
export async function storeMatterFile(opts: { ref: string; title?: string; folderId?: string; sub: 'Filing' | 'Service' | 'Correspondence' | 'Documents'; file: File; uploadedBy: string }): Promise<StoredMatterFile> {
  const description = opts.sub + ' for ' + opts.ref + ' uploaded by ' + opts.uploadedBy;
  return opts.folderId
    ? storeIn([opts.sub], opts.file, opts.uploadedBy, { baseId: opts.folderId, description })
    : storeIn(['Matters', matterFolderName(opts.ref, opts.title), opts.sub], opts.file, opts.uploadedBy, { description });
}

/* ------------------------------------------------------------------ opening */

export type StoredFileRef = { path?: string; driveFileId?: string; webViewLink?: string };

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

