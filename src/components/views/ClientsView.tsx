import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Client, KycDoc, ConflictCheck, ConflictMatch } from '../../types';
import { scanClientConflicts } from '../../lib/conflictUtils';
import {
  Users,
  Plus,
  Upload,
  Folder,
  ArrowLeft,
  FileText,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  Download,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Copy,
  X,
  UserPlus,
  Building2,
  Briefcase,
  Search,
  Filter,
  User,
  Trash2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  Info,
  Send,
  Key,
  ExternalLink,
} from 'lucide-react';
import { exportToCsv } from '../../lib/exportUtils';

export const ClientsView: React.FC = () => {
  const {
    clients,
    cases,
    addClient,
    updateClient,
    deleteClient,
    sendClientPortalInvite,
    currentRole,
    isAdmin,
    currentUser,
    setCurrentView,
    setCurrentCaseId,
    showToast,
    isRegisterClientModalOpen,
    setIsRegisterClientModalOpen,
  } = useApp();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'profile' | 'kyc' | 'cases' | 'history'>('profile');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Deletion State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [showPermissionDeniedModal, setShowPermissionDeniedModal] = useState(false);

  // Conflict Modal State
  const [conflictClient, setConflictClient] = useState<Client | null>(null);
  const [ccStatus, setCcStatus] = useState<'Clear' | 'Flagged' | 'Pending Partner Review'>('Clear');
  const [ccBy, setCcBy] = useState('Syafiqah Hamizad');
  const [ccNotes, setCcNotes] = useState('');

  const handleOpenConflictModal = (e: React.MouseEvent | null, c: Client) => {
    if (e) e.stopPropagation();
    setConflictClient(c);
    setCcStatus(c.conflictCheck?.status || 'Clear');
    setCcBy(c.conflictCheck?.checkedBy || 'Syafiqah Hamizad');
    setCcNotes(c.conflictCheck?.notes || '');
  };

  const handleSaveClientConflictCheck = () => {
    if (!conflictClient) return;
    updateClient(conflictClient.id, {
      conflictCheck: {
        status: ccStatus,
        notes: ccNotes.trim() || 'Conflict check determination saved.',
        checkedBy: ccBy,
        checkedDate: new Date().toISOString().split('T')[0],
      },
    });
    showToast(`Conflict status for "${conflictClient.name}" updated to: ${ccStatus}`);
    setConflictClient(null);
  };

  // KYC Upload Form
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [kycName, setKycName] = useState('');
  const [kycType, setKycType] = useState('Identity (NRIC/Passport)');
  const [kycFile, setKycFile] = useState<File | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const clientCases = cases.filter((cs) => {
    if (!selectedClient) return false;
    if (cs.clientId) {
      const ids = cs.clientId.split(',').map((id) => id.trim());
      if (ids.includes(selectedClient.id)) return true;
    }
    if (cs.clientsList && cs.clientsList.some((cl) => cl.id === selectedClient.id || (cl.name && selectedClient.name && cl.name.toLowerCase() === selectedClient.name.toLowerCase()))) {
      return true;
    }
    if (cs.clientName && selectedClient.name) {
      const normCsClient = cs.clientName.toLowerCase();
      const normSelClient = selectedClient.name.toLowerCase();
      if (normCsClient.includes(normSelClient) || normSelClient.includes(normCsClient)) {
        return true;
      }
    }
    return false;
  });

  const canDelete = isAdmin || currentRole === 'Partner' || currentRole === 'Admin';

  // --- Handlers ---
  const handleDeleteClick = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!canDelete) {
      setShowPermissionDeniedModal(true);
      return;
    }
    setClientToDelete(client);
  };

  const handleConfirmDelete = () => {
    if (!clientToDelete) return;
    if (!canDelete) {
      showToast('Permission Denied: Only Admins and Partners can delete client records.');
      setClientToDelete(null);
      return;
    }
    deleteClient(clientToDelete.id);
    if (selectedClientId === clientToDelete.id) {
      setSelectedClientId(null);
    }
    setClientToDelete(null);
  };

  const handleSaveKyc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !kycFile) {
      showToast('Select a KYC document before saving.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const newKyc: KycDoc = {
        id: `KYC-${Date.now()}`,
        name: kycName.trim() || kycFile.name,
        type: kycType,
        uploadedDate: new Date().toISOString().split('T')[0],
        driveFolder: `Firm Repository / Clients / ${selectedClient.id}`,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        mimeType: kycFile.type || undefined,
      };
      updateClient(selectedClient.id, { kyc: [...(selectedClient.kyc || []), newKyc] });
      setKycName('');
      setKycFile(null);
      setIsKycModalOpen(false);
      showToast(`KYC document "${newKyc.name}" saved for ${selectedClient.name}`);
    };
    reader.readAsDataURL(kycFile);
  };

  const handleExportClients = () => {
    const data = clients.map((c) => ({
      'Client ID': c.id,
      'Client Name': c.name,
      Classification: c.type,
      'Entity Category': c.entityCategory || (c.type === 'Corporate' ? 'Sdn Bhd' : 'Individual'),
      'Registration / NRIC No': c.registrationNo || c.icNo || c.icNumber || '—',
      'Tax / SST No': c.taxSstNo || '—',
      'Contact Person': c.contactPerson || c.name,
      Designation: c.contactPersonDesignation || '—',
      Phone: c.phone,
      Email: c.email,
      Tags: (c.tags || []).join(', ') || '—',
      Status: c.status || 'Active',
      Address: c.address,
      'Emergency Contact': c.emergencyContactName
        ? `${c.emergencyContactName} (${c.emergencyContactPhone})`
        : c.emergencyContact || '—',
      Notes: c.notes || '—',
    }));
    exportToCsv('SHCO_Client_Database', data);
    showToast('Exported client database to CSV / Excel!');
  };

  // --- Filtering Logic ---
  const filteredClients = clients.filter((c) => {
    // Search matching
    const search = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search) ||
      c.id.toLowerCase().includes(search) ||
      (c.registrationNo && c.registrationNo.toLowerCase().includes(search)) ||
      (c.icNo && c.icNo.toLowerCase().includes(search)) ||
      (c.icNumber && c.icNumber.toLowerCase().includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search)) ||
      (c.phone && c.phone.includes(search)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(search)) ||
      (c.tags && c.tags.some((t) => t.toLowerCase().includes(search)));

    if (!matchesSearch) return false;

    // Entity structure filter
    if (filterType !== 'All') {
      if (filterType === 'Corporate' && c.type !== 'Corporate') return false;
      if (filterType === 'Individual' && c.type !== 'Individual') return false;
      if (
        filterType !== 'Corporate' &&
        filterType !== 'Individual' &&
        c.entityCategory !== filterType
      )
        return false;
    }

    return true;
  });

  // Tag Color Helper
  const getTagBadgeStyle = (tag: string) => {
    switch (tag) {
      case 'Retainer':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Pro-bono':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Active':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'VIP':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Corporate':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'Litigation':
        return 'bg-rose-100 text-rose-900 border-rose-200';
      case 'Conveyancing':
        return 'bg-teal-100 text-teal-900 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // --- CLIENT DETAIL VIEW ---
  if (selectedClient) {
    return (
      <div className="space-y-4 text-xs">
        {/* Detail Header Bar */}
        <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedClientId(null)}
              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg border border-[#E1DCCF] transition-colors cursor-pointer"
              title="Back to Client Directory"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-base font-bold text-[#16223A]">{selectedClient.name}</h2>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold border border-blue-200">
                  {selectedClient.type}
                </span>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  ID: {selectedClient.id}
                </span>
                {(selectedClient.tags || []).map((t) => (
                  <span
                    key={t}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTagBadgeStyle(t)}`}
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Master Client Record • Registered Contact &amp; Statutory KYC Files
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                sendClientPortalInvite(selectedClient.id);
              }}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs shadow-xs"
              title="Send secure automated portal access email invitation to client"
            >
              <Send className="w-3.5 h-3.5 text-amber-300" />
              <span>Invite to Client Portal</span>
            </button>
            <button
              onClick={(e) => handleDeleteClick(e, selectedClient)}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
              title="Delete client profile"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Client</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-[#E1DCCF] space-x-2">
          <button
            onClick={() => setSubTab('profile')}
            className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${
              subTab === 'profile'
                ? 'border-[#16223A] text-[#16223A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Client Profile Particulars
          </button>
          <button
            onClick={() => setSubTab('kyc')}
            className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${
              subTab === 'kyc'
                ? 'border-[#16223A] text-[#16223A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            KYC Compliance Documents ({selectedClient.kyc?.length || 0})
          </button>
          <button
            onClick={() => setSubTab('cases')}
            className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${
              subTab === 'cases'
                ? 'border-[#16223A] text-[#16223A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Associated Cases &amp; Matters ({clientCases.length})
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${
              subTab === 'history'
                ? 'border-[#16223A] text-[#16223A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Compliance &amp; History Audit Logs
          </button>
        </div>

        {/* Subtab 1: Client Profile Details */}
        {subTab === 'profile' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            {/* Conflict Screening Status Banner */}
            <div className="p-3.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-[#A9814A] shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#16223A] uppercase text-xs">Conflict Check Status:</span>
                    {selectedClient.conflictCheck?.status === 'Flagged' ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[11px] font-bold inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                        <span>Flagged Match</span>
                      </span>
                    ) : selectedClient.conflictCheck?.status === 'Pending Partner Review' ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded text-[11px] font-bold inline-flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-700" />
                        <span>Pending Partner Review</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded text-[11px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Clear (No Conflict)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Screened by <strong className="text-[#16223A]">{selectedClient.conflictCheck?.checkedBy || 'Syafiqah Hamizad'}</strong> • {selectedClient.conflictCheck?.notes || 'No adverse matches found.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => handleOpenConflictModal(e, selectedClient)}
                className="px-3 py-1.5 bg-[#16223A] hover:bg-[#203050] text-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Review / Update Determination
              </button>
            </div>

            {/* Client Portal Access & Login Tracker Card */}
            <div className="p-4 bg-[#16223A] text-white rounded-2xl border border-[#A9814A]/40 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30">
                    <Key className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-sm text-amber-300 flex items-center gap-2">
                      <span>Secure Client Portal Access &amp; Activity Tracking</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        selectedClient.portalAccessEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {selectedClient.portalAccessEnabled ? 'Portal Active' : 'Invite Pending'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300">
                      Allows client to log into their central client portal to view matter progress, invoices, and court dates.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => sendClientPortalInvite(selectedClient.id)}
                  className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#16223A] rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5 text-[#16223A]" />
                  <span>Send Portal Email Invitation</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold">Portal Access Email</span>
                  <span className="font-bold text-slate-100">{selectedClient.email || 'No email registered'}</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold">Last Invitation Sent</span>
                  <span className="font-mono font-bold text-amber-300">
                    {selectedClient.lastPortalInviteSent ? selectedClient.lastPortalInviteSent : 'Never Invited'}
                  </span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold">Client Last Logged In</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {selectedClient.lastLoginAt ? selectedClient.lastLoginAt : 'Not logged in yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Entity Classification Banner */}
            {selectedClient.type === 'Corporate' ? (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="font-serif font-bold text-[#16223A] flex items-center gap-1.5 text-xs">
                  <Building2 className="w-4 h-4 text-[#A9814A]" />
                  <span>Corporate Particulars &amp; SSM Registration Records</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Structure Category</label>
                    <span className="font-semibold text-[#16223A]">{selectedClient.entityCategory || 'Corporate'}</span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">SSM / ROC Registration No.</label>
                    <span className="font-mono font-semibold text-[#16223A]">{selectedClient.registrationNo || '—'}</span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Corporate Tax / SST No.</label>
                    <span className="font-mono font-semibold text-[#16223A]">{selectedClient.taxSstNo || '—'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="font-serif font-bold text-[#16223A] flex items-center gap-1.5 text-xs">
                  <User className="w-4 h-4 text-blue-700" />
                  <span>Individual Client NRIC &amp; Personal Identification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">NRIC / Identification No.</label>
                    <span className="font-mono font-semibold text-[#16223A]">
                      {selectedClient.icNo || selectedClient.icNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Nationality</label>
                    <span className="font-semibold text-[#16223A]">{selectedClient.nationality || 'Malaysian'}</span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Occupation / Profession</label>
                    <span className="font-semibold text-[#16223A]">{selectedClient.occupation || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* General Particulars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Contact Person / Representative</label>
                <input
                  type="text"
                  value={selectedClient.contactPerson || ''}
                  onChange={(e) => updateClient(selectedClient.id, { contactPerson: e.target.value })}
                  className="w-full text-xs font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Designation / Role</label>
                <input
                  type="text"
                  value={selectedClient.contactPersonDesignation || ''}
                  onChange={(e) => updateClient(selectedClient.id, { contactPersonDesignation: e.target.value })}
                  placeholder="e.g. Managing Director / Individual"
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Telephone Number</label>
                <input
                  type="text"
                  value={selectedClient.phone || ''}
                  onChange={(e) => updateClient(selectedClient.id, { phone: e.target.value })}
                  className="w-full text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={selectedClient.email || ''}
                  onChange={(e) => updateClient(selectedClient.id, { email: e.target.value })}
                  className="w-full text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Registered Address / Billing Office</label>
              <textarea
                rows={2}
                value={selectedClient.address || ''}
                onChange={(e) => updateClient(selectedClient.id, { address: e.target.value })}
                className="w-full text-xs"
              />
            </div>

            {/* Emergency Contact Fields */}
            <div className="p-[#FAF8F2] p-4 border border-[#E1DCCF] rounded-xl space-y-3">
              <div className="font-bold text-[#16223A] flex items-center gap-1.5 uppercase text-[10.5px]">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Emergency &amp; Secondary Contact Point</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Contact Person Name / Next Friend</label>
                  <input
                    type="text"
                    value={selectedClient.emergencyContactName || ''}
                    onChange={(e) =>
                      updateClient(selectedClient.id, {
                        emergencyContactName: e.target.value,
                        emergencyContact: `${e.target.value} (${selectedClient.emergencyContactPhone || ''})`,
                      })
                    }
                    placeholder="Full Name"
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Telephone Number</label>
                  <input
                    type="text"
                    value={selectedClient.emergencyContactPhone || ''}
                    onChange={(e) => updateClient(selectedClient.id, { emergencyContactPhone: e.target.value })}
                    placeholder="01x-xxxxxxx / 03-xxxxxxx"
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-600 block uppercase text-[10px] mb-1">Special Client Instructions &amp; Retainer Notes</label>
              <textarea
                rows={3}
                value={selectedClient.notes || ''}
                onChange={(e) => updateClient(selectedClient.id, { notes: e.target.value })}
                className="w-full text-xs"
                placeholder="Client preferences, board resolution conditions, special billing instructions..."
              />
            </div>
          </div>
        )}

        {/* Subtab 2: KYC Documents */}
        {subTab === 'kyc' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-[#16223A]">KYC Compliance Files</h3>
                <p className="text-[11px] text-slate-500">Statutory identity documents, SSM extracts, and source of funds verification</p>
              </div>
              <button
                onClick={() => setIsKycModalOpen(true)}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload KYC Document</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-[#E1DCCF] rounded-lg overflow-hidden">
              {(selectedClient.kyc || []).map((k) => (
                <div key={k.id} className="p-3 flex items-center justify-between hover:bg-[#FAF8F2]">
                  <div className="flex items-center gap-3">
                    <Folder className="w-5 h-5 text-[#A9814A]" />
                    <div>
                      {k.dataUrl ? (
                        <a href={k.dataUrl} download={k.name} target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline hover:text-blue-950 text-xs">
                          {k.name}
                        </a>
                      ) : (
                        <p className="font-bold text-[#16223A] text-xs">{k.name}</p>
                      )}
                      <p className="text-[10px] text-slate-500">{k.type} • Uploaded: {k.uploadedDate}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded-full border border-emerald-200">
                    Verified
                  </span>
                </div>
              ))}
              {(!selectedClient.kyc || selectedClient.kyc.length === 0) && (
                <div className="p-6 text-center text-slate-400">
                  No KYC documents uploaded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtab 3: Associated Cases */}
        {subTab === 'cases' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-[#16223A]">Active &amp; Historical Legal Cases</h3>
              <button
                onClick={() => setCurrentView('cases')}
                className="px-3 py-1.5 bg-[#16223A] hover:bg-[#203050] text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-300" />
                <span>Go to Legal Matters Registry</span>
              </button>
            </div>

            <div className="space-y-2">
              {clientCases.map((cs) => (
                <div
                  key={cs.id}
                  onClick={() => {
                    setCurrentCaseId(cs.id);
                    setCurrentView('cases');
                  }}
                  className="p-3 bg-[#FAF8F2] hover:bg-[#F3EFE6] border border-[#E1DCCF] rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div>
                    <span className="font-mono font-bold text-[#A9814A] mr-2">{cs.ref}</span>
                    <span className="font-bold text-[#16223A]">{cs.title}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#16223A] text-amber-300 rounded text-[10px] font-bold">
                    {cs.status}
                  </span>
                </div>
              ))}
              {clientCases.length === 0 && (
                <p className="text-slate-400 py-4 text-center">No legal cases opened for this client yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Subtab 4: Compliance & History Audit Logs */}
        {subTab === 'history' && (
          <div className="bg-white border border-[#E1DCCF] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-serif font-bold text-[#16223A] text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                  <span>Compliance Audit Trail &amp; Record History</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Immutable registration logs, conflict check screening determinations, and KYC compliance timeline for {selectedClient.name}.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-300 text-[#16223A] font-bold text-[10.5px] rounded-lg">
                Audit Verified
              </span>
            </div>

            {/* Timeline Log Cards */}
            <div className="relative border-l-2 border-slate-200 ml-3 pl-5 space-y-5 py-2">
              {/* Event 1: Master Registration */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#16223A] border-2 border-white ring-2 ring-amber-300/60" />
                <div className="bg-[#FAF8F2] p-3.5 rounded-xl border border-[#E1DCCF] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#16223A] text-xs">Master Client Profile Registered</span>
                    <span className="text-[10px] font-mono text-slate-500">Intake Timestamp: 2026-08-18</span>
                  </div>
                  <p className="text-[11.5px] text-slate-700">
                    Client registered as <strong>{selectedClient.type} Client ({selectedClient.entityCategory || selectedClient.type})</strong>.
                  </p>
                  <div className="text-[10.5px] text-slate-500 font-mono pt-1">
                    Registered By: Puan Syafiqah Hamizad (Managing Partner) • Contact: {selectedClient.phone || 'Recorded'} • {selectedClient.email || 'Email registered'}
                  </div>
                </div>
              </div>

              {/* Event 2: Conflict Check Screening */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-300" />
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Conflict Check Screening Log</span>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold">
                      {selectedClient.conflictCheck?.status || 'Clear'}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-emerald-900">
                    {selectedClient.conflictCheck?.notes || 'Initial conflict screening executed against firm master database. No adverse cross-matches found.'}
                  </p>
                  <div className="text-[10.5px] text-emerald-800 font-mono pt-1">
                    Screened By: {selectedClient.conflictCheck?.checkedBy || 'Puan Syafiqah Hamizad'} • Date: {selectedClient.conflictCheck?.checkedDate || '2026-08-18'}
                  </div>
                </div>
              </div>

              {/* Event 3: KYC Documents Verification */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-300" />
                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-700" />
                      <span>Statutory KYC Files Uploaded &amp; Verified</span>
                    </span>
                    <span className="text-[10px] font-mono text-blue-900 font-semibold">
                      {selectedClient.kyc?.length || 0} File(s) Stored
                    </span>
                  </div>
                  {(selectedClient.kyc || []).length > 0 ? (
                    <div className="space-y-1 pt-1">
                      {selectedClient.kyc?.map((k) => (
                        <div key={k.id} className="bg-white p-2 rounded border border-blue-200 text-[11px] flex items-center justify-between">
                          {k.dataUrl ? (
                            <a
                              href={k.dataUrl}
                              download={k.name}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-blue-800 underline hover:text-blue-950"
                            >
                              {k.name}
                            </a>
                          ) : (
                            <span className="font-bold text-slate-800">{k.name}</span>
                          )}
                          <span className="text-slate-600"> ({k.type})</span>
                          <span className="text-[10px] font-mono text-slate-500">Uploaded: {k.uploadedDate}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-blue-900 italic">
                      Standard registration identity files registered in master document drive.
                    </p>
                  )}
                </div>
              </div>

              {/* Event 4: Tagging & Profile Updates */}
              <div className="relative">
                <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white ring-2 ring-amber-300" />
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 text-xs">Profile Categorization &amp; Tags</span>
                    <span className="text-[10px] font-mono text-amber-900 font-semibold">Active Tag Badges</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(selectedClient.tags || []).length > 0 ? (
                      selectedClient.tags?.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-amber-200/80 text-amber-950 text-[10.5px] font-bold rounded border border-amber-300">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-amber-900 italic">No specific tags assigned.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN CLIENTS DIRECTORY VIEW ---
  return (
    <div className="space-y-4">
      {/* Top Banner Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A9814A]" />
            Client Directory &amp; Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered corporate entity profiles (Sdn Bhd, Berhad, LLP), individual client records &amp; statutory KYC files.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportClients}
            className="border border-[#E1DCCF] hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#A9814A]" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => setIsRegisterClientModalOpen(true)}
            className="bg-[#16223A] hover:bg-[#203050] text-amber-300 font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer transition-all border border-[#16223A]"
          >
            <UserPlus className="w-4 h-4 text-amber-300" />
            <span>+ Register New Client</span>
          </button>
        </div>
      </div>

      {/* --- FILTER & GLOBAL SEARCH TOOLBAR --- */}
      <div className="bg-white border border-[#E1DCCF] p-3.5 rounded-xl shadow-2xs space-y-3 text-xs">
        {/* Global Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Client Name, Client ID, NRIC, SSM, Email, Phone, Tags..."
              className="w-full pl-9 pr-8 py-2 border border-[#E1DCCF] rounded-lg bg-white text-xs focus:ring-1 focus:ring-[#16223A] shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[11px] font-bold text-slate-500">
              Showing <strong className="text-[#16223A]">{filteredClients.length}</strong> of {clients.length} clients
            </span>
            {(searchTerm || filterType !== 'All') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('All');
                }}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row 1: Entity Classification */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-[#E1DCCF]">
          <div className="flex items-center gap-1.5 min-w-max">
            <Filter className="w-3.5 h-3.5 text-[#A9814A]" />
            <span className="font-bold text-slate-600 text-[10.5px] uppercase">Entity Structure:</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterType('All')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                filterType === 'All'
                  ? 'bg-[#16223A] text-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterType('Corporate')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'Corporate'
                  ? 'bg-[#16223A] text-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Corporate ({clients.filter((c) => c.type === 'Corporate').length})</span>
            </button>
            <button
              onClick={() => setFilterType('Sdn Bhd')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'Sdn Bhd'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Sdn Bhd
            </button>
            <button
              onClick={() => setFilterType('Berhad')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'Berhad'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Berhad
            </button>
            <button
              onClick={() => setFilterType('LLP')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'LLP'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              LLP
            </button>
            <button
              onClick={() => setFilterType('Individual')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'Individual'
                  ? 'bg-[#16223A] text-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Individual ({clients.filter((c) => c.type === 'Individual').length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- CLIENTS MASTER TABLE --- */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Client ID</th>
              <th className="p-3 font-bold">Client Name &amp; Profile Tags</th>
              <th className="p-3 font-bold">Classification / Structure</th>
              <th className="p-3 font-bold">SSM / NRIC No.</th>
              <th className="p-3 font-bold">Conflict Check</th>
              <th className="p-3 font-bold">Contact Person / Phone</th>
              <th className="p-3 font-bold">Email</th>
              <th className="p-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredClients.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className="hover:bg-[#FAF8F2] transition-colors cursor-pointer group"
              >
                <td className="p-3 font-mono font-medium text-slate-700">{c.id}</td>
                <td className="p-3">
                  <span className="font-bold text-[#16223A] block">{c.name}</span>
                  {c.type === 'Corporate' && c.contactPersonDesignation && (
                    <span className="text-[10px] text-slate-500 block">{c.contactPersonDesignation}</span>
                  )}
                  {/* Tag Badges */}
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {(c.tags || []).map((t) => (
                      <span
                        key={t}
                        className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${getTagBadgeStyle(t)}`}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.type === 'Corporate'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-[#16223A] text-white border border-[#304362]'
                      }`}
                    >
                      {c.type}
                    </span>
                    {c.entityCategory && (
                      <span className="px-1.5 py-0.5 bg-[#16223A] text-amber-300 rounded text-[9.5px] font-bold">
                        {c.entityCategory}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3 font-mono text-slate-700">
                  {c.registrationNo || c.icNo || c.icNumber || '—'}
                </td>
                <td className="p-3">
                  {c.conflictCheck?.status === 'Flagged' ? (
                    <button
                      onClick={(e) => handleOpenConflictModal(e, c)}
                      className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="Click to review conflict details"
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-700" />
                      <span>Flagged</span>
                    </button>
                  ) : c.conflictCheck?.status === 'Pending Partner Review' ? (
                    <button
                      onClick={(e) => handleOpenConflictModal(e, c)}
                      className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-200 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="Click to perform partner review"
                    >
                      <Info className="w-3 h-3 text-blue-700" />
                      <span>Pending</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleOpenConflictModal(e, c)}
                      className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-200 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      title="Click to review conflict check status"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Clear</span>
                    </button>
                  )}
                </td>
                <td className="p-3 text-slate-700">
                  <div>
                    <span className="font-semibold text-[#16223A]">
                      {c.type === 'Corporate' ? c.contactPerson || c.name : c.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">{c.phone || '—'}</span>
                  </div>
                </td>
                <td className="p-3 font-mono text-slate-700">{c.email || '—'}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientId(c.id);
                      }}
                      className="px-2.5 py-1 bg-[#16223A] hover:bg-[#203050] text-amber-300 rounded text-[11px] font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View</span>
                    </button>

                    <button
                      onClick={(e) => handleDeleteClick(e, c)}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        canDelete
                          ? 'text-rose-600 hover:bg-rose-100 hover:text-rose-800'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                      }`}
                      title={canDelete ? `Delete ${c.name}` : 'Delete action restricted to Admins/Partners'}
                    >
                      {canDelete ? <Trash2 className="w-3.5 h-3.5 text-rose-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">No client records found</p>
                    <p className="text-xs text-slate-400">
                      No client matching "{searchTerm}" or selected filters in the firm directory.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MANDATORY DELETE CONFIRMATION MODAL --- */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-[#16223A]">
                  Confirm Client Permanent Deletion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mandatory Firm Security Safeguard
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-xs space-y-2 text-rose-900">
              <p>
                Are you sure you want to permanently delete the client record for:
              </p>
              <div className="p-2 bg-white rounded border border-rose-200 font-bold text-[#16223A]">
                <p>{clientToDelete.name}</p>
                <p className="font-mono text-[11px] text-slate-500 font-normal">
                  Client ID: {clientToDelete.id} • {clientToDelete.type}
                </p>
              </div>
              <p className="text-[11px] text-rose-700">
                ⚠️ <strong>Warning:</strong> Deleting this client removes address particulars, contact points, and attached KYC documents. Registered legal matters and billing ledgers will remain in system archives.
              </p>
            </div>

            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-700" />
              <span>Authorized Operator: <strong>{currentUser?.name || currentRole}</strong> ({currentRole} Role)</span>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-lg font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel Keep Record
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete Client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PERMISSION DENIED MODAL --- */}
      {showPermissionDeniedModal && (
        <div className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-full shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-[#16223A]">
                  Permission Restricted
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Firm Administrative Access Control
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Deleting client database profiles is strictly restricted to <strong>Firm Administrators</strong> and <strong>Partners</strong>. Your current role (<strong>{currentRole}</strong>) does not have deletion privileges for client master records.
            </p>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPermissionDeniedModal(false)}
                className="px-4 py-2 bg-[#16223A] text-amber-300 rounded-lg font-bold text-xs cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- KYC UPLOAD MODAL --- */}
      {isKycModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-base font-bold text-[#16223A] mb-3">Upload KYC Compliance Document</h3>
            <form onSubmit={handleSaveKyc} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Document File</label>
                <input
                  type="file"
                  required
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setKycFile(file);
                    if (file && !kycName) setKycName(file.name);
                  }}
                  className="w-full"
                />
                <p className="text-[10px] text-slate-500 mt-1">Saved in this browser's local storage for this practice workspace.</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Document Name / Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NRIC Copy - Datuk Dr. Robert Wong"
                  value={kycName}
                  onChange={(e) => setKycName(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">KYC Category</label>
                <select value={kycType} onChange={(e) => setKycType(e.target.value)} className="w-full">
                  <option value="Identity (NRIC/Passport)">Identity (NRIC/Passport)</option>
                  <option value="SSM Corporate ROC Extract">SSM Corporate ROC Extract</option>
                  <option value="Proof of Address (Utility Bill)">Proof of Address (Utility Bill)</option>
                  <option value="Source of Funds Declaration">Source of Funds Declaration</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Review Modal (Leads Concept) */}
      {conflictClient && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-serif text-base font-bold text-[#16223A]">
                Conflict of Interest Check — {conflictClient.name}
              </h3>
              <button
                type="button"
                onClick={() => setConflictClient(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Formal partner determination under Legal Profession Act 1976 and Bar Council Guidelines.
            </p>

            {/* Display live conflict matches */}
            {scanClientConflicts(
              { id: conflictClient.id, name: conflictClient.name, icNo: conflictClient.icNo, registrationNo: conflictClient.registrationNo, email: conflictClient.email },
              clients,
              cases
            ).length > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-[11.5px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Cross-Registry Matches Flagged ({scanClientConflicts({ id: conflictClient.id, name: conflictClient.name, icNo: conflictClient.icNo, registrationNo: conflictClient.registrationNo, email: conflictClient.email }, clients, cases).length}):</span>
                </span>
                <ul className="list-disc list-inside font-mono text-[11px] space-y-0.5 pt-1">
                  {scanClientConflicts(
                    { id: conflictClient.id, name: conflictClient.name, icNo: conflictClient.icNo, registrationNo: conflictClient.registrationNo, email: conflictClient.email },
                    clients,
                    cases
                  ).map((m, i) => (
                    <li key={i}><strong>{m.label}:</strong> {m.detail}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No adverse party or registered client matches found.</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                  Conflict Determination
                </label>
                <select
                  value={ccStatus}
                  onChange={(e) => setCcStatus(e.target.value as any)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-[#16223A]"
                >
                  <option value="Clear">Clear (No conflict of interest)</option>
                  <option value="Flagged">Flagged (Direct / Potential Conflict)</option>
                  <option value="Pending Partner Review">Pending Partner Review</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                  Reviewed By Partner
                </label>
                <select
                  value={ccBy}
                  onChange={(e) => setCcBy(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold text-[#16223A]"
                >
                  <option value="Syafiqah Hamizad">Syafiqah Hamizad (SH)</option>
                  <option value="Amer Haiqal">Amer Haiqal (AH)</option>
                  <option value="Zulaikha Afendi">Zulaikha Afendi (ZA)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase text-[10.5px] mb-1">
                  Partner Review Notes
                </label>
                <textarea
                  rows={3}
                  value={ccNotes}
                  onChange={(e) => setCcNotes(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  placeholder="Record conflict search checks, IC cross-checks, and partner reasoning..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConflictClient(null)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClientConflictCheck}
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 rounded-md font-bold text-xs cursor-pointer shadow-sm"
                >
                  Save Determination
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
