import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Redeem the 6-digit code from the sign-in email.
 *
 * This exists because the magic link alone can't work for most of the people this app
 * is built for. `@supabase/ssr`'s createBrowserClient hard-codes `flowType: "pkce"`,
 * which cannot be overridden, so the emailed link is only redeemable by the browser
 * that requested it. On a phone that means: request the link in Chrome, tap it in the
 * Gmail app, land in an in-app webview with no code verifier, and sign-in fails with
 * nothing obviously wrong. That's the front door, and India is phone-first.
 *
 * The fix is to redeem **server-side**. This route uses the cookie-bound server client,
 * which isn't PKCE-locked, so `verifyOtp` accepts the plain 6-digit token from any
 * browser — and the session lands in exactly the same cookies /auth/confirm writes.
 *
 * The link still works, and is still the nicer path on a laptop. This is the one that
 * survives crossing devices.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const token = body.token?.replace(/\s/g, "");

  if (!email || !token) {
    return NextResponse.json({ error: "email and code are both needed" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "that code should be six digits" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    // GoTrue distinguishes wrong from expired; both read the same to a person retyping
    // a code, so keep the message plain and don't leak whether the address exists.
    return NextResponse.json({ error: "That code didn't work. It may have expired — send a new one." }, { status: 400 });
  }

  return NextResponse.json({ signedIn: true });
}
