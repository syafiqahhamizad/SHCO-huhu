import { addDoc, collection, doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';

/**
 * Queues one e-mail in Firestore `mail`. The Firebase "Trigger Email from Firestore" extension
 * picks it up and sends it from the firm's address (e.g. portal@shcolaw.com) through Google
 * Workspace SMTP. Rules only allow firm staff to queue mail to @shcolaw.com addresses.
 * Until the extension is installed the documents simply wait in the queue (nothing breaks).
 */
export async function queueEmail(to: string, message: { subject: string; text: string; html: string }, createdBy: string): Promise<string> {
  const ref = await addDoc(collection(firestoreDb, 'mail'), { to, message, createdBy, createdAt: serverTimestamp() });
  return ref.id;
}

export type MailState = { state: 'WAITING' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'RETRY'; error?: string };

/**
 * Follows one queued e-mail (owner only, by rules): the extension writes `delivery.state`
 * (PENDING → PROCESSING → SUCCESS / ERROR) back onto the document.
 */
export function watchEmail(id: string, onChange: (s: MailState) => void): Unsubscribe {
  return onSnapshot(doc(firestoreDb, 'mail', id), (snap) => {
    const d = snap.data()?.delivery as { state?: MailState['state']; error?: string } | undefined;
    onChange(d?.state ? { state: d.state, error: d.error } : { state: 'WAITING' });
  }, (e) => onChange({ state: 'ERROR', error: String((e as Error).message || e) }));
}
