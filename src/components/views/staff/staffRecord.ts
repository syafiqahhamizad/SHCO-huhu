import type { HrDocument, StaffProfile, User } from '../../../types';
import { partnerCode } from '../../../lib/identity';
import { dMonY, esc, FirmLetterhead, isoOf, letterheadHtml, num2, todayIso } from './staffPortalShared';

/** A stored ISO timestamp as a local-time '30 Sep 2026' (not the UTC date). */
export const stampDay = (ts?: string) => (ts ? dMonY(isoOf(new Date(ts))) : '');

/**
 * The employee record (Staff Portal -> My profile) as an editable draft.
 * Everything is a string (or a list of string rows) so the form stays simple;
 * `applyDraft` turns it back into the stored StaffProfile shape.
 */
export interface Draft {
  // 1 Personal
  fullName: string; displayName: string; nric: string; birthday: string; gender: string; nationality: string;
  race: string; religion: string; maritalStatus: string; children: string;
  // 2 Contact
  phone: string; homeAddress: string; personalEmail: string;
  // 3 Emergency
  emName: string; emRelationship: string; emPhone: string;
  // 4 Employment
  code: string; designation: string; department: string; employmentType: StaffProfile['employmentType']; officeLocation: string;
  joinDate: string; probationEndDate: string; confirmationDate: string; reportingTo: string; status: string; lastWorkingDay: string;
  // 5 Pay & statutory
  basicSalary: string; allowances: { name: string; amount: string }[]; epfNo: string; socsoNo: string; taxNo: string;
  taxResidency: string; pcbCategory: string; zakatMonthly: string; bankName: string; bankAccountNo: string; bankAccountHolder: string;
  // 6 Professional
  callToBarDate: string; rollNo: string; practisingCertNo: string; practisingCertExpiry: string; syarieCertNo: string; syarieCertExpiry: string; cpdThisYear: string;
  // 7 / 8
  education: { qualification: string; institution: string; year: string }[];
  workHistory: { employer: string; position: string; from: string; to: string }[];
  noPriorEmployment: boolean;
  // 10 Milestones & bio
  bio: string; celebrationOptOut: boolean;
}

export const EMPLOYMENT_TYPES: StaffProfile['employmentType'][] = ['Permanent', 'Contract', 'Freelance', 'Intern'];
export const GENDERS = ['Male', 'Female'];
export const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
export const STATUSES = ['Active', 'Resigned', 'Terminated'];
export const RESIDENCY = ['Resident', 'Non-resident'];
export const PCB_CATEGORIES: [string, string][] = [
  ['1', '1 · Single'],
  ['2', '2 · Married, spouse not working'],
  ['3', '3 · Married, spouse working / divorced / widowed'],
];
export const DOC_TYPES = [
  'IC copy', 'Passport copy', 'Offer letter', 'Employment contract', 'Certificate / transcript', 'Practising certificate',
  'Syarie certificate', 'Confirmation letter', 'Increment / promotion letter', 'Warning letter', 'Resignation letter', 'Other',
];

const cpdYear = () => todayIso().slice(0, 4);
const numStr = (n?: number) => (typeof n === 'number' && Number.isFinite(n) ? String(n) : '');

/** The old single-line emergency contact ("name · relationship · phone") split into parts where it can be. */
export const parseLegacyEmergency = (s: string) => {
  const parts = s.split(/\s*[·|;,]\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 3) return { name: parts[0], relationship: parts[1], phone: parts[2] };
  if (parts.length === 2 && /\d{3}/.test(parts[1])) return { name: parts[0], relationship: '', phone: parts[1] };
  return { name: s.trim(), relationship: '', phone: '' };
};

