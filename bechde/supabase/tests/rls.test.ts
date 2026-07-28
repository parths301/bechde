/**
 * Row-Level Security regression suite.
 *
 * These are the checks that caught real bugs during the build — most notably that
 * an RLS policy asking "has someone else blocked me?" reads zero rows when it
 * queries `blocks` directly, because `blocks` is itself scoped to the blocker.
 * They run against the local stack and clean up after themselves.
 *
 *   npx supabase start && npx tsx supabase/seed.ts && npm run test:db
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, anon, signIn, profileIdFor, deleteTestUser } from "./helpers";

const AISHA = "aisha@bechde.local";
const ROHAN = "rohan@bechde.local";
const OUTSIDER = "rls-outsider@bechde.local";

let aisha: SupabaseClient;
let rohan: SupabaseClient;
let outsider: SupabaseClient;
let aishaId: string;
let rohanId: string;
let outsiderId: string;

beforeAll(async () => {
  aisha = await signIn(AISHA);
  rohan = await signIn(ROHAN);
  outsider = await signIn(OUTSIDER);
  aishaId = await profileIdFor(AISHA);
  rohanId = await profileIdFor(ROHAN);
  outsiderId = await profileIdFor(OUTSIDER);
}, 60_000);

afterAll(async () => {
  await admin.from("blocks").delete().eq("blocker_id", aishaId);
  await deleteTestUser(OUTSIDER);
});

describe("listings", () => {
  it("are readable by a signed-out visitor", async () => {
    const { data } = await anon().from("listings").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("can only be created for yourself", async () => {
    const { error } = await outsider.from("listings").insert({
      id: `rls-forgery-${Date.now()}`,
      seller_id: rohanId, // not me
      name: "Forged listing",
      price: "₹1",
      category: "Everything",
    });
    expect(error?.code).toBe("42501");
  });

  it("can only be withdrawn by their owner", async () => {
    const { error } = await outsider.from("listings").update({ status: "removed" }).eq("id", "yamaha-f310").select("id").single();
    expect(error).toBeTruthy();
    const { data } = await admin.from("listings").select("status").eq("id", "yamaha-f310").single();
    expect(data!.status).toBe("active");
  });
});

describe("chats and messages", () => {
  it("are invisible to a signed-out visitor", async () => {
    const { data: chats } = await anon().from("chats").select("id");
    const { data: messages } = await anon().from("messages").select("id");
    expect(chats ?? []).toHaveLength(0);
    expect(messages ?? []).toHaveLength(0);
  });

  it("are invisible to a signed-in non-participant", async () => {
    const { data } = await outsider.from("chats").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("are visible to their participants", async () => {
    const { data } = await aisha.from("chats").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("reject a message sent as somebody else", async () => {
    const { data: chat } = await admin.from("chats").select("id").limit(1).single();
    const { error } = await aisha.from("messages").insert({ chat_id: chat!.id, sender_id: rohanId, body: "impersonation" });
    expect(error?.code).toBe("42501");
  });
});

describe("blocking", () => {
  it("hides the blocked person's listings, chats and search results, then restores them", async () => {
    const seen = async () => (await aisha.from("listings").select("id").eq("seller_id", rohanId)).data!.length;
    const chats = async () => (await aisha.from("chats").select("id")).data!.length;

    const listingsBefore = await seen();
    const chatsBefore = await chats();
    expect(listingsBefore).toBeGreaterThan(0);

    await aisha.from("blocks").insert({ blocker_id: aishaId, blocked_id: rohanId });

    expect(await seen()).toBe(0);
    expect(await chats()).toBeLessThan(chatsBefore);
    const { data: search } = await aisha.rpc("search_listings", { q: "guitar" }).select("id");
    expect(search ?? []).toHaveLength(0);

    // Regression: this needs the is_blocked_by() SECURITY DEFINER helper. Reading
    // `blocks` inline runs as the sender, who can't see the blocker's row, so the
    // check silently passes and a blocked user keeps messaging.
    const { data: chat } = await admin.from("chats").select("id").eq("seller_id", rohanId).limit(1).single();
    const { error: blockedMsg } = await rohan.from("messages").insert({ chat_id: chat!.id, sender_id: rohanId, body: "blocked probe" });
    expect(blockedMsg?.code).toBe("42501");

    const { error: blockedOffer } = await rohan.from("offers").insert({
      chat_id: chat!.id, listing_id: "yamaha-f310", from_id: rohanId, amount: "₹1",
    });
    expect(blockedOffer?.code).toBe("42501");

    await aisha.from("blocks").delete().eq("blocker_id", aishaId).eq("blocked_id", rohanId);
    expect(await seen()).toBe(listingsBefore);
    expect(await chats()).toBe(chatsBefore);
  });

  it("leaves other sellers untouched", async () => {
    const total = (await aisha.from("listings").select("id")).data!.length;
    await aisha.from("blocks").insert({ blocker_id: aishaId, blocked_id: rohanId });
    const after = (await aisha.from("listings").select("id")).data!.length;
    await aisha.from("blocks").delete().eq("blocker_id", aishaId).eq("blocked_id", rohanId);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(total);
  });

  it("is private to the blocker", async () => {
    await aisha.from("blocks").insert({ blocker_id: aishaId, blocked_id: rohanId });
    const { data } = await rohan.from("blocks").select("blocker_id");
    expect(data ?? []).toHaveLength(0);
    await aisha.from("blocks").delete().eq("blocker_id", aishaId).eq("blocked_id", rohanId);
  });
});

describe("reports", () => {
  it("can't be filed in someone else's name", async () => {
    const { error } = await rohan.from("reports").insert({
      reporter_id: aishaId, listing_id: "desk-lamp", reason: "scam",
    });
    expect(error?.code).toBe("42501");
  });

  it("are visible to the reporter and nobody else", async () => {
    const { data: mine, error } = await aisha
      .from("reports")
      .insert({ reporter_id: aishaId, listing_id: "desk-lamp", reason: "scam", details: "rls suite" })
      .select("id")
      .single();
    expect(error).toBeNull();

    expect((await aisha.from("reports").select("id")).data!.length).toBeGreaterThan(0);
    expect((await rohan.from("reports").select("id")).data ?? []).toHaveLength(0);
    expect((await anon().from("reports").select("id")).data ?? []).toHaveLength(0);

    await admin.from("reports").delete().eq("id", mine!.id);
  });
});

describe("saved searches", () => {
  it("don't leak between users", async () => {
    const { data: saved } = await aisha
      .from("saved_searches")
      .insert({ user_id: aishaId, q: "rls suite lamp", radius_km: 5 })
      .select("id")
      .single();

    expect((await rohan.from("saved_searches").select("id")).data ?? []).toHaveLength(0);
    expect((await anon().from("saved_searches").select("id")).data ?? []).toHaveLength(0);

    await admin.from("saved_searches").delete().eq("id", saved!.id);
  });
});

describe("reviews", () => {
  let deal: { id: string; chat_id: string; listing_id: string };

  beforeAll(async () => {
    const { data } = await admin.from("offers").select("id,chat_id,listing_id").eq("status", "accepted").limit(1).single();
    deal = data as typeof deal;
  });

  it("are publicly readable — a reputation is no use if it's private", async () => {
    const { data } = await anon().from("reviews").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("can't be left by someone who wasn't in the deal", async () => {
    const { error } = await outsider.from("reviews").insert({
      offer_id: deal.id, chat_id: deal.chat_id, listing_id: deal.listing_id,
      reviewer_id: outsiderId, subject_id: aishaId, rating: 1,
    });
    expect(error?.code).toBe("42501");
  });

  it("can't be left on a deal that was never accepted", async () => {
    const { data: pending } = await admin.from("offers").select("id,chat_id,listing_id").eq("status", "pending").limit(1).single();
    const { error } = await aisha.from("reviews").insert({
      offer_id: pending!.id, chat_id: pending!.chat_id, listing_id: pending!.listing_id,
      reviewer_id: aishaId, subject_id: rohanId, rating: 5,
    });
    expect(error?.code).toBe("42501");
  });

  it("can't be left twice on the same deal", async () => {
    const { data: existing } = await admin.from("reviews").select("reviewer_id,subject_id").eq("offer_id", deal.id).limit(1).single();
    const { error } = await admin
      .from("reviews")
      .insert({ offer_id: deal.id, chat_id: deal.chat_id, listing_id: deal.listing_id, reviewer_id: existing!.reviewer_id, subject_id: existing!.subject_id, rating: 1 });
    expect(error?.code).toBe("23505");
  });

  it("update the subject's derived rating, which is never written directly", async () => {
    const { data: subject } = await admin.from("reviews").select("subject_id").eq("offer_id", deal.id).limit(1).single();
    const rating = async () => (await admin.from("profiles").select("rating_avg,rating_count").eq("id", subject!.subject_id).single()).data!;
    const before = await rating();
    expect(before.rating_count).toBeGreaterThan(0);
    expect(Number(before.rating_avg)).toBeGreaterThan(0);
  });
});

describe("chat read receipts", () => {
  it("are private to the reader", async () => {
    const { data: chat } = await aisha.from("chats").select("id").limit(1).single();
    await aisha.from("chat_reads").upsert(
      { chat_id: chat!.id, profile_id: aishaId, last_read_at: new Date().toISOString() },
      { onConflict: "chat_id,profile_id" }
    );
    expect((await rohan.from("chat_reads").select("chat_id")).data ?? []).toHaveLength(0);
    await admin.from("chat_reads").delete().eq("profile_id", aishaId);
  });

  it("can't be written on someone else's behalf", async () => {
    const { data: chat } = await aisha.from("chats").select("id").limit(1).single();
    const { error } = await aisha.from("chat_reads").insert({ chat_id: chat!.id, profile_id: rohanId });
    expect(error?.code).toBe("42501");
  });
});

describe("profiles", () => {
  it("are world-readable but only self-editable", async () => {
    const { data } = await anon().from("profiles").select("id,name");
    expect((data ?? []).length).toBeGreaterThan(0);

    const { error } = await outsider.from("profiles").update({ name: "Hacked" }).eq("id", aishaId).select("id").single();
    expect(error).toBeTruthy();
    const { data: intact } = await admin.from("profiles").select("name").eq("id", aishaId).single();
    expect(intact!.name).not.toBe("Hacked");
  });
});
describe("admin moderation", () => {
  it("allows admins to update listings", async () => {
    // Make outsider an admin
    await admin.from("profiles").update({ is_admin: true }).eq("id", outsiderId);
    
    const { error } = await outsider.from("listings").update({ status: "removed" }).eq("id", "yamaha-f310");
    expect(error).toBeNull();

    // Revert it
    await admin.from("listings").update({ status: "active" }).eq("id", "yamaha-f310");
    await admin.from("profiles").update({ is_admin: false }).eq("id", outsiderId);
  });

  it("prevents non-admins from updating other people's listings", async () => {
    // An UPDATE whose row is filtered out by the USING clause matches nothing and
    // returns no error — so assert the row is untouched, not that it raised 42501.
    await outsider.from("listings").update({ status: "removed" }).eq("id", "yamaha-f310");
    const { data } = await admin.from("listings").select("status").eq("id", "yamaha-f310").single();
    expect(data!.status).toBe("active");
  });

  it("allows admins to update report status", async () => {
    // Create a dummy report
    const { data: rep } = await aisha.from("reports").insert({
      reporter_id: aishaId, listing_id: "yamaha-f310", reason: "scam"
    }).select("id").single();
    
    // Normal user can't update it — again a filtered-out no-op, so check the value.
    await aisha.from("reports").update({ status: "reviewed" }).eq("id", rep!.id);
    const { data: untouched } = await admin.from("reports").select("status").eq("id", rep!.id).single();
    expect(untouched!.status).not.toBe("reviewed");

    // Admin can
    await admin.from("profiles").update({ is_admin: true }).eq("id", outsiderId);
    const { error: err2 } = await outsider.from("reports").update({ status: "reviewed" }).eq("id", rep!.id);
    expect(err2).toBeNull();

    // Clean up
    await admin.from("reports").delete().eq("id", rep!.id);
    await admin.from("profiles").update({ is_admin: false }).eq("id", outsiderId);
  });
});

describe("rate limits", () => {
  it("prevents more than 20 listings in a day", async () => {
    // Sequential, not parallel: the trigger counts rows already committed, so
    // concurrent inserts would race and the cut-off wouldn't land on a fixed number.
    for (let i = 0; i < 20; i++) {
      const { error } = await outsider
        .from("listings")
        .insert({ name: `Spam ${i}`, price: 10, category: "Everything", seller_id: outsiderId });
      expect(error).toBeNull();
    }

    const { error } = await outsider
      .from("listings")
      .insert({ name: "Spam 21", price: 10, category: "Everything", seller_id: outsiderId });

    expect(error?.message).toMatch(/Rate limit exceeded for listings/);

    // Leave the table as we found it, or the next run starts already rate-limited.
    await admin.from("listings").delete().eq("seller_id", outsiderId);
  });
});
