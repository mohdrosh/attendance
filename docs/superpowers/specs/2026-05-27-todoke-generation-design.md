# Todoke Generation System — Design Spec

**Date:** 2026-05-27
**Status:** Approved

---

## Overview

An optional 届 (todoke) generation feature added to the ConfirmPage. After filling out an attendance request, employees can generate the company's standard 届 Excel form pre-filled with their request data, attach it to the request, and download a local copy. A hanko (personal seal) image is generated and embedded in the form automatically.

---

## Architecture

### New files

| Path | Purpose |
|---|---|
| `server/src/assets/todoke_template.xlsx` | Locked company template (copy of provided file) |
| `server/src/services/todoke/hankoService.ts` | Generates hanko SVG → PNG buffer |
| `server/src/services/todoke/todokeService.ts` | Fills Excel template cells, embeds hanko |
| `server/src/routes/todoke.ts` | `POST /api/todoke/generate` endpoint |

### Modified files

| Path | Change |
|---|---|
| `server/src/app.ts` | Register `/api/todoke` route |
| `server/src/db/migrations/007_dispatch_company.sql` | Add `dispatch_company` column |
| `server/src/db/queries/users.ts` | Include `dispatch_company` in user queries |
| `client/src/pages/ConfirmPage.tsx` | Add Todoke card section |
| `client/src/pages/AdminEmployeesPage.tsx` | Add dispatch_company field in Details tab |
| `client/src/locales/en.json` | Todoke + dispatch_company i18n keys |
| `client/src/locales/ja.json` | Todoke + dispatch_company i18n keys |

### New dependencies

| Package | Where | Purpose |
|---|---|---|
| `exceljs` | server | Read template, fill cells, embed image |
| `@resvg/resvg-js` | server | Convert SVG string → PNG buffer (pre-compiled Rust, no native build) |

---

## Database Migration

```sql
-- 007_dispatch_company.sql
ALTER TABLE users ADD COLUMN dispatch_company VARCHAR(100);
```

`dispatch_company` is nullable. Admins set it per employee via Employee Management. It is included in the existing `GET /api/users/me` response and in admin user queries.

---

## API Endpoint

### `POST /api/todoke/generate`

- **Auth:** Bearer JWT (applicant role only)
- **Content-Type:** `application/json`
- **Request body:**
  ```json
  {
    "requestType": "absence",
    "startDate": "2026-05-28",
    "endDate": "2026-05-29",
    "timeFrom": "09:00",
    "timeTo": "17:45",
    "reasonCategory": "personal",
    "reasonDetail": "",
    "leaveType": "paid",
    "adminMessage": ""
  }
  ```
- **Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` binary stream
- **Filename header:** `Content-Disposition: attachment; filename="todoke_YYYY-MM-DD.xlsx"`
- **Errors:** 401 (no auth), 403 (admin calling), 500 (generation failure)

---

## Excel Cell Mapping

All writes go to sheet `届（設計開発）`. Only unlocked cells are written to (sheet protection is off so writes succeed regardless).

### Header section

| Cell(s) | Value | Source |
|---|---|---|
| Z5 | Year (number) | Today's date |
| AD5 | Month (number) | Today's date |
| AF5 | Day (number) | Today's date |
| V9 | Dispatch company name | `employee.dispatch_company` |
| V11 | Employee name | `employee.name_ja` |
| V13–AB13 | Employee number digits (1 per cell) | `employee.employee_number` (7-digit numeric, split) |

### Type checkboxes

All 8 checkbox cells are reset to `'□'` first, then the matching cell is set to `'☑'`.

| Request Type | Leave Type | Cell set to ☑ |
|---|---|---|
| `late` | — | F20 |
| `early_departure` | — | K20 |
| `absence` | `unpaid` | F18 |
| `absence` | `substitute` | K18 |
| `absence` | `paid` | Q20 |
| `absence` | `special` | W20 |
| `kyujitsu_shukkin` | — | Q18 |
| `other_request` | — | W18 |
| `chokko` | — | W18 |
| `chokki` | — | W18 |

### Period section

| Cell | Value | Source |
|---|---|---|
| J23 | Start year | `startDate` |
| O23 | Start month | `startDate` |
| R23 | Start day | `startDate` |
| W23 | Start day-of-week kanji (月火水木金土日) | `startDate` |
| AA23 | Start hour string | `timeFrom` (HH part), default `'9'` for absence |
| AD23 | Start minute string | `timeFrom` (MM part), default `'00'` for absence |
| J25 | End year | `endDate` if present, else `startDate` |
| O25 | End month | `endDate` if present, else `startDate` |
| R25 | End day | `endDate` if present, else `startDate` |
| W25 | End day-of-week kanji | `endDate` if present, else `startDate` |
| AA25 | End hour string | `timeTo` (HH part), default `'17'` for absence |
| AD25 | End minute string | `timeTo` (MM part), default `'45'` for absence |

Day-of-week kanji map: `['日','月','火','水','木','金','土']` indexed by `Date.getDay()`.

For request types without `timeFrom`/`timeTo` in the form (`absence`, `chokko`, `chokki`), default period times are 09:00 → 17:45. For all other types the actual `timeFrom`/`timeTo` values are used.

### Reason field

| Cell | Value |
|---|---|
| F28 | Constructed reason string (see below) |

**Reason construction by type:**

| Type | F28 value |
|---|---|
| `late` | `{reasonCategory label}（{reasonDetail}）` |
| `early_departure` | `{reasonCategory label}（{reasonDetail}）` |
| `absence` | `{reasonCategory label}（{reasonDetail}）` |
| `other_request` | `adminMessage` value |
| `chokko` | `直行のため。{reasonCategory label if set}` |
| `chokki` | `直帰のため。{reasonCategory label if set}` |
| `kyujitsu_shukkin` | `{reasonCategory label if set}` |

`reasonDetail` is appended in parentheses only when non-empty. `reasonCategory` labels use the same Japanese strings as the existing `messageGenerator.ts` reason maps.

### Notes field

F32 is **left empty** (not written).

---

## Hanko Generation

### Rules

| Script type | Max chars | Over limit action |
|---|---|---|
| Kanji (CJK unified ideographs, Unicode range 4E00–9FFF) | 6 | Use last name (first space-delimited word of `name_ja`) |
| Kana (hiragana/katakana) or mixed | 10 | Use last name |

Script detection: if every character in `name_ja` (excluding spaces) falls in the CJK range U+4E00–U+9FFF → kanji rules; otherwise kana rules.

### Layout by character count

| Chars | Grid | Approx font size (in 90×90 viewBox) |
|---|---|---|
| 1–2 | 1 col | 30px |
| 3 | 1 col | 22px |
| 4 | 2×2 | 19px |
| 5 | 2 cols (3+2) | 16px |
| 6 | 2×3 | 14px |
| 7–8 | 2 cols (4+3 / 4+4) | 14px |
| 9–10 | 2 cols (5+4 / 5+5) | 12px |

Reading order within each column: top-to-bottom. Two columns read right-to-left (Japanese convention: right column first).

### SVG structure

```
<svg width="90" height="90" viewBox="0 0 90 90">
  <circle cx="45" cy="45" r="40" fill="none" stroke="#cc0000" stroke-width="3.5"/>
  <circle cx="45" cy="45" r="35" fill="none" stroke="#cc0000" stroke-width="1"/>
  <!-- character <text> elements positioned by grid layout -->
