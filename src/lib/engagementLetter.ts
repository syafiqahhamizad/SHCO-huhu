/**
 * Quotation & Letter of Engagement (Sebut Harga & Surat Perlantikan) — one client document per
 * quotation, in English or Bahasa Malaysia, with the Warrant to Act as its last page.
 *
 *   letterhead (partners column) → bilingual Your Ref / Our Ref / Date → addressee → salutation
 *   → RE: (matter, court, suit no., parties) → appreciation → 1 Scope → 2 Team → 3 Fees (the real
 *   quotation lines) → 4 Payment plan (full / stages / monthly instalments) → 5 Terms → Yours
 *   faithfully → acceptance → page break → Warrant to Act.
 *
 * Fee figures only ever come from a real quotation: with no `fees` the fee and payment sections
 * are left out. Pure (no React, no settings, no Firebase) so it is unit-tested; the screens build
 * the input from the quotation, the file, the client record and Firm & Practice Settings.
 */
import type { QuotationPaymentPlan, QuotationPaymentStage } from '../types';
import { splitSst } from './billingEngine';
import { BODY, DOTS, esc, warrantBodyHtml, type DocLang, type WarrantInput } from './warrantToAct';

export type { DocLang } from './warrantToAct';
export type FeeLine = [string, number];

/* ------------------------------------------------------------------ payment plan */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Monthly instalment schedule: month 1 is the upfront payment, the last month takes the rounding. */
export const schedule = (total: number, months: number, upfront: number): [string, number][] => {
  total = Math.max(0, r2(total)); months = Math.max(1, Math.min(24, Math.round(months || 1))); upfront = Math.min(total, Math.max(0, upfront || 0));
  if (total === 0) return [['Month 1 (Full Payment)', 0]];
  if (months === 1) return [['Month 1 (Full Payment)', total]];
  const first = upfront || r2(total / months);
  const each = Math.max(0, Math.floor((total - first) / (months - 1)));
  const out: [string, number][] = [['Month 1 (Upfront Payment)', first]];
  for (let i = 2; i < months; i++) out.push(['Month ' + i, each]);
  out.push(['Month ' + months, r2(total - first - each * (months - 2))]);
  return out;
};

export const ARR_TERMS = 'Early Settlement: In the event the matter is settled before the completion of the instalment period, all payments made shall be non-refundable, and the outstanding balance for the remaining unpaid months shall be charged at ten per cent (10%) of the settlement sum.\nDisbursements & Reimbursements: Charged in accordance with the agreed quotation. Any additional disbursements and/or reimbursements incurred shall be notified to and borne by the Client, and any unused portion of disbursements paid shall be refunded to the Client accordingly.\nWork shall not proceed if instalment payments are not settled, unless otherwise agreed in writing.';
/** BM translation of ARR_TERMS (used in BM documents when the terms were not changed). */
export const ARR_TERMS_BM = 'Penyelesaian Awal: Sekiranya perkara ini diselesaikan sebelum tamat tempoh ansuran, semua bayaran yang telah dibuat tidak akan dikembalikan, dan baki tertunggak bagi bulan-bulan yang belum dibayar akan dikenakan sebanyak sepuluh peratus (10%) daripada jumlah penyelesaian.\nPengeluaran & Bayaran Balik: Dikenakan menurut sebut harga yang dipersetujui. Sebarang pengeluaran dan/atau bayaran balik tambahan yang dilakukan akan dimaklumkan kepada dan ditanggung oleh Anakguam, dan sebarang baki pengeluaran yang telah dibayar tetapi tidak digunakan akan dikembalikan kepada Anakguam sewajarnya.\nKerja tidak akan diteruskan sekiranya bayaran ansuran tidak dijelaskan, melainkan dipersetujui sebaliknya secara bertulis.';

/** Litigation stages (editable on the quotation). Equal shares until the firm changes them. */
export const DEFAULT_LIT_STAGES: QuotationPaymentStage[] = [
  { label: 'Filing', pct: 25, due: 'On signing this letter, before filing' },
  { label: 'Pleadings', pct: 25, due: 'On close of pleadings' },
  { label: 'Trial', pct: 25, due: 'Before the trial dates' },
  { label: 'Decision', pct: 25, due: 'On decision' },
];
/** BM wording for the default stage labels / due dates (anything the firm typed is printed as typed). */
const STAGE_BM: Record<string, string> = {
  Filing: 'Pemfailan', Pleadings: 'Pliding', Trial: 'Perbicaraan', Decision: 'Keputusan',
  'On signing this letter, before filing': 'Semasa menandatangani surat ini, sebelum pemfailan', 'On close of pleadings': 'Selepas pliding ditutup',
  'Before the trial dates': 'Sebelum tarikh perbicaraan', 'On decision': 'Semasa keputusan diberikan',
};
const isLit = (area?: string) => /litig|civil|criminal|dispute|^l$/i.test(String(area || '').trim());
/** Litigation defaults to stages; every other area to payment in full. */
export const defaultPlanFor = (area?: string): QuotationPaymentPlan => (isLit(area) ? { kind: 'Stages', stages: DEFAULT_LIT_STAGES.map((s) => ({ ...s })) } : { kind: 'Full' });

