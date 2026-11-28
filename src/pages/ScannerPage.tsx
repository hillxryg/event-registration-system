import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft,
  Lock,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CameraOff,
  Delete,
  Loader2,
  User,
  Mail,
  Building2,
  Phone,
} from 'lucide-react';
import type { CheckInResponse, EventItem } from '../types/database';
import { supabase } from '../lib/supabase';

const READER_ID = 'qr-reader';
const SAME_CODE_GAP_MS = 3000; // QR must leave the frame this long before the same code can scan again

const getSlugFromPath = (): string | null => {
  const [, , slug] = window.location.pathname.split('/');
  return slug ? decodeURIComponent(slug) : null;
};

const goBackToDashboard = () => {
  window.history.pushState({}, '', '/admin');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

function BackToDashboardButton() {
  return (
    <button
      type="button"
      onClick={goBackToDashboard}
      className="liquid-glass fixed left-4 top-4 z-40 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/60"
    >
      <ArrowLeft size={14} />
      Dashboard
    </button>
  );
}

type ScanState = 'ready' | 'valid' | 'already_checked_in' | 'invalid';

const STATUS_STYLE: Record<ScanState, { label: string; cls: string; Icon: typeof ScanLine }> = {
  ready: { label: 'Ready to scan', cls: 'bg-white/70 text-slate-700', Icon: ScanLine },
  valid: { label: 'Checked In', cls: 'bg-emerald-100/90 text-emerald-700', Icon: CheckCircle2 },
  already_checked_in: {
    label: 'Already Checked In',
    cls: 'bg-amber-100/90 text-amber-700',
    Icon: AlertTriangle,
  },
  invalid: { label: 'Invalid Ticket', cls: 'bg-rose-100/90 text-rose-700', Icon: XCircle },
};

export default function ScannerPage() {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [verifiedPin, setVerifiedPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pinMessage, setPinMessage] = useState('Incorrect PIN.');
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('ready');
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const processingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slug = getSlugFromPath();
      const base = supabase
        .from('events')
        .select('id, slug, title, event_date, venue, status')
        .in('status', ['active', 'closed']);
      const { data, error } = slug
        ? await base.eq('slug', slug).single()
        : await base.order('event_date', { ascending: true }).limit(1).single();
      if (cancelled) return;
      if (error || !data) {
        if (slug) {
          const { data: lookup } = await supabase
            .from('events')
            .select('status')
            .eq('slug', slug)
            .maybeSingle();
          if (cancelled) return;
          if (lookup?.status === 'cancelled') {
            setEventError('This event has been cancelled.');
            return;
          }
        }
        setEventError('No active event found for this link.');
      } else setEvent(data as EventItem);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const processTicket = useCallback(
    async (code: string) => {
      if (!event || processingRef.current) return;

      const nowMs = Date.now();
      const last = lastScanRef.current;
      const sameCode = last.code === code;
      const stillInFrame = nowMs - last.at < SAME_CODE_GAP_MS;

      // Same QR still in view: refresh timestamp and ignore
      if (sameCode && stillInFrame) {
        lastScanRef.current = { code, at: nowMs };
        return;
      }
      lastScanRef.current = { code, at: nowMs };

      processingRef.current = true;
      try {
        const { data, error } = await supabase.rpc('verify_and_checkin', {
          p_event_id: event.id,
          p_ticket_code: code,
          p_scanner_pin: verifiedPin,
        });

        if (error || !data) {
          setScanState('invalid');
          setResult({
            status: 'invalid',
            message: 'Could not verify ticket. Check your connection and try again.',
          });
          return;
        }

        const res = data as CheckInResponse;
        setScanState(res.status === 'unauthorized' ? 'invalid' : res.status);
        setResult(res);
      } finally {
        processingRef.current = false;
      }
    },
    [event, verifiedPin],
  );

  const decodeRef = useRef(processTicket);
  decodeRef.current = processTicket;

  // Camera lifecycle
  useEffect(() => {
    if (!unlocked) return;
    const scanner = new Html5Qrcode(READER_ID);
    let cancelled = false;
    let started = false;
    const teardown = () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => undefined);
    };

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => decodeRef.current(text.trim()),
        () => undefined,
      )
      .then(() => {
        started = true;
        if (cancelled) teardown();
      })
      .catch(() => setCameraError(true));

    return () => {
      cancelled = true;
      if (started) teardown();
    };
  }, [unlocked]);

  const pressKey = async (k: string) => {
    if (verifying || !event) return;
    setPinError(false);
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;

    setVerifying(true);
    const { data, error } = await supabase.rpc('verify_and_checkin', {
      p_event_id: event.id,
      p_ticket_code: '__PIN_CHECK__',
      p_scanner_pin: next,
    });
    setVerifying(false);

    const res = data as CheckInResponse | null;
    if (!error && res && res.status !== 'unauthorized') {
      setVerifiedPin(next);
      setUnlocked(true);
    } else {
      setPinMessage(error ? 'Could not verify PIN. Try again.' : 'Incorrect PIN.');
      setPinError(true);
      setTimeout(() => setPin(''), 400);
    }
  };

  /* ---------------- LOADING / EVENT ERROR ---------------- */
  if (!event) {
    return (
      <div className="pastel-mesh-bg flex min-h-screen items-center justify-center p-4">
        <div className="liquid-glass flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] p-8 text-center">
          {eventError ? (
            <>
              <XCircle size={28} className="text-rose-500" />
              <p className="text-sm text-slate-700">{eventError}</p>
              <button
                type="button"
                onClick={goBackToDashboard}
                className="liquid-glass mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-slate-700"
              >
                <ArrowLeft size={14} />
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <Loader2 size={28} className="animate-spin text-violet-500" />
              <p className="text-sm text-slate-600">Loading event…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- PIN GATE ---------------- */
  if (!unlocked) {
    return (
      <div className="pastel-mesh-bg min-h-screen flex items-center justify-center p-4 pt-16">
        <BackToDashboardButton />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass w-full max-w-sm rounded-[2rem] p-8 text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-violet-500 shadow-sm">
            <Lock size={24} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">Gate Staff Access</h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter the 4-digit scanner PIN for {event.title}.
          </p>

          <motion.div
            animate={pinError ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 flex justify-center gap-3"
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border transition ${
                  i < pin.length
                    ? pinError
                      ? 'bg-rose-400 border-rose-400'
                      : 'bg-violet-500 border-violet-500'
                    : 'border-slate-400/60 bg-white/40'
                }`}
              />
            ))}
          </motion.div>
          <p className="mt-3 h-4 text-xs text-rose-600">{pinError ? pinMessage : ''}</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                disabled={verifying}
                className="liquid-glass h-14 rounded-full text-lg font-medium text-slate-800 active:scale-95 transition disabled:opacity-60"
              >
                {k}
              </button>
            ))}
            <span />
            <button
              onClick={() => pressKey('0')}
              disabled={verifying}
              className="liquid-glass h-14 rounded-full text-lg font-medium text-slate-800 active:scale-95 transition disabled:opacity-60"
            >
              0
            </button>
            <button
              onClick={() => pressKey('del')}
              disabled={verifying}
              aria-label="Delete digit"
              className="liquid-glass flex h-14 items-center justify-center rounded-full text-slate-700 active:scale-95 transition disabled:opacity-60"
            >
              <Delete size={20} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------------- UNLOCKED SCANNER ---------------- */
  const { label, cls, Icon } = STATUS_STYLE[scanState];
  const attendee = result?.attendee;

  return (
    <div className="pastel-mesh-bg min-h-screen p-4 pt-16">
      <BackToDashboardButton />
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {/* Status pill */}
        <AnimatePresence mode="wait">
          <motion.div
            key={scanState}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className={`liquid-glass mx-auto flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${cls}`}
          >
            <Icon size={16} />
            {label}
          </motion.div>
        </AnimatePresence>

        {/* Viewfinder */}
        <div className="liquid-glass rounded-[2rem] p-3">
          <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-slate-900/80">
            <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 p-6 text-center text-white/90">
                <CameraOff size={32} />
                <p className="text-sm font-medium">Camera unavailable</p>
                <p className="text-xs text-white/70">Allow camera access in your browser, then reload.</p>
              </div>
            )}
            {(['top-4 left-4 border-t-4 border-l-4 rounded-tl-2xl',
              'top-4 right-4 border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-4 left-4 border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-4 right-4 border-b-4 border-r-4 rounded-br-2xl'] as const).map((c) => (
              <span key={c} className={`pointer-events-none absolute h-10 w-10 border-white ${c}`} />
            ))}
          </div>
        </div>

        {/* Result card */}
        <AnimatePresence>
          {result && (
            <motion.div
              key={`${result.status}-${attendee?.ticket_code ?? 'none'}-${result.checked_in_at ?? ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="liquid-glass rounded-3xl p-5"
            >
              {attendee ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">{attendee.full_name}</h2>
                    <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-xs text-slate-600">
                      {attendee.ticket_code}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    <li className="flex items-center gap-2"><Mail size={14} className="text-violet-500" />{attendee.email}</li>
                    <li className="flex items-center gap-2"><Building2 size={14} className="text-violet-500" />{attendee.organization}</li>
                    <li className="flex items-center gap-2"><Phone size={14} className="text-violet-500" />{attendee.contact_number}</li>
                  </ul>
                  {result.checked_in_at && (
                    <p className="mt-3 text-xs text-slate-500">
                      Checked in at {new Date(result.checked_in_at).toLocaleTimeString()}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <User size={18} className="text-rose-500" />
                  {result.message}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Checklist */}
        <ul className="liquid-glass space-y-2 rounded-3xl p-5 text-sm text-slate-700">
          <li className="flex gap-2"><span className="text-violet-500">•</span>Hold the guest's QR code inside the brackets.</li>
          <li className="flex gap-2"><span className="text-violet-500">•</span>Wait for the status pill to turn green before admitting.</li>
          <li className="flex gap-2"><span className="text-violet-500">•</span>Amber or red? Ask the guest to see the registration desk.</li>
        </ul>
      </div>
    </div>
  );
}