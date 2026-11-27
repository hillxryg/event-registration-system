/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Pencil,
  Eye,
  EyeOff,
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
import { useShellScannerSlug } from '../components/AppShell';
import ConfirmModal, { SuccessModal, type SuccessReceipt } from '../components/ConfirmModal';

interface AdminCrudPageProps {
  profile: UserProfile;
  onSignOut: () => void | Promise<void>;
}

type Filter = 'all' | 'pending_approval' | 'checked_in' | 'pending';

type FieldKey = 'title' | 'venue' | 'date' | 'pin';
type FieldErrors = Partial<Record<FieldKey, string>>;

type GuestFieldKey = 'full_name' | 'email';
type GuestFieldErrors = Partial<Record<GuestFieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVALID_INPUT =
  'border-rose-400/90 bg-rose-50/60 ring-2 ring-rose-400/35 text-rose-900 placeholder:text-rose-400';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 px-4 text-xs font-semibold text-rose-600">
      {message}
    </p>
  );
}

const REG_STATUS_UI: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending Approval', cls: 'bg-amber-100/90 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100/90 text-emerald-700' },
  declined: { label: 'Declined', cls: 'bg-rose-100/90 text-rose-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200/80 text-slate-600' },
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

const readEventParam = () => new URLSearchParams(window.location.search).get('event') ?? '';

