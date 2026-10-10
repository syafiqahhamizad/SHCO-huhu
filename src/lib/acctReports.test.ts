import { describe, expect, it } from 'vitest';
import { balanceSheet, bankReconciliation, debtorLedger, generalLedger, invoiceSummary, money, parentCode, profitAndLoss, reportSheet, trialBalance, type Acct, type Posting } from './acctReports';

/* The accountant's FY2025 books (Bukku trial balance, 31/12/2025), rebuilt as postings. */
const A = (code: string, name: string, type: Acct['type']): Acct => ({ key: code, code, name, type });
const accts: Acct[] = [
  A('1000-0000', "Owner's Account", 'Equity'), A('1500-0000', 'Retained earnings', 'Equity'),
  A('3100-0000', 'Trade receivable', 'Asset'), A('3500-0000', 'Cash and bank balances', 'Asset'),
  A('3500-0000-00', 'HLB Office Account - 36301134253', 'Asset'), A('3500-0000-01', 'HLB Client Account - 36301136440', 'Asset'),
  A('5000-0000', 'Sales Income', 'Income'), A('5000-1000', 'Income', 'Income'),
  A('9C01-0000', 'Course and seminar', 'Expense'), A('9S01-0000', 'Staff salaries and wages', 'Expense'),
  A('9T02-0000', 'Travel expense', 'Expense'), A('9T02-0002', 'Mileage claims', 'Expense'), A('9Z99-0000', 'Other expenses', 'Expense'),
];
const t = (d: string) => new Date(d + 'T12:00:00').getTime();
const P = (d: string, dr: string, cr: string, amount: number, no = 'JV'): Posting => ({ t: t(d), no, contact: '', tags: '', desc: '', dr, cr, amount });
const ps: Posting[] = [
  P('2025-03-01', '9Z99-0000', '1000-0000', 26850.86 - 19273 - 10200 - 65 + 10200 + 19273 + 65),
  P('2025-05-01', '3500-0000-00', '5000-1000', 35554, 'OR-1'),
  P('2025-12-15', '3100-0000', '5000-1000', 1716, 'LIT008'),
  P('2025-06-01', '9C01-0000', '3500-0000-00', 19273),
  P('2025-07-01', '9S01-0000', '3500-0000-00', 10200),
  P('2025-08-01', '9T02-0002', '3500-0000-00', 65),
  P('2025-09-01', '3500-0000-01', '9Z99-0000', 1000),
];
const FY = [t('2025-01-01') - 43200000, t('2025-12-31') + 43199000] as const;

describe('accountant (Bukku) layout reports', () => {
  it('Bukku parent codes', () => {
    expect(parentCode('3500-0000-00')).toBe('3500-0000');
    expect(parentCode('5000-1000')).toBe('5000-0000');
    expect(parentCode('9T02-0002')).toBe('9T02-0000');
    expect(parentCode('1000-0000')).toBeNull();
    expect(money(-23066.57)).toBe('-RM23,066.57');
  });
  it('Profit & Loss: income, expenses, net profit and %, grouped under parents', () => {
    const r = profitAndLoss('Syafiqah Hamizad & Co.', accts, ps, FY[0], FY[1]);
    const row = (label: string) => r.rows.find((x) => x.cells[0] === label)!;
    expect(row('GROSS PROFIT').cells[2]).toBe(37270);
    expect(r.rows.some((x) => x.cells[0] === '5000-0000' && x.cells[1] === 'Sales Income')).toBe(true);
    expect(r.rows.some((x) => x.cells[0] === '9T02-0000' && x.cells[1] === 'Travel expense')).toBe(true);
    const net = row('NET PROFIT').cells[2] as number;
    const expenses = 37270 - net;
    expect(Math.round(expenses * 100) / 100).toBe(Math.round((26850.86 - 19273 - 10200 - 65 + 10200 + 19273 + 65 + 19273 + 10200 + 65 - 1000) * 100) / 100);
    expect(row('NET PROFIT').cells[3]).toBe(Math.round((net / 37270) * 10000) / 100);
  });
  it('Balance Sheet balances, with Current Year Earnings in equity', () => {
    const r = balanceSheet('F', accts, ps, FY[1], FY[0]);
    const v = (label: string) => r.rows.find((x) => x.cells[0] === label)!.cells[2] as number;
    expect(v('TOTAL ASSETS')).toBe(v('TOTAL LIABILITIES + EQUITY'));
    expect(r.rows.some((x) => x.cells[1] === 'Current Year Earnings')).toBe(true);
  });
  it('Trial Balance debits equal credits; sub-accounts show their parent name', () => {
    const r = trialBalance('F', accts, ps, FY[1], FY[0]);
    const tot = r.rows[r.rows.length - 1].cells;
    expect(tot[2]).toBe(tot[3]);
    expect(r.rows.some((x) => x.cells[1] === 'Cash and bank balances: HLB Office Account - 36301134253')).toBe(true);
  });
  it('General Ledger: opening balance, running balance, totals per account', () => {
    const r = generalLedger('F', accts, ps, t('2025-06-15'), FY[1]);
    const i = r.rows.findIndex((x) => x.cells[0] === '3500-0000-00 HLB Office Account - 36301134253');
    expect(r.rows[i + 1].cells[7]).toBe(35554 - 19273);
    expect(r.rows[i + 2].cells[7]).toBe(35554 - 19273 - 10200);
  });
  it('Debtor ledger, invoice summary and bank reconciliation', () => {
    const d = debtorLedger('F', [{ t: t('2025-10-09'), client: 'Aini binti Bon', no: 'IV-250002', tags: 'CL_005', desc: 'Professional charges', debit: 6570, credit: 0 }, { t: t('2025-10-12'), client: 'Aini binti Bon', no: 'OR-1', tags: '', desc: 'Legal fee', debit: 0, credit: 3000 }], FY[0], FY[1]);
    expect(d.rows.find((x) => x.cells[1] === 'OR-1')!.cells[6]).toBe(3570);
    const s = invoiceSummary('F', [{ t: t('2025-12-15'), no: 'LIT008', contact: 'SYED & KAMARUDDIN', desc: 'Fees', amount: 1716, balance: 1716 }], FY[0], FY[1]);
    expect(s.rows[s.rows.length - 1].cells.slice(4)).toEqual([1716, 1716]);
    const b = bankReconciliation('F', 'HLB Client Account - 36301136440', FY[1], 1000, 1000, [], []);
    expect(b.rows.find((x) => String(x.cells[0]).startsWith('TOTAL UNRECONCILED'))!.cells[4]).toBe(0);
    expect(reportSheet(b, 'Aziera')[0]).toEqual(['Bank Reconciliation']);
  });
});
