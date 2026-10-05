import { Client, Case, ConflictMatch } from '../types';

/**
 * Scans a prospective or active client against existing firm records
 * (Clients & Active Cases) to detect potential conflicts of interest or adverse party relationships.
 */
export const scanClientConflicts = (
  clientData: {
    id?: string;
    name: string;
    icNo?: string;
    registrationNo?: string;
    email?: string;
    contactPerson?: string;
  },
  allClients: Client[],
  allCases: Case[]
): ConflictMatch[] => {
  const matches: ConflictMatch[] = [];
  const queryName = (clientData.name || '').trim().toLowerCase();
  const queryIc = (clientData.icNo || clientData.registrationNo || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  const queryEmail = (clientData.email || '').trim().toLowerCase();

  if (!queryName && !queryIc && !queryEmail) return matches;

  // 1. Scan against existing Clients
  allClients.forEach((c) => {
    if (clientData.id && c.id === clientData.id) return;
    const targetName = (c.name || '').toLowerCase();
    const targetIc = (c.icNo || c.icNumber || c.registrationNo || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    const targetEmail = (c.email || '').toLowerCase();

    // Direct or partial name match
    if (queryName.length >= 3 && targetName.length >= 3 && (targetName.includes(queryName) || queryName.includes(targetName))) {
      matches.push({
        label: `Existing Client Match (${c.id})`,
        detail: `Client profile match: "${c.name}" (${c.type}) — Phone: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}`,
      });
    } else if (queryIc.length >= 5 && targetIc.length >= 5 && targetIc === queryIc) {
      matches.push({
        label: `NRIC/SSM Match (${c.id})`,
        detail: `Identification number match with registered client "${c.name}" (${c.icNo || c.registrationNo})`,
      });
    } else if (queryEmail.length >= 5 && targetEmail === queryEmail) {
      matches.push({
        label: `Email Record Match (${c.id})`,
        detail: `Email address match with registered client "${c.name}" (${c.email})`,
      });
    }
  });

  // 2. Scan against every file (opposing parties in all their recorded forms & matter titles)
  allCases.forEach((cs) => {
    const caseTitle = (cs.title || '').toLowerCase();
    const opp = opposingPartiesOf(cs).find((p) => queryName.length >= 3 && p.toLowerCase().includes(queryName));

    if (opp) {
      matches.push({
        label: `⚠️ ADVERSE PARTY CONFLICT (${cs.ref})`,
        detail: `Client name "${clientData.name}" is listed as the Opposing Party/Defendant in Matter ${cs.ref} ("${cs.title}")`,
      });
    } else if (queryName.length >= 4 && caseTitle.includes(queryName)) {
      matches.push({
        label: `Related Case Record (${cs.ref})`,
        detail: `Client name referenced in Matter title: "${cs.title}"`,
      });
    }
  });

  return matches;
};


/** Every opposing party name on a file: the Working File parties list, the legacy list / names
 * ("1st Defendant: Name" entries) and the single opposingParty field. */
export const opposingPartiesOf = (cs: Case): string[] => {
  const names = [
    ...(cs.caseParties || []).filter((p) => p.side === 'opposing').map((p) => p.name),
    ...(cs.opposingPartiesList || []).map((p) => p.name),
    ...(cs.opposingParties || []).map((e) => { const s = String(e || ''); const k = s.indexOf(':'); return k > -1 ? s.slice(k + 1) : s; }),
    cs.opposingParty || '',
  ].map((n) => String(n || '').trim()).filter((n) => n && n !== 'N/A');
  return [...new Set(names)];
};

const SKIP = ['bin', 'binti', 'bt', 'bte', 'a/l', 'a/p', 'sdn', 'bhd', 'berhad', 'the', 'and'];
const idKey = (s?: string) => String(s || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

/**
 * Clients › Register new client: the as-you-type conflict check (design `Clients.dc.html`).
 * Matches the name (whole, or at least two significant words) and the NRIC / SSM no. against
 * existing clients and the opposing parties on every file. Returns plain sentences.
 */
export const registrationConflicts = (q: { name: string; idNo?: string }, clients: Client[], cases: Case[]): string[] => {
  const norm = (x: string) => String(x || '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9@]+/g, ' ').trim();
  const n = norm(q.name);
  const id = idKey(q.idNo);
  const words = n.split(' ').filter((w) => w.length > 3 && !SKIP.includes(w));
  const nameHit = (x: string) => {
    if (n.length < 4) return false;
    const l = norm(x);
    if (!l) return false;
    if (l.includes(n) || (l.length >= 4 && n.includes(l))) return true;
    return words.length > 0 && words.filter((w) => l.includes(w)).length >= Math.min(2, words.length);
  };
  const out: string[] = [];
  cases.forEach((cs) => {
    const oppIds = [...(cs.caseParties || []).filter((p) => p.side === 'opposing').map((p) => p.idNo), ...(cs.opposingPartiesList || []).map((p) => p.icOrRegNo)].map(idKey).filter((x) => x.length >= 5);
    opposingPartiesOf(cs).forEach((p) => {
      if (nameHit(p)) out.push(`${p} is the opposing party in ${cs.title || cs.ref} (${cs.ref}).`);
    });
    if (id.length >= 5 && oppIds.includes(id) && !out.some((o) => o.includes(`(${cs.ref})`))) out.push(`NRIC / SSM no. ${q.idNo} belongs to an opposing party in ${cs.title || cs.ref} (${cs.ref}).`);
  });
  clients.forEach((c) => {
    const cid = idKey(c.icNo || c.icNumber || c.registrationNo);
    if (nameHit(c.name)) out.push(`${c.name} is already a client (${c.id}).`);
    else if (id.length >= 5 && cid === id) out.push(`NRIC / SSM no. ${q.idNo} is already on client ${c.name} (${c.id}).`);
  });
  return [...new Set(out)];
};
