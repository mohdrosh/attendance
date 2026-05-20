# Email Notifications & Admin Employee CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual approval/rejection email notifications with an opt-in checkbox, single-manager selection on request submission, a success screen after submission, a result screen after admin action, an employee name column in the admin table, and a full admin CRUD API for managing employees/managers/train-lines.

**Architecture:** Notification message templates live in `shared/src/messageGenerator.ts` (two new exported functions). The admin PATCH route gains `sendNotification`/`rejectionReason` fields. The request POST route gains optional `managerId`. Employee CRUD lives in a new `server/src/routes/employees.ts` router mounted at `/api/admin/employees`. Frontend gets in-component state machines for success/result screens rather than new routes.

**Tech Stack:** TypeScript, Express, PostgreSQL (pg), bcryptjs, React 19, react-i18next, Vitest (shared/frontend), Jest+Supertest (backend).

---

## File Map

| Action | File |
|--------|------|
| Modify | `shared/src/types.ts` |
| Modify | `shared/src/messageGenerator.ts` |
| Modify | `shared/src/messageGenerator.test.ts` |
| Modify | `server/src/db/queries/admin.ts` |
| Modify | `server/src/routes/admin.ts` |
| Modify | `server/src/routes/admin.test.ts` |
| Modify | `server/src/routes/requests.ts` |
| Modify | `server/src/routes/requests.test.ts` |
| **Create** | `server/src/db/queries/employees.ts` |
| **Create** | `server/src/routes/employees.ts` |
| **Create** | `server/src/routes/employees.test.ts` |
| Modify | `server/src/app.ts` |
| Modify | `client/src/locales/en.json` |
| Modify | `client/src/locales/ja.json` |
| Modify | `client/src/pages/ConfirmPage.tsx` |
| Modify | `client/src/components/RequestDetailPanel.tsx` |
| Modify | `client/src/pages/AdminPage.tsx` |

---

## Task 1: Add notification types to shared

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Add the two new interfaces after `MessageOutput`**

Open `shared/src/types.ts` and append after the existing `MessageOutput` interface (after line 85):

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

- [ ] **Step 2: Verify TypeScript compiles in shared**

```bash
cd shared && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat(shared): add NotificationInput and RejectionNotificationInput types"
```

---

## Task 2: Add approval/rejection message generators + tests

**Files:**
- Modify: `shared/src/messageGenerator.ts`
- Modify: `shared/src/messageGenerator.test.ts`

- [ ] **Step 1: Write the failing tests first**

Add to the end of `shared/src/messageGenerator.test.ts`:

```ts
import { generateApprovalNotification, generateRejectionNotification } from './messageGenerator';

const baseNotif = {
  requestType: 'late' as const,
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
};

describe('generateApprovalNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【承認】 in japanese subject', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('【承認】');
  });

  it('includes [Approved] in english subject', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.english).toContain('[Approved]');
  });

  it('includes employee name in both languages', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('山田太郎');
    expect(result.english).toContain('Taro Yamada');
  });

  it('includes time range when provided', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('09:00');
    expect(result.english).toContain('10:00');
  });

  it('omits time when not provided', () => {
    const { timeFrom, timeTo, ...noTime } = baseNotif;
    const result = generateApprovalNotification(noTime);
    expect(result.japanese).not.toContain('時間');
    expect(result.english).not.toContain('Time:');
  });
});

describe('generateRejectionNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【否認】 in japanese subject', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toContain('【否認】');
  });

  it('includes [Not Approved] in english subject', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.english).toContain('[Not Approved]');
  });

  it('includes rejection reason when provided', () => {
    const result = generateRejectionNotification({ ...baseNotif, rejectionReason: 'Missing documentation' });
    expect(result.japanese).toContain('Missing documentation');
    expect(result.english).toContain('Missing documentation');
  });

  it('omits rejection reason line when not provided', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).not.toContain('理由：');
    expect(result.english).not.toContain('Reason:');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd shared && npm test
```
Expected: tests for `generateApprovalNotification` and `generateRejectionNotification` fail with "is not a function" or import errors.

- [ ] **Step 3: Implement the two generator functions**

Add the following to the end of `shared/src/messageGenerator.ts` (before the file ends, after `generateMessage`):

