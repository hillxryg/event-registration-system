import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  MapPin,
  Search,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Attendee, EventItem, RegistrationStatus, UserProfile } from '../types/database';
import { supabase } from '../lib/supabase';

const ticketStorageKey = (eventId: string) => `passflow_ticket_${eventId}`;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const EVENT_COLUMNS =
  'id, slug, title, description, event_date, venue, visibility, status, created_at';

function goTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function readStoredTicketId(eventId: string): string | null {
  try {
    return window.localStorage.getItem(ticketStorageKey(eventId));
  } catch {
    return null;
  }
}

const REG_STATUS_META: Record<
  RegistrationStatus,
  { label: string; badge: string; Icon: LucideIcon }
> = {
  approved: {
    label: 'Registered · Approved',
    badge: 'bg-emerald-100/90 text-emerald-700',
    Icon: CheckCircle2,
  },
  pending: { label: 'Pending Approval', badge: 'bg-amber-100/90 text-amber-700', Icon: Clock },
  declined: { label: 'Declined', badge: 'bg-rose-100/90 text-rose-700', Icon: XCircle },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-200/80 text-slate-600', Icon: XCircle },
};

function formatEventDate(iso: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

interface PublicEventsPageProps {
  viewer?: UserProfile | null;
  /** Render inside AdminShell (drops the standalone background and top padding). */
  embedded?: boolean;
}

export default function PublicEventsPage({ viewer = null, embedded = false }: PublicEventsPageProps) {
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myRegs, setMyRegs] = useState<Record<string, Attendee>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setDirectoryLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('status', 'active')
        .eq('visibility', 'public')
        .order('event_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoadError('We couldn’t load upcoming events. Please try again.');
        setDirectoryLoading(false);
        return;
      }
      const list = (data ?? []) as EventItem[];
      setPublicEvents(list);
      setDirectoryLoading(false);

      if (list.length === 0) {
        setMyRegs({});
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      const regMap: Record<string, Attendee> = {};

      // 1. Check persisted localStorage ticket IDs for returning unauthenticated guests
      const storedIds = list
        .map((e) => readStoredTicketId(e.id))
        .filter((id): id is string => Boolean(id));
      if (storedIds.length > 0) {
        const { data: storedRegs } = await supabase
          .from('attendees')
          .select('*')
          .in('id', storedIds);
        if (cancelled) return;
        for (const r of (storedRegs ?? []) as Attendee[]) {
          regMap[r.event_id] = r;
        }
      }

      // 2. Override/fill with signed-in user's email matches
      if (user?.email) {
        const { data: regs } = await supabase
          .from('attendees')
          .select('*')
          .ilike('email', escapeLike(user.email))
          .in('event_id', list.map((e) => e.id));
        if (cancelled) return;
        for (const r of (regs ?? []) as Attendee[]) {
          regMap[r.event_id] = r;
        }
      }

      setMyRegs(regMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [viewer?.id]);

  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return publicEvents;
    return publicEvents.filter((ev) =>
      `${ev.title} ${ev.venue} ${ev.description ?? ''}`.toLowerCase().includes(q),
    );
  }, [publicEvents, query]);

  const shell = embedded
    ? 'min-w-0 pb-4'
    : 'pastel-mesh-bg min-h-screen px-4 pb-10 pt-24 sm:px-6 lg:px-10 lg:pb-16';

  return (
    <div className={shell}>
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/45 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#18181B]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl">
            <Globe size={12} />
            Public Events
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#18181B] sm:text-4xl lg:text-5xl">
            Upcoming Public Events
          </h1>
          <p className="mt-2 max-w-xl text-base font-medium text-[#18181B]/65">
            Choose an event to reserve your spot and get your QR pass.
          </p>
        </motion.header>

        {!directoryLoading && !loadError && publicEvents.length > 0 && (
          <div className="relative mb-6 max-w-md">
            <span className="pointer-events-none absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#18181B] shadow-[0_4px_10px_-2px_rgba(24,24,27,0.18),inset_0_1px_1px_rgba(255,255,255,1)]">
              <Search size={18} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events or venues"
              aria-label="Search public events"
              className="liquid-pill-input pl-14"
            />
          </div>
        )}

        {directoryLoading ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <Loader2 size={28} className="animate-spin text-[#18181B]/70" />
            <p className="text-sm font-semibold text-[#18181B]/70">Loading events…</p>
          </div>
        ) : loadError ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <AlertCircle size={28} className="text-rose-600" />
            <p className="text-sm font-semibold text-[#18181B]/80">{loadError}</p>
          </div>
        ) : publicEvents.length === 0 ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <CalendarDays size={28} className="text-[#18181B]/60" />
            <p className="text-sm font-semibold text-[#18181B]/70">
              No public events are open for registration right now.
            </p>
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <Search size={28} className="text-[#18181B]/60" />
            <p className="text-sm font-semibold text-[#18181B]/70">
              No events match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((ev, i) => {
              const d = formatEventDate(ev.event_date);
              const reg = myRegs[ev.id];
              const regMeta = reg ? REG_STATUS_META[reg.status] : null;
              return (
                <motion.button
                  key={ev.id}
                  type="button"
                  onClick={() => goTo(`/register/${ev.slug}`)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="liquid-glass group flex min-w-0 flex-col overflow-hidden p-6 text-left"
                >
                  {regMeta && (
                    <span
                      className={`mb-3 inline-flex max-w-full items-center gap-1.5 self-start rounded-full px-3 py-1 text-[11px] font-bold ${regMeta.badge}`}
                    >
                      <regMeta.Icon size={12} className="shrink-0" />
                      <span className="truncate">{regMeta.label}</span>
                    </span>
                  )}
                  <h2 className="break-words text-xl font-extrabold leading-tight tracking-tight text-[#18181B]">
                    {ev.title}
                  </h2>
                  {ev.description && (
                    <p className="mt-2 line-clamp-2 break-words text-sm font-medium text-[#18181B]/60">
                      {ev.description}
                    </p>
                  )}
                  <div className="mt-5 space-y-2.5 text-sm font-semibold text-[#18181B]/75">
                    <p className="flex min-w-0 items-center gap-2.5">
                      <CalendarDays size={16} className="shrink-0 text-violet-600" />
                      <span className="min-w-0 break-words">
                        {d.day} · {d.time}
                      </span>
                    </p>
                    <p className="flex min-w-0 items-center gap-2.5">
                      <MapPin size={16} className="shrink-0 text-violet-600" />
                      <span className="min-w-0 truncate">{ev.venue}</span>
                    </p>
                  </div>
                  <span className="liquid-btn-primary mt-6 inline-flex w-full items-center justify-center gap-1.5 px-5 text-sm sm:w-auto sm:self-start">
                    {reg ? 'View My Pass' : 'Register'}
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}