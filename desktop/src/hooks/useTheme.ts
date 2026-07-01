import { useEffect, useState } from 'react';

const THEME_KEY = 'noteforge:theme';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
      const html = document.documentElement.dataset.theme;
      if (html === 'light' || html === 'dark') return html;
    } catch { /* localStorage unavailable */ }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* localStorage may be unavailable */ }
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
  };
}
