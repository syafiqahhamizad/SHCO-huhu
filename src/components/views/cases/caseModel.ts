/**
 * Cases (Working File) — pure helpers over REAL app data.
 *
 * Everything the Cases List / Working File shows is derived from the existing stores in
 * AppContext (Case.tasks, Case.hearings, Case.courtDiary, Case.serviceRecord, invoices,
 * payments, retainers, time entries, expenses, travel claims…). Nothing here invents records.
 */
import type {
  Case, Client, Expense, Invoice, MatterParty, Payment, Quotation, Retainer, Task, TimeEntry, TravelClaim, User, ServiceRecord,
} from '../../../types';
import { round2 } from '../../../lib/financeCalc';
import { moneyForFile } from '../../../lib/moneyByFile';
import { isApprovedForBilling } from '../../../lib/billingEngine';

/* ------------------------------------------------------------------ tokens */

export const P = {
  g: { bg: '#E6EFE9', fg: '#1F5A3B' },
  a: { bg: '#F6EEDC', fg: '#8A6D3B' },
  n: { bg: '#EEF1F5', fg: '#4A5468' },
  r: { bg: '#F6E4E1', fg: '#8E2A20' },
  b: { bg: '#E4ECF5', fg: '#2F4F7A' },
} as const;

const AVATAR: Record<string, string> = { SH: '#16223A', DH: '#8A6D3B', AH: '#3D6B9C', ZA: '#6B3D8C', NI: '#2E7D7A', AF: '#2F6F4E' };
const AVATAR_FALLBACK = ['#2E7D7A', '#2F6F4E', '#6B3D8C', '#3D6B9C', '#8A6D3B'];

/* ------------------------------------------------------------------ dates */

