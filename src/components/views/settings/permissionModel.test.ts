import { describe, expect, it } from 'vitest';
import {
  can, peopleWho, canViewAs, designRole, flipBit, fromBits, isManagingPartner, isSuper, parentOf, PERM_ROWS, personBits, personChanges, personRoleBits, roleOwnBits, SUPER_EMAIL,
} from './permissionModel';
import type { RolePermissionsMatrix, User } from '../../../types';

const u = (p: Partial<User>) => p;
const V = { v: 1, a: 0, e: 0 }, VAE = { v: 1, a: 1, e: 1 }, NONE = { v: 0, a: 0, e: 0 };

const matrix = {
  Partner: { dashboard: VAE, cases: VAE, settings: V },
  Lawyer: { dashboard: V, cases: { v: 1, a: 1, e: 0 }, 'cases.overview': V },
  Assistant: { cases: V },
} as unknown as RolePermissionsMatrix;

const ADMIN_KEYS = ['settings', 'users', 'logs', 'hrRecords', 'settings.firm', 'settings.banks', 'settings.templates', 'settings.lists', 'settings.permissions'];

describe('isSuper / isManagingPartner', () => {
  it('super admin by email or flag', () => {
    expect(isSuper(u({ email: SUPER_EMAIL }))).toBe(true);
    expect(isSuper(u({ email: 'someone@example.com', isSuperAdmin: true }))).toBe(true);
    expect(isSuper(u({ email: 'someone@example.com', isAdmin: true }))).toBe(false);
    expect(isSuper(null)).toBe(false);
    expect(isSuper(undefined)).toBe(false);
  });
  it('Managing Partner requires Partner role AND super admin', () => {
    expect(isManagingPartner(u({ role: 'Partner', email: SUPER_EMAIL }))).toBe(true);
    expect(isManagingPartner(u({ role: 'Partner', isSuperAdmin: true }))).toBe(true);
  });
  it('a super admin who is not a Partner is not Managing Partner', () => {
    expect(isManagingPartner(u({ role: 'Lawyer', email: SUPER_EMAIL }))).toBe(false);
    expect(isManagingPartner(u({ role: 'Accountant', isSuperAdmin: true }))).toBe(false);
  });
  it('an admin (not super) partner is not Managing Partner', () => {
    expect(isManagingPartner(u({ role: 'Partner', isAdmin: true, email: 'p@example.com' }))).toBe(false);
  });
  it('null user is not Managing Partner', () => expect(isManagingPartner(null)).toBe(false));
});

describe('designRole', () => {
  it('maps MP, Reviewer and other roles', () => {
    expect(designRole(u({ role: 'Partner', email: SUPER_EMAIL }))).toBe('Super Admin');
    expect(designRole(u({ role: 'Partner' }))).toBe('Partner');
    expect(designRole(u({ role: 'Reviewer' }))).toBe('Reviewer (auditor)');
    expect(designRole(u({}))).toBe('');
  });
});

describe('bit helpers', () => {
  it('fromBits', () => {
    expect(fromBits('101')).toEqual({ v: 1, a: 0, e: 1 });
    expect(fromBits('000')).toEqual(NONE);
  });
  it('flipBit', () => {
    expect(flipBit('000', 0)).toBe('100');
    expect(flipBit('111', 2)).toBe('110');
  });
  it('parentOf', () => {
    expect(parentOf('cases.money')).toBe('cases');
    expect(parentOf('cases')).toBeUndefined();
    expect(parentOf('nope')).toBeUndefined();
  });
  it('hrRecords is a permission row', () => expect(PERM_ROWS.some((r) => r[0] === 'hrRecords')).toBe(true));
  it('every admin key is a permission row', () => {
    for (const k of ADMIN_KEYS) expect(PERM_ROWS.some((r) => r[0] === k), k).toBe(true);
  });
});

describe('roleOwnBits', () => {
  it('stored top-level cell', () => expect(roleOwnBits(matrix, 'Lawyer', 'cases')).toBe('110'));
  it('missing top-level cell = no access', () => expect(roleOwnBits(matrix, 'Lawyer', 'clients')).toBe('000'));
  it('stored sub-tab cell wins', () => expect(roleOwnBits(matrix, 'Lawyer', 'cases.overview')).toBe('100'));
  it('unmasked sub-tab falls back to its tab', () => expect(roleOwnBits(matrix, 'Lawyer', 'cases.tasks')).toBe('110'));
  it('masked sub-tab: allowed role inherits the tab', () => expect(roleOwnBits(matrix, 'Partner', 'cases.money')).toBe('111'));
  it('masked sub-tab: role outside the mask gets nothing', () => expect(roleOwnBits(matrix, 'Assistant', 'cases.money')).toBe('000'));
  it('money on the file: not for lawyers by default (billing is partners, Accounts, reviewers)', () => expect(roleOwnBits(matrix, 'Lawyer', 'cases.money')).toBe('000'));
  it("design default '000000' hides for every role", () => expect(roleOwnBits(matrix, 'Partner', 'dashboard.finance')).toBe('000'));
});

