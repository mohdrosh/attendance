# Design: Admin Employee Management

**Date:** 2026-05-25
**Status:** Approved

---

## Overview

Add a full employee management interface for admins: a separate page at `/admin/employees` where admins can create, view, edit, deactivate, reactivate, and delete employee accounts, manage manager assignments, reset passwords, and view a complete audit trail of all changes.

---

## 1. Identifier Glossary

| Field | Type | Description |
|---|---|---|
| `id` | UUID | PostgreSQL-generated primary key. Internal only — never shown in UI. Used as FK in all tables. |
| `employee_number` | VARCHAR(50) | 7-digit human-facing number entered by admin. Used for login and displayed throughout the UI. |
| `name_ja` / `name_en` | VARCHAR(100) | Display names in Japanese and English. |

---

## 2. Database Migration (`005_employee_management.sql`)

### 2a. Add `is_active` to `users`

```sql
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

Existing rows default to `true`. Login is blocked when `is_active = false`. Deactivation is reversible; only hard delete is permanent.

### 2b. New `employee_audit_log` table

```sql
CREATE TABLE employee_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action      TEXT NOT NULL,
  changes     JSONB,
  snapshot    JSONB
);

CREATE INDEX idx_audit_log_employee_id ON employee_audit_log(employee_id);
CREATE INDEX idx_audit_log_changed_at  ON employee_audit_log(changed_at);
```

Both FKs are nullable with `ON DELETE SET NULL`:
- `employee_id` becomes NULL after the employee is deleted — the `snapshot` column preserves their name/number/email for display.
- `changed_by` becomes NULL if the admin who made a change is later deleted — the audit entry itself is preserved.

**`action` values:** `created` | `updated` | `deactivated` | `reactivated` | `deleted` | `password_reset` | `manager_assigned` | `manager_removed`

**`changes`:** JSON diff for field edits — `{ "email": { "from": "old@x.com", "to": "new@x.com" } }`. Null for non-field actions.

**`snapshot`:** On `deleted` only — stores `{ employee_number, name_ja, name_en, email, role }` so the record is readable in audit history even after the user row is gone.

---

## 3. Backend API (`server/src/routes/employees.ts` + `server/src/db/queries/employees.ts`)

All routes under `/api/admin/employees`, protected by `authMiddleware` + `requireRole('admin')`.

### 3a. Existing routes — unchanged endpoints, new audit logging

| Method | Path | Change |
|---|---|---|
| `GET /` | List all employees | Add `is_active` to returned fields |
| `GET /:id` | Get single employee | Add `is_active` to returned fields |
| `PATCH /:id` | Update fields | Write `updated` audit entry with JSON diff of changed fields |
| `POST /:id/managers` | Assign manager | Write `manager_assigned` audit entry |
| `DELETE /:id/managers/:managerId` | Remove manager | Write `manager_removed` audit entry |

Train-line routes (`POST /:id/train-lines`, `DELETE /:id/train-lines/:lineId`) require no audit logging — train lines are not a critical field.

### 3b. Modified — `POST /` (create employee)

Admin supplies: `employee_number`, `name_ja`, `name_en`, `email`, `role`.

Backend generates a cryptographically random 12-character temp password:
- At least 1 uppercase, 1 lowercase, 1 digit, 1 special character (`!@#$%`)
- Generated with `crypto.randomBytes`, not `Math.random`

Returns temp password in plain text — the **only** time it is ever returned. Logs `created` audit entry.

```
Request:  { employee_number, name_ja, name_en, email, role }
Response: 201 { id, tempPassword }
Errors:   400 missing fields | 409 employee_number or email already exists
```

### 3c. New — `POST /:id/reset-password`

Generates a new random password using the same algorithm as create. Hashes and saves it. Logs `password_reset`. Returns plain-text password once.

```
Response: 200 { tempPassword }
Errors:   404 employee not found
```

### 3d. New — `PATCH /:id/deactivate`

Sets `is_active = false`. Logs `deactivated`. Prevents deactivating an already-deactivated account (409). Prevents admin from deactivating themselves (400).

```
Response: 200 { ok: true }
Errors:   400 cannot deactivate yourself | 404 not found | 409 already deactivated
```

### 3e. New — `PATCH /:id/reactivate`

Sets `is_active = true`. Logs `reactivated`. Returns 409 if already active.

```
Response: 200 { ok: true }
Errors:   404 not found | 409 already active
```

### 3f. New — `DELETE /:id`

Hard deletes the user. Order of operations: (1) write `deleted` audit entry with `snapshot` of `{ employee_number, name_ja, name_en, email, role }`, (2) hard delete user row. PostgreSQL `ON DELETE CASCADE` removes their requests and refresh tokens. Audit log entries survive with `employee_id` set to NULL — the snapshot provides identity context. `changed_by` on the deleted entry remains set to the acting admin's UUID. Prevents self-deletion.

```
Response: 200 { ok: true }
Errors:   400 cannot delete yourself | 404 not found
```

