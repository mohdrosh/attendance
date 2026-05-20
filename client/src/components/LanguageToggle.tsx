import { useTranslation } from 'react-i18next';

interface Props {
  navbar?: boolean;
}

export function LanguageToggle({ navbar }: Props) {
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';

  function toggle() {
    const next = isJa ? 'en' : 'ja';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  }

  return (
    <button
      onClick={toggle}
      style={navbar ? {
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '10px',
        padding: '5px 11px',
        color: 'white',
        fontSize: '0.82em',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      } : {
        cursor: 'pointer',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '5px 11px',
        color: '#1d4ed8',
        fontSize: '0.82em',
        fontWeight: 600,
      }}
    >
      {isJa ? 'EN' : 'JP'}
    </button>
  );
}
