/**
 * Fee sharing (design pack `Accounts and Finance.dc.html` → Payroll › Fee sharing, shcoPay.compute).
 * On professional fees COLLECTED in the month (SST and disbursements left out):
 *   - one person brought the file in AND is its only handler → `own`% to them, rest to the firm;
 *   - otherwise the introducer gets `intro`% (referral) and the handlers share `hand`% (equal, or
 *     the % set for that file); the rest stays with the firm.
 * People paid "Salary only" take no share (it stays with the firm). After office costs, the firm's
 * share is split between the partners by their %. Pure: amounts come from real receipts.
 */
export type PersonType = 'Owner' | 'Partner' | 'Associate' | 'Staff';
export const PARTNER_PAYS = ['Profit share only', 'Monthly salary + profit share', 'Monthly drawing + profit share'] as const;
export const STAFF_PAYS = ['Salary + fee sharing', 'Salary only', 'Fee sharing only'] as const;

export interface FsRules { own: number; intro: number; hand: number }
export const DEFAULT_RULES: FsRules = { own: 70, intro: 20, hand: 50 };

export interface FsPerson { id: string; code: string; name: string; t: PersonType; pay: string; sal: number; ded: Record<string, number> }
export interface FsFile { id: string; ref: string; client: string; matter: string; amount: number; intro: string; hands: string[]; cu?: Record<string, number>; rules?: FsRules }
export interface FsRow extends FsFile { sh: Record<string, number>; firm: number; firmPct: number; rf: FsRules; custom: boolean; sumOk: boolean }
export interface FsTotals { amt: number; ref: number; files: [string, string, string, number, number][]; refFiles: [string, string, number, number, number][] }

const r2 = (n: number) => Math.round(n * 100) / 100;
export const isPartnerType = (t: string) => t === 'Owner' || t === 'Partner';
const takesShare = (p?: FsPerson) => !!p && (isPartnerType(p.t) || p.pay !== 'Salary only');

export function computeFeeSharing(people: FsPerson[], files: FsFile[], rules: FsRules = DEFAULT_RULES, opts: { psplit?: Record<string, number>; costs?: number } = {}) {
  const P = new Map(people.map((p) => [p.id, p] as [string, FsPerson]));
  const tot: Record<string, FsTotals> = {};
  people.forEach((p) => { tot[p.id] = { amt: 0, ref: 0, files: [], refFiles: [] }; });
  let firm = 0;
  const rows: FsRow[] = files.map((f) => {
    const rf = { ...rules, ...(f.rules || {}) };
    const A = Number(f.amount) || 0, sh: Record<string, number> = {};
    const add = (id: string, v: number) => { if (!takesShare(P.get(id))) return; sh[id] = (sh[id] || 0) + v; };
    const hands = f.hands.filter((h) => P.has(h)); const intro = f.intro && P.has(f.intro) ? f.intro : '';
    const cu = f.cu || {}; const eq = hands.length ? 100 / hands.length : 0;
    const used = hands.reduce((t, c) => t + (cu[c] != null ? cu[c] : eq), 0);
    if (hands.length === 1 && intro === hands[0]) add(intro, (A * rf.own) / 100);
    else {
      if (intro) { add(intro, (A * rf.intro) / 100); if (takesShare(P.get(intro))) { tot[intro].ref = r2(tot[intro].ref + (A * rf.intro) / 100); tot[intro].refFiles.push([f.ref, f.client, A, rf.intro, r2((A * rf.intro) / 100)]); } }
      hands.forEach((c) => add(c, (((A * rf.hand) / 100) * (cu[c] != null ? cu[c] : eq)) / 100));
    }
    Object.keys(sh).forEach((c) => { sh[c] = r2(sh[c]); tot[c].amt = r2(tot[c].amt + sh[c]); tot[c].files.push([f.ref, f.client, c === intro && hands.includes(c) ? 'brought in & handled' : c === intro ? 'brought in' : 'handled', A, sh[c]]); });
    const paid = Object.values(sh).reduce((t, v) => t + v, 0);
    const fa = r2(A - paid); firm += fa;
    return { ...f, intro, hands, sh, firm: fa, firmPct: A ? r2((fa / A) * 100) : 0, rf, custom: !!f.rules, sumOk: !hands.length || Math.abs(used - 100) < 0.01 };
  });
  firm = r2(firm);
  const partners = people.filter((p) => isPartnerType(p.t));
  const eqS = r2(100 / (partners.length || 1));
  const SPL: Record<string, number> = {};
  partners.forEach((x, i) => { const v = opts.psplit?.[x.id]; SPL[x.id] = v != null ? Number(v) || 0 : i === 0 ? r2(100 - eqS * (partners.length - 1)) : eqS; });
  const costs = Number(opts.costs) || 0;
  const firmProfit = r2(firm - costs), dist = Math.max(0, firmProfit);
  const splitSum = r2(Object.values(SPL).reduce((t, v) => t + v, 0));
  const pp: Record<string, { mode: string; feeOnly: number; fsh: number; pct: number; base: number; baseLabel: string; fee: number; top: number; topLabel: string; carried: number; gross: number; ded: [string, number][]; dT: number; net: number }> = {};
  partners.forEach((x) => {
    const fsh = r2((dist * SPL[x.id]) / 100), fee = r2(tot[x.id].amt + fsh), sal = Number(x.sal) || 0, mode = x.pay, D = x.ded || {};
    const base = mode === 'Profit share only' ? 0 : sal;
    const top = mode === 'Monthly drawing + profit share' ? Math.max(0, r2(fee - sal)) : fee;
    const carried = mode === 'Monthly drawing + profit share' ? Math.min(0, r2(fee - sal)) : 0;
    const gross = r2(base + top);
    const ded: [string, number][] = [['EPF (i-Saraan, voluntary)', Number(D.epf) || 0], ['Tax instalment (CP500)', Number(D.cp500) || 0], ['Zakat', Number(D.zakat) || 0], ['Advance recovered', Number(D.adv) || 0]];
    const dT = r2(ded.reduce((t, d) => t + d[1], 0));
    pp[x.id] = { mode, feeOnly: tot[x.id].amt, fsh, pct: SPL[x.id], base, baseLabel: mode === 'Monthly salary + profit share' ? "Monthly partner's salary" : mode === 'Monthly drawing + profit share' ? 'Monthly drawing (advance on share)' : '', fee, top, topLabel: mode === 'Monthly drawing + profit share' ? 'Profit share above drawing' : 'Profit share (fee sharing)', carried, gross, ded, dT, net: r2(gross - dT) };
  });
  return { rows, tot, firm, total: r2(files.reduce((t, f) => t + (Number(f.amount) || 0), 0)), SPL, costs, firmProfit, dist, splitSum, splitOk: !partners.length || Math.abs(splitSum - 100) < 0.01, pp, allOk: rows.every((r) => r.sumOk) };
}
export type FeeSharingResult = ReturnType<typeof computeFeeSharing>;
