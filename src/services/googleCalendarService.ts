import { getPracticeSettings } from './templateService';
import { GoogleWorkspaceError, googleApiFetch, type GoogleFetchHints } from './googleWorkspaceAuth';
import { COURT_TIME_ZONE, courtEventTimes, parseCalendarId } from '../lib/calendarEvent';
import { parseAddressList } from '../lib/emailMime';
import { CAL_COLOR, calSignature, eventIdFor, type CalItem } from '../lib/calendarItems';

/**
 * Google Calendar: court dates / hearings in the firm's shared "SHCO Court Diary" calendar.
 *
 * - Scope `calendar.events` only (requested the first time it is needed; see googleWorkspaceAuth).
 * - The calendar is the one saved in Firm Settings (`courtDiaryCalendarId`) unless a call passes
 *   its own `calendarId`. Staff need "Make changes to events" on that calendar.
 * - Times are Asia/Kuala_Lumpur. No `time` → an all-day event.
 * - Attendees (e.g. the PIC's e-mail) get a Google Calendar invitation (`sendUpdates=all`).
 * - Every function throws a `GoogleWorkspaceError` / `Error` on failure; nothing reports success
 *   unless Google confirmed it.
 */

const API = 'https://www.googleapis.com/calendar/v3';

interface CourtEventInput {
  /** Defaults to the court diary calendar from Firm Settings. */
  calendarId?: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** "09:30" (24h) or "9.30am"; leave out for an all-day event. */
  time?: string;
  /** Default 60 when a time is given. */
  durationMins?: number;
  location?: string;
  description?: string;
  /** E-mail addresses to invite (e.g. the PIC). They receive Google's invitation e-mail. */
  attendees?: string[];
}

interface CourtEventResult { eventId: string; htmlLink: string; calendarId: string }

/** The court diary Calendar ID from Firm Settings ('' if not set). */
/** The firm calendar "SHCO HQ" (the one the Calendar page shows) — used when Settings has none. */
export const FIRM_CALENDAR_ID = 'c_b32b26462773cfca7a5a2ac79d0c94db962a8f67d4731072016fdb853b7f9668@group.calendar.google.com';
const getCourtDiaryCalendarId = () => parseCalendarId(getPracticeSettings().courtDiaryCalendarId || '') || FIRM_CALENDAR_ID;
export const isCourtDiaryConfigured = () => !!getCourtDiaryCalendarId();

const resolveCalendarId = (given?: string) => {
  const id = given ? parseCalendarId(given) : getCourtDiaryCalendarId();
  if (given && !id) throw new GoogleWorkspaceError('“' + given + '” is not a Google Calendar ID.', 'bad_request', 'calendar');
  if (!id) throw new GoogleWorkspaceError('The court diary calendar is not set up. Ask an admin to add its Calendar ID in Firm & Practice Settings → Google, e-mail & backup → Google Calendar, Tasks & Gmail.', 'not_configured', 'calendar');
  return id;
};

const hints: GoogleFetchHints = {
  forbidden: 'Your Google account cannot add or change events in the court diary calendar. Ask an admin to share “SHCO Court Diary” with you (Make changes to events).',
  notFound: 'The court diary calendar was not found, or it is not shared with your Google account. Ask an admin to check the Calendar ID in Firm Settings and share the calendar with you (Make changes to events).',
};

const eventBody = (input: CourtEventInput) => {
  const title = String(input.title || '').trim();
  if (!title) throw new GoogleWorkspaceError('The court event needs a title.', 'bad_request', 'calendar');
  let t;
  try { t = courtEventTimes(input.date, input.time, input.durationMins); } catch (e) { throw new GoogleWorkspaceError(e instanceof Error ? e.message : String(e), 'bad_request', 'calendar'); }
  let attendees: string[] = [];
  try { attendees = parseAddressList(input.attendees || []); } catch (e) { throw new GoogleWorkspaceError(e instanceof Error ? e.message : String(e), 'bad_request', 'calendar'); }
  return {
    body: {
      summary: title.slice(0, 1024),
      location: input.location ? String(input.location).slice(0, 1024) : '',
      description: input.description ? String(input.description).slice(0, 8000) : '',
      start: t.start,
      end: t.end,
      attendees: attendees.map((email) => ({ email })),
      // Keep the default reminders of each attendee's calendar.
      reminders: { useDefault: true },
      extendedProperties: { private: { shcoPortal: '1', timeZone: COURT_TIME_ZONE } },
    },
    notify: attendees.length > 0,
  };
};

