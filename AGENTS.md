# Rules for AI coding agents

Grand Emily HMS: `backend/` (NestJS 12, MongoDB, ESM) and `frontend/` (React 19, Vite, React Router 8, Tailwind 4). Node >= 24 (`.nvmrc`), npm 11.
`CLAUDE.md` and `AGENTS.md` are identical on purpose: change both in the same commit.

Keywords: **MUST** and **MUST NOT** are hard rules, not preferences. If a rule blocks the task, stop and ask; do not work around it.

## 1. Read first

| When | Read |
|---|---|
| Any UI work | [`DESIGN.md`](DESIGN.md) then [`UI-REPOLISH-GUIDE.md`](UI-REPOLISH-GUIDE.md), then the matching prototype screen (section 3) |
| Backend work | `backend/src/modules/README.md`, the module you touch, its specs |
| Adding a frontend feature | `frontend/src/features/README.md` |

`docs/` is git-ignored local scratch space. MUST NOT link to it from tracked files and MUST NOT rely on it being present.

## 2. Global rules

- **Language.** Every Markdown file you create or edit (`*.md`: READMEs, specs, plans, guides, notes) MUST be written in English, even when the user writes to you in another language. Exceptions: proper names of people, and quoted UI copy or labels that must stay verbatim (for example the prototype's "Đề xuất UX" marker). The product's user-facing text stays Vietnamese; this rule is about documentation, not UI strings.
- **Scope.** Do exactly what was asked. No drive-by refactors, renames or "while I'm here" changes. Behavior changes need a test first (red, then green).
- **Evidence.** Never claim work is done, fixed or passing without running the commands in section 6 and reading their output.
- **Git.**
  - MUST `git add <explicit paths>`; MUST NOT use `git add -A` or `git add .`.
  - MUST NOT commit `.env*` (except `*.example`), service-account JSON, keys or tokens, or files the user is editing that the task does not touch.
  - Small, focused commits in [Conventional Commits](https://www.conventionalcommits.org/) form (`feat(booking): …`, `fix(auth): …`, `style(ui): …`, `test: …`, `docs: …`, `chore: …`). Each commit builds and passes tests on its own.
  - MUST NOT force-push, rewrite pushed history, push, merge, or open/close PRs unless asked. Branch from `main`, one task per branch.
- **Secrets.** MUST NOT print, log or hard-code credentials. Env changes go in `backend/src/config/env.validation.ts`, `configuration.ts` and every `.env.example`.
- **Destructive actions** (deleting files or branches, `git clean`, `git reset --hard`, dropping data) need explicit approval each time.
- **Dependencies.** MUST NOT add a package when an existing one or an existing component already does the job.

## 3. UI work must match the prototype

The reference UI is [`ui-prototype/`](ui-prototype/) (read-only; live copy: <https://stayflow-hotel-harmony.lovable.app>).
A page counts as migrated only when it is visually and structurally the same as its prototype screen.

1. **Find the screen.** Use the route map in `UI-REPOLISH-GUIDE.md`. Read the prototype route (`ui-prototype/src/routes/`), the components it imports (`ui-prototype/src/components/hms/`), and `ui-prototype/src/lib/nav.ts` for menus and icons. Tokens come from `ui-prototype/src/styles.css`.
2. **Copy the structure, not your idea of it.** Same section order, grid, spacing, typography, radius, shadow, icon (same lucide icon name and `size-*`) and states (hover, focus-visible, disabled, loading, empty, error). Reuse the prototype's class lists through components; do not "improve" them.
3. **Behavior parity.** UI tasks MUST NOT change hooks, API calls, validation, routes, guards or permissions. Keep the accessible names (roles, labels, text) existing tests rely on. When a prototype change forces an assertion change, edit it minimally and say why in the PR.
4. **Real data, prototype look.** Replace mock data with real data. The result MUST still work with long strings, empty lists and 375px width.
5. **Prototype gaps.** If the prototype lacks a state, column or screen the app needs, stop and ask. MUST NOT invent one.
6. **Do not ship prototype artifacts:** mock data, the zustand store, TanStack Router code, `RoleSwitcher`, screens or badges marked `Proposed` / "Đề xuất UX", invented marketing claims (offers, awards, counts), or scattered placeholder contact details (keep them in one file, `frontend/src/lib/site-content.ts`, once it exists).
7. **`ui-prototype/` is read-only.** MUST NOT edit it or import from it. Update it only by re-copying from its source repository.

## 4. Atomic design is mandatory

```
frontend/src/components/
  ui/          vendored shadcn primitives. Internal. MUST NOT be imported by pages or features
  atoms/       smallest elements (Button, Input, Label, Badge, StatusBadge, Logo, Avatar, Skeleton…)
  molecules/   a few atoms working as one unit (FormField, StatCard, EmptyState, DateRangeField, Select, Tabs…)
  organisms/   complete UI sections (PageHeader, Panel, DataTable, SearchBar, Dialog, charts, PageContainer…)
  templates/   page shells (SiteLayout, WorkspaceLayout, AuthLayout). Layout only, no data fetching
  *.tsx        legacy flat components. Frozen: do not add new ones. `Alert`, `Badge`, `Button`, `SelectField`, `TextAreaField`,
               `TextField`, `ConfirmationDialog` are `@deprecated`; `AssetImage`, `ImagePicker`, `ImageLightbox`, `ApiStatus`,
               `LakeIllustration` stay until a replacement exists. Never import the deprecated ones in migrated code
```

**Dependency direction (one way only):** `ui` → `atoms` → `molecules` → `organisms` → `templates` → `layouts/`, `pages/`, `features/`. A tier MUST NOT import from a higher tier. Cross-tier imports go through the tier's `index.ts` barrel, for example `import { Button } from '@/components/atoms'`.

**Which tier?**

| Tier | Allowed | Not allowed |
|---|---|---|
| atom | One element or one primitive wrapper; variants via props; a router `Link` for navigation | Importing other components of this project, data fetching, router state (`useLocation`, `useNavigate`), domain words |
| molecule | Composes atoms; owns trivial UI state (open/closed, input value) | Data fetching, router state, business rules |
| organism | Composes atoms and molecules into a section; local UI state, callbacks as props | Data fetching, direct API or auth access |
| template | Arranges organisms into a page frame; receives everything by props or `children` | Business logic, data fetching |
| feature code (`features/<name>/…`) | Hooks, API, mapping domain data to props, feature-only components in `features/<name>/components/` | Re-implementing something that already exists in a tier |

**Rules**

- **Reuse before create.** Search the barrels and `DESIGN.md` section 7 first. Never hand-write a button, input, badge, dialog, table or card in a page.
- **New component = right tier + barrel export + tests** (render, variants, empty and long-content cases, a11y name). Write the test first. Update the `DESIGN.md` catalog in the same PR.
- **Promotion.** A feature-local component used by a second feature MUST move up to the proper tier.
- **New shadcn primitive.** Copy it from the prototype into `components/ui/`, then re-export it from the proper tier; pages still never import `ui/`.
- **Props, not forks.** Need a variation? Add a prop or variant. Do not copy a component.

## 5. Styling rules

- Tokens only. Use semantic Tailwind classes backed by `design-system/tokens.css` and `theme.css`: `bg-background`, `bg-card`, `bg-surface`, `bg-ink`, `text-foreground`, `text-muted-foreground`, `text-ink-foreground`, `bg-primary text-primary-foreground`, `border-border`, `ring-ring`, `text-success|warning|info|danger|destructive`, `font-display`, `card-soft`, `shadow-soft|lift`, `rounded-*`.
- MUST NOT write hex, `rgb()`, `oklch()`, arbitrary `px` values (`p-[13px]`) or inline `style` for anything a token covers. Opacity uses Tailwind syntax (`bg-primary/10`).
- **Legacy classes are banned in migrated code:** `pearl-*`, `cream-*`, `stone-*`, `brandy-*`, `gold-*`, `reed-*`, `lake-*`, `*-bg`, `font-body`, `max-w-container`, `primary-hover`, `primary-soft`. They exist only in `design-system/legacy.css` so unmigrated pages keep working; `DESIGN.md` section 10 maps old to new. Do not extend `legacy.css`.
- Text and numbers follow the prototype type scale (`DESIGN.md` section 3). Interactive elements need a visible focus state; icon-only buttons need `aria-label`; status is never conveyed by color alone.
- Tokens change in `design-system/` only after the prototype changes; `frontend/src/styles/tokens.test.ts` guards drift.

## 6. Verify before saying "done"

Run in `frontend/` (and `backend/` if touched). Every command MUST pass; read the output.

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Backend: `npm run typecheck && npm run lint && npm run format:check && npm test` (plus `npm run test:e2e` when MongoDB is available and the change touches API behavior).

For UI work also run, on every file you changed in a page, feature or layout:

```bash
# 1. no legacy classes (must print nothing)
grep -nE "(pearl|cream|stone|brandy|gold|reed|lake)-[0-9]+|-bg\b|font-body|max-w-container|primary-hover|primary-soft" <files>
# 2. no forbidden imports (must print nothing)
grep -nE "components/ui/|@/components/(Button|Badge|TextField|TextAreaField|SelectField|Alert|ConfirmationDialog)'" <files>
# 3. no hard-coded colors (must print nothing)
grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|oklch\(" <files>
```

Then compare against the prototype at 1440px and 375px and tick the "matches the prototype" checklist in `UI-REPOLISH-GUIDE.md` section 2. State plainly what you did not verify (for example not viewed in a browser).

## 7. Frontend conventions

- Code by feature in `frontend/src/features/<name>`. Call the API through `api` in `src/lib/api-client.ts` with TanStack Query. Import with the `@/` alias.
- The brand name comes from `env.appName`; pass it to components that display it instead of hard-coding it. Placeholder site content lives in one file, `src/lib/site-content.ts`, once it exists.
- A page that should appear in a menu gets an entry in `src/app/navigation.ts` (a label unique within its role). Routes under `/staff`, `/manager`, `/reception`, `/operations` render inside the staff shell; guards stay in each route's `RequireAuth`.
- Tests sit next to the code and use Testing Library with accessible queries. UI changes keep existing tests green.

## 8. Backend conventions

- One NestJS module per functional area in `backend/src/modules/`. Controllers only parse requests and call services; business rules live in services and have unit tests.
- DTOs use class-validator (`whitelist` and `forbidNonWhitelisted` are on). Public endpoints use `@Public()`; role limits use `@Roles(...)`. API is versioned under `/api/v1`; errors use `{ statusCode, message, error, path, timestamp }`.
- Internal imports end in `.js` (ESM).

## 9. Final report

End every task with: what changed, the commands you ran and their results, what you did not verify, and any rule you had to bend or question (with the reason). Do not claim more than the evidence shows.
