import React, { useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, X } from 'lucide-react';

export interface ConfirmationDetails {
  label: string;
  value: string;
  badge?: string;
}

export interface ConfirmationOptions {
  title: string;
  message: string;
  details?: ConfirmationDetails[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmationOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setOptions(null);
  }, []);

  const ConfirmationModal = options ? (
    <div
      className="fixed inset-0 bg-[#16223A]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E1DCCF] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                options.variant === 'warning'
                  ? 'bg-amber-100 text-amber-800'
                  : options.variant === 'info'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {options.variant === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              ) : options.variant === 'info' ? (
                <ShieldAlert className="w-5 h-5 text-blue-700" />
              ) : (
                <Trash2 className="w-5 h-5 text-rose-700" />
              )}
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#16223A]">{options.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{options.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {options.details && options.details.length > 0 && (
          <div className="p-3 bg-[#FAF8F2] border border-[#E1DCCF] rounded-lg space-y-2 text-xs">
            {options.details.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="font-bold text-slate-600">{item.label}:</span>
                <span className="font-medium text-[#16223A] text-right font-mono truncate max-w-[220px]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
              options.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700'
                : options.variant === 'info'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-rose-700 hover:bg-rose-800'
            }`}
          >
            {options.variant === 'danger' && <Trash2 className="w-3.5 h-3.5 text-rose-200" />}
            <span>{options.confirmText || 'Confirm Action'}</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmationModal };
}
