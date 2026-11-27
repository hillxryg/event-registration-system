# PassFlow

A full-stack **Event Registration & QR Check-In System** built with React, TypeScript, Tailwind CSS, and Supabase.

**Live App:** [https://passflow-events.vercel.app](https://passflow-events.vercel.app)

---

## Features

- **Public & Exclusive Events:** Browse open events at `/register` or register via shareable `/register/:slug` invite links, with admin approval workflows for exclusive events.
- **Automated QR Ticket Delivery:** Generates inline PNG QR passes via a Supabase Edge Function (`send-ticket-email`) and delivers HTML tickets over Gmail SMTP (`nodemailer` + `qrcode`).
- **Guest Pass Wallet (`/my-passes`):** Magic-link OTP authentication and `localStorage` pass persistence so attendees can view their QR pass or cancel attendance anytime.
- **Live QR Scanner (`/scanner/:slug`):** PIN-protected camera check-in (`html5-qrcode`) supporting `active` and `closed` events while blocking `cancelled` events.
- **Admin Dashboard (`/admin`):**
  - Searchable, status-filtered event switcher (`active`, `closed`, `cancelled`) and event creation/deletion.
  - Real-time KPI cards (Total Registered, Checked In %, Pending Check-In).
  - Full guest-list CRUD (walk-in creation with optional QR email dispatch, guest detail editing with email re-send, attendee deletion, approval/decline, manual check-in toggle, and CSV export).

---

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **QR Tools:** `qrcode.react` (client-side pass rendering), `html5-qrcode` (camera check-in scanner)
- **Backend & Auth:** Supabase (PostgreSQL with Row-Level Security, Auth with Magic Link OTP, Edge Functions)
- **Email Delivery:** Nodemailer + Gmail SMTP
- **Deployment:** Vercel

---

## Project Structure

```text
event-checkin/
├── public/
│   └── passflow-logo.svg          # Brand logo & favicon
├── src/
│   ├── lib/
│   │   └── supabase.ts            # Supabase client & profile helper
│   ├── pages/
│   │   ├── AuthPage.tsx           # Password & magic-link OTP authentication
│   │   ├── GuestDashboardPage.tsx # Guest /my-passes QR wallet & cancellation
│   │   ├── RegisterPage.tsx       # Public directory & /register/:slug registration
│   │   ├── ScannerPage.tsx        # PIN-locked QR code check-in scanner
│   │   └── AdminPage.tsx          # Event & guest-list CRUD dashboard
│   ├── types/
│   │   └── database.ts            # TypeScript database contracts
│   ├── App.tsx                    # Public & role-protected routing
│   └── index.css                  # Liquid-glass design tokens & mesh background
├── supabase/
│   ├── functions/
│   │   └── send-ticket-email/
│   │       └── index.ts           # Edge Function for QR generation & email delivery
│   └── schema.sql                 # Database schema & RLS policies
├── index.html
└── vercel.json                    # SPA rewrite rules