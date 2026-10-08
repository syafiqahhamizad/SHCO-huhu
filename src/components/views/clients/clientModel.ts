/**
 * Clients (design pack `Clients.dc.html`) — pure helpers over the real Client records.
 * Statuses are derived from what is stored (KYC documents, conflict check, portal access);
 * older records without the new optional fields are read through the fallbacks below.
 */
import { useSyncExternalStore } from 'react';
import type { Client, KycDoc } from '../../../types';
import { parseDate } from '../../../lib/financeCalc';

/* ------------------------------------------------------------------ tokens (design `P`) */
export const P = {
  g: { bg: '#E6EFE9', fg: '#1F5A3B' },
  a: { bg: '#F6EEDC', fg: '#8A6D3B' },
  n: { bg: '#EEF1F5', fg: '#4A5468' },
  r: { bg: '#F6E4E1', fg: '#8E2A20' },
  b: { bg: '#E4ECF5', fg: '#2F4F7A' },
} as const;
export type Pill = { t: string; bg: string; fg: string };

/* ------------------------------------------------------------------ selected client (shared with the Header) */
let selected: string | null = null;
const subs = new Set<() => void>();
export const clientsNav = {
  get: () => selected,
  set: (id: string | null) => { selected = id; subs.forEach((f) => f()); },
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};
export const useSelectedClientId = () => useSyncExternalStore(clientsNav.subscribe, clientsNav.get, clientsNav.get);

/* ------------------------------------------------------------------ KYC */
export type KycReqKey = 'nric' | 'addr' | 'sof' | 'ssm' | 'einfo' | 'br' | 'dir';
/** Required documents by client type: [key, label, hint]. */
const KYC_REQUIREMENTS: Record<Client['type'], [KycReqKey, string, string][]> = {
  Individual: [
    ['nric', 'NRIC / passport copy', 'Front and back, clear copy'],
    ['addr', 'Proof of address', 'Utility bill or bank statement, not older than 3 months'],
    ['sof', 'Source of funds declaration', 'Required for conveyancing and client-account deposits'],
  ],
  Corporate: [
    ['ssm', 'SSM certificate', 'Section 17 (or Form 9 for older companies)'],
    ['einfo', 'SSM company profile', 'e-Info printout, not older than 3 months'],
    ['br', 'Board resolution', 'Appointing the firm and naming who instructs us'],
    ['dir', 'NRIC of directors / signatory', 'Everyone who signs or instructs on behalf of the company'],
  ],
};

/** Older uploads have no `requirement`; match them by the category they were filed under. */
export const requirementOf = (k: KycDoc, type: Client['type']): KycReqKey | null => {
  if (k.requirement) return k.requirement as KycReqKey;
  const t = String(k.type || '').toLowerCase();
  if (/identity|nric|passport/.test(t)) return type === 'Corporate' ? 'dir' : 'nric';
  if (/proof of address|utility/.test(t)) return type === 'Individual' ? 'addr' : null;
  if (/source of funds/.test(t)) return type === 'Individual' ? 'sof' : null;
  if (/ssm|roc/.test(t)) return type === 'Corporate' ? 'ssm' : null;
  if (/director|beneficial/.test(t)) return type === 'Corporate' ? 'dir' : null;
  if (/board resolution|authority/.test(t)) return type === 'Corporate' ? 'br' : null;
  return null;
};

type KycState = 'Missing' | 'To verify' | 'Verified';
export const KYC_PILL: Record<KycState, Pill> = {
  Missing: { t: 'Missing', ...P.a },
  'To verify': { t: 'To verify', ...P.b },
  Verified: { t: 'Verified', ...P.g },
};

const uploadedOf = (k: KycDoc) => k.uploadedAt || k.uploadedDate || '';
/**
 * One required document's state. Latest upload wins.
 * Verified: marked verified (or an older upload on a client whose CDD records a verification).
 * KYC documents do not expire (firm rule).
 */
