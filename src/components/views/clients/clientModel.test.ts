import { describe, expect, it } from 'vitest';
import { kycOverall, kycRowOf, portalOf, requirementOf } from './clientModel';
import type { Client, KycDoc } from '../../../types';

const doc = (p: Partial<KycDoc>): KycDoc => ({ id: 'K' + Math.random(), name: 'f.pdf', type: '', uploadedDate: '2026-09-20', driveFolder: '', ...p });
const person = (kyc: KycDoc[], extra: Partial<Client> = {}) => ({ id: 'C1', name: 'A', type: 'Individual', kyc, ...extra }) as Client;

describe('KYC states', () => {
  it('missing', () => expect(kycRowOf(person([]), 'nric').state).toBe('Missing'));
  it('uploaded, waiting', () => expect(kycRowOf(person([doc({ requirement: 'nric', status: 'To verify' })]), 'nric').state).toBe('To verify'));
  it('verified', () => expect(kycRowOf(person([doc({ requirement: 'nric', status: 'Verified' })]), 'nric').state).toBe('Verified'));
  it('documents never expire', () => expect(kycRowOf(person([doc({ requirement: 'addr', status: 'To verify', uploadedDate: '2020-06-01' })]), 'addr').state).toBe('To verify'));
  it('verified 3-month document stays verified', () => expect(kycRowOf(person([doc({ requirement: 'addr', status: 'Verified', uploadedDate: '2026-01-01' })]), 'addr').state).toBe('Verified'));
  it('older upload matched by category; verified when CDD records verification', () => {
    const c = person([doc({ type: 'Identity (NRIC/Passport)' })], { cdd: { verifiedAt: '2026-01-01' } });
    expect(requirementOf(c.kyc[0], 'Individual')).toBe('nric');
    expect(kycRowOf(c, 'nric').state).toBe('Verified');
  });
  it('overall complete only when every required document is verified', () => {
    const all = ['nric', 'addr', 'sof'].map((r) => doc({ requirement: r, status: 'Verified' }));
    expect(kycOverall(person(all)).t).toBe('Complete');
    expect(kycOverall(person(all.slice(1))).t).toBe('Incomplete');
  });
});

describe('portal fallbacks', () => {
  it('older login → Active, everything visible', () => {
    const p = portalOf(person([], { portalAccessEnabled: true, email: 'a@b.c' }));
    expect(p.status).toBe('Active');
    expect(p.visibility).toEqual({ progress: true, documents: true, bills: true, statement: true, messages: true });
  });
  it('no record → Not set up', () => expect(portalOf(person([])).status).toBe('Not set up'));
});
