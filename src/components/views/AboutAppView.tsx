import React from 'react';
import { Info, ShieldCheck, Cloud, Scale } from 'lucide-react';

export const AboutAppView: React.FC = () => (
  <div className="space-y-5 text-xs">
    <div className="bg-[#16223A] text-white rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">System information</p>
      <h2 className="font-serif text-xl font-bold mt-1">About SHCO Practice System</h2>
      <p className="text-slate-300 mt-1">Practice management workspace for legal matters, finance, compliance, and client communication.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs"><Info className="w-5 h-5 text-[#A9814A] mb-3" /><h3 className="font-bold text-[#16223A]">Application</h3><p className="text-slate-600 mt-1">Version 1.0.0</p><p className="text-slate-500 mt-1">SHCO Legal Practice Management System</p></div>
      <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs"><ShieldCheck className="w-5 h-5 text-emerald-700 mb-3" /><h3 className="font-bold text-[#16223A]">Compliance</h3><p className="text-slate-600 mt-1">Designed for Malaysian legal practice workflows and Solicitors’ Accounts Rules processes.</p></div>
      <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs"><Cloud className="w-5 h-5 text-blue-700 mb-3" /><h3 className="font-bold text-[#16223A]">Data</h3><p className="text-slate-600 mt-1">Records use the configured firm cloud sync with local browser fallback.</p></div>
    </div>
    <div className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs"><h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2"><Scale className="w-4 h-4 text-[#A9814A]" /> Core workspace areas</h3><p className="text-slate-600 mt-2">Matter management, task workflows, document registers, billing, trust accounting, deadlines, user access, audit history, and client portal updates.</p></div>
  </div>
);
