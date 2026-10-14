import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { Case, PartnerCode } from '../../../types';
import { DEFAULT_PRACTICE_SETTINGS, getPracticeSettings } from '../../../services/templateService';
import { css, S, Modal } from './caseUi';
import { PeoplePicker } from './PeoplePicker';
import { COURT_LEVELS, courtOf, fmt, isDone, isFileHandler, lawyersOf, openedOf, practiceOf, rm, todayIso } from './caseModel';
import { histEntry, type WF } from './wf';
import { rebuildRef } from '../../../lib/caseRef';
import { practiceKind } from '../../../lib/driveLayout';

export const EditMatterModal: React.FC<{ w: WF; onClose: () => void }> = ({ w, onClose }) => {
  const { currentUser, isAdmin, renameCaseRef, addNotification } = useApp();
  const { c, staff } = w;
  const s = getPracticeSettings();
  const areas = (s.practiceAreas && s.practiceAreas.length ? s.practiceAreas : DEFAULT_PRACTICE_SETTINGS.practiceAreas) || [];
  const practices = Array.from(new Set([practiceOf(c), ...areas.map((a) => a.name)].filter(Boolean)));
  const crt = courtOf(c);
  const init = { title: c.title, practice: practiceOf(c), status: c.status, partners: [...(c.partners || [])] as string[], lawyers: lawyersOf(c), opened: openedOf(c), drive: c.gdriveFolderUrl || '', oldDrive: c.oldDriveFolderUrl || '', ref: c.ref || '', why: '', courtLevel: crt.level || COURT_LEVELS.find((l) => crt.name.toLowerCase().startsWith(l.toLowerCase())) || '', courtLoc: crt.location, suit: crt.suit };
  const [ed, setEd] = useState(init);
  const firmAdmin = Boolean(isAdmin || currentUser?.isSuperAdmin);
  const L: Record<string, string> = { title: 'Title', practice: 'Practice', status: 'Status', partners: 'Partner', lawyers: 'Lawyers', opened: 'Opened', drive: 'Drive folder', oldDrive: 'Old folder', ref: 'Reference', courtLevel: 'Court', courtLoc: 'Court location', suit: 'Suit no.' };
  const lawyerCodeOf = (name: string) => staff.find((p) => p.name === name)?.code || '';
  // Prefer the file's own saved matter code; the firm-wide list is only a fallback for older files.
  const matterCodes = c.matterCode ? [c.matterCode.split('/')[0]] : [
    ...((s.matterCodes && s.matterCodes.length ? s.matterCodes : DEFAULT_PRACTICE_SETTINGS.matterCodes) || []).map((m) => m.code),
    ...areas.map((a) => a.code),
    'LIT', 'CONV', 'CORP', 'FAM', 'EMP', 'PRO', 'CRIM', 'CR', 'SYR', 'EST', 'L',
  ].filter(Boolean) as string[];
  // The reference carries one lawyer code: the lead (first) lawyer.
  const suggestedRef = rebuildRef(c.ref || '', ed.partners, lawyerCodeOf(ed.lawyers[0] || ''), matterCodes);
  const refOutOfDate = !!suggestedRef && suggestedRef !== ed.ref;
  const diff = Object.keys(L).filter((k) => JSON.stringify((ed as Record<string, unknown>)[k]) !== JSON.stringify((init as Record<string, unknown>)[k]));
  const partners = staff.filter((p) => p.isPartner);
  const save = () => {
    if (!diff.length) { onClose(); return; }
    if (ed.ref.trim() !== init.ref) {
      if (!firmAdmin) { w.toast('Only an admin can change the reference number'); return; }
      if (!renameCaseRef(c.id, ed.ref, ed.why.trim() || 'Reference updated')) return;
    }
    if (diff.length === 1 && diff[0] === 'ref') { onClose(); return; }
    if (!ed.title.trim()) { w.toast('Add the matter title'); return; }
    if (!ed.partners.length) { w.toast('Pick a partner in charge'); return; }
    if (ed.drive.trim() && !/^https:\/\/drive\.google\.com\//.test(ed.drive.trim())) { w.toast('Paste the folder link from Google Drive (https://drive.google.com/…)'); return; }
    if (ed.oldDrive.trim() && !/^https:\/\/drive\.google\.com\//.test(ed.oldDrive.trim())) { w.toast('Paste the old folder link from Google Drive (https://drive.google.com/…)'); return; }
    const practiceChanged = ed.practice !== init.practice;
    const patch: Partial<Case> = {
      title: ed.title.trim(), type: ed.practice, practiceArea: ed.practice, status: ed.status as Case['status'], partners: ed.partners as PartnerCode[],
      lawyerInCharge: ed.lawyers[0] || undefined, lawyers: ed.lawyers, gdriveFolderUrl: ed.drive.trim() || undefined, oldDriveFolderUrl: ed.oldDrive.trim() || undefined,
      ...(ed.drive.trim() !== init.drive ? { gdriveFolderId: (ed.drive.match(/folders\/([\w-]+)/) || [])[1] || undefined } : {}),
      ...(firmAdmin || ed.opened === init.opened ? { fileOpenedDate: ed.opened || c.fileOpenedDate } : {}),
      ...(practiceChanged ? { statusStage: undefined, statusStageName: undefined } : {}),
      // Court details: kept for court work; a file moved to conveyancing / corporate drops them.
      ...(practiceKind(ed.practice) === 'court'
        ? (['courtLevel', 'courtLoc', 'suit'].some((k) => diff.includes(k)) ? { courtDetails: { ...(c.courtDetails || {}), level: ed.courtLevel || undefined, location: ed.courtLoc.trim() || undefined }, court: [ed.courtLevel, ed.courtLoc.trim()].filter(Boolean).join(' '), courtCaseNo: ed.suit.trim() || undefined } : {})
        : practiceChanged ? { courtDetails: { ...(c.courtDetails || {}), level: undefined, location: undefined }, court: '', courtCaseNo: undefined } : {}),
    };
    const what = 'Matter details updated: ' + diff.map((k) => L[k] + (k === 'title' || k === 'drive' || k === 'oldDrive' ? '' : ' → ' + (k === 'opened' ? fmt(ed.opened) : k === 'partners' ? ed.partners.join(', ') : k === 'lawyers' ? ed.lawyers.join(', ') : String((ed as Record<string, unknown>)[k]) || '—'))).join(', ') + (ed.why.trim() ? ' (' + ed.why.trim() + ')' : '');
    w.save({ ...patch, activityLogs: [histEntry(what, w.me), ...(c.activityLogs || [])] });
    // Tell whoever was newly put in charge (bell + e-mail).
    const newPeople = [...ed.partners.filter((p) => !init.partners.includes(p)), ...ed.lawyers.filter((n) => !init.lawyers.includes(n))];
    if (newPeople.length) addNotification({ title: 'File assigned to you: ' + c.ref, message: w.me + ' put you in charge of ' + c.ref + ' (' + ed.title.trim() + ').', type: 'system', linkTab: 'cases', linkId: c.id, to: newPeople });
    onClose();
    w.toast(what);
  };
  const lb = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468';
  const inp = 'border-radius:8px;border:1px solid #C9D1DC;padding:9px 11px;font-size:13px;font-family:inherit;color:#16223A;background:#fff';
  return (
    <Modal onClose={onClose} width={640} top>
      <div style={css('display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #DDE3EB')}><strong style={css('font-family:Georgia, serif;font-size:16px;color:#16223A')}>Edit matter details</strong><span style={css('font-family:ui-monospace, monospace;font-size:11.5px;font-weight:700;color:#8A6D3B')}>{c.ref}</span><button type="button" onClick={onClose} style={css('margin-left:auto;background:none;border:0;cursor:pointer;color:#4A5468;font-size:15px')}>✕</button></div>
      <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:18px 20px')}>
        <label style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Matter title</span><input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} style={css(inp)} /></label>
        <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Practice area</span><select value={ed.practice} onChange={(e) => setEd({ ...ed, practice: e.target.value })} style={css(inp)}>{practices.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
        <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>File status</span><select value={ed.status} onChange={(e) => setEd({ ...ed, status: e.target.value as Case['status'] })} style={css(inp)}><option value="Active">Active</option><option value="Pending">Pending (on hold)</option>{(init.status === 'Closed' || init.status === 'Archive') && <option value={init.status}>{init.status}</option>}</select></label>
        {practiceKind(ed.practice) === 'court' && <>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Court</span><select value={ed.courtLevel} onChange={(e) => setEd({ ...ed, courtLevel: e.target.value })} style={css(inp)}><option value="">—</option>{COURT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Court location</span><input value={ed.courtLoc} placeholder="e.g. Shah Alam" onChange={(e) => setEd({ ...ed, courtLoc: e.target.value })} style={css(inp)} /></label>
          <label style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Suit no.</span><input value={ed.suit} placeholder="e.g. BA-22NCvC-1-01/2026" onChange={(e) => setEd({ ...ed, suit: e.target.value })} style={css(inp)} /></label>
        </>}
        <div style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Partner in charge</span>
          <PeoplePicker id="matter-partners" value={ed.partners} onChange={(v) => setEd({ ...ed, partners: v })} placeholder="Search partner by name or code"
            options={[...partners.map((p) => ({ value: p.code, label: p.name + ' (' + p.code + ')' })), ...ed.partners.filter((code) => !partners.some((p) => p.code === code)).map((code) => ({ value: code, label: code }))]} />
        </div>
        <div style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Lawyers in charge</span>
          <PeoplePicker id="matter-lawyers" value={ed.lawyers} onChange={(v) => setEd({ ...ed, lawyers: v })} placeholder="Search lawyer by name or code"
            options={[
              // Partners in charge already handle the file, so they are not offered again here.
              ...staff.filter((p) => isFileHandler(p) && !ed.partners.includes(p.code)).map((p) => ({ value: p.name, label: p.name, hint: p.role })),
              ...ed.lawyers.filter((n) => !staff.some((p) => isFileHandler(p) && p.name === n)).map((n) => ({ value: n, label: n })),
            ]} />
          <span style={css('font-size:11.5px;color:#5B6478')}>Pick one or more. Partners in charge already count as handlers of the file. Changing people does not change the file no. (admins can use Rebuild below).</span>
        </div>
        <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Date opened{firmAdmin ? '' : ' (admin only)'}</span><input type="date" disabled={!firmAdmin} value={ed.opened} onChange={(e) => setEd({ ...ed, opened: e.target.value })} style={css(inp)} /></label>
        <div style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}>
          <span style={css(lb)}>Reference number{firmAdmin ? '' : ' (admin only)'}</span>
          <div style={css('display:flex;gap:8px')}>
            <input value={ed.ref} disabled={!firmAdmin} onChange={(e) => setEd({ ...ed, ref: e.target.value })} style={css(inp + ';flex:1;font-family:ui-monospace, monospace;font-weight:700;color:#8A6D3B')} />
            {firmAdmin && refOutOfDate && <button type="button" onClick={() => setEd({ ...ed, ref: suggestedRef! })} style={css('border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;color:#16223A;background:#fff;border:1px solid #C9D1DC;cursor:pointer;font-family:inherit;white-space:nowrap')}>Rebuild from partners &amp; lawyer</button>}
          </div>
          {refOutOfDate && <span style={css('font-size:12px;line-height:1.5;color:#8A6D3B')}>With these partners / lawyer the reference would be <b style={css('font-family:ui-monospace, monospace')}>{suggestedRef}</b>.{firmAdmin ? ' Use Rebuild to apply it, or type your own.' : ' Ask an admin to update the reference.'}</span>}
          {firmAdmin && ed.ref.trim() !== init.ref && <span style={css('font-size:12px;line-height:1.5;color:#4A5468')}>Invoices, receipts, vouchers, claims, quotations and ledger lines linked to {init.ref} move to the new reference. Give a reason below.</span>}
        </div>
        <label style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Google Drive folder</span><input value={ed.drive} onChange={(e) => setEd({ ...ed, drive: e.target.value })} placeholder="Paste the folder link from Google Drive" style={css(inp)} /></label>
        <label style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Old folder (optional)</span><input value={ed.oldDrive} onChange={(e) => setEd({ ...ed, oldDrive: e.target.value })} placeholder="Link to this file's folder in an old drive · nothing there is moved or renamed" style={css(inp)} /></label>
        <label style={css('grid-column:1/-1;display:flex;flex-direction:column;gap:5px')}><span style={css(lb)}>Reason for change</span><input value={ed.why} onChange={(e) => setEd({ ...ed, why: e.target.value })} placeholder="Recorded in History, e.g. File reassigned" style={css(inp)} /></label>
        <p style={css('grid-column:1/-1;margin:0;font-size:12px;line-height:1.5;color:#4A5468')}>Parties are edited in Overview. Court, suit no., coram and opposing solicitors are changed in the Court tab so their history is kept. Closing a file goes through Request to close.</p>
      </div>
      <div style={css('display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #DDE3EB;background:#F6F8FA;border-radius:0 0 12px 12px')}>
        <span style={css('font-size:12px;color:#4A5468')}>{diff.length ? diff.length + ' change(s): ' + diff.map((k) => L[k]).join(', ') : 'No changes yet'}</span>
        <button type="button" onClick={onClose} style={css('margin-left:auto;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;color:#4A5468;background:#fff;border:1px solid #DDE3EB;cursor:pointer;font-family:inherit')}>Cancel</button>
        <button type="button" onClick={save} style={css('border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;color:#fff;background:#16223A;border:0;cursor:pointer;font-family:inherit')}>Save changes</button>
      </div>
    </Modal>
  );
};

export const DeleteMatterModal: React.FC<{ w: WF; onClose: () => void }> = ({ w, onClose }) => {
  const { deleteCase, addNotification, setCurrentCaseId } = useApp();
  const { c, isPartner, money } = w;
  const [why, setWhy] = useState('');
  const [typed, setTyped] = useState('');
  const blocked = isPartner && Math.abs(money.clientBalance) > 0.005;
  const ok = !!why && typed.trim() === c.ref && !blocked;
  const impact: [string, string, boolean][] = [
    ['Open tasks removed from My Work', String((c.tasks || []).filter((t) => !isDone(t)).length), false],
    ['Court dates on the file', String((c.hearings || []).length), false],
    ['Filing & service entries hidden', String((c.serviceRecord || []).length), false],
    // Client-account money is shown only to people who see billing.
    ...(w.seeFin ? [['Client account balance', rm(money.clientBalance), blocked] as [string, string, boolean]] : []),
  ];
  const confirm = () => {
    if (blocked) { w.toast('Clear the client account balance first'); return; }
    if (!why) { w.toast('Choose a reason'); return; }
    if (typed.trim() !== c.ref) { w.toast('File no. does not match'); return; }
    if (!isPartner) {
      w.save({ deletionRequest: { by: w.me, at: todayIso(), reason: why } }, 'Deletion requested: ' + why);
      addNotification({ title: 'Deletion request: ' + c.ref, message: w.me + ' asked to delete ' + c.ref + ' (' + why + ').', type: 'system', linkTab: 'cases', linkId: c.id, to: ['partners:' + c.id] });
      onClose();
      w.toast('Deletion request sent to the partner in charge: ' + why);
      return;
    }
    deleteCase(c.id);
    setCurrentCaseId(null);
    w.toast(c.ref + ' deleted (' + why + '). It can be restored from Cases › Recycle bin');
  };
  return (
    <Modal onClose={onClose} width={520} top>
      <div style={css('display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #DDE3EB')}><strong style={css('font-family:Georgia, serif;font-size:16px;color:#8E2A20')}>{isPartner ? 'Delete this matter?' : 'Request deletion'}</strong><button type="button" onClick={onClose} style={css('margin-left:auto;background:none;border:0;cursor:pointer;color:#4A5468;font-size:15px')}>✕</button></div>
      <div style={css('display:flex;flex-direction:column;gap:14px;padding:18px 20px')}>
        <p style={css('margin:0;font-size:13px;line-height:1.55;color:#16223A')}>{isPartner ? 'Use this only for files opened in error or duplicates. Finished matters should be closed, not deleted. Deleted matters go to the recycle bin and can be restored.' : 'Your request goes to the partner in charge with the reason below.'}</p>
        <div style={css('display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:8px;background:#F6F8FA;border:1px solid #DDE3EB')}>
          {impact.map(([k, v, red]) => <div key={k} style={css('display:flex;gap:10px;font-size:12.5px')}><span style={css('flex:1;color:#4A5468')}>{k}</span><strong style={css(`color:${red ? '#8E2A20' : '#16223A'}`)}>{v}</strong></div>)}
        </div>
        {blocked && <p style={css('margin:0;padding:10px 12px;border-radius:8px;background:#F6E4E1;font-size:12.5px;line-height:1.5;color:#8E2A20')}>Client account holds a balance. Refund or transfer it in Accounts &amp; Finance before this matter can be deleted.</p>}
        <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Reason</span><select value={why} onChange={(e) => setWhy(e.target.value)} style={css(S.input)}><option value="">Choose a reason</option><option value="Opened in error">Opened in error</option><option value="Duplicate of another file">Duplicate of another file</option><option value="Client did not proceed">Client did not proceed</option></select></label>
        <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Type the file no. to confirm</span><input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={c.ref} style={css(S.input + ';font-family:ui-monospace, monospace')} /></label>
      </div>
      <div style={css('display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #DDE3EB;background:#F6F8FA;border-radius:0 0 12px 12px')}>
        <button type="button" onClick={onClose} style={css('margin-left:auto;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;color:#4A5468;background:#fff;border:1px solid #DDE3EB;cursor:pointer;font-family:inherit')}>Cancel</button>
        <button type="button" onClick={confirm} style={css(`border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;color:#fff;background:#8E2A20;border:0;cursor:pointer;font-family:inherit;opacity:${ok ? 1 : 0.4}`)}>{isPartner ? 'Delete matter' : 'Send request'}</button>
      </div>
    </Modal>
  );
};