```ts
import type { NotificationInput, RejectionNotificationInput } from './types';

const requestTypeJa: Record<string, string> = {
  late: '遅刻',
  early_departure: '早退',
  absence: '欠勤',
  other_request: 'その他',
};

const requestTypeEn: Record<string, string> = {
  late: 'Late Arrival',
  early_departure: 'Early Departure',
  absence: 'Absence',
  other_request: 'Other Request',
};

export function generateApprovalNotification(input: NotificationInput): MessageOutput {
  const dateJa = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);
  const dateEn = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const timeJa = input.timeFrom
    ? `\n時間：${input.timeFrom}${input.timeTo ? ` 〜 ${input.timeTo}` : ''}`
    : '';
  const timeEn = input.timeFrom
    ? `\nTime: ${input.timeFrom}${input.timeTo ? ` – ${input.timeTo}` : ''}`
    : '';

  const japanese = [
    `件名：【承認】${input.employeeName.ja}　${dateJa}`,
    '',
    `${input.employeeName.ja} さん`,
    '',
    `申請種別：${requestTypeJa[input.requestType]}`,
    `申請日：${dateJa}${timeJa}`,
    '',
    'ご申請の内容を承認しました。',
  ].join('\n');

  const english = [
    `Subject: [Approved] ${input.employeeName.en} – ${dateEn}`,
    '',
    `Dear ${input.employeeName.en},`,
    '',
    `Type: ${requestTypeEn[input.requestType]}`,
    `Date: ${dateEn}${timeEn}`,
    '',
    'Your attendance request has been approved.',
  ].join('\n');

  return { japanese, english };
}

export function generateRejectionNotification(input: RejectionNotificationInput): MessageOutput {
  const dateJa = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);
  const dateEn = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const timeJa = input.timeFrom
    ? `\n時間：${input.timeFrom}${input.timeTo ? ` 〜 ${input.timeTo}` : ''}`
    : '';
  const timeEn = input.timeFrom
    ? `\nTime: ${input.timeFrom}${input.timeTo ? ` – ${input.timeTo}` : ''}`
    : '';

  const jaLines = [
    `件名：【否認】${input.employeeName.ja}　${dateJa}`,
    '',
    `${input.employeeName.ja} さん`,
    '',
    `申請種別：${requestTypeJa[input.requestType]}`,
    `申請日：${dateJa}${timeJa}`,
    '',
    '申し訳ありませんが、ご申請の内容を承認することができませんでした。',
  ];
  if (input.rejectionReason) {
    jaLines.push('', `理由：${input.rejectionReason}`);
  }
  jaLines.push('', '詳細については、担当者にお問い合わせください。');

  const enLines = [
    `Subject: [Not Approved] ${input.employeeName.en} – ${dateEn}`,
    '',
    `Dear ${input.employeeName.en},`,
    '',
    `Type: ${requestTypeEn[input.requestType]}`,
    `Date: ${dateEn}${timeEn}`,
    '',
    'We regret to inform you that your attendance request has not been approved.',
  ];
  if (input.rejectionReason) {
    enLines.push('', `Reason: ${input.rejectionReason}`);
  }
  enLines.push('', 'Please contact your manager for further details.');

  return {
    japanese: jaLines.join('\n'),
    english: enLines.join('\n'),
  };
}
```

Note: The import of `NotificationInput` and `RejectionNotificationInput` goes at the top of the file alongside the existing `import { MessageInput, MessageOutput } from './types';` — merge it into that line:
```ts
import { MessageInput, MessageOutput, NotificationInput, RejectionNotificationInput } from './types';
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd shared && npm test
```
Expected: all tests pass (13 existing + new notification tests).

- [ ] **Step 5: Rebuild shared dist**

```bash
cd shared && npm run build
```
Expected: exits 0, `dist/` updated.

- [ ] **Step 6: Commit**

```bash
git add shared/src/messageGenerator.ts shared/src/messageGenerator.test.ts
git commit -m "feat(shared): add generateApprovalNotification and generateRejectionNotification"
```

---

## Task 3: Update admin DB query to return employee details

**Files:**
- Modify: `server/src/db/queries/admin.ts`

- [ ] **Step 1: Replace `updateRequestStatus` with a JOIN version and remove `getEmployeeEmailById`**

In `server/src/db/queries/admin.ts`, replace the `updateRequestStatus` function (lines 60–71) and `getEmployeeEmailById` function (lines 73–76) with this single updated function:

```ts
export async function updateRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<{
  employee_id: string;
  name_ja: string;
  name_en: string;
  email: string;
  request_type: string;
  start_date: string;
  end_date: string | null;
  time_from: string | null;
  time_to: string | null;
} | undefined> {
  const { rows } = await pool.query(
    `UPDATE requests
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     FROM users
     WHERE requests.id = $3 AND users.id = requests.employee_id
     RETURNING requests.employee_id, requests.request_type, requests.start_date,
               requests.end_date, requests.time_from, requests.time_to,
               users.name_ja, users.name_en, users.email`,
    [status, reviewedBy, requestId]
  );
  return rows[0];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors. (The admin route will show an error until Task 4 is complete — that's fine; fix it in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add server/src/db/queries/admin.ts
git commit -m "feat(server): updateRequestStatus returns employee details via JOIN, remove getEmployeeEmailById"
```

---

## Task 4: Update admin route for conditional notifications + tests

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/routes/admin.test.ts`

- [ ] **Step 1: Write the updated tests first**

Replace the content of `server/src/routes/admin.test.ts` with:

```ts
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

jest.mock('../services/email/NodemailerService', () => ({
  emailService: { send: jest.fn().mockResolvedValue(undefined) },
}));

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
    .field('reasonCategory', 'oversleeping')
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

