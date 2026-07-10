School Facilities Management and Inventory System built with React, Vite, Tailwind CSS, and Supabase-ready configuration.

Project layout:

- `src/frontend` for UI shells and presentation modules
- `src/backend` for shared data access, hooks, RBAC helpers, and type bridges
- `src/components` for reusable layout and UI
- `src/data` for seed data and dashboard records
- `src/features/auth` for login and reset flows
- `src/features/dashboard` for the RBAC dashboard experience
- `src/hooks` for shared React hooks
- `src/lib` for RBAC helpers and client setup
- `src/pages` for route-level screens
- `src/styles` for global styling
- `src/types` for shared TypeScript types

Project conventions:

- Use the `@` alias for imports from `src`.
- Prefer `src/frontend` for new UI work and `src/backend` for shared data and logic.
- Keep RBAC logic centralized in `src/lib/rbac.ts`.
- Keep the Supabase client isolated in `src/lib/supabase`.
- Use `src/index.css` as the Tailwind entrypoint.
- Configure Supabase with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
