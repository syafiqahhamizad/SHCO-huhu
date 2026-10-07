/**
 * SHCO portal — notification e-mail sender (replaces the retired "Trigger Email" extension).
 *
 * The portal adds a document to Firestore `mail` ({ to, message: { subject, text, html } });
 * this function sends it through Google Workspace SMTP (smtp.gmail.com) and writes the result
 * back as `delivery` (PROCESSING → SUCCESS / ERROR), which Settings → Notification e-mails shows.
 *
 * Settings (written by the Managing Partner in the portal; the browser can never read the password):
 *   privateConfig/mail        { smtpUser, from, replyTo, passwordSetAt, updatedBy }
 *   privateConfig/mailSecret  { smtpPass }   — app password, write-only for the owner
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

initializeApp();
const db = getFirestore();

const FIRM_ADDRESS = /^[a-z0-9._%+-]+@shcolaw\.com$/;

/** Plain-language reason for the usual SMTP failures. */
function explain(err) {
  const msg = String((err && err.message) || err || '');
  if (/535|Username and Password not accepted|Invalid login/i.test(msg)) {
    return 'Google refused the login. Check the sending account e-mail and paste a fresh App password in Settings → Notification e-mails.';
  }
  if (/ETIMEDOUT|ECONNECTION|ENOTFOUND/i.test(msg)) return 'Could not reach smtp.gmail.com. It will work on the next message; if it keeps happening, tell your developer.';
  return msg.slice(0, 500);
}

exports.sendQueuedMail = onDocumentCreated(
  { document: 'mail/{mailId}', region: process.env.MAIL_REGION || 'asia-southeast1', retry: false, timeoutSeconds: 60, maxInstances: 3 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;

    // Claim the message once (a re-delivered event must not send it twice).
    const claimed = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists || cur.get('delivery.state')) return false;
      tx.update(ref, { delivery: { state: 'PROCESSING', startTime: FieldValue.serverTimestamp(), attempts: 1 } });
      return true;
    });
    if (!claimed) return;

    try {
      const m = snap.data() || {};
      const to = String(m.to || '').trim().toLowerCase();
      if (!FIRM_ADDRESS.test(to)) throw new Error('Only @shcolaw.com addresses receive portal e-mails.');
      const message = m.message || {};

      const [cfgSnap, secretSnap] = await Promise.all([db.doc('privateConfig/mail').get(), db.doc('privateConfig/mailSecret').get()]);
      const cfg = cfgSnap.exists ? cfgSnap.data() : {};
      const pass = secretSnap.exists ? String(secretSnap.get('smtpPass') || '') : '';
      const user = String(cfg.smtpUser || '').trim();
      if (!user || !pass) throw new Error('E-mail is not set up yet: add the sending account and App password in Settings → Notification e-mails.');

      const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
      const info = await transport.sendMail({
        from: cfg.from || `SHCO Portal <${user}>`,
        replyTo: cfg.replyTo || undefined,
        to,
        subject: String(message.subject || '[SHCO Portal]').slice(0, 200),
        text: String(message.text || ''),
        html: message.html ? String(message.html) : undefined,
      });
      await ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.endTime': FieldValue.serverTimestamp(),
        'delivery.info': { messageId: info.messageId || '', accepted: (info.accepted || []).map(String) },
      });
    } catch (err) {
      console.error('Mail not sent', ref.id, err);
      await ref.update({ 'delivery.state': 'ERROR', 'delivery.error': explain(err), 'delivery.endTime': FieldValue.serverTimestamp() });
    }
  },
);
