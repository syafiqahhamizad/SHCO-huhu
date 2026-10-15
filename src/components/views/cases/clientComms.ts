/**
 * Client updates and court-diary / Google Tasks sync for the Working File, using the real
 * Google Workspace services. Nothing is ever marked sent / synced unless Google confirmed it.
 */
import type { MatterClientUpdate, Task } from '../../../types';
import { queueClientEmail, watchClientEmail } from '../../../services/clientMailService';
import { isCourtDiaryConfigured } from '../../../services/googleCalendarService';
import { deleteGoogleTask, upsertGoogleTask } from '../../../services/googleTasksService';
import { googleErrorMessage } from '../../../services/googleWorkspaceAuth';
import { WHATSAPP_OPENED_STATUS, whatsappLink } from '../../../lib/whatsapp';
import { isDone, stamp } from './caseModel';
import type { WF } from './wf';

export { isCourtDiaryConfigured };

export const updateStatus = (u: Pick<MatterClientUpdate, 'emailSentAt' | 'whatsappOpenedAt'>): MatterClientUpdate['deliveryStatus'] =>
  u.emailSentAt && u.whatsappOpenedAt ? 'Sent by e-mail · Opened in WhatsApp' : u.emailSentAt ? 'Sent by e-mail' : u.whatsappOpenedAt ? WHATSAPP_OPENED_STATUS : 'Prepared — not sent';

const patchUpdate = (w: WF, id: string, p: Partial<MatterClientUpdate>, what: string) =>
  w.saveWith((c) => ({ clientUpdates: (c.clientUpdates || []).map((u) => { if (u.id !== id) return u; const n = { ...u, ...p }; return { ...n, deliveryStatus: updateStatus(n) }; }) }), what, 'Status Update');

/** Sends the update to the client from the firm's Client portal address (portal@). Records "Sent by e-mail" only when it has gone. */
export async function emailUpdate(w: WF, u: MatterClientUpdate, to: string): Promise<boolean> {
  if (!to) { w.toast('No e-mail address for the client. Add it in Parties.'); return false; }
  const fail = (msg: string) => { patchUpdate(w, u.id, { emailError: msg }, ''); w.toast('E-mail not sent: ' + msg); return false; };
  try {
    const subject = 'Update on your matter ' + w.c.ref + ': ' + u.title;
    const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#16223A;white-space:pre-wrap">' + u.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    const id = await queueClientEmail({ to, subject, text: u.message, html, docId: w.c.ref || w.c.id, kind: 'update', purpose: 'Client portal', createdBy: '' });
    w.toast('Sending to ' + to + '…');
    const res = await new Promise<{ ok: boolean; err?: string }>((resolve) => {
      const stop = watchClientEmail(id, (st, err) => { if (st === 'SUCCESS') { stop(); resolve({ ok: true }); } if (st === 'ERROR') { stop(); resolve({ ok: false, err }); } });
      setTimeout(() => { stop(); resolve({ ok: false, err: 'no answer from the e-mail sender yet; check Settings › Notification e-mails' }); }, 90000);
    });
    if (!res.ok) return fail(res.err || 'unknown error');
    patchUpdate(w, u.id, { emailTo: to, emailSentAt: stamp(), emailError: undefined }, 'Client update sent by e-mail to ' + to + ': ' + u.title);
    w.toast('Sent by e-mail to ' + to);
    return true;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
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

/** Auto-send rule: when e-mail is one of the update's channels and the client has an address,
 * send it now from the Client portal address; otherwise it stays prepared (Send now / Open WhatsApp). */
export async function autoSend(w: WF, u: MatterClientUpdate, to?: string): Promise<void> {
  if (!to || !u.channels.includes('email')) return;
  await emailUpdate(w, u, to);
}

/* ------------------------------------------------------------------ court diary */

/* ------------------------------------------------------------------ Google Tasks */

/** Syncs a task to the signed-in user's Google Tasks — only when it is assigned to them. */
/** What task sync needs (the Working File passes its whole `w`; My Dashboard passes just these). */
export type TaskSyncCtx = Pick<WF, 'c' | 'me' | 'meCode' | 'meId' | 'saveWith' | 'toast'>;

export async function syncTask(w: TaskSyncCtx, t: Task): Promise<void> {
  const mineTask = t.assignedTo === w.me || t.assignedTo === w.meCode;
  if (!w.meId || !mineTask) return;
  try {
    const r = await upsertGoogleTask({ googleTaskId: t.googleTaskIds?.[w.meId], title: t.title + ' (' + w.c.ref + ')', notes: [w.c.title, t.description].filter(Boolean).join('\n'), due: t.dueDate || undefined, completed: isDone(t) });
    w.saveWith((c) => ({ tasks: (c.tasks || []).map((x) => (x.id === t.id ? { ...x, googleTaskIds: { ...(x.googleTaskIds || {}), [w.meId]: r.googleTaskId } } : x)) }));
  } catch (e) {
    w.toast('Saved here, but Google Tasks did not update: ' + googleErrorMessage(e));
  }
}

export async function unsyncTask(w: Pick<WF, 'meId' | 'toast'>, t: Task): Promise<void> {
  const id = t.googleTaskIds?.[w.meId];
  if (!id) return;
  try { await deleteGoogleTask(id); } catch (e) { w.toast('Deleted here, but not from Google Tasks: ' + googleErrorMessage(e)); }
}
