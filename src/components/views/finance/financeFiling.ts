/**
 * Filing money entries in the finance books (Google Drive, SHCO Finance) — pure rules, no Drive calls.
 *
 *   1 Books/<account>/Pending/<entry>          claim / PV submitted or approved, not paid yet
 *   1 Books/<account>/Rejected/<entry>
 *   1 Books/<account>/<YYYY>/<YYYY-MM Month>/Money Out/<entry>   paid (month it was paid)
 *   1 Books/<account>/<YYYY>/<YYYY-MM Month>/Money In/<entry>    receipts
 *   3 Payroll/<YYYY>/<YYYY-MM Month>/Statutory | Partner Drawings/<entry>
 *
 * Same accounts as the cash book (Office, Disbursement, Petty cash). Client-account entries are not
 * filed here yet (postponed). A file's entry also gets a link in 2 Client Files/<file>.
 */
import type { ClaimAttachment, DriveFiling, Expense, FinanceProof, PaymentVoucher, Receipt, TravelClaim } from '../../../types';
import { PV_DRAWINGS, PV_STATUTORY } from '../../../lib/financeCalc';
import { booksMonthPath, booksStatusPath, entryName, payrollMonthPath, type FinAccount, type MatterLike } from '../../../lib/driveLayout';

export type FilingKind = 'travel' | 'expense' | 'pv' | 'receipt';
/** Where a paper sits on its record, so a moved / copied Drive file can be written back. */
export type PaperSlot = { field: 'attachments' | 'proofs'; index: number } | { field: 'paidProof' };
export interface FilingPaper { id: string; name: string; slot: PaperSlot }
export interface FilingJob { kind: FilingKind; recId: string; key: string; folderId?: string; path: string[]; name: string; papers: FilingPaper[]; matter?: MatterLike }

const isoDay = (s?: string) => String(s || '').slice(0, 10);
const extOf = (n: string) => { const m = String(n || '').match(/\.[A-Za-z0-9]{1,6}$/); return m ? m[0] : ''; };
const stem = (n: string) => String(n || '').replace(/\.[A-Za-z0-9]{1,6}$/, '');
const noFile = (ref?: string) => !ref || ref === 'FIRM_OPERATIONS';

/** The papers of an entry: its documents numbered 1, 2, 3… (with a label), then "Payment proof". */
const papersOf = (groups: { list?: (ClaimAttachment | FinanceProof)[]; field: 'attachments' | 'proofs'; label: string }[], paid?: FinanceProof): FilingPaper[] => {
  const out: FilingPaper[] = [];
  groups.forEach((g) => (g.list || []).forEach((a, i) => { if (a.driveFileId) out.push({ id: a.driveFileId, name: `${out.length + 1} ${g.label ? g.label + ' - ' : ''}${stem(a.name)}${extOf(a.name)}`, slot: { field: g.field, index: i } }); }));
  if (paid?.driveFileId) out.push({ id: paid.driveFileId, name: 'Payment proof' + extOf(paid.name), slot: { field: 'paidProof' } });
  return out;
};

export interface FilingCtx {
  /** Entries dated before this (YYYY-MM) are left where they are. */
  from: string;
  matterOf: (caseId?: string, ref?: string) => MatterLike | undefined;
}

/** Status stop: Pending / Rejected, or paid on a day. */
type Stop = { s: 'Pending' } | { s: 'Rejected' } | { s: 'Paid'; on: string };
const claimStop = (status?: string, paidAt?: string): Stop => (status === 'Rejected' ? { s: 'Rejected' } : paidAt ? { s: 'Paid', on: isoDay(paidAt) } : { s: 'Pending' });

const target = (acc: FinAccount, stop: Stop, recDate: string, flow: 'Money In' | 'Money Out', payroll?: 'Statutory' | 'Partner Drawings') => {
  if (stop.s !== 'Paid') return { path: booksStatusPath(acc, stop.s), day: recDate };
  return { path: payroll ? payrollMonthPath(stop.on, payroll) : booksMonthPath(acc, stop.on, flow), day: stop.on };
};

const keyOf = (path: string[], name: string, papers: FilingPaper[]) => path.join('/') + '|' + name + '|' + papers.map((p) => p.name).join(',');

