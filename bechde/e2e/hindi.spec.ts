import { test, expect } from "@playwright/test";

/**
 * Hindi mode, checked the only way that means anything: switch the toggle and look at
 * what's on the screen.
 *
 * `i18n.test.ts` proves the two resource files agree. It cannot prove that a screen
 * *uses* them — before this work the dictionary had 92 keys and exactly two of them were
 * wired up, so the toggle changed two nav labels and nothing else. These tests assert on
 * rendered Devanagari, per screen, which is the thing that was actually broken.
 */
const DEVANAGARI = /[ऀ-ॿ]/;

async function switchToHindi(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Toggle language|भाषा बदलें/ }).click();
  // The header nav is the fastest confirmation the instance actually swapped.
  await expect(page.getByRole("link", { name: /रडार/ })).toBeVisible();
}

test("the toggle switches the whole app, not just the nav", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText("Good stuff,")).toBeVisible();

  await switchToHindi(page);

  // Headline, blurb and the map link — the body of the page, not the chrome.
  await expect(page.getByText("अच्छा सामान,")).toBeVisible();
  await expect(page.getByText(/अपने ही मोहल्ले के लोगों से/)).toBeVisible();
  await expect(page.getByText(/सब मैप पर देखें/)).toBeVisible();
});

test("the choice survives a reload and a navigation", async ({ page }) => {
  await page.goto("/home");
  await switchToHindi(page);

  await page.reload();
  await expect(page.getByRole("link", { name: /रडार/ })).toBeVisible();

  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: /क्या बेचना है/ })).toBeVisible();
});

for (const [route, marker] of [
  ["/sell", /क्या बेचना है/],
  ["/search?q=table", /खोज|कैटेगरी|कीमत/],
  ["/chat", /चैट/],
  ["/profile", /आपका डेटा|साइन आउट/],
  ["/product/yamaha-f310", /ऑफर दें|प्रोफाइल देखें/],
] as const) {
  test(`${route} renders in Hindi`, async ({ page }) => {
    await page.goto("/home");
    await switchToHindi(page);
    await page.goto(route);
    await expect(page.getByText(marker).first()).toBeVisible();
  });
}

test("the sign-in page translates too, as a guest", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/login");

  await page.getByRole("button", { name: /Toggle language/ }).click();
  await expect(page.getByText("30 सेकंड में जुड़िए")).toBeVisible();
  // The consent sentence goes through <Trans>, so its links must survive translation.
  await expect(page.getByRole("link", { name: "शर्तों" })).toBeVisible();
  await expect(page.getByRole("link", { name: "प्राइवेसी पॉलिसी" })).toBeVisible();

  await ctx.close();
});

test("no English leaks into the main screens once switched", async ({ page }) => {
  await page.goto("/home");
  await switchToHindi(page);

  // Sweep the visible chrome for English sentences. Listing names, seller names and
  // prices are user data — they stay in whatever language they were written in, which
  // is why this looks at labelled controls rather than all text.
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("nav a, nav button"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean)
  );
  const english = labels.filter((l) => /^[A-Za-z][A-Za-z\s!+]{3,}$/.test(l));
  expect(english, `untranslated nav labels: ${english.join(", ")}`).toEqual([]);
  expect(labels.some((l) => DEVANAGARI.test(l))).toBe(true);
});
