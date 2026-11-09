# UI repolish guide

How to move a page of `frontend/` to the new UI. For **developers and AI agents** (Claude Code, Codex, …) working on tasks such as "migrate page X to the new UI".

**Goal:** after migration the page **matches the prototype** in layout, color, type, spacing, radius, shadow, icons and states (hover, focus, disabled, loading, empty, error), while **logic and behavior tests stay exactly as they are**.

The hard rules live in [`CLAUDE.md`](CLAUDE.md) (identical to [`AGENTS.md`](AGENTS.md)); this guide is the how-to. Read, in this order: [`CLAUDE.md`](CLAUDE.md), [`DESIGN.md`](DESIGN.md) (tokens, component catalog), [`ui-prototype/README.md`](ui-prototype/README.md).

## 1. Workflow for one page

1. **Find the prototype screen** in the map in section 3 and open it in `ui-prototype/src/routes/`. Read every component it imports (`ui-prototype/src/components/hms/*`), and `ui-prototype/src/lib/nav.ts` for menus and icons.
2. **See it running.** `cd ui-prototype && bun install && bun run dev` (or `npm install --legacy-peer-deps && npm run dev`), or open <https://stayflow-hotel-harmony.lovable.app>. Pick the right role in the `/app` area. Capture the screen at 1440px and 375px.
3. **List the components you need** from `@/components/atoms | molecules | organisms | templates` (catalog: `DESIGN.md` section 7).
   If one is missing, add it **to the right tier with tests** (port it from the prototype), never inside the page. Tier rules: `CLAUDE.md` section 4.
4. **Write a safety net.** Read the page's current tests. For every behavior that has no test (validation, redirects, error states, guards), add a test that describes today's behavior and make sure it passes before you change anything.
5. **Change presentation only.** Replace JSX and classes with components and tokens. Keep hooks, API calls, validation, navigation, `RequireAuth`, and the accessible names (roles, labels, text) that tests rely on. Existing behavior tests must stay green.
6. **Compare with the prototype** using the checklist in section 2, at 1440px and 375px.
7. **Verify** (in `frontend/`):
   ```bash
   npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
   ```
   plus the three greps in `CLAUDE.md` section 6 on the files you changed (legacy classes, forbidden imports, hard-coded colors); each must print nothing.

## 2. What "matches the prototype" means (PR checklist)

- [ ] **Structure:** same block order and grid; `PageHeader` then content; same wrappers (`Panel`, `card-soft`, `DataTable`).
- [ ] **Tokens:** colors through semantic classes (`bg-card`, `text-muted-foreground`, `bg-ink`, …); same radius and shadow (`shadow-soft` / `shadow-lift`).
- [ ] **Type:** same font (sans vs `font-display`), size, weight, `tracking`, `uppercase` as the prototype.
- [ ] **Spacing:** same `gap`, `p`, `m`, `max-w-*` on desktop and mobile.
- [ ] **Icons:** lucide icons with the **same name** and `size-*`.
- [ ] **States:** hover, `focus-visible`, disabled, loading (`Skeleton`), empty (`EmptyState`), error (`FormField` error).
- [ ] **Real data holds up:** long strings, empty lists and large numbers do not break the layout; 375px has no horizontal scroll.
- [ ] **No legacy classes:** `pearl-*`, `cream-*`, `stone-*`, `brandy-*`, `gold-*`, `reed-*`, `lake-*`, `*-bg`, `font-body`, `max-w-container`, `primary-hover`, `primary-soft`.
- [ ] **No hard-coded values:** no hex, no arbitrary `px`; no imports of `components/ui/` or of the deprecated flat components (`components/*.tsx`).
- [ ] **Behavior unchanged:** hooks, API calls, routes, permissions and existing tests are untouched (any assertion edit is listed in the PR with its reason).

### 2.1 WDP301-185 verification

