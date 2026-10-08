/**
 * Builds RFC 2822 / MIME e-mail messages for the Gmail API (users.messages.send `raw`).
 * Pure functions (no browser APIs beyond TextEncoder / btoa, both in Node 18+), so they can be
 * tested in src/lib/integrations.test.ts (`npm test`).
 */

/** Base64 of the UTF-8 bytes of `s`. */
function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** URL-safe base64 without padding (RFC 4648 §5), as Gmail's `raw` field requires. */
export const base64UrlUtf8 = (s: string) => base64Utf8(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Removes CR / LF so a value can never add extra headers. */
const oneLine = (s: string) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

/**
 * Encodes a header value: plain ASCII is left as is; anything else becomes RFC 2047 UTF-8
 * base64 encoded-words (each at most 75 characters, never splitting a character), folded.
 */
export function encodeMimeHeader(value: string): string {
  const v = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  const words: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const ch of Array.from(v)) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 45 && chunk) { words.push(chunk); chunk = ''; bytes = 0; }
    chunk += ch; bytes += n;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => '=?UTF-8?B?' + base64Utf8(w) + '?=').join('\r\n ');
}

const EMAIL_RE = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]{2,}$/;
const isValidEmail = (s: string) => EMAIL_RE.test(String(s || '').trim());

/** Splits "a@x.com, b@y.com; c@z.com" (or an array) into trimmed addresses. Throws on an invalid one. */
export function parseAddressList(input: string | string[] | undefined | null): string[] {
  const parts = (Array.isArray(input) ? input : [String(input ?? '')])
    .flatMap((p) => String(p ?? '').split(/[,;\s]+/))
    .map((p) => p.trim())
    .filter(Boolean);
  const bad = parts.find((p) => !isValidEmail(p));
  if (bad) throw new Error('“' + bad + '” is not a valid e-mail address.');
  return [...new Set(parts.map((p) => p.toLowerCase()))];
}

const wrap76 = (b64: string) => (b64.match(/.{1,76}/g) || ['']).join('\r\n');

interface MimeMessageInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /** Optional; Gmail fills in the sender's own address when this is left out. */
  from?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  /** Fixed boundary for tests; random otherwise. */
  boundary?: string;
}

/**
 * The RFC 2822 message (CRLF line endings). Bodies are UTF-8, base64 transfer-encoded; with `html`
 * the message is multipart/alternative (plain text first, then HTML).
 */
export function buildRfc2822Message(m: MimeMessageInput): string {
  const to = parseAddressList(m.to);
  if (!to.length) throw new Error('No recipient e-mail address.');
  const cc = parseAddressList(m.cc);
  const bcc = parseAddressList(m.bcc);
  const headers: string[] = [];
  if (m.from) headers.push('From: ' + encodeMimeHeader(m.from));
  headers.push('To: ' + to.join(', '));
  if (cc.length) headers.push('Cc: ' + cc.join(', '));
  if (bcc.length) headers.push('Bcc: ' + bcc.join(', '));
  if (m.replyTo) headers.push('Reply-To: ' + parseAddressList(m.replyTo).join(', '));
  headers.push('Subject: ' + encodeMimeHeader(m.subject || ''));
  headers.push('MIME-Version: 1.0');
  const text = String(m.text ?? '');
  if (!m.html) {
    headers.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
    return headers.join('\r\n') + '\r\n\r\n' + wrap76(base64Utf8(text)) + '\r\n';
  }
  const b = m.boundary || 'shco_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  headers.push('Content-Type: multipart/alternative; boundary="' + b + '"');
  return headers.join('\r\n') + '\r\n\r\n'
    + '--' + b + '\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(base64Utf8(text)) + '\r\n'
    + '--' + b + '\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap76(base64Utf8(m.html)) + '\r\n'
    + '--' + b + '--\r\n';
}

/** The `raw` value for Gmail's users.messages.send. */
export const buildGmailRaw = (m: MimeMessageInput) => base64UrlUtf8(buildRfc2822Message(m));

