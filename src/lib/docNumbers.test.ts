import { describe, expect, it } from 'vitest';
import { formatDocNo, maxNumIn, nextDocNo } from './docNumbers';

describe('document numbers', () => {
  it('formats with the year and running number', () => {
    expect(formatDocNo('QT-{YY}-{0000}', 2026, 7)).toBe('QT-26-0007');
    expect(formatDocNo('SHCO/INV/{YYYY}/{000}', 2026, 12)).toBe('SHCO/INV/2026/012');
  });
  it('reads used numbers back, this year only', () => {
    expect(maxNumIn(['INV-2026-0005', 'INV-2025-0099', 'X'], 'INV-{YYYY}-{0000}', 2026)).toBe(5);
  });
  it('a new format carries on the count, never repeats', () => {
    expect(nextDocNo('quotation', 'QT-{YY}-{0000}', ['QUOT-2026-0008'], 2026)).toBe('QT-26-0009');
    expect(nextDocNo('quotation', undefined, ['QUOT-2026-0008'], 2026)).toBe('QUOT-2026-0009');
  });
});
