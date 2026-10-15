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
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');
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

/** The firm's group address for each kind of e-mail (Settings › Firm & Letterhead › Emails by purpose). */
const PURPOSE_DEFAULTS = {
  'General enquiries': 'office.shco@shcolaw.com',
  'Billing & receipts': 'billing@shcolaw.com',
  'Payroll & HR': 'account@shcolaw.com',
  'Client portal': 'portal@shcolaw.com',
  'New leads': 'consultation@shcolaw.com',
};
/**
 * "Syafiqah Hamizad & Co <group@shcolaw.com>" for a purpose, or null (then the sending account
 * is used). Gmail shows the group as From only when the sending account has it as a "Send mail
 * as" address; Reply-To always goes to the group.
 */
async function fromFor(purpose) {
  if (!purpose) return null;
  const ps = await db.doc('firm/main/config/practiceSettings').get();
  const set = ((ps.exists && (ps.get('value') || {}).purposeEmails) || []).find((x) => x && x.purpose === purpose);
  const email = String((set && set.email) || PURPOSE_DEFAULTS[purpose] || '').trim().toLowerCase();
  return FIRM_ADDRESS.test(email) ? { from: `Syafiqah Hamizad & Co <${email}>`, replyTo: email } : null;
}

/** SMTP transport + From address from Settings → Notification e-mails. */
async function smtp() {
  const [cfgSnap, secretSnap] = await Promise.all([db.doc('privateConfig/mail').get(), db.doc('privateConfig/mailSecret').get()]);
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const pass = secretSnap.exists ? String(secretSnap.get('smtpPass') || '') : '';
  const user = String(cfg.smtpUser || '').trim();
  if (!user || !pass) throw new Error('E-mail is not set up yet: add the sending account and App password in Settings → Notification e-mails.');
  return { transport: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } }), from: cfg.from || `SHCO Portal <${user}>`, replyTo: cfg.replyTo || undefined };
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

      const base = await smtp();
      const p = await fromFor(m.purpose ? String(m.purpose) : 'General enquiries');
      const { transport } = base;
      const info = await transport.sendMail({
        from: p ? p.from : base.from,
        replyTo: p ? p.replyTo : base.replyTo,
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

/* ------------------------------------------------------------------ sign-in e-mails */

const PORTAL = 'https://portal.shcolaw.com';
const accessKey = (email) => email.toLowerCase().replace(/\./g, ',');
const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 14-character temporary password with upper, lower, digit and symbol. */
function tempPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*?'];
  const all = sets.join('');
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const out = sets.map(pick);
  while (out.length < 14) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}
const shell = (title, body) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#16223A;max-width:560px;margin:0 auto;padding:24px 8px">
<div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#8A6D3B;text-transform:uppercase">Syafiqah Hamizad &amp; Co</div>
<h1 style="font-family:Georgia,serif;font-size:22px;margin:6px 0 16px">${esc(title)}</h1>${body}
<p style="font-size:12px;color:#5B6478;margin-top:28px;border-top:1px solid #DDE3EB;padding-top:12px">This is an automatic message from the SHCO Portal. Please do not reply to it.</p></div>`;
const button = (href, label) => `<p style="margin:20px 0"><a href="${href}" style="background:#16223A;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`;

/**
 * Sign-in e-mails, sent from the portal mailbox (Settings → Notification e-mails) — never from
 * Firebase's own noreply address. `accountEmails/{id}`:
 *   { kind: 'invite', email, name, role }  added by an admin in Users & Roles: creates the sign-in
 *       (e-mail already confirmed, since only this inbox gets the password), sets a temporary
 *       password and sends ONE e-mail with the portal link, the password and a "set my own
 *       password" button;
 *   { kind: 'reset', email }  "Forgot password?" on the sign-in page: sends a reset link, only to
 *       people on the access list, at most once every 10 minutes.
 */
exports.sendAccountEmail = onDocumentCreated(
  { document: 'accountEmails/{id}', region: process.env.MAIL_REGION || 'asia-southeast1', retry: false, timeoutSeconds: 60, maxInstances: 3 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;
    const m = snap.data() || {};
    const email = String(m.email || '').trim().toLowerCase();
    const done = (state, extra = {}) => ref.update({ 'delivery.state': state, 'delivery.endTime': FieldValue.serverTimestamp(), ...extra });
    // Claim it once: a re-delivered event must not send (or reset a password) twice.
    const claimed = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists || cur.get('delivery.state')) return false;
      tx.update(ref, { delivery: { state: 'PROCESSING', startTime: FieldValue.serverTimestamp() } });
      return true;
    });
    if (!claimed) return;
    try {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Not an e-mail address.');
      if (FIRM_ADDRESS.test(email)) throw new Error('@shcolaw.com staff sign in with Google; no password is needed.');
      const access = await db.doc('practiceSystem/access').get();
      const listed = access.exists ? (access.get('users') || {})[accessKey(email)] : null;
      const auth = getAuth();
      const actionSettings = { url: PORTAL };
      const base = await smtp();
      const pp = await fromFor('Client portal');
      const { transport } = base;
      const from = pp ? pp.from : base.from;
      const replyTo = pp ? pp.replyTo : base.replyTo;

      if (m.kind === 'invite') {
        const pwd = tempPassword();
        let user;
        try { user = await auth.getUserByEmail(email); } catch (e) { user = null; }
        if (user) await auth.updateUser(user.uid, { password: pwd, emailVerified: true, disabled: false });
        else user = await auth.createUser({ email, password: pwd, emailVerified: true, displayName: String(m.name || '').slice(0, 100) || undefined });
        const link = await auth.generatePasswordResetLink(email, actionSettings);
        const tab = String(m.role || '').toLowerCase() === 'client' ? 'Client Access' : 'External Access';
        const html = shell('Your SHCO Portal sign-in', `<p>Dear ${esc(m.name || '')},</p>
<p>You have been given access to the Syafiqah Hamizad &amp; Co portal.</p>
<table style="border-collapse:collapse;font-size:14px;margin:12px 0">
<tr><td style="padding:4px 14px 4px 0;color:#5B6478">Portal</td><td><a href="${PORTAL}">portal.shcolaw.com</a></td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#5B6478">Sign in on the tab</td><td><b>${tab}</b></td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#5B6478">E-mail</td><td>${esc(email)}</td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#5B6478">Temporary password</td><td style="font-family:monospace;font-size:15px"><b>${esc(pwd)}</b></td></tr></table>
<p>For your security, please set your own password now:</p>${button(link, 'Set my own password')}
<p style="font-size:13px;color:#5B6478">This button works for one hour. After that, sign in with the temporary password, or use <b>Forgot password?</b> on the sign-in page to get a new link.</p>`);
        const info = await transport.sendMail({ from, replyTo, to: email, subject: 'Your SHCO Portal sign-in', html, text: `You have been given access to the SHCO Portal.\nPortal: ${PORTAL}\nSign in on the tab: ${tab}\nE-mail: ${email}\nTemporary password: ${pwd}\nSet your own password: ${link}` });
        await done('SUCCESS', { 'delivery.info': { messageId: info.messageId || '', uid: user.uid } });
        return;
      }

      if (m.kind === 'reset') {
        // Only people with access, and not more often than every 10 minutes (no hint either way).
        if (!listed || listed.active !== true) { await done('SKIPPED'); return; }
        const logRef = db.doc('privateConfig/resetLog');
        const last = (await logRef.get()).get(accessKey(email));
        if (last && Date.now() - Number(last) < 10 * 60 * 1000) { await done('SKIPPED'); return; }
        await logRef.set({ [accessKey(email)]: Date.now() }, { merge: true });
        const link = await auth.generatePasswordResetLink(email, actionSettings);
        const html = shell('Reset your SHCO Portal password', `<p>Someone (hopefully you) asked to reset the password for <b>${esc(email)}</b>.</p>${button(link, 'Set a new password')}<p style="font-size:13px;color:#5B6478">This button works for one hour. If you did not ask for this, ignore this e-mail; your password stays the same.</p>`);
        await transport.sendMail({ from, replyTo, to: email, subject: 'Reset your SHCO Portal password', html, text: `Set a new password for ${email}: ${link}` });
        await done('SUCCESS');
        return;
      }
      throw new Error('Unknown e-mail kind.');
    } catch (err) {
      console.error('Account e-mail not sent', ref.id, err);
      await done('ERROR', { 'delivery.error': explain(err) });
    }
  },
);

