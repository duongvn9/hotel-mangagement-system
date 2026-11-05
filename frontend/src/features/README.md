# features/

One folder per functional area, matching the backend modules:

```
features/bookings/
├── api.ts            # API calls (use `api` from @/lib/api-client)
├── hooks.ts          # useQuery / useMutation
├── components/       # components that belong to this feature only
├── pages/            # the feature's pages
└── routes.tsx        # route array, merged in src/app/router.tsx
```

Components shared by several features live in `src/components/`, organized by atomic design tier
(`atoms`, `molecules`, `organisms`, `templates`; see `DESIGN.md` section 7).
Always use the design system's tokens for color, font and spacing (see `DESIGN.md`); never write hex values in components.
