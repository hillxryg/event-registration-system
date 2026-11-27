import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Ticket,
  User,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Attendee, EventItem, RegistrationStatus, UserProfile } from '../types/database';
import { supabase } from '../lib/supabase';

const getSlugFromPath = (): string | null => {
  const [, , slug] = window.location.pathname.split('/');
  return slug ? decodeURIComponent(slug) : null;
};

const AUTH_REDIRECT_KEY = 'passflow_auth_redirect';
const ticketStorageKey = (eventId: string) => `passflow_ticket_${eventId}`;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

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

function writeStoredTicketId(eventId: string, attendeeId: string) {
  try {
    window.localStorage.setItem(ticketStorageKey(eventId), attendeeId);
  } catch {
    /* storage unavailable */
  }
}

function clearStoredTicketId(eventId: string) {
  try {
    window.localStorage.removeItem(ticketStorageKey(eventId));
  } catch {
    /* storage unavailable */
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

const EVENT_COLUMNS =
  'id, slug, title, description, event_date, venue, visibility, status, created_at';

type FormValues = Pick<
  Attendee,
  'full_name' | 'email' | 'organization' | 'contact_number'
>;
type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_FORM: FormValues = {
  full_name: '',
  email: '',
  organization: '',
  contact_number: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,18}$/;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (values.full_name.trim().length < 2) {
    errors.full_name = 'Please enter your full name.';
  }
  if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.organization.trim().length < 2) {
    errors.organization = 'Organization is required.';
  }
  if (!PHONE_RE.test(values.contact_number.trim())) {
    errors.contact_number = 'Enter a valid contact number.';
  }
  return errors;
}

function generateTicketCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `EVT-${code}`;
}

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

