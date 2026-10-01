/**
 * Filing & service records — the ONE write path shared by a file's Filing & service tab and the
 * firm Service Log. Records live on Case.serviceRecord; proof goes through storeMatterFile
 * (Drive `<matter>/Filing|Service` when Drive is set up, else Firebase Storage).
 */
import type { Case, ServiceRecord, Task } from '../../../types';
import { prepareStorage, storeMatterFile, type StoredMatterFile } from '../../../services/fileStorageService';
import { actionOf, deriveMatchKey, isDeadline, isDone, proofTypeFor, todayIso } from './caseModel';
import { histEntry, newId } from './wf';

export type ServiceAction = NonNullable<ServiceRecord['action']>;

export interface ServiceDraft {
  dir: ServiceAction;
  date: string;
  doc: string;
  party: string;
  method: string;
  by: string;
  proofType: string;
  notes: string;
}

/** Upload proof for a record on this file (Filing → `Filing`, served/received → `Service`). */
export const uploadServiceProof = async (c: Pick<Case, 'ref' | 'title' | 'gdriveFolderId'>, file: File, action: string, me: string): Promise<StoredMatterFile> => {
  await prepareStorage();
  return storeMatterFile({ ref: c.ref, title: c.title, folderId: c.gdriveFolderId, sub: action === 'Filed' ? 'Filing' : 'Service', file, uploadedBy: me });
};

const proofFields = (stored: StoredMatterFile) => ({ proofFileName: stored.name, driveFileId: stored.driveFileId, webViewLink: stored.webViewLink, storagePath: stored.storagePath });

/** A new ServiceRecord from the entry form. */
export const newServiceRecord = (f: ServiceDraft, stored: StoredMatterFile | null, me: string): ServiceRecord => ({
  id: newId('SR'), date: f.date, action: f.dir, documentServed: f.doc.trim(), servedOn: f.party.trim(), method: f.method, servedBy: f.by.trim(),
  proofObtained: stored ? 'Y' : 'N', notes: f.notes.trim(), proofType: f.proofType || proofTypeFor(f.dir, f.method),
  ...(stored ? proofFields(stored) : {}),
  recordedBy: me, recordedAt: todayIso(),
});

/**
 * Patch that adds `row` to the file. A filing whose document contains an open deadline's key
 * ticks that deadline off. Includes the file-history line.
 */
export const addServicePatch = (c: Case, row: ServiceRecord, me: string): { patch: Partial<Case>; hit?: Task } => {
  const action = actionOf(row);
  const doc = row.documentServed.toLowerCase();
  const hit = action === 'Filed' ? (c.tasks || []).find((t) => isDeadline(t) && !isDone(t) && (t.matchKey || deriveMatchKey(t.title)) && doc.includes(t.matchKey || deriveMatchKey(t.title))) : undefined;
  const tasks = hit ? (c.tasks || []).map((t) => (t.id === hit.id ? { ...t, status: 'Completed' as const, doneOn: row.date, completedAt: new Date().toISOString(), lastUpdatedBy: me } : t)) : undefined;
  const saved = row.proofObtained === 'Y';
  return {
    hit,
    patch: {
      serviceRecord: [row, ...(c.serviceRecord || [])],
      ...(tasks ? { tasks } : {}),
      activityLogs: [histEntry(action + ': ' + row.documentServed + (saved ? ' (proof saved)' : ' (no proof yet)') + (hit ? '. Deadline "' + hit.title + '" ticked off' : ''), me, 'Service Record'), ...(c.activityLogs || [])],
    },
  };
};

/** serviceRecord with proof attached to record `id` (file-history line added by the caller). */
export const withProof = (c: Pick<Case, 'serviceRecord'>, r: ServiceRecord, stored: StoredMatterFile): ServiceRecord[] => {
  const type = r.proofType || proofTypeFor(actionOf(r), r.method);
  return (c.serviceRecord || []).map((x) => (x.id === r.id ? { ...x, proofObtained: 'Y' as const, proofType: type, ...proofFields(stored) } : x));
};