- [x] Structure, tokens, type, spacing and icons checked against the prototype.
- [x] Loading, empty, error, disabled and long-content states checked.
- [x] Required responsive widths checked; no horizontal overflow.
- [x] Legacy-class, forbidden-import and hard-coded-color scans clean.
- [x] Existing behavior preserved, with user-authorized additive backend insights.

The detailed checklist and evidence are in
[`validation/ui/WDP301-185.md`](validation/ui/WDP301-185.md). The existing accessible heading
and refresh announcement remain. The user approved keeping the original summaries and
shortcuts in a collapsed section below the prototype dashboard. Screenshot export and Jira
completion remain subject to delivery approval recorded in that report.

### 2.2 WDP301-186 verification

The user approved preserving the existing images, amenities, status filter, adult/child capacities, and deactivation flow in the prototype table and dialog presentation. Area, bed configuration, and deletion are outside this ticket. Existing route guards, APIs, validation, search debounce, and server pagination remain in place. Screenshots stay local at the user's request.

- [x] Table, dialog, tokens, type, spacing, and icons compared with the prototype.
- [x] Required widths and long-content, loading, empty, and error states checked.
- [x] Existing behavior, keyboard dismissal, and image viewing verified.
- [x] Required frontend checks and forbidden-pattern scans passed.

Evidence, runner options, approved differences, and limitations are recorded in
[`validation/ui/WDP301-186.md`](validation/ui/WDP301-186.md).

### 2.3 WDP301-187 verification

The user approved retaining notes, activity filtering, deactivation/reactivation, room-type warnings, the existing floor validation, and all operational statuses in the prototype presentation. The price column and deletion are excluded. Screenshots remain local as requested.

- [x] Page header, table, form, tokens, typography, spacing, and icons compared with the prototype.
- [x] Required widths (1440, 768, and 375 pixels), long content, empty, error, and loading states checked.
- [x] Keyboard access, Escape dismissal, focus restoration, and existing mutation semantics checked.
- [x] Final frontend checks and forbidden-pattern scans completed.

Evidence, approved differences, test assertion changes, and limitations are recorded in
[`validation/ui/WDP301-187.md`](validation/ui/WDP301-187.md).

### 2.4 WDP301-188 verification

The user approved keeping images, descriptions, room-type links and counts, activity filtering, and deactivate/reactivate actions in the prototype presentation. Category management and deletion are excluded. Existing accessible names, API contracts, validation, permissions, and pagination remain. Screenshots stay local as requested.

- [x] Page header, table, form, tokens, typography, spacing, and icons compared with the prototype.
- [x] Required widths (1440, 768, and 375 pixels), long content, large counts, empty, error, and loading states checked.
- [x] Existing behavior tests, keyboard focus restoration, image viewing, and confirmation messages checked.
- [x] Final frontend checks and forbidden-pattern scans completed.

Evidence, approved differences, assertion changes, and limitations are recorded in
[`validation/ui/WDP301-188.md`](validation/ui/WDP301-188.md).

### 2.5 WDP301-189 verification

The user approved retaining service images, descriptions, units, billable/free settings,
activity filtering, and deactivate/reactivate actions in the prototype table and dialog.
Categories and deletion are excluded. Existing API contracts, validation, permissions,
accessible names, search debounce, and server pagination remain.

- [x] Page header, table, dialog, tokens, typography, spacing, and icons compared with the prototype.
- [x] Required widths (1440, 768, and 375 pixels), long content, empty, error, and loading states checked.
- [x] Existing behavior, keyboard focus restoration, image viewing, and confirmation messages checked.
- [x] Final frontend checks and forbidden-pattern scans completed.

Evidence, approved differences, assertion changes, and limitations are recorded in
[`validation/ui/WDP301-189.md`](validation/ui/WDP301-189.md).

### 2.6 WDP301-190 verification

The user approved preserving room, equipment, and facility modes, search, images,
maintenance and safe-use flags, retry semantics, and truthful confirmation details
in the prototype form presentation. Prototype-only title and severity are excluded.

