import { describe, expect, it } from 'vitest';
import { BUKKU_ADDED, BUKKU_RENAMES, expenseGL, GLA, glCode, travelClaimGL } from './financeModel';

describe("the accountant's (Bukku) chart of accounts", () => {
  it('reads portal and Bukku codes from GL account strings', () => {
    expect(glCode('1010 - Office Bank — General')).toBe('1010');
    expect(glCode('9A01-0000 - Advertising and marketing')).toBe('9A01-0000');
    expect(glCode('3500-0000-00 - HLB Office Account')).toBe('3500-0000-00');
    expect(glCode('9F04-000 - Statutory / regulatory fees')).toBe('9F04-000');
    expect(glCode('Office')).toBe('');
  });
  it('maps every portal account to a Bukku code, with no code used twice', () => {
    expect(BUKKU_RENAMES[glCode(GLA.office)].code).toBe('3500-0000-00');
    expect(BUKKU_RENAMES[glCode(GLA.ar)].code).toBe('3100-0000');
    expect(BUKKU_RENAMES[glCode(GLA.fees)].code).toBe('5000-1000');
    const codes = [...Object.values(BUKKU_RENAMES).map((x) => x.code), ...BUKKU_ADDED.map((x) => x.code)];
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('office expenses and staff claims post to the accountant’s expense accounts', () => {
    expect(glCode(expenseGL('Insurance'))).toBe('9I01-0000');
    expect(glCode(expenseGL('Rent'))).toBe('9R02-0000'); // older category names still land right (9R01 is Rounding loss)
    expect(glCode(expenseGL('Utilities'))).toBe('9W01-0000');
    expect(glCode('9R01-0000 - Rental')).toBe('9R02-0000'); // posted under the first mapping
    expect(glCode(expenseGL('Courier'))).toBe('9F03-0000');
    expect(expenseGL('EPF')).toBe(GLA.statutory);
    expect(expenseGL('Software')).toBe(GLA.software);
    expect(expenseGL('Other')).toBe(GLA.other);
    expect(glCode(travelClaimGL('Mileage'))).toBe('9T02-0002');
    expect(glCode(travelClaimGL('Parking'))).toBe('9T02-0001');
  });
});
