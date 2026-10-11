import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

export interface AskField {
  key: string;
  label: string;
  value?: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'select';
  options?: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

const FormBox: React.FC<{ title: string; note?: string; ok: string; fields: AskField[]; done: (v: Record<string, string> | null) => void }> = ({ title, note, ok, fields, done }) => {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.value ?? (f.type === 'select' ? f.options?.[0] || '' : '')])));
  const missing = fields.filter((f) => f.required && !String(v[f.key] || '').trim());
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #C9D1DC', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#16223A', fontFamily: 'inherit', background: '#fff' };
  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') done(null); }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(22,34,58,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 110, overflow: 'auto' }}>
      <form onSubmit={(e) => { e.preventDefault(); if (!missing.length) done(v); }} style={{ width: 460, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 12, overflow: 'hidden', fontFamily: 'inherit' }}>
        <div style={{ padding: '12px 16px', background: '#16223A', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {note && <span style={{ fontSize: 11.5, lineHeight: 1.5, color: '#5B6478' }}>{note}</span>}
          {fields.map((f, i) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5B6478' }}>{f.label}{f.required ? ' *' : ''}</span>
              {f.type === 'textarea' ? <textarea autoFocus={i === 0} rows={4} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={{ ...inp, resize: 'vertical' }} />
                : f.type === 'select' ? <select value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  : <input autoFocus={i === 0} type={f.type || 'text'} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={inp} />}
              {f.hint && <span style={{ fontSize: 10.5, color: '#5B6478' }}>{f.hint}</span>}
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => done(null)} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!!missing.length} style={{ border: 0, borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer', opacity: missing.length ? 0.5 : 1 }}>{ok}</button>
          </div>
        </div>
      </form>
    </div>
  );
};

/** A small form in a window (instead of browser pop-up questions). Resolves the values, or null when cancelled. */
export const askForm = (title: string, fields: AskField[], opts: { note?: string; ok?: string } = {}): Promise<Record<string, string> | null> =>
  new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: Record<string, string> | null) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<FormBox title={title} note={opts.note} ok={opts.ok || 'Save'} fields={fields} done={done} />);
  });