describe('PATCH /api/admin/requests/:id/status', () => {
  it('approves a request and updates status in DB', async () => {
    const res = await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].status).toBe('approved');
  });

  it('does not send email when sendNotification is not set', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected' });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('does not send email when sendNotification is false', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', sendNotification: false });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('sends bilingual rejection email to employee when sendNotification is true', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', sendNotification: true, rejectionReason: 'Missing docs' });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['emp@test.com'],
        subject: expect.stringContaining('【否認】'),
      })
    );
    const callArg = (emailService.send as jest.Mock).mock.calls[0][0];
    expect(callArg.body).toContain('Missing docs');
  });

  it('sends bilingual approval email to employee when sendNotification is true', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', sendNotification: true });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['emp@test.com'],
        subject: expect.stringContaining('【承認】'),
      })
    );
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```
Expected: the new notification tests fail (old logic always sends email on rejection).

- [ ] **Step 3: Rewrite the admin route**

Replace the full content of `server/src/routes/admin.ts` with:

```ts
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, updateRequestStatus } from '../db/queries/admin';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { RequestType, RequestStatus, generateApprovalNotification, generateRejectionNotification } from '@attendance/shared';

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

adminRouter.patch('/requests/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { status, rejectionReason, sendNotification } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      throw new AppError(400, 'status must be "approved" or "rejected"');
    }

    const result = await updateRequestStatus(req.params.id, status, req.user!.id);
    if (!result) throw new AppError(404, 'Request not found');

    if (sendNotification === true) {
      const notifInput = {
        requestType: result.request_type as RequestType,
        startDate: result.start_date,
        endDate: result.end_date ?? undefined,
        timeFrom: result.time_from ?? undefined,
        timeTo: result.time_to ?? undefined,
        employeeName: { ja: result.name_ja, en: result.name_en },
      };

      const { japanese, english } = status === 'approved'
        ? generateApprovalNotification(notifInput)
        : generateRejectionNotification({ ...notifInput, rejectionReason: rejectionReason ?? undefined });

      const body = english ? `[English]\n${english}\n\n[日本語]\n${japanese}` : japanese;
      const subjectPrefix = status === 'approved' ? '【承認】' : '【否認】';

      await emailService.send({
        to: [result.email],
        subject: `${subjectPrefix}${result.name_ja} ${result.start_date}`,
        body,
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```
Expected: all admin tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat(server): conditional approval/rejection email notifications via sendNotification flag"
```

---

## Task 5: Update request submission to use single selected manager

**Files:**
- Modify: `server/src/routes/requests.ts`
- Modify: `server/src/routes/requests.test.ts`

- [ ] **Step 1: Write the new tests**

Add the following two tests to the `describe('POST /api/requests')` block in `server/src/routes/requests.test.ts`:

```ts
  it('sends email to selected manager when managerId is provided', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();

    const hash = await bcrypt.hash('Test1234!', 10);
    const { rows: [manager] } = await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
       VALUES ('MGR-001', '田中部長', 'Manager Tanaka', 'mgr@test.com', $1, 'admin') RETURNING id`,
      [hash]
    );
    const { rows: [emp] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'EMP-001'`);
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [emp.id, manager.id]
    );

    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'oversleeping')
      .field('inputLanguage', 'ja')
      .field('managerId', manager.id);

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['mgr@test.com'] })
    );
  });

  it('does not send email when managerId is not provided', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();

    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'oversleeping')
      .field('inputLanguage', 'ja');

    expect(emailService.send).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=requests
```
Expected: the two new tests fail (current code always tries to send to all managers, not filtering by managerId).

- [ ] **Step 3: Update the POST /api/requests handler**

In `server/src/routes/requests.ts`, replace the email-sending section (the block starting `const user = await getUserWithTrainLines` through the `emailService.send` call at the end of the handler, lines 76–98) with:

```ts
    const user = await getUserWithTrainLines(req.user!.id);

    if (managerId && user) {
      const managers = await getManagersByEmployeeId(req.user!.id);
      const selectedManager = managers.find(m => m.id === managerId);
      if (!selectedManager) throw new AppError(400, 'Invalid managerId');

      const trainLine = user.trainLines.find(l => l.id === trainLineId);
      const msgInput = {
        requestType, reasonCategory, reasonDetail, trainLineName: trainLine?.line_name_ja,
        startDate, endDate, timeFrom, timeTo, leaveType, adminMessage,
        employeeName: { ja: user.name_ja, en: user.name_en },
        inputLanguage,
      };
      const { japanese, english } = generateMessage(msgInput);
      const body = english ? `[English]\n${english}\n\n[日本語]\n${japanese}` : japanese;
      const subjects: Record<string, string> = {
        late: '【遅刻連絡】', early_departure: '【早退連絡】',
        absence: '【欠勤連絡】', other_request: '【その他連絡】',
      };
      await emailService.send({
        to: [selectedManager.email],
        subject: `${subjects[requestType]}${user.name_ja} ${startDate}`,
        body,
      });
    }
```

Also add `managerId` to the destructured `req.body` at the top of the handler:
```ts
    const {
      requestType, startDate, endDate, timeFrom, timeTo,
      reasonCategory, reasonDetail, trainLineId, leaveType,
      adminMessage, inputLanguage, managerId,
    } = req.body;
```

- [ ] **Step 4: Run all request tests to confirm they pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=requests
```
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/requests.ts server/src/routes/requests.test.ts
git commit -m "feat(server): send email only to selected manager via managerId field"
```

---

## Task 6: Create employee CRUD DB queries

**Files:**
- Create: `server/src/db/queries/employees.ts`

- [ ] **Step 1: Create the file**

Create `server/src/db/queries/employees.ts` with this content:

```ts
import bcrypt from 'bcryptjs';
import { pool } from '../pool';
import type { UserRole } from '@attendance/shared';

export interface CreateEmployeeData {
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateEmployeeData {
  name_ja?: string;
  name_en?: string;
  email?: string;
  role?: UserRole;
  work_start?: string;
  work_end?: string;
}

export async function createEmployee(data: CreateEmployeeData): Promise<string> {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.employee_number, data.name_ja, data.name_en, data.email, passwordHash, data.role]
  );
  return rows[0].id as string;
}

export async function listEmployees() {
  const { rows } = await pool.query(
    `SELECT id, employee_number, name_ja, name_en, email, role
     FROM users ORDER BY name_ja`
  );
  return rows;
}

export async function getEmployeeById(id: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role,
            u.work_start, u.work_end,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', t.id, 'line_name_ja', t.line_name_ja, 'line_name_en', t.line_name_en
              )) FILTER (WHERE t.id IS NOT NULL), '[]'
            ) AS train_lines,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', m.id, 'name_ja', m.name_ja, 'name_en', m.name_en, 'email', m.email
              )) FILTER (WHERE m.id IS NOT NULL), '[]'
            ) AS managers
     FROM users u
     LEFT JOIN train_lines t ON t.employee_id = u.id
     LEFT JOIN employee_managers em ON em.employee_id = u.id
     LEFT JOIN users m ON m.id = em.manager_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );
  return rows[0] as Record<string, unknown> | undefined;
}

export async function updateEmployee(id: string, data: UpdateEmployeeData): Promise<void> {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) => v);
  await pool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [id, ...values]);
}

export async function assignManager(employeeId: string, managerId: string): Promise<void> {
  await pool.query(
    `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [employeeId, managerId]
  );
}

export async function removeManager(employeeId: string, managerId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM employee_managers WHERE employee_id = $1 AND manager_id = $2`,
    [employeeId, managerId]
  );
  return rowCount ?? 0;
}

export async function addTrainLine(
  employeeId: string,
  data: { line_name_ja: string; line_name_en: string }
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO train_lines (employee_id, line_name_ja, line_name_en) VALUES ($1, $2, $3) RETURNING id`,
    [employeeId, data.line_name_ja, data.line_name_en]
  );
  return rows[0].id as string;
}

