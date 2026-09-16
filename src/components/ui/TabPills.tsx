import React from 'react';
import { palette } from '../../lib/designTokens';

export interface TabPillItem {
  id: string;
  label: React.ReactNode;
}

interface TabPillsProps {
  items: TabPillItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/** The `.rd-tab` / `.rd-tab.active` pill-tab pattern (Accounting tabs, Billing tabs, Matter Workspace tabs). */
export const TabPills: React.FC<TabPillsProps> = ({ items, activeId, onSelect, className = '' }) => (
  <div className={`flex flex-wrap gap-2 ${className}`}>
    {items.map((item) => {
      const active = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors"
          style={
            active
              ? { backgroundColor: palette.navy, color: '#fff', border: `1px solid ${palette.navy}` }
              : { backgroundColor: '#fff', color: palette.slate, border: `1px solid ${palette.border}` }
          }
        >
          {item.label}
        </button>
      );
    })}
  </div>
);

export default TabPills;
