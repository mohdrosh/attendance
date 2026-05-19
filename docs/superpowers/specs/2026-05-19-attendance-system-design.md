# Attendance Request System — Design Spec

**Date:** 2026-05-19
**Status:** Approved

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | React + CSS, Vite |
| i18n | react-i18next — default `ja`, preference persisted in `localStorage` |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL |
| Auth | JWT — short-lived access token (15 min, in memory) + refresh token (8 hr, httpOnly cookie) |
| Email | Nodemailer, wrapped behind `EmailService` interface for easy provider swap |
| File cleanup | `node-cron` daily job |

---

## 2. Project Structure

```
attendance-system/
├── client/                   # React app (Vite)
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, RequestForm, Confirm, AdminDashboard
│   │   ├── components/       # ProtectedRoute, LanguageToggle, RequestForm,
│   │   │                     # MessagePreview, FileUploadField, AdminRequestsTable,
│   │   │                     # RequestDetailPanel, ProfilePanel, Toast
│   │   ├── hooks/            # useAuth, useRequests
│   │   ├── api/              # Typed fetch wrappers per endpoint
│   │   ├── locales/          # en.json, ja.json
│   │   └── utils/            # dateHelpers.ts
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/           # auth.ts, requests.ts, admin.ts, attachments.ts
│   │   ├── middleware/        # authMiddleware.ts, roleMiddleware.ts, errorHandler.ts
│   │   ├── db/               # pool.ts, queries per domain
│   │   ├── services/
│   │   │   ├── email/
│   │   │   │   ├── EmailService.ts        # interface: send(to, subject, body)
│   │   │   │   └── NodemailerService.ts   # implements EmailService
│   │   │   └── cleanupJob.ts              # node-cron: delete expired attachments daily
│   ├── uploads/              # file storage (UUID-named files, never original names)
│   └── package.json
├── shared/
│   ├── types.ts              # Shared TypeScript types (Request, User, MessageInput, etc.)
│   └── messageGenerator.ts  # Pure function: generateMessage(input) → { japanese, english? }
└── package.json              # Root scripts: dev, build
```

---

## 3. Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_number | varchar UNIQUE | Used for login |
| name_ja | varchar | |
| name_en | varchar | |
| password_hash | varchar | bcrypt |
| role | enum: `applicant`, `admin` | |
| email | varchar UNIQUE | Used for sending notifications |
| work_start | time | TBD — separate discussion |
| work_end | time | TBD — separate discussion |
| created_at | timestamp | |

### `train_lines`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | One employee, many lines |
| line_name_ja | varchar | |
| line_name_en | varchar | |

### `employee_managers`
Many-to-many join table. A user has 1+ assigned admins; not all admins are visible to all users.

| Column | Type |
|---|---|
| employee_id | uuid FK → users (PK) |
| manager_id | uuid FK → users (PK) |

### `requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid FK → users | |
| request_type | enum | `late`, `early_departure`, `absence`, `other_request` |
| start_date | date | |
| end_date | date nullable | Multi-day absences only |
| time_from | time nullable | Late / Early Departure only |
| time_to | time nullable | Late / Early Departure only |
| reason_category | enum | See reason matrix below |
| reason_detail | text nullable | Symptom text or free-form explanation |
| train_line_id | uuid FK → train_lines nullable | Train Delay only |
| leave_type | enum nullable | Absence only: `paid`, `unpaid`, `substitute`, `other` |
| admin_message | text nullable | Optional free-text from applicant to admin — all types |
| input_language | enum: `ja`, `en` | Language active when form was submitted |
| status | enum | `pending` (default), `approved`, `rejected` |
| reviewed_by | uuid FK → users nullable | Admin who acted |
| reviewed_at | timestamp nullable | |
| submitted_at | timestamp | |

