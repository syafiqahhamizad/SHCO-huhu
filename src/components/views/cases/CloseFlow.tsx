import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, MatterCloseCheck } from '../../../types';
import { css, S, Modal, ModalHead, Card, boxStyle } from './caseUi';
import { addDays, daysFrom, fmt, isDone, rm, todayIso } from './caseModel';
import { type WF } from './wf';

const OUTCOMES = ['Settled', 'Judgment for client', 'Judgment against client', 'Withdrawn / discontinued', 'Completed (non-court matter)', 'Client ended our retainer'];

/** Checks that the system can verify from real records. */
const systemChecks = (w: WF): MatterCloseCheck[] => {
  const { c, money } = w;
  const open = (c.tasks || []).filter((t) => !isDone(t));
  const future = (c.hearings || []).filter((h) => daysFrom(h.date) > 0 && h.status === 'Scheduled');
  const issued = money.bills.filter((b) => b.issued);
  // Bills and the client account are only known to people who see billing; for anyone else
  // the partner checks them when approving (the approval re-runs these checks live).
  const billing: MatterCloseCheck[] = !w.seeFin ? [] : [
    { label: 'Final bill', ok: issued.length > 0, detail: issued.length ? issued.length + ' bill(s) issued · ' + rm(money.billed) : 'No bill issued on this file (a partner can still approve)' },
    { label: 'Invoices paid', ok: money.outstanding <= 0.005, detail: money.outstanding > 0.005 ? rm(money.outstanding) + ' still outstanding' : 'Nothing outstanding' },
    { label: 'Client account', ok: Math.abs(money.clientBalance) <= 0.005, detail: Math.abs(money.clientBalance) > 0.005 ? rm(money.clientBalance) + ' still held for this client' : 'Balance RM 0.00' },
  ];
  return [
    { label: 'Tasks', ok: !open.length, detail: open.length ? open.length + ' open task' + (open.length > 1 ? 's' : '') + ': ' + open.slice(0, 2).map((t) => t.title).join('; ') : 'All tasks done' },
    { label: 'Court dates', ok: !future.length, detail: future.length ? future.length + ' court date(s) after today, next ' + fmt(future[0].date) : 'No court dates after today' },
    ...billing,
  ];
};

