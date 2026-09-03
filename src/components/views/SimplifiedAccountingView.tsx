import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Receipt,
  DollarSign,
  CreditCard,
  Clock,
  Briefcase,
  FileCheck2,
  Landmark,
  BarChart3,
  Plus,
  Download,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { TimeEntry, Invoice, Payment, Expense, TravelClaim, PaymentVoucher, BankAccount } from '../../types';
import { BillingPipelineView } from './BillingPipelineView';

type Tab = 'billing' | 'invoices' | 'expenses' | 'payments' | 'time' | 'claims' | 'vouchers' | 'banking' | 'reports';

// Maps every sidebar/billing route id to the tab that should be shown when it is opened
const VIEW_TO_TAB: Record<string, Tab> = {
  accountingCentre: 'billing',
  quotations: 'billing',
  invoices: 'invoices',
  billingReports: 'reports',
  'reports-billing': 'reports',
  expenses: 'expenses',
  payments: 'payments',
  receipts: 'payments',
  time: 'time',
  reimbursements: 'claims',
  'reimbursements-claims': 'claims',
  claimsManagement: 'claims',
  'claims-management': 'claims',
  travelClaims: 'claims',
  'travel-claims': 'claims',
  paymentVouchers: 'vouchers',
  pv: 'vouchers',
  bankAccounts: 'banking',
  'bank-accounts': 'banking',
  bankReconciliation: 'banking',
  'bank-reconciliation': 'banking',
  officeAccounts: 'reports',
  'office-accounts': 'reports',
  coa: 'reports',
  gl: 'reports',
  tb: 'reports',
  trialBalance: 'reports',
  balanceSheet: 'reports',
  'balance-sheet': 'reports',
  cashFlow: 'reports',
  cashflow: 'reports',
  trustReports: 'reports',
  'reports-trust': 'reports',
  officeReports: 'reports',
  'reports-office': 'reports',
};

