import { en } from "./en";
import { hi } from "./hi";
import type { Language } from "./config";

/**
 * Translation without React, i18next, or a provider.
 *
 * Two callers need this and neither can use the hook:
 *
 * - `global-error.tsx` *replaces the root layout*, so the provider that supplies
 *   `useTranslation` is gone by the time it renders. Reaching for the hook there
 *   throws inside an error boundary, which is the worst possible place for it.
 * - Server components (`not-found.tsx`, `/unsubscribe`) render before any browser
 *   code runs, so there is no `localStorage` to read. They get the language from
 *   the cookie instead — see `getServerLang()`.
 *
 * Deliberately tiny: dotted lookup, `{{var}}` interpolation, `_one`/`_other`
 * plurals. It reads the same `en`/`hi` objects the app uses, so the parity test
 * covers these strings too — there is no second place to keep in sync.
 */
export function resolve(lang: Language, key: string, vars?: Record<string, string | number>): string {
  const count = vars?.count;
  const suffixed = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : null;

  const text = (suffixed && lookup(lang, suffixed)) ?? lookup(lang, key) ?? (suffixed && lookup("en", suffixed)) ?? lookup("en", key);

  // The key itself, exactly as i18next would render a miss. The unit test makes this
  // unreachable; it exists so a gap looks obviously broken rather than blank.
  if (text == null) return key;

  return vars
    ? text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
    : text;
}

function lookup(lang: Language, key: string): string | null {
  let node: unknown = lang === "hi" ? hi : en;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}
