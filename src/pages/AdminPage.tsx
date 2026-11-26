import { useMemo, useState, type FormEvent } from 'react';
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
  ChevronDown,
  ScanLine,
  Ticket,
  ShieldCheck,
} from 'lucide-react';
import type { UserProfile, EventItem, Attendee } from '../types/database';

interface AdminPageProps {
  user: UserProfile;
  onSignOut: () => void;
}

type Filter = 'all' | 'checked_in' | 'pending';

const now = () => new Date().toISOString();

const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'evt-1',
    slug: 'tech-summit-2026',
    title: 'Tech Summit 2026',
    description: 'Annual technology conference.',
    event_date: '2026-12-12T09:00:00Z',
    venue: 'Manila Convention Center',
    scanner_pin: '1234',
    is_active: true,
    created_at: now(),
  },
  {
    id: 'evt-2',
    slug: 'design-meetup',
    title: 'Design Meetup',
    description: 'Monthly design community night.',
    event_date: '2026-12-20T18:00:00Z',
    venue: 'Makati Hub',
    scanner_pin: '4321',
    is_active: true,
    created_at: now(),
  },
];

const mk = (
  id: string,
  event_id: string,
  code: string,
  name: string,
  email: string,
  org: string,
  phone: string,
  checked: boolean,
): Attendee => ({
  id,
  event_id,
  ticket_code: code,
  full_name: name,
  email,
  organization: org,
  contact_number: phone,
  checked_in: checked,
  checked_in_at: checked ? now() : null,
  created_at: now(),
});

const INITIAL_ATTENDEES: Attendee[] = [
  mk('a1', 'evt-1', 'TKT-1001', 'Maria Santos', 'maria@example.com', 'Lumina Labs', '+63 917 555 0101', true),
  mk('a2', 'evt-1', 'TKT-1002', 'Jose Reyes', 'jose@example.com', 'Northwind Co.', '+63 918 555 0102', false),
  mk('a3', 'evt-1', 'TKT-1003', 'Ana Cruz', 'ana@example.com', 'Bluepeak', '+63 919 555 0103', true),
  mk('a4', 'evt-1', 'TKT-1004', 'Luis Garcia', 'luis@example.com', 'Orbit Studio', '+63 920 555 0104', false),
  mk('a5', 'evt-1', 'TKT-1005', 'Carla Mendoza', 'carla@example.com', 'Lumina Labs', '+63 921 555 0105', false),
  mk('a6', 'evt-2', 'TKT-2001', 'Paolo Dizon', 'paolo@example.com', 'Pixel Forge', '+63 922 555 0106', false),
  mk('a7', 'evt-2', 'TKT-2002', 'Bea Tan', 'bea@example.com', 'Studio Tan', '+63 923 555 0107', true),
];

const navigate = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function AdminPage({ user, onSignOut }: AdminPageProps) {
  // TODO: Phase 3 Supabase — fetch events & attendees
  const [events, setEvents] = useState<EventItem[]>(INITIAL_EVENTS);
  const [attendees, setAttendees] = useState<Attendee[]>(INITIAL_ATTENDEES);
  const [eventId, setEventId] = useState(INITIAL_EVENTS[0].id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', venue: '', date: '', pin: '' });

  const event = events.find((e) => e.id === eventId) ?? events[0];
  const eventAttendees = useMemo(
    () => attendees.filter((a) => a.event_id === eventId),
    [attendees, eventId],
  );

  const total = eventAttendees.length;
  const checked = eventAttendees.filter((a) => a.checked_in).length;
  const pending = total - checked;
  const pct = total ? Math.round((checked / total) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eventAttendees.filter((a) => {
      if (filter === 'checked_in' && !a.checked_in) return false;
      if (filter === 'pending' && a.checked_in) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.organization, a.ticket_code].some((f) =>
        f.toLowerCase().includes(q),
      );
    });
  }, [eventAttendees, query, filter]);

  const toggleCheckIn = (id: string) => {
    // TODO: Phase 3 Supabase — update attendees.checked_in / checked_in_at
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              checked_in: !a.checked_in,
              checked_in_at: !a.checked_in ? new Date().toISOString() : null,
            }
          : a,
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
    link.download = `${event.slug}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createEvent = (ev: FormEvent) => {
    ev.preventDefault();
    if (!form.title.trim() || !form.venue.trim() || !form.date) return;
    // TODO: Phase 3 Supabase — insert into events
    const slug = form.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const created: EventItem = {
      id: `evt-${Date.now()}`,
      slug,
      title: form.title.trim(),
      description: null,
      event_date: new Date(form.date).toISOString(),
      venue: form.venue.trim(),
      scanner_pin: form.pin || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => [...prev, created]);
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
        <header className="liquid-glass flex flex-wrap items-center gap-3 rounded-3xl p-4">
          <div className="flex items-center gap-2 rounded-full bg-white/60 py-1 pl-1 pr-4 text-sm text-slate-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white">
              <ShieldCheck size={16} />
            </span>
            <span className="max-w-[180px] truncate">{user.full_name ?? user.email}</span>
          </div>

          <div className="relative">
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              aria-label="Switch event"
              className="liquid-pill-input appearance-none pr-10"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="liquid-btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} /> New Event
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a
              href={`/register/${event.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/register/${event.slug}`);
              }}
              className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700"
            >
              <Ticket size={14} /> Register
            </a>
            <a
              href={`/scanner/${event.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/scanner/${event.slug}`);
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
        </header>

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
        <section className="liquid-glass rounded-3xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
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

            <div className="liquid-glass relative flex rounded-full p-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="relative z-10 rounded-full px-4 py-1.5 text-sm font-medium"
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
              className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-700"
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
                      No attendees match your filters.
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
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="4-digit scanner PIN"
                inputMode="numeric"
                className="liquid-pill-input w-full"
              />
              <button type="submit" className="liquid-btn-primary w-full">
                Create Event
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}