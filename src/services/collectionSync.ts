import {
  collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where, writeBatch,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { firestoreDb as db } from './firestoreSyncService';
import {
  clean, collectionDef, COLLECTIONS, CONFIG_KEYS, docsFor, splitUser,
  type ConfigKey, type DocWrite, type ReadScope,
} from './firmData';
import type { User } from '../types';

/**
 * Firestore side of the database split (layout and tiers: firmData.ts, rules: firestore.rules).
 *   firm/main                       meta { state: 'migrating' | 'done', … }
 *   firm/main/<collection>/<docId>  one record each
 *   firm/main/config/<name>         { value } — sequenceCounters, rolesMatrix, customRoles, practiceSettings
 */
const metaRef = doc(db, 'firm', 'main');
const colRef = (key: string) => collection(db, 'firm', 'main', key);
const configRef = (name: string) => doc(db, 'firm', 'main', 'config', name);

export type SplitState = 'none' | 'migrating' | 'done';

export async function readSplitState(): Promise<SplitState> {
  const snap = await getDoc(metaRef);
  if (!snap.exists()) return 'none';
  return snap.data().state === 'done' ? 'done' : 'migrating';
}

/* ------------------------------------------------------------------ one-time move */

/**
 * Copies the old single document into the collections. Owner only (rules). Marks `firm/main`
 * as migrating first — from then on nobody can write the old document — then writes every
 * record and finally marks it done. The old document is left in place, owner-readable, as a backup.
 * Safe to run again after an interruption: every write is a full set of the same document.
 */
export async function migrateToCollections(readOld: () => Promise<Record<string, unknown> | null>, by: string, onProgress?: (msg: string) => void): Promise<Record<string, number>> {
  await runTransaction(db, async (tx) => {
    const m = await tx.get(metaRef);
    if (m.exists() && m.data().state === 'done') throw new Error('Already split');
    tx.set(metaRef, { state: 'migrating', startedAt: serverTimestamp(), by });
  });
  // Read the old document only now: from this point nobody can change it (rules), so nothing
  // saved in the meantime is missed.
  const state = (await readOld()) || {};

  const users = (Array.isArray(state.users) ? state.users : []) as User[];
  const emailOf = (id: string) => (users.find((u) => u.id === id)?.email || '').toLowerCase();
  const counts: Record<string, number> = {};
  const writes: { key: string; id: string; data: DocumentData }[] = [];

  for (const def of COLLECTIONS) {
    if (def.key === 'users' || def.key === 'staffPrivate') continue;
    const list = (Array.isArray(state[def.key]) ? state[def.key] : []) as Record<string, unknown>[];
    docsFor(def.key, list, emailOf).forEach((data, id) => writes.push({ key: def.key, id, data }));
    counts[def.key] = list.length;
  }
  users.forEach((u) => {
    const { pub, priv } = splitUser(u);
    writes.push({ key: 'users', id: String(u.id), data: pub });
    if (priv) writes.push({ key: 'staffPrivate', id: String(u.id), data: priv });
  });
  counts.users = users.length;

  for (let i = 0; i < writes.length; i += 400) {
    onProgress?.(`Copying records ${i + 1}–${Math.min(i + 400, writes.length)} of ${writes.length}`);
    const b = writeBatch(db);
    writes.slice(i, i + 400).forEach((w) => b.set(doc(colRef(w.key), w.id), w.data));
    await b.commit();
  }
  for (const name of CONFIG_KEYS) {
    if (state[name] !== undefined) await setDoc(configRef(name), { value: clean(state[name]) });
  }
  await setDoc(metaRef, { state: 'done', doneAt: serverTimestamp(), by, counts });
  return counts;
}

/* ------------------------------------------------------------------ reading */


/**
 * Live copy of one collection. Tries the whole collection; if the rules refuse (books / hr for
 * this person), HR collections fall back to the person's own documents and the rest to nothing.
 */
export function subscribeCollection(
  key: string,
  myEmail: string,
  onData: (docs: Map<string, Record<string, unknown>>, scope: ReadScope) => void,
): Unsubscribe {
  let unsub: Unsubscribe | undefined;
  let stopped = false;
  const listen = (scope: ReadScope) => {
    const q = scope === 'own' ? query(colRef(key), where('_ownerEmail', '==', myEmail.toLowerCase())) : colRef(key);
    unsub = onSnapshot(q, (snap) => {
      const m = new Map<string, Record<string, unknown>>();
      snap.forEach((d) => m.set(d.id, d.data() as Record<string, unknown>));
      onData(m, scope);
    }, (err) => {
      if (stopped) return;
      const denied = String((err as { code?: string }).code || '').includes('permission-denied');
      if (denied && scope === 'all' && collectionDef(key)?.tier === 'hr') listen('own');
      else { if (!denied) console.error('Live data for ' + key + ' stopped', err); onData(new Map(), 'none'); }
    });
  };
  listen('all');
  return () => { stopped = true; unsub?.(); };
}

export function subscribeConfig(onData: (name: ConfigKey, value: unknown) => void, onLoaded: () => void): Unsubscribe {
  return onSnapshot(collection(db, 'firm', 'main', 'config'), (snap) => {
    snap.forEach((d) => { if ((CONFIG_KEYS as readonly string[]).includes(d.id)) onData(d.id as ConfigKey, d.data().value); });
    onLoaded();
  }, (err) => console.error('Live settings stopped', err));
}

/** One-off read of everything this person may read, in the old single-document shape (backups, roster). */
export async function readAllAsState(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const lists: Record<string, Record<string, unknown>[]> = {};
  await Promise.all(COLLECTIONS.map(async (d) => {
    try {
      const snap = await getDocs(colRef(d.key));
      lists[d.key] = snap.docs.map((x) => { const { _ownerEmail: _o, ...rest } = x.data(); return rest; });
    } catch { lists[d.key] = []; }
  }));
  Object.entries(lists).forEach(([k, v]) => { if (k !== 'staffPrivate') out[k] = v; });
  const priv = new Map((lists.staffPrivate || []).map((p) => [String(p.id), (p.profile || {}) as Record<string, unknown>]));
  out.users = (lists.users || []).map((u) => (priv.has(String(u.id)) ? { ...u, staffProfile: { ...((u.staffProfile as object) || {}), ...priv.get(String(u.id)) } } : u));
  for (const name of CONFIG_KEYS) {
    try { const s = await getDoc(configRef(name)); if (s.exists()) out[name] = s.data().value; } catch { /* not readable */ }
  }
  return out;
}

/** A staff member's roster record by e-mail (sign-in on a new device, after the split). */
export async function findSplitUserByEmail(email: string): Promise<Record<string, unknown> | undefined> {
  if ((await readSplitState()) !== 'done') return undefined;
  const snap = await getDocs(query(colRef('users'), where('email', '==', email)));
  return snap.docs[0]?.data();
}

/* ------------------------------------------------------------------ writing */

/** Writes changed / new / removed documents for one collection (batches of 400). */
export async function writeDocs(key: string, writes: DocWrite[]): Promise<void> {
  for (let i = 0; i < writes.length; i += 400) {
    const b = writeBatch(db);
    writes.slice(i, i + 400).forEach((w) => (w.data ? b.set(doc(colRef(key), w.id), w.data) : b.delete(doc(colRef(key), w.id))));
    await b.commit();
  }
}

export async function writeConfig(name: ConfigKey, value: unknown): Promise<void> {
  await setDoc(configRef(name), { value: clean(value) });
}
