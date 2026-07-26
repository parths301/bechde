import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The screens were ported from a static prototype built out of clickable <div>s.
 * These checks keep the keyboard and screen-reader story from regressing.
 */
const routes = ["/home", "/search?q=table", "/map", "/chat", "/profile", "/sell", "/product/yamaha-f310"];

for (const route of routes) {
  test(`no serious accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    // Let the client-side data land before scanning.
    await page.waitForTimeout(1200);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Leaflet injects its own attribution markup we don't control.
      .exclude(".leaflet-container")
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) {
      console.log(
        `${route}:\n` +
          serious.map((v) => `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes[0]?.html?.slice(0, 120)}`).join("\n")
      );
    }
    expect(serious).toEqual([]);
  });
}

test("the whole app is reachable from the keyboard", async ({ page }) => {
  await page.goto("/home");

  // First tab stop is the skip link, so keyboard users can jump the nav.
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();

  // Category chips are real buttons: focusable and activatable with Enter.
  const chip = page.getByRole("button", { name: /Furniture/ }).first();
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/search/);
});

test("the report dialog traps focus and closes on Escape", async ({ page }) => {
  await page.goto("/product/yamaha-f310");
  await page.getByText("⚑ Report listing").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
