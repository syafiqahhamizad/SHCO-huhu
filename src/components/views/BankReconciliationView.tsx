import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileCheck2,
  Landmark,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const BankReconciliationView: React.FC = () => {
  const { bankAccounts, bankReconciliationEntries, toggleReconcileEntry } = useApp();

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    bankAccounts[0]?.id || ''
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Reconciled' | 'Unreconciled'>('All');

  const selectedAccount = bankAccounts.find((a) => a.id === selectedBankAccountId) || bankAccounts[0];

  const filteredEntries = bankReconciliationEntries.filter((e) => {
    if (selectedBankAccountId && e.bankAccountId !== selectedBankAccountId) return false;
    if (statusFilter !== 'All' && e.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        e.referenceNo.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalReconciled = bankReconciliationEntries
    .filter((e) => e.bankAccountId === selectedAccount?.id && e.status === 'Reconciled')
    .reduce((acc, cur) => acc + (cur.credit - cur.debit), 0);

  const totalUnreconciled = bankReconciliationEntries
    .filter((e) => e.bankAccountId === selectedAccount?.id && e.status === 'Unreconciled')
    .reduce((acc, cur) => acc + (cur.credit - cur.debit), 0);

  const glBalance = (selectedAccount?.currentBalance || 0) + totalUnreconciled;
  const difference = (selectedAccount?.currentBalance || 0) - glBalance;

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-[#16223A] text-white p-6 rounded-2xl shadow-xl border border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-[#A9814A]/20 text-[#A9814A] font-bold text-[10px] rounded-full uppercase tracking-wider border border-[#A9814A]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Automated Ledger &amp; Statement Matching
            </span>
          </div>
          <h1 className="text-xl font-bold font-serif flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-[#A9814A]" />
            Bank Reconciliation Dashboard
          </h1>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Match bank statement lines against firm general ledger records for Trust and Office accounts. Instantly flag unreconciled items and maintain running balances for quarterly Bar Council compliance.
          </p>
        </div>

        {/* Bank Account Switcher */}
        <div className="bg-white/10 p-3 rounded-xl border border-white/15 shrink-0 space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-300 block">Select Target Bank Account</label>
          <select
            value={selectedBankAccountId}
            onChange={(e) => setSelectedBankAccountId(e.target.value)}
            className="bg-[#16223A] text-white font-bold p-2 rounded-lg border border-[#A9814A] outline-none text-xs cursor-pointer min-w-[240px]"
          >
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.accountName} ({acc.bankName} - {acc.accountNo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Account Balance Matching Summary */}
      {selectedAccount && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
            <div className="text-[10.5px] uppercase font-bold text-slate-500">Bank Statement Balance</div>
            <div className="text-xl font-bold font-mono text-slate-900">
              RM {selectedAccount.currentBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">
              {selectedAccount.type} Account • {selectedAccount.bankName}
            </div>
          </div>

          <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
            <div className="text-[10.5px] uppercase font-bold text-slate-500">Book (GL) Balance</div>
            <div className="text-xl font-bold font-mono text-slate-900">
              RM {glBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">
              Calculated from all ledger postings
            </div>
          </div>

          <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
            <div className="text-[10.5px] uppercase font-bold text-slate-500">Unreconciled Items</div>
            <div className="text-xl font-bold font-mono text-amber-700">
              RM {totalUnreconciled.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-800 font-medium">
              Pending clearing cheques / bank charges
            </div>
          </div>

          <div className={`p-4 border rounded-xl shadow-xs space-y-1 ${difference === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="text-[10.5px] uppercase font-bold text-slate-600">Reconciliation Variance</div>
            <div className={`text-xl font-bold font-mono ${difference === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              RM {difference.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-semibold flex items-center gap-1">
              {difference === 0 ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Perfectly Balanced
                </span>
              ) : (
                <span className="text-rose-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Unmatched Variance Detected
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Reconciliation Table Container */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs overflow-hidden">
        {/* Filters and Controls */}
        <div className="p-4 bg-[#F7F5F0] border-b border-[#E1DCCF] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search reference, description or payee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#A9814A]"
              />
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'All' ? 'bg-[#16223A] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('Unreconciled')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'Unreconciled' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Unreconciled
              </button>
              <button
                onClick={() => setStatusFilter('Reconciled')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'Reconciled' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Reconciled
              </button>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500">
            Showing {filteredEntries.length} entries for selected bank account
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3">Ref No</th>
                <th className="p-3">Type / Category</th>
                <th className="p-3">Description &amp; Payee</th>
                <th className="p-3 text-right">Debit (RM)</th>
                <th className="p-3 text-right">Credit (RM)</th>
                <th className="p-3 text-right">Running Balance (RM)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 whitespace-nowrap">
                    {entry.status === 'Reconciled' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Reconciled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Unreconciled
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{entry.date}</td>
                  <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">{entry.referenceNo}</td>
                  <td className="p-3 font-medium text-slate-700 whitespace-nowrap">GL #{entry.matchedGlNo || '1010'}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{entry.description}</div>
                    {entry.reconciledDate && (
                      <div className="text-[9.5px] text-emerald-700 italic">
                        Reconciled by {entry.reconciledBy || 'Finance'} on {entry.reconciledDate}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                    {entry.debit > 0 ? entry.debit.toLocaleString('en-MY', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    {entry.credit > 0 ? entry.credit.toLocaleString('en-MY', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    RM {(entry.credit - entry.debit).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => toggleReconcileEntry(entry.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[10.5px] transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                        entry.status === 'Reconciled'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {entry.status === 'Reconciled' ? (
                        <>
                          <X className="w-3 h-3" /> Unmark
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" /> Reconcile
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No reconciliation entries found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
