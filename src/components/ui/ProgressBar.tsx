import React from 'react';

interface ProgressBarProps {
  label: string;
  valueLabel: React.ReactNode;
  pct: number;
  color: string;
  trackColor?: string;
}

/** Label + "value / target" row + colored fill bar — used in targets panels and per-partner KPI tables. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ label, valueLabel, pct, color, trackColor = '#F0F2F5' }) => (
  <div>
    <div className="flex items-center justify-between text-[12px] text-[#16223A]">
      <span>{label}</span>
      <span className="flex items-center gap-1">{valueLabel}</span>
    </div>
    <div className="mt-1 h-2 rounded" style={{ backgroundColor: trackColor }}>
      <div className="h-2 rounded" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }} />
    </div>
  </div>
);

export default ProgressBar;
