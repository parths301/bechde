"use client";

import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { hi } from "./hi";

export type Language = "en" | "hi";
export const LANGUAGES: Language[] = ["en", "hi"];
export const STORAGE_KEY = "bechde_lang";

/**
 * One i18next instance, created once per browser.
 *
 * No locale routing: the toggle switches at runtime and persists to localStorage, so a
 * URL is language-independent and a shared link opens in whatever language the reader
 * prefers. That suits a marketplace where people paste listing links into WhatsApp far
 * more than a /hi/ prefix would.
 *
 * `en` is the fallback, so a key missing from `hi` renders English rather than the raw
 * key — a gap looks untranslated instead of broken. `npm test` fails on any such gap,
 * so it shouldn't happen; the fallback is for the moment between adding a key and
 * translating it.
 */
let instance: I18nInstance | null = null;

export function getI18n(initialLang: Language = "en"): I18nInstance {
  if (instance) return instance;

  instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    lng: initialLang,
    fallbackLng: "en",
    interpolation: {
      // React escapes for us; double-escaping mangles the ₹ and the em dashes.
      escapeValue: false,
    },
    returnNull: false,
  });

  return instance;
}

/** Read the saved choice. Safe to call only in the browser. */
export function readLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "hi" || saved === "en" ? saved : "en";
  } catch {
    return "en";
  }
}

/** BCP-47 tag for Intl. Both are India — only the digits and month names differ. */
export function localeOf(lang: Language): string {
  return lang === "hi" ? "hi-IN" : "en-IN";
}
