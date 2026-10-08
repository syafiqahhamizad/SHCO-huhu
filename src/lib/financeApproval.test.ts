import { describe, expect, it } from 'vitest';
import { configuredSign, finRule } from './financeApproval';
import type { User } from '../types';

const U = (id: string, name: string, role: string, extra: Partial<User> = {}) => ({ id, name, role, status: 'Active', ...extra }) as User;
const users = [U('u1', 'Syafiqah Hamizad', 'Partner', { isSuperAdmin: true, code: 'SH' }), U('u2', 'Zulaikha Afendi', 'Partner', { code: 'ZA' }), U('u3', 'Amer Haiqal', 'Partner', { code: 'AH' }), U('u4', 'Nor Rashidah', 'Accountant', { code: 'NR' })];

describe('finRule fallback (Not set yet)', () => {
  it('payroll: Managing Partner only', () => {
    const r = finRule('payroll', users);
    expect(r.people.map((p) => p.code)).toEqual(['SH']);
    expect(r.done({ SH: true })).toBe(true);
    expect(r.configured).toBe(false);
  });
  it('recon, fee sharing, client statements: the owner alone (owner’s choice for now)', () => {
    for (const id of ['recon', 'feeShare', 'clientStmt', 'emergency'] as const) {
      const r = finRule(id, users);
      expect(r.need).toBe(1);
      expect(r.people.map((p) => p.code)).toEqual(['SH']);
      expect(r.done({ ZA: true, AH: true })).toBe(false);
      expect(r.done({ SH: true })).toBe(true);
    }
  });
  it('client-account payments: the owner + 1 partner', () => {
    const r = finRule('clientPay', users);
    expect(r.need).toBe(2);
    expect(r.done({ ZA: true, AH: true })).toBe(false);
    expect(r.done({ SH: true, ZA: true })).toBe(true);
  });
  it('office payments: any partner', () => {
    const r = finRule('officePay', users);
    expect(r.need).toBe(1);
    expect(r.canSign(users[2])).toBe(true);
    expect(r.canSign(users[3])).toBe(false);
  });
  it('nobody to sign → never done', () => expect(finRule('payroll', [users[3]]).done({})).toBe(false));
});

describe('finRule configured in Who approves', () => {
  const rules = { recon: { approvers: ['u2', 'u4'], need: 0 }, officePay: { approvers: ['u1', 'u2', 'u3'], need: 2 } };
  it('uses the list and need (0 = all)', () => {
    const r = finRule('recon', users, rules);
    expect(r.configured).toBe(true);
    expect(r.people.map((p) => p.code)).toEqual(['ZA', 'NR']);
    expect(r.done({ ZA: true })).toBe(false);
    expect(r.done({ ZA: true, NR: true })).toBe(true);
  });
  it('configuredSign: outsiders refused, completes on the Nth signer', () => {
    const r = finRule('officePay', users, rules);
    expect(configuredSign(r, users[3], []).ok).toBe(false);
    expect(configuredSign(r, users[1], [])).toEqual({ ok: true, complete: false });
    expect(configuredSign(r, users[2], [{ name: 'Zulaikha Afendi', at: '', isManagingPartner: false }])).toEqual({ ok: true, complete: true });
    expect(configuredSign(r, users[1], [{ name: 'x', userId: 'u2', at: '', isManagingPartner: false }]).ok).toBe(false);
  });
});
