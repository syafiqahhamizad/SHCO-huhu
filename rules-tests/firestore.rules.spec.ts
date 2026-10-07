/**
 * Firestore rules tests. Run against the emulator (CI: `npm run test:rules`), never the real project.
 * All people and data here are made up.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const OWNER = 'syafiqahhamizad@shcolaw.com';
const key = (e: string) => e.toLowerCase().replace(/\./g, ',');
const people = {
  partner: { email: 'partner@shcolaw.com', role: 'partner', admin: false },
  lawyer: { email: 'lawyer@shcolaw.com', role: 'lawyer', admin: false },
  assistant: { email: 'assistant@shcolaw.com', role: 'assistant', admin: false },
  assistantAdmin: { email: 'admin@shcolaw.com', role: 'assistant', admin: true },
  accountant: { email: 'accounts@shcolaw.com', role: 'accountant', admin: false },
  client: { email: 'client@example.com', role: 'client', admin: false },
};

let env: RulesTestEnvironment;
const as = (email: string) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seed = (fn: (db: any) => Promise<void>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-shco', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    const users: Record<string, unknown> = {};
    Object.values(people).forEach((p) => { users[key(p.email)] = { ...p, active: true }; });
    await setDoc(doc(db, 'practiceSystem', 'access'), { users });
    await setDoc(doc(db, 'practiceSystem', 'sharedState'), { cases: [] });
  });
});

const splitDone = () => seed(async (db) => {
  await setDoc(doc(db, 'firm', 'main'), { state: 'done' });
  await setDoc(doc(db, 'firm', 'main', 'cases', 'CS-1'), { id: 'CS-1', title: 'Test v Test' });
  await setDoc(doc(db, 'firm', 'main', 'generalLedger', 'GL-1'), { glNo: 1 });
  await setDoc(doc(db, 'firm', 'main', 'payslips', 'P-L'), { id: 'P-L', userId: 'u-l', _ownerEmail: people.lawyer.email });
  await setDoc(doc(db, 'firm', 'main', 'payslips', 'P-A'), { id: 'P-A', userId: 'u-a', _ownerEmail: people.accountant.email });
  await setDoc(doc(db, 'firm', 'main', 'staffPrivate', 'u-l'), { id: 'u-l', _ownerEmail: people.lawyer.email, profile: { nric: '1' } });
  await setDoc(doc(db, 'firm', 'main', 'users', 'u-l'), { id: 'u-l', email: people.lawyer.email, role: 'Lawyer', isAdmin: false, name: 'L' });
  await setDoc(doc(db, 'firm', 'main', 'config', 'rolesMatrix'), { value: {} });
});

describe('before the split', () => {
  it('staff use the old single document', async () => {
    await assertSucceeds(getDoc(doc(as(people.lawyer.email), 'practiceSystem', 'sharedState')));
    await assertSucceeds(setDoc(doc(as(people.lawyer.email), 'practiceSystem', 'sharedState'), { cases: [1] }));
  });
  it('clients cannot read it', () => assertFails(getDoc(doc(as(people.client.email), 'practiceSystem', 'sharedState'))));
  it('only the owner can start the move', async () => {
    await assertFails(setDoc(doc(as(people.partner.email), 'firm', 'main'), { state: 'migrating' }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'firm', 'main'), { state: 'migrating' }));
  });
});

describe('during the move', () => {
  beforeEach(() => seed(async (db) => { await setDoc(doc(db, 'firm', 'main'), { state: 'migrating' }); }));
  it('nobody can change the old document any more', () => assertFails(setDoc(doc(as(people.partner.email), 'practiceSystem', 'sharedState'), { cases: [] })));
  it('the owner can still read it and copy records', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'practiceSystem', 'sharedState')));
    await assertSucceeds(setDoc(doc(as(OWNER), 'firm', 'main', 'cases', 'CS-1'), { id: 'CS-1' }));
  });
  it('staff cannot write the new collections yet', () => assertFails(setDoc(doc(as(people.partner.email), 'firm', 'main', 'cases', 'CS-1'), { id: 'CS-1' })));
});

describe('after the split', () => {
  beforeEach(splitDone);

  it('the old document is a backup only the owner reads', async () => {
    await assertFails(getDoc(doc(as(people.partner.email), 'practiceSystem', 'sharedState')));
    await assertSucceeds(getDoc(doc(as(OWNER), 'practiceSystem', 'sharedState')));
  });

  it('files: every staff member reads and writes; clients cannot', async () => {
    await assertSucceeds(getDoc(doc(as(people.lawyer.email), 'firm', 'main', 'cases', 'CS-1')));
    await assertSucceeds(setDoc(doc(as(people.lawyer.email), 'firm', 'main', 'cases', 'CS-2'), { id: 'CS-2' }));
    await assertFails(getDoc(doc(as(people.client.email), 'firm', 'main', 'cases', 'CS-1')));
  });

  it('books: lawyers cannot read; accountants and admins can', async () => {
    await assertFails(getDoc(doc(as(people.lawyer.email), 'firm', 'main', 'generalLedger', 'GL-1')));
    await assertSucceeds(getDoc(doc(as(people.accountant.email), 'firm', 'main', 'generalLedger', 'GL-1')));
    await assertSucceeds(getDoc(doc(as(people.assistantAdmin.email), 'firm', 'main', 'generalLedger', 'GL-1')));
    await assertFails(setDoc(doc(as(people.lawyer.email), 'firm', 'main', 'generalLedger', 'GL-2'), { glNo: 2 }));
  });

  it('payslips: a lawyer sees only their own', async () => {
    const db = as(people.lawyer.email);
    await assertSucceeds(getDoc(doc(db, 'firm', 'main', 'payslips', 'P-L')));
    await assertFails(getDoc(doc(db, 'firm', 'main', 'payslips', 'P-A')));
    await assertFails(getDocs(collection(db, 'firm', 'main', 'payslips')));
    await assertSucceeds(getDocs(query(collection(db, 'firm', 'main', 'payslips'), where('_ownerEmail', '==', people.lawyer.email))));
    await assertFails(setDoc(doc(db, 'firm', 'main', 'payslips', 'P-L'), { id: 'P-L', _ownerEmail: people.lawyer.email, net: 99999 }));
  });

  it('private staff profile: own or HR only', async () => {
    await assertSucceeds(getDoc(doc(as(people.lawyer.email), 'firm', 'main', 'staffPrivate', 'u-l')));
    await assertFails(getDoc(doc(as(people.assistant.email), 'firm', 'main', 'staffPrivate', 'u-l')));
    await assertSucceeds(getDoc(doc(as(people.partner.email), 'firm', 'main', 'staffPrivate', 'u-l')));
    await assertSucceeds(setDoc(doc(as(people.lawyer.email), 'firm', 'main', 'staffPrivate', 'u-l'), { id: 'u-l', _ownerEmail: people.lawyer.email, profile: { nric: '2' } }));
    await assertFails(setDoc(doc(as(people.lawyer.email), 'firm', 'main', 'staffPrivate', 'u-x'), { id: 'u-x', _ownerEmail: 'someone@shcolaw.com' }));
  });

  it('users: you may update your own details but not your role or admin', async () => {
    const db = as(people.lawyer.email);
    await assertSucceeds(updateDoc(doc(db, 'firm', 'main', 'users', 'u-l'), { name: 'Lawyer L' }));
    await assertFails(updateDoc(doc(db, 'firm', 'main', 'users', 'u-l'), { role: 'Partner' }));
    await assertFails(updateDoc(doc(db, 'firm', 'main', 'users', 'u-l'), { isAdmin: true }));
    await assertSucceeds(updateDoc(doc(as(people.assistantAdmin.email), 'firm', 'main', 'users', 'u-l'), { role: 'Partner' }));
    await assertSucceeds(updateDoc(doc(as(people.accountant.email), 'firm', 'main', 'users', 'u-l'), { name: 'From HR' }));
    await assertFails(updateDoc(doc(as(people.accountant.email), 'firm', 'main', 'users', 'u-l'), { isAdmin: true }));
    await assertFails(updateDoc(doc(as(people.assistant.email), 'firm', 'main', 'users', 'u-l'), { name: 'Not mine' }));
  });

  it('permissions grid: owner only', async () => {
    await assertFails(setDoc(doc(as(people.assistantAdmin.email), 'firm', 'main', 'config', 'rolesMatrix'), { value: { x: 1 } }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'firm', 'main', 'config', 'rolesMatrix'), { value: { x: 1 } }));
    await assertSucceeds(setDoc(doc(as(people.lawyer.email), 'firm', 'main', 'config', 'sequenceCounters'), { value: { case: 2 } }));
  });

  it('a batch of 400 records saves (the app and the one-time move write in batches)', async () => {
    const db = as(people.partner.email);
    const b = writeBatch(db);
    for (let i = 0; i < 400; i++) b.set(doc(db, 'firm', 'main', 'timeEntries', 'T' + i), { id: 'T' + i });
    await assertSucceeds(b.commit());
  });

  it('unknown collections are closed', () => assertFails(setDoc(doc(as(OWNER), 'firm', 'main', 'whatever', 'x'), { a: 1 })));
  it('nobody can delete the split marker', () => assertFails(deleteDoc(doc(as(OWNER), 'firm', 'main'))));
});

describe('mail queue', () => {
  it('staff may queue mail to one firm address only', async () => {
    const db = as(people.lawyer.email);
    const msg = { subject: 's', text: 't', html: 'h' };
    await assertSucceeds(setDoc(doc(db, 'mail', 'm1'), { to: 'partner@shcolaw.com', message: msg, createdBy: 'x', createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'mail', 'm2'), { to: 'someone@gmail.com', message: msg, createdBy: 'x', createdAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, 'mail', 'm1')));
    await assertSucceeds(getDoc(doc(as(OWNER), 'mail', 'm1')));
  });
});

describe('e-mail settings', () => {
  it('only the owner sets them, and nobody can read the password back', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'privateConfig', 'mail'), { smtpUser: 'owner@shcolaw.com', from: 'SHCO Portal <owner@shcolaw.com>' }));
    await assertSucceeds(getDoc(doc(as(OWNER), 'privateConfig', 'mail')));
    await assertFails(setDoc(doc(as(people.assistantAdmin.email), 'privateConfig', 'mail'), { smtpUser: 'x@shcolaw.com' }));
    await assertFails(setDoc(doc(as(OWNER), 'privateConfig', 'mail'), { smtpUser: 'someone@gmail.com' }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'privateConfig', 'mailSecret'), { smtpPass: 'abcdabcdabcdabcd' }));
    await assertFails(getDoc(doc(as(OWNER), 'privateConfig', 'mailSecret')));
    await assertFails(setDoc(doc(as(people.partner.email), 'privateConfig', 'mailSecret'), { smtpPass: 'x' }));
  });
});
