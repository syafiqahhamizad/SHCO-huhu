import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';
import type { User } from '../types';

/**
 * Owner-managed access list: `practiceSystem/access`.
 *
 * Replaces the old Cloud-Function custom claims. firestore.rules and storage.rules read
 * this document to decide who may use the portal:
 *
 *   { users: { <emailKey>: { email, role, admin, active, billing? } }, updatedAt, updatedBy }
 *
 * billing ('none' | 'view' | 'edit') is the Super Admin's per-person choice for billing & money;
 * absent = by role (partners, accountants, reviewers see; partners, accountants edit).
 *
 * emailKey = lowercase email with every '.' replaced by ',' so it is a plain map key and
 * the rules can compute it from the ID token:
 *   request.auth.token.email.lower().replace('\\.', ',')
 *
 * Only the Managing Partner (owner, hardcoded in the rules) can write it.
 */

export const ACCESS_OWNER_EMAIL = 'syafiqahhamizad@shcolaw.com';

const ACCESS_ROLES = ['partner', 'lawyer', 'assistant', 'accountant', 'reviewer', 'client'] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export interface AccessEntry {
  email: string;
  role: AccessRole;
  admin: boolean;
  active: boolean;
  billing?: 'none' | 'view' | 'edit';
}

export type AccessUsers = Record<string, AccessEntry>;

const accessRef = doc(firestoreDb, 'practiceSystem', 'access');

export const emailToAccessKey = (email: string): string => email.trim().toLowerCase().replace(/\./g, ',');

const isAccessRole = (value: string): value is AccessRole => (ACCESS_ROLES as readonly string[]).includes(value);

/**
 * Derives the access list from the real Users & Roles roster. People whose role is a
 * custom role (not one the rules understand) are left out and returned in `skipped`.
 */
export function buildAccessList(users: User[]): { users: AccessUsers; skipped: User[] } {
  const out: AccessUsers = {};
  const skipped: User[] = [];
  for (const u of users) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    const role = String(u.role || '').trim().toLowerCase();
    if (!isAccessRole(role)) {
      skipped.push(u);
      continue;
    }
    const entry: AccessEntry = {
      email,
      role,
      admin: role !== 'client' && role !== 'reviewer' && Boolean(u.isAdmin || u.isSuperAdmin),
      active: u.status !== 'Inactive',
    };
    if (u.billingAccess && role !== 'client') entry.billing = u.billingAccess;
    const key = emailToAccessKey(email);
    const prev = out[key];
    // Duplicate roster rows for one email: the active one wins.
    if (!prev || (!prev.active && entry.active)) out[key] = entry;
  }
  return { users: out, skipped };
}

const sameEntry = (a?: AccessEntry, b?: AccessEntry) =>
  Boolean(a && b && a.email === b.email && a.role === b.role && a.admin === b.admin && a.active === b.active && (a.billing || '') === (b.billing || ''));

export interface AccessChange {
  key: string;
  email: string;
  before?: AccessEntry;
  after?: AccessEntry;
  /** True when the change gives someone more access than the published list does. */
  grants: boolean;
  label: string;
}

const describe = (e?: AccessEntry) =>
  !e ? 'no access' : `${e.role}${e.admin ? ' + admin' : ''}${e.billing ? ' · billing ' + e.billing : ''}${e.active ? '' : ' (switched off)'}`;

/** How much billing access an entry gives (0 none, 1 see, 2 see & edit), role default when unset. */
export const billingRank = (e: AccessEntry): number =>
  e.billing === 'none' ? 0 : e.billing === 'view' ? 1 : e.billing === 'edit' ? 2
    : ['partner', 'accountant'].includes(e.role) ? 2 : e.role === 'reviewer' ? 1 : 0;

/** Every difference between the published list and the desired one. */
export function diffAccessLists(published: AccessUsers | null, desired: AccessUsers): AccessChange[] {
  const base = published || {};
  const keys = new Set([...Object.keys(base), ...Object.keys(desired)]);
  const changes: AccessChange[] = [];
  for (const key of keys) {
    const before = base[key];
    const after = desired[key];
    if (sameEntry(before, after)) continue;
    const beforeLive = Boolean(before?.active);
    const afterLive = Boolean(after?.active);
    const grants =
      afterLive &&
      (!beforeLive || before!.role !== after!.role || (!before!.admin && after!.admin) || billingRank(after!) > billingRank(before!));
    changes.push({
      key,
      email: after?.email || before?.email || key.replace(/,/g, '.'),
      before,
      after,
      grants,
      label: `${describe(before)} → ${describe(after)}`,
    });
  }
  return changes.sort((a, b) => a.email.localeCompare(b.email));
}

/** Applies a subset of changes on top of the published list. */
export function applyAccessChanges(published: AccessUsers | null, changes: AccessChange[]): AccessUsers {
  const next: AccessUsers = { ...(published || {}) };
  for (const c of changes) {
    if (c.after) next[c.key] = c.after;
    else delete next[c.key];
  }
  return next;
}

/** Reads the whole list. Only the owner (and listed, active, verified users) may read it. */
export async function readAccessList(): Promise<AccessUsers | null> {
  const snap = await getDoc(accessRef);
  if (!snap.exists()) return null;
  const data = snap.data() as { users?: AccessUsers };
  return data.users && typeof data.users === 'object' ? data.users : {};
}

/**
 * The signed-in person's own entry, for sign-in. Returns `readable: false` when the rules
 * refused the read — i.e. the person isn't on the published list (or isn't active, or
 * hasn't verified their email yet), or the list hasn't been published at all.
 */
export async function readOwnAccessEntry(email: string): Promise<{ entry: AccessEntry | null; readable: boolean }> {
  try {
    const list = await readAccessList();
    return { entry: list?.[emailToAccessKey(email)] ?? null, readable: true };
  } catch (error) {
    const code = String((error as { code?: string })?.code || '');
    if (code === 'permission-denied') return { entry: null, readable: false };
    throw error;
  }
}

/** Replaces the whole list (owner only — enforced by firestore.rules). */
export async function publishAccessList(users: AccessUsers, updatedBy: string): Promise<void> {
  await setDoc(accessRef, { users, updatedAt: serverTimestamp(), updatedBy });
}

export const accessRoleToAppRole = (role: AccessRole): User['role'] =>
  role === 'partner' ? 'Partner'
    : role === 'lawyer' ? 'Lawyer'
      : role === 'assistant' ? 'Assistant'
        : role === 'accountant' ? 'Accountant'
          : role === 'reviewer' ? 'Reviewer'
            : 'Client';
