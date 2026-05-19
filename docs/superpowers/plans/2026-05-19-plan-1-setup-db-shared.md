# Attendance System — Plan 1: Setup, Database & Shared

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the monorepo, create the PostgreSQL schema with migrations, seed a dummy admin, and build + fully test the shared `generateMessage()` pure function.

**Architecture:** Three-package monorepo (`client/`, `server/`, `shared/`). `shared/` is plain TypeScript compiled to JS — no framework. Database schema uses raw SQL migration files executed by a small Node script. All business logic in `shared/` is tested with Vitest before any backend or frontend code is written.

**Tech Stack:** Node.js 20+, TypeScript 5, PostgreSQL 15+, Vitest, npm workspaces

**Pre-requisite:** PostgreSQL must be running locally. Create two databases before starting:
```bash
createdb attendance_dev
createdb attendance_test
```

**Read before starting:**
- Design spec: `docs/superpowers/specs/2026-05-19-attendance-system-design.md`
- `CLAUDE.md` in repo root

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json` with workspaces**

```json
{
  "name": "attendance-system",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "test": "npm run test -w shared && npm run test -w server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create `shared/package.json`**

```json
{
  "name": "@attendance/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create `server/package.json`**

```json
{
  "name": "@attendance/server",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand",
    "migrate": "ts-node src/db/migrate.ts",
    "seed": "ts-node src/db/seed.ts"
  },
  "dependencies": {
    "@attendance/shared": "*",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.13",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.0",
    "@types/nodemailer": "^6.4.15",
    "@types/pg": "^8.11.5",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.4",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 5: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["dist", "**/*.test.ts"]
}
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
server/uploads/*
!server/uploads/.gitkeep
*.log
.DS_Store
.superpowers/
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p shared/src server/src/{db,routes,middleware,services/email} server/uploads client
touch server/uploads/.gitkeep
```

- [ ] **Step 8: Install all dependencies**

```bash
npm install
```

Expected: npm installs all workspace dependencies without errors.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: initialize monorepo with workspace structure"
```

---

## Task 2: Environment Configuration

**Files:**
- Create: `.env.example`
- Create: `server/src/config.ts`

- [ ] **Step 1: Create `.env.example`**

```bash
# Copy to .env and fill in values
DATABASE_URL=postgres://postgres:password@localhost:5432/attendance_dev
DATABASE_TEST_URL=postgres://postgres:password@localhost:5432/attendance_test
JWT_SECRET=change-me-to-a-long-random-string
JWT_REFRESH_SECRET=change-me-to-another-long-random-string
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Attendance System <your-email@gmail.com>
PORT=4000
CLIENT_URL=http://localhost:5173
```

- [ ] **Step 2: Copy to `.env` and fill in real local values**

```bash
cp .env.example .env
```

Edit `.env` with your local PostgreSQL credentials.

- [ ] **Step 3: Create `server/src/config.ts`**

```typescript
import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: required('DATABASE_URL'),
  databaseTestUrl: required('DATABASE_TEST_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Attendance System <noreply@example.com>',
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: add environment configuration"
```

---

## Task 3: Database Schema & Migrations

**Files:**
- Create: `server/src/db/migrations/001_initial_schema.sql`
- Create: `server/src/db/migrate.ts`
- Create: `server/src/db/pool.ts`

- [ ] **Step 1: Create `server/src/db/pool.ts`**

```typescript
import { Pool } from 'pg';
import { config } from '../config';

const isTest = process.env.NODE_ENV === 'test';

export const pool = new Pool({
  connectionString: isTest ? config.databaseTestUrl : config.databaseUrl,
});
```

- [ ] **Step 2: Create `server/src/db/migrations/001_initial_schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('applicant', 'admin');
CREATE TYPE request_type AS ENUM ('late', 'early_departure', 'absence', 'other_request');
CREATE TYPE reason_category AS ENUM (
  'illness', 'train_delay', 'oversleeping', 'personal', 'other',
  'child_dropoff', 'work_appointment', 'other_appointment', 'direct_home'
);
CREATE TYPE leave_type AS ENUM ('paid', 'unpaid', 'substitute', 'other');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE input_language AS ENUM ('ja', 'en');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  name_ja VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'applicant',
  work_start TIME,
  work_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE train_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_name_ja VARCHAR(100) NOT NULL,
  line_name_en VARCHAR(100) NOT NULL
);

CREATE TABLE employee_managers (
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, manager_id)
);

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type request_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  time_from TIME,
  time_to TIME,
  reason_category reason_category NOT NULL,
  reason_detail TEXT,
  train_line_id UUID REFERENCES train_lines(id),
  leave_type leave_type,
  admin_message TEXT,
  input_language input_language NOT NULL DEFAULT 'ja',
  status request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_employee_id ON requests(employee_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_start_date ON requests(start_date);
CREATE INDEX idx_attachments_expires_at ON attachments(expires_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

- [ ] **Step 3: Create `server/src/db/migrate.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }

  await pool.end();
  console.log('Migrations complete');
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run migrations on dev database**

```bash
cd server && npm run migrate
```

Expected output:
```
Applied 001_initial_schema.sql
Migrations complete
```

- [ ] **Step 5: Run migrations on test database**

```bash
NODE_ENV=test npm run migrate
```

Expected: same output for test database.

- [ ] **Step 6: Commit**

```bash
cd ..
git add .
git commit -m "feat: add database schema and migration runner"
```

---

## Task 4: Seed Script (Dummy Admin)

**Files:**
- Create: `server/src/db/seed.ts`

- [ ] **Step 1: Create `server/src/db/seed.ts`**

```typescript
import bcrypt from 'bcryptjs';
import { pool } from './pool';

async function seed() {
  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  await pool.query(`
    INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, 'admin')
    ON CONFLICT (employee_number) DO NOTHING
  `, ['ADMIN-001', '管理者', 'Admin User', 'admin@company.com', passwordHash]);

  console.log('Seed complete. Admin login: ADMIN-001 / Admin1234!');
  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run seed**

```bash
cd server && npm run seed
```

Expected:
```
Seed complete. Admin login: ADMIN-001 / Admin1234!
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add .
git commit -m "feat: add seed script with dummy admin"
```

---

## Task 5: Shared TypeScript Types

**Files:**
- Create: `shared/src/types.ts`
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create `shared/src/types.ts`**

```typescript
export type UserRole = 'applicant' | 'admin';
export type RequestType = 'late' | 'early_departure' | 'absence' | 'other_request';
export type ReasonCategory =
  | 'illness' | 'train_delay' | 'oversleeping' | 'personal' | 'other'
  | 'child_dropoff' | 'work_appointment' | 'other_appointment' | 'direct_home';
export type LeaveType = 'paid' | 'unpaid' | 'substitute' | 'other';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type InputLanguage = 'ja' | 'en';

export interface TrainLine {
  id: string;
  line_name_ja: string;
  line_name_en: string;
}

export interface UserProfile {
  id: string;
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: UserRole;
  trainLines: TrainLine[];
}

export interface Manager {
  id: string;
  name_ja: string;
  name_en: string;
  email: string;
}

export interface Attachment {
  id: string;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
  expires_at: string;
}

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
  reason_category: ReasonCategory;
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
}

export interface MessageInput {
  requestType: RequestType;
  reasonCategory: ReasonCategory;
  reasonDetail?: string;
  trainLineName?: string;
  startDate: string;
  endDate?: string;
  timeFrom?: string;
  timeTo?: string;
  leaveType?: LeaveType;
  adminMessage?: string;
  employeeName: { ja: string; en: string };
  inputLanguage: InputLanguage;
}

export interface MessageOutput {
  japanese: string;
  english?: string;
}
```

- [ ] **Step 2: Create `shared/src/index.ts`**

```typescript
export * from './types';
export * from './messageGenerator';
```

- [ ] **Step 3: Build shared to verify no type errors**

```bash
cd shared && npm run build
```

Expected: `dist/` folder created with no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add .
git commit -m "feat: add shared TypeScript types"
```

---

## Task 6: Message Generator — Tests First

**Files:**
- Create: `shared/src/messageGenerator.test.ts`
- Create: `shared/src/messageGenerator.ts`

- [ ] **Step 1: Create `shared/src/messageGenerator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateMessage } from './messageGenerator';

const baseLate = {
  requestType: 'late' as const,
  reasonCategory: 'train_delay' as const,
  trainLineName: '山手線',
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
  inputLanguage: 'ja' as const,
};

describe('generateMessage', () => {
  describe('Late Arrival — Japanese input', () => {
    it('generates Japanese-only output', () => {
      const result = generateMessage(baseLate);
      expect(result.english).toBeUndefined();
      expect(result.japanese).toContain('【遅刻連絡】');
      expect(result.japanese).toContain('山田太郎');
    });

    it('includes train line name in body', () => {
      const result = generateMessage(baseLate);
      expect(result.japanese).toContain('山手線');
    });

    it('includes arrival time', () => {
      const result = generateMessage(baseLate);
      expect(result.japanese).toContain('10:00');
    });
  });

  describe('Late Arrival — English input', () => {
    it('generates both English and Japanese', () => {
      const result = generateMessage({ ...baseLate, inputLanguage: 'en', trainLineName: 'Yamanote Line' });
      expect(result.english).toBeDefined();
      expect(result.japanese).toBeDefined();
      expect(result.english).toContain('[Late Arrival Notice]');
      expect(result.english).toContain('Taro Yamada');
    });
  });

  describe('Late Arrival — oversleeping', () => {
    it('does not mention train line', () => {
      const result = generateMessage({ ...baseLate, reasonCategory: 'oversleeping', trainLineName: undefined });
      expect(result.japanese).not.toContain('電車');
    });
  });

  describe('Late Arrival — child dropoff', () => {
    it('includes child dropoff phrase', () => {
      const result = generateMessage({ ...baseLate, reasonCategory: 'child_dropoff', trainLineName: undefined });
      expect(result.japanese).toContain('保育園');
    });
  });

  describe('Early Departure', () => {
    it('generates early departure subject', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        timeFrom: '14:00',
        timeTo: '18:00',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【早退連絡】');
      expect(result.japanese).toContain('発熱');
    });
  });

  describe('Absence — single day', () => {
    it('generates absence subject without date range', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【欠勤連絡】');
      expect(result.japanese).not.toContain('〜');
    });
  });

  describe('Absence — multi-day', () => {
    it('includes date range with ～', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('～');
    });

    it('uses em dash in English version', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: 'Fever',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'en',
      });
      expect(result.english).toContain('–');
    });
  });

  describe('Other Request', () => {
    it('generates other request subject', () => {
      const result = generateMessage({
        requestType: 'other_request',
        reasonCategory: 'direct_home',
        startDate: '2024-01-15',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【その他連絡】');
    });
  });

  describe('admin_message', () => {
    it('appends admin message to Japanese output', () => {
      const result = generateMessage({ ...baseLate, adminMessage: '追加のメモ' });
      expect(result.japanese).toContain('追加のメモ');
    });

    it('appends admin message to English output when bilingual', () => {
      const result = generateMessage({ ...baseLate, inputLanguage: 'en', trainLineName: 'Yamanote Line', adminMessage: 'Extra note' });
      expect(result.english).toContain('Extra note');
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd shared && npm test
```

Expected: Tests fail with "Cannot find module './messageGenerator'"

- [ ] **Step 3: Create `shared/src/messageGenerator.ts`**

```typescript
import { MessageInput, MessageOutput } from './types';

function formatDateJa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateEn(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const subjectJa: Record<string, string> = {
  late: '【遅刻連絡】',
  early_departure: '【早退連絡】',
  absence: '【欠勤連絡】',
  other_request: '【その他連絡】',
};

const subjectEn: Record<string, string> = {
  late: '[Late Arrival Notice]',
  early_departure: '[Early Departure Notice]',
  absence: '[Absence Notice]',
  other_request: '[Other Request]',
};

function reasonBodyJa(input: MessageInput): string {
  switch (input.reasonCategory) {
    case 'train_delay':
      return `電車遅延（${input.trainLineName ?? ''}）のため`;
    case 'oversleeping':
      return '寝過ごしのため';
    case 'child_dropoff':
      return '保育園・学校の送りのため';
    case 'illness':
      return `体調不良${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'personal':
      return '私用のため';
    case 'work_appointment':
      return '業務上のアポイントのため';
    case 'other_appointment':
      return `アポイント${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'direct_home':
      return '客先から直帰のため';
    case 'other':
      return `${input.reasonDetail ?? 'その他の理由'}のため`;
  }
}

function reasonBodyEn(input: MessageInput): string {
  switch (input.reasonCategory) {
    case 'train_delay':
      return `train delay (${input.trainLineName ?? ''})`;
    case 'oversleeping':
      return 'oversleeping';
    case 'child_dropoff':
      return 'dropping my child at school/daycare';
    case 'illness':
      return `illness${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'personal':
      return 'personal reasons';
    case 'work_appointment':
      return 'a work-related appointment';
    case 'other_appointment':
      return `an appointment${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'direct_home':
      return 'going home directly from a client meeting';
    case 'other':
      return input.reasonDetail ?? 'other reasons';
  }
}

function buildJapanese(input: MessageInput): string {
  const dateStr = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);

  const subject = `件名：${subjectJa[input.requestType]}${input.employeeName.ja}　${dateStr}`;
  const greeting = `${input.employeeName.ja}です。`;
  const reason = reasonBodyJa(input);

  let body = '';
  if (input.requestType === 'late') {
    body = `本日、${reason}、\n出社が${input.timeTo}頃になります。`;
  } else if (input.requestType === 'early_departure') {
    body = `本日、${reason}、\n${input.timeFrom}頃に早退させていただきます。`;
  } else if (input.requestType === 'absence') {
    const leaveMap: Record<string, string> = { paid: '有給休暇', unpaid: '欠勤', substitute: '振替休日', other: 'その他' };
    const leaveStr = input.leaveType ? `（${leaveMap[input.leaveType]}）` : '';
    body = `${dateStr}${leaveStr}、${reason}お休みをいただきます。`;
  } else {
    body = `${dateStr}、${reason}直帰いたします。`;
  }

  const apology = 'ご迷惑をおかけし、申し訳ございません。';
  const parts = [subject, '', greeting, body, apology];
  if (input.adminMessage) parts.push('', input.adminMessage);
  return parts.join('\n');
}

function buildEnglish(input: MessageInput): string {
  const dateStr = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const subject = `Subject: ${subjectEn[input.requestType]} ${input.employeeName.en} - ${dateStr}`;
  const greeting = `This is ${input.employeeName.en}.`;
  const reason = reasonBodyEn(input);

  let body = '';
  if (input.requestType === 'late') {
    body = `I will be arriving late today due to ${reason}.\nI expect to arrive at around ${input.timeTo}.`;
  } else if (input.requestType === 'early_departure') {
    body = `I will be leaving early today due to ${reason}.\nI expect to leave at around ${input.timeFrom}.`;
  } else if (input.requestType === 'absence') {
    const leaveMap: Record<string, string> = { paid: 'paid leave', unpaid: 'unpaid leave', substitute: 'substitute holiday', other: 'leave' };
    const leaveStr = input.leaveType ? ` (${leaveMap[input.leaveType]})` : '';
    body = `I will be absent on ${dateStr}${leaveStr} due to ${reason}.`;
  } else {
    body = `I will be going home directly from a client meeting on ${dateStr}.`;
  }

  const apology = 'I sincerely apologize for the inconvenience.';
  const parts = [subject, '', greeting, body, apology];
  if (input.adminMessage) parts.push('', input.adminMessage);
  return parts.join('\n');
}

export function generateMessage(input: MessageInput): MessageOutput {
  const japanese = buildJapanese(input);
  if (input.inputLanguage === 'en') {
    return { japanese, english: buildEnglish(input) };
  }
  return { japanese };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd shared && npm test
```

Expected: All tests pass.

- [ ] **Step 5: Build shared**

```bash
npm run build
```

Expected: `dist/` created with no errors.

- [ ] **Step 6: Commit**

```bash
cd ..
git add .
git commit -m "feat: add message generator with full bilingual support"
```

---

## Plan 1 Complete

All foundational pieces are in place:
- ✅ Monorepo with npm workspaces
- ✅ PostgreSQL schema migrated to both dev and test databases
- ✅ Dummy admin seeded (`ADMIN-001` / `Admin1234!`)
- ✅ Shared TypeScript types
- ✅ `generateMessage()` fully tested and built

**Next:** Continue with `docs/superpowers/plans/2026-05-19-plan-2-backend.md`
