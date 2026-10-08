import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css } from './financeModel';

/** "How money moves, A to Z" — design pack `Finance Workflow (guide).dc.html` (wording as designed). */
const W: Record<string, [string, string]> = { Client: ['#F0F2F5', '#5B6478'], Lawyer: ['#E7EEF6', '#2F5680'], Accounts: ['#E6EFE9', '#2F6F4E'], Partner: ['#FBF2E9', '#8A6534'], MP: ['#F7E9EE', '#8C2F4C'], Staff: ['#E7EEF6', '#2F5680'], System: ['#F1EBF6', '#6B3D8C'] };
const R: Record<string, [string, string, string]> = { c: ['#2F6F4E', 'Client money', '#2F6F4E'], o: ['#16223A', 'Office money', '#16223A'], b: ['#C9A86A', 'Both', '#8A6534'] };
const S: [string, string, string[], string, string, string][] = [
  ['Quotation & open the file', 'o', ['Lawyer', 'Partner'], 'Billing → Quotation', 'Quotation and engagement letter sent. File opened with client ID (CDD/KYC).', 'No money is taken before ID checks pass (AMLA).'],
  ['Proforma → deposit / retainer', 'b', ['Client', 'Accounts'], 'Billing → Proforma', 'Proforma asks for payment. Fee deposit → office account. Money for disbursements or purchase price → client account. Receipt issued either way.', 'Client money never goes into office account.'],
  ['Do the work, record time', 'o', ['Lawyer'], 'Cases → Time', 'Each lawyer logs time and tasks on the matter.', 'Time not logged = money not billed.'],
  ['Pay costs for the client', 'b', ['Lawyer', 'Accounts', 'Partner'], 'Client Account / Approvals', 'Stamp duty, court fees, search fees. Paid from client ledger if there is money, otherwise office pays and bills it later.', 'Ledger can never go below zero.'],
  ['Staff out-of-pocket claims', 'o', ['Staff', 'Partner'], 'My Claims → Approvals', 'Parking, mileage, printing. Staff upload receipt, partner approves, paid with payroll.', 'Billable claims are added to the client’s bill.'],
  ['Bill the client', 'o', ['Lawyer', 'Accounts'], 'Billing & Collections', 'Unbilled time + disbursements → invoice (minus any paid proforma) → e-Invoice validated by LHDN MyInvois → sent.', 'Bill anything older than 60 days.'],
  ['Get paid', 'b', ['Client', 'Accounts', 'Partner'], 'Billing / Client Account', 'Usually client pays straight into office. Or fee is transferred from their client ledger after the invoice (2 signatories).', 'Receipt (OR-O / OR-C) matched to the invoice the same day.'],
  ['Chase what is owed', 'o', ['Accounts', 'Partner'], 'Billing & Collections', 'Aged debtors 30 / 60 / 90 days, reminders, write-off asks the Super Admin.', 'Write-offs need Super Admin approval.'],
  ['Pay the firm’s bills', 'o', ['Accounts', 'Partner'], 'Office Account → Approvals', 'Rent, utilities, subscriptions, vouchers. Receipt attached to every payment.', 'Under RM 5k any partner · above: Super Admin + 1.'],
  ['Payroll & referral fees', 'o', ['Accounts', 'MP'], 'Payroll', 'Salaries, allowances, approved claims, staff referral fees → payslips. EPF, SOCSO, EIS, PCB paid by the 15th.', 'Referral fee % is on fees actually received.'],
  ['Month-end: reconcile, reserve, statements', 'b', ['Accounts', 'MP'], 'Finance Home', 'Office bank reconciliation. Top up sinking funds and check cash reserve. Client account 3-way check: ledgers = cash book = bank. Send monthly statement to every client with money held.', 'Client account signed off monthly by 2 partners.'],
  ['Report, audit & close files', 'b', ['Accounts', 'MP', 'System'], 'Books & Reports', 'P&L, balance sheet, SST, accountant’s report for Bar Council. At file closing, leftover client money is refunded.', 'Unclaimed client money over 12 months is flagged.'],
];
const MAP: [string, string, string][] = [['Claims', 'My Claims', ' (everyone) + Approvals'], ['Accounting Centre', 'Finance Home', ''], ['Finance & Billing', 'Billing & Collections', ''], ['Client Trust Account (SAR 1990)', 'Client Account', ' · ledgers'], ['Client Statement', 'Client Account', ' · statement PDF'], ['Trust Audit Log', 'Client Account', ' · audit log'], ['Client Account Reports', 'Books & Reports', ''], ['Office Accounts (CFO)', 'Office Account', ''], ['Bank Accounts & Virtual Pots', 'Office Account', ' · bank accounts'], ['Bank Reconciliation', 'Finance Home', ' · month-end'], ['Chart of Accounts', 'Books & Reports', ' · setup'], ['General Ledger', 'Books & Reports', ''], ['Trial Balance', 'Books & Reports', ''], ['Balance Sheet', 'Books & Reports', ''], ['Cash Flow', 'Books & Reports', ''], ['Office Account Reports', 'Books & Reports', ''], ['Office Inventory & Library', 'System', ' (not accounting)']];
const C: Record<string, [string, string]> = { Full: ['#E6EFE9', '#2F6F4E'], Prepare: ['#E7EEF6', '#2F5680'], 'Own files': ['#FBF2E9', '#8A6534'], Approve: ['#F7E9EE', '#8C2F4C'], View: ['#F0F2F5', '#5B6478'], '—': ['transparent', '#C9D3E0'] };
const M: [string, ...string[]][] = [['Finance Home', 'Full', '—', 'Full', '—'], ['Billing & Collections', 'Full', 'Own files', 'Full', '—'], ['Client Account', 'Full', 'View', 'Prepare', '—'], ['Office Account', 'Full', '—', 'Prepare', '—'], ['Approvals', 'Approve', 'Approve', '—', '—'], ['Payroll', 'Full', '—', 'Prepare', '—'], ['Books & Reports', 'Full', '—', 'Full', '—'], ['My Claims & payslip', 'Full', 'Full', 'Full', 'Full']];
const DO: [string, string][] = [['Log time', 'on each matter in Cases, so it can be billed.'], ['Submit claims', 'in My Claims with a photo of the receipt.'], ['Ask for a payment for a client', 'from the matter; Accounts pays it from the client account.'], ['See their payslip', 'in Staff Portal every month.']];

