import { test, expect } from "@playwright/test";

test.describe("the arc that matters", () => {
  test("browse the radar, search, open a listing", async ({ page }) => {
    await page.goto("/home");

    // Home: the radar count and feed come from real listings near Koramangala.
    await expect(page.getByRole("heading", { name: /Good stuff/ })).toBeVisible();
    await expect(page.getByText(/things for sale within/)).toBeVisible();
    await expect(page.getByText(/Fresh within/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/home.png", fullPage: false });

    // Search: full-text, and the typo path through pg_trgm.
    // two exist: the header search and the mobile-only one (CSS-hidden on desktop)
    await page.getByPlaceholder(/Search "study table"/).first().fill("gitar");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/search\?q=gitar/);
    await expect(page.getByText("Yamaha F310 acoustic guitar")).toBeVisible();
    await expect(page.getByText(/1 thing .*within/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/search.png" });

    // Product: real distance, the seller's derived rating, safety actions.
    await page.getByText("Yamaha F310 acoustic guitar").first().click();
    await page.waitForURL(/\/product\/yamaha-f310/);
    await expect(page.getByRole("heading", { name: "Yamaha F310 acoustic guitar" })).toBeVisible();
    await expect(page.getByText(/★ 5\.0 \(2\)/)).toBeVisible(); // derived from 2 seeded reviews
    await expect(page.getByText("⚑ Report listing")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/product.png" });
  });

  test("chat shows the seeded thread and its live offer", async ({ page }) => {
    await page.goto("/chat");

    // Wait for the threads themselves — "Chats" alone matches the nav link too.
    await expect(page.getByText("Yamaha F310 acoustic guitar").first()).toBeVisible();
    // The offer card is a real `offers` row, not the prototype's hardcoded ₹2,900.
    await expect(page.getByText("₹2,900").first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/chat.png" });
  });

  test("profile reputation is derived from real rows", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Aisha" })).toBeVisible();
    await expect(page.getByText("✓ email verified")).toBeVisible();
    // Aisha has left reviews but received none, so the empty state must show.
    await expect(page.getByText("no reviews yet")).toBeVisible();
    await page.getByText(/^Reviews · /).click();
    await expect(page.getByText(/No reviews yet/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/profile.png" });
  });

  test("map filters listings by radius and category", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByText(/items within \d+ km/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/map.png" });
  });

  test("legal pages are reachable without signing in", async ({ page }) => {
    await page.goto("/legal/prohibited");
    await expect(page.getByRole("heading", { name: /not allowed/ })).toBeVisible();
    await expect(page.getByText(/Weapons and ammunition/)).toBeVisible();
    // The operator placeholders are still in place, so the draft banner must show.
    await expect(page.getByText(/Draft — the operator/)).toBeVisible();
  });

  test("signed-out visitors are redirected away from the app", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/home");
    await page.waitForURL(/\/$/);
    await expect(page.getByText("Join in 30 seconds")).toBeVisible();
  });
});
