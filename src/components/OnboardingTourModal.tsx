import React, { useState } from 'react';
import {
  Scale,
  Briefcase,
  Calendar,
  Layers,
  History,
  Trash2,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOUR_STEPS = [
  {
    icon: Scale,
    title: 'Welcome to Messrs. Syafiqah Hamizad & Co.',
    subtitle: 'Enterprise Practice Management & Client Portal',
    description:
      'This platform is customized specifically for Malaysian legal practice compliance (BAR Council, SAR 1990 & 256-Bit SSL Encryption). Explore key features below to get started.',
    color: 'from-amber-500/20 to-amber-700/10 border-amber-500/40 text-amber-400',
  },
  {
    icon: Briefcase,
    title: 'Cases & Matter Management',
    subtitle: 'Practice Area Tags & File Registry',
    description:
      'Manage litigation, conveyancing, corporate, and criminal matters. Register new files with auto-generated reference numbers, practice area tags, and client affiliations.',
    color: 'from-blue-500/20 to-blue-700/10 border-blue-500/40 text-blue-400',
  },
  {
    icon: Calendar,
    title: 'Court Diary & Cause List',
    subtitle: 'Hearings, Coram & Mention Dates',
    description:
      'Track upcoming court dates, assigned High/Sessions Court Judges (Coram), courtrooms, and procedural action items directly synced across firm calendars.',
    color: 'from-purple-500/20 to-purple-700/10 border-purple-500/40 text-purple-400',
  },
  {
    icon: Layers,
    title: 'Dynamic Practice Settings & Tagging',
    subtitle: 'Custom Practice Categories & Summary Dashboard',
    description:
      'Define custom practice area categories in Settings. Monitor total file counts, active matters, and practice metrics via the summary dashboard.',
    color: 'from-emerald-500/20 to-emerald-700/10 border-emerald-500/40 text-emerald-400',
  },
  {
    icon: History,
    title: 'Global Database Audit Trail',
    subtitle: 'Full Collection Activity History',
    description:
      'Every creation, update, deletion, and restoration is recorded in the immutable Audit Log. Access case history directly inside matter sub-tabs.',
    color: 'from-amber-500/20 to-amber-700/10 border-amber-500/40 text-amber-400',
  },
  {
    icon: Trash2,
    title: 'Recycle Bin & Data Recovery',
    subtitle: 'Accidental Deletion Protection',
    description:
      'Deleted records are safely backed up in the firm Recycle Bin. Authorized Partners can inspect deleted data and restore records back into live tables with one click.',
    color: 'from-rose-500/20 to-rose-700/10 border-rose-500/40 text-rose-400',
  },
];

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#16223A] border border-[#A9814A]/40 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-serif font-bold text-white tracking-wide uppercase">
              Interactive Firm System Tour
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Step Progress Dots */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Step {currentStep + 1} of {TOUR_STEPS.length}</span>
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStep
                      ? 'w-6 bg-[#A9814A]'
                      : 'w-2 bg-slate-700 hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Icon Header Box */}
          <div className={`p-4 rounded-xl bg-gradient-to-br ${step.color} border flex items-center gap-4`}>
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10 shrink-0">
              <StepIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-serif">{step.title}</h3>
              <p className="text-xs font-medium text-slate-300">{step.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-sans">
            {step.description}
          </p>

          {/* Quick Tip Box */}
          <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You can re-launch this tour anytime from the System Help &amp; Support menu in the top bar.</span>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              currentStep === 0
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Skip Tour
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            >
              <span>{isLast ? 'Complete Tour' : 'Next Step'}</span>
              {isLast ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
