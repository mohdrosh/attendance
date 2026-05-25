# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the approval/rejection workflow and add per-admin read/unread tracking (Gmail-style) plus hard-delete to the admin dashboard.

**Architecture:** A new `request_read_status` junction table stores per-admin read state (row = read, no row = unread). Three new API endpoints handle read/unread/delete. The frontend drops all status-related UI, adds unread dot + bold font for unread rows, an "Unread only" toggle filter, and a delete-with-confirmation flow in the detail panel.

**Tech Stack:** PostgreSQL 18 (junction table, ON DELETE CASCADE), Express (three new REST endpoints), React 19 (inline CSS, useState/useEffect), react-i18next, shared TypeScript types.

---

## File Map

| File | Change |
|---|---|
| `server/src/db/migrations/006_read_status.sql` | **Create** — `request_read_status` junction table |
| `shared/src/types.ts` | **Modify** — add `is_read?: boolean` to `Request`; remove `RejectionNotificationInput` |
| `shared/src/messageGenerator.ts` | **Modify** — remove `generateApprovalNotification` and `generateRejectionNotification` |
| `shared/src/index.ts` | **Check** — verify nothing needs updating after removals |
| `server/src/db/queries/admin.ts` | **Modify** — update `getAllRequests` (add `adminId`, LEFT JOIN, `is_read`); add `markRequestRead`, `markRequestUnread`, `deleteRequest`; remove `updateRequestStatus` |
| `server/src/routes/admin.ts` | **Modify** — update GET; add `POST /:id/read`, `POST /:id/unread`, `DELETE /:id`; remove `PATCH /:id/status` |
| `server/src/routes/admin.test.ts` | **Modify** — remove PATCH tests (7 tests); add read/unread/delete/is_read tests |
| `client/src/locales/en.json` | **Modify** — remove approval keys + top-level `status` section; add 4 new `detail_panel` keys + 1 `admin` key |
| `client/src/locales/ja.json` | **Modify** — same |
| `client/src/pages/DashboardPage.tsx` | **Modify** — remove status column, filter, sort option; keep Total stat card only |
| `client/src/pages/AdminPage.tsx` | **Modify** — major redesign: remove status, add unread dot/bold, add unread filter toggle, wire read/unread/delete callbacks |
| `client/src/components/RequestDetailPanel.tsx` | **Modify** — major redesign: remove approve/reject; add auto-read-on-open, mark-unread toggle, delete-with-confirmation |

---

## Task 0: Create Archive Branch

**Files:** git only

- [ ] **Step 1: Create and push the archive branch**

```bash
git checkout -b archive/with-approval-system
git push origin archive/with-approval-system
git checkout main
```

Expected: branch created and pushed. `git branch` shows you are back on `main`.

- [ ] **Step 2: Verify**

```bash
git branch -a | grep archive
```

Expected: `remotes/origin/archive/with-approval-system` appears.

---

## Task 1: DB Migration 006

**Files:**
- Create: `server/src/db/migrations/006_read_status.sql`

- [ ] **Step 1: Create the migration file**

```sql
CREATE TABLE request_read_status (
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  admin_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, admin_id)
);

CREATE INDEX idx_read_status_admin_id ON request_read_status(admin_id);
```

- [ ] **Step 2: Run migration on the dev database**

```bash
cd server && npm run migrate
```

Expected output: `Running migration: 006_read_status.sql` → `Migrations complete.`

- [ ] **Step 3: Run migration on the test database**

```bash
cd server && NODE_ENV=test npm run migrate
```

Expected output: same as above.

- [ ] **Step 4: Verify the table exists in dev DB**

```bash
PATH="/Applications/Postgres.app/Contents/Versions/18/bin:$PATH" psql attendance_dev -c "\dt request_read_status"
```

Expected: table `request_read_status` listed.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/006_read_status.sql
git commit -m "feat: add request_read_status migration for per-admin read tracking"
```

---

## Task 2: Shared Types Update

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Add `is_read` to `Request` and remove `RejectionNotificationInput`**

In `shared/src/types.ts`, make these two changes:

**Change 1** — add `is_read?: boolean` to the `Request` interface (after `attachment`):

```ts
export interface Request {
  id: string;
  employee_id: string;
  employee_name_ja: string;
  employee_name_en: string;
  employee_number: string;
  request_type: RequestType;
  start_date: string;
  end_date: string | null;
  time_from: string | null;
  time_to: string | null;
  reason_category: ReasonCategory | null;
  reason_detail: string | null;
  train_line_id: string | null;
  train_line_name_ja: string | null;
  train_line_name_en: string | null;
  leave_type: LeaveType | null;
  admin_message: string | null;
  input_language: InputLanguage;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  attachment: Attachment | null;
  is_read?: boolean;
}
```

**Change 2** — delete the entire `RejectionNotificationInput` interface (lines 100-102 in current file):

```ts
// DELETE this block entirely:
export interface RejectionNotificationInput extends NotificationInput {
  rejectionReason?: string;
}
```

- [ ] **Step 2: Rebuild the shared package**

```bash
cd shared && npm run build
```

Expected: no TypeScript errors. `dist/` updated.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: add is_read to Request type; remove RejectionNotificationInput"
```

