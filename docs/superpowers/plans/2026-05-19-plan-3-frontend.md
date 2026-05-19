# Attendance System — Plan 3: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete React frontend — auth, bilingual UI, applicant request flow, and admin dashboard.

**Architecture:** Vite + React + TypeScript. Global state via AuthContext only. Form state flows through React Router `location.state`. react-i18next for bilingual UI (default `ja`, preference in `localStorage`). No Redux/Zustand. All components tested with Vitest + React Testing Library.

**Tech Stack:** React 18, React Router v6, react-i18next, Vite, Vitest, @testing-library/react

**Pre-requisite:** Plans 1 and 2 complete. Backend server running on port 4000.

---

## Task 14: Vite + React Setup

**Files:**
- Create: `client/` (via Vite scaffold)
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/vite.config.ts`

- [ ] **Step 1: Scaffold Vite app**

```bash
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install react-router-dom react-i18next i18next
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitest/coverage-v8
```

- [ ] **Step 2: Update `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 3: Create `client/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Create i18n locale files `client/src/locales/ja.json`**

```json
{
  "login": {
    "title": "勤怠申請システム",
    "employee_number": "社員番号",
    "password": "パスワード",
    "submit": "ログイン",
    "error": "社員番号またはパスワードが正しくありません"
  },
  "nav": {
    "new_request": "新規申請",
    "logout": "ログアウト",
    "profile": "プロフィール"
  },
  "dashboard": {
    "title": "申請一覧",
    "refresh": "更新",
    "no_requests": "申請はありません",
    "columns": {
      "date": "日付",
      "type": "申請種別",
      "reason": "理由",
      "submitted": "申請日",
      "status": "ステータス"
    }
  },
  "request_type": {
    "late": "遅刻",
    "early_departure": "早退",
    "absence": "欠勤",
    "other_request": "その他"
  },
  "status": {
    "pending": "承認待ち",
    "approved": "承認済み",
    "rejected": "却下"
  },
  "form": {
    "title": "勤怠申請",
    "request_type": "申請種別",
    "date": "日付",
    "start_date": "開始日",
    "end_date": "終了日",
    "time_from": "開始時間",
    "time_to": "終了時間",
    "reason": "理由",
    "reason_detail": "詳細",
    "train_line": "路線",
    "leave_type": "休暇種別",
    "admin_message": "管理者へのメッセージ（任意）",
    "attach_file": "ファイル添付（PDF/XLSX、3MBまで）",
    "next": "確認へ",
    "reasons": {
      "train_delay": "電車遅延",
      "oversleeping": "寝過ごし",
      "child_dropoff": "保育園・学校の送り",
      "illness": "体調不良",
      "personal": "私用",
      "work_appointment": "業務上のアポイント",
      "other_appointment": "その他アポイント",
      "direct_home": "客先直帰",
      "other": "その他"
    },
    "leave_types": {
      "paid": "有給休暇",
      "unpaid": "欠勤",
      "substitute": "振替休日",
      "other": "その他"
    }
  },
  "confirm": {
    "title": "申請内容確認",
    "summary": "申請内容",
    "message_preview": "通知メッセージ",
    "recipients": "送信先（クリックして確認）",
    "back": "修正する",
    "send": "送信する"
  },
  "admin": {
    "title": "申請管理",
    "filter_name": "名前で検索",
    "filter_type": "申請種別",
    "filter_from": "開始日",
    "filter_to": "終了日",
    "filter_status": "ステータス",
    "all": "すべて",
    "columns": {
      "name": "氏名",
      "employee_number": "社員番号",
      "date": "日付",
      "type": "申請種別",
      "reason": "理由",
      "leave_type": "休暇種別",
      "submitted": "申請日",
      "status": "ステータス"
    }
  },
  "detail_panel": {
    "title": "申請詳細",
    "approve": "承認",
    "reject": "却下",
    "attachment": "添付ファイル",
    "download": "ダウンロード",
    "admin_message": "管理者へのメッセージ"
  },
  "profile": {
    "title": "プロフィール",
    "employee_number": "社員番号",
    "role": "役割",
    "train_lines": "登録路線",
    "roles": {
      "applicant": "一般社員",
      "admin": "管理者"
    }
  },
  "toast": {
    "request_sent": "申請を送信しました。承認待ちです。"
  }
}
```

- [ ] **Step 5: Create `client/src/locales/en.json`**

```json
{
  "login": {
    "title": "Attendance Request System",
    "employee_number": "Employee Number",
    "password": "Password",
    "submit": "Login",
    "error": "Invalid employee number or password"
  },
  "nav": {
    "new_request": "New Request",
    "logout": "Logout",
    "profile": "Profile"
  },
  "dashboard": {
    "title": "My Requests",
    "refresh": "Refresh",
    "no_requests": "No requests yet",
    "columns": {
      "date": "Date",
      "type": "Type",
      "reason": "Reason",
      "submitted": "Submitted",
      "status": "Status"
    }
  },
  "request_type": {
    "late": "Late Arrival",
    "early_departure": "Early Departure",
    "absence": "Absence",
    "other_request": "Other Request"
  },
  "status": {
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "form": {
    "title": "Attendance Request",
    "request_type": "Request Type",
    "date": "Date",
    "start_date": "Start Date",
    "end_date": "End Date",
    "time_from": "From",
    "time_to": "To",
    "reason": "Reason",
    "reason_detail": "Details",
    "train_line": "Train Line",
    "leave_type": "Leave Type",
    "admin_message": "Message to Admin (optional)",
    "attach_file": "Attach File (PDF/XLSX, max 3MB)",
    "next": "Review & Confirm",
    "reasons": {
      "train_delay": "Train Delay",
      "oversleeping": "Oversleeping",
      "child_dropoff": "Dropping child at school/daycare",
      "illness": "Illness",
      "personal": "Personal Reasons",
      "work_appointment": "Work-related appointment",
      "other_appointment": "Other appointment",
      "direct_home": "Going home directly from client",
      "other": "Other"
    },
    "leave_types": {
      "paid": "Paid Leave",
      "unpaid": "Unpaid Leave",
      "substitute": "Substitute Holiday",
      "other": "Other"
    }
  },
  "confirm": {
    "title": "Confirm Request",
    "summary": "Request Summary",
    "message_preview": "Notification Message",
    "recipients": "Recipients (click to view)",
    "back": "Back to Edit",
    "send": "Send"
  },
  "admin": {
    "title": "Request Management",
    "filter_name": "Search by name",
    "filter_type": "Request Type",
    "filter_from": "From Date",
    "filter_to": "To Date",
    "filter_status": "Status",
    "all": "All",
    "columns": {
      "name": "Name",
      "employee_number": "Emp. No.",
      "date": "Date",
      "type": "Type",
      "reason": "Reason",
      "leave_type": "Leave Type",
      "submitted": "Submitted",
      "status": "Status"
    }
  },
  "detail_panel": {
    "title": "Request Detail",
    "approve": "Approve",
    "reject": "Reject",
    "attachment": "Attachment",
    "download": "Download",
    "admin_message": "Message from employee"
  },
  "profile": {
    "title": "Profile",
    "employee_number": "Employee Number",
    "role": "Role",
    "train_lines": "Registered Train Lines",
    "roles": {
      "applicant": "Employee",
      "admin": "Admin"
    }
  },
  "toast": {
    "request_sent": "Request sent. Pending approval."
  }
}
```

- [ ] **Step 6: Create `client/src/i18n.ts`**

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';

const savedLang = localStorage.getItem('lang') ?? 'ja';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: savedLang,
  fallbackLng: 'ja',
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffold React app with i18n (EN/JA) and Vite proxy"
```

---

## Task 15: AuthContext + API Client + ProtectedRoute

**Files:**
- Create: `client/src/api/client.ts`
- Create: `client/src/context/AuthContext.tsx`
- Create: `client/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create `client/src/api/client.ts`**

```typescript
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && path !== '/api/auth/login') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...options, headers, credentials: 'include' });
    }
  }
  return res;
}
```

- [ ] **Step 2: Create `client/src/context/AuthContext.tsx`**

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '@attendance/shared';
import { setAccessToken, apiFetch } from '../api/client';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  login: (employeeNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/auth/refresh', { method: 'POST' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(employeeNumber: string, password: string) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employee_number: employeeNumber, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Create `client/src/components/ProtectedRoute.tsx`**

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '@attendance/shared';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ role, children }: Props) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Update `client/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 5: Update `client/src/App.tsx`**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestFormPage } from './pages/RequestFormPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { AdminPage } from './pages/AdminPage';
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
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add AuthContext, API client with auto-refresh, and ProtectedRoute"
```

---

## Task 16: Layout Components (Navbar, LanguageToggle, ProfilePanel, Toast)

**Files:**
- Create: `client/src/components/Navbar.tsx`
- Create: `client/src/components/LanguageToggle.tsx`
- Create: `client/src/components/ProfilePanel.tsx`
- Create: `client/src/components/Toast.tsx`
- Create: `client/src/context/ToastContext.tsx`

- [ ] **Step 1: Create `client/src/context/ToastContext.tsx`**

```typescript
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ToastState {
  message: string | null;
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ message, showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Create `client/src/components/Toast.tsx`**

```typescript
import { useToast } from '../context/ToastContext';

export function Toast() {
  const { message } = useToast();
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#2d6a4f', color: 'white', padding: '12px 24px', borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999, maxWidth: '480px', textAlign: 'center',
    }}>
      {message}
    </div>
  );
}
```

- [ ] **Step 3: Create `client/src/components/LanguageToggle.tsx`**

```typescript
import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';

  function toggle() {
    const next = isJa ? 'en' : 'ja';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  }

  return (
    <button onClick={toggle} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '4px 10px' }}>
      {isJa ? '🇬🇧 English' : '🇯🇵 日本語'}
    </button>
  );
}
```

- [ ] **Step 4: Create `client/src/components/ProfilePanel.tsx`**

```typescript
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfilePanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 }} />}
      <div style={{
        position: 'fixed', top: 0, right: open ? 0 : '-320px', width: '320px',
        height: '100vh', background: 'white', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 101, padding: '24px', transition: 'right 0.25s ease', overflowY: 'auto',
      }}>
        <h2>{t('profile.title')}</h2>
        <dl style={{ lineHeight: 2 }}>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('profile.employee_number')}</dt>
          <dd>{user.employee_number}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>名前</dt>
          <dd>{user.name_ja} / {user.name_en}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('profile.role')}</dt>
          <dd>{t(`profile.roles.${user.role}`)}</dd>
          {user.trainLines.length > 0 && (
            <>
              <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('profile.train_lines')}</dt>
              <dd>
                <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                  {user.trainLines.map(l => (
                    <li key={l.id}>{l.line_name_ja} / {l.line_name_en}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create `client/src/components/Navbar.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageToggle } from './LanguageToggle';
