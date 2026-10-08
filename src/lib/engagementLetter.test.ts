import { describe, expect, it } from 'vitest';
import { DEFAULT_LETTERHEAD_PARTNERS, authorityClauses, defaultPlanFor, engagementLetterHtml, feeTotals, longDate, planRows, planTotal, quotationForFile, schedule, type EngagementInput } from './engagementLetter';
import type { Quotation } from '../types';

const lh = { firmName: 'SYAFIQAH HAMIZAD & CO', tag1: 'Advocates & Solicitors', address: '8-23-03 Bangi Sentral', partners: DEFAULT_LETTERHEAD_PARTNERS };
const base: EngagementInput = {
  lang: 'EN', letterhead: lh, quotationNo: 'QUOT-26-0007', ourRef: 'SHC/SH/L/TC/001/10-26', date: '9 October 2026',
  client: { name: 'Test Client', type: 'Individual', idNo: '900101-01-1234', address: 'No. 1, Jalan Test\nKuala Lumpur', email: 'client@example.com' },
  matter: { title: 'Test Client v Test Party', court: 'High Court Shah Alam', suitNo: 'BA-22NCvC-1-01/2026', side: 'Plaintiff', otherParty: 'Test Party' },
  scope: 'Acting for the client in the suit.',
  team: [{ name: 'Nurul Syafiqah binti Hamizad', role: 'Partner' }, { name: 'Test Lawyer', role: 'Lawyer' }],
  fees: { prof: [['Professional fees', 10000]], disb: [['Filing fees', 100]], reimb: [['Printing', 200]], sstRate: 0.08 },
  plan: { kind: 'Stages', stages: [{ label: 'Filing', pct: 50, due: 'On signing' }, { label: 'Trial', pct: 50 }] },
  bank: ['Syafiqah Hamizad & Co', 'Hong Leong Bank Berhad', '36301134253'],
};

describe('payment plan', () => {
  it('litigation defaults to stages, others to full payment', () => {
    expect(defaultPlanFor('Civil Litigation').kind).toBe('Stages');
    expect(defaultPlanFor('Civil Litigation').stages!.map((s) => s.label)).toEqual(['Filing', 'Pleadings', 'Trial', 'Decision']);
    expect(defaultPlanFor('Conveyancing').kind).toBe('Full');
  });
  it('stages by % add up to the total (last row takes the rounding); RM rows are as typed', () => {
    const rows = planRows({ kind: 'Stages', stages: [{ label: 'A', pct: 33.33 }, { label: 'B', pct: 33.33 }, { label: 'C', pct: 33.34 }] }, 1000.01);
    expect(rows.map((r) => r.key)).toEqual(['stage:0', 'stage:1', 'stage:2']);
    expect(Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100).toBe(1000.01);
    const mixed = planRows({ kind: 'Stages', stages: [{ label: 'Deposit', amount: 2500 }, { label: 'Balance', pct: 50 }] }, 6000);
    expect(mixed.map((r) => r.amount)).toEqual([2500, 3000]);
    expect(planTotal({ kind: 'Stages', stages: [{ label: 'Deposit', amount: 2500 }, { label: 'Balance', pct: 50 }] }, 6000)).toBe(5500);
  });
  it('instalments reuse the monthly schedule; full payment is one row', () => {
    const rows = planRows({ kind: 'Instalments', months: 4, upfront: 1000 }, 4000);
    expect(rows.map((r) => r.amount)).toEqual(schedule(4000, 4, 1000).map(([, a]) => a));
    expect(rows[2].key).toBe('month:3');
    expect(planRows(undefined, 500)).toEqual([{ key: 'full', label: 'Full payment', amount: 500 }]);
  });
});

