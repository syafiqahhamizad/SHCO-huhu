import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

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
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ASSIGNEE_COLORS[(hash + index) % ASSIGNEE_COLORS.length];
};

interface AssigneeConfirmationModalProps {
  isOpen: boolean;
  assignees: string[];
  onClose: () => void;
}

export const AssigneeConfirmationModal: React.FC<AssigneeConfirmationModalProps> = ({
  isOpen,
  assignees,
  onClose,
}) => {
  if (!isOpen || assignees.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm p-6 space-y-4 border border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base text-[#16223A]">Assignment Confirmed</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            This task will be assigned to {assignees.length} {assignees.length === 1 ? 'person' : 'people'}:
          </p>
          <div className="flex flex-wrap gap-2">
            {assignees.map((assignee, index) => (
              <span
                key={`${assignee}-${index}`}
                className={`${getColorForAssignee(assignee, index)} text-white px-3 py-1 rounded-full text-sm font-medium`}
              >
                {assignee}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs text-emerald-800">
            ✓ Each assignee will receive a notification when the task is created.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
