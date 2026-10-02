/**
 * Pure Google Workspace / WhatsApp helpers. Formerly src/lib/integrations.check.ts.
 */
import { describe, expect, it } from 'vitest';
import { normaliseWhatsAppNumber, whatsappLink, WHATSAPP_OPENED_STATUS } from './whatsapp';
import { base64UrlUtf8, buildGmailRaw, buildRfc2822Message, encodeMimeHeader, parseAddressList } from './emailMime';
import { courtEventTimes, parseCalendarId, parseTimeOfDay } from './calendarEvent';

/** Same comparison the old check script used: JSON-serialised equality (key order included). */
const eq = (got: unknown, want: unknown) => expect(JSON.stringify(got)).toBe(JSON.stringify(want));
const fromB64Url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

describe('WhatsApp number normalisation', () => {
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
  it.each(nums)('normalise %j', (inp, want) => eq(normaliseWhatsAppNumber(inp), want));
  it('normalise null', () => eq(normaliseWhatsAppNumber(null), null));
});

describe('WhatsApp link encoding', () => {
  it('link basic', () => eq(whatsappLink('012-345 6789', 'Hello'), 'https://wa.me/60123456789?text=Hello'));
  it('link encoding', () => eq(whatsappLink('0123456789', 'Hearing on 3/10 & 4/10 @ 9:30am?\nRef: SHCO/L/2026#12'),
    'https://wa.me/60123456789?text=Hearing%20on%203%2F10%20%26%204%2F10%20%40%209%3A30am%3F%0ARef%3A%20SHCO%2FL%2F2026%2312'));
  it('link unicode', () => eq(whatsappLink('0123456789', 'Terima kasih – 谢谢 🙏'), 'https://wa.me/60123456789?text=' + encodeURIComponent('Terima kasih – 谢谢 🙏')));
  it('link empty message', () => eq(whatsappLink('0123456789', ''), 'https://wa.me/60123456789'));
  it('link invalid number', () => eq(whatsappLink('not a phone', 'Hi'), null));
  it('opened status', () => eq(WHATSAPP_OPENED_STATUS, 'Opened in WhatsApp'));
});

describe('base64url', () => {
  it('b64url ascii', () => eq(base64UrlUtf8('hello'), 'aGVsbG8'));
  it('b64url utf8', () => eq(base64UrlUtf8('é'), 'w6k'));
  it('b64url no + or /', () => eq(/[+/=]/.test(base64UrlUtf8('ÿþý>>>???')), false));
  it('b64url round trip', () => eq(fromB64Url(base64UrlUtf8('Mahkamah Tinggi – 高等法院 ✓')), 'Mahkamah Tinggi – 高等法院 ✓'));
});

describe('header encoding', () => {
  it('header ascii unchanged', () => eq(encodeMimeHeader('Hearing reminder: KL High Court'), 'Hearing reminder: KL High Court'));
  it('header CRLF stripped', () => eq(encodeMimeHeader('Hi\r\nBcc: evil@x.com'), 'Hi Bcc: evil@x.com'));
  it('header utf8', () => eq(encodeMimeHeader('Tarikh – é'), '=?UTF-8?B?' + Buffer.from('Tarikh – é').toString('base64') + '?='));

  const long = 'Peringatan perbicaraan – Mahkamah Tinggi Kuala Lumpur – 高等法院 – sila hadir awal 🙏';
  const words = encodeMimeHeader(long).split('\r\n ');
  const decoded = words.map((w) => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).join('');
  it('header long: words ≤ 75 chars', () => eq(words.every((w) => w.length <= 75), true));
  it('header long: >1 word', () => eq(words.length > 1, true));
  it('header long: decodes back', () => eq(decoded, long));
  it('header long: no broken chars', () => eq(decoded.includes('�'), false));
});

describe('address lists', () => {
  it('addresses', () => eq(parseAddressList('A@shcolaw.com, b@x.com; c@y.co  a@shcolaw.com'), ['a@shcolaw.com', 'b@x.com', 'c@y.co']));
  it('addresses array', () => eq(parseAddressList(['a@x.com', 'b@y.com']), ['a@x.com', 'b@y.com']));
  it('addresses empty', () => eq(parseAddressList(undefined), []));
  it('addresses invalid', () => expect(() => parseAddressList('not-an-email')).toThrow());
  it('addresses header injection', () => expect(() => parseAddressList('a@x.com\r\nBcc: z@z.com')).toThrow());
});

