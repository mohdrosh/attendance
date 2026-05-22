# Request Type, Reason & Leave Type Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new request types (直行/chokko, 直帰/chokki, 休日出勤/kyujitsu_shukkin), replace the 9 reason categories with a simplified 5-reason list, replace the `other` leave type with `special` (特別休暇（慶弔）), and ensure all 3 email notification paths work for every type.

**Architecture:** Clean enum replacement via a single transactional SQL migration (drop + recreate), followed by type layer updates bottom-up: shared types → message generator → backend route → frontend translations → frontend form. Each layer is independently committed and tested.

**Tech Stack:** PostgreSQL 18 (psql migrations), TypeScript, Node/Express, React 19 + react-i18next, Vitest (shared/frontend tests), Jest + Supertest (backend tests)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `server/src/db/migrations/003_update_enums.sql` | Create | Drop/recreate 3 enums, migrate existing row data |
| `shared/src/types.ts` | Modify | `RequestType`, `ReasonCategory`, `LeaveType` unions; `MessageInput.reasonCategory` optional |
| `shared/src/messageGenerator.ts` | Modify | Subject maps, reason body functions, body builders, requestType label maps |
| `shared/src/messageGenerator.test.ts` | Modify | Replace old reason tests, add new type/reason tests |
| `server/src/routes/requests.ts` | Modify | Optional-reason type list, subjects email map |
| `server/src/routes/requests.test.ts` | Modify | Replace `oversleeping` with valid reason, add chokko test |
| `client/src/locales/ja.json` | Modify | New keys for request_type, reasons, leave_types |
| `client/src/locales/en.json` | Modify | New keys with English translations |
| `client/src/pages/RequestFormPage.tsx` | Modify | Constants, dropdown order, validation, remove train line section |

---

## Task 1: Database Migration

**Files:**
- Create: `server/src/db/migrations/003_update_enums.sql`

The migration runner (`server/src/db/migrate.ts`) wraps each file in `BEGIN`/`COMMIT`. `ALTER TYPE ... ADD VALUE` cannot run inside a transaction, so we drop and recreate all three affected enums in one transactional block instead.

- [ ] **Step 1: Create the migration file**

```sql
-- server/src/db/migrations/003_update_enums.sql

-- Convert enum columns to text so we can drop the types
ALTER TABLE requests ALTER COLUMN request_type   TYPE text;
ALTER TABLE requests ALTER COLUMN reason_category TYPE text;
ALTER TABLE requests ALTER COLUMN leave_type      TYPE text;

-- Drop old enum types
DROP TYPE request_type;
DROP TYPE reason_category;
DROP TYPE leave_type;

-- Migrate existing reason_category values
UPDATE requests SET reason_category = 'weather_transport' WHERE reason_category = 'train_delay';
UPDATE requests SET reason_category = 'other'             WHERE reason_category = 'oversleeping';
UPDATE requests SET reason_category = 'family'            WHERE reason_category = 'child_dropoff';
UPDATE requests SET reason_category = 'personal'          WHERE reason_category IN ('work_appointment', 'other_appointment');
UPDATE requests SET reason_category = 'other'             WHERE reason_category = 'direct_home';

-- Migrate existing leave_type values
UPDATE requests SET leave_type = 'special' WHERE leave_type = 'other';

-- Create new enum types
CREATE TYPE request_type AS ENUM (
  'late', 'early_departure', 'absence', 'other_request',
  'chokko', 'chokki', 'kyujitsu_shukkin'
);
CREATE TYPE reason_category AS ENUM (
  'illness', 'family', 'personal', 'weather_transport', 'other'
);
CREATE TYPE leave_type AS ENUM ('paid', 'unpaid', 'substitute', 'special');

-- Restore columns to new enum types (NULL-safe — nullable columns handled by USING)
ALTER TABLE requests ALTER COLUMN request_type
  TYPE request_type USING request_type::request_type;
ALTER TABLE requests ALTER COLUMN reason_category
  TYPE reason_category USING reason_category::reason_category;
ALTER TABLE requests ALTER COLUMN leave_type
  TYPE leave_type USING leave_type::leave_type;
```

- [ ] **Step 2: Run migration against dev DB**

