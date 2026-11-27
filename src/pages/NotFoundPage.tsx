import { motion } from 'motion/react';
import { ArrowLeft, Compass, Globe, LayoutDashboard, LogIn, Ticket } from 'lucide-react';
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
    <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] max-w-2xl items-center justify-center px-2 py-8 lg:min-h-[calc(100dvh-2.5rem)]">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="liquid-glass relative w-full overflow-hidden rounded-3xl p-8 text-center sm:p-12"
      >
        {/* Subtle decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-400/25 to-fuchsia-300/25 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-md flex-col items-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3.5 py-1.5 text-xs font-extrabold tracking-widest text-violet-600 uppercase shadow-xs">
            <Compass size={14} />
            404 · Off the Map
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#18181B] sm:text-4xl">
            We couldn&apos;t find that page
          </h1>

          <p className="mt-3 text-sm leading-relaxed font-medium text-[#18181B]/60 sm:text-base">
            The link may be broken, the event URL might have changed, or you don&apos;t have
            permission to view this route.
          </p>

          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => navigateTo('/events')}
              className="liquid-btn-primary inline-flex w-full items-center justify-center gap-2 whitespace-nowrap px-7 sm:w-auto"
            >
              <Globe size={17} />
              Browse Events
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigateTo(isAdmin ? '/admin' : '/my-passes')}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/80 bg-white/75 px-7 text-sm font-bold whitespace-nowrap text-[#18181B] shadow-xs transition hover:bg-white sm:w-auto"
              >
                {isAdmin ? <LayoutDashboard size={17} /> : <Ticket size={17} />}
                {isAdmin ? 'Admin Dashboard' : 'My Passes'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/80 bg-white/75 px-7 text-sm font-bold whitespace-nowrap text-[#18181B] shadow-xs transition hover:bg-white sm:w-auto"
              >
                <LogIn size={17} />
                Sign In
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#18181B]/50 transition hover:text-[#18181B]"
          >
            <ArrowLeft size={13} />
            Go back to previous page
          </button>
        </div>
      </motion.div>
    </div>
  );
}