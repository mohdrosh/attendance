# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Current Status — as of 2026-05-22

**MVP is fully implemented and deployed.** The app is live on Railway and functional end-to-end: login, request submission, admin approval/rejection, bilingual email notifications, file attachments.

### What is done
- Full monorepo scaffold (npm workspaces: `shared/`, `server/`, `client/`)
- PostgreSQL schema, migrations, seed data
- Complete backend API (auth, requests, admin, attachments, email)
- Complete React frontend with all pages and components
- Bilingual UI (Japanese default, English toggle) — i18next
- All tests passing: 41 shared + 48 backend + 3 frontend
- UI/UX iteration: hamburger nav, dropdowns, dashboards, footer, status badges, filters
- Deployed to Railway (Nixpacks builder, static client served by Express in production)
- Email notifications working via Brevo HTTP API (Railway blocks SMTP port 587)
- 7 request types: late, early_departure, absence, other_request, chokko (直行), chokki (直帰), kyujitsu_shukkin (休日出勤)
- Simplified 5-reason list shared across all types; special (特別休暇（慶弔）) leave type added

### Known working credentials (seeded)
| Role | Employee No. | Password |
|---|---|---|
| Admin | `ADMIN-001` | `Admin1234!` |
| Employee | `EMP-001` | `Emp1234!` |

---

## Commands

### Development
```bash
npm run dev                        # Start both server (port 4000) and client (port 5173) concurrently
npm run dev -w server              # Server only (uses ts-node-dev)
npm run dev -w client              # Client only (Vite HMR)
```

> **macOS note:** PostgreSQL must be running (Postgres.app). If `psql` is not in PATH, prepend:
> `PATH="/Applications/Postgres.app/Contents/Versions/18/bin:$PATH"`

### Database
```bash
cd server && npm run migrate       # Run SQL migrations on dev DB
NODE_ENV=test npm run migrate      # Run SQL migrations on test DB (run once before first test run)
cd server && npm run seed          # Seed dummy admin + employee with manager assignment
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
cd shared && npm run build         # Build shared package only
```

---

## What This System Does

Foreign employees at a Japanese company submit attendance requests (late arrival, early departure, absence, other) to their managers. The system auto-generates bilingual (JP/EN) notification emails based on form data. Admins can approve or reject requests.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + inline CSS, Vite 8, react-i18next (default `ja`) |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL 18 |
| Auth | JWT — 15-min access token (memory) + 8-hr refresh token (httpOnly cookie) |
| Email | Brevo HTTP API (production) / Nodemailer SMTP (local dev) — via `EmailService` interface |
| Repo structure | Monorepo — `client/`, `server/`, `shared/` via npm workspaces |
| Backend tests | Jest + Supertest against a **real** PostgreSQL test DB (`attendance_test`) |
| Frontend tests | Vitest + React Testing Library |
| Shared tests | Vitest |

---

## Project Structure (actual, as built)

