import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { firebaseApp } from './firebaseAuthService';
import type { ClaimAttachment } from '../types';
import { emailToAccessKey } from './accessListService';

/**
 * Firebase Storage for claim / payment-request receipts.
 *
 * Uses the default bucket of the already-initialised Firebase app
 * (firebaseConfig.storageBucket in firebaseAuthService.ts). Files live under
 * `confidential/**`, which storage.rules limits to signed-in firm staff.
 */
export const firebaseStorage = getStorage(firebaseApp);

export const CLAIM_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const isImage = (file: File) => file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name);

/** Returns a plain-English reason the file can't be used, or null if it's fine. */
export const validateClaimFile = (file: File): string | null => {
  if (!isPdf(file) && !isImage(file)) return file.name + ' is not a photo or PDF. Only images and PDFs can be attached.';
  if (file.size > CLAIM_ATTACHMENT_MAX_BYTES) return file.name + ' is ' + (file.size / (1024 * 1024)).toFixed(1) + ' MB. The limit is 10 MB per file.';
  return null;
};

const safeFileName = (name: string) =>
  (name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-120) || 'file';

const safeSegment = (s: string) => String(s || 'unknown').replace(/[^\w\-]+/g, '_');

/** Turns a Firebase Storage error into something a staff member can act on. */
export const describeStorageError = (err: unknown): string => {
  const code = String((err as { code?: string })?.code || '');
  switch (code) {
    case 'storage/unauthorized':
      return 'Permission denied by Firebase Storage. Your account is not allowed to open or store this file; ask the Managing Partner to check your role in Users & Roles (the access list must show “published”).';
    case 'storage/unauthenticated':
      return 'You are not signed in to Firebase. Sign out and sign in again with your @shcolaw.com Google account, then retry.';
    case 'storage/object-not-found':
      return 'That file is no longer in storage.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
    case 'storage/no-default-bucket':
      return 'Firebase Storage is not set up for this project yet. Ask the admin to enable Storage in the Firebase console.';
    case 'storage/quota-exceeded':
      return 'Firebase Storage quota exceeded. Ask the admin to check the Firebase plan.';
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return 'The upload did not finish (network problem). Check your connection and try again.';
    default:
      return (err instanceof Error && err.message) || 'Upload failed for an unknown reason.';
  }
};

/**
 * Uploads one receipt to `confidential/claims/{userId}/{recordId}/{timestamp}-{safeFileName}`.
 * Throws (with a readable message) if validation or the upload fails.
 */
export async function uploadClaimAttachment(userId: string, recordId: string, file: File): Promise<ClaimAttachment> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  const contentType = file.type || (isPdf(file) ? 'application/pdf' : 'application/octet-stream');
  const path = 'confidential/claims/' + safeSegment(userId) + '/' + safeSegment(recordId) + '/' + Date.now() + '-' + safeFileName(file.name);
  try {
    const result = await uploadBytes(ref(firebaseStorage, path), file, { contentType, customMetadata: { originalName: file.name } });
    return { name: file.name, path: result.metadata.fullPath, size: file.size, contentType };
  } catch (err) {
    throw new Error(file.name + ': ' + describeStorageError(err));
  }
}

/**
 * Uploads one HR document (or staff photo) to
 * `confidential/hr/{emailKey}/{timestamp}-{safeFileName}`, where emailKey is the staff
 * member's access-list key (lowercase email, '.' → ','). storage.rules match that folder to
 * the signed-in person, so they can read their own files; the owner and admins read/write
 * everyone's. (Older files under `confidential/hr/{userId}/` stay readable by admins.)
 * Same rules as claim receipts: images or PDF, max 10 MB. Returns the stored path.
 */
export async function uploadHrFile(staffEmail: string, file: File): Promise<{ name: string; path: string }> {
  const problem = validateClaimFile(file);
  if (problem) throw new Error(problem);
  if (!staffEmail || !staffEmail.includes('@')) throw new Error('This staff member has no email on file, so their HR files cannot be stored yet.');
  const contentType = file.type || (isPdf(file) ? 'application/pdf' : 'application/octet-stream');
  const path = 'confidential/hr/' + emailToAccessKey(staffEmail) + '/' + Date.now() + '-' + safeFileName(file.name);
  try {
    const result = await uploadBytes(ref(firebaseStorage, path), file, { contentType, customMetadata: { originalName: file.name } });
    return { name: file.name, path: result.metadata.fullPath };
  } catch (err) {
    throw new Error(file.name + ': ' + describeStorageError(err));
  }
}

export const getClaimAttachmentUrl =(path: string) => getDownloadURL(ref(firebaseStorage, path));

/**
 * Opens a stored file in a new tab. The tab is opened synchronously (inside the click)
 * so popup blockers allow it, then pointed at the download URL once it resolves.
 * Returns an error message, or null on success.
 */
export async function openClaimAttachment(a: Pick<ClaimAttachment, 'path'>): Promise<string | null> {
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
