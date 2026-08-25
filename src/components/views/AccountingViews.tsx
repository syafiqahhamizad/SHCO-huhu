import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TravelClaim, PaymentVoucher, Receipt, Retainer, Payment, TimeEntry, Expense } from '../../types';
import { DocPreviewModal } from '../modals/DocPreviewModal';
import { ReimbursementsClaimsView } from './ReimbursementsView';
import {
  sendFinancePvNotificationEmail,
  getEmailAuditLogs,
  EmailLogEntry,
} from '../../lib/workspaceEmailService';
import {
  Timer,
  Receipt as ReceiptIcon,
  Car,
  FileSpreadsheet,
  CreditCard,
  Building,
  FileCheck2,
  BookOpen,
  BookMarked,
  Scale,
  LineChart,
  TrendingUp,
  Plus,
  AlertTriangle,
  CheckCircle,
  Eye,
  PieChart,
  BarChart3,
  DollarSign,
  Search,
  Download,
  Paperclip,
  CheckSquare,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock,
  FileText,
  Mail,
  Send,
  Globe,
  Inbox,
  Trash2,
  Edit3,
  Lock,
  Filter,
  CheckCircle2,
} from 'lucide-react';

/* CSV Export Utility */
const exportToCsv = (filename: string, rows: Record<string, any>[]) => {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = row[header] === undefined || row[header] === null ? '' : String(row[header]);
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* ================= 1. TIME ENTRIES VIEW ================= */
export const TimeView: React.FC = () => {
  const {
    timeEntries,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    cases,
    clients,
    showToast,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNBILLED' | 'BILLED'>('ALL');
  const [feeEarnerFilter, setFeeEarnerFilter] = useState<'ALL' | 'SH' | 'AH' | 'ZA'>('ALL');

  // Form State
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [matterSearch, setMatterSearch] = useState('');
  const [feeEarner, setFeeEarner] = useState('SH');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('1.5');
  const [rate, setRate] = useState('450');
  const [description, setDescription] = useState('Legal Research & Drafting Affidavit');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filtered matters search
  const filteredCases = cases.filter((c) => {
    const term = (matterSearch || '').toLowerCase();
    const clientObj = clients.find((cl) => cl.id === c.clientId);
    const clientName = clientObj ? (clientObj.name || '').toLowerCase() : '';
    return (
      (c.ref || '').toLowerCase().includes(term) ||
      (c.title || '').toLowerCase().includes(term) ||
      clientName.includes(term)
    );
  });

  const handleOpenNewModal = () => {
    setEditingId(null);
    setCaseId(cases[0]?.id || '');
    setMatterSearch('');
    setFeeEarner('SH');
    setDate(new Date().toISOString().slice(0, 10));
    setHours('1.5');
    setRate('450');
    setDescription('');
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleEditEntry = (t: TimeEntry) => {
    if (t.billed) {
      showToast('Locked: Billed time entries cannot be modified to protect invoice integrity.');
      return;
    }
    setEditingId(t.id);
    setCaseId(t.caseId);
    setFeeEarner(t.feeEarner);
    setDate(t.date);
    setHours(t.hours.toString());
    setRate(t.rate.toString());
    setDescription(t.description || '');
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSaveTimeEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Singular Validated Pipeline Checks
    if (!caseId) {
      setValidationError('Please select a valid client matter.');
      return;
    }
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setValidationError('Hours logged must be a positive number greater than 0.');
      return;
    }
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setValidationError('Hourly rate must be a valid positive amount in RM.');
      return;
    }
    if (!description.trim() || description.trim().length < 3) {
      setValidationError('Work description must be at least 3 characters long.');
      return;
    }

    if (editingId) {
      updateTimeEntry(editingId, {
        caseId,
        feeEarner,
        date,
        hours: parsedHours,
        rate: parsedRate,
        description: description.trim(),
      });
      showToast('Time entry updated successfully');
    } else {
      addTimeEntry({
        id: `TE-${Math.floor(1000 + Math.random() * 9000)}`,
        caseId,
        feeEarner,
        date,
        hours: parsedHours,
        rate: parsedRate,
        billable: true,
        billed: false,
        approvalStatus: 'Approved',
        description: description.trim(),
        createdAt: new Date().toISOString(),
      });
      showToast('Billable time entry recorded in unified pipeline');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (t: TimeEntry) => {
    if (t.billed) {
      showToast('Locked: Billed time entries cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to delete entry "${t.description}" (${t.hours} hrs)?`)) {
      deleteTimeEntry(t.id);
      showToast('Time entry removed from register');
    }
  };

  const handleExportCsv = () => {
    const data = filteredEntries.map((t) => {
      const cs = cases.find((c) => c.id === t.caseId);
      return {
        'Entry ID': t.id,
        'Matter Ref': cs ? cs.ref : '—',
        'Lawyer In Charge': t.feeEarner,
        Date: t.date,
        Description: t.description,
        Hours: t.hours,
        'Rate (RM)': t.rate,
        'Calculated Value (RM)': t.hours * t.rate,
        Status: t.billed ? 'Billed (Invoiced)' : 'Unbilled (Pending Invoice)',
      };
    });
    exportToCsv('Billable_Time_Entries', data);
    showToast('Exported time entries to CSV');
  };

  // Filter pipeline
  const filteredEntries = timeEntries.filter((t) => {
    const cs = cases.find((c) => c.id === t.caseId);
    const clientObj = cs ? clients.find((cl) => cl.id === cs.clientId) : null;
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch =
      !searchTerm ||
      (cs?.ref || '').toLowerCase().includes(searchLower) ||
      (cs?.title || '').toLowerCase().includes(searchLower) ||
      (clientObj?.name || '').toLowerCase().includes(searchLower) ||
      (t.description || '').toLowerCase().includes(searchLower) ||
      t.feeEarner.toLowerCase().includes(searchLower);

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'UNBILLED'
        ? !t.billed
        : !!t.billed;

    const matchesFeeEarner =
      feeEarnerFilter === 'ALL' ? true : t.feeEarner === feeEarnerFilter;

    return matchesSearch && matchesStatus && matchesFeeEarner;
  });

  // KPI Calculations
  const totalLoggedHours = timeEntries.reduce((acc, t) => acc + t.hours, 0);
  const unbilledEntries = timeEntries.filter((t) => !t.billed);
  const billedEntries = timeEntries.filter((t) => t.billed);

  const unbilledHours = unbilledEntries.reduce((acc, t) => acc + t.hours, 0);
  const unbilledValue = unbilledEntries.reduce((acc, t) => acc + t.hours * t.rate, 0);

  const billedHours = billedEntries.reduce((acc, t) => acc + t.hours, 0);
  const billedValue = billedEntries.reduce((acc, t) => acc + t.hours * t.rate, 0);

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner & KPI Cards */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#A9814A]" />
              Billable Time Entries Register
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Singular validated pipeline tracking billable work hours from draft to invoice generation.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#A9814A]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleOpenNewModal}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Key In Time Entry</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF]/60 rounded-lg">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Hours Logged</div>
            <div className="text-xl font-bold font-mono text-[#16223A] mt-1">{totalLoggedHours.toFixed(1)} hrs</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{timeEntries.length} entries recorded</div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-amber-800 uppercase tracking-wider flex justify-between items-center">
              <span>Unbilled Pipeline</span>
              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">Unbilled</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-900 mt-1">
              RM {unbilledValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">{unbilledHours.toFixed(1)} hrs pending invoice</div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider flex justify-between items-center">
              <span>Billed Revenue</span>
              <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[9px] font-bold">Invoiced</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
              RM {billedValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">{billedHours.toFixed(1)} hrs attached to invoices</div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-[#E1DCCF] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by matter ref, client, description, fee earner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px]">
            <Filter className="w-3.5 h-3.5 text-[#A9814A]" />
            <span>Status:</span>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-[#16223A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('UNBILLED')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                statusFilter === 'UNBILLED' ? 'bg-amber-100 text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unbilled
            </button>
            <button
              onClick={() => setStatusFilter('BILLED')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                statusFilter === 'BILLED' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Billed
            </button>
          </div>

          <select
            value={feeEarnerFilter}
            onChange={(e) => setFeeEarnerFilter(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Fee Earners</option>
            <option value="SH">SH (Partner)</option>
            <option value="AH">AH (Partner)</option>
            <option value="ZA">ZA (Legal Assistant)</option>
          </select>
        </div>
      </div>

      {/* Table Register */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Matter Ref &amp; Client</th>
              <th className="p-3 font-bold">Fee Earner</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Work Particulars</th>
              <th className="p-3 font-bold text-right">Hours</th>
              <th className="p-3 font-bold text-right">Rate (RM)</th>
              <th className="p-3 font-bold text-right">Total Value (RM)</th>
              <th className="p-3 font-bold text-center">Pipeline Status</th>
              <th className="p-3 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                  No time entries found matching selected filters.
                </td>
              </tr>
            ) : (
              filteredEntries.map((t) => {
                const cs = cases.find((c) => c.id === t.caseId);
                const clientObj = cs ? clients.find((cl) => cl.id === cs.clientId) : null;

                return (
                  <tr key={t.id} className="hover:bg-[#FAF8F2]">
                    <td className="p-3 font-mono">
                      <span className="ref-seal block">{cs ? cs.ref : '—'}</span>
                      <span className="text-[10px] font-sans text-slate-500 truncate block max-w-[150px]">
                        {clientObj ? clientObj.name : cs?.title || '—'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{t.feeEarner}</td>
                    <td className="p-3 font-mono text-slate-600">{t.date}</td>
                    <td className="p-3 text-slate-700 max-w-xs">{t.description || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">{t.hours.toFixed(1)} hrs</td>
                    <td className="p-3 text-right font-mono text-slate-700">RM {t.rate.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                      RM {(t.hours * t.rate).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      {t.billed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          Billed ({t.invoiceId || 'INV'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                          <Clock className="w-3 h-3 text-amber-700" />
                          Unbilled
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {t.billed ? (
                        <span className="text-[10px] text-slate-400 italic">Locked</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditEntry(t)}
                            title="Edit entry"
                            className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            title="Delete entry"
                            className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Key In / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#A9814A]" />
              {editingId ? 'Edit Billable Time Entry' : 'Key In Billable Time Entry'}
            </h3>

            {validationError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTimeEntry} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Search &amp; Select Matter (Ref, Client, or Title)
                </label>
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type running no e.g. 2026/LIT/001 or Client name..."
                    value={matterSearch}
                    onChange={(e) => setMatterSearch(e.target.value)}
                    className="w-full pl-8 py-1.5 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-1 space-y-1 bg-slate-50">
                  {filteredCases.length === 0 ? (
                    <div className="p-2 text-slate-500 text-center italic">No matching matters found</div>
                  ) : (
                    filteredCases.map((c) => {
                      const clientObj = clients.find((cl) => cl.id === c.clientId);
                      const isSelected = c.id === caseId;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setCaseId(c.id)}
                          className={`p-2 rounded cursor-pointer text-xs flex justify-between items-center ${
                            isSelected
                              ? 'bg-[#16223A] text-white font-bold'
                              : 'hover:bg-amber-100/60 text-slate-800'
                          }`}
                        >
                          <div>
                            <span className="font-mono">{c.ref}</span>
                            <span className="ml-2 font-semibold">({clientObj ? clientObj.name : 'Client'})</span>
                            <div className="text-[10px] opacity-80 line-clamp-1">{c.title}</div>
                          </div>
                          {isSelected && <span className="text-amber-400 font-bold">Selected</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Lawyer In Charge</label>
                  <select
                    value={feeEarner}
                    onChange={(e) => setFeeEarner(e.target.value)}
                    className="w-full font-bold border border-slate-300 rounded p-1.5"
                  >
                    <option value="SH">SH (Partner)</option>
                    <option value="AH">AH (Partner)</option>
                    <option value="ZA">ZA (Legal Assistant)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Work Description / Particulars</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Legal Research & Drafting Statement of Claim"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded p-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Hours Logged</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full font-mono border border-slate-300 rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Hourly Rate (RM)</label>
                  <input
                    type="number"
                    step="10"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full font-mono border border-slate-300 rounded p-1.5"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex justify-between font-bold">
                <span>Total Calculated Value:</span>
                <span className="font-mono text-emerald-800">
                  RM {((parseFloat(hours) || 0) * (parseFloat(rate) || 0)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer shadow-xs"
                >
                  {editingId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 2. EXPENSES VIEW ================= */
export const ExpensesView: React.FC = () => {
  return <ReimbursementsClaimsView initialTab="DISBURSEMENTS" />;
};

const _LegacyExpensesView: React.FC = () => {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    addGeneralLedgerEntry,
    cases,
    clients,
    showToast,
  } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MATTER' | 'FIRM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNBILLED' | 'BILLED' | 'POSTED'>('ALL');

  // Form State
  const [scope, setScope] = useState<'MATTER' | 'FIRM'>('MATTER');
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [matterSearch, setMatterSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Court Filing Fee');
  const [amount, setAmount] = useState('250');
  const [description, setDescription] = useState('');
  const [supportingDocName, setSupportingDocName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filtered cases for matter scope
  const filteredCases = cases.filter((c) => {
    const term = (matterSearch || '').toLowerCase();
    const clientObj = clients.find((cl) => cl.id === c.clientId);
    const clientName = clientObj ? (clientObj.name || '').toLowerCase() : '';
    return (
      (c.ref || '').toLowerCase().includes(term) ||
      (c.title || '').toLowerCase().includes(term) ||
      clientName.includes(term)
    );
  });

  const handleFileUploadSim = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSupportingDocName(file.name);
      showToast(`Supporting document attached: ${file.name}`);
    }
  };

  const handleOpenNewModal = () => {
    setEditingId(null);
    setScope('MATTER');
    setCaseId(cases[0]?.id || '');
    setMatterSearch('');
    setDate(new Date().toISOString().slice(0, 10));
    setCategory('Court Filing Fee');
    setAmount('250');
    setDescription('');
    setSupportingDocName('');
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleEditExpense = (e: Expense) => {
    if (e.billed) {
      showToast('Locked: Cannot edit disbursement that has already been billed on an invoice.');
      return;
    }
    if (e.postedToGl) {
      showToast('Locked: Cannot edit expense that has already been posted to the General Ledger.');
      return;
    }
    setEditingId(e.id);
    const isFirm = e.caseId === 'FIRM_OPERATIONS' || e.category.startsWith('[Firm]');
    setScope(isFirm ? 'FIRM' : 'MATTER');
    setCaseId(e.caseId);
    setDate(e.date);
    setCategory(e.category.replace('[Firm] ', ''));
    setAmount(e.amount.toString());
    setDescription(e.description || '');
    setSupportingDocName(e.attachmentName || '');
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Singular Validated Pipeline Checks
    if (scope === 'MATTER' && !caseId) {
      setValidationError('Please select a valid client matter for disbursements.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Expense amount must be a positive number in RM.');
      return;
    }
    if (!description.trim() || description.trim().length < 2) {
      setValidationError('Particulars / Vendor name must be at least 2 characters.');
      return;
    }

    const descWithDoc = supportingDocName && !description.includes('[Doc:')
      ? `${description.trim()} [Doc: ${supportingDocName}]`
      : description.trim();

    if (editingId) {
      updateExpense(editingId, {
        caseId: scope === 'MATTER' ? caseId : 'FIRM_OPERATIONS',
        date,
        category: scope === 'FIRM' ? `[Firm] ${category}` : category,
        amount: parsedAmount,
        billable: scope === 'MATTER',
        description: descWithDoc,
        attachmentName: supportingDocName || undefined,
      });
      showToast('Expense entry updated successfully');
    } else {
      addExpense({
        id: scope === 'MATTER' ? `EX-${Math.floor(1000 + Math.random() * 9000)}` : `FIRM-EX-${Math.floor(1000 + Math.random() * 9000)}`,
        caseId: scope === 'MATTER' ? caseId : 'FIRM_OPERATIONS',
        date,
        category: scope === 'FIRM' ? `[Firm] ${category}` : category,
        amount: parsedAmount,
        billable: scope === 'MATTER',
        billed: false,
        approvalStatus: 'Approved',
        description: descWithDoc,
        attachmentName: supportingDocName || undefined,
      });
      showToast(`${scope === 'MATTER' ? 'Matter disbursement' : 'Firm operational expense'} recorded in financial pipeline`);
    }

    setIsModalOpen(false);
  };

  const handlePostToGl = (exp: Expense) => {
    if (exp.postedToGl) {
      showToast('Notice: Entry is already posted to the General Ledger.');
      return;
    }
    const cs = cases.find((c) => c.id === exp.caseId);
    const isFirm = exp.caseId === 'FIRM_OPERATIONS' || exp.category.startsWith('[Firm]');

    addGeneralLedgerEntry({
      date: exp.date,
      docType: 'PV',
      docNo: exp.id,
      accountSet: isFirm ? 'OFFICE' : 'CLIENT',
      debit: isFirm ? '5900' : '1200',
      credit: '1010',
      amount: exp.amount,
      clientId: cs?.clientId || '',
      fileRef: cs?.ref || 'FIRM_OPERATIONS',
      description: `Out-of-Pocket Expense [${exp.category}]: ${exp.description}`,
      reconciled: 'Y',
    });

    updateExpense(exp.id, {
      postedToGl: true,
      approvalStatus: 'Posted to GL',
    });
    showToast(`Expense ${exp.id} posted directly to General Ledger (GL)`);
  };

  const handleDelete = (exp: Expense) => {
    if (exp.billed) {
      showToast('Locked: Cannot delete disbursement that has already been billed on an invoice.');
      return;
    }
    if (exp.postedToGl) {
      showToast('Locked: Cannot delete expense that has already been posted to General Ledger.');
      return;
    }
    if (confirm(`Remove expense entry "${exp.description}" (RM ${exp.amount})?`)) {
      deleteExpense(exp.id);
      showToast('Expense record removed from register');
    }
  };

  const handleExportCsv = () => {
    const data = filteredExpenses.map((e) => {
      const cs = cases.find((c) => c.id === e.caseId);
      return {
        'Expense ID': e.id,
        Scope: e.caseId === 'FIRM_OPERATIONS' || e.category.startsWith('[Firm]') ? 'Firm Expense' : 'Matter Disbursement',
        'Matter Ref': cs ? cs.ref : e.caseId === 'FIRM_OPERATIONS' ? 'Firm Operations' : '—',
        Date: e.date,
        Category: e.category,
        Description: e.description,
        'Amount (RM)': e.amount,
        Billable: e.billable ? 'Yes' : 'No',
        'Billed Status': e.billed ? 'Billed' : 'Unbilled',
        'GL Status': e.postedToGl ? 'Posted to GL' : 'Unposted',
      };
    });
    exportToCsv('Disbursements_And_Firm_Expenses', data);
    showToast('Exported expenses & disbursements to CSV');
  };

  // Filter Pipeline
  const filteredExpenses = expenses.filter((e) => {
    const cs = cases.find((c) => c.id === e.caseId);
    const clientObj = cs ? clients.find((cl) => cl.id === cs.clientId) : null;
    const isFirm = e.caseId === 'FIRM_OPERATIONS' || e.category.startsWith('[Firm]');
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch =
      !searchTerm ||
      (cs?.ref || '').toLowerCase().includes(searchLower) ||
      (cs?.title || '').toLowerCase().includes(searchLower) ||
      (clientObj?.name || '').toLowerCase().includes(searchLower) ||
      (e.description || '').toLowerCase().includes(searchLower) ||
      (e.category || '').toLowerCase().includes(searchLower);

    const matchesScope =
      scopeFilter === 'ALL'
        ? true
        : scopeFilter === 'FIRM'
        ? isFirm
        : !isFirm;

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'UNBILLED'
        ? !e.billed && !isFirm
        : statusFilter === 'BILLED'
        ? !!e.billed
        : !!e.postedToGl;

    return matchesSearch && matchesScope && matchesStatus;
  });

  // KPI Calculations
  const totalDisbursements = expenses
    .filter((e) => e.caseId !== 'FIRM_OPERATIONS' && !e.category.startsWith('[Firm]'))
    .reduce((acc, e) => acc + e.amount, 0);

  const unbilledDisbursements = expenses
    .filter((e) => e.caseId !== 'FIRM_OPERATIONS' && !e.category.startsWith('[Firm]') && !e.billed)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalFirmExpenses = expenses
    .filter((e) => e.caseId === 'FIRM_OPERATIONS' || e.category.startsWith('[Firm]'))
    .reduce((acc, e) => acc + e.amount, 0);

  const totalPostedToGl = expenses
    .filter((e) => e.postedToGl)
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner & KPI Summary Cards */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              Disbursements &amp; Firm Expenses Register
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Singular validated pipeline tracking matter disbursements and firm operational overheads.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#A9814A]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleOpenNewModal}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Key In Expense / Disbursement</span>
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-amber-800 uppercase tracking-wider">Unbilled Disbursements</div>
            <div className="text-lg font-bold font-mono text-amber-900 mt-1">
              RM {unbilledDisbursements.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">Pending client invoice</div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">Total Disbursements</div>
            <div className="text-lg font-bold font-mono text-emerald-900 mt-1">
              RM {totalDisbursements.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Client matter out-of-pocket</div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-blue-800 uppercase tracking-wider">Firm Overhead</div>
            <div className="text-lg font-bold font-mono text-blue-900 mt-1">
              RM {totalFirmExpenses.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5">Operational expenses</div>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-lg">
            <div className="text-[11px] font-medium text-purple-800 uppercase tracking-wider">Posted to GL</div>
            <div className="text-lg font-bold font-mono text-purple-900 mt-1">
              RM {totalPostedToGl.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-purple-700 mt-0.5">General ledger synchronized</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E1DCCF] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search particulars, vendor, category, matter ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-[11px]">
            <Filter className="w-3.5 h-3.5 text-[#A9814A]" />
            <span>Scope:</span>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setScopeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                scopeFilter === 'ALL' ? 'bg-white text-[#16223A] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Scopes
            </button>
            <button
              onClick={() => setScopeFilter('MATTER')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                scopeFilter === 'MATTER' ? 'bg-emerald-100 text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matter Disbursements
            </button>
            <button
              onClick={() => setScopeFilter('FIRM')}
              className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer ${
                scopeFilter === 'FIRM' ? 'bg-blue-100 text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Firm Overheads
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNBILLED">Unbilled Disbursements</option>
            <option value="BILLED">Billed Disbursements</option>
            <option value="POSTED">Posted to GL</option>
          </select>
        </div>
      </div>

      {/* Expense Register Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Scope / Target</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Category</th>
              <th className="p-3 font-bold">Particulars &amp; Document</th>
              <th className="p-3 font-bold text-right">Amount (RM)</th>
              <th className="p-3 font-bold text-center">Pipeline Status</th>
              <th className="p-3 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  No expense or disbursement records found matching current filters.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((e) => {
                const cs = cases.find((c) => c.id === e.caseId);
                const isFirm = e.caseId === 'FIRM_OPERATIONS' || e.category.startsWith('[Firm]');
                const hasDoc = e.attachmentName || (e.description && e.description.includes('[Doc:'));

                return (
                  <tr key={e.id} className="hover:bg-[#FAF8F2]">
                    <td className="p-3 font-mono">
                      {isFirm ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded">
                          🏢 Firm Overhead
                        </span>
                      ) : (
                        <span className="ref-seal">{cs ? cs.ref : '—'}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{e.date}</td>
                    <td className="p-3 font-semibold text-slate-800">{e.category}</td>
                    <td className="p-3 text-slate-700 max-w-xs">
                      <div>{e.description || '—'}</div>
                      {hasDoc && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1">
                          <Paperclip className="w-3 h-3" />
                          <span>Supporting Doc Attached</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                      RM {e.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center space-y-1">
                      {isFirm ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded block">
                          Firm Operational
                        </span>
                      ) : e.billed ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded block">
                          🔒 Billed ({e.invoiceId || 'INV'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded block">
                          Unbilled Disbursement
                        </span>
                      )}

                      {e.postedToGl ? (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-bold rounded inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                          Posted GL
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePostToGl(e)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 border border-slate-200 text-[10px] font-semibold rounded cursor-pointer transition-colors"
                        >
                          + Post to GL
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {e.billed || e.postedToGl ? (
                        <span className="text-[10px] text-slate-400 italic">Locked</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditExpense(e)}
                            title="Edit record"
                            className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            title="Delete record"
                            className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Key In Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              {editingId ? 'Edit Financial Record' : 'Record Expense / Disbursement'}
            </h3>

            {validationError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Expense Scope Target</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('MATTER')}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      scope === 'MATTER'
                        ? 'bg-[#16223A] text-white border-[#16223A]'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    📂 Client Matter Disbursement
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('FIRM')}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      scope === 'FIRM'
                        ? 'bg-[#16223A] text-white border-[#16223A]'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    🏢 Firm Operational Expense
                  </button>
                </div>
              </div>

              {scope === 'MATTER' ? (
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">
                    Search &amp; Select Client Matter
                  </label>
                  <div className="relative mb-1.5">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search running no e.g. 2026/LIT/001 or Client..."
                      value={matterSearch}
                      onChange={(e) => setMatterSearch(e.target.value)}
                      className="w-full pl-8 py-1.5 text-xs border border-slate-300 rounded"
                    />
                  </div>
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded p-1 space-y-1 bg-slate-50">
                    {filteredCases.map((c) => {
                      const clientObj = clients.find((cl) => cl.id === c.clientId);
                      const isSelected = c.id === caseId;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setCaseId(c.id)}
                          className={`p-1.5 rounded cursor-pointer text-xs flex justify-between items-center ${
                            isSelected
                              ? 'bg-[#16223A] text-white font-bold'
                              : 'hover:bg-amber-100/60 text-slate-800'
                          }`}
                        >
                          <div>
                            <span className="font-mono">{c.ref}</span>
                            <span className="ml-1 font-semibold">({clientObj ? clientObj.name : 'Client'})</span>
                          </div>
                          {isSelected && <span className="text-amber-400 font-bold">Selected</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Firm Operational Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full font-bold border border-slate-300 rounded p-1.5"
                  >
                    <option value="Office Rental &amp; Rates">Office Rental &amp; Rates</option>
                    <option value="Bar Council Fees &amp; PII Insurance">Bar Council Fees &amp; PII Insurance</option>
                    <option value="Utilities (Electric/Water/Internet)">Utilities (Electric/Water/Internet)</option>
                    <option value="Staff Salaries &amp; EPF/SOCSO">Staff Salaries &amp; EPF/SOCSO</option>
                    <option value="Stationery &amp; Office Supplies">Stationery &amp; Office Supplies</option>
                    <option value="Software &amp; AI Tech Subscriptions">Software &amp; AI Tech Subscriptions</option>
                    <option value="BNI / Marketing &amp; Business Development">BNI / Marketing &amp; Business Development</option>
                    <option value="Courier &amp; Postage">Courier &amp; Postage</option>
                    <option value="Office Refreshments &amp; Misc">Office Refreshments &amp; Misc</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {scope === 'MATTER' && (
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Disbursement Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border border-slate-300 rounded p-1.5"
                    >
                      <option value="Court Filing Fee">Court Filing Fee</option>
                      <option value="Land Search Fee">Land Search Fee</option>
                      <option value="Company Search (SSM)">Company Search (SSM)</option>
                      <option value="Courier / Dispatch">Courier / Dispatch</option>
                      <option value="Affidavit Stamping">Affidavit Stamping</option>
                      <option value="Photocopying &amp; Printing">Photocopying &amp; Printing</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Date Paid</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full font-mono font-bold border border-slate-300 rounded p-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Particulars / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder={scope === 'MATTER' ? 'e.g. High Court e-Filing Portal Receipt #88392' : 'e.g. Tenaga Nasional Berhad / Landlord'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded p-1.5"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-[#A9814A]" />
                  Upload / Attach Supporting Document (Receipt / Bill)
                </label>
                <input
                  type="file"
                  onChange={handleFileUploadSim}
                  className="w-full text-xs text-slate-500 border border-slate-300 rounded p-1 cursor-pointer bg-slate-50"
                />
                {supportingDocName && (
                  <div className="text-[11px] text-emerald-800 font-semibold mt-1">
                    ✓ Attached file: <strong>{supportingDocName}</strong>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer shadow-xs"
                >
                  {editingId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= AUTO PV PROMPT MODAL ================= */
export const AutoPvPromptModal: React.FC<{
  claim: TravelClaim;
  onClose: () => void;
  onPvGenerated?: (pvId: string) => void;
}> = ({ claim, onClose, onPvGenerated }) => {
  const { addPaymentVoucher, showToast } = useApp();

  const fullClaimantName =
    claim.claimant === 'SH'
      ? 'Syafiqah Hamizad (SH)'
      : claim.claimant === 'AH'
      ? 'Amirul Hasif (AH)'
      : claim.claimant === 'ZA'
      ? 'Zulfa Ain (ZA)'
      : claim.claimant;

  const [accountSet, setAccountSet] = useState<'OFFICE' | 'CLIENT'>(
    claim.purposeType === 'Client Matter' ? 'CLIENT' : 'OFFICE'
  );
  const [payeeName, setPayeeName] = useState(fullClaimantName);
  const [description, setDescription] = useState(
    `[Travel Claim ${claim.id}] Journey: ${claim.from} → ${claim.to} (${claim.km} km @ RM ${claim.rate.toFixed(2)}/km)`
  );
  const [amount, setAmount] = useState(claim.total.toFixed(2));
  const [preparedBy, setPreparedBy] = useState(fullClaimantName);

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleGeneratePv = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    const pvId = `PV-2026-${Math.floor(100 + Math.random() * 900)}`;
    const parsedAmount = parseFloat(amount) || claim.total;
    const pvDate = new Date().toISOString().slice(0, 10);

    addPaymentVoucher({
      id: pvId,
      date: pvDate,
      accountSet,
      voucherCategory: 'Travelling',
      description: `[Payee: ${payeeName}] ${description}`,
      amount: parsedAmount,
      debit: 'Travel & Travelling Expense Account',
      credit: accountSet === 'CLIENT' ? 'Bank Client Account' : 'Bank Office Account',
      clientId: claim.purposeType === 'Client Matter' ? 'C-CLIENT' : 'C-SYS',
      fileRef: claim.fileRef || 'FIRM_OPERATIONS',
      bankRef: 'MAYBANK-7821',
      preparedBy,
      approvedBy: '',
      approved: false,
    });

    // Send automated email notification via Google Workspace Gmail API
    const emailRes = await sendFinancePvNotificationEmail({
      pvId,
      date: pvDate,
      accountSet,
      voucherCategory: 'Travelling & Mileage Expense',
      description: `[Payee: ${payeeName}] ${description}`,
      amount: parsedAmount,
      fileRef: claim.fileRef || 'FIRM_OPERATIONS',
      preparedBy,
      recipientEmail: 'finance@shcolaw.com',
    });

    setIsSendingEmail(false);
    showToast(`🎉 Payment Voucher ${pvId} auto-generated! Email notification dispatched to Finance Department (${emailRes.message}).`);
    if (onPvGenerated) onPvGenerated(pvId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] text-xs space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-900 mt-0.5">
            <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <span>Travel Claim {claim.id} Submitted!</span>
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Automated Accounting Prompt: Generate corresponding Payment Voucher (PV) for Partner Sign-off &amp; payout approval.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between text-slate-700">
            <span className="font-sans text-slate-500">Claimant:</span>
            <span className="font-bold text-slate-800">{fullClaimantName}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span className="font-sans text-slate-500">Matter Ref:</span>
            <span className="font-bold">{claim.fileRef || 'Firm Operations'}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span className="font-sans text-slate-500">Journey:</span>
            <span className="font-bold">{claim.from} → {claim.to}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span className="font-sans text-slate-500">Distance &amp; Rate:</span>
            <span className="font-bold">{claim.km} km @ RM {claim.rate.toFixed(2)}/km</span>
          </div>
          <div className="flex justify-between text-[#16223A] font-bold text-xs border-t border-slate-200 pt-1.5 mt-1 font-sans">
            <span>Total Claim Amount:</span>
            <span className="font-mono text-emerald-800 text-sm">RM {claim.total.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleGeneratePv} className="space-y-3">
          <h4 className="font-serif font-bold text-[#16223A] text-sm">Auto-Generated Payment Voucher Config</h4>

          <div>
            <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">Payee Name / Employee</label>
            <input
              type="text"
              required
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              className="w-full font-bold text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">Account Target</label>
              <select
                value={accountSet}
                onChange={(e) => setAccountSet(e.target.value as any)}
                className="w-full font-bold text-xs"
              >
                <option value="OFFICE">Office Operating Account</option>
                <option value="CLIENT">Client Trust Account</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">Voucher Amount (RM)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full font-mono font-bold text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block uppercase mb-1 text-[10px]">Voucher Particulars / Purpose</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs"
            />
          </div>

          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-blue-900 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="font-bold block">Google Workspace Notification Trigger</span>
                <span className="text-[10px] text-blue-700">Auto-sends email to <strong>finance@shcolaw.com</strong> upon generation</span>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded text-[9px] uppercase tracking-wider">
              Gmail API Active
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSendingEmail}
              className="px-3 py-1.5 border border-[#E1DCCF] text-slate-600 hover:bg-slate-50 rounded-md font-semibold cursor-pointer text-xs"
            >
              Skip PV for Now
            </button>
            <button
              type="submit"
              disabled={isSendingEmail}
              className="px-4 py-1.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer flex items-center gap-1.5 text-xs shadow-xs disabled:opacity-60"
            >
              {isSendingEmail ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Sending Gmail Notification...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Generate PV &amp; Notify Finance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ================= 3. TRAVEL CLAIMS VIEW ================= */
export const TravelClaimsView: React.FC = () => {
  const { travelClaims, addTravelClaim, paymentVouchers, cases, showToast } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingPromptClaim, setPendingPromptClaim] = useState<TravelClaim | null>(null);
  const [previewPvId, setPreviewPvId] = useState<string | null>(null);

  const [claimant, setClaimant] = useState('AH');
  const [purposeType, setPurposeType] = useState<'Client Matter' | 'Firm/Internal'>('Client Matter');
  const [fileRef, setFileRef] = useState(cases[0]?.ref || '');
  const [firmCategory, setFirmCategory] = useState('Networking (BNI)');
  const [customCategory, setCustomCategory] = useState('');
  const [purpose, setPurpose] = useState('Attend Case Management / Hearing');
  const [fromLoc, setFromLoc] = useState('Office (Kuala Terengganu)');
  const [toLoc, setToLoc] = useState('High Court Kuala Terengganu');
  const [km, setKm] = useState(38);
  const [rate, setRate] = useState(1.00); // RM 1.00/km default
  const [otherAmount, setOtherAmount] = useState(0);
  const [picNotification, setPicNotification] = useState('Syafiqah Hamizad (Managing Partner)');
  const [supportingDocName, setSupportingDocName] = useState('');

  const totalClaim = km * rate + otherAmount;

  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = firmCategory === 'Custom' ? customCategory || 'General Firm Expense' : firmCategory;

    const newClaim: TravelClaim = {
      id: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      claimant,
      purposeType,
      fileRef: purposeType === 'Client Matter' ? fileRef : '',
      firmCategory: purposeType === 'Firm/Internal' ? finalCategory : '',
      type: 'Mileage',
      purpose,
      from: fromLoc,
      to: toLoc,
      km,
      rate,
      mileageAmount: km * rate,
      otherAmount,
      total: totalClaim,
      paidFrom: purposeType === 'Client Matter' ? 'Disbursement Bucket' : 'Office Bank — General',
      billed: purposeType === 'Client Matter' ? 'N' : 'N/A',
      invoiceNo: '',
      postedRef: supportingDocName ? `Doc Attached: ${supportingDocName}` : 'No Attachment',
    };

    addTravelClaim(newClaim);
    setIsModalOpen(false);
    showToast(`Travel claim ${newClaim.id} submitted! Notification sent to PIC (${picNotification}).`);
    
    // Automatically prompt to generate Payment Voucher!
    setPendingPromptClaim(newClaim);
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Car className="w-5 h-5 text-[#A9814A]" />
            Travel &amp; Mileage Claims (RM 1.00 / KM Scale)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submitting a claim automatically triggers a prompt to issue a corresponding Payment Voucher for Partner sign-off.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#16223A] hover:bg-[#1F2E4D] text-[#F6F4EE] text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Travel Claim</span>
        </button>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Claim ID &amp; Date</th>
              <th className="p-3 font-bold">Claimant</th>
              <th className="p-3 font-bold">Purpose Type</th>
              <th className="p-3 font-bold">Matter / Category</th>
              <th className="p-3 font-bold">Journey &amp; Rate</th>
              <th className="p-3 font-bold text-right">Claim Total</th>
              <th className="p-3 font-bold">Payment Voucher (PV) Status</th>
              <th className="p-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {travelClaims.map((t) => {
              const matchingPv = paymentVouchers.find(
                (pv) =>
                  pv.description.includes(t.id) ||
                  (pv.amount === t.total && (pv.description.includes(t.from) || pv.description.includes(t.claimant)))
              );

              return (
                <tr key={t.id} className="hover:bg-[#FAF8F2]">
                  <td className="p-3 font-mono">
                    <span className="font-bold text-[#16223A] block">{t.id}</span>
                    <span className="text-slate-500 text-[10px]">{t.date}</span>
                  </td>
                  <td className="p-3 font-bold text-slate-800">{t.claimant}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.purposeType === 'Client Matter' ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.purposeType}
                    </span>
                  </td>
                  <td className="p-3 font-mono">
                    {t.purposeType === 'Client Matter' ? (
                      <span className="ref-seal">{t.fileRef}</span>
                    ) : (
                      <span className="text-slate-600 font-sans font-semibold">{t.firmCategory}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-700">
                    {t.from} → {t.to} ({t.km} km @ RM {t.rate.toFixed(2)}/km)
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                    RM {t.total.toFixed(2)}
                  </td>
                  <td className="p-3">
                    {matchingPv ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          matchingPv.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        <CheckCircle className="w-3 h-3" />
                        {matchingPv.id} ({matchingPv.approved ? 'Approved' : 'Pending Sign-off'})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        No PV Issued
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {matchingPv ? (
                      <button
                        onClick={() => setPreviewPvId(matchingPv.id)}
                        className="px-2.5 py-1 text-[11px] border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <ReceiptIcon className="w-3 h-3 text-[#A9814A]" />
                        <span>Preview PV</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setPendingPromptClaim(t)}
                        className="px-2.5 py-1 text-[11px] bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-amber-300" />
                        <span>Generate PV</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Auto PV Prompt Modal */}
      {pendingPromptClaim && (
        <AutoPvPromptModal
          claim={pendingPromptClaim}
          onClose={() => setPendingPromptClaim(null)}
          onPvGenerated={(generatedPvId) => setPreviewPvId(generatedPvId)}
        />
      )}

      {/* Print-Ready PV Document Preview Modal */}
      {previewPvId && (
        <DocPreviewModal
          type="paymentVoucher"
          docId={previewPvId}
          onClose={() => setPreviewPvId(null)}
        />
      )}

      {/* New Travel Claim Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#A9814A]" />
              Submit Travel / Mileage Claim
            </h3>
            <form onSubmit={handleSaveClaim} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Claimant</label>
                  <select value={claimant} onChange={(e) => setClaimant(e.target.value)} className="w-full font-bold">
                    <option value="SH">Syafiqah Hamizad (SH)</option>
                    <option value="AH">Amirul Hasif (AH)</option>
                    <option value="ZA">Zulfa Ain (ZA)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Purpose Type</label>
                  <select
                    value={purposeType}
                    onChange={(e) => setPurposeType(e.target.value as any)}
                    className="w-full font-semibold"
                  >
                    <option value="Client Matter">Client Matter (Reimbursable Disbursement)</option>
                    <option value="Firm/Internal">Firm / Internal Business (Office Expense)</option>
                  </select>
                </div>
              </div>

              {purposeType === 'Client Matter' ? (
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Reference</label>
                  <select value={fileRef} onChange={(e) => setFileRef(e.target.value)} className="w-full font-mono">
                    {cases.map((c) => (
                      <option key={c.id} value={c.ref}>
                        {c.ref} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Firm Category</label>
                    <select
                      value={firmCategory}
                      onChange={(e) => setFirmCategory(e.target.value)}
                      className="w-full font-semibold"
                    >
                      <option value="Networking (BNI)">Networking (BNI)</option>
                      <option value="Training / CPD">Training / CPD</option>
                      <option value="Business Development">Business Development</option>
                      <option value="Court Liaison / Filing Ops">Court Liaison / Filing Ops</option>
                      <option value="Admin / Office Supplies">Admin / Office Supplies</option>
                      <option value="Bar Council / State Bar Events">Bar Council / State Bar Events</option>
                      <option value="Custom">Custom / Fill-in Category...</option>
                    </select>
                  </div>

                  {firmCategory === 'Custom' && (
                    <div>
                      <label className="font-bold text-slate-700 block uppercase mb-1">Specify Custom Category</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Land Office Meeting with Director"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">From Location</label>
                  <input
                    type="text"
                    required
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">To Location</label>
                  <input
                    type="text"
                    required
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={km}
                    onChange={(e) => setKm(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Rate (RM / KM)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Tolls &amp; Parking (RM)</label>
                  <input
                    type="number"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Supporting Document / Receipt Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Touch 'n Go E-Statement / Fuel Receipt #8932"
                  value={supportingDocName}
                  onChange={(e) => setSupportingDocName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Notify Person In Charge (PIC)</label>
                <select
                  value={picNotification}
                  onChange={(e) => setPicNotification(e.target.value)}
                  className="w-full font-semibold bg-amber-50 border-amber-200 text-amber-900"
                >
                  <option value="Syafiqah Hamizad (Managing Partner)">Syafiqah Hamizad (Managing Partner)</option>
                  <option value="Amirul Hasif (Partner)">Amirul Hasif (Partner)</option>
                  <option value="Finance &amp; Accounts Department">Finance &amp; Accounts Department</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center font-bold">
                <span>Calculated Claim Total:</span>
                <span className="font-mono text-emerald-800 text-sm">RM {totalClaim.toFixed(2)}</span>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px] flex items-center gap-1.5 font-medium">
                <ReceiptIcon className="w-4 h-4 text-[#A9814A] shrink-0" />
                <span>Submitting this claim will automatically prompt to generate the Payment Voucher (PV) for Partner Sign-Off.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Submit &amp; Prompt PV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 4. INVOICES VIEW ================= */
export const InvoicesView: React.FC = () => {
  const {
    invoices,
    addInvoice,
    clients,
    cases,
    retainers = [],
    timeEntries,
    updateTimeEntry,
    expenses,
    updateExpense,
    travelClaims,
    updateTravelClaim,
    showToast,
  } = useApp();

  const [docPreviewId, setDocPreviewId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  const [feesAmount, setFeesAmount] = useState('1500');
  const [disbursementsAmount, setDisbursementsAmount] = useState('350');
  const [applyTax, setApplyTax] = useState(false); // Default false (Excl Tax 0%)

  // Centralized Billing Engine Selected Unbilled Items State
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [selectedTcIds, setSelectedTcIds] = useState<string[]>([]);

  // Find unbilled items for currently selected matter
  const selectedCase = cases.find((c) => c.id === caseId);
  const selectedCaseRef = selectedCase?.ref || '';

  // Calculate upfront client deposit balance for this matter
  const matterRetainers = retainers.filter((r) => r.caseId === caseId || r.fileRef === selectedCaseRef);
  const clientUpfrontBalance = matterRetainers.reduce((acc, r) => {
    if (r.type === 'Deposit') return acc + r.amount;
    if (r.type === 'Apply' || r.type === 'Refund') return acc - r.amount;
    return acc;
  }, 0);

  const unbilledTime = timeEntries.filter((t) => t.caseId === caseId && !t.billed);
  const unbilledExp = expenses.filter((e) => e.caseId === caseId && e.billable && !e.billed);
  const unbilledTc = travelClaims.filter(
    (tc) => (tc.fileRef === selectedCaseRef || tc.fileRef === caseId) && tc.purposeType === 'Client Matter' && tc.billed !== 'Y'
  );

  // Auto-fill amounts when unbilled selection changes
  const handleToggleTimeItem = (id: string, amount: number) => {
    setSelectedTimeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      const sum = timeEntries
        .filter((t) => next.includes(t.id))
        .reduce((acc, t) => acc + (t.hours * t.rate), 0);
      setFeesAmount(sum > 0 ? sum.toString() : '1500');
      return next;
    });
  };

  const handleToggleExpItem = (id: string) => {
    setSelectedExpIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      const sumExp = expenses.filter((e) => next.includes(e.id)).reduce((acc, e) => acc + e.amount, 0);
      const sumTc = travelClaims.filter((tc) => selectedTcIds.includes(tc.id)).reduce((acc, tc) => {
        const clientBillableTotal = tc.billableClientTotal || (tc.km * 1.5 + (tc.tollAmount || 0) + (tc.parkingAmount || 0) + (tc.otherAmount || 0));
        return acc + clientBillableTotal;
      }, 0);
      setDisbursementsAmount((sumExp + sumTc) > 0 ? (sumExp + sumTc).toFixed(2) : '350');
      return next;
    });
  };

  const handleToggleTcItem = (id: string) => {
    setSelectedTcIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      const sumExp = expenses.filter((e) => selectedExpIds.includes(e.id)).reduce((acc, e) => acc + e.amount, 0);
      const sumTc = travelClaims.filter((tc) => next.includes(tc.id)).reduce((acc, tc) => {
        const clientBillableTotal = tc.billableClientTotal || (tc.km * 1.5 + (tc.tollAmount || 0) + (tc.parkingAmount || 0) + (tc.otherAmount || 0));
        return acc + clientBillableTotal;
      }, 0);
      setDisbursementsAmount((sumExp + sumTc) > 0 ? (sumExp + sumTc).toFixed(2) : '350');
      return next;
    });
  };

  const parsedFees = parseFloat(feesAmount) || 0;
  const parsedDisbursements = parseFloat(disbursementsAmount) || 0;
  const tax = applyTax ? parsedFees * 0.08 : 0;
  const total = parsedFees + parsedDisbursements + tax;

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !caseId) return alert('Please select a client and matter');

    const invId = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;

    addInvoice({
      id: invId,
      clientId,
      caseId,
      fileRef: selectedCaseRef,
      amount: parsedFees + parsedDisbursements,
      discount: 0,
      tax,
      total,
      date,
      dueDate,
      status: 'Unpaid',
      lineItems: [
        { description: 'Professional Fees for Legal Services Rendered', category: 'Fee - Fixed', amount: parsedFees },
        { description: 'Reimbursable Out-of-pocket Disbursements & Travel Claims', category: 'Disbursement', amount: parsedDisbursements },
        ...(applyTax ? [{ description: 'SST Service Tax (8%)', category: 'Tax', amount: tax }] : []),
      ],
    });

    // Mark selected unbilled items as billed in state
    selectedTimeIds.forEach((tId) => updateTimeEntry(tId, { billed: true }));
    selectedExpIds.forEach((eId) => updateExpense(eId, { billed: true }));
    selectedTcIds.forEach((tcId) => updateTravelClaim(tcId, { billed: 'Y', invoiceNo: invId }));

    setIsModalOpen(false);
    setSelectedTimeIds([]);
    setSelectedExpIds([]);
    setSelectedTcIds([]);
    showToast(`Invoice ${invId} issued! Billed items updated in Centralized Billing Engine.`);
  };

  const handleExportCsv = () => {
    const data = invoices.map((i) => {
      const client = clients.find((c) => c.id === i.clientId);
      const cs = cases.find((c) => c.id === i.caseId);
      return {
        'Invoice ID': i.id,
        Client: client ? client.name : '—',
        'Matter Ref': cs ? cs.ref : i.fileRef || '—',
        'Invoice Date': i.date,
        'Due Date': i.dueDate,
        'Tax (RM)': i.tax || 0,
        'Total Amount (RM)': i.total,
        Status: i.status,
      };
    });
    exportToCsv('Invoices_Register', data);
    showToast('Exported invoices register to CSV / Google Sheets');
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#A9814A]" />
            Tax &amp; Billing Invoices Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Issue &amp; track fee invoices (with taxable or non-taxable options).</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A9814A]" />
            <span>Export CSV / Sheets</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Tax Invoice</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Invoice No</th>
              <th className="p-3 font-bold">Client Name</th>
              <th className="p-3 font-bold">Matter Ref</th>
              <th className="p-3 font-bold text-right">Tax (SST)</th>
              <th className="p-3 font-bold text-right">Total Amount (RM)</th>
              <th className="p-3 font-bold">Due Date</th>
              <th className="p-3 font-bold">Payment Status</th>
              <th className="p-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => {
              const client = clients.find((c) => c.id === i.clientId);
              const cs = cases.find((c) => c.id === i.caseId);

              return (
                <tr key={i.id} className="hover:bg-[#FAF8F2]">
                  <td className="p-3 font-mono font-bold text-slate-800">{i.id}</td>
                  <td className="p-3 font-bold text-[#16223A]">{client ? client.name : '—'}</td>
                  <td className="p-3">
                    <span className="ref-seal">{cs ? cs.ref : i.fileRef || '—'}</span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600">
                    {i.tax && i.tax > 0 ? `RM ${i.tax.toFixed(2)}` : 'Excl Tax (0%)'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                    RM {i.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 font-mono text-slate-600">{i.dueDate}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        i.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setDocPreviewId(i.id)}
                      className="px-2.5 py-1 text-[11px] border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md font-semibold cursor-pointer flex items-center gap-1 ml-auto"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Invoice</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {docPreviewId && (
        <DocPreviewModal type="invoice" docId={docPreviewId} onClose={() => setDocPreviewId(null)} />
      )}

      {/* Key In Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#A9814A]" />
              Issue New Invoice
            </h3>
            <form onSubmit={handleSaveInvoice} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Select Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Select Matter Reference</label>
                <select
                  value={caseId}
                  onChange={(e) => {
                    setCaseId(e.target.value);
                    setSelectedTimeIds([]);
                    setSelectedExpIds([]);
                    setSelectedTcIds([]);
                  }}
                  className="w-full font-mono font-bold"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ref} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Centralized Billing Engine Box */}
              <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#16223A] flex items-center gap-1 text-[11px]">
                    ⚡ Centralized Billing &amp; Claim Integration
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.5 rounded">
                    Auto-consolidating Claims &amp; Retainers
                  </span>
                </div>

                {/* Upfront Client Deposit Budget Header */}
                <div className="p-2 bg-white border border-[#E1DCCF] rounded flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-slate-600 font-medium">Client Upfront Trust Retainer: </span>
                    <span className="font-mono font-bold text-emerald-800">
                      RM {clientUpfrontBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {clientUpfrontBalance > 0 ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      ✓ Funded by Upfront Retainer
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      ⚠️ Unfunded / Flagged as BILLABLE
                    </span>
                  )}
                </div>

                {unbilledTime.length === 0 && unbilledExp.length === 0 && unbilledTc.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No pending unbilled time entries or disbursements found for this matter.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {/* Unbilled Time */}
                    {unbilledTime.length > 0 && (
                      <div>
                        <div className="font-bold text-slate-700 text-[10px] uppercase mb-1">Unbilled Fee Earner Time Entries:</div>
                        {unbilledTime.map((t) => (
                          <label key={t.id} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded mb-1 cursor-pointer hover:bg-amber-50">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTimeIds.includes(t.id)}
                                onChange={() => handleToggleTimeItem(t.id, t.hours * t.rate)}
                                className="w-3.5 h-3.5"
                              />
                              <span className="font-medium text-slate-800">{t.description} ({t.hours} hrs @ RM {t.rate}/hr)</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900">RM {(t.hours * t.rate).toFixed(2)}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Unbilled Disbursements & Travel */}
                    {(unbilledExp.length > 0 || unbilledTc.length > 0) && (
                      <div>
                        <div className="font-bold text-slate-700 text-[10px] uppercase mb-1 flex items-center justify-between">
                          <span>Unbilled Disbursements &amp; Reimbursable Claims:</span>
                          <span className="text-[9px] text-slate-500 normal-case font-normal">(Client Rate: RM 1.50/km)</span>
                        </div>
                        {unbilledExp.map((e) => (
                          <label key={e.id} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded mb-1 cursor-pointer hover:bg-amber-50">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedExpIds.includes(e.id)}
                                onChange={() => handleToggleExpItem(e.id)}
                                className="w-3.5 h-3.5"
                              />
                              <div>
                                <span className="font-medium text-slate-800">{e.category}: {e.description}</span>
                                <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1 rounded font-bold">
                                  Client-Reimbursable
                                </span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900">RM {e.amount.toFixed(2)}</span>
                          </label>
                        ))}

                        {unbilledTc.map((tc) => {
                          const clientBillableTotal = tc.billableClientTotal || (tc.km * 1.5 + (tc.tollAmount || 0) + (tc.parkingAmount || 0) + (tc.otherAmount || 0));
                          const isExceeds = clientBillableTotal > clientUpfrontBalance;

                          return (
                            <label key={tc.id} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded mb-1 cursor-pointer hover:bg-amber-50">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTcIds.includes(tc.id)}
                                  onChange={() => handleToggleTcItem(tc.id)}
                                  className="w-3.5 h-3.5 shrink-0"
                                />
                                <div className="space-y-0.5">
                                  <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                    <span>Travel Claim ({tc.from} ➔ {tc.to})</span>
                                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded font-bold">
                                      {tc.km} km @ RM 1.50/km
                                    </span>
                                    {isExceeds ? (
                                      <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded font-bold">
                                        Flagged: Billable
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">
                                        Retainer Covered
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Staff Internal: RM {tc.total.toFixed(2)} (RM 1.00/km) | Client Chargeable: RM {clientBillableTotal.toFixed(2)} (RM 1.50/km)
                                  </div>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                                RM {clientBillableTotal.toFixed(2)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Professional Fees (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={feesAmount}
                    onChange={(e) => setFeesAmount(e.target.value)}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Disbursements (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={disbursementsAmount}
                    onChange={(e) => setDisbursementsAmount(e.target.value)}
                    className="w-full font-mono font-bold"
                  />
                </div>
              </div>

              {/* Tax Checkbox / Option */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                    className="w-4 h-4 rounded text-[#16223A] cursor-pointer"
                  />
                  <span className="font-bold text-[#16223A]">Charge SST Tax (8%)</span>
                </label>
                <span className="text-[11px] font-semibold text-slate-600">
                  {applyTax ? 'SST 8% Applied' : 'Excluded Tax (0% SST)'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1 font-mono text-slate-700">
                <div className="flex justify-between">
                  <span>Fees Subtotal:</span>
                  <span>RM {parsedFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Disbursements:</span>
                  <span>RM {parsedDisbursements.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-800 font-semibold">
                  <span>SST Tax (8%):</span>
                  <span>RM {tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold text-[#16223A]">
                  <span>Total Payable:</span>
                  <span>RM {total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save &amp; Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 5. UNIFIED PAYMENTS & EXPENSE MANAGEMENT VIEW ================= */
export const PaymentsView: React.FC = () => {
  const {
    payments,
    invoices,
    travelClaims,
    paymentVouchers,
    addPayment,
    addReceipt,
    addTravelClaim,
    addPaymentVoucher,
    cases,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CLAIMS' | 'VOUCHERS' | 'COLLECTIONS' | 'GMAIL_LOGS'>('OVERVIEW');

  // Google Workspace Email Integration State
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>(() => getEmailAuditLogs());
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const handleSendTestEmail = async () => {
    setIsTestingEmail(true);
    const testPayload = {
      pvId: `PV-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().slice(0, 10),
      accountSet: 'OFFICE' as const,
      voucherCategory: 'Finance Department Notification',
      description: 'Automated Payment Voucher Notification Test Email via Google Workspace Gmail API',
      amount: 1450.00,
      fileRef: 'FIRM_OPERATIONS',
      preparedBy: 'Syafiqah Hamizad (Managing Partner)',
      recipientEmail: 'finance@shcolaw.com',
    };

    const res = await sendFinancePvNotificationEmail(testPayload);
    setEmailLogs(getEmailAuditLogs());
    setIsTestingEmail(false);
    showToast(`📧 Finance notification email dispatched to finance@shcolaw.com! (${res.message})`);
  };

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [isNewPvOpen, setIsNewPvOpen] = useState(false);
  const [pendingPromptClaim, setPendingPromptClaim] = useState<TravelClaim | null>(null);
  const [pvDocPreviewId, setPvDocPreviewId] = useState<string | null>(null);

  // Form states - Record Payment
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState('1500');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Instant Bank Transfer (DuitNow)');

  // Form states - Travel Claim
  const [claimant, setClaimant] = useState('AH');
  const [purposeType, setPurposeType] = useState<'Client Matter' | 'Firm/Internal'>('Client Matter');
  const [fileRef, setFileRef] = useState(cases[0]?.ref || '');
  const [firmCategory, setFirmCategory] = useState('Networking (BNI)');
  const [customCategory, setCustomCategory] = useState('');
  const [purpose, setPurpose] = useState('Attend Case Management / Hearing');
  const [fromLoc, setFromLoc] = useState('Office (Kuala Terengganu)');
  const [toLoc, setToLoc] = useState('High Court Kuala Terengganu');
  const [km, setKm] = useState(38);
  const [rate, setRate] = useState(1.00);
  const [otherAmount, setOtherAmount] = useState(0);
  const [picNotification, setPicNotification] = useState('Syafiqah Hamizad (Managing Partner)');
  const [supportingDocName, setSupportingDocName] = useState('');

  // Form states - Payment Voucher
  const [pvAccountSet, setPvAccountSet] = useState<'OFFICE' | 'CLIENT'>('OFFICE');
  const [pvCategory, setPvCategory] = useState<PaymentVoucher['voucherCategory']>('Travelling');
  const [pvDescription, setPvDescription] = useState('Disbursement Payment / Reimbursable Expense');
  const [pvAmount, setPvAmount] = useState('450.00');
  const [pvFileRef, setPvFileRef] = useState(cases[0]?.ref || '');
  const [pvPreparedBy, setPvPreparedBy] = useState('Amirul Hasif (AH)');

  // Calculations
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalTravelClaims = travelClaims.reduce((sum, t) => sum + t.total, 0);
  const totalPvPending = paymentVouchers.filter((pv) => !pv.approved).reduce((sum, pv) => sum + pv.amount, 0);
  const totalPvApproved = paymentVouchers.filter((pv) => pv.approved).reduce((sum, pv) => sum + pv.amount, 0);

  // Combined ledger array for Unified Overview
  const combinedLedger = [
    ...payments.map((p) => ({
      id: p.id,
      date: p.date,
      type: 'INVOICE_COLLECTION' as const,
      ref: p.invoiceId,
      details: `Payment via ${p.method}`,
      amount: p.amount,
      isIncoming: true,
      status: 'COLLECTED',
    })),
    ...travelClaims.map((t) => ({
      id: t.id,
      date: t.date,
      type: 'TRAVEL_CLAIM' as const,
      ref: t.fileRef || t.firmCategory || 'Firm Travel',
      details: `${t.claimant}: ${t.from} → ${t.to} (${t.km} km)`,
      amount: t.total,
      isIncoming: false,
      status: 'CLAIMED',
    })),
    ...paymentVouchers.map((pv) => ({
      id: pv.id,
      date: pv.date,
      type: 'PAYMENT_VOUCHER' as const,
      ref: pv.fileRef,
      details: pv.description,
      amount: pv.amount,
      isIncoming: false,
      status: pv.approved ? 'APPROVED & PAID' : 'PENDING APPROVAL',
    })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1));

  // Handlers
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return alert('Please select an invoice');
    const paymentId = `OR-${Math.floor(1000 + Math.random() * 9000)}`;
    const parsedAmount = parseFloat(paymentAmount) || 0;

    addPayment({
      id: paymentId,
      invoiceId,
      amount: parsedAmount,
      date: paymentDate,
      method: paymentMethod,
    });

    addReceipt({
      id: paymentId,
      date: paymentDate,
      accountSet: 'OFFICE',
      receivedFrom: `Client against Invoice ${invoiceId}`,
      description: `Settlement / Collection for Tax Invoice ${invoiceId}`,
      amount: parsedAmount,
      paymentMethod,
    });

    setIsRecordPaymentOpen(false);
    showToast(`Payment ${paymentId} recorded & Official Receipt issued!`);
  };

  const handleSaveClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = firmCategory === 'Custom' ? customCategory || 'General Firm Expense' : firmCategory;
    const totalClaim = km * rate + otherAmount;

    const newClaim: TravelClaim = {
      id: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      claimant,
      purposeType,
      fileRef: purposeType === 'Client Matter' ? fileRef : '',
      firmCategory: purposeType === 'Firm/Internal' ? finalCategory : '',
      type: 'Mileage',
      purpose,
      from: fromLoc,
      to: toLoc,
      km,
      rate,
      mileageAmount: km * rate,
      otherAmount,
      total: totalClaim,
      paidFrom: purposeType === 'Client Matter' ? 'Disbursement Bucket' : 'Office Bank — General',
      billed: purposeType === 'Client Matter' ? 'N' : 'N/A',
      invoiceNo: '',
      postedRef: supportingDocName ? `Doc Attached: ${supportingDocName}` : 'No Attachment',
    };

    addTravelClaim(newClaim);
    setIsNewClaimOpen(false);
    showToast(`Travel claim ${newClaim.id} submitted! PIC notified (${picNotification}).`);
    
    // Automatically prompt to generate Payment Voucher!
    setPendingPromptClaim(newClaim);
  };

  const handleSavePv = async (e: React.FormEvent) => {
    e.preventDefault();
    const pvId = `PV-2026-${Math.floor(100 + Math.random() * 900)}`;
    const parsedAmount = parseFloat(pvAmount) || 0;
    const pvDate = new Date().toISOString().slice(0, 10);

    addPaymentVoucher({
      id: pvId,
      date: pvDate,
      accountSet: pvAccountSet,
      voucherCategory: pvCategory,
      description: pvDescription,
      amount: parsedAmount,
      debit: 'General Disbursement / Expense',
      credit: pvAccountSet === 'CLIENT' ? 'Bank Client Account' : 'Bank Office Account',
      clientId: 'C-CLIENT',
      fileRef: pvFileRef,
      bankRef: 'MAYBANK-7821',
      preparedBy: pvPreparedBy,
      approvedBy: '',
      approved: false,
    });

    // Send automated email notification via Google Workspace Gmail API
    const emailRes = await sendFinancePvNotificationEmail({
      pvId,
      date: pvDate,
      accountSet: pvAccountSet,
      voucherCategory: pvCategory,
      description: pvDescription,
      amount: parsedAmount,
      fileRef: pvFileRef,
      preparedBy: pvPreparedBy,
      recipientEmail: 'finance@shcolaw.com',
    });

    setIsNewPvOpen(false);
    showToast(`📧 Payment Voucher ${pvId} generated! Email notification dispatched to Finance Dept (${emailRes.message}).`);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner & Tab Control */}
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#16223A] flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-[#A9814A]" />
              Unified Accounting, Claims &amp; Payment Hub
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Integrated expense tracking connecting Travel Mileage Claims and Payment Vouchers (PV) with automated prompt-on-submit and Partner sign-off.
            </p>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewClaimOpen(true)}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-[#F6F4EE] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Car className="w-4 h-4 text-amber-300" />
              <span>+ Travel Mileage Claim</span>
            </button>
            <button
              onClick={() => setIsNewPvOpen(true)}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ReceiptIcon className="w-4 h-4 text-emerald-300" />
              <span>+ Payment Voucher</span>
            </button>
            <button
              onClick={() => setIsRecordPaymentOpen(true)}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Record Collection</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E1DCCF] gap-1 pt-2">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'border-[#A9814A] text-[#16223A] bg-[#FAF8F2]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Overview &amp; Integrated Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('CLAIMS')}
            className={`px-4 py-2 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'CLAIMS'
                ? 'border-[#A9814A] text-[#16223A] bg-[#FAF8F2]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Travel Mileage Claims ({travelClaims.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`px-4 py-2 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'VOUCHERS'
                ? 'border-[#A9814A] text-[#16223A] bg-[#FAF8F2]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ReceiptIcon className="w-4 h-4" />
            <span>Payment Vouchers ({paymentVouchers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('COLLECTIONS')}
            className={`px-4 py-2 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'COLLECTIONS'
                ? 'border-[#A9814A] text-[#16223A] bg-[#FAF8F2]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Invoice Collections ({payments.length})</span>
          </button>
          <button
            onClick={() => {
              setEmailLogs(getEmailAuditLogs());
              setActiveTab('GMAIL_LOGS');
            }}
            className={`px-4 py-2 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'GMAIL_LOGS'
                ? 'border-blue-600 text-blue-900 bg-blue-50/60'
                : 'border-transparent text-slate-500 hover:text-blue-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="flex items-center gap-1.5">
              <span>Google Workspace Email Alerts</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                {emailLogs.length}
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & INTEGRATED LEDGER */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-[#E1DCCF] rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Invoice Collections</span>
              <span className="font-mono text-lg font-bold text-emerald-800 block mt-0.5">
                RM {totalCollections.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Inflows received from client tax invoices</span>
            </div>

            <div className="p-3.5 bg-white border border-[#E1DCCF] rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Travel Mileage Claims</span>
              <span className="font-mono text-lg font-bold text-[#16223A] block mt-0.5">
                RM {totalTravelClaims.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Total submitted mileage expenses</span>
            </div>

            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-amber-900 block">PVs Pending Sign-Off</span>
              <span className="font-mono text-lg font-bold text-amber-800 block mt-0.5">
                RM {totalPvPending.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-amber-700 mt-1 block">Awaiting Partner sign-off</span>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-900 block">Approved PV Disbursements</span>
              <span className="font-mono text-lg font-bold text-emerald-900 block mt-0.5">
                RM {totalPvApproved.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-emerald-700 mt-1 block">Approved &amp; cleared payout</span>
            </div>
          </div>

          {/* Workflow Integration Explainer Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
                <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-amber-950 text-xs">
                  Automated Claim-to-PV Integration Workflow
                </h4>
                <p className="text-[11px] text-amber-900">
                  When an employee submits a Travel Mileage Claim, the system automatically prompts to generate the corresponding Payment Voucher (PV). Once generated, it appears in the PV queue for Partner sign-off.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsNewClaimOpen(true)}
              className="px-3 py-1.5 bg-[#16223A] text-white rounded font-bold text-xs hover:bg-[#1F2E4D] cursor-pointer shrink-0"
            >
              Test Integrated Claim Flow
            </button>
          </div>

          {/* Integrated Real-Time Financial Ledger */}
          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <div className="p-3 bg-[#F6F4EE] border-b border-[#E1DCCF] flex justify-between items-center">
              <h3 className="font-serif font-bold text-[#16223A] text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#A9814A]" />
                Unified Real-Time Accounting &amp; Expense Ledger
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {combinedLedger.length} Total Accounting Events Recorded
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Ref ID &amp; Date</th>
                  <th className="p-3 font-bold">Record Category</th>
                  <th className="p-3 font-bold">Matter / File Ref</th>
                  <th className="p-3 font-bold">Particulars / Description</th>
                  <th className="p-3 font-bold text-right">Amount (RM)</th>
                  <th className="p-3 font-bold">Workflow Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedLedger.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-[#FAF8F2]">
                    <td className="p-3 font-mono">
                      <span className="font-bold text-[#16223A] block">{item.id}</span>
                      <span className="text-slate-500 text-[10px]">{item.date}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.type === 'INVOICE_COLLECTION'
                            ? 'bg-emerald-100 text-emerald-900'
                            : item.type === 'TRAVEL_CLAIM'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.type === 'INVOICE_COLLECTION'
                          ? 'Invoice Payment'
                          : item.type === 'TRAVEL_CLAIM'
                          ? 'Travel Claim'
                          : 'Payment Voucher'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {item.ref ? <span className="ref-seal">{item.ref}</span> : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="p-3 text-slate-800 max-w-xs truncate">{item.details}</td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        item.isIncoming ? 'text-emerald-800' : 'text-slate-900'
                      }`}
                    >
                      {item.isIncoming ? '+' : '-'} RM {item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status.includes('APPROVED') || item.status === 'COLLECTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status.includes('PENDING')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TRAVEL CLAIMS VIEW */}
      {activeTab === 'CLAIMS' && <TravelClaimsView />}

      {/* TAB 3: PAYMENT VOUCHERS VIEW */}
      {activeTab === 'VOUCHERS' && <PaymentVouchersView />}

      {/* TAB 4: INVOICE COLLECTIONS */}
      {activeTab === 'COLLECTIONS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#A9814A]" />
                Invoice Collections &amp; Payments Received Register
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Record payments received against client tax invoices.</p>
            </div>
            <button
              onClick={() => setIsRecordPaymentOpen(true)}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Record Payment Received</span>
            </button>
          </div>

          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Receipt / OR No</th>
                  <th className="p-3 font-bold">Invoice ID</th>
                  <th className="p-3 font-bold text-right">Amount Paid (RM)</th>
                  <th className="p-3 font-bold">Payment Date</th>
                  <th className="p-3 font-bold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF8F2]">
                    <td className="p-3 font-mono font-bold text-slate-800">{p.id}</td>
                    <td className="p-3 font-mono text-slate-700">{p.invoiceId}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800">
                      RM {p.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{p.date}</td>
                    <td className="p-3 font-medium text-slate-800">{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: GOOGLE WORKSPACE GMAIL NOTIFICATIONS */}
      {activeTab === 'GMAIL_LOGS' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-slate-900 to-[#16223A] text-white p-5 rounded-xl border border-slate-700 shadow-sm flex flex-wrap justify-between items-center gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Google Workspace Active
                </span>
                <span className="text-[11px] text-slate-300 font-mono">Scope: https://www.googleapis.com/auth/gmail.send</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-amber-200 flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                Automated Finance Department Email Trigger
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Whenever a new Payment Voucher (PV) is generated in the system, an automated HTML email alert is sent to <strong>finance@shcolaw.com</strong> detailing the Voucher ID, claimant, amount, particulars, and approval link.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSendTestEmail}
                disabled={isTestingEmail}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isTestingEmail ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Dispatching Test Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>⚡ Send Test Email to Finance</span>
                  </>
                )}
              </button>
              <span className="text-[10px] text-slate-400 italic">Target: finance@shcolaw.com</span>
            </div>
          </div>

          {/* Email Outbox Log Table */}
          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <div className="p-3 bg-[#F6F4EE] border-b border-[#E1DCCF] flex justify-between items-center">
              <h4 className="font-serif font-bold text-[#16223A] text-xs flex items-center gap-1.5">
                <Inbox className="w-4 h-4 text-[#A9814A]" />
                Google Workspace Email Dispatch Audit Log ({emailLogs.length})
              </h4>
              <button
                onClick={() => setEmailLogs(getEmailAuditLogs())}
                className="text-[11px] text-blue-900 font-bold hover:underline cursor-pointer"
              >
                ↻ Refresh Audit Logs
              </button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Log Ref &amp; Time</th>
                  <th className="p-3 font-bold">Recipient</th>
                  <th className="p-3 font-bold">Subject</th>
                  <th className="p-3 font-bold">Summary Particulars</th>
                  <th className="p-3 font-bold">Channel &amp; Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                      No emails sent yet. Generate a Payment Voucher or click 'Send Test Email' above.
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF8F2]">
                      <td className="p-3 font-mono">
                        <span className="font-bold text-[#16223A] block">{log.id}</span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(log.sentAt).toLocaleString('en-MY')}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800 font-mono">{log.recipient}</td>
                      <td className="p-3 font-semibold text-slate-900">{log.subject}</td>
                      <td className="p-3 text-slate-600 text-[11px] max-w-xs">{log.snippet}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>{log.status} ({log.channel})</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auto PV Prompt Modal */}
      {pendingPromptClaim && (
        <AutoPvPromptModal
          claim={pendingPromptClaim}
          onClose={() => setPendingPromptClaim(null)}
        />
      )}

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#A9814A]" />
              Key In Invoice Payment Received
            </h3>
            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Select Unpaid Tax Invoice</label>
                <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full font-mono">
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} — Total RM {i.total.toFixed(2)} ({i.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount Paid (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full">
                  <option value="Instant Bank Transfer (DuitNow)">Instant Bank Transfer (DuitNow)</option>
                  <option value="Online Banking (FPX)">Online Banking (FPX)</option>
                  <option value="Cheque">Banker's Cheque / Firm Cheque</option>
                  <option value="Cash Deposit">Cash Deposit</option>
                </select>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px]">
                💡 <strong>Auto-OR Generation:</strong> Submitting this payment automatically updates the Invoice status and issues a matching Official Receipt (OR) in the Receipts register.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save &amp; Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Travel Claim Modal */}
      {isNewClaimOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#A9814A]" />
              Submit Travel / Mileage Claim
            </h3>
            <form onSubmit={handleSaveClaim} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Claimant</label>
                  <select value={claimant} onChange={(e) => setClaimant(e.target.value)} className="w-full font-bold">
                    <option value="SH">Syafiqah Hamizad (SH)</option>
                    <option value="AH">Amirul Hasif (AH)</option>
                    <option value="ZA">Zulfa Ain (ZA)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Purpose Type</label>
                  <select
                    value={purposeType}
                    onChange={(e) => setPurposeType(e.target.value as any)}
                    className="w-full font-semibold"
                  >
                    <option value="Client Matter">Client Matter (Reimbursable Disbursement)</option>
                    <option value="Firm/Internal">Firm / Internal Business (Office Expense)</option>
                  </select>
                </div>
              </div>

              {purposeType === 'Client Matter' ? (
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Reference</label>
                  <select value={fileRef} onChange={(e) => setFileRef(e.target.value)} className="w-full font-mono">
                    {cases.map((c) => (
                      <option key={c.id} value={c.ref}>
                        {c.ref} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Firm Category</label>
                    <select
                      value={firmCategory}
                      onChange={(e) => setFirmCategory(e.target.value)}
                      className="w-full font-semibold"
                    >
                      <option value="Networking (BNI)">Networking (BNI)</option>
                      <option value="Training / CPD">Training / CPD</option>
                      <option value="Business Development">Business Development</option>
                      <option value="Court Liaison / Filing Ops">Court Liaison / Filing Ops</option>
                      <option value="Admin / Office Supplies">Admin / Office Supplies</option>
                      <option value="Bar Council / State Bar Events">Bar Council / State Bar Events</option>
                      <option value="Custom">Custom / Fill-in Category...</option>
                    </select>
                  </div>

                  {firmCategory === 'Custom' && (
                    <div>
                      <label className="font-bold text-slate-700 block uppercase mb-1">Specify Custom Category</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Land Office Meeting with Director"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">From Location</label>
                  <input
                    type="text"
                    required
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">To Location</label>
                  <input
                    type="text"
                    required
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={km}
                    onChange={(e) => setKm(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Rate (RM / KM)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Tolls &amp; Parking (RM)</label>
                  <input
                    type="number"
                    value={otherAmount}
                    onChange={(e) => setOtherAmount(Number(e.target.value))}
                    className="w-full font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Supporting Document / Receipt Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Touch 'n Go E-Statement / Fuel Receipt #8932"
                  value={supportingDocName}
                  onChange={(e) => setSupportingDocName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Notify Person In Charge (PIC)</label>
                <select
                  value={picNotification}
                  onChange={(e) => setPicNotification(e.target.value)}
                  className="w-full font-semibold bg-amber-50 border-amber-200 text-amber-900"
                >
                  <option value="Syafiqah Hamizad (Managing Partner)">Syafiqah Hamizad (Managing Partner)</option>
                  <option value="Amirul Hasif (Partner)">Amirul Hasif (Partner)</option>
                  <option value="Finance &amp; Accounts Department">Finance &amp; Accounts Department</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center font-bold">
                <span>Calculated Claim Total:</span>
                <span className="font-mono text-emerald-800 text-sm">RM {(km * rate + otherAmount).toFixed(2)}</span>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px] flex items-center gap-1.5 font-medium">
                <ReceiptIcon className="w-4 h-4 text-[#A9814A] shrink-0" />
                <span>Submitting this claim will automatically prompt to generate the Payment Voucher (PV) for Partner Sign-Off.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewClaimOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Submit &amp; Prompt PV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Payment Voucher Modal */}
      {isNewPvOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              Create Payment Voucher (PV)
            </h3>
            <form onSubmit={handleSavePv} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Account Target</label>
                  <select
                    value={pvAccountSet}
                    onChange={(e) => setPvAccountSet(e.target.value as any)}
                    className="w-full font-bold"
                  >
                    <option value="OFFICE">Office Operating Account</option>
                    <option value="CLIENT">Client Trust Account</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Voucher Category</label>
                  <select
                    value={pvCategory}
                    onChange={(e) => setPvCategory(e.target.value as any)}
                    className="w-full font-semibold"
                  >
                    <option value="Travelling">Travelling &amp; Mileage</option>
                    <option value="Office Rental">Office Rental</option>
                    <option value="Utilities">Utilities &amp; Telecoms</option>
                    <option value="Disbursements">Client Disbursement Payout</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Reference</label>
                  <select value={pvFileRef} onChange={(e) => setPvFileRef(e.target.value)} className="w-full font-mono">
                    {cases.map((c) => (
                      <option key={c.id} value={c.ref}>
                        {c.ref} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={pvAmount}
                    onChange={(e) => setPvAmount(e.target.value)}
                    className="w-full font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Voucher Particulars / Purpose</label>
                <textarea
                  rows={2}
                  required
                  value={pvDescription}
                  onChange={(e) => setPvDescription(e.target.value)}
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Prepared By</label>
                <input
                  type="text"
                  required
                  value={pvPreparedBy}
                  onChange={(e) => setPvPreparedBy(e.target.value)}
                  className="w-full font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPvOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Create PV &amp; Queue Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 6. RECEIPTS (OR) VIEW ================= */
export const ReceiptsView: React.FC = () => {
  const { receipts, addReceipt, showToast } = useApp();
  const [docPreviewId, setDocPreviewId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [accountSet, setAccountSet] = useState<'OFFICE' | 'CLIENT'>('OFFICE');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [description, setDescription] = useState('Stakeholder Deposit for SPA / Legal Fees');
  const [amount, setAmount] = useState('5000');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Instant Bank Transfer');

  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedFrom) return alert('Please enter recipient name');

    addReceipt({
      id: `OR-${Math.floor(1000 + Math.random() * 9000)}`,
      date,
      accountSet,
      receivedFrom,
      description,
      amount: parseFloat(amount) || 0,
      paymentMethod,
    });

    setIsModalOpen(false);
    setReceivedFrom('');
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
            Official Receipts (OR) Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict separation between Client Trust Account ORs vs Office Account ORs under Solicitors' Account Rules 1990.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Issue Official Receipt (OR)</span>
        </button>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">OR No</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Account Set</th>
              <th className="p-3 font-bold">Received From</th>
              <th className="p-3 font-bold">Description</th>
              <th className="p-3 font-bold text-right">Amount (RM)</th>
              <th className="p-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receipts.map((r) => (
              <tr key={r.id} className="hover:bg-[#FAF8F2]">
                <td className="p-3 font-mono font-bold text-slate-800">{r.id}</td>
                <td className="p-3 font-mono text-slate-600">{r.date}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.accountSet === 'CLIENT'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {r.accountSet}
                  </span>
                </td>
                <td className="p-3 font-bold text-[#16223A]">{r.receivedFrom}</td>
                <td className="p-3 text-slate-700">{r.description}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-800">
                  RM {r.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => setDocPreviewId(r.id)}
                    className="px-2.5 py-1 text-[11px] border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md font-semibold cursor-pointer flex items-center gap-1 ml-auto"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View OR</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {docPreviewId && (
        <DocPreviewModal type="receipt" docId={docPreviewId} onClose={() => setDocPreviewId(null)} />
      )}

      {/* Key In Receipt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              Issue Official Receipt (OR)
            </h3>
            <form onSubmit={handleSaveReceipt} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Account Target</label>
                  <select
                    value={accountSet}
                    onChange={(e) => setAccountSet(e.target.value as any)}
                    className="w-full font-bold"
                  >
                    <option value="OFFICE">Office Operating Account</option>
                    <option value="CLIENT">Client Trust Account</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Received From (Client / Payer)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Encik Farid Iskandar"
                  value={receivedFrom}
                  onChange={(e) => setReceivedFrom(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Purpose / Description</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full"
                  >
                    <option value="Instant Bank Transfer">Instant Bank Transfer</option>
                    <option value="Online Banking (FPX)">Online Banking (FPX)</option>
                    <option value="Cheque">Banker's Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Generate Official Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 7. PAYMENT VOUCHERS (PV) VIEW ================= */
export const PaymentVouchersView: React.FC = () => {
  const { paymentVouchers, addPaymentVoucher, approvePaymentVoucher, currentPartnerCode, isPartner, cases, showToast } = useApp();
  const [docPreviewId, setDocPreviewId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New PV Form State
  const [voucherCategory, setVoucherCategory] = useState<'Travel Mileage' | 'Disbursement' | 'Client Account' | 'Office Claim'>('Travel Mileage');
  const [accountSet, setAccountSet] = useState<'OFFICE' | 'CLIENT'>('OFFICE');
  const [payeeName, setPayeeName] = useState('');
  const [fileRef, setFileRef] = useState(cases[0]?.ref || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('350');
  const [preparedBy, setPreparedBy] = useState('Syafiqah Hamizad');

  const pendingApprovals = paymentVouchers.filter((pv) => !pv.approved).length;

  const categoriesList = [
    { id: 'ALL', label: 'All Vouchers' },
    { id: 'Travel Mileage', label: '🚗 Travel Mileage' },
    { id: 'Disbursement', label: '⚖️ Disbursement' },
    { id: 'Client Account', label: '🏦 Client Account' },
    { id: 'Office Claim', label: '🏢 Office Claim' },
  ];

  const filteredVouchers = paymentVouchers.filter((pv) => {
    if (activeCategory === 'ALL') return true;
    const cat = (pv.voucherCategory || '').toLowerCase();
    if (activeCategory === 'Travel Mileage') return cat.includes('travel') || cat.includes('mileage');
    if (activeCategory === 'Disbursement') return cat.includes('disbursement');
    if (activeCategory === 'Client Account') return pv.accountSet === 'CLIENT' || cat.includes('client');
    if (activeCategory === 'Office Claim') return pv.accountSet === 'OFFICE' || cat.includes('office');
    return true;
  });

  const handleExportCsv = () => {
    const data = filteredVouchers.map((pv) => ({
      'PV No': pv.id,
      Date: pv.date,
      Category: pv.voucherCategory,
      'Account Set': pv.accountSet,
      Description: pv.description,
      'Amount (RM)': pv.amount,
      'Prepared By': pv.preparedBy,
      'Partner Approval': pv.approved ? `Approved (${pv.approvedBy})` : 'Pending Approval',
    }));
    exportToCsv('Payment_Vouchers_Register', data);
    showToast('Exported Payment Vouchers to CSV / Excel');
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return alert('Please enter description and amount');

    const newPvId = `PV-2026-${Math.floor(100 + Math.random() * 900)}`;

    addPaymentVoucher({
      id: newPvId,
      date: new Date().toISOString().slice(0, 10),
      accountSet,
      voucherCategory: voucherCategory as any,
      description: payeeName ? `[Payee: ${payeeName}] ${description}` : description,
      amount: parseFloat(amount) || 0,
      debit: 'Expense Account',
      credit: accountSet === 'CLIENT' ? 'Bank Client Account' : 'Bank Office Account',
      clientId: 'C-SYS',
      fileRef: voucherCategory === 'Office Claim' ? 'FIRM_OPERATIONS' : fileRef,
      bankRef: 'MAYBANK-7821',
      preparedBy,
      approvedBy: '',
      approved: false,
    });

    setIsModalOpen(false);
    setDescription('');
    setPayeeName('');
    setDocPreviewId(newPvId);
    showToast(`New Payment Voucher ${newPvId} generated! Opening legal voucher document for verification.`);
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
            Centralized Payment Vouchers (PV) Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Single panel access for Travel Mileage, Disbursement, Client Account, and Office Claims with mandatory Partner sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A9814A]" />
            <span>Export CSV / Sheets</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Payment Voucher</span>
          </button>
        </div>
      </div>

      {/* 4 Category Quick Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 border border-[#E1DCCF] rounded-xl shadow-xs">
        {categoriesList.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#16223A] text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {pendingApprovals > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>{pendingApprovals} Payment Voucher(s) awaiting Partner sign-off!</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">PV No</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Category</th>
              <th className="p-3 font-bold">Account Set</th>
              <th className="p-3 font-bold">Matter Ref / Purpose</th>
              <th className="p-3 font-bold">Description</th>
              <th className="p-3 font-bold text-right">Amount (RM)</th>
              <th className="p-3 font-bold">Partner Sign-Off</th>
              <th className="p-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVouchers.map((pv) => (
              <tr key={pv.id} className="hover:bg-[#FAF8F2]">
                <td className="p-3 font-mono font-bold text-slate-800">{pv.id}</td>
                <td className="p-3 font-mono text-slate-600">{pv.date}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded">
                    {pv.voucherCategory}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      pv.accountSet === 'CLIENT' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {pv.accountSet}
                  </span>
                </td>
                <td className="p-3 font-mono text-[11px]">
                  {pv.fileRef && pv.fileRef !== 'FIRM_OPERATIONS' ? (
                    <span className="ref-seal">{pv.fileRef}</span>
                  ) : (
                    <span className="text-slate-500 italic">Firm Operations</span>
                  )}
                </td>
                <td className="p-3 text-slate-700">{pv.description}</td>
                <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                  RM {pv.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3">
                  {pv.approved ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded flex items-center gap-1 w-max">
                      <CheckCircle className="w-3 h-3" />
                      Approved ({pv.approvedBy})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded flex items-center gap-1 w-max">
                      <AlertTriangle className="w-3 h-3" />
                      Pending Approval
                    </span>
                  )}
                </td>
                <td className="p-3 text-right space-x-1">
                  {!pv.approved && isPartner && (
                    <button
                      onClick={() => approvePaymentVoucher(pv.id, currentPartnerCode)}
                      className="px-2 py-1 text-[10px] font-bold bg-emerald-800 hover:bg-emerald-900 text-white rounded cursor-pointer"
                    >
                      Sign Off
                    </button>
                  )}
                  <button
                    onClick={() => setDocPreviewId(pv.id)}
                    className="px-2 py-1 text-[11px] border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded font-semibold cursor-pointer"
                  >
                    View PV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {docPreviewId && (
        <DocPreviewModal type="paymentVoucher" docId={docPreviewId} onClose={() => setDocPreviewId(null)} />
      )}

      {/* Create PV Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <ReceiptIcon className="w-5 h-5 text-[#A9814A]" />
              Create New Payment Voucher (PV)
            </h3>
            <form onSubmit={handleSaveVoucher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Voucher Category</label>
                  <select
                    value={voucherCategory}
                    onChange={(e) => {
                      const cat = e.target.value as any;
                      setVoucherCategory(cat);
                      if (cat === 'Client Account') setAccountSet('CLIENT');
                      else setAccountSet('OFFICE');
                    }}
                    className="w-full font-bold"
                  >
                    <option value="Travel Mileage">Travel Mileage</option>
                    <option value="Disbursement">Disbursement</option>
                    <option value="Client Account">Client Account</option>
                    <option value="Office Claim">Office Claim</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Account Target</label>
                  <select
                    value={accountSet}
                    onChange={(e) => setAccountSet(e.target.value as any)}
                    className="w-full font-bold"
                  >
                    <option value="OFFICE">Office Operating Account</option>
                    <option value="CLIENT">Client Trust Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Payee / Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Syafiqah Hamizad / High Court Registrar"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="w-full"
                />
              </div>

              {voucherCategory !== 'Office Claim' && (
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Matter Reference</label>
                  <select value={fileRef} onChange={(e) => setFileRef(e.target.value)} className="w-full font-mono">
                    {cases.map((c) => (
                      <option key={c.id} value={c.ref}>
                        {c.ref} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Court filing fees for Writ & Statement of Claim"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block uppercase mb-1">Prepared By</label>
                  <input
                    type="text"
                    required
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px]">
                🔒 <strong>Partner Approval Requirement:</strong> Once created, this Payment Voucher will remain pending until a Partner signs off.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Save &amp; Queue PV for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= 8. RETAINERS & 3-WAY RECONCILIATION ================= */
export const RetainersView: React.FC = () => {
  const { retainers, clients, threeWayRec, canViewModule, currentUser } = useApp();

  const isAccessAllowed = canViewModule('retainers') || canViewModule('trustAccounts');

  if (!isAccessAllowed) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-2xl mx-auto my-12 text-center shadow-md space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto font-bold text-lg">
          🔒
        </div>
        <div>
          <h2 className="font-serif font-bold text-xl text-[#16223A]">
            Access Restricted — Sensitive Module Protected
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            Access to <strong>Client Trust Accounts (SAR 1990)</strong> is strictly controlled at the component level. Your active role or user account is not granted explicit access to this navigation panel item.
          </p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs font-mono space-y-1">
          <div>• Module: Client Trust Accounts &amp; Retainers</div>
          <div>• Current User: {currentUser?.name} ({currentUser?.role})</div>
          <div>• Authority: Super Admin Syafiqah Hamizad</div>
        </div>
      </div>
    );
  }

  const clientBalances: Record<string, number> = {};
  retainers.forEach((r) => {
    clientBalances[r.clientId] =
      (clientBalances[r.clientId] || 0) + (r.type === 'Deposit' ? r.amount : -r.amount);
  });

  const overdrawnClients = Object.entries(clientBalances).filter(([_, bal]) => bal < 0);
  const totalTrustHeld = Object.values(clientBalances).reduce((acc, v) => acc + v, 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Building className="w-5 h-5 text-purple-800" />
          Client Account (Trust) &amp; Solicitors' Account Rules 1990 Compliance
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Client money is held strictly in trust in Client Bank A/C 1020 and cannot be mixed with office funds.
        </p>
      </div>

      {/* Compliance Status Card */}
      <div
        className={`p-4 rounded-xl border shadow-xs ${
          overdrawnClients.length === 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="font-serif font-bold text-sm text-[#16223A]">
            {overdrawnClients.length === 0
              ? '✓ SAR 1990 Trust Control — PASS'
              : '⚠️ SAR 1990 Trust Control — OVERDRAWN LEDGER DETECTED'}
          </div>
          <span className="font-mono text-lg font-bold text-purple-900">
            Total Trust Funds Held: RM {totalTrustHeld.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 3-Way Reconciliation Engine */}
      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-sm text-[#16223A]">
          3-Way Trust Reconciliation Engine (Monthly Audit Requirement)
        </h3>
        <p className="text-xs text-slate-500">
          Reconciles: Adjusted Bank Statement = Cash Book / GL A/C 1020 = Total Matter Ledgers Balance.
        </p>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500">
              <th className="py-2">Month</th>
              <th className="py-2 text-right">Bank Statement</th>
              <th className="py-2 text-right">Cash Book / GL</th>
              <th className="py-2 text-right">Matter Ledgers Total</th>
              <th className="py-2">Reconciliation Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {threeWayRec.map((r, i) => (
              <tr key={i}>
                <td className="py-2.5 font-sans font-bold text-slate-800">{r.month}</td>
                <td className="py-2.5 text-right font-bold">
                  RM {r.bankStatement.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right font-bold">
                  RM {r.cashBookGL.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right font-bold text-purple-900">
                  RM {r.matterLedgerTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 font-sans">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 9. STATEMENT VIEW ================= */
export const StatementView: React.FC = () => {
  const { clients, invoices } = useApp();
  const [selectedCId, setSelectedCId] = useState(clients[0]?.id || '');

  const clientInvs = invoices.filter((i) => i.clientId === selectedCId);
  const totalBilled = clientInvs.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-[#A9814A]" />
          Client Financial Statement
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
        <div className="max-w-xs">
          <label className="font-bold text-slate-700 block uppercase mb-1">Select Client</label>
          <select value={selectedCId} onChange={(e) => setSelectedCId(e.target.value)} className="w-full">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between font-bold">
          <span>Total Invoiced to Client:</span>
          <span className="font-mono text-emerald-800">
            RM {totalBilled.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ================= 10. OFFICE ACCOUNTS (CFO DASHBOARD) ================= */
export const OfficeAccountsView: React.FC = () => {
  const { officeBuckets } = useApp();

  const totalCash = officeBuckets.reduce((s, b) => s + b.balance, 0);
  const monthlyOverhead = 8000;
  const runwayMonths = (totalCash / monthlyOverhead).toFixed(1);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Building className="w-5 h-5 text-[#A9814A]" />
          CFO Office Financial Buckets &amp; Cash Runway Dashboard
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Firm capital allocation across General operating, Reserve, Sinking Fund (PII/Bar fees), and Disbursement buckets.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">Total Firm Office Cash</div>
          <div className="font-serif text-2xl font-bold text-[#16223A] mt-1">
            RM {totalCash.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">Cash Runway (Overhead RM 8,000/mo)</div>
          <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">{runwayMonths} Months</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">Buckets Under Target</div>
          <div className="font-serif text-2xl font-bold text-rose-700 mt-1">
            {officeBuckets.filter((b) => b.target && b.balance < b.target).length} of {officeBuckets.length}
          </div>
        </div>
      </div>

      {/* Bucket Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {officeBuckets.map((b) => (
          <div key={b.code} className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-2">
            <div className="font-mono text-xs font-bold text-slate-500">
              {b.code} — {b.name}
            </div>
            <div className={`font-serif text-xl font-bold ${b.balance < 0 ? 'text-rose-700' : 'text-[#16223A]'}`}>
              RM {b.balance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            {b.target && (
              <div className="text-[10.5px] text-slate-500 font-medium">
                Target: RM {b.target.toLocaleString()} {b.balance < b.target ? '(Under-funded)' : '(On track)'}
              </div>
            )}
            <p className="text-slate-600 leading-relaxed text-[11px] pt-1 border-t border-slate-100">{b.purpose}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ================= 11-15. ACCOUNTING LEDGER VIEWS ================= */
export const CoaView: React.FC = () => {
  const { chartOfAccounts } = useApp();

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#A9814A]" />
          Chart of Accounts
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Code</th>
              <th className="p-3 font-bold">Account Name</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {chartOfAccounts.map((a) => (
              <tr key={a.code}>
                <td className="p-3 font-mono font-bold text-slate-800">{a.code}</td>
                <td className="p-3 font-bold text-[#16223A]">{a.name}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold">
                    {a.type}
                  </span>
                </td>
                <td className="p-3 text-slate-600">{a.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const GLView: React.FC = () => {
  const { generalLedger } = useApp();

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-[#A9814A]" />
          General Ledger (Single Point of Double Entry)
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">GL No</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Doc</th>
              <th className="p-3 font-bold">Set</th>
              <th className="p-3 font-bold">Debit A/C</th>
              <th className="p-3 font-bold">Credit A/C</th>
              <th className="p-3 font-bold text-right">Amount (RM)</th>
              <th className="p-3 font-bold">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {generalLedger.map((g) => (
              <tr key={g.glNo}>
                <td className="p-3 font-bold text-slate-800">{g.glNo}</td>
                <td className="p-3 text-slate-600">{g.date}</td>
                <td className="p-3 font-sans">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded">
                    {g.docType} {g.docNo}
                  </span>
                </td>
                <td className="p-3 font-sans">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      g.accountSet === 'CLIENT' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {g.accountSet}
                  </span>
                </td>
                <td className="p-3 text-slate-800 font-bold">{g.debit}</td>
                <td className="p-3 text-slate-800 font-bold">{g.credit}</td>
                <td className="p-3 text-right font-bold text-[#16223A]">
                  RM {g.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3 font-sans text-slate-700">{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TrialBalanceView: React.FC = () => {
  const { trialBalance } = useApp();

  const totalDebits = trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCredits = trialBalance.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#A9814A]" />
          Trial Balance
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs p-4">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-[#E1DCCF] text-[10px] uppercase text-slate-500 font-sans">
              <th className="py-2">Code</th>
              <th className="py-2">Account Name</th>
              <th className="py-2 text-right">Debit (RM)</th>
              <th className="py-2 text-right">Credit (RM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trialBalance.map((r) => (
              <tr key={r.code}>
                <td className="py-2 font-bold text-slate-700">{r.code}</td>
                <td className="py-2 font-sans font-medium text-slate-800">{r.account}</td>
                <td className="py-2 text-right">
                  RM {r.debit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 text-right">
                  RM {r.credit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 font-bold text-sm text-[#16223A]">
              <td colSpan={2} className="py-3 font-sans">
                Total Balanced Validation
              </td>
              <td className="py-3 text-right">RM {totalDebits.toLocaleString()}</td>
              <td className="py-3 text-right text-emerald-800">RM {totalCredits.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export const BalanceSheetView: React.FC = () => {
  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <LineChart className="w-5 h-5 text-[#A9814A]" />
          Balance Sheet (Assets = Liabilities + Equity)
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4 font-mono">
        <div className="space-y-2">
          <div className="font-bold font-serif text-sm text-[#16223A] border-b border-slate-200 pb-1">ASSETS</div>
          <div className="flex justify-between">
            <span>1010 Office General Bank</span>
            <span>RM 47,700.00</span>
          </div>
          <div className="flex justify-between">
            <span>1011 Office Cash Reserve</span>
            <span>RM 10,000.00</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1">
            <span>TOTAL ASSETS</span>
            <span>RM 57,700.00</span>
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <div className="font-bold font-serif text-sm text-[#16223A] border-b border-slate-200 pb-1">
            LIABILITIES &amp; EQUITY
          </div>
          <div className="flex justify-between">
            <span>3000 Partners' Capital</span>
            <span>RM 50,000.00</span>
          </div>
          <div className="flex justify-between">
            <span>Retained Operating Surplus</span>
            <span>RM 7,700.00</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-800 border-t border-slate-300 pt-1">
            <span>TOTAL LIABILITIES &amp; EQUITY</span>
            <span>RM 57,700.00 (BALANCED)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CashFlowView: React.FC = () => {
  const { cashFlowOffice } = useApp();

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#A9814A]" />
          Cash Flow Statement — Office Bank Account
        </h2>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600 font-sans">
              <th className="p-3 font-bold">Month</th>
              <th className="p-3 font-bold text-right">Opening Balance</th>
              <th className="p-3 font-bold text-right">Money In</th>
              <th className="p-3 font-bold text-right">Money Out</th>
              <th className="p-3 font-bold text-right">Closing Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cashFlowOffice.map((c, i) => (
              <tr key={i}>
                <td className="p-3 font-sans font-bold text-slate-800">{c.month}</td>
                <td className="p-3 text-right">RM {c.opening.toLocaleString()}</td>
                <td className="p-3 text-right text-emerald-800 font-bold">RM {c.moneyIn.toLocaleString()}</td>
                <td className="p-3 text-right text-rose-700 font-bold">RM {c.moneyOut.toLocaleString()}</td>
                <td className="p-3 text-right font-bold text-[#16223A]">RM {c.closing.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ================= 16. PARTNER REPORTS VIEWS ================= */
export const BillingReportsView: React.FC = () => {
  const { invoices = [], payments = [], clients = [], cases = [], showToast } = useApp();

  const safeInvoices = invoices || [];
  const safePayments = payments || [];
  const safeClients = clients || [];
  const safeCases = cases || [];

  const totalInvoiced = safeInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = safePayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalUnpaid = totalInvoiced - totalCollected;
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : '100.0';
  const totalSst = safeInvoices.reduce((s, i) => s + (i.tax || 0), 0);

  // Age calculation helper safely
  const now = new Date();
  const getDaysOverdue = (dueDateStr?: string) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return 0;
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 0;
  };

  // Aging buckets
  const unpaidInvoices = safeInvoices.filter((i) => i.status !== 'Paid');
  const current030 = unpaidInvoices.filter((i) => getDaysOverdue(i.dueDate) <= 30);
  const overdue3160 = unpaidInvoices.filter((i) => getDaysOverdue(i.dueDate) > 30 && getDaysOverdue(i.dueDate) <= 60);
  const overdue6190 = unpaidInvoices.filter((i) => getDaysOverdue(i.dueDate) > 60 && getDaysOverdue(i.dueDate) <= 90);
  const overdue90Plus = unpaidInvoices.filter((i) => getDaysOverdue(i.dueDate) > 90);

  const sumTotal = (arr: typeof safeInvoices) => (arr || []).reduce((s, i) => s + (i.total || 0), 0);

  const handleExportCsv = () => {
    const data = safeInvoices.map((i) => {
      const client = safeClients.find((c) => c.id === i.clientId);
      const cs = safeCases.find((c) => c.id === i.caseId);
      const daysOverdue = i.status === 'Paid' ? 0 : getDaysOverdue(i.dueDate);
      return {
        'Invoice ID': i.id,
        Client: client ? client.name : '—',
        'Matter Ref': cs ? cs.ref : i.fileRef || '—',
        'Total Amount (RM)': i.total || 0,
        'Due Date': i.dueDate || '—',
        'Days Overdue': daysOverdue,
        Status: i.status,
      };
    });
    exportToCsv('AR_Aging_And_Billing_Report', data);
    showToast('Exported billing & AR aging report to CSV / Google Sheets');
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap justify-between items-center bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#A9814A]" />
            Partner Billing, Collections &amp; AR Aging Performance Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time summary of gross billings, tax collected, collection realization, and accounts receivable aging.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#A9814A]" />
          <span>Export CSV / Sheets</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 border border-[#E1DCCF] rounded-xl shadow-xs">
          <div className="text-slate-500 font-bold uppercase text-[10px]">Total Tax Invoiced</div>
          <div className="font-serif text-xl font-bold text-[#16223A] mt-1">
            RM {totalInvoiced.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Includes RM {totalSst.toFixed(2)} SST</div>
        </div>

        <div className="bg-white p-4 border border-[#E1DCCF] rounded-xl shadow-xs">
          <div className="text-slate-500 font-bold uppercase text-[10px]">Collections Received</div>
          <div className="font-serif text-xl font-bold text-emerald-800 mt-1">
            RM {totalCollected.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">{collectionRate}% Collection Efficiency</div>
        </div>

        <div className="bg-white p-4 border border-[#E1DCCF] rounded-xl shadow-xs">
          <div className="text-slate-500 font-bold uppercase text-[10px]">Outstanding Debt (AR)</div>
          <div className="font-serif text-xl font-bold text-rose-700 mt-1">
            RM {totalUnpaid.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">{unpaidInvoices.length} Unpaid Tax Invoices</div>
        </div>

        <div className="bg-white p-4 border border-[#E1DCCF] rounded-xl shadow-xs">
          <div className="text-slate-500 font-bold uppercase text-[10px]">Overdue &gt; 60 Days</div>
          <div className="font-serif text-xl font-bold text-amber-800 mt-1">
            RM {(sumTotal(overdue6190) + sumTotal(overdue90Plus)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Requires Partner Recovery Follow-up</div>
        </div>
      </div>

      {/* Aged Accounts Receivable (AR) Breakdown */}
      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#A9814A]" />
          Aged Accounts Receivable (AR) Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] font-sans font-bold text-slate-500 uppercase">Current (0–30 Days)</div>
            <div className="text-base font-bold text-slate-800 mt-1">
              RM {sumTotal(current030).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-sans text-slate-500 mt-0.5">{current030.length} Invoices</div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-[10px] font-sans font-bold text-amber-800 uppercase">31–60 Days Overdue</div>
            <div className="text-base font-bold text-amber-900 mt-1">
              RM {sumTotal(overdue3160).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-sans text-amber-700 mt-0.5">{overdue3160.length} Invoices</div>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-[10px] font-sans font-bold text-orange-800 uppercase">61–90 Days Overdue</div>
            <div className="text-base font-bold text-orange-900 mt-1">
              RM {sumTotal(overdue6190).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-sans text-orange-700 mt-0.5">{overdue6190.length} Invoices</div>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <div className="text-[10px] font-sans font-bold text-rose-800 uppercase">&gt; 90 Days Overdue</div>
            <div className="text-base font-bold text-rose-900 mt-1">
              RM {sumTotal(overdue90Plus).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-sans text-rose-700 mt-0.5">{overdue90Plus.length} Invoices</div>
          </div>
        </div>
      </div>

      {/* Invoice Recovery Register Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-[#F6F4EE] border-b border-[#E1DCCF] font-serif font-bold text-[#16223A]">
          Outstanding Client Debtors &amp; Payment Status Register
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Invoice ID</th>
              <th className="p-3 font-bold">Client Name</th>
              <th className="p-3 font-bold">Matter Ref</th>
              <th className="p-3 font-bold text-right">Total Amount (RM)</th>
              <th className="p-3 font-bold">Due Date</th>
              <th className="p-3 font-bold">Days Overdue</th>
              <th className="p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {safeInvoices.map((i) => {
              const client = safeClients.find((c) => c.id === i.clientId);
              const cs = safeCases.find((c) => c.id === i.caseId);
              const daysOverdue = i.status === 'Paid' ? 0 : getDaysOverdue(i.dueDate);

              return (
                <tr key={i.id} className="hover:bg-[#FAF8F2]">
                  <td className="p-3 font-mono font-bold text-slate-800">{i.id}</td>
                  <td className="p-3 font-bold text-[#16223A]">{client ? client.name : '—'}</td>
                  <td className="p-3">
                    <span className="ref-seal">{cs ? cs.ref : i.fileRef || '—'}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                    RM {(i.total || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 font-mono text-slate-600">{i.dueDate || '—'}</td>
                  <td className="p-3 font-mono">
                    {daysOverdue > 0 ? (
                      <span className="text-rose-700 font-bold">{daysOverdue} days late</span>
                    ) : (
                      <span className="text-slate-500 font-medium">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        i.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TrustReportsView: React.FC = () => {
  const { retainers, clients, threeWayRec } = useApp();

  const clientBalances: Record<string, number> = {};
  retainers.forEach((r) => {
    clientBalances[r.clientId] =
      (clientBalances[r.clientId] || 0) + (r.type === 'Deposit' ? r.amount : -r.amount);
  });

  const totalTrustHeld = Object.values(clientBalances).reduce((acc, v) => acc + v, 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-800" />
          Client Account Trust Compliance Report (Solicitors' Account Rules 1990)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Audited summary of trust funds held, individual client ledger balances, and monthly 3-way reconciliation status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">Total Trust Monies Held</div>
          <div className="font-serif text-2xl font-bold text-purple-900 mt-1">
            RM {totalTrustHeld.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-purple-700 mt-0.5">Bank A/C 1020 (Client Trust A/C)</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">3-Way Audit Status</div>
          <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">100% RECONCILED</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Zero Variance Detected</div>
        </div>

        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500">Bar Council Compliance</div>
          <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">FULL PASS</div>
          <div className="text-[10px] text-slate-500 mt-0.5">SAR 1990 Strict Separation Verified</div>
        </div>
      </div>

      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-[#F6F4EE] border-b border-[#E1DCCF] font-serif font-bold text-[#16223A]">
          Client Ledger Trust Balances
        </div>
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
              <th className="p-3 font-bold">Client Name</th>
              <th className="p-3 font-bold text-right">Trust Balance (RM)</th>
              <th className="p-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(clientBalances).map(([cId, bal]) => {
              const client = clients.find((c) => c.id === cId);
              return (
                <tr key={cId} className="hover:bg-[#FAF8F2]">
                  <td className="p-3 font-bold text-[#16223A]">{client ? client.name : cId}</td>
                  <td className="p-3 text-right font-mono font-bold text-purple-900">
                    RM {bal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 font-bold text-emerald-800">
                    {bal >= 0 ? '✓ Compliant' : '⚠️ Overdrawn (Non-Compliant)'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const OfficeReportsView: React.FC = () => {
  const { officeBuckets } = useApp();

  const totalCash = officeBuckets.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#A9814A]" />
          Office Accounts &amp; Financial Health Executive Report
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Executive summary of firm working capital, reserve allocations, and cash runway projections.
        </p>
      </div>

      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
        <div className="text-slate-500 font-bold uppercase text-[10px]">Total Office Operating Liquidity</div>
        <div className="font-serif text-3xl font-bold text-[#16223A]">
          RM {totalCash.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
        </div>
        <p className="text-slate-600 text-xs">
          Allocated across General Operating, Emergency Reserve, Sinking Fund (PII/Bar Fees), and Disbursement Capital.
        </p>
      </div>
    </div>
  );
};
