import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import { firebaseApp } from './firebaseAuthService';
import type { ClaimAttachment } from '../types';

/**
 * Firebase Storage — LEGACY, READ-ONLY.
 *
 * All uploads now go to the firm's Google Drive (see fileStorageService.ts). This module only
 * opens files uploaded before the switch (claim receipts under `confidential/claims/**`,
 * matter files under `confidential/claims/matters/**`, HR files / staff photos under
 * `confidential/hr/**`). Nothing in the app writes to Firebase Storage any more, and
 * storage.rules deny all writes.
 *
 * It also keeps the shared upload validation (images or PDF, max 10 MB) used by every
 * Drive upload.
 */
const firebaseStorage = getStorage(firebaseApp);

const CLAIM_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const isImage = (file: File) => file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name);

/** Returns a plain-English reason the file can't be used, or null if it's fine. */
export const validateClaimFile = (file: File): string | null => {
  if (!isPdf(file) && !isImage(file)) return file.name + ' is not a photo or PDF. Only images and PDFs can be attached.';
  if (file.size > CLAIM_ATTACHMENT_MAX_BYTES) return file.name + ' is ' + (file.size / (1024 * 1024)).toFixed(1) + ' MB. The limit is 10 MB per file.';
  return null;
};

/** Turns a Firebase Storage error into something a staff member can act on. */
export const describeStorageError = (err: unknown): string => {
  const code = String((err as { code?: string })?.code || '');
  switch (code) {
    case 'storage/unauthorized':
      return 'Permission denied by Firebase Storage. Your account is not allowed to open this older file; ask an admin to check your role in Users & Roles (the access list must show “published”).';
    case 'storage/unauthenticated':
      return 'You are not signed in to Firebase. Sign out and sign in again with your @shcolaw.com Google account, then retry.';
    case 'storage/object-not-found':
      return 'That file is no longer in storage.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
    case 'storage/no-default-bucket':
      return 'Firebase Storage is not available for this project, so this older file cannot be opened.';
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return 'The file did not load (network problem). Check your connection and try again.';
    default:
      return (err instanceof Error && err.message) || 'The file could not be opened for an unknown reason.';
  }
};

export const getClaimAttachmentUrl = (path: string) => getDownloadURL(ref(firebaseStorage, path));

/**
 * Opens an older Firebase Storage file in a new tab. The tab is opened synchronously (inside
 * the click) so popup blockers allow it, then pointed at the download URL once it resolves.
 * Returns an error message, or null on success.
 */
export async function openClaimAttachment(a: Pick<ClaimAttachment, 'path'>): Promise<string | null> {
  if (!a.path) return 'This file has no stored copy (only its name was kept).';
  const win = window.open('', '_blank');
  try {
    const url = await getClaimAttachmentUrl(a.path);
    if (win) {
      win.opener = null;
      win.location.href = url;
    }
    else window.open(url, '_blank', 'noopener');
    return null;
  } catch (err) {
    win?.close();
    return 'Could not open the file. ' + describeStorageError(err);
  }
}