### 3g. New — `GET /:id/audit-log`

Returns the employee's full audit history, newest first. Joins `changed_by` UUID to return `changed_by_name_ja` and `changed_by_name_en`.

```
Response: 200 [{ id, action, changes, snapshot, changed_at, changed_by_name_ja, changed_by_name_en }]
```

### 3h. Auth login change (`server/src/routes/auth.ts`)

The login query adds an `is_active` check. If `is_active = false`, return:
```
401 { error: 'account_deactivated' }
```
This distinct error code lets the frontend show a specific message.

### 3i. Temp password generator (shared utility)

New file: `server/src/utils/generatePassword.ts`

```ts
import crypto from 'crypto';

export function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%';
  const all = upper + lower + digits + special;

  const pick = (charset: string) =>
    charset[crypto.randomInt(charset.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const combined = [...required, ...rest];

  // Fisher-Yates shuffle
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join('');
}
```

---

## 4. Shared Types (`shared/src/types.ts`)

```ts
export type AuditAction =
  | 'created' | 'updated' | 'deactivated' | 'reactivated'
  | 'deleted' | 'password_reset' | 'manager_assigned' | 'manager_removed';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  changes: Record<string, { from: string; to: string }> | null;
  snapshot: Record<string, string> | null;
  changed_at: string;
  changed_by_name_ja: string;
  changed_by_name_en: string;
}

export interface EmployeeDetail {
  id: string;
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  work_start: string | null;
  work_end: string | null;
  managers: { id: string; name_ja: string; name_en: string; email: string }[];
}

export interface EmployeeListItem {
  id: string;
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}
```

---

## 5. Frontend — New Page (`client/src/pages/AdminEmployeesPage.tsx`)

**Route:** `/admin/employees`
**Access:** Admin only (protected by `ProtectedRoute role="admin"`)

### 5a. List view

- **Search bar:** filters by name (JA or EN) or employee number (client-side on loaded data)
- **Filters:** Role (All / Employee / Admin) + Status (All / Active / Deactivated) — client-side
- **Table columns:** Employee No. | Name (JA) | Name (EN) | Email | Role | Status
- **Status badge:** green "Active" / grey "Deactivated" — matching existing status badge style
- **"Add Employee" button** — top-right, opens create panel
- **Row click** — opens detail panel for that employee

### 5b. Detail panel (`client/src/components/EmployeeDetailPanel.tsx`)

Slide-in from right, same visual pattern as `RequestDetailPanel`. Two tabs: **Details** and **Audit Log**.

**Details tab:**

All fields editable inline:
- Employee Number (text input)
- Name JA (text input)
- Name EN (text input)
- Email (text input)
- Role (dropdown: Employee / Admin)
- Work Start / Work End (time inputs, optional)

Manager assignment section:
- List of current managers with "✕ Remove" button per entry
- "Add Manager" dropdown — lists all users except the employee themselves; filters already-assigned managers out

Action buttons at bottom of panel:
| Button | Behaviour |
|---|---|
| **Save Changes** | `PATCH /:id` — only enabled when form is dirty. On success: shows inline "Saved" confirmation, clears dirty state. |
| **Reset Password** | `POST /:id/reset-password` — opens `PasswordRevealModal` with generated password + copy button. |
| **Deactivate / Reactivate** | Toggles based on `is_active`. Deactivate shows a confirmation prompt first. |
| **Delete Account** | Red button. Opens a confirmation modal requiring the admin to type `delete` before proceeding. On success: closes panel, removes row from list. |

**Audit Log tab:**

Timeline list, newest first. Each entry shows:
- Timestamp (formatted as `YYYY-MM-DD HH:mm`)
- Admin who made the change (`changed_by_name_ja / changed_by_name_en`)
- Action label (human-readable: "Account created", "Fields updated", "Password reset", etc.)
- For `updated` actions: field diff rendered as `fieldName: old value → new value`
- For `deleted` actions: shows the stored snapshot values

### 5c. Create Employee panel

"Add Employee" opens the same panel component in create mode (no tabs — just the form). Fields: employee number, name JA, name EN, email, role. No password field.

On submit: `POST /api/admin/employees`. On success: opens `PasswordRevealModal`.

### 5d. `PasswordRevealModal` component

```
┌──────────────────────────────────────┐
│  Temporary Password                  │
│                                      │
│  [ Xk9#mPqL2!rW ]  [Copy]           │
│                                      │
│  ⚠ Share this with the employee.    │
│  It will not be shown again.         │
│                                      │
│                     [Done]           │
└──────────────────────────────────────┘
```

Copy button uses `navigator.clipboard.writeText`. "Done" closes the modal. Clicking outside does nothing (must explicitly click Done).

---

## 6. Navbar Change (`client/src/components/Navbar.tsx`)

Add "Employee Management" link in the admin drawer, visible only when `user.role === 'admin'`:
```
→ /admin/employees
```
Placed below the existing "Request Management" link.

---

## 7. Translations

### `ja.json` additions