---

## Task 3: Shared MessageGenerator Cleanup

**Files:**
- Modify: `shared/src/messageGenerator.ts`

- [ ] **Step 1: Remove `generateApprovalNotification` and `generateRejectionNotification`**

In `shared/src/messageGenerator.ts`:

1. Remove the `RejectionNotificationInput` import from the import line (it was just removed from types.ts). Update line 1:

```ts
import { MessageInput, MessageOutput, NotificationInput } from './types';
```

2. Delete the entire `generateApprovalNotification` function (lines 199–237 in current file).

3. Delete the entire `generateRejectionNotification` function (lines 239–281 in current file).

4. Delete the `requestTypeJa` and `requestTypeEn` maps (lines 179–197) — they are only used by the two deleted functions.

The file after editing should end with the closing brace of `generateMessage` (line 177 in current file).

- [ ] **Step 2: Rebuild shared and run shared tests**

```bash
cd shared && npm run build && npm test
```

Expected: build succeeds; all shared tests pass (messageGenerator tests for `generateMessage` only).

- [ ] **Step 3: Commit**

```bash
git add shared/src/messageGenerator.ts
git commit -m "feat: remove approval/rejection notification generators from shared"
```

---

## Task 4: Backend — Remove Approval Code

**Files:**
- Modify: `server/src/db/queries/admin.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/admin.test.ts`

- [ ] **Step 1: Remove `updateRequestStatus` from queries**

In `server/src/db/queries/admin.ts`, delete the entire `updateRequestStatus` function (lines 60–86 in current file).

Also remove `RequestStatus` from the import if it's now unused (it is still used in `AdminRequestFilters`, so keep it).

- [ ] **Step 2: Remove PATCH route from admin routes**

In `server/src/routes/admin.ts`, delete:
- The `adminRouter.patch('/requests/:id/status', ...)` handler (lines 27–63).
- The unused imports: `updateRequestStatus` from queries, `emailService`, `AppError`, `generateApprovalNotification`, `generateRejectionNotification`.

After editing, `server/src/routes/admin.ts` should be:

```ts
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests } from '../db/queries/admin';
import type { RequestType, RequestStatus } from '@attendance/shared';

export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin'));

adminRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, type, from, to, status } = req.query;
    const requests = await getAllRequests({
      name: name as string | undefined,
      type: type as RequestType | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      status: status as RequestStatus | undefined,
    });
    res.json(requests);
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Remove the PATCH tests from admin.test.ts**

In `server/src/routes/admin.test.ts`, delete the entire `describe('PATCH /api/admin/requests/:id/status', ...)` block (lines 70–149 in current file).

Keep the `GET /api/admin/requests` describe block and the `beforeEach`/`afterAll` setup.

Also remove the `emailService` mock at the top (lines 7–9) — it's no longer needed after removing PATCH tests.

After editing, `server/src/routes/admin.test.ts` should be:

```ts
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let employeeToken: string;
let requestId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
    [hash]
  );
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant')`,
    [hash]
  );

  const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
  adminToken = adminLogin.body.accessToken;

  const empLogin = await request(app).post('/api/auth/login').send({ employee_number: 'EMP-001', password: 'Test1234!' });
  employeeToken = empLogin.body.accessToken;

  const reqRes = await request(app)
    .post('/api/requests')
    .set('Authorization', `Bearer ${employeeToken}`)
    .field('requestType', 'late')
    .field('startDate', '2024-01-15')
    .field('reasonCategory', 'weather_transport')
    .field('inputLanguage', 'ja');
  requestId = reqRes.body.id;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/admin/requests', () => {
  it('returns all requests for admin', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filters by request type', async () => {
    const res = await request(app)
      .get('/api/admin/requests?type=absence')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```

Expected: 3 tests pass, 0 fail. The PATCH tests are gone.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/queries/admin.ts server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat: remove approval/rejection workflow from backend"
```

---

## Task 5: Backend — Add Read/Unread/Delete (TDD)

**Files:**
- Modify: `server/src/routes/admin.test.ts`
- Modify: `server/src/db/queries/admin.ts`
- Modify: `server/src/routes/admin.ts`

### Step 1 — Write Failing Tests

- [ ] **Step 1: Add failing tests to admin.test.ts**

Append the following describe blocks to `server/src/routes/admin.test.ts` (after the existing GET describe block):

```ts
describe('GET /api/admin/requests — is_read field', () => {
  it('includes is_read boolean in each request (false by default)', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body[0].is_read).toBe('boolean');
    expect(res.body[0].is_read).toBe(false);
  });
});

describe('POST /api/admin/requests/:id/read', () => {
  it('marks request as read and reflects in GET', async () => {
    const readRes = await request(app)
      .post(`/api/admin/requests/${requestId}/read`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].is_read).toBe(true);
  });

  it('is idempotent — calling twice does not error', async () => {
    await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .post(`/api/admin/requests/${requestId}/read`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/requests/:id/unread', () => {
  it('marks request as unread after being read', async () => {
    await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);

    const unreadRes = await request(app)
      .post(`/api/admin/requests/${requestId}/unread`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].is_read).toBe(false);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .post(`/api/admin/requests/${requestId}/unread`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/requests/:id', () => {
  it('deletes the request and removes it from GET', async () => {
    const delRes = await request(app)
      .delete(`/api/admin/requests/${requestId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('returns 404 for non-existent request', async () => {
    const res = await request(app)
      .delete('/api/admin/requests/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .delete(`/api/admin/requests/${requestId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to see failures**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```

Expected: original 3 tests pass; new 9 tests FAIL (routes don't exist yet, `is_read` field absent).

### Step 2 — Implement

- [ ] **Step 3: Update `getAllRequests` in `server/src/db/queries/admin.ts`**

Add `adminId: string` parameter and LEFT JOIN for `is_read`:

```ts
import { pool } from '../pool';
import { Request as AttendanceRequest, RequestStatus, RequestType } from '@attendance/shared';

export interface AdminRequestFilters {
  name?: string;
  type?: RequestType;
  from?: string;
  to?: string;
  status?: RequestStatus;
}

export async function getAllRequests(filters: AdminRequestFilters, adminId: string): Promise<AttendanceRequest[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.name) {
    conditions.push(`(u.name_ja ILIKE $${i} OR u.name_en ILIKE $${i} OR u.employee_number ILIKE $${i})`);
    params.push(`%${filters.name}%`);
    i++;
  }
  if (filters.type) {
    conditions.push(`r.request_type = $${i++}`);
    params.push(filters.type);
  }
  if (filters.from) {
    conditions.push(`r.start_date >= $${i++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`r.start_date <= $${i++}`);
    params.push(filters.to);
  }
  if (filters.status) {
    conditions.push(`r.status = $${i++}`);
    params.push(filters.status);
  }

  params.push(adminId);
  const adminIdx = params.length;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT r.*,
            u.name_ja AS employee_name_ja, u.name_en AS employee_name_en, u.employee_number,
            t.line_name_ja AS train_line_name_ja, t.line_name_en AS train_line_name_en,
            CASE WHEN a.id IS NOT NULL THEN json_build_object(
              'id', a.id, 'original_filename', a.original_filename,
              'file_size', a.file_size, 'uploaded_at', a.uploaded_at, 'expires_at', a.expires_at
            ) END AS attachment,
            (rrs.admin_id IS NOT NULL) AS is_read
     FROM requests r
     JOIN users u ON u.id = r.employee_id
     LEFT JOIN train_lines t ON t.id = r.train_line_id
     LEFT JOIN attachments a ON a.request_id = r.id
     LEFT JOIN request_read_status rrs ON rrs.request_id = r.id AND rrs.admin_id = $${adminIdx}
     ${where}
     ORDER BY r.submitted_at DESC`,
    params
  );
  return rows;
}

export async function markRequestRead(requestId: string, adminId: string): Promise<void> {
  await pool.query(
    `INSERT INTO request_read_status (request_id, admin_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [requestId, adminId]
  );
}

export async function markRequestUnread(requestId: string, adminId: string): Promise<void> {
  await pool.query(
    `DELETE FROM request_read_status
     WHERE request_id = $1 AND admin_id = $2`,
    [requestId, adminId]
  );
}

export async function deleteRequest(requestId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM requests WHERE id = $1`,
    [requestId]
  );
  return (rowCount ?? 0) > 0;
}
```

- [ ] **Step 4: Update `server/src/routes/admin.ts`**

Replace the entire file with:

```ts
import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, markRequestRead, markRequestUnread, deleteRequest } from '../db/queries/admin';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { RequestType, RequestStatus } from '@attendance/shared';

export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin'));

adminRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, type, from, to, status } = req.query;
    const requests = await getAllRequests(
      {
        name: name as string | undefined,
        type: type as RequestType | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
        status: status as RequestStatus | undefined,
      },
      req.user!.id
    );
    res.json(requests);
  } catch (err) { next(err); }
});

adminRouter.post('/requests/:id/read', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM requests WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new AppError(404, 'Request not found');
    await markRequestRead(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.post('/requests/:id/unread', async (req: AuthRequest, res: Response, next) => {
  try {
    await markRequestUnread(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.delete('/requests/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.storage_path FROM attachments a
       JOIN requests r ON a.request_id = r.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    const deleted = await deleteRequest(req.params.id);
    if (!deleted) throw new AppError(404, 'Request not found');

    if (rows[0]?.storage_path) {
      const filePath = path.resolve(rows[0].storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 5: Run tests — all should pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```

Expected: 12 tests pass, 0 fail.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd server && NODE_ENV=test npm test
```

Expected: all tests pass (70+).

- [ ] **Step 7: Commit**

```bash
git add server/src/db/queries/admin.ts server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat: add read/unread/delete endpoints; include is_read in admin requests response"
```

---

## Task 6: Translations

**Files:**
- Modify: `client/src/locales/en.json`
- Modify: `client/src/locales/ja.json`

- [ ] **Step 1: Update `client/src/locales/en.json`**

**Remove** from `detail_panel`:
- `"approve"`, `"reject"`, `"send_notification"`, `"rejection_reason"`, `"rejection_reason_placeholder"`, `"approved_title"`, `"rejected_title"`

**Add** to `detail_panel`:
```json
"mark_unread":    "Mark as Unread",
"mark_read":      "Mark as Read",
"delete":         "Delete",
"confirm_delete": "Are you sure? This cannot be undone."
```

**Remove** the entire top-level `"status"` section:
```json
"status": {
  "pending": "Pending",
  "approved": "Approved",
  "rejected": "Rejected"
}
```

**Add** to `"admin"`:
```json
"filter_unread": "Unread only"
```

The updated `detail_panel` section in `en.json`:
```json
"detail_panel": {
  "title": "Request Detail",
  "attachment": "Attachment",
  "download": "Download",
  "admin_message": "Message from employee",
  "close": "Close",
  "mark_unread": "Mark as Unread",
  "mark_read": "Mark as Read",
  "delete": "Delete",
  "confirm_delete": "Are you sure? This cannot be undone."
}
```

The updated `admin` section (add `filter_unread`, keep existing keys):
```json
"admin": {
  "title": "Admin Dashboard",
  "filter_name": "Search by name or employee no.",
  "filter_type": "Request Type",
  "filter_from": "From Date",
  "filter_to": "To Date",
  "filter_status": "Status",
  "sort_newest": "Newest first",
  "sort_oldest": "Oldest first",
  "sort_name": "By name",
  "sort_status": "By status",
  "all": "All",
  "filter_unread": "Unread only",
  "stats": {
    "total": "Total",
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "columns": {
    "name": "Name",
    "employee_number": "Emp. No.",
    "date": "Date",
    "time_from": "From",
    "time_to": "To",
    "type": "Type",
    "reason": "Reason",
    "leave_type": "Leave Type",
    "submitted": "Submitted",
    "status": "Status"
  }
}
```

- [ ] **Step 2: Update `client/src/locales/ja.json`**

**Remove** from `detail_panel`:
- `"approve"`, `"reject"`, `"send_notification"`, `"rejection_reason"`, `"rejection_reason_placeholder"`, `"approved_title"`, `"rejected_title"`

**Add** to `detail_panel`:
```json
"mark_unread":    "未読に戻す",
"mark_read":      "既読にする",
"delete":         "削除",
"confirm_delete": "本当に削除しますか？この操作は元に戻せません。"
```

**Remove** the entire top-level `"status"` section.

**Add** to `"admin"`:
```json
"filter_unread": "未読のみ"
```

The updated `detail_panel` section in `ja.json`:
```json
"detail_panel": {
  "title": "申請詳細",
  "attachment": "添付ファイル",
  "download": "ダウンロード",
  "admin_message": "管理者へのメッセージ",
  "close": "閉じる",
  "mark_unread": "未読に戻す",
  "mark_read": "既読にする",
  "delete": "削除",
  "confirm_delete": "本当に削除しますか？この操作は元に戻せません。"
}
```

- [ ] **Step 3: Verify JSON validity**

```bash
node -e "require('./client/src/locales/en.json'); console.log('en.json OK')"
node -e "require('./client/src/locales/ja.json'); console.log('ja.json OK')"
```

Expected: both print OK.

- [ ] **Step 4: Commit**

```bash
git add client/src/locales/en.json client/src/locales/ja.json
git commit -m "feat: update translations — remove approval keys, add read/unread/delete keys"
```

---

## Task 7: DashboardPage — Remove Status Features

**Files:**
- Modify: `client/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update imports**

Change the import line from:
```ts
import type { RequestStatus, RequestType } from '@attendance/shared';
```
To:
```ts
import type { RequestType } from '@attendance/shared';
```

- [ ] **Step 2: Remove `STATUS_STYLES` and `STAT_META`, replace with single Total card**

Delete the `STATUS_STYLES` constant (lines 9–13).
Delete the `STAT_META` array (lines 15–20).
Change `SortKey` type from `'newest' | 'oldest' | 'status'` to `'newest' | 'oldest'`.

- [ ] **Step 3: Remove `filterStatus` state and related code**

Remove:
```ts
const [filterStatus, setFilterStatus] = useState<RequestStatus | ''>('');
```

Remove the `stats.pending`, `stats.approved`, `stats.rejected` calculations (keep only `total`):
```ts
const stats = useMemo(() => ({
  total: requests.length,
}), [requests]);
```

- [ ] **Step 4: Update `filtered` useMemo — remove status filter and sort**

```ts
const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  return requests
    .filter(r => {
      if (filterType && r.request_type !== filterType) return false;
      if (q && !r.start_date.includes(q) &&
          !t(`request_type.${r.request_type}`).toLowerCase().includes(q) &&
          !t(`form.reasons.${r.reason_category}`).toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });
}, [requests, search, filterType, sortBy, t]);
```

- [ ] **Step 5: Update the JSX**

**Stat cards section** — replace the `STAT_META.map(...)` block with a single Total card:

```tsx
{/* Stat cards */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px', marginBottom: '22px' }}>
  <div style={{
    background: 'white', borderRadius: '10px', padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
  }}>
    <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
      {t('dashboard.stats.total')}
    </div>
    <div style={{ fontSize: '1.7em', fontWeight: 700, color: '#1d4ed8' }}>{stats.total}</div>
  </div>
</div>
```

**Search + filters row** — remove the status filter `<select>` and sort "by status" `<option>`, and remove `filterStatus` from the Clear button condition/handler:

```tsx
{/* Search + filters */}
<div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
  <input
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder={t('dashboard.search_placeholder')}
    style={{ flex: '1 1 180px', padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em', minWidth: '140px' }}
  />
  <select value={filterType} onChange={e => setFilterType(e.target.value as RequestType | '')} style={selectStyle}>
    <option value="">{t('admin.all')} ({t('form.request_type')})</option>
    {(['late', 'early_departure', 'absence', 'chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'] as RequestType[]).map(type => (
      <option key={type} value={type}>{t(`request_type.${type}`)}</option>
    ))}
  </select>
  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={selectStyle}>
    <option value="newest">{t('dashboard.sort_newest')}</option>
    <option value="oldest">{t('dashboard.sort_oldest')}</option>
  </select>
  {(search || filterType) && (
    <button
      onClick={() => { setSearch(''); setFilterType(''); }}
      style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82em', color: '#6b7280' }}
    >
      ✕ Clear
    </button>
  )}
</div>
```

**Table header** — remove `'status'` from the columns array:
```tsx
{['date', 'time_from', 'time_to', 'type', 'reason', 'submitted'].map(col => (
  <th key={col} ...>{t(`dashboard.columns.${col}`)}</th>
))}
```

**Table rows** — remove the status `<td>` cell (the last `<td>` in each row that renders the status badge).

- [ ] **Step 6: Build client to verify no TypeScript errors**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/DashboardPage.tsx
git commit -m "feat: remove status column, filter, and sort from employee dashboard"
```

---

## Task 8: AdminPage — Redesign

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`

- [ ] **Step 1: Update imports and remove status-related constants**

Change the import:
```ts
import type { Request as AttendanceRequest, RequestType } from '@attendance/shared';
```
(Remove `RequestStatus` import.)

Delete `STATUS_STYLES` (lines 9–13).
Delete `STAT_META` (lines 15–20).
Change `SortKey` to `'newest' | 'oldest' | 'name'` (remove `'status'`).

- [ ] **Step 2: Update state declarations**

Remove:
```ts
const [filterStatus, setFilterStatus] = useState<RequestStatus | ''>('');
```

Add:
```ts
const [filterUnread, setFilterUnread] = useState(false);
```

- [ ] **Step 3: Update `fetchRequests`**

Remove `filterStatus` from params and dependency array:

```ts
const fetchRequests = useCallback(async () => {
  const params = new URLSearchParams();
  if (filterType) params.set('type', filterType);
  if (filterFrom) params.set('from', filterFrom);
  if (filterTo)   params.set('to',   filterTo);
  const res = await apiFetch(`/api/admin/requests?${params}`);
  if (res.ok) setRequests(await res.json());
}, [filterType, filterFrom, filterTo]);
```

- [ ] **Step 4: Replace `handleStatusChange` with `handleRead`, `handleUnread`, `handleDelete`**

Remove `handleStatusChange`. Add:

```ts
function handleRead(id: string) {
  setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
}

function handleUnread(id: string) {
  setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: false } : r));
}

function handleDelete(id: string) {
  setRequests(prev => prev.filter(r => r.id !== id));
  setSelected(null);
}
```

- [ ] **Step 5: Update `stats` useMemo — Total only**

```ts
const stats = useMemo(() => ({
  total: requests.length,
}), [requests]);
```

- [ ] **Step 6: Update `displayed` useMemo**

```ts
const displayed = useMemo(() => {
  const q = search.trim().toLowerCase();
  return [...requests]
    .filter(r => {
      if (filterUnread && r.is_read) return false;
      if (!q) return true;
      return (
        r.employee_name_ja.toLowerCase().includes(q) ||
        r.employee_name_en.toLowerCase().includes(q) ||
        r.employee_number.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      if (sortBy === 'name') return a.employee_name_en.localeCompare(b.employee_name_en);
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });
}, [requests, search, sortBy, filterUnread]);
```

- [ ] **Step 7: Update `hasFilters` and `clearFilters`**

```ts
const hasFilters = filterType || filterFrom || filterTo;

function clearFilters() {
  setFilterType(''); setFilterFrom(''); setFilterTo('');
}
```

- [ ] **Step 8: Update `handleClose`**

```ts
function handleClose() {
  setSelected(null);
}
```

(No fetchRequests — state is managed locally via callbacks.)

- [ ] **Step 9: Update JSX — Stat cards (Total only)**

Replace the 4-card grid with a single Total card:

```tsx
{/* Stat cards */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px', marginBottom: '22px', maxWidth: '220px' }}>
  <div style={{
    background: 'white', borderRadius: '10px', padding: '14px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
  }}>
    <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
      {t('admin.stats.total')}
    </div>
    <div style={{ fontSize: '1.7em', fontWeight: 700, color: '#1d4ed8' }}>{stats.total}</div>
  </div>
</div>
```

- [ ] **Step 10: Update JSX — Search + sort row**

Remove `"status"` from sort options:

```tsx
<select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={selectStyle}>
  <option value="newest">{t('admin.sort_newest')}</option>
  <option value="oldest">{t('admin.sort_oldest')}</option>
  <option value="name">{t('admin.sort_name')}</option>
</select>
```

- [ ] **Step 11: Update JSX — Filter row**

Remove the status filter `<select>` and add the "Unread only" toggle button:

```tsx
{/* Filter row */}
<div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
  <span style={{ fontSize: '0.78em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>Filter</span>
  <select value={filterType} onChange={e => setFilterType(e.target.value as RequestType | '')} style={selectStyle}>
    <option value="">{t('admin.all')} ({t('form.request_type')})</option>
    {(['late', 'early_departure', 'absence', 'chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'] as RequestType[]).map(type => (
      <option key={type} value={type}>{t(`request_type.${type}`)}</option>
    ))}
  </select>
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em', color: '#6b7280' }}>
    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...selectStyle, color: filterFrom ? '#111' : '#9ca3af' }} />
    <span>→</span>
    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...selectStyle, color: filterTo ? '#111' : '#9ca3af' }} />
  </div>
  <button
    onClick={() => setFilterUnread(prev => !prev)}
    style={{
      padding: '7px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.82em', fontWeight: 600,
      background: filterUnread ? '#3b82f6' : 'transparent',
      color: filterUnread ? 'white' : '#6b7280',
      border: filterUnread ? '1px solid #3b82f6' : '1px solid #d1d5db',
      transition: 'all 0.15s',
    }}
  >
    {t('admin.filter_unread')}
  </button>
  {hasFilters && (
    <button onClick={clearFilters} style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82em', color: '#6b7280' }}>
      ✕ Clear filters
    </button>
  )}
</div>
```

- [ ] **Step 12: Update JSX — Table header**

Remove `'status'` from the columns array:

```tsx
{['name', 'employee_number', 'date', 'time_from', 'time_to', 'type', 'reason', 'submitted'].map(col => (
  <th key={col} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    {t(`admin.columns.${col}`)}
  </th>
))}
```

- [ ] **Step 13: Update JSX — Table rows (unread dot + bold)**

Replace the existing `<tr>` / `<td>` block with:

```tsx
{displayed.map((r, i) => {
  const isUnread = !r.is_read;
  return (
    <tr
      key={r.id}
      onClick={() => setSelected(r)}
      style={{ borderBottom: i < displayed.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <td style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.9em', fontWeight: isUnread ? 700 : 500, color: '#111' }}>{r.employee_name_ja}</div>
        <div style={{ fontSize: '0.78em', color: '#9ca3af', fontWeight: isUnread ? 700 : 400 }}>{r.employee_name_en}</div>
      </td>
      <td style={{ padding: '12px 14px', fontSize: '0.82em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isUnread && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
          )}
          {r.employee_number}
        </div>
      </td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', fontWeight: isUnread ? 700 : 400 }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#374151', fontWeight: isUnread ? 700 : 400 }}>{r.time_from ? r.time_from.slice(0, 5) : '—'}</td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#374151', fontWeight: isUnread ? 700 : 400 }}>{r.time_to ? r.time_to.slice(0, 5) : '—'}</td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', fontWeight: isUnread ? 700 : 400 }}>{t(`request_type.${r.request_type}`)}</td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>{r.reason_category ? t(`form.reasons.${r.reason_category}`) : '—'}</td>
      <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
    </tr>
  );
})}
```

- [ ] **Step 14: Update `RequestDetailPanel` usage**

Replace:
```tsx
<RequestDetailPanel
  request={selected}
  onClose={handleClose}
  onStatusChange={handleStatusChange}
/>
```
With:
```tsx
<RequestDetailPanel
  request={selected}
  onClose={handleClose}
  onRead={handleRead}
  onUnread={handleUnread}
  onDelete={handleDelete}
/>
```

- [ ] **Step 15: Build to verify no TypeScript errors**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 16: Commit**

```bash
git add client/src/pages/AdminPage.tsx
git commit -m "feat: redesign admin dashboard — remove status, add unread indicators and filter toggle"
```

---

## Task 9: RequestDetailPanel — Redesign

**Files:**
- Modify: `client/src/components/RequestDetailPanel.tsx`

- [ ] **Step 1: Rewrite `client/src/components/RequestDetailPanel.tsx`**

Replace the entire file with:

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Request as AttendanceRequest } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onRead: (id: string) => void;
  onUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RequestDetailPanel({ request, onClose, onRead, onUnread, onDelete }: Props) {
  const { t } = useTranslation();
  const [isRead, setIsRead] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!request) return;
    setIsRead(request.is_read ?? false);
    setShowDeleteConfirm(false);

    apiFetch(`/api/admin/requests/${request.id}/read`, { method: 'POST' })
      .then(() => {
        setIsRead(true);
        onRead(request.id);
      })
      .catch(() => {/* fire and forget */});
  }, [request?.id]);

  if (!request) return null;

  async function handleMarkUnread() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}/unread`, { method: 'POST' });
    setIsRead(false);
    onUnread(request.id);
  }

  async function handleMarkRead() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}/read`, { method: 'POST' });
    setIsRead(true);
    onRead(request.id);
  }

  async function handleDelete() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}`, { method: 'DELETE' });
    onDelete(request.id);
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh',
        background: 'white', boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ fontSize: '1.05em', fontWeight: 700, color: '#111' }}>{t('detail_panel.title')}</h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ flex: 1, padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label={t('admin.columns.name')}>
              <span style={{ fontWeight: 600 }}>{request.employee_name_ja}</span>
              <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '0.9em' }}>{request.employee_name_en}</span>
            </Field>
            <Field label={t('admin.columns.type')}>
              {t(`request_type.${request.request_type}`)}
            </Field>
            <Field label={t('admin.columns.date')}>
              {request.start_date}{request.end_date ? ` – ${request.end_date}` : ''}
            </Field>
            {request.reason_category && (
              <Field label={t('admin.columns.reason')}>
                {t(`form.reasons.${request.reason_category}`)}
              </Field>
            )}
            {request.reason_detail && (
              <Field label={t('form.reason_detail')}>
                <span style={{ color: '#374151' }}>{request.reason_detail}</span>
              </Field>
            )}
            {request.leave_type && (
              <Field label={t('admin.columns.leave_type')}>
                {t(`form.leave_types.${request.leave_type}`)}
              </Field>
            )}
            {request.admin_message && (
              <Field label={t('detail_panel.admin_message')}>
                <span style={{ color: '#374151' }}>{request.admin_message}</span>
              </Field>
            )}
          </div>

          {request.attachment && (
            <div style={{ marginTop: '20px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2em' }}>📎</span>
              <a
                href={`/api/attachments/${request.attachment.id}`}
                download={request.attachment.original_filename}
                style={{ color: '#1d4ed8', fontSize: '0.9em', textDecoration: 'none' }}
              >
                {request.attachment.original_filename}
              </a>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0' }}>
          {showDeleteConfirm ? (
            <div>
              <p style={{ fontSize: '0.88em', color: '#374151', marginBottom: '12px' }}>{t('detail_panel.confirm_delete')}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em', color: '#374151' }}
                >
                  {t('detail_panel.close')}
                </button>
                <button
                  onClick={handleDelete}
                  style={{ flex: 1, padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                >
                  {t('detail_panel.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={isRead ? handleMarkUnread : handleMarkRead}
                style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em', color: '#374151' }}
              >
                {isRead ? t('detail_panel.mark_unread') : t('detail_panel.mark_read')}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ flex: 1, padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em', color: '#dc2626' }}
              >
                {t('detail_panel.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '0.93em', color: '#111' }}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build client to verify no TypeScript errors**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all frontend tests**

```bash
cd client && npx vitest run
```

Expected: tests pass (LoginPage tests).

- [ ] **Step 4: Run full backend test suite to confirm no regressions**

```bash
cd server && NODE_ENV=test npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/RequestDetailPanel.tsx
git commit -m "feat: redesign RequestDetailPanel — remove approve/reject, add auto-read, mark-unread, delete"
```

---

## Task 10: Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as Admin and verify**

1. Open `http://localhost:5173` and log in with `ADMIN-001` / `Admin1234!`.
2. Navigate to Request Management — confirm: no status column, no status filter, no status cards (only Total).
3. Submit a request as employee (`EMP-001` / `Emp1234!`) in another browser tab or incognito.
4. Back in the admin tab, refresh — the new request should appear **bold with a blue dot** (unread).
5. Click the request — detail panel opens, auto-marks as read. Bold and dot disappear on the row.
6. Click "Mark as Unread" — row becomes bold + dot again.
7. Click the request again, then click "Delete" → confirm → request disappears from list.
8. Verify "Unread only" toggle hides read requests.

