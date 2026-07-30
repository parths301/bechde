/**
 * Email notification state (0020).
 *
 * The property that matters most here isn't the toggles — it's that the unsubscribe
 * token is a credential and is stored like one. profiles is world-readable, so a token
 * column there would have handed every user's out to any caller; it lives in its own
 * table with RLS on and no policies. These tests assert both halves: nobody can read
 * it, and the SECURITY DEFINER function that consumes it still works for an anonymous
 * caller, which is the whole point of a link in an email.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anon, signIn, profileIdFor, deleteTestUser } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUBBER = "rls-subscriber@bechde.local";
// Signed in once and reused — the helper clears Mailpit on every call, so repeat
// sign-ins race each other and trip the auth rate limit (README §4).
let subber: SupabaseClient;
let subberId: string;
let token: string;

beforeAll(async () => {
  subber = await signIn(SUBBER);
  subberId = await profileIdFor(SUBBER);

  // The trigger in 0020 should have minted one on profile insert.
  const { data } = await admin.from("notification_tokens").select("token").eq("profile_id", subberId).single();
  token = data!.token as string;
}, 90_000);

afterAll(async () => {
  await deleteTestUser(SUBBER);
});

describe("the unsubscribe token", () => {
  it("is minted automatically for every profile", () => {
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("cannot be read by anyone through the API", async () => {
    const { error: anonErr } = await anon().from("notification_tokens").select("*");
    expect(anonErr).toBeTruthy();

    const { error: userErr } = await subber.from("notification_tokens").select("*");
    expect(userErr).toBeTruthy();
  });

  it("is not exposed on the world-readable profiles row either", async () => {
    const { data } = await anon().from("profiles").select("*").eq("id", subberId).single();
    expect(data).toBeTruthy();
    // The embed still works — that's the reason it isn't a hidden column on profiles.
    expect(Object.keys(data!)).not.toContain("unsubscribe_token");
  });
});

describe("unsubscribing", () => {
  it("works for a signed-out caller holding the token", async () => {
    const before = await admin.from("profiles").select("notify_messages").eq("id", subberId).single();
    expect(before.data!.notify_messages).toBe(true);

    const { data, error } = await anon().rpc("unsubscribe_by_token", { p_token: token, p_kind: "messages" });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const after = await admin.from("profiles").select("notify_messages, notify_saved_searches").eq("id", subberId).single();
    expect(after.data!.notify_messages).toBe(false);
    // One kind off must not silence the other.
    expect(after.data!.notify_saved_searches).toBe(true);
  });

  it("reports failure for a token nobody holds, without erroring", async () => {
    const { data, error } = await anon().rpc("unsubscribe_by_token", {
      p_token: "00000000-0000-0000-0000-000000000000",
      p_kind: "all",
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("refuses a kind it doesn't recognise", async () => {
    const { error } = await anon().rpc("unsubscribe_by_token", { p_token: token, p_kind: "everything" });
    expect(error).toBeTruthy();
  });

  it("lets the owner turn it back on", async () => {
    const { error } = await subber.from("profiles").update({ notify_messages: true }).eq("id", subberId);
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("notify_messages").eq("id", subberId).single();
    expect(data!.notify_messages).toBe(true);
  });

  it("does not let one person change another's preferences", async () => {
    const rohan = await profileIdFor("rohan@bechde.local");
    const before = await admin.from("profiles").select("notify_messages").eq("id", rohan).single();

    await subber.from("profiles").update({ notify_messages: false }).eq("id", rohan);

    // An RLS-denied UPDATE reports success on zero rows, so assert the value (README §4).
    const after = await admin.from("profiles").select("notify_messages").eq("id", rohan).single();
    expect(after.data!.notify_messages).toBe(before.data!.notify_messages);
  });
});
