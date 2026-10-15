import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_LEAD_SOCIAL_PLATFORMS, getLeadSources, getPracticeSettings, whichOf } from '../../services/templateService';
import type { Client } from '../../types';

/** Social media platforms registered in Settings › Lists & sources (or the built-in list). */
export const getSocialPlatforms = () => { const l = getPracticeSettings().leadSocialPlatforms; return l && l.length ? l : DEFAULT_LEAD_SOCIAL_PLATFORMS; };

type Ctx = Pick<ReturnType<typeof useApp>, 'users' | 'programmes' | 'clients' | 'referralPartners'>;
const OTHER = '__other__';

/**
 * "Who / which" choices for a source, all from registered lists: platforms (Settings), partners and
 * staff (Users & Roles), programmes (Leads › Programmes), clients, and outside referrers
 * (Leads › Referrers). Null = no list for that source (e.g. Walk-in, Website).
 */
export const sourceDetailOptions = (source: string | undefined, ctx: Ctx): { label: string; options: string[] } | null => {
  if (!source) return null;
  const def = getLeadSources().find((x) => x.key === source);
  const firm = (ctx.users || []).filter((u) => u.role !== 'Client' && u.status !== 'Inactive');
  switch (whichOf(def || { key: source })) {
    case 'platforms': return { label: 'Which platform', options: getSocialPlatforms().map((p) => p.label) };
    case 'partners': return { label: 'Which partner', options: firm.filter((u) => u.role === 'Partner').map((u) => u.name) };
    case 'staff': return { label: 'Which staff member', options: firm.filter((u) => u.role !== 'Partner').map((u) => u.name) };
    case 'programmes': return { label: 'Which programme', options: (ctx.programmes || []).map((p) => p.title) };
    case 'clients': return { label: 'Which client', options: (ctx.clients || []).map((c) => c.name).sort() };
    case 'referrers': return { label: 'Which referrer', options: (ctx.referralPartners || []).map((r) => r.name) };
    case 'own': return { label: 'Which', options: (def?.options || []).filter(Boolean) };
    default: return null;
  }
};

/**
 * Source · Who / which — the same two fields on Register new client and the
 * client profile. Every choice comes from a registered list; "Other…" allows a one-off name.
 */
export const SourceFields: React.FC<{
  value: Pick<Client, 'source' | 'sourceDetail'>;
  onChange: (patch: Pick<Client, 'source' | 'sourceDetail'>) => void;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
}> = ({ value, onChange, labelStyle, inputStyle }) => {
  const app = useApp();
  const opts = sourceDetailOptions(value.source, app);
  const known = !!opts && (!value.sourceDetail || opts.options.includes(value.sourceDetail));
  const [typing, setTyping] = useState(!!value.sourceDetail && !known);
  const [draft, setDraft] = useState(value.sourceDetail || '');
  const field = (label: string, el: React.ReactNode) => <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><span style={labelStyle}>{label}</span>{el}</label>;
  return (
    <>
      {field('Source', (
        <select value={value.source || ''} onChange={(e) => { setTyping(false); setDraft(''); onChange({ source: e.target.value || undefined, sourceDetail: undefined }); }} style={inputStyle}>
          <option value="">—</option>
          {getLeadSources().map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          {value.source && !getLeadSources().some((x) => x.key === value.source) && <option value={value.source}>{value.source}</option>}
        </select>
      ))}
      {field(opts ? opts.label : 'Who / which', opts && !typing ? (
        <select value={value.sourceDetail || ''} onChange={(e) => { if (e.target.value === OTHER) { setTyping(true); setDraft(''); return; } onChange({ sourceDetail: e.target.value || undefined }); }} style={inputStyle}>
          <option value="">—</option>
          {opts.options.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other… (type a name)</option>
        </select>
      ) : (
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { const t = draft.trim(); if (t !== (value.sourceDetail || '')) onChange({ sourceDetail: t || undefined }); }} placeholder={opts ? 'Type the name' : 'e.g. found us on Google'} style={inputStyle} />
      ))}
    </>
  );
};