- [x] Header, panel, grid, tokens, typography, spacing, and success icon compared with the prototype.
- [x] Required widths (1440, 768, and 375 pixels), long content, loading, empty, error, and success checked.
- [x] Validation focus, disabled controls, selection retention, and identical retry requests verified.
- [x] Final frontend checks and forbidden-pattern scans passed; existing assertions unchanged.

Evidence, approved differences, and limitations are recorded in
[`validation/ui/WDP301-190.md`](validation/ui/WDP301-190.md).

### 2.7 WDP301-191 verification

The user approved keeping the existing filters, columns, data, and behavior; using
the prototype table and Panel for detail; and omitting statistics unavailable in
the API. The prototype does not provide a matching detail screen.

- [x] Header, table, tokens, typography, spacing, and pagination compared with the prototype.
- [x] List and detail checked at 1440, 768, and 375 pixels, including long content and empty, error, and loading states.
- [x] Keyboard focus, filter-preserving navigation, validation, read-only behavior, and permissions checked.
- [x] Required frontend checks and forbidden-pattern scans passed; existing assertions unchanged.

Evidence, approved differences, and limitations are recorded in
[`validation/ui/WDP301-191.md`](validation/ui/WDP301-191.md).

## 3. Prototype to app map

Fill the "Jira task" column when you pick up a task. App paths come from `frontend/src/features/*/routes.tsx` and `frontend/src/pages/`.

