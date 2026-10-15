import React from 'react';

/** Tidy a typed amount to 2 decimals ("35" → "35.00"); leaves blanks and non-numbers as they are. */
export const money2 = (v: string, allowNegative = false) => {
  const t = String(v ?? '').replace(/,/g, '').trim();
  if (!t || t === '-') return t;
  const n = Number(t);
  return Number.isFinite(n) && (allowNegative || n >= 0) ? n.toFixed(2) : t;
};

/**
 * An amount box (RM): numbers only, right-aligned, shown as 0.00 when you leave it.
 * Keeps the look of the form it sits in (pass that form's style).
 */
export const MoneyInput: React.FC<{
  value: string | number | undefined;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
  autoFocus?: boolean;
  'aria-label'?: string;
}> = ({ value, onChange, style, className, placeholder, allowNegative, autoFocus, ...rest }) => (
  <input
    inputMode="decimal"
    autoFocus={autoFocus}
    aria-label={rest['aria-label']}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, ''))}
    onBlur={(e) => { const t = money2(e.target.value, allowNegative); if (t !== e.target.value) onChange(t); }}
    placeholder={placeholder ?? '0.00'}
    className={className}
    style={{ textAlign: 'right', ...style }}
  />
);
