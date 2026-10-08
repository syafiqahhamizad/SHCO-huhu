/**
 * Year and type filters shared by My Claims and Finance → Approvals, so staff claims, payment
 * vouchers and client-account payments can be told apart and looked up by year.
 */

export type FinanceDocType = 'Claim' | 'Payment voucher' | 'Client account';
export const FINANCE_DOC_TYPES: FinanceDocType[] = ['Claim', 'Payment voucher', 'Client account'];
/** Badge colours [background, text] per type. */
export const DOC_TYPE_COLORS: Record<FinanceDocType, [string, string]> = { Claim: ['#E7EEF6', '#2F5680'], 'Payment voucher': ['#F1EBF6', '#6B3D8C'], 'Client account': ['#FBEDE9', '#B23A2E'] };

/** Claim = staff claim (travel / expense); PV from the client account = Client account; other PVs = Payment voucher. */
export const financeDocType = (source: string, clientAccount = false): FinanceDocType =>
  source === 'travel' || source === 'expense' || source === 'claim' ? 'Claim' : clientAccount ? 'Client account' : 'Payment voucher';

/** Four-digit year from an ISO date, "dd.mm.yyyy", "dd/mm/yyyy" or "dd-mm-yyyy" ('' when none). */
export const yearOf = (date?: string): string => {
  const s = String(date || '').trim();
  let m = /^(\d{4})-\d{2}/.exec(s);
  if (m) return m[1];
  m = /^\d{1,2}[./-]\d{1,2}[./-](\d{4})\b/.exec(s);
  if (m) return m[1];
  return '';
};

/** Years found in the items' dates, newest first. */
export const yearOptions = <T>(items: T[], dateOf: (t: T) => string | undefined): string[] =>
  Array.from(new Set(items.map((t) => yearOf(dateOf(t))).filter(Boolean))).sort((a, b) => b.localeCompare(a));

export interface YearTypeFilter { year: string; type: string }
/** 'All' (or '') matches everything for either filter. */
export const matchesYearType = (item: { date?: string; docType: string }, f: YearTypeFilter): boolean =>
  (!f.year || f.year === 'All' || yearOf(item.date) === f.year) && (!f.type || f.type === 'All' || item.docType === f.type);

/** First Drive folder id recorded on any of the record's stored files. */
export const firstDriveFolderId = (...lists: (Array<{ driveFolderId?: string } | undefined> | undefined)[]): string => {
  for (const l of lists) for (const f of l || []) if (f?.driveFolderId) return f.driveFolderId;
  return '';
};