const writeEventParam = (id: string) => {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('event', id);
  else url.searchParams.delete('event');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
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

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDraftDate = (local: string) =>
  parseLocal(local)
    ? new Date(local).toLocaleString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

type PickedDate = { y: number; m: number; d: number };
type PickedTime = { hour: number; minute: number; pm: boolean };

const pillCls = (active: boolean) =>
  `rounded-full px-2 py-1 text-xs font-medium transition ${
    active ? 'bg-violet-500 text-white shadow' : 'bg-white/60 text-slate-700 hover:bg-white'
  }`;

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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

export default function AdminCrudPage(_props: AdminCrudPageProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [eventId, setEventId] = useState('');
  const [urlEventId, setUrlEventId] = useState(readEventParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [guestConfirmOpen, setGuestConfirmOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<EventStatus | null>(null);
  const [decision, setDecision] = useState<{
    attendee: Attendee;
    status: 'approved' | 'declined';
  } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [receipt, setReceipt] = useState<SuccessReceipt | null>(null);
  const [guestModal, setGuestModal] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Attendee | null>(null);
  const [guestDeleteTarget, setGuestDeleteTarget] = useState<Attendee | null>(null);
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestDeleting, setGuestDeleting] = useState(false);
  const [guestErrors, setGuestErrors] = useState<GuestFieldErrors>({});
  const [guestForm, setGuestForm] = useState({
    full_name: '',
    email: '',
    organization: '',
    contact_number: '',
    sendEmail: true,
  });
  const [form, setForm] = useState<{
    title: string;
    venue: string;
    date: string;
    pin: string;
    visibility: EventVisibility;
  }>({ title: '', venue: '', date: '', pin: '', visibility: 'public' });
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [resendAll, setResendAll] = useState(false);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    venue: string;
    date: string;
    pin: string;
    visibility: EventVisibility;
  }>({ title: '', venue: '', date: '', pin: '', visibility: 'public' });

  const selectEvent = (id: string) => {
    setEventId(id);
    setUrlEventId(id);
    writeEventParam(id);
  };

  const openModal = () => {
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setFieldErrors({});
    setFormError(null);
    setModalOpen(false);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteOpen(false);
  };

  const openEditModal = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      venue: event.venue,
      date: toLocalInput(event.event_date),
      pin: event.scanner_pin ?? '',
      visibility: event.visibility,
    });
    setEditErrors({});
    setEditFormError(null);
    setShowPin(false);
    setResendAll(false);
    setEditOpen(true);
  };

  const closeEditModal = () => {
    if (saving) return;
    setEditErrors({});
    setEditFormError(null);
    setEditOpen(false);
  };

  const clearEditError = (key: FieldKey) =>
    setEditErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // Auto-check the re-send box whenever title, venue, or date differs from the saved event
  const applyEditChange = (patch: Partial<typeof editForm>) => {
    const next = { ...editForm, ...patch };
    setEditForm(next);
    if (
      event &&
      (next.title.trim() !== event.title ||
        next.venue.trim() !== event.venue ||
        next.date !== toLocalInput(event.event_date))
    ) {
      setResendAll(true);
    }
  };

  const validateEditForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!editForm.title.trim()) errors.title = 'Event title is required.';
    if (!editForm.venue.trim()) errors.venue = 'Venue is required.';
    if (!editForm.date || !parseLocal(editForm.date))
      errors.date = 'Pick a date and time for the event.';
    if (!editForm.pin) errors.pin = 'Scanner PIN is required.';
    else if (!/^\d{4}$/.test(editForm.pin)) errors.pin = 'Scanner PIN must be exactly 4 digits.';
    return errors;
  };

  useEffect(() => {
    if (!editOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        setEditErrors({});
        setEditFormError(null);
        setEditOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editOpen, saving]);

  const clearFieldError = (key: FieldKey) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.title.trim()) errors.title = 'Event title is required.';
    if (!form.venue.trim()) errors.venue = 'Venue is required.';
    if (!form.date || !parseLocal(form.date)) errors.date = 'Pick a date and time for the event.';
    if (!form.pin) errors.pin = 'Scanner PIN is required.';
    else if (!/^\d{4}$/.test(form.pin)) errors.pin = 'Scanner PIN must be exactly 4 digits.';
    return errors;
  };

  useEffect(() => {
    if (!guestModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || guestSaving) return;
      setGuestModal(null);
      setEditTarget(null);
      setGuestErrors({});
      setFormError(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guestModal, guestSaving]);

  // Re-read `?event=<id>` whenever the history changes (e.g. Manage / Open in Manage links)
  useEffect(() => {
    const sync = () => {
      const id = readEventParam();
      if (id) setUrlEventId(id);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (urlEventId && events.some((e) => e.id === urlEventId)) setEventId(urlEventId);
  }, [urlEventId, events]);

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
        const initial =
          list.find((e) => e.id === readEventParam()) ??
          list.find((e) => e.status === 'active') ??
          list[0];
        setEventId(initial?.id ?? '');
        setUrlEventId(initial?.id ?? '');
        writeEventParam(initial?.id ?? '');
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

  const total = attendees.length;
  const checked = attendees.filter((a) => a.checked_in).length;
  const pending = attendees.filter((a) => a.status === 'approved' && !a.checked_in).length;
  const approvedCount = attendees.filter((a) => a.status === 'approved').length;
  const needsApproval = attendees.filter((a) => a.status === 'pending').length;
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

  const requestStatusChange = (status: EventStatus) => {
    if (!event || event.status === status || statusUpdating) return;
    setStatusTarget(status);
  };

  const updateEventStatus = async () => {
    if (!event || !statusTarget || event.status === statusTarget || statusUpdating) {
      setStatusTarget(null);
      return;
    }
    const status = statusTarget;
    const title = event.title;
    setStatusUpdating(true);
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id);
    setStatusUpdating(false);
    setStatusTarget(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status } : e)));
    setReceipt({
      title: `Event marked as ${EVENT_STATUS_UI[status].label}`,
      details: [{ label: 'Event', value: title }],
      notice:
        status === 'cancelled'
          ? 'Registration and the scanner are now blocked for this event.'
          : status === 'closed'
            ? 'New registrations are blocked. Registered guests can still be checked in.'
            : 'Registration is open and the scanner accepts check-ins.',
    });
  };

  const deleteEvent = async () => {
    if (!event || deleting) return;
    const deletedTitle = event.title;
    const removedCount = attendees.length;
    const deletedId = event.id;
    setDeleting(true);
    const { error } = await supabase.from('events').delete().eq('id', deletedId);
    setDeleting(false);
    if (error) {
      setError(error.message);
      setDeleteOpen(false);
      return;
    }
    const nextEvents = events.filter((e) => e.id !== deletedId);
    setEvents(nextEvents);
    selectEvent((nextEvents.find((e) => e.status === 'active') ?? nextEvents[0])?.id ?? '');
    setAttendees([]);
    setQuery('');
    setFilter('all');
    setDeleteOpen(false);
    setReceipt({
      title: 'Event deleted',
      details: [{ label: 'Event', value: deletedTitle }],
      notice: `The event and its ${removedCount} ${
        removedCount === 1 ? 'registration were' : 'registrations were'
      } permanently removed.`,
    });
  };

  const requestSaveEvent = (ev: FormEvent) => {
    ev.preventDefault();
    if (!event || saving) return;
    const errors = validateEditForm();
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setEditFormError(null);
    setEditConfirmOpen(true);
  };

  const saveEvent = async () => {
    if (!event || saving) return;

    setSaving(true);
    setEditFormError(null);

    // `slug` is intentionally omitted so /register/:slug and /scanner/:slug links stay valid
    const { data, error } = await supabase
      .from('events')
      .update({
        title: editForm.title.trim(),
        venue: editForm.venue.trim(),
        event_date: new Date(editForm.date).toISOString(),
        visibility: editForm.visibility,
        scanner_pin: editForm.pin,
      })
      .eq('id', event.id)
      .select('*')
      .single();

    if (error || !data) {
      setSaving(false);
      setEditConfirmOpen(false);
      setEditFormError(error?.message ?? 'Could not update event.');
      return;
    }

    const updated = data as EventItem;
    setEvents((prev) =>
      prev
        .map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    );

    let emailNote: string;
    let emailWarn = false;

    if (!resendAll) {
      emailNote = 'No pass emails were re-sent.';
    } else {
      const { data: approved, error: listErr } = await supabase
        .from('attendees')
        .select('id')
        .eq('event_id', updated.id)
        .eq('status', 'approved');

      if (listErr) {
        setError(`Event updated, but approved guests could not be loaded: ${listErr.message}`);
        emailNote = 'Approved guests could not be loaded, so no pass emails were re-sent.';
        emailWarn = true;
      } else {
        const targets = (approved ?? []) as { id: string }[];
        let failed = 0;
        for (const a of targets) {
          const { error: fnError } = await supabase.functions.invoke('send-ticket-email', {
            body: { attendee_id: a.id, updated: true },
          });
          if (fnError) failed += 1;
        }
        if (failed > 0) {
          setError(
            `Event updated, but ${failed} of ${targets.length} pass ${
              targets.length === 1 ? 'email' : 'emails'
            } failed to send.`,
          );
          emailWarn = true;
          emailNote = `Updated QR pass emails were sent to ${targets.length - failed} of ${
            targets.length
          } approved guests; ${failed} failed.`;
        } else if (targets.length === 0) {
          emailNote = 'There are no approved guests yet, so no pass emails were sent.';
        } else {
          emailNote = `Updated QR pass emails were sent to ${targets.length} approved ${
            targets.length === 1 ? 'guest' : 'guests'
          }.`;
        }
      }
    }

    setSaving(false);
    setEditConfirmOpen(false);
    setEditErrors({});
    setEditFormError(null);
    setEditOpen(false);
    setReceipt({
      title: 'Event updated successfully',
      variant: emailWarn ? 'warning' : 'success',
      details: [
        { label: 'Title', value: updated.title },
        { label: 'Date & time', value: formatDraftDate(toLocalInput(updated.event_date)) },
        { label: 'Venue', value: updated.venue },
      ],
      notice: emailNote,
    });
  };

  const updateRegistrationStatus = async (
    id: string,
    status: RegistrationStatus,
  ): Promise<'ok' | 'email_failed' | 'error'> => {
    const { error } = await supabase.from('attendees').update({ status }).eq('id', id);
    if (error) {
      setError(error.message);
      return 'error';
    }
    setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    if (status === 'approved') {
      const { error: fnError } = await supabase.functions.invoke('send-ticket-email', {
        body: { attendee_id: id },
      });
      if (fnError) {
        setError('Attendee approved, but the ticket email failed to send.');
        return 'email_failed';
      }
    }
    return 'ok';
  };

  const confirmDecision = async () => {
    if (!decision || deciding) return;
    const { attendee, status } = decision;
    setDeciding(true);
    const outcome = await updateRegistrationStatus(attendee.id, status);
    setDeciding(false);
    setDecision(null);
    if (outcome === 'error') return;
    setReceipt({
      title: status === 'approved' ? 'Registration approved' : 'Registration declined',
      variant: outcome === 'email_failed' ? 'warning' : 'success',
      details: [
        { label: 'Guest', value: attendee.full_name },
        { label: 'Email', value: attendee.email },
        { label: 'Event', value: event?.title },
      ],
      notice:
        status === 'declined'
          ? 'No QR pass was issued to this guest.'
          : outcome === 'email_failed'
            ? 'Approved, but the QR pass email failed to send.'
            : `QR pass email sent to ${attendee.email}.`,
    });
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

  const clearGuestError = (key: GuestFieldKey) =>
    setGuestErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const guestDbError = (err: { code?: string; message: string }) => {
    if (err.code === '23505') {
      return /ticket_code/i.test(err.message)
        ? 'Ticket code collision. Please submit again.'
        : 'A guest with this email is already registered for this event.';
    }
    return err.message;
  };

  const openAddGuest = () => {
    if (!event) return;
    setGuestForm({ full_name: '', email: '', organization: '', contact_number: '', sendEmail: true });
    setGuestErrors({});
    setFormError(null);
    setEditTarget(null);
    setGuestModal('add');
  };

  const openEditGuest = (a: Attendee) => {
    setGuestForm({
      full_name: a.full_name,
      email: a.email,
      organization: a.organization ?? '',
      contact_number: a.contact_number ?? '',
      sendEmail: false,
    });
    setGuestErrors({});
    setFormError(null);
    setEditTarget(a);
    setGuestModal('edit');
  };

  const closeGuestModal = () => {
    if (guestSaving) return;
    setGuestModal(null);
    setEditTarget(null);
    setGuestErrors({});
    setFormError(null);
  };

  const validateGuest = (): GuestFieldErrors => {
    const errors: GuestFieldErrors = {};
    if (!guestForm.full_name.trim()) errors.full_name = 'Full name is required.';
    const email = guestForm.email.trim();
    if (!email) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
    return errors;
  };

  const sendTicketEmail = async (attendeeId: string, okMessage: string) => {
    const { error: fnError } = await supabase.functions.invoke('send-ticket-email', {
      body: { attendee_id: attendeeId },
    });
    if (fnError) setError(`${okMessage}, but the ticket email failed to send.`);
    return !fnError;
  };

  const addGuest = async () => {
    if (!event) return null;
    const { data, error } = await supabase
      .from('attendees')
      .insert({
        event_id: event.id,
        ticket_code: `PASS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        full_name: guestForm.full_name.trim(),
        email: guestForm.email.trim().toLowerCase(),
        organization: guestForm.organization.trim() || 'Walk-In',
        contact_number: guestForm.contact_number.trim(),
        status: 'approved',
        checked_in: false,
      })
      .select('*')
      .single();
    if (error || !data) {
      setFormError(error ? guestDbError(error) : 'Could not add guest.');
      return null;
    }
    const created = data as Attendee;
    setAttendees((prev) => [created, ...prev]);
    let emailed: boolean | null = null;
    if (guestForm.sendEmail) emailed = await sendTicketEmail(created.id, 'Guest added');
    return { emailed };
  };

  const saveGuest = async () => {
    if (!editTarget) return null;
    const nextEmail = guestForm.email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('attendees')
      .update({
        full_name: guestForm.full_name.trim(),
        email: nextEmail,
        organization: guestForm.organization.trim(),
        contact_number: guestForm.contact_number.trim(),
      })
      .eq('id', editTarget.id)
      .select('*')
      .single();
    if (error || !data) {
      setFormError(error ? guestDbError(error) : 'Could not update guest.');
      return null;
    }
    const updated = data as Attendee;
    setAttendees((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    let emailed: boolean | null = null;
    if (guestForm.sendEmail && updated.status === 'approved') {
      emailed = await sendTicketEmail(updated.id, 'Guest updated');
    }
    return { emailed };
  };

  const submitGuest = (ev: FormEvent) => {
    ev.preventDefault();
    if (guestSaving) return;
    const errors = validateGuest();
    setGuestErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setFormError(null);
    setGuestConfirmOpen(true);
  };

  const confirmSubmitGuest = async () => {
    if (guestSaving) return;
    const isAdd = guestModal === 'add';
    const name = guestForm.full_name.trim();
    const email = guestForm.email.trim().toLowerCase();
    setGuestSaving(true);
    setFormError(null);
    const result = isAdd ? await addGuest() : await saveGuest();
    setGuestSaving(false);
    setGuestConfirmOpen(false);
    if (!result) return;
    setGuestModal(null);
    setEditTarget(null);
    setReceipt({
      title: isAdd ? 'Guest added' : 'Guest details saved',
      variant: result.emailed === false ? 'warning' : 'success',
      details: [
        { label: 'Name', value: name },
        { label: 'Email', value: email },
      ],
      notice:
        result.emailed === true
          ? `QR pass email sent to ${email}.`
          : result.emailed === false
            ? 'Saved, but the QR pass email failed to send.'
            : 'No QR pass email was sent.',
    });
  };

  const deleteGuest = async () => {
    const target = guestDeleteTarget;
    if (!target || guestDeleting) return;
    setGuestDeleting(true);
    const { error } = await supabase.from('attendees').delete().eq('id', target.id);
    setGuestDeleting(false);
    if (error) {
      setError(error.message);
      setGuestDeleteTarget(null);
      return;
    }
    setAttendees((prev) => prev.filter((a) => a.id !== target.id));
    setGuestDeleteTarget(null);
    setReceipt({
      title: 'Guest removed',
      details: [
        { label: 'Name', value: target.full_name },
        { label: 'Email', value: target.email },
        { label: 'Ticket', value: <span className="font-mono text-xs">{target.ticket_code}</span> },
      ],
      notice: 'Their registration and QR pass were permanently deleted.',
    });
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
    const { data, error } = await supabase
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
    selectEvent(created.id);
    setForm({ title: '', venue: '', date: '', pin: '', visibility: 'public' });
    setReceipt({
      title: 'Event created successfully',
      details: [
        { label: 'Title', value: created.title },
        { label: 'Date & time', value: formatDraftDate(toLocalInput(created.event_date)) },
        { label: 'Venue', value: created.venue },
        { label: 'Visibility', value: created.visibility === 'exclusive' ? 'Exclusive' : 'Public' },
      ],
    });
    closeModal();
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending_approval', label: 'Needs Approval' },
    { key: 'checked_in', label: 'Checked In' },
    { key: 'pending', label: 'Pending Check-In' },
  ];

  const activeFilterLabel = filters.find((f) => f.key === filter)?.label ?? 'All';

  useShellScannerSlug(event?.slug ?? null);

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Workspace header + toolbar */}
        <section className="liquid-glass relative z-30 overflow-visible! rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/40 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-[#18181B] sm:text-2xl">
                Manage Events &amp; Guests
              </h1>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {event ? formatEventMeta(event) : 'Create an event to start managing guests.'}
              </p>
            </div>
            <button
              onClick={openModal}
              className="liquid-btn-primary flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={16} /> New Event
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 sm:px-6">
            <EventDropdown
              events={events}
              selectedId={eventId}
              loading={loading}
              onSelect={selectEvent}
              className="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1"
            />
            <button
              type="button"
              onClick={copyInviteLink}
              disabled={!event}
              className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={openEditModal}
              disabled={!event}
              aria-label="Edit event"
              className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              <Pencil size={14} /> Edit Event
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={!event || deleting}
              aria-label="Delete event"
              className="liquid-glass flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm text-rose-600 transition hover:bg-rose-50/80 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete Event
            </button>
            {event && (
              <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Event status
                </span>
                <EventStatusControl
                  status={event.status}
                  updating={statusUpdating}
                  onChange={requestStatusChange}
                />
              </div>
            )}
          </div>
        </section>

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

        {/* KPI strip */}
        <section className="liquid-glass grid divide-y divide-white/40 rounded-3xl md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between text-sm text-slate-600">
              Total Registered <Users size={18} className="text-violet-500" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-800">{total}</p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{approvedCount}</span> approved
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between text-sm text-slate-600">
              Checked In <UserCheck size={18} className="text-emerald-500" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-800">
              {checked}
              <span className="ml-2 text-base font-normal text-slate-500">{pct}%</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between text-sm text-slate-600">
              Pending Check-In <Clock size={18} className="text-amber-500" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-800">{pending}</p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-semibold text-amber-600">{needsApproval}</span> needs approval
            </p>
          </div>
        </section>

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
              type="button"
              onClick={openAddGuest}
              disabled={!event}
              className="liquid-glass hidden shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-violet-600 disabled:opacity-50 lg:flex"
            >
              <UserPlus size={14} /> Add Guest
            </button>

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
                      openAddGuest();
                      setFilterDrawerOpen(false);
                    }}
                    disabled={!event}
                    className="liquid-glass flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold text-violet-600 disabled:opacity-50"
                  >
                    <UserPlus size={14} /> Add Guest
                  </button>
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

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/50">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-white/40 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Ticket</th>
                  <th className="px-3 py-3">Registration</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-white/40 text-slate-700 transition hover:bg-white/30"
                  >
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDecision({ attendee: a, status: 'approved' })}
                              className="whitespace-nowrap rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setDecision({ attendee: a, status: 'declined' })}
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
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEditGuest(a)}
                          aria-label={`Edit ${a.full_name}`}
                          title="Edit guest"
                          className="rounded-full bg-white/70 p-2 text-slate-600 transition hover:bg-white hover:text-violet-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuestDeleteTarget(a)}
                          aria-label={`Delete ${a.full_name}`}
                          title="Delete guest"
                          className="rounded-full bg-white/70 p-2 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

          <p className="mt-3 px-1 text-xs text-slate-500">
            Showing {visible.length} of {total} {total === 1 ? 'guest' : 'guests'}
          </p>
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

      {/* Add / Edit Guest modal */}
      <AnimatePresence>
        {guestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeGuestModal}
          >
            <motion.form
              onSubmit={submitGuest}
              noValidate
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              className="liquid-glass my-auto w-full max-w-md space-y-4 rounded-3xl p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {guestModal === 'add' ? 'Add Walk-In Guest' : 'Edit Guest'}
                </h2>
                <button
                  type="button"
                  onClick={closeGuestModal}
                  aria-label="Close"
                  className="rounded-full bg-white/60 p-2 text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <input
                  value={guestForm.full_name}
                  onChange={(e) => {
                    setGuestForm({ ...guestForm, full_name: e.target.value });
                    if (e.target.value.trim()) clearGuestError('full_name');
                  }}
                  placeholder="Full name"
                  aria-invalid={!!guestErrors.full_name}
                  aria-describedby={guestErrors.full_name ? 'guest-name-error' : undefined}
                  className={`liquid-pill-input w-full ${guestErrors.full_name ? INVALID_INPUT : ''}`}
                />
                <FieldError id="guest-name-error" message={guestErrors.full_name} />
              </div>

              <div>
                <input
                  type="email"
                  value={guestForm.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    setGuestForm((f) => ({
                      ...f,
                      email,
                      ...(guestModal === 'edit' && editTarget?.status === 'approved'
                        ? {
                            sendEmail:
                              email.trim().toLowerCase() !== editTarget.email.toLowerCase(),
                          }
                        : {}),
                    }));
                    if (EMAIL_RE.test(email.trim())) clearGuestError('email');
                  }}
                  placeholder="Email address"
                  aria-invalid={!!guestErrors.email}
                  aria-describedby={guestErrors.email ? 'guest-email-error' : undefined}
                  className={`liquid-pill-input w-full ${guestErrors.email ? INVALID_INPUT : ''}`}
                />
                <FieldError id="guest-email-error" message={guestErrors.email} />
              </div>

              <input
                value={guestForm.organization}
                onChange={(e) => setGuestForm({ ...guestForm, organization: e.target.value })}
                placeholder={guestModal === 'add' ? 'Organization (defaults to Walk-In)' : 'Organization'}
                className="liquid-pill-input w-full"
              />

              <input
                value={guestForm.contact_number}
                onChange={(e) => setGuestForm({ ...guestForm, contact_number: e.target.value })}
                placeholder="Contact number (optional)"
                inputMode="tel"
                className="liquid-pill-input w-full"
              />

              {(guestModal === 'add' || editTarget?.status === 'approved') && (
                <label className="liquid-glass flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3">
                  <input
                    type="checkbox"
                    checked={guestForm.sendEmail}
                    onChange={(e) => setGuestForm({ ...guestForm, sendEmail: e.target.checked })}
                    className="size-4 accent-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {guestModal === 'add' ? 'Send QR pass via email' : 'Re-send QR ticket email'}
                  </span>
                </label>
              )}

              {formError && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={guestSaving}
                className="liquid-btn-primary w-full disabled:opacity-60"
              >
                {guestSaving
                  ? guestModal === 'add'
                    ? 'Adding…'
                    : 'Saving…'
                  : guestModal === 'add'
                    ? 'Add Guest'
                    : 'Save Changes'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Event modal */}
      <AnimatePresence>
        {editOpen && event && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm sm:items-center"
            onClick={closeEditModal}
          >
            <motion.form
              onSubmit={requestSaveEvent}
              noValidate
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              className="liquid-glass my-auto w-full max-w-md space-y-4 overflow-visible! rounded-3xl p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Edit Event</h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  aria-label="Close"
                  className="rounded-full bg-white/60 p-2 text-slate-600 disabled:opacity-60"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <input
                  value={editForm.title}
                  onChange={(e) => {
                    applyEditChange({ title: e.target.value });
                    if (e.target.value.trim()) clearEditError('title');
                  }}
                  disabled={saving}
                  placeholder="Event title"
                  aria-invalid={!!editErrors.title}
                  aria-describedby={editErrors.title ? 'edit-event-title-error' : undefined}
                  className={`liquid-pill-input w-full ${editErrors.title ? INVALID_INPUT : ''}`}
                />
                <FieldError id="edit-event-title-error" message={editErrors.title} />
              </div>

              <div>
                <input
                  value={editForm.venue}
                  onChange={(e) => {
                    applyEditChange({ venue: e.target.value });
                    if (e.target.value.trim()) clearEditError('venue');
                  }}
                  disabled={saving}
                  placeholder="Venue"
                  aria-invalid={!!editErrors.venue}
                  aria-describedby={editErrors.venue ? 'edit-event-venue-error' : undefined}
                  className={`liquid-pill-input w-full ${editErrors.venue ? INVALID_INPUT : ''}`}
                />
                <FieldError id="edit-event-venue-error" message={editErrors.venue} />
              </div>

              <div>
                <DateTimePicker
                  value={editForm.date}
                  onChange={(date) => {
                    applyEditChange({ date });
                    if (date) clearEditError('date');
                  }}
                  invalid={!!editErrors.date}
                  describedBy={editErrors.date ? 'edit-event-date-error' : undefined}
                />
                <FieldError id="edit-event-date-error" message={editErrors.date} />
              </div>

              <div>
                <div className="relative">
                  <input
                    value={editForm.pin}
                    onChange={(e) => {
                      const pin = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setEditForm((f) => ({ ...f, pin }));
                      if (pin.length === 4) clearEditError('pin');
                    }}
                    type={showPin ? 'text' : 'password'}
                    disabled={saving}
                    placeholder="4-digit scanner PIN"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={!!editErrors.pin}
                    aria-describedby={
                      editErrors.pin ? 'edit-event-pin-error' : 'edit-event-pin-hint'
                    }
                    className={`liquid-pill-input w-full pr-12 ${editErrors.pin ? INVALID_INPUT : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'Hide scanner PIN' : 'Show scanner PIN'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/60 p-2 text-slate-600 transition hover:bg-white"
                  >
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <FieldError id="edit-event-pin-error" message={editErrors.pin} />
                {!editErrors.pin && (
                  <p id="edit-event-pin-hint" className="mt-1.5 px-4 text-xs text-slate-500">
                    View the current scanner PIN or overwrite it to reset a forgotten one.
                  </p>
                )}
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
                    aria-checked={editForm.visibility === opt.key}
                    disabled={saving}
                    onClick={() => setEditForm((f) => ({ ...f, visibility: opt.key }))}
                    className="relative z-10 rounded-xl px-3 py-2 text-left"
                  >
                    {editForm.visibility === opt.key && (
                      <motion.span
                        layoutId="edit-visibility-toggle"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 -z-10 rounded-xl bg-white/80 shadow"
                      />
                    )}
                    <span
                      className={`block text-sm font-semibold ${
                        editForm.visibility === opt.key ? 'text-violet-600' : 'text-slate-700'
                      }`}
                    >
                      {opt.title}
                    </span>
                    <span className="block text-xs text-slate-500">— {opt.hint}</span>
                  </button>
                ))}
              </div>

              <label className="liquid-glass flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3">
                <input
                  type="checkbox"
                  checked={resendAll}
                  disabled={saving}
                  onChange={(e) => setResendAll(e.target.checked)}
                  className="size-4 accent-violet-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Re-send QR pass emails to all approved guests
                </span>
              </label>

              {editFormError && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {editFormError}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="liquid-btn-primary w-full disabled:opacity-60"
              >
                {saving ? (resendAll ? 'Updating & sending passes…' : 'Saving…') : 'Save Changes'}
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
          { label: 'Date & time', value: formatDraftDate(form.date) },
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
        open={editConfirmOpen}
        variant={resendAll ? 'warning' : 'primary'}
        title="Save changes to this event?"
        details={[
          { label: 'Title', value: editForm.title.trim() },
          { label: 'Venue', value: editForm.venue.trim() },
          { label: 'Date & time', value: formatDraftDate(editForm.date) },
          { label: 'Visibility', value: editForm.visibility === 'exclusive' ? 'Exclusive' : 'Public' },
          {
            label: 'Scanner PIN',
            value: editForm.pin === (event?.scanner_pin ?? '') ? 'Unchanged' : 'Changed',
          },
        ]}
        notice={
          resendAll
            ? `Updated QR pass emails will be re-sent to ${approvedCount} approved ${
                approvedCount === 1 ? 'guest' : 'guests'
              }.`
            : 'No pass emails will be re-sent.'
        }
        confirmLabel={resendAll ? 'Save & re-send' : 'Save Changes'}
        confirmingLabel={resendAll ? 'Saving & sending…' : 'Saving…'}
        confirming={saving}
        onConfirm={() => void saveEvent()}
        onCancel={() => setEditConfirmOpen(false)}
      />

      <ConfirmModal
        open={statusTarget !== null}
        variant={
          statusTarget === 'cancelled' ? 'danger' : statusTarget === 'closed' ? 'warning' : 'primary'
        }
        title={`Switch status to ${statusTarget ? EVENT_STATUS_UI[statusTarget].label : ''}?`}
        details={[
          { label: 'Event', value: event?.title },
          {
            label: 'Status',
            value: `${event ? EVENT_STATUS_UI[event.status].label : ''} → ${
              statusTarget ? EVENT_STATUS_UI[statusTarget].label : ''
            }`,
          },
        ]}
        notice={
          statusTarget === 'cancelled'
            ? 'Registration and the scanner are blocked for a cancelled event.'
            : statusTarget === 'closed'
              ? 'New registrations are blocked. Guests who already registered can still be checked in.'
              : 'Registration reopens and the scanner accepts check-ins.'
        }
        confirmLabel="Switch Status"
        confirmingLabel="Updating…"
        confirming={statusUpdating}
        onConfirm={() => void updateEventStatus()}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmModal
        open={deleteOpen && !!event}
        variant="danger"
        title="Delete this event?"
        details={[{ label: 'Event', value: event?.title }]}
        notice={
          <>
            This will permanently remove the event and all{' '}
            <span className="font-semibold text-rose-600">
              {attendees.length} {attendees.length === 1 ? 'registration' : 'registrations'}
            </span>{' '}
            and passes tied to it. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Event"
        confirmingLabel="Deleting…"
        confirming={deleting}
        onConfirm={() => void deleteEvent()}
        onCancel={closeDeleteModal}
      />

      <ConfirmModal
        open={guestConfirmOpen}
        variant="primary"
        title={guestModal === 'add' ? 'Add this guest?' : 'Save changes to this guest?'}
        details={[
          { label: 'Name', value: guestForm.full_name.trim() },
          { label: 'Email', value: guestForm.email.trim().toLowerCase() },
          {
            label: 'Organization',
            value: guestForm.organization.trim() || (guestModal === 'add' ? 'Walk-In' : '—'),
          },
          { label: 'Contact', value: guestForm.contact_number.trim() || '—' },
        ]}
        notice={
          guestModal === 'add'
            ? guestForm.sendEmail
              ? `The guest is added as approved and a QR pass will be emailed to ${guestForm.email.trim()}.`
              : 'The guest is added as approved. No email will be sent.'
            : guestForm.sendEmail && editTarget?.status === 'approved'
              ? `The updated QR ticket email will be re-sent to ${guestForm.email.trim()}.`
              : 'No email will be sent.'
        }
        confirmLabel={guestModal === 'add' ? 'Add Guest' : 'Save Changes'}
        confirmingLabel={guestModal === 'add' ? 'Adding…' : 'Saving…'}
        confirming={guestSaving}
        onConfirm={() => void confirmSubmitGuest()}
        onCancel={() => setGuestConfirmOpen(false)}
      />

      <ConfirmModal
        open={guestDeleteTarget !== null}
        variant="danger"
        title="Remove this guest?"
        details={[
          { label: 'Name', value: guestDeleteTarget?.full_name },
          { label: 'Email', value: guestDeleteTarget?.email },
          {
            label: 'Ticket',
            value: <span className="font-mono text-xs">{guestDeleteTarget?.ticket_code}</span>,
          },
        ]}
        notice={
          <>
            Removing this guest{' '}
            <span className="font-semibold text-rose-600">
              permanently deletes their registration and QR pass
            </span>
            . This action cannot be undone.
          </>
        }
        confirmLabel="Delete Guest"
        confirmingLabel="Removing…"
        confirming={guestDeleting}
        onConfirm={() => void deleteGuest()}
        onCancel={() => setGuestDeleteTarget(null)}
      />

      <ConfirmModal
        open={decision !== null}
        variant={decision?.status === 'declined' ? 'danger' : 'primary'}
        title={decision?.status === 'declined' ? 'Decline this registration?' : 'Approve this registration?'}
        details={[
          { label: 'Guest', value: decision?.attendee.full_name },
          { label: 'Email', value: decision?.attendee.email },
          { label: 'Event', value: event?.title },
        ]}
        notice={
          decision?.status === 'declined'
            ? 'The guest will not receive a QR pass.'
            : `A QR pass email will be sent to ${decision?.attendee.email ?? 'the guest'} right away.`
        }
        confirmLabel={decision?.status === 'declined' ? 'Decline' : 'Approve & send pass'}
        confirmingLabel="Working…"
        confirming={deciding}
        onConfirm={() => void confirmDecision()}
        onCancel={() => setDecision(null)}
      />

      <SuccessModal receipt={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}