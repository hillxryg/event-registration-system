import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import type { UserProfile } from './types/database';
import { supabase, fetchUserProfile } from './lib/supabase';
import AuthPage from './pages/AuthPage';
import RegisterPage from './pages/RegisterPage';
import ScannerPage from './pages/ScannerPage';
import AdminPage from './pages/AdminPage';

function navigateTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
        // Deferred to avoid awaiting Supabase calls inside the auth callback.
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
    navigateTo(profile.role === 'admin' ? '/admin' : '/register');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigateTo('/');
  };

  // Public PIN-protected Gate Scanner (/scanner or /scanner/:slug)
  if (path === '/scanner' || path.startsWith('/scanner/')) {
    return <ScannerPage />;
  }

  // Wait for initial session check so protected routes don't flash AuthPage
  if (initializing) {
    return (
      <div className="pastel-mesh-bg min-h-screen flex items-center justify-center p-4">
        <div className="liquid-glass rounded-full px-6 py-3 text-sm font-medium text-slate-700 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  // Admin Dashboard (/admin) — guarded by role === 'admin'
  if (path === '/admin' || path.startsWith('/admin/')) {
    if (!currentUser || currentUser.role !== 'admin') {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }
    return <AdminPage user={currentUser} onSignOut={handleSignOut} />;
  }

  // Guest Registration (/register or /register/:slug) — requires signed-in user
  if (path === '/register' || path.startsWith('/register/')) {
    if (!currentUser) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }
    return (
      <div className="relative">
        <div className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#18181B] shadow-sm backdrop-blur-xl">
          <User size={14} className="text-violet-600" />
          <span className="max-w-[160px] truncate">{currentUser.email}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#18181B] px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
        <RegisterPage />
      </div>
    );
  }

  // Default Landing (/) -> AuthPage (or redirect if already signed in)
  if (currentUser) {
    return currentUser.role === 'admin' ? (
      <AdminPage user={currentUser} onSignOut={handleSignOut} />
    ) : (
      <div className="relative">
        <div className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#18181B] shadow-sm backdrop-blur-xl">
          <User size={14} className="text-violet-600" />
          <span className="max-w-[160px] truncate">{currentUser.email}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#18181B] px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
        <RegisterPage />
      </div>
    );
  }

  return <AuthPage onAuthSuccess={handleAuthSuccess} />;
}