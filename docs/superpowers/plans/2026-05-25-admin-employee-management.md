# Admin Employee Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full employee management to the admin UI — create, view, edit, deactivate, delete employees with temp password generation and a complete audit trail.

**Architecture:** New DB tables (`is_active` column + `employee_audit_log`), new backend endpoints under `/api/admin/employees`, and three new frontend components (`PasswordRevealModal`, `EmployeeDetailPanel`, `AdminEmployeesPage`) plus a new route at `/admin/employees`.

**Tech Stack:** PostgreSQL (migration), TypeScript (shared types + Express routes + React), react-i18next (translations), inline CSS following existing patterns.

---

## File Map

| File | Status | Change |
|---|---|---|
| `server/src/db/migrations/005_employee_management.sql` | Create | `is_active` column + `employee_audit_log` table |
| `server/src/utils/generatePassword.ts` | Create | Cryptographic temp password generator |
| `server/src/utils/generatePassword.test.ts` | Create | Unit tests for password generator |
| `shared/src/types.ts` | Modify | Add `AuditAction`, `AuditLogEntry`, `EmployeeDetail`, `EmployeeListItem` |
| `server/src/db/queries/users.ts` | Modify | Add `is_active` to `findUserByEmployeeNumber` return |
| `server/src/db/queries/employees.ts` | Modify | Update existing queries + add audit/deactivate/reactivate/delete/reset functions |
| `server/src/routes/auth.ts` | Modify | Block login when `is_active = false` |
| `server/src/routes/employees.ts` | Modify | Rework POST /, add 5 new endpoints, add audit logging to PATCH + manager routes |
| `server/src/routes/employees.test.ts` | Modify | Update existing tests + add tests for all new endpoints |
| `server/src/routes/auth.test.ts` | Modify | Add test for deactivated account login |
| `client/src/locales/en.json` | Modify | Add `employees` key |
| `client/src/locales/ja.json` | Modify | Add `employees` key |
| `client/src/components/PasswordRevealModal.tsx` | Create | One-time password display modal |
| `client/src/components/EmployeeDetailPanel.tsx` | Create | Slide-in panel with Details + Audit Log tabs |
| `client/src/pages/AdminEmployeesPage.tsx` | Create | List page with search/filter + panel orchestration |
| `client/src/App.tsx` | Modify | Add `/admin/employees` route |
| `client/src/components/Navbar.tsx` | Modify | Add Employee Management link for admins |

---

## Task 1: DB Migration — is_active + employee_audit_log

**Files:**
- Create: `server/src/db/migrations/005_employee_management.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- server/src/db/migrations/005_employee_management.sql
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

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

- [ ] **Step 2: Run migration on dev DB**

```bash
cd server && npm run migrate
```

Expected: `[migrate] Applied 005_employee_management.sql`

- [ ] **Step 3: Run migration on test DB**

```bash
cd server && NODE_ENV=test npm run migrate
```

Expected: `[migrate] Applied 005_employee_management.sql`

- [ ] **Step 4: Verify columns exist**

```bash
PATH="/Applications/Postgres.app/Contents/Versions/18/bin:$PATH" psql attendance_dev -c "\d users" | grep is_active
PATH="/Applications/Postgres.app/Contents/Versions/18/bin:$PATH" psql attendance_dev -c "\d employee_audit_log"
```

Expected: `is_active` column visible; `employee_audit_log` table with 7 columns and 2 indexes.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/005_employee_management.sql
git commit -m "feat: add is_active to users and employee_audit_log table (migration 005)"
```

---

## Task 2: generatePassword Utility

**Files:**
- Create: `server/src/utils/generatePassword.ts`
- Create: `server/src/utils/generatePassword.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/generatePassword.test.ts`:

```ts
import { generateTempPassword } from './generatePassword';

describe('generateTempPassword', () => {
  it('returns a 12-character string', () => {
    expect(generateTempPassword()).toHaveLength(12);
  });

  it('always contains at least one uppercase letter', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[A-Z]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one lowercase letter', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[a-z]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one digit', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[0-9]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one special character from !@#$%', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[!@#$%]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('only uses allowed characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(/^[A-Za-z0-9!@#$%]+$/.test(generateTempPassword())).toBe(true);
    }
  });

  it('generates different passwords each time', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(passwords.size).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=generatePassword
```

Expected: FAIL — `Cannot find module './generatePassword'`

- [ ] **Step 3: Implement the utility**

Create `server/src/utils/generatePassword.ts`:

```ts
import crypto from 'crypto';

export function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%';
  const all = upper + lower + digits + special;

  const pick = (charset: string) => charset[crypto.randomInt(charset.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const combined = [...required, ...rest];

  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=generatePassword
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/generatePassword.ts server/src/utils/generatePassword.test.ts
git commit -m "feat: add cryptographic temp password generator utility"
```

---

## Task 3: Shared Types

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Add the new types**

Append to `shared/src/types.ts` after the existing types:

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
  changed_by_name_ja: string | null;
  changed_by_name_en: string | null;
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
```

- [ ] **Step 2: Build shared package**

```bash
cd shared && npm run build
```

Expected: No errors.

- [ ] **Step 3: Run shared tests to confirm no breakage**

```bash
cd shared && npm test
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: add AuditLogEntry, EmployeeListItem, EmployeeDetail, AuditAction shared types"
```

---

## Task 4: Employee DB Queries — New Functions + Updated Existing

**Files:**
- Modify: `server/src/db/queries/employees.ts`
- Modify: `server/src/db/queries/users.ts`

- [ ] **Step 1: Update `findUserByEmployeeNumber` in users.ts to include `is_active`**

In `server/src/db/queries/users.ts`, change the query from:
```ts
`SELECT id, employee_number, name_ja, name_en, email, password_hash, role
 FROM users WHERE employee_number = $1`