```bash
cd server && npm run migrate
```

Expected output:
```
Skipping 001_initial_schema.sql (already applied)
Skipping 002_nullable_reason_category.sql (already applied)
Applied 003_update_enums.sql
Migrations complete
```

- [ ] **Step 3: Verify enum values in dev DB**

```bash
PATH="/Applications/Postgres.app/Contents/Versions/18/bin:$PATH" psql attendance_dev -c "\dT+ request_type" -c "\dT+ reason_category" -c "\dT+ leave_type"
```

Expected: each enum lists only the new values (no `train_delay`, `oversleeping`, etc.; `leave_type` shows `special` not `other`).

- [ ] **Step 4: Run migration against test DB**

```bash
cd server && NODE_ENV=test npm run migrate
```

Expected: same output, `Applied 003_update_enums.sql`.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/003_update_enums.sql
git commit -m "feat: migration 003 — replace reason/leave enums, add new request types"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Update union types and make reasonCategory optional in MessageInput**

Replace the current three type definitions and the `MessageInput` interface with:

```ts
// shared/src/types.ts  (replace lines 2–8)
export type RequestType =
  | 'late' | 'early_departure' | 'absence' | 'other_request'
  | 'chokko' | 'chokki' | 'kyujitsu_shukkin';

export type ReasonCategory =
  | 'illness' | 'family' | 'personal' | 'weather_transport' | 'other';

export type LeaveType = 'paid' | 'unpaid' | 'substitute' | 'special';
```

Also make `reasonCategory` optional in `MessageInput` (line 68 area):

```ts
export interface MessageInput {
  requestType: RequestType;
  reasonCategory?: ReasonCategory;   // optional — new types don't require a reason
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
```

- [ ] **Step 2: Build shared package to verify no type errors**

```bash
cd shared && npm run build
```

Expected: build succeeds with no errors. (TypeScript may emit warnings elsewhere that we fix in subsequent tasks — that is fine.)

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: update RequestType, ReasonCategory, LeaveType unions; optional reasonCategory in MessageInput"
```

---

## Task 3: Message Generator — Tests First, Then Implementation

**Files:**
- Modify: `shared/src/messageGenerator.test.ts`
- Modify: `shared/src/messageGenerator.ts`

### Step group A: Write failing tests

- [ ] **Step 1: Replace the test file with updated tests**

```ts
// shared/src/messageGenerator.test.ts
import { describe, it, expect } from 'vitest';
import { generateMessage, generateApprovalNotification, generateRejectionNotification } from './messageGenerator';

const empName = { ja: '山田太郎', en: 'Taro Yamada' };

