import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Lock,
  LogIn,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Building2,
  Users,
  ArrowRight,
  UserPlus,
  HelpCircle,
  Scale,
  Mail,
  RefreshCcw,
  Check,
  ChevronRight,
  Briefcase,
  Layers,
} from 'lucide-react';

export const SignInPortal: React.FC = () => {
  const {
    loginWithGoogleSSO,
    loginClientPassword,
    loginExternalUser,
  } = useApp();

  const [portalMode, setPortalMode] = useState<'staff' | 'client' | 'external'>('staff');

  // Staff SSO state
  const [staffError, setStaffError] = useState<string | null>(null);

  // Client form state
  const [clientIdentifier, setClientIdentifier] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalPassword, setExternalPassword] = useState('');
  const [externalError, setExternalError] = useState<string | null>(null);

  // Submit Handlers
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    const res = await loginWithGoogleSSO();
    if (!res.success && res.error) {
      setStaffError(res.error);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    if (!clientIdentifier) {
      setClientError('Please enter your registered Email address or Client ID.');
      return;
    }
    const res = await loginClientPassword(clientIdentifier, clientPassword);
    if (!res.success && res.error) {
      setClientError(res.error);
    }
  };

  const handleExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExternalError(null);
    const res = await loginExternalUser(externalEmail, externalPassword);
    if (!res.success && res.error) setExternalError(res.error);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-[radial-gradient(circle_at_8%_12%,rgba(169,129,74,0.13),transparent_26%),radial-gradient(circle_at_92%_84%,rgba(22,34,58,0.08),transparent_30%)] flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans text-[#16223A] antialiased selection:bg-[#A9814A] selection:text-white">
      {/* Top Header Branding */}
      <header className="max-w-6xl w-full mx-auto bg-[#161d30] text-white p-4 sm:p-5 rounded-2xl border border-[#ffd29e]/30 flex items-center justify-between shadow-xl shadow-black/20 mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#ffd29e]/15 border border-[#ffd29e]/60 flex items-center justify-center shadow-inner">
            <Scale className="w-5 h-5 text-[#ffd29e]" />
          </div>
          <div>
            <div className="font-roxborough font-bold text-lg sm:text-2xl text-white tracking-[0.08em] uppercase flex items-center gap-2">
              <span>SYAFIQAH HAMIZAD &amp; CO</span>
            </div>
            <p className="font-termes text-xs sm:text-[13px] text-[#ffd29e] tracking-[0.04em] mt-0.5 font-medium italic">
              Advocates &amp; Solicitors | Syarie Counsel
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-200 font-mono bg-[#0D1526] px-3.5 py-1.5 rounded-lg border border-white/10">
          <ShieldCheck className="w-4 h-4 text-[#ffd29e]" />
          <span>FIRM PRACTICE PORTAL</span>
        </div>
      </header>

      {/* Main Sign-In Card Container */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Firm Value Statement & Security Status */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6 py-2 lg:pr-10">
            <div className="space-y-4">
              <h1 className="font-serif font-bold text-4xl md:text-5xl text-[#16223A] leading-[1.02] max-w-lg">
                Precision for every matter.
              </h1>

              <p className="text-sm text-[#5B6478] leading-relaxed max-w-md border-l border-[#A9814A]/60 pl-4">
                A considered workspace for the firm&apos;s matters, clients, court obligations, and financial stewardship.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3 pt-2">
              <div className="p-4 bg-white border border-[#D8DEE8] rounded-xl flex items-start gap-3 shadow-sm">
                <div className="p-2 bg-[#E9E9DF] border border-[#C8CEB7] text-[#5C674B] rounded-lg shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#16223A]">Staff Practice System</h4>
                  <p className="text-[11px] text-[#6D7484] leading-normal mt-0.5">
                    Role-aware access for Partners, Lawyers, Assistants, and Reviewers.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white border border-[#D8DEE8] rounded-xl flex items-start gap-3 shadow-sm">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#16223A]">Dedicated Client Portal</h4>
                  <p className="text-[11px] text-[#6D7484] leading-normal mt-0.5">
                    Clients see only the authorized matters, documents, statements, and updates.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#7B8290] pt-2 border-t border-[#D8DEE8] flex items-center justify-between">
              <span>Current session security: active</span>
              <span className="font-mono text-slate-400">System V1.0.4</span>
            </div>
          </div>

          {/* Right Column: Interactive Login Portal */}
          <div className="lg:col-span-7 bg-[#16223A] text-slate-100 border border-[#A9814A]/55 rounded-3xl p-6 md:p-8 shadow-2xl shadow-[#16223A]/30 relative overflow-hidden flex flex-col justify-between">
            {/* Background Glow Accent */}
            <div className="absolute -top-28 -right-28 w-56 h-56 bg-[#A9814A]/12 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="relative flex items-center justify-between mb-5 pb-4 border-b border-white/10">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37]">Secure sign-in</div>
                  <div className="font-serif text-xl font-bold text-white mt-1">Welcome back</div>
                </div>
                <Lock className="w-5 h-5 text-[#A9814A]" />
              </div>

              {/* Access Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#0D1526] rounded-xl border border-white/10 mb-6 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('staff');
                    setStaffError(null);
                  }}
                  className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    portalMode === 'staff'
                      ? 'bg-[#A9814A] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                  <span>Staff SSO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('client');
                    setClientError(null);
                  }}
                  className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    portalMode === 'client'
                      ? 'bg-[#A9814A] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                  <span>Client Access</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('external');
                    setExternalError(null);
                  }}
                  className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    portalMode === 'external'
                      ? 'bg-[#A9814A] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                  <span>External Access</span>
                </button>

              </div>

              {/* STAFF LOGIN TAB */}
              {portalMode === 'staff' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-3 bg-[#343226] border border-[#A9814A]/30 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#A9814A]" />
                      <span>Firm Staff SSO Security Policy</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Firm Portal SSO is <strong>strictly restricted to @shcolaw.com</strong> Google Workspace accounts. Unregistered external domains will be denied.
                    </p>
                  </div>

                  {staffError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{staffError}</span>
                    </div>
                  )}

                  <form onSubmit={handleStaffSubmit} className="space-y-4 text-xs">
                    <button
                      type="submit"
                      className="w-full py-3 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Continue with Google Workspace</span>
                    </button>
                  </form>
                </div>
              )}

              {/* CLIENT LOGIN TAB */}
              {portalMode === 'client' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <span>Client Access Portal Authorization</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Clients enter registered Email address or Client ID along with your secure password to access authorized matter files and fee disclosures.
                    </p>
                  </div>

                  {clientError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{clientError}</span>
                    </div>
                  )}

                  <form onSubmit={handleClientSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5">
                        Registered Client Email or Client ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={clientIdentifier}
                        onChange={(e) => setClientIdentifier(e.target.value)}
                        placeholder="e.g. syakirah@example.com or HQ-C001"
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-[#A9814A] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5">Client Account Password *</label>
                      <input
                        type="password"
                        required
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-[#A9814A] outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Sign In to Client Portal</span>
                    </button>
                  </form>
                </div>
              )}

              {portalMode === 'external' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-3 bg-[#343226] border border-[#A9814A]/30 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-[#D4AF37] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#A9814A]" />
                      <span>Approved External Access</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      For approved reviewers and freelancers. Access is limited by the role and matters assigned by the firm administrator.
                    </p>
                  </div>

                  {externalError && (
                    <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{externalError}</span>
                    </div>
                  )}

                  <form onSubmit={handleExternalSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5">Approved External Email *</label>
                      <input
                        type="email"
                        required
                        value={externalEmail}
                        onChange={(e) => setExternalEmail(e.target.value)}
                        placeholder="reviewer@example.com"
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-[#A9814A] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5">Account Password *</label>
                      <input
                        type="password"
                        required
                        value={externalPassword}
                        onChange={(e) => setExternalPassword(e.target.value)}
                        placeholder="Enter your account password"
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-[#A9814A] outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <Users className="w-4 h-4" />
                      <span>Sign In as External User</span>
                    </button>
                  </form>
                </div>
              )}

            </div>

            {/* Bottom Help Footer */}
            <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-[#A9814A]" />
                <span>Need assistance? Contact firm admin</span>
              </span>
              <span className="font-mono text-slate-400">syafiqahhamizad@shcolaw.com</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="max-w-6xl w-full mx-auto text-center pt-6 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div>
          © {new Date().getFullYear()} Syafiqah Hamizad &amp; Co, Advocates &amp; Solicitors, Peguam Syarie. All Rights Reserved.
        </div>
        <div className="text-[10px] text-slate-400">
          Strictly Confidential Legal Management Software • Governed under Legal Profession Act 1976 &amp; SAR 1990 Rules
        </div>
      </footer>
    </div>
  );
};
