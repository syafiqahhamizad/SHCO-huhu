/**
 * Self-check for the shared dashboard definitions (financeMetrics / localDate / teamMetrics).
 * Run: npx tsx src/lib/financeMetrics.check.ts   (exits 1 on any failure)
 */
process.env.TZ = 'Asia/Kuala_Lumpur'; // must be set before any Date is created

import { feeIncomeOfPayment, feeShare, owedBalance, pctChange, runwayMonths, runwayLabel, partnerShare, receivedWithinDays, isIssued, fundProgress, invoiceOnCase } from './financeMetrics';
import { localIso, localMonth, toLocalMonth, toLocalIso, parseLocal, endOfToday } from './localDate';
import { proRatedTarget, workingDaysInMonth, annualLeaveBalance } from './teamMetrics';
import type { Invoice, LeaveApplication } from '../types';

let fails = 0, passes = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = typeof want === 'number' && typeof got === 'number' ? Math.abs(got - want) < 0.001 : got === want;
  if (ok) { passes++; return; }
  fails++; console.error(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* ---- fee income excludes SST and disbursements ---- */
// fees 1000 + reimbursement 100 + disbursement 200 + SST 8% on (1000+100) = 88 → total 1388.
const inv = {
  id: 'INV-1', status: 'Sent', total: 1388, tax: 88, date: '2026-09-01',
  lineItems: [
    { id: 'a', description: 'Fee', category: 'Fee - Fixed', unitPrice: 1000, amount: 1000 },
    { id: 'b', description: 'Copies', category: 'Reimbursement', unitPrice: 100, amount: 100 },
    { id: 'c', description: 'Stamp duty', category: 'Disbursement', unitPrice: 200, amount: 200 },
  ],
} as unknown as Invoice;
eq('feeShare', feeShare(inv), 1100 / 1388);
eq('fee income on full payment', feeIncomeOfPayment(1388, inv), 1100);
eq('fee income on half payment', feeIncomeOfPayment(694, inv), 550);
eq('fee income, no line items → total − tax', feeIncomeOfPayment(1080, { status: 'Sent', total: 1080, tax: 80 } as Invoice), 1000);
eq('fee income, zero total guarded', feeIncomeOfPayment(100, { status: 'Sent', total: 0, tax: 0 } as Invoice), 0);
eq('fee income, voided', feeIncomeOfPayment(100, { status: 'Voided', total: 100, tax: 0 } as Invoice), 0);

/* ---- owed balance with write-off ---- */
eq('owed = total − paid − written off', owedBalance({ status: 'Sent', total: 1000, writtenOff: 150 }, 600), 250);
eq('owed floors at 0', owedBalance({ status: 'Sent', total: 1000, writtenOff: 500 }, 600), 0);
eq('owed voided = 0', owedBalance({ status: 'Voided', total: 1000 }, 0), 0);
eq('Draft not issued', isIssued({ status: 'Draft' }), false);
eq('Pending Review not issued', isIssued({ status: 'Pending Review' }), false);
eq('Sent issued', isIssued({ status: 'Sent' }), true);
eq('match by fileRef', invoiceOnCase({ caseId: '', fileRef: 'SHCO/1' }, { id: 'C1', ref: 'SHCO/1' }), true);
eq('match by caseId=ref', invoiceOnCase({ caseId: 'SHCO/1' }, { id: 'C1', ref: 'SHCO/1' }), true);

/* ---- local-date bucketing at 07:30 MYT on the 1st ---- */
const at0730 = '2026-09-30T23:30:00.000Z'; // = 1 Oct 2026, 07:30 in Kuala Lumpur
eq('UTC slice says September (the bug)', at0730.slice(0, 7), '2026-09');
eq('local month of 07:30 MYT on the 1st', toLocalMonth(at0730), '2026-10');
eq('local day of 07:30 MYT on the 1st', toLocalIso(at0730), '2026-10-01');
const d0730 = new Date(Date.UTC(2026, 8, 30, 23, 30));
eq('localIso("today") at 07:30 MYT', localIso(d0730), '2026-10-01');
eq('localMonth("this month") at 07:30 MYT', localMonth(d0730), '2026-10');
eq('toISOString today would be wrong', d0730.toISOString().slice(0, 10), '2026-09-30');
eq('date-only string stays its own day', toLocalIso('2026-10-01'), '2026-10-01');
eq('dd.mm.yyyy parsed locally', toLocalIso('01.10.2026'), '2026-10-01');
eq('end of today = local midnight tomorrow', localIso(endOfToday(d0730)), '2026-10-02');
eq('end of today is midnight', new Date(endOfToday(d0730)).getHours(), 0);
eq('parseLocal date-only = local midnight', new Date(parseLocal('2026-10-01')).getHours(), 0);

/* ---- % change with zero base ---- */
eq('pct normal', pctChange(120, 100), '+20%');
eq('pct down', pctChange(80, 100), '-20%');
eq('pct zero base, new', pctChange(500, 0), 'new');
eq('pct zero both', pctChange(0, 0), '—');
eq('pct negative base', pctChange(-50, -100), '+50%');

/* ---- runway with annual commitments ---- */
const commits = [
  { amount: 10000, frequency: 'Monthly' as const },
  { amount: 24000, frequency: 'Annual' as const }, // = 2,000 / month
];
eq('runway incl. annual/12', runwayMonths(60000, commits) as number, 5);
eq('runway label', runwayLabel(60000, commits), '5.0 months');
eq('runway, no commitments → null', runwayMonths(60000, []), null);
eq('runway label, no commitments → —', runwayLabel(60000, []), '—');
eq('runway label, no balance → —', runwayLabel(null, commits), '—');
eq('fund with target 0 is not reached', fundProgress({ target: 0, balance: 0, monthly: 0 }).label, 'no target set');
eq('fund reached', fundProgress({ target: 100, balance: 100, monthly: 0 }).label, 'reached');

/* ---- co-partner split ---- */
eq('sole partner gets all', partnerShare(['SH'], 'SH'), 1);
eq('two partners split equally', partnerShare(['SH', 'AH'], 'AH'), 0.5);
eq('three partners', partnerShare(['SH', 'AH', 'ZA'], 'ZA'), 1 / 3);
eq('duplicates ignored', partnerShare(['SH', 'SH', 'AH'], 'SH'), 0.5);
eq('not on file', partnerShare(['SH'], 'AH'), 0);
const billedSplit = ['SH', 'AH'].reduce((s, c) => s + 10000 * partnerShare(['SH', 'AH'], c), 0);
eq('split sums back to the invoice', billedSplit, 10000);

/* ---- collected within 60 days (partial payments count) ---- */
const pays = [
  { invoiceId: 'INV-1', amount: 400, date: '2026-09-20' }, // 19 days
  { invoiceId: 'INV-1', amount: 300, date: '2026-11-15' }, // 75 days
];
eq('received within 60 days', receivedWithinDays({ id: 'INV-1', date: '2026-09-01' }, pays, 60, parseLocal), 400);

/* ---- pro-rated target ---- */
// October 2026: 1 Oct is a Thursday; 22 weekdays in the month.
eq('working days Oct 2026', workingDaysInMonth(2026, 9), 22);
eq('pro-rated target on 1 Oct (1 of 22 days)', proRatedTarget(176, new Date(2026, 9, 1, 7, 30)), 8);
eq('pro-rated target on 15 Oct (11 of 22 days)', proRatedTarget(176, new Date(2026, 9, 15)), 88);
eq('pro-rated target on 31 Oct (full)', proRatedTarget(176, new Date(2026, 9, 31)), 176);

/* ---- annual leave: approved + pending both reduce, pending reported ---- */
const lv = (status: LeaveApplication['status'], days: number, startDate = '2026-03-01') => ({ id: String(Math.random()), userId: 'u1', leaveType: 'Annual', startDate, endDate: startDate, days, reason: '', status, submittedAt: '' }) as LeaveApplication;
const bal = annualLeaveBalance([lv('Approved', 5), lv('Pending', 2), lv('Rejected', 3), lv('Cancelled', 1), lv('Approved', 4, '2025-03-01')], 'u1', 2026);
eq('leave left', bal.left, 9);
eq('leave pending', bal.pending, 2);

console.log(`${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
