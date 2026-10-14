import React, { useState } from 'react';
import { escapeHtml } from '../../../../lib/html';
import type { CaseDocument } from '../../../../types';
import { EngagementLetterActions, LangToggle, branchOfCase, engagementInputFor } from '../EngagementLetter';
import { letterheadFor, loadLogos, word } from '../../../../lib/financeDocs';
import { letterFooterHtml, letterheadHtml, quotationForFile, type DocLang } from '../../../../lib/engagementLetter';
import { useApp } from '../../../../context/AppContext';
import { prepareStorage, storeEngagementFile, storeMatterFile, openLegacyDataUrl, openStoredFile, useStorageLabel } from '../../../../services/fileStorageService';
import { folderLabel, matterSubFor, practiceKind, uploadFolders } from '../../../../lib/driveLayout';
import { css, S, Card } from '../caseUi';
import { courtOf, daysFrom, fmt, isoOf, lawyerOf } from '../caseModel';
import { histEntry, newId, type WF } from '../wf';

const LOE = 'Letter of Engagement';
const TEMPLATES = [LOE, 'Letter to client: next court date', 'Letter to opposing solicitors', 'Affidavit (blank, with intitulement)', 'Notice of change of solicitors', 'Closing letter to client'];
/** Upload categories → where the file goes (matter sub-folder in SHCO Portal, or SHCO Finance). */
/** Quotations, invoices and receipts → the SHCO Finance drive (partners / Accounts only). */
const ENGAGEMENT = 'Billing (Finance drive)';
/** Letters that only make sense for court work. */
const COURT_ONLY = new Set(['Letter to client: next court date', 'Affidavit (blank, with intitulement)', 'Notice of change of solicitors']);
const esc = escapeHtml;

