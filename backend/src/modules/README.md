# Domain modules

Each functional area is its own NestJS module in this folder. Generate one quickly with the CLI:

```bash
npx nest g resource modules/rooms --no-spec   # controller + service + DTO + module
```

Recommended structure of a module:

```
rooms/
├── dto/                  # class-validator DTOs for requests and responses
├── schemas/              # Mongoose schemas (@Schema, @Prop)
├── rooms.controller.ts   # only receives requests and calls the service
├── rooms.service.ts      # business logic and business rules (BR-xxx)
├── rooms.service.spec.ts
└── rooms.module.ts
```

Planned modules (per the SRS and the Sprint 1 assignment):

| Module | Use cases | Owner |
|---|---|---|
| `auth`, `users`, `roles` | UC01–04, UC42–46, RBAC | Vũ Ngọc Dương |
| `feedback` | UC39–41 | Dương (UC40–41), Khoa (UC39) |
| `rooms`, `room-types`, `amenities`, `services` | UC47–54 | Trần Bảo Lâm |
| `equipment`, `maintenance` | UC35–36 | Trần Bảo Lâm |
| `notifications` (Brevo) | BR-NOTI | Trần Bảo Lâm |
| `reports` | UC55–57, Manager Dashboard | Trần Bảo Lâm |
| `bookings`, `room-holds` | UC05–07, UC09, UC12, My Bookings | Nguyễn Công Hiếu |
| `invoices`, `payments` (VNPay) | UC19–21 | Nguyễn Công Hiếu |
| `front-desk` | UC08, UC10–11, UC13–18 | Nguyễn Đăng Khoa |
| `tasks` | Task core, UC37–38 | Lê Anh Vũ |
| `service-orders` | UC22–27 | Lê Anh Vũ |
| `issues` | UC28–34 | Lê Anh Vũ |

Conventions:

- Internal imports use the `.js` extension (the project runs as ESM, `"type": "module"`).
- Endpoints require sign-in by default (the global `AuthGuard` checks `Authorization: Bearer <Firebase ID token>` and answers 401 otherwise); guest-facing endpoints carry `@Public()`.
- The global `RolesGuard` rejects the wrong role with 403. An endpoint without `@Roles()` can be called by any signed-in user.
- Restrict by role with `@Roles(Role.Manager, ...)` (see `common/`).
- To let roles created by a Manager (UC46) use an endpoint too, add `@Permissions('task:execute')`: a user passes if their role is in `@Roles()` OR the role holds the permission (granted in UC45). The permission codes are in `modules/roles/seed.ts`. On the frontend: `<RequireAuth roles={[...]} permissions={['task:execute']}>`.
- Do not read `process.env` directly inside a module; use `ConfigService`.
- Schemas follow the shared data conventions in `common/database/conventions.ts`: `timestamps: true`, soft delete through `isActive`, money as integer VND, business dates obtained with `toBusinessDate()`.
- Get the current user with `@CurrentUser() user: AuthUser` (`{ id, email, role }`).
- To test by role without Firebase, send the header `x-dev-role: MANAGER` (and `x-dev-user-id: <User _id>` when needed) through Swagger (the Authorize button) or Postman. It only works when `NODE_ENV` is not `production`.

## Seeding sample data

```bash
npm run seed                          # run directly (needs backend/.env)
docker compose exec backend npm run seed   # when running with Docker
```

It is safe to run repeatedly: it only adds missing records and never overwrites data you edited. The log prints the `_id` of the 5 sample accounts (`customer`, `receptionist`, `service`, `operations`, `manager`, each `@hms.local`) for use in the `x-dev-user-id` header.

To add a seed for your module:

1. Write `modules/<name>/seed.ts` exporting a function of type `Seed` (see `src/database/seed.ts`). Get the model with `app.get(getModelToken(X.name))` and write with `updateOne(..., { $setOnInsert }, { upsert: true })` on a single unique key.
2. Add that function to `SEEDS` in `src/database/seed.ts`, after the seeds your data refers to (for example `bookings` after `rooms` and `users`).
