import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { parseDate } from '../../lib/financeCalc';
import { SearchSelect } from './SearchSelect';

/**
 * The plain list-page filter bar (Bukku style): date from / to, a search box and a client picker.
 * `match` tells whether a row passes; `bar` is the bar to put above the list.
 */
export function useListFilter(opts: { who?: string[]; whoLabel?: string; placeholder?: string } = {}) {
  const [f, setF] = useState({ from: '', to: '', q: '', who: '' });
  const active = !!(f.from || f.to || f.q.trim() || f.who);
  const whoOpts = useMemo(() => [...new Set((opts.who || []).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })), [opts.who]);

  const match = (row: { date?: string; text?: (string | undefined)[]; who?: string }) => {
    if (f.from || f.to) {
      const t = parseDate(row.date);
      if (!t) return false;
      if (f.from && t < new Date(f.from + 'T00:00:00').getTime()) return false;
      if (f.to && t > new Date(f.to + 'T23:59:59').getTime()) return false;
    }
    if (f.who && (row.who || '').trim().toLowerCase() !== f.who.toLowerCase()) return false;
    const q = f.q.trim().toLowerCase();
    if (q && !(row.text || []).some((x) => String(x || '').toLowerCase().includes(q))) return false;
    return true;
  };

  const inp = 'rounded-md border border-[#DDE3EB] bg-white px-2 py-1 text-[11px] text-[#16223A]';
  const bar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1F5] bg-[#FBFCFD] px-3.5 py-2">
      <label className="flex items-center gap-1 text-[10.5px] font-semibold text-[#5B6478]">From<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inp} /></label>
      <label className="flex items-center gap-1 text-[10.5px] font-semibold text-[#5B6478]">To<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inp} /></label>
      {whoOpts.length > 0 && (
        <SearchSelect aria-label={opts.whoLabel || 'Client'} value={f.who} onChange={(v) => setF({ ...f, who: v })} clearable placeholder={'All ' + (opts.whoLabel || 'clients').toLowerCase()} options={whoOpts} style={{ width: 210 }} />
      )}
      <label className="relative min-w-[180px] flex-1">
        <Search className="absolute left-2 top-[7px] h-3 w-3 text-[#94A3B8]" />
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={opts.placeholder || 'Search no., client, file ref…'} className={inp + ' w-full pl-6'} />
      </label>
      {active && (
        <button type="button" onClick={() => setF({ from: '', to: '', q: '', who: '' })} className="flex items-center gap-1 text-[10.5px] font-bold text-[#B23A2E]">
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
  return { match, bar, active };
}
