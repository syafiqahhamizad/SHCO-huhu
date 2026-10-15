import { addDoc, collection, doc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';
import { firebaseAuth } from './firebaseAuthService';

/**
 * Billing e-mails to a client (quotation, proforma, invoice, payment reminder). Queued in
 * Firestore `clientMail`; the portal's sender (functions-mail sendClientMail) sends it from the
 * portal mailbox (Settings › Notification e-mails) and writes the result back.
 */
export async function queueClientEmail(m: { to: string; subject: string; text: string; html: string; docId: string; kind: string; createdBy: string; purpose?: string; attachment?: { name: string; pdf: Blob } }): Promise<string> {
  // Pictures in the document (logo) need the full web address to show in an e-mail.
  const html = m.html.replace(/(src|href)="\//g, '$1="' + window.location.origin + '/');
  // The document goes as a PDF attachment (base64 inside the queued message; kept small).
  let attach: { attachName: string; attachB64: string } | Record<string, never> = {};
  if (m.attachment) {
    const buf = new Uint8Array(await m.attachment.pdf.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const b64 = btoa(bin);
    if (b64.length > 900000) throw new Error('The PDF is too large to e-mail (over about 650 KB). Nothing was sent.');
    attach = { attachName: m.attachment.name.slice(0, 120), attachB64: b64 };
  }
  const ref = await addDoc(collection(firestoreDb, 'clientMail'), {
    ...attach,
    to: m.to.trim(), subject: m.subject.slice(0, 200), text: m.text.slice(0, 10000), html: html.slice(0, 300000),
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
