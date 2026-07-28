"use client";

import React, { createContext, useContext, useCallback, useSyncExternalStore } from "react";
import { Language, TranslationKey, translations } from "./dictionary";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "bechde_lang";

/* localStorage is an external store, so read it with useSyncExternalStore rather than
   hydrating it through an effect: React calls getServerSnapshot for the server and the
   hydration render, so there's no mismatch and no cascading re-render. Subscribing to
   `storage` keeps two open tabs in step for free. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLang(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "hi" || saved === "en" ? saved : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore<Language>(subscribe, readLang, () => "en");

  const setLang = useCallback((newLang: Language) => {
    localStorage.setItem(STORAGE_KEY, newLang);
    for (const notify of listeners) notify();
  }, []);

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
