# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Design approved. Ready to begin coding. No code exists yet.**

- Full design spec: [`docs/superpowers/specs/2026-05-19-attendance-system-design.md`](docs/superpowers/specs/2026-05-19-attendance-system-design.md) — authoritative source for schema, API routes, component list, and business logic.
- Implementation plans (in order): [`plan-1-setup-db-shared.md`](docs/superpowers/plans/2026-05-19-plan-1-setup-db-shared.md) → [`plan-2-backend.md`](docs/superpowers/plans/2026-05-19-plan-2-backend.md) → [`plan-3-frontend.md`](docs/superpowers/plans/2026-05-19-plan-3-frontend.md)

---

## Commands

### Development
```bash
npm run dev                        # Start both server (port 4000) and client (port 5173) concurrently
npm run dev -w server              # Server only
npm run dev -w client              # Client only
```

### Database
```bash
cd server && npm run migrate       # Run SQL migrations on dev DB
NODE_ENV=test npm run migrate      # Run SQL migrations on test DB (run once before first test run)
cd server && npm run seed          # Seed dummy admin (ADMIN-001 / Admin1234!)
```

### Testing
```bash
npm test                                                           # All tests (shared + server)
cd server && NODE_ENV=test npm test                                # All backend tests
cd server && NODE_ENV=test npm test -- --testPathPattern=auth      # Single backend test file
cd client && npx vitest run                                        # All frontend tests
cd client && npx vitest run src/pages/LoginPage.test.tsx           # Single frontend test file
cd shared && npm test                                              # Shared message generator tests
```

### Build
```bash
npm run build                      # Build all packages (shared → server → client)
cd shared && npm run build         # Build shared package only (needed before server/client can import it)
```

---

## What This System Does

Foreign employees at a Japanese company submit attendance requests (late arrival, early departure, absence, other) to their managers. The system auto-generates bilingual (JP/EN) notification emails based on form data. Admins can approve or reject requests.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + CSS, Vite, react-i18next (default `ja`) |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL |
| Auth | JWT — 15-min access token (memory) + 8-hr refresh token (httpOnly cookie) |
| Email | Nodemailer via `EmailService` interface (swappable) |
| Repo structure | Monorepo — `client/`, `server/`, `shared/` via npm workspaces |
| Backend tests | Jest + Supertest against a **real** PostgreSQL test DB (`attendance_test`) |
| Frontend tests | Vitest + React Testing Library |
| Shared tests | Vitest |

---

## Project Structure (to be created)

```
attendance-system/
├── client/                   # React app (Vite)
│   └── src/
│       ├── pages/            # LoginPage, DashboardPage, RequestFormPage, ConfirmPage, AdminPage
│       ├── components/       # ProtectedRoute, Navbar, LanguageToggle, ProfilePanel, Toast,
│       │                     # RequestDetailPanel
│       ├── context/          # AuthContext, ToastContext
│       ├── hooks/            # useRequests
│       ├── api/              # client.ts — apiFetch with auto-refresh
│       ├── locales/          # en.json, ja.json
│       └── utils/            # timeOptions.ts
├── server/
│   └── src/
│       ├── routes/           # auth.ts, users.ts, requests.ts, admin.ts, attachments.ts
│       ├── middleware/       # authMiddleware.ts, roleMiddleware.ts, errorHandler.ts
│       ├── db/               # pool.ts, migrate.ts, seed.ts, queries/{users,requests,admin}.ts,
│       │                     # testHelpers.ts (clearDatabase)
│       └── services/
│           ├── email/        # EmailService.ts (interface), NodemailerService.ts
│           └── cleanupJob.ts # node-cron daily attachment cleanup
├── shared/
│   └── src/
│       ├── types.ts          # All shared TypeScript types
│       ├── messageGenerator.ts  # Pure fn: generateMessage(input) → { japanese, english? }
│       └── index.ts          # Re-exports types + messageGenerator
└── package.json              # Root: npm workspaces + dev/build/test scripts
```

---

## Key Decisions to Know Before Coding

### Two roles, strict separation
- `applicant` — submits requests, sees own history, cannot access `/admin`
- `admin` — sees all requests, can approve/reject, cannot access applicant screens
- Enforced by `roleMiddleware` on every route

### Message generator lives in `shared/`
`generateMessage()` is a pure function used by both the React client (live preview on every form change) and Express server (email body). Never duplicate this logic.

### `createApp()` factory pattern
`server/src/app.ts` exports `createApp()` (returns the Express app without starting a listener). `server/src/index.ts` calls it and listens. This pattern lets Supertest import `createApp()` directly — no port conflicts in tests.

### Backend tests use a real database
`NODE_ENV=test` switches the pool to `DATABASE_TEST_URL` (`attendance_test`). Tests use `clearDatabase()` in `beforeEach`/`afterAll`. Email is mocked via `jest.mock('../services/email/NodemailerService')`.

### File upload is part of request submission
Files (PDF/XLSX, ≤3 MB) are submitted as `multipart/form-data` in `POST /api/requests`. Request + attachment are created in one DB transaction so `attachment.request_id` is always set. Files auto-delete after 60 days via `node-cron`.

### Form state flows via React Router, not global state
Request form → Confirm screen handoff uses `location.state`. Back to Edit restores it. No Redux/Zustand needed.

### Access token lives in memory only
`client/src/api/client.ts` stores the access token in a module-level variable (never localStorage — XSS safe). `apiFetch` silently calls `/api/auth/refresh` on 401 and retries.

### Approval emails: rejection only
Submitting a request → email to assigned managers. Admin rejecting → email to applicant. Admin approving → no email.

### Language preference
react-i18next, default `ja`. User preference saved to `localStorage`. The language active at form submission is stored as `input_language` on the request and controls whether the generated message is JP-only or EN+JP.

---

## Reason Matrix (summary — see spec §4 for full detail)

| Request Type | Time dropdowns | Leave type | Date range |
|---|---|---|---|
| Late Arrival | Yes (5-min increments) | No | No |
| Early Departure | Yes (5-min increments) | No | No |
| Absence | No | Required | Optional |
| Other Request | No | No | No |

`reason_category` enum values: `illness`, `train_delay`, `oversleeping`, `personal`, `other`, `child_dropoff`, `work_appointment`, `other_appointment`, `direct_home`

---

## Environment Setup

Two PostgreSQL databases required before first run:
```bash
createdb attendance_dev
createdb attendance_test
```

Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `DATABASE_TEST_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and SMTP credentials.

Seed initial admin after migrations: `cd server && npm run seed` → creates `ADMIN-001` / `Admin1234!`.

---

## Deferred / TBD

- **Working hours** (`work_start`/`work_end` on users): columns exist in schema but time picker shows full-day range. Constraints TBD.
- **CSV import** for employees + manager assignments: future feature.
- **Password reset via email OTP**: future feature.
- **Email provider swap** (SendGrid/Resend): `EmailService` interface is ready, Nodemailer is default.
