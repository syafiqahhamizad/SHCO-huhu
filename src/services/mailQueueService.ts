import { addDoc, collection, doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';

/**
 * Queues one e-mail in Firestore `mail`. The portal's own sender (functions-mail) picks it up
 * and sends it through Google Workspace SMTP. Rules only allow firm staff to queue mail to
 * @shcolaw.com addresses. Until e-mail is set up the documents simply wait (nothing breaks).
 */
export async function queueEmail(to: string, message: { subject: string; text: string; html: string }, createdBy: string, purpose?: string): Promise<string> {
  // purpose = which firm group address it is sent from (Settings › Emails by purpose).
  const ref = await addDoc(collection(firestoreDb, 'mail'), { to, message, createdBy, createdAt: serverTimestamp(), ...(purpose ? { purpose: purpose.slice(0, 40) } : {}) });
  return ref.id;
}

export type MailState = { state: 'WAITING' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'RETRY'; error?: string };

/**
 * Follows one queued e-mail (owner only, by rules): the sender writes `delivery.state`
 * (PENDING → PROCESSING → SUCCESS / ERROR) back onto the document.
 */
export function watchEmail(id: string, onChange: (s: MailState) => void): Unsubscribe {
  return onSnapshot(doc(firestoreDb, 'mail', id), (snap) => {
    const d = snap.data()?.delivery as { state?: MailState['state']; error?: string } | undefined;
    onChange(d?.state ? { state: d.state, error: d.error } : { state: 'WAITING' });
  }, (e) => onChange({ state: 'ERROR', error: String((e as Error).message || e) }));
}
