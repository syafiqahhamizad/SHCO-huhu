import React from 'react';
import { FilePlus, Banknote, Wallet, BadgeCheck } from 'lucide-react';
import type { FinTab } from '../../../lib/financeAccess';
import { useFinanceController } from './useFinanceController';
import { css } from './financeModel';
import { FinanceHomeTab } from './FinanceHomeTab';
import { BillingTab } from './BillingTab';
import { ClientAccountTrustTab } from './ClientAccountTrustTab';
import { OfficeAccountTab } from './OfficeAccountTab';
import { ApprovalsTab } from './ApprovalsTab';
import { PayrollTab } from './PayrollTab';
import { BooksReportsTab } from './BooksReportsTab';
import { DocViewModal, DocEditModal, FormModal, ImportModal } from './FinanceModals';
import { PayslipFormModal } from './PayslipFormModal';

/**
 * Accounts & Finance — design pack `Accounts and Finance.dc.html` (COPY, DO NOT REDESIGN).
 * 7 tabs in the design's order; every inline style is the design's own, copied verbatim via
 * css(). Replaces Accounting Centre, Finance & Billing, Simplified Accounting, Quotations,
 * Reimbursement approvals and the trust pages as what users see. All data is real (useApp()).
 */
export const AccountsFinanceView = ({ initialTab = 'overview' }: { initialTab?: FinTab }) => {
  const F = useFinanceController(initialTab);
  const { TABS, tab, go, rk } = F;

  if (!TABS.length) {
    return (
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:24px;max-width:640px;margin:24px auto;text-align:center;color:#16223A')}>
        <strong style={css('font-family:ui-serif, Georgia, serif;font-size:16px')}>Finance &amp; Accounts is restricted</strong>
        <p style={css('margin:6px 0 0;font-size:12px;line-height:1.5;color:#5B6478')}>Only Accounts, Partners and the Managing Partner use these pages. You can see your own claims in My Claims and your payslip in Staff Portal.</p>
      </div>
    );
  }

  const starts: [string, string, React.ReactNode, string, () => void][] = [
    ['New quotation or invoice', 'quotation · proforma · invoice · receipt', <FilePlus key="i" size={16} color="#FFFFFF" />, '#8A6D3B', () => F.openNew('Quotation')],
    ['Record money in', 'receipt to office or client account', <Banknote key="i" size={16} color="#FFFFFF" />, '#2F6F4E', () => F.openForm('moneyIn', { account: 'Office' })],
    ['Pay something', 'expense, claim or voucher', <Wallet key="i" size={16} color="#FFFFFF" />, '#3D6B9C', () => F.openForm('expense', {})],
    ['Approve', F.pendingAp + ' waiting for you', <BadgeCheck key="i" size={16} color="#FFFFFF" />, '#B23A2E', () => (TABS.some((t) => t[0] === 'approvals') ? go('approvals') : F.toastMsg('Approvals are not available for your role.'))],
  ];

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#1E293B;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <section style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px')}>
        {starts.map(([label, note, icon, color, onClick]) => (
          <button key={label} type="button" onClick={onClick} style={css('display:flex;align-items:center;gap:10px;text-align:left;border-radius:10px;border:1px solid #DDE3EB;background:#fff;padding:10px 12px;cursor:pointer;font-family:inherit')}>
            <span style={css(`width:32px;height:32px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;background:${color}`)}><span style={css('width:16px;height:16px;display:grid;place-items:center')}>{icon}</span></span>
            <span style={css('min-width:0')}><span style={css('display:block;font-size:12.5px;font-weight:700;color:#16223A')}>{label}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{note}</span></span>
          </button>
        ))}
      </section>

      <section style={css('display:flex;gap:4px;border-bottom:1px solid #DDE3EB;overflow-x:auto')}>
        {TABS.map(([key, label]) => {
          const on = tab === key;
          const badge = key === 'approvals' ? F.pendingAp : 0;
          return (
            <button key={key} type="button" onClick={() => go(key)} style={css(`display:flex;align-items:center;gap:6px;border:0;background:none;padding:9px 14px;margin-bottom:-1px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;color:${on ? '#16223A' : '#5B6478'};border-bottom:2px solid ${on ? '#16223A' : 'transparent'}`)}>
              {label}
              {!!badge && rk !== 'A' && <span style={css('font-size:10px;font-weight:700;padding:0 6px;border-radius:9px;background:#B23A2E;color:#fff')}>{badge}</span>}
            </button>
          );
        })}
      </section>

      {tab === 'overview' && <FinanceHomeTab F={F} />}
      {tab === 'billing' && <BillingTab F={F} />}
      {tab === 'trust' && <ClientAccountTrustTab F={F} />}
      {tab === 'office' && <OfficeAccountTab F={F} />}
      {tab === 'approvals' && <ApprovalsTab F={F} />}
      {tab === 'payroll' && <PayrollTab F={F} />}
      {tab === 'reports' && <BooksReportsTab F={F} />}

      {F.imp && <ImportModal F={F} />}
      {F.view && <DocViewModal F={F} />}
      {F.ed && <DocEditModal F={F} />}
      {F.form && (F.form.kind === 'payslip' ? <PayslipFormModal F={F} /> : <FormModal F={F} />)}
      {!!F.toast && <div style={css('position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;border-radius:8px;padding:10px 16px;background:#16223A;color:#fff;font-size:12px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25)')}>{F.toast}</div>}
    </div>
  );
};

export default AccountsFinanceView;
