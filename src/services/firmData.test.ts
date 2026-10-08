import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { canReadTier, collectionDef, COLLECTIONS, diffDocs, docIdsFor, docsFor, mergeUsers, safeDocId, splitUser, stableStringify, SyncLedger } from './firmData';

describe('collection layout', () => {
  it('every key appears once', () => expect(new Set(COLLECTIONS.map((c) => c.key)).size).toBe(COLLECTIONS.length));
  it('payslips and private staff profiles are HR only', () => {
    expect(collectionDef('payslips')?.tier).toBe('hr');
    expect(collectionDef('staffPrivate')?.tier).toBe('hr');
  });
  it('the books are not for lawyers or assistants', () => {
    expect(canReadTier('books', 'lawyer', false)).toBe(false);
    expect(canReadTier('books', 'assistant', false)).toBe(false);
    expect(canReadTier('books', 'accountant', false)).toBe(true);
    expect(canReadTier('hr', 'lawyer', true)).toBe(true); // admins
  });
  it('client billing is books only: lawyers and assistants get none of it', () => {
    for (const k of ['quotations', 'invoices', 'payments', 'receipts', 'retainers']) {
      expect(collectionDef(k)?.tier).toBe('books');
      expect(canReadTier(collectionDef(k)!.tier, 'lawyer', false)).toBe(false);
      expect(canReadTier(collectionDef(k)!.tier, 'assistant', false)).toBe(false);
      expect(canReadTier(collectionDef(k)!.tier, 'reviewer', false)).toBe(true);
      expect(canReadTier(collectionDef(k)!.tier, 'partner', false)).toBe(true);
    }
  });
  it('time entries and expenses stay with every firm user', () => {
    expect(collectionDef('timeEntries')?.tier).toBe('firm');
    expect(collectionDef('expenses')?.tier).toBe('firm');
  });
});

describe('document ids', () => {
  it('slashes and reserved ids are made safe', () => {
    expect(safeDocId('INV/2026/001')).not.toContain('/');
    expect(safeDocId('..')).toMatch(/^id-/);
    expect(safeDocId('__x').startsWith('__')).toBe(false);
  });
  it('duplicate ids keep both records', () => expect(docIdsFor('cases', [{ id: 'A' }, { id: 'A' }, { id: 'B' }])).toEqual(['A', 'A~2', 'B']));
  it('logs without ids get a stable id from their content', () => {
    const r = { ts: '1', user: 'x', action: 'a', details: 'd' };
    expect(docIdsFor('logs', [r])).toEqual(docIdsFor('logs', [{ ...r }]));
  });
  it('payslips carry the owner e-mail for own-only access', () => {
    const m = docsFor('payslips', [{ id: 'P1', userId: 'u1' }], () => 'a@shcolaw.com');
    expect(m.get('P1')?._ownerEmail).toBe('a@shcolaw.com');
  });
});

describe('staff profile split', () => {
  const u = { id: 'u1', name: 'A', email: 'A@shcolaw.com', role: 'Lawyer', isAdmin: false, status: 'Active',
    clientPassword: 'x', staffProfile: { staffId: 'S1', designation: 'Lawyer', department: 'Lit', phone: '1', nric: '900101', bankAccountNo: '123', emergencyContact: 'Mum', joinDate: '', employmentType: 'Permanent', officeLocation: '', bio: '' } } as unknown as User;
  const { pub, priv } = splitUser(u);
  it('IC, bank and emergency contact go to the private part', () => {
    expect(JSON.stringify(pub)).not.toContain('900101');
    expect(JSON.stringify(pub)).not.toContain('123');
    expect((priv?.profile as Record<string, unknown>).nric).toBe('900101');
    expect(priv?._ownerEmail).toBe('a@shcolaw.com');
  });
  it('passwords are never stored', () => expect(JSON.stringify(pub)).not.toContain('clientPassword'));
  it('merging puts them back together', () => {
    const [m] = mergeUsers([pub as unknown as User], [priv as { id: string; profile: Record<string, unknown> }]);
    expect(m.staffProfile?.nric).toBe('900101');
    expect(m.staffProfile?.phone).toBe('1');
  });
});

