import { describe, expect, it } from 'vitest';
import { fundBalance, investmentSummary, splitFee } from './officeFunds';

describe('fundBalance / investmentSummary', () => {
  it('withdrawals reduce, value changes may be negative', () => {
    expect(fundBalance([{ kind: 'Deposit', amount: 5000 }, { kind: 'Withdrawal', amount: 1200 }, { kind: 'Value change', amount: -50 }])).toBe(3750);
  });
  it('splits put in vs returns and groups by place', () => {
    const s = investmentSummary([{ kind: 'Deposit', amount: 50000, place: 'Fixed deposit' }, { kind: 'Dividend', amount: 2650, place: 'ASB / ASN' }, { kind: 'Deposit', amount: 60000, place: 'ASB / ASN' }, { kind: 'Withdrawal', amount: 10000, place: 'Fixed deposit' }]);
    expect(s.putIn).toBe(100000);
    expect(s.returns).toBe(2650);
    expect(s.value).toBe(102650);
    expect(s.byPlace[0]).toEqual(['ASB / ASN', 62650]);
  });
});

describe('splitFee', () => {
  it('splits by %, skips a full fund and caps at the target', () => {
    const r = splitFee(10000, [
      { key: 'a', name: 'Tax', pct: 15, target: 36000, balance: 27000 },
      { key: 'b', name: 'PII', pct: 5, target: 24000, balance: 24000 },
      { key: 'c', name: 'IT', pct: 10, target: 4800, balance: 4500 },
      { key: 'd', name: 'No split', pct: 0, target: 100, balance: 0 },
    ]);
    expect(r.parts.map((p) => [p.key, p.amount, p.full])).toEqual([['a', 1500, false], ['b', 0, true], ['c', 300, false]]);
    expect(r.used).toBe(1800);
    expect(r.rest).toBe(8200);
  });
  it('a fund without a target takes its full share', () => expect(splitFee(1000, [{ key: 'e', name: 'Emergency', pct: 10, target: 0, balance: 0 }]).used).toBe(100));
});
