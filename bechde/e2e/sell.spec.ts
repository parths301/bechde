import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** Service-role client, for cleanup only — this spec is the one that writes rows. */
function adminClient() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * The sell form is labelled with aria-labels, not placeholders, and the category is a
 * row of chip buttons rather than a <select> — the accessibility pass made every
 * control a real button. Locate them the way a screen-reader user would.
 */
test.describe("Sell flow", () => {
  test("creates a new listing with a photo", async ({ page }) => {
    await page.goto("/sell");

    await expect(page.getByRole("heading", { name: /What are you letting go/ })).toBeVisible();

    const name = `E2E lamp ${Date.now()}`;
    await page.getByLabel("Listing name").fill(name);
    await page.getByLabel("Price in rupees").fill("1,500");
    await page.getByRole("button", { name: /Furniture/ }).click();
    await page.getByLabel("Tell its story").fill("Just testing the sell flow.");

    // A 1×1 PNG is enough to exercise validate → compress → upload → public URL.
    await page.locator('input[type="file"]').setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });
    // The submit button is disabled until the upload finishes, so Playwright's
    // actionability check waits for the photo rather than clicking into the void.
    await page.getByRole("button", { name: /Bech de!/ }).click({ timeout: 30_000 });

    // Success panel, then follow it through to the listing that was just created.
    await expect(page.getByText("Bech diya!")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "e2e/screenshots/sell-success.png" });

    await page.getByRole("button", { name: /View listing/ }).click();
    await page.waitForURL(/\/product\//);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("₹1,500").first()).toBeVisible();
    await expect(page.getByText("Just testing the sell flow.").first()).toBeVisible();

    // Leave the database as we found it — otherwise every run adds a listing and the
    // seeded counts other specs assert against drift upwards.
    await adminClient().from("listings").delete().eq("name", name);
  });
});
