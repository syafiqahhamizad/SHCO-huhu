import React from 'react';
import { User, Palette, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemePreference } from '../../types';

export const MyAccountView: React.FC = () => {
  const { currentUser, currentRole, theme, setTheme } = useApp();

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-[#16223A] text-white rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Personal workspace</p>
        <h2 className="font-serif text-xl font-bold mt-1">My Account</h2>
        <p className="text-slate-300 mt-1">Manage your profile and display preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
            <User className="w-4 h-4 text-[#A9814A]" /> Profile
          </h3>
          <div className="space-y-3">
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Name</span><strong className="text-sm text-[#16223A]">{currentUser.name}</strong></div>
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Email</span><span className="text-slate-700">{currentUser.email}</span></div>
            <div><span className="text-[10px] uppercase font-bold text-slate-400 block">Role</span><span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 rounded font-bold"><ShieldCheck className="w-3.5 h-3.5" />{currentRole || currentUser.role}</span></div>
          </div>
        </section>

        <section className="bg-white border border-[#E1DCCF] rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-[#16223A] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#A9814A]" /> Appearance
          </h3>
          <label className="text-[10px] uppercase font-bold text-slate-500 block">Theme</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as ThemePreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={`px-3 py-2 rounded-lg border font-bold capitalize cursor-pointer ${theme === option ? 'bg-[#16223A] text-white border-[#16223A]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
