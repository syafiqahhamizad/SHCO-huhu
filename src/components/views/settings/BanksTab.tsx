import React from 'react';
import { useApp } from '../../../context/AppContext';
import { DEFAULT_PRACTICE_SETTINGS, DOC_NUMBERING, type FirmBankAccount } from '../../../services/templateService';
import { css, S, SideMenu, Txt, type SettingsCtx } from './settingsShared';
import { useRemembered } from '../../../lib/navHistory';
import { nextDocNo, validFormat } from '../../../lib/docNumbers';

const REF_RULES: [string, string, string, string][] = [['1', 'Firm', 'SHC', 'Always SHC.'], ['2', 'Partner(s) in charge', 'SH or SH/ZA', 'Partner codes. '], ['3', 'Lawyer(s) in charge', 'NM', 'Optional; skipped if none. A partner on the file cannot also be picked as lawyer.'], ['4', 'Matter code', 'L', 'Picked from the matter codes registered per practice area (Practice areas & codes tab), e.g. L, CONV · MOT · POC · DOC · LOAN, EST · OFS · VO · LA · PRB, CORP, CR · YBGK.'], ['5', 'Client initials', 'QA', 'First letter of the first two words of the client name, ignoring Sdn Bhd, Bhd, Datuk, Dato’, Dr., Encik, Puan, Tan Sri, Syarikat. Several clients are joined with /. Can be corrected at intake.'], ['6', 'Running no.', '001', 'Next firm-wide case number, given automatically.'], ['7', 'Month-year', '08-26', 'Month and year of the file opening date (MM-YY). Backdating allowed.']];

/** The kinds of bank account the firm keeps (picked from a list so they stay neat). */
const KINDS: [string, FirmBankAccount['accountType']][] = [['Office Account', 'Office Operating'], ['Client Account', 'Client Trust'], ['Disbursement Account', 'Disbursement'], ['Emergency Account', 'Other'], ['Petty Cash', 'Other'], ['Fixed Deposit Stakeholder', 'Fixed Deposit Stakeholder'], ['Syariah Escrow', 'Syariah Escrow']];
const kindOf = (b: FirmBankAccount) => {
  const t = ((b.typeLabel || '') + ' ' + (b.accountType === 'Other' ? b.accountName || '' : '')).toLowerCase();
  if (b.accountType === 'Other' && /fixed deposit|stakeholder/.test(t)) return 'Fixed Deposit Stakeholder';
  if (b.accountType === 'Other' && /escrow|syariah/.test(t)) return 'Syariah Escrow';
  if (/emergen/.test(t)) return 'Emergency Account';
  if (/petty/.test(t)) return 'Petty Cash';
  return (KINDS.find(([, at]) => at === b.accountType && at !== 'Other') || KINDS.find(([l]) => l.toLowerCase() === t))?.[0] || 'Office Account';
};
const fmtAmt = (n?: number) => (n == null ? '0' : Number(n).toLocaleString('en-MY', { maximumFractionDigits: 2 }));

