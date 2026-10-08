/**
 * Warrant to Act / Waran untuk Bertindak: the client's written authority for the firm to act.
 *
 * The clauses are the firm's own Bahasa Malaysia warrant (Autoriti, Fi Guaman dan kos-kos
 * pengeluaran berkaitan, Penamatan servis, Indemniti, Had Tanggungjawab, confirmation and
 * signature), used word for word in BM; the English version is a faithful translation of it.
 * Built from real client / file details; anything not recorded is left as a dotted blank to fill
 * in by hand. Pure (no React, no settings): used on its own (standalone warrant) and as the last
 * page of the Quotation & Letter of Engagement (lib/engagementLetter).
 */
export type DocLang = 'EN' | 'BM';

export interface WarrantInput {
  client: { name: string; type?: 'Individual' | 'Corporate'; idNo?: string; address?: string };
  matterTitle: string;
  side?: string;
  court?: string;
  suitNo?: string;
  /** Other party (shown with the court heading when there is a suit). */
  otherParty?: string;
  fileRef?: string;
  firmName?: string;
  firmAddress?: string;
  date: string;
  /** EN (default) or BM. */
  lang?: DocLang;
  /** Letterhead HTML placed above the warrant when it is printed on its own. */
  letterhead?: string;
}

export const esc = (s: string | undefined | null) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const DOTS = '<span style="letter-spacing:1px">……………………………</span>';
const val = (v: string | undefined) => (v && v.trim() ? esc(v.trim()) : DOTS);

export const BODY = "font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.45;color:#000";
const P = 'margin:0 0 9pt;text-align:justify';
const H = 'margin:10pt 0 2pt;font-weight:bold;text-decoration:underline';

/** Pronouns for an individual, a company, or unknown (both, as on the firm's form). */
const pron = (type: WarrantInput['client']['type'], lang: DocLang) => {
  if (lang === 'BM') {
    const w = type === 'Corporate' ? 'Kami' : type === 'Individual' ? 'Saya' : 'Saya/Kami';
    return { S: w, s: w.toLowerCase() };
  }
  if (type === 'Corporate') return { S: 'We', s: 'we', me: 'us', my: 'our', am: 'are' };
  if (type === 'Individual') return { S: 'I', s: 'I', me: 'me', my: 'my', am: 'am' };
  return { S: 'I/We', s: 'I/we', me: 'me/us', my: 'my/our', am: 'am/are' };
};

