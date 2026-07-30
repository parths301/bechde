"use client";

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { I18nextProvider, useTranslation as useI18nextTranslation } from "react-i18next";
import { getI18n, localeOf, readLang, STORAGE_KEY, type Language } from "./config";

export type { Language };

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  /** BCP-47 tag for Intl — "en-IN" or "hi-IN". */
  locale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/* localStorage is an external store, so read it with useSyncExternalStore rather than
   hydrating through an effect: React calls getServerSnapshot for the server and the
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore<Language>(subscribe, readLang, () => "en");
  const i18n = getI18n(lang);

  // i18next keeps the active language on its own instance, so it has to be told.
  // In an effect rather than during render: changeLanguage emits events that re-render
  // subscribers, and doing that mid-render is the classic React warning.
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, [i18n, lang]);

  const setLang = useCallback((next: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the switch still works for this page view */
    }
    for (const notify of listeners) notify();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={{ lang, setLang, locale: localeOf(lang) }}>
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
}

/**
 * `t` plus the bits i18next doesn't cover.
 *
 * Numbers go through `Intl` under the active locale rather than being hardcoded to
 * en-IN, so both languages keep Indian lakh/crore digit grouping (₹1,50,000, not
 * ₹150,000) and Hindi gets its own numeral conventions.
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useTranslation must be used within a LanguageProvider");
  const { t, i18n } = useI18nextTranslation();

  const formatPrice = useCallback(
    (rupees: number) =>
      new Intl.NumberFormat(context.locale, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(rupees),
    [context.locale]
  );

  const formatNumber = useCallback(
    (n: number) => new Intl.NumberFormat(context.locale).format(n),
    [context.locale]
  );

  return { t, i18n, ...context, formatPrice, formatNumber };
}
