import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Car,
  Receipt as ReceiptIcon,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Printer,
  BookMarked,
  Download,
  Paperclip,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  AlertCircle,
  FileText,
  UploadCloud,
  Eye,
  Check,
  X,
  FileCheck2,
} from 'lucide-react';
import { TravelClaim, Expense, PaymentVoucher, ClaimDocument } from '../../types';
import { claimsStorageService } from '../../services/claimsStorageService';

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
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Firm Roster for Searchable Claimant Dropdowns
const FIRM_CLAIMANTS = [
  { name: 'Puan Syafiqah Hamizad', role: 'Managing Partner / Senior Advocate' },
  { name: 'Encik Amer Haiqal', role: 'Partner / Senior Advocate' },
  { name: 'Cik Zulaikha Afendi', role: 'Senior Advocate & Solicitor' },
  { name: 'Encik Hafizuddin', role: 'Advocate & Solicitor' },
  { name: 'Cik Nur Aisyah', role: 'Legal Assistant / Executive' },
  { name: 'Encik Khairul Azman', role: 'Accounts & Finance Manager' },
  { name: 'Cik Farida Hanim', role: 'Senior Litigation Clerk / Admin' },
];

/* Reusable Searchable Claimant Dropdown Component (with Click-Outside auto-close) */
const SearchableClaimantSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  claimants: Array<{ name: string; role: string }>;
}> = ({ value, onChange, claimants }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = claimants.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.role.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={isOpen ? query : value}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Type to search staff / advocate..."
          className="pl-8 pr-8 py-2 w-full border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#A9814A] focus:border-[#A9814A] outline-none bg-white transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs p-1 cursor-pointer"
            title="Clear Selection"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">No staff matching query</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.name}
                onClick={() => {
                  onChange(c.name);
                  setQuery('');
                  setIsOpen(false);
                }}
                className={`p-2.5 hover:bg-amber-50 cursor-pointer transition-colors flex justify-between items-center text-xs ${
                  value === c.name ? 'bg-amber-50/80 font-bold' : ''
                }`}
              >
                <div>
                  <div className="font-bold text-[#16223A]">{c.name}</div>
                  <div className="text-[10px] text-slate-500">{c.role}</div>
                </div>
                {value === c.name && <Check className="w-4 h-4 text-emerald-600 font-bold" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* Reusable Searchable Matter Reference Dropdown (by running number, case title, or client) */
const SearchableMatterSelect: React.FC<{
  value: string;
  onChange: (fileRef: string, caseId?: string) => void;
  cases: any[];
  clients: any[];
  placeholder?: string;
}> = ({ value, onChange, cases, clients, placeholder = "Search running number or client name..." }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCase = cases.find((c) => c.ref === value);
  const selectedClient = selectedCase ? clients.find((cl) => cl.id === selectedCase.clientId) : null;

  const displayValue = selectedCase
    ? `${selectedCase.ref} — ${selectedCase.title} (${selectedClient?.name || 'N/A'})`
    : value;

  const filteredCases = cases.filter((c) => {
    if (!query) return true;
    const term = query.toLowerCase();
    const clientName = (clients.find((cl) => cl.id === c.clientId)?.name || '').toLowerCase();
    return (
      c.ref.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.practiceArea || '').toLowerCase().includes(term) ||
      clientName.includes(term)
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={isOpen ? query : displayValue}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-8 pr-8 py-2 w-full border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#A9814A] focus:border-[#A9814A] outline-none bg-white transition-all text-slate-800 truncate"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('', '');
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs p-1 cursor-pointer"
            title="Clear Selection"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100">
          {filteredCases.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">No matters found matching query</div>
          ) : (
            filteredCases.map((c) => {
              const clientObj = clients.find((cl) => cl.id === c.clientId);
              const isSelected = value === c.ref;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onChange(c.ref, c.id);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className={`p-2.5 hover:bg-amber-50 cursor-pointer transition-colors flex justify-between items-center text-xs ${
                    isSelected ? 'bg-amber-50/80 font-bold' : ''
                  }`}
                >
                  <div className="space-y-0.5 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-800">
                        {c.ref}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded">
                        {c.practiceArea || 'Litigation'}
                      </span>
                    </div>
                    <div className="font-bold text-[#16223A] truncate">{c.title}</div>
                    <div className="text-[10px] text-slate-500">
                      Client: <strong>{clientObj?.name || 'N/A'}</strong>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 font-bold" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* Drag & Drop Supporting Document File Input & Multi-Document Zone Component */
const DragAndDropFileInput: React.FC<{
  attachmentName?: string;
  attachmentUrl?: string;
  documents?: ClaimDocument[];
  onFileSelect?: (name: string, url: string) => void;
  onDocumentsChange?: (docs: ClaimDocument[]) => void;
  onClear?: () => void;
  label?: string;
}> = ({
  attachmentName,
  attachmentUrl,
  documents = [],
  onFileSelect,
  onDocumentsChange,
  onClear,
  label = "Upload Supporting Receipt / Document *",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive initial list of docs if documents prop is empty but attachmentName exists
  const activeDocs: ClaimDocument[] = documents.length
    ? documents
    : attachmentName
    ? [
        {
          id: 'PRIMARY-DOC',
          name: attachmentName,
          url: attachmentUrl || '',
          type: attachmentName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          category: claimsStorageService.detectDocumentCategory(attachmentName),
          uploadedAt: new Date().toISOString(),
        },
      ]
    : [];

  const handleProcessFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    const addedDocs: ClaimDocument[] = [];
    for (const f of files) {
      try {
        const processed = await claimsStorageService.processFileForClaim(f);
        addedDocs.push({
          id: `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: processed.name,
          url: processed.url,
          type: processed.type,
          category: processed.category,
          size: processed.size,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('File read error:', err);
      }
    }

    const updated = [...activeDocs, ...addedDocs];
    if (onDocumentsChange) {
      onDocumentsChange(updated);
    }
    if (onFileSelect && updated.length > 0) {
      onFileSelect(updated[0].name, updated[0].url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveDoc = (docId: string) => {
    const filtered = activeDocs.filter((d) => d.id !== docId);
    if (onDocumentsChange) {
      onDocumentsChange(filtered);
    }
    if (filtered.length > 0) {
      if (onFileSelect) onFileSelect(filtered[0].name, filtered[0].url);
    } else {
      if (onClear) onClear();
    }
  };

  const handleCategoryChange = (docId: string, category: ClaimDocument['category']) => {
    const updated = activeDocs.map((d) => (d.id === docId ? { ...d, category } : d));
    if (onDocumentsChange) onDocumentsChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="font-bold text-slate-700 block text-xs uppercase flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <UploadCloud className="w-4 h-4 text-[#A9814A]" />
          <span>{label}</span>
        </span>
        {activeDocs.length > 0 && (
          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 font-bold">
            {activeDocs.length} File{activeDocs.length > 1 ? 's' : ''} Attached
          </span>
        )}
      </label>

      {/* Interactive Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#A9814A] bg-amber-50/90 scale-[1.01] shadow-md'
            : activeDocs.length > 0
            ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
            : 'border-slate-300 bg-slate-50/80 hover:bg-slate-100/80 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={(e) => {
            if (e.target.files) handleProcessFiles(e.target.files);
          }}
          className="hidden"
        />

        <div className="space-y-1 py-1">
          <div className="w-9 h-9 mx-auto rounded-full bg-amber-100 text-amber-900 flex items-center justify-center">
            <UploadCloud className="w-5 h-5 text-[#A9814A]" />
          </div>
          <div>
            <span className="font-bold text-xs text-[#16223A]">
              Drag &amp; drop receipt photo, toll slip, or PDF invoice here
            </span>
            <span className="text-xs text-slate-500 font-normal"> or </span>
            <span className="font-bold text-xs text-[#A9814A] underline">browse files</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Supports multi-file attach: Receipt Photos (JPG, PNG), Touch 'n Go Toll Slips, Parking Slips, &amp; Invoices
          </p>
        </div>
      </div>

      {/* List of Attached Supporting Documents & Previews */}
      {activeDocs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
            <span>Attached Supporting Documents ({activeDocs.length})</span>
            {onClear && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="text-[10px] text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {activeDocs.map((doc) => {
              const isImage = doc.url && (doc.url.startsWith('data:image/') || doc.type?.startsWith('image/'));
              return (
                <div
                  key={doc.id}
                  className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-xs hover:border-amber-300 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden max-w-[78%]">
                    {isImage ? (
                      <img
                        src={doc.url}
                        alt={doc.name}
                        className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                        PDF
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-slate-900 truncate" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-0.5">
                        <span className="font-mono">{claimsStorageService.formatFileSize(doc.size || 0)}</span>
                        <span>•</span>
                        <select
                          value={doc.category || 'Receipt Photo'}
                          onChange={(e) => handleCategoryChange(doc.id, e.target.value as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-slate-100 text-slate-800 rounded px-1 py-0.5 text-[9px] font-bold border border-slate-300 cursor-pointer"
                        >
                          <option value="Receipt Photo">Receipt Photo</option>
                          <option value="Toll Slip">Toll Slip</option>
                          <option value="Parking Voucher">Parking Voucher</option>
                          <option value="Official Invoice">Official Invoice</option>
                          <option value="Other Document">Other Document</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveDoc(doc.id);
                    }}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ClaimsViewProps {
  initialTab?: 'OVERVIEW' | 'TRAVEL' | 'DISBURSEMENTS' | 'OFFICE' | 'MATTER' | 'VOUCHERS';
}

export const ReimbursementsClaimsView: React.FC<ClaimsViewProps> = ({
  initialTab = 'OVERVIEW',
}) => {
  const {
    travelClaims = [],
    addTravelClaim,
    updateTravelClaim,
    expenses = [],
    addExpense,
    updateExpense,
    paymentVouchers = [],
    addPaymentVoucher,
    updatePaymentVoucher,
    approvePaymentVoucher,
    addGeneralLedgerEntry,
    cases = [],
    clients = [],
    retainers = [],
    currentUser,
    currentRole,
    showToast,
    addActivityLog,
    addNotification,
    canViewModule,
  } = useApp();

  const isAccessAllowed =
    canViewModule('reimbursements') ||
    canViewModule('claimsManagement') ||
    canViewModule('travelClaims');

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
            Access to <strong>Claims &amp; Staff Reimbursements</strong> is strictly controlled at the component level. Your active role or user account is not granted explicit access to this navigation panel item.
          </p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs font-mono space-y-1">
          <div>• Module: Claims, Travel Reimbursements &amp; Payment Vouchers</div>
          <div>• Current User: {currentUser?.name} ({currentUser?.role})</div>
          <div>• Authority: Super Admin Syafiqah Hamizad</div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'TRAVEL' | 'DISBURSEMENTS' | 'MATTER' | 'VOUCHERS'
  >(initialTab === 'OFFICE' ? 'DISBURSEMENTS' : (initialTab as any));

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'POSTED' | 'REJECTED'>('ALL');

  // Document Viewer Modal State
  const [viewingAttachment, setViewingAttachment] = useState<{
    id: string;
    name: string;
    url?: string;
    documents?: ClaimDocument[];
    activeDocIndex?: number;
  } | null>(null);

  // Helper to trigger claim document viewer with vault support
  const handleViewClaimDocuments = (claim: { id: string; attachmentName?: string; attachmentUrl?: string; documents?: ClaimDocument[] }) => {
    const vaultDocs = claimsStorageService.getClaimDocuments(claim.id);
    const combined = (claim.documents && claim.documents.length) ? claim.documents : vaultDocs;

    if (combined.length > 0) {
      setViewingAttachment({
        id: claim.id,
        name: combined[0].name,
        url: combined[0].url,
        documents: combined,
        activeDocIndex: 0,
      });
    } else if (claim.attachmentName) {
      const singleDoc: ClaimDocument = {
        id: `DOC-PRIMARY-${claim.id}`,
        name: claim.attachmentName,
        url: claim.attachmentUrl || '',
        category: claimsStorageService.detectDocumentCategory(claim.attachmentName),
      };
      setViewingAttachment({
        id: claim.id,
        name: claim.attachmentName,
        url: claim.attachmentUrl,
        documents: [singleDoc],
        activeDocIndex: 0,
      });
    } else {
      showToast('No supporting documents attached to this claim');
    }
  };

  // Modals
  const [isTravelModalOpen, setIsTravelModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isPvModalOpen, setIsPvModalOpen] = useState(false);
  const [previewPv, setPreviewPv] = useState<PaymentVoucher | null>(null);

  // Matter Search States inside Modals
  const [matterSearchQuery, setMatterSearchQuery] = useState('');
  const [claimantSearchQuery, setClaimantSearchQuery] = useState('');

  // Travel Form State
  const [travelForm, setTravelForm] = useState({
    claimant: currentUser?.name || 'Puan Syafiqah Hamizad',
    purposeType: 'Client Matter' as 'Client Matter' | 'Firm/Internal',
    fileRef: cases[0]?.ref || '',
    type: 'Mileage' as 'Mileage' | 'Parking/Toll' | 'Other',
    purpose: '',
    from: 'SHCO Office Bangi',
    to: 'Kuala Lumpur High Court',
    km: 35,
    rate: 1.0, // Standard internal claim RM1.00/km
    tollAmount: 12.5,
    parkingAmount: 10.0,
    otherAmount: 0,
    paidFrom: 'Personal Monies',
    attachmentName: 'high_court_toll_receipt.jpg',
    attachmentUrl: '',
    documents: [] as ClaimDocument[],
  });

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    scope: 'MATTER' as 'MATTER' | 'FIRM',
    caseId: cases[0]?.id || '',
    fileRef: cases[0]?.ref || '',
    category: 'Court Filing Fee',
    amount: '250',
    description: 'High Court Writ Filing & Service Fee',
    claimant: currentUser?.name || 'Puan Syafiqah Hamizad',
    isClaimantAdvance: true, // Did claimant advance personal money?
    attachmentName: 'e_filing_receipt_court.pdf',
    attachmentUrl: '',
    documents: [] as ClaimDocument[],
  });

  // PV Form State
  const [pvForm, setPvForm] = useState({
    voucherCategory: 'Client Disb' as 'Client Disb' | 'Office Operating',
    payee: 'Pendaftar Mahkamah Tinggi Kuala Lumpur',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Office Account Online Transfer' as 'Office Account Online Transfer' | 'Office Cheque' | 'Petty Cash',
    description: 'Payment for Interlocutory Application Filing Fee',
    amount: '500',
    debitAccount: '5001 - Client Disbursement Expense',
    creditAccount: '1001 - Malayan Banking Berhad (Office)',
    clientId: clients[0]?.id || '',
    fileRef: cases[0]?.ref || '',
    bankRef: `MBB-TRF-${Math.floor(100000 + Math.random() * 900000)}`,
    attachmentName: 'official_pv_supporting_doc.pdf',
    attachmentUrl: '',
    documents: [] as ClaimDocument[],
  });

  // Privilege Check: Partner Approval ONLY at Client Account / Matter Disbursements
  const isPartner = currentRole === 'Partner' || currentUser?.email === 'syafiqahhamizad@shcolaw.com' || currentUser?.isAdmin;
  const isFinance = isPartner || currentRole === 'Assistant' || currentRole === 'Reviewer';

  // Helper function to calculate allocated case disbursement budget (Office Account portion)
  // (Note: Trust Account is kept strictly for Stakeholding monies, so claims use the Office Disbursement Account portion per case)
  const getCaseDisbursementBudget = (fileRef: string): number => {
    if (!fileRef || fileRef === 'FIRM_OVERHEAD' || fileRef === 'Firm Operations') return 0;
    const targetCase = cases.find((c) => c.ref === fileRef || c.id === fileRef);
    if (!targetCase) return 0;

    // Use agreed disbursement portion / cap for this case (default RM 2,000 if not explicitly set)
    return targetCase.disbursementAgreedWithClient || targetCase.disbursementCapAmount || 2000;
  };

  // Helper for File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setField: (name: string, url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setField(file.name, reader.result as string);
        showToast(`Document/Receipt attached: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Metrics
  const totalTravelAmount = travelClaims.reduce((acc, c) => acc + c.total, 0);
  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalPvAmount = paymentVouchers.reduce((acc, p) => acc + p.amount, 0);

  const pendingTravelCount = travelClaims.filter(
    (c) => !c.approvalStatus || c.approvalStatus.includes('Pending') || c.approvalStatus === 'Draft'
  ).length;

  const pendingExpenseCount = expenses.filter(
    (e) => !e.approvalStatus || e.approvalStatus.includes('Pending') || e.approvalStatus === 'Draft'
  ).length;

  const pendingPvCount = paymentVouchers.filter(
    (p) => !p.approved && (!p.approvalStatus || p.approvalStatus.includes('Pending') || p.approvalStatus === 'Draft')
  ).length;

  const totalPendingCount = pendingTravelCount + pendingExpenseCount + pendingPvCount;

  const postedTravelCount = travelClaims.filter((c) => c.postedToGl || c.approvalStatus === 'Posted to GL').length;
  const postedExpenseCount = expenses.filter((e) => e.postedToGl || e.approvalStatus === 'Posted to GL').length;
  const postedPvCount = paymentVouchers.filter((p) => p.postedToGl || p.approvalStatus === 'Posted to GL').length;

  // --- ACTIONS ---

  // 1. Approve Travel Claim
  const handleApproveTravelClaim = (claim: TravelClaim) => {
    const isClientAccount = claim.purposeType === 'Client Matter';
    if (isClientAccount && !isPartner) {
      showToast('Access Denied: Partner Approval is required for Client Account claims.');
      return;
    }

    updateTravelClaim(claim.id, {
      approvalStatus: 'Approved',
      approvedBy: currentUser.name,
      approvedAt: new Date().toISOString().slice(0, 10),
    });

    // Send Notification & Log
    addNotification({
      title: 'Travel Claim Approved',
      message: `Travel Claim ${claim.id} (RM ${claim.total.toFixed(2)}) for ${claim.claimant} was approved by ${currentUser.name}.`,
      type: 'invoice',
      linkTab: 'reimbursements',
      linkId: claim.id,
    });
    addActivityLog('Travel Claim Approved', `Claim ${claim.id} approved by ${currentUser.name}`);

    // Auto-generate Payment Voucher if not exists
    const existingPv = paymentVouchers.find((pv) => pv.fileRef === claim.fileRef && pv.amount === claim.total);
    if (!existingPv) {
      const newPv: PaymentVoucher = {
        id: `PV-${Date.now().toString().slice(-5)}`,
        accountSet: isClientAccount ? 'CLIENT' : 'OFFICE',
        voucherCategory: isClientAccount ? 'Client Disb' : 'Office Operating',
        payee: claim.claimant,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Office Account Online Transfer',
        description: `Auto PV for Travel Claim ${claim.id}: ${claim.purpose} (${claim.from} -> ${claim.to})`,
        amount: claim.total,
        debit: '5002 - Travelling & Mileage Expense',
        credit: '1001 - Malayan Banking Berhad (Office)',
        clientId: clients.find((c) => c.name.includes(claim.claimant))?.id || 'CLIENT-GENERIC',
        fileRef: claim.fileRef,
        bankRef: `TRF-${Math.floor(10000 + Math.random() * 90000)}`,
        preparedBy: claim.claimant,
        approvedBy: currentUser.name,
        approved: true,
        approvalStatus: 'Approved',
        attachmentName: claim.attachmentName,
        attachmentUrl: claim.attachmentUrl,
      };
      addPaymentVoucher(newPv);
      showToast(`Approved Travel Claim ${claim.id} & Auto-Generated Payment Voucher ${newPv.id}`);
    } else {
      showToast(`Approved Travel Claim ${claim.id}`);
    }
  };

  // 2. Post Travel Claim to GL
  const handlePostTravelToGl = (claim: TravelClaim) => {
    addGeneralLedgerEntry({
      date: new Date().toISOString().slice(0, 10),
      docType: 'PV',
      docNo: `PV-TC-${claim.id}`,
      accountCode: '5002',
      accountName: 'Travelling & Mileage Claims Expense',
      description: `Travel Claim Reimbursement for ${claim.claimant} [Matter: ${claim.fileRef || 'Firm'}]`,
      fileRef: claim.fileRef,
      amount: claim.total,
      type: 'Debit',
      officeBucket: claim.purposeType === 'Client Matter' ? 'Client Reimbursable' : 'Firm Operational',
    });

    addGeneralLedgerEntry({
      date: new Date().toISOString().slice(0, 10),
      docType: 'PV',
      docNo: `PV-TC-${claim.id}`,
      accountCode: '1001',
      accountName: 'Malayan Banking Berhad (Office Account)',
      description: `Disbursement Payment for Travel Claim ${claim.id} - ${claim.claimant}`,
      fileRef: claim.fileRef,
      amount: claim.total,
      type: 'Credit',
      officeBucket: 'Office Bank',
    });

    updateTravelClaim(claim.id, {
      postedToGl: true,
      approvalStatus: 'Posted to GL',
      postedRef: `GL-TC-${claim.id}`,
    });

    addActivityLog('Posted to General Ledger', `Travel Claim ${claim.id} (RM ${claim.total.toFixed(2)}) posted to GL.`);
    showToast(`Posted Travel Claim ${claim.id} to General Ledger!`);
  };

  // 3. Approve Expense
  const handleApproveExpense = (exp: Expense) => {
    const isClientAccount = exp.billable || exp.accountSet === 'CLIENT';
    if (isClientAccount && !isPartner) {
      showToast('Access Denied: Partner Approval is strictly required for Client Account / Matter Disbursements.');
      return;
    }

    updateExpense(exp.id, {
      approvalStatus: 'Approved',
      approvedBy: currentUser.name,
      approvedAt: new Date().toISOString().slice(0, 10),
    });

    addNotification({
      title: 'Disbursement Approved',
      message: `Disbursement ${exp.id} (RM ${exp.amount.toFixed(2)}) for ${exp.category} was approved by ${currentUser.name}.`,
      type: 'invoice',
      linkTab: 'reimbursements',
      linkId: exp.id,
    });

    showToast(`Expense / Disbursement ${exp.id} Approved by ${currentUser.name}`);
  };

  // 4. Post Expense to GL
  const handlePostExpenseToGl = (exp: Expense) => {
    const cs = cases.find((c) => c.id === exp.caseId);
    const ref = cs ? cs.ref : exp.caseId === 'FIRM_OPERATIONS' ? 'Firm Operations' : exp.caseId;

    addGeneralLedgerEntry({
      date: exp.date || new Date().toISOString().slice(0, 10),
      docType: 'PV',
      docNo: `PV-EX-${exp.id}`,
      accountCode: exp.billable ? '5001' : '5010',
      accountName: exp.billable ? 'Client Disbursement Expense' : 'Firm Overhead Expense',
      description: `Disbursement/Expense ${exp.id}: ${exp.category} - ${exp.description || ''}`,
      fileRef: ref,
      amount: exp.amount,
      type: 'Debit',
      officeBucket: exp.billable ? 'Client Reimbursable' : 'Firm Overhead',
    });

    addGeneralLedgerEntry({
      date: exp.date || new Date().toISOString().slice(0, 10),
      docType: 'PV',
      docNo: `PV-EX-${exp.id}`,
      accountCode: '1001',
      accountName: 'Malayan Banking Berhad (Office Account)',
      description: `Payment for Expense ${exp.id}`,
      fileRef: ref,
      amount: exp.amount,
      type: 'Credit',
      officeBucket: 'Office Bank',
    });

    updateExpense(exp.id, {
      postedToGl: true,
      approvalStatus: 'Posted to GL',
    });

    addActivityLog('Posted to General Ledger', `Expense ${exp.id} (RM ${exp.amount.toFixed(2)}) posted to GL.`);
    showToast(`Posted Expense ${exp.id} to General Ledger!`);
  };

  // 5. Approve & Post Payment Voucher
  const handleApproveAndPostPv = (pv: PaymentVoucher) => {
    if (pv.accountSet === 'CLIENT' && !isPartner) {
      showToast('Access Denied: Partner Approval required for Client Account Payment Vouchers.');
      return;
    }

    approvePaymentVoucher(pv.id, currentUser.name);

    addGeneralLedgerEntry({
      date: pv.date,
      docType: 'PV',
      docNo: pv.id,
      accountCode: pv.debit.split(' ')[0] || '5001',
      accountName: pv.debit.split('- ')[1] || 'Disbursement & Expense',
      description: `Payment Voucher ${pv.id} to ${pv.payee}: ${pv.description}`,
      fileRef: pv.fileRef,
      amount: pv.amount,
      type: 'Debit',
      officeBucket: 'Office Disbursement',
    });

    addGeneralLedgerEntry({
      date: pv.date,
      docType: 'PV',
      docNo: pv.id,
      accountCode: pv.credit.split(' ')[0] || '1001',
      accountName: pv.credit.split('- ')[1] || 'Office Bank Account',
      description: `Payment Voucher ${pv.id} Settlement`,
      fileRef: pv.fileRef,
      amount: pv.amount,
      type: 'Credit',
      officeBucket: 'Office Bank',
    });

    updatePaymentVoucher(pv.id, {
      postedToGl: true,
      approvalStatus: 'Posted to GL',
    });

    showToast(`Approved & Posted Payment Voucher ${pv.id} to GL!`);
  };

  // Send Gmail Notification for PV
  const handleSendPvEmail = (pv: PaymentVoucher) => {
    const subject = encodeURIComponent(`[SHCO Law Firm] Payment Voucher Issued - ${pv.id} (RM ${pv.amount.toFixed(2)})`);
    const body = encodeURIComponent(
      `Dear ${pv.payee},\n\nPayment Voucher ${pv.id} has been processed and approved by ${pv.approvedBy || 'Managing Partner'}.\n\nDetails:\nAmount: RM ${pv.amount.toFixed(2)}\nDescription: ${pv.description}\nMatter Ref: ${pv.fileRef || 'Firm Operations'}\nBank Ref: ${pv.bankRef || 'N/A'}\n\nThank you.\nFinance Department\nSyafiqah Hamizad & Co.`
    );
    window.open(`mailto:accounts@shcolaw.com?subject=${subject}&body=${body}`, '_blank');
    addActivityLog('PV Email Dispatch', `Triggered Gmail dispatch for Payment Voucher ${pv.id}`);
    showToast(`Gmail notification prepared for PV ${pv.id}`);
  };

  // --- MODAL SAVE HANDLERS WITH VALIDATION LAYER & MANAGER APPROVAL ALERTS ---

  const handleSaveTravelModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (travelForm.purposeType === 'Client Matter' && !travelForm.fileRef) {
      alert('Please select a client matter reference');
      return;
    }

    const km = travelForm.km || 0;
    const toll = parseFloat(travelForm.tollAmount as any) || 0;
    const park = parseFloat(travelForm.parkingAmount as any) || 0;
    const other = parseFloat(travelForm.otherAmount as any) || 0;

    // Internal employee reimbursement @ RM1.00/km
    const internalMileage = km * 1.0;
    const internalTotal = internalMileage + toll + park + other;

    // Billable to client @ RM1.50/km
    const billableClientMileage = km * 1.5;
    const billableClientTotal = billableClientMileage + toll + park + other;

    const isClientMatter = travelForm.purposeType === 'Client Matter';
    const matterRef = isClientMatter ? travelForm.fileRef : 'FIRM_OVERHEAD';
    const caseDisbBudget = isClientMatter ? getCaseDisbursementBudget(matterRef) : 999999;

    // Validation check: Cumulative recorded claims for this matter + new claim vs allocated case disbursement portion (Office Acc)
    const matterTravels = travelClaims.filter((tc) => tc.fileRef === matterRef);
    const matterExpenses = expenses.filter((ex) => ex.fileRef === matterRef);
    const matterPvs = paymentVouchers.filter((pv) => pv.fileRef === matterRef);
    const existingClaimsTotal =
      matterTravels.reduce((a, b) => a + b.total, 0) +
      matterExpenses.reduce((a, b) => a + b.amount, 0) +
      matterPvs.reduce((a, b) => a + b.amount, 0);

    const cumulativeTotal = existingClaimsTotal + internalTotal;
    const isExceededBudget = isClientMatter && cumulativeTotal > caseDisbBudget;
    const isCovered = !isExceededBudget;

    const travelDocs = travelForm.documents.length
      ? travelForm.documents
      : travelForm.attachmentName
      ? [{
          id: `DOC-TRV-${Date.now()}`,
          name: travelForm.attachmentName,
          url: travelForm.attachmentUrl || '',
          category: claimsStorageService.detectDocumentCategory(travelForm.attachmentName),
        }]
      : [];

    const newClaim: TravelClaim = {
      id: `TC-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      claimant: travelForm.claimant,
      purposeType: travelForm.purposeType,
      fileRef: matterRef,
      type: travelForm.type,
      purpose: travelForm.purpose,
      from: travelForm.from,
      to: travelForm.to,
      km: km,
      rate: 1.0,
      mileageAmount: internalMileage,
      tollAmount: toll,
      parkingAmount: park,
      otherAmount: other,
      total: internalTotal,
      billableClientTotal: isExceededBudget ? billableClientTotal : internalTotal,
      isClientUpfrontCovered: isCovered,
      clientTrustBalanceSnapshot: caseDisbBudget,
      paidFrom: travelForm.paidFrom,
      billed: isExceededBudget ? 'BILLABLE_EXCEEDED' : 'N',
      invoiceNo: '',
      postedRef: '',
      attachmentName: travelDocs[0]?.name || travelForm.attachmentName || 'travel_receipt.jpg',
      attachmentUrl: travelDocs[0]?.url || travelForm.attachmentUrl,
      documents: travelDocs,
      approvalStatus: 'Pending Approval',
    };

    addTravelClaim(newClaim);
    if (travelDocs.length > 0) {
      claimsStorageService.setClaimDocuments(newClaim.id, travelDocs);
    }
    setIsTravelModalOpen(false);

    // APPROVAL ALERT SYSTEM ROUTING
    if (isClientMatter) {
      // Partner Approval Alert for Client Account
      const partnerEmail = 'syafiqahhamizad@shcolaw.com';
      const partnerName = 'Puan Syafiqah Hamizad (Managing Partner)';

      addNotification({
        title: `[PARTNER APPROVAL REQUIRED] Case Disbursement Travel Claim ${newClaim.id}`,
        message: `New Travel Claim ${newClaim.id} (RM ${newClaim.total.toFixed(2)}) submitted by ${newClaim.claimant} for Matter ${matterRef}. ${
          isExceededBudget
            ? `⚠️ FLAGGED: Exceeds Office Disbursement Budget (RM ${caseDisbBudget.toFixed(2)}). Billable to Client @ RM 1.50/km (RM ${billableClientTotal.toFixed(2)}).`
            : '✓ Covered by Allocated Case Disbursement Portion.'
        } Assigned to ${partnerName}.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newClaim.id,
      });

      addActivityLog(
        'Partner Approval Alert Dispatched',
        `Automated email alert sent to Partner (${partnerEmail}) for Travel Claim ${newClaim.id} [Matter: ${matterRef}]`
      );

      showToast(
        `Travel Claim ${newClaim.id} submitted! ${
          isExceededBudget
            ? '⚠️ Flagged BILLABLE to Client (RM1.50/km surcharge applied). '
            : ''
        }📧 Email alert dispatched to Partner (${partnerEmail})`
      );
    } else {
      // Finance Approval Alert for Office Overhead
      const financeEmail = 'accounts@shcolaw.com';
      const financeManager = 'Cik Nurul Aini (Accounts Manager)';

      addNotification({
        title: `[FINANCE APPROVAL REQUIRED] General Travel Claim ${newClaim.id}`,
        message: `New Office Travel Claim ${newClaim.id} (RM ${newClaim.total.toFixed(2)}) submitted by ${newClaim.claimant}. Assigned to ${financeManager}.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newClaim.id,
      });

      addActivityLog(
        'Finance Approval Alert Dispatched',
        `Automated email alert sent to Finance Dept (${financeEmail}) for Travel Claim ${newClaim.id}`
      );

      showToast(`Travel Claim ${newClaim.id} submitted! 📧 Email alert dispatched to Finance Dept (${financeEmail})`);
    }
  };

  const handleSaveExpenseModal = (e: React.FormEvent) => {
    e.preventDefault();
    const isMatter = expenseForm.scope === 'MATTER';
    if (isMatter && !expenseForm.fileRef) {
      alert('Please select a matter');
      return;
    }

    const amt = parseFloat(expenseForm.amount) || 0;
    const selectedCase = cases.find((c) => c.ref === expenseForm.fileRef || c.id === expenseForm.caseId);
    const matterRef = isMatter ? expenseForm.fileRef : 'FIRM_OVERHEAD';
    const caseDisbBudget = isMatter ? getCaseDisbursementBudget(matterRef) : 999999;

    // Validation check: Cumulative claims for this matter vs allocated disbursement portion
    const matterTravels = travelClaims.filter((tc) => tc.fileRef === matterRef);
    const matterExpenses = expenses.filter((ex) => ex.fileRef === matterRef || ex.caseId === selectedCase?.id);
    const matterPvs = paymentVouchers.filter((pv) => pv.fileRef === matterRef);
    const existingClaimsTotal =
      matterTravels.reduce((a, b) => a + b.total, 0) +
      matterExpenses.reduce((a, b) => a + b.amount, 0) +
      matterPvs.reduce((a, b) => a + b.amount, 0);

    const cumulativeTotal = existingClaimsTotal + amt;
    const isExceededBudget = isMatter && cumulativeTotal > caseDisbBudget;
    const isCovered = !isExceededBudget;

    const expDocs = expenseForm.documents.length
      ? expenseForm.documents
      : expenseForm.attachmentName
      ? [{
          id: `DOC-EXP-${Date.now()}`,
          name: expenseForm.attachmentName,
          url: expenseForm.attachmentUrl || '',
          category: claimsStorageService.detectDocumentCategory(expenseForm.attachmentName),
        }]
      : [];

    const newExp: Expense = {
      id: isMatter ? `EX-${Math.floor(1000 + Math.random() * 9000)}` : `FIRM-EX-${Math.floor(1000 + Math.random() * 9000)}`,
      caseId: isMatter ? selectedCase?.id || expenseForm.caseId : 'FIRM_OPERATIONS',
      accountSet: isMatter ? 'CLIENT' : 'OFFICE',
      date: new Date().toISOString().slice(0, 10),
      category: !isMatter ? `[Firm] ${expenseForm.category}` : expenseForm.category,
      amount: amt,
      billable: isMatter, // Automatically set billable for client disbursements
      description: expenseForm.description,
      claimant: expenseForm.claimant,
      isClaimantAdvance: expenseForm.isClaimantAdvance,
      payee: expenseForm.isClaimantAdvance ? expenseForm.claimant : 'Direct Vendor Payment',
      attachmentName: expDocs[0]?.name || expenseForm.attachmentName || 'supporting_doc.pdf',
      attachmentUrl: expDocs[0]?.url || expenseForm.attachmentUrl,
      documents: expDocs,
      fileRef: matterRef,
      isClientUpfrontCovered: isCovered,
      clientTrustBalanceSnapshot: caseDisbBudget,
      approvalStatus: 'Pending Approval',
    };

    addExpense(newExp);
    if (expDocs.length > 0) {
      claimsStorageService.setClaimDocuments(newExp.id, expDocs);
    }

    // If claimant did NOT advance personal money, auto-generate Payment Voucher to Vendor directly
    if (!expenseForm.isClaimantAdvance) {
      const pv: PaymentVoucher = {
        id: `PV-${Math.floor(10000 + Math.random() * 90000)}`,
        accountSet: isMatter ? 'CLIENT' : 'OFFICE',
        voucherCategory: isMatter ? 'Client Disb' : 'Office Operating',
        payee: expenseForm.category,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Office Account Online Transfer',
        description: `Direct Payment for ${expenseForm.category}: ${expenseForm.description}`,
        amount: amt,
        debit: isMatter ? '5001 - Client Disbursement Expense' : '5010 - Office Overhead',
        credit: '1001 - Malayan Banking Berhad (Office)',
        clientId: selectedCase?.clientId || 'CLIENT-GENERIC',
        fileRef: matterRef,
        bankRef: `DIRECT-PV-${Math.floor(10000 + Math.random() * 90000)}`,
        preparedBy: expenseForm.claimant,
        approvedBy: 'Pending Partner Approval',
        approved: false,
        approvalStatus: 'Pending Approval',
        attachmentName: expenseForm.attachmentName,
        attachmentUrl: expenseForm.attachmentUrl,
      };
      addPaymentVoucher(pv);
    }

    setIsExpenseModalOpen(false);

    // APPROVAL ALERT SYSTEM ROUTING
    if (isMatter) {
      const partnerEmail = 'syafiqahhamizad@shcolaw.com';
      addNotification({
        title: `[PARTNER APPROVAL REQUIRED] Client Disbursement ${newExp.id}`,
        message: `New Disbursement ${newExp.id} (RM ${amt.toFixed(2)}) submitted for ${matterRef}. ${
          isExceededBudget
            ? `⚠️ FLAGGED BILLABLE TO CLIENT (Exceeds Case Allocation RM ${caseDisbBudget.toFixed(2)}).`
            : '✓ Covered by Case Disbursement Allocation.'
        } Partner sign-off required.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newExp.id,
      });

      addActivityLog(
        'Partner Approval Alert Dispatched',
        `Dispatched automated email notification to Partner (${partnerEmail}) for Client Disbursement ${newExp.id} [Matter: ${matterRef}]`
      );

      showToast(
        `Disbursement ${newExp.id} submitted! ${
          isExceededBudget ? '⚠️ Flagged BILLABLE to Client (Exceeds Case Allocation). ' : ''
        }📧 Email alert dispatched to Partner (${partnerEmail})`
      );
    } else {
      const financeEmail = 'accounts@shcolaw.com';
      addNotification({
        title: `[FINANCE APPROVAL REQUIRED] General Expense ${newExp.id}`,
        message: `New Office Expense ${newExp.id} (RM ${amt.toFixed(2)}) for ${expenseForm.category} submitted. Finance Dept approval required.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newExp.id,
      });

      addActivityLog(
        'Finance Approval Alert Dispatched',
        `Dispatched automated email notification to Finance Dept (${financeEmail}) for General Expense ${newExp.id}`
      );

      showToast(`Office Expense ${newExp.id} submitted! 📧 Email alert dispatched to Finance (${financeEmail})`);
    }
  };

  const handleSavePvModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pvForm.payee) {
      alert('Please enter Payee name');
      return;
    }

    const amt = parseFloat(pvForm.amount) || 0;
    const isLegalFeesTransfer = pvForm.voucherCategory === 'Legal Fees Transfer';
    const isClientSet = pvForm.voucherCategory === 'Client Disb' || pvForm.voucherCategory === 'Client Account' || isLegalFeesTransfer;
    const matterRef = isClientSet ? pvForm.fileRef : 'FIRM_OPERATIONS';
    const caseDisbBudget = (isClientSet && !isLegalFeesTransfer) ? getCaseDisbursementBudget(matterRef) : 999999;
    const isExceededBudget = (isClientSet && !isLegalFeesTransfer) && amt > caseDisbBudget;

    const pvDocs = pvForm.documents.length
      ? pvForm.documents
      : pvForm.attachmentName
      ? [{
          id: `DOC-PV-${Date.now()}`,
          name: pvForm.attachmentName,
          url: pvForm.attachmentUrl || '',
          category: claimsStorageService.detectDocumentCategory(pvForm.attachmentName),
        }]
      : [];

    const newPv: PaymentVoucher = {
      id: `PV-${Math.floor(10000 + Math.random() * 90000)}`,
      accountSet: isClientSet ? 'CLIENT' : 'OFFICE',
      voucherCategory: pvForm.voucherCategory,
      payee: pvForm.payee,
      date: pvForm.date,
      paymentMethod: pvForm.paymentMethod,
      description: pvForm.description,
      amount: amt,
      debit: isLegalFeesTransfer ? '1001 - Malayan Banking Berhad (Office)' : pvForm.debitAccount,
      credit: isLegalFeesTransfer ? '2010 - Client Trust Account' : pvForm.creditAccount,
      clientId: pvForm.clientId,
      fileRef: matterRef,
      bankRef: pvForm.bankRef,
      preparedBy: currentUser.name,
      approvedBy: isClientSet ? (isPartner ? currentUser.name : 'Pending Partner Approval') : currentUser.name,
      approved: isClientSet ? isPartner : true,
      approvalStatus: isClientSet ? (isPartner ? 'Approved' : 'Pending Approval') : 'Approved',
      attachmentName: pvDocs[0]?.name || pvForm.attachmentName,
      attachmentUrl: pvDocs[0]?.url || pvForm.attachmentUrl,
      documents: pvDocs,
    };

    addPaymentVoucher(newPv);
    if (pvDocs.length > 0) {
      claimsStorageService.setClaimDocuments(newPv.id, pvDocs);
    }
    setIsPvModalOpen(false);

    if (isLegalFeesTransfer) {
      const partnerEmail = 'syafiqahhamizad@shcolaw.com';
      addNotification({
        title: `[PARTNER APPROVAL REQUIRED] Earned Legal Fees Transfer ${newPv.id}`,
        message: `Payment Voucher ${newPv.id} (RM ${amt.toFixed(2)}) for Legal Fees Transfer from Client Trust to Office Account [Matter: ${matterRef}]. Partner approval required.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newPv.id,
      });

      addActivityLog(
        'Partner Approval Alert Dispatched',
        `Dispatched automated email notification to Partner (${partnerEmail}) for Legal Fees Transfer PV ${newPv.id} [Matter: ${matterRef}]`
      );

      showToast(`Legal Fees Transfer PV ${newPv.id} created! 📧 Email alert sent to Partner (${partnerEmail})`);
    } else if (isClientSet) {
      const partnerEmail = 'syafiqahhamizad@shcolaw.com';
      addNotification({
        title: `[PARTNER APPROVAL REQUIRED] Client Payment Voucher ${newPv.id}`,
        message: `Payment Voucher ${newPv.id} (RM ${amt.toFixed(2)}) for ${pvForm.payee} [Matter: ${matterRef}]. ${
          isExceededBudget ? '⚠️ EXCEEDS OFFICE DISBURSEMENT BUDGET: Flagged Billable.' : '✓ Covered by Case Disbursement Allocation.'
        } Partner approval required.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newPv.id,
      });

      addActivityLog(
        'Partner Approval Alert Dispatched',
        `Dispatched automated email notification to Partner (${partnerEmail}) for Payment Voucher ${newPv.id}`
      );

      showToast(`Payment Voucher ${newPv.id} created! 📧 Email alert sent to Partner (${partnerEmail})`);
    } else {
      const financeEmail = 'accounts@shcolaw.com';
      addNotification({
        title: `[FINANCE APPROVAL REQUIRED] Office Payment Voucher ${newPv.id}`,
        message: `Payment Voucher ${newPv.id} (RM ${amt.toFixed(2)}) for ${pvForm.payee} created. Assigned to Finance Dept.`,
        type: 'invoice',
        linkTab: 'reimbursements',
        linkId: newPv.id,
      });

      addActivityLog(
        'Finance Approval Alert Dispatched',
        `Dispatched automated email notification to Finance (${financeEmail}) for Payment Voucher ${newPv.id}`
      );

      showToast(`Payment Voucher ${newPv.id} created! 📧 Email alert sent to Finance (${financeEmail})`);
    }
  };

  // CSV Export for Claims Register
  const handleExportAllCsv = () => {
    const data = [
      ...travelClaims.map((tc) => ({
        Module: 'Travel & Mileage',
        ID: tc.id,
        Date: tc.date,
        Claimant: tc.claimant,
        Ref: tc.fileRef,
        Category: tc.type,
        Description: `${tc.purpose} (${tc.from} -> ${tc.to}, ${tc.km}km)`,
        'Internal Claim (RM)': tc.total,
        'Billable Client (RM)': tc.billableClientTotal || tc.total,
        Status: tc.approvalStatus || 'Pending Approval',
        'Posted to GL': tc.postedToGl ? 'Yes' : 'No',
      })),
      ...expenses.map((ex) => {
        const cs = cases.find((c) => c.id === ex.caseId);
        return {
          Module: 'Expense / Disbursement',
          ID: ex.id,
          Date: ex.date,
          Claimant: ex.claimant || 'Staff',
          Ref: cs ? cs.ref : ex.caseId,
          Category: ex.category,
          Description: ex.description || '',
          'Amount (RM)': ex.amount,
          Status: ex.approvalStatus || 'Pending Approval',
          'Posted to GL': ex.postedToGl ? 'Yes' : 'No',
        };
      }),
      ...paymentVouchers.map((pv) => ({
        Module: 'Payment Voucher',
        ID: pv.id,
        Date: pv.date,
        Payee: pv.payee,
        Ref: pv.fileRef,
        Category: pv.voucherCategory,
        Description: pv.description,
        'Amount (RM)': pv.amount,
        Status: pv.approvalStatus || (pv.approved ? 'Approved' : 'Pending Approval'),
        'Posted to GL': pv.postedToGl ? 'Yes' : 'No',
      })),
    ];

    exportToCsv('Claims_Register_SHCO', data);
    showToast('Exported complete Claims Register to CSV');
  };

  // Filtered cases and claimants for search dropdowns
  const filteredCases = cases.filter(
    (c) =>
      !matterSearchQuery ||
      c.ref.toLowerCase().includes(matterSearchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(matterSearchQuery.toLowerCase()) ||
      (c.clientName && c.clientName.toLowerCase().includes(matterSearchQuery.toLowerCase()))
  );

  const filteredClaimants = FIRM_CLAIMANTS.filter(
    (fc) =>
      !claimantSearchQuery ||
      fc.name.toLowerCase().includes(claimantSearchQuery.toLowerCase()) ||
      fc.role.toLowerCase().includes(claimantSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 text-xs select-none">
      {/* Page Header */}
      <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300 uppercase tracking-wider">
              Claims &amp; Disbursements Hub
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-[11px] text-slate-500 font-medium">Full Accounting Compliance</span>
          </div>
          <h1 className="font-serif text-xl font-bold text-[#16223A] mt-1 flex items-center gap-2">
            <ReceiptIcon className="w-6 h-6 text-[#A9814A]" />
            Claims
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Unified workflow for Travel Claims, Client Disbursements, Overhead Expenses &amp; Payment Vouchers with receipt document attachments, client upfront deposit alignment, and mandatory Partner sign-off on Client Account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportAllCsv}
            className="border border-[#E1DCCF] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A9814A]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsTravelModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Car className="w-4 h-4 text-amber-300" />
            <span>+ Travel Claim</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-emerald-300" />
            <span>+ Disbursement / Expense</span>
          </button>
          <button
            onClick={() => setIsPvModalOpen(true)}
            className="bg-[#A9814A] hover:bg-[#8F6A38] text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>+ Payment Voucher</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Active Claims</span>
            <ReceiptIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="font-serif text-xl font-bold text-[#16223A] mt-2">
            RM {(totalTravelAmount + totalExpenseAmount + totalPvAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {travelClaims.length + expenses.length + paymentVouchers.length} Total records in system
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Awaiting Partner Approval</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-serif text-xl font-bold text-amber-900 mt-2">
            {totalPendingCount} Items
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium">
            Partner approval strictly required for Client Account
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Posted to General Ledger</span>
            <BookMarked className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-serif text-xl font-bold text-emerald-900 mt-2">
            {postedTravelCount + postedExpenseCount + postedPvCount} Posted
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            Debited to Office Expenses / Credited to Bank
          </div>
        </div>

        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Approval Matrix Policy</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs text-slate-300 mt-2">
              Client Account: <span className="font-bold text-amber-300">Partner Approval Only</span>.<br />
              Office Overhead: <span className="text-slate-200 font-semibold">Finance / Accounts Approval</span>.
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 border-t border-slate-800 pt-1.5">
            <span>Current Role:</span> <strong className="text-amber-300">{currentRole}</strong> ({currentUser?.name})
          </div>
        </div>
      </div>

      {/* Workflow Visualizer */}
      <div className="bg-[#FAF8F2] border border-[#E1DCCF] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Claim Governance Workflow:</span>
        </div>

        <div className="flex items-center gap-1.5 font-medium">
          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-semibold">1. Log Claim &amp; Upload Receipt</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold border border-amber-300">2. Partner / Finance Approval</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold border border-blue-300">3. Deposit Check / Auto PV</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold border border-emerald-300">4. Post to General Ledger</span>
        </div>
      </div>

      {/* Tabs and Filters Navigation */}
      <div className="bg-white border border-[#E1DCCF] p-3 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 pb-3">
          <div className="flex gap-1.5 bg-[#F6F4EE] p-1 rounded-lg border border-[#E1DCCF]">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeTab === 'OVERVIEW'
                  ? 'bg-[#16223A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 All Consolidated Claims
            </button>
            <button
              onClick={() => setActiveTab('TRAVEL')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeTab === 'TRAVEL'
                  ? 'bg-[#16223A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚗 Travel &amp; Mileage ({travelClaims.length})
            </button>
            <button
              onClick={() => setActiveTab('DISBURSEMENTS')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeTab === 'DISBURSEMENTS'
                  ? 'bg-[#16223A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📂 Disbursements &amp; Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('MATTER')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeTab === 'MATTER'
                  ? 'bg-[#16223A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💼 Claims Grouped by Matter ({cases.length})
            </button>
            <button
              onClick={() => setActiveTab('VOUCHERS')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                activeTab === 'VOUCHERS'
                  ? 'bg-[#16223A] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 Payment Vouchers (PV) ({paymentVouchers.length})
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Claimant, Ref, Payee, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#16223A]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted to GL</option>
            </select>
          </div>
        </div>

        {/* TAB CONTENTS */}

        {/* 1. TAB: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                  <th className="p-3 font-bold">Module / ID</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold">Claimant / Payee</th>
                  <th className="p-3 font-bold">Matter / Scope Target</th>
                  <th className="p-3 font-bold">Category &amp; Description</th>
                  <th className="p-3 font-bold text-right">Amount (RM)</th>
                  <th className="p-3 font-bold text-center">Receipt Doc</th>
                  <th className="p-3 font-bold text-center">Approval Workflow</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* TRAVEL CLAIMS */}
                {travelClaims
                  .filter((tc) => {
                    const matchSearch =
                      !searchTerm ||
                      tc.claimant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      tc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      tc.fileRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (tc.purpose && tc.purpose.toLowerCase().includes(searchTerm.toLowerCase()));
                    const isPending = !tc.approvalStatus || tc.approvalStatus.includes('Pending');
                    const isApproved = tc.approvalStatus === 'Approved';
                    const isPosted = tc.postedToGl || tc.approvalStatus === 'Posted to GL';
                    if (statusFilter === 'PENDING' && !isPending) return false;
                    if (statusFilter === 'APPROVED' && !isApproved) return false;
                    if (statusFilter === 'POSTED' && !isPosted) return false;
                    return matchSearch;
                  })
                  .map((tc) => {
                    const isPosted = tc.postedToGl || tc.approvalStatus === 'Posted to GL';
                    const isApproved = tc.approvalStatus === 'Approved' || isPosted;
                    const isClientAcc = tc.purposeType === 'Client Matter';

                    return (
                      <tr key={tc.id} className="hover:bg-[#FAF8F2]">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-amber-600" />
                            <span>{tc.id}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{tc.date}</td>
                        <td className="p-3 font-semibold text-slate-900">{tc.claimant}</td>
                        <td className="p-3 font-mono">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800">
                            {tc.fileRef || 'Firm Overhead'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-purple-900">{tc.type} ({tc.km} km @ RM1.00)</div>
                          <div className="text-[11px] text-slate-600 truncate max-w-xs">{tc.purpose} ({tc.from} -&gt; {tc.to})</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                          RM {tc.total.toFixed(2)}
                          {!tc.isClientUpfrontCovered && isClientAcc && (
                            <div className="text-[9px] text-amber-700 font-sans font-bold">
                              Billable @ RM1.50/km: RM {(tc.billableClientTotal || tc.total * 1.5).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {tc.attachmentName ? (
                            <button
                              onClick={() => handleViewClaimDocuments(tc)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3 text-amber-700" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No File</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isPosted ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full border border-emerald-300">
                              ✓ Posted to GL
                            </span>
                          ) : isApproved ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full border border-blue-300">
                              ✓ Approved by Partner
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300">
                              ⏳ Pending {isClientAcc ? 'Partner' : 'Finance'} Approval
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          {!isApproved && (isClientAcc ? isPartner : isFinance) && (
                            <button
                              onClick={() => handleApproveTravelClaim(tc)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {isApproved && !isPosted && (
                            <button
                              onClick={() => handlePostTravelToGl(tc)}
                              className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Post GL
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {/* EXPENSES / DISBURSEMENTS */}
                {expenses
                  .filter((ex) => {
                    const matchSearch =
                      !searchTerm ||
                      ex.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      ex.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (ex.claimant && ex.claimant.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      (ex.description && ex.description.toLowerCase().includes(searchTerm.toLowerCase()));
                    const isPending = !ex.approvalStatus || ex.approvalStatus.includes('Pending');
                    const isApproved = ex.approvalStatus === 'Approved';
                    const isPosted = ex.postedToGl || ex.approvalStatus === 'Posted to GL';
                    if (statusFilter === 'PENDING' && !isPending) return false;
                    if (statusFilter === 'APPROVED' && !isApproved) return false;
                    if (statusFilter === 'POSTED' && !isPosted) return false;
                    return matchSearch;
                  })
                  .map((ex) => {
                    const cs = cases.find((c) => c.id === ex.caseId);
                    const isPosted = ex.postedToGl || ex.approvalStatus === 'Posted to GL';
                    const isApproved = ex.approvalStatus === 'Approved' || isPosted;
                    const isClientAcc = ex.billable || ex.accountSet === 'CLIENT';

                    return (
                      <tr key={ex.id} className="hover:bg-[#FAF8F2]">
                        <td className="p-3 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <ReceiptIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{ex.id}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{ex.date}</td>
                        <td className="p-3 font-semibold text-slate-900">{ex.claimant || 'Staff'}</td>
                        <td className="p-3 font-mono">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800">
                            {cs ? cs.ref : ex.caseId}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-purple-900">{ex.category}</div>
                          <div className="text-[11px] text-slate-600 truncate max-w-xs">{ex.description || '—'}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                          RM {ex.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {ex.attachmentName ? (
                            <button
                              onClick={() => handleViewClaimDocuments(ex)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3 text-amber-700" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No File</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isPosted ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full border border-emerald-300">
                              ✓ Posted to GL
                            </span>
                          ) : isApproved ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full border border-blue-300">
                              ✓ Approved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300">
                              ⏳ Pending {isClientAcc ? 'Partner' : 'Finance'} Approval
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          {!isApproved && (isClientAcc ? isPartner : isFinance) && (
                            <button
                              onClick={() => handleApproveExpense(ex)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {isApproved && !isPosted && (
                            <button
                              onClick={() => handlePostExpenseToGl(ex)}
                              className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Post GL
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. TAB: TRAVEL & MILEAGE */}
        {activeTab === 'TRAVEL' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF]">
              <div className="text-xs text-slate-700">
                Internal Claim Rate: <strong className="text-[#16223A]">RM 1.00 / km</strong> | Client Unfunded Rate: <strong className="text-amber-800">RM 1.50 / km</strong> (Tolls &amp; Parking Itemized)
              </div>
              <button
                onClick={() => setIsTravelModalOpen(true)}
                className="bg-[#16223A] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Car className="w-3.5 h-3.5 text-amber-300" />
                <span>Log Travel Claim</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                    <th className="p-3 font-bold">Claim ID</th>
                    <th className="p-3 font-bold">Date</th>
                    <th className="p-3 font-bold">Claimant</th>
                    <th className="p-3 font-bold">Matter Ref</th>
                    <th className="p-3 font-bold">Route / Purpose</th>
                    <th className="p-3 font-bold text-center">Distance (KM)</th>
                    <th className="p-3 font-bold text-right">Mileage (RM)</th>
                    <th className="p-3 font-bold text-right">Tolls / Park</th>
                    <th className="p-3 font-bold text-right">Staff Claim (RM)</th>
                    <th className="p-3 font-bold text-center">Deposit Coverage</th>
                    <th className="p-3 font-bold text-center">Receipt</th>
                    <th className="p-3 font-bold text-center">Approval Status</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {travelClaims
                    .filter((tc) => {
                      return (
                        !searchTerm ||
                        tc.claimant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        tc.fileRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        tc.id.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                    })
                    .map((tc) => {
                      const isPosted = tc.postedToGl || tc.approvalStatus === 'Posted to GL';
                      const isApproved = tc.approvalStatus === 'Approved' || isPosted;
                      const isClientAcc = tc.purposeType === 'Client Matter';

                      return (
                        <tr key={tc.id} className="hover:bg-[#FAF8F2]">
                          <td className="p-3 font-mono font-bold text-amber-900">{tc.id}</td>
                          <td className="p-3 font-mono text-slate-600">{tc.date}</td>
                          <td className="p-3 font-semibold text-slate-900">{tc.claimant}</td>
                          <td className="p-3 font-mono">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800">
                              {tc.fileRef || 'Firm Overhead'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{tc.purpose}</div>
                            <div className="text-[11px] text-slate-500">{tc.from} ➔ {tc.to}</div>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-800">{tc.km} km</td>
                          <td className="p-3 text-right font-mono">RM {tc.mileageAmount.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            RM {((tc.tollAmount || 0) + (tc.parkingAmount || 0) + (tc.otherAmount || 0)).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                            RM {tc.total.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {tc.isClientUpfrontCovered ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold">
                                ✓ Client Deposit
                              </span>
                            ) : isClientAcc ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold block">
                                ⚠️ Bill @ RM1.50/km
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                                Firm Overhead
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {tc.attachmentName ? (
                              <button
                                onClick={() => handleViewClaimDocuments(tc)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Paperclip className="w-3 h-3 text-amber-700" />
                                <span>Receipt</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPosted ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full">
                                Posted GL
                              </span>
                            ) : isApproved ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                                Pending {isClientAcc ? 'Partner' : 'Finance'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1">
                            {!isApproved && (isClientAcc ? isPartner : isFinance) && (
                              <button
                                onClick={() => handleApproveTravelClaim(tc)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {isApproved && !isPosted && (
                              <button
                                onClick={() => handlePostTravelToGl(tc)}
                                className="bg-[#16223A] text-amber-300 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Post GL
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. TAB: DISBURSEMENTS & EXPENSES */}
        {activeTab === 'DISBURSEMENTS' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF]">
              <div className="text-xs text-slate-700">
                Out-of-Pocket Disbursements &amp; Vendor Invoices | Partner Approval required for Client Account Disbursements
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-[#16223A] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-300" />
                <span>+ Log Disbursement</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                    <th className="p-3 font-bold">Disb ID</th>
                    <th className="p-3 font-bold">Date</th>
                    <th className="p-3 font-bold">Claimant / Payee</th>
                    <th className="p-3 font-bold">Advance Type</th>
                    <th className="p-3 font-bold">Matter Ref</th>
                    <th className="p-3 font-bold">Category &amp; Particulars</th>
                    <th className="p-3 font-bold text-right">Amount (RM)</th>
                    <th className="p-3 font-bold text-center">Trust Coverage</th>
                    <th className="p-3 font-bold text-center">Receipt</th>
                    <th className="p-3 font-bold text-center">Status</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses
                    .filter((ex) => {
                      return (
                        !searchTerm ||
                        ex.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        ex.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (ex.claimant && ex.claimant.toLowerCase().includes(searchTerm.toLowerCase()))
                      );
                    })
                    .map((ex) => {
                      const cs = cases.find((c) => c.id === ex.caseId);
                      const isPosted = ex.postedToGl || ex.approvalStatus === 'Posted to GL';
                      const isApproved = ex.approvalStatus === 'Approved' || isPosted;
                      const isClientAcc = ex.billable || ex.accountSet === 'CLIENT';

                      return (
                        <tr key={ex.id} className="hover:bg-[#FAF8F2]">
                          <td className="p-3 font-mono font-bold text-emerald-900">{ex.id}</td>
                          <td className="p-3 font-mono text-slate-600">{ex.date}</td>
                          <td className="p-3 font-semibold text-slate-900">{ex.claimant || 'Staff / Vendor'}</td>
                          <td className="p-3">
                            {ex.isClaimantAdvance ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded text-[10px]">
                                Staff Advance Claim
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded text-[10px]">
                                Direct Firm Payment
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800">
                              {cs ? cs.ref : ex.caseId}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-purple-900">{ex.category}</div>
                            <div className="text-[11px] text-slate-600 truncate max-w-xs">{ex.description || '—'}</div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                            RM {ex.amount.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {ex.isClientUpfrontCovered ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold">
                                Covered by Deposit
                              </span>
                            ) : isClientAcc ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                                Bill on Next Invoice
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                                Firm Expense
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {ex.attachmentName ? (
                              <button
                                onClick={() => handleViewClaimDocuments(ex)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Paperclip className="w-3 h-3 text-amber-700" />
                                <span>Receipt</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPosted ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full">
                                Posted GL
                              </span>
                            ) : isApproved ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                                Pending {isClientAcc ? 'Partner' : 'Finance'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1">
                            {!isApproved && (isClientAcc ? isPartner : isFinance) && (
                              <button
                                onClick={() => handleApproveExpense(ex)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {isApproved && !isPosted && (
                              <button
                                onClick={() => handlePostExpenseToGl(ex)}
                                className="bg-[#16223A] text-amber-300 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Post GL
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.5 TAB: CLAIMS GROUPED BY MATTER */}
        {activeTab === 'MATTER' && (
          <div className="space-y-4">
            <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <span className="font-serif font-bold text-[#16223A] text-sm block">
                  Logical Expense &amp; Claim Grouping Per Matter / Case
                </span>
                <span className="text-slate-600 text-[11px]">
                  Compares recorded claims against client upfront trust deposits. If claims exceed deposit, flagged as 'Billable' with mileage calculated @ RM 1.50/km.
                </span>
              </div>
              <button
                onClick={() => {
                  const matterData = cases.map((c) => {
                    const caseTravels = travelClaims.filter((tc) => tc.fileRef === c.ref);
                    const caseExpenses = expenses.filter((ex) => ex.fileRef === c.ref || ex.caseId === c.id);
                    const totalKm = caseTravels.reduce((acc, tc) => acc + tc.km, 0);
                    const clientMileageFee = totalKm * 1.5;
                    const travelTotal = caseTravels.reduce((acc, tc) => acc + tc.total, 0);
                    const expenseTotal = caseExpenses.reduce((acc, ex) => acc + ex.amount, 0);
                    const grandTotal = travelTotal + expenseTotal;
                    const caseDisbBudget = getCaseDisbursementBudget(c.ref);
                    const isBillable = grandTotal > caseDisbBudget;

                    return {
                      FileRef: c.ref,
                      MatterTitle: c.title,
                      ClientName: clients.find((cl) => cl.id === c.clientId)?.name || 'N/A',
                      OfficeDisbursementBudgetRM: caseDisbBudget.toFixed(2),
                      StaffClaimsRM: grandTotal.toFixed(2),
                      CalculatedMileageKM: totalKm,
                      ClientMileageBillingRM: clientMileageFee.toFixed(2),
                      BillableStatus: isBillable ? 'FLAGGED BILLABLE (Exceeds Office Disb Budget)' : 'Covered by Case Disb Allocation',
                    };
                  });
                  exportToCsv('Matter_Claims_Summary', matterData);
                  showToast('Exported Matter Claims & Mileage Billing Summary CSV');
                }}
                className="px-3 py-1.5 bg-[#16223A] text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#1F2E4D]"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Export Matter Summary CSV</span>
              </button>
            </div>

            <div className="space-y-4">
              {cases.map((caseItem) => {
                const matterTravels = travelClaims.filter((tc) => tc.fileRef === caseItem.ref);
                const matterExpenses = expenses.filter((ex) => ex.fileRef === caseItem.ref || ex.caseId === caseItem.id);
                const matterPvs = paymentVouchers.filter((pv) => pv.fileRef === caseItem.ref);

                const totalStaffTravel = matterTravels.reduce((acc, tc) => acc + tc.total, 0);
                const totalKm = matterTravels.reduce((acc, tc) => acc + tc.km, 0);
                const clientMileageBilling = totalKm * 1.5;
                const totalOutofPocket = matterExpenses.reduce((acc, ex) => acc + ex.amount, 0);
                const totalPv = matterPvs.reduce((acc, pv) => acc + pv.amount, 0);

                const grandClaimsTotal = totalStaffTravel + totalOutofPocket + totalPv;
                const caseDisbBudget = getCaseDisbursementBudget(caseItem.ref);
                const isBillableFlag = grandClaimsTotal > caseDisbBudget;
                const billableExcess = Math.max(0, grandClaimsTotal - caseDisbBudget);

                const clientObj = clients.find((cl) => cl.id === caseItem.clientId);

                if (
                  searchTerm &&
                  !caseItem.ref.toLowerCase().includes(searchTerm.toLowerCase()) &&
                  !caseItem.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
                  !(clientObj?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                ) {
                  return null;
                }

                return (
                  <div
                    key={caseItem.id}
                    className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs space-y-3 p-4"
                  >
                    {/* Matter Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 rounded">
                            {caseItem.ref}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded text-[10px]">
                            {caseItem.practiceArea || 'Litigation'}
                          </span>
                        </div>
                        <h3 className="font-serif font-bold text-base text-[#16223A] mt-1">
                          {caseItem.title}
                        </h3>
                        <div className="text-slate-500 text-xs mt-0.5">
                          Client: <strong>{clientObj?.name || 'N/A'}</strong>
                        </div>
                      </div>

                      {/* Deposit & Billable Status Cards */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Office Disb. Allocation
                          </span>
                          <span className="font-mono font-bold text-emerald-800 text-sm">
                            RM {caseDisbBudget.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">
                            Recorded Claims Total
                          </span>
                          <span className="font-mono font-bold text-[#16223A] text-sm">
                            RM {grandClaimsTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div>
                          {isBillableFlag ? (
                            <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold text-xs flex flex-col items-end">
                              <span className="flex items-center gap-1 text-rose-700">
                                <AlertCircle className="w-3.5 h-3.5" />
                                FLAGGED: BILLABLE TO CLIENT
                              </span>
                              <span className="text-[10px] text-rose-800">
                                Exceeds Allocation by RM {billableExcess.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 font-bold text-xs flex flex-col items-end">
                              <span className="flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Budget Covered
                              </span>
                              <span className="text-[10px] text-emerald-800">
                                Within Disb. Allocation
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calculated Mileage Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">
                          Total Matter Travel Distance
                        </span>
                        <strong className="font-mono text-sm text-slate-800">{totalKm} KM</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block uppercase">
                          Internal Staff Reimbursement (@ RM 1.00/km)
                        </span>
                        <strong className="font-mono text-sm text-slate-800">RM {(totalKm * 1.0).toFixed(2)}</strong>
                      </div>
                      <div className="bg-amber-100/70 p-2 rounded border border-amber-300">
                        <span className="text-[10px] text-amber-950 font-bold block uppercase">
                          Client Mileage Invoice Billing (@ RM 1.50/km)
                        </span>
                        <strong className="font-mono text-sm text-amber-950">
                          RM {clientMileageBilling.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    {/* Grouped Claims Tables */}
                    <div className="space-y-2">
                      <div className="font-bold text-xs text-slate-700 flex justify-between items-center">
                        <span>Associated Travel Claims ({matterTravels.length})</span>
                      </div>

                      {matterTravels.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded">
                          No travel claims recorded under this matter.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] text-slate-600 uppercase">
                                <th className="p-2 font-bold">Claim ID</th>
                                <th className="p-2 font-bold">Claimant</th>
                                <th className="p-2 font-bold">Route &amp; Purpose</th>
                                <th className="p-2 font-bold text-right">Distance / Staff Amt</th>
                                <th className="p-2 font-bold text-right">Client Billable (@ RM1.50/km)</th>
                                <th className="p-2 font-bold text-center">Receipt</th>
                                <th className="p-2 font-bold text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {matterTravels.map((tc) => (
                                <tr key={tc.id}>
                                  <td className="p-2 font-bold text-amber-900">{tc.id}</td>
                                  <td className="p-2 font-sans font-semibold text-slate-800">{tc.claimant}</td>
                                  <td className="p-2 font-sans text-slate-700">
                                    {tc.from} → {tc.to} ({tc.purpose})
                                  </td>
                                  <td className="p-2 text-right text-slate-900">
                                    {tc.km} km | RM {tc.total.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right text-amber-900 font-bold">
                                    RM {((tc.km * 1.5) + (tc.tollAmount || 0) + (tc.parkingAmount || 0)).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-center">
                                    {tc.attachmentName ? (
                                      <button
                                        onClick={() => handleViewClaimDocuments(tc)}
                                        className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Paperclip className="w-3 h-3 text-amber-700" />
                                        <span>Receipt</span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">None</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center font-sans">
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[10px]">
                                      {tc.approvalStatus || 'Approved'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="font-bold text-xs text-slate-700 pt-2 flex justify-between items-center">
                        <span>Out-of-Pocket Disbursements ({matterExpenses.length})</span>
                      </div>

                      {matterExpenses.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded">
                          No out-of-pocket expenses recorded under this matter.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] text-slate-600 uppercase">
                                <th className="p-2 font-bold">Expense ID</th>
                                <th className="p-2 font-bold">Claimant</th>
                                <th className="p-2 font-bold">Category &amp; Description</th>
                                <th className="p-2 font-bold text-right">Amount (RM)</th>
                                <th className="p-2 font-bold text-center">Receipt</th>
                                <th className="p-2 font-bold text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {matterExpenses.map((ex) => (
                                <tr key={ex.id}>
                                  <td className="p-2 font-bold text-purple-900">{ex.id}</td>
                                  <td className="p-2 font-sans font-semibold text-slate-800">{ex.claimant || 'Staff'}</td>
                                  <td className="p-2 font-sans text-slate-700">
                                    <strong className="text-purple-950">{ex.category}</strong>: {ex.description}
                                  </td>
                                  <td className="p-2 text-right font-bold text-slate-900">
                                    RM {ex.amount.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-center">
                                    {ex.attachmentName ? (
                                      <button
                                        onClick={() => handleViewClaimDocuments(ex)}
                                        className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Paperclip className="w-3 h-3 text-amber-700" />
                                        <span>Receipt</span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">None</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center font-sans">
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[10px]">
                                      {ex.approvalStatus || 'Approved'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. TAB: PAYMENT VOUCHERS */}
        {activeTab === 'VOUCHERS' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF]">
              <div className="text-xs text-slate-700">
                Official Payment Vouchers (PV) Register | SRO 2023 &amp; SAR 1990 Compliant Disbursement Vouchers
              </div>
              <button
                onClick={() => setIsPvModalOpen(true)}
                className="bg-[#A9814A] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Create Payment Voucher</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase text-slate-600">
                    <th className="p-3 font-bold">Voucher ID</th>
                    <th className="p-3 font-bold">Date</th>
                    <th className="p-3 font-bold">Payee / Beneficiary</th>
                    <th className="p-3 font-bold">Matter Ref</th>
                    <th className="p-3 font-bold">Description</th>
                    <th className="p-3 font-bold text-right">Amount (RM)</th>
                    <th className="p-3 font-bold text-center">Receipt</th>
                    <th className="p-3 font-bold text-center">Status</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentVouchers
                    .filter((pv) => {
                      return (
                        !searchTerm ||
                        (pv.payee && pv.payee.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        pv.fileRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        pv.id.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                    })
                    .map((pv) => {
                      const isPosted = pv.postedToGl || pv.approvalStatus === 'Posted to GL';
                      const isApproved = pv.approved || pv.approvalStatus === 'Approved' || isPosted;

                      return (
                        <tr key={pv.id} className="hover:bg-[#FAF8F2]">
                          <td className="p-3 font-mono font-bold text-amber-900">{pv.id}</td>
                          <td className="p-3 font-mono text-slate-600">{pv.date}</td>
                          <td className="p-3 font-semibold text-slate-900">{pv.payee}</td>
                          <td className="p-3 font-mono">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800">
                              {pv.fileRef || 'Firm Operations'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 max-w-xs truncate">{pv.description}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                            RM {pv.amount.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {pv.attachmentName ? (
                              <button
                                onClick={() => handleViewClaimDocuments(pv)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Paperclip className="w-3 h-3 text-amber-700" />
                                <span>Doc</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPosted ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full">
                                Posted GL
                              </span>
                            ) : isApproved ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                                Pending Partner
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => setPreviewPv(pv)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Preview / Print
                            </button>
                            <button
                              onClick={() => handleSendPvEmail(pv)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Gmail
                            </button>
                            {!isPosted && (pv.accountSet === 'CLIENT' ? isPartner : isFinance) && (
                              <button
                                onClick={() => handleApproveAndPostPv(pv)}
                                className="bg-[#16223A] text-amber-300 text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                              >
                                Approve &amp; Post
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Travel Claim Modal */}
      {isTravelModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
              <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-600" />
                Submit Travel &amp; Mileage Claim
              </h3>
              <button
                onClick={() => setIsTravelModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTravelModal} className="space-y-3 text-xs">
              {/* Searchable Claimant Dropdown */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Claimant Advocate / Staff *</label>
                <SearchableClaimantSelect
                  value={travelForm.claimant}
                  onChange={(val) => setTravelForm({ ...travelForm, claimant: val })}
                  claimants={FIRM_CLAIMANTS}
                />
              </div>

              {/* Scope & Matter Reference */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Purpose Target</label>
                  <select
                    value={travelForm.purposeType}
                    onChange={(e) => setTravelForm({ ...travelForm, purposeType: e.target.value as any })}
                    className="w-full border border-slate-300 rounded p-2 font-semibold bg-white"
                  >
                    <option value="Client Matter">Client Matter (Partner Approval)</option>
                    <option value="Firm/Internal">Firm Operational Overhead</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Matter Reference</label>
                  <SearchableMatterSelect
                    value={travelForm.fileRef}
                    onChange={(fileRef) => setTravelForm({ ...travelForm, fileRef })}
                    cases={cases}
                    clients={clients}
                    placeholder="Search by running number (e.g. LIT/2026/001) or client..."
                  />
                </div>
              </div>

              {/* Case Disbursement Budget & Approval Routing Alert */}
              {travelForm.purposeType === 'Client Matter' && travelForm.fileRef ? (
                <div className="p-3 rounded-lg border text-xs space-y-1.5 bg-amber-50/90 border-amber-300 text-amber-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-700">Case Disbursement Allocation (Office Acc): </span>
                      <strong className="font-mono text-emerald-800 text-sm">
                        RM {getCaseDisbursementBudget(travelForm.fileRef).toFixed(2)}
                      </strong>
                    </div>
                    {(travelForm.km * 1.0 + travelForm.tollAmount + travelForm.parkingAmount) <= getCaseDisbursementBudget(travelForm.fileRef) ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded text-[10px] border border-emerald-300">
                        ✓ Covered by Case Allocation
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-900 font-bold rounded text-[10px] border border-rose-300">
                        ⚠️ EXCEEDS ALLOCATION → AUTO-FLAGGED BILLABLE
                      </span>
                    )}
                  </div>

                  {(travelForm.km * 1.0 + travelForm.tollAmount + travelForm.parkingAmount) > getCaseDisbursementBudget(travelForm.fileRef) && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-900 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Validation Warning:</strong> Total claim exceeds case disbursement budget by{' '}
                        <span className="font-mono font-bold text-rose-700">
                          RM {((travelForm.km * 1.0 + travelForm.tollAmount + travelForm.parkingAmount) - getCaseDisbursementBudget(travelForm.fileRef)).toFixed(2)}
                        </span>
                        . System will automatically flag claim as <strong>Billable to Client</strong> and apply the{' '}
                        <strong className="text-amber-900">RM 1.50/km surcharge</strong> (Client Total: RM{' '}
                        {((travelForm.km * 1.5) + travelForm.tollAmount + travelForm.parkingAmount).toFixed(2)}).
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-600 flex items-center justify-between border-t border-amber-200 pt-1 mt-1">
                    <span>Approval Routing: <strong className="text-amber-900">Partner Approval Required</strong></span>
                    <span className="font-mono text-slate-500">Alert Email → syafiqahhamizad@shcolaw.com</span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg border text-xs bg-slate-50 border-slate-200 text-slate-700 flex justify-between items-center">
                  <span>Approval Routing: <strong className="text-slate-900">Finance &amp; Accounts Approval</strong></span>
                  <span className="font-mono text-slate-500 text-[10px]">Alert Email → accounts@shcolaw.com</span>
                </div>
              )}

              {/* Origin & Destination */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">From (Origin)</label>
                  <input
                    type="text"
                    placeholder="e.g. SHCO Office Bangi"
                    value={travelForm.from}
                    onChange={(e) => setTravelForm({ ...travelForm, from: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">To (Destination)</label>
                  <input
                    type="text"
                    placeholder="e.g. KL High Court / Land Office"
                    value={travelForm.to}
                    onChange={(e) => setTravelForm({ ...travelForm, to: e.target.value })}
                    className="w-full border border-slate-300 rounded p-1.5"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Travel Purpose Detail</label>
                <input
                  type="text"
                  placeholder="e.g. Attend Trial Hearing before YA Judge / Service of Cause Papers"
                  value={travelForm.purpose}
                  onChange={(e) => setTravelForm({ ...travelForm, purpose: e.target.value })}
                  className="w-full border border-slate-300 rounded p-1.5"
                  required
                />
              </div>

              {/* Itemized Distance, Tolls, Parking */}
              <div className="grid grid-cols-3 gap-2 bg-[#FAF8F2] p-3 rounded-lg border border-[#E1DCCF]">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={travelForm.km}
                    onChange={(e) => setTravelForm({ ...travelForm, km: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded p-1.5 font-mono font-bold"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">RM 1.00 / km</span>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Toll Amount (RM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={travelForm.tollAmount}
                    onChange={(e) => setTravelForm({ ...travelForm, tollAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded p-1.5 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Itemized Tolls</span>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Parking (RM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={travelForm.parkingAmount}
                    onChange={(e) => setTravelForm({ ...travelForm, parkingAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded p-1.5 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">Court / Parking</span>
                </div>
              </div>

              {/* Drag & Drop Supporting Document Upload */}
              <DragAndDropFileInput
                documents={travelForm.documents}
                attachmentName={travelForm.attachmentName}
                attachmentUrl={travelForm.attachmentUrl}
                onFileSelect={(name, url) => setTravelForm({ ...travelForm, attachmentName: name, attachmentUrl: url })}
                onDocumentsChange={(docs) => setTravelForm({
                  ...travelForm,
                  documents: docs,
                  attachmentName: docs[0]?.name || travelForm.attachmentName,
                  attachmentUrl: docs[0]?.url || travelForm.attachmentUrl,
                })}
                onClear={() => setTravelForm({ ...travelForm, attachmentName: undefined, attachmentUrl: undefined, documents: [] })}
                label="Upload Travel Receipt / Toll / Mileage Proof *"
              />

              {/* Calculated Totals */}
              <div className="p-3 bg-[#16223A] text-white rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-amber-300 font-bold uppercase">Staff Claim Total (RM1.00/km + Tolls)</div>
                  <div className="font-serif text-lg font-bold">
                    RM {((travelForm.km * 1.0) + travelForm.tollAmount + travelForm.parkingAmount).toFixed(2)}
                  </div>
                </div>

                {travelForm.purposeType === 'Client Matter' && (
                  <div className="text-right border-l border-white/20 pl-3">
                    <div className="text-[10px] text-slate-300 font-bold uppercase">Client Billable Total (@ RM1.50/km)</div>
                    <div className="font-serif text-base font-bold text-amber-400">
                      RM {((travelForm.km * 1.5) + travelForm.tollAmount + travelForm.parkingAmount).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTravelModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#16223A] text-white rounded font-bold hover:bg-[#1F2E4D] cursor-pointer"
                >
                  Submit Travel Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Expense / Disbursement Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
              <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <ReceiptIcon className="w-5 h-5 text-emerald-600" />
                Record Disbursement / Expense
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpenseModal} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Expense Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, scope: 'MATTER' })}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      expenseForm.scope === 'MATTER'
                        ? 'bg-[#16223A] text-white'
                        : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Client Disbursement
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, scope: 'FIRM' })}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      expenseForm.scope === 'FIRM'
                        ? 'bg-[#16223A] text-white'
                        : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Firm Overhead
                  </button>
                </div>
              </div>

              {/* Searchable Claimant Dropdown */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Claimant / Advocate *</label>
                <SearchableClaimantSelect
                  value={expenseForm.claimant}
                  onChange={(val) => setExpenseForm({ ...expenseForm, claimant: val })}
                  claimants={FIRM_CLAIMANTS}
                />
              </div>

              {/* Claimant Personal Money Advance Toggle */}
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <label className="font-bold text-amber-950 block mb-1">Did Claimant Advance Personal Monies?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-800">
                    <input
                      type="radio"
                      name="isAdvance"
                      checked={expenseForm.isClaimantAdvance}
                      onChange={() => setExpenseForm({ ...expenseForm, isClaimantAdvance: true })}
                      className="accent-[#16223A]"
                    />
                    <span>Yes (Staff Personal Reimbursement Claim)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-800">
                    <input
                      type="radio"
                      name="isAdvance"
                      checked={!expenseForm.isClaimantAdvance}
                      onChange={() => setExpenseForm({ ...expenseForm, isClaimantAdvance: false })}
                      className="accent-[#16223A]"
                    />
                    <span>No (Direct Firm Office Payment)</span>
                  </label>
                </div>
              </div>

              {expenseForm.scope === 'MATTER' ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Select Client Matter</label>
                  <SearchableMatterSelect
                    value={expenseForm.fileRef}
                    onChange={(fileRef, caseId) => setExpenseForm({ ...expenseForm, fileRef, caseId: caseId || '' })}
                    cases={cases}
                    clients={clients}
                    placeholder="Search by running number (e.g. LIT/2026/001) or client..."
                  />

                  {/* Case Disbursement Allocation Alert & Manager Routing */}
                  {expenseForm.fileRef && (
                    <div className="mt-2 p-3 bg-amber-50/90 rounded-lg border border-amber-300 text-[11px] space-y-1.5 text-amber-950">
                      <div className="flex justify-between items-center">
                        <span>Allocated Case Disbursement Budget (Office Acc):</span>
                        <strong className="font-mono text-emerald-800 text-xs">
                          RM {getCaseDisbursementBudget(expenseForm.fileRef).toFixed(2)}
                        </strong>
                      </div>

                      {(parseFloat(expenseForm.amount) || 0) > getCaseDisbursementBudget(expenseForm.fileRef) && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-900 flex items-start gap-1.5 text-[10px]">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Exceeds Case Allocation:</strong> Amount exceeds allocated case disbursement budget by{' '}
                            <span className="font-mono font-bold text-rose-700">
                              RM {((parseFloat(expenseForm.amount) || 0) - getCaseDisbursementBudget(expenseForm.fileRef)).toFixed(2)}
                            </span>
                            . Will be auto-flagged as <strong>Billable to Client</strong>.
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-600 flex items-center justify-between border-t border-amber-200 pt-1">
                        <span>Routing: <strong className="text-amber-900">Partner Approval Required</strong></span>
                        <span className="font-mono text-slate-500">Alert Email → syafiqahhamizad@shcolaw.com</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Firm Overhead Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 font-semibold bg-white"
                  >
                    <option value="Office Rental & Rates">Office Rental &amp; Rates</option>
                    <option value="Bar Council PII Insurance">Bar Council PII Insurance</option>
                    <option value="Utilities & Broadband">Utilities &amp; Broadband</option>
                    <option value="Legal Software Subscriptions">Legal Software Subscriptions</option>
                    <option value="Office Stationery & Printing">Office Stationery &amp; Printing</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Amount (RM) *</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 font-mono font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Description / Particulars</label>
                <input
                  type="text"
                  placeholder="e.g. High Court Search Fee / Land Registry filing"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2"
                  required
                />
              </div>

              {/* Drag & Drop Supporting Document Upload */}
              <DragAndDropFileInput
                documents={expenseForm.documents}
                attachmentName={expenseForm.attachmentName}
                attachmentUrl={expenseForm.attachmentUrl}
                onFileSelect={(name, url) => setExpenseForm({ ...expenseForm, attachmentName: name, attachmentUrl: url })}
                onDocumentsChange={(docs) => setExpenseForm({
                  ...expenseForm,
                  documents: docs,
                  attachmentName: docs[0]?.name || expenseForm.attachmentName,
                  attachmentUrl: docs[0]?.url || expenseForm.attachmentUrl,
                })}
                onClear={() => setExpenseForm({ ...expenseForm, attachmentName: undefined, attachmentUrl: undefined, documents: [] })}
                label="Upload Supporting Receipt / Voucher File *"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#16223A] text-white rounded font-bold hover:bg-[#1F2E4D] cursor-pointer"
                >
                  Save Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Payment Voucher Modal */}
      {isPvModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-3">
              <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Create Official Payment Voucher (PV)
              </h3>
              <button
                onClick={() => setIsPvModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePvModal} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Payee Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Encik Ahmad / Syarikat Percetakan / Pendaftar Mahkamah Tinggi"
                  value={pvForm.payee}
                  onChange={(e) => setPvForm({ ...pvForm, payee: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Payment Category</label>
                  <select
                    value={pvForm.voucherCategory}
                    onChange={(e) => setPvForm({ ...pvForm, voucherCategory: e.target.value as any })}
                    className="w-full border border-slate-300 rounded p-2 font-semibold bg-white"
                  >
                    <option value="Client Disb">Client Disbursement (Office Acc Allocation)</option>
                    <option value="Legal Fees Transfer">Legal Fees Transfer (Client Trust ➔ Office Acc)</option>
                    <option value="Office Operating">Office Operating Expense</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Matter Reference</label>
                  <SearchableMatterSelect
                    value={pvForm.fileRef}
                    onChange={(fileRef) => setPvForm({ ...pvForm, fileRef })}
                    cases={cases}
                    clients={clients}
                    placeholder="Search by running number (e.g. LIT/2026/001) or client..."
                  />
                </div>
              </div>

              {/* Case Disbursement Budget Check & Approval Alert for PV */}
              {pvForm.voucherCategory === 'Client Disb' && pvForm.fileRef && (
                <div className="p-3 bg-amber-50/90 rounded-lg border border-amber-300 text-[11px] space-y-1 text-amber-950">
                  <div className="flex justify-between items-center">
                    <span>Allocated Case Disbursement Budget (Office Acc):</span>
                    <strong className="font-mono text-emerald-800 text-xs">
                      RM {getCaseDisbursementBudget(pvForm.fileRef).toFixed(2)}
                    </strong>
                  </div>
                  {(parseFloat(pvForm.amount) || 0) > getCaseDisbursementBudget(pvForm.fileRef) && (
                    <div className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-900 flex items-center gap-1 text-[10px]">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Exceeds case disbursement allocation! Will require Partner review &amp; client billing.</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 flex items-center justify-between border-t border-amber-200 pt-1">
                    <span>Routing: <strong className="text-amber-900">Partner Approval Required</strong></span>
                    <span className="font-mono text-slate-500">Alert Email → syafiqahhamizad@shcolaw.com</span>
                  </div>
                </div>
              )}

              {/* Legal Fees Transfer Alert */}
              {pvForm.voucherCategory === 'Legal Fees Transfer' && pvForm.fileRef && (
                <div className="p-3 bg-blue-50/90 rounded-lg border border-blue-300 text-[11px] space-y-1 text-blue-950">
                  <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Earned Legal Fees Transfer (Client Trust Account ➔ Office Account)</span>
                  </div>
                  <p className="text-[10px] text-blue-800">
                    Transfers earned professional fees from client trust deposit to office operating account upon invoice issuance.
                  </p>
                  <div className="text-[10px] text-slate-600 flex items-center justify-between border-t border-blue-200 pt-1">
                    <span>Routing: <strong className="text-blue-900">Managing Partner Approval Required</strong></span>
                    <span className="font-mono text-slate-500">Alert Email → syafiqahhamizad@shcolaw.com</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Amount (RM) *</label>
                  <input
                    type="number"
                    value={pvForm.amount}
                    onChange={(e) => setPvForm({ ...pvForm, amount: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 font-mono font-bold text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 uppercase">Bank Ref No.</label>
                  <input
                    type="text"
                    value={pvForm.bankRef}
                    onChange={(e) => setPvForm({ ...pvForm, bankRef: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase">Particulars / Payment Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Payment for Filing Motion on Interlocutory Application"
                  value={pvForm.description}
                  onChange={(e) => setPvForm({ ...pvForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2"
                  required
                />
              </div>

              {/* Drag & Drop Supporting Document Upload */}
              <DragAndDropFileInput
                documents={pvForm.documents}
                attachmentName={pvForm.attachmentName}
                attachmentUrl={pvForm.attachmentUrl}
                onFileSelect={(name, url) => setPvForm({ ...pvForm, attachmentName: name, attachmentUrl: url })}
                onDocumentsChange={(docs) => setPvForm({
                  ...pvForm,
                  documents: docs,
                  attachmentName: docs[0]?.name || pvForm.attachmentName,
                  attachmentUrl: docs[0]?.url || pvForm.attachmentUrl,
                })}
                onClear={() => setPvForm({ ...pvForm, attachmentName: undefined, attachmentUrl: undefined, documents: [] })}
                label="Upload Official PV Invoice / Bill Document *"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPvModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#A9814A] text-white rounded font-bold hover:bg-[#8F6A38] cursor-pointer"
                >
                  Generate Payment Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT / RECEIPT ATTACHMENT VIEWER MODAL */}
      {viewingAttachment && (() => {
        const docsList = viewingAttachment.documents && viewingAttachment.documents.length
          ? viewingAttachment.documents
          : [{
              id: 'SINGLE-DOC',
              name: viewingAttachment.name,
              url: viewingAttachment.url || '',
              category: claimsStorageService.detectDocumentCategory(viewingAttachment.name),
            }];
        const activeIdx = viewingAttachment.activeDocIndex || 0;
        const currentDoc = docsList[activeIdx] || docsList[0];
        const isImg = currentDoc.url && (currentDoc.url.startsWith('data:image/') || currentDoc.type?.startsWith('image/'));

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-300 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-amber-700" />
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#16223A]">
                      Claim Supporting Documents Vault — {viewingAttachment.id}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {docsList.length} supporting file{docsList.length > 1 ? 's' : ''} attached to this claim
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingAttachment(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 text-lg cursor-pointer rounded hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* Document Selector Ribbon if multiple files */}
              {docsList.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-100">
                  {docsList.map((d, idx) => (
                    <button
                      key={d.id}
                      onClick={() => setViewingAttachment({ ...viewingAttachment, activeDocIndex: idx })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        idx === activeIdx
                          ? 'bg-[#16223A] text-amber-300 shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="truncate max-w-[130px]">{d.name}</span>
                      <span className="text-[9px] opacity-75 font-mono">({d.category || 'Doc'})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active Document Viewer */}
              <div className="bg-slate-100/90 p-4 rounded-xl text-center space-y-3 min-h-[260px] flex flex-col justify-center items-center border border-slate-200">
                {currentDoc.url && isImg ? (
                  <div className="space-y-2">
                    <img
                      src={currentDoc.url}
                      alt={currentDoc.name}
                      className="max-h-80 object-contain rounded-lg border border-slate-300 shadow-xs mx-auto"
                    />
                    <div className="text-[10px] text-slate-500 font-mono">
                      High-Resolution Image Preview • {claimsStorageService.formatFileSize(currentDoc.size || 0)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center mx-auto shadow-xs">
                      <FileText className="w-8 h-8 text-[#A9814A]" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-slate-800 text-sm">{currentDoc.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Category: <strong className="text-slate-800">{currentDoc.category || 'Supporting File'}</strong> • Size: <span className="font-mono">{claimsStorageService.formatFileSize(currentDoc.size || 0)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">
                        Document verified and archived in SHCO Claims Document Vault.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer info & actions */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded border border-amber-300">
                    {currentDoc.category || 'Receipt Document'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                    {currentDoc.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentDoc.url && (
                    <a
                      href={currentDoc.url}
                      download={currentDoc.name}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    onClick={() => setViewingAttachment(null)}
                    className="px-4 py-1.5 bg-[#16223A] text-white font-bold text-xs rounded-lg cursor-pointer hover:bg-[#1F2E4D]"
                  >
                    Close Vault
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRINT PREVIEW MODAL FOR PAYMENT VOUCHER */}
      {previewPv && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 border border-slate-300">
            <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-4">
              <div>
                <div className="font-serif text-lg font-bold text-[#16223A]">SYAFIQAH HAMIZAD &amp; CO</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Advocates &amp; Solicitors • Official Payment Voucher</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-amber-900 text-sm">{previewPv.id}</div>
                <div className="text-[10px] text-slate-500 font-mono">Date: {previewPv.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200">
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Payee:</span>
                <strong className="text-slate-900 text-sm">{previewPv.payee}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Matter Reference:</span>
                <strong className="text-slate-900 font-mono">{previewPv.fileRef || 'Firm Overhead'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Method:</span>
                <span className="text-slate-800">{previewPv.paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Bank Ref:</span>
                <span className="font-mono text-slate-800">{previewPv.bankRef || 'N/A'}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 mb-4 bg-white">
              <div className="text-slate-500 text-[10px] uppercase font-bold mb-1">Particulars</div>
              <div className="text-slate-800 font-medium mb-3">{previewPv.description}</div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-700">Total Amount Paid:</span>
                <span className="font-serif text-lg font-bold text-[#16223A]">
                  RM {previewPv.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center pt-6 border-t border-slate-200 text-xs">
              <div className="border-t border-dashed border-slate-400 pt-2">
                <div className="font-bold">{previewPv.preparedBy}</div>
                <div className="text-[10px] text-slate-500">Prepared By</div>
              </div>
              <div className="border-t border-dashed border-slate-400 pt-2">
                <div className="font-bold text-emerald-800">{previewPv.approvedBy || 'Managing Partner'}</div>
                <div className="text-[10px] text-slate-500">Approved &amp; Signed By</div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setPreviewPv(null)}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 font-bold rounded cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 bg-[#16223A] text-white font-bold rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
