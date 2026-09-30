/**
 * Self-check for src/lib/statutory.ts against rows copied from the official tables.
 * Run: npx tsx src/lib/statutory.check.ts   (exits 1 on any mismatch)
 *
 * Expected values come straight from:
 *  - KWSP Third Schedule, Oct 2025 wages (Parts A and E) and the worked examples on
 *    https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution
 *  - PERKESO "New contribution rate including SKBBK" (Act 4, from 1 Jun 2026)
 *  - PERKESO Employers' Circular No. 3/2024, Appendix 1 (Act 4 before SKBBK, Act 800 EIS)
 */
import { calcEpf, calcSocso, calcEis, statutoryForPayslip } from './statutory';
import { ACT4_BANDS, EIS_BANDS } from './statutoryTables';

let fails = 0, passes = 0;
const eq = (label: string, got: number, want: number) => {
  if (Math.abs(got - want) < 0.001) { passes++; return; }
  fails++; console.error(`FAIL ${label}: got ${got}, want ${want}`);
};

const P = '2026-09'; // a current payroll month (SKBBK first phase in force)

/* EPF Part A (citizen < 60): [wage, employer, employee] — rows of the Third Schedule */
const epfA: [number, number, number][] = [
  [10, 0, 0], [15, 3, 3], [30, 6, 5], [210, 29, 25], [670, 89, 75],
  [3250, 424, 359], // KWSP worked example 1.1
  [4990, 650, 550], [5000, 650, 550],
  [5000.01, 612, 561], // first RM100 band, employer drops to 12%
  [6710.8, 816, 748], // KWSP worked example 1.2
  [17150, 2064, 1892], [19999.99, 2400, 2200], [20000, 2400, 2200],
];
for (const [w, er, ee] of epfA) { const r = calcEpf(w, 35, P); eq(`EPF A ${w} employer`, r.employer, er); eq(`EPF A ${w} employee`, r.employee, ee); }
// KWSP worked example 2.1: RM21,250 → 12% 2,550 + 11% 2,337.50 = 4,887.50 → total 4,888
{ const r = calcEpf(21250, 35, P); eq('EPF A 21250 total', r.employer + r.employee, 4888); eq('EPF A 21250 employer', r.employer, 2550); }

/* EPF Part E (citizen 60+): [wage, employer]; employee always 0 */
const epfE: [number, number][] = [[15, 1], [90, 4], [3250, 131] /* KWSP example 1.3 */, [18450, 740], [20000, 800], [21250, 850] /* example 2.2 */];
for (const [w, er] of epfE) { const r = calcEpf(w, 62, P); eq(`EPF E ${w} employer`, r.employer, er); eq(`EPF E ${w} employee`, r.employee, 0); }

/* SOCSO from 1 Jun 2026 (incl. LINDUNG 24 Jam phase 1): [wage, cat1 employer, cat1 employee, cat2 employer, cat2 employee] */
const socso26: [number, number, number, number, number][] = [
  [25, 0.4, 0.3, 0.3, 0.2],
  [1150, 20.15, 14.4, 14.4, 8.65],
  [3000, 51.65, 36.9, 36.9, 22.15],
  [3000.01, 53.35, 38.1, 38.1, 22.85],
  [4950, 86.65, 61.9, 61.9, 37.15],
  [5950, 104.15, 74.4, 74.4, 44.65],
  [12000, 104.15, 74.4, 74.4, 44.65], // above the RM6,000 ceiling
];
for (const [w, er1, ee1, er2, ee2] of socso26) {
  const a = calcSocso(w, 35, P), b = calcSocso(w, 61, P);
  eq(`SOCSO c1 ${w} employer`, a.employer, er1); eq(`SOCSO c1 ${w} employee`, a.employee, ee1);
  eq(`SOCSO c2 ${w} employer`, b.employer, er2); eq(`SOCSO c2 ${w} employee`, b.employee, ee2);
}
/* SOCSO Oct 2024 – May 2026 (Circular 3/2024, no SKBBK): [wage, cat1 er, cat1 ee, cat2 er] */
const socso24: [number, number, number, number][] = [[1150, 20.15, 5.75, 14.4], [2650, 46.35, 13.25, 33.1], [5950, 104.15, 29.75, 74.4]];
for (const [w, er1, ee1, er2] of socso24) {
  const a = calcSocso(w, 35, '2026-05'), b = calcSocso(w, 61, '2026-05');
  eq(`SOCSO24 c1 ${w} employer`, a.employer, er1); eq(`SOCSO24 c1 ${w} employee`, a.employee, ee1);
  eq(`SOCSO24 c2 ${w} employer`, b.employer, er2); eq(`SOCSO24 c2 ${w} employee`, b.employee, 0);
}

