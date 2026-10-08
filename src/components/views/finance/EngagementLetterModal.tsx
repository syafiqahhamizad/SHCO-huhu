import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, rm2 } from './financeModel';
import { engagementLetterHtml, feeTotals, planTotal, type DocLang } from '../../../lib/engagementLetter';
import { EngagementLetterActions, LangToggle, engagementInputFor } from '../cases/WarrantToAct';
import type { Quotation } from '../../../types';

/** Payment-plan rows of a quotation with the proforma issued for each (or a button to issue it). */
export const PlanRowsPanel = ({ F, q }: { F: FinanceCtrl; q: Quotation }) => {
  const rows = F.planStatus(q);
  if (!rows.length) return null;
  const st = F.qStatus(q);
  const canIssue = (st === 'Accepted' || st === 'Proforma made') && F.rk !== 'R';
  const kind = F.planOf(q)?.kind === 'Instalments' ? 'Monthly instalments' : 'Payment by stages';
  return (
    <div style={css('border-radius:10px;background:#fff;border:1px solid #DDE3EB;overflow:hidden')}>
      <div style={css('display:flex;align-items:center;gap:8px;padding:8px 12px;background:#F6F8FA;border-bottom:1px solid #EEF1F5')}><strong style={css('font-size:11.5px;color:#16223A')}>{kind}</strong><span style={css('font-size:10.5px;color:#5B6478')}>{canIssue ? 'one proforma per row' : 'proformas can be issued once the quotation is accepted'}</span></div>
      {rows.map((r) => (
        <div key={r.key} style={css('display:grid;grid-template-columns:minmax(0,1fr) 110px 170px;gap:10px;align-items:center;padding:6px 12px;border-bottom:1px solid #F0F2F5;font-size:11.5px;color:#16223A')}>
          <span>{r.label}{r.due ? <span style={css('color:#5B6478')}> · {r.due}</span> : null}</span>
          <strong style={css('text-align:right')}>{rm2(r.amount)}</strong>
          <span style={css('justify-self:end')}>{r.proforma
            ? <button type="button" onClick={() => F.setView({ kind: 'quotation', id: r.proforma!.id })} style={css('border:0;background:none;padding:0;font-size:11px;font-weight:700;color:#2F6F4E;cursor:pointer;font-family:inherit;text-decoration:underline')}>Issued · {r.proforma.id}</button>
            : canIssue ? <button type="button" onClick={() => F.act('quotation', q, 'Issue proforma #' + r.key)} style={css('border:1px solid #16223A;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Issue proforma</button>
              : <span style={css('font-size:10.5px;color:#94A3B8')}>Not issued</span>}</span>
        </div>
      ))}
    </div>
  );
};

/** Billing › quotation › Letter of Engagement: the client-facing document for this quotation. */
export const EngagementLetterModal = ({ F }: { F: FinanceCtrl }) => {
  const q = F.app.quotations.find((x) => x.id === F.loe);
  if (!q) return null;
  const kase = F.qCase(q);
  const client = (q.partyId && F.lk.clientById.get(q.partyId)) || F.lk.clientByName.get((q.clientName || '').toLowerCase());
  const lang: DocLang = q.language || 'EN';
  const input = engagementInputFor(q, kase, client, F.app.users, lang);
  const html = engagementLetterHtml(input);
  const setLang = (l: DocLang) => { if (F.rk === 'R') { F.toastMsg('Read-only access.'); return; } F.app.updateQuotation(q.id, { language: l }); };
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:rgba(22,34,58,.6);overflow:auto;display:flex;justify-content:center;padding:24px 0 40px')}>
      <div style={css('width:840px;max-width:calc(100vw - 32px);align-self:flex-start;display:flex;flex-direction:column;gap:10px')}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#16223A;border-radius:10px;padding:8px 12px')}>
          <strong style={css('color:#fff;font-size:13px')}>{lang === 'BM' ? 'Sebut Harga & Surat Perlantikan' : 'Quotation & Letter of Engagement'}</strong><span style={css('font-size:10.5px;color:#C9D3E0')}>{q.id} · {F.qStatus(q)}</span>
          <button type="button" onClick={() => F.setLoe(null)} style={css('margin-left:auto;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;background:transparent;color:#fff;cursor:pointer;font-family:inherit;white-space:nowrap')}>Close</button>
        </div>
        <div style={css('display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border-radius:10px;padding:8px 12px')}>
          <LangToggle value={lang} onChange={setLang} />
          <span style={css('margin-left:auto')}><EngagementLetterActions input={input} /></span>
        </div>
        {input.fees && input.plan?.kind === 'Stages' && Math.abs(planTotal(input.plan, feeTotals(input.fees).total) - feeTotals(input.fees).total) > 0.005 && <div style={css('border-radius:10px;padding:8px 12px;background:#FBEDE9;font-size:11px;color:#B23A2E')}>The stages add up to {rm2(planTotal(input.plan, feeTotals(input.fees).total))}, not the quotation total {rm2(feeTotals(input.fees).total)}. Edit the payment plan on the quotation before sending.</div>}
        {!input.fees && <div style={css('border-radius:10px;padding:8px 12px;background:#FBEDE9;font-size:11px;color:#B23A2E')}>This quotation has no fee lines, so the letter has no fee section. Add the lines on the quotation first.</div>}
        <PlanRowsPanel F={F} q={q} />
        <div style={css('flex-shrink:0;width:794px;max-width:100%;min-height:1123px;margin:0 auto;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.3);padding:48px 58px;box-sizing:border-box;overflow-x:auto')} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
};
