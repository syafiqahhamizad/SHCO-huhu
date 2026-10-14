import { describe, expect, it } from 'vitest';
import {
  clientFolderName, driveSafeName, financeFolderPath, financeKindFromOwner, financeMatterPath, matterFolderName, matterFolderPath,
  matterNumber, matterSubFor, matterSubfolders, practiceFolderName, uploadFolders, staffFolderName,
} from './driveLayout';
import { financeDocType, firstDriveFolderId, matchesYearType, yearOf, yearOptions } from './claimFilters';

describe('driveSafeName', () => {
  it('strips characters Drive dislikes', () => {
    expect(driveSafeName('A/B\\C: "x" <y>|z?*')).toBe('A-B-C x y z');
    expect(driveSafeName('  ..hidden.. ')).toBe('hidden');
    expect(driveSafeName('')).toBe('unnamed');
  });
});

describe('matter folders', () => {
  it('pads the running number to 3 digits', () => {
    expect(matterNumber('SHC/L/SH/7/08-2026')).toBe('007');
    expect(matterNumber('SHC/L/SH/1234/08-2026')).toBe('1234');
    expect(matterNumber('no number here')).toBe('');
  });
  it('names the folder "<NNN> - <title>"', () => {
    expect(matterFolderName('SHC/L/SH/42/08-2026', 'Ali v. Bank: Suit')).toBe('042 - Ali v. Bank Suit');
    expect(matterFolderName('ODD-REF', 'Title')).toBe('ODD-REF - Title');
  });
  it('puts the matter under its practice area, renamed when set', () => {
    const m = { ref: 'SHC/CONV/SH/3/01-2026', title: 'SPA Lot 5', practiceArea: 'Conveyancing' };
    expect(matterFolderPath(m)).toEqual(['Case files', 'Conveyancing', '003 - SPA Lot 5']);
    expect(matterFolderPath(m, { Conveyancing: 'Property & Conveyancing' })).toEqual(['Case files', 'Property & Conveyancing', '003 - SPA Lot 5']);
    expect(practiceFolderName('', {})).toBe('Other');
    expect(practiceFolderName('Civil Litigation', { 'Civil Litigation': '  ' })).toBe('Civil Litigation');
  });
  it('routes documents to the firm\'s own folders by practice area, or Finance', () => {
    expect(matterSubFor('Filing')).toBe('Cause Papers');
    expect(matterSubFor('Service')).toBe('Correspondences/Acknowledgment');
    expect(matterSubFor('Court memo')).toBe('Court Memo');
    expect(matterSubFor('Signed letter of engagement')).toBe('Letter of Engagement');
    expect(matterSubFor('Engagement & Billing')).toBe('finance');
    expect(matterSubFor('Quotation')).toBe('finance');
    expect(matterSubFor('Client Documents')).toBe('Documents');
    expect(matterSubFor(undefined)).toBe('Correspondences');
    expect(matterSubFor('Court memo', 'Conveyancing')).toBe('Correspondences');
    expect(matterSubFor('Filing', 'Corporate')).toBe('Correspondences');
    expect(matterSubFor('SPA', 'Conveyancing')).toBe('Documents');
    expect(matterSubFor('Shareholders agreement', 'Corporate')).toBe('Agreement');
  });
  it('each practice area gets its own sub-folders', () => {
    expect(matterSubfolders('Civil Litigation')).toEqual(['Cause Papers', 'Cause Papers/Draft', 'Cause Papers/Extracted', 'Correspondences', 'Correspondences/Draft', 'Documents', 'Documents/Due Diligence']);
    expect(matterSubfolders('Estate Administration')).toEqual(matterSubfolders('Civil Litigation'));
    expect(matterSubfolders('Conveyancing')).toEqual(['Documents', 'Documents/Due Diligence', 'Correspondences', 'Correspondences/Draft']);
    expect(matterSubfolders('Corporate')).toEqual(['Agreement', 'Agreement/Draft', 'Correspondences', 'Correspondences/Draft', 'Documents', 'Documents/Due Diligence']);
    expect(uploadFolders('Civil Litigation')).toEqual(['Cause Papers', 'Cause Papers/Draft', 'Cause Papers/Extracted', 'Correspondences', 'Correspondences/Draft', 'Documents', 'Documents/Due Diligence', 'Correspondences/Acknowledgment', 'Court Memo', 'Letter of Engagement']);
    expect(matterSubFor('Extracted order')).toBe('Cause Papers/Extracted');
    expect(matterSubFor('Draft letter to court')).toBe('Correspondences/Draft');
    expect(matterSubFor('Land search', 'Conveyancing')).toBe('Documents/Due Diligence');
    expect(matterSubFor('Draft SOC')).toBe('Cause Papers/Draft');
    expect(matterSubFor('Draft SHA', 'Corporate')).toBe('Agreement/Draft');
    expect(uploadFolders('Corporate')).not.toContain('Court Memo');
  });
  it('keeps engagement papers in Finance/Files', () => {
    expect(financeMatterPath({ ref: 'SHC/L/SH/9/01-2026', title: 'X' })).toEqual(['Files', '009 - X']);
  });
});

