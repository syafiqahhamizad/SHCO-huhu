import React, { useMemo, useState } from 'react';
import { builtInDocWording } from '../../../lib/financeDocs';
import { ARR_TERMS_BUILTIN, builtInLetterWording, type DocLang, type LetterWording } from '../../../lib/engagementLetter';
import { css, S, Area, type SettingsCtx } from './settingsShared';

type Wording = NonNullable<SettingsCtx['settings']['docWording']>;
type DocKey = 'quote' | 'proforma' | 'invoice' | 'all' | 'receipt' | 'inst' | 'letterEN' | 'letterBM';
/** One editable piece: plain text, a list (one per line) or headed paragraphs ("Heading: text" per line). */
type Kind = 'text' | 'list' | 'headed';
interface Field { k: string; label: string; hint?: string; kind?: Kind; rows?: number }

const DOCS: [DocKey, string, string][] = [
  ['quote', 'Quotation', 'note and terms on every quotation'],
  ['proforma', 'Proforma invoice', 'note on every proforma'],
  ['invoice', 'Invoice', 'your own note on every invoice'],
  ['all', 'Quotation, proforma & invoice', 'payment line and footer on all three'],
  ['receipt', 'Receipt', 'footer'],
  ['inst', 'Instalment terms', 'when a client pays monthly'],
  ['letterEN', 'Letter of Engagement · English', 'every heading and paragraph'],
  ['letterBM', 'Letter of Engagement · BM', 'every heading and paragraph'],
];
const FIELDS: Record<Exclude<DocKey, 'letterEN' | 'letterBM'>, Field[]> = {
  quote: [
    { k: 'quoteNote', label: 'Note under the total', rows: 3 },
    { k: 'quoteTermsLead', label: 'Line before the terms' },
    { k: 'quoteTerms', label: 'Terms', kind: 'list', hint: 'One term per line.', rows: 6 },
  ],
  proforma: [{ k: 'proformaNote', label: 'Note under the total', rows: 3 }],
  invoice: [{ k: 'invoiceNote', label: 'Note under the total', hint: 'Empty: no note. E.g. "Kindly settle within 14 days of the date of this invoice."', rows: 3 }],
  all: [
    { k: 'payLead', label: 'Line before the bank details' },
    { k: 'docFooter', label: 'Footer', rows: 2 },
  ],
  receipt: [{ k: 'receiptFooter', label: 'Footer', rows: 2 }],
  inst: [{ k: 'instTerms', label: 'Instalment terms', kind: 'headed', hint: 'One term per line as "Heading: text". Used for new quotations with monthly instalments.', rows: 10 }],
};
const LETTER: Field[] = [
  { k: 'title', label: 'Title' },
  { k: 'dear', label: 'Greeting' },
  { k: 'thanks', label: 'Opening paragraph', rows: 4 },
  { k: 'scope', label: 'Heading · scope' },
  { k: 'scopeLead', label: 'Line before the scope of work', rows: 2 },
  { k: 'scopeNone', label: 'When no scope of work is written', rows: 2 },
  { k: 'team', label: 'Heading · personnel' },
  { k: 'teamGeneral', label: 'Personnel paragraph', rows: 4 },
  { k: 'fees', label: 'Heading · fees' },
  { k: 'feeNotes', label: 'Fee notes (bullets under the fee total)', kind: 'list', hint: 'One note per line.', rows: 4 },
  { k: 'feesNone', label: 'When there is no quotation', rows: 2 },
  { k: 'auth', label: 'Heading · authority and terms' },
  { k: 'authLead', label: 'Line before the terms', rows: 2 },
  { k: 'clauses', label: 'Terms of engagement', kind: 'headed', hint: 'One term per line as "Heading: text". Add, remove or reorder lines freely.', rows: 14 },
  { k: 'terms', label: 'Heading · other terms' },
  { k: 'termList', label: 'Other terms', kind: 'headed', hint: 'One term per line as "Heading: text".', rows: 6 },
  { k: 'close', label: 'Closing paragraph', rows: 3 },
  { k: 'yf', label: 'Sign-off' },
];

const toText = (v: unknown, kind: Kind = 'text'): string =>
  kind === 'list' ? ((v as string[]) || []).join('\n') : kind === 'headed' ? (Array.isArray(v) ? (v as [string, string][]).map(([h, x]) => h + ': ' + x).join('\n') : String(v || '')) : String(v ?? '');
const fromText = (t: string, kind: Kind = 'text', asPairs = false): unknown => {
  const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
  if (kind === 'list') return lines;
  if (kind === 'headed' && asPairs) return lines.map((l) => { const m = l.match(/^([^:]{2,60}):\s*(.*)$/); return (m ? [m[1].trim(), m[2].trim()] : ['', l]) as [string, string]; });
  return kind === 'headed' ? lines.join('\n') : t.trim();
};