```
to:
```ts
`SELECT id, employee_number, name_ja, name_en, email, password_hash, role, is_active
 FROM users WHERE employee_number = $1`
```

And update the return type annotation:
```ts
return rows[0] as {
  id: string;
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
} | undefined;
```

- [ ] **Step 2: Update `listEmployees` to include `is_active`**

In `server/src/db/queries/employees.ts`, change `listEmployees`:

```ts
export async function listEmployees() {
  const { rows } = await pool.query(
    `SELECT id, employee_number, name_ja, name_en, email, role, is_active
     FROM users ORDER BY name_ja`
  );
  return rows;
}
```

- [ ] **Step 3: Update `getEmployeeById` to include `is_active`**

In `server/src/db/queries/employees.ts`, change `getEmployeeById` — add `u.is_active` to the SELECT list:

```ts
export async function getEmployeeById(id: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role,
            u.is_active, u.work_start, u.work_end,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', t2.id, 'line_name_ja', t2.line_name_ja, 'line_name_en', t2.line_name_en
                ))
                FROM train_lines t2
                WHERE t2.employee_id = u.id
              ),
              '[]'
            ) AS train_lines,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'id', m2.id, 'name_ja', m2.name_ja, 'name_en', m2.name_en, 'email', m2.email
                ))
                FROM employee_managers em2
                JOIN users m2 ON m2.id = em2.manager_id
                WHERE em2.employee_id = u.id
              ),
              '[]'
            ) AS managers
     FROM users u
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] as Record<string, unknown> | undefined;
}
```

- [ ] **Step 4: Update `UpdateEmployeeData` and `ALLOWED_COLUMNS` to include `employee_number`**

Change the interface and constant:

```ts
export interface UpdateEmployeeData {
  employee_number?: string;
  name_ja?: string;
  name_en?: string;
  email?: string;
  role?: UserRole;
  work_start?: string;
  work_end?: string;
}

const ALLOWED_COLUMNS = new Set(['employee_number', 'name_ja', 'name_en', 'email', 'role', 'work_start', 'work_end']);
```

- [ ] **Step 5: Add `writeAuditLog` function**

```ts
import type { AuditAction } from '@attendance/shared';

export async function writeAuditLog(params: {
  employee_id: string | null;
  changed_by: string;
  action: AuditAction;
  changes?: Record<string, { from: string; to: string }> | null;
  snapshot?: Record<string, string> | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO employee_audit_log (employee_id, changed_by, action, changes, snapshot)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.employee_id,
      params.changed_by,
      params.action,
      params.changes ? JSON.stringify(params.changes) : null,
      params.snapshot ? JSON.stringify(params.snapshot) : null,
    ]
  );
}
```

- [ ] **Step 6: Add `getAuditLog` function**

```ts
export async function getAuditLog(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT al.id, al.action, al.changes, al.snapshot, al.changed_at,
            u.name_ja AS changed_by_name_ja, u.name_en AS changed_by_name_en
     FROM employee_audit_log al
     LEFT JOIN users u ON u.id = al.changed_by
     WHERE al.employee_id = $1
     ORDER BY al.changed_at DESC`,
    [employeeId]
  );
  return rows;
}
```

- [ ] **Step 7: Add `deactivateEmployee` function**

```ts
export async function deactivateEmployee(id: string): Promise<'ok' | 'not_found' | 'already_inactive'> {
  const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [id]);
  if (!rows[0]) return 'not_found';
  if (!rows[0].is_active) return 'already_inactive';
  await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
  return 'ok';
}
```

- [ ] **Step 8: Add `reactivateEmployee` function**

```ts
export async function reactivateEmployee(id: string): Promise<'ok' | 'not_found' | 'already_active'> {
  const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [id]);
  if (!rows[0]) return 'not_found';
  if (rows[0].is_active) return 'already_active';
  await pool.query(`UPDATE users SET is_active = true WHERE id = $1`, [id]);
  return 'ok';
}
```

- [ ] **Step 9: Add `deleteEmployee` function**

```ts
export async function deleteEmployee(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
```

- [ ] **Step 10: Add `resetEmployeePassword` function**

```ts
export async function resetEmployeePassword(id: string, passwordHash: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, id]
  );
  return (rowCount ?? 0) > 0;
}
```

- [ ] **Step 11: Add `getEmployeeSnapshot` helper for audit snapshots**

```ts
export async function getEmployeeSnapshot(id: string): Promise<Record<string, string> | null> {
  const { rows } = await pool.query(
    `SELECT employee_number, name_ja, name_en, email, role FROM users WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return rows[0] as Record<string, string>;
}
```

- [ ] **Step 12: Run existing tests to confirm no breakage**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=employees
```

Expected: All existing employee tests pass (the query changes are backward compatible — added columns, same row structure).

- [ ] **Step 13: Commit**

```bash
git add server/src/db/queries/employees.ts server/src/db/queries/users.ts
git commit -m "feat: update employee queries — is_active, employee_number updatable, audit log + deactivate/delete/reset functions"
```

---

