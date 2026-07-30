import type { Language } from "./config";

/**
 * Display text for a database row.
 *
 * Categories, cities, localities and the sell-form questions are rows an admin edits,
 * not keys in a resource file — so Hindi for them lives in `_hi` columns (0021) and is
 * resolved here. English is the fallback rather than an error: an admin adding a
 * category shouldn't be blocked on knowing Hindi, and a new category showing its
 * English name beats it showing nothing.
 */
export function localised(lang: Language, english: string, hindi?: string | null): string {
  return lang === "hi" && hindi?.trim() ? hindi : english;
}

/**
 * The label for a select option, keeping the *value* English.
 *
 * `options_hi` is index-aligned with `options` by a check constraint, so a listing
 * stores `condition = "Good"` in either language and only the display differs. Storing
 * the Hindi string would make the same filter unqueryable depending on who typed it.
 */
export function localisedOption(lang: Language, options: string[], optionsHi: string[], value: string): string {
  if (lang !== "hi" || optionsHi.length !== options.length) return value;
  const i = options.indexOf(value);
  return i >= 0 ? optionsHi[i] : value;
}
