import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '@attendance/shared';
import { setAccessToken, apiFetch } from '../api/client';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  login: (employeeNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

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