### `attachments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| request_id | uuid FK → requests | Always set — upload is part of request submission |
| original_filename | varchar | Display only |
| storage_path | varchar | UUID-named path on disk, never exposed to client |
| mime_type | varchar | `application/pdf` or xlsx MIME |
| file_size | integer | Bytes, max 3,145,728 (3 MB) |
| uploaded_at | timestamp | |
| expires_at | timestamp | `uploaded_at + 60 days` — enforced at serve time and by cleanup job |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| token_hash | varchar | Stored hashed |
| expires_at | timestamp | 8 hours from login |
| created_at | timestamp | |

---

## 4. Reason Matrix

### Late Arrival _(time dropdowns shown, 5-min increments, full day range)_
| Reason | Extra input |
|---|---|
| Train Delay | Registered train lines dropdown |
| Oversleeping | None |
| Dropping child at school / daycare | None |
| Other | Textarea |

### Early Departure _(time dropdowns shown)_
| Reason | Extra input |
|---|---|
| Illness | Symptom textarea |
| Work-related appointment | None |
| Other appointment | Textarea |
| Other | Textarea |

### Absence _(no time dropdowns, leave type required, date range optional)_
| Reason | Extra input |
|---|---|
| Illness | Symptom textarea |
| Personal Reasons | None |
| Other | Textarea |

### Other Request _(no time dropdowns, no leave type, single date only)_
| Reason | Extra input |
|---|---|
| Going home directly from client meeting | None |
| Other | Textarea |

**`reason_category` enum values:** `illness`, `train_delay`, `oversleeping`, `personal`, `other`, `child_dropoff`, `work_appointment`, `other_appointment`, `direct_home`

---

## 5. API Routes

### Auth — Public
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | `employee_number` + `password` → access token + refresh token (httpOnly cookie) + full user profile (including trainLines) |
| POST | `/api/auth/refresh` | Refresh cookie → new access token |
| POST | `/api/auth/logout` | Invalidates refresh token in DB, clears cookie |

### User — Authenticated (any role)
| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile |
| GET | `/api/users/me/managers` | Assigned managers for current user — **lazy loaded** (called only when Confirm screen dropdown is expanded) |

### Requests — Applicant only
| Method | Path | Description |
|---|---|---|
| GET | `/api/requests` | Current user's request history including `status` |
| POST | `/api/requests` | Submit request as `multipart/form-data` (fields + optional file). Creates request + attachment in one DB transaction. Triggers email to assigned managers. |

### Admin — Admin only
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/requests` | All requests, filterable: `?name=&type=&from=&to=&status=` |
| PATCH | `/api/admin/requests/:id/status` | Body: `{ status: "approved" \| "rejected" }`. Sets `reviewed_by` + `reviewed_at`. If rejected, sends email to applicant. |
| GET | `/api/attachments/:id` | Streams file to browser. Validates `expires_at` before serving. |

---

## 6. Auth Flow

- Access token: 15-min JWT, stored **in memory only** (never localStorage — XSS safe). Sent as `Authorization: Bearer <token>`.
- Refresh token: 8-hr, stored **hashed in DB**, sent via httpOnly cookie. Client silently calls `/api/auth/refresh` when access token expires.
- Role enforcement: `roleMiddleware` reads JWT `role` claim. Wrong role → 403.
- Session expiry: refresh token `expires_at` enforced server-side. After 8 hours, user is redirected to login.

---

## 7. Frontend Pages & Routing

| Route | Access | Description |
|---|---|---|
| `/login` | Public | Redirects to dashboard if already logged in |
| `/dashboard` | Applicant | Request history table with Status badges + Refresh button + New Request button |
| `/request/new` | Applicant | Request form with all conditional fields |
| `/request/confirm` | Applicant | Summary + message preview + lazy manager dropdown + Send button |
| `/admin` | Admin | All requests table with filters; click row → detail panel |

**Form → Confirm handoff:** form state passed via React Router `location.state`. Back to Edit restores it. No global store for form state.

---

## 8. Key Frontend Components

| Component | Purpose |
|---|---|
| `ProtectedRoute` | Checks auth + role; redirects on mismatch |
| `LanguageToggle` | 🇯🇵/🇬🇧 in top-right of all authenticated screens |
| `ProfilePanel` | Slide-in drawer showing name (EN+JA), employee number, role, train line names. Reads from `AuthContext` — no API call. |
| `RequestForm` | All conditional field logic per request type + reason |
| `FileUploadField` | PDF/XLSX picker, client-side type + size validation (≤3 MB) |
| `MessagePreview` | Calls `generateMessage()` from `shared/`, renders JP-only or EN+JP |
| `AdminRequestsTable` | Filterable table; click row opens `RequestDetailPanel` |
| `RequestDetailPanel` | Slide-in with full request details + Approve / Reject buttons (admin only) |
| `Toast` | Post-send notification: "Sent to [names] and is pending approval." Auto-dismisses in 4s. |

---

## 9. Message Generator — `shared/messageGenerator.ts`

Pure function, no side effects. Used by client (live preview on every form change) and server (email body).

```ts
generateMessage(input: MessageInput): MessageOutput