describe('engagementLetterHtml', () => {
  it('EN: letterhead with partners, bilingual refs, addressee, RE with court and parties, sections, authority clauses', () => {
    const h = engagementLetterHtml(base);
    expect(h).toContain('PARTNERS');
    expect(h).toContain('KHAIRUNNISA BINTI SHOBAT SETTIC');
    expect(h).toContain('SYARIE PARTNER');
    expect(h).toContain('Your Ref / <i>Rujukan Tuan</i>');
    expect(h).toContain('Our Ref / <i>Rujukan Kami</i>');
    expect(h).toContain('Date / <i>Tarikh</i>');
    expect(h).toContain('<b>TEST CLIENT</b><br>No. 1, Jalan Test<br>Kuala Lumpur');
    expect(h).toContain('Dear Sir/Madam,');
    expect(h).toContain('LETTER OF ENGAGEMENT');
    expect(h).not.toContain('QUOTATION &amp;');
    expect(h).toContain('IN THE MATTER OF HIGH COURT SHAH ALAM');
    expect(h).toContain('PLAINTIFF: TEST CLIENT');
    expect(h).toContain('DEFENDANT: TEST PARTY');
    expect(h).toContain('Nurul Syafiqah binti Hamizad');
    expect(h).toContain('fourteen (14) days');
    expect(h).toContain('Rule 9.02 of the Bar Council Rules');
    expect(h).toContain('laws of Malaysia');
    expect(h).toContain('for and on behalf of <b>SYAFIQAH HAMIZAD &amp; CO</b>');
    expect(h).toContain('I confirm that I have read and understood the contents of this Letter of Engagement');
    expect(h).toContain('AUTHORITY AND TERMS OF ENGAGEMENT');
    expect(h).toContain('I hereby authorise and appoint <strong>Messrs. Syafiqah Hamizad &amp; Co.,</strong>');
    expect(h).toContain('the initial payment <em>(retainer)</em> is non-refundable');
    for (const x of ['Authority.', 'Legal fees and related disbursements.', 'Termination of services.', 'Indemnity.', 'Limitation of liability.']) expect(h).toContain(x);
    // One document only: no separate warrant page or title.
    expect(h).not.toMatch(/warrant/i);
    expect(h).not.toContain('page-break-before');
    expect(h).not.toMatch(/Managing Partner/i);
    expect(h).not.toMatch(/\b(Mr|Ms|Mrs|Encik)\.? Test/);
  });
  it('fees come from the quotation lines, SST on fees + reimbursements only', () => {
    const t = feeTotals(base.fees!);
    expect(t).toMatchObject({ prof: 10000, disb: 100, reimb: 200, sst: 816, net: 10300, total: 11116 });
    const h = engagementLetterHtml(base);
    expect(h).toContain('Filing fees');
    expect(h).toContain('11,116.00');
    expect(h).toContain('5,558.00'); // 50% stage
    expect(h).toContain('Hong Leong Bank Berhad');
  });
  it('no quotation → "as per our quotation", no fee table or payment plan (never invented)', () => {
    const h = engagementLetterHtml({ ...base, fees: undefined, plan: undefined });
    expect(h).toContain('PROPOSED FEES');
    expect(h).toContain('as per our quotation');
    expect(h).not.toContain('PAYMENT PLAN');
    expect(h).not.toContain('AMOUNT (RM)');
    expect(h).not.toMatch(/RM ?[0-9]/);
    expect(h).not.toMatch(/[0-9],[0-9]{3}\.[0-9]{2}/);
    const bm = engagementLetterHtml({ ...base, lang: 'BM', fees: undefined, plan: undefined });
    expect(bm).toContain('seperti dalam sebut harga kami');
    expect(bm).not.toContain('PELAN PEMBAYARAN');
  });
  it('BM: Malay text and the firm’s own BM clauses inside the letter', () => {
    const h = engagementLetterHtml({ ...base, lang: 'BM', plan: { kind: 'Instalments', months: 3, upfront: 5000 } });
    expect(h).toContain('Tuan/Puan,');
    expect(h).toContain('SURAT PERLANTIKAN');
    expect(h).not.toContain('SEBUT HARGA &amp;');
    expect(h).toContain('DALAM PERKARA HIGH COURT SHAH ALAM');
    expect(h).toContain('Aturan 9.02 Kaedah Majlis Peguam');
    expect(h).toContain('ansuran bulanan selama tiga (3) bulan');
    expect(h).toContain('Bulan 1 (Bayaran Pendahuluan)');
    expect(h).toContain('Penyelesaian Awal');
    expect(h).toContain('Yang benar,');
    expect(h).not.toMatch(/waran/i);
    expect(h).toContain('Saya dengan ini memberi kuasa dan melantik <strong>Tetuan Syafiqah Hamizad &amp; Co.,</strong>');
    expect(h).toContain('sepertimana Aturan 9.02 Kaedah Majlis Peguam');
    for (const x of ['Autoriti.', 'Fi Guaman dan kos-kos pengeluaran berkaitan.', 'Penamatan servis.', 'Indemniti.', 'Had Tanggungjawab.']) expect(h).toContain(x);
    expect(h).toContain('Saya mengesahkan bahawa saya telah membaca dan memahami kandungan Surat Perlantikan ini');
    // Default litigation stages are printed in BM; stages the firm typed stay as typed.
    const st = engagementLetterHtml({ ...base, lang: 'BM', plan: defaultPlanFor('Civil Litigation') });
    expect(st).toContain('Pemfailan');
    expect(st).toContain('Selepas pliding ditutup');
    expect(engagementLetterHtml({ ...base, lang: 'BM', plan: { kind: 'Stages', stages: [{ label: 'Deposit kami', pct: 100 }] } })).toContain('>Deposit kami<');
  });
  it('company: attention line, authorised signatory, designation and company stamp', () => {
    const h = engagementLetterHtml({ ...base, client: { name: 'Test Sdn Bhd', type: 'Corporate', contactPerson: 'Ali bin Abu' }, plan: { kind: 'Full' } });
    expect(h).toContain('Attention: Ali bin Abu');
    expect(h).toContain('duly authorised signatory of <b>TEST SDN BHD</b>');
    expect(h).toContain('Company stamp');
    expect(h).toContain('We confirm that we have read and understood');
    expect(h).toContain('We hereby authorise and appoint');
    expect(h).toContain('payable in full');
  });
  it('without a suit the RE line is the matter title', () => {
    const h = engagementLetterHtml({ ...base, matter: { title: 'SPA Taman Bangi' } });
    expect(h).toContain('SPA TAMAN BANGI');
    expect(h).not.toContain('SUIT NO.');
  });
  it('long dates in both languages', () => {
    expect(longDate(new Date(2026, 7, 9), 'EN')).toBe('9 August 2026');
    expect(longDate(new Date(2026, 7, 9), 'BM')).toBe('9 Ogos 2026');
  });
});

