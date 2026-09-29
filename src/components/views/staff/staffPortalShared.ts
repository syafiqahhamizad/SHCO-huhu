import type React from 'react';
import type { Case, Client, Expense, PaymentVoucher, Payslip, TravelClaim, User } from '../../../types';
import { isMine, partnerCode } from '../../../lib/identity';

/* ------------------------------------------------------------------ formatting */

export const rm = (n: number) =>
  'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num2 = (n: number) => Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD (not UTC, so late-evening use in Malaysia keeps today's date). */
export const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayIso = () => isoOf(new Date());
export const thisPeriod = () => todayIso().slice(0, 7);

/** 'YYYY-MM' -> 'September 2026' */
export const periodLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return (MONTHS[(m || 1) - 1] || '') + ' ' + y;
};

/** 'YYYY-MM-DD' (or ISO timestamp) -> 'dd.mm.yyyy' */
export const ddmmyyyy = (iso?: string) => {
  if (!iso) return '';
  const s = iso.slice(0, 10);
  return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
};
/** 'YYYY-MM-DD' -> 'dd.mm' */
export const ddmm = (iso?: string) => (iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) : '');
/** 'YYYY-MM-DD' -> '30 Sep 2026' */
export const dMonY = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return d + ' ' + MONTHS_SHORT[m - 1] + ' ' + y;
};

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ shared inline styles */

export const serif = 'ui-serif, Georgia, serif';
export const card: React.CSSProperties = { overflow: 'hidden', borderRadius: 12, border: '1px solid #DDE3EB', background: '#fff' };
export const cardTitle: React.CSSProperties = { fontFamily: serif, fontSize: 14.5, color: '#16223A' };
export const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
export const labelWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

/* ------------------------------------------------------------------ payslips */

export const grossOf = (p: Payslip) =>
  (p.basic || 0) + (p.allowances || []).reduce((s, a) => s + (a.amount || 0), 0) + (p.referralFee || 0) + (p.profitShare || 0) + (p.bonus || 0);
export const dedOf = (p: Payslip) =>
  (p.epfEmployee || 0) + (p.socsoEis || 0) + (p.pcb || 0) + (p.zakat || 0) + (p.otherDeductions || []).reduce((s, a) => s + (a.amount || 0), 0);
export const netOf = (p: Payslip) => grossOf(p) - dedOf(p);

/** On-screen earnings lines — `n` is the source note (on screen only, never printed). */
export const earnLines = (p: Payslip) =>
  [
    { k: 'Basic salary', n: '', v: p.basic || 0 },
    ...(p.allowances || []).map((a) => ({ k: 'Allowance: ' + a.name, n: '', v: a.amount || 0 })),
    ...(p.referralFee ? [{ k: 'Referral fees', n: p.referralNote || 'files you brought in', v: p.referralFee }] : []),
    ...(p.profitShare ? [{ k: 'Profit sharing', n: p.profitShareNote || 'quarterly share of firm profit', v: p.profitShare }] : []),
    ...(p.bonus ? [{ k: 'Bonus', n: p.bonusNote || 'performance bonus', v: p.bonus }] : []),
  ];

export const dedLines = (p: Payslip) =>
  [
    { k: 'EPF (11%)', v: p.epfEmployee || 0 },
    { k: 'SOCSO + EIS', v: p.socsoEis || 0 },
    { k: 'PCB (income tax)', v: p.pcb || 0 },
    { k: 'Zakat (via employer, reduces PCB)', v: p.zakat || 0 },
    ...(p.otherDeductions || []).map((d) => ({ k: d.name, v: d.amount || 0 })),
  ].filter((d) => d.v);

export interface FirmLetterhead {
  address: string;
  email: string;
  phone: string;
}

