/**
 * Self-check for the pure Google Workspace / WhatsApp helpers.
 * Run: npx tsx src/lib/integrations.check.ts   (exits 1 on any failure)
 */
import { normaliseWhatsAppNumber, whatsappLink, WHATSAPP_OPENED_STATUS } from './whatsapp';
import { base64UrlUtf8, buildGmailRaw, buildRfc2822Message, encodeMimeHeader, parseAddressList } from './emailMime';
import { courtEventTimes, parseCalendarId, parseTimeOfDay } from './calendarEvent';

let fails = 0, passes = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { passes++; return; }
  fails++; console.error(`FAIL ${label}:\n  got  ${g}\n  want ${w}`);
};
const throws = (label: string, fn: () => unknown) => {
  try { fn(); fails++; console.error(`FAIL ${label}: did not throw`); } catch { passes++; }
};
const fromB64Url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

/* ---------------- WhatsApp number normalisation */
const nums: [string, string | null][] = [
  ['0123456789', '60123456789'],
  ['012-345 6789', '60123456789'],
  ['012 3456 789', '60123456789'],
  ['+60 12-345 6789', '60123456789'],
  ['+60123456789', '60123456789'],
  ['60123456789', '60123456789'],
  ['0060123456789', '60123456789'],
  ['011-1234 5678', '601112345678'],
  ['123456789', '60123456789'],
  ['03-2161 1234', '60321611234'],
  ['(03) 2161-1234', '60321611234'],
  ['+65 9123 4567', '6591234567'],
  ['+44 20 7946 0958', '442079460958'],
  ['', null],
  ['   ', null],
  ['abc', null],
  ['012-345 678x', null],
  ['12345', null],
  ['0', null],
  ['+60 12', null],
  ['6012345', null],
  ['+1234567890123456', null], // 16 digits
  ['12+3456789', null],
];
for (const [inp, want] of nums) eq('normalise ' + JSON.stringify(inp), normaliseWhatsAppNumber(inp), want);
eq('normalise null', normaliseWhatsAppNumber(null), null);

/* ---------------- WhatsApp link encoding */
eq('link basic', whatsappLink('012-345 6789', 'Hello'), 'https://wa.me/60123456789?text=Hello');
eq('link encoding', whatsappLink('0123456789', 'Hearing on 3/10 & 4/10 @ 9:30am?\nRef: SHCO/L/2026#12'),
  'https://wa.me/60123456789?text=Hearing%20on%203%2F10%20%26%204%2F10%20%40%209%3A30am%3F%0ARef%3A%20SHCO%2FL%2F2026%2312');
eq('link unicode', whatsappLink('0123456789', 'Terima kasih – 谢谢 🙏'), 'https://wa.me/60123456789?text=' + encodeURIComponent('Terima kasih – 谢谢 🙏'));
eq('link empty message', whatsappLink('0123456789', ''), 'https://wa.me/60123456789');
eq('link invalid number', whatsappLink('not a phone', 'Hi'), null);
eq('opened status', WHATSAPP_OPENED_STATUS, 'Opened in WhatsApp');

/* ---------------- base64url */
eq('b64url ascii', base64UrlUtf8('hello'), 'aGVsbG8');
eq('b64url utf8', base64UrlUtf8('é'), 'w6k');
eq('b64url no + or /', /[+/=]/.test(base64UrlUtf8('ÿþý>>>???')), false);
eq('b64url round trip', fromB64Url(base64UrlUtf8('Mahkamah Tinggi – 高等法院 ✓')), 'Mahkamah Tinggi – 高等法院 ✓');

/* ---------------- header encoding */
eq('header ascii unchanged', encodeMimeHeader('Hearing reminder: KL High Court'), 'Hearing reminder: KL High Court');
eq('header CRLF stripped', encodeMimeHeader('Hi\r\nBcc: evil@x.com'), 'Hi Bcc: evil@x.com');
eq('header utf8', encodeMimeHeader('Tarikh – é'), '=?UTF-8?B?' + Buffer.from('Tarikh – é').toString('base64') + '?=');
{
  const long = 'Peringatan perbicaraan – Mahkamah Tinggi Kuala Lumpur – 高等法院 – sila hadir awal 🙏';
  const enc = encodeMimeHeader(long);
  const words = enc.split('\r\n ');
  eq('header long: words ≤ 75 chars', words.every((w) => w.length <= 75), true);
  eq('header long: >1 word', words.length > 1, true);
  const decoded = words.map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).join('');
  eq('header long: decodes back', decoded, long);
  eq('header long: no broken chars', decoded.includes('�'), false);
}

