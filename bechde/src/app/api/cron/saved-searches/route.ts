import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMail, emailConfigured } from "@/lib/email/send";
import { savedSearchEmail } from "@/lib/email/templates";
import { denyIfNotCron, siteUrl, unsubscribeUrl, unsubscribeHeaders, tokenOf } from "@/lib/email/cron";

/**
 * Saved-search digests — what supabase/functions/notify-saved-searches only pretended
 * to do. That function console.logged "[EMAIL] To: …" and then advanced
 * last_notified_at as though it had sent, so the loop looked closed and wasn't.
 *
 * Moved out of Deno and into the app for a concrete reason beyond tidiness:
 * tsconfig.json excludes supabase/, so the Edge Function was never type-checked. This
 * route shares the templates and the sender with everything else, and `tsc` sees it.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = denyIfNotCron(request);
  if (denied) return denied;
  if (!emailConfigured) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set; no mail was sent" }, { status: 503 });
  }

  const db = createAdminClient();
  const { data: searches, error } = await db
    .from("saved_searches")
    .select("id, user_id, q, category, min_price, max_price, created_at, last_notified_at")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!searches?.length) return NextResponse.json({ notified: 0 });

  const userIds = [...new Set(searches.map((s) => s.user_id as string))];
  const { data: people } = await db
    .from("profiles")
    .select("id, email, notify_saved_searches, closed_at, notification_tokens(token)")
    .in("id", userIds);
  const person = new Map((people ?? []).map((p) => [p.id as string, p]));

  let notified = 0;

  for (const s of searches) {
    const who = person.get(s.user_id as string);
    if (!who?.email || !who.notify_saved_searches || who.closed_at) continue;

    const since = (s.last_notified_at as string | null) ?? (s.created_at as string);

    const { data: matches, error: rpcError } = await db.rpc("search_listings", { q: s.q });
    if (rpcError) continue;

    type Match = { id: string; name: string; price: string; category: string | null; price_num: number | null; created_at: string; status: string; seller_id: string };
    const fresh = ((matches ?? []) as Match[]).filter((m) => {
      if (m.status !== "active") return false;
      if (new Date(m.created_at) <= new Date(since)) return false;
      if (s.category && s.category !== "All" && m.category !== s.category) return false;
      if (s.min_price != null && (m.price_num ?? 0) < (s.min_price as number)) return false;
      if (s.max_price != null && (m.price_num ?? 0) > (s.max_price as number)) return false;
      // Don't email someone about their own listing.
      return m.seller_id !== s.user_id;
    });

    if (!fresh.length) continue;

    const token = tokenOf(who);
    const { subject, html } = savedSearchEmail({
      siteUrl: siteUrl(),
      unsubscribeUrl: unsubscribeUrl(token, "saved_searches"),
      query: s.q as string,
      matches: fresh.map((m) => ({ id: m.id, name: m.name, price: m.price })),
    });

    try {
      await sendMail({
        to: who.email as string,
        subject,
        html,
        headers: unsubscribeHeaders(unsubscribeUrl(token, "saved_searches")),
      });
    } catch (e) {
      // Not stamped, so the next run tries again with the same window. The old
      // function stamped unconditionally, which is how "sent" and "logged" became
      // indistinguishable.
      console.error("[bechde] saved-search digest failed", s.id, e);
      continue;
    }

    const { error: stampError } = await db
      .from("saved_searches")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", s.id);
    if (stampError) console.error("[bechde] could not stamp saved search", s.id, stampError);
    else notified++;
  }

  return NextResponse.json({ notified });
}
