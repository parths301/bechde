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
   * The hero map is the radar's stand-in on phones, so it has to carry the same
   * listings. It shipped with no `markers` prop at all: an empty street map with a
   * lone "you" pin, directly above a feed announcing items 0.1 km away. Nothing
   * errored and nothing looked broken — the content was just absent.
   */
  test("the hero map shows the nearby listings, not just an empty street map", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /Good stuff/ })).toBeVisible();

    const heroMap = page.locator(".bd-hero-mobilemap");
    await expect(heroMap).toBeVisible();

    const pins = heroMap.locator(".bd-pin-icon");
    await expect(pins.first()).toBeVisible({ timeout: 15_000 });

    // The count claimed in the hero pill is what the map should be plotting.
    const claimed = Number(
      (await page.getByText(/things for sale within/).first().innerText()).match(/(\d+)/)?.[1] ?? 0
    );
    expect(claimed).toBeGreaterThan(0);
    expect(await pins.count()).toBe(claimed);

    // A bubble is a way into the listing, same as a radar bubble is on desktop.
    // Click the last one: Leaflet stacks markers by latitude, so on a map this small
    // the earlier ones are genuinely underneath their neighbours and only the topmost
    // is hittable. That's inherent to plotting real coordinates — the feed below the
    // map is how you reach the rest.
    await pins.last().click();
    await page.waitForURL(/\/product\//);
  });
});
