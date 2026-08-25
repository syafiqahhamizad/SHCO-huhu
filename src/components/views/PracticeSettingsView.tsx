import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getPracticeSettings,
  savePracticeSettings,
  getDocumentTemplates,
  saveDocumentTemplate,
  renderTemplateContent,
  generatePrintStyleTag,
  PracticeSettings,
  DocumentTemplate,
  FirmBankAccount,
  DEFAULT_PRACTICE_SETTINGS,
} from '../../services/templateService';
import {
  Palette,
  Upload,
  FileText,
  Type,
  Check,
  Eye,
  RotateCcw,
  Sparkles,
  Image,
  Code,
  FileCode,
  Copy,
  Layers,
  HelpCircle,
  Download,
  Printer,
  ShieldCheck,
  Building,
  Plus,
  Trash2,
  Building2,
  CreditCard,
  Star,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export const PracticeSettingsView: React.FC = () => {
  const { showToast, cases } = useApp();

  // Practice Settings State
  const [settings, setSettings] = useState<PracticeSettings>(() => getPracticeSettings());
  const [templates, setTemplates] = useState<DocumentTemplate[]>(() => getDocumentTemplates());
  
  // Selected Template for Editing
  const [activeDocType, setActiveDocType] = useState<'engagement' | 'quotation' | 'invoice' | 'receipt'>('engagement');
  const [templateContent, setTemplateContent] = useState('');
  const [previewTab, setPreviewTab] = useState<'preview' | 'code' | 'mapping'>('preview');

  // Practice Area State
  const practiceAreasList = settings.practiceAreas && settings.practiceAreas.length > 0
    ? settings.practiceAreas
    : DEFAULT_PRACTICE_SETTINGS.practiceAreas || [];

  const [isAddPaOpen, setIsAddPaOpen] = useState(false);
  const [newPaName, setNewPaName] = useState('');
  const [newPaCode, setNewPaCode] = useState('');
  const [newPaColor, setNewPaColor] = useState('bg-[#16223A] text-amber-300 border-[#A9814A]');
  const matterCodesList = settings.matterCodes && settings.matterCodes.length > 0
    ? settings.matterCodes
    : DEFAULT_PRACTICE_SETTINGS.matterCodes || [];
  const [newMatterName, setNewMatterName] = useState('');
  const [newMatterCode, setNewMatterCode] = useState('');
  const [newMatterPracticeArea, setNewMatterPracticeArea] = useState('Conveyancing');

  // Bank Accounts state and modal control
  const bankAccounts = settings.bankAccounts && settings.bankAccounts.length > 0
    ? settings.bankAccounts
    : DEFAULT_PRACTICE_SETTINGS.bankAccounts || [];

  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [newBank, setNewBank] = useState<Partial<FirmBankAccount>>({
    bankName: 'CIMB Bank Berhad',
    accountName: '',
    accountNo: '',
    swiftCode: '',
    branch: '',
    accountType: 'Office Operating',
    glAccountCode: '1010',
    isDefaultOffice: false,
    isDefaultClient: false,
    notes: '',
  });

  // Load active template content when doc type changes
  useEffect(() => {
    const tmpl = templates.find((t) => t.type === activeDocType);
    if (tmpl) {
      setTemplateContent(tmpl.content);
    }
  }, [activeDocType, templates]);

  // Handle Logo Upload (Base64)
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('Image file size too large. Please select an image under 3MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      setSettings((prev) => ({ ...prev, logoUrl: base64Str }));
      showToast('Company logo uploaded successfully (Base64 encoded)', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Handle Custom Word (.docx/txt/html) Template File Upload
  const handleTemplateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      let rawText = event.target?.result as string;
      if (!rawText) return;

      // Clean up uploaded content into an HTML structure if raw text
      if (extension === 'txt' || extension === 'docx') {
        // Simple paragraph wrapper for raw text uploaded files
        const paragraphs = rawText
          .split('\n')
          .filter((p) => p.trim().length > 0)
          .map((p) => `<p>${p.trim()}</p>`)
          .join('\n');
        rawText = `<div class="uploaded-doc-content">\n${paragraphs}\n</div>`;
      }

      setTemplateContent(rawText);

      // Save template
      const updatedTmpl: DocumentTemplate = {
        id: `tmpl_${activeDocType}_custom`,
        name: `Custom Uploaded ${activeDocType.toUpperCase()} Template (${file.name})`,
        type: activeDocType,
        content: rawText,
        fileType: (extension as any) || 'html',
        fileName: file.name,
        updatedAt: new Date().toISOString().split('T')[0],
      };

      saveDocumentTemplate(updatedTmpl);
      setTemplates(getDocumentTemplates());
      showToast(`Uploaded custom ${extension?.toUpperCase()} template for ${activeDocType.toUpperCase()}!`, 'success');
    };

    if (extension === 'docx') {
      reader.readAsText(file); // Reads text stream from docx/txt
    } else {
      reader.readAsText(file);
    }
  };

  // Bank Account Handlers
  const handleAddBankAccount = () => {
    if (!newBank.accountName || !newBank.accountNo || !newBank.bankName) {
      showToast('Please fill in the Bank Name, Account Name, and Account Number.', 'error');
      return;
    }

    const createdBank: FirmBankAccount = {
      id: `bank_${Date.now()}`,
      bankName: newBank.bankName || 'CIMB Bank Berhad',
      accountName: newBank.accountName.toUpperCase().trim(),
      accountNo: newBank.accountNo.trim(),
      swiftCode: newBank.swiftCode?.toUpperCase().trim() || '',
      branch: newBank.branch?.trim() || 'Kuala Lumpur HQ',
      accountType: (newBank.accountType as any) || 'Office Operating',
      glAccountCode: newBank.glAccountCode?.trim() || (newBank.accountType === 'Client Trust' ? '1020' : '1010'),
      isDefaultOffice: !!newBank.isDefaultOffice,
      isDefaultClient: !!newBank.isDefaultClient,
      notes: newBank.notes?.trim() || '',
      isActive: true,
    };

    let updatedList = [...bankAccounts];

    if (createdBank.isDefaultOffice) {
      updatedList = updatedList.map((b) => ({ ...b, isDefaultOffice: false }));
    }
    if (createdBank.isDefaultClient) {
      updatedList = updatedList.map((b) => ({ ...b, isDefaultClient: false }));
    }

    updatedList.push(createdBank);

    const updatedSettings = { ...settings, bankAccounts: updatedList };
    setSettings(updatedSettings);
    savePracticeSettings(updatedSettings);

    showToast(`Added ${createdBank.bankName} (${createdBank.accountType}) successfully!`, 'success');
    setIsAddBankOpen(false);
    setNewBank({
      bankName: 'CIMB Bank Berhad',
      accountName: '',
      accountNo: '',
      swiftCode: '',
      branch: '',
      accountType: 'Office Operating',
      glAccountCode: '1010',
      isDefaultOffice: false,
      isDefaultClient: false,
      notes: '',
    });
  };

  const handleSetDefaultOffice = (id: string) => {
    const updatedList = bankAccounts.map((b) => ({
      ...b,
      isDefaultOffice: b.id === id,
    }));
    const updatedSettings = { ...settings, bankAccounts: updatedList };
    setSettings(updatedSettings);
    savePracticeSettings(updatedSettings);
    showToast('Updated default Office Operating Account', 'info');
  };

  const handleSetDefaultClient = (id: string) => {
    const updatedList = bankAccounts.map((b) => ({
      ...b,
      isDefaultClient: b.id === id,
    }));
    const updatedSettings = { ...settings, bankAccounts: updatedList };
    setSettings(updatedSettings);
    savePracticeSettings(updatedSettings);
    showToast('Updated default Client Trust Account (SAR 1990 compliant)', 'info');
  };

  const handleDeleteBankAccount = (id: string) => {
    if (bankAccounts.length <= 1) {
      showToast('You must maintain at least one active bank account.', 'error');
      return;
    }
    const updatedList = bankAccounts.filter((b) => b.id !== id);
    const updatedSettings = { ...settings, bankAccounts: updatedList };
    setSettings(updatedSettings);
    savePracticeSettings(updatedSettings);
    showToast('Bank account removed.', 'info');
  };

  // Save Settings
  const handleSaveSettings = () => {
    savePracticeSettings(settings);

    // Save current template content
    const currentTmpl = templates.find((t) => t.type === activeDocType);
    if (currentTmpl) {
      saveDocumentTemplate({
        ...currentTmpl,
        content: templateContent,
      });
      setTemplates(getDocumentTemplates());
    }

    showToast('Practice Settings, Fonts, Branding & Custom Templates Saved!', 'success');
  };

  // Sample data for template generator mapping preview
  const sampleRecordData = {
    clientName: 'DATO’ DR. AMIRUL MUKMININ BIN AZMAN',
    clientAddress: 'No. 88, Jalan Medang Serai, Bukit Damansara, 50490 Kuala Lumpur',
    clientPhone: '+6012-398 7654',
    clientEmail: 'amirul.azman@holding.com.my',
    icNo: '820419-14-5511',
    taxNo: 'IG 820419145511',
    tinNo: 'IG 820419145511',
    ssmNo: '202401098812 (1589012-X)',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    documentNo: 'SHC/ENG/2026/0091',
    invoiceNo: 'INV-2026-0042',
    quotationNo: 'QUOT-2026-0088',
    receiptNo: 'OR-2026-0019',
    caseTitle: 'High Court Commercial Action — Breach of Joint Venture Agreement',
    matterRef: 'SHC/LIT/CIV/2026/04',
    subtotal: 18500,
    sstAmount: 1480,
    total: 19980,
    amountInWords: 'RINGGIT MALAYSIA NINETEEN THOUSAND NINE HUNDRED AND EIGHTY ONLY',
    partnerName: 'SYAFIQAH HAMIZAD',
  };

  const renderedPreviewHtml = renderTemplateContent(templateContent, sampleRecordData, settings);

  const availablePlaceholders = [
    { tag: '{{clientName}}', desc: 'Full Client Legal Name' },
    { tag: '{{clientAddress}}', desc: 'Client Service Address' },
    { tag: '{{clientPhone}}', desc: 'Client Phone / WhatsApp' },
    { tag: '{{clientEmail}}', desc: 'Client Primary Email' },
    { tag: '{{icNo}}', desc: 'NRIC / SSM Company Reg No' },
    { tag: '{{taxNo}}', desc: 'LHDN Tax File (IG / C / E / SG)' },
    { tag: '{{date}}', desc: 'Document Issuance Date' },
    { tag: '{{documentNo}}', desc: 'Document Reference Number' },
    { tag: '{{caseTitle}}', desc: 'Matter / Action Subject' },
    { tag: '{{matterRef}}', desc: 'Internal Case Ref File' },
    { tag: '{{subtotal}}', desc: 'Fee Amount before SST (RM)' },
    { tag: '{{sstAmount}}', desc: 'Service Tax 8% (RM)' },
    { tag: '{{totalAmount}}', desc: 'Total Amount Payable (RM)' },
    { tag: '{{amountInWords}}', desc: 'Ringgit in Words' },
    { tag: '{{firmName}}', desc: 'Firm Master Legal Name' },
    { tag: '{{firmAddress}}', desc: 'Official Office Address' },
    { tag: '{{firmPhone}}', desc: 'Office Telephone' },
    { tag: '{{firmEmail}}', desc: 'Official Domain Email' },
    { tag: '{{barRef}}', desc: 'Bar Council Ref Number' },
    { tag: '{{sstNo}}', desc: 'SST License Number' },
    { tag: '{{bankDetails}}', desc: 'Combined Default Office & Client Trust Bank Accounts' },
    { tag: '{{officeBank}}', desc: 'Default Office Operating Account' },
    { tag: '{{clientTrustBank}}', desc: 'Default Client Trust Account (SAR 1990)' },
    { tag: '{{allBankAccounts}}', desc: 'HTML List of All Firm Bank Accounts' },
    { tag: '{{partnerName}}', desc: 'Handling Partner Name' },
    { tag: '{{paymentTerms}}', desc: 'Invoice Payment Due Days' },
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Inject Dynamic Print Styles */}
      <div dangerouslySetInnerHTML={{ __html: generatePrintStyleTag(settings) }} />

      {/* Top Banner */}
      <div className="bg-[#16223A] text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#A9814A]/20 border border-[#A9814A]/40 rounded-lg">
            <Palette className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-amber-200">
              Practice Settings &amp; Custom Document Template Engine
            </h1>
            <p className="text-xs text-slate-300">
              Configure firm logo, custom typography, print styles, and upload Microsoft Word / HTML document templates with placeholder auto-mapping.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          className="bg-amber-400 hover:bg-amber-300 text-[#16223A] font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
        >
          <Check className="w-4 h-4 text-[#16223A]" />
          <span>Save Practice Branding &amp; Templates</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Branding, Colors & Typography Settings */}
        <div className="lg:col-span-5 space-y-4">
          {/* Company Logo Upload & Brand Colors Card */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] border-b border-slate-200 pb-2 flex items-center gap-2">
              <Image className="w-4 h-4 text-[#A9814A]" />
              <span>1. Firm Logo &amp; Color Scheme</span>
            </h3>

            {/* Logo Upload */}
            <div>
              <label className="font-bold text-slate-700 uppercase block mb-1">Company / Firm Logo Image</label>
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 border border-slate-200 rounded-lg">
                <div className="w-14 h-14 bg-white border border-slate-300 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-[#16223A] text-amber-300 font-serif font-bold text-xs flex items-center justify-center border border-amber-400">
                      SH
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <label className="bg-[#16223A] hover:bg-[#1F2E4D] text-white text-[11px] font-bold px-3 py-1.5 rounded cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-amber-300" />
                    <span>Upload Logo Image (PNG/JPG)</span>
                    <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                  </label>
                  <p className="text-[9.5px] text-slate-500">Converts image to Base64 URI for print embedding</p>
                </div>
              </div>
            </div>

            {/* Logo Image URL Option */}
            <div>
              <label className="font-bold text-slate-700 uppercase block mb-1">Or Direct Logo Image URL</label>
              <input
                type="text"
                value={settings.logoUrl}
                onChange={(e) => setSettings((prev) => ({ ...prev, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png or data:image/png;base64,..."
                className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono"
              />
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Header &amp; Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Secondary Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Color Preset Swatches */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Quick Palette Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Navy & Gold', p: '#16223A', a: '#A9814A' },
                  { name: 'Burgundy Classic', p: '#4A1521', a: '#8C6239' },
                  { name: 'Forest Legal', p: '#14382B', a: '#C29B38' },
                  { name: 'Charcoal Modern', p: '#1E293B', a: '#0284C7' },
                  { name: 'Royal Emerald', p: '#064E3B', a: '#D97706' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        primaryColor: preset.p,
                        accentColor: preset.a,
                      }))
                    }
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.p }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.a }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Font Family, Sizes & Structure */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] border-b border-slate-200 pb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-[#A9814A]" />
              <span>2. Typography, Font Sizes &amp; Page Structure</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 uppercase block mb-1">Document Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-[#16223A] cursor-pointer"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Modern Clean)</option>
                  <option value="Playfair Display">Playfair Display (Serif Display Header)</option>
                  <option value="Cinzel">Cinzel (Classic Roman Legal)</option>
                  <option value="Merriweather">Merriweather (Readability Serif)</option>
                  <option value="Times New Roman">Times New Roman (Traditional Bar Council)</option>
                  <option value="Georgia">Georgia (Serif Classic)</option>
                  <option value="Calibri">Calibri / Arial (Corporate Clean)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Base Body Font Size (pt)</label>
                <select
                  value={settings.fontSizePt}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fontSizePt: Number(e.target.value) }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                >
                  <option value={9}>9 pt (Compact Density)</option>
                  <option value={10}>10 pt (Standard Business)</option>
                  <option value={11}>11 pt (Legal Standard - Recommended)</option>
                  <option value={12}>12 pt (Large Print)</option>
                  <option value={14}>14 pt (Extra Large)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Heading Font Size (pt)</label>
                <select
                  value={settings.headingSizePt}
                  onChange={(e) => setSettings((prev) => ({ ...prev, headingSizePt: Number(e.target.value) }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                >
                  <option value={14}>14 pt Heading</option>
                  <option value={16}>16 pt Heading</option>
                  <option value={18}>18 pt Heading (Standard)</option>
                  <option value={20}>20 pt Heading (Prominent)</option>
                  <option value={24}>24 pt Heading (Display)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Line Height / Spacing</label>
                <select
                  value={settings.lineHeight}
                  onChange={(e) => setSettings((prev) => ({ ...prev, lineHeight: Number(e.target.value) }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                >
                  <option value={1.3}>1.3 (Compact)</option>
                  <option value={1.5}>1.5 (Standard Legal)</option>
                  <option value={1.8}>1.8 (Spacious / Double)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-1">Header Layout Structure</label>
                <select
                  value={settings.headerStyle}
                  onChange={(e) => setSettings((prev) => ({ ...prev, headerStyle: e.target.value as any }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold"
                >
                  <option value="formal">Formal Centered Classic</option>
                  <option value="modern">Modern Dual-Column</option>
                  <option value="centered">Minimalist Gold Centered</option>
                </select>
              </div>
            </div>
          </div>

          {/* Firm Identity Particulars */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] border-b border-slate-200 pb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-[#A9814A]" />
              <span>3. Firm Identity &amp; Statutory Particulars</span>
            </h3>

            <div className="space-y-2">
              <div>
                <label className="font-bold text-slate-700 uppercase block mb-0.5">Firm Legal Name</label>
                <input
                  type="text"
                  value={settings.firmName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, firmName: e.target.value }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-serif font-bold text-[#16223A]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase block mb-0.5">Office Service Address</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-0.5">Bar Ref No.</label>
                  <input
                    type="text"
                    value={settings.barRef}
                    onChange={(e) => setSettings((prev) => ({ ...prev, barRef: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 uppercase block mb-0.5">SST Reg No.</label>
                  <input
                    type="text"
                    value={settings.sstNo}
                    onChange={(e) => setSettings((prev) => ({ ...prev, sstNo: e.target.value }))}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Firm Bank Accounts Manager Card */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#A9814A]" />
                  <span>4. Firm Bank Accounts Registry</span>
                </h3>
                <p className="text-[10px] text-slate-500">
                  Solicitors' Account Rules 1990 (SAR 1990) &amp; Office Operating Accounts
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddBankOpen(!isAddBankOpen)}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 hover:text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bank Account</span>
              </button>
            </div>

            {/* Add Bank Account Expandable Form */}
            {isAddBankOpen && (
              <div className="bg-slate-50 border border-amber-300/80 p-3 rounded-lg space-y-2.5 shadow-xs animate-fadeIn">
                <div className="font-bold text-xs text-[#16223A] border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>New Firm Bank Account Particulars</span>
                  <span className="text-[9.5px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">SAR 1990 Compliant</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Bank Institution</label>
                    <select
                      value={newBank.bankName}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, bankName: e.target.value }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-[#16223A]"
                    >
                      <option value="CIMB Bank Berhad">CIMB Bank Berhad</option>
                      <option value="Bank Islam Malaysia Berhad">Bank Islam Malaysia Berhad</option>
                      <option value="Maybank Islamic Berhad">Maybank Islamic Berhad</option>
                      <option value="Malayan Banking Berhad (Maybank)">Malayan Banking Berhad (Maybank)</option>
                      <option value="Public Bank Berhad">Public Bank Berhad</option>
                      <option value="Hong Leong Bank Berhad">Hong Leong Bank Berhad</option>
                      <option value="RHB Bank Berhad">RHB Bank Berhad</option>
                      <option value="AmBank (M) Berhad">AmBank (M) Berhad</option>
                      <option value="Bank Muamalat Malaysia Berhad">Bank Muamalat Malaysia Berhad</option>
                      <option value="HSBC Bank Malaysia Berhad">HSBC Bank Malaysia Berhad</option>
                      <option value="Standard Chartered Bank Malaysia">Standard Chartered Bank</option>
                      <option value="OCBC Bank (Malaysia) Berhad">OCBC Bank</option>
                      <option value="United Overseas Bank (UOB)">UOB Bank</option>
                      <option value="Alliance Bank Malaysia Berhad">Alliance Bank</option>
                      <option value="Bank Pertanian Malaysia Berhad (Agrobank)">Agrobank</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Account Category / Type</label>
                    <select
                      value={newBank.accountType}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, accountType: e.target.value as any }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-bold"
                    >
                      <option value="Office Operating">Office Operating Account</option>
                      <option value="Client Trust">Client Account (Trust Account - SAR 1990)</option>
                      <option value="Fixed Deposit Stakeholder">Fixed Deposit Stakeholder (Sec 84 LPA)</option>
                      <option value="Syariah Escrow">Syariah Escrow Trust</option>
                      <option value="Disbursement">Disbursement Float Account</option>
                      <option value="Other">Other Office Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Account Legal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. MESSRS SYAFIQAH HAMIZAD & CO - CLIENT TRUST"
                      value={newBank.accountName}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, accountName: e.target.value }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 8001092834 or 1209384752"
                      value={newBank.accountNo}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, accountNo: e.target.value }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-[#16223A]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">SWIFT / BIC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CIMBMYKL or BIMBMYKL"
                      value={newBank.swiftCode}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, swiftCode: e.target.value }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">GL Account Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 1010 or 1020"
                      value={newBank.glAccountCode}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, glAccountCode: e.target.value }))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBank.isDefaultOffice}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, isDefaultOffice: e.target.checked }))}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Set as Default Office Operating Account</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBank.isDefaultClient}
                      onChange={(e) => setNewBank((prev) => ({ ...prev, isDefaultClient: e.target.checked }))}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Set as Default Client Trust Account</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddBankOpen(false)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBankAccount}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Save Bank Account</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Configured Firm Bank Accounts */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {bankAccounts.map((acc) => {
                const isTrust = acc.accountType === 'Client Trust' || acc.accountType === 'Syariah Escrow' || acc.accountType === 'Fixed Deposit Stakeholder';
                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isTrust
                        ? 'bg-purple-50/60 border-purple-200 hover:border-purple-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[#16223A] text-xs font-serif">{acc.bankName}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border uppercase ${
                              acc.accountType === 'Client Trust'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : acc.accountType === 'Office Operating'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : acc.accountType === 'Fixed Deposit Stakeholder'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {acc.accountType}
                          </span>

                          {acc.isDefaultOffice && (
                            <span className="bg-blue-600 text-white font-bold text-[9px] px-1.5 py-0.2 rounded flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                              <span>DEFAULT OFFICE</span>
                            </span>
                          )}

                          {acc.isDefaultClient && (
                            <span className="bg-purple-700 text-white font-bold text-[9px] px-1.5 py-0.2 rounded flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-amber-300" />
                              <span>DEFAULT TRUST (SAR 1990)</span>
                            </span>
                          )}
                        </div>

                        <div className="font-mono font-bold text-slate-800 text-xs tracking-wider">{acc.accountNo}</div>
                        <div className="text-[10.5px] font-medium text-slate-600">{acc.accountName}</div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-[9.5px] text-slate-500 font-mono pt-0.5">
                          {acc.swiftCode && <span>SWIFT: {acc.swiftCode}</span>}
                          {acc.branch && <span>Branch: {acc.branch}</span>}
                          {acc.glAccountCode && <span className="font-bold text-slate-700">GL: {acc.glAccountCode}</span>}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {!acc.isDefaultOffice && acc.accountType === 'Office Operating' && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultOffice(acc.id)}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[10px] font-bold cursor-pointer"
                            title="Set as default for office invoices"
                          >
                            Set Default Office
                          </button>
                        )}

                        {!acc.isDefaultClient && (acc.accountType === 'Client Trust' || acc.accountType === 'Syariah Escrow') && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultClient(acc.id)}
                            className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded text-[10px] font-bold cursor-pointer"
                            title="Set as default client trust account"
                          >
                            Set Default Trust
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const details = `${acc.bankName} | Acc No: ${acc.accountNo} | Name: ${acc.accountName}`;
                            navigator.clipboard.writeText(details);
                            showToast(`Copied ${acc.bankName} details to clipboard!`, 'info');
                          }}
                          className="p-1 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                          title="Copy account details"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBankAccount(acc.id)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded cursor-pointer"
                          title="Delete bank account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Client Consultation Booking Intake Portal Link */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <h3 className="font-serif font-bold text-sm text-[#16223A] border-b border-slate-200 pb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-[#A9814A]" />
              <span>5. Client Consultation Booking Intake Link</span>
            </h3>
            <div>
              <label className="font-bold text-slate-700 uppercase block mb-1">
                Public Consultation Intake &amp; Booking URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={settings.consultationFormLink || 'https://forms.google.com/shcolaw-consultation-intake'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, consultationFormLink: e.target.value }))}
                  placeholder="https://forms.google.com/your-firm-intake-form"
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-[#16223A]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = settings.consultationFormLink || 'https://forms.google.com/shcolaw-consultation-intake';
                    navigator.clipboard.writeText(url);
                    showToast('Client Consultation Booking Intake link copied to clipboard!');
                  }}
                  className="px-3 py-2 bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-1">
                This Google Form link will be used across the Leads management intake module for client bookings.
              </p>
            </div>
          </div>

          {/* Section 6: Practice Area & Matter Tag Registry */}
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#A9814A]" />
                  <span>6. Practice Area &amp; Matter File Tag Registry</span>
                </h3>
                <p className="text-[10px] text-slate-500">
                  Configure law practice areas, reference codes, and see active file counts by practice area tag
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPaOpen(!isAddPaOpen)}
                className="bg-[#16223A] hover:bg-[#1F2E4D] text-amber-300 hover:text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Practice Area</span>
              </button>
            </div>

            {/* Expandable Add Practice Area Form */}
            {isAddPaOpen && (
              <div className="bg-slate-50 border border-amber-300/80 p-3 rounded-lg space-y-2.5 shadow-xs">
                <div className="font-bold text-xs text-[#16223A] border-b border-slate-200 pb-1">
                  Add New Legal Practice Area
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Practice Area Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Syariah Family Law, Employment & Industrial"
                      value={newPaName}
                      onChange={(e) => setNewPaName(e.target.value)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-[#16223A]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Reference Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. FAM, EMP, IP"
                      value={newPaCode}
                      onChange={(e) => setNewPaCode(e.target.value.toUpperCase())}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-[#16223A]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddPaOpen(false)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newPaName.trim() || !newPaCode.trim()) {
                        showToast('Specify both Name and Ref Code for the new practice area.', 'error');
                        return;
                      }
                      const created = {
                        id: `pa_${Date.now()}`,
                        name: newPaName.trim(),
                        code: newPaCode.trim().toUpperCase(),
                        colorTag: 'bg-[#16223A] text-amber-300 border-[#A9814A]',
                        isCustom: true,
                      };
                      const updatedList = [...practiceAreasList, created];
                      const updatedSettings = { ...settings, practiceAreas: updatedList };
                      setSettings(updatedSettings);
                      savePracticeSettings(updatedSettings);
                      showToast(`Added Practice Area "${created.name}" (${created.code})!`, 'success');
                      setNewPaName('');
                      setNewPaCode('');
                      setIsAddPaOpen(false);
                    }}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Save Practice Area</span>
                  </button>
                </div>
              </div>
            )}

            {/* Practice Areas List with Active Matter Count Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {practiceAreasList.map((pa) => {
                const caseCount = cases.filter((c) => {
                  const t = (c.type || '').toLowerCase();
                  const ref = (c.ref || '').toLowerCase();
                  const nameL = pa.name.toLowerCase();
                  const codeL = pa.code.toLowerCase();
                  return t.includes(nameL) || t.includes(codeL) || ref.includes(`/${codeL}/`);
                }).length;

                return (
                  <div
                    key={pa.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#16223A] text-xs">{pa.name}</span>
                        <span className="px-1.5 py-0.2 bg-[#16223A] text-amber-300 rounded font-mono font-bold text-[9.5px]">
                          {pa.code}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <span>Tag: {pa.code}</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                          {caseCount} File(s)
                        </span>
                      </div>
                    </div>

                    {pa.isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          const updatedList = practiceAreasList.filter((item) => item.id !== pa.id);
                          const updatedSettings = { ...settings, practiceAreas: updatedList };
                          setSettings(updatedSettings);
                          savePracticeSettings(updatedSettings);
                          showToast(`Removed practice area "${pa.name}".`, 'info');
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                        title="Delete custom practice area"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#16223A]">Matter Code Registry</h4>
                  <p className="text-[10px] text-slate-500">Add and manage every Matter Code here. These codes generate the file reference; Practice Area only controls categorisation and intake fields.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_1fr_auto] gap-2 items-end bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div>
                  <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Matter Name *</label>
                  <input value={newMatterName} onChange={(e) => setNewMatterName(e.target.value)} placeholder="e.g. Perfection of Charge" className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Code *</label>
                  <input value={newMatterCode} onChange={(e) => setNewMatterCode(e.target.value.toUpperCase())} placeholder="e.g. POC" className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 uppercase block text-[9.5px]">Practice Area *</label>
                  <select value={newMatterPracticeArea} onChange={(e) => setNewMatterPracticeArea(e.target.value)} className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold">
                    {(practiceAreasList || []).map((area) => <option key={area.id} value={area.name}>{area.name}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newMatterName.trim() || !newMatterCode.trim()) {
                      showToast('Matter Name and Code are required.', 'error');
                      return;
                    }
                    if (matterCodesList.some((matter) => matter.code.toLowerCase() === newMatterCode.toLowerCase())) {
                      showToast('That Matter Code already exists.', 'error');
                      return;
                    }
                    const updatedSettings = {
                      ...settings,
                      matterCodes: [...matterCodesList, { id: `mc_${Date.now()}`, name: newMatterName.trim(), code: newMatterCode.trim(), practiceArea: newMatterPracticeArea }],
                    };
                    setSettings(updatedSettings);
                    savePracticeSettings(updatedSettings);
                    setNewMatterName('');
                    setNewMatterCode('');
                    showToast(`Added Matter Code ${newMatterCode.trim()}.`, 'success');
                  }}
                  className="px-3 py-1.5 bg-[#16223A] text-amber-300 rounded font-bold text-[11px] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />Add Code
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matterCodesList.map((matter) => (
                  <div key={matter.id} className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                    <div className="min-w-0">
                      <div className="font-bold text-[#16223A] text-xs truncate">{matter.name}</div>
                      <div className="text-[10px] text-slate-500">{matter.practiceArea}</div>
                    </div>
                    <span className="px-1.5 py-0.5 bg-[#16223A] text-amber-300 rounded font-mono font-bold text-[10px] shrink-0">{matter.code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Custom Word / HTML Template Uploader & Live Document Engine */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E1DCCF] p-4 rounded-xl shadow-xs space-y-3">
            {/* Template Type Selector Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div>
                <h3 className="font-serif font-bold text-sm text-[#16223A] flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#A9814A]" />
                  <span>Custom Template Uploader &amp; Placeholder Engine</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Upload Microsoft Word (.docx), HTML, or text files with &#123;&#123;placeholder&#125;&#125; tags
                </p>
              </div>

              {/* Upload Template File Button */}
              <label className="bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-300" />
                <span>Upload Custom Word/HTML File</span>
                <input
                  type="file"
                  accept=".docx,.html,.htm,.txt"
                  onChange={handleTemplateFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Document Type Selector Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'engagement', label: 'Engagement Letter' },
                { id: 'quotation', label: 'Fee Quotation' },
                { id: 'invoice', label: 'Tax Invoice' },
                { id: 'receipt', label: 'Official Receipt' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveDocType(item.id as any)}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    activeDocType === item.id
                      ? 'bg-[#16223A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* View Sub-Tabs: Live Preview vs Code Editor vs Placeholder Map */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                    previewTab === 'preview'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Print Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('code')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                    previewTab === 'code'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Edit HTML / Structure</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('mapping')}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                    previewTab === 'mapping'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Placeholder Tag Map</span>
                </button>
              </div>

              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Font: {settings.fontFamily} ({settings.fontSizePt}pt)
              </span>
            </div>

            {/* Tab 1: Live Rendered Print Preview Container */}
            {previewTab === 'preview' && (
              <div className="bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg p-6 shadow-sm overflow-auto max-h-[580px]">
                <div
                  className="practice-doc-wrapper bg-white shadow-xs rounded p-6"
                  dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}
                />
              </div>
            )}

            {/* Tab 2: HTML Structure Code Editor */}
            {previewTab === 'code' && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">
                  Edit the HTML structure or custom tags directly for this document type:
                </p>
                <textarea
                  rows={18}
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  className="w-full p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}

            {/* Tab 3: Available Placeholder Mapping Tags */}
            {previewTab === 'mapping' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Copy and paste any of these <strong>Placeholder Tags</strong> into your Microsoft Word document (.docx) or custom HTML template. When a document is generated in the system, these tags will be automatically replaced with data from the current client, case, or billing record:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {availablePlaceholders.map((ph) => (
                    <div
                      key={ph.tag}
                      className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between hover:bg-amber-50/50 hover:border-amber-300 transition-colors"
                    >
                      <div>
                        <code className="text-xs font-bold text-[#16223A] bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                          {ph.tag}
                        </code>
                        <div className="text-[10px] text-slate-500 mt-0.5">{ph.desc}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ph.tag);
                          showToast(`Copied ${ph.tag} to clipboard!`, 'info');
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                        title="Copy tag"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