export const FinanceGuide = ({ F }: { F: FinanceCtrl }) => (
  <div style={css('max-width:1240px;margin:0 auto;padding:8px 0 48px;display:flex;flex-direction:column;gap:28px;font-size:12.5px;color:#16223A;font-family:Inter,system-ui,-apple-system,sans-serif')}>
    <header style={css('display:flex;flex-direction:column;gap:6px')}>
      <button type="button" onClick={() => F.setGuide(false)} style={css('align-self:flex-start;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer;font-family:inherit')}>‹ Back to Finance &amp; Accounts</button>
      <span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#8A6D3B')}>SH &amp; Co · Finance revamp</span>
      <h1 style={css('margin:0;font-family:ui-serif, Georgia, serif;font-size:30px;color:#16223A')}>How money moves, A to Z</h1>
      <p style={css('margin:0;max-width:760px;font-size:13px;line-height:1.6;color:#5B6478;text-wrap:pretty')}>Every ringgit follows one of two roads. <strong style={css('color:#2F6F4E')}>Client money</strong> (deposits, purchase prices, retainers) sits in the client account and is never the firm's. <strong style={css('color:#16223A')}>Office money</strong> (our fees, our costs) runs the firm. The 17 finance menu items become 7 pages, plus My Claims for everyone.</p>
    </header>
    <section style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px')}>
      <div style={css('border-radius:12px;border:1px solid #CFE3D6;background:#EEF5F0;padding:14px 16px')}><strong style={css('font-size:13px;color:#2F6F4E')}>Client money road · only when the money is the client’s</strong><p style={css('margin:4px 0 0;font-size:11.5px;line-height:1.55;color:#16223A')}>Purchase price, stakeholder sums, money for stamp duty or court fees → client ledger → pay out for that client only → our fee moves to office <em>only after an invoice</em> → monthly client statement → balance refunded at file closing.</p></div>
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px')}><strong style={css('font-size:13px;color:#16223A')}>Office money road · most of our money</strong><p style={css('margin:4px 0 0;font-size:11.5px;line-height:1.55;color:#16223A')}>Quotation → proforma for retainer → work → invoice → client pays straight into office → receipt → pay salaries, rent, claims, referral fees → set aside sinking funds → reconcile → reports.</p></div>
    </section>
    <section style={css('overflow:hidden;border-radius:14px;border:1px solid #DDE3EB;background:#fff')}>
      <div style={css('display:grid;grid-template-columns:44px minmax(0,1.1fr) 150px 170px minmax(0,1.5fr);gap:14px;padding:9px 18px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>#</span><span>Step</span><span>Who</span><span>Where in the app</span><span>What happens · the rule</span></div>
      {S.map(([title, road, who, where, what, rule], i) => (
        <div key={title} style={css(`display:grid;grid-template-columns:44px minmax(0,1.1fr) 150px 170px minmax(0,1.5fr);gap:14px;align-items:start;padding:12px 18px;border-bottom:1px solid #F0F2F5;border-left:4px solid ${R[road][0]}`)}>
          <span style={css(`width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff;background:${R[road][0]}`)}>{i + 1}</span>
          <span><strong style={css('display:block;font-size:13px;color:#16223A')}>{title}</strong><span style={css(`display:block;margin-top:2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${R[road][2]}`)}>{R[road][1]}</span></span>
          <span style={css('display:flex;flex-wrap:wrap;gap:4px')}>{who.map((w) => <span key={w} style={css(`font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${W[w][0]};color:${W[w][1]}`)}>{w === 'MP' ? 'Super Admin' : w}</span>)}</span>
          <span style={css('justify-self:start;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;background:#16223A;color:#fff')}>{where}</span>
          <span style={css('font-size:11.5px;line-height:1.55;color:#16223A;text-wrap:pretty')}>{what}<span style={css('display:block;margin-top:3px;font-size:10.5px;color:#8A6534;font-weight:600')}>{rule}</span></span>
        </div>
      ))}
    </section>
    <section style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css('overflow:hidden;border-radius:14px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px;color:#16223A')}>Old menu → new home</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>17 items across 3 sections become 7 pages. Nothing is lost, it moves.</span></div>
        {MAP.map(([old, now, tab]) => <div key={old} style={css('display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr);gap:8px;align-items:center;padding:6px 16px;border-bottom:1px solid #F4F6F8')}><span style={css('font-size:11.5px;color:#5B6478')}>{old}</span><span style={css('color:#94A3B8')}>→</span><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{now}<span style={css('font-weight:400;color:#5B6478')}>{tab}</span></span></div>)}
      </div>
      <div style={css('display:flex;flex-direction:column;gap:16px')}>
        <div style={css('overflow:hidden;border-radius:14px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px;color:#16223A')}>Who sees what</strong><span style={css('display:block;font-size:10.5px;color:#5B6478')}>Pages a role can't use are hidden from their menu, not just locked.</span></div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) repeat(4,minmax(0,1fr));gap:6px;padding:8px 16px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478;background:#F6F8FA')}><span>Page</span><span style={css('text-align:center')}>Super Admin</span><span style={css('text-align:center')}>Partner</span><span style={css('text-align:center')}>Accounts</span><span style={css('text-align:center')}>Staff</span></div>
          {M.map(([page, ...cells]) => <div key={page} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) repeat(4,minmax(0,1fr));gap:6px;align-items:center;padding:7px 16px;border-top:1px solid #F0F2F5')}><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{page}</span>{cells.map((c, i) => <span key={i} style={css(`justify-self:center;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${C[c][0]};color:${C[c][1]}`)}>{c}</span>)}</div>)}
          <div style={css('padding:9px 16px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478')}>Full = do everything · Prepare = key in, can't approve · Own files = only matters they handle · Approve = decide, not key in · External auditor gets read-only Client Account + Books &amp; Reports for the audit period.</div>
        </div>
        <div style={css('border-radius:14px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:6px')}>
          <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px;color:#16223A')}>What staff (lawyers &amp; support) still do</strong>
          {DO.map(([t, s]) => <span key={t} style={css('display:flex;gap:8px;font-size:11.5px;line-height:1.5;color:#16223A')}><span style={css('color:#2F6F4E;font-weight:800')}>✓</span><span><strong>{t}</strong> <span style={css('color:#5B6478')}>{s}</span></span></span>)}
          <button type="button" onClick={() => F.setGuide(false)} style={css('align-self:flex-start;margin-top:6px;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer;font-family:inherit')}>Open Finance &amp; Accounts -&gt;</button>
        </div>
      </div>
    </section>
  </div>
);
