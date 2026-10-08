import React from 'react';
import type { FinanceCtrl } from './useFinanceController';
import { css, rm2 } from './financeModel';
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

