import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed `middleware` → `proxy`. Runs before every matched request:
// refreshes the Supabase session cookie and gates the app behind auth.
const PROTECTED = ["/home", "/map", "/chat", "/profile", "/sell", "/product", "/search", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // IMPORTANT: getUser() revalidates the token and triggers cookie refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (user && path === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  // Run on everything except Next internals, the auth callback, and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/).*)"],
};
