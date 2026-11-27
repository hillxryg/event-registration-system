import { motion } from 'motion/react';
import { Compass, Globe, LayoutDashboard, LogIn, Ticket } from 'lucide-react';
import type { UserProfile } from '../types/database';

interface NotFoundPageProps {
  user?: UserProfile | null;
}

function navigateTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function NotFoundPage({ user = null }: NotFoundPageProps) {
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="liquid-glass flex w-full max-w-lg flex-col items-center gap-6 px-6 py-12 text-center sm:px-10"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-white/70 text-violet-600 shadow-sm">
          <Compass size={30} />
        </span>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-600">Error 404</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#18181B]">Page not found</h1>
          <p className="text-sm font-medium text-[#18181B]/60">
            The page you’re looking for doesn’t exist, has moved, or you don’t have access to it.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigateTo('/events')}
            className="liquid-btn-primary w-full sm:w-auto"
          >
            <Globe size={18} />
            Browse Public Events
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => navigateTo(isAdmin ? '/admin' : '/my-passes')}
              className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-white/80 bg-white/70 px-8 text-[0.9375rem] font-bold text-[#18181B] shadow-sm transition hover:bg-white sm:w-auto"
            >
              {isAdmin ? <LayoutDashboard size={18} /> : <Ticket size={18} />}
              {isAdmin ? 'Go to Dashboard' : 'My Passes'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-white/80 bg-white/70 px-8 text-[0.9375rem] font-bold text-[#18181B] shadow-sm transition hover:bg-white sm:w-auto"
            >
              <LogIn size={18} />
              Sign In
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}