import { ProfilePanel } from './ProfilePanel';

export function Navbar() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee', background: 'white' }}>
        <span style={{ fontWeight: 'bold' }}>勤怠申請</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <LanguageToggle />
          <button onClick={() => setProfileOpen(true)} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '4px 10px' }}>
            {t('nav.profile')}
          </button>
          <button onClick={handleLogout} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ccc', borderRadius: '4px', padding: '4px 10px' }}>
            {t('nav.logout')}
          </button>
        </div>
      </nav>
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
```

- [ ] **Step 6: Add ToastProvider to `client/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Toast } from './components/Toast';
import App from './App';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
          <Toast />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add Navbar, LanguageToggle, ProfilePanel, and Toast components"
```

---

## Task 17: Login Page

**Files:**
- Create: `client/src/pages/LoginPage.tsx`
- Create: `client/src/pages/LoginPage.test.tsx`

- [ ] **Step 1: Write test first — `client/src/pages/LoginPage.test.tsx`**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LoginPage } from './LoginPage';
import { vi } from 'vitest';
import '../../src/i18n';

function renderLoginPage(login = vi.fn()) {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: null, loading: false, login, logout: vi.fn() }}>
        <LoginPage />
      </AuthContext.Provider>
    </BrowserRouter>
  );
}

describe('LoginPage', () => {
  it('renders employee number and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/社員番号|Employee Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード|Password/i)).toBeInTheDocument();
  });

  it('calls login with entered credentials on submit', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLoginPage(login);
    fireEvent.change(screen.getByLabelText(/社員番号|Employee Number/i), { target: { value: 'EMP-001' } });
    fireEvent.change(screen.getByLabelText(/パスワード|Password/i), { target: { value: 'Test1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /ログイン|Login/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('EMP-001', 'Test1234!'));
  });

  it('shows error message on failed login', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    renderLoginPage(login);
    fireEvent.change(screen.getByLabelText(/社員番号|Employee Number/i), { target: { value: 'BAD' } });
    fireEvent.change(screen.getByLabelText(/パスワード|Password/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /ログイン|Login/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd client && npx vitest run src/pages/LoginPage.test.tsx
```