export const draftOf = (u: User): Draft => {
  const p = u.staffProfile;
  const em = p?.emergency || (p?.emergencyContact ? parseLegacyEmergency(p.emergencyContact) : {});
  const e = p?.employment || {};
  const pay = p?.pay || {};
  const pro = p?.professional || {};
  return {
    fullName: p?.fullName || '', displayName: u.name, nric: p?.nric || '', birthday: p?.birthday || '', gender: p?.gender || '',
    nationality: p?.nationality || '', race: p?.race || '', religion: p?.religion || '', maritalStatus: p?.maritalStatus || '', children: numStr(p?.children),
    phone: p?.phone || '', homeAddress: p?.homeAddress || '', personalEmail: p?.personalEmail || '',
    emName: em.name || '', emRelationship: em.relationship || '', emPhone: em.phone || '',
    code: u.code || partnerCode(u) || '', designation: p?.designation || String(u.role || ''), department: p?.department || '',
    employmentType: p?.employmentType || 'Permanent', officeLocation: p?.officeLocation || '', joinDate: p?.joinDate || '',
    probationEndDate: e.probationEndDate || '', confirmationDate: e.confirmationDate || '', reportingTo: e.reportingTo || '',
    status: e.status || 'Active', lastWorkingDay: e.lastWorkingDay || '',
    basicSalary: numStr(pay.basicSalary), allowances: (pay.allowances || []).map((a) => ({ name: a.name, amount: numStr(a.amount) })),
    epfNo: p?.epfNo || '', socsoNo: p?.socsoNo || '', taxNo: pay.taxNo || '', taxResidency: pay.taxResidency || '', pcbCategory: pay.pcbCategory || '',
    zakatMonthly: numStr(pay.zakatMonthly), bankName: p?.bankName || '', bankAccountNo: p?.bankAccountNo || '', bankAccountHolder: pay.bankAccountHolder || '',
    callToBarDate: p?.callToBarDate || '', rollNo: pro.rollNo || '', practisingCertNo: pro.practisingCertNo || '', practisingCertExpiry: pro.practisingCertExpiry || '',
    syarieCertNo: pro.syarieCertNo || '', syarieCertExpiry: pro.syarieCertExpiry || '', cpdThisYear: numStr(pro.cpdPoints?.[cpdYear()]),
    education: (p?.education || []).map((r) => ({ ...r })),
    workHistory: (p?.workHistory || []).map((r) => ({ ...r })),
    noPriorEmployment: Boolean(p?.noPriorEmployment),
    bio: p?.bio || '', celebrationOptOut: Boolean(p?.celebrationOptOut),
  };
};

/** Trims every string (and every string in row lists). */
export const trimDraft = (d: Draft): Draft => {
  const out = { ...d } as Record<string, unknown>;
  Object.entries(d).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v.trim();
    else if (Array.isArray(v)) out[k] = v.map((row) => Object.fromEntries(Object.entries(row).map(([rk, rv]) => [rk, String(rv).trim()])));
  });
  const t = out as unknown as Draft;
  return {
    ...t,
    code: t.code.toUpperCase(),
    allowances: t.allowances.filter((a) => a.name || a.amount),
    education: t.education.filter((r) => r.qualification || r.institution || r.year),
    workHistory: t.workHistory.filter((r) => r.employer || r.position || r.from || r.to),
  };
};

const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
};
const opt = (s: string) => s || undefined;
/** Drops an all-empty nested object so the stored record stays tidy. */
const objOrNone = <T extends object>(o: T): T | undefined =>
  Object.values(o).some((v) => v !== undefined && !(Array.isArray(v) && v.length === 0)) ? o : undefined;

/** Returns a validation problem (plain English) or null. */
export const validateDraft = (d: Draft): string | null => {
  if (!d.displayName) return 'Display name can’t be empty.';
  if (!d.fullName) return 'Full name (as per IC) is required.';
  for (const [label, v] of [['Number of children', d.children], ['Basic salary', d.basicSalary], ['Zakat', d.zakatMonthly], ['CPD points', d.cpdThisYear]] as const)
    if (v && (num(v) === undefined || (num(v) as number) < 0)) return label + ' must be a number.';
  if (d.allowances.some((a) => !a.name || num(a.amount) === undefined)) return 'Each allowance needs a name and an amount.';
  if (d.personalEmail && !/^\S+@\S+\.\S+$/.test(d.personalEmail)) return 'Personal email doesn’t look like an email address.';
  return null;
};

