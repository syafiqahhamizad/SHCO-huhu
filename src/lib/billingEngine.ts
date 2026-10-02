/**
 * Billing Engine — automated document pipeline for SHCO
 * Flow: Quotation → Proforma Invoice → Invoice → Official Receipt
 *
 * Practice-format automation:
 * - Conveyancing → SRO 2023 scale fees (auto from consideration/loan amount)
 * - Litigation & others → court level × stage fee matrix (editable after auto-fill)
 */
import { QuotationLineItem, TimeEntry } from '../types';

/** Fallback rate when no Firm & Practice Settings rate is passed in — kept in sync with
 * DEFAULT_PRACTICE_SETTINGS.sstRate. Prefer passing the real configured rate. */
const SST_RATE = 0.08;

export type BillingDocType = 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt';

export interface BillingTotals {
  fees: number;           // professional fees
  disbursements: number;  // never SST-chargeable
  reimbursements: number; // SST-chargeable, same as fees
  sstRate: number;        // the rate actually used (0 when SST wasn't applied)
  sst: number;            // rate × (fees + reimbursements) — disbursements are excluded
  /** Printed split of `sst` (they always add up to `sst`). */
  sstFees: number;
  sstReimbursements: number;
  grandTotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * THE SST rule used everywhere (stored totals, printed documents, GL): SST is rounded ONCE on
 * (fees + reimbursements) × rate. For the printed "SST on fees" / "SST on reimbursements" lines,
 * fees take round2(fees × rate) and the reimbursement line takes the remainder, so the two lines
 * always add up to the stored total (with no reimbursements, fees carry the whole amount).
 */
export function splitSst(fees: number, reimbursements: number, rate: number): { sst: number; sstFees: number; sstReimbursements: number } {
  const sst = round2((fees + reimbursements) * (rate || 0));
  if (!reimbursements) return { sst, sstFees: sst, sstReimbursements: 0 };
  if (!fees) return { sst, sstFees: 0, sstReimbursements: sst };
  const sstFees = round2(fees * (rate || 0));
  return { sst, sstFees, sstReimbursements: round2(sst - sstFees) };
}

/** Time / expenses that may be billed: not rejected and not waiting for approval. Records from
 * before approvals existed (no approvalStatus) count as approved. */
export const isApprovedForBilling = (status?: string) => !status || status === 'Approved' || status === 'Posted to GL';

const getItemTotal = (item: QuotationLineItem): number => {
  const quantity = Number(item.quantity ?? 1);
  const unitPrice = Number(item.unitPrice ?? item.amount ?? 0);
  const total = item.chargeType === 'Per Quantity' ? quantity * unitPrice : unitPrice;
  return Number.isFinite(total) ? total : 0;
};

/**
 * Accounting-style totals: fees + disbursements + reimbursements, plus SST when applied.
 * SST is charged on professional fees AND reimbursements — never on disbursements (per the
 * firm's document format: "DISBURSEMENT (never SST)"). The firm isn't SST-registered yet, so
 * `applySst` defaults to false; pass Firm & Practice Settings' sstRegistered/sstRate (or a
 * document's own tick) to apply it.
 */
export function computeTotals(items: QuotationLineItem[], applySst = false, rate = SST_RATE): BillingTotals {
  const fees = items
    .filter((i) => i.category === 'Fee - Fixed' || i.category === 'Fee - SRO')
    .reduce((s, i) => s + getItemTotal(i), 0);
  const disbursements = items
    .filter((i) => i.category === 'Disbursement')
    .reduce((s, i) => s + getItemTotal(i), 0);
  const reimbursements = items
    .filter((i) => i.category === 'Reimbursement')
    .reduce((s, i) => s + getItemTotal(i), 0);
  const effectiveRate = applySst ? rate : 0;
  const { sst, sstFees, sstReimbursements } = splitSst(fees, reimbursements, effectiveRate);
  return {
    fees: round2(fees),
    disbursements: round2(disbursements),
    reimbursements: round2(reimbursements),
    sstRate: effectiveRate,
    sst,
    sstFees,
    sstReimbursements,
    grandTotal: round2(fees + sst + disbursements + reimbursements),
  };
}

/** Converts approved, billable time into invoice-ready professional-fee rows. */
export function buildTimeEntryItems(entries: TimeEntry[]): QuotationLineItem[] {
  return entries
    .filter((entry) => entry.billable && !entry.billed && !entry.writtenOff && isApprovedForBilling(entry.approvalStatus))
    .map((entry) => ({
      description: `${entry.description || 'Professional services'} (${entry.date}, ${entry.hours}h)`,
      category: 'Fee - Fixed',
      amount: round2(entry.hours * entry.rate),
      quantity: entry.hours,
      unitPrice: entry.rate,
      chargeType: 'Per Quantity',
    }));
}
