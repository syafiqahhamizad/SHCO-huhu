import { getPracticeSettings } from './templateService';
import { driveSafeName } from '../lib/driveLayout';
import {
  GOOGLE_SCOPES,
  GOOGLE_TOKEN_EVENT,
  clearGoogleTokens,
  getGoogleAccessToken,
  getGoogleClientId,
  hasValidGoogleToken,
  looksLikeClientId,
} from './googleWorkspaceAuth';

/**
 * Google Drive storage for the firm's files (claim receipts, HR documents, staff photos,
 * finance proofs, backups), kept in a Google Workspace Shared Drive.
 *
 * - Access token: Google Identity Services (GIS) OAuth token client, scope `drive`, shared with
 *   Calendar / Tasks / Gmail through googleWorkspaceAuth.ts. The token is kept in memory only,
 *   with its expiry, and re-requested silently (`prompt: ''`, hinted with the signed-in
 *   @shcolaw.com email) when it runs out. The first request shows Google's
 *   consent screen once. The full `drive` scope is needed so approvers / admins can open files
 *   other staff uploaded; the OAuth consent screen is "Internal" to the Workspace.
 * - Every Drive REST v3 call passes `supportsAllDrives=true`.
 * - Files are never shared publicly: no "anyone with the link" permissions are ever created.
 *   Access comes from Shared Drive membership (plus, for a staff member's own HR files, a
 *   reader permission for that one @shcolaw.com user).
 */

const DRIVE_SCOPE = GOOGLE_SCOPES.drive;
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,mimeType,size,webViewLink,driveId,parents';
/** Drive's simple multipart upload is meant for files up to 5 MB; larger ones go resumable. */
const MULTIPART_MAX = 5 * 1024 * 1024;

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  driveId?: string;
  parents?: string[];
}

interface DriveConfig {
  clientId: string;
  rootFolderId: string;
  rootFolderName: string;
  hrFolderId: string;
  /** "SHCO Finance" Shared Drive (partners / Accounts). '' = use Finance/ inside the root. */
  financeFolderId: string;
  financeFolderName: string;
  /** Practice area name → folder name under Case files/ (blank = the area name). */
  practiceFolderNames: Record<string, string>;
  /** Where the client ID came from, for the settings card. */
  clientIdSource: 'env' | 'settings' | 'none';
}

/* ------------------------------------------------------------------ config */

