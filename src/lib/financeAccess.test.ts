import { describe, expect, it } from 'vitest';
import { canSeeFinanceNav, canSeeFinanceView, FIN_TABS, FINANCE_VIEW_TO_TAB, finRoleKey, finTabsFor, isFinanceView } from './financeAccess';
import type { User } from '../types';

const OWNER = 'syafiqahhamizad@shcolaw.com';
const u = (p: Partial<User>) => p;

describe('finRoleKey', () => {
  it("owner partner (by email) → 'M'", () => expect(finRoleKey('Partner', u({ email: OWNER }), true)).toBe('M'));
  it("owner email match is case-insensitive → 'M'", () => expect(finRoleKey('Partner', u({ email: OWNER.toUpperCase() }), false)).toBe('M'));
  it("super admin partner (by flag) → 'M'", () => expect(finRoleKey('Partner', u({ email: 'p@example.com', isSuperAdmin: true }), false)).toBe('M'));
  it("admin partner who is not super admin stays 'P'", () => expect(finRoleKey('Partner', u({ email: 'p@example.com', isAdmin: true }), true)).toBe('P'));
  it("plain partner → 'P'", () => expect(finRoleKey('Partner', u({ email: 'p@example.com' }), false)).toBe('P'));
  it("owner email is not 'M' unless the role is Partner", () => {
    expect(finRoleKey('Lawyer', u({ email: OWNER, isSuperAdmin: true }), true)).toBe('S');
    expect(finRoleKey('Reviewer', u({ email: OWNER }), true)).toBe('R');
  });
  it("accounts roles → 'A'", () => {
    expect(finRoleKey('Accountant', undefined, false)).toBe('A');
    expect(finRoleKey('Accounts', undefined, false)).toBe('A');
    expect(finRoleKey('Accounts Executive', undefined, false)).toBe('A');
  });
  it("Reviewer → 'R'", () => expect(finRoleKey('Reviewer', undefined, false)).toBe('R'));
  it("Client → 'S' even with admin flags", () => expect(finRoleKey('Client', u({ isSuperAdmin: true }), true)).toBe('S'));
  it("other roles and unknown → 'S'", () => {
    expect(finRoleKey('Lawyer', undefined, false)).toBe('S');
    expect(finRoleKey('Assistant', undefined, true)).toBe('S');
    expect(finRoleKey(undefined, undefined, false)).toBe('S');
  });
  it('falls back to currentUser.role when currentRole is empty', () => {
    expect(finRoleKey(undefined, u({ role: 'Partner', email: OWNER }), false)).toBe('M');
    expect(finRoleKey('', u({ role: 'Reviewer' }), false)).toBe('R');
  });
  it('isAdmin argument alone never grants M', () => expect(finRoleKey('Partner', u({}), true)).toBe('P'));
});

describe('finance tabs per role', () => {
  const keys = (rk: Parameters<typeof finTabsFor>[0]) => finTabsFor(rk).map((t) => t[0]);
  it('Managing Partner sees every tab', () => expect(keys('M')).toEqual(FIN_TABS.map((t) => t[0])));
  it('Accounts sees every tab', () => expect(keys('A')).toEqual(FIN_TABS.map((t) => t[0])));
  it('Partner: billing, client account, approvals', () => expect(keys('P')).toEqual(['billing', 'trust', 'approvals']));
  it('Reviewer: client account + books & reports', () => expect(keys('R')).toEqual(['trust', 'reports']));
  it('Staff: nothing', () => expect(keys('S')).toEqual([]));
});

describe('canSeeFinanceView / isFinanceView', () => {
  it('every mapped view id is a finance view', () => {
    for (const id of Object.keys(FINANCE_VIEW_TO_TAB)) expect(isFinanceView(id)).toBe(true);
  });
  it('non-finance / prototype keys are not finance views', () => {
    expect(isFinanceView('cases')).toBe(false);
    expect(isFinanceView('toString')).toBe(false);
    expect(isFinanceView('__proto__')).toBe(false);
  });
  it('partner cannot open payroll or office account', () => {
    expect(canSeeFinanceView('payroll', 'P')).toBe(false);
    expect(canSeeFinanceView('officeAccounts', 'P')).toBe(false);
    expect(canSeeFinanceView('billing', 'P')).toBe(true);
    expect(canSeeFinanceView('quotations', 'P')).toBe(true);
  });
  it('reviewer: reports aliases and client account only', () => {
    expect(canSeeFinanceView('trialBalance', 'R')).toBe(true);
    expect(canSeeFinanceView('statement', 'R')).toBe(true);
    expect(canSeeFinanceView('billing', 'R')).toBe(false);
  });
  it('staff sees no finance view', () => {
    for (const id of Object.keys(FINANCE_VIEW_TO_TAB)) expect(canSeeFinanceView(id, 'S')).toBe(false);
  });
  it('unknown view → false', () => expect(canSeeFinanceView('nope', 'M')).toBe(false));
});

describe('canSeeFinanceNav', () => {
  it('Approvals is hidden for Accounts in the sidebar but open as a tab', () => {
    expect(canSeeFinanceNav('approvals', 'A')).toBe(false);
    expect(canSeeFinanceView('approvals', 'A')).toBe(true);
  });
  it('Approvals visible for MP and Partner', () => {
    expect(canSeeFinanceNav('approvals', 'M')).toBe(true);
    expect(canSeeFinanceNav('approvals', 'P')).toBe(true);
  });
  it('only sidebar view ids match (aliases do not)', () => {
    expect(canSeeFinanceNav('accountingCentre', 'M')).toBe(true);
    expect(canSeeFinanceNav('accounting', 'M')).toBe(false);
  });
});
