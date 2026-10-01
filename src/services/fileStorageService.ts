import { useEffect, useState } from 'react';
import type { ClaimAttachment, FinanceProof, HrDocument } from '../types';
import {
  describeStorageError, getClaimAttachmentUrl, openClaimAttachment, uploadClaimAttachment, uploadHrFile, validateClaimFile,
} from './firebaseStorageService';
import {
  DRIVE_TOKEN_EVENT, downloadDriveFile, driveSafeName, driveViewUrl, ensureFolderPath, getDriveAccessToken, getDriveConfig, grantReader, hasValidDriveToken, isDriveConfigured, uploadToDrive,
} from './googleDriveService';

/**
 * One place that decides where uploaded files go.
 *
 * - Google Drive (firm Shared Drive) once the Managing Partner has set it up in
 *   Firm & Practice Settings → Firm & Letterhead → Google Drive storage.
 * - Otherwise Firebase Storage, exactly as before.
 *
 * Records keep `path` for Firebase Storage files and `driveFileId` + `webViewLink` for Drive
 * files, so files uploaded before the switch still open.
 */

export type StorageBackend = 'drive' | 'firebase';
export const activeStorage = (): StorageBackend => (isDriveConfigured() ? 'drive' : 'firebase');

/** "Saved to Google Drive · SHCO Portal" / "Saved to Firebase Storage". */
export const storageLabel = (): string => {
  if (activeStorage() !== 'drive') return 'Saved to Firebase Storage';
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

/**
 * Warms up the Drive token from inside a click handler (so Google's small sign-in popup is
 * allowed by the browser) before any slower work starts. No-op when Drive is not in use.
 */
export async function prepareStorage(): Promise<void> {
  if (activeStorage() === 'drive') await getDriveAccessToken();
}

/* ------------------------------------------------------------------ claims */

/**
 * A claim / payment-request receipt. Drive: `Claims/<YYYY>/<form no.>/`. Firebase:
 * `confidential/claims/{userId}/{recordId}/…` (unchanged).
 */
export async function storeClaimReceipt(opts: { userId: string; recordId: string; formNo: string; file: File; uploadedBy: string }): Promise<ClaimAttachment> {
  const { file } = opts;
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  if (activeStorage() !== 'drive') return uploadClaimAttachment(opts.userId, opts.recordId, file);
  const c = getDriveConfig();
  try {
    const folder = await ensureFolderPath(c.rootFolderId, ['Claims', yyyy(), opts.formNo || opts.recordId]);
    const f = await uploadToDrive(folder, file, opts.recordId + ' - ' + file.name, typeOf(file), 'Receipt for ' + opts.recordId + ' (' + (opts.formNo || '') + ') uploaded by ' + opts.uploadedBy);
    return { name: file.name, driveFileId: f.id, webViewLink: f.webViewLink, size: file.size, contentType: typeOf(file), uploadedAt: new Date().toISOString(), uploadedBy: opts.uploadedBy };
  } catch (err) {
    throw new Error(file.name + ': ' + (err instanceof Error ? err.message : String(err)));
  }
}

/* ------------------------------------------------------------------ HR */

export interface HrStaffRef { email: string; staffId?: string; name: string }

/**
 * An HR document or staff photo. Drive: `HR/<Staff ID> <Display name>/` inside the HR folder
 * (if the owner set a separate one) or the root folder. When `shareWithStaff` is true the staff
 * member gets reader access to that one file, so they can open it from their own record even
 * if they are not a member of the HR Shared Drive. Firebase: unchanged.
 */
export async function storeHrFile(staff: HrStaffRef, file: File, uploadedBy: string, opts: { shareWithStaff?: boolean } = {}): Promise<Omit<HrDocument, 'type'> & { shareWarning?: string }> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const uploadedAt = new Date().toISOString();
  if (activeStorage() !== 'drive') {
    const up = await uploadHrFile(staff.email, file);
    return { ...up, uploadedAt, uploadedBy };
  }
  const c = getDriveConfig();
  const folderName = [staff.staffId, staff.name].filter(Boolean).join(' ') || staff.email || 'Unknown staff';
  try {
    const folder = c.hrFolderId
      ? await ensureFolderPath(c.hrFolderId, [folderName])
      : await ensureFolderPath(c.rootFolderId, ['HR', folderName]);
    const f = await uploadToDrive(folder, file, file.name, typeOf(file), 'HR file for ' + staff.name + ' uploaded by ' + uploadedBy);
    let shareWarning: string | undefined;
    if (opts.shareWithStaff && staff.email) {
      try { await grantReader(f.id, staff.email); } catch (e) { shareWarning = 'Saved, but ' + staff.name + ' could not be given access to open it (' + (e instanceof Error ? e.message : String(e)) + ').'; }
    }
    return { name: file.name, driveFileId: f.id, webViewLink: f.webViewLink, size: file.size, contentType: typeOf(file), uploadedAt, uploadedBy, shareWarning };
  } catch (err) {
    throw new Error(file.name + ': ' + (err instanceof Error ? err.message : String(err)));
  }
}

