import React, { useState } from 'react';
import { SearchSelect } from '../../../ui/SearchSelect';
import { useApp } from '../../../../context/AppContext';
import type { ServiceRecord } from '../../../../types';
import { matterDriveLabel, openStoredFile, useStorageLabel, type StoredMatterFile } from '../../../../services/fileStorageService';
import { css, S, Card, Field, Seg } from '../caseUi';
import { METHODS, P, PROOF_TYPES, actionOf, courtOf, daysFrom, fmt, hasProof, isoOf, proofTypeFor, todayIso } from '../caseModel';
import { addServicePatch, newServiceRecord, uploadServiceProof, withProof } from '../serviceModel';
import type { WF } from '../wf';

/** View id of the firm-wide Service Log page (built separately). */
const SERVICE_LOG_VIEW = 'serviceLog';

export const FilingTab: React.FC<{ w: WF }> = ({ w }) => {
  const { setCurrentView } = useApp();
  const { c, parties, ro } = w;
  const storage = useStorageLabel();
  const recs = c.serviceRecord || [];
  const filings = recs.filter((r) => actionOf(r) === 'Filed');
  const service = recs.filter((r) => actionOf(r) !== 'Filed');
  const [sub, setSub] = useState<'filing' | 'service'>('filing');
  const [open, setOpen] = useState(false);
  const court = courtOf(c);
  const firstSol = parties.find((p) => p.side === 'solicitor' && !p.dischargedOn)?.name || '';
  const blank = (dir: ServiceRecord['action']) => ({ dir, date: todayIso(), doc: '', party: dir === 'Filed' ? court.name : firstSol, method: dir === 'Filed' ? 'e-Filing (CMS)' : 'By hand', by: w.me, proofType: '', notes: '' });
  const [f, setF] = useState(blank('Filed'));
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const pt = f.proofType || proofTypeFor(f.dir || 'Served', f.method);

  const switchSub = (k: string) => { setSub(k as 'filing' | 'service'); setF(blank(k === 'filing' ? 'Filed' : 'Served')); setPicked(null); };

  const saveS = async () => {
    if (!f.doc.trim()) { w.toast('Add the document'); return; }
    let stored: StoredMatterFile | null = null;
    if (picked) {
      setBusy('save');
      try { stored = await uploadServiceProof(c, picked, f.dir || 'Served', w.me); } catch (e) { setBusy(''); w.toast('Proof not uploaded: ' + (e instanceof Error ? e.message : String(e))); return; }
      setBusy('');
    }
    const row = newServiceRecord({ ...f, dir: f.dir || 'Served', proofType: pt }, stored, w.me);
    const { patch, hit } = addServicePatch(c, row, w.me);
    w.save(patch);
    setPicked(null);
    setF(blank(f.dir));
    setOpen(false);
    w.toast((stored ? 'Saved with proof. ' + storage : 'Saved. Proof marked as missing') + (hit ? '. Deadline "' + hit.title + '" ticked off' : ''));
  };

  const uploadFor = async (r: ServiceRecord, file: File) => {
    setBusy(r.id);
    try {
      const stored = await uploadServiceProof(c, file, actionOf(r), w.me);
      w.save({ serviceRecord: withProof(c, r, stored) }, 'Proof uploaded for ' + r.documentServed, 'Document Upload');
      w.toast('Proof saved. ' + storage);
    } catch (e) {
      w.toast('Proof not uploaded: ' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  const rows = (sub === 'filing' ? filings : service).slice().sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? 1 : -1));
  const cols = 'display:grid;grid-template-columns:100px 90px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 180px;min-width:920px;';
  return (
    <Card style="overflow-x:auto">
      <div style={css(S.head)}>
        <Seg items={[['filing', 'Filing (' + filings.length + ')'], ['service', 'Service (' + service.length + ')']]} value={sub} onChange={switchSub} />
        <span style={css(S.sub)}>{sub === 'filing' ? 'Cause papers filed in court, with sealed copy or CMS receipt' : 'Served and received. Same entries as the firm Service Log'}</span>
        <div style={css('margin-left:auto;display:flex;gap:8px')}>
          {sub === 'service' && <button type="button" onClick={() => setCurrentView(SERVICE_LOG_VIEW)} style={css(S.btnSec)}>Firm service log →</button>}
          {!ro && <button type="button" onClick={() => setOpen(!open)} style={css(S.btnPri)}>{sub === 'filing' ? '+ Log filing' : '+ Log service'}</button>}
        </div>
      </div>
      {open && (
        <div style={css(S.formGrid(170))}>
          {sub === 'service' && (
            <div style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>What happened</span>
              <div style={css('display:flex;gap:4px')}>{(['Served', 'Received'] as const).map((k) => { const on = f.dir === k; return <button key={k} type="button" onClick={() => setF({ ...f, dir: k })} style={css(`flex:1;border:1px solid ${on ? '#16223A' : '#C9D1DC'};border-radius:8px;padding:8px 10px;font-size:12.5px;font-weight:700;background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'};cursor:pointer;font-family:inherit`)}>{k}</button>; })}</div>
            </div>
          )}
          <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={css(S.input)} /></Field>
          <Field label="Document" span="span 2"><input value={f.doc} onChange={(e) => setF({ ...f, doc: e.target.value })} placeholder="e.g. Affidavit in reply" style={css(S.input)} /></Field>
          <Field label={f.dir === 'Filed' ? 'Court' : f.dir === 'Served' ? 'Served on' : 'Received from'}><input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} placeholder="Party / solicitor" style={css(S.input)} /></Field>
          <Field label="Method"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value, proofType: '' })} style={css(S.input)}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          <Field label={f.dir === 'Filed' ? 'Filed by' : f.dir === 'Served' ? 'Served by' : 'Received by'}><SearchSelect aria-label="Done by" value={f.by} onChange={(v) => setF({ ...f, by: v })} placeholder="Search a name" options={[...w.staff.map((p) => ({ value: p.name, label: p.name, hint: p.code })), { value: 'Despatch', label: 'Despatch / runner' }]} /></Field>
          <Field label="Proof type"><select value={pt} onChange={(e) => setF({ ...f, proofType: e.target.value })} style={css(S.input)}>{PROOF_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <div style={css('display:flex;flex-direction:column;gap:5px;grid-column:span 2')}><span style={css(S.label)}>Proof file</span>
            <label style={css('display:flex;align-items:center;gap:10px;border:1px dashed #9AA6B8;border-radius:8px;padding:8px 10px;background:#fff;cursor:pointer;min-width:0')}>
              <input type="file" accept="image/*,.pdf" onChange={(e) => { setPicked(e.target.files?.[0] || null); e.target.value = ''; }} style={css('display:none')} />
              <span style={css('flex-shrink:0;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;background:#EEF1F5;color:#16223A')}>Choose file</span>
              <span style={css(`font-size:12.5px;color:${picked ? '#16223A' : '#4A5468'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>{picked ? picked.name : f.method === 'AR Registered post' ? 'No file yet. You can upload the AR card when it comes back.' : 'AR card, chop, e-mail or CMS receipt (image or PDF)'}</span>
            </label>
            <span style={css('font-size:11px;color:#4A5468')}>{storage.replace('Saved to', 'Goes to')}{storage.includes('Drive') ? ' › ' + matterDriveLabel(c) + ' › Court Papers' : ''}</span>
          </div>
          <Field label="Notes" span="1/-1"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. Affidavit of service filed, stamped copy on file" style={css(S.input)} /></Field>
          <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}><button type="button" onClick={() => setOpen(false)} style={css(S.btnSecL)}>Cancel</button><button type="button" disabled={busy === 'save'} onClick={saveS} style={css(S.btnPriL + (busy === 'save' ? ';opacity:.5' : ''))}>{busy === 'save' ? 'Uploading…' : 'Save to log'}</button></div>
        </div>
      )}
      <div style={css(cols + S.th)}><span>Date</span><span>Action</span><span>Document</span><span>{sub === 'filing' ? 'Court' : 'Party'}</span><span>Method · by</span><span>Proof</span></div>
      {rows.map((r) => {
        const a = actionOf(r);
        const pill = a === 'Filed' ? P.g : a === 'Served' ? P.b : P.n;
        const has = hasProof(r);
        const age = Math.max(0, -daysFrom(r.date));
        const wait = a === 'Filed' ? 'Upload sealed copy' : r.method === 'AR Registered post' ? 'Waiting for AR card · ' + age + ' day' + (age === 1 ? '' : 's') : r.proofObtained === 'Y' ? 'Proof marked obtained, no copy saved' : 'No proof saved';
        return (
          <div key={r.id} style={css(cols + 'align-items:start;' + S.row)}>
            <strong style={css('color:#16223A')}>{fmt(r.date)}</strong>
            <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${pill.bg};color:${pill.fg}`)}>{a}</span>
            <div style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('color:#16223A;font-weight:600')}>{r.documentServed}</span>{r.notes && <span style={css('color:#4A5468')}>{r.notes}</span>}</div>
            <span style={css('color:#16223A')}>{r.servedOn || '—'}</span>
            <span style={css('color:#16223A')}>{r.method} · {r.servedBy || '—'}</span>
            <div style={css('display:flex;flex-direction:column;gap:3px;min-width:0')}>
              {has ? (
                <>
                  <button type="button" onClick={async () => { const err = await openStoredFile({ driveFileId: r.driveFileId, webViewLink: r.webViewLink, path: r.storagePath }); if (err) w.toast(err); }} style={css('border:0;background:none;padding:0;text-align:left;font-weight:600;color:#1F5A3B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12.5px;text-decoration:underline')}>{r.proofFileName || 'Proof'}</button>
                  <span style={css('font-size:11.5px;color:#4A5468')}>{r.proofType || proofTypeFor(a, r.method)}</span>
                </>
              ) : (
                <>
                  {!ro && (
                    <label style={css(`justify-self:start;align-self:start;display:inline-flex;border:1px solid #8E2A20;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;background:#fff;color:#8E2A20;cursor:pointer;opacity:${busy === r.id ? 0.5 : 1}`)}>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadFor(r, file); }} style={css('display:none')} />
                      {busy === r.id ? 'Uploading…' : 'Upload proof'}
                    </label>
                  )}
                  <span style={css('font-size:11.5px;color:#8E2A20')}>{wait}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
      {!rows.length && <div style={css(S.empty)}>{sub === 'filing' ? 'No filings logged on this file yet.' : 'Nothing served or received on this file yet.'}</div>}
    </Card>
  );
};
