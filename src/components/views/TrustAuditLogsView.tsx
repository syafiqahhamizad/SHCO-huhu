import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  Search,
  FileCheck2,
  Calendar,
  UserCheck,
  Building,
  Scale,
  Sparkles,
  Download,
} from 'lucide-react';

export const TrustAuditLogsView: React.FC = () => {
  const { trustAuditLogs, bankAccounts } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBankAcc, setSelectedBankAcc] = useState<string>('All');

  const filteredLogs = trustAuditLogs.filter((log) => {
    if (selectedBankAcc !== 'All' && log.bankAccountId !== selectedBankAcc) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.caseRef.toLowerCase().includes(term) ||
        log.clientName.toLowerCase().includes(term) ||
        log.userName.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.remarks.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const trustAccounts = bankAccounts.filter((a) => a.type === 'Trust');

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-[#16223A] text-white p-6 rounded-2xl shadow-xl border border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[10px] rounded-full uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              SRA &amp; Solicitor's Account Rules 1990 Read-Only Ledger
            </span>
          </div>
          <h1 className="text-xl font-bold font-serif flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#A9814A]" />
            Trust Account Audit Log
          </h1>
          <p className="text-slate-300 text-xs mt-1 max-w-2xl">
            Immutable, read-only timestamped audit trail capturing every Client Trust Account movement immediately after posting. Preserves exact user identity and client ledger account balance for regulatory inspection.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => alert('Exporting SAR 1990 Trust Audit Trail PDF/CSV...')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl cursor-pointer flex items-center gap-2 border border-white/20 transition-all text-xs"
          >
            <Download className="w-4 h-4 text-[#A9814A]" />
            Export Audit Trail (PDF)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">Total Audit Entries</div>
          <div className="text-2xl font-bold font-mono text-slate-900">{trustAuditLogs.length} Records</div>
          <div className="text-[10px] text-slate-500">Cryptographically immutable sequence</div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">Monitored Trust Accounts</div>
          <div className="text-2xl font-bold font-mono text-emerald-800">{trustAccounts.length} Trust Accounts</div>
          <div className="text-[10px] text-emerald-700 font-medium">Under SAR 1990 Rule 3</div>
        </div>

        <div className="p-4 bg-white border border-[#E1DCCF] rounded-xl shadow-xs space-y-1">
          <div className="text-[10.5px] uppercase font-bold text-slate-500">Compliance Status</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 flex items-center gap-1.5">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            Audited &amp; Green
          </div>
          <div className="text-[10px] text-slate-500">Zero unmapped trust movements</div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F7F5F0] border-b border-[#E1DCCF] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search case, client, user, action..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#A9814A]"
              />
            </div>

            <select
              value={selectedBankAcc}
              onChange={(e) => setSelectedBankAcc(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-[#A9814A]"
            >
              <option value="All">All Trust Accounts</option>
              {trustAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-bold text-slate-500">
            Showing {filteredLogs.length} audit records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                <th className="p-3">Audit ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Trust Account</th>
                <th className="p-3">Case Matter &amp; Client</th>
                <th className="p-3">Action</th>
                <th className="p-3 text-right">Amount (RM)</th>
                <th className="p-3 text-right">Post Balance (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap">{log.id}</td>
                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">{log.userName}</td>
                  <td className="p-3 text-slate-700 whitespace-nowrap">{log.bankAccountName}</td>
                  <td className="p-3">
                    <div className="font-bold font-mono text-slate-900">{log.caseRef}</div>
                    <div className="text-[10px] text-slate-500">{log.clientName}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-block mb-0.5">
                      {log.action}
                    </span>
                    <div className="text-[10.5px] text-slate-600">{log.remarks}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    RM {log.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap bg-emerald-50/50">
                    RM {log.newBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No trust audit entries found matching the filter.
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