/** Accepts a Drive folder link (…/folders/<id>, …?id=<id>) or a bare ID. Returns '' if neither. */
export const parseDriveFolderId = (input: string): string => {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/\/d\/([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : '';
};

export { looksLikeClientId };

export const getDriveConfig = (): DriveConfig => {
  const s = getPracticeSettings();
  const c = getGoogleClientId();
  return {
    clientId: c.clientId,
    clientIdSource: c.source,
    rootFolderId: parseDriveFolderId(s.driveRootFolderId || ''),
    rootFolderName: s.driveRootFolderName || '',
    hrFolderId: parseDriveFolderId(s.driveHrFolderId || ''),
    financeFolderId: parseDriveFolderId(s.driveFinanceFolderId || ''),
    financeFolderName: s.driveFinanceFolderName || '',
    // Case files always go to Case files/<practice area> (the old per-area folder-name boxes were
    // removed from Settings; anything saved there is ignored).
    practiceFolderNames: {},
  };
};

/** Drive is "set up" once the owner has saved both a root folder and an OAuth client ID. */
export const isDriveConfigured = (c: DriveConfig = getDriveConfig()) => Boolean(c.clientId && c.rootFolderId);

/* ------------------------------------------------------------------ token (shared Google Workspace auth) */


/** Forget the cached Drive token (e.g. after a 401, or on sign-out). */
const clearDriveToken = () => clearGoogleTokens('drive');

/** Fired on window whenever a fresh Drive token arrives (photos waiting for one can load). */
export const DRIVE_TOKEN_EVENT = 'shco-drive-token';
if (typeof window !== 'undefined') {
  window.addEventListener(GOOGLE_TOKEN_EVENT, (e) => {
    const scopes = (e as CustomEvent<{ scopes?: string[] }>).detail?.scopes || [];
    if (scopes.includes(DRIVE_SCOPE)) window.dispatchEvent(new CustomEvent(DRIVE_TOKEN_EVENT));
  });
}

/** True when a Drive token for the current config and user is cached and not about to expire. */
export const hasValidDriveToken = () => hasValidGoogleToken('drive');

/**
 * Returns a valid access token, requesting one through GIS when there is none or it expires
 * within a minute. Call this directly from a click handler where possible: GIS opens a small
 * popup, which browsers only allow shortly after a user action.
 */
export const getDriveAccessToken = (): Promise<string> => getGoogleAccessToken('drive');

/* ------------------------------------------------------------------ REST helpers */

class DriveError extends Error {
  constructor(message: string, public status = 0, public reason = '') { super(message); }
}

/** True for "no access" errors (403 / 404 from Drive): the person is not a member of that Shared Drive. */
export const isDriveAccessError = (e: unknown) => e instanceof DriveError && (e.status === 403 || e.status === 404) && e.reason !== 'rateLimitExceeded' && e.reason !== 'userRateLimitExceeded';

/** Turns a Drive API error response into something the staff member (or owner) can act on. */
const describeDriveError = (status: number, reason: string, message: string): string => {
  const r = reason.toLowerCase(), m = message.toLowerCase();
  if (r === 'accessnotconfigured' || m.includes('has not been used') || m.includes('is disabled')) return 'The Google Drive API is not enabled for the portal’s Google Cloud project. Ask an admin to enable it (Google Cloud Console → APIs & Services → Enable APIs → Google Drive API).';
  if (status === 401) return 'Your Google Drive sign-in has expired. Try again.';
  if (r === 'storagequotaexceeded' || r === 'teamdrivefilelimitexceeded' || r === 'numchildreninnonrootlimitexceeded') return 'The firm’s Google Drive storage is full or at its file limit. Ask the admin to check the Workspace storage.';
  if (r === 'insufficientfilepermissions' || r === 'teamdrivemembershiprequired' || r === 'forbidden' || r === 'insufficientpermissions' || status === 403) {
    if (r === 'ratelimitexceeded' || r === 'userratelimitexceeded') return 'Google Drive is busy. Wait a moment and try again.';
    return 'Your Google account does not have permission for the firm’s Drive folder. Ask an admin to add you to the “SHCO Portal” Shared Drive (Content manager).';
  }
  if (status === 404) return 'The Drive file or folder was not found, or you are not a member of the Shared Drive it is in. Ask an admin to check the folder in Firm Settings and your Shared Drive membership.';
  if (status === 429 || status >= 500) return 'Google Drive is temporarily unavailable (' + status + '). Try again in a minute.';
  return 'Google Drive error ' + (status || '') + (message ? ': ' + message : '');
};

async function driveFetch(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const t = await getDriveAccessToken();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  } catch {
    throw new DriveError('Could not reach Google Drive. Check the internet connection and try again.');
  }
  if (res.status === 401 && !retried) { clearDriveToken(); return driveFetch(url, init, true); }
  if (!res.ok) {
    let reason = '', message = '';
    try {
      const j = await res.json() as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } };
      reason = j.error?.errors?.[0]?.reason || j.error?.status || '';
      message = j.error?.message || '';
    } catch { /* not JSON */ }
    throw new DriveError(describeDriveError(res.status, reason, message), res.status, reason);
  }
  return res;
}

const q = (params: Record<string, string>) => '?' + new URLSearchParams({ supportsAllDrives: 'true', ...params }).toString();
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
/** Drive allows almost any name; keep folder/file names tidy (see lib/driveLayout). */

async function getDriveFile(id: string, fields = FILE_FIELDS): Promise<DriveFile> {
  const res = await driveFetch(API + '/files/' + encodeURIComponent(id) + q({ fields }));
  return res.json();
}

/* ------------------------------------------------------------------ folders */

const folderCache = new Map<string, Promise<string>>();
/** Forget remembered folder ids (e.g. after folders were deleted in Drive), so the next lookup asks Drive again. */
export const clearFolderCache = () => folderCache.clear();

