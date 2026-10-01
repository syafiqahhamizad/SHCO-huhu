/**
 * Pure helpers for Google Calendar court events (checked by src/lib/integrations.check.ts).
 */

export const COURT_TIME_ZONE = 'Asia/Kuala_Lumpur';

export type CalendarEventTime = { date: string } | { dateTime: string; timeZone: string };

const isRealDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
};

export const addDaysIso = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};

/** Accepts "9:30", "09:30", "09:30:00", "0930", "9.30am", "2:15 pm". Returns minutes after midnight, or null. */
export function parseTimeOfDay(input: string): number | null {
  const s = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?(?::\d{2})?(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (!m[2] && !m[3]) return null; // a bare "9" is ambiguous
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === 'pm' ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + min;
}

const hhmm = (mins: number) => String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0') + ':00';

/**
 * Start / end for a Calendar event in Asia/Kuala_Lumpur. No time → an all-day event on `date`
 * (Calendar's end date is exclusive, so end = next day). With a time → `durationMins` long
 * (default 60), rolling over midnight if needed.
 */
export function courtEventTimes(date: string, time?: string | null, durationMins?: number | null): { start: CalendarEventTime; end: CalendarEventTime; allDay: boolean } {
  const d = String(date || '').trim();
  if (!isRealDate(d)) throw new Error('The hearing date “' + date + '” is not a valid date (expected YYYY-MM-DD).');
  if (!time || !String(time).trim()) return { start: { date: d }, end: { date: addDaysIso(d, 1) }, allDay: true };
  const startMins = parseTimeOfDay(time);
  if (startMins === null) throw new Error('The hearing time “' + time + '” is not a valid time (e.g. 09:30).');
  const dur = durationMins == null ? 60 : Math.round(Number(durationMins));
  if (!Number.isFinite(dur) || dur <= 0 || dur > 14 * 24 * 60) throw new Error('The event length must be between 1 minute and 14 days.');
  const endTotal = startMins + dur;
  const endDate = addDaysIso(d, Math.floor(endTotal / 1440));
  return {
    start: { dateTime: d + 'T' + hhmm(startMins), timeZone: COURT_TIME_ZONE },
    end: { dateTime: endDate + 'T' + hhmm(endTotal % 1440), timeZone: COURT_TIME_ZONE },
    allDay: false,
  };
}

/**
 * Accepts a Calendar ID (`c_…@group.calendar.google.com`, `name@shcolaw.com`) or a link that
 * contains one (embed `?src=…`, public / iCal address, `?cid=`). Returns '' if none found.
 */
export function parseCalendarId(input: string): string {
  let s = String(input || '').trim();
  if (!s) return '';
  const fromUrl = /[?&](?:src|cid)=([^&#]+)/.exec(s) || /\/calendar\/ical\/([^/]+)\//.exec(s);
  if (fromUrl) {
    try { s = decodeURIComponent(fromUrl[1]); } catch { s = fromUrl[1]; }
    if (!s.includes('@')) {
      // cid= links carry the ID base64-encoded.
      try { const dec = atob(s.replace(/-/g, '+').replace(/_/g, '/')); if (dec.includes('@')) s = dec; } catch { /* not base64 */ }
    }
  }
  s = s.trim();
  return /^[^\s@/?#]+@[\w.-]+\.[a-z]{2,}$/i.test(s) ? s : '';
}
