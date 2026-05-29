# Deployment Guide

This document covers three things:
1. Generating a Gmail App Password (for local dev SMTP)
2. Setting up Brevo and getting an API key (required for Railway / production)
3. Deploying the attendance system to Railway

---

## Part 1 — Gmail App Password (Local Dev Only)

Gmail requires an App Password when using SMTP with accounts that have 2-Step Verification enabled. This is used locally via Nodemailer.

### Step 1 — Enable 2-Step Verification

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** in the left sidebar
3. Under "How you sign in to Google", click **2-Step Verification**
4. Follow the prompts to enable it if not already on

### Step 2 — Generate an App Password

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - If you don't see this page, 2-Step Verification is not enabled — go back to Step 1
2. Under "App name", type a name like `Attendance System`
3. Click **Create**
4. Google shows a 16-character password (e.g. `abcd efgh ijkl mnop`)
5. **Copy it immediately** — it is only shown once

### Step 3 — Add to .env

Open `.env` in the project root and fill in:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=abcdefghijklmnop       # 16-char app password, no spaces
SMTP_FROM=Attendance System <your.email@gmail.com>
```

> **Note:** `SMTP_PASS` should be the 16 characters with no spaces.

### Verification

Start the dev server and submit a test request. Check the console for email send logs. If you see `Email sent`, it is working.

---

## Part 2 — Brevo API Key (Required for Railway)

Railway hard-blocks outbound TCP on port 587 (SMTP). The system automatically switches to Brevo HTTP API when `BREVO_API_KEY` is set in the environment. Brevo's free tier allows 300 emails/day which is sufficient for this system.

### Step 1 — Create a Brevo Account

1. Go to [brevo.com](https://brevo.com)
2. Click **Sign Up Free**
3. Fill in your name, email, and password
4. Verify your email address via the confirmation email Brevo sends

### Step 2 — Verify Your Sender Email

Brevo requires you to verify the email address you will send from.

1. After logging in, click your account name (top right) → **Senders & IP**
   - Or go directly: **Settings → Senders, Domains & Dedicated IPs → Senders**
2. Click **Add a sender**
3. Enter:
   - **Sender name**: `Attendance System`
   - **Sender email**: the email address that will appear as the "From" address (same value you'll use for `SMTP_FROM`)
4. Click **Save**
5. Brevo sends a verification email to that address — open it and click the confirmation link
6. The sender status should change to **Verified**

### Step 3 — Generate an API Key

1. In the Brevo dashboard, click your account name (top right) → **SMTP & API**
   - Or navigate to: **Settings → SMTP & API**
2. Click the **API Keys** tab
3. Click **Generate a new API key**
4. Enter a name like `attendance-railway`
5. Click **Generate**
6. Copy the key shown (starts with `xkeysib-...`) — it is only shown once

### Step 4 — Set on Railway

See Part 3, Step 6 for where to paste this key. You will set it as:

```
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxx
```

### How the system selects the email provider

`server/src/services/email/NodemailerService.ts` checks at startup:

- If `BREVO_API_KEY` is set → sends via Brevo HTTPS API (port 443)
- Otherwise → sends via Nodemailer SMTP (port 587)

You do **not** need to change any code. Just set the variable.

---

## Part 3 — Railway Deployment

Railway builds and runs the app from the GitHub repository using Nixpacks. The Express server serves both the API and the compiled React frontend as static files.

### Prerequisites

- GitHub account with the `attendance-system` repo pushed to it
- Railway account (free tier works; sign up at [railway.app](https://railway.app))
- Brevo API key from Part 2
- A PostgreSQL database (Railway provides one, see Step 3)

---

### Step 1 — Create a Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account if prompted
5. Find and select the `attendance-system` repository
6. Railway detects the project and queues an initial build (it will likely fail at this point — that is expected until environment variables are set)

---

### Step 2 — Add a PostgreSQL Database

1. Inside your Railway project, click **+ New** (top right or in the canvas)
2. Select **Database → Add PostgreSQL**
3. Railway provisions a PostgreSQL instance and adds it to the project
4. Click on the PostgreSQL service → **Variables** tab
5. You will see `DATABASE_URL` listed — copy its value (starts with `postgresql://...`)

---

### Step 3 — Run Database Migrations

The database needs the schema applied before the app can start.

**Option A — Railway CLI (recommended)**

