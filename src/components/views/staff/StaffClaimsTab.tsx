import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { ClaimAttachment, ClaimDocument, Expense, PaymentVoucher, TravelClaim } from '../../../types';
import { claimsStorageService } from '../../../services/claimsStorageService';
import { DRIVE_REQUIRED_MSG, isUploadReady, openStoredFile, prepareStorage, storeClaimReceipt, storedFileKey, useStorageLabel, validateClaimFile } from '../../../services/fileStorageService';
import {
  card, cardTitle, ClaimKind, ClaimRow, ddmm, ddmmyyyy, FileDirectory, KIND_COLORS, labelWrap, OFFICE_LABEL, rm, STATUS_COLORS, todayIso,
} from './staffPortalShared';
import { resolveApproval } from '../../../lib/approvers';
import { usePracticeSettings } from '../settings/settingsShared';
import { DOC_TYPE_COLORS, FINANCE_DOC_TYPES, matchesYearType, yearOptions } from '../../../lib/claimFilters';
import { folderUrl } from '../../../lib/driveLayout';

const SEL: React.CSSProperties = { border: '1px solid #C9D3E0', borderRadius: 6, padding: '4px 6px', fontSize: 11, color: '#16223A', background: '#fff', fontFamily: 'inherit' };

const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' };
const INP: React.CSSProperties = { border: '1px solid #C9D3E0', borderRadius: 4, padding: '7px 9px', fontSize: 12, color: '#16223A', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const SECTION: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#16223A', paddingBottom: 5, borderBottom: '1.5px solid #16223A' };
const TD: React.CSSProperties = { border: '1px solid #16223A', padding: '5px 6px' };
const GRID = '48px minmax(0,1.4fr) 80px 80px 92px 60px 112px';

const num = (v: string) => Number(String(v || '').replace(/[^0-9.]/g, '')) || 0;
const pad4 = (n: number) => String(n).padStart(4, '0');

type Mode = 'Claim' | 'PV';
type From = 'Disb' | 'Office' | 'Client';
type Method = 'Bank transfer' | 'Online portal' | 'Cheque';

/** A receipt picked in the form — the File itself is uploaded on submit to the firm Google Drive (blocked until Drive is set up). */
interface FormDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  category: ClaimDocument['category'];
  file: File;
}

interface Item {
  dateIso: string;
  kind: ClaimKind;
  what: string;
  caseRef: string | null;
  file: string;
  km: number;
  parking: number;
  toll: number;
  amt: number;
  bill: number;
  docs: FormDoc[];
}

interface Form {
  open: boolean;
  mode: Mode;
  items: Item[];
  kind: ClaimKind;
  dateIso: string;
  what: string;
  km: string;
  parking: string;
  toll: string;
  amt: string;
  file: string;
  caseRef: string | null;
  fq: string;
  fOpen: boolean;
  vendor: string;
  vbank: string;
  pmethod: Method;
  from: From;
  portal: string;
  pref: string;
  files: FormDoc[];
}

const blankForm = (): Form => ({
  open: false, mode: 'Claim', items: [], kind: 'Travelling', dateIso: todayIso(), what: '', km: '', parking: '', toll: '', amt: '',
  file: '', caseRef: null, fq: '', fOpen: false, vendor: '', vbank: '', pmethod: 'Bank transfer', from: 'Disb', portal: 'e-Filing (Mahkamah)', pref: '', files: [],
});

const PORTALS = ['e-Filing (Mahkamah)', 'Syariah e-Filing (JKSM)', 'e-Tanah / PTG', 'STAMPS (LHDN stamp duty)', 'MyCoID / SSM', 'MyInsolvensi search', 'Other website'];
const NOTE: Record<string, string> = {
  Travelling: 'Court, land office, client meetings. Mileage RM 1.00/km to you, billed to client RM 1.50/km. Parking and tolls at cost (receipt / Touch ’n Go statement).',
  Disbursement: 'Paid for a client file: filing fees, search fees, stamp duty, commissioner for oaths. Billed to the client at cost.',
  Despatch: 'Runner / despatch to court, land office, bank. The firm pays the despatch company directly.',
  'Office bill': 'Office supplier bill (toner, repairs, subscriptions). The firm pays the supplier; not billed to any client.',
  Office: 'Small office purchases you paid: stationery, pantry, urgent repairs. Not billed to any client.',
};

const readKey = (uid: string) => 'shco_staffportal_read_' + uid;
const loadRead = (uid: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(readKey(uid)) || '[]');
  } catch {
    return [];
  }
};

