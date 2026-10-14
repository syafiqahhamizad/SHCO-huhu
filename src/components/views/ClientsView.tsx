import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRemembered } from '../../lib/navHistory';
import { clientRef } from '../../lib/clientNumbers';
import { MY_STATES, formatAddress, parseAddress, type AddressParts } from '../../lib/address';
import { askForm } from '../ui/askForm';
import {
  CircleCheck, CircleDashed, Clock, Download, Eye, Folder, Key, Lock, Mail, MessageCircle, Plus, Search, ShieldCheck, Trash2, Upload, Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Case, Client, ClientHistoryEntry, CorporateEntityCategory, KycDoc } from '../../types';
import { NewClientModal } from '../NewClientModal';
import { css } from './finance/financeModel';
import { hideAmounts } from '../../lib/hideAmounts';
import { canSeeClientBilling, finGrants, canSeeFinanceView, finRoleKey } from '../../lib/financeAccess';
import { casesOfClient, isOpenFile, moneyForClient, moneyForFile, type MoneySources } from '../../lib/moneyByFile';
import { parseDate } from '../../lib/financeCalc';
import { exportToCsv } from '../../lib/exportUtils';
import { getLeadSources, leadSourceLabel } from '../../services/templateService';
import { whatsappLink } from '../../lib/whatsapp';
import { personBits } from './settings/permissionModel';
import {
  DRIVE_REQUIRED_MSG, clientFolderName, ensureClientKycFolder, isUploadReady, openLegacyDataUrl, openStoredFile, prepareStorage, storeClientKycFile, validateClaimFile,
} from '../../services/fileStorageService';
import {
  KYC_PILL, P, clientsNav, conflictOf, conflictPill, ddmmyyyy, idNoOf, initials, kycAddable, kycOverall, kycRequiredOf, kycRowsOf, otherKycDocs, portalOf, portalPill, rmWhole as rm, useSelectedClientId,
  type KycReqKey, type Pill, type PortalStatus, type PortalVisibility,
} from './clients/clientModel';

/**
 * Clients — design pack `Clients.dc.html` (COPY, DO NOT REDESIGN). Inline styles are the
 * design's own, copied through css(). Everything shown comes from real records (useApp());
 * money comes from lib/moneyByFile (the same source as Billing › Fees by file and the Working
 * File › Money tab). Nothing is typed in twice and no totals are stored.
 */

