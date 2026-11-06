# DESIGN.md — Emily Hotel HMS design system

The visual system of the **Hotel Management System (HMS)**, taken from the UI prototype
[stayflow-hotel-harmony](https://github.com/yunkhngn/stayflow-hotel-harmony) (a read-only copy lives in
[`ui-prototype/`](ui-prototype/); live demo: <https://stayflow-hotel-harmony.lovable.app>).

> **Rule number 1:** a migrated page must **match the prototype**. The prototype is the source of truth; this
> document describes it and shows how to reuse it. The per-page workflow is in
> [`UI-REPOLISH-GUIDE.md`](UI-REPOLISH-GUIDE.md).

## Contents

1. [Principles](#1-principles)
2. [Color (tokens)](#2-color-tokens)
3. [Typography](#3-typography)
4. [Spacing and layout](#4-spacing-and-layout)
5. [Radius, shadow, motion](#5-radius-shadow-motion)
6. [Icons and imagery](#6-icons-and-imagery)
7. [Atomic design and component catalog](#7-atomic-design-and-component-catalog)
8. [Screen patterns](#8-screen-patterns)
9. [Accessibility](#9-accessibility)
10. [Legacy compatibility layer](#10-legacy-compatibility-layer)
11. [How to work](#11-how-to-work)

| File | Contents |
|---|---|
| `design-system/tokens.css` | The `:root` CSS variables (source of truth for color and radius). Matches `ui-prototype/src/styles.css` line for line |
| `design-system/theme.css` | Maps the tokens to Tailwind v4 classes, plus custom utilities (`font-display`, `card-soft`, `no-scrollbar`, `hero-scrim`) |
| `design-system/legacy.css` | Colors and font sizes of the old system. **Deprecated**; delete when the last old page is migrated |
| `design-system/preview.html` | Static page to eyeball colors, type, radius and shadows (open it directly in a browser) |
| `frontend/src/styles/tokens.test.ts` | Test that fails if `tokens.css` drifts from the prototype |

---

## 1. Principles

1. **Luxurious and calm.** Warm light background, generous white space, a bronze accent color (`primary`), large serif headings (Playfair).
2. **Soft cards.** Content blocks are `card-soft`: white background, thin border, `xl` radius, very light shadow. No heavy shadows and no loud gradients (the only gradients are the active menu item and the `hero-scrim` overlay on photos).
3. **Photos are the hero** on the public site; the workspace is compact and information-dense, with a dark sidebar (`ink`).
4. **Status is a colored dot plus text** (`StatusBadge`), never a filled cell.
5. **Vietnamese is the default UI language.** Be Vietnam Pro and Playfair Display both support the full set of diacritics; check accented text at small sizes.
6. **Tokens only.** No hex, `oklch()` or arbitrary px in pages. If a token is missing, add it to `tokens.css` and `theme.css`, and update the prototype first.

---

## 2. Color (tokens)

Every color is an `oklch` CSS variable in [`design-system/tokens.css`](design-system/tokens.css); use them through semantic Tailwind classes
(`bg-primary`, `text-muted-foreground`, …) and **never** through raw values.

| Group | Tailwind classes | Role |
|---|---|---|
| Page background | `bg-background` / `text-foreground` | Default background and text |
| Card, popover | `bg-card` `text-card-foreground`, `bg-popover` | `card-soft` cards, dialogs, dropdown menus |
| **Primary** | `bg-primary` `text-primary-foreground`, `text-primary`, `ring-ring` | Main buttons, links, selected state, focus ring |
| Secondary | `bg-secondary`, `bg-muted`, `bg-surface` (the same light beige) | Secondary blocks, filter fields, hovered rows |
| Muted text | `text-muted-foreground` | Descriptions, labels, secondary numbers |
| Accent | `bg-accent` `text-accent-foreground`, `bg-lavender`, `text-info` | Light purple accent, the prototype's "proposed" marker |
| **Ink** | `bg-ink` `text-ink-foreground` | Sidebar, footer, text over photos (the design's dark surface) |
| Borders, inputs | `border-border`, `border-input` | Card and table borders; input borders |
| Status | `text-success` `text-warning` `text-info` `text-danger` `text-destructive` `text-neutral` | Status dots and text, errors |
| Charts | `var(--chart-1)` … `var(--chart-5)` | Chart series colors |
| Sidebar | `--sidebar-*` | For shadcn-style sidebars (the prototype uses `ink` instead) |

Rules:
- Text on a colored background uses the matching `*-foreground` pair.
- Opacity uses Tailwind syntax (`bg-primary/10`, `text-ink-foreground/65`); do not invent new colors.
- Never convey information with color alone (always add text or an icon).

---

## 3. Typography

| Role | Font | Class |
|---|---|---|
| Body, UI | **Be Vietnam Pro** 400/500/600/700 | default (`font-sans`) |
| Large headings, quotes | **Playfair Display** 400/500/600 | `font-display` (= serif, weight 400, `letter-spacing: -0.01em`) |

The type scale the prototype actually uses (counted in `ui-prototype/src/routes`):

| Used for | Class |
|---|---|
| Body, table cells, buttons | `text-sm` (the most common size) |
| Labels, captions, chips | `text-xs`; tiny labels `text-[11px]` / `text-[10px]` + `uppercase tracking-wider` |
| Workspace page title | `text-2xl font-semibold tracking-tight sm:text-[28px]` (see `PageHeader`) |
| Section title | `text-sm font-semibold` inside `Panel`; `font-display text-3xl/4xl` on the public site |
| Hero, sign-in title | `font-display text-5xl` (sometimes `text-6xl`, `leading-[1.15]`) |
| Stat card number | `text-2xl font-semibold tracking-tight` |

Eyebrow (the small line above a title): `text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground`.

---

## 4. Spacing and layout

- Tailwind's default spacing scale (4px unit). Standard gaps: `gap-2/3/4`, `p-4/5`, cards `p-5`, dialogs `p-6`.
- **Public site (`SiteLayout`)**: header `h-20`, content `max-w-7xl`, horizontal padding `px-5 lg:px-8`; footer on `ink`, `mt-24`.
- **Workspace (`WorkspaceLayout`)**: sticky sidebar `w-64` on `lg+` (below `lg`: CSS drawer sliding in with `transition-transform`, `invisible -translate-x-full` when closed); sticky header `h-16 bg-background/85 backdrop-blur border-b`; content area uses `contentWidth="bare"` (no padding — each page wraps itself) until migrated, then `contentWidth="contained"` = `max-w-7xl px-4 py-8 sm:px-8`. Use `<PageContainer>` from `@/components/organisms` when migrating inner pages.
- **Sign-in (`AuthLayout`)**: two columns from `lg` (a `max-w-md` form plus a photo with `3xl` radius).
- Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024). Every page must work at 375px.

---

## 5. Radius, shadow, motion

| Token | Value | Used for |
|---|---|---|
| `--radius` | `0.875rem` | Base; `rounded-sm…4xl` derive from it (`lg` = radius, `xl` = +4px, `2xl` = +8px, `3xl` = +12px) |
| `rounded-full` | | Primary buttons, chips, the search bar, avatars, round buttons |
| `rounded-xl` | | Cards (`card-soft`), menu items, empty blocks |
| `rounded-md` | | Inputs, shadcn's default button |
| `shadow-soft` | | `card-soft` |
| `shadow-lift` | | The floating search bar, raised cards |
| `shadow-sm` / `shadow-lg` | | Buttons, dropdown menus, the mobile menu |

Motion is short: `transition-colors`, `duration-200/300`, `ease-out`. A hovered menu item shifts by `translate-x-1`. Enter/exit animations of dialogs and popovers come from `tw-animate-css`. Respect `prefers-reduced-motion` when adding animations.

---

## 6. Icons and imagery

- Icons: **lucide-react**, `size-4` (standard in buttons and rows), `size-3` (small dots), `size-5/6` (feature blocks). Icon names must match the prototype.
- Photos: use the images in `ui-prototype/src/assets/` (lobby, hero, room categories, spa, …). Photos with text over them use `hero-scrim`; photos inside cards follow the card's radius and use `object-cover`.
- Avatar: the initial on a `bg-primary/15 text-primary` background.

---

## 7. Atomic design and component catalog

```
components/
  ui/          vendored shadcn — MUST NOT be imported directly from pages
  atoms/       the smallest elements
  molecules/   a few atoms working as one usable unit
  organisms/   complete blocks (page header, table, dialog, chart)
  templates/   page frames
  *.tsx        legacy components (deprecated)
```

**Import rule:** pages import only from `@/components/atoms | molecules | organisms | templates`. A missing component is added to the right tier
(with tests), never written inside a page. A new shadcn primitive is copied from the prototype into `ui/` and re-exported from the proper tier.

### Atoms — `@/components/atoms`

| Component | Notes |
|---|---|
| `Button` | `variant`: `default` `destructive` `outline` `secondary` `ghost` `link`; `size`: `default` `sm` `lg` `icon`; `asChild`. The prototype's main buttons usually add `rounded-full` |
| `Input`, `Textarea`, `Label`, `NativeSelect`, `Checkbox`, `Switch`, `RadioGroup`/`RadioGroupItem`, `Slider`, `Toggle`, `Separator` | Basic form controls |
| `Avatar`, `AvatarFallback`, `AvatarImage` | |
| `Skeleton` | Loading placeholder (`animate-pulse`) |
| `StatusBadge` | `status` (an enum code such as `CHECKED_IN`): colored dot plus Vietnamese label; an unknown status falls back to neutral |
| `Badge` | `tone`: `success`, `danger`, `info`, `warning`, `neutral`; with decorative dot. Replaces legacy `Badge` (which remains `@deprecated`). For enum status codes use `StatusBadge` |
| `Logo` | `light` (on dark backgrounds), `to`, `name` (brand name; first letter as mark) |

### Molecules — `@/components/molecules`

| Component | Notes |
|---|---|
| `FormField` | `label`, `htmlFor`, `error`, `hint`, `required` + a child control whose `id` equals `htmlFor`. Errors render with `role="alert"` |
| `Select` (+ `SelectTrigger/Content/Item/Value`), `Tabs`, `Popover`, `Tooltip`, `DropdownMenu` | Radix composites |
| `StatCard` | `label`, `value`, `hint`, `trend`, `icon` |
| `EmptyState` | `title`, `body`, `action`, `icon` |
| `KeyValue` | A label–value pair in detail views |
| `Stars` | `value`, `onChange?` (read-only without `onChange`) |
| `DateRangeField` | `from`, `to` (`yyyy-MM-dd`), `onChange(from, to)`; the end date is always at least one day after the start |
| `SectionHeading` | `eyebrow`, `title`, `body`, `align`, `as` (`h1` or `h2`) |
| `PhotoTile` | `src`, `alt`, `caption`, `aspect` (`square`, `4/3`, `3/4`) |
| `Alert` | `tone`: `success`, `danger`, `info`, `warning`, `title?`, `children`. `role="alert"` when `tone="danger"`, otherwise `role="status"`. Replaces legacy `Alert` (which remains `@deprecated`) |
| `Toaster` | Mount once at the app root; call `toast()` from `sonner` |

### Organisms — `@/components/organisms`

| Component | Notes |
|---|---|
| `PageHeader` | `title`, `subtitle`, `eyebrow`, `actions` — the top of every workspace page |
| `Panel` | A card with a title and an `action` |
| `DataTable<T>` | `rows`, `columns`, `search`, `filters`, `pageSize`, `onRowClick`, `toolbar`, `empty`, `loading` — pagination, search, filtering, empty and loading states |
| `Dialog*`, `AlertDialog*`, `Sheet*` | Dialog, confirmation, drawer |
| `RevenueArea`, `SimpleBars`, `Donut` | Charts (recharts) using the `--chart-*` colors |
| `SearchBar` | The room search bar; `initial`, `onSearch({ from, to, guests })`, `ariaLabel`, `compact` |
| `HeroBanner` | `image`, `imageAlt`, `title`, `eyebrow`, `tall`, `children` |
| `RoomCard` | `image`, `name`, `description`, `amenities`, `price`, `priceNote`, `meta`, `actions`, `selected`, `onToggle`, `toggleLabel` |
| `Unauthorized` | The 403 page; `homeTo`, `actionLabel`, `description` |
| `PageContainer` | Responsive page container: `mx-auto w-full max-w-7xl px-4 py-8 sm:px-8`, accepts `className` |


### Templates — `@/components/templates`

| Component | Notes |
|---|---|
| `SiteLayout` | Public-site frame: `links`, `actions`, `overlay` (header over the hero), `brand`, `navLabel`, `footerLinks`, `footerContact`, `footerTagline` |
| `WorkspaceLayout` | Workspace frame: `groups` (grouped menu), `user`, `workspaceLabel`, `onLogout`, `profileTo`, `publicSiteTo`, `publicSiteLabel`, `brand`, `navLabel`, `emptyNavText`, `sidebarId`, `error`, `loading`, `loadingLabel`, `contentWidth` (`contained` or `bare`), `forbidden`; `children` defaults to `<Outlet />` |
| `AuthLayout` | `title`, `subtitle`, `image`, `quote` |

The templates are presentational only. `WorkspaceLayout` is wired through `layouts/WorkspaceShell` (which holds auth logic) for all roles — staff and `CUSTOMER`. `PublicLayout` is wired through `layouts/PublicLayout`. Both shells handle auth/redirect; templates handle only presentation.

---

## 8. Screen patterns

| Screen | Composition |
|---|---|
| List (bookings, rooms, accounts, …) | `PageHeader` (+ action buttons) → `DataTable` (search, filters, `StatusBadge`, `onRowClick` to the detail page) |
| Dashboard | `PageHeader` → a grid of `StatCard` → `Panel` holding a chart or a short list |
| Detail | `PageHeader` → `Panel` + `KeyValue`, action buttons in `actions` |
| Form | `Panel` → `FormField` + `Input/Select/Textarea`; per-field errors, a primary `Button` (label changes while submitting) |
| Dangerous confirmation | `AlertDialog` (cancel button + `destructive` button), never `window.confirm` |
| No data | `EmptyState` (with a next action when possible) |
| Loading | `Skeleton` shaped like the content (or `DataTable loading`) |
| Not allowed | `Unauthorized` |
| Short notification | `toast()` (sonner) |

---

## 9. Accessibility

- Every control shows a keyboard focus ring (shadcn uses `focus-visible:ring-ring`); never remove `outline` without a replacement.
- Icon-only buttons need an `aria-label` (for example "Next page", "Open menu").
- Status always comes with text; form errors use `role="alert"` and labels are tied to inputs through `htmlFor`.
- The current menu item has `aria-current="page"`; collapsible groups have `aria-expanded`.
- Drawers and dialogs have a title (`SheetTitle` / `DialogTitle`, which may be `sr-only`).
- Touch targets of roughly 36–44px for main buttons; check accented text at small sizes.

---

## 10. Legacy compatibility layer

While many people migrate pages in parallel, `design-system/legacy.css` keeps the classes of the old "Grand Emily" system
(`bg-pearl-900`, `text-stone-700`, `border-stone-300`, `bg-cream-100`, `bg-success-bg`, `font-body`,
`max-w-container`, `tracking-widest`, …). **Migrated pages MUST NOT use them.** When you migrate a page, replace them like this:

| Old | New |
|---|---|
| `bg-cream-100`, `bg-cream-50` | `bg-background` (page), `bg-card` (card), `bg-surface` (secondary surface) |
| `text-pearl-900`, `bg-pearl-900` | `text-foreground`, `bg-ink` |
| `text-stone-700`, `text-stone-500` | `text-muted-foreground` |
| `border-stone-300`, `bg-stone-200` | `border-border`, `bg-muted` / `bg-surface` |
| `bg-primary` + `hover:bg-primary-hover`, `bg-brandy-*` | `Button` (default) / `bg-primary hover:bg-primary/90` |
| `bg-primary-soft`, `bg-brandy-100` | `bg-primary/10` |
| `bg-success-bg text-success` (same for warning/danger/info) | `StatusBadge`, or `bg-success/10 text-success` |
| `text-gold-500` | `text-primary` |
| `font-display` (Cormorant) | `font-display` (now Playfair) |
| `font-body` | the default (already Be Vietnam Pro) |
| `max-w-container` | `max-w-7xl` |
| `tracking-widest` (0.2em) | `tracking-[0.2em]`, only for uppercase eyebrows |
| `Button` / `Badge` / `TextField` … in `components/*.tsx` | See section 7 (the old files are marked `@deprecated`) |

### Migrated: Guest Area

- **Shell & landing:** `HomePage`, `ExperiencesPage`, `NotFoundPage`, `Unauthorized`, `PublicLayout`, `UserMenu`
- **Browse & room details:** `SearchRoomsPage`, `RoomDetailsPage`
- **Booking flow:** `CreateBookingPage`, `LookupBookingPage`, `BookingDetailPage`, `PaymentReturnPage`
- **Guest account:** `LoginPage`, `RegisterPage` (with `AuthLayout`), `ProfilePage`, `MyBookingsPage`

### Migrated: Dashboard Shell

- `layouts/WorkspaceShell` replaces `StaffLayout` and now wraps all roles: `MANAGER`, `RECEPTIONIST`, `SERVICE_STAFF`, `OPERATIONS_STAFF`, `CUSTOMER`, and custom roles.
- `templates/WorkspaceLayout` renders the sidebar, header, user menu, and mobile drawer.
- Customer account routes (`/my-bookings`, `/my-feedback`, `/customer/*`, `/profile`) now render inside `WorkspaceShell` (not `PublicLayout`).
- Inner page content still uses legacy wrappers (`mx-auto max-w-container px-4 py-10`) pending per-page migration. Each page migration should replace that wrapper with `<PageContainer>` from `@/components/organisms`.

When the last page is migrated: delete `design-system/legacy.css`, its `@import` line in `frontend/src/styles/index.css`,
and the old components.

---

## 11. How to work

1. Open the prototype (`ui-prototype/`, or the live demo) at the screen you are building and read its code.
2. Use the components from section 7; if one is missing, add it to the right tier with tests.
3. Change presentation only; keep hooks, API calls, logic and behavior tests.
4. Compare with the prototype at 1440px and 375px before opening a PR.

For the details, the prototype-to-app screen map, the list of prohibitions and the prompt template for AI agents, see
[`UI-REPOLISH-GUIDE.md`](UI-REPOLISH-GUIDE.md).

To change or add a token: edit `design-system/tokens.css` (and `theme.css` if a new class is needed) **after** the prototype has changed, then run
`npm test` in `frontend/` to confirm there is no drift.
