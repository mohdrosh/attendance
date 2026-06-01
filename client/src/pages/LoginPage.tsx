import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageToggle } from '../components/LanguageToggle';

type Mode = 'login' | 'reset' | 'sent';

const inputStyle = {
  width: '100%', padding: '8px', border: '1px solid #ddd',
  borderRadius: '4px', boxSizing: 'border-box' as const,
};

const cardStyle = {
  background: 'white', padding: '40px', borderRadius: '8px',
  width: '360px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
};

const wrapStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', background: '#f5f5f5',
};

export function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');

  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resetEmpNo, setResetEmpNo] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  if (user) {
    navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    return null;
  }

  async function handleLogin(e: FormEvent) {
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

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_number: resetEmpNo, email: resetEmail }),
      });
      if (!res.ok) {
        setError(t('login.error'));
        return;
      }
      setMode('sent');
    } catch {
      setError(t('login.error'));
    } finally {
      setResetLoading(false);
    }
  }

  const langToggle = (
    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
      <LanguageToggle />
    </div>
  );

  if (mode === 'sent') {
    return (
      <div style={wrapStyle}>
        {langToggle}
        <div style={cardStyle}>
          <h1 style={{ marginBottom: '16px', fontSize: '1.2em', textAlign: 'center' }}>{t('login.reset_title')}</h1>
          <p style={{ fontSize: '0.9em', color: '#374151', marginBottom: '24px', textAlign: 'center' }}>
            {t('login.reset_sent')}
          </p>
          <button
            onClick={() => { setMode('login'); setResetEmpNo(''); setResetEmail(''); setError(''); }}
            style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em' }}
          >
            {t('login.reset_back')}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'reset') {
    return (
      <div style={wrapStyle}>
        {langToggle}
        <div style={cardStyle}>
          <h1 style={{ marginBottom: '24px', fontSize: '1.2em', textAlign: 'center' }}>{t('login.reset_title')}</h1>
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="reset_emp" style={{ display: 'block', marginBottom: '4px' }}>{t('login.employee_number')}</label>
              <input id="reset_emp" value={resetEmpNo} onChange={e => setResetEmpNo(e.target.value)} style={inputStyle} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="reset_email" style={{ display: 'block', marginBottom: '4px' }}>{t('login.reset_email')}</label>
              <input id="reset_email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={inputStyle} required />
            </div>
            {error && <div role="alert" style={{ color: 'red', marginBottom: '12px', fontSize: '0.9em' }}>{error}</div>}
            <button
              type="submit"
              disabled={resetLoading}
              style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em', marginBottom: '12px' }}
            >
              {resetLoading ? t('login.reset_submitting') : t('login.reset_submit')}
            </button>
          </form>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95em', color: '#374151' }}
          >
            {t('login.reset_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      {langToggle}
      <div style={cardStyle}>
        <h1 style={{ marginBottom: '8px', fontSize: '1.2em', textAlign: 'center' }}>{t('login.title')}</h1>
        <p style={{ marginBottom: '24px', fontSize: '0.88em', color: '#6b7280', textAlign: 'center' }}>{t('login.welcome')}</p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="employee_number" style={{ display: 'block', marginBottom: '4px' }}>{t('login.employee_number')}</label>
            <input id="employee_number" value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '4px' }}>{t('login.password')}</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
          </div>
          {error && <div role="alert" style={{ color: 'red', marginBottom: '12px', fontSize: '0.9em' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em', marginBottom: '12px' }}
          >
            {loading ? '...' : t('login.submit')}
          </button>
        </form>
        <button
          onClick={() => setMode('reset')}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85em', textDecoration: 'underline', padding: '4px' }}
        >
          {t('login.forgot_password')}
        </button>
      </div>
    </div>
  );
}
