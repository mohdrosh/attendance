import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageToggle } from './LanguageToggle';

function PersonIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="rgba(255,255,255,0.15)" />
      <circle cx="32" cy="24" r="11" fill="rgba(255,255,255,0.6)" />
      <ellipse cx="32" cy="54" rx="18" ry="11" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="19" height="16" viewBox="0 0 19 16" fill="currentColor" aria-hidden="true">
      <rect width="19" height="2" rx="1" />
      <rect y="7" width="19" height="2" rx="1" />
      <rect y="14" width="19" height="2" rx="1" />
    </svg>
  );
}

const NAV_BG = 'linear-gradient(160deg, rgba(96,165,250,0.82) 0%, rgba(59,130,246,0.88) 60%, rgba(37,99,235,0.84) 100%)';
const DRAWER_ACCENT = 'linear-gradient(160deg, #60a5fa 0%, #3b82f6 60%, #2563eb 100%)';

export function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function close() { setOpen(false); }

  async function handleLogout() {
    close();
    await logout();
    navigate('/login');
  }

  function go(path: string) {
    close();
    navigate(path);
  }

  return (
    <>
      <nav style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '0 16px',
        height: '54px',
        background: NAV_BG,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: '0 0 18px 18px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 18px rgba(37,99,235,0.22)',
        color: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Left — hamburger */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'white',
              cursor: 'pointer',
              padding: '7px 10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HamburgerIcon />
          </button>
        </div>

        {/* Center — title */}
        <span style={{
          fontWeight: 700,
          fontSize: '1em',
          letterSpacing: '0.02em',
          textAlign: 'center',
          textShadow: '0 1px 3px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
        }}>
          {t('nav.brand')}
        </span>

        {/* Right — language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <LanguageToggle navbar />
        </div>
      </nav>

      {/* Backdrop */}
      {open && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: open ? 0 : '-300px', width: '280px',
        height: '100vh', background: 'white',
        boxShadow: '6px 0 28px rgba(0,0,0,0.14)',
        zIndex: 201,
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        borderRadius: '0 16px 16px 0',
      }}>
        {/* Profile header */}
        <div style={{
          background: DRAWER_ACCENT,
          padding: '20px 20px 26px',
          color: 'white',
          borderRadius: '0 16px 0 0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button
              onClick={close}
              aria-label="Close menu"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none', color: 'white', cursor: 'pointer',
                width: '28px', height: '28px', borderRadius: '50%',
                fontSize: '0.85em', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <PersonIcon />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05em' }}>{user?.name_ja}</div>
              <div style={{ fontSize: '0.84em', opacity: 0.82, marginTop: '2px' }}>{user?.name_en}</div>
              <div style={{ marginTop: '10px' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 12px', borderRadius: '999px',
                  fontSize: '0.74em', fontWeight: 700, letterSpacing: '0.04em',
                  background: user?.role === 'admin' ? '#fbbf24' : 'rgba(255,255,255,0.22)',
                  color: user?.role === 'admin' ? '#78350f' : 'white',
                }}>
                  {t(`profile.roles.${user?.role}`)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {user?.role === 'applicant' && (
            <NavItem onClick={() => go('/dashboard')}>📋 {t('nav.dashboard')}</NavItem>
          )}
          {user?.role === 'applicant' && (
            <NavItem onClick={() => go('/request/new')}>✏️ {t('nav.new_request')}</NavItem>
          )}
          {user?.role === 'admin' && (
            <NavItem onClick={() => go('/admin')}>📊 {t('nav.admin')}</NavItem>
          )}
          {user?.role === 'admin' && (
            <NavItem onClick={() => go('/admin/employees')}>👥 {t('employees.title')}</NavItem>
          )}
        </div>

        {/* Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '10px',
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', borderRadius: '10px',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9em',
            }}
          >
            {t('nav.logout')}
          </button>
        </div>
      </div>
    </>
  );
}

function NavItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '11px 12px',
        background: hovered ? '#eff6ff' : 'none',
        border: 'none', borderRadius: '10px',
        textAlign: 'left', cursor: 'pointer',
        fontSize: '0.95em', color: hovered ? '#2563eb' : '#222',
        fontWeight: 500, transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
