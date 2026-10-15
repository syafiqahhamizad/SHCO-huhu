import React from 'react';
import type { FinanceCtrl, EditorState } from './useFinanceController';
import { css, DRIVE_REQUIRED_MSG, filesToProofs, proofMissingMsg, proofUploadBlocked, rm2 } from './financeModel';
import { storageLabel } from '../../../services/fileStorageService';
import * as SD from '../../../lib/financeDocs';
import { defaultPlanFor, hasAmt, planRows, planTotal } from '../../../lib/engagementLetter';
import type { QuotationPaymentStage } from '../../../types';
import { PlanRowsPanel } from './PlanRowsPanel';
import { PV_DRAWINGS, PV_SST, PV_STATUTORY } from '../../../lib/financeCalc';
import type { FinanceProof, Invoice, Quotation } from '../../../types';
import { getPracticeSettings, DEFAULT_EXPENSE_CATEGORIES } from '../../../services/templateService';
import { SearchSelect } from '../../ui/SearchSelect';

/** Office expense categories from Firm & Practice Settings → Lists & sources. */
const expenseCategories = (): string[] => {
  const l = (getPracticeSettings().expenseCategories || []).map((x) => x.trim()).filter(Boolean);
  return l.length ? l : DEFAULT_EXPENSE_CATEGORIES;
};

