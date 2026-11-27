import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';
import type { UserProfile } from '../types/database';
import { supabase, fetchUserProfile } from '../lib/supabase';

interface AuthPageProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

type Mode = 'signin' | 'signup' | 'magic';
type FieldKey = 'fullName' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;
const INVALID_INPUT =
  'border-rose-400/90 bg-rose-50/60 ring-2 ring-rose-400/35 text-rose-900 placeholder:text-rose-400';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 px-4 text-xs font-semibold text-rose-600">
      {message}
    </p>
  );
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Sign Up' },
  { key: 'magic', label: 'Email Link' },
];

const AUTH_REDIRECT_KEY = 'passflow_auth_redirect';

function BrandLink() {
  return (
    <button
      type="button"
      aria-label="PassFlow home"
      onClick={() => {
        window.history.pushState({}, '', '/register');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
      className="inline-flex min-w-0 items-center gap-2.5 rounded-full"
    >
      <img src="/passflow-logo.svg" alt="PassFlow" className="size-10 shrink-0" />
      <span className="truncate text-xl font-extrabold tracking-tight text-slate-800">PassFlow</span>
    </button>
  );
}

const redirectUrl = () => {
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(AUTH_REDIRECT_KEY);
  } catch {
    /* storage unavailable */
  }
  return `${window.location.origin}${stored ?? '/my-passes'}`;
};

// Profile row is created by the `on_auth_user_created` trigger; allow it a moment on first signup.
const loadProfileWithRetry = async (userId: string): Promise<UserProfile | null> => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const profile = await fetchUserProfile(userId);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return null;
};

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (mode === 'signup' && !fullName.trim()) errors.fullName = 'Full name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (mode !== 'magic') {
      if (!password.trim()) errors.password = 'Password is required.';
      else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH)
        errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return errors;
  };

  const completeAuth = async (userId: string) => {
    const profile = await loadProfileWithRetry(userId);
    if (!profile) {
      setError('Signed in, but your profile could not be loaded. Please try again.');
      return;
    }
    onAuthSuccess(profile);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setNotice(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        if (!data.user) {
          setError('Sign in failed. Please try again.');
          return;
        }
        await completeAuth(data.user.id);
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: redirectUrl(),
          },
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        if (!data.session || !data.user) {
          setNotice(
            'Check your inbox to confirm your email address, then sign in to continue.',
          );
          return;
        }
        await completeAuth(data.user.id);
      } else {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true, emailRedirectTo: redirectUrl() },
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        setNotice('Check your inbox for a sign-in link. Open it on this device to continue.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
          <BrandLink />
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
          <div className="mb-6 md:hidden">
            <BrandLink />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800">
            {mode === 'signin'
              ? 'Welcome back'
              : mode === 'signup'
                ? 'Create your account'
                : 'Sign in with an email link'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'signin'
              ? 'Sign in to continue.'
              : mode === 'signup'
                ? 'It only takes a moment.'
                : 'No password needed. We’ll email you a one-tap link.'}
          </p>

          {/* Segmented pill switcher */}
          <div className="liquid-glass relative mt-6 grid grid-cols-3 rounded-full p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMode(m.key);
                  setError(null);
                  setNotice(null);
                  setFieldErrors({});
                }}
                className="relative z-10 min-w-0 whitespace-nowrap rounded-full px-2 py-2 text-center text-xs font-medium sm:px-2.5 sm:text-sm"
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

          <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  key="full_name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="-mx-1 overflow-hidden px-1 pb-1"
                >
                  <div className="relative">
                    <span className={iconBadge}>
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (e.target.value.trim()) clearFieldError('fullName');
                      }}
                      placeholder="Full name"
                      autoComplete="name"
                      aria-invalid={!!fieldErrors.fullName}
                      aria-describedby={fieldErrors.fullName ? 'auth-fullname-error' : undefined}
                      className={`liquid-pill-input w-full pl-14 ${fieldErrors.fullName ? INVALID_INPUT : ''}`}
                    />
                  </div>
                  <FieldError id="auth-fullname-error" message={fieldErrors.fullName} />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <div className="relative">
                <span className={iconBadge}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (EMAIL_RE.test(e.target.value.trim())) clearFieldError('email');
                  }}
                  placeholder="Email address"
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                  className={`liquid-pill-input w-full pl-14 ${fieldErrors.email ? INVALID_INPUT : ''}`}
                />
              </div>
              <FieldError id="auth-email-error" message={fieldErrors.email} />
            </div>

            {mode !== 'magic' && (
              <div>
                <div className="relative">
                  <span className={iconBadge}>
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (
                        e.target.value.trim() &&
                        (mode !== 'signup' || e.target.value.length >= MIN_PASSWORD_LENGTH)
                      )
                        clearFieldError('password');
                    }}
                    placeholder="Password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                    className={`liquid-pill-input w-full pl-14 ${fieldErrors.password ? INVALID_INPUT : ''}`}
                  />
                </div>
                <FieldError id="auth-password-error" message={fieldErrors.password} />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-2xl bg-rose-100/80 px-4 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="rounded-2xl bg-emerald-100/80 px-4 py-2 text-xs text-emerald-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary w-full flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? mode === 'signin'
                  ? 'Signing In…'
                  : mode === 'signup'
                    ? 'Creating Account…'
                    : 'Sending Link…'
                : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Magic Link'}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}