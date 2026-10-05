import { describe, expect, it } from 'vitest';
import { opposingPartiesOf, registrationConflicts } from './conflictUtils';
import type { Case, Client } from '../types';

const k = { id: 'CS-1', ref: 'REF/1', title: 'A v B', opposingParty: "Rahimah Binti Sa'ad & Ors", opposingPartiesList: [{ id: 'p', name: 'Teguh Jaya Construction Sdn Bhd', role: '1st Defendant', icOrRegNo: '201201022514' }], caseParties: [] } as unknown as Case;
const clients = [{ id: 'C-1', name: 'Mega Holdings Berhad', type: 'Corporate', registrationNo: '199801012345' }] as Client[];

describe('registration conflict check', () => {
  it('reads every opposing-party field', () => expect(opposingPartiesOf(k)).toEqual(['Teguh Jaya Construction Sdn Bhd', "Rahimah Binti Sa'ad & Ors"]));
  it('opposing party, punctuation ignored', () => expect(registrationConflicts({ name: 'Rahimah binti Saad' }, clients, [k]).length).toBe(1));
  it('existing client by name', () => expect(registrationConflicts({ name: 'Mega Holdings' }, clients, [k])[0]).toContain('already a client (C-1)'));
  it('existing client by SSM no.', () => expect(registrationConflicts({ name: 'Other Co', idNo: '199801-012345' }, clients, [k])[0]).toContain('C-1'));
  it('no match', () => expect(registrationConflicts({ name: 'Siti Hajar binti Ahmad' }, clients, [k])).toEqual([]));
});
