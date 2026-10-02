/**
 * Shared dashboard definitions (financeMetrics / localDate / teamMetrics). Formerly
 * src/lib/financeMetrics.check.ts. Time zone is pinned to Asia/Kuala_Lumpur by vitest.config.ts.
 */
import { describe, expect, it } from 'vitest';
import { feeIncomeOfPayment, feeShare, owedBalance, pctChange, runwayMonths, runwayLabel, partnerShare, receivedWithinDays, isIssued, fundProgress, invoiceOnCase } from './financeMetrics';
import { localIso, localMonth, toLocalMonth, toLocalIso, parseLocal, endOfToday } from './localDate';
import { proRatedTarget, workingDaysInMonth, annualLeaveBalance } from './teamMetrics';
import type { Invoice, LeaveApplication } from '../types';

/** Same comparison the old check script used: two numbers within 0.001, everything else strictly equal. */
const eq = (got: unknown, want: unknown) => {
  if (typeof want === 'number' && typeof got === 'number') expect(Math.abs(got - want)).toBeLessThan(0.001);
  else expect(got).toBe(want);
};

describe('fee income excludes SST and disbursements', () => {
  // fees 1000 + reimbursement 100 + disbursement 200 + SST 8% on (1000+100) = 88 → total 1388.
  const inv = {
    id: 'INV-1', status: 'Sent', total: 1388, tax: 88, date: '2026-09-01',
    lineItems: [
      { id: 'a', description: 'Fee', category: 'Fee - Fixed', unitPrice: 1000, amount: 1000 },
      { id: 'b', description: 'Copies', category: 'Reimbursement', unitPrice: 100, amount: 100 },
      { id: 'c', description: 'Stamp duty', category: 'Disbursement', unitPrice: 200, amount: 200 },
    ],
  } as unknown as Invoice;
  it('feeShare', () => eq(feeShare(inv), 1100 / 1388));
  it('fee income on full payment', () => eq(feeIncomeOfPayment(1388, inv), 1100));
  it('fee income on half payment', () => eq(feeIncomeOfPayment(694, inv), 550));
  it('fee income, no line items → total − tax', () => eq(feeIncomeOfPayment(1080, { status: 'Sent', total: 1080, tax: 80 } as Invoice), 1000));
  it('fee income, zero total guarded', () => eq(feeIncomeOfPayment(100, { status: 'Sent', total: 0, tax: 0 } as Invoice), 0));
  it('fee income, voided', () => eq(feeIncomeOfPayment(100, { status: 'Voided', total: 100, tax: 0 } as Invoice), 0));
});

describe('owed balance with write-off', () => {
  it('owed = total − paid − written off', () => eq(owedBalance({ status: 'Sent', total: 1000, writtenOff: 150 }, 600), 250));
  it('owed floors at 0', () => eq(owedBalance({ status: 'Sent', total: 1000, writtenOff: 500 }, 600), 0));
  it('owed voided = 0', () => eq(owedBalance({ status: 'Voided', total: 1000 }, 0), 0));
  it('Draft not issued', () => eq(isIssued({ status: 'Draft' }), false));
  it('Pending Review not issued', () => eq(isIssued({ status: 'Pending Review' }), false));
  it('Sent issued', () => eq(isIssued({ status: 'Sent' }), true));
  it('match by fileRef', () => eq(invoiceOnCase({ caseId: '', fileRef: 'SHCO/1' }, { id: 'C1', ref: 'SHCO/1' }), true));
  it('match by caseId=ref', () => eq(invoiceOnCase({ caseId: 'SHCO/1' }, { id: 'C1', ref: 'SHCO/1' }), true));
});

describe('local-date bucketing at 07:30 MYT on the 1st', () => {
  const at0730 = '2026-09-30T23:30:00.000Z'; // = 1 Oct 2026, 07:30 in Kuala Lumpur
  const d0730 = new Date(Date.UTC(2026, 8, 30, 23, 30));
  it('UTC slice says September (the bug)', () => eq(at0730.slice(0, 7), '2026-09'));
  it('local month of 07:30 MYT on the 1st', () => eq(toLocalMonth(at0730), '2026-10'));
  it('local day of 07:30 MYT on the 1st', () => eq(toLocalIso(at0730), '2026-10-01'));
  it('localIso("today") at 07:30 MYT', () => eq(localIso(d0730), '2026-10-01'));
  it('localMonth("this month") at 07:30 MYT', () => eq(localMonth(d0730), '2026-10'));
  it('toISOString today would be wrong', () => eq(d0730.toISOString().slice(0, 10), '2026-09-30'));
  it('date-only string stays its own day', () => eq(toLocalIso('2026-10-01'), '2026-10-01'));
  it('dd.mm.yyyy parsed locally', () => eq(toLocalIso('01.10.2026'), '2026-10-01'));
  it('end of today = local midnight tomorrow', () => eq(localIso(endOfToday(d0730)), '2026-10-02'));
  it('end of today is midnight', () => eq(new Date(endOfToday(d0730)).getHours(), 0));
  it('parseLocal date-only = local midnight', () => eq(new Date(parseLocal('2026-10-01')).getHours(), 0));
});

