import { describe, it, expect } from "vitest";
import { en } from "./en";
import { hi } from "./hi";

/**
 * The guard that makes "the app is in Hindi" a fact rather than a hope.
 *
 * TypeScript already forces `hi` to have every key (`hi: Resources`), but it cannot
 * catch the two failures that actually happen: a Hindi value left as its English
 * original, and an interpolation placeholder dropped in translation — which renders a
 * sentence with a hole in it, at runtime, only for Hindi readers.
 *
 * This is deliberately not a snapshot. A snapshot would record whatever is there today,
 * including the mistakes.
 */
type Flat = Record<string, string>;

function flatten(obj: object, prefix = ""): Flat {
  const out: Flat = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, key));
  }
  return out;
}

const flatEn = flatten(en);
const flatHi = flatten(hi);

/** Latin letters that aren't part of a brand, a placeholder or a unit. */
const ALLOWED_LATIN = [
  /\{\{[^}]+\}\}/g, // {{count}}
  /iPhone|Bech De|DPDP|CLOSE|km|₹|✓|✨|←|→|·|×|📍|💬|🏠|🔍|📖|📬|👋|🎉|⚑|🛡️|♡|●/g,
  /aap@example\.com/g,
];

describe("translation resources", () => {
  it("have exactly the same keys", () => {
    expect(Object.keys(flatHi).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("have no empty values", () => {
    const blank = Object.entries(flatHi).filter(([, v]) => !v.trim());
    expect(blank.map(([k]) => k)).toEqual([]);
  });

  it("keep every interpolation placeholder", () => {
    const broken: string[] = [];
    for (const [key, source] of Object.entries(flatEn)) {
      const wanted = (source.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, "")).sort();
      const got = (flatHi[key].match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((s) => s.replace(/\s/g, "")).sort();
      if (JSON.stringify(wanted) !== JSON.stringify(got)) {
        broken.push(`${key}: expected ${wanted.join(",") || "none"} but Hindi has ${got.join(",") || "none"}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("are actually translated, not copied English", () => {
    // A handful legitimately match: a brand, a literal the user must type, a symbol.
    const SAME_ON_PURPOSE = new Set(["profile.dataCloseWord"]);
    const copied = Object.entries(flatHi)
      .filter(([k, v]) => !SAME_ON_PURPOSE.has(k) && v === flatEn[k])
      .map(([k]) => k);
    expect(copied).toEqual([]);
  });

  it("contain Devanagari wherever there is prose to translate", () => {
    const devanagari = /[ऀ-ॿ]/;
    const missing: string[] = [];
    for (const [key, value] of Object.entries(flatHi)) {
      let stripped = value;
      for (const re of ALLOWED_LATIN) stripped = stripped.replace(re, "");
      // Anything left with three or more Latin letters is untranslated prose.
      if (/[A-Za-z]{3,}/.test(stripped) && !devanagari.test(value)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});