/** Writes the draft's HR fields onto a stored profile (goals, check-ins, targets, documents etc. are kept). */
export const applyDraft = (base: StaffProfile, d: Draft, prevCpd?: Record<string, number>): StaffProfile => {
  const cpd = { ...(prevCpd || {}) };
  const c = num(d.cpdThisYear);
  if (c === undefined) delete cpd[cpdYear()];
  else cpd[cpdYear()] = c;
  const em = { name: opt(d.emName), relationship: opt(d.emRelationship), phone: opt(d.emPhone) };
  return {
    ...base,
    fullName: opt(d.fullName), nric: opt(d.nric), birthday: opt(d.birthday),
    gender: (opt(d.gender) as StaffProfile['gender']), nationality: opt(d.nationality), race: opt(d.race), religion: opt(d.religion),
    maritalStatus: opt(d.maritalStatus) as StaffProfile['maritalStatus'], children: num(d.children),
    phone: d.phone, homeAddress: opt(d.homeAddress), personalEmail: opt(d.personalEmail),
    emergency: objOrNone(em),
    // Kept in sync so anything still reading the old one-line field sees the same contact.
    emergencyContact: [em.name, em.relationship, em.phone].filter(Boolean).join(' · '),
    designation: d.designation, department: d.department, employmentType: d.employmentType, officeLocation: d.officeLocation, joinDate: d.joinDate,
    employment: objOrNone({
      probationEndDate: opt(d.probationEndDate), confirmationDate: opt(d.confirmationDate), reportingTo: opt(d.reportingTo),
      status: (d.status === 'Active' ? undefined : d.status) as 'Resigned' | 'Terminated' | undefined,
      lastWorkingDay: d.status === 'Active' ? undefined : opt(d.lastWorkingDay),
    }),
    epfNo: opt(d.epfNo), socsoNo: opt(d.socsoNo), bankName: opt(d.bankName), bankAccountNo: opt(d.bankAccountNo),
    pay: objOrNone({
      basicSalary: num(d.basicSalary),
      allowances: d.allowances.length ? d.allowances.map((a) => ({ name: a.name, amount: num(a.amount) || 0 })) : undefined,
      taxNo: opt(d.taxNo), taxResidency: opt(d.taxResidency) as 'Resident' | 'Non-resident' | undefined,
      pcbCategory: opt(d.pcbCategory) as '1' | '2' | '3' | undefined, zakatMonthly: num(d.zakatMonthly), bankAccountHolder: opt(d.bankAccountHolder),
    }),
    callToBarDate: opt(d.callToBarDate),
    professional: objOrNone({
      rollNo: opt(d.rollNo), practisingCertNo: opt(d.practisingCertNo), practisingCertExpiry: opt(d.practisingCertExpiry),
      syarieCertNo: opt(d.syarieCertNo), syarieCertExpiry: opt(d.syarieCertExpiry), cpdPoints: Object.keys(cpd).length ? cpd : undefined,
    }),
    education: d.education.length ? d.education : undefined,
    workHistory: d.workHistory.length ? d.workHistory : undefined,
    noPriorEmployment: d.noPriorEmployment || undefined,
    bio: d.bio,
    celebrationOptOut: d.celebrationOptOut || undefined,
  };
};

/* ------------------------------------------------------------------ completeness */

/** Lawyers get section 6; for everyone else it is not applicable and left out of the count. */
export const isLawyer = (u: User, d: Draft) =>
  /partner|lawyer|associate|advocate|counsel|pupil|chambering|legal assistant/i.test(String(u.role) + ' ' + d.designation) ||
  Boolean(d.callToBarDate || d.practisingCertNo || d.rollNo);

export const SECTION_TITLES = [
  'Personal', 'Contact', 'Emergency contact', 'Employment', 'Pay & statutory', 'Professional (lawyers)',
  'Education & qualifications', 'Employment history', 'Documents', 'Milestones & bio',
];

/** [complete, applicable] per section 1–10. */
export const sectionStatus = (u: User, d: Draft, docs: HrDocument[], staffId: string): [boolean, boolean][] => {
  const has = (...v: string[]) => v.every((x) => x.trim() !== '');
  const lawyer = isLawyer(u, d);
  return [
    [has(d.fullName, d.displayName, d.nric, d.birthday, d.gender, d.nationality, d.maritalStatus), true],
    [has(d.phone, d.homeAddress), true],
    [has(d.emName, d.emPhone), true],
    [Boolean(staffId) && has(d.designation, d.department, d.joinDate), true],
    [has(d.basicSalary, d.epfNo, d.socsoNo, d.taxNo, d.bankName, d.bankAccountNo), true],
    [has(d.callToBarDate, d.practisingCertNo, d.practisingCertExpiry), lawyer],
    [d.education.some((r) => r.qualification.trim()), true],
    [d.noPriorEmployment || d.workHistory.some((r) => r.employer.trim()), true],
    [docs.length > 0, true],
    [has(d.bio), true],
  ];
};

