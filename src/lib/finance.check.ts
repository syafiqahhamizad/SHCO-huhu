/**
 * Finance formula checks (pure, no browser / Firebase). Run: TZ=Asia/Kuala_Lumpur npx tsx src/lib/finance.check.ts
 * (the date test forces Asia/Kuala_Lumpur itself if TZ is unset).
 */
if (!process.env.TZ) process.env.TZ = 'Asia/Kuala_Lumpur';
import { computeTotals, splitSst } from './billingEngine';
import { claimFormTotal, inPeriod, invoiceComposition, localIso, monthsCovered, needsTwoSignatories, parseDate, round2, splitReceipt } from './financeCalc';
import type { QuotationLineItem } from '../types';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 0.005 : got === want;
  if (!ok) { fails++; console.log('FAIL', name, 'got', got, 'want', want); } else console.log('ok  ', name);
};
const li = (category: QuotationLineItem['category'] | 'Tax', amount: number) => ({ description: category, category, amount, quantity: 1, unitPrice: amount, chargeType: 'Fixed' as const }) as QuotationLineItem;

/* 1. Invoice with a proforma deposit applied */
{
  const items = [li('Fee - Fixed', 10000), li('Disbursement', 500), li('Reimbursement', 300)];
  const t = computeTotals(items, true, 0.08); // SST 0.08 × 10300 = 824
  eq('invoice total', t.grandTotal, 11624);
  const deposit = round2(10000 / 2); // proforma 50% retainer, paid to the office account
  const inv = { lineItems: items, total: t.grandTotal, tax: t.sst, depositApplied: deposit };
  const balance = round2(inv.total - inv.depositApplied - 0 /* paid */);
  eq('balance after deposit', balance, 6624);
  // GL: Dr AR 11624 (fees 10300 / disb 500 / SST 824), then Dr 2110 / Cr AR 5000 → AR = balance
  const ar = round2((t.fees + t.reimbursements) + t.disbursements + t.sst - deposit);
  eq('AR after issue = balance', ar, balance);
  // The deposit is fee money: its fee-income share is counted once, when applied.
  const sp = splitReceipt(deposit, invoiceComposition(inv));
  eq('deposit split adds up', round2(sp.income + sp.sst + sp.disb), deposit);
}

/* 2. SST rounding consistency: fees 1000.05 + reimbursements 10.05 @ 8% */
{
  const items = [li('Fee - Fixed', 1000.05), li('Reimbursement', 10.05)];
  const t = computeTotals(items, true, 0.08);
  eq('SST rounded once', t.sst, 80.81); // 1010.10 × 0.08 = 80.808
  const s = splitSst(1000.05, 10.05, 0.08);
  eq('printed lines sum to stored SST', round2(s.sstFees + s.sstReimbursements), t.sst);
  eq('SST on fees line', s.sstFees, 80.0);
  eq('SST on reimbursements line (takes the rounding)', s.sstReimbursements, 0.81);
  eq('grand total', t.grandTotal, 1090.91);
  // Old invoices with a Tax line: never charged again / never a fee.
  const old = invoiceComposition({ lineItems: [...items, li('Tax', 80.81)], total: 1090.91, tax: 80.81 });
  eq('Tax line ignored (fees)', old.fees, 1000.05);
}

/* 3. Disbursement flow nets to zero in the P&L */
{
  // pay RM 200 filing fee: Dr 1200 / Cr bank; invoice: Dr 1100 / Cr 1200; client pays: Dr bank / Cr 1100
  const gl: [string, string, number][] = [['1200', '1014', 200], ['1100', '1200', 200], ['1014', '1100', 200]];
  const bal = new Map<string, number>(); gl.forEach(([d, c, a]) => { bal.set(d, (bal.get(d) || 0) + a); bal.set(c, (bal.get(c) || 0) - a); });
  const pl = [...bal.entries()].filter(([k]) => /^[45]/.test(k)).reduce((s, [, v]) => s + v, 0);
  eq('disbursement P&L effect', pl, 0);
  eq('1200 cleared', bal.get('1200') || 0, 0);
}

/* 4. Fee income excludes SST and disbursements */
{
  const items = [li('Fee - Fixed', 1000), li('Reimbursement', 100), li('Disbursement', 300)];
  const t = computeTotals(items, true, 0.08); // SST 88, total 1488
  const c = invoiceComposition({ lineItems: items, total: t.grandTotal, tax: t.sst });
  const full = splitReceipt(t.grandTotal, c);
  eq('fee income on full payment', full.income, 1100);
  eq('SST collected', full.sst, 88);
  eq('disbursement recovered', full.disb, 300);
  const half = splitReceipt(744, c);
  eq('fee income on half payment', half.income, 550);
  eq('zero-total invoice guarded', splitReceipt(50, { fees: 0, reimb: 0, disb: 0, sst: 0, total: 0 }).income, 50);
}

/* 5. Local-date bucketing: 07:30 MYT on the 1st is 23:30 UTC the day before */
{
  const iso = '2026-09-30T23:30:00.000Z'; // = 1 Oct 2026 07:30 Malaysia
  eq('local day', localIso(iso), '2026-10-01');
  eq('in October', inPeriod(iso, '2026-10'), true);
  eq('not in September', inPeriod(iso, '2026-09'), false);
  eq('plain date untouched', localIso('2026-09-30'), '2026-09-30');
  eq('dd.mm.yyyy', localIso('01.10.2026'), '2026-10-01');
  eq('parseDate local midnight', new Date(parseDate(iso)).getHours(), 0);
}

/* 6. Claim-form threshold aggregation (MP + 1 at RM 5,000 and above, per FORM) */
{
  const items = [
    { id: 'TC-1', formNo: 'CF-26-0001', amount: 3000 },
    { id: 'EX-1', formNo: 'CF-26-0001', amount: 2000 },
    { id: 'EX-2', formNo: 'CF-26-0001', amount: 900, rejected: true },
    { id: 'EX-3', formNo: 'CF-26-0002', amount: 4999.99 },
  ];
  const f1 = claimFormTotal(items, 'CF-26-0001', 3000);
  eq('form total (rejected excluded)', f1, 5000);
  eq('item under limit but form at limit → MP + 1', needsTwoSignatories(f1, 5000), true);
  eq('form below limit → any partner', needsTwoSignatories(claimFormTotal(items, 'CF-26-0002', 4999.99), 5000), false);
  eq('no form → the item itself', claimFormTotal(items, undefined, 1200), 1200);
  eq('client account always MP + 1', needsTwoSignatories(10, 5000, true), true);
}

/* 7. Runway with annual commitments */
{
  const commitments = [{ amount: 10000, frequency: 'Monthly' }, { amount: 24000, frequency: 'Annual' }];
  eq('months covered (monthly + annual/12)', monthsCovered(36000, commitments)!, 3);
  eq('no commitments → —', monthsCovered(36000, []), null);
  eq('annual only', monthsCovered(12000, [{ amount: 12000, frequency: 'Annual' }])!, 12);
}

if (fails) { console.log(`\n${fails} check(s) FAILED`); process.exit(1); }
console.log('\nAll finance checks passed');
