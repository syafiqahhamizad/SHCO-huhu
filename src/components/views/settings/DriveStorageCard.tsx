import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { getDriveConfig, isDriveConfigured, looksLikeClientId, parseDriveFolderId, testDriveConnection } from '../../../services/googleDriveService';
import { prepareStorage } from '../../../services/fileStorageService';
import { exportAllFirmData, SHARED_STATE_KEYS } from '../../../services/firmBackupService';
import { css, S, Txt, type SettingsCtx } from './settingsShared';

const INPUT = 'border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A;width:100%;box-sizing:border-box';
const ROW = 'display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center';

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Firm & Letterhead → "Google Drive storage" (where uploads go) and "Backup" (Export all firm
 * data). Managing Partner / admin only, like the rest of Firm & Practice Settings.
 */
export const DriveStorageCard = ({ C }: { C: SettingsCtx }) => {
  const app = useApp();
  const s = C.settings;
  const cfg = getDriveConfig();
  const on = isDriveConfigured(cfg);
  const [testing, setTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const saveFolder = (field: 'driveRootFolderId' | 'driveHrFolderId', label: string, raw: string) => {
    const v = raw.trim();
    const id = parseDriveFolderId(v);
    if (v && !id) { C.msg('That does not look like a Google Drive folder link or ID.'); return; }
    const nameField = field === 'driveRootFolderId' ? 'driveRootFolderName' : 'driveHrFolderName';
    C.save({ [field]: id, [nameField]: '', driveLastTest: undefined }, 'Drive Storage Changed', label + ': ' + (id || '(cleared)'));
    C.msg(id ? label + ' saved · click Test connection' : label + ' cleared');
  };

  const saveClientId = (raw: string) => {
    const v = raw.trim();
    if (v && !looksLikeClientId(v)) { C.msg('The OAuth client ID ends with “.apps.googleusercontent.com”.'); return; }
    C.save({ googleOAuthClientId: v, driveLastTest: undefined }, 'Drive Storage Changed', 'OAuth client ID ' + (v ? 'set' : 'cleared'));
    C.msg(v ? 'OAuth client ID saved' : 'OAuth client ID cleared');
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const r = await testDriveConnection();
      C.save({
        driveLastTest: { at: new Date().toISOString(), by: app.currentUser?.name || '', ok: r.ok, message: r.message },
        ...(r.folderName ? { driveRootFolderName: r.folderName } : {}),
        ...(r.hrFolderName ? { driveHrFolderName: r.hrFolderName } : {}),
      }, 'Drive Connection Tested', (r.ok ? 'OK: ' : 'Failed: ') + r.message);
      C.msg(r.ok ? 'Google Drive connected' : 'Drive test failed');
    } finally {
      setTesting(false);
    }
  };

  const switchOff = () => {
    if (!window.confirm('Switch new uploads back to Firebase Storage? Files already saved to Google Drive stay there and still open from their records.')) return;
    C.save({ driveRootFolderId: '', driveRootFolderName: '', driveLastTest: undefined }, 'Drive Storage Changed', 'Switched back to Firebase Storage');
    C.msg('New uploads now go to Firebase Storage');
  };

  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      // Get Drive access first, inside the click, so Google's popup is not blocked.
      let driveNote = '';
      if (on) { try { await prepareStorage(); } catch (e) { driveNote = e instanceof Error ? e.message : String(e); } }
      const local: Record<string, unknown> = {};
      const a = app as unknown as Record<string, unknown>;
      SHARED_STATE_KEYS.forEach((k) => { if (a[k] !== undefined) local[k] = a[k]; });
      const r = await exportAllFirmData({ localState: local, by: { name: app.currentUser?.name || '', email: app.currentUser?.email || '' } });
      const driveErr = driveNote || r.driveError;
      C.save({ lastBackup: { at: new Date().toISOString(), by: app.currentUser?.name || '', fileName: r.fileName, ...(r.drive ? { driveFileId: r.drive.id, webViewLink: r.drive.webViewLink } : {}) } }, 'Firm Data Exported', r.fileName + (r.drive ? ' · saved to Drive Backups/' : ' · downloaded'));
      const total = Object.values(r.counts).reduce((x, y) => x + y, 0);
      setExportMsg({
        ok: !driveErr || !on,
        text: r.fileName + ' downloaded (' + (r.bytes / 1024).toFixed(0) + ' KB · ' + total + ' records · ' + r.fileRefs + ' file references · access list ' + r.accessList + ')'
          + (r.source === 'this-device' ? ' · built from this device’s data' : '')
          + (r.drive ? ' · also saved to Google Drive → Backups/' : on ? ' · NOT saved to Google Drive: ' + driveErr : ' · Google Drive not set up, so only downloaded')
          + (r.secretsRemoved ? ' · ' + r.secretsRemoved + ' password field(s) left out' : '')
          + (r.notes.length ? ' · ' + r.notes.join(' ') : ''),
      });
    } catch (e) {
      setExportMsg({ ok: false, text: 'Export failed: ' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setExporting(false);
    }
  };

  const last = s.driveLastTest;
  const status: { color: string; bg: string; text: string } = !cfg.clientId && !cfg.rootFolderId
    ? { color: '#5B6478', bg: '#F6F8FA', text: 'Not set up · new uploads go to Firebase Storage' }
    : !on
      ? { color: '#8A6534', bg: '#FBF2E9', text: 'Half set up · add ' + (!cfg.rootFolderId ? 'the Shared Drive folder' : 'the OAuth client ID') + ' · new uploads still go to Firebase Storage' }
      : last && !last.ok
        ? { color: '#B23A2E', bg: '#FBEDE9', text: 'Last test failed (' + when(last.at) + '): ' + last.message + ' · new uploads try Google Drive and will fail until this is fixed' }
        : last && last.ok
          ? { color: '#2F6F4E', bg: '#E6EFE9', text: '✓ Connected to “' + (s.driveRootFolderName || 'Shared Drive') + '” · tested ' + when(last.at) + (last.by ? ' by ' + last.by : '') + ' · new uploads go to Google Drive' }
          : { color: '#8A6534', bg: '#FBF2E9', text: 'Set up · not tested yet · new uploads go to Google Drive. Click Test connection.' };

  return (
    <>
      <div style={css('grid-column:1 / -1;' + S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Google Drive storage</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>claim receipts, HR documents, staff photos, finance proofs and backups · kept in the firm’s Shared Drive</span></div>
        <div style={css(`padding:8px 14px;font-size:11px;font-weight:700;color:${status.color};background:${status.bg};border-bottom:1px solid #EEF1F5`)}>{status.text}</div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:12px 14px')}>
          <div style={css('display:flex;flex-direction:column;gap:9px;min-width:0')}>
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>Shared Drive folder</span><Txt value={s.driveRootFolderId || ''} placeholder="paste the folder link or ID" onCommit={(v) => saveFolder('driveRootFolderId', 'Shared Drive folder', v)} style={INPUT} /></label>
            {!!s.driveRootFolderName && <span style={css('margin-left:160px;font-size:10.5px;color:#2F6F4E')}>✓ {s.driveRootFolderName}</span>}
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>HR folder (optional)</span><Txt value={s.driveHrFolderId || ''} placeholder="blank = HR/ inside the folder above" onCommit={(v) => saveFolder('driveHrFolderId', 'HR folder', v)} style={INPUT} /></label>
            {!!s.driveHrFolderName && <span style={css('margin-left:160px;font-size:10.5px;color:#2F6F4E')}>✓ {s.driveHrFolderName}</span>}
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>OAuth client ID</span>
              {cfg.clientIdSource === 'env'
                ? <span style={css('font-size:11px;color:#16223A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')} title={cfg.clientId}>set by the site build (VITE_GOOGLE_OAUTH_CLIENT_ID)</span>
                : <Txt value={s.googleOAuthClientId || ''} placeholder="…apps.googleusercontent.com" onCommit={saveClientId} style={INPUT} />}
            </label>
            <div style={css('display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px')}>
              <button type="button" disabled={!on || testing} onClick={() => void test()} style={css(S.darkBtn + (!on || testing ? ';opacity:.5;cursor:default' : ''))}>{testing ? 'Testing…' : 'Test connection'}</button>
              {!!cfg.rootFolderId && <button type="button" onClick={switchOff} style={css(S.lightBtn)}>Switch back to Firebase Storage</button>}
              <span style={css('font-size:10.5px;color:#5B6478')}>The test writes a tiny file to Backups/, reads it and moves it to trash.</span>
            </div>
          </div>
          <details style={css('font-size:11px;line-height:1.55;color:#16223A;min-width:0')} open={!on}>
            <summary style={css('cursor:pointer;font-weight:700')}>One-time setup (Managing Partner)</summary>
            <ol style={css('margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px')}>
              <li><strong>Google Cloud Console</strong> (project gen-lang-client-0565207218) → APIs &amp; Services → Enable APIs → enable <strong>Google Drive API</strong>.</li>
              <li>APIs &amp; Services → <strong>OAuth consent screen</strong> → User type <strong>Internal</strong> (only @shcolaw.com accounts).</li>
              <li>APIs &amp; Services → <strong>Credentials</strong> → open “Web client (auto created by Google Service)” (or create an OAuth client ID of type Web application) → <strong>Authorized JavaScript origins</strong> must include https://portal.shcolaw.com{origin && origin !== 'https://portal.shcolaw.com' ? <> and this site ({origin})</> : null} (add http://localhost:3000 for testing) → Save → copy its <strong>Client ID</strong> into “OAuth client ID” above.</li>
              <li>Google Drive → Shared drives → New → <strong>“SHCO Portal”</strong> → Manage members: firm staff as <strong>Content manager</strong>, partners / admin as <strong>Manager</strong>. Open it and copy the link (or the ID after /folders/) into “Shared Drive folder”.</li>
              <li>Optional, recommended: a second Shared Drive <strong>“SHCO HR”</strong> with only partners / admin as members, pasted into “HR folder”, so staff cannot browse each other’s HR files. Each staff member is given view access to their own photo and personal documents.</li>
              <li>Click <strong>Test connection</strong>. Each person is asked once by Google to allow Drive access the first time they upload or open a Drive file.</li>
            </ol>
            <p style={css('margin:6px 0 0;color:#5B6478')}>No Cloud Functions, service accounts or public links are used; files are never shared outside the firm, so the Workspace’s Domain Restricted Sharing policy is not affected. Files uploaded before the switch stay in Firebase Storage and still open.</p>
          </details>
        </div>
      </div>

      <div style={css('grid-column:1 / -1;' + S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Backup</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>one JSON file with every record, Firm Settings, the access list and an index of all attached files</span></div>
        <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px')}>
          <button type="button" disabled={exporting} onClick={() => void exportAll()} style={css(S.darkBtn + (exporting ? ';opacity:.6;cursor:wait' : ''))}>{exporting ? 'Exporting…' : 'Export all firm data'}</button>
          <span style={css('font-size:11px;color:#16223A')}>
            {s.lastBackup
              ? <>Last backup: {when(s.lastBackup.at)}{s.lastBackup.by ? ' · by ' + s.lastBackup.by : ''}{s.lastBackup.webViewLink ? <> · <a href={s.lastBackup.webViewLink} target="_blank" rel="noopener noreferrer" style={css('color:#3D6B9C;font-weight:700')}>open in Drive</a></> : ' · downloaded only'}</>
              : 'No backup exported yet.'}
          </span>
          <span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>{on ? 'Downloads the file and saves a copy to Google Drive → Backups/.' : 'Downloads the file. Set up Google Drive above to also keep a copy in Backups/.'}</span>
        </div>
        {exportMsg && <div style={css(`padding:8px 14px;font-size:11px;line-height:1.5;border-top:1px solid #EEF1F5;color:${exportMsg.ok ? '#2F6F4E' : '#B23A2E'};background:${exportMsg.ok ? '#E6EFE9' : '#FBEDE9'}`)}>{exportMsg.text}</div>}
        <div style={css(S.foot)}>Passwords are never included. Attached files themselves are not inside the JSON: Drive files stay in the Shared Drive, older ones in Firebase Storage. Keep backups private; they contain client and staff personal data.</div>
      </div>
    </>
  );
};
