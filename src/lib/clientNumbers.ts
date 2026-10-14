/**
 * Client numbers: one style for every client, CL-<year>-<NNN>.
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
const NO = /^CL-(\d{4})-(\d{3,})$/;

/** The number shown for a client (its client number, else its internal key for older records). */
export const clientRef = (c: { id: string; clientNo?: string }) => c.clientNo || c.id;

/** New numbers for all clients: id → CL-YYYY-NNN (ordered by first file opened, then registration). */
export const numberClients = (clients: NumberingClient[], files: NumberingFile[], thisYear = new Date().getFullYear()): Map<string, string> => {
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
  return new Map(keyed.map((k, i) => [k.id, `CL-${k.year}-${String(i + 1).padStart(3, '0')}`]));
};

/** The next client number for a new client registered this year. */
export const nextClientNo = (existing: (string | undefined)[], year = new Date().getFullYear()): string => {
  const top = existing.reduce((m, n) => { const x = String(n || '').match(NO); return x ? Math.max(m, Number(x[2])) : m; }, 0);
  return `CL-${year}-${String(top + 1).padStart(3, '0')}`;
};
