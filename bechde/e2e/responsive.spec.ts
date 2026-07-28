import { test, expect } from "@playwright/test";

/**
 * Horizontal-overflow guard.
 *
 * `html, body { overflow-x: hidden }` means an over-wide page doesn't produce a
 * scrollbar — it silently crops its own right-hand edge, and whatever sits there
 * becomes unreachable. That's how the radius value, "Make an offer", the max price
 * field and "Save this search" all went missing on phones without anything looking
 * obviously broken.
 *
 * The usual cause is `min-width: auto`: grid and flex items refuse to shrink below
 * their widest un-wrappable child, so one nowrap chip ("Bengaluru (Koramangala)")
 * pushed whole pages to 472px on a 390px screen. This test fails the moment that
 * happens again.
 */
const VIEWPORTS = [
  { name: "small phone", width: 360, height: 780 },
  { name: "phone", width: 390, height: 844 },
  { name: "large phone", width: 430, height: 932 },
  { name: "phone landscape", width: 915, height: 412 },
  { name: "desktop", width: 1280, height: 800 },
];

const ROUTES = ["/home", "/map", "/search?q=mirror", "/product/bookshelf", "/profile", "/chat", "/sell"];

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of ROUTES) {
      await page.goto(route);
      // Leaflet sizes itself after mount, so let the maps settle before measuring.
      await page.waitForTimeout(1500);

      const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const culprits: string[] = [];
        document.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return;
          if (box.right <= vw + 1) return;
          // Report the outermost offender only, and ignore Leaflet's own tile
          // plane, which is legitimately wider than its clipping container.
          const parent = el.parentElement?.getBoundingClientRect();
          if (parent && parent.right > vw + 1) return;
          if (el.closest(".leaflet-container") || el.classList.contains("bd-skip-link")) return;
          culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} → ${(el.textContent || "").trim().slice(0, 40)}`);
        });
        return { scrollWidth: document.body.scrollWidth, clientWidth: vw, culprits: culprits.slice(0, 5) };
      });

      expect(
        scrollWidth,
        `${route} at ${vp.width}px overflows by ${scrollWidth - clientWidth}px. Widest offenders:\n  ${culprits.join("\n  ")}`
      ).toBeLessThanOrEqual(clientWidth + 1);
    }
  });
}

test("the location sheet fits a landscape phone and scrolls", async ({ page }) => {
  // 412px tall: the city list is taller than the screen, so the sheet itself has
  // to scroll or "Popular Cities" is simply unreachable.
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto("/home");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Select location|📍/ }).first().click();

  const sheet = page.getByText("Select Location & City").locator("xpath=ancestor::div[2]");
  await expect(sheet).toBeVisible();

  const fits = await sheet.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return {
      insideViewport: b.left >= -1 && b.right <= document.documentElement.clientWidth + 1,
      scrollable: el.scrollHeight > el.clientHeight ? getComputedStyle(el).overflowY === "auto" : true,
    };
  });
  expect(fits.insideViewport).toBe(true);
  expect(fits.scrollable).toBe(true);
});
