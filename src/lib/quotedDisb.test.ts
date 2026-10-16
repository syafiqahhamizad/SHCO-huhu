import { describe, expect, it } from 'vitest';
import { quotedDisbursements } from './quotedDisb';
import type { Expense, Invoice, Quotation } from '../types';

const c = { id: 'K1', ref: 'SHC/CORP/SZ/002/04-25' };
const quote = { id: 'QT-1', documentType: 'Quotation', status: 'Accepted', caseId: 'K1', lineItems: [
  { description: 'Legal fees', category: 'Fee - Fixed', amount: 5000 },
  { description: 'Bankruptcy search', category: 'Disbursement', amount: 10 },
  { description: 'SSM search', category: 'Disbursement', amount: 30 },
] } as unknown as Quotation;
const cost = (id: string, amount: number, quoteLine?: string) => ({ id, caseId: 'K1', category: 'Disbursement', amount, quoteLine } as unknown as Expense);

describe('quotedDisbursements', () => {
  it('matches costs to quoted items and shows what is left or over', () => {
    const q = quotedDisbursements(c, [quote], [], [cost('DISB-1', 10, 'Bankruptcy search'), cost('DISB-2', 35, 'SSM search'), cost('DISB-3', 12)]);
    expect(q.rows).toEqual([
      { desc: 'Bankruptcy search', quoted: 10, paid: 10, left: 0 },
      { desc: 'SSM search', quoted: 30, paid: 35, left: -5 },
    ]);
    expect(q.extras.map((e) => e.id)).toEqual(['DISB-3']);
    expect(q.quoted).toBe(40);
    expect(q.left).toBe(-5);
  });
  it('a cost not listed still counts against the quoted total', () => {
    const q = quotedDisbursements(c, [quote], [], [cost('DISB-1', 25, 'Other cost (not listed)')]);
    expect(q.rows.at(-1)).toEqual({ desc: 'Other cost (not listed)', quoted: 0, paid: 25, left: -25 });
    expect(q.left).toBe(15);
  });
  it('a past invoice with one total shows "Disbursements (as quoted)"', () => {
    const inv = { id: 'IV-250001', status: 'Unpaid', caseId: 'K1', lineItems: [{ description: 'Disbursements', category: 'Disbursement', amount: 500 }] } as unknown as Invoice;
    const q = quotedDisbursements(c, [], [inv], [cost('DISB-1', 120, 'Disbursements (as quoted)')]);
    expect(q.rows).toEqual([{ desc: 'Disbursements (as quoted)', quoted: 500, paid: 120, left: 380 }]);
  });
});
