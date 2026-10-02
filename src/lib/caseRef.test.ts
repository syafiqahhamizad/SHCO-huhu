import { describe, expect, it } from 'vitest';
import { rebuildRef } from './caseRef';

const REF = 'SHC/SH-AH/NM/LIT/CIVIL/QAL/0001/08-2026';

describe('rebuildRef', () => {
  it('new partners + lawyer: dash-joined, SH first, tail kept', () => {
    expect(rebuildRef(REF, ['AH', 'SH'], 'ZA', ['LIT'])).toBe('SHC/SH-AH/ZA/LIT/CIVIL/QAL/0001/08-2026');
  });
  it('does not duplicate the old people codes', () => {
    const out = rebuildRef(REF, ['AH', 'SH'], 'ZA', ['LIT'])!;
    const people = out.split('/').slice(1, out.split('/').indexOf('LIT'));
    expect(people).toEqual(['SH-AH', 'ZA']);
    expect(out).not.toContain('NM');
  });
  it('replaces stale duplicated codes in the people slots', () => {
    expect(rebuildRef('SHC/SH-AH/SH/NM/LIT/QAL/0001/08-2026', ['SH', 'AH'], 'NM', ['LIT'])).toBe('SHC/SH-AH/NM/LIT/QAL/0001/08-2026');
  });
  it('same partners + lawyer → unchanged ref', () => {
    expect(rebuildRef(REF, ['SH', 'AH'], 'NM', ['LIT'])).toBe(REF);
  });
  it('anchors on the first matter code; later practice codes stay in the tail', () => {
    expect(rebuildRef(REF, ['SH'], 'NM', ['LIT', 'CIVIL', 'QAL'])).toBe('SHC/SH/NM/LIT/CIVIL/QAL/0001/08-2026');
  });
  it('matter-code match is case-insensitive', () => {
    expect(rebuildRef(REF, ['SH'], 'NM', ['lit'])).toBe('SHC/SH/NM/LIT/CIVIL/QAL/0001/08-2026');
  });
  it('old ref with one segment per person keeps that style', () => {
    expect(rebuildRef('SHC/SH/NM/LIT/QAL/0001/08-2026', ['AH', 'SH'], 'NM', ['LIT'])).toBe('SHC/SH/AH/NM/LIT/QAL/0001/08-2026');
  });
  it('no lawyer → lawyer slot dropped', () => {
    expect(rebuildRef(REF, ['AH'], '', ['LIT'])).toBe('SHC/AH/LIT/CIVIL/QAL/0001/08-2026');
  });
  it('no partners → partner slot dropped', () => {
    expect(rebuildRef(REF, [], 'NM', ['LIT'])).toBe('SHC/NM/LIT/CIVIL/QAL/0001/08-2026');
  });
  it('SHCO prefix supported', () => {
    expect(rebuildRef('SHCO/SH/NM/LIT/QAL/0001/08-2026', ['ZA'], 'NM', ['LIT'])).toBe('SHCO/ZA/NM/LIT/QAL/0001/08-2026');
  });
  it('does not mutate the partners array', () => {
    const partners = ['AH', 'SH'];
    rebuildRef(REF, partners, 'ZA', ['LIT']);
    expect(partners).toEqual(['AH', 'SH']);
  });
  it('null for non-SHC refs, missing matter code, or empty ref', () => {
    expect(rebuildRef('XYZ/SH/LIT/0001/08-2026', ['SH'], '', ['LIT'])).toBeNull();
    expect(rebuildRef('SHC/SH/FOO/0001/08-2026', ['SH'], '', ['LIT'])).toBeNull();
    expect(rebuildRef('', [], '', ['LIT'])).toBeNull();
    expect(rebuildRef('SHC/LIT/0001/08-2026', ['SH'], '', [])).toBeNull();
  });
});
