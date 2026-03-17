import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Language } from '@/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettingsContextType {
  language: Language;
  theme: ThemeMode;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  applyTheme: (theme: ThemeMode) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function applyThemeToDOM(theme: ThemeMode) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    return;
  }
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    return;
  }
  // system — ดู OS
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', isDark);
}

export function AppSettingsProvider({
  children,
  initialLanguage = 'th',
  initialTheme = 'light',
}: {
  children: ReactNode;
  initialLanguage?: Language;
  initialTheme?: ThemeMode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  // Apply theme ทันที + listen OS change เมื่อเป็น system
  useEffect(() => {
    applyThemeToDOM(theme);
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeToDOM('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setLanguage = useCallback((lang: Language) => setLanguageState(lang), []);
  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);

  return (
    <AppSettingsContext.Provider
      value={{ language, theme, setLanguage, setTheme, applyTheme: applyThemeToDOM }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}