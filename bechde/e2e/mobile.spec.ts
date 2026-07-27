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
});
