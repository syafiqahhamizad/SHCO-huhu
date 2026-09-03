import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, QuotationLineItem, Invoice } from '../../types';
import {
  computeTotals,
  nextDocNumber,
  buildConveyancingItems,
  buildLitigationItems,
  COURT_LEVELS,
  LITIGATION_STAGES,
  ConveyancingSubtype,
} from '../../lib/billingEngine';
import {
  Plus, Search, ArrowRight, FileText, Receipt as ReceiptIcon, Trash2,
  ChevronDown, ChevronUp, BadgeCheck, Calculator, Landmark, X, Printer,
} from 'lucide-react';

const fmt = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

type DocFilter = 'All' | 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt';

interface DocRow {
  key: string;
  docNo: string;
  type: 'Quotation' | 'Proforma' | 'Invoice' | 'Receipt';
  date: string;
  clientName: string;
  practiceArea: string;
  format: string;
  total: number;
  status: string;
  source?: Quotation | Invoice;
}

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Sent: 'bg-blue-100 text-blue-700',
  Accepted: 'bg-emerald-100 text-emerald-700',
  Declined: 'bg-rose-100 text-rose-700',
  Unpaid: 'bg-amber-100 text-amber-700',
  Partial: 'bg-orange-100 text-orange-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Issued: 'bg-emerald-100 text-emerald-700',
  Voided: 'bg-slate-200 text-slate-500 line-through',
};

const BLANK_ITEM: QuotationLineItem = { description: '', category: 'Fee - Fixed', amount: 0 };

