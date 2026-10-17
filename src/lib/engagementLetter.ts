/**
 * Letter of Engagement (Surat Perlantikan) — the client document for a file, in English or Bahasa
 * Malaysia, prepared from Cases (the file's Letters tab and the new-file screen).
 *
 *   letterhead (partners column) → bilingual Your Ref / Our Ref / Date → addressee → salutation
 *   → RE: (matter, court, suit no., parties) → appreciation → 1 Scope → 2 Team → 3 Fees (the real
 *   quotation lines, read-only) → 4 Payment plan (full / stages / monthly instalments) → 5 Authority
 *   and terms (the firm's own clauses: Autoriti, Fi Guaman, Penamatan, Indemniti, Had
 *   Tanggungjawab) → 6 Other terms → Yours faithfully → acceptance.
 *
 * Fee figures only ever come from a real quotation in Billing: with no `fees` the letter says the
 * fees are as per the firm's quotation and leaves the fee table and payment plan out. Pure (no
 * React, no settings, no Firebase) so it is unit-tested; the screens build the input from the
 * file, its quotation, the client record and Firm & Practice Settings.
 */
import type { Quotation, QuotationPaymentPlan, QuotationPaymentStage } from '../types';
import { splitSst } from './billingEngine';
import { escapeHtml } from './html';

export type DocLang = 'EN' | 'BM';
export type FeeLine = [string, number];

/* ------------------------------------------------------------------ payment plan */

const esc = escapeHtml;
const DOTS = '<span style="letter-spacing:1px">……………………………</span>';
/** The firm's letters (Letterhead as at 2.7.2026): Arial 10.5pt, justified. */
const BODY = 'font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#000';

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

/** Built-in instalment terms; the firm's own (Settings › Document wording) replace them for new papers. */
export const ARR_TERMS_BUILTIN = 'Early Settlement: In the event the matter is settled before the completion of the instalment period, all payments made shall be non-refundable, and the outstanding balance for the remaining unpaid months shall be charged at ten per cent (10%) of the settlement sum.\nDisbursements & Reimbursements: Charged in accordance with the agreed quotation. Any additional disbursements and/or reimbursements incurred shall be notified to and borne by the Client, and any unused portion of disbursements paid shall be refunded to the Client accordingly.\nWork shall not proceed if instalment payments are not settled, unless otherwise agreed in writing.';
export let ARR_TERMS = ARR_TERMS_BUILTIN;
export const setInstTerms = (x?: string) => { ARR_TERMS = x && x.trim() ? (x.trim() === '-' ? '' : x) : ARR_TERMS_BUILTIN; };

/** Litigation stages (editable on the quotation). Equal shares until the firm changes them. */
const DEFAULT_LIT_STAGES: QuotationPaymentStage[] = [
  { label: 'Filing', pct: 25, due: 'On signing this letter, before filing' },
  { label: 'Pleadings', pct: 25, due: 'On close of pleadings' },
  { label: 'Trial', pct: 25, due: 'Before the trial dates' },
  { label: 'Decision', pct: 25, due: 'On decision' },
];
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

/* ------------------------------------------------------------------ which quotation */

/** The quotation the letter's fees come from: the file's accepted quotation (latest), else its
 * latest quotation that was not declined. Proformas never count. None → undefined. */
