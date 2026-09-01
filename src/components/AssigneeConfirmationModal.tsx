import React, { useEffect } from 'react';
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
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || assignees.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm p-6 space-y-4 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        role="alertdialog"
        aria-labelledby="assignee-modal-title"
        aria-describedby="assignee-modal-description"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />
            <h3 id="assignee-modal-title" className="font-bold text-base text-[#16223A]">
              Assignment Confirmed
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md p-1"
            aria-label="Close confirmation modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p id="assignee-modal-description" className="text-sm text-slate-600">
            This task will be assigned to {assignees.length} {assignees.length === 1 ? 'person' : 'people'}:
          </p>
          <div className="flex flex-wrap gap-2">
            {assignees.map((assignee, index) => (
              <span
                key={`${assignee}-${index}`}
                className={`${getColorForAssignee(assignee, index)} text-white px-3 py-1 rounded-full text-sm font-medium`}
                role="status"
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
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700"
          aria-label="Close confirmation and continue"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
