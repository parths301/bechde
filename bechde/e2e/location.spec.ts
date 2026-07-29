import { test, expect } from "@playwright/test";

/**
 * The location used to be asked for again on every screen, and the answer overwrote
 * whatever city had been chosen by hand — so picking "Jaipur" survived exactly until
 * the next navigation. It was also offered twice on /home at once: a standalone chip
 * above the heading and a second one inside the search bar.
 *
 * These run as a guest (no storageState) so nothing touches the seeded profiles: a
 * signed-out visitor's location lives only in localStorage.
 */
test.use({
  storageState: { cookies: [], origins: [] },
  permissions: ["geolocation"],
  geolocation: { latitude: 12.9352, longitude: 77.6245 },
});

const CHANGE_LOCATION = /Change location/;

test("/home offers exactly one location control, on desktop and on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/home");
  await expect(page.getByRole("button", { name: CHANGE_LOCATION })).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: CHANGE_LOCATION })).toHaveCount(1);
});

test("a chosen city survives reloads and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");

  // A click can land before React has hydrated the chip, which on a cold route is a
  // silent no-op — retry until the sheet actually opens rather than assuming it did.
  await expect(async () => {
    await page.getByRole("button", { name: CHANGE_LOCATION }).click();
    await expect(page.getByText("Select Location & City")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });

  await page.getByRole("button", { name: /Jaipur/ }).click();

  const chip = page.getByRole("button", { name: CHANGE_LOCATION });
  await expect(chip).toContainText(/Jaipur|C-Scheme/);

  await page.reload();
  await expect(page.getByRole("button", { name: CHANGE_LOCATION })).toContainText(/Jaipur|C-Scheme/);

  await page.goto("/map");
  await expect(page.getByRole("button", { name: CHANGE_LOCATION }).first()).toContainText(/Jaipur|C-Scheme/);

  // A deliberate pick is recorded as such — that is what stops the one-shot GPS
  // fallback from ever replacing it.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("bechde_user_location") ?? "null"));
  expect(stored.source).toBe("manual");
});

test("the browser is asked for a position only once across screens", async ({ page }) => {
  // Counted in sessionStorage rather than a closure: addInitScript re-runs on every
  // navigation, so a plain counter would reset exactly where the bug used to hide.
  await page.addInitScript(() => {
    const geo = navigator.geolocation;
    const original = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = ((...args: Parameters<typeof original>) => {
      try {
        sessionStorage.setItem("gps_calls", String(Number(sessionStorage.getItem("gps_calls") ?? 0) + 1));
      } catch {}
      return original(...args);
    }) as typeof original;
  });

  await page.goto("/home");
  await expect(page.getByRole("button", { name: CHANGE_LOCATION }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bechde_location_prompted")))
    .toBe("1");

  // /sell and /profile are behind the proxy's auth gate, so a guest can only exercise
  // the public screens — which is where the repeat prompts were most visible anyway.
  for (const route of ["/map", "/search?q=mirror", "/home", "/map"]) {
    await page.goto(route);
    await page.waitForTimeout(500);
  }

  const calls = await page.evaluate(() => Number(sessionStorage.getItem("gps_calls") ?? 0));
  expect(calls, "geolocation was requested again after the first answer").toBe(1);
});
