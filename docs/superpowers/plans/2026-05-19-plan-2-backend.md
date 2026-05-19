# Attendance System — Plan 2: Backend API

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Express REST API — auth, user, requests (with file upload), admin, attachments, email service, and cleanup job.

**Architecture:** Express app with route-level middleware for auth/role checks. All DB access via typed query helpers in `server/src/db/queries/`. Email abstracted behind `EmailService` interface. File uploads handled by multer. All endpoints tested with Supertest against the real test PostgreSQL database.

**Tech Stack:** Express, PostgreSQL (pg), JWT (jsonwebtoken), bcryptjs, multer, Nodemailer, node-cron, Jest + Supertest

**Pre-requisite:** Plan 1 must be complete. Both databases must be migrated and seeded.

---

## Task 7: Express App Foundation

**Files:**
- Create: `server/src/index.ts`
- Create: `server/src/app.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/src/middleware/authMiddleware.ts`
- Create: `server/src/middleware/roleMiddleware.ts`

- [ ] **Step 1: Create `server/src/middleware/errorHandler.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
```

- [ ] **Step 2: Create `server/src/middleware/authMiddleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@attendance/shared';

export interface AuthRequest extends Request {
  user?: { id: string; role: UserRole };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: string; role: UserRole };
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 3: Create `server/src/middleware/roleMiddleware.ts`**

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { UserRole } from '@attendance/shared';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

- [ ] **Step 4: Create `server/src/app.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { requestRouter } from './routes/requests';
import { adminRouter } from './routes/admin';
import { attachmentRouter } from './routes/attachments';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/requests', requestRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/attachments', attachmentRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 5: Create `server/src/index.ts`**

```typescript
import { createApp } from './app';
import { config } from './config';
import { startCleanupJob } from './services/cleanupJob';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  startCleanupJob();
});
```

- [ ] **Step 6: Create Jest config `server/jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  globals: {
    'ts-jest': { tsconfig: { strict: true } }
  }
};
```

- [ ] **Step 7: Create test helper `server/src/db/testHelpers.ts`**

```typescript
import { pool } from './pool';

export async function clearDatabase() {
  await pool.query(`
    TRUNCATE TABLE attachments, requests, employee_managers, train_lines, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

