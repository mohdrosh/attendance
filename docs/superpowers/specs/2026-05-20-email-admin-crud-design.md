# Design: Email Notifications & Admin Employee CRUD

**Date:** 2026-05-20  
**Status:** Approved  

---

## Scope

Two independent feature areas built together:

- **A. Email notifications** — bilingual approval/rejection emails with optional send, admin rejection reason, manager single-select on submission, richer success screens
- **B. Admin employee CRUD** — staged API to create employees, assign managers, and manage train lines

**Out of scope (future):** Excel-based bulk employee import.

---

## Section 1 — Shared Package: Bilingual Notification Messages

### Location
`shared/src/messageGenerator.ts` — two new exported functions alongside the existing `generateMessage`.

### New types (`shared/src/types.ts`)

```ts
export interface NotificationInput {
  requestType: RequestType;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  employeeName: { ja: string; en: string };
}

export interface RejectionNotificationInput extends NotificationInput {
  rejectionReason?: string;
}
```

### New functions

**`generateApprovalNotification(input: NotificationInput): MessageOutput`**  
Returns `{ japanese, english }`. Tells the employee their request was approved, echoing key request details (type, date, time range) in both languages.

**`generateRejectionNotification(input: RejectionNotificationInput): MessageOutput`**  
Same structure as approval. If `rejectionReason` is provided, it is included in both the JP and EN bodies. If absent, the email states the request was not approved with no reason given.

### Email body format

```
[日本語]
あなたの申請が承認されました。（or 否認されました）
申請種別: 遅刻
申請日: 2026-05-20
時間: 09:00 〜 10:00
理由（否認のみ）: {rejectionReason}

[English]
Your attendance request has been approved. (or not approved.)
Type: Late Arrival
Date: 2026-05-20
Time: 09:00 – 10:00
Reason (rejection only): {rejectionReason}
```

### Exports
Both functions exported from `shared/src/index.ts` alongside `generateMessage`.

### Tests
New test cases added to `shared/` vitest suite covering: approval with/without fields, rejection with reason, rejection without reason.

---

## Section 2 — Backend: Email Route Changes

### `PATCH /api/admin/requests/:id/status`

**Updated request body:**
```ts
{
  status: 'approved' | 'rejected';
  rejectionReason?: string;     // included in rejection email if sendNotification is true
  sendNotification?: boolean;   // default false — opt-in to send email to employee
}
```

**Behaviour:**
- Always updates the request status in the DB (unchanged).
- If `sendNotification !== true`: no email sent, response is `{ ok: true }`.
- If `sendNotification === true` and `status === 'approved'`: calls `generateApprovalNotification()`, sends bilingual email to employee.
- If `sendNotification === true` and `status === 'rejected'`: calls `generateRejectionNotification()` with `rejectionReason`, sends bilingual email to employee.

**Email subjects:**
- Approval: `【承認】{name_ja} {start_date}`
- Rejection: `【否認】{name_ja} {start_date}`

**DB query change (`server/src/db/queries/admin.ts`):**  
`updateRequestStatus` result row gains `name_ja`, `name_en`, `email` via a JOIN on `users` — avoids a second round-trip when building the notification.

### `POST /api/requests` (request submission)

**Updated request body:** gains `managerId: string` (required).  
The route already fetches all managers via `getManagersByEmployeeId()`. It now filters to the single selected manager and sends the email only to that manager's address.

The submission email format and bilingual content are unchanged.

---

## Section 3 — Backend: Admin Employee CRUD