```
attendance-system/
├── client/                   # React app (Vite 8)
│   ├── vite.config.ts        # IMPORTANT: has resolve.alias for @attendance/shared → TS source
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx         # Demo credential buttons (auto-fill + login)
│       │   ├── DashboardPage.tsx     # User dashboard: stats, search, filter, sort
│       │   ├── RequestFormPage.tsx   # Multi-type form with dropdowns, asterisks, placeholders
│       │   ├── ConfirmPage.tsx       # Preview bilingual message, recipients, send
│       │   └── AdminPage.tsx         # Admin dashboard: stats, search, filter, sort, detail panel
│       ├── components/
│       │   ├── Navbar.tsx            # Hamburger (left) → left-side drawer with profile header
│       │   ├── LanguageToggle.tsx    # Accepts navbar prop for white frosted style on blue bar
│       │   ├── Footer.tsx            # © MORABU HANSHIN Industry Co., Ltd.
│       │   ├── ProtectedRoute.tsx    # Role-based route guard
│       │   ├── RequestDetailPanel.tsx # Admin approve/reject slide-in panel
│       │   ├── ProfilePanel.tsx      # Kept but superseded by Navbar drawer (can be removed)
│       │   └── Toast.tsx             # Fixed-position success toast
│       ├── context/
│       │   ├── AuthContext.tsx       # user, loading, login(), logout() — exported as AuthContext
│       │   └── ToastContext.tsx      # showToast(msg)
│       ├── hooks/
│       │   └── useRequests.ts        # Fetches /api/requests for current user
│       ├── api/
│       │   └── client.ts             # apiFetch with silent 401→refresh retry; token in memory
│       ├── locales/
│       │   ├── en.json               # Full English translations
│       │   └── ja.json               # Full Japanese translations
│       ├── utils/
│       │   └── timeOptions.ts        # 5-min increment time options (00:00–23:55)
│       ├── i18n.ts                   # i18next init; reads lang from localStorage, default ja
│       ├── index.css                 # Minimal reset + ::placeholder { color: #c4c9d4 }
│       └── test/
│           └── setup.ts              # Vitest setup (jest-dom)
├── server/
│   └── src/
│       ├── app.ts                    # createApp() factory — no listen()
│       ├── index.ts                  # Calls createApp(), listens on PORT (default 4000)
│       ├── config.ts                 # dotenv from ../../.env (project root), exports typed config
│       ├── routes/
│       │   ├── auth.ts               # POST /login, POST /refresh, POST /logout
│       │   ├── users.ts              # GET /me, GET /me/managers, GET /me/train-lines
│       │   ├── requests.ts           # GET, POST /requests (multipart upload via multer)
│       │   ├── admin.ts              # GET /admin/requests (filters), PATCH /:id/status
│       │   └── attachments.ts        # GET /attachments/:id (admin only, streams file)
│       ├── middleware/
│       │   ├── authMiddleware.ts     # Verifies JWT Bearer token
│       │   ├── roleMiddleware.ts     # requireRole('admin' | 'applicant')
│       │   └── errorHandler.ts       # Global Express error handler
│       ├── db/
│       │   ├── pool.ts               # pg Pool; switches to test DB when NODE_ENV=test; DATE type parser returns string not JS Date
│       │   ├── migrate.ts            # Runs SQL migration files in order, tracks in schema_migrations table
│       │   ├── seed.ts               # Creates ADMIN-001 + EMP-001 with manager assignment
│       │   ├── testHelpers.ts        # clearDatabase() for test beforeEach/afterAll
│       │   ├── migrations/
│       │   │   ├── 001_initial_schema.sql       # Full schema with enums, tables, indexes
│       │   │   └── 002_nullable_reason_category.sql  # Makes reason_category nullable (other_request has no required reason)
│   │   │   └── 003_update_enums.sql         # Replaces request_type/reason_category/leave_type enums; adds 3 new request types
│       │   └── queries/
│       │       ├── users.ts          # getUserByEmployeeNumber, getManagersByEmployeeId, etc.
│       │       ├── requests.ts       # createRequest, getUserRequests, getRequestById
│       │       └── admin.ts          # getFilteredRequests, updateRequestStatus
│       ├── services/
│       │   ├── email/
│       │   │   ├── EmailService.ts   # Interface — send(to, subject, body)
│       │   │   └── NodemailerService.ts  # Exports emailService: Brevo if BREVO_API_KEY set, else Nodemailer
│       │   └── cleanupJob.ts         # node-cron: daily delete of attachments past expires_at
│       └── __tests__/
│           ├── auth.test.ts
│           ├── requests.test.ts
│           ├── admin.test.ts
│           └── users.test.ts
├── shared/
│   └── src/
│       ├── types.ts                  # All shared TypeScript types (interfaces only — no enums)
│       ├── messageGenerator.ts       # generateMessage(input) → { japanese, english? }
│       └── index.ts                  # Re-exports types + messageGenerator
├── .env                              # Not committed — copy from .env.example
├── .env.example                      # Template with all required keys
└── package.json                      # Root: npm workspaces + concurrently dev script
```

---

## Critical Architecture Notes

### @attendance/shared — Vite alias required
The shared package compiles to **CommonJS** (`shared/dist/`). Browsers can't run CJS. Vite's dev server was serving it raw causing `require is not defined` white screen.

**Fix in `client/vite.config.ts`:**
```ts
resolve: {
  alias: {
    '@attendance/shared': path.resolve(__dirname, '../shared/src/index.ts'),
  },
},
```
This makes Vite resolve `@attendance/shared` directly to TypeScript source, transformed by esbuild (ESM). **Do not remove this alias.**

### import type for all shared types
`client/tsconfig.app.json` has `verbatimModuleSyntax: true`. All type-only imports from `@attendance/shared` must use `import type`:
```ts
import type { Request, RequestStatus, UserProfile } from '@attendance/shared';
import { generateMessage } from '@attendance/shared';  // ← value import, no "type"
```

### createApp() factory pattern
`server/src/app.ts` exports `createApp()` — returns the Express app without calling `.listen()`. `server/src/index.ts` calls `createApp()` then `.listen()`. Tests import `createApp()` directly via Supertest with no port conflicts.

### dotenv path
`server/src/config.ts` uses `dotenv.config({ path: path.join(__dirname, '../../.env') })` — loads `.env` from the project root, not `server/`. This is intentional for the monorepo layout.

### Backend tests use real PostgreSQL
`NODE_ENV=test` switches `pool.ts` to `DATABASE_TEST_URL` (`attendance_test`). Tests use `clearDatabase()` in `beforeEach`/`afterAll`. Email is mocked via `jest.mock('../services/email/NodemailerService')`. Never use mocks for DB.

