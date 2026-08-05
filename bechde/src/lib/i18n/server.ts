import { cookies } from "next/headers";
import { STORAGE_KEY, type Language } from "./config";
import { resolve } from "./resolve";

/**
 * The reader's language, for server components.
 *
 * The toggle's source of truth is localStorage — which the server cannot see — so
 * `setLang` mirrors it into a cookie of the same name. Anyone who has never touched
 * the toggle has neither, and gets English, which is the same default the browser uses.
 */
export async function getServerLang(): Promise<Language> {
  const value = (await cookies()).get(STORAGE_KEY)?.value;
  return value === "hi" ? "hi" : "en";
}

/** `t` for a server component: `const t = await getServerT()`. */
export async function getServerT() {
  const lang = await getServerLang();
  return (key: string, vars?: Record<string, string | number>) => resolve(lang, key, vars);
}
