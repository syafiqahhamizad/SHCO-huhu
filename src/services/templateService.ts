// Practice Settings & Document Template Service

export interface FirmBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  swiftCode?: string;
  branch?: string;
  accountType: 'Office Operating' | 'Client Trust' | 'Fixed Deposit Stakeholder' | 'Syariah Escrow' | 'Disbursement' | 'Other';
  glAccountCode?: string;
  isDefaultOffice?: boolean;
  isDefaultClient?: boolean;
  notes?: string;
  isActive?: boolean;
}

export interface PracticeSettings {
  logoUrl: string; // Base64 data URI or HTTP image URL
  primaryColor: string; // Header & Primary Accents (e.g., #16223A)
  accentColor: string; // Secondary Accents (e.g., #A9814A)
  backgroundColor: string; // Background canvas (e.g., #FAF8F2)
  fontFamily: string; // Custom Font Family (e.g., 'Plus Jakarta Sans', 'Playfair Display', 'Times New Roman', 'Calibri')
  fontSizePt: number; // Base Font Size in pt (9, 10, 11, 12, 14)
  headingSizePt: number; // Heading Font Size in pt (14, 16, 18, 20)
  lineHeight: number; // Line Height (1.3, 1.5, 1.8)
  firmName: string;
  firmSubtitle: string;
  address: string;
  phone: string;
  email: string;
  barRef: string;
  sstNo: string;
  bankName: string;
  bankAccountNo: string;
  bankAccounts?: FirmBankAccount[];
  headerStyle: 'formal' | 'modern' | 'centered';
  consultationFormLink?: string;
  practiceAreas?: Array<{
    id: string;
    name: string;
    code: string;
    color?: string;
    description?: string;
  }>;
  matterCodes?: Array<{
    id: string;
    name: string;
    code: string;
    practiceArea: string;
    description?: string;
  }>;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'engagement' | 'quotation' | 'invoice' | 'receipt' | 'statement';
  content: string; // HTML structure with {{placeholders}}
  fileType: 'html' | 'docx' | 'txt';
  fileName?: string;
  updatedAt: string;
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  logoUrl: '',
  primaryColor: '#16223A',
  accentColor: '#A9814A',
  backgroundColor: '#FAF8F2',
  fontFamily: 'Plus Jakarta Sans',
  fontSizePt: 11,
  headingSizePt: 18,
  lineHeight: 1.5,
  firmName: 'MESSRS SYAFIQAH HAMIZAD & CO',
  firmSubtitle: 'Advocates & Solicitors • Peguambela & Peguamcara',
  address: '8-23-03 (2nd Floor), Jalan Medan Pusat Bandar 7A, Bangi Sentral, 43650 Bandar Baru Bangi, Selangor',
  phone: '+603-8684 1998 / +6011-7382 8754',
  email: 'shco@shcolaw.com',
  barRef: 'BC/S/2024/9912',
  sstNo: 'W10-2401-3200019',
  bankName: 'CIMB Bank Berhad (Office) / Bank Islam (Client Trust)',
  bankAccountNo: 'CIMB: 8001092834 | Bank Islam: 1209384752',
  headerStyle: 'formal',
  consultationFormLink: 'https://forms.google.com/shcolaw-consultation-intake',
  practiceAreas: [
    { id: 'pa-1', name: 'Civil Litigation', code: 'L', color: '#16223A', description: 'Court litigation, dispute resolution & appeals' },
    { id: 'pa-2', name: 'Estate Administration', code: 'EST', color: '#854D0E', description: 'Probate, Letters of Administration & Wasiat' },
    { id: 'pa-3', name: 'Conveyancing', code: 'CONV', color: '#15803D', description: 'Sale & Purchase, Loans, Leases & MOT' },
    { id: 'pa-4', name: 'Corporate', code: 'CORP', color: '#1E40AF', description: 'M&A, Contracts, Advisory & Joint Ventures' },
    { id: 'pa-5', name: 'Criminal', code: 'CR', color: '#B91C1C', description: 'Penal Code, MACC, Traffic & Trial Defense' },
    { id: 'pa-6', name: 'Syariah', code: 'SY', color: '#6B21A8', description: 'Perceraian, Hadhanah, Faraid & Mal' },
  ],
  matterCodes: [
    { id: 'mc-litigation', name: 'Litigation', code: 'L', practiceArea: 'Litigation' },
    { id: 'mc-conveyancing', name: 'Conveyancing', code: 'CONV', practiceArea: 'Conveyancing' },
    { id: 'mc-mot', name: 'Memorandum of Transfer', code: 'MOT', practiceArea: 'Conveyancing' },
    { id: 'mc-poc', name: 'Perfection of Charge', code: 'POC', practiceArea: 'Conveyancing' },
    { id: 'mc-doc', name: 'Discharge of Charge', code: 'DOC', practiceArea: 'Conveyancing' },
    { id: 'mc-loan', name: 'Loan', code: 'LOAN', practiceArea: 'Conveyancing' },
    { id: 'mc-criminal', name: 'Criminal', code: 'CR', practiceArea: 'Criminal' },
    { id: 'mc-ybgk', name: 'YBGK', code: 'YBGK', practiceArea: 'Criminal' },
    { id: 'mc-corporate', name: 'Corporate', code: 'CORP', practiceArea: 'Corporate' },
    { id: 'mc-estate', name: 'Estate Administration', code: 'EST', practiceArea: 'Estate Administration' },
    { id: 'mc-ofs', name: 'Order For Sale', code: 'OFS', practiceArea: 'Estate Administration' },
    { id: 'mc-vo', name: 'Vesting Order', code: 'VO', practiceArea: 'Estate Administration' },
    { id: 'mc-la', name: 'Letter of Administration', code: 'LA', practiceArea: 'Estate Administration' },
    { id: 'mc-prb', name: 'Probate', code: 'PRB', practiceArea: 'Estate Administration' },
  ],
  bankAccounts: [
    {
      id: 'bank_cimb_office',
      bankName: 'CIMB Bank Berhad',
      accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - OFFICE OPERATING',
      accountNo: '8001092834',
      swiftCode: 'CIMBMYKL',
      branch: 'Bandar Baru Bangi Branch',
      accountType: 'Office Operating',
      glAccountCode: '1010',
      isDefaultOffice: true,
      isDefaultClient: false,
      notes: 'Main Operating Account for billing collections & firm office expenses',
      isActive: true,
    },
    {
      id: 'bank_islam_trust',
      bankName: 'Bank Islam Malaysia Berhad',
      accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - CLIENT TRUST ACCOUNT',
      accountNo: '1209384752',
      swiftCode: 'BIMBMYKL',
      branch: 'Bangi Sentral Branch',
      accountType: 'Client Trust',
      glAccountCode: '1020',
      isDefaultOffice: false,
      isDefaultClient: true,
      notes: 'Solicitors Account Rules 1990 — Mandatory Client Monies & Stakeholder Deposits',
      isActive: true,
    },
    {
      id: 'bank_maybank_escrow',
      bankName: 'Maybank Islamic Berhad',
      accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - SYARIAH ESCROW TRUST',
      accountNo: '562839102984',
      swiftCode: 'MBBEMYKL',
      branch: 'Kuala Lumpur Main Branch',
      accountType: 'Syariah Escrow',
      glAccountCode: '1030',
      isDefaultOffice: false,
      isDefaultClient: false,
      notes: 'Conveyancing SPA Deposits & Murabahah Financing Escrow',
      isActive: true,
    },
    {
      id: 'bank_pbb_fd',
      bankName: 'Public Bank Berhad',
      accountName: 'MESSRS SYAFIQAH HAMIZAD & CO - FIXED DEPOSIT STAKEHOLDER',
      accountNo: '3928104820',
      swiftCode: 'PBBEMYKL',
      branch: 'Damansara Heights Branch',
      accountType: 'Fixed Deposit Stakeholder',
      glAccountCode: '1040',
      isDefaultOffice: false,
      isDefaultClient: false,
      notes: 'Section 84 Legal Profession Act Interest-Bearing Stakeholder Deposits',
      isActive: true,
    },
  ],
};