</svg>
```

Background: fully transparent (no rect, no fill on the SVG root).

### PNG conversion

SVG string → `@resvg/resvg-js` renders at 2× resolution (180×180 px) → returns `Buffer`. ExcelJS embeds the PNG buffer at anchor AF9:AH11 using `addImage` with `editAs: 'oneCell'`.

---

## ConfirmPage UI

The Todoke card is rendered below the message preview section, above the Back/Send buttons.

### States

**Idle (not generated):**
- Orange-bordered card (`#fb923c` border)
- Label: "届 Todoke (Optional)"
- Description: "Generate the official 届 form pre-filled with your request details."
- Button: "Generate & Attach 届" — calls `POST /api/todoke/generate`

**Loading:**
- Button disabled with spinner text

**Generated:**
- Green-bordered card (`#4ade80` border), green background tint
- Label: "届 Todoke ✓ Attached"
- Message: "届 generated and attached to this request."
- Buttons: "⬇ Download 届" (triggers re-download of stored blob) + "✕ Remove" (clears todoke from state)

**On Send:** If todoke blob is in state, it is used as the `file` field in the `multipart/form-data` submission, replacing any manually uploaded file. If removed, the manual file from the original form state is restored.

### State shape addition to ConfirmPage

```ts
const [todoke, setTodoke] = useState<{ blob: Blob; filename: string } | null>(null);
```

---

## Employee Management UI

In `AdminEmployeesPage`, the Details tab gains a new text input field:

- **Label:** 出向会社名 / Dispatch Company
- **Field key:** `dispatch_company`
- Follows the same save/reset/edit pattern as existing fields (work_start, work_end, etc.)
- i18n key: `employees.fields.dispatch_company`

---

## i18n Keys

**en.json additions:**
```json
"todoke": {
  "section_title": "Todoke 届 (Optional)",
  "description": "Generate the official 届 form pre-filled with your request details.",
  "generate": "Generate & Attach 届",
  "generating": "Generating…",
  "attached": "届 Attached ✓",
  "attached_message": "届 generated and attached to this request.",
  "download": "Download 届",
  "remove": "Remove"
},
"employees": {
  "fields": {
    "dispatch_company": "Dispatch Company"
  }
}
```

**ja.json additions:**
```json
"todoke": {
  "section_title": "届（任意）",
  "description": "申請内容をもとに届を自動生成します。",
  "generate": "届を生成・添付",
  "generating": "生成中…",
  "attached": "届 添付済み ✓",
  "attached_message": "届が生成され、申請に添付されました。",
  "download": "届をダウンロード",
  "remove": "削除"
},
"employees": {
  "fields": {
    "dispatch_company": "出向会社名"
  }
}
```

---

## Out of Scope

- No PDF export of the todoke
- No server-side storage of generated todoke files (generated on demand, not cached)
- No preview of the todoke before download
- The template file itself is not editable via the UI
