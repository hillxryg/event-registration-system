import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Globe, LogIn, LogOut, Menu, Ticket, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from './types/database';
import { supabase, fetchUserProfile } from './lib/supabase';
import AdminShell from './components/AdminShell';
import AuthPage from './pages/AuthPage';
import PublicEventsPage from './pages/PublicEventsPage';
import RegisterPage from './pages/RegisterPage';
import MyPassesPage from './pages/MyPassesPage';
import ScannerPage from './pages/ScannerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminCrudPage from './pages/AdminCrudPage';

function navigateTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const AUTH_REDIRECT_KEY = 'passflow_auth_redirect';

const isEventsPath = (p: string) => p === '/events' || p === '/events/';
const isRegisterPath = (p: string) => p.startsWith('/register/');
const isLegacyRegisterRoot = (p: string) => p === '/register' || p === '/register/';
const isPublicPath = (p: string) => isEventsPath(p) || isRegisterPath(p);

function rememberRedirect() {
  try {
    if (isPublicPath(window.location.pathname)) {
      window.sessionStorage.setItem(AUTH_REDIRECT_KEY, window.location.pathname);
    }
  } catch {
    /* storage unavailable */
  }
}

function consumeRedirect(): string | null {
  try {
    const stored = window.sessionStorage.getItem(AUTH_REDIRECT_KEY);
    window.sessionStorage.removeItem(AUTH_REDIRECT_KEY);
    return stored;
  } catch {
    return null;
  }
}

interface TopNavProps {
  user: UserProfile | null;
  path: string;
  onSignOut: () => void | Promise<void>;
}