/** Finds a sub-folder by exact name under `parentId`, creating it if missing (with `description`). Cached per session. */
function findOrCreateFolder(parentId: string, name: string, description?: string): Promise<string> {
  const clean = driveSafeName(name);
  const key = parentId + '/' + clean;
  const hit = folderCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const query = "name = '" + esc(clean) + "' and '" + esc(parentId) + "' in parents and mimeType = '" + FOLDER_MIME + "' and trashed = false";
    const res = await driveFetch(API + '/files' + q({ q: query, fields: 'files(id,name)', includeItemsFromAllDrives: 'true', corpora: 'allDrives', pageSize: '10' }));
    const found = (await res.json() as { files?: DriveFile[] }).files || [];
    if (found[0]) return found[0].id;
    const made = await driveFetch(API + '/files' + q({ fields: 'id' }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, mimeType: FOLDER_MIME, parents: [parentId], ...(description ? { description } : {}) }),
    });
    return (await made.json() as DriveFile).id;
  })();
  folderCache.set(key, p);
  p.catch(() => folderCache.delete(key));
  return p;
}

/**
 * Walks / creates a folder path like ['2026', 'Claims', 'CF-26-0413'] under `rootId`.
 * `lastDescription` is set on the last folder when it is newly created (e.g. the full file ref).
 */
export async function ensureFolderPath(rootId: string, parts: string[], lastDescription?: string): Promise<string> {
  let id = rootId;
  for (let i = 0; i < parts.length; i += 1) id = await findOrCreateFolder(id, parts[i], i === parts.length - 1 ? lastDescription : undefined);
  return id;
}

/**
 * Renames the sub-folder `oldName` of `parentId` to `newName` (when it exists and no folder already
 * has the new name). Returns true when renamed. Used when clients get their new numbers.
 */
export async function renameChildFolder(parentId: string, oldName: string, newName: string): Promise<boolean> {
  const from = driveSafeName(oldName), to = driveSafeName(newName);
  if (from === to) return false;
  const find = async (name: string) => {
    const query = "name = '" + esc(name) + "' and '" + esc(parentId) + "' in parents and mimeType = '" + FOLDER_MIME + "' and trashed = false";
    const res = await driveFetch(API + '/files' + q({ q: query, fields: 'files(id,name)', includeItemsFromAllDrives: 'true', corpora: 'allDrives', pageSize: '1' }));
    return ((await res.json() as { files?: DriveFile[] }).files || [])[0];
  };
  const old = await find(from);
  if (!old || await find(to)) return false;
  await driveFetch(API + '/files/' + encodeURIComponent(old.id) + q({ fields: 'id' }), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: to }) });
  folderCache.delete(parentId + '/' + from);
  folderCache.set(parentId + '/' + to, Promise.resolve(old.id));
  return true;
}

/** Moves a Drive item into `toFolderId` (and renames it when `name` is given). Within a shared
 * drive this is a plain move; when Drive refuses a move between shared drives, a file is copied
 * into the new folder and the old copy is trashed. Returns the item's (possibly new) id and link. */
export async function moveDriveItem(id: string, toFolderId: string, name?: string): Promise<{ id: string; webViewLink?: string }> {
  const cur = await getDriveFile(id, 'id,name,mimeType,parents,webViewLink');
  const parents = cur.parents || [];
  const already = parents.includes(toFolderId);
  if (already && (!name || cur.name === driveSafeName(name))) return { id, webViewLink: cur.webViewLink };
  const params: Record<string, string> = { fields: 'id,webViewLink' };
  if (!already) { params.addParents = toFolderId; if (parents.length) params.removeParents = parents.join(','); }
  try {
    const res = await driveFetch(API + '/files/' + encodeURIComponent(id) + q(params), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(name ? { name: driveSafeName(name) } : {}),
    });
    return res.json();
  } catch (err) {
    if (already || cur.mimeType === FOLDER_MIME) throw err;
    const copy = await driveFetch(API + '/files/' + encodeURIComponent(id) + '/copy' + q({ fields: 'id,webViewLink' }), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parents: [toFolderId], name: driveSafeName(name || cur.name) }),
    });
    const made = await copy.json() as { id: string; webViewLink?: string };
    try { await trashDriveFile(id); } catch { /* the old copy stays where it was */ }
    return made;
  }
}

