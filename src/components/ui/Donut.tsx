import React from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
  emptyColor?: string;
}

/** conic-gradient ring with a center label — the decorative donut used across every dashboard/accounting screen. */
export const Donut: React.FC<DonutProps> = ({ segments, size = 110, thickness = 18, centerLabel, centerSub, emptyColor = '#F0F2F5' }) => {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let cursor = 0;
  const stops: string[] = [];
  if (total <= 0) {
    stops.push(`${emptyColor} 0% 100%`);
  } else {
    segments.forEach((s) => {
      const from = (cursor / total) * 100;
      cursor += Math.max(0, s.value);
      const to = (cursor / total) * 100;
      if (to > from) stops.push(`${s.color} ${from}% ${to}%`);
    });
    if (cursor < total) stops.push(`${emptyColor} ${(cursor / total) * 100}% 100%`);
  }

  return (
    <div className="inline-flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${stops.join(', ')})` }}
      >
        <div
          className="flex flex-col items-center justify-center rounded-full bg-white"
          style={{ width: size - thickness * 2, height: size - thickness * 2 }}
        >
          {centerLabel !== undefined && <span className="text-[13px] font-bold text-[#16223A]">{centerLabel}</span>}
          {centerSub !== undefined && <span className="text-[9px] text-[#5B6478]">{centerSub}</span>}
        </div>
      </div>
    </div>
  );
};

export default Donut;
