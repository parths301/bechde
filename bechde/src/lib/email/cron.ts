import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Shared gate for the scheduled routes.
 *
 * These run on Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. Without
 * a check anyone could hit the URL and make us mail every user repeatedly — the send
 * stamps limit the damage, but only after the first flood.
 */
export function denyIfNotCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed. An unset secret must not mean "let everyone in".
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not authorised" }, { status: 401 });
  }
  return null;
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

export function unsubscribeUrl(token: string, kind: "messages" | "saved_searches"): string {
  return `${siteUrl()}/unsubscribe?t=${token}&k=${kind}`;
}

/** One-click unsubscribe, as every bulk sender is expected to support. */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * The unsubscribe token, read through the embedded notification_tokens row. It lives
 * off profiles on purpose (see 0020) — profiles is world-readable and this is a
 * credential — so it arrives as a joined relation rather than a column.
 */
export function tokenOf(person: { notification_tokens?: { token: string } | { token: string }[] | null }): string {
  const rel = person.notification_tokens;
  const token = Array.isArray(rel) ? rel[0]?.token : rel?.token;
  if (!token) throw new Error("no unsubscribe token for this profile — 0020's trigger should guarantee one");
  return token;
}