## Task 5: Auth Login — is_active Check

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/routes/auth.test.ts`

- [ ] **Step 1: Write the failing test**

In `server/src/routes/auth.test.ts`, add a new `describe` block after the existing login tests:

```ts
describe('POST /api/auth/login — deactivated account', () => {
  it('returns 401 with account_deactivated when is_active is false', async () => {
    const hash = await bcrypt.hash('Test1234!', 10);
    await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role, is_active)
       VALUES ('DEACT-001', '無効太郎', 'Deactivated User', 'deact@test.com', $1, 'applicant', false)`,
      [hash]
    );
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'DEACT-001', password: 'Test1234!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('account_deactivated');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=auth
```

Expected: The new test FAILS — currently returns 200 (no is_active check).

- [ ] **Step 3: Add is_active check in auth.ts**

In `server/src/routes/auth.ts`, in the `/login` handler, add the check after the bcrypt compare:

```ts
authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { employee_number, password } = req.body;
    if (!employee_number || !password) throw new AppError(400, 'employee_number and password required');

    const user = await findUserByEmployeeNumber(employee_number);
    if (!user) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    if (!user.is_active) throw new AppError(401, 'account_deactivated');

    const profile = await getUserWithTrainLines(user.id);
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await saveRefreshToken(user.id, refreshTokenHash, expiresAt);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    res.json({ accessToken, user: profile });
  } catch (err) { next(err); }
});
```

Note: The `AppError` class is used by the error handler — it formats the response as `{ error: message }`. Verify that `AppError(401, 'account_deactivated')` produces `{ error: 'account_deactivated' }` in the response body by checking `server/src/middleware/errorHandler.ts`. If the handler uses `message` as the error field, this is correct.

- [ ] **Step 4: Run tests to verify pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=auth
```

Expected: All auth tests pass including the new deactivated account test.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/src/routes/auth.test.ts
git commit -m "feat: block login for deactivated accounts (is_active check)"
```

---

## Task 6: Employee Routes — Full Rework

**Files:**
- Modify: `server/src/routes/employees.ts`

This task rewrites the entire `employees.ts` routes file. Replace the full file content:

- [ ] **Step 1: Write the complete updated routes file**

Replace `server/src/routes/employees.ts` with:

```ts
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import { generateTempPassword } from '../utils/generatePassword';
import {
  createEmployee, listEmployees, getEmployeeById, updateEmployee,
  assignManager, removeManager, addTrainLine, removeTrainLine,
  writeAuditLog, getAuditLog, deactivateEmployee, reactivateEmployee,
  deleteEmployee, resetEmployeePassword, getEmployeeSnapshot,
} from '../db/queries/employees';

export const employeesRouter = Router();
employeesRouter.use(authMiddleware);
employeesRouter.use(requireRole('admin'));

// POST / — create employee, auto-generate temp password
employeesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, role } = req.body;
    if (!employee_number || !name_ja || !name_en || !email || !role) {
      throw new AppError(400, 'Missing required fields');
    }
    if (role !== 'admin' && role !== 'applicant') {
      throw new AppError(400, 'Invalid role');
    }
    const tempPassword = generateTempPassword();
    const id = await createEmployee({ employee_number, name_ja, name_en, email, password: tempPassword, role });
    await writeAuditLog({ employee_id: id, changed_by: req.user!.id, action: 'created' });
    res.status(201).json({ id, tempPassword });
  } catch (err: any) {
    if (err.code === '23505') return next(new AppError(409, 'employee_number or email already exists'));
    next(err);
  }
});

// GET / — list all employees (includes is_active)
employeesRouter.get('/', async (_req: AuthRequest, res: Response, next) => {
  try {
    res.json(await listEmployees());
  } catch (err) { next(err); }
});

// GET /:id — get employee detail (includes is_active)
employeesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(employee);
  } catch (err) { next(err); }
});

// PATCH /:id — update fields, write audit log with diff
employeesRouter.patch('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, role, work_start, work_end } = req.body;
    if (role !== undefined && role !== 'admin' && role !== 'applicant') {
      throw new AppError(400, 'Invalid role');
    }

    const before = await getEmployeeById(req.params.id);
    if (!before) throw new AppError(404, 'Employee not found');

    const patch = { employee_number, name_ja, name_en, email, role, work_start, work_end };
    const updated = await updateEmployee(req.params.id, patch);
    if (!updated) throw new AppError(404, 'Employee not found');

    const fieldMap: Record<string, string> = {
      employee_number, name_ja, name_en, email, role, work_start, work_end,
    };
    const changes: Record<string, { from: string; to: string }> = {};
    for (const [key, newVal] of Object.entries(fieldMap)) {
      if (newVal !== undefined) {
        const oldVal = String(before[key] ?? '');
        const nv = String(newVal ?? '');
        if (oldVal !== nv) changes[key] = { from: oldVal, to: nv };
      }
    }
    if (Object.keys(changes).length > 0) {
      await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'updated', changes });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /:id/reset-password
employeesRouter.post('/:id/reset-password', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    await resetEmployeePassword(req.params.id, hash);
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'password_reset' });

    res.json({ tempPassword });
  } catch (err) { next(err); }
});

// PATCH /:id/deactivate
employeesRouter.patch('/:id/deactivate', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot deactivate yourself');
    const result = await deactivateEmployee(req.params.id);
    if (result === 'not_found') throw new AppError(404, 'Employee not found');
    if (result === 'already_inactive') throw new AppError(409, 'Account is already deactivated');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'deactivated' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /:id/reactivate
employeesRouter.patch('/:id/reactivate', async (req: AuthRequest, res: Response, next) => {
  try {
    const result = await reactivateEmployee(req.params.id);
    if (result === 'not_found') throw new AppError(404, 'Employee not found');
    if (result === 'already_active') throw new AppError(409, 'Account is already active');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'reactivated' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /:id — hard delete (write audit log first, then delete)
employeesRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot delete yourself');
    const snapshot = await getEmployeeSnapshot(req.params.id);
    if (!snapshot) throw new AppError(404, 'Employee not found');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'deleted', snapshot });
    await deleteEmployee(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /:id/audit-log
employeesRouter.get('/:id/audit-log', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(await getAuditLog(req.params.id));
  } catch (err) { next(err); }
});

// POST /:id/managers — assign manager, write audit log
employeesRouter.post('/:id/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const { managerId } = req.body;
    if (!managerId) throw new AppError(400, 'managerId is required');
    if (managerId === req.params.id) throw new AppError(400, 'Employee cannot be assigned as their own manager');
    const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [managerId]);
    if (!rows[0]) throw new AppError(404, 'Manager not found');
    await assignManager(req.params.id, managerId);
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'manager_assigned' });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /:id/managers/:managerId — remove manager, write audit log
employeesRouter.delete('/:id/managers/:managerId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeManager(req.params.id, req.params.managerId);
    if (count === 0) throw new AppError(404, 'Manager assignment not found');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'manager_removed' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Train line routes (no audit logging per spec)
employeesRouter.post('/:id/train-lines', async (req: AuthRequest, res: Response, next) => {
  try {
    const { line_name_ja, line_name_en } = req.body;
    if (!line_name_ja || !line_name_en) throw new AppError(400, 'line_name_ja and line_name_en are required');
    const id = await addTrainLine(req.params.id, { line_name_ja, line_name_en });
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

employeesRouter.delete('/:id/train-lines/:lineId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeTrainLine(req.params.lineId);
    if (count === 0) throw new AppError(404, 'Train line not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Run existing employee tests (will have failures for POST / test)**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=employees
```

Expected: Most tests pass; the `POST /` create test fails because response structure changed (returns `tempPassword`, no longer accepts `password` in body). This is expected — tests will be updated in the next task.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/employees.ts
git commit -m "feat: rework employee routes — auto-generated passwords, deactivate/reactivate/delete/reset, audit logging"
```

---

## Task 7: Employee Tests — Update + New

**Files:**
- Modify: `server/src/routes/employees.test.ts`

- [ ] **Step 1: Write the updated test file**

Replace `server/src/routes/employees.test.ts` with the full updated version:

```ts
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let adminId: string;
let employeeId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  const { rows: [adm] } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  adminId = adm.id;
  const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
  adminToken = adminLogin.body.accessToken;

  const { rows: [emp] } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant') RETURNING id`,
    [hash]
  );
  employeeId = emp.id;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('POST /api/admin/employees', () => {
  it('creates employee, auto-generates password, returns id and tempPassword', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-002', name_ja: '新入社員', name_en: 'New Employee', email: 'new@test.com', role: 'applicant' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword).toHaveLength(12);
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com' }); // missing role
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate employee_number', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-001', name_ja: '別', name_en: 'Other', email: 'other@test.com', role: 'applicant' });
    expect(res.status).toBe(409);
  });

  it('returns 409 when email already exists', async () => {
    await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-010', name_ja: '最初', name_en: 'First', email: 'dup@test.com', role: 'applicant' });
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-011', name_ja: '二番目', name_en: 'Second', email: 'dup@test.com', role: 'applicant' });
    expect(res.status).toBe(409);
  });

  it('writes a created audit log entry', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-099', name_ja: '監査', name_en: 'Audit Test', email: 'audit@test.com', role: 'applicant' });
    const newId = res.body.id;
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [newId]
    );
    expect(rows[0]?.action).toBe('created');
  });
});