describe('generateMessage', () => {
  describe('Late Arrival', () => {
    it('generates Japanese-only output', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeFrom: '09:00',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.english).toBeUndefined();
      expect(result.japanese).toContain('【遅刻連絡】');
      expect(result.japanese).toContain('山田太郎');
    });

    it('generates both languages for English input', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeFrom: '09:00',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Late Arrival Notice]');
      expect(result.japanese).toContain('【遅刻連絡】');
    });

    it('includes arrival time', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('10:00');
    });
  });

  describe('Early Departure', () => {
    it('generates early departure subject and includes reason detail', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        timeFrom: '14:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【早退連絡】');
      expect(result.japanese).toContain('発熱');
    });
  });

  describe('Absence', () => {
    it('generates absence subject', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【欠勤連絡】');
    });

    it('includes date range with ～ for multi-day absence', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('～');
    });

    it('uses em dash in English for multi-day absence', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: 'Fever',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('–');
    });

    it('includes special leave type label in Japanese body', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'special',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('特別休暇（慶弔）');
    });

    it('includes special leave type label in English body', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'special',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('special leave');
    });
  });

  describe('New reasons', () => {
    it('family reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'family',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('家庭の事情');
    });

    it('weather_transport reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('天候・交通機関');
    });

    it('weather_transport reason appears in English body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('weather or transportation');
    });

    it('personal reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        timeFrom: '15:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('私用');
    });
  });

  describe('Chokko (Direct to Client)', () => {
    it('generates chokko subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【直行連絡】');
      expect(result.japanese).toContain('直行');
    });

    it('generates chokko notice in English', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Direct to Client Notice]');
      expect(result.english).toContain('going directly to the client');
    });

    it('includes reason phrase when reason provided', () => {
      const result = generateMessage({
        requestType: 'chokko',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('私用');
    });

    it('omits reason phrase when no reason provided', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).not.toContain('のため');
    });
  });

  describe('Chokki (Going Directly Home)', () => {
    it('generates chokki subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'chokki',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【直帰連絡】');
      expect(result.japanese).toContain('直帰');
    });

    it('generates chokki notice in English', () => {
      const result = generateMessage({
        requestType: 'chokki',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Going Directly Home Notice]');
      expect(result.english).toContain('going directly home');
    });
  });

  describe('Kyujitsu Shukkin (Holiday Work)', () => {
    it('generates holiday work subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'kyujitsu_shukkin',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【休日出勤連絡】');
      expect(result.japanese).toContain('出社');
    });

    it('generates holiday work notice in English', () => {
      const result = generateMessage({
        requestType: 'kyujitsu_shukkin',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Holiday Work Notice]');
      expect(result.english).toContain('holiday');
    });
  });

  describe('Other Request', () => {
    it('generates other request subject', () => {
      const result = generateMessage({
        requestType: 'other_request',
        startDate: '2024-01-15',
        adminMessage: '詳細はご確認ください',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【その他連絡】');
    });
  });

  describe('admin_message', () => {
    it('appends admin message to Japanese output', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
        adminMessage: '追加のメモ',
      });
      expect(result.japanese).toContain('追加のメモ');
    });

    it('appends admin message to English output when bilingual', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
        adminMessage: 'Extra note',
      });
      expect(result.english).toContain('Extra note');
    });
  });
});

const baseNotif = {
  requestType: 'late' as const,
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: empName,
};

describe('generateApprovalNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【承認】 in japanese subject', () => {
    expect(generateApprovalNotification(baseNotif).japanese).toContain('【承認】');
  });

  it('includes [Approved] in english subject', () => {
    expect(generateApprovalNotification(baseNotif).english).toContain('[Approved]');
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
    const { timeFrom: _tf, timeTo: _tt, ...noTime } = baseNotif;
    const result = generateApprovalNotification(noTime);
    expect(result.japanese).not.toContain('時間');
    expect(result.english).not.toContain('Time:');
  });

  it('shows 直行 / Chokko for chokko type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'chokko' });
    expect(result.japanese).toContain('直行');
    expect(result.english).toContain('Chokko');
  });

  it('shows 直帰 / Chokki for chokki type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'chokki' });
    expect(result.japanese).toContain('直帰');
    expect(result.english).toContain('Chokki');
  });

  it('shows 休日出勤 / Kyujitsu Shukkin for kyujitsu_shukkin type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'kyujitsu_shukkin' });
    expect(result.japanese).toContain('休日出勤');
    expect(result.english).toContain('Kyujitsu Shukkin');
  });
});

