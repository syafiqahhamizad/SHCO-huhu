/**
 * Warrant to Act: the client's written authority for the firm to act in a matter. Built from the
 * real client and file details as a Word draft the client signs; blanks are left as [ ] for anything
 * not recorded. The firm can edit the wording in Word before it is signed.
 */
export interface WarrantInput {
  client: { name: string; type?: 'Individual' | 'Corporate'; idNo?: string; address?: string };
  matterTitle: string;
  side?: string;
  court?: string;
  suitNo?: string;
  fileRef?: string;
  firmName?: string;
  firmAddress?: string;
  date: string;
}

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const blank = (v: string | undefined, label: string) => (v && v.trim() ? esc(v.trim()) : `[${label}]`);

export function warrantToActHtml(i: WarrantInput): string {
  const co = i.client.type === 'Corporate';
  const firm = esc(i.firmName || 'Syafiqah Hamizad & Co');
  const who = co
    ? `We, <strong>${blank(i.client.name, 'company name')}</strong> (Company No. ${blank(i.client.idNo, 'company no.')}), of ${blank(i.client.address, 'registered address')}`
    : `I, <strong>${blank(i.client.name, 'full name')}</strong> (NRIC No. ${blank(i.client.idNo, 'NRIC no.')}), of ${blank(i.client.address, 'address')}`;
  const we = co ? 'we' : 'I', us = co ? 'us' : 'me', our = co ? 'our' : 'my';
  const where = [i.court && i.court.trim() ? esc(i.court.trim()) : '', i.suitNo && i.suitNo.trim() ? esc(i.suitNo.trim()) : ''].filter(Boolean).join(', ');
  return [
    `<p style="text-align:right">Our ref: ${blank(i.fileRef, 'file ref')}</p>`,
    `<p style="text-align:center"><strong>WARRANT TO ACT</strong></p>`,
    `<p><strong>RE: ${esc(String(i.matterTitle || '').toUpperCase())}</strong>${where ? '<br/>' + where : ''}</p>`,
    `<p>${who}, hereby authorise and appoint <strong>Messrs. ${firm}</strong>, Advocates &amp; Solicitors${i.firmAddress ? ', of ' + esc(i.firmAddress) : ''}, to act for ${us}${i.side ? ' as the ' + esc(i.side) : ''} in the above matter.</p>`,
    `<p>${co ? 'We' : 'I'} authorise the firm to take all steps necessary in the matter on ${our} behalf, including to commence or defend proceedings, to accept service of documents, to prepare, file and serve documents, to appear, to correspond with all parties, and to engage counsel or agents where needed, acting on ${our} instructions.</p>`,
    `<p>${co ? 'We' : 'I'} agree to pay the firm's fees, disbursements and other charges as agreed or set out in the firm's quotation or letter of engagement. This warrant stays in force until ${we} revoke it in writing.</p>`,
    `<p>Dated: ${esc(i.date)}</p>`,
    `<br/><br/><p>_______________________________<br/>Signature${co ? ' of authorised signatory (and company stamp)' : ''}<br/>Name: ${co ? '[ ]' : blank(i.client.name, 'full name')}<br/>${co ? 'Designation: [ ]<br/>' : 'NRIC No.: ' + blank(i.client.idNo, 'NRIC no.') + '<br/>'}</p>`,
    `<br/><p>Witnessed by:<br/><br/>_______________________________<br/>Name: [ ]<br/>NRIC No.: [ ]</p>`,
  ].join('');
}
