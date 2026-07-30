/**
 * Account closure (0019).
 *
 * Two properties worth a test. First, closing your account must not take the other
 * party's chat history with it — profiles cascade into listings, chats and messages,
 * so a naive `delete from profiles` would erase the buyer's record of a deal they were
 * part of. Second, the function takes no arguments and resolves the profile from
 * auth.uid(), so there is nothing to forge; this asserts that a caller can only ever
 * close their own.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, profileIdFor, deleteTestUser } from "./helpers";

const LEAVER = "rls-leaver@bechde.local";
const STAYER = "rls-stayer@bechde.local";

let leaver: SupabaseClient;
// Signed in once in beforeAll and reused: the helper clears Mailpit on every call, so
// repeat sign-ins race each other and trip the auth rate limit (§5).
let stayer: SupabaseClient;
let leaverId: string;
let stayerId: string;
let listingId: string;
let chatId: string;

beforeAll(async () => {
  leaver = await signIn(LEAVER);
  stayer = await signIn(STAYER);
  leaverId = await profileIdFor(LEAVER);
  stayerId = await profileIdFor(STAYER);

  listingId = `close-test-${Date.now()}`;
  await admin.from("listings").insert({
    id: listingId,
    seller_id: leaverId,
    name: "Kettle the leaver is selling",
    price: "₹400",
    category: "Everything",
    lat: 12.9352,
    lng: 77.6245,
    status: "active",
  });

  chatId = `close-chat-${Date.now()}`;
  await admin.from("chats").insert({ id: chatId, listing_id: listingId, buyer_id: stayerId, seller_id: leaverId });
  await admin.from("messages").insert([
    { chat_id: chatId, sender_id: stayerId, body: "Is this still available?" },
    { chat_id: chatId, sender_id: leaverId, body: "Yes, come by any evening." },
  ]);

  await admin.from("saved_searches").insert({ user_id: leaverId, q: "kettle", category: "All" });
}, 90_000);

afterAll(async () => {
  await admin.from("chats").delete().eq("id", chatId);
  await admin.from("listings").delete().eq("id", listingId);
  await deleteTestUser(LEAVER);
  await deleteTestUser(STAYER);
});

describe("closing an account", () => {
  it("refuses an anonymous caller", async () => {
    const { anon } = await import("./helpers");
    const { error } = await anon().rpc("close_my_account");
    expect(error).toBeTruthy();
  });

  it("anonymises the profile and withdraws its live listings", async () => {
    const { error } = await leaver.rpc("close_my_account");
    expect(error).toBeNull();

    const { data: profile } = await admin.from("profiles").select("*").eq("id", leaverId).single();
    expect(profile!.name).toBe("Deleted user");
    expect(profile!.bio).toBeNull();
    expect(profile!.email).toBeNull();
    expect(profile!.lat).toBeNull();
    expect(profile!.closed_at).not.toBeNull();

    const { data: listing } = await admin.from("listings").select("status").eq("id", listingId).single();
    expect(listing!.status).toBe("removed");

    const { data: searches } = await admin.from("saved_searches").select("id").eq("user_id", leaverId);
    expect(searches ?? []).toHaveLength(0);
  });

  it("leaves the other party's conversation intact", async () => {
    // The point of anonymising instead of deleting. Both messages must survive, and
    // the buyer must still be able to read the thread they were part of.
    const { data: messages } = await admin.from("messages").select("body").eq("chat_id", chatId);
    expect(messages ?? []).toHaveLength(2);

    const { data: visible } = await stayer.from("messages").select("body").eq("chat_id", chatId);
    expect((visible ?? []).length).toBe(2);
  });

  it("cannot be pointed at anyone else — there is no id to pass", async () => {
    // The RPC takes no arguments by design. Supplying one is rejected outright rather
    // than silently ignored, which is the property the delete route depends on.
    const { error } = await stayer.rpc("close_my_account", { p_id: leaverId } as never);
    expect(error).toBeTruthy();

    const { data } = await admin.from("profiles").select("name").eq("id", stayerId).single();
    expect(data!.name).not.toBe("Deleted user");
  });
});
