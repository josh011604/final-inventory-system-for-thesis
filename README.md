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

- `superadmin` / `Super123!`
- `eng.dean` / `Dean123!` (College of Industrial Technology)
- `cte.dean` / `Dean123!` (College of Teacher Education)
- `cs.chair` / `Dean123!` (Department of Computer Science)
- `fish.head` / `Dean123!` (College of Fisheries)
- `jcruz` / `Staff123!` (College of Industrial Technology)
- `mday` / `Staff123!` (Department of Computer Science)
- `cte.staff` / `Staff123!` (College of Teacher Education)
- `fish.staff` / `Staff123!` (College of Fisheries)

## Scripts

- `npm run dev` starts the dev server
- `npm run build` creates a production build
- `npm run preview` previews the build locally
- `npm run lint` checks the codebase with ESLint
