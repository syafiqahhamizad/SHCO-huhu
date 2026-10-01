/**
 * WhatsApp click-to-chat links (https://wa.me/<number>?text=<message>).
 *
 * Opening the link only opens WhatsApp with the message typed in; the staff member still presses
 * Send there, and the portal cannot see what happens next. So the only honest status after a
 * click is WHATSAPP_OPENED_STATUS ("Opened in WhatsApp") — never "sent", "delivered" or "read".
 */

export const WHATSAPP_OPENED_STATUS = 'Opened in WhatsApp' as const;

/**
 * Normalises a phone number to the international digits wa.me expects (no +, spaces or dashes).
 * Malaysian local numbers are given the 60 country code:
 *   012-345 6789 → 60123456789 · +60 12-345 6789 → 60123456789 · 0060123456789 → 60123456789
 *   12-345 6789 (leading 0 dropped) → 60123456789 · 03-2161 1234 → 60321611234
 * Numbers written with + or 00 keep their own country code (+65 9123 4567 → 6591234567).
 * Returns null when the result is not a plausible phone number.
 */
export function normaliseWhatsAppNumber(phone: string | null | undefined): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  // Only digits and common separators are allowed; letters mean it is not a phone number.
  if (/[^\d\s+().\-/]/.test(raw)) return null;
  if (raw.indexOf('+') > 0 || (raw.match(/\+/g) || []).length > 1) return null;
  const international = raw.startsWith('+');
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (!international) {
    if (d.startsWith('00')) d = d.slice(2); // 00 international prefix
    else if (d.startsWith('60')) { /* already has the Malaysian country code */ }
    else if (d.startsWith('0')) d = '6' + d; // 0123456789 → 60123456789
    else if (/^1\d{8,9}$/.test(d)) d = '60' + d; // mobile without the leading 0
    else if (/^[3-9]\d{7,8}$/.test(d)) d = '60' + d; // landline without the leading 0
  }
  if (d.startsWith('0')) return null; // country codes never start with 0
  if (d.startsWith('60')) {
    // Malaysia: mobiles 60 1x + 7–8 digits (11–12 digits), landlines 60 3–9 + 7–8 digits (10–11).
    const rest = d.slice(2);
    if (/^1\d{8,9}$/.test(rest) || /^[3-9]\d{7,8}$/.test(rest)) return d;
    return null;
  }
  // Other countries: E.164 allows at most 15 digits; anything under 8 is not a full number.
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/** `https://wa.me/<digits>?text=<encoded message>`, or null when the number is not valid. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const n = normaliseWhatsAppNumber(phone);
  if (!n) return null;
  const text = String(message ?? '');
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}
