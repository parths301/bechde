/**
 * Bech De seed — ports the prototype's static data (src/lib/data.ts) into the
 * database using the service-role client (bypasses RLS). Idempotent: profile /
 * listing / chat ids are deterministic, so re-running upserts rather than dupes.
 *
 * Run:  npx tsx supabase/seed.ts
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { items, chatThreads, homeCategories, USER_LOCATION, type Item } from "../src/lib/data";

// --- tiny .env.local loader (no dep) -------------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on ambient env */
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/**
 * Who a buyer actually reaches when they message a seeded listing.
 *
 * The seeded listings are being kept as real inventory, which means a real buyer can
 * message the guitar seller — and `rohan@bechde.local` cannot receive mail, so nobody
 * would ever reply. Set SEED_SELLER_EMAIL to an address you read and the seed
 * plus-addresses each seller off it (you+rohan@…), so the mail lands with you and you
 * can tell which listing it came from.
 *
 * Not hardcoded, because a personal address in a public repo is a different problem
 * from the one being solved. Left as .local for local development, where Mailpit
 * catches everything anyway — but seeding a *hosted* database without it is refused
 * below, since that is the case where a silent dead end reaches a real person.
 */
const SELLER_INBOX = process.env.SEED_SELLER_EMAIL?.trim();
const isLocalTarget = /127\.0\.0\.1|localhost/.test(url);

if (!isLocalTarget && !SELLER_INBOX) {
  console.error(
    "Refusing to seed a hosted database with unreachable seller addresses.\n" +
      "Set SEED_SELLER_EMAIL to a mailbox you monitor — a buyer who messages a seeded\n" +
      "listing has to reach a human, or the listing is a dead end wearing a face."
  );
  process.exit(1);
}

/** you@example.com + "rohan" → you+rohan@example.com */
function sellerAddress(handle: string): string {
  if (!SELLER_INBOX) return `${handle}@bechde.local`;
  const [local, domain] = SELLER_INBOX.split("@");
  return domain ? `${local}+${handle}@${domain}` : SELLER_INBOX;
}

