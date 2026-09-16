/**
 * Shared palette for the SHCO portal redesign (dashboards, accounting, billing,
 * matter workspace). Source of truth: design/shco-portal-redesign README's
 * "Design tokens" section. Import instead of re-declaring a local TONE object.
 */
export const palette = {
  navy: '#16223A',
  blue: '#3D6B9C',
  green: '#2F6F4E',
  gold: '#8A6D3B',
  red: '#B23A2E',
  purple: '#6B3D8C',
  slate: '#5B6478',
  border: '#DDE3EB',
  card: '#FFFFFF',
  page: '#F6F8FA',
} as const;

export const tint = {
  green: '#E6EFE9',
  blue: '#E7EEF6',
  gold: '#FBF2E9',
  red: '#FBEDE9',
  purple: '#F1EBF6',
} as const;

/** Text color to pair with each tint (matches the mockup's "* text" convention, e.g. #2F5680 on the blue tint). */
export const tintText = {
  green: '#2F6F4E',
  blue: '#2F5680',
  gold: '#8A6534',
  red: '#B23A2E',
  purple: '#6B3D8C',
} as const;

export const radius = {
  card: '12px',
  pill: '20px',
} as const;

/** Apply as style={{ fontFamily: serifFont }} — Tailwind's own `font-serif` utility does NOT map to this. */
export const serifFont = "'Source Serif 4', Georgia, Cambria, 'Times New Roman', serif";

export type SemanticColor = keyof typeof tint;