describe('personRoleBits / personBits', () => {
  const admin = u({ role: 'Lawyer', isAdmin: true, email: 'admin@example.com' });
  const lawyer = u({ role: 'Lawyer', email: 'lawyer@example.com' });
  const mp = u({ role: 'Partner', email: SUPER_EMAIL });

  it.each(ADMIN_KEYS)('admin always has full %s', (k) => expect(personRoleBits(matrix, admin, k)).toBe('111'));
  it('super admin (non-partner) gets admin keys in full too', () => {
    expect(personRoleBits(matrix, u({ role: 'Assistant', isSuperAdmin: true }), 'hrRecords')).toBe('111');
  });
  it('admin flag does not widen non-admin keys', () => expect(personRoleBits(matrix, admin, 'clients')).toBe('000'));
  it('non-admin has no hrRecords by default', () => expect(personRoleBits(matrix, lawyer, 'hrRecords')).toBe('000'));
  it('sub-tab is capped by its tab', () => {
    const m = { Lawyer: { cases: V, 'cases.tasks': VAE } } as unknown as RolePermissionsMatrix;
    expect(personRoleBits(m, lawyer, 'cases.tasks')).toBe('100');
  });
  it('Managing Partner gets everything', () => {
    for (const [k] of PERM_ROWS) expect(personBits(matrix, mp, k), k).toBe('111');
  });
  it('personal override replaces the role', () => {
    const p = u({ ...lawyer, navOverrides: { clients: VAE, cases: NONE } });
    expect(personBits(matrix, p, 'clients')).toBe('111');
    expect(personBits(matrix, p, 'cases')).toBe('000');
    expect(personBits(matrix, p, 'dashboard')).toBe('100');
  });
  it('overrides are ignored for the Managing Partner', () => {
    expect(personBits(matrix, u({ ...mp, navOverrides: { cases: NONE } }), 'cases')).toBe('111');
  });
});

describe('personChanges', () => {
  const lawyer = u({ role: 'Lawyer', email: 'lawyer@example.com' });
  it('counts only overrides that differ from the role', () => {
    expect(personChanges(matrix, u({ ...lawyer, navOverrides: { cases: { v: 1, a: 1, e: 0 }, clients: V } }))).toBe(1);
  });
  it('no overrides → 0', () => expect(personChanges(matrix, lawyer)).toBe(0));
  it('Managing Partner → 0', () => expect(personChanges(matrix, u({ role: 'Partner', email: SUPER_EMAIL, navOverrides: { cases: NONE } }))).toBe(0));
});

describe('client delete, conflict clearing and View as', () => {
  const m = { Partner: { clients: VAE }, Lawyer: { clients: VAE }, Assistant: { clients: VAE } } as unknown as RolePermissionsMatrix;
  it('only admins can delete clients, whatever the role', () => {
    expect(personBits(m, u({ role: 'Partner', email: 'p@example.com' }), 'clients.delete')).toBe('000');
    expect(personBits(m, u({ role: 'Assistant', email: 'a@example.com', isAdmin: true }), 'clients.delete')).toBe('111');
  });
  it('partners clear conflicts by default; lawyers do not unless granted', () => {
    expect(personBits(m, u({ role: 'Partner', email: 'p@example.com' }), 'clients.clearConflict')).not.toBe('000');
    expect(personBits(m, u({ role: 'Lawyer', email: 'l@example.com' }), 'clients.clearConflict')).toBe('000');
    expect(personBits(m, u({ role: 'Lawyer', email: 'l@example.com', navOverrides: { 'clients.clearConflict': VAE } }), 'clients.clearConflict')).toBe('111');
  });
  it('View as: Managing Partner always; an admin only if granted', () => {
    expect(canViewAs(m, u({ role: 'Partner', email: SUPER_EMAIL }))).toBe(true);
    expect(canViewAs(m, u({ role: 'Partner', email: 'z@example.com', isAdmin: true }))).toBe(false);
    expect(canViewAs(m, u({ role: 'Partner', email: 'z@example.com', navOverrides: { viewAs: V } }))).toBe(true);
  });
});

describe('office jobs on a file: you decide who', () => {
  const partner = { id: 'p', role: 'Partner', isAdmin: false, email: 'p@x', status: 'Active' } as User;
  const clerk = { id: 'a', role: 'Assistant', isAdmin: true, email: 'a@x', status: 'Active' } as User;
  it('partners by default; an admin assistant does not get it just for being admin', () => {
    const m = { Partner: { cases: { v: 1, a: 1, e: 1 } }, Assistant: { cases: { v: 1, a: 1, e: 1 } } } as unknown as RolePermissionsMatrix;
    for (const k of ['cases.approveClose', 'cases.reopen', 'cases.delete', 'clients.clearConflict']) {
      expect(can(m, partner, k)).toBe(k === 'clients.clearConflict' ? false : true);
      expect(can(m, clerk, k)).toBe(false);
    }
  });
  it('given to the assistant by role or by person', () => {
    const m = { Assistant: { cases: { v: 1, a: 1, e: 1 }, 'cases.approveClose': { v: 1, a: 1, e: 1 } } } as unknown as RolePermissionsMatrix;
    expect(can(m, clerk, 'cases.approveClose')).toBe(true);
    const one = { ...clerk, navOverrides: { 'cases.reopen': { v: 1, a: 0, e: 0 } } } as User;
    expect(can({} as RolePermissionsMatrix, one, 'cases.reopen')).toBe(true);
    expect(peopleWho(m, [partner, clerk], 'cases.approveClose').map((u) => u.id)).toEqual(['a']);
  });
});
