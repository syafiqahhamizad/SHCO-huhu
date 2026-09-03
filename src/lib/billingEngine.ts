/**
 * Billing Engine — automated document pipeline for SHCO
 * Flow: Quotation → Proforma Invoice → Invoice → Official Receipt
 *
 * Practice-format automation:
 * - Conveyancing → SRO 2023 scale fees (auto from consideration/loan amount)
 * - Litigation & others → court level × stage fee matrix (editable after auto-fill)
 */
import { QuotationLineItem, QuoteTemplate } from '../types';
import { calculateSroTransferFee, calculateSroLoanFee } from './sroCalculator';

export const SST_RATE = 0.08; // 8% service tax on professional fees

export type BillingDocType = 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt';

export interface BillingTotals {
  fees: number;           // professional fees (SST-chargeable)
  disbursements: number;
  reimbursements: number;
  sst: number;            // 8% on professional fees only
  grandTotal: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Accounting-style totals: fees + SST on fees + disbursements + reimbursements */
export function computeTotals(items: QuotationLineItem[]): BillingTotals {
  const fees = items
    .filter((i) => i.category === 'Fee - Fixed' || i.category === 'Fee - SRO')
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const disbursements = items
    .filter((i) => i.category === 'Disbursement')
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const reimbursements = items
    .filter((i) => i.category === 'Reimbursement')
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const sst = round2(fees * SST_RATE);
  return {
    fees: round2(fees),
    disbursements: round2(disbursements),
    reimbursements: round2(reimbursements),
    sst,
    grandTotal: round2(fees + sst + disbursements + reimbursements),
  };
}

/** Generates the next running document number, e.g. Q-0004, PI-0002, INV-0007, OR-0012 */
export function nextDocNumber(prefix: string, existingIds: string[]): string {
  const max = existingIds.reduce((highest, id) => {
    const match = id.match(/(\d+)\s*$/);
    return match ? Math.max(highest, parseInt(match[1], 10)) : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

/* ================= CONVEYANCING — SRO 2023 automation ================= */

export type ConveyancingSubtype = 'Transfer' | 'Loan';

/**
 * Auto-builds line items from the consideration / loan amount under SRO 2023.
 * Returns editable line items — user can adjust description/price afterwards.
 */
export function buildConveyancingItems(
  amount: number,
  subtype: ConveyancingSubtype,
  discountPct = 0
): { items: QuotationLineItem[]; breakdown: { tier: string; rate: string; fee: number }[] } {
  if (!amount || amount <= 0) return { items: [], breakdown: [] };

  if (subtype === 'Loan') {
    const r = calculateSroLoanFee(amount);
    const items: QuotationLineItem[] = [
      { description: `Professional fee — SRO 2023 Third Schedule (Loan/Charge of RM ${amount.toLocaleString()})`, category: 'Fee - SRO', amount: round2(r.scaleFee) },
      { description: 'Stamp duty on loan documents (est. 0.5%)', category: 'Disbursement', amount: round2(amount * 0.005) },
      { description: 'Search, registration & misc charges', category: 'Disbursement', amount: 300 },
      { description: 'Photocopy, courier & misc reimbursement', category: 'Reimbursement', amount: 150 },
    ];
    return { items, breakdown: r.breakdown };
  }

  const r = calculateSroTransferFee(amount, discountPct > 0, discountPct);
  const items: QuotationLineItem[] = [
    {
      description: `Professional fee — SRO 2023 First Schedule (Transfer of RM ${amount.toLocaleString()}${discountPct > 0 ? `, ${Math.min(discountPct, 25)}% discount` : ''})`,
      category: 'Fee - SRO',
      amount: round2(r.scaleFee),
    },
    { description: 'Stamp duty on Memorandum of Transfer (est.)', category: 'Disbursement', amount: round2(r.stampDutyEstimate) },
    { description: 'Search, registration & misc charges', category: 'Disbursement', amount: 300 },
    { description: 'Photocopy, courier & misc reimbursement', category: 'Reimbursement', amount: 150 },
  ];
  return { items, breakdown: r.breakdown };
}

/* ================= LITIGATION — level × stage automation ================= */

export const COURT_LEVELS = ["Magistrate's Court", 'Sessions Court', 'High Court', 'Court of Appeal', 'Federal Court'] as const;

export const LITIGATION_STAGES = [
  'Pre-Action / Letter of Demand',
  'Filing & Pleadings',
  'Interlocutory / Case Management',
  'Full Trial',
  'Appeal',
  'Enforcement / Execution',
] as const;

/** Base professional fee per court level (firm's internal scale, editable after auto-fill) */
const LEVEL_BASE_FEE: Record<string, number> = {
  "Magistrate's Court": 4000,
  'Sessions Court': 20000,
  'High Court': 50000,
  'Court of Appeal': 30000,
  'Federal Court': 60000,
};

/** Portion of the full-trial fee chargeable at each stage */
const STAGE_FACTOR: Record<string, number> = {
  'Pre-Action / Letter of Demand': 0.15,
  'Filing & Pleadings': 0.35,
  'Interlocutory / Case Management': 0.5,
  'Full Trial': 1,
  'Appeal': 0.6,
  'Enforcement / Execution': 0.25,
};

const LEVEL_FILING_FEE: Record<string, number> = {
  "Magistrate's Court": 30,
  'Sessions Court': 50,
  'High Court': 100,
  'Court of Appeal': 200,
  'Federal Court': 300,
};

/**
 * Auto-builds litigation line items by court level + stage.
 * 1) Uses a firm quote template if one matches exactly.
 * 2) Otherwise falls back to the level × stage fee matrix.
 * All rows are editable after generation.
 */
export function buildLitigationItems(
  templates: QuoteTemplate[],
  courtLevel: string,
  stage: string
): { items: QuotationLineItem[]; source: 'Template' | 'Matrix' } {
  const matched = templates.filter(
    (t) => t.practiceArea === 'Civil Litigation' && t.courtLevel === courtLevel && t.stage === stage
  );
  if (matched.length > 0) {
    return {
      source: 'Template',
      items: matched.map((t) => ({ description: t.description, category: t.category, amount: t.amount })),
    };
  }

  const base = LEVEL_BASE_FEE[courtLevel] ?? 10000;
  const factor = STAGE_FACTOR[stage] ?? 0.5;
  const fee = round2(base * factor);

  return {
    source: 'Matrix',
    items: [
      { description: `Professional fee — ${courtLevel}, ${stage}`, category: 'Fee - Fixed', amount: fee },
      { description: 'Court filing & service fees (est.)', category: 'Disbursement', amount: LEVEL_FILING_FEE[courtLevel] ?? 100 },
      { description: 'Photocopy, travel, phone/courier', category: 'Reimbursement', amount: 150 },
    ],
  };
}
