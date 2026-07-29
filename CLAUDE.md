# CLAUDE.md

# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

School Facilities Management and Inventory System — React + Vite + Tailwind CSS frontend backed by Supabase/Postgres, with role-based access control (Super Administrator, Department Administrator, Faculty/Staff, Student).

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run preview` — preview the production build locally
- `npm run lint` — ESLint over the whole repo
- `npm test` — run the Vitest suite once (`npm run test:watch` for watch mode)
- Single test file: `npx vitest run src/backend/lib/reservations.test.ts`
- `npm run seed:demo` — create/repair demo Supabase auth accounts (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`)
- `npm run seed:data` — seed sample categories/suppliers/facilities/equipment/borrow/maintenance records (idempotent)
- `npm run verify:demo` — sign in as every demo account and check role permissions, RLS scoping, edge functions
- `npm run verify:reservations` — exercise facility-reservation and borrow-request flows end to end against the live project
- `npm run backfill:pii` — one-off script for the profile PII encryption migration

Setup: `npm install`, copy `.env.example` to `.env.local`, fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_APP_NAME`.

**Never use the Supabase CLI** — it's not installed in this environment. Use the `mcp__supabase__*` MCP tools for any Supabase operations (migrations, queries, project inspection, etc.) instead of shelling out to `supabase ...`.

## Architecture

## Directory layout

- `src/frontend` — screens and presentation logic, organized as `features/<domain>/` (auth, dashboard, facilities, inventory, borrowing, maintenance, users, reports, notifications, audit-logs, departments, settings, backup). `src/frontend/App.tsx` owns routing and the session bootstrap; `src/App.tsx` is a one-line re-export of it (Vite/`main.tsx` expects `src/App.tsx`).
- `src/backend` — everything that isn't UI: `lib/supabase/` (client, auth helpers, `queries.ts`), `lib/rbac.ts`, `lib/reservations.ts`, `lib/borrowing.ts`, `lib/errors.ts`, `hooks/`, `types/` (hand-written `school.ts` domain types plus generated `supabase.ts` DB types), `config/env.ts`.
- `src/components` — cross-feature UI: `layout/AppShell.tsx` (shell/nav/topbar) and `ui/` primitives (Button, Card, Modal, Skeleton, StatusChip, EntityTablePage, ComingSoonPage).
- `supabase/migrations` — timestamp-ordered SQL migrations; this is the source of truth for schema, RLS policies, and constraints (read the newest ones before changing DB-adjacent behavior — see Domain notes below).
- `supabase/functions` — Deno edge functions (`borrow-status`, `maintenance-status`, `overdue-check`, `main-supply`, `create-student`, `profile-pii`) plus `_shared/` for code shared between them (e.g. `pii-crypto.ts`).
- `scripts/` — Node maintenance scripts run via `npm run seed:*` / `verify:*` / `backfill:pii`, and `prune-accounts.mjs` (deletes every non-super-admin account, not wired to a script alias — run directly with `node`).

## Conventions

- Import via the `@` alias (`@/backend/...`, `@/frontend/...`), never relative paths across top-level folders — configured in both `tsconfig.app.json` and `vite.config.ts`.
- New UI work goes in `src/frontend`; shared data access/business logic goes in `src/backend`.
- RBAC logic is centralized in `src/backend/lib/rbac.ts`; route/nav visibility per role is centralized in `src/frontend/config/navigation.ts` (`NAV_ITEMS`, `navItemsForRole`, `isRouteAllowed`).
- The Supabase client is isolated in `src/backend/lib/supabase/client.ts`; it throws at import time if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are missing.
- Unit tests are colocated as `*.test.ts` next to the module they cover (e.g. `src/backend/lib/reservations.test.ts`, `src/backend/lib/borrowing.test.ts`) and run under Vitest.
- Route mutation error handling through `getErrorMessage()` in `src/backend/lib/errors.ts` — Supabase/PostgREST errors are plain objects, not `Error` instances, and specific Postgres error codes (unique/FK/exclusion violation, RLS denial) map to friendlier messages there.
- The stored `role` DB value for Faculty is still `'staff'` (DB check constraint, RLS policies, edge functions, and usernames like `bscs.staff` key off it) — only the display label changed to "Faculty" (`src/frontend/config/navigation.ts` label vs `src/backend/lib/rbac.ts` role labels).

## Domain notes (facility reservations & borrowing)

These are load-bearing invariants that span multiple files/migrations — read before touching this area:

- **Overlap protection is enforced at two layers**: the client blocks visibly-colliding windows, but the `facility_reservations_no_overlap` exclusion constraint (migration `20260722140000`) is the actual authority, because RLS hides other departments' reservations from the requester so the client can't see every conflict.
- **Reservation intervals are half-open**: a booking ending at 10:00 does not clash with one starting at 10:00.
- **`facilities.current_availability` is admin-set only** (`under_maintenance` / `in_use`, or default `available`) — a reservation never writes to it (migration `20260723100000`). Whether a facility is occupied _right now_ is computed live from `facility_reservations` via `facilityBookingsOn()` and `activeBooking()` in `src/backend/lib/reservations.ts`, not from a stored/synced field.
- **Auto-approved borrows are inserted with the service-role client**, because the `borrow insert scoped` policy pins every client insert to `status = 'pending'` — a caller's own JWT cannot create an already-`confirmed` row. That means `auth.uid()` is NULL inside `audit_row_change()`, so it falls back to the row's `created_by` / `requester_id` / `borrower_id` (migration `20260729170000`) to keep the entry attributed to the admin rather than to "System". `approved_by` is set to the borrower themselves on this path — that is what the UI's "· auto" marker keys off, not a bug.
- **Auto-approval**: a department admin reserving their own department's facility, or a super admin reserving anything, is approved immediately. Everything else (staff requests, a department admin booking a central/department-less facility) starts `pending`. This is mirrored client-side by `reservationAutoApproves()` in `src/backend/lib/reservations.ts` and enforced authoritatively by the `facility_reservations` insert RLS policy (migration `20260722180000`).
- **Central (department-less) facilities** must be visible to every authenticated user, not just super admins — migration `20260722200000` fixed an RLS gap where `department_id = current_user_department_id()` is never true for `NULL`.
- **`equipment.quantity` is the ON-HAND stock, not the total.** Approving a borrow for N units subtracts N from it and returning the request adds N back, done by the `sync_equipment_stock_on_borrow` trigger (migration `20260729120000`) so it is atomic with the status change and no write path can skip it. Consequences: `freeUnits()` in `src/backend/lib/borrowing.ts` reads the column directly and must never subtract units-out again (that would double-count); an item's original/total stock is not stored — `totalUnits()` reconstructs it as on-hand + units out, for display and the low-stock ratio only; and the trigger, not the edge function, is the authoritative oversell guard (`where quantity >= delta` locks the row). `transition_borrow_record` no longer writes `equipment.status` — the trigger flips it to `borrowed` at zero stock and back to `available` when a unit returns.
- **Approval routing falls out of `borrow_records.department_id` (= the item's department) plus read RLS**, not from any explicit routing table: a Supply Office request carries `department_id = NULL`, which no department admin's department can equal, so it reaches only the super admin — and the `borrow select scoped` policy keeps it out of their list entirely. Faculty approval of a student's request additionally needs the borrower's *role*, which the `profiles` policy hides from faculty; the `profile_directory` view (migration `20260729150000`) supplies id/name/role/department only, and `useBorrowRecords()` merges it in behind the existing joins.
- **Inventory Items and the New Request picker deliberately have different scopes.** Inventory shows only your own department's stock (the super admin excepted) — faculty included, even though they may borrow far more widely. Other departments' items, and the Supply Office pool for non-students, appear only in Borrowing → New Request (`useBorrowCandidates`). Equipment RLS is therefore wider than the Inventory list: it must be, or the picker could not list what it offers. Scope restrictions that remain: students cannot request Supply Office (department-less) items — enforced client-side by `borrowScopeReason()`, in the `borrow-status` create path, and by the `enforce_borrow_department_scope` trigger (migration `20260729180000`).
- Items are borrowed two ways — the **New Request** button on Borrowing, and the per-row **Borrow** button on Inventory (enabled only when `available` with a free unit) — both routed through the same `BorrowRequestModal` and the `borrow-status` edge function.
- Profile PII (e.g. `employee_id`) is being migrated from a plaintext column to an encrypted one; `App.tsx`'s `loadActiveUser()` prefers the decrypted value from the `profile-pii` edge function but falls back silently to the legacy plaintext column so a decrypt failure never blocks login.

## Deployment

- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME` in the host env; never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend build.
- Apply migrations and deploy edge functions (`borrow-status maintenance-status overdue-check main-supply`) via Supabase — use the `mcp__supabase__*` MCP tools, not the CLI.
- `npm run build`, serve `dist/`.
- App uses `BrowserRouter`, so the host must rewrite all paths to `index.html` (SPA fallback) or refreshing any non-`/` route 404s.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
