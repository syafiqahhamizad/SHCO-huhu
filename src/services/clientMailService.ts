import { addDoc, collection, doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';
import { firebaseAuth } from './firebaseAuthService';

/**
 * Billing e-mails to a client (quotation, proforma, invoice, payment reminder). Queued in
 * Firestore `clientMail`; the portal's sender (functions-mail sendClientMail) sends it from the
 * portal mailbox (Settings › Notification e-mails) and writes the result back.
 */
export async function queueClientEmail(m: { to: string; subject: string; text: string; html: string; docId: string; kind: string; createdBy: string; purpose?: string }): Promise<string> {
  const ref = await addDoc(collection(firestoreDb, 'clientMail'), {
    to: m.to.trim(), subject: m.subject.slice(0, 200), text: m.text.slice(0, 10000), html: m.html.slice(0, 300000),
    docId: m.docId.slice(0, 60), kind: m.kind.slice(0, 30), purpose: (m.purpose || 'Billing & receipts').slice(0, 40), // Must be the signed-in account (the rules check it).
    createdBy: (firebaseAuth.currentUser?.email || m.createdBy).trim().toLowerCase(), createdAt: serverTimestamp(),
  });
  return ref.id;
}

export type ClientMailState = 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

/** Follows one queued client e-mail until it is sent or fails. */
export function watchClientEmail(id: string, onState: (s: ClientMailState, error?: string) => void): Unsubscribe {
  return onSnapshot(doc(firestoreDb, 'clientMail', id), (snap) => {
    const d = snap.data()?.delivery as { state?: ClientMailState; error?: string } | undefined;
    onState(d?.state || 'WAITING', d?.error);
  }, (e) => onState('ERROR', String((e as Error).message || e)));
}
