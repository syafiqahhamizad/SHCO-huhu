import { useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useApp } from '../context/AppContext';
import { firestoreDb } from '../services/firestoreSyncService';
import { isCourtDiaryConfigured, listGoogleOnlyEvents, listPortalEvents, removeFirmEvent, upsertFirmEvent } from '../services/googleCalendarService';
import { GOOGLE_TOKEN_EVENT, getGoogleAccessToken, googleErrorMessage, hasValidGoogleToken } from '../services/googleWorkspaceAuth';
import { calSignature, calendarItems, matchEventToCase, parseCalKey, type CalItem, type GoogleOnlyEvent } from '../lib/calendarItems';
import { courtOf } from '../components/views/cases/caseModel';
import type { Case, Meeting, User } from '../types';

/**
 * Keeps the firm calendar (Google Calendar "SHCO HQ") and the portal in step, both ways:
 *   - every date keyed into the portal is added / updated / removed in the calendar;
 *   - a portal date moved in Google (dragged to another day) moves in the portal too.
 *
 * One session at a time does the work (a 6-minute lock in firm/main/config/calendarSync), so two
 * computers never send the same update twice. It runs every 5 minutes and shortly after a date
 * changes, only in a session already allowed to use Google Calendar (no pop-ups). Firm Settings →
 * Google has "Sync now", which asks for permission if needed.
 */

const RUN_EVERY = 5 * 60_000;
const LOCK_MS = 6 * 60_000;
const SETTLE_MS = 30_000;
const lockRef = () => doc(firestoreDb, 'firm', 'main', 'config', 'calendarSync');
const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const sinceDay = () => isoDay(new Date(Date.now() - 30 * 86400000));
const PREVIEW = new URLSearchParams(window.location.search).get('preview') === '1';

export interface CalendarSyncStatus { at?: string; by?: string; pushed?: number; pulled?: number; removed?: number; total?: number; error?: string }

/** Last run, for Firm Settings. */
export async function readCalendarSyncStatus(): Promise<CalendarSyncStatus | null> {
  try { const s = await getDoc(lockRef()); return s.exists() ? (s.data().last as CalendarSyncStatus) || null : null; } catch { return null; }
}

/* The mounted hook registers what a run needs, so "Sync now" in Settings can trigger it. */
let runner: ((force: boolean) => Promise<CalendarSyncStatus>) | null = null;

/** Firm Settings → "Sync now": asks Google for permission if needed, then runs straight away. */
export async function syncCalendarNow(): Promise<CalendarSyncStatus> {
  if (!isCourtDiaryConfigured()) throw new Error('Set the firm calendar ID first (Court diary Calendar ID).');
  await getGoogleAccessToken('calendar');
  if (!runner) throw new Error('Calendar sync is not ready yet. Reload the page and try again.');
  return runner(true);
}

