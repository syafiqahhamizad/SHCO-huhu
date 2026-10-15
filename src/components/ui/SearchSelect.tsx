import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SearchOption { value: string; label: string; hint?: string; group?: string }

/**
 * Searchable single-choice drop-down: click to open the list, type to narrow it, click or Enter
 * to choose. Used wherever a plain <select> got too long (matters, clients, people).
 */
export const SearchSelect: React.FC<{
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Text shown when nothing matches. */
  empty?: string;
  /** Allow clearing back to no choice. */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  /** Offer "+ Add …" for a typed name that is not in the list. */
  onCreate?: (text: string) => void;
}> = ({ options, value, onChange, placeholder, empty, clearable, disabled, id, className, style, onCreate, ...rest }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const chosen = options.find((o) => o.value === value);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return !n ? options : options.filter((o) => (o.label + ' ' + (o.hint || '') + ' ' + (o.group || '')).toLowerCase().includes(n));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div ref={box} className={className} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => { if (disabled) return; setOpen(true); setTimeout(() => input.current?.focus(), 0); }}
        className="flex min-h-[34px] w-full cursor-pointer items-center gap-1.5 rounded-lg border border-[#C9D1DC] bg-white px-2.5 py-1.5 text-[12.5px] text-[#16223A]"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        {open ? (
          <input
            id={id}
            ref={input}
            value={q}
            aria-label={rest['aria-label']}
            placeholder={chosen ? chosen.label : 'Type to search…'}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (matches[hi]) pick(matches[hi].value); else if (onCreate && q.trim()) { onCreate(q.trim()); setOpen(false); setQ(''); } }
              else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); setQ(''); }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12.5px] outline-none"
          />
        ) : (
          <span className={`min-w-0 flex-1 truncate ${chosen ? '' : 'text-[#94A3B8]'}`} title={chosen?.label}>
            {chosen ? chosen.label : value || placeholder || 'Choose…'}
            {chosen?.hint && <span className="text-[#5B6478]"> · {chosen.hint}</span>}
          </span>
        )}
        {clearable && value && !open && (
          <button type="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="text-[#94A3B8] hover:text-[#B23A2E]"><X className="h-3.5 w-3.5" /></button>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5B6478]" />
      </div>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-[#DDE3EB] bg-white shadow-lg">
          {matches.map((o, i) => (
            <button
              key={o.value + i}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              onMouseEnter={() => setHi(i)}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[12.5px] text-[#16223A]"
              style={{ background: i === hi ? '#F1F4F8' : o.value === value ? '#F6F8FA' : '#fff', fontWeight: o.value === value ? 700 : 400 }}
            >
              <span className="min-w-0">{o.label}</span>
              {(o.hint || o.group) && <span className="shrink-0 text-[11px] text-[#5B6478]">{o.hint || o.group}</span>}
            </button>
          ))}
          {onCreate && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase()) && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onCreate(q.trim()); setOpen(false); setQ(''); }} className="flex w-full px-3 py-2 text-left text-[12.5px] font-bold text-[#2F6F4E]">+ Add “{q.trim()}” to the list</button>
          )}
          {!matches.length && !onCreate && <div className="px-3 py-2.5 text-[12px] text-[#5B6478]">{empty || 'Nothing matches.'}</div>}
        </div>
      )}
    </div>
  );
};
