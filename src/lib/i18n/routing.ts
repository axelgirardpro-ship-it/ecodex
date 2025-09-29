import { SupportedLanguage } from '@/providers/LanguageProvider';

export const SUPPORTED_LANGS: SupportedLanguage[] = ['fr', 'en'];
export const DEFAULT_LANG: SupportedLanguage = 'fr';

export const isSupportedLang = (lang?: string | null): lang is SupportedLanguage => lang === 'fr' || lang === 'en';

export const extractLangFromPath = (pathname: string): SupportedLanguage => {
  const cleaned = pathname.split('?')[0].split('#')[0];
  if (cleaned === '/' || cleaned === '') return 'fr';
  return cleaned.startsWith('/en') ? 'en' : 'fr';
};

const stripLangPrefix = (pathname: string): string => pathname.startsWith('/en') ? pathname.replace(/^\/en/, '') || '/' : pathname;

export const buildLocalizedPath = (path: string, lang: SupportedLanguage): string => {
  if (!path.startsWith('/')) path = `/${path}`;
  const normalized = stripLangPrefix(path).replace(/\/+/g, '/');

  if (lang === 'en') {
    if (normalized === '/' || normalized === '') return '/en';
    return `/en${normalized}`;
  }

  return normalized === '' ? '/' : normalized;
};

export const ensurePathLanguage = (pathname: string, lang: SupportedLanguage): string => {
  const cleaned = stripLangPrefix(pathname).replace(/\/+/g, '/');
  return buildLocalizedPath(cleaned, lang);
};
