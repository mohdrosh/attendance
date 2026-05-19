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
