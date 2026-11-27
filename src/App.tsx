/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile } from './types/database';
import { supabase, fetchUserProfile } from './lib/supabase';
import AppShell from './components/AppShell';
import { SuccessModal, type SuccessReceipt } from './components/ConfirmModal';
import LoadingScreen from './components/LoadingScreen';
import AuthPage from './pages/AuthPage';
import PublicEventsPage from './pages/PublicEventsPage';
import RegisterPage from './pages/RegisterPage';
import MyPassesPage from './pages/MyPassesPage';
import ScannerPage from './pages/ScannerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminCrudPage from './pages/AdminCrudPage';
import NotFoundPage from './pages/NotFoundPage';

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

function AppRoutes({ onSignedOut }: { onSignedOut: (receipt: SuccessReceipt) => void }) {
  const [path, setPath] = useState(() => window.location.pathname);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const loadedUserId = useRef<string | null>(null);
  const hydratingId = useRef<string | null>(null);

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

  // Authenticated visitors landing on `/` are sent to their home page.
  useEffect(() => {
    if (initializing || !currentUser) return;
    if (path !== '/') return;
    const home = currentUser.role === 'admin' ? '/admin' : '/my-passes';
    window.history.replaceState({}, '', home);
    setPath(home);
  }, [initializing, currentUser, path]);

  useEffect(() => {
    let cancelled = false;

    // Never clears an already-loaded profile: a transient profile-fetch failure
    // must not look like a sign-out.
    const hydrate = async (userId: string) => {
      if (hydratingId.current === userId) return;
      hydratingId.current = userId;
      try {
        let profile = await fetchUserProfile(userId);
        if (!profile && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (!cancelled) profile = await fetchUserProfile(userId);
        }
        if (cancelled || !profile) return;
        loadedUserId.current = profile.id;
        setCurrentUser(profile);
      } finally {
        hydratingId.current = null;
      }
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
        loadedUserId.current = null;
        if (!cancelled) setCurrentUser(null);
        return;
      }
      const sessionUser = session?.user;
      if (!sessionUser) return;
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        // Same user already loaded (tab refocus, token refresh): leave state untouched.
        if (loadedUserId.current === sessionUser.id) return;
        const userId = sessionUser.id;
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
    loadedUserId.current = profile.id;
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
    const email = currentUser?.email;
    await supabase.auth.signOut();
    loadedUserId.current = null;
    setCurrentUser(null);
    navigateTo('/');
    onSignedOut({
      title: 'Signed out',
      details: email ? [{ label: 'Account', value: email }] : undefined,
      notice: 'You have been signed out of PassFlow successfully.',
    });
  };

  const handleSignIn = () => {
    rememberRedirect();
    navigateTo('/');
  };

  const routePath = isLegacyRegisterRoot(path) ? '/events' : path;

  if (routePath === '/scanner' || routePath.startsWith('/scanner/')) {
    return <ScannerPage />;
  }

  if (initializing) {
    return <LoadingScreen />;
  }

  const isRoot = routePath === '/';
  const isAdminRoute = routePath === '/admin' || routePath.startsWith('/admin/');
  const isManageRoute = routePath === '/admin/manage' || routePath.startsWith('/admin/manage/');
  const isPassesRoute = routePath === '/my-passes' || routePath.startsWith('/my-passes/');
  const isEvents = isEventsPath(routePath);
  const isRegister = isRegisterPath(routePath);

  // ---------- Auth gates (no shell) ----------
  if (isAdminRoute && currentUser?.role !== 'admin') {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }
  if (isPassesRoute && !currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }
  if (isRoot && !currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // ---------- Single persistent shell for every other route ----------
  let content: ReactNode;
  if (isManageRoute && currentUser) {
    content = <AdminCrudPage profile={currentUser} onSignOut={handleSignOut} />;
  } else if (isAdminRoute && currentUser) {
    content = <AdminDashboardPage profile={currentUser} onSignOut={handleSignOut} />;
  } else if (isPassesRoute && currentUser) {
    content = <MyPassesPage user={currentUser} onSignOut={handleSignOut} embedded />;
  } else if (isEvents) {
    content = <PublicEventsPage viewer={currentUser} />;
  } else if (isRegister) {
    content = <RegisterPage viewer={currentUser} embedded />;
  } else if (isRoot && currentUser?.role === 'admin') {
    content = <AdminDashboardPage profile={currentUser} onSignOut={handleSignOut} />;
  } else if (isRoot && currentUser) {
    content = <MyPassesPage user={currentUser} onSignOut={handleSignOut} embedded />;
  } else {
    content = <NotFoundPage user={currentUser} />;
  }

  return (
    <AppShell user={currentUser} onSignOut={handleSignOut} onSignIn={handleSignIn}>
      {content}
    </AppShell>
  );
}

export default function App() {
  const [receipt, setReceipt] = useState<SuccessReceipt | null>(null);
  return (
    <>
      <AppRoutes onSignedOut={setReceipt} />
      <SuccessModal receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}