const letterheadHtml = (lh: string, firm: FirmLetterhead, title: string, lines: [string, string][]) =>
  '<table style="width:100%;border-collapse:collapse"><tr><td style="vertical-align:top;padding:0;font-family:Georgia,\'Times New Roman\',serif;color:#16223A">' +
  '<img src="' + esc(lh) + '" alt="Syafiqah Hamizad &amp; Co" width="240" style="width:240px;height:auto;display:block">' +
  '<div style="font-size:8.5pt;font-style:italic;color:#3D6B9C;line-height:1.4;margin-top:4px">Advocates &amp; Solicitors | Syarie Counsel<br>Peguambela &amp; Peguamcara | Peguam Syarie</div>' +
  '<div style="font-size:7.5pt;line-height:1.5;color:#5B6478;margin-top:5px">Firm Reg. No.: [to be set]<br>' + esc(firm.address) + '<br>' + esc(firm.email) + ' · ' + esc(firm.phone) + '</div></td>' +
  '<td style="vertical-align:top;padding:0 0 0 12px;width:200px;text-align:right;font-family:Georgia,\'Times New Roman\',serif;color:#16223A;font-size:8.5pt;line-height:1.6">' +
  '<div style="font-size:15pt;font-weight:bold;letter-spacing:.5px;line-height:1.15;margin-bottom:4px">' + esc(title) + '</div>' +
  lines.map(([k, v]) => '<div><span style="color:#5B6478">' + esc(k) + '</span> ' + esc(v) + '</div>').join('') +
  '</td></tr></table><div style="border-top:2px solid #16223A;margin:12px 0 14px"></div>';

const F = 'font-family:Arial,Helvetica,sans-serif;color:#000;font-size:9.5pt;line-height:1.4';
const B = 'border:1px solid #000;padding:5px 8px';

const maskAccount = (acc?: string) => {
  const d = String(acc || '').replace(/\s+/g, '');
  if (!d) return '';
  return d.length >= 8 ? d.slice(0, 4) + ' **** ' + d.slice(-4) : d;
};

export interface StaffIdentity {
  name: string;
  position: string;
  staffNo: string;
  nric: string;
  epfNo: string;
  socsoNo: string;
  bank: string;
}

export const staffIdentity = (u: User): StaffIdentity => {
  const sp = u.staffProfile;
  const bank = [sp?.bankName, maskAccount(sp?.bankAccountNo)].filter(Boolean).join(' · ');
  return {
    name: u.name,
    position: sp?.designation || String(u.role || ''),
    staffNo: sp?.staffId || '—',
    nric: sp?.nric || '—',
    epfNo: sp?.epfNo || '—',
    socsoNo: sp?.socsoNo || '—',
    bank: bank || '—',
  };
};

/**
 * The A4 payslip — ONE HTML source for both the on-screen "View payslip" paper and the
 * printed PDF. Source notes (referral files, profit-share basis, bonus reason) are left out.
 */
export const buildPayslipHtml = (p: Payslip, who: StaffIdentity, lh: string, firm: FirmLetterhead) => {
  const month = periodLabel(p.period);
  const pd = p.paidAt ? ddmmyyyy(p.paidAt) : '—';
  const eRows = earnLines(p).map((x) => [x.k, num2(x.v)]);
  const dRows = dedLines(p).map((x) => [x.k, num2(x.v)]);
  const nR = Math.max(eRows.length, dRows.length);
  return (
    '<div style="' + F + '">' +
    letterheadHtml(lh, firm, 'PAYSLIP', [['Period', month], ['Pay date', pd], ['Staff No.', who.staffNo]]) +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:14px">' +
    [['Name', who.name, 'Pay date', pd], ['Position', who.position, 'Staff no.', who.staffNo], ['NRIC', who.nric, 'EPF no.', who.epfNo], ['Bank', who.bank, 'SOCSO no.', who.socsoNo]]
      .map((r) => '<tr><td style="padding:2px 4px;font-weight:bold;width:80px">' + esc(r[0]) + '</td><td style="padding:2px 4px">: ' + esc(r[1]) + '</td><td style="padding:2px 4px;font-weight:bold;width:80px">' + esc(r[2]) + '</td><td style="padding:2px 4px">: ' + esc(r[3]) + '</td></tr>')
      .join('') +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse"><tr><td style="' + B + ';font-weight:bold;background:#EFEFEF">EARNINGS</td><td style="' + B + ';font-weight:bold;background:#EFEFEF;text-align:right;width:90px">RM</td><td style="' + B + ';font-weight:bold;background:#EFEFEF">DEDUCTIONS</td><td style="' + B + ';font-weight:bold;background:#EFEFEF;text-align:right;width:90px">RM</td></tr>' +
    Array.from({ length: nR }, (_, i) =>
      '<tr><td style="' + B + ';border-bottom:0;border-top:0">' + (eRows[i] ? esc(eRows[i][0]) : '') + '</td><td style="' + B + ';border-bottom:0;border-top:0;text-align:right">' + (eRows[i] ? eRows[i][1] : '') + '</td><td style="' + B + ';border-bottom:0;border-top:0">' + (dRows[i] ? esc(dRows[i][0]) : '') + '</td><td style="' + B + ';border-bottom:0;border-top:0;text-align:right">' + (dRows[i] ? dRows[i][1] : '') + '</td></tr>'
    ).join('') +
    '<tr><td style="' + B + ';font-weight:bold">TOTAL EARNINGS</td><td style="' + B + ';font-weight:bold;text-align:right">' + num2(grossOf(p)) + '</td><td style="' + B + ';font-weight:bold">TOTAL DEDUCTIONS</td><td style="' + B + ';font-weight:bold;text-align:right">' + num2(dedOf(p)) + '</td></tr>' +
    '<tr><td colspan="3" style="' + B + ';font-weight:bold;text-align:right;background:#EFEFEF;font-size:11pt">NET PAY</td><td style="' + B + ';font-weight:bold;text-align:right;background:#EFEFEF;font-size:11pt">' + num2(netOf(p)) + '</td></tr></table>' +
    '<table style="width:60%;border-collapse:collapse;margin-top:14px"><tr><td colspan="2" style="padding:2px 0;font-weight:bold">Employer contributions (not deducted from you)</td></tr>' +
    '<tr><td style="padding:2px 0">EPF (employer)</td><td style="text-align:right">' + num2(p.epfEmployer || 0) + '</td></tr>' +
    // The payroll record keeps one combined SOCSO + EIS figure (employee share); the employer's
    // SOCSO + EIS share isn't stored, so it is shown blank rather than estimated.
    '<tr><td style="padding:2px 0">SOCSO + EIS (employer)</td><td style="text-align:right">—</td></tr></table>' +
    '<p style="margin:28px 0 0;font-size:8.5pt">This is a computer-generated payslip. No signature is required. Private &amp; confidential.</p></div>'
  );
};

