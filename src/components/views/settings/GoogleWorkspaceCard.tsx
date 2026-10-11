import React, { useEffect, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { getGoogleClientId, signedInGoogleEmail } from '../../../services/googleWorkspaceAuth';
import { testCourtDiary } from '../../../services/googleCalendarService';
import { testGoogleTasks, GOOGLE_TASK_LIST_TITLE } from '../../../services/googleTasksService';
import { testGmail } from '../../../services/gmailService';
import { parseCalendarId } from '../../../lib/calendarEvent';
import { readCalendarSyncStatus, syncCalendarNow, type CalendarSyncStatus } from '../../../hooks/useCalendarAutoSync';
import { css, S, Txt, type SettingsCtx } from './settingsShared';

const INPUT = 'border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A;width:100%;box-sizing:border-box';
const ROW = 'display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center';

type Svc = 'calendar' | 'tasks' | 'gmail';

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Google, e-mail & backup → "Google Calendar, Tasks & Gmail": the court diary calendar and one Test
 * button per service. Uses the same OAuth client ID as the Google Drive storage card.
 */
export const GoogleWorkspaceCard = ({ C }: { C: SettingsCtx }) => {
  const app = useApp();
  const s = C.settings;
  const clientId = getGoogleClientId().clientId;
  const [busy, setBusy] = useState<Svc | null>(null);
  const tests = s.googleWorkspaceLastTests || {};
  const myEmail = signedInGoogleEmail() || String(app.currentUser?.email || '').toLowerCase();

  // Every portal date ⇄ the firm calendar (hooks/useCalendarAutoSync): last run and "Sync now".
  const [sync, setSync] = useState<CalendarSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => { void readCalendarSyncStatus().then(setSync); }, []);
  const syncNow = async () => {
    setSyncing(true);
    try { const r = await syncCalendarNow(); setSync(r); C.msg(r.error ? 'Calendar sync: ' + r.error : 'Calendar synced: ' + (r.pushed || 0) + ' sent, ' + (r.pulled || 0) + ' moved from Google, ' + (r.removed || 0) + ' removed'); }
    catch (e) { C.msg(e instanceof Error ? e.message : String(e)); }
    finally { setSyncing(false); }
  };

  const saveCalendarId = (raw: string) => {
    const v = raw.trim();
    const id = parseCalendarId(v);
    if (v && !id) { C.msg('That does not look like a Google Calendar ID (it looks like an e-mail address, e.g. c_…@group.calendar.google.com).'); return; }
    C.save({ courtDiaryCalendarId: id, googleWorkspaceLastTests: { ...tests, calendar: undefined } }, 'Court Diary Calendar Changed', 'Calendar ID: ' + (id || '(cleared)'));
    C.msg(id ? 'Court diary calendar saved · click Test' : 'Court diary calendar cleared');
  };

  const saveCalendarName = (raw: string) => {
    C.save({ courtDiaryCalendarName: raw.trim() }, 'Court Diary Calendar Changed', 'Calendar name: ' + (raw.trim() || '(cleared)'));
    C.msg('Calendar name saved');
  };

  const run = async (svc: Svc) => {
    if (busy) return;
    setBusy(svc);
    try {
      const r = svc === 'calendar' ? await testCourtDiary() : svc === 'tasks' ? await testGoogleTasks() : await testGmail();
      const name = svc === 'calendar' ? (r as { calendarName?: string }).calendarName : undefined;
      C.save({
        googleWorkspaceLastTests: { ...(C.settings.googleWorkspaceLastTests || {}), [svc]: { at: new Date().toISOString(), by: app.currentUser?.name || '', ok: r.ok, message: r.message } },
        ...(name && !C.settings.courtDiaryCalendarName ? { courtDiaryCalendarName: name } : {}),
      }, 'Google Workspace Tested', LABEL[svc] + ' ' + (r.ok ? 'OK: ' : 'failed: ') + r.message);
      C.msg(LABEL[svc] + (r.ok ? ' works' : ' test failed'));
    } finally {
      setBusy(null);
    }
  };

  const status = (svc: Svc, notReady?: string) => {
    const t = tests[svc];
    if (notReady) return { color: '#5B6478', bg: '#F6F8FA', text: notReady };
    if (!t) return { color: '#8A6534', bg: '#FBF2E9', text: 'Not tested yet' };
    return t.ok
      ? { color: '#2F6F4E', bg: '#E6EFE9', text: '✓ ' + t.message + ' · ' + when(t.at) + (t.by ? ' by ' + t.by : '') }
      : { color: '#B23A2E', bg: '#FBEDE9', text: 'Failed ' + when(t.at) + ': ' + t.message };
  };

  const noClient = clientId ? '' : 'Add the OAuth client ID in “Google Drive storage” above first.';
  const rows: { svc: Svc; what: string; button: string; notReady: string }[] = [
    { svc: 'calendar', what: 'Hearings and court dates go into the shared court diary; the PIC gets an invitation.', button: 'Test Calendar', notReady: noClient || (s.courtDiaryCalendarId ? '' : 'Add the court diary Calendar ID first.') },
    { svc: 'tasks', what: 'Each person’s own portal tasks appear in their Google Tasks, list “' + GOOGLE_TASK_LIST_TITLE + '”.', button: 'Test Tasks', notReady: noClient },
    { svc: 'gmail', what: 'E-mails the portal sends on your behalf go from your own Gmail (in your Sent folder).', button: 'Test Gmail', notReady: noClient },
  ];
  const allOk = rows.every((r) => tests[r.svc]?.ok);

  return (
    <div style={css('grid-column:1 / -1;' + S.card)}>
      <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Google Calendar, Tasks &amp; Gmail</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>court diary, personal task sync and e-mail from each person’s own account · same Google sign-in as Drive</span></div>
      <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:12px 14px')}>
        <div style={css('display:flex;flex-direction:column;gap:9px;min-width:0')}>
          <label style={css(ROW)}><span style={css(S.fieldLabel)}>Court diary Calendar ID</span><Txt value={s.courtDiaryCalendarId || ''} placeholder="SHCO HQ (firm calendar) · or paste another Calendar ID" onCommit={saveCalendarId} style={INPUT} /></label>
          <label style={css(ROW)}><span style={css(S.fieldLabel)}>Calendar name</span><Txt value={s.courtDiaryCalendarName || ''} placeholder="SHCO Court Diary" onCommit={saveCalendarName} style={INPUT} /></label>
          {rows.map((r) => {
            const st = status(r.svc, r.notReady);
            const disabled = !!r.notReady || !!busy;
            return (
              <div key={r.svc} style={css('border:1px solid #EEF1F5;border-radius:8px;overflow:hidden')}>
                <div style={css('display:flex;align-items:center;gap:10px;padding:7px 10px')}>
                  <span style={css('min-width:0;flex:1')}>
                    <span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>{LABEL[r.svc]}</span>
                    <span style={css('display:block;font-size:10.5px;color:#5B6478')}>{r.what}</span>
                  </span>
                  <button type="button" disabled={disabled} onClick={() => void run(r.svc)} style={css(S.darkBtn + ';white-space:nowrap' + (disabled ? ';opacity:.5;cursor:default' : ''))}>{busy === r.svc ? 'Testing…' : r.button}</button>
                </div>
                <div style={css(`padding:6px 10px;font-size:10.5px;line-height:1.45;font-weight:700;color:${st.color};background:${st.bg};border-top:1px solid #EEF1F5`)}>{st.text}</div>
              </div>
            );
          })}
          <div style={css('border:1px solid #EEF1F5;border-radius:8px;overflow:hidden')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:7px 10px')}>
              <span style={css('min-width:0;flex:1')}>
                <span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A')}>Every date ⇄ firm calendar</span>
                <span style={css('display:block;font-size:10.5px;color:#5B6478')}>Hearings, next court dates, deadlines, key dates, meetings, approved leave and office closures go into this calendar by themselves (PIC codes first, the firm’s colours); dates moved in Google move in the portal. Runs every 5 minutes.</span>
              </span>
              <button type="button" disabled={syncing} onClick={() => void syncNow()} style={css(S.darkBtn + ';white-space:nowrap' + (syncing ? ';opacity:.5;cursor:default' : ''))}>{syncing ? 'Syncing…' : 'Sync now'}</button>
            </div>
            <div style={css(`padding:6px 10px;font-size:10.5px;line-height:1.45;font-weight:700;color:${sync?.error ? '#B23A2E' : sync?.at ? '#2F6F4E' : '#8A6534'};background:${sync?.error ? '#FBEDE9' : sync?.at ? '#E6EFE9' : '#FBF2E9'};border-top:1px solid #EEF1F5`)}>
              {!sync?.at ? 'Not synced yet' : (sync.error ? 'Last try ' + when(sync.at) + ': ' + sync.error : '✓ Last sync ' + when(sync.at) + ' · ' + (sync.total || 0) + ' dates · ' + (sync.pushed || 0) + ' sent · ' + (sync.pulled || 0) + ' moved from Google · ' + (sync.removed || 0) + ' removed') + (sync.by ? ' · by ' + sync.by : '')}
            </div>
          </div>
          <span style={css('font-size:10.5px;color:#5B6478;line-height:1.5')}>
            Calendar test: creates a test event for today in the court diary, then deletes it. Tasks test: finds or creates “{GOOGLE_TASK_LIST_TITLE}” in <em>your</em> Google Tasks. Gmail test: sends a short e-mail to you{myEmail ? ' (' + myEmail + ')' : ''}. Google asks each person once to allow each service.
          </span>
        </div>
        <details style={css('font-size:11px;line-height:1.55;color:#16223A;min-width:0')} open={!allOk}>
          <summary style={css('cursor:pointer;font-weight:700')}>One-time setup</summary>
          <ol style={css('margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px')}>
            <li><strong>Google Cloud Console</strong> (project gen-lang-client-0565207218) → APIs &amp; Services → Enable APIs → enable <strong>Google Calendar API</strong>, <strong>Google Tasks API</strong> and <strong>Gmail API</strong>.</li>
            <li>Use the <strong>same OAuth client</strong> as Google Drive (the Client ID in “Google Drive storage” above). The OAuth consent screen stays <strong>Internal</strong>; no extra credentials are needed.</li>
            <li>Google Calendar → Other calendars → <strong>+ Create new calendar</strong> → name it <strong>“SHCO Court Diary”</strong>, time zone (GMT+08:00) Kuala Lumpur.</li>
            <li>Its <strong>Settings and sharing</strong> → Share with specific people or groups → add the staff (or a staff Google Group) with <strong>Make changes to events</strong>.</li>
            <li>Same page → <strong>Integrate calendar</strong> → copy the <strong>Calendar ID</strong> (ends with @group.calendar.google.com) into “Court diary Calendar ID” above.</li>
            <li>Click <strong>Test Calendar</strong>, <strong>Test Tasks</strong> and <strong>Test Gmail</strong>.</li>
          </ol>
          <p style={css('margin:6px 0 0;color:#5B6478')}>Google Tasks is personal to each Google account, so the portal can only sync a person’s <em>own</em> tasks into their own Google Tasks; it cannot put tasks into a colleague’s list. Gmail can only send (scope gmail.send), never read mail. WhatsApp messages open in WhatsApp with the text filled in; the portal shows “Opened in WhatsApp” and cannot tell whether they were sent or read.</p>
        </details>
      </div>
      <div style={css(S.foot)}>Nothing is shown as done unless Google confirms it. If an API is not enabled, a calendar is not shared with you, or a popup is blocked, the portal says so and nothing is saved as synced.</div>
    </div>
  );
};

const LABEL: Record<Svc, string> = { calendar: 'Google Calendar', tasks: 'Google Tasks', gmail: 'Gmail' };
