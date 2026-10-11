import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, inPeriod, initials, rm, rm2 } from './financeModel';
import type { FinTab } from '../../../lib/financeAccess';

/** "RM 1.42m" / "RM 212k" — the design's KPI short format. */
const rmShort = (n: number) => { const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e6) return s + 'RM ' + (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm'; if (a >= 1e4) return s + 'RM ' + Math.round(a / 1000) + 'k'; return rm(n); };

export const FinanceHomeTab = ({ F }: { F: FinanceCtrl }) => {
  const [meEdit, setMeEdit] = React.useState(false);
  const { app, period, monthName, monShort, lastDayLabel, nextMonShort } = F;
  const { payments, receipts, threeWayRec, users, currentUser } = app;

  /* ---------------- Alerts for Accounts (real items only) ---------------- */
  type Alert = { id: string; kind: 'Approved · to pay' | 'New claim' | 'Reminder' | 'Top up'; text: string; meta: string; amt: number; cta: string; tab: FinTab };
  const alerts: Alert[] = [];
  F.toPay.forEach((p) => alerts.push({ id: 'pay:' + p.key, kind: 'Approved · to pay', text: `${p.no} approved. Pay ${p.payee.replace(' (claim)', '')} ${rm2(p.amount)} from the ${p.from === 'Client account' ? 'client' : p.from} account.`, meta: p.what, amt: p.amount, cta: 'Pay', tab: 'approvals' }));
  F.apItems.filter((a) => a.type === 'Staff claim').forEach((a) => alerts.push({ id: 'claim:' + a.key, kind: 'New claim', text: `${a.by} submitted ${a.id}. Waiting for a partner to approve.`, meta: a.sub, amt: a.amount, cta: 'View', tab: 'approvals' }));
  F.ledgers.filter((l) => l.balance < -0.005).forEach((l) => alerts.push({ id: 'od:' + l.key, kind: 'Reminder', text: `${l.client} client ledger is overdrawn: top up immediately (Solicitors' Account Rules 1990).`, meta: l.ref, amt: l.balance, cta: 'Open', tab: 'trust' }));
  F.scopedInvoices.filter((i) => F.invCredit(i) > 0.005).forEach((i) => alerts.push({ id: 'credit:' + i.id, kind: 'Reminder', text: `${i.id}: ${i.partyName || F.clientName(i.clientId) || '—'} paid ${rm2(F.invCredit(i))} more than the invoice. Refund it or apply it to another invoice.`, meta: 'credit owed to the client', amt: F.invCredit(i), cta: 'Open', tab: 'billing' }));
  F.openInvoices.filter((i) => F.ageDays(i) > 90).forEach((i) => alerts.push({ id: 'old:' + i.id, kind: 'Reminder', text: `${i.id} for ${i.partyName || F.clientName(i.clientId) || '—'} is ${F.ageDays(i)} days past due: chase, or ask an admin for a write-off.`, meta: 'due ' + F.fd(i.dueDate || i.date), amt: F.invBal(i), cta: 'Open', tab: 'billing' }));
  const disbBal = F.bankBal('Disbursement');
  if (disbBal != null && disbBal < 5000) alerts.push({ id: 'topup:' + period, kind: 'Top up', text: `Disbursement account is below RM 5,000 (${rm2(disbBal)}).`, meta: 'top up from the office account', amt: 0, cta: 'Open', tab: 'office' });
  const FK: Record<Alert['kind'], [string, string]> = { 'Approved · to pay': ['#E6EFE9', '#2F6F4E'], 'New claim': ['#E7EEF6', '#2F5680'], Reminder: ['#FBEDE9', '#B23A2E'], 'Top up': ['#FBF2E9', '#8A6534'] };
  const faNew = alerts.filter((a) => !F.faRead[a.id]).length;

  /* ---------------- KPIs ---------------- */
  const prevRec = threeWayRec.find((r) => /\d/.test(r.month) && r.month.includes(String(F.prevDate.getFullYear())) && r.month.toLowerCase().startsWith(F.prevDate.toLocaleString('en-US', { month: 'short' }).toLowerCase()));
  const officeBanks = F.banksOf('Office');
  const over60 = F.aging[2] + F.aging[3];
  const slips = F.periodSlips;
  const payGross = slips.reduce((s, p) => s + (F.slipCalc(p)?.gross || 0), 0);
  const payRef = slips.reduce((s, p) => s + Number(p.referralFee || 0), 0);
  const kpis: [string, string, string, string][] = [
    ['Client account', rmShort(F.trustTotal), `${F.ledgers.length} ledgers · ${prevRec ? F.prevDate.toLocaleString('en-US', { month: 'short' }) + (prevRec.status === 'MATCHED' ? ' balanced' : ' not balanced') : 'no reconciliation on file'}`, '#2F6F4E'],
    ['Office ACCOUNT', F.officeCash == null ? '—' : rmShort(F.officeCash), F.officeCash == null ? 'no office bank account set up' : ((officeBanks.length ? officeBanks.map((b) => b.bankName) : F.firmBanksOf('Office').map((b) => b.bankName)).join(' + ') || 'office'), '#16223A'],
    ['OWING', rmShort(F.owedTotal), `${F.openInvoices.length} invoices · ${rmShort(over60)} over 60 days`, '#B23A2E'],
    ['UNBILLED', rmShort(F.wipTotal), `${F.unbilled.length} files · ${F.unbilled.filter((u) => u.oldest > 60).length} over 60 days`, '#8A6534'],
    ['Payroll ' + lastDayLabel, slips.length ? rm(payGross) : '—', slips.length ? 'incl. ' + rm(payRef) + ' referral fees' : 'no payslips keyed in yet', '#3D6B9C'],
  ];

  /* ---------------- Month-end close ---------------- */
  const acct = users.find((u) => /account/i.test(String(u.role)) && u.status !== 'Inactive');
  const mpUser = users.find((u) => u.isSuperAdmin) || currentUser;
  const AC = acct ? initials(acct.name) : 'AC', MP = initials(mpUser?.name) || 'SA';
  const staffN = F.staff.length;
  const waitingClaims = F.apItems.filter((a) => a.type === 'Staff claim' || a.type === 'Payment voucher').length;
  const old60 = F.unbilled.filter((u) => u.oldest > 60);
  const stmtClients = F.ledgers.filter((l) => l.balance > 0.005).length;
  const recThisMonth = receipts.filter((r) => inPeriod(r.date, period)).length;
  const payThisMonth = payments.filter((p) => inPeriod(p.date, period)).length;
  const CL: [string, string, string, string, string, FinTab | ''][] = [
    ['c1', `Record all bank receipts to ${lastDayLabel}`, `${recThisMonth} receipt${recThisMonth === 1 ? '' : 's'} recorded this month`, lastDayLabel, AC, ''],
    ['c2', 'Match receipts to invoices', `${payThisMonth} payment${payThisMonth === 1 ? '' : 's'} matched`, lastDayLabel, AC, ''],
    ['c3', 'Bill work older than 60 days', `${old60.length} matters · ${rmShort(old60.reduce((s, u) => s + u.time + u.disb, 0))}`, lastDayLabel, 'PT', 'billing'],
    ['c4', 'Approve staff claims & vouchers', `${waitingClaims} item${waitingClaims === 1 ? '' : 's'} waiting`, lastDayLabel, MP, 'approvals'],
    ['c5', `Approve ${monthName} referral fees`, `${F.referral.rows.length} referrer${F.referral.rows.length === 1 ? '' : 's'} · paid with payroll`, lastDayLabel, MP, 'approvals'],
    ['c6', 'Run payroll & send payslips', `${staffN} staff`, lastDayLabel, AC, 'payroll'],
    ['c7', `Client account reconciliation (${monShort})`, 'ledgers vs cash book vs bank', '15 ' + nextMonShort, AC, 'trust'],
    ['c8', 'Pay EPF, SOCSO, EIS & PCB', 'from payroll', '15 ' + nextMonShort, AC, 'payroll'],
    ['c10', 'Send monthly client statements', `${stmtClients} client${stmtClients === 1 ? '' : 's'} with money in client account`, '1 ' + nextMonShort, AC, 'trust'],
    ['c9', 'SST return & e-Invoice check', 'SST-02 period · LHDN MyInvois not connected', 'end ' + nextMonShort, AC, 'reports'],
  ];
  // The list is the usual law-firm month end (with live counts); the firm can rename or remove
  // those and add its own (Edit list).
  const ME = F.settings.monthEndEdits || {};
  const CLx: typeof CL = [...CL.filter(([id]) => !(ME.hidden || []).includes(id)).map(([id, label, ...rest]) => [id, (ME.names || {})[id] || label, ...rest] as (typeof CL)[number]), ...(ME.own || []).map((o) => [o.id, o.label, o.note, o.due || lastDayLabel, o.owner || AC, ''] as (typeof CL)[number])];
  const saveME = (patch: Partial<NonNullable<typeof ME>>) => F.saveSettings({ monthEndEdits: { ...ME, ...patch } });
  const mec = F.settings.monthEndClose || {};
  const close = CLx.map(([id, label, note, due, owner, tab]) => { const d = !!mec[F.closeKey(id)]; return { id, label, note, owner, tab, d, due: d ? 'Done' : 'by ' + due, dc: d ? '#2F6F4E' : due === lastDayLabel ? '#B23A2E' : '#8A6534', pc: owner === MP ? '#16223A' : owner === 'PT' ? '#3D6B9C' : '#5E6F2F', title: d ? `ticked by ${mec[F.closeKey(id)].by}` : '' }; });
  const closeDone = close.filter((c) => c.d).length;

  /* ---------------- Office money in & out ---------------- */
  // Same definition as Books & Reports → Profit & loss (F.pnl): fee income excludes SST and
  // disbursements; approved / paid costs only; payroll counted once; remittances, drawings and
  // disbursements are not costs.
  const P = F.pnl((d) => inPeriod(d, period));
  const feesIn = P.income, salaries = P.payroll, rent = P.rent, other = P.otherCosts;
  const flows: [string, number, string][] = [['Fees received', feesIn, '#2F6F4E'], ['Salaries & statutory', salaries, '#B23A2E'], ['Rent & utilities', rent, '#8A6534'], ['Other expenses', other, '#8A6534']];
  const flowMax = Math.max(1, ...flows.map((f) => f[1]));
  const net = P.net;

  /* ---------------- Debtor ageing ---------------- */
  const agTot = Math.max(1, F.aging.reduce((s, v) => s + v, 0));
  const aging: [string, number, string][] = [['0–30 days', F.aging[0], '#2F6F4E'], ['31–60 days', F.aging[1], '#C9A86A'], ['61–90 days', F.aging[2], '#B2542F'], ['Over 90 days', F.aging[3], '#B23A2E']];

  return (
    <div style={css('display:flex;flex-direction:column;gap:16px')}>
      <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Alerts for Accounts</strong>{faNew > 0 && <span style={css('font-size:10px;font-weight:800;padding:1px 7px;border-radius:10px;background:#E11D48;color:#fff')}>{faNew} new</span>}<span style={css('font-size:10.5px;color:#5B6478')}>email alerts to accounts@shcolaw.com not connected yet</span><button type="button" onClick={() => F.markRead(alerts.map((a) => a.id))} style={css('margin-left:auto;border:0;background:none;font-size:10.5px;font-weight:700;color:#3D6B9C;cursor:pointer;font-family:inherit')}>Mark all read</button></div>
        {alerts.length === 0 && <div style={css('padding:12px 14px;font-size:11.5px;color:#5B6478')}>Nothing needs Accounts right now.</div>}
        {alerts.slice(0, 12).map((a) => { const r = !!F.faRead[a.id]; return (
          <div key={a.id} style={css(`display:grid;grid-template-columns:10px 120px minmax(0,1fr) 110px 120px;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid #F0F2F5;background:${r ? '#fff' : '#FFF9FA'}`)}>
            <span style={css(`width:8px;height:8px;border-radius:9999px;background:${r ? '#C9D3E0' : '#E11D48'}`)}></span>
            <span style={css(`justify-self:start;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${FK[a.kind][0]};color:${FK[a.kind][1]}`)}>{a.kind}</span>
            <span style={css('min-width:0')}><span style={css(`display:block;font-size:11.5px;line-height:1.4;color:#16223A;font-weight:${r ? 500 : 700}`)}>{a.text}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{a.meta}</span></span>
            <span style={css('text-align:right;font-size:12px;font-weight:700;color:#16223A')}>{a.amt ? rm2(a.amt) : ''}</span>
            <button type="button" onClick={() => { F.markRead([a.id]); if (a.tab === 'approvals') F.setApSub(a.cta === 'Pay' ? 'p' : 'w'); F.go(F.TABS.some((t) => t[0] === a.tab) ? a.tab : F.tab); }} style={css('justify-self:end;border:1px solid #16223A;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit;white-space:nowrap')}>{a.cta}</button>
          </div>
        ); })}
      </div>
      <section style={css('display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px')}>
        {kpis.map(([label, value, note, color]) => (
          <div key={label} style={css(`border-radius:12px;border:1px solid #DDE3EB;background:#fff;padding:14px 16px;display:flex;flex-direction:column;gap:5px;border-top:3px solid ${color}`)}>
            <span style={css('font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5B6478')}>{label}</span>
            <span style={css('font-family:ui-serif, Georgia, serif;font-size:22px;font-weight:700;color:#16223A;line-height:1.1')}>{value}</span>
            <span style={css('font-size:10.5px;line-height:1.4;color:#5B6478')}>{note}</span>
          </div>
        ))}
      </section>
      <section style={css('display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:start')}>
        <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
          <div style={css('display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>{monthName} month-end close</strong><span style={css('font-size:10.5px;color:#5B6478')}>{closeDone} of {close.length} done</span><button type="button" onClick={() => setMeEdit(!meEdit)} style={css('border:1px solid #DDE3EB;border-radius:6px;padding:3px 9px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>{meEdit ? 'Done' : 'Edit list'}</button><div style={css('margin-left:auto;width:140px;height:6px;border-radius:3px;background:#EEF1F5')}><div style={css(`height:6px;border-radius:3px;background:#2F6F4E;width:${Math.round(closeDone / close.length * 100)}%`)}></div></div></div>
          {meEdit && (
            <div style={css('padding:9px 14px;border-bottom:1px solid #EEF1F5;background:#FBFCFD;display:flex;flex-direction:column;gap:6px')}>
              <span style={css('font-size:10.5px;color:#5B6478')}>The usual month-end steps for a law firm, with live counts from the portal. Rename or remove any, or add your own.</span>
              {close.map((c) => (
                <div key={c.id} style={css('display:flex;align-items:center;gap:8px;font-size:11.5px;color:#16223A')}>
                  <span style={css('flex:1;min-width:0')}>{c.label}</span>
                  <button type="button" onClick={() => { const n = window.prompt('Name', c.label); if (!n?.trim()) return; if ((ME.own || []).some((o) => o.id === c.id)) saveME({ own: (ME.own || []).map((o) => (o.id === c.id ? { ...o, label: n.trim() } : o)) }); else saveME({ names: { ...(ME.names || {}), [c.id]: n.trim() } }); }} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#2F4F7A;cursor:pointer')}>Rename</button>
                  <button type="button" onClick={() => { if (!window.confirm('Remove “' + c.label + '” from the month-end list?')) return; if ((ME.own || []).some((o) => o.id === c.id)) saveME({ own: (ME.own || []).filter((o) => o.id !== c.id) }); else saveME({ hidden: [...(ME.hidden || []), c.id] }); }} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#B23A2E;cursor:pointer')}>Remove</button>
                </div>
              ))}
              <div style={css('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
                <button type="button" onClick={() => { const label = window.prompt('New month-end item (e.g. Renew Bar practising certificate reminder)'); if (!label?.trim()) return; const due = window.prompt('Due (e.g. 31 Oct, or 15 of next month)', lastDayLabel) || lastDayLabel; const owner = (window.prompt('Who does it (initials, e.g. AC or SH)', AC) || AC).toUpperCase().slice(0, 3); saveME({ own: [...(ME.own || []), { id: 'own-' + Date.now(), label: label.trim(), note: '', due, owner }] }); }} style={css('border:1px solid #16223A;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer')}>+ Add item</button>
                {!!((ME.hidden || []).length || Object.keys(ME.names || {}).length) && <button type="button" onClick={() => { if (window.confirm('Bring back the usual list (your own items stay)?')) saveME({ hidden: [], names: {} }); }} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#8A6D3B;cursor:pointer')}>Restore the usual list</button>}
              </div>
            </div>
          )}
          {close.map((c) => (
            <div key={c.id} title={c.title} style={css('display:grid;grid-template-columns:22px minmax(0,1fr) 96px 30px 80px;gap:10px;align-items:center;padding:8px 14px;border-bottom:1px solid #F0F2F5')}>
              <button type="button" onClick={() => F.toggleClose(c.id)} style={css(`width:18px;height:18px;border-radius:5px;display:grid;place-items:center;cursor:pointer;font-size:11px;font-weight:800;padding:0;border:1.5px solid ${c.d ? '#2F6F4E' : '#C9D3E0'};background:${c.d ? '#2F6F4E' : '#fff'};color:#fff`)}>{c.d ? '✓' : ''}</button>
              <span style={css('min-width:0')}><span style={css(`display:block;font-size:11.5px;font-weight:600;color:${c.d ? '#5B6478' : '#16223A'};text-decoration:${c.d ? 'line-through' : 'none'}`)}>{c.label}</span><span style={css('display:block;font-size:10px;color:#5B6478')}>{c.note}</span></span>
              <span style={css(`font-size:10.5px;font-weight:700;color:${c.dc}`)}>{c.due}</span>
              <span style={css(`width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;color:#fff;background:${c.pc}`)}>{c.owner}</span>
              {c.tab && !c.d && F.TABS.some((t) => t[0] === c.tab) ? <button type="button" onClick={() => F.go(c.tab as FinTab)} style={css('justify-self:end;border:0;background:none;font-size:10.5px;font-weight:700;color:#8A6D3B;cursor:pointer;font-family:inherit')}>Open -&gt;</button> : <span></span>}
            </div>
          ))}
        </div>
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
            <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Office money in &amp; out · {monthName}</strong></div>
            {flows.map(([label, a, color]) => (
              <div key={label} style={css('padding:8px 14px')}><div style={css('display:flex;font-size:11.5px;color:#16223A')}><span>{label}</span><strong style={css(`margin-left:auto;color:${color}`)}>{rm(a)}</strong></div><div style={css('margin-top:4px;height:8px;border-radius:3px;background:#EEF1F5')}><div style={css(`height:8px;border-radius:3px;background:${color};width:${Math.round(a / flowMax * 100)}%`)}></div></div></div>
            ))}
            <div style={css('display:flex;padding:9px 14px;background:#F6F8FA;border-top:1px solid #EEF1F5;font-size:11.5px;color:#16223A')}><span>Net for the month</span><strong style={css(`margin-left:auto;color:${net >= 0 ? '#2F6F4E' : '#B23A2E'}`)}>{net >= 0 ? '+ ' : '- '}{rm(Math.abs(net))}</strong></div>
            <div style={css('padding:7px 14px;font-size:10.5px;color:#5B6478')}>Not income: SST collected {rm(P.sstCollected)} · disbursements recovered {rm(P.disbRecovered)} · proforma money received {rm(P.advanceReceived)} (income once invoiced)</div>
          </div>
          <div style={css('overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff')}>
            <div style={css('padding:10px 14px;border-bottom:1px solid #EEF1F5')}><strong style={css('font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A')}>Who owes us, by age</strong></div>
            <div style={css('padding:12px 14px')}><div style={css('display:flex;height:16px;border-radius:4px;overflow:hidden;background:#EEF1F5')}>{aging.map(([label, a, color]) => <span key={label} style={css(`background:${color};width:${Math.round(a / agTot * 100)}%`)}></span>)}</div>
              <div style={css('margin-top:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px')}>{aging.map(([label, a, color]) => <div key={label}><div style={css('display:flex;align-items:center;gap:5px;font-size:10px;color:#5B6478')}><span style={css(`width:8px;height:8px;border-radius:2px;background:${color}`)}></span>{label}</div><div style={css('font-size:12.5px;font-weight:700;color:#16223A')}>{rm(a)}</div></div>)}</div></div>
          </div>
        </div>
      </section>
      <button type="button" onClick={() => F.setGuide(true)} style={css('align-self:flex-start;border:0;background:none;padding:0;font-size:11.5px;font-weight:600;color:#3D6B9C;cursor:pointer;font-family:inherit')}>How money moves, A to Z -&gt;</button>
    </div>
  );
};

// Re-exported helpers used by other tabs.
