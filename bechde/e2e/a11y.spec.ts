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

/**
 * /login, as a guest.
 *
 * It sits outside `routes` above for the same reason it sat outside the overflow guard:
 * the suite shares one signed-in storageState and src/proxy.ts bounces an authenticated
 * visitor to /home, so the first page every new user sees was invisible to both. That
 * blind spot is how the card shipped 960px wide on a phone, and how the *only* control
 * that gets you into the app — "Email me a link" — stayed a `<div onClick>` through a
 * whole accessibility pass, unreachable by keyboard.
 */
test.describe("the sign-in page, as a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(600);

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) {
      console.log(
        "/login:\n" +
          serious.map((v) => `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes[0]?.html?.slice(0, 120)}`).join("\n")
      );
    }
    expect(serious).toEqual([]);
  });

  test("can be completed with the keyboard alone", async ({ page }) => {
    await page.goto("/login");

    // Type an address, then reach the submit control without touching the mouse.
    await page.getByLabel("Email").focus();
    await page.keyboard.type("keyboard-user@bechde.local");

    const submit = page.getByRole("button", { name: /Email me a link/ });
    await submit.focus();
    await expect(submit).toBeFocused();

    // The code path has to be reachable too — it's the one a phone user needs.
    const already = page.getByRole("button", { name: /I already have a code/ });
    await already.focus();
    await expect(already).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Six-digit sign-in code")).toBeVisible();
  });
});