Expected: FAIL — `LoginPage` not found.

- [ ] **Step 3: Create `client/src/pages/LoginPage.tsx`**

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageToggle } from '../components/LanguageToggle';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(employeeNumber, password);
    } catch {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
        <LanguageToggle />
      </div>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', width: '360px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: '1.2em', textAlign: 'center' }}>{t('login.title')}</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="employee_number" style={{ display: 'block', marginBottom: '4px' }}>{t('login.employee_number')}</label>
            <input id="employee_number" value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '4px' }}>{t('login.password')}</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} required />
          </div>
          {error && <div role="alert" style={{ color: 'red', marginBottom: '12px', fontSize: '0.9em' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em' }}>
            {loading ? '...' : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Export AuthContext from `client/src/context/AuthContext.tsx`**

Add `export { AuthContext }` to the context file so tests can access it directly:

In `AuthContext.tsx`, change:
```typescript
const AuthContext = createContext<AuthState | null>(null);
```
to:
```typescript
export const AuthContext = createContext<AuthState | null>(null);
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd client && npx vitest run src/pages/LoginPage.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
cd ..
git add .
git commit -m "feat: add Login page with bilingual support and error handling"
```

---

## Task 18: Dashboard Page

**Files:**
- Create: `client/src/pages/DashboardPage.tsx`
- Create: `client/src/hooks/useRequests.ts`

- [ ] **Step 1: Create `client/src/hooks/useRequests.ts`**

```typescript
import { useState, useCallback } from 'react';
import { Request as AttendanceRequest } from '@attendance/shared';
import { apiFetch } from '../api/client';

export function useRequests() {
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/requests');
      if (res.ok) setRequests(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  return { requests, loading, fetchRequests };
}
```

- [ ] **Step 2: Create `client/src/pages/DashboardPage.tsx`**

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { useRequests } from '../hooks/useRequests';
import { RequestStatus } from '@attendance/shared';

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: '#e8a838',
  approved: '#2d6a4f',
  rejected: '#c0392b',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requests, loading, fetchRequests } = useRequests();

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1>{t('dashboard.title')}</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchRequests} disabled={loading} style={{ padding: '8px 16px', cursor: 'pointer' }}>
              {loading ? '...' : t('dashboard.refresh')}
            </button>
            <button onClick={() => navigate('/request/new')} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {t('nav.new_request')}
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <p style={{ color: '#888' }}>{t('dashboard.no_requests')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.date')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.type')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.reason')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.submitted')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
                  <td style={{ padding: '8px' }}>{t(`request_type.${r.request_type}`)}</td>
                  <td style={{ padding: '8px' }}>{t(`form.reasons.${r.reason_category}`)}</td>
                  <td style={{ padding: '8px' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ color: STATUS_COLORS[r.status], fontWeight: 'bold' }}>
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Dashboard page with request history and refresh button"
```

---

## Task 19: Request Form Page

**Files:**
- Create: `client/src/pages/RequestFormPage.tsx`
- Create: `client/src/utils/timeOptions.ts`

- [ ] **Step 1: Create `client/src/utils/timeOptions.ts`**

```typescript
export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}
```

- [ ] **Step 2: Create `client/src/pages/RequestFormPage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { generateTimeOptions } from '../utils/timeOptions';
import { RequestType, ReasonCategory, LeaveType } from '@attendance/shared';

