import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { notificationEmail } from '../../../lib/notify';
import { queueEmail, watchEmail, type MailState } from '../../../services/mailQueueService';
import { readMailSettings, saveMailPassword, saveMailSettings, type MailSettings } from '../../../services/mailSettingsService';
import { SUPER_EMAIL } from './permissionModel';
import { css, S } from './settingsShared';

/**
 * Firm & Letterhead → "Notification e-mails": how alerts reach people by e-mail, the one-time
 * setup, and a test that shows what the e-mail sender actually did.
 */
export const EmailNotificationsCard: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const isOwner = (currentUser.email || '').toLowerCase() === SUPER_EMAIL;
  const [state, setState] = useState<MailState | null>(null);
  const blank: MailSettings = { smtpUser: (currentUser.email || '').toLowerCase(), from: 'SHCO Portal <' + (currentUser.email || '').toLowerCase() + '>', replyTo: 'portal@shcolaw.com' };
  const [cfg, setCfg] = useState<MailSettings | null>(null);
  const [form, setForm] = useState<MailSettings>(blank);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!isOwner) return;
    readMailSettings().then((v) => { setCfg(v); if (v) setForm({ ...blank, ...v }); }).catch(() => setCfg(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const saveAll = async () => {
    const user = form.smtpUser.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@shcolaw\.com$/.test(user)) { showToast('The sending account must be an @shcolaw.com address.'); return; }
    if (!cfg?.passwordSetAt && pw.replace(/\s+/g, '').length !== 16) { showToast('Paste the 16-letter App password.'); return; }
    setSaving(true);
    try {
      const next = { ...form, smtpUser: user, from: form.from.trim() || 'SHCO Portal <' + user + '>', replyTo: form.replyTo.trim() };
      if (pw.trim()) {
        if (pw.replace(/\s+/g, '').length !== 16) { showToast('An App password has 16 letters.'); setSaving(false); return; }
        next.passwordSetAt = await saveMailPassword(pw, next, currentUser.name);
      } else await saveMailSettings(next, currentUser.name);
      setCfg(next); setForm(next); setPw('');
      showToast('E-mail settings saved. Press “Send test e-mail to me”.');
    } catch (e) {
      showToast('Not saved: ' + String((e as Error).message || e));
    }
    setSaving(false);
  };
  const stop = useRef<(() => void) | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { stop.current?.(); if (timer.current) window.clearTimeout(timer.current); }, []);

  const send = async () => {
    stop.current?.();
    setState({ state: 'PENDING' });
    try {
      const mail = notificationEmail({ title: 'Test e-mail', message: 'This is a test from the SHCO portal. If you can read this, notification e-mails work.', from: currentUser.name }, window.location.origin);
      const id = await queueEmail((currentUser.email || '').toLowerCase(), mail, currentUser.email || currentUser.name);
      stop.current = watchEmail(id, setState);
      // No reply from the sender after a minute: probably not deployed yet.
      timer.current = window.setTimeout(() => setState((s) => (s && (s.state === 'WAITING' || s.state === 'PENDING') ? { state: 'ERROR', error: 'No reply after 60 seconds. The e-mail sender may not be installed yet (it goes live with the next deploy).' } : s)), 60000);
    } catch (e) {
      setState({ state: 'ERROR', error: String((e as Error).message || e) });
    }
  };

  const shown = !state ? null
    : state.state === 'SUCCESS' ? { t: 'Sent ✓ Check your inbox (and spam) for “[SHCO Portal] Test e-mail”.', c: '#1F5A3B', bg: '#E6EFE9' }
    : state.state === 'ERROR' ? { t: 'Not sent: ' + (state.error || 'unknown error'), c: '#8E2A20', bg: '#FBEDE9' }
    : { t: 'Sending…', c: '#8A6D3B', bg: '#FBF2E9' };

  return (
    <div style={css('grid-column:1 / -1;' + S.card)}>
      <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Notification e-mails</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>every bell alert is also e-mailed to the person, from the firm address</span></div>
      <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:12px 14px')}>
        <div style={css('display:flex;flex-direction:column;gap:9px;min-width:0')}>
          {isOwner && (
            <div style={css('display:flex;flex-direction:column;gap:7px;padding:10px;border:1px solid #EEF1F5;border-radius:8px')}>
              {([['smtpUser', 'Sending account', 'you@shcolaw.com'], ['from', 'Shown as (From)', 'SHCO Portal <you@shcolaw.com>'], ['replyTo', 'Replies go to', 'portal@shcolaw.com']] as const).map(([k, label, ph]) => (
                <label key={k} style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center')}>
                  <span style={css(S.fieldLabel)}>{label}</span>
                  <input value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A')} />
                </label>
              ))}
              <label style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center')}>
                <span style={css(S.fieldLabel)}>App password</span>
                <input type="password" autoComplete="new-password" value={pw} placeholder={cfg?.passwordSetAt ? 'Saved ' + new Date(cfg.passwordSetAt).toLocaleDateString('en-GB') + ' · paste a new one to replace' : '16 letters from myaccount.google.com/apppasswords'} onChange={(e) => setPw(e.target.value)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A')} />
              </label>
              <span style={css('font-size:10.5px;color:#5B6478;line-height:1.45')}>The password is stored for the e-mail sender only. Nobody can read it back, not even you; to change it, paste a new one.</span>
              <button type="button" disabled={saving} onClick={() => void saveAll()} style={css(S.darkBtn + ';align-self:flex-start' + (saving ? ';opacity:.5' : ''))}>{saving ? 'Saving…' : 'Save e-mail settings'}</button>
            </div>
          )}
          <button type="button" onClick={() => void send()} disabled={state?.state === 'PENDING' || state?.state === 'PROCESSING'} style={css(S.darkBtn + ';align-self:flex-start')}>Send test e-mail to me</button>
          {shown && <div style={css(`padding:8px 10px;border-radius:8px;font-size:11.5px;font-weight:700;line-height:1.45;color:${shown.c};background:${shown.bg}`)}>{shown.t}</div>}
          <span style={css('font-size:10.5px;color:#5B6478;line-height:1.5')}>Goes to {currentUser.email || 'your e-mail'}. Only @shcolaw.com addresses ever receive portal e-mails.</span>
        </div>
        <details style={css('font-size:11px;line-height:1.55;color:#16223A;min-width:0')}>
          <summary style={css('cursor:pointer;font-weight:700')}>One-time setup (Managing Partner)</summary>
          <ol style={css('margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px')}>
            <li><strong>Google Admin</strong> → Groups → create <strong>portal@shcolaw.com</strong> (replies land here).</li>
            <li>Turn on <strong>2-Step Verification</strong> on the sending account, then open <strong>myaccount.google.com/apppasswords</strong> and create an App password called “SHCO Portal”.</li>
            <li>Fill in the box on the left (sending account, App password) and press <strong>Save e-mail settings</strong>.</li>
            <li>Press <strong>Send test e-mail to me</strong>.</li>
          </ol>
        </details>
      </div>
    </div>
  );
};