const Radio: React.FC<{ on: boolean; size?: number }> = ({ on, size = 14 }) => (
  <span style={{ flex: 'none', width: size, height: size, marginTop: size === 14 ? 1 : 0, borderRadius: 9999, border: '1.5px solid #16223A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ width: size === 14 ? 8 : 6, height: size === 14 ? 8 : 6, borderRadius: 9999, background: on ? '#16223A' : 'transparent' }} />
  </span>
);

interface Props {
  rows: ClaimRow[];
  dir: FileDirectory;
}

export const StaffClaimsTab: React.FC<Props> = ({ rows, dir }) => {
  const {
    currentUser, users, cases, clients, travelClaims, expenses, paymentVouchers, addTravelClaim, addExpense, addPaymentVoucher,
    addNotification, addActivityLog, getNextSequenceId, showToast,
  } = useApp();
  const [f, setForm] = useState<Form>(blankForm);
  const setF = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));
  const [drag, setDrag] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => loadRead(currentUser.id));
  const blurT = useRef<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState('');
  const [recOpen, setRecOpen] = useState<string | null>(null);
  const [yearF, setYearF] = useState('All');
  const [typeF, setTypeF] = useState('All');
  const storageLabel = useStorageLabel();
  // Firm & Practice Settings → Who approves → Staff claims; until it is set, the file's partner in charge approves.
  const [settings] = usePracticeSettings();
  const rule = resolveApproval('claims', users || [], settings.approvers);
  const openStored = async (a: ClaimAttachment) => {
    const err = await openStoredFile(a);
    if (err) showToast(err);
  };

  /* ---------------- list ---------------- */

  const years = useMemo(() => yearOptions<ClaimRow>(rows, (r) => r.iso), [rows]);
  const list = rows.filter((r) => matchesYearType({ date: r.iso, docType: r.docType }, { year: yearF, type: typeF })).map((c) => ({
    ...c,
    withTxt: c.status === 'Waiting' ? 'with ' + (rule ? rule.label : c.approver) : c.status === 'Approved' ? 'Accounts to pay' : c.status === 'Paid' ? 'paid by Accounts' : 'by ' + (c.approvedBy || c.approver),
  }));

  /* ---------------- updates (derived from my own records only) ---------------- */

  const alerts = useMemo(() => {
    const forms = new Map<string, ClaimRow[]>();
    rows.forEach((r) => {
      const k = r.form + '|' + r.status;
      forms.set(k, [...(forms.get(k) || []), r]);
    });
    const out: { id: string; dir: 'in' | 'out'; text: string; meta: string; iso: string }[] = [];
    forms.forEach((items, k) => {
      const r = items[0];
      const tot = items.reduce((s, i) => s + i.amt, 0);
      const n = items.length;
      const when = (r.approvedAt || r.iso || '').slice(0, 10);
      if (r.status === 'Waiting') {
        const apps = Array.from(new Set(items.map((i) => i.approver)));
        out.push({ id: k, dir: 'out', iso: r.iso, text: apps.join(', ') + ' alerted: ' + r.form + ' (' + n + ' item' + (n > 1 ? 's' : '') + ', ' + rm(tot) + ') waiting for approval', meta: ddmm(r.iso) + ' · in-app' });
      } else if (r.status === 'Approved') {
        out.push({ id: k, dir: 'in', iso: when, text: (r.approvedBy || r.approver) + ' approved ' + r.form + (r.source === 'pv' ? '. It is now with Accounts to pay ' + (r.payee || 'the vendor') + '.' : '. It is now with Accounts to pay you.'), meta: ddmm(when) });
      } else if (r.status === 'Paid') {
        out.push({ id: k, dir: 'in', iso: when, text: 'Accounts paid ' + r.form + ': ' + rm(tot) + (r.source === 'pv' ? ' to ' + (r.payee || 'the vendor') : ' to you'), meta: ddmm(when) });
      } else {
        out.push({ id: k, dir: 'in', iso: when, text: (r.approvedBy || r.approver) + ' rejected “' + r.what + '”' + (n > 1 ? ' and ' + (n - 1) + ' other item' + (n > 2 ? 's' : '') : '') + '.', meta: ddmm(when) });
      }
    });
    return out.sort((a, b) => b.iso.localeCompare(a.iso));
  }, [rows]);
  const isUnread = (a: { id: string; dir: string }) => a.dir === 'in' && !readIds.includes(a.id);
  const unread = alerts.filter(isUnread).length;
  const readAll = () => {
    const ids = Array.from(new Set([...readIds, ...alerts.map((a) => a.id)]));
    setReadIds(ids);
    try {
      localStorage.setItem(readKey(currentUser.id), JSON.stringify(ids));
    } catch {
      /* per-device convenience only */
    }
  };

  /* ---------------- claim / PV form ---------------- */

  const D = f.mode === 'PV';
  const T = f.kind === 'Travelling';
  const PM = f.pmethod;
  const km = num(f.km), pk = num(f.parking), tl = num(f.toll);
  const billable = f.caseRef !== null && !!f.file;
  const toYou = Math.round((T ? km + pk + tl : num(f.amt)) * 100) / 100;
  const bill = Math.round((billable && !(D && f.from === 'Client') ? (T ? km * 1.5 + pk + tl : /^Office/.test(f.kind) ? 0 : num(f.amt)) : 0) * 100) / 100;

  const FILES = useMemo(() => {
    const clientName = (id: string, n?: string) => n || clients.find((c) => c.id === id)?.name || '';
    return [
      { no: 'Office', client: OFFICE_LABEL, matter: 'Firm overhead · not billed to any client', pic: dir.managingPartner, ref: null as string | null },
      ...cases
        .filter((c) => c.status === 'Active' || c.status === 'Pending')
        .map((c) => ({ no: c.ref, client: clientName(c.clientId, c.clientName), matter: [c.title || c.type, c.court].filter(Boolean).join(' · '), pic: dir.picOf(c.ref), ref: c.ref as string | null })),
    ];
  }, [cases, clients, dir]);
  const lab = (x: (typeof FILES)[number]) => (x.no === 'Office' ? x.client : x.no + ' · ' + x.client);
  const words = f.fq.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = FILES.filter((x) => {
    const s = [x.no, x.client, x.matter, x.pic].join(' ').toLowerCase();
    return words.every((w) => s.includes(w));
  }).slice(0, 60);

  const yy = String(new Date().getFullYear()).slice(2);
  const nextNo = (ids: (string | undefined)[], re: RegExp) =>
    ids.reduce((m, id) => {
      const x = String(id || '').match(re);
      return x ? Math.max(m, Number(x[1])) : m;
    }, 0) + 1;
  const cfNo = 'CF-' + yy + '-' + pad4(nextNo([...travelClaims.map((t) => t.formNo), ...expenses.map((e) => e.formNo)], new RegExp('^CF-' + yy + '-(\\d+)$')));
  const pvLetter = f.from === 'Client' ? 'C' : f.from === 'Disb' ? 'D' : 'O';
  const pvNo = 'PV-' + pvLetter + '-' + yy + '-' + pad4(nextNo(paymentVouchers.map((v) => v.formNo), new RegExp('^PV-[CDO]-' + yy + '-(\\d+)$')));
  const formNo = D ? pvNo : cfNo;

  const tot = f.items.reduce((s, i) => s + i.amt, 0);
  const totB = f.items.reduce((s, i) => s + i.bill, 0);
  const approvers = rule ? rule.people.map((u) => u.name) : Array.from(new Set(f.items.map((i) => dir.picOf(i.caseRef))));
  const payee = PM === 'Online portal' ? f.portal : f.vendor;

  const sp = currentUser.staffProfile;
  const acct = String(sp?.bankAccountNo || '').replace(/\s+/g, '');
  const payBack = sp?.bankName || acct ? [sp?.bankName, acct ? '····' + acct.slice(-4) : ''].filter(Boolean).join(' ') : '—';
  const claimant: [string, string][] = [
    ['Name', currentUser.name],
    ['Staff no.', sp?.staffId || '—'],
    ['Position', [sp?.designation || String(currentUser.role || ''), sp?.department].filter(Boolean).join(' · ')],
    [D ? 'Paid from' : 'Pay back to', D ? (f.from === 'Client' ? 'Client account (HLB)' : f.from === 'Disb' ? 'Disbursement account' : 'Office account (HLB)') : payBack],
  ];

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    if (!isUploadReady()) { showToast(DRIVE_REQUIRED_MSG); return; }
    const added: FormDoc[] = [];
    for (const file of Array.from(list)) {
      const problem = validateClaimFile(file);
      if (problem) {
        showToast(problem);
        continue;
      }
      added.push({ id: 'DOC-' + Date.now() + '-' + Math.floor(Math.random() * 10000), name: file.name, size: file.size, type: file.type, category: claimsStorageService.detectDocumentCategory(file.name, file.type), file });
    }
    if (added.length) setForm((s) => ({ ...s, files: [...s.files, ...added] }));
  };

  const addItem = () => {
    if (!f.file) return showToast('Choose the file (search by client or file no.)');
    if (!f.what) return showToast('Fill in the description');
    if (!toYou) return showToast(T ? 'Enter the km, parking or toll' : 'Enter the amount');
    if (!f.files.length && !(T && !pk && !tl)) return showToast('Attach the receipt for this item');
    setF({
      items: [...f.items, { dateIso: f.dateIso, kind: f.kind, what: f.what, caseRef: f.caseRef, file: f.file, km, parking: pk, toll: tl, amt: toYou, bill, docs: f.files }],
      what: '', km: '', parking: '', toll: '', amt: '', files: [],
    });
    showToast('Item ' + (f.items.length + 1) + ' added');
  };

  /** Receipts: the file itself goes to Google Drive / Firebase Storage (see `attachments`); the synced record
   * keeps name-only `documents` too so older screens that count / list them still work. */
  const docMeta = (docs: FormDoc[]): ClaimDocument[] =>
    docs.map((d) => ({ id: d.id, name: d.name, url: '', type: d.type, category: d.category, size: d.size, uploadedAt: new Date().toISOString() }));
  const seq = (first: string, i: number) => {
    const m = first.match(/^(.*?)(\d+)$/);
    return m ? m[1] + String(Number(m[2]) + i).padStart(m[2].length, '0') : first + '-' + (i + 1);
  };

  const submit = async () => {
    if (busy) return;
    if (!f.items.length) return showToast('Add at least one item');
    if (D && PM === 'Bank transfer' && (!f.vendor || !f.vbank)) return showToast('Fill in who to pay and their bank');
    if (D && PM === 'Cheque' && !f.vendor) return showToast('Fill in who the cheque is payable to');
    const no = formNo;
    const items = f.items;
    const n = items.length;
    const now = new Date().toISOString();
    const caseOf = (ref: string | null) => (ref ? dir.caseOf(ref) : undefined);

    // Work out every record id first so each receipt can be uploaded under its record.
    const travel = D ? [] : items.filter((i) => i.kind === 'Travelling');
    const other = D ? [] : items.filter((i) => i.kind !== 'Travelling');
    const tc0 = travel.length ? getNextSequenceId('claim') : '';
    const ex0 = other.length ? getNextSequenceId('expense') : '';
    const pv0 = D ? getNextSequenceId('voucher') : '';
    const idOf = new Map<Item, string>();
    travel.forEach((i, x) => idOf.set(i, seq(tc0, x)));
    other.forEach((i, x) => idOf.set(i, seq(ex0, x)));
    if (D) items.forEach((i, x) => idOf.set(i, seq(pv0, x)));

    // Upload receipts to the firm Google Drive. If any upload fails, nothing is submitted.
    setBusy(true);
    setUpErr('');
    const stored = new Map<Item, ClaimAttachment[]>();
    try {
      if (items.some((i) => i.docs.length)) await prepareStorage();
      await Promise.all(
        items.map(async (i) => {
          const id = idOf.get(i) as string;
          stored.set(i, await Promise.all(i.docs.map((d) => storeClaimReceipt({ userId: currentUser.id, recordId: id, formNo: no, file: d.file, uploadedBy: currentUser.name, kind: D ? 'pv' : 'claim' }))));
        })
      );
    } catch (err) {
      const msg = 'Not submitted: a receipt could not be uploaded. ' + (err instanceof Error ? err.message : String(err));
      setUpErr(msg);
      setBusy(false);
      showToast(msg);
      return;
    }
    const attsOf = (i: Item) => {
      const a = stored.get(i) || [];
      return a.length ? a : undefined;
    };

    if (!D) {
      travel.forEach((i) => {
        const id = idOf.get(i) as string;
        const [from, rest] = i.what.includes('→') ? i.what.split('→') : ['', ''];
        const tc: TravelClaim = {
          id, date: i.dateIso, claimant: currentUser.name, purposeType: i.caseRef ? 'Client Matter' : 'Firm/Internal', fileRef: i.caseRef || 'FIRM_OVERHEAD',
          type: 'Mileage', purpose: i.what, from: from.trim(), to: (rest || '').split('·')[0].trim(), km: i.km, rate: 1.0, mileageAmount: i.km,
          tollAmount: i.toll, parkingAmount: i.parking, otherAmount: 0, total: i.amt, billableClientTotal: i.bill, paidFrom: 'Personal Monies',
          billed: i.caseRef ? 'N' : 'N/A', invoiceNo: '', postedRef: '', attachmentName: i.docs[0]?.name, documents: docMeta(i.docs),
          attachments: attsOf(i), approvalStatus: 'Pending Approval', formNo: no,
        };
        addTravelClaim(tc);
      });
      other.forEach((i) => {
        const id = idOf.get(i) as string;
        const c = caseOf(i.caseRef);
        const ex: Expense = {
          id, caseId: c?.id || 'FIRM_OPERATIONS', fileRef: c?.ref || 'FIRM_OVERHEAD', accountSet: c && i.kind !== 'Office' ? 'CLIENT' : 'OFFICE', date: i.dateIso,
          category: i.kind === 'Office' ? '[Firm] Office purchase' : 'Disbursement', amount: i.amt, billable: !!c && i.kind !== 'Office', billed: false,
          description: i.what, claimant: currentUser.name, isClaimantAdvance: true, payee: currentUser.name, attachmentName: i.docs[0]?.name,
          documents: docMeta(i.docs), attachments: attsOf(i), approvalStatus: 'Pending Approval', formNo: no,
        };
        addExpense(ex);
      });
    } else {
      const needExp = items.some((i) => i.caseRef && f.from !== 'Client' && i.kind !== 'Office bill');
      const bx0 = needExp ? getNextSequenceId('expense') : '';
      let exN = 0;
      items.forEach((i) => {
        const id = idOf.get(i) as string;
        const c = caseOf(i.caseRef);
        const billed = !!c && f.from !== 'Client' && i.kind !== 'Office bill';
        const pv: PaymentVoucher = {
          id, date: i.dateIso, accountSet: f.from === 'Client' ? 'CLIENT' : 'OFFICE',
          voucherCategory: f.from === 'Client' ? 'Client Account' : f.from === 'Disb' ? 'Disbursement' : i.kind === 'Office bill' ? 'Office Operating' : 'Office Account',
          payee: payee + (PM === 'Online portal' ? ' (online)' : ''), paymentMethod: PM, description: i.what, amount: i.amt,
          debit: i.kind === 'Office bill' ? '5010 - Office Overhead' : '5001 - Client Disbursement Expense',
          credit: f.from === 'Client' ? '2010 - Client Trust Account' : '1001 - Malayan Banking Berhad (Office)',
          clientId: c?.clientId || '', fileRef: c?.ref || 'FIRM_OPERATIONS', preparedBy: currentUser.name, approved: false, approvalStatus: 'Pending Approval',
          attachmentName: i.docs[0]?.name, documents: docMeta(i.docs), attachments: attsOf(i), formNo: no, requestKind: i.kind as PaymentVoucher['requestKind'],
          vendorBank: PM === 'Bank transfer' ? f.vbank : undefined, portalRef: PM === 'Online portal' ? f.pref || undefined : undefined,
        };
        addPaymentVoucher(pv);
        // Same pattern as Claims -> Disbursements when the claimant did not advance the money:
        // a billable expense on the file so the cost lands on the client's next invoice.
        if (billed && c) {
          addExpense({
            id: seq(bx0, exN++), caseId: c.id, fileRef: c.ref, accountSet: 'CLIENT', date: i.dateIso, category: i.kind === 'Despatch' ? 'Despatch' : 'Disbursement',
            amount: i.amt, billable: true, billed: false, description: i.what, claimant: currentUser.name, isClaimantAdvance: false, payee,
            attachmentName: i.docs[0]?.name, attachments: attsOf(i), approvalStatus: 'Pending Approval', formNo: no,
          });
        }
      });
    }

    const apps = approvers;
    addNotification({
      title: '[APPROVAL REQUIRED] ' + (D ? 'Payment request ' : 'Claim form ') + no,
      message: currentUser.name + ' submitted ' + no + ' (' + n + ' item' + (n > 1 ? 's' : '') + ', ' + rm(tot) + ')' + (D ? ' to pay ' + payee : '') + '. Waiting for approval by ' + apps.join(', ') + '. Accounts copied.',
      type: 'invoice',
      linkTab: 'approvals',
      linkId: no,
      to: [...apps, 'role:Accountant'],
    });
    addActivityLog(D ? 'Payment Request Submitted' : 'Claim Form Submitted', no + ' — ' + rm(tot) + ' (' + now.slice(0, 10) + ')');
    setForm((s) => ({ ...s, open: false, items: [], vendor: '', vbank: '', file: '', caseRef: null, fq: '', fOpen: false, pref: '' }));
    setBusy(false);
    showToast(no + ' sent · ' + apps.join(', ') + ' and Accounts have been alerted');
  };

  const openClaim = () => { setUpErr(''); setForm((s) => ({ ...s, open: true, mode: 'Claim', kind: 'Travelling', items: [], dateIso: todayIso() })); };
  const openPv = () => { setUpErr(''); setForm((s) => ({ ...s, open: true, mode: 'PV', kind: 'Despatch', items: [], dateIso: todayIso() })); };

  const kinds: ClaimKind[] = D ? ['Despatch', 'Disbursement', 'Office bill'] : ['Travelling', 'Disbursement', 'Office'];
  const fromNote = f.from === 'Disb'
    ? 'Disbursement account: for court filing, searches, stamp duty and other file costs. Billed to the client as a disbursement (PV-D).'
    : f.from === 'Client'
      ? 'Client account: only if this client has deposited money for the file. Paid from their ledger under the Solicitors’ Account Rules 1990 (PV-C). Not billed again.'
      : 'Office account: the firm pays now and bills the client later as a disbursement (PV-O).';
  const whatPh = T ? 'Office → Shah Alam High Court · hearing' : f.kind === 'Despatch' ? 'e.g. file documents at Land Office Kajang' : f.kind === 'Disbursement' ? 'e.g. e-Filing fee, Statement of Defence' : 'e.g. printer toner';
  const recHint = T ? 'Parking ticket, toll / Touch ’n Go statement. Mileage needs no receipt.' : D ? 'Their invoice or quotation' : 'Receipt or e-receipt (photo is fine)';

  const optBtn = (on: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid ' + (on ? '#16223A' : '#C9D3E0'), borderRadius: 4, padding: '6px 11px', background: on ? '#F6F8FA' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#16223A' });

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
            <strong style={cardTitle}>My claims &amp; payment requests</strong>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" onClick={openClaim} style={{ border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+ New claim form</button>
              <button type="button" onClick={openPv} style={{ border: '1px solid #16223A', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>+ Payment request (PV)</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 14px', borderBottom: '1px solid #EEF1F5', fontSize: 11, color: '#5B6478' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>Year<select aria-label="Year" value={yearF} onChange={(e) => setYearF(e.target.value)} style={SEL}><option value="All">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>Type<select aria-label="Type" value={typeF} onChange={(e) => setTypeF(e.target.value)} style={SEL}><option value="All">All types</option>{FINANCE_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <span style={{ marginLeft: 'auto' }}>{list.length} of {rows.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '7px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478', background: '#F6F8FA', borderBottom: '1px solid #EEF1F5' }}>
            <span>Date</span><span>Claim · file</span><span style={{ textAlign: 'right' }}>To you</span><span style={{ textAlign: 'right' }}>Bill client</span><span>Form no.</span><span>Receipt</span><span>Status</span>
          </div>
          {!list.length && <div style={{ padding: '12px 14px', fontSize: 11.5, color: '#5B6478', borderBottom: '1px solid #F0F2F5' }}>{rows.length ? 'Nothing for this year / type.' : 'No claims or payment requests yet.'}</div>}
          {list.map((c) => {
            const kc = KIND_COLORS[c.kind] || KIND_COLORS.Office;
            const sc = STATUS_COLORS[c.status];
            return (
              <div key={c.key} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
                <span style={{ fontSize: 11, color: '#5B6478' }}>{ddmm(c.iso)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span title="Type" style={{ fontSize: 9.5, fontWeight: 700, padding: '0 6px', borderRadius: 8, background: DOC_TYPE_COLORS[c.docType][0], color: DOC_TYPE_COLORS[c.docType][1], whiteSpace: 'nowrap' }}>{c.docType}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '0 6px', borderRadius: 8, background: kc[0], color: kc[1] }}>{c.kind}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#16223A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.what}</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>{c.file}</span>
                </span>
                <span style={{ textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>{rm(c.amt)}</span>
                <span style={{ textAlign: 'right', fontSize: 11.5, color: '#2F5680' }}>{c.bill ? rm(c.bill) : '—'}</span>
                <span style={{ fontSize: 10.5, color: '#16223A' }}>{c.form}</span>
                <span style={{ position: 'relative' }}>
                  {c.rec ? (
                    <button
                      type="button"
                      onClick={() => (c.attachments.length === 1 && !c.localDocNames.length ? void openStored(c.attachments[0]) : setRecOpen(recOpen === c.key ? null : c.key))}
                      title={c.attachments.length ? 'Open receipt' : 'Stored on the device it was uploaded from'}
                      style={{ border: 0, background: 'none', padding: 0, fontSize: 10.5, fontWeight: 700, color: c.attachments.length ? '#3D6B9C' : '#2F6F4E', cursor: 'pointer', fontFamily: 'inherit', textDecoration: c.attachments.length ? 'underline' : 'none' }}
                    >{c.rec + ' file' + (c.rec > 1 ? 's' : '')}</button>
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B23A2E' }}>Missing</span>
                  )}
                  {c.driveFolderId && <a href={folderUrl(c.driveFolderId)} target="_blank" rel="noopener noreferrer" title="Open the Google Drive folder" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#3D6B9C' }}>Drive folder ↗</a>}
                  {recOpen === c.key && (
                    <span style={{ position: 'absolute', top: '100%', left: 0, zIndex: 5, marginTop: 4, width: 240, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #DDE3EB', borderRadius: 8, boxShadow: '0 8px 20px rgba(22,34,58,.18)', overflow: 'hidden' }}>
                      {c.attachments.map((a) => (
                        <button key={storedFileKey(a)} type="button" onClick={() => { setRecOpen(null); void openStored(a); }} style={{ border: 0, borderBottom: '1px solid #F0F2F5', background: '#fff', padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#3D6B9C', cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</button>
                      ))}
                      {c.localDocNames.map((n, i) => (
                        <span key={i} style={{ padding: '7px 10px', borderBottom: '1px solid #F0F2F5', fontSize: 11, color: '#16223A' }}>
                          {n}
                          <span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>stored on the device it was uploaded from</span>
                        </span>
                      ))}
                      <button type="button" onClick={() => setRecOpen(null)} style={{ border: 0, background: '#F6F8FA', padding: '5px 10px', fontSize: 10.5, fontWeight: 700, color: '#5B6478', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>Close</button>
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: sc[0], color: sc[1] }}>{c.status}</span>
                  <span style={{ fontSize: 9.5, color: '#5B6478' }}>{c.withTxt}</span>
                </span>
              </div>
            );
          })}
          <div style={{ padding: '9px 14px', background: '#F6F8FA', fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>Mileage: staff paid RM 1.00/km · client billed RM 1.50/km. Parking and tolls are billed at cost. Office claims are not billed to clients.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #EEF1F5' }}>
              <strong style={cardTitle}>My updates</strong>
              {unread > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 10, background: '#E11D48', color: '#fff' }}>{unread} new</span>}
              <button type="button" onClick={readAll} style={{ marginLeft: 'auto', border: 0, background: 'none', fontSize: 10.5, fontWeight: 700, color: '#3D6B9C', cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>
            </div>
            {!alerts.length && <div style={{ padding: '9px 14px', fontSize: 11.5, color: '#5B6478', borderBottom: '1px solid #F0F2F5' }}>No updates yet.</div>}
            {alerts.map((a) => {
              const u = isUnread(a);
              return (
                <div key={a.id} style={{ display: 'flex', gap: 9, padding: '9px 14px', borderBottom: '1px solid #F0F2F5', background: u ? '#FFF7F8' : '#fff' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, marginTop: 4, borderRadius: 9999, background: u ? '#E11D48' : a.dir === 'out' ? '#94A3B8' : '#2F6F4E' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.4, color: '#16223A', fontWeight: u ? 700 : 500 }}>{a.text}</span>
                    <span style={{ display: 'block', fontSize: 10, color: '#5B6478' }}>{a.meta}</span>
                  </span>
                </div>
              );
            })}
            <div style={{ padding: '9px 14px', background: '#F6F8FA', fontSize: 10.5, lineHeight: 1.5, color: '#5B6478' }}>Only updates on your own claims show here. Each one is also emailed to {currentUser.email}.</div>
          </div>
        </div>
      </div>

      {f.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(22,34,58,.6)', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '24px 0 40px' }}>
          <div style={{ width: 900, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16223A', borderRadius: 10, padding: '8px 12px' }}>
              <strong style={{ color: '#fff', fontSize: 13 }}>{D ? 'Payment request (PV)' : 'Staff claim form'}</strong>
              <span style={{ fontSize: 10.5, color: '#C9D3E0' }}>fill in, add each item, then submit</span>
              <button type="button" onClick={() => setF({ open: false, fOpen: false })} style={{ marginLeft: 'auto', border: '1px solid rgba(255,255,255,.35)', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
            <div style={{ background: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,.3)', padding: '36px 44px 32px', display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'Arial,Helvetica,sans-serif', color: '#16223A' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 12, borderBottom: '2px solid #16223A' }}>
                <div style={{ flex: 1, fontFamily: 'Georgia,serif' }}>
                  <img src={import.meta.env.BASE_URL + 'assets/sh-name.png'} alt="Syafiqah Hamizad & Co" style={{ width: 220, height: 'auto', display: 'block' }} />
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: '#3D6B9C', marginTop: 3 }}>Advocates &amp; Solicitors | Syarie Counsel</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'Georgia,serif', fontSize: 11, lineHeight: 1.6 }}>
                  <div style={{ fontSize: 19, fontWeight: 'bold', marginBottom: 3 }}>{D ? 'PAYMENT REQUEST' : 'STAFF CLAIM FORM'}</div>
                  <div><span style={{ color: '#5B6478' }}>No.</span> {formNo}</div>
                  <div><span style={{ color: '#5B6478' }}>Date</span> {ddmmyyyy(todayIso())}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={SECTION}>A. CLAIMANT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14 }}>
                  {claimant.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={LBL}>{k}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, padding: '4px 0', borderBottom: '1px dotted #94A3B8' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={SECTION}>B. TYPE OF REQUEST</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([['Claim', 'CLAIM', 'I already paid · the firm pays me back'], ['PV', 'Payment request (PV)', 'The firm pays the vendor directly']] as [Mode, string, string][]).map(([k, label, sub]) => (
                    <button key={k} type="button" onClick={() => { if (f.mode !== k) setF({ mode: k, kind: k === 'PV' ? 'Despatch' : 'Travelling', items: [] }); }} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', border: '1px solid ' + (f.mode === k ? '#16223A' : '#C9D3E0'), borderRadius: 4, padding: '10px 12px', background: f.mode === k ? '#F6F8FA' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Radio on={f.mode === k} />
                      <span>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#16223A' }}>{label}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#5B6478' }}>{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {D && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={LBL}>How it is paid *</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(['Bank transfer', 'Online portal', 'Cheque'] as Method[]).map((label) => (
                            <button key={label} type="button" onClick={() => setF({ pmethod: label })} style={optBtn(PM === label)}><Radio on={PM === label} size={12} />{label}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={LBL}>Paid from *</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {([['Disb', 'Disbursement account'], ['Office', 'Office account'], ['Client', 'Client account']] as [From, string][]).map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setF({ from: k })} style={optBtn(f.from === k)}><Radio on={f.from === k} size={12} />{label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10.5, lineHeight: 1.45, color: '#5B6478' }}>{fromNote}</span>
                    {PM === 'Bank transfer' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <label style={labelWrap}><span style={LBL}>Pay to (vendor) *</span><input value={f.vendor} onChange={(e) => setF({ vendor: e.target.value })} placeholder="e.g. Ali Despatch Services" style={INP} /></label>
                        <label style={labelWrap}><span style={LBL}>Their bank · account no. *</span><input value={f.vbank} onChange={(e) => setF({ vbank: e.target.value })} placeholder="e.g. Maybank 5140 1234 5678" style={INP} /></label>
                      </div>
                    )}
                    {PM === 'Online portal' && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <label style={labelWrap}><span style={LBL}>Portal / website *</span><select value={f.portal} onChange={(e) => setF({ portal: e.target.value })} style={{ ...INP, cursor: 'pointer' }}>{PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                          <label style={labelWrap}><span style={LBL}>Case / bill / assessment no.</span><input value={f.pref} onChange={(e) => setF({ pref: e.target.value })} placeholder="e.g. BA-22NCvC-118-09/2026" style={INP} /></label>
                        </div>
                        <span style={{ fontSize: 10.5, lineHeight: 1.45, color: '#5B6478' }}>No bank account needed. Accounts pays directly on the portal (FPX / firm card) and attaches the portal receipt to this PV.</span>
                      </>
                    )}
                    {PM === 'Cheque' && (
                      <label style={{ ...labelWrap, maxWidth: 420 }}><span style={LBL}>Cheque payable to *</span><input value={f.vendor} onChange={(e) => setF({ vendor: e.target.value })} placeholder="e.g. Pentadbir Tanah Hulu Langat" style={INP} /></label>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={SECTION}>C. ITEMS</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#EFEFEF' }}>
                      <th style={{ ...TD, width: 28, textAlign: 'center' }}>No.</th>
                      <th style={{ ...TD, width: 52, textAlign: 'left' }}>Date</th>
                      <th style={{ ...TD, width: 88, textAlign: 'left' }}>Type</th>
                      <th style={{ ...TD, textAlign: 'left' }}>Description · file</th>
                      <th style={{ ...TD, width: 62, textAlign: 'center' }}>Receipts</th>
                      <th style={{ ...TD, width: 82, textAlign: 'right' }}>{D ? 'Amount RM' : 'To you RM'}</th>
                      <th style={{ ...TD, width: 82, textAlign: 'right' }}>Bill client</th>
                      <th style={{ ...TD, width: 24 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {f.items.map((i, x) => (
                      <tr key={x}>
                        <td style={{ ...TD, textAlign: 'center' }}>{x + 1}</td>
                        <td style={TD}>{ddmm(i.dateIso)}</td>
                        <td style={TD}>{i.kind}</td>
                        <td style={TD}><strong>{i.what}</strong><span style={{ display: 'block', fontSize: 10.5, color: '#5B6478' }}>{i.file}</span></td>
                        <td style={{ ...TD, textAlign: 'center', color: i.docs.length ? '#2F6F4E' : '#5B6478', fontWeight: 700 }}>{i.docs.length || '—'}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{i.amt.toFixed(2)}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{i.bill ? i.bill.toFixed(2) : '—'}</td>
                        <td style={{ ...TD, padding: 0, textAlign: 'center' }}><button type="button" onClick={() => setF({ items: f.items.filter((_, y) => y !== x) })} title="Remove" style={{ border: 0, background: 'none', color: '#B23A2E', fontSize: 13, cursor: 'pointer' }}>×</button></td>
                      </tr>
                    ))}
                    {!f.items.length && (
                      <tr><td colSpan={8} style={{ ...TD, padding: 12, textAlign: 'center', color: '#5B6478', fontStyle: 'italic' }}>No items yet. Fill in the box below and press “Add item”.</td></tr>
                    )}
                    <tr style={{ background: '#EFEFEF' }}>
                      <td colSpan={5} style={{ ...TD, padding: 6, textAlign: 'right', fontWeight: 800 }}>TOTAL</td>
                      <td style={{ ...TD, padding: 6, textAlign: 'right', fontWeight: 800 }}>{tot.toFixed(2)}</td>
                      <td style={{ ...TD, padding: 6, textAlign: 'right', fontWeight: 800 }}>{totB ? totB.toFixed(2) : '—'}</td>
                      <td style={{ border: '1px solid #16223A' }} />
                    </tr>
                  </tbody>
                </table>

                <div style={{ border: '1px dashed #94A3B8', borderRadius: 4, background: '#FAFBFC', padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#16223A' }}>ADD ITEM {f.items.length + 1}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 170px minmax(0,1fr)', gap: 12 }}>
                    <label style={labelWrap}><span style={LBL}>Date *</span><input type="date" value={f.dateIso} onChange={(e) => setF({ dateIso: e.target.value })} style={{ ...INP, cursor: 'pointer' }} /></label>
                    <label style={labelWrap}><span style={LBL}>Type *</span>
                      <select value={f.kind} onChange={(e) => { const v = e.target.value as ClaimKind; setF({ kind: v, pmethod: v === 'Disbursement' ? 'Online portal' : 'Bank transfer', from: v === 'Office bill' ? 'Office' : 'Disb' }); }} style={{ ...INP, cursor: 'pointer' }}>
                        {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                      <span style={LBL}>File * <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(search by file no., client or matter)</span></span>
                      <input
                        value={f.fq}
                        onChange={(e) => setF({ fq: e.target.value, file: '', caseRef: null, fOpen: true })}
                        onFocus={() => setF({ fOpen: true })}
                        onBlur={() => { window.clearTimeout(blurT.current); blurT.current = window.setTimeout(() => setF({ fOpen: false }), 150); }}
                        placeholder="e.g. tan, 0412, industrial court…"
                        style={{ ...INP, borderColor: f.file ? '#2F6F4E' : '#C9D3E0' }}
                      />
                      {f.fOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 2, maxHeight: 230, overflow: 'auto', background: '#fff', border: '1px solid #C9D3E0', borderRadius: 6, boxShadow: '0 8px 20px rgba(22,34,58,.18)' }}>
                          {hits.map((h) => (
                            <button
                              key={h.no}
                              type="button"
                              className="hover:bg-[#F6F8FA]!"
                              onMouseDown={(e) => { e.preventDefault(); setF({ file: lab(h), caseRef: h.ref, fq: lab(h), fOpen: false, kind: h.no === 'Office' && f.kind === 'Disbursement' ? (D ? 'Office bill' : 'Office') : f.kind }); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #F0F2F5', background: '#fff', padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              <span style={{ fontSize: 12, color: '#16223A' }}><strong>{h.no}</strong> · {h.client}</span>
                              <span style={{ display: 'block', fontSize: 10.5, color: '#5B6478' }}>{h.matter} · PIC {h.pic}</span>
                            </button>
                          ))}
                          {!hits.length && <div style={{ padding: 10, fontSize: 11.5, color: '#5B6478' }}>No file matches “{f.fq}”. Try the client name or file number.</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, lineHeight: 1.45, color: '#5B6478' }}>{NOTE[f.kind]}</span>
                  <label style={labelWrap}><span style={LBL}>{T ? 'Trip (from → to · purpose)' : 'Description'} *</span><input value={f.what} onChange={(e) => setF({ what: e.target.value })} placeholder={whatPh} style={INP} /></label>
                  {T && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr)) minmax(0,1.6fr)', gap: 12, alignItems: 'end' }}>
                      <label style={labelWrap}><span style={LBL}>Distance (km)</span><input value={f.km} onChange={(e) => setF({ km: e.target.value })} placeholder="return trip" style={{ ...INP, textAlign: 'right' }} /></label>
                      <label style={labelWrap}><span style={LBL}>Parking (RM)</span><input value={f.parking} onChange={(e) => setF({ parking: e.target.value })} style={{ ...INP, textAlign: 'right' }} /></label>
                      <label style={labelWrap}><span style={LBL}>Toll (RM)</span><input value={f.toll} onChange={(e) => setF({ toll: e.target.value })} style={{ ...INP, textAlign: 'right' }} /></label>
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: '#16223A', background: '#F0F2F5', borderRadius: 4, padding: '5px 9px' }}>
                        {km + ' km × RM 1.00 + parking + toll = ' + rm(toYou) + ' to you'}<br />
                        <strong>{billable ? 'Billed to client: ' + rm(bill) : 'Not billed (office)'}</strong>
                      </div>
                    </div>
                  )}
                  {!T && (
                    <label style={{ ...labelWrap, width: 200 }}><span style={LBL}>Amount (RM) *</span><input value={f.amt} onChange={(e) => setF({ amt: e.target.value })} style={{ ...INP, textAlign: 'right' }} /></label>
                  )}
                  <div
                    onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                    style={{ border: '1.5px dashed ' + (drag ? '#16223A' : '#C9D3E0'), borderRadius: 6, background: drag ? '#EEF3F9' : '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16223A' }}>Receipts: drop here</span>
                      <span style={{ fontSize: 10.5, color: '#5B6478' }}>{recHint} · photo or PDF, up to 10 MB each</span>
                      <span style={{ fontSize: 10, color: '#5B6478' }}>{storageLabel}</span>
                    </span>
                    <label style={{ border: '1px solid #C9D3E0', borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      or choose files<input type="file" multiple accept="image/*,.pdf" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {f.files.map((q, i) => (
                        <span key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #BFD3C6', borderRadius: 14, padding: '2px 4px 2px 9px', fontSize: 10.5, fontWeight: 700, background: '#fff', color: '#2F6F4E' }}>
                          ✓ {q.name}
                          <button type="button" onClick={() => setF({ files: f.files.filter((_, j) => j !== i) })} style={{ border: 0, background: 'none', padding: '0 4px', fontSize: 11, color: '#B23A2E', cursor: 'pointer' }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={addItem} style={{ marginLeft: 'auto', flex: 'none', border: '1px solid #16223A', borderRadius: 4, padding: '7px 14px', fontSize: 11.5, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add item to form</button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid #DDE3EB' }}>
                {upErr && <span style={{ flex: 1, fontSize: 11, lineHeight: 1.45, fontWeight: 600, color: '#B23A2E' }}>{upErr}</span>}
                <button type="button" disabled={busy} onClick={() => { setUpErr(''); setF({ open: false, fOpen: false }); }} style={{ marginLeft: 'auto', border: '1px solid #C9D3E0', borderRadius: 4, padding: '9px 16px', fontSize: 12, fontWeight: 700, background: '#fff', color: '#16223A', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button type="button" disabled={busy} onClick={() => void submit()} style={{ border: 0, borderRadius: 4, padding: '9px 18px', fontSize: 12, fontWeight: 700, background: '#16223A', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1 }}>{busy ? 'Uploading receipts…' : D ? 'Submit payment request' : 'Submit claim form'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
