import { test, expect, type BrowserContext } from "@playwright/test";

/**
 * Sign-in that survives crossing devices.
 *
 * The magic link is PKCE-bound: only the browser holding the code verifier can redeem
 * it. On a phone that's the normal case, not an edge case — request the link in
 * Chrome, tap it inside the Gmail app's webview, and sign-in fails silently. The
 * 6-digit code has no such binding.
 *
 * The whole point is proved by *where* the code is redeemed: this spec requests it in
 * one browser context and types it into a second, entirely separate one. If the code
 * were PKCE-bound like the link, the second context would fail — which is what would
 * happen if someone ever "simplified" the server route into a browser-side verifyOtp.
 *
 * README §4 also warns that Node scripts get the implicit flow and pass while real browsers
 * are broken. Both halves here run in real Chromium contexts for that reason.
 */
const MAILPIT = "http://127.0.0.1:54324";
// Unique per run: GoTrue throttles repeat sends to the same address to roughly one a
// minute, so a fixed address makes the spec fail on the second run of the day for a
// reason that has nothing to do with the code path being tested.
const EMAIL = `code-tester-${Date.now()}@bechde.local`;

async function latestCodeFor(email: string): Promise<string> {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=30`).then((r) => r.json());
    const msg = list.messages?.find((m: { To: { Address: string }[] }) =>
      m.To.some((t) => t.Address === email)
    );
    if (!msg) continue;
    const mail = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json());
    const body = `${mail.HTML ?? ""}${mail.Text ?? ""}`;
    // The template renders {{ .Token }} on its own line, in a 30px block.
    const m = body.match(/>(\d{6})</) ?? body.match(/\b(\d{6})\b/);
    if (m) return m[1];
  }
  throw new Error(`no sign-in code arrived for ${email}`);
}

async function guest(browser: { newContext: (o?: object) => Promise<BrowserContext> }) {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

test("a code requested in one browser signs you in from another", async ({ browser }) => {
  // A stale token from an earlier run reads as "invalid or expired" and is baffling (README §4).
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });

  // Browser A asks for the code.
  const asking = await guest(browser);
  const askPage = await asking.newPage();
  await askPage.goto("http://localhost:3000/login");
  await askPage.getByLabel("Email").fill(EMAIL);
  await askPage.getByRole("button", { name: /Email me a link/ }).click();
  await expect(askPage.getByText("Check your email")).toBeVisible({ timeout: 20_000 });

  const code = await latestCodeFor(EMAIL);
  expect(code).toMatch(/^\d{6}$/);

  // Browser B — a different context, no verifier, no cookies — redeems the *same*
  // code. It reaches the code field via "I already have a code" rather than asking
  // for another, which is both what a real second device does and the only thing the
  // send throttle permits.
  const other = await guest(browser);
  const otherPage = await other.newPage();
  await otherPage.goto("http://localhost:3000/login");
  await otherPage.getByLabel("Email").fill(EMAIL);
  await otherPage.getByRole("button", { name: /I already have a code/ }).click();
  await otherPage.getByLabel("Six-digit sign-in code").fill(code);
  await otherPage.getByRole("button", { name: "Sign in" }).click();

  await otherPage.waitForURL(/\/home/, { timeout: 30_000 });
  await expect(otherPage.getByRole("link", { name: /Bech de!/ })).toBeVisible();

  await asking.close();
  await other.close();
});

test("a wrong code is refused without signing anyone in", async ({ browser }) => {
  const ctx = await guest(browser);
  const page = await ctx.newPage();

  const res = await page.request.post("http://localhost:3000/api/auth/verify-code", {
    data: { email: EMAIL, token: "000000" },
  });
  expect(res.status()).toBe(400);

  // Still a guest: /sell is gated in src/proxy.ts, so it must bounce to /login.
  await page.goto("http://localhost:3000/sell");
  await page.waitForURL(/\/login/);
  await ctx.close();
});

test("a malformed code is rejected before it reaches GoTrue", async ({ page }) => {
  const short = await page.request.post("/api/auth/verify-code", { data: { email: EMAIL, token: "12" } });
  expect(short.status()).toBe(400);
  expect((await short.json()).error).toMatch(/six digits/);

  const noEmail = await page.request.post("/api/auth/verify-code", { data: { token: "123456" } });
  expect(noEmail.status()).toBe(400);
});

test.afterAll(async () => {
  const { readFileSync } = await import("node:fs");
  const { createClient } = await import("@supabase/supabase-js");
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  await admin.from("profiles").delete().eq("email", EMAIL);
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === EMAIL);
  if (user) await admin.auth.admin.deleteUser(user.id);
});
