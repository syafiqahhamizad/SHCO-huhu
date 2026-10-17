import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from './firestoreSyncService';
import { binClaimPaper } from './googleDriveService';

/**
 * Claim papers to move to the Drive bin: the receipts of a withdrawn or deleted claim, a receipt taken off
 * a claim when it is edited, and the claim's entry folder once it is empty. Staff cannot delete on the
 * finance drive, so anyone on the firm's list queues them here and the next Accounts / Super Admin visit
 * to the finance pages bins them (binClaimPaper only touches papers the portal made for a claim).
 */
export async function queueDriveBin(ids: (string | undefined | null)[], reason: string, by: string): Promise<void> {
  const clean = [...new Set(ids.filter((x): x is string => !!x && /^[\w-]{10,80}$/.test(x)))].slice(0, 50);
  if (!clean.length) return;
  await addDoc(collection(firestoreDb, 'driveBin'), { ids: clean, reason: reason.slice(0, 200), by: by.slice(0, 200), at: serverTimestamp() });
}

/** Bins what is queued (folders after their files, so an emptied folder goes too). Returns how many papers went. */
export async function processDriveBin(): Promise<number> {
  const snap = await getDocs(query(collection(firestoreDb, 'driveBin'), limit(50)));
  let n = 0;
  for (const d of snap.docs) {
    const ids = ((d.data().ids as string[]) || []).filter((x) => typeof x === 'string');
    const done: boolean[] = [];
    for (const id of ids) done.push(await binClaimPaper(id));
    // A folder listed before its last file: try once more now that the files are gone.
    for (let i = 0; i < ids.length; i++) if (!done[i]) done[i] = await binClaimPaper(ids[i]);
    n += done.filter(Boolean).length;
    await deleteDoc(doc(firestoreDb, 'driveBin', d.id));
  }
  return n;
}