const eventUrl = (calendarId: string, eventId = '') =>
  API + '/calendars/' + encodeURIComponent(calendarId) + '/events' + (eventId ? '/' + encodeURIComponent(eventId) : '');

interface CalendarEvent { id: string; htmlLink?: string; organizer?: { email?: string; displayName?: string } }

/** Creates the event in the court diary. Returns Google's event ID and its link. */
export async function createCourtEvent(input: CourtEventInput): Promise<CourtEventResult> {
  const calendarId = resolveCalendarId(input.calendarId);
  const { body, notify } = eventBody(input);
  const res = await googleApiFetch('calendar', eventUrl(calendarId) + '?sendUpdates=' + (notify ? 'all' : 'none'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, hints);
  const ev = await res.json() as CalendarEvent;
  if (!ev.id) throw new GoogleWorkspaceError('Google Calendar did not return the new event. Check the court diary before trying again.', 'unknown', 'calendar');
  return { eventId: ev.id, htmlLink: ev.htmlLink || '', calendarId };
}

/**
 * Deletes the event (attendees are told it was cancelled unless `notifyAttendees` is false).
 * An event that is already gone (404 / 410) counts as deleted.
 */
async function deleteCourtEvent(eventId: string, opts: { calendarId?: string; notifyAttendees?: boolean } = {}): Promise<void> {
  if (!eventId) throw new GoogleWorkspaceError('No Google Calendar event ID to delete.', 'bad_request', 'calendar');
  const calendarId = resolveCalendarId(opts.calendarId);
  try {
    await googleApiFetch('calendar', eventUrl(calendarId, eventId) + '?sendUpdates=' + (opts.notifyAttendees === false ? 'none' : 'all'), { method: 'DELETE' }, hints);
  } catch (e) {
    if (e instanceof GoogleWorkspaceError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}

/* ------------------------------------------------------------------ automatic sync (every date) */

/** One portal event as read back from the firm calendar. */
export interface PortalEvent {
  id: string;
  key: string;
  /** Fingerprint of what the portal last sent (calSignature). */
  sig: string;
  /** The date the portal last sent; if the event's start differs, someone moved it in Google. */
  sentDate: string;
  /** Where the event is now (YYYY-MM-DD) and its time ("09:30") if timed. */
  date: string;
  time: string;
}

/** Event body for one portal date (all-day, multi-day all-day, or timed). */
const firmEventBody = (item: CalItem) => {
  let t;
  try { t = courtEventTimes(item.date, item.time, item.durationMins); } catch (e) { throw new GoogleWorkspaceError(e instanceof Error ? e.message : String(e), 'bad_request', 'calendar'); }
  if (t.allDay && item.endDate) {
    const [y, m, d] = item.endDate.split('-').map(Number);
    t = { ...t, end: { date: new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) } };
  }
  let attendees: string[] = [];
  try { attendees = parseAddressList(item.attendees || []); } catch { attendees = []; }
  const color = CAL_COLOR[item.type];
  return {
    summary: item.title.slice(0, 1024),
    location: (item.location || '').slice(0, 1024),
    description: (item.description || '').slice(0, 8000),
    ...(color ? { colorId: color } : {}),
    status: 'confirmed',
    transparency: item.free ? 'transparent' : 'opaque',
    start: t.start,
    end: t.end,
    attendees: attendees.map((email) => ({ email })),
    reminders: { useDefault: true },
    extendedProperties: { private: { shcoPortal: '1', shcoKey: item.key.slice(0, 900), shcoSig: calSignature(item), shcoDate: item.date, timeZone: COURT_TIME_ZONE } },
  };
};

const writeEvent = async (cal: string, id: string, body: object, notify: string, method: 'PUT' | 'POST') => {
  const url = method === 'PUT' ? eventUrl(cal, id) : eventUrl(cal);
  await googleApiFetch('calendar', url + '?sendUpdates=' + notify, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id }) }, hints);
};

/**
 * Puts one portal date in the firm calendar under its fixed event ID. `exists` says whether the
 * event is already there (from listPortalEvents); unknown = try to add, and update if Google
 * says it already exists. Attendees get Google's invitation / update e-mail.
 */
export async function upsertFirmEvent(item: CalItem, exists?: boolean, calendarId?: string): Promise<string> {
  const cal = resolveCalendarId(calendarId);
  const id = item.existingEventId || eventIdFor(item.key);
  const body = firmEventBody(item);
  const notify = body.attendees.length ? 'all' : 'none';
  if (exists || item.existingEventId) {
    try { await writeEvent(cal, id, body, notify, 'PUT'); return id; } catch (e) {
      if (!(e instanceof GoogleWorkspaceError && (e.status === 404 || e.status === 410))) throw e;
    }
  }
  try { await writeEvent(cal, id, body, notify, 'POST'); } catch (e) {
    if (e instanceof GoogleWorkspaceError && e.status === 409) await writeEvent(cal, id, body, notify, 'PUT');
    else throw e;
  }
  return id;
}

