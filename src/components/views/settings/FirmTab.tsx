import React from 'react';
import { DEFAULT_BRANCHES, DEFAULT_PURPOSE_EMAILS, type FirmBranch, type PracticeSettings } from '../../../services/templateService';
import { css, S, Txt, type SettingsCtx } from './settingsShared';
import { useApp } from '../../../context/AppContext';
import { DRIVE_REQUIRED_MSG, isUploadReady, prepareStorage, storeLetterheadImage } from '../../../services/fileStorageService';

const TAG1 = 'Advocates & Solicitors | Syarie Counsel';
const TAG2 = 'Peguambela & Peguamcara | Peguam Syarie';

/** Shrink an uploaded header image so it fits in the shared settings document (Firestore 1 MB). */
const shrinkImage = (file: File): Promise<string> => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onerror = () => rej(new Error('Could not read the image.'));
  fr.onload = () => {
    const img = new Image();
    img.onerror = () => rej(new Error('That file is not an image.'));
    img.onload = () => {
      const w = Math.min(1400, img.width), h = Math.round(img.height * (w / img.width));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); if (!cx) return rej(new Error('Could not process the image.'));
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      let q = 0.9, out = cv.toDataURL('image/jpeg', q);
      while (out.length > 220000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
      if (out.length > 260000) return rej(new Error('Image is too large. Crop it to just the header and try again.'));
      res(out);
    };
    img.src = String(fr.result);
  };
  fr.readAsDataURL(file);
});

export const FirmTab = ({ C }: { C: SettingsCtx }) => {
  const { currentUser } = useApp();
  const s = C.settings;
  const fields: [string, string, (v: string) => Partial<PracticeSettings>][] = [
    ['Firm name', s.firmName || '', (v) => ({ firmName: v })],
    ['Firm reg. no.', s.firmRegNo || '', (v) => ({ firmRegNo: v })],
    ['Tagline (line 1)', s.taglineLine1 ?? TAG1, (v) => ({ taglineLine1: v })],
    ['Tagline (line 2)', s.taglineLine2 ?? TAG2, (v) => ({ taglineLine2: v })],
    ['Email on documents', s.email || '', (v) => ({ email: v })],
    ['Phone on documents', s.phone || '', (v) => ({ phone: v })],
  ];
  const branches: FirmBranch[] = s.branches && s.branches.length ? s.branches : DEFAULT_BRANCHES;
  const emails = s.purposeEmails && s.purposeEmails.length ? s.purposeEmails : DEFAULT_PURPOSE_EMAILS.map((e) => (e.purpose === 'Billing & receipts' ? { ...e, email: s.email || '' } : e));
  const PH: Record<string, string> = { 'General enquiries': 'info@shcolaw.com', 'Billing & receipts': 'billing@shcolaw.com', 'Payroll & HR': 'hr@shcolaw.com', 'Client portal': 'noreply@shcolaw.com', 'New leads': 'enquiry@shcolaw.com' };

  // The original goes to Google Drive (Firm/Letterhead/). Exception to "metadata only": a small
  // compressed copy is ALSO kept in Firm Settings as a data URL, because finance documents and
  // letters are printed / saved as PDF from an iframe that has no Drive sign-in to fetch from.
  const onFile = async (b: FirmBranch, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!isUploadReady()) { C.msg(DRIVE_REQUIRED_MSG); return; }
    if (!f.type.startsWith('image/')) { C.msg('That file is not an image.'); return; }
    try {
      const data = await shrinkImage(f);
      await prepareStorage();
      const up = await storeLetterheadImage(b.name, f, currentUser?.name || 'Firm Settings');
      C.save({ branches: branches.map((x) => (x.id === b.id ? { ...x, letterheadImage: data, letterheadFileName: f.name, letterheadDriveFileId: up.driveFileId, letterheadWebViewLink: up.webViewLink } : x)) }, 'Letterhead Uploaded', b.name + ': ' + f.name + ' (original in Google Drive › Firm › Letterhead)');
      C.msg('Letterhead for ' + b.name + (b.hq ? ' (HQ)' : '') + ' uploaded');
    } catch (err) {
      C.msg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Finance document details</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>printed only on quotation, proforma, invoice, receipt, statement and payslip · letters and court papers use their own templates</span></div>
        <div style={css('padding:12px 14px;display:flex;flex-direction:column;gap:9px')}>
          {fields.map(([label, value, patch]) => (
            <label key={label} style={css('display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(S.fieldLabel)}>{label}</span><Txt value={value} placeholder={label === 'Firm reg. no.' ? 'not set yet · documents show [to be set]' : undefined} onCommit={(v) => { C.save(patch(v), 'Firm Details Changed', label + ': ' + (value || '—') + ' → ' + (v || '—')); C.msg(label + ' saved'); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A" /></label>
          ))}
        </div>
      </div>
      <div style={css(S.card)}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Letterhead by branch</strong></div>
        {branches.map((b) => (
          <div key={b.id} style={css('display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:12px;font-weight:700;color:#16223A')}>{b.name + (b.hq ? ' (HQ)' : '')}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{b.address}</span><span style={css(`display:block;font-size:10.5px;color:${b.letterheadImage ? '#2F6F4E' : '#5B6478'}`)}>{b.letterheadImage ? '✓ ' + (b.letterheadFileName || 'header image') : 'Using built-in letterhead'}{b.letterheadWebViewLink ? <> · <a href={b.letterheadWebViewLink} target="_blank" rel="noopener noreferrer" style={css('color:#2F4F7A;font-weight:700')}>original in Drive</a></> : null}</span></span>
            <label style={css('justify-self:end;border:1px solid #DDE3EB;border-radius:6px;padding:6px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Upload header image<input type="file" accept="image/*" onChange={(e) => onFile(b, e)} style={css('display:none')} /></label>
          </div>
        ))}
        <div style={css(S.foot)}>Documents use the letterhead of the file’s branch. Upload a screenshot of the header from Word (logo to email line) to use it exactly.</div>
      </div>
      <div style={css('grid-column:1 / -1;overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Emails by purpose</strong><span style={css('margin-left:8px;font-size:10.5px;color:#5B6478')}>each email is used only for its purpose · the system sends from and shows the right one automatically</span></div>
        <div style={css('display:grid;grid-template-columns:180px 260px minmax(0,1fr);gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Purpose</span><span>Email</span><span>Used for</span></div>
        {emails.map((e, i) => (
          <div key={e.purpose} style={css('display:grid;grid-template-columns:180px 260px minmax(0,1fr);gap:10px;align-items:center;padding:6px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{e.purpose}</span><Txt value={e.email} placeholder={PH[e.purpose] || 'name@shcolaw.com'} onCommit={(v) => { C.save({ purposeEmails: emails.map((x, j) => (j === i ? { ...x, email: v.trim() } : x)) }, 'Purpose Email Changed', e.purpose + ': ' + (e.email || '—') + ' → ' + (v.trim() || '—')); C.msg(e.purpose + ' email saved'); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A" /><span style={css('font-size:10.5px;color:#5B6478')}>{e.usedFor}</span></div>
        ))}
      </div>
    </div>
  );
};
