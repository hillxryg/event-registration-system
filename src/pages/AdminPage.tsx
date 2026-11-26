import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut,
  Plus,
  Search,
  Download,
  Users,
  UserCheck,
  Clock,
  X,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  ChevronDown,
  Menu,
  SlidersHorizontal,
  ScanLine,
  Ticket,
  ShieldCheck,
} from 'lucide-react';
import type {
  UserProfile,
  EventItem,
  Attendee,
  EventVisibility,
  EventStatus,
  RegistrationStatus,
} from '../types/database';
import { supabase } from '../lib/supabase';

interface AdminPageProps {
  user: UserProfile;
  onSignOut: () => void;
}

type Filter = 'all' | 'pending_approval' | 'checked_in' | 'pending';

const REG_STATUS_UI: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending Approval', cls: 'bg-amber-100/90 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100/90 text-emerald-700' },
  declined: { label: 'Declined', cls: 'bg-rose-100/90 text-rose-700' },
};

const EVENT_STATUSES: EventStatus[] = ['active', 'closed', 'cancelled'];

const EVENT_STATUS_UI: Record<EventStatus, { label: string; dot: string; cls: string }> = {
  active: { label: 'Active', dot: 'bg-emerald-500', cls: 'bg-emerald-100/90 text-emerald-700' },
  closed: { label: 'Closed', dot: 'bg-amber-500', cls: 'bg-amber-100/90 text-amber-700' },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-500', cls: 'bg-rose-100/90 text-rose-700' },
};

function EventStatusBadge({ status }: { status: EventStatus }) {
  const ui = EVENT_STATUS_UI[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ui.cls}`}
    >
      <span className={`size-1.5 rounded-full ${ui.dot}`} />
      {ui.label}
    </span>
  );
}

function EventStatusControl({
  status,
  updating,
  onChange,
}: {
  status: EventStatus;
  updating: boolean;
  onChange: (s: EventStatus) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Event status"
      className="liquid-glass relative inline-flex rounded-full p-1"
    >
      {EVENT_STATUSES.map((s) => {
        const on = status === s;
        const ui = EVENT_STATUS_UI[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={updating}
            onClick={() => onChange(s)}
            className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-60"
          >
            {on && (
              <motion.span
                layoutId="event-status-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 -z-10 rounded-full bg-white/80 shadow"
              />
            )}
            <span className={`size-1.5 rounded-full ${ui.dot}`} />
            <span className={on ? 'text-violet-600' : 'text-slate-600'}>{ui.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type StatusTab = EventStatus | 'all';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const exclusive = visibility === 'exclusive';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        exclusive ? 'bg-amber-100/90 text-amber-700' : 'bg-violet-100/90 text-violet-700'
      }`}
    >
      {exclusive ? 'Exclusive' : 'Public'}
    </span>
  );
}

const navigate = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

const formatEventMeta = (e: EventItem) =>
  `${new Date(e.event_date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${e.venue}`;

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocal = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3], h: +m[4], min: +m[5] };
};

type PickedDate = { y: number; m: number; d: number };
type PickedTime = { hour: number; minute: number; pm: boolean };