describe('RFC 2822 message', () => {
  describe('plain text', () => {
    const msg = buildRfc2822Message({ to: 'client@example.com', cc: ['pic@shcolaw.com'], subject: 'Hearing – 3 Oct', text: 'Dear client,\nSee you at court.' });
    const [head, body] = msg.split('\r\n\r\n');
    it('plain headers', () => eq(head.split('\r\n'), [
      'To: client@example.com',
      'Cc: pic@shcolaw.com',
      'Subject: =?UTF-8?B?' + Buffer.from('Hearing – 3 Oct').toString('base64') + '?=',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
    ]));
    it('plain body decodes', () => eq(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8'), 'Dear client,\nSee you at court.'));
    it('CRLF only', () => eq(/[^\r]\n/.test(msg), false));
  });

  describe('multipart', () => {
    const html = '<p>Dear client, <b>é</b></p>';
    const msg = buildRfc2822Message({ to: 'a@x.com', subject: 'Test', text: 'plain é', html, boundary: 'BOUND' });
    const parts = msg.split('--BOUND');
    const decodePart = (p: string) => Buffer.from(p.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
    it('multipart type', () => eq(msg.includes('Content-Type: multipart/alternative; boundary="BOUND"'), true));
    it('multipart part count', () => eq(parts.length, 4)); // preamble, text, html, closing "--\r\n"
    it('multipart closing', () => eq(parts[3], '--\r\n'));
    it('multipart text', () => eq(decodePart(parts[1]), 'plain é'));
    it('multipart html', () => eq(decodePart(parts[2]), html));
    it('multipart text first', () => eq(parts[1].includes('text/plain') && parts[2].includes('text/html'), true));
  });

  it('body lines ≤ 76', () => {
    const msg = buildRfc2822Message({ to: 'a@x.com', subject: 's', text: 'x'.repeat(200) });
    eq(msg.split('\r\n').every((l) => l.length <= 76), true);
  });
  it('no recipient', () => expect(() => buildRfc2822Message({ to: '', subject: 's', text: 't' })).toThrow());
  it('gmail raw round trip', () => eq(fromB64Url(buildGmailRaw({ to: 'a@x.com', subject: 'S', text: 'T' })), buildRfc2822Message({ to: 'a@x.com', subject: 'S', text: 'T' })));
});

describe('calendar times', () => {
  it('all-day', () => eq(courtEventTimes('2026-10-03'), { start: { date: '2026-10-03' }, end: { date: '2026-10-04' }, allDay: true }));
  it('all-day month end', () => eq(courtEventTimes('2026-12-31', ''), { start: { date: '2026-12-31' }, end: { date: '2027-01-01' }, allDay: true }));
  it('timed default 60', () => eq(courtEventTimes('2026-10-03', '09:30'), {
    start: { dateTime: '2026-10-03T09:30:00', timeZone: 'Asia/Kuala_Lumpur' },
    end: { dateTime: '2026-10-03T10:30:00', timeZone: 'Asia/Kuala_Lumpur' }, allDay: false,
  }));
  it('timed over midnight', () => eq(courtEventTimes('2026-02-28', '23:30', 90).end, { dateTime: '2026-03-01T01:00:00', timeZone: 'Asia/Kuala_Lumpur' }));
  it('time 2:15pm', () => eq(parseTimeOfDay('2:15 pm'), 14 * 60 + 15));
  it('time 12am', () => eq(parseTimeOfDay('12am'), 0));
  it('time 9.30am', () => eq(parseTimeOfDay('9.30am'), 9 * 60 + 30));
  it('time 0930', () => eq(parseTimeOfDay('0930'), 9 * 60 + 30));
  it('time bare 9', () => eq(parseTimeOfDay('9'), null));
  it('time 25:00', () => eq(parseTimeOfDay('25:00'), null));
  it('bad date', () => expect(() => courtEventTimes('2026-02-30')).toThrow());
  it('bad time', () => expect(() => courtEventTimes('2026-10-03', 'morning')).toThrow());
  it('bad duration', () => expect(() => courtEventTimes('2026-10-03', '09:00', 0)).toThrow());
});

describe('calendar IDs', () => {
  const calId = 'c_abc123def@group.calendar.google.com';
  it('calId bare', () => eq(parseCalendarId(calId), calId));
  it('calId embed', () => eq(parseCalendarId('https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(calId) + '&ctz=Asia%2FKuala_Lumpur'), calId));
  it('calId ical', () => eq(parseCalendarId('https://calendar.google.com/calendar/ical/' + encodeURIComponent(calId) + '/private-xyz/basic.ics'), calId));
  it('calId cid', () => eq(parseCalendarId('https://calendar.google.com/calendar/u/0?cid=' + Buffer.from(calId).toString('base64').replace(/=+$/, '')), calId));
  it('calId user', () => eq(parseCalendarId('diary@shcolaw.com'), 'diary@shcolaw.com'));
  it('calId junk', () => eq(parseCalendarId('SHCO Court Diary'), ''));
});