export const BillingPipelineView: React.FC = () => {
  const {
    quotations, invoices, receipts, payments, clients, cases, quoteTemplates, currentUser,
    addQuotation, updateQuotation, addInvoice, updateInvoice, addPayment, addReceipt, showToast,
  } = useApp();

  const [filter, setFilter] = useState<DocFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  /* ---------- unified document register ---------- */
  const rows = useMemo<DocRow[]>(() => {
    const qRows: DocRow[] = quotations.map((q) => ({
      key: `Q-${q.id}`,
      docNo: q.documentType === 'Proforma' ? (q.id.startsWith('PI-') ? q.id : q.id.replace(/^Q-?/, 'PI-')) : q.id,
      type: q.documentType === 'Proforma' ? 'Proforma' : 'Quotation',
      date: q.date,
      clientName: q.clientName,
      practiceArea: q.practiceArea,
      format: q.practiceArea === 'Conveyancing' ? `SRO · ${q.subtype || 'Transfer'}` : q.courtLevel ? `${q.courtLevel} · ${q.stage}` : q.feeMethod,
      total: q.total,
      status: q.status,
      source: q,
    }));
    const iRows: DocRow[] = invoices.map((inv) => ({
      key: `I-${inv.id}`,
      docNo: inv.id,
      type: 'Invoice',
      date: inv.date,
      clientName: inv.partyName || clients.find((c) => c.id === inv.clientId)?.name || '—',
      practiceArea: cases.find((c) => c.id === inv.caseId)?.practiceArea || '—',
      format: inv.quotationId ? `From ${inv.quotationId}` : 'Direct',
      total: inv.total,
      status: inv.status,
      source: inv,
    }));
    const rRows: DocRow[] = receipts.map((r) => ({
      key: `R-${r.id}`,
      docNo: r.id,
      type: 'Receipt',
      date: r.date,
      clientName: r.receivedFrom,
      practiceArea: '—',
      format: r.description,
      total: r.amount,
      status: 'Issued',
    }));
    return [...qRows, ...iRows, ...rRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [quotations, invoices, receipts, clients, cases]);

  const filteredRows = rows.filter((r) => {
    if (filter !== 'All' && r.type !== filter) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return r.docNo.toLowerCase().includes(t) || r.clientName.toLowerCase().includes(t) || r.practiceArea.toLowerCase().includes(t);
  });

  const stats = useMemo(() => ({
    quo: quotations.filter((q) => q.documentType !== 'Proforma').length,
    proforma: quotations.filter((q) => q.documentType === 'Proforma').length,
    invOutstanding: invoices.filter((i) => i.status === 'Unpaid' || i.status === 'Partial').reduce((s, i) => s + i.total - payments.filter((p) => p.invoiceId === i.id).reduce((ps, p) => ps + p.amount, 0), 0),
    collected: receipts.reduce((s, r) => s + r.amount, 0),
  }), [quotations, invoices, receipts, payments]);

  /* ---------- pipeline conversions ---------- */
  const convertToProforma = (q: Quotation) => {
    const id = nextDocNumber('PI', quotations.map((x) => x.id));
    addQuotation({
      ...q, id, documentType: 'Proforma', sourceQuotationId: q.id,
      date: today(), status: 'Draft', billedSoFar: 0, remaining: q.total,
    });
    updateQuotation(q.id, { status: 'Accepted' });
    showToast(`${q.id} converted to Proforma ${id}`);
  };

  const convertToInvoice = (q: Quotation) => {
    const id = nextDocNumber('INV', invoices.map((x) => x.id));
    const totals = computeTotals(q.lineItems || []);
    const client = clients.find((c) => c.name === q.clientName) || clients[0];
    const linkedCase = cases.find((c) => c.ref === q.fileRef) || cases.find((c) => c.clientId === client?.id);
    addInvoice({
      id,
      clientId: client?.id || '',
      caseId: linkedCase?.id || '',
      fileRef: q.fileRef || linkedCase?.ref || '',
      quotationId: q.id,
      partyName: q.clientName,
      amount: round2(totals.fees + totals.disbursements + totals.reimbursements),
      discount: 0,
      tax: totals.sst,
      total: totals.grandTotal,
      date: today(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'Unpaid',
      lineItems: q.lineItems,
    });
    updateQuotation(q.id, { status: 'Accepted', billedSoFar: q.total, remaining: 0 });
    showToast(`${q.id} billed as Invoice ${id}`);
  };

  const recordPayment = (inv: Invoice, amount: number, method: string, date: string) => {
    const paidSoFar = payments.filter((p) => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0);
    const remaining = inv.total - paidSoFar;
    const payAmt = Math.min(amount, remaining);
    if (payAmt <= 0) { showToast('Nothing outstanding on this invoice'); return; }

    addPayment({ id: nextDocNumber('PAY', payments.map((p) => p.id)), invoiceId: inv.id, amount: payAmt, date, method });

    const clientName = inv.partyName || clients.find((c) => c.id === inv.clientId)?.name || 'Client';
    addReceipt({
      id: nextDocNumber('OR', receipts.map((r) => r.id)),
      date,
      accountSet: 'OFFICE',
      receivedFrom: clientName,
      description: `Payment for Invoice ${inv.id}${payAmt < remaining ? ' (part payment)' : ''}`,
      amount: payAmt,
      debit: 'Office Bank',
      credit: inv.fileRef ? `${clientName} — ${inv.fileRef}` : clientName,
      clientId: inv.clientId,
      fileRef: inv.fileRef || '',
      bankRef: method,
      receivedBy: currentUser?.name || 'Finance',
    });

    if (payAmt < remaining) {
      updateInvoice(inv.id, { status: 'Partial' });
    }
    showToast(`Payment ${fmt(payAmt)} recorded — Official Receipt issued`);
    setPayingInvoice(null);
  };

  const voidInvoice = (inv: Invoice) => {
    if (!confirm(`Void invoice ${inv.id}? This cannot be undone.`)) return;
    updateInvoice(inv.id, { status: 'Voided', voidedAt: today(), voidedBy: currentUser?.name || '' });
  };

  /* ================= RENDER ================= */
  return (
    <div className="space-y-4">
      {/* pipeline visual */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
          {(['Quotation', 'Proforma', 'Invoice', 'Receipt'] as const).map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-300 mx-1" />}
              <button
                onClick={() => setFilter(filter === step ? 'All' : step)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
                  filter === step ? 'bg-[#16223A] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {step === 'Receipt' ? <BadgeCheck className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {step === 'Proforma' ? 'Proforma Invoice' : step}
              </button>
            </React.Fragment>
          ))}
          <span className="ml-auto text-[10px] font-normal text-slate-400">Click a stage to filter · conversion is one click</span>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Quotations', value: String(stats.quo), tone: 'text-slate-800' },
          { label: 'Proformas Open', value: String(stats.proforma), tone: 'text-blue-700' },
          { label: 'Outstanding Invoices', value: fmt(stats.invOutstanding), tone: 'text-amber-700' },
          { label: 'Collected (Receipts)', value: fmt(stats.collected), tone: 'text-emerald-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-bold uppercase text-slate-400">{s.label}</div>
            <div className={`mt-1 font-mono text-lg font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search doc no, client, practice area…"
            className="flex-1 border-0 bg-transparent text-xs outline-none"
          />
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#16223A] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1F2E4D] cursor-pointer"
        >
          <Plus className="h-4 w-4" /> New Document
        </button>
      </div>

      {/* register */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-bold uppercase text-slate-500">
              <th className="px-3 py-2">Doc No</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Next Step</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No documents — click "New Document" to start the pipeline.</td></tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.key} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-3 py-2 font-mono font-bold text-[#16223A]">{r.docNo}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    r.type === 'Quotation' ? 'bg-slate-100 text-slate-600'
                    : r.type === 'Proforma' ? 'bg-blue-100 text-blue-700'
                    : r.type === 'Invoice' ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                  }`}>{r.type}</span>
                </td>
                <td className="px-3 py-2 font-semibold text-slate-700">{r.clientName}</td>
                <td className="px-3 py-2 text-slate-500">{r.format}</td>
                <td className="px-3 py-2 text-slate-500">{r.date}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{fmt(r.total)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.type === 'Quotation' && r.status !== 'Accepted' && r.status !== 'Declined' && (
                    <button onClick={() => convertToProforma(r.source as Quotation)} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 cursor-pointer">
                      → Proforma
                    </button>
                  )}
                  {(r.type === 'Proforma' || (r.type === 'Quotation' && r.status === 'Accepted')) && (
                    <button onClick={() => convertToInvoice(r.source as Quotation)} className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700 cursor-pointer">
                      → Invoice
                    </button>
                  )}
                  {r.type === 'Invoice' && (r.status === 'Unpaid' || r.status === 'Partial') && (
                    <>
                      <button onClick={() => setPayingInvoice(r.source as Invoice)} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer">
                        → Payment
                      </button>
                      <button onClick={() => voidInvoice(r.source as Invoice)} title="Void invoice" className="ml-1 rounded bg-slate-200 px-1.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-rose-100 hover:text-rose-600 cursor-pointer">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  {r.type === 'Receipt' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><BadgeCheck className="h-3 w-3" /> Done</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && <NewDocumentModal onClose={() => setIsFormOpen(false)} />}
      {payingInvoice && (
        <PaymentModal invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onSave={recordPayment} />
      )}
    </div>
  );
};

/* ==================== NEW DOCUMENT MODAL (accounting-software style) ==================== */
const NewDocumentModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { quotations, invoices, clients, cases, quoteTemplates, addQuotation, addInvoice, showToast } = useApp();

  const [docType, setDocType] = useState<'Quotation' | 'Proforma' | 'Invoice'>('Quotation');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [caseId, setCaseId] = useState('');
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // practice format
  const [practiceArea, setPracticeArea] = useState('Conveyancing');
  const [convSubtype, setConvSubtype] = useState<ConveyancingSubtype>('Transfer');
  const [consideration, setConsideration] = useState('500000');
  const [discountPct, setDiscountPct] = useState('0');
  const [courtLevel, setCourtLevel] = useState<string>('Sessions Court');
  const [stage, setStage] = useState<string>('Full Trial');
  const [autoSource, setAutoSource] = useState<string>('');
  const [breakdown, setBreakdown] = useState<{ tier: string; rate: string; fee: number }[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [items, setItems] = useState<QuotationLineItem[]>([{ ...BLANK_ITEM }]);
  const totals = computeTotals(items);

  const autoFill = () => {
    if (practiceArea === 'Conveyancing') {
      const price = parseFloat(consideration) || 0;
      const r = buildConveyancingItems(price, convSubtype, parseFloat(discountPct) || 0);
      if (r.items.length === 0) { showToast('Enter a valid consideration / loan amount first'); return; }
      setItems(r.items);
      setBreakdown(r.breakdown);
      setAutoSource(`SRO 2023 ${convSubtype === 'Loan' ? 'Third' : 'First'} Schedule`);
      setShowBreakdown(true);
    } else if (practiceArea === 'Civil Litigation') {
      const r = buildLitigationItems(quoteTemplates, courtLevel, stage);
      setItems(r.items);
      setBreakdown([]);
      setAutoSource(r.source === 'Template' ? 'Firm template (matched level + stage)' : `Fee matrix: ${courtLevel} × ${stage}`);
    } else {
      showToast('Manual entry — add your own line items below');
    }
  };

  const updateItem = (i: number, patch: Partial<QuotationLineItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const handleSave = () => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) { showToast('Select a client'); return; }
    const validItems = items.filter((i) => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) { showToast('Add at least one line item with a description and amount'); return; }

    const linkedCase = cases.find((c) => c.id === caseId);
    const t = computeTotals(validItems);
    const subtotal = round2(t.fees + t.disbursements + t.reimbursements);

    if (docType === 'Invoice') {
      addInvoice({
        id: nextDocNumber('INV', invoices.map((x) => x.id)),
        clientId: client.id,
        caseId: linkedCase?.id || '',
        fileRef: linkedCase?.ref || '',
        partyName: client.name,
        amount: subtotal,
        discount: 0,
        tax: t.sst,
        total: t.grandTotal,
        date,
        dueDate,
        status: 'Unpaid',
        lineItems: validItems,
      });
    } else {
      addQuotation({
        id: nextDocNumber(docType === 'Proforma' ? 'PI' : 'Q', quotations.map((x) => x.id)),
        documentType: docType,
        partyType: 'Client',
        partyId: client.id,
        notes,
        date,
        practiceArea,
        fileRef: linkedCase?.fileRef || '',
        leadId: '',
        clientName: client.name,
        status: 'Draft',
        total: t.grandTotal,
        billedSoFar: 0,
        remaining: t.grandTotal,
        courtLevel: practiceArea === 'Civil Litigation' ? courtLevel : '',
        stage: practiceArea === 'Civil Litigation' ? stage : '',
        feeMethod: practiceArea === 'Conveyancing' ? 'SRO Scale' : practiceArea === 'Civil Litigation' ? 'Template' : 'Fixed',
        subtype: practiceArea === 'Conveyancing' ? convSubtype : '',
        approvalStatus: 'Pending',
        approvedBy: '',
        approvedDate: '',
        lineItems: validItems,
      });
    }
    onClose();
  };

  const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-[#A9814A] bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#16223A] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">New Billing Document</span>
            <div className="flex rounded-lg bg-white/10 p-0.5">
              {(['Quotation', 'Proforma', 'Invoice'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDocType(d)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold cursor-pointer ${docType === d ? 'bg-[#A9814A] text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  {d === 'Proforma' ? 'Proforma Inv' : d}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* parties */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Client</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`w-full ${inputCls}`}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Link Matter (optional)</span>
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">— None —</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.ref} · {c.title}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`w-full ${inputCls}`} />
            </label>
            {docType === 'Invoice' && (
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Due Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`w-full ${inputCls}`} />
              </label>
            )}
          </div>

          {/* practice format automation */}
          <div className="rounded-xl border border-[#A9814A]/30 bg-amber-50/50 p-3 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#A9814A]">
              <Calculator className="h-3.5 w-3.5" /> Auto fee calculator — by practice format
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Practice Area</span>
                <select value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} className={inputCls}>
                  <option>Conveyancing</option>
                  <option>Civil Litigation</option>
                  <option>Corporate/Commercial</option>
                  <option>Other (Manual)</option>
                </select>
              </label>

              {practiceArea === 'Conveyancing' && (
                <>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Type</span>
                    <select value={convSubtype} onChange={(e) => setConvSubtype(e.target.value as ConveyancingSubtype)} className={inputCls}>
                      <option value="Transfer">Transfer (S&P)</option>
                      <option value="Loan">Loan / Charge</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">{convSubtype === 'Loan' ? 'Loan Amount (RM)' : 'Consideration (RM)'}</span>
                    <input type="number" value={consideration} onChange={(e) => setConsideration(e.target.value)} className={`w-32 text-right font-mono ${inputCls}`} />
                  </label>
                  {convSubtype === 'Transfer' && (
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Discount % (max 25)</span>
                      <input type="number" min="0" max="25" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={`w-20 text-right font-mono ${inputCls}`} />
                    </label>
                  )}
                </>
              )}

              {practiceArea === 'Civil Litigation' && (
                <>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Court Level</span>
                    <select value={courtLevel} onChange={(e) => setCourtLevel(e.target.value)} className={inputCls}>
                      {COURT_LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Stage</span>
                    <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
                      {LITIGATION_STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                </>
              )}

              <button onClick={autoFill} className="flex items-center gap-1.5 rounded-lg bg-[#A9814A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#8f6d3f] cursor-pointer">
                <Calculator className="h-3.5 w-3.5" /> Auto-Fill
              </button>
            </div>

            {autoSource && (
              <div className="rounded-lg bg-white/70 border border-amber-200 px-2.5 py-1.5">
                <button onClick={() => breakdown.length > 0 && setShowBreakdown(!showBreakdown)} className="flex items-center gap-1 text-[10px] font-bold text-amber-800 cursor-pointer">
                  {breakdown.length > 0 && (showBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  Auto-filled from: {autoSource} — edit any row below
                </button>
                {showBreakdown && breakdown.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-t border-amber-100 pt-1.5 font-mono text-[10px] text-slate-600">
                    {breakdown.map((b) => (
                      <div key={b.tier} className="flex justify-between"><span>{b.tier} @ {b.rate}</span><span>{fmt(b.fee)}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* line items — accounting grid */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_130px_110px_32px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-100">
              <span>Description</span><span>Category</span><span className="text-right">Amount (RM)</span><span />
            </div>
            <div className="divide-y divide-slate-50">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_130px_110px_32px] items-center gap-2 px-3 py-1.5">
                  <input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="e.g. Professional fee — drafting SPA" className="min-w-0 border-0 bg-transparent text-xs outline-none focus:bg-slate-50 rounded px-1 py-1" />
                  <select value={item.category} onChange={(e) => updateItem(i, { category: e.target.value as QuotationLineItem['category'] })} className="rounded border border-slate-200 px-1.5 py-1 text-[10px] bg-white">
                    <option value="Fee - Fixed">Prof. Fee (Fixed)</option>
                    <option value="Fee - SRO">Prof. Fee (SRO)</option>
                    <option value="Disbursement">Disbursement</option>
                    <option value="Reimbursement">Reimbursement</option>
                  </select>
                  <input type="number" min="0" step="0.01" value={item.amount || ''} onChange={(e) => updateItem(i, { amount: Number(e.target.value) || 0 })} className="rounded border border-slate-200 px-1.5 py-1 text-right font-mono text-xs" />
                  <button onClick={() => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setItems([...items, { ...BLANK_ITEM }])} className="flex w-full items-center justify-center gap-1 border-t border-dashed border-slate-200 py-1.5 text-[10px] font-bold text-slate-400 hover:text-[#A9814A] cursor-pointer">
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
        </div>

        {/* totals + save */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-slate-600">
            <span>Fees <strong className="text-slate-800">{fmt(totals.fees)}</strong></span>
            <span>SST 8% <strong className="text-slate-800">{fmt(totals.sst)}</strong></span>
            <span>Disb. <strong className="text-slate-800">{fmt(totals.disbursements)}</strong></span>
            <span>Reimb. <strong className="text-slate-800">{fmt(totals.reimbursements)}</strong></span>
            <span className="ml-auto text-sm">Total <strong className="text-[#16223A] text-base">{fmt(totals.grandTotal)}</strong></span>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
            <button onClick={handleSave} className="rounded-lg bg-[#16223A] px-4 py-2 text-xs font-bold text-white hover:bg-[#1F2E4D] cursor-pointer">
              Save {docType}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================== PAYMENT → RECEIPT MODAL ==================== */
const PaymentModal: React.FC<{
  invoice: Invoice;
  onClose: () => void;
  onSave: (inv: Invoice, amount: number, method: string, date: string) => void;
}> = ({ invoice, onClose, onSave }) => {
  const { payments, clients } = useApp();
  const paidSoFar = payments.filter((p) => p.invoiceId === invoice.id).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, round2(invoice.total - paidSoFar));

  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState('Bank Transfer');
  const [date, setDate] = useState(today());

  const inputCls = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-700 px-5 py-3 rounded-t-2xl">
          <span className="flex items-center gap-2 text-sm font-bold text-white"><Landmark className="h-4 w-4" /> Record Payment → Receipt</span>
          <button onClick={onClose} className="text-emerald-100 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Invoice</span><strong className="font-mono">{invoice.id}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">Client</span><strong>{invoice.partyName || clients.find((c) => c.id === invoice.clientId)?.name}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">Invoice Total</span><span className="font-mono">{fmt(invoice.total)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Outstanding</span><strong className="font-mono text-amber-700">{fmt(remaining)}</strong></div>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Amount Received (RM)</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`text-right font-mono ${inputCls}`} />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option>Bank Transfer</option><option>FPX</option><option>Cheque</option><option>Cash</option><option>Client Account Transfer</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Date Received</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[10px] text-emerald-800 flex items-center gap-1.5">
            <ReceiptIcon className="h-3.5 w-3.5" /> An Official Receipt (OR-xxxx) will be issued automatically on save.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
          <button
            onClick={() => onSave(invoice, parseFloat(amount) || 0, method, date)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Save & Issue Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
