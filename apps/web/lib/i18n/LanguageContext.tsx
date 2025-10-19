'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Language, languages, TranslationKey, translations } from './translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'universwap:lang';

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, k: string) => {
    const value = vars[k];
    return value === undefined || value === null ? match : String(value);
  });
}

function getValueByPath(obj: any, path: string): string | undefined {
  return path.split('.').reduce<any>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) return acc[segment];
    return undefined;
  }, obj);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && languages.includes(stored)) {
      setLanguageState(stored);
      return;
    }
    const navigatorLang = window.navigator?.language?.toLowerCase?.() ?? 'en';
    const guess = languages.find((lang) => navigatorLang.startsWith(lang));
    if (guess) setLanguageState(guess);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const dict = translations[language];
    const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
      const raw = getValueByPath(dict, key);
      if (typeof raw !== 'string') return key;
      return format(raw, vars);
    };
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
