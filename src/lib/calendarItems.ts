/**
 * Every date keyed into the portal, as events in the firm calendar (Google Calendar "SHCO HQ").
 *
 * Pure: builds the list from the app's records; src/hooks/useCalendarAutoSync.ts pushes it and
 * brings date moves made in Google back. Each item has a fixed event ID made from its own key,
 * so saving the same date from any session updates the one event instead of adding another.
 *
 * Follows the firm's own calendar habits (read from SHCO HQ, Oct 2026):
 *   - PIC codes first:  "SH/ZA (040 - Fatin | Hearing @ 9.00am)", "SH | Leave", "FIRM CLOSED: …"
 *   - court dates and deadlines are all-day bars; the time goes in the title and description;
 *   - colours: court dates 7, e-Review 2, deadlines 11, office closure 8; meetings and leave
 *     keep the calendar's own colour (as the firm enters them today).
 */
import type { Case, Deadline, FirmAnnouncement, Hearing, LeaveApplication, Meeting, Task, User } from '../types';

export type CalType = 'Court' | 'e-Review' | 'Deadline' | 'Meeting' | 'Leave' | 'Office closed';

/** Google Calendar colorId per type ('' = the calendar's own colour), as used in SHCO HQ. */
export const CAL_COLOR: Record<CalType, string> = { Court: '7', 'e-Review': '2', Deadline: '11', Meeting: '', Leave: '', 'Office closed': '8' };

export interface CalItem {
  /** Stable key of the record this event belongs to, e.g. "hearing:CS-1:H-3". */
  key: string;
  type: CalType;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** Last day for multi-day all-day events (leave); omitted = one day. */
  endDate?: string;
  /** "09:30" for a timed event (meetings); omitted = all day. */
  time?: string;
  durationMins?: number;
  location?: string;
  description: string;
  attendees: string[];
  /** Shown as free time (deadlines, leave, closures), like the firm's own events. */
  free?: boolean;
  /** An event made before automatic sync (old "Add to Google Calendar" tick box) — reused, never duplicated. */
  existingEventId?: string;
}

export const calTypeOfPurpose = (purpose: string): CalType => (/e-?review/i.test(String(purpose || '')) ? 'e-Review' : 'Court');

