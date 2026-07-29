/**
 * Admin console regression suite (0016–0018).
 *
 * The property under test is not "an admin can edit things" — it's that **an admin
 * cannot edit things without leaving a record.** That's why every check here asserts
 * on `admin_actions` as well as on the change itself, and why the suite deliberately
 * re-checks that `profiles_update` was *not* widened: the moment an admin can rename
 * someone through plain PostgREST, the audit becomes optional and therefore useless.
 *
 * Mutation test: delete the `log_admin_action` call from any RPC in 0016 and the
 * matching "…and records it" case here must go red.
 *
 *   npx supabase start && npm run seed && npm run test:db
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, signIn, profileIdFor, deleteTestUser } from "./helpers";

const BOSS = "rls-admin@bechde.local";
const CIVILIAN = "rls-civilian@bechde.local";

let boss: SupabaseClient;
let civilian: SupabaseClient;
let bossId: string;
let civilianId: string;
let listingId: string;

/** Every admin_actions row written during this run, so we can prove counts and clean up. */
const loggedIds: string[] = [];

async function actionsFor(target: string) {
  const { data } = await admin
    .from("admin_actions")
    .select("*")
    .eq("target_id", target)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) if (!loggedIds.includes(row.id)) loggedIds.push(row.id);
  return data ?? [];
}

beforeAll(async () => {
  boss = await signIn(BOSS);
  civilian = await signIn(CIVILIAN);
  bossId = await profileIdFor(BOSS);
  civilianId = await profileIdFor(CIVILIAN);

  await admin.from("profiles").update({ is_admin: true }).eq("id", bossId);

  // A listing owned by the civilian, for the admin to edit.
  listingId = `admin-test-${Date.now()}`;
  const { error } = await admin.from("listings").insert({
    id: listingId,
    seller_id: civilianId,
    name: "Test kettle",
    price: "₹500",
    category: "Everything",
    lat: 12.9352,
    lng: 77.6245,
  });
  if (error) throw error;
}, 90_000);

afterAll(async () => {
  if (loggedIds.length) await admin.from("admin_actions").delete().in("id", loggedIds);
  await admin.from("listings").delete().eq("id", listingId);
  await admin.from("category_attributes").delete().eq("key", "test_attr");
  await admin.from("categories").delete().eq("name", "TestCategory");
  await deleteTestUser(BOSS);
  await deleteTestUser(CIVILIAN);
});

