import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { approverCode, approverPool, resolveApproval, ruleLabel } from './approvers';

const u = (id: string, name: string, role: User['role'], extra: Partial<User> = {}): User => ({ id, name, email: id + '@x.com', role, status: 'Active', ...extra }) as User;
const users = [
  u('a', 'Amer Haiqal', 'Partner', { code: 'AH' }),
  u('s', 'Syafiqah Hamizad', 'Partner', { code: 'SH', isSuperAdmin: true }),
  u('n', 'Nor Rashidah', 'Accountant'),
  u('l', 'Danial Hakim', 'Lawyer', { code: 'DH' }),
  u('z', 'Zulaikha Afendi', 'Partner', { code: 'ZA', status: 'Inactive' }),
];

describe('approvers', () => {
  it('pool: active partners and accountants, Super Admin first', () => {
    expect(approverPool(users).map((x) => x.id)).toEqual(['s', 'a', 'n']);
  });
  it('codes fall back to initials', () => expect(approverCode(users[2])).toBe('NR'));
  it('labels', () => {
    expect(ruleLabel(['SH'], 0)).toBe('SH');
    expect(ruleLabel(['SH', 'ZA', 'AH'], 0)).toBe('SH, ZA & AH');
    expect(ruleLabel(['SH', 'ZA', 'AH'], 1)).toBe('any 1 of SH, ZA, AH');
  });
  it('not set up = null (existing routing stays)', () => {
    expect(resolveApproval('claims', users, undefined)).toBeNull();
    expect(resolveApproval('claims', users, { claims: { approvers: ['l', 'z'], need: 1 } })).toBeNull();
  });
  it('resolves people, need capped, lawyers and switched-off people dropped', () => {
    const r = resolveApproval('leave', users, { leave: { approvers: ['s', 'a', 'l'], need: 5 } });
    expect(r?.people.map((x) => x.id)).toEqual(['s', 'a']);
    expect(r?.need).toBe(2);
    expect(r?.label).toBe('SH & AH');
  });
});
