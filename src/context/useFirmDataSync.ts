import { useEffect, useRef } from 'react';
import { COLLECTIONS, docsFor, fromDoc, mergeUsers, splitUser, stableStringify, SyncLedger, type ConfigKey } from '../services/firmData';
import { subscribeCollection, subscribeConfig, subscribeFinanceConfig, writeConfig, writeDocs } from '../services/collectionSync';
import { applyCloudFinanceSettings } from '../services/templateService';
import type { User } from '../types';

type AnyList = Record<string, unknown>[];

/** Lists shown newest first: re-sorted on load so new items from others land on top. */
const NEWEST_FIRST: Record<string, string> = { notifications: 'timestamp', logs: 'ts', auditLogs: 'timestamp', trustAuditLogs: 'timestamp' };

export interface FirmDataSyncArgs {
  /** Signed in, not preview, and the firm's data is split. */
  enabled: boolean;
  /** The signed-in person's real e-mail (not a "View as" preview). */
  myEmail: string;
  /** Every list by key (users included, with full staff profiles). */
  lists: Record<string, AnyList>;
  setList: (key: string, list: AnyList) => void;
  config: Partial<Record<ConfigKey, unknown>>;
  setConfig: (name: ConfigKey, value: unknown) => void;
  /** Tidy-ups applied to records arriving from the server (e.g. drop deleted files). */
  incoming?: (key: string, list: AnyList) => AnyList;
  onReady: () => void;
  onRefused: (what: string) => void;
}

/**
 * Keeps the app's lists in step with the split database: live updates in, and only the
 * records that actually changed out. See collectionSync.ts / firmData.ts.
 */
export function useFirmDataSync(a: FirmDataSyncArgs) {
  const ledger = useRef(new SyncLedger());
  const listsRef = useRef(a.lists);
  listsRef.current = a.lists;
  const argsRef = useRef(a);
  argsRef.current = a;
  const prevLists = useRef<Record<string, AnyList>>({});
  const configLast = useRef<Partial<Record<ConfigKey, string>>>({});
  const configReady = useRef(false);

  const usersMeta = useRef<{ pub: AnyList; priv: AnyList; got: Set<string> }>({ pub: [], priv: [], got: new Set() });

  // ---- live data in
  useEffect(() => {
    if (!a.enabled) return;
    const L = new SyncLedger();
    ledger.current = L;
    prevLists.current = {};
    configReady.current = false;
    usersMeta.current = { pub: [], priv: [], got: new Set() };
    const expected = COLLECTIONS.length;
    const arrived = new Set<string>();
    let readyFired = false;
    const markArrived = (k: string) => {
      arrived.add(k);
      if (!readyFired && arrived.size >= expected) { readyFired = true; argsRef.current.onReady(); }
    };

    const localDocs = (key: string): Map<string, Record<string, unknown>> => {
      const cur = listsRef.current;
      if (key === 'users' || key === 'staffPrivate') {
        const m = new Map<string, Record<string, unknown>>();
        ((cur.users || []) as unknown as User[]).forEach((u) => {
          const { pub, priv } = splitUser(u);
          if (key === 'users') m.set(String(u.id), pub);
          else if (priv) m.set(String(u.id), priv);
        });
        return m;
      }
      return docsFor(key, (cur[key] || []) as AnyList, emailOf);
    };
    const emailOf = (id: string) => (((listsRef.current.users || []) as unknown as User[]).find((u) => u.id === id)?.email || '').toLowerCase();

    const unsubs = COLLECTIONS.map((def) => subscribeCollection(def.key, a.myEmail, (incoming, scope) => {
      const merged = L.merge(def.key, incoming, localDocs(def.key), scope);
      let list = [...merged.values()].map((d) => fromDoc<Record<string, unknown>>(d));
      if (def.key === 'users' || def.key === 'staffPrivate') {
        const um = usersMeta.current;
        if (def.key === 'users') um.pub = list; else um.priv = list;
        um.got.add(def.key);
        if (um.got.has('users') && um.got.has('staffPrivate')) {
          const users = mergeUsers(um.pub as unknown as User[], um.priv as unknown as { id: string; profile?: Record<string, unknown> }[]);
          argsRef.current.setList('users', users as unknown as AnyList);
        }
        markArrived(def.key);
        return;
      }
      const f = NEWEST_FIRST[def.key];
      if (f) list = list.sort((x, y) => String(y[f] || '').localeCompare(String(x[f] || '')));
      if (argsRef.current.incoming) list = argsRef.current.incoming(def.key, list);
      argsRef.current.setList(def.key, list);
      markArrived(def.key);
    }));

    const unsubConfig = subscribeConfig((name, value) => {
      configLast.current[name] = stableStringify(value);
      argsRef.current.setConfig(name, value);
    }, () => { configReady.current = true; });

    const unsubFinance = subscribeFinanceConfig((v) => applyCloudFinanceSettings(v));

    return () => { unsubs.forEach((u) => u()); unsubConfig(); unsubFinance(); };
  }, [a.enabled, a.myEmail]);

  // ---- local changes out
  useEffect(() => {
    if (!a.enabled) return;
    const L = ledger.current;
    const changed = Object.keys(a.lists).filter((k) => prevLists.current[k] !== a.lists[k]);
    prevLists.current = { ...a.lists };
    const emailOf = (id: string) => (((a.lists.users || []) as unknown as User[]).find((u) => u.id === id)?.email || '').toLowerCase();

    const push = (key: string, docs: Map<string, Record<string, unknown>>) => {
      if (!L.isReady(key)) return;
      const writes = L.changes(key, docs, a.myEmail);
      if (!writes.length) return;
      // Counted as saved straight away so the next render doesn't send it twice. If the server
      // refuses, Firestore rolls its live copy back and the next snapshot shows the real data.
      L.confirm(key, writes);
      writeDocs(key, writes).catch((e) => {
        const denied = String((e as { code?: string }).code || '').includes('permission-denied');
        console.error('Saving ' + key + ' failed', e);
        argsRef.current.onRefused(denied
          ? `You don't have permission to change ${key}; the change was not saved.`
          : `Couldn't save ${key} (${String((e as Error).message || e)}).`);
      });
    };

    changed.forEach((key) => {
      if (key === 'users') {
        const pub = new Map<string, Record<string, unknown>>();
        const priv = new Map<string, Record<string, unknown>>();
        ((a.lists.users || []) as unknown as User[]).forEach((u) => {
          const s = splitUser(u);
          pub.set(String(u.id), s.pub);
          if (s.priv) priv.set(String(u.id), s.priv);
        });
        push('users', pub);
        push('staffPrivate', priv);
        return;
      }
      push(key, docsFor(key, (a.lists[key] || []) as AnyList, emailOf));
    });

    if (configReady.current) {
      (Object.keys(a.config) as ConfigKey[]).forEach((name) => {
        const s = stableStringify(a.config[name]);
        if (configLast.current[name] === s || a.config[name] === undefined) return;
        configLast.current[name] = s;
        writeConfig(name, a.config[name]).catch((e) => console.error('Saving ' + name + ' failed', e));
      });
    }
  });
}
