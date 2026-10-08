import React from 'react';
import type { FinanceCtrl, EditorState } from './useFinanceController';
import { css, DRIVE_REQUIRED_MSG, filesToProofs, proofMissingMsg, proofUploadBlocked, rm2 } from './financeModel';
import { storageLabel } from '../../../services/fileStorageService';
import * as SD from '../../../lib/financeDocs';
import { PV_DRAWINGS, PV_SST, PV_STATUTORY } from '../../../lib/financeCalc';
import type { FinanceProof, Invoice, Quotation } from '../../../types';
import { getPracticeSettings, DEFAULT_EXPENSE_CATEGORIES } from '../../../services/templateService';

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
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 18px;background:#16223A')}><strong style={css('font-size:14px;color:#fff')}>Import past transactions</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>from 2025 · every row is marked Historical</span><button type="button" onClick={() => F.setImp(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button></div>
        <div style={css('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>1 · Source</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{([['Template', 'Excel / Sheets (our template)'], ['Bank', 'Bank statement export'], ['Software', 'Other software (SQL / AutoCount / Xero)']] as const).map(([k, label]) => { const on = I0.src === k; return <button key={k} type="button" onClick={() => setI({ src: k })} style={css(`border-radius:14px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;border:1px solid ${on ? '#16223A' : '#DDE3EB'};background:${on ? '#16223A' : '#fff'};color:${on ? '#fff' : '#16223A'}`)}>{label}</button>; })}</div></div>
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
          <div style={css('display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #EEF1F5;padding-top:12px')}><button type="button" onClick={() => F.setImp(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={() => F.postImport(list)} style={css(`${BTN_DARK};opacity:${okN ? 1 : 0.45}`)}>{okN ? 'Post ' + okN + ' entries as historical' : 'Post entries'}</button></div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Document viewer (screen = Word = PDF source) ------------------------------ */
export const DocViewModal = ({ F }: { F: FinanceCtrl }) => {
  const ref = F.view!; const d = F.buildDoc(ref); const rec = F.recordOf(ref);
  if (!d || !rec) return null;
  const html = SD.docHtml(d);
  const acts = F.actionsFor(ref.kind, rec).filter((a) => a !== 'View');
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
            <button type="button" onClick={() => { SD.word(d.no, html); F.toastMsg(d.no + '.doc downloaded'); }} style={css('border:1px solid #2F5680;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#2F5680;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Word</button>
            <button type="button" onClick={() => SD.pdf(d.no, html)} style={css('border:1px solid #B23A2E;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#B23A2E;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>PDF / Print</button>
            <button type="button" onClick={() => F.setView(null)} style={css('border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button>
          </div>
        </div>
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
  const onRef = (v: string) => { const k = F.app.cases.find((c) => c.ref === v.trim()); if (!k) { setE({ ref: v }); return; } const cn = F.clientName(k.clientId.split(',')[0].trim()) || k.clientName || ''; const area = SD.areaFromName(k.practiceArea || k.type, k.ref); setE({ ref: v, matter: e.matter || k.title || '', client: e.client || cn, ...(e.id ? {} : { area, lines: SD.fromTemplate(area), desc: e.type === 'Proforma' ? e.desc : SD.AREAS[area].desc }) }); };
  const sched = e.inst && e.inst.on ? SD.schedule(t.total, e.inst.months, e.inst.upfront) : [];
  const sections: [keyof SD.DocLines, string, string][] = [['prof', 'A. Professional fees', pct ? `SST ${pct}%` : 'SST not applicable'], ['disb', 'B. Disbursements', 'paid to third parties · no SST'], ['reimb', 'C. Reimbursements', pct ? `our own costs · SST ${pct}%` : 'our own costs']];
  const sums: [string, number][] = [['Professional fees', t.prof], ['Disbursements', t.disb], ['Reimbursements', t.reimb], ...(e.type === 'Proforma' ? [] : [[pct ? `SST ${pct}%` : 'SST (not applicable)', t.sst] as [string, number]])];
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <ClientList F={F} />
      <div style={css('width:980px;max-width:calc(100vw - 32px);align-self:flex-start;border-radius:12px;background:#fff;overflow:hidden')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:12px 18px;background:#16223A')}><strong style={css('font-size:14px;color:#fff;text-transform:capitalize')}>{(e.id ? 'Edit ' : 'New ') + e.type.toLowerCase()}</strong><button type="button" onClick={() => F.setEd(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button></div>
        <div style={css('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
          {!e.id && <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Document</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Quotation', 'Proforma', 'Invoice'], e.type, (v) => setE({ type: v as EditorState['type'] }))}</div></div>}
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Practice area</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(Object.keys(SD.AREAS), e.area, (v) => setE({ area: v, lines: SD.fromTemplate(v), desc: e.type === 'Proforma' ? e.desc : SD.AREAS[v].desc }))}</div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Pay into</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Office', 'Client account'], e.account, (v) => setE({ account: v as EditorState['account'] }))}</div></div>
          <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Client</span><input list="fin-clients" value={e.client} onChange={(ev) => setE({ client: ev.target.value })} placeholder="Client name" style={css(INPUT)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Matter</span><input value={e.matter} onChange={(ev) => setE({ matter: ev.target.value })} placeholder="e.g. SPA Taman Bangi" style={css(INPUT)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>File ref.</span><input list="fin-cases" value={e.ref} onChange={(ev) => onRef(ev.target.value)} placeholder="SH/LIT/0450" style={css(INPUT)} /></label>
          </div>
          <div style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:10px')}>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Your Ref</span><input value={e.yourRef} onChange={(ev) => setE({ yourRef: ev.target.value })} style={css(INPUT)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Subject</span><input value={e.subject} onChange={(ev) => setE({ subject: ev.target.value })} placeholder="e.g. TENANCY (SUMMON – SETTLEMENT)" style={css(INPUT)} /></label>
          </div>
          <label style={css('display:flex;flex-direction:column;gap:4px')}><span style={css(LBL)}>Scope of work (paragraph above the fees)</span><textarea value={e.desc} onChange={(ev) => setE({ desc: ev.target.value })} rows={4} style={css(INPUT + ';resize:vertical;line-height:1.45')} /></label>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>SST</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Not applicable', 'SST 6%', 'SST 8%'], e.sstRate === 0.06 ? 'SST 6%' : e.sstRate === 0.08 ? 'SST 8%' : 'Not applicable', (v) => setE({ sstRate: v === 'SST 6%' ? 0.06 : v === 'SST 8%' ? 0.08 : 0 }))}</div></div>
          <div style={css('display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center')}><span style={css(LBL)}>Fee arrangement</span><div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(['Pay in full', 'Monthly instalments'], e.inst && e.inst.on ? 'Monthly instalments' : 'Pay in full', (v) => setE({ inst: { months: 8, upfront: 2000, terms: SD.ARR_TERMS, ...(e.inst || {}), on: v === 'Monthly instalments' } }))}</div></div>
          {e.inst && e.inst.on && (
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
  const DEF: Record<string, [string, FieldDef[], string?]> = {
    moneyIn: ['Record money in', [['client', 'Received from'], ['amount', 'Amount (RM)', 'e.g. 5000'], ['date', 'Date received', 'dd.mm.yyyy'], ['kind', 'This money is', ['Payment of an invoice', 'Deposit / money held for client']], ['forNo', 'Invoice no. or purpose', 'e.g. INV-26-0314, or 10% deposit'], ['method', 'Method', ['Online transfer', 'Cheque', 'Cash']], ['proofs', 'Proof of payment (bank-in slip, screenshot, cheque copy, WhatsApp)', 'file']]],
    pay: ['Record payment for ' + (f.vals.title || ''), [['amount', 'Amount received (RM)'], ['date', 'Date received', 'dd.mm.yyyy'], ['method', 'Method', ['Online transfer', 'Cheque', 'Cash']], ['proofs', 'Proof of payment (bank-in slip, screenshot, cheque copy, WhatsApp)', 'file']]],
    journal: ['Manual journal (goes to Approvals)', [['date', 'Date', 'dd.mm.yyyy'], ['account', 'Account', ['Office', 'Client account', 'Disbursement', 'Petty cash']], ['dir', 'Direction', ['Money out', 'Money in']], ...(f.vals.account === 'Client account' ? [['client', 'Client ledger (required for the client account)'], ['matter', 'Matter (file ref.)', 'SHC/…']] as FieldDef[] : []), ['details', 'Details', 'e.g. bank charges Sep'], ['amount', 'Amount (RM)'], ['reason', 'Reason for adjustment']], f.vals.account === 'Client account' ? 'Client-account journals adjust one client ledger (client + matter), so the ledgers, cash book and bank stay equal. A ledger can never go below zero.' : undefined],
    payOut: ['Pay out of client money', [['client', 'From client ledger'], ['matter', 'Matter (file ref.) · paid from this matter’s ledger', 'SHC/…'], ['payee', 'Pay to', 'e.g. vendor\'s solicitors'], ['amount', 'Amount (RM)'], ['purpose', 'Purpose', 'e.g. balance purchase price'], ['proofs', 'Supporting document (letter, redemption statement, invoice)', 'file']]],
    disb: ['Paid on behalf of a client', [['client', 'For client'], ['matter', 'Matter (file ref.)', 'SHC/…'], ['payee', 'Paid to', 'e.g. Pejabat Tanah, LHDN, Mahkamah'], ['what', 'For', 'e.g. land search, stamp duty, filing fee'], ['amount', 'Amount (RM)'], ['date', 'Date paid', 'dd.mm.yyyy'], ['proofs', 'Receipt', 'file']]],
    transfer: ['Transfer fees to office', [['client', 'From client ledger'], ['matter', 'Matter (file ref.)', 'SHC/…'], ['forNo', 'For invoice', 'INV-2026-…'], ['amount', 'Amount (RM)']]],
    expense: ['Record office expense', [['kind', 'Type', ['Office expense', PV_STATUTORY, PV_SST, PV_DRAWINGS]], ['payee', 'Paid to'], ['what', 'For'], ...(!f.vals.kind || f.vals.kind === 'Office expense' ? [['cat', 'Category', expenseCategories()]] as FieldDef[] : []), ['amount', 'Amount (RM)'], ['from', 'Paid from', ['Hong Leong', 'CIMB', 'Petty cash']], ['proofs', 'Bill or receipt', 'file']]],
    fund: ['Add sinking fund', [['name', 'Fund name'], ['target', 'Target (RM)'], ['saved', 'Saved so far (RM)'], ['due', 'Due', 'e.g. Dec 2026'], ['monthly', 'Set aside / month (RM)'], ['pct', 'Split % of each fee received']]],
    writeoff: ['Request write-off for ' + (f.vals.title || '') + '', [['amount', 'Amount to write off (RM)'], ['reason', 'Reason', 'e.g. client wound up, 14 months unpaid']]],
    // payslip: its own editor with auto EPF / SOCSO / EIS (PayslipFormModal.tsx).
  };
  const def = DEF[f.kind]; if (!def) return null;
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
              {!isOpts && !isFile && <input list={listFor(k)} value={f.vals[k] || ''} onChange={(ev) => set(k, ev.target.value)} placeholder={typeof x === 'string' ? x : ''} style={css(INPUT)} />}
              {isFile && <div style={css('display:flex;align-items:center;gap:8px')}><label style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Choose files<input type="file" multiple accept="image/*,.pdf" onChange={(ev) => { const picked = ev.target.files; if (picked && picked.length && proofUploadBlocked()) { F.toastMsg(DRIVE_REQUIRED_MSG); ev.target.value = ''; return; } set(k, [...fl, ...filesToProofs('form', picked)]); }} style={css('display:none')} /></label><span style={css(`font-size:10.5px;color:${fl.length ? '#2F6F4E' : '#B23A2E'}`)}>{fl.length ? fl.map((q) => q.name).join(', ') : 'Nothing attached yet'}</span><span style={css(`margin-left:auto;font-size:10px;color:${proofUploadBlocked() ? '#B23A2E' : '#5B6478'};white-space:nowrap`)}>{storageLabel()}</span></div>}
              {isOpts && <div style={css('display:flex;flex-wrap:wrap;gap:4px')}>{seg(x as string[], f.vals[k] || (x as string[])[0], (v) => set(k, v))}</div>}
            </div>
          ); })}
          <div style={css('display:flex;gap:8px;justify-content:flex-end;margin-top:4px')}><button type="button" onClick={() => F.setForm(null)} style={css(BTN)}>Cancel</button><button type="button" onClick={F.saveForm} style={css(BTN_DARK)}>Save</button></div>
        </div>
      </div>
    </div>
  );
};

