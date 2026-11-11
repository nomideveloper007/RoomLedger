import React, { useState } from 'react';
import { AuthService, AuthUser } from '../../lib/auth';
import { useRoom } from '../../context/RoomContext';
import { Wallet, ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onSuccess?: (user: AuthUser) => void;
  roomName?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, roomName = 'RoomLedger' }) => {
  const { login } = useRoom();
  const authorizedEmail = AuthService.getAuthorizedEmail();

  const [email, setEmail] = useState(() => authorizedEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        const curUser = AuthService.getCurrentUser();
        if (curUser && onSuccess) onSuccess(curUser);
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center px-4 py-12 relative text-[#172B4D]">
      {/* Subtle background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-[#EFF6FF] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20 mb-1">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142B4A]">
            RoomLedger
          </h1>
          <p className="text-xs text-[#64748B]">
            Premium Household Expense Register · 5 Roommates
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-5">
          <div className="border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#142B4A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
                <span>Authorized Sign In</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#CBD5E1]/60">
                Member Sign In
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Enter your room member or admin credentials to access the register:
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-[#FEF2F2] border border-[#DC2626]/30 rounded-xl text-xs text-[#DC2626] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#142B4A] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Login Email</span>
                <span className="text-[11px] text-[#64748B] font-mono normal-case">
                  Owner or Roommate
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus={!email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. nomideveloper007@gmail.com"
                  className="w-full pl-9 pr-3.5 py-3 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#172B4D] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all font-mono text-xs sm:text-sm min-h-[46px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus={Boolean(email)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-11 py-3 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#172B4D] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#172B4D] transition-colors cursor-pointer touch-manipulation"
                  title={showPassword ? 'Hide password' : 'View password'}
                  aria-label={showPassword ? 'Hide password' : 'View password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[#2563EB]" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] text-white font-semibold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 min-h-[46px] touch-manipulation"
            >
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to Register</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-2 border-t border-[#E2E8F0] text-center space-y-1">
            <div className="text-[11px] text-[#64748B] flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="font-medium">Public registration is permanently disabled</span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              Protected with PostgreSQL Supabase Row-Level Security (RLS)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
