import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, QrCode, ShieldCheck, Ticket } from 'lucide-react';
import type { UserProfile, UserRole } from '../types/database';

interface AuthPageProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

type Mode = 'signin' | 'signup';

const MODES: { key: Mode; label: string }[] = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Create Account' },
];

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('guest');
  const [error, setError] = useState<string | null>(null);

  const buildProfile = (r: UserRole, e: string, name: string | null): UserProfile => ({
    id: crypto.randomUUID(),
    email: e,
    full_name: name,
    role: r,
    created_at: new Date().toISOString(),
  });

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    // TODO: Phase 3 Supabase — signInWithPassword / signUp & fetch profiles.role
    onAuthSuccess(
      buildProfile(role, email.trim(), mode === 'signup' ? fullName.trim() : email.split('@')[0]),
    );
  };

  const demoAs = (r: UserRole) => {
    // TODO: Phase 3 Supabase — signInWithPassword / signUp & fetch profiles.role
    onAuthSuccess(
      buildProfile(
        r,
        r === 'admin' ? 'admin@demo.test' : 'guest@demo.test',
        r === 'admin' ? 'Demo Admin' : 'Demo Guest',
      ),
    );
  };

  const iconBadge =
    'absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-violet-500 shadow-sm';

  return (
    <div className="pastel-mesh-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="liquid-glass w-full max-w-4xl overflow-hidden rounded-[2rem] grid md:grid-cols-2"
      >
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-white/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 text-violet-500 shadow-sm">
            <QrCode size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
              Events, checked in at the speed of a glance.
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Register once, receive your QR pass, and walk straight through the gate.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex items-center gap-3">
              <Ticket size={16} className="text-violet-500" /> Instant digital QR tickets
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-violet-500" /> PIN-protected gate scanning
            </li>
          </ul>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-10">
          <h2 className="text-2xl font-semibold text-slate-800">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'signin' ? 'Sign in to continue.' : 'It only takes a moment.'}
          </p>

          {/* Segmented pill switcher */}
          <div className="liquid-glass relative mt-6 flex rounded-full p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMode(m.key);
                  setError(null);
                }}
                className="relative z-10 flex-1 rounded-full px-4 py-2 text-sm font-medium"
              >
                {mode === m.key && (
                  <motion.span
                    layoutId="auth-segment"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 -z-10 rounded-full bg-white/80 shadow"
                  />
                )}
                <span className={mode === m.key ? 'text-violet-600' : 'text-slate-600'}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="full_name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <span className={iconBadge}>
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                      className="liquid-pill-input w-full pl-14"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <span className={iconBadge}>
                <Mail size={16} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className="liquid-pill-input w-full pl-14"
              />
            </div>

            <div className="relative">
              <span className={iconBadge}>
                <Lock size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="liquid-pill-input w-full pl-14"
              />
            </div>

            {/* Mock role selector (Phase 2B testing only) */}
            <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <span>Mock role</span>
              <div className="liquid-glass relative flex rounded-full p-1">
                {(['guest', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="relative z-10 rounded-full px-4 py-1 font-medium capitalize"
                  >
                    {role === r && (
                      <motion.span
                        layoutId="auth-role"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 -z-10 rounded-full bg-white/80 shadow"
                      />
                    )}
                    <span className={role === r ? 'text-violet-600' : 'text-slate-600'}>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-full bg-rose-100/80 px-4 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="liquid-btn-primary w-full flex items-center justify-center gap-2"
            >
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick demo bar */}
          <div className="liquid-glass mt-6 flex items-center gap-2 rounded-full p-1.5">
            <span className="pl-3 pr-1 text-[11px] uppercase tracking-wide text-slate-500">
              Quick demo
            </span>
            <button
              type="button"
              onClick={() => demoAs('guest')}
              className="flex-1 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/90"
            >
              Demo as Guest
            </button>
            <button
              type="button"
              onClick={() => demoAs('admin')}
              className="flex-1 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/90"
            >
              Demo as Admin
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}