export const RequestCloseModal: React.FC<{ w: WF; onClose: () => void }> = ({ w, onClose }) => {
  const { addNotification, setCurrentView } = useApp();
  const { c, staff } = w;
  const prev = c.closeRequest;
  const prevManual = (label: string) => !!prev?.checklist.find((x) => x.label === label)?.ok;
  const [docs, setDocs] = useState(prevManual('Original documents'));
  const [letter, setLetter] = useState(prevManual('Closing letter'));
  const [outcome, setOutcome] = useState(prev?.outcome || '');
  const [note, setNote] = useState(prev?.note || '');
  const sys = systemChecks(w);
  const manual: MatterCloseCheck[] = [
    { label: 'Original documents', ok: docs, detail: docs ? 'Returned to client' : 'Return originals to the client and tick' },
    { label: 'Closing letter', ok: letter, detail: letter ? 'Closing letter sent to client' : 'Not sent yet (Letters & e-sign › Closing letter)' },
  ];
  const all = [...sys, ...manual];
  const left = all.filter((x) => !x.ok).length;
  const partnerNames = (c.partners || []).map((code) => staff.find((p) => p.code === code)?.name || code);
  const to = partnerNames.join(', ') || 'the partner in charge';
  const act: Record<string, [string, () => void] | undefined> = {
    Tasks: ['Open tasks', () => { onClose(); w.setTab('tasks'); }],
    'Court dates': ['Open court', () => { onClose(); w.setTab('court'); }],
    'Final bill': w.canOpenFin('billing') ? ['Open Billing', () => { setCurrentView('billing'); }] : undefined,
    'Invoices paid': w.canOpenFin('billing') ? ['Open Billing', () => { setCurrentView('billing'); }] : undefined,
    'Client account': w.canOpenFin('retainers') ? ['Refund in Client Account', () => { setCurrentView('retainers'); }] : undefined,
  };
  const send = () => {
    if (!outcome) { w.toast('Choose the outcome'); return; }
    w.save({ closeRequest: { status: 'Pending', requestedBy: w.me, requestedAt: todayIso(), outcome, note: note.trim() || undefined, checklist: all } }, 'Close requested · ' + outcome + (left ? ' (' + left + ' item(s) still open)' : ''), 'Status Update');
    addNotification({ title: 'Close request: ' + c.ref, message: w.me + ' asked to close ' + c.ref + ' (' + c.title + ') · ' + outcome + (left ? ' · ' + left + ' item(s) still open' : '') + '. Open the file to approve or send back.', type: 'system', linkTab: 'cases', linkId: c.id, to: ['partners:' + c.id] });
    onClose();
    w.toast(left ? 'Sent to ' + to + ' with ' + left + ' item(s) still open' : 'Close request sent to ' + to);
  };
  return (
    <Modal onClose={onClose} width={620}>
      <ModalHead title="Request to close this file" sub={'Tick what is done. ' + to + ' approves the close. The file stays open until then.'} onClose={onClose} />
      <div style={css('padding:4px 20px;display:flex;flex-direction:column;overflow:auto')}>
        {all.map((x) => {
          const manualRow = x.label === 'Original documents' || x.label === 'Closing letter';
          const a = act[x.label];
          return (
            <div key={x.label} style={css('display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid #F0F2F5')}>
              {manualRow ? <button type="button" onClick={() => (x.label === 'Original documents' ? setDocs(!docs) : setLetter(!letter))} style={boxStyle(x.ok)}>{x.ok ? '✓' : ''}</button>
                : <span style={css(`width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:12px;font-weight:800;background:${x.ok ? '#2F6F4E' : '#A35A00'};color:#fff`)}>{x.ok ? '✓' : '!'}</span>}
              <span style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:13px;font-weight:700;color:#16223A')}>{x.label}</span><span style={css(`font-size:12px;color:${x.ok ? '#4A5468' : '#8A4B00'}`)}>{x.detail}</span></span>
              {manualRow ? <span style={css('font-size:11.5px;color:#4A5468')}>Tick when done</span> : !x.ok && a ? <button type="button" onClick={a[1]} style={css(S.btnSec)}>{a[0]}</button> : <span style={css('font-size:11.5px;color:#4A5468')}>Checked by system</span>}
            </div>
          );
        })}
        <div style={css('display:grid;grid-template-columns:1fr;gap:10px;padding:12px 0')}>
          <label style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(S.label)}>Outcome</span><select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={css(S.input)}><option value="">Choose outcome</option>{OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label style={css('display:flex;flex-direction:column;gap:6px')}><span style={css(S.label)}>Note to partner</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything the partner should know" style={css(S.input + ';resize:vertical')} /></label>
        </div>
      </div>
      <div style={css('padding:14px 20px;display:flex;align-items:center;gap:10px;border-top:1px solid #EEF1F5')}>
        <span style={css(`padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:${left ? '#FFF4E5' : '#E6EFE9'};color:${left ? '#7A4300' : '#1F5A3B'}`)}>{left ? left + ' item' + (left > 1 ? 's' : '') + ' left' : 'All clear'}</span>
        <button type="button" onClick={onClose} style={css('margin-left:auto;' + S.btnSecL)}>Cancel</button>
        <button type="button" onClick={send} style={css(S.btnPriL + (outcome ? '' : ';opacity:.5'))}>Send to partner</button>
      </div>
    </Modal>
  );
};

