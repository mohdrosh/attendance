# Design: Request Type, Reason & Leave Type Update

**Date:** 2026-05-22  
**Status:** Approved

---

## Overview

Expand the attendance request system with 3 new request types (直行, 直帰, 休日出勤), replace the reason category set with a simplified 5-reason list shared across all types, and replace the `other` leave type with `special` (特別休暇（慶弔）). The system is in active development so a clean enum replacement migration is acceptable.

---

## 1. Database Migration (`003_update_enums.sql`)

PostgreSQL enums are altered by:
1. Converting affected columns to `text`
2. Dropping old enum types
3. Recreating enums with the new values only
4. Mapping old row values to new equivalents via `UPDATE`
5. Converting columns back to the new enum types

### New enum definitions

**`request_type`**
```
late | early_departure | absence | other_request | chokko | chokki | kyujitsu_shukkin
```

**`reason_category`**
```
illness | family | personal | weather_transport | other
```
Old values removed: `train_delay`, `oversleeping`, `child_dropoff`, `work_appointment`, `other_appointment`, `direct_home`

**`leave_type`**
```
paid | unpaid | substitute | special
```
Old value removed: `other`

### Data migration map (existing rows)

| Old value | New value | Rationale |
|---|---|---|
| `train_delay` | `weather_transport` | Closest semantic match |
| `oversleeping` | `other` | No direct equivalent |
| `child_dropoff` | `family` | Closest semantic match |
| `work_appointment` | `personal` | Closest semantic match |
| `other_appointment` | `personal` | Closest semantic match |
| `direct_home` | `other` | Was used by other_request type |
| leave `other` | `special` | Direct replacement |

---

## 2. Shared Types (`shared/src/types.ts`)

Updated union types:

```ts
export type RequestType =
  | 'late' | 'early_departure' | 'absence' | 'other_request'
  | 'chokko' | 'chokki' | 'kyujitsu_shukkin';

export type ReasonCategory =
  | 'illness' | 'family' | 'personal' | 'weather_transport' | 'other';

export type LeaveType = 'paid' | 'unpaid' | 'substitute' | 'special';
```

---

## 3. Message Generator (`shared/src/messageGenerator.ts`)

### Subject lines (new types)

| Type | Japanese subject | English subject |
|---|---|---|
| `chokko` | 【直行連絡】 | [Direct to Client Notice] |
| `chokki` | 【直帰連絡】 | [Going Directly Home Notice] |
| `kyujitsu_shukkin` | 【休日出勤連絡】 | [Holiday Work Notice] |

### Body templates (new types)

**直行 (chokko):**
- JA: `{date}、{reason}直行いたします。`
- EN: `I will be going directly to the client on {date}{reason}.`

**直帰 (chokki):**
- JA: `{date}、{reason}直帰いたします。`
- EN: `I will be going directly home from the client on {date}{reason}.`

**休日出勤 (kyujitsu_shukkin):**
- JA: `{date}、出社いたします。{reason}`
- EN: `I will be working on {date} (holiday).{reason}`

### New reason body text

| Reason | Japanese | English |
|---|---|---|
| `illness` | 体調不良のため | due to illness |
| `family` | 家庭の事情のため | due to family circumstances |
| `personal` | 私用のため | due to personal reasons |
| `weather_transport` | 天候・交通機関の影響のため | due to weather or transportation issues |
| `other` | {reasonDetail} のため | due to {reasonDetail} |

`NEEDS_DETAIL` simplified to: `['illness', 'other']`

### Leave type labels in message body

| Value | Japanese | English |
|---|---|---|
| `paid` | 有給休暇 | paid leave |
| `unpaid` | 欠勤 | unpaid leave |
| `substitute` | 振替休日 | substitute holiday |
| `special` | 特別休暇（慶弔） | special leave |

### Approval/rejection notification maps

`requestTypeJa` and `requestTypeEn` in the notification functions must include entries for all 3 new types.

---

## 4. Form Logic (`client/src/pages/RequestFormPage.tsx`)

### `REASONS_BY_TYPE` mapping

| Request Type | Available reasons | Required? |
|---|---|---|
| `late` | illness, family, personal, weather_transport, other | Yes |
| `early_departure` | illness, family, personal, weather_transport, other | Yes |
| `absence` | illness, family, personal, weather_transport, other | Yes |
| `other_request` | *(kept as-is — no reason picker, mandatory admin message)* | — |
| `chokko` | illness, family, personal, weather_transport, other | No |
| `chokki` | illness, family, personal, weather_transport, other | No |
| `kyujitsu_shukkin` | illness, family, personal, weather_transport, other | No |

### Field visibility for new types (chokko, chokki, kyujitsu_shukkin)

| Field | Shown? | Required? |
|---|---|---|
| Date | Yes | Yes |
| Time from/to | Yes | No |
| Reason | Yes | No |
| Reason detail | Yes (if illness or other selected) | No |
| Admin message | Yes | No |
| Leave type | No | — |
| End date | No | — |

### Updated constants

```ts
const TIME_TYPES: RequestType[] = ['late', 'early_departure', 'other_request', 'chokko', 'chokki', 'kyujitsu_shukkin'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid', 'substitute', 'special'];
const NEEDS_DETAIL: ReasonCategory[] = ['illness', 'other'];
```

### Validation (`isValid`) logic

- `late`, `early_departure`, `absence`: reason required + detail if NEEDS_DETAIL + leave type if absence + end date if absence
- `other_request`: admin message required (unchanged)
- `chokko`, `chokki`, `kyujitsu_shukkin`: always valid (all fields optional) as long as date is present

### Form dropdown order

Request type dropdown renders all 7 types in this order:
`late`, `early_departure`, `absence`, `chokko`, `chokki`, `kyujitsu_shukkin`, `other_request`