/* ---------------- address lists */
eq('addresses', parseAddressList('A@shcolaw.com, b@x.com; c@y.co  a@shcolaw.com'), ['a@shcolaw.com', 'b@x.com', 'c@y.co']);
eq('addresses array', parseAddressList(['a@x.com', 'b@y.com']), ['a@x.com', 'b@y.com']);
eq('addresses empty', parseAddressList(undefined), []);
throws('addresses invalid', () => parseAddressList('not-an-email'));
throws('addresses header injection', () => parseAddressList('a@x.com\r\nBcc: z@z.com'));

/* ---------------- RFC 2822 message */
{
  const msg = buildRfc2822Message({ to: 'client@example.com', cc: ['pic@shcolaw.com'], subject: 'Hearing – 3 Oct', text: 'Dear client,\nSee you at court.' });
  const [head, body] = msg.split('\r\n\r\n');
  eq('plain headers', head.split('\r\n'), [
    'To: client@example.com',
    'Cc: pic@shcolaw.com',
    'Subject: =?UTF-8?B?' + Buffer.from('Hearing – 3 Oct').toString('base64') + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ]);
  eq('plain body decodes', Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8'), 'Dear client,\nSee you at court.');
  eq('CRLF only', /[^\r]\n/.test(msg), false);
}
{
  const html = '<p>Dear client, <b>é</b></p>';
  const msg = buildRfc2822Message({ to: 'a@x.com', subject: 'Test', text: 'plain é', html, boundary: 'BOUND' });
  eq('multipart type', msg.includes('Content-Type: multipart/alternative; boundary="BOUND"'), true);
  const parts = msg.split('--BOUND');
  eq('multipart part count', parts.length, 4); // preamble, text, html, closing "--\r\n"
  eq('multipart closing', parts[3], '--\r\n');
  const decodePart = (p: string) => Buffer.from(p.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
  eq('multipart text', decodePart(parts[1]), 'plain é');
  eq('multipart html', decodePart(parts[2]), html);
  eq('multipart text first', parts[1].includes('text/plain') && parts[2].includes('text/html'), true);
}
{
  const long = 'x'.repeat(200);
  const msg = buildRfc2822Message({ to: 'a@x.com', subject: 's', text: long });
  eq('body lines ≤ 76', msg.split('\r\n').every((l) => l.length <= 76), true);
}
throws('no recipient', () => buildRfc2822Message({ to: '', subject: 's', text: 't' }));
eq('gmail raw round trip', fromB64Url(buildGmailRaw({ to: 'a@x.com', subject: 'S', text: 'T' })), buildRfc2822Message({ to: 'a@x.com', subject: 'S', text: 'T' }));

/* ---------------- calendar times */
eq('all-day', courtEventTimes('2026-10-03'), { start: { date: '2026-10-03' }, end: { date: '2026-10-04' }, allDay: true });
eq('all-day month end', courtEventTimes('2026-12-31', ''), { start: { date: '2026-12-31' }, end: { date: '2027-01-01' }, allDay: true });
eq('timed default 60', courtEventTimes('2026-10-03', '09:30'), {
  start: { dateTime: '2026-10-03T09:30:00', timeZone: 'Asia/Kuala_Lumpur' },
  end: { dateTime: '2026-10-03T10:30:00', timeZone: 'Asia/Kuala_Lumpur' }, allDay: false,
});
eq('timed over midnight', courtEventTimes('2026-02-28', '23:30', 90).end, { dateTime: '2026-03-01T01:00:00', timeZone: 'Asia/Kuala_Lumpur' });
eq('time 2:15pm', parseTimeOfDay('2:15 pm'), 14 * 60 + 15);
eq('time 12am', parseTimeOfDay('12am'), 0);
eq('time 9.30am', parseTimeOfDay('9.30am'), 9 * 60 + 30);
eq('time 0930', parseTimeOfDay('0930'), 9 * 60 + 30);
eq('time bare 9', parseTimeOfDay('9'), null);
eq('time 25:00', parseTimeOfDay('25:00'), null);
throws('bad date', () => courtEventTimes('2026-02-30'));
throws('bad time', () => courtEventTimes('2026-10-03', 'morning'));
throws('bad duration', () => courtEventTimes('2026-10-03', '09:00', 0));

/* ---------------- calendar IDs */
const calId = 'c_abc123def@group.calendar.google.com';
eq('calId bare', parseCalendarId(calId), calId);
eq('calId embed', parseCalendarId('https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId) + '&ctz=Asia%2FKuala_Lumpur'), calId);
eq('calId ical', parseCalendarId('https://calendar.google.com/calendar/ical/' + encodeURIComponent(calId) + '/private-xyz/basic.ics'), calId);
eq('calId cid', parseCalendarId('https://calendar.google.com/calendar/u/0?cid=' + Buffer.from(calId).toString('base64').replace(/=+$/, '')), calId);
eq('calId user', parseCalendarId('diary@shcolaw.com'), 'diary@shcolaw.com');
eq('calId junk', parseCalendarId('SHCO Court Diary'), '');

console.log(`integrations.check: ${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
