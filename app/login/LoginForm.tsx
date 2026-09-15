'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, AlertTriangle, Mail, Sparkles, ShieldCheck, WandSparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const redirectTo = requestedRedirect?.startsWith('/dashboard') || requestedRedirect?.startsWith('/oauth/consent?authorization_id=')
    ? requestedRedirect
    : '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !password.trim() || !email.trim()) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage('Check your email for the confirmation link.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          router.push(redirectTo);
          router.refresh();
        }
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#080a10] lg:grid-cols-[1.1fr_.9fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(99,102,241,.16),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(34,211,238,.08),transparent_28%)]" />
      <section className="relative hidden border-r border-white/[0.06] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 shadow-xl shadow-indigo-500/20"><Sparkles className="size-5 text-white" /></span><div><p className="text-xl font-bold tracking-tight text-white">AurionStack</p><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-300/70">Automation Hub</p></div></div>
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200"><WandSparkles className="size-3.5" /> Modular operations</span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-0.04em] text-white xl:text-6xl">Run every automation from one focused workspace.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">Independent tools for lead recovery, creator outreach, and the next AurionStack workflow.</p>
          <div className="mt-10 flex items-center gap-6 text-xs text-slate-500"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-400" /> Tenant-isolated data</span><span className="flex items-center gap-2"><Sparkles className="size-4 text-indigo-400" /> AI-qualified leads</span></div>
        </div>
        <p className="text-xs text-slate-700">A calmer way to operate outbound.</p>
      </section>

      <section className="relative flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 lg:hidden"><div className="flex items-center justify-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600"><Sparkles className="size-5 text-white" /></span><span className="text-xl font-bold tracking-tight text-white">AurionStack</span></div></div>
        <div className="mb-7"><p className="text-sm font-medium text-indigo-300">Welcome to AurionStack</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{isSignUp ? 'Create your workspace' : 'Sign in to your workspace'}</h2><p className="mt-2 text-sm text-slate-500">{isSignUp ? 'Create your automation workspace.' : 'Enter your details to continue.'}</p></div>

        <div className="rounded-3xl border border-white/[0.08] bg-[#11141c]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 pl-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-950/30 border border-red-900/40 px-3 py-2.5" role="alert">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}

            {message && (
              <div className="flex items-start gap-2 rounded-lg bg-green-950/30 border border-green-900/40 px-3 py-2.5">
                <p className="text-green-300 text-xs">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                    setIsSignUp((value) => !value);
                setError(null);
                setMessage(null);
              }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'New to AurionStack? Create a workspace'}
            </button>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
