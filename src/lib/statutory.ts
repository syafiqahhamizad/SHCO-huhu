/**
 * Malaysian statutory payroll contributions: EPF (KWSP), SOCSO (PERKESO Act 4) and EIS (Act 800).
 * Pure functions, no app state. PCB and zakat are deliberately NOT here: PCB is taken from LHDN's
 * e-PCB calculator and zakat from the employee record (firm decision).
 *
 * ── EPF · Employees Provident Fund Act 1991, Third Schedule (effective October 2025 wages) ──
 * Source: https://www.kwsp.gov.my/documents/d/guest/third_schedule_from_-1-october-2025
 *         https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution
 *  - Part A (Malaysian citizens, PRs, pre-1 Aug 1998 non-citizen members, until they attain 60):
 *    employee 11%; employer 13% for wages up to RM5,000, 12% above RM5,000.
 *  - Part E (Malaysian citizens who have attained 60): employee 0%, employer 4%.
 *  - Wages RM0.01–10.00: NIL. The schedule then runs in RM20 bands up to RM5,000 and RM100 bands
 *    up to RM20,000. Each share in the table equals rate × the band's UPPER limit, rounded UP to
 *    the next ringgit, separately for employer and employee. (Checked row by row: this reproduces
 *    all 401 rows of Part A and all 401 rows of Part E of the Oct-2025 schedule exactly.)
 *    KWSP's own worked examples: RM3,250 → 424 / 359; RM6,710.80 → 816 / 748; age 60+ RM3,250 → 131 / 0.
 *  - Above RM20,000: exact percentage of the wage; "the total contribution which includes cents
 *    shall be rounded to the next ringgit" (KWSP example: RM21,250 → 2,550 + 2,337.50 = 4,888).
 *    The schedule fixes only the rounded total, so here the employee share is rounded up and the
 *    employer pays the balance — flagged for Accounts to confirm.
 *  - Wages for EPF (KWSP "Components of Wage"): salary, bonus, allowances, commission, incentives,
 *    arrears, etc. NOT: overtime, service charge, gratuity, retirement/retrenchment benefits,
 *    travelling allowance.
 *  - Non-citizens (Part F, 2% + 2% from Oct 2025) and PRs aged 60+ (Part C) are NOT automated here.
 *  - KWSP: maximum age of contribution is 75.
 *
 * ── SOCSO · Employees' Social Security Act 1969 (Act 4), Third Schedule ──
 *  - Wage ceiling RM6,000 from 1 Oct 2024 (Employers' Circular No. 3/2024; Acts A1724 / A1725), 65
 *    salary groups; wages above RM6,000 pay group 64's amounts.
 *    https://www.perkeso.gov.my/images/arahan/011024%20-%20EMPLOYERS%20CIRCULAR%20NO.%203%20YEAR%202024%20-%20INCREMENT%20OF%20THE%20WAGE%20CEILING%20FOR%20MONTHLY%20CONTRIBUTIONS%20FROM%20RM5K%20TO%20RM6K.pdf
 *  - First category (Employment Injury + Invalidity [+ LINDUNG 24 Jam from 1 Jun 2026]) for employees
 *    under 60; second category (Employment Injury [+ LINDUNG 24 Jam]) for employees who have attained
 *    60, and for employees who first entered PERKESO at 55 or older (not knowable here → warning).
 *  - LINDUNG 24 Jam / SKBBK (non-employment injury scheme), Act A1788, in force 1 June 2026:
 *    employee-only share, first phase 0.75% from 1 Jun 2026 to 31 May 2028 (P.U.(B) 196/2026),
 *    second phase 1.00% from 1 Jun 2028 (table not yet published → NOT automated), no age limit.
 *    https://www.perkeso.gov.my/images/arahan/Employer_Circular_No_2_2026-PekelilingLindung24Jam_English.pdf
 *    https://www.perkeso.gov.my/images/lindung/lindung-24-jam/NewContributionRateIncludingSKBBK.pdf
 *    https://www.perkeso.gov.my/images/akta/ACT%204/P.U.(B)/PUB_196_2026_-_PENETAPAN_TARIKH_PERMULAAN_KUAT_KUASA.pdf
 *  - "Wages" (Act 4 s.2(24)) excludes employer EPF/pension contributions, travelling allowance,
 *    special-expense reimbursements, gratuity and ANNUAL BONUS.
 *
 * ── EIS · Employment Insurance System Act 2017 (Act 800), Second Schedule ──
 *  - 0.2% employer + 0.2% employee by wage band, same RM6,000 ceiling and bands as Act 4 (table
 *    from Employers' Circular No. 3/2024, Appendix 1).
 *  - Only employees aged 18 until they attain 60 contribute; employees aged 57+ with no prior
 *    contribution before 57 are exempt (not knowable here → warning). Domestic workers and
 *    government employees are exempt. https://www.perkeso.gov.my/en/our-services/employer-employee/contributions.html
 *  - "Wages" (Act 800 s.2) likewise excludes travelling allowance and annual bonus.
 *
 * Tables: ./statutoryTables.ts. Tests: src/lib/statutory.test.ts (`npm test`).
 */