function TopNav({ user, path, onSignOut }: TopNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const homePath = user ? (user.role === 'admin' ? '/admin' : '/my-passes') : '/events';

  const links: { label: string; to: string; Icon: LucideIcon; active: boolean }[] = [
    {
      label: 'Public Events',
      to: '/events',
      Icon: Globe,
      active: isEventsPath(path) || isRegisterPath(path),
    },
  ];
  if (user) {
    links.push({
      label: 'My Passes',
      to: '/my-passes',
      Icon: Ticket,
      active: path.startsWith('/my-passes'),
    });
  }

  const signIn = () => {
    setOpen(false);
    rememberRedirect();
    navigateTo('/');
  };

  const signOut = () => {
    setOpen(false);
    void onSignOut();
  };

  const linkBase =
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition';

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="relative mx-auto max-w-6xl">
        <nav
          aria-label="Primary"
          className="liquid-glass flex min-w-0 items-center justify-between gap-3 rounded-full py-2 pl-4 pr-2"
        >
          <button
            type="button"
            aria-label="PassFlow home"
            onClick={() => navigateTo(homePath)}
            className="inline-flex min-w-0 items-center gap-2.5 rounded-full"
          >
            <img src="/passflow-logo.svg" alt="PassFlow" className="size-8 shrink-0" />
            <span className="truncate text-lg font-extrabold tracking-tight text-[#18181B]">
              PassFlow
            </span>
          </button>

          {/* Desktop */}
          <div className="hidden min-w-0 items-center gap-1.5 md:flex">
            {links.map((l) => (
              <button
                key={l.to}
                type="button"
                onClick={() => navigateTo(l.to)}
                className={`${linkBase} ${
                  l.active
                    ? 'bg-white/80 text-violet-700 shadow-sm'
                    : 'text-[#18181B]/75 hover:bg-white/60'
                }`}
              >
                <l.Icon size={14} />
                {l.label}
              </button>
            ))}
            {user ? (
              <>
                <span className="ml-1 flex min-w-0 items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3 py-2 text-xs font-semibold text-[#18181B]">
                  <User size={14} className="shrink-0 text-violet-600" />
                  <span className="max-w-[200px] truncate">{user.email}</span>
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className={`${linkBase} bg-[#18181B] text-white hover:opacity-90`}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className={`${linkBase} bg-[#18181B] text-white hover:opacity-90`}
              >
                <LogIn size={14} />
                Sign In
              </button>
            )}
          </div>

          {/* Mobile */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#18181B] shadow-sm transition hover:bg-white md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="liquid-glass mt-2 min-w-0 rounded-3xl bg-white/70 p-3 md:hidden"
            >
              <div className="flex flex-col gap-1.5">
                {links.map((l) => (
                  <button
                    key={l.to}
                    type="button"
                    onClick={() => navigateTo(l.to)}
                    className={`${linkBase} w-full justify-start py-3 ${
                      l.active ? 'bg-white/85 text-violet-700' : 'text-[#18181B]/80 hover:bg-white/60'
                    }`}
                  >
                    <l.Icon size={16} />
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 border-t border-[#18181B]/10 pt-3">
                {user ? (
                  <>
                    <p className="flex min-w-0 items-center gap-2 px-3.5 pb-3 text-xs font-semibold text-[#18181B]">
                      <User size={14} className="shrink-0 text-violet-600" />
                      <span className="min-w-0 truncate">{user.email}</span>
                    </p>
                    <button
                      type="button"
                      onClick={signOut}
                      className={`${linkBase} w-full justify-center bg-[#18181B] py-3 text-white`}
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={signIn}
                    className={`${linkBase} w-full justify-center bg-[#18181B] py-3 text-white`}
                  >
                    <LogIn size={14} />
                    Sign In
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

interface SharedLayoutProps {
  user: UserProfile | null;
  path: string;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
}

/** Admins get the AdminShell side rail; guests and visitors get the top nav. */
function SharedLayout({ user, path, onSignOut, children }: SharedLayoutProps) {
  if (user?.role === 'admin') {
    return (
      <AdminShell profile={user} onSignOut={onSignOut}>
        {children}
      </AdminShell>
    );
  }
  return (
    <div className="relative">
      <TopNav user={user} path={path} onSignOut={onSignOut} />
      {children}
    </div>
  );
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Backwards compatibility: legacy `/register` directory links resolve to `/events`
  useEffect(() => {
    if (!isLegacyRegisterRoot(path)) return;
    window.history.replaceState({}, '', `/events${window.location.search}`);
    setPath('/events');
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async (userId: string) => {
      const profile = await fetchUserProfile(userId);
      if (!cancelled) setCurrentUser(profile);
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) await hydrate(data.session.user.id);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (!cancelled) setCurrentUser(null);
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        setTimeout(() => {
          void hydrate(userId);
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    const remembered = consumeRedirect();
    if (profile.role === 'admin') {
      navigateTo('/admin');
      return;
    }
    const intended = remembered ?? window.location.pathname;
    navigateTo(isPublicPath(intended) ? intended : '/my-passes');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigateTo('/');
  };

  const routePath = isLegacyRegisterRoot(path) ? '/events' : path;
  const embedded = currentUser?.role === 'admin';

  if (routePath === '/scanner' || routePath.startsWith('/scanner/')) {
    return <ScannerPage />;
  }

  if (initializing) {
    return (
      <div className="pastel-mesh-bg min-h-screen flex items-center justify-center p-4">
        <div className="liquid-glass rounded-full px-6 py-3 text-sm font-medium text-slate-700 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  // ---------- Admin-only ----------
  if (routePath === '/admin' || routePath.startsWith('/admin/')) {
    if (!currentUser || currentUser.role !== 'admin') {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }
    if (routePath === '/admin/manage' || routePath.startsWith('/admin/manage/')) {
      return <AdminCrudPage profile={currentUser} onSignOut={handleSignOut} />;
    }
    return <AdminDashboardPage profile={currentUser} onSignOut={handleSignOut} />;
  }

  // ---------- My Passes (guest + admin) ----------
  if (routePath === '/my-passes' || routePath.startsWith('/my-passes/')) {
    if (!currentUser) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }
    return (
      <SharedLayout user={currentUser} path={routePath} onSignOut={handleSignOut}>
        <MyPassesPage user={currentUser} onSignOut={handleSignOut} embedded={embedded} />
      </SharedLayout>
    );
  }

  // ---------- Public: /events ----------
  if (isEventsPath(routePath)) {
    return (
      <SharedLayout user={currentUser} path={routePath} onSignOut={handleSignOut}>
        <PublicEventsPage viewer={currentUser} embedded={embedded} />
      </SharedLayout>
    );
  }

  // ---------- Public: /register/:slug ----------
  if (isRegisterPath(routePath)) {
    return (
      <SharedLayout user={currentUser} path={routePath} onSignOut={handleSignOut}>
        <RegisterPage viewer={currentUser} embedded={embedded} />
      </SharedLayout>
    );
  }

  // ---------- Fallback ----------
  if (currentUser) {
    return currentUser.role === 'admin' ? (
      <AdminDashboardPage profile={currentUser} onSignOut={handleSignOut} />
    ) : (
      <SharedLayout user={currentUser} path={routePath} onSignOut={handleSignOut}>
        <MyPassesPage user={currentUser} onSignOut={handleSignOut} />
      </SharedLayout>
    );
  }

  return <AuthPage onAuthSuccess={handleAuthSuccess} />;
}