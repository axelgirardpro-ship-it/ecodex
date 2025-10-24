import { useLanguage } from '@/providers/LanguageProvider';
import type { SupportedLanguage } from '@/providers/LanguageProvider';

export const useSafeLanguage = (): SupportedLanguage => {
  // Always call the hook at the top level (Rules of Hooks)
  let language: SupportedLanguage = 'fr';
  let hasError = false;
  
  try {
    const languageContext = useLanguage();
    language = languageContext.language;
  } catch (error) {
    hasError = true;
  }
  
  if (hasError) {
    console.warn('LanguageProvider not available, defaulting to French');
  }
  
  return language;
};