describe('% change with zero base', () => {
  it('pct normal', () => eq(pctChange(120, 100), '+20%'));
  it('pct down', () => eq(pctChange(80, 100), '-20%'));
  it('pct zero base, new', () => eq(pctChange(500, 0), 'new'));
  it('pct zero both', () => eq(pctChange(0, 0), '—'));
  it('pct negative base', () => eq(pctChange(-50, -100), '+50%'));
});

describe('runway with annual commitments', () => {
  const commits = [
    { amount: 10000, frequency: 'Monthly' as const },
    { amount: 24000, frequency: 'Annual' as const }, // = 2,000 / month
  ];
  it('runway incl. annual/12', () => eq(runwayMonths(60000, commits) as number, 5));
  it('runway label', () => eq(runwayLabel(60000, commits), '5.0 months'));
  it('runway, no commitments → null', () => eq(runwayMonths(60000, []), null));
  it('runway label, no commitments → —', () => eq(runwayLabel(60000, []), '—'));
  it('runway label, no balance → —', () => eq(runwayLabel(null, commits), '—'));
  it('fund with target 0 is not reached', () => eq(fundProgress({ target: 0, balance: 0, monthly: 0 }).label, 'no target set'));
  it('fund reached', () => eq(fundProgress({ target: 100, balance: 100, monthly: 0 }).label, 'reached'));
});

describe('co-partner split', () => {
  it('sole partner gets all', () => eq(partnerShare(['SH'], 'SH'), 1));
  it('two partners split equally', () => eq(partnerShare(['SH', 'AH'], 'AH'), 0.5));
  it('three partners', () => eq(partnerShare(['SH', 'AH', 'ZA'], 'ZA'), 1 / 3));
  it('duplicates ignored', () => eq(partnerShare(['SH', 'SH', 'AH'], 'SH'), 0.5));
  it('not on file', () => eq(partnerShare(['SH'], 'AH'), 0));
  it('split sums back to the invoice', () => {
    const billedSplit = ['SH', 'AH'].reduce((s, c) => s + 10000 * partnerShare(['SH', 'AH'], c), 0);
    eq(billedSplit, 10000);
  });
});

describe('collected within 60 days (partial payments count)', () => {
  const pays = [
    { invoiceId: 'INV-1', amount: 400, date: '2026-09-20' }, // 19 days
    { invoiceId: 'INV-1', amount: 300, date: '2026-11-15' }, // 75 days
  ];
  it('received within 60 days', () => eq(receivedWithinDays({ id: 'INV-1', date: '2026-09-01' }, pays, 60, parseLocal), 400));
});

describe('pro-rated target', () => {
  // October 2026: 1 Oct is a Thursday; 22 weekdays in the month.
  it('working days Oct 2026', () => eq(workingDaysInMonth(2026, 9), 22));
  it('pro-rated target on 1 Oct (1 of 22 days)', () => eq(proRatedTarget(176, new Date(2026, 9, 1, 7, 30)), 8));
  it('pro-rated target on 15 Oct (11 of 22 days)', () => eq(proRatedTarget(176, new Date(2026, 9, 15)), 88));
  it('pro-rated target on 31 Oct (full)', () => eq(proRatedTarget(176, new Date(2026, 9, 31)), 176));
});

describe('annual leave: approved + pending both reduce, pending reported', () => {
  let n = 0;
  const lv = (status: LeaveApplication['status'], days: number, startDate = '2026-03-01') => ({ id: `L${++n}`, userId: 'u1', leaveType: 'Annual', startDate, endDate: startDate, days, reason: '', status, submittedAt: '' }) as LeaveApplication;
  const bal = annualLeaveBalance([lv('Approved', 5), lv('Pending', 2), lv('Rejected', 3), lv('Cancelled', 1), lv('Approved', 4, '2025-03-01')], 'u1', 2026);
  it('leave left', () => eq(bal.left, 9));
  it('leave pending', () => eq(bal.pending, 2));
});
