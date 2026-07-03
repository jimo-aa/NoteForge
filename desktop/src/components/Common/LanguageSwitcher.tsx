import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';

  const toggleLang = () => {
    const next = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
    void i18n.changeLanguage(next);
  };

  return (
    <button
      className="icon-button lang-switcher"
      onClick={toggleLang}
      title={currentLang === 'zh-CN' ? 'Switch to English' : '切换到中文'}
    >
      {currentLang === 'zh-CN' ? 'EN' : '中文'}
    </button>
  );
}
