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
  User,
  Mail,
  Building2,
  Phone,
} from 'lucide-react';
import type { Attendee, CheckInResponse } from '../types/database';

const MOCK_PIN = '1234';
const READER_ID = 'qr-reader';
const SCAN_COOLDOWN_MS = 2500;

const MOCK_ATTENDEES: Attendee[] = [
  {
    id: 'a1',
    event_id: 'evt-1',
    ticket_code: 'TKT-1001',
    full_name: 'Maria Santos',
    email: 'maria@example.com',
    organization: 'Lumina Labs',
    contact_number: '+63 917 555 0101',
    checked_in: false,
    checked_in_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a2',
    event_id: 'evt-1',
    ticket_code: 'TKT-1002',
    full_name: 'Jose Reyes',
    email: 'jose@example.com',
    organization: 'Northwind Co.',
    contact_number: '+63 918 555 0102',
    checked_in: true,
    checked_in_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    created_at: new Date().toISOString(),
  },
];

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

const goBackToDashboard = () => {
  window.history.pushState({}, '', '/admin');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export default function ScannerPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('ready');
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const checkedInRef = useRef<Set<string>>(
    new Set(MOCK_ATTENDEES.filter((a) => a.checked_in).map((a) => a.ticket_code)),
  );
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const processTicket = useCallback((code: string, bypassCooldown = false) => {
    const nowMs = Date.now();
    if (
      !bypassCooldown &&
      lastScanRef.current.code === code &&
      nowMs - lastScanRef.current.at < SCAN_COOLDOWN_MS
    ) {
      return;
    }
    lastScanRef.current = { code, at: nowMs };

    // TODO: Phase 3 Supabase — call verify_and_checkin RPC
    const attendee = MOCK_ATTENDEES.find((a) => a.ticket_code === code);
    if (!attendee) {
      setScanState('invalid');
      setResult({ status: 'invalid', message: 'Ticket not recognised.' });
      return;
    }
    if (checkedInRef.current.has(code)) {
      setScanState('already_checked_in');
      setResult({
        status: 'already_checked_in',
        message: 'This ticket was already used.',
        checked_in_at: attendee.checked_in_at ?? new Date().toISOString(),
        attendee: { ...attendee, checked_in: true },
      });
      return;
    }
    checkedInRef.current.add(code);
    const now = new Date().toISOString();
    setScanState('valid');
    setResult({
      status: 'valid',
      message: 'Welcome in!',
      checked_in_at: now,
      attendee: { ...attendee, checked_in: true, checked_in_at: now },
    });
  }, []);

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

  const pressKey = (k: string) => {
    setPinError(false);
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      if (next === MOCK_PIN) {
        setUnlocked(true);
      } else {
        setPinError(true);
        setTimeout(() => setPin(''), 400);
      }
    }
  };

  const simulate = (kind: 'valid' | 'duplicate' | 'invalid') => {
    if (kind === 'valid') {
      checkedInRef.current.delete('TKT-1001');
      processTicket('TKT-1001', true);
    } else if (kind === 'duplicate') {
      processTicket('TKT-1002', true);
    } else {
      processTicket('TKT-0000', true);
    }
  };

  /* ---------------- PIN GATE ---------------- */
  if (!unlocked) {
    return (
      <div className="pastel-mesh-bg min-h-screen flex flex-col items-center justify-center p-4">
        <div className="mb-4 w-full max-w-sm">
          <button
            type="button"
            onClick={goBackToDashboard}
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/60"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass w-full max-w-sm rounded-[2rem] p-8 text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-violet-500 shadow-sm">
            <Lock size={24} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">Gate Staff Access</h1>
          <p className="mt-1 text-sm text-slate-600">Enter the 4-digit Event Scanner PIN.</p>

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
          <p className="mt-3 h-4 text-xs text-rose-600">{pinError ? 'Incorrect PIN.' : ''}</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                className="liquid-glass h-14 rounded-full text-lg font-medium text-slate-800 active:scale-95 transition"
              >
                {k}
              </button>
            ))}
            <span />
            <button
              onClick={() => pressKey('0')}
              className="liquid-glass h-14 rounded-full text-lg font-medium text-slate-800 active:scale-95 transition"
            >
              0
            </button>
            <button
              onClick={() => pressKey('del')}
              aria-label="Delete digit"
              className="liquid-glass flex h-14 items-center justify-center rounded-full text-slate-700 active:scale-95 transition"
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
    <div className="pastel-mesh-bg min-h-screen p-4">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {/* Top bar: Back button + Status pill */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBackToDashboard}
            className="liquid-glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/60"
          >
            <ArrowLeft size={14} />
            Dashboard
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={scanState}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className={`liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${cls}`}
            >
              <Icon size={15} />
              {label}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Viewfinder */}
        <div className="liquid-glass rounded-[2rem] p-3">
          <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-slate-900/80">
            <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 p-6 text-center text-white/90">
                <CameraOff size={32} />
                <p className="text-sm font-medium">Camera unavailable</p>
                <p className="text-xs text-white/70">
                  Allow camera access, or use the simulate controls below.
                </p>
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

        {/* Simulate bar */}
        <div className="liquid-glass flex items-center gap-2 rounded-full p-1.5">
          <span className="pl-3 pr-1 text-[11px] uppercase tracking-wide text-slate-500">
            Simulate
          </span>
          {(
            [
              ['valid', 'Valid'],
              ['duplicate', 'Duplicate'],
              ['invalid', 'Invalid'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => simulate(k)}
              className="flex-1 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white/90"
            >
              {l}
            </button>
          ))}
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