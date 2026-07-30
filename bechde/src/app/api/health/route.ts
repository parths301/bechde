import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Liveness for an uptime monitor.
 *
 * Deliberately does one cheap read against the database rather than returning a static
 * 200: the interesting failure isn't "Next is down" — Vercel notices that — it's "Next
 * is up and Supabase isn't", which looks perfectly healthy from outside while every
 * screen quietly shows an empty state.
 *
 * Uses the anon client, so a pass also proves RLS is still letting a public read through.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const { error } = await createPublicClient()
      .from("categories")
      .select("name", { count: "exact", head: true });
    if (error) throw new Error(error.message);

    return NextResponse.json(
      { ok: true, db: "up", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "down", error: e instanceof Error ? e.message : "unknown", ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
