import React, { useEffect, useRef, useState } from 'react';
import { css } from '../finance/financeModel';
import { getPracticeSettings, savePracticeSettings, type PracticeSettings } from '../../../services/templateService';

export { css };

/** Shared inline styles copied verbatim from firm-settings.dc.html. */
export const S = {
  card: 'overflow:hidden;border-radius:12px;border:1px solid #DDE3EB;background:#fff',
  h: 'font-family:ui-serif, Georgia, serif;font-size:14.5px;color:#16223A',
  sub: 'font-size:10.5px;color:#5B6478',
  foot: 'padding:9px 14px;background:#F6F8FA;font-size:10.5px;line-height:1.5;color:#5B6478',
  input: 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 7px;font-size:11px;color:#16223A',
  remove: 'border:1px solid #DDE3EB;border-radius:6px;padding:4px 6px;font-size:10px;font-weight:700;background:#fff;color:#B23A2E;cursor:pointer;font-family:inherit',
  addLink: 'border:0;background:none;font-size:11px;font-weight:700;color:#8A6D3B;cursor:pointer;font-family:inherit',
  tag: 'padding:2px 7px;border-radius:5px;background:#16223A;color:#E9C46A;font-family:ui-monospace, monospace;font-size:10.5px;font-weight:700',
  darkBtn: 'border:0;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit',
  lightBtn: 'border:1px solid #DDE3EB;border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit',
  fieldLabel: 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5B6478',
};

/** Live Firm & Practice Settings (re-reads on every save / cloud update). */
export const usePracticeSettings = (): [PracticeSettings, (patch: Partial<PracticeSettings>) => void] => {
  const [settings, setSettings] = useState<PracticeSettings>(() => getPracticeSettings());
  useEffect(() => {
    const on = () => setSettings(getPracticeSettings());
    window.addEventListener('shco-practice-settings-updated', on);
    return () => window.removeEventListener('shco-practice-settings-updated', on);
  }, []);
  const save = (patch: Partial<PracticeSettings>) => {
    const next = { ...getPracticeSettings(), ...patch };
    savePracticeSettings(next);
    setSettings(next);
  };
  return [settings, save];
};

/** Everything each tab needs from the shell. */
export interface SettingsCtx {
  settings: PracticeSettings;
  /** Save a settings patch and write one Activity Log line. */
  save: (patch: Partial<PracticeSettings>, action: string, details: string) => void;
  msg: (m: string) => void;
  log: (action: string, details: string) => void;
  isSuperAdmin: boolean;
  go: (tab: string, extra?: { who?: string }) => void;
  who: string;
  setWho: (id: string) => void;
}

type TxtProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'style'> & {
  value: string;
  onCommit: (v: string) => void;
  style: string;
  /** Transform while typing (e.g. upper-case). */
  map?: (v: string) => string;
};

/** Text input that keeps a local draft and saves once on blur / Enter (one log line per change). */
export const Txt = ({ value, onCommit, style, map, ...rest }: TxtProps) => {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  const commit = () => { focused.current = false; if (draft !== value) onCommit(draft); };
  return (
    <input
      {...rest}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setDraft(map ? map(e.target.value) : e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(value); focused.current = false; } }}
      style={css(withBg(style))}
    />
  );
};

/** The app's global CSS greys every input; the design's inputs are white unless they say otherwise. */
const withBg = (style: string) => (/background/.test(style) ? style : style + ';background:#fff');

/** Textarea twin of Txt. */
export const Area = ({ value, onCommit, style, rows }: { value: string; onCommit: (v: string) => void; style: string; rows?: number }) => {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <textarea
      value={draft}
      rows={rows}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { focused.current = false; if (draft !== value) onCommit(draft); }}
      style={css(withBg(style))}
    />
  );
};


/**
 * Left menu + one section at a time (the Lists & sources layout), so a settings tab never
 * turns into one long scroll. items: [label, optional count]. The section is remembered per tab.
 */
export const SideMenu = ({ items, value, onPick, children }: { items: [string, (string | number)?][]; value: string; onPick: (k: string) => void; children: React.ReactNode }) => (
  <div style={css('display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;align-items:start')}>
    <div style={css(S.card + ';padding:6px;position:sticky;top:12px')}>
      {items.map(([t, n]) => { const on = value === t; return <button key={t} type="button" onClick={() => onPick(t)} style={css(`display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;border:0;border-radius:6px;padding:8px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;text-align:left;background:${on ? '#16223A' : 'transparent'};color:${on ? '#fff' : '#16223A'}`)}><span>{t}</span>{n != null && n !== '' && <span style={css(`font-size:10px;font-weight:700;color:${on ? '#C9D3E0' : '#94A3B8'}`)}>{n}</span>}</button>; })}
    </div>
    <div style={css('min-width:0;display:flex;flex-direction:column;gap:16px')}>{children}</div>
  </div>
);
