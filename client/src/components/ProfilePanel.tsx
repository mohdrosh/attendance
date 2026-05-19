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
