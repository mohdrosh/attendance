import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  password: string;
  onClose: () => void;
}

export function PasswordRevealModal({ password, onClose }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: '16px', padding: '32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 301,
        width: '360px', maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: '1.1em', fontWeight: 700, color: '#111', marginBottom: '20px' }}>
          {t('employees.password_modal.title')}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <code style={{
            flex: 1, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb',
            borderRadius: '8px', fontSize: '1.1em', fontFamily: 'monospace',
            letterSpacing: '0.08em', color: '#111',
          }}>
            {password}
          </code>
          <button
            onClick={handleCopy}
            style={{
              padding: '10px 16px', background: copied ? '#d1fae5' : '#eff6ff',
              color: copied ? '#065f46' : '#1d4ed8',
              border: `1px solid ${copied ? '#6ee7b7' : '#bfdbfe'}`,
              borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓' : t('employees.password_modal.copy')}
          </button>
        </div>

        <p style={{ fontSize: '0.88em', color: '#d97706', marginBottom: '24px', lineHeight: 1.5 }}>
          ⚠ {t('employees.password_modal.warning')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 28px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.95em',
            }}
          >
            {t('employees.password_modal.done')}
          </button>
        </div>
      </div>
    </>
  );
}
