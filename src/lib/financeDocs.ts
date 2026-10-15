// SH & Co finance documents: firm format (from the firm's own quotation template), totals,
// on-screen / Word / PDF / CSV output and Excel/CSV import.
//
// TypeScript port of design pack `finance-docs.js` (Accounts & Finance handoff). The HTML and
// inline styles produced by docHtml / tableHtml are kept byte-for-byte; screen, Word and PDF
// all come from the same docHtml string. Differences from the prototype, all deliberate:
//   - no seed() sample documents and no sample ADDR address book: the client address comes
//     from the real Client record and is passed in on the document as `addr`;
//   - the default SST rate comes from Firm & Practice Settings (sstRegistered / sstRate)
//     instead of a hard-coded 0 — SST applies to professional fees + reimbursements, never
//     disbursements (same rule as billingEngine.computeTotals);
//   - logo assets are served from /assets/ (public/assets/sh-*.png).
import { getPracticeSettings } from '../services/templateService';
import { splitSst } from './billingEngine';
import { escapeHtml } from './html';
import { ARR_TERMS, DEFAULT_LETTERHEAD_PARTNERS, planRows, schedule, type LetterheadInfo } from './engagementLetter';
import type { QuotationPaymentPlan } from '../types';

export { ARR_TERMS, schedule };

type DocType = 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt';
export type DocAccount = 'Office' | 'Client account' | 'Disbursement';
export type DocLine = [string, number];
export interface DocLines {
  prof: DocLine[];
  disb: DocLine[];
  reimb: DocLine[];
}
interface DocProof {
  name: string;
  url: string;
}
export interface DocInstalments {
  on: boolean;
  months: number;
  upfront: number;
  terms: string;
}

/** The document shape docHtml renders (same fields as the prototype's documents). */
export interface FinanceDoc {
  id: string;
  type: DocType;
  no: string;
  date: string;
  client: string;
  /** Client postal address (from the real Client record). */
  addr?: string;
  ref?: string;
  matter?: string;
  area?: string;
  account: DocAccount;
  status?: string;
  lines?: DocLines;
  sstRate?: number | null;
  deposit?: number;
  subject?: string;
  yourRef?: string;
  tin?: string;
  desc?: string;
  terms?: string[];
  arrangement?: string;
  inst?: DocInstalments | null;
  /** Quotation payment plan: printed as a stages table (instalments use `inst`). */
  plan?: QuotationPaymentPlan;
  due?: string;
  einv?: string;
  /** Receipt only */
  amount?: number;
  method?: string;
  forNo?: string;
  proofs?: DocProof[];
  historical?: boolean;
}

interface DocTotals {
  rate: number;
  prof: number;
  disb: number;
  reimb: number;
  sProf: number;
  sReimb: number;
  sst: number;
  net: number;
  gross: number;
  less: number;
  total: number;
}

/** Firm default SST rate: 0 until Firm & Practice Settings says the firm is SST-registered. */
export const defaultSstRate = (): number => {
  const s = getPracticeSettings();
  if (!s.sstRegistered) return 0;
  // Firm & Practice Settings → SST start date (dd.mm.yyyy): nothing charged before it.
  const m = String(s.sstStartDate || '').match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m && new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() > Date.now()) return 0;
  return Number(s.sstRate) || 0;
};

export const FIRM = { reg: 'Firm Reg. No.: 000020008754', name: 'SYAFIQAH HAMIZAD & CO', addr: '8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi, Selangor', email: 'billing@shcolaw.com', tel: '+603-8684 1998 / +6011-7382 8754', tag1: 'Advocates & Solicitors | Syarie Counsel', tag2: 'Peguambela & Peguamcara | Peguam Syarie', header: '' };
/** Lines under the logo on the firm's letterhead (Letterhead as at 2.7.2026); the Firm Reg. No. goes first. */
const LETTER_LINES = [
  '8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi, Selangor',
  'Email: shco@shcolaw.com',
  'Phone Number: +603-8684 1998 / +6011-7382 8754 (WhatsApp)',
  '(Registered address is a shared office facility | Meetings by appointment only)',
];
export const BANK: Record<DocAccount, [string, string, string]> = { Office: ['Syafiqah Hamizad & Co', 'Hong Leong Bank Berhad', '36301134253'], 'Client account': ['Syafiqah Hamizad & Co – Client A/C', 'Hong Leong Bank Berhad', '36301136440'], Disbursement: ['Syafiqah Hamizad & Co – Disbursement A/C', 'Hong Leong Bank Berhad', '[to be set]'] };
const LOGO: Record<'mono' | 'word' | 'name' | 'header' | 'full', string> = { mono: '/assets/sh-monogram.png', word: '/assets/sh-wordmark.png', name: '/assets/sh-name.png', header: '', full: '/assets/sh-letterhead-logo.png' };
const toData = (k: keyof typeof LOGO) => fetch(LOGO[k]).then((r) => r.blob()).then((b) => new Promise<void>((res) => { const fr = new FileReader(); fr.onload = () => { LOGO[k] = String(fr.result); res(); }; fr.readAsDataURL(b); })).catch(() => {});
let logosLoaded = false;
/** Inline the logo artwork as data URLs so Word / PDF copies carry it (idempotent). */
export const loadLogos = () => {
  if (logosLoaded || typeof window === 'undefined') return;
  logosLoaded = true;
  fetch('/assets/letterhead-header.png', { method: 'HEAD' }).then((r) => { if (r.ok && /image/.test(r.headers.get('content-type') || '')) { LOGO.header = '/assets/letterhead-header.png'; toData('header'); } }).catch(() => {});
  toData('mono'); toData('word'); toData('name'); toData('full');
};

