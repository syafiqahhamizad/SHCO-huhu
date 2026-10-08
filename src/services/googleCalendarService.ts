import { getPracticeSettings } from './templateService';
import { GoogleWorkspaceError, googleApiFetch, type GoogleFetchHints } from './googleWorkspaceAuth';
import { COURT_TIME_ZONE, courtEventTimes, parseCalendarId } from '../lib/calendarEvent';
import { parseAddressList } from '../lib/emailMime';

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
const getCourtDiaryCalendarId = () => parseCalendarId(getPracticeSettings().courtDiaryCalendarId || '');
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
