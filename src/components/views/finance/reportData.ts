import type { FinanceCtrl } from './useFinanceController';
import { glCode, monthEnd, parseDate } from './financeModel';
import { periodKey } from '../../../lib/financeCalc';
import type { Acct, AType, DebtorDoc, InvoiceLine, Posting, ReconItem } from '../../../lib/acctReports';

/**
 * Portal records → the inputs of lib/acctReports (the accountant's report layout).
 * Accounts are the chart of accounts with the renames / additions saved in Accounting → Edit
 * accounts (coaEdits), so a renamed account shows its new code and name on every report while
 * past postings keep pointing at it.
 */

const TYPE_BY_DIGIT: Record<string, AType> = { '1': 'Asset', '2': 'Liability', '3': 'Equity', '4': 'Income', '5': 'Expense' };
const nameOf = (acct: string) => String(acct || '').replace(/^\s*[0-9][0-9A-Z-]*\s*-\s*/, '');

export function acctsOf(F: FinanceCtrl): Acct[] {
  const { chartOfAccounts, generalLedger } = F.app;
  const E = F.settings.coaEdits || {};
  const ov = E.overrides || {};
  const base = new Map<string, { name: string; type: AType }>();
  chartOfAccounts.forEach((c) => base.set(c.code, { name: c.name, type: c.type }));
  (E.added || []).forEach((a) => { if (!base.has(a.code)) base.set(a.code, { name: a.name, type: a.type }); });
  generalLedger.forEach((g) => [g.debit, g.credit].forEach((s) => {
    const k = glCode(s);
    if (k && !base.has(k)) base.set(k, { name: nameOf(s), type: TYPE_BY_DIGIT[k.charAt(0)] || 'Expense' });
  }));
  return [...base.entries()].filter(([k]) => !ov[k]?.arch).map(([k, v]) => ({ key: k, code: ov[k]?.code || k, name: ov[k]?.name || v.name, type: v.type }));
}

export function postingsOf(F: FinanceCtrl): Posting[] {
  return F.app.generalLedger.map((g) => ({
    t: parseDate(g.date) || 0,
    no: g.docNo || '',
    contact: F.clientName(g.clientId) || '',
    tags: g.fileRef || '',
    desc: g.description || '',
    dr: glCode(g.debit),
    cr: glCode(g.credit),
    amount: Number(g.amount || 0),
  })).filter((p) => p.t && p.dr && p.cr && p.amount);
}

/** Invoices (debit) and money received against them (credit), per client. */
export function debtorDocsOf(F: FinanceCtrl): DebtorDoc[] {
  const { invoices, payments } = F.app;
  const client = (i: { partyName?: string; clientId?: string }) => i.partyName || F.clientName(i.clientId) || 'No client';
  const docs: DebtorDoc[] = [];
  invoices.filter((i) => F.invIssued(i)).forEach((i) => {
    docs.push({ t: parseDate(i.date) || 0, client: client(i), no: i.id, tags: i.fileRef || '', desc: i.subject || (i.lineItems || [])[0]?.description || 'Invoice', debit: Number(i.total || 0), credit: 0 });
  });
  payments.forEach((p) => {
    const i = invoices.find((x) => x.id === p.invoiceId);
    if (!i || !F.invIssued(i)) return;
    docs.push({ t: parseDate(p.date) || 0, client: client(i), no: p.id, tags: i.fileRef || '', desc: 'Payment for ' + i.id + (p.method ? ' (' + p.method + ')' : ''), debit: 0, credit: Number(p.amount || 0) });
  });
  return docs.filter((d) => d.t);
}

export function invoiceLinesOf(F: FinanceCtrl): InvoiceLine[] {
  return F.app.invoices.filter((i) => F.invIssued(i)).map((i) => ({
    t: parseDate(i.date) || 0,
    no: i.id,
    contact: i.partyName || F.clientName(i.clientId) || '—',
    desc: i.subject || (i.lineItems || [])[0]?.description || '',
    amount: Number(i.total || 0),
    balance: Math.max(0, Math.round((Number(i.total || 0) - F.invPaid(i)) * 100) / 100),
  })).filter((x) => x.t);
}

/** Bank reconciliation inputs for one bank, at the end of `month`. Client account items come from
 * the month's ticked "outstanding" cash book lines (Client Account → 3-way reconciliation). */
export function bankReconOf(F: FinanceCtrl, acc: 'Office' | 'Client account', month: Date): { asAt: number; portal: number; statement: number | null; notCredited: ReconItem[]; unpresented: ReconItem[] } {
  const end = monthEnd(month);
  end.setHours(23, 59, 59, 999);
  const rows = F.cashBook(acc).filter((r) => r.t && r.t <= end.getTime());
  const portal = Math.round((F.openingBalance(acc) + rows.reduce((s, r) => s + r.inn - r.out, 0)) * 100) / 100;
  if (acc !== 'Client account') return { asAt: end.getTime(), portal, statement: null, notCredited: [], unpresented: [] };
  const st = (F.settings.clientBankStatements || {})[periodKey(month)];
  const out = new Set(st?.outstanding || []);
  const item = (r: (typeof rows)[number], amount: number): ReconItem => ({ t: r.t, no: r.no || '', contact: r.who || '', desc: r.what || '', amount });
  return {
    asAt: end.getTime(), portal, statement: F.statementFor(month),
    notCredited: rows.filter((r) => out.has(r.key) && r.inn > 0).map((r) => item(r, r.inn)),
    unpresented: rows.filter((r) => out.has(r.key) && r.out > 0).map((r) => item(r, r.out)),
  };
}
