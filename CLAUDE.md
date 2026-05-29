# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Current Status — as of 2026-05-28

**MVP + Admin Employee Management + Admin Dashboard Redesign + Todoke Generation fully implemented.** App is live on Railway and functional end-to-end.

### What is done
- Full monorepo scaffold (npm workspaces: `shared/`, `server/`, `client/`)
- PostgreSQL schema, migrations, seed data
- Complete backend API (auth, requests, admin, attachments, email, todoke)
- Complete React frontend with all pages and components
- Bilingual UI (Japanese default, English toggle) — i18next
- All tests passing: 108 backend + 24 shared + 3 frontend
- UI/UX iteration: hamburger nav, dropdowns, dashboards, footer, filters
- Deployed to Railway (Nixpacks builder, static client served by Express in production)
- Email notifications working via Brevo HTTP API (Railway blocks SMTP port 587)
- 7 request types: late, early_departure, absence, other_request, chokko (直行), chokki (直帰), kyujitsu_shukkin (休日出勤)
- Per-type reason lists (late has illness/train_delay/oversleeping/other; early_departure has illness/other; others keep 5-reason list)
- **Admin employee management** at `/admin/employees`: create/view/edit/deactivate/reactivate/delete employees, auto-generated temp passwords, manager assignment, complete audit trail; includes `dispatch_company` field
- **Admin dashboard redesign**: approval/rejection workflow removed; per-admin Gmail-style read/unread tracking via `request_read_status` junction table; hard-delete for admins; unread dot + bold font on unread rows; "Unread only" filter toggle; auto-marks read on panel open
- **Todoke generation**: `POST /api/todoke/generate` — fills the company's standard 届（設計開発）Excel template with request data; hanko embedding disabled (code present but commented out); optional card on ConfirmPage (generate/attach/download/remove)

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