export const quotationForFile = (quotes: Quotation[] | undefined, file: { id: string; ref: string }): Quotation | undefined => {
  const mine = (quotes || []).filter((q) => q && q.documentType !== 'Proforma' && q.status !== 'Declined'
    && ((!!q.caseId && (q.caseId === file.id || q.caseId === file.ref)) || (!!q.fileRef && q.fileRef === file.ref)));
  const newest = (a: Quotation, b: Quotation) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id));
  return mine.filter((q) => q.status === 'Accepted').sort(newest)[0] || mine.sort(newest)[0];
};

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
  /** The firm's letterhead logo (SH mark, name and both taglines in one picture). */
  fullLogo?: string;
  /** Lines under the logo, as on the firm's printed letterhead (address, e-mails, phone, note). */
  lines?: string[];
  /** Footer of the printed letterhead (operating hours and the reference note). */
  footer?: { branch?: string[]; hours: [string, string, string][]; note: string };
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
/** Footer of the firm letterhead: operating hours by branch and "Kindly quote our reference". */
/** Print rule: the footer sits at the bottom of every printed page (Chrome repeats fixed elements). */
export const LETTER_PRINT_CSS = '<style>@media print{.lh-foot{position:fixed;left:0;right:0;bottom:0;margin:0!important}.lh-page{padding-bottom:32mm}}</style>';
export const letterFooterHtml = (lh: LetterheadInfo): string => {
  const f = lh.footer;
  if (!f) return '';
  const cell = 'padding:0 10px 0 0;vertical-align:top;color:#fff;white-space:nowrap';
  const left = (f.branch || []).map((l, k) => (k === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>');
  const hours = `<table style="border-collapse:collapse;font-size:8pt;margin:0 0 0 auto"><tr><td colspan="${f.hours.length}" style="${cell};text-align:center;font-weight:bold;padding-bottom:2pt">Operating hours</td></tr><tr>${f.hours.map(([b]) => `<td style="${cell};font-weight:bold">${esc(b)}</td>`).join('')}</tr><tr>${f.hours.map(([, d]) => `<td style="${cell}">${esc(d)}</td>`).join('')}</tr><tr>${f.hours.map(([, , h]) => `<td style="${cell}">${esc(h)}</td>`).join('')}</tr></table><div style="margin-top:4pt;font-style:italic;text-align:right">${esc(f.note)}</div>`;
  return `<div class="lh-foot" style="margin-top:24pt;background:#0D0649;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Arial,Helvetica,sans-serif;font-size:8pt;line-height:1.35;color:#fff"><table style="width:100%;border-collapse:collapse;background:#0D0649;mso-shading:#0D0649"><tr><td style="vertical-align:top;padding:8pt 10pt;color:#fff;font-size:8pt;background:#0D0649;white-space:nowrap">${left}</td><td style="vertical-align:top;padding:8pt 10pt;color:#fff;font-size:8pt;background:#0D0649">${hours}</td></tr></table></div><!--/lh-foot-->`;
};

export const letterheadHtml = (lh: LetterheadInfo): string => {
  const contactLines = lh.lines && lh.lines.length ? lh.lines : [lh.reg || '', lh.address, [lh.email, lh.tel].filter(Boolean).join(' · ')].filter(Boolean);
  const contact = `<div style="font-family:Georgia,'Times New Roman',serif;font-size:7pt;line-height:1.5;color:#16223A;margin-top:4px">${contactLines.map((l, i) => (i === contactLines.length - 1 && /^\(/.test(l) ? `<i style="display:block;margin-top:5pt">${esc(l)}</i>` : /^Firm Reg/.test(l) ? `<span style="color:#000">${esc(l)}</span>` : esc(l))).join('<br>')}</div>`;
  const firm = lh.image
    ? `<img src="${esc(lh.image)}" alt="${esc(lh.firmName)}" style="width:100%;max-width:470px;height:auto;display:block">`
    : lh.fullLogo
      // Same as the printed letterhead: one logo picture, then the address lines.
      ? `<img src="${esc(lh.fullLogo)}" alt="${esc(lh.firmName)}" width="330" style="width:330px;height:auto;display:block">${contact}`
      : `${lh.logo ? `<img src="${esc(lh.logo)}" alt="${esc(lh.firmName)}" width="240" style="width:240px;height:auto;display:block">` : `<div style="font-size:18pt;font-weight:bold;letter-spacing:1px">${esc(lh.firmName)}</div>`}<div style="font-size:8.5pt;font-style:italic;color:#3D6B9C;line-height:1.4;margin-top:4px">${esc(lh.tag1 || '')}${lh.tag2 ? '<br>' + esc(lh.tag2) : ''}</div>${contact}`;
  return `<table style="width:100%;border-collapse:collapse;${HDR}"><tr><td style="vertical-align:top;padding:0">${firm}</td>${lh.partners.length ? `<td style="vertical-align:top;padding:0 0 4px 8px;width:200px;white-space:nowrap;border-left:1px solid #16223A;font-family:Arial,Helvetica,sans-serif;font-style:italic;font-size:6.5pt;line-height:1.3;color:#16223A">${partnersColumn(lh.partners)}</td>` : ''}</tr></table><div style="border-top:1px solid #16223A;margin:0 0 14px"></div>`;
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
  /** The real quotation lines. Omitted → "as per our quotation", no fee table or payment plan. */
  fees?: { prof: FeeLine[]; disb: FeeLine[]; reimb: FeeLine[]; sstRate: number };
  plan?: QuotationPaymentPlan;
  /** Instalment terms ("Heading: text" per line); defaults to ARR_TERMS / ARR_TERMS_BM. */
  instalmentTerms?: string;
  /** Office account the client pays into: [account name, bank, account no.]. */
  bank?: [string, string, string];
  firmName?: string;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_BM = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
/** "9 October 2026" / "9 Oktober 2026". */
export const longDate = (d: Date, lang: DocLang = 'EN') => `${d.getDate()} ${(lang === 'BM' ? MONTHS_BM : MONTHS_EN)[d.getMonth()]} ${d.getFullYear()}`;

const num = (n: number) => (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Opposite side, for the RE: block ("PLAINTIFF: … / DEFENDANT: …"). */
const OPPOSITE: Record<string, string> = { plaintiff: 'Defendant', defendant: 'Plaintiff', appellant: 'Respondent', respondent: 'Applicant', applicant: 'Respondent', plaintif: 'Defendan', defendan: 'Plaintif', pemohon: 'Responden', responden: 'Pemohon', purchaser: 'Vendor', vendor: 'Purchaser', landlord: 'Tenant', tenant: 'Landlord', buyer: 'Seller', seller: 'Buyer' };

/** Pronouns for an individual, a company, or unknown (both, as on the firm's form). */
type Pron = { S: string; s: string; me: string; my: string; am: string };
/** The client's own voice — only for the acceptance slip the client signs. */
const pron = (type: EngagementInput['client']['type'], lang: DocLang): Pron => {
  if (lang === 'BM') {
    const w = type === 'Corporate' ? 'Kami' : type === 'Individual' ? 'Saya' : 'Saya/Kami';
    return { S: w, s: w.toLowerCase(), me: w.toLowerCase(), my: w.toLowerCase(), am: '' };
  }
  if (type === 'Corporate') return { S: 'We', s: 'we', me: 'us', my: 'our', am: 'are' };
  if (type === 'Individual') return { S: 'I', s: 'I', me: 'me', my: 'my', am: 'am' };
  return { S: 'I/We', s: 'I/we', me: 'me/us', my: 'my/our', am: 'am/are' };
};


/** Wording of the Letter of Engagement that the firm can change in Firm & Practice Settings › Document wording
 * (plain text; lists one item per line; clauses "Heading: text"). Empty = the built-in wording. */
export interface LetterWording {
  title?: string; dear?: string; thanks?: string; scope?: string; scopeLead?: string; scopeNone?: string; team?: string; teamGeneral?: string;
  fees?: string; feesNone?: string; feeNotes?: string[]; auth?: string; authLead?: string; clauses?: [string, string][]; terms?: string; termList?: [string, string][]; close?: string; yf?: string;
}
export const LETTER_TEXT_KEYS = ['title', 'dear', 'thanks', 'scope', 'scopeLead', 'scopeNone', 'team', 'teamGeneral', 'fees', 'feesNone', 'auth', 'authLead', 'terms', 'close', 'yf'] as const;
let LW: Partial<Record<DocLang, LetterWording>> = {};
/** Called when the practice settings load or change. */
export const setLetterWording = (w?: Partial<Record<DocLang, LetterWording>>) => { LW = w || {}; };
const plainOf = (h: string) => h.replace(/<[^>]+>/g, '');
const htmlOf = (x: string) => esc(x).replace(/\s*\n\s*/g, '<br>');
const okText = (x?: string) => !!x && !!x.trim();
const okList = <T,>(l?: T[]) => !!l && l.length > 0;
/** The built-in wording as plain text, to show and edit. */
export const builtInLetterWording = (lang: DocLang): Required<LetterWording> => {
  const t = TX[lang];
  const o = Object.fromEntries(LETTER_TEXT_KEYS.map((k) => [k, plainOf(String(t[k]))])) as Record<(typeof LETTER_TEXT_KEYS)[number], string>;
  return { ...o, feeNotes: t.feeNotes.map(plainOf), clauses: builtInClauses(lang).map(([h, x]) => [h, plainOf(x)] as [string, string]), termList: t.termList.map(([h, x]) => [h, plainOf(x)] as [string, string]) };
};

/** The terms of engagement, written by the firm to the client ("you" / "we"): [heading, paragraph html].
 * Only the client's acceptance slip at the end of the letter is in the client's own voice. */
export const authorityClauses = (i: { client?: Pick<EngagementInput['client'], 'type'>; firmName?: string; lang?: DocLang }): [string, string][] => {
  const own = LW[i.lang || 'EN']?.clauses;
  if (okList(own)) return own!.map(([h, x]) => [esc(h), htmlOf(x)]);
  return builtInClauses(i.lang || 'EN');
};
const builtInClauses = (lang: DocLang): [string, string][] => {
  if (lang === 'BM') {
    return [
      ['Autoriti', 'Tuan/puan memberi kuasa dan melantik kami, termasuk mana-mana peguam kami yang mengendalikan perkara ini, untuk bertindak bagi pihak tuan/puan dalam perkara di atas, termasuk menyediakan dan menguruskan semua perkara berkaitan, rundingan dan perbincangan, serta berurusan dengan semua pihak ketiga yang berkaitan seperti agensi kerajaan, institusi kewangan dan pihak berkuasa lain.'],
      ['Fi guaman dan pengeluaran', 'Tuan/puan bertanggungjawab membayar semua fi guaman, kos dan perbelanjaan bagi perkara ini. Bayaran awal <em>(retainer)</em> tidak akan dikembalikan setelah kami dilantik. Selaras dengan Aturan 9.02 Kaedah Majlis Peguam, kami berhak menolak sebarang fi dan perbelanjaan yang belum dijelaskan daripada wang yang kami terima bagi pihak tuan/puan dalam perkara ini sehingga semua tunggakan dijelaskan. Kelewatan pembayaran boleh menyebabkan perkhidmatan kami tertangguh atau digantung.'],
      ['Penamatan perkhidmatan', 'Mana-mana pihak boleh menamatkan perlantikan ini dengan memberikan notis bertulis. Sekiranya ditamatkan, tuan/puan hendaklah menjelaskan semua fi dan perbelanjaan yang belum dibayar sehingga tarikh penamatan.'],
      ['Indemniti', 'Tuan/puan bersetuju untuk menanggung rugi kami terhadap sebarang tuntutan, dakwaan, kerugian, liabiliti, ganti rugi, kos dan perbelanjaan (termasuk fi guaman atas dasar peguam-anak guam) yang timbul daripada arahan tuan/puan, sebarang tindakan, ketinggalan, keingkaran atau salah nyataan oleh tuan/puan, atau sebarang langkah yang kami ambil secara wajar dalam mewakili tuan/puan. Tuan/puan tidak mempunyai sebarang tuntutan terhadap kami bagi sebarang kerugian, kerosakan atau perbelanjaan yang dialami, kecuali jika ia berpunca secara langsung daripada kecuaian melampau, penipuan atau salah laku disengajakan oleh kami.'],
      ['Had tanggungjawab', 'Tanggungjawab kami adalah terhad setakat yang dibenarkan oleh undang-undang dan tidak termasuk sebarang kerugian tidak langsung atau kerugian berbangkit.'],
      ['Rundingan dan penyelesaian', 'Kami boleh menghadiri rundingan, perbincangan dan pengantaraan bagi pihak tuan/puan untuk menyelesaikan perkara ini. Tiada penyelesaian akan dimuktamadkan tanpa pengesahan tuan/puan.'],
      ['Pertukaran peguam', 'Sekiranya tuan/puan ingin melantik peguam lain bagi perkara ini, tuan/puan hendaklah memaklumkan kami secara bertulis, sama ada diserahkan sendiri atau melalui e-mel. Sebelum fail diserahkan, tuan/puan hendaklah menjelaskan semua fi, Cukai Jualan dan Perkhidmatan, pengeluaran dan perbelanjaan yang dikenakan sehingga tarikh tersebut.'],
      ['Dokumen asal', 'Selaras dengan Aturan 9.02 Kaedah Majlis Peguam, kami boleh menyimpan dokumen asal berkaitan perkara ini sehingga semua fi dan pengeluaran yang perlu dibayar dijelaskan.'],
      ['Pencegahan pengubahan wang haram', 'Sebagai peguambela dan peguamcara, kami diwajibkan di bawah Akta Pencegahan Pengubahan Wang Haram, Pencegahan Pembiayaan Keganasan dan Hasil daripada Aktiviti Haram 2001 ("AMLA") untuk mengesahkan identiti tuan/puan dan sumber dana. Tuan/puan mengesahkan bahawa tuan/puan tidak terlibat dalam sebarang aktiviti pengubahan wang haram atau pembiayaan keganasan dalam pengertian seksyen 3 AMLA, dan akan memberikan maklumat yang tepat serta sebarang dokumen yang munasabah kami minta. Sekiranya dikehendaki oleh undang-undang, kami boleh melaporkan maklumat mengenai tuan/puan atau perkara ini kepada Jabatan Perisikan dan Penguatkuasaan Kewangan Bank Negara Malaysia atau pihak berkuasa lain tanpa notis kepada tuan/puan. Sekiranya maklumat yang diperlukan tidak diberikan, kami boleh menggantung atau berhenti bertindak, dan tuan/puan tidak mempunyai sebarang tuntutan terhadap kami bagi kerugian yang timbul.'],
      ['Data peribadi', 'Tuan/puan bersetuju kami memproses data peribadi tuan/puan di bawah Akta Perlindungan Data Peribadi 2010 bagi tujuan perkara ini, termasuk mendedahkannya kepada mahkamah, pihak-pihak lain dan peguam mereka, badan kerajaan dan pihak ketiga lain yang terlibat secara langsung. Kami akan mengambil langkah yang munasabah untuk melindungi data peribadi tuan/puan daripada akses, kehilangan, pengubahan atau pendedahan tanpa kebenaran.'],
    ];
  }
  return [
    ['Authority', 'You authorise and appoint us, including any of our lawyers handling this matter, to act for you in the above matter, including to prepare and attend to all related matters, negotiations and discussions, and to deal with all relevant third parties such as government agencies, financial institutions and other authorities.'],
    ['Legal fees and disbursements', 'You are responsible for all legal fees, costs and expenses of this matter. The initial payment <em>(retainer)</em> is non-refundable once we are appointed. In accordance with Rule 9.02 of the Bar Council Rules, we may deduct any unpaid fees and expenses from money we receive on your behalf in this matter until all arrears are settled. Late payment may delay or suspend our services.'],
    ['Termination of services', 'Either party may end this engagement by written notice. If it ends, you shall settle all fees and expenses that remain unpaid up to the date it ends.'],
    ['Indemnity', 'You agree to indemnify us against any claims, demands, losses, liabilities, damages, costs and expenses (including legal fees on a solicitor-and-client basis) arising from your instructions, any act, omission, default or misrepresentation by you, or any step we reasonably take in representing you. You shall have no claim against us for any loss, damage or expense you suffer, except where it arises directly from our gross negligence, fraud or wilful misconduct.'],
    ['Limitation of liability', 'Our liability is limited to the extent permitted by law and does not include any indirect or consequential loss.'],
    ['Negotiation and settlement', 'We may attend negotiations, discussions and mediation on your behalf to settle this matter. No settlement will be concluded without your confirmation.'],
    ['Change of solicitors', 'If you wish to appoint other solicitors for this matter, you shall notify us in writing, by hand or by e-mail. Before we hand over the file, you shall settle all fees, Sales and Service Tax, disbursements and expenses incurred up to that date.'],
    ['Original documents', 'In accordance with Rule 9.02 of the Bar Council Rules, we may keep the original documents of this matter until all fees and disbursements due are settled.'],
    ['Anti-money laundering', 'As advocates and solicitors, we are required under the Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 ("AMLA") to verify your identity and the source of funds. You confirm that you are not involved in any money laundering or terrorism financing activity within the meaning of section 3 of AMLA, and you shall give us accurate information and any document we reasonably ask for. Where the law requires, we may report information about you or this matter to the Financial Intelligence and Enforcement Department of Bank Negara Malaysia or another authority without notice to you. If the information required is not provided, we may suspend or stop acting, and you shall have no claim against us for any resulting loss.'],
    ['Personal data', 'You consent to us processing your personal data under the Personal Data Protection Act 2010 for this matter, including disclosing it to the court, the other parties and their solicitors, government bodies and other third parties directly involved. We will take reasonable steps to keep your personal data secure against unauthorised access, loss, alteration or disclosure.'],
  ];
};

const TX = {
  EN: {
    title: 'LETTER OF ENGAGEMENT', yourRef: 'Your Ref', ourRef: 'Our Ref', date: 'Date', quot: 'Quotation No.', byHand: 'By Hand / Email', attn: 'Attention', dear: 'Dear Sir/Madam,',
    re: 'RE', inMatter: 'IN THE MATTER OF', suit: 'SUIT NO.', other: 'OTHER PARTY', client: 'CLIENT',
    thanks: 'Thank you for your instructions and for the opportunity to act for you in the above matter. We set out below the scope of our engagement and the terms on which we will act. Our fees and payment plan are in the quotation enclosed. This letter forms our agreement with you.',
    scope: 'Scope of legal services', scopeLead: 'Our legal services will principally involve the following:-', scopeNone: 'As discussed with you and set out in our quotation.',
    team: 'Personnel', teamGeneral: 'This matter will be handled by the lawyers of the Firm under the supervision of the partner in charge of the file. The Firm may assign, add or change the lawyers and staff attending to this matter from time to time as the matter requires, and will keep you informed of the lawyer handling it.',
    fees: 'Fees and payment plan', feesEncl: (q: string, total: string) => `Our professional fees, disbursements and payment plan for the scope of work above are set out in our quotation${q} enclosed with this letter, for a total of <b>RM${total}</b> (including SST, where applicable).`, encl: 'Encl.: Quotation', feesLead: 'Our fees for the scope of work above, as set out in our quotation', feesNone: 'Our fees, disbursements and payment terms for the scope of work above are as per our quotation.', desc: 'DESCRIPTION', amt: 'AMOUNT (RM)', prof: 'Professional fees', disb: 'Disbursements', reimb: 'Reimbursements', sub: 'Sub-total', net: 'Total (excluding SST)', sst: (p: number) => `SST @ ${p}% (on professional fees & reimbursements)`, sstNa: 'SST: Not applicable', total: 'TOTAL',
    feeNotes: ['Disbursements are paid to third parties (court, land office, searches and the like) at cost; any unused balance will be refunded to you.', 'Work outside the scope above, or required by events beyond our control, will be charged separately and quoted to you first.'],
    plan: 'Payment plan', full: (t: string) => `The total sum of <b>RM${t}</b> is payable in full upon your acceptance of this letter, before we commence work.`,
    stagesLead: (t: string) => `The total sum of <b>RM${t}</b> is payable in stages as follows:`, no: 'No.', stage: 'Stage', pct: '%', when: 'When payable',
    instLead: (t: string, n: number, w: string) => `The total sum of <b>RM${t}</b> (inclusive of disbursements and reimbursements) is payable by monthly instalments over ${w} (${n}) months:`, month: 'Month', upfront: 'Upfront Payment', fullPay: 'Full Payment', instTerms: 'Instalment terms',
    pay: 'Payment to be made by transfer to:', accName: 'Name', bank: 'Bank', accNo: 'Account No.',
    auth: 'Authority and terms of engagement', authLead: 'By signing the acceptance below, you agree to the following terms:',
    terms: 'Other terms',
    termList: [
      ['Billing', 'Our invoices are payable within fourteen (14) days of the date of the invoice. We may issue interim invoices and proformas as the matter progresses, in line with our quotation and its payment plan.'],
      ['Commencement', 'We will commence work upon receipt of this letter signed by you and the first payment under our quotation, which includes the initial disbursements.'],
      ['Governing law', 'This letter and all matters arising from or connected with it are governed by the laws of Malaysia, and the courts of Malaysia shall have exclusive jurisdiction.'],
    ] as [string, string][],
    close: 'If the above is acceptable to you, kindly sign the acceptance below and return a copy of this letter to us. Should you have any questions, please do not hesitate to contact the undersigned.',
    yf: 'Regards,', fob: 'For and on behalf', accept: (p: Pron, ind: boolean) => `${p.S} confirm that ${p.s} have read and understood the contents of this Letter of Engagement, that its contents have been explained to ${p.me}${ind ? ', that I am of sound mind,' : ''} and that ${p.s} agree to be bound by its terms of ${p.my} own free will.`, sign: 'Signature', name: 'Name', ic: 'NRIC No.', date2: 'Date', desig: 'Designation', dulyAuth: 'duly authorised signatory of', stamp: 'Company stamp',
  },
  BM: {
    title: 'SURAT PERLANTIKAN', yourRef: 'Rujukan Tuan', ourRef: 'Rujukan Kami', date: 'Tarikh', quot: 'No. Sebut Harga', byHand: 'Serahan Tangan / E-mel', attn: 'U.P.', dear: 'Tuan/Puan,',
    re: 'PER', inMatter: 'DALAM PERKARA', suit: 'NO. GUAMAN', other: 'PIHAK LAWAN', client: 'ANAKGUAM',
    thanks: 'Terima kasih atas arahan tuan/puan dan peluang yang diberikan kepada kami untuk bertindak bagi pihak tuan/puan dalam perkara di atas. Bersama-sama ini kami nyatakan skop perkhidmatan dan terma-terma perlantikan kami. Fi guaman dan pelan pembayaran adalah seperti dalam sebut harga yang dilampirkan. Surat ini merupakan perjanjian kami dengan tuan/puan.',
    scope: 'Skop perkhidmatan guaman', scopeLead: 'Perkhidmatan guaman kami secara amnya melibatkan perkara-perkara berikut:-', scopeNone: 'Seperti yang telah dibincangkan dengan tuan/puan dan dinyatakan dalam sebut harga kami.',
    team: 'Peguam yang mengendalikan', teamGeneral: 'Perkara ini akan dikendalikan oleh peguam-peguam Firma di bawah penyeliaan rakan kongsi yang bertanggungjawab ke atas fail ini. Firma boleh menugaskan, menambah atau menukar peguam dan kakitangan yang mengendalikan perkara ini dari semasa ke semasa mengikut keperluan, dan akan memaklumkan tuan/puan peguam yang mengendalikannya.',
    fees: 'Fi guaman dan pelan pembayaran', feesEncl: (q: string, total: string) => `Fi profesional, pengeluaran dan pelan pembayaran bagi skop kerja di atas adalah seperti dalam sebut harga kami${q} yang dilampirkan bersama surat ini, berjumlah <b>RM${total}</b> (termasuk SST, jika berkenaan).`, encl: 'Lampiran: Sebut harga', feesLead: 'Fi guaman kami bagi skop kerja di atas, sebagaimana dalam sebut harga kami', feesNone: 'Fi guaman, pengeluaran dan terma pembayaran bagi skop kerja di atas adalah seperti dalam sebut harga kami.', desc: 'BUTIRAN', amt: 'JUMLAH (RM)', prof: 'Fi profesional', disb: 'Pengeluaran (disbursement)', reimb: 'Bayaran balik (reimbursement)', sub: 'Jumlah kecil', net: 'Jumlah (tidak termasuk SST)', sst: (p: number) => `SST @ ${p}% (atas fi profesional & bayaran balik)`, sstNa: 'SST: Tidak berkenaan', total: 'JUMLAH KESELURUHAN',
    feeNotes: ['Pengeluaran ialah bayaran kepada pihak ketiga (mahkamah, pejabat tanah, carian dan seumpamanya) pada kos sebenar; sebarang baki yang tidak digunakan akan dikembalikan kepada tuan/puan.', 'Kerja di luar skop di atas, atau yang diperlukan akibat perkara di luar kawalan kami, akan dikenakan secara berasingan dan dimaklumkan kepada tuan/puan terlebih dahulu.'],
    plan: 'Pelan pembayaran', full: (t: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> hendaklah dibayar sepenuhnya selepas tuan/puan menerima surat ini, sebelum kami memulakan kerja.`,
    stagesLead: (t: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> hendaklah dibayar mengikut peringkat seperti berikut:`, no: 'Bil.', stage: 'Peringkat', pct: '%', when: 'Bila perlu dibayar',
    instLead: (t: string, n: number, w: string) => `Jumlah keseluruhan sebanyak <b>RM${t}</b> (termasuk pengeluaran dan bayaran balik) hendaklah dibayar secara ansuran bulanan selama ${w} (${n}) bulan:`, month: 'Bulan', upfront: 'Bayaran Pendahuluan', fullPay: 'Bayaran Penuh', instTerms: 'Terma ansuran',
    pay: 'Bayaran hendaklah dibuat melalui pindahan ke akaun berikut:', accName: 'Nama', bank: 'Bank', accNo: 'No. Akaun',
    auth: 'Autoriti dan terma-terma perlantikan', authLead: 'Dengan menandatangani pengesahan di bawah, tuan/puan bersetuju dengan terma-terma berikut:',
    terms: 'Terma-terma lain',
    termList: [
      ['Pengebilan', 'Invois kami hendaklah dijelaskan dalam tempoh empat belas (14) hari dari tarikh invois. Kami boleh mengeluarkan invois interim dan invois proforma mengikut perkembangan perkara ini, selaras dengan sebut harga kami dan pelan pembayarannya.'],
      ['Permulaan kerja', 'Kami akan memulakan kerja setelah menerima surat ini yang telah ditandatangani oleh tuan/puan dan bayaran pertama di bawah sebut harga kami, termasuk pengeluaran awal.'],
      ['Undang-undang yang terpakai', 'Surat ini dan semua perkara yang timbul daripadanya atau berkaitan dengannya adalah tertakluk kepada undang-undang Malaysia, dan mahkamah Malaysia mempunyai bidang kuasa eksklusif.'],
    ] as [string, string][],
    close: 'Sekiranya perkara di atas dipersetujui, sila tandatangan pengesahan di bawah dan kembalikan salinan surat ini kepada kami. Sekiranya tuan/puan mempunyai sebarang pertanyaan, sila hubungi kami.',
    yf: 'Yang benar,', fob: 'Bagi pihak', accept: (p: Pron, ind: boolean) => `${p.S} mengesahkan bahawa ${p.s} telah membaca dan memahami kandungan Surat Perlantikan ini, bahawa kandungannya telah diterangkan kepada ${p.s}${ind ? ', bahawa saya berfikiran waras,' : ''} dan bahawa ${p.s} bersetuju untuk terikat dengan terma-termanya dengan kerelaan sendiri.`, sign: 'Tandatangan', name: 'Nama', ic: 'No. K/P.', date2: 'Tarikh', desig: 'Jawatan', stamp: 'Cop syarikat', dulyAuth: 'penandatangan yang diberi kuasa bagi',
  },
};

const F = 'font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#000';
const lines = (s?: string) => esc(s || '').replace(/\s*\n\s*/g, '<br>');
const sumL = (l: FeeLine[]) => r2(l.reduce((a, x) => a + (Number(x[1]) || 0), 0));

/** Totals of the quotation lines — same SST rule as billingEngine (fees + reimbursements only). */
export const feeTotals = (f: NonNullable<EngagementInput['fees']>) => {
  const prof = sumL(f.prof), disb = sumL(f.disb), reimb = sumL(f.reimb);
  const { sst } = splitSst(prof, reimb, f.sstRate || 0);
  const net = r2(prof + disb + reimb);
  return { prof, disb, reimb, sst, net, total: r2(net + sst) };
};

/** The Letter of Engagement as one HTML document (view, PDF / print and Word). */
export function engagementLetterHtml(i: EngagementInput): string {
  const lang = i.lang || 'EN';
  // The firm's own wording (Settings › Document wording) over the built-in one, field by field.
  const w = LW[lang] || {};
  const t = { ...TX[lang],
    ...Object.fromEntries(LETTER_TEXT_KEYS.filter((k) => okText(w[k])).map((k) => { const v = String(w[k]).trim(); return [k, v === '-' ? '' : k === 'title' ? v : htmlOf(v)]; })),
    ...(okList(w.feeNotes) ? { feeNotes: w.feeNotes!.map(htmlOf) } : {}),
    ...(okList(w.termList) ? { termList: w.termList!.map(([h, x]) => [esc(h), htmlOf(x)] as [string, string]) } : {}) };
  const co = i.client.type === 'Corporate';
  const firmRaw = (i.firmName || 'Syafiqah Hamizad & Co').replace(/\.+$/, '');
  let n = 0;
  const sec = (title: string, body: string) => `<p style="margin:14pt 0 5pt;font-weight:bold">${++n}.&nbsp;&nbsp;${title.toUpperCase()}</p><div style="margin-left:18pt">${body}</div>`;
  const P = 'margin:0 0 7pt;text-align:justify';

  // Ref / date block (bilingual labels as on the firm letterhead) and addressee.
  const refRow = (en: string, bm: string, v: string) => `<tr><td style="padding:0 18px 3px 0;vertical-align:top;white-space:nowrap;font-weight:bold;font-style:italic;font-size:9pt;line-height:1.1">${en}:<br><span style="font-size:5.5pt">${bm}:</span></td><td style="padding:0 0 3px;vertical-align:top;font-size:9pt;font-style:${en === 'Your Ref' ? 'italic' : 'normal'}">${v}</td></tr>`;
  const refs = `<table style="border-collapse:collapse;${F};margin:0 0 12pt">${refRow('Your Ref', 'Rujukan Tuan', esc(i.yourRef || 'Kindly Advised'))}${refRow('Our Ref', 'Rujukan Kami', esc(i.ourRef || '-'))}${refRow('Date', 'Tarikh', esc(i.date))}</table>`;
  const addressee = `<table style="width:100%;border-collapse:collapse;${F};margin:0 0 12pt"><tr><td style="vertical-align:top;padding:0"><b>${esc(i.client.name).toUpperCase()}</b>${i.client.address ? '<br>' + lines(i.client.address) : ''}${co && i.client.contactPerson ? `<br><br>${t.attn}: ${esc(i.client.contactPerson)}` : ''}</td><td style="vertical-align:top;padding:0;text-align:right;width:200px"><b><u>${t.byHand}</u></b>${i.client.email ? '<br><u>' + esc(i.client.email) + '</u>' : ''}</td></tr></table>`;

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
  body += sec(t.team, `<p style="${P}">${t.teamGeneral}</p>`);

  // 3. Fees — figures only from a real quotation, which is enclosed with the letter together with
  // its payment plan, so the letter refers to it instead of repeating the fee table.
  if (i.fees) {
    let fb = `<p style="${P}">${t.feesEncl(i.quotationNo ? ' (' + esc(i.quotationNo) + ')' : '', num(feeTotals(i.fees).total))}</p><ul style="margin:6pt 0 0 0;padding-left:16pt">${t.feeNotes.map((x) => `<li style="margin:0 0 3pt;text-align:justify">${x}</li>`).join('')}</ul>`;
    if (i.bank) fb += `<p style="margin:8pt 0 2pt">${t.pay}</p><table style="${F};border-collapse:collapse;margin-left:12pt"><tr><td style="padding:1px 8px 1px 0">${t.accName}</td><td>: ${esc(i.bank[0])}</td></tr><tr><td style="padding:1px 8px 1px 0">${t.bank}</td><td>: ${esc(i.bank[1])}</td></tr><tr><td style="padding:1px 8px 1px 0">${t.accNo}</td><td>: ${esc(i.bank[2])}</td></tr></table>`;
    body += sec(t.fees, fb);
  } else {
    body += sec(t.fees, `<p style="${P}">${t.feesNone}</p>`);
  }

  // Terms of engagement (firm to client) and the other terms.
  body += sec(t.auth, `<p style="${P}">${t.authLead}</p>` + authorityClauses({ lang }).map(([h, x], k) => `<p style="${P}"><b>(${String.fromCharCode(97 + k)}) ${h}.</b> ${x}</p>`).join(''));
  body += sec(t.terms, t.termList.map(([h, x], k) => `<p style="${P}"><b>(${String.fromCharCode(97 + k)}) ${h}.</b> ${x}</p>`).join(''));

  // Close, signature for the firm, client's acceptance.
  const pr = pron(i.client.type, lang);
  body += `<p style="${P};margin-top:12pt">${t.close}</p><p style="margin:14pt 0 0">${t.yf}<br>${t.fob}</p><p style="margin:40pt 0 0;font-size:11pt"><b>${lang === 'BM' ? 'TETUAN' : 'MESSRS'} ${esc(firmRaw.toUpperCase())}</b></p>${i.fees && i.quotationNo ? `<p style="margin:14pt 0 0">${t.encl} ${esc(i.quotationNo)}</p>` : ''}`;
  const accept = co
    ? `<p style="margin:36pt 0 0">______________________________<br>${t.name}: ${DOTS}<br>${t.ic}: ${DOTS}<br>${t.desig}: ${DOTS}<br>${t.dulyAuth} <b>${esc(i.client.name).toUpperCase()}</b><br>${t.date2}: ${DOTS}<br>${t.stamp}:</p>`
    : `<p style="margin:36pt 0 0">______________________________<br>${t.name}: ${i.client.name ? esc(i.client.name) : DOTS}<br>${t.ic}: ${i.client.idNo ? esc(i.client.idNo) : DOTS}<br>${t.date2}: ${DOTS}</p>`;
  body += `<div style="border-top:1px solid #000;margin:22pt 0 0;padding-top:10pt"><p style="${P}">${t.accept(pr, i.client.type === 'Individual')}</p>${accept}</div></div>`;

  return `${LETTER_PRINT_CSS}<div class="lh-page" style="${BODY}">${body}${letterFooterHtml(i.letterhead)}</div>`;
}
