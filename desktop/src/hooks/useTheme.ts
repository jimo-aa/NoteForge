import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'noteforge:theme';
const ACCENT_KEY = 'noteforge:accent';
const DEFAULT_ACCENT = '#6a63ff';

export type ThemeMode = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function persist(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => loadPersisted<ThemeMode>(THEME_KEY, 'light'));

  const [accentColor, setAccentColorState] = useState<string>(() => {
    try { return window.localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT; } catch { return DEFAULT_ACCENT; }
  });

  const setAccentColor = useCallback((color: string) => {
    setAccentColorState(color);
    try { window.localStorage.setItem(ACCENT_KEY, color); } catch { /* ignore */ }
  }, []);

  // resolvedTheme: the actual applied light/dark value
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    mode === 'system' ? getSystemTheme() : mode,
  );

  // Re-resolve when mode changes
  useEffect(() => {
    setResolvedTheme(mode === 'system' ? getSystemTheme() : mode);
  }, [mode]);

  // Listen to OS preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolvedTheme(getSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Apply theme + accent to <html> and persist mode
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.setProperty('--accent', accentColor);
    persist(THEME_KEY, mode);
  }, [resolvedTheme, accentColor, mode]);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return {
    /** The user's chosen mode (light / dark / system) */
    theme: mode,
    /** The actual resolved theme applied to the DOM (always 'light' or 'dark') */
    resolvedTheme,
    setTheme,
    toggleTheme,
    accentColor,
    setAccentColor,
  } as const;
}