```json
"employees": {
  "title": "社員管理",
  "add": "社員を追加",
  "search_placeholder": "名前・社員番号で検索",
  "filter_role": "役割",
  "filter_status": "ステータス",
  "status_active": "有効",
  "status_deactivated": "無効",
  "tabs": {
    "details": "詳細",
    "audit_log": "変更履歴"
  },
  "fields": {
    "employee_number": "社員番号",
    "name_ja": "氏名（日本語）",
    "name_en": "氏名（英語）",
    "email": "メールアドレス",
    "role": "役割",
    "work_start": "勤務開始時間",
    "work_end": "勤務終了時間",
    "managers": "上長"
  },
  "actions": {
    "save": "変更を保存",
    "saved": "保存しました",
    "reset_password": "パスワードをリセット",
    "deactivate": "アカウントを無効化",
    "reactivate": "アカウントを有効化",
    "delete": "アカウントを削除",
    "add_manager": "上長を追加",
    "remove": "削除"
  },
  "password_modal": {
    "title": "仮パスワード",
    "warning": "このパスワードを社員に共有してください。再表示はできません。",
    "copy": "コピー",
    "done": "完了"
  },
  "confirm_deactivate": "このアカウントを無効化しますか？",
  "confirm_delete": "削除を確定するには「delete」と入力してください。",
  "audit": {
    "created": "アカウントを作成",
    "updated": "フィールドを更新",
    "deactivated": "アカウントを無効化",
    "reactivated": "アカウントを有効化",
    "deleted": "アカウントを削除",
    "password_reset": "パスワードをリセット",
    "manager_assigned": "上長を追加",
    "manager_removed": "上長を削除"
  }
}
```

### `en.json` additions

```json
"employees": {
  "title": "Employee Management",
  "add": "Add Employee",
  "search_placeholder": "Search by name or employee no.",
  "filter_role": "Role",
  "filter_status": "Status",
  "status_active": "Active",
  "status_deactivated": "Deactivated",
  "tabs": {
    "details": "Details",
    "audit_log": "Audit Log"
  },
  "fields": {
    "employee_number": "Employee Number",
    "name_ja": "Name (Japanese)",
    "name_en": "Name (English)",
    "email": "Email",
    "role": "Role",
    "work_start": "Work Start",
    "work_end": "Work End",
    "managers": "Managers"
  },
  "actions": {
    "save": "Save Changes",
    "saved": "Saved",
    "reset_password": "Reset Password",
    "deactivate": "Deactivate Account",
    "reactivate": "Reactivate Account",
    "delete": "Delete Account",
    "add_manager": "Add Manager",
    "remove": "Remove"
  },
  "password_modal": {
    "title": "Temporary Password",
    "warning": "Share this password with the employee. It will not be shown again.",
    "copy": "Copy",
    "done": "Done"
  },
  "confirm_deactivate": "Are you sure you want to deactivate this account?",
  "confirm_delete": "Type \"delete\" to confirm permanent deletion.",
  "audit": {
    "created": "Account created",
    "updated": "Fields updated",
    "deactivated": "Account deactivated",
    "reactivated": "Account reactivated",
    "deleted": "Account deleted",
    "password_reset": "Password reset",
    "manager_assigned": "Manager assigned",
    "manager_removed": "Manager removed"
  }
}
```

---

## 8. Files Changed / Created (summary)

| File | Change |
|---|---|
| `server/src/db/migrations/005_employee_management.sql` | Add `is_active` column + `employee_audit_log` table |
| `server/src/utils/generatePassword.ts` | Temp password generator utility |
| `server/src/db/queries/employees.ts` | Add `deactivateEmployee`, `reactivateEmployee`, `deleteEmployee`, `resetPassword`, `getAuditLog`, `writeAuditLog` |
| `server/src/routes/employees.ts` | Add deactivate/reactivate/delete/reset-password/audit-log endpoints; wire audit logging into existing patch/manager routes |
| `server/src/routes/auth.ts` | Block login when `is_active = false` |
| `shared/src/types.ts` | Add `AuditAction`, `AuditLogEntry`, `EmployeeDetail`, `EmployeeListItem` |
| `client/src/pages/AdminEmployeesPage.tsx` | New page — list + panel orchestration |
| `client/src/components/EmployeeDetailPanel.tsx` | Slide-in panel with Details + Audit Log tabs |
| `client/src/components/PasswordRevealModal.tsx` | One-time password display modal |
| `client/src/components/Navbar.tsx` | Add Employee Management link for admins |
| `client/src/locales/en.json` | New `employees` key |
| `client/src/locales/ja.json` | New `employees` key |
| `server/src/routes/employees.test.ts` | Extend existing tests; add tests for new endpoints |

---

## 9. Out of Scope

- Employee self-service password reset (deferred to full auth redesign)
- Email notification to employee on account creation or password reset (deferred)
- Pagination on employee list (dataset is small; all-at-once is fine for now)
- Audit log for request approve/reject actions (separate from employee profile changes)
