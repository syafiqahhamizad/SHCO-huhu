/**
 * Office Account money set aside (design pack `Accounts and Finance.dc.html` → Office Account):
 * sinking funds, the emergency fund and the firm investment. Balances are always worked out from
 * movements; nothing here stores a total.
 */
import type { FundMove } from '../services/templateService';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Signed amount of one movement: withdrawals reduce, a value change can be negative. */
export const moveAmount = (m: Pick<FundMove, 'kind' | 'amount'>) => (m.kind === 'Withdrawal' ? -Math.abs(Number(m.amount) || 0) : Number(m.amount) || 0);
/** Balance / current value from movements. */
export const fundBalance = (log: Pick<FundMove, 'kind' | 'amount'>[] = []) => r2(log.reduce((s, m) => s + moveAmount(m), 0));
/** Money put in (deposits less withdrawals) and returns (dividends + value changes). */
export const investmentSummary = (log: Pick<FundMove, 'kind' | 'amount' | 'place'>[] = []) => {
  const putIn = r2(log.filter((m) => m.kind === 'Deposit' || m.kind === 'Withdrawal').reduce((s, m) => s + moveAmount(m), 0));
  const returns = r2(log.filter((m) => m.kind === 'Dividend' || m.kind === 'Value change').reduce((s, m) => s + moveAmount(m), 0));
  const byPlace = new Map<string, number>();
  log.forEach((m) => byPlace.set(m.place || 'Other', r2((byPlace.get(m.place || 'Other') || 0) + moveAmount(m))));
  return { putIn, returns, value: r2(putIn + returns), byPlace: [...byPlace.entries()].filter(([, v]) => Math.abs(v) > 0.004).sort((a, b) => b[1] - a[1]) };
};

interface SplitTarget { key: string; name: string; pct: number; target: number; balance: number }
interface SplitPart { key: string; name: string; pct: number; amount: number; full: boolean }
/**
 * Split one fee received across the funds by their Split %. A fund that has reached its target is
 * skipped (its share stays as free cash); no fund is filled past its target.
 */
export const splitFee = (amount: number, targets: SplitTarget[]) => {
  const parts: SplitPart[] = targets.filter((t) => t.pct > 0).map((t) => {
    const full = t.target > 0 && t.balance >= t.target - 0.004;
    const want = r2((amount * t.pct) / 100);
    const a = full ? 0 : t.target > 0 ? Math.min(want, r2(t.target - t.balance)) : want;
    return { key: t.key, name: t.name, pct: t.pct, amount: r2(Math.max(0, a)), full };
  });
  const used = r2(parts.reduce((s, p) => s + p.amount, 0));
  return { parts, used, rest: r2(amount - used) };
};