export async function closePool() {
  await pool.end();
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add express app foundation with auth/role middleware"
```

---

## Task 8: Auth Routes

**Files:**
- Create: `server/src/db/queries/users.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/auth.test.ts`

- [ ] **Step 1: Create `server/src/db/queries/users.ts`**

```typescript
import { pool } from '../pool';
import { UserRole, TrainLine, UserProfile } from '@attendance/shared';

export async function findUserByEmployeeNumber(employeeNumber: string) {
  const { rows } = await pool.query(
    `SELECT id, employee_number, name_ja, name_en, email, password_hash, role
     FROM users WHERE employee_number = $1`,
    [employeeNumber]
  );
  return rows[0] as { id: string; employee_number: string; name_ja: string; name_en: string; email: string; password_hash: string; role: UserRole } | undefined;
}

export async function getUserWithTrainLines(userId: string): Promise<UserProfile | undefined> {
  const { rows } = await pool.query(
    `SELECT u.id, u.employee_number, u.name_ja, u.name_en, u.email, u.role,
            COALESCE(
              json_agg(json_build_object('id', t.id, 'line_name_ja', t.line_name_ja, 'line_name_en', t.line_name_en))
              FILTER (WHERE t.id IS NOT NULL), '[]'
            ) AS train_lines
     FROM users u
     LEFT JOIN train_lines t ON t.employee_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  if (!rows[0]) return undefined;
  const row = rows[0];
  return {
    id: row.id,
    employee_number: row.employee_number,
    name_ja: row.name_ja,
    name_en: row.name_en,
    email: row.email,
    role: row.role,
    trainLines: row.train_lines as TrainLine[],
  };
}

export async function saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function findAndDeleteRefreshToken(tokenHash: string) {
  const { rows } = await pool.query(
    `DELETE FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id`,
    [tokenHash]
  );
  return rows[0] as { user_id: string } | undefined;
}

export async function getManagersByEmployeeId(employeeId: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name_ja, u.name_en, u.email
     FROM users u
     INNER JOIN employee_managers em ON em.manager_id = u.id
     WHERE em.employee_id = $1`,
    [employeeId]
  );
  return rows as { id: string; name_ja: string; name_en: string; email: string }[];
}
```

- [ ] **Step 2: Create `server/src/routes/auth.ts`**

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { findUserByEmployeeNumber, getUserWithTrainLines, saveRefreshToken, findAndDeleteRefreshToken } from '../db/queries/users';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function generateAccessToken(userId: string, role: string) {
  return jwt.sign({ id: userId, role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { employee_number, password } = req.body;
    if (!employee_number || !password) throw new AppError(400, 'employee_number and password required');

    const user = await findUserByEmployeeNumber(employee_number);
    if (!user) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

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

authRouter.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) throw new AppError(401, 'No refresh token');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = await findAndDeleteRefreshToken(tokenHash);
    if (!row) throw new AppError(401, 'Invalid or expired refresh token');

    const profile = await getUserWithTrainLines(row.user_id);
    if (!profile) throw new AppError(401, 'User not found');

    const accessToken = generateAccessToken(profile.id, profile.role);
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await saveRefreshToken(profile.id, newHash, expiresAt);
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    res.json({ accessToken, user: profile });
  } catch (err) { next(err); }
});

authRouter.post('/logout', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await findAndDeleteRefreshToken(hash);
    }
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Create `server/src/routes/auth.test.ts`**

```typescript
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, 'applicant')`,
    ['EMP-001', 'テスト太郎', 'Test Taro', 'test@company.com', hash]
  );
});

afterAll(async () => {
  await clearDatabase();
  await closePool();
});

describe('POST /api/auth/login', () => {
  it('returns access token and user profile on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.employee_number).toBe('EMP-001');
    expect(res.body.user.role).toBe('applicant');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown employee number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'NOBODY', password: 'Test1234!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new access token using refresh cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    const cookie = loginRes.headers['set-cookie'][0];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears cookie and invalidates refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    const cookie = loginRes.headers['set-cookie'][0];

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run auth tests**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=auth
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ..
git add .
git commit -m "feat: add auth routes (login, refresh, logout) with tests"
```

---

## Task 9: User Routes

**Files:**
- Create: `server/src/routes/users.ts`
- Create: `server/src/routes/users.test.ts`

- [ ] **Step 1: Create `server/src/routes/users.ts`**