/** Where one record belongs now (null = not filed: client account, before the start month, or nothing on Drive yet). */
export const filingFor = (kind: FilingKind, rec: TravelClaim | Expense | PaymentVoucher | Receipt, ctx: FilingCtx): FilingJob | null => {
  const recDate = isoDay(rec.date);
  if (!recDate || recDate.slice(0, 7) < ctx.from) return null;
  let acc: FinAccount = 'Office';
  let stop: Stop;
  let flow: 'Money In' | 'Money Out' = 'Money Out';
  let payroll: 'Statutory' | 'Partner Drawings' | undefined;
  let docNo = rec.id, what = '', amount = 0, ref: string | undefined, caseId: string | undefined, papers: FilingPaper[] = [];
  if (kind === 'travel') {
    const t = rec as TravelClaim;
    stop = claimStop(t.approvalStatus, t.paidAt);
    what = t.purpose || t.type; amount = Number(t.total || 0); ref = noFile(t.fileRef) ? undefined : t.fileRef;
    papers = papersOf([{ list: t.attachments, field: 'attachments', label: 'Receipt' }], t.paidProof);
  } else if (kind === 'expense') {
    const e = rec as Expense;
    if (e.accountSet === 'CLIENT') return null;
    acc = e.billable && !e.claimant ? 'Disbursement' : /petty/i.test(e.paidFrom || '') ? 'Petty cash' : /disb/i.test(e.paidFrom || '') ? 'Disbursement' : 'Office';
    stop = e.claimant ? claimStop(e.approvalStatus, e.paidAt) : e.approvalStatus === 'Rejected' ? { s: 'Rejected' } : e.approvalStatus === 'Pending Approval' ? { s: 'Pending' } : { s: 'Paid', on: isoDay(e.paidAt) || recDate };
    what = e.description || e.category; amount = Number(e.amount || 0); ref = noFile(e.fileRef) ? undefined : e.fileRef; caseId = e.caseId;
    papers = papersOf([{ list: e.attachments, field: 'attachments', label: e.claimant ? 'Receipt' : 'Bill' }], e.paidProof);
  } else if (kind === 'pv') {
    const v = rec as PaymentVoucher;
    if (v.accountSet === 'CLIENT') return null;
    acc = v.voucherCategory === 'Disbursement' || (v.voucherCategory as string) === 'Client Disb' ? 'Disbursement' : /petty/i.test(v.bankAccountName || '') ? 'Petty cash' : 'Office';
    stop = v.approvalStatus === 'Rejected' ? { s: 'Rejected' } : v.paidAt || v.historical || v.approvalStatus === 'Posted to GL' ? { s: 'Paid', on: isoDay(v.paidAt) || recDate } : { s: 'Pending' };
    payroll = (v.voucherCategory as string) === PV_STATUTORY ? 'Statutory' : (v.voucherCategory as string) === PV_DRAWINGS ? 'Partner Drawings' : undefined;
    what = v.description || v.voucherCategory; amount = Number(v.amount || 0); ref = noFile(v.fileRef) ? undefined : v.fileRef; caseId = v.caseId;
    papers = papersOf([{ list: v.attachments, field: 'attachments', label: 'Bill' }, { list: v.proofs, field: 'proofs', label: '' }], v.paidProof);
  } else {
    const r = rec as Receipt;
    if (r.accountSet === 'CLIENT') return null;
    stop = { s: 'Paid', on: recDate }; flow = 'Money In';
    what = r.description || r.forNo || 'Received'; amount = Number(r.amount || 0); ref = noFile(r.fileRef) ? undefined : r.fileRef; caseId = r.caseId;
    papers = papersOf([{ list: r.proofs, field: 'proofs', label: 'Bank-in slip' }]);
  }
  if (!papers.length) return null;
  const t = target(acc, stop, recDate, flow, payroll);
  const matter = ref || caseId ? ctx.matterOf(caseId, ref) : undefined;
  const name = entryName({ date: t.day, docNo, ref: matter?.ref || ref, what, amount });
  const key = keyOf(t.path, name, papers);
  const filed = (rec as { driveFiling?: DriveFiling }).driveFiling;
  if (filed?.key === key) return null;
  return { kind, recId: rec.id, key, folderId: filed?.folderId, path: t.path, name, papers, matter };
};

/** The first record that is not filed where it belongs (one at a time, oldest first). */
export const nextFilingJob = (lists: { travel: TravelClaim[]; expense: Expense[]; pv: PaymentVoucher[]; receipt: Receipt[] }, ctx: FilingCtx, skip: Set<string>): FilingJob | null => {
  const all: [FilingKind, TravelClaim | Expense | PaymentVoucher | Receipt][] = [
    ...lists.travel.map((r) => ['travel', r] as [FilingKind, TravelClaim]),
    ...lists.expense.map((r) => ['expense', r] as [FilingKind, Expense]),
    ...lists.pv.map((r) => ['pv', r] as [FilingKind, PaymentVoucher]),
    ...lists.receipt.map((r) => ['receipt', r] as [FilingKind, Receipt]),
  ].sort((a, b) => String(a[1].date).localeCompare(String(b[1].date)));
  for (const [k, r] of all) {
    if (skip.has(k + ':' + r.id)) continue;
    const j = filingFor(k, r, ctx);
    if (j) return j;
  }
  return null;
};

/** Writes the moved / copied Drive files back onto the record's papers. */
export const applyFiled = <T extends { attachments?: ClaimAttachment[]; proofs?: FinanceProof[]; paidProof?: FinanceProof }>(rec: T, job: FilingJob, res: { folderId: string; papers: { id: string; webViewLink?: string }[] }): Partial<T> & { driveFiling: DriveFiling } => {
  const patch: Partial<T> & { driveFiling: DriveFiling } = { driveFiling: { key: job.key, folderId: res.folderId } } as Partial<T> & { driveFiling: DriveFiling };
  const set = <X extends { driveFileId?: string; webViewLink?: string; driveFolderId?: string }>(x: X, i: number): X => ({ ...x, driveFileId: res.papers[i]?.id || x.driveFileId, webViewLink: res.papers[i]?.webViewLink || x.webViewLink, driveFolderId: res.folderId });
  job.papers.forEach((p, i) => {
    if (p.slot.field === 'paidProof' && rec.paidProof) (patch as { paidProof?: FinanceProof }).paidProof = set(rec.paidProof, i);
    else if (p.slot.field === 'attachments' && rec.attachments) { const l = ((patch as { attachments?: ClaimAttachment[] }).attachments || [...rec.attachments]); l[p.slot.index] = set(l[p.slot.index], i); (patch as { attachments?: ClaimAttachment[] }).attachments = l; }
    else if (p.slot.field === 'proofs' && rec.proofs) { const l = ((patch as { proofs?: FinanceProof[] }).proofs || [...rec.proofs]); l[p.slot.index] = set(l[p.slot.index], i); (patch as { proofs?: FinanceProof[] }).proofs = l; }
  });
  return patch;
};
