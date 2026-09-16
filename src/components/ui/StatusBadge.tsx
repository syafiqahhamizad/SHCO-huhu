import React from 'react';
import { palette, tint, tintText } from '../../lib/designTokens';

type Tone = 'green' | 'blue' | 'gold' | 'red' | 'purple' | 'slate';

const TONE_MAP: Record<Tone, { bg: string; text: string }> = {
  green: { bg: tint.green, text: tintText.green },
  blue: { bg: tint.blue, text: tintText.blue },
  gold: { bg: tint.gold, text: tintText.gold },
  red: { bg: tint.red, text: tintText.red },
  purple: { bg: tint.purple, text: tintText.purple },
  slate: { bg: '#F0F2F5', text: palette.slate },
};

interface StatusBadgeProps {
  label: string;
  tone: Tone;
  className?: string;
}

/** Pill badge, e.g. Active/Overdue/Paid/Pending — semantic color from the mockup's palette. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone, className = '' }) => {
  const { bg, text } = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
