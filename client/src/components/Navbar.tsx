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
