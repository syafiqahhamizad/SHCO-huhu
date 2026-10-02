/**
 * Finance formula checks (pure, no browser / Firebase). Formerly src/lib/finance.check.ts.
 * Time zone is pinned to Asia/Kuala_Lumpur by vitest.config.ts.
 */
import { describe, expect, it } from 'vitest';
import { computeTotals, splitSst } from './billingEngine';
import { claimFormTotal, inPeriod, invoiceComposition, localIso, monthsCovered, needsTwoSignatories, parseDate, round2, splitReceipt } from './financeCalc';
import type { QuotationLineItem } from '../types';

/** Same comparison the old check script used: numbers within 0.005, everything else strictly equal. */
const eq = (got: unknown, want: unknown) => {
  if (typeof want === 'number') expect(Math.abs(Number(got) - want)).toBeLessThan(0.005);
  else expect(got).toBe(want);
};
const li = (category: QuotationLineItem['category'] | 'Tax', amount: number) => ({ description: category, category, amount, quantity: 1, unitPrice: amount, chargeType: 'Fixed' as const }) as QuotationLineItem;

describe('1. invoice with a proforma deposit applied', () => {
  const items = [li('Fee - Fixed', 10000), li('Disbursement', 500), li('Reimbursement', 300)];
  const t = computeTotals(items, true, 0.08); // SST 0.08 × 10300 = 824
  const deposit = round2(10000 / 2); // proforma 50% retainer, paid to the office account
  const inv = { lineItems: items, total: t.grandTotal, tax: t.sst, depositApplied: deposit };
  const balance = round2(inv.total - inv.depositApplied - 0 /* paid */);

  it('invoice total', () => eq(t.grandTotal, 11624));
  it('balance after deposit', () => eq(balance, 6624));
  it('AR after issue = balance', () => {
    // GL: Dr AR 11624 (fees 10300 / disb 500 / SST 824), then Dr 2110 / Cr AR 5000 → AR = balance
    const ar = round2((t.fees + t.reimbursements) + t.disbursements + t.sst - deposit);
    eq(ar, balance);
  });
  it('deposit split adds up', () => {
    // The deposit is fee money: its fee-income share is counted once, when applied.
    const sp = splitReceipt(deposit, invoiceComposition(inv));
    eq(round2(sp.income + sp.sst + sp.disb), deposit);
  });
});

describe('2. SST rounding consistency: fees 1000.05 + reimbursements 10.05 @ 8%', () => {
  const items = [li('Fee - Fixed', 1000.05), li('Reimbursement', 10.05)];
  const t = computeTotals(items, true, 0.08);
  const s = splitSst(1000.05, 10.05, 0.08);

  it('SST rounded once', () => eq(t.sst, 80.81)); // 1010.10 × 0.08 = 80.808
  it('printed lines sum to stored SST', () => eq(round2(s.sstFees + s.sstReimbursements), t.sst));
  it('SST on fees line', () => eq(s.sstFees, 80.0));
  it('SST on reimbursements line (takes the rounding)', () => eq(s.sstReimbursements, 0.81));
  it('grand total', () => eq(t.grandTotal, 1090.91));
  it('Tax line ignored (fees)', () => {
    // Old invoices with a Tax line: never charged again / never a fee.
    const old = invoiceComposition({ lineItems: [...items, li('Tax', 80.81)], total: 1090.91, tax: 80.81 });
    eq(old.fees, 1000.05);
  });
});

describe('3. disbursement flow nets to zero in the P&L', () => {
  // pay RM 200 filing fee: Dr 1200 / Cr bank; invoice: Dr 1100 / Cr 1200; client pays: Dr bank / Cr 1100
  const gl: [string, string, number][] = [['1200', '1014', 200], ['1100', '1200', 200], ['1014', '1100', 200]];
  const bal = new Map<string, number>();
  gl.forEach(([d, c, a]) => { bal.set(d, (bal.get(d) || 0) + a); bal.set(c, (bal.get(c) || 0) - a); });
  const pl = [...bal.entries()].filter(([k]) => /^[45]/.test(k)).reduce((s, [, v]) => s + v, 0);

  it('disbursement P&L effect', () => eq(pl, 0));
  it('1200 cleared', () => eq(bal.get('1200') || 0, 0));
});

describe('4. fee income excludes SST and disbursements', () => {
  const items = [li('Fee - Fixed', 1000), li('Reimbursement', 100), li('Disbursement', 300)];
  const t = computeTotals(items, true, 0.08); // SST 88, total 1488
  const c = invoiceComposition({ lineItems: items, total: t.grandTotal, tax: t.sst });
  const full = splitReceipt(t.grandTotal, c);
  const half = splitReceipt(744, c);

  it('fee income on full payment', () => eq(full.income, 1100));
  it('SST collected', () => eq(full.sst, 88));
  it('disbursement recovered', () => eq(full.disb, 300));
  it('fee income on half payment', () => eq(half.income, 550));
  it('zero-total invoice guarded', () => eq(splitReceipt(50, { fees: 0, reimb: 0, disb: 0, sst: 0, total: 0 }).income, 50));
});

describe('5. local-date bucketing: 07:30 MYT on the 1st is 23:30 UTC the day before', () => {
  const iso = '2026-09-30T23:30:00.000Z'; // = 1 Oct 2026 07:30 Malaysia

  it('local day', () => eq(localIso(iso), '2026-10-01'));
  it('in October', () => eq(inPeriod(iso, '2026-10'), true));
  it('not in September', () => eq(inPeriod(iso, '2026-09'), false));
  it('plain date untouched', () => eq(localIso('2026-09-30'), '2026-09-30'));
  it('dd.mm.yyyy', () => eq(localIso('01.10.2026'), '2026-10-01'));
  it('parseDate local midnight', () => eq(new Date(parseDate(iso)).getHours(), 0));
});

describe('6. claim-form threshold aggregation (MP + 1 at RM 5,000 and above, per FORM)', () => {
  const items = [
    { id: 'TC-1', formNo: 'CF-26-0001', amount: 3000 },
    { id: 'EX-1', formNo: 'CF-26-0001', amount: 2000 },
    { id: 'EX-2', formNo: 'CF-26-0001', amount: 900, rejected: true },
    { id: 'EX-3', formNo: 'CF-26-0002', amount: 4999.99 },
  ];
  const f1 = claimFormTotal(items, 'CF-26-0001', 3000);

  it('form total (rejected excluded)', () => eq(f1, 5000));
  it('item under limit but form at limit → MP + 1', () => eq(needsTwoSignatories(f1, 5000), true));
  it('form below limit → any partner', () => eq(needsTwoSignatories(claimFormTotal(items, 'CF-26-0002', 4999.99), 5000), false));
  it('no form → the item itself', () => eq(claimFormTotal(items, undefined, 1200), 1200));
  it('client account always MP + 1', () => eq(needsTwoSignatories(10, 5000, true), true));
});

describe('7. runway with annual commitments', () => {
  const commitments = [{ amount: 10000, frequency: 'Monthly' }, { amount: 24000, frequency: 'Annual' }];

  it('months covered (monthly + annual/12)', () => eq(monthsCovered(36000, commitments)!, 3));
  it('no commitments → —', () => eq(monthsCovered(36000, []), null));
  it('annual only', () => eq(monthsCovered(12000, [{ amount: 12000, frequency: 'Annual' }])!, 12));
});
