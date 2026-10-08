/**
 * Client Portal (design pack design_handoff_clients › Client Portal.dc.html).
 *
 * The client-facing page: no firm Sidebar/Header (App.tsx renders it full screen), warm
 * background, firm wordmark and Sign out. Everything shown is read from the real app data for
 * the selected client — files, hearings, deadlines, client updates the Working File sent,
 * documents staff marked "Share with client", invoices / receipts / client-account entries
 * and the legal team. Nothing is invented: missing data shows an empty state.
 *
 * Staff preview (any signed-in staff member): amber bar with a client switcher, and nothing is
 * sent — every upload / send action is disabled. Real client sign-in is NOT enabled here.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus, Check, Download, Eye, FileText, Gavel, Info, LogOut, Mail, MessageCircle, Receipt as ReceiptIcon, Scale, Send, Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Case, CaseDocument, Client, Hearing, Invoice, Receipt, Task, User } from '../../types';
import { css, invoiceToDoc, quotationToDoc, receiptToDoc, type Lookups } from './finance/financeModel';
import { courtOf, isDeadline, isDone, isoOf, lawyerOf, practiceOf, stageKey, stageMessage, staffOf, stagesFor, todayIso } from './cases/caseModel';
import { casesOfClient, moneyForClient } from '../../lib/moneyByFile';
import { canSeeClientBilling, finGrants, finRoleKey } from '../../lib/financeAccess';
import { courtEventTimes } from '../../lib/calendarEvent';
import { whatsappLink } from '../../lib/whatsapp';
import { docHtml, pdf, tableHtml } from '../../lib/financeDocs';
import { getPracticeSettings } from '../../services/templateService';
import { openLegacyDataUrl, openStoredFile, prepareStorage, storeFinanceProof, storeMatterFile } from '../../services/fileStorageService';

export const PREVIEW_CLIENT_KEY = 'shco_portal_preview_client';

const BG = '#F4F1EA';
const PREVIEW_NOTE = 'Preview: nothing is sent';

/* ------------------------------------------------------------------ formatting */

