/**
 * Client updates and court-diary / Google Tasks sync for the Working File, using the real
 * Google Workspace services. Nothing is ever marked sent / synced unless Google confirmed it.
 */
import type { Case, Hearing, MatterClientUpdate, Task } from '../../../types';
import { sendEmail } from '../../../services/gmailService';
import { createCourtEvent, isCourtDiaryConfigured } from '../../../services/googleCalendarService';
import { deleteGoogleTask, upsertGoogleTask } from '../../../services/googleTasksService';
import { googleErrorMessage, hasValidGoogleToken } from '../../../services/googleWorkspaceAuth';
import { WHATSAPP_OPENED_STATUS, whatsappLink } from '../../../lib/whatsapp';
import { courtOf, isDone, stamp } from './caseModel';
import type { WF } from './wf';

export { isCourtDiaryConfigured };

export const updateStatus = (u: Pick<MatterClientUpdate, 'emailSentAt' | 'whatsappOpenedAt'>): MatterClientUpdate['deliveryStatus'] =>
  u.emailSentAt && u.whatsappOpenedAt ? 'Sent by e-mail · Opened in WhatsApp' : u.emailSentAt ? 'Sent by e-mail' : u.whatsappOpenedAt ? WHATSAPP_OPENED_STATUS : 'Prepared — not sent';

const patchUpdate = (w: WF, id: string, p: Partial<MatterClientUpdate>, what: string) =>
  w.saveWith((c) => ({ clientUpdates: (c.clientUpdates || []).map((u) => { if (u.id !== id) return u; const n = { ...u, ...p }; return { ...n, deliveryStatus: updateStatus(n) }; }) }), what, 'Status Update');

/** Sends the update by Gmail (from the signed-in user). Records "Sent by e-mail" only on success. */
export async function emailUpdate(w: WF, u: MatterClientUpdate, to: string): Promise<boolean> {
  if (!to) { w.toast('No e-mail address for the client. Add it in Parties.'); return false; }
  try {
    const r = await sendEmail({ to, subject: 'Update on your matter ' + w.c.ref + ': ' + u.title, text: u.message });
    patchUpdate(w, u.id, { emailTo: to, emailSentAt: stamp(), emailMessageId: r.messageId, emailError: undefined }, 'Client update sent by e-mail to ' + to + ': ' + u.title);
    w.toast('Sent by e-mail to ' + to);
    return true;
  } catch (e) {
    const msg = googleErrorMessage(e);
    patchUpdate(w, u.id, { emailError: msg }, '');
    w.toast('E-mail not sent: ' + msg);
    return false;
  }
}

/** Opens WhatsApp with the message typed in (call from a click). Records "Opened in WhatsApp" only. */
export function whatsappUpdate(w: WF, u: MatterClientUpdate, phone?: string): void {
  const link = whatsappLink(phone, u.message);
  if (!link) { w.toast('No valid WhatsApp number for the client. Add it in Parties.'); return; }
  window.open(link, '_blank', 'noopener');
  patchUpdate(w, u.id, { whatsappOpenedAt: stamp() }, 'Client update opened in WhatsApp: ' + u.title);
  w.toast('WhatsApp opened with the message. Press Send there; the portal cannot see if it was delivered.');
}

/** Auto-send rule: if a Gmail token is already valid (no popup needed) e-mail it now; otherwise
 * the update stays prepared and the Client updates card shows Send now / Open WhatsApp. */
export async function autoSend(w: WF, u: MatterClientUpdate, to?: string): Promise<void> {
  if (!to || !u.channels.includes('email') || !hasValidGoogleToken('gmail')) return;
  await emailUpdate(w, u, to);
}

/* ------------------------------------------------------------------ court diary */

const eventInput = (c: Case, h: Pick<Hearing, 'purpose' | 'date' | 'time' | 'source'>, attendees: string[]) => {
  const court = courtOf(c);
  return {
    title: h.purpose + ' — ' + c.title + ' (' + c.ref + ')',
    date: h.date,
    time: h.time || undefined,
    location: court.name || undefined,
    description: ['File ' + c.ref, court.suit ? 'Suit ' + court.suit : '', h.source ? 'From ' + h.source : '', 'Added from the SHCO portal'].filter(Boolean).join('\n'),
    attendees: attendees.filter(Boolean),
  };
};

/** Adds the hearing to the firm court diary and invites the PIC. Returns the event or null (error toasted). */
export async function addHearingToDiary(w: WF, c: Case, h: Hearing, attendees: string[]): Promise<{ eventId: string; htmlLink: string } | null> {
  try {
    const r = await createCourtEvent(eventInput(c, h, attendees));
    return { eventId: r.eventId, htmlLink: r.htmlLink };
  } catch (e) {
    w.toast('Saved, but not added to Google Calendar: ' + googleErrorMessage(e));
    return null;
  }
}

/* ------------------------------------------------------------------ Google Tasks */

/** Syncs a task to the signed-in user's Google Tasks — only when it is assigned to them. */
export async function syncTask(w: WF, t: Task): Promise<void> {
  const mineTask = t.assignedTo === w.me || t.assignedTo === w.meCode;
  if (!w.meId || !mineTask) return;
  try {
    const r = await upsertGoogleTask({ googleTaskId: t.googleTaskIds?.[w.meId], title: t.title + ' (' + w.c.ref + ')', notes: [w.c.title, t.description].filter(Boolean).join('\n'), due: t.dueDate || undefined, completed: isDone(t) });
    w.saveWith((c) => ({ tasks: (c.tasks || []).map((x) => (x.id === t.id ? { ...x, googleTaskIds: { ...(x.googleTaskIds || {}), [w.meId]: r.googleTaskId } } : x)) }));
  } catch (e) {
    w.toast('Saved here, but Google Tasks did not update: ' + googleErrorMessage(e));
  }
}

export async function unsyncTask(w: WF, t: Task): Promise<void> {
  const id = t.googleTaskIds?.[w.meId];
  if (!id) return;
  try { await deleteGoogleTask(id); } catch (e) { w.toast('Deleted here, but not from Google Tasks: ' + googleErrorMessage(e)); }
}
