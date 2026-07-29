# Graph Report - .  (2026-07-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 460 nodes · 458 edges · 68 communities (46 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `05399cf7`
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `scripts` - 12 edges
3. `compilerOptions` - 9 edges
4. `withRetry()` - 6 edges
5. `verifyReservations()` - 6 edges
6. `verifyAutoApprove()` - 6 edges
7. `main()` - 6 edges
8. `BackupPage()` - 6 edges
9. `ReportsPage()` - 6 edges
10. `pass()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (68 total, 22 thin omitted)

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
Cohesion: 0.60
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

## Knowledge Gaps
- **193 isolated node(s):** `supabase`, `github`, `name`, `private`, `version` (+188 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `supabase`, `github`, `name` to the rest of the system?**
  _193 weakly-connected nodes found - possible documentation gaps or missing edges._
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