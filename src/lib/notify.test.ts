import { describe, expect, it } from 'vitest';
import type { Case, NotificationItem, User } from '../types';
import { isForMe, isReadBy, notificationEmail, resolveRecipients } from './notify';

const user = (id: string, name: string, role: User['role'], code?: string, extra: Partial<User> = {}) =>
  ({ id, name, role, code, email: id + '@shcolaw.com', status: 'Active', isAdmin: false, ...extra }) as User;
const users = [
  user('u1', 'Partner One', 'Partner', 'P1'),
  user('u2', 'Partner Two', 'Partner', 'P2'),
  user('u3', 'Lawyer Three', 'Lawyer', 'L3'),
  user('u4', 'Accounts Four', 'Accountant', 'A4'),
  user('u5', 'Gone Five', 'Lawyer', 'G5', { status: 'Inactive' }),
  user('u6', 'Client Six', 'Client'),
];
const cases = [{ id: 'CS-1', partners: ['P1'], lawyerInCharge: 'Lawyer Three', lawyers: ['Gone Five'] } as unknown as Case];
const ids = (list: User[]) => list.map((u) => u.id).sort();

describe('resolveRecipients', () => {
  it('file team = partners + lawyers, minus switched-off staff', () => expect(ids(resolveRecipients(['case:CS-1'], users, cases))).toEqual(['u1', 'u3']));
  it('file partners only', () => expect(ids(resolveRecipients(['partners:CS-1'], users, cases))).toEqual(['u1']));
  it('by role', () => expect(ids(resolveRecipients(['role:Partner'], users, cases))).toEqual(['u1', 'u2']));
  it('by name, code or e-mail, no duplicates', () => expect(ids(resolveRecipients(['Partner Two', 'P2', 'u4@shcolaw.com'], users, cases))).toEqual(['u2', 'u4']));
  it('the person who acted is left out', () => expect(ids(resolveRecipients(['role:Partner'], users, cases, 'u1'))).toEqual(['u2']));
  it('clients never get staff alerts', () => expect(ids(resolveRecipients(['Client Six'], users, cases))).toEqual([]));
  it('unknown file or name gives nobody', () => expect(resolveRecipients(['case:NOPE', 'Nobody'], users, cases)).toEqual([]));
});

describe('per-person visibility and read state', () => {
  const n = { id: 'n', title: 't', message: 'm', type: 'system', timestamp: '', read: false, to: ['u1'], readBy: ['u1'] } as NotificationItem;
  it('only the addressee sees it', () => { expect(isForMe(n, 'u1')).toBe(true); expect(isForMe(n, 'u2')).toBe(false); });
  it('read is per person', () => expect(isReadBy(n, 'u1')).toBe(true));
  it('older notifications show to everyone with the shared flag', () => {
    const old = { ...n, to: undefined, readBy: undefined, read: true };
    expect(isForMe(old, 'u2')).toBe(true); expect(isReadBy(old, 'u2')).toBe(true);
  });
});

describe('notificationEmail', () => {
  it('escapes HTML and links back to the portal', () => {
    const e = notificationEmail({ title: 'Claim <x>', message: 'A & B', from: 'P' }, 'https://portal.shcolaw.com');
    expect(e.subject).toBe('[SHCO Portal] Claim <x>');
    expect(e.html).toContain('Claim &lt;x&gt;');
    expect(e.html).toContain('A &amp; B');
    expect(e.text).toContain('https://portal.shcolaw.com');
  });
});