```typescript
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { getUserWithTrainLines, getManagersByEmployeeId } from '../db/queries/users';
import { AppError } from '../middleware/errorHandler';

export const userRouter = Router();
userRouter.use(authMiddleware);

userRouter.get('/me', async (req: AuthRequest, res: Response, next) => {
  try {
    const profile = await getUserWithTrainLines(req.user!.id);
    if (!profile) throw new AppError(404, 'User not found');
    res.json(profile);
  } catch (err) { next(err); }
});

userRouter.get('/me/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const managers = await getManagersByEmployeeId(req.user!.id);
    res.json(managers);
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Create `server/src/routes/users.test.ts`**

```typescript
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let accessToken: string;
let employeeId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  const adminRes = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('MGR-001', '管理者', 'Manager', 'mgr@company.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  const managerId = adminRes.rows[0].id;

  const empRes = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@company.com', $1, 'applicant') RETURNING id`,
    [hash]
  );
  employeeId = empRes.rows[0].id;

  await pool.query(
    `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
    [employeeId, managerId]
  );

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ employee_number: 'EMP-001', password: 'Test1234!' });
  accessToken = loginRes.body.accessToken;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/users/me', () => {
  it('returns user profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
    expect(Array.isArray(res.body.trainLines)).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me/managers', () => {
  it('returns only managers assigned to this user', async () => {
    const res = await request(app)
      .get('/api/users/me/managers')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employee_number).toBe('MGR-001');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=users
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd ..
git add .
git commit -m "feat: add user routes (me, managers) with tests"
```

---

## Task 10: Email Service

**Files:**
- Create: `server/src/services/email/EmailService.ts`
- Create: `server/src/services/email/NodemailerService.ts`

- [ ] **Step 1: Create `server/src/services/email/EmailService.ts`**

```typescript
export interface SendOptions {
  to: string[];
  subject: string;
  body: string;
}

export interface EmailService {
  send(options: SendOptions): Promise<void>;
}
```

- [ ] **Step 2: Create `server/src/services/email/NodemailerService.ts`**

```typescript
import nodemailer from 'nodemailer';
import { EmailService, SendOptions } from './EmailService';
import { config } from '../../config';

export class NodemailerService implements EmailService {
  private transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  async send({ to, subject, body }: SendOptions): Promise<void> {
    await this.transporter.sendMail({
      from: config.smtp.from,
      to: to.join(', '),
      subject,
      text: body,
    });
  }
}

export const emailService: EmailService = new NodemailerService();
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add EmailService interface and Nodemailer implementation"
```

---

## Task 11: Request Routes (Submit + List)

**Files:**
- Create: `server/src/db/queries/requests.ts`
- Create: `server/src/routes/requests.ts`
- Create: `server/src/routes/requests.test.ts`

- [ ] **Step 1: Create `server/src/db/queries/requests.ts`**

```typescript
import { pool } from '../pool';
import { Request as AttendanceRequest, RequestType, ReasonCategory, LeaveType, InputLanguage } from '@attendance/shared';

export interface CreateRequestInput {
  employeeId: string;
  requestType: RequestType;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  reasonCategory: ReasonCategory;
  reasonDetail?: string;
  trainLineId?: string;
  leaveType?: LeaveType;
  adminMessage?: string;
  inputLanguage: InputLanguage;
}

export async function createRequest(input: CreateRequestInput): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO requests
      (employee_id, request_type, start_date, end_date, time_from, time_to,
       reason_category, reason_detail, train_line_id, leave_type, admin_message, input_language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      input.employeeId, input.requestType, input.startDate,
      input.endDate ?? null, input.timeFrom ?? null, input.timeTo ?? null,
      input.reasonCategory, input.reasonDetail ?? null, input.trainLineId ?? null,
      input.leaveType ?? null, input.adminMessage ?? null, input.inputLanguage,
    ]
  );
  return rows[0].id as string;
}

export async function createAttachment(requestId: string, data: {
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
}) {
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO attachments (request_id, original_filename, storage_path, mime_type, file_size, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [requestId, data.originalFilename, data.storagePath, data.mimeType, data.fileSize, expiresAt]
  );
}

export async function getRequestsByEmployee(employeeId: string): Promise<AttendanceRequest[]> {
  const { rows } = await pool.query(
    `SELECT r.*, 
            u.name_ja AS employee_name_ja, u.name_en AS employee_name_en, u.employee_number,
            t.line_name_ja AS train_line_name_ja, t.line_name_en AS train_line_name_en,
            json_build_object(
              'id', a.id, 'original_filename', a.original_filename,
              'file_size', a.file_size, 'uploaded_at', a.uploaded_at, 'expires_at', a.expires_at
            ) FILTER (WHERE a.id IS NOT NULL) AS attachment
     FROM requests r
     JOIN users u ON u.id = r.employee_id
     LEFT JOIN train_lines t ON t.id = r.train_line_id
     LEFT JOIN attachments a ON a.request_id = r.id
     WHERE r.employee_id = $1
     ORDER BY r.submitted_at DESC`,
    [employeeId]
  );
  return rows;
}
```

- [ ] **Step 2: Create `server/src/routes/requests.ts`**

```typescript
import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { createRequest, createAttachment, getRequestsByEmployee } from '../db/queries/requests';
import { getManagersByEmployeeId, getUserWithTrainLines } from '../db/queries/users';
import { generateMessage } from '@attendance/shared';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const requestRouter = Router();
requestRouter.use(authMiddleware);
requestRouter.use(requireRole('applicant'));

requestRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const requests = await getRequestsByEmployee(req.user!.id);
    res.json(requests);
  } catch (err) { next(err); }
});

requestRouter.post('/', upload.single('file'), async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      requestType, startDate, endDate, timeFrom, timeTo,
      reasonCategory, reasonDetail, trainLineId, leaveType,
      adminMessage, inputLanguage,
    } = req.body;

    if (!requestType || !startDate || !reasonCategory || !inputLanguage) {
      throw new AppError(400, 'Missing required fields');
    }

    const client = await pool.connect();
    let requestId: string;
    try {
      await client.query('BEGIN');
      requestId = await createRequest({
        employeeId: req.user!.id,
        requestType, startDate, endDate, timeFrom, timeTo,
        reasonCategory, reasonDetail, trainLineId, leaveType,
        adminMessage, inputLanguage,
      });

      if (req.file) {
        await createAttachment(requestId, {
          originalFilename: req.file.originalname,
          storagePath: req.file.path,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await getUserWithTrainLines(req.user!.id);
    const managers = await getManagersByEmployeeId(req.user!.id);

    if (managers.length > 0 && user) {
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
        to: managers.map(m => m.email),
        subject: `${subjects[requestType]}${user.name_ja} ${startDate}`,
        body,
      });
    }

    res.status(201).json({ id: requestId });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Create `server/src/routes/requests.test.ts`**

```typescript
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

jest.mock('../services/email/NodemailerService', () => ({
  emailService: { send: jest.fn().mockResolvedValue(undefined) },
}));

const app = createApp();
let token: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant')`,
    [hash]
  );
  const res = await request(app).post('/api/auth/login').send({ employee_number: 'EMP-001', password: 'Test1234!' });
  token = res.body.accessToken;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/requests', () => {
  it('returns empty array when no requests', async () => {
    const res = await request(app).get('/api/requests').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/requests', () => {
  it('creates a request and returns id', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('timeFrom', '09:00')
      .field('timeTo', '10:00')
      .field('reasonCategory', 'oversleeping')
      .field('inputLanguage', 'ja');

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('request appears in GET /api/requests after creation', async () => {
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'absence')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'personal')
      .field('leaveType', 'paid')
      .field('inputLanguage', 'ja');

    const res = await request(app).get('/api/requests').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].request_type).toBe('absence');
    expect(res.body[0].status).toBe('pending');
  });

  it('returns 403 for admin users', async () => {
    const hash = await bcrypt.hash('Test1234!', 10);
    await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
       VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
      [hash]
    );
    const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'oversleeping')
      .field('inputLanguage', 'ja');
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=requests
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd ..
git add .
git commit -m "feat: add request routes (list, submit with file upload) with tests"
```

---

## Task 12: Admin Routes

**Files:**
- Create: `server/src/db/queries/admin.ts`
- Create: `server/src/routes/admin.ts`
- Create: `server/src/routes/admin.test.ts`

- [ ] **Step 1: Create `server/src/db/queries/admin.ts`**

```typescript
import { pool } from '../pool';
import { Request as AttendanceRequest, RequestStatus, RequestType } from '@attendance/shared';

