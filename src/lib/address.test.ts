import { describe, expect, it } from 'vitest';
import { formatAddress, parseAddress } from './address';

describe('address', () => {
  it('splits a one-line address into the usual parts', () => {
    expect(parseAddress('No.125-2 Jalan Lavender Heights 3, Pusat Perniagaan Lavender Heights, 70400 Seremban, Negeri Sembilan.')).toEqual({
      line1: 'No.125-2 Jalan Lavender Heights 3', line2: 'Pusat Perniagaan Lavender Heights', postcode: '70400', city: 'Seremban', state: 'Negeri Sembilan',
    });
  });
  it('drops "Malaysia", keeps extra lines in line 2, reads W.P. states', () => {
    expect(parseAddress('No. 39, Jalan 4/11 a, Seksyen 4 tambahan, 43650 Bandar Baru Bangi, Selangor, Malaysia')).toEqual({
      line1: 'No. 39', line2: 'Jalan 4/11 a, Seksyen 4 tambahan', postcode: '43650', city: 'Bandar Baru Bangi', state: 'Selangor',
    });
    expect(parseAddress('1 Jalan Ampang\n50450 Kuala Lumpur\nWilayah Persekutuan Kuala Lumpur').state).toBe('W.P. Kuala Lumpur');
  });
  it('prints in letter form, one part per line', () => {
    expect(formatAddress({ line1: 'No.125-2 Jalan Lavender Heights 3', line2: 'Pusat Perniagaan Lavender Heights', postcode: '70400', city: 'Seremban', state: 'Negeri Sembilan' }))
      .toBe('No.125-2 Jalan Lavender Heights 3,\nPusat Perniagaan Lavender Heights,\n70400 Seremban,\nNegeri Sembilan.');
    expect(formatAddress({ line1: 'Lot 5', line2: '', postcode: '', city: '', state: 'Perak' })).toBe('Lot 5,\nPerak.');
  });
  it('round-trips what it prints', () => {
    const a = { line1: 'No. 3B, Lot 12039-1', line2: 'Tingkat Cerang Guling', postcode: '21400', city: 'Marang', state: 'Terengganu' };
    expect(parseAddress(formatAddress(a))).toEqual(a);
  });
});
