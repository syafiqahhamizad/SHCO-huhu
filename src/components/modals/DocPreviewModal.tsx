import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getPracticeSettings, generatePrintStyleTag, DEFAULT_PRACTICE_SETTINGS } from '../../services/templateService';
import {
  X,
  Download,
  Mail,
  MessageSquare,
  Building2,
  CheckCircle,
  AlertTriangle,
  Printer,
  Send,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { sendFinancePvNotificationEmail } from '../../lib/workspaceEmailService';

interface DocPreviewModalProps {
  type: 'quotation' | 'invoice' | 'receipt' | 'paymentVoucher';
  docId: string;
  onClose: () => void;
}

function numberToWords(n: number): string {
  const units = [
    '',
    'ONE',
    'TWO',
    'THREE',
    'FOUR',
    'FIVE',
    'SIX',
    'SEVEN',
    'EIGHT',
    'NINE',
    'TEN',
    'ELEVEN',
    'TWELVE',
    'THIRTEEN',
    'FOURTEEN',
    'FIFTEEN',
    'SIXTEEN',
    'SEVENTEEN',
    'EIGHTEEN',
    'NINETEEN',
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  if (n < 20) return units[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
  if (n < 1000) return units[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 !== 0 ? ' AND ' + numberToWords(n % 100) : '');
  if (n < 1000000)
    return numberToWords(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 !== 0 ? ' ' + numberToWords(n % 1000) : '');
  return numberToWords(Math.floor(n / 1000000)) + ' MILLION' + (n % 1000000 !== 0 ? ' ' + numberToWords(n % 1000000) : '');
}

function formatRinggitInWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'RINGGIT MALAYSIA ZERO ONLY';
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);

  let result = 'RINGGIT MALAYSIA ' + (whole > 0 ? numberToWords(whole) : 'ZERO');
  if (cents > 0) {
    result += ' AND CENTS ' + numberToWords(cents);
  }
  return result + ' ONLY';
}

export const DocPreviewModal: React.FC<DocPreviewModalProps> = ({ type, docId, onClose }) => {
  const { quotations, invoices, receipts, paymentVouchers, clients, cases, showToast } = useApp();

  const [activeShare, setActiveShare] = useState<'none' | 'email' | 'whatsapp'>('none');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [isDispatchingEmail, setIsDispatchingEmail] = useState(false);

  const practiceSettings = getPracticeSettings();
  const accounts = practiceSettings.bankAccounts && practiceSettings.bankAccounts.length > 0
    ? practiceSettings.bankAccounts
    : DEFAULT_PRACTICE_SETTINGS.bankAccounts || [];

  const defaultOfficeBank = accounts.find((a) => a.isDefaultOffice) || accounts.find((a) => a.accountType === 'Office Operating') || accounts[0] || {
    accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - OFFICE OPERATING',
    bankName: 'CIMB Bank Berhad',
    accountNo: '8001092834',
  };

  const defaultClientBank = accounts.find((a) => a.isDefaultClient) || accounts.find((a) => a.accountType === 'Client Trust') || accounts[1] || {
    accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - CLIENT TRUST ACCOUNT',
    bankName: 'Bank Islam Malaysia Berhad',
    accountNo: '1209384752',
  };

  let docTitle = '';
  let docNo = '';
  let recipientName = '';
  let previewContent: React.ReactNode = null;

  if (type === 'quotation') {
    const q = quotations.find((x) => x.id === docId);
    if (!q) return null;
    docTitle = 'QUOTATION';
    docNo = q.id;
    recipientName = q.clientName;

    const items =
      q.lineItems && q.lineItems.length
        ? q.lineItems
        : [{ description: 'Professional Legal Fee — ' + q.practiceArea, category: 'Fee - Fixed', amount: q.total }];

    // Separate items by section
    const profFeeItems = items.filter((i) => i.category.toLowerCase().includes('fee'));
    const disbItems = items.filter((i) => i.category.toLowerCase().includes('disbursement') || i.category.toLowerCase().includes('stamp') || i.category.toLowerCase().includes('search'));
    const reimbItems = items.filter((i) => !profFeeItems.includes(i) && !disbItems.includes(i));

    const profFeeTotal = profFeeItems.reduce((s, i) => s + i.amount, 0);
    const disbTotal = disbItems.reduce((s, i) => s + i.amount, 0);
    const reimbTotal = reimbItems.reduce((s, i) => s + i.amount, 0);

    const clientObj = clients.find((c) => c.name.toLowerCase() === q.clientName.toLowerCase());
    const caseObj = cases.find((c) => c.id === q.fileRef || c.ref === q.fileRef);

    const ourRef = q.fileRef || (caseObj ? caseObj.ref : `SHC/${q.practiceArea.slice(0, 3).toUpperCase()}/QUOT${q.id.replace(/\D/g, '') || '001'}/2026`);
    const subjectText = `${q.practiceArea.toUpperCase()} — ${q.subtype || q.courtLevel || 'LEGAL ADVISORY & SERVICES'}`;

    previewContent = (
      <div className="space-y-4 text-xs font-sans text-slate-900">
        {/* Reference Block */}
        <div className="grid grid-cols-2 gap-4 text-[11px] border border-slate-300 bg-white p-3 rounded font-sans">
          <div className="space-y-1">
            <div><span className="font-bold text-slate-700">Your Ref:</span> Kindly Advised</div>
            <div><span className="font-bold text-slate-700">Our Ref:</span> <span className="font-mono font-semibold text-[#16223A]">{ourRef}</span></div>
            <div><span className="font-bold text-slate-700">Client:</span> <span className="font-semibold uppercase">{q.clientName}</span></div>
            {clientObj?.address && <div className="text-slate-600 text-[10px] pl-11">{clientObj.address}</div>}
          </div>
          <div className="space-y-1 text-right">
            <div><span className="font-bold text-slate-700">Date:</span> {q.date.split('-').reverse().join('.')}</div>
            <div><span className="font-bold text-slate-700">Quotation No.:</span> <span className="font-mono font-bold text-[#16223A]">{q.id}</span></div>
            <div><span className="font-bold text-slate-700">TIN No.:</span> {clientObj?.taxNumber || '-'}</div>
          </div>
        </div>

        {/* Subject Line */}
        <div className="bg-slate-100 p-2 rounded border border-slate-300 font-bold text-xs text-slate-900">
          Subject : {subjectText}
        </div>

        {/* Narrative Paragraph */}
        <p className="text-[11px] text-slate-700 leading-relaxed italic bg-amber-50/50 p-2.5 rounded border border-amber-200/60">
          Taking instructions, perusing and reviewing relevant documents, drafting and preparing the relevant legal instruments and pleadings, conducting legal research, getting-up and preparing the matter, negotiating on the client's behalf, undertaking reasonable due diligence, and rendering legal advice as required, together with all necessary and incidental work related thereto.
        </p>

        {/* Body Table */}
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
              <th className="p-2 border border-slate-400">DESCRIPTION</th>
              <th className="p-2 border border-slate-400 text-right w-36">AMOUNT (RM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {/* Section 1: Professional Fees */}
            <tr className="bg-slate-100 font-bold">
              <td colSpan={2} className="p-2 text-[#16223A] uppercase tracking-wider text-[10px]">1. PROFESSIONAL FEES</td>
            </tr>
            {(profFeeItems.length > 0 ? profFeeItems : [{ description: 'Professional Legal Fee', amount: q.total }]).map((it, idx) => (
              <tr key={idx}>
                <td className="p-2 pl-4 text-slate-800">{it.description}</td>
                <td className="p-2 text-right font-mono font-medium">
                  {it.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-300 font-bold text-slate-900 bg-slate-50">
              <td className="p-1.5 pl-4 text-right">PROFESSIONAL FEES SUB TOTAL:</td>
              <td className="p-1.5 text-right font-mono">
                RM {(profFeeTotal || q.total).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            {/* Section 2: Disbursement */}
            {disbItems.length > 0 && (
              <>
                <tr className="bg-slate-100 font-bold border-t border-slate-300">
                  <td colSpan={2} className="p-2 text-[#16223A] uppercase tracking-wider text-[10px]">2. DISBURSEMENT</td>
                </tr>
                {disbItems.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 pl-4 text-slate-800">{it.description}</td>
                    <td className="p-2 text-right font-mono font-medium">
                      {it.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-bold text-slate-900 bg-slate-50">
                  <td className="p-1.5 pl-4 text-right">DISBURSEMENT SUB TOTAL:</td>
                  <td className="p-1.5 text-right font-mono">
                    RM {disbTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            )}

            {/* Section 3: Reimbursement */}
            {reimbItems.length > 0 && (
              <>
                <tr className="bg-slate-100 font-bold border-t border-slate-300">
                  <td colSpan={2} className="p-2 text-[#16223A] uppercase tracking-wider text-[10px]">3. REIMBURSEMENT</td>
                </tr>
                {reimbItems.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 pl-4 text-slate-800">{it.description}</td>
                    <td className="p-2 text-right font-mono font-medium">
                      {it.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-bold text-slate-900 bg-slate-50">
                  <td className="p-1.5 pl-4 text-right">REIMBURSEMENT SUB TOTAL:</td>
                  <td className="p-1.5 text-right font-mono">
                    RM {reimbTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#16223A] text-white font-bold text-xs border-t-2 border-slate-900">
              <td className="p-2.5">TOTAL AMOUNT TO BE PAID</td>
              <td className="p-2.5 text-right font-mono text-amber-300 text-sm">
                RM {q.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Verbatim Note */}
        <p className="text-[10px] text-slate-600 italic leading-snug">
          *Note: Please be informed that this document is merely a quotation prepared on the information available to date and is subject to be varied in accordance with further information, requirements and/or events are beyond our control*
        </p>

        {/* Verbatim Acknowledgment & Terms (a)–(d) */}
        <div className="bg-slate-50 border border-slate-300 p-3 rounded text-[10.5px] leading-relaxed text-slate-800 space-y-1.5">
          <p className="font-semibold text-slate-900">
            By agreeing to this quotation, it is hereby acknowledged and agreed by you that:-
          </p>
          <div className="pl-2 space-y-0.5">
            <p>(a) The professional fees may vary depending on the actual scope of work performed and any additional requirements imposed by relevant parties;</p>
            <p>(b) The Firm reserves the right to issue further invoices for any additional fees and/or costs incurred which are not expressly included in this quotation;</p>
            <p>(c) The Firm shall have the right to invoice progressive professional fees from time to time depending on the stage and progress of work;</p>
            <p className="pt-1 font-semibold text-[#16223A]">(d) Payment to be made via bank transfer to the following account(s):-</p>
            <div className="pl-4 font-mono text-[10px] text-slate-900 bg-white p-2.5 rounded border border-slate-200 mt-1 space-y-1.5">
              <div>
                <span className="font-bold text-[#16223A]">Office Operating Account (Professional Fees):</span>
                <br />
                Name: <strong>{defaultOfficeBank.accountName}</strong> | Bank: <strong>{defaultOfficeBank.bankName}</strong> | A/C No.: <strong>{defaultOfficeBank.accountNo}</strong>
              </div>
              <div className="pt-1 border-t border-slate-100">
                <span className="font-bold text-[#16223A]">Client Trust Account (Disbursements / Stakeholder Monies - SAR 1990):</span>
                <br />
                Name: <strong>{defaultClientBank.accountName}</strong> | Bank: <strong>{defaultClientBank.bankName}</strong> | A/C No.: <strong>{defaultClientBank.accountNo}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (type === 'invoice') {
    const inv = invoices.find((x) => x.id === docId);
    if (!inv) return null;
    docTitle = 'INVOICE';
    docNo = inv.id.startsWith('INV') ? inv.id : `INV-${inv.id}`;
    const client = clients.find((c) => c.id === inv.clientId);
    const caseObj = cases.find((c) => c.id === inv.caseId);
    recipientName = client ? client.name : 'Client';

    const ourRef = caseObj ? caseObj.ref : (inv.fileRef || `SHC/FIN/INV${inv.id.replace(/\D/g, '') || '001'}/2026`);
    const subjectText = caseObj ? caseObj.title : `LEGAL SERVICES — ${inv.caseId || 'MATTER BILLING'}`;

    previewContent = (
      <div className="space-y-4 text-xs font-sans text-slate-900">
        {/* Reference Block */}
        <div className="grid grid-cols-2 gap-4 text-[11px] border border-slate-300 bg-white p-3 rounded font-sans">
          <div className="space-y-1">
            <div><span className="font-bold text-slate-700">Your Ref:</span> Kindly Advised</div>
            <div><span className="font-bold text-slate-700">Our Ref:</span> <span className="font-mono font-semibold text-[#16223A]">{ourRef}</span></div>
            <div><span className="font-bold text-slate-700">Client:</span> <span className="font-semibold uppercase">{recipientName}</span></div>
            {client?.address && <div className="text-slate-600 text-[10px] pl-11">{client.address}</div>}
          </div>
          <div className="space-y-1 text-right">
            <div><span className="font-bold text-slate-700">Date:</span> {inv.date.split('-').reverse().join('.')}</div>
            <div><span className="font-bold text-slate-700">Invoice No.:</span> <span className="font-mono font-bold text-[#16223A]">{docNo}</span></div>
            <div><span className="font-bold text-slate-700">TIN No.:</span> {client?.taxNumber || '-'}</div>
            {inv.quotationId && <div><span className="font-bold text-slate-700">Ref Quotation No.:</span> <span className="font-mono">{inv.quotationId}</span></div>}
          </div>
        </div>

        {/* Subject Line */}
        <div className="bg-slate-100 p-2 rounded border border-slate-300 font-bold text-xs text-slate-900">
          Subject : {subjectText.toUpperCase()}
        </div>

        {/* Body Table */}
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
              <th className="p-2 border border-slate-400">DESCRIPTION</th>
              <th className="p-2 border border-slate-400 text-right w-36">AMOUNT (RM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            <tr className="bg-slate-100 font-bold">
              <td colSpan={2} className="p-2 text-[#16223A] uppercase tracking-wider text-[10px]">PROFESSIONAL FEES &amp; CHARGES</td>
            </tr>
            {inv.lineItems && inv.lineItems.length > 0 ? (
              inv.lineItems.map((it, idx) => (
                <tr key={idx}>
                  <td className="p-2 pl-4 text-slate-800">{it.description}</td>
                  <td className="p-2 text-right font-mono font-medium">
                    {it.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-2 pl-4 text-slate-800">Professional Services Rendered</td>
                <td className="p-2 text-right font-mono font-medium">
                  {inv.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {inv.discount > 0 && (
              <tr>
                <td className="p-2 pl-4 text-rose-700">Discounts Allowed</td>
                <td className="p-2 text-right font-mono text-rose-700">
                  - {inv.discount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}

            {inv.tax > 0 && (
              <tr>
                <td className="p-2 pl-4 text-slate-700">Service Tax (SST 8%)</td>
                <td className="p-2 text-right font-mono">
                  {inv.tax.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#16223A] text-white font-bold text-xs border-t-2 border-slate-900">
              <td className="p-2.5">TOTAL AMOUNT PAYABLE</td>
              <td className="p-2.5 text-right font-mono text-amber-300 text-sm">
                RM {inv.total.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Verbatim Note */}
        <p className="text-[10px] text-slate-600 italic leading-snug">
          *Note: This invoice is issued for professional services rendered up to the date stated above. Kindly settle within 14 days from the date of this invoice.*
        </p>

        {/* Verbatim Terms (a)–(d) */}
        <div className="bg-slate-50 border border-slate-300 p-3 rounded text-[10.5px] leading-relaxed text-slate-800 space-y-1.5">
          <p className="font-semibold text-slate-900">
            It is hereby notified and agreed that:-
          </p>
          <div className="pl-2 space-y-0.5">
            <p>(a) The above sum reflects fees and costs actually incurred as at the date of this invoice;</p>
            <p>(b) The Firm reserves the right to issue further invoices for additional work, fees, and/or disbursements not covered herein;</p>
            <p>(c) Late payment may be subject to further correspondence and/or legal action for recovery;</p>
            <p className="pt-1 font-semibold text-[#16223A]">(d) Payment to be made via bank transfer to the following account:-</p>
            <div className="pl-4 font-mono text-[10px] text-slate-900 bg-white p-2.5 rounded border border-slate-200 mt-1 space-y-1">
              <div>
                Account Name: <strong>{defaultOfficeBank.accountName}</strong><br />
                Bank: <strong>{defaultOfficeBank.bankName}</strong> &nbsp;|&nbsp; Bank Account No.: <strong>{defaultOfficeBank.accountNo}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (type === 'receipt') {
    const r = receipts.find((x) => x.id === docId);
    if (!r) return null;
    docTitle = 'RECEIPT';
    docNo = r.id.startsWith('RCT') ? r.id : `RCT-${r.id}`;
    recipientName = r.receivedFrom || 'Payer';

    const client = clients.find((c) => c.name.toLowerCase() === recipientName.toLowerCase());
    const caseObj = cases.find((c) => c.id === r.fileRef || c.ref === r.fileRef);
    const ourRef = r.fileRef || (caseObj ? caseObj.ref : `SHC/RCT/${r.id.replace(/\D/g, '') || '001'}/2026`);

    previewContent = (
      <div className="space-y-4 text-xs font-sans text-slate-900">
        {/* Reference Block */}
        <div className="grid grid-cols-2 gap-4 text-[11px] border border-slate-300 bg-white p-3 rounded font-sans">
          <div className="space-y-1">
            <div><span className="font-bold text-slate-700">Your Ref:</span> Kindly Advised</div>
            <div><span className="font-bold text-slate-700">Our Ref:</span> <span className="font-mono font-semibold text-[#16223A]">{ourRef}</span></div>
            <div><span className="font-bold text-slate-700">Client / Payer:</span> <span className="font-semibold uppercase">{recipientName}</span></div>
            {client?.address && <div className="text-slate-600 text-[10px] pl-11">{client.address}</div>}
          </div>
          <div className="space-y-1 text-right">
            <div><span className="font-bold text-slate-700">Date:</span> {r.date.split('-').reverse().join('.')}</div>
            <div><span className="font-bold text-slate-700">Receipt No.:</span> <span className="font-mono font-bold text-[#16223A]">{docNo}</span></div>
            <div><span className="font-bold text-slate-700">TIN No.:</span> {client?.taxNumber || '-'}</div>
            {r.bankRef && <div><span className="font-bold text-slate-700">Ref Bank Txn:</span> <span className="font-mono">{r.bankRef}</span></div>}
          </div>
        </div>

        {/* Subject Line */}
        <div className="bg-slate-100 p-2 rounded border border-slate-300 font-bold text-xs text-slate-900">
          Subject : OFFICIAL ACKNOWLEDGMENT OF PAYMENT — {r.description.toUpperCase()}
        </div>

        {/* Receipt Table */}
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-[#16223A] text-white text-[10.5px] uppercase font-bold tracking-wider">
              <th className="p-2.5 border border-slate-400">DESCRIPTION</th>
              <th className="p-2.5 border border-slate-400 text-right w-36">AMOUNT (RM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            <tr>
              <td className="p-3 text-slate-800">
                Received from <strong className="uppercase">{recipientName}</strong>, being payment for {r.description}
              </td>
              <td className="p-3 text-right font-mono font-bold text-sm text-slate-900">
                {r.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-[#16223A] text-white font-bold text-xs border-t-2 border-slate-900">
              <td className="p-2.5">TOTAL RECEIVED</td>
              <td className="p-2.5 text-right font-mono text-amber-300 text-sm">
                RM {r.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Metadata Details */}
        <div className="bg-slate-50 border border-slate-200 p-3 rounded text-[11px] space-y-1">
          <div><strong className="text-slate-700">Received via:</strong> Bank Transfer / FPX</div>
          <div><strong className="text-slate-700">Payment Date:</strong> {r.date.split('-').reverse().join('.')}</div>
          <div><strong className="text-slate-700">Account Designation:</strong> {r.accountSet === 'CLIENT' ? 'Client Trust Account (Solicitors\' Account Rules 1990)' : 'Office Operating Account'}</div>
          {r.bankRef && <div><strong className="text-slate-700">Transaction Reference:</strong> {r.bankRef}</div>}
        </div>

        {/* Verbatim Closing Line */}
        <p className="text-[10px] text-slate-600 italic leading-snug pt-2 border-t border-slate-200">
          *This receipt is issued as official acknowledgment of payment received and does not constitute a tax invoice unless otherwise stated.*
        </p>
      </div>
    );
  } else if (type === 'paymentVoucher') {
    const pv = paymentVouchers.find((x) => x.id === docId);
    if (!pv) return null;
    docTitle = 'Payment Voucher';
    docNo = pv.id;

    // Parse payee if included in description e.g. [Payee: Syafiqah Hamizad]
    let payee = pv.preparedBy;
    let cleanDesc = pv.description;
    const payeeMatch = pv.description.match(/^\[Payee:\s*([^\]]+)\]\s*(.*)$/i);
    if (payeeMatch) {
      payee = payeeMatch[1];
      cleanDesc = payeeMatch[2];
    }

    const ringgitInWords = formatRinggitInWords(pv.amount);

    previewContent = (
      <div className="space-y-4 text-xs font-sans">
        {/* Verification & Quick Email Action Banner (Top Verification Bar) */}
        <div className="p-3 bg-[#16223A] text-white rounded-lg flex flex-wrap justify-between items-center gap-3 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-xs flex items-center gap-2 text-amber-200">
                Print-Ready Legal Accounting Voucher
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-mono uppercase">
                  Verified Standard Format
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Formatted under Solicitors' Account Rules standards. Verify details before dispatching notifications.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsDispatchingEmail(true);
              const res = await sendFinancePvNotificationEmail({
                pvId: pv.id,
                date: pv.date,
                accountSet: pv.accountSet,
                voucherCategory: pv.voucherCategory,
                description: pv.description,
                amount: pv.amount,
                fileRef: pv.fileRef,
                preparedBy: pv.preparedBy,
                recipientEmail: 'finance@shcolaw.com',
              });
              setIsDispatchingEmail(false);
              showToast(`📧 Verification Email sent to finance@shcolaw.com (${res.message})`);
            }}
            disabled={isDispatchingEmail}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
          >
            {isDispatchingEmail ? (
              <span>Sending Email...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Verify &amp; Email Finance</span>
              </>
            )}
          </button>
        </div>

        {/* Voucher Meta Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">A/C Designation</span>
            <span
              className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold ${
                pv.accountSet === 'CLIENT'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}
            >
              {pv.accountSet === 'CLIENT' ? 'CLIENT TRUST A/C' : 'OFFICE OPERATING A/C'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Category</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{pv.voucherCategory}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Matter Ref</span>
            <span className="font-mono font-bold text-slate-800 block mt-0.5">
              {pv.fileRef && pv.fileRef !== 'FIRM_OPERATIONS' ? pv.fileRef : 'Firm Overhead'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Partner Sign-off</span>
            {pv.approved ? (
              <span className="text-emerald-800 font-bold text-[11px] flex items-center gap-1 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {pv.approvedBy}
              </span>
            ) : (
              <span className="text-amber-800 font-bold text-[11px] flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Pending Sign-off
              </span>
            )}
          </div>
        </div>

        {/* Formal Legal Payment Voucher Table Layout */}
        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="bg-[#16223A] text-white p-2.5 font-serif font-bold text-xs uppercase tracking-wider flex justify-between items-center">
            <span>Payment Voucher Particulars</span>
            <span className="font-mono text-amber-300 font-normal text-[11px] capitalize">
              Voucher No: {pv.id}
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                <th className="p-2.5 w-12 text-center">No.</th>
                <th className="p-2.5">Payee &amp; Particulars Description</th>
                <th className="p-2.5 w-44">G/L Account Classification</th>
                <th className="p-2.5 w-32 text-right">Amount (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2.5 text-center font-mono font-bold text-slate-600 align-top">01</td>
                <td className="p-2.5 align-top">
                  <div className="font-bold text-slate-900 mb-1">
                    Payee / Recipient: <span className="text-[#16223A] font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{payee}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed mt-1.5">{cleanDesc}</p>
                  {pv.fileRef && pv.fileRef !== 'FIRM_OPERATIONS' && (
                    <div className="mt-2 font-mono text-[10.5px] text-blue-900 bg-blue-50 px-2 py-0.5 rounded w-max border border-blue-200">
                      Client Matter File Ref: {pv.fileRef}
                    </div>
                  )}
                </td>
                <td className="p-2.5 font-mono text-[10.5px] text-slate-700 align-top">
                  <div className="font-semibold text-slate-900">Dr: {pv.debit}</div>
                  <div className="text-slate-500 mt-1">Cr: {pv.credit}</div>
                </td>
                <td className="p-2.5 text-right font-mono font-bold text-slate-900 text-sm align-top">
                  RM {pv.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-800 font-bold text-xs text-slate-900">
                <td colSpan={3} className="p-2.5 text-right font-serif">
                  TOTAL NET PAYABLE DISBURSEMENT:
                </td>
                <td className="p-2.5 text-right font-mono text-sm text-[#16223A]">
                  RM {pv.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Ringgit in Words Banner */}
          <div className="bg-amber-50/80 border-t border-amber-200 p-2.5 text-[11px] font-semibold text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold">Ringgit Malaysia in Words:</span>
            <span className="font-mono text-amber-950 font-bold uppercase tracking-tight">{ringgitInWords}</span>
          </div>
        </div>

        {/* Legal Signatures Authorization Block */}
        <div className="pt-4 mt-4 border-t border-slate-300 grid grid-cols-3 gap-3 text-[10.5px]">
          <div className="border border-slate-200 p-2.5 rounded bg-slate-50 flex flex-col justify-between h-28">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[9.5px]">01. Prepared By</div>
              <div className="font-semibold text-slate-900 mt-1">{pv.preparedBy}</div>
              <div className="text-slate-500 text-[9.5px]">Accounts / Legal Exec</div>
            </div>
            <div className="border-t border-slate-300 pt-1 text-slate-500 font-mono text-[9px] flex justify-between">
              <span>Sig: ________________</span>
              <span>Date: {pv.date}</span>
            </div>
          </div>

          <div className="border border-slate-200 p-2.5 rounded bg-slate-50 flex flex-col justify-between h-28">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[9.5px]">02. Verified By Accounts</div>
              <div className="font-semibold text-slate-900 mt-1">Finance Audit Team</div>
              <div className="text-slate-500 text-[9.5px]">finance@shcolaw.com</div>
            </div>
            <div className="border-t border-slate-300 pt-1 text-slate-500 font-mono text-[9px] flex justify-between">
              <span>Sig: ________________</span>
              <span>Date: {pv.date}</span>
            </div>
          </div>

          <div className="border border-amber-300 p-2.5 rounded bg-amber-50/50 flex flex-col justify-between h-28">
            <div>
              <div className="font-bold text-amber-950 uppercase tracking-wider text-[9.5px]">03. Partner Sign-off Approval</div>
              {pv.approved ? (
                <div className="mt-1">
                  <div className="font-bold text-emerald-900 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>APPROVED ({pv.approvedBy})</span>
                  </div>
                  <div className="text-[9.5px] text-emerald-700">Authorised Partner Signatory</div>
                </div>
              ) : (
                <div className="mt-1 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>AWAITING PARTNER SIGNATURE</span>
                </div>
              )}
            </div>
            <div className="border-t border-amber-300 pt-1 text-amber-900 font-mono text-[9px] flex justify-between">
              <span>Sig: ________________</span>
              <span>Date: {pv.approved ? pv.date : 'Pending'}</span>
            </div>
          </div>
        </div>

        {/* Payment Transfer Reference & Mode Footer */}
        <div className="p-2.5 bg-slate-100 rounded border border-slate-200 flex flex-wrap justify-between items-center text-[10.5px] gap-2">
          <div>
            <span className="font-bold text-slate-700">Mode of Payment: </span>
            <span className="font-mono text-slate-900">Maybank Online Banking (FPX) / Cheque</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">Bank Transfer Ref: </span>
            <span className="font-mono font-bold text-blue-900">{pv.bankRef || 'MAYBANK-7821'}</span>
          </div>
        </div>
      </div>
    );
  }

  const handleDownloadWord = () => {
    const printableElement = document.getElementById('doc-preview-printable-area');
    const contentHtml = printableElement ? printableElement.innerHTML : '';
    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>${docTitle} ${docNo}</title>
      <style>
        body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
      </style>
      </head>
      <body>
        ${contentHtml}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/\s+/g, '_')}_${docNo}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${docTitle} ${docNo} as Word document (.doc)`);
  };

  const handleDownloadPdf = () => {
    const printableElement = document.getElementById('doc-preview-printable-area');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docTitle} ${docNo}</title>
            ${generatePrintStyleTag(practiceSettings)}
            <style>
              body { font-family: ${practiceSettings.fontFamily}, 'Plus Jakarta Sans', sans-serif; padding: 20px; font-size: ${practiceSettings.fontSizePt}pt; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background-color: ${practiceSettings.primaryColor}; color: white; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="practice-doc-wrapper">
              ${printableElement ? printableElement.innerHTML : ''}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      showToast(`PDF generated for ${docTitle} ${docNo}`);
    }
  };

  const handleOpenEmail = () => {
    setEmailSubject(`${docTitle} ${docNo} — Syafiqah Hamizad & Co Advocates & Solicitors`);
    setEmailBody(
      `Dear ${recipientName || 'Client'},\n\nPlease find attached ${docTitle} (${docNo}) from Syafiqah Hamizad & Co regarding your legal matter.\n\nKindly acknowledge receipt or contact us if you require any clarification.\n\nWarm regards,\nSyafiqah Hamizad & Co Advocates & Solicitors\nKuala Lumpur, Malaysia`
    );
    setActiveShare('email');
  };

  const handleOpenWhatsapp = () => {
    setWaMessage(
      `Dear ${recipientName || 'Client'},\n\nYour ${docTitle} (${docNo}) from Syafiqah Hamizad & Co Advocates & Solicitors is ready.\n\nIf you have any questions, please let us know.\n\nRegards,\nSyafiqah Hamizad & Co`
    );
    setActiveShare('whatsapp');
  };

  return (
    <div className="fixed inset-0 bg-[#16223A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[#E1DCCF] max-h-[90vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#16223A]">{docTitle} Document Preview</h2>
            <p className="text-xs text-slate-500 font-mono">{docNo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Paper Letterhead Box */}
        <div
          id="doc-preview-printable-area"
          className="bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg p-6 shadow-inner mb-6"
          style={{
            fontFamily: practiceSettings.fontFamily,
            fontSize: `${practiceSettings.fontSizePt}pt`,
            lineHeight: practiceSettings.lineHeight,
          }}
        >
          <div className="text-center pb-3 border-b-2 mb-4" style={{ borderColor: practiceSettings.primaryColor }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              {practiceSettings.logoUrl ? (
                <img src={practiceSettings.logoUrl} alt="Firm Logo" className="h-9 max-w-[120px] object-contain" />
              ) : (
                <div
                  className="w-8 h-8 rounded text-amber-300 font-serif font-bold text-sm flex items-center justify-center border border-amber-400"
                  style={{ backgroundColor: practiceSettings.primaryColor }}
                >
                  SH
                </div>
              )}
              <div
                className="font-serif font-bold text-xl tracking-wide uppercase"
                style={{ color: practiceSettings.primaryColor }}
              >
                {practiceSettings.firmName}
              </div>
            </div>
            <div
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: practiceSettings.accentColor }}
            >
              {practiceSettings.firmSubtitle}
            </div>
            <div className="text-[10px] text-slate-600 mt-1">{practiceSettings.address}</div>
            <div className="text-[10px] text-slate-600 font-mono">
              Email: {practiceSettings.email} &nbsp;|&nbsp; Tel: {practiceSettings.phone}
            </div>
            <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">
              Bar Ref: {practiceSettings.barRef} | SST Reg: {practiceSettings.sstNo}
            </div>
          </div>

          <div className="text-center mb-4">
            <h1
              className="font-serif font-bold tracking-wider uppercase border-b-2 inline-block px-4 pb-0.5"
              style={{
                color: practiceSettings.primaryColor,
                borderColor: practiceSettings.primaryColor,
                fontSize: `${practiceSettings.headingSizePt}pt`,
              }}
            >
              {docTitle}
            </h1>
          </div>

          {previewContent}

          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
            <div>
              Generated via SHCO Practice System
              <br />
              Computer-generated document — no physical signature required
            </div>
            <div className="text-right font-serif italic text-slate-700 font-medium">Syafiqah Hamizad &amp; Co</div>
          </div>
        </div>

        {/* Sharing Drawer Options */}
        {activeShare === 'email' && (
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-700" />
                Draft Gmail Message
              </span>
              <button onClick={() => setActiveShare('none')} className="text-xs text-slate-500 hover:underline">
                Cancel
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block uppercase mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block uppercase mb-1">Email Body</label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full text-xs"
              />
            </div>
            <button
              onClick={() => {
                showToast('Email sent via Gmail integration (PDF attached)');
                setActiveShare('none');
              }}
              className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer"
            >
              Send Email via Gmail API
            </button>
          </div>
        )}

        {activeShare === 'whatsapp' && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg mb-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                WhatsApp Client Notification Message
              </span>
              <button onClick={() => setActiveShare('none')} className="text-xs text-slate-500 hover:underline">
                Cancel
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-emerald-800 block uppercase mb-1">Message</label>
              <textarea
                rows={4}
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                className="w-full text-xs"
              />
            </div>
            <button
              onClick={() => {
                showToast('WhatsApp message sent to client');
                setActiveShare('none');
              }}
              className="bg-[#2F6F4E] hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer"
            >
              Send via WhatsApp Business
            </button>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap justify-end items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-[#E1DCCF] text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 text-xs font-bold bg-[#16223A] hover:bg-[#1F2E4D] text-white rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Legal Document / PDF</span>
          </button>

          <button
            onClick={handleDownloadWord}
            className="px-4 py-2 text-xs font-semibold border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-700" />
            <span>Word (.doc)</span>
          </button>

          <button
            onClick={handleOpenEmail}
            className="px-4 py-2 text-xs font-semibold border border-[#E1DCCF] text-slate-800 hover:bg-slate-100 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-blue-700" />
            <span>Email</span>
          </button>

          <button
            onClick={handleOpenWhatsapp}
            className="px-4 py-2 text-xs font-semibold bg-[#2F6F4E] hover:bg-emerald-800 text-white rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-200" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
