import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  QrCode,
  RefreshCw,
  Ticket,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Attendee, EventItem, RegistrationStatus, UserProfile } from '../types/database';
import { supabase } from '../lib/supabase';

const EVENT_FIELDS = 'id, slug, title, description, event_date, venue, visibility, status';

type RegistrationEvent = Pick<
  EventItem,
  'id' | 'slug' | 'title' | 'description' | 'event_date' | 'venue' | 'visibility' | 'status'
>;
type Registration = Attendee & { events: RegistrationEvent };
type FilterKey = 'all' | 'approved' | 'pending' | 'closed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed', label: 'Declined / Cancelled' },
];

const STATUS_META: Record<
  RegistrationStatus,
  { label: string; badge: string; Icon: LucideIcon }
> = {
  approved: { label: 'Approved', badge: 'bg-emerald-100/90 text-emerald-700', Icon: CheckCircle2 },
  pending: { label: 'Pending Approval', badge: 'bg-amber-100/90 text-amber-700', Icon: Clock },
  declined: { label: 'Declined', badge: 'bg-rose-100/90 text-rose-700', Icon: XCircle },
  cancelled: { label: 'Cancelled', badge: 'bg-slate-200/80 text-slate-600', Icon: XCircle },
};

const matchesFilter = (status: RegistrationStatus, filter: FilterKey) =>
  filter === 'all' ||
  (filter === 'closed' ? status === 'declined' || status === 'cancelled' : status === filter);

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

function formatWhen(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date);
  return `${day} · ${time}`;
}

