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

/**
 * The leak sweep.
 *
 * It used to look at `nav a, nav button` only, and passed while home, search, chat,
 * profile, the error pages and the report sheet were still rendering English — the nav
 * was simply the part that had been converted. Scoping a leak test to the code you just
 * wrote is how you get a green suite and an English app.
 *
 * So: every leaf element with its own text, on every main screen. Listing titles, seller
 * names and free text are user data and stay in whatever language they were typed in,
 * which is why the sweep skips anything inside `[data-user-content]` and ignores strings
 * that look like data rather than a label.
 */
const SCREENS = ["/home", "/search", "/map", "/sell", "/chat", "/profile"];

for (const path of SCREENS) {
  test(`no English leaks on ${path}`, async ({ page }) => {
    await page.goto("/home");
    await switchToHindi(page);
    await page.goto(path);
    // Not networkidle: /chat holds a realtime subscription open, so it never fires.
    // The header rendering in Hindi is the signal that the page is up and switched.
    await expect(page.getByRole("link", { name: /रडार/ })).toBeVisible();

    const english = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        if (el.closest("[data-user-content]")) continue;
        // Leaf text only, so a container isn't reported for its children's words.
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent || "").trim())
          .join(" ")
          .trim();
        if (!own) continue;
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        // Two or more English words: a label or a sentence, not a brand or a unit.
        if (/[A-Za-z]{3,}(\s+|\s*[.,?!—]\s*)[A-Za-z]{3,}/.test(own)) out.push(own);
      }
      return out;
    });

    // Brands, model names and things that are the same word in both languages.
    const ALLOWED = /Bech De|iPhone|OpenStreetMap|km|Wi-?Fi/i;
    const leaks = english.filter((s) => !ALLOWED.test(s));
    expect(leaks, `untranslated on ${path}:\n  ${leaks.join("\n  ")}`).toEqual([]);
  });
}

test("the switched page renders Devanagari at all", async ({ page }) => {
  await page.goto("/home");
  await switchToHindi(page);
  const text = (await page.locator("body").textContent()) ?? "";
  expect(DEVANAGARI.test(text)).toBe(true);
});
