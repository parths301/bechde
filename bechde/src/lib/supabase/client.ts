"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key). Safe to use in Client Components.
 * Reads public env vars injected at build time.
 */
/**
 * Note on the auth flow: `createBrowserClient` hard-codes `flowType: "pkce"` (see
 * @supabase/ssr's createBrowserClient.js) — it can't be overridden. So the emailed
 * link carries a `pkce_…` token that only the browser holding the code verifier can
 * redeem, and `/auth/confirm` completes it with `exchangeCodeForSession`. The
 * practical consequence is that the magic link must be opened in the same browser
 * that requested it.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Singleton for hooks/components that just need a ready client.
let browserClient: ReturnType<typeof createClient> | undefined;

export function getSupabaseBrowser() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}