export const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tmpl_engagement_default',
    name: 'Master Engagement Letter Template',
    type: 'engagement',
    fileType: 'html',
    updatedAt: new Date().toISOString().split('T')[0],
    content: `<div class="doc-header">
  <div class="firm-title">{{firmName}}</div>
  <div class="firm-subtitle">{{firmSubtitle}}</div>
  <div class="firm-meta">{{firmAddress}} | Tel: {{firmPhone}} | Email: {{firmEmail}}</div>
  <div class="firm-meta">Bar Ref: {{barRef}} | SST Reg: {{sstNo}}</div>
</div>
<hr class="header-divider" />

<div class="doc-meta-bar">
  <div><strong>Ref:</strong> {{documentNo}}</div>
  <div><strong>Date:</strong> {{date}}</div>
</div>

<div class="recipient-box">
  <div><strong>TO:</strong></div>
  <div class="recipient-name">{{clientName}}</div>
  <div>{{clientAddress}}</div>
  <div>Contact: {{clientPhone}} | Email: {{clientEmail}}</div>
  <div><strong>Tax / NRIC ID:</strong> {{taxNo}}</div>
</div>

<div class="matter-title">
  RE: LETTER OF ENGAGEMENT — {{caseTitle}}
</div>

<p class="opening-p">
  We are pleased to confirm our appointment to act as your Advocates & Solicitors in relation to the abovementioned legal matter (Ref: {{matterRef}}). This letter sets out the agreed scope of professional representation, fee structure, and statutory terms of engagement.
</p>

<div class="section-heading">1. SCOPE OF LEGAL SERVICES</div>
<p>
  Our professional engagement shall encompass preliminary legal advisory, preparation and filing of legal pleadings, court representations, negotiations, and execution of necessary legal instruments pursuant to instructions received from {{clientName}}.
</p>

<div class="section-heading">2. PROFESSIONAL FEES &amp; DISBURSEMENTS</div>
<p>
  Professional fees are charged in accordance with the Solicitors Remuneration Order (SRO 2023) or fixed fee arrangements as set out in Quotation Ref: {{quotationNo}}. Total Agreed Professional Fee: <strong>{{subtotal}}</strong> (+ SST 8%: {{sstAmount}}).
</p>

<div class="terms-box">
  <div class="terms-title">3. STANDARD STATUTORY TERMS &amp; CONDITIONS</div>
  <ol>
    <li>All out-of-pocket disbursements (court filing fees, registration fees, stamping, search fees) shall be reimbursed by the client.</li>
    <li>Initial trust deposit monies shall be held in our Client Trust Account ({{bankDetails}}) pursuant to Solicitors' Account Rules 1990.</li>
    <li>Invoices are payable within {{paymentTerms}} of issuance.</li>
    <li>This agreement shall be governed by and construed in accordance with the laws of Malaysia.</li>
  </ol>
</div>

<div class="execution-block">
  <div class="sign-col">
    <div>Yours faithfully,</div>
    <div class="sign-firm">{{firmName}}</div>
    <div class="sign-line"></div>
    <div><strong>{{partnerName}}</strong></div>
    <div>Partner, Advocates &amp; Solicitors</div>
  </div>
  <div class="sign-col">
    <div>I/We hereby confirm and accept the above terms of engagement:</div>
    <div class="sign-line"></div>
    <div><strong>{{clientName}}</strong></div>
    <div>Date: ________________________</div>
  </div>
</div>`,
  },
  {
    id: 'tmpl_quotation_default',
    name: 'Fee Quotation & SRO Scale Template',
    type: 'quotation',
    fileType: 'html',
    updatedAt: new Date().toISOString().split('T')[0],
    content: `<div class="doc-header">
  <div class="firm-title">{{firmName}}</div>
  <div class="firm-subtitle">{{firmSubtitle}}</div>
  <div class="firm-meta">{{firmAddress}} | Tel: {{firmPhone}} | Email: {{firmEmail}}</div>
</div>
<hr class="header-divider" />

<div class="doc-title-banner">FEE QUOTATION</div>

<div class="doc-meta-bar">
  <div><strong>Quotation No.:</strong> {{quotationNo}}</div>
  <div><strong>Date:</strong> {{date}}</div>
  <div><strong>Validity:</strong> 30 Days</div>
</div>

<div class="recipient-box">
  <div><strong>PREPARED FOR:</strong> {{clientName}}</div>
  <div>{{clientAddress}}</div>
  <div>Tax ID: {{taxNo}}</div>
  <div><strong>Matter:</strong> {{caseTitle}}</div>
</div>

<table class="line-items-table">
  <thead>
    <tr>
      <th>Description &amp; Particulars</th>
      <th style="text-align: right;">Amount (RM)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1. Professional Legal Fees — {{caseTitle}}</td>
      <td style="text-align: right;">{{subtotal}}</td>
    </tr>
    <tr>
      <td>2. Service Tax (SST 8%)</td>
      <td style="text-align: right;">{{sstAmount}}</td>
    </tr>
    <tr>
      <td>3. Statutory Disbursements &amp; Search Fees (Estimated)</td>
      <td style="text-align: right;">RM 850.00</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td style="text-align: right;"><strong>TOTAL PROPOSED ESTIMATE:</strong></td>
      <td style="text-align: right;"><strong>{{totalAmount}}</strong></td>
    </tr>
  </tfoot>
</table>

<div class="notes-box">
  <strong>Payment Terms &amp; Bank Details:</strong><br />
  {{bankDetails}}<br />
  Quotation valid for 30 days from issuance. Governed by Solicitors Remuneration Order (SRO 2023).
</div>`,
  },
  {
    id: 'tmpl_invoice_default',
    name: 'Tax Invoice Master Template',
    type: 'invoice',
    fileType: 'html',
    updatedAt: new Date().toISOString().split('T')[0],
    content: `<div class="doc-header">
  <div class="firm-title">{{firmName}}</div>
  <div class="firm-subtitle">{{firmSubtitle}}</div>
  <div class="firm-meta">{{firmAddress}} | Tel: {{firmPhone}}</div>
  <div class="firm-meta">SST Reg No: {{sstNo}} | Bar Ref: {{barRef}}</div>
</div>
<hr class="header-divider" />

<div class="doc-title-banner">TAX INVOICE</div>

<div class="doc-meta-bar">
  <div><strong>Invoice No.:</strong> {{invoiceNo}}</div>
  <div><strong>Date:</strong> {{date}}</div>
  <div><strong>Payment Terms:</strong> {{paymentTerms}}</div>
</div>

<div class="recipient-box">
  <div><strong>BILLED TO:</strong> {{clientName}}</div>
  <div>{{clientAddress}}</div>
  <div>Tax Identification / NRIC: {{taxNo}}</div>
  <div><strong>Re Matter:</strong> {{caseTitle}} (Ref: {{matterRef}})</div>
</div>

<table class="line-items-table">
  <thead>
    <tr>
      <th>Particulars</th>
      <th style="text-align: right;">Amount (RM)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Professional Legal Services — {{caseTitle}}</td>
      <td style="text-align: right;">{{subtotal}}</td>
    </tr>
    <tr>
      <td>Service Tax (SST 8%)</td>
      <td style="text-align: right;">{{sstAmount}}</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td style="text-align: right;"><strong>TOTAL PAYABLE:</strong></td>
      <td style="text-align: right;"><strong>{{totalAmount}}</strong></td>
    </tr>
  </tfoot>
</table>

<div class="words-box">
  <strong>AMOUNT IN WORDS:</strong> {{amountInWords}}
</div>

<div class="notes-box">
  <strong>Remittance Instructions:</strong><br />
  Please make payment to {{firmName}}.<br />
  {{bankDetails}}
</div>`,
  },
  {
    id: 'tmpl_receipt_default',
    name: 'Official Receipt Template',
    type: 'receipt',
    fileType: 'html',
    updatedAt: new Date().toISOString().split('T')[0],
    content: `<div class="doc-header">
  <div class="firm-title">{{firmName}}</div>
  <div class="firm-subtitle">{{firmSubtitle}}</div>
  <div class="firm-meta">{{firmAddress}} | Tel: {{firmPhone}}</div>
</div>
<hr class="header-divider" />

<div class="doc-title-banner">OFFICIAL RECEIPT</div>

<div class="doc-meta-bar">
  <div><strong>Receipt No.:</strong> {{receiptNo}}</div>
  <div><strong>Date:</strong> {{date}}</div>
</div>

<div class="recipient-box">
  <div><strong>RECEIVED FROM:</strong> {{clientName}} (Tax ID: {{taxNo}})</div>
  <div><strong>THE SUM OF:</strong> {{amountInWords}} (<strong>{{totalAmount}}</strong>)</div>
  <div><strong>BEING PAYMENT FOR:</strong> Invoice {{invoiceNo}} — {{caseTitle}}</div>
</div>

<div class="notes-box">
  <strong>Payment Channel:</strong> Online Bank Transfer / Client Trust Deposit<br />
  <strong>Bank Details:</strong> {{bankDetails}}
</div>`,
  },
];

