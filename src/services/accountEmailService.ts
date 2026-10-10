import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';

/**
 * Sign-in e-mails sent by the server (functions-mail sendAccountEmail) from the portal mailbox:
 *  - invite: an admin adds an outside person (auditor, client…) in Users & Roles; the server makes
 *    the sign-in and sends ONE e-mail with the portal link, a temporary password and a
 *    "set my own password" button. Nobody in the portal ever sees the password.
 *  - reset: "Forgot password?" on the sign-in page.
 */

export type AccountEmailState = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'SKIPPED' | 'ERROR';

export async function queueAccountInvite(input: { email: string; name: string; role: string; createdBy: string }): Promise<string> {
  const ref = await addDoc(collection(firestoreDb, 'accountEmails'), {
    kind: 'invite',
    email: input.email.trim().toLowerCase(),
    name: input.name.trim().slice(0, 100),
    role: input.role.slice(0, 30),
    createdBy: input.createdBy.slice(0, 200),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await addDoc(collection(firestoreDb, 'accountEmails'), { kind: 'reset', email: email.trim().toLowerCase(), createdAt: serverTimestamp() });
}

/** Follows one invite until it is sent or fails (admins only). Returns the unsubscribe. */
export function watchAccountEmail(id: string, onState: (state: AccountEmailState, error?: string) => void): () => void {
  return onSnapshot(doc(firestoreDb, 'accountEmails', id), (s) => {
    const d = s.data() as { delivery?: { state?: AccountEmailState; error?: string } } | undefined;
    onState(d?.delivery?.state || 'PENDING', d?.delivery?.error);
  }, () => onState('ERROR', 'Could not follow the e-mail.'));
}