import { ACT4_BANDS, EIS_BANDS } from './statutoryTables';

/** Date of the newest rule encoded here (LINDUNG 24 Jam first phase). */
export const STATUTORY_VERSION = '2026-06-01';
export const STATUTORY_AS_AT = '1 Jun 2026';
/** One-line description for UI hints and saved payslips. */
export const STATUTORY_SOURCES = 'KWSP Third Schedule (Oct 2025 wages) · PERKESO Act 4 incl. LINDUNG 24 Jam phase 1 (Jun 2026) · EIS Act 800 (Oct 2024, RM6,000 ceiling)';
export const EPCB_URL = 'https://mytax.hasil.gov.my/';

/* Periods ('YYYY-MM') each table is verified for. Outside these, amounts must be keyed in manually. */
const EPF_FROM = '2025-10';
const ACT4_FROM = '2024-10';
const SKBBK_FROM = '2026-06';
const SKBBK_PHASE2 = '2028-06';
const EIS_FROM = '2024-10';

const sen = (rm: number) => Math.round((Number(rm) || 0) * 100);
const rmOf = (s: number) => Math.round(s) / 100;
const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

export interface Share { employee: number; employer: number }
export interface EpfResult extends Share { ok: boolean; part?: 'A' | 'E'; note?: string; warning?: string }
export interface SocsoResult extends Share { ok: boolean; category?: 1 | 2; skbbk: number; note?: string }
export interface EisResult extends Share { ok: boolean; exempt?: string; note?: string }

/** EPF for a Malaysian citizen (Third Schedule Parts A / E). `period` = 'YYYY-MM' of the wages. */
export function calcEpf(wage: number, age: number, period: string): EpfResult {
  if (period < EPF_FROM) return { ok: false, employee: 0, employer: 0, note: 'EPF auto-calculation covers wages from Oct 2025 (current Third Schedule) onwards.' };
  if (age >= 75) return { ok: false, employee: 0, employer: 0, note: 'KWSP: the maximum age of contribution is 75. Key in manually if still contributing.' };
  const w = sen(wage);
  const part: 'A' | 'E' = age >= 60 ? 'E' : 'A';
  if (w <= 1000) return { ok: true, part, employee: 0, employer: 0 };
  if (w > 2000000) {
    if (part === 'E') return { ok: true, part, employee: 0, employer: ceilDiv(w * 4, 10000) };
    const total = ceilDiv(w * 23, 10000);
    const employee = ceilDiv(w * 11, 10000);
    return { ok: true, part, employee, employer: total - employee, warning: 'Wages above RM20,000: KWSP rounds only the total (12% + 11%) up to the next ringgit. Employee share rounded up, employer pays the balance. Confirm the split.' };
  }
  const step = w <= 500000 ? 2000 : 10000; // RM20 bands up to RM5,000, then RM100 bands
  const upper = Math.ceil(w / step) * step;
  if (part === 'E') return { ok: true, part, employee: 0, employer: ceilDiv(upper * 4, 10000) };
  const erRate = upper <= 500000 ? 13 : 12;
  return { ok: true, part, employee: ceilDiv(upper * 11, 10000), employer: ceilDiv(upper * erRate, 10000) };
}

const bandIndex = (w: number) => { for (let i = 0; i < ACT4_BANDS.length; i++) if (w <= ACT4_BANDS[i][0] * 100) return i; return ACT4_BANDS.length - 1; };

