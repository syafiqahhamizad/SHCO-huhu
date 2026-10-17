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
    expect(j.path).toEqual(['Books', 'Waiting approval', 'Office Account']);
    expect(j.name).toBe('20102026 TC-0005 FB-004 Mileage RM45');
    expect(j.papers.map((p) => p.name)).toEqual(['1 Receipt - toll.pdf', '2 Receipt - parking.jpg']);
    expect(j.matter?.ref).toBe(REF);
  });
  it('paid → the month it was paid, Money Out, with the payment proof; rejected → Rejected', () => {
    const j = filingFor('travel', claim({ approvalStatus: 'Approved', paidAt: '2026-11-03T08:00:00Z', paidProof: { name: 'transfer.pdf', uploadedAt: '', driveFileId: 'f3' }, driveFiling: { key: 'old', folderId: 'F9' } }), ctx)!;
    expect(j.path).toEqual(['Books', '2026', 'Money Out', 'Office Account', '2026-11 November']);
    expect(j.name).toBe('03112026 TC-0005 FB-004 Mileage RM45');
    expect(j.papers.at(-1)?.name).toBe('Payment proof.pdf');
    expect(j.folderId).toBe('F9');
    expect(filingFor('travel', claim({ approvalStatus: 'Rejected' }), ctx)!.path).toEqual(['Books', 'Rejected', 'Office Account']);
  });
  it('already filed there → nothing to do; before April 2025 or nothing on Drive → left alone', () => {
    const j = filingFor('travel', claim(), ctx)!;
    expect(filingFor('travel', claim({ driveFiling: { key: j.key, folderId: 'F1' } }), ctx)).toBeNull();
    expect(filingFor('travel', claim({ date: '2025-03-31' }), ctx)).toBeNull();
    expect(filingFor('travel', claim({ attachments: [{ name: 'x.pdf' }] }), ctx)).toBeNull();
  });
  it('vouchers: disbursements in the Disbursement account, statutory and drawings in Payroll, client money in Client Account', () => {
    const pv = (p: Partial<PaymentVoucher>): PaymentVoucher => ({ id: 'HQ-PV-0012', date: '2026-10-15', accountSet: 'OFFICE', voucherCategory: 'Disbursement', description: 'Stamp duty', amount: 800, fileRef: REF, approvalStatus: 'Posted to GL', paidAt: '2026-10-15T00:00:00Z', attachments: [{ name: 'lhdn.pdf', driveFileId: 'p1' }], ...p } as PaymentVoucher);
    expect(filingFor('pv', pv({}), ctx)!.path).toEqual(['Books', '2026', 'Money Out', 'Disbursement Account', '2026-10 October']);
    expect(filingFor('pv', pv({}), ctx)!.name).toBe('15102026 PV-0012 FB-004 Stamp duty RM800');
    expect(filingFor('pv', pv({ voucherCategory: 'Statutory (EPF/SOCSO/EIS/PCB)' as PaymentVoucher['voucherCategory'], fileRef: '', description: 'EPF SOCSO EIS PCB October' }), ctx)!.path).toEqual(['Books', '2026', 'Payroll', '2026-10 October', 'Statutory']);
    expect(filingFor('pv', pv({ voucherCategory: 'Partner drawings' as PaymentVoucher['voucherCategory'], fileRef: '' }), ctx)!.path.at(-1)).toBe('Partner Drawings');
    expect(filingFor('pv', pv({ accountSet: 'CLIENT', voucherCategory: 'Client Account' as PaymentVoucher['voucherCategory'], description: 'Balance purchase price' }), ctx)!.path).toEqual(['Books', '2026', 'Money Out', 'Client Account', '2026-10 October']);
    expect(filingFor('pv', pv({ approvalStatus: 'Pending Approval', paidAt: undefined, voucherCategory: 'Office Operating' }), ctx)!.path).toEqual(['Books', 'Waiting approval', 'Office Account']);
  });
  it('receipts go to Money In; office expenses to Money Out (petty cash by its own account)', () => {
    const r = { id: 'HQ-OR-0003', date: '2026-10-14', accountSet: 'OFFICE', receivedFrom: 'Siti', description: 'Legal fees', amount: 3000, fileRef: REF, proofs: [{ name: 'slip.png', uploadedAt: '', driveFileId: 'r1' }] } as Receipt;
    const j = filingFor('receipt', r, ctx)!;
    expect(j.path).toEqual(['Books', '2026', 'Money In', 'Office Account', '2026-10 October']);
    expect(j.name).toBe('14102026 OR-0003 FB-004 Legal fees RM3,000');
    expect(j.papers[0].name).toBe('1 Bank-in slip - slip.png');
    expect(filingFor('receipt', { ...r, accountSet: 'CLIENT', description: 'Deposit' } as Receipt, ctx)!.path).toEqual(['Books', '2026', 'Money In', 'Client Account', '2026-10 October']);
    const e = { id: 'EX-0001', caseId: '', date: '2026-10-02', category: 'Rent', amount: 2500, billable: false, description: 'Rent October', paidFrom: 'Petty cash', approvalStatus: 'Posted to GL', paidProof: { name: 'rent.pdf', uploadedAt: '', driveFileId: 'e1' } } as Expense;
    expect(filingFor('expense', e, ctx)!.path).toEqual(['Books', '2026', 'Money Out', 'Petty Cash', '2026-10 October']);
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
  it('a claim form with several items is one folder, named after the form', () => {
    const item = (id: string, amount: number, file: string, p: Partial<Expense> = {}) => ({ id, caseId: '', date: '2026-10-14', category: 'Despatch', amount, billable: false, description: 'Runner', claimant: 'Zulaikha Afendi', formNo: 'CF-26-0001', approvalStatus: 'Pending Approval', attachments: [{ name: file, driveFileId: 'd-' + id }], ...p } as Expense);
    const lists = { travel: [], expense: [item('EX-0002', 100, 'document.pdf'), item('EX-0003', 50, 'COF SD.pdf'), item('EX-0004', 30, 'Runner.pdf')], pv: [], receipt: [] };
    const j = nextFilingJob(lists, ctx, new Set())!;
    expect(j.unit).toBe('form:CF-26-0001');
    expect(j.path).toEqual(['Books', 'Waiting approval', 'Office Account']);
    expect(j.name).toBe('14102026 CF-26-0001 Zulaikha Afendi RM180');
    expect(j.papers.map((p) => p.name)).toEqual(['1 EX-0002 Receipt - document.pdf', '2 EX-0003 Receipt - COF SD.pdf', '3 EX-0004 Receipt - Runner.pdf']);
    expect(j.recs?.map((r) => r.recId)).toEqual(['EX-0002', 'EX-0003', 'EX-0004']);
    // One item rejected, the other two paid → the form goes to the month paid, total of the paid items.
    const paid = { approvalStatus: 'Approved' as const, paidAt: '2026-10-20T00:00:00Z', paidProof: { name: 'trf.pdf', uploadedAt: '', driveFileId: 'pp' } };
    const j2 = nextFilingJob({ ...lists, expense: [item('EX-0002', 100, 'document.pdf', paid), item('EX-0003', 50, 'COF SD.pdf', { approvalStatus: 'Rejected' }), item('EX-0004', 30, 'Runner.pdf', paid)] }, ctx, new Set())!;
    expect(j2.path).toEqual(['Books', '2026', 'Money Out', 'Office Account', '2026-10 October']);
    expect(j2.name).toBe('20102026 CF-26-0001 Zulaikha Afendi RM130');
    expect(j2.papers.map((p) => p.name)).toContain('Payment proof EX-0004.pdf');
    // Each item gets only its own papers written back.
    const patch = applyFiled(lists.expense[1], j, { folderId: 'F', papers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, 'expense');
    expect(patch.attachments?.[0].driveFileId).toBe('b');
  });
});
