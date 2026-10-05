import type { Case, Client } from '../types';

/**
 * Titles of the starter tasks older versions added to every new file automatically.
 * They were never entered by anyone, so untouched copies are removed when files load.
 */
const OLD_STARTER_TASKS = new Set([
  'Collect grant and beneficiary documents',
  'Conduct title and bankruptcy searches',
  'Confirm client instructions and opening documents',
  'Confirm transaction parties and authority documents',
  'Prepare execution and completion documents',
  'Prepare initial pleadings checklist',
  'Prepare mitigation or trial strategy',
  'Prepare pre-trial case management bundle',
  'Prepare probate or administration filing',
  'Prepare transaction documents for review',
  'Review charge sheet and client instructions',
  'Review limitation dates and filing deadlines',
]);

/** Drops untouched auto-made starter tasks; a task someone started, noted or synced is kept. */
export const withoutStarterTasks = (cases: Case[]): Case[] =>
  cases.map((c) => {
    const tasks = c.tasks || [];
    const kept = tasks.filter(
      (t) => !(OLD_STARTER_TASKS.has(t.title) && t.status === 'Not Started' && !t.notes && !t.googleTasksSynced && !t.completedAt)
    );
    return kept.length === tasks.length ? c : { ...c, tasks: kept };
  });

/**
 * Courtesy salutations are not used in client names (firm rule): Mr, Mrs, Ms, Miss, Mdm, Madam,
 * Encik / En., Puan / Pn., Cik, Tuan. Titles such as Dr, Dato', Datuk, Datin and Tan Sri stay.
 */
const SALUTATION = /^\s*(?:mr|mrs|ms|miss|mdm|madam|encik|en|puan|pn|cik|tuan)\b\.?\s+/i;
export const stripSalutation = (name: string) => (name || '').replace(SALUTATION, '').trim() || name;

/** Clients without salutations (name and the old separate salutation field). */
export const clientsWithoutSalutations = (clients: Client[]): Client[] =>
  clients.map((c) => {
    const name = stripSalutation(c.name);
    const old = c as Client & { salutation?: string }; // field removed; older records may still have it
    if (name === c.name && old.salutation === undefined) return c;
    const { salutation: _s, ...rest } = old;
    return { ...rest, name } as Client;
  });

/** Files: client and opposing-party names on each file, without salutations. */
export const casesWithoutSalutations = (cases: Case[]): Case[] =>
  cases.map((k) => {
    const clientName = k.clientName ? stripSalutation(k.clientName) : k.clientName;
    const list = (k.clientsList || []).map((p) => (p.name && stripSalutation(p.name) !== p.name ? { ...p, name: stripSalutation(p.name) } : p));
    const opposingParty = k.opposingParty ? stripSalutation(k.opposingParty) : k.opposingParty;
    const opposingParties = (k.opposingParties || []).map((n) => (typeof n === 'string' ? stripSalutation(n) : n));
    const opposingPartiesList = (k.opposingPartiesList || []).map((p) => (p.name && stripSalutation(p.name) !== p.name ? { ...p, name: stripSalutation(p.name) } : p));
    const changed = clientName !== k.clientName || opposingParty !== k.opposingParty
      || list.some((p, i) => p !== (k.clientsList || [])[i])
      || opposingParties.some((n, i) => n !== (k.opposingParties || [])[i])
      || opposingPartiesList.some((p, i) => p !== (k.opposingPartiesList || [])[i]);
    return changed ? { ...k, clientName, clientsList: list, opposingParty, opposingParties, opposingPartiesList } : k;
  });

/** Name fields on other records (documents, partners), cleaned the same way. Audit and activity logs are never changed. */
const NAME_FIELDS: Record<string, string[]> = {
  quotations: ['clientName'],
  invoices: ['partyName', 'clientName'],
  receipts: ['receivedFrom', 'payee'],
  paymentVouchers: ['payee'],
  referralPartners: ['name', 'contact'],
};

export const recordsWithoutSalutations = <T>(key: string, list: T[]): T[] => {
  const fields = NAME_FIELDS[key];
  if (!fields) return list;
  return list.map((r) => {
    const o = r as unknown as Record<string, unknown>;
    let next: Record<string, unknown> | null = null;
    fields.forEach((f) => {
      const v = o[f];
      if (typeof v === 'string' && stripSalutation(v) !== v) (next ||= { ...o })[f] = stripSalutation(v);
    });
    return (next || o) as unknown as T;
  });
};
