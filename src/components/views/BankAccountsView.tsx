import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BankAccount } from '../../types';
import {
  Landmark,
  Plus,
  Building,
  ShieldCheck,
  Archive,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CreditCard,
  Lock,
} from 'lucide-react';

export const BankAccountsView: React.FC = () => {
  const { bankAccounts, addBankAccount, updateBankAccount, archiveBankAccount } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Form state
  const [bankName, setBankName] = useState('Maybank Islamic Berhad');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'Trust' | 'Office'>('Trust');
  const [swiftCode, setSwiftCode] = useState('MBBEKLKL');
  const [branchName, setBranchName] = useState('Menara Maybank, KL');
  const [currency, setCurrency] = useState('MYR');
  const [openingBalance, setOpeningBalance] = useState<number>(100000);
  const [currentBalance, setCurrentBalance] = useState<number>(100000);
  const [notes, setNotes] = useState('Operating in compliance with SAR 1990 Rule 3');

  const activeAccounts = bankAccounts.filter((a) => a.status === 'Active');
  const archivedAccounts = bankAccounts.filter((a) => a.status === 'Archived');

  const totalTrustBalance = activeAccounts
    .filter((a) => a.type === 'Trust')
    .reduce((acc, cur) => acc + cur.currentBalance, 0);

  const totalOfficeBalance = activeAccounts
    .filter((a) => a.type === 'Office')
    .reduce((acc, cur) => acc + cur.currentBalance, 0);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setBankName('Maybank Islamic Berhad');
    setAccountNo(`514839${Math.floor(100000 + Math.random() * 900000)}`);
    setAccountName('SYAFIQAH HAMIZAD & CO CLIENT A/C');
    setAccountType('Trust');
    setOpeningBalance(50000);
    setCurrentBalance(50000);
    setNotes('Established for client trust money isolation under SAR 1990.');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: BankAccount) => {
    setEditingAccount(acc);
    setBankName(acc.bankName);
    setAccountNo(acc.accountNo);
    setAccountName(acc.accountName);
    setAccountType(acc.type);
    setSwiftCode(acc.swiftCode || '');
    setBranchName(acc.branch || '');
    setOpeningBalance(acc.openingBalance);
    setCurrentBalance(acc.currentBalance);
    setNotes(acc.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAccount) {
      updateBankAccount(editingAccount.id, {
        bankName,
        accountNo,
        accountName,
        type: accountType,
        swiftCode,
        branch: branchName,
        openingBalance,
        currentBalance,
        notes,
      });
    } else {
      addBankAccount({
        accountNo,
        accountName,
        bankName,
        type: accountType,
        functions: accountType === 'Trust' ? ['Trust Account'] : ['Office Account'],
        swiftCode,
        branch: branchName,
        openingBalance,
        currentBalance,
        status: 'Active',
        notes,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-[#16223A] text-white p-6 rounded-2xl shadow-xl border border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-[#A9814A]/20 text-[#A9814A] font-bold text-[10px] rounded-full uppercase tracking-wider border border-[#A9814A]/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Solicitor's Account Rules 1990 Compliant
            </span>
          </div>
          <h1 className="text-xl font-bold font-serif flex items-center gap-2">
            <Landmark className="w-6 h-6 text-[#A9814A]" />
            Firm Bank Accounts &amp; Virtual Pots
          </h1>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Manage segregated Client Trust Accounts and Office Operating Accounts. Mandatory account assignment ensures audit-proof compliance with Malaysian Bar Council rules.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl cursor-pointer flex items-center gap-2 shadow-md shrink-0 transition-all text-xs"
        >
          <Plus className="w-4 h-4" />
          Add Bank Account
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
            <span>Total Trust Account Balance</span>
            <Lock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">
            RM {totalTrustBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Protected Client Funds (SAR 1990 Ring-Fenced)
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
            <span>Total Office Account Balance</span>
            <Building className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            RM {totalOfficeBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Operating Funds &amp; Firm Capital Accounts
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-bold text-[11px]">
            <span>Configured Bank Accounts</span>
            <Sparkles className="w-4 h-4 text-[#A9814A]" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {activeAccounts.length} Active <span className="text-xs text-slate-500">({archivedAccounts.length} Archived)</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            All transaction forms strictly enforce account selection
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F7F5F0] border-b border-[#E1DCCF] flex items-center justify-between">
          <h2 className="font-bold text-slate-800 font-serif text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#A9814A]" />
            Active Firm Accounts List
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Showing {activeAccounts.length} configured accounts
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {activeAccounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      acc.type === 'Trust'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {acc.type} Account
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{acc.accountName}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono">
                  <span><strong>Bank:</strong> {acc.bankName}</span>
                  <span><strong>Acc No:</strong> {acc.accountNo}</span>
                  {acc.swiftCode && <span><strong>SWIFT:</strong> {acc.swiftCode}</span>}
                  {acc.branch && <span><strong>Branch:</strong> {acc.branch}</span>}
                </div>

                {acc.notes && (
                  <p className="text-[11px] text-slate-500 italic">{acc.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Current Balance</div>
                  <div className="font-bold font-mono text-sm text-slate-900">
                    RM {acc.currentBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                  <button
                    onClick={() => handleOpenEdit(acc)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    title="Edit Bank Account"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => archiveBankAccount(acc.id)}
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Archive Account"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeAccounts.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No active bank accounts found. Click "Add Bank Account" to configure one.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#16223A] text-white flex items-center justify-between">
              <h3 className="font-bold font-serif text-sm flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#A9814A]" />
                {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-300 hover:text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Designation *</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'Trust' | 'Office')}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  >
                    <option value="Trust">Trust (Client Account - SAR 1990)</option>
                    <option value="Office">Office (Operating Account)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. Maybank Islamic Berhad"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Official Account Name *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  placeholder="e.g. SYAFIQAH HAMIZAD & CO CLIENT ACCOUNT"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. 514839001234"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">SWIFT / BIC Code</label>
                  <input
                    type="text"
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                    placeholder="e.g. MBBEKLKL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Opening Balance (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Current Balance (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Special Instructions</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#A9814A]"
                  placeholder="e.g. Mandatory Trust Account under Rule 3 SAR 1990..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {editingAccount ? 'Save Changes' : 'Create Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