describe('client, staff and finance folders', () => {
  it('names clients and staff "<ID> - <Name>"', () => {
    expect(clientFolderName('Ali bin Abu', 'CL-0012')).toBe('CL-0012 - Ali bin Abu');
    expect(staffFolderName({ staffId: 'S007', name: 'Siti' })).toBe('S007 - Siti');
    expect(staffFolderName({ email: 'a@shcolaw.com' })).toBe('a@shcolaw.com');
  });
  it('builds finance paths by year', () => {
    expect(financeFolderPath('claim', 2026, 'CF-26-0001')).toEqual(['2026', 'Claims', 'CF-26-0001']);
    expect(financeFolderPath('pv', '2026', 'PV-1')).toEqual(['2026', 'Payment Vouchers', 'PV-1']);
    expect(financeFolderPath('bankin', '2026', 'OR-1')).toEqual(['2026', 'Bank-in Proofs']);
    expect(financeFolderPath('clientAccount', '2025')).toEqual(['2025', 'Client Account']);
  });
  it('reads the finance kind from a proof owner', () => {
    expect(financeKindFromOwner('pv:PV-26-1')).toEqual({ kind: 'pv', ref: 'PV-26-1' });
    expect(financeKindFromOwner('travel:TC-1')).toEqual({ kind: 'claim', ref: 'TC-1' });
    expect(financeKindFromOwner('OR-26-5')).toEqual({ kind: 'bankin', ref: 'OR-26-5' });
    expect(financeKindFromOwner('form')).toEqual({ kind: 'bankin', ref: '' });
    expect(financeKindFromOwner('journal:JV-1')).toEqual({ kind: 'bankin', ref: 'JV-1' });
  });
});

describe('year / type filters', () => {
  it('reads years from ISO and Malaysian dates', () => {
    expect(yearOf('2026-03-04')).toBe('2026');
    expect(yearOf('2026-03-04T10:00:00Z')).toBe('2026');
    expect(yearOf('04.03.2025')).toBe('2025');
    expect(yearOf('4/3/2024')).toBe('2024');
    expect(yearOf('')).toBe('');
  });
  it('lists years newest first', () => {
    expect(yearOptions([{ d: '2025-01-01' }, { d: '2026-02-02' }, { d: '2025-05-05' }, { d: '' }], (x) => x.d)).toEqual(['2026', '2025']);
  });
  it('classifies and filters', () => {
    expect(financeDocType('travel')).toBe('Claim');
    expect(financeDocType('pv', false)).toBe('Payment voucher');
    expect(financeDocType('pv', true)).toBe('Client account');
    const item = { date: '2026-05-01', docType: 'Claim' };
    expect(matchesYearType(item, { year: 'All', type: 'All' })).toBe(true);
    expect(matchesYearType(item, { year: '2026', type: 'Claim' })).toBe(true);
    expect(matchesYearType(item, { year: '2025', type: 'All' })).toBe(false);
    expect(matchesYearType(item, { year: 'All', type: 'Payment voucher' })).toBe(false);
  });
  it('finds a Drive folder on stored files', () => {
    expect(firstDriveFolderId([{}], undefined, [{ driveFolderId: 'abc' }])).toBe('abc');
    expect(firstDriveFolderId([])).toBe('');
  });
});
