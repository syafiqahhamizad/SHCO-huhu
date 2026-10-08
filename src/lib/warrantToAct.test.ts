import { describe, expect, it } from 'vitest';
import { warrantToActHtml } from './warrantToAct';

describe('warrantToActHtml', () => {
  const base = { matterTitle: 'Test Client v Test Party', date: '9th day of October 2026', fileRef: 'SHC/SH/LIT/TC/001/10-26' };
  it('individual: details, side, numbered clauses, signature, witness and acceptance', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Client', type: 'Individual', idNo: '900101-01-1234', address: 'Kuala Lumpur' }, side: 'Plaintiff' });
    expect(h).toContain('WARRANT TO ACT');
    expect(h).toContain('I, <strong>Test Client</strong> (NRIC No. 900101-01-1234) of Kuala Lumpur');
    expect(h).toContain('as the Plaintiff');
    expect(h).toContain('Solicitors’ Account Rules 1990');
    expect(h).toContain('In the presence of');
    expect(h).toContain('ACCEPTANCE');
    expect(h).toContain('>6.</td>');
    expect(h).toContain('and I will inform the Firm');
  });
  it('court intitulement only when there is a suit', () => {
    const withSuit = warrantToActHtml({ ...base, client: { name: 'Test Client' }, court: 'High Court Shah Alam', suitNo: 'BA-22NCvC-1-01/2026', otherParty: 'Test Party', side: 'Plaintiff' });
    expect(withSuit).toContain('BETWEEN');
    expect(withSuit).toContain('HIGH COURT SHAH ALAM');
    expect(warrantToActHtml({ ...base, client: { name: 'Test Client' } })).not.toContain('BETWEEN');
  });
  it('company: authorised signatory and stamp; blanks for missing details', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Sdn Bhd', type: 'Corporate' } });
    expect(h).toContain('We, <strong>Test Sdn Bhd</strong> (Company No.');
    expect(h).toContain('by its authorised signatory');
    expect(h).toContain('Company stamp');
    expect(h).toContain('……');
  });
  it('escapes HTML in names', () => expect(warrantToActHtml({ ...base, client: { name: 'A & <B>' } })).toContain('A &amp; &lt;B&gt;'));
});
