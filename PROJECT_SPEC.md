# Event Registration & QR Check-In System — Project Spec

## Current Project Phase
- **Completed:**
  - Phase 1–3C: Supabase Schema (`profiles`, `events`, `attendees`), Liquid-Glass UI, Auth + Role Routing, Live DB Queries, Shareable `/register/:slug` Invite Links, Public Events Directory (`/register`), & Exclusive Event Admin Approval Workflow (`approved` / `pending` / `declined`)
- **Active:** Phase 3D — Event Lifecycle Status (`active` | `closed` | `cancelled`) & Searchable, Status-Filtered Event Switcher in `AdminPage`
- **Upcoming:**
  - Phase 4: Supabase Edge Function + Resend Automated HTML QR Ticket Email (triggered on instant public approval or when admin approves a pending exclusive guest)
  - Phase 5: End-to-End Testing & Deployment

## Current File Tree
```text
event-checkin/
├── src/
│   ├── lib/
│   │   └── supabase.ts       # Exports `supabase` and `fetchUserProfile`
│   ├── pages/
│   │   ├── AuthPage.tsx      # Real Supabase signInWithPassword / signUp
│   │   ├── RegisterPage.tsx  # Target (Phase 3D) — Replace `is_active` with `status: EventStatus`; show notices for `closed` / `cancelled` events
│   │   ├── ScannerPage.tsx   # Target (Phase 3D) — Allow `active` and `closed` events; block `cancelled` events
│   │   └── AdminPage.tsx     # Target (Phase 3D) — Searchable + status-filtered `EventDropdown` & one-click `active` / `closed` / `cancelled` event status selector
│   ├── types/
│   │   └── database.ts       # UserRole, EventVisibility, EventStatus, RegistrationStatus, UserProfile, EventItem, Attendee, CheckInResponse
│   ├── App.tsx               # Preserves intended `/register/:slug` path after login
│   └── index.css             # .pastel-mesh-bg, .liquid-glass, .liquid-glass-dark, .liquid-pill-input, .liquid-btn-primary
├── supabase/
│   └── schema.sql
└── PROJECT_SPEC.md
```

# Tech Stack
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 (@tailwindcss/vite)
- Motion & Icons: motion (MUST import from motion/react) + lucide-react
- QR Packages: qrcode.react (QRCodeSVG for client-side ticket rendering) + html5-qrcode(camera scanner)
- Backend & Database: Supabase (PostgreSQL, Auth, Edge Functions) + Resend API (automated HTML emails)

## Visual Design Tokens (Already defined in src/index.css)
- Mesh Gradient Colors: Vanilla Cream #F6E9CC, Baby Blue #D0E7F6, Cotton Candy #F0C9EF, Rose Quartz #F1C9CF, Lavender #BBAEEC
- Available CSS Classes: .pastel-mesh-bg, .liquid-glass, .liquid-glass-dark, .liquid-pill-input, .liquid-btn-primary
- QR Safe Zone: Always render QRCodeSVG inside a solid pure-white rounded square (bg-white p-4 rounded-2xl).

## Updated Data Contracts (src/types/database.ts)
- UserRole: 'guest' | 'admin'
- EventVisibility: 'public' | 'exclusive'
- EventStatus: 'active' | 'closed' | 'cancelled'
- RegistrationStatus: 'approved' | 'pending' | 'declined'
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