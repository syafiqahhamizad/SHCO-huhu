import type { Case, NotificationItem, User } from '../types';

/**
 * Who a notification is for. Tokens:
 *   'case:<caseId>'     — the file's partners and lawyers
 *   'partners:<caseId>' — the file's partners only
 *   'role:<Role>'       — everyone active with that role (e.g. role:Accountant)
 *   anything else       — a user id, e-mail, staff code or name
 * The person who acted is left out; switched-off users and clients never get staff alerts.
 */
export const resolveRecipients = (tokens: string[], users: User[], cases: Case[], actorId?: string): User[] => {
  const staff = users.filter((u) => u.status !== 'Inactive' && u.role !== 'Client');
  const norm = (x: string) => x.trim().toLowerCase();
  const byKey = (k: string) => {
    const n = norm(k);
    if (!n) return [];
    return staff.filter((u) => [u.id, u.email, u.code, u.name].some((v) => v && norm(String(v)) === n));
  };
  const out = new Map<string, User>();
  const add = (list: User[]) => list.forEach((u) => out.set(u.id, u));
  for (const t of tokens) {
    const [kind, ...rest] = t.split(':');
    const arg = rest.join(':');
    if ((kind === 'case' || kind === 'partners') && arg) {
      const c = cases.find((x) => x.id === arg);
      if (!c) continue;
      (c.partners || []).forEach((code) => add(byKey(code)));
      if (kind === 'case') [c.lawyerInCharge, ...(c.lawyers || [])].forEach((n) => n && add(byKey(n)));
    } else if (kind === 'role' && arg) {
      add(staff.filter((u) => norm(u.role) === norm(arg)));
    } else add(byKey(t));
  }
  if (actorId) out.delete(actorId);
  return [...out.values()];
};

/** Shown to this person: addressed to them, or an older notification with no recipients. */
export const isForMe = (n: NotificationItem, userId: string) => !n.to || n.to.includes(userId);

/** Read by this person (older notifications keep their single shared flag). */
export const isReadBy = (n: NotificationItem, userId: string) => (n.to ? (n.readBy || []).includes(userId) : n.read);

/** The e-mail for one recipient: plain text plus a simple HTML copy, with a link back to the portal. */
export const notificationEmail = (n: Pick<NotificationItem, 'title' | 'message' | 'from'>, appUrl: string) => {
  const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
  const subject = ('[SHCO Portal] ' + n.title).slice(0, 200);
  const text = n.message + (n.from ? '\n\nBy: ' + n.from : '') + '\n\nOpen the portal: ' + appUrl + '\n\nThis is an automatic message from the SHCO practice portal.';
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#16223A">'
    + '<p style="margin:0 0 12px"><strong>' + esc(n.title) + '</strong></p>'
    + '<p style="margin:0 0 12px">' + esc(n.message) + '</p>'
    + (n.from ? '<p style="margin:0 0 12px;color:#5B6478">By: ' + esc(n.from) + '</p>' : '')
    + '<p style="margin:0 0 16px"><a href="' + esc(appUrl) + '" style="color:#2F4F7A;font-weight:bold">Open the portal</a></p>'
    + '<p style="margin:0;font-size:12px;color:#94A3B8">Automatic message from the SHCO practice portal.</p></div>';
  return { subject, text, html };
};