// Deterministic UUID (v5-ish) from a stable string, so re-seeding is idempotent.
function uuidFrom(seed: string): string {
  const h = createHash("sha1").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// The demo buyer ("you" / Aisha) — the current-user side of every seeded chat.
const AISHA_ID = uuidFrom("profile:aisha");

/* A seed that ignores `error` reports success while writing nothing — that is exactly
   how the whole listings table went missing once. Every write goes through here. */
async function write(label: string, op: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await op;
  if (error) throw new Error(`${label} failed — ${error.message}`);
}

/** {k: "Reason", v: "Redecorating"}[] → {reason: "Redecorating"}, as 0018 does in SQL. */
function attrsFromFacts(facts: { k: string; v: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of facts ?? []) {
    if (!f?.k || !f?.v) continue;
    out[f.k.toLowerCase().replace(/[^a-z0-9]+/g, "_")] = f.v;
  }
  return out;
}

async function main() {
  // 1. categories -----------------------------------------------------------
  const categories = homeCategories.map((c) => ({ name: c.name, icon: c.icon }));
  await write("categories", db.from("categories").upsert(categories, { onConflict: "name" }));
  console.log(`categories: ${categories.length}`);

  // 2. profiles (unique sellers + the demo buyer) ---------------------------
  const sellerByName = new Map<string, Item["seller"]>();
  for (const it of items) sellerByName.set(it.seller.name, it.seller);

  const profiles = [
    {
      id: AISHA_ID,
      name: "Aisha",
      initial: "A",
      color: "#3E9B8F",
      email: sellerAddress("aisha"), // demo login links to this profile via handle_new_user
      bio: "hostel room minimalist in progress",
    },
    // NOTE: rating / sold / reply_time are deliberately NOT written here. They're
    // derived by triggers from reviews, sold listings and message timings — see
    // the "past deals" section below, which gives them something real to derive from.
    ...[...sellerByName.values()].map((s) => ({
      id: uuidFrom(`profile:${s.name}`),
      name: s.name,
      initial: s.initial,
      color: s.color,
      // Rohan is the other side of the demo guitar chat — give him a login too so the
      // two-party flow (message → offer → accept, live over Realtime) is demoable.
      // Only sellers a buyer can actually message get an address.
      email: s.name === "Rohan T." ? sellerAddress("rohan") : null,
    })),
  ];
  await write("profiles", db.from("profiles").upsert(profiles, { onConflict: "id" }));
  console.log(`profiles: ${profiles.length}`);

  // 3. listings -------------------------------------------------------------
  // Back-date created_at to match each item's "listed N days ago" copy, so recency
  // ordering and the derived relative timestamps are real rather than all-identical.
  const createdAtFor = (listedAgo: string): string => {
    const days = /(\d+)\s*day/.exec(listedAgo);
    const weeks = /(\d+)\s*week/.exec(listedAgo);
    const hours = /(\d+)\s*hour/.exec(listedAgo);
    let ago = 0;
    if (weeks) ago = Number(weeks[1]) * 7 * 86400_000;
    else if (days) ago = Number(days[1]) * 86400_000;
    else if (hours) ago = Number(hours[1]) * 3600_000;
    else if (/today|just now/.test(listedAgo)) ago = 3 * 3600_000;
    return new Date(Date.now() - ago).toISOString();
  };

  const listings = items.map((it) => ({
    created_at: createdAtFor(it.listedAgo),
    id: it.id,
    seller_id: uuidFrom(`profile:${it.seller.name}`),
    name: it.name,
    label: it.label,
    price: it.price,
    category: it.category,
    note: it.note,
    negotiable: it.negotiable,
    neighbourhood: it.neighbourhood,
    pickup: it.pickup,
    // Distance and radar placement are derived at read time from the viewer's own
    // position, so the legacy km/dist/home/map columns are gone (0009_cleanup.sql).
    lat: it.lat,
    lng: it.lng,
    angle: it.angle,
    listed_ago: it.listedAgo,
    status: it.listedAgo.startsWith("sold") ? "sold" : "active",
    story: it.story,
    facts: it.facts,
    // data.ts authors these as a {k,v} list because that reads well by hand; the
    // column is a map. Derived here with the same transform 0018 used to backfill,
    // so a reseed doesn't leave attrs empty while facts looks populated.
    attrs: attrsFromFacts(it.facts),
  }));
  await write("listings", db.from("listings").upsert(listings, { onConflict: "id" }));
  console.log(`listings: ${listings.length}`);

  // 4. chats + a seeded message/offer per thread ----------------------------
  const chats = [];
  const messages = [];
  const offers = [];
  for (const t of chatThreads) {
    const listing = items.find((i) => i.id === t.itemId);
    if (!listing) continue;
    const chatId = uuidFrom(`chat:${t.id}`);
    const sellerId = uuidFrom(`profile:${listing.seller.name}`);
    chats.push({
      id: chatId,
      listing_id: listing.id,
      buyer_id: AISHA_ID,
      seller_id: sellerId,
    });
    // Seed the thread's last line as a message from the seller (or you).
    const fromYou = t.last.startsWith("You:");
    messages.push({
      id: uuidFrom(`msg:${t.id}`),
      chat_id: chatId,
      sender_id: fromYou ? AISHA_ID : sellerId,
      body: t.last.replace(/^You:\s*/, ""),
    });
    // Guitar thread carries a live offer in the prototype.
    if (t.id === "yamaha-f310") {
      offers.push({
        id: uuidFrom(`offer:${t.id}`),
        chat_id: chatId,
        listing_id: listing.id,
        from_id: AISHA_ID,
        amount: "₹2,900",
        status: "pending",
      });
    }
  }
  await write("chats", db.from("chats").upsert(chats, { onConflict: "id" }));
  await write("messages", db.from("messages").upsert(messages, { onConflict: "id" }));
  await write("offers", db.from("offers").upsert(offers, { onConflict: "id" }));
  console.log(`chats: ${chats.length}, messages: ${messages.length}, offers: ${offers.length}`);

  // 5. past deals -----------------------------------------------------------
  // Reputation is derived, never written: a seller's ★ rating comes from review
  // rows, and their "sold" count from listings with status='sold'. So the demo
  // needs real history — each of these is a sold listing, the chat that sold it,
  // an accepted offer, and the review the buyer left afterwards.
  const pastDeals: {
    key: string;
    seller: string;
    name: string;
    price: string;
    category: Item["category"];
    daysAgo: number;
    rating: number;
    review: string;
    replied: string;
  }[] = [
    { key: "old-cycle", seller: "Rohan T.", name: "Hero Sprint cycle", price: "₹4,500", category: "Everything", daysAgo: 34, rating: 5, review: "Showed up on time and the cycle was exactly as described. Even threw in the lock.", replied: "Yes, still available!" },
    { key: "old-amp", seller: "Rohan T.", name: "Practice amp, 15W", price: "₹2,200", category: "Music", daysAgo: 61, rating: 5, review: "Let me test it for ten minutes before I paid. Zero pressure.", replied: "Sure, come try it out." },
    { key: "old-chair", seller: "Ananya S.", name: "Study chair", price: "₹900", category: "Furniture", daysAgo: 20, rating: 4, review: "Good chair, slightly wobblier than the photos suggested. Fair price though.", replied: "It's still there, come by." },
    { key: "old-speaker", seller: "Kabir M.", name: "Bluetooth speaker", price: "₹1,100", category: "Gadgets", daysAgo: 12, rating: 5, review: "Quick, friendly, met at the metro station. Easiest sale I've bought into.", replied: "Available — when suits you?" },
    { key: "old-books", seller: "Priya R.", name: "GATE prep book set", price: "₹800", category: "Books", daysAgo: 47, rating: 4, review: "Books were in good shape. Took a day to reply but no problems otherwise.", replied: "Sorry for the delay — yes, available." },
    { key: "old-heater", seller: "Meera K.", name: "Room heater", price: "₹1,400", category: "Everything", daysAgo: 78, rating: 5, review: "Honest about the small dent, which I appreciated. Works perfectly.", replied: "There's a small dent on the side, FYI." },
  ];

  const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86400_000 - hours * 3600_000).toISOString();

  const pastListings = pastDeals.map((d) => ({
    id: d.key,
    created_at: ago(d.daysAgo + 4),
    seller_id: uuidFrom(`profile:${d.seller}`),
    name: d.name,
    label: d.name.toLowerCase(),
    price: d.price,
    category: d.category,
    note: "Sold on Bech De.",
    neighbourhood: "Koramangala, Bengaluru",
    lat: USER_LOCATION.lat + 0.004,
    lng: USER_LOCATION.lng - 0.003,
    angle: "45deg",
    status: "sold",
    story: [],
    facts: [],
  }));

  const pastChats = pastDeals.map((d) => ({
    id: `chat-${d.key}`,
    listing_id: d.key,
    buyer_id: AISHA_ID,
    seller_id: uuidFrom(`profile:${d.seller}`),
    created_at: ago(d.daysAgo, 3),
  }));

  // Two messages per deal — the buyer's question and the seller's reply. The gap
  // between them is what refresh_reply_time() averages into "usually replies in…".
  const pastMessages = pastDeals.flatMap((d, i) => [
    { id: uuidFrom(`pastmsg:${d.key}:ask`), chat_id: `chat-${d.key}`, sender_id: AISHA_ID, body: "Hi! Is this still available?", created_at: ago(d.daysAgo, 3) },
    {
      id: uuidFrom(`pastmsg:${d.key}:reply`),
      chat_id: `chat-${d.key}`,
      sender_id: uuidFrom(`profile:${d.seller}`),
      body: d.replied,
      // 4–34 minutes later, varying per seller so reply times aren't identical
      created_at: new Date(Date.parse(ago(d.daysAgo, 3)) + (4 + i * 6) * 60_000).toISOString(),
    },
  ]);

  const pastOffers = pastDeals.map((d) => ({
    id: uuidFrom(`pastoffer:${d.key}`),
    chat_id: `chat-${d.key}`,
    listing_id: d.key,
    from_id: AISHA_ID,
    amount: d.price,
    status: "accepted",
    created_at: ago(d.daysAgo, 2),
  }));

  const pastReviews = pastDeals.map((d) => ({
    id: uuidFrom(`review:${d.key}`),
    offer_id: uuidFrom(`pastoffer:${d.key}`),
    chat_id: `chat-${d.key}`,
    listing_id: d.key,
    reviewer_id: AISHA_ID,
    subject_id: uuidFrom(`profile:${d.seller}`),
    rating: d.rating,
    body: d.review,
    created_at: ago(d.daysAgo),
  }));

  await write("past listings", db.from("listings").upsert(pastListings, { onConflict: "id" }));
  await write("past chats", db.from("chats").upsert(pastChats, { onConflict: "id" }));
  await write("past messages", db.from("messages").upsert(pastMessages, { onConflict: "id" }));
  await write("past offers", db.from("offers").upsert(pastOffers, { onConflict: "id" }));
  await write("past reviews", db.from("reviews").upsert(pastReviews, { onConflict: "id" }));
  console.log(`past deals: ${pastDeals.length} (sold listings + chats + accepted offers + reviews)`);

  console.log("✔ seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