/* ------------------------------------------------------------------ billing e-mails to clients */

/**
 * `clientMail/{id}`: a quotation, proforma, invoice or payment reminder for ONE client address,
 * queued from Billing by someone allowed to edit billing (checked by the rules, and again here
 * against the access list). Sent from the portal mailbox; the result is written back as `delivery`.
 */
exports.sendClientMail = onDocumentCreated(
  { document: 'clientMail/{id}', region: process.env.MAIL_REGION || 'asia-southeast1', retry: false, timeoutSeconds: 60, maxInstances: 3 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;
    const claimed = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists || cur.get('delivery.state')) return false;
      tx.update(ref, { delivery: { state: 'PROCESSING', startTime: FieldValue.serverTimestamp() } });
      return true;
    });
    if (!claimed) return;
    try {
      const m = snap.data() || {};
      const to = String(m.to || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Not an e-mail address.');
      const by = String(m.createdBy || '').trim().toLowerCase();
      const access = await db.doc('practiceSystem/access').get();
      const u = access.exists ? (access.get('users') || {})[accessKey(by)] : null;
      const role = String((u && u.role) || '').toLowerCase();
      const billing = String((u && u.billing) || '');
      const allowed = by === 'syafiqahhamizad@shcolaw.com' || (u && u.active === true && (billing === 'edit' || (!billing && (role === 'partner' || role === 'accountant'))));
      // File updates to clients may come from anyone on the firm's list; billing e-mails only from billing editors.
      const fileUpdate = String(m.kind || '') === 'update' && u && u.active === true;
      if (!allowed && !fileUpdate) throw new Error('Only people who may edit billing can e-mail clients.');
      const { transport } = await smtp();
      // Billing e-mails come from the firm's billing address (Settings › Firm & Letterhead ›
      // Emails by purpose › Billing & receipts), default billing@shcolaw.com; replies go there too.
      // The sending account must have that address as a Gmail "Send mail as" alias, else Gmail
      // shows the sending account as From (Reply-To still goes to billing).
      const p = (await fromFor(m.purpose ? String(m.purpose) : 'Billing & receipts')) || (await fromFor('Billing & receipts'));
      const info = await transport.sendMail({ from: p ? p.from : undefined, replyTo: p ? p.replyTo : undefined, to, subject: String(m.subject || '').slice(0, 200), text: String(m.text || ''), html: m.html ? String(m.html) : undefined });
      await ref.update({ 'delivery.state': 'SUCCESS', 'delivery.endTime': FieldValue.serverTimestamp(), 'delivery.info': { messageId: info.messageId || '' } });
    } catch (err) {
      console.error('Client mail not sent', ref.id, err);
      await ref.update({ 'delivery.state': 'ERROR', 'delivery.error': explain(err), 'delivery.endTime': FieldValue.serverTimestamp() });
    }
  },
);
