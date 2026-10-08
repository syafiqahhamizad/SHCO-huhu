import React, { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { css } from './caseUi';

interface PickOption { value: string; label: string; hint?: string }

/**
 * Searchable multi-select: chosen people show as chips; type to filter the list, click (or Enter)
 * to add, × or Backspace to remove. Used for partner(s) and lawyers in charge.
 */
export const PeoplePicker: React.FC<{
  id: string;
  options: PickOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}> = ({ id, options, value, onChange, placeholder }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label || v;
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return options.filter((o) => !value.includes(o.value) && (!n || (o.label + ' ' + (o.hint || '') + ' ' + o.value).toLowerCase().includes(n)));
  }, [options, value, q]);
  const add = (v: string) => { onChange([...value, v]); setQ(''); setHi(0); input.current?.focus(); };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  return (
    <div style={css('position:relative')}>
      <div onClick={() => input.current?.focus()} style={css('display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:42px;padding:5px 8px;border:1px solid #C9D1DC;border-radius:8px;background:#fff;cursor:text')}>
        {value.map((v) => (
          <span key={v} style={css('display:inline-flex;align-items:center;gap:6px;border-radius:7px;padding:5px 8px 5px 11px;background:#16223A;color:#fff;font-size:12.5px;font-weight:600')}>
            {labelOf(v)}
            <button type="button" aria-label={'Remove ' + labelOf(v)} onClick={(e) => { e.stopPropagation(); remove(v); }} style={css('display:grid;place-items:center;border:0;background:none;padding:0;color:#fff;cursor:pointer')}><X size={13} /></button>
          </span>
        ))}
        <input
          id={id}
          ref={input}
          value={q}
          placeholder={value.length ? 'Add another…' : placeholder || 'Search by name or code'}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); add(matches[hi].value); }
            else if (e.key === 'Backspace' && !q && value.length) remove(value[value.length - 1]);
            else if (e.key === 'Escape') setOpen(false);
          }}
          style={css('flex:1;min-width:140px;border:0;outline:0;font-size:13px;font-family:inherit;color:#16223A;padding:5px 2px;background:transparent')}
        />
      </div>
      {open && (
        <div role="listbox" style={css('position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;max-height:240px;overflow:auto;background:#fff;border:1px solid #DDE3EB;border-radius:8px;box-shadow:0 10px 24px rgba(22,34,58,.15)')}>
          {matches.map((o, i) => (
            <button key={o.value} type="button" role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); add(o.value); }} onMouseEnter={() => setHi(i)}
              style={css(`display:flex;width:100%;justify-content:space-between;gap:10px;border:0;padding:9px 12px;text-align:left;font-size:13px;font-family:inherit;cursor:pointer;color:#16223A;background:${i === hi ? '#F1F4F8' : '#fff'}`)}>
              <span>{o.label}</span>{o.hint && <span style={css('font-size:12px;color:#5B6478')}>{o.hint}</span>}
            </button>
          ))}
          {!matches.length && <div style={css('padding:10px 12px;font-size:12.5px;color:#5B6478')}>{options.length === value.length ? 'Everyone is already added.' : 'No one matches. Add them in Firm & Practice Settings › Users & Roles.'}</div>}
        </div>
      )}
    </div>
  );
};
