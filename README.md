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
- `bscs.student` / `Student123!` (BS Computer Science)

Rebuild the account set from scratch with `node scripts/prune-accounts.mjs` (deletes every non–super-admin account) followed by `npm run seed:demo`. Department names must match the `20260713130000_reconfigure_departments` migration.

The Demo Accounts panel on the login screen is intentionally kept so evaluators can sign in with one click. These are shared, publicly listed credentials — when you switch this instance over to real production data, rotate the passwords (or deactivate the accounts) and consider hiding the panel in `src/frontend/features/auth/AuthScreen.tsx`.

## Scripts

- `npm run dev` starts the dev server
- `npm run build` creates a production build
- `npm run preview` previews the build locally
- `npm run lint` checks the codebase with ESLint
- `npm test` runs the Vitest unit suite (reservation and borrow-availability rules)
- `npm run seed:demo` creates/repairs the demo accounts in Supabase (service role key required)
- `npm run seed:data` seeds sample categories, suppliers, facilities, equipment, and borrow/maintenance records per department (idempotent)
- `npm run verify:demo` signs in as every demo account and checks role permissions, RLS scoping, and edge functions
- `npm run verify:reservations` exercises the facility-reservation and borrow-request flows end to end against the live project

## Facility reservations and borrowing

Staff, department admins, and super admins reserve facilities from the Facilities
screen; students borrow items but not rooms. A request starts `pending` and is
approved by the facility's department admin (or a super admin for the central,
department-less rooms).

Overlap protection lives in two places. The Facilities screen blocks a window
that collides with a reservation it can see, and the
`facility_reservations_no_overlap` exclusion constraint
([20260722140000](supabase/migrations/20260722140000_facility_reservation_conflicts.sql))
is the authority — necessary because RLS hides other departments' reservations
from the requester, so the client check alone cannot see every conflict.
Intervals are half-open: a booking ending at 10:00 does not clash with one
starting at 10:00.

`facilities.current_availability` reflects only an administrator's explicit
choice (`under_maintenance` / `in_use`) or the schema default (`available`) —
a reservation never touches it
([20260723100000](supabase/migrations/20260723100000_facility_availability_per_slot.sql)).
An earlier version flipped a facility to `reserved` for the rest of the day
(with no upper bound — see the now-reverted
[20260722160000](supabase/migrations/20260722160000_facility_availability_sync.sql))
the moment any approved booking existed against it, which made a single booked
hour hide that the room was free every other hour, and even blocked a second,
non-overlapping booking later the same day. Instead, whether a facility is
occupied **right now**, and what else it has booked for a given day, is
computed live from `facility_reservations` — `facilityBookingsOn()` and
`activeBooking()` in
[src/backend/lib/reservations.ts](src/backend/lib/reservations.ts) — so it's
always exact to the minute, not just as fresh as the last write or cron tick.
The Facilities table's Availability column shows this directly: "Available"
plus the day's other booked windows, or "Reserved · Until 9:00 AM" only while
a booking's window actually contains the current time.

Clicking a row in the reservations table opens its full details (requester,
department, date/time, purpose, reviewer, timestamps). The Reserve modal shows
the chosen facility's existing bookings for the selected date, so the user can
see what's actually open before picking a time.

**Approval:** a department admin reserving their **own** department's facility
— or a super admin reserving anything — is approved on arrival; no separate
review step. A department admin reserving a *central* (department-less)
facility is not that facility's approver (a super admin is), so that request
still starts `pending`, as does every staff request
([20260722180000](supabase/migrations/20260722180000_facility_reservation_auto_approve.sql)).
This logic is mirrored client-side by `reservationAutoApproves()` in
[src/backend/lib/reservations.ts](src/backend/lib/reservations.ts) and enforced
authoritatively by the `facility_reservations` insert RLS policy.

Central facilities (e.g. the Supply Office) are visible to every authenticated
user, not just the super admin
([20260722200000](supabase/migrations/20260722200000_facilities_central_visibility.sql))
— fixing an earlier RLS gap where `department_id = current_user_department_id()`
was never true for a `NULL` department, silently hiding them from staff and
department admins.

Items can be requested two ways, both routed through the same
`BorrowRequestModal` and the `borrow-status` edge function: the **New Request**
button on the Borrowing screen, and the per-row **Borrow** button on the
Inventory screen (enabled only when the item is `available` and at least one
unit is free).

## Deployment

1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_NAME` in the host's environment (never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend build).
2. Apply migrations with `supabase db push` and deploy the edge functions: `supabase functions deploy borrow-status maintenance-status overdue-check main-supply`.
3. `npm run build`, then serve `dist/`.
4. The app uses `BrowserRouter`, so the host must rewrite all paths to `index.html` (Vercel/Netlify SPA fallback, or `try_files $uri /index.html` on nginx). Without it, refreshing any route other than `/` returns a 404.

<!-- test: verifying git push to fork -->
