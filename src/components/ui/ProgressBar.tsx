import React from 'react';

interface ProgressBarProps {
  label: string;
  valueLabel: React.ReactNode;
  pct: number;
  color: string;
  trackColor?: string;
  barHeight?: number;
}

/** Label + "value / target" row + colored fill bar — used in targets panels and per-partner KPI tables. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ label, valueLabel, pct, color, trackColor = '#F0F2F5', barHeight = 8 }) => (
  <div>
    <div className="flex items-center justify-between text-[12px] text-[#16223A]">
      <span>{label}</span>
      <span className="flex items-center gap-1">{valueLabel}</span>
    </div>
    <div className="mt-1 rounded" style={{ backgroundColor: trackColor, height: barHeight }}>
      <div className="rounded" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color, height: barHeight }} />
    </div>
  </div>
);

export default ProgressBar;