describe('GET /api/admin/employees', () => {
  it('returns list of all employees including is_active', async () => {
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(typeof res.body[0].is_active).toBe('boolean');
  });
});

describe('GET /api/admin/employees/:id', () => {
  it('returns employee with is_active, train_lines and managers', async () => {
    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
    expect(typeof res.body.is_active).toBe('boolean');
    expect(Array.isArray(res.body.train_lines)).toBe(true);
    expect(Array.isArray(res.body.managers)).toBe(true);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id', () => {
  it('updates employee name_en and writes updated audit log', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Name' });
    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.name_en).toBe('Updated Name');

    const { rows } = await pool.query(
      `SELECT action, changes FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('updated');
    expect(rows[0]?.changes?.name_en?.to).toBe('Updated Name');
  });

  it('updates employee_number', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-999' });
    expect(res.status).toBe(200);
  });

  it('returns 400 when role value is invalid', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when patching a non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/reset-password', () => {
  it('resets password and returns tempPassword', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword).toHaveLength(12);
  });

  it('writes password_reset audit log', async () => {
    await request(app)
      .post(`/api/admin/employees/${employeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('password_reset');
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .post('/api/admin/employees/00000000-0000-0000-0000-000000000000/reset-password')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id/deactivate', () => {
  it('deactivates an active account', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [employeeId]);
    expect(rows[0].is_active).toBe(false);
  });

  it('writes deactivated audit log', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('deactivated');
  });

  it('returns 400 when trying to deactivate yourself', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${adminId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 409 when account is already deactivated', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000/deactivate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id/reactivate', () => {
  it('reactivates a deactivated account', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [employeeId]);
    expect(rows[0].is_active).toBe(true);
  });

  it('writes reactivated audit log', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('reactivated');
  });

  it('returns 409 when account is already active', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000/reactivate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/employees/:id', () => {
  it('hard deletes employee and audit log employee_id becomes null', async () => {
    await request(app)
      .delete(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [employeeId]);
    expect(userRows).toHaveLength(0);

    const { rows: auditRows } = await pool.query(
      `SELECT action, snapshot, employee_id FROM employee_audit_log WHERE employee_id IS NULL AND changed_by = $1`,
      [adminId]
    );
    expect(auditRows[0]?.action).toBe('deleted');
    expect(auditRows[0]?.snapshot?.employee_number).toBe('EMP-001');
    expect(auditRows[0]?.employee_id).toBeNull();
  });

  it('returns 400 when trying to delete yourself', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .delete('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/employees/:id/audit-log', () => {
  it('returns audit log entries newest first', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'First Change' });
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Second Change' });

    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].action).toBe('updated');
    expect(new Date(res.body[0].changed_at) >= new Date(res.body[1].changed_at)).toBe(true);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .get('/api/admin/employees/00000000-0000-0000-0000-000000000000/audit-log')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/managers', () => {
  it('assigns a manager and writes manager_assigned audit log', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: adminId });
    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('manager_assigned');
  });

  it('returns 404 for non-existent manager', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/employees/:id/managers/:managerId', () => {
  it('removes manager and writes manager_removed audit log', async () => {
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [employeeId, adminId]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('manager_removed');
  });

  it('returns 404 when assignment does not exist', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run all employee tests**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=employees
```

Expected: All tests pass.

- [ ] **Step 3: Run full backend test suite**

```bash
cd server && NODE_ENV=test npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/employees.test.ts
git commit -m "test: update employee tests for auto-generated passwords, add tests for deactivate/reactivate/delete/reset/audit-log"
```

---

## Task 8: Translations

**Files:**
- Modify: `client/src/locales/en.json`
- Modify: `client/src/locales/ja.json`

- [ ] **Step 1: Add the `employees` key to en.json**

In `client/src/locales/en.json`, add before the closing `}`:

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

- [ ] **Step 2: Add the `employees` key to ja.json**

In `client/src/locales/ja.json`, add before the closing `}`:

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

- [ ] **Step 3: Commit**

```bash
git add client/src/locales/en.json client/src/locales/ja.json
git commit -m "feat: add employee management translations (en + ja)"
```

---

## Task 9: PasswordRevealModal Component

**Files:**
- Create: `client/src/components/PasswordRevealModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  password: string;
  onClose: () => void;
}