/** EA form (statement of remuneration) built only from that year's issued payslips. */
export const buildEaHtml = (year: number, slips: Payslip[], who: StaffIdentity, lh: string, firm: FirmLetterhead) => {
  const sum = (f: (p: Payslip) => number) => slips.reduce((s, p) => s + f(p), 0);
  const allowances = sum((p) => (p.allowances || []).reduce((s, a) => s + (a.amount || 0), 0));
  const other = sum((p) => (p.otherDeductions || []).reduce((s, a) => s + (a.amount || 0), 0));
  const months = [...slips].sort((a, b) => a.period.localeCompare(b.period)).map((p) => MONTHS_SHORT[Number(p.period.slice(5, 7)) - 1]);
  const row = (k: string, v: number, bold = false) =>
    '<tr><td style="' + B + (bold ? ';font-weight:bold;background:#EFEFEF' : '') + '">' + esc(k) + '</td><td style="' + B + ';text-align:right;width:120px' + (bold ? ';font-weight:bold;background:#EFEFEF' : '') + '">' + num2(v) + '</td></tr>';
  return (
    '<div style="' + F + '">' +
    letterheadHtml(lh, firm, 'EA FORM', [['Year', String(year)], ['Staff No.', who.staffNo]]) +
    '<p style="margin:0 0 10px;font-weight:bold">Statement of remuneration from employment for the year ended 31 December ' + year + '</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:14px">' +
    [['Name', who.name, 'NRIC', who.nric], ['Position', who.position, 'EPF no.', who.epfNo], ['Staff no.', who.staffNo, 'SOCSO no.', who.socsoNo]]
      .map((r) => '<tr><td style="padding:2px 4px;font-weight:bold;width:80px">' + esc(r[0]) + '</td><td style="padding:2px 4px">: ' + esc(r[1]) + '</td><td style="padding:2px 4px;font-weight:bold;width:80px">' + esc(r[2]) + '</td><td style="padding:2px 4px">: ' + esc(r[3]) + '</td></tr>')
      .join('') +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr><td style="' + B + ';font-weight:bold;background:#EFEFEF">INCOME</td><td style="' + B + ';font-weight:bold;background:#EFEFEF;text-align:right;width:120px">RM</td></tr>' +
    row('Basic salary', sum((p) => p.basic || 0)) +
    row('Allowances', allowances) +
    row('Referral fees', sum((p) => p.referralFee || 0)) +
    row('Profit sharing', sum((p) => p.profitShare || 0)) +
    row('Bonus', sum((p) => p.bonus || 0)) +
    row('TOTAL GROSS REMUNERATION', sum(grossOf), true) +
    '</table>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr><td style="' + B + ';font-weight:bold;background:#EFEFEF">DEDUCTIONS &amp; CONTRIBUTIONS</td><td style="' + B + ';font-weight:bold;background:#EFEFEF;text-align:right;width:120px">RM</td></tr>' +
    row('EPF (employee)', sum((p) => p.epfEmployee || 0)) +
    row('SOCSO + EIS (employee)', sum((p) => p.socsoEis || 0)) +
    row('PCB (monthly tax deductions)', sum((p) => p.pcb || 0)) +
    row('Zakat (via employer)', sum((p) => p.zakat || 0)) +
    (other ? row('Other deductions', other) : '') +
    row('EPF (employer contribution)', sum((p) => p.epfEmployer || 0)) +
    '</table>' +
    '<p style="margin:0;font-size:8.5pt">Built from ' + slips.length + ' payslip' + (slips.length === 1 ? '' : 's') + ' issued for ' + year + ' (' + esc(months.join(', ')) + ').</p>' +
    '<p style="margin:28px 0 0;font-size:8.5pt">This is a computer-generated statement. No signature is required. Private &amp; confidential.</p></div>'
  );
};