describe('authorityClauses', () => {
  it('Kami for a company, Saya/Kami when the client type is unknown; escapes the firm name', () => {
    expect(authorityClauses({ lang: 'BM', client: { type: 'Corporate' } })[0][1]).toMatch(/^Kami dengan ini/);
    expect(authorityClauses({ lang: 'BM', client: {} })[0][1]).toMatch(/^Saya\/Kami dengan ini/);
    expect(authorityClauses({ client: {}, firmName: 'A & <B>' })[0][1]).toContain('A &amp; &lt;B&gt;');
    expect(authorityClauses({ client: {} }).map(([h]) => h)).toEqual(['Authority', 'Legal fees and related disbursements', 'Termination of services', 'Indemnity', 'Limitation of liability']);
  });
});

describe('quotationForFile', () => {
  const file = { id: 'CASE-1', ref: 'SHC/SH/L/TC/001/10-26' };
  const q = (id: string, p: Partial<Quotation>): Quotation => ({ id, date: '2026-10-01', practiceArea: '', fileRef: file.ref, leadId: '', clientName: '', status: 'Draft', total: 0, billedSoFar: 0, remaining: 0, courtLevel: '', stage: '', feeMethod: 'Template', subtype: '', approvalStatus: 'Pending', approvedBy: '', approvedDate: '', lineItems: [], ...p });
  it('accepted quotation first, else the latest not declined; proformas and other files never count', () => {
    const list = [q('Q1', { status: 'Accepted', date: '2026-09-01' }), q('Q2', { status: 'Sent', date: '2026-10-05' }), q('Q3', { status: 'Declined', date: '2026-10-08' }), q('P1', { documentType: 'Proforma', status: 'Accepted', date: '2026-10-09' }), q('X1', { status: 'Accepted', fileRef: 'OTHER', date: '2026-10-09' })];
    expect(quotationForFile(list, file)?.id).toBe('Q1');
    expect(quotationForFile(list.filter((x) => x.id !== 'Q1'), file)?.id).toBe('Q2');
    expect(quotationForFile([q('Q4', { fileRef: '', caseId: 'CASE-1' })], file)?.id).toBe('Q4');
    expect(quotationForFile([q('Q3', { status: 'Declined' })], file)).toBeUndefined();
    expect(quotationForFile([], file)).toBeUndefined();
    expect(quotationForFile(undefined, file)).toBeUndefined();
  });
});
