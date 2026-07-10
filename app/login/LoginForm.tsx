'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertTriangle, ShieldOff, Zap } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutReset, setLockoutReset] = useState<number>(0);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Live lockout countdown
  useEffect(() => {
    if (!isLockedOut || lockoutReset === 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutReset - Date.now()) / 1000));
      setLockoutCountdown(remaining);
      if (remaining <= 0) {
        setIsLockedOut(false);
        setError(null);
        setRemainingAttempts(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLockedOut, lockoutReset]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isLockedOut || !password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      if (response.status === 429) {
        setIsLockedOut(true);
        setLockoutReset(data.resetAt ?? Date.now() + 15 * 60 * 1000);
        setError(data.error ?? 'Too many attempts. You are locked out.');
        setPassword('');
        return;
      }

      setError(data.error ?? 'Incorrect password.');
      if (typeof data.remainingAttempts === 'number') {
        setRemainingAttempts(data.remainingAttempts);
      }
      setPassword('');
      inputRef.current?.focus();
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40" />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-4">
            <Zap className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lead System</h1>
          <p className="text-slate-400 text-sm mt-1">Internal Operations Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

          <div className="p-8">
            {/* Lock status header */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors duration-300 ${
                isLockedOut
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-slate-800 border-slate-700'
              }`}>
                {isLockedOut
                  ? <ShieldOff className="w-5 h-5 text-red-400" />
                  : <Lock className="w-5 h-5 text-slate-400" />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {isLockedOut ? 'Access Locked' : 'Restricted Access'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isLockedOut
                    ? `Resets in ${formatCountdown(lockoutCountdown)}`
                    : 'Administrator credentials required'}
                </p>
              </div>
            </div>

            {/* Lockout State */}
            {isLockedOut ? (
              <div className="rounded-xl bg-red-950/40 border border-red-900/50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-red-300 text-sm font-medium">Brute-Force Protection Active</p>
                    <p className="text-red-400/70 text-xs mt-1">
                      Too many failed attempts from your IP.
                      Access restores in{' '}
                      <span className="font-mono text-red-300">{formatCountdown(lockoutCountdown)}</span>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-950/30 border border-red-900/40 px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-300 text-xs">{error}</p>
                      {remainingAttempts !== null && remainingAttempts > 0 && (
                        <p className="text-red-400/60 text-xs mt-0.5">
                          {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before lockout.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  id="login-submit"
                  disabled={isLoading || !password.trim()}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Unlock Dashboard
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="px-8 py-4 bg-slate-950/40 border-t border-slate-800/40">
            <p className="text-xs text-slate-600 text-center">
              IP-based brute-force detection · Session expires in 8h
            </p>
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Lead Automation System · Internal Use Only
        </p>
      </div>
    </div>
  );
}
