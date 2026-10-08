/**
 * Finance approvals that follow Firm & Practice Settings → "Who approves" (lib/approvers) where an
 * item is set up, and the portal's existing finance rules where it is "Not set yet":
 *   - the owner (Super Admin) alone — owner's choice for now: payroll, referral fees, write-offs,
 *     fee sharing, partner pay, 3-way reconciliation, emergency fund, investment movements and
 *     client statements;
 *   - the owner + 1 more partner: client-account payments;
 *   - any partner: office payments and staff claims (two-signatory limit applied separately).
 * Signatures on settings-held approvals are a map keyed by the signer's code.
 */
import type { FinanceSignatory, User } from '../types';
import { approverCode, resolveApproval, type ApproverRule } from './approvers';

export type FinApprovalId = 'feeShare' | 'payroll' | 'partnerPay' | 'officePay' | 'clientPay' | 'recon' | 'referral' | 'claims' | 'writeOff' | 'emergency' | 'investment' | 'clientStmt';

export interface Signer { code: string; name: string; userId: string; isMP: boolean }
export interface FinRule {
  configured: boolean;
  people: Signer[];
  need: number;
  label: string;
  rule: string;
  mpRequired: boolean;
  count: (sign?: Record<string, unknown>) => number;
  done: (sign?: Record<string, unknown>) => boolean;
  canSign: (u?: Partial<User> | null) => boolean;
}

export const isManagingPartnerUser = (u?: Partial<User> | null) => !!u && u.role === 'Partner' && (!!u.isSuperAdmin || String(u.email || '').toLowerCase() === 'syafiqahhamizad@shcolaw.com');
const toSigner = (u: User): Signer => ({ code: approverCode(u), name: u.name, userId: u.id, isMP: isManagingPartnerUser(u) });

const labelOf = (codes: string[], need: number, mpCodes: string[], otherCodes: string[], mpRequired: boolean) => {
  if (!codes.length) return 'a partner';
  if (need >= codes.length) return codes.length === 1 ? codes[0] : codes.slice(0, -1).join(', ') + ' & ' + codes[codes.length - 1];
  if (mpRequired && mpCodes.length) return `${mpCodes.join(', ')} + ${need - 1} of ${otherCodes.join(', ')}`;
  return `any ${need} of ${codes.join(', ')}`;
};

const MP_ONLY: FinApprovalId[] = ['payroll', 'referral', 'writeOff', 'feeShare', 'partnerPay', 'recon', 'emergency', 'investment', 'clientStmt'];
const MP_PLUS_ONE: FinApprovalId[] = ['clientPay'];

/** The rule for a finance approval: the "Who approves" list when set, else the defaults above. */
export function finRule(id: FinApprovalId, users: User[], rules?: Record<string, ApproverRule>): FinRule {
  const cfg = resolveApproval(id, users, rules);
  let people: Signer[]; let need: number; let mpRequired = false;
  if (cfg) { people = cfg.people.map(toSigner); need = cfg.need; }
  else {
    const active = users.filter((u) => u.status !== 'Inactive');
    const mp = active.filter(isManagingPartnerUser).map(toSigner);
    const partners = active.filter((u) => u.role === 'Partner' && !isManagingPartnerUser(u)).map(toSigner);
    if (MP_ONLY.includes(id)) { people = mp; need = 1; mpRequired = true; }
    else if (MP_PLUS_ONE.includes(id)) { people = [...mp, ...partners]; need = Math.min(2, Math.max(1, people.length)); mpRequired = mp.length > 0; }
    else { people = [...mp, ...partners]; need = 1; }
  }
  const codes = people.map((p) => p.code);
  const mpCodes = people.filter((p) => p.isMP).map((p) => p.code), others = people.filter((p) => !p.isMP).map((p) => p.code);
  const label = cfg ? cfg.label : labelOf(codes, need, mpCodes, others, mpRequired);
  const count = (sign?: Record<string, unknown>) => codes.filter((c) => sign && sign[c]).length;
  const done = (sign?: Record<string, unknown>) => people.length > 0 && count(sign) >= need && (!mpRequired || mpCodes.some((c) => sign && sign[c]));
  const canSign = (u?: Partial<User> | null) => !!u && people.some((p) => p.userId === u.id);
  return { configured: !!cfg, people, need, label, rule: 'needs approval from ' + label, mpRequired, count, done, canSign };
}

/**
 * One signature on a record approval (claims, vouchers, journals…) that IS set up in "Who approves".
 * Says whether `me` may sign and whether the approval is then complete. Signatures are matched by
 * user id (newer) or name (older ones).
 */
export function configuredSign(rule: FinRule, me: Pick<User, 'id' | 'name'>, signatories: FinanceSignatory[]): { ok: false; msg: string } | { ok: true; complete: boolean } {
  const norm = (s?: string) => String(s || '').trim().toLowerCase();
  const signedBy = (p: Signer) => signatories.some((s) => (s.userId ? s.userId === p.userId : norm(s.name) === norm(p.name)));
  const mine = rule.people.find((p) => p.userId === me.id);
  if (!mine) return { ok: false, msg: 'This needs approval from ' + rule.label + ' (Firm & Practice Settings › Who approves).' };
  if (signedBy(mine)) return { ok: false, msg: 'You have already signed this. It needs another signatory.' };
  const n = rule.people.filter((p) => p.userId === me.id || signedBy(p)).length;
  return { ok: true, complete: n >= rule.need };
}