const REASONS_BY_TYPE: Record<RequestType, ReasonCategory[]> = {
  late: ['train_delay', 'oversleeping', 'child_dropoff', 'other'],
  early_departure: ['illness', 'work_appointment', 'other_appointment', 'other'],
  absence: ['illness', 'personal', 'other'],
  other_request: ['direct_home', 'other'],
};

const NEEDS_DETAIL: ReasonCategory[] = ['illness', 'other_appointment', 'other'];
const TIME_TYPES: RequestType[] = ['late', 'early_departure'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid', 'substitute', 'other'];
const TIME_OPTIONS = generateTimeOptions();
const today = new Date().toISOString().split('T')[0];

interface FormState {
  requestType: RequestType;
  startDate: string;
  endDate: string;
  timeFrom: string;
  timeTo: string;
  reasonCategory: ReasonCategory | '';
  reasonDetail: string;
  trainLineId: string;
  leaveType: LeaveType | '';
  adminMessage: string;
  file: File | null;
  fileError: string;
}

export function RequestFormPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    requestType: 'late',
    startDate: today,
    endDate: '',
    timeFrom: '09:00',
    timeTo: '10:00',
    reasonCategory: '',
    reasonDetail: '',
    trainLineId: '',
    leaveType: '',
    adminMessage: '',
    file: null,
    fileError: '',
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(type: RequestType) {
    setForm(prev => ({ ...prev, requestType: type, reasonCategory: '', reasonDetail: '', trainLineId: '', leaveType: '' }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowed.includes(file.type)) return set('fileError', 'Only PDF or XLSX files are allowed');
      if (file.size > 3 * 1024 * 1024) return set('fileError', 'File must be under 3 MB');
    }
    setForm(prev => ({ ...prev, file, fileError: '' }));
  }

  const reasons = REASONS_BY_TYPE[form.requestType];
  const showTime = TIME_TYPES.includes(form.requestType);
  const showDetail = form.reasonCategory !== '' && NEEDS_DETAIL.includes(form.reasonCategory as ReasonCategory);
  const showTrainLine = form.reasonCategory === 'train_delay';
  const showLeaveType = form.requestType === 'absence';
  const showEndDate = form.requestType === 'absence';

  const isValid = form.reasonCategory !== '' &&
    (!showLeaveType || form.leaveType !== '') &&
    (!showDetail || form.reasonDetail.trim() !== '');

  function handleNext() {
    if (!isValid || !user) return;
    navigate('/request/confirm', {
      state: {
        form: { ...form, inputLanguage: i18n.language as 'ja' | 'en' },
        user,
      },
    });
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>{t('form.title')}</h1>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.request_type')}</label>
          {(['late', 'early_departure', 'absence', 'other_request'] as RequestType[]).map(type => (
            <label key={type} style={{ marginRight: '16px', cursor: 'pointer' }}>
              <input type="radio" name="requestType" value={type} checked={form.requestType === type} onChange={() => handleTypeChange(type)} />
              {' '}{t(`request_type.${type}`)}
            </label>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="startDate" style={{ display: 'block', marginBottom: '4px' }}>{showEndDate ? t('form.start_date') : t('form.date')}</label>
          <input id="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>

        {showEndDate && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="endDate" style={{ display: 'block', marginBottom: '4px' }}>{t('form.end_date')}</label>
            <input id="endDate" type="date" value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        )}

        {showTime && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="timeFrom" style={{ display: 'block', marginBottom: '4px' }}>{t('form.time_from')}</label>
              <select id="timeFrom" value={form.timeFrom} onChange={e => set('timeFrom', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="timeTo" style={{ display: 'block', marginBottom: '4px' }}>{t('form.time_to')}</label>
              <select id="timeTo" value={form.timeTo} onChange={e => set('timeTo', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.reason')}</label>
          {reasons.map(r => (
            <label key={r} style={{ display: 'block', cursor: 'pointer', marginBottom: '4px' }}>
              <input type="radio" name="reason" value={r} checked={form.reasonCategory === r} onChange={() => set('reasonCategory', r)} />
              {' '}{t(`form.reasons.${r}`)}
            </label>
          ))}
        </div>

        {showTrainLine && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="trainLine" style={{ display: 'block', marginBottom: '4px' }}>{t('form.train_line')}</label>
            <select id="trainLine" value={form.trainLineId} onChange={e => set('trainLineId', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
              <option value="">--</option>
              {user?.trainLines.map(l => (
                <option key={l.id} value={l.id}>{i18n.language === 'ja' ? l.line_name_ja : l.line_name_en}</option>
              ))}
            </select>
          </div>
        )}

        {showDetail && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="reasonDetail" style={{ display: 'block', marginBottom: '4px' }}>{t('form.reason_detail')}</label>
            <textarea id="reasonDetail" value={form.reasonDetail} onChange={e => set('reasonDetail', e.target.value)} rows={3} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
          </div>
        )}

        {showLeaveType && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.leave_type')}</label>
            {LEAVE_TYPES.map(lt => (
              <label key={lt} style={{ marginRight: '16px', cursor: 'pointer' }}>
                <input type="radio" name="leaveType" value={lt} checked={form.leaveType === lt} onChange={() => set('leaveType', lt)} />
                {' '}{t(`form.leave_types.${lt}`)}
              </label>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="adminMessage" style={{ display: 'block', marginBottom: '4px' }}>{t('form.admin_message')}</label>
          <textarea id="adminMessage" value={form.adminMessage} onChange={e => set('adminMessage', e.target.value)} rows={2} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.attach_file')}</label>
          <input type="file" accept=".pdf,.xlsx" onChange={handleFileChange} />
          {form.fileError && <p style={{ color: 'red', fontSize: '0.85em', marginTop: '4px' }}>{form.fileError}</p>}
          {form.file && !form.fileError && <p style={{ color: 'green', fontSize: '0.85em', marginTop: '4px' }}>✓ {form.file.name}</p>}
        </div>

        <button onClick={handleNext} disabled={!isValid} style={{ padding: '10px 24px', background: isValid ? '#2563eb' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '1em' }}>
          {t('form.next')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add RequestForm page with all conditional fields"
```

---

## Task 20: Confirm Page

**Files:**
- Create: `client/src/pages/ConfirmPage.tsx`

- [ ] **Step 1: Create `client/src/pages/ConfirmPage.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateMessage } from '@attendance/shared';
import { Navbar } from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import { Manager } from '@attendance/shared';

export function ConfirmPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { form, user } = location.state ?? {};

  const [managersOpen, setManagersOpen] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [sending, setSending] = useState(false);

  if (!form || !user) {
    navigate('/request/new');
    return null;
  }

  const trainLine = user.trainLines.find((l: any) => l.id === form.trainLineId);
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

  async function handleExpandManagers() {
    if (managersOpen) { setManagersOpen(false); return; }
    setManagersOpen(true);
    if (managers.length > 0) return;
    setLoadingManagers(true);
    try {
      const res = await apiFetch('/api/users/me/managers');
      if (res.ok) setManagers(await res.json());
    } finally {
      setLoadingManagers(false);
    }
  }

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

      const res = await apiFetch('/api/requests', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to submit');

      const managerNames = managers.length > 0
        ? managers.map((m: Manager) => i18n.language === 'ja' ? m.name_ja : m.name_en).join(', ')
        : t('toast.request_sent');

      showToast(managers.length > 0
        ? (i18n.language === 'ja'
          ? `申請を ${managerNames} に送信しました。承認待ちです。`
          : `Request sent to ${managerNames} and is pending approval.`)
        : t('toast.request_sent')
      );
      navigate('/dashboard');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>
        <h1>{t('confirm.title')}</h1>

        <section style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '12px' }}>{t('confirm.summary')}</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '8px' }}>
            <dt style={{ color: '#888' }}>{t('form.request_type')}</dt><dd>{t(`request_type.${form.requestType}`)}</dd>
            <dt style={{ color: '#888' }}>{t('form.date')}</dt><dd>{form.startDate}{form.endDate ? ` – ${form.endDate}` : ''}</dd>
            <dt style={{ color: '#888' }}>{t('form.reason')}</dt><dd>{t(`form.reasons.${form.reasonCategory}`)}</dd>
            {form.reasonDetail && <><dt style={{ color: '#888' }}>{t('form.reason_detail')}</dt><dd>{form.reasonDetail}</dd></>}
            {form.leaveType && <><dt style={{ color: '#888' }}>{t('form.leave_type')}</dt><dd>{t(`form.leave_types.${form.leaveType}`)}</dd></>}
            {form.adminMessage && <><dt style={{ color: '#888' }}>{t('detail_panel.admin_message')}</dt><dd>{form.adminMessage}</dd></>}
            {form.file && <><dt style={{ color: '#888' }}>File</dt><dd>📎 {form.file.name}</dd></>}
          </dl>
        </section>

        <section style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '12px' }}>{t('confirm.message_preview')}</h2>
          {english && (
            <div style={{ marginBottom: '16px' }}>
              <strong>[English]</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9em', marginTop: '8px' }}>{english}</pre>
            </div>
          )}
          <div>
            {english && <strong>[日本語]</strong>}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9em', marginTop: english ? '8px' : 0 }}>{japanese}</pre>
          </div>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <button onClick={handleExpandManagers} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: '4px', padding: '8px 12px', width: '100%', textAlign: 'left' }}>
            {t('confirm.recipients')} {managersOpen ? '▲' : '▼'}
          </button>
          {managersOpen && (
            <div style={{ padding: '12px', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
              {loadingManagers ? '...' : managers.length === 0
                ? <span style={{ color: '#888' }}>No managers assigned</span>
                : managers.map((m: Manager) => <div key={m.id}>{m.name_ja} / {m.name_en}</div>)
              }
            </div>
          )}
        </section>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/request/new', { state: { form } })} style={{ padding: '10px 24px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>
            {t('confirm.back')}
          </button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {sending ? '...' : t('confirm.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add Confirm page with message preview, lazy manager list, and send"
```

---

## Task 21: Admin Dashboard + Detail Panel

**Files:**
- Create: `client/src/pages/AdminPage.tsx`
- Create: `client/src/components/RequestDetailPanel.tsx`

- [ ] **Step 1: Create `client/src/components/RequestDetailPanel.tsx`**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Request as AttendanceRequest, RequestStatus } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}

export function RequestDetailPanel({ request, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  if (!request) return null;

  async function handleAction(status: 'approved' | 'rejected') {
    if (!request) return;
    setLoading(status === 'approved' ? 'approve' : 'reject');
    try {
      const res = await apiFetch(`/api/admin/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res.ok) onStatusChange(request.id, status);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '400px', height: '100vh',
        background: 'white', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 101, padding: '24px', overflowY: 'auto',
      }}>
        <h2 style={{ marginBottom: '16px' }}>{t('detail_panel.title')}</h2>

        <dl style={{ lineHeight: 2, marginBottom: '24px' }}>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.name')}</dt>
          <dd>{request.employee_name_ja} / {request.employee_name_en}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.type')}</dt>
          <dd>{t(`request_type.${request.request_type}`)}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.date')}</dt>
          <dd>{request.start_date}{request.end_date ? ` – ${request.end_date}` : ''}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.reason')}</dt>
          <dd>{t(`form.reasons.${request.reason_category}`)}</dd>
          {request.reason_detail && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('form.reason_detail')}</dt><dd>{request.reason_detail}</dd></>}
          {request.leave_type && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.leave_type')}</dt><dd>{t(`form.leave_types.${request.leave_type}`)}</dd></>}
          {request.admin_message && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('detail_panel.admin_message')}</dt><dd>{request.admin_message}</dd></>}
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.status')}</dt>
          <dd>{t(`status.${request.status}`)}</dd>
        </dl>

        {request.attachment && (
          <div style={{ marginBottom: '24px', padding: '12px', border: '1px solid #eee', borderRadius: '4px' }}>
            <strong>{t('detail_panel.attachment')}: </strong>
            <a href={`/api/attachments/${request.attachment.id}`} download={request.attachment.original_filename}>
              📎 {request.attachment.original_filename}
            </a>
          </div>
        )}

        {request.status === 'pending' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => handleAction('approved')} disabled={!!loading} style={{ flex: 1, padding: '10px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading === 'approve' ? '...' : t('detail_panel.approve')}
            </button>
            <button onClick={() => handleAction('rejected')} disabled={!!loading} style={{ flex: 1, padding: '10px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading === 'reject' ? '...' : t('detail_panel.reject')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `client/src/pages/AdminPage.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { RequestDetailPanel } from '../components/RequestDetailPanel';
import { apiFetch } from '../api/client';
import { Request as AttendanceRequest, RequestStatus, RequestType } from '@attendance/shared';

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: '#e8a838',
  approved: '#2d6a4f',
  rejected: '#c0392b',
};

export function AdminPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [selected, setSelected] = useState<AttendanceRequest | null>(null);
  const [filters, setFilters] = useState({ name: '', type: '', from: '', to: '', status: '' });

  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.type) params.set('type', filters.type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.status) params.set('status', filters.status);
    const res = await apiFetch(`/api/admin/requests?${params}`);
    if (res.ok) setRequests(await res.json());
  }, [filters]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  function handleStatusChange(id: string, status: RequestStatus) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '16px' }}>{t('admin.title')}</h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <input placeholder={t('admin.filter_name')} value={filters.name} onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="">{t('admin.all')}</option>
            {(['late', 'early_departure', 'absence', 'other_request'] as RequestType[]).map(type => (
              <option key={type} value={type}>{t(`request_type.${type}`)}</option>
            ))}
          </select>
          <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="">{t('admin.all')}</option>
            {(['pending', 'approved', 'rejected'] as RequestStatus[]).map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>{t('admin.columns.name')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.employee_number')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.date')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.type')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.reason')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.submitted')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} onClick={() => setSelected(r)} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '8px' }}>{r.employee_name_ja}</td>
                <td style={{ padding: '8px' }}>{r.employee_number}</td>
                <td style={{ padding: '8px' }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
                <td style={{ padding: '8px' }}>{t(`request_type.${r.request_type}`)}</td>
                <td style={{ padding: '8px' }}>{t(`form.reasons.${r.reason_category}`)}</td>
                <td style={{ padding: '8px' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ color: STATUS_COLORS[r.status], fontWeight: 'bold' }}>{t(`status.${r.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <RequestDetailPanel
          request={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Admin page with filterable table and request detail panel"
```

---

## Task 22: Final Integration Check

- [ ] **Step 1: Start backend**

```bash
cd server && npm run dev
```

Expected: `Server running on port 4000`

- [ ] **Step 2: Start frontend (new terminal)**

```bash
cd client && npm run dev
```

Expected: `Local: http://localhost:5173`

- [ ] **Step 3: Smoke test — login as admin**

Open `http://localhost:5173`. Log in with `ADMIN-001` / `Admin1234!`. Expected: redirects to `/admin`.

- [ ] **Step 4: Create an applicant user via seed**

Add to `server/src/db/seed.ts` and re-run:
```typescript
const empHash = await bcrypt.hash('Emp1234!', 12);
await pool.query(`
  INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
  VALUES ($1, $2, $3, $4, $5, 'applicant')
  ON CONFLICT (employee_number) DO NOTHING
`, ['EMP-001', 'テスト太郎', 'Taro Test', 'emp@company.com', empHash]);

const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADMIN-001'`);
const { rows: [emp] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'EMP-001'`);
await pool.query(
  `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
  [emp.id, admin.id]
);
```

```bash
cd server && npm run seed
```

- [ ] **Step 5: Smoke test — applicant flow**

Log in as `EMP-001` / `Emp1234!`. Create a late arrival request. Verify toast appears, request shows on dashboard with status "Pending".

- [ ] **Step 6: Smoke test — admin approval**

Log in as admin. Find the request. Click row. Click Approve. Verify status updates in panel and table without page reload.

- [ ] **Step 7: Run all backend tests**

```bash
cd server && NODE_ENV=test npm test
```

Expected: All tests pass.

- [ ] **Step 8: Run all frontend tests**

```bash
cd client && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "feat: complete attendance system MVP"
```

---

## Plan 3 Complete

Full frontend built and integrated:
- ✅ React + Vite + react-i18next (EN/JA, default JA, localStorage preference)
- ✅ Auth with auto-refresh, role-based routing
- ✅ Login page
- ✅ Applicant: Dashboard (refresh button, status badges), Request Form (all conditional fields), Confirm (message preview, lazy manager list, toast)
- ✅ Admin: Dashboard with filters, detail panel with approve/reject
- ✅ Profile panel (reads from AuthContext, no API call)
- ✅ File upload (PDF/XLSX ≤3MB, client-side validation)
