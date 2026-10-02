/**
 * src/lib/statutory.ts against rows copied from the official tables. Formerly src/lib/statutory.check.ts.
 *
 * Expected values come straight from:
 *  - KWSP Third Schedule, Oct 2025 wages (Parts A and E) and the worked examples on
 *    https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution
 *  - PERKESO "New contribution rate including SKBBK" (Act 4, from 1 Jun 2026)
 *  - PERKESO Employers' Circular No. 3/2024, Appendix 1 (Act 4 before SKBBK, Act 800 EIS)
 */
import { describe, expect, it } from 'vitest';
import { calcEpf, calcSocso, calcEis, statutoryForPayslip } from './statutory';
import { ACT4_BANDS, EIS_BANDS } from './statutoryTables';

/** Same comparison the old check script used: within 0.001. */
const eq = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(0.001);

const P = '2026-09'; // a current payroll month (SKBBK first phase in force)

describe('EPF Part A (citizen < 60)', () => {
  /* [wage, employer, employee] — rows of the Third Schedule */
  const epfA: [number, number, number][] = [
    [10, 0, 0], [15, 3, 3], [30, 6, 5], [210, 29, 25], [670, 89, 75],
    [3250, 424, 359], // KWSP worked example 1.1
    [4990, 650, 550], [5000, 650, 550],
    [5000.01, 612, 561], // first RM100 band, employer drops to 12%
    [6710.8, 816, 748], // KWSP worked example 1.2
    [17150, 2064, 1892], [19999.99, 2400, 2200], [20000, 2400, 2200],
  ];
  it.each(epfA)('EPF A %s employer', (w, er) => eq(calcEpf(w, 35, P).employer, er));
  it.each(epfA)('EPF A %s employee', (w, _er, ee) => eq(calcEpf(w, 35, P).employee, ee));
  // KWSP worked example 2.1: RM21,250 → 12% 2,550 + 11% 2,337.50 = 4,887.50 → total 4,888
  it('EPF A 21250 total', () => { const r = calcEpf(21250, 35, P); eq(r.employer + r.employee, 4888); });
  it('EPF A 21250 employer', () => eq(calcEpf(21250, 35, P).employer, 2550));
});

describe('EPF Part E (citizen 60+)', () => {
  /* [wage, employer]; employee always 0 */
  const epfE: [number, number][] = [[15, 1], [90, 4], [3250, 131] /* KWSP example 1.3 */, [18450, 740], [20000, 800], [21250, 850] /* example 2.2 */];
  it.each(epfE)('EPF E %s employer', (w, er) => eq(calcEpf(w, 62, P).employer, er));
  it.each(epfE)('EPF E %s employee', (w) => eq(calcEpf(w, 62, P).employee, 0));
});

describe('SOCSO from 1 Jun 2026 (incl. LINDUNG 24 Jam phase 1)', () => {
  /* [wage, cat1 employer, cat1 employee, cat2 employer, cat2 employee] */
  const socso26: [number, number, number, number, number][] = [
    [25, 0.4, 0.3, 0.3, 0.2],
    [1150, 20.15, 14.4, 14.4, 8.65],
    [3000, 51.65, 36.9, 36.9, 22.15],
    [3000.01, 53.35, 38.1, 38.1, 22.85],
    [4950, 86.65, 61.9, 61.9, 37.15],
    [5950, 104.15, 74.4, 74.4, 44.65],
    [12000, 104.15, 74.4, 74.4, 44.65], // above the RM6,000 ceiling
  ];
  it.each(socso26)('SOCSO c1 %s employer', (w, er1) => eq(calcSocso(w, 35, P).employer, er1));
  it.each(socso26)('SOCSO c1 %s employee', (w, _a, ee1) => eq(calcSocso(w, 35, P).employee, ee1));
  it.each(socso26)('SOCSO c2 %s employer', (w, _a, _b, er2) => eq(calcSocso(w, 61, P).employer, er2));
  it.each(socso26)('SOCSO c2 %s employee', (w, _a, _b, _c, ee2) => eq(calcSocso(w, 61, P).employee, ee2));
});

