# Event Registration & QR Check-In System

## Stack
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4
- Animation & Icons: `motion` (import from `motion/react`), `lucide-react`
- QR Utilities: `qrcode.react` (ticket rendering), `html5-qrcode` (camera scanner)
- Backend: Supabase (PostgreSQL, Auth, Edge Functions) + Resend API (transactional email)

## Visual Direction (Liquid Glass + Pastel Mesh)
- Palette:
  - Canvas mesh gradients: Vanilla Cream `#F6E9CC`, Baby Blue `#D0E7F6`, Cotton Candy `#F0C9EF`, Rose Quartz `#F1C9CF`, Lavender `#BBAEEC`
  - Glass surfaces: `bg-white/35 backdrop-blur-xl border border-white/75 shadow-[0_20px_40px_-15px_rgba(187,174,236,0.35)]` with inner top highlight `shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]`
  - Primary Dark Accent: `#18181B` (high contrast text & secondary action pills)
  - Primary Gradient CTA: Lavender-to-Cotton-Candy (`#8B5CF6` / `#BBAEEC` to `#F0C9EF`) with soft outer glow
- UI Anatomy:
  - Pill-shaped recessed inputs (`rounded-full`) with circular icon badges
  - Bento-grid layout for registration + live ticket preview
  - Solid white rounded safe-zone (`bg-white p-4 rounded-2xl`) around QR codes for scan reliability

## Routes & Roles
1. `/register/:slug` (Public Guest): Event info + registration form (`full_name`, `email`, `organization`, `contact_number`) + instant animated digital pass reveal after submit.
2. `/scanner/:slug` (Gate Staff): PIN-unlocked mobile camera QR scanner (`verify_and_checkin` RPC) showing Green (Valid), Amber (Already Checked In), or Red (Invalid).
3. `/admin` (Authenticated Organizer): Event switcher/creator, KPI cards (Registered, Checked In, Pending), searchable attendee table, CSV export, manual check-in toggle.