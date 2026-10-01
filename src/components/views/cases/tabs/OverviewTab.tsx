import React, { useState } from 'react';
import { useApp } from '../../../../context/AppContext';
import type { MatterParty } from '../../../../types';
import { css, S, Card, Field, Toggle } from '../caseUi';
import { P, avatarOf, courtOf, daysFrom, fmt, isDeadline, isDone, legacyFromParties, short } from '../caseModel';
import { newId, type WF } from '../wf';
import { emailUpdate, whatsappUpdate } from '../clientComms';

const T: Record<MatterParty['side'], [string, string, string]> = {
  client: ['Clients we act for', '+ Add client', 'e.g. Plaintiff, 2nd Plaintiff'],
  opposing: ['Opposing parties', '+ Add party', 'e.g. 1st Defendant'],
  solicitor: ['Opposing solicitors', '+ Register firm', 'e.g. For 1st Defendant'],
};

export const PartiesCard: React.FC<{ w: WF }> = ({ w }) => {
  const { clients = [] } = useApp();
  const { c, parties, ro } = w;
  const [addP, setAddP] = useState<'' | MatterParty['side']>('');
  const [f, setF] = useState({ name: '', role: '', idNo: '', contact: '' });

  const saveP = () => {
    if (!addP) return;
    if (!f.name.trim()) { w.toast('Add the name'); return; }
    const reg = addP === 'client' ? clients.find((x) => x.name.toLowerCase() === f.name.trim().toLowerCase()) : undefined;
    const p: MatterParty = {
      id: newId('PTY'), side: addP, name: f.name.trim(), role: f.role.trim() || (addP === 'solicitor' ? 'Counsel on record' : '—'),
      idNo: f.idNo.trim() || reg?.icNo || reg?.registrationNo || '', contact: f.contact.trim() || [reg?.phone, reg?.email].filter(Boolean).join(' · '),
      phone: reg?.phone, email: reg?.email, clientId: reg?.id, since: new Date().toISOString().slice(0, 10),
      actsFor: addP === 'solicitor' ? f.role.trim().replace(/^For\s+/i, '') || undefined : undefined,
    };
    const next = [...parties, p];
    w.save(legacyFromParties(next, c), 'Party added: ' + p.name + ' (' + p.role + ')');
    setF({ name: '', role: '', idNo: '', contact: '' });
    setAddP('');
    w.toast('Saved to parties');
  };
  const remove = (p: MatterParty) => {
    if (!window.confirm('Remove ' + p.name + ' from this file? Use Notice of change instead if a firm was replaced.')) return;
    w.save(legacyFromParties(parties.filter((x) => x.id !== p.id), c), 'Party removed: ' + p.name);
  };

  return (
    <Card>
      <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Parties</strong><span style={css(S.sub)}>Used in letters, court papers and the conflict check</span></div>
      {addP && (
        <div style={css(S.formGrid(200))}>
          <strong style={css('grid-column:1/-1;font-size:13px;color:#16223A')}>{T[addP][1].replace('+ ', '')}</strong>
          <Field label="Name"><input list={addP === 'client' ? 'wf-client-names' : undefined} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={css(S.input)} /></Field>
          <Field label="Role"><input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder={T[addP][2]} style={css(S.input)} /></Field>
          {addP !== 'solicitor' && <Field label="IC / company no."><input value={f.idNo} onChange={(e) => setF({ ...f, idNo: e.target.value })} style={css(S.input)} /></Field>}
          <Field label={addP === 'solicitor' ? 'Counsel & contact' : 'Contact'}><input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} style={css(S.input)} /></Field>
          <datalist id="wf-client-names">{clients.map((x) => <option key={x.id} value={x.name} />)}</datalist>
          <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => setAddP('')} style={css(S.btnSec)}>Cancel</button><button type="button" onClick={saveP} style={css(S.btnPri)}>Save</button></div>
        </div>
      )}
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))')}>
        {(Object.keys(T) as MatterParty['side'][]).map((k) => {
          const rows = parties.filter((p) => p.side === k);
          return (
            <div key={k} style={css('display:flex;flex-direction:column;min-width:0;border-top:1px solid #F0F2F5;border-right:1px solid #F0F2F5')}>
              <div style={css('display:flex;align-items:center;gap:8px;padding:10px 16px;flex-wrap:wrap')}>
                <span style={css(S.label)}>{T[k][0]}</span>
                {!ro && (
                  <div style={css('margin-left:auto;display:flex;gap:6px')}>
                    {k === 'solicitor' && <button type="button" onClick={() => { w.setCourtChange('sol'); w.setTab('court'); }} style={css(S.btnSm)}>Notice of change</button>}
                    <button type="button" onClick={() => setAddP(k)} style={css(S.btnSm)}>{T[k][1]}</button>
                  </div>
                )}
              </div>
              {rows.map((p) => {
                const gone = !!p.dischargedOn;
                const pill = gone ? P.n : k === 'client' ? P.b : k === 'opposing' ? P.r : P.a;
                const sub = [p.idNo, p.contact || [p.phone, p.email].filter(Boolean).join(' · '), p.since && k === 'solicitor' ? 'since ' + fmt(p.since) : ''].filter(Boolean).join(' · ');
                return (
                  <div key={p.id} className="group" style={css('display:flex;flex-direction:column;gap:3px;padding:9px 16px;border-top:1px solid #F0F2F5')}>
                    <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
                      <strong style={css(`font-size:13px;color:${gone ? '#4A5468' : '#16223A'};text-decoration:${gone ? 'line-through' : 'none'}`)}>{p.name}</strong>
                      <span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{gone ? 'Discharged ' + short(p.dischargedOn) : p.role}</span>
                      {!ro && !gone && <button type="button" onClick={() => remove(p)} title="Remove from file" className="opacity-0 group-hover:opacity-100" style={css('margin-left:auto;border:0;background:none;cursor:pointer;color:#94A3B8;font-size:12px')}>✕</button>}
                    </div>
                    {sub && <span style={css('font-size:12px;color:#4A5468')}>{sub}</span>}
                  </div>
                );
              })}
              {!rows.length && <div style={css('padding:9px 16px;border-top:1px solid #F0F2F5;font-size:12px;color:#94A3B8')}>None recorded</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const ClientUpdatesCard: React.FC<{ w: WF }> = ({ w }) => {
  const { c, parties, ro } = w;
  const [openI, setOpenI] = useState<number | null>(null);
  const auto = c.clientUpdatesAuto !== false;
  const first = parties.find((p) => p.side === 'client' && !p.dischargedOn);
  const ups = [...(c.clientUpdates || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  const [busy, setBusy] = useState('');
  const how = auto
    ? 'an update is prepared when you change the case status, or when a court memo sets the next court date. It is e-mailed straight away if you are signed in to Gmail; otherwise press Send by e-mail / Open WhatsApp on the update. Use + Send update for anything else.'
    : 'auto-send is off. Nothing is prepared or sent until you press + Send update.';
  const pending = ups.filter((u) => u.deliveryStatus === 'Prepared — not sent').length;
  return (
    <Card>
      <div style={css(S.head)}>
        <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Client updates</strong>
        <div style={css('margin-left:auto;display:flex;align-items:center;gap:10px')}>
          <Toggle on={auto} disabled={ro} onClick={() => { w.save({ clientUpdatesAuto: !auto }, auto ? 'Client updates: auto-send off' : 'Client updates: auto-send on'); w.toast(auto ? 'Auto-send off. Updates go out only when you send them' : 'Auto-send on'); }}>Auto-send</Toggle>
          {!ro && <button type="button" onClick={w.openWeekly} style={css('border:0;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>+ Send update</button>}
        </div>
      </div>
      <div style={css('display:flex;flex-direction:column;gap:6px;padding:10px 16px;background:#F6F8FA;border-bottom:1px solid #EEF1F5;font-size:12px;color:#4A5468;line-height:1.5')}>
        <span><strong style={css('color:#16223A')}>How it works:</strong> {how}</span>
        <span>To <strong style={css('color:#16223A')}>{first?.name || 'the client'}</strong>{first ? ` · e-mail ${first.email || 'none on file'} · WhatsApp ${first.phone || 'no number'}` : ''}. E-mail goes from your Gmail; WhatsApp opens a chat with the message for you to press Send. Change contacts in Parties.</span>
        {pending > 0 && <span style={css('color:#8A6D3B;font-weight:700')}>{pending} update{pending > 1 ? 's' : ''} prepared but not sent yet. Open {pending > 1 ? 'them' : 'it'} below to send.</span>}
      </div>
      {ups.slice(0, 5).map((u, i) => {
        const isOpen = openI === i;
        const trig = u.trigger === 'AUTO_STATUS' ? 'AUTO · STATUS' : u.trigger === 'AUTO_COURT_DATE' ? 'AUTO · COURT DATE' : u.trigger === 'MANUAL_STATUS' ? 'MANUAL · STATUS' : 'MANUAL';
        const tp = u.trigger.startsWith('MANUAL') ? { bg: '#EEF1F5', fg: '#4A5468' } : { bg: '#E4ECF5', fg: '#2F4F7A' };
        return (
          <div key={u.id} style={css('border-top:1px solid #F0F2F5')}>
            <button type="button" onClick={() => setOpenI(isOpen ? null : i)} style={css(`width:100%;display:flex;flex-direction:column;gap:3px;padding:9px 16px;border:0;background:${isOpen ? '#F6F8FA' : '#fff'};text-align:left;cursor:pointer;font-family:inherit;font-size:12.5px`)}>
              <div style={css('display:flex;gap:8px;align-items:center;width:100%')}><span style={css(`padding:1px 7px;border-radius:9px;font-size:10.5px;font-weight:800;background:${tp.bg};color:${tp.fg}`)}>{trig}</span><strong style={css('color:#16223A')}>{u.title}</strong><span style={css('margin-left:auto;color:#4A5468;font-size:11.5px')}>{short(u.at)}</span></div>
              <span style={css('color:#4A5468')}>{u.channels.map((x) => (x === 'whatsapp' ? 'WhatsApp' : 'e-mail')).join(' + ')} · <span style={css(`color:${u.deliveryStatus === 'Prepared — not sent' ? '#8A6D3B' : '#1F5A3B'};font-weight:700`)}>{u.deliveryStatus}</span>{u.emailError && !u.emailSentAt ? <span style={css('color:#8E2A20')}> · last e-mail failed</span> : null} · {isOpen ? 'Hide message' : 'View message'}</span>
            </button>
            {isOpen && (
              <div style={css('margin:0 16px 12px;display:flex;flex-direction:column;gap:8px')}>
                <div style={css('padding:10px 12px;border-radius:10px 10px 10px 2px;background:#E6EFE9;font-size:12.5px;color:#16223A;line-height:1.55;white-space:pre-line')}>{u.message}</div>
                <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
                  {!ro && first?.email && <button type="button" disabled={busy === u.id} onClick={async () => { setBusy(u.id); await emailUpdate(w, u, first.email || ''); setBusy(''); }} style={css(S.btnSm + (busy === u.id ? ';opacity:.5' : ''))}>{busy === u.id ? 'Sending…' : u.emailSentAt ? 'Send e-mail again' : 'Send by e-mail'}</button>}
                  {!ro && first?.phone && <button type="button" onClick={() => whatsappUpdate(w, u, first.phone)} style={css(S.btnSm)}>Open WhatsApp</button>}
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(u.message).then(() => w.toast('Message copied'), () => w.toast('Could not copy')); }} style={css(S.btnSm)}>Copy message</button>
                  {u.emailSentAt && <span style={css('font-size:11.5px;color:#4A5468;align-self:center')}>E-mailed {short(u.emailSentAt)} to {u.emailTo}</span>}
                  {u.emailError && !u.emailSentAt && <span style={css('font-size:11.5px;color:#8E2A20;align-self:center')}>{u.emailError}</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!ups.length && <div style={css('padding:12px 16px;border-top:1px solid #F0F2F5;font-size:12.5px;color:#4A5468')}>No client updates yet.</div>}
    </Card>
  );
};

export const OverviewTab: React.FC<{ w: WF }> = ({ w }) => {
  const { c, staff } = w;
  const court = courtOf(c);
  const upcoming = (c.hearings || []).filter((h) => daysFrom(h.date) >= 0 && h.status !== 'Cancelled' && h.status !== 'Completed').sort((a, b) => (a.date > b.date ? 1 : -1));
  const nh = upcoming[0];
  const open = (c.tasks || []).filter((t) => !isDone(t)).sort((a, b) => ((a.dueDate || '9') > (b.dueDate || '9') ? 1 : -1));
  return (
    <>
      <PartiesCard w={w} />
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;align-items:start')}>
        <div style={css('display:flex;flex-direction:column;gap:16px;min-width:0')}>
          <Card>
            <div style={css('padding:12px 16px;border-bottom:1px solid #EEF1F5;' + S.title)}>Next court date</div>
            <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:4px')}>
              <span style={css('font-size:22px;font-weight:800;color:#16223A')}>{nh ? fmt(nh.date) : 'None set'}</span>
              {nh && <span style={css('font-size:13px;color:#16223A')}>{nh.purpose}</span>}
              <span style={css('font-size:12px;color:#4A5468')}>{nh ? [nh.time, court.name, 'Client attendance: ' + (nh.clientAttendanceRequired || 'Not required')].filter(Boolean).join(' · ') : 'Add hearings in the Court tab, or record a court memo with the next date.'}</span>
            </div>
          </Card>
          <ClientUpdatesCard w={w} />
        </div>
        <Card>
          <div style={css('display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><span style={css(S.title)}>Tasks &amp; deadlines</span><button type="button" onClick={() => w.setTab('tasks')} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:12px;font-weight:700;color:#2F4F7A;cursor:pointer;font-family:inherit')}>All tasks →</button></div>
          {open.slice(0, 5).map((t) => {
            const av = avatarOf(staff, t.assignedTo);
            const n = daysFrom(t.dueDate);
            return (
              <button key={t.id} type="button" onClick={() => w.openTask(t)} style={css('width:100%;display:flex;align-items:center;gap:10px;padding:9px 16px;border:0;border-top:1px solid #F0F2F5;background:#fff;font-size:12.5px;text-align:left;cursor:pointer;font-family:inherit')}>
                {isDeadline(t) && <span style={css('padding:1px 7px;border-radius:9px;font-size:10.5px;font-weight:800;background:#F6E4E1;color:#8E2A20')}>DEADLINE</span>}
                <span style={css('flex:1;min-width:0;color:#16223A')}>{t.title}</span>
                <span style={css(`color:${t.dueDate && n <= 7 ? '#8E2A20' : '#4A5468'};white-space:nowrap`)}>{av.name.split(' ')[0]} · {t.dueDate ? short(t.dueDate) : 'No date'}</span>
              </button>
            );
          })}
          {!open.length && <div style={css('padding:12px 16px;font-size:12.5px;color:#4A5468')}>No open tasks or deadlines on this file.</div>}
        </Card>
      </div>
    </>
  );
};