/* ------------------------------------------------------------------ finance proofs */

/** A bank-in slip / payment proof. Drive only: `Finance proofs/<YYYY>/`. */
export async function storeFinanceProof(file: File, uploadedBy: string, ref?: string): Promise<Pick<FinanceProof, 'driveFileId' | 'webViewLink' | 'uploadedBy'>> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const c = getDriveConfig();
  const folder = await ensureFolderPath(c.rootFolderId, ['Finance proofs', yyyy()]);
  const f = await uploadToDrive(folder, file, (ref ? ref + ' - ' : '') + file.name, typeOf(file), 'Finance proof uploaded by ' + uploadedBy);
  return { driveFileId: f.id, webViewLink: f.webViewLink, uploadedBy };
}

/* ------------------------------------------------------------------ matter files */

/** Drive folder name for a matter: "<file ref, / as -> - <title>". */
export const matterFolderName = (ref: string, title?: string) => driveSafeName([String(ref || '').replace(/\//g, '-'), title].filter(Boolean).join(' - ')).slice(0, 120);

/**
 * Creates (or finds) the matter's own folder in the firm Shared Drive: `Matters/<ref - title>/`.
 * Drive only — returns null when Drive is not set up in Firm Settings.
 */
export async function ensureMatterFolder(ref: string, title?: string): Promise<{ id: string; url: string } | null> {
  if (activeStorage() !== 'drive') return null;
  const c = getDriveConfig();
  const id = await ensureFolderPath(c.rootFolderId, ['Matters', matterFolderName(ref, title)]);
  return { id, url: 'https://drive.google.com/drive/folders/' + encodeURIComponent(id) };
}

export interface StoredMatterFile { name: string; driveFileId?: string; webViewLink?: string; storagePath?: string; size: number; contentType: string; uploadedAt: string; uploadedBy: string }

/**
 * A file kept on a matter (filing / service proof, correspondence, documents).
 * Drive: `<matter folder>/<sub>/` — the matter's own folder when it has one, else
 * `Matters/<ref - title>/<sub>/` under the firm root. Firebase (Drive not set up):
 * `confidential/claims/matters/<ref>_<sub>/…`, which firm staff can read under storage.rules.
 */
export async function storeMatterFile(opts: { ref: string; title?: string; folderId?: string; sub: 'Filing' | 'Service' | 'Correspondence' | 'Documents'; file: File; uploadedBy: string }): Promise<StoredMatterFile> {
  const { file } = opts;
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const uploadedAt = new Date().toISOString();
  if (activeStorage() !== 'drive') {
    const up = await uploadClaimAttachment('matters', String(opts.ref || 'file').replace(/\//g, '-') + '_' + opts.sub, file);
    return { name: file.name, storagePath: up.path, size: file.size, contentType: typeOf(file), uploadedAt, uploadedBy: opts.uploadedBy };
  }
  const c = getDriveConfig();
  try {
    const folder = opts.folderId
      ? await ensureFolderPath(opts.folderId, [opts.sub])
      : await ensureFolderPath(c.rootFolderId, ['Matters', matterFolderName(opts.ref, opts.title), opts.sub]);
    const f = await uploadToDrive(folder, file, file.name, typeOf(file), opts.sub + ' for ' + opts.ref + ' uploaded by ' + opts.uploadedBy);
    return { name: file.name, driveFileId: f.id, webViewLink: f.webViewLink, size: file.size, contentType: typeOf(file), uploadedAt, uploadedBy: opts.uploadedBy };
  } catch (err) {
    throw new Error(file.name + ': ' + (err instanceof Error ? err.message : String(err)));
  }
}

/* ------------------------------------------------------------------ opening */

export type StoredFileRef = { path?: string; driveFileId?: string; webViewLink?: string };

/** Stable key for lists (Drive id, else Storage path, else name). */
export const storedFileKey = (f: StoredFileRef & { name?: string }) => f.driveFileId || f.path || f.name || '';
export const sameStoredFile = (a: StoredFileRef, b: StoredFileRef) =>
  (!!a.driveFileId && a.driveFileId === b.driveFileId) || (!a.driveFileId && !b.driveFileId && !!a.path && a.path === b.path);

/**
 * Opens a stored file in a new tab. Drive files open their Drive page (Drive checks the
 * viewer is allowed); older Firebase Storage files use a download URL as before.
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
 * Image URL for a stored image (staff photo). Drive images are fetched with the viewer's
 * Drive token and shown through an object URL (Drive links do not render in <img> without
 * auth). Loading a photo never opens Google's sign-in popup on its own: if there is no Drive
 * token yet this session, `needsDrive` is true and `connect()` (call it from a click) gets one.
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

export { describeStorageError };