/** A stage priced in RM (rather than as a % of the total). */
export const hasAmt = (s: QuotationPaymentStage) => typeof s.amount === 'number' && Number.isFinite(s.amount);

export interface PlanRow { key: string; label: string; amount: number; pct?: number; due?: string }
/** The rows the client pays (one proforma each): stages, months, or a single full payment. */
export const planRows = (plan: QuotationPaymentPlan | undefined, total: number): PlanRow[] => {
  total = r2(total);
  const p = plan || { kind: 'Full' };
  if (p.kind === 'Stages' && (p.stages || []).length) {
    const st = p.stages || [];
    const rows: PlanRow[] = st.map((s, i) => ({ key: 'stage:' + i, label: s.label || 'Stage ' + (i + 1), amount: hasAmt(s) ? r2(Number(s.amount)) : r2((total * (Number(s.pct) || 0)) / 100), pct: hasAmt(s) ? undefined : Number(s.pct) || 0, due: s.due }));
    // All by percentage adding up to 100%: the last row takes the rounding so the rows add up to the total.
    const allPct = st.every((s) => !hasAmt(s)) && Math.abs(st.reduce((a, s) => a + (Number(s.pct) || 0), 0) - 100) < 0.001;
    if (allPct && rows.length) rows[rows.length - 1].amount = r2(total - rows.slice(0, -1).reduce((a, r) => a + r.amount, 0));
    return rows;
  }
  if (p.kind === 'Instalments') return schedule(total, p.months || 1, p.upfront || 0).map(([label, amount], i) => ({ key: 'month:' + (i + 1), label, amount }));
  return [{ key: 'full', label: 'Full payment', amount: total }];
};
/** Sum of the plan rows (to warn when stages do not add up to the quotation total). */
export const planTotal = (plan: QuotationPaymentPlan | undefined, total: number) => r2(planRows(plan, total).reduce((a, r) => a + r.amount, 0));

/* ------------------------------------------------------------------ letterhead */

export interface LetterheadPartner { name: string; quals: string; syarie?: boolean }
/** Partners printed on the firm letterhead (Firm & Practice Settings › Firm & Letterhead). */
export const DEFAULT_LETTERHEAD_PARTNERS: LetterheadPartner[] = [
  { name: 'NURUL SYAFIQAH BINTI HAMIZAD', quals: 'Dip. in Law UniSZA, LLB (Hons) UniSZA, DIJAP USIM' },
  { name: 'NUR WAHIDAH KAMILAH BINTI RAZALLI', quals: 'Dip. in Law UniSZA, LLB (Hons) UniSZA' },
  { name: 'SITI ZULAIKHA BINTI AFENDI', quals: 'LLB (Hons) UniSZA' },
  { name: 'AMER HAIQAL BIN MOHD YUSOF', quals: 'LLB (Hons) UniSZA, DIJAP USIM' },
  { name: 'KHAIRUNNISA BINTI SHOBAT SETTIC', quals: 'LLB & Shariah (Hons), USIM', syarie: true },
];

export interface LetterheadInfo {
  /** Uploaded letterhead header image of the file's branch (data URL), if any. */
  image?: string;
  /** Built-in logo artwork when there is no uploaded header. */
  logo?: string;
  firmName: string;
  tag1?: string;
  tag2?: string;
  reg?: string;
  address: string;
  email?: string;
  tel?: string;
  partners: LetterheadPartner[];
}

