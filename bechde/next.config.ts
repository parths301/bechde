import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The app holds a Supabase session in a cookie, so being framable is a clickjacking
 * risk: an invisible overlay over "Withdraw listing" or "Close my account" is enough.
 *
 * The CSP ships in **report-only** deliberately. Every screen in this codebase is
 * styled with inline `style={{…}}`, and Next injects inline bootstrap scripts besides,
 * so a blocking policy would need `'unsafe-inline'` on both script-src and style-src
 * to avoid breaking the app — at which point it protects against very little. Turning
 * it on blind would either break pages or be theatre. Report-only collects the real
 * violations first; tighten from evidence, not from a guess.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is the whole product, so allow it — for us, and for nobody embedding us.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  // Vercel terminates TLS. No `preload` until the domain is settled — it's hard to undo.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Supabase Storage for photos, OSM for map tiles, data:/blob: for generated
      // icons and the sell form's local previews.
      "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org http://127.0.0.1:54321",
      "font-src 'self' data:",
      // PostgREST and Realtime (wss), plus the local stack in development.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