export function useCalendarAutoSync() {
  const app = useApp();
  const { isAuthenticated, currentUser, currentRole, cases = [], deadlines = [], meetings = [], leaveApplications = [], announcements = [], users = [], updateCase, addMeeting } = app;
  const enabled = isAuthenticated && currentRole !== 'Client' && !PREVIEW;
  const items = useMemo(
    () => calendarItems({ cases, deadlines, meetings, leaveApplications, announcements, users, courtOf: (c) => courtOf(c), since: sinceDay() }),
    [cases, deadlines, meetings, leaveApplications, announcements, users],
  );
  const live = useRef({ items, cases, meetings, leaveApplications, users, updateCase, addMeeting, me: String(currentUser?.email || '').toLowerCase() });
  live.current = { items, cases, meetings, leaveApplications, users, updateCase, addMeeting, me: String(currentUser?.email || '').toLowerCase() };
  const busy = useRef(false);
  const started = useRef(Date.now());

  /** Brings a date moved in Google back into the portal record. False = not a movable record. */
  const pullMove = (key: string, date: string, time: string): boolean => {
    const k = parseCalKey(key);
    const L = live.current;
    if (!k) return false;
    if (k.kind === 'hearing' || k.kind === 'task') {
      const c = L.cases.find((x: Case) => x.id === k.caseId);
      if (!c) return false;
      const note = { id: 'CAL-' + Date.now(), timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), type: 'Status Update' as const, title: 'Date moved in Google Calendar', description: 'Moved to ' + date + ' in the firm calendar', actor: 'Google Calendar' };
      if (k.kind === 'hearing') {
        if (!(c.hearings || []).some((h) => h.id === k.id)) return false;
        L.updateCase(c.id, { hearings: (c.hearings || []).map((h) => (h.id === k.id ? { ...h, date } : h)), activityLogs: [note, ...(c.activityLogs || [])] });
      } else {
        if (!(c.tasks || []).some((t) => t.id === k.id)) return false;
        L.updateCase(c.id, { tasks: (c.tasks || []).map((t) => (t.id === k.id ? { ...t, dueDate: date } : t)), activityLogs: [note, ...(c.activityLogs || [])] });
      }
      return true;
    }
    if (k.kind === 'meeting') {
      const m = L.meetings.find((x: Meeting) => x.id === k.id);
      if (!m) return false;
      L.addMeeting({ ...m, date, ...(time ? { time } : {}) });
      return true;
    }
    return false; // leave, closures, firm deadlines: the portal's date wins
  };

  /** True when the portal record behind an event is really gone (not just not loaded yet). */
  const goneForSure = (key: string): boolean => {
    const k = parseCalKey(key);
    const L = live.current;
    if (!k) return false;
    if (k.kind === 'hearing' || k.kind === 'task') {
      const c = L.cases.find((x: Case) => x.id === k.caseId);
      return !!c; // the file is loaded and the item no longer qualifies (adjourned, deleted, archived)
    }
    if (k.kind === 'meeting') return L.meetings.length > 0;
    if (k.kind === 'leave') return L.leaveApplications.length > 0;
    return false;
  };

  /** Google-only events that belong to a file → that file's "From the firm calendar" list (Court tab). */
  const offerToFiles = (events: GoogleOnlyEvent[]) => {
    const L = live.current;
    const linked = new Set(L.cases.flatMap((c: Case) => (c.hearings || []).map((h) => h.googleEventId).filter(Boolean) as string[]));
    const codeOf = (who: string) => {
      const n = who.toLowerCase();
      const u = (L.users as User[]).find((x) => [x.name, x.code, x.id].some((v) => v && String(v).toLowerCase() === n));
      return (u?.code || (/^[A-Za-z]{2,4}$/.test(who) ? who : '')).toUpperCase();
    };
    const byCase = new Map<string, GoogleOnlyEvent[]>();
    for (const ev of events) {
      if (linked.has(ev.eventId)) continue;
      const id = matchEventToCase(ev.title, L.cases, (c) => courtOf(c).suit || '', codeOf);
      if (!id) continue;
      const c = L.cases.find((x: Case) => x.id === id);
      if (!c || (c.calendarIgnored || []).includes(ev.eventId)) continue;
      byCase.set(id, [...(byCase.get(id) || []), ev]);
    }
    for (const c of L.cases as Case[]) {
      const next = (byCase.get(c.id) || []).sort((a, b) => a.date.localeCompare(b.date));
      if (JSON.stringify(next) !== JSON.stringify(c.calendarFromGoogle || [])) L.updateCase(c.id, { calendarFromGoogle: next });
    }
  };

  const claim = async (force: boolean): Promise<boolean> => {
    const me = live.current.me;
    try {
      return await runTransaction(firestoreDb, async (tx) => {
        const s = await tx.get(lockRef());
        const d = s.exists() ? s.data() : {};
        const at = Number(d.lockAt || 0);
        if (!force && d.lockBy && d.lockBy !== me && Date.now() - at < LOCK_MS) return false;
        tx.set(lockRef(), { lockBy: me, lockAt: Date.now(), updatedAt: serverTimestamp() }, { merge: true });
        return true;
      });
    } catch { return false; }
  };

  const run = async (force: boolean): Promise<CalendarSyncStatus> => {
    const status: CalendarSyncStatus = { at: new Date().toISOString(), by: live.current.me, pushed: 0, pulled: 0, removed: 0 };
    if (busy.current) return { ...status, error: 'A sync is already running.' };
    if (!isCourtDiaryConfigured() || !hasValidGoogleToken('calendar')) return { ...status, error: 'Google Calendar is not connected in this session.' };
    if (!(await claim(force))) return { ...status, error: 'Another computer is syncing right now.' };
    busy.current = true;
    try {
      const list = await listPortalEvents(sinceDay());
      const byKey = new Map(list.map((e) => [e.key, e]));
      const cur: CalItem[] = live.current.items;
      const keys = new Set(cur.map((i) => i.key));
      status.total = cur.length;
      for (const item of cur) {
        const ev = byKey.get(item.key);
        if (ev && ev.sentDate && ev.date && ev.date !== ev.sentDate && pullMove(item.key, ev.date, ev.time)) { status.pulled!++; continue; }
        if (!ev || ev.sig !== calSignature(item)) { await upsertFirmEvent(item, !!ev); status.pushed!++; }
      }
      for (const ev of list) {
        if (keys.has(ev.key) || !goneForSure(ev.key)) continue;
        await removeFirmEvent(ev.id);
        status.removed!++;
      }
      if (live.current.cases.length) offerToFiles(await listGoogleOnlyEvents(sinceDay()));
    } catch (e) {
      status.error = googleErrorMessage(e);
    } finally {
      busy.current = false;
      try { await runTransaction(firestoreDb, async (tx) => { tx.set(lockRef(), { last: status, lockAt: 0 }, { merge: true }); }); } catch { /* status is informational */ }
    }
    return status;
  };

  useEffect(() => {
    if (!enabled) { runner = null; return; }
    runner = run;
    const tick = () => { if (Date.now() - started.current > SETTLE_MS && isCourtDiaryConfigured() && hasValidGoogleToken('calendar')) void run(false); };
    const t = window.setInterval(tick, RUN_EVERY);
    const first = window.setTimeout(tick, SETTLE_MS + 5000);
    const onToken = () => window.setTimeout(tick, 2000);
    window.addEventListener(GOOGLE_TOKEN_EVENT, onToken);
    return () => { window.clearInterval(t); window.clearTimeout(first); window.removeEventListener(GOOGLE_TOKEN_EVENT, onToken); if (runner === run) runner = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // A date changed here: sync about 20 seconds later (after the first load has settled).
  const sigAll = useMemo(() => items.map(calSignature).join(','), [items]);
  useEffect(() => {
    if (!enabled || Date.now() - started.current < SETTLE_MS) return;
    const t = window.setTimeout(() => { if (isCourtDiaryConfigured() && hasValidGoogleToken('calendar')) void run(false); }, 20_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigAll, enabled]);
}