export interface AdminRequestFilters {
  name?: string;
  type?: RequestType;
  from?: string;
  to?: string;
  status?: RequestStatus;
}

export async function getAllRequests(filters: AdminRequestFilters): Promise<AttendanceRequest[]> {
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT r.*,
            u.name_ja AS employee_name_ja, u.name_en AS employee_name_en, u.employee_number,
            t.line_name_ja AS train_line_name_ja, t.line_name_en AS train_line_name_en,
            json_build_object(
              'id', a.id, 'original_filename', a.original_filename,
              'file_size', a.file_size, 'uploaded_at', a.uploaded_at, 'expires_at', a.expires_at
            ) FILTER (WHERE a.id IS NOT NULL) AS attachment
     FROM requests r
     JOIN users u ON u.id = r.employee_id
     LEFT JOIN train_lines t ON t.id = r.train_line_id
     LEFT JOIN attachments a ON a.request_id = r.id
     ${where}
     ORDER BY r.submitted_at DESC`,
    params
  );
  return rows;
}

export async function updateRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<{ employee_id: string } | undefined> {
  const { rows } = await pool.query(
    `UPDATE requests SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 RETURNING employee_id`,
    [status, reviewedBy, requestId]
  );
  return rows[0];
}

export async function getEmployeeEmailById(employeeId: string): Promise<string | undefined> {
  const { rows } = await pool.query(`SELECT email FROM users WHERE id = $1`, [employeeId]);
  return rows[0]?.email;
}
```

- [ ] **Step 2: Create `server/src/routes/admin.ts`**

```typescript
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, updateRequestStatus, getEmployeeEmailById } from '../db/queries/admin';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { RequestType, RequestStatus } from '@attendance/shared';

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
    const { status } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      throw new AppError(400, 'status must be "approved" or "rejected"');
    }

    const result = await updateRequestStatus(req.params.id, status, req.user!.id);
    if (!result) throw new AppError(404, 'Request not found');

    if (status === 'rejected') {
      const email = await getEmployeeEmailById(result.employee_id);
      if (email) {
        await emailService.send({
          to: [email],
          subject: 'Your attendance request was not approved',
          body: 'Your attendance request has been reviewed and was not approved. Please contact your manager for more details.',
        });
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Create `server/src/routes/admin.test.ts`**

```typescript
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

  const adminRow = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  const empRow = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant') RETURNING id`,
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
  it('approves a request', async () => {
    const res = await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].status).toBe('approved');
  });

  it('sends email to applicant on rejection', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected' });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['emp@test.com'] })
    );
  });

  it('does not send email on approval', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=admin
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd ..
git add .
git commit -m "feat: add admin routes (list with filters, approve/reject) with tests"
```

---

## Task 13: Attachments Route + Cleanup Job

**Files:**
- Create: `server/src/routes/attachments.ts`
- Create: `server/src/services/cleanupJob.ts`

- [ ] **Step 1: Create `server/src/routes/attachments.ts`**

```typescript
import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export const attachmentRouter = Router();
attachmentRouter.use(authMiddleware);
attachmentRouter.use(requireRole('admin'));

attachmentRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT storage_path, original_filename, mime_type, expires_at FROM attachments WHERE id = $1`,
      [req.params.id]
    );
    const attachment = rows[0];
    if (!attachment) throw new AppError(404, 'Attachment not found');
    if (new Date(attachment.expires_at) < new Date()) throw new AppError(410, 'Attachment expired');

    const filePath = path.resolve(attachment.storage_path);
    if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found on disk');

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Create `server/src/services/cleanupJob.ts`**

```typescript
import cron from 'node-cron';
import fs from 'fs';
import { pool } from '../db/pool';

export function startCleanupJob() {
  cron.schedule('0 0 * * *', async () => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM attachments WHERE expires_at < NOW() RETURNING storage_path`
      );
      for (const row of rows) {
        if (fs.existsSync(row.storage_path)) {
          fs.unlinkSync(row.storage_path);
        }
      }
      if (rows.length > 0) console.log(`Cleanup: deleted ${rows.length} expired attachments`);
    } catch (err) {
      console.error('Cleanup job error:', err);
    }
  });
}
```

- [ ] **Step 3: Verify server starts without errors**

```bash
cd server && npm run dev
```

Expected: `Server running on port 4000` (no errors). Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
cd ..
git add .
git commit -m "feat: add attachment serving route and 60-day cleanup cron job"
```

---

## Plan 2 Complete

All backend API is built and tested:
- ✅ Auth (login, refresh, logout) with JWT dual-token flow
- ✅ User routes (profile, managers)
- ✅ Request submission with file upload (multipart, DB transaction)
- ✅ Admin routes (list with filters, approve/reject)
- ✅ Attachment streaming (admin only, expiry checked)
- ✅ Email service (Nodemailer, swappable interface)
- ✅ 60-day cleanup cron job

**Run all backend tests:**
```bash
cd server && NODE_ENV=test npm test
```

**Next:** Continue with `docs/superpowers/plans/2026-05-19-plan-3-frontend.md`