const toDate = (s?: string) => {
  if (!s) return null;
  const v = String(s);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T00:00' : v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
};
const fmt = (s: string | undefined, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => { const d = toDate(s); return d ? d.toLocaleDateString('en-GB', o) : '—'; };
const timeOf = (s?: string) => { const d = toDate(s); return d && /[T ]\d{2}:\d{2}/.test(String(s)) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''; };
const rm = (n: number) => 'RM ' + (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysTo = (iso: string) => { const d = toDate(iso); if (!d) return 0; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d.getTime() - t.getTime()) / 864e5); };
const initialsOf = (name: string) => name.split(/\s+/).filter((w) => w && !/^(bin|binti|b\.|bt\.)$/i.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** calendar.google.com "add event" template link (Asia/Kuala_Lumpur). Null when the date is invalid. */
const gcalLink = (title: string, date: string, time: string | undefined, details: string, location: string): string | null => {
  try {
    const t = courtEventTimes(date, time || null, 120);
    const f = (x: { date: string } | { dateTime: string }) => ('date' in x ? x.date.replace(/-/g, '') : x.dateTime.replace(/[-:]/g, ''));
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + f(t.start) + '/' + f(t.end)
      + (t.allDay ? '' : '&ctz=Asia%2FKuala_Lumpur') + '&details=' + encodeURIComponent(details) + '&location=' + encodeURIComponent(location);
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ progress (5 steps by practice) */

/** Five client-facing steps per practice, and which step each Working File status stage falls in
 * (index = stage in caseModel's stage list; 5 = all steps done). */
const STEPS: Record<string, { labels: string[]; map: number[] }> = {
  'Civil Litigation': { labels: ['File opened', 'Court papers filed', 'Exchange of papers', 'Hearing or trial', 'Decision'], map: [0, 1, 2, 2, 3, 4, 4] },
  Conveyancing: { labels: ['SPA signed', 'Loan & stamping', 'Consent & transfer', 'Balance paid', 'Keys handed over'], map: [0, 1, 1, 2, 3, 4, 5] },
  Corporate: { labels: ['Instructions', 'Due diligence', 'Drafting', 'Signing', 'Completion'], map: [0, 1, 2, 2, 3, 4, 5] },
  Family: { labels: ['Instructions', 'Petition filed', 'Service & mediation', 'Hearing', 'Decree'], map: [0, 1, 2, 2, 3, 4, 5] },
  Syariah: { labels: ['Instructions', 'Claim filed', 'Sulh (mediation)', 'Hearing', 'Judgment'], map: [0, 1, 2, 3, 4, 5] },
  'Probate & Estates': { labels: ['Collect documents', 'Petition filed', 'Grant issued', 'Collect assets & pay debts', 'Distribution'], map: [0, 1, 2, 3, 3, 4, 5] },
  Employment: { labels: ['Representation filed', 'Conciliation', 'Industrial Court', 'Hearing', 'Award'], map: [0, 1, 2, 3, 4, 5] },
  Criminal: { labels: ['File opened', 'Charge & mention', 'Pre-trial', 'Trial', 'Decision'], map: [0, 1, 2, 3, 4, 4, 5] },
};

/** Current step (0–4, 5 = done) from the file's saved stage; null when the file has no stage data. */
const stepOf = (c: Case): number | null => {
  const def = STEPS[stageKey(practiceOf(c))];
  if (c.status === 'Closed' || c.status === 'Archive') return 5;
  const list = stagesFor(practiceOf(c));
  let i = -1;
  if (typeof c.statusStage === 'number' && c.statusStage >= 0) i = Math.min(c.statusStage, list.length - 1);
  else if (c.statusStageName) i = list.indexOf(c.statusStageName);
  else if (c.stage) i = list.findIndex((x) => x.toLowerCase() === String(c.stage).toLowerCase());
  return i >= 0 ? def.map[Math.min(i, def.map.length - 1)] : null;
};
const stageNameOf = (c: Case): string => {
  const list = stagesFor(practiceOf(c));
  if (typeof c.statusStage === 'number' && c.statusStage >= 0) return list[Math.min(c.statusStage, list.length - 1)];
  return c.statusStageName || '';
};

/* ------------------------------------------------------------------ small pieces */

const DOC_CAT: Record<string, [React.ElementType, string, string]> = {
  'Court papers': [Scale, '#E4ECF5', '#2F4F7A'], Filing: [Scale, '#E4ECF5', '#2F4F7A'], Orders: [Gavel, '#F6EEDC', '#8A6D3B'],
  Letters: [Mail, '#EEF1F5', '#4A5468'], Correspondence: [Mail, '#EEF1F5', '#4A5468'], Bills: [ReceiptIcon, '#E6EFE9', '#1F5A3B'], Agreements: [FileText, '#F1EBF6', '#6B3D8C'],
};
const KEY_TAG: Record<string, [string, string]> = { Court: ['#E4ECF5', '#2F4F7A'], Deadline: ['#F6EEDC', '#8A6D3B'], Done: ['#EEF1F5', '#4A5468'] };

const isSentUpdate = (s: string) => s !== 'Prepared — not sent';

interface Update { at: string; title: string; body: string; by: string; file: string }
interface Ask { id: string; title: string; note: string; kind: 'sign' | 'note' | 'done'; open?: () => void }

/* ================================================================== view */

export const ClientPortalView: React.FC = () => {
  const {
    clients, cases, invoices, payments, receipts, retainers, quotations, users, currentUser, currentRole, isAdmin, logoutUser, setCurrentView, updateInvoice, updateCase,
  } = useApp();

  const isClientLogin = currentRole === 'Client';
  const preview = !isClientLogin;
  // Staff preview: bills and the client account only for people who see billing (partners,
  // Accounts, reviewers). Lawyers and assistants get no billing records, so those parts are hidden.
  const previewBilling = !preview || canSeeClientBilling(finRoleKey(currentRole, currentUser, isAdmin), finGrants(currentUser));

  const [cid, setCid] = useState<string>(() => {
    try { return sessionStorage.getItem(PREVIEW_CLIENT_KEY) || ''; } catch { return ''; }
  });
  const [tab, setTab] = useState<'home' | 'files' | 'docs' | 'bills' | 'msgs'>('home');
  const [cat, setCat] = useState('All');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const tm = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tm.current), []);
  const msg = (m: string) => { setToast(m); window.clearTimeout(tm.current); tm.current = window.setTimeout(() => setToast(''), 2600); };

  const sortedClients = useMemo(() => clients.slice().sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const client: Client | undefined = isClientLogin
    ? clients.find((x) => x.id === currentUser.id || (!!x.email && x.email.toLowerCase() === (currentUser.email || '').toLowerCase()))
    : clients.find((x) => x.id === cid) || sortedClients[0];

  const pickClient = (id: string) => {
    setCid(id); setTab('home'); setCat('All'); setDraft('');
    try { sessionStorage.setItem(PREVIEW_CLIENT_KEY, id); } catch { /* storage blocked */ }
  };

  const signOut = () => { if (preview) msg('Preview: the client would be signed out'); else logoutUser(); };

  const lk: Lookups = useMemo(() => ({
    clientById: new Map(clients.map((c) => [c.id, c] as [string, Client])),
    clientByName: new Map(clients.map((c) => [c.name.toLowerCase(), c] as [string, Client])),
    caseById: new Map(cases.map((c) => [c.id, c] as [string, Case])),
    caseByRef: new Map(cases.map((c) => [c.ref, c] as [string, Case])),
  }), [clients, cases]);

  /* -------------------------------------------- derived for the selected client */

  const files = useMemo(() => {
    if (!client) return [];
    // Same "files of a client" rule as Clients and the money figures (lib/moneyByFile).
    return casesOfClient(client, cases).filter((c) => c.status !== 'Archive').sort((a, b) => (a.status === 'Closed' ? 1 : 0) - (b.status === 'Closed' ? 1 : 0));
  }, [cases, client]);
  const openFiles = files.filter((f) => f.status !== 'Closed');
  const many = files.length > 1;

  const staff = useMemo(() => staffOf(users), [users]);
  const userByName = (name: string): User | undefined => {
    const n = name.trim().toLowerCase();
    return users.find((u) => u.role !== 'Client' && (u.name.toLowerCase() === n || (u.code || '').toLowerCase() === n));
  };

  if (!client) {
    return (
      <Shell preview={preview} clientOpts={sortedClients} cid="" pickClient={pickClient} back={() => setCurrentView('clients')} name={currentUser.name} email={currentUser.email} signOut={signOut} toast={toast}>
        <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;padding:28px 22px;font-size:13px;color:#4A5468;text-align:center')}>
          {isClientLogin ? 'We could not find your client record. Please contact the firm.' : 'No clients registered yet. Register a client in Clients to preview their portal.'}
        </section>
      </Shell>
    );
  }

  const vis = client.portal?.visibility;
  const see = { progress: vis?.progress ?? true, documents: vis?.documents ?? true, bills: (vis?.bills ?? true) && previewBilling, statement: (vis?.statement ?? true) && previewBilling, messages: vis?.messages ?? true };

  /* next court date */
  const today = todayIso();
  const upcoming = openFiles.flatMap((f) => (f.hearings || []).filter((h) => h.status === 'Scheduled' && isoOf(h.date) >= today).map((h) => ({ f, h })))
    .sort((a, b) => (isoOf(a.h.date) + (a.h.time || '') < isoOf(b.h.date) + (b.h.time || '') ? -1 : 1));
  const nx = upcoming[0];
  const attendTxt = (h: Hearing) => (h.clientAttendanceRequired === 'Compulsory' ? 'You need to attend.' : h.clientAttendanceRequired === 'Optional' ? 'You may attend if you wish.' : h.clientAttendanceRequired === 'Not Required' ? 'You do not need to attend.' : 'Your lawyer will tell you if you need to attend.');

  /* updates the Working File actually sent (e-mail / WhatsApp), plus older portal updates */
  const updates: Update[] = [
    ...files.flatMap((f) => (f.clientUpdates || []).filter((u) => isSentUpdate(u.deliveryStatus)).map((u) => ({ at: u.emailSentAt || u.whatsappOpenedAt || u.at, title: u.title, body: u.message, by: u.by || '', file: f.title }))),
    ...(client.portalUpdates || []).map((u) => ({ at: u.date, title: u.title, body: u.message, by: '', file: '' })),
  ].sort((a, b) => (String(a.at) < String(b.at) ? 1 : -1));
  const latestOn = (f: Case) => (f.clientUpdates || []).filter((u) => isSentUpdate(u.deliveryStatus)).sort((a, b) => (a.at < b.at ? 1 : -1))[0];

  /* what we need from the client (open items first, then what they have already done) */
  const quotesOf = quotations.filter((q) => q.partyId === client.id || (!q.partyId && q.clientName === client.name));
  const asks: Ask[] = [
    ...quotesOf.filter((q) => q.status === 'Sent').map((q) => ({
      id: 'q-' + q.id, kind: 'sign' as const, title: (q.documentType === 'Proforma' ? 'Review our proforma ' : 'Review and sign our quotation ') + q.id,
      note: 'Sent ' + fmt(q.documentSentDate || q.date) + ' · sets out our fees and scope',
      open: () => { const d = quotationToDoc(q, lk, 'Sent'); pdf(d.no, docHtml(d)); },
    })),
    ...openFiles.filter((f) => { const w = (f.weeklyStatus || [])[0]; return w && w.flag === 'Waiting on client'; }).map((f) => ({
      id: 'w-' + f.id, kind: 'note' as const, title: 'Your lawyer is waiting for something from you', note: f.title + ' · please message or call your lawyer',
    })),
    // Quotations the client has accepted on files still open: shown ticked, as in the design.
    ...quotesOf.filter((q) => q.status === 'Accepted' && (!q.caseId || openFiles.some((f) => f.id === q.caseId || f.ref === q.caseId))).map((q) => ({
      id: 'qa-' + q.id, kind: 'done' as const, title: (q.documentType === 'Proforma' ? 'Review our proforma ' : 'Review and sign our quotation ') + q.id,
      note: 'Sent ' + fmt(q.documentSentDate || q.date) + ' · accepted',
    })),
  ];
  const left = asks.filter((a) => a.kind !== 'done').length;

  /* legal team: lawyer in charge + partners on the open files */
  const team: { name: string; role: string; color: string; phone?: string; email?: string }[] = [];
  openFiles.forEach((f) => {
    const add = (name: string, role: string) => {
      if (!name || team.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;
      const u = userByName(name); const p = staff.find((s) => s.name === (u?.name || name));
      team.push({ name: u?.name || name, role, color: p?.color || '#3D6B9C', phone: u?.staffProfile?.phone, email: u?.email });
    };
    add(lawyerOf(f), 'Lawyer in charge');
    (f.partners || []).forEach((code) => { const p = staff.find((s) => s.code === code); if (p) add(p.name, 'Partner'); });
  });
  const firstLawyer = team[0];

  /* money: the one source for client money figures (lib/moneyByFile), issued bills only */
  const mc = moneyForClient(client, cases, { invoices, payments, retainers, quotations, receipts });
  const m = { bills: mc.bills.filter((b) => b.issued), billed: mc.billed, owing: mc.outstanding, paidTotal: mc.received, held: mc.clientAccount, ledger: mc.ledger };
  const dueBill = m.bills.filter((b) => b.bal > 0.005 && b.inv.dueDate).map((b) => b.inv).sort((a, b) => (isoOf(a.dueDate) < isoOf(b.dueDate) ? -1 : 1))[0];
  const settings = getPracticeSettings();
  const bank = (settings.bankAccounts || []).find((b) => b.isActive !== false && b.isDefaultOffice) || (settings.bankAccounts || []).find((b) => b.isActive !== false && b.accountType === 'Office Operating');
  const firmPhone = (settings.phone || '').split('/')[0].trim();

  const receiptsOf = (inv: Invoice): Receipt[] => receipts.filter((r) => r.invoiceId === inv.id || (r.forNo === inv.id && r.accountSet !== 'CLIENT'));

  /* documents shared with the client */
  const docs = files.flatMap((f) => (f.documents || []).filter((d) => d.sharedWithClient).map((d) => ({ d, f })))
    .sort((a, b) => (isoOf(a.d.uploadedDate) < isoOf(b.d.uploadedDate) ? 1 : -1));
  const cats = ['All', ...Array.from(new Set(docs.map((x) => x.d.category || 'Other')))];
  const openDoc = async (d: CaseDocument) => {
    if (d.driveFileId || d.storagePath) { const err = await openStoredFile({ driveFileId: d.driveFileId, webViewLink: d.driveUrl, path: d.storagePath }); if (err) msg(err); return; }
    if (d.driveUrl) { window.open(d.driveUrl, '_blank', 'noopener'); return; }
    if (d.dataUrl) { const err = openLegacyDataUrl(d.dataUrl, d.name); if (err) msg(err); return; }
    msg('This document has no stored copy. Please ask your lawyer.');
  };

  /* actions that send something: disabled in staff preview */
  const sendDoc = async (file: File) => {
    if (preview) { msg(PREVIEW_NOTE); return; }
    const f = openFiles[0];
    if (!f) { msg('You have no open file to send this to. Please e-mail your lawyer.'); return; }
    setBusy(true);
    try {
      await prepareStorage();
      const st = await storeMatterFile({ ref: f.ref, title: f.title, folderId: f.gdriveFolderId, sub: 'Documents', file, uploadedBy: client.name + ' (client portal)' });
      updateCase(f.id, { documents: [{ id: 'DOC-' + Date.now(), name: st.name, category: 'From client', uploadedDate: isoOf(st.uploadedAt), driveUrl: st.webViewLink, mimeType: st.contentType, driveFileId: st.driveFileId }, ...(f.documents || [])] });
      msg(file.name + ' sent to your lawyer');
    } catch (e) { msg('Not sent: ' + (e instanceof Error ? e.message : String(e))); }
    setBusy(false);
  };
  const uploadSlip = async (inv: Invoice, file: File) => {
    if (preview) { msg(PREVIEW_NOTE); return; }
    setBusy(true);
    try {
      await prepareStorage();
      const up = await storeFinanceProof(file, client.name + ' (client portal)', inv.id);
      updateInvoice(inv.id, { clientPaymentSlips: [...(inv.clientPaymentSlips || []), { name: file.name, driveFileId: up.driveFileId || '', webViewLink: up.webViewLink, uploadedAt: new Date().toISOString(), uploadedBy: client.name }] });
      msg('Slip received. Our accounts team will confirm');
    } catch (e) { msg('Not sent: ' + (e instanceof Error ? e.message : String(e))); }
    setBusy(false);
  };

  /* -------------------------------------------- tabs */

  const tabsDef: [typeof tab, string][] = [
    ['home', 'Overview'],
    ...(see.progress ? [['files', many ? 'My files (' + files.length + ')' : 'My file'] as [typeof tab, string]] : []),
    ...(see.documents ? [['docs', 'Documents'] as [typeof tab, string]] : []),
    ...(see.bills ? [['bills', 'Bills & payments'] as [typeof tab, string]] : []),
    ...(see.messages ? [['msgs', 'Messages'] as [typeof tab, string]] : []),
  ];
  const cur = tabsDef.some(([k]) => k === tab) ? tab : 'home';

  const short = client.type === 'Corporate' ? (client.contactPerson || client.name) : client.name;
  const greetSub = left ? 'There ' + (left === 1 ? 'is 1 thing' : 'are ' + left + ' things') + ' we need from you. Everything else is in hand.' : 'Nothing is needed from you right now. Here is where things stand.';

  const disabledNote = <span style={css('font-size:11px;color:#8A6D3B')}>{PREVIEW_NOTE}</span>;
  const btnOff = preview ? ';opacity:.5;cursor:not-allowed' : '';

  return (
    <Shell preview={preview} clientOpts={sortedClients} cid={client.id} pickClient={pickClient} back={() => setCurrentView('clients')} name={client.name} email={client.email} signOut={signOut} toast={toast}>
      <div style={css('display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 24px')}>
        <div style={css('flex:1 1 420px;min-width:0')}>
          <h1 style={css('margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.2;font-weight:700;color:#16223A;text-wrap:pretty')}>Selamat datang, {short}</h1>
          <p style={css('margin:6px 0 0;font-size:13.5px;line-height:1.5;color:#4A5468')}>{greetSub}</p>
        </div>
        {see.messages && <button type="button" onClick={() => setTab('msgs')} style={css('display:flex;align-items:center;gap:7px;border:0;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}><MessageCircle size={15} color="#FFFFFF" />Ask your lawyer</button>}
      </div>

      <nav style={css('display:flex;gap:6px;flex-wrap:wrap')}>
        {tabsDef.map(([k, label]) => {
          const on = cur === k; const badge = k === 'home' ? left : 0;
          return <button key={k} type="button" onClick={() => setTab(k)} style={css(`display:flex;align-items:center;gap:7px;border-radius:9999px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid ${on ? '#16223A' : '#E4DED2'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}{badge > 0 && !on && <span style={css('font-size:10.5px;font-weight:800;padding:0 7px;border-radius:9999px;background:#B23A2E;color:#fff')}>{badge}</span>}</button>;
        })}
      </nav>

      {/* ---------------------------------------------------------------- Overview */}
      {cur === 'home' && (
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;align-items:start')}>
          <div style={css('display:flex;flex-direction:column;gap:16px')}>
            {nx && (() => {
              const { f, h } = nx; const court0 = courtOf(f); const court = { ...court0, name: /^n\/?a\b/i.test(court0.name) ? '' : court0.name }; const d = daysTo(isoOf(h.date));
              const link = gcalLink('Court: ' + h.purpose, isoOf(h.date), h.time, f.title + (court.name ? '\n' + court.name : ''), court.name);
              return (
                <section style={css('border-radius:16px;background:#16223A;color:#fff;padding:20px 22px;display:flex;flex-direction:column;gap:14px')}>
                  <span style={css('font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8FB3DE')}>Next court date</span>
                  <div style={css('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
                    <div style={css('width:72px;flex-shrink:0;border-radius:12px;background:#fff;color:#16223A;text-align:center;overflow:hidden')}><div style={css('background:#B23A2E;color:#fff;font-size:11px;font-weight:800;padding:3px 0;letter-spacing:.06em')}>{fmt(h.date, { month: 'short' }).toUpperCase()}</div><div style={css('font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:1.15;padding:4px 0 6px')}>{fmt(h.date, { day: 'numeric' })}</div></div>
                    <div style={css('display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 200px')}>
                      <strong style={css('font-family:Georgia,serif;font-size:18px;line-height:1.3')}>{h.purpose}</strong>
                      <span style={css('font-size:12.5px;color:#C9D3E0')}>{fmt(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{h.time ? ' · ' + h.time : ''}</span>
                      {court.name && <span style={css('font-size:12.5px;color:#C9D3E0')}>{court.name}</span>}
                    </div>
                    <span style={css('font-size:12px;font-weight:700;padding:5px 11px;border-radius:9999px;background:#E6EFE9;color:#1F5A3B')}>{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days'}</span>
                  </div>
                  <div style={css('display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)')}>
                    <Info size={16} color="#8FB3DE" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={css('font-size:12.5px;line-height:1.5;color:#E8EDF3')}><strong style={css('color:#fff')}>{attendTxt(h)}</strong> {h.hearingReasonNote || ''}</span>
                  </div>
                  <div style={css('display:flex;gap:8px;flex-wrap:wrap')}>
                    {link && <a href={link} target="_blank" rel="noopener noreferrer" style={css('display:flex;align-items:center;gap:6px;border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;background:#8FB3DE;color:#16223A;text-decoration:none')}><CalendarPlus size={14} color="#16223A" />Add to Google Calendar</a>}
                    <span style={css('align-self:center;font-size:11.5px;color:#8FA0B8')}>{f.title}</span>
                  </div>
                </section>
              );
            })()}

            <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
              <div style={css('display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>What we need from you</strong>{left > 0 && <span style={css('font-size:11px;font-weight:800;padding:1px 8px;border-radius:9999px;background:#F6EEDC;color:#8A6D3B')}>{left} to do</span>}</div>
              {asks.map((a) => {
                const done = a.kind === 'done';
                return (
                  <div key={a.id} style={css('display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid #F3EFE7')}>
                    <span style={css(`width:22px;height:22px;flex-shrink:0;border-radius:9999px;display:grid;place-items:center;border:2px solid ${done ? '#1F5A3B' : '#C9BFAE'};background:${done ? '#1F5A3B' : '#fff'}`)}>{done && <Check size={12} color="#FFFFFF" />}</span>
                    <span style={css('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}><span style={css(`font-size:13px;font-weight:700;color:${done ? '#6B6458' : '#16223A'};text-decoration:${done ? 'line-through' : 'none'}`)}>{a.title}</span><span style={css('font-size:11.5px;color:#6B6458')}>{a.note}</span></span>
                    {a.kind === 'sign' && a.open && <button type="button" onClick={a.open} style={css('flex-shrink:0;border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>Review &amp; sign</button>}
                    {done && <span style={css('flex-shrink:0;font-size:11.5px;font-weight:700;color:#1F5A3B')}>Done</span>}
                  </div>
                );
              })}
              {!asks.length && <div style={css('padding:16px 18px;font-size:12.5px;color:#1F5A3B')}>Nothing needed right now. We'll let you know if that changes.</div>}
            </section>
          </div>

          <div style={css('display:flex;flex-direction:column;gap:16px')}>
            <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
              <div style={css('padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Latest updates</strong><span style={css('margin-left:8px;font-size:11.5px;color:#6B6458')}>also sent to you by WhatsApp and e-mail</span></div>
              {updates.slice(0, 5).map((u, i) => (
                <div key={i} style={css('display:grid;grid-template-columns:62px minmax(0,1fr);gap:12px;padding:12px 18px;border-bottom:1px solid #F3EFE7')}>
                  <span style={css('display:flex;flex-direction:column;line-height:1.25')}><strong style={css('font-size:13px;color:#16223A')}>{fmt(u.at, { day: 'numeric', month: 'short' })}</strong><span style={css('font-size:11px;color:#6B6458')}>{fmt(u.at, { year: 'numeric' })}</span></span>
                  <span style={css('display:flex;flex-direction:column;gap:3px;min-width:0')}><span style={css('font-size:13px;font-weight:700;color:#16223A')}>{u.title}</span><span style={css('font-size:12px;line-height:1.5;color:#4A5468;white-space:pre-line')}>{u.body}</span>{many && u.file && <span style={css('font-size:11px;color:#8A6D3B')}>{u.file}</span>}</span>
                </div>
              ))}
              {!updates.length && <div style={css('padding:16px 18px;font-size:12.5px;color:#6B6458')}>No updates yet. Your lawyer's updates will appear here.</div>}
            </section>

            {see.bills && (
              <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
                <strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Your account</strong>
                <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px')}>
                  <div style={css(`padding:12px 14px;border-radius:10px;background:${m.owing > 0 ? '#FBF1EF' : '#EFF5F1'}`)}><span style={css('display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B6458')}>To pay</span><strong style={css(`display:block;margin-top:3px;font-family:Georgia,serif;font-size:22px;color:${m.owing > 0 ? '#8E2A20' : '#1F5A3B'}`)}>{rm(m.owing)}</strong><span style={css('font-size:11px;color:#6B6458')}>{m.owing > 0 ? (dueBill ? 'due ' + fmt(dueBill.dueDate) : 'outstanding') : m.bills.length ? 'all bills paid' : 'no bills yet'}</span></div>
                  {see.statement && <div style={css('padding:12px 14px;border-radius:10px;background:#EEF3F9')}><span style={css('display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6B6458')}>We hold for you</span><strong style={css('display:block;margin-top:3px;font-family:Georgia,serif;font-size:22px;color:#2F4F7A')}>{rm(m.held)}</strong><span style={css('font-size:11px;color:#6B6458')}>in our client account</span></div>}
                </div>
                <button type="button" onClick={() => setTab('bills')} style={css('align-self:flex-start;border:1px solid #16223A;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>See bills &amp; pay</button>
              </section>
            )}

            <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
              <div style={css('padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Your legal team</strong></div>
              {team.map((p) => {
                const wa = whatsappLink(p.phone, '');
                return (
                  <div key={p.name} style={css('display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #F3EFE7')}>
                    <span style={css(`width:36px;height:36px;flex-shrink:0;border-radius:9999px;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;background:${p.color}`)}>{initialsOf(p.name)}</span>
                    <span style={css('display:flex;flex-direction:column;gap:1px;flex:1;min-width:0')}><strong style={css('font-size:13px;color:#16223A')}>{p.name}</strong><span style={css('font-size:11.5px;color:#6B6458')}>{p.role}</span></span>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:8px;border:1px solid #E4DED2')}><MessageCircle size={15} color="#1F5A3B" /></a>}
                    {p.email && <a href={'mailto:' + p.email} title="E-mail" style={css('display:grid;place-items:center;width:34px;height:34px;border-radius:8px;border:1px solid #E4DED2')}><Mail size={15} color="#3D6B9C" /></a>}
                  </div>
                );
              })}
              {!team.length && <div style={css('padding:12px 18px;font-size:12.5px;color:#6B6458')}>Your legal team will be shown here once a file is opened for you.</div>}
              <div style={css('padding:10px 18px;font-size:11.5px;color:#6B6458')}>Office hours Mon to Fri, 9am to 6pm{firmPhone ? ' · ' + firmPhone : ''}</div>
            </section>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- My file(s) */}
      {cur === 'files' && (
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          {files.map((f) => {
            const def = STEPS[stageKey(practiceOf(f))]; const step = stepOf(f); const court = courtOf(f);
            const meta = [/^n\/?a\b/i.test(court.name) ? '' : court.name, court.suit ? 'Suit no. ' + court.suit : '', f.clientRole ? 'you are the ' + f.clientRole : ''].filter(Boolean).join(' · ') || practiceOf(f);
            const lu = latestOn(f); const sn = stageNameOf(f);
            const now = lu ? lu.message : sn ? (s => s.charAt(0).toUpperCase() + s.slice(1))(stageMessage(sn)) : 'We will post an update here once your lawyer sends one.';
            const nowBy = lu ? 'Updated ' + fmt(lu.emailSentAt || lu.whatsappOpenedAt || lu.at) + (lu.by ? ' by ' + lu.by : '') : '';
            const nh = (f.hearings || []).filter((h) => h.status === 'Scheduled' && isoOf(h.date) >= today).sort((a, b) => (isoOf(a.date) < isoOf(b.date) ? -1 : 1))[0];
            const next = f.status === 'Closed' ? 'Your file is closed. Thank you for your instructions.' : nh ? nh.purpose + ' on ' + fmt(nh.date) + '. ' + attendTxt(nh) : 'Your lawyer will let you know the next step.';
            const kd: { d: string; what: string; tag: 'Court' | 'Deadline' | 'Done' }[] = [
              ...(f.hearings || []).filter((h) => h.status === 'Scheduled' || h.status === 'Completed').map((h) => ({ d: isoOf(h.date), what: h.purpose, tag: (h.status === 'Completed' || isoOf(h.date) < today ? 'Done' : 'Court') as 'Court' | 'Done' })),
              ...(f.tasks || []).filter((t: Task) => isDeadline(t) && t.dueDate).map((t) => ({ d: isoOf(t.dueDate), what: t.title, tag: (isDone(t) ? 'Done' : 'Deadline') as 'Deadline' | 'Done' })),
            ].filter((k) => k.d);
            const up = kd.filter((k) => k.tag !== 'Done').sort((a, b) => (a.d < b.d ? -1 : 1));
            const done = kd.filter((k) => k.tag === 'Done').sort((a, b) => (a.d < b.d ? 1 : -1));
            const dates = [...up, ...done].slice(0, 8);
            return (
              <section key={f.id} style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
                <div style={css('padding:18px 22px;border-bottom:1px solid #EFEAE0;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:flex-start')}>
                  <div style={css('flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:5px')}>
                    <span style={css('font-family:ui-monospace,monospace;font-size:11.5px;font-weight:700;color:#8A6D3B')}>{f.ref}</span>
                    <strong style={css('font-family:Georgia,serif;font-size:20px;line-height:1.3;color:#16223A')}>{f.title}</strong>
                    <span style={css('font-size:12.5px;color:#4A5468')}>{meta}</span>
                  </div>
                  <span style={css(`font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:9999px;background:${f.status === 'Closed' ? '#EEF1F5' : '#E6EFE9'};color:${f.status === 'Closed' ? '#4A5468' : '#1F5A3B'}`)}>{f.status}</span>
                </div>
                <div style={css('padding:20px 22px 8px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px')}>
                  {def.labels.map((label, i) => {
                    const isDoneStep = step !== null && i < step, isCur = step !== null && i === step;
                    return (
                      <div key={label} style={css('display:flex;flex-direction:column;gap:8px')}>
                        <div style={css(`height:6px;border-radius:9999px;background:${isDoneStep ? '#1F5A3B' : isCur ? '#8A6D3B' : '#E4DED2'}`)} />
                        <span style={css('display:flex;align-items:center;gap:6px')}><span style={css(`width:20px;height:20px;flex-shrink:0;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:800;background:${isDoneStep ? '#1F5A3B' : isCur ? '#8A6D3B' : '#fff'};color:${isDoneStep || isCur ? '#fff' : '#6B6458'};border:1.5px solid ${isDoneStep ? '#1F5A3B' : isCur ? '#8A6D3B' : '#C9BFAE'}`)}>{isDoneStep ? '✓' : String(i + 1)}</span><span style={css(`font-size:12px;line-height:1.3;font-weight:${isCur ? '800' : '600'};color:${isCur ? '#16223A' : isDoneStep ? '#4A5468' : '#6B6458'}`)}>{label}</span></span>
                      </div>
                    );
                  })}
                </div>
                <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding:14px 22px 20px')}>
                  <div style={css('padding:14px 16px;border-radius:12px;background:#FAF7F1;border:1px solid #EFEAE0;display:flex;flex-direction:column;gap:5px')}><span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8A6D3B')}>Where we are</span><span style={css('font-size:13px;line-height:1.55;color:#16223A;white-space:pre-line')}>{now}</span>{nowBy && <span style={css('font-size:11px;color:#6B6458')}>{nowBy}</span>}</div>
                  <div style={css('padding:14px 16px;border-radius:12px;background:#F2F6FA;border:1px solid #DFE7F0;display:flex;flex-direction:column;gap:5px')}><span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2F4F7A')}>What happens next</span><span style={css('font-size:13px;line-height:1.55;color:#16223A')}>{next}</span></div>
                </div>
                <div style={css('border-top:1px solid #EFEAE0')}>
                  <div style={css('padding:12px 22px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6B6458')}>Key dates</div>
                  {dates.map((k, i) => (
                    <div key={i} style={css('display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 22px;border-top:1px solid #F3EFE7')}>
                      <span style={css(`font-size:12.5px;font-weight:700;color:${k.tag === 'Done' ? '#6B6458' : '#16223A'}`)}>{fmt(k.d)}</span>
                      <span style={css('font-size:12.5px;color:#16223A')}>{k.what}</span>
                      <span style={css(`font-size:11px;font-weight:700;padding:2px 9px;border-radius:9999px;background:${KEY_TAG[k.tag][0]};color:${KEY_TAG[k.tag][1]}`)}>{k.tag}</span>
                    </div>
                  ))}
                  {!dates.length && <div style={css('padding:9px 22px 14px;border-top:1px solid #F3EFE7;font-size:12.5px;color:#6B6458')}>No dates fixed yet.</div>}
                </div>
              </section>
            );
          })}
          {!files.length && <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;padding:22px;font-size:13px;color:#6B6458')}>No files open yet.</section>}
        </div>
      )}

      {/* ---------------------------------------------------------------- Documents */}
      {cur === 'docs' && (
        <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
          <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #EFEAE0')}>
            <strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Documents</strong>
            <div style={css('display:flex;gap:4px;flex-wrap:wrap')}>{cats.map((k) => { const on = cat === k; return <button key={k} type="button" onClick={() => setCat(k)} style={css(`border-radius:9999px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${on ? '#16223A' : '#E4DED2'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{k}</button>; })}</div>
            <span style={css('margin-left:auto;display:flex;align-items:center;gap:8px')}>
              {preview && disabledNote}
              <label style={css('display:flex;align-items:center;gap:6px;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer' + btnOff + (busy ? ';opacity:.5' : ''))}><Upload size={13} color="#FFFFFF" />Send us a document<input type="file" disabled={preview || busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void sendDoc(file); }} style={css('display:none')} /></label>
            </span>
          </div>
          {docs.filter((x) => cat === 'All' || (x.d.category || 'Other') === cat).map(({ d, f }) => {
            const [Ic, ibg, ic] = DOC_CAT[d.category] || DOC_CAT.Letters;
            return (
              <div key={f.id + d.id} style={css('display:grid;grid-template-columns:34px minmax(0,1fr) 120px 96px auto;gap:12px;align-items:center;padding:11px 18px;border-bottom:1px solid #F3EFE7')}>
                <span style={css(`width:34px;height:34px;border-radius:8px;display:grid;place-items:center;background:${ibg}`)}><Ic size={16} color={ic} /></span>
                <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('font-size:13px;font-weight:700;color:#16223A')}>{d.name}</span><span style={css('font-size:11px;color:#6B6458')}>{many ? f.title : f.ref}</span></span>
                <span style={css('font-size:11.5px;color:#4A5468')}>{d.category}</span>
                <span style={css('font-size:11.5px;color:#6B6458')}>{fmt(d.uploadedDate)}</span>
                <button type="button" onClick={() => void openDoc(d)} style={css('display:flex;align-items:center;gap:5px;border:1px solid #E4DED2;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}><Download size={13} color="#3D6B9C" />Download</button>
              </div>
            );
          })}
          {!docs.length && <div style={css('padding:16px 18px;font-size:12.5px;color:#6B6458')}>No documents shared with you yet. Your lawyer will share documents here.</div>}
          <div style={css('padding:10px 18px;background:#FAF7F1;font-size:11.5px;color:#6B6458')}>Documents are confidential between you and the firm (s. 126 Evidence Act 1950). Please don't forward them without asking us.</div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Bills & payments */}
      {cur === 'bills' && (
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px')}>
            {[
              { k: 'Billed so far', v: rm(m.billed), sub: m.bills.length + (m.bills.length === 1 ? ' bill' : ' bills'), c: '#16223A' },
              { k: 'Paid', v: rm(m.paidTotal), sub: m.paidTotal > 0 ? 'thank you' : 'nothing paid yet', c: '#1F5A3B' },
              { k: 'To pay', v: rm(m.owing), sub: m.owing > 0 ? (dueBill ? 'due ' + fmt(dueBill.dueDate) : 'outstanding') : 'nothing due', c: m.owing > 0 ? '#8E2A20' : '#16223A' },
              ...(see.statement && m.ledger.length ? [{ k: 'We hold for you', v: rm(m.held), sub: 'client account', c: '#2F4F7A' }] : []),
            ].map((s) => <div key={s.k} style={css('display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:14px;border:1px solid #E4DED2;background:#fff')}><span style={css('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6B6458')}>{s.k}</span><strong style={css(`font-family:Georgia,serif;font-size:22px;color:${s.c}`)}>{s.v}</strong><span style={css('font-size:11.5px;color:#6B6458')}>{s.sub}</span></div>)}
          </div>
          <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
            <div style={css('display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Bills</strong>{preview && <span style={css('margin-left:auto')}>{disabledNote}</span>}</div>
            {m.bills.map((b) => {
              const inv = b.inv; const bal = b.bal; const isPaid = bal <= 0.005; const checking = !isPaid && (inv.clientPaymentSlips || []).length > 0;
              const status = checking ? 'Checking payment' : isPaid ? 'Paid' : 'To pay';
              const [sbg, sfg] = checking ? ['#E4ECF5', '#2F4F7A'] : isPaid ? ['#E6EFE9', '#1F5A3B'] : ['#F6E4E1', '#8E2A20'];
              const rc = receiptsOf(inv);
              const kase = lk.caseById.get(inv.caseId) || lk.caseByRef.get(inv.caseId) || (inv.fileRef ? lk.caseByRef.get(inv.fileRef) : undefined);
              const view = () => { const d = invoiceToDoc(inv, lk, status); pdf(d.no, docHtml(d)); };
              return (
                <div key={inv.id} style={css('display:grid;grid-template-columns:120px minmax(0,1fr) 110px 100px auto;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid #F3EFE7')}>
                  <button type="button" onClick={view} style={css('justify-self:start;border:0;background:none;padding:0;font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:#3D6B9C;cursor:pointer;text-decoration:underline')}>{inv.id}</button>
                  <span style={css('display:flex;flex-direction:column;gap:2px;min-width:0')}><span style={css('font-size:13px;font-weight:700;color:#16223A')}>{b.what || kase?.title || 'Legal fees'}</span><span style={css('font-size:11px;color:#6B6458')}>Issued {fmt(inv.issuedAt || inv.date, { day: 'numeric', month: 'short' })}{!isPaid && inv.dueDate ? ' · due ' + fmt(inv.dueDate, { day: 'numeric', month: 'short' }) : ''}{!isPaid && bal < Number(inv.total || 0) - 0.005 ? ' · ' + rm(bal) + ' left' : ''}</span></span>
                  <strong style={css('text-align:right;font-size:13px;color:#16223A')}>{rm(Number(inv.total || 0))}</strong>
                  <span style={css(`justify-self:start;font-size:11px;font-weight:700;padding:2px 9px;border-radius:9999px;background:${sbg};color:${sfg}`)}>{status}</span>
                  <span style={css('justify-self:end;display:flex;gap:6px')}>
                    {!isPaid && !checking && <label title={preview ? PREVIEW_NOTE : 'Upload your bank transfer slip'} style={css('border:1px solid #E4DED2;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer' + btnOff)}>Upload slip<input type="file" disabled={preview || busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadSlip(inv, file); }} style={css('display:none')} /></label>}
                    {rc.length > 0 && <button type="button" onClick={() => rc.forEach((r) => { const d = receiptToDoc(r, lk, []); pdf(d.no, docHtml(d)); })} style={css('border:1px solid #E4DED2;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}>Receipt</button>}
                  </span>
                </div>
              );
            })}
            {!m.bills.length && <div style={css('padding:16px 18px;font-size:12.5px;color:#6B6458')}>No bills yet.</div>}
            <div style={css('padding:10px 18px;background:#FAF7F1;font-size:11.5px;color:#6B6458')}>
              {bank ? <>Transfer to {bank.accountName}, {bank.bankName.replace(/\s+Berhad$/i, '')} {bank.accountNo}, and upload the slip. Official receipt is issued within 1 working day.</> : <>Please ask us for our bank details, then upload the slip here.</>} Online payment (FPX / DuitNow) is not available yet.
            </div>
          </section>
          {see.statement && m.ledger.length > 0 && (() => {
            const rows = m.ledger;
            const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });
            const stmt = () => pdf('Client account statement ' + client.name, tableHtml('Client account statement · ' + client.name, 'To ' + fmt(today), ['Date', 'Details', 'Amount (RM)', 'Balance (RM)'], rows.map((x) => [fmt(x.date), x.desc, (x.amount < 0 ? '-' : '') + Math.abs(x.amount).toFixed(2), x.bal.toFixed(2)])));
            return (
              <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden')}>
                <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Money we hold for you</strong><span style={css('font-size:11.5px;color:#6B6458')}>client account, kept separate from the firm's money</span><button type="button" onClick={stmt} style={css('margin-left:auto;display:flex;align-items:center;gap:5px;border:1px solid #E4DED2;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer')}><Download size={13} color="#3D6B9C" />{monthName} statement</button></div>
                {rows.map((r) => (
                  <div key={r.id} style={css('display:grid;grid-template-columns:90px minmax(0,1fr) 110px 110px;gap:12px;align-items:center;padding:10px 18px;border-bottom:1px solid #F3EFE7')}>
                    <span style={css('font-size:12px;color:#6B6458')}>{fmt(r.date, { day: 'numeric', month: 'short' })}</span><span style={css('font-size:12.5px;color:#16223A')}>{r.desc}</span><span style={css(`text-align:right;font-size:12.5px;font-weight:600;color:${r.amount < 0 ? '#8E2A20' : '#1F5A3B'}`)}>{(r.amount < 0 ? '− ' : '+ ') + rm(Math.abs(r.amount))}</span><span style={css('text-align:right;font-size:12.5px;font-weight:700;color:#16223A')}>{rm(r.bal)}</span>
                  </div>
                ))}
              </section>
            );
          })()}
        </div>
      )}

      {/* ---------------------------------------------------------------- Messages */}
      {cur === 'msgs' && (
        <section style={css('border-radius:16px;background:#fff;border:1px solid #E4DED2;overflow:hidden;display:flex;flex-direction:column')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #EFEAE0')}><strong style={css('font-family:Georgia,serif;font-size:16px;color:#16223A')}>Messages</strong><span style={css('font-size:11.5px;color:#6B6458')}>{firstLawyer ? 'with ' + firstLawyer.name + ' (' + firstLawyer.role.toLowerCase() + ')' : 'with your legal team'}</span></div>
          <div style={css('display:flex;flex-direction:column;gap:12px;padding:18px;background:#FAF7F1;max-height:460px;overflow:auto')}>
            {updates.slice().reverse().map((u, i) => (
              <div key={i} style={css('display:flex;flex-direction:column;gap:3px;max-width:78%;align-self:flex-start')}>
                <span style={css('font-size:11px;color:#6B6458;align-self:flex-start')}>{u.by || 'Syafiqah Hamizad & Co'} · {fmt(u.at, { day: 'numeric', month: 'short' })}{timeOf(u.at) ? ', ' + timeOf(u.at) : ''}</span>
                <div style={css('padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5;background:#fff;color:#16223A;border:1px solid #E4DED2;white-space:pre-line')}><strong>{u.title}</strong>{'\n'}{u.body}</div>
              </div>
            ))}
            {!updates.length && <span style={css('font-size:12.5px;color:#6B6458')}>No messages yet.</span>}
          </div>
          <div style={css('display:flex;flex-direction:column;gap:10px;padding:14px 18px;border-top:1px solid #EFEAE0')}>
            <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>{['Can I have an update?', 'Can we meet this week?', 'I have a question about my bill'].map((q) => <button key={q} type="button" onClick={() => setDraft(q)} style={css('border:1px solid #E4DED2;border-radius:9999px;padding:5px 12px;font-size:12px;font-weight:600;background:#fff;color:#16223A;cursor:pointer')}>{q}</button>)}</div>
            <div style={css('display:flex;gap:8px;align-items:flex-end')}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Write to your lawyer…" style={css('flex:1;border:1px solid #E4DED2;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;color:#16223A;resize:vertical;outline-color:#3D6B9C;font-family:inherit')} />
              <button type="button" disabled title={preview ? PREVIEW_NOTE : 'Portal messages are not connected yet'} style={css('display:flex;align-items:center;gap:6px;border:0;border-radius:10px;padding:11px 16px;font-size:13px;font-weight:700;background:#16223A;color:#fff;opacity:.5;cursor:not-allowed')}><Send size={14} color="#FFFFFF" />Send</button>
            </div>
            <span style={css('font-size:11px;color:#6B6458')}>
              {preview ? 'Preview: nothing is sent. ' : ''}Sending from the portal is not connected yet{firstLawyer?.email ? <>: please <a href={'mailto:' + firstLawyer.email + (draft.trim() ? '?body=' + encodeURIComponent(draft.trim()) : '')}>e-mail {firstLawyer.name}</a></> : ''}{whatsappLink(firstLawyer?.phone, '') ? <> or <a href={whatsappLink(firstLawyer?.phone, draft.trim()) || '#'} target="_blank" rel="noopener noreferrer">WhatsApp</a></> : ''}. For anything urgent on a court day, call the office.
            </span>
          </div>
        </section>
      )}
    </Shell>
  );
};

/* ================================================================== shell (preview bar + top bar) */

const Shell: React.FC<{
  preview: boolean; clientOpts: Client[]; cid: string; pickClient: (id: string) => void; back: () => void;
  name: string; email: string; signOut: () => void; toast: string; children: React.ReactNode;
}> = ({ preview, clientOpts, cid, pickClient, back, name, email, signOut, toast, children }) => (
  <div data-screen-label="Client portal" style={css(`min-height:100vh;background:${BG};font-size:13px;display:flex;flex-direction:column;font-family:Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;color:#16223A`)}>
    {preview && (
      <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:9px 24px;background:#8A6D3B;color:#fff;font-size:12px')}>
        <Eye size={15} color="#FFFFFF" />
        <strong>Staff preview</strong><span style={css('color:#F6EEDC')}>You are seeing exactly what the client sees. Nothing here is sent.</span>
        <label style={css('display:flex;align-items:center;gap:6px;margin-left:auto')}><span style={css('color:#F6EEDC')}>Client</span><select value={cid} onChange={(e) => pickClient(e.target.value)} style={css('border:0;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:700;color:#16223A;max-width:260px')}>{clientOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <button type="button" onClick={back} style={css('border:0;background:none;padding:0;color:#fff;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit')}>Back to client profile</button>
      </div>
    )}
    <header style={css('background:#fff;border-bottom:1px solid #E4DED2')}>
      <div style={css('max-width:1120px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
        <img src="/assets/sh-wordmark.png" alt="Syafiqah Hamizad & Co" style={css('height:38px;width:auto;display:block')} />
        <span style={css('font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A6D3B;border-left:1px solid #E4DED2;padding-left:14px')}>Client portal</span>
        <div style={css('margin-left:auto;display:flex;align-items:center;gap:12px')}>
          <span style={css('display:flex;flex-direction:column;align-items:flex-end;line-height:1.3')}><strong style={css('font-size:12.5px;color:#16223A')}>{name}</strong><span style={css('font-size:11px;color:#6B6458')}>{email}</span></span>
          <button type="button" onClick={signOut} style={css('display:flex;align-items:center;gap:6px;border:1px solid #E4DED2;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;background:#fff;color:#16223A;cursor:pointer')}><LogOut size={14} color="#3D6B9C" />Sign out</button>
        </div>
      </div>
    </header>
    <main style={css('flex:1;width:100%;max-width:1120px;margin:0 auto;padding:28px 24px 56px;display:flex;flex-direction:column;gap:20px')}>
      {children}
    </main>
    {toast && <div style={css('position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;border-radius:8px;padding:10px 16px;background:#16223A;color:#fff;font-size:13px;font-weight:600')}>{toast}</div>}
  </div>
);
