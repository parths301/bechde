import { test, expect } from "@playwright/test";

test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test("shows mobile map instead of radar on home screen", async ({ page }) => {
    await page.goto("/home");

    // The radar should be hidden or not present
    // Instead we should see the feed and maybe a map toggle or button
    await expect(page.getByRole("heading", { name: /Good stuff/ })).toBeVisible();

    // The "Radar" or "Map" in mobile view is on a separate screen or toggle, 
    // let's verify navigation to /map or the presence of a mobile bottom nav.
    await expect(page.locator("nav").getByText("Map")).toBeVisible();
    await page.locator("nav").getByText("Map").click();

    await page.waitForURL(/\/map/);
    
    // Check if map controls/tiles are visible
    await expect(page.locator(".leaflet-container")).toBeVisible();
    
    // There should be a "List" toggle on mobile map view to go back
    await expect(page.locator("nav").getByText("Home")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/mobile-map.png" });
  });

  /**
   * Phones show the same radar as desktop, scaled down — not a plain map. It first
   * shipped as an empty street map with a lone "you" pin, directly above a feed
   * announcing items 0.1 km away; then as a map with true-coordinate bubbles, which
   * crowded into an unreadable pile on a 343px-wide map. Scaling the real radar keeps
   * the ring spacing and bubble relaxation that make it legible at any size.
   */
  test("the hero radar is shown, scaled to fit, with its listings", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /Good stuff/ })).toBeVisible();

    const radar = page.locator(".bd-hero-radar");
    await expect(radar).toBeVisible();

    // Scaled down rather than clipped: the wrapper must be no wider than the screen.
    const wrapper = page.locator(".bd-radar-scale");
    const fit = await wrapper.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const scale = Number(getComputedStyle(el).getPropertyValue("--bd-radar-scale"));
      return { right: b.right, width: b.width, height: b.height, scale, vw: document.documentElement.clientWidth };
    });
    expect(fit.scale).toBeGreaterThan(0);
    expect(fit.scale).toBeLessThan(1); // a phone can't fit the 560px radar unscaled
    expect(fit.right).toBeLessThanOrEqual(fit.vw + 1);
    expect(fit.height).toBeGreaterThan(100); // the wrapper reserves real space

    // The bubbles bob forever, so their box never settles and a click's stability
    // check never passes. Playwright's `reducedMotion` emulation doesn't take effect
    // in this setup (verified: matchMedia still reports false), so stop the motion
    // directly. Real users with the OS setting get the same via prefers-reduced-motion.
    await page.addStyleTag({ content: `*, *::before, *::after { animation: none !important; transition: none !important; }` });

    // Bubbles are real listings, and each is a way into one. `count()` is a one-shot
    // read with no auto-wait, so it sampled the radar before the listings query
    // resolved and reported zero bubbles on a page that renders them a moment later.
    const bubbles = radar.getByRole("button");
    await expect(bubbles.first()).toBeVisible();
    await bubbles.first().click();
    await page.waitForURL(/\/product\//);
  });
});