/** The warrant's sections: [heading, paragraph html]. */
export const warrantClauses = (i: Pick<WarrantInput, 'client' | 'firmName' | 'lang'>): [string, string][] => {
  const firm = esc((i.firmName || 'Syafiqah Hamizad & Co').replace(/\.+$/, ''));
  const T = `<strong>Tetuan ${firm}.</strong>`;
  if ((i.lang || 'EN') === 'BM') {
    const { S, s } = pron(i.client.type, 'BM');
    return [
      ['Autoriti', `${S} dengan ini memberi kuasa dan melantik <strong>Tetuan ${firm}.,</strong> dan/atau mana-mana peguam yang terlibat untuk mewakili dan/atau bertindak bagi pihak ${s} dalam perkara yang dinyatakan di atas dan menyediakan dan menguruskan semua perkara berkaitan dan/atau sebarang rundingan dan/atau perbincangan, dan/atau berurusan dengan semua pihak ketiga yang berkaitan termasuk agensi kerajaan, institusi kewangan, atau mana-mana pihak berkuasa lain yang berkaitan dengan perkara ini.`],
      ['Fi Guaman dan kos-kos pengeluaran berkaitan', `${S} mengakui dan bersetuju bahawa ${s} bertanggungjawab membayar semua yuran guaman, kos, dan perbelanjaan yang berkaitan dengan perkara ini. Dengan perlantikan ini, jumlah pembayaran awal <em>(retainer)</em> adalah tidak dikembalikan. ${S} juga bersetuju bahawa firma ini berhak untuk menolak sebarang yuran dan perbelanjaan yang belum dijelaskan daripada sebarang bayaran yang diterima oleh ${s} melalui ${T} berhubung dengan perkara ini sehingga semua tunggakan diselesaikan, sepertimana Aturan 9.02 Kaedah Majlis Peguam. Sebarang kegagalan untuk membuat pembayaran dalam masa yang ditetapkan boleh menyebabkan kelewatan atau penggantungan dalam perkhidmatan guaman.`],
      ['Penamatan servis', `${S} faham bahawa mana-mana pihak boleh menamatkan perkhidmatan ini dengan memberikan notis bertulis. Sekiranya penamatan berlaku, ${s} bersetuju untuk menjelaskan semua yuran guaman dan perbelanjaan yang masih belum dibayar sehingga tarikh penamatan.`],
      ['Indemniti', `${S} selanjutnya bersetuju untuk indemniti dan memastikan ${T} tidak mengalami sebarang tuntutan, dakwaan, kerugian, liabiliti, ganti rugi, kos dan perbelanjaan (termasuk yuran guaman atas dasar peguam-anak guam) yang timbul daripada atau berkaitan dengan sebarang arahan yang diberikan oleh ${s}, sebarang tindakan, ketinggalan, keingkaran atau salah nyataan oleh ${s}, atau sebarang langkah yang diambil secara wajar oleh firma dalam mewakili ${s}. ${S} juga mengakui bahawa ${s} tidak akan mempunyai sebarang tuntutan atau hak tindakan terhadap ${T} berkenaan dengan sebarang kerugian, kerosakan, perbelanjaan atau akibat buruk dalam apa jua bentuk yang ${s} alami, kecuali jika kerugian tersebut berpunca secara langsung daripada kecuaian melampau, penipuan, atau salah laku disengajakan oleh firma.`],
      ['Had Tanggungjawab', `${S} mengakui bahawa tanggungjawab firma guaman ini adalah terhad sebagaimana yang dibenarkan oleh undang-undang dan tidak termasuk sebarang kerugian tidak langsung atau kerugian berbangkit yang dialami oleh ${s} berhubung perkhidmatan yang diberikan.`],
      ['', `${S} mengesahkan bahawa ${s} telah membaca dan memahami kandungan Waran untuk Bertindak ini dan bersetuju untuk terikat dengan terma-terma yang dinyatakan.`],
    ];
  }
  const { S, s, me, my, am } = pron(i.client.type, 'EN') as { S: string; s: string; me: string; my: string; am: string };
  const M = `<strong>Messrs. ${firm}.</strong>`;
  return [
    ['Authority', `${S} hereby authorise and appoint <strong>Messrs. ${firm}.,</strong> and/or any of its lawyers involved, to represent and/or act on ${my} behalf in the matter stated above and to prepare and attend to all related matters and/or any negotiations and/or discussions, and/or to deal with all relevant third parties, including government agencies, financial institutions or any other authority, in connection with this matter.`],
    ['Legal fees and related disbursements', `${S} acknowledge and agree that ${s} ${am} responsible for paying all legal fees, costs and expenses relating to this matter. Upon this appointment, the initial payment <em>(retainer)</em> is non-refundable. ${S} also agree that the Firm is entitled to deduct any unpaid fees and expenses from any money received by ${me} through ${M} in connection with this matter until all arrears are settled, in accordance with Rule 9.02 of the Bar Council Rules. Any failure to make payment within the time stipulated may cause delay in, or suspension of, the legal services.`],
    ['Termination of services', `${S} understand that either party may terminate these services by giving written notice. If termination occurs, ${s} agree to settle all legal fees and expenses that remain unpaid up to the date of termination.`],
    ['Indemnity', `${S} further agree to indemnify and hold ${M} harmless against any claims, demands, losses, liabilities, damages, costs and expenses (including legal fees on a solicitor-and-client basis) arising from or in connection with any instructions given by ${me}, any act, omission, default or misrepresentation by ${me}, or any step reasonably taken by the Firm in representing ${me}. ${S} also acknowledge that ${s} shall have no claim or right of action against ${M} in respect of any loss, damage, expense or adverse consequence of any kind suffered by ${me}, except where such loss arises directly from the gross negligence, fraud or wilful misconduct of the Firm.`],
    ['Limitation of liability', `${S} acknowledge that the liability of this law firm is limited to the extent permitted by law and does not include any indirect or consequential loss suffered by ${me} in connection with the services provided.`],
    ['', `${S} confirm that ${s} have read and understood the contents of this Warrant to Act and agree to be bound by the terms stated herein.`],
  ];
};