export const LettersTab: React.FC<{ w: WF }> = ({ w }) => {
  const { c, parties, me, ro } = w;
  const { clients = [], quotations = [], users = [] } = useApp();
  const storage = useStorageLabel();
  // Upload choices and letter templates follow the practice area (court work / conveyancing / corporate).
  const area = c.practiceArea || c.type;
  const UPLOAD_CATS = [...uploadFolders(area), ENGAGEMENT];
  const templates = practiceKind(area) === 'court' ? TEMPLATES : TEMPLATES.filter((x) => !COURT_ONLY.has(x));
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [busy, setBusy] = useState(false);
  const [upCat, setUpCat] = useState('Correspondences');
  // Letter of Engagement: fees from the file's accepted quotation, else its latest one not declined.
  // Quotations the viewer cannot read are simply absent → the letter says "as per our quotation".
  const quote = quotationForFile(quotations, c);
  const [lang, setLang] = useState<DocLang>('EN');
  React.useEffect(() => { loadLogos(); }, []);
  const court = courtOf(c);
  const client = parties.find((p) => p.side === 'client' && !p.dischargedOn);
  const clientRec = clients.find((x) => x.id === (client?.clientId || client?.id)) || clients.find((x) => x.name === client?.name);
  const sol = parties.find((p) => p.side === 'solicitor' && !p.dischargedOn);
  const nh = (c.hearings || []).filter((h) => daysFrom(h.date) >= 0 && h.status === 'Scheduled').sort((a, b) => (a.date > b.date ? 1 : -1))[0];
  const lawyer = lawyerOf(c) || me;
  const fields: [string, string][] = [['Client', client?.name || '—'], ['File ref', c.ref], ['Court', court.name || '—'], ['Suit no.', court.suit || '—'], ['Next date', nh ? fmt(nh.date) : '—'], ['Lawyer', lawyer], ['Opposing solicitors', sol?.name || '—']];

  const gen = () => {
    const today = fmt(isoOf(new Date().toISOString()));
    // Same letterhead as the Letter of Engagement (logo, name, address, partners).
    const head = letterheadHtml(letterheadFor(branchOfCase(c, users))) + `<p>Our ref: ${esc(c.ref)}<br/>Date: ${esc(today)}</p>`;
    const re = `<p><strong>RE: ${esc(c.title.toUpperCase())}${court.suit ? '<br/>' + esc(court.suit) : ''}</strong></p>`;
    const sign = `<p>Yours faithfully,<br/><br/><br/>${esc(lawyer)}<br/>Syafiqah Hamizad &amp; Co</p>`;
    const intit = `<p style="text-align:center"><strong>${esc((court.name || 'IN THE COURT').toUpperCase())}</strong><br/>${esc(court.suit || '[SUIT NO.]')}</p><p style="text-align:center">BETWEEN</p>${parties.filter((p) => p.side === 'client' && !p.dischargedOn).map((p) => `<p>${esc(p.name)} ... ${esc(p.role)}</p>`).join('')}<p style="text-align:center">AND</p>${parties.filter((p) => p.side === 'opposing').map((p) => `<p>${esc(p.name)} ... ${esc(p.role)}</p>`).join('')}`;
    const body: Record<string, string> = {
      'Letter to client: next court date': `${head}<p>${esc(client?.name || '[Client]')}</p>${re}<p>We write to inform you that the next court date for the above matter is <strong>${esc(nh ? fmt(nh.date) : '[date]')}</strong>${nh ? ' (' + esc(nh.purpose) + ')' : ''}. ${nh?.clientAttendanceRequired === 'Compulsory' ? 'Your attendance is required.' : 'We will inform you if your attendance is required.'}</p>${sign}`,
      'Letter to opposing solicitors': `${head}<p>${esc(sol?.name || '[Opposing solicitors]')}</p>${re}<p>We refer to the above matter.</p><p>[Body of letter]</p>${sign}`,
      'Affidavit (blank, with intitulement)': `${intit}<p style="text-align:center"><strong>AFFIDAVIT</strong></p><p>I, [name], [NRIC], of full age and residing at [address], do hereby solemnly and sincerely affirm and say as follows:</p><p>1. [ ]</p>`,
      'Notice of change of solicitors': `${intit}<p style="text-align:center"><strong>NOTICE OF CHANGE OF SOLICITORS</strong></p><p>TAKE NOTICE that Messrs. Syafiqah Hamizad &amp; Co have been appointed to act for ${esc(client?.name || '[party]')} in place of [previous solicitors].</p><p>Dated: ${esc(today)}</p>`,
      'Closing letter to client': `${head}<p>${esc(client?.name || '[Client]')}</p>${re}<p>We are pleased to inform you that the above matter has been concluded and we are closing our file. Original documents held by us have been / will be returned to you. Our file will be kept for 7 years from the date of closing.</p><p>Thank you for your instructions.</p>${sign}`,
    };
    word(tpl.replace(/[^\w]+/g, '_') + '_' + c.ref.replace(/\//g, '-'), `<div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;text-align:justify;color:#000">${body[tpl]}${body[tpl].startsWith(head) ? letterFooterHtml(letterheadFor()) : ''}</div>`);
    w.save({}, 'Draft generated: ' + tpl, 'Document Upload');
    w.toast('Draft "' + tpl + '" downloaded as a Word file. Check and finalise before sending');
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      await prepareStorage();
      const dest = matterSubFor(upCat, area);
      const st = dest === 'finance'
        ? await storeEngagementFile({ ref: c.ref, title: c.title }, file, me)
        : await storeMatterFile({ ref: c.ref, title: c.title, practiceArea: c.practiceArea, type: c.type, folderId: c.gdriveFolderId, sub: dest, file, uploadedBy: me });
      const doc: CaseDocument & { driveFileId?: string; storagePath?: string } = { id: newId('DOC'), name: st.name, category: upCat, uploadedDate: isoOf(st.uploadedAt), driveUrl: st.webViewLink, mimeType: st.contentType, driveFileId: st.driveFileId, storagePath: st.storagePath };
      w.save({ documents: [doc, ...(c.documents || [])], activityLogs: [histEntry('Document uploaded: ' + st.name, me, 'Document Upload'), ...(c.activityLogs || [])] });
      w.toast('Uploaded to ' + (dest === 'finance' ? 'SHCO Finance › Files' : folderLabel(dest)) + '. ' + storage);
    } catch (e) { w.toast('Not uploaded: ' + (e instanceof Error ? e.message : String(e))); }
    setBusy(false);
  };
  const docs = [...(c.documents || [])].sort((a, b) => (isoOf(a.uploadedDate) < isoOf(b.uploadedDate) ? 1 : -1));
  const openDoc = async (d: CaseDocument & { driveFileId?: string; storagePath?: string }) => {
    if (d.driveFileId || d.storagePath) { const err = await openStoredFile({ driveFileId: d.driveFileId, webViewLink: d.driveUrl, path: d.storagePath }); if (err) w.toast(err); return; }
    if (d.driveUrl) { window.open(d.driveUrl, '_blank', 'noopener'); return; }
    // Legacy (read-only): documents kept inline before uploads moved to Google Drive.
    if (d.dataUrl) { const err = openLegacyDataUrl(d.dataUrl, d.name); if (err) w.toast(err); return; }
    w.toast('Only the name of this document was kept — there is no stored copy.');
  };

  const toggleShare = (d: CaseDocument) => {
    const on = !d.sharedWithClient;
    w.save({ documents: (c.documents || []).map((x) => (x.id === d.id ? { ...x, sharedWithClient: on } : x)), activityLogs: [histEntry((on ? 'Shared with client: ' : 'No longer shared with client: ') + d.name, me, 'Document Upload'), ...(c.activityLogs || [])] });
    w.toast(on ? 'Shared: the client sees it in the Client Portal' : 'No longer shown in the Client Portal');
  };

  return (
    <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px;align-items:start')}>
      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Generate from template</strong><span style={css('margin-left:auto;font-size:12px;color:#4A5468')}>Filled from this file</span></div>
        <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:12px')}>
          <label style={css('display:flex;flex-direction:column;gap:5px')}><span style={css(S.label)}>Template</span><select value={tpl} onChange={(e) => setTpl(e.target.value)} style={css(S.input)}>{templates.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <div style={css('border:1px solid #EEF1F5;border-radius:8px')}>
            {fields.map(([k, v]) => <div key={k} style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;padding:7px 12px;border-top:1px solid #F0F2F5;font-size:12.5px')}><span style={css('color:#4A5468')}>{k}</span><span style={css('color:#16223A;font-weight:600')}>{v}</span></div>)}
          </div>
          {tpl === LOE && (
            <div style={css('display:flex;flex-direction:column;gap:10px')}>
              <div style={css('display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between')}>
                <LangToggle value={lang} onChange={setLang} />
                <EngagementLetterActions input={engagementInputFor(c, clientRec, quote, users, lang)} onDone={(what) => { if (what !== 'viewed') w.save({}, 'Letter of Engagement (' + lang + '): ' + what, 'Document Upload'); }} />
              </div>
              <span style={css('font-size:11.5px;color:#4A5468')}>{quote ? 'Fees and payment plan from quotation ' + quote.id + ' in Billing (' + quote.status + ').' : 'No quotation on this file that you can see, so the letter says the fees are as per our quotation (no figures are made up).'}</span>
            </div>
          )}
          {tpl !== LOE && <div style={css('display:flex;gap:8px;justify-content:flex-end;align-items:center')}><span style={css('font-size:11.5px;color:#4A5468')}>Downloads a Word draft</span><button type="button" onClick={gen} style={css(S.btnPriL)}>Generate draft</button></div>}
        </div>
      </Card>
      <Card>
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>E-signature</strong><span title="E-signature is not connected yet" style={css('margin-left:auto;border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#DDE3EB;color:#5B6478;cursor:not-allowed')}>Send for signature</span></div>
        <div style={css(S.empty + ';text-align:left')}>E-signature is not connected yet, so nothing can be sent for signing from here. Print the document and get it signed, then upload the signed copy under Documents.</div>
      </Card>
      <Card style="grid-column:1/-1">
        <div style={css(S.head)}><strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>Documents</strong><span style={css(S.sub)}>{storage.replace('Saved to', 'Uploads go to')}</span>
          {!ro && <select value={upCat} onChange={(e) => setUpCat(e.target.value)} title={upCat === ENGAGEMENT ? 'Saved to the SHCO Finance Shared Drive (partners / Accounts)' : 'Saved to this file’s ' + folderLabel(upCat) + ' folder'} style={css('margin-left:auto;border:1px solid #C9D1DC;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;color:#16223A;background:#fff')}>{UPLOAD_CATS.map((k) => <option key={k} value={k}>{folderLabel(k)}</option>)}</select>}
          {!ro && <label style={css(S.btnPri + (busy ? ';opacity:.5' : ''))}><input type="file" style={css('display:none')} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }} />{busy ? 'Uploading…' : '+ Upload document'}</label>}
        </div>
        {docs.map((d) => (
          <div key={d.id} style={css('display:grid;grid-template-columns:minmax(0,1fr) 160px 110px 150px;gap:12px;align-items:center;' + S.row)}>
            <button type="button" onClick={() => void openDoc(d)} style={css('border:0;background:none;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:#16223A;text-decoration:underline')}>{d.name}</button>
            <span style={css('color:#4A5468')}>{d.category}</span>
            <span style={css('color:#4A5468')}>{fmt(d.uploadedDate)}</span>
            <label title="Shared documents show in the Client Portal › Documents" style={css('display:flex;align-items:center;gap:6px;font-size:12px;color:' + (d.sharedWithClient ? '#1F5A3B' : '#4A5468') + ';cursor:' + (ro ? 'default' : 'pointer'))}>
              <input type="checkbox" checked={!!d.sharedWithClient} disabled={ro} onChange={() => toggleShare(d)} />Share with client
            </label>
          </div>
        ))}
        {!docs.length && <div style={css(S.empty)}>No documents on this file yet.</div>}
      </Card>
    </div>
  );
};