describe('generateRejectionNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【否認】 in japanese subject', () => {
    expect(generateRejectionNotification(baseNotif).japanese).toContain('【否認】');
  });

  it('includes [Not Approved] in english subject', () => {
    expect(generateRejectionNotification(baseNotif).english).toContain('[Not Approved]');
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

  it('shows 直行 / Chokko for chokko type in rejection', () => {
    const result = generateRejectionNotification({ ...baseNotif, requestType: 'chokko' });
    expect(result.japanese).toContain('直行');
    expect(result.english).toContain('Chokko');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd shared && npm test
```

Expected: multiple failures — `train_delay` / `oversleeping` / `child_dropoff` are not valid ReasonCategory values; `chokko` / `chokki` / `kyujitsu_shukkin` cases not implemented in generator.

### Step group B: Implement message generator

- [ ] **Step 3: Replace messageGenerator.ts with updated implementation**

```ts
// shared/src/messageGenerator.ts
import { MessageInput, MessageOutput, NotificationInput, RejectionNotificationInput } from './types';

function formatDateJa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateEn(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const subjectJa: Record<string, string> = {
  late:             '【遅刻連絡】',
  early_departure:  '【早退連絡】',
  absence:          '【欠勤連絡】',
  other_request:    '【その他連絡】',
  chokko:           '【直行連絡】',
  chokki:           '【直帰連絡】',
  kyujitsu_shukkin: '【休日出勤連絡】',
};

const subjectEn: Record<string, string> = {
  late:             '[Late Arrival Notice]',
  early_departure:  '[Early Departure Notice]',
  absence:          '[Absence Notice]',
  other_request:    '[Other Request]',
  chokko:           '[Direct to Client Notice]',
  chokki:           '[Going Directly Home Notice]',
  kyujitsu_shukkin: '[Holiday Work Notice]',
};

function reasonBodyJa(input: MessageInput): string {
  if (!input.reasonCategory) return '';
  switch (input.reasonCategory) {
    case 'illness':
      return `体調不良${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'family':
      return '家庭の事情のため';
    case 'personal':
      return '私用のため';
    case 'weather_transport':
      return '天候・交通機関の影響のため';
    case 'other':
      return `${input.reasonDetail ?? 'その他の理由'}のため`;
  }
}

function reasonBodyEn(input: MessageInput): string {
  if (!input.reasonCategory) return '';
  switch (input.reasonCategory) {
    case 'illness':
      return `illness${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'family':
      return 'family circumstances';
    case 'personal':
      return 'personal reasons';
    case 'weather_transport':
      return 'weather or transportation issues';
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
    const leaveMap: Record<string, string> = {
      paid: '有給休暇', unpaid: '欠勤', substitute: '振替休日', special: '特別休暇（慶弔）',
    };
    const leaveStr = input.leaveType ? `（${leaveMap[input.leaveType]}）` : '';
    body = `${dateStr}${leaveStr}、${reason}お休みをいただきます。`;
  } else if (input.requestType === 'chokko') {
    body = reason
      ? `${dateStr}、${reason}直行いたします。`
      : `${dateStr}、直行いたします。`;
  } else if (input.requestType === 'chokki') {
    body = reason
      ? `${dateStr}、${reason}直帰いたします。`
      : `${dateStr}、直帰いたします。`;
  } else if (input.requestType === 'kyujitsu_shukkin') {
    body = reason
      ? `${dateStr}、出社いたします。（${reason}）`
      : `${dateStr}、出社いたします。`;
  } else {
    body = reason
      ? `${dateStr}、${reason}直帰いたします。`
      : `${dateStr}、直帰いたします。`;
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
    const leaveMap: Record<string, string> = {
      paid: 'paid leave', unpaid: 'unpaid leave', substitute: 'substitute holiday', special: 'special leave',
    };
    const leaveStr = input.leaveType ? ` (${leaveMap[input.leaveType]})` : '';
    body = `I will be absent on ${dateStr}${leaveStr} due to ${reason}.`;
  } else if (input.requestType === 'chokko') {
    body = reason
      ? `I will be going directly to the client on ${dateStr} due to ${reason}.`
      : `I will be going directly to the client on ${dateStr}.`;
  } else if (input.requestType === 'chokki') {
    body = reason
      ? `I will be going directly home from the client on ${dateStr} due to ${reason}.`
      : `I will be going directly home from the client on ${dateStr}.`;
  } else if (input.requestType === 'kyujitsu_shukkin') {
    body = reason
      ? `I will be working on ${dateStr} (holiday) due to ${reason}.`
      : `I will be working on ${dateStr} (holiday).`;
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

const requestTypeJa: Record<string, string> = {
  late:             '遅刻',
  early_departure:  '早退',
  absence:          '欠勤',
  other_request:    'その他',
  chokko:           '直行',
  chokki:           '直帰',
  kyujitsu_shukkin: '休日出勤',
};

const requestTypeEn: Record<string, string> = {
  late:             'Late Arrival',
  early_departure:  'Early Departure',
  absence:          'Absence',
  other_request:    'Other Request',
  chokko:           'Going Directly to Client (Chokko)',
  chokki:           'Going Directly Home (Chokki)',
  kyujitsu_shukkin: 'Holiday Work (Kyujitsu Shukkin)',
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
    `対象日：${dateJa}${timeJa}`,
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
    `対象日：${dateJa}${timeJa}`,
    '',
    '申し訳ありませんが、ご申請の内容を承認することができませんでした。',
  ];
  if (input.rejectionReason) jaLines.push('', `理由：${input.rejectionReason}`);
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
  if (input.rejectionReason) enLines.push('', `Reason: ${input.rejectionReason}`);
  enLines.push('', 'Please contact your manager for further details.');

  return { japanese: jaLines.join('\n'), english: enLines.join('\n') };
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd shared && npm test
```

Expected: all shared tests pass.

- [ ] **Step 5: Build shared to verify TypeScript**

```bash
cd shared && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add shared/src/messageGenerator.ts shared/src/messageGenerator.test.ts
git commit -m "feat: update message generator for new types, reasons, and leave types"
```

---

## Task 4: Backend Route — Validation Fix + Email Subject Map

**Files:**
- Modify: `server/src/routes/requests.test.ts`
- Modify: `server/src/routes/requests.ts`

### Step group A: Update tests first

- [ ] **Step 1: Update requests.test.ts — replace old reason values and add new type test**

Replace every occurrence of `field('reasonCategory', 'oversleeping')` with `field('reasonCategory', 'weather_transport')`. Then add one new test at the end of the `POST /api/requests` describe block:

```ts
// In server/src/routes/requests.test.ts

// Replace all instances:
//   .field('reasonCategory', 'oversleeping')
// with:
//   .field('reasonCategory', 'weather_transport')

// Add after the last existing it() in describe('POST /api/requests'):
it('creates a chokko request without reasonCategory', async () => {
  const res = await request(app)
    .post('/api/requests')
    .set('Authorization', `Bearer ${token}`)
    .field('requestType', 'chokko')
    .field('startDate', '2024-01-15')
    .field('inputLanguage', 'ja');
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
});

it('creates a kyujitsu_shukkin request without reasonCategory', async () => {
  const res = await request(app)
    .post('/api/requests')
    .set('Authorization', `Bearer ${token}`)
    .field('requestType', 'kyujitsu_shukkin')
    .field('startDate', '2024-01-15')
    .field('inputLanguage', 'ja');
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
});
```

- [ ] **Step 2: Run backend tests — expect failures**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=requests
```

Expected: `chokko` and `kyujitsu_shukkin` tests fail with 400 (current validation rejects missing reasonCategory for non-other_request types).

### Step group B: Fix the route

- [ ] **Step 3: Update requests.ts — validation and email subject map**

In `server/src/routes/requests.ts`, make two changes:

**Change 1** — replace the optional-reason check (around line 48):
```ts
// OLD:
if (requestType !== 'other_request' && !reasonCategory) {
  throw new AppError(400, 'Missing required fields');
}

// NEW:
const OPTIONAL_REASON_TYPES = ['other_request', 'chokko', 'chokki', 'kyujitsu_shukkin'];
if (!OPTIONAL_REASON_TYPES.includes(requestType) && !reasonCategory) {
  throw new AppError(400, 'Missing required fields');
}
```

**Change 2** — replace the `subjects` inline record (around line 95):
```ts
// OLD:
const subjects: Record<string, string> = {
  late: '【遅刻連絡】', early_departure: '【早退連絡】',
  absence: '【欠勤連絡】', other_request: '【その他連絡】',
};

// NEW:
const subjects: Record<string, string> = {
  late:             '【遅刻連絡】',
  early_departure:  '【早退連絡】',
  absence:          '【欠勤連絡】',
  other_request:    '【その他連絡】',
  chokko:           '【直行連絡】',
  chokki:           '【直帰連絡】',
  kyujitsu_shukkin: '【休日出勤連絡】',
};
```

- [ ] **Step 4: Run backend tests — expect all to pass**

```bash
cd server && NODE_ENV=test npm test -- --testPathPattern=requests
```

Expected: all request tests pass including the two new ones.

- [ ] **Step 5: Run full backend test suite**

```bash
cd server && NODE_ENV=test npm test
```

Expected: all backend tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/requests.ts server/src/routes/requests.test.ts
git commit -m "feat: update request route for new types — optional reason exemption and email subject map"
```

---

## Task 5: Translations

**Files:**
- Modify: `client/src/locales/ja.json`
- Modify: `client/src/locales/en.json`

- [ ] **Step 1: Update ja.json**

Replace the `request_type` block and `form.reasons` and `form.leave_types` blocks with:

```json
"request_type": {
  "late": "遅刻",
  "early_departure": "早退",
  "absence": "欠勤",
  "other_request": "その他",
  "chokko": "直行",
  "chokki": "直帰",
  "kyujitsu_shukkin": "休日出勤"
},
```

```json
"reasons": {
  "illness": "体調不良",
  "family": "家庭の事情",
  "personal": "私用",
  "weather_transport": "天候・交通機関",
  "other": "その他"
},
```

```json
"leave_types": {
  "paid": "有給休暇",
  "unpaid": "欠勤",
  "substitute": "振替休日",
  "special": "特別休暇（慶弔）"
}
```

- [ ] **Step 2: Update en.json**

Replace the same blocks with:

```json
"request_type": {
  "late": "Late Arrival",
  "early_departure": "Early Departure",
  "absence": "Absence",
  "other_request": "Other Request",
  "chokko": "Going Directly to Client (Chokko)",
  "chokki": "Going Directly Home (Chokki)",
  "kyujitsu_shukkin": "Holiday Work (Kyujitsu Shukkin)"
},
```

```json
"reasons": {
  "illness": "Illness",
  "family": "Family Circumstances",
  "personal": "Personal Reasons",
  "weather_transport": "Weather / Transportation",
  "other": "Other"
},
```

```json
"leave_types": {
  "paid": "Paid Leave",
  "unpaid": "Unpaid Leave",
  "substitute": "Substitute Holiday",
  "special": "Special Leave (Wedding/Funeral)"
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/locales/ja.json client/src/locales/en.json
git commit -m "feat: add translations for new request types, reasons, and leave types"
```

---

## Task 6: Frontend Form

**Files:**
- Modify: `client/src/pages/RequestFormPage.tsx`

- [ ] **Step 1: Replace constants at the top of the file**

Replace the existing constant block (lines 10–29 area) with:

```ts
const OPTIONAL_REASON_TYPES: RequestType[] = ['chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'];

const REASONS_BY_TYPE: Record<RequestType, ReasonCategory[]> = {
  late:             ['illness', 'family', 'personal', 'weather_transport', 'other'],
  early_departure:  ['illness', 'family', 'personal', 'weather_transport', 'other'],
  absence:          ['illness', 'family', 'personal', 'weather_transport', 'other'],
  other_request:    [],
  chokko:           ['illness', 'family', 'personal', 'weather_transport', 'other'],
  chokki:           ['illness', 'family', 'personal', 'weather_transport', 'other'],
  kyujitsu_shukkin: ['illness', 'family', 'personal', 'weather_transport', 'other'],
};

const NEEDS_DETAIL: ReasonCategory[] = ['illness', 'other'];
const TIME_TYPES: RequestType[] = ['late', 'early_departure', 'other_request', 'chokko', 'chokki', 'kyujitsu_shukkin'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid', 'substitute', 'special'];
const TIME_OPTIONS = generateTimeOptions();
const today = new Date().toISOString().split('T')[0];

const DETAIL_PLACEHOLDERS: Partial<Record<ReasonCategory, { ja: string; en: string }>> = {
  illness: { ja: '例：内科を受診しました', en: 'e.g., Visited internal medicine clinic' },
  other:   { ja: '例：詳細を記入してください', en: 'e.g., Please describe the reason in detail' },
};

const ADMIN_MSG_PLACEHOLDERS: Record<RequestType, { ja: string; en: string }> = {
  late:             { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
  early_departure:  { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
  absence:          { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
  other_request:    { ja: '理由を明確に説明してください。', en: 'Please explain the reason clearly.' },
  chokko:           { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
  chokki:           { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
  kyujitsu_shukkin: { ja: '任意：管理者へのコメント', en: 'Optional: note to admin' },
};
```

- [ ] **Step 2: Update derived flags and isValid inside the component**

Replace the block starting at `const reasons = REASONS_BY_TYPE[form.requestType];` through `const isValid = ...`:

```ts
const reasons = REASONS_BY_TYPE[form.requestType];
const showTime = TIME_TYPES.includes(form.requestType);
const showDetail = form.reasonCategory !== '' && NEEDS_DETAIL.includes(form.reasonCategory as ReasonCategory);
const showLeaveType = form.requestType === 'absence';
const showEndDate = form.requestType === 'absence';
const isOtherRequest = form.requestType === 'other_request';
const hasOptionalReason = OPTIONAL_REASON_TYPES.includes(form.requestType);

const reasonRequired = !hasOptionalReason;
const endDateRequired = showEndDate;
const adminMessageRequired = isOtherRequest;

const isValid = isOtherRequest
  ? form.adminMessage.trim() !== ''
  : hasOptionalReason
    ? true
    : form.reasonCategory !== '' &&
      (!showLeaveType || form.leaveType !== '') &&
      (!showDetail || form.reasonDetail.trim() !== '') &&
      (!showEndDate || form.endDate !== '');
```

- [ ] **Step 3: Update the Request Type dropdown and remove train line section**

Replace the request type `<select>` options (the hardcoded array on line ~152):

```tsx
{(['late', 'early_departure', 'absence', 'chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'] as RequestType[]).map(type => (
  <option key={type} value={type}>{t(`request_type.${type}`)}</option>
))}
```

Remove the entire train line `<select>` section (the `{showTrainLine && (…)}` block) — no reason triggers a train line picker anymore.

Also remove `const showTrainLine = form.reasonCategory === 'train_delay';` from the derived flags block.

- [ ] **Step 4: Hide reason section for other_request**

Wrap the reason `<div>` with a condition so it only renders when `reasons.length > 0`:

```tsx
{/* Reason — hidden for other_request which has no reason list */}
{reasons.length > 0 && (
  <div>
    <Label htmlFor="reasonCategory" required={reasonRequired}>{t('form.reason')}</Label>
    <select id="reasonCategory" value={form.reasonCategory} onChange={e => set('reasonCategory', e.target.value as ReasonCategory)} style={inputStyle}>
      <option value="">--</option>
      {reasons.map(r => (
        <option key={r} value={r}>{t(`form.reasons.${r}`)}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript in client**

```bash
cd client && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Run frontend tests**

```bash
cd client && npx vitest run
```

Expected: all frontend tests pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/RequestFormPage.tsx
git commit -m "feat: update request form for new types, simplified reasons, and leave types"
```

---

## Task 7: Full Test Suite Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected output:
```
PASS  shared — X tests
PASS  server — X tests
```
No failures.

- [ ] **Step 2: Run frontend tests**

```bash
cd client && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Build all packages to catch any remaining type errors**

```bash
npm run build
```

Expected: build succeeds for all three packages (shared → server → client).

- [ ] **Step 4: Reseed the dev database**

```bash
cd server && npm run seed
```

This recreates the demo admin + employee with the new enum constraints in place.

- [ ] **Step 5: Commit if any cleanup was done; otherwise done**

If Step 1–3 required any fixes, commit them:
```bash
git add -p
git commit -m "fix: final cleanup after full test suite run"
```

---

## Self-Review Checklist

- [x] **DB migration** covers all 3 enums; data migration maps are complete; test DB also migrated
- [x] **types.ts** — `RequestType`, `ReasonCategory`, `LeaveType` match migration; `MessageInput.reasonCategory` is optional
- [x] **messageGenerator** — `subjectJa/En` has 7 entries; `reasonBodyJa/En` covers all 5 new reasons; `buildJapanese/buildEnglish` branches cover all 7 types; `requestTypeJa/En` maps cover all 7 types (approval/rejection notifications)
- [x] **requests.ts** — `OPTIONAL_REASON_TYPES` list exempts all 4 optional types; `subjects` map has 7 entries
- [x] **Translations** — both `ja.json` and `en.json` have `request_type.*`, `form.reasons.*`, `form.leave_types.*` for all new values
- [x] **Form** — `REASONS_BY_TYPE` has all 7 types; `NEEDS_DETAIL` simplified; `TIME_TYPES` includes new types; train line section removed; dropdown in correct order; `isValid` handles optional-reason types; `ADMIN_MSG_PLACEHOLDERS` has all 7 types
- [x] **Email path coverage matrix** fully addressed across all 3 paths