/** Labels for the warrant heading and signature, per language. */
const L = (lang: DocLang) => lang === 'BM'
  ? { title: 'WARAN UNTUK BERTINDAK', per: 'Per', inMatter: 'DALAM PERKARA', suit: 'NO. GUAMAN', client: 'Anakguam', v: 'LWN', ref: 'Rujukan Kami', sign: 'Tandatangan', name: 'Nama', ic: 'No. K/P.', co: 'No. Syarikat', date: 'Tarikh', desig: 'Jawatan', stamp: 'Cop syarikat', forCo: 'Bagi pihak' }
  : { title: 'WARRANT TO ACT', per: 'Re', inMatter: 'IN THE MATTER OF', suit: 'SUIT NO.', client: 'Client', v: 'V', ref: 'Our Ref', sign: 'Signature', name: 'Name', ic: 'NRIC No.', co: 'Company No.', date: 'Date', desig: 'Designation', stamp: 'Company stamp', forCo: 'For and on behalf of' };

/** The warrant body (heading, clauses, signature) without letterhead. */
export function warrantBodyHtml(i: WarrantInput): string {
  const lang = i.lang || 'EN';
  const t = L(lang);
  const co = i.client.type === 'Corporate';
  const suit = !!(i.suitNo && i.suitNo.trim());
  const sideTxt = i.side ? ' (' + esc(i.side) + ')' : '';
  const perLines = suit
    ? [`${t.inMatter} ${val(i.court).toUpperCase()}`, `${t.suit}: ${val(i.suitNo)}`, ...(i.otherParty && i.otherParty.trim() ? [`${esc(i.client.name).toUpperCase()}${sideTxt} ${t.v} ${esc(i.otherParty.trim()).toUpperCase()}`] : [])]
    : [val(i.matterTitle).toUpperCase()];
  const idLine = co ? `${t.co}: ${val(i.client.idNo)}` : `${t.ic}: ${val(i.client.idNo)}`;
  const head = `<table style="border-collapse:collapse;margin:0 auto 12pt;font-weight:bold">
      <tr><td style="vertical-align:top;padding:0 10pt 2pt 0;white-space:nowrap">${t.per}:</td><td style="vertical-align:top;padding:0 0 2pt">${perLines.join('<br/>')}</td></tr>
      <tr><td style="vertical-align:top;padding:8pt 10pt 0 0;white-space:nowrap">${t.client}:</td><td style="vertical-align:top;padding:8pt 0 0">${val(i.client.name).toUpperCase()}${sideTxt}</td></tr>
    </table>`;
  const sections = warrantClauses(i).map(([h, p]) => `${h ? `<p style="${H}">${h}</p>` : ''}<p style="${P}${h ? '' : ';margin-top:12pt'}">${p}</p>`).join('');
  const sign = co
    ? `<p style="margin:22pt 0 0"><strong>${t.sign}:</strong></p><p style="margin:36pt 0 0">______________________________<br/>${t.forCo} <strong>${val(i.client.name)}</strong> (${idLine})<br/>${t.name}: ${DOTS}<br/>${t.ic}: ${DOTS}<br/>${t.desig}: ${DOTS}<br/>${t.date}: ${DOTS}<br/>${t.stamp}:</p>`
    : `<p style="margin:22pt 0 0"><strong>${t.sign}:</strong></p><p style="margin:36pt 0 0">______________________________<br/>${t.name}: ${val(i.client.name)}<br/>${t.ic}: ${val(i.client.idNo)}<br/>${t.date}: ${DOTS}</p>`;
  return `<div style="${BODY}">
    ${i.fileRef ? `<div style="text-align:right;font-size:10.5pt;margin-bottom:8pt">${t.ref}: ${esc(i.fileRef)}</div>` : ''}
    <div style="text-align:center;font-weight:bold;font-size:15pt;letter-spacing:.5px;margin:0 0 12pt">${t.title}</div>
    ${head}
    ${sections}
    ${sign}
  </div>`;
}

/** The warrant on its own (A4, Times New Roman 12pt) for view, PDF/print and Word. */
export function warrantToActHtml(i: WarrantInput): string {
  return (i.letterhead || '') + warrantBodyHtml(i);
}