| Prototype (`ui-prototype/src/routes/`) | App route | App page | Jira task |
|---|---|---|---|
| `index.tsx` | `/` | `pages/HomePage.tsx` | Done |
| `rooms.index.tsx` | `/search` | `features/booking/pages/SearchRoomsPage.tsx` | Done |
| `rooms.$typeId.tsx` | `/room-types/:id` | `features/booking/pages/RoomDetailsPage.tsx` | Done |
| `book.$typeId.tsx` | `/booking/new` | `features/booking/pages/CreateBookingPage.tsx` | Done |
| `lookup.tsx` | `/booking/lookup` | `features/booking/pages/LookupBookingPage.tsx` | Done |
| `payment-return.tsx` | `/payment/vnpay-return` | `features/booking/pages/PaymentReturnPage.tsx` | Done |
| `login.tsx`, `register.tsx` | `/login`, `/register` | `features/auth/pages/LoginPage.tsx`, `RegisterPage.tsx` | Done |
| `unauthorized.tsx` | (inside `RequireAuth`) | `features/auth/RequireAuth.tsx` | Done |
| `app.profile.tsx` | `/profile` | `features/auth/pages/ProfilePage.tsx` | Done |
| `app.my-bookings.tsx` | `/my-bookings` | `features/booking/pages/MyBookingsPage.tsx` | Done |
| `app.bookings.$id.tsx` | `/booking/:id`, `/reception/bookings/:code` | `BookingDetailPage.tsx`, `ReceptionBookingDetailPage.tsx` (both in `features/booking/pages/`) | Done (guest) |
| `experiences.tsx` | `/experiences` | `features/experiences/pages/ExperiencesPage.tsx` | Done |
| `app.bookings.index.tsx` | `/reception/bookings` | `features/booking/pages/BookingListPage.tsx` | |
| `app.walk-in.tsx` | `/reception/booking/new` | `features/booking/pages/WalkInBookingPage.tsx` | |
| `app.front-desk.tsx` | `/reception/front-desk` | `features/booking/pages/FrontDeskPage.tsx` | |
| `app.guests.tsx` | `/reception/guests` | `features/booking/pages/GuestSearchPage.tsx` | |
| `app.room-board.tsx` | `/reception/rooms` | `features/booking/pages/RoomStatusBoardPage.tsx` | |
| `app.reconciliation.tsx` | `/manager/payments/reconciliation` | `features/booking/pages/ReconciliationPage.tsx` | |
| `app.reception.tsx` | `/reception/dashboard` | `features/dashboard/pages/ReceptionDashboardPage.tsx` | |
| `app.dashboard.tsx` | `/manager/dashboard` | `features/dashboard/pages/ManagerDashboardPage.tsx` | WDP301-185 |
| `app.revenue.tsx` | `/manager/reports/revenue` | `features/reports/pages/RevenueReportPage.tsx` | |
| `app.operations-report.tsx` | `/manager/reports/operational` | `features/reports/pages/OperationalReportPage.tsx` | |
| `app.accounts.tsx` | `/manager/accounts` | `features/accounts/pages/AccountsPage.tsx` | WDP301-154 |
| `app.roles.tsx` | `/manager/roles` | `features/roles/pages/RolesPage.tsx` | WDP301-155 |
| `app.rooms.tsx` | `/manager/rooms` | `features/rooms/pages/RoomsPage.tsx` | WDP301-187 |
| `app.room-types.tsx` | `/manager/room-types` | `features/room-types/pages/RoomTypesPage.tsx` | WDP301-186 |
| `app.amenities.tsx` | `/manager/amenities` | `features/amenities/pages/AmenitiesPage.tsx` | WDP301-188 |
| `app.services.tsx` | `/manager/services` | `features/services/pages/ServicesPage.tsx` | WDP301-189 |
| `app.task-queues.tsx` | `/manager/task-queues` (+ `/:taskId`) | `features/task-supervision/pages/TaskQueuesPage.tsx`, `TaskQueueDetailPage.tsx` | |
| `app.tasks.tsx` | `/staff/tasks` (+ `/:id`) | `features/tasks/pages/AssignedTasksPage.tsx`, `AssignedTaskDetailPage.tsx` | |
| `app.service-orders.tsx` | `/staff/service-orders`, `/staff/service-history` | `features/service-orders/pages/StaffServiceOrdersPage.tsx`, `ServiceHistoryPage.tsx` | |
| `app.order-service.tsx` | `/customer/service-orders/new` (and the list at `/customer/service-orders`) | `features/service-orders/pages/NewServiceOrderPage.tsx`, `ServiceOrdersPage.tsx` | |
| `app.service-desk.tsx` | `/staff/service/dashboard` | `features/staff-dashboards/StaffDashboardPage.tsx` | |
| `app.operations.tsx` | `/staff/operations/dashboard` | `features/staff-dashboards/StaffDashboardPage.tsx` | |
| `app.issues.tsx` | `/customer/issues`, `/staff/issues`, `/manager/issues` | `features/issues/pages/IssueListPage.tsx`, `IssueDetailPage.tsx` | |
| `app.report-issue.tsx` | `/customer/issues/report`, `/operations/maintenance/report` | `features/issues/pages/ReportIssuePage.tsx`, `features/maintenance/pages/ReportFaultPage.tsx` | WDP301-190 (maintenance) |
| `app.maintenance.tsx` | `/operations/maintenance/history` | `features/maintenance/pages/MaintenanceHistoryPage.tsx`, `MaintenanceHistoryDetailPage.tsx` | WDP301-191 |
| `app.feedback.tsx` | `/my-feedback` | `features/feedback/pages/MyFeedbackPage.tsx` | |
| `app.feedback-review.tsx` | `/staff/feedback` | `features/feedback/pages/FeedbackPage.tsx` | WDP301-156 |
| `app.tsx` (workspace shell) | every staff and customer account route | `layouts/WorkspaceShell.tsx` now renders `templates/WorkspaceLayout` for all roles (staff and `CUSTOMER`). `StaffNav.tsx` deleted. | Done |
| `components/hms/SiteLayout.tsx` | every public route | `layouts/PublicLayout.tsx` → use `templates/SiteLayout` | Done |

**Prototype screens the app does not have (ask the maintainer first, do not build on your own):** `app.home.tsx`, `app.equipment.tsx`.

**Proposals, never implemented:** `app.notifications.tsx` and every dot or label marked "Đề xuất UX" (`Proposed`) in the prototype. They are design proposals with no backend; do not put them, or the label, in the app.

