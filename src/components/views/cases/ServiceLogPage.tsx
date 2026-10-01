import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, ServiceRecord } from '../../../types';
import { identityTokens, isMine } from '../../../lib/identity';
import { openStoredFile, useStorageLabel, type StoredMatterFile } from '../../../services/fileStorageService';
import { css, S, Card, Field } from './caseUi';
import { METHODS, P, actionOf, daysFrom, fmt, hasProof, isoOf, partiesOf, proofTypeFor, staffOf, todayIso } from './caseModel';
import { addServicePatch, newServiceRecord, uploadServiceProof, withProof } from './serviceModel';
import { histEntry } from './wf';

type Dir = 'Served' | 'Received';
type CardKey = '' | 'missing' | 'ar' | 'week';
interface Row { r: ServiceRecord; c: Case; a: Dir; age: number; has: boolean }

const ageOf = (d: string) => -daysFrom(d);
const missing = (x: Row) => !x.has;
const arLate = (x: Row) => !x.has && x.r.method === 'AR Registered post' && x.age > 14;
const thisWeek = (x: Row) => x.age <= 7;
const CF: Record<Exclude<CardKey, ''>, [string, (x: Row) => boolean]> = { missing: ['No proof yet', missing], ar: ['AR card overdue', arLate], week: ['This week', thisWeek] };
const cols = 'display:grid;grid-template-columns:96px 200px 84px minmax(0,1.3fr) minmax(0,1fr) 190px;min-width:980px;gap:12px;';

/**
 * Firm Service Log (design: Firm Service Log.dc.html). Served / received entries across every
 * file the viewer can see — the same Case.serviceRecord entries as each file's Filing & service ›
 * Service tab. Filing stays on the file.
 */
