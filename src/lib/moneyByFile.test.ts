/**
 * Money by file — the single source read by Clients › Money, Billing › Fees by file and the
 * Working File › Money tab. Synthetic records only (no real client data).
 */
import { describe, expect, it } from 'vitest';
import { billedPct, casesOfClient, feesFilter, moneyForClient, moneyForFile, sumMoney, type MoneySources } from './moneyByFile';
import type { Case, Client, Invoice, Payment, Quotation, Retainer } from '../types';

const eq = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(0.005);

const kase = (id: string, ref: string, clientId: string, status: Case['status'] = 'Active') => ({ id, ref, clientId, title: 'T ' + id, status }) as unknown as Case;
const inv = (id: string, caseId: string, total: number, extra: Partial<Invoice> = {}) => ({ id, caseId, clientId: '', total, tax: 0, amount: total, discount: 0, date: '2026-09-01', dueDate: '2026-10-01', status: 'Sent', ...extra }) as Invoice;
const pay = (invoiceId: string, amount: number): Payment => ({ id: 'P-' + invoiceId + amount, invoiceId, amount, date: '2026-09-10', method: 'FPX' });
const ret = (caseId: string, type: Retainer['type'], amount: number, date: string, clientId = 'C1'): Retainer => ({ id: 'R-' + caseId + type + amount, clientId, caseId, type, amount, date, remarks: type });
const quote = (id: string, caseId: string, total: number, status: Quotation['status'], documentType: Quotation['documentType'] = 'Quotation') => ({ id, caseId, total, status, documentType }) as Quotation;

const A = kase('CS-1', 'REF/A', 'C1');
const B = kase('CS-2', 'REF/B', 'C1');
const X = kase('CS-3', 'REF/X', 'C2');
const src: MoneySources = {
  invoices: [
    inv('INV-1', 'CS-1', 6000),
    inv('INV-2', 'CS-1', 3540),
    inv('INV-3', 'CS-1', 1000, { status: 'Draft' }), // not billed yet
    inv('INV-4', 'CS-1', 900, { status: 'Voided' }), // never counts
    inv('INV-5', '', 2000, { fileRef: 'REF/B', writtenOff: 500, depositApplied: 1000 }), // linked by fileRef
    inv('INV-6', 'CS-3', 700),
  ],
  payments: [pay('INV-1', 6000), pay('INV-5', 200), pay('INV-6', 100)],
  retainers: [ret('CS-1', 'Deposit', 4000, '2026-06-03'), ret('CS-1', 'Apply', 1000, '2026-06-08'), ret('CS-1', 'Refund', 500, '2026-06-12'), ret('', 'Deposit', 300, '2026-06-20')],
  quotations: [
    quote('Q-1', 'CS-1', 18000, 'Accepted'),
    quote('Q-2', 'CS-1', 25000, 'Sent'), // ignored: an accepted quotation exists
    quote('Q-3', 'CS-2', 4000, 'Sent'),
    quote('Q-4', 'CS-2', 9999, 'Declined'),
    quote('Q-5', 'CS-2', 1500, 'Sent', 'Proforma'),
  ],
};

describe('one file', () => {
  const a = moneyForFile(A, src);
  it('agreed = accepted quotation', () => eq(a.agreed, 18000));
  it('billed = issued invoices only (no drafts, no voided)', () => eq(a.billed, 9540));
  it('received = payments', () => eq(a.received, 6000));
  it('outstanding = billed − received', () => eq(a.outstanding, 3540));
  it('client account = deposits − applied − refunds', () => eq(a.clientAccount, 2500));
  it('ledger runs oldest first', () => expect(a.clientLedger.map((l) => l.bal)).toEqual([4000, 3000, 2500]));
  it('draft listed but not issued', () => expect(a.bills.find((b) => b.id === 'INV-3')?.issued).toBe(false));
  it('voided left out', () => expect(a.bills.some((b) => b.id === 'INV-4')).toBe(false));
});

describe('write-off and proforma deposit (same rule as owedBalance)', () => {
  const b = moneyForFile(B, src);
  it('agreed falls back to quotations not declined, proformas excluded', () => eq(b.agreed, 4000));
  it('received includes the deposit applied', () => eq(b.received, 1200));
  it('outstanding deducts written off', () => eq(b.outstanding, 300));
  it('written off tracked', () => eq(b.writtenOff, 500));
});

describe('per client', () => {
  const client = { id: 'C1', name: 'Client One' } as Client;
  const files = casesOfClient(client, [A, B, X]);
  const m = moneyForClient(client, [A, B, X], src);
  it('files of the client', () => expect(files.map((f) => f.id)).toEqual(['CS-1', 'CS-2']));
  it('totals = sum of its files', () => {
    const s = sumMoney(m.files);
    eq(m.billed, s.billed); eq(m.received, s.received); eq(m.outstanding, s.outstanding); eq(m.agreed, 22000);
  });
  it('client account includes entries with no file', () => eq(m.clientAccount, 2800));
  it('bills newest first, other clients excluded', () => expect(m.bills.some((b) => b.id === 'INV-6')).toBe(false));
});

describe('Fees by file filters', () => {
  it('Owing', () => { expect(feesFilter('Owing', { agreed: 1, billed: 10, outstanding: 5 })).toBe(true); expect(feesFilter('Owing', { agreed: 1, billed: 10, outstanding: 0 })).toBe(false); });
  it('Not billed = billed < 25% of agreed', () => { expect(feesFilter('Not billed', { agreed: 10000, billed: 2499, outstanding: 0 })).toBe(true); expect(feesFilter('Not billed', { agreed: 10000, billed: 2500, outstanding: 0 })).toBe(false); });
  it('nothing agreed is never "not billed"', () => expect(feesFilter('Not billed', { agreed: 0, billed: 0, outstanding: 0 })).toBe(false));
  it('billed % capped for the bar', () => { expect(billedPct({ agreed: 18000, billed: 9540 })).toBe(53); expect(billedPct({ agreed: 100, billed: 300 })).toBe(100); expect(billedPct({ agreed: 0, billed: 5 })).toBe(0); });
});
