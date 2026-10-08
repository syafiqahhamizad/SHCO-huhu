/**
 * Layout of the firm's data after the database split (pure — no Firebase here).
 *
 * Before: one Firestore document `practiceSystem/sharedState` holding every list. Anyone signed
 * in could read all of it (salaries, IC numbers, books), it was capped at 1 MB, and each save
 * rewrote whole lists, so two people saving at once could undo each other's work.
 *
 * After: one document per record under `firm/main/<collection>/<docId>`, and a few settings
 * documents under `firm/main/config/<name>`. Each collection has a tier that the Firestore rules
 * enforce (see firestore.rules):
 *   firm  — every firm user reads and writes (files, clients, time, claims, leave, logs …)
 *   books — partners, accountants, reviewers (read only), admins, the owner (ledgers, bank,
 *           journals, and client billing: quotations, invoices, payments, receipts and
 *           client-account entries — lawyers and assistants see no billing at all)
 *   hr    — partners, accountants, admins, the owner; everyone else only their OWN document
 *           (payslips, the private part of staff profiles: IC, bank, pay, address …)
 *   users — every firm user reads; admins/owner write; a person may update their own
 *           non-sensitive fields (never role / admin / status / email / permissions)
 *   own   — only the person it belongs to, nobody else (private to-dos)
 */
import type { StaffProfile, User } from '../types';

export type Tier = 'firm' | 'books' | 'hr' | 'users' | 'own' | 'claims';

export interface CollectionDef {
  /** The AppContext / old sharedState key. */
  key: string;
  tier: Tier;
  /** Record key used for the document id (before making it safe). */
  idOf: (r: Record<string, unknown>) => string;
}

const byId = (r: Record<string, unknown>) => String(r.id ?? '');

const def = (key: string, tier: Tier, idOf: CollectionDef['idOf'] = byId): CollectionDef => ({ key, tier, idOf });

/** Every list the app keeps. `users` is split into `users` (public) + `staffPrivate` (hr). */
export const COLLECTIONS: CollectionDef[] = [
  ...['leads', 'clients', 'cases', 'referralPartners', 'deadlines', 'attendanceRecords', 'leaveApplications', 'meetings', 'programmes', 'notifications',
    'lawFirmRegistry', 'deletedRecords', 'timeEntries', 'announcements', 'auditLogs', 'firmStartCentrePages', 'inventoryItems',
  ].map((k) => def(k, 'firm')),
  def('logs', 'firm', (r) => 'LOG-' + hash([r.ts, r.user, r.action, r.details].map(String).join('|'))),
  ...['quotations', 'invoices', 'payments', 'receipts', 'retainers'].map((k) => def(k, 'books')),
  ...['manualJournals', 'bankAccounts', 'bankReconciliationEntries', 'trustAuditLogs'].map((k) => def(k, 'books')),
  def('generalLedger', 'books', (r) => 'GL-' + String(r.glNo ?? '') + '-' + String(r.docNo ?? '')),
  def('clientAccountChecks', 'books', (r) => String(r.itemKey ?? '')),
  def('payslips', 'hr'),
  // Claims and payment vouchers: the person who made it, or finance.
  ...['travelClaims', 'expenses', 'paymentVouchers'].map((k) => def(k, 'claims')),
  def('privateTodos', 'own'),
  def('staffPrivate', 'hr'),
  def('users', 'users'),
];

export const COLLECTION_KEYS = COLLECTIONS.map((c) => c.key);
export const collectionDef = (key: string) => COLLECTIONS.find((c) => c.key === key);

/** Single settings documents: firm/main/config/<name> = { value }. */
export const CONFIG_KEYS = ['sequenceCounters', 'rolesMatrix', 'customRoles', 'practiceSettings'] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

/** Who may read each tier, by access-list role (lowercase, as in practiceSystem/access). */
export const TIER_READERS: Record<Tier, string[]> = {
  firm: ['partner', 'lawyer', 'assistant', 'accountant', 'reviewer'],
  users: ['partner', 'lawyer', 'assistant', 'accountant', 'reviewer'],
  books: ['partner', 'accountant', 'reviewer'],
  hr: ['partner', 'accountant'],
  own: [],
  claims: ['partner', 'accountant', 'reviewer'],
};

/** Can this person read the whole collection? The owner always can; admins only for non-finance
 * tiers; for books / claims the Super Admin's per-person billing choice wins over the role. */
