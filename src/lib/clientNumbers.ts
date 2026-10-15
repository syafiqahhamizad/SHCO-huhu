import { formatDocNo, maxNumAnyYear, validFormat } from './docNumbers';
/**
 * Client numbers: one style for every client, CL<YY><NNN> with no dashes (e.g. CL26833).
 *  - year: the year the client's first file was opened (else the year the client was registered);
 *  - NNN: one firm-wide running number (3 digits, grows past 999), in the order clients came in.
 * The client's internal key (Client.id) never changes, so files, bills and receipts stay linked;
 * the number is what people see, search and sign in with, and names the client's Drive folder.
 */
export interface NumberingClient { id: string; createdAt?: string; clientNo?: string }
export interface NumberingFile { clientIds: string[]; opened: string }

const yearOf = (iso?: string) => {
  const m = String(iso || '').match(/^(\d{4})-\d{2}-\d{2}/);
  return m ? Number(m[1]) : 0;
};
/** Default style; the firm can change it in Settings › Document numbering (key "client"). */
export const CLIENT_FORMAT = 'CL{YY}{000}';
/** The running number in a client number: the firm's format, CL26833 or the older CL-2026-833. */
const runOf = (no: string | undefined, fmt: string) => Math.max(maxNumAnyYear([String(no || '')], fmt), maxNumAnyYear([String(no || '')], CLIENT_FORMAT), maxNumAnyYear([String(no || '')], 'CL-{YYYY}-{000}'));
const fmtNo = (year: number, n: number, fmt = CLIENT_FORMAT) => formatDocNo(validFormat(fmt) ? fmt : CLIENT_FORMAT, year, n);
/** Same client number written either way (CL-2026-833 = CL26833), for searching and signing in. */
export const sameClientNo = (a?: string, b?: string) => { const n = (x?: string) => String(x || '').trim().toUpperCase().replace(/^CL-(\d{2})(\d{2})-(\d{3,})$/, 'CL$2$3').replace(/-/g, ''); return !!n(a) && n(a) === n(b); };

/** The number shown for a client (its client number, else its internal key for older records). */
export const clientRef = (c: { id: string; clientNo?: string }) => c.clientNo || c.id;

/** New numbers for all clients: id → CL<YY><NNN> (ordered by first file opened, then registration). */
export const numberClients = (clients: NumberingClient[], files: NumberingFile[], thisYear = new Date().getFullYear(), fmt = CLIENT_FORMAT): Map<string, string> => {
  const first = new Map<string, string>();
  files.forEach((f) => {
    if (!yearOf(f.opened)) return;
    f.clientIds.forEach((id) => { const cur = first.get(id); if (!cur || f.opened < cur) first.set(id, f.opened); });
  });
  const keyed = clients.map((c) => {
    const opened = first.get(c.id) || '';
    const reg = yearOf(c.createdAt) ? String(c.createdAt).slice(0, 10) : '';
    return { id: c.id, when: opened || reg || '9999-12-31', year: yearOf(opened) || yearOf(reg) || thisYear };
  });
  keyed.sort((a, b) => (a.when === b.when ? a.id.localeCompare(b.id, undefined, { numeric: true }) : a.when < b.when ? -1 : 1));
  return new Map(keyed.map((k, i) => [k.id, fmtNo(k.year, i + 1, fmt)]));
};

/** The next client number for a new client registered this year. */
export const nextClientNo = (existing: (string | undefined)[], year = new Date().getFullYear(), fmt = CLIENT_FORMAT): string => {
  const top = existing.reduce((m, n) => Math.max(m, runOf(n, fmt)), 0);
  return fmtNo(year, top + 1, fmt);
};