export const kycRowOf = (c: Client, key: KycReqKey): { state: KycState; doc?: KycDoc } => {
  const docs = (c.kyc || []).filter((k) => requirementOf(k, c.type) === key).sort((a, b) => parseDate(uploadedOf(b)) - parseDate(uploadedOf(a)));
  const doc = docs[0];
  if (!doc) return { state: 'Missing' };
  const verified = doc.status ? doc.status === 'Verified' : !!c.cdd?.verifiedAt;
  if (verified) return { state: 'Verified', doc };
  return { state: 'To verify', doc };
};

export const kycRowsOf = (c: Client) =>
  (KYC_REQUIREMENTS[c.type] || KYC_REQUIREMENTS.Individual).map(([key, label, hint]) => ({ key, label, hint, ...kycRowOf(c, key) }));

/** Overall KYC: Complete / Incomplete (design kycOf). */
export const kycOverall = (c: Client): Pill & { done: boolean } => {
  const st = kycRowsOf(c).map((r) => r.state);
  if (st.every((x) => x === 'Verified')) return { t: 'Complete', ...P.g, done: true };
  return { t: 'Incomplete', ...P.a, done: false };
};

/** Uploads not matched to a required document (kept and still openable). */
export const otherKycDocs = (c: Client) => (c.kyc || []).filter((k) => !requirementOf(k, c.type));

/* ------------------------------------------------------------------ conflict */
type ConflictState = 'Clear' | 'Pending Partner Review' | 'Flagged' | 'Not Started';
export const conflictOf = (c: Client): ConflictState => (c.conflictCheck?.status || 'Not Started');
export const conflictPill = (c: Client): Pill => {
  const s = conflictOf(c);
  return s === 'Flagged' ? { t: 'Flagged', ...P.r } : s === 'Pending Partner Review' ? { t: 'Partner review', ...P.b } : s === 'Clear' ? { t: 'Clear', ...P.g } : { t: 'Not checked', ...P.n };
};

/* ------------------------------------------------------------------ portal */
export type PortalStatus = NonNullable<Client['portal']>['status'];
export type PortalVisibility = NonNullable<Client['portal']>['visibility'];
const DEFAULT_VISIBILITY: PortalVisibility = { progress: true, documents: true, bills: true, statement: true, messages: true };
/** Portal status; older records: login created → Active, invite only → Invited. */
const portalStatusOf = (c: Client): PortalStatus =>
  c.portal?.status || (c.portalAccessEnabled ? 'Active' : c.lastPortalInviteSent ? 'Invited' : 'Not set up');
export const portalOf = (c: Client): NonNullable<Client['portal']> => ({
  status: portalStatusOf(c),
  loginEmail: c.portal?.loginEmail || c.email || undefined,
  invitedAt: c.portal?.invitedAt || c.lastPortalInviteSent || undefined,
  visibility: { ...DEFAULT_VISIBILITY, ...(c.portal?.visibility || {}) },
});
export const portalPill = (c: Client): Pill => {
  const s = portalStatusOf(c);
  return { t: s, ...(s === 'Active' ? P.g : s === 'Invited' ? P.b : P.n) };
};

/* ------------------------------------------------------------------ display */
export const idNoOf = (c: Client) => (c.type === 'Corporate' ? c.registrationNo || c.icNo || '' : c.icNo || c.icNumber || '');
export const initials = (n: string) => String(n || '')
  .replace(/^(Tan Sri|Dato' Sri|Datuk Seri|Dato'|Datuk|Datin|Dr\.|Ir\.|Puan|Encik|Cik|Tuan|Mr\.?|Mrs\.?|Ms\.?)\s+/gi, '')
  .split(/\s+/).filter((w) => w && !/^(bin|binti|a\/l|a\/p|sdn|bhd|berhad)$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const ddmmyyyy = (s?: string) => {
  const t = parseDate(s); if (!t) return '';
  const d = new Date(t);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
};
export const rmWhole = (n: number) => 'RM ' + Math.round(Number(n) || 0).toLocaleString('en-MY');