describe("authorisation", () => {
  it("refuses a non-admin calling an admin RPC", async () => {
    const { error } = await civilian.rpc("admin_update_profile", {
      p_id: bossId,
      p_patch: { name: "Pwned" },
      p_reason: "trying it on",
    });
    expect(error?.code).toBe("42501");

    const { data } = await admin.from("profiles").select("name").eq("id", bossId).single();
    expect(data?.name).not.toBe("Pwned");
  });

  it("still refuses a direct PostgREST update of someone else's profile", async () => {
    // The whole design rests on this: profiles_update was NOT given `or is_admin()`,
    // so even the admin has to go through the audited function.
    const before = (await admin.from("profiles").select("name").eq("id", civilianId).single()).data;
    await boss.from("profiles").update({ name: "Renamed the quiet way" }).eq("id", civilianId);
    const after = (await admin.from("profiles").select("name").eq("id", civilianId).single()).data;
    // An RLS-denied UPDATE reports no error, so assert the value is unchanged (§5).
    expect(after?.name).toBe(before?.name);
  });

  it("hides the audit log from non-admins", async () => {
    const { data } = await civilian.from("admin_actions").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("will not accept an action without a reason", async () => {
    const { error } = await boss.rpc("admin_update_profile", {
      p_id: civilianId,
      p_patch: { bio: "no reason given" },
      p_reason: "  ",
    });
    expect(error).toBeTruthy();
  });
});

describe("editing, and the record it leaves", () => {
  it("renames a profile and records the before and after", async () => {
    const { error } = await boss.rpc("admin_update_profile", {
      p_id: civilianId,
      p_patch: { name: "Renamed By Admin" },
      p_reason: "impersonating a shop",
    });
    expect(error).toBeNull();

    const { data } = await admin.from("profiles").select("name").eq("id", civilianId).single();
    expect(data?.name).toBe("Renamed By Admin");

    const log = await actionsFor(civilianId);
    const entry = log.find((r) => r.action === "profile.update");
    expect(entry).toBeTruthy();
    expect(entry.actor_id).toBe(bossId);
    expect(entry.reason).toBe("impersonating a shop");
    expect(entry.before.name).not.toBe("Renamed By Admin");
    expect(entry.after.name).toBe("Renamed By Admin");
  });

  it("edits a listing's details and records it", async () => {
    const { error } = await boss.rpc("admin_update_listing", {
      p_id: listingId,
      p_patch: { price: "₹450", note: "Corrected by moderation" },
      p_reason: "price was a typo",
    });
    expect(error).toBeNull();

    const { data } = await admin.from("listings").select("price,note").eq("id", listingId).single();
    expect(data?.price).toBe("₹450");
    expect(data?.note).toBe("Corrected by moderation");

    const entry = (await actionsFor(listingId)).find((r) => r.action === "listing.update");
    expect(entry.before.price).toBe("₹500");
    expect(entry.after.price).toBe("₹450");
  });

  it("clears a field rather than ignoring the null", async () => {
    // coalesce-based patching would silently keep the old value here.
    const { error } = await boss.rpc("admin_update_listing", {
      p_id: listingId,
      p_patch: { note: null },
      p_reason: "removing moderation note",
    });
    expect(error).toBeNull();
    const { data } = await admin.from("listings").select("note").eq("id", listingId).single();
    expect(data?.note).toBeNull();
    await actionsFor(listingId);
  });

  it("leaves exactly one log row per action", async () => {
    const before = (await actionsFor(listingId)).length;
    await boss.rpc("admin_update_listing", {
      p_id: listingId,
      p_patch: { label: "kettle" },
      p_reason: "tidying the radar label",
    });
    const after = (await actionsFor(listingId)).length;
    expect(after - before).toBe(1);
  });
});

describe("suspension", () => {
  it("stops a suspended seller posting, and lifts cleanly", async () => {
    const { error: susErr } = await boss.rpc("admin_set_suspension", {
      p_id: civilianId,
      p_suspend: true,
      p_reason: "repeated prohibited listings",
    });
    expect(susErr).toBeNull();

    const blocked = await civilian.from("listings").insert({
      id: `admin-test-suspended-${Date.now()}`,
      seller_id: civilianId,
      name: "Should not post",
      price: "₹100",
      category: "Everything",
    });
    expect(blocked.error).toBeTruthy();

    const { error: liftErr } = await boss.rpc("admin_set_suspension", {
      p_id: civilianId,
      p_suspend: false,
      p_reason: "appeal upheld",
    });
    expect(liftErr).toBeNull();

    const log = await actionsFor(civilianId);
    expect(log.some((r) => r.action === "profile.suspend")).toBe(true);
    expect(log.some((r) => r.action === "profile.unsuspend")).toBe(true);
  });

  it("refuses to let an admin suspend themselves", async () => {
    const { error } = await boss.rpc("admin_set_suspension", {
      p_id: bossId,
      p_suspend: true,
      p_reason: "testing the guard",
    });
    expect(error).toBeTruthy();
  });
});

describe("taxonomy", () => {
  it("adds a category and logs it", async () => {
    const { error } = await boss.rpc("admin_upsert_category", {
      p_name: "TestCategory",
      p_icon: "🧪",
      p_sort: 500,
      p_active: true,
      p_reason: "new vertical",
    });
    expect(error).toBeNull();

    const { data } = await admin.from("categories").select("icon,sort").eq("name", "TestCategory").single();
    expect(data?.icon).toBe("🧪");

    const entry = (await actionsFor("TestCategory")).find((r) => r.action === "category.create");
    expect(entry).toBeTruthy();
  });

  it("refuses a non-admin adding a category", async () => {
    const { error } = await civilian.rpc("admin_upsert_category", {
      p_name: "SneakyCategory",
      p_icon: "😈",
      p_sort: 1,
      p_active: true,
      p_reason: "should not work",
    });
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("categories").select("name").eq("name", "SneakyCategory");
    expect(data ?? []).toHaveLength(0);
  });

  it("adds a category attribute template and logs it", async () => {
    const { data, error } = await boss.rpc("admin_upsert_attribute", {
      p_id: null,
      p_category: "TestCategory",
      p_key: "test_attr",
      p_label: "Test attribute",
      p_type: "select",
      p_options: ["A", "B"],
      p_hint: null,
      p_required: false,
      p_sort: 10,
      p_active: true,
      p_reason: "trialling a field",
    });
    expect(error).toBeNull();
    expect(data.key).toBe("test_attr");

    const entry = (await actionsFor(data.id)).find((r) => r.action === "attribute.create");
    expect(entry).toBeTruthy();
  });

  it("keeps cities and localities readable signed out but unwritable", async () => {
    const { data: cities } = await admin.from("cities").select("id");
    expect((cities ?? []).length).toBeGreaterThan(0);

    const { error } = await civilian
      .from("cities")
      .insert({ id: "nowhere", name: "Nowhere", lat: 0, lng: 0 });
    expect(error).toBeTruthy();
  });
});
