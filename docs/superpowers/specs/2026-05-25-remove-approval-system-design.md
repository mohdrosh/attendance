# Design: Remove Approval System (One-Way Submission)

**Date:** 2026-05-25
**Status:** Approved

---

## Overview

The approval/rejection workflow is being removed from the system. Requests are now one-directional: employees submit → admins receive via email and dashboard. There is no approve/reject action. The existing approval code is preserved in the git branch `archive/with-approval-system` for future restoration.

---

## 1. Branch Preservation

Before any code changes, create an archive branch from current HEAD:

```bash
git checkout -b archive/with-approval-system
git push origin archive/with-approval-system
git checkout main
```

This branch preserves the full approval system (DB-compatible since no schema changes are made on `main`).

---

## 2. Database

**No migration.** The `requests` table retains its `status` (enum: pending/approved/rejected), `reviewed_by`, and `reviewed_at` columns. All new submissions will always have `status = 'pending'` since nothing ever updates it. These columns are inert but harmless, and keeping them means the archive branch is DB-compatible.

---

## 3. Backend Changes

### 3a. `server/src/routes/admin.ts`

- Remove the `PATCH /requests/:id/status` handler entirely.
- Remove imports: `updateRequestStatus`, `AppError`, `generateApprovalNotification`, `generateRejectionNotification`.
- The `GET /requests` handler is unchanged — it still supports all query filters (name, type, from, to, status), though the status filter has no UI and will rarely be used.

**Result:** `admin.ts` exports only the GET route.

### 3b. `server/src/db/queries/admin.ts`

- Remove `updateRequestStatus` function.
- `getAllRequests` is unchanged.

### 3c. `server/src/routes/admin.test.ts`

- Remove the `PATCH /api/admin/requests/:id/status` describe block (7 tests: approve, reject, with/without notification, invalid status, email send check).
- The `GET /api/admin/requests` describe block remains.

### 3d. `shared/src/messageGenerator.ts`

- Remove `generateApprovalNotification` function.
- Remove `generateRejectionNotification` function and its `RejectionNotificationInput` interface.
- `generateMessage` (submission notification) is untouched.

---

## 4. Frontend Changes

### 4a. Employee Dashboard (`client/src/pages/DashboardPage.tsx`)

| What | Change |
|---|---|
| Stat cards | Remove Pending, Approved, Rejected cards. Keep **Total only**. |
| Table columns | Remove `status` column. Columns: Date, From, To, Type, Reason, Submitted. |
| Status filter | Remove status filter dropdown entirely. |
| Sort options | Remove "sort by status" option. |
| `STATUS_STYLES` constant | Delete — no longer used. |
| `RequestStatus` import | Remove — no longer used. |

### 4b. Admin Dashboard (`client/src/pages/AdminPage.tsx`)

| What | Change |
|---|---|
| Stat cards | Remove Pending, Approved, Rejected cards. Keep **Total only**. |
| Table columns | Remove `status` badge column. |
| Status filter | Remove status filter dropdown. |
| Sort options | Remove "sort by status" option. |
| `STATUS_STYLES` constant | Delete — no longer used. |
| `handleStatusChange` callback | Delete — `RequestDetailPanel` no longer emits status changes. |
| `RequestStatus` import | Remove — no longer used. |

### 4c. Request Detail Panel (`client/src/components/RequestDetailPanel.tsx`)

Remove entirely:
- `onStatusChange` prop
- `loading` state (`'approve' | 'reject' | null`)
- `sendNotification` state
- `rejectionReason` state
- `result` state and result screen (`approved_title` / `rejected_title` UI)
- `handleAction` function
- Approve/Reject buttons
- "Send notification" checkbox
- Rejection reason textarea
- The `request.status === 'pending'` guard block around the action section

Keep:
- All request field displays (type, date, time, reason, leave type, admin message, attachment)
- Attachment download button
- Close button
- `onClose` prop

The panel becomes a clean read-only detail view. No `onStatusChange` prop is needed — the `AdminPage` caller is simplified accordingly.

### 4d. Translations

**`client/src/locales/en.json` and `ja.json`:**

Remove from `detail_panel`:
- `approve`
- `reject`
- `send_notification`
- `rejection_reason`
- `rejection_reason_placeholder`
- `approved_title`
- `rejected_title`

Remove the entire `status` section (`pending`, `approved`, `rejected`) — status is not displayed anywhere in the UI after these changes.

---

## 5. Files Changed Summary

| File | Change |
|---|---|
| `server/src/routes/admin.ts` | Remove `PATCH /:id/status` endpoint + approval email logic |
| `server/src/db/queries/admin.ts` | Remove `updateRequestStatus` |
| `server/src/routes/admin.test.ts` | Remove PATCH status tests (7 tests) |
| `shared/src/messageGenerator.ts` | Remove `generateApprovalNotification`, `generateRejectionNotification` |
| `client/src/pages/DashboardPage.tsx` | Remove status column, filter, sort; stat cards → Total only |
| `client/src/pages/AdminPage.tsx` | Remove status column, filter, sort, cards; stat cards → Total only |
| `client/src/components/RequestDetailPanel.tsx` | Remove approve/reject actions; make read-only |
| `client/src/locales/en.json` | Remove approval keys from `detail_panel`; remove `status` section |
| `client/src/locales/ja.json` | Same |

---

## 6. Out of Scope

- Email notification on submission (still fires — employees' managers still receive the submission email)
- Request filtering by type, date range, name (all preserved on admin dashboard)
- Employee request list (preserved, just without a status column)
- The `RequestStatus` type in `shared/src/types.ts` — kept as-is (it's a DB type; removing it would require updating the `getAllRequests` filter signature for no gain)
