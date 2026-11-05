# UI prototype (reference, read-only)

A copy of <https://github.com/yunkhngn/stayflow-hotel-harmony> at commit
`b6a0a602d5b12a4c505072ed2bd183153b1eea46`. This is the design every page in `frontend/` must
match. Live demo: <https://stayflow-hotel-harmony.lovable.app>

**Do not edit it and do not import from the app.** This folder sits outside tsc, oxlint, prettier, vitest and the Docker
context of `frontend/`. To change the design, change it in the prototype's own repository and copy it again.

This copy has been trimmed of Lovable metadata (`AGENTS.md`, `.lovable/`, `roadmap.md`) and of the prototype's own lint/test configuration
(there are no `lint`, `format` or `test` scripts any more). The working rules live in `CLAUDE.md`, `DESIGN.md` and `UI-REPOLISH-GUIDE.md` at the repository root.

## Run it for comparison

```bash
cd ui-prototype
bun install            # or: npm install --legacy-peer-deps
bun run dev            # or: npm run dev
```

The prototype uses mock data; pick a role with the role switcher in the `/app` area.

## Where to look

| Path | Contents |
|---|---|
| `src/styles.css` | Color, type, radius and shadow tokens (the source of `design-system/tokens.css` and `theme.css`) |
| `src/routes/` | One file per screen (TanStack file-based routing); `app.*.tsx` is the workspace |
| `src/lib/nav.ts` | Per-role menus and page access |
| `src/components/hms/` | Application components (StatusBadge, PageHeader, DataTable, SiteLayout, …) |
| `src/components/ui/` | shadcn/ui primitives |
| `src/assets/` | Images used in the design |

A screen carrying the label "Đề xuất UX" (`Proposed`) is a proposal with no backend: do not implement it.