const pillCls = (active: boolean) =>
  `rounded-full px-2 py-1 text-xs font-medium transition ${
    active ? 'bg-violet-500 text-white shadow' : 'bg-white/60 text-slate-700 hover:bg-white'
  }`;

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseLocal(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(
    () => new Date(parsed?.y ?? today.getFullYear(), parsed?.m ?? today.getMonth(), 1),
  );
  const [dateSel, setDateSel] = useState<PickedDate | null>(
    parsed ? { y: parsed.y, m: parsed.m, d: parsed.d } : null,
  );
  const [time, setTime] = useState<PickedTime>(
    parsed
      ? { hour: parsed.h % 12 || 12, minute: parsed.min, pm: parsed.h >= 12 }
      : { hour: 6, minute: 0, pm: true },
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const emit = (d: PickedDate | null, t: PickedTime) => {
    if (!d) return;
    const h24 = (t.hour % 12) + (t.pm ? 12 : 0);
    onChange(`${d.y}-${pad(d.m + 1)}-${pad(d.d)}T${pad(h24)}:${pad(t.minute)}`);
  };

  const pickDate = (d: number) => {
    const next = { y: view.getFullYear(), m: view.getMonth(), d };
    setDateSel(next);
    emit(next, time);
  };

  const pickTime = (patch: Partial<PickedTime>) => {
    const next = { ...time, ...patch };
    setTime(next);
    emit(dateSel, next);
  };

  const firstDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const canGoPrev =
    view.getFullYear() > today.getFullYear() ||
    (view.getFullYear() === today.getFullYear() && view.getMonth() > today.getMonth());

  const label = parsed
    ? new Date(parsed.y, parsed.m, parsed.d, parsed.h, parsed.min).toLocaleString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Select date & time';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="liquid-pill-input flex w-full items-center gap-2 text-left"
      >
        <Calendar size={16} className="shrink-0 text-violet-500" />
        <span className={`min-w-0 flex-1 truncate ${parsed ? 'text-slate-800' : 'text-slate-500'}`}>
          {label}
        </span>
        <Clock size={16} className="shrink-0 text-slate-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Choose date and time"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="mt-2 max-h-[min(65dvh,25rem)] space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-2xl"
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-600 transition hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <p className="text-sm font-semibold text-slate-800">
                {view.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-600 transition hover:bg-white"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Day grid */}
            <div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">
                {WEEKDAYS.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                  if (d === null) return <span key={`blank-${i}`} />;
                  const past = new Date(view.getFullYear(), view.getMonth(), d) < startOfToday;
                  const selected =
                    dateSel?.y === view.getFullYear() &&
                    dateSel?.m === view.getMonth() &&
                    dateSel?.d === d;
                  const isToday =
                    startOfToday.getFullYear() === view.getFullYear() &&
                    startOfToday.getMonth() === view.getMonth() &&
                    startOfToday.getDate() === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={past}
                      onClick={() => pickDate(d)}
                      className={`h-8 rounded-full text-xs font-medium transition disabled:text-slate-300 disabled:hover:bg-transparent ${
                        selected
                          ? 'bg-violet-500 text-white shadow'
                          : isToday
                            ? 'text-violet-600 ring-1 ring-violet-300 hover:bg-white'
                            : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time selectors */}
            <div className="space-y-2.5 border-t border-slate-200/70 pt-2.5">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <Clock size={11} /> Hour
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => pickTime({ hour: h })}
                      className={pillCls(time.hour === h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Minute
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pickTime({ minute: m })}
                      className={pillCls(time.minute === m)}
                    >
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="grid flex-1 grid-cols-2 gap-1">
                  {(['AM', 'PM'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => pickTime({ pm: p === 'PM' })}
                      className={pillCls(time.pm === (p === 'PM'))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="liquid-btn-primary h-9 whitespace-nowrap px-5 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EventDropdownProps {
  events: EventItem[];
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  className?: string;
}

function EventDropdown({ events, selectedId, loading, onSelect, className = '' }: EventDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = events.find((e) => e.id === selectedId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (statusTab !== 'all' && e.status !== statusTab) return false;
      if (!q) return true;
      return [e.title, e.venue, e.slug].some((f) => f.toLowerCase().includes(q));
    });
  }, [events, search, statusTab]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch event"
        className="liquid-glass flex w-full items-center gap-2 rounded-full py-2 pl-4 pr-3 text-sm font-medium text-slate-700 transition hover:bg-white/60"
      >
        {selected && (
          <span
            className={`size-2 shrink-0 rounded-full ${EVENT_STATUS_UI[selected.status].dot}`}
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {loading ? 'Loading events…' : (selected?.title ?? 'No events yet')}
        </span>
        {selected && <VisibilityBadge visibility={selected.visibility} />}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-slate-500">
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="liquid-glass absolute left-0 top-full z-40 mt-2 max-h-80 w-[calc(100vw-3.5rem)] max-w-xs overflow-y-auto rounded-2xl border border-white/80 bg-white/80 p-1.5 shadow-xl backdrop-blur-2xl sm:w-80 sm:max-w-none"
          >
            {/* Sticky search + status tabs */}
            <div className="sticky top-0 z-10 -mx-1.5 -mt-1.5 mb-1 space-y-2 rounded-t-2xl bg-white/90 p-2.5 backdrop-blur-xl">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events…"
                  aria-label="Search events"
                  className="liquid-pill-input w-full py-2 pl-9 text-sm"
                />
              </div>
              <div role="tablist" aria-label="Filter events by status" className="grid grid-cols-4 gap-1">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={statusTab === t.key}
                    onClick={() => setStatusTab(t.key)}
                    className={pillCls(statusTab === t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div role="listbox" aria-label="Events">
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate-500">
                  {events.length === 0 ? 'No events yet.' : 'No events match.'}
                </p>
              )}
              {filtered.map((e) => {
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(e.id);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/80 ${
                      active ? 'bg-white/70' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{e.title}</span>
                      <span className="block truncate text-xs text-slate-500">{formatEventMeta(e)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <EventStatusBadge status={e.status} />
                      <VisibilityBadge visibility={e.visibility} />
                    </span>
                    {active && <Check size={16} className="shrink-0 text-violet-600" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminPage({ user, onSignOut }: AdminPageProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    venue: string;
    date: string;
    pin: string;
    visibility: EventVisibility;
  }>({ title: '', venue: '', date: '', pin: '', visibility: 'public' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        const list = (data ?? []) as EventItem[];
        setEvents(list);
        setEventId((list.find((e) => e.status === 'active') ?? list[0])?.id ?? '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!eventId) {
      setAttendees([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setAttendees((data ?? []) as Attendee[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const event: EventItem | undefined = events.find((e) => e.id === eventId) ?? events[0];
  const registerPath = event ? `/register/${event.slug}` : '/register';
  const scannerPath = event ? `/scanner/${event.slug}` : '/scanner';

  const total = attendees.length;
  const checked = attendees.filter((a) => a.checked_in).length;
  const pending = attendees.filter((a) => a.status === 'approved' && !a.checked_in).length;
  const pct = total ? Math.round((checked / total) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((a) => {
      if (filter === 'pending_approval' && a.status !== 'pending') return false;
      if (filter === 'checked_in' && !a.checked_in) return false;
      if (filter === 'pending' && (a.checked_in || a.status !== 'approved')) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.organization, a.ticket_code].some((f) =>
        f.toLowerCase().includes(q),
      );
    });
  }, [attendees, query, filter]);

  const updateEventStatus = async (status: EventStatus) => {
    if (!event || event.status === status || statusUpdating) return;
    setStatusUpdating(true);
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id);
    setStatusUpdating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status } : e)));
  };

  const updateRegistrationStatus = async (id: string, status: RegistrationStatus) => {
    const { error } = await supabase.from('attendees').update({ status }).eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    if (status === 'approved') {
      // TODO: Phase 4 — trigger send-ticket-email Edge Function on approve
    }
  };

  const copyInviteLink = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/register/${event.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the invite link to your clipboard.');
    }
  };

  const toggleCheckIn = async (id: string) => {
    const target = attendees.find((a) => a.id === id);
    if (!target) return;
    const nextState = !target.checked_in;
    const checkedInAt = nextState ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('attendees')
      .update({ checked_in: nextState, checked_in_at: checkedInAt })
      .eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, checked_in: nextState, checked_in_at: checkedInAt } : a,
      ),
    );
  };

  const exportCsv = () => {
    const header = [
      'ticket_code',
      'full_name',
      'email',
      'organization',
      'contact_number',
      'registration_status',
      'checked_in',
      'checked_in_at',
    ];
    const rows = visible.map((a) =>
      [
        a.ticket_code,
        a.full_name,
        a.email,
        a.organization,
        a.contact_number,
        a.status,
        String(a.checked_in),
        a.checked_in_at ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event?.slug ?? 'event'}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createEvent = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!form.date) {
      setFormError('Pick a date and time for the event.');
      return;
    }
    if (!form.title.trim() || !form.venue.trim() || creating) return;
    if (form.pin && form.pin.length !== 4) {
      setFormError('Scanner PIN must be exactly 4 digits.');
      return;
    }
    setCreating(true);
    setFormError(null);
    const slug = form.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const { data, error } = await supabase
      .from('events')
      .insert({
        slug,
        title: form.title.trim(),
        description: null,
        event_date: new Date(form.date).toISOString(),
        venue: form.venue.trim(),
        visibility: form.visibility,
        scanner_pin: form.pin || '1234',
        status: 'active',
      })
      .select('*')
      .single();
    setCreating(false);
    if (error || !data) {
      setFormError(
        error?.code === '23505'
          ? 'An event with a similar title already exists. Try a different title.'
          : (error?.message ?? 'Could not create event.'),
      );
      return;
    }
    const created = data as EventItem;
    setEvents((prev) =>
      [...prev, created].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    );
    setEventId(created.id);
    setForm({ title: '', venue: '', date: '', pin: '', visibility: 'public' });
    setModalOpen(false);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending_approval', label: 'Needs Approval' },
    { key: 'checked_in', label: 'Checked In' },
    { key: 'pending', label: 'Pending Check-In' },
  ];

  const activeFilterLabel = filters.find((f) => f.key === filter)?.label ?? 'All';

  return (
    <div className="pastel-mesh-bg min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header */}
        <header className="liquid-glass relative z-30 rounded-3xl p-3 overflow-visible! sm:p-4">
          <div className="flex items-center gap-3">
            {/* Admin badge (desktop) */}
            <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/60 py-1 pl-1 pr-4 text-sm text-slate-700 lg:flex">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                <ShieldCheck size={16} />
              </span>
              <span className="max-w-[180px] truncate">{user.full_name ?? user.email}</span>
            </div>

            <EventDropdown
              events={events}
              selectedId={eventId}
              loading={loading}
              onSelect={setEventId}
              className="min-w-0 flex-1 lg:w-64 lg:flex-none"
            />

            {/* Desktop actions */}
            <button
              onClick={() => setModalOpen(true)}
              className="liquid-btn-primary hidden shrink-0 items-center gap-1.5 whitespace-nowrap lg:flex"
            >
              <Plus size={16} /> New Event
            </button>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={copyInviteLink}
                disabled={!event}
                className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={registerPath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(registerPath);
                }}
                className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <Ticket size={14} /> Register
              </a>
              <a
                href={scannerPath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(scannerPath);
                }}
                className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <ScanLine size={14} /> Scanner
              </a>
              <button
                onClick={onSignOut}
                className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>

            {/* Hamburger (< lg) */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-drawer"
              className="liquid-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 lg:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {/* Event status sub-bar */}
          {event && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/40 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Event status
              </span>
              <EventStatusControl
                status={event.status}
                updating={statusUpdating}
                onChange={updateEventStatus}
              />
            </div>
          )}

          {/* Mobile drawer */}
          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                id="admin-mobile-drawer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden lg:hidden"
              >
                <div className="liquid-glass mt-3 flex flex-col gap-2 rounded-2xl p-3">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setModalOpen(true);
                    }}
                    className="liquid-btn-primary flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus size={16} /> New Event
                  </button>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    disabled={!event}
                    className="liquid-glass flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-slate-700 disabled:opacity-50"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={registerPath}
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      navigate(registerPath);
                    }}
                    className="liquid-glass flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-slate-700"
                  >
                    <Ticket size={14} /> Register Link
                  </a>
                  <a
                    href={scannerPath}
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      navigate(scannerPath);
                    }}
                    className="liquid-glass flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-slate-700"
                  >
                    <ScanLine size={14} /> Scanner Link
                  </a>
                  <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/60 py-1 pl-1 pr-4 text-sm text-slate-700">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                      <ShieldCheck size={16} />
                    </span>
                    <span className="min-w-0 truncate">{user.full_name ?? user.email}</span>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="liquid-glass flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-slate-700"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {error && (
          <div
            role="alert"
            className="liquid-glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-rose-600"
          >
            <span className="min-w-0 break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="shrink-0 rounded-full bg-white/60 p-1.5 text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex items-center justify-between text-sm text-slate-600">
              Total Registered <Users size={18} className="text-violet-500" />
            </div>
            <p className="mt-3 text-4xl font-semibold text-slate-800">{total}</p>
          </div>

          <div className="liquid-glass-dark rounded-3xl p-6 text-white">
            <div className="flex items-center justify-between text-sm text-white/70">
              Checked In <UserCheck size={18} className="text-emerald-300" />
            </div>
            <p className="mt-3 text-4xl font-semibold">
              {checked}
              <span className="ml-2 text-base font-normal text-white/60">{pct}%</span>
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-emerald-300"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex items-center justify-between text-sm text-slate-600">
              Pending Check-In <Clock size={18} className="text-amber-500" />
            </div>
            <p className="mt-3 text-4xl font-semibold text-slate-800">{pending}</p>
          </div>
        </div>

        {/* Attendee management */}
        <section className="liquid-glass rounded-3xl p-4 sm:p-5">
          {/* Search + Desktop filters / Mobile filter hamburger */}
          <div className="flex items-center gap-2 lg:flex-wrap">
            <div className="relative min-w-0 flex-1 lg:min-w-[240px]">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search attendee, email, or ticket…"
                className="liquid-pill-input w-full pl-11"
              />
            </div>

            {/* Mobile filter menu button (< lg) */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen((o) => !o)}
              aria-label={filterDrawerOpen ? 'Close filter options' : 'Open filter options'}
              aria-expanded={filterDrawerOpen}
              aria-controls="attendee-filter-drawer"
              className="liquid-glass relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium text-slate-700 lg:hidden"
            >
              {filterDrawerOpen ? <X size={17} /> : <SlidersHorizontal size={17} />}
              <span className="hidden sm:inline">{activeFilterLabel}</span>
              {filter !== 'all' && (
                <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
              )}
            </button>

            {/* Desktop inline filter tabs & export (>= lg) */}
            <div className="liquid-glass relative hidden rounded-full p-1 lg:flex">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="relative z-10 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium"
                >
                  {filter === f.key && (
                    <motion.span
                      layoutId="admin-filter"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 -z-10 rounded-full bg-white/80 shadow"
                    />
                  )}
                  <span className={filter === f.key ? 'text-violet-600' : 'text-slate-600'}>
                    {f.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={exportCsv}
              disabled={!event}
              className="liquid-glass hidden shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700 disabled:opacity-50 lg:flex"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Collapsible mobile filter & export drawer (< lg) */}
          <AnimatePresence initial={false}>
            {filterDrawerOpen && (
              <motion.div
                id="attendee-filter-drawer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden lg:hidden"
              >
                <div className="liquid-glass mt-3 space-y-2.5 rounded-2xl p-3">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Filter Status
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {filters.map((f) => {
                      const active = filter === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => {
                            setFilter(f.key);
                            setFilterDrawerOpen(false);
                          }}
                          className={`rounded-full px-3 py-2 text-center text-xs font-semibold transition ${
                            active
                              ? 'bg-violet-500 text-white shadow'
                              : 'bg-white/60 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportCsv();
                      setFilterDrawerOpen(false);
                    }}
                    disabled={!event}
                    className="liquid-glass flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Attendee</th>
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Registration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id} className="border-t border-white/40 text-slate-700">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{a.full_name}</p>
                      <p className="text-xs text-slate-500">{a.email}</p>
                    </td>
                    <td className="px-3 py-3">{a.organization}</td>
                    <td className="px-3 py-3">{a.contact_number}</td>
                    <td className="px-3 py-3 font-mono text-xs">{a.ticket_code}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${REG_STATUS_UI[a.status].cls}`}
                      >
                        {REG_STATUS_UI[a.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {a.status === 'approved' ? (
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                            a.checked_in
                              ? 'bg-emerald-100/90 text-emerald-700'
                              : 'bg-amber-100/90 text-amber-700'
                          }`}
                        >
                          {a.checked_in ? 'Checked In' : 'Pending'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {a.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => updateRegistrationStatus(a.id, 'approved')}
                            className="whitespace-nowrap rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateRegistrationStatus(a.id, 'declined')}
                            className="whitespace-nowrap rounded-full bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600"
                          >
                            Decline
                          </button>
                        </div>
                      ) : a.status === 'approved' ? (
                        <button
                          onClick={() => toggleCheckIn(a.id)}
                          className="whitespace-nowrap rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
                        >
                          {a.checked_in ? 'Undo' : 'Check In'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                      {loading ? 'Loading…' : 'No attendees match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* New Event modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              onSubmit={createEvent}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              className="liquid-glass my-auto w-full max-w-md space-y-4 overflow-visible! rounded-3xl p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">New Event</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close"
                  className="rounded-full bg-white/60 p-2 text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Event title"
                className="liquid-pill-input w-full"
                required
              />
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Venue"
                className="liquid-pill-input w-full"
                required
              />
              <DateTimePicker
                value={form.date}
                onChange={(date) => setForm((f) => ({ ...f, date }))}
              />
              <input
                value={form.pin}
                onChange={(e) =>
                  setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                placeholder="4-digit scanner PIN"
                inputMode="numeric"
                className="liquid-pill-input w-full"
              />
              <div
                role="radiogroup"
                aria-label="Event visibility"
                className="liquid-glass grid grid-cols-2 gap-1 rounded-2xl p-1"
              >
                {(
                  [
                    { key: 'public', title: 'Public', hint: 'Anyone can join' },
                    { key: 'exclusive', title: 'Exclusive', hint: 'Requires admin approval' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={form.visibility === opt.key}
                    onClick={() => setForm({ ...form, visibility: opt.key })}
                    className="relative z-10 rounded-xl px-3 py-2 text-left"
                  >
                    {form.visibility === opt.key && (
                      <motion.span
                        layoutId="visibility-toggle"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 -z-10 rounded-xl bg-white/80 shadow"
                      />
                    )}
                    <span
                      className={`block text-sm font-semibold ${
                        form.visibility === opt.key ? 'text-violet-600' : 'text-slate-700'
                      }`}
                    >
                      {opt.title}
                    </span>
                    <span className="block text-xs text-slate-500">— {opt.hint}</span>
                  </button>
                ))}
              </div>
              {formError && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="liquid-btn-primary w-full disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create Event'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}