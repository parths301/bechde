import { test, expect } from "@playwright/test";

/**
 * The DPDP rights, as a user meets them.
 *
 * Closure itself is covered in supabase/tests/account.test.ts, not here: the whole E2E
 * suite shares one signed-in storageState, so actually closing Aisha's account would
 * take every other spec down with it. What this checks is that the controls exist, the
 * export returns that person's real data, and the irreversible one can't be reached by
 * a single stray click.
 */
test("the profile offers export, consent withdrawal and closure", async ({ page }) => {
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Your data" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download my data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forget my location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close my account", exact: true })).toBeVisible();
});

test("closing an account takes a deliberate confirmation", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Close my account", exact: true }).click();

  // Revealed, but inert until CLOSE is typed — one click must never be enough.
  const confirm = page.getByRole("button", { name: /Close my account for good/ });
  await expect(confirm).toBeDisabled();

  await page.getByLabel("Type CLOSE to confirm").fill("close");
  await expect(confirm).toBeDisabled(); // case-sensitive on purpose

  await page.getByLabel("Type CLOSE to confirm").fill("CLOSE");
  await expect(confirm).toBeEnabled();

  // Deliberately not clicking it — see the file comment.
  await page.getByRole("button", { name: "Close my account", exact: true }).click();
  await expect(confirm).toBeHidden();
});

test("the export returns this account's own data", async ({ page }) => {
  await page.goto("/profile");
  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  // Personal data must not be cacheable by a proxy.
  expect(res.headers()["cache-control"]).toContain("no-store");

  const body = await res.json();
  expect(body.account.email).toBe("aisha@bechde.local");
  expect(body.profile.name).toBeTruthy();
  // Aisha has seeded chats, so the export must actually contain something.
  expect(Array.isArray(body.messages)).toBe(true);
  expect(body.chats.length).toBeGreaterThan(0);

  // Every chat returned must be one she is actually in — the route leans on RLS for
  // this, so a regression there would show up as somebody else's thread appearing.
  const me = body.profile.id;
  for (const c of body.chats) {
    expect([c.buyer_id, c.seller_id]).toContain(me);
  }
});

test("the export refuses a signed-out request", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await ctx.request.get("http://localhost:3000/api/account/export");
  expect(res.status()).toBe(401);
  await ctx.close();
});