/* EIS (Act 800 Second Schedule): [wage, each share] */
const eis: [number, number][] = [[25, 0.05], [150, 0.35], [1150, 2.3], [1450, 2.9], [3000, 5.9], [3000.01, 6.1], [4050, 8.1], [5950, 11.9], [9000, 11.9]];
for (const [w, s] of eis) { const r = calcEis(w, 35, P); eq(`EIS ${w} employee`, r.employee, s); eq(`EIS ${w} employer`, r.employer, s); }
eq('EIS age 60', calcEis(3000, 60, P).employee, 0);
eq('EIS age 17', calcEis(3000, 17, P).employee, 0);

/* Table integrity */
eq('Act 4 bands', ACT4_BANDS.length, 64); eq('EIS bands', EIS_BANDS.length, 64);
ACT4_BANDS.forEach((b, i) => { if (i && b[0] <= ACT4_BANDS[i - 1][0]) { fails++; console.error('Act 4 bands not ascending at', i); } if (EIS_BANDS[i][0] !== b[0]) { fails++; console.error('EIS/Act 4 band limits differ at', i); } });

/* Whole payslip: citizen born 10 May 1990, Sep 2026, basic 3,000 + allowance 250 */
{
  const r = statutoryForPayslip({ basic: 3000, allowances: 250, referralFee: 0, profitShare: 0, bonus: 0 }, { birthday: '1990-05-10', nationality: 'Malaysian' }, P);
  eq('slip ok', r.ok ? 1 : 0, 1);
  eq('slip EPF employee', r.epfEmployee, 359); eq('slip EPF employer', r.epfEmployer, 424);
  // SOCSO band RM3,200.01–3,300: employer 56.85, employee 16.25 + 24.35 = 40.60; EIS 6.50 each
  eq('slip SOCSO+EIS employee', r.socsoEisEmployee, 47.1); eq('slip SOCSO+EIS employer', r.socsoEisEmployer, 63.35);
}
/* Bonus: counted for EPF, not for SOCSO/EIS */
{
  const r = statutoryForPayslip({ basic: 4000, allowances: 0, referralFee: 0, profitShare: 0, bonus: 2000 }, { birthday: '1990-05-10', nationality: 'Malaysian' }, P);
  eq('bonus EPF employee (RM6,000)', r.epfEmployee, 660); eq('bonus EPF employer (12%)', r.epfEmployer, 720);
  eq('bonus SOCSO+EIS employee (RM4,000 band)', r.socsoEisEmployee, 19.75 + 29.65 + 7.9);
}
/* Age from NRIC when birthday blank; non-citizen → manual */
eq('nric age', statutoryForPayslip({ basic: 3000, allowances: 0, referralFee: 0, profitShare: 0, bonus: 0 }, { nric: '650101-10-1234', nationality: 'Malaysian' }, P, new Date(2026, 8, 30)).age || 0, 61);
eq('foreign manual', statutoryForPayslip({ basic: 3000, allowances: 0, referralFee: 0, profitShare: 0, bonus: 0 }, { birthday: '1990-01-01', nationality: 'Indonesian' }, P).ok ? 1 : 0, 0);
eq('phase 2 manual', statutoryForPayslip({ basic: 3000, allowances: 0, referralFee: 0, profitShare: 0, bonus: 0 }, { birthday: '1990-01-01', nationality: 'Malaysian' }, '2028-06').ok ? 1 : 0, 0);

console.log(`${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
