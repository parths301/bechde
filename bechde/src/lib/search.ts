// The one definition of "a search" — shared by the header, /search, the map rail and
// saved searches, so the four can't drift apart.

import { homeCategories, type Item } from "@/lib/data";

export interface Filters {
  q: string;
  /** "All" = any category */
  category: string;
  radiusKm: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export const ANY_CATEGORY = "All";

export const DEFAULT_FILTERS: Filters = {
  q: "",
  category: ANY_CATEGORY,
  radiusKm: 3,
  minPrice: null,
  maxPrice: null,
};

/**
 * Every real category plus "All". `mapCategoryNames` in data.ts omits Music, so a
 * guitar could never be filtered — this list is built from the actual categories.
 */
export const searchCategories: { name: string; icon: string }[] = [
  { name: ANY_CATEGORY, icon: "✨" },
  ...homeCategories.filter((c) => c.name !== "Everything"),
  { name: "Everything", icon: "🧺" },
];

function num(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? n : null;
}

export function filtersFromParams(p: URLSearchParams): Filters {
  const km = num(p.get("km"));
  return {
    q: p.get("q") ?? "",
    category: p.get("cat") || ANY_CATEGORY,
    radiusKm: km && km > 0 ? Math.min(km, 10) : DEFAULT_FILTERS.radiusKm,
    minPrice: num(p.get("min")),
    maxPrice: num(p.get("max")),
  };
}

/** Only non-default values land in the URL, so shared links stay readable. */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.category && f.category !== ANY_CATEGORY) p.set("cat", f.category);
  if (f.radiusKm !== DEFAULT_FILTERS.radiusKm) p.set("km", String(f.radiusKm));
  if (f.minPrice != null) p.set("min", String(f.minPrice));
  if (f.maxPrice != null) p.set("max", String(f.maxPrice));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function searchHref(f: Filters): string {
  return `/search${filtersToQuery(f)}`;
}

/** Parse the formatted price ("₹3,200") back to a number. */
export function priceOf(item: Item): number | null {
  const digits = item.price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** Client-side equivalent of the SQL price/category/radius filters. */
export function matchesFilters(item: Item, f: Filters): boolean {
  if (f.category !== ANY_CATEGORY && item.category !== f.category) return false;
  if (item.km > f.radiusKm) return false;
  const price = priceOf(item);
  if (f.minPrice != null && (price == null || price < f.minPrice)) return false;
  if (f.maxPrice != null && (price == null || price > f.maxPrice)) return false;
  return true;
}

/** Human summary for the results header. */
export function describeFilters(f: Filters, count: number): string {
  const thing = count === 1 ? "thing" : "things";
  const bits: string[] = [];
  if (f.q.trim()) bits.push(`matching “${f.q.trim()}”`);
  if (f.category !== ANY_CATEGORY) bits.push(`in ${f.category}`);
  if (f.minPrice != null && f.maxPrice != null) bits.push(`₹${f.minPrice}–₹${f.maxPrice}`);
  else if (f.maxPrice != null) bits.push(`under ₹${f.maxPrice}`);
  else if (f.minPrice != null) bits.push(`over ₹${f.minPrice}`);
  return `${count} ${thing} ${bits.length ? bits.join(" · ") + " " : ""}within ${f.radiusKm} km`;
}
