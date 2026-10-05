import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';

/**
 * Queues one e-mail in Firestore `mail`. The Firebase "Trigger Email from Firestore" extension
 * picks it up and sends it from the firm's address (e.g. no-reply@shcolaw.com) through Google
 * Workspace SMTP. Rules only allow firm staff to queue mail to @shcolaw.com addresses.
 * Until the extension is installed the documents simply wait in the queue (nothing breaks).
 */
export async function queueEmail(to: string, message: { subject: string; text: string; html: string }, createdBy: string): Promise<void> {
  await addDoc(collection(firestoreDb, 'mail'), { to, message, createdBy, createdAt: serverTimestamp() });
}
