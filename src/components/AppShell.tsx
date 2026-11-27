/* eslint-disable react-hooks/static-components */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import {
  ArrowUp,
  CalendarCog,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Ticket,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from '../types/database';

interface AppShellProps {
  children: ReactNode;
  /** `null` renders the signed-out visitor shell. */
  user: UserProfile | null;
  onSignOut: () => void | Promise<void>;
  /** Saves the current public path, then routes to the auth page. */
  onSignIn: () => void;
}

interface NavItem {
  key: string;
  label: string;
  to: string;
  Icon: LucideIcon;
  active: boolean;
}

const COLLAPSE_KEY = 'passflow_sidebar_collapsed';
const BACK_TO_TOP_THRESHOLD = 400;

const ScannerSlugContext = createContext<(slug: string | null) => void>(() => {});

/** Lets an admin page tell the shell which event the Scanner link should open. */
export function useShellScannerSlug(slug: string | null) {
  const setSlug = useContext(ScannerSlugContext);
  useEffect(() => {
    setSlug(slug);
    return () => setSlug(null);
  }, [setSlug, slug]);
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

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;
const tween = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

export default function AppShell({ children, user, onSignOut, onSignIn }: AppShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [scannerSlug, setScannerSlug] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > BACK_TO_TOP_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const scannerPath = scannerSlug ? `/scanner/${scannerSlug}` : '/scanner';

  const items: NavItem[] = [];
  if (isAdmin) {
    items.push(
      {
        key: 'dashboard',
        label: 'Dashboard',
        to: '/admin',
        Icon: LayoutDashboard,
        active: path === '/admin' || path === '/admin/',
      },
      {
        key: 'manage',
        label: 'Manage Events & Guests',
        to: '/admin/manage',
        Icon: CalendarCog,
        active: path.startsWith('/admin/manage'),
      },
      {
        key: 'scanner',
        label: 'Scanner',
        to: scannerPath,
        Icon: ScanLine,
        active: path.startsWith('/scanner'),
      },
    );
  }
  items.push({
    key: 'public',
    label: 'Public Events',
    to: '/events',
    Icon: Globe,
    active: path === '/events' || path === '/events/' || path.startsWith('/register'),
  });
  if (user) {
    items.push({
      key: 'passes',
      label: 'My Passes',
      to: '/my-passes',
      Icon: Ticket,
      active: path.startsWith('/my-passes'),
    });
  }

  const homePath = user ? (isAdmin ? '/admin' : '/my-passes') : '/events';
  const currentTitle = items.find((i) => i.active)?.label ?? 'PassFlow';
  const roleLabel = isAdmin ? 'Administrator' : 'Guest';
  const initial = (user?.email?.trim()[0] ?? 'G').toUpperCase();

  const signOut = () => {
    setOpen(false);
    void onSignOut();
  };

  const signIn = () => {
    setOpen(false);
    onSignIn();
  };

  const Avatar = () => (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-400 text-sm font-extrabold text-white shadow-sm">
      {initial}
    </span>
  );

  const ProfileBadge = ({ compact = false }: { compact?: boolean }) =>
    user ? (
      <div
        className={`flex min-w-0 items-center gap-3 rounded-2xl border border-white/75 bg-white/55 ${
          compact ? 'px-3 py-2.5' : 'p-2.5'
        }`}
      >
        <Avatar />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[#18181B]">{user.email}</span>
          <span className="block text-[11px] font-semibold text-violet-600">{roleLabel}</span>
        </span>
      </div>
    ) : null;

  const authButtonCls =
    'inline-flex items-center justify-center gap-2 rounded-full bg-[#18181B] text-xs font-bold text-white transition hover:opacity-90';

  const shellVars = {
    '--shell-pad': collapsed ? '7rem' : '18.5rem',
  } as CSSProperties;

  return (
    <ScannerSlugContext.Provider value={setScannerSlug}>
      <div className="pastel-mesh-bg min-h-screen">
        {/* Scroll progress bar */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-white/30 backdrop-blur-sm"
        >
          <motion.div
            style={{ scaleX: progress }}
            className="h-full origin-left rounded-r-full bg-gradient-to-r from-violet-500 via-[#bbaeec] to-[#f0c9ef] shadow-[0_0_10px_rgba(139,92,246,0.55)]"
          />
        </div>

        {/* Desktop side rail */}
        <motion.aside
          aria-label="Sidebar"
          initial={false}
          animate={{ width: collapsed ? 80 : 256 }}
          transition={tween}
          className="liquid-glass fixed bottom-4 left-4 top-4 z-40 hidden flex-col overflow-hidden rounded-[28px] p-3 lg:flex"
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                aria-label="PassFlow home"
                title="PassFlow"
                onClick={() => navigateTo(homePath)}
                className="flex size-11 items-center justify-center rounded-2xl"
              >
                <img src="/passflow-logo.svg" alt="PassFlow" className="size-9 shrink-0" />
              </button>
              <button
                type="button"
                aria-label="Expand sidebar"
                aria-expanded={false}
                title="Expand sidebar"
                onClick={toggleCollapsed}
                className="flex size-9 items-center justify-center rounded-full bg-white/70 text-[#18181B] shadow-sm transition hover:bg-white"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="PassFlow home"
                onClick={() => navigateTo(homePath)}
                className="flex min-w-0 items-center gap-2.5 rounded-2xl px-1.5 py-1.5 text-left"
              >
                <img src="/passflow-logo.svg" alt="PassFlow" className="size-9 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold leading-tight tracking-tight text-[#18181B]">
                    PassFlow
                  </span>
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-[#18181B]/50">
                    {isAdmin ? 'Admin Console' : user ? 'Guest' : 'Events'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Collapse sidebar"
                aria-expanded
                title="Collapse sidebar"
                onClick={toggleCollapsed}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#18181B] shadow-sm transition hover:bg-white"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          )}

          <div className="my-4 h-px bg-[#18181B]/10" />

          <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-current={item.active ? 'page' : undefined}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                onClick={() => navigateTo(item.to)}
                className={`relative flex items-center rounded-2xl py-3 text-left text-sm font-bold transition-colors ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'
                } ${item.active ? 'text-violet-700' : 'text-[#18181B]/70 hover:bg-white/50'}`}
              >
                {item.active && (
                  <motion.span
                    layoutId="app-shell-active-pill-desktop"
                    transition={spring}
                    className="absolute inset-0 rounded-2xl border border-white/80 bg-white/85 shadow-sm"
                  />
                )}
                <item.Icon size={18} className="relative z-10 shrink-0" />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.12, duration: 0.15 }}
                    className="relative z-10 min-w-0 truncate whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            ))}
          </nav>

          <div
            className={`mt-4 flex flex-col gap-2.5 border-t border-[#18181B]/10 pt-4 ${
              collapsed ? 'items-center' : ''
            }`}
          >
            {user &&
              (collapsed ? (
                <span title={`${user.email} · ${roleLabel}`}>
                  <Avatar />
                </span>
              ) : (
                <ProfileBadge />
              ))}
            {user ? (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign Out"
                title={collapsed ? 'Sign Out' : undefined}
                className={`${authButtonCls} ${collapsed ? 'size-11' : 'w-full px-4 py-3'}`}
              >
                <LogOut size={collapsed ? 16 : 14} />
                {!collapsed && 'Sign Out'}
              </button>
            ) : (
              <button
                type="button"
                onClick={signIn}
                aria-label="Sign In"
                title={collapsed ? 'Sign In' : undefined}
                className={`${authButtonCls} ${collapsed ? 'size-11' : 'w-full px-4 py-3'}`}
              >
                <LogIn size={collapsed ? 16 : 14} />
                {!collapsed && 'Sign In'}
              </button>
            )}
          </div>
        </motion.aside>

        {/* Mobile & tablet header */}
        <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4 lg:hidden">
          <div className="relative mx-auto max-w-6xl">
            <div className="liquid-glass flex min-w-0 items-center justify-between gap-3 rounded-full py-2 pl-3 pr-2">
              <button
                type="button"
                aria-label="PassFlow home"
                onClick={() => navigateTo(homePath)}
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
                    key="app-shell-backdrop"
                    type="button"
                    aria-label="Close menu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 -z-10 cursor-default bg-[#18181B]/10 backdrop-blur-[2px]"
                  />
                  <motion.div
                    key="app-shell-drawer"
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
                              layoutId="app-shell-active-pill-mobile"
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
                      {user ? (
                        <button
                          type="button"
                          onClick={signOut}
                          className={`${authButtonCls} w-full px-4 py-3`}
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={signIn}
                          className={`${authButtonCls} w-full px-4 py-3`}
                        >
                          <LogIn size={14} />
                          Sign In
                        </button>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Layout slot */}
        <main
          style={shellVars}
          className="min-w-0 px-3 pb-8 pt-20 sm:px-4 lg:pb-6 lg:pl-(--shell-pad) lg:pr-4 lg:pt-4 lg:transition-[padding-left] lg:duration-300"
        >
          {children}
        </main>

        {/* Back to top */}
        <AnimatePresence>
          {showTop && (
            <motion.button
              key="app-shell-back-to-top"
              type="button"
              aria-label="Back to top"
              title="Back to top"
              initial={{ opacity: 0, y: 16, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.8 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="liquid-glass fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full text-violet-700"
            >
              <ArrowUp size={20} className="relative z-10" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </ScannerSlugContext.Provider>
  );
}