import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  color: string;
  /** Lighter text color for the label/note against `color`. Defaults to a translucent white. */
  onColor?: string;
  icon?: React.ElementType;
  className?: string;
}

/** The colored KPI tile repeated throughout the redesign (dashboards, accounting, billing). */
export const StatCard: React.FC<StatCardProps> = ({ label, value, note, color, onColor = 'rgba(255,255,255,0.72)', icon: Icon, className = '' }) => (
  <div className={`rounded-xl p-3.5 text-white shadow-sm ${className}`} style={{ backgroundColor: color }}>
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: onColor }}>
      {Icon && <Icon className="h-3 w-3" />}
      <span>{label}</span>
    </div>
    <div className="mt-1.5 text-2xl font-bold leading-none">{value}</div>
    {note && <div className="mt-0.5 text-[10.5px]" style={{ color: onColor }}>{note}</div>}
  </div>
);

export default StatCard;
