import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Close the signed-in account. POST, no body.
 *
 * The security property is one line: **the id comes from the session cookie, never
 * from the request.** There is no parameter to tamper with, so this route cannot be
 * pointed at somebody else's account no matter what is posted to it. There's a test
 * for exactly that in supabase/tests/account.test.ts.
 *
 * The service-role client appears here, which README §3.4 otherwise forbids — deleting an
 * auth user is a privileged operation with no RLS equivalent. It is used for that one
 * call, on an id the anon client already proved belongs to the caller. The data side
 * of the erasure happens first, in close_my_account(), under the caller's own rights.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // Anonymise under the caller's own permissions. If this fails, nothing is deleted.
  const { error: rpcError } = await supabase.rpc("close_my_account");
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const { error: authError } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (authError) {
    // The profile is already anonymised, so the account is effectively closed even if
    // the auth row lingers. Say so rather than implying nothing happened.
    return NextResponse.json(
      { closed: true, warning: `profile erased, sign-in record not removed: ${authError.message}` },
      { status: 200 }
    );
  }

  await supabase.auth.signOut();
  return NextResponse.json({ closed: true });
}
