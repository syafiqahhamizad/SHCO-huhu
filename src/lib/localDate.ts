/**
 * Local-calendar date helpers for dashboards.
 *
 * Never use `toISOString().slice(0, 10)` for "today" / "this month": that is the UTC date, so
 * between 00:00 and 08:00 in Malaysia (UTC+8) it still says yesterday / last month.
 *
 * Stored values come in two shapes:
 *   - date-only strings ("2026-10-01", "01.10.2026") — already a local calendar date;
 *   - UTC ISO timestamps ("2026-09-30T23:30:00.000Z") — must be converted to the local date
 *     before bucketing by day / month / year.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** YYYY-MM-DD of a Date / timestamp in local time. */
export const localIso = (d: Date | number = new Date()): string => {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
/** YYYY-MM of a Date / timestamp in local time. */
export const localMonth = (d: Date | number = new Date()): string => localIso(d).slice(0, 7);
export const todayLocal = () => localIso(new Date());
export const thisMonthLocal = () => localMonth(new Date());

/**
 * Timestamp (ms) of a stored date. Date-only strings are read as LOCAL midnight (unlike
 * `new Date('2026-10-01')`, which is UTC midnight); timestamps with a time part are parsed
 * as the instant they are. Returns 0 when unknown.
 */
export const parseLocal = (s: unknown): number => {
  if (s instanceof Date) return s.getTime();
  if (typeof s === 'number') return s;
  const str = String(s || '').trim();
  if (!str) return 0;
  let q = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (q) return new Date(+q[1], +q[2] - 1, +q[3]).getTime();
  if (/^\d{4}-\d{1,2}-\d{1,2}[T ]/.test(str)) {
    const t = new Date(str).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  q = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (q) return new Date(+(q[3].length === 2 ? '20' + q[3] : q[3]), +q[2] - 1, +q[1]).getTime();
  q = str.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (q) {
    const mi = MON.indexOf(q[2].toLowerCase());
    if (mi >= 0) return new Date(+q[3], mi, +q[1]).getTime();
  }
  const t = new Date(str).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Local YYYY-MM-DD of any stored date / timestamp ('' when unknown). */
export const toLocalIso = (s: unknown): string => {
  const t = parseLocal(s);
  return t ? localIso(t) : '';
};
/** Local YYYY-MM of any stored date / timestamp ('' when unknown). */
export const toLocalMonth = (s: unknown): string => toLocalIso(s).slice(0, 7);
/** Local calendar year of any stored date / timestamp (NaN when unknown). */
export const toLocalYear = (s: unknown): number => {
  const t = parseLocal(s);
  return t ? new Date(t).getFullYear() : NaN;
};
/** True when the stored date falls in [start, end) (end exclusive). */
export const inRange = (s: unknown, start: Date, end: Date): boolean => {
  const t = parseLocal(s);
  return !!t && t >= start.getTime() && t < end.getTime();
};
/** Start of tomorrow, local — the exclusive end of "to date" ranges. */
export const endOfToday = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
/** Whole days between two stored dates (b − a), by local calendar day. */
export const daysBetweenLocal = (a: unknown, b: unknown): number => {
  const ta = parseLocal(toLocalIso(a)), tb = parseLocal(toLocalIso(b));
  if (!ta || !tb) return 0;
  return Math.round((tb - ta) / 86400000);
};
