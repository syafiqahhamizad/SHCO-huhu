import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, daysSince, fd, findCase, MONTHS, parseDate, periodKey, rm, rm2 } from './financeModel';
import * as SD from '../../../lib/financeDocs';

export const ClientAccountTrustTab = ({ F }: { F: FinanceCtrl }) => {
  const { app, lk } = F;
  const viewOnly = !F.canPrepare;
  const guard = (fn: () => void) => () => (viewOnly ? F.toastMsg('Client Account is view-only for your role. Accounts prepare, partners approve.') : fn());

  /* ---- 3-way reconciliation: previous and current month ---- */
  // Balanced only when client ledgers total = cash book = the bank statement balance keyed in
  // below, to the sen (F.reconFor).
  const recon = [F.prevDate, new Date(F.now.getFullYear(), F.now.getMonth(), 1)].map((m, i) => {
    const key = periodKey(m);
    const { ledgers: ledgersTotal, cash, bank, status } = F.reconFor(m);
    const monthLabel = `${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
    const tick = (F.settings.monthEndClose || {})[`${key}:c7`];
    const st = (F.settings.clientBankStatements || {})[key];
    const [sbg, sfg] = status === 'Balanced' ? ['#E6EFE9', '#2F6F4E'] : status === 'Difference' ? ['#FBEDE9', '#B23A2E'] : ['#FBF2E9', '#8A6534'];
    const diffs = bank == null ? '' : [Math.abs(ledgersTotal - cash) >= 0.005 ? `ledgers vs cash book ${rm2(ledgersTotal - cash)}` : '', Math.abs(cash - bank) >= 0.005 ? `cash book vs bank ${rm2(cash - bank)}` : ''].filter(Boolean).join(' · ');
    const note = (tick ? `signed off by ${tick.by} on ${fd(tick.at)} · ` : '') + (bank == null ? `key in the bank statement closing balance${i ? ' · due 15 ' + F.nextMonShort : ''}` : status === 'Balanced' ? 'ledgers = cash book = bank' : 'difference: ' + diffs) + (st ? ` · statement keyed by ${st.by}` : '');
    return { m, key, monthLabel, status, sbg, sfg, note, bank, bl: i ? '1px solid #EEF1F5' : '0', lines: [['Client ledgers total', rm2(ledgersTotal)], ['Cash book', rm2(cash)]] };
  });

  /* ---- client ledgers ---- */
  const ledgerFlag = (l: (typeof F.ledgers)[number]): [string, string, string] => {
    const client = lk.clientById.get(l.clientId); const kase = findCase(lk, l.caseId);
    if (l.balance < -0.005) return ['Overdrawn', '#FBEDE9', '#B23A2E'];
    if (client?.status === 'Pending KYC') return ['AML check pending', '#FBEDE9', '#B23A2E'];
    if (l.balance > 0.005 && daysSince(l.last) > 365) return ['Dormant 12m+', '#FBEDE9', '#B23A2E'];
    if (l.balance > 0.005 && kase?.status === 'Closed') return ['File closed: refund due', '#FBF2E9', '#8A6534'];
    if (l.balance > 0.005 && app.invoices.some((i) => (i.clientId === l.clientId || (!!l.caseId && (i.caseId === l.caseId || i.fileRef === kase?.ref))) && F.invIssued(i) && F.invBal(i) > 0.005)) return ['Bill issued: can transfer', '#FBF2E9', '#8A6534'];
    return ['OK', '#E6EFE9', '#2F6F4E'];
  };
  const sel = F.ledgers.find((l) => l.key === F.ledgerKey) || F.ledgers[0];
  let bal = 0;
  const selRows = sel ? sel.entries.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date)).map((r) => { const inn = r.type === 'Deposit' ? Number(r.amount || 0) : 0, out = r.type === 'Deposit' ? 0 : Number(r.amount || 0); bal += inn - out; return { id: r.id, date: F.dShort(r.date), desc: r.remarks || r.type, v: r.voucherNo || '—', out: out ? rm2(out) : '', inn: inn ? rm2(inn) : '', bal: rm2(bal) }; }) : [];
  const selCase = sel ? findCase(lk, sel.caseId) : undefined;

  const stmtPdf = () => { if (!sel) { F.toastMsg('No client ledger yet.'); return; } SD.pdf('Statement ' + sel.client, SD.tableHtml('Client account statement · ' + sel.client, sel.ref + ' · to ' + fd(Date.now()), ['Date', 'Details', 'Voucher', 'Out', 'In', 'Balance'], selRows.map((r) => [r.date, r.desc, r.v, r.out, r.inn, r.bal]))); };

  /* ---- monthly statements ---- */
  const runs = F.settings.clientStatementRuns || {};
  const run = runs[F.period]; const lastRun = runs[F.prevPeriod];
  const withBal = F.ledgers.filter((l) => l.balance > 0.005);
  const stmts = withBal.map((l) => { const c = lk.clientById.get(l.clientId); const via = c?.email ? (c?.address ? 'Email + post' : 'Email') : c?.address ? 'Post (no email)' : 'No contact on file'; return { key: l.key, client: l.client + (l.caseId ? ' · ' + (findCase(lk, l.caseId)?.ref || '') : ''), bal: rm(l.balance), via, last: run ? fd(run.at) : lastRun ? fd(lastRun.at) : '—' }; });
  const sendStmts = guard(() => {
    if (run) { F.toastMsg(`${MONTHS[F.now.getMonth()]} statements were generated on ${fd(run.at)}.`); return; }
    if (!withBal.length) { F.toastMsg('No client has money in the client account.'); return; }
    const html = withBal.map((l) => { let b = 0; const rows = l.entries.slice().sort((a, c) => parseDate(a.date) - parseDate(c.date)).map((r) => { const inn = r.type === 'Deposit' ? Number(r.amount || 0) : 0, out = r.type === 'Deposit' ? 0 : Number(r.amount || 0); b += inn - out; return [F.dShort(r.date), r.remarks || r.type, r.voucherNo || '—', out ? rm2(out) : '', inn ? rm2(inn) : '', rm2(b)]; }); return SD.tableHtml('Client account statement · ' + l.client, l.ref + ' · to ' + F.lastDayLabel + ' ' + F.now.getFullYear(), ['Date', 'Details', 'Voucher', 'Out', 'In', 'Balance'], rows); }).join('<div style="page-break-after:always"></div>');
    SD.pdf('Client statements ' + F.period, html);
    F.saveSettings({ clientStatementRuns: { ...runs, [F.period]: { at: new Date().toISOString(), by: F.me, count: withBal.length } } });
    F.toastMsg(withBal.length + ' statements generated as one PDF · send them from your mailbox');
  });

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <section style={css('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px;align-items:start')}>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>3-way reconciliation</strong><span style={css('font-size:10.5px;color:#5B6478')}>Solicitors' Account Rules 1990</span><button type="button" onClick={() => F.app.setCurrentView('trustAuditLogs')} style={css('margin-left:auto;border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#8A6D3B;cursor:pointer;font-family:inherit')}>Audit log -&gt;</button></div>
          <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr))')}>
            {recon.map((r) => (
              <div key={r.monthLabel} style={css(`padding:12px 14px;border-left:${r.bl};display:flex;flex-direction:column;gap:6px`)}>
                <span style={css('display:flex;align-items:center;gap:6px')}><strong style={css('font-size:12px;color:#16223A')}>{r.monthLabel}</strong><span style={css(`margin-left:auto;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${r.sbg};color:${r.sfg}`)}>{r.status}</span></span>
                {r.lines.map(([label, amt]) => <span key={label} style={css('display:flex;font-size:11px;color:#5B6478')}><span>{label}</span><strong style={css('margin-left:auto;color:#16223A')}>{amt}</strong></span>)}
                <label style={css('display:flex;align-items:center;font-size:11px;color:#5B6478;gap:6px')}><span>Bank statement</span><input key={r.key + ':' + (r.bank ?? '')} defaultValue={r.bank == null ? '' : String(r.bank)} placeholder="closing balance" disabled={viewOnly} onBlur={(e) => { const v = e.target.value; if (v !== (r.bank == null ? '' : String(r.bank))) F.setStatement(r.m, v); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={css('margin-left:auto;width:110px;text-align:right;border:1px solid #DDE3EB;border-radius:6px;padding:3px 6px;font-size:11px;font-weight:700;color:#16223A;font-family:inherit;background:#fff')} /></label>
                <span style={css('font-size:10px;color:#5B6478')}>{r.note}</span>
              </div>
            ))}
          </div>
          <div style={css('padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:10.5px;line-height:1.5;color:#5B6478')}>Client money is never office income. It may only be moved to office after an invoice is issued to that same client, and every transfer needs two signatories.</div>
        </div>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Client ledgers</strong><span style={css('font-size:10.5px;color:#5B6478')}>{F.ledgers.length} ledgers · total {rm(F.ledgers.reduce((s, l) => s + l.balance, 0))}</span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>click a client to see its ledger</span></div>
          {F.ledgers.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No client money held yet. Use “+ Money in” with the Client account to open a ledger.</div>}
          <div style={css('max-height:320px;overflow:auto')}>
            {F.ledgers.map((c) => { const on = sel?.key === c.key; const [flag, fbg, ffg] = ledgerFlag(c); return (
              <button key={c.key} type="button" onClick={() => F.setLedgerKey(c.key)} style={css(`width:100%;display:grid;grid-template-columns:minmax(0,1fr) 100px 90px 130px;gap:10px;align-items:center;padding:8px 14px;border:0;border-bottom:1px solid #F0F2F5;cursor:pointer;font-family:inherit;text-align:left;background:${on ? '#F6F8FA' : '#fff'};border-left:3px solid ${on ? '#16223A' : 'transparent'}`)}>
                <span style={css('min-width:0')}><span style={css('display:block;font-size:11.5px;font-weight:700;color:#16223A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{c.client}</span><span style={css('display:block;font-size:10px;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{c.ref}</span></span>
                <span style={css(`text-align:right;font-size:12px;font-weight:700;color:${c.balance < 0 ? '#B23A2E' : '#16223A'}`)}>{rm(c.balance)}</span>
                <span style={css('font-size:10.5px;color:#5B6478')}>{F.dShort(c.last)}</span>
                <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${fbg};color:${ffg}`)}>{flag}</span>
              </button>
            ); })}
          </div>
        </div>
      </section>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Ledger: {sel ? sel.client : '—'}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{sel ? sel.ref : ''}</span>
          <div style={css('margin-left:auto;display:flex;gap:6px')}><button type="button" onClick={guard(() => F.openForm('moneyIn', { client: sel?.client || '', caseId: sel?.caseId, account: 'Client account' }))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Money in</button><button type="button" onClick={guard(() => F.openForm('payOut', { client: sel?.client || '', caseId: sel?.caseId, matter: selCase?.ref || '' }))} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>+ Pay out for client</button><button type="button" onClick={guard(() => F.openForm('transfer', { client: sel?.client || '', caseId: sel?.caseId, matter: selCase?.ref || '' }))} style={css('border:0;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Transfer to office (invoice)</button><button type="button" onClick={stmtPdf} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Client statement PDF</button></div></div>
        <div style={css('display:grid;grid-template-columns:90px minmax(0,1.6fr) 110px 100px 100px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Date</span><span>Details</span><span>Voucher</span><span style={css('text-align:right')}>Out</span><span style={css('text-align:right')}>In</span><span style={css('text-align:right')}>Balance</span></div>
        {!sel && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Pick a client ledger above.</div>}
        {selRows.map((r) => (
          <div key={r.id} style={css('display:grid;grid-template-columns:90px minmax(0,1.6fr) 110px 100px 100px 110px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11px;color:#5B6478')}>{r.date}</span>
            <span style={css('font-size:11.5px;color:#16223A')}>{r.desc}</span>
            <span style={css('font-size:10.5px;color:#3D6B9C;font-weight:600')}>{r.v}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#B23A2E')}>{r.out}</span>
            <span style={css('text-align:right;font-size:11.5px;color:#2F6F4E')}>{r.inn}</span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{r.bal}</span>
          </div>
        ))}
        {sel && selCase?.status === 'Closed' && sel.balance > 0.005 && <div style={css('padding:9px 14px;background:#FBF2E9;font-size:10.5px;color:#8A6534')}>File closed with {rm2(sel.balance)} still held: refund the client at file closing.</div>}
      </div>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}><div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Monthly client statements</strong><span style={css('font-size:10.5px;color:#5B6478')}>every client with money in the client account gets one</span><span style={css('margin-left:auto;font-size:10.5px;color:#5B6478')}>{run ? `${run.count} of ${run.count} generated ${fd(run.at)}` : `${withBal.length} clients have a balance`}</span><button type="button" onClick={sendStmts} style={css(`border:0;border-radius:6px;padding:5px 12px;font-size:10.5px;font-weight:700;background:${run ? '#2F6F4E' : '#16223A'};color:#fff;cursor:pointer;font-family:inherit`)}>{run ? 'Generated ✓' : `Generate ${F.monthName} statements`}</button></div>
        <div style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 110px 110px 120px 110px;gap:10px;padding:7px 14px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><span>Client</span><span style={css('text-align:right')}>Balance {F.lastDayLabel}</span><span>Send by</span><span>Last sent</span><span>{F.monthName}</span></div>
        {stmts.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>No client has money in the client account.</div>}
        {stmts.map((s) => (
          <div key={s.key} style={css('display:grid;grid-template-columns:minmax(0,1.3fr) 110px 110px 120px 110px;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid #F0F2F5')}>
            <span style={css('font-size:11.5px;font-weight:600;color:#16223A')}>{s.client}</span>
            <span style={css('text-align:right;font-size:11.5px;font-weight:700;color:#16223A')}>{s.bal}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{s.via}</span>
            <span style={css('font-size:10.5px;color:#5B6478')}>{s.last}</span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;background:${run ? '#E6EFE9' : '#FBF2E9'};color:${run ? '#2F6F4E' : '#8A6534'}`)}>{run ? 'Generated' : 'Due 1 ' + F.nextMonShort}</span>
          </div>
        ))}
        <div style={css('padding:9px 14px;background:#F6F8FA;font-size:10.5px;color:#5B6478')}>Statements are generated on the 1st for every ledger with a balance, as PDF, and logged. Clients with RM 0 balance are skipped. Email sending isn't connected yet: send the PDFs from your mailbox.</div></div>
    </div>
  );
};
