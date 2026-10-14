import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Back / forward between portal pages. Each page the user opens (a sidebar page, a client, a file)
 * is a browser history entry, so the browser's Back button — and the header's "‹ Back" — return to
 * the previous page instead of starting over. The address stays the same (finance pages keep their #tab).
 */
export interface NavLoc { v: string; c: string | null; k: string | null }

let depth = 0;
const subs = new Set<() => void>();
const setDepth = (d: number) => { depth = Math.max(0, d); subs.forEach((f) => f()); };
/** How many portal pages can be gone back to (0 = the first page of this visit). */
export const useNavDepth = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => depth, () => depth);
export const goBack = () => { if (depth > 0) window.history.back(); };

const same = (a: NavLoc, b: NavLoc) => a.v === b.v && a.c === b.c && a.k === b.k;

export const useNavHistory = (loc: NavLoc, restore: (loc: NavLoc) => void) => {
  const cur = useRef(loc);
  const restoring = useRef<NavLoc | null>(null);
  const started = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    cur.current = loc;
    if (!started.current) {
      started.current = true;
      window.history.replaceState({ ...(window.history.state || {}), shco: loc, d: 0 }, '');
      setDepth(0);
      return;
    }
    if (restoring.current && same(restoring.current, loc)) { restoring.current = null; return; }
    const st = window.history.state as { shco?: NavLoc; d?: number } | null;
    if (st?.shco && same(st.shco, loc)) return;
    const d = (st?.d ?? depth) + 1;
    window.history.pushState({ shco: loc, d }, '', window.location.href);
    setDepth(d);
  }, [loc.v, loc.c, loc.k]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { shco?: NavLoc; d?: number } | null;
      if (!st?.shco) return; // e.g. a finance #tab change: the finance page handles it
      setDepth(st.d ?? 0);
      if (same(st.shco, cur.current)) return;
      restoring.current = st.shco;
      restoreRef.current(st.shco);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
};

/**
 * useState that is remembered for this browser tab (sessionStorage), so a list keeps its search,
 * filters and tab when the user opens an item and comes back. Falls back to plain state when
 * storage is unavailable.
 */
export function useRemembered<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const k = 'shco.ui.' + key;
  const [v, setV] = useState<T>(() => {
    try { const s = sessionStorage.getItem(k); return s != null ? (JSON.parse(s) as T) : initial; } catch { return initial; }
  });
  const set = useCallback((n: T | ((p: T) => T)) => {
    setV((p) => {
      const next = typeof n === 'function' ? (n as (p: T) => T)(p) : n;
      try { sessionStorage.setItem(k, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [k]);
  return [v, set];
}
