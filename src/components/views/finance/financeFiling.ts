/**
 * Filing money entries in the finance books (Google Drive, SHCO Finance) — pure rules, no Drive calls.
 *
 *   Books/Waiting approval/<account>/<entry>     claim / PV submitted or approved, not paid yet
 *   Books/Rejected/<account>/<entry>
 *   Books/<YYYY>/Money Out/<account>/<YYYY-MM Month>/<entry>   paid (month it was paid)
 *   Books/<YYYY>/Money In/<account>/<YYYY-MM Month>/<entry>    receipts
 *   Books/<YYYY>/Payroll/<YYYY-MM Month>/Statutory | Partner Drawings/<entry>
 *
 * Same accounts as the cash book (Office, Client Account, Disbursement, Petty cash). The billing line a
 * client-account payment makes (an expense) is not filed twice. A file's entry also gets a link in Client Files/<file>.
 */
import type { ClaimAttachment, DriveFiling, Expense, FinanceProof, PaymentVoucher, Receipt, TravelClaim } from '../../../types';
import { PV_DRAWINGS, PV_STATUTORY } from '../../../lib/financeCalc';
import { booksMonthPath, booksStatusPath, entryName, payrollMonthPath, shortDocNo, type FinAccount, type MatterLike, type OutType } from '../../../lib/driveLayout';

export type FilingKind = 'travel' | 'expense' | 'pv' | 'receipt';
/** Where a paper sits on its record, so a moved / copied Drive file can be written back. */
export type PaperSlot = { field: 'attachments' | 'proofs'; index: number } | { field: 'paidProof' };
export interface FilingPaper { id: string; name: string; slot: PaperSlot; kind?: FilingKind; recId?: string }
export interface FilingJob { kind: FilingKind; recId: string; key: string; folderId?: string; path: string[]; name: string; papers: FilingPaper[]; matter?: MatterLike; matters?: MatterLike[]; recs?: { kind: FilingKind; recId: string }[]; unit?: string }

const isoDay = (s?: string) => String(s || '').slice(0, 10);
const extOf = (n: string) => { const m = String(n || '').match(/\.[A-Za-z0-9]{1,6}$/); return m ? m[0] : ''; };
const stem = (n: string) => String(n || '').replace(/\.[A-Za-z0-9]{1,6}$/, '');
const noFile = (ref?: string) => !ref || ref === 'FIRM_OPERATIONS';

