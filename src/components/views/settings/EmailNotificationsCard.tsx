import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { notificationEmail } from '../../../lib/notify';
import { queueEmail, watchEmail, type MailState } from '../../../services/mailQueueService';
import { css, S } from './settingsShared';

/**
 * Firm & Letterhead → "Notification e-mails": how alerts reach people by e-mail, the one-time
 * setup, and a test that shows what the e-mail extension actually did.
 */
export const EmailNotificationsCard: React.FC = () => {
  const { currentUser } = useApp();
  const [state, setState] = useState<MailState | null>(null);
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
      // No reply from the extension after a minute: it is probably not installed yet.
      timer.current = window.setTimeout(() => setState((s) => (s && (s.state === 'WAITING' || s.state === 'PENDING') ? { state: 'ERROR', error: 'No reply after 60 seconds. The e-mail extension is probably not installed yet (see the setup steps).' } : s)), 60000);
    } catch (e) {
      setState({ state: 'ERROR', error: String((e as Error).message || e) });
    }
  };

  const shown = !state ? null
    : state.state === 'SUCCESS' ? { t: 'Sent ✓ Check your inbox (and spam) for “[SHCO Portal] Test e-mail”.', c: '#1F5A3B', bg: '#E6EFE9' }
    : state.state === 'ERROR' ? { t: 'Not sent: ' + (state.error || 'unknown error'), c: '#8E2A20', bg: '#FBEDE9' }
    : { t: 'Waiting for the e-mail extension…', c: '#8A6D3B', bg: '#FBF2E9' };

  return (
    <div style={css('grid-column:1 / -1;' + S.card)}>
      <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Notification e-mails</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>every bell alert is also e-mailed to the person, from the firm address</span></div>
      <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:12px 14px')}>
        <div style={css('display:flex;flex-direction:column;gap:9px;min-width:0')}>
          <button type="button" onClick={() => void send()} disabled={state?.state === 'PENDING' || state?.state === 'PROCESSING'} style={css(S.darkBtn + ';align-self:flex-start')}>Send test e-mail to me</button>
          {shown && <div style={css(`padding:8px 10px;border-radius:8px;font-size:11.5px;font-weight:700;line-height:1.45;color:${shown.c};background:${shown.bg}`)}>{shown.t}</div>}
          <span style={css('font-size:10.5px;color:#5B6478;line-height:1.5')}>Goes to {currentUser.email || 'your e-mail'}. Only @shcolaw.com addresses ever receive portal e-mails.</span>
        </div>
        <details style={css('font-size:11px;line-height:1.55;color:#16223A;min-width:0')}>
          <summary style={css('cursor:pointer;font-weight:700')}>One-time setup (Managing Partner)</summary>
          <ol style={css('margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px')}>
            <li><strong>Google Admin</strong> → Groups → create <strong>portal@shcolaw.com</strong> (replies to portal e-mails land here).</li>
            <li><em>Optional:</em> in <strong>your</strong> Gmail → Settings → Accounts → “Send mail as” → add <strong>portal@shcolaw.com</strong> (needs the group to accept outside e-mail). Skip it and e-mails show “SHCO Portal” with your address; replies still go to the group.</li>
            <li>Your Google Account → Security → turn on <strong>2-Step Verification</strong>, then open <strong>myaccount.google.com/apppasswords</strong> and create an <strong>App password</strong> (name it “SHCO Portal”). Copy the 16 letters.</li>
            <li><strong>Firebase console</strong> → Extensions → install <strong>Trigger Email from Firestore</strong>: collection <code>mail</code>; location <code>asia-southeast1</code>; SMTP URI <code>smtps://YOUR-EMAIL%40shcolaw.com@smtp.gmail.com:465</code> (write @ in your e-mail as %40); SMTP password = the app password; Default FROM <code>SHCO Portal &lt;portal@shcolaw.com&gt;</code> (or your own address if you skipped the optional step); Default REPLY-TO <code>portal@shcolaw.com</code>.</li>
            <li>Come back here and press <strong>Send test e-mail to me</strong>.</li>
          </ol>
        </details>
      </div>
    </div>
  );
};
