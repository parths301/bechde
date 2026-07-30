import Link from "next/link";
import { colors } from "@/lib/colors";

/**
 * The 404. Without this file `notFound()` in ProductClient rendered Next's default
 * black-and-white page — which is where a stale WhatsApp link to a sold listing lands,
 * so it's a page real buyers see rather than an edge case.
 */
export const metadata = { title: "Not here · Bech De" };

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: colors.bg,
        color: colors.ink,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420, minWidth: 0 }}>
        <div
          style={{
            width: 84,
            height: 84,
            margin: "0 auto 18px",
            borderRadius: "26px 26px 26px 8px",
            background: colors.marigold,
            display: "grid",
            placeItems: "center",
            fontSize: 38,
            transform: "rotate(-6deg)",
          }}
        >
          🧭
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-bricolage)",
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: "-.8px",
          }}
        >
          Nothing here
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14.5, lineHeight: 1.6, color: colors.textBody, fontWeight: 600 }}>
          This page doesn&apos;t exist, or the listing behind it was sold or withdrawn. Both happen fast around
          here.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/home"
            style={{
              background: colors.ink,
              color: colors.bg,
              borderRadius: 999,
              padding: "13px 24px",
              fontWeight: 800,
              fontSize: 14.5,
              textDecoration: "none",
            }}
          >
            Back to the radar
          </Link>
          <Link
            href="/search"
            style={{
              background: "#fff",
              color: colors.ink,
              border: `2px solid ${colors.ink}`,
              borderRadius: 999,
              padding: "11px 22px",
              fontWeight: 800,
              fontSize: 14.5,
              textDecoration: "none",
            }}
          >
            Search instead
          </Link>
        </div>
      </div>
    </div>
  );
}
