import { describe, expect, it } from 'vitest';
import { warrantToActHtml } from './warrantToAct';

describe('warrantToActHtml', () => {
  const base = { matterTitle: 'Test Client v Test Party', date: '1 Oct 2026', fileRef: 'SHC/SH/LIT/TC/001/10-26' };
  it('individual: name, NRIC, address and side filled in', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Client', type: 'Individual', idNo: '900101-01-1234', address: 'Kuala Lumpur' }, side: 'Plaintiff', court: 'High Court Shah Alam', suitNo: 'BA-22NCvC-1-01/2026' });
    expect(h).toContain('WARRANT TO ACT');
    expect(h).toContain('I, <strong>Test Client</strong> (NRIC No. 900101-01-1234)');
    expect(h).toContain('as the Plaintiff');
    expect(h).toContain('BA-22NCvC-1-01/2026');
  });
  it('company wording and blanks for missing details', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Sdn Bhd', type: 'Corporate' } });
    expect(h).toContain('We, <strong>Test Sdn Bhd</strong> (Company No. [company no.])');
    expect(h).toContain('[registered address]');
    expect(h).toContain('company stamp');
  });
  it('escapes HTML in names', () => expect(warrantToActHtml({ ...base, client: { name: 'A & <B>' } })).toContain('A &amp; &lt;B&gt;'));
});
