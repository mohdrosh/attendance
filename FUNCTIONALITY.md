# Attendance Request System — Functionality Document

This system allows foreign employees at a Japanese company to submit late arrival, early departure, and absence notices to their managers, with automatic bilingual message generation.

---

## Users

There are two types of users:

- **Applicant** — a regular employee who submits attendance requests
- **Admin** — a manager who views all submitted requests

All users log in with an employee number and password.

---

## Language

Every screen has a language toggle button in the top-right corner: 🇯🇵 日本語 / 🇬🇧 English.

Switching language changes all UI text instantly. The language the user is in when they fill out the form is recorded as the "input language" and determines how the notification message is generated (see Confirm screen).

---

## Screens

### 1. Login

The user enters their employee number and password and clicks Login.

- If credentials are correct, they are redirected based on their role:
  - Applicant → Dashboard
  - Admin → Admin Dashboard
- If incorrect, an error message is shown.

---

### 2. Applicant — Dashboard

After login, the applicant sees a welcome message with their name.

The page shows their **request history** as a table with columns:
- Date
- Request type (Late / Early Departure / Absence)
- Reason category
- Date submitted

There is a **New Request** button that takes them to the request form.

---

### 3. Applicant — Request Form

The applicant fills out a form with the following fields:

#### Request Type (required)
Three options as radio buttons:
- Late Arrival
- Early Departure
- Absence

#### Date (required)
- Start date (defaults to today)
- End date (for multi-day absences)

#### Time (shown only for Late Arrival and Early Departure)
- Two dropdowns in 30-minute increments, within the employee's working hours (e.g. 09:00–18:00)
- "From" time and "To" time

#### Reason (required, changes based on request type)

**If Late Arrival:**
- Illness → a text area appears to describe symptoms
- Train Delay → a dropdown appears showing the employee's registered train lines
- Oversleeping → no extra input needed
- Other → a text area appears for a free-form explanation

**If Early Departure:**
- Illness → text area for symptoms
- Other → text area for explanation

**If Absence:**
- Illness → text area for symptoms
- Personal Reasons → no extra input needed
- Other → text area for explanation
- **Leave Type (required for absence):** Paid Leave / Unpaid Leave / Substitute Holiday / Other

Once all required fields are filled, a **Review & Confirm** button becomes active.

---

### 4. Applicant — Confirm & Send

This screen shows:

1. **A summary** of the request details the applicant just entered.

2. **A preview of the notification message** that will be sent to their manager(s), automatically generated from the form data.

#### How the message preview works

**If the form was filled in Japanese:**
Only a Japanese message is shown.

Example:
```
件名：【遅刻連絡】山田太郎　2024年1月15日

山田太郎です。
本日、電車遅延（JR東日本 山手線）のため、
出社が10:00頃になります。
ご迷惑をおかけし、申し訳ございません。
```

**If the form was filled in English:**
Both an English message and a Japanese message are shown (English first).

Example:
```
[English]
Subject: [Late Arrival Notice] Taro Yamada - January 15, 2024

This is Taro Yamada.
I will be arriving late today due to train delay (JR East / Yamanote Line).
I expect to arrive at around 10:00.
I sincerely apologize for the inconvenience.

[日本語]
件名：【遅刻連絡】山田太郎　2024年1月15日

山田太郎です。
本日、電車遅延（JR東日本 山手線）のため、
出社が10:00頃になります。
ご迷惑をおかけし、申し訳ございません。
```

The message content is determined by the request type, reason, time, date, and the employee's name. It is generated automatically — the user does not write it.

#### Buttons on this screen

- **Back to Edit** — returns to the request form with the data intact
- **Send** — saves the request and sends the notification email to the manager(s), then redirects to the Dashboard with a success message

---

### 5. Admin — Admin Dashboard

The admin sees a table of **all employees' requests** across the whole company.

Columns:
- Applicant name
- Employee number
- Date
- Request type
- Reason
- Leave type (for absences)
- Date submitted

#### Filters available at the top of the page:
- **Search by name** — text input to filter by applicant name
- **Request type** — dropdown: All / Late / Early Departure / Absence
- **Date range** — start and end date pickers

The table updates based on the active filters.

---

## Email Notification

When an applicant clicks **Send** on the confirm screen, an email is automatically sent to their manager(s). The email contains the same message shown in the preview — bilingual if the form was filled in English, Japanese-only if filled in Japanese.

The applicant does not configure the recipients. Manager assignments are set up in the system in advance.

---

## Session

Users remain logged in for 8 hours. After that, they are redirected to the login screen automatically.

Admins cannot access applicant screens, and applicants cannot access the admin screen. Attempting to navigate to the wrong area redirects automatically.
