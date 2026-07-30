import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMail, emailConfigured } from "@/lib/email/send";
import { newMessagesEmail } from "@/lib/email/templates";
import { denyIfNotCron, siteUrl, unsubscribeUrl, unsubscribeHeaders, tokenOf } from "@/lib/email/cron";

/**
 * "Someone messaged you." The retention loop the app didn't have — a seller who closed
 * the tab had no way to learn a buyer had replied.
 *
 * Only messages older than QUIET_MINUTES are considered, so an active back-and-forth
 * generates no email at all: the point is to reach someone who *isn't* looking.
 *
 * Service role, deliberately. This reads across every user's chats to decide who to
 * notify, which is precisely the work RLS is designed to prevent a browser from doing.
 * It never returns any of it — the only output is a count.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUIET_MINUTES = 5;
const LOOKBACK_HOURS = 24;

export async function GET(request: NextRequest) {
  const denied = denyIfNotCron(request);
  if (denied) return denied;

  // Fail loudly rather than stamping rows as notified without sending — that exact
  // silent success is what this whole change exists to undo (README §4).
  if (!emailConfigured) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set; no mail was sent" }, { status: 503 });
  }

  const db = createAdminClient();
  const now = Date.now();
  const cutoff = new Date(now - QUIET_MINUTES * 60_000).toISOString();
  const floor = new Date(now - LOOKBACK_HOURS * 3_600_000).toISOString();

  const { data: pending, error } = await db
    .from("messages")
    .select("id, body, created_at, sender_id, chat_id, chats(id, buyer_id, seller_id, listings(name))")
    .is("notified_at", null)
    .lt("created_at", cutoff)
    .gt("created_at", floor)
    .order("created_at")
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ notified: 0, messages: 0 });

  type Row = {
    id: string;
    body: string;
    created_at: string;
    sender_id: string;
    chat_id: string;
    chats: { id: string; buyer_id: string; seller_id: string; listings: { name: string } | null } | null;
  };

  // Group by recipient: five messages should be one email, not five.
  const byRecipient = new Map<string, Row[]>();
  for (const m of pending as unknown as Row[]) {
    const chat = m.chats;
    if (!chat) continue;
    const recipient = chat.buyer_id === m.sender_id ? chat.seller_id : chat.buyer_id;
    if (recipient === m.sender_id) continue;
    const list = byRecipient.get(recipient) ?? [];
    list.push(m);
    byRecipient.set(recipient, list);
  }

  const ids = [...byRecipient.keys()];
  const { data: people } = await db
    .from("profiles")
    .select("id, email, notify_messages, closed_at, notification_tokens(token)")
    .in("id", ids);

  const senderIds = [...new Set((pending as unknown as Row[]).map((m) => m.sender_id))];
  const { data: senders } = await db.from("profiles").select("id, name").in("id", senderIds);
  const nameOf = new Map((senders ?? []).map((s) => [s.id as string, s.name as string]));

  const sentFor: string[] = [];
  let notified = 0;

  for (const person of people ?? []) {
    const rows = byRecipient.get(person.id as string) ?? [];
    const messageIds = rows.map((r) => r.id);

    // Unsubscribed, closed, or no address: stamp anyway. Leaving them unstamped would
    // re-consider the same rows on every run, forever.
    if (!person.email || !person.notify_messages || person.closed_at) {
      sentFor.push(...messageIds);
      continue;
    }

    const { subject, html } = newMessagesEmail({
      siteUrl: siteUrl(),
      unsubscribeUrl: unsubscribeUrl(tokenOf(person), "messages"),
      threads: rows.map((r) => ({
        listing: r.chats?.listings?.name ?? "a listing",
        from: nameOf.get(r.sender_id) ?? "Someone",
        preview: r.body.length > 120 ? `${r.body.slice(0, 120)}…` : r.body,
        chatId: r.chat_id,
      })),
    });

    try {
      await sendMail({
        to: person.email as string,
        subject,
        html,
        headers: unsubscribeHeaders(unsubscribeUrl(tokenOf(person), "messages")),
      });
      sentFor.push(...messageIds);
      notified++;
    } catch (e) {
      // Deliberately not stamped: an unsent message must stay pending so the next run
      // retries it. One person's bounced address shouldn't stop everyone else's mail.
      console.error("[bechde] message digest failed", person.id, e);
    }
  }

  if (sentFor.length) {
    const { error: stampError } = await db
      .from("messages")
      .update({ notified_at: new Date().toISOString() })
      .in("id", sentFor);
    if (stampError) return NextResponse.json({ error: stampError.message }, { status: 500 });
  }

  return NextResponse.json({ notified, messages: sentFor.length });
}