/** SOCSO (Act 4). First category under 60, second category from 60. Amounts in RM. */
export function calcSocso(wage: number, age: number, period: string): SocsoResult {
  if (period < ACT4_FROM) return { ok: false, employee: 0, employer: 0, skbbk: 0, note: 'SOCSO auto-calculation covers wages from Oct 2024 (RM6,000 ceiling) onwards.' };
  if (period >= SKBBK_PHASE2) return { ok: false, employee: 0, employer: 0, skbbk: 0, note: 'LINDUNG 24 Jam second phase (1.00%) starts June 2028 and its table is not built in yet. Key in from the PERKESO table.' };
  const w = sen(wage);
  if (w <= 0) return { ok: true, category: age >= 60 ? 2 : 1, employee: 0, employer: 0, skbbk: 0 };
  const [, inv, ei, skbbkPh1] = ACT4_BANDS[bandIndex(w)];
  const skbbk = period >= SKBBK_FROM ? skbbkPh1 : 0;
  if (age >= 60) return { ok: true, category: 2, employer: rmOf(ei), employee: rmOf(skbbk), skbbk: rmOf(skbbk) };
  return { ok: true, category: 1, employer: rmOf(inv + ei), employee: rmOf(inv + skbbk), skbbk: rmOf(skbbk) };
}

/** EIS (Act 800). Ages 18 until 60 only. Amounts in RM. */
export function calcEis(wage: number, age: number, period: string): EisResult {
  if (period < EIS_FROM) return { ok: false, employee: 0, employer: 0, note: 'EIS auto-calculation covers wages from Oct 2024 (RM6,000 ceiling) onwards.' };
  if (age < 18) return { ok: true, employee: 0, employer: 0, exempt: 'under 18' };
  if (age >= 60) return { ok: true, employee: 0, employer: 0, exempt: 'aged 60 or above' };
  const w = sen(wage);
  if (w <= 0) return { ok: true, employee: 0, employer: 0 };
  const s = EIS_BANDS[bandIndex(w)][1];
  return { ok: true, employee: rmOf(s), employer: rmOf(s) };
}

/* ------------------------------------------------------------------ age & residency */

/** Parse a date of birth: 'YYYY-MM-DD' (form input), 'DD.MM.YYYY' or 'DD/MM/YYYY'. */
function parseDob(s?: string): { y: number; m: number; d: number } | null {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  return null;
}

/** Date of birth from a Malaysian MyKad number (YYMMDD-PB-###G). Century: YY after the current year's YY → 1900s. */
function dobFromNric(nric?: string, now = new Date()): { y: number; m: number; d: number } | null {
  const digits = String(nric || '').replace(/\D/g, '');
  if (digits.length !== 12) return null;
  const yy = +digits.slice(0, 2), mm = +digits.slice(2, 4), dd = +digits.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const cur = now.getFullYear() % 100;
  return { y: yy > cur ? 1900 + yy : 2000 + yy, m: mm, d: dd };
}

const ageOn = (dob: { y: number; m: number; d: number }, y: number, m: number, d: number) => y - dob.y - (m < dob.m || (m === dob.m && d < dob.d) ? 1 : 0);

export interface StatutoryPerson { birthday?: string; nric?: string; nationality?: string }
export interface WageItems { basic: number; allowances: number; referralFee: number; profitShare: number; bonus: number }

export interface StatutoryResult {
  /** false = cannot be automated for this person / period; everything must be keyed in. */
  ok: boolean;
  reason?: string;
  age?: number;
  wagesEpf: number;
  wagesSocso: number;
  epf: EpfResult;
  socso: SocsoResult;
  eis: EisResult;
  /** Payslip figures (RM). */
  epfEmployee: number;
  epfEmployer: number;
  socsoEisEmployee: number;
  socsoEisEmployer: number;
  warnings: string[];
}

const isMalaysian = (n?: string) => /malaysia|warganegara/i.test(String(n || '')) && !/bukan|non|permanent|\bPR\b/i.test(String(n || ''));

/**
 * Everything the payslip form needs. `period` is the payslip month 'YYYY-MM'.
 * Wages: EPF on all five items (KWSP counts salary, allowances, commission, incentives and bonus).
 * SOCSO/EIS leave out the Bonus line, because annual bonus is not "wages" under Act 4 s.2(24) /
 * Act 800 s.2. Profit sharing (paid quarterly here) and referral fees are counted. A warning
 * reminds Accounts to override if the bonus is not an annual bonus.
 */
