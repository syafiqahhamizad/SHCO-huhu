import { GoogleWorkspaceError, googleApiFetch, signedInGoogleEmail } from './googleWorkspaceAuth';
import { buildGmailRaw } from '../lib/emailMime';

/**
 * Gmail: sends e-mail AS THE SIGNED-IN USER (it appears in their Sent folder), through the Gmail
 * API users.messages.send. Scope `gmail.send` only (the portal cannot read anyone's mail).
 * Returns Google's message ID only after Gmail accepted the message; throws otherwise.
 */

interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  /** Plain-text body (always sent, so every mail client can show it). */
  text: string;
  /** Optional HTML body (sent as multipart/alternative alongside `text`). */
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string; threadId?: string }> {
  let raw: string;
  try {
    raw = buildGmailRaw({ to: input.to, cc: input.cc, subject: input.subject, text: input.text, html: input.html });
  } catch (e) {
    throw new GoogleWorkspaceError(e instanceof Error ? e.message : String(e), 'bad_request', 'gmail');
  }
  const res = await googleApiFetch('gmail', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  }, { forbidden: 'Gmail refused to send from your account. Check that Gmail is turned on for your Google Workspace account.' });
  const j = await res.json() as { id?: string; threadId?: string };
  if (!j.id) throw new GoogleWorkspaceError('Gmail did not confirm the message was sent.', 'unknown', 'gmail');
  return { messageId: j.id, threadId: j.threadId };
}

/** Settings "Test": sends a short e-mail to the signed-in user. */
export async function testGmail(toEmail?: string): Promise<{ ok: boolean; message: string }> {
  const to = String(toEmail || signedInGoogleEmail()).trim();
  if (!to) return { ok: false, message: 'Sign in with your @shcolaw.com Google account first.' };
  try {
    const at = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });
    await sendEmail({
      to,
      subject: 'SHCO portal – Gmail test',
      text: 'This is a test e-mail from the SHCO portal (Firm & Practice Settings → Google Calendar, Tasks & Gmail), sent ' + at + '. No action is needed.',
    });
    return { ok: true, message: 'A test e-mail was sent to ' + to + '. Check that inbox (and its Sent folder).' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
