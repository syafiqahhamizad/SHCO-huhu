import { describe, expect, it } from 'vitest';
import type { Case, User } from '../types';
import { CAL_COLOR, calSignature, calendarItems, eventIdFor, fileTag, keptNotes, matchEventToCase, NOTES_MARK, parseCalKey, timeLabel } from './calendarItems';

const users = [
  { id: 'u1', name: 'Syafiqah Hamizad', code: 'SH', email: 'sh@shcolaw.com', role: 'Partner', status: 'Active' },
  { id: 'u2', name: 'Zulaikha Afendi', code: 'ZA', email: 'za@shcolaw.com', role: 'Lawyer', status: 'Active' },
] as User[];
const kase = {
  id: 'CS-1', ref: 'SHC/SH/ZA/L/FATIN/040/10-26', title: 'Izzah v Fatin', status: 'Active', partners: ['SH'], lawyerInCharge: 'Zulaikha Afendi',
  hearings: [
    { id: 'H1', purpose: 'Case management', date: '2026-11-03', time: '09:00', status: 'Scheduled', outcome: '' },
    { id: 'H2', purpose: 'Mention', date: '2026-11-10', time: '', status: 'Adjourned', outcome: '' },
    { id: 'H3', purpose: 'e-Review', date: '2026-11-12', time: '', status: 'Scheduled', outcome: '' },
  ],
  tasks: [
    { id: 'T1', title: 'File defence', kind: 'Court order', dueDate: '2026-11-05', status: 'Not Started', assignedTo: 'Zulaikha Afendi' },
    { id: 'T2', title: 'Call client', kind: 'Task', dueDate: '2026-11-05', status: 'Not Started', assignedTo: 'Zulaikha Afendi' },
  ],
} as unknown as Case;

describe('firm calendar items', () => {
  const items = calendarItems({ cases: [kase], users, courtOf: () => ({ name: 'Shah Alam High Court', suit: 'BA-22NCvC-1-01/2026' }) });

  it('PIC codes first, then (file no. - client | what), like SHCO HQ', () => {
    expect(fileTag(kase)).toBe('040 - Fatin');
    expect(items.find((i) => i.key === 'hearing:CS-1:H1')?.title).toBe('SH/ZA (040 - Fatin | Case management @ 9.00am)');
    expect(items.find((i) => i.key === 'task:CS-1:T1')?.title).toBe('SH/ZA (040 - Fatin | File defence)');
  });
  it('court dates are all-day with the firm colours; e-Review and deadlines get theirs', () => {
    const h = items.find((i) => i.key === 'hearing:CS-1:H1')!;
    expect(h.time).toBeUndefined();
    expect(CAL_COLOR[h.type]).toBe('7');
    expect(CAL_COLOR[items.find((i) => i.key === 'hearing:CS-1:H3')!.type]).toBe('2');
    expect(CAL_COLOR[items.find((i) => i.key === 'task:CS-1:T1')!.type]).toBe('11');
  });
  it('adjourned dates and ordinary tasks stay out; the team is invited', () => {
    expect(items.some((i) => i.key === 'hearing:CS-1:H2')).toBe(false);
    expect(items.some((i) => i.key === 'task:CS-1:T2')).toBe(false);
    expect(items.find((i) => i.key === 'hearing:CS-1:H1')?.attendees.sort()).toEqual(['sh@shcolaw.com', 'za@shcolaw.com']);
  });
  it('leave, meetings and closures follow the firm’s own titles', () => {
    const more = calendarItems({
      users,
      leaveApplications: [{ id: 'L1', userId: 'u2', leaveType: 'Medical', startDate: '2026-11-02', endDate: '2026-11-03', days: 2, reason: '', status: 'Approved', submittedAt: '' }],
      meetings: [{ id: 'M1', title: 'Meeting with Client Shah', date: '2026-11-04', time: '14:30', type: 'Client', createdBy: 'Syafiqah Hamizad' }],
      announcements: [{ id: 'A1', title: 'Merdeka Day', body: '', category: 'Holiday', eventDate: '2026-08-31', createdAt: '', createdBy: '', published: true, internalOnly: false }],
    });
    expect(more.map((i) => i.title)).toEqual(['SH | Meeting with Client Shah', 'ZA | Medical Leave', 'FIRM CLOSED: MERDEKA DAY']);
    expect(more[0].time).toBe('14:30');
    expect(more[1].endDate).toBe('2026-11-03');
  });
  it('fixed event IDs Google accepts, stable signatures, keys that point back', () => {
    const id = eventIdFor('hearing:CS-1:H1');
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFor('hearing:CS-1:H1')).toBe(id);
    expect(calSignature(items[0])).toBe(calSignature({ ...items[0] }));
    expect(parseCalKey('task:CS-1:T1')).toEqual({ kind: 'task', caseId: 'CS-1', id: 'T1' });
    expect(timeLabel('14:05')).toBe('2.05pm');
  });
});

describe('events typed straight into Google', () => {
  const other = { ...kase, id: 'CS-2', ref: 'SHC/AH/L/KDAFC/033/08-26', partners: ['AH'], lawyerInCharge: '' } as unknown as Case;
  const code = (w: string) => ({ 'Syafiqah Hamizad': 'SH', 'Zulaikha Afendi': 'ZA' } as Record<string, string>)[w] || w.toUpperCase();
  const suit = (c: Case) => (c.id === 'CS-2' ? 'WA-36-38-05/2026' : '');
  it('match the firm’s own title styles to the right file', () => {
    expect(matchEventToCase('SH/ZA (040 - Fatin | Hearing (Phy))', [kase, other], suit, code)).toBe('CS-1');
    expect(matchEventToCase('ZA | File AIR | L/040 (Fatin)', [kase, other], suit, code)).toBe('CS-1');
    expect(matchEventToCase('[HEARING] KLHC: WA-36-38-05/2026 [L/033: SABITHA V. TAN SRI]', [kase, other], suit, code)).toBe('CS-2');
  });
  it('leave alone what does not clearly belong to one file', () => {
    expect(matchEventToCase('SH| BNI Weekly meeting', [kase, other], suit, code)).toBeNull();
    expect(matchEventToCase('AH (040 - Someone else | CM)', [kase, other], suit, code)).toBeNull();
  });
});

describe('notes typed in Google are kept', () => {
  it('a hand-typed event keeps all its text; a portal event keeps only what is under the notes line', () => {
    expect(keptNotes('Zoom: https://zoom.us/j/1\nCoram: Puan Suzana')).toBe('Zoom: https://zoom.us/j/1\nCoram: Puan Suzana');
    expect(keptNotes('File X\nAdded from the SHCO portal')).toBe('');
    expect(keptNotes('File X\nAdded from the SHCO portal\n\n' + NOTES_MARK + '\nBring originals')).toBe('Bring originals');
  });
});