describe('diffDocs', () => {
  const last = new Map([['A', stableStringify({ x: 1, y: 2 })], ['B', stableStringify({ x: 1 })]]);
  it('only changed, new and removed records are written', () => {
    const next = new Map<string, Record<string, unknown>>([['A', { y: 2, x: 1 }], ['C', { x: 3 }]]);
    expect(diffDocs(next, last)).toEqual([{ id: 'C', data: { x: 3 } }, { id: 'B', data: null }]);
  });
  it('key order does not count as a change', () => expect(stableStringify({ a: 1, b: { d: 1, c: 2 } })).toBe(stableStringify({ b: { c: 2, d: 1 }, a: 1 })));
});


const M = (o: Record<string, Record<string, unknown>>) => new Map(Object.entries(o));

describe('SyncLedger (live updates vs local edits)', () => {
  it('first load: the server wins over this browser’s old cached copy', () => {
    const L = new SyncLedger();
    const shown = L.merge('cases', M({ A: { v: 1 } }), M({ A: { v: 0 }, OLD: { v: 9 } }), 'all');
    expect([...shown]).toEqual([['A', { v: 1 }]]);
  });
  it('only the edited record is written', () => {
    const L = new SyncLedger();
    L.merge('cases', M({ A: { v: 1 }, B: { v: 1 } }), new Map(), 'all');
    expect(L.changes('cases', M({ A: { v: 2 }, B: { v: 1 } }), 'me@x')).toEqual([{ id: 'A', data: { v: 2 } }]);
  });
  it('someone else’s update does not undo my edit that is still saving', () => {
    const L = new SyncLedger();
    L.merge('cases', M({ A: { v: 1 }, B: { v: 1 } }), new Map(), 'all');
    // I edit A locally (not yet sent); someone else changes B.
    const shown = L.merge('cases', M({ A: { v: 1 }, B: { v: 2 } }), M({ A: { v: 5 }, B: { v: 1 } }), 'all');
    expect(shown.get('A')).toEqual({ v: 5 });
    expect(shown.get('B')).toEqual({ v: 2 });
    expect(L.changes('cases', shown, 'me@x')).toEqual([{ id: 'A', data: { v: 5 } }]);
  });
  it('a record added here and not yet saved is kept; one deleted elsewhere goes', () => {
    const L = new SyncLedger();
    L.merge('cases', M({ A: { v: 1 }, B: { v: 1 } }), new Map(), 'all');
    const shown = L.merge('cases', M({ A: { v: 1 } }), M({ A: { v: 1 }, B: { v: 1 }, NEW: { v: 1 } }), 'all');
    expect([...shown.keys()].sort()).toEqual(['A', 'NEW']);
  });
  it('deleting a record writes a delete', () => {
    const L = new SyncLedger();
    L.merge('cases', M({ A: { v: 1 }, B: { v: 1 } }), new Map(), 'all');
    expect(L.changes('cases', M({ A: { v: 1 } }), 'me@x')).toEqual([{ id: 'B', data: null }]);
  });
  it('nothing is written for collections this person cannot read', () => {
    const L = new SyncLedger();
    L.merge('generalLedger', new Map(), new Map(), 'none');
    expect(L.changes('generalLedger', M({ X: { v: 1 } }), 'me@x')).toEqual([]);
  });
  it('own-only collections: only my own documents, never deletes', () => {
    const L = new SyncLedger();
    L.merge('payslips', M({ P1: { _ownerEmail: 'me@x', v: 1 } }), new Map(), 'own');
    expect(L.changes('payslips', M({ P1: { _ownerEmail: 'me@x', v: 2 }, P2: { _ownerEmail: 'other@x', v: 1 } }), 'me@x'))
      .toEqual([{ id: 'P1', data: { _ownerEmail: 'me@x', v: 2 } }]);
    expect(L.changes('payslips', new Map(), 'me@x')).toEqual([]);
  });
  it('after a save is counted, the same data is not sent twice', () => {
    const L = new SyncLedger();
    L.merge('cases', M({ A: { v: 1 } }), new Map(), 'all');
    const w = L.changes('cases', M({ A: { v: 2 } }), 'me@x');
    L.confirm('cases', w);
    expect(L.changes('cases', M({ A: { v: 2 } }), 'me@x')).toEqual([]);
  });
});
