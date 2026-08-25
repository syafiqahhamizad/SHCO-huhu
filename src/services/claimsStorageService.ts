import { ClaimDocument, TravelClaim, Expense, PaymentVoucher } from '../types';

const STORAGE_VAULT_KEY = 'SHCO_CLAIM_DOCUMENTS_VAULT_V1';

export interface StorageVaultSchema {
  [claimId: string]: ClaimDocument[];
}

/**
 * Claims Storage Service
 * Manages claim document references, receipt photos, toll slips, and supporting attachments.
 * Handles persistent storage, metadata extraction, document indexing, and retrieval.
 */
class ClaimsStorageService {
  private getVault(): StorageVaultSchema {
    try {
      const saved = localStorage.getItem(STORAGE_VAULT_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to read claims document storage vault:', e);
      return {};
    }
  }

  private saveVault(vault: StorageVaultSchema): void {
    try {
      localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(vault));
    } catch (e) {
      console.error('Failed to save to claims document storage vault:', e);
    }
  }

  /**
   * Formats raw byte counts into human-readable size strings (KB, MB).
   */
  public formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Helper to detect or categorize document types based on file name or MIME type.
   */
  public detectDocumentCategory(fileName: string, mimeType?: string): 'Receipt Photo' | 'Toll Slip' | 'Parking Voucher' | 'Official Invoice' | 'Other Document' {
    const lower = fileName.toLowerCase();
    if (lower.includes('toll') || lower.includes('touchngo') || lower.includes('tng') || lower.includes('rfid')) {
      return 'Toll Slip';
    }
    if (lower.includes('park') || lower.includes('valet') || lower.includes('autopay')) {
      return 'Parking Voucher';
    }
    if (lower.includes('inv') || lower.includes('bill') || lower.includes('tax') || lower.includes('voucher') || lower.includes('pv')) {
      return 'Official Invoice';
    }
    if (mimeType?.startsWith('image/') || lower.includes('receipt') || lower.includes('resit') || lower.includes('photo') || lower.includes('img') || lower.includes('jpg') || lower.includes('png')) {
      return 'Receipt Photo';
    }
    return 'Other Document';
  }

  /**
   * Saves or attaches a supporting document reference to a specific claim ID.
   */
  public addDocumentToClaim(
    claimId: string,
    fileData: {
      name: string;
      url: string;
      type?: string;
      category?: 'Receipt Photo' | 'Toll Slip' | 'Parking Voucher' | 'Official Invoice' | 'Other Document';
      size?: number;
    }
  ): ClaimDocument {
    const vault = this.getVault();
    const existing = vault[claimId] || [];

    const category = fileData.category || this.detectDocumentCategory(fileData.name, fileData.type);

    const newDoc: ClaimDocument = {
      id: `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: fileData.name,
      url: fileData.url,
      type: fileData.type || 'image/png',
      category,
      size: fileData.size || Math.round((fileData.url.length * 3) / 4),
      uploadedAt: new Date().toISOString(),
    };

    vault[claimId] = [newDoc, ...existing];
    this.saveVault(vault);
    return newDoc;
  }

  /**
   * Gets all attached document references for a given claim ID.
   */
  public getClaimDocuments(claimId: string): ClaimDocument[] {
    const vault = this.getVault();
    return vault[claimId] || [];
  }

  /**
   * Sets or overwrites the complete list of attached documents for a claim ID.
   */
  public setClaimDocuments(claimId: string, docs: ClaimDocument[]): void {
    const vault = this.getVault();
    vault[claimId] = docs;
    this.saveVault(vault);
  }

  /**
   * Removes a specific document reference from a claim ID.
   */
  public removeDocumentFromClaim(claimId: string, docId: string): void {
    const vault = this.getVault();
    if (!vault[claimId]) return;

    vault[claimId] = vault[claimId].filter((d) => d.id !== docId);
    if (vault[claimId].length === 0) {
      delete vault[claimId];
    }
    this.saveVault(vault);
  }

  /**
   * Synchronizes document references from a claim object into the document vault.
   */
  public syncClaimAttachments<T extends TravelClaim | Expense | PaymentVoucher>(claim: T): T {
    if (!claim.id) return claim;

    const vaultDocs = this.getClaimDocuments(claim.id);
    let updatedDocs = [...vaultDocs];

    // If the claim has a primary attachmentName/attachmentUrl not yet in vault, index it
    if (claim.attachmentName && claim.attachmentUrl) {
      const exists = updatedDocs.some((d) => d.name === claim.attachmentName || d.url === claim.attachmentUrl);
      if (!exists) {
        const primaryDoc = this.addDocumentToClaim(claim.id, {
          name: claim.attachmentName,
          url: claim.attachmentUrl,
        });
        updatedDocs = [primaryDoc, ...updatedDocs];
      }
    }

    // Attach documents array to the claim
    return {
      ...claim,
      documents: updatedDocs,
    };
  }

  /**
   * Process a File drop/selection event and convert it into a data URL & metadata.
   */
  public async processFileForClaim(file: File): Promise<{
    name: string;
    url: string;
    type: string;
    category: 'Receipt Photo' | 'Toll Slip' | 'Parking Voucher' | 'Official Invoice' | 'Other Document';
    size: number;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        resolve({
          name: file.name,
          url,
          type: file.type,
          category: this.detectDocumentCategory(file.name, file.type),
          size: file.size,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}

export const claimsStorageService = new ClaimsStorageService();
