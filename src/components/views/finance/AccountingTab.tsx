import React, { useState } from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { BUKKU_ADDED, BUKKU_RENAMES, css, fd, GLA, glCode, parseDate } from './financeModel';
import * as SD from '../../../lib/financeDocs';

type AType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
const GROUPS: [string, AType][] = [['Assets', 'Asset'], ['Liabilities', 'Liability'], ['Equity', 'Equity'], ['Income', 'Income'], ['Expenses', 'Expense']];
const typeOfCode = (code: string): AType => ({ '1': 'Asset', '2': 'Liability', '3': 'Equity', '4': 'Income', '5': 'Expense' } as Record<string, AType>)[code.slice(0, 1)] || 'Expense';
const nameOf = (acct: string) => String(acct || '').replace(/^\s*[0-9][0-9A-Z-]*\s*-\s*/, '');
const m2 = (n: number) => (n < 0 ? '(' : '') + Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (n < 0 ? ')' : '');

/** Accounting — design: the accountant's corner. Chart of accounts with balances from every GL
 * posting, trial balance, latest automatic postings. Cash books live under Client / Office Account. */
export const AccountingTab = ({ F }: { F: FinanceCtrl }) => {
  const { generalLedger, chartOfAccounts } = F.app;
  const E = F.settings.coaEdits || {};
  // The accountant's (Bukku) codes and names, under anything edited here.
  const ov: Record<string, { code?: string; name?: string; arch?: boolean }> = { ...BUKKU_RENAMES, ...(E.overrides || {}) };
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, { code?: string; name?: string; arch?: boolean }>>({});
  const [add, setAdd] = useState<{ g: AType; code: string; name: string }>({ g: 'Expense', code: '', name: '' });
  const [added, setAdded] = useState<NonNullable<typeof E.added>>([]);
  const year = F.now.getFullYear(), y0 = new Date(year, 0, 1).getTime();

  /* ---- accounts: the chart + anything posted to + added ---- */
  const base = new Map<string, { code: string; name: string; type: AType }>();
  chartOfAccounts.forEach((c) => base.set(c.code, { code: c.code, name: c.name, type: c.type }));
  generalLedger.forEach((g) => [g.debit, g.credit].forEach((a) => { const c = glCode(a); if (c && !base.has(c)) base.set(c, { code: c, name: nameOf(a), type: typeOfCode(c) }); }));
  [...BUKKU_ADDED, ...(E.added || []), ...added].forEach((a) => { if (!base.has(a.code)) base.set(a.code, { ...a }); });
  const O = editing ? { ...ov, ...draft } : ov;
  const disp = (k: string) => ({ code: O[k]?.code || k, name: O[k]?.name || base.get(k)?.name || k, arch: !!O[k]?.arch });
  /** Balance per code, signed debit + / credit −, up to `to` (and from `from`). */
  const balances = (from = -Infinity, to = Infinity) => { const b = new Map<string, number>(); generalLedger.forEach((g) => { const t = parseDate(g.date); if (t && (t < from || t > to)) return; const a = Number(g.amount || 0); const d = glCode(g.debit), c = glCode(g.credit); b.set(d, (b.get(d) || 0) + a); b.set(c, (b.get(c) || 0) - a); }); return b; };
  const now = balances(); const open = balances(-Infinity, y0 - 1);
  const natural = (t: AType, v: number) => (t === 'Asset' || t === 'Expense' ? v : -v);
  const flat = [...base.values()].sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ ...a, ...disp(a.code), k: a.code, now: Math.round((now.get(a.code) || 0) * 100) / 100, open: Math.round((open.get(a.code) || 0) * 100) / 100 }));
  let tDr = 0, tCr = 0; flat.forEach((f) => { if (f.now > 0) tDr += f.now; else tCr -= f.now; });
  const tbOk = Math.abs(tDr - tCr) < 0.005;
  const lq = q.trim().toLowerCase();
  const asOf = fd(Date.now());

  /* ---- documents ---- */
  const coaRows = GROUPS.flatMap(([g, t]) => { const rs = flat.filter((f) => f.type === t && !f.arch); return rs.length ? [[g.toUpperCase(), '', '', '', ''], ...rs.map((f) => [f.code, f.name, t, m2(natural(t, f.open)), m2(natural(t, f.now))])] : []; });
  const tbRows = [...flat.filter((f) => Math.abs(f.now) > 0.005).map((f) => [f.code, f.name, f.now > 0 ? m2(f.now) : '', f.now < 0 ? m2(-f.now) : '']), ['TOTAL', '', m2(tDr), m2(tCr)]];
  const jRows = generalLedger.slice().sort((a, b) => a.glNo - b.glNo).map((g) => [g.docNo, fd(g.date), g.description, disp(glCode(g.debit)).code + ' ' + disp(glCode(g.debit)).name, disp(glCode(g.credit)).code + ' ' + disp(glCode(g.credit)).name, m2(Number(g.amount || 0))]);
  const DOCS = {
    coa: ['Chart of Accounts', `Opening balances 01/01/${year} · current balances as of ${asOf}`, ['Code', 'Account', 'Type', 'Opening MYR', 'Current MYR'], coaRows],
    tb: ['Trial Balance', 'As of ' + asOf, ['Code', 'Account', 'Debit', 'Credit'], tbRows],
    j: ['Journal (automatic postings)', 'All postings to ' + asOf, ['No.', 'Date', 'Details', 'Debit account', 'Credit account', 'Amount MYR'], jRows],
  } as const;
  const out = (k: keyof typeof DOCS, fmt: 'view' | 'pdf' | 'xls') => {
    const [title, sub, cols, rows] = DOCS[k]; const r = (rows as unknown as string[][]).length ? (rows as unknown as string[][]) : [['No postings yet', ...cols.slice(1).map(() => '')]];
    const html = SD.tableHtml(title, sub, cols as unknown as string[], r);
    const pdf = () => SD.pdf(title, html), xls = () => { SD.csv(title, [cols as unknown as string[], ...r]); F.toastMsg(title + ' downloaded'); };
    if (fmt === 'pdf') pdf(); else if (fmt === 'xls') xls(); else F.setPaper({ title, sub, html, pdf, xls });
  };
  const openAcct = (code: string) => {
    const cb: Record<string, 'Office' | 'Client account' | 'Disbursement' | 'Petty cash'> = { [glCode(GLA.office)]: 'Office', [glCode(GLA.clientBank)]: 'Client account', [glCode(GLA.disb)]: 'Disbursement', [glCode(GLA.petty)]: 'Petty cash' };
    if (cb[code] === 'Client account') { F.setCbAcc('Client account'); F.setTrSub('c'); F.go('trust'); }
    else if (code === glCode(GLA.clientFunds)) { F.setTrSub('l'); F.go('trust'); }
    else if (cb[code]) { F.setCbAcc(cb[code]); F.setOfSub('c'); F.go('office'); }
    else out('tb', 'view');
  };

  /* ---- editing ---- */
  const dupe: Record<string, number> = {}; flat.forEach((f) => { dupe[f.code] = (dupe[f.code] || 0) + 1; });
  const startEdit = () => { if (!F.canPrepare) { F.toastMsg('Accounts are kept by Accounts and admins.'); return; } setDraft({}); setAdded([]); setEditing(true); };
  const saveEdit = () => {
    const bad = Object.keys(dupe).filter((c) => dupe[c] > 1 || !c.trim()); if (bad.length) { F.toastMsg('Each account needs its own code. Fix: ' + (bad[0] || 'blank code')); return; }
    const lg: string[] = [];
    (Object.entries(draft) as [string, { code?: string; name?: string; arch?: boolean }][]).forEach(([k, d]) => { const was = { code: ov[k]?.code || k, name: ov[k]?.name || base.get(k)?.name || k, arch: !!ov[k]?.arch }; if (d.code != null && d.code !== was.code) lg.push('Code ' + was.code + ' → ' + d.code + ' (' + (d.name || was.name) + ')'); if (d.name != null && d.name !== was.name) lg.push((d.code || was.code) + ' renamed "' + was.name + '" → "' + d.name + '"'); if (d.arch != null && d.arch !== was.arch) lg.push((d.arch ? 'Archived ' : 'Restored ') + (d.code || was.code) + ' ' + (d.name || was.name)); });
    added.forEach((a) => lg.push('Added ' + a.code + ' ' + a.name));
    if (!lg.length) { setEditing(false); F.toastMsg('No changes'); return; }
    const when = fd(Date.now());
    F.saveSettings({ coaEdits: { overrides: { ...ov, ...draft }, added: [...(E.added || []), ...added], log: [...lg.map((t) => ({ t, who: F.me, when })), ...(E.log || [])].slice(0, 50) } });
    setEditing(false); F.toastMsg(lg.length ? lg.length + ' change' + (lg.length > 1 ? 's' : '') + ' saved' : 'No changes');
  };
  const addGo = () => { if (!add.code.trim() || !add.name.trim()) { F.toastMsg('Enter a code and a name'); return; } if (dupe[add.code.trim()]) { F.toastMsg('Code ' + add.code + ' is already used'); return; } setAdded([...added, { code: add.code.trim(), name: add.name.trim(), type: add.g }]); setAdd({ ...add, code: '', name: '' }); };
  const setD = (k: string, p: { code?: string; name?: string; arch?: boolean }) => setDraft({ ...draft, [k]: { ...(draft[k] || {}), ...p } });

  const postings = generalLedger.slice().sort((a, b) => b.glNo - a.glNo).slice(0, 6);
  const BTN = 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap';
  const INP = 'border:1px solid #DDE3EB;border-radius:5px;padding:4px 6px;font-size:11px;font-family:inherit;color:#16223A;outline:none;background:#fff';
  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('display:flex;align-items:center;gap:4px;flex-wrap:wrap')}><span style={css('font-size:10.5px;color:#5B6478')}>The accountant's corner: every account, its balance, and what posted to it. Cash books are under Client Account and Office Account.</span><div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" title="Corrections only · always goes to Approvals" onClick={() => (F.canPrepare ? F.openForm('journal', { account: 'Office' }) : F.toastMsg('Journals are prepared by Accounts.'))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Manual journal</button><button type="button" title="One-time setup from Bukku or Excel" onClick={() => (F.canPrepare ? F.setImp({ src: 'Template', acc: 'Office', raw: null, fileName: 'No file chosen' }) : F.toastMsg('Imports are posted by Accounts.'))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>Import past transactions</button></div></div>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Chart of accounts</strong><span style={css('font-size:10.5px;color:#5B6478')}>your account codes · balances from every posting · opening = 01/01/{year}</span>
          <div style={css('margin-left:auto;display:flex;align-items:center;gap:6px')}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find account" style={css('width:150px;border:1px solid #DDE3EB;border-radius:6px;padding:5px 8px;font-size:11px;font-family:inherit;color:#16223A;outline:none')} />
            {!editing ? <><button type="button" onClick={startEdit} style={css(BTN)}>Edit accounts</button><button type="button" onClick={() => out('coa', 'view')} style={css(BTN)}>View</button><button type="button" onClick={() => out('coa', 'pdf')} style={css(BTN)}>PDF</button><button type="button" onClick={() => out('coa', 'xls')} style={css(BTN)}>Excel</button><button type="button" onClick={() => out('j', 'view')} style={css('border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>General ledger</button></>
              : <button type="button" onClick={saveEdit} style={css('border:1px solid #2F6F4E;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:#2F6F4E;color:#fff;cursor:pointer;font-family:inherit')}>Save changes</button>}</div></div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))')}>
          {GROUPS.map(([g, t]) => { const rows = flat.filter((f) => f.type === t && (!lq || (f.code + ' ' + f.name).toLowerCase().includes(lq))); if (!rows.length) return null; return (
            <div key={g} style={css('border-right:1px solid #F0F2F5;border-bottom:1px solid #F0F2F5;padding:8px 0')}>
              <div style={css('padding:2px 14px 6px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>{g}</div>
              {rows.map((a) => editing ? (
                <div key={a.k} style={css(`display:flex;align-items:center;gap:6px;padding:3px 14px;opacity:${a.arch ? 0.45 : 1}`)}><input value={a.code} onChange={(e) => setD(a.k, { code: e.target.value })} style={css(INP + `;width:100px;flex-shrink:0;font-family:ui-monospace,monospace;border-color:${dupe[a.code] > 1 || !a.code.trim() ? '#B23A2E' : '#DDE3EB'}`)} /><input value={a.name} onChange={(e) => setD(a.k, { name: e.target.value })} style={css(INP + ';flex:1;min-width:0')} /><button type="button" onClick={() => setD(a.k, { arch: !a.arch })} style={css('border:0;background:none;padding:2px 4px;font-size:10px;font-weight:700;color:#5B6478;cursor:pointer;font-family:inherit')}>{a.arch ? 'Restore' : 'Archive'}</button></div>
              ) : (
                <button key={a.k} type="button" onClick={() => openAcct(a.k)} className="hover:bg-[#F6F8FA]" style={css('width:100%;display:flex;align-items:center;gap:10px;padding:5px 14px;border:0;background:#fff;cursor:pointer;font-family:inherit;text-align:left')}><span style={css('font-family:ui-monospace,monospace;font-size:10.5px;color:#3D6B9C;width:92px;flex-shrink:0;white-space:nowrap')}>{a.code}</span><span style={css('flex:1;min-width:0;font-size:11px;color:#16223A')}>{a.name}{a.arch ? '  · archived' : ''}</span>{Math.abs(a.now - a.open) > 0.005 && <span style={css('font-size:9.5px;color:#5B6478')}>opening {m2(natural(t, a.open))}</span>}<span style={css(`font-size:11px;font-weight:700;color:#16223A;opacity:${a.arch ? 0.45 : 1}`)}>{m2(natural(t, a.now))}</span></button>
              ))}
            </div>
          ); })}
        </div>
        {editing && <div style={css('display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid #EEF1F5;background:#FBFCFD')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>Add account</span><select value={add.g} onChange={(e) => setAdd({ ...add, g: e.target.value as AType })} style={css(INP)}>{GROUPS.map(([g, t]) => <option key={t} value={t}>{g}</option>)}</select><input value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value })} placeholder="Code e.g. 5300" style={css(INP + ';width:140px;font-family:ui-monospace,monospace')} /><input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Account name" style={css(INP + ';flex:1;min-width:160px')} /><button type="button" onClick={addGo} style={css('border:1px solid #16223A;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Add</button><span style={css('flex-basis:100%;font-size:10px;color:#5B6478')}>Changing a code or name keeps every past entry on that account. Archive hides an account from new entries; it can't be deleted once it has postings.</span></div>}
        {!!(E.log || []).length && <div style={css('padding:8px 14px;border-bottom:1px solid #EEF1F5;display:flex;flex-direction:column;gap:3px')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>Change log</span>{(E.log || []).slice(0, 8).map((l, i) => <span key={i} style={css('font-size:10.5px;color:#16223A')}>{l.t} <span style={css('color:#5B6478')}>· {l.who} · {l.when}</span></span>)}</div>}
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid #EEF1F5')}><span style={css(`font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:10px;background:${tbOk ? '#E6EFE9' : '#FBEAE7'};color:${tbOk ? '#2F6F4E' : '#B23A2E'}`)}>{tbOk ? 'Trial balance agrees' : 'Trial balance out by ' + m2(Math.abs(tDr - tCr))}</span><span style={css('font-size:10.5px;color:#5B6478')}>Debit {m2(tDr)} · Credit {m2(tCr)}</span><div style={css('margin-left:auto;display:flex;gap:6px;flex-wrap:wrap')}><button type="button" onClick={() => out('tb', 'view')} style={css(BTN)}>Trial balance</button><button type="button" onClick={() => out('tb', 'pdf')} style={css(BTN)}>PDF</button><button type="button" onClick={() => out('tb', 'xls')} style={css(BTN)}>Excel</button></div><span style={css('flex-basis:100%;font-size:10px;color:#5B6478')}>You never pick an account. Every invoice, receipt, expense and journal posts itself.</span></div>
        <div style={css('padding:8px 14px;border-bottom:1px solid #EEF1F5;display:flex;flex-direction:column;gap:4px')}><div style={css('display:flex;align-items:center;gap:6px')}><span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478')}>Latest automatic postings</span><div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={() => out('j', 'view')} style={css(BTN)}>All postings</button><button type="button" onClick={() => out('j', 'pdf')} style={css(BTN)}>PDF</button><button type="button" onClick={() => out('j', 'xls')} style={css(BTN)}>Excel</button></div></div>
          {!postings.length && <span style={css('font-size:10.5px;color:#5B6478')}>Nothing posted yet. Issue an invoice, record a receipt or an expense and it appears here with its debit and credit.</span>}
          {postings.map((p) => <div key={p.glNo} style={css('display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:10.5px;color:#16223A;padding:3px 0;border-top:1px solid #F4F6F8')}><span style={css('font-family:ui-monospace,monospace;color:#3D6B9C')}>{p.docNo}</span><span><span style={css('color:#5B6478')}>Dr</span> {disp(glCode(p.debit)).code} {disp(glCode(p.debit)).name}</span><span><span style={css('color:#5B6478')}>Cr</span> {disp(glCode(p.credit)).code} {disp(glCode(p.credit)).name}</span><strong style={css('text-align:right')}>{m2(Number(p.amount || 0))}</strong></div>)}
        </div>
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478')}>How it links: an invoice posts to {GLA.ar} and {GLA.fees} (SST to {GLA.sst}); its payment lands in {GLA.office}. Deposits before an invoice go to {GLA.clientBank} and {GLA.clientFunds}, then move to Office by transfer once billed. Client court and search fees post to {GLA.unbilledDisb}, not expenses. Partners' pay posts to {GLA.drawings}. The trial balance for any one year is under Reports.</div>
      </div>
    </div>
  );
};