/** Shown on the file while a close request is waiting, or after it was sent back. */
export const CloseRequestPanel: React.FC<{ w: WF; canApprove: boolean; onEdit: () => void }> = ({ w, canApprove, onEdit }) => {
  const { addNotification } = useApp();
  const { c } = w;
  const r = c.closeRequest;
  const [back, setBack] = useState('');
  if (!r || r.status === 'Approved') return null;
  if (r.status === 'Sent back') {
    return (
      <div style={css('display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;background:#FFF4E5;border:1px solid #EBC99A;font-size:12.5px;color:#7A4300;flex-wrap:wrap')}>
        <strong>Close request sent back by {r.decidedBy} on {fmt(r.decidedAt)}.</strong><span>{r.sendBackReason}</span>
        {!w.ro && <button type="button" onClick={onEdit} style={css('margin-left:auto;' + S.btnSec)}>Request again</button>}
      </div>
    );
  }
  const sys = systemChecks(w);
  const live = [...sys, ...r.checklist.filter((x) => x.label === 'Original documents' || x.label === 'Closing letter')];
  const blocked = live.some((x) => !x.ok && x.label !== 'Final bill');
  const approve = () => {
    if (blocked) { w.toast('Checklist not clear yet: send back instead'); return; }
    const today = todayIso();
    const destroy = new Date(); destroy.setFullYear(destroy.getFullYear() + 7);
    w.save({ status: 'Closed', closedDate: today, closedBy: w.me, closeOutcome: r.outcome, destroyAfter: c.destroyAfter || destroy.toISOString().slice(0, 10), closeRequest: { ...r, status: 'Approved', decidedBy: w.me, decidedAt: today, checklist: live } }, 'Close approved by ' + w.me + ' · ' + r.outcome + '. File closed', 'Status Update');
    addNotification({ title: 'File closed: ' + c.ref, message: w.me + ' approved closing ' + c.ref + ' (' + r.outcome + ').', type: 'system', linkTab: 'cases', linkId: c.id, to: ['case:' + c.id] });
    w.toast('File closed. Add the archive box details below');
  };
  const sendBack = () => {
    if (!back.trim()) { w.toast('Write the reason first'); return; }
    w.save({ closeRequest: { ...r, status: 'Sent back', decidedBy: w.me, decidedAt: todayIso(), sendBackReason: back.trim() } }, 'Close request sent back: ' + back.trim(), 'Status Update');
    addNotification({ title: 'Close request sent back: ' + c.ref, message: w.me + ': ' + back.trim(), type: 'system', linkTab: 'cases', linkId: c.id, to: ['case:' + c.id] });
    setBack('');
    w.toast('Sent back to ' + r.requestedBy);
  };
  return (
    <Card>
      <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Close request</strong><span style={css(S.sub)}>Requested by {r.requestedBy} · {fmt(r.requestedAt)} · Outcome: <strong style={css('color:#16223A')}>{r.outcome}</strong></span><span style={css('margin-left:auto;padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:#F6EEDC;color:#8A6D3B')}>Waiting for partner approval</span></div>
      <div style={css('display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:0')}>
        <div>
          {live.map((x) => (
            <div key={x.label} style={css('display:flex;align-items:center;gap:12px;padding:9px 16px;border-bottom:1px solid #F0F2F5')}>
              <span style={css(`width:20px;height:20px;flex-shrink:0;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:800;background:${x.ok ? '#2F6F4E' : '#A35A00'};color:#fff`)}>{x.ok ? '✓' : '!'}</span>
              <span style={css('font-size:12.5px;font-weight:700;color:#16223A;width:150px;flex-shrink:0')}>{x.label}</span><span style={css(`font-size:12.5px;color:${x.ok ? '#4A5468' : '#8A4B00'}`)}>{x.detail}</span>
            </div>
          ))}
          {r.note && <div style={css('padding:12px 16px;display:flex;flex-direction:column;gap:4px')}><span style={css(S.label)}>Note from lawyer</span><span style={css('font-size:13px;line-height:1.5;color:#16223A')}>{r.note}</span></div>}
        </div>
        <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:10px;border-left:1px solid #EEF1F5')}>
          {canApprove ? (
            <>
              <strong style={css('font-family:Georgia, serif;font-size:14px;color:#16223A')}>Your decision</strong>
              <button type="button" onClick={approve} style={css(S.btnPriL + (blocked ? ';opacity:.5' : ''))}>Approve &amp; close file</button>
              {blocked && <span style={css('font-size:11.5px;color:#8A4B00')}>Checklist not clear yet. Send it back, or clear the items first.</span>}
              <label style={css('display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:1px solid #EEF1F5')}><span style={css(S.label)}>Or send back with a reason</span><textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} placeholder="e.g. Return the original title first" style={css(S.input + ';resize:vertical')} /></label>
              <button type="button" onClick={sendBack} style={css('border:1px solid #B23A2E;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#A3321F;cursor:pointer;font-family:inherit')}>Send back to {r.requestedBy}</button>
              <span style={css('font-size:11.5px;line-height:1.45;color:#4A5468')}>Only a partner in charge of this file (or the firm admin) can approve. Every decision is saved to the file history.</span>
            </>
          ) : (
            <span style={css('font-size:12.5px;line-height:1.5;color:#4A5468')}>Waiting for a partner in charge to approve. You'll see it here if it is sent back.</span>
          )}
        </div>
      </div>
    </Card>
  );
};

