import { useEffect, useRef } from 'react';

/**
 * The header "+" button: it opens the right page and asks that page to open its "new" form.
 * The page may not be on screen yet, so the request waits here until the page picks it up.
 */
export type QuickKind = 'quotation' | 'proforma' | 'invoice' | 'moneyIn' | 'moneyOut' | 'claim' | 'lead' | 'task';

const EVENT = 'shco-quick-create';
let pending: QuickKind | null = null;

export const requestQuick = (k: QuickKind) => {
  pending = k;
  window.dispatchEvent(new Event(EVENT));
};

/** Runs `open` when a request for one of `kinds` is waiting (now, or when it arrives). */
export function useQuickCreate(kinds: QuickKind[], open: (k: QuickKind) => void) {
  const ref = useRef(open);
  ref.current = open;
  const key = kinds.join(',');
  useEffect(() => {
    const take = () => {
      if (!pending || !key.split(',').includes(pending)) return;
      const k = pending;
      pending = null;
      // After the page has drawn once, so its form can open.
      setTimeout(() => ref.current(k), 0);
    };
    take();
    window.addEventListener(EVENT, take);
    return () => window.removeEventListener(EVENT, take);
  }, [key]);
}