const LABEL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5B6478';
const INPUT = 'width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:7px 9px;font-size:12px;color:#16223A;background:#fff;outline-color:#3D6B9C;font-family:Arial,Helvetica,sans-serif';
const CARD_HEAD = 'padding:12px 16px;border-bottom:1px solid #EEF1F5';
const H = 'font-family:Georgia,serif;font-size:14.5px;color:#16223A';
const pillCss = (p: { bg: string; fg: string }) => css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:${p.bg};color:${p.fg}`);
const ENTITY_TYPES: CorporateEntityCategory[] = ['Sdn Bhd', 'Berhad', 'Enterprise', 'Sole Proprietorship', 'Partnership', 'LLP', 'Society/Association', 'Foreign Corp', 'Government / Statutory Body', 'Cooperative (Koperasi)'];
const FILE_PILL: Record<string, { bg: string; fg: string }> = { Active: P.g, Pending: P.a, Closed: P.n, Archive: P.r };
const HIST_C: Record<string, string> = { edit: '#3D6B9C', kyc: '#8A6D3B', conflict: '#8E2A20', portal: '#2F4F7A', file: '#16223A' };

/** Input / textarea that saves once on blur (one History line per change, not per keystroke). */
const CommitField: React.FC<{ value: string; onCommit: (v: string) => void; multiline?: boolean; style: React.CSSProperties; placeholder?: string; readOnly?: boolean; 'aria-label'?: string }> = ({ value, onCommit, multiline, readOnly, ...rest }) => {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  const common = {
    ...rest, value: draft, readOnly,
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; if (draft !== value) onCommit(draft); },
  };
  return multiline
    ? <textarea rows={2} {...common} onChange={(e) => setDraft(e.target.value)} />
    : <input {...common} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
};

/** Client address as the usual letter lines: address 1, address 2, postcode, city, state. Saves on blur. */
const AddressFields: React.FC<{ value: string; onCommit: (v: string) => void }> = ({ value, onCommit }) => {
  const [a, setA] = useState<AddressParts>(() => parseAddress(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setA(parseAddress(value)); }, [value]);
  const done = (next: AddressParts) => { focused.current = false; const v = formatAddress(next); if (v !== value) onCommit(v); };
  const fld = (k: keyof AddressParts, label: string, col: string, ph = '') => (
    <label style={css(`display:flex;flex-direction:column;gap:4px;grid-column:${col}`)}><span style={css(LABEL)}>{label}</span>
      {k === 'state'
        ? <select value={a.state} onChange={(e) => { const n = { ...a, state: e.target.value }; setA(n); done(n); }} style={css(INPUT)}><option value="">—</option>{MY_STATES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        : <input value={a[k]} placeholder={ph} onFocus={() => { focused.current = true; }} onChange={(e) => setA({ ...a, [k]: e.target.value })} onBlur={() => done(a)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={css(INPUT)} />}
    </label>
  );
  return (
    <>
      {fld('line1', 'Address line 1', '1 / -1', 'e.g. No. 125-2, Jalan Lavender Heights 3')}
      {fld('line2', 'Address line 2', '1 / -1', 'e.g. Pusat Perniagaan Lavender Heights')}
      {fld('postcode', 'Postcode', 'auto', 'e.g. 70400')}
      {fld('city', 'City / town', 'span 2', 'e.g. Seremban')}
      {fld('state', 'State', 'auto')}
    </>
  );
};

type Tier = 'fin' | 'partner' | 'lawyer';
type Tab = 'profile' | 'files' | 'money' | 'kyc' | 'portal' | 'history';

export const ClientsView: React.FC = () => {
  const app = useApp();
  const {
    clients = [], cases = [], invoices = [], payments = [], retainers = [], quotations = [], receipts = [], auditLogs = [],
    updateClient, deleteClient, currentRole, currentUser, isAdmin, setCurrentView, setCurrentCaseId, setCaseSubTab, showToast, openNewCaseWithPrefill,
  } = app;
  const src: MoneySources = useMemo(() => ({ invoices, payments, retainers, quotations, receipts }), [invoices, payments, retainers, quotations, receipts]);
  const rk = finRoleKey(currentRole, currentUser, isAdmin);
  const tier: Tier = rk === 'M' || rk === 'A' ? 'fin' : rk === 'P' ? 'partner' : 'lawyer';
  // Bills, receipts and the client account: partners, Accounts and reviewers only. Lawyers and
  // assistants get no billing records, so the Money tab and "Owes us" figures are not shown.
  const seeBilling = canSeeClientBilling(rk, finGrants(currentUser));
  const FILE_COLS = 'display:grid;grid-template-columns:220px minmax(200px,1fr) 140px 150px ' + (seeBilling ? '100px ' : '') + '80px;gap:12px;';
  const me = currentUser?.name || 'Staff';

  const selId = useSelectedClientId();
  useEffect(() => () => clientsNav.set(null), []);
  const [tab, setTab] = useRemembered<Tab>('clients.tab', 'profile');
  const [q, setQ] = useRemembered('clients.q', '');
  const [type, setType] = useRemembered<'All' | 'Individual' | 'Corporate'>('clients.type', 'All');
  const [card, setCard] = useRemembered('clients.card', '');
  const [reg, setReg] = useState(false);
  const open = (id: string, t: Tab = 'profile') => { setTab(t); clientsNav.set(id); };

  const sel = selId ? clients.find((c) => c.id === selId) : undefined;
  const modal = reg && <NewClientModal isOpen onClose={() => setReg(false)} onSaved={(id) => { open(id, 'kyc'); showToast('Client registered. Upload KYC documents next'); }} />;

  if (!sel) {
    return (
      <>
        <ClientList
          clients={clients} cases={cases} src={src} seeBilling={seeBilling} q={q} setQ={setQ} type={type} setType={setType} card={card} setCard={setCard}
          onOpen={(id) => open(id)} onReg={() => setReg(true)} showToast={showToast}
        />
        {modal}
      </>
    );
  }

  /* ------------------------------------------------------------------ profile */
  const c = sel;
  const isCo = c.type === 'Corporate';
  const files = casesOfClient(c, cases);
  const money = moneyForClient(c, cases, src);
  const kycRows = kycRowsOf(c);
  const log = (what: string, kind: ClientHistoryEntry['kind'] = 'edit'): ClientHistoryEntry[] => [{ at: new Date().toISOString(), by: me, what, kind }, ...(c.history || [])];
  const save = (patch: Partial<Client>, what: string, kind: ClientHistoryEntry['kind'] = 'edit') => updateClient(c.id, { ...patch, history: log(what, kind) });
  const openCase = (k: Case) => { setCaseSubTab('overview'); setCurrentCaseId(k.id); setCurrentView('cases'); };
  const createdBy = auditLogs.find((a) => a.collection === 'CLIENTS' && a.recordId === c.id && a.action === 'CREATE')?.performedBy
    || [...(c.history || [])].reverse().find((h) => /^Client registered/.test(h.what))?.by || '';
  const since = ddmmyyyy(c.createdAt);
  const wa = whatsappLink(c.phone, '');
  const ccPill = conflictPill(c);
  const ccState = conflictOf(c);
  // Admin access only, whatever the role (Settings › Permissions › Clients › Delete clients).
  const canDelete = personBits(app.rolesMatrix, app.currentUser, 'clients.delete') !== '000';
  const del = () => {
    if (files.some(isOpenFile)) { showToast('Cannot delete: this client has open files. Close or move them first.'); return; }
    if (!window.confirm('Delete ' + c.name + ' (' + c.id + ')? The record moves to the Recycle Bin. KYC files stay in Google Drive.')) return;
    deleteClient(c.id);
    clientsNav.set(null);
  };
  const tabs: [Tab, string][] = [['profile', 'Profile'], ['files', `Files (${files.length})`], ...(seeBilling ? [['money', 'Money'] as [Tab, string]] : []), ['kyc', `KYC (${kycRows.filter((r) => r.state === 'Verified').length}/${kycRows.length})`], ['portal', 'Portal access'], ['history', 'History']];

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#16223A;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:18px 20px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap')}>
        <span style={css(`width:52px;height:52px;flex-shrink:0;border-radius:${isCo ? '10px' : '9999px'};display:grid;place-items:center;font-size:16px;font-weight:800;color:#fff;background:${isCo ? '#3D6B9C' : '#16223A'}`)}>{initials(c.name)}</span>
        <div style={css('display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 360px')}>
          <strong style={css('font-family:Georgia,serif;font-size:21px;color:#16223A;line-height:1.25')}>{c.name}</strong>
          <div style={css('display:flex;flex-wrap:wrap;gap:6px;align-items:center')}>
            <span style={css('font-family:ui-monospace,monospace;font-size:10.5px;font-weight:700;color:#16223A;background:#F1F4F7;border:1px solid #DDE3EB;border-radius:5px;padding:2px 7px')}>{clientRef(c)}</span>
            <span style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:#E4ECF5;color:#2F4F7A')}>{isCo ? 'Company · ' + (c.entityCategory || 'Company') : 'Individual'}</span>
            {(c.tags || []).map((t) => <span key={t} style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:#FBF2E9;color:#8A6D3B;border:1px solid #E8D6B5')}>{t}</span>)}
          </div>
          <span style={css('font-size:12px;color:#5B6478')}>{[since ? 'Client since ' + since : '', createdBy ? 'registered by ' + createdBy : '', files.length + (files.length === 1 ? ' file' : ' files')].filter(Boolean).join(' · ')}</span>
        </div>
        <div style={css('display:flex;flex-wrap:wrap;gap:8px;align-items:center')}>
          {wa ? <a href={wa} target="_blank" rel="noreferrer" style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;background:#fff;color:#16223A;text-decoration:none')}><MessageCircle size={14} color="#1F5A3B" />WhatsApp</a> : null}
          {c.email ? <a href={'mailto:' + c.email} style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;background:#fff;color:#16223A;text-decoration:none')}><Mail size={14} color="#3D6B9C" />E-mail</a> : null}
          <button type="button" onClick={() => { setCurrentCaseId(null); openNewCaseWithPrefill({ clientId: c.id, clientName: c.name }); setCurrentView('cases'); }} style={css('display:flex;align-items:center;gap:6px;border:0;border-radius:8px;padding:8px 13px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><Plus size={14} color="#FFFFFF" />Open new file</button>
          {canDelete && <button type="button" onClick={del} title="Delete client (wrongly entered)" aria-label="Delete client" style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:8px;border:1px solid #F1C9C1;background:#FBEDE9;cursor:pointer')}><Trash2 size={15} color="#B23A2E" /></button>}
        </div>
      </div>

      <div style={css('display:flex;gap:4px;border-bottom:1px solid #DDE3EB;overflow-x:auto')}>
        {tabs.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} style={css(`white-space:nowrap;border:0;background:none;padding:9px 14px;margin-bottom:-1px;font-size:12.5px;font-weight:700;cursor:pointer;color:${tab === k ? '#16223A' : '#5B6478'};border-bottom:2px solid ${tab === k ? '#16223A' : 'transparent'}`)}>{label}</button>)}
      </div>

      {tab === 'profile' && <ProfileTab c={c} ccPill={ccPill} ccState={ccState} tier={tier} save={save} />}

      {tab === 'files' && (
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow-x:auto')}>
          <div style={css('min-width:940px')}>
            <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Files for this client</strong><span style={css('font-size:11px;color:#5B6478')}>click a file to open it</span><button type="button" onClick={() => { setCurrentCaseId(null); openNewCaseWithPrefill({ clientId: c.id, clientName: c.name }); setCurrentView('cases'); }} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer')}>+ Open new file</button></div>
            <div style={css(FILE_COLS + 'padding:8px 16px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>File no.</span><span>Title</span><span>Practice area</span><span>Partner · lawyer</span>{seeBilling && <span style={css('text-align:right')}>Owes us</span>}<span>Status</span></div>
            {files.map((k) => {
              const o = seeBilling ? moneyForFile(k, src).outstanding : 0;
              const lawyer = (k.lawyerInCharge || '').split(',')[0].trim() || (k.lawyers || [])[0] || '';
              return (
                <div key={k.id} onClick={() => openCase(k)} className="bg-white hover:bg-[#F6F8FA]" style={css(FILE_COLS + 'align-items:center;padding:12px 16px;border-bottom:1px solid #F0F2F5;cursor:pointer')}>
                  <span style={css('justify-self:start;font-family:ui-monospace,monospace;font-size:10.5px;font-weight:700;color:#16223A;background:#F1F4F7;border:1px solid #DDE3EB;border-radius:5px;padding:3px 6px;white-space:nowrap')}>{k.ref}</span>
                  <span style={css('font-size:12.5px;font-weight:700;color:#16223A')}>{k.title}</span>
                  <span style={css('color:#1E293B')}>{k.practiceArea || k.type || '—'}</span>
                  <span style={css('color:#5B6478')}>{[(k.partners || []).join(', '), lawyer].filter(Boolean).join(' · ') || '—'}</span>
                  {seeBilling && <span style={css(`text-align:right;font-weight:700;color:${o > 0 ? '#8E2A20' : '#5B6478'}`)}>{o > 0 ? rm(o) : '—'}</span>}
                  <span style={pillCss(FILE_PILL[k.status] || P.n)}>{k.status}</span>
                </div>
              );
            })}
            {!files.length && <div style={css('padding:18px 16px;font-size:12px;color:#5B6478')}>No files for this client yet.</div>}
          </div>
        </div>
      )}

      {tab === 'money' && seeBilling && MoneyPanel({ c, money, files, tier, rk })}
      {tab === 'kyc' && KycTab({ c, tier, save })}
      {tab === 'portal' && PortalTab({ c, save })}
      {tab === 'history' && HistoryTab({ c, files })}
      {modal}
    </div>
  );

  /* ------------------------------------------------------------------ money (Clients › Money) */
  function MoneyPanel({ c, money, files, tier, rk }: { c: Client; money: ReturnType<typeof moneyForClient>; files: Case[]; tier: Tier; rk: ReturnType<typeof finRoleKey> }) {
    const isFin = tier === 'fin', isPartner = tier === 'partner', ledgerOk = isFin || isPartner;
    const titleOf = (caseId?: string) => { const k = caseId ? files.find((f) => f.id === caseId || f.ref === caseId) : undefined; return k ? k.title : ''; };
    const bills = money.bills.filter((b) => b.issued);
    const out = money.outstanding;
    const scope = files.length === 1 ? '1 file' : files.length + ' files';
    const stats: { k: string; v: string; sub: string; c: string }[] = [
      { k: 'Agreed fees', v: rm(money.agreed), sub: 'quotations / letters of engagement', c: '#16223A' },
      { k: 'Billed', v: rm(money.billed), sub: bills.length + (bills.length === 1 ? ' invoice' : ' invoices') + ', incl. SST', c: '#16223A' },
      { k: 'Received', v: rm(money.received), sub: 'official receipts issued', c: '#1F5A3B' },
      { k: 'Outstanding', v: rm(out), sub: out > 0 ? 'owed to the firm' : 'nothing owed', c: out > 0 ? '#8E2A20' : '#16223A' },
      ledgerOk ? { k: 'Client account', v: rm(money.clientAccount), sub: 'money we hold for this client', c: '#2F4F7A' } : { k: 'Client account', v: 'Restricted', sub: 'Partners and Accounts only', c: '#5B6478' },
    ];
    const remind = (no: string, bal: number) => {
      const link = whatsappLink(c.phone, `Salam ${c.contactPerson || c.name}, a gentle reminder that invoice ${no} has ${rm(bal)} outstanding. Thank you.`);
      if (!link) { showToast('Add a phone number to ' + c.name + ' first.'); return; }
      window.open(link, '_blank', 'noopener');
      save({}, 'Payment reminder for ' + no + ' opened in WhatsApp', 'edit');
    };
    return (
      <div style={css('display:flex;flex-direction:column;gap:16px')}>
        <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-size:11.5px;color:#5B6478')}><span>Totals across {scope}. Figures come from invoices, receipts and the client-account ledger in Finance; nothing is typed in here.</span>{canSeeFinanceView('billing', rk) && <button type="button" onClick={() => setCurrentView('billing')} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer')}>Open in Billing &amp; Collections</button>}</div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px')}>
          {stats.map((m) => <div key={m.k} style={css('display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478')}>{m.k}</span><strong style={css(`font-family:Georgia,serif;font-size:20px;color:${m.c}`)}>{m.v}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{m.sub}</span></div>)}
        </div>
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow-x:auto')}>
          <div style={css('min-width:860px')}>
            <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Bills &amp; receipts</strong><span style={css('font-size:11px;color:#5B6478')}>all files for this client, newest first</span></div>
            <div style={css('display:grid;grid-template-columns:100px minmax(0,1.4fr) 86px 96px 96px 96px 120px;gap:10px;padding:8px 16px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Invoice</span><span>For · file</span><span>Issued</span><span style={css('text-align:right')}>Amount</span><span style={css('text-align:right')}>Paid</span><span style={css('text-align:right')}>Balance</span><span></span></div>
            {bills.map((b) => {
              const k = b.caseId ? files.find((f) => f.id === b.caseId || f.ref === b.caseId) : files.find((f) => f.ref === b.inv.fileRef);
              return (
                <div key={b.id} style={css('display:grid;grid-template-columns:100px minmax(0,1.4fr) 86px 96px 96px 96px 120px;gap:10px;align-items:center;padding:9px 16px;border-bottom:1px solid #F0F2F5')}>
                  <span style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-family:ui-monospace,monospace;font-size:11px;font-weight:700;color:#3D6B9C')}>{b.id}</span><span style={css('font-size:9.5px;color:#5B6478')}>{b.receiptNos.join(', ')}</span></span>
                  <span onClick={() => k && openCase(k)} style={css(`min-width:0;cursor:${k ? 'pointer' : 'default'}`)}><span style={css('display:block;font-size:12px;font-weight:600;color:#16223A')}>{b.what || 'Professional fees'}</span><span style={css('display:block;font-size:10.5px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{k ? k.title : b.inv.fileRef || ''}</span></span>
                  <span style={css('font-size:11px;color:#5B6478')}>{ddmmyyyy(b.date)}</span>
                  <span style={css('text-align:right;color:#16223A')}>{rm(b.total)}</span>
                  <span style={css('text-align:right;color:#1F5A3B')}>{b.paid ? rm(b.paid) : '—'}</span>
                  <span style={css(`text-align:right;font-weight:700;color:${b.bal > 0 ? '#8E2A20' : '#5B6478'}`)}>{b.bal > 0 ? rm(b.bal) : '—'}</span>
                  <span style={css('justify-self:end;display:flex;gap:6px')}>
                    {b.bal <= 0 && <span style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:#E6EFE9;color:#1F5A3B')}>Paid</span>}
                    {b.bal > 0 && (isFin || isPartner) && <button type="button" onClick={() => remind(b.id, b.bal)} style={css('white-space:nowrap;border:1px solid #DDE3EB;border-radius:6px;padding:4px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Remind</button>}
                    {b.bal > 0 && isFin && <button type="button" onClick={() => setCurrentView('billing')} style={css('white-space:nowrap;border:0;border-radius:6px;padding:5px 9px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Record payment</button>}
                    {b.bal > 0 && !isFin && !isPartner && <span style={css('font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:#F6E4E1;color:#8E2A20')}>Unpaid</span>}
                  </span>
                </div>
              );
            })}
            {!bills.length && <div style={css('padding:18px 16px;font-size:12px;color:#5B6478')}>No bills issued yet.</div>}
          </div>
        </div>
        {ledgerOk ? (
          <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow-x:auto')}>
            <div style={css('min-width:760px')}>
              <div style={css('display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>Client account</strong><span style={css('font-size:11px;color:#5B6478')}>money we hold for this client (Solicitors' Account Rules 1990)</span>{canSeeFinanceView('retainers', rk) && <button type="button" onClick={() => setCurrentView('retainers')} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer')}>Open ledger</button>}</div>
              {money.ledger.map((l) => (
                <div key={l.id} style={css('display:grid;grid-template-columns:90px minmax(0,1.5fr) 110px 110px 110px;gap:10px;align-items:center;padding:8px 16px;border-bottom:1px solid #F0F2F5')}>
                  <span style={css('font-size:11px;color:#5B6478')}>{ddmmyyyy(l.date)}</span>
                  <span style={css('min-width:0')}><span style={css('display:block;font-size:12px;color:#16223A')}>{l.desc}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{titleOf(l.caseId)}</span></span>
                  <span style={css('font-size:10.5px;font-weight:600;color:#3D6B9C')}>{l.doc}</span>
                  <span style={css(`text-align:right;font-size:12px;color:${l.amount < 0 ? '#8E2A20' : '#1F5A3B'}`)}>{(l.amount < 0 ? '− ' : '+ ') + rm(Math.abs(l.amount))}</span>
                  <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{rm(l.bal)}</span>
                </div>
              ))}
              {!money.ledger.length && <div style={css('padding:18px 16px;font-size:12px;color:#5B6478')}>No money held for this client.</div>}
            </div>
          </div>
        ) : (
          <div style={css('display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;border:1px dashed #C9D0DA;background:#fff;font-size:11.5px;color:#4A5468')}><Lock size={15} color="#5B6478" />Client account entries are visible to Partners and Accounts only. Ask the partner in charge if you need the balance.</div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ KYC */
  function KycTab({ c, tier, save }: { c: Client; tier: Tier; save: (p: Partial<Client>, what: string, kind?: ClientHistoryEntry['kind']) => void }) {
    const rows = kycRowsOf(c);
    const all = kycOverall(c);
    const others = otherKycDocs(c);
    const folder = clientFolderName(c.name, clientRef(c));
    const view = async (k: KycDoc) => {
      if (k.driveFileId || k.webViewLink) { const err = await openStoredFile({ driveFileId: k.driveFileId, webViewLink: k.webViewLink }); if (err) showToast(err); return; }
      if (k.dataUrl) { const err = openLegacyDataUrl(k.dataUrl, k.name); if (err) showToast(err); return; }
      showToast('This entry has no copy in Google Drive (only its name was recorded). Use Replace to upload the document.');
    };
    const upload = async (key: KycReqKey, label: string, file: File, replace?: KycDoc) => {
      if (!isUploadReady()) { showToast(DRIVE_REQUIRED_MSG); return; }
      const problem = validateClaimFile(file);
      if (problem) { showToast(problem); return; }
      try {
        await prepareStorage();
        const up = await storeClientKycFile({ id: clientRef(c), name: c.name }, file, me);
        const doc: KycDoc = {
          id: 'KYC-' + Date.now(), name: file.name, type: label, uploadedDate: up.uploadedAt.slice(0, 10), driveFolder: 'Clients KYC/' + folder + '/KYC',
          driveFileId: up.driveFileId, webViewLink: up.webViewLink, size: up.size, contentType: up.contentType, uploadedAt: up.uploadedAt, uploadedBy: up.uploadedBy,
          requirement: key, status: 'To verify',
        };
        save({ kyc: [...(c.kyc || []).filter((k) => k.id !== replace?.id), doc] }, (replace ? 'KYC replaced: ' : 'KYC uploaded: ') + label + ' (' + file.name + ')', 'kyc');
        showToast(file.name + ' saved to Drive. Waiting for verification');
      } catch (err) {
        showToast('Not uploaded: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    /** Takes the entry off the list (the file stays in Drive); the requirement shows as missing again. */
    const removeDoc = (doc: KycDoc, label: string) => {
      if (!window.confirm('Remove ' + label + ' (' + doc.name + ') from this client? The copy in Google Drive is kept.')) return;
      save({ kyc: (c.kyc || []).filter((k) => k.id !== doc.id) }, 'KYC removed: ' + label + ' (' + doc.name + ')', 'kyc');
      showToast(label + ' removed');
    };
    const verify = (doc: KycDoc, label: string) => {
      const at = new Date().toISOString();
      save({ kyc: (c.kyc || []).map((k) => (k.id === doc.id ? { ...k, status: 'Verified' as const, verifiedBy: me, verifiedAt: at } : k)) }, 'KYC verified: ' + label, 'kyc');
      showToast(label + ' verified');
    };
    const openDrive = async () => {
      if (!isUploadReady()) { showToast(DRIVE_REQUIRED_MSG); return; }
      const w = window.open('', '_blank');
      try {
        await prepareStorage();
        const f = await ensureClientKycFolder({ id: clientRef(c), name: c.name });
        if (!f) throw new Error(DRIVE_REQUIRED_MSG);
        if (w) w.location.href = f.url; else window.open(f.url, '_blank', 'noopener');
      } catch (err) {
        w?.close();
        showToast(err instanceof Error ? err.message : String(err));
      }
    };
    // The KYC list is per client: drop what this client does not need, add what they do.
    const required = kycRequiredOf(c);
    const dropDoc = (key: string, label: string) => save({ kycRequired: required.filter((k) => k !== key) }, 'KYC: ' + label + ' not needed', 'kyc');
    const addDoc = (v: string) => {
      if (!v) return;
      if (v === '__other') {
        void askForm('Add a KYC document', [{ key: 'label', label: 'Name of the document', placeholder: 'e.g. Letter of authority, Marriage certificate', required: true }, { key: 'hint', label: 'Note (optional)', placeholder: 'e.g. certified true copy' }]).then((f) => {
          if (!f) return;
          const key = 'c-' + Date.now().toString(36);
          save({ kycCustom: [...(c.kycCustom || []), { key, label: f.label.trim(), hint: f.hint.trim() || undefined }], kycRequired: [...required, key] }, 'KYC: added ' + f.label.trim(), 'kyc');
        });
        return;
      }
      const label = kycAddable(c).find(([k]) => k === v)?.[1] || v;
      save({ kycRequired: [...required.filter((k) => k !== v), v] }, 'KYC: added ' + label, 'kyc');
    };
    const icon = (s: string, fg: string) => s === 'Verified' ? <CircleCheck size={18} color={fg} /> : s === 'Missing' ? <CircleDashed size={18} color={fg} /> : <Clock size={18} color={fg} />;
    const cdd = c.cdd || {};
    const cddRows: [string, string | undefined][] = [['Risk rating', cdd.riskRating], ['PEP', cdd.pep], ['PEP details', cdd.pepDetails], ['Source of funds', cdd.sourceOfFunds], ['Source of wealth', cdd.sourceOfWealth], ['Purpose', cdd.purposeOfRelationship], ['Verified how', cdd.verificationMethod], ['Verified by', [cdd.verifiedBy, ddmmyyyy(cdd.verifiedAt)].filter(Boolean).join(' · ')], ['Enhanced due diligence', cdd.enhancedDueDiligence ? 'Yes' : undefined], ['Notes', cdd.notes]];
    const cddShown = cddRows.filter(([, v]) => !!v);
    return (
      <div style={css('display:flex;flex-direction:column;gap:16px')}>
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow:hidden')}>
          <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #EEF1F5')}><strong style={css(H)}>KYC documents</strong><span style={pillCss(all)}>{all.t}</span><span style={css('font-size:11px;color:#5B6478')}>{rows.some((r) => r.state !== 'Verified') ? 'Finish before the next file is opened' : 'All required documents verified'}</span><button type="button" onClick={openDrive} style={css('margin-left:auto;display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:6px 11px;font-size:11.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}><Folder size={14} color="#3D6B9C" />Open Drive folder</button></div>
          {rows.map((r) => {
            const p = KYC_PILL[r.state];
            const dt = r.doc ? ddmmyyyy(r.doc.uploadedAt || r.doc.uploadedDate) : '';
            const canUpload = r.state === 'Missing';
            return (
              <div key={r.key} style={css('display:grid;grid-template-columns:28px minmax(0,1fr) 110px 120px 260px;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid #F0F2F5')}>
                {icon(r.state, p.fg)}
                <span style={css('min-width:0')}><span style={css('display:block;font-size:12px;font-weight:700;color:#16223A')}>{r.label}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{r.hint}</span></span>
                <span style={pillCss(p)}>{p.t}</span>
                <span style={css('font-size:11px;color:#5B6478')}>{dt ? (r.state === 'To verify' ? 'Uploaded ' : '') + dt : '—'}</span>
                <span style={css('justify-self:end;display:flex;gap:6px')}>
                  {canUpload && <label title={isUploadReady() ? undefined : DRIVE_REQUIRED_MSG} onClick={(e) => { if (!isUploadReady()) { e.preventDefault(); showToast(DRIVE_REQUIRED_MSG); } }} style={css('display:flex;align-items:center;gap:5px;border:0;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><Upload size={12} color="#FFFFFF" />Upload<input type="file" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(r.key, r.label, f); }} style={css('display:none')} /></label>}
                  {r.state === 'To verify' && tier !== 'lawyer' && r.doc && <button type="button" onClick={() => verify(r.doc!, r.label)} style={css('border:1px solid #1F5A3B;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#E6EFE9;color:#1F5A3B;cursor:pointer;white-space:nowrap')}>Mark verified</button>}
                  {(r.state === 'Verified' || r.state === 'To verify') && r.doc && <button type="button" onClick={() => view(r.doc!)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>View</button>}
                  {(r.state === 'Verified' || r.state === 'To verify') && r.doc && <label title="Upload a new copy to Google Drive (it then needs verifying again)" onClick={(e) => { if (!isUploadReady()) { e.preventDefault(); showToast(DRIVE_REQUIRED_MSG); } }} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Replace<input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(r.key as KycReqKey, r.label, f, r.doc!); }} /></label>}
                  {(r.state === 'Verified' || r.state === 'To verify') && r.doc && tier !== 'lawyer' && <button type="button" title="Remove from this client (the Drive copy stays)" onClick={() => removeDoc(r.doc!, r.label)} style={css('border:1px solid #E7C3BE;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#fff;color:#8E2A20;cursor:pointer')}>Remove</button>}
                  {r.state === 'Missing' && r.required && <button type="button" title="This client does not need it" onClick={() => dropDoc(r.key, r.label)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#fff;color:#5B6478;cursor:pointer;white-space:nowrap')}>Not needed</button>}
                </span>
              </div>
            );
          })}
          {others.map((k) => (
            <div key={k.id} style={css('display:grid;grid-template-columns:28px minmax(0,1fr) 110px 120px 200px;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid #F0F2F5')}>
              <Folder size={18} color="#4A5468" />
              <span style={css('min-width:0')}><span style={css('display:block;font-size:12px;font-weight:700;color:#16223A')}>{k.name}</span><span style={css('display:block;font-size:10.5px;color:#5B6478')}>{k.type || 'Other document'}</span></span>
              <span style={pillCss(P.n)}>On file</span>
              <span style={css('font-size:11px;color:#5B6478')}>{ddmmyyyy(k.uploadedAt || k.uploadedDate) || '—'}</span>
              <span style={css('justify-self:end;display:flex;gap:6px')}><button type="button" onClick={() => view(k)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>View</button></span>
            </div>
          ))}
          <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 16px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11px;font-weight:700;color:#16223A')}>+ Add a document</span>
            <select value="" onChange={(e) => addDoc(e.target.value)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;color:#16223A;background:#fff;font-family:inherit')}>
              <option value="">Choose…</option>
              {kycAddable(c).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              <option value="__other">Other (type the name)…</option>
            </select>
            <span style={css('font-size:10.5px;color:#5B6478')}>Usually: {c.type === 'Corporate' ? 'SSM search and NRIC of directors' : 'NRIC / passport and bankruptcy search'}. Add or drop as this client needs.</span>
          </div>
          <div style={css('padding:9px 16px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Files are saved to Google Drive › Clients › {folder}.</div>
        </div>
        {cddShown.length > 0 && (
          <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
            <div style={css(CARD_HEAD)}><strong style={css(H)}>Customer due diligence</strong><span style={css('margin-left:8px;font-size:11px;color:#5B6478')}>recorded earlier{cdd.updatedAt ? ' · ' + ddmmyyyy(cdd.updatedAt) + (cdd.updatedBy ? ' by ' + cdd.updatedBy : '') : ''}</span></div>
            <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:14px 16px')}>
              {cddShown.map(([k, v]) => <div key={k} style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LABEL)}>{k}</span><span style={css('font-size:12px;color:#16223A')}>{v}</span></div>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ portal access */
  function PortalTab({ c, save }: { c: Client; save: (p: Partial<Client>, what: string, kind?: ClientHistoryEntry['kind']) => void }) {
    const po = portalOf(c);
    const pill = portalPill(c);
    const setStatus = (status: PortalStatus, what: string) => {
      save({ portal: { ...po, status }, portalAccessEnabled: status === 'Active' || status === 'Invited' }, what, 'portal');
      showToast(what);
    };
    const enableTo: PortalStatus = c.lastLoginAt ? 'Active' : po.invitedAt ? 'Invited' : 'Not set up';
    const loginLabel = po.status === 'Not set up' ? 'Create portal login' : po.status === 'Invited' ? 'Resend login details' : po.status === 'Active' ? 'Reset password' : '';
    const acts: { label: string; go?: () => void; pri: boolean; disabled?: boolean }[] = [
      ...(loginLabel ? [{ label: loginLabel, pri: true, disabled: true }] : []),
      ...(po.status === 'Invited' || po.status === 'Active' ? [{ label: 'Disable access', go: () => setStatus('Disabled', 'Portal access disabled'), pri: false }] : []),
      ...(po.status === 'Disabled' ? [{ label: 'Enable access', go: () => setStatus(enableTo, 'Portal access enabled'), pri: true }] : []),
    ];
    const SEE: [keyof PortalVisibility, string, string][] = [
      ['progress', 'Progress and court dates', 'Stage of each file, next court date, whether they need to attend'],
      ['documents', 'Documents we share', 'Only documents marked "Share with client" in the file'],
      ['bills', 'Bills and receipts', 'Invoices, payment status, official receipts'],
      ['statement', 'Client account statement', 'Money we hold for them, monthly statement'],
      ['messages', 'Messages with the team', 'Questions go to the lawyer in charge'],
    ];
    const toggle = (k: keyof PortalVisibility, label: string) => {
      const on = po.visibility[k];
      save({ portal: { ...po, visibility: { ...po.visibility, [k]: !on } } }, 'Portal: ' + label + (on ? ' hidden' : ' shown'), 'portal');
    };
    const preview = () => {
      try { sessionStorage.setItem('shco_portal_preview_client', c.id); } catch { /* storage blocked: preview opens on its own client switcher */ }
      setCurrentView('clientPortal');
    };
    return (
      <div style={css('display:flex;flex-direction:column;gap:16px')}>
        <div style={css('border-radius:14px;background:#16223A;color:#fff;padding:18px 20px;display:flex;flex-direction:column;gap:14px')}>
          <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:12px')}>
            <span style={css('width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:rgba(143,179,222,.15);border:1px solid rgba(143,179,222,.35)')}><Key size={18} color="#8FB3DE" /></span>
            <div style={css('display:flex;flex-direction:column;gap:3px;flex:1 1 300px;min-width:0')}>
              <span style={css('display:flex;align-items:center;gap:8px')}><strong style={css('font-family:Georgia,serif;font-size:15px;color:#fff')}>Client portal access</strong><span style={css(`font-size:10px;font-weight:800;padding:2px 9px;border-radius:9999px;background:${pill.bg};color:${pill.fg}`)}>{pill.t}</span></span>
              <span style={css('font-size:11.5px;color:#C9D3E0')}>The client signs in at portal.shcolaw.com to see progress, court dates, shared documents and bills. Read-only.</span>
            </div>
            <div style={css('display:flex;flex-direction:column;align-items:flex-end;gap:6px')}>
              <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
                {acts.map((a) => <button key={a.label} type="button" disabled={a.disabled} onClick={a.go} title={a.disabled ? 'Client sign-in will open after the database split' : undefined} style={css(`border-radius:8px;padding:8px 13px;font-size:11.5px;font-weight:700;cursor:${a.disabled ? 'not-allowed' : 'pointer'};opacity:${a.disabled ? 0.55 : 1};border:1px solid ${a.pri ? '#8FB3DE' : 'rgba(255,255,255,.25)'};background:${a.pri ? '#8FB3DE' : 'transparent'};color:${a.pri ? '#16223A' : '#fff'}`)}>{a.label}</button>)}
              </div>
              {!!loginLabel && <span style={css('font-size:10.5px;color:#C9D3E0')}>Client sign-in will open after the database split</span>}
            </div>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1)')}>
            {[['Login e-mail', po.loginEmail || '—'], ['Login sent', ddmmyyyy(po.invitedAt) || 'Never'], ['Last signed in', ddmmyyyy(c.lastLoginAt) || 'Not yet']].map(([k, v]) => <div key={k} style={css('padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)')}><span style={css('display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8FA0B8')}>{k}</span><span style={css('display:block;margin-top:3px;font-size:12.5px;font-weight:700;color:#fff')}>{v}</span></div>)}
          </div>
        </div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start')}>
          <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow:hidden')}>
            <div style={css(CARD_HEAD)}><strong style={css(H)}>What this client can see</strong></div>
            {SEE.map(([k, label, note]) => { const on = po.visibility[k]; return (
              <div key={k} role="switch" aria-checked={on} tabIndex={0} onClick={() => toggle(k, label)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k, label); } }} style={css('display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #F0F2F5;cursor:pointer')}>
                <span style={css('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}><span style={css('font-size:12px;font-weight:700;color:#16223A')}>{label}</span><span style={css('font-size:10.5px;color:#5B6478')}>{note}</span></span>
                <span style={css(`width:34px;height:20px;border-radius:9999px;padding:2px;display:flex;justify-content:${on ? 'flex-end' : 'flex-start'};background:${on ? '#1F5A3B' : '#C9D0DA'}`)}><span style={css('width:16px;height:16px;border-radius:9999px;background:#fff')} /></span>
              </div>
            ); })}
          </div>
          <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:16px;display:flex;flex-direction:column;gap:10px')}>
            <strong style={css(H)}>See it as the client does</strong>
            <span style={css('font-size:11.5px;line-height:1.5;color:#4A5468')}>Opens the portal in preview mode with this client's files, documents and bills. Nothing you do in preview is sent to the client.</span>
            <button type="button" onClick={preview} style={css('align-self:flex-start;display:flex;align-items:center;gap:6px;border:0;border-radius:8px;padding:8px 13px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><Eye size={14} color="#FFFFFF" />Preview portal</button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ history */
  function HistoryTab({ c, files }: { c: Client; files: Case[] }) {
    const rows: { t: number; date: string; what: string; who: string; color: string }[] = [];
    const push = (when: string | undefined, what: string, who: string, color: string) => rows.push({ t: parseDate(when), date: ddmmyyyy(when) || '—', what, who, color });
    (c.history || []).forEach((h) => push(h.at, h.what, h.by, h.kind === 'conflict' && /: Clear$/.test(h.what) ? '#1F5A3B' : HIST_C[h.kind || 'edit']));
    const logged = c.history || [];
    files.forEach((k) => push(k.fileOpenedDate || k.createdDate, 'File opened: ' + k.ref + ' · ' + k.title, (k.lawyerInCharge || '').split(',')[0].trim() || (k.lawyers || [])[0] || '', '#16223A'));
    (c.kyc || []).filter((k) => !k.requirement).forEach((k) => push(k.uploadedAt || k.uploadedDate, 'KYC uploaded: ' + (k.type || k.name), k.uploadedBy || '', '#8A6D3B'));
    if (c.conflictCheck && !logged.some((h) => h.kind === 'conflict')) push(c.conflictCheck.checkedDate, 'Conflict check: ' + c.conflictCheck.status + '. ' + (c.conflictCheck.notes || ''), c.conflictCheck.checkedBy, c.conflictCheck.status === 'Clear' ? '#1F5A3B' : '#8E2A20');
    if (!logged.some((h) => /^Client registered/.test(h.what))) {
      const cr = auditLogs.find((a) => a.collection === 'CLIENTS' && a.recordId === c.id && a.action === 'CREATE');
      if (c.createdAt || cr) push(c.createdAt || cr?.timestamp, 'Client registered as ' + (c.type === 'Corporate' ? c.entityCategory || 'Company' : 'Individual'), cr?.performedBy || '', '#16223A');
    }
    auditLogs.filter((a) => a.collection === 'CLIENTS' && a.recordId === c.id && a.action !== 'CREATE' && a.details !== 'Client record updated.').forEach((a) => push(a.timestamp, seeBilling ? a.details : hideAmounts(a.details), a.performedBy, '#4A5468'));
    rows.sort((a, b) => b.t - a.t);
    return (
      <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff;overflow:hidden')}>
        <div style={css(CARD_HEAD)}><strong style={css(H)}>History</strong><span style={css('margin-left:8px;font-size:11px;color:#5B6478')}>every change to this client record, newest first</span></div>
        {rows.map((h, i) => (
          <div key={i} style={css('display:grid;grid-template-columns:120px 12px minmax(0,1fr) 140px;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-family:ui-monospace,monospace;font-size:11px;color:#5B6478')}>{h.date}</span>
            <span style={css(`width:9px;height:9px;border-radius:9999px;background:${h.color}`)} />
            <span style={css('font-size:12px;color:#16223A')}>{h.what}</span>
            <span style={css('font-size:11px;color:#5B6478;text-align:right')}>{h.who}</span>
          </div>
        ))}
        {!rows.length && <div style={css('padding:18px 16px;font-size:12px;color:#5B6478')}>Nothing recorded yet.</div>}
      </div>
    );
  }
};

/* ==================================================================== profile tab */

const ProfileTab: React.FC<{ c: Client; ccPill: Pill; ccState: string; tier: Tier; save: (p: Partial<Client>, what: string, kind?: ClientHistoryEntry['kind']) => void }> = ({ c, ccPill, ccState, tier, save }) => {
  const { currentUser, rolesMatrix, showToast } = useApp();
  const isCo = c.type === 'Corporate';
  const [ccEd, setCcEd] = useState<{ s: string; note: string } | null>(null);
  // Partners by default; can be given to staff in charge in Settings › Permissions › Clients › Clear a conflict check.
  const canClear = personBits(rolesMatrix, currentUser, 'clients.clearConflict') !== '000';
  type F = { label: string; key: keyof Client; mono?: boolean; col?: string; multi?: boolean; select?: string[] };
  const fieldVal = (k: keyof Client) => {
    if (k === 'emergencyContactName') return c.emergencyContactName || (c.emergencyContact && c.emergencyContact !== '—' ? c.emergencyContact : '');
    return String((c[k] as string | undefined) || '');
  };
  const commit = (f: F) => (v: string) => {
    const old = fieldVal(f.key);
    const value = v.trim();
    if (value === old.trim()) return;
    if (f.key === 'name' && !value) { showToast('The client name cannot be empty.'); return; }
    const patch: Partial<Client> = { [f.key]: value } as Partial<Client>;
    if (f.key === 'icNo') patch.icNumber = value;
    save(patch, f.label + (old ? ' changed from "' + old + '" to "' + value + '"' : ' set to "' + value + '"'));
  };
  const det: F[] = [
    ...(isCo
      ? [{ label: 'Registered name', key: 'name', col: 'span 2' }, { label: 'SSM / ROC no.', key: 'registrationNo', mono: true }, { label: 'Entity type', key: 'entityCategory', select: ENTITY_TYPES }, { label: 'Tax / SST no.', key: 'taxSstNo', mono: true }, { label: 'Person who instructs us', key: 'contactPerson' }, { label: 'Designation', key: 'contactPersonDesignation' }, { label: 'Phone', key: 'phone', mono: true }] as F[]
      : [{ label: 'Full name (as in NRIC)', key: 'name', col: 'span 2' }, { label: 'NRIC / passport no.', key: 'icNo', mono: true }, { label: 'Nationality', key: 'nationality' }, { label: 'Occupation', key: 'occupation' }, { label: 'Phone', key: 'phone', mono: true }] as F[]),
    { label: 'E-mail', key: 'email', mono: true, col: 'span 2' },
    { label: 'Address', key: 'address', col: '1 / -1', multi: true },
  ];
  const em: F[] = [{ label: 'Name', key: 'emergencyContactName', col: '1 / -1' }, { label: isCo ? 'Role' : 'Relationship', key: 'emergencyContactRelationship' }, { label: 'Phone', key: 'emergencyContactPhone', mono: true }];
  const input = (f: F) => {
    const st = css(INPUT);
    if (f.select) return <select value={fieldVal(f.key)} onChange={(e) => commit(f)(e.target.value)} style={st}>{!fieldVal(f.key) && <option value="">—</option>}{f.select.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.multi) return <CommitField multiline value={fieldVal(f.key)} onCommit={commit(f)} aria-label={f.label} style={css(INPUT + ';line-height:1.5;resize:vertical')} />;
    return <CommitField value={fieldVal(f.key)} onCommit={commit(f)} aria-label={f.label} style={st} />;
  };
  const cc = c.conflictCheck;
  const panel = ccState === 'Clear' ? '#F6F8FA' : ccState === 'Flagged' ? '#FBF1EF' : '#F2F6FA';
  const bd = ccState === 'Clear' ? '#DDE3EB' : ccState === 'Flagged' ? '#E8BDB5' : '#C9D7E8';
  const note = cc ? 'Checked by ' + (cc.checkedBy || '—') + ' on ' + (ddmmyyyy(cc.checkedDate) || '—') + '. ' + (cc.notes || '') : 'No conflict check recorded for this client yet.';
  const opts: [string, string, { bg: string; fg: string }][] = [['Clear', 'Clear', P.g], ['Pending Partner Review', 'Needs review', P.b], ['Flagged', 'Flagged', P.r]];
  const saveCC = () => {
    if (!ccEd) return;
    if (ccEd.s === 'Clear' && ccState !== 'Clear' && !canClear) { showToast('You do not have permission to clear a conflict check. Send it for review (someone allowed in Settings › Permissions clears it).'); return; }
    const d = new Date().toISOString();
    save({ conflictCheck: { status: ccEd.s as NonNullable<Client['conflictCheck']>['status'], notes: ccEd.note.trim(), checkedBy: currentUser?.name || 'Staff', checkedDate: d.slice(0, 10) } }, 'Conflict check updated: ' + ccEd.s, 'conflict');
    setCcEd(null);
    showToast('Conflict decision saved');
  };
  void tier;
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1px solid ${bd};background:${panel}`)}>
        <ShieldCheck size={20} color="#3D6B9C" />
        <div style={css('display:flex;flex-direction:column;gap:3px;flex:1 1 320px;min-width:0')}>
          <span style={css('display:flex;align-items:center;gap:8px')}><strong style={css('font-size:12.5px;color:#16223A')}>Conflict check</strong><span style={css(`font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;background:${ccPill.bg};color:${ccPill.fg}`)}>{ccPill.t}</span></span>
          <span style={css('font-size:11.5px;line-height:1.5;color:#4A5468')}>{note}</span>
        </div>
        <button type="button" onClick={() => setCcEd({ s: ccState === 'Not Started' ? 'Clear' : ccState, note: cc?.notes || '' })} style={css('border:1px solid #16223A;border-radius:8px;padding:7px 12px;font-size:11.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Review conflict check</button>
      </div>
      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start')}>
        <div style={css('grid-column:1 / -1;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css(CARD_HEAD)}><strong style={css(H)}>{isCo ? 'Company & contact' : 'Client details'}</strong></div>
          <div style={css('display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:14px 16px')}>
            {det.map((f) => (f.key === 'address' ? <AddressFields key="address" value={fieldVal('address')} onCommit={commit(f)} /> : <label key={String(f.key)} style={css(`display:flex;flex-direction:column;gap:4px;grid-column:${f.col || 'auto'}`)}><span style={css(LABEL)}>{f.label}</span>{input(f)}</label>))}
          </div>
        </div>
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css(CARD_HEAD)}><strong style={css(H)}>{isCo ? 'Second contact' : 'Emergency contact'}</strong></div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px 16px')}>
            {em.map((f) => <label key={String(f.key)} style={css(`display:flex;flex-direction:column;gap:4px;grid-column:${f.col || 'auto'}`)}><span style={css(LABEL)}>{f.label}</span>{input(f)}</label>)}
          </div>
        </div>
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css(CARD_HEAD)}><strong style={css(H)}>Came to us through</strong></div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px 16px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LABEL)}>Source</span><select value={c.source || ''} onChange={(e) => { const v = e.target.value; save({ source: v || undefined }, 'Came to us through: ' + (leadSourceLabel(c.source) || '—') + ' → ' + (leadSourceLabel(v) || '—')); }} style={css(INPUT)}><option value="">—</option>{getLeadSources().map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}{c.source && !getLeadSources().some((x) => x.key === c.source) && <option value={c.source}>{c.source}</option>}</select></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LABEL)}>Who / which</span><CommitField value={c.sourceDetail || ''} onCommit={(v) => { const t = v.trim(); if (t === (c.sourceDetail || '')) return; save({ sourceDetail: t || undefined }, 'Came to us through (who / which): ' + (t || '—')); }} placeholder="e.g. referred by Puan Aini" aria-label="Who referred them" style={css(INPUT)} /></label>
          </div>
        </div>
        <div style={css('border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css(CARD_HEAD)}><strong style={css(H)}>Instructions &amp; notes</strong></div>
          <div style={css('padding:14px 16px')}><CommitField multiline value={c.notes || ''} onCommit={commit({ label: 'Instructions & notes', key: 'notes' })} placeholder="How the client likes to be contacted, billing instructions, board resolution conditions…" aria-label="Instructions and notes" style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.5;color:#16223A;background:#fff;resize:vertical;outline-color:#3D6B9C;min-height:84px')} /></div>
        </div>
      </div>
      <span style={css('font-size:11px;color:#5B6478')}>Changes save automatically and are logged in History.</span>

      {ccEd && (
        <div onClick={() => setCcEd(null)} style={css('position:fixed;inset:0;background:rgba(22,34,58,.45);z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:64px 16px;overflow:auto')}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Conflict check" style={css('width:100%;max-width:520px;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(22,34,58,.25);display:flex;flex-direction:column')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #DDE3EB')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Conflict check</strong><button type="button" onClick={() => setCcEd(null)} aria-label="Close" style={css('margin-left:auto;border:0;background:none;font-size:18px;color:#5B6478;cursor:pointer')}>×</button></div>
            <div style={css('display:flex;flex-direction:column;gap:12px;padding:18px 20px')}>
              <div style={css('display:flex;gap:6px')}>{opts.map(([v, label, p]) => { const on = ccEd.s === v; return <button key={v} type="button" onClick={() => setCcEd({ ...ccEd, s: v })} style={css(`flex:1;border-radius:8px;padding:8px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${on ? p.fg : '#DDE3EB'};background:${on ? p.bg : '#fff'};color:${on ? p.fg : '#16223A'}`)}>{label}</button>; })}</div>
              <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LABEL)}>Notes</span><textarea value={ccEd.note} onChange={(e) => setCcEd({ ...ccEd, note: e.target.value })} rows={3} style={css('width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.5;color:#16223A;outline-color:#3D6B9C')} /></label>
            </div>
            <div style={css('display:flex;justify-content:flex-end;gap:10px;padding:12px 20px;border-top:1px solid #DDE3EB;background:#F6F8FA;border-radius:0 0 12px 12px')}><button type="button" onClick={() => setCcEd(null)} style={css('border:1px solid #DDE3EB;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Cancel</button><button type="button" onClick={saveCC} style={css('border:0;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Save decision</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==================================================================== list */

const ClientList: React.FC<{
  clients: Client[]; cases: Case[]; src: MoneySources; seeBilling: boolean;
  q: string; setQ: (v: string) => void; type: 'All' | 'Individual' | 'Corporate'; setType: (t: 'All' | 'Individual' | 'Corporate') => void;
  card: string; setCard: (c: string) => void; onOpen: (id: string) => void; onReg: () => void; showToast: (m: string) => void;
}> = ({ clients, cases, src, seeBilling, q, setQ, type, setType, card, setCard, onOpen, onReg, showToast }) => {
  const [from, setFrom] = useRemembered('clients.from', '');
  const info = useMemo(() => {
    const m = new Map<string, { files: Case[]; owes: number; kyc: ReturnType<typeof kycOverall> }>();
    clients.forEach((c) => {
      m.set(c.id, { files: casesOfClient(c, cases), owes: seeBilling ? moneyForClient(c, cases, src).outstanding : 0, kyc: kycOverall(c) });
    });
    return m;
  }, [clients, cases, src, seeBilling]);
  const I = (c: Client) => info.get(c.id) || { files: [], owes: 0, kyc: kycOverall(c) };
  const s = q.trim().toLowerCase();
  const byQ = (x: Client) => !s || [x.name, x.id, x.clientNo, idNoOf(x), x.icNo, x.icNumber, x.registrationNo, x.phone, x.email, x.contactPerson, ...(x.tags || [])].join(' ').toLowerCase().includes(s);
  const byT = (x: Client) => type === 'All' || x.type === type;
  const CF: Record<string, (x: Client) => boolean> = {
    kyc: (x) => !I(x).kyc.done,
    cc: (x) => conflictOf(x) !== 'Clear',
    po: (x) => portalOf(x).status === 'Not set up' && I(x).files.some(isOpenFile),
    owes: (x) => I(x).owes > 0,
  };
  const byF = (x: Client) => !from || (from === '-' ? !x.source : x.source === from);
  const pre = clients.filter((x) => byQ(x) && byT(x) && byF(x));
  const list = pre.filter((x) => !card || (CF[card] ? CF[card](x) : true));
  const mk = (label: string, key: string, color: string, count: number, note: string) => ({ label, key, color, count, note });
  const cards = [
    mk('All clients', '', '#16223A', pre.length, clients.filter((x) => I(x).files.some((f) => f.status === 'Active')).length + ' with an active file'),
    mk('KYC to finish', 'kyc', '#8A6D3B', pre.filter(CF.kyc).length, 'missing or unverified documents'),
    mk('Conflict to review', 'cc', '#8E2A20', pre.filter(CF.cc).length, 'flagged or awaiting partner'),
    mk('No portal login', 'po', '#2F4F7A', pre.filter(CF.po).length, 'open files, client can\'t see progress'),
    ...(seeBilling ? [mk('Owes us', 'owes', '#1F5A3B', pre.filter(CF.owes).length, rm(pre.reduce((a, x) => a + Math.max(0, I(x).owes), 0)) + ' outstanding')] : []),
  ];
  const exportCsv = () => {
    if (!clients.length) { showToast('No clients to export yet.'); return; }
    exportToCsv('SHCO_Clients', clients.map((x) => ({ 'Client ID': x.id, Name: x.name, Type: x.type, 'NRIC / SSM': idNoOf(x), Phone: x.phone, 'E-mail': x.email, KYC: I(x).kyc.t, Conflict: conflictOf(x), Portal: portalOf(x).status, 'Came from': leadSourceLabel(x.source), 'Who / which': x.sourceDetail || '' })));
    showToast('SHCO_Clients.csv downloaded');
  };
  const hasFilters = !!(q || type !== 'All' || card || from);
  const COLS = 'display:grid;grid-template-columns:minmax(230px,1.6fr) 150px minmax(170px,1fr) 70px ' + (seeBilling ? '104px ' : '') + '88px 104px 88px;gap:12px;';
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px;font-size:12px;color:#16223A;font-family:Inter,system-ui,-apple-system,sans-serif')}>
      <div style={css('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #DDE3EB;padding:16px;border-radius:12px')}>
        <div style={css('display:flex;flex-direction:column;gap:3px')}>
          <div style={css('display:flex;align-items:center;gap:8px')}><Users size={20} color="#3D6B9C" /><span style={css('font-family:Georgia,serif;font-size:18px;font-weight:700;color:#16223A')}>Client directory</span></div>
          <span style={css('font-size:12px;color:#5B6478')}>Individuals and companies we act for. One record per client, shared by all their files.</span>
        </div>
        <div style={css('display:flex;align-items:center;gap:8px')}>
          <button type="button" onClick={exportCsv} style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:10px;padding:9px 13px;font-size:12px;font-weight:700;background:#F1F4F7;color:#16223A;cursor:pointer')}><Download size={15} color="#3D6B9C" />Export to Excel</button>
          <button type="button" onClick={onReg} style={css('display:flex;align-items:center;gap:7px;border:0;border-radius:10px;padding:9px 15px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><Plus size={15} color="#FFFFFF" />Register new client</button>
        </div>
      </div>

      <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px')}>
        {cards.map((cd) => { const on = card === cd.key; return (
          <button key={cd.label} type="button" onClick={() => setCard(on ? '' : cd.key)} aria-pressed={on} style={css(`display:flex;flex-direction:column;gap:4px;text-align:left;border-radius:10px;padding:12px;cursor:pointer;background:#fff;border-style:solid;border-width:4px 1px 1px;border-color:${cd.color} ${on ? cd.color : '#DDE3EB'} ${on ? cd.color : '#DDE3EB'};box-shadow:${on ? '0 0 0 1px ' + cd.color : 'none'}`)}>
            <span style={css('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5B6478')}>{cd.label}</span>
            <span style={css(`font-size:24px;font-weight:700;color:${cd.color}`)}>{cd.count}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{cd.note}</span>
          </button>
        ); })}
      </div>

      <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:12px;background:#fff;border:1px solid #DDE3EB;padding:10px 12px;border-radius:10px')}>
        <div style={css('display:flex;align-items:center;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:6px 10px;background:#F6F8FA;flex:0 1 340px;min-width:200px')}><Search size={14} color="#5B6478" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, client ID, NRIC, SSM no., phone or e-mail" aria-label="Search clients" style={css('flex:1;min-width:0;border:0;outline:0;font-size:12px;color:#16223A;background:transparent')} /></div>
        <div style={css('display:flex;gap:4px')}>
          {(['All', 'Individual', 'Corporate'] as const).map((t) => { const on = type === t; return <button key={t} type="button" onClick={() => setType(t)} style={css(`border-radius:14px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{t === 'All' ? 'All types' : t}</button>; })}
        </div>
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Came from" style={css('border:1px solid #DDE3EB;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:700;color:#16223A;background:#fff;font-family:inherit')}>
          <option value="">Came from: all</option>
          {getLeadSources().map((x) => { const n = clients.filter((c) => c.source === x.key).length; return <option key={x.key} value={x.key}>{x.label + ' (' + n + ')'}</option>; })}
          <option value="-">{'Not recorded (' + clients.filter((c) => !c.source).length + ')'}</option>
        </select>
        {hasFilters && <button type="button" onClick={() => { setQ(''); setType('All'); setCard(''); setFrom(''); }} style={css('border:0;background:none;padding:0;font-size:11.5px;font-weight:700;color:#3D6B9C;cursor:pointer')}>Clear filters</button>}
        <span style={css('margin-left:auto;font-size:11px;color:#5B6478')}>Showing {list.length} of {clients.length} clients</span>
      </div>

      <div style={css('background:#fff;border:1px solid #DDE3EB;border-radius:12px;overflow-x:auto')}>
        <div style={css('min-width:1020px')}>
          <div style={css(COLS + 'padding:11px 14px;background:#16223A;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em')}>
            <span>Client</span><span>NRIC / SSM no.</span><span>Contact</span><span>Files</span>{seeBilling && <span style={css('text-align:right')}>Owes us</span>}<span>KYC</span><span>Conflict</span><span>Portal</span>
          </div>
          {list.map((x) => {
            const inf = I(x);
            const isCo = x.type === 'Corporate';
            const act = inf.files.filter(isOpenFile).length;
            const o = inf.owes;
            const kp = inf.kyc, cp = conflictPill(x), pp = portalPill(x);
            return (
              <div key={x.id} onClick={() => onOpen(x.id)} className="bg-white hover:bg-[#F6F8FA]" style={css(COLS + 'align-items:center;padding:11px 14px;border-bottom:1px solid #F0F2F5;cursor:pointer')}>
                <span style={css('display:flex;align-items:center;gap:10px;min-width:0')}>
                  <span style={css(`width:32px;height:32px;flex-shrink:0;border-radius:${isCo ? '8px' : '9999px'};display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff;background:${isCo ? '#3D6B9C' : '#16223A'}`)}>{initials(x.name)}</span>
                  <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('font-size:12.5px;font-weight:700;color:#16223A;line-height:1.35')}>{x.name}</span><span style={css('font-size:10.5px;color:#5B6478')}>{clientRef(x) + ' · ' + (isCo ? x.entityCategory || 'Company' : 'Individual') + (x.source ? ' · via ' + leadSourceLabel(x.source) : '') + ((x.tags || []).length ? ' · ' + (x.tags || []).join(', ') : '')}</span></span>
                </span>
                <span style={css('font-family:ui-monospace,monospace;font-size:11px;color:#1E293B')}>{idNoOf(x) || '—'}</span>
                <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('font-weight:600;color:#16223A')}>{x.phone || '—'}</span><span style={css('font-size:11px;color:#5B6478;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{x.email}</span></span>
                <span style={css('font-weight:700;color:#16223A')}>{act ? act + ' open' : inf.files.length ? inf.files.length + ' closed' : '—'}</span>
                {seeBilling && <span style={css(`text-align:right;font-weight:700;color:${o > 0 ? '#8E2A20' : '#5B6478'}`)}>{o > 0 ? rm(o) : '—'}</span>}
                <span style={pillCss(kp)}>{kp.t}</span>
                <span style={pillCss(cp)}>{cp.t}</span>
                <span style={pillCss(pp)}>{pp.t}</span>
              </div>
            );
          })}
          {!list.length && <div style={css('padding:28px;text-align:center;font-size:12px;color:#5B6478')}>{clients.length ? 'No clients match these filters.' : 'No clients yet. Register the first one with “Register new client”.'}</div>}
        </div>
      </div>
    </div>
  );
};