### SQL attachment join
The attachment join in `requests.ts` and `admin.ts` queries uses `CASE WHEN` not `FILTER`:
```sql
CASE WHEN a.id IS NOT NULL THEN json_build_object(
  'id', a.id, 'original_filename', a.original_filename, ...
) END AS attachment
```
PostgreSQL 18 does not allow `FILTER` on non-aggregate functions. Do not change this to use `FILTER`.

### Access token in memory
`client/src/api/client.ts` stores the access token in a module-level variable — never localStorage (XSS safe). `apiFetch` silently calls `/api/auth/refresh` on 401 and retries once.

### Email service — auto-selects provider
`server/src/services/email/NodemailerService.ts` exports a single `emailService` instance:
- **If `BREVO_API_KEY` is set** → uses Brevo HTTP API (`fetch` to `api.brevo.com`) — required for Railway and any cloud host that blocks outbound SMTP
- **Otherwise** → uses Nodemailer SMTP (local dev with Gmail app password)

**Why Brevo:** Railway hard-blocks all outbound TCP on port 587 (SMTP). All connections show `ICMP_CSUM` in network flow logs. Brevo sends over HTTPS (port 443) which is never blocked.

**Brevo setup:** Sign up free at brevo.com → verify sender email → get API key → set `BREVO_API_KEY` env var. The `SMTP_FROM` value is used as the sender address and must match the verified sender in Brevo.

### Email sends are fire-and-forget
Both `routes/requests.ts` (manager notification on submit) and `routes/admin.ts` (employee notification on approve/reject) call `emailService.send({...}).catch(...)` **without `await`**. This is intentional — awaiting the send blocked the HTTP response while SMTP was timing out, causing the UI to show "..." indefinitely. Email failures are logged to console but never surface to the user.

### DATE columns return strings
`server/src/db/pool.ts` registers a custom type parser:
```ts
types.setTypeParser(types.builtins.DATE, val => val);
```
Without this, node-postgres converts DATE columns to JS `Date` objects, which shift timezone and serialize as ISO timestamps (`2026-05-19T15:00:00.000Z`). The parser returns the raw `YYYY-MM-DD` string instead.

### reason_category is nullable
`reason_category` was originally `NOT NULL`. Migration `002` drops that constraint. The `other_request` type does not require a reason — the frontend omits the field and the backend skips the validation check for that type. Do not add `NOT NULL` back.

### Production static serving
In production (`NODE_ENV=production`), `server/src/app.ts` serves the React build from `client/dist/` via `express.static` and catches all unmatched routes with the `index.html` SPA fallback. CORS middleware is disabled in production (same-origin). The `npm run build` step must complete before starting the server.

---

## Form Logic (current implementation)

| Request Type | Date | From/To | End Date | Reason | Leave Type | Admin Message |
|---|---|---|---|---|---|---|
| Late Arrival (遅刻) | `*` | `*` | — | `*` | — | optional |
| Early Departure (早退) | `*` | `*` | — | `*` | — | optional |
| Absence (欠勤) | `*` | — | `*` | `*` | `*` | optional |
| Other Request (その他) | `*` | optional | — | — | — | `*` |
| Chokko (直行) | `*` | optional | — | optional | — | optional |
| Chokki (直帰) | `*` | optional | — | optional | — | optional |
| Kyujitsu Shukkin (休日出勤) | `*` | optional | — | optional | — | optional |

- `*` = mandatory (shows asterisk, blocks Next button if empty)
- Other Request is the only type where admin message is mandatory
- Chokko, Chokki, Kyujitsu Shukkin: all fields optional — form is always valid once date is set
- Reason detail textarea appears only when `reasonCategory` is in `NEEDS_DETAIL`: `['illness', 'other']`
- No train line picker — train line functionality removed

---

## UI/UX — Current State

### Navbar (Navbar.tsx)
- Sticky blue glassmorphism bar: `background: linear-gradient(160deg, rgba(96,165,250,0.82)…)` + `backdrop-filter: blur(14px)`
- **Left**: hamburger button (☰) — opens drawer from the **left**
- **Center**: brand name via `t('nav.brand')` — translates JA/EN
- **Right**: compact language toggle (`EN` / `JP` pill)
- Drawer: slides from left, `border-radius: 0 16px 16px 0`, blue gradient profile header with SVG avatar, both names (JA + EN), role badge, nav links, logout

### Dashboard (DashboardPage.tsx) — user
- 4 stat cards (Total/Pending/Approved/Rejected) — clicking status cards filters the table
- Search bar + type filter + status filter + sort (newest/oldest/by status)
- Clear button appears when filters are active
- Row count footer: `n / total`

