import React from 'react';
import { useApp } from '../../../context/AppContext';
import { DEFAULT_PRACTICE_SETTINGS, DOC_NUMBERING, type FirmBankAccount } from '../../../services/templateService';
import { css, S, Txt, type SettingsCtx } from './settingsShared';

const REF_RULES: [string, string, string, string][] = [['1', 'Firm', 'SHC', 'Always SHC.'], ['2', 'Partner(s) in charge', 'SH or SH/ZA', 'Partner codes. '], ['3', 'Lawyer(s) in charge', 'NM', 'Optional; skipped if none. A partner on the file cannot also be picked as lawyer.'], ['4', 'Matter code', 'L', 'Picked from the matter codes registered per practice area (Practice areas & codes tab), e.g. L, CONV · MOT · POC · DOC · LOAN, EST · OFS · VO · LA · PRB, CORP, CR · YBGK.'], ['5', 'Client initials', 'QA', 'First letter of the first two words of the client name, ignoring Sdn Bhd, Bhd, Datuk, Dato’, Dr., Encik, Puan, Tan Sri, Syarikat. Several clients are joined with /. Can be corrected at intake.'], ['6', 'Running no.', '001', 'Next firm-wide case number, given automatically.'], ['7', 'Month-year', '08-26', 'Month and year of the file opening date (MM-YY). Backdating allowed.']];

const TYPE_LABEL: Record<FirmBankAccount['accountType'], string> = { 'Office Operating': 'Office', 'Client Trust': 'Client account', Disbursement: 'Disbursement', 'Fixed Deposit Stakeholder': 'Fixed deposit', 'Syariah Escrow': 'Syariah escrow', Other: 'Other' };
const typeFromLabel = (v: string): FirmBankAccount['accountType'] =>
  /client|trust/i.test(v) ? 'Client Trust' : /disburse/i.test(v) ? 'Disbursement' : /fixed|\bfd\b/i.test(v) ? 'Fixed Deposit Stakeholder' : /escrow|syariah/i.test(v) ? 'Syariah Escrow' : /office|operat/i.test(v) ? 'Office Operating' : 'Other';
const fmtAmt = (n?: number) => (n == null ? '0' : Number(n).toLocaleString('en-MY', { maximumFractionDigits: 2 }));

