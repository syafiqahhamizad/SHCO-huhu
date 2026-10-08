import React, { useState } from 'react';
import { escapeHtml } from '../../lib/html';
import type { Case, Client } from '../../types';
import { css } from '../views/finance/financeModel';
import { courtOf, fmt, lawyerOf, openedOf, partiesOf, practiceOf } from '../views/cases/caseModel';

interface FileCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCase: Case;
  clients?: Client[];
  /** Partner names for the footer (codes are resolved by the caller). */
  partnerNames?: string[];
  onPrinted?: (copies: number) => void;
}

const esc = escapeHtml;

/** A4 cover sheet for the physical folder (design: Working File › Print file cover). Every
 * active client, opposing party and opposing solicitor on record is printed. */
export const FileCoverModal: React.FC<FileCoverModalProps> = ({ isOpen, onClose, selectedCase: c, clients = [], partnerNames = [], onPrinted }) => {
  const [copies, setCopies] = useState('1');
  if (!isOpen) return null;
  const court = courtOf(c);
  const parties = partiesOf(c, clients).filter((p) => !p.dischargedOn);
  const courtRows: [string, string][] = [['Court', court.name || '—'], ['Suit no.', court.suit || '—'], ['Division', court.division || '—'], ['Coram', court.coram || '—']];
  const groups: [string, typeof parties][] = [['Our clients', parties.filter((p) => p.side === 'client')], ['Opposing parties', parties.filter((p) => p.side === 'opposing')], ['Opposing solicitors', parties.filter((p) => p.side === 'solicitor')]];
  const foot: [string, string][] = [['Partner', partnerNames.join(', ') || '—'], ['Lawyer', lawyerOf(c) || '—'], ['Opened', fmt(openedOf(c))]];
  const sub = (p: (typeof parties)[number]) => [p.idNo, p.contact || [p.phone, p.email].filter(Boolean).join(' · ')].filter(Boolean).join(' · ');

  const print = () => {
    const n = Math.max(1, Math.min(20, Number(copies) || 1));
    const page = `<div class="pg"><div class="hd"><div><div class="fn">SYAFIQAH HAMIZAD &amp; CO</div><div class="fs">ADVOCATES &amp; SOLICITORS</div></div><div class="pr">${esc(practiceOf(c).toUpperCase())}</div></div>
<div><div class="k">Our file ref.</div><div class="ref">${esc(c.ref)}</div></div>
<div class="cg">${courtRows.map(([k, v]) => `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
${groups.map(([t, rows]) => `<div class="gr"><div class="k">${esc(t)}</div>${rows.length ? rows.map((p) => `<div class="pr2"><div><strong>${esc(p.name)}</strong><div class="s">${esc(sub(p))}</div></div><div class="rl">${esc(p.role)}</div></div>`).join('') : '<div class="s">None recorded</div>'}</div>`).join('')}
<div class="ft">${foot.map(([k, v]) => `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div>`;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;
    win.document.write(`<html><head><title>File cover ${esc(c.ref)}</title><style>@page{size:A4;margin:0}body{margin:0;font-family:Inter,Arial,sans-serif;color:#16223A}.pg{width:210mm;height:297mm;box-sizing:border-box;padding:18mm 18mm;display:flex;flex-direction:column;gap:16px;page-break-after:always}.hd{display:flex;align-items:flex-end;border-bottom:2px solid #16223A;padding-bottom:10px}.fn{font-family:Georgia,serif;font-size:17px;font-weight:700;letter-spacing:.06em}.fs{font-size:10px;letter-spacing:.1em;color:#4A5468}.pr{margin-left:auto;font-size:11px;font-weight:700;letter-spacing:.08em;color:#4A5468}.k{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468}.ref{font-family:ui-monospace,monospace;font-size:20px;font-weight:800}.cg{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}.v{font-size:12.5px;line-height:1.4}.gr{border-top:1px solid #DDE3EB;padding-top:10px;display:flex;flex-direction:column;gap:6px}.pr2{display:grid;grid-template-columns:1fr 140px;gap:10px;font-size:12.5px}.s{font-size:11px;color:#4A5468}.rl{text-align:right}.ft{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-top:2px solid #16223A;padding-top:10px}</style></head><body>${Array.from({ length: n }, () => page).join('')}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    onPrinted?.(n);
    onClose();
  };

  return (
    <div onClick={onClose} style={css('position:fixed;inset:0;background:rgba(22,34,58,.45);display:grid;place-items:center;padding:20px;z-index:50')}>
      <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:720px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;border-radius:12px;background:#fff;box-shadow:0 18px 40px rgba(0,0,0,.25)')}>
        <div style={css('padding:16px 20px;border-bottom:1px solid #EEF1F5;display:flex;flex-direction:column;gap:4px')}><strong style={css('font-family:Georgia, serif;font-size:17px;color:#16223A')}>File cover</strong><span style={css('font-size:12.5px;color:#4A5468')}>A4 cover sheet for the physical folder. Filled from this file: every party and firm on record.</span></div>
        <div style={css('flex:1;overflow:auto;padding:20px;background:#EEF1F5')}>
          <div style={css('max-width:560px;margin:0 auto;aspect-ratio:210/297;background:#fff;border:1px solid #C9D1DC;box-shadow:0 4px 14px rgba(22,34,58,.12);padding:34px 36px;display:flex;flex-direction:column;gap:16px')}>
            <div style={css('display:flex;align-items:flex-end;gap:10px;border-bottom:2px solid #16223A;padding-bottom:10px')}><div style={css('display:flex;flex-direction:column;gap:2px')}><strong style={css('font-family:Georgia, serif;font-size:15px;letter-spacing:.06em;color:#16223A')}>SYAFIQAH HAMIZAD &amp; CO</strong><span style={css('font-size:10px;letter-spacing:.1em;color:#4A5468')}>ADVOCATES &amp; SOLICITORS</span></div><span style={css('margin-left:auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468')}>{practiceOf(c)}</span></div>
            <div style={css('display:flex;flex-direction:column;gap:4px')}><span style={css('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468')}>Our file ref.</span><span style={css('font-family:ui-monospace, monospace;font-size:18px;font-weight:800;color:#16223A')}>{c.ref}</span></div>
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:10px 16px')}>
              {courtRows.map(([k, v]) => <div key={k} style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468')}>{k}</span><span style={css('font-size:12px;color:#16223A;line-height:1.4')}>{v}</span></div>)}
            </div>
            {groups.map(([t, rows]) => (
              <div key={t} style={css('display:flex;flex-direction:column;gap:5px;border-top:1px solid #DDE3EB;padding-top:10px')}>
                <span style={css('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468')}>{t}</span>
                {rows.map((p) => <div key={p.id} style={css('display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:10px;font-size:12px;line-height:1.4')}><div style={css('display:flex;flex-direction:column;min-width:0')}><strong style={css('color:#16223A')}>{p.name}</strong><span style={css('color:#4A5468;font-size:11px')}>{sub(p)}</span></div><span style={css('color:#16223A;text-align:right')}>{p.role}</span></div>)}
                {!rows.length && <span style={css('color:#94A3B8;font-size:11px')}>None recorded</span>}
              </div>
            ))}
            <div style={css('margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-top:2px solid #16223A;padding-top:10px')}>
              {foot.map(([k, v]) => <div key={k} style={css('display:flex;flex-direction:column;gap:2px')}><span style={css('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4A5468')}>{k}</span><span style={css('font-size:12px;color:#16223A')}>{v}</span></div>)}
            </div>
          </div>
        </div>
        <div style={css('padding:14px 20px;border-top:1px solid #EEF1F5;display:flex;align-items:center;gap:10px')}>
          <label style={css('display:flex;align-items:center;gap:8px;font-size:12.5px;color:#16223A')}>Copies <input type="number" min="1" max="20" value={copies} onChange={(e) => setCopies(e.target.value)} style={css('width:64px;border:1px solid #C9D1DC;border-radius:8px;padding:6px 8px;font-size:13px;font-family:inherit')} /></label>
          <button type="button" onClick={onClose} style={css('margin-left:auto;border:1px solid #C9D1DC;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Cancel</button>
          <button type="button" onClick={print} style={css('border:0;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit')}>Print cover</button>
        </div>
      </div>
    </div>
  );
};

