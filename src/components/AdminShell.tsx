import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Ticket,
  CalendarCog,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from '../types/database';

interface AdminShellProps {
  children: ReactNode;
  profile: UserProfile;
  onSignOut: () => void | Promise<void>;
  activeScannerSlug?: string | null;
}

interface NavItem {
  key: string;
  label: string;
  title: string;
  to: string;
  Icon: LucideIcon;
  active: boolean;
}

function navigateTo(path: string) {
  const current = window.location.pathname + window.location.search;
  if (current === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return path;
}

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;

export default function AdminShell({
  children,
  profile,
  onSignOut,
  activeScannerSlug,
}: AdminShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const scannerPath = activeScannerSlug ? `/scanner/${activeScannerSlug}` : '/scanner';

  const items: NavItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      title: 'Dashboard',
      to: '/admin',
      Icon: LayoutDashboard,
      active: path === '/admin' || path === '/admin/',
    },
    {
      key: 'manage',
      label: 'Manage Events & Guests',
      title: 'Manage Events & Guests',
      to: '/admin/manage',
      Icon: CalendarCog,
      active: path.startsWith('/admin/manage'),
    },
    {
      key: 'scanner',
      label: 'Scanner',
      title: 'Scanner',
      to: scannerPath,
      Icon: ScanLine,
      active: path.startsWith('/scanner'),
    },
    {
      key: 'public',
      label: 'Public Events',
      title: 'Public Events',
      to: '/events',
      Icon: Globe,
      active: path === '/events' || path === '/register' || path.startsWith('/register/'),
    },
    {
      key: 'passes',
      label: 'My Passes',
      title: 'My Passes',
      to: '/my-passes',
      Icon: Ticket,
      active: path.startsWith('/my-passes'),
    },
  ];

  const currentTitle = items.find((i) => i.active)?.title ?? 'Admin';
  const initial = (profile.email?.trim()[0] ?? 'A').toUpperCase();

  const signOut = () => {
    setOpen(false);
    void onSignOut();
  };

  const ProfileBadge = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-white/75 bg-white/55 ${
        compact ? 'px-3 py-2.5' : 'p-2.5'
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-400 text-sm font-extrabold text-white shadow-sm">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-[#18181B]">{profile.email}</span>
        <span className="block text-[11px] font-semibold text-violet-600">Administrator</span>
      </span>
    </div>
  );

  return (
    <div className="pastel-mesh-bg min-h-screen">
      {/* Desktop side rail */}
      <aside
        aria-label="Admin navigation"
        className="liquid-glass fixed bottom-4 left-4 top-4 z-40 hidden w-64 flex-col rounded-[28px] p-4 lg:flex"
      >
        <button
          type="button"
          aria-label="PassFlow admin home"
          onClick={() => navigateTo('/admin')}
          className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left"
        >
          <img src="/passflow-logo.svg" alt="PassFlow" className="size-9 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-lg font-extrabold leading-tight tracking-tight text-[#18181B]">
              PassFlow
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#18181B]/50">
              Admin Console
            </span>
          </span>
        </button>

        <div className="my-4 h-px bg-[#18181B]/10" />

        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={item.active ? 'page' : undefined}
              onClick={() => navigateTo(item.to)}
              className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-bold transition-colors ${
                item.active ? 'text-violet-700' : 'text-[#18181B]/70 hover:bg-white/50'
              }`}
            >
              {item.active && (
                <motion.span
                  layoutId="admin-shell-active-pill-desktop"
                  transition={spring}
                  className="absolute inset-0 rounded-2xl border border-white/80 bg-white/85 shadow-sm"
                />
              )}
              <item.Icon size={18} className="relative z-10 shrink-0" />
              <span className="relative z-10 min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-2.5 border-t border-[#18181B]/10 pt-4">
          <ProfileBadge />
          <button
            type="button"
            onClick={signOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#18181B] px-4 py-3 text-xs font-bold text-white transition hover:opacity-90"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile & tablet header */}
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 lg:hidden">
        <div className="relative mx-auto max-w-6xl">
          <div className="liquid-glass flex min-w-0 items-center justify-between gap-3 rounded-full py-2 pl-3 pr-2">
            <button
              type="button"
              aria-label="PassFlow admin home"
              onClick={() => navigateTo('/admin')}
              className="flex min-w-0 items-center gap-2.5 rounded-full"
            >
              <img src="/passflow-logo.svg" alt="PassFlow" className="size-8 shrink-0" />
              <span className="min-w-0 truncate text-sm font-extrabold tracking-tight text-[#18181B]">
                {currentTitle}
              </span>
            </button>
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#18181B] shadow-sm transition hover:bg-white"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <AnimatePresence>
            {open && (
              <>
                <motion.button
                  key="admin-shell-backdrop"
                  type="button"
                  aria-label="Close menu"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 -z-10 cursor-default bg-[#18181B]/10 backdrop-blur-[2px]"
                />
                <motion.div
                  key="admin-shell-drawer"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="liquid-glass mt-2 max-h-[calc(100vh-5.5rem)] min-w-0 overflow-y-auto rounded-3xl bg-white/70 p-3"
                >
                  <nav aria-label="Primary" className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-current={item.active ? 'page' : undefined}
                        onClick={() => navigateTo(item.to)}
                        className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-bold transition-colors ${
                          item.active ? 'text-violet-700' : 'text-[#18181B]/75 hover:bg-white/60'
                        }`}
                      >
                        {item.active && (
                          <motion.span
                            layoutId="admin-shell-active-pill-mobile"
                            transition={spring}
                            className="absolute inset-0 rounded-2xl border border-white/80 bg-white/85 shadow-sm"
                          />
                        )}
                        <item.Icon size={17} className="relative z-10 shrink-0" />
                        <span className="relative z-10 min-w-0 truncate">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="mt-2 flex flex-col gap-2.5 border-t border-[#18181B]/10 pt-3">
                    <ProfileBadge compact />
                    <button
                      type="button"
                      onClick={signOut}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#18181B] px-4 py-3 text-xs font-bold text-white transition hover:opacity-90"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Layout slot */}
      <main className="min-w-0 px-3 pb-8 pt-20 sm:px-4 lg:pb-6 lg:pl-[18.5rem] lg:pr-4 lg:pt-4">
        {children}
      </main>
    </div>
  );
}