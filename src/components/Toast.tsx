import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage } = useApp();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!toastMessage || !isVisible) return null;

  return (
    <div
      className="fixed bottom-5 right-5 bg-[#16223A] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 z-50 border border-amber-600/30 animate-fade-in transition-opacity duration-300"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
      <span>{toastMessage}</span>
    </div>
  );
};
