import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Today as yyyy-mm-dd in local time. */
export const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const DateBox: React.FC<{ title: string; note?: string; initial: string; max?: string; done: (v: string | null) => void }> = ({ title, note, initial, max, done }) => {
  const [v, setV] = useState(initial);
  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') done(null); }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(22,34,58,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 140 }}>
      <form onSubmit={(e) => { e.preventDefault(); if (v) done(v); }} style={{ width: 360, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 12, overflow: 'hidden', fontFamily: 'inherit' }}>
        <div style={{ padding: '12px 16px', background: '#16223A', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {note && <span style={{ fontSize: 11.5, lineHeight: 1.5, color: '#5B6478' }}>{note}</span>}
          <input autoFocus type="date" value={v} max={max} onChange={(e) => setV(e.target.value)} style={{ border: '1px solid #C9D1DC', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#16223A', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => done(null)} style={{ border: '1px solid #DDE3EB', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, background: '#fff', color: '#16223A', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!v} style={{ border: 0, borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, background: '#16223A', color: '#fff', cursor: 'pointer', opacity: v ? 1 : 0.5 }}>OK</button>
          </div>
        </div>
      </form>
    </div>
  );
};

/**
 * Asks for a date with a calendar (default today). Resolves yyyy-mm-dd, or null when cancelled.
 * Used wherever the portal used to stamp "today" by itself, so past entries can be keyed in.
 */
export const pickDate = (title: string, opts: { note?: string; initial?: string; max?: string } = {}): Promise<string | null> =>
  new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: string | null) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<DateBox title={title} note={opts.note} initial={opts.initial || localToday()} max={opts.max} done={done} />);
  });
