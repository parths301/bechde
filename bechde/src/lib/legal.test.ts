import { describe, it, expect } from "vitest";
import { operator, legalIsDraft, isDraftOperator, prohibitedItems } from "./legal";

/**
 * `legalIsDraft` gates a user-visible "these are placeholders" banner on the privacy
 * policy and terms. If it ever silently returns false while the details are still
 * fake, the site publishes draft legal text as if it were final — and under the DPDP
 * Act, an unreachable grievance contact is a compliance failure, not a cosmetic one.
 */
describe("isDraftOperator", () => {
  const real = {
    entity: "Acme Pvt Ltd",
    address: "12 MG Road, Bengaluru 560001",
    officer: "R. Kumar",
    email: "grievance@acme.in",
  };

  it("clears once every field is real", () => {
    expect(isDraftOperator(real)).toBe(false);
  });

  it("catches a leftover bracket placeholder", () => {
    expect(isDraftOperator({ ...real, officer: "[NAME]" })).toBe(true);
  });

  // The regression that prompted this: placeholders were swapped for .local addresses,
  // which cleared the banner while leaving a mailbox nobody can write to.
  it.each([
    ["a .local address", "grievance@bechde.local"],
    ["an example.com address", "hi@example.com"],
    ["a localhost address", "ops@localhost"],
    ["a TODO marker", "TODO add real address"],
  ])("still counts %s as a draft", (_label, value) => {
    expect(isDraftOperator({ ...real, email: value })).toBe(true);
  });

  it("matches the live operator values", () => {
    expect(legalIsDraft).toBe(isDraftOperator(operator));
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