const formatCurrency = (amount: number) => `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

/* ==================== SIMPLIFIED ACCOUNTING VIEW ==================== */
export const SimplifiedAccountingView: React.FC = () => {
  const {
    invoices,
    expenses,
    payments,
    timeEntries,
    travelClaims,
    paymentVouchers,
    bankAccounts,
    cases,
    clients,
    addInvoice,
    updateInvoice,
    addExpense,
    updateExpense,
    deleteExpense,
    addPayment,
    updatePayment,
    deletePayment,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    addTravelClaim,
    updateTravelClaim,
    addPaymentVoucher,
    updatePaymentVoucher,
    addBankAccount,
    updateBankAccount,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('billing');
  const [searchTerm, setSearchTerm] = useState('');

  // =============== INVOICES TAB ===============
  const InvoicesTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
      invoiceNo: '',
      clientId: '',
      amount: '',
      dueDate: '',
      description: '',
    });

    const handleSave = () => {
      if (!formData.invoiceNo || !formData.clientId || !formData.amount) {
        showToast('Please fill in all required fields');
        return;
      }

      if (editingId) {
        updateInvoice(editingId, {
          invoiceNo: formData.invoiceNo,
          clientId: formData.clientId,
          total: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          description: formData.description,
        });
        showToast('Invoice updated');
      } else {
        addInvoice({
          id: `INV-${Date.now()}`,
          invoiceNo: formData.invoiceNo,
          clientId: formData.clientId,
          total: parseFloat(formData.amount),
          remaining: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          date: new Date().toISOString().slice(0, 10),
          status: 'Draft',
          description: formData.description,
          taxAmount: 0,
          items: [],
          createdAt: new Date().toISOString(),
        });
        showToast('Invoice created');
      }
      setIsFormOpen(false);
      setFormData({ invoiceNo: '', clientId: '', amount: '', dueDate: '', description: '' });
    };

    const filteredInvoices = invoices.filter((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      return (
        inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    const stats = {
      total: invoices.reduce((sum, i) => sum + i.total, 0),
      outstanding: invoices
        .filter((i) => i.status !== 'Paid' && i.status !== 'Voided')
        .reduce((sum, i) => sum + (i.remaining || 0), 0),
      paid: invoices
        .filter((i) => i.status === 'Paid')
        .reduce((sum, i) => sum + i.total, 0),
    };

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Invoiced', value: formatCurrency(stats.total), color: 'bg-blue-50' },
            { label: 'Outstanding', value: formatCurrency(stats.outstanding), color: 'bg-amber-50' },
            { label: 'Paid', value: formatCurrency(stats.paid), color: 'bg-emerald-50' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-lg border border-slate-200 p-4`}>
              <div className="text-xs font-semibold text-slate-500 uppercase">{stat.label}</div>
              <div className="mt-1 font-mono text-lg font-bold text-slate-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {isFormOpen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold">
              {editingId ? 'Edit Invoice' : 'New Invoice'}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                type="text"
                placeholder="Invoice No"
                value={formData.invoiceNo}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceNo: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <select
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="">Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Amount (RM)"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingId(null);
                  setFormData({ invoiceNo: '', clientId: '', amount: '', dueDate: '', description: '' });
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-0 bg-transparent text-xs outline-none"
              />
            </div>
            <button
              onClick={() => {
                setIsFormOpen(!isFormOpen);
                setEditingId(null);
              }}
              className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
              No invoices found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((inv) => {
                const client = clients.find((c) => c.id === inv.clientId);
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-xs">
                        {inv.invoiceNo}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {client?.name} • {inv.dueDate}
                      </div>
                    </div>
                    <div className="text-right mr-3">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(inv.total)}
                      </div>
                      <div
                        className={`text-xs mt-0.5 px-2 py-0.5 rounded text-white font-semibold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-500'
                            : inv.status === 'Voided'
                            ? 'bg-slate-500'
                            : 'bg-amber-500'
                        }`}
                      >
                        {inv.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============== EXPENSES TAB ===============
  const ExpensesTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
      description: '',
      amount: '',
      category: 'Office',
      date: new Date().toISOString().slice(0, 10),
    });

    const handleSave = () => {
      if (!formData.description || !formData.amount) {
        showToast('Please fill in all required fields');
        return;
      }

      addExpense({
        id: `EXP-${Date.now()}`,
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category as any,
        date: formData.date,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      });
      showToast('Expense recorded');
      setFormData({ description: '', amount: '', category: 'Office', date: new Date().toISOString().slice(0, 10) });
      setIsFormOpen(false);
    };

    const filteredExpenses = expenses.filter((exp) =>
      exp.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="text-xs font-semibold text-red-600 uppercase">Total Expenses</div>
          <div className="font-mono text-2xl font-bold text-red-900 mt-1">
            {formatCurrency(totalExpenses)}
          </div>
        </div>

        {isFormOpen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Record Expense</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="number"
                placeholder="Amount (RM)"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              >
                <option>Office</option>
                <option>Client Billable</option>
                <option>Travel</option>
                <option>Technology</option>
                <option>Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-0 bg-transparent text-xs outline-none"
            />
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No expenses recorded
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
              >
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 text-xs">{exp.description}</div>
                  <div className="text-slate-500 text-xs mt-0.5">
                    {exp.category} • {exp.date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-red-600 text-xs">
                    -{formatCurrency(exp.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =============== PAYMENTS TAB ===============
  const PaymentsTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
      invoiceId: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      method: 'Bank Transfer',
    });

    const handleSave = () => {
      if (!formData.invoiceId || !formData.amount) {
        showToast('Please fill in all required fields');
        return;
      }

      const invoice = invoices.find((i) => i.id === formData.invoiceId);
      if (!invoice) {
        showToast('Invoice not found');
        return;
      }

      addPayment({
        id: `PAY-${Date.now()}`,
        invoiceId: formData.invoiceId,
        amount: parseFloat(formData.amount),
        date: formData.date,
        method: formData.method as any,
        status: 'Recorded',
        createdAt: new Date().toISOString(),
      });

      showToast('Payment recorded');
      setFormData({ invoiceId: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer' });
      setIsFormOpen(false);
    };

    const filteredPayments = payments.filter((pay) => {
      const invoice = invoices.find((i) => i.id === pay.invoiceId);
      return !searchTerm || invoice?.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <div className="text-xs font-semibold text-emerald-600 uppercase">Total Payments Received</div>
          <div className="font-mono text-2xl font-bold text-emerald-900 mt-1">
            {formatCurrency(totalPayments)}
          </div>
        </div>

        {isFormOpen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Record Payment</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={formData.invoiceId}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceId: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              >
                <option value="">Select Invoice</option>
                {invoices
                  .filter((i) => i.status !== 'Paid' && i.status !== 'Voided')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNo} - {formatCurrency(i.remaining || 0)} outstanding
                    </option>
                  ))}
              </select>
              <input
                type="number"
                placeholder="Payment Amount (RM)"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <select
                value={formData.method}
                onChange={(e) =>
                  setFormData({ ...formData, method: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              >
                <option>Bank Transfer</option>
                <option>Cash</option>
                <option>Cheque</option>
                <option>Credit Card</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-0 bg-transparent text-xs outline-none"
            />
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No payments recorded
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPayments.map((pay) => {
              const invoice = invoices.find((i) => i.id === pay.invoiceId);
              return (
                <div
                  key={pay.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-xs">
                      {invoice?.invoiceNo}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {pay.date} • {pay.method}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-600 text-xs">
                    +{formatCurrency(pay.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =============== TIME ENTRIES TAB ===============
  const TimeEntriesTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
      caseId: '',
      hours: '',
      rate: '450',
      date: new Date().toISOString().slice(0, 10),
      description: '',
    });

    const handleSave = () => {
      if (!formData.caseId || !formData.hours || !formData.description) {
        showToast('Please fill in all required fields');
        return;
      }

      addTimeEntry({
        id: `TE-${Date.now()}`,
        caseId: formData.caseId,
        feeEarner: 'SH',
        hours: parseFloat(formData.hours),
        rate: parseFloat(formData.rate),
        date: formData.date,
        description: formData.description,
        billable: true,
        billed: false,
        approvalStatus: 'Approved',
        createdAt: new Date().toISOString(),
      });

      showToast('Time entry recorded');
      setFormData({ caseId: '', hours: '', rate: '450', date: new Date().toISOString().slice(0, 10), description: '' });
      setIsFormOpen(false);
    };

    const filteredEntries = timeEntries.filter((t) => {
      const cs = cases.find((c) => c.id === t.caseId);
      return !searchTerm || (cs?.ref || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    const stats = {
      totalHours: timeEntries.reduce((sum, t) => sum + t.hours, 0),
      unbilledValue: timeEntries
        .filter((t) => !t.billed)
        .reduce((sum, t) => sum + t.hours * t.rate, 0),
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="text-xs font-semibold text-blue-600 uppercase">Total Hours</div>
            <div className="font-mono text-2xl font-bold text-blue-900 mt-1">
              {stats.totalHours.toFixed(1)}h
            </div>
          </div>
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <div className="text-xs font-semibold text-purple-600 uppercase">Unbilled Value</div>
            <div className="font-mono text-2xl font-bold text-purple-900 mt-1">
              {formatCurrency(stats.unbilledValue)}
            </div>
          </div>
        </div>

        {isFormOpen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Log Time</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <select
                value={formData.caseId}
                onChange={(e) =>
                  setFormData({ ...formData, caseId: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              >
                <option value="">Select Matter</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ref} - {c.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Hours"
                value={formData.hours}
                onChange={(e) =>
                  setFormData({ ...formData, hours: e.target.value })
                }
                step="0.5"
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="number"
                placeholder="Rate (RM/hr)"
                value={formData.rate}
                onChange={(e) =>
                  setFormData({ ...formData, rate: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="text"
                placeholder="Description (e.g., Legal Research)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search time entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-0 bg-transparent text-xs outline-none"
            />
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Log
          </button>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No time entries yet
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => {
              const cs = cases.find((c) => c.id === entry.caseId);
              const value = entry.hours * entry.rate;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-xs">{entry.description}</div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {cs?.ref} • {entry.date} • {entry.hours}h @ {formatCurrency(entry.rate)}/hr
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {formatCurrency(value)}
                    </div>
                    <div className={`text-xs mt-0.5 px-2 py-0.5 rounded text-white font-semibold ${
                      entry.billed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      {entry.billed ? 'Billed' : 'Unbilled'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =============== TRAVEL CLAIMS TAB ===============
  const TravelClaimsTab = () => {
    const filteredClaims = travelClaims.filter((claim) => {
      const cs = cases.find((c) => c.id === claim.caseId);
      return !searchTerm || (cs?.ref || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalClaims = travelClaims.reduce((sum, c) => sum + c.totalAmount, 0);
    const pendingClaims = travelClaims.filter((c) => c.status === 'Pending').reduce((sum, c) => sum + c.totalAmount, 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="text-xs font-semibold text-amber-600 uppercase">Total Claims</div>
            <div className="font-mono text-2xl font-bold text-amber-900 mt-1">
              {formatCurrency(totalClaims)}
            </div>
          </div>
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
            <div className="text-xs font-semibold text-orange-600 uppercase">Pending</div>
            <div className="font-mono text-2xl font-bold text-orange-900 mt-1">
              {formatCurrency(pendingClaims)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search claims..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border-0 bg-transparent text-xs outline-none"
          />
        </div>

        {filteredClaims.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No travel claims
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClaims.map((claim) => {
              const cs = cases.find((c) => c.id === claim.caseId);
              return (
                <div
                  key={claim.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-xs">{cs?.ref}</div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {claim.travelDate} • {claim.claimType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {formatCurrency(claim.totalAmount)}
                    </div>
                    <div className={`text-xs mt-0.5 px-2 py-0.5 rounded text-white font-semibold ${
                      claim.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      {claim.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =============== PAYMENT VOUCHERS TAB ===============
  const PaymentVouchersTab = () => {
    const filteredVouchers = paymentVouchers.filter((v) => {
      const cs = cases.find((c) => c.id === v.caseId);
      return !searchTerm || (cs?.ref || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    const totalVouchers = paymentVouchers.reduce((sum, v) => sum + v.amount, 0);

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
          <div className="text-xs font-semibold text-indigo-600 uppercase">Total Vouchers</div>
          <div className="font-mono text-2xl font-bold text-indigo-900 mt-1">
            {formatCurrency(totalVouchers)}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white rounded border border-slate-200 px-3 py-1">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vouchers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border-0 bg-transparent text-xs outline-none"
          />
        </div>

        {filteredVouchers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No payment vouchers
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVouchers.map((voucher) => {
              const cs = cases.find((c) => c.id === voucher.caseId);
              return (
                <div
                  key={voucher.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-xs">
                      {voucher.voucherNo}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {cs?.ref} • {voucher.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {formatCurrency(voucher.amount)}
                    </div>
                    <div className={`text-xs mt-0.5 px-2 py-0.5 rounded text-white font-semibold ${
                      voucher.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      {voucher.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =============== BANKING TAB ===============
  const BankingTab = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
      bankName: '',
      accountNo: '',
      accountName: '',
      type: 'Office' as 'Trust' | 'Office',
    });

    const handleSave = () => {
      if (!formData.bankName || !formData.accountNo || !formData.accountName) {
        showToast('Please fill in all required fields');
        return;
      }

      addBankAccount({
        id: `BA-${Date.now()}`,
        bankName: formData.bankName,
        accountNo: formData.accountNo,
        accountName: formData.accountName,
        type: formData.type,
        currency: 'MYR',
        currentBalance: 0,
        openingBalance: 0,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });

      showToast('Bank account added');
      setFormData({ bankName: '', accountNo: '', accountName: '', type: 'Office' });
      setIsFormOpen(false);
    };

    const activeAccounts = bankAccounts.filter((a) => a.status === 'Active');
    const totalBalance = activeAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-white">
          <div className="text-xs font-semibold text-slate-300 uppercase">Total Bank Balance</div>
          <div className="font-mono text-2xl font-bold text-white mt-1">
            {formatCurrency(totalBalance)}
          </div>
        </div>

        {isFormOpen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add Bank Account</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                type="text"
                placeholder="Bank Name"
                value={formData.bankName}
                onChange={(e) =>
                  setFormData({ ...formData, bankName: e.target.value })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="text"
                placeholder="Account No"
                value={formData.accountNo}
                onChange={(e) =>
                  setFormData({ ...formData, accountNo: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                type="text"
                placeholder="Account Name"
                value={formData.accountName}
                onChange={(e) =>
                  setFormData({ ...formData, accountName: e.target.value })
                }
                className="rounded border border-slate-300 px-2 py-1"
              />
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'Trust' | 'Office' })
                }
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
              >
                <option value="Office">Office Account</option>
                <option value="Trust">Trust Account</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save
              </button>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> New Account
          </button>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-slate-500 text-xs">
            No bank accounts configured
          </div>
        ) : (
          <div className="space-y-2">
            {activeAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-sm">{account.bankName}</div>
                    <div className="text-slate-500 text-xs mt-1">
                      {account.accountName} • {account.accountNo}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {account.type} Account
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(account.currentBalance)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // =============== REPORTS TAB ===============
  const ReportsTab = () => {
    const totalSales = invoices.reduce((sum, i) => sum + i.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBankBalance = bankAccounts
      .filter((a) => a.status === 'Active')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const netProfit = totalSales - totalExpenses;
    const monthlyData = invoices.reduce((acc, inv) => {
      const month = inv.date.slice(0, 7);
      acc[month] = (acc[month] || 0) + inv.total;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="text-xs font-semibold text-blue-600 uppercase">Total Income</div>
            <div className="font-mono text-2xl font-bold text-blue-900 mt-1">
              {formatCurrency(totalSales)}
            </div>
            <div className="text-slate-500 text-xs mt-2">
              {invoices.length} invoices issued
            </div>
          </div>

          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="text-xs font-semibold text-red-600 uppercase">Total Expenses</div>
            <div className="font-mono text-2xl font-bold text-red-900 mt-1">
              {formatCurrency(totalExpenses)}
            </div>
            <div className="text-slate-500 text-xs mt-2">
              {expenses.length} expense entries
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${
            netProfit >= 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-xs font-semibold uppercase ${
              netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              Net Profit
            </div>
            <div className={`font-mono text-2xl font-bold mt-1 ${
              netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'
            }`}>
              {formatCurrency(netProfit)}
            </div>
          </div>

          <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-white">
            <div className="text-xs font-semibold text-slate-300 uppercase">Bank Balance</div>
            <div className="font-mono text-2xl font-bold text-white mt-1">
              {formatCurrency(totalBankBalance)}
            </div>
            <div className="text-slate-400 text-xs mt-2">
              {bankAccounts.filter((a) => a.status === 'Active').length} active accounts
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-sm mb-3">Monthly Revenue Trend</h3>
          <div className="space-y-2">
            {(Object.entries(monthlyData) as Array<[string, number]>)
              .sort()
              .slice(-6)
              .map(([month, amount]) => (
                <div key={month} className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">{month}</div>
                  <div className="flex items-center gap-2 flex-1 ml-4">
                    <div
                      className="h-2 bg-blue-500 rounded"
                      style={{
                        width: `${(amount / (Math.max(...(Object.values(monthlyData) as number[])) || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 ml-2">
                    {formatCurrency(amount)}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-700">Collection Rate</div>
            <div className="font-mono text-lg font-bold text-slate-900 mt-1">
              {totalSales > 0
                ? `${((totalPayments / totalSales) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-700">Expense Ratio</div>
            <div className="font-mono text-lg font-bold text-slate-900 mt-1">
              {totalSales > 0
                ? `${((totalExpenses / totalSales) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className="h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-blue-600" />
          Accounting
        </h1>
        <p className="text-xs text-slate-600 mt-1">Simplified accounting dashboard</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-4 overflow-x-auto">
        {[
          { id: 'billing' as const, label: 'Billing', icon: FileText },
          { id: 'invoices' as const, label: 'Invoices', icon: Receipt },
          { id: 'expenses' as const, label: 'Expenses', icon: DollarSign },
          { id: 'payments' as const, label: 'Payments', icon: CreditCard },
          { id: 'time' as const, label: 'Time Entries', icon: Clock },
          { id: 'claims' as const, label: 'Travel Claims', icon: Briefcase },
          { id: 'vouchers' as const, label: 'Vouchers', icon: FileCheck2 },
          { id: 'banking' as const, label: 'Banking', icon: Landmark },
          { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === id
                ? 'text-blue-600 border-blue-600 bg-blue-50'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'billing' && <BillingPipelineView />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'time' && <TimeEntriesTab />}
        {activeTab === 'claims' && <TravelClaimsTab />}
        {activeTab === 'vouchers' && <PaymentVouchersTab />}
        {activeTab === 'banking' && <BankingTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
};
