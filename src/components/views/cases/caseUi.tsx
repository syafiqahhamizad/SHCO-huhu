/**
 * Shared building blocks for the Cases module. The design's inline styles are final, so they
 * are kept as CSS strings (same approach as Accounts & Finance) and turned into style objects
 * with css().
 */
import React from 'react';
import { css } from '../finance/financeModel';

export { css };

export const S = {
  card: 'border-radius:12px;border:1px solid #DDE3EB;background:#fff',
  head: 'display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #EEF1F5;flex-wrap:wrap',
  title: 'font-family:Georgia, serif;font-size:15px;font-weight:700;color:#16223A',
  sub: 'font-size:12px;color:#4A5468',
  label: 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468',
  input: 'width:100%;border:1px solid #C9D1DC;border-radius:8px;padding:9px 11px;font-size:13px;color:#16223A;background:#fff;font-family:inherit',
  btnPri: 'border:0;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit',
  btnPriL: 'border:0;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#16223A;color:#fff;cursor:pointer;font-family:inherit',
  btnSec: 'border:1px solid #C9D1DC;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit',
  btnSecL: 'border:1px solid #C9D1DC;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit',
  btnSm: 'border:1px solid #C9D1DC;border-radius:8px;padding:4px 9px;font-size:11.5px;font-weight:700;background:#fff;color:#16223A;cursor:pointer;font-family:inherit',
  formGrid: (min: number) => `display:grid;grid-template-columns:repeat(auto-fit,minmax(${min}px,1fr));gap:10px;padding:14px 16px;background:#F6F8FA;border-bottom:1px solid #EEF1F5`,
  th: 'gap:12px;padding:8px 16px;background:#F6F8FA;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#4A5468',
  row: 'gap:12px;padding:10px 16px;border-top:1px solid #F0F2F5;font-size:12.5px',
  empty: 'padding:20px 16px;font-size:12.5px;color:#4A5468;text-align:center',
};

export const Card: React.FC<{ children: React.ReactNode; style?: string; className?: string }> = ({ children, style = '', className }) => (
  <div className={className} style={css(S.card + (style ? ';' + style : ''))}>{children}</div>
);

export const CardHead: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }> = ({ title, sub, children }) => (
  <div style={css(S.head)}>
    <strong style={css('font-family:Georgia, serif;font-size:15px;color:#16223A')}>{title}</strong>
    {sub != null && <span style={css(S.sub)}>{sub}</span>}
    {children}
  </div>
);

export const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode; span?: string }> = ({ label, children, span }) => (
  <label style={css('display:flex;flex-direction:column;gap:5px' + (span ? ';grid-column:' + span : ''))}>
    <span style={css(S.label)}>{label}</span>
    {children}
  </label>
);

export const Pill: React.FC<{ tone: { bg: string; fg: string }; children: React.ReactNode; style?: string }> = ({ tone, children, style = '' }) => (
  <span style={css(`padding:2px 9px;border-radius:10px;font-size:11.5px;font-weight:700;background:${tone.bg};color:${tone.fg};white-space:nowrap${style ? ';' + style : ''}`)}>{children}</span>
);

export const boxStyle = (on: boolean, size = 18) =>
  css(`width:${size}px;height:${size}px;flex-shrink:0;border-radius:4px;padding:0;display:grid;place-items:center;font-size:11px;font-weight:800;cursor:pointer;background:${on ? '#16223A' : '#fff'};color:#fff;border:1px solid ${on ? '#16223A' : '#C9D1DC'}`);

export const Toggle: React.FC<{ on: boolean; onClick?: () => void; disabled?: boolean; children?: React.ReactNode; title?: string }> = ({ on, onClick, disabled, children, title }) => (
  <button type="button" title={title} onClick={disabled ? undefined : onClick} disabled={disabled} style={css(`display:flex;align-items:center;gap:7px;border:0;background:none;padding:0;font-size:12px;font-weight:700;color:${disabled ? '#94A3B8' : '#16223A'};cursor:${disabled ? 'not-allowed' : 'pointer'};font-family:inherit`)}>
    <span style={css(`width:30px;height:17px;flex-shrink:0;border-radius:9px;background:${on && !disabled ? '#1F5A3B' : '#C9D1DC'};display:flex;align-items:center;padding:2px;justify-content:${on && !disabled ? 'flex-end' : 'flex-start'}`)}><span style={css('width:13px;height:13px;border-radius:50%;background:#fff')} /></span>
    {children}
  </button>
);

export const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; width?: number; top?: boolean; z?: number }> = ({ children, onClose, width = 480, top, z = 50 }) => (
  <div
    onClick={onClose}
    onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    style={css(`position:fixed;inset:0;background:rgba(22,34,58,.45);z-index:${z};display:flex;justify-content:center;align-items:${top ? 'flex-start' : 'center'};padding:${top ? '48px 16px' : '20px'};overflow:auto`)}
  >
    <div onClick={(e) => e.stopPropagation()} style={css(`width:100%;max-width:${width}px;max-height:${top ? 'none' : 'calc(100vh - 40px)'};display:flex;flex-direction:column;border-radius:12px;background:#fff;box-shadow:0 18px 40px rgba(0,0,0,.25)`)}>
      {children}
    </div>
  </div>
);

export const ModalHead: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; onClose?: () => void; color?: string }> = ({ title, sub, onClose, color = '#16223A' }) => (
  <div style={css('padding:16px 20px;border-bottom:1px solid #EEF1F5;display:flex;align-items:flex-start;gap:10px')}>
    <div style={css('display:flex;flex-direction:column;gap:4px;min-width:0')}>
      <strong style={css(`font-family:Georgia, serif;font-size:17px;color:${color}`)}>{title}</strong>
      {sub != null && <span style={css('font-size:12.5px;color:#4A5468;line-height:1.5')}>{sub}</span>}
    </div>
    {onClose && <button type="button" onClick={onClose} aria-label="Close" style={css('margin-left:auto;background:none;border:0;cursor:pointer;color:#4A5468;font-size:15px')}>✕</button>}
  </div>
);

export const Avatar: React.FC<{ code: string; color: string; size?: number }> = ({ code, color, size = 22 }) => (
  <span style={css(`width:${size}px;height:${size}px;flex-shrink:0;border-radius:50%;display:grid;place-items:center;font-size:${size > 22 ? 10 : 9.5}px;font-weight:700;color:#fff;background:${color}`)}>{code}</span>
);

/** Segmented control (sub-tabs, ledger tabs). */
export const Seg: React.FC<{ items: [string, string][]; value: string; onChange: (k: string) => void }> = ({ items, value, onChange }) => (
  <div style={css('display:flex;gap:4px;padding:3px;border-radius:9px;background:#F6F8FA;border:1px solid #DDE3EB')}>
    {items.map(([k, label]) => (
      <button key={k} type="button" onClick={() => onChange(k)} style={css(`border:0;border-radius:7px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:${value === k ? '#16223A' : 'transparent'};color:${value === k ? '#fff' : '#4A5468'}`)}>{label}</button>
    ))}
  </div>
);
