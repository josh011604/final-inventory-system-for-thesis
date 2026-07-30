# Graph Report - react_invy_projects  (2026-07-29)

## Corpus Check
- 144 files · ~68,455 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 632 nodes · 586 edges · 112 communities (57 shown, 55 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fbf310aa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- queries.ts
- scripts
- devDependencies
- compilerOptions
- ReportsPage.tsx
- verify-reservations.mjs
- borrowing.ts
- seed-sample-data.mjs
- reservations.ts
- compilerOptions
- supabase.ts
- seed-demo-accounts.mjs
- BackupPage.tsx
- EquipmentHistoryModal.tsx
- verify-demo-accounts.mjs
- AuthScreen.tsx
- backfill-profile-pii.mjs
- prune-accounts.mjs
- Button.tsx
- DashboardScreen.tsx
- borrow-status/index.ts
- profile-pii/index.ts
- school.ts
- AlertsPanel.tsx
- auth.ts
- StatusChip.tsx
- frontend/App.tsx
- navigation.ts
- FacilityReservationDetailsModal.tsx
- InventoryPage.tsx
- AppShell.tsx
- EntityTablePage.tsx
- BorrowRequestModal.tsx
- facilityDisplay.ts
- EquipmentEditModal.tsx
- maintenance-status/index.ts
- .mcp.json
- errors.ts
- rbac.ts
- Card.tsx
- Modal.tsx
- borrowDisplay.ts
- useBorrowCandidates.ts
- MaintenancePage.tsx
- NotificationsPage.tsx
- vite-env.d.ts
- create-student/index.ts
- main-supply/index.ts
- overdue-check/index.ts
- tsconfig.json
- env.ts
- client.ts
- Supabase
- Writing Guidelines for Postgres References
- CRITICAL RULES - MUST FOLLOW
- Changelog
- Changelog
- Section Definitions
- School Facilities Management and Inventory System
- Supabase Postgres Best Practices
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- graphify
- ActivityHistoryCard.tsx

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `CRITICAL RULES - MUST FOLLOW` - 14 edges
3. `scripts` - 12 edges
4. `compilerOptions` - 9 edges
5. `Section Definitions` - 9 edges
6. `School Facilities Management and Inventory System` - 8 edges
7. `Writing Guidelines for Postgres References` - 7 edges
8. `Supabase` - 7 edges
9. `withRetry()` - 6 edges
10. `verifyReservations()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (112 total, 55 thin omitted)

### Community 0 - "queries.ts"
Cohesion: 0.05
Nodes (8): AuditLogRow, BorrowRecordRow, EquipmentRow, FacilityReservationRow, FacilityRow, MainSupplyItem, MaintenanceRequestRow, ProfileRow

### Community 1 - "scripts"
Cohesion: 0.06
Nodes (31): lucide-react, dependencies, lucide-react, react, react-dom, react-router-dom, @supabase/ssr, @supabase/supabase-js (+23 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, eslint, @eslint/js (+21 more)

### Community 3 - "compilerOptions"
Cohesion: 0.08
Nodes (23): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+15 more)

### Community 4 - "ReportsPage.tsx"
Cohesion: 0.14
Nodes (16): barClass, borrowStatusTone, csvCell(), Datum, downloadCsv(), equipmentStatusTone, isOverdue(), maintenanceStatusTone (+8 more)

### Community 5 - "verify-reservations.mjs"
Cohesion: 0.32
Nodes (13): checks, env, fail(), futureDate(), main(), pass(), root, signIn() (+5 more)

### Community 6 - "borrowing.ts"
Cohesion: 0.17
Nodes (12): ACTIVE_BORROW_STATUSES, ApprovableRecord, BorrowableItem, borrowBlockedReason(), Borrower, BorrowRecordLike, displayStatus(), freeUnits() (+4 more)

### Community 7 - "seed-sample-data.mjs"
Cohesion: 0.16
Nodes (12): admin, BORROWS, CATEGORIES, daysFromNow(), DEPARTMENTS, env, main(), MAIN_SUPPLY (+4 more)

### Community 8 - "reservations.ts"
Cohesion: 0.22
Nodes (11): activeBooking(), BLOCKING_STATUSES, ExistingReservation, facilityBookingsOn(), findReservationClash(), ReservableFacility, ReservationDraft, Reserver (+3 more)

### Community 9 - "compilerOptions"
Cohesion: 0.15
Nodes (12): ES2023, vite.config.ts, compilerOptions, allowSyntheticDefaultImports, lib, module, moduleResolution, noEmit (+4 more)

### Community 10 - "supabase.ts"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 11 - "seed-demo-accounts.mjs"
Cohesion: 0.27
Nodes (8): admin, demoAccounts, emailFor(), env, findAuthUserIdByEmail(), main(), root, withRetry()

### Community 12 - "BackupPage.tsx"
Cohesion: 0.36
Nodes (8): BackupPage(), downloadBlob(), fetchTable(), Row, stamp(), TableName, TABLES, toCsv()

### Community 13 - "EquipmentHistoryModal.tsx"
Cohesion: 0.28
Nodes (8): chipClass, dotClass, EquipmentHistoryModal(), EventTone, formatDate(), ms(), statusTone, TimelineEvent

### Community 14 - "verify-demo-accounts.mjs"
Cohesion: 0.32
Nodes (6): demoAccounts, env, main(), root, verifyAccount(), withRetry()

### Community 15 - "AuthScreen.tsx"
Cohesion: 0.25
Nodes (3): demoAccounts, DepartmentOption, features

### Community 16 - "backfill-profile-pii.mjs"
Cohesion: 0.29
Nodes (3): admin, env, root

### Community 17 - "prune-accounts.mjs"
Cohesion: 0.33
Nodes (5): admin, env, main(), root, withRetry()

### Community 18 - "Button.tsx"
Cohesion: 0.29
Nodes (5): ButtonProps, ButtonSize, ButtonVariant, sizeClass, variantClass

### Community 19 - "DashboardScreen.tsx"
Cohesion: 0.29
Nodes (3): DashboardScreenProps, MetricTone, metricToneClass

### Community 20 - "borrow-status/index.ts"
Cohesion: 0.29
Nodes (4): ACTIVE_STATUSES, corsHeaders, OUT_OF_SERVICE_STATUSES, TRANSITION_STATUSES

### Community 21 - "profile-pii/index.ts"
Cohesion: 0.48
Nodes (4): corsHeaders, decryptPii(), encryptPii(), importKey()

### Community 22 - "school.ts"
Cohesion: 0.33
Nodes (5): Department, Role, SchoolUser, ThemeMode, UserStatus

### Community 23 - "AlertsPanel.tsx"
Cohesion: 0.40
Nodes (5): Alert, AlertsPanel(), AlertTone, isOverdue(), toneStyles

### Community 25 - "StatusChip.tsx"
Cohesion: 0.40
Nodes (3): ChipTone, dotClass, toneClass

### Community 26 - "frontend/App.tsx"
Cohesion: 0.47
Nodes (4): App(), initialsFor(), loadActiveUser(), queryClient

### Community 27 - "navigation.ts"
Cohesion: 0.50
Nodes (3): isRouteAllowed(), NAV_ITEMS, NavItem

### Community 28 - "FacilityReservationDetailsModal.tsx"
Cohesion: 0.60
Nodes (3): FacilityReservationDetailsModal(), formatDateLong(), formatDateTime()

### Community 33 - "BorrowRequestModal.tsx"
Cohesion: 0.67
Nodes (3): BorrowRequestModal(), BorrowRequestModalProps, candidateLabel()

### Community 35 - "EquipmentEditModal.tsx"
Cohesion: 0.67
Nodes (3): EquipmentEditModal(), MANUAL_STATUSES, WORKFLOW_STATUSES

### Community 68 - "Supabase"
Cohesion: 0.12
Nodes (14): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Making and Committing Schema Changes, Option A: Declarative schemas (+6 more)

### Community 69 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 70 - "CRITICAL RULES - MUST FOLLOW"
Cohesion: 0.12
Nodes (14): Architecture, CHANGE / EDIT MODE, Commands, Conventions, CRITICAL RULES - MUST FOLLOW, Deployment, Directory layout, Domain notes (facility reservations & borrowing) (+6 more)

### Community 71 - "Changelog"
Cohesion: 0.18
Nodes (10): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 72 - "Changelog"
Cohesion: 0.18
Nodes (10): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), Bug Fixes, Bug Fixes, Bug Fixes, Changelog, Features (+2 more)

### Community 73 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 74 - "School Facilities Management and Inventory System"
Cohesion: 0.22
Nodes (8): Database, Demo Accounts, Deployment, Facility reservations and borrowing, School Facilities Management and Inventory System, Scripts, Setup, Structure

### Community 75 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 110 - "ActivityHistoryCard.tsx"
Cohesion: 0.40
Nodes (3): ActivityEntry, ActivityType, ALL_STATUSES

## Knowledge Gaps
- **296 isolated node(s):** `supabase`, `github`, `name`, `private`, `version` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `supabase`, `github`, `name` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `queries.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `ReportsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._