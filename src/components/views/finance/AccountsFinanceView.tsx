import React, { useState } from 'react';
import { FilePlus, Banknote, Wallet } from 'lucide-react';
import type { FinTab } from '../../../lib/financeAccess';
import { useFinanceController } from './useFinanceController';
import { css } from './financeModel';
import { FinanceHomeTab } from './FinanceHomeTab';
import { BillingTab } from './BillingTab';
import { ClientAccountTrustTab } from './ClientAccountTrustTab';
import { OfficeAccountTab } from './OfficeAccountTab';
import { ApprovalsTab } from './ApprovalsTab';
import { PayrollTab } from './PayrollTab';
import { AccountingTab } from './AccountingTab';
import { ReportsTab } from './ReportsTab';
import { FinanceGuide } from './FinanceGuide';
import { DocViewModal, DocEditModal, FormModal, ImportModal } from './FinanceModals';
import { EngagementLetterModal } from './EngagementLetterModal';
import { PaperModal, ReminderModal } from './FinancePaperModals';
import { PayslipFormModal } from './PayslipFormModal';

/**
 * Accounts & Finance — design pack `Accounts and Finance.dc.html` (COPY, DO NOT REDESIGN).
 * Eight pages opened from the sidebar (the header shows the page title; there is no tab strip):
 * Finance Home, Billing & Collections, Client Account, Office Account, Approvals, Payroll,
 * Accounting, Reports. Every inline style is the design's own, copied verbatim via css().
 * All data is real (useApp()).
 */
export const AccountsFinanceView = ({ initialTab = 'overview' }: { initialTab?: FinTab }) => {
  const F = useFinanceController(initialTab);
  const { TABS, tab } = F;
  const [chooser, setChooser] = useState(false);

  if (!TABS.length) {
    return (
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:24px;max-width:640px;margin:24px auto;text-align:center;color:#16223A')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px')}>Finance &amp; Accounts is restricted</strong>
        <p style={css('margin:6px 0 0;font-size:12px;line-height:1.5;color:#5B6478')}>Only Accounts and Partners use these pages. You can see your own claims in My Claims and your payslip in Staff Portal.</p>
      </div>
    );
  }
  if (F.guide) return <FinanceGuide F={F} />;

  const starts: [string, string, React.ReactNode, string, () => void][] = [
    ['Bill', 'quotation, proforma or invoice', <FilePlus key="i" size={16} color="#FFFFFF" />, '#8A6D3B', () => F.openNew('Quotation')],
    ['Money in', 'attach the bank slip, pick who paid', <Banknote key="i" size={16} color="#FFFFFF" />, '#2F6F4E', () => F.openForm('moneyIn', {})],
    ['Money out', 'attach the bill, say what it is for', <Wallet key="i" size={16} color="#FFFFFF" />, '#3D6B9C', () => setChooser(true)],
  ];
  const outOpts: [string, string, () => void][] = [
    ['Office expense', 'rent, utilities, Bar subscription, stationery. Above the limit it goes to Approvals.', () => F.openForm('expense', {})],
    ['Paid on behalf of a client', 'stamp duty, court or search fees. Billed back to the client automatically.', () => F.openForm('disb', {})],
    ['Pay out of client money', 'balance purchase price, refund, payment to a third party. Needs two signatories.', () => F.openForm('payOut', {})],
    ['Transfer fees to office', 'move money from a client ledger to office against an issued invoice.', () => F.openForm('transfer', {})],
    ['Staff claim or salary', 'handled in Payroll and Approvals.', () => (F.TABS.some((t) => t[0] === 'payroll') ? F.go('payroll') : F.toastMsg('Payroll is not available for your role.'))],
  ];

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#1E293B;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <section style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px')}>
        {starts.map(([label, note, icon, color, onClick]) => (
          <button key={label} type="button" onClick={onClick} style={css('display:flex;align-items:center;gap:10px;text-align:left;border-radius:10px;border:1px solid #DDE3EB;background:#fff;padding:10px 12px;cursor:pointer;font-family:inherit')}>
            <span style={css(`width:32px;height:32px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;background:${color}`)}><span style={css('width:16px;height:16px;display:grid;place-items:center')}>{icon}</span></span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:12.5px;font-weight:700;color:#16223A')}>{label}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{note}</span></span>
          </button>
        ))}
      </section>

      {tab === 'overview' && <FinanceHomeTab F={F} />}
      {tab === 'billing' && <BillingTab F={F} />}
      {tab === 'trust' && <ClientAccountTrustTab F={F} />}
      {tab === 'office' && <OfficeAccountTab F={F} />}
      {tab === 'approvals' && <ApprovalsTab F={F} />}
      {tab === 'payroll' && <PayrollTab F={F} />}
      {tab === 'books' && <AccountingTab F={F} />}
      {tab === 'reports' && <ReportsTab F={F} />}

      {chooser && (
        <>
          <div onClick={() => setChooser(false)} style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.5)')}></div>
          <div style={css('position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:61;width:520px;max-width:calc(100% - 32px);background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 48px rgba(22,34,58,.25)')}>
            <div style={css('display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-size:13px;color:#16223A')}>Money out · what is this for?</strong><button type="button" onClick={() => setChooser(false)} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Close</button></div>
            {outOpts.map(([label, note, fn]) => (
              <button key={label} type="button" className="hover:bg-[#F6F8FA]" onClick={() => { setChooser(false); fn(); }} style={css('width:100%;display:flex;flex-direction:column;gap:2px;text-align:left;padding:11px 16px;border:0;border-bottom:1px solid #F0F2F5;background:#fff;cursor:pointer;font-family:inherit')}><strong style={css('font-size:12px;color:#16223A')}>{label}</strong><span style={css('font-size:10.5px;line-height:1.45;color:#5B6478')}>{note}</span></button>
            ))}
          </div>
        </>
      )}
      {F.imp && <ImportModal F={F} />}
      {F.view && <DocViewModal F={F} />}
      {F.loe && <EngagementLetterModal F={F} />}
      {F.ed && <DocEditModal F={F} />}
      {F.rem && <ReminderModal F={F} />}
      {F.paper && <PaperModal F={F} />}
      {F.form && (F.form.kind === 'payslip' ? <PayslipFormModal F={F} /> : <FormModal F={F} />)}
      {!!F.toast && <div style={css('position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;border-radius:8px;padding:10px 16px;background:#16223A;color:#fff;font-size:12px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25)')}>{F.toast}</div>}
    </div>
  );
};