/** Removes a portal date's event (attendees are told it was cancelled). Already gone = fine. */
export const removeFirmEvent = (eventId: string, calendarId?: string) => deleteCourtEvent(eventId, { calendarId });

/** Every event the portal put in the firm calendar ending on or after `sinceIso`. */
export async function listPortalEvents(sinceIso: string, calendarId?: string): Promise<PortalEvent[]> {
  const cal = resolveCalendarId(calendarId);
  const out: PortalEvent[] = [];
  let page = '';
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ privateExtendedProperty: 'shcoPortal=1', timeMin: sinceIso + 'T00:00:00+08:00', maxResults: '2500', singleEvents: 'true' });
    if (page) q.set('pageToken', page);
    const r = await (await googleApiFetch('calendar', eventUrl(cal) + '?' + q.toString(), { method: 'GET' }, hints)).json() as {
      items?: { id: string; status?: string; start?: { date?: string; dateTime?: string }; extendedProperties?: { private?: Record<string, string> } }[]; nextPageToken?: string;
    };
    (r.items || []).forEach((ev) => {
      const p = ev.extendedProperties?.private || {};
      if (!p.shcoKey || ev.status === 'cancelled') return;
      const dt = ev.start?.dateTime || '';
      out.push({ id: ev.id, key: p.shcoKey, sig: p.shcoSig || '', sentDate: p.shcoDate || '', date: ev.start?.date || dt.slice(0, 10), time: dt ? dt.slice(11, 16) : '' });
    });
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return out;
}

/** Events typed straight into the firm calendar (not made by the portal), from `sinceIso` for a year. */
export async function listGoogleOnlyEvents(sinceIso: string, calendarId?: string): Promise<{ eventId: string; title: string; date: string; time?: string }[]> {
  const cal = resolveCalendarId(calendarId);
  const until = new Date(Date.parse(sinceIso + 'T00:00:00Z') + 400 * 86400000).toISOString().slice(0, 10);
  const out: { eventId: string; title: string; date: string; time?: string }[] = [];
  let page = '';
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ timeMin: sinceIso + 'T00:00:00+08:00', timeMax: until + 'T00:00:00+08:00', maxResults: '2500', singleEvents: 'true' });
    if (page) q.set('pageToken', page);
    const r = await (await googleApiFetch('calendar', eventUrl(cal) + '?' + q.toString(), { method: 'GET' }, hints)).json() as {
      items?: { id: string; status?: string; summary?: string; start?: { date?: string; dateTime?: string }; extendedProperties?: { private?: Record<string, string> } }[]; nextPageToken?: string;
    };
    (r.items || []).forEach((ev) => {
      if (ev.status === 'cancelled' || ev.extendedProperties?.private?.shcoKey) return;
      const dt = ev.start?.dateTime || '';
      out.push({ eventId: ev.id, title: String(ev.summary || '').trim(), date: ev.start?.date || dt.slice(0, 10), ...(dt ? { time: dt.slice(11, 16) } : {}) });
    });
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return out;
}

interface GoogleTestResult { ok: boolean; message: string }

/** Settings "Test": creates a short test event in the court diary, then deletes it. */
export async function testCourtDiary(calendarId?: string): Promise<GoogleTestResult & { calendarName?: string }> {
  try {
    const id = resolveCalendarId(calendarId);
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // Malaysia date
    const res = await googleApiFetch('calendar', eventUrl(id) + '?sendUpdates=none', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...eventBody({ title: 'SHCO portal connection test (deleting)', date: today }).body, transparency: 'transparent' }),
    }, hints);
    const ev = await res.json() as CalendarEvent;
    if (!ev.id) return { ok: false, message: 'Google Calendar did not return the test event.' };
    try {
      await deleteCourtEvent(ev.id, { calendarId: id, notifyAttendees: false });
    } catch (e) {
      return { ok: false, message: 'A test event was created but could not be deleted (' + (e instanceof Error ? e.message : String(e)) + '). Delete “SHCO portal connection test” from the calendar by hand.' };
    }
    const name = ev.organizer?.displayName || '';
    return { ok: true, calendarName: name || undefined, message: 'Connected to ' + (name ? '“' + name + '”' : 'the court diary') + '. A test event was created and deleted.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