function goTo(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const pillBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold backdrop-blur-xl transition';
const pillIdle =
  'border-white/75 bg-white/45 text-[#18181B]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] hover:bg-white/75';

interface RegistrationCardProps {
  row: Registration;
  index: number;
  cancelling: boolean;
  onViewPass: () => void;
  onCancel: () => Promise<void>;
}

function RegistrationCard({ row, index, cancelling, onViewPass, onCancel }: RegistrationCardProps) {
  const [confirming, setConfirming] = useState(false);
  const ev = row.events;
  const meta = STATUS_META[row.status];
  const canCancel = !row.checked_in && (row.status === 'approved' || row.status === 'pending');

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.05 }}
      className="liquid-glass flex flex-col p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-xl ${
            ev.visibility === 'exclusive'
              ? 'border-amber-200/80 bg-amber-100/60 text-amber-800'
              : 'border-white/75 bg-white/45 text-[#18181B]/70'
          }`}
        >
          {ev.visibility === 'exclusive' ? <Lock size={11} /> : <Globe size={11} />}
          {ev.visibility === 'exclusive' ? 'Exclusive' : 'Public'}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${meta.badge}`}
        >
          <meta.Icon size={12} />
          {meta.label}
        </span>
        {row.checked_in && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/90 px-3 py-1 text-[11px] font-bold text-violet-700">
            <CheckCircle2 size={12} />
            Checked In
          </span>
        )}
      </div>

      <h2 className="mt-4 text-xl font-extrabold leading-tight tracking-tight text-[#18181B]">
        {ev.title}
      </h2>

      <div className="mt-4 space-y-2.5 text-sm font-semibold text-[#18181B]/75">
        <p className="flex items-center gap-2.5">
          <CalendarDays size={16} className="shrink-0 text-violet-600" />
          {formatWhen(ev.event_date)}
        </p>
        <p className="flex items-center gap-2.5">
          <MapPin size={16} className="shrink-0 text-violet-600" />
          <span className="truncate">{ev.venue}</span>
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/50 px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#18181B]/50">
          Ticket code
        </span>
        <span className="truncate font-mono text-sm font-semibold tracking-[0.14em] text-[#18181B]">
          {row.ticket_code}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onViewPass}
          className="liquid-btn-primary inline-flex items-center gap-2 px-5 text-sm"
        >
          <QrCode size={16} />
          View QR Pass
        </button>

        {canCancel && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={cancelling}
            className={`${pillBase} ${pillIdle} h-11 px-4 text-rose-700 disabled:opacity-60`}
          >
            Cancel Attendance
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {canCancel && confirming && (
          <motion.div
            role="alertdialog"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-100/60 p-4">
              <p className="text-sm font-bold text-rose-800">Cancel your attendance?</p>
              <p className="mt-0.5 text-xs font-medium text-rose-800/80">
                Your QR pass will stop working. This can’t be undone from here.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={async () => {
                    await onCancel();
                    setConfirming(false);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {cancelling && <Loader2 size={14} className="animate-spin" />}
                  Yes, cancel
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setConfirming(false)}
                  className={`${pillBase} ${pillIdle} h-10 px-4`}
                >
                  Keep my spot
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

interface PassModalProps {
  row: Registration;
  onClose: () => void;
}

function PassModal({ row, onClose }: PassModalProps) {
  const ev = row.events;
  const meta = STATUS_META[row.status];
  const isApproved = row.status === 'approved';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lockedMessage =
    row.status === 'pending'
      ? `Your request is under review. Once the organizer approves it, your QR pass will be sent to ${row.email}.`
      : row.status === 'declined'
        ? 'The organizer couldn’t approve your registration for this event, so no QR pass was issued.'
        : 'You cancelled your attendance. This QR pass is no longer valid.';

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`QR pass for ${ev.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#18181B]/45 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="liquid-glass relative w-full max-w-sm overflow-hidden bg-white/70"
      >
        <div className="bg-gradient-to-br from-[#BBAEEC]/70 via-[#F0C9EF]/60 to-[#F1C9CF]/60 px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/80 text-[#18181B] shadow-sm transition hover:bg-white"
          >
            <X size={16} />
          </button>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#18181B]/60">
            {meta.label}
          </p>
          <h3 className="mt-1.5 pr-10 text-xl font-extrabold leading-tight tracking-tight text-[#18181B]">
            {ev.title}
          </h3>
          <p className="mt-2 text-sm font-medium text-[#18181B]/70">{formatWhen(ev.event_date)}</p>
          <p className="mt-0.5 text-sm font-medium text-[#18181B]/70">{ev.venue}</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 pb-7 pt-6">
          {isApproved ? (
            <>
              <div className="rounded-2xl bg-white p-4 shadow-[0_12px_28px_-10px_rgba(24,24,27,0.25)]">
                <QRCodeSVG
                  value={row.ticket_code}
                  size={200}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#18181B"
                />
              </div>
              <p className="font-mono text-sm font-semibold tracking-[0.2em] text-[#18181B]">
                {row.ticket_code}
              </p>
              {row.checked_in ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/90 px-3.5 py-1.5 text-xs font-bold text-violet-700">
                  <CheckCircle2 size={13} />
                  Checked In{row.checked_in_at ? ` · ${formatWhen(row.checked_in_at)}` : ''}
                </span>
              ) : (
                <p className="text-center text-xs font-medium text-[#18181B]/55">
                  Present this QR code at the gate for check-in.
                </p>
              )}
            </>
          ) : (
            <>
              <span
                className={`flex size-14 items-center justify-center rounded-full ${meta.badge}`}
              >
                <meta.Icon size={26} />
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${meta.badge}`}
              >
                <Lock size={12} />
                QR Locked · {meta.label}
              </span>
              <p className="text-center text-xs font-medium text-[#18181B]/60">{lockedMessage}</p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface GuestDashboardPageProps {
  user: UserProfile;
  onSignOut: () => void | Promise<void>;
}

export default function GuestDashboardPage({ user, onSignOut }: GuestDashboardPageProps) {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [passId, setPassId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('attendees')
      .select(`*, events(${EVENT_FIELDS})`)
      .ilike('email', escapeLike(user.email))
      .order('events(event_date)', { ascending: true });
    if (error) {
      setLoadError('We couldn’t load your passes. Please try again.');
      setLoading(false);
      return;
    }
    const list = ((data ?? []) as unknown as Registration[])
      .filter((r) => r.events)
      .sort(
        (a, b) => new Date(a.events.event_date).getTime() - new Date(b.events.event_date).getTime(),
      );
    setRows(list);
    setLoading(false);
  }, [user.email]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      approved: rows.filter((r) => r.status === 'approved').length,
      pending: rows.filter((r) => r.status === 'pending').length,
      closed: rows.filter((r) => r.status === 'declined' || r.status === 'cancelled').length,
    }),
    [rows],
  );

  const visibleRows = useMemo(
    () => rows.filter((r) => matchesFilter(r.status, filter)),
    [rows, filter],
  );

  const activePass = useMemo(() => rows.find((r) => r.id === passId) ?? null, [rows, passId]);
  const closePass = useCallback(() => setPassId(null), []);

  const handleCancel = async (row: Registration) => {
    setActionError(null);
    setCancellingId(row.id);
    const previous = row.status;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'cancelled' } : r)));

    const { data, error } = await supabase
      .from('attendees')
      .update({ status: 'cancelled' })
      .eq('id', row.id)
      .eq('checked_in', false)
      .in('status', ['approved', 'pending'])
      .select('id');

    if (error || !data || data.length === 0) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r)));
      setActionError(
        'We couldn’t cancel that registration. It may already be checked in. Please try again.',
      );
    }
    setCancellingId(null);
  };

  return (
    <div className="pastel-mesh-bg min-h-screen px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-16">
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/45 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#18181B]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl">
              <Ticket size={12} />
              My Passes
            </span>
            <div className="flex max-w-full items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#18181B] shadow-sm backdrop-blur-xl">
              <User size={14} className="shrink-0 text-violet-600" />
              <span className="max-w-[140px] truncate sm:max-w-[240px]">{user.email}</span>
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => goTo('/admin')}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
                >
                  <LayoutDashboard size={12} />
                  Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#18181B] px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-[#18181B] sm:text-4xl lg:text-5xl">
            Your event passes.
          </h1>
          <p className="mt-2 max-w-xl text-base font-medium text-[#18181B]/65">
            Every registration made with {user.email}, with live approval status and QR passes.
          </p>
        </motion.header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter passes">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`${pillBase} ${
                  filter === f.key
                    ? 'border-[#18181B] bg-[#18181B] text-white'
                    : pillIdle
                }`}
              >
                {f.label}
                <span
                  className={`font-mono text-[10px] ${
                    filter === f.key ? 'text-white/70' : 'text-[#18181B]/45'
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo('/register')}
            className="liquid-btn-primary inline-flex items-center gap-2 px-5 text-sm"
          >
            Browse Public Events
            <ArrowRight size={16} />
          </button>
        </div>

        {!loading && !loadError && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass-dark mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4"
          >
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Ready to scan
              </p>
              <p className="text-2xl font-extrabold text-white">{counts.approved}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Awaiting approval
              </p>
              <p className="text-2xl font-extrabold text-white">{counts.pending}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {actionError && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-6 flex items-start gap-2 rounded-2xl bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-700"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {actionError}
            </motion.p>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <Loader2 size={28} className="animate-spin text-[#18181B]/70" />
            <p className="text-sm font-semibold text-[#18181B]/70">Loading your passes…</p>
          </div>
        ) : loadError ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <AlertCircle size={28} className="text-rose-600" />
            <p className="text-sm font-semibold text-[#18181B]/80">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-4 py-2 text-xs font-bold text-white"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <Ticket size={28} className="text-[#18181B]/60" />
            <p className="text-sm font-semibold text-[#18181B]/70">
              You haven’t registered for any events with this email yet.
            </p>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="liquid-glass mx-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <CalendarDays size={28} className="text-[#18181B]/60" />
            <p className="text-sm font-semibold text-[#18181B]/70">
              No registrations match this filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {visibleRows.map((row, i) => (
                <RegistrationCard
                  key={row.id}
                  row={row}
                  index={i}
                  cancelling={cancellingId === row.id}
                  onViewPass={() => setPassId(row.id)}
                  onCancel={() => handleCancel(row)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activePass && <PassModal key={activePass.id} row={activePass} onClose={closePass} />}
      </AnimatePresence>
    </div>
  );
}