/** A Drive shortcut to `targetId` inside `parentId`, named `name` (made once; reused after). */
export async function ensureShortcut(parentId: string, targetId: string, name: string): Promise<string> {
  const query = "'" + esc(parentId) + "' in parents and mimeType = 'application/vnd.google-apps.shortcut' and trashed = false";
  const res = await driveFetch(API + '/files' + q({ q: query, fields: 'files(id,name,shortcutDetails)', includeItemsFromAllDrives: 'true', corpora: 'allDrives', pageSize: '200' }));
  const found = ((await res.json() as { files?: { id: string; name: string; shortcutDetails?: { targetId?: string } }[] }).files || []).find((f) => f.shortcutDetails?.targetId === targetId);
  if (found) {
    if (found.name !== driveSafeName(name)) await driveFetch(API + '/files/' + encodeURIComponent(found.id) + q({ fields: 'id' }), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: driveSafeName(name) }) });
    return found.id;
  }
  const made = await driveFetch(API + '/files' + q({ fields: 'id' }), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: driveSafeName(name), mimeType: 'application/vnd.google-apps.shortcut', parents: [parentId], shortcutDetails: { targetId } }),
  });
  return (await made.json() as { id: string }).id;
}

/* ------------------------------------------------------------------ files */

/** Uploads a file (or Blob) into `folderId`. Multipart up to 5 MB, resumable above that. */
export async function uploadToDrive(folderId: string, file: Blob, name: string, contentType?: string, description?: string): Promise<DriveFile> {
  const type = contentType || file.type || 'application/octet-stream';
  const meta = { name: driveSafeName(name), parents: [folderId], mimeType: type, ...(description ? { description } : {}) };
  const fields = FILE_FIELDS;
  if (file.size <= MULTIPART_MAX) {
    const boundary = 'shco' + Math.random().toString(36).slice(2);
    const body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n',
      '--' + boundary + '\r\nContent-Type: ' + type + '\r\n\r\n',
      file,
      '\r\n--' + boundary + '--',
    ]);
    const res = await driveFetch(UPLOAD_API + '/files' + q({ uploadType: 'multipart', fields }), {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body,
    });
    return res.json();
  }
  const start = await driveFetch(UPLOAD_API + '/files' + q({ uploadType: 'resumable', fields }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(file.size) },
    body: JSON.stringify(meta),
  });
  const session = start.headers.get('Location');
  if (!session) throw new DriveError('Google Drive did not start the upload. Try again.');
  let res: Response;
  try {
    res = await fetch(session, { method: 'PUT', headers: { 'Content-Type': type }, body: file });
  } catch {
    throw new DriveError('The upload to Google Drive did not finish (network problem). Check your connection and try again.');
  }
  if (!res.ok) throw new DriveError(describeDriveError(res.status, '', 'upload failed'), res.status);
  return res.json();
}

/** Moves a file to the Shared Drive's trash (Drive empties it after 30 days). */
async function trashDriveFile(id: string): Promise<void> {
  await driveFetch(API + '/files/' + encodeURIComponent(id) + q({ fields: 'id' }), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/** Downloads a file's bytes with the user's token (used for staff photos). */
export async function downloadDriveFile(id: string): Promise<Blob> {
  const res = await driveFetch(API + '/files/' + encodeURIComponent(id) + q({ alt: 'media' }));
  return res.blob();
}

/**
 * Gives one @shcolaw.com user read access to one file (e.g. a staff member's own HR document
 * when HR files live in a partners-only Shared Drive). Never creates domain or public links.
 */
export async function grantReader(fileId: string, email: string): Promise<void> {
  const e = String(email || '').trim().toLowerCase();
  if (!e.endsWith('@shcolaw.com')) return;
  await driveFetch(API + '/files/' + encodeURIComponent(fileId) + '/permissions' + q({ sendNotificationEmail: 'false', fields: 'id' }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: e }),
  });
}

export const driveViewUrl = (f: { driveFileId?: string; webViewLink?: string }) =>
  f.webViewLink || (f.driveFileId ? 'https://drive.google.com/file/d/' + encodeURIComponent(f.driveFileId) + '/view' : '');

/* ------------------------------------------------------------------ connection test */

interface DriveTestResult { ok: boolean; message: string; folderName?: string; hrFolderName?: string; financeFolderName?: string }

type FolderInfo = DriveFile & { capabilities?: { canAddChildren?: boolean } };

/** Reads one configured folder; returns its info or a problem to show. */
async function checkFolder(id: string, label: string): Promise<{ f: FolderInfo; problem?: string; myDrive: boolean }> {
  const f = await getDriveFile(id, 'id,name,mimeType,driveId,capabilities(canAddChildren)') as FolderInfo;
  if (f.mimeType !== FOLDER_MIME) return { f, myDrive: false, problem: label + ': “' + f.name + '” is a file, not a folder. Paste the link of the Shared Drive (or a folder inside it).' };
  if (f.capabilities?.canAddChildren === false) return { f, myDrive: !f.driveId, problem: label + ': found “' + f.name + '” but your account cannot add files to it. Make yourself Manager or Content manager of that Shared Drive.' };
  return { f, myDrive: !f.driveId };
}

