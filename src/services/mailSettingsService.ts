import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestoreDb as db } from './firestoreSyncService';

/**
 * Settings for the notification e-mail sender (functions-mail). Owner only (rules).
 * The App password is written to privateConfig/mailSecret and can never be read back.
 */
export interface MailSettings { smtpUser: string; from: string; replyTo: string; passwordSetAt?: string; updatedBy?: string }

export async function readMailSettings(): Promise<MailSettings | null> {
  const s = await getDoc(doc(db, 'privateConfig', 'mail'));
  return s.exists() ? (s.data() as MailSettings) : null;
}

export async function saveMailSettings(v: MailSettings, by: string): Promise<void> {
  await setDoc(doc(db, 'privateConfig', 'mail'), { ...v, updatedBy: by, updatedAt: serverTimestamp() });
}

/** Saves the App password (spaces removed) and records when it was set. */
export async function saveMailPassword(password: string, current: MailSettings, by: string): Promise<string> {
  const smtpPass = password.replace(/\s+/g, '');
  await setDoc(doc(db, 'privateConfig', 'mailSecret'), { smtpPass, updatedAt: serverTimestamp() });
  const passwordSetAt = new Date().toISOString();
  await saveMailSettings({ ...current, passwordSetAt }, by);
  return passwordSetAt;
}