Foreign employees at a Japanese company submit attendance requests (late arrival, early departure, absence, other) to their managers. The system auto-generates bilingual (JP/EN) notification emails based on form data. Employees can also optionally generate the company's standard 届 Excel form pre-filled with request data. Requests are one-directional — employees submit, admins receive and track via the dashboard (no approve/reject).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + inline CSS, Vite 8, react-i18next (default `ja`) |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL 18 |
| Auth | JWT — 15-min access token (memory) + 8-hr refresh token (httpOnly cookie) |
| Email | Brevo HTTP API (production) / Nodemailer SMTP (local dev) — via `EmailService` interface |
| Excel generation | ExcelJS (reads/writes xlsx template), @resvg/resvg-js (SVG→PNG for hanko, currently disabled) |
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
│       │   ├── DashboardPage.tsx     # User dashboard: Total stat card, search, type filter, sort
│       │   ├── RequestFormPage.tsx   # Multi-type form; per-type reason lists; train line picker for train_delay
│       │   ├── ConfirmPage.tsx       # Message preview, todoke card (generate/attach/download/remove), send
│       │   └── AdminPage.tsx         # Admin dashboard: unread indicators, unread filter toggle, search, type/date filters, detail panel
│       ├── components/
│       │   ├── Navbar.tsx            # Hamburger (left) → left-side drawer with profile header
│       │   ├── LanguageToggle.tsx    # Accepts navbar prop for white frosted style on blue bar
│       │   ├── Footer.tsx            # © MORABU HANSHIN Industry Co., Ltd.
│       │   ├── ProtectedRoute.tsx    # Role-based route guard
│       │   ├── RequestDetailPanel.tsx # Admin slide-in panel: auto-marks read on open, mark-unread toggle, delete with confirmation
│       │   ├── EmployeeDetailPanel.tsx # Employee details form incl. dispatch_company field
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
│       │   ├── admin.ts              # GET /admin/requests; POST /:id/read; POST /:id/unread; DELETE /:id
│       │   ├── attachments.ts        # GET /attachments/:id (admin only, streams file)
│       │   ├── employees.ts          # CRUD for admin employee management
│       │   └── todoke.ts             # POST /api/todoke/generate (applicant only; requires dispatch_company, employee_number, name_ja)
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
│       │   │   ├── 001_initial_schema.sql         # Full schema with enums, tables, indexes
│       │   │   ├── 002_nullable_reason_category.sql  # Makes reason_category nullable
│       │   │   ├── 003_update_enums.sql           # Replaces request_type/reason_category/leave_type enums; adds 3 new request types
│       │   │   ├── 004_employees.sql              # Admin employee management tables
│       │   │   ├── 005_employees_ext.sql          # Employee table extensions
│       │   │   ├── 006_read_status.sql            # request_read_status junction table (per-admin read tracking)
│       │   │   ├── 007_dispatch_company.sql       # ALTER TABLE users ADD COLUMN dispatch_company VARCHAR(100)
│       │   │   └── 008_reason_category_ext.sql    # Adds train_delay, oversleeping to reason_category enum
│       │   └── queries/
│       │       ├── users.ts          # findUserByEmployeeNumber, getUserWithTrainLines (incl. dispatch_company), getManagersByEmployeeId
│       │       ├── requests.ts       # createRequest, getUserRequests, getRequestById
│       │       ├── employees.ts      # listEmployees, getEmployeeById, updateEmployee, etc. (incl. dispatch_company)
│       │       └── admin.ts          # getAllRequests (LEFT JOIN read_status), markRequestRead, markRequestUnread, deleteRequest
│       ├── services/
│       │   ├── email/
│       │   │   ├── EmailService.ts       # Interface — send(to, subject, body)
│       │   │   └── NodemailerService.ts  # Exports emailService: Brevo if BREVO_API_KEY set, else Nodemailer
│       │   ├── todoke/
│       │   │   ├── hankoService.ts       # Generates hanko SVG → PNG buffer (@resvg/resvg-js); currently NOT called (disabled)
│       │   │   └── todokeService.ts      # Fills 届（設計開発）sheet in xlsx template; exports generateTodoke(input)
│       │   └── cleanupJob.ts             # node-cron: daily delete of attachments past expires_at
│       ├── assets/
│       │   └── todoke_template.xlsx      # Company standard 届 template (6 sheets; 1 main + 5 reference examples)
│       └── __tests__/
│           ├── auth.test.ts
│           ├── requests.test.ts
│           ├── admin.test.ts
│           ├── users.test.ts
│           ├── employees.test.ts
│           └── todoke.test.ts            # Also covers hankoService.test.ts (in services/todoke/)
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
import type { Request as AttendanceRequest, RequestType } from '@attendance/shared';
import { generateMessage } from '@attendance/shared';  // ← value import, no "type"
```

### Per-admin read/unread tracking
`request_read_status(request_id UUID, admin_id UUID, read_at TIMESTAMPTZ)` is a junction table where a row = read, no row = unread. Both FKs use `ON DELETE CASCADE` — deleting a request or user automatically cleans up read-status rows. `getAllRequests` LEFT JOINs this table keyed on the authenticated admin's id (`req.user!.id`), selecting `(rrs.admin_id IS NOT NULL) AS is_read`. The `adminId` param is always sourced from the JWT, never from request input — admin A cannot affect admin B's read state. `markRequestRead` uses `INSERT ... ON CONFLICT DO NOTHING` for idempotency.

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
`routes/requests.ts` (manager notification on submit) calls `emailService.send({...}).catch(...)` **without `await`**. This is intentional — awaiting the send blocked the HTTP response while SMTP was timing out, causing the UI to show "..." indefinitely. Email failures are logged to console but never surface to the user.

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

### Todoke template asset in production
`server/package.json` build script: `tsc && cp -r src/db/migrations dist/db/ && cp -r src/assets dist/assets`. The `cp -r src/assets dist/assets` step is required so `todoke_template.xlsx` is available at runtime on Railway. Do not remove it.

---

## Form Logic (current implementation)

| Request Type | Date | From/To | End Date | Reason | Leave Type | Admin Message |
|---|---|---|---|---|---|---|
| Late Arrival (遅刻) | `*` | `*` | — | `*` | — | optional |
| Early Departure (早退) | `*` | `*` | — | `*` | — | optional |
| Leave (休暇) | `*` | — | `*` | `*` | `*` | optional |
| Other Request (その他) | `*` | optional | — | — | — | `*` |
| Chokko (直行) | `*` | optional | — | optional | — | optional |
| Chokki (直帰) | `*` | optional | — | optional | — | optional |
| Kyujitsu Shukkin (休日出勤) | `*` | optional | — | optional | — | optional |

- `*` = mandatory (shows asterisk, blocks Next button if empty)
- Other Request is the only type where admin message is mandatory
- Chokko, Chokki, Kyujitsu Shukkin: all fields optional — form is always valid once date is set
- Reason detail textarea appears only when `reasonCategory` is in `NEEDS_DETAIL`: `['illness', 'other']`
- Train line picker (dropdown from `user.trainLines`) appears for Late Arrival when reason = `train_delay`; hidden entirely when user has no registered train lines

---

## UI/UX — Current State

### Navbar (Navbar.tsx)
- Sticky blue glassmorphism bar: `background: linear-gradient(160deg, rgba(96,165,250,0.82)…)` + `backdrop-filter: blur(14px)`
- **Left**: hamburger button (☰) — opens drawer from the **left**
- **Center**: brand name via `t('nav.brand')` — translates JA/EN
- **Right**: compact language toggle (`EN` / `JP` pill)
- Drawer: slides from left, `border-radius: 0 16px 16px 0`, blue gradient profile header with SVG avatar, both names (JA + EN), role badge, nav links, logout

### Dashboard (DashboardPage.tsx) — user
- 1 stat card (Total only)
- Search bar + type filter + sort (newest/oldest)
- Clear button appears when filters are active
- Row count footer: `n / total`

### Admin Dashboard (AdminPage.tsx)
- 1 stat card (Total only)
- Unread rows shown with blue dot + bold font
- "Unread only" toggle filter (pill button in search row)
- Separate search row (name/employee no. + sort dropdown)
- Separate filter row (type, date range with `→`)
- "Clear filters" appears when any filter (including unread toggle) is active
- Table rows open RequestDetailPanel on click

### RequestDetailPanel (RequestDetailPanel.tsx) — admin
- Auto-marks request as read on open (POST /read, skipped if already read)
- "Mark as Unread" / "Mark as Read" toggle button
- "Delete" button with inline two-step confirmation (Cancel / Delete)
- All field displays kept: name, type, date, reason, leave type, admin message, attachment download

### ConfirmPage (ConfirmPage.tsx) — todoke card
- Orange-bordered card below message preview (idle state): "Generate & Attach 届" button
- Calls `POST /api/todoke/generate` with form data; receives xlsx blob
- Green-bordered card (attached state): shows filename, "⬇ Download 届" + "✕ Remove" buttons
- On Send: todoke blob is submitted as `file` in multipart FormData (replaces any manually uploaded file)
- If dispatch_company, employee_number, or name_ja are missing in user profile, server returns 400 — consider showing a user-facing error

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
| **Password reset (self-service)** | No forgot-password flow for employees. Admin can reset via Employee Management UI. Future: email OTP. |
| **Email notification on account creation/reset** | Admin must manually share temp password. Deferred per spec. |
| **CSV import** | No bulk employee import. Future feature. |
| **Working hours constraints** | `work_start`/`work_end` columns editable in Employee Management UI but no enforcement on request form. Constraints TBD. |
| **Frontend test coverage** | Only LoginPage has tests. DashboardPage, AdminPage, RequestFormPage, ConfirmPage, AdminEmployeesPage have no tests. |
| **Mobile responsiveness** | Tables overflow on small screens. No responsive breakpoints implemented. |
| **Pagination** | Admin table loads all requests — no pagination or infinite scroll. Will degrade with large datasets. |
| **Dead DB columns** | `requests.status`, `requests.reviewed_by`, `requests.reviewed_at` and the `request_status` enum remain in DB and shared type but are no longer used (approval workflow removed). Safe to drop in a future migration. `RequestStatus` type still exported from shared. |
| **handleMarkRead/handleMarkUnread error handling** | In `RequestDetailPanel.tsx`, the toggle buttons don't check `res.ok` — they optimistically update local state. A network error silently leaves UI and DB out of sync. Low-risk for now. |
| **Hanko embedding** | `hankoService.ts` is fully implemented (SVG double-circle, auto-layout, @resvg/resvg-js PNG conversion) but the `generateHankoPng` call in `todokeService.ts` is commented out. Re-enable by uncommenting the import and the embed block (lines ~3 and ~180–188). |
| **Todoke 400 error UX** | If user profile is missing dispatch_company (required for todoke), the server returns 400 but ConfirmPage only shows a toast "Failed to generate todoke." Consider a more specific message. |

### Diagnostic endpoint (remove when no longer needed)
`GET /api/health/email` — tests SMTP/Brevo connectivity and returns `{ ok, error }` as JSON. Added for Railway debugging. Safe to remove from `server/src/app.ts` once email is confirmed stable.

### ProfilePanel.tsx
`client/src/components/ProfilePanel.tsx` still exists but is no longer used — its content was merged into the Navbar drawer. Safe to delete.

---

## Reason Matrix

`reason_category` enum values: `illness`, `family`, `personal`, `weather_transport`, `other`, `client_meeting`, `different_office`, `work_event`, `substitute_day`, `train_delay`, `oversleeping`

Reason lists differ by request type.

| Request Type | Available reasons | Required? |
|---|---|---|
| Late Arrival | illness, train_delay, oversleeping, other | Yes |
| Early Departure | illness, other | Yes |
| Leave (Absence) | illness, family, personal, weather_transport, other | Yes |
| Other Request | — | — |
| Chokko | client_meeting, different_office, work_event, other | No |
| Chokki | client_meeting, work_event, other | No |
| Kyujitsu Shukkin | substitute_day, client_meeting, other | No |

`NEEDS_DETAIL` (shows reason detail textarea): `['illness', 'other']`

For Late Arrival + `train_delay`: a train line picker dropdown is shown instead of a textarea. The selected line name (`line_name_ja`) is stored as `reasonDetail` in the DB and passed as `trainLineName` to the message generator. The `train_delay` option is hidden from the dropdown when the user has no registered train lines.

### Leave types

`leave_type` enum values: `paid`, `unpaid`, `substitute`, `special`

| Value | Japanese | English | Excel checkbox |
|---|---|---|---|
| `paid` | 有給休暇 | Paid Leave | Q20 |
| `unpaid` | 欠勤 | Unpaid (Absence) | F18 |
| `substitute` | 振替休日 | Substitute Holiday | K18 |
| `special` | 特別休暇（慶弔） | Special Leave (Wedding/Funeral) | W20 |

Leave type is only shown for `absence` requests.

---

## Todoke Generation

### Overview
`POST /api/todoke/generate` (applicant only) fills `server/src/assets/todoke_template.xlsx` sheet `届（設計開発）` and returns the buffer as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Filename format:** `{name_ja}_{yyyymmdd}_C-2 届・設計開発（雛型）２４０９０９.xlsx` — sent via `Content-Disposition: attachment; filename*=UTF-8''<percent-encoded>`.

**Mandatory user fields:** `dispatch_company`, `employee_number`, `name_ja` — returns 400 if any are empty/null.

### Cell mapping (sheet: 届（設計開発）)

| Cell(s) | Value |
|---|---|
| Z5, AD5, AF5 | Creation date: year, month, day |
| V9 | Dispatch company (`dispatch_company`) |
| V11 | Employee name (`name_ja`) |
| V13–AB13 | Employee number digits (7-digit, left-padded, one integer per cell) |
| F18–W20 | Type checkboxes (see table below) — all 8 reset to □ first, then correct one set to ☑ |
| J23, O23, R23, W23 | Start: year, month, day, day-of-week kanji |
| AA23, AD23 | Start: hour (no leading zero), minute |
| J25, O25, R25, W25 | End: year, month, day, day-of-week kanji (= startDate if no endDate) |
| AA25, AD25 | End: hour (no leading zero), minute |
| F28 | Reason text (see `buildReasonText`) |
| F32 | Left empty |

### Type → checkbox mapping (confirmed from reference sheets)

| Request Type | Leave Type | Cell |
|---|---|---|
| late | — | F20 (遅刻) |
| early_departure | — | K20 (早退) |
| absence | paid | Q20 (有給休暇) |
| absence | unpaid | F18 (欠勤) |
| absence | substitute | K18 (振替休日) |
| absence | special | W20 (特別休暇（慶弔）) |
| kyujitsu_shukkin | — | Q18 (休日出勤) |
| other_request / chokko / chokki | — | W18 (その他) |

### Time defaults

Types that use actual form times (`TYPES_WITH_TIME`): `late`, `early_departure`, `other_request`, `kyujitsu_shukkin`

All other types (absence, chokko, chokki) default to 09:00 → 17:45.

### Hanko (currently disabled)
`hankoService.ts` generates a red double-circle SVG stamp with the employee's Japanese name auto-laid out inside. `@resvg/resvg-js` converts SVG → PNG at 180px width. The embed anchor is AF9:AH11 (`tl: {col:31, row:8}, br: {col:34, row:11}`). The call is commented out in `todokeService.ts` — re-enable when ready.
