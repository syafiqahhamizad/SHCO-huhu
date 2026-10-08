import { describe, expect, it } from 'vitest';
import { computeFeeSharing, type FsPerson } from './feeSharing';

const P = (id: string, t: FsPerson['t'], pay: string, sal = 0): FsPerson => ({ id, code: id.toUpperCase(), name: id, t, pay, sal, ded: {} });
const people = [P('sh', 'Owner', 'Profit share only'), P('za', 'Partner', 'Monthly drawing + profit share', 5000), P('dh', 'Associate', 'Salary + fee sharing', 4800), P('nr', 'Staff', 'Salary only', 3900)];

describe('computeFeeSharing', () => {
  it('brought in & handled alone → own % (70) to them, 30% firm', () => {
    const r = computeFeeSharing(people, [{ id: 'c1', ref: 'R1', client: 'X', matter: '', amount: 10000, intro: 'dh', hands: ['dh'] }]);
    expect(r.rows[0].sh).toEqual({ dh: 7000 });
    expect(r.firm).toBe(3000);
  });
  it('introducer 20% + handlers 50% split equally; Salary only takes nothing', () => {
    const r = computeFeeSharing(people, [{ id: 'c2', ref: 'R2', client: 'Y', matter: '', amount: 10000, intro: 'nr', hands: ['sh', 'dh'] }]);
    expect(r.rows[0].sh).toEqual({ sh: 2500, dh: 2500 });
    expect(r.firm).toBe(5000);
    expect(r.tot.nr.ref).toBe(0);
  });
  it('custom handler % must add up to 100', () => {
    const r = computeFeeSharing(people, [{ id: 'c3', ref: 'R3', client: 'Z', matter: '', amount: 1000, intro: '', hands: ['sh', 'dh'], cu: { sh: 70, dh: 20 } }]);
    expect(r.rows[0].sumOk).toBe(false);
    expect(r.allOk).toBe(false);
  });
  it('firm profit after costs is split between partners; drawing carried when share is below it', () => {
    const r = computeFeeSharing(people, [{ id: 'c4', ref: 'R4', client: 'W', matter: '', amount: 10000, intro: '', hands: ['dh'] }], undefined, { costs: 3000, psplit: { sh: 60, za: 40 } });
    expect(r.firm).toBe(5000);
    expect(r.firmProfit).toBe(2000);
    expect(r.pp.sh.fsh).toBe(1200);
    expect(r.pp.za.fsh).toBe(800);
    expect(r.pp.za.base).toBe(5000);
    expect(r.pp.za.carried).toBe(-4200);
    expect(r.splitOk).toBe(true);
  });
  it('costs above the firm share leave nothing to split', () => {
    const r = computeFeeSharing(people, [{ id: 'c5', ref: 'R5', client: 'V', matter: '', amount: 1000, intro: '', hands: [] }], undefined, { costs: 5000 });
    expect(r.firm).toBe(1000);
    expect(r.dist).toBe(0);
  });
});
