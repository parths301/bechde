import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Handles both shapes an emailed link can arrive in:
 *
 *  ?code=…        PKCE. What the app actually produces, because @supabase/ssr's
 *                 browser client forces the PKCE flow. GoTrue verified the token
 *                 already and bounced back here with an auth code, which we swap
 *                 for a session using the verifier cookie set when the link was
 *                 requested. Same browser only, by design of PKCE.
 *
 *  ?token_hash=…  The stateless form, kept for links minted by a non-PKCE client
 *                 (scripts, tests) and for older emails still in someone's inbox.
 *
 * Either way the session cookie is written before we redirect into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/home";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(new URL("/?error=link", request.url));
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/?error=link", request.url));
}