export async function removeTrainLine(lineId: string): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM train_lines WHERE id = $1`, [lineId]);
  return rowCount ?? 0;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/queries/employees.ts
git commit -m "feat(server): add employee CRUD DB query functions"
```

---

## Task 7: Create employee CRUD router, tests, and mount it

**Files:**
- Create: `server/src/routes/employees.ts`
- Create: `server/src/routes/employees.test.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Write the tests first**

Create `server/src/routes/employees.test.ts`:

```ts
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let employeeId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
    [hash]
  );
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
  it('creates a new employee and returns id', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employee_number: 'EMP-002',
        name_ja: '新入社員',
        name_en: 'New Employee',
        email: 'new@test.com',
        password: 'Pass1234!',
        role: 'applicant',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com', role: 'applicant' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password fails validation', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com', password: 'weak', role: 'applicant' });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate employee_number', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-001', name_ja: '別', name_en: 'Other', email: 'other@test.com', password: 'Pass1234!', role: 'applicant' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/employees', () => {
  it('returns list of all employees', async () => {
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/admin/employees/:id', () => {
  it('returns employee with train_lines and managers arrays', async () => {
    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
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
  it('updates employee name_en', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Name' });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.name_en).toBe('Updated Name');
  });
});

describe('POST /api/admin/employees/:id/managers', () => {
  it('assigns a manager to the employee', async () => {
    const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADM-001'`);
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: admin.id });
    expect(res.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.managers).toHaveLength(1);
    expect(getRes.body.managers[0].id).toBe(admin.id);
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
  it('removes a manager assignment', async () => {
    const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADM-001'`);
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [employeeId, admin.id]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when assignment does not exist', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/train-lines', () => {
  it('adds a train line to an employee', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/train-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ line_name_ja: '山手線', line_name_en: 'Yamanote Line' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when line names are missing', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/train-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ line_name_ja: '山手線' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/employees/:id/train-lines/:lineId', () => {
  it('removes a train line', async () => {
    const { rows: [line] } = await pool.query(
      `INSERT INTO train_lines (employee_id, line_name_ja, line_name_en) VALUES ($1, '中央線', 'Chuo Line') RETURNING id`,
      [employeeId]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/train-lines/${line.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent train line', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/train-lines/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=employees
```
Expected: all tests fail (router not created yet).

- [ ] **Step 3: Create the employees router**

Create `server/src/routes/employees.ts`:

```ts
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import {
  createEmployee, listEmployees, getEmployeeById, updateEmployee,
  assignManager, removeManager, addTrainLine, removeTrainLine,
} from '../db/queries/employees';

export const employeesRouter = Router();
employeesRouter.use(authMiddleware);
employeesRouter.use(requireRole('admin'));

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

employeesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, password, role } = req.body;
    if (!employee_number || !name_ja || !name_en || !email || !password || !role) {
      throw new AppError(400, 'Missing required fields');
    }
    if (!validatePassword(password)) {
      throw new AppError(400, 'Password must be at least 8 characters with one uppercase letter, one digit, and one special character');
    }
    const id = await createEmployee({ employee_number, name_ja, name_en, email, password, role });
    res.status(201).json({ id });
  } catch (err: any) {
    if (err.code === '23505') return next(new AppError(409, 'employee_number or email already exists'));
    next(err);
  }
});

employeesRouter.get('/', async (_req: AuthRequest, res: Response, next) => {
  try {
    res.json(await listEmployees());
  } catch (err) { next(err); }
});

employeesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(employee);
  } catch (err) { next(err); }
});

employeesRouter.patch('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name_ja, name_en, email, role, work_start, work_end } = req.body;
    await updateEmployee(req.params.id, { name_ja, name_en, email, role, work_start, work_end });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

employeesRouter.post('/:id/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const { managerId } = req.body;
    if (!managerId) throw new AppError(400, 'managerId is required');
    const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [managerId]);
    if (!rows[0]) throw new AppError(404, 'Manager not found');
    await assignManager(req.params.id, managerId);
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

employeesRouter.delete('/:id/managers/:managerId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeManager(req.params.id, req.params.managerId);
    if (count === 0) throw new AppError(404, 'Manager assignment not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

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

- [ ] **Step 4: Mount the router in `server/src/app.ts`**

Add the import and `app.use` call to `server/src/app.ts`:

```ts
// Add this import alongside the others:
import { employeesRouter } from './routes/employees';

// Add this line after app.use('/api/admin', adminRouter):
app.use('/api/admin/employees', employeesRouter);
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=employees
```
Expected: all employee CRUD tests pass.

- [ ] **Step 6: Run the full backend test suite to confirm no regressions**

```bash
cd server && NODE_ENV=test npm test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/employees.ts server/src/routes/employees.test.ts server/src/db/queries/employees.ts server/src/app.ts
git commit -m "feat(server): add admin employee CRUD API with manager and train-line management"
```

---

## Task 8: Add i18n strings

**Files:**
- Modify: `client/src/locales/en.json`
- Modify: `client/src/locales/ja.json`

- [ ] **Step 1: Add strings to `en.json`**

In `client/src/locales/en.json`:

1. Replace the `"confirm"` object with:
```json
"confirm": {
  "title": "Confirm Request",
  "summary": "Request Summary",
  "message_preview": "Notification Message",
  "recipients": "Send To",
  "select_manager": "Select a manager…",
  "back": "Back to Edit",
  "send": "Send",
  "submitted_title": "Request Submitted",
  "submitted_message": "Your attendance request has been sent to your manager, {{name}}.",
  "back_to_dashboard": "Back to Dashboard"
},
```

2. Replace the `"detail_panel"` object with:
```json
"detail_panel": {
  "title": "Request Detail",
  "approve": "Approve",
  "reject": "Reject",
  "attachment": "Attachment",
  "download": "Download",
  "admin_message": "Message from employee",
  "send_notification": "Send notification email to employee",
  "rejection_reason_placeholder": "Rejection reason (optional)",
  "approved_title": "Request Approved",
  "rejected_title": "Request Rejected",
  "close": "Close"
},
```

3. In the `"admin"` > `"columns"` object, add `"employee_name_en": "Name (EN)"` after `"name"`:
```json
"columns": {
  "name": "Name",
  "employee_name_en": "Name (EN)",
  "employee_number": "Emp. No.",
  "date": "Date",
  "type": "Type",
  "reason": "Reason",
  "leave_type": "Leave Type",
  "submitted": "Submitted",
  "status": "Status"
}
```

- [ ] **Step 2: Add strings to `ja.json`**

In `client/src/locales/ja.json`:

1. Replace the `"confirm"` object with:
```json
"confirm": {
  "title": "申請内容確認",
  "summary": "申請内容",
  "message_preview": "通知メッセージ",
  "recipients": "送信先",
  "select_manager": "担当者を選択してください",
  "back": "修正する",
  "send": "送信する",
  "submitted_title": "申請が完了しました",
  "submitted_message": "{{name}} に申請を送信しました。",
  "back_to_dashboard": "ダッシュボードへ"
},
```

2. Replace the `"detail_panel"` object with:
```json
"detail_panel": {
  "title": "申請詳細",
  "approve": "承認",
  "reject": "却下",
  "attachment": "添付ファイル",
  "download": "ダウンロード",
  "admin_message": "管理者へのメッセージ",
  "send_notification": "申請者にメール通知を送る",
  "rejection_reason_placeholder": "却下理由（任意）",
  "approved_title": "承認しました",
  "rejected_title": "却下しました",
  "close": "閉じる"
},
```

3. In the `"admin"` > `"columns"` object, add `"employee_name_en": "氏名（英語）"` after `"name"`:
```json
"columns": {
  "name": "氏名",
  "employee_name_en": "氏名（英語）",
  "employee_number": "社員番号",
  "date": "日付",
  "type": "申請種別",
  "reason": "理由",
  "leave_type": "休暇種別",
  "submitted": "申請日",
  "status": "ステータス"
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/locales/en.json client/src/locales/ja.json
git commit -m "feat(client): add i18n strings for manager select, success/result screens, employee name column"
```

---

## Task 9: Update ConfirmPage — manager dropdown + success screen

**Files:**
- Modify: `client/src/pages/ConfirmPage.tsx`

- [ ] **Step 1: Replace the full file content**

Replace `client/src/pages/ConfirmPage.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateMessage } from '@attendance/shared';
import type { Manager } from '@attendance/shared';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiFetch } from '../api/client';

export function ConfirmPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { form, user } = location.state ?? {};

  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedManagerName, setSubmittedManagerName] = useState('');

  useEffect(() => {
    apiFetch('/api/users/me/managers')
      .then(res => res.json())
      .then((data: Manager[]) => {
        setManagers(data);
        if (data.length === 1) setSelectedManagerId(data[0].id);
      });
  }, []);

  if (!form || !user) {
    navigate('/request/new');
    return null;
  }

  const trainLine = user.trainLines.find((l: { id: string }) => l.id === form.trainLineId);
  const trainLineName = i18n.language === 'ja' ? trainLine?.line_name_ja : trainLine?.line_name_en;

  const { japanese, english } = generateMessage({
    requestType: form.requestType,
    reasonCategory: form.reasonCategory,
    reasonDetail: form.reasonDetail || undefined,
    trainLineName,
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    timeFrom: form.timeFrom || undefined,
    timeTo: form.timeTo || undefined,
    leaveType: form.leaveType || undefined,
    adminMessage: form.adminMessage || undefined,
    employeeName: { ja: user.name_ja, en: user.name_en },
    inputLanguage: form.inputLanguage,
  });

  async function handleSend() {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('requestType', form.requestType);
      formData.append('startDate', form.startDate);
      if (form.endDate) formData.append('endDate', form.endDate);
      if (form.timeFrom) formData.append('timeFrom', form.timeFrom);
      if (form.timeTo) formData.append('timeTo', form.timeTo);
      formData.append('reasonCategory', form.reasonCategory);
      if (form.reasonDetail) formData.append('reasonDetail', form.reasonDetail);
      if (form.trainLineId) formData.append('trainLineId', form.trainLineId);
      if (form.leaveType) formData.append('leaveType', form.leaveType);
      if (form.adminMessage) formData.append('adminMessage', form.adminMessage);
      formData.append('inputLanguage', form.inputLanguage);
      if (form.file) formData.append('file', form.file);
      if (selectedManagerId) formData.append('managerId', selectedManagerId);

      const res = await apiFetch('/api/requests', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to submit');

      const manager = managers.find(m => m.id === selectedManagerId);
      const name = manager
        ? (i18n.language === 'ja' ? manager.name_ja : manager.name_en)
        : '';
      setSubmittedManagerName(name);
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
        }}>
          <div style={{ fontSize: '3.5em', color: '#10b981', marginBottom: '16px', lineHeight: 1 }}>✓</div>
          <h1 style={{ fontSize: '1.35em', fontWeight: 700, color: '#111', marginBottom: '10px', textAlign: 'center' }}>
            {t('confirm.submitted_title')}
          </h1>
          <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '28px', maxWidth: '380px', lineHeight: 1.6 }}>
            {t('confirm.submitted_message', { name: submittedManagerName })}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '11px 32px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95em' }}
          >
            {t('confirm.back_to_dashboard')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const canSubmit = !sending && (managers.length === 0 || !!selectedManagerId);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '1.4em', marginBottom: '24px', color: '#111' }}>{t('confirm.title')}</h1>

        <section style={{ marginBottom: '16px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('confirm.summary')}</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '10px', fontSize: '0.9em' }}>
            <dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.request_type')}</dt><dd style={{ color: '#111' }}>{t(`request_type.${form.requestType}`)}</dd>
            <dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.date')}</dt><dd style={{ color: '#111' }}>{form.startDate}{form.endDate ? ` – ${form.endDate}` : ''}</dd>
            {form.reasonCategory && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.reason')}</dt><dd style={{ color: '#111' }}>{t(`form.reasons.${form.reasonCategory}`)}</dd></>}
            {form.reasonDetail && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.reason_detail')}</dt><dd style={{ color: '#111' }}>{form.reasonDetail}</dd></>}
            {form.leaveType && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.leave_type')}</dt><dd style={{ color: '#111' }}>{t(`form.leave_types.${form.leaveType}`)}</dd></>}
            {form.adminMessage && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('detail_panel.admin_message')}</dt><dd style={{ color: '#111' }}>{form.adminMessage}</dd></>}
            {form.file && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>File</dt><dd style={{ color: '#111' }}>📎 {form.file.name}</dd></>}
          </dl>
        </section>

        <section style={{ marginBottom: '16px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('confirm.message_preview')}</h2>
          {english && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>[English]</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88em', color: '#374151', background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: 0 }}>{english}</pre>
            </div>
          )}
          <div>
            {english && <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>[日本語]</div>}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88em', color: '#374151', background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: 0 }}>{japanese}</pre>
          </div>
        </section>

        <section style={{ marginBottom: '24px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('confirm.recipients')}</h2>
          {managers.length === 0 ? (
            <span style={{ fontSize: '0.9em', color: '#9ca3af' }}>No managers assigned</span>
          ) : (
            <select
              value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white', color: selectedManagerId ? '#111' : '#9ca3af', cursor: 'pointer' }}
            >
              <option value="">{t('confirm.select_manager')}</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.name_ja} / {m.name_en}</option>
              ))}
            </select>
          )}
        </section>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/request/new', { state: { form } })}
            style={{ padding: '11px 24px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '0.95em', color: '#374151' }}
          >
            {t('confirm.back')}
          </button>
          <button
            onClick={handleSend}
            disabled={!canSubmit}
            style={{ flex: 1, padding: '11px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: canSubmit ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.95em', opacity: canSubmit ? 1 : 0.5 }}
          >
            {sending ? '…' : t('confirm.send')}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ConfirmPage.tsx
git commit -m "feat(client): manager single-select dropdown and success screen on ConfirmPage"
```

---

## Task 10: Update RequestDetailPanel (notification UI + result screen) and AdminPage (employee name column + refetch on close)

**Files:**
- Modify: `client/src/components/RequestDetailPanel.tsx`
- Modify: `client/src/pages/AdminPage.tsx`

- [ ] **Step 1: Replace RequestDetailPanel.tsx**

Replace the full content of `client/src/components/RequestDetailPanel.tsx` with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Request as AttendanceRequest, RequestStatus } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}

export function RequestDetailPanel({ request, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [sendNotification, setSendNotification] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);

  if (!request) return null;

  async function handleAction(status: 'approved' | 'rejected') {
    if (!request) return;
    setLoading(status === 'approved' ? 'approve' : 'reject');
    try {
      const res = await apiFetch(`/api/admin/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          sendNotification,
          ...(sendNotification && status === 'rejected' && rejectionReason ? { rejectionReason } : {}),
        }),
      });
      if (res.ok) {
        onStatusChange(request.id, status);
        setResult(status);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh',
        background: 'white', boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ fontSize: '1.05em', fontWeight: 700, color: '#111' }}>{t('detail_panel.title')}</h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
        </div>

        {result ? (
          /* Result screen */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 24px' }}>
            <div style={{ fontSize: '3em', lineHeight: 1, color: result === 'approved' ? '#10b981' : '#ef4444' }}>
              {result === 'approved' ? '✓' : '✗'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1em', color: result === 'approved' ? '#065f46' : '#991b1b', textAlign: 'center' }}>
              {result === 'approved' ? t('detail_panel.approved_title') : t('detail_panel.rejected_title')}
            </div>
            <button
              onClick={onClose}
              style={{ padding: '10px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
            >
              {t('detail_panel.close')}
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
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
                <Field label={t('admin.columns.reason')}>
                  {t(`form.reasons.${request.reason_category}`)}
                </Field>
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
                <Field label={t('admin.columns.status')}>
                  <StatusBadge status={request.status} label={t(`status.${request.status}`)} />
                </Field>
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

            {/* Action area */}
            {request.status === 'pending' && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.86em', color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={e => setSendNotification(e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  {t('detail_panel.send_notification')}
                </label>
                {sendNotification && (
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder={t('detail_panel.rejection_reason_placeholder')}
                    style={{ width: '100%', minHeight: '68px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.86em', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px', fontFamily: 'inherit' }}
                  />
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleAction('approved')}
                    disabled={!!loading}
                    style={{ flex: 1, padding: '11px', background: '#065f46', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                  >
                    {loading === 'approve' ? '…' : t('detail_panel.approve')}
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={!!loading}
                    style={{ flex: 1, padding: '11px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                  >
                    {loading === 'reject' ? '…' : t('detail_panel.reject')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  pending:  { color: '#92400e', bg: '#fef3c7' },
  approved: { color: '#065f46', bg: '#d1fae5' },
  rejected: { color: '#991b1b', bg: '#fee2e2' },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLES[status] ?? { color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.78em', fontWeight: 700, color: s.color, background: s.bg }}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Update AdminPage — employee name column + refetch on close**

In `client/src/pages/AdminPage.tsx` make two changes:

**Change 1** — update `onClose` to also call `fetchRequests` (line 224 area):

```tsx
<RequestDetailPanel
  request={selected}
  onClose={() => { setSelected(null); fetchRequests(); }}
  onStatusChange={handleStatusChange}
/>
```

**Change 2** — update the table header array and the name cell to show both JA and EN names.

Replace the table header array (line ~183):
```tsx
{['name', 'employee_number', 'date', 'type', 'reason', 'submitted', 'status'].map(col => (
```
with:
```tsx
{['name', 'employee_name_en', 'employee_number', 'date', 'type', 'reason', 'submitted', 'status'].map(col => (
```

Replace the first `<td>` in the row (the one rendering `r.employee_name_ja`, line ~198):
```tsx
<td style={{ padding: '12px 14px', fontSize: '0.9em', fontWeight: 500 }}>{r.employee_name_ja}</td>
```
with:
```tsx
<td style={{ padding: '12px 14px' }}>
  <div style={{ fontSize: '0.9em', fontWeight: 500 }}>{r.employee_name_ja}</div>
  <div style={{ fontSize: '0.78em', color: '#9ca3af', marginTop: '2px' }}>{r.employee_name_en}</div>
</td>
```

Add a new `<td>` right after the name cell (between the name cell and the employee_number cell) for the EN name column — but since we added `employee_name_en` to the header and the name cell already shows EN on the second line, instead render an empty cell or combine. Actually, since both names are in one cell, remove `employee_name_en` from the header array and keep just the combined name cell. Update the header back to the original plus an implicit second-line in the name cell:

The cleanest approach: keep the header array as `['name', 'employee_number', ...]` (no change to headers), and just update the name `<td>` to show both lines:

```tsx
{['name', 'employee_number', 'date', 'type', 'reason', 'submitted', 'status'].map(col => (
  <th key={col} ...>{t(`admin.columns.${col}`)}</th>
))}
```

And the name cell:
```tsx
<td style={{ padding: '12px 14px' }}>
  <div style={{ fontSize: '0.9em', fontWeight: 500 }}>{r.employee_name_ja}</div>
  <div style={{ fontSize: '0.78em', color: '#9ca3af', marginTop: '2px' }}>{r.employee_name_en}</div>
</td>
```

This shows both names in the existing Name column without adding an extra column.

- [ ] **Step 3: Run the frontend type check**

```bash
cd client && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run the frontend tests**

```bash
cd client && npx vitest run
```
Expected: all 3 existing frontend tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/RequestDetailPanel.tsx client/src/pages/AdminPage.tsx
git commit -m "feat(client): add notification checkbox and result screen to admin panel; show EN name in admin table"
```

---

## Task 11: Full integration smoke test

- [ ] **Step 1: Run the full backend test suite**

```bash
cd server && NODE_ENV=test npm test
```
Expected: all tests pass (original 20 + new employee/notification tests).

- [ ] **Step 2: Run the full frontend test suite**

```bash
cd client && npx vitest run
```
Expected: all frontend tests pass.

- [ ] **Step 3: Run shared tests**

```bash
cd shared && npm test
```
Expected: all shared tests pass (original 13 + new notification tests).

- [ ] **Step 4: Start the dev server and verify manually**

```bash
npm run dev
```

Open http://localhost:5173 and verify:
1. Log in as employee (EMP-001 / Emp1234!) → go to New Request → fill form → Next
2. On Confirm page: a "Send To" section shows a dropdown with managers (if any assigned)
3. Submit → success screen shows with manager name and "Back to Dashboard" button
4. Log in as admin (ADMIN-001 / Admin1234!) → click a pending request
5. Panel shows: "Send notification email to employee" checkbox (unchecked by default)
6. Check the box → textarea appears for rejection reason
7. Approve or reject → result screen shows with ✓ or ✗ and Close button
8. Close → panel closes, table row status badge updates
9. Admin table Name column shows JA name on first line, EN name on second line

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete email notifications and admin employee CRUD implementation"
```

---

## Summary of Changes

| Area | What changed |
|------|-------------|
| `shared/types.ts` | `NotificationInput`, `RejectionNotificationInput` |
| `shared/messageGenerator.ts` | `generateApprovalNotification`, `generateRejectionNotification` |
| `server/db/queries/admin.ts` | `updateRequestStatus` JOINs users, returns name/email/request fields |
| `server/routes/admin.ts` | Conditional email via `sendNotification` flag; uses new generators |
| `server/routes/requests.ts` | Sends email only to `managerId`-selected manager |
| `server/db/queries/employees.ts` | New: full employee CRUD DB functions |
| `server/routes/employees.ts` | New: `POST/GET/PATCH /employees`, manager/train-line sub-routes |
| `server/app.ts` | Mounts employees router at `/api/admin/employees` |
| `client/locales/en.json` + `ja.json` | New keys for confirm flow, panel result, notification checkbox |
| `client/pages/ConfirmPage.tsx` | Manager dropdown, sends `managerId`, success screen |
| `client/components/RequestDetailPanel.tsx` | Notification checkbox, rejection reason textarea, result screen |
| `client/pages/AdminPage.tsx` | `onClose` triggers refetch; name cell shows both JA + EN |
