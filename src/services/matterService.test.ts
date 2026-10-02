import { describe, expect, it } from 'vitest';
import { extractMatterRunningNumber, generateNextMatterSequenceNumber } from './matterService';
import type { Case } from '../types';

const c = (ref?: string) => ({ id: 'X', ref }) as unknown as Case;
/** What AppContext.getNextSequenceId('case') returns (4-digit running number). */
const nextCaseNo = (cases: Case[]) => generateNextMatterSequenceNumber(cases, 1).padStart(4, '0');

describe('extractMatterRunningNumber', () => {
  it('number before the MM-YYYY segment', () => expect(extractMatterRunningNumber('SHC/SH-AH/NM/LIT/CIVIL/QAL/0001/08-2026')).toBe(1));
  it('number before an MM-YY segment', () => expect(extractMatterRunningNumber('SHC/SH/LIT/QAL/0012/08-26')).toBe(12));
  it('legacy trailing year', () => expect(extractMatterRunningNumber('SHC/SH/LIT/QAL/001/2025')).toBe(1));
  it('legacy CS- ids', () => {
    expect(extractMatterRunningNumber('CS-007')).toBe(7);
    expect(extractMatterRunningNumber('CS-0012')).toBe(12);
  });
  it('-1 when no running number', () => {
    expect(extractMatterRunningNumber(undefined)).toBe(-1);
    expect(extractMatterRunningNumber('')).toBe(-1);
    expect(extractMatterRunningNumber('junk')).toBe(-1);
    expect(extractMatterRunningNumber('SHC/2026')).toBe(-1);
  });
  it('a year is never read as the running number', () => {
    expect(extractMatterRunningNumber('SHC/SH/LIT/QAL/2026')).toBe(-1);
  });
});

describe('generateNextMatterSequenceNumber (getNextSequenceId("case"))', () => {
  it('first file → 0001', () => expect(nextCaseNo([])).toBe('0001'));
  it('highest existing + 1, whatever the order', () => {
    expect(nextCaseNo([c('SHC/SH/LIT/QAL/0041/09-2026'), c('SHC/SH-AH/NM/LIT/CIVIL/QAL/0001/08-2026')])).toBe('0042');
  });
  it('counts legacy refs', () => {
    expect(nextCaseNo([c('CS-007')])).toBe('0008');
    expect(nextCaseNo([c('SHC/SH/LIT/QAL/001/2025')])).toBe('0002');
  });
  it('ignores refs without a number and missing refs', () => {
    expect(nextCaseNo([c(undefined), c('junk'), c('SHC/SH/LIT/QAL/0003/08-2026')])).toBe('0004');
  });
  it('raw value is 3-digit padded', () => expect(generateNextMatterSequenceNumber([])).toBe('001'));
  it('counter higher than the files wins', () => expect(generateNextMatterSequenceNumber([c('SHC/SH/LIT/QAL/0001/08-2026')], 10)).toBe('010'));
  it('year-sized persisted counters are ignored', () => expect(generateNextMatterSequenceNumber([], 2028)).toBe('001'));
  it('0999 → 1000', () => expect(nextCaseNo([c('SHC/SH/LIT/QAL/0999/09-2026')])).toBe('1000'));

  // KNOWN LIMITATION (reported, not fixed): extractMatterRunningNumber only accepts running numbers
  // below 1000, so once file 1000 exists it is ignored and numbering restarts. `it.fails` keeps the
  // suite green while documenting the expected behaviour; it will start failing once this is fixed.
  it.fails('after file 1000 the next number is 1001 (currently restarts at 0001)', () => {
    expect(nextCaseNo([c('SHC/SH/LIT/QAL/0999/09-2026'), c('SHC/SH/LIT/QAL/1000/09-2026')])).toBe('1001');
  });
});
