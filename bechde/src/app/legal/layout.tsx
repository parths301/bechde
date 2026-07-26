import Link from "next/link";
import { colors } from "@/lib/colors";
import { legalIsDraft, legalUpdated } from "@/lib/legal";

const links = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/prohibited", label: "What's not allowed" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 28px",
          borderBottom: `1px dashed ${colors.divider}`,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "12px 12px 12px 4px",
              background: colors.marigold,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-bricolage)",
              fontWeight: 800,
              fontSize: 17,
              color: colors.marigoldInk,
              transform: "rotate(-6deg)",
            }}
          >
            B
          </div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21, letterSpacing: "-.5px", color: colors.ink }}>
            Bech De<span style={{ color: colors.terracotta }}>.</span>
          </div>
        </Link>
        <nav style={{ display: "flex", gap: 16, marginLeft: "auto", fontSize: 13.5, fontWeight: 700, flexWrap: "wrap" }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ color: colors.textBody }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      {legalIsDraft && (
        <div
          style={{
            background: colors.offerBg,
            borderBottom: `1.5px dashed ${colors.offerBorder}`,
            color: "#6B5320",
            padding: "12px 28px",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.55,
          }}
        >
          ⚠️ Draft — the operator&apos;s legal details are still placeholders. Fill in{" "}
          <code style={{ background: "#fff", borderRadius: 6, padding: "1px 6px" }}>src/lib/legal.ts</code> before
          launch; this banner disappears on its own once every field is filled.
        </div>
      )}

      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "36px 28px 64px",
          fontSize: 15,
          lineHeight: 1.7,
          color: colors.textBody,
        }}
      >
        {children}
        <div style={{ marginTop: 40, paddingTop: 18, borderTop: `1.5px dashed ${colors.divider}`, fontSize: 12.5, color: colors.textFaint, fontWeight: 600 }}>
          Last updated {legalUpdated} ·{" "}
          <Link href="/" style={{ color: colors.clay, fontWeight: 700 }}>
            back to Bech De
          </Link>
        </div>
      </main>
    </div>
  );
}
