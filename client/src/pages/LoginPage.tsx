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
