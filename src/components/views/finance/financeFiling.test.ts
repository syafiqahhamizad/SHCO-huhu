import { describe, expect, it } from 'vitest';
import type { Expense, PaymentVoucher, Receipt, TravelClaim } from '../../../types';
import { applyFiled, filingFor, nextFilingJob } from './financeFiling';

const ctx = { from: '2025-04', matterOf: (_c?: string, ref?: string) => (ref ? { ref, title: 'Shamsur v FB Fastaqim Buildings' } : undefined) };
const REF = 'SHC/SH/AH/L/FB/004/07-25';
const claim = (p: Partial<TravelClaim> = {}): TravelClaim => ({
  id: 'TC-0005', date: '2026-10-20', claimant: 'Amer Haiqal', fileRef: REF, type: 'Mileage', purpose: 'Mileage', total: 45, paidFrom: '',
  approvalStatus: 'Pending Approval', attachments: [{ name: 'toll.pdf', driveFileId: 'f1' }, { name: 'parking.jpg', driveFileId: 'f2' }], ...p,
} as TravelClaim);

describe('finance filing', () => {
  it('a submitted claim waits in Office Account › Pending, with a link in its client file', () => {
    const j = filingFor('travel', claim(), ctx)!;
    expect(j.path).toEqual(['1 Books', 'Office Account', 'Pending']);
    expect(j.name).toBe('20102026 TC-0005 FB-004 Mileage RM45');
    expect(j.papers.map((p) => p.name)).toEqual(['1 Receipt - toll.pdf', '2 Receipt - parking.jpg']);
    expect(j.matter?.ref).toBe(REF);
  });
  it('paid → the month it was paid, Money Out, with the payment proof; rejected → Rejected', () => {
    const j = filingFor('travel', claim({ approvalStatus: 'Approved', paidAt: '2026-11-03T08:00:00Z', paidProof: { name: 'transfer.pdf', uploadedAt: '', driveFileId: 'f3' }, driveFiling: { key: 'old', folderId: 'F9' } }), ctx)!;
    expect(j.path).toEqual(['1 Books', 'Office Account', '2026', '2026-11 November', 'Money Out']);
    expect(j.name).toBe('03112026 TC-0005 FB-004 Mileage RM45');
    expect(j.papers.at(-1)?.name).toBe('Payment proof.pdf');
    expect(j.folderId).toBe('F9');
    expect(filingFor('travel', claim({ approvalStatus: 'Rejected' }), ctx)!.path).toEqual(['1 Books', 'Office Account', 'Rejected']);
  });
  it('already filed there → nothing to do; before April 2025 or nothing on Drive → left alone', () => {
    const j = filingFor('travel', claim(), ctx)!;
    expect(filingFor('travel', claim({ driveFiling: { key: j.key, folderId: 'F1' } }), ctx)).toBeNull();
    expect(filingFor('travel', claim({ date: '2025-03-31' }), ctx)).toBeNull();
    expect(filingFor('travel', claim({ attachments: [{ name: 'x.pdf' }] }), ctx)).toBeNull();
  });
  it('vouchers: disbursements in the Disbursement account, statutory and drawings in Payroll, client account not yet', () => {
    const pv = (p: Partial<PaymentVoucher>): PaymentVoucher => ({ id: 'HQ-PV-0012', date: '2026-10-15', accountSet: 'OFFICE', voucherCategory: 'Disbursement', description: 'Stamp duty', amount: 800, fileRef: REF, approvalStatus: 'Posted to GL', paidAt: '2026-10-15T00:00:00Z', attachments: [{ name: 'lhdn.pdf', driveFileId: 'p1' }], ...p } as PaymentVoucher);
    expect(filingFor('pv', pv({}), ctx)!.path).toEqual(['1 Books', 'Disbursement Account', '2026', '2026-10 October', 'Money Out']);
    expect(filingFor('pv', pv({}), ctx)!.name).toBe('15102026 PV-0012 FB-004 Stamp duty RM800');
    expect(filingFor('pv', pv({ voucherCategory: 'Statutory (EPF/SOCSO/EIS/PCB)' as PaymentVoucher['voucherCategory'], fileRef: '', description: 'EPF SOCSO EIS PCB October' }), ctx)!.path).toEqual(['3 Payroll', '2026', '2026-10 October', 'Statutory']);
    expect(filingFor('pv', pv({ voucherCategory: 'Partner drawings' as PaymentVoucher['voucherCategory'], fileRef: '' }), ctx)!.path.at(-1)).toBe('Partner Drawings');
    expect(filingFor('pv', pv({ accountSet: 'CLIENT' }), ctx)).toBeNull();
    expect(filingFor('pv', pv({ approvalStatus: 'Pending Approval', paidAt: undefined, voucherCategory: 'Office Operating' }), ctx)!.path).toEqual(['1 Books', 'Office Account', 'Pending']);
  });
  it('receipts go to Money In; office expenses to Money Out (petty cash by its own account)', () => {
    const r = { id: 'HQ-OR-0003', date: '2026-10-14', accountSet: 'OFFICE', receivedFrom: 'Siti', description: 'Legal fees', amount: 3000, fileRef: REF, proofs: [{ name: 'slip.png', uploadedAt: '', driveFileId: 'r1' }] } as Receipt;
    const j = filingFor('receipt', r, ctx)!;
    expect(j.path).toEqual(['1 Books', 'Office Account', '2026', '2026-10 October', 'Money In']);
    expect(j.name).toBe('14102026 OR-0003 FB-004 Legal fees RM3,000');
    expect(j.papers[0].name).toBe('1 Bank-in slip - slip.png');
    const e = { id: 'EX-0001', caseId: '', date: '2026-10-02', category: 'Rent', amount: 2500, billable: false, description: 'Rent October', paidFrom: 'Petty cash', approvalStatus: 'Posted to GL', paidProof: { name: 'rent.pdf', uploadedAt: '', driveFileId: 'e1' } } as Expense;
    expect(filingFor('expense', e, ctx)!.path).toEqual(['1 Books', 'Petty Cash', '2026', '2026-10 October', 'Money Out']);
    expect(filingFor('expense', e, ctx)!.name).toBe('02102026 EX-0001 Rent October RM2,500');
  });
  it('one at a time, oldest first, skipping ones that failed', () => {
    const lists = { travel: [claim()], expense: [], pv: [], receipt: [] };
    expect(nextFilingJob(lists, ctx, new Set())?.recId).toBe('TC-0005');
    expect(nextFilingJob(lists, ctx, new Set(['travel:TC-0005']))).toBeNull();
  });
  it('writes moved / copied files back onto the record', () => {
    const c = claim();
    const j = filingFor('travel', c, ctx)!;
    const patch = applyFiled(c, j, { folderId: 'F1', papers: [{ id: 'n1', webViewLink: 'L1' }, { id: 'f2' }] });
    expect(patch.driveFiling).toEqual({ key: j.key, folderId: 'F1' });
    expect(patch.attachments?.[0]).toMatchObject({ driveFileId: 'n1', webViewLink: 'L1', driveFolderId: 'F1' });
    expect(patch.attachments?.[1]).toMatchObject({ driveFileId: 'f2', driveFolderId: 'F1' });
  });
});
