import { test as setup } from "@playwright/test";
import { signIn } from "./auth";

export const STORAGE_STATE = "e2e/.auth/aisha.json";

/**
 * Sign in once per run and reuse the session. Signing in per test would send a
 * magic-link email each time, which trips Supabase Auth's rate limit and makes the
 * suite fail for a reason that has nothing to do with the code under test.
 */
setup("authenticate as the demo buyer", async ({ page }) => {
  await signIn(page, "aisha@bechde.local");
  await page.context().storageState({ path: STORAGE_STATE });
});
