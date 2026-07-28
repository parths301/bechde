import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server Supabase client bound to the request cookies (anon key + user session).
 * Use in Server Components, Route Handlers, and Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore when middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Anonymous server client — anon key, no session attached, so it sees exactly what a
 * logged-out visitor (or a link scraper) sees. Use for public server rendering like
 * OG metadata and the sitemap: unlike createClient() it doesn't read cookies, so the
 * response stays cacheable, and unlike createAdminClient() it doesn't bypass RLS.
 */
export function createPublicClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Admin client (service-role key) — bypasses RLS. Server-only, never expose.
 * Used by the seed script and privileged server routes.
 */
export function createAdminClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