export const BanksTab = ({ C }: { C: SettingsCtx }) => {
  const { quotations = [], invoices = [], receipts = [], paymentVouchers = [], manualJournals = [] } = useApp();
  const s = C.settings;
  const banks: FirmBankAccount[] = (s.bankAccounts && s.bankAccounts.length ? s.bankAccounts : DEFAULT_PRACTICE_SETTINGS.bankAccounts || []);
  const shown = banks.filter((b) => b.isActive !== false);
  const ob = s.bankOpeningBalances || {};

  const saveBank = (id: string, patch: Partial<FirmBankAccount>, what: string) => {
    C.save({ bankAccounts: banks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }, 'Bank Account Changed', what);
  };
  const addBank = () => {
    const nb: FirmBankAccount = { id: `bank_${Date.now()}`, bankName: '', accountName: '', accountNo: '', accountType: 'Office Operating', typeLabel: 'Office', isActive: true };
    C.save({ bankAccounts: [...banks, nb] }, 'Bank Account Added', 'New office account row');
    C.msg('Account added · fill in its details');
  };

  // "next" running number per document kind, counted from the real records.
  const yy = String(new Date().getFullYear()).slice(-2);
  const pvKind = (v: { formNo?: string; accountSet: string }, k: 'O' | 'C' | 'D') => (v.formNo ? v.formNo.startsWith('PV-' + k) : k === 'C' ? v.accountSet === 'CLIENT' : k === 'O' && v.accountSet === 'OFFICE');
  const counts: Record<string, number> = {
    quotation: quotations.filter((q) => q.documentType !== 'Proforma').length,
    proforma: quotations.filter((q) => q.documentType === 'Proforma').length,
    invoice: invoices.length,
    receiptOffice: receipts.filter((r) => r.accountSet === 'OFFICE').length,
    receiptClient: receipts.filter((r) => r.accountSet === 'CLIENT').length,
    pvOffice: paymentVouchers.filter((v) => pvKind(v, 'O')).length,
    pvClient: paymentVouchers.filter((v) => pvKind(v, 'C')).length,
    pvDisb: paymentVouchers.filter((v) => pvKind(v, 'D')).length,
    journal: manualJournals.length,
  };
  const fmtNext = (f: string, n: number) => f.replace('{YYYY}', String(new Date().getFullYear())).replace('{YY}', yy).replace('{0000}', String(n).padStart(4, '0'));

  const sstIdx = !s.sstRegistered ? 0 : Math.abs((Number(s.sstRate) || 0) - 0.06) < 0.001 ? 1 : 2;
  const setSst = (i: number) => {
    const label = ['Not registered', 'SST 6%', 'SST 8%'][i];
    C.save(i === 0 ? { sstRegistered: false } : { sstRegistered: true, sstRate: i === 1 ? 0.06 : 0.08 }, 'SST Setting Changed', label);
    C.msg('SST: ' + label);
  };

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>File reference (Our Ref)</strong><span style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:9px;background:#F0F2F5;color:#5B6478')}>fixed rules · not editable here</span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>built automatically when a new file is opened (New case form)</span></div>
        <div style={css('display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #F0F2F5')}><span style={css(S.fieldLabel)}>Example</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:15px;font-weight:700;color:#16223A')}>SHC/SH/NM/L/QA/0001/08-26</span><span style={css('font-size:10.5px;color:#5B6478')}>two partners and no lawyer: SHC/SH/ZA/SPA/AF/0002/09-26</span></div>
        {REF_RULES.map(([n, part, ex, rule]) => <div key={n} style={css('display:grid;grid-template-columns:28px 150px 110px minmax(0,1fr);gap:10px;align-items:start;padding:7px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:10.5px;font-weight:800;color:#94A3B8')}>{n}</span><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{part}</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:11px;font-weight:700;color:#2F5680')}>{ex}</span><span style={css('font-size:10.5px;line-height:1.5;color:#5B6478')}>{rule}</span></div>)}
        <div style={css(S.foot)}>Empty parts are skipped. Matter codes come from the list registered per practice area. Screens must read the file’s saved practice area and matter code, never split the ref text.</div>
      </div>

      <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Bank accounts</strong><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>Opening balances as at</span><Txt value={s.bankOpeningBalancesAsAt ? s.bankOpeningBalancesAsAt.split('-').reverse().join('.') : ''} onCommit={(v) => { const m = String(v).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/) || null; const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : ''; if (String(v).trim() && !iso) { C.msg('Type the date as dd.mm.yyyy'); return; } C.save({ bankOpeningBalancesAsAt: iso || undefined }, 'Opening Balance Date Changed', iso || 'cleared'); }} style={'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;width:100px;text-align:left'} /><button type="button" onClick={addBank} style={css('margin-left:8px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Add account</button></div>
        <div style={css('display:grid;grid-template-columns:130px minmax(0,1.3fr) minmax(0,1fr) 150px 120px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Type</span><span>Account name</span><span>Bank</span><span>Account no.</span><span style={css('text-align:right')}>Opening balance</span></div>
        {shown.length === 0 && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No bank accounts yet. Add the office and client accounts with “+ Add account”.</div>}
        {shown.map((b) => {
          const label = b.typeLabel || TYPE_LABEL[b.accountType] || b.accountType;
          const IN = 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;text-align:';
          return (
            <div key={b.id} style={css('display:grid;grid-template-columns:130px minmax(0,1.3fr) minmax(0,1fr) 150px 120px;gap:10px;align-items:center;padding:6px 14px;border-bottom:1px solid #F0F2F5')}>
              <Txt value={label} onCommit={(v) => saveBank(b.id, { typeLabel: v.trim(), accountType: typeFromLabel(v) }, (b.accountName || b.id) + ' type: ' + label + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={b.accountName} onCommit={(v) => saveBank(b.id, { accountName: v.trim() }, 'Account name: ' + (b.accountName || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={b.bankName} onCommit={(v) => saveBank(b.id, { bankName: v.trim() }, (b.accountName || b.id) + ' bank: ' + (b.bankName || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={b.accountNo} onCommit={(v) => saveBank(b.id, { accountNo: v.trim() }, (b.accountName || b.id) + ' account no.: ' + (b.accountNo || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={fmtAmt(ob[b.id])} onCommit={(v) => { const n = Number(String(v).replace(/[^0-9.-]/g, '')) || 0; C.save({ bankOpeningBalances: { ...ob, [b.id]: n } }, 'Opening Balance Changed', (b.accountName || b.id) + ': RM ' + fmtAmt(ob[b.id]) + ' → RM ' + fmtAmt(n)); }} style={IN + 'right'} />
            </div>
          );
        })}
      </div>

      <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start')}>
        <div style={css(S.card)}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Document numbering</strong></div>
          {DOC_NUMBERING.map(([k, label, def]) => {
            const fmt = s.docNumbering?.[k] || def;
            return (
              <div key={k} style={css('display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:11.5px;font-weight:600;color:#16223A')}>{label}</span><Txt value={fmt} onCommit={(v) => { if (!v.trim()) return; C.save({ docNumbering: { ...(s.docNumbering || {}), [k]: v.trim() } }, 'Numbering Format Changed', label + ': ' + fmt + ' → ' + v.trim()); C.msg(label + ' numbering saved'); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;font-family:ui-monospace, Menlo, monospace" /><span></span><span style={css('font-size:10.5px;color:#5B6478')}>next: <strong style={css('color:#16223A;font-family:ui-monospace, Menlo, monospace')}>{fmtNext(fmt, (counts[k] || 0) + 1)}</strong></span></div>
            );
          })}
          <div style={css(S.foot)}>{'{YY} year · {0000} running number · office and client account are numbered separately (SAR 1990).'}</div>
        </div>
        <div style={css(S.card)}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>SST</strong></div>
          <div style={css('padding:12px 14px;display:flex;flex-direction:column;gap:10px')}>
            <div style={css('display:flex;gap:4px')}>{['Not registered', 'SST 6%', 'SST 8%'].map((label, i) => { const on = sstIdx === i; return <button key={label} type="button" onClick={() => setSst(i)} style={css(`border-radius:14px;padding:4px 12px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}</div>
            <label style={css('display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(S.fieldLabel)}>SST reg. no.</span><Txt value={s.sstNo || ''} placeholder="W10-XXXX-XXXXXXXX" onCommit={(v) => C.save({ sstNo: v.trim() }, 'SST Reg. No. Changed', (s.sstNo || '—') + ' → ' + (v.trim() || '—'))} style="border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A" /></label>
            <label style={css('display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(S.fieldLabel)}>Start date</span><Txt value={s.sstStartDate || ''} placeholder="dd.mm.yyyy" onCommit={(v) => { const t = v.trim(); if (t && !/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(t)) return C.msg('Enter the start date as dd.mm.yyyy'); C.save({ sstStartDate: t }, 'SST Start Date Changed', (s.sstStartDate || '—') + ' → ' + (t || '—')); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A" /></label>
            <span style={css('font-size:10.5px;line-height:1.5;color:#5B6478')}>{sstIdx ? 'From the start date, new invoices become TAX INVOICE and charge SST on professional fees and reimbursements. Disbursements stay SST-free. Earlier documents are not changed.' : 'Documents show "SST: Not applicable". Switch on when the firm is registered.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
