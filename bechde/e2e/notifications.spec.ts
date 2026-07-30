import { test, expect } from "@playwright/test";

/**
 * The scheduled senders, and the property this whole change exists to establish:
 * **a send that cannot happen fails loudly.**
 *
 * The function these replaced did `console.log("[EMAIL] To: …")` and then advanced
 * last_notified_at as though a message had gone out, so P1-2 read as done for months
 * while nothing was ever sent. That is the same shape as the seed that ignored
 * `error` (§5). The first test here is the regression test for it: with no
 * RESEND_API_KEY the route must refuse, not quietly stamp rows.
 */
const SECRET = "local-dev-cron-secret";

test.describe("cron routes", () => {
  for (const path of ["/api/cron/messages", "/api/cron/saved-searches"]) {
    test(`${path} refuses an unauthenticated caller`, async ({ page }) => {
      const res = await page.request.get(path);
      expect(res.status()).toBe(401);
    });

    test(`${path} refuses to pretend when email isn't configured`, async ({ page }) => {
      // RESEND_API_KEY is unset locally, so this is the real path, not a mock.
      const res = await page.request.get(path, {
        headers: { authorization: `Bearer ${SECRET}` },
      });
      expect(res.status()).toBe(503);
      expect((await res.json()).error).toMatch(/RESEND_API_KEY/);
    });
  }
});

test("unsubscribing works from a link, signed out", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();

  // A token nobody holds must be refused, and say so plainly rather than 500.
  await page.goto("http://localhost:3000/unsubscribe?t=00000000-0000-0000-0000-000000000000&k=messages");
  await expect(page.getByRole("heading", { name: /didn't work/ })).toBeVisible();

  await ctx.close();
});

test("a real token silences that person, signed out", async ({ browser }) => {
  const { readFileSync } = await import("node:fs");
  const { createClient } = await import("@supabase/supabase-js");
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile } = await db.from("profiles").select("id").eq("email", "rohan@bechde.local").single();
  const { data: tok } = await db
    .from("notification_tokens")
    .select("token")
    .eq("profile_id", profile!.id)
    .single();

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000/unsubscribe?t=${tok!.token}&k=saved_searches`);
  await expect(page.getByRole("heading", { name: /that's off/ })).toBeVisible();

  const { data: after } = await db
    .from("profiles")
    .select("notify_saved_searches, notify_messages")
    .eq("id", profile!.id)
    .single();
  expect(after!.notify_saved_searches).toBe(false);
  // One switch, not both.
  expect(after!.notify_messages).toBe(true);

  // Leave the seed as found.
  await db.from("profiles").update({ notify_saved_searches: true }).eq("id", profile!.id);
  await ctx.close();
});

test("the profile exposes the same switches", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByLabel("New messages")).toBeVisible();
  await expect(page.getByLabel("Saved-search matches")).toBeVisible();
});
