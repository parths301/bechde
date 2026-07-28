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

/**
 * The location sheet is a separate trap: it's `position: fixed`, so it escapes the
 * page-level overflow check above and needs measuring on its own.
 *
 * It was 520px wide on a 390px phone. `max-width: 100%` looked like it should have
 * prevented that, but the overlay was an auto-sized grid whose column took its
 * width *from* the sheet — so 100% resolved to the sheet's own 520px and
 * constrained nothing. Testing it only at 915px hid this, because 520px fits there.
 * Hence: narrow viewports first.
 */
const SHEET_VIEWPORTS = [
  { name: "small phone", width: 360, height: 780 },
  { name: "phone", width: 390, height: 844 },
  { name: "landscape phone", width: 915, height: 412 },
];

for (const vp of SHEET_VIEWPORTS) {
  test(`the location sheet fits and scrolls — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // Opened from /map, where the chip lives in the filter rail.
    await page.goto("/map");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /Change location/ }).first().click();

    const heading = page.getByText("Select Location & City");
    await expect(heading).toBeVisible();

    const fits = await heading.evaluate((el) => {
      const sheet = el.closest<HTMLElement>("[style*='border-radius: 20px']") ?? el.parentElement!.parentElement!;
      const b = sheet.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      return {
        left: Math.round(b.left),
        right: Math.round(b.right),
        vw,
        withinX: b.left >= -1 && b.right <= vw + 1,
        withinY: b.height <= vh + 1,
        // Taller than the screen is fine only if it can actually be scrolled.
        reachable: sheet.scrollHeight <= sheet.clientHeight || getComputedStyle(sheet).overflowY === "auto",
      };
    });

    expect(fits.withinX, `sheet spans ${fits.left}–${fits.right} in a ${fits.vw}px viewport`).toBe(true);
    expect(fits.withinY).toBe(true);
    expect(fits.reachable).toBe(true);
  });
}