const DEADLINE_KINDS = ['Court order', 'Rules of Court', 'Limitation', 'Key date'];
const DONE_TASK = ['Completed', 'Done'];
const isDate = (d?: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/** FNV-1a with a seed, as 8 hex digits. */
const fnv = (s: string, seed: number) => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Google event IDs may use a–v and 0–9 (base32hex); hex digits fit. */
export const eventIdFor = (key: string) => 'shco' + fnv(key, 0x811c9dc5) + fnv(key, 0x01000193) + fnv(key, 0x9e3779b9);

/** "9.00am" / "2.30pm" from "09:00" / "14:30". */
export const timeLabel = (t?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = +m[1];
  return (h % 12 || 12) + '.' + m[2] + (h < 12 ? 'am' : 'pm');
};

/** "(040 - Fatin" part of the title: the file's running number and the client part of its ref. */
export const fileTag = (c: Pick<Case, 'ref' | 'title'>) => {
  const parts = String(c.ref || '').split('/').map((p) => p.trim());
  const num = parts.find((p) => /^\d{3,4}$/.test(p)) || '';
  const numAt = parts.indexOf(num);
  const raw = numAt > 0 ? parts[numAt - 1] : '';
  // Client initials typed for the file no.: short ones stay as they are (FB, SM), names read normally (FATIN → Fatin).
  const client = raw ? (raw.length > 4 ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw) : String(c.title || '').split(/\s+v\.?\s+/i)[0].slice(0, 30);
  return (num ? num + ' - ' : '') + client;
};

export interface CalSources {
  cases?: Case[];
  deadlines?: Deadline[];
  meetings?: Meeting[];
  leaveApplications?: LeaveApplication[];
  announcements?: FirmAnnouncement[];
  users?: User[];
  /** Court name / suit no. for a file (description of court events). */
  courtOf?: (c: Case) => { name?: string; suit?: string };
  /** Leave out events that ended before this date (YYYY-MM-DD). */
  since?: string;
}

/** Every date in the portal that belongs in the firm calendar. */
export function calendarItems(src: CalSources): CalItem[] {
  const users = (src.users || []).filter((u) => u.status !== 'Inactive' && u.role !== 'Client');
  const norm = (x: string) => String(x || '').trim().toLowerCase();
  const userOf = (who: string) => {
    const n = norm(who);
    return n ? users.find((x) => [x.id, x.name, x.code, x.email].some((v) => v && norm(String(v)) === n)) : undefined;
  };
  const codeOf = (who: string) => {
    const u = userOf(who);
    if (u?.code) return u.code.toUpperCase();
    const w = String(who || '').trim();
    return /^[A-Za-z]{2,4}$/.test(w) ? w.toUpperCase() : w ? w.split(/\s+/).filter((x) => !/^(bin|binti|bt|bte|a\/l|a\/p)$/i.test(x)).slice(0, 2).map((x) => x[0]).join('').toUpperCase() : '';
  };
  const emailOf = (who: string) => (norm(who).includes('@') ? norm(who) : (userOf(who)?.email || '').toLowerCase());
  const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));
  const lawyersOf = (c: Case) => [...String(c.lawyerInCharge || '').split(','), ...(c.lawyers || [])].map((x) => x.trim()).filter(Boolean);
  const picOf = (c: Case, extra: string[] = []) => uniq([...(c.partners || []).map(codeOf), ...lawyersOf(c).map(codeOf), ...extra.map(codeOf)]).join('/') || 'SHCO';
  const teamEmails = (c: Case, extra: string[] = []) => uniq([...(c.partners || []), ...lawyersOf(c), ...extra].map(emailOf));
  const since = src.since || '';
  const keep = (date: string, end?: string) => isDate(date) && (!since || (end || date) >= since);
  const out: CalItem[] = [];
  const caseById = new Map((src.cases || []).map((c) => [c.id, c]));
  const portalLine = 'Added from the SHCO portal';

  for (const c of src.cases || []) {
    if (c.status === 'Archive') continue;
    const court = src.courtOf ? src.courtOf(c) : {};
    const tag = fileTag(c);
    (c.hearings || []).forEach((h: Hearing) => {
      // Adjourned / cancelled / postponed dates leave the calendar; held ones stay as a record.
      if (!['Scheduled', 'Completed'].includes(h.status) || !keep(h.date)) return;
      const at = timeLabel(h.time);
      out.push({
        key: 'hearing:' + c.id + ':' + h.id,
        type: calTypeOfPurpose(h.purpose),
        title: picOf(c) + ' (' + tag + ' | ' + h.purpose + (at ? ' @ ' + at : '') + ')',
        date: h.date,
        location: court.name || undefined,
        description: [c.title, 'File ' + c.ref, court.suit ? 'Suit ' + court.suit : '', court.name ? 'Court: ' + court.name : '', at ? 'Time: ' + at : '', h.source ? 'From ' + h.source : '', portalLine].filter(Boolean).join('\n'),
        attendees: teamEmails(c),
        existingEventId: h.googleEventId || undefined,
      });
    });
    (c.tasks || []).forEach((t: Task) => {
      if (!DEADLINE_KINDS.includes(String(t.kind || '')) || !keep(t.dueDate)) return;
      out.push({
        key: 'task:' + c.id + ':' + t.id,
        type: 'Deadline',
        title: (DONE_TASK.includes(t.status) ? '✓ ' : '') + picOf(c, [t.assignedTo]) + ' (' + tag + ' | ' + t.title + ')',
        date: t.dueDate,
        description: [c.title, 'File ' + c.ref, court.suit ? 'Suit ' + court.suit : '', t.kind ? 'Kind: ' + t.kind : '', t.assignedTo ? 'For: ' + t.assignedTo : '', t.description || '', portalLine].filter(Boolean).join('\n'),
        attendees: teamEmails(c, [t.assignedTo]),
        free: true,
      });
    });
  }

  for (const d of src.deadlines || []) {
    if (!keep(d.dueDate)) continue;
    const c = caseById.get(d.caseId);
    out.push({
      key: 'deadline:' + d.id,
      type: 'Deadline',
      title: (d.status === 'Completed' ? '✓ ' : '') + (c ? picOf(c, [d.partner, d.lawyer]) + ' (' + fileTag(c) + ' | ' + d.title + ')' : uniq([d.partner, d.lawyer].map(codeOf)).join('/') + ' | ' + d.title),
      date: d.dueDate,
      description: [c ? c.title : '', c ? 'File ' + c.ref : '', 'Type: ' + d.type, d.notes || '', portalLine].filter(Boolean).join('\n'),
      attendees: uniq([d.partner, d.lawyer].map(emailOf)),
      free: true,
    });
  }

  for (const m of src.meetings || []) {
    if (!keep(m.date)) continue;
    const c = m.caseId ? caseById.get(m.caseId) : undefined;
    const who = uniq([m.createdBy || '', ...(m.attendees || [])].map(codeOf)).join('/') || 'SHCO';
    out.push({
      key: 'meeting:' + m.id,
      type: 'Meeting',
      title: who + ' | ' + m.title + (c ? ' | ' + fileTag(c) : ''),
      date: m.date,
      time: m.time || undefined,
      durationMins: m.durationMinutes || undefined,
      location: m.location || undefined,
      description: [c ? 'File ' + c.ref : '', m.type ? m.type + ' meeting' : '', m.note || '', portalLine].filter(Boolean).join('\n'),
      attendees: uniq([m.createdBy || '', ...(m.attendees || [])].map(emailOf)),
    });
  }

  for (const l of src.leaveApplications || []) {
    if (l.status !== 'Approved' || !keep(l.startDate, l.endDate)) continue;
    const u = users.find((x) => x.id === l.userId);
    const kind = l.leaveType === 'Annual' ? 'Leave' : l.leaveType + ' Leave';
    out.push({
      key: 'leave:' + l.id,
      type: 'Leave',
      title: (u ? codeOf(u.name) : 'Staff') + ' | ' + kind + (l.halfDay ? ' (' + l.halfDay + ')' : ''),
      date: l.startDate,
      endDate: isDate(l.endDate) && l.endDate > l.startDate ? l.endDate : undefined,
      description: [u?.name || '', l.pic ? 'Covering: ' + l.pic : '', portalLine].filter(Boolean).join('\n'),
      attendees: [],
      free: true,
    });
  }

  for (const a of src.announcements || []) {
    if (a.category !== 'Holiday' || !a.published || !keep(a.eventDate || '')) continue;
    out.push({ key: 'closure:' + a.id, type: 'Office closed', title: 'FIRM CLOSED: ' + a.title.toUpperCase(), date: a.eventDate as string, description: [a.body, portalLine].filter(Boolean).join('\n'), attendees: [], free: true });
  }
  return out;
}

