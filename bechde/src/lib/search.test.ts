import { describe, it, expect } from "vitest";
import {
  ANY_CATEGORY,
  DEFAULT_FILTERS,
  describeFilters,
  filtersFromParams,
  filtersToQuery,
  matchesFilters,
  priceOf,
  searchCategories,
  type Filters,
} from "./search";
import type { Item } from "./data";

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: "x",
    name: "Study table",
    label: "table",
    price: "₹1,800",
    km: 1,
    dist: "1 km",
    category: "Furniture",
    angle: "45deg",
    note: "",
    negotiable: true,
    listedAgo: "",
    neighbourhood: "",
    seller: { name: "A", initial: "A", color: "#000", rating: "new seller", sold: 0, replyTime: "—" },
    story: [],
    facts: [],
    pickup: "",
    lat: 12.9,
    lng: 77.6,
    ...over,
  }) as Item;

describe("filters ↔ URL", () => {
  it("round-trips a full filter set", () => {
    const f: Filters = { q: "study table", category: "Furniture", radiusKm: 7, minPrice: 500, maxPrice: 2000 };
    const parsed = filtersFromParams(new URLSearchParams(filtersToQuery(f).replace(/^\?/, "")));
    expect(parsed).toEqual(f);
  });

  it("omits defaults so shared links stay short", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    expect(filtersToQuery({ ...DEFAULT_FILTERS, q: "lamp" })).toBe("?q=lamp");
  });

  it("falls back to defaults for missing or junk params", () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
    const f = filtersFromParams(new URLSearchParams("km=nonsense&min="));
    expect(f.radiusKm).toBe(DEFAULT_FILTERS.radiusKm);
    expect(f.minPrice).toBeNull();
  });

  it("clamps an out-of-range radius to the slider maximum", () => {
    expect(filtersFromParams(new URLSearchParams("km=999")).radiusKm).toBe(10);
  });

  it("trims whitespace-only queries out of the URL", () => {
    expect(filtersToQuery({ ...DEFAULT_FILTERS, q: "   " })).toBe("");
  });
});

describe("priceOf", () => {
  it("parses the formatted rupee string", () => {
    expect(priceOf(item({ price: "₹1,800" }))).toBe(1800);
    expect(priceOf(item({ price: "₹350" }))).toBe(350);
  });

  it("returns null when there's no number at all", () => {
    expect(priceOf(item({ price: "free" }))).toBeNull();
  });
});

describe("matchesFilters", () => {
  it("accepts anything inside the radius with no other filters", () => {
    expect(matchesFilters(item({ km: 2 }), DEFAULT_FILTERS)).toBe(true);
  });

  it("rejects listings beyond the radius", () => {
    expect(matchesFilters(item({ km: 9 }), DEFAULT_FILTERS)).toBe(false);
  });

  it("filters by category but treats All as any", () => {
    expect(matchesFilters(item(), { ...DEFAULT_FILTERS, category: "Gadgets" })).toBe(false);
    expect(matchesFilters(item(), { ...DEFAULT_FILTERS, category: ANY_CATEGORY })).toBe(true);
  });

  it("applies price bounds inclusively", () => {
    expect(matchesFilters(item({ price: "₹1,800" }), { ...DEFAULT_FILTERS, maxPrice: 1800 })).toBe(true);
    expect(matchesFilters(item({ price: "₹1,800" }), { ...DEFAULT_FILTERS, maxPrice: 1799 })).toBe(false);
    expect(matchesFilters(item({ price: "₹1,800" }), { ...DEFAULT_FILTERS, minPrice: 1801 })).toBe(false);
  });

  it("excludes unpriced listings when a price bound is set", () => {
    expect(matchesFilters(item({ price: "free" }), { ...DEFAULT_FILTERS, maxPrice: 5000 })).toBe(false);
  });
});

describe("searchCategories", () => {
  it("includes Music — the old map list omitted it, so guitars were unfilterable", () => {
    expect(searchCategories.map((c) => c.name)).toContain("Music");
  });

  it("leads with All and has no duplicates", () => {
    const names = searchCategories.map((c) => c.name);
    expect(names[0]).toBe(ANY_CATEGORY);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("describeFilters", () => {
  it("pluralises and always states the radius", () => {
    expect(describeFilters(DEFAULT_FILTERS, 1)).toBe("1 thing within 3 km");
    expect(describeFilters(DEFAULT_FILTERS, 4)).toBe("4 things within 3 km");
  });

  it("mentions each active filter", () => {
    const s = describeFilters({ q: "lamp", category: "Furniture", radiusKm: 5, minPrice: null, maxPrice: 900 }, 2);
    expect(s).toContain("lamp");
    expect(s).toContain("Furniture");
    expect(s).toContain("under ₹900");
    expect(s).toContain("5 km");
  });
});