### Router
New file `server/src/routes/employees.ts`, mounted at `/api/admin/employees` in `app.ts`. All routes require auth + admin role.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/employees` | Create a new employee |
| `GET` | `/api/admin/employees` | List all employees |
| `GET` | `/api/admin/employees/:id` | Get one employee (with train lines + managers) |
| `PATCH` | `/api/admin/employees/:id` | Update employee fields |
| `POST` | `/api/admin/employees/:id/managers` | Assign a manager |
| `DELETE` | `/api/admin/employees/:id/managers/:managerId` | Remove a manager |
| `POST` | `/api/admin/employees/:id/train-lines` | Add a train line |
| `DELETE` | `/api/admin/employees/:id/train-lines/:lineId` | Remove a train line |

### `POST /api/admin/employees` body
```ts
{
  employee_number: string;        // unique, required
  name_ja: string;                // required
  name_en: string;                // required
  email: string;                  // unique, required
  password: string;               // required — validated + bcrypt-hashed before insert
  role: 'applicant' | 'admin';   // required
}
```

**Password validation** (same rules as seeded accounts): min 8 chars, at least one uppercase letter, one digit, one special character. Validated in the route handler before hashing.

### `PATCH /api/admin/employees/:id` body
All fields optional — only provided fields are updated:
```ts
{
  name_ja?: string;
  name_en?: string;
  email?: string;
  role?: 'applicant' | 'admin';
  work_start?: string;   // "HH:MM"
  work_end?: string;     // "HH:MM"
}
```

### `POST /api/admin/employees/:id/managers` body
```ts
{ managerId: string }
```

### `POST /api/admin/employees/:id/train-lines` body
```ts
{ line_name_ja: string; line_name_en: string }
```

### Query file
`server/src/db/queries/employees.ts` — all DB logic. Functions:
- `createEmployee(data)` — inserts user, returns new employee id
- `listEmployees()` — returns id, employee_number, name_ja, name_en, email, role for all users
- `getEmployeeById(id)` — returns full profile with train lines and managers
- `updateEmployee(id, fields)` — partial update, builds SET clause dynamically
- `assignManager(employeeId, managerId)` — inserts into `employee_managers`, ignores duplicate
- `removeManager(employeeId, managerId)` — deletes from `employee_managers`
- `addTrainLine(employeeId, data)` — inserts into `train_lines`, returns new id
- `removeTrainLine(lineId)` — deletes from `train_lines`

### Error handling
- `POST /employees`: 409 if `employee_number` or `email` already exists
- `POST /employees/:id/managers`: 404 if manager id does not exist in users table
- `DELETE` endpoints: 404 if the target row does not exist

---

## Section 4 — Frontend: Confirmation Screens & Admin Dashboard

### A. Request submission — manager dropdown (`ConfirmPage.tsx`)

- On mount, fetches `GET /api/users/me/managers` and populates a single-select dropdown.
- Dropdown shows both names: `田中 太郎 / Taro Tanaka`.
- Manager selection is required — the Submit button is disabled until one is selected.
- Selected `managerId` is sent with the `POST /api/requests` body.

### B. Request submission — success screen (`ConfirmPage.tsx`)

After successful POST, the page replaces its content with:
```
✓ Request Submitted
Your attendance request has been sent to your manager, {selectedManagerName}.
[Back to Dashboard]
```
The Back to Dashboard button calls `navigate('/dashboard')`. No new route is added — it is an in-component `submitted` state toggle.

### C. Admin approve/reject — optional notification UI (`RequestDetailPanel.tsx`)

The approve/reject form gains:
- A checkbox: **"Send notification email to employee"** — unchecked by default.
- When **rejecting** and checkbox is checked: a textarea for `Rejection Reason` appears below the checkbox.
- When **approving** and checkbox is checked: no extra field needed.

The PATCH request body includes `sendNotification` and `rejectionReason` (if applicable).

### D. Admin approve/reject — result screen (`RequestDetailPanel.tsx`)

After a successful PATCH, the panel body is replaced with a result state:
```
✓ Request Approved     (green)
 or
✗ Request Rejected     (red)

[Close]
```
Close button dismisses the panel and triggers a re-fetch of the admin requests table so the status badge updates in place.

### E. Admin dashboard — Employee Name column (`AdminPage.tsx`)

The requests table gains an **Employee** column rendering `employee_name_ja` (line 1) and `employee_name_en` (line 2, smaller/muted). Both fields are already present in the `Request` type — only the table render needs updating. The column is added after the existing employee number column.

---

## Data Flow Summary

```
Employee (ConfirmPage)
  → selects manager from dropdown
  → POST /api/requests { ...fields, managerId }
  → server sends bilingual email to selected manager
  → ConfirmPage shows success screen with manager name

Admin (RequestDetailPanel)
  → toggles "Send notification email" checkbox
  → optionally fills rejection reason
  → PATCH /api/admin/requests/:id/status { status, sendNotification, rejectionReason }
  → server conditionally sends bilingual approval/rejection email to employee
  → panel shows result screen; table re-fetches
```

---

## Future (not in this spec)

- Excel-based bulk employee import (separate spec)
- Approval email preference per employee
- Pagination on admin table
