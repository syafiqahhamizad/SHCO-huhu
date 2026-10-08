import React, { useState } from 'react';
import { FileText, Printer, Eye, FileDown, X } from 'lucide-react';
import type { Case, Client } from '../../../types';
import { warrantToActHtml, type WarrantInput } from '../../../lib/warrantToAct';
import { pdf, word } from '../../../lib/financeDocs';
import { getPracticeSettings } from '../../../services/templateService';
import { courtOf } from './caseModel';
import { css } from './caseUi';

/** "9th day of October 2026" — the usual dating line on a warrant. */
export const datedLine = (d = new Date()) => {
  const n = d.getDate();
  const th = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${th} day of ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
};

/** Warrant details from a file and its client record. */
export const warrantInputFor = (c: Case, client?: Client, otherParty?: string): WarrantInput => {
  const court = courtOf(c);
  return {
    client: {
      name: client?.name || c.clientName || '',
      type: client?.type,
      idNo: client ? (client.type === 'Corporate' ? client.registrationNo : client.icNo || client.icNumber) : c.clientsList?.[0]?.icOrRegNo,
      address: client?.address,
    },
    matterTitle: c.title,
    side: c.clientRole,
    court: court.name,
    suitNo: court.suit,
    otherParty: otherParty || c.opposingParty || (c.opposingParties || [])[0],
    fileRef: c.ref,
    firmName: 'Syafiqah Hamizad & Co',
    firmAddress: getPracticeSettings().address,
    date: datedLine(),
  };
};

const BTN = 'display:inline-flex;align-items:center;gap:6px;border:1px solid #C9D1DC;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit';

/** View on screen, PDF, Print and Word for a Warrant to Act. */
export const WarrantToActActions: React.FC<{ input: WarrantInput; onDone?: (what: string) => void }> = ({ input, onDone }) => {
  const [open, setOpen] = useState(false);
  const html = warrantToActHtml(input);
  const title = 'Warrant to Act ' + (input.fileRef || '').replace(/\//g, '-');
  return (
    <>
      <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
        <button type="button" onClick={() => { setOpen(true); onDone?.('viewed'); }} style={css(BTN)}><Eye size={14} />View</button>
        <button type="button" onClick={() => { pdf(title, html); onDone?.('PDF'); }} title="Opens the print window; choose “Save as PDF”" style={css(BTN)}><FileDown size={14} />PDF</button>
        <button type="button" onClick={() => { pdf(title, html); onDone?.('printed'); }} style={css(BTN)}><Printer size={14} />Print</button>
        <button type="button" onClick={() => { word(title, html); onDone?.('Word'); }} style={css(BTN)}><FileText size={14} />Word</button>
      </div>
      {open && (
        <div role="dialog" aria-label="Warrant to Act" onClick={() => setOpen(false)} style={css('position:fixed;inset:0;z-index:80;background:rgba(22,34,58,.55);display:flex;flex-direction:column;align-items:center;padding:24px 16px;overflow:auto')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:100%;max-width:820px;display:flex;flex-direction:column;gap:10px')}>
            <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
              <strong style={css('color:#fff;font-size:14px;margin-right:auto')}>Warrant to Act · {input.fileRef}</strong>
              <button type="button" onClick={() => pdf(title, html)} style={css(BTN)}><FileDown size={14} />PDF</button>
              <button type="button" onClick={() => pdf(title, html)} style={css(BTN)}><Printer size={14} />Print</button>
              <button type="button" onClick={() => word(title, html)} style={css(BTN)}><FileText size={14} />Word</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={css(BTN)}><X size={14} /></button>
            </div>
            <div style={css('background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.3);padding:56px 64px;min-height:1000px;box-sizing:border-box')} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      )}
    </>
  );
};