describe('SOCSO Oct 2024 – May 2026 (Circular 3/2024, no SKBBK)', () => {
  /* [wage, cat1 er, cat1 ee, cat2 er] */
  const socso24: [number, number, number, number][] = [[1150, 20.15, 5.75, 14.4], [2650, 46.35, 13.25, 33.1], [5950, 104.15, 29.75, 74.4]];
  it.each(socso24)('SOCSO24 c1 %s employer', (w, er1) => eq(calcSocso(w, 35, '2026-05').employer, er1));
  it.each(socso24)('SOCSO24 c1 %s employee', (w, _a, ee1) => eq(calcSocso(w, 35, '2026-05').employee, ee1));
  it.each(socso24)('SOCSO24 c2 %s employer', (w, _a, _b, er2) => eq(calcSocso(w, 61, '2026-05').employer, er2));
  it.each(socso24)('SOCSO24 c2 %s employee', (w) => eq(calcSocso(w, 61, '2026-05').employee, 0));
});

describe('EIS (Act 800 Second Schedule)', () => {
  /* [wage, each share] */
  const eis: [number, number][] = [[25, 0.05], [150, 0.35], [1150, 2.3], [1450, 2.9], [3000, 5.9], [3000.01, 6.1], [4050, 8.1], [5950, 11.9], [9000, 11.9]];
  it.each(eis)('EIS %s employee', (w, s) => eq(calcEis(w, 35, P).employee, s));
  it.each(eis)('EIS %s employer', (w, s) => eq(calcEis(w, 35, P).employer, s));
  it('EIS age 60', () => eq(calcEis(3000, 60, P).employee, 0));
  it('EIS age 17', () => eq(calcEis(3000, 17, P).employee, 0));
});

describe('table integrity', () => {
  it('Act 4 bands', () => eq(ACT4_BANDS.length, 64));
  it('EIS bands', () => eq(EIS_BANDS.length, 64));
  it('Act 4 band limits ascend', () => {
    ACT4_BANDS.forEach((b, i) => { if (i) expect(b[0], `Act 4 bands not ascending at ${i}`).toBeGreaterThan(ACT4_BANDS[i - 1][0]); });
  });
  it('EIS and Act 4 band limits match', () => {
    ACT4_BANDS.forEach((b, i) => expect(EIS_BANDS[i][0], `EIS/Act 4 band limits differ at ${i}`).toBe(b[0]));
  });
});

const pay = (basic: number, bonus = 0, allowances = 0) => ({ basic, allowances, referralFee: 0, profitShare: 0, bonus });

describe('whole payslip: citizen born 10 May 1990, Sep 2026, basic 3,000 + allowance 250', () => {
  const r = statutoryForPayslip(pay(3000, 0, 250), { birthday: '1990-05-10', nationality: 'Malaysian' }, P);
  it('slip ok', () => eq(r.ok ? 1 : 0, 1));
  it('slip EPF employee', () => eq(r.epfEmployee, 359));
  it('slip EPF employer', () => eq(r.epfEmployer, 424));
  // SOCSO band RM3,200.01–3,300: employer 56.85, employee 16.25 + 24.35 = 40.60; EIS 6.50 each
  it('slip SOCSO+EIS employee', () => eq(r.socsoEisEmployee, 47.1));
  it('slip SOCSO+EIS employer', () => eq(r.socsoEisEmployer, 63.35));
});

describe('bonus: counted for EPF, not for SOCSO/EIS', () => {
  const r = statutoryForPayslip(pay(4000, 2000), { birthday: '1990-05-10', nationality: 'Malaysian' }, P);
  it('bonus EPF employee (RM6,000)', () => eq(r.epfEmployee, 660));
  it('bonus EPF employer (12%)', () => eq(r.epfEmployer, 720));
  it('bonus SOCSO+EIS employee (RM4,000 band)', () => eq(r.socsoEisEmployee, 19.75 + 29.65 + 7.9));
});

describe('age from NRIC when birthday blank; non-citizen / future phase → manual', () => {
  it('nric age', () => eq(statutoryForPayslip(pay(3000), { nric: '650101-10-1234', nationality: 'Malaysian' }, P, new Date(2026, 8, 30)).age || 0, 61));
  it('foreign manual', () => eq(statutoryForPayslip(pay(3000), { birthday: '1990-01-01', nationality: 'Indonesian' }, P).ok ? 1 : 0, 0));
  it('phase 2 manual', () => eq(statutoryForPayslip(pay(3000), { birthday: '1990-01-01', nationality: 'Malaysian' }, '2028-06').ok ? 1 : 0, 0));
});