export function PasswordRevealModal({ password, onClose }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: '16px', padding: '32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 301,
        width: '360px', maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: '1.1em', fontWeight: 700, color: '#111', marginBottom: '20px' }}>
          {t('employees.password_modal.title')}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <code style={{
            flex: 1, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb',
            borderRadius: '8px', fontSize: '1.1em', fontFamily: 'monospace',
            letterSpacing: '0.08em', color: '#111',
          }}>
            {password}
          </code>
          <button
            onClick={handleCopy}
            style={{
              padding: '10px 16px', background: copied ? '#d1fae5' : '#eff6ff',
              color: copied ? '#065f46' : '#1d4ed8',
              border: `1px solid ${copied ? '#6ee7b7' : '#bfdbfe'}`,
              borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓' : t('employees.password_modal.copy')}
          </button>
        </div>

        <p style={{ fontSize: '0.88em', color: '#d97706', marginBottom: '24px', lineHeight: 1.5 }}>
          ⚠ {t('employees.password_modal.warning')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 28px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95em',
            }}
          >
            {t('employees.password_modal.done')}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/PasswordRevealModal.tsx
git commit -m "feat: add PasswordRevealModal component for one-time temp password display"
```

---

## Task 10: EmployeeDetailPanel Component

**Files:**
- Create: `client/src/components/EmployeeDetailPanel.tsx`

This is the largest component. It handles both `view` mode (edit existing employee) and `create` mode (add new employee). In view mode it shows two tabs: Details and Audit Log. In create mode, no tabs.

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmployeeDetail, EmployeeListItem, AuditLogEntry } from '@attendance/shared';
import { apiFetch } from '../api/client';
import { PasswordRevealModal } from './PasswordRevealModal';

interface Props {
  mode: 'view' | 'create';
  employeeId?: string;
  allUsers: EmployeeListItem[];
  onClose: () => void;
  onCreated: (employee: EmployeeListItem) => void;
  onUpdated: (employee: EmployeeListItem) => void;
  onDeleted: (id: string) => void;
}

type Tab = 'details' | 'audit_log';

interface FormState {
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: string;
  work_start: string;
  work_end: string;
}

function emptyForm(): FormState {
  return { employee_number: '', name_ja: '', name_en: '', email: '', role: 'applicant', work_start: '', work_end: '' };
}

function employeeToForm(e: EmployeeDetail): FormState {
  return {
    employee_number: e.employee_number,
    name_ja: e.name_ja,
    name_en: e.name_en,
    email: e.email,
    role: e.role,
    work_start: e.work_start ?? '',
    work_end: e.work_end ?? '',
  };
}

export function EmployeeDetailPanel({ mode, employeeId, allUsers, onClose, onCreated, onUpdated, onDeleted }: Props) {
  const { t } = useTranslation();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm());
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pendingCreated, setPendingCreated] = useState<EmployeeListItem | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [addManagerId, setAddManagerId] = useState('');

  const isDirty = mode === 'view' && JSON.stringify(form) !== JSON.stringify(savedForm);

  useEffect(() => {
    if (mode === 'view' && employeeId) {
      apiFetch(`/api/admin/employees/${employeeId}`)
        .then(r => r.json())
        .then((data: EmployeeDetail) => {
          setEmployee(data);
          const f = employeeToForm(data);
          setForm(f);
          setSavedForm(f);
        });
    }
  }, [mode, employeeId]);

  async function loadAuditLog() {
    if (!employeeId || auditLoaded) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/audit-log`);
    const data = await res.json();
    setAuditLog(data);
    setAuditLoaded(true);
  }

  async function handleSave() {
    if (!employeeId || !isDirty) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role,
          work_start: form.work_start || null,
          work_end: form.work_end || null,
        }),
      });
      if (!res.ok) return;
      setSavedForm({ ...form });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
      if (employee) {
        const updated: EmployeeListItem = {
          id: employee.id,
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role as EmployeeListItem['role'],
          is_active: employee.is_active,
        };
        setEmployee({ ...employee, ...updated });
        onUpdated(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/employees', {
        method: 'POST',
        body: JSON.stringify({
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role,
        }),
      });
      if (!res.ok) return;
      const { id, tempPassword: tp } = await res.json();
      const newEmployee: EmployeeListItem = {
        id,
        employee_number: form.employee_number,
        name_ja: form.name_ja,
        name_en: form.name_en,
        email: form.email,
        role: form.role as EmployeeListItem['role'],
        is_active: true,
      };
      setPendingCreated(newEmployee);
      setTempPassword(tp);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!employeeId) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/reset-password`, { method: 'POST' });
    const { tempPassword: tp } = await res.json();
    setTempPassword(tp);
  }

  async function handleDeactivate() {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/deactivate`, { method: 'PATCH' });
    if (res.ok) {
      setEmployee({ ...employee, is_active: false });
      onUpdated({ ...employee, is_active: false, role: employee.role });
      setConfirmDeactivate(false);
    }
  }

  async function handleReactivate() {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/reactivate`, { method: 'PATCH' });
    if (res.ok) {
      setEmployee({ ...employee, is_active: true });
      onUpdated({ ...employee, is_active: true, role: employee.role });
    }
  }

  async function handleDelete() {
    if (!employeeId || deleteInput !== 'delete') return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted(employeeId);
      onClose();
    }
  }

  async function handleAddManager() {
    if (!employeeId || !addManagerId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/managers`, {
      method: 'POST',
      body: JSON.stringify({ managerId: addManagerId }),
    });
    if (res.ok) {
      const newManager = allUsers.find(u => u.id === addManagerId);
      if (newManager) {
        const updatedManagers = [...employee.managers, { id: newManager.id, name_ja: newManager.name_ja, name_en: newManager.name_en, email: newManager.email }];
        setEmployee({ ...employee, managers: updatedManagers });
      }
      setAddManagerId('');
    }
  }

  async function handleRemoveManager(managerId: string) {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/managers/${managerId}`, { method: 'DELETE' });
    if (res.ok) {
      setEmployee({ ...employee, managers: employee.managers.filter(m => m.id !== managerId) });
    }
  }

  const availableManagers = allUsers.filter(u =>
    u.id !== employeeId && !employee?.managers.some(m => m.id === u.id)
  );

  const isCreateValid = form.employee_number && form.name_ja && form.name_en && form.email && form.role;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh',
        background: 'white', boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: mode === 'create' ? '1px solid #f0f0f0' : 'none', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mode === 'create' ? '16px' : '0' }}>
            <h2 style={{ fontSize: '1.05em', fontWeight: 700, color: '#111' }}>
              {mode === 'create' ? t('employees.add') : (employee?.name_ja ?? '…')}
            </h2>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
          </div>

          {/* Tabs — view mode only */}
          {mode === 'view' && (
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #f0f0f0', marginTop: '4px' }}>
              {(['details', 'audit_log'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab === 'audit_log') loadAuditLog(); }}
                  style={{
                    padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '0.88em', fontWeight: 600,
                    background: 'none', color: activeTab === tab ? '#2563eb' : '#6b7280',
                    borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                  }}
                >
                  {t(`employees.tabs.${tab}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {(mode === 'create' || activeTab === 'details') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FieldInput label={t('employees.fields.employee_number')} value={form.employee_number} onChange={v => setForm(f => ({ ...f, employee_number: v }))} />
              <FieldInput label={t('employees.fields.name_ja')} value={form.name_ja} onChange={v => setForm(f => ({ ...f, name_ja: v }))} />
              <FieldInput label={t('employees.fields.name_en')} value={form.name_en} onChange={v => setForm(f => ({ ...f, name_en: v }))} />
              <FieldInput label={t('employees.fields.email')} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
              <div>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>
                  {t('employees.fields.role')}
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}
                >
                  <option value="applicant">{t('profile.roles.applicant')}</option>
                  <option value="admin">{t('profile.roles.admin')}</option>
                </select>
              </div>
              {mode === 'view' && (
                <>
                  <FieldInput label={t('employees.fields.work_start')} value={form.work_start} onChange={v => setForm(f => ({ ...f, work_start: v }))} type="time" />
                  <FieldInput label={t('employees.fields.work_end')} value={form.work_end} onChange={v => setForm(f => ({ ...f, work_end: v }))} type="time" />

                  {/* Managers section */}
                  <div>
                    <div style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      {t('employees.fields.managers')}
                    </div>
                    {employee?.managers.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f8fafc', borderRadius: '7px', marginBottom: '6px', fontSize: '0.88em' }}>
                        <span>{m.name_ja} <span style={{ color: '#9ca3af' }}>({m.name_en})</span></span>
                        <button
                          onClick={() => handleRemoveManager(m.id)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600 }}
                        >
                          ✕ {t('employees.actions.remove')}
                        </button>
                      </div>
                    ))}
                    {availableManagers.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <select
                          value={addManagerId}
                          onChange={e => setAddManagerId(e.target.value)}
                          style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em', background: 'white' }}
                        >
                          <option value="">— {t('employees.actions.add_manager')} —</option>
                          {availableManagers.map(u => (
                            <option key={u.id} value={u.id}>{u.name_ja} ({u.name_en})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddManager}
                          disabled={!addManagerId}
                          style={{ padding: '7px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: addManagerId ? 'pointer' : 'not-allowed', fontSize: '0.88em', fontWeight: 600 }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Audit Log tab */}
          {mode === 'view' && activeTab === 'audit_log' && (
            <div>
              {auditLog.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.9em' }}>No history yet.</p>}
              {auditLog.map(entry => (
                <div key={entry.id} style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: '14px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78em', color: '#9ca3af', marginBottom: '3px' }}>
                    {new Date(entry.changed_at).toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')}
                    {entry.changed_by_name_ja && ` · ${entry.changed_by_name_ja}`}
                  </div>
                  <div style={{ fontSize: '0.9em', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    {t(`employees.audit.${entry.action}`)}
                  </div>
                  {entry.changes && Object.entries(entry.changes).map(([field, diff]) => (
                    <div key={field} style={{ fontSize: '0.82em', color: '#6b7280' }}>
                      <strong>{field}:</strong> {diff.from} → {diff.to}
                    </div>
                  ))}
                  {entry.snapshot && entry.action === 'deleted' && (
                    <div style={{ fontSize: '0.82em', color: '#6b7280' }}>
                      {Object.entries(entry.snapshot).map(([k, v]) => (
                        <div key={k}><strong>{k}:</strong> {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mode === 'create' ? (
            <button
              onClick={handleCreate}
              disabled={!isCreateValid || saving}
              style={{ padding: '11px', background: isCreateValid ? '#3b82f6' : '#93c5fd', color: 'white', border: 'none', borderRadius: '8px', cursor: isCreateValid ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.95em' }}
            >
              {saving ? '…' : t('employees.add')}
            </button>
          ) : (
            <>
              {/* Save Changes */}
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                style={{ padding: '11px', background: isDirty ? '#3b82f6' : '#e5e7eb', color: isDirty ? 'white' : '#9ca3af', border: 'none', borderRadius: '8px', cursor: isDirty ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.95em' }}
              >
                {saving ? '…' : savedOk ? t('employees.actions.saved') : t('employees.actions.save')}
              </button>

              {/* Reset Password */}
              <button
                onClick={handleResetPassword}
                style={{ padding: '10px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
              >
                {t('employees.actions.reset_password')}
              </button>

              {/* Deactivate / Reactivate */}
              {employee && (employee.is_active ? (
                confirmDeactivate ? (
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '0.88em', color: '#92400e', marginBottom: '10px' }}>{t('employees.confirm_deactivate')}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setConfirmDeactivate(false)} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.88em' }}>Cancel</button>
                      <button onClick={handleDeactivate} style={{ flex: 1, padding: '8px', background: '#d97706', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em' }}>{t('employees.actions.deactivate')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeactivate(true)} style={{ padding: '10px', background: 'white', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                    {t('employees.actions.deactivate')}
                  </button>
                )
              ) : (
                <button onClick={handleReactivate} style={{ padding: '10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                  {t('employees.actions.reactivate')}
                </button>
              ))}

              {/* Delete Account */}
              {showDeleteConfirm ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '0.88em', color: '#991b1b', marginBottom: '8px' }}>{t('employees.confirm_delete')}</p>
                  <input
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="delete"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '0.88em', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.88em' }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleteInput !== 'delete'} style={{ flex: 1, padding: '8px', background: deleteInput === 'delete' ? '#dc2626' : '#fca5a5', color: 'white', border: 'none', borderRadius: '7px', cursor: deleteInput === 'delete' ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.88em' }}>
                      {t('employees.actions.delete')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                  {t('employees.actions.delete')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Password modal — shown after create or reset */}
      {tempPassword && (
        <PasswordRevealModal
          password={tempPassword}
          onClose={() => {
            setTempPassword(null);
            if (pendingCreated) {
              onCreated(pendingCreated);
              setPendingCreated(null);
              onClose();
            }
          }}
        />
      )}
    </>
  );
}

function FieldInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', boxSizing: 'border-box' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EmployeeDetailPanel.tsx
git commit -m "feat: add EmployeeDetailPanel — edit/create employee with audit log tab and deactivate/delete actions"
```

---

## Task 11: AdminEmployeesPage + Route

**Files:**
- Create: `client/src/pages/AdminEmployeesPage.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create AdminEmployeesPage**

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmployeeListItem } from '@attendance/shared';
import { apiFetch } from '../api/client';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EmployeeDetailPanel } from '../components/EmployeeDetailPanel';

type RoleFilter = 'all' | 'applicant' | 'admin';
type StatusFilter = 'all' | 'active' | 'deactivated';

export function AdminEmployeesPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    apiFetch('/api/admin/employees')
      .then(r => r.json())
      .then(setEmployees);
  }, []);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name_ja.toLowerCase().includes(q) || e.name_en.toLowerCase().includes(q) || e.employee_number.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? e.is_active : !e.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  function openCreate() { setPanelMode('create'); setSelectedId(undefined); }
  function openView(id: string) { setPanelMode('view'); setSelectedId(id); }
  function closePanel() { setPanelMode(null); setSelectedId(undefined); }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.4em', color: '#111' }}>{t('employees.title')}</h1>
          <button
            onClick={openCreate}
            style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
          >
            + {t('employees.add')}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('employees.search_placeholder')}
            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em' }}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}>
            <option value="all">{t('employees.filter_role')}: {t('admin.all')}</option>
            <option value="applicant">{t('profile.roles.applicant')}</option>
            <option value="admin">{t('profile.roles.admin')}</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}>
            <option value="all">{t('employees.filter_status')}: {t('admin.all')}</option>
            <option value="active">{t('employees.status_active')}</option>
            <option value="deactivated">{t('employees.status_deactivated')}</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <Th>{t('employees.fields.employee_number')}</Th>
                <Th>{t('employees.fields.name_ja')}</Th>
                <Th>{t('employees.fields.name_en')}</Th>
                <Th>{t('employees.fields.email')}</Th>
                <Th>{t('employees.fields.role')}</Th>
                <Th>{t('employees.filter_status')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr
                  key={e.id}
                  onClick={() => openView(e.id)}
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}
                >
                  <Td>{e.employee_number}</Td>
                  <Td>{e.name_ja}</Td>
                  <Td>{e.name_en}</Td>
                  <Td>{e.email}</Td>
                  <Td>{t(`profile.roles.${e.role}`)}</Td>
                  <Td>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                      fontSize: '0.8em', fontWeight: 700,
                      background: e.is_active ? '#d1fae5' : '#f3f4f6',
                      color: e.is_active ? '#065f46' : '#6b7280',
                    }}>
                      {e.is_active ? t('employees.status_active') : t('employees.status_deactivated')}
                    </span>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    {t('dashboard.no_requests')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />

      {panelMode && (
        <EmployeeDetailPanel
          mode={panelMode}
          employeeId={selectedId}
          allUsers={employees}
          onClose={closePanel}
          onCreated={(emp) => setEmployees(prev => [...prev, emp])}
          onUpdated={(emp) => setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e))}
          onDeleted={(id) => setEmployees(prev => prev.filter(e => e.id !== id))}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 14px', color: '#374151' }}>{children}</td>;
}
```

- [ ] **Step 2: Add the route in App.tsx**

In `client/src/App.tsx`, add the import and the new route:

```tsx
import { AdminEmployeesPage } from './pages/AdminEmployeesPage';
```

And add inside `<Routes>` after the `/admin` route:

```tsx
<Route path="/admin/employees" element={<ProtectedRoute role="admin"><AdminEmployeesPage /></ProtectedRoute>} />
```

The updated `App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestFormPage } from './pages/RequestFormPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { AdminPage } from './pages/AdminPage';
import { AdminEmployeesPage } from './pages/AdminEmployeesPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute role="applicant"><DashboardPage /></ProtectedRoute>} />
      <Route path="/request/new" element={<ProtectedRoute role="applicant"><RequestFormPage /></ProtectedRoute>} />
      <Route path="/request/confirm" element={<ProtectedRoute role="applicant"><ConfirmPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/employees" element={<ProtectedRoute role="admin"><AdminEmployeesPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AdminEmployeesPage.tsx client/src/App.tsx
git commit -m "feat: add AdminEmployeesPage with list, search/filter, and routing at /admin/employees"
```

---

## Task 12: Navbar — Employee Management Link

**Files:**
- Modify: `client/src/components/Navbar.tsx`

- [ ] **Step 1: Add the Employee Management nav link**

In `client/src/components/Navbar.tsx`, in the nav links section, add after the existing admin link:

```tsx
{user?.role === 'admin' && (
  <NavItem onClick={() => go('/admin/employees')}>👥 {t('employees.title')}</NavItem>
)}
```

The updated nav links section looks like:

```tsx
{/* Nav links */}
<div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
  {user?.role === 'applicant' && (
    <NavItem onClick={() => go('/dashboard')}>📋 {t('nav.dashboard')}</NavItem>
  )}
  {user?.role === 'applicant' && (
    <NavItem onClick={() => go('/request/new')}>✏️ {t('nav.new_request')}</NavItem>
  )}
  {user?.role === 'admin' && (
    <NavItem onClick={() => go('/admin')}>📊 {t('nav.admin')}</NavItem>
  )}
  {user?.role === 'admin' && (
    <NavItem onClick={() => go('/admin/employees')}>👥 {t('employees.title')}</NavItem>
  )}
</div>
```

- [ ] **Step 2: Run full backend test suite to confirm no regressions**

```bash
cd server && NODE_ENV=test npm test
```

Expected: All tests pass.

- [ ] **Step 3: Build client to confirm TypeScript compilation**

```bash
npm run build -w client
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Navbar.tsx
git commit -m "feat: add Employee Management nav link for admins"
```

---

## Spec Coverage Self-Review

| Spec section | Tasks covering it |
|---|---|
| 2a. `is_active` column | Task 1 |
| 2b. `employee_audit_log` table + indexes | Task 1 |
| 3a. `GET /`, `GET /:id`, `PATCH /:id`, `POST /:id/managers`, `DELETE /:id/managers/:managerId` with audit | Tasks 4, 6 |
| 3b. `POST /` auto-generate password | Tasks 2, 6 |
| 3c. `POST /:id/reset-password` | Tasks 4, 6 |
| 3d. `PATCH /:id/deactivate` | Tasks 4, 6 |
| 3e. `PATCH /:id/reactivate` | Tasks 4, 6 |
| 3f. `DELETE /:id` (hard delete, snapshot, ON DELETE SET NULL) | Tasks 4, 6 |
| 3g. `GET /:id/audit-log` | Tasks 4, 6 |
| 3h. Auth login `is_active` check | Task 5 |
| 3i. `generateTempPassword` utility | Task 2 |
| 4. Shared types | Task 3 |
| 5a. List view with search/filter | Task 11 |
| 5b. Detail panel — Details + Audit Log tabs | Task 10 |
| 5c. Create panel | Task 10 |
| 5d. PasswordRevealModal | Task 9 |
| 6. Navbar link | Task 12 |
| 7. Translations (en + ja) | Task 8 |
| Tests | Tasks 2, 5, 7 |