export const TERMS = ['The professional fees may vary depending on the actual scope of work performed and any additional requirements imposed by relevant parties;', 'The Firm reserves the right to issue further invoices for any additional fees and/or costs incurred which are not expressly included in this quotation;', 'The Firm shall have the right to invoice progressive professional fees from time to time depending on the stage and progress of work;'];
const NOTE = 'Note: Please be informed that this document is merely a quotation prepared on the information available to date and is subject to be varied in accordance with further information, requirements and/or events are beyond our control';

interface AreaTemplate {
  code: string;
  desc: string;
  prof: DocLine[];
  disb: DocLine[];
  reimb: DocLine[];
}
export const AREAS: Record<string, AreaTemplate> = {
  Litigation: { code: 'LIT', desc: 'Being our professional charges, for taking instructions, opening file, perusing all the relevant documents forwarded to us, undertake due diligence process, conducting researches including all relevant laws and regulations, preparing and drafting, reviewing and finalizing, filing Memorandum of Appearance, Statement of Defence, Mediation and Settlement on behalf and/or between the parties, Attending Case Managements; Updating and advising your goodself from time to time via email or calls and other related matters incidental thereto not specifically stated herein.',
    prof: [['Retainer & Interim charges (Non refundable)', 10000], ['Litigation Legal fee (Trial)', 10000]],
    disb: [['Bankruptcy search (Individual & Company)', 50], ['SSM search', 15.4], ['JPN Search', 50], ['Filing Statement of Defence (& Counter Claim)', 8], ['Filing Statement of Reply to Counter Claim', 8], ['Agreed Facts, Issues to be Tried, Bundle of Documents, Witness Statements (RM8 each)', 100], ['Witness attendance', 500], ['Judgment after Trial', 200]],
    reimb: [['Photocopy and printing charges', 300], ['Travelling expenses', 1500], ['Telephone, fax, courier, Runner Charges & Postage Charges', 300], ['Miscellaneous expenses', 100]] },
  Conveyancing: { code: 'CONV', desc: 'Being our professional charges for services rendered in connection with the Sale and Purchase, including taking instructions, perusing and reviewing documents forwarded to us, conducting searches, preparing and drafting the Sale and Purchase Agreement and transfer documents, attending to stamping and registration, liaising with the relevant parties, developer and financier, and rendering legal advice as may be required from time to time, together with all necessary and incidental work related thereto.',
    prof: [['Legal fees on Sale & Purchase Agreement (scale fee, SRO 2023)', 4200], ['Legal fees on transfer / Deed of Assignment', 800]],
    disb: [['Land search & Bankruptcy search', 120], ['Stamp duty on Sale & Purchase Agreement', 30], ['Stamp duty on Memorandum of Transfer (Estimated, Subject to Valuation)', 3800], ['Registration fees (Land Office)', 400]],
    reimb: [['Travelling, Printing & Photocopy charges', 350], ['Telephone, fax, courier, runner charges & postage charges', 150], ['Miscellaneous', 100]] },
  Corporate: { code: 'CORP', desc: 'Being our professional charges for services rendered in connection with the Agreement, including taking instructions, perusing and reviewing documents forwarded to us, drafting and preparing ONE (1) Agreement, conducting necessary legal research, negotiating on your behalf with the relevant parties, undertaking reasonable due diligence, and rendering legal advice as may be required from time to time, together with all necessary and incidental work related thereto.',
    prof: [['Professional fees', 5000]],
    disb: [['Bankruptcy & SSM searches', 35.4], ['Stamp duty on Agreement (Estimated)', 500]],
    reimb: [['Travelling, Printing & Photocopy charges', 350], ['Miscellaneous', 100]] },
  Employment: { code: 'EMP', desc: 'Being our professional charges for taking instructions, opening file, perusing all the relevant documents forwarded to us, conducting researches including all relevant laws and regulations, preparing representations, attending conciliation at the Industrial Relations Department and hearings at the Industrial Court, updating and advising your goodself from time to time via email or calls and other related matters incidental thereto not specifically stated herein.',
    prof: [['Professional fees (Conciliation)', 2500], ['Professional fees (Industrial Court, per hearing)', 3500]],
    disb: [['SSM search', 15.4], ['Filing fees', 100]],
    reimb: [['Printing & Photocopy charges', 200], ['Travelling Expenses', 300], ['Miscellaneous', 100]] },
  'Wills & Probate': { code: 'PRO', desc: 'Being our professional charges for taking instructions, perusing documents forwarded to us, conducting searches on the assets of the estate, preparing, drafting and filing the application for Grant of Probate / Letters of Administration, attending court, extracting the grant and distributing the estate, together with all necessary and incidental work related thereto.',
    prof: [['Application for Grant of Probate / Letters of Administration', 3500], ['Distribution of estate & transfer of assets', 1500]],
    disb: [['Land searches', 120], ['Court filing & commissioning fees', 250], ['Newspaper advertisement', 600]],
    reimb: [['Printing & Photocopy charges', 100], ['Travelling Expenses', 150], ['Miscellaneous', 50]] },
  'Family & Syariah': { code: 'FAM', desc: 'Being our professional charges for taking instructions, opening file, perusing all the relevant documents, preparing, drafting and filing the application at the Syariah Court, attending sulh and hearings, updating and advising your goodself from time to time via email or calls and other related matters incidental thereto not specifically stated herein.',
    prof: [['Professional fees', 4000]],
    disb: [['Syariah Court filing fees', 80], ['Service of documents', 150]],
    reimb: [['Printing & Photocopy charges', 80], ['Travelling Expenses', 150], ['Miscellaneous', 50]] },
  // Consultation before a file is opened (usually as a proforma). Set the fee in Settings → Fee templates.
  Consultation: { code: 'CON', desc: 'Being our professional charges for the legal consultation, including taking instructions, perusing the documents provided and advising your goodself on the matter.',
    prof: [['Consultation fee', 0]],
    disb: [],
    reimb: [] },
};
const areaFromRef = (ref?: string): string => { const c = (ref || '').split('/')[1]; return Object.keys(AREAS).find((a) => AREAS[a].code === c) || 'Litigation'; };
/** Best practice-area template for a free-text practice area / matter type (e.g. "Civil Litigation"). */
export const areaFromName = (name?: string, ref?: string): string => {
  const n = String(name || '').toLowerCase();
  if (/convey|property|spa\b|land/.test(n)) return 'Conveyancing';
  if (/corporate|commercial|company|advisory/.test(n)) return 'Corporate';
  if (/employ|industrial/.test(n)) return 'Employment';
  if (/probate|will|estate/.test(n)) return 'Wills & Probate';
  if (/family|syariah|shariah|divorce/.test(n)) return 'Family & Syariah';
  if (/litig|dispute|civil|criminal/.test(n)) return 'Litigation';
  return areaFromRef(ref);
};
export const clone = (l?: DocLine[]): DocLine[] => (l || []).map(([d, a]) => [d, a] as DocLine);
export const fromTemplate = (area: string, f = 1): DocLines => { const T = AREAS[area] || AREAS.Litigation; const r = (l: DocLine[], k: number) => l.map(([d, a]) => [d, k === 1 ? a : Math.max(10, Math.round(a * k / 10) * 10)] as DocLine); return { prof: r(T.prof, f), disb: r(T.disb, 1), reimb: r(T.reimb, 1) }; };
const sum = (l?: DocLine[]) => (l || []).reduce((s, x) => s + (Number(x[1]) || 0), 0);
export const totals = (d: Pick<FinanceDoc, 'type' | 'lines' | 'sstRate' | 'deposit' | 'amount'>): DocTotals => {
  if (d.type === 'Receipt') { const a = d.amount || 0; return { rate: 0, prof: 0, disb: 0, reimb: 0, sProf: 0, sReimb: 0, sst: 0, net: a, gross: a, less: 0, total: a }; }
  const rate = d.sstRate != null ? d.sstRate : defaultSstRate();
  const lines = d.lines || { prof: [], disb: [], reimb: [] };
  const prof = sum(lines.prof), disb = sum(lines.disb), reimb = sum(lines.reimb);
  // One SST rule (billingEngine.splitSst): rounded once on fees + reimbursements; the printed
  // fee / reimbursement SST lines add up to that stored total.
  const { sst, sstFees: sProf, sstReimbursements: sReimb } = splitSst(prof, reimb, rate);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const net = r2(prof + disb + reimb), gross = r2(net + sst), less = Math.min(gross, Math.max(0, d.deposit || 0));
  return { rate, prof, disb, reimb, sProf, sReimb, sst, net, gross, less, total: r2(gross - less) };
};
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four'];
const num = (n: number | string | undefined) => Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number | string | undefined) => 'RM ' + num(n);
const TITLES: Record<DocType, string> = { Quotation: 'QUOTATION', Proforma: 'PROFORMA INVOICE', Invoice: 'INVOICE', Receipt: 'OFFICIAL RECEIPT' };
// Quotes escaped too: these values also go inside attributes (e.g. src="…").
const esc = (s: unknown) => escapeHtml(s).replace(/\n/g, '<br>');
const F = 'font-family:Arial,Helvetica,sans-serif;color:#000;font-size:9.5pt;line-height:1.35';
const B = 'border:1px solid #000;padding:5px 8px;vertical-align:top';
const HDR = 'font-family:Georgia,\'Times New Roman\',serif;color:#16223A';
const firmBlock = () => FIRM.header ? '<div style="' + HDR + '"><img src="' + FIRM.header + '" alt="' + esc(FIRM.name) + '" style="width:100%;max-width:470px;height:auto;display:block"></div>' : '<div style="' + HDR + '"><img src="' + LOGO.name + '" alt="' + FIRM.name + '" width="240" style="width:240px;height:auto;display:block"><div style="font-size:8.5pt;font-style:italic;color:#3D6B9C;line-height:1.4;margin-top:4px">' + esc(FIRM.tag1) + '<br>' + esc(FIRM.tag2) + '</div><div style="font-size:7.5pt;line-height:1.5;color:#5B6478;margin-top:5px">' + (FIRM.reg ? esc(FIRM.reg) + '<br>' : '') + esc(FIRM.addr) + '<br>' + FIRM.email + ' · ' + FIRM.tel + '</div></div>';
const boxTable = (rows: [string, unknown][]) => rows.map(([k, v]) => '<div><span style="color:#5B6478">' + k + '</span> ' + esc(v) + '</div>').join('');
const topHead = (title: string, rows: [string, unknown][]) => '<table style="width:100%;border-collapse:collapse"><tr><td style="vertical-align:top;padding:0">' + firmBlock() + '</td><td style="vertical-align:top;padding:0 0 0 12px;width:200px;text-align:right;' + HDR + ';font-size:8.5pt;line-height:1.6">' + (title ? '<div style="font-size:15pt;font-weight:bold;letter-spacing:.5px;line-height:1.15;margin-bottom:4px">' + title + '</div>' : '') + boxTable(rows) + '</td></tr></table><div style="border-top:2px solid #16223A;margin:12px 0 14px"></div>';
const receiptOrig = (d: FinanceDoc) => { const bk = BANK[d.account] || BANK.Office;
  const kv = [['Amount received', '<b style="font-size:15px">' + money(d.amount) + '</b>'], ['Being payment for', esc(d.forNo || d.matter || '-')], ['Payment method', esc(d.method || '-')], ['Paid into', esc(bk[0]) + ' · ' + esc(bk[1]) + ' · A/C ' + bk[2]]].concat((d.proofs || []).length ? [['Proof of payment', esc((d.proofs || []).map((q) => q.name).join('; '))]] : []);
  return topHead('OFFICIAL RECEIPT', [['No.', d.no], ['Date', d.date], ['Account', d.account]])
    + '<table style="width:100%;font-size:12px;margin-bottom:14px;font-family:Arial,sans-serif;color:#16223A"><tr><td style="vertical-align:top;width:55%"><div style="font-size:10px;color:#5B6478;text-transform:uppercase;letter-spacing:1px">Received from</div><div style="font-weight:bold">' + esc(d.client) + '</div><div style="color:#5B6478">' + esc(d.addr || '') + '</div></td><td style="vertical-align:top"><div style="font-size:10px;color:#5B6478;text-transform:uppercase;letter-spacing:1px">Matter</div><div style="font-weight:bold">' + esc(d.matter || '-') + '</div><div style="color:#5B6478">' + esc([d.ref, d.area].filter(Boolean).join(' · ')) + '</div></td></tr></table>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;color:#16223A">' + kv.map(([k, v]) => '<tr><td style="padding:8px;border:1px solid #DDE3EB;width:35%;color:#5B6478;background:#F6F8FA">' + k + '</td><td style="padding:8px;border:1px solid #DDE3EB;text-align:justify">' + v + '</td></tr>').join('') + '</table>'
    + (d.account === 'Client account' ? '<p style="font-size:10.5px;color:#2F6F4E;font-family:Arial,sans-serif;text-align:justify">This money is held in the firm’s Client Account on your behalf under the Solicitors’ Account Rules 1990. It is not the firm’s money.</p>' : '')
    + '<p style="font-size:10px;color:#5B6478;margin-top:30px;font-family:Arial,sans-serif">This is a computer-generated receipt. No signature is required.</p>'; };