export const ClosedBanner: React.FC<{ w: WF; canReopen: boolean; onPrint: () => void }> = ({ w, canReopen, onPrint }) => {
  const { c } = w;
  const [a, setA] = useState({ box: c.archiveBoxNo || '', loc: c.archiveLocation || '', destroy: c.destroyAfter || (c.closedDate ? addDays(365 * 7, new Date(c.closedDate)) : '') });
  if (c.status !== 'Closed' && c.status !== 'Archive') return null;
  const reopen = () => {
    if (!window.confirm('Reopen ' + c.ref + '? It becomes Active again.')) return;
    w.save({ status: 'Active', closeRequest: undefined }, 'File reopened by ' + w.me, 'Status Update');
    w.toast('File reopened');
  };
  const saveA = () => {
    w.save({ archiveBoxNo: a.box.trim() || undefined, archiveLocation: a.loc.trim() || undefined, destroyAfter: a.destroy || undefined, ...(a.box.trim() && c.status === 'Closed' ? { status: 'Archive' as Case['status'] } : {}) }, 'Archive details saved' + (a.box.trim() ? ': box ' + a.box.trim() : ''), 'Status Update');
    w.toast('Archive details saved');
  };
  return (
    <>
      <div style={css('display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;background:#EEF1F5;border:1px solid #DDE3EB;font-size:12.5px;color:#16223A;flex-wrap:wrap')}>
        <strong>{c.status === 'Archive' ? 'Archived' : 'Closed'}{c.closedDate ? ' ' + fmt(c.closedDate) : ''}{c.closedBy ? ' · approved by ' + c.closedBy : ''}{c.closeOutcome ? ' · ' + c.closeOutcome : ''}.</strong>
        <span>The file is read-only. Reopening needs a partner.</span>
        {canReopen && <button type="button" onClick={reopen} style={css('margin-left:auto;' + S.btnSec)}>Reopen file</button>}
      </div>
      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Archive</strong><span style={css(S.sub)}>Keep closed files 7 years from closing (firm policy).</span></div>
        <div style={css('padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end')}>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Archive box no.</span><input value={a.box} disabled={!canReopen} onChange={(e) => setA({ ...a, box: e.target.value })} placeholder="e.g. BOX-2027-SH014" style={css(S.input)} /></label>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Where it is kept</span><input value={a.loc} disabled={!canReopen} onChange={(e) => setA({ ...a, loc: e.target.value })} placeholder="e.g. Store room B, shelf 3" style={css(S.input)} /></label>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Destroy after</span><input type="date" value={a.destroy} disabled={!canReopen} onChange={(e) => setA({ ...a, destroy: e.target.value })} style={css(S.input)} /></label>
          <div style={css('display:flex;gap:8px')}><button type="button" onClick={onPrint} style={css(S.btnSecL)}>Print file cover</button>{canReopen && <button type="button" onClick={saveA} style={css(S.btnPriL)}>Save archive details</button>}</div>
        </div>
      </Card>
    </>
  );
};