/** A paper before it is numbered: which record and slot it belongs to. */
interface RawPaper { id: string; label: string; file: string; proof: boolean; slot: PaperSlot }
const rawPapers = (groups: { list?: (ClaimAttachment | FinanceProof)[]; field: 'attachments' | 'proofs'; label: string }[], paid?: FinanceProof): RawPaper[] => {
  const out: RawPaper[] = [];
  groups.forEach((g) => (g.list || []).forEach((a, i) => { if (a.driveFileId) out.push({ id: a.driveFileId, label: g.label, file: a.name, proof: false, slot: { field: g.field, index: i } }); }));
  if (paid?.driveFileId) out.push({ id: paid.driveFileId, label: 'Payment proof', file: paid.name, proof: true, slot: { field: 'paidProof' } });
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

const target = (acc: FinAccount, stop: Stop, recDate: string, flow: 'Money In' | 'Money Out', payroll?: 'Statutory' | 'Partner Drawings', type?: OutType) => {
  if (stop.s !== 'Paid') return { path: booksStatusPath(acc, stop.s, type), day: recDate };
  return { path: payroll ? payrollMonthPath(stop.on, payroll) : booksMonthPath(acc, stop.on, flow, flow === 'Money Out' ? type : undefined), day: stop.on };
};

type AnyRec = TravelClaim | Expense | PaymentVoucher | Receipt;
interface RecInfo { kind: FilingKind; rec: AnyRec; recDate: string; acc: FinAccount; stop: Stop; flow: 'Money In' | 'Money Out'; payroll?: 'Statutory' | 'Partner Drawings'; docNo: string; what: string; who: string; amount: number; ref?: string; caseId?: string; papers: RawPaper[]; form?: string; type?: OutType }

/** What one record says about where it belongs (null = never filed here: client account). */
const infoOf = (kind: FilingKind, rec: AnyRec): RecInfo | null => {
  const recDate = isoDay(rec.date);
  if (!recDate) return null;
  const base = { kind, rec, recDate, acc: 'Office' as FinAccount, flow: 'Money Out' as const, docNo: rec.id };
  if (kind === 'travel') {
    const t = rec as TravelClaim;
    return { ...base, type: 'Claims', stop: claimStop(t.approvalStatus, t.paidAt), what: t.purpose || t.type, who: t.claimant, amount: Number(t.total || 0), ref: noFile(t.fileRef) ? undefined : t.fileRef, papers: rawPapers([{ list: t.attachments, field: 'attachments', label: 'Receipt' }], t.paidProof), form: t.formNo };
  }
  if (kind === 'expense') {
    const e = rec as Expense;
    // A staff claim for a client file is marked CLIENT (billable) but is paid back from the office: file it.
    if (e.accountSet === 'CLIENT' && !e.isClaimantAdvance) return null;
    const acc: FinAccount = e.billable && !e.claimant && (!e.paidFrom || /disb/i.test(e.paidFrom)) ? 'Disbursement' : /petty/i.test(e.paidFrom || '') ? 'Petty cash' : /disb/i.test(e.paidFrom || '') ? 'Disbursement' : 'Office';
    const stop: Stop = e.claimant ? claimStop(e.approvalStatus, e.paidAt) : e.approvalStatus === 'Rejected' ? { s: 'Rejected' } : e.approvalStatus === 'Pending Approval' ? { s: 'Pending' } : { s: 'Paid', on: isoDay(e.paidAt) || recDate };
    return { ...base, acc, stop, type: e.claimant ? 'Claims' : e.billable ? 'Disbursements' : 'Office Costs', what: e.description || e.category, who: e.claimant || e.payee || '', amount: Number(e.amount || 0), ref: noFile(e.fileRef) ? undefined : e.fileRef, caseId: e.caseId || undefined, papers: rawPapers([{ list: e.attachments, field: 'attachments', label: e.claimant ? 'Receipt' : 'Bill' }], e.paidProof), form: e.claimant ? e.formNo : undefined };
  }
  if (kind === 'pv') {
    const v = rec as PaymentVoucher;
    const acc: FinAccount = v.accountSet === 'CLIENT' ? 'Client account' : v.voucherCategory === 'Disbursement' || (v.voucherCategory as string) === 'Client Disb' ? 'Disbursement' : /petty/i.test(v.bankAccountName || '') ? 'Petty cash' : 'Office';
    const stop: Stop = v.approvalStatus === 'Rejected' ? { s: 'Rejected' } : v.paidAt || v.historical || v.approvalStatus === 'Posted to GL' ? { s: 'Paid', on: isoDay(v.paidAt) || recDate } : { s: 'Pending' };
    const payroll = (v.voucherCategory as string) === PV_STATUTORY ? 'Statutory' as const : (v.voucherCategory as string) === PV_DRAWINGS ? 'Partner Drawings' as const : undefined;
    return { ...base, acc, stop, payroll, type: 'Payment Vouchers', what: v.description || v.voucherCategory, who: v.payee || '', amount: Number(v.amount || 0), ref: noFile(v.fileRef) ? undefined : v.fileRef, caseId: v.caseId, papers: rawPapers([{ list: v.attachments, field: 'attachments', label: 'Bill' }, { list: v.proofs, field: 'proofs', label: '' }], v.paidProof), form: v.formNo };
  }
  const r = rec as Receipt;
  return { ...base, acc: r.accountSet === 'CLIENT' ? 'Client account' as FinAccount : 'Office' as FinAccount, stop: { s: 'Paid', on: recDate }, flow: 'Money In', what: r.description || r.forNo || 'Received', who: r.receivedFrom || '', amount: Number(r.amount || 0), ref: noFile(r.fileRef) ? undefined : r.fileRef, caseId: r.caseId, papers: rawPapers([{ list: r.proofs, field: 'proofs', label: 'Bank-in slip' }]) };
};

const paperName = (p: RawPaper, n: number, docNo?: string) => {
  const tag = docNo ? shortDocNo(docNo) + ' ' : '';
  return p.proof ? `Payment proof${docNo ? ' ' + shortDocNo(docNo) : ''}${extOf(p.file)}` : `${n} ${tag}${p.label ? p.label + ' - ' : ''}${stem(p.file)}${extOf(p.file)}`;
};

/**
 * Where a unit belongs now: one record, or every item of one claim / payment-request form
 * (filed together as one folder named after the form). Null = nothing to do.
 */
const jobFor = (members: RecInfo[], ctx: FilingCtx): FilingJob | null => {
  const withPapers = members.filter((m) => m.papers.length);
  if (!withPapers.length) return null;
  const first = members[0];
  const recDate = members.map((m) => m.recDate).sort()[0];
  if (recDate.slice(0, 7) < ctx.from) return null;
  const group = members.length > 1 || !!first.form;
  const live = members.filter((m) => m.stop.s !== 'Rejected');
  const stop: Stop = !live.length ? { s: 'Rejected' } : live.every((m) => m.stop.s === 'Paid') ? { s: 'Paid', on: live.map((m) => (m.stop as { on: string }).on).sort().pop()! } : { s: 'Pending' };
  const t = target(first.acc, stop, recDate, first.flow, first.payroll, first.type);
  const refs = [...new Set(members.map((m) => m.ref).filter(Boolean))] as string[];
  const matters = [...new Map(members.map((m) => (m.ref || m.caseId ? ctx.matterOf(m.caseId, m.ref) : undefined)).filter((x): x is MatterLike => !!x).map((x) => [x.ref, x])).values()];
  const amount = (live.length ? live : members).reduce((s, m) => s + m.amount, 0);
  const name = group
    ? entryName({ date: t.day, docNo: first.form || first.docNo, ref: refs.length === 1 ? matters[0]?.ref || refs[0] : undefined, what: first.who || first.what, amount })
    : entryName({ date: t.day, docNo: first.docNo, ref: matters[0]?.ref || first.ref, what: first.what, amount });
  const papers: FilingPaper[] = [];
  let n = 0;
  members.forEach((m) => m.papers.forEach((p) => { if (!p.proof) n += 1; papers.push({ id: p.id, name: paperName(p, n, group ? m.docNo : undefined), slot: p.slot, kind: m.kind, recId: m.rec.id }); }));
  const key = t.path.join('/') + '|' + name + '|' + papers.map((p) => p.name).join(',');
  const filed = members.map((m) => (m.rec as { driveFiling?: DriveFiling }).driveFiling);
  if (filed.every((f) => f?.key === key)) return null;
  return { kind: first.kind, recId: first.rec.id, key, folderId: filed.find((f) => f?.folderId)?.folderId, path: t.path, name, papers, matter: matters[0], matters, recs: members.map((m) => ({ kind: m.kind, recId: m.rec.id })) };
};

/** Where one record belongs now (null = not filed: client account, before the start month, or nothing on Drive yet). */
export const filingFor = (kind: FilingKind, rec: AnyRec, ctx: FilingCtx): FilingJob | null => {
  const i = infoOf(kind, rec);
  return i ? jobFor([i], ctx) : null;
};

/** The first unit not filed where it belongs (a claim / payment-request form is one unit), oldest first. */
export const nextFilingJob = (lists: { travel: TravelClaim[]; expense: Expense[]; pv: PaymentVoucher[]; receipt: Receipt[] }, ctx: FilingCtx, skip: Set<string>): FilingJob | null => {
  const infos = [
    ...lists.travel.map((r) => infoOf('travel', r)),
    ...lists.expense.map((r) => infoOf('expense', r)),
    ...lists.pv.map((r) => infoOf('pv', r)),
    ...lists.receipt.map((r) => infoOf('receipt', r)),
  ].filter((x): x is RecInfo => !!x);
  const units = new Map<string, RecInfo[]>();
  infos.forEach((i) => { const k = i.form ? 'form:' + i.form : i.kind + ':' + i.rec.id; units.set(k, [...(units.get(k) || []), i]); });
  const order = [...units.entries()].sort((a, b) => a[1][0].recDate.localeCompare(b[1][0].recDate));
  for (const [k, members] of order) {
    if (skip.has(k)) continue;
    const j = jobFor(members, ctx);
    if (j) return { ...j, unit: k };
  }
  return null;
};

/** Writes the moved / copied Drive files back onto one record of the job. */
export const applyFiled = <T extends { id: string; attachments?: ClaimAttachment[]; proofs?: FinanceProof[]; paidProof?: FinanceProof }>(rec: T, job: FilingJob, res: { folderId: string; papers: { id: string; webViewLink?: string }[] }, kind: FilingKind = job.kind): Partial<T> & { driveFiling: DriveFiling } => {
  const patch: Partial<T> & { driveFiling: DriveFiling } = { driveFiling: { key: job.key, folderId: res.folderId } } as Partial<T> & { driveFiling: DriveFiling };
  const set = <X extends { driveFileId?: string; webViewLink?: string; driveFolderId?: string }>(x: X, i: number): X => ({ ...x, driveFileId: res.papers[i]?.id || x.driveFileId, webViewLink: res.papers[i]?.webViewLink || x.webViewLink, driveFolderId: res.folderId });
  job.papers.forEach((p, i) => {
    if (p.kind && (p.kind !== kind || p.recId !== rec.id)) return;
    if (p.slot.field === 'paidProof' && rec.paidProof) (patch as { paidProof?: FinanceProof }).paidProof = set(rec.paidProof, i);
    else if (p.slot.field === 'attachments' && rec.attachments) { const l = ((patch as { attachments?: ClaimAttachment[] }).attachments || [...rec.attachments]); l[p.slot.index] = set(l[p.slot.index], i); (patch as { attachments?: ClaimAttachment[] }).attachments = l; }
    else if (p.slot.field === 'proofs' && rec.proofs) { const l = ((patch as { proofs?: FinanceProof[] }).proofs || [...rec.proofs]); l[p.slot.index] = set(l[p.slot.index], i); (patch as { proofs?: FinanceProof[] }).proofs = l; }
  });
  return patch;
};