1. Install the Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```
2. Log in:
   ```bash
   railway login
   ```
3. Link the project:
   ```bash
   cd /path/to/attendance-system
   railway link
   ```
   Select your project and service when prompted.
4. Run migrations against the Railway database:
   ```bash
   DATABASE_URL="<paste the DATABASE_URL from Step 2>" npm run migrate -w server
   ```

**Option B — Local psql**

1. Copy the `DATABASE_URL` from the Railway PostgreSQL service
2. Run:
   ```bash
   cd server
   DATABASE_URL="<paste url here>" npm run migrate
   ```

**Option C — Railway Shell**

1. In the Railway dashboard, click on your app service → **Shell** tab
2. In the shell:
   ```bash
   npm run migrate -w server
   ```

After migrations, optionally seed demo accounts:

```bash
DATABASE_URL="<railway url>" npm run seed -w server
```

This creates:
| Role | Employee No. | Password |
|---|---|---|
| Admin | `ADMIN-001` | `Admin1234!` |
| Employee | `EMP-001` | `Emp1234!` |

---

### Step 4 — Configure the Build Settings

Railway usually auto-detects the build command via Nixpacks. Verify the settings in your app service:

1. Click on the app service (not the PostgreSQL service)
2. Go to **Settings → Build**
3. Confirm:
   - **Build Command**: `npm run build`
   - **Start Command**: `node server/dist/index.js`
4. If these are wrong or missing, set them manually

---

### Step 5 — Set Environment Variables

1. In the Railway app service, click **Variables**
2. Click **New Variable** and add each of the following:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Copy from the PostgreSQL service (Railway may auto-inject this — check if it already exists) |
| `JWT_SECRET` | A long random string (32+ characters). Generate with: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | A different long random string. Generate with: `openssl rand -hex 32` |
| `SMTP_FROM` | `Attendance System <your-verified-brevo-email@example.com>` |
| `BREVO_API_KEY` | The key from Part 2, Step 3 |

> **Do NOT set** `DATABASE_TEST_URL`, `CLIENT_URL`, `PORT`, or `SMTP_HOST/PORT/USER/PASS` on Railway.
> Railway injects `PORT` automatically, and Brevo replaces SMTP entirely.

#### Generating secure secrets

Run this in your terminal (requires OpenSSL, available on macOS/Linux):

```bash
openssl rand -hex 32   # Run twice: once for JWT_SECRET, once for JWT_REFRESH_SECRET
```

Copy each output as the respective variable value.

---

### Step 6 — Trigger a Deployment

1. Go to the **Deployments** tab of your app service
2. Click **Deploy** (or push a new commit to GitHub — Railway auto-deploys on push to the default branch)
3. Watch the build logs — the build runs `npm run build` which:
   - Compiles `shared/` TypeScript
   - Compiles `server/` TypeScript
   - Builds `client/` with Vite (outputs to `client/dist/`)
4. After build completes, Railway starts the server with `node server/dist/index.js`
5. The server:
   - Serves `/api/*` routes from Express
   - Serves `client/dist/` as static files for all other routes

---

### Step 7 — Get Your Public URL

1. In the Railway app service, click **Settings → Networking**
2. Click **Generate Domain** (if not already done)
3. Railway assigns a domain like `attendance-system-production.up.railway.app`
4. Open the URL in your browser — you should see the login page

---

### Step 8 — Verify the Deployment

1. **Login**: Use `ADMIN-001` / `Admin1234!` or `EMP-001` / `Emp1234!`
2. **Submit a request**: Log in as employee, create a late arrival request, click through to ConfirmPage
3. **Email**: Check that the manager receives an email notification
4. **Todoke**: Click "Generate & Attach 届" on ConfirmPage — it should download an xlsx file
5. **Admin dashboard**: Log in as admin, check that the new request appears with unread indicator

---

### Troubleshooting

**Build fails with TypeScript errors**

Check the build logs for the specific error. Common causes:
- Missing environment variables (the build itself doesn't need them, but TypeScript errors in source files will fail the build)
- `shared/dist` is gitignored — Railway rebuilds shared from source, which is correct

**App starts but database errors appear**

- Confirm `DATABASE_URL` is set correctly in Variables
- Confirm migrations were run (Step 3)
- Check the Railway logs: click Deployments → the active deployment → **View Logs**

**Emails are not sending**

1. Check that `BREVO_API_KEY` is set in Railway Variables
2. Check that `SMTP_FROM` matches a verified sender in Brevo (Part 2, Step 2)
3. Railway has a diagnostic endpoint: `GET /api/health/email` — visit `https://your-domain/api/health/email` and check the JSON response

**Todoke generation fails with 400**

The user's profile must have `dispatch_company`, `employee_number`, and `name_ja` set. Edit the employee record via the Admin → Employee Management page and fill in all three fields.

**"Application failed to respond" after deploy**

- Railway uses the `PORT` environment variable. The server reads it from `process.env.PORT` — do not hardcode a port.
- Confirm `NODE_ENV=production` is set so the static file serving is enabled.

---

### Updating the App

Push commits to the `main` branch on GitHub. Railway detects the push and automatically rebuilds and redeploys. There is no downtime gap — Railway runs the old instance until the new one is healthy.

```bash
git add .
git commit -m "your change"
git push origin main
```

Watch the Railway Deployments tab for the new build.
