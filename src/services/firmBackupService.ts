import { getCloudMode, readCloudState } from './firestoreSyncService';
import { readAccessList } from './accessListService';
import { getPracticeSettings } from './templateService';
import { ensureFolderPath, getDriveConfig, isDriveConfigured, uploadToDrive, type DriveFile } from './googleDriveService';

/**
 * "Export all firm data" (Firm & Practice Settings, Managing Partner / admin only).
 *
 * One JSON file with everything the app syncs to Firestore (the firm/main collections; before the
 * database split, `practiceSystem/sharedState`), the
 * Firm & Practice Settings, the published access list (when readable) and an index of every
 * file reference (Drive ids / links, Firebase Storage paths, name-only attachments). The file
 * contents themselves are not included: Drive files stay in the Shared Drive.
 */

/** Everything AppContext syncs to sharedState (same list as its first-write in AppContext). */
export const SHARED_STATE_KEYS = [
  'leads', 'clients', 'cases', 'quotations', 'referralPartners', 'paymentVouchers', 'travelClaims',
  'receipts', 'deadlines', 'invoices', 'payments', 'retainers', 'users', 'attendanceRecords',
  'leaveApplications', 'meetings', 'programmes', 'notifications', 'lawFirmRegistry', 'sequenceCounters', 'deletedRecords',
  'rolesMatrix', 'customRoles', 'timeEntries', 'expenses', 'generalLedger', 'logs', 'announcements', 'auditLogs',
  'firmStartCentrePages', 'bankAccounts', 'trustAuditLogs', 'inventoryItems', 'bankReconciliationEntries', 'clientAccountChecks',
  'payslips', 'manualJournals',
] as const;

/** Keys never exported (passwords etc.). None are expected client-side; this is a safety net. */
const SECRET_KEY = /pass(word|code|phrase)|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?key/i;

const stripSecrets = (v: unknown, removed: { n: number }): unknown => {
  if (Array.isArray(v)) return v.map((x) => stripSecrets(x, removed));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(v as Record<string, unknown>).forEach(([k, x]) => {
      if (SECRET_KEY.test(k)) { removed.n += 1; return; }
      out[k] = stripSecrets(x, removed);
    });
    return out;
  }
  return v;
};

export interface FileRefIndexEntry {
  /** Where the reference sits, e.g. `sharedState.travelClaims[TC-0012].attachments[0]`. */
  where: string;
  name: string;
  storage: 'Google Drive' | 'Firebase Storage' | 'Name only';
  driveFileId?: string;
  webViewLink?: string;
  path?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

const FILE_KEYS = new Set(['attachments', 'hrDocuments', 'photo', 'proofs', 'paidProof', 'documents', 'kycDocuments', 'files']);

/** Walks the export and lists every attachment / document reference it finds. */
const indexFileRefs = (root: unknown, base: string): FileRefIndexEntry[] => {
  const out: FileRefIndexEntry[] = [];
  const walk = (v: unknown, where: string, underFileKey: boolean) => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        const id = x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : String(i);
        walk(x, where + '[' + id + ']', underFileKey);
      });
      return;
    }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const isRef = typeof o.name === 'string' && (typeof o.driveFileId === 'string' || typeof o.path === 'string' || (underFileKey && ('uploadedAt' in o || 'size' in o || 'url' in o || 'type' in o)));
    if (isRef) {
      out.push({
        where,
        name: String(o.name),
        storage: o.driveFileId ? 'Google Drive' : typeof o.path === 'string' && o.path ? 'Firebase Storage' : 'Name only',
        ...(o.driveFileId ? { driveFileId: String(o.driveFileId) } : {}),
        ...(o.webViewLink ? { webViewLink: String(o.webViewLink) } : {}),
        ...(typeof o.path === 'string' && o.path ? { path: o.path } : {}),
        ...(o.uploadedAt ? { uploadedAt: String(o.uploadedAt) } : {}),
        ...(o.uploadedBy ? { uploadedBy: String(o.uploadedBy) } : {}),
      });
      return;
    }
    Object.entries(o).forEach(([k, x]) => {
      // Skip big inline images (letterheads, logos) and non-file maps quickly.
      if (typeof x === 'string') return;
      walk(x, where + '.' + k, FILE_KEYS.has(k));
    });
  };
  walk(root, base, false);
  return out;
};

