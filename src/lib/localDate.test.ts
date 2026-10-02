/** Time zone is pinned to Asia/Kuala_Lumpur (UTC+8) by vitest.config.ts. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { endOfToday, inRange, localIso, localMonth, parseLocal, todayLocal, toLocalIso, toLocalMonth, toLocalYear } from './localDate';

afterEach(() => { vi.useRealTimers(); });

describe('runs in Asia/Kuala_Lumpur', () => {
  it('offset is UTC+8', () => expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-480));
});

describe('localIso / localMonth / todayLocal', () => {
  it('pads month and day', () => expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05'));
  it('accepts a timestamp', () => expect(localIso(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31'));
  it('localMonth', () => expect(localMonth(new Date(2026, 11, 31))).toBe('2026-12'));
  it('todayLocal at 07:30 MYT on the 1st is the 1st, not UTC yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T23:30:00.000Z'));
    expect(todayLocal()).toBe('2026-10-01');
    expect(localMonth()).toBe('2026-10');
  });
});

describe('parseLocal', () => {
  const midnight = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
  it('YYYY-MM-DD → local midnight', () => expect(parseLocal('2026-10-01')).toBe(midnight(2026, 10, 1)));
  it('YYYY-M-D without padding', () => expect(parseLocal('2026-1-5')).toBe(midnight(2026, 1, 5)));
  it('UTC ISO timestamp → that instant', () => expect(parseLocal('2026-09-30T23:30:00.000Z')).toBe(Date.UTC(2026, 8, 30, 23, 30)));
  it('dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy', () => {
    expect(parseLocal('01.10.2026')).toBe(midnight(2026, 10, 1));
    expect(parseLocal('1/10/2026')).toBe(midnight(2026, 10, 1));
    expect(parseLocal('01-10-2026')).toBe(midnight(2026, 10, 1));
  });
  it('two-digit year → 20xx', () => expect(parseLocal('01.10.26')).toBe(midnight(2026, 10, 1)));
  it('"1 Oct 2026" and "1 October 2026"', () => {
    expect(parseLocal('1 Oct 2026')).toBe(midnight(2026, 10, 1));
    expect(parseLocal('1 October 2026')).toBe(midnight(2026, 10, 1));
  });
  it('Date and number pass through', () => {
    const d = new Date(2026, 4, 2, 13, 0);
    expect(parseLocal(d)).toBe(d.getTime());
    expect(parseLocal(12345)).toBe(12345);
  });
  it('unknown → 0', () => {
    expect(parseLocal('')).toBe(0);
    expect(parseLocal(null)).toBe(0);
    expect(parseLocal(undefined)).toBe(0);
    expect(parseLocal('not a date')).toBe(0);
    expect(parseLocal('2026-13-45T00:00')).toBe(0);
  });
});

describe('toLocalIso / toLocalMonth / toLocalYear', () => {
  it('UTC late evening on 31 Dec is next year locally', () => {
    expect(toLocalIso('2026-12-31T20:00:00.000Z')).toBe('2027-01-01');
    expect(toLocalMonth('2026-12-31T20:00:00.000Z')).toBe('2027-01');
    expect(toLocalYear('2026-12-31T20:00:00.000Z')).toBe(2027);
  });
  it('unknown → empty / NaN', () => {
    expect(toLocalIso('')).toBe('');
    expect(toLocalMonth(undefined)).toBe('');
    expect(toLocalYear('nope')).toBeNaN();
  });
});

describe('inRange (end exclusive)', () => {
  const start = new Date(2026, 9, 1), end = new Date(2026, 10, 1);
  it('start included', () => expect(inRange('2026-10-01', start, end)).toBe(true));
  it('end excluded', () => expect(inRange('2026-11-01', start, end)).toBe(false));
  it('07:30 MYT on the 1st counts in October', () => expect(inRange('2026-09-30T23:30:00.000Z', start, end)).toBe(true));
  it('unknown date is never in range', () => expect(inRange('', new Date(0), end)).toBe(false));
});

describe('endOfToday', () => {
  it('local midnight tomorrow, across month and year ends', () => {
    expect(endOfToday(new Date(2026, 11, 31, 15, 0)).getTime()).toBe(new Date(2027, 0, 1).getTime());
    expect(endOfToday(new Date(2026, 1, 28, 0, 0)).getTime()).toBe(new Date(2026, 2, 1).getTime());
  });
});
