import { describe, expect, it } from 'vitest';
import { warrantToActHtml, warrantClauses } from './warrantToAct';

describe('warrantToActHtml', () => {
  const base = { matterTitle: 'Test Client v Test Party', date: '9 October 2026', fileRef: 'SHC/SH/LIT/TC/001/10-26' };
  it('EN individual: the firm’s clauses translated, name and NRIC in the signature', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Client', type: 'Individual', idNo: '900101-01-1234', address: 'Kuala Lumpur' }, side: 'Plaintiff' });
    expect(h).toContain('WARRANT TO ACT');
    expect(h).toContain('I hereby authorise and appoint <strong>Messrs. Syafiqah Hamizad &amp; Co.,</strong>');
    expect(h).toContain('the initial payment <em>(retainer)</em> is non-refundable');
    expect(h).toContain('Rule 9.02 of the Bar Council Rules');
    for (const s of ['Authority', 'Legal fees and related disbursements', 'Termination of services', 'Indemnity', 'Limitation of liability']) expect(h).toContain(s);
    expect(h).toContain('Name: Test Client');
    expect(h).toContain('NRIC No.: 900101-01-1234');
    expect(h).toContain('Our Ref: SHC/SH/LIT/TC/001/10-26');
  });
  it('BM uses the firm’s own wording (Saya for an individual, Kami for a company)', () => {
    const h = warrantToActHtml({ ...base, lang: 'BM', client: { name: 'Test Client', type: 'Individual' } });
    expect(h).toContain('WARAN UNTUK BERTINDAK');
    expect(h).toContain('Saya dengan ini memberi kuasa dan melantik <strong>Tetuan Syafiqah Hamizad &amp; Co.,</strong>');
    expect(h).toContain('sepertimana Aturan 9.02 Kaedah Majlis Peguam');
    for (const s of ['Autoriti', 'Fi Guaman dan kos-kos pengeluaran berkaitan', 'Penamatan servis', 'Indemniti', 'Had Tanggungjawab', 'No. K/P.', 'Tarikh']) expect(h).toContain(s);
    expect(warrantToActHtml({ ...base, lang: 'BM', client: { name: 'Test Sdn Bhd', type: 'Corporate' } })).toContain('Kami dengan ini memberi kuasa');
    // Type unknown: as on the firm's form.
    expect(warrantClauses({ lang: 'BM', client: { name: 'X' } })[0][1]).toMatch(/^Saya\/Kami dengan ini/);
  });
  it('court heading only when there is a suit', () => {
    const withSuit = warrantToActHtml({ ...base, client: { name: 'Test Client' }, court: 'High Court Shah Alam', suitNo: 'BA-22NCvC-1-01/2026', otherParty: 'Test Party', side: 'Plaintiff' });
    expect(withSuit).toContain('IN THE MATTER OF HIGH COURT SHAH ALAM');
    expect(withSuit).toContain('SUIT NO.: BA-22NCvC-1-01/2026');
    expect(withSuit).toContain('TEST CLIENT (Plaintiff) V TEST PARTY');
    const noSuit = warrantToActHtml({ ...base, client: { name: 'Test Client' } });
    expect(noSuit).not.toContain('IN THE MATTER OF');
    expect(noSuit).toContain('TEST CLIENT V TEST PARTY');
  });
  it('company: signs for the company with designation and stamp; blanks for missing details', () => {
    const h = warrantToActHtml({ ...base, client: { name: 'Test Sdn Bhd', type: 'Corporate' } });
    expect(h).toContain('We hereby authorise');
    expect(h).toContain('For and on behalf of <strong>Test Sdn Bhd</strong>');
    expect(h).toContain('Designation');
    expect(h).toContain('Company stamp');
    expect(h).toContain('……');
  });
  it('letterhead goes on top when given', () => expect(warrantToActHtml({ ...base, client: { name: 'A' }, letterhead: '<div id="lh"></div>' }).startsWith('<div id="lh"></div>')).toBe(true));
  it('escapes HTML in names', () => expect(warrantToActHtml({ ...base, client: { name: 'A & <B>' } })).toContain('A &amp; &lt;B&gt;'));
});
