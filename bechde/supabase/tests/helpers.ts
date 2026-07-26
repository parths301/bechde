/**
 * Shared plumbing for the RLS suite. These tests run against the LOCAL Supabase
 * stack (`npx supabase start` + `npx tsx supabase/seed.ts`) and sign in for real
 * by pulling the magic-link out of Mailpit, because the policies being tested key
 * off `auth.uid()`.
 */
import { readFileSync } from "node:fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const MAILPIT = "http://127.0.0.1:54324";

/** Service-role client — bypasses RLS. For arranging fixtures and cleaning up only. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** A signed-out browser client, i.e. what a stranger sees. */
export const anon = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function signIn(email: string): Promise<SupabaseClient> {
  const sb = anon();
  // Clear the mailbox so we can't pick up an already-consumed token from an
  // earlier run — that failure reads as "Email link is invalid or has expired".
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  let msg: { ID: string } | undefined;
  for (let i = 0; i < 20 && !msg; i++) {
    await sleep(400);
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=30`).then((r) => r.json());
    msg = list.messages?.find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === email));
  }
  if (!msg) throw new Error(`no magic-link email arrived for ${email}`);

  // The email links to GoTrue's ConfirmationURL (…/verify?token=<hash>&type=…).
  // These node clients use the implicit flow, so that hash can be redeemed directly
  // — no browser, no code verifier.
  const mail = (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json())) as {
    HTML?: string;
    Text?: string;
  };
  const body = `${mail.HTML ?? ""}${mail.Text ?? ""}`;
  const token_hash = body.match(/[?&]token=([^&"'\s]+)/)?.[1] ?? body.match(/token_hash=([^&"'\s]+)/)?.[1];
  if (!token_hash) throw new Error(`no verification token in the email for ${email}`);
  const { error } = await sb.auth.verifyOtp({ type: "email", token_hash });
  if (error) throw error;
  return sb;
}

export async function profileIdFor(email: string): Promise<string> {
  const { data, error } = await admin.from("profiles").select("id").eq("email", email).single();
  if (error) throw error;
  return data.id as string;
}

/** Remove a throwaway account created by a test, auth user included. */
export async function deleteTestUser(email: string) {
  await admin.from("profiles").delete().eq("email", email);
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
