import React from 'react';

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  showValue?: boolean;
  formatValue?: (v: number) => string;
}

/** Flex/height-div bar chart for aging buckets and monthly series — matches the mockup's plain CSS bars. */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, height = 70, showValue = false, formatValue = (v) => String(v) }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
          {showValue && d.value > 0 && <span className="mb-0.5 text-[9px] font-semibold text-[#5B6478]">{formatValue(d.value)}</span>}
          <div
            className="w-full rounded-t-sm"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: d.color }}
            title={`${d.label}: ${formatValue(d.value)}`}
          />
          <span className="mt-1 text-[9px] text-[#5B6478]">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export default MiniBarChart;