export const ServiceLogPage: React.FC = () => {
  const { cases = [], clients = [], users = [], currentUser, currentRole, isAdmin, updateCase, showToast, setCurrentView, setCurrentCaseId, setCaseSubTab } = useApp();
  const storage = useStorageLabel();
  const staff = useMemo(() => staffOf(users), [users]);
  const me = currentUser?.name || '';
  const firmAdmin = Boolean(isAdmin || currentUser?.isSuperAdmin);
  // Partner / admin and Assistant (the design's "Clerk") see every file; a Lawyer sees files they're on.
  const seeAll = firmAdmin || currentRole === 'Partner' || currentRole === 'Assistant';
  const tokens = useMemo(() => {
    const t = identityTokens(currentUser);
    if (currentUser?.code) t.add(currentUser.code.toLowerCase());
    return t;
  }, [currentUser]);
  const onFileTeam = (c: Case) => isMine(c.lawyerInCharge, tokens) || isMine(c.lawyers || [], tokens) || isMine(c.partners || [], tokens);
  const files = useMemo(() => cases.filter((c) => seeAll || onFileTeam(c)), [cases, seeAll, tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  const casesRef = useRef(cases);
  casesRef.current = cases;
  const latest = (id: string) => (casesRef.current || []).find((x) => x.id === id);
  const toast = (m: string) => setTimeout(() => showToast(m), 0);

  const [act, setAct] = useState<'All' | Dir>('All');
  const [q, setQ] = useState('');
  const [byF, setByF] = useState('');
  const [card, setCard] = useState<CardKey>('');
  const [add, setAdd] = useState(false);
  const [busy, setBusy] = useState('');
  const [picked, setPicked] = useState<File | null>(null);
  const openFiles = files.filter((c) => c.status !== 'Closed' && c.status !== 'Archive');
  const blank = () => ({ file: '', dir: 'Served' as Dir, date: todayIso(), doc: '', party: '', method: 'By hand', by: me });
  const [fx, setFx] = useState(blank);
  // View-as / sign-in switch: the form follows the new viewer.
  useEffect(() => { setFx(blank()); setPicked(null); setAdd(false); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const all: Row[] = useMemo(() => files.flatMap((c) => (c.serviceRecord || []).filter((r) => actionOf(r) !== 'Filed').map((r) => ({ r, c, a: actionOf(r) as Dir, age: ageOf(r.date), has: hasProof(r) }))), [files]);
  const people = Array.from(new Set(all.map((x) => (x.r.servedBy || '').trim()).filter(Boolean))).sort();

  let list = all.filter((x) => (act === 'All' || x.a === act) && (!byF || (x.r.servedBy || '').trim() === byF));
  if (card) list = list.filter(CF[card][1]);
  const ql = q.trim().toLowerCase();
  if (ql) list = list.filter((x) => [x.r.documentServed, x.r.servedOn, x.c.title, x.c.ref, x.r.notes].join(' ').toLowerCase().includes(ql));
  list = [...list].sort((a, b) => { const da = isoOf(a.r.date), db = isoOf(b.r.date); return da < db ? 1 : da > db ? -1 : 0; });

  const cardBtn = (k: CardKey, label: string, n: number, sub: string, fg: string) => ({ k, label, n, sub, fg, bd: k && card === k ? '2px solid #16223A' : '1px solid #DDE3EB', go: () => (k ? setCard(card === k ? '' : k) : (setCard(''), setAct('All'), setByF(''), setQ(''))) });
  const cards = [
    cardBtn('missing', 'No proof yet', all.filter(missing).length, 'Served or received, nothing uploaded', '#8E2A20'),
    cardBtn('ar', 'AR card overdue', all.filter(arLate).length, 'Posted more than 14 days ago', '#8A6D3B'),
    cardBtn('week', 'This week', all.filter(thisWeek).length, 'Entries in the last 7 days', '#16223A'),
    cardBtn('', 'Total entries', all.length, 'Across ' + new Set(all.map((x) => x.c.id)).size + ' file' + (new Set(all.map((x) => x.c.id)).size === 1 ? '' : 's'), '#16223A'),
  ];

  const openCase = (c: Case) => { setCaseSubTab('service'); setCurrentCaseId(c.id); setCurrentView('cases'); };

  // ---- add entry (pick the file first) — same write path as the file's Filing & service tab
  const selFile = openFiles.find((c) => c.id === fx.file);
  const firstSol = (c?: Case) => (c ? partiesOf(c, clients).find((p) => p.side === 'solicitor' && !p.dischargedOn)?.name || '' : '');
  const pt = proofTypeFor(fx.dir, fx.method);
  const byOpts = Array.from(new Set([me, ...staff.map((p) => p.name)].filter(Boolean)));
  const toggleAdd = () => { setAdd(!add); if (add) { setPicked(null); setFx(blank()); } };

  const save = async () => {
    if (!selFile) { toast('Pick the file first'); return; }
    if (!fx.doc.trim()) { toast('Add the document'); return; }
    let stored: StoredMatterFile | null = null;
    if (picked) {
      setBusy('save');
      try { stored = await uploadServiceProof(selFile, picked, fx.dir, me); } catch (e) { setBusy(''); toast('Proof not uploaded: ' + (e instanceof Error ? e.message : String(e))); return; }
      setBusy('');
    }
    const c = latest(selFile.id) || selFile;
    const row = newServiceRecord({ dir: fx.dir, date: fx.date, doc: fx.doc, party: fx.party.trim() || firstSol(c), method: fx.method, by: fx.by, proofType: pt, notes: '' }, stored, me);
    updateCase(c.id, addServicePatch(c, row, me).patch);
    setPicked(null);
    setFx({ ...fx, doc: '', party: '' });
    setAdd(false);
    toast('Saved to ' + c.ref + (stored ? ' with proof. ' + storage : '. Proof marked as missing'));
  };

  const uploadFor = async (x: Row, file: File) => {
    setBusy(x.r.id);
    try {
      const stored = await uploadServiceProof(x.c, file, x.a, me);
      const c = latest(x.c.id) || x.c;
      updateCase(c.id, { serviceRecord: withProof(c, x.r, stored), activityLogs: [histEntry('Proof uploaded for ' + x.r.documentServed, me, 'Document Upload'), ...(c.activityLogs || [])] });
      toast('Proof saved to ' + c.ref + '. ' + storage);
    } catch (e) {
      toast('Proof not uploaded: ' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  const roleWord = firmAdmin || currentRole === 'Partner' ? 'Partner' : currentRole === 'Assistant' ? 'Clerk' : currentRole || 'Staff';
  const pill = (a: Dir) => (a === 'Served' ? P.b : P.n);

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12.5px;color:#16223A')}>
      <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <span style={css('font-size:13px;color:#4A5468')}>Entries here also show in each file's Filing & service › Service tab, and the other way round.</span>
        <span style={css('margin-left:auto;font-size:12px;color:#4A5468')}>Viewing as <strong style={css('color:#16223A')}>{me ? me + ' (' + roleWord + ')' : roleWord}: {seeAll ? 'all files' : 'own files'}</strong></span>
        <button type="button" onClick={toggleAdd} style={css('border:0;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>+ Add entry</button>
      </div>

      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px')}>
        {cards.map((k) => (
          <button key={k.label} type="button" onClick={k.go} style={css(`display:flex;flex-direction:column;gap:6px;text-align:left;padding:14px 16px;border-radius:12px;background:#fff;cursor:pointer;font-family:inherit;border:${k.bd}`)}>
            <span style={css(S.label)}>{k.label}</span>
            <strong style={css(`font-size:24px;color:${k.fg}`)}>{k.n}</strong>
            <span style={css('font-size:12px;color:#4A5468')}>{k.sub}</span>
          </button>
        ))}
      </div>

      {add && (
        <Card>
          <div style={css('padding:12px 16px;border-bottom:1px solid #EEF1F5;font-family:Georgia, serif;font-size:15px;font-weight:700;color:#16223A')}>New entry</div>
          {!openFiles.length ? (
            <div style={css(S.empty)}>{files.length ? 'All your files are closed. Reopen a file to log service on it.' : seeAll ? 'No files yet. Open a file in Cases first.' : 'No files assigned to you yet.'}</div>
          ) : (
            <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;padding:16px')}>
              <Field label="File" span="span 2">
                <select value={fx.file} onChange={(e) => setFx({ ...fx, file: e.target.value, party: '' })} style={css(S.input)}>
                  <option value="">Pick the file…</option>
                  {openFiles.map((c) => <option key={c.id} value={c.id}>{c.title + ' · ' + c.ref}</option>)}
                </select>
              </Field>
              <div style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>What happened</span>
                <div style={css('display:flex;gap:4px')}>{(['Served', 'Received'] as const).map((k) => { const on = fx.dir === k; return <button key={k} type="button" onClick={() => setFx({ ...fx, dir: k })} style={css(`flex:1;border-radius:8px;padding:8px 6px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'};border:1px solid ${on ? '#16223A' : '#C9D1DC'}`)}>{k}</button>; })}</div>
              </div>
              <Field label="Date"><input type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} style={css(S.input)} /></Field>
              <Field label="Document" span="span 2"><input value={fx.doc} onChange={(e) => setFx({ ...fx, doc: e.target.value })} placeholder="e.g. Affidavit in reply (Encl. 18)" style={css(S.input)} /></Field>
              <Field label={fx.dir === 'Served' ? 'Served on' : 'Received from'}><input value={fx.party} onChange={(e) => setFx({ ...fx, party: e.target.value })} placeholder={firstSol(selFile) || 'Party / solicitor'} style={css(S.input)} /></Field>
              <Field label="Method"><select value={fx.method} onChange={(e) => setFx({ ...fx, method: e.target.value })} style={css(S.input)}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
              <Field label={fx.dir === 'Served' ? 'Served by' : 'Received by'}><select value={fx.by} onChange={(e) => setFx({ ...fx, by: e.target.value })} style={css(S.input)}>{byOpts.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
              <div style={css('display:flex;flex-direction:column;gap:5px;grid-column:span 2')}><span style={css(S.label)}>Proof ({pt})</span>
                <label style={css('display:flex;align-items:center;gap:10px;border:1px dashed #9AA6B8;border-radius:8px;padding:8px 10px;background:#fff;cursor:pointer;min-width:0')}>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => { setPicked(e.target.files?.[0] || null); e.target.value = ''; }} style={css('display:none')} />
                  <span style={css('flex-shrink:0;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;background:#EEF1F5;color:#16223A')}>Choose file</span>
                  <span style={css(`font-size:12.5px;color:${picked ? '#16223A' : '#4A5468'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>{picked ? picked.name : 'Image or PDF. You can also upload it later.'}</span>
                </label>
                {selFile && <span style={css('font-size:11px;color:#4A5468')}>{storage.replace('Saved to', 'Goes to')}{storage.includes('Drive') ? ' › Matters › ' + selFile.ref.replace(/\//g, '-') + ' › Service' : ''}</span>}
              </div>
              <div style={css('grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px')}>
                <button type="button" onClick={toggleAdd} style={css(S.btnSecL)}>Cancel</button>
                <button type="button" disabled={busy === 'save'} onClick={save} style={css(S.btnPriL + (busy === 'save' ? ';opacity:.5' : ''))}>{busy === 'save' ? 'Uploading…' : 'Save to log'}</button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card style="overflow-x:auto">
        <div style={css('display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #EEF1F5;flex-wrap:wrap;min-width:980px')}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search document, file, party…" style={css('flex:1;min-width:220px;max-width:340px;border:1px solid #C9D1DC;border-radius:8px;padding:8px 11px;font-size:13px;color:#16223A;background:#fff;font-family:inherit')} />
          <div style={css('display:flex;gap:4px;padding:3px;border-radius:9px;background:#F6F8FA;border:1px solid #DDE3EB')}>
            {(['All', 'Served', 'Received'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setAct(k)} style={css(`border:0;border-radius:7px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${act === k ? '#16223A' : 'transparent'};color:${act === k ? '#fff' : '#4A5468'}`)}>{k}</button>
            ))}
          </div>
          <select value={byF} onChange={(e) => setByF(e.target.value)} style={css('border:1px solid #C9D1DC;border-radius:8px;padding:8px 10px;font-size:12.5px;color:#16223A;background:#fff;font-family:inherit')}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {card && <button type="button" onClick={() => setCard('')} style={css('border:0;border-radius:14px;padding:5px 11px;font-size:12px;font-weight:700;background:#F6EEDC;color:#8A6D3B;cursor:pointer;font-family:inherit')}>{CF[card][0]} ✕</button>}
          <span style={css('margin-left:auto;font-size:12px;color:#4A5468')}>{list.length} of {all.length} entries</span>
        </div>
        <div style={css(cols + 'padding:8px 16px;background:#F6F8FA;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468')}><span>Date</span><span>File</span><span>Action</span><span>Document · party</span><span>Method · by</span><span>Proof</span></div>
        {list.map((x) => {
          const { r, c, a } = x;
          const ro = c.status === 'Closed' || c.status === 'Archive';
          const age = Math.max(0, x.age);
          const wait = r.method === 'AR Registered post' ? 'Waiting for AR card · ' + age + ' day' + (age === 1 ? '' : 's') : r.proofObtained === 'Y' ? 'Proof marked obtained, no copy saved' : 'Upload acknowledgement';
          const tone = pill(a);
          return (
            <div key={c.id + ':' + r.id} style={css(cols + 'align-items:start;padding:11px 16px;border-top:1px solid #F0F2F5;font-size:12.5px')}>
              <strong style={css('color:#16223A')}>{fmt(r.date)}</strong>
              <button type="button" onClick={() => openCase(c)} title="Open this file" style={css('display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;border:0;background:none;padding:0;cursor:pointer;font-family:inherit')}>
                <span style={css('font-family:ui-monospace, monospace;font-size:11px;color:#8A6D3B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%')}>{c.ref}</span>
                <span style={css('color:#16223A;font-weight:600;font-size:12.5px')}>{c.title}</span>
              </button>
              <span style={css(`justify-self:start;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${tone.bg};color:${tone.fg}`)}>{a}</span>
              <div style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('color:#16223A;font-weight:600')}>{r.documentServed}</span><span style={css('color:#4A5468')}>{r.servedOn || '—'}</span></div>
              <div style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('color:#16223A')}>{r.method || '—'}</span><span style={css('color:#4A5468')}>{r.servedBy || '—'}</span></div>
              <div style={css('display:flex;flex-direction:column;gap:3px;min-width:0')}>
                {x.has ? (
                  <>
                    <button type="button" onClick={async () => { const err = await openStoredFile({ driveFileId: r.driveFileId, webViewLink: r.webViewLink, path: r.storagePath }); if (err) toast(err); }} style={css('border:0;background:none;padding:0;text-align:left;font-weight:600;color:#1F5A3B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12.5px;text-decoration:underline')}>{r.proofFileName || 'Proof'}</button>
                    <span style={css('font-size:11.5px;color:#4A5468')}>{r.proofType || proofTypeFor(a, r.method)}</span>
                  </>
                ) : (
                  <>
                    {!ro && (
                      <label style={css(`align-self:start;display:inline-flex;border:1px solid #8E2A20;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;background:#fff;color:#8E2A20;cursor:pointer;opacity:${busy === r.id ? 0.5 : 1}`)}>
                        <input type="file" accept="image/*,.pdf" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadFor(x, file); }} style={css('display:none')} />
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
        {!list.length && (
          <div style={css('padding:28px 16px;text-align:center;font-size:13px;color:#4A5468;min-width:980px')}>
            {all.length ? 'No entries match.' : !files.length ? (seeAll ? 'No files yet.' : 'No files assigned to you yet.') : 'Nothing served or received yet. Use + Add entry, or log it from the file’s Filing & service tab.'}
          </div>
        )}
      </Card>
    </div>
  );
};
