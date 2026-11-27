/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Globe,
  Plus,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  Attendee,
  EventItem,
  EventStatus,
  EventVisibility,
  RegistrationStatus,
  UserProfile,
} from '../types/database';
import { supabase } from '../lib/supabase';
import { useShellScannerSlug } from '../components/AppShell';
import ConfirmModal, { SuccessModal, type SuccessReceipt } from '../components/ConfirmModal';

interface AdminDashboardPageProps {
  profile: UserProfile;
  onSignOut: () => void | Promise<void>;
}

type FieldKey = 'title' | 'venue' | 'date' | 'pin';
type FieldErrors = Partial<Record<FieldKey, string>>;

const TZ = 'Asia/Manila';

const INVALID_INPUT =
  'border-rose-400/90 bg-rose-50/60 ring-2 ring-rose-400/35 text-rose-900 placeholder:text-rose-400';

const EVENT_STATUS_UI: Record<EventStatus, { label: string; dot: string; cls: string }> = {
  active: { label: 'Active', dot: 'bg-emerald-500', cls: 'bg-emerald-100/90 text-emerald-700' },
  closed: { label: 'Closed', dot: 'bg-amber-500', cls: 'bg-amber-100/90 text-amber-700' },
  cancelled: { label: 'Cancelled', dot: 'bg-rose-500', cls: 'bg-rose-100/90 text-rose-700' },
};

const REG_STATUS_UI: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100/90 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100/90 text-emerald-700' },
  declined: { label: 'Declined', cls: 'bg-rose-100/90 text-rose-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200/80 text-slate-600' },
};

const navigate = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocal = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3], h: +m[4], min: +m[5] };
};

const manilaDayKey = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

const formatManila = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatManilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  });

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  });
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 px-4 text-xs font-semibold text-rose-600">
      {message}
    </p>
  );
}

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

