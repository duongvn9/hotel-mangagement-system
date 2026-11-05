<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- This is a frontend-only UI prototype: all data lives in `src/lib/mock.ts` and a persisted zustand store (`src/lib/store.ts`); never add a backend — it's a design deliverable for an existing system.
- Role menus and page access are defined only in `src/lib/nav.ts` (`navByRole`, `canAccess`); workspace pages live under `/app/*` and the `/app` layout enforces access.
- Screens not present in the original repository must carry the `Proposed` tag so reviewers can tell proposals from existing features.
- For nav links that need a distinct active style, compute the active state with `useLocation()` and merge classes through `cn()`; do not use `Link`'s `activeProps.className` — it is concatenated with `className` without tailwind-merge, so conflicting utilities (e.g. two `hover:bg-*`) resolve by CSS order and silently break the hover state.
