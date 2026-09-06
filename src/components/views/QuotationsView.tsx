import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, QuotationLineItem, Invoice, Receipt as ReceiptRecord } from '../../types';
import { calculateSroTransferFee } from '../../lib/sroCalculator';
import { computeTotals } from '../../lib/billingEngine';
import { DocPreviewModal } from '../modals/DocPreviewModal';
import { getPracticeSettings } from '../../services/templateService';
import { FileText, Plus, Calculator, Search, ArrowRight, Eye, CheckCircle2, CalendarDays, Video, Receipt, Upload, Send, Save, X, Mail, MessageSquare, ExternalLink, ChevronRight } from 'lucide-react';
import { LineItemsEditor } from '../LineItemsEditor';

export const QuotationsView: React.FC = () => {
  const { quotations, clients, leads, quoteTemplates, invoices, receipts, addQuotation, updateQuotation, addInvoice, currentPartnerCode, currentUser, addClientPortalUpdate, showToast, setCurrentView } = useApp();

  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'quotations' | 'proforma' | 'invoices' | 'receipts'>('quotations');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [consultationMode, setConsultationMode] = useState<'Invoice' | 'Proforma'>('Invoice');
  const [consultationDate, setConsultationDate] = useState(new Date().toISOString().slice(0, 10));
  const [consultationType, setConsultationType] = useState<Quotation['consultationType']>('Initial Consultation');
  const [consultationDuration, setConsultationDuration] = useState(60);
  const [consultationFee, setConsultationFee] = useState(500);
  const [consultationDescription, setConsultationDescription] = useState('Professional consultation fee');

  // Quote Form
  const [clientName, setClientName] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [partyType, setPartyType] = useState<'Client' | 'Prospect'>('Client');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [practiceArea, setPracticeArea] = useState(() => getPracticeSettings().practiceAreas?.[0]?.name || 'Conveyancing');
  const [propertyPrice, setPropertyPrice] = useState<number>(650000);
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);

  const [courtLevel, setCourtLevel] = useState('Sessions Court');
  const [stage, setStage] = useState('Full Trial');

  // Manual line items for non-conveyancing
  const [manualDesc, setManualDesc] = useState('Professional Advisory Fee');
  const [manualAmount, setManualAmount] = useState<number>(5000);
  const [quoteLineItems, setQuoteLineItems] = useState<QuotationLineItem[]>([]);
  const [formatMode, setFormatMode] = useState<'Standard' | 'General'>('Standard');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Payment due within 30 days of invoice date');
  const practiceAreas = getPracticeSettings().practiceAreas || [];
  const isConveyancing = practiceArea.toLowerCase().includes('convey');
  const isLitigation = practiceArea.toLowerCase().includes('litigation') || practiceArea.toLowerCase().includes('dispute');

  // Computed SRO Fee
  const sroResult = calculateSroTransferFee(propertyPrice, isDiscounted, discountPct);

  const defaultQuoteLineItems = (): QuotationLineItem[] => {
    const defaultBillingItems = getPracticeSettings().defaultBillingItems || [];
    const defaultRecoverableItems: QuotationLineItem[] = defaultBillingItems.map((item) => ({
      description: item.description,
      category: item.category as QuotationLineItem['category'],
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      chargeType: item.chargeType,
      amount: item.chargeType === 'Fixed' ? item.unitPrice : item.quantity * item.unitPrice,
    }));
    const withDefaults = (items: QuotationLineItem[]) => [...items, ...defaultRecoverableItems];
    if (isConveyancing) return ([
      { description: `Professional Fee — SRO 2023 Scale (Property Value: RM ${propertyPrice.toLocaleString()})`, category: 'Fee - SRO', amount: sroResult.scaleFee },
      { description: 'SST Service Tax (8%)', category: 'Fee - SRO', amount: sroResult.sstAmount },
      { description: 'Estimated Stamp Duty (Memorandum of Transfer)', category: 'Disbursement', amount: sroResult.stampDutyEstimate },
      { description: 'Title Search & Land Registry Registration Fees', category: 'Disbursement', amount: 300 },
    ] as QuotationLineItem[]).concat(defaultRecoverableItems);
    if (isLitigation) {
      const templateItems = quoteTemplates.filter((t) => t.practiceArea === practiceArea && t.courtLevel === courtLevel && t.stage === stage);
      return withDefaults(templateItems.length > 0 ? templateItems.map((t) => ({ description: t.description, category: t.category, amount: t.amount, quantity: 1, unitPrice: t.amount, chargeType: 'Fixed' as const })) : [
        { description: 'Professional Fees — Civil Litigation', category: 'Fee - Fixed', amount: 8000 },
        { description: 'Disbursement — Court filing and related fees', category: 'Disbursement', amount: 0 },
        { description: 'Reimbursement — Photocopy, travel, phone/courier', category: 'Reimbursement', amount: 0 },
      ].map((item) => ({ ...item, quantity: 1, unitPrice: item.amount, chargeType: 'Fixed' as const })));
    }
    return withDefaults([{ description: manualDesc, category: 'Fee - Fixed', amount: manualAmount, quantity: 1, unitPrice: manualAmount, chargeType: 'Fixed' }]);
  };

  useEffect(() => {
    if (isNewQuoteOpen && quoteLineItems.length === 0) setQuoteLineItems(defaultQuoteLineItems());
  }, [isNewQuoteOpen]);

  // Filtered quotations
  const filteredQuotations = quotations.filter((q) => {
    const term = (searchTerm || '').toLowerCase();
    return (
      (q.clientName || '').toLowerCase().includes(term) ||
      (q.id || '').toLowerCase().includes(term) ||
      (q.fileRef && q.fileRef.toLowerCase().includes(term)) ||
      (q.practiceArea || '').toLowerCase().includes(term)
    );
  });
  const consultationRecords = quotations.filter((q) => q.subtype === 'Consultation');

  const quotationRecords = filteredQuotations.filter((q) => q.documentType !== 'Proforma' && q.subtype !== 'Consultation');
  const proformaRecords = filteredQuotations.filter((q) => q.documentType === 'Proforma');
  const invoiceRecords = invoices.filter((invoice) => {
    const term = searchTerm.toLowerCase();
    return (!term || `${invoice.id} ${invoice.partyName || ''} ${invoice.fileRef || ''}`.toLowerCase().includes(term)) &&
      (statusFilter === 'All' || invoice.status === statusFilter);
  });
  const receiptRecords = receipts.filter((receipt) => {
    const term = searchTerm.toLowerCase();
    return !term || `${receipt.id} ${receipt.receivedFrom} ${receipt.fileRef}`.toLowerCase().includes(term);
  });

  const visibleQuotationRecords = (activeTab === 'proforma' ? proformaRecords : quotationRecords)
    .filter((q) => statusFilter === 'All' || q.status === statusFilter);

  const notifyClient = (clientId: string | undefined, title: string, message: string, channel: 'portal' | 'email' | 'whatsapp') => {
    const client = clients.find((candidate) => candidate.id === clientId);
    if (channel === 'portal' && client) {
      addClientPortalUpdate(client.id, { title, message, source: 'Billing' });
      showToast(`${client.name}'s Client Portal was updated.`);
      return;
    }
    if (channel === 'email') {
      const recipient = client?.email || '';
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`;
      showToast('Email draft opened for the client.');
      return;
    }
    const phone = client?.phone?.replace(/[^\d+]/g, '') || '';
    window.open(`https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    showToast('WhatsApp message opened for the client.');
  };

  const notifyBillingStage = (record: Quotation | Invoice | ReceiptRecord, title: string, message: string, clientId?: string) => {
    const recordClientName = 'clientName' in record ? record.clientName : 'receivedFrom' in record ? record.receivedFrom : undefined;
    const resolvedClientId = clientId || ('clientId' in record ? record.clientId : undefined) || clients.find((client) => client.name === recordClientName)?.id;
    notifyClient(resolvedClientId, title, message, 'portal');
  };

  // Client suggestions
  const matchingClients = clients.filter((c) =>
    (c.name || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase()) ||
    (c.id || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase())
  );
  const matchingLeads = leads.filter((lead) =>
    (lead.name || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) || lead.id.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  const handleConvertToInvoice = (q: Quotation) => {
    if (q.status !== 'Accepted') {
      showToast('Mark the quotation as agreed before creating an invoice.');
      return;
    }
    const invId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInv: Invoice = {
      id: invId,
      clientId: q.partyId || q.leadId || 'PROSPECT-UNREGISTERED',
      caseId: q.fileRef || 'GENERAL',
      fileRef: q.fileRef,
      quotationId: q.id,
      partyType: q.partyType || 'Client',
      partyName: q.clientName,
      amount: q.total * 0.92,
      discount: 0,
      tax: q.total * 0.08,
      total: q.total,
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'Unpaid',
      lineItems: q.lineItems,
    };

    addInvoice(newInv);
    q.status = 'Accepted';
    showToast(`Quotation ${q.id} converted to Tax Invoice ${newInv.id}`);
  };

  const handleCreateProforma = (q: Quotation) => {
    if (q.status !== 'Accepted') {
      showToast('Mark the quotation as agreed before creating a proforma.');
      return;
    }
    const proforma: Quotation = {
      ...q,
      id: `PF-${Math.floor(1000 + Math.random() * 9000)}`,
      documentType: 'Proforma',
      sourceQuotationId: q.id,
      status: 'Draft',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedDate: '',
    };
    addQuotation(proforma);
    showToast(`Proforma quotation ${proforma.id} created from ${q.id}`);
  };

  const handleSubmitForApproval = (q: Quotation) => {
    updateQuotation(q.id, { status: 'Pending Approval', approvalStatus: 'Pending' });
  };

  const handleApproveQuotation = (q: Quotation) => {
    const today = new Date().toISOString().slice(0, 10);
    updateQuotation(q.id, {
      status: 'Ready',
      approvalStatus: 'Approved',
      approvedBy: currentUser.name,
      approvedDate: today,
    });
  };

  const handleRejectQuotation = (q: Quotation) => {
    updateQuotation(q.id, { status: 'Draft', approvalStatus: 'Pending', approvedBy: '', approvedDate: '' });
  };

  const handleSaveInternalRecord = (q: Quotation) => {
    updateQuotation(q.id, { status: 'Ready' });
    showToast(`${q.id} saved as an internal record.`);
  };

  const handleSendToClient = (q: Quotation) => {
    const today = new Date().toISOString().slice(0, 10);
    updateQuotation(q.id, { status: 'Sent', documentSentDate: today, documentSentBy: currentUser.name });
    showToast(`${q.id} marked as sent to ${q.clientName}.`);
  };

  const handleMarkAgreed = (q: Quotation) => updateQuotation(q.id, { status: 'Accepted' });
  const handleMarkDeclined = (q: Quotation) => updateQuotation(q.id, { status: 'Declined' });

  const handleUploadDocument = (q: Quotation, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (!url) return;
      updateQuotation(q.id, {
        documents: [
          ...(q.documents || []),
          {
            id: `QUO-DOC-${Date.now()}`,
            name: file.name,
            url,
            type: file.type || 'application/octet-stream',
            size: file.size,
            uploadedAt: new Date().toISOString(),
            category: 'Other Document',
          },
        ],
      });
      showToast(`${file.name} attached to ${q.id}.`);
    };
    reader.readAsDataURL(file);
  };

  const handleRevertToQuotation = (q: Quotation) => {
    if (invoices.some((invoice) => invoice.quotationId === q.id)) {
      showToast(`Cannot revert ${q.id}: an invoice has already been created from this proforma.`);
      return;
    }
    updateQuotation(q.id, {
      documentType: 'Quotation',
      sourceQuotationId: undefined,
      status: 'Draft',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedDate: '',
    });
    showToast(`${q.id} reverted to a draft quotation.`);
  };

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return alert(`${partyType} name required`);
    if (partyType === 'Prospect' && !selectedPartyId) {
      showToast('Prospect must be selected from an existing lead record.');
      return;
    }

    let lineItems: QuotationLineItem[] = [];
    let calculatedTotal = 0;

    if (isConveyancing) {
      lineItems = [
        {
          description: `Professional Fee — SRO 2023 Scale (Property Value: RM ${propertyPrice.toLocaleString()})`,
          category: 'Fee - SRO',
          amount: sroResult.scaleFee,
        },
        {
          description: 'SST Service Tax (8%)',
          category: 'Fee - SRO',
          amount: sroResult.sstAmount,
        },
        {
          description: 'Estimated Stamp Duty (Memorandum of Transfer)',
          category: 'Disbursement',
          amount: sroResult.stampDutyEstimate,
        },
        {
          description: 'Title Search & Land Registry Registration Fees',
          category: 'Disbursement',
          amount: 300,
        },
      ];
      calculatedTotal = sroResult.totalWithDisbursements;
    } else if (isLitigation) {
      const templateItems = quoteTemplates.filter(
        (t) => t.practiceArea === practiceArea && t.courtLevel === courtLevel && t.stage === stage
      );
      if (templateItems.length > 0) {
        lineItems = templateItems.map((t) => ({
          description: t.description,
          category: t.category,
          amount: t.amount,
        }));
      } else {
        lineItems = [{ description: 'Professional Fee — Civil Litigation Trial', category: 'Fee - Fixed', amount: 8000 }];
      }
      calculatedTotal = lineItems.reduce((s, item) => s + item.amount, 0);
    } else {
      lineItems = [{ description: manualDesc, category: 'Fee - Fixed', amount: manualAmount }];
      calculatedTotal = manualAmount;
    }

    const qId = `Q-${Math.floor(1000 + Math.random() * 9000)}`;
    if (quoteLineItems.length > 0) {
      lineItems = quoteLineItems;
      const totals = computeTotals(lineItems);
      calculatedTotal = totals.grandTotal;
    }
    const newQ: Quotation = {
      id: qId,
      date: new Date().toISOString().slice(0, 10),
      practiceArea,
      fileRef: '',
      leadId: partyType === 'Prospect' ? selectedPartyId : '',
      clientName: clientName.trim(),
      status: 'Draft',
      total: calculatedTotal,
      billedSoFar: 0,
      remaining: calculatedTotal,
      courtLevel: isLitigation ? courtLevel : '',
      stage: isLitigation ? stage : '',
      feeMethod: isConveyancing ? 'SRO Scale' : 'Fixed',
      subtype: isConveyancing ? 'Property Transfer SPA' : '',
      partyType,
      partyId: selectedPartyId || undefined,
      formatMode,
      notes: quoteNotes.trim(),
      paymentTerms: paymentTerms.trim(),
      validityDays: 30,
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedDate: '',
      lineItems,
    };

    addQuotation(newQ);
    setIsNewQuoteOpen(false);
    setQuoteLineItems([]);
    setClientName('');
    setClientSearchQuery('');
    setSelectedPartyId('');
    setPartyType('Client');
    setQuoteNotes('');
    setPaymentTerms('Payment due within 30 days of invoice date');
    setFormatMode('Standard');
    showToast('Quotation created & approved');
  };

  const handleSaveConsultation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientName.trim() || !consultationFee) return;
    if (partyType === 'Prospect' && !selectedPartyId) {
      showToast('Prospect must be selected from an existing lead record.');
      return;
    }
    const partyId = partyType === 'Prospect' ? selectedPartyId : (selectedPartyId || `${partyType.toUpperCase()}-UNREGISTERED`);
    const consultation: Quotation = {
      id: `CONS-${Math.floor(1000 + Math.random() * 9000)}`,
      documentType: consultationMode === 'Proforma' ? 'Proforma' : 'Quotation',
      date: consultationDate,
      practiceArea: 'Consultation',
      fileRef: '',
      leadId: partyType === 'Prospect' ? partyId : '',
      clientName: clientName.trim(),
      partyType,
      partyId,
      status: consultationMode === 'Proforma' ? 'Draft' : 'Accepted',
      total: consultationFee,
      billedSoFar: 0,
      remaining: consultationFee,
      courtLevel: '',
      stage: 'Consultation',
      feeMethod: 'Fixed',
      subtype: 'Consultation',
      consultationDate,
      consultationType,
      consultationDurationMinutes: consultationDuration,
      formatMode: 'Standard',
      notes: consultationDescription.trim(),
      paymentTerms: 'Payable on issue',
      validityDays: 14,
      approvalStatus: consultationMode === 'Invoice' ? 'Approved' : 'Pending',
      approvedBy: consultationMode === 'Invoice' ? currentPartnerCode : '',
      approvedDate: consultationMode === 'Invoice' ? consultationDate : '',
      lineItems: [{ description: consultationDescription.trim(), category: 'Fee - Fixed', amount: consultationFee }],
    };
    addQuotation(consultation);
    if (consultationMode === 'Invoice') {
      addInvoice({
        id: `INV-CONS-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: partyId,
        caseId: 'CONSULTATION',
        quotationId: consultation.id,
        partyType,
        partyName: consultation.clientName,
        amount: consultationFee,
        discount: 0,
        tax: 0,
        total: consultationFee,
        date: consultationDate,
        dueDate: consultationDate,
        status: 'Unpaid',
        lineItems: consultation.lineItems,
      });
    }
    setIsConsultationOpen(false);
    setClientName('');
    setClientSearchQuery('');
    setSelectedPartyId('');
    showToast(`${consultationMode === 'Invoice' ? 'Consultation invoice issued' : 'Consultation proforma created'} for ${consultation.clientName}`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#16223A] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#A9814A]" />
            Fee Quotations &amp; SRO 2023 Fee Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compliant with Solicitors' Remuneration Order (SRO 2023) First Schedule scale fees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Client Name / Quote ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg text-xs w-56 focus:outline-none focus:border-[#A9814A]"
            />
          </div>

          <button
            onClick={() => setIsNewQuoteOpen(true)}
            className="bg-[#16223A] hover:bg-[#1F2E4D] text-[#F6F4EE] text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[#E1DCCF] pb-2 sm:grid-cols-4">
        {([
          ['quotations', 'Quotation', FileText, quotationRecords.length],
          ['proforma', 'Proforma Invoices', FileText, proformaRecords.length],
          ['invoices', 'Invoices', Receipt, invoices.length],
          ['receipts', 'Official Receipt', CheckCircle2, receipts.length],
        ] as const).map(([tab, label, Icon, count]) => (
          <button type="button" key={tab} onClick={() => { setActiveTab(tab); setStatusFilter('All'); }} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold cursor-pointer ${activeTab === tab ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-[#E1DCCF] bg-white text-slate-600'}`}>
            <span><Icon className="mr-1 inline h-3.5 w-3.5" />{label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {(activeTab === 'quotations' || activeTab === 'proforma') && <>
      <div className="flex flex-col gap-3 rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#A9814A]">Billing stage {activeTab === 'quotations' ? '01' : '02'}</p><h3 className="font-serif text-lg font-bold text-[#16223A]">{activeTab === 'quotations' ? 'Quotations' : 'Proforma Invoices'}</h3><p className="text-[11px] text-slate-500">Move records forward only after the current stage is approved.</p></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-48">
          <option value="All">All statuses</option>
          {['Draft', 'Pending Approval', 'Ready', 'Sent', 'Accepted', 'Declined'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      {/* Quotations Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Document No</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Client / Lead</th>
              <th className="p-3 font-bold">Practice Area</th>
              <th className="p-3 font-bold">Scale / Method</th>
              <th className="p-3 font-bold text-right">Total Amount (RM)</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3 font-bold">Last Edited</th>
              <th className="p-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleQuotationRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500 text-xs">
                  No quotations found matching "{searchTerm}".
                </td>
              </tr>
            ) : (
              visibleQuotationRecords.map((q) => (
                <tr key={q.id} className="hover:bg-[#FAF8F2] transition-colors">
                  <td className="p-3 font-mono font-medium text-slate-800"><div>{q.id}</div><span className={`text-[9px] font-bold uppercase ${q.documentType === 'Proforma' ? 'text-amber-700' : 'text-blue-700'}`}>{q.documentType || 'Quotation'}</span></td>
                  <td className="p-3 font-mono text-slate-600">{q.date}</td>
                  <td className="p-3 font-bold text-[#16223A]">{q.clientName}</td>
                  <td className="p-3 font-medium text-slate-800">{q.practiceArea}</td>
                  <td className="p-3 text-slate-600 font-mono text-[11px]">{q.feeMethod}</td>
                  <td className="p-3 text-right font-mono font-bold text-[#16223A]">
                    RM {q.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        q.status === 'Sent'
                          ? 'bg-blue-100 text-blue-800'
                          : q.status === 'Pending Approval'
                          ? 'bg-amber-100 text-amber-800'
                          : q.status === 'Ready'
                          ? 'bg-indigo-100 text-indigo-800'
                          : q.status === 'Accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'Declined'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3 text-[10px] text-slate-600">
                    <div className="font-semibold">{q.lastEditedBy || 'Not recorded'}</div>
                    {q.lastEditedAt && <div>{new Date(q.lastEditedAt).toLocaleString()}</div>}
                    {q.documents?.length ? <div className="text-amber-700">{q.documents.length} attachment{q.documents.length === 1 ? '' : 's'}</div> : null}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        onClick={() => setPreviewDocId(q.id)}
                        className="px-2 py-1 text-[11px] font-semibold border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="View Official PDF / Doc"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>

                      {q.status === 'Draft' && (
                        <button type="button" onClick={() => handleSubmitForApproval(q)} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer">Submit for Approval</button>
                      )}

                      {q.status === 'Pending Approval' && (
                        <>
                          <button type="button" onClick={() => handleApproveQuotation(q)} className="rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 cursor-pointer"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Approve</button>
                          <button type="button" onClick={() => handleRejectQuotation(q)} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer"><X className="mr-1 inline h-3.5 w-3.5" />Reject</button>
                        </>
                      )}

                      {q.status === 'Ready' && (
                        <>
                          <button type="button" onClick={() => handleSaveInternalRecord(q)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"><Save className="mr-1 inline h-3.5 w-3.5" />Save Internal</button>
                          <button type="button" onClick={() => handleSendToClient(q)} className="rounded-md bg-[#16223A] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#1F2E4D] cursor-pointer"><Send className="mr-1 inline h-3.5 w-3.5" />Send to Client</button>
                        </>
                      )}

                      {q.status === 'Sent' && (
                        <>
                          <button type="button" onClick={() => handleMarkAgreed(q)} className="rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-800 cursor-pointer">Mark as Agreed</button>
                          <button type="button" onClick={() => handleMarkDeclined(q)} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer">Decline</button>
                        </>
                      )}

                      {q.status !== 'Declined' && (
                        <label className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                          <Upload className="mr-1 inline h-3.5 w-3.5" />Attach
                          <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleUploadDocument(q, file); event.target.value = ''; }} />
                        </label>
                      )}

                      {q.documentType !== 'Proforma' && q.status === 'Accepted' && (
                        <button
                          onClick={() => handleCreateProforma(q)}
                          className="px-2 py-1 text-[11px] font-bold border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          title="Create a proforma quotation from this quotation"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Proforma</span>
                        </button>
                      )}

                      {q.documentType === 'Proforma' && (
                        <button
                          onClick={() => handleRevertToQuotation(q)}
                          className="px-2 py-1 text-[11px] font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          title="Revert this proforma to a draft quotation"
                        >
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                          <span>Revert to Quote</span>
                        </button>
                      )}

                      {q.status === 'Accepted' && (
                        <button
                          onClick={() => handleConvertToInvoice(q)}
                          className="px-2 py-1 text-[11px] font-bold bg-[#A9814A] hover:bg-[#8e6b3b] text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                          title="Convert quotation directly to Tax Invoice"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Convert to Invoice</span>
                        </button>
                      )}

                      <button type="button" onClick={() => notifyBillingStage(q, `${q.documentType === 'Proforma' ? 'Proforma invoice' : 'Quotation'} update`, `Your ${q.documentType === 'Proforma' ? 'proforma invoice' : 'quotation'} ${q.id} is currently ${q.status}. Total: RM ${q.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}.`)} className="rounded-md border border-emerald-300 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 cursor-pointer" title="Update Client Portal"><ExternalLink className="mr-1 inline h-3.5 w-3.5" />Portal</button>
                      <button type="button" onClick={() => notifyClient(q.partyId || clients.find((client) => client.name === q.clientName)?.id, `${q.documentType === 'Proforma' ? 'Proforma invoice' : 'Quotation'} update`, `Your document ${q.id} is currently ${q.status}. Total: RM ${q.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}.`, 'email')} className="rounded-md border border-blue-300 px-2 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-50 cursor-pointer" title="Email client"><Mail className="mr-1 inline h-3.5 w-3.5" />Email</button>
                      <button type="button" onClick={() => notifyClient(q.partyId || clients.find((client) => client.name === q.clientName)?.id, `${q.documentType === 'Proforma' ? 'Proforma invoice' : 'Quotation'} update`, `Your document ${q.id} is currently ${q.status}. Total: RM ${q.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}.`, 'whatsapp')} className="rounded-md border border-green-300 px-2 py-1 text-[11px] font-bold text-green-800 hover:bg-green-50 cursor-pointer" title="WhatsApp client"><MessageSquare className="mr-1 inline h-3.5 w-3.5" />WhatsApp</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>}

      {activeTab === 'invoices' && <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#A9814A]">Billing stage 03</p><h3 className="font-serif text-lg font-bold text-[#16223A]">Invoices</h3><p className="text-[11px] text-slate-500">Invoices update here when a proforma or agreed quotation is transferred.</p></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-48"><option value="All">All statuses</option>{['Draft', 'Pending Review', 'Ready', 'Unpaid', 'Partial', 'Paid', 'Voided'].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        <div className="overflow-x-auto rounded-xl border border-[#E1DCCF] bg-white"><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#E1DCCF] bg-[#F6F4EE] text-[10px] uppercase text-slate-600"><th className="p-3">Invoice</th><th className="p-3">Client / Matter</th><th className="p-3">Date</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3 text-right">Client update</th></tr></thead><tbody className="divide-y divide-slate-100">{invoiceRecords.length ? invoiceRecords.map((invoice) => { const message = `Your invoice ${invoice.id} is now ${invoice.status}. Total: RM ${invoice.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}.`; return <tr key={invoice.id}><td className="p-3 font-mono font-bold text-[#16223A]">{invoice.id}<div className="text-[10px] text-slate-500">Due {invoice.dueDate}</div></td><td className="p-3 font-bold">{invoice.partyName || 'Client'}<div className="text-[10px] text-slate-500">{invoice.fileRef || 'General matter'}</div></td><td className="p-3 font-mono text-slate-600">{invoice.date}</td><td className="p-3 text-right font-mono font-bold">RM {invoice.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td><td className="p-3"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold">{invoice.status}</span></td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => notifyBillingStage(invoice, 'Invoice update', message)} className="rounded border border-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-800 cursor-pointer" title="Update Client Portal"><ExternalLink className="mr-1 inline h-3 w-3" />Portal</button><button type="button" onClick={() => notifyClient(invoice.clientId, 'Invoice update', message, 'email')} className="rounded border border-blue-300 px-2 py-1 text-[10px] font-bold text-blue-800 cursor-pointer" title="Email client"><Mail className="mr-1 inline h-3 w-3" />Email</button><button type="button" onClick={() => notifyClient(invoice.clientId, 'Invoice update', message, 'whatsapp')} className="rounded border border-green-300 px-2 py-1 text-[10px] font-bold text-green-800 cursor-pointer" title="WhatsApp client"><MessageSquare className="mr-1 inline h-3 w-3" />WhatsApp</button></div></td></tr>; }) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">No invoices match this status.</td></tr>}</tbody></table></div>
      </div>}

      {activeTab === 'receipts' && <div className="space-y-4">
        <div className="rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[#A9814A]">Billing stage 04</p><h3 className="font-serif text-lg font-bold text-[#16223A]">Official Receipts</h3><p className="text-[11px] text-slate-500">Official receipts appear automatically when invoice payments are recorded.</p></div>
        <div className="overflow-x-auto rounded-xl border border-[#E1DCCF] bg-white"><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#E1DCCF] bg-[#F6F4EE] text-[10px] uppercase text-slate-600"><th className="p-3">Receipt</th><th className="p-3">Received from</th><th className="p-3">Date</th><th className="p-3 text-right">Amount</th><th className="p-3">Received by</th><th className="p-3 text-right">Client update</th></tr></thead><tbody className="divide-y divide-slate-100">{receiptRecords.length ? receiptRecords.map((receipt) => { const message = `Official Receipt ${receipt.id} has been issued for your payment of RM ${receipt.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}.`; return <tr key={receipt.id}><td className="p-3 font-mono font-bold text-[#16223A]">{receipt.id}<div className="text-[10px] text-slate-500">{receipt.bankRef}</div></td><td className="p-3 font-bold">{receipt.receivedFrom}<div className="text-[10px] text-slate-500">{receipt.fileRef || 'General matter'}</div></td><td className="p-3 font-mono text-slate-600">{receipt.date}</td><td className="p-3 text-right font-mono font-bold text-emerald-800">RM {receipt.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</td><td className="p-3 text-slate-600">{receipt.receivedBy}</td><td className="p-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => notifyBillingStage(receipt, 'Official receipt issued', message)} className="rounded border border-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-800 cursor-pointer"><ExternalLink className="mr-1 inline h-3 w-3" />Portal</button><button type="button" onClick={() => notifyClient(receipt.clientId, 'Official receipt issued', message, 'email')} className="rounded border border-blue-300 px-2 py-1 text-[10px] font-bold text-blue-800 cursor-pointer"><Mail className="mr-1 inline h-3 w-3" />Email</button><button type="button" onClick={() => notifyClient(receipt.clientId, 'Official receipt issued', message, 'whatsapp')} className="rounded border border-green-300 px-2 py-1 text-[10px] font-bold text-green-800 cursor-pointer"><MessageSquare className="mr-1 inline h-3 w-3" />WhatsApp</button></div></td></tr>; }) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">No official receipts issued yet.</td></tr>}</tbody></table></div>
      </div>}

      {/* New Quote Modal */}
      {isNewQuoteOpen && (
        <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg font-bold text-[#16223A] mb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#A9814A]" />
              New Quotation &amp; SRO Scale Calculator
            </h3>

            <form onSubmit={handleSaveQuote} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">
                  Client / Prospect Name or Reference Number
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Type or search Client Name / Ref No (e.g. Encik Farid Iskandar)"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setClientSearchQuery(e.target.value);
                    }}
                    className="w-full"
                  />
                  <div className="flex gap-1.5">
                    {(['Client', 'Prospect'] as const).map((type) => <button key={type} type="button" onClick={() => { setPartyType(type); setSelectedPartyId(''); setClientName(''); setClientSearchQuery(''); }} className={`rounded-md border px-2.5 py-1 text-[10px] font-bold cursor-pointer ${partyType === type ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{type}</button>)}
                  </div>
                  {clientSearchQuery.trim() && <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {partyType === 'Client' ? matchingClients.slice(0, 8).map((client) => <button key={client.id} type="button" onClick={() => { setClientName(client.name); setSelectedPartyId(client.id); setClientSearchQuery(''); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-amber-50 cursor-pointer"><strong>{client.name}</strong><span className="ml-2 font-mono text-[10px] text-slate-500">{client.id}</span></button>) : matchingLeads.slice(0, 8).map((lead) => <button key={lead.id} type="button" onClick={() => { setClientName(lead.name); setSelectedPartyId(lead.id); setClientSearchQuery(''); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-amber-50 cursor-pointer"><strong>{lead.name}</strong><span className="ml-2 font-mono text-[10px] text-slate-500">{lead.id} · {lead.stage}</span></button>)}
                    {partyType === 'Prospect' && matchingLeads.length === 0 && <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50">Prospect must come from an existing lead record. Search for a lead and select it.</div>}
                    {partyType === 'Client' && matchingClients.length === 0 && <div className="px-3 py-2 text-[11px] text-slate-500">No client found. You can continue with this name as an unregistered client.</div>}
                  </div>}
                  <p className="text-[10px] text-slate-500">Prospects must be selected from an existing lead record before a quotation can be generated.</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E1DCCF] bg-[#FAF8F2] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2"><label className="font-bold text-slate-700 block uppercase">Billing format</label><span className="text-[10px] text-slate-500">Choose the document structure</span></div>
                <div className="flex gap-2">
                  {(['Standard', 'General'] as const).map((mode) => <button key={mode} type="button" onClick={() => setFormatMode(mode)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer ${formatMode === mode ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{mode} format</button>)}
                </div>
                <p className="text-[10px] text-slate-500">Standard follows the selected practice-area structure. General keeps the editable scope and terms flexible.</p>
                <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Payment terms" className="w-full" />
                <textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} placeholder="Additional scope, exclusions or document notes" rows={2} className="w-full" />
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area</label>
                <select
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  className="w-full font-semibold"
                >
                  {practiceAreas.map((area) => <option key={area.id} value={area.name}>{area.name}</option>)}
                </select>
              </div>

              {/* SRO 2023 Interactive Calculator Box for Conveyancing */}
              {practiceArea === 'Conveyancing' && (
                <div className="bg-[#FAF8F2] border border-[#E1DCCF] p-4 rounded-xl space-y-3">
                  <div className="font-bold text-[#16223A] text-xs flex items-center gap-1.5 border-b border-[#E1DCCF] pb-2">
                    <Calculator className="w-4 h-4 text-[#A9814A]" />
                    SRO 2023 First Schedule Scale Fee Breakdown
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block uppercase mb-1">
                        Property Value / Consideration (RM)
                      </label>
                      <input
                        type="number"
                        value={propertyPrice}
                        onChange={(e) => setPropertyPrice(Number(e.target.value))}
                        className="w-full font-mono font-bold"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={isDiscounted}
                          onChange={(e) => setIsDiscounted(e.target.checked)}
                          className="rounded text-[#A9814A]"
                        />
                        <span>SRO Discount Rule (Max 25%)</span>
                      </label>

                      {isDiscounted && (
                        <input
                          type="number"
                          max={25}
                          value={discountPct}
                          onChange={(e) => setDiscountPct(Number(e.target.value))}
                          placeholder="Discount % (capped at 25%)"
                          className="w-full text-xs font-mono"
                        />
                      )}
                    </div>
                  </div>

                  {/* Calculated Tier Breakdown */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] space-y-1.5">
                    {sroResult.breakdown.map((tier, idx) => (
                      <div key={idx} className="flex justify-between text-slate-700">
                        <span>
                          {tier.tier} ({tier.rate} on RM {tier.amount.toLocaleString()}):
                        </span>
                        <span className="font-mono font-semibold">
                          RM {tier.fee.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-100">
                      <span>SST Service Tax (8%):</span>
                      <span className="font-mono font-semibold">
                        RM {sroResult.sstAmount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Est. Stamp Duty (MOT):</span>
                      <span className="font-mono font-semibold">
                        RM {sroResult.stampDutyEstimate.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-[#16223A] pt-2 border-t border-slate-300 text-xs">
                      <span>Total Estimated Scale &amp; Disbursements:</span>
                      <span className="font-mono text-emerald-800 text-sm">
                        RM {sroResult.totalWithDisbursements.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {practiceArea === 'Civil Litigation' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Court Tier</label>
                    <select value={courtLevel} onChange={(e) => setCourtLevel(e.target.value)} className="w-full">
                      <option value="Sessions Court">Sessions Court</option>
                      <option value="Magistrate's Court">Magistrate's Court</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Trial Stage</label>
                    <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full">
                      <option value="Full Trial">Full Trial</option>
                      <option value="Appeal / Enforcement">Appeal / Enforcement</option>
                    </select>
                  </div>
                </div>
              )}

              <LineItemsEditor items={quoteLineItems.length > 0 ? quoteLineItems : defaultQuoteLineItems()} onChange={setQuoteLineItems} />

              {false && practiceArea !== 'Conveyancing' && practiceArea !== 'Civil Litigation' && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Scope Description</label>
                    <input
                      type="text"
                      value={manualDesc}
                      onChange={(e) => setManualDesc(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block uppercase mb-1">Professional Fee Amount (RM)</label>
                    <input
                      type="number"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(Number(e.target.value))}
                      className="w-full font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewQuoteOpen(false)}
                  className="px-4 py-2 border border-[#E1DCCF] text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={partyType === 'Prospect' && !selectedPartyId}
                  className={`px-4 py-2 rounded-md font-semibold cursor-pointer ${partyType === 'Prospect' && !selectedPartyId ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#16223A] hover:bg-[#1F2E4D] text-white'}`}
                >
                  Generate Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doc Preview Modal */}
      {previewDocId && (
        <DocPreviewModal type="quotation" docId={previewDocId} onClose={() => setPreviewDocId(null)} />
      )}

      {isConsultationOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16223A]/60 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[#E1DCCF] bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between border-b border-[#E1DCCF] pb-3"><div><h3 className="font-serif text-lg font-bold text-[#16223A]">New Consultation Billing</h3><p className="mt-1 text-xs text-slate-500">Direct invoice or proforma for a consultation.</p></div><button type="button" onClick={() => setIsConsultationOpen(false)} className="text-xl text-slate-500 cursor-pointer">×</button></div><form onSubmit={handleSaveConsultation} className="space-y-3 text-xs"><div className="flex gap-2">{(['Invoice', 'Proforma'] as const).map((mode) => <button key={mode} type="button" onClick={() => setConsultationMode(mode)} className={`rounded-lg border px-3 py-2 font-bold cursor-pointer ${consultationMode === mode ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{mode === 'Invoice' ? 'Direct Invoice' : 'Proforma First'}</button>)}</div><div className="flex gap-2">{(['Client', 'Prospect'] as const).map((type) => <button key={type} type="button" onClick={() => { setPartyType(type); setClientName(''); setClientSearchQuery(''); setSelectedPartyId(''); }} className={`rounded-md border px-2.5 py-1 font-bold cursor-pointer ${partyType === type ? 'border-[#16223A] bg-[#16223A] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{type}</button>)}</div><input required value={clientName} onChange={(e) => { setClientName(e.target.value); setClientSearchQuery(e.target.value); }} placeholder={`Search ${partyType.toLowerCase()} by name or reference`} className="w-full" />{clientSearchQuery && <div className="max-h-28 overflow-y-auto rounded border border-slate-200">{(partyType === 'Client' ? matchingClients : matchingLeads).slice(0, 8).map((party) => <button key={party.id} type="button" onClick={() => { setClientName(partyType === 'Client' ? party.name : party.name); setSelectedPartyId(party.id); setClientSearchQuery(''); }} className="block w-full border-b border-slate-100 p-2 text-left hover:bg-amber-50 cursor-pointer"><strong>{party.name}</strong> <span className="font-mono text-[10px] text-slate-500">{party.id}</span></button>)}</div>}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="font-bold">Consultation date<input required type="date" value={consultationDate} onChange={(e) => setConsultationDate(e.target.value)} className="mt-1 w-full" /></label><label className="font-bold">Duration (minutes)<input required type="number" min="15" value={consultationDuration} onChange={(e) => setConsultationDuration(Number(e.target.value))} className="mt-1 w-full" /></label></div><label className="font-bold">Consultation type<select value={consultationType} onChange={(e) => setConsultationType(e.target.value as Quotation['consultationType'])} className="mt-1 w-full"><option>Initial Consultation</option><option>Follow-up Consultation</option><option>Urgent Consultation</option><option>Document Review</option><option>Video Consultation</option></select></label><label className="font-bold">Fee (RM)<input required type="number" min="0.01" step="0.01" value={consultationFee} onChange={(e) => setConsultationFee(Number(e.target.value))} className="mt-1 w-full" /></label><label className="font-bold">Description / scope<input required value={consultationDescription} onChange={(e) => setConsultationDescription(e.target.value)} className="mt-1 w-full" /></label><div className="flex justify-end gap-2 pt-3"><button type="button" onClick={() => setIsConsultationOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 font-bold cursor-pointer">Cancel</button><button type="submit" className="rounded-lg bg-[#16223A] px-3 py-2 font-bold text-white cursor-pointer">{consultationMode === 'Invoice' ? 'Issue consultation invoice' : 'Create consultation proforma'}</button></div></form></div></div>}
    </div>
  );
};
