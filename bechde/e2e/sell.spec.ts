import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Sell flow", () => {
  test("creates a new listing with a photo", async ({ page }) => {
    await page.goto("/sell");

    await expect(page.getByRole("heading", { name: "What are you selling?" })).toBeVisible();

    await page.getByPlaceholder("Name of the item").fill("Test e2e item");
    await page.getByPlaceholder("₹ Price").fill("1500");
    await page.getByRole("combobox", { name: /Category/i }).selectOption("Furniture");
    await page.getByPlaceholder("Any details").fill("Just testing the sell flow.");

    // The image upload uses a hidden input inside a label. We can locate the input and set files.
    // We will upload a dummy file from the e2e directory.
    // Create a dummy image file first if it doesn't exist, or just use a small base64 data url?
    // Playwright allows setting buffer as file.
    await page.locator('input[type="file"]').setInputFiles({
      name: "test-image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    });

    await page.getByRole("button", { name: /Post listing/ }).click();

    // After success, it navigates to the new listing's page.
    await page.waitForURL(/\/product\//);
    await expect(page.getByRole("heading", { name: "Test e2e item" })).toBeVisible();
    await expect(page.getByText("₹1,500")).toBeVisible();
    await expect(page.getByText("Just testing the sell flow.")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/sell-success.png" });
  });
});
