import { describe, it, expect } from "vitest";
import { operator, legalIsDraft, prohibitedItems } from "./legal";

/**
 * `legalIsDraft` gates a user-visible "these are placeholders" banner on the privacy
 * policy and terms. If it ever silently returns false while the placeholders are still
 * in place, the site would publish draft legal text as if it were final.
 */
describe("legalIsDraft", () => {
  it("is true while any operator field is still a placeholder", () => {
    const hasPlaceholder = Object.values(operator).some((v) => v.includes("["));
    expect(legalIsDraft).toBe(hasPlaceholder);
  });

  it("detects a placeholder in any single field", () => {
    const filled = { entity: "Acme Pvt Ltd", email: "hi@acme.in", officer: "[NAME]" };
    expect(Object.values(filled).some((v) => v.includes("["))).toBe(true);
  });

  it("clears once every field is filled", () => {
    const filled = { entity: "Acme Pvt Ltd", email: "hi@acme.in", officer: "R. Kumar" };
    expect(Object.values(filled).some((v) => v.includes("["))).toBe(false);
  });
});

describe("prohibitedItems", () => {
  it("covers the categories a marketplace is legally expected to bar", () => {
    const titles = prohibitedItems.map((p) => p.title.toLowerCase()).join(" ");
    for (const required of ["weapons", "drugs", "stolen", "counterfeit", "government documents"]) {
      expect(titles).toContain(required);
    }
  });

  it("gives every rule a concrete example, so it's actionable", () => {
    for (const p of prohibitedItems) {
      expect(p.examples.trim().length).toBeGreaterThan(0);
    }
  });
});