type MessageInput = {
  requestType: 'late' | 'early_departure' | 'absence' | 'other_request'
  reasonCategory: ReasonCategory
  reasonDetail?: string
  trainLineName?: string       // plain string in active language
  startDate: string            // ISO date
  endDate?: string
  timeFrom?: string            // "10:00"
  timeTo?: string
  leaveType?: LeaveType
  adminMessage?: string        // appended at end of message
  employeeName: { ja: string; en: string }
  inputLanguage: 'ja' | 'en'
}

type MessageOutput = {
  japanese: string             // always present
  english?: string             // only when inputLanguage === 'en'
}
```

**Output rules:**
- `inputLanguage = ja` → Japanese message only
- `inputLanguage = en` → English message first, then Japanese
- Multi-day absence: date range shown as `{start} ～ {end}` (JA) / `{start} – {end}` (EN)
- `adminMessage` appended at the bottom of both messages if present

**Subject line templates:**
| Type | Japanese | English |
|---|---|---|
| Late | `【遅刻連絡】{name_ja}　{date}` | `[Late Arrival Notice] {name_en} - {date}` |
| Early Departure | `【早退連絡】{name_ja}　{date}` | `[Early Departure Notice] {name_en} - {date}` |
| Absence | `【欠勤連絡】{name_ja}　{date}` | `[Absence Notice] {name_en} - {date}` |
| Other Request | `【その他連絡】{name_ja}　{date}` | `[Other Request] {name_en} - {date}` |

---

## 10. File Handling

- Files uploaded as part of `POST /api/requests` (multipart/form-data)
- Saved to `server/uploads/` with a UUID filename (never original name — prevents path traversal)
- Original filename stored in DB for display
- **60-day retention**: `node-cron` job runs daily at midnight, deletes files where `expires_at < NOW()` from disk and DB
- `GET /api/attachments/:id` validates `expires_at` before streaming — expired files not served even if cleanup hasn't run yet
- Files are **not** attached to emails

---

## 11. Email Service

```ts
interface EmailService {
  send(options: { to: string[]; subject: string; body: string }): Promise<void>
}
```

`NodemailerService` implements this interface. To switch providers (SendGrid, Resend, etc.), implement the same interface — no changes to calling code.

**Triggers:**
- Request submitted → email to all assigned managers (body = generated message)
- Request rejected → email to applicant (body = rejection notice)
- Request approved → no email

---

## 12. Initial Data Setup

- Seed script creates one dummy admin user at setup
- Real employee/admin data loaded via CSV import (future feature)
- User-to-manager assignments set via `employee_managers` table (future: CSV import)

---

## 13. Open / Deferred

| Item | Status |
|---|---|
| Working hours (`work_start` / `work_end`) | TBD — separate discussion; time picker currently shows full day in 5-min increments |
| CSV import for employees + manager assignments | Deferred |
| Password reset via email OTP | Deferred |
| Email service swap (SendGrid / Resend) | Deferred — interface ready |
