import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The admin console, driven the way an admin drives it.
 *
 * The RLS suite already proves the database refuses a non-admin and records every
 * write. What it can't prove is that the console is *reachable and operable* — that
 * the reason prompt appears, that a save round-trips, and that the change then shows
 * up in the audit log. That's this spec.
 *
 * Aisha is the signed-in user for the whole E2E suite, so the flag is granted here and
 * revoked afterwards: the suite has to leave the database exactly as seeded.
 */
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

const AISHA = "aisha@bechde.local";
const LISTING_ID = "e2e-admin-listing";
let sellerId: string;

test.beforeAll(async () => {
  const db = adminClient();
  await db.from("profiles").update({ is_admin: true }).eq("email", AISHA);

  const { data: seller } = await db.from("profiles").select("id").eq("email", AISHA).single();
  sellerId = seller!.id;

  await db.from("listings").upsert({
    id: LISTING_ID,
    seller_id: sellerId,
    name: "Admin test lamp",
    price: "₹900",
    category: "Everything",
    lat: 12.9352,
    lng: 77.6245,
    status: "active",
  });
});

test.afterAll(async () => {
  const db = adminClient();
  await db.from("admin_actions").delete().eq("target_id", LISTING_ID);
  await db.from("listings").delete().eq("id", LISTING_ID);
  await db.from("profiles").update({ is_admin: false }).eq("email", AISHA);
});

test("the console is reachable from the header and shows real counts", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: /Console/ }).click();
  await expect(page.getByRole("heading", { name: /Console/ })).toBeVisible();
  // "Active listings" is a real count query, so it must not be the em-dash placeholder.
  const active = page.locator("text=Active listings").locator("..").locator("div").first();
  await expect(active).not.toHaveText("—");
});

test("editing a listing demands a reason, then records the change", async ({ page }) => {
  await page.goto("/admin/listings");

  await page.getByLabel("Search listings").fill("Admin test lamp");
  const row = page.locator("text=Admin test lamp").first();
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();

  await page.getByLabel("Listing price").fill("₹750");
  await page.getByRole("button", { name: "Save changes" }).click();

  // The reason prompt is the point: the database rejects a write without one, so the
  // UI must collect it rather than surfacing a Postgres constraint error.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText(/Say why/)).toBeVisible();

  await page.getByLabel("Reason for this action").fill("e2e — correcting a typo in the price");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("₹750")).toBeVisible();
});

test("the edit appears in the audit log with its before and after", async ({ page }) => {
  await page.goto("/admin/audit");

  const entry = page.getByText("e2e — correcting a typo in the price").first();
  await expect(entry).toBeVisible();

  await entry.click();
  await expect(page.getByText("₹900")).toBeVisible(); // was
  await expect(page.getByText("₹750")).toBeVisible(); // now
});

test("taxonomy lists the attribute templates the sell form will ask for", async ({ page }) => {
  await page.goto("/admin/taxonomy");
  await page.getByRole("button", { name: "Attributes" }).click();

  await expect(page.getByText("Asked of every listing")).toBeVisible();
  await expect(page.getByText("Condition", { exact: true })).toBeVisible();
  // Category-specific templates exist too, or the sell form has nothing to vary on.
  await expect(page.getByText("Category-specific")).toBeVisible();
});

test("a non-admin gets nothing", async ({ page }) => {
  const db = adminClient();
  await db.from("profiles").update({ is_admin: false }).eq("email", AISHA);

  await page.goto("/admin/listings");
  await expect(page.getByText(/Checking permissions/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

  await db.from("profiles").update({ is_admin: true }).eq("email", AISHA);
});
