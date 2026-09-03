import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
} from 'lucide-react';

const formatCurrency = (amount: number) => `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

export const SimplifiedAccountingCentreView: React.FC = () => {
  const {
    invoices,
    expenses,
    payments,
    bankAccounts,
    timeEntries,
    setCurrentView,
  } = useApp();

  // Calculate key metrics
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const outstandingAmount = invoices
    .filter((i) => i.status !== 'Paid' && i.status !== 'Voided')
    .reduce((sum, i) => sum + (i.remaining || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === 'Paid')
    .reduce((sum, i) => sum + i.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBankBalance = bankAccounts
    .filter((a) => a.status === 'Active')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const unbilledTimeValue = timeEntries
    .filter((t) => !t.billed)
    .reduce((sum, t) => sum + t.hours * t.rate, 0);

  const netProfit = totalInvoiced - totalExpenses;
  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

  return (
    <div className="space-y-5 text-xs animate-in fade-in duration-200 pb-4">
      {/* Header */}
      <section className="rounded-2xl border border-[#E1DCCF] bg-[#16223A] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <Building2 className="h-3.5 w-3.5" /> Simplified Finance
            </div>
            <h2 className="font-serif text-2xl font-bold">Accounting Dashboard</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">
              Overview of invoices, expenses, payments, and bank accounts. Click any tab below to manage transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('invoices')}
            className="flex items-center gap-2 self-start rounded-lg bg-[#A9814A] px-3.5 py-2 font-bold text-white shadow-sm cursor-pointer md:self-auto hover:bg-[#B8925C] transition-colors"
          >
            <DollarSign className="h-4 w-4" /> View Invoices <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Key Metrics Grid */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Income',
            value: formatCurrency(totalInvoiced),
            detail: `${invoices.length} invoices`,
            tone: 'text-blue-800',
            bg: 'bg-blue-50',
          },
          {
            label: 'Outstanding',
            value: formatCurrency(outstandingAmount),
            detail: `${invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Voided').length} open`,
            tone: 'text-amber-800',
            bg: 'bg-amber-50',
          },
          {
            label: 'Total Expenses',
            value: formatCurrency(totalExpenses),
            detail: `${expenses.length} entries`,
            tone: 'text-red-800',
            bg: 'bg-red-50',
          },
          {
            label: 'Bank Balance',
            value: formatCurrency(totalBankBalance),
            detail: `${bankAccounts.filter((a) => a.status === 'Active').length} accounts`,
            tone: 'text-slate-800',
            bg: 'bg-slate-100',
          },
        ].map((metric) => (
          <div key={metric.label} className={`${metric.bg} rounded-xl border border-[#E1DCCF] p-4 shadow-xs`}>
            <div className="text-[10px] font-bold uppercase text-slate-500">{metric.label}</div>
            <div className={`mt-2 font-mono text-xl font-bold ${metric.tone}`}>{metric.value}</div>
            <div className="mt-1 text-[10px] text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      {/* Key Indicators */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Performance Metrics */}
        <div className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
          <h3 className="font-serif text-lg font-bold text-[#16223A] mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#A9814A]" />
            Performance Metrics
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-700">Net Profit</span>
              <span className={`font-mono font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-700">Collection Rate</span>
              <span className="font-mono font-bold text-blue-600">{collectionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-700">Expense Ratio</span>
              <span className="font-mono font-bold text-orange-600">
                {totalInvoiced > 0 ? ((totalExpenses / totalInvoiced) * 100).toFixed(1) : '0'}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-xs font-semibold text-slate-700">Unbilled Time Value</span>
              <span className="font-mono font-bold text-purple-600">{formatCurrency(unbilledTimeValue)}</span>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-5 shadow-xs">
          <h3 className="font-serif text-lg font-bold text-[#16223A] mb-4">Quick Access</h3>
          <div className="space-y-2">
            {[
              { label: 'Manage Invoices', icon: '📄', action: 'invoices' },
              { label: 'Record Expenses', icon: '💰', action: 'expenses' },
              { label: 'Log Time Entry', icon: '⏱️', action: 'time' },
              { label: 'View Bank Accounts', icon: '🏦', action: 'banking' },
              { label: 'Financial Reports', icon: '📊', action: 'reports' },
              { label: 'Travel Claims', icon: '✈️', action: 'claims' },
            ].map((item) => (
              <button
                key={item.action}
                onClick={() => setCurrentView(item.action)}
                className="w-full flex items-center gap-3 rounded-lg border border-[#E1DCCF] p-3 text-left hover:border-amber-300 hover:bg-amber-50 cursor-pointer transition-all"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-semibold text-[#16223A]">{item.label}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Status Summary */}
      <section className="rounded-xl border border-[#E1DCCF] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <h3 className="font-serif text-lg font-bold text-[#16223A]">Current Status</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              count: invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Voided').length,
              label: 'Open Invoices',
              color: 'bg-amber-50 text-amber-700 border-amber-200',
            },
            {
              count: expenses.filter((e) => e.status === 'Pending').length,
              label: 'Pending Expenses',
              color: 'bg-orange-50 text-orange-700 border-orange-200',
            },
            {
              count: timeEntries.filter((t) => !t.billed).length,
              label: 'Unbilled Time Entries',
              color: 'bg-purple-50 text-purple-700 border-purple-200',
            },
            {
              count: bankAccounts.filter((a) => a.status === 'Active').length,
              label: 'Active Bank Accounts',
              color: 'bg-blue-50 text-blue-700 border-blue-200',
            },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border ${stat.color} p-4 text-center`}>
              <div className="font-mono text-2xl font-bold">{stat.count}</div>
              <div className="text-xs font-semibold mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
