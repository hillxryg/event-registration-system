# Event Registration & QR Check-In System — Project Spec

## Current Project Phase
- **Completed:**
  - Phase 1: Architecture, Supabase Schema (`supabase/schema.sql`), TypeScript Contracts (`src/types/database.ts`), Local Vite Scaffold
  - Phase 2A: Core Liquid-Glass Design System (`src/index.css`) & Guest Registration Page (`src/pages/RegisterPage.tsx`)
- **Active:** Phase 2B — Auth Login/Signup Page (`src/pages/AuthPage.tsx`), Gate Check-In Scanner UI (`src/pages/ScannerPage.tsx`), Admin Dashboard UI (`src/pages/AdminPage.tsx`), & Role-Based Routing (`src/App.tsx`) using static mock data
- **Upcoming:**
  - Phase 3: Supabase Client Wiring (`src/lib/supabase.ts`), Real Supabase Auth + Profile Role Redirect, & Live Queries/RPC
  - Phase 4: Supabase Edge Function + Resend Automated HTML QR Ticket Email
  - Phase 5: End-to-End Testing & Deployment

## Current File Tree
```text
event-checkin/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   ├── components/       # Reusable UI pieces (e.g., TicketPass.tsx, MeshBackground.tsx)
│   ├── lib/              # Supabase client & helper utilities (Phase 3)
│   ├── pages/            # Route views (RegisterPage.tsx, ScannerPage.tsx, AdminPage.tsx)
│   ├── types/
│   │   └── database.ts   # Source-of-truth TypeScript interfaces (EventItem, Attendee, CheckInResponse)
│   ├── App.css
│   ├── App.tsx
│   ├── index.css         # Tailwind v4 + custom liquid-glass utilities
│   └── main.tsx
├── supabase/
│   └── schema.sql        # PostgreSQL tables (events, attendees), RLS policies, verify_and_checkin RPC
├── eslint.config.js
├── index.html
├── package.json
├── PROJECT_SPEC.md
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

# Tech Stack
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 (@tailwindcss/vite)
- Motion & Icons: motion (MUST import from motion/react) + lucide-react
- QR Packages: qrcode.react (QRCodeSVG for client-side ticket rendering) + html5-qrcode(camera scanner)
- Backend & Database: Supabase (PostgreSQL, Auth, Edge Functions) + Resend API (automated HTML emails)

## Routes & Role-Based Flow
- / or /login (AuthPage.tsx): Default landing screen. Visitors sign in or create an account (guest or admin mock role selector for testing; Phase 3 reads profiles.role).
-- If role === 'admin' -> redirects to /admin (AdminPage.tsx).
-- If role === 'guest' -> redirects to /register (RegisterPage.tsx).
- /register or /register/:slug (RegisterPage.tsx): Protected guest registration & digital QR pass view (includes top-right user badge + Sign Out button).
- /scanner or /scanner/:slug (ScannerPage.tsx): PIN-unlocked gate staff camera QR scanner (verify_and_checkin RPC).
- /admin (AdminPage.tsx): Admin-only event & attendee management dashboard (includes Sign Out button).

## Visual Design Tokens (Already defined in src/index.css)
- Mesh Gradient Colors: Vanilla Cream #F6E9CC, Baby Blue #D0E7F6, Cotton Candy #F0C9EF, Rose Quartz #F1C9CF, Lavender #BBAEEC
- Available CSS Classes: .pastel-mesh-bg, .liquid-glass, .liquid-glass-dark, .liquid-pill-input, .liquid-btn-primary
- QR Safe Zone: Always render QRCodeSVG inside a solid pure-white rounded square (bg-white p-4 rounded-2xl).

## Data Contracts (`src/types/database.ts`)
- `UserRole`: `'guest' | 'admin'`
- `UserProfile`: `{ id: string; email: string; full_name: string | null; role: UserRole; created_at: string; }`
- `EventItem`: `{ id: string; slug: string; title: string; description: string | null; event_date: string; venue: string; scanner_pin?: string; is_active: boolean; created_at: string; }`
- `Attendee`: `{ id: string; event_id: string; ticket_code: string; full_name: string; email: string; organization: string; contact_number: string; checked_in: boolean; checked_in_at: string | null; created_at: string; }`
- `CheckInStatus`: `'valid' | 'already_checked_in' | 'invalid' | 'unauthorized'`
- `CheckInResponse`: `{ status: CheckInStatus; message?: string; checked_in_at?: string; attendee?: Attendee; }`

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