/** Expiry badge for a certificate: null when there's no date or it's more than 60 days away. */
export const expiryInfo = (iso: string): { text: string; color: string; bg: string } | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const days = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(todayIso() + 'T00:00:00').getTime()) / 86400000);
  if (days < 0) return { text: 'Expired', color: '#B23A2E', bg: '#FBEDE9' };
  if (days <= 60) return { text: days === 0 ? 'Expires today' : 'Expires in ' + days + ' day' + (days === 1 ? '' : 's'), color: '#8A6534', bg: '#FBF2E9' };
  return null;
};

/* ------------------------------------------------------------------ print */

const F = 'font-family:Arial,Helvetica,sans-serif;color:#000;font-size:9pt;line-height:1.4';
const H = 'margin:14px 0 4px;padding:4px 8px;background:#16223A;color:#fff;font-size:9.5pt;font-weight:bold;letter-spacing:.3px';
const TD = 'padding:3px 6px;border-bottom:1px solid #DDD;vertical-align:top';

/** 'YYYY-MM-DD' -> '30 Sep 2026', 'YYYY-MM' -> 'Sep 2026', anything else as typed. */
export const dt = (iso: string) => {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return dMonY(iso);
  if (/^\d{4}-\d{2}$/.test(iso)) return dMonY(iso + '-01').replace(/^\d+ /, '');
  return iso || '';
};
const v = (s: string | undefined) => (s ? esc(s) : '<span style="color:#999">—</span>');

/** Label/value pairs laid out two per row. */
const pairs = (rows: [string, string][]) => {
  const cells: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i];
    const b = rows[i + 1];
    cells.push(
      '<tr><td style="' + TD + ';width:18%;font-weight:bold">' + esc(a[0]) + '</td><td style="' + TD + ';width:32%">' + v(a[1]) + '</td>' +
      (b ? '<td style="' + TD + ';width:18%;font-weight:bold">' + esc(b[0]) + '</td><td style="' + TD + ';width:32%">' + v(b[1]) + '</td>' : '<td style="' + TD + '"></td><td style="' + TD + '"></td>') +
      '</tr>'
    );
  }
  return '<table style="width:100%;border-collapse:collapse">' + cells.join('') + '</table>';
};

const grid = (head: string[], rows: string[][], empty: string) =>
  rows.length
    ? '<table style="width:100%;border-collapse:collapse"><tr>' + head.map((h) => '<td style="' + TD + ';font-weight:bold;background:#EFEFEF">' + esc(h) + '</td>').join('') + '</tr>' +
      rows.map((r) => '<tr>' + r.map((c) => '<td style="' + TD + '">' + v(c) + '</td>').join('') + '</tr>').join('') + '</table>'
    : '<div style="padding:3px 6px;color:#666">' + esc(empty) + '</div>';

const section = (n: number, body: string) => '<div style="page-break-inside:avoid"><div style="' + H + '">' + n + '. ' + esc(SECTION_TITLES[n - 1]) + '</div>' + body + '</div>';