const head1a = (d: FinanceDoc) => { const t = totals(d); const title = d.type === 'Invoice' && t.sst ? 'TAX INVOICE' : TITLES[d.type];
  const box: [string, unknown][] = d.type === 'Quotation' ? [['Quot No.', d.no], ['Date', d.date], ['Valid', '30 days']] : d.type === 'Proforma' ? [['Proforma No.', d.no], ['Date', d.date], ['Due', d.due || '14 days']] : d.type === 'Invoice' ? ([['Invoice No.', d.no], ['Date', d.date], ['Due', d.due && d.due !== 'on receipt' ? d.due : 'On receipt']] as [string, unknown][]).concat(d.einv && d.einv !== '—' ? [['e-Invoice', d.einv]] : []) : [['Receipt No.', d.no], ['Date', d.date], ['Amount', 'RM ' + num(d.amount)], ['Account', d.account === 'Client account' ? 'Client A/C' : 'Office A/C']];
  const lab = 'padding:1px 6px 1px 0;font-weight:bold;white-space:nowrap;vertical-align:top;width:78px', col = 'padding:1px 4px 1px 0;vertical-align:top;width:8px', val = 'padding:1px 0;vertical-align:top';
  const refs = (d.type === 'Receipt' ? [['Our Ref', esc(d.ref || '-')], ['Being for', '<b>' + esc(d.forNo || d.matter || '-') + '</b>']] : [['Your Ref', esc(d.yourRef || 'Kindly Advised')], ['Our Ref', esc(d.ref || '-')]]).concat([['Subject', '<b>' + esc(d.subject || String(d.matter || '').toUpperCase()) + '</b>']]);
  return topHead(title, box) + '<table style="width:100%;border-collapse:collapse;' + F + ';margin-bottom:12px"><tr><td style="vertical-align:top;width:48%;padding:0 12px 0 0"><div style="font-size:7.5pt;font-weight:bold;letter-spacing:1px;color:#444;margin-bottom:2px">' + (d.type === 'Receipt' ? 'RECEIVED FROM' : 'TO') + '</div><b>' + esc(d.client) + '</b>' + (d.addr ? '<br>' + esc(d.addr) : '') + '</td><td style="vertical-align:top;padding:0"><table style="border-collapse:collapse;' + F + '">' + refs.map(([k, v]) => '<tr><td style="' + lab + '">' + k + '</td><td style="' + col + '">:</td><td style="' + val + '">' + v + '</td></tr>').join('') + '</table></td></tr></table>'; };