const HDR = "font-family:Georgia,'Times New Roman',serif;color:#16223A";
const partnersColumn = (ps: LetterheadPartner[]) => {
  const blk = (title: string, l: LetterheadPartner[]) => (l.length ? `<div style="font-weight:bold;letter-spacing:.5px;margin:0 0 3pt">${title}</div>${l.map((p) => `<div style="margin:0 0 4pt"><div style="font-weight:bold">${esc(p.name)}</div><div>${esc(p.quals)}</div></div>`).join('')}` : '');
  return blk('PARTNERS', ps.filter((p) => !p.syarie)) + (ps.some((p) => p.syarie) ? '<div style="height:3pt"></div>' : '') + blk(ps.filter((p) => p.syarie).length > 1 ? 'SYARIE PARTNERS' : 'SYARIE PARTNER', ps.filter((p) => p.syarie));
};
/** Letterhead: firm block (uploaded header image or built-in name, taglines and address) with the partners column. */
export const letterheadHtml = (lh: LetterheadInfo): string => {
  const firm = lh.image
    ? `<img src="${esc(lh.image)}" alt="${esc(lh.firmName)}" style="width:100%;max-width:470px;height:auto;display:block">`
    : `${lh.logo ? `<img src="${esc(lh.logo)}" alt="${esc(lh.firmName)}" width="240" style="width:240px;height:auto;display:block">` : `<div style="font-size:18pt;font-weight:bold;letter-spacing:1px">${esc(lh.firmName)}</div>`}<div style="font-size:8.5pt;font-style:italic;color:#3D6B9C;line-height:1.4;margin-top:4px">${esc(lh.tag1 || '')}${lh.tag2 ? '<br>' + esc(lh.tag2) : ''}</div>`;
  const contact = `<div style="font-size:7.5pt;line-height:1.5;color:#5B6478;margin-top:5px">${lh.reg ? esc(lh.reg) + '<br>' : ''}${esc(lh.address)}${lh.email || lh.tel ? '<br>' + [lh.email, lh.tel].filter(Boolean).map((x) => esc(x)).join(' · ') : ''}</div>`;
  return `<table style="width:100%;border-collapse:collapse;${HDR}"><tr><td style="vertical-align:top;padding:0">${firm}${lh.image ? '' : contact}</td>${lh.partners.length ? `<td style="vertical-align:top;padding:0 0 0 10px;width:190px;border-left:1px solid #16223A;font-family:Arial,Helvetica,sans-serif;font-size:6.5pt;line-height:1.3;color:#16223A">${partnersColumn(lh.partners)}</td>` : ''}</tr></table><div style="border-top:2px solid #16223A;margin:10px 0 14px"></div>`;
};

/* ------------------------------------------------------------------ the letter */