/** The whole employee record on A4 with the firm letterhead. File contents are not included, only their names. */
export const buildEmployeeRecordHtml = (u: User, users: User[], lh: string, firm: FirmLetterhead) => {
  const p = u.staffProfile;
  const d = draftOf(u);
  const docs = p?.hrDocuments || [];
  const staffId = p?.staffId || '—';
  const reportsTo = users.find((x) => x.id === d.reportingTo)?.name || '';
  const pcb = PCB_CATEGORIES.find(([k]) => k === d.pcbCategory)?.[1] || '';
  const money = (s: string) => (s ? 'RM ' + num2(Number(s)) : '');
  const updated = p?.hrUpdatedAt ? 'Last updated by ' + (p.hrUpdatedBy || 'HR') + ' on ' + stampDay(p.hrUpdatedAt) : 'Not yet updated through the HR record form';
  return (
    '<div style="' + F + '">' +
    letterheadHtml(lh, firm, 'EMPLOYEE RECORD', [['Staff No.', staffId], ['Printed', dMonY(todayIso())]]) +
    '<p style="margin:0 0 4px;font-size:12pt;font-weight:bold;font-family:Georgia,serif;color:#16223A">' + esc(d.fullName || u.name) + '</p>' +
    '<p style="margin:0 0 6px;color:#444">' + esc([d.designation, d.department, d.status !== 'Active' ? d.status : ''].filter(Boolean).join(' · ')) + '</p>' +
    section(1, pairs([
      ['Full name (as per IC)', d.fullName], ['Display name', d.displayName], ['NRIC / passport no.', d.nric], ['Date of birth', dt(d.birthday)],
      ['Gender', d.gender], ['Nationality', d.nationality], ['Race', d.race], ['Religion', d.religion], ['Marital status', d.maritalStatus], ['No. of children', d.children],
    ])) +
    section(2, pairs([['Mobile', d.phone], ['Personal email', d.personalEmail], ['Work email', u.email], ['Home address', d.homeAddress]])) +
    section(3, pairs([['Name', d.emName], ['Relationship', d.emRelationship], ['Phone', d.emPhone]])) +
    section(4, pairs([
      ['Staff ID', p?.staffId || ''], ['User code', d.code], ['Role', String(u.role || '')], ['Designation', d.designation], ['Department', d.department],
      ['Employment type', d.employmentType], ['Office location', d.officeLocation], ['Join date', dt(d.joinDate)], ['Probation ends', dt(d.probationEndDate)],
      ['Confirmation date', dt(d.confirmationDate)], ['Reporting to', reportsTo], ['Status', d.status], ...(d.status !== 'Active' ? [['Last working day', dt(d.lastWorkingDay)] as [string, string]] : []),
    ])) +
    section(5, pairs([
      ['Basic salary', d.basicSalary ? money(d.basicSalary) + ' / month' : ''], ['Fixed allowances', d.allowances.map((a) => a.name + ' ' + money(a.amount)).join('; ')],
      ['EPF no.', d.epfNo], ['SOCSO no.', d.socsoNo], ['Income tax no.', d.taxNo], ['Tax residency', d.taxResidency], ['PCB category', pcb],
      ['Zakat', d.zakatMonthly ? money(d.zakatMonthly) + ' / month' : ''], ['Bank', d.bankName], ['Account no.', d.bankAccountNo], ['Account holder', d.bankAccountHolder],
    ])) +
    (isLawyer(u, d)
      ? section(6, pairs([
          ['Admitted / called to the Bar', dt(d.callToBarDate)], ['A&S roll no.', d.rollNo], ['Practising cert. no.', d.practisingCertNo], ['Practising cert. expiry', dt(d.practisingCertExpiry)],
          ['Syarie cert. no.', d.syarieCertNo], ['Syarie cert. expiry', dt(d.syarieCertExpiry)], ['CPD points ' + cpdYear(), d.cpdThisYear],
        ]))
      : '') +
    section(7, grid(['Qualification', 'Institution', 'Year'], d.education.map((r) => [r.qualification, r.institution, r.year]), 'None recorded.')) +
    section(8, grid(['Employer', 'Position', 'From', 'To'], d.workHistory.map((r) => [r.employer, r.position, dt(r.from), dt(r.to)]), d.noPriorEmployment ? 'No previous employment.' : 'None recorded.')) +
    section(9, grid(['Type', 'File', 'Uploaded'], docs.map((x) => [x.type, x.name, stampDay(x.uploadedAt) + (x.uploadedBy ? ' by ' + x.uploadedBy : '')]), 'No documents on file.')) +
    section(10, pairs([['Professional bio', d.bio], ['Milestone announcements', d.celebrationOptOut ? 'Hidden at staff’s request' : 'Shown']])) +
    '<p style="margin:18px 0 0;font-size:8pt;color:#444">' + esc(updated) + '. Uploaded documents are kept in the firm’s secure storage and are listed here by name only.</p>' +
    '<p style="margin:4px 0 0;font-size:8pt;font-weight:bold">PRIVATE &amp; CONFIDENTIAL — HR record.</p></div>'
  );
};
