import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

/** Every .ts/.tsx under src/, concatenated, minus the resource files themselves. */
function readSource(dir: string, acc: string[] = []): string {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) readSource(path, acc);
    else if (/\.tsx?$/.test(entry) && !/^(en|hi)\.ts$/.test(entry)) acc.push(readFileSync(path, "utf8"));
  }
  return acc.join("\n");
}

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
    // A literal the user must type, and a bare number that has no Hindi form.
    const SAME_ON_PURPOSE = new Set(["profile.dataCloseWord", "sell.pricePlaceholder"]);
    const copied = Object.entries(flatHi)
      .filter(([k, v]) => !SAME_ON_PURPOSE.has(k) && v === flatEn[k])
      .map(([k]) => k);
    expect(copied).toEqual([]);
  });

  /**
   * The one the parity tests structurally cannot catch.
   *
   * Parity proves `en` and `hi` agree. It says nothing about whether any *screen* asks
   * for the key — and the first pass of this work wrote all 294 keys but wired only
   * some of the screens, leaving 72 orphans and a dozen screens still hardcoding the
   * English the resource file already held. Both halves looked finished; every test
   * passed; Hindi mode showed English.
   *
   * An orphaned key is therefore treated as a missing call site, not as dead weight to
   * delete: it means someone wrote the translation and forgot the component.
   */
  it("are all actually used by a screen", () => {
    const source = readSource(join(__dirname, "..", ".."));
    const orphans = Object.keys(flatEn)
      .map((k) => k.replace(/_(one|other)$/, ""))
      .filter((key, i, all) => all.indexOf(key) === i)
      .filter((key) => {
        if (source.includes(`"${key}"`) || source.includes(`'${key}'`)) return false;
        // Built at runtime: `bottomNav.${name}`. Accept the namespace being interpolated.
        const namespace = key.slice(0, key.lastIndexOf("."));
        return !source.includes("`" + namespace + ".${");
      });
    expect(orphans).toEqual([]);
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
