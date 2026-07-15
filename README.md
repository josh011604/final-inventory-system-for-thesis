# School Facilities Management and Inventory System

Modern React + Vite + Tailwind CSS workspace for a school facilities and inventory system with role-based access control.

The current app is a polished frontend prototype that demonstrates:

- secure login, logout, remember me, and password reset flows
- role-based dashboards for Super Administrator, Department Administrator, and Staff
- department-level data isolation
- inventory, facility, borrowing, maintenance, reporting, notifications, and user-management screens
- responsive layout with a blue, white, and gray visual system

## Database

The attached MySQL dump has been translated into a Supabase/Postgres migration at [supabase/migrations/20260708_0001_school_inventory.sql](supabase/migrations/20260708_0001_school_inventory.sql). It adds:

- departments and role-aware profiles
- equipment, QR codes, borrow records, maintenance requests, notifications, audit logs, and login logs
- Supabase row-level security policies for department isolation and role-based access
- lookup tables for suppliers and categories

Use that migration after linking your Supabase project with the CLI.

## Structure

- `src/frontend` for UI shells, feature screens, and presentation logic
- `src/backend` for shared data access, hooks, RBAC helpers, and type bridges
- `src/components` for reusable layout and UI pieces
- `src/data` for seed data and dashboard records
- `src/features/auth` for sign-in and reset flows
- `src/features/dashboard` for the role-aware dashboard experience
- `src/hooks` for shared React hooks
- `src/lib` for RBAC helpers and client setup
- `src/pages` for route-level screens
- `src/styles` for global styling
- `src/types` for shared TypeScript types

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Fill in your Supabase project URL and anon key if you want to connect a backend.
4. Run `npm run dev`.

## Demo Accounts

These are real Supabase auth users (not UI mockups). Create or repair them with `npm run seed:demo` (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`), then confirm they work end to end with `npm run verify:demo`.

- `superadmin` / `Super123!`
- `bscs.admin` / `Admin123!` · `bscs.staff` / `Staff123!` (BS Computer Science)
- `bsit.admin` / `Admin123!` · `bsit.staff` / `Staff123!` (BS Industrial Technology, major in Electricity)
- `bsf.admin` / `Admin123!` · `bsf.staff` / `Staff123!` (BS Fisheries, major in Inland Fisheries)
- `cte.admin` / `Admin123!` · `cte.staff` / `Staff123!` (College of Teacher Education)
- `midwifery.admin` / `Admin123!` · `midwifery.staff` / `Staff123!` (Midwifery)

Rebuild the account set from scratch with `node scripts/prune-accounts.mjs` (deletes every non–super-admin account) followed by `npm run seed:demo`. Department names must match the `20260713130000_reconfigure_departments` migration.

The Demo Accounts panel on the login screen is intentionally kept so evaluators can sign in with one click. These are shared, publicly listed credentials — when you switch this instance over to real production data, rotate the passwords (or deactivate the accounts) and consider hiding the panel in `src/frontend/features/auth/AuthScreen.tsx`.

## Scripts

- `npm run dev` starts the dev server
- `npm run build` creates a production build
- `npm run preview` previews the build locally
- `npm run lint` checks the codebase with ESLint
- `npm run seed:demo` creates/repairs the demo accounts in Supabase (service role key required)
- `npm run seed:data` seeds sample categories, suppliers, facilities, equipment, and borrow/maintenance records per department (idempotent)
- `npm run verify:demo` signs in as every demo account and checks role permissions, RLS scoping, and edge functions

## Deployment

1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_NAME` in the host's environment (never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend build).
2. Apply migrations with `supabase db push` and deploy the edge functions: `supabase functions deploy borrow-status maintenance-status overdue-check main-supply`.
3. `npm run build`, then serve `dist/`.
4. The app uses `BrowserRouter`, so the host must rewrite all paths to `index.html` (Vercel/Netlify SPA fallback, or `try_files $uri /index.html` on nginx). Without it, refreshing any route other than `/` returns a 404.