/** What makes an event different (stored on the event so unchanged items are never re-sent). */
export const calSignature = (i: CalItem) => {
  const s = JSON.stringify([i.type, i.title, i.date, i.endDate || '', i.time || '', i.durationMins || 0, i.location || '', i.description, [...i.attendees].sort(), !!i.free]);
  return fnv(s, 0x811c9dc5) + fnv(s, 0x01000193);
};

/** Which portal record a key points to, for bringing back a date moved in Google. */
export const parseCalKey = (key: string): { kind: 'hearing' | 'task' | 'deadline' | 'meeting' | 'leave' | 'closure'; caseId?: string; id: string } | null => {
  const p = String(key || '').split(':');
  if ((p[0] === 'hearing' || p[0] === 'task') && p.length === 3) return { kind: p[0], caseId: p[1], id: p[2] };
  if (['deadline', 'meeting', 'leave', 'closure'].includes(p[0]) && p.length === 2) return { kind: p[0] as 'deadline', id: p[1] };
  return null;
};

/** An event in the firm calendar that the portal did not make. */
export interface GoogleOnlyEvent { eventId: string; title: string; date: string; time?: string }

/**
 * Which file a calendar event typed straight into Google belongs to, or null. Matches the file's
 * running number in the firm's title styles — "SH/ZA (040 - Fatin | …)", "L/040 (Fatin)",
 * "(0040/25 - …" — together with one of the file's PIC codes, or the file's suit no.
 */
export function matchEventToCase(title: string, cases: Pick<Case, 'id' | 'ref' | 'partners' | 'lawyerInCharge' | 'lawyers' | 'status'>[], suitOf: (c: Case) => string, codeOf: (who: string) => string): string | null {
  const t = String(title || '');
  const up = t.toUpperCase();
  const nums = new Set<number>();
  for (const m of t.matchAll(/\(\s*0*(\d{1,4})(?:\/\d{2})?\s*-/g)) nums.add(+m[1]);
  for (const m of t.matchAll(/\b[A-Z]{1,4}\/0*(\d{1,4})\b/g)) nums.add(+m[1]);
  const lead = (t.split(/[\s(|\[]/)[0] || '').toUpperCase().split('/').filter(Boolean);
  const hits: string[] = [];
  for (const c of cases) {
    if (c.status === 'Archive') continue;
    const suit = String(suitOf(c as Case) || '').trim().toUpperCase();
    if (suit.length >= 6 && up.includes(suit)) { hits.push(c.id); continue; }
    const num = +(String(c.ref || '').split('/').find((p) => /^\d{3,4}$/.test(p.trim())) || NaN);
    if (!Number.isFinite(num) || !nums.has(num)) continue;
    const team = [...(c.partners || []), ...String(c.lawyerInCharge || '').split(','), ...(c.lawyers || [])].map((x) => codeOf(String(x).trim())).filter(Boolean);
    if (!lead.length || lead.some((x) => team.includes(x))) hits.push(c.id);
  }
  return hits.length === 1 ? hits[0] : null; // two possible files = leave it alone
}
