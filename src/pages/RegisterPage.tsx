import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Ticket,
  User,
} from 'lucide-react';
import type { Attendee, EventItem } from '../types/database';

// TODO: Phase 3 Supabase — fetch event by :slug from `events` table
const MOCK_EVENT: EventItem = {
  id: 'evt_7f3a91c2-5b0d-4e8a-9c1f-2d6e4a8b0c13',
  slug: 'innovate-summit-2026',
  title: 'Innovate Summit 2026',
  description: 'A one-day gathering of builders, founders, and designers.',
  event_date: '2026-12-12T09:00:00+08:00',
  venue: 'SMX Convention Center, Pasay City, Metro Manila',
  is_active: true,
  created_at: '2026-10-01T08:00:00+08:00',
};

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

function generateMockTicketCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
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
          className="liquid-pill-input pl-16"
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

  return (
    <div className="liquid-glass overflow-hidden">
      {/* Pass header */}
      <div className="relative bg-gradient-to-br from-[#BBAEEC]/70 via-[#F0C9EF]/60 to-[#F1C9CF]/60 px-7 pb-6 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#18181B]/60">
              {confirmed ? 'Confirmed Pass' : 'Live Preview'}
            </p>
            <h2 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight text-[#18181B]">
              {event.title}
            </h2>
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] ${
              confirmed ? 'bg-emerald-500 text-white' : 'bg-white/80 text-[#18181B]'
            }`}
          >
            {confirmed ? <CheckCircle2 size={22} /> : <Ticket size={20} />}
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
        <div className="flex flex-col items-center gap-3 pt-1">
          <div
            className={`relative rounded-2xl bg-white p-4 shadow-[0_12px_28px_-10px_rgba(24,24,27,0.25)] transition-all duration-500 ${
              confirmed ? '' : 'opacity-60'
            }`}
          >
            <div className={confirmed ? '' : 'blur-[3px]'}>
              <QRCodeSVG
                value={attendee.ticket_code}
                size={168}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#18181B"
              />
            </div>
            {!confirmed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-[#18181B] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
                  Pending
                </span>
              </div>
            )}
          </div>
          <p className="font-mono text-sm font-semibold tracking-[0.2em] text-[#18181B]">
            {confirmed ? attendee.ticket_code : '— — — — — — — —'}
          </p>
          <p className="text-center text-xs font-medium text-[#18181B]/55">
            {confirmed
              ? 'Present this QR code at the gate for check-in.'
              : 'Your QR pass unlocks once you register.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  // TODO: Phase 3 Supabase — replace with event loaded via route :slug
  const event = MOCK_EVENT;
  const { day, time } = formatEventDate(event.event_date);

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Attendee | null>(null);

  const errors = useMemo(() => validate(values), [values]);
  const visibleErrors: FormErrors = Object.fromEntries(
    Object.entries(errors).filter(([key]) => touched[key as keyof FormValues]),
  );

  const previewAttendee: Attendee = {
    id: 'preview',
    event_id: event.id,
    ticket_code: 'EVT-PREVIEW',
    full_name: values.full_name,
    email: values.email,
    organization: values.organization,
    contact_number: values.contact_number,
    checked_in: false,
    checked_in_at: null,
    created_at: new Date().toISOString(),
  };

  const handleChange =
    (field: keyof FormValues) => (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleBlur = (field: keyof FormValues) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({
      full_name: true,
      email: true,
      organization: true,
      contact_number: true,
    });
    if (Object.keys(errors).length > 0 || submitting) return;

    setSubmitting(true);
    // TODO: Phase 3 Supabase — insert into `attendees`, receive real ticket_code
    // TODO: Phase 4 — trigger Edge Function for Resend QR ticket email
    window.setTimeout(() => {
      setConfirmed({
        id: crypto.randomUUID(),
        event_id: event.id,
        ticket_code: generateMockTicketCode(),
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        organization: values.organization.trim(),
        contact_number: values.contact_number.trim(),
        checked_in: false,
        checked_in_at: null,
        created_at: new Date().toISOString(),
      });
      setSubmitting(false);
    }, 900);
  };

  const handleReset = () => {
    setConfirmed(null);
    setValues(EMPTY_FORM);
    setTouched({});
  };

  return (
    <div className="pastel-mesh-bg min-h-screen px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/45 px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#18181B]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] backdrop-blur-xl">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Registration Open
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#18181B] sm:text-5xl">
            Reserve your spot.
          </h1>
          <p className="mt-2 max-w-xl text-base font-medium text-[#18181B]/65">
            Fill in your details and get an instant QR pass for {event.title}.
          </p>
        </motion.header>

        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
          {/* ---------- Left column ---------- */}
          <div className="flex flex-col gap-6">
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
                Your pass updates live as you type.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
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

                <button
                  type="submit"
                  disabled={submitting || confirmed !== null}
                  className="liquid-btn-primary mt-2 w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating pass…
                    </>
                  ) : (
                    <>
                      Register &amp; get my pass
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
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
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#18181B]/70">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      A copy will be sent to {confirmed.email}
                    </p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-[#18181B] px-6 text-sm font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_10px_24px_-8px_rgba(24,24,27,0.5)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
                    >
                      <RotateCcw size={16} />
                      Register Another Guest
                    </button>
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