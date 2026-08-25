/**
 * SRO 2023 (Solicitors' Remuneration Order 2023) Scale Fee Calculator
 * Malaysian Legal Profession Act 1976 - SRO 2023 Rules
 */

export interface SROCalculationResult {
  scaleFee: number;
  breakdown: { tier: string; rate: string; amount: number; fee: number }[];
  sstAmount: number; // SST 8% on professional fee
  stampDutyEstimate: number;
  totalWithDisbursements: number;
}

/**
 * Calculates Scale Fees for Transfer / Sale & Purchase Agreement under SRO 2023 First Schedule:
 * - First RM 500,000: 1.25% (subject to a minimum fee of RM 500)
 * - Next RM 7,500,000 (RM 500,001 to RM 7,500,000): 1.00%
 * - Where consideration exceeds RM 7,500,000: Negotiable on the excess over RM 7.5M, but not exceeding 1.00%
 */
export function calculateSroTransferFee(propertyPrice: number, isDiscounted = false, discountPct = 0): SROCalculationResult {
  let remaining = propertyPrice;
  let scaleFee = 0;
  const breakdown: { tier: string; rate: string; amount: number; fee: number }[] = [];

  if (remaining > 0) {
    const tier1Amt = Math.min(remaining, 500000);
    const tier1Fee = tier1Amt * 0.0125;
    scaleFee += tier1Fee;
    breakdown.push({ tier: 'First RM 500,000', rate: '1.25%', amount: tier1Amt, fee: tier1Fee });
    remaining -= tier1Amt;
  }

  if (remaining > 0) {
    const tier2Amt = Math.min(remaining, 7000000); // 500k to 7.5m
    const tier2Fee = tier2Amt * 0.01;
    scaleFee += tier2Fee;
    breakdown.push({ tier: 'RM 500,001 to RM 7,500,000', rate: '1.00%', amount: tier2Amt, fee: tier2Fee });
    remaining -= tier2Amt;
  }

  if (remaining > 0) {
    const tier3Amt = remaining;
    const tier3Fee = tier3Amt * 0.01; // Negotiable up to 1%
    scaleFee += tier3Fee;
    breakdown.push({ tier: 'Exceeding RM 7,500,000', rate: 'Up to 1.00%', amount: tier3Amt, fee: tier3Fee });
  }

  // Minimum fee under SRO 2023
  if (scaleFee < 500 && propertyPrice > 0) {
    scaleFee = 500;
  }

  if (isDiscounted && discountPct > 0) {
    // SRO 2023 allows up to 25% discount under specific rule conditions
    const cappedDiscount = Math.min(discountPct, 25);
    scaleFee = scaleFee * (1 - cappedDiscount / 100);
  }

  const sstAmount = scaleFee * 0.08; // 8% Service Tax on Legal Fees

  // Estimate Stamp Duty (Mot / Memorandum of Transfer)
  let stampDutyEstimate = 0;
  let sdRem = propertyPrice;
  if (sdRem > 0) { const a = Math.min(sdRem, 100000); stampDutyEstimate += a * 0.01; sdRem -= a; }
  if (sdRem > 0) { const a = Math.min(sdRem, 400000); stampDutyEstimate += a * 0.02; sdRem -= a; }
  if (sdRem > 0) { const a = Math.min(sdRem, 500000); stampDutyEstimate += a * 0.03; sdRem -= a; }
  if (sdRem > 0) { stampDutyEstimate += sdRem * 0.04; }

  return {
    scaleFee,
    breakdown,
    sstAmount,
    stampDutyEstimate,
    totalWithDisbursements: scaleFee + sstAmount + stampDutyEstimate + 300, // estimated RM 300 search/registration fees
  };
}

/**
 * Calculates Scale Fees for Loan / Charge under SRO 2023 Third Schedule:
 * - Same percentages as First Schedule
 */
export function calculateSroLoanFee(loanAmount: number): SROCalculationResult {
  return calculateSroTransferFee(loanAmount);
}
