import React, { useState } from 'react';
import { Printer, Eye, FileDown, X } from 'lucide-react';
import type { Case, Client, Quotation, User } from '../../../types';
import { engagementLetterHtml, longDate, type DocLang, type EngagementInput, type FeeLine } from '../../../lib/engagementLetter';
import { AREAS, BANK, areaFromName, letterheadFor, loadLogos, pdf } from '../../../lib/financeDocs';
import { itemAmount, recordSstRate } from '../finance/financeModel';
import { courtOf, lawyersOf, staffOf } from './caseModel';
import { css } from './caseUi';

/** The file's branch: the branch of the lawyer in charge, else of the first partner on the file. */
export const branchOfCase = (c: Pick<Case, 'lawyerInCharge' | 'lawyers' | 'partners'> | undefined, users: User[] = []): string | undefined => {
  if (!c) return undefined;
  const staff = staffOf(users);
  const byName = (n: string) => users.find((u) => u.name.trim().toLowerCase() === n.trim().toLowerCase());
  const byCode = (code: string) => { const p = staff.find((x) => x.code === code); return p ? users.find((u) => u.id === p.id) : undefined; };
  const cands = [...lawyersOf(c as Case).map(byName), ...(c.partners || []).map((p) => byCode(String(p)))];
  return cands.find((u) => u && u.branch)?.branch;
};

/** Letter of Engagement input from the file, its client and (when there is one the viewer can
 * read) the file's quotation in Billing. No quotation → the letter says "as per our quotation". */
export const engagementInputFor = (kase: Case, client: Client | undefined, q: Quotation | undefined, users: User[] = [], lang: DocLang = 'EN', otherParty?: string): EngagementInput => {
  loadLogos();
  const staff = staffOf(users);
  const court = courtOf(kase);
  const fees = { prof: [] as FeeLine[], disb: [] as FeeLine[], reimb: [] as FeeLine[], sstRate: q ? recordSstRate(q) : 0 };
  (q?.lineItems || []).forEach((i) => {
    if ((i.category as string) === 'Tax') return;
    const row: FeeLine = [i.description || '', itemAmount(i)];
    (i.category === 'Disbursement' ? fees.disb : i.category === 'Reimbursement' ? fees.reimb : fees.prof).push(row);
  });
  const hasLines = fees.prof.length + fees.disb.length + fees.reimb.length > 0;
  const team: EngagementInput['team'] = [];
  const seen = new Set<string>();
  const add = (name: string | undefined, role: 'Partner' | 'Lawyer') => { const n = String(name || '').trim(); if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); team.push({ name: n, role }); } };
  (kase.partners || []).forEach((code) => add(staff.find((p) => p.code === String(code))?.name, 'Partner'));
  lawyersOf(kase).forEach((n) => add(staff.find((p) => p.name === n || p.code === n)?.name || n, staff.find((p) => p.name === n)?.isPartner ? 'Partner' : 'Lawyer'));
  const area = areaFromName(q?.practiceArea || kase.practiceArea || kase.type, kase.ref);
  return {
    lang,
    letterhead: letterheadFor(branchOfCase(kase, users)),
    quotationNo: hasLines ? q?.id : undefined,
    ourRef: kase.ref,
    yourRef: q?.yourRef && q.yourRef !== '-' ? q.yourRef : 'Kindly Advised',
    date: longDate(new Date(), lang),
    client: {
      name: client?.name || kase.clientName || q?.clientName || '',
      type: client?.type,
      idNo: client ? (client.type === 'Corporate' ? client.registrationNo : client.icNo || client.icNumber) : kase.clientsList?.[0]?.icOrRegNo,
      address: client?.address,
      email: client?.email,
      contactPerson: client?.contactPerson,
    },
    matter: { title: kase.title || q?.matter || '', court: court.name, suitNo: court.suit, side: kase.clientRole, otherParty: otherParty || kase.opposingParty || (kase.opposingParties || [])[0] },
    scope: (q?.scope && q.scope.trim()) || AREAS[area]?.desc || '',
    team,
    fees: q && hasLines ? fees : undefined,
    plan: q ? q.paymentPlan || (q.feeArrangement && q.feeArrangement.on ? { kind: 'Instalments', months: q.feeArrangement.months, upfront: q.feeArrangement.upfront } : { kind: 'Full' }) : undefined,
    instalmentTerms: q?.feeArrangement?.terms,
    bank: (q?.payInto === 'Client account' ? BANK['Client account'] : BANK.Office) as [string, string, string],
    firmName: 'Syafiqah Hamizad & Co',
  };
};

const BTN = 'display:inline-flex;align-items:center;gap:6px;border:1px solid #C9D1DC;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit';

/** EN / BM switch. */
export const LangToggle: React.FC<{ value: DocLang; onChange: (l: DocLang) => void }> = ({ value, onChange }) => (
  <span role="group" aria-label="Language" style={css('display:inline-flex;align-self:flex-start;border:1px solid #C9D1DC;border-radius:8px;overflow:hidden')}>
    {(['EN', 'BM'] as DocLang[]).map((l) => <button key={l} type="button" onClick={() => onChange(l)} aria-pressed={value === l} style={css(`border:0;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:${value === l ? '#16223A' : '#fff'};color:${value === l ? '#fff' : '#16223A'}`)}>{l === 'EN' ? 'English' : 'Bahasa Malaysia'}</button>)}
  </span>
);

/** View on screen, PDF and Print for one client document (same HTML for all three). */
const DocActions: React.FC<{ title: string; label: string; html: string; onDone?: (what: string) => void }> = ({ title, label, html, onDone }) => {
  const [open, setOpen] = useState(false);
  const file = title.replace(/[\\/:*?"<>|]+/g, '-');
  return (
    <>
      <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
        <button type="button" onClick={() => { setOpen(true); onDone?.('viewed'); }} style={css(BTN)}><Eye size={14} />View</button>
        <button type="button" onClick={() => { pdf(file, html); onDone?.('PDF'); }} title="Opens the print window; choose “Save as PDF”" style={css(BTN)}><FileDown size={14} />PDF</button>
        <button type="button" onClick={() => { pdf(file, html); onDone?.('printed'); }} style={css(BTN)}><Printer size={14} />Print</button>
      </div>
      {open && (
        <div role="dialog" aria-label={label} onClick={() => setOpen(false)} style={css('position:fixed;inset:0;z-index:80;background:rgba(22,34,58,.55);display:flex;flex-direction:column;align-items:center;padding:24px 16px;overflow:auto')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:820px;display:flex;flex-direction:column;gap:10px')}>
            <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
              <strong style={css('color:#fff;font-size:14px;margin-right:auto')}>{label}</strong>
              <button type="button" onClick={() => pdf(file, html)} style={css(BTN)}><FileDown size={14} />PDF</button>
              <button type="button" onClick={() => pdf(file, html)} style={css(BTN)}><Printer size={14} />Print</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={css(BTN)}><X size={14} /></button>
            </div>
            <div style={css('background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.3);padding:48px 56px;min-height:1000px;box-sizing:border-box;overflow-x:auto')} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      )}
    </>
  );
};

/** View, PDF and Print for the Letter of Engagement. */
export const EngagementLetterActions: React.FC<{ input: EngagementInput; onDone?: (what: string) => void }> = ({ input, onDone }) => {
  const name = input.lang === 'BM' ? 'Surat Perlantikan' : 'Letter of Engagement';
  return <DocActions title={name + ' ' + (input.ourRef || '')} label={name + (input.ourRef ? ' · ' + input.ourRef : '')} html={engagementLetterHtml(input)} onDone={onDone} />;
};