// Helper to retrieve settings from localStorage or fallback to default
export function getPracticeSettings(): PracticeSettings {
  try {
    const saved = localStorage.getItem('shco_practice_settings');
    if (saved) {
      return { ...DEFAULT_PRACTICE_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load practice settings:', e);
  }
  return DEFAULT_PRACTICE_SETTINGS;
}

export function savePracticeSettings(settings: PracticeSettings): void {
  try {
    localStorage.setItem('shco_practice_settings', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('shco-practice-settings-updated'));
  } catch (e) {
    console.error('Failed to save practice settings:', e);
  }
}

// Helper to retrieve templates from localStorage or fallback to default
export function getDocumentTemplates(): DocumentTemplate[] {
  try {
    const saved = localStorage.getItem('shco_doc_templates');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load document templates:', e);
  }
  return DEFAULT_TEMPLATES;
}

export function saveDocumentTemplate(template: DocumentTemplate): void {
  try {
    const templates = getDocumentTemplates();
    const idx = templates.findIndex((t) => t.id === template.id || t.type === template.type);
    if (idx >= 0) {
      templates[idx] = { ...template, updatedAt: new Date().toISOString().split('T')[0] };
    } else {
      templates.push({ ...template, updatedAt: new Date().toISOString().split('T')[0] });
    }
    localStorage.setItem('shco_doc_templates', JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save document template:', e);
  }
}

// Placeholder mapping engine
export function renderTemplateContent(
  templateHtml: string,
  recordData: Record<string, any>,
  settings: PracticeSettings = getPracticeSettings()
): string {
  let rendered = templateHtml;

  // Format bank account placeholders
  const accounts = settings.bankAccounts && settings.bankAccounts.length > 0
    ? settings.bankAccounts
    : DEFAULT_PRACTICE_SETTINGS.bankAccounts || [];

  const defaultOffice = accounts.find((a) => a.isDefaultOffice) || accounts.find((a) => a.accountType === 'Office Operating') || accounts[0];
  const defaultClient = accounts.find((a) => a.isDefaultClient) || accounts.find((a) => a.accountType === 'Client Trust') || accounts[1] || accounts[0];

  const formattedOfficeBank = defaultOffice ? `${defaultOffice.bankName} (${defaultOffice.accountNo}) — ${defaultOffice.accountName}` : `${settings.bankName} (${settings.bankAccountNo})`;
  const formattedClientBank = defaultClient ? `${defaultClient.bankName} (${defaultClient.accountNo}) — ${defaultClient.accountName}` : `${settings.bankName} (${settings.bankAccountNo})`;
  const formattedBankDetails = defaultOffice && defaultClient
    ? `Office Operating: ${defaultOffice.bankName} (${defaultOffice.accountNo}) | Client Trust (SAR 1990): ${defaultClient.bankName} (${defaultClient.accountNo})`
    : `${settings.bankName} (${settings.bankAccountNo})`;

  const formattedAllAccountsList = accounts.map((a) => `<div style="margin-bottom:4px;"><strong>[${a.accountType.toUpperCase()}] ${a.bankName}:</strong> ${a.accountNo} (${a.accountName}) ${a.swiftCode ? `| SWIFT: ${a.swiftCode}` : ''}</div>`).join('');

  const mappings: Record<string, string> = {
    '{{clientName}}': recordData.clientName || recordData.name || 'CLIENT NAME',
    '{{clientAddress}}': recordData.clientAddress || recordData.address || 'Address on file, Kuala Lumpur',
    '{{clientPhone}}': recordData.clientPhone || recordData.phone || recordData.contactPersonPhone || '+6012-345 6789',
    '{{clientEmail}}': recordData.clientEmail || recordData.email || recordData.contactPersonEmail || 'client@example.com',
    '{{icNo}}': recordData.icNo || recordData.registrationNo || 'N/A',
    '{{taxNo}}': recordData.taxSstNo || recordData.taxNo || recordData.icNo || 'SG 850714145231',
    '{{tinNo}}': recordData.taxSstNo || recordData.taxNo || 'SG 850714145231',
    '{{ssmNo}}': recordData.registrationNo || 'N/A',
    '{{date}}': recordData.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    '{{documentNo}}': recordData.documentNo || recordData.id || 'DOC-2026-001',
    '{{invoiceNo}}': recordData.invoiceNo || recordData.id || 'INV-2026-0042',
    '{{quotationNo}}': recordData.quotationNo || recordData.id || 'QUOT-2026-0088',
    '{{receiptNo}}': recordData.receiptNo || recordData.id || 'OR-2026-0019',
    '{{caseTitle}}': recordData.caseTitle || recordData.matter || recordData.subject || 'General Corporate Legal Representation',
    '{{matterRef}}': recordData.matterRef || recordData.caseId || 'SHC/LIT/2026/08',
    '{{subtotal}}': recordData.subtotal ? `RM ${Number(recordData.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'RM 15,000.00',
    '{{sstAmount}}': recordData.sstAmount ? `RM ${Number(recordData.sstAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'RM 1,200.00',
    '{{totalAmount}}': recordData.total ? `RM ${Number(recordData.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'RM 17,050.00',
    '{{amountInWords}}': recordData.amountInWords || 'RINGGIT MALAYSIA SEVENTEEN THOUSAND AND FIFTY ONLY',
    '{{firmName}}': settings.firmName,
    '{{firmSubtitle}}': settings.firmSubtitle,
    '{{firmAddress}}': settings.address,
    '{{firmPhone}}': settings.phone,
    '{{firmEmail}}': settings.email,
    '{{barRef}}': settings.barRef,
    '{{sstNo}}': settings.sstNo,
    '{{bankDetails}}': formattedBankDetails,
    '{{officeBank}}': formattedOfficeBank,
    '{{clientTrustBank}}': formattedClientBank,
    '{{allBankAccounts}}': formattedAllAccountsList,
    '{{partnerName}}': recordData.partnerName || 'SYAFIQAH HAMIZAD',
    '{{paymentTerms}}': '14 Days Net',
  };

  // Replace all placeholders
  Object.keys(mappings).forEach((key) => {
    const val = mappings[key];
    const regex = new RegExp(key.replace(/[{()}]/g, '\\$&'), 'g');
    rendered = rendered.replace(regex, val);
  });

  return rendered;
}

// Generate print-optimized CSS based on Practice Settings
export function generatePrintStyleTag(settings: PracticeSettings = getPracticeSettings()): string {
  return `
    <style id="practice-print-styles">
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap');

      .practice-doc-wrapper {
        font-family: ${settings.fontFamily}, 'Plus Jakarta Sans', serif, sans-serif !important;
        font-size: ${settings.fontSizePt}pt !important;
        line-height: ${settings.lineHeight} !important;
        color: #0F172A !important;
        background-color: #FFFFFF !important;
        padding: 24px !important;
        max-width: 800px !important;
        margin: 0 auto !important;
      }

      .practice-doc-wrapper .firm-title {
        font-family: ${settings.fontFamily}, 'Playfair Display', serif !important;
        font-size: ${settings.headingSizePt}pt !important;
        font-weight: 800 !important;
        color: ${settings.primaryColor} !important;
        letter-spacing: 0.05em !important;
        text-transform: uppercase !important;
      }

      .practice-doc-wrapper .firm-subtitle {
        font-size: ${Math.max(8, settings.fontSizePt - 2)}pt !important;
        font-weight: 700 !important;
        color: ${settings.accentColor} !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
        margin-top: 2px !important;
      }

      .practice-doc-wrapper .firm-meta {
        font-size: ${Math.max(8, settings.fontSizePt - 2.5)}pt !important;
        color: #475569 !important;
        margin-top: 2px !important;
      }

      .practice-doc-wrapper .header-divider {
        border: none !important;
        border-top: 2px solid ${settings.primaryColor} !important;
        margin: 12px 0 16px 0 !important;
      }

      .practice-doc-wrapper .doc-title-banner {
        background-color: ${settings.primaryColor} !important;
        color: #FFFFFF !important;
        font-weight: 800 !important;
        font-size: ${settings.fontSizePt + 2}pt !important;
        padding: 6px 12px !important;
        text-align: center !important;
        border-radius: 4px !important;
        margin-bottom: 12px !important;
        letter-spacing: 0.05em !important;
      }

      .practice-doc-wrapper .doc-meta-bar {
        display: flex !important;
        justify-content: space-between !important;
        background-color: #F8FAFC !important;
        border: 1px solid #E2E8F0 !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        font-size: ${settings.fontSizePt - 1}pt !important;
        margin-bottom: 12px !important;
      }

      .practice-doc-wrapper .recipient-box {
        border-left: 4px solid ${settings.accentColor} !important;
        background-color: #FAF8F2 !important;
        padding: 10px 14px !important;
        border-radius: 0 6px 6px 0 !important;
        margin-bottom: 14px !important;
        font-size: ${settings.fontSizePt - 0.5}pt !important;
      }

      .practice-doc-wrapper .matter-title {
        font-weight: 800 !important;
        color: ${settings.primaryColor} !important;
        font-size: ${settings.fontSizePt + 1}pt !important;
        background-color: #F1F5F9 !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        margin-bottom: 12px !important;
      }

      .practice-doc-wrapper .section-heading {
        font-weight: 800 !important;
        color: ${settings.primaryColor} !important;
        font-size: ${settings.fontSizePt}pt !important;
        border-bottom: 1px solid #CBD5E1 !important;
        padding-bottom: 3px !important;
        margin: 14px 0 6px 0 !important;
        text-transform: uppercase !important;
      }

      .practice-doc-wrapper .line-items-table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 14px 0 !important;
        font-size: ${settings.fontSizePt - 0.5}pt !important;
      }

      .practice-doc-wrapper .line-items-table th {
        background-color: ${settings.primaryColor} !important;
        color: #FFFFFF !important;
        padding: 8px 10px !important;
        text-align: left !important;
        font-weight: 700 !important;
      }

      .practice-doc-wrapper .line-items-table td {
        padding: 8px 10px !important;
        border-bottom: 1px solid #E2E8F0 !important;
      }

      .practice-doc-wrapper .line-items-table tfoot td {
        border-top: 2px solid ${settings.primaryColor} !important;
        font-weight: 800 !important;
        font-size: ${settings.fontSizePt + 0.5}pt !important;
        background-color: #F8FAFC !important;
      }

      .practice-doc-wrapper .words-box,
      .practice-doc-wrapper .notes-box,
      .practice-doc-wrapper .terms-box {
        background-color: #FAF8F2 !important;
        border: 1px solid #E1DCCF !important;
        padding: 10px 12px !important;
        border-radius: 6px !important;
        margin-top: 12px !important;
        font-size: ${settings.fontSizePt - 1}pt !important;
      }

      .practice-doc-wrapper .execution-block {
        display: flex !important;
        justify-content: space-between !important;
        margin-top: 30px !important;
        padding-top: 16px !important;
        border-top: 1px solid #E2E8F0 !important;
        font-size: ${settings.fontSizePt - 1}pt !important;
      }

      .practice-doc-wrapper .sign-col {
        width: 45% !important;
      }

      .practice-doc-wrapper .sign-line {
        height: 45px !important;
        border-bottom: 1px solid #0F172A !important;
        margin-bottom: 6px !important;
      }

      @media print {
        body {
          background-color: #FFFFFF !important;
        }
        .practice-doc-wrapper {
          padding: 0 !important;
          max-width: 100% !important;
        }
        .no-print {
          display: none !important;
        }
      }
    </style>
  `;
}