const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(what + ' timed out')), ms))]);

const pad = (n: number) => String(n).padStart(2, '0');
const backupFileName = (d = new Date()) =>
  'SHCO-portal-backup-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';

export interface BackupResult {
  fileName: string;
  bytes: number;
  source: 'cloud' | 'this-device';
  counts: Record<string, number>;
  fileRefs: number;
  secretsRemoved: number;
  accessList: 'included' | 'not readable' | 'not published';
  drive?: DriveFile;
  driveError?: string;
  notes: string[];
}

/**
 * Builds the backup, downloads it in the browser, and (when Drive storage is set up) uploads
 * it to `Backups/` in the Shared Drive. `localState` is the app's in-memory state, used when
 * the cloud document can't be read (e.g. local preview mode).
 */
export async function exportAllFirmData(opts: { localState: Record<string, unknown>; by: { name: string; email: string } }): Promise<BackupResult> {
  const notes: string[] = [];
  let shared: Record<string, unknown> | null = null;
  let source: BackupResult['source'] = 'cloud';
  try {
    shared = await withTimeout(readCloudState(), 15_000, 'Reading the cloud copy');
  } catch (e) {
    notes.push('The cloud copy could not be read (' + ((e as { code?: string })?.code || (e instanceof Error ? e.message : 'error')) + '); this backup was built from the data loaded on this device.');
  }
  if (!shared) {
    source = 'this-device';
    shared = {};
    SHARED_STATE_KEYS.forEach((k) => { if (opts.localState[k] !== undefined) shared![k] = opts.localState[k]; });
  }
  // practiceSettings lives inside sharedState too; export it on its own (current copy) instead.
  const { practiceSettings: cloudSettings, ...rest } = shared;
  void cloudSettings;

  let accessList: unknown = null;
  let accessState: BackupResult['accessList'] = 'not readable';
  try {
    const list = await withTimeout(readAccessList(), 15_000, 'Reading the access list');
    if (list === null) accessState = 'not published';
    else { accessList = list; accessState = 'included'; }
  } catch {
    notes.push('The access list could not be read with this account, so it is not included.');
  }

  const removed = { n: 0 };
  const sharedState = stripSecrets(JSON.parse(JSON.stringify(rest)), removed) as Record<string, unknown>;
  const practiceSettings = stripSecrets(JSON.parse(JSON.stringify(getPracticeSettings())), removed);
  const access = accessList ? stripSecrets(JSON.parse(JSON.stringify(accessList)), removed) : null;
  const fileRefs = [...indexFileRefs(sharedState, 'sharedState'), ...indexFileRefs(practiceSettings, 'practiceSettings')];

  const now = new Date();
  const fileName = backupFileName(now);
  const payload = {
    format: 'shco-portal-backup',
    version: 1,
    exportedAt: now.toISOString(),
    exportedBy: opts.by,
    source: source === 'cloud' ? (getCloudMode() === 'split' ? 'Firestore firm/main (one record per document)' : 'Firestore practiceSystem/sharedState') : 'Data loaded on the exporting device',
    notes,
    sharedState,
    practiceSettings,
    accessList: access,
    fileIndex: {
      note: 'References only. Google Drive files stay in the firm Shared Drive; Firebase Storage files stay in the Firebase bucket; "Name only" files were never uploaded.',
      count: fileRefs.length,
      files: fileRefs,
    },
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Always offer the download first, so a Drive problem never loses the backup.
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  const counts: Record<string, number> = {};
  Object.entries(sharedState).forEach(([k, v]) => { if (Array.isArray(v)) counts[k] = v.length; });

  const result: BackupResult = { fileName, bytes: blob.size, source, counts, fileRefs: fileRefs.length, secretsRemoved: removed.n, accessList: accessState, notes };
  if (isDriveConfigured()) {
    try {
      const folder = await ensureFolderPath(getDriveConfig().rootFolderId, ['Backups']);
      result.drive = await uploadToDrive(folder, blob, fileName, 'application/json', 'SHCO portal backup exported by ' + opts.by.name);
    } catch (e) {
      result.driveError = e instanceof Error ? e.message : String(e);
    }
  }
  return result;
}