---

## 5. Translations

### `ja.json`

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
"form": {
  "reasons": {
    "illness": "体調不良",
    "family": "家庭の事情",
    "personal": "私用",
    "weather_transport": "天候・交通機関",
    "other": "その他"
  },
  "leave_types": {
    "paid": "有給休暇",
    "unpaid": "欠勤",
    "substitute": "振替休日",
    "special": "特別休暇（慶弔）"
  }
}
```

### `en.json`

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
"form": {
  "reasons": {
    "illness": "Illness",
    "family": "Family Circumstances",
    "personal": "Personal Reasons",
    "weather_transport": "Weather / Transportation",
    "other": "Other"
  },
  "leave_types": {
    "paid": "Paid Leave",
    "unpaid": "Unpaid Leave",
    "substitute": "Substitute Holiday",
    "special": "Special Leave (Wedding/Funeral)"
  }
}
```

---

## 6. Backend (`server/src/routes/requests.ts`)

### Validation fix
The optional-reason check currently reads:
```ts
if (requestType !== 'other_request' && !reasonCategory)
```
Must be updated to exempt all new types:
```ts
const OPTIONAL_REASON_TYPES = ['other_request', 'chokko', 'chokki', 'kyujitsu_shukkin'];
if (!OPTIONAL_REASON_TYPES.includes(requestType) && !reasonCategory)
```

### Email subject map fix
The `subjects` inline record used to build manager notification subjects:
```ts
const subjects: Record<string, string> = {
  late: '【遅刻連絡】', early_departure: '【早退連絡】',
  absence: '【欠勤連絡】', other_request: '【その他連絡】',
};
```
Must add the 3 new types — otherwise `subjects[requestType]` is `undefined` and the email subject is malformed:
```ts
const subjects: Record<string, string> = {
  late: '【遅刻連絡】', early_departure: '【早退連絡】',
  absence: '【欠勤連絡】', other_request: '【その他連絡】',
  chokko: '【直行連絡】', chokki: '【直帰連絡】',
  kyujitsu_shukkin: '【休日出勤連絡】',
};
```

No schema changes to queries — the DB enum changes handle constraint enforcement.

---

## 7. Email Notification System (all three paths)

There are three distinct email notification paths. Each must handle all 7 request types without producing `undefined`.

### Path 1 — Manager notification on submit (`requests.ts` → `generateMessage`)

**Trigger:** Employee submits a request.  
**Changes needed:**
- `subjectJa` and `subjectEn` records in `messageGenerator.ts` — add 3 new entries (already covered in Section 3 message templates above).
- `buildJapanese` / `buildEnglish` functions — add `else if` branches for `chokko`, `chokki`, `kyujitsu_shukkin`.
- `reasonBodyJa` / `reasonBodyEn` switch statements — replace old cases with 5 new reason cases (`illness`, `family`, `personal`, `weather_transport`, `other`).
- `subjects` inline map in `requests.ts` — add 3 new entries (covered in Section 6 above).

### Path 2 — Employee approval notification (`admin.ts` → `generateApprovalNotification`)

**Trigger:** Admin approves a request and ticks "send notification".  
**Changes needed:**
- `requestTypeJa` record in `messageGenerator.ts` currently only has 4 entries. Add:
  ```ts
  chokko: '直行', chokki: '直帰', kyujitsu_shukkin: '休日出勤'
  ```
- `requestTypeEn` record — add:
  ```ts
  chokko: 'Going Directly to Client (Chokko)',
  chokki: 'Going Directly Home (Chokki)',
  kyujitsu_shukkin: 'Holiday Work (Kyujitsu Shukkin)'
  ```

### Path 3 — Employee rejection notification (`admin.ts` → `generateRejectionNotification`)

**Trigger:** Admin rejects a request and ticks "send notification".  
**Changes needed:** Same `requestTypeJa` / `requestTypeEn` records as Path 2 — no additional changes beyond what Path 2 requires.

### Coverage matrix

| Path | File | Record/Function | New types covered? |
|---|---|---|---|
| Submit → manager | `messageGenerator.ts` | `subjectJa`, `subjectEn` | Must add 3 |
| Submit → manager | `messageGenerator.ts` | `buildJapanese`, `buildEnglish` | Must add 3 branches |
| Submit → manager | `messageGenerator.ts` | `reasonBodyJa`, `reasonBodyEn` | Replace 9 cases → 5 |
| Submit → manager | `requests.ts` | `subjects` inline map | Must add 3 |
| Approve → employee | `messageGenerator.ts` | `requestTypeJa`, `requestTypeEn` | Must add 3 |
| Reject → employee | `messageGenerator.ts` | `requestTypeJa`, `requestTypeEn` | Same as above |

---

## 8. Admin & Dashboard Pages

- Type filter dropdowns in `AdminPage.tsx` and `DashboardPage.tsx` pull labels from `t('request_type.*')`, so they pick up new types automatically via i18n.
- No code changes needed in those pages — new keys in translation files are sufficient.

---

## 9. Files Changed (summary)

| File | Change |
|---|---|
| `server/src/db/migrations/003_update_enums.sql` | New migration — drop/recreate enums, migrate data |
| `shared/src/types.ts` | Updated union types |
| `shared/src/messageGenerator.ts` | New subjects, body branches, reason/leave maps, requestType maps |
| `client/src/pages/RequestFormPage.tsx` | New types, reasons, validation, dropdown order |
| `client/src/locales/ja.json` | New keys for types, reasons, leave types |
| `client/src/locales/en.json` | New keys with English translations |
| `server/src/routes/requests.ts` | Optional-reason exemption list + subjects map |

---

## Out of Scope

- No changes to admin create/edit employee flow
- No changes to attachment, auth, or refresh token logic
