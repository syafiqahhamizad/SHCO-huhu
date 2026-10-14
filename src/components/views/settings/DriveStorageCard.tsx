import React, { useState } from 'react';
import { askForm } from '../../ui/askForm';
import { useApp } from '../../../context/AppContext';
import { getDriveConfig, isDriveConfigured, looksLikeClientId, parseDriveFolderId, testDriveConnection } from '../../../services/googleDriveService';
import { prepareStorage, renameClientFolder } from '../../../services/fileStorageService';
import { exportAllFirmData, SHARED_STATE_KEYS } from '../../../services/firmBackupService';
import { DEFAULT_PRACTICE_SETTINGS } from '../../../services/templateService';
import { driveSafeName } from '../../../lib/driveLayout';
import { css, S, Txt, type SettingsCtx } from './settingsShared';
import { GoogleWorkspaceCard } from './GoogleWorkspaceCard';
import { EmailNotificationsCard } from './EmailNotificationsCard';

const INPUT = 'border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A;width:100%;box-sizing:border-box';
const ROW = 'display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center';

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Google, e-mail & backup → "Google Drive storage" (where uploads go: the SHCO Portal, SHCO Finance
 * and SHCO HR Shared Drives) and "Backup" (Export all firm data). Admins only, like the rest of
 * Firm & Practice Settings.
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

  const saveFolder = (field: 'driveRootFolderId' | 'driveHrFolderId' | 'driveFinanceFolderId', label: string, raw: string) => {
    const v = raw.trim();
    const id = parseDriveFolderId(v);
    if (v && !id) { C.msg('That does not look like a Google Drive folder link or ID.'); return; }
    const nameField = field === 'driveRootFolderId' ? 'driveRootFolderName' : field === 'driveHrFolderId' ? 'driveHrFolderName' : 'driveFinanceFolderName';
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
        ...(r.financeFolderName ? { driveFinanceFolderName: r.financeFolderName } : {}),
      }, 'Drive Connection Tested', (r.ok ? 'OK: ' : 'Failed: ') + r.message);
      C.msg(r.ok ? 'Google Drive connected' : 'Drive test failed');
    } finally {
      setTesting(false);
    }
  };

  const switchOff = () => {
    if (!window.confirm('Turn off Google Drive storage? Every upload in the portal (claims, HR, KYC, matter files, finance proofs, letterhead) will be BLOCKED until Drive is set up again. Files already saved to Google Drive stay there and still open from their records.')) return;
    C.save({ driveRootFolderId: '', driveRootFolderName: '', driveLastTest: undefined }, 'Drive Storage Changed', 'Google Drive storage turned off (uploads blocked)');
    C.msg('Google Drive storage turned off. Uploads are blocked until it is set up again');
  };

  const exportAll = async (): Promise<boolean> => {
    if (exporting) return false;
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
      C.save({ lastBackup: { at: new Date().toISOString(), by: app.currentUser?.name || '', fileName: r.fileName, ...(r.drive ? { driveFileId: r.drive.id, webViewLink: r.drive.webViewLink } : {}) } }, 'Firm Data Exported', r.fileName + (r.drive ? ' · saved to SHCO Finance › Backups' : ' · downloaded'));
      const total = Object.values(r.counts).reduce((x, y) => x + y, 0);
      setExportMsg({
        ok: !driveErr || !on,
        text: r.fileName + ' downloaded (' + (r.bytes / 1024).toFixed(0) + ' KB · ' + total + ' records · ' + r.fileRefs + ' file references · access list ' + r.accessList + ')'
          + (r.source === 'this-device' ? ' · built from this device’s data' : '')
          + (r.drive ? ' · also saved to Google Drive → SHCO Finance › Backups' : on ? ' · NOT saved to Google Drive: ' + driveErr : ' · Google Drive not set up, so only downloaded')
          + (r.secretsRemoved ? ' · ' + r.secretsRemoved + ' password field(s) left out' : '')
          + (r.notes.length ? ' · ' + r.notes.join(' ') : ''),
      });
      return true;
    } catch (e) {
      setExportMsg({ ok: false, text: 'Export failed: ' + (e instanceof Error ? e.message : String(e)) });
      return false;
    } finally {
      setExporting(false);
    }
  };

  // Super Admin: clear test data, always after a fresh backup.
  const isSuperAdmin = !!app.currentUser?.isSuperAdmin || String(app.currentUser?.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com';
  const resetData = async () => {
    const v = await askForm('Reset test data', [{ key: 'word', label: 'Type RESET to confirm', placeholder: 'RESET', required: true }], {
      ok: 'Back up, then reset',
      note: 'A full backup is made first (downloaded and saved to Google Drive). Then these are cleared for everyone: leads, quotations, invoices, receipts, payments, client account, claims, vouchers, approvals, payroll, journals, the books, deadlines, leave, attendance, meetings, notifications, activity logs, the Recycle Bin, the dashboard funds / compliance / direction lists — and inside every file: tasks, hearings, court memos, notes, filing & service, weekly status and history. KEPT: clients, case records and their documents, Users & Roles, firm settings, Firm Start Centre, running numbers, referral partners, law-firm registry, inventory and bank accounts.',
    });
    if (!v) return;
    if (v.word.trim().toUpperCase() !== 'RESET') { C.msg('Not reset: type RESET exactly.'); return; }
    const ok = await exportAll();
    if (!ok) { C.msg('Not reset: the backup did not work. Nothing was cleared.'); return; }
    if (app.resetTestData()) C.msg('Test data cleared. The backup is in your Downloads (and Google Drive).');
  };

  // Super Admin: one client number style for everyone (CL-<year of first file>-<NNN>), after a backup.
  const numberClientsNow = async () => {
    const list = app.assignClientNumbers(false);
    if (!list.length) { C.msg('Every client already has its CL-year-number.'); return; }
    const v = await askForm('Client numbers', [{ key: 'word', label: 'Type NUMBER to confirm', placeholder: 'NUMBER', required: true }], {
      ok: 'Back up, then renumber',
      note: list.length + ' clients get the one style CL-<year the first file was opened>-<running no.>. Files, bills and receipts stay linked (only the number people see changes). Each client\'s Google Drive folder is renamed to match. ' + list.map((x) => x.from + ' → ' + x.to + ' (' + x.name + ')').join(' · '),
    });
    if (!v) return;
    if (v.word.trim().toUpperCase() !== 'NUMBER') { C.msg('Not changed: type NUMBER exactly.'); return; }
    if (!(await exportAll())) { C.msg('Not changed: the backup did not work.'); return; }
    const done = app.assignClientNumbers(true);
    let renamed = 0, failed = 0;
    for (const x of done) {
      try { if (await renameClientFolder(x.name, x.from, x.to)) renamed += 1; } catch { failed += 1; }
    }
    C.msg(done.length + ' clients numbered. ' + renamed + ' Drive folders renamed' + (failed ? ', ' + failed + ' could not be renamed (rename them by hand in Drive › Clients)' : '') + '.');
  };

  // Practice area → folder name under Case files/ (blank = the area name).
  const areas = (s.practiceAreas && s.practiceAreas.length ? s.practiceAreas : DEFAULT_PRACTICE_SETTINGS.practiceAreas) || [];
  const areaNames = s.drivePracticeFolderNames || {};
  const saveAreaFolder = (area: string, raw: string) => {
    const v = raw.trim();
    const next = { ...areaNames };
    if (v && v !== area) next[area] = driveSafeName(v); else delete next[area];
    C.save({ drivePracticeFolderNames: next }, 'Drive Storage Changed', 'Case files folder for ' + area + ': ' + (next[area] || area));
    C.msg('New files in ' + area + ' go to Case files › ' + (next[area] || area) + '. Existing folders are not renamed');
  };

  const last = s.driveLastTest;
  const status: { color: string; bg: string; text: string } = !cfg.clientId && !cfg.rootFolderId
    ? { color: '#5B6478', bg: '#F6F8FA', text: 'Not set up · uploads are blocked until Google Drive is set up' }
    : !on
      ? { color: '#8A6534', bg: '#FBF2E9', text: 'Half set up · add ' + (!cfg.rootFolderId ? 'the Shared Drive folder' : 'the OAuth client ID') + ' · uploads are blocked until this is finished' }
      : last && !last.ok
        ? { color: '#B23A2E', bg: '#FBEDE9', text: 'Last test failed (' + when(last.at) + '): ' + last.message + ' · new uploads try Google Drive and will fail until this is fixed' }
        : last && last.ok
          ? { color: '#2F6F4E', bg: '#E6EFE9', text: '✓ Connected to “' + (s.driveRootFolderName || 'Shared Drive') + '” · tested ' + when(last.at) + (last.by ? ' by ' + last.by : '') + ' · new uploads go to Google Drive' }
          : { color: '#8A6534', bg: '#FBF2E9', text: 'Set up · not tested yet · new uploads go to Google Drive. Click Test connection.' };

  return (
    <>
      <div style={css('grid-column:1 / -1;' + S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Google Drive storage</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>every upload in the portal goes to one of three Shared Drives: SHCO Portal (matter files, client KYC), SHCO Finance (claims, payment vouchers, bank-in proofs, client account, engagement &amp; billing, backups) and SHCO HR (staff files)</span></div>
        <div style={css(`padding:8px 14px;font-size:11px;font-weight:700;color:${status.color};background:${status.bg};border-bottom:1px solid #EEF1F5`)}>{status.text}</div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:12px 14px')}>
          <div style={css('display:flex;flex-direction:column;gap:9px;min-width:0')}>
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>SHCO Portal Shared Drive</span><Txt value={s.driveRootFolderId || ''} placeholder="paste the Shared Drive link or ID" onCommit={(v) => saveFolder('driveRootFolderId', 'SHCO Portal Shared Drive', v)} style={INPUT} /></label>
            {!!s.driveRootFolderName && <span style={css('margin-left:160px;font-size:10.5px;color:#2F6F4E')}>✓ {s.driveRootFolderName}</span>}
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>Finance Shared Drive</span><Txt value={s.driveFinanceFolderId || ''} placeholder="SHCO Finance link or ID (partners / Accounts only)" onCommit={(v) => saveFolder('driveFinanceFolderId', 'Finance Shared Drive', v)} style={INPUT} /></label>
            {s.driveFinanceFolderId
              ? (!!s.driveFinanceFolderName && <span style={css('margin-left:160px;font-size:10.5px;color:#2F6F4E')}>✓ {s.driveFinanceFolderName}</span>)
              : <span style={css('margin-left:160px;font-size:10.5px;line-height:1.45;font-weight:700;color:#B23A2E')}>Not set: claims, payment vouchers, bank-in proofs, client account papers, engagement &amp; billing papers and backups go to a “Finance” folder inside SHCO Portal, which every staff member can see. Create the SHCO Finance Shared Drive and paste its link here.</span>}
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>HR Shared Drive</span><Txt value={s.driveHrFolderId || ''} placeholder="SHCO HR link or ID · blank = HR/ inside SHCO Portal" onCommit={(v) => saveFolder('driveHrFolderId', 'HR Shared Drive', v)} style={INPUT} /></label>
            {!!s.driveHrFolderName && <span style={css('margin-left:160px;font-size:10.5px;color:#2F6F4E')}>✓ {s.driveHrFolderName}</span>}
            <label style={css(ROW)}><span style={css(S.fieldLabel)}>OAuth client ID</span>
              {cfg.clientIdSource === 'env'
                ? <span style={css('font-size:11px;color:#16223A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')} title={cfg.clientId}>set by the site build (VITE_GOOGLE_OAUTH_CLIENT_ID)</span>
                : <Txt value={s.googleOAuthClientId || ''} placeholder="…apps.googleusercontent.com" onCommit={saveClientId} style={INPUT} />}
            </label>
            <div style={css('display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px')}>
              <button type="button" disabled={!on || testing} onClick={() => void test()} style={css(S.darkBtn + (!on || testing ? ';opacity:.5;cursor:default' : ''))}>{testing ? 'Testing…' : 'Test connection'}</button>
              {!!cfg.rootFolderId && <button type="button" onClick={switchOff} style={css(S.lightBtn)}>Turn off Drive storage</button>}
              <span style={css('font-size:10.5px;color:#5B6478')}>The test checks each Shared Drive set above, writes a tiny file, reads it back and moves it to trash.</span>
            </div>
            <details style={css('margin-top:4px;font-size:11px;color:#16223A')}>
              <summary style={css('cursor:pointer;font-weight:700')}>Case files folder names by practice area</summary>
              <p style={css('margin:6px 0;font-size:10.5px;line-height:1.5;color:#5B6478')}>New files go to SHCO Portal › Case files › <i>practice area</i> › “NNN - title”. Blank = the practice area’s own name. Changing a name affects new folders only; nothing already in Drive is renamed.</p>
              <div style={css('display:flex;flex-direction:column;gap:6px')}>
                {areas.map((a) => (
                  <label key={a.id || a.name} style={css(ROW)}><span style={css(S.fieldLabel)}>{a.name}</span><Txt value={areaNames[a.name] || ''} placeholder={a.name} onCommit={(v) => saveAreaFolder(a.name, v)} style={INPUT} /></label>
                ))}
              </div>
            </details>
          </div>
          <details style={css('font-size:11px;line-height:1.55;color:#16223A;min-width:0')} open={!on}>
            <summary style={css('cursor:pointer;font-weight:700')}>One-time setup</summary>
            <ol style={css('margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px')}>
              <li><strong>Google Cloud Console</strong> (project gen-lang-client-0565207218) → APIs &amp; Services → Enable APIs → enable <strong>Google Drive API</strong>.</li>
              <li>APIs &amp; Services → <strong>OAuth consent screen</strong> → User type <strong>Internal</strong> (only @shcolaw.com accounts).</li>
              <li>APIs &amp; Services → <strong>Credentials</strong> → open “Web client (auto created by Google Service)” (or create an OAuth client ID of type Web application) → <strong>Authorized JavaScript origins</strong> must include https://portal.shcolaw.com{origin && origin !== 'https://portal.shcolaw.com' ? <> and this site ({origin})</> : null} (add http://localhost:3000 for testing) → Save → copy its <strong>Client ID</strong> into “OAuth client ID” above.</li>
              <li>Google Drive → Shared drives → New → <strong>“SHCO Portal”</strong>: all staff as <strong>Content manager</strong>, partners / admin as <strong>Manager</strong>. Paste its link into “SHCO Portal Shared Drive”. Matter files go to Case files › practice area › “NNN - title” (Court Papers, Correspondence, Client Documents, Research, Closing) and client KYC to Clients › “ID - name” › KYC.</li>
              <li>New Shared Drive <strong>“SHCO Finance”</strong>: partners and Accounts only. Paste its link into “Finance Shared Drive”. It holds <i>year</i> › Claims, Payment Vouchers, Bank-in Proofs, Client Account; Files › “NNN - title” (signed Letter of Engagement, quotations, invoices, receipts); and Backups. Staff who are not members can still submit claims: their own receipts then go to Finance › <i>year</i> › Claims inside SHCO Portal.</li>
              <li>New Shared Drive <strong>“SHCO HR”</strong>: partners / admin only. Paste its link into “HR Shared Drive”. Each staff member gets a “Staff ID - Name” folder and is given view access to their own photo and personal documents.</li>
              <li>Old drives stay as they are: nothing is moved or renamed. Link a file’s old folder in Edit matter details › Old folder.</li>
              <li>Click <strong>Test connection</strong>. Each person is asked once by Google to allow Drive access the first time they upload or open a Drive file.</li>
            </ol>
            <p style={css('margin:6px 0 0;color:#5B6478')}>No Cloud Functions, service accounts or public links are used; files are never shared outside the firm, so the Workspace’s Domain Restricted Sharing policy is not affected. Files uploaded before the switch to Drive stay in Firebase Storage (read-only) and still open; nothing new is written there.</p>
          </details>
        </div>
      </div>

      <GoogleWorkspaceCard C={C} />
      <EmailNotificationsCard />

      <div style={css('grid-column:1 / -1;' + S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Backup</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>one JSON file with every record, Firm Settings, the access list and an index of all attached files</span></div>
        <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px')}>
          <button type="button" disabled={exporting} onClick={() => void exportAll()} style={css(S.darkBtn + (exporting ? ';opacity:.6;cursor:wait' : ''))}>{exporting ? 'Exporting…' : 'Export all firm data'}</button>
          <span style={css('font-size:11px;color:#16223A')}>
            {s.lastBackup
              ? <>Last backup: {when(s.lastBackup.at)}{s.lastBackup.by ? ' · by ' + s.lastBackup.by : ''}{s.lastBackup.webViewLink ? <> · <a href={s.lastBackup.webViewLink} target="_blank" rel="noopener noreferrer" style={css('color:#3D6B9C;font-weight:700')}>open in Drive</a></> : ' · downloaded only'}</>
              : 'No backup exported yet.'}
          </span>
          <span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>{on ? 'Downloads the file and saves a copy to Google Drive → ' + (s.driveFinanceFolderId ? 'SHCO Finance › Backups.' : 'SHCO Portal › Finance › Backups (no Finance drive set).') : 'Downloads the file. Set up Google Drive above to also keep a copy in SHCO Finance › Backups.'}</span>
        </div>
        {exportMsg && <div style={css(`padding:8px 14px;font-size:11px;line-height:1.5;border-top:1px solid #EEF1F5;color:${exportMsg.ok ? '#2F6F4E' : '#B23A2E'};background:${exportMsg.ok ? '#E6EFE9' : '#FBEDE9'}`)}>{exportMsg.text}</div>}
        {isSuperAdmin && <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid #EEF1F5;background:#FBF4F2')}><button type="button" disabled={exporting} onClick={() => void resetData()} style={css('border:1px solid #B23A2E;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit')}>Reset test data…</button><button type="button" disabled={exporting} onClick={() => void numberClientsNow()} style={css('border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Client numbers…</button><span style={css('font-size:10.5px;color:#5B6478')}>Super Admin only. Backs everything up first, then clears test entries. Clients, cases, users, settings and running numbers stay.</span></div>}
        <div style={css(S.foot)}>Passwords are never included. Attached files themselves are not inside the JSON: Drive files stay in the Shared Drive, older ones in Firebase Storage. Keep backups private; they contain client and staff personal data.</div>
      </div>
    </>
  );
};
