import { Invoice } from '../types';

export interface EInvoiceSubmissionResult {
  status: 'Validated';
  uuid: string;
  qrUrl: string;
  submittedAt: string;
}

/** Temporary local adapter until a server-side MyInvois credential flow is available. */
export async function submitInvoiceToMyInvois(invoice: Invoice): Promise<EInvoiceSubmissionResult> {
  if (!invoice.total || invoice.total <= 0) {
    throw new Error('An invoice with a positive total is required.');
  }

  const submittedAt = new Date().toISOString();
  return {
    status: 'Validated',
    uuid: `MOCK-${invoice.id}-${Date.now()}`,
    qrUrl: `data:text/plain;charset=utf-8,MOCK-MYINVOIS-${invoice.id}`,
    submittedAt,
  };
}