function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const exclusive = visibility === 'exclusive';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        exclusive ? 'bg-fuchsia-100/90 text-fuchsia-700' : 'bg-violet-100/90 text-violet-700'
      }`}
    >
      {exclusive ? <Lock size={9} /> : <Globe size={9} />}
      {exclusive ? 'Exclusive' : 'Public'}
    </span>
  );
}

/* ───────────────────────── Date & time picker ───────────────────────── */

type PickedDate = { y: number; m: number; d: number };
type PickedTime = { hour: number; minute: number; pm: boolean };

const pillCls = (active: boolean) =>
  `rounded-full px-2 py-1 text-xs font-medium transition ${
    active ? 'bg-violet-500 text-white shadow' : 'bg-white/60 text-slate-700 hover:bg-white'
  }`;

const PICKER_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function DateTimePicker({
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
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

  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const p = parseLocal(value);
    if (p) {
      setDateSel({ y: p.y, m: p.m, d: p.d });
      setTime({ hour: p.h % 12 || 12, minute: p.min, pm: p.h >= 12 });
      setView(new Date(p.y, p.m, 1));
    } else {
      const now = new Date();
      setDateSel(null);
      setTime({ hour: 6, minute: 0, pm: true });
      setView(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
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
    const next = `${d.y}-${pad(d.m + 1)}-${pad(d.d)}T${pad(h24)}:${pad(t.minute)}`;
    lastEmitted.current = next;
    onChange(next);
  };

  const pickDate = (d: number) => {
    const next = { y: view.getFullYear(), m: view.getMonth(), d };
    setDateSel(next);
    emit(next, time);
  };

  const pickTime = (patch: Partial<PickedTime>) => {
    const next = { ...time, ...patch };
    setTime(next);
    const base: PickedDate = dateSel ?? {
      y: startOfToday.getFullYear(),
      m: startOfToday.getMonth(),
      d: startOfToday.getDate(),
    };
    if (!dateSel) {
      setDateSel(base);
      setView(new Date(base.y, base.m, 1));
    }
    emit(base, next);
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
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`liquid-pill-input flex w-full items-center gap-2 text-left ${invalid ? INVALID_INPUT : ''}`}
      >
        <Calendar size={16} className="shrink-0 text-violet-500" />
        <span
          className={`min-w-0 flex-1 truncate ${
            parsed ? 'text-slate-800' : invalid ? 'text-rose-400' : 'text-slate-500'
          }`}
        >
          {label}
        </span>
        <Clock size={16} className={`shrink-0 ${invalid ? 'text-rose-400' : 'text-slate-400'}`} />
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

            <div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">
                {PICKER_WEEKDAYS.map((w, i) => (
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

/* ───────────────────────── Dashboard page ───────────────────────── */

const CAL_WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FEED_LIMIT = 8;

interface EventStats {
  approved: number;
  checkedIn: number;
  pending: number;
}

export default function AdminDashboardPage({ profile }: AdminDashboardPageProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [decision, setDecision] = useState<{
    attendee: Attendee;
    status: 'approved' | 'declined';
  } | null>(null);
  const [receipt, setReceipt] = useState<SuccessReceipt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<{
    title: string;
    venue: string;
    date: string;
    pin: string;
    visibility: EventVisibility;
  }>({ title: '', venue: '', date: '', pin: '', visibility: 'public' });

  const todayKey = manilaDayKey(new Date());
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(todayKey);

  /* Data loading */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [evRes, atRes] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('attendees').select('*').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (evRes.error) setError(evRes.error.message);
      else setEvents((evRes.data ?? []) as EventItem[]);
      if (atRes.error) setError(atRes.error.message);
      else setAttendees((atRes.data ?? []) as Attendee[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Modal helpers */
  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const openModal = () => {
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating) return;
    setFieldErrors({});
    setFormError(null);
    setModalOpen(false);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) {
        setFieldErrors({});
        setFormError(null);
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, creating]);

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.title.trim()) errors.title = 'Event title is required.';
    if (!form.venue.trim()) errors.venue = 'Venue is required.';
    if (!form.date || !parseLocal(form.date)) errors.date = 'Pick a date and time for the event.';
    if (!form.pin) errors.pin = 'Scanner PIN is required.';
    else if (!/^\d{4}$/.test(form.pin)) errors.pin = 'Scanner PIN must be exactly 4 digits.';
    return errors;
  };

  const createEvent = (ev: FormEvent) => {
    ev.preventDefault();
    if (creating) return;
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setFormError(null);
    setCreateConfirmOpen(true);
  };

  const confirmCreateEvent = async () => {
    if (creating) return;
    setCreating(true);
    setFormError(null);
    const slug = form.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        slug,
        title: form.title.trim(),
        description: null,
        event_date: new Date(form.date).toISOString(),
        venue: form.venue.trim(),
        visibility: form.visibility,
        scanner_pin: form.pin,
        status: 'active',
      })
      .select('*')
      .single();
    setCreating(false);
    setCreateConfirmOpen(false);
    if (insertError || !data) {
      setFormError(
        insertError?.code === '23505'
          ? 'An event with a similar title already exists. Try a different title.'
          : (insertError?.message ?? 'Could not create event.'),
      );
      return;
    }
    const created = data as EventItem;
    setEvents((prev) =>
      [...prev, created].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    );
    setForm({ title: '', venue: '', date: '', pin: '', visibility: 'public' });
    setFieldErrors({});
    setFormError(null);
    setModalOpen(false);
    setReceipt({
      title: 'Event created successfully',
      details: [
        { label: 'Title', value: created.title },
        { label: 'Date & time', value: formatManila(created.event_date) },
        { label: 'Venue', value: created.venue },
        { label: 'Visibility', value: created.visibility === 'exclusive' ? 'Exclusive' : 'Public' },
      ],
    });
  };

  /* Quick approve / decline */
  const decide = async (a: Attendee, status: 'approved' | 'declined') => {
    if (actingId) return;
    setActingId(a.id);
    setError(null);
    const { error: updateError } = await supabase
      .from('attendees')
      .update({ status })
      .eq('id', a.id);
    if (updateError) {
      setError(updateError.message);
      setActingId(null);
      return;
    }
    setAttendees((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
    let emailFailed = false;
    if (status === 'approved') {
      const { error: fnError } = await supabase.functions.invoke('send-ticket-email', {
        body: { attendee_id: a.id },
      });
      if (fnError) {
        emailFailed = true;
        setError('Guest approved, but the ticket email failed to send.');
      }
    }
    setActingId(null);
    setReceipt({
      title: status === 'approved' ? 'Registration approved' : 'Registration declined',
      variant: emailFailed ? 'warning' : 'success',
      details: [
        { label: 'Guest', value: a.full_name },
        { label: 'Email', value: a.email },
        { label: 'Event', value: eventById.get(a.event_id)?.title ?? 'Unknown event' },
      ],
      notice:
        status === 'declined'
          ? 'No QR pass was issued to this guest.'
          : emailFailed
            ? 'Approved, but the QR pass email failed to send.'
            : `QR pass email sent to ${a.email}.`,
    });
  };

  const confirmDecision = async () => {
    if (!decision) return;
    await decide(decision.attendee, decision.status);
    setDecision(null);
  };

  /* Derived data */
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const statsByEvent = useMemo(() => {
    const map = new Map<string, EventStats>();
    for (const a of attendees) {
      const s = map.get(a.event_id) ?? { approved: 0, checkedIn: 0, pending: 0 };
      if (a.status === 'approved') {
        s.approved += 1;
        if (a.checked_in) s.checkedIn += 1;
      } else if (a.status === 'pending') {
        s.pending += 1;
      }
      map.set(a.event_id, s);
    }
    return map;
  }, [attendees]);

  const totals = useMemo(() => {
    let approved = 0;
    let checkedIn = 0;
    let pending = 0;
    for (const s of statsByEvent.values()) {
      approved += s.approved;
      checkedIn += s.checkedIn;
      pending += s.pending;
    }
    return {
      events: events.length,
      active: events.filter((e) => e.status === 'active').length,
      closed: events.filter((e) => e.status === 'closed').length,
      cancelled: events.filter((e) => e.status === 'cancelled').length,
      approved,
      checkedIn,
      pending,
      rate: approved > 0 ? Math.round((checkedIn / approved) * 100) : 0,
    };
  }, [events, statsByEvent]);

  const sortedEvents = useMemo(() => {
    const active = events
      .filter((e) => e.status === 'active')
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    const rest = events
      .filter((e) => e.status !== 'active')
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
    return [...active, ...rest];
  }, [events]);

  const activeScannerSlug = useMemo(() => {
    const now = Date.now();
    const active = events.filter((e) => e.status === 'active');
    const upcoming = active.find((e) => new Date(e.event_date).getTime() >= now);
    return (upcoming ?? active[0])?.slug ?? null;
  }, [events]);

  const feed = useMemo(() => {
    const pending = attendees.filter((a) => a.status === 'pending').slice(0, FEED_LIMIT - 2);
    const recent = attendees
      .filter((a) => a.status !== 'pending')
      .slice(0, FEED_LIMIT - pending.length);
    return [...pending, ...recent];
  }, [attendees]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const key = manilaDayKey(e.event_date);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  /* Calendar geometry */
  const calYear = calView.getFullYear();
  const calMonth = calView.getMonth();
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthEventCount = useMemo(() => {
    const prefix = `${calYear}-${pad(calMonth + 1)}-`;
    let n = 0;
    for (const [key, list] of eventsByDay) if (key.startsWith(prefix)) n += list.length;
    return n;
  }, [eventsByDay, calYear, calMonth]);

  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : [];
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const goToday = () => {
    const n = new Date();
    setCalView(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelectedKey(todayKey);
  };

  const greetingName = profile.full_name?.trim().split(/\s+/)[0] || 'Admin';

  useShellScannerSlug(activeScannerSlug);

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Greeting & action header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 px-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-[#18181B] sm:text-3xl">
              Hi, {greetingName}!
            </h1>
            <p className="mt-0.5 text-sm font-medium text-[#18181B]/60">
              Here&apos;s an overview of your events and guest activity.
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="liquid-btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={16} />
            New Event
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl bg-rose-50/70 px-4 py-3 ring-2 ring-rose-400/35"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="min-w-0 flex-1 break-words text-sm font-semibold text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="shrink-0 rounded-full bg-white/60 p-1 text-rose-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPI row */}
        <section aria-label="Key metrics" className="grid gap-4 md:grid-cols-3">
          <div className="liquid-glass rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#18181B]/70">Total Events</p>
              <span className="flex size-9 items-center justify-center rounded-full bg-white/70 text-violet-600">
                <CalendarDays size={17} />
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#18181B]">
              {loading ? '—' : totals.events}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {totals.active} active
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {totals.closed} closed
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/90 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                <span className="size-1.5 rounded-full bg-rose-500" />
                {totals.cancelled} cancelled
              </span>
            </div>
          </div>

          <div className="liquid-glass rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#18181B]/70">Approved Guests</p>
              <span className="flex size-9 items-center justify-center rounded-full bg-white/70 text-violet-600">
                <Users size={17} />
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#18181B]">
              {loading ? '—' : totals.approved}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-[#18181B]/55">across all events</span>
              {totals.pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  <Clock size={10} />
                  {totals.pending} pending approval
                </span>
              )}
            </div>
          </div>

          <div className="liquid-glass-dark rounded-3xl p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white/75">Overall Check-In Rate</p>
              <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white">
                <UserCheck size={17} />
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-4xl font-extrabold tracking-tight">{loading ? '—' : `${totals.rate}%`}</p>
              <p className="pb-1 text-xs font-semibold text-white/60">
                {totals.checkedIn} of {totals.approved} checked in
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="Overall check-in rate"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={totals.rate}
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totals.rate}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-300"
              />
            </div>
          </div>
        </section>

        {/* Main bento grid */}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Left column */}
          <div className="min-w-0 space-y-4">
            {/* Events overview */}
            <section aria-label="Events overview" className="liquid-glass rounded-3xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold tracking-tight text-[#18181B]">
                  Events Overview
                </h2>
                <span className="text-xs font-semibold text-[#18181B]/50">
                  {events.length} {events.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm font-medium text-[#18181B]/50">
                  Loading events…
                </p>
              ) : sortedEvents.length === 0 ? (
                <div className="rounded-2xl bg-white/50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#18181B]/70">No events yet.</p>
                  <button
                    type="button"
                    onClick={openModal}
                    className="mt-2 text-sm font-bold text-violet-600 hover:underline"
                  >
                    Create your first event
                  </button>
                </div>
              ) : (
                <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-0.5">
                  {sortedEvents.map((e) => {
                    const s = statsByEvent.get(e.id) ?? { approved: 0, checkedIn: 0, pending: 0 };
                    const pct = s.approved > 0 ? Math.round((s.checkedIn / s.approved) * 100) : 0;
                    return (
                      <li
                        key={e.id}
                        className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/70 bg-white/55 p-3.5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="min-w-0 max-w-full truncate text-sm font-bold text-[#18181B]">
                              {e.title}
                            </p>
                            <EventStatusBadge status={e.status} />
                            <VisibilityBadge visibility={e.visibility} />
                          </div>
                          <p className="mt-1 truncate text-xs font-medium text-[#18181B]/60">
                            {formatManila(e.event_date)} · {e.venue}
                          </p>
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div
                              role="progressbar"
                              aria-label={`${e.title} check-in progress`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={pct}
                              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#18181B]/10"
                            >
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-[width] duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[11px] font-bold text-[#18181B]/65">
                              {s.checkedIn}/{s.approved} checked in
                            </span>
                            {s.pending > 0 && (
                              <span className="shrink-0 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                {s.pending} pending
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/manage?event=${e.id}`)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-full bg-[#18181B] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 sm:self-auto"
                        >
                          Manage
                          <ArrowRight size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Guest updates & pending approvals */}
            <section
              aria-label="Guest list updates and pending approvals"
              className="liquid-glass rounded-3xl p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-[#18181B]">
                    Guest Updates &amp; Approvals
                  </h2>
                  {totals.pending > 0 && (
                    <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      {totals.pending} pending
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin/manage')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline"
                >
                  View All in CRUD
                  <ArrowRight size={13} />
                </button>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm font-medium text-[#18181B]/50">
                  Loading guest activity…
                </p>
              ) : feed.length === 0 ? (
                <p className="rounded-2xl bg-white/50 px-4 py-8 text-center text-sm font-semibold text-[#18181B]/60">
                  No guest registrations yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {feed.map((a) => {
                    const ev = eventById.get(a.event_id);
                    const reg = REG_STATUS_UI[a.status];
                    const busy = actingId === a.id;
                    return (
                      <li
                        key={a.id}
                        className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-white/70 bg-white/55 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-400 text-sm font-extrabold text-white shadow-sm">
                            {(a.full_name.trim()[0] ?? '?').toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#18181B]">
                              {a.full_name}
                            </p>
                            <p className="truncate text-xs font-medium text-[#18181B]/55">
                              {ev?.title ?? 'Unknown event'} · {timeAgo(a.created_at)}
                            </p>
                          </div>
                        </div>
                        {a.status === 'pending' ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDecision({ attendee: a, status: 'approved' })}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                            >
                              <Check size={13} />
                              {busy ? 'Working…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDecision({ attendee: a, status: 'declined' })}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-100/90 px-3.5 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-200 disabled:opacity-60"
                            >
                              <X size={13} />
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:self-auto ${reg.cls}`}
                          >
                            {reg.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Right column: calendar */}
          <section
            aria-label="Event calendar"
            className="liquid-glass-dark min-w-0 rounded-3xl p-5 text-white xl:sticky xl:top-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-tight">Event Calendar</h2>
                <p className="text-xs font-medium text-white/55">
                  {monthEventCount} {monthEventCount === 1 ? 'event' : 'events'} this month
                </p>
              </div>
              <button
                type="button"
                onClick={goToday}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              >
                Today
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalView(new Date(calYear, calMonth - 1, 1))}
                aria-label="Previous month"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-bold">
                {calView.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                onClick={() => setCalView(new Date(calYear, calMonth + 1, 1))}
                aria-label="Next month"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-white/45">
              {CAL_WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-y-1">
              {calCells.map((d, i) => {
                if (d === null) return <span key={`blank-${i}`} />;
                const key = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(selected ? null : key)}
                    aria-pressed={selected}
                    aria-label={`${new Date(calYear, calMonth, d).toLocaleDateString('en-PH', {
                      month: 'long',
                      day: 'numeric',
                    })}${dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}` : ''}`}
                    className={`mx-auto flex h-11 w-9 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition ${
                      selected
                        ? 'bg-white text-[#18181B] shadow'
                        : isToday
                          ? 'text-white ring-1 ring-white/60 hover:bg-white/10'
                          : 'text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <span>{d}</span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => {
                        const exclusive = e.visibility === 'exclusive';
                        const color = EVENT_STATUS_UI[e.status].dot;
                        return (
                          <span
                            key={e.id}
                            className={`size-1.5 rounded-full ${
                              exclusive
                                ? `ring-[1.5px] ring-fuchsia-300 ring-offset-1 ring-offset-transparent ${color}`
                                : color
                            }`}
                          />
                        );
                      })}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/10 pt-3 text-[11px] font-medium text-white/60">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" /> Active
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" /> Closed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-500" /> Cancelled
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-white/70 ring-[1.5px] ring-fuchsia-300 ring-offset-1 ring-offset-transparent" />
                Exclusive
              </span>
            </div>

            {/* Selected day */}
            <div className="mt-4 border-t border-white/10 pt-4">
              {selectedLabel ? (
                <>
                  <p className="text-sm font-bold">{selectedLabel}</p>
                  {selectedEvents.length === 0 ? (
                    <p className="mt-2 rounded-2xl bg-white/5 px-3.5 py-4 text-center text-xs font-medium text-white/55">
                      No events scheduled on this day.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedEvents.map((e) => (
                        <li key={e.id} className="rounded-2xl bg-white/10 p-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="min-w-0 max-w-full truncate text-sm font-bold">
                              {e.title}
                            </p>
                            <EventStatusBadge status={e.status} />
                            <VisibilityBadge visibility={e.visibility} />
                          </div>
                          <p className="mt-1 truncate text-xs font-medium text-white/60">
                            {formatManilaTime(e.event_date)} · {e.venue}
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/manage?event=${e.id}`)}
                            className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#18181B] transition hover:opacity-90"
                          >
                            Open in Manage
                            <ArrowRight size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="rounded-2xl bg-white/5 px-3.5 py-4 text-center text-xs font-medium text-white/55">
                  Select a date to see its events.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* New Event modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeModal}
          >
            <motion.form
              onSubmit={createEvent}
              noValidate
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
                  onClick={closeModal}
                  aria-label="Close"
                  className="rounded-full bg-white/60 p-2 text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <input
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (e.target.value.trim()) clearFieldError('title');
                  }}
                  placeholder="Event title"
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? 'event-title-error' : undefined}
                  className={`liquid-pill-input w-full ${fieldErrors.title ? INVALID_INPUT : ''}`}
                />
                <FieldError id="event-title-error" message={fieldErrors.title} />
              </div>

              <div>
                <input
                  value={form.venue}
                  onChange={(e) => {
                    setForm({ ...form, venue: e.target.value });
                    if (e.target.value.trim()) clearFieldError('venue');
                  }}
                  placeholder="Venue"
                  aria-invalid={!!fieldErrors.venue}
                  aria-describedby={fieldErrors.venue ? 'event-venue-error' : undefined}
                  className={`liquid-pill-input w-full ${fieldErrors.venue ? INVALID_INPUT : ''}`}
                />
                <FieldError id="event-venue-error" message={fieldErrors.venue} />
              </div>

              <div>
                <DateTimePicker
                  value={form.date}
                  onChange={(date) => {
                    setForm((f) => ({ ...f, date }));
                    if (date) clearFieldError('date');
                  }}
                  invalid={!!fieldErrors.date}
                  describedBy={fieldErrors.date ? 'event-date-error' : undefined}
                />
                <FieldError id="event-date-error" message={fieldErrors.date} />
              </div>

              <div>
                <input
                  value={form.pin}
                  onChange={(e) => {
                    const pin = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setForm({ ...form, pin });
                    if (pin.length === 4) clearFieldError('pin');
                  }}
                  placeholder="4-digit scanner PIN"
                  inputMode="numeric"
                  aria-invalid={!!fieldErrors.pin}
                  aria-describedby={fieldErrors.pin ? 'event-pin-error' : undefined}
                  className={`liquid-pill-input w-full ${fieldErrors.pin ? INVALID_INPUT : ''}`}
                />
                <FieldError id="event-pin-error" message={fieldErrors.pin} />
              </div>

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
                        layoutId="dashboard-visibility-toggle"
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

      <ConfirmModal
        open={createConfirmOpen}
        variant="primary"
        title="Create this event?"
        description="Review the details before the event goes live."
        details={[
          { label: 'Title', value: form.title.trim() },
          { label: 'Venue', value: form.venue.trim() },
          {
            label: 'Date & time',
            value: parseLocal(form.date) ? formatManila(new Date(form.date).toISOString()) : '—',
          },
          { label: 'Visibility', value: form.visibility === 'exclusive' ? 'Exclusive' : 'Public' },
        ]}
        notice={
          form.visibility === 'exclusive'
            ? 'Guests will need your approval before they receive a QR pass.'
            : 'Anyone with the invite link can register and get an instant QR pass.'
        }
        confirmLabel="Create Event"
        confirmingLabel="Creating…"
        confirming={creating}
        onConfirm={() => void confirmCreateEvent()}
        onCancel={() => setCreateConfirmOpen(false)}
      />

      <ConfirmModal
        open={decision !== null}
        variant={decision?.status === 'declined' ? 'danger' : 'primary'}
        title={decision?.status === 'declined' ? 'Decline this registration?' : 'Approve this registration?'}
        details={[
          { label: 'Guest', value: decision?.attendee.full_name },
          { label: 'Email', value: decision?.attendee.email },
          {
            label: 'Event',
            value: decision ? (eventById.get(decision.attendee.event_id)?.title ?? 'Unknown event') : '',
          },
        ]}
        notice={
          decision?.status === 'declined'
            ? 'The guest will not receive a QR pass.'
            : `A QR pass email will be sent to ${decision?.attendee.email ?? 'the guest'} right away.`
        }
        confirmLabel={decision?.status === 'declined' ? 'Decline' : 'Approve & send pass'}
        confirmingLabel="Working…"
        confirming={actingId !== null}
        onConfirm={() => void confirmDecision()}
        onCancel={() => setDecision(null)}
      />

      <SuccessModal receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}