/** Firm & Practice Settings › Document wording: the firm's own wording on every generated client document. */
export const DocWordingTab = ({ C }: { C: SettingsCtx }) => {
  const [doc, setDoc] = useState<DocKey>('quote');
  const W: Wording = C.settings.docWording || {};
  const base = useMemo(() => ({ ...builtInDocWording(), instTerms: ARR_TERMS_BUILTIN }), []);
  const lang: DocLang | null = doc === 'letterEN' ? 'EN' : doc === 'letterBM' ? 'BM' : null;
  const letterBase = useMemo(() => (lang ? builtInLetterWording(lang) : null), [lang]);
  const fields = lang ? LETTER : FIELDS[doc as keyof typeof FIELDS];
  const title = DOCS.find((d) => d[0] === doc)![1];

  const own = (f: Field): unknown => (lang ? (W.letter?.[lang] as Record<string, unknown> | undefined)?.[f.k] : (W as Record<string, unknown>)[f.k]);
  const builtIn = (f: Field): string => toText(lang ? (letterBase as Record<string, unknown>)[f.k] : (base as Record<string, unknown>)[f.k], f.kind);
  const isOwn = (f: Field) => { const v = own(f); return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== ''; };
  const shown = (f: Field) => (isOwn(f) ? toText(own(f), f.kind) : builtIn(f));

  const put = (f: Field, value: unknown, what: string) => {
    const empty = value == null || (Array.isArray(value) ? !value.length : String(value).trim() === '');
    if (lang) {
      const cur: LetterWording = { ...(W.letter?.[lang] || {}) };
      const rec = cur as Record<string, unknown>;
      if (empty) delete rec[f.k]; else rec[f.k] = value;
      C.save({ docWording: { ...W, letter: { ...(W.letter || {}), [lang]: cur } } }, 'Document Wording Changed', title + ' · ' + f.label + ' · ' + what);
    } else {
      const cur = { ...W } as Record<string, unknown>;
      if (empty) delete cur[f.k]; else cur[f.k] = value;
      C.save({ docWording: cur as Wording }, 'Document Wording Changed', title + ' · ' + f.label + ' · ' + what);
    }
  };
  const commit = (f: Field, text: string) => {
    if (!text.trim() || text.trim() === builtIn(f).trim()) { if (isOwn(f)) put(f, null, 'back to the original'); return; }
    put(f, fromText(text, f.kind, !!lang && f.kind === 'headed'), 'changed');
  };
  const anyOwn = fields.some(isOwn);

  return (
    <div style={css('display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start')}>
      <div style={css(S.card)}>
        {DOCS.map(([k, label, sub]) => {
          const on = doc === k;
          return (
            <button key={k} type="button" onClick={() => setDoc(k)} style={css(`width:100%;display:block;padding:10px 14px;border:0;border-bottom:1px solid #F0F2F5;cursor:pointer;font-family:inherit;text-align:left;background:${on ? '#F6F8FA' : '#fff'};border-left:3px solid ${on ? '#16223A' : 'transparent'}`)}>
              <span style={css('display:block;font-size:12px;font-weight:700;color:#16223A')}>{label}</span>
              <span style={css('display:block;font-size:10.5px;color:#5B6478')}>{sub}</span>
            </button>
          );
        })}
        <div style={css(S.foot)}>Changes show on documents made, viewed or printed from now on. PDFs already saved or sent are not changed.</div>
      </div>
      <div style={css(S.card)}>
        <div style={css('display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #EEF1F5')}>
          <strong style={css(S.h)}>{title}</strong>
          <span style={css(S.sub)}>edit the text, then click outside the box to save</span>
          {anyOwn && <button type="button" onClick={() => { if (window.confirm('Put every piece of ' + title + ' back to the original wording?')) fields.filter(isOwn).forEach((f) => put(f, null, 'back to the original')); }} style={css('margin-left:auto;border:1px solid #DDE3EB;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit')}>Reset all to original</button>}
        </div>
        <div style={css('padding:12px 14px;display:flex;flex-direction:column;gap:12px')}>
          {fields.map((f) => (
            <label key={(lang || '') + f.k} style={css('display:flex;flex-direction:column;gap:4px')}>
              <span style={css('display:flex;align-items:center;gap:8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5B6478')}>
                {f.label}
                {isOwn(f) ? <span style={css('text-transform:none;letter-spacing:0;font-size:10px;padding:1px 7px;border-radius:9px;background:#E7EEF6;color:#2F5680')}>your wording</span> : <span style={css('text-transform:none;letter-spacing:0;font-size:10px;color:#8A93A5')}>original</span>}
                {isOwn(f) && <button type="button" onClick={(e) => { e.preventDefault(); put(f, null, 'back to the original'); }} style={css('border:0;background:none;padding:0;font-size:10.5px;font-weight:700;color:#B23A2E;cursor:pointer;font-family:inherit;text-transform:none;letter-spacing:0')}>Reset</button>}
              </span>
              <Area value={shown(f)} rows={f.rows || 1} onCommit={(v) => commit(f, v)} style="width:100%;box-sizing:border-box;border:1px solid #C9D1DC;border-radius:8px;padding:7px 9px;font-size:12px;line-height:1.5;color:#16223A;font-family:inherit;resize:vertical" />
              {f.hint && <span style={css('font-size:10.5px;color:#5B6478')}>{f.hint}</span>}
            </label>
          ))}
        </div>
        <div style={css(S.foot)}>To leave a note or footer out completely, type a single dash ( - ). Empty a box to go back to the original.</div>
      </div>
    </div>
  );
};
