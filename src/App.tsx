import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import type { UserProfile } from './types/database';
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
  // TODO: Phase 3 Supabase — hydrate currentUser from supabase.auth.getSession() + profiles table
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    navigateTo(profile.role === 'admin' ? '/admin' : '/register');
  };

  const handleSignOut = () => {
    // TODO: Phase 3 Supabase — await supabase.auth.signOut()
    setCurrentUser(null);
    navigateTo('/');
  };

  // Public PIN-protected Gate Scanner (/scanner or /scanner/:slug)
  if (path === '/scanner' || path.startsWith('/scanner/')) {
    return <ScannerPage />;
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