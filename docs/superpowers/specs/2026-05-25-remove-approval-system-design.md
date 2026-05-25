# Design: Admin Dashboard Redesign — One-Way Submission + Read/Delete

**Date:** 2026-05-25
**Status:** Approved

---

## Overview

Two related changes to the admin dashboard:

1. **Remove the approval/rejection workflow.** Requests are now one-directional: employees submit → admins receive via email and the admin dashboard. No approve/reject actions.

2. **Add inbox-style read/unread tracking and hard-delete.** Each admin has their own per-request read state (like Gmail). Opening a request auto-marks it read. Admins can mark requests unread and hard-delete them.

The existing approval code is preserved in git branch `archive/with-approval-system`.

---

## 1. Branch Preservation

Before any code changes, create an archive branch from current HEAD:

```bash
git checkout -b archive/with-approval-system
git push origin archive/with-approval-system
git checkout main
```

The archive branch is DB-compatible with `main` — no schema columns are dropped, only new ones added.

---

## 2. Database

### 2a. No removals

The `requests` table retains `status` (always `'pending'` going forward), `reviewed_by`, and `reviewed_at`. These columns are inert but harmless, and keeping them means the archive branch remains DB-compatible.

### 2b. Migration `006_read_status.sql`

A junction table for per-admin read state. A row means **read**; absence means **unread**:

```sql
CREATE TABLE request_read_status (
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  admin_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, admin_id)
);

CREATE INDEX idx_read_status_admin_id ON request_read_status(admin_id);
```

Both FKs use `ON DELETE CASCADE` — read records are removed automatically when the request or admin is deleted.

---

## 3. Shared Types (`shared/src/types.ts`)

Add `is_read` as an optional field on `Request`:

```ts
export interface Request {
  // ... existing fields ...
  is_read?: boolean;   // present on admin responses only; undefined on employee responses
}
```

`RequestStatus` type is **kept unchanged** (`'pending' | 'approved' | 'rejected'`) — it is still used in the DB layer.

---

## 4. Backend

### 4a. `server/src/db/queries/admin.ts`

**Modify `getAllRequests`:**
- Add `adminId: string` parameter.
- LEFT JOIN `request_read_status rrs ON rrs.request_id = r.id AND rrs.admin_id = $<adminId>`.
- Return `(rrs.admin_id IS NOT NULL) AS is_read` in the SELECT.

**Add `markRequestRead(requestId: string, adminId: string): Promise<void>`**
```sql
INSERT INTO request_read_status (request_id, admin_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
```

**Add `markRequestUnread(requestId: string, adminId: string): Promise<void>`**
```sql
DELETE FROM request_read_status
WHERE request_id = $1 AND admin_id = $2
```

**Add `deleteRequest(requestId: string): Promise<boolean>`**
- Returns `true` if a row was deleted, `false` if not found.
- Cascade in DB handles `request_read_status` and `attachments` rows.
- The caller (route) is responsible for deleting the attachment file from disk before or after this call.

```sql
DELETE FROM requests WHERE id = $1
```

**Remove `updateRequestStatus`** — deleted entirely.

### 4b. `server/src/routes/admin.ts`

**Modify `GET /requests`:**
Pass `req.user!.id` as `adminId` to `getAllRequests`.

**Add `POST /requests/:id/read`:**
```
→ markRequestRead(id, adminId)
← 200 { ok: true }
Errors: 404 if request not found
```

**Add `POST /requests/:id/unread`:**
```
→ markRequestUnread(id, adminId)
← 200 { ok: true }
```

**Add `DELETE /requests/:id`:**
1. Fetch the request to get `attachment_id` (if any).
2. Delete the attachment file from disk (using the same path logic as `attachments.ts`).
3. Call `deleteRequest(id)`.
4. Return `200 { ok: true }` or `404` if not found.

**Remove `PATCH /requests/:id/status`** — deleted entirely, along with its imports (`updateRequestStatus`, `AppError` for status check, `generateApprovalNotification`, `generateRejectionNotification`).

### 4c. `server/src/routes/admin.test.ts`

**Remove:** The `PATCH /api/admin/requests/:id/status` describe block (7 tests).

**Add:**
- `POST /api/admin/requests/:id/read` — marks read, idempotent
- `POST /api/admin/requests/:id/unread` — marks unread
- `DELETE /api/admin/requests/:id` — deletes, 404 for missing
- `GET /api/admin/requests` — verify `is_read` boolean present in response

### 4d. `shared/src/messageGenerator.ts`

**Remove:**
- `generateApprovalNotification` function
- `generateRejectionNotification` function
- `RejectionNotificationInput` interface

`generateMessage` (submission notification) is **untouched**.

---

## 5. Frontend

### 5a. Employee Dashboard (`client/src/pages/DashboardPage.tsx`)

| What | Change |
|---|---|
| Stat cards | Remove Pending, Approved, Rejected. Keep **Total only**. |
| Table columns | Remove `status` column. Columns: Date, From, To, Type, Reason, Submitted. |
| Status filter | Remove entirely. |
| Sort options | Remove "sort by status". |
| `STATUS_STYLES`, `RequestStatus` import | Delete — unused. |

No read/delete features on the employee side.

### 5b. Admin Dashboard (`client/src/pages/AdminPage.tsx`)

**Stat cards:** Remove Pending, Approved, Rejected. Keep **Total only**.

