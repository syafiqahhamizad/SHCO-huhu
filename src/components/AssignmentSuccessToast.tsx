import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2 } from 'lucide-react';

// Color palette for assignee badges
const ASSIGNEE_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-rose-500',
];

const getColorForAssignee = (name: string, index: number): string => {
  // Use hash of name for consistent coloring
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ASSIGNEE_COLORS[(hash + index) % ASSIGNEE_COLORS.length];
};

export const AssignmentSuccessToast: React.FC = () => {
  const { assignmentToastData } = useApp();

  if (!assignmentToastData) return null;

  const { assignees, count } = assignmentToastData;

  return (
    <div className="fixed bottom-5 right-5 bg-[#16223A] text-white px-4 py-3 rounded-lg shadow-xl text-xs z-50 border border-emerald-500/50 animate-fade-in max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-semibold">Task assigned to {count} {count === 1 ? 'person' : 'people'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {assignees.map((assignee, index) => (
          <span
            key={`${assignee}-${index}`}
            className={`${getColorForAssignee(assignee, index)} text-white px-2 py-1 rounded text-[11px] font-medium inline-block`}
          >
            {assignee}
          </span>
        ))}
      </div>
    </div>
  );
};
