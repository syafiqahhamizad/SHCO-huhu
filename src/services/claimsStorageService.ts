import type { ClaimDocument } from '../types';

/**
 * Helpers for claim supporting documents (receipt photos, toll slips…).
 *
 * The files themselves are uploaded to the firm's Google Drive (fileStorageService
 * storeClaimReceipt → `Claims/<YYYY>/<form no.>/`) and only their metadata is kept on the
 * claim. The old per-device "claim document vault" (data URLs in localStorage under
 * SHCO_CLAIM_DOCUMENTS_VAULT_V1) was removed: nothing read it, and a copy kept in one
 * browser was lost on every other device.
 */
class ClaimsStorageService {
  /** Formats raw byte counts into human-readable size strings (KB, MB). */
  public formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /** Guesses the document type from the file name or MIME type. */
  public detectDocumentCategory(fileName: string, mimeType?: string): NonNullable<ClaimDocument['category']> {
    const lower = fileName.toLowerCase();
    if (lower.includes('toll') || lower.includes('touchngo') || lower.includes('tng') || lower.includes('rfid')) return 'Toll Slip';
    if (lower.includes('park') || lower.includes('valet') || lower.includes('autopay')) return 'Parking Voucher';
    if (lower.includes('inv') || lower.includes('bill') || lower.includes('tax') || lower.includes('voucher') || lower.includes('pv')) return 'Official Invoice';
    if (mimeType?.startsWith('image/') || lower.includes('receipt') || lower.includes('resit') || lower.includes('photo') || lower.includes('img') || lower.includes('jpg') || lower.includes('png')) return 'Receipt Photo';
    return 'Other Document';
  }
}

export const claimsStorageService = new ClaimsStorageService();
