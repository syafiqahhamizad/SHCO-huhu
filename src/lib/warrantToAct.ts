/**
 * Warrant to Act: the client's written authority for the firm to act. Laid out the way Malaysian
 * firms usually issue it: addressed to the firm on plain paper, court intitulement when there is a
 * suit, numbered clauses, the client's signature (with company stamp for a company), a witness and
 * the firm's acceptance. Built from real client / file details; anything not recorded is left as a
 * dotted blank to fill in by hand. The firm can still edit the Word copy before signing.
 */
export interface WarrantInput {
  client: { name: string; type?: 'Individual' | 'Corporate'; idNo?: string; address?: string };
  matterTitle: string;
  side?: string;
  court?: string;
  suitNo?: string;
  /** Other party (for "BETWEEN … AND …" when there is a suit). */
  otherParty?: string;
  fileRef?: string;
  firmName?: string;
  firmAddress?: string;
  date: string;
}

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DOTS = '<span style="letter-spacing:1px">……………………………</span>';
const val = (v: string | undefined) => (v && v.trim() ? esc(v.trim()) : DOTS);

const P = 'margin:0 0 9pt;text-align:justify';
const BODY = "font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.45;color:#000";

/** The warrant as HTML (A4, Times New Roman 12pt) for view, PDF/print and Word. */
export function warrantToActHtml(i: WarrantInput): string {
  const co = i.client.type === 'Corporate';
  const firm = esc(i.firmName || 'Syafiqah Hamizad & Co');
  const I = co ? 'We' : 'I', me = co ? 'us' : 'me', my = co ? 'our' : 'my';
  const idLabel = co ? 'Company No.' : 'NRIC No.';
  const suit = !!(i.suitNo && i.suitNo.trim());
  const party = (side?: string) => (side ? ' … ' + esc(side) : '');

  const intitulement = suit
    ? `<div style="text-align:center;margin:0 0 14pt">
        <div style="font-weight:bold">${val(i.court).toUpperCase()}</div>
        <div style="font-weight:bold">${val(i.suitNo)}</div>
        <div style="margin-top:8pt">BETWEEN</div>
        <div style="font-weight:bold">${val(i.client.name).toUpperCase()}${party(i.side)}</div>
        <div>AND</div>
        <div style="font-weight:bold">${val(i.otherParty).toUpperCase()}</div>
      </div>`
    : '';

  const clauses = [
    `${I}, <strong>${val(i.client.name)}</strong> (${idLabel} ${val(i.client.idNo)}) of ${val(i.client.address)} (“the Client”), hereby appoint and authorise Messrs. ${firm} (“the Firm”) to act for and represent ${me}${i.side ? ' as the ' + esc(i.side) : ''} in the above matter, and in all applications, appeals and enforcement proceedings arising from or connected with it, until the matter is concluded or this warrant is revoked.`,
    `Without limiting clause 1, the Firm is authorised on ${my} behalf to:
      <div style="margin:4pt 0 0 18pt">(a) commence, defend and conduct the proceedings, and to prepare, sign, file and serve all cause papers, pleadings, affidavits and other documents;</div>
      <div style="margin:2pt 0 0 18pt">(b) accept service of all documents and process;</div>
      <div style="margin:2pt 0 0 18pt">(c) attend and act at all hearings, case management and mediation;</div>
      <div style="margin:2pt 0 0 18pt">(d) correspond and negotiate with the other parties and their solicitors;</div>
      <div style="margin:2pt 0 0 18pt">(e) engage counsel, agents or experts where reasonably necessary; and</div>
      <div style="margin:2pt 0 0 18pt">(f) receive any money payable to ${me} in the matter into the Firm’s client account, to be dealt with in accordance with the Solicitors’ Account Rules 1990 and ${my} written instructions.</div>`,
    `The Firm shall not settle, compromise or withdraw the matter without ${my} prior instructions.`,
    `${I} agree to pay the Firm’s professional fees, disbursements and other charges as set out in the Firm’s quotation or letter of engagement, and to place such deposits as the Firm may reasonably require.`,
    `${I} confirm that the information and documents given to the Firm are true and complete, and ${co ? 'we' : 'I'} will inform the Firm promptly of any change in ${my} address or contact details.`,
    `${I} may revoke this warrant by written notice to the Firm. Revocation does not affect fees, disbursements and charges incurred up to the date of the notice.`,
  ];

  const sign = co
    ? `<table style="width:100%;border-collapse:collapse;margin-top:28pt"><tr>
        <td style="width:55%;vertical-align:top;padding:0">Signed for and on behalf of<br/><strong>${val(i.client.name)}</strong><br/>by its authorised signatory<br/><br/><br/>…………………………………………<br/>Name: ${DOTS}<br/>Designation: ${DOTS}<br/>Company stamp:</td>
        <td style="vertical-align:top;padding:0">In the presence of:<br/><br/><br/><br/>…………………………………………<br/>Name: ${DOTS}<br/>NRIC No.: ${DOTS}</td>
      </tr></table>`
    : `<table style="width:100%;border-collapse:collapse;margin-top:28pt"><tr>
        <td style="width:55%;vertical-align:top;padding:0">Signed by the Client<br/><br/><br/><br/>…………………………………………<br/>Name: ${val(i.client.name)}<br/>NRIC No.: ${val(i.client.idNo)}</td>
        <td style="vertical-align:top;padding:0">In the presence of:<br/><br/><br/><br/>…………………………………………<br/>Name: ${DOTS}<br/>NRIC No.: ${DOTS}</td>
      </tr></table>`;

  return `<div style="${BODY}">
    <div style="text-align:right;font-size:10.5pt;margin-bottom:10pt">Our ref: ${val(i.fileRef)}</div>
    ${intitulement}
    <div style="text-align:center;font-weight:bold;font-size:14pt;letter-spacing:1px;text-decoration:underline;margin:0 0 14pt">WARRANT TO ACT</div>
    <p style="${P}">To:<br/><strong>Messrs. ${firm}</strong><br/>Advocates &amp; Solicitors${i.firmAddress ? '<br/>' + esc(i.firmAddress) : ''}</p>
    <p style="${P}">Dear Sirs,</p>
    <p style="${P};font-weight:bold">RE: ${val(i.matterTitle).toUpperCase()}</p>
    <table style="width:100%;border-collapse:collapse">${clauses.map((c, n) => `<tr><td style="width:24pt;vertical-align:top;padding:0 0 9pt">${n + 1}.</td><td style="vertical-align:top;padding:0 0 9pt;text-align:justify">${c}</td></tr>`).join('')}</table>
    <p style="${P};margin-top:12pt">Dated this ${val(i.date)}.</p>
    ${sign}
    <div style="margin-top:26pt;border-top:1px solid #000;padding-top:8pt">
      <strong>ACCEPTANCE</strong><br/>We, Messrs. ${firm}, accept the above appointment.<br/><br/><br/>…………………………………………<br/>Partner, for and on behalf of Messrs. ${firm}<br/>Date: ${DOTS}
    </div>
  </div>`;
}
