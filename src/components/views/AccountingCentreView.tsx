import React, { useState } from 'react';
import { ArrowRight, BarChart3, BookOpen, Building2, CreditCard, FileText, Landmark, Receipt, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Shortcut = {
  id: string;
  section: 'Sales & Billing' | 'Expenses & Banking' | 'Reports';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const shortcuts: Shortcut[] = [
  { id: 'quotations', section: 'Sales & Billing', label: 'Sales & Quotations', description: 'Prepare quotations and proformas for clients and lead-linked prospects.', icon: FileText },
  { id: 'invoices', section: 'Sales & Billing', label: 'Sales Invoices', description: 'Track issued invoices, tax, balances, and outstanding collections.', icon: Receipt },
  { id: 'payments', section: 'Sales & Billing', label: 'Payments Received', description: 'Apply collections against issued invoices and monitor payment status.', icon: CreditCard },
  { id: 'expenses', section: 'Expenses & Banking', label: 'Purchases & Expenses', description: 'Record office costs, disbursements, and billable matter expenses.', icon: Wallet },
  { id: 'bankReconciliation', section: 'Expenses & Banking', label: 'Banking', description: 'Review bank accounts and match statement lines to the ledger.', icon: Landmark },
  { id: 'gl', section: 'Reports', label: 'General Ledger', description: 'Review posted double-entry transactions and document references.', icon: BookOpen },
  { id: 'trialBalance', section: 'Reports', label: 'Trial Balance', description: 'Check that total debits and credits remain balanced.', icon: BarChart3 },
  { id: 'balanceSheet', section: 'Reports', label: 'Balance Sheet', description: 'Review firm assets, liabilities, and partner equity.', icon: BarChart3 },
  { id: 'cashFlow', section: 'Reports', label: 'Cash Flow', description: 'Review monthly office cash movement and closing balances.', icon: BarChart3 },
];

export const AccountingCentreView: React.FC = () => {
  const { quotations, invoices, payments, expenses, bankAccounts, generalLedger, setCurrentView } = useApp();
  const [activeSection, setActiveSection] = useState<Shortcut['section']>('Sales & Billing');
  const [reportingMonth, setReportingMonth] = useState(new Date().toISOString().slice(0, 7));
  const periodInvoices = invoices.filter((invoice) => invoice.date.startsWith(reportingMonth));
  const periodPayments = payments.filter((payment) => payment.date.startsWith(reportingMonth));
  const outstanding = periodInvoices.reduce((total, invoice) => invoice.status === 'Paid' || invoice.status === 'Voided' ? total : total + (invoice.remaining ?? invoice.total), 0);
  const monthSales = periodInvoices.filter((invoice) => invoice.status !== 'Voided').reduce((total, invoice) => total + invoice.total, 0);
  const monthPayments = periodPayments.reduce((total, payment) => total + payment.amount, 0);
  const formatAmount = (amount: number) => `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 text-xs animate-in fade-in duration-200">
      <section className="rounded-2xl border border-[#E1DCCF] bg-[#16223A] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300"><Building2 className="h-3.5 w-3.5" /> Bukku-style finance workspace</div>
            <h2 className="font-serif text-2xl font-bold">Accounting Centre</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">One operational view for sales, collections, expenses, banking, and double-entry reporting. Legal matter and trust-account controls remain linked to their existing workflows.</p>
          </div>
          <button type="button" onClick={() => setCurrentView('invoices')} className="flex items-center gap-2 self-start rounded-lg bg-[#A9814A] px-3.5 py-2 font-bold text-white shadow-sm cursor-pointer md:self-auto"><Receipt className="h-4 w-4" /> Open invoices <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
          <label htmlFor="accounting-reporting-month" className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Reporting month</label>
          <input id="accounting-reporting-month" type="month" value={reportingMonth} onChange={(event) => setReportingMonth(event.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white outline-none [color-scheme:dark]" />
          <span className="text-[10px] text-slate-400">Metrics below use this period</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Outstanding receivables', value: formatAmount(outstanding), detail: `${invoices.filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Voided').length} open invoices`, tone: 'text-amber-800' },
          { label: 'Sales in period', value: formatAmount(monthSales), detail: `${periodInvoices.filter((invoice) => invoice.status !== 'Voided').length} issued invoices`, tone: 'text-[#16223A]' },
          { label: 'Collections in period', value: formatAmount(monthPayments), detail: `${periodPayments.length} recorded payments`, tone: 'text-emerald-800' },
          { label: 'Ledger activity', value: generalLedger.length.toLocaleString(), detail: `${bankAccounts.length} linked bank accounts`, tone: 'text-blue-800' },
        ].map((metric) => <div key={metric.label} className="rounded-xl border border-[#E1DCCF] bg-white p-4 shadow-xs"><div className="text-[10px] font-bold uppercase text-slate-500">{metric.label}</div><div className={`mt-2 font-mono text-xl font-bold ${metric.tone}`}>{metric.value}</div><div className="mt-1 text-[10px] text-slate-500">{metric.detail}</div></div>)}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 className="font-serif text-lg font-bold text-[#16223A]">Finance workflow</h3><p className="mt-1 text-[10px] text-slate-500">Bukku-style operational sections mapped to SHCO modules.</p></div><BookOpen className="h-5 w-5 text-[#A9814A]" /></div>
          <div className="mb-3 flex flex-wrap gap-1.5">{(['Sales & Billing', 'Expenses & Banking', 'Reports'] as const).map((section) => <button key={section} type="button" onClick={() => setActiveSection(section)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer ${activeSection === section ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{section}</button>)}</div>
          <div className="space-y-2">{shortcuts.filter(({ section }) => section === activeSection).map(({ id, label, description, icon: Icon }) => <button key={id} type="button" onClick={() => setCurrentView(id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-amber-300 hover:bg-amber-50 cursor-pointer"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F6F4EE] text-[#A9814A]"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block text-xs text-[#16223A]">{label}</strong><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{description}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" /></button>)}</div>
        </div>
        <div className="rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-5 shadow-xs">
          <h3 className="font-serif text-lg font-bold text-[#16223A]">Current pipeline</h3><p className="mt-1 text-[10px] text-slate-500">The source records behind the finance centre.</p>
          <div className="mt-4 space-y-3">{[
            ['Quotations & proformas', quotations.length, 'quotations'], ['Invoices', invoices.length, 'invoices'], ['Expenses', expenses.length, 'expenses'], ['Bank accounts', bankAccounts.length, 'bankAccounts'],
          ].map(([label, count, destination]) => <button key={label} type="button" onClick={() => setCurrentView(destination as string)} className="flex w-full items-center justify-between border-b border-[#E1DCCF] pb-3 text-left cursor-pointer"><span className="text-xs font-semibold text-slate-700">{label}</span><span className="font-mono text-sm font-bold text-[#16223A]">{count}</span></button>)}</div>
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] leading-relaxed text-emerald-900">Trust accounting, official receipts, payment vouchers, and SAR 1990 audit records remain available under Client Accounting and are not merged into office accounting totals.</div>
        </div>
      </section>
    </div>
  );
};