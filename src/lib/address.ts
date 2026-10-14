/**
 * Malaysian postal address in the usual letter form, one part per line:
 *   No. 125-2, Jalan Lavender Heights 3,
 *   Pusat Perniagaan Lavender Heights,
 *   70400 Seremban,
 *   Negeri Sembilan.
 * Stored on the client as one text (lines joined by "\n"), so letters print it as typed.
 */
export const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya',
];

export interface AddressParts { line1: string; line2: string; postcode: string; city: string; state: string }

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[,.;]+$/, '').trim();
const stateOf = (s: string) => {
  const t = clean(s).toLowerCase().replace(/^(wilayah persekutuan|w\.?\s?p\.?)\s*/, '');
  return MY_STATES.find((x) => x.toLowerCase().replace(/^w\.p\. /, '') === t) || '';
};

/** Splits a saved address (lines or one comma-separated line) into its parts. */
export const parseAddress = (text?: string): AddressParts => {
  const t = String(text || '');
  // Saved in letter form → one part per line (commas inside a line stay); else a one-line address.
  const parts = (t.includes('\n') ? t.split('\n') : t.split(',')).map(clean).filter(Boolean);
  if (parts.length && /^malaysia$/i.test(parts[parts.length - 1])) parts.pop();
  const out: AddressParts = { line1: '', line2: '', postcode: '', city: '', state: '' };
  const pc = parts.findIndex((p) => /^\d{5}\b/.test(p));
  let head = parts;
  if (pc >= 0) {
    const m = parts[pc].match(/^(\d{5})\s*(.*)$/)!;
    out.postcode = m[1];
    out.city = m[2];
    const rest = parts.slice(pc + 1);
    const st = rest.map(stateOf).find(Boolean);
    if (st) out.state = st;
    else if (!out.city && rest.length) out.city = rest[0];
    head = parts.slice(0, pc);
  } else if (parts.length && stateOf(parts[parts.length - 1])) {
    out.state = stateOf(parts[parts.length - 1]);
    head = parts.slice(0, -1);
  }
  out.line1 = head[0] || '';
  out.line2 = head.slice(1).join(', ');
  return out;
};

/** Joins the parts in the usual letter form (comma at each line end, full stop after the last). */
export const formatAddress = (a: AddressParts): string => {
  const lines = [clean(a.line1), clean(a.line2), clean([a.postcode, a.city].filter((x) => clean(x)).join(' ')), clean(a.state)].filter(Boolean);
  return lines.map((l, i) => l + (i === lines.length - 1 ? '.' : ',')).join('\n');
};