/** Writes a tiny file into `folderId`, reads it back and moves it to trash. */
async function writeReadTrash(folderId: string): Promise<void> {
  const stamp = new Date().toISOString();
  const f = await uploadToDrive(folderId, new Blob(['SHCO portal connection test ' + stamp], { type: 'text/plain' }), 'connection-test-' + stamp.replace(/[:.]/g, '-') + '.txt', 'text/plain');
  const back = await getDriveFile(f.id, 'id,name');
  await trashDriveFile(back.id);
}

/**
 * "Test connection": checks each configured Shared Drive.
 * - SHCO Portal (root): readable, a folder, in a Shared Drive, writable (test file written at the
 *   top, read back, moved to trash).
 * - SHCO Finance (when set): the same, with the test file written in Backups/. When it is not set
 *   the test file goes to Finance/Backups/ inside SHCO Portal.
 * - SHCO HR (when set): readable, a folder, writable.
 */
export async function testDriveConnection(): Promise<DriveTestResult> {
  const cfg = getDriveConfig();
  if (!cfg.clientId) return { ok: false, message: 'Add the OAuth client ID first.' };
  if (!looksLikeClientId(cfg.clientId)) return { ok: false, message: 'The OAuth client ID should end with “.apps.googleusercontent.com”. Copy the Client ID (not the client secret) from Google Cloud Console → Credentials.' };
  if (!cfg.rootFolderId) return { ok: false, message: 'Add the SHCO Portal Shared Drive link or ID first.' };
  const lines: string[] = [];
  const warnings: string[] = [];
  let folderName: string | undefined, financeFolderName: string | undefined, hrFolderName: string | undefined;
  try {
    const root = await checkFolder(cfg.rootFolderId, 'SHCO Portal');
    folderName = root.f.name;
    if (root.problem) return { ok: false, folderName, message: root.problem };
    if (root.myDrive) warnings.push('“' + root.f.name + '” is in a personal My Drive, not a Shared Drive, so files would belong to one person.');
    await writeReadTrash(cfg.rootFolderId);
    lines.push('SHCO Portal: “' + root.f.name + '” ✓');

    if (cfg.financeFolderId) {
      const fin = await checkFolder(cfg.financeFolderId, 'SHCO Finance');
      financeFolderName = fin.f.name;
      if (fin.problem) return { ok: false, folderName, financeFolderName, message: lines.join(' · ') + ' · ' + fin.problem };
      if (fin.myDrive) warnings.push('“' + fin.f.name + '” is in a personal My Drive, not a Shared Drive.');
      await writeReadTrash(await findOrCreateFolder(cfg.financeFolderId, 'Backups'));
      lines.push('SHCO Finance: “' + fin.f.name + '” ✓');
    } else {
      await writeReadTrash(await ensureFolderPath(cfg.rootFolderId, ['Finance', 'Backups']));
      lines.push('SHCO Finance not set: finance files go to Finance/ inside SHCO Portal, which all staff can see');
    }

    if (cfg.hrFolderId) {
      const hr = await checkFolder(cfg.hrFolderId, 'SHCO HR');
      hrFolderName = hr.f.name;
      if (hr.problem) return { ok: false, folderName, financeFolderName, hrFolderName, message: lines.join(' · ') + ' · ' + hr.problem };
      lines.push('SHCO HR: “' + hr.f.name + '” ✓');
    } else {
      lines.push('SHCO HR not set: HR files go to HR/ inside SHCO Portal');
    }

    return {
      ok: true, folderName, financeFolderName, hrFolderName,
      message: lines.join(' · ') + '. A test file was written, read back and moved to trash.' + (warnings.length ? ' Warning: ' + warnings.join(' ') + ' Use Shared Drives.' : ''),
    };
  } catch (e) {
    return { ok: false, folderName, financeFolderName, hrFolderName, message: (lines.length ? lines.join(' · ') + ' · ' : '') + (e instanceof Error ? e.message : String(e)) };
  }
}