/** Print an HTML fragment through a hidden iframe (same approach as the design's helpers). */
export const printHtml = (title: string, bodyHtml: string) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const w = f.contentWindow;
  if (!w) return;
  w.document.open();
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>@page{size:A4;margin:14mm 16mm}body{margin:0}</style></head><body>' + bodyHtml + '</body></html>');
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => f.remove(), 60000);
  }, 400);
};

/* ------------------------------------------------------------------ leave */

/** [type, entitlement days/yr (0 = no fixed limit), counting, note] — firm leave policy. */
export const LEAVE_TYPES: [string, number, 'working' | 'calendar', string][] = [
  ['Annual', 16, 'working', '16 days a year (grows with service). Apply at least 7 days ahead.'],
  ['Medical', 14, 'working', '14 days a year. Upload the MC (klinik panel or any registered doctor).'],
  ['Hospitalisation', 60, 'working', 'Up to 60 days a year when admitted, including medical leave. Upload the discharge note.'],
  ['Emergency', 3, 'working', 'Sudden family matters. Taken from annual leave balance if emergency days are used up.'],
  ['Maternity', 98, 'calendar', '98 consecutive days (Employment Act). Can start up to 30 days before the due date.'],
  ['Paternity', 7, 'working', '7 consecutive days for married fathers, up to 5 births (Employment Act).'],
  ['Compassionate', 0, 'working', 'Death or serious illness in the family. No fixed limit, subject to partner approval.'],
  ['Marriage', 0, 'working', 'For your own marriage. No fixed limit, subject to partner approval.'],
  ['Study / exam', 0, 'working', 'CLP, LLM, Syarie or other approved exams. No fixed limit, subject to partner approval. Attach the exam slip.'],
  ['Hajj', 40, 'calendar', 'Once during service, with Tabung Haji offer letter.'],
  ['Umrah', 0, 'calendar', 'Number of days to be confirmed by the firm, subject to partner approval. Attach the travel agent confirmation.'],
  ['Replacement', 2, 'working', 'For weekends or public holidays you worked (e.g. urgent filing, hearings).'],
  ['Unpaid', 0, 'working', 'Only after other leave is used up. Deducted from salary.'],
];

export const LEAVE_COLORS: Record<string, [string, string]> = {
  Annual: ['#3D6B9C', '#E7EEF6'], Medical: ['#2F6F4E', '#E6EFE9'], Hospitalisation: ['#4E8A6A', '#E8F1EC'], Emergency: ['#B7791F', '#FBF2E4'],
  Maternity: ['#A34E6E', '#F7E9EF'], Paternity: ['#3F5FA0', '#E8EDF7'], Compassionate: ['#6B7A90', '#EEF1F5'], Marriage: ['#8A6D3B', '#F5EFE4'],
  'Study / exam': ['#6B3D8C', '#F1EBF6'], Hajj: ['#2F7A7A', '#E4F1F1'], Umrah: ['#3E8C84', '#E6F2F0'], Replacement: ['#5B6BA8', '#ECEEF7'], Unpaid: ['#94A3B8', '#F0F2F5'],
};