export function statutoryForPayslip(items: WageItems, person: StatutoryPerson, period: string, now = new Date()): StatutoryResult {
  const n = (x: number) => Number(x) || 0;
  const wagesEpf = n(items.basic) + n(items.allowances) + n(items.referralFee) + n(items.profitShare) + n(items.bonus);
  const wagesSocso = n(items.basic) + n(items.allowances) + n(items.referralFee) + n(items.profitShare);
  const empty = (reason: string, age?: number): StatutoryResult => ({ ok: false, reason, age, wagesEpf, wagesSocso, epf: { ok: false, employee: 0, employer: 0 }, socso: { ok: false, employee: 0, employer: 0, skbbk: 0 }, eis: { ok: false, employee: 0, employer: 0 }, epfEmployee: 0, epfEmployer: 0, socsoEisEmployee: 0, socsoEisEmployer: 0, warnings: [] });
  const warnings: string[] = [];

  const nat = String(person.nationality || '').trim();
  if (nat && !isMalaysian(nat)) return empty(`Nationality on the employee record is "${nat}". Only Malaysian citizens are auto-calculated (non-citizen and PR rates differ). Key in EPF, SOCSO and EIS manually.`);
  if (!nat) warnings.push('Nationality is blank on the employee record, so Malaysian citizen rates are assumed.');

  let dob = parseDob(person.birthday);
  if (!dob) { dob = dobFromNric(person.nric, now); if (dob) warnings.push('Date of birth is blank on the employee record, so the age is taken from the NRIC.'); }
  if (!dob) return empty('No date of birth or NRIC on the employee record, so the age-based rates can\'t be picked. Add the date of birth under Staff Portal → Employee record, or key in manually.');

  const [py, pm] = period.split('-').map(Number);
  const lastDay = new Date(py, pm, 0).getDate();
  const ageStart = ageOn(dob, py, pm, 1);
  const ageEnd = ageOn(dob, py, pm, lastDay);
  const age = ageStart;
  if (ageEnd !== ageStart && [18, 55, 57, 60, 75].includes(ageEnd)) warnings.push(`Turns ${ageEnd} this month. Rates here use the age at the start of the month (${ageStart}). Confirm with KWSP / PERKESO which month the new rate starts.`);
  if (age >= 55 && age < 60) warnings.push('Aged 55 to 59: if this person first joined PERKESO at 55 or older, SOCSO second category applies (employer only). Override if so.');
  if (age >= 57 && age < 60) warnings.push('Aged 57 to 59: EIS does not apply if they never contributed before 57. Override if so.');

  const epf = calcEpf(wagesEpf, age, period);
  const socso = calcSocso(wagesSocso, age, period);
  const eis = calcEis(wagesSocso, age, period);
  if (epf.warning) warnings.push(epf.warning);
  const nonBonus = wagesEpf - n(items.bonus) - n(items.profitShare);
  if (epf.part === 'A' && nonBonus <= 5000 && wagesEpf > 5000) warnings.push('Bonus / profit share takes this month\'s wages above RM5,000, so the Third Schedule gives employer 12% on the total. Check KWSP\'s guidance on bonus months if you expect 13%.');
  if (n(items.bonus) > 0) warnings.push('Bonus is counted for EPF but left out of SOCSO / EIS wages, because annual bonus is excluded under Act 4 and Act 800. Override if this bonus is a regular (non-annual) payment.');
  if (n(items.allowances) > 0) warnings.push('Allowances are counted as wages. Travelling allowance is not EPF, SOCSO or EIS wages. Override if part of the allowance is travel.');
  if (!epf.ok || !socso.ok || !eis.ok) {
    const notes = [epf, socso, eis].filter((r) => !r.ok).map((r) => r.note).filter(Boolean) as string[];
    return { ...empty(notes.join(' '), age), warnings };
  }
  return {
    ok: true, age, wagesEpf, wagesSocso, epf, socso, eis, warnings,
    epfEmployee: epf.employee, epfEmployer: epf.employer,
    socsoEisEmployee: rmOf(sen(socso.employee) + sen(eis.employee)),
    socsoEisEmployer: rmOf(sen(socso.employer) + sen(eis.employer)),
  };
}