const seg = (opts: string[], cur: string, set: (v: string) => void) => opts.map((o) => { const on = o === cur; return <button key={o} type="button" onClick={() => set(o)} style={css(`border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{o}</button>; });
const INPUT = 'width:100%;border:1px solid #DDE3EB;border-radius:6px;padding:6px 8px;font-size:11.5px;font-family:inherit;color:#16223A;background:#fff';
const LBL = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478';
const BTN = 'border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap';
const BTN_DARK = 'border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap';

const ClientList = ({ F }: { F: FinanceCtrl }) => (
  <>
    <datalist id="fin-clients">{F.app.clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
    <datalist id="fin-cases">{F.app.cases.filter((c) => F.ownCase(c)).map((c) => <option key={c.id} value={c.ref}>{c.title}</option>)}</datalist>
    <datalist id="fin-invoices">{F.openInvoices.map((i) => <option key={i.id} value={i.id}>{(i.partyName || '') + ' · ' + rm2(F.invBal(i))}</option>)}</datalist>
  </>
);

/* ------------------------------ Import past transactions ------------------------------ */
export const ImportModal = ({ F }: { F: FinanceCtrl }) => {
  const I0 = F.imp!; const setI = (p: Partial<typeof I0>) => F.setImp({ ...I0, ...p });
  const list = F.importRows(I0); const okN = list.filter((r) => r.ok).length;
  const TIP = { Template: 'Fill in one row per invoice, receipt or payment using the template. Proof reference = file name or bank reference; you can attach the actual file to each entry after posting.', Bank: 'Export the statement from Hong Leong Connect as Excel or CSV. Credits become receipts and debits become payments. Entries without a client are posted and flagged "Match client later".', Software: 'Export the receipts / payments or cash book listing from SQL, AutoCount or Xero to Excel. Columns are matched by heading (Date, Client, Description, Amount, Debit/Credit…). Rename a heading if it is not picked up.' };
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <div style={css('width:1040px;max-width:calc(100vw - 32px);align-self:flex-start;border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 18px;background:#16223A')}><strong style={css('font-size:14px;color:#fff')}>Import past transactions</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>{I0.mode === 'books' ? 'posted to the cash book and ledgers · marked Historical' : 'for reference only · not counted in any total'}</span><button type="button" onClick={() => F.setImp(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button></div>
        <div style={css('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>1 · Source</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{([['Template', 'Excel / Sheets (our template)'], ['Bank', 'Bank statement export'], ['Software', 'Other software (SQL / AutoCount / Xero)']] as const).map(([k, label]) => { const on = I0.src === k; return <button key={k} type="button" onClick={() => setI({ src: k })} style={css(`border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}</div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>How to keep them</span><div style={css('display:flex;flex-wrap:wrap;gap:4px;align-items:center')}>{seg(['For reference only', 'Into the books'], I0.mode === 'books' ? 'Into the books' : 'For reference only', (v) => setI({ mode: v === 'Into the books' ? 'books' : 'reference' }))}<span style={css('font-size:10.5px;color:#5B6478')}>{I0.mode === 'books' ? 'Counts in balances and what clients owe. Only if the accountant gives no opening balance for this period.' : 'Invoices and receipts with their old numbers, to look back at. Nothing changes in the totals. Attach each PDF afterwards.'}</span></div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Default account</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Office', 'Client account', 'Petty cash'], I0.acc, (v) => setI({ acc: v as typeof I0.acc }))}</div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>2 · File</span><div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}><button type="button" onClick={() => SD.importTemplate()} style={css(BTN)}>Download template</button><label style={css(BTN_DARK)}>Choose Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) F.importFile(fl); }} style={css('display:none')} /></label><span style={css('font-size:10.5px;color:#5B6478')}>{I0.fileName}</span></div></div>
          <p style={css('margin:0;font-size:10.5px;line-height:1.5;color:#5B6478')}>{TIP[I0.src]}</p>
          {list.length > 0 && (
            <div style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
              <div style={css('display:flex;gap:10px;padding:8px 12px;background:#F6F8FA;font-size:11px;color:#16223A')}><strong>3 · Check</strong><span>{list.length + ' rows read · ' + okN + ' ready to post · ' + (list.length - okN) + ' need fixing in the file'}</span></div>
              <div style={css('display:grid;grid-template-columns:80px 76px 90px minmax(0,1fr) 96px minmax(0,1.2fr) 90px 110px 120px;gap:8px;padding:6px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Type</span><span>Account</span><span>Client</span><span>Doc no.</span><span>Description</span><span style={css('text-align:right')}>Amount</span><span>Proof</span><span>Status</span></div>
              <div style={css('max-height:340px;overflow:auto')}>
                {list.slice(0, 200).map((r, i) => (
                  <div key={i} style={css('display:grid;grid-template-columns:80px 76px 90px minmax(0,1fr) 96px minmax(0,1.2fr) 90px 110px 120px;gap:8px;align-items:center;padding:6px 12px;border-bottom:1px solid #F0F2F5;font-size:11px;color:#16223A')}>
                    <span>{r.date}</span><span>{r.type}</span><span>{r.acc}</span><span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.client}</span><span>{r.no}</span><span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.desc}</span><span style={css('text-align:right;font-weight:700')}>{r.amt ? SD.money(r.amt) : '—'}</span><span style={css('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#5B6478')}>{r.proof}</span>
                    <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${r.sbg};color:${r.sfg}`)}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={css('display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #EEF1F5;padding-top:12px')}><button type="button" onClick={() => F.setImp(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={() => F.postImport(list)} style={css(`${BTN_DARK};opacity:${okN ? 1 : 0.45}`)}>{I0.mode === 'books' ? (okN ? 'Post ' + okN + ' entries as historical' : 'Post entries') : (okN ? 'Record ' + okN + ' past papers' : 'Record past papers')}</button></div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Document viewer (screen = PDF source) ------------------------------ */
export const DocViewModal = ({ F }: { F: FinanceCtrl }) => {
  const ref = F.view!; const d = F.buildDoc(ref); const rec = F.recordOf(ref);
  if (!d || !rec) return null;
  const html = SD.docHtml(d);
  const acts = F.actionsFor(ref.kind, rec).filter((a) => a !== 'View');
  // Send to client is always available here (never required), except for papers from before the portal.
  if (F.rk !== 'R' && !acts.includes('Send') && !acts.includes('Resend') && !(rec as Quotation).historical && !(rec as { recordOnly?: boolean }).recordOnly) acts.unshift('Send');
  if (ref.kind !== 'receipt' && ['Draft', 'Sent', 'Accepted', 'Unpaid', 'Ready', 'Pending Approval'].includes(d.status || '') && F.rk !== 'R') acts.push('Edit');
  if (ref.kind === 'invoice' && d.status === 'Overdue' && (rec as Invoice).writeOffRequest?.status !== 'Pending' && (F.canPrepare || F.canApprove)) acts.push('Request write-off');
  const proofs = (d.proofs || []);
  const hasProofSlot = d.type === 'Receipt' || proofs.length > 0;
  const openProof = (q: { name: string; url: string }) => { if (q.url) window.open(q.url, '_blank', 'noopener'); else F.toastMsg(proofMissingMsg(q.name)); };
  const statusLabel = ref.kind === 'invoice' && (rec as Invoice).writeOffRequest?.status === 'Pending' ? d.status + ' · write-off requested' : d.status;
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <div style={css('width:840px;max-width:calc(100vw - 32px);align-self:flex-start;display:flex;flex-direction:column;gap:10px')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#16223A;border-radius:10px;padding:8px 12px')}>
          <strong style={css('color:#fff;font-size:13px')}>{d.no}</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>{d.type} · {statusLabel}</span>
          <div style={css('margin-left:auto;display:flex;gap:6px;flex-wrap:wrap')}>
            {acts.map((a, i) => <button key={a} type="button" onClick={() => F.act(ref.kind, rec as Quotation | Invoice, a)} style={css(`border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;background:${i === 0 ? '#C9A86A' : '#fff'};color:#16223A`)}>{a}</button>)}
            <button type="button" onClick={() => SD.pdf(d.no, html)} style={css('border:1px solid #B23A2E;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#B23A2E;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>PDF / Print</button>
            <button type="button" onClick={() => F.setView(null)} style={css('border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button>
          </div>
        </div>
        {ref.kind === 'quotation' && (rec as Quotation).documentType !== 'Proforma' && <PlanRowsPanel F={F} q={rec as Quotation} />}
        {hasProofSlot && (
          <div style={css(`display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-radius:10px;padding:8px 12px;background:${proofs.length ? '#E6EFE9' : '#FBEDE9'}`)}>
            <strong style={css('font-size:11.5px;color:#16223A')}>Proof of payment</strong>
            {!proofs.length && <span style={css('font-size:11px;font-weight:600;color:#B23A2E')}>No proof attached yet: attach the bank-in slip, screenshot, cheque copy or WhatsApp.</span>}
            {proofs.map((pf) => <button key={pf.name} type="button" onClick={() => openProof(pf)} style={css('border:1px solid #BFD3C6;border-radius:14px;padding:3px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#2F6F4E;cursor:pointer;font-family:inherit')}>✓ {pf.name}</button>)}
            {ref.kind === 'receipt' && <label style={css('margin-left:auto;border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Attach proof<input type="file" multiple accept="image/*,.pdf" onChange={(e) => F.attachTo('receipt', d.id)(e.target.files)} style={css('display:none')} /></label>}
          </div>
        )}
        <div style={css('flex-shrink:0;width:794px;max-width:100%;min-height:1123px;margin:0 auto;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.3);padding:48px 58px;box-sizing:border-box;overflow-x:auto')} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
};

/* ------------------------------ Document editor ------------------------------ */
export const DocEditModal = ({ F }: { F: FinanceCtrl }) => {
  const e = F.ed!;
  const setE = (p: Partial<EditorState>) => F.setEd({ ...e, ...p });
  const setLines = (fn: (L: SD.DocLines) => void) => { const L: SD.DocLines = { prof: SD.clone(e.lines.prof), disb: SD.clone(e.lines.disb), reimb: SD.clone(e.lines.reimb) }; fn(L); setE({ lines: L }); };
  const t = SD.totals({ type: e.type, lines: e.lines, sstRate: e.sstRate });
  const pct = Math.round((e.sstRate || 0) * 100);
  const sum = (L: SD.DocLine[]) => L.reduce((s, x) => s + (Number(x[1]) || 0), 0);
  const onRef = (v: string) => { const k = F.app.cases.find((c) => c.ref === v.trim()); if (!k) { setE({ ref: v }); return; } const cn = F.clientName(k.clientId.split(',')[0].trim()) || k.clientName || ''; const area = SD.areaFromName(k.practiceArea || k.type, k.ref); setE({ ref: v, matter: e.matter || k.title || '', client: e.client || cn, ...(e.id ? {} : { area, lines: SD.fromTemplate(area), desc: e.type === 'Proforma' ? e.desc : SD.AREAS[area].desc, plan: defaultPlanFor(area) }) }); };
  // Client or lead (searchable); the file ref follows: filled in when they have one file, a choice when more.
  const whoOpts = [
    ...F.app.clients.map((c) => ({ value: c.name, label: c.name, hint: 'Client' })),
    ...(F.app.leads || []).filter((l) => !F.app.clients.some((c) => c.name === l.name)).map((l) => ({ value: l.name, label: l.name, hint: 'Lead' })),
  ];
  const whoClient = F.app.clients.find((c) => c.name === e.client);
  const filesOfWho = whoClient ? F.app.cases.filter((k) => String(k.clientId || '').split(',').map((x) => x.trim()).includes(whoClient.id) || k.clientName === whoClient.name) : [];
  const refOpts = filesOfWho.map((k) => ({ value: k.ref, label: k.ref, hint: k.title }));
  const pickWho = (name: string) => {
    const c = F.app.clients.find((x) => x.name === name);
    const files = c ? F.app.cases.filter((k) => (String(k.clientId || '').split(',').map((x) => x.trim()).includes(c.id) || k.clientName === c.name) && k.status !== 'Closed' && k.status !== 'Archive') : [];
    if (files.length === 1) { const k = files[0]; const area = SD.areaFromName(k.practiceArea || k.type, k.ref); setE({ client: name, ref: k.ref, matter: k.title || '', ...(e.id ? {} : { area, lines: SD.fromTemplate(area), desc: e.type === 'Proforma' && e.area === 'Consultation' ? e.desc : SD.AREAS[area].desc, plan: defaultPlanFor(area) }) }); }
    else setE({ client: name, ref: '', matter: '' });
  };
  const consultation = () => setE({ type: 'Proforma', area: 'Consultation', lines: SD.fromTemplate('Consultation'), desc: SD.AREAS.Consultation.desc, plan: defaultPlanFor('Consultation') });
  const sched = e.inst && e.inst.on ? SD.schedule(t.total, e.inst.months, e.inst.upfront) : [];
  const isQuote = e.type === 'Quotation';
  const planKindLabel = e.plan.kind === 'Stages' ? 'Stages' : e.plan.kind === 'Instalments' ? 'Monthly instalments' : 'Pay in full';
  const stageRows = e.plan.kind === 'Stages' ? planRows(e.plan, t.total) : [];
  const stageSum = e.plan.kind === 'Stages' ? planTotal(e.plan, t.total) : 0;
  const setStage = (i: number, p: Partial<QuotationPaymentStage>) => setE({ plan: { ...e.plan, stages: (e.plan.stages || []).map((x, j) => (j === i ? { ...x, ...p } : x)) } });
  const sections: [keyof SD.DocLines, string, string][] = [['prof', 'A. Professional fees', pct ? `SST ${pct}%` : 'SST not applicable'], ['disb', 'B. Disbursements', 'paid to third parties · no SST'], ['reimb', 'C. Reimbursements', pct ? `our own costs · SST ${pct}%` : 'our own costs']];
  const sums: [string, number][] = [['Professional fees', t.prof], ['Disbursements', t.disb], ['Reimbursements', t.reimb], ...(e.type === 'Proforma' ? [] : [[pct ? `SST ${pct}%` : 'SST (not applicable)', t.sst] as [string, number]])];
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <ClientList F={F} />
      <div style={css('width:980px;max-width:calc(100vw - 32px);align-self:flex-start;border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 18px;background:#16223A')}><strong style={css('font-size:14px;color:#fff;text-transform:capitalize')}>{(e.id ? 'Edit ' : 'New ') + e.type.toLowerCase()}</strong><button type="button" onClick={() => F.setEd(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button></div>
        <div style={css('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
          {!e.id && <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Document</span><div style={css('display:flex;flex-wrap:wrap;gap:4px;align-items:center')}>{seg(['Quotation', 'Proforma', 'Invoice'], e.type, (v) => setE({ type: v as EditorState['type'] }))}<button type="button" onClick={consultation} title="A proforma for a consultation fee, before a file is opened" style={css('margin-left:8px;border:1px dashed #8A6D3B;border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;background:#FBF8F1;color:#8A6D3B;cursor:pointer;font-family:inherit')}>+ Consultation proforma</button></div></div>}
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Practice area</span><select value={e.area} onChange={(ev) => { const v = ev.target.value; setE({ area: v, lines: SD.fromTemplate(v), desc: e.type === 'Proforma' ? e.desc : SD.AREAS[v].desc, ...(e.id ? {} : { plan: defaultPlanFor(v) }) }); }} style={css(INPUT + ';max-width:280px;cursor:pointer')}>{Object.keys(SD.AREAS).map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Pay into</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Office', 'Client account'], e.account, (v) => setE({ account: v as EditorState['account'] }))}</div></div>
          <div style={css('display:grid;grid-template-columns:150px repeat(2,minmax(0,1fr));gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Date</span><input type="date" value={e.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} onChange={(ev) => setE({ date: ev.target.value })} style={css(INPUT)} /></label>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Client or lead</span><SearchSelect aria-label="Client or lead" value={e.client} onChange={pickWho} placeholder="Search a client or lead…" empty="Not found. Add them in Clients or Leads first." options={whoOpts} /></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>File ref.</span><SearchSelect aria-label="File ref" value={e.ref} onChange={(v) => onRef(v)} clearable placeholder={e.client ? (refOpts.length ? 'Choose the file…' : 'No file yet (fine for a lead or consultation)') : 'Pick the client first'} empty="No file for this client yet." options={refOpts} /></div>
          </div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Your Ref</span><input value={e.yourRef} onChange={(ev) => setE({ yourRef: ev.target.value })} style={css(INPUT)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Subject</span><input value={e.subject} onChange={(ev) => setE({ subject: ev.target.value })} placeholder="e.g. TENANCY (SUMMON – SETTLEMENT)" style={css(INPUT)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Label (optional)</span><input value={e.label || ''} onChange={(ev) => setE({ label: ev.target.value })} placeholder="e.g. Balance after trial · used for the Drive file name" style={css(INPUT)} /></label>
          </div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>SST</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Not applicable', 'SST 6%', 'SST 8%'], e.sstRate === 0.06 ? 'SST 6%' : e.sstRate === 0.08 ? 'SST 8%' : 'Not applicable', (v) => setE({ sstRate: v === 'SST 6%' ? 0.06 : v === 'SST 8%' ? 0.08 : 0 }))}</div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>{isQuote ? 'Payment plan' : 'Fee arrangement'}</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{isQuote
            ? seg(['Pay in full', 'Stages', 'Monthly instalments'], planKindLabel, (v) => { const kind = v === 'Stages' ? 'Stages' : v === 'Monthly instalments' ? 'Instalments' : 'Full'; setE({ plan: { ...e.plan, kind, ...(kind === 'Stages' && !(e.plan.stages || []).length ? { stages: defaultPlanFor('Litigation').stages } : {}) }, inst: kind === 'Instalments' ? { months: 8, upfront: 2000, terms: SD.ARR_TERMS, ...(e.inst || {}), on: true } : e.inst ? { ...e.inst, on: false } : null }); })
            : seg(['Pay in full', 'Monthly instalments'], e.inst && e.inst.on ? 'Monthly instalments' : 'Pay in full', (v) => setE({ inst: { months: 8, upfront: 2000, terms: SD.ARR_TERMS, ...(e.inst || {}), on: v === 'Monthly instalments' } }))}</div></div>
          {isQuote && e.plan.kind === 'Stages' && (
            <div style={css('display:flex;flex-direction:column;gap:6px;border:1px solid #DDE3EB;border-radius:8px;padding:10px 12px;background:#F6F8FA')}>
              <div style={css('display:grid;grid-template-columns:24px minmax(0,1.2fr) 70px 100px minmax(0,1.4fr) 110px 60px;gap:8px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}><span>#</span><span>Stage</span><span style={css('text-align:right')}>%</span><span style={css('text-align:right')}>or RM</span><span>When payable</span><span style={css('text-align:right')}>Amount</span><span></span></div>
              {(e.plan.stages || []).map((st, i) => (
                <div key={i + '-' + (e.plan.stages || []).length} style={css('display:grid;grid-template-columns:24px minmax(0,1.2fr) 70px 100px minmax(0,1.4fr) 110px 60px;gap:8px;align-items:center')}>
                  <span style={css('font-size:11px;color:#5B6478')}>{i + 1}</span>
                  <input value={st.label} onChange={(ev) => setStage(i, { label: ev.target.value })} placeholder="e.g. Filing" style={css(INPUT)} />
                  <input type="number" min={0} max={100} step="any" aria-label={'Stage ' + (i + 1) + ' percent'} value={hasAmt(st) || st.pct == null ? '' : st.pct} onChange={(ev) => { const v = ev.target.value; setStage(i, { pct: v === '' ? undefined : Number(v), amount: undefined }); }} placeholder="%" style={css(INPUT + ';text-align:right')} />
                  <input type="number" min={0} step="any" aria-label={'Stage ' + (i + 1) + ' amount'} value={hasAmt(st) ? st.amount : ''} onChange={(ev) => { const v = ev.target.value; setStage(i, v === '' ? { amount: undefined, pct: 0 } : { amount: Number(v), pct: undefined }); }} placeholder="RM" style={css(INPUT + ';text-align:right')} />
                  <input value={st.due || ''} onChange={(ev) => setStage(i, { due: ev.target.value })} placeholder="e.g. On close of pleadings" style={css(INPUT)} />
                  <strong style={css('text-align:right;font-size:11.5px;color:#16223A')}>{SD.money(stageRows[i]?.amount || 0)}</strong>
                  <button type="button" onClick={() => setE({ plan: { ...e.plan, stages: (e.plan.stages || []).filter((_, j) => j !== i) } })} style={css(BTN + ';color:#B23A2E;padding:5px 8px')}>Remove</button>
                </div>
              ))}
              <div style={css('display:flex;align-items:center;gap:10px')}><button type="button" onClick={() => setE({ plan: { ...e.plan, stages: [...(e.plan.stages || []), { label: '', pct: 0 }] } })} style={css('border:0;background:none;font-size:11px;font-weight:700;color:#8A6D3B;cursor:pointer;font-family:inherit')}>+ Add stage</button>
                <span style={css(`margin-left:auto;font-size:11px;font-weight:700;color:${Math.abs(stageSum - t.total) < 0.01 ? '#2F6F4E' : '#B23A2E'}`)}>{Math.abs(stageSum - t.total) < 0.01 ? 'Stages add up to the total ' + SD.money(t.total) : 'Stages add up to ' + SD.money(stageSum) + ' of ' + SD.money(t.total)}</span></div>
            </div>
          )}
          {e.inst && e.inst.on && (!isQuote || e.plan.kind === 'Instalments') && (
            <div style={css('display:grid;grid-template-columns:130px 120px 150px minmax(0,1fr);gap:10px;align-items:start;border:1px solid #DDE3EB;border-radius:8px;padding:10px 12px;background:#F6F8FA')}>
              <span style={css(LBL + ';padding-top:6px')}>Instalments</span>
              <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Months</span><input value={String(e.inst.months)} onChange={(ev) => setE({ inst: { ...e.inst!, months: Number(ev.target.value.replace(/[^0-9]/g, '')) || 1 } })} style={css(INPUT + ';text-align:right')} /></label>
              <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Upfront (RM)</span><input value={String(e.inst.upfront)} onChange={(ev) => setE({ inst: { ...e.inst!, upfront: Number(ev.target.value.replace(/[^0-9.]/g, '')) || 0 } })} style={css(INPUT + ';text-align:right')} /></label>
              <div style={css('display:flex;flex-direction:column;gap:2px')}><span style={css(LBL)}>Schedule (auto)</span>{sched.map(([k, v]) => <div key={k} style={css('display:flex;font-size:11px;color:#16223A')}><span>{k}</span><strong style={css('margin-left:auto')}>{SD.money(v)}</strong></div>)}</div>
              <span></span>
              <label style={css('grid-column:2 / 5;display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Terms (one per line · "Heading: text")</span><textarea value={e.inst.terms} onChange={(ev) => setE({ inst: { ...e.inst!, terms: ev.target.value } })} rows={4} style={css(INPUT + ';resize:vertical;line-height:1.45')} /></label>
            </div>
          )}
          <p style={css('margin:0;font-size:10.5px;color:#5B6478')}>{e.type === 'Proforma' ? 'A proforma asks the client to pay first. No SST until the final tax invoice. Fee deposits → office account; money for disbursements → client account.' : 'Lines load from the ' + e.area + ' format. Change any description or amount, or add lines.'}</p>
          {sections.map(([k, title, note]) => (
            <div key={k} style={css('border:1px solid #DDE3EB;border-radius:8px;overflow:hidden')}>
              <div style={css('display:flex;align-items:center;gap:8px;padding:7px 12px;background:#F6F8FA')}><strong style={css('font-size:11.5px')}>{title}</strong><span style={css('font-size:10px;color:#5B6478')}>{note}</span><strong style={css('margin-left:auto;font-size:11.5px')}>{SD.money(sum(e.lines[k]))}</strong></div>
              {k === 'prof' && <label style={css('display:flex;flex-direction:column;gap:4px;padding:8px 12px;border-top:1px solid #F0F2F5')}><span style={css(LBL)}>Scope of work</span><textarea value={e.desc} onChange={(ev) => setE({ desc: ev.target.value })} rows={4} placeholder="Being our professional charges for…" style={css(INPUT + ';resize:vertical;line-height:1.45;text-align:justify')} /></label>}
              {e.lines[k].map(([desc, a], i) => (
                <div key={`${e.area}-${k}-${i}-${e.lines[k].length}`} style={css('display:grid;grid-template-columns:minmax(0,1fr) 130px 70px;gap:8px;align-items:center;padding:5px 12px;border-top:1px solid #F0F2F5')}><input value={desc} onChange={(ev) => { const v = ev.target.value; setLines((L) => { L[k][i][0] = v; }); }} placeholder="Description" style={css(INPUT)} /><input defaultValue={String(a)} onChange={(ev) => { const v = ev.target.value; setLines((L) => { L[k][i][1] = Number(v.replace(/[^0-9.]/g, '')) || 0; }); }} style={css(INPUT + ';text-align:right')} /><button type="button" onClick={() => setLines((L) => { L[k].splice(i, 1); })} style={css(BTN + ';color:#B23A2E;padding:5px 8px')}>Remove</button></div>
              ))}
              <div style={css('padding:6px 12px;border-top:1px solid #F0F2F5')}><button type="button" onClick={() => setLines((L) => { L[k].push(['', 0]); })} style={css('border:0;background:none;font-size:11px;font-weight:700;color:#8A6D3B;cursor:pointer;font-family:inherit')}>+ Add line</button></div>
            </div>
          ))}
          <div style={css('display:flex;align-items:flex-end;gap:16px')}>
            <div style={css('margin-left:auto;width:320px')}>{sums.map(([k, v]) => <div key={k} style={css('display:flex;padding:3px 0;font-size:11.5px;color:#5B6478')}><span>{k}</span><span style={css('margin-left:auto;color:#16223A')}>{SD.money(v)}</span></div>)}<div style={css('display:flex;padding:7px 0;border-top:2px solid #16223A;font-size:13px')}><strong>Total</strong><strong style={css('margin-left:auto')}>{SD.money(t.total)}</strong></div></div>
          </div>
          <div style={css('display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #EEF1F5;padding-top:12px')}><button type="button" onClick={() => F.setEd(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={() => F.saveEd(false)} style={css('border:1px solid #16223A;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Save as draft</button><button type="button" onClick={() => F.saveEd(true)} style={css(BTN_DARK)}>Save &amp; view</button></div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Small forms ------------------------------ */
type FieldDef = [string, string, (string | string[] | 'file')?];
export const FormModal = ({ F }: { F: FinanceCtrl }) => {
  const f = F.form!;
  const set = (k: string, v: unknown) => F.setForm({ ...f, vals: { ...f.vals, [k]: v } });
  // Money in: the picked client's open bills (invoices with a balance, unpaid proformas), to pick instead of typing.
  const openBillsOf = (clientName?: string): string[] => {
    const n = String(clientName || '').trim().toLowerCase();
    if (!n) return [];
    const inv = F.openInvoices.filter((i) => (i.partyName || F.clientName(i.clientId) || '').toLowerCase() === n).map((i) => i.id);
    const pf = F.app.quotations.filter((q) => q.documentType === 'Proforma' && (q.clientName || '').toLowerCase() === n && F.qStatus(q) !== 'Paid' && F.qStatus(q) !== 'Declined').map((q) => q.id);
    return [...inv, ...pf];
  };
  const DEF: Record<string, [string, FieldDef[], string?]> = {
    moneyIn: ['Record money in', [['kind', 'This money is', ['Payment of an invoice', 'Deposit / money held for client']], ['client', 'Received from'],
      ...(f.vals.kind !== 'Deposit / money held for client' && openBillsOf(f.vals.client).length ? [['forNo', 'Which bill', openBillsOf(f.vals.client)]] as FieldDef[] : [['forNo', f.vals.kind === 'Deposit / money held for client' ? 'Purpose' : 'Invoice no. or purpose', f.vals.kind === 'Deposit / money held for client' ? 'e.g. 10% deposit, stamp duty' : 'e.g. INV-26-0314']] as FieldDef[]),
      ['amount', 'Amount (RM)', 'e.g. 5000'], ['date', 'Date received', 'dd.mm.yyyy'], ['method', 'Method', ['Online transfer', 'Cheque', 'Cash']], ['proofs', 'Proof of payment (bank-in slip, screenshot, cheque copy, WhatsApp)', 'file']]],
    pay: ['Record payment for ' + (f.vals.title || ''), [['amount', 'Amount received (RM)'], ['date', 'Date received', 'dd.mm.yyyy'], ['method', 'Method', ['Online transfer', 'Cheque', 'Cash']], ['proofs', 'Proof of payment (bank-in slip, screenshot, cheque copy, WhatsApp)', 'file']]],
    journal: ['Manual journal (goes to Approvals)', [['date', 'Date', 'dd.mm.yyyy'], ['account', 'Account', ['Office', 'Client account', 'Disbursement', 'Petty cash']], ['dir', 'Direction', ['Money out', 'Money in']], ...(f.vals.account === 'Client account' ? [['client', 'Client ledger (required for the client account)'], ['matter', 'Matter (file ref.)', 'SHC/…']] as FieldDef[] : []), ['details', 'Details', 'e.g. bank charges Sep'], ['amount', 'Amount (RM)'], ['reason', 'Reason for adjustment']], f.vals.account === 'Client account' ? 'Client-account journals adjust one client ledger (client + matter), so the ledgers, cash book and bank stay equal. A ledger can never go below zero.' : undefined],
    payOut: ['Pay out of client money', [['client', 'From client ledger'], ['matter', 'Matter (file ref.) · paid from this matter’s ledger', 'SHC/…'], ['payee', 'Pay to', 'e.g. vendor\'s solicitors'], ['amount', 'Amount (RM)'], ['date', 'Date', 'dd.mm.yyyy'], ['purpose', 'Purpose', 'e.g. balance purchase price'], ['proofs', 'Supporting document (letter, redemption statement, invoice)', 'file']]],
    disb: ['Paid for a client file', [['client', 'Client'], ['matter', 'File', 'SHC/…'], ['payee', 'Paid to', 'e.g. Pejabat Tanah, LHDN, Mahkamah'], ['what', 'Details', 'e.g. land search, stamp duty, filing fee'], ['amount', 'Amount (RM)'], ['date', 'Date paid', 'dd.mm.yyyy'], ['from', 'Paid from', F.paidFromOptions], ['proofs', 'Receipt', 'file']], 'Billed back to the client on the file\'s next invoice.'],
    transfer: ['Transfer fees to office', [['client', 'From client ledger'], ['matter', 'Matter (file ref.)', 'SHC/…'], ['forNo', 'For invoice', 'INV-2026-…'], ['amount', 'Amount (RM)'], ['date', 'Date', 'dd.mm.yyyy']]],
    expense: ['Office cost', [['kind', 'What is it', ['Office expense', PV_STATUTORY, PV_SST, PV_DRAWINGS]], ...(!f.vals.kind || f.vals.kind === 'Office expense' ? [['cat', 'Category', expenseCategories()], ...(f.vals.cat === 'Other' ? [['catOther', 'Other: what is it?', 'e.g. parking at court, key cutting']] : [])] as FieldDef[] : []), ['payee', 'Paid to'], ['what', 'Details'], ['amount', 'Amount (RM)'], ['date', 'Date paid', 'dd.mm.yyyy'], ['from', 'Paid from', F.paidFromOptions], ['proofs', 'Bill or receipt', 'file']]],
    pastQuote: ['Record a past quotation (made before the portal)', [['no', 'Quotation no. (as printed)', 'e.g. QUO/2025/012'], ['client', 'Client'], ['matter', 'File (if any)', 'SHC/…'], ['date', 'Date of the quotation', 'dd.mm.yyyy'], ['fees', 'Professional fees (RM)', 'e.g. 1500'], ['reimb', 'Reimbursements (RM)', 'photocopy, courier, travel… (0 if none)'], ['disb', 'Disbursements (RM)', 'stamp duty, filing fees, searches… (0 if none)'], ['status', 'Status', ['Accepted', 'Sent', 'Declined']], ['pdf', 'The quotation (PDF)', 'file']]],
    pastProforma: ['Record a past proforma (for reference only)', [['no', 'Proforma no. (as printed)', 'e.g. PF/2025/007'], ['client', 'Client'], ['matter', 'File (if any)', 'SHC/…'], ['what', 'For', 'e.g. retainer, stamp duty deposit'], ['payInto', 'Pay into', ['Office', 'Client account']], ['date', 'Date of the proforma', 'dd.mm.yyyy'], ['fees', 'Professional fees (RM)', 'e.g. 1500'], ['reimb', 'Reimbursements (RM)', 'photocopy, courier, travel… (0 if none)'], ['disb', 'Disbursements (RM)', 'stamp duty, filing fees, searches… (0 if none)'], ['pdf', 'The proforma (PDF)', 'file']], 'Kept with its PDF to look back at. Not counted as unpaid.'],
    pastInvoice: ['Record a past invoice (for reference only)', [['no', 'Invoice no. (as printed)', 'e.g. INV/2025/012'], ['client', 'Client'], ['matter', 'File (if any)', 'SHC/…'], ['what', 'For', 'e.g. legal fees SPA'], ['date', 'Date of the invoice', 'dd.mm.yyyy'], ['fees', 'Professional fees (RM)', 'e.g. 1500'], ['reimb', 'Reimbursements (RM)', 'photocopy, courier, travel… (0 if none)'], ['disb', 'Disbursements (RM)', 'stamp duty, filing fees, searches… (0 if none)'], ['sst', 'SST (RM)', '0 if none'], ['status', 'Status', ['Not paid', 'Part paid', 'Paid']], ['pdf', 'The invoice (PDF)', 'file']], 'Kept with its PDF to look back at. It does not change what clients owe, the books or the running numbers.'],
    pastReceipt: ['Record a past receipt (for reference only)', [['no', 'Receipt no. (as printed)', 'e.g. OR/2025/045'], ['client', 'Received from'], ['matter', 'File (if any)', 'SHC/…'], ['what', 'For', 'e.g. legal fees, deposit'], ['account', 'Account', ['Office', 'Client account']], ['date', 'Date received', 'dd.mm.yyyy'], ['amount', 'Amount (RM)'], ['method', 'Method', ['Online transfer', 'Cheque', 'Cash']], ['pdf', 'The receipt (PDF)', 'file']], 'Kept with its PDF to look back at. It does not change the bank balance, the books or the running numbers.'],
    fund: ['Add sinking fund', [['name', 'Fund name'], ['target', 'Target (RM)'], ['saved', 'Saved so far (RM)'], ['due', 'Due', 'e.g. Dec 2026'], ['monthly', 'Set aside / month (RM)'], ['pct', 'Split % of each fee received']]],
    writeoff: ['Request write-off for ' + (f.vals.title || '') + '', [['amount', 'Amount to write off (RM)'], ['reason', 'Reason', 'e.g. client wound up, 14 months unpaid']]],
    // payslip: its own editor with auto EPF / SOCSO / EIS (PayslipFormModal.tsx).
  };
  const def = DEF[f.kind]; if (!def) return null;
  // dd.mm.yyyy (what the save step reads) <-> yyyy-mm-dd (the calendar picker).
  const toIso = (v: string) => { const m = String(v || '').match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : ''; };
  const fromIso = (v: string) => { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; };
  const todayDmy = fromIso(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  // Client: any registered client. Matter: that client's files (filled in when there is only one).
  const clientOpts = F.app.clients.map((c) => ({ value: c.name, label: c.name, hint: c.clientCode || '' }));
  const pickedClient = F.app.clients.find((c) => c.name === f.vals.client);
  const filesOf = (cid?: string) => F.app.cases.filter((c) => F.ownCase(c) && (!cid || String(c.clientId || '').split(',').map((x) => x.trim()).includes(cid)));
  const matterOpts = filesOf(pickedClient?.id).map((c) => ({ value: c.ref, label: c.ref, hint: c.title }));
  const pickClient = (name: string) => {
    const c = F.app.clients.find((x) => x.name === name);
    const files = c ? filesOf(c.id).filter((k) => k.status !== 'Closed' && k.status !== 'Archive') : [];
    F.setForm({ ...f, vals: { ...f.vals, client: name, matter: files.length === 1 ? files[0].ref : '' } });
  };
  const addProofs = (k: string, picked: FileList | null) => {
    if (!picked || !picked.length) return;
    if (proofUploadBlocked()) { F.toastMsg(DRIVE_REQUIRED_MSG); return; }
    // A past quotation's PDF is kept here and saved to the file's folder (Client Files) on Save.
    if (f.kind === 'pastQuote' || f.kind === 'pastProforma' || f.kind === 'pastInvoice' || f.kind === 'pastReceipt') { set(k, [...((f.vals[k] as FinanceProof[]) || []), ...Array.from(picked).map((file) => ({ name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString(), file }))]); return; }
    set(k, [...((f.vals[k] as FinanceProof[]) || []), ...filesToProofs('form', picked)]);
  };
  const listFor = (k: string) => (k === 'client' ? 'fin-clients' : k === 'matter' ? 'fin-cases' : k === 'forNo' && f.kind === 'transfer' ? 'fin-invoices' : k === 'forNo' ? 'fin-invoices' : undefined);
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);display:flex;align-items:flex-start;justify-content:center;padding-top:80px;padding-bottom:40px;overflow:auto')}>
      <ClientList F={F} />
      <div style={css('width:480px;max-width:calc(100vw - 32px);border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('padding:12px 16px;background:#16223A')}><strong style={css('font-size:13.5px;color:#fff')}>{def[0]}</strong></div>
        <div style={css('padding:14px 16px;display:flex;flex-direction:column;gap:10px')}>
          {def[2] && <p style={css('margin:0;font-size:10.5px;line-height:1.5;color:#8A6534;font-weight:600')}>{def[2]}</p>}
          {def[1].map(([k, label, x]) => { const isOpts = Array.isArray(x), isFile = x === 'file'; const fl: FinanceProof[] = f.vals[k] || []; return (
            <div key={k} style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>{label}</span>
              {k === 'date' && <input type="date" value={toIso(f.vals.date || todayDmy)} onChange={(ev) => set('date', fromIso(ev.target.value))} style={css(INPUT + ';width:170px')} />}
              {k === 'client' && <SearchSelect aria-label={label} value={f.vals.client || ''} onChange={pickClient} placeholder="Search a client…" empty="No client by that name. Add them in Clients first." options={clientOpts} />}
              {k === 'matter' && <SearchSelect aria-label={label} value={f.vals.matter || ''} onChange={(v) => set('matter', v)} clearable placeholder={pickedClient ? (matterOpts.length ? 'Choose the file…' : 'This client has no file yet') : 'Search a file ref…'} empty="No file matches." options={matterOpts} />}
              {!isOpts && !isFile && !['date', 'client', 'matter'].includes(k) && <input list={listFor(k)} value={f.vals[k] || ''} onChange={(ev) => set(k, ev.target.value)} placeholder={typeof x === 'string' ? x : ''} style={css(INPUT)} />}
              {isFile && <div onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); addProofs(k, ev.dataTransfer.files); }} style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1.5px dashed #C9D3E0;border-radius:8px;padding:8px 10px;background:#FAFBFC')}><span style={css('font-size:10.5px;font-weight:700;color:#16223A')}>Drop files here or</span><label style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Choose files<input type="file" multiple accept="image/*,.pdf" onChange={(ev) => { addProofs(k, ev.target.files); ev.target.value = ''; }} style={css('display:none')} /></label><span style={css(`font-size:10.5px;color:${fl.length ? '#2F6F4E' : '#B23A2E'}`)}>{fl.length ? fl.map((q) => q.name).join(', ') : 'Nothing attached yet'}</span><span style={css(`margin-left:auto;font-size:10px;color:${proofUploadBlocked() ? '#B23A2E' : '#5B6478'};white-space:nowrap`)}>{storageLabel()}</span></div>}
              {/* Up to 4 choices: buttons. More (e.g. expense categories): one drop-down. */}
              {isOpts && (x as string[]).length <= 4 && <div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(x as string[], f.vals[k] || (x as string[])[0], (v) => set(k, v))}</div>}
              {isOpts && (x as string[]).length > 4 && <select value={f.vals[k] || (x as string[])[0]} onChange={(ev) => set(k, ev.target.value)} style={css(INPUT + ';cursor:pointer')}>{(x as string[]).map((o) => <option key={o} value={o}>{o}</option>)}</select>}
            </div>
          ); })}
          <div style={css('display:flex;gap:8px;justify-content:flex-end;margin-top:4px')}><button type="button" onClick={() => F.setForm(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={F.saveForm} style={css(BTN_DARK)}>Save</button></div>
        </div>
      </div>
    </div>
  );
};

