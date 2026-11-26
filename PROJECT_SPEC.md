# Event Registration & QR Check-In System — Project Spec

## Current Project Phase
- **Completed:**
  - Phase 1–3D: Supabase Schema (`profiles`, `events`, `attendees`), Liquid-Glass UI, Auth + Role Routing, Live DB Queries, Shareable `/register/:slug` Invite Links, Public Events Directory (`/register`), Exclusive Event Admin Approval Workflow (`approved` / `pending` / `declined`), & Event Lifecycle Status (`active` | `closed` | `cancelled`) with Searchable, Status-Filtered Event Switcher in `AdminPage`
  - Phase 4: Supabase Edge Function (`send-ticket-email`) + Gmail SMTP (`nodemailer` + `qrcode` inline CID PNG attachment) automated HTML QR ticket delivery triggered on instant public approval or when admin approves a pending exclusive guest; public unauthenticated access to `/register` and `/register/:slug`
  - Phase 5: Guest Dashboard (`GuestDashboardPage.tsx` at `/my-passes`), `localStorage` pass persistence (`passflow_ticket_${event.id}`), magic-link OTP authentication in `AuthPage.tsx`, `'cancelled'` registration status & RLS self-cancellation trigger
- **Active:** Phase 6 — PassFlow Branding & Logo (`/passflow-logo.svg`), Mobile Hamburger Navigation, Responsive Card Grids (`GuestDashboardPage` & `RegisterPage`), & Signed-In / Duplicate Registration Detection
- **Upcoming:**
  - Phase 7: End-to-End Testing & Deployment

## Current File Tree
```text
event-checkin/
├── public/
│   └── passflow-logo.svg     # PassFlow brand logo
├── src/
│   ├── lib/
│   │   └── supabase.ts       # Exports `supabase` and `fetchUserProfile`
│   ├── pages/
│   │   ├── AuthPage.tsx      # Supabase `signInWithPassword`, `signUp`, & `signInWithOtp` (magic link) with redirect persistence
│   │   ├── GuestDashboardPage.tsx # Guest `/my-passes` dashboard with status filter pills, QR pass modal, & attendance cancellation
│   │   ├── RegisterPage.tsx  # Public directory (`/register`) + event registration (`/register/:slug`) with `localStorage` pass persistence & `send-ticket-email` invocation
│   │   ├── ScannerPage.tsx   # Allows `active` and `closed` events; blocks `cancelled` events
│   │   └── AdminPage.tsx     # Searchable + status-filtered `EventDropdown`, event status selector, & attendee approval (`send-ticket-email` trigger)
│   ├── types/
│   │   └── database.ts       # UserRole, EventVisibility, EventStatus, RegistrationStatus (`approved` | `pending` | `declined` | `cancelled`), UserProfile, EventItem, Attendee, CheckInResponse
│   ├── App.tsx               # Public `/register` & `/register/:slug` routes, protected `/my-passes` & `/admin` routes, & role-based routing
│   └── index.css             # .pastel-mesh-bg, .liquid-glass, .liquid-glass-dark, .liquid-pill-input, .liquid-btn-primary
├── supabase/
│   ├── functions/
│   │   └── send-ticket-email/
│   │       └── index.ts      # Edge Function generating inline PNG QR via `qrcode` and sending HTML pass via Gmail SMTP (`nodemailer`)
│   └── schema.sql
└── PROJECT_SPEC.md
```

# Tech Stack
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 (@tailwindcss/vite)
- Motion & Icons: motion (MUST import from motion/react) + lucide-react
- QR Packages: qrcode.react (QRCodeSVG for client-side ticket rendering) + html5-qrcode(camera scanner)
- Backend & Database: Supabase (PostgreSQL, Auth, Edge Functions) + Gmail SMTP via Nodemailer (GMAIL_USER, GMAIL_APP_PASSWORD Edge Function secrets)

## Visual Design Tokens (Already defined in src/index.css)
- Mesh Gradient Colors: Vanilla Cream #F6E9CC, Baby Blue #D0E7F6, Cotton Candy #F0C9EF, Rose Quartz #F1C9CF, Lavender #BBAEEC
- Available CSS Classes: .pastel-mesh-bg, .liquid-glass, .liquid-glass-dark, .liquid-pill-input, .liquid-btn-primary
- QR Safe Zone: Always render QRCodeSVG inside a solid pure-white rounded square (bg-white p-4 rounded-2xl).

## Updated Data Contracts (src/types/database.ts)
- UserRole: 'guest' | 'admin'
- EventVisibility: 'public' | 'exclusive'
- EventStatus: 'active' | 'closed' | 'cancelled'
- RegistrationStatus: 'approved' | 'pending' | 'declined'(next: add 'cancelled' in Phase 5)
- EventItem: { id, slug, title, description, event_date, venue, visibility, status, scanner_pin?, created_at }
- Attendee: { id, event_id, ticket_code, full_name, email, organization, contact_number, status, checked_in, checked_in_at, created_at }

## Strict Restrictions & Guardrails (Mandatory)

1. **Zero Unrequested Files or Features:** Generate ONLY the exact file(s) explicitly named in the current prompt. Do NOT create bonus components, mock APIs, utility wrappers, routing files, tests, or README updates unless asked.
2. **Zero Conversational Fluff:** Do NOT write greetings, intros, explanations, architecture notes, or post-code summaries unless explicitly asked to explain or debug. Output file headers and code blocks only.
3. **No Guessing Existing Files:** Never assume the contents of files in the file tree (`src/App.tsx`, `index.html`, `src/types/database.ts`, etc.) that are not attached in the chat. If you need a file's contents to proceed, stop and ask for that specific file in one sentence.
4. **No Full-File Rewrites on Edits:** When modifying an existing file over 100 lines, output ONLY the changed/inserted blocks with `// ... existing code ...` markers. Never reprint unchanged code.
5. **Respect Phase Boundaries:** Do NOT jump ahead to future phases (e.g., do not write Supabase queries, Edge Functions, or Resend email logic during Phase 2 frontend UI prompts; use static mock data and `// TODO: Phase 3` placeholders).
6. **Strict Package & Import Locks:**
   - NEVER import from `framer-motion` (always use `motion/react`).
   - NEVER invent new TypeScript interfaces or rename database columns—use only `src/types/database.ts` (`full_name`, `email`, `organization`, `contact_number`, `ticket_code`, `checked_in`, `checked_in_at`).
   - NEVER generate `package.json`, `vite.config.ts`, `tsconfig.json`, or `npm install` commands.
7. **QR & Visual Guardrails:** Never render a QR code directly onto a translucent or gradient surface—always wrap `QRCodeSVG` inside a solid pure-white container (`bg-white p-4 rounded-2xl`).