interface FieldProps {
  id: keyof FormValues;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel';
  value: string;
  error?: string;
  icon: React.ReactNode;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  value,
  error,
  icon,
  onChange,
  onBlur,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 ml-5 block text-xs font-bold uppercase tracking-wider text-[#18181B]/60"
      >
        {label}
      </label>
      <div className="relative">
        <span
          className={`pointer-events-none absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_-2px_rgba(24,24,27,0.18),inset_0_1px_1px_rgba(255,255,255,1)] ${
            error ? 'text-rose-600' : 'text-[#18181B]'
          }`}
        >
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          className="liquid-pill-input pl-14"
        />
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="ml-5 mt-2 flex items-center gap-1.5 overflow-hidden text-xs font-semibold text-rose-600"
          >
            <AlertCircle size={13} />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PassProps {
  event: EventItem;
  attendee: Attendee;
  confirmed: boolean;
}

function DigitalPass({ event, attendee, confirmed }: PassProps) {
  const { day, time } = formatEventDate(event.event_date);
  const hasName = attendee.full_name.trim().length > 0;
  const hasOrg = attendee.organization.trim().length > 0;
  const hasPhone = attendee.contact_number.trim().length > 0;
  const isApproved = confirmed && attendee.status === 'approved';
  const isPending = confirmed && attendee.status === 'pending';
  const isDeclined = confirmed && attendee.status === 'declined';
  const isCancelled = confirmed && attendee.status === 'cancelled';
  const isVoid = isDeclined || isCancelled;
  const voidTitle = isCancelled ? 'Registration Cancelled' : 'Registration Declined';

  return (
    <div className="liquid-glass overflow-hidden">
      {/* Pass header */}
      <div className="relative bg-gradient-to-br from-[#BBAEEC]/70 via-[#F0C9EF]/60 to-[#F1C9CF]/60 px-7 pb-6 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#18181B]/60">
              {isApproved
                ? 'Confirmed Pass'
                : isPending
                  ? 'Pending Approval'
                  : isVoid
                    ? voidTitle
                    : 'Live Preview'}
            </p>
            <h2 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight text-[#18181B]">
              {event.title}
            </h2>
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] ${
              isApproved
                ? 'bg-emerald-500 text-white'
                : isPending
                  ? 'bg-amber-400 text-white'
                  : isVoid
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/80 text-[#18181B]'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 size={22} />
            ) : isPending ? (
              <Clock size={20} />
            ) : isVoid ? (
              <XCircle size={22} />
            ) : (
              <Ticket size={20} />
            )}
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-[#18181B]/70">
          {day} · {time}
        </p>
      </div>

      {/* Perforation */}
      <div className="relative h-0">
        <div className="absolute -left-3 -top-3 size-6 rounded-full bg-[#D0E7F6]/80 shadow-[inset_-2px_0_3px_rgba(24,24,27,0.08)]" />
        <div className="absolute -right-3 -top-3 size-6 rounded-full bg-[#F1C9CF]/80 shadow-[inset_2px_0_3px_rgba(24,24,27,0.08)]" />
        <div className="mx-6 border-t-2 border-dashed border-[#18181B]/15" />
      </div>

      {/* Attendee body */}
      <div className="space-y-5 px-7 pb-7 pt-7">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <div className="col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#18181B]/50">
              Attendee
            </p>
            <motion.p
              key={attendee.full_name}
              initial={{ opacity: 0.4, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-1 truncate text-xl font-bold ${
                hasName ? 'text-[#18181B]' : 'text-[#18181B]/30'
              }`}
            >
              {hasName ? attendee.full_name : 'Your Name'}
            </motion.p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#18181B]/50">
              Organization
            </p>
            <p
              className={`mt-1 truncate text-sm font-semibold ${
                hasOrg ? 'text-[#18181B]' : 'text-[#18181B]/30'
              }`}
            >
              {hasOrg ? attendee.organization : 'Your Company'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#18181B]/50">
              Contact
            </p>
            <p
              className={`mt-1 truncate font-mono text-sm font-medium ${
                hasPhone ? 'text-[#18181B]' : 'text-[#18181B]/30'
              }`}
            >
              {hasPhone ? attendee.contact_number : '+63 900 000 0000'}
            </p>
          </div>
        </div>

        {/* QR safe zone */}
        {isVoid ? (
          <div className="flex flex-col items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/90 px-3.5 py-1.5 text-xs font-bold text-rose-700">
              <XCircle size={13} />
              {voidTitle}
            </span>
            <p className="text-center text-xs font-medium text-[#18181B]/60">
              {isCancelled
                ? 'This registration was cancelled, so the QR pass is no longer valid.'
                : 'The organizer couldn’t approve your registration for this event, so no QR pass was issued.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-1">
            <div
              className={`relative rounded-2xl bg-white p-4 shadow-[0_12px_28px_-10px_rgba(24,24,27,0.25)] transition-all duration-500 ${
                isApproved ? '' : 'opacity-60'
              }`}
            >
              <div className={isApproved ? '' : 'blur-[3px]'}>
                <QRCodeSVG
                  value={isApproved ? attendee.ticket_code : 'LOCKED'}
                  size={168}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#18181B"
                />
              </div>
              {!isApproved && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
                    {isPending && <Lock size={11} />}
                    {isPending ? 'Locked' : 'Pending'}
                  </span>
                </div>
              )}
            </div>
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-3.5 py-1.5 text-xs font-bold text-amber-700">
                <Clock size={13} />
                Waiting for Admin Approval
              </span>
            )}
            <p className="font-mono text-sm font-semibold tracking-[0.2em] text-[#18181B]">
              {isApproved ? attendee.ticket_code : '— — — — — — — —'}
            </p>
            <p className="text-center text-xs font-medium text-[#18181B]/55">
              {isApproved
                ? 'Present this QR code at the gate for check-in.'
                : isPending
                  ? `Your request is under review. Once approved by the organizer, your QR pass and confirmation will be sent to ${attendee.email}.`
                  : 'Your QR pass unlocks once you register.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RegisterPageProps {
  viewer?: UserProfile | null;
  /** Render inside AdminShell (drops the standalone background and top padding). */
  embedded?: boolean;
}

export default function RegisterPage({ viewer = null, embedded = false }: RegisterPageProps) {
  const [slug, setSlug] = useState<string | null>(getSlugFromPath);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Attendee | null>(null);
  const [existingReg, setExistingReg] = useState<Attendee | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(Boolean(viewer));
  const [duplicateAttempt, setDuplicateAttempt] = useState(false);

  const errors = useMemo(() => validate(values), [values]);
  const visibleErrors: FormErrors = Object.fromEntries(
    Object.entries(errors).filter(([key]) => touched[key as keyof FormValues]),
  );

  // Keep :slug in sync (directory <-> event navigation uses pushState + popstate)
  useEffect(() => {
    const onPopState = () => setSlug(getSlugFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load a single event by :slug
  useEffect(() => {
    let cancelled = false;
    setEvent(null);
    setLoadError(null);
    setConfirmed(null);
    setExistingReg(null);
    setDuplicateAttempt(false);
    setValues(EMPTY_FORM);
    setTouched({});
    setSubmitError(null);

    if (!slug) {
      setLoadError('Choose an event to register for.');
      return () => {
        cancelled = true;
      };
    }

    setCheckingRegistration(true);
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('slug', slug)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoadError('We couldn’t find an event for this link.');
        return;
      }
      setEvent(data as EventItem);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, viewer?.id]);

  // Existing registration check + pre-fill (signed-in email match first, then localStorage ticket id)
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setIsSignedIn(Boolean(user));

      let existing: Attendee | null = null;

      if (user?.email) {
        const { data } = await supabase
          .from('attendees')
          .select('*')
          .eq('event_id', event.id)
          .ilike('email', escapeLike(user.email))
          .limit(1)
          .maybeSingle();
        existing = (data as Attendee | null) ?? null;
      }

      if (!existing) {
        const storedId = readStoredTicketId(event.id);
        if (storedId) {
          const { data } = await supabase
            .from('attendees')
            .select('*')
            .eq('id', storedId)
            .eq('event_id', event.id)
            .maybeSingle();
          existing = (data as Attendee | null) ?? null;
        }
      }
      if (cancelled) return;

      if (existing) {
        writeStoredTicketId(event.id, existing.id);
        setExistingReg(existing);
        setConfirmed(existing);
        setValues({
          full_name: existing.full_name,
          email: existing.email,
          organization: existing.organization,
          contact_number: existing.contact_number,
        });
        setCheckingRegistration(false);
        return;
      }

      if (user) {
        setValues((prev) => ({
          ...prev,
          email: prev.email || user.email || '',
          full_name:
            prev.full_name || ((user.user_metadata?.full_name as string | undefined) ?? ''),
        }));
      }
      setCheckingRegistration(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [event, viewer?.id]);

  const handleChange =
    (field: keyof FormValues) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleBlur = (field: keyof FormValues) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({
      full_name: true,
      email: true,
      organization: true,
      contact_number: true,
    });
    if (!event || event.status !== 'active' || Object.keys(errors).length > 0 || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setDuplicateAttempt(false);

    const payload = {
      event_id: event.id,
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      organization: values.organization.trim(),
      contact_number: values.contact_number.trim(),
      status: event.visibility === 'exclusive' ? 'pending' : 'approved',
    };

    let created: Attendee | null = null;
    let failure: { code?: string; message: string; details?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase
        .from('attendees')
        .insert({ ...payload, ticket_code: generateTicketCode() })
        .select()
        .single();
      if (!error) {
        created = data as Attendee;
        break;
      }
      failure = error;
      const ticketCollision =
        error.code === '23505' && `${error.message} ${error.details ?? ''}`.includes('ticket_code');
      if (!ticketCollision) break;
    }

    if (created) {
      writeStoredTicketId(event.id, created.id);
      setConfirmed(created);
      if (created.status === 'approved') {
        const { error: fnError } = await supabase.functions.invoke('send-ticket-email', {
          body: { attendee_id: created.id },
        });
        if (fnError) {
          setSubmitError(`Pass generated, but email failed: ${fnError.message}`);
        }
      }
    } else {
      setDuplicateAttempt(failure?.code === '23505');
      setSubmitError(
        failure?.code === '23505'
          ? 'You’re already registered for this event with this email. Check your inbox for your pass, or sign in with the email you registered with.'
          : 'We couldn’t complete your registration. Please try again.',
      );
    }
    setSubmitting(false);
  };

  const handleSignInRedirect = () => {
    try {
      window.sessionStorage.setItem(AUTH_REDIRECT_KEY, window.location.pathname);
    } catch {
      /* storage unavailable */
    }
    goTo('/');
  };

  const handleReset = () => {
    if (event) clearStoredTicketId(event.id);
    setConfirmed(null);
    setExistingReg(null);
    setDuplicateAttempt(false);
    setValues(EMPTY_FORM);
    setTouched({});
    setSubmitError(null);
  };

  const backToDirectory = () => {
    goTo('/events');
  };

  const pageShell = embedded
    ? 'min-w-0 pb-4'
    : 'pastel-mesh-bg min-h-screen px-4 pb-10 pt-24 sm:px-6 lg:px-10 lg:pb-16';
  const centerShell = embedded
    ? 'flex min-h-[60vh] items-center justify-center px-4'
    : 'pastel-mesh-bg flex min-h-screen items-center justify-center px-4';

  if (!event || checkingRegistration) {
    return (
      <div className={centerShell}>
        <div className="liquid-glass flex max-w-sm flex-col items-center gap-3 p-8 text-center">
          {loadError ? (
            <>
              <AlertCircle size={28} className="text-rose-600" />
              <p className="text-sm font-semibold text-[#18181B]/80">{loadError}</p>
              <button
                type="button"
                onClick={backToDirectory}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#18181B] px-4 py-2 text-xs font-bold text-white"
              >
                <ArrowLeft size={13} />
                View Public Events
              </button>
            </>
          ) : (
            <>
              <Loader2 size={28} className="animate-spin text-[#18181B]/70" />
              <p className="text-sm font-semibold text-[#18181B]/70">Loading event…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { day, time } = formatEventDate(event.event_date);
  const isClosed = event.status === 'closed';
  const isCancelled = event.status === 'cancelled';
  const registrationLocked = isClosed || isCancelled;
  const existingMeta = existingReg ? REG_STATUS_META[existingReg.status] : null;

  const previewAttendee: Attendee = {
    id: 'preview',
    event_id: event.id,
    ticket_code: 'EVT-PREVIEW',
    full_name: values.full_name,
    email: values.email,
    organization: values.organization,
    contact_number: values.contact_number,
    status: 'pending',
    checked_in: false,
    checked_in_at: null,
    created_at: new Date().toISOString(),
  };

  return (
    <div className={pageShell}>
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-12"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={backToDirectory}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/75 bg-white/45 px-3.5 py-1.5 text-xs font-bold text-[#18181B]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl transition hover:bg-white/75"
            >
              <ArrowLeft size={13} />
              All Events
            </button>
            {isClosed ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-100/70 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800 backdrop-blur-xl">
                <Clock size={12} />
                Registration Closed
              </span>
            ) : isCancelled ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-rose-100/70 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700 backdrop-blur-xl">
                <XCircle size={12} />
                Event Cancelled
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/45 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#18181B]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Registration Open
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-xl ${
                event.visibility === 'exclusive'
                  ? 'border-amber-200/80 bg-amber-100/60 text-amber-800'
                  : 'border-white/75 bg-white/45 text-[#18181B]/70'
              }`}
            >
              {event.visibility === 'exclusive' ? <Lock size={12} /> : <Globe size={12} />}
              {event.visibility === 'exclusive' ? 'Exclusive · Approval Required' : 'Public Event'}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#18181B] sm:text-4xl lg:text-5xl">
            Reserve your spot.
          </h1>
          <p className="mt-2 max-w-xl text-base font-medium text-[#18181B]/65">
            {event.visibility === 'exclusive'
              ? `Submit your details for ${event.title}. Your QR pass is issued once the organizer approves your request.`
              : `Fill in your details and get an instant QR pass for ${event.title}.`}
          </p>
        </motion.header>

        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
          {/* ---------- Left column ---------- */}
          <div className="flex flex-col gap-6">
            {!confirmed && !isSignedIn && (
              <motion.button
                type="button"
                onClick={handleSignInRedirect}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="liquid-glass flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:-translate-y-0.5"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-[#18181B]/75">
                  <LogIn size={15} className="shrink-0 text-violet-600" />
                  Already signed up for this event? Sign in to check status
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#18181B]/60" />
              </motion.button>
            )}

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="liquid-glass p-6 sm:p-8"
            >
              <h2 className="text-xl font-extrabold tracking-tight text-[#18181B]">
                Guest details
              </h2>
              <p className="mb-6 mt-1 text-sm font-medium text-[#18181B]/60">
                {existingReg
                  ? 'Your saved registration details.'
                  : 'Your pass updates live as you type.'}
              </p>

              {existingReg && existingMeta && (
                <div
                  role="status"
                  className="mb-6 flex min-w-0 flex-col gap-3 rounded-2xl border border-white/75 bg-white/55 px-4 py-3.5 backdrop-blur-xl"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-violet-600" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-[#18181B]">
                        You’re already registered for this event
                      </p>
                      <span
                        className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${existingMeta.badge}`}
                      >
                        <existingMeta.Icon size={12} className="shrink-0" />
                        <span className="truncate">{existingMeta.label}</span>
                      </span>
                    </div>
                  </div>
                  {isSignedIn && (
                    <button
                      type="button"
                      onClick={() => goTo('/my-passes')}
                      className="liquid-btn-primary inline-flex w-full items-center justify-center gap-2 px-5 text-sm sm:w-auto sm:self-start"
                    >
                      View in My Passes
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}

              {registrationLocked && (
                <div
                  role="status"
                  className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                    isClosed
                      ? 'border-amber-200/80 bg-amber-100/60 text-amber-800'
                      : 'border-rose-200/80 bg-rose-100/60 text-rose-800'
                  }`}
                >
                  {isClosed ? (
                    <Clock size={16} className="mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      {isClosed ? 'Registration Closed' : 'Event Cancelled'}
                    </p>
                    <p className="mt-0.5 text-xs font-medium">
                      {isClosed
                        ? 'Registration for this event has closed. If you already registered, sign in with your registered email to view your pass.'
                        : 'This event has been cancelled by the organizer.'}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <fieldset
                  disabled={registrationLocked || existingReg !== null}
                  className="m-0 min-w-0 space-y-5 border-0 p-0 disabled:opacity-60"
                >
                  <Field
                    id="full_name"
                    label="Full name"
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                    value={values.full_name}
                    error={visibleErrors.full_name}
                    icon={<User size={18} />}
                    onChange={handleChange('full_name')}
                    onBlur={handleBlur('full_name')}
                  />
                  <Field
                    id="email"
                    label="Email address"
                    type="email"
                    inputMode="email"
                    placeholder="juan@company.com"
                    autoComplete="email"
                    value={values.email}
                    error={visibleErrors.email}
                    icon={<Mail size={18} />}
                    onChange={handleChange('email')}
                    onBlur={handleBlur('email')}
                  />
                  <Field
                    id="organization"
                    label="Organization"
                    placeholder="Acme Corporation"
                    autoComplete="organization"
                    value={values.organization}
                    error={visibleErrors.organization}
                    icon={<Building2 size={18} />}
                    onChange={handleChange('organization')}
                    onBlur={handleBlur('organization')}
                  />
                  <Field
                    id="contact_number"
                    label="Contact number"
                    type="tel"
                    inputMode="tel"
                    placeholder="+63 917 123 4567"
                    autoComplete="tel"
                    value={values.contact_number}
                    error={visibleErrors.contact_number}
                    icon={<Phone size={18} />}
                    onChange={handleChange('contact_number')}
                    onBlur={handleBlur('contact_number')}
                  />

                  <AnimatePresence initial={false}>
                    {submitError && (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-start gap-2 rounded-2xl bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-700"
                      >
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        {submitError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={submitting || confirmed !== null || registrationLocked}
                    className="liquid-btn-primary mt-2 w-full gap-2 px-4 text-sm sm:text-base"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {event.visibility === 'exclusive' ? 'Submitting request…' : 'Generating pass…'}
                      </>
                    ) : (
                      <>
                        {event.visibility === 'exclusive' ? 'Request to join' : 'Register & get my pass'}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  {duplicateAttempt && !isSignedIn && (
                    <button
                      type="button"
                      onClick={handleSignInRedirect}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#18181B] px-6 text-sm font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_10px_24px_-8px_rgba(24,24,27,0.5)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                    >
                      <LogIn size={16} />
                      Sign In to Check Status
                    </button>
                  )}
                </fieldset>
              </form>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="liquid-glass-dark p-6 sm:p-8"
            >
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                Event details
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {event.title}
              </h2>
              {event.description && (
                <p className="mt-2 text-sm font-medium text-white/60">
                  {event.description}
                </p>
              )}
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#BBAEEC] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                    <CalendarDays size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{day}</p>
                    <p className="font-mono text-xs text-white/55">{time} onwards</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#F0C9EF] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                    <MapPin size={19} />
                  </span>
                  <p className="text-sm font-bold leading-snug">{event.venue}</p>
                </div>
              </div>
            </motion.section>
          </div>

          {/* ---------- Right column ---------- */}
          <div className="lg:sticky lg:top-8">
            <AnimatePresence mode="wait">
              {confirmed ? (
                <motion.div
                  key="confirmed"
                  initial={{ opacity: 0, scale: 0.92, y: 24, rotateX: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -16 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                  style={{ transformPerspective: 1000 }}
                >
                  <DigitalPass event={event} attendee={confirmed} confirmed />
                  <div className="mt-5 flex flex-col items-center gap-3">
                    {confirmed.status === 'approved' && (
                      <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[#18181B]/70">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        A copy will be sent to {confirmed.email}
                      </p>
                    )}
                    {!registrationLocked && !existingReg && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[#18181B] px-6 text-sm font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_10px_24px_-8px_rgba(24,24,27,0.5)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] sm:w-auto"
                      >
                        <RotateCcw size={16} />
                        Register Another Guest
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -16 }}
                  transition={{ duration: 0.4 }}
                >
                  <DigitalPass
                    event={event}
                    attendee={previewAttendee}
                    confirmed={false}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}