/**
 * Selangor / national public holidays (weekends are already excluded separately).
 * Fixed-date holidays are exact; lunar-calendar ones are marked "(est.)" and must be
 * checked against the official gazette each year. Update this list every December.
 */
export const PUBLIC_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-02-02': 'Thaipusam (replacement)',
  '2026-02-17': 'Chinese New Year',
  '2026-02-18': 'Chinese New Year (2nd day)',
  '2026-03-20': 'Hari Raya Aidilfitri (est.)',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji (est.)',
  '2026-06-01': "Agong's Birthday",
  '2026-06-02': 'Wesak Day (replacement, est.)',
  '2026-06-17': 'Awal Muharram (est.)',
  '2026-08-25': 'Maulidur Rasul (est.)',
  '2026-08-31': 'National Day',
  '2026-09-16': 'Malaysia Day',
  '2026-11-09': 'Deepavali (replacement)',
  '2026-12-11': 'Hari Keputeraan Sultan Selangor',
  '2026-12-25': 'Christmas',
  '2027-01-01': "New Year's Day",
  '2027-01-22': 'Thaipusam (est.)',
  '2027-02-08': 'Chinese New Year (replacement)',
  '2027-02-24': 'Nuzul Al-Quran (est.)',
  '2027-03-10': 'Hari Raya Aidilfitri (est.)',
  '2027-03-11': 'Hari Raya Aidilfitri (2nd day, est.)',
  '2027-05-17': 'Hari Raya Haji (est.)',
  '2027-05-20': 'Wesak Day (est.)',
  '2027-06-07': "Agong's Birthday",
  '2027-08-16': 'Maulidur Rasul (replacement, est.)',
  '2027-08-31': 'National Day',
  '2027-09-16': 'Malaysia Day',
  '2027-10-28': 'Deepavali (est.)',
};

/* ------------------------------------------------------------------ claims */

export type ClaimKind = 'Travelling' | 'Disbursement' | 'Office' | 'Despatch' | 'Office bill';
export type ClaimStatus = 'Waiting' | 'Approved' | 'Paid' | 'Rejected';

export const KIND_COLORS: Record<string, [string, string]> = {
  'Office bill': ['#F0F2F5', '#5B6478'], Travelling: ['#E7EEF6', '#2F5680'], Disbursement: ['#F1EBF6', '#6B3D8C'], Despatch: ['#FBF2E9', '#8A6534'], Office: ['#F0F2F5', '#5B6478'],
};
export const STATUS_COLORS: Record<ClaimStatus, [string, string]> = {
  Waiting: ['#FBF2E9', '#8A6534'], Approved: ['#E7EEF6', '#2F5680'], Paid: ['#E6EFE9', '#2F6F4E'], Rejected: ['#FBEDE9', '#B23A2E'],
};

export const OFFICE_LABEL = 'Office (not billed)';
const OFFICE_REFS = new Set(['', 'FIRM_OVERHEAD', 'FIRM_OPERATIONS', 'Firm Operations']);

export interface ClaimRow {
  key: string;
  source: 'travel' | 'expense' | 'pv';
  iso: string;
  kind: ClaimKind;
  what: string;
  file: string;
  caseRef: string | null;
  amt: number;
  bill: number;
  form: string;
  rec: number;
  status: ClaimStatus;
  approver: string;
  approvedBy?: string;
  approvedAt?: string;
  payee?: string;
}

const statusOf = (s?: string, posted?: boolean, approved?: boolean): ClaimStatus => {
  if (s === 'Rejected') return 'Rejected';
  if (posted || s === 'Posted to GL') return 'Paid';
  if (approved || s === 'Approved') return 'Approved';
  return 'Waiting';
};

export interface FileDirectory {
  label: (ref: string | null | undefined) => string;
  caseOf: (ref: string | null | undefined) => Case | undefined;
  picOf: (ref: string | null | undefined) => string;
  managingPartner: string;
}

export const buildFileDirectory = (cases: Case[], clients: Client[], users: User[]): FileDirectory => {
  const byRef = new Map(cases.map((c) => [c.ref, c]));
  const byId = new Map(cases.map((c) => [c.id, c]));
  const clientName = (c: Case) => c.clientName || clients.find((cl) => cl.id === c.clientId)?.name || '';
  const partnerName = (code: string) => users.find((u) => partnerCode(u) === code)?.name || code;
  const mp = users.find((u) => u.isSuperAdmin)?.name || users.find((u) => partnerCode(u) === 'SH')?.name || 'Managing Partner';
  const caseOf = (ref?: string | null) => (ref && !OFFICE_REFS.has(ref) ? byRef.get(ref) || byId.get(ref) : undefined);
  return {
    caseOf,
    label: (ref) => {
      const c = caseOf(ref);
      if (!c) return ref && !OFFICE_REFS.has(ref) ? ref : OFFICE_LABEL;
      const n = clientName(c);
      return n ? c.ref + ' · ' + n : c.ref;
    },
    picOf: (ref) => {
      const c = caseOf(ref);
      if (!c) return mp;
      if (c.partners?.length) return partnerName(c.partners[0]);
      return c.lawyerInCharge || 'Partner in charge of the file';
    },
    managingPartner: mp,
  };
};

const docCount = (r: { documents?: unknown[]; attachmentName?: string }) => (r.documents?.length ? r.documents.length : r.attachmentName ? 1 : 0);

/** Every claim / payment request raised by `me` — only their own records. */
export const buildMyClaimRows = (
  me: Set<string>,
  travelClaims: TravelClaim[],
  expenses: Expense[],
  paymentVouchers: PaymentVoucher[],
  dir: FileDirectory
): ClaimRow[] => {
  const rows: ClaimRow[] = [];
  travelClaims.forEach((t) => {
    if (!isMine(t.claimant, me)) return;
    const ref = t.purposeType === 'Client Matter' ? t.fileRef : null;
    rows.push({
      key: 'tc-' + t.id, source: 'travel', iso: t.date || '', kind: 'Travelling',
      what: t.purpose || [t.from, t.to].filter(Boolean).join(' → ') || 'Travel claim',
      file: dir.label(ref), caseRef: ref, amt: Number(t.total || 0),
      bill: ref ? Number(t.billableClientTotal ?? t.total ?? 0) : 0,
      form: t.formNo || t.id, rec: docCount(t), status: statusOf(t.approvalStatus, t.postedToGl),
      approver: dir.picOf(ref), approvedBy: t.approvedBy, approvedAt: t.approvedAt,
    });
  });
  expenses.forEach((e) => {
    // Vendor-paid expenses (isClaimantAdvance === false) are the billing side of a payment
    // request — the PV row below already shows them, so they aren't listed twice.
    if (!isMine(e.claimant, me) || e.isClaimantAdvance === false) return;
    const c = dir.caseOf(e.fileRef) || dir.caseOf(e.caseId);
    const ref = c ? c.ref : null;
    rows.push({
      key: 'ex-' + e.id, source: 'expense', iso: e.date || '', kind: ref && e.billable ? 'Disbursement' : 'Office',
      what: e.description || e.category, file: dir.label(ref), caseRef: ref, amt: Number(e.amount || 0),
      bill: ref && e.billable ? Number(e.amount || 0) : 0, form: e.formNo || e.id, rec: docCount(e),
      status: statusOf(e.approvalStatus, e.postedToGl), approver: dir.picOf(ref), approvedBy: e.approvedBy, approvedAt: e.approvedAt,
    });
  });
  paymentVouchers.forEach((v) => {
    // Payment requests I raised for a vendor. PVs paying me back for my own claims are not requests.
    if (!isMine(v.preparedBy, me) || isMine(v.payee, me)) return;
    const c = dir.caseOf(v.fileRef);
    const ref = c ? c.ref : null;
    const kind: ClaimKind = v.requestKind || (v.voucherCategory === 'Office Operating' ? 'Office bill' : 'Disbursement');
    rows.push({
      key: 'pv-' + v.id, source: 'pv', iso: v.date || '', kind, what: v.description, file: dir.label(ref), caseRef: ref,
      amt: Number(v.amount || 0), bill: ref && v.accountSet !== 'CLIENT' && kind !== 'Office bill' ? Number(v.amount || 0) : 0,
      form: v.formNo || v.id, rec: docCount(v), status: statusOf(v.approvalStatus, v.postedToGl, v.approved),
      approver: dir.picOf(ref), approvedBy: v.approvedBy, payee: v.payee,
    });
  });
  return rows.sort((a, b) => b.iso.localeCompare(a.iso) || b.form.localeCompare(a.form));
};
