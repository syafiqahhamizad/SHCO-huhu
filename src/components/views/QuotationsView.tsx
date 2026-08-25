import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, QuotationLineItem, Invoice } from '../../types';
import { calculateSroTransferFee } from '../../lib/sroCalculator';
import { DocPreviewModal } from '../modals/DocPreviewModal';
import { FileText, Plus, Calculator, Search, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';

export const QuotationsView: React.FC = () => {
  const { quotations, clients, quoteTemplates, addQuotation, addInvoice, currentPartnerCode, showToast, setCurrentView } = useApp();

  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Quote Form
  const [clientName, setClientName] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [practiceArea, setPracticeArea] = useState('Conveyancing');
  const [propertyPrice, setPropertyPrice] = useState<number>(650000);
  const [isDiscounted, setIsDiscounted] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);

  const [courtLevel, setCourtLevel] = useState('Sessions Court');
  const [stage, setStage] = useState('Full Trial');

  // Manual line items for non-conveyancing
  const [manualDesc, setManualDesc] = useState('Professional Advisory Fee');
  const [manualAmount, setManualAmount] = useState<number>(5000);

  // Computed SRO Fee
  const sroResult = calculateSroTransferFee(propertyPrice, isDiscounted, discountPct);

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

  // Client suggestions
  const matchingClients = clients.filter((c) =>
    (c.name || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase()) ||
    (c.id || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase())
  );

  const handleConvertToInvoice = (q: Quotation) => {
    const invId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInv: Invoice = {
      id: invId,
      clientId: q.leadId || 'CLIENT-1',
      caseId: q.fileRef || 'GENERAL',
      fileRef: q.fileRef,
      quotationId: q.id,
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

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return alert('Client name required');

    let lineItems: QuotationLineItem[] = [];
    let calculatedTotal = 0;

    if (practiceArea === 'Conveyancing') {
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
    } else if (practiceArea === 'Civil Litigation') {
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
    const newQ: Quotation = {
      id: qId,
      date: new Date().toISOString().slice(0, 10),
      practiceArea,
      fileRef: '',
      leadId: '',
      clientName: clientName.trim(),
      status: 'Sent',
      total: calculatedTotal,
      billedSoFar: 0,
      remaining: calculatedTotal,
      courtLevel: practiceArea === 'Civil Litigation' ? courtLevel : '',
      stage: practiceArea === 'Civil Litigation' ? stage : '',
      feeMethod: practiceArea === 'Conveyancing' ? 'SRO Scale' : 'Fixed',
      subtype: practiceArea === 'Conveyancing' ? 'Property Transfer SPA' : '',
      approvalStatus: 'Approved',
      approvedBy: currentPartnerCode,
      approvedDate: new Date().toISOString().slice(0, 10),
      lineItems,
    };

    addQuotation(newQ);
    setIsNewQuoteOpen(false);
    setClientName('');
    showToast('Quotation created & approved');
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

      {/* Quotations Table */}
      <div className="bg-white border border-[#E1DCCF] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F4EE] border-b border-[#E1DCCF] text-[10px] uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold">Quote No</th>
              <th className="p-3 font-bold">Date</th>
              <th className="p-3 font-bold">Client / Lead</th>
              <th className="p-3 font-bold">Practice Area</th>
              <th className="p-3 font-bold">Scale / Method</th>
              <th className="p-3 font-bold text-right">Total Amount (RM)</th>
              <th className="p-3 font-bold">Status</th>
              <th className="p-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredQuotations.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                  No quotations found matching "{searchTerm}".
                </td>
              </tr>
            ) : (
              filteredQuotations.map((q) => (
                <tr key={q.id} className="hover:bg-[#FAF8F2] transition-colors">
                  <td className="p-3 font-mono font-medium text-slate-800">{q.id}</td>
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
                          : q.status === 'Accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setPreviewDocId(q.id)}
                        className="px-2 py-1 text-[11px] font-semibold border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="View Official PDF / Doc"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => handleConvertToInvoice(q)}
                        className="px-2 py-1 text-[11px] font-bold bg-[#A9814A] hover:bg-[#8e6b3b] text-white rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        title="Convert quotation directly to Tax Invoice"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Convert to Invoice</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                  {/* Select from existing clients */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Or pick existing:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) setClientName(e.target.value);
                      }}
                      className="text-xs py-1 px-2 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800"
                    >
                      <option value="">-- Select Registered Client --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block uppercase mb-1">Practice Area</label>
                <select
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  className="w-full font-semibold"
                >
                  <option value="Conveyancing">Conveyancing (SRO 2023 Scale Fees)</option>
                  <option value="Civil Litigation">Civil Litigation (Court Templates)</option>
                  <option value="Corporate/Commercial">Corporate &amp; Commercial (Advisory)</option>
                  <option value="Probate/Estate">Probate &amp; Estate Administration</option>
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

              {practiceArea !== 'Conveyancing' && practiceArea !== 'Civil Litigation' && (
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
                  className="px-4 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md font-semibold cursor-pointer"
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
    </div>
  );
};
