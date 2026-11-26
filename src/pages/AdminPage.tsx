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
  ChevronDown,
  Menu,
  ScanLine,
  Ticket,
  ShieldCheck,
} from 'lucide-react';
import type { UserProfile, EventItem, Attendee } from '../types/database';
import { supabase } from '../lib/supabase';

interface AdminPageProps {
  user: UserProfile;
  onSignOut: () => void;
}

type Filter = 'all' | 'checked_in' | 'pending';

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

interface EventDropdownProps {
  events: EventItem[];
  selectedId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  className?: string;
}

function EventDropdown({ events, selectedId, loading, onSelect, className = '' }: EventDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = events.find((e) => e.id === selectedId);

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
        <span className="min-w-0 flex-1 truncate text-left">
          {loading ? 'Loading events…' : (selected?.title ?? 'No events yet')}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-slate-500">
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Events"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="liquid-glass absolute left-0 top-full z-40 mt-2 max-h-72 w-[calc(100vw-3.5rem)] max-w-xs overflow-y-auto rounded-2xl border border-white/80 bg-white/80 p-1.5 shadow-xl backdrop-blur-2xl md:w-80 md:max-w-none"
          >
            {events.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-slate-500">No events yet.</p>
            )}
            {events.map((e) => {
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
                  {active && <Check size={16} className="shrink-0 text-violet-600" />}
                </button>
              );
            })}
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
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', venue: '', date: '', pin: '' });

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
        setEventId(list[0]?.id ?? '');
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
  const pending = total - checked;
  const pct = total ? Math.round((checked / total) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((a) => {
      if (filter === 'checked_in' && !a.checked_in) return false;
      if (filter === 'pending' && a.checked_in) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.organization, a.ticket_code].some((f) =>
        f.toLowerCase().includes(q),
      );
    });
  }, [attendees, query, filter]);

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
    if (!form.title.trim() || !form.venue.trim() || !form.date || creating) return;
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
        scanner_pin: form.pin || '1234',
        is_active: true,
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
    setForm({ title: '', venue: '', date: '', pin: '' });
    setModalOpen(false);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'checked_in', label: 'Checked In' },
    { key: 'pending', label: 'Pending' },
  ];

  return (
    <div className="pastel-mesh-bg min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header */}
        <header className="liquid-glass relative z-30 rounded-3xl p-3 overflow-visible! sm:p-4">
          <div className="flex items-center gap-3">
            {/* Admin badge (desktop) */}
            <div className="hidden items-center gap-2 rounded-full bg-white/60 py-1 pl-1 pr-4 text-sm text-slate-700 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white">
                <ShieldCheck size={16} />
              </span>
              <span className="max-w-[180px] truncate">{user.full_name ?? user.email}</span>
            </div>

            <EventDropdown
              events={events}
              selectedId={eventId}
              loading={loading}
              onSelect={setEventId}
              className="min-w-0 flex-1 md:w-64 md:flex-none"
            />

            {/* Desktop actions */}
            <button
              onClick={() => setModalOpen(true)}
              className="liquid-btn-primary hidden items-center gap-1.5 md:flex"
            >
              <Plus size={16} /> New Event
            </button>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              <a
                href={registerPath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(registerPath);
                }}
                className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <Ticket size={14} /> Register
              </a>
              <a
                href={scannerPath}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(scannerPath);
                }}
                className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <ScanLine size={14} /> Scanner
              </a>
              <button
                onClick={onSignOut}
                className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>

            {/* Hamburger (< md) */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-drawer"
              className="liquid-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 md:hidden"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {/* Mobile drawer */}
          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                id="admin-mobile-drawer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden md:hidden"
              >
                <div className="liquid-glass mt-3 flex flex-col gap-2 rounded-2xl p-3">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setModalOpen(true);
                    }}
                    className="liquid-btn-primary flex w-full items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> New Event
                  </button>
                  <a
                    href={registerPath}
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      navigate(registerPath);
                    }}
                    className="liquid-glass flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-slate-700"
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
                    className="liquid-glass flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-slate-700"
                  >
                    <ScanLine size={14} /> Scanner Link
                  </a>
                  <div className="flex items-center gap-2 rounded-full bg-white/60 py-1 pl-1 pr-4 text-sm text-slate-700">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                      <ShieldCheck size={16} />
                    </span>
                    <span className="min-w-0 truncate">{user.full_name ?? user.email}</span>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="liquid-glass flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-slate-700"
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
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div className="relative w-full md:min-w-[220px] md:flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, organization, ticket code"
                className="liquid-pill-input w-full pl-11"
              />
            </div>

            <div className="liquid-glass relative grid w-full grid-cols-3 rounded-full p-1 md:flex md:w-auto">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="relative z-10 rounded-full px-3 py-1.5 text-center text-sm font-medium sm:px-4"
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
              className="liquid-glass flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700 disabled:opacity-50 md:w-auto"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Attendee</th>
                  <th className="px-3 py-2">Organization</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Ticket</th>
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
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          a.checked_in
                            ? 'bg-emerald-100/90 text-emerald-700'
                            : 'bg-amber-100/90 text-amber-700'
                        }`}
                      >
                        {a.checked_in ? 'Checked In' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => toggleCheckIn(a.id)}
                        className="rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
                      >
                        {a.checked_in ? 'Undo' : 'Check In'}
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.form
              onSubmit={createEvent}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              className="liquid-glass w-full max-w-md space-y-4 rounded-3xl p-6"
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
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="liquid-pill-input w-full"
                required
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