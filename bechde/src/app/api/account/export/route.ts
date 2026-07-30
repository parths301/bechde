import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * "Tell me what personal data of mine you hold" — the DPDP access right the privacy
 * policy promises, as a JSON download.
 *
 * Deliberately built on the **cookie-bound anon client**, not the service role. Every
 * table below is already RLS-scoped to its owner, so the database decides what lands
 * in the file. Get a filter wrong here and you get too little, never somebody else's
 * rows. A service-role version of this route would be one typo away from a breach.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "no profile" }, { status: 404 });
  }
  const me = profile.id as string;

  // Chats first: messages and offers are scoped by chat, so we need the ids.
  const { data: chats } = await supabase.from("chats").select("*").or(`buyer_id.eq.${me},seller_id.eq.${me}`);
  const chatIds = (chats ?? []).map((c: { id: string }) => c.id);

  const [listings, savedItems, savedSearches, messages, offers, reviewsWritten, reviewsReceived, reportsMade] =
    await Promise.all([
      supabase.from("listings").select("*").eq("seller_id", me),
      supabase.from("saved_items").select("*").eq("user_id", me),
      supabase.from("saved_searches").select("*").eq("user_id", me),
      chatIds.length ? supabase.from("messages").select("*").in("chat_id", chatIds) : { data: [] },
      chatIds.length ? supabase.from("offers").select("*").in("chat_id", chatIds) : { data: [] },
      supabase.from("reviews").select("*").eq("reviewer_id", me),
      supabase.from("reviews").select("*").eq("subject_id", me),
      supabase.from("reports").select("*").eq("reporter_id", me),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    about:
      "Everything Bech De holds that is linked to your account. Messages include the " +
      "other person's replies, because a conversation is not yours alone — they are " +
      "here so your own record is complete.",
    account: { email: user.email, signed_up: user.created_at },
    profile,
    listings: listings.data ?? [],
    saved_items: savedItems.data ?? [],
    saved_searches: savedSearches.data ?? [],
    chats: chats ?? [],
    messages: messages.data ?? [],
    offers: offers.data ?? [],
    reviews_you_wrote: reviewsWritten.data ?? [],
    reviews_about_you: reviewsReceived.data ?? [],
    reports_you_made: reportsMade.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="bechde-data-${me.slice(0, 8)}.json"`,
      // Personal data must not sit in a shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