export const BanksTab = ({ C }: { C: SettingsCtx }) => {
  const { quotations = [], invoices = [], receipts = [], paymentVouchers = [], manualJournals = [] } = useApp();
  const s = C.settings;
  const [sec, setSec] = useRemembered('settings.bank', 'Bank accounts');
  const banks: FirmBankAccount[] = (s.bankAccounts && s.bankAccounts.length ? s.bankAccounts : DEFAULT_PRACTICE_SETTINGS.bankAccounts || []);
  const shown = banks.filter((b) => b.isActive !== false);
  const ob = s.bankOpeningBalances || {};

  const saveBank = (id: string, patch: Partial<FirmBankAccount>, what: string) => {
    C.save({ bankAccounts: banks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }, 'Bank Account Changed', what);
  };
  const removeBank = (b: FirmBankAccount) => {
    if (!window.confirm('Remove ' + (b.accountName || kindOf(b)) + '? Entries already booked to it are kept.')) return;
    C.save({ bankAccounts: banks.map((x) => (x.id === b.id ? { ...x, isActive: false } : x)) }, 'Bank Account Removed', (b.accountName || kindOf(b)) + ' removed');
    C.msg('Account removed');
  };
  const addBank = () => {
    const nb: FirmBankAccount = { id: `bank_${Date.now()}`, bankName: '', accountName: '', accountNo: '', accountType: 'Office Operating', typeLabel: 'Office Account', isActive: true };
    C.save({ bankAccounts: [...banks, nb] }, 'Bank Account Added', 'New office account row');
    C.msg('Account added · fill in its details');
  };

  // "next" running number per document kind, counted from the real records.
  // The real next number for each document, from its format and the numbers already used.
  const year = new Date().getFullYear();
  const idsOf: Record<string, string[]> = {
    quotation: quotations.filter((q) => q.documentType !== 'Proforma').map((q) => q.id),
    proforma: quotations.filter((q) => q.documentType === 'Proforma').map((q) => q.id),
    invoice: invoices.map((x) => x.id),
    receipt: receipts.map((x) => x.id),
    voucher: paymentVouchers.map((x) => x.id),
    journal: manualJournals.map((x) => x.id),
  };
  const BUKKU: Record<string, string> = { quotation: 'QT-{YY}{0000}', proforma: 'PF-{YY}{0000}', invoice: 'IV-{YY}{0000}', receipt: 'OR-{YY}{0000}', voucher: 'PV-{YY}{0000}', journal: 'JV-{YY}{0000}' };
  const useBukku = () => {
    if (!window.confirm('Use Bukku-style numbers for NEW documents (e.g. IV-' + String(year).slice(-2) + '0013)? Old numbers stay as they are; the count carries on.')) return;
    C.save({ docNumbering: { ...(s.docNumbering || {}), ...BUKKU } }, 'Numbering Format Changed', 'Bukku style for all documents');
    C.msg('Bukku-style numbering set for new documents');
  };

  const sstIdx = !s.sstRegistered ? 0 : Math.abs((Number(s.sstRate) || 0) - 0.06) < 0.001 ? 1 : 2;
  const setSst = (i: number) => {
    const label = ['Not registered', 'SST 6%', 'SST 8%'][i];
    C.save(i === 0 ? { sstRegistered: false } : { sstRegistered: true, sstRate: i === 1 ? 0.06 : 0.08 }, 'SST Setting Changed', label);
    C.msg('SST: ' + label);
  };

  return (
    <SideMenu items={[['Bank accounts', shown.length], ['Document numbering'], ['SST'], ['File reference (Our Ref)']]} value={sec} onPick={setSec}>
      {sec === 'File reference (Our Ref)' && <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>File reference (Our Ref)</strong><span style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:9px;background:#F0F2F5;color:#5B6478')}>fixed rules · not editable here</span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>built automatically when a new file is opened (New case form)</span></div>
        <div style={css('display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #F0F2F5')}><span style={css(S.fieldLabel)}>Example</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:15px;font-weight:700;color:#16223A')}>SHC/SH/NM/L/QA/0001/08-26</span><span style={css('font-size:10.5px;color:#5B6478')}>two partners and no lawyer: SHC/SH/ZA/SPA/AF/0002/09-26</span></div>
        {REF_RULES.map(([n, part, ex, rule]) => <div key={n} style={css('display:grid;grid-template-columns:28px 150px 110px minmax(0,1fr);gap:10px;align-items:start;padding:7px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:10.5px;font-weight:800;color:#94A3B8')}>{n}</span><span style={css('font-size:11.5px;font-weight:700;color:#16223A')}>{part}</span><span style={css('font-family:ui-monospace, Menlo, monospace;font-size:11px;font-weight:700;color:#2F5680')}>{ex}</span><span style={css('font-size:10.5px;line-height:1.5;color:#5B6478')}>{rule}</span></div>)}
        <div style={css(S.foot)}>Empty parts are skipped. Matter codes come from the list registered per practice area. Screens must read the file’s saved practice area and matter code, never split the ref text.</div>
      </div>}

      {sec === 'Bank accounts' && <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Bank accounts</strong><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>Opening balances as at</span><Txt value={s.bankOpeningBalancesAsAt ? s.bankOpeningBalancesAsAt.split('-').reverse().join('.') : ''} onCommit={(v) => { const m = String(v).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/) || null; const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : ''; if (String(v).trim() && !iso) { C.msg('Type the date as dd.mm.yyyy'); return; } C.save({ bankOpeningBalancesAsAt: iso || undefined }, 'Opening Balance Date Changed', iso || 'cleared'); }} style={'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;width:100px;text-align:left'} /><button type="button" onClick={addBank} style={css('margin-left:8px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Add account</button></div>
        <div style={css('display:grid;grid-template-columns:170px minmax(0,1.3fr) minmax(0,1fr) 150px 120px 60px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Type</span><span>Account name</span><span>Bank</span><span>Account no.</span><span style={css('text-align:right')}>Opening balance</span><span></span></div>
        {shown.length === 0 && <div style={css('padding:14px;font-size:11px;color:#5B6478')}>No bank accounts yet. Add the office and client accounts with “+ Add account”.</div>}
        {shown.map((b) => {
          const label = kindOf(b);
          const IN = 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;text-align:';
          return (
            <div key={b.id} style={css('display:grid;grid-template-columns:170px minmax(0,1.3fr) minmax(0,1fr) 150px 120px 60px;gap:10px;align-items:center;padding:6px 14px;border-bottom:1px solid #F0F2F5')}>
              <select value={label} onChange={(e) => { const k = KINDS.find(([l]) => l === e.target.value)!; saveBank(b.id, { typeLabel: k[0], accountType: k[1] }, (b.accountName || b.id) + ' type: ' + label + ' → ' + k[0]); }} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 6px;font-size:11px;color:#16223A;background:#fff;font-family:inherit;min-width:0')}>{KINDS.map(([l]) => <option key={l} value={l}>{l}</option>)}</select>
              <Txt value={b.accountName} onCommit={(v) => saveBank(b.id, { accountName: v.trim() }, 'Account name: ' + (b.accountName || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={b.bankName} onCommit={(v) => saveBank(b.id, { bankName: v.trim() }, (b.accountName || b.id) + ' bank: ' + (b.bankName || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={b.accountNo} onCommit={(v) => saveBank(b.id, { accountNo: v.trim() }, (b.accountName || b.id) + ' account no.: ' + (b.accountNo || '—') + ' → ' + v.trim())} style={IN + 'left'} />
              <Txt value={fmtAmt(ob[b.id])} onCommit={(v) => { const n = Number(String(v).replace(/[^0-9.-]/g, '')) || 0; C.save({ bankOpeningBalances: { ...ob, [b.id]: n } }, 'Opening Balance Changed', (b.accountName || b.id) + ': RM ' + fmtAmt(ob[b.id]) + ' → RM ' + fmtAmt(n)); }} style={IN + 'right'} />
              <button type="button" onClick={() => removeBank(b)} style={css(S.remove)}>Remove</button>
            </div>
          );
        })}
      </div>}

      {sec === 'Document numbering' && <div style={css(S.card + ';max-width:760px')}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>Document numbering</strong></div>
          {DOC_NUMBERING.map(([k, label, def]) => {
            const fmt = s.docNumbering?.[k] || def;
            return (
              <div key={k} style={css('display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}><span style={css('font-size:11.5px;font-weight:600;color:#16223A')}>{label}</span><Txt value={fmt} onCommit={(v) => { const t = v.trim(); if (!t) return; if (!validFormat(t)) { C.msg('Put {0000} where the running number goes, e.g. IV-{YY}{0000}'); return; } C.save({ docNumbering: { ...(s.docNumbering || {}), [k]: t } }, 'Numbering Format Changed', label + ': ' + fmt + ' → ' + t); C.msg(label + ' numbering saved · new documents only'); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A;font-family:ui-monospace, Menlo, monospace" /><span></span><span style={css('font-size:10.5px;color:#5B6478')}>next: <strong style={css('color:#16223A;font-family:ui-monospace, Menlo, monospace')}>{nextDocNo(k, fmt, idsOf[k] || [], year)}</strong></span></div>
            );
          })}
          <div style={css('display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #F0F2F5')}><button type="button" onClick={useBukku} style={css(S.lightBtn)}>Use Bukku style (IV-{String(year).slice(-2)}0013)</button><span style={css('font-size:10.5px;color:#5B6478')}>or type your own above</span></div>
          <div style={css(S.foot)}>{'{YYYY} or {YY} = year · {0000} = running number (one 0 per digit). Changing a format only affects new documents; old numbers never change and the count carries on.'}</div>
        </div>}
        {sec === 'SST' && <div style={css(S.card + ';max-width:760px')}>
          <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css(S.h)}>SST</strong></div>
          <div style={css('padding:12px 14px;display:flex;flex-direction:column;gap:10px')}>
            <div style={css('display:flex;gap:4px')}>{['Not registered', 'SST 6%', 'SST 8%'].map((label, i) => { const on = sstIdx === i; return <button key={label} type="button" onClick={() => setSst(i)} style={css(`border-radius:14px;padding:4px 12px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}</div>
            <label style={css('display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(S.fieldLabel)}>SST reg. no.</span><Txt value={s.sstNo || ''} placeholder="W10-XXXX-XXXXXXXX" onCommit={(v) => C.save({ sstNo: v.trim() }, 'SST Reg. No. Changed', (s.sstNo || '—') + ' → ' + (v.trim() || '—'))} style="border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A" /></label>
            <label style={css('display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(S.fieldLabel)}>Start date</span><Txt value={s.sstStartDate || ''} placeholder="dd.mm.yyyy" onCommit={(v) => { const t = v.trim(); if (t && !/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(t)) return C.msg('Enter the start date as dd.mm.yyyy'); C.save({ sstStartDate: t }, 'SST Start Date Changed', (s.sstStartDate || '—') + ' → ' + (t || '—')); }} style="border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;color:#16223A" /></label>
            <span style={css('font-size:10.5px;line-height:1.5;color:#5B6478')}>{sstIdx ? 'From the start date, new invoices become TAX INVOICE and charge SST on professional fees and reimbursements. Disbursements stay SST-free. Earlier documents are not changed.' : 'Documents show "SST: Not applicable". Switch on when the firm is registered.'}</span>
          </div>
        </div>}
    </SideMenu>
  );
};
