# Grand Emily HMS — Hotel Management System

A web-based hotel management system. Guests search for rooms and book online, paying a deposit through VNPay.
Receptionists manage bookings, check-ins and check-outs. Service and operations staff receive and update their tasks.
Managers oversee operations, facilities, accounts and revenue.

[![CI](https://github.com/duongvn9/hotel-mangagement-system/actions/workflows/ci.yml/badge.svg)](https://github.com/duongvn9/hotel-mangagement-system/actions/workflows/ci.yml)

## Table of contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Getting started](#4-getting-started)
5. [Environment variables](#5-environment-variables)
6. [Testing and CI](#6-testing-and-ci)
7. [Production deployment](#7-production-deployment)
8. [UI and design system](#8-ui-and-design-system)
9. [Development conventions](#9-development-conventions)
10. [Troubleshooting](#10-troubleshooting)
11. [Team](#11-team)

---

## 1. Features

### 1.1 Roles

| Role | What they can do |
|---|---|
| **Guest** | Search available rooms, view room details, create a booking, pay the deposit, look up a booking by code, register an account |
| **Customer** | Everything a guest can do, plus: manage the profile, track bookings and payments, order room services, report issues, send feedback |
| **Receptionist** | Manage bookings (including walk-in bookings), check guests in and out, use the room status board, review service and issue requests, handle invoices and feedback |
| **Service Staff** | Work through assigned service tasks, update progress, report service issues |
| **Operations Staff** | Work through maintenance tasks, report equipment faults, browse maintenance history |
| **Manager** | Manage accounts, roles and permissions, rooms, room types, amenities and services; supervise task queues and issues; read revenue and operational reports |

Roles and permissions are editable at runtime, so custom roles with a subset of permissions are supported.

### 1.2 Functional areas (57 use cases)

| Area | Use cases |
|---|---|
| Accounts and profile | Register, login, logout, update profile |
| Search and booking | Search available rooms, view room details, create / update / cancel a booking, create a booking for a guest, booking detail and list |
| Front desk | Room status board, guest search, same-day check-in/out list, check in, record extra charges, check out |
| Invoices and payment | Invoice detail, deposit payment, final invoice payment (VNPay) |
| Service orders | Create, review, assign and track service orders and their history |
| Issues | Report, review, assign, resolve and close guest and service issues |
| Maintenance | Report equipment faults, maintenance history |
| Staff tasks | View assigned tasks, update task progress |
| Feedback | Submit, list and reply to feedback |
| Access control | Account list and edit, roles, permission assignment |
| Facilities | Rooms, room types, amenities, services |
| Supervision and reports | Task queue monitoring, revenue report, operational report |

### 1.3 Core data

`User`, `Role`, `Permission`, `RoomType`, `Room`, `Amenity`, `Booking` (multi-room), `RoomHold` (temporary hold while booking),
`Service`, `ServiceOrder`, `Equipment`, `Issue`, `Task`, `Invoice`, `PaymentTransaction`, `Feedback`.

### 1.4 External integrations

| Service | Used for |
|---|---|
| Firebase Authentication | Registration, email verification, login |
| VNPay payment gateway | Deposit and final invoice payments; the callback is idempotent |
| Brevo | Transactional notification emails, with error logging and retry (disabled by default) |
| S3-compatible storage | Room type images (a local archive directory, `HMS_ASSET_DIR`, is supported alongside it) |

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 8, TanStack Query 5, Axios, Tailwind CSS 4, shadcn/ui primitives (Radix) |
| Backend | NestJS 12 (ESM), TypeScript, Mongoose 9, class-validator, Joi (env validation), Swagger, Terminus (health check), Helmet |
| Database | MongoDB 8 |
| Testing and linting | Vitest, Testing Library, Supertest, Oxlint, Prettier |
| Infrastructure | Docker (multi-stage), Docker Compose (hot-reload dev stack, nginx production stack), GitHub Actions |
| Runtime | Node.js 24 LTS, npm 11 |

---

## 3. Project structure

```
.
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── main.ts             # bootstrap: /api prefix, v1 versioning, helmet, CORS, validation, Swagger
│   │   ├── app.module.ts       # config + Mongo + feature modules
│   │   ├── config/             # configuration.ts + env.validation.ts (Joi)
│   │   ├── common/             # Role enum, @Roles, @Public, guards, exception filter
│   │   └── modules/            # one module per functional area (see modules/README.md)
│   ├── test/                   # e2e tests (need MongoDB)
│   └── Dockerfile              # targets: dev | prod
├── frontend/                   # React single-page app
│   ├── src/
│   │   ├── app/                # App, router, navigation, query client
│   │   ├── components/         # shared UI: ui/ (shadcn), atoms, molecules, organisms, templates
│   │   ├── features/           # one folder per functional area (see features/README.md)
│   │   ├── layouts/  pages/
│   │   ├── lib/                # api-client (axios), env, utilities
│   │   └── styles/index.css    # Tailwind + design tokens
│   ├── nginx.conf              # used by the production image
│   └── Dockerfile              # targets: dev | prod (build context is the repo root)
├── design-system/              # design tokens, Tailwind theme, legacy aliases
├── ui-prototype/               # read-only reference UI prototype
├── DESIGN.md                   # design system guide
├── UI-REPOLISH-GUIDE.md        # how to migrate a page to the new UI
├── docker-compose.yml          # development stack
├── docker-compose.prod.yml     # production stack
├── Makefile                    # shortcuts for the common compose commands
└── .github/workflows/ci.yml    # lint, test, build, image build, smoke tests
```

---

## 4. Getting started

### 4.1 Requirements

- Docker Desktop (Compose v2.22 or newer, needed for `--watch`).
- Node.js 24 and npm 11 if you run outside Docker (`nvm use` reads `.nvmrc`). The lockfiles are generated with npm 11; older npm versions may fail on `npm ci`.

### 4.2 Run with Docker (recommended)

```bash
git clone https://github.com/duongvn9/hotel-mangagement-system.git
cd hotel-mangagement-system
docker compose up --build --watch              # or: make dev
docker compose exec backend npm run seed       # in another terminal, once the containers are up: sample data
```

If MongoDB is already running on your machine (port 27017 is taken), give the Docker one another port:
`MONGO_PORT=27018 docker compose up --build --watch` (or set `MONGO_PORT=27018` in `.env`).

| Address | What |
|---|---|
| http://localhost:5173 | Frontend (Vite, hot reload) |
| http://localhost:3000/api/v1/health | Backend health check |
| http://localhost:3000/api/docs | Swagger API documentation |
| `mongodb://hms:hms_dev_password@localhost:27017/hms?authSource=admin` | MongoDB (connect with Compass) |
| http://localhost:8081 | mongo-express, started with `docker compose --profile tools up --watch` (or `make dev-tools`) |

- `--watch` syncs `backend/src`, `frontend/src` and `design-system/` into the containers; changing a `package-lock.json` rebuilds them.
- To add a dependency, run `npm install <pkg>` in `backend/` or `frontend/` on your machine; compose rebuilds automatically.
- To wipe the dev database: `docker compose down -v`.

Other `make` targets: `make down`, `make logs`, `make prod`, `make prod-down`, `make test`.

### 4.3 Run without Docker

```bash
docker compose up -d mongo                      # only MongoDB

cd backend  && cp .env.example .env && npm ci && npm run seed && npm run start:dev
cd frontend && cp .env.example .env.local && npm ci && npm run dev
```

To use a MongoDB installed on your machine (no password), set `MONGODB_URI=mongodb://127.0.0.1:27017/hms` in `backend/.env`.

Commonly used scripts (run inside `backend/` or `frontend/`):

| Command | Purpose |
|---|---|
| `npm run lint` | Oxlint |
| `npm run format` / `npm run format:check` | Prettier (write / check) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Backend end-to-end tests (MongoDB must be running) |
| `npm run seed` | Create sample data (backend). Safe to run repeatedly; it does not overwrite data you edited |
| `npm run build` | Production build |

### 4.4 Signing in during development

If Firebase is not configured (`VITE_FIREBASE_*` in the frontend, `FIREBASE_PROJECT_ID` in the backend), the login page at
http://localhost:5173/login lists the seeded accounts and signs you in with one click. The frontend sends the headers
`x-dev-user-id` and `x-dev-role`; the backend accepts them only when `NODE_ENV` is not `production`. If the list is empty, run `npm run seed`.

| Seed account | Role |
|---|---|
| `manager@hms.local` | Manager |
| `receptionist@hms.local` | Receptionist |
| `service@hms.local` | Service Staff |
| `operations@hms.local` | Operations Staff |
| `customer@hms.local` | Customer |

- **Swagger:** open http://localhost:3000/api/docs, click **Authorize**, set `x-dev-role` (for example `MANAGER`) and, when an endpoint needs a real user, `x-dev-user-id` (the `_id` printed by the seed script).
- **With Firebase:** set `FIREBASE_PROJECT_ID` (enough to verify sign-ins) in `backend/.env` and `VITE_FIREBASE_*` in `frontend/.env.local`. The login page switches to email and password and `/register` works. To let a Manager create staff accounts in Firebase, also set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (service account).
- Seed accounts use `@hms.local` addresses, which cannot be verified on real Firebase: they are for dev mode only.

---

## 5. Environment variables

| File | Used when |
|---|---|
| `.env.example` → `.env` | Docker Compose (optional in dev, required in production) |
| `backend/.env.example` → `backend/.env` | Running the backend directly with npm |
| `frontend/.env.example` → `frontend/.env.local` | Running the frontend directly with npm |

The example files document every variable. The main groups:

| Group | Variables |
|---|---|
| Server | `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS`, `SWAGGER_ENABLED` |
| Database | `MONGODB_URI` (backend), `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_DB` (Compose) |
| Auth | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Payment | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` |
| Email | `NOTIFICATIONS_*`, `GMAIL_USER` (verified Brevo sender), and `BREVO_API_KEY` (disabled by default) |
| Images | `S3_*`, `HMS_ASSET_DIR` (backend); `VITE_ASSET_BASE_URL` (frontend) |
| Frontend | `VITE_APP_NAME`, `VITE_API_BASE_URL`, `VITE_PROXY_TARGET`, `VITE_FIREBASE_*` |
| Ports and images | `WEB_PORT`, `FRONTEND_PORT`, `BACKEND_PORT`, `MONGO_PORT`, `IMAGE_TAG` |

- **Never commit a `.env` file** (it is git-ignored). Share secrets through a private channel, not through the repository or the issue tracker.
- `VITE_*` variables are embedded in the JavaScript sent to the browser; only put public values there (for example the Firebase web config).
- To add a backend variable, declare it in `backend/src/config/env.validation.ts` and `configuration.ts`, and in both `.env.example` files.

---

## 6. Testing and CI

CI runs on pull requests, pushes to `main`, and manual dispatch. It validates application builds but does not publish container images or deploy. Semgrep runs without an account or token; downloading its public rules requires network access.

- Backend: unit tests with Vitest (`npm test`) and end-to-end tests with Supertest against a real MongoDB (`npm run test:e2e`). Business rules live in services and are covered by unit tests.
- Frontend: component and page tests with Vitest and Testing Library (`npm test`).
- `make test` runs both unit suites.

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`:

| Job | What it checks |
|---|---|
| `backend` | lint, format check, typecheck, unit tests, e2e tests (against MongoDB), build |
| `frontend` | lint, format check, unit tests, build |
| `semgrep` | scans backend and frontend application source with the Semgrep Community Edition `p/ci` ruleset; findings and invalid rules fail CI |
| `maintenance-smoke` | runtime smoke test of the Compose stack for the maintenance and manager dashboard features |

---

## 7. Production deployment

Two supported setups: everything on one server with Docker Compose (7.1), or the frontend on Vercel and the backend on Render (7.2).

### 7.1 Docker Compose on one server

```bash
cp .env.example .env          # set MONGO_ROOT_PASSWORD, CORS_ORIGINS and the Firebase / VNPay / Brevo secrets
docker compose -f docker-compose.prod.yml up -d --build    # or: make prod
```

- Only the `web` container (nginx, port `WEB_PORT`, default 80) is exposed. nginx serves the React build and proxies `/api/*` to `backend`.
- `backend` and `mongo` live on an internal network; MongoDB publishes no port.
- Images run as a non-root user, have health checks, and cap logs at 10 MB × 3 files.
- Swagger is off in production by default (`SWAGGER_ENABLED=false`).
- For HTTPS, put a TLS-terminating reverse proxy (Caddy, Traefik, Nginx Proxy Manager, Cloudflare Tunnel, …) in front of `WEB_PORT`.

### 7.2 Vercel (frontend) + Render (backend) + MongoDB Atlas

The backend needs a long-running process: it sweeps expired booking holds every minute, keeps an in-memory email queue, and writes uploaded images to disk before S3. Do not deploy it as Vercel serverless functions.

Vercel proxies `/api/*` to Render (`frontend/vercel.json`), so the browser sees one origin and `VITE_API_BASE_URL` stays `/api/v1`.

1. **MongoDB Atlas.** Create a cluster and a database user. Under Network Access allow `0.0.0.0/0` (Render has no fixed outbound IP on the free and starter plans). Copy the `mongodb+srv://…` connection string.
2. **Render.** Dashboard > New > Blueprint > this repository. `render.yaml` creates the `hms-backend` web service from `backend/Dockerfile`. Fill in the variables it asks for:
   - `MONGODB_URI`: the Atlas connection string.
   - `CORS_ORIGINS`: the Vercel URL, for example `https://hms.vercel.app` (comma-separate several).
   - `FIREBASE_*`, `S3_*`: same values as in `backend/.env.example`.
  - Email: create a free [Brevo](https://www.brevo.com) account, verify the sender address, and set `BREVO_API_KEY` plus `GMAIL_USER` (that sender address) in the backend service environment. Set `NOTIFICATIONS_ENABLED=true`, or booking emails are skipped. Brevo is the only supported transport.
   - `VNPAY_RETURN_URL`: `https://<vercel-domain>/payment/vnpay-return`.
   - `VNPAY_IPN_URL`: `https://<render-domain>/api/v1/payments/vnpay/ipn`.
   - Check that `https://<render-domain>/api/v1/health/ready` reports MongoDB as up.
3. **Vercel.** Import the repository and set **Root Directory** to `frontend` (keep "Include files outside the root directory" on; the build imports `design-system/`). Add the `VITE_APP_NAME`, `VITE_FIREBASE_*` and `VITE_ASSET_BASE_URL` environment variables, then deploy.
4. **Backend URL.** If Render gave the service a different URL than `https://hms-backend.onrender.com`, update the `/api/:path*` rewrite in `frontend/vercel.json` and redeploy (Vercel rewrites cannot read environment variables).
5. **Firebase.** Firebase Console > Authentication > Settings > Authorized domains: add the Vercel domain.
6. **Seed data (optional).** Run `npm run seed` locally in `backend/` with `MONGODB_URI` pointing at Atlas.

Notes:

- The Render free plan sleeps after 15 minutes without traffic. The first request then takes about a minute, and the hold sweep does not run while the service sleeps. Use a paid instance for demos and grading.
- Leaving `VITE_FIREBASE_*` empty switches the login screen to the dev account picker. The backend ignores the dev headers in production, so sign-in simply fails; always set them on Vercel.

---

## 8. UI and design system

- [`DESIGN.md`](DESIGN.md) is the design system: tokens, typography, layout, the atomic-design component catalog (`atoms`, `molecules`, `organisms`, `templates`) and screen patterns.
- [`ui-prototype/`](ui-prototype/) is a read-only copy of the reference UI prototype (also available at <https://stayflow-hotel-harmony.lovable.app>). Pages migrated to the new UI must match it.
- [`UI-REPOLISH-GUIDE.md`](UI-REPOLISH-GUIDE.md) explains how to migrate a page, with the prototype-to-app route map and a prompt template for AI assistants.
- [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md) hold the short rules for AI coding assistants working in this repository.
- Design tokens live in `design-system/`; `design-system/preview.html` is a static swatch sheet you can open in a browser.

---

## 9. Development conventions

**Branches and pull requests**

- `main` is always runnable. Create one branch per task from `main`: `feature/<area>-<topic>`, `fix/<topic>`, `chore/<topic>`.
- Open a pull request into `main`; CI must be green and at least one person should review it. Reference the issue-tracker key in the title.
- Merge with a merge commit once the scope is complete and the required checks pass, then pull the latest `main` before starting the next branch. A fix branched from an unmerged feature should wait for that feature to land.

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(booking): create multi-room bookings`, `fix(auth): …`, `docs: …`, `test: …`, `chore: …`. Keep commits small and focused so reviews stay easy.

**Backend**

- One module per functional area in `backend/src/modules/` (generate with `npx nest g resource modules/<name>`).
- Controllers only receive requests and call services; business rules live in services and have unit tests.
- DTOs use class-validator; the `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`.
- The API is versioned: `/api/v1/...`. Errors share one shape: `{ statusCode, message, error, path, timestamp }`.
- Guest-facing endpoints use `@Public()`; restrict by role with `@Roles(Role.Manager, ...)`.
- Internal imports use the `.js` extension because the backend runs as ESM.

**Frontend**

- Organize code by feature in `frontend/src/features/<name>`; call the API through `api` in `src/lib/api-client.ts` and TanStack Query.
- Import with the `@/` alias (it points to `src/`).
- To make a page appear in a menu, add an entry to `frontend/src/app/navigation.ts` (in that role's group, with a label unique within the role). Routes under `/staff`, `/manager`, `/reception` and `/operations` render inside the staff layout (sidebar); everything else renders in the public layout. Who may open a page is decided by the route's `RequireAuth`.
- Use design tokens and Tailwind classes, never hex values in components. Import UI from `@/components/atoms | molecules | organisms | templates`, not from `components/ui/` (see [`DESIGN.md`](DESIGN.md)).
- New components need hover, focus and disabled states and must be checked at 375px width.

---

## 10. Troubleshooting

- **MongoDB exits right after start with "Linux kernel versions 6.19 and newer has a known incompatibility":** MongoDB (every release, including Docker images) does not run on Linux kernels 6.19 through 7.0.13 ([MongoDB release notes](https://www.mongodb.com/docs/manual/release-notes/8.0)). Update Docker Desktop or the kernel to 7.0.14 or newer; until then, use a free MongoDB Atlas cluster and point `MONGODB_URI` at it.
- **`npm ci` reports that the lockfile does not match:** check that `node -v` is 24 and `npm -v` is 11.
- **The login page shows no seed accounts:** run `npm run seed` (or `docker compose exec backend npm run seed`).
- **Port already in use:** change `FRONTEND_PORT`, `BACKEND_PORT` or `MONGO_PORT` in `.env`.

---

## 11. Team

Vũ Ngọc Dương · Nguyễn Công Hiếu · Nguyễn Đăng Khoa · Lê Anh Vũ · Trần Bảo Lâm
