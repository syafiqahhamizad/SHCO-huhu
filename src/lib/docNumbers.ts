/**
 * Document numbers from the formats in Settings › Banks, Numbering & SST › Document numbering.
 * Tokens: {YYYY} year, {YY} 2-digit year, {0000} running number (as many zeros as digits).
 * Changing a format only affects NEW documents; old numbers never change.
 */
export const DEFAULT_DOC_FORMATS: Record<string, string> = {
  quotation: 'QUOT-{YYYY}-{0000}',
  proforma: 'PF-{YYYY}-{0000}',
  invoice: 'INV-{YYYY}-{0000}',
  receipt: 'HQ-OR-{0000}',
  voucher: 'HQ-PV-{0000}',
  journal: 'JV-{YYYY}-{0000}',
};

/** Does the format reset its running number every year? */
export const isYearly = (fmt: string) => /\{YYYY\}|\{YY\}/.test(fmt);
export const validFormat = (fmt: string) => /\{0+\}/.test(fmt) && fmt.trim().length <= 40;

export const formatDocNo = (fmt: string, year: number, n: number) =>
  fmt.replace(/\{YYYY\}/g, String(year)).replace(/\{YY\}/g, String(year).slice(-2)).replace(/\{(0+)\}/, (_m, z: string) => String(n).padStart(z.length, '0'));

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Highest running number already used by ids written in this format (for this year, if yearly). */
export const maxNumIn = (ids: string[], fmt: string, year: number) => {
  const pattern = esc(fmt)
    .replace(/\\\{YYYY\\\}/g, String(year)).replace(/\\\{YY\\\}/g, String(year).slice(-2))
    .replace(/\\\{0+\\\}/, '(\\d+)');
  const re = new RegExp('^' + pattern + '$', 'i');
  return ids.reduce((mx, id) => { const m = String(id).match(re); const n = m ? Number(m[1]) : 0; return n > mx ? n : mx; }, 0);
};

/** The next number: one more than any number used this year in the new OR the built-in format (no repeats when the format changes). */
export const nextDocNo = (key: string, fmt: string | undefined, ids: string[], year: number, floor = 0) => {
  const f = fmt && validFormat(fmt) ? fmt.trim() : DEFAULT_DOC_FORMATS[key];
  const n = Math.max(floor, maxNumIn(ids, f, year), maxNumIn(ids, DEFAULT_DOC_FORMATS[key], year)) + 1;
  return formatDocNo(f, year, n);
};