export const canReadTier = (tier: Tier, role: string, isAdminOrOwner: boolean, isOwner = false, billing: '' | 'none' | 'view' | 'edit' = '') => {
  if (tier === 'own') return false;
  if (isOwner) return true;
  if (tier === 'books' || tier === 'claims') return billing ? billing !== 'none' : TIER_READERS[tier].includes(role.toLowerCase());
  return isAdminOrOwner || TIER_READERS[tier].includes(role.toLowerCase());
};

/** Small stable string hash (FNV-1a, hex) for records without an id. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Firestore ids can't contain '/', be '.' / '..', or start with '__'. */
export const safeDocId = (id: string) => {
  const s = (id || '').replace(/\//g, '∕').replace(/^__/, '_‗');
  return !s || s === '.' || s === '..' ? 'id-' + hash(id || 'empty') : s.slice(0, 700);
};

/**
 * Document ids for a list, in order. A repeated id (old data can have duplicates) gets
 * `~2`, `~3` … so no record is lost by collapsing onto the same document.
 */
export function docIdsFor(key: string, list: Record<string, unknown>[]): string[] {
  const d = collectionDef(key);
  const seen = new Map<string, number>();
  return list.map((r) => {
    const raw = safeDocId(d ? d.idOf(r) : byId(r));
    const n = (seen.get(raw) || 0) + 1;
    seen.set(raw, n);
    return n === 1 ? raw : raw + '~' + n;
  });
}

/** JSON copy without `undefined` (Firestore rejects it) and with keys sorted, for comparing. */
export const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

/* ------------------------------------------------------------------ staff profiles */

/** Staff-profile fields everyone in the firm may see (names, role, phone, targets …). The rest is private. */
const PUBLIC_PROFILE_FIELDS: (keyof StaffProfile)[] = [
  'staffId', 'fullName', 'designation', 'department', 'phone', 'joinDate', 'employmentType', 'officeLocation', 'bio',
  'birthday', 'callToBarDate', 'celebrationOptOut', 'targets', 'targetHoursPerMonth',
];

/** Fields on the user record only admins / the owner may change. */
export const PROTECTED_USER_FIELDS = ['id', 'email', 'role', 'isAdmin', 'isSuperAdmin', 'status', 'navOverrides', 'code'];

/** Split a user into the public user document and the private staff-profile document. */
export function splitUser(u: User): { pub: Record<string, unknown>; priv: Record<string, unknown> | null } {
  const { staffProfile, clientPassword: _pw, ...rest } = u as User & { clientPassword?: string };
  if (!staffProfile) return { pub: clean(rest), priv: null };
  const pubProfile: Record<string, unknown> = {};
  const privProfile: Record<string, unknown> = {};
  Object.entries(staffProfile).forEach(([k, v]) => {
    if (v === undefined) return;
    if ((PUBLIC_PROFILE_FIELDS as string[]).includes(k)) pubProfile[k] = v;
    else privProfile[k] = v;
  });
  const pub = clean({ ...rest, staffProfile: pubProfile });
  const priv = Object.keys(privProfile).length ? clean({ id: u.id, _ownerEmail: (u.email || '').toLowerCase(), profile: privProfile }) : null;
  return { pub, priv };
}

/** Put the private profile parts (the ones this person may read) back onto the users. */
export function mergeUsers(pub: User[], priv: { id: string; profile?: Record<string, unknown> }[]): User[] {
  const byUser = new Map(priv.map((p) => [p.id, p.profile || {}]));
  return pub.map((u) => {
    const p = byUser.get(u.id);
    return p ? { ...u, staffProfile: { ...(u.staffProfile || {}), ...p } as StaffProfile } : u;
  });
}

/* ------------------------------------------------------------------ change detection */

export interface DocWrite { id: string; data: Record<string, unknown> | null }

/**
 * What to write so the server matches `next`: changed/new documents and deletions, compared
 * with what the server last had (`last`: docId → stable JSON). Nothing is written for records
 * that did not change, so two people editing different records never undo each other.
 */
export function diffDocs(next: Map<string, Record<string, unknown>>, last: Map<string, string>): DocWrite[] {
  const out: DocWrite[] = [];
  next.forEach((data, id) => { if (last.get(id) !== stableStringify(data)) out.push({ id, data }); });
  last.forEach((_s, id) => { if (!next.has(id)) out.push({ id, data: null }); });
  return out;
}

/** The documents for one list: docId → cleaned record (adds `_ownerEmail` to payslips). */
export function docsFor(key: string, list: Record<string, unknown>[], ownerEmailOf?: (userId: string) => string): Map<string, Record<string, unknown>> {
  const ids = docIdsFor(key, list);
  const m = new Map<string, Record<string, unknown>>();
  list.forEach((r, i) => {
    const data = clean(r) as Record<string, unknown>;
    if (key === 'payslips' && ownerEmailOf) data._ownerEmail = ownerEmailOf(String(r.userId || ''));
    // Claims / payment vouchers belong to the person who made them (by name or user id).
    if (ownerEmailOf && (key === 'travelClaims' || key === 'expenses')) data._ownerEmail = ownerEmailOf(String(r.claimantId || r.claimant || ''));
    if (ownerEmailOf && key === 'paymentVouchers') data._ownerEmail = ownerEmailOf(String(r.preparedById || r.preparedBy || r.claimant || ''));
    if (key === 'privateTodos') data._ownerEmail = String(r.ownerEmail || '').toLowerCase();
    m.set(ids[i], data);
  });
  return m;
}

/** Strip helper fields the app never stored itself. */
export const fromDoc = <T>(data: Record<string, unknown>): T => {
  const { _ownerEmail: _o, ...rest } = data;
  return rest as T;
};

/* ------------------------------------------------------------------ sync bookkeeping */

export type ReadScope = 'all' | 'own' | 'none';

/**
 * Remembers what the server has, per collection, so only real changes are written and a live
 * update from someone else never overwrites an edit made here that is still on its way.
 */
export class SyncLedger {
  private last = new Map<string, Map<string, string>>();
  readonly scope = new Map<string, ReadScope>();

  /** Merge a live snapshot with local edits not yet saved; returns the documents to show. */
  merge(key: string, incoming: Map<string, Record<string, unknown>>, local: Map<string, Record<string, unknown>>, scope: ReadScope): Map<string, Record<string, unknown>> {
    const prev = this.last.get(key) || new Map<string, string>();
    const result = new Map<string, Record<string, unknown>>();
    // Local order first (so lists don't jump around), then documents new from the server.
    local.forEach((data, id) => {
      const pending = prev.get(id) !== stableStringify(data); // edited here, not yet confirmed
      if (incoming.has(id)) result.set(id, pending && this.scope.has(key) ? data : incoming.get(id)!);
      else if (!prev.has(id) && this.scope.has(key)) result.set(id, data); // added here, not saved yet
      // else: removed on the server (or first load) → drop
    });
    incoming.forEach((data, id) => { if (!result.has(id)) result.set(id, data); });
    this.last.set(key, new Map([...incoming].map(([id, d]) => [id, stableStringify(d)])));
    this.scope.set(key, scope);
    return result;
  }

  /** Writes needed for `next`, limited to what this person may write in their read scope. */
  changes(key: string, next: Map<string, Record<string, unknown>>, myEmail: string): DocWrite[] {
    const scope = this.scope.get(key);
    if (!scope || scope === 'none') return [];
    let target = next;
    if (scope === 'own') target = new Map([...next].filter(([, d]) => String(d._ownerEmail || '') === myEmail.toLowerCase()));
    const prev = this.last.get(key) || new Map<string, string>();
    const w = diffDocs(target, prev);
    if (scope !== 'own') return w;
    // Own scope: never deletes, except withdrawing your own claim / payment request.
    const mineBefore = (id: string) => { try { return String(JSON.parse(prev.get(id) || '{}')._ownerEmail || '') === myEmail.toLowerCase(); } catch { return false; } };
    const canWithdraw = collectionDef(key)?.tier === 'claims';
    return w.filter((x) => x.data !== null || (canWithdraw && mineBefore(x.id)));
  }

  /** After a successful write: the server now has these. */
  confirm(key: string, writes: DocWrite[]) {
    const m = this.last.get(key) || new Map<string, string>();
    writes.forEach((w) => { if (w.data) m.set(w.id, stableStringify(w.data)); else m.delete(w.id); });
    this.last.set(key, m);
  }

  isReady(key: string) { const s = this.scope.get(key); return !!s && s !== 'none'; }
}