- [ ] **Step 3: Log in as Employee and verify**

1. Log in as `EMP-001`.
2. Navigate to Dashboard — confirm: no status column, no status filter, only Total stat card.

- [ ] **Step 4: Final commit (if any fixes were applied)**

```bash
git add -p
git commit -m "fix: smoke test corrections for admin dashboard redesign"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Archive branch | Task 0 |
| `request_read_status` migration | Task 1 |
| `is_read?: boolean` on `Request` | Task 2 |
| Remove `RejectionNotificationInput` | Task 2 |
| Remove `generateApprovalNotification` / `generateRejectionNotification` | Task 3 |
| `getAllRequests` — adminId + is_read | Task 5 |
| `markRequestRead`, `markRequestUnread`, `deleteRequest` queries | Task 5 |
| `POST /:id/read` route | Task 5 |
| `POST /:id/unread` route | Task 5 |
| `DELETE /:id` route | Task 5 |
| Remove `PATCH /:id/status` route + tests | Task 4 |
| Backend tests for new endpoints | Task 5 |
| Translations update | Task 6 |
| DashboardPage — status removed | Task 7 |
| AdminPage — status removed, unread dot + bold + filter toggle | Task 8 |
| RequestDetailPanel — auto-read, mark-unread, delete | Task 9 |

All spec requirements covered.