/** The one HTML source for a document: on screen, Word and PDF all use this. */
export const docHtml = (d: FinanceDoc): string => {
  if (d.type === 'Receipt') return receiptOrig(d);
  const lines = d.lines || { prof: [], disb: [], reimb: [] };
  const t = totals(d); let body = head1a(d);
  const rate = t.rate, pct = Math.round(rate * 100), sv = (v: number) => rate ? num(v) : '-';
  const BL = 'border-left:1px solid #000;border-right:1px solid #000;padding:1px 8px;vertical-align:top';
  const row3 = (a: string, b: string, c: string, st?: string) => `<tr><td style="${B};${st || ''}">${a}</td><td style="${B};text-align:right;${st || ''}">${b}</td><td style="${B};text-align:right;${st || ''}">${c}</td></tr>`;
  body += `<table style="width:100%;border-collapse:collapse;${F}"><tr><td style="${B};text-align:center;font-weight:bold">DESCRIPTION</td><td style="${B};text-align:center;font-weight:bold;width:105px">AMOUNT (RM)</td><td style="${B};text-align:center;font-weight:bold;width:95px">SST${rate ? ' ' + pct + '%' : ''} (RM)</td></tr>`;
  ([['PROFESSIONAL FEES:', lines.prof, t.prof, t.sProf, d.desc, true], ['DISBURSEMENT', lines.disb, t.disb, 0, '', false], ['REIMBURSEMENT', lines.reimb, t.reimb, t.sReimb, '', true]] as [string, DocLine[], number, number, string | undefined, boolean][]).forEach(([hd, L, s0, ss, desc, taxable]) => { if (!L || !L.length) return;
    body += `<tr><td style="border:1px solid #000;border-bottom:0;padding:5px 8px 3px"><b><u>${hd}</u></b>${desc ? `<div style="margin:4px 0 6px;text-align:justify">${esc(desc)}</div>` : ''}</td><td style="border:1px solid #000;border-bottom:0"></td><td style="border:1px solid #000;border-bottom:0"></td></tr>`;
    L.forEach(([ds, a], i) => { body += `<tr><td style="${BL};text-align:justify;padding-left:22px;text-indent:-12px${i === L.length - 1 ? ';padding-bottom:6px' : ''}">&bull;&nbsp;${esc(ds)}</td><td style="${BL};text-align:right">${num(a)}</td><td style="${BL};text-align:right">${taxable ? sv(a * rate) : '-'}</td></tr>`; });
    body += row3('<b>SUB TOTAL:</b>', '<b>' + num(s0) + '</b>', '<b>' + (taxable ? sv(ss) : '-') + '</b>', 'text-align:right'); });
  body += row3('TOTAL (EXCLUDING SST):', num(t.net), '', 'text-align:right');
  body += row3(rate ? `SST @ ${pct}% (on professional fees &amp; reimbursements):` : 'SST: Not applicable', '', rate ? num(t.sst) : '-', 'text-align:right');
  if (t.less) body += row3('LESS: DEPOSIT RECEIVED:', '(' + num(t.less) + ')', '', 'text-align:right');
  body += `<tr><td style="${B};text-align:right;font-weight:bold;background:#EFEFEF">TOTAL AMOUNT TO BE PAID:</td><td colspan="2" style="${B};text-align:right;font-weight:bold;background:#EFEFEF">${num(t.total)}</td></tr></table>`;
  if (d.type === 'Quotation') body += `<p style="${F};margin:10px 0 6px;font-style:italic;text-align:justify">${NOTE}</p>`;
  if (d.type === 'Proforma') body += `<p style="${F};margin:10px 0 6px;font-style:italic;text-align:justify">This proforma invoice is a request for payment in advance. A final invoice will be issued upon completion of the work.</p>`;
  if (d.type === 'Quotation' && (d.terms || []).length) body += `<p style="${F};margin:6px 0 2px;text-align:justify">By agreeing to this quotation, it is hereby acknowledged and agreed by you that:-</p><ol style="${F};margin:0 0 8px;padding-left:22px;list-style-type:disc">${(d.terms || []).map((x) => `<li style="margin:1px 0;text-align:justify;display:list-item;list-style-type:disc">${esc(x)}</li>`).join('')}</ol>`;
  const bk = BANK[d.account] || BANK.Office;
  body += `<p style="${F};margin:8px 0 2px">Payment to be made in transfer as the following:-</p><table style="${F};margin-left:18px;border-collapse:collapse"><tr><td style="padding:1px 8px 1px 0">Name</td><td>: ${esc(bk[0])}</td></tr><tr><td style="padding:1px 8px 1px 0">Bank</td><td>: ${esc(bk[1])}</td></tr><tr><td style="padding:1px 8px 1px 0">Bank Account No.</td><td>: ${bk[2]}</td></tr></table>`;
  if (d.inst && d.inst.on) { const sch = schedule(t.total, d.inst.months, d.inst.upfront), n = sch.length; const terms = String(d.inst.terms != null ? d.inst.terms : ARR_TERMS).split('\n').filter((x) => x.trim());
    body += `<div style="page-break-before:auto;margin-top:16px;${F}"><p style="margin:0 0 6px;font-weight:bold;text-decoration:underline">FEE ARRANGEMENT</p><p style="margin:0 0 8px;text-align:justify">You agree to pay the total professional fees in the sum of <b>RM${num(t.total)}</b> (inclusive of disbursements and reimbursements) as per quotation, by way of monthly instalments over ${WORDS[n] || n} (${n}) months, subject to the following terms:</p>
<p style="margin:0 0 4px;font-weight:bold">1. Payment Schedule</p><table style="border-collapse:collapse;margin:0 0 8px 18px;${F}">${sch.map(([k, v]) => `<tr><td style="border:1px solid #000;padding:3px 10px;min-width:180px">${k}</td><td style="border:1px solid #000;padding:3px 10px;text-align:right;min-width:100px">RM${num(v)}</td></tr>`).join('')}<tr><td style="border:1px solid #000;padding:3px 10px;font-weight:bold">Total</td><td style="border:1px solid #000;padding:3px 10px;text-align:right;font-weight:bold">RM${num(t.total)}</td></tr></table>
${terms.map((x, i) => { const m2 = x.match(/^([^:]{3,40}):\s*(.*)$/); return `<p style="margin:0 0 5px;text-align:justify"><b>${i + 2}. ${m2 ? esc(m2[1]) : 'Terms'}</b><br>${esc(m2 ? m2[2] : x)}</p>`; }).join('')}</div>`; }
  else if (d.plan && d.plan.kind === 'Stages' && (d.plan.stages || []).length) { const rows = planRows(d.plan, t.total);
    body += `<div style="margin-top:16px;${F}"><p style="margin:0 0 6px;font-weight:bold;text-decoration:underline">PAYMENT BY STAGES</p><table style="border-collapse:collapse;margin:0 0 8px 18px;${F}">${rows.map((r, i) => `<tr><td style="border:1px solid #000;padding:3px 10px">${i + 1}. ${esc(r.label)}${r.due ? ' <span style="color:#444">(' + esc(r.due) + ')</span>' : ''}</td><td style="border:1px solid #000;padding:3px 10px;text-align:right">${r.pct != null ? r.pct + '%' : ''}</td><td style="border:1px solid #000;padding:3px 10px;text-align:right;min-width:100px">RM${num(r.amount)}</td></tr>`).join('')}<tr><td style="border:1px solid #000;padding:3px 10px;font-weight:bold" colspan="2">Total</td><td style="border:1px solid #000;padding:3px 10px;text-align:right;font-weight:bold">RM${num(rows.reduce((a, r) => a + r.amount, 0))}</td></tr></table></div>`; }
  else if (d.arrangement) body += `<p style="${F};margin:14px 0 2px;font-weight:bold;text-decoration:underline">FEE ARRANGEMENT</p><p style="${F};margin:0;white-space:pre-wrap;text-align:justify">${esc(d.arrangement)}</p>`;
  return body + `<p style="${F};margin:24px 0 0;font-size:8.5pt">This is a computer-generated document. No signature is required.</p>`;
};
const wrap = (title: string, body: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:14mm 16mm}body{margin:0}</style></head><body>${body}</body></html>`;
const dl = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
/** PDF via the browser print dialog of the same HTML (server-side PDF recommended in production). */
export const pdf = (title: string, body: string) => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f); const w = f.contentWindow; if (!w) return; w.document.open(); w.document.write(wrap(title, body)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* print blocked */ } setTimeout(() => f.remove(), 60000); }, 500); };
/** html2pdf (jsPDF + html2canvas), loaded once on demand from the CDN — the same way as SheetJS. */
const H2P_URL = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
let h2p: Promise<unknown> | null = null;
const loadH2p = () => (h2p ||= new Promise((resolve, reject) => {
  const w = window as unknown as { html2pdf?: unknown };
  if (w.html2pdf) { resolve(w.html2pdf); return; }
  const sc = document.createElement('script'); sc.src = H2P_URL; sc.async = true;
  sc.onload = () => resolve((window as unknown as { html2pdf?: unknown }).html2pdf);
  sc.onerror = () => { h2p = null; reject(new Error('Could not load the PDF maker.')); };
  document.head.appendChild(sc);
}));
/** A real PDF file (A4) of a document, made in the browser, for saving to Google Drive. */
export const pdfBlob = async (body: string): Promise<Blob> => {
  const make = (await loadH2p()) as () => { set: (o: unknown) => { from: (el: HTMLElement) => { outputPdf: (t: string) => Promise<Blob> } } };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:178mm;background:#fff';
  box.innerHTML = body;
  document.body.appendChild(box);
  try {
    return await make().set({ margin: [14, 16, 14, 16], image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } }).from(box).outputPdf('blob');
  } finally { box.remove(); }
};
export const csv = (title: string, rows: unknown[][]) => dl(new Blob(['﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }), title + '.csv');
const parseCsv = (text: string): string[][] => { const rows: string[][] = []; let row: string[] = [], cell = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; } if (cell || row.length) { row.push(cell); rows.push(row); } return rows.filter((r) => r.some((x) => String(x).trim())); };
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
/** A real Excel file (.xlsx) from rows, via SheetJS loaded on demand: numbers stay numbers
 * (shown as 1,234.00), columns sized to their content. */
export const xlsx = async (title: string, rows: unknown[][]) => {
  const X: any = await import(/* @vite-ignore */ XLSX_URL);
  const ws = X.utils.aoa_to_sheet(rows);
  const range = X.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) { const cell = ws[X.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = '#,##0.00'; }
  const widths: number[] = [];
  rows.forEach((row) => row.forEach((v, i) => { const n = String(v ?? '').length; if (rows.indexOf(row) > 3) widths[i] = Math.min(60, Math.max(widths[i] || 8, n + 2)); }));
  ws['!cols'] = widths.map((w) => ({ wch: w || 10 }));
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report');
  X.writeFile(wb, title + '.xlsx');
};
/** Reads a CSV natively, or an Excel file via SheetJS loaded on demand from jsdelivr. */
export const readSheet = async (file: File): Promise<string[][]> => { if (/\.csv$/i.test(file.name)) return parseCsv((await file.text()).replace(/^﻿/, '')); const X: any = await import(/* @vite-ignore */ XLSX_URL); const wb = X.read(await file.arrayBuffer()); return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); };
const IMPORT_COLS = ['Date (dd.mm.yyyy)', 'Type (Receipt / Payment / Invoice)', 'Account (Office / Client)', 'Client', 'Our Ref', 'Document No.', 'Description', 'Amount (RM)', 'Method', 'Proof reference', 'Payment status (invoices: Paid / Part paid / Not paid)'];
export const importTemplate = () => csv('SHCO import template', [IMPORT_COLS, ['15.01.2025', 'Invoice', 'Office', 'FB Fastaqim Buildings', 'SHC/LIT/FB/SH/005/2025', 'INV-25-0012', 'Professional fees – defence', '10000', '', ''], ['20.01.2025', 'Receipt', 'Office', 'FB Fastaqim Buildings', 'SHC/LIT/FB/SH/005/2025', 'OR-25-0031', 'Payment for INV-25-0012', '2000', 'Online transfer', 'IBG screenshot 20.01'], ['22.01.2025', 'Payment', 'Client', 'FB Fastaqim Buildings', 'SHC/LIT/FB/SH/005/2025', 'PV-25-0008', 'Court filing fees', '16', 'Online transfer', 'e-Filing receipt']]);
/* ---------- Firm & Practice Settings → documents ----------
 * Firm details, bank accounts, the HQ letterhead image and edited fee templates live in Firm &
 * Practice Settings. They are applied onto FIRM / BANK / AREAS in place (built-in values stay the
 * fallback), on load and whenever settings change, so every screen/Word/PDF copy picks them up. */
/** Built-in template code → practice-area tag used in Firm & Practice Settings. */
const AREA_TAG: Record<string, string> = { LIT: 'L', PRO: 'EST', FAM: 'SY' };
const areaTag = (code: string) => AREA_TAG[code] || code;
const BUILTIN_FIRM = { ...FIRM };
const BUILTIN_BANK: Record<DocAccount, [string, string, string]> = { Office: [...BANK.Office], 'Client account': [...BANK['Client account']], Disbursement: [...BANK.Disbursement] };
const BUILTIN_AREAS: Record<string, AreaTemplate> = Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, { ...a, prof: clone(a.prof), disb: clone(a.disb), reimb: clone(a.reimb) }]));
/** Built-in fee templates keyed by practice-area tag (L, CONV, EST, CORP, EMP, SY), in the
 * settings shape (lines as {d, a} objects). */
export const builtInFeeTemplates = (): Record<string, { desc: string; prof: { d: string; a: number }[]; disb: { d: string; a: number }[]; reimb: { d: string; a: number }[] }> => {
  const o = (l: DocLine[]) => l.map(([d, a]) => ({ d, a }));
  return Object.fromEntries(Object.values(BUILTIN_AREAS).map((a) => [areaTag(a.code), { desc: a.desc, prof: o(a.prof), disb: o(a.disb), reimb: o(a.reimb) }]));
};

const applyPracticeSettingsToDocs = () => {
  const s = getPracticeSettings();
  const reg = String(s.firmRegNo || '').trim();
  const hq = (s.branches || []).find((b) => b.hq) || (s.branches || [])[0];
  Object.assign(FIRM, BUILTIN_FIRM, {
    reg: reg ? 'Firm Reg. No.: ' + reg : BUILTIN_FIRM.reg,
    addr: s.address || BUILTIN_FIRM.addr,
    email: s.email || BUILTIN_FIRM.email,
    tel: s.phone || BUILTIN_FIRM.tel,
    tag1: s.taglineLine1 ?? BUILTIN_FIRM.tag1,
    tag2: s.taglineLine2 ?? BUILTIN_FIRM.tag2,
    header: hq?.letterheadImage || '',
  });
  const accs = (s.bankAccounts || []).filter((b) => b.isActive !== false);
  const pick = (a: { accountName: string; bankName: string; accountNo: string } | undefined, fb: [string, string, string]): [string, string, string] => (a && a.accountNo ? [a.accountName, a.bankName, a.accountNo] : [fb[0], fb[1], fb[2]]);
  BANK.Office = pick(accs.find((b) => b.isDefaultOffice) || accs.find((b) => b.accountType === 'Office Operating'), BUILTIN_BANK.Office);
  BANK['Client account'] = pick(accs.find((b) => b.isDefaultClient) || accs.find((b) => b.accountType === 'Client Trust'), BUILTIN_BANK['Client account']);
  BANK.Disbursement = pick(accs.find((b) => b.accountType === 'Disbursement'), BUILTIN_BANK.Disbursement);
  const T = s.feeTemplates || {};
  const cl = (l?: { d: string; a: number }[]) => (l || []).filter((x) => String(x?.d || '').trim()).map((x) => [x.d, Number(x.a) || 0] as DocLine);
  Object.keys(AREAS).forEach((k) => { if (!BUILTIN_AREAS[k]) delete AREAS[k]; });
  Object.entries(BUILTIN_AREAS).forEach(([k, a]) => { const o = T[areaTag(a.code)]; AREAS[k] = o ? { code: a.code, desc: o.desc, prof: cl(o.prof), disb: cl(o.disb), reimb: cl(o.reimb) } : { ...a, prof: clone(a.prof), disb: clone(a.disb), reimb: clone(a.reimb) }; });
  // Templates saved for practice areas with no built-in template (e.g. Criminal) become extra areas.
  const builtTags = new Set(Object.values(BUILTIN_AREAS).map((a) => areaTag(a.code)));
  (s.practiceAreas || []).forEach((pa) => { const o = T[pa.code]; if (o && !builtTags.has(pa.code) && !AREAS[pa.name]) AREAS[pa.name] = { code: pa.code, desc: o.desc, prof: cl(o.prof), disb: cl(o.disb), reimb: cl(o.reimb) }; });
};
if (typeof window !== 'undefined') {
  applyPracticeSettingsToDocs();
  window.addEventListener('shco-practice-settings-updated', applyPracticeSettingsToDocs);
}

/** The firm's one letterhead (every letter, whatever the branch): the logo, the address / e-mail /
 * phone lines and the footer of "Letterhead as at 2.7.2026". An image uploaded in Firm & Practice
 * Settings → Firm & Letterhead replaces the logo and lines. */
const LETTER_FOOTER = { branch: ['Terengganu Branch:', 'No. 3B, Lot 12039-1 Bangunan 6 Unit 3,', 'Tingkat Cerang Guling, 21400 Marang, Terengganu', 'Email: trg@shcolaw.com', 'Phone number: +6014-503 2290'], hours: [['Selangor Branch', 'Monday to Friday', '9.00am – 5.00pm'], ['Terengganu Branch', 'Sunday to Thursday', '9.00am to 5.00pm']] as [string, string, string][], note: 'Note: Kindly quote our reference in reply to our correspondences' };
export const letterheadFor = (_branchName?: string): LetterheadInfo => {
  const s = getPracticeSettings();
  const brs = s.branches || [];
  const hq = brs.find((b) => b.hq) || brs[0];
  return {
    image: hq?.letterheadImage || FIRM.header || undefined,
    logo: LOGO.name,
    fullLogo: LOGO.full,
    lines: [FIRM.reg, ...LETTER_LINES],
    footer: LETTER_FOOTER,
    firmName: FIRM.name, tag1: FIRM.tag1, tag2: FIRM.tag2, reg: FIRM.reg,
    address: FIRM.addr, email: FIRM.email, tel: FIRM.tel,
    partners: s.letterheadPartners && s.letterheadPartners.length ? s.letterheadPartners : DEFAULT_LETTERHEAD_PARTNERS,
  };
};

export const tableHtml = (title: string, period: string, cols: string[], rows: unknown[][]) => topHead(esc(title.toUpperCase()), [['Period', period]]) + `<div style="display:none"></div><div style="${F};text-align:center;margin:0 0 12px">${esc(period)}</div><table style="width:100%;border-collapse:collapse;${F}"><tr>${cols.map((c) => `<td style="${B};font-weight:bold;background:#EFEFEF">${esc(c)}</td>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td style="${B}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