export const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const todayIso = () => iso(new Date());
const toDate = (s?: string) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dmy = String(s).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
export const isoOf = (s?: string) => { const d = toDate(s); return d ? iso(d) : ''; };
export const fmt = (s?: string) => { const d = toDate(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
export const short = (s?: string) => { const d = toDate(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'; };
export const daysFrom = (s?: string) => {
  const d = toDate(s);
  if (!d) return 99999;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 864e5);
};
export const addDays = (n: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return iso(d); };
export const mondayOf = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
export const stamp = () => { const d = new Date(); return iso(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const whenF = (s?: string) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fileAge = (opened?: string): string => {
  const s = toDate(opened);
  if (!s) return '—';
  const t = new Date();
  let y = t.getFullYear() - s.getFullYear(), m = t.getMonth() - s.getMonth(), d = t.getDate() - s.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  if (y < 0) return '0 days';
  if (!y && !m) return d + (d === 1 ? ' day' : ' days');
  return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', m ? m + (m === 1 ? ' mo' : ' mos') : ''].filter(Boolean).join(' ');
};

/** When the file was opened: fileOpenedDate, else createdDate, else the MM-YY in the ref. */
export const openedOf = (c: Case): string => {
  if (c.fileOpenedDate) return isoOf(c.fileOpenedDate);
  if (c.createdDate) return isoOf(c.createdDate);
  const m = (c.ref || '').match(/(\d{2})-(\d{2,4})$/);
  if (m) return `${m[2].length === 2 ? '20' + m[2] : m[2]}-${m[1]}-01`;
  return '';
};

/* ------------------------------------------------------------------ money */

export const rm = (n: number) => 'RM ' + (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num2 = (n: number) => (n ? (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

/* ------------------------------------------------------------------ status stages */

const STAGES: Record<string, string[]> = {
  'Civil Litigation': ['File opened', 'Pleadings', 'Case management', 'Interlocutory application', 'Trial', 'Decision', 'Enforcement / closed'],
  Conveyancing: ['Instructions & searches', 'SPA signed & stamped', 'Loan documents', 'Consent to transfer', 'Balance & redemption', 'Transfer registered', 'Keys & closed'],
  Corporate: ['Instructions', 'Due diligence', 'Drafting', 'Negotiation', 'Signing', 'Post-completion', 'Closed'],
  Family: ['Instructions', 'Petition filed', 'Service', 'Counselling / mediation', 'Hearing', 'Decree nisi', 'Decree absolute / closed'],
  Syariah: ['Instructions', 'Claim filed', 'Sulh (mediation)', 'Hearing', 'Judgment', 'Enforcement / closed'],
  'Probate & Estates': ['Collect documents', 'Petition filed', 'Grant issued', 'Collect assets', 'Pay debts & duty', 'Distribution', 'Closed'],
  Employment: ['Representation filed (JPP)', 'Conciliation', 'Referred to Industrial Court', 'Hearing', 'Award', 'Closed'],
  Criminal: ['File opened', 'Charge & mention', 'Pre-trial', 'Trial', 'Decision', 'Sentencing / appeal', 'Closed'],
};

export const practiceOf = (c: Pick<Case, 'practiceArea' | 'type'>) => c.practiceArea || c.type || '';

export const stageKey = (practice: string): string => {
  const p = (practice || '').toLowerCase();
  if (/convey|property/.test(p)) return 'Conveyancing';
  if (/corporate|commercial|tech|fintech/.test(p)) return 'Corporate';
  if (/family|divorce/.test(p)) return 'Family';
  if (/syariah|shariah/.test(p)) return 'Syariah';
  if (/probate|estate/.test(p)) return 'Probate & Estates';
  if (/employ|industrial/.test(p)) return 'Employment';
  if (/criminal/.test(p)) return 'Criminal';
  return 'Civil Litigation';
};
export const stagesFor = (practice: string) => STAGES[stageKey(practice)];

/** Current stage index: Case.statusStage, else mapped from the legacy free-text Case.stage. */
export const stageIndexOf = (c: Case): number => {
  const list = stagesFor(practiceOf(c));
  if (typeof c.statusStage === 'number' && c.statusStage >= 0) return Math.min(c.statusStage, list.length - 1);
  if (c.statusStageName) { const i = list.indexOf(c.statusStageName); if (i >= 0) return i; }
  const s = (c.stage || '').toLowerCase();
  if (!s) return 0;
  const exact = list.findIndex((x) => x.toLowerCase() === s);
  if (exact >= 0) return exact;
  if (stageKey(practiceOf(c)) !== 'Civil Litigation') return 0;
  if (/enforce|closed/.test(s)) return 6;
  if (/decision|judgment|judgement/.test(s)) return 5;
  if (/trial|submission/.test(s)) return 4;
  if (/interlocutory|application|injunction/.test(s)) return 3;
  if (/ptcm|case management|mention|mediation|settlement/.test(s)) return 2;
  if (/pleading|writ|defence/.test(s)) return 1;
  return 0;
};

const STAGE_MSG: Record<string, string> = {
  'File opened': 'we have opened your file and are reviewing your documents.',
  Pleadings: 'your claim has been filed in court and served on the other side.',
  'Case management': 'the court is now setting the timetable for the case.',
  'Interlocutory application': 'an application is being heard before the main trial.',
  Trial: 'your case is fixed for trial. We will brief you before the date.',
  Decision: 'the court has given its decision. We will call you to explain the next steps.',
  'Enforcement / closed': 'your matter is now at the final stage.',
};
export const stageMessage = (stage: string) => STAGE_MSG[stage] || 'your matter is now at the ' + stage.toLowerCase() + ' stage.';

/* ------------------------------------------------------------------ parties */

const ord = (n: number) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

/**
 * Parties on the file. Case.caseParties once the file has been edited in the new Working File;
 * otherwise read from the legacy fields so every existing case renders.
 */
export const partiesOf = (c: Case, clients: Client[] = []): MatterParty[] => {
  if (c.caseParties && c.caseParties.length) return c.caseParties;
  const out: MatterParty[] = [];
  const contactOf = (phone?: string, email?: string) => [phone, email].filter(Boolean).join(' · ');
  if (c.clientsList && c.clientsList.length) {
    c.clientsList.forEach((p, i) => {
      const cl = clients.find((x) => x.id === (p.clientId || p.id));
      out.push({ id: 'cl-' + (p.id || i), side: 'client', name: p.name, idNo: p.icOrRegNo || cl?.icNo || cl?.registrationNo || '', role: p.role && p.role !== 'Client / Principal' ? p.role : c.clientRole || 'Client', phone: p.phone || cl?.phone || '', email: p.email || cl?.email || '', contact: contactOf(p.phone || cl?.phone, p.email || cl?.email), clientId: p.clientId || cl?.id });
    });
  } else {
    const ids = String(c.clientId || '').split(',').map((s) => s.trim()).filter(Boolean);
    const found = ids.map((id) => clients.find((x) => x.id === id)).filter(Boolean) as Client[];
    if (found.length) found.forEach((cl, i) => out.push({ id: 'cl-' + cl.id, side: 'client', name: cl.name, idNo: cl.icNo || cl.icNumber || cl.registrationNo || '', role: c.clientRole || (found.length > 1 ? ord(i + 1) + ' Client' : 'Client'), phone: cl.phone, email: cl.email, contact: contactOf(cl.phone, cl.email), clientId: cl.id }));
    else if (c.clientName) out.push({ id: 'cl-0', side: 'client', name: c.clientName, role: c.clientRole || 'Client' });
  }
  if (c.opposingPartiesList && c.opposingPartiesList.length) {
    c.opposingPartiesList.forEach((p, i) => out.push({ id: 'op-' + (p.id || i), side: 'opposing', name: p.name, idNo: p.icOrRegNo || '', role: p.role || 'Opposing party', phone: p.phone, email: p.email, contact: contactOf(p.phone, p.email) }));
  } else {
    const names = (c.opposingParties && c.opposingParties.length ? c.opposingParties : c.opposingParty ? [c.opposingParty] : [])
      .map((s) => String(s || '').trim()).filter((s) => s && s !== 'N/A');
    names.forEach((entry, i) => {
      const k = entry.indexOf(':');
      out.push({ id: 'op-' + i, side: 'opposing', name: k > -1 ? entry.slice(k + 1).trim() : entry, role: k > -1 ? entry.slice(0, k).trim() : 'Opposing party' });
    });
  }
  if (c.opposingSolicitorsRegistry && c.opposingSolicitorsRegistry.length) {
    c.opposingSolicitorsRegistry.forEach((r, i) => out.push({ id: 'so-' + (r.id || i), side: 'solicitor', name: r.firmName, role: r.partyRepresented ? 'For ' + r.partyRepresented : 'Counsel on record', actsFor: r.partyRepresented, firmRef: r.firmRef, phone: r.contactNumber, email: r.email, contact: [r.solicitors, r.contactNumber, r.email, r.firmRef ? 'ref ' + r.firmRef : ''].filter(Boolean).join(' · ') }));
  } else if (c.opposingSolicitorsFirm) {
    out.push({ id: 'so-0', side: 'solicitor', name: c.opposingSolicitorsFirm, role: 'Counsel on record', firmRef: c.opposingSolicitorsRef, phone: c.opposingSolicitorsPhone, email: c.opposingSolicitorsEmail, contact: [c.opposingSolicitorsName, c.opposingSolicitorsPhone, c.opposingSolicitorsEmail].filter(Boolean).join(' · ') });
  } else {
    (c.opposingCounsel || []).filter(Boolean).forEach((f, i) => out.push({ id: 'so-' + i, side: 'solicitor', name: f, role: 'Counsel on record' }));
  }
  // Older firms replaced through the legacy "change of solicitors" flow stay listed as discharged.
  (c.opposingSolicitorsHistory || []).forEach((h, i) => {
    if (out.some((p) => p.side === 'solicitor' && p.name === h.firmName)) return;
    out.push({ id: 'soh-' + (h.id || i), side: 'solicitor', name: h.firmName, role: 'Counsel on record', contact: [h.solicitorName, h.contactNumber].filter(Boolean).join(' · '), dischargedOn: h.effectiveDate });
  });
  return out;
};

/** Keeps the legacy single-client / opposing fields in step with the parties list, so the
 * conflict check, client portal and older screens keep reading the same people. */
export const legacyFromParties = (parties: MatterParty[], c: Case): Partial<Case> => {
  const clientsP = parties.filter((p) => p.side === 'client');
  const opp = parties.filter((p) => p.side === 'opposing');
  const sols = parties.filter((p) => p.side === 'solicitor' && !p.dischargedOn);
  return {
    caseParties: parties,
    clientsList: clientsP.map((p) => ({ id: p.clientId || p.id, clientId: p.clientId, name: p.name, role: p.role, icOrRegNo: p.idNo, phone: p.phone, email: p.email })),
    clientName: clientsP.map((p) => p.name).join(' & ') || c.clientName,
    opposingPartiesList: opp.map((p) => ({ id: p.id, name: p.name, role: p.role, icOrRegNo: p.idNo, phone: p.phone, email: p.email })),
    opposingParties: opp.map((p) => p.name),
    opposingParty: opp[0]?.name || '',
    opposingSolicitorsRegistry: sols.map((p, i) => ({ id: p.id, partyRepresented: p.actsFor || p.role.replace(/^For\s+/i, ''), firmName: p.name, solicitors: p.contact || '', firmRef: p.firmRef, contactNumber: p.phone, email: p.email, isPrimary: i === 0 })),
    opposingCounsel: sols.map((p) => p.name),
    opposingSolicitorsFirm: sols[0]?.name || '',
  };
};

/* ------------------------------------------------------------------ court */

export const COURT_LEVELS = ['Federal Court', 'Court of Appeal', 'High Court', 'Sessions Court', 'Magistrates Court', 'Syariah High Court', 'Syariah Subordinate Court', 'Industrial Court', 'Arbitration (AIAC)'];

export const courtOf = (c: Case) => {
  const d = c.courtDetails || {};
  const legacy = (c.court || '').trim();
  const clean = (s: string) => (s && !/^n\/?a$/i.test(s) ? s : '');
  const name = clean([d.level, d.location].filter(Boolean).join(' ') || legacy);
  return {
    level: d.level || '',
    location: d.location || '',
    address: d.address || '',
    division: d.division || '',
    suit: clean(c.courtCaseNo || ''),
    coram: clean(c.judge && c.judge !== 'Presiding Officer / Registrar' ? c.judge : ''),
    coramSince: d.coramSince || '',
    name,
  };
};

/* ------------------------------------------------------------------ tasks */

export const isDeadline = (t: Pick<Task, 'kind'>) => !!t.kind && t.kind !== 'Task';
export const isDone = (t: Pick<Task, 'status'>) => t.status === 'Completed' || t.status === 'Done';

/** "File affidavit in reply (Encl. 12)" → "affidavit in reply". Used to tick deadlines off from filings. */
export const deriveMatchKey = (title: string) =>
  title.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/^\s*(file|filing|serve|service of|submit|lodge|prepare|draft)\s+/, '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ filing & service */

export const METHODS = ['By hand', 'AR Registered post', 'E-mail', 'e-Filing (CMS)', 'Courier'];
export const PROOF_TYPES = ['Sealed copy', 'AR card (pink card)', 'Acknowledgement (chop & sign)', 'Affidavit of service', 'E-mail (sent / received)', 'CMS e-filing receipt', 'Courier proof of delivery', 'Other'];
const PT: Record<string, string> = { 'By hand': 'Acknowledgement (chop & sign)', 'AR Registered post': 'AR card (pink card)', 'E-mail': 'E-mail (sent / received)', 'e-Filing (CMS)': 'CMS e-filing receipt', Courier: 'Courier proof of delivery' };
export const proofTypeFor = (action: string, method: string) => (action === 'Filed' ? 'Sealed copy' : PT[method] || 'Other');
export const actionOf = (r: ServiceRecord): 'Filed' | 'Served' | 'Received' => r.action || 'Served';
export const hasProof = (r: ServiceRecord) => !!(r.driveFileId || r.webViewLink || r.storagePath);

/* ------------------------------------------------------------------ people */

export interface Person { name: string; code: string; color: string; role: string; isPartner: boolean; email?: string; id?: string }

const codeFor = (u: Pick<User, 'name' | 'code'>) => {
  if (u.code) return u.code.toUpperCase();
  const w = String(u.name || '').split(/\s+/).filter((x) => x && !/^(bin|binti|b\.|bt\.)$/i.test(x));
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '—';
};

/** Who can handle a file: active partners, lawyers and assistants (not accounts, reviewers or clients). */
export const isFileHandler = (p: Pick<Person, 'role'>) => ['Partner', 'Lawyer', 'Assistant'].includes(p.role);

export const staffOf = (users: User[] = []): Person[] =>
  users.filter((u) => u.status !== 'Inactive' && u.role !== 'Client').map((u, i) => {
    const code = codeFor(u);
    return { id: u.id, name: u.name, code, email: u.email, role: String(u.role || ''), isPartner: u.role === 'Partner', color: AVATAR[code] || AVATAR_FALLBACK[i % AVATAR_FALLBACK.length] };
  });

const personByName = (staff: Person[], name?: string): Person | undefined => {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return undefined;
  return staff.find((p) => p.name.toLowerCase() === n || p.code.toLowerCase() === n);
};
export const avatarOf = (staff: Person[], name?: string) => {
  const p = personByName(staff, name);
  const code = p?.code || codeFor({ name: name || '' } as User);
  return { code, color: p?.color || AVATAR[code] || '#4A5468', name: p?.name || name || 'Unassigned' };
};
export const partnerNames = (c: Case, staff: Person[]) => (c.partners || []).map((code) => staff.find((p) => p.code === code)?.name || code);
export const lawyerOf = (c: Case) => (c.lawyerInCharge || '').split(',')[0].trim() || (c.lawyers || [])[0] || '';
/** Every lawyer on the file, lead first (from lawyerInCharge, then the lawyers list). */
export const lawyersOf = (c: Case): string[] =>
  Array.from(new Set([...(c.lawyerInCharge || '').split(','), ...(c.lawyers || [])].map((n) => n.trim()).filter(Boolean)));

/* ------------------------------------------------------------------ matching records to the file */

const onFile = (c: Pick<Case, 'id' | 'ref'>, caseId?: string, fileRef?: string) =>
  (!!caseId && (caseId === c.id || caseId === c.ref)) || (!!fileRef && fileRef === c.ref);

/* ------------------------------------------------------------------ money on the file */

interface MoneyInputs {
  invoices: Invoice[]; payments: Payment[]; retainers: Retainer[]; quotations: Quotation[];
  timeEntries: TimeEntry[]; expenses: Expense[]; travelClaims: TravelClaim[];
}

export const matterMoney = (c: Case, m: MoneyInputs) => {
  // Agreed / billed / received / outstanding / client account: the single money source.
  const fm = moneyForFile(c, m);
  const { bills, billed, received, outstanding, clientLedger, clientBalance, officeLedger, agreed, quotes, accepted } = fm;

  // Work not billed — same rule as Accounts & Finance (billable, not billed / written off, approved).
  const te = m.timeEntries.filter((t) => onFile(c, t.caseId));
  const ex = m.expenses.filter((e) => onFile(c, e.caseId, e.fileRef));
  const tc = m.travelClaims.filter((t) => t.fileRef === c.ref && t.purposeType === 'Client Matter');
  const ubTime = te.filter((t) => t.billable && !t.billed && !t.writtenOff && isApprovedForBilling(t.approvalStatus));
  const ubHours = round2(ubTime.reduce((s, t) => s + Number(t.hours || 0), 0));
  const ubFees = round2(ubTime.reduce((s, t) => s + Number(t.hours || 0) * Number(t.rate || 0), 0));
  const travelBill = (t: TravelClaim) => Math.max(0, Number(t.billableClientTotal || 0));
  const ubDisb = round2(
    ex.filter((e) => e.billable && !e.billed && !e.writtenOff && isApprovedForBilling(e.approvalStatus)).reduce((s, e) => s + Number(e.amount || 0), 0) +
    tc.filter((t) => travelBill(t) > 0 && t.billed !== 'Y' && isApprovedForBilling(t.approvalStatus)).reduce((s, t) => s + travelBill(t), 0),
  );
  const lastBillWithBal = bills.filter((b) => b.issued && b.bal > 0).map((b) => b.id);

  return { bills, billed, received, outstanding, clientLedger, clientBalance, officeLedger, agreed, quotes, accepted, te, ex, tc, ubHours, ubFees, ubDisb, lastBillWithBal };
};
