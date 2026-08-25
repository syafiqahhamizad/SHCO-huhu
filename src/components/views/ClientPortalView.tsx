import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  FileText,
  Clock,
  Download,
  Eye,
  Send,
  Lock,
  PhoneCall,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Receipt,
  User,
  Building2,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { DocPreviewModal } from '../modals/DocPreviewModal';

export const ClientPortalView: React.FC = () => {
  const { clients, cases, invoices, payments, retainers, showToast, currentUser, currentRole } = useApp();

  // Selected client ID for client portal access mode
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || 'HQ-C001');
  const [activeTab, setActiveTab] = useState<'matters' | 'status' | 'documents' | 'financials'>('matters');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('ALL');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [docPreviewId, setDocPreviewId] = useState<string | null>(null);

  // State for expanded chronology/activity log per case
  const [expandedChronologyCaseId, setExpandedChronologyCaseId] = useState<string | null>(null);

  // Helper to determine stage percentage, current active milestone, and plain-English explanation
  const getStageDetails = (stageStr: string = '') => {
    const stageLower = stageStr.toLowerCase();
    if (
      stageLower.includes('closed') ||
      stageLower.includes('decree') ||
      stageLower.includes('judgment') ||
      stageLower.includes('execution') ||
      stageLower.includes('completed')
    ) {
      return {
        percent: 100,
        stepIndex: 5,
        stageName: 'Judgement & Decree / Closed',
        description:
          'Judgement or Final Decree issued by the Court. Implementation, cost settlements, or enforcement proceedings in progress.',
        nextStepText: 'Matter fully resolved. File undergoing closing audit and SAR 1990 archiving.',
        actionRequired: false,
      };
    }
    if (
      stageLower.includes('trial') ||
      stageLower.includes('hearing') ||
      stageLower.includes('submissions') ||
      stageLower.includes('decision')
    ) {
      return {
        percent: 80,
        stepIndex: 4,
        stageName: 'Trial & Main Hearing Phase',
        description:
          'Active Trial or Main Hearing stage before the Judge/Registrar. Advocates presenting oral arguments, witness examinations, and written submissions.',
        nextStepText: 'Awaiting formal Court Decision or Judgment date.',
        actionRequired: false,
      };
    }
    if (
      stageLower.includes('pre-trial') ||
      stageLower.includes('ptcm') ||
      stageLower.includes('discovery') ||
      stageLower.includes('application') ||
      stageLower.includes('interlocutory')
    ) {
      return {
        percent: 60,
        stepIndex: 3,
        stageName: 'Pre-Trial Proceedings & Discovery',
        description:
          'Pre-Trial Case Management (PTCM) and Interlocutory Discovery. Exchanging witness statements, agreed bundle of documents, and pre-trial issues.',
        nextStepText: 'Fixing of Trial dates and pre-trial clarification before the Judge.',
        actionRequired: true,
      };
    }
    if (
      stageLower.includes('pleading') ||
      stageLower.includes('filing') ||
      stageLower.includes('cause paper') ||
      stageLower.includes('summons') ||
      stageLower.includes('claim')
    ) {
      return {
        percent: 40,
        stepIndex: 2,
        stageName: 'Pleadings & Document Exchange',
        description:
          'Court papers (Statement of Claim, Defence, Counterclaim, Reply) are being drafted, verified, and served on opposing parties.',
        nextStepText: 'Closure of pleadings followed by Pre-Trial Case Management direction.',
        actionRequired: true,
      };
    }
    return {
      percent: 20,
      stepIndex: 1,
      stageName: 'File Intake & Conflict Check',
      description:
        'File opened, conflict check cleared, retainer confirmed, and initial fact-gathering and legal research underway.',
      nextStepText: 'Finalising Cause Papers / Writ / Summons for filing at Court.',
      actionRequired: false,
    };
  };

  const getDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  // Inquiry Modal state
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState<boolean>(false);
  const [inquirySubject, setInquirySubject] = useState<string>('Request Status Update on Matter');
  const [inquiryMessage, setInquiryMessage] = useState<string>('');

  const loggedInClient =
    currentUser.role === 'Client' || currentRole === 'Client'
      ? clients.find(
          (c) =>
            c.email.toLowerCase() === (currentUser.email || '').toLowerCase() ||
            c.id === currentUser.id ||
            c.name.toLowerCase().includes((currentUser.name || '').toLowerCase())
        )
      : null;

  const currentClient = loggedInClient || clients.find((c) => c.id === selectedClientId) || clients[0];

  // Cases for this client
  const clientCases = cases.filter(
    (cs) => cs.clientId === currentClient?.id || (cs.clientName || '').toLowerCase().includes((currentClient?.name || '').toLowerCase())
  );

  // Financials for this client
  const clientInvoices = invoices.filter((inv) => inv.clientId === currentClient?.id);
  const totalBilled = clientInvoices.reduce((sum, inv) => sum + (inv.total || inv.amount || 0), 0);

  const clientPayments = payments.filter((p) => clientInvoices.some((inv) => inv.id === p.invoiceId));
  const totalPaid = clientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalOutstanding = Math.max(0, totalBilled - totalPaid);

  const clientRetainers = retainers.filter((r) => r.clientId === currentClient?.id);
  const trustBalance = clientRetainers.reduce((sum, r) => {
    if (r.type === 'Deposit') return sum + r.amount;
    if (r.type === 'Apply' || r.type === 'Refund') return sum - r.amount;
    return sum;
  }, 0);

  // Shared documents from all client cases
  const allSharedDocuments = clientCases.flatMap((cs) => {
    const docs = cs.documents || [];
    return docs.map((doc) => ({
      ...doc,
      caseRef: cs.ref,
      caseTitle: cs.title,
    }));
  });

  const filteredDocuments = allSharedDocuments.filter((doc) => {
    const docCat = (doc.category || '').toLowerCase();
    const docCatFilter = (docCategoryFilter || '').toLowerCase();
    const matchesCategory =
      docCategoryFilter === 'ALL' ||
      docCat.includes(docCatFilter);
    const searchQuery = (docSearchQuery || '').toLowerCase();
    const docName = (doc.name || '').toLowerCase();
    const docRef = (doc.caseRef || '').toLowerCase();
    const matchesQuery =
      !docSearchQuery ||
      docName.includes(searchQuery) ||
      docRef.includes(searchQuery);
    return matchesCategory && matchesQuery;
  });

  const handleDownloadDoc = (docName: string, caseRef: string) => {
    const fileContent = `========================================================\nSYAFIQAH HAMIZAD & CO ADVOCATES & SOLICITORS\nCLIENT PORTAL SHARED DOCUMENT\n========================================================\nDocument Name: ${docName}\nMatter Ref: ${caseRef}\nClient: ${currentClient?.name}\nDate Exported: ${new Date().toLocaleDateString('en-MY')}\n========================================================\nThis document is issued under Advocate-Client Privilege (Section 126 Evidence Act 1950).\n`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docName.replace(/\s+/g, '_')}_${caseRef.replace(/\//g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded shared document [${docName}] for matter ${caseRef}`);
  };

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setIsInquiryModalOpen(false);
    setInquiryMessage('');
    showToast(`Inquiry sent to Assigned Lawyer for ${currentClient?.name}!`);
  };

  return (
    <div className="space-y-6 text-xs pb-10">
      {/* Client Mode Control Bar */}
      <div className="bg-[#16223A] text-white p-4 rounded-xl shadow-md border border-[#A9814A]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-400 text-[#16223A] font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Read-Only Client Access Mode
            </span>
            <span className="text-[10px] text-amber-200/80 font-mono">
              Sec 126 Evidence Act 1950 Confidentiality
            </span>
          </div>
          <h2 className="font-serif text-xl font-bold text-white flex items-center gap-2">
            Client Portal — {currentClient?.name}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Transparent real-time matter tracking, shared case files, and privileged client statements.
          </p>
        </div>

        {/* Designated Client Switcher Dropdown */}
        <div className="bg-white/10 p-2.5 rounded-lg border border-white/20 w-full md:w-auto shrink-0">
          <label className="text-[10px] uppercase font-bold text-amber-300 block mb-1">
            Select Designated Client Account:
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => {
              setSelectedClientId(e.target.value);
              showToast(`Switched client portal view to ${clients.find((c) => c.id === e.target.value)?.name}`);
            }}
            className="w-full md:w-64 bg-slate-900 text-white font-bold text-xs p-1.5 rounded border border-amber-400/50 focus:outline-none"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Overview Header Card */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1 md:col-span-1 border-r border-slate-100 pr-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Identity</div>
          <div className="font-bold text-[#16223A] text-sm flex items-center gap-1.5">
            {currentClient?.type === 'Corporate' ? (
              <Building2 className="w-4 h-4 text-[#A9814A]" />
            ) : (
              <User className="w-4 h-4 text-[#A9814A]" />
            )}
            <span>{currentClient?.name}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">ID: {currentClient?.id}</div>
          <div className="text-[11px] text-slate-600 mt-1">
            📞 {currentClient?.phone} | ✉️ {currentClient?.email}
          </div>
        </div>

        <div className="space-y-1 md:col-span-1 border-r border-slate-100 pr-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Legal Matters</div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{clientCases.length}</div>
          <div className="text-[11px] text-slate-500">
            {clientCases.map((c) => c.ref).join(', ') || 'No active matters'}
          </div>
        </div>

        <div className="space-y-1 md:col-span-1 border-r border-slate-100 pr-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shared Documents</div>
          <div className="font-serif text-2xl font-bold text-[#16223A]">{allSharedDocuments.length}</div>
          <div className="text-[11px] text-emerald-800 font-semibold">Available for One-Click Download</div>
        </div>

        <div className="space-y-1 md:col-span-1 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Firm Support &amp; Inquiry</div>
            <div className="text-[11px] font-bold text-[#16223A] mt-0.5">Messrs Syafiqah Hamizad &amp; Co</div>
            <div className="text-[10.5px] text-slate-500">Assigned Partner: Syafiqah Hamizad</div>
          </div>
          <button
            type="button"
            onClick={() => setIsInquiryModalOpen(true)}
            className="w-full bg-[#2F6F4E] hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs mt-2"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Request Status Update</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E1DCCF] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('matters')}
          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'matters'
              ? 'bg-[#16223A] text-white shadow-xs'
              : 'bg-white border border-[#E1DCCF] text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <span>My Active Matters ({clientCases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'status'
              ? 'bg-[#16223A] text-white shadow-xs'
              : 'bg-white border border-[#E1DCCF] text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4 text-amber-400" />
          <span>Case Status Log</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-[#16223A] text-white shadow-xs'
              : 'bg-white border border-[#E1DCCF] text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          <span>Shared Case Documents ({allSharedDocuments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financials')}
          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'financials'
              ? 'bg-[#16223A] text-white shadow-xs'
              : 'bg-white border border-[#E1DCCF] text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-4 h-4 text-amber-400" />
          <span>Financial Statements &amp; Receipts</span>
        </button>
      </div>

      {/* ================= TAB 1: MY ACTIVE MATTERS ================= */}
      {activeTab === 'matters' && (
        <div className="space-y-5">
          {clientCases.length === 0 ? (
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-8 text-center text-slate-500">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No active legal matters found for this client account.</p>
              <p className="text-xs text-slate-500 mt-1">
                Please contact Messrs Syafiqah Hamizad &amp; Co to link your matter files.
              </p>
            </div>
          ) : (
            clientCases.map((cs) => {
              const assignedLawyers = cs.lawyerInCharge
                ? cs.lawyerInCharge.split(',').map((s) => s.trim())
                : ['Syafiqah Hamizad'];

              const stageDetails = getStageDetails(cs.stage);
              const daysToHearing = getDaysRemaining(cs.nextHearing);
              const isChronologyExpanded = expandedChronologyCaseId === cs.id;

              // Combined chronological activity log
              const activityHistory = [
                ...(cs.courtDiary || []).map((cd) => ({
                  type: 'Court Appearance',
                  date: cd.date,
                  title: `Court Session: ${cd.matter || 'Case Management'}`,
                  detail: cd.caseStatus || cd.courtDirections || cd.instructions,
                  badge: 'Court Diary',
                })),
                ...(cs.hearings || []).map((h) => ({
                  type: 'Hearing',
                  date: h.date,
                  title: `Hearing Purpose: ${h.purpose}`,
                  detail: h.outcome ? `Outcome: ${h.outcome}` : `Scheduled at ${h.time}`,
                  badge: h.status,
                })),
                ...(cs.documents || []).map((d) => ({
                  type: 'Document Filed',
                  date: d.uploadedDate,
                  title: `Document Shared: ${d.name}`,
                  detail: `Folder: ${d.category}`,
                  badge: 'Document',
                })),
                ...(cs.meetingNotes || []).map((m) => ({
                  type: 'Client Consultation',
                  date: m.date,
                  title: `Meeting Note`,
                  detail: m.decisions || m.meetingNotes,
                  badge: 'Consultation',
                })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <div key={cs.id} className="bg-white border border-[#E1DCCF] rounded-xl shadow-sm overflow-hidden">
                  {/* Case Card Header */}
                  <div className="bg-[#16223A] text-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-400 text-[#16223A] font-mono font-extrabold text-xs px-2.5 py-0.5 rounded shadow-2xs">
                          {cs.ref}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase">
                          {cs.type}
                        </span>
                        <span className="text-[10px] bg-emerald-900 text-emerald-200 font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                          <span>Stage: {stageDetails.stageName}</span>
                        </span>
                      </div>
                      <h3 className="font-serif text-xl font-bold text-white mt-1">{cs.title}</h3>
                      <p className="text-xs text-slate-300 flex items-center gap-2">
                        <span>Court Branch: <strong>{cs.court}</strong></span>
                        <span>•</span>
                        <span>Client Role: <strong className="text-amber-200">{cs.clientRole || 'Plaintiff / Applicant'}</strong></span>
                      </p>
                    </div>

                    {/* Next Hearing Countdown Banner */}
                    {cs.nextHearing ? (
                      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 border border-rose-500/50 p-3 rounded-xl text-rose-100 flex items-center gap-3 shrink-0 shadow-sm">
                        <Calendar className="w-5 h-5 text-rose-300 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase font-extrabold text-rose-300 tracking-wider">Next Court Appearance</span>
                            {daysToHearing !== null && (
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${daysToHearing <= 3 ? 'bg-rose-500 text-white animate-bounce' : 'bg-rose-900/80 text-rose-200'}`}>
                                {daysToHearing === 0 ? 'TODAY' : daysToHearing > 0 ? `In ${daysToHearing} Days` : 'Past Date'}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-sm text-white">{cs.nextHearing}</div>
                          <div className="text-[10px] text-rose-200/90 font-medium mt-0.5">
                            Attendance: <span className="font-bold text-amber-300">Not Compulsory for Client</span> (Advocates Attending)
                          </div>
                        </div>
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                            `Court Hearing: ${cs.title} [${cs.ref}]`
                          )}&dates=${cs.nextHearing.replace(/-/g, '')}T090000Z/${cs.nextHearing.replace(
                            /-/g,
                            ''
                          )}T110000Z&details=${encodeURIComponent(`Court: ${cs.court}\nRef: ${cs.ref}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <span>📅 Add Calendar</span>
                        </a>
                      </div>
                    ) : (
                      <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-lg text-slate-300 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Next Court Event</span>
                        <span className="font-semibold text-slate-200">Awaiting Court Case Management Fix Date</span>
                      </div>
                    )}
                  </div>

                  {/* Simple Progress Summary */}
                  <div className="bg-slate-900 text-white p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                          Step {stageDetails.stepIndex} of 5: {stageDetails.stageName}
                        </span>
                      </div>
                      <span className="text-sm font-extrabold font-mono text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-500/40">
                        {stageDetails.percent}% Complete
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${stageDetails.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Plain-Language Explanation of Current Stage */}
                  <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                        <span>Current Phase Focus: <strong>{stageDetails.stageName}</strong></span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-sans">
                        {stageDetails.description}
                      </p>
                      <div className="text-[11px] text-amber-900 font-semibold pt-1 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                        <span><strong>Next Expected Milestone:</strong> {stageDetails.nextStepText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Case Content Details Grid */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Column 1: Latest Status Note & Action Items */}
                    <div className="md:col-span-2 space-y-4">
                      {/* Live Status Note from Advocates */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-[#A9814A]" />
                          <span>Latest Progress Memorandum from Lawyer in Charge:</span>
                        </span>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs text-slate-800 leading-relaxed shadow-2xs">
                          {cs.notes ||
                            'Pleadings are successfully closed. Our legal team is currently preparing the Bundle of Documents and Witness Statements for your review and endorsement before the upcoming Pre-Trial Case Management.'}
                        </div>
                      </div>

                      {/* Client Action Items / Document Endorsement Needed */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6F4E]" />
                          <span>Pending Action Items &amp; Client Tasks:</span>
                        </span>
                        <div className="space-y-1.5">
                          {(cs.tasks || []).length === 0 ? (
                            <div className="p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-xl text-emerald-900 text-xs flex items-center gap-2 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>No action required from client at this moment. Law firm is actively handling court filings.</span>
                            </div>
                          ) : (
                            (cs.tasks || []).map((t) => (
                              <div
                                key={t.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                  t.status === 'Completed'
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      t.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                    }`}
                                  />
                                  <div>
                                    <span
                                      className={`font-bold text-xs block ${
                                        t.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900'
                                      }`}
                                    >
                                      {t.title}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Assigned To: {t.assignedTo} | Status: {t.status}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10.5px] font-mono font-bold text-slate-600 shrink-0 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  Due: {t.dueDate}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Expandable Case Chronology & Activity Feed */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedChronologyCaseId(isChronologyExpanded ? null : cs.id)}
                          className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#A9814A]" />
                            <span>View Detailed Case Chronology &amp; Court Activity Feed ({activityHistory.length} Updates)</span>
                          </div>
                          {isChronologyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isChronologyExpanded && (
                          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-fadeIn">
                            <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              📜 Historical Court Updates &amp; Matter Timeline:
                            </div>
                            {activityHistory.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No historical court records logged yet.</p>
                            ) : (
                              <div className="relative border-l-2 border-slate-300 ml-3 pl-4 space-y-3">
                                {activityHistory.map((act, aIdx) => (
                                  <div key={aIdx} className="relative group">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#16223A] border-2 border-white" />
                                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-xs text-[#16223A]">{act.title}</span>
                                        <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                          {act.date}
                                        </span>
                                      </div>
                                      <p className="text-[11.5px] text-slate-700 leading-snug">{act.detail}</p>
                                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded">
                                        {act.badge}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Assigned Legal Team & Quick Matter Documents */}
                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 h-fit">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          👨‍⚖️ Designated Advocates In Charge:
                        </span>
                        <div className="space-y-2">
                          {assignedLawyers.map((lawyer, lIdx) => (
                            <div
                              key={lIdx}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#16223A] text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-400/40">
                                  {lawyer.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-[#16223A] block">{lawyer}</span>
                                  <span className="text-[10px] text-slate-500">Messrs Syafiqah Hamizad &amp; Co</span>
                                </div>
                              </div>
                              <span className="text-[9.5px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Advocate
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          📁 Shared Court Documents:
                        </span>
                        <div className="space-y-1.5">
                          {(cs.documents || []).length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No shared documents uploaded yet.</p>
                          ) : (
                            (cs.documents || []).slice(0, 4).map((d) => (
                              <div
                                key={d.id}
                                className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-3.5 h-3.5 text-[#A9814A] shrink-0" />
                                  <span className="truncate font-semibold text-[11px] text-slate-800">{d.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(d.name, cs.ref)}
                                  className="text-emerald-800 hover:text-emerald-900 font-bold text-[10px] flex items-center gap-0.5 shrink-0 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Get</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('documents');
                            setDocSearchQuery(cs.ref);
                          }}
                          className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-300 text-[#16223A] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                          <span>Open All Shared Documents</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= TAB: CASE STATUS LOG ================= */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {clientCases.length === 0 ? (
            <div className="bg-white border border-[#E1DCCF] rounded-xl p-8 text-center text-slate-500">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">No matter status logs available yet.</p>
            </div>
          ) : (
            clientCases.map((cs) => {
              const statusLogs = (cs.activityLogs || [])
                .filter((log) => log.type === 'Status Update')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

              return (
                <div key={cs.id} className="bg-white border border-[#E1DCCF] rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="bg-amber-100 text-[#16223A] font-mono font-extrabold text-xs px-2.5 py-0.5 rounded">
                      {cs.ref}
                    </span>
                    <span className="font-serif font-bold text-[#16223A]">{cs.title}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Current Status</span>
                    <p className="text-xs text-slate-800 leading-relaxed">{cs.notes || 'No status update recorded yet.'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">What Happens Next</span>
                    <p className="text-xs text-slate-800 leading-relaxed">{cs.nextAction || 'No next action recorded yet.'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Past Updates</span>
                    {statusLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No status updates logged yet.</p>
                    ) : (
                      <ul className="text-xs text-slate-700 space-y-1.5">
                        {statusLogs.map((log) => (
                          <li key={log.id} className="flex justify-between gap-3 border-b border-slate-50 pb-1.5">
                            <span>{log.description}</span>
                            <span className="text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= TAB 2: SHARED DOCUMENTS REPOSITORY ================= */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#A9814A]" />
                  Shared Document Vault — One-Click Download
                </h3>
                <p className="text-xs text-slate-500">
                  Access court pleadings, affidavits, orders, and official notices shared directly by your legal team.
                </p>
              </div>

              {/* Document Search */}
              <input
                type="text"
                placeholder="Search shared files..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="w-full sm:w-60 text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#A9814A]"
              />
            </div>

            {/* Folder Filters */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {['ALL', 'Cause Papers', 'Orders', 'Correspondence', 'Billing'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDocCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    docCategoryFilter === cat
                      ? 'bg-[#16223A] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? '📂 All Files' : `📁 ${cat}`}
                </button>
              ))}
            </div>
          </div>

          {/* Document Table */}
          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#16223A] text-white uppercase text-[10.5px] font-bold tracking-wider">
                  <th className="p-3">Document Name</th>
                  <th className="p-3">Category Folder</th>
                  <th className="p-3">Matter Ref</th>
                  <th className="p-3">Date Shared</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No shared documents found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-3 font-bold text-[#16223A] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#A9814A] shrink-0" />
                        <span>{doc.name}</span>
                      </td>
                      <td className="p-3 font-semibold text-slate-600">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-[10.5px]">
                          {doc.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-900">{doc.caseRef}</td>
                      <td className="p-3 font-mono text-slate-500">{doc.uploadedDate}</td>
                      <td className="p-3 text-center flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDocPreviewId(doc.id || 'DOC-PREVIEW')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[10.5px] flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-600" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc.name, doc.caseRef)}
                          className="px-2.5 py-1 bg-[#2F6F4E] hover:bg-emerald-800 text-white font-bold rounded text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: FINANCIAL STATEMENTS & RECEIPTS ================= */}
      {activeTab === 'financials' && (
        <div className="space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Billed Fees</div>
              <div className="font-serif text-2xl font-bold text-[#16223A] mt-1">
                RM {totalBilled.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">Across {clientInvoices.length} Tax Invoices</div>
            </div>

            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount Paid</div>
              <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">
                RM {totalPaid.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10.5px] text-emerald-700 mt-0.5">Official Receipts Issued</div>
            </div>

            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Balance Due</div>
              <div
                className={`font-serif text-2xl font-bold mt-1 ${
                  totalOutstanding > 0 ? 'text-rose-800' : 'text-slate-700'
                }`}
              >
                RM {totalOutstanding.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5">
                {totalOutstanding > 0 ? 'Outstanding Tax Invoices' : 'Fully Settled'}
              </div>
            </div>

            <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Client Trust Balance (SAR 1990)
              </div>
              <div className="font-serif text-2xl font-bold text-[#A9814A] mt-1">
                RM {trustBalance.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10.5px] text-amber-900 mt-0.5">Held in Client Trust Account</div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
            <div className="bg-[#16223A] text-white p-3 font-serif font-bold text-sm flex items-center justify-between">
              <span>Tax Invoices Billed to {currentClient?.name}</span>
              <span className="text-xs font-sans font-normal text-slate-300">
                Official Bill of Costs &amp; Disbursements
              </span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3 text-right">Amount (RM)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No tax invoices billed to this client account yet.
                    </td>
                  </tr>
                ) : (
                  clientInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-[#16223A]">{inv.id}</td>
                      <td className="p-3 font-mono text-slate-600">{inv.date}</td>
                      <td className="p-3 font-mono text-slate-600">{inv.dueDate}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                        RM {(inv.total || inv.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDocPreviewId(inv.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[10.5px] cursor-pointer"
                        >
                          Preview Statement
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doc Preview Modal */}
      {docPreviewId && (
        <DocPreviewModal type="invoice" docId={docPreviewId} onClose={() => setDocPreviewId(null)} />
      )}

      {/* Lawyer Inquiry Modal */}
      {isInquiryModalOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E1DCCF]">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#A9814A]" />
              Request Status Update from Assigned Lawyers
            </h3>
            <form onSubmit={handleSendInquiry} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={inquirySubject}
                  onChange={(e) => setInquirySubject(e.target.value)}
                  className="w-full font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Your Message / Request</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Kindly provide an update regarding the hearing date for our interlocutory application..."
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px]">
                🔒 <strong>Advocate-Client Privilege:</strong> Your message is transmitted directly to Messrs Syafiqah Hamizad &amp; Co advocates in charge.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInquiryModalOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>Send Request to Lawyer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
