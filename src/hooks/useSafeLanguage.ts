import { useLanguage } from '@/providers/LanguageProvider';
import type { SupportedLanguage } from '@/providers/LanguageProvider';

export const useSafeLanguage = (): SupportedLanguage => {
  try {
    const { language } = useLanguage();
    return language;
  } catch {
    console.warn('LanguageProvider not available, defaulting to French');
    return 'fr';
  }
};

