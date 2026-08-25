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

  // 2. Scan against Active Cases (Opposing parties & Matter titles)
  allCases.forEach((cs) => {
    const oppParty = (cs.opposingParty || '').toLowerCase();
    const caseTitle = (cs.title || '').toLowerCase();

    if (queryName.length >= 3 && oppParty.includes(queryName)) {
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

/**
 * Scans an opposing party name against firm clients to verify if they are active clients.
 */
export const scanOpposingPartyConflicts = (
  opposingPartyName: string,
  allClients: Client[],
  allCases: Case[]
): ConflictMatch[] => {
  const matches: ConflictMatch[] = [];
  const query = (opposingPartyName || '').trim().toLowerCase();
  if (!query || query.length < 3) return matches;

  allClients.forEach((c) => {
    const clientName = (c.name || '').toLowerCase();
    if (clientName.includes(query) || query.includes(clientName)) {
      matches.push({
        label: `⚠️ ADVERSE CLIENT CONFLICT (${c.id})`,
        detail: `Opposing party "${opposingPartyName}" is an active client of SHCO Law Firm ("${c.name}" - ${c.id})`,
      });
    }
  });

  allCases.forEach((cs) => {
    const title = (cs.title || '').toLowerCase();
    if (title.includes(query)) {
      matches.push({
        label: `Existing Matter Match (${cs.ref})`,
        detail: `Opposing party named in existing matter "${cs.title}" (${cs.ref})`,
      });
    }
  });

  return matches;
};
