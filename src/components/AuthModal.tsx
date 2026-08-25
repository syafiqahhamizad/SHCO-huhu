import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, LogIn, AlertCircle, CheckCircle2, User, KeyRound, Building2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogleSSO, loginClientPassword, resetClientPassword, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'sso' | 'client'>('sso');

  // SSO state
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoError, setSsoError] = useState<string | null>(null);

  // Client login state
  const [clientIdentifier, setClientIdentifier] = useState('syakirah@example.com');
  const [clientPassword, setClientPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  // Client password reset mode
  const [isResetMode, setIsResetMode] = useState<boolean>(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoError(null);
    const result = await loginWithGoogleSSO();
    if (result.success) {
      onClose();
    } else if (result.error) {
      setSsoError(result.error);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const result = await loginClientPassword(clientIdentifier, clientPassword);
    if (result.success) {
      onClose();
    } else if (result.error) {
      setClientError(result.error);
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setResetSuccessMsg(null);
    if (!resetNewPassword || resetNewPassword.length < 4) {
      setClientError('New password must be at least 4 characters long.');
      return;
    }
    const res = resetClientPassword(clientIdentifier, resetNewPassword);
    if (res.success) {
      setResetSuccessMsg(res.message);
      setClientPassword(resetNewPassword);
      setIsResetMode(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-[#E1DCCF] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#16223A] text-white p-5 border-b border-[#A9814A]/30 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 font-serif font-bold text-base text-[#F6F4EE]">
              <ShieldCheck className="w-5 h-5 text-[#A9814A]" />
              Messrs. Syafiqah Hamizad &amp; Co
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Secure Authentication Portal &amp; Single Sign-On (SSO)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-lg px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Current Active Account Banner */}
        <div className="bg-amber-50/80 border-b border-amber-200/80 p-3 px-5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-800" />
            <div>
              <span className="font-bold text-slate-800">{currentUser.name}</span>
              <span className="ml-2 text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">
                {currentUser.role} {currentUser.isSuperAdmin ? '• SUPER ADMIN' : currentUser.isAdmin ? '• ADMIN' : ''}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 truncate max-w-[140px]">{currentUser.email}</span>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="grid grid-cols-2 border-b border-[#E1DCCF] bg-[#F6F4EE]">
          <button
            onClick={() => {
              setActiveTab('sso');
              setSsoError(null);
            }}
            className={`p-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'sso'
                ? 'bg-white text-[#16223A] border-b-2 border-[#16223A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-700" />
            Firm Staff SSO (@shcolaw.com)
          </button>

          <button
            onClick={() => {
              setActiveTab('client');
              setClientError(null);
            }}
            className={`p-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'client'
                ? 'bg-white text-[#16223A] border-b-2 border-[#16223A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
            Client Password Login
          </button>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'sso' && (
            <form onSubmit={handleSsoSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                <div className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  Google Workspace SSO Policy
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Firm Portal SSO is <strong>strictly restricted to @shcolaw.com</strong> domain email accounts. External Google accounts (e.g. @gmail.com) are automatically blocked.
                </p>
              </div>

              {ssoError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{ssoError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Google Workspace SSO Email (@shcolaw.com) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. syafiqahhamizad@shcolaw.com"
                    value={ssoEmail}
                    onChange={(e) => setSsoEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-[#A9814A]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4 text-[#A9814A]" />
                  Sign In with Google Workspace SSO
                </button>
              </div>
            </form>
          )}

          {activeTab === 'client' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                <div className="font-bold text-amber-900 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    {isResetMode ? 'Client Account Password Reset' : 'Client Access Portal Sign-In'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(!isResetMode);
                      setClientError(null);
                      setResetSuccessMsg(null);
                    }}
                    className="text-[10.5px] font-bold text-amber-900 underline cursor-pointer hover:text-amber-950"
                  >
                    {isResetMode ? '← Back to Sign In' : '🔑 Reset Password'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isResetMode
                    ? 'Enter your registered Client Email or Client ID along with your desired new password to update your login credentials immediately.'
                    : 'Clients sign in with their registered Email or Client ID and password to access their matter status, fee statements, and files.'}
                </p>
              </div>

              {resetSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{resetSuccessMsg}</span>
                </div>
              )}

              {clientError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{clientError}</span>
                </div>
              )}

              {isResetMode ? (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Registered Client Email or Client ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. syakirah@example.com or HQ-C001"
                      value={clientIdentifier}
                      onChange={(e) => setClientIdentifier(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-[#A9814A]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      New Client Account Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new secure password..."
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#A9814A]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <KeyRound className="w-4 h-4 text-[#A9814A]" />
                      Update &amp; Set New Password
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleClientSubmit} className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Registered Client Email or Client ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. syakirah@example.com or HQ-C001"
                      value={clientIdentifier}
                      onChange={(e) => setClientIdentifier(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-[#A9814A]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">Client Account Password *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetMode(true);
                          setClientError(null);
                        }}
                        className="text-[10px] text-amber-800 hover:underline font-bold"
                      >
                        Forgot / Reset Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Enter your Firebase account password"
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#A9814A]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#A9814A] hover:bg-[#8F6A37] text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In to Client Portal
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