### Admin Dashboard (AdminPage.tsx)
- Same stat cards (clickable status filter)
- Separate search row (name/employee no. + sort dropdown)
- Separate filter row (type, status, date range with `→`)
- Table rows open RequestDetailPanel on click

### Login Page (LoginPage.tsx)
- Demo account buttons: clicking **Admin** or **Employee** auto-fills credentials and immediately logs in

### Footer (Footer.tsx)
- `© {year} All rights reserved by MORABU HANSHIN Industry Co., Ltd.`
- Present on: DashboardPage, AdminPage, RequestFormPage, ConfirmPage

---

## Environment Variables

### Local (`.env` in project root — never committed)
```
DATABASE_URL=postgres://user@localhost:5432/attendance_dev
DATABASE_TEST_URL=postgres://user@localhost:5432/attendance_test
JWT_SECRET=...
JWT_REFRESH_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-gmail-app-password      # 16-char app password from Google account settings
SMTP_FROM=Attendance System <your@gmail.com>
PORT=4000
CLIENT_URL=http://localhost:5173
```

### Railway (set in Variables tab — no .env file)
All of the above minus `DATABASE_TEST_URL`, `CLIENT_URL`, `PORT`, plus:
```
BREVO_API_KEY=xkeysib-...              # From brevo.com — replaces SMTP for cloud deployment
NODE_ENV=production
```
`SMTP_FROM` must match the verified sender email registered in Brevo.

---

## Environment Setup (fresh machine)

```bash
# 1. Start Postgres (Postgres.app on macOS)
# 2. Create databases
createdb attendance_dev
createdb attendance_test

# 3. Install dependencies
npm install

# 4. Copy and fill environment file
cp .env.example .env
# Fill in: DATABASE_URL, DATABASE_TEST_URL, JWT_SECRET, JWT_REFRESH_SECRET, SMTP_*

# 5. Run migrations and seed
cd server && npm run migrate
cd server && npm run seed

# 6. Start dev servers
cd .. && npm run dev
# Server: http://localhost:4000
# Client: http://localhost:5173 (or next available port if 5173 is taken)
```

---

## Open / Deferred Items

### Not yet built — known gaps
| Item | Notes |
|---|---|
| **Admin: create/edit employees** | No UI to add employees or assign managers. Must be done via seed script or direct SQL. |
| **Password reset** | No forgot-password flow. Future: email OTP. |
| **CSV import** | No bulk employee import. Future feature. |
| **Working hours constraints** | `work_start`/`work_end` columns exist on `users` table but time picker shows full range. Constraints TBD. |
| **Frontend test coverage** | Only LoginPage has tests. DashboardPage, AdminPage, RequestFormPage, ConfirmPage have no tests. |
| **Mobile responsiveness** | Tables overflow on small screens. No responsive breakpoints implemented. |
| **Pagination** | Admin table loads all requests — no pagination or infinite scroll. Will degrade with large datasets. |
| **Notification on approval** | By design: approval sends no email. Rejection sends email to applicant. Revisit if requirements change. |

### Diagnostic endpoint (remove when no longer needed)
`GET /api/health/email` — tests SMTP/Brevo connectivity and returns `{ ok, error }` as JSON. Added for Railway debugging. Safe to remove from `server/src/app.ts` once email is confirmed stable.

### ProfilePanel.tsx
`client/src/components/ProfilePanel.tsx` still exists but is no longer used — its content was merged into the Navbar drawer. Safe to delete.

---

## Reason Matrix

`reason_category` enum values: `illness`, `family`, `personal`, `weather_transport`, `other`

All request types that show a reason picker share the same 5-reason list. `other_request` has no reason picker.

| Request Type | Available reasons | Required? |
|---|---|---|
| Late Arrival | illness, family, personal, weather_transport, other | Yes |
| Early Departure | illness, family, personal, weather_transport, other | Yes |
| Absence | illness, family, personal, weather_transport, other | Yes |
| Other Request | — | — |
| Chokko | illness, family, personal, weather_transport, other | No |
| Chokki | illness, family, personal, weather_transport, other | No |
| Kyujitsu Shukkin | illness, family, personal, weather_transport, other | No |

`NEEDS_DETAIL` (shows reason detail textarea): `['illness', 'other']`

### Leave types

`leave_type` enum values: `paid`, `unpaid`, `substitute`, `special`

| Value | Japanese | English |
|---|---|---|
| `paid` | 有給休暇 | Paid Leave |
| `unpaid` | 欠勤 | Unpaid Leave |
| `substitute` | 振替休日 | Substitute Holiday |
| `special` | 特別休暇（慶弔） | Special Leave (Wedding/Funeral) |

Leave type is only shown for `absence` requests.