export interface EngagementInput {
  lang: DocLang;
  letterhead: LetterheadInfo;
  quotationNo?: string;
  ourRef?: string;
  yourRef?: string;
  /** Date printed on the letter (already formatted, e.g. longDate()). */
  date: string;
  client: { name: string; type?: 'Individual' | 'Corporate'; idNo?: string; address?: string; email?: string; contactPerson?: string };
  matter: { title: string; court?: string; suitNo?: string; side?: string; otherParty?: string };
  /** Scope of work (the quotation's own scope, else the practice-area description). */
  scope?: string;
  /** Partners and lawyers on the file, by name. */
  team: { name: string; role: 'Partner' | 'Lawyer' }[];
  /** The real quotation lines. Omitted → no fee or payment section. */
  fees?: { prof: FeeLine[]; disb: FeeLine[]; reimb: FeeLine[]; sstRate: number };
  plan?: QuotationPaymentPlan;
  /** Instalment terms ("Heading: text" per line); defaults to ARR_TERMS / ARR_TERMS_BM. */
  instalmentTerms?: string;
  /** Office account the client pays into: [account name, bank, account no.]. */
  bank?: [string, string, string];
  firmName?: string;
  /** Leave out the Warrant to Act page (default: included). */
  noWarrant?: boolean;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_BM = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
/** "9 October 2026" / "9 Oktober 2026". */
export const longDate = (d: Date, lang: DocLang = 'EN') => `${d.getDate()} ${(lang === 'BM' ? MONTHS_BM : MONTHS_EN)[d.getMonth()]} ${d.getFullYear()}`;

const num = (n: number) => (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WORDS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four'];
const WORDS_BM = ['kosong', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'lapan belas', 'sembilan belas', 'dua puluh', 'dua puluh satu', 'dua puluh dua', 'dua puluh tiga', 'dua puluh empat'];

/** Opposite side, for the RE: block ("PLAINTIFF: … / DEFENDANT: …"). */
const OPPOSITE: Record<string, string> = { plaintiff: 'Defendant', defendant: 'Plaintiff', appellant: 'Respondent', respondent: 'Applicant', applicant: 'Respondent', plaintif: 'Defendan', defendan: 'Plaintif', pemohon: 'Responden', responden: 'Pemohon', purchaser: 'Vendor', vendor: 'Purchaser', landlord: 'Tenant', tenant: 'Landlord', buyer: 'Seller', seller: 'Buyer' };

const TX = {
  EN: {
    title: 'QUOTATION & LETTER OF ENGAGEMENT', yourRef: 'Your Ref', ourRef: 'Our Ref', date: 'Date', quot: 'Quotation No.', byHand: 'BY HAND / EMAIL', attn: 'Attention', dear: 'Dear Sir/Madam,',
    re: 'RE', inMatter: 'IN THE MATTER OF', suit: 'SUIT NO.', other: 'OTHER PARTY', client: 'CLIENT',
    thanks: 'Thank you for your instructions and for the opportunity to act for you in the above matter. We set out below the scope of our engagement, our proposed fees and the terms on which we will act. Together with the Warrant to Act at the end, this letter forms our agreement with you.',
    scope: 'Scope of legal services', scopeLead: 'Our legal services will principally involve the following:-', scopeNone: 'As discussed with you and set out in our quotation.',
    team: 'Our team', teamLead: 'The lawyers principally responsible for this matter are:', partner: 'Partner', lawyer: 'Lawyer', teamNote: 'We will inform you of any change in the team.', teamNone: 'The partner in charge of this file will inform you of the lawyers handling the matter.',
    fees: 'Proposed fees', feesLead: 'Our fees for the scope of work above, as set out in our quotation', desc: 'DESCRIPTION', amt: 'AMOUNT (RM)', prof: 'Professional fees', disb: 'Disbursements', reimb: 'Reimbursements', sub: 'Sub-total', net: 'Total (excluding SST)', sst: (p: number) => `SST @ ${p}% (on professional fees & reimbursements)`, sstNa: 'SST: Not applicable', total: 'TOTAL',
    feeNotes: ['Disbursements are paid to third parties (court, land office, searches and the like) at cost; any unused balance will be refunded to you.', 'Work outside the scope above, or required by events beyond our control, will be charged separately and quoted to you first.'],
    plan: 'Payment plan', full: (t: string) => `The total sum of <b>RM${t}</b> is payable in full upon your acceptance of this letter, before we commence work.`,
    stagesLead: (t: string) => `The total sum of <b>RM${t}</b> is payable in stages as follows:`, no: 'No.', stage: 'Stage', pct: '%', when: 'When payable',
    instLead: (t: string, n: number, w: string) => `The total sum of <b>RM${t}</b> (inclusive of disbursements and reimbursements) is payable by monthly instalments over ${w} (${n}) months:`, month: 'Month', upfront: 'Upfront Payment', fullPay: 'Full Payment', instTerms: 'Instalment terms',
    pay: 'Payment to be made by transfer to:', accName: 'Name', bank: 'Bank', accNo: 'Account No.',
    terms: 'Terms of engagement',
    termList: [
      ['Billing', 'Our invoices are payable within fourteen (14) days of the date of the invoice. We may issue interim invoices and proformas as the matter progresses, in line with the payment plan above and subject to our quotation.'],
      ['Initial payment and retainer', 'We will commence work upon receipt of the signed letter, the signed Warrant to Act and the first payment under the payment plan, which includes the initial disbursements. Upon this appointment, the initial payment (retainer) is non-refundable.'],
      ['Deduction of unpaid fees', 'The Firm is entitled to deduct any unpaid fees and expenses from any money received by you through the Firm in connection with this matter until all arrears are settled, in accordance with Rule 9.02 of the Bar Council Rules. Failure to pay within the time stipulated may cause delay in, or suspension of, our services.'],
      ['Termination', 'Either party may terminate this engagement by written notice. You will pay our fees for work done and all disbursements and expenses incurred up to the date of termination. We may also terminate this engagement if our invoices or requests for payment are not settled within the time set out above, if these terms are not honoured, or where professional or legal rules require it.'],
      ['Indemnity', 'You agree to indemnify the Firm against any claims, losses, liabilities, costs and expenses arising from your instructions or from any act, omission, default or misrepresentation on your part, as set out in full in the Warrant to Act below.'],
      ['Limitation of liability', 'Our liability is limited to the extent permitted by law and does not include any indirect or consequential loss, save for loss arising directly from our gross negligence, fraud or wilful misconduct, as set out in the Warrant to Act below.'],
      ['Governing law', 'This letter and all matters arising from or connected with it are governed by the laws of Malaysia, and the courts of Malaysia shall have exclusive jurisdiction.'],
    ] as [string, string][],
    close: 'If the above is acceptable to you, kindly sign the acceptance below and the Warrant to Act, and return a copy of this letter to us. Should you have any questions, please do not hesitate to contact the undersigned.',
    yf: 'Yours faithfully,', fob: 'for and on behalf of', accept: (we: string) => `${we} hereby confirm acceptance of all the above terms and conditions.`, sign: 'Signature', name: 'Name', ic: 'NRIC No.', date2: 'Date', desig: 'Designation', dulyAuth: 'duly authorised signatory of', stamp: 'Company stamp',
  },
  BM: {
    title: 'SEBUT HARGA & SURAT PERLANTIKAN', yourRef: 'Rujukan Tuan', ourRef: 'Rujukan Kami', date: 'Tarikh', quot: 'No. Sebut Harga', byHand: 'SERAHAN TANGAN / E-MEL', attn: 'U.P.', dear: 'Tuan/Puan,',
    re: 'PER', inMatter: 'DALAM PERKARA', suit: 'NO. GUAMAN', other: 'PIHAK LAWAN', client: 'ANAKGUAM',
    thanks: 'Terima kasih atas arahan tuan/puan dan peluang yang diberikan kepada kami untuk bertindak bagi pihak tuan/puan dalam perkara di atas. Bersama-sama ini kami nyatakan skop perkhidmatan, cadangan fi guaman dan terma-terma perlantikan kami. Surat ini, bersama Waran untuk Bertindak di bahagian akhir, merupakan perjanjian kami dengan tuan/puan.',
    scope: 'Skop perkhidmatan guaman', scopeLead: 'Perkhidmatan guaman kami secara amnya melibatkan perkara-perkara berikut:-', scopeNone: 'Seperti yang telah dibincangkan dengan tuan/puan dan dinyatakan dalam sebut harga kami.',
    team: 'Pasukan kami', teamLead: 'Peguam yang bertanggungjawab secara langsung bagi perkara ini ialah:', partner: 'Rakan Kongsi', lawyer: 'Peguam', teamNote: 'Kami akan memaklumkan tuan/puan sekiranya terdapat sebarang perubahan dalam pasukan ini.', teamNone: 'Rakan kongsi yang menguruskan fail ini akan memaklumkan tuan/puan peguam yang mengendalikan perkara ini.',
    fees: 'Cadangan fi guaman', feesLead: 'Fi guaman kami bagi skop kerja di atas, sebagaimana dalam sebut harga kami', desc: 'BUTIRAN', amt: 'JUMLAH (RM)', prof: 'Fi profesional', disb: 'Pengeluaran (disbursement)', reimb: 'Bayaran balik (reimbursement)', sub: 'Jumlah kecil', net: 'Jumlah (tidak termasuk SST)', sst: (p: number) => `SST @ ${p}% (atas fi profesional & bayaran balik)`, sstNa: 'SST: Tidak berkenaan', total: 'JUMLAH KESELURUHAN',
    feeNotes: ['Pengeluaran ialah bayaran kepada pihak ketiga (mahkamah, pejabat tanah, carian dan seumpamanya) pada kos sebenar; sebarang baki yang tidak digunakan akan dikembalikan kepada tuan/puan.', 'Kerja di luar skop di atas, atau yang diperlukan akibat perkara di luar kawalan kami, akan dikenakan secara berasingan dan dimaklumkan kepada tuan/puan terlebih dahulu.'],
    plan: 'Pelan pembayaran', full: (t: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> hendaklah dibayar sepenuhnya selepas tuan/puan menerima surat ini, sebelum kami memulakan kerja.`,
    stagesLead: (t: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> hendaklah dibayar mengikut peringkat seperti berikut:`, no: 'Bil.', stage: 'Peringkat', pct: '%', when: 'Bila perlu dibayar',
    instLead: (t: string, n: number, w: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> (termasuk pengeluaran dan bayaran balik) hendaklah dibayar secara ansuran bulanan selama ${w} (${n}) bulan:`, month: 'Bulan', upfront: 'Bayaran Pendahuluan', fullPay: 'Bayaran Penuh', instTerms: 'Terma ansuran',
    pay: 'Bayaran hendaklah dibuat melalui pindahan ke akaun berikut:', accName: 'Nama', bank: 'Bank', accNo: 'No. Akaun',
    terms: 'Terma-terma perlantikan',
    termList: [
      ['Pengebilan', 'Invois kami hendaklah dijelaskan dalam tempoh empat belas (14) hari dari tarikh invois. Kami boleh mengeluarkan invois interim dan invois proforma mengikut perkembangan perkara ini, selaras dengan pelan pembayaran di atas dan tertakluk kepada sebut harga kami.'],
      ['Bayaran awal dan retainer', 'Kami akan memulakan kerja setelah menerima surat ini dan Waran untuk Bertindak yang telah ditandatangani serta bayaran pertama di bawah pelan pembayaran, termasuk pengeluaran awal. Dengan perlantikan ini, jumlah pembayaran awal (retainer) adalah tidak dikembalikan.'],
      ['Penolakan fi yang belum dijelaskan', 'Firma ini berhak untuk menolak sebarang yuran dan perbelanjaan yang belum dijelaskan daripada sebarang bayaran yang diterima oleh tuan/puan melalui firma ini berhubung dengan perkara ini sehingga semua tunggakan diselesaikan, sepertimana Aturan 9.02 Kaedah Majlis Peguam. Sebarang kegagalan untuk membuat pembayaran dalam masa yang ditetapkan boleh menyebabkan kelewatan atau penggantungan dalam perkhidmatan guaman.'],
      ['Penamatan', 'Mana-mana pihak boleh menamatkan perlantikan ini dengan memberikan notis bertulis. Tuan/puan hendaklah menjelaskan fi bagi kerja yang telah dilakukan serta semua pengeluaran dan perbelanjaan yang ditanggung sehingga tarikh penamatan. Kami juga boleh menamatkan perlantikan ini sekiranya invois atau permintaan bayaran kami tidak dijelaskan dalam masa yang ditetapkan di atas, sekiranya terma-terma ini tidak dipatuhi, atau sekiranya dikehendaki oleh peraturan profesional atau undang-undang.'],
      ['Indemniti', 'Tuan/puan bersetuju untuk mengindemnikan firma ini terhadap sebarang tuntutan, kerugian, liabiliti, kos dan perbelanjaan yang timbul daripada arahan tuan/puan atau daripada sebarang tindakan, ketinggalan, keingkaran atau salah nyataan oleh tuan/puan, sebagaimana dinyatakan sepenuhnya dalam Waran untuk Bertindak di bawah.'],
      ['Had tanggungjawab', 'Tanggungjawab kami adalah terhad sebagaimana yang dibenarkan oleh undang-undang dan tidak termasuk sebarang kerugian tidak langsung atau kerugian berbangkit, kecuali kerugian yang berpunca secara langsung daripada kecuaian melampau, penipuan atau salah laku disengajakan oleh kami, sebagaimana dinyatakan dalam Waran untuk Bertindak di bawah.'],
      ['Undang-undang yang terpakai', 'Surat ini dan semua perkara yang timbul daripadanya atau berkaitan dengannya adalah tertakluk kepada undang-undang Malaysia, dan mahkamah Malaysia mempunyai bidang kuasa eksklusif.'],
    ] as [string, string][],
    close: 'Sekiranya perkara di atas dipersetujui, sila tandatangan pengesahan di bawah dan Waran untuk Bertindak, dan kembalikan salinan surat ini kepada kami. Sekiranya tuan/puan mempunyai sebarang pertanyaan, sila hubungi kami.',
    yf: 'Yang benar,', fob: 'bagi pihak', accept: (we: string) => `${we} dengan ini mengesahkan penerimaan semua terma dan syarat di atas.`, sign: 'Tandatangan', name: 'Nama', ic: 'No. K/P.', date2: 'Tarikh', desig: 'Jawatan', stamp: 'Cop syarikat', dulyAuth: 'penandatangan yang diberi kuasa bagi',
  },
};

const F = 'font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.4;color:#000';
const TD = 'border:1px solid #000;padding:4px 8px;vertical-align:top';
const lines = (s?: string) => esc(s || '').replace(/\s*\n\s*/g, '<br>');
const sumL = (l: FeeLine[]) => r2(l.reduce((a, x) => a + (Number(x[1]) || 0), 0));

/** Totals of the quotation lines — same SST rule as billingEngine (fees + reimbursements only). */
export const feeTotals = (f: NonNullable<EngagementInput['fees']>) => {
  const prof = sumL(f.prof), disb = sumL(f.disb), reimb = sumL(f.reimb);
  const { sst } = splitSst(prof, reimb, f.sstRate || 0);
  const net = r2(prof + disb + reimb);
  return { prof, disb, reimb, sst, net, total: r2(net + sst) };
};

/** The combined Quotation & Letter of Engagement (+ Warrant to Act) as one HTML document. */
export function engagementLetterHtml(i: EngagementInput): string {
  const lang = i.lang || 'EN';
  const t = TX[lang];
  const co = i.client.type === 'Corporate';
  const firmRaw = (i.firmName || 'Syafiqah Hamizad & Co').replace(/\.+$/, '');
  let n = 0;
  const sec = (title: string, body: string) => `<p style="margin:14pt 0 5pt;font-weight:bold">${++n}.&nbsp;&nbsp;${title.toUpperCase()}</p><div style="margin-left:18pt">${body}</div>`;
  const P = 'margin:0 0 7pt;text-align:justify';

  // Ref / date block (bilingual labels as on the firm letterhead) and addressee.
  const refRow = (en: string, bm: string, v: string) => `<tr><td style="padding:1px 6px 1px 0;white-space:nowrap">${en} / <i>${bm}</i></td><td style="padding:1px 6px">:</td><td style="padding:1px 0">${v}</td></tr>`;
  const refs = `<table style="border-collapse:collapse;${F};margin:0 0 12pt">${refRow('Your Ref', 'Rujukan Tuan', esc(i.yourRef || 'Kindly Advised'))}${refRow('Our Ref', 'Rujukan Kami', esc(i.ourRef || '-'))}${refRow('Date', 'Tarikh', esc(i.date))}${i.quotationNo ? refRow('Quotation No.', 'No. Sebut Harga', esc(i.quotationNo)) : ''}</table>`;
  const addressee = `<table style="width:100%;border-collapse:collapse;${F};margin:0 0 12pt"><tr><td style="vertical-align:top;padding:0"><b>${esc(i.client.name).toUpperCase()}</b>${i.client.address ? '<br>' + lines(i.client.address) : ''}${co && i.client.contactPerson ? `<br><br>${t.attn}: ${esc(i.client.contactPerson)}` : ''}</td><td style="vertical-align:top;padding:0;text-align:right;width:200px"><b>${t.byHand}</b>${i.client.email ? '<br>' + esc(i.client.email) : ''}</td></tr></table>`;

  // RE: block — matter, court, suit no. and parties from the file.
  const m = i.matter;
  const suit = !!(m.suitNo && m.suitNo.trim());
  const side = (m.side || '').trim();
  const opp = OPPOSITE[side.toLowerCase()] || '';
  const reLines = [
    esc(t.title),
    ...(suit ? [`${t.inMatter} ${esc(m.court || '').toUpperCase()}`.trim(), `${t.suit}: ${esc(m.suitNo)}`] : [esc(m.title).toUpperCase()]),
    ...(suit ? [`${side ? esc(side).toUpperCase() : t.client}: ${esc(i.client.name).toUpperCase()}`, ...(m.otherParty ? [`${opp ? esc(opp).toUpperCase() : t.other}: ${esc(m.otherParty).toUpperCase()}`] : [])] : []),
  ];
  const re = `<table style="border-collapse:collapse;${F};font-weight:bold;margin:0 0 4pt"><tr><td style="vertical-align:top;padding:0 8px 0 0">${t.re}:</td><td style="vertical-align:top;padding:0">${reLines.join('<br>')}</td></tr></table><div style="border-top:1px solid #000;margin:0 0 10pt"></div>`;

  let body = letterheadHtml(i.letterhead) + `<div style="${F}">` + refs + addressee + `<p style="${P}">${t.dear}</p>` + re + `<p style="${P}">${t.thanks}</p>`;

  // 1. Scope
  body += sec(t.scope, i.scope && i.scope.trim() ? `<p style="${P}">${t.scopeLead}</p><p style="${P}">${lines(i.scope)}</p>` : `<p style="${P}">${t.scopeNone}</p>`);

  // 2. Team
  body += sec(t.team, i.team.length
    ? `<p style="${P}">${t.teamLead}</p><table style="border-collapse:collapse;${F};margin:0 0 7pt">${i.team.map((p, k) => `<tr><td style="padding:1px 10px 1px 0">(${k + 1})</td><td style="padding:1px 14px 1px 0">${esc(p.name)}</td><td style="padding:1px 0">— ${p.role === 'Partner' ? t.partner : t.lawyer}</td></tr>`).join('')}</table><p style="${P}">${t.teamNote}</p>`
    : `<p style="${P}">${t.teamNone}</p>`);

  // 3. Fees and 4. Payment plan — only from a real quotation.
  if (i.fees) {
    const f = i.fees, tt = feeTotals(f), pct = Math.round((f.sstRate || 0) * 100);
    let tb = `<table style="width:100%;border-collapse:collapse;${F}"><tr><td style="${TD};font-weight:bold;text-align:center">${t.desc}</td><td style="${TD};font-weight:bold;text-align:center;width:120px">${t.amt}</td></tr>`;
    ([[t.prof, f.prof, tt.prof], [t.disb, f.disb, tt.disb], [t.reimb, f.reimb, tt.reimb]] as [string, FeeLine[], number][]).forEach(([h, l, s]) => {
      if (!l.length) return;
      tb += `<tr><td style="${TD};font-weight:bold" colspan="2"><u>${h}</u></td></tr>` + l.map(([d, a]) => `<tr><td style="${TD}">${esc(d)}</td><td style="${TD};text-align:right">${num(a)}</td></tr>`).join('') + `<tr><td style="${TD};text-align:right">${t.sub}</td><td style="${TD};text-align:right">${num(s)}</td></tr>`;
    });
    tb += `<tr><td style="${TD};text-align:right">${t.net}</td><td style="${TD};text-align:right">${num(tt.net)}</td></tr><tr><td style="${TD};text-align:right">${pct ? t.sst(pct) : t.sstNa}</td><td style="${TD};text-align:right">${pct ? num(tt.sst) : '-'}</td></tr><tr><td style="${TD};text-align:right;font-weight:bold;background:#EFEFEF">${t.total}</td><td style="${TD};text-align:right;font-weight:bold;background:#EFEFEF">${num(tt.total)}</td></tr></table>`;
    body += sec(t.fees, `<p style="${P}">${t.feesLead}${i.quotationNo ? ' (' + esc(i.quotationNo) + ')' : ''}:</p>${tb}<ul style="margin:6pt 0 0 0;padding-left:16pt">${t.feeNotes.map((x) => `<li style="margin:0 0 3pt;text-align:justify">${x}</li>`).join('')}</ul>`);

    const plan = i.plan || { kind: 'Full' as const };
    const rows = planRows(plan, tt.total);
    let pb = '';
    const tr = (x: string) => (lang === 'BM' ? STAGE_BM[x.trim()] || x : x);
    if (plan.kind === 'Stages' && (plan.stages || []).length) {
      pb = `<p style="${P}">${t.stagesLead(num(tt.total))}</p><table style="width:100%;border-collapse:collapse;${F}"><tr><td style="${TD};font-weight:bold;width:34px;text-align:center">${t.no}</td><td style="${TD};font-weight:bold">${t.stage}</td><td style="${TD};font-weight:bold">${t.when}</td><td style="${TD};font-weight:bold;width:46px;text-align:right">${t.pct}</td><td style="${TD};font-weight:bold;width:110px;text-align:right">${t.amt}</td></tr>`
        + rows.map((r, k) => `<tr><td style="${TD};text-align:center">${k + 1}</td><td style="${TD}">${esc(tr(r.label))}</td><td style="${TD}">${esc(tr(r.due || ''))}</td><td style="${TD};text-align:right">${r.pct != null ? r.pct : '-'}</td><td style="${TD};text-align:right">${num(r.amount)}</td></tr>`).join('')
        + `<tr><td style="${TD};font-weight:bold;text-align:right" colspan="4">${t.total}</td><td style="${TD};font-weight:bold;text-align:right">${num(rows.reduce((a, r) => a + r.amount, 0))}</td></tr></table>`;
    } else if (plan.kind === 'Instalments') {
      const words = lang === 'BM' ? WORDS_BM : WORDS_EN;
      const ml = (l: string) => (lang === 'BM' ? l.replace(/^Month/, t.month).replace('Upfront Payment', t.upfront).replace('Full Payment', t.fullPay) : l);
      const terms = String(i.instalmentTerms && i.instalmentTerms.trim() && !(lang === 'BM' && i.instalmentTerms.trim() === ARR_TERMS) ? i.instalmentTerms : lang === 'BM' ? ARR_TERMS_BM : ARR_TERMS).split('\n').filter((x) => x.trim());
      pb = `<p style="${P}">${t.instLead(num(tt.total), rows.length, words[rows.length] || String(rows.length))}</p><table style="border-collapse:collapse;${F};margin:0 0 8pt">${rows.map((r) => `<tr><td style="${TD};min-width:190px">${esc(ml(r.label))}</td><td style="${TD};text-align:right;min-width:110px">RM${num(r.amount)}</td></tr>`).join('')}<tr><td style="${TD};font-weight:bold">${t.total}</td><td style="${TD};text-align:right;font-weight:bold">RM${num(tt.total)}</td></tr></table>`
        + `<p style="margin:0 0 3pt;font-weight:bold">${t.instTerms}</p>` + terms.map((x, k) => { const mm = x.match(/^([^:]{3,40}):\s*(.*)$/); return `<p style="${P}">(${String.fromCharCode(97 + k)}) ${mm ? `<b>${esc(mm[1])}:</b> ${esc(mm[2])}` : esc(x)}</p>`; }).join('');
    } else {
      pb = `<p style="${P}">${t.full(num(tt.total))}</p>`;
    }
    if (i.bank) pb += `<p style="margin:8pt 0 2pt">${t.pay}</p><table style="${F};border-collapse:collapse;margin-left:12pt"><tr><td style="padding:1px 8px 1px 0">${t.accName}</td><td>: ${esc(i.bank[0])}</td></tr><tr><td style="padding:1px 8px 1px 0">${t.bank}</td><td>: ${esc(i.bank[1])}</td></tr><tr><td style="padding:1px 8px 1px 0">${t.accNo}</td><td>: ${esc(i.bank[2])}</td></tr></table>`;
    body += sec(t.plan, pb);
  }

  // Terms
  body += sec(t.terms, t.termList.map(([h, x], k) => `<p style="${P}"><b>(${String.fromCharCode(97 + k)}) ${h}.</b> ${x}</p>`).join(''));

  // Close, signature for the firm, client's acceptance.
  const we = co ? (lang === 'BM' ? 'Kami' : 'We') : (lang === 'BM' ? 'Saya' : 'I');
  body += `<p style="${P};margin-top:12pt">${t.close}</p><p style="margin:14pt 0 0">${t.yf}<br>${t.fob} <b>${lang === 'BM' ? 'TETUAN ' : ''}${esc(firmRaw.toUpperCase())}</b></p><p style="margin:40pt 0 0">______________________________</p>`;
  const accept = co
    ? `<p style="margin:36pt 0 0">______________________________<br>${t.name}: ${DOTS}<br>${t.ic}: ${DOTS}<br>${t.desig}: ${DOTS}<br>${t.dulyAuth} <b>${esc(i.client.name).toUpperCase()}</b><br>${t.date2}: ${DOTS}<br>${t.stamp}:</p>`
    : `<p style="margin:36pt 0 0">______________________________<br>${t.name}: ${i.client.name ? esc(i.client.name) : DOTS}<br>${t.ic}: ${i.client.idNo ? esc(i.client.idNo) : DOTS}<br>${t.date2}: ${DOTS}</p>`;
  body += `<div style="border-top:1px solid #000;margin:22pt 0 0;padding-top:10pt"><p style="${P}">${t.accept(we)}</p>${accept}</div></div>`;

  if (!i.noWarrant) {
    const w: WarrantInput = { client: { name: i.client.name, type: i.client.type, idNo: i.client.idNo, address: i.client.address }, matterTitle: m.title, side: m.side, court: m.court, suitNo: m.suitNo, otherParty: m.otherParty, fileRef: i.ourRef, firmName: i.firmName, date: i.date, lang };
    body += `<br clear="all" style="page-break-before:always"><div style="page-break-before:always"></div>` + letterheadHtml(i.letterhead) + warrantBodyHtml(w);
  }
  return `<div style="${BODY}">${body}</div>`;
}
