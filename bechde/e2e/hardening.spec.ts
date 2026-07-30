import { test, expect } from "@playwright/test";

/**
 * The things that only matter once the site is public: it shouldn't be framable, a
 * dead link shouldn't dump someone on Next's default error page, and /api/geocode
 * shouldn't be a free geocoding proxy for the internet.
 *
 * Asserted against a running server rather than by reading next.config.ts, because a
 * headers() block that never matches the route looks identical in source to one that
 * does.
 */
test("security headers are actually served", async ({ page }) => {
  const res = await page.request.get("/home");
  const h = res.headers();

  // An auth-cookie site inside an iframe is a clickjacking target — an invisible
  // overlay over "Withdraw listing" is enough.
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  // Geolocation is the product, so it must stay allowed for us specifically.
  expect(h["permissions-policy"]).toContain("geolocation=(self)");
});

test("a dead listing link lands on the branded 404, not Next's default", async ({ page }) => {
  const res = await page.goto("/product/this-listing-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to the radar/ })).toBeVisible();
});

test("an unknown route gets the same page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
});

test("the health check reports on the database, not just itself", async ({ page }) => {
  const res = await page.request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBe("up");
});

test.describe("geocode is no longer an open proxy", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("refuses a signed-out caller", async ({ page }) => {
    const res = await page.request.get("/api/geocode?q=Koramangala");
    expect(res.status()).toBe(401);
  });
});

test("a signed-in caller still gets a result", async ({ page }) => {
  const res = await page.request.get("/api/geocode?q=Koramangala");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.lat).toBe("number");
  expect(body.label).toBeTruthy();
  // Tied to a session now, so it must not sit in a shared cache.
  expect(res.headers()["cache-control"]).toContain("private");
});
