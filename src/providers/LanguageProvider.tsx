import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '@/providers/i18n';
import { buildLocalizedPath } from '@i18n/routing';

const STORAGE_KEY = 'ecodex-lang';
const COOKIE_KEY = 'ecodex_lang';
const DEFAULT_LANG = 'fr';

export type SupportedLanguage = 'fr' | 'en';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage, options?: { skipStorage?: boolean; preservePath?: boolean }) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const normalizeForHardRefresh = (pathname: string): string => {
  if (!pathname) return '/';
  if (pathname === '/en' || pathname === '/en/') return '/';
  if (pathname.startsWith('/en')) {
    const stripped = pathname.slice(3);
    return stripped ? (stripped.startsWith('/') ? stripped : `/${stripped}`) : '/';
  }
  return pathname;
};

const requiresHardRefresh = (pathname: string): boolean => {
  const normalized = normalizeForHardRefresh(pathname);
  return normalized.startsWith('/search') || normalized.startsWith('/favoris');
};

const resolveInitialLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') return DEFAULT_LANG;

  const pathSegment = window.location.pathname.split('/')[1];
  if (pathSegment === 'en') return 'en';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'fr') return stored;

  const cookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_KEY}=`));
  if (cookie) {
    const value = cookie.split('=')[1];
    if (value === 'en' || value === 'fr') return value;
  }

  return DEFAULT_LANG;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(resolveInitialLanguage);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  const setLanguage = useCallback((lang: SupportedLanguage, options?: { skipStorage?: boolean }) => {
    setLanguageState(lang);
    if (typeof window === 'undefined') return;

    const { pathname, search, hash } = window.location;
    const localizedPath = buildLocalizedPath(pathname, lang);
    const targetUrl = `${localizedPath}${search}${hash}`;

    if (options?.skipStorage) {
      if (pathname !== localizedPath) {
        window.history.replaceState({}, '', targetUrl);
      }
      return;
    }

    const persistLanguage = () => {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    };

    if (requiresHardRefresh(pathname)) {
      persistLanguage();
      if (pathname !== localizedPath) {
        window.location.assign(targetUrl);
      } else {
        window.location.reload();
      }
      return;
    }

    if (pathname !== localizedPath) {
      window.history.replaceState({}, '', targetUrl);
    }

    persistLanguage();
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