**Table:**
- Remove `status` badge column.
- Unread rows: **bold font** on all text cells + an **8 px blue dot** (`background: #3b82f6; border-radius: 50%`) prepended to the first cell (`employee_number`). Read rows: normal weight, no dot.
- Row click opens the detail panel (unchanged).

**Filters:**
- Remove status filter dropdown.
- Remove "sort by status" option.
- Add **"Unread only" toggle button** in the filter row. When active: show only rows where `is_read === false`. Toggle style: active = filled blue pill; inactive = outlined grey.

**Callbacks wired to `RequestDetailPanel`:**
- `onRead(id: string)` — sets `is_read = true` in local list state.
- `onUnread(id: string)` — sets `is_read = false` in local list state.
- `onDelete(id: string)` — removes row from local list state, closes panel.

**Remove:**
- `handleStatusChange` callback.
- `STATUS_STYLES` constant.
- `RequestStatus` import.

### 5c. Admin Detail Panel (`client/src/components/RequestDetailPanel.tsx`)

**Props — remove:**
- `onStatusChange`

**Props — add:**
- `onRead: (id: string) => void`
- `onUnread: (id: string) => void`
- `onDelete: (id: string) => void`

**On mount (useEffect):**
Call `POST /api/admin/requests/:id/read` then `onRead(request.id)`. This auto-marks the request read the moment the panel opens. If the call fails, fail silently (fire-and-forget).

**New state:**
- `isRead: boolean` — initialised from `request.is_read`, toggled by mark/unread actions.
- `showDeleteConfirm: boolean` — controls inline delete confirmation.

**New UI — action buttons at panel bottom:**

```
[ Mark as Unread ]   [ Delete ]
```

- **"Mark as Unread"** — calls `POST /requests/:id/unread`, sets `isRead = false`, calls `onUnread(id)`. Button label toggles to "Mark as Read" when `isRead === false`, calling `POST /requests/:id/read` instead.
- **"Delete"** — toggles `showDeleteConfirm`. When confirming, shows an inline prompt:
  ```
  Are you sure? This cannot be undone.
  [ Cancel ]  [ Delete ]
  ```
  On confirm: calls `DELETE /api/admin/requests/:id`, then `onDelete(id)`, then `onClose()`.

**Remove entirely:**
- `onStatusChange` prop
- `loading` state
- `sendNotification` state
- `rejectionReason` state
- `result` state and result screen
- `handleAction` function
- Approve/Reject buttons, notification checkbox, rejection reason input
- The `request.status === 'pending'` condition block

**Keep:** All request field displays, attachment download, admin message display, close button.

### 5d. Translations (`client/src/locales/en.json` + `ja.json`)

**Remove from `detail_panel`:**
- `approve`, `reject`, `send_notification`, `rejection_reason`, `rejection_reason_placeholder`, `approved_title`, `rejected_title`

**Remove entire `status` section** (`pending`, `approved`, `rejected`) — status is not displayed anywhere in the UI.

**Add to `detail_panel`:**

```json
"mark_unread":      "Mark as Unread",
"mark_read":        "Mark as Read",
"delete":           "Delete",
"confirm_delete":   "Are you sure? This cannot be undone."
```

```json (ja)
"mark_unread":      "未読に戻す",
"mark_read":        "既読にする",
"delete":           "削除",
"confirm_delete":   "本当に削除しますか？この操作は元に戻せません。"
```

**Add to `admin`:**

```json
"filter_unread":    "Unread only"
```

```json (ja)
"filter_unread":    "未読のみ"
```

---

## 6. Files Changed / Created Summary

| File | Change |
|---|---|
| `server/src/db/migrations/006_read_status.sql` | Create — `request_read_status` table |
| `server/src/db/queries/admin.ts` | Add `markRequestRead`, `markRequestUnread`, `deleteRequest`; update `getAllRequests` with `adminId` + `is_read`; remove `updateRequestStatus` |
| `server/src/routes/admin.ts` | Add `POST /:id/read`, `POST /:id/unread`, `DELETE /:id`; update GET to pass `adminId`; remove `PATCH /:id/status` |
| `server/src/routes/admin.test.ts` | Remove PATCH status tests; add read/unread/delete tests |
| `shared/src/types.ts` | Add `is_read?: boolean` to `Request` |
| `shared/src/messageGenerator.ts` | Remove `generateApprovalNotification`, `generateRejectionNotification` |
| `client/src/pages/DashboardPage.tsx` | Remove status column, filter, sort; stat cards → Total only |
| `client/src/pages/AdminPage.tsx` | Remove status column/filter/sort/cards; add unread dot + bold; add unread filter toggle; wire read/unread/delete callbacks |
| `client/src/components/RequestDetailPanel.tsx` | Remove approve/reject; add auto-read-on-open, mark unread, delete with confirmation |
| `client/src/locales/en.json` | Remove approval keys + `status` section; add mark_unread/mark_read/delete/filter_unread |
| `client/src/locales/ja.json` | Same |

---

## 7. Out of Scope

- Employee-side read/delete (admin-only feature)
- Bulk mark-as-read / bulk delete
- Unread count badge in the navbar
- Attachment file storage cleanup (existing cleanup job handles expired files; the DELETE route handles the specific file for deleted requests)
- `RequestStatus` type removal from `shared/src/types.ts` (kept — still used in the DB layer)