**When you wire a layout:** the `NavGroup` / `NavItem` types of `templates/WorkspaceLayout` use `title` and carry an `icon` (a lucide icon), while `frontend/src/app/navigation.ts` uses `label` and has no icons. Use `shellGroupsFor(me)` from `@/app/workspace-nav` — it converts nav groups to the template's format and injects `Booking của tôi` for `CUSTOMER`. When you add a new menu item in `navigation.ts`, also add its icon in `workspace-nav.ts` (`iconForPath` map); failing to do so will be caught by the `shellGroupsFor` guard test.

**Migrating a page inside the workspace shell (staff or customer):** replace the page's outer wrapper `mx-auto max-w-container px-4 py-10` with `<PageContainer>` from `@/components/organisms`. When all pages inside the shell have been migrated, switch `WorkspaceShell` to `contentWidth="contained"` and remove `PageContainer` from each page.

## 4. Do not

- Hard-code colors (hex, `oklch()`), arbitrary `px` values, or inline `style` for anything a token covers.
- Re-implement Button, Badge, Input, Select, Dialog, and so on; use deprecated flat components (`components/*.tsx`) or import `components/ui/*` in a migrated page.
- Edit `ui-prototype/` (read-only) or bring prototype mock data, the zustand store, TanStack Router code or `RoleSwitcher` into the app.
- Change behavior, API, routes or permissions, or edit tests to make the UI "easier". If a behavior test fails only because a class or a piece of text changed to match the prototype, make the smallest assertion edit and explain it in the PR.
- Add a dependency for something a component already provides.

## 5. When the prototype is missing something or contradicts the app

Stop and ask the maintainer: name the screen, the missing state, and your proposal. Do not invent a look. For example, the app has an error state or a data column the prototype does not.

## 6. Pull request rules

- Branch per Jira task; small commits in Conventional Commits form (`feat(ui): …`, `test(ui): …`), each one building and passing tests on its own.
- `git add` explicit paths only (never `git add -A`). Never commit `.env*`, service-account keys, or unrelated work-in-progress such as an edited `docker-compose.yml`.
- The PR includes: screenshots **prototype | app** at 1440px and 375px, the checklist from section 2 ticked, a list of what you did **not** check visually, and the result of `typecheck / lint / format:check / test / build`.

## 7. Prompt template for an AI agent

Fill in the `{...}` placeholders and paste the whole block:

```text
Jira task: {TASK_KEY} — move the page {PAGE_NAME} to the new UI so it matches the prototype.

App page: {APP_FILE_PATH} (route {APP_ROUTE})
Matching prototype screen: ui-prototype/src/routes/{PROTOTYPE_FILE}

Follow this order:
1. Read CLAUDE.md, DESIGN.md and UI-REPOLISH-GUIDE.md, then the prototype file above and every component it imports.
2. Read the current app page and its tests. List briefly: (a) the behavior, logic and tests that must stay unchanged,
   (b) the differences between the app and the prototype (layout, tokens, type, spacing, icons, states),
   (c) any component that is missing and the atomic tier it belongs to.
3. For every behavior that has no test yet, add a test of today's behavior and confirm it passes before changing code.
   Write tests first for any new component, watch them fail, then implement.
4. Change presentation only, using components from @/components/atoms|molecules|organisms|templates and the tokens in DESIGN.md.
   Do not hard-code colors, do not import components/ui or deprecated flat components, do not edit ui-prototype/,
   do not change logic, API calls or routes.
5. Check the result against the "matches the prototype" checklist (guide section 2). Run typecheck, lint, format:check,
   test and build in frontend/, plus the three greps from CLAUDE.md section 6 on the files you changed.
6. Report: what changed, which checklist items you are unsure about or did not verify visually, and which test
   assertions you had to edit and why. If the prototype lacks a state the app needs, stop and ask; do not invent it.
Make small commits in Conventional Commits form and `git add` explicit paths only.
```
