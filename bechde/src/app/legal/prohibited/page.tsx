import type { Metadata } from "next";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { operator, prohibitedItems } from "@/lib/legal";

export const metadata: Metadata = {
  title: "What's not allowed — Bech De",
  description: "Things you can't list on Bech De, and what happens if you do.",
};

export default function ProhibitedPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 34, letterSpacing: "-1px", color: colors.ink, margin: "0 0 8px" }}>
        What&apos;s not allowed
      </h1>
      <p style={{ marginTop: 0 }}>
        Bech De is for second-hand things that are legal to own and legal to sell. The list below isn&apos;t exhaustive —
        if it&apos;s illegal offline, it&apos;s not allowed here either.
      </p>

      <div style={{ display: "grid", gap: 12, margin: "28px 0" }}>
        {prohibitedItems.map((p) => (
          <div
            key={p.title}
            style={{
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 16,
              padding: "14px 18px",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15, color: colors.ink }}>{p.title}</div>
            <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 2 }}>{p.examples}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21, letterSpacing: "-.4px", color: colors.ink, margin: "34px 0 10px" }}>
        If you see something
      </h2>
      <p>
        Every listing has a <b>⚑ Report listing</b> button — pick a reason and send it. You can also block a seller,
        which hides their listings from you and stops them messaging you. Reports are reviewed by a person; listings that
        break these rules come down and repeat offenders lose their accounts.
      </p>
      <p>
        For anything urgent or unlawful, write to <b>{operator.grievanceEmail}</b>. Read the{" "}
        <Link href="/legal/terms" style={{ color: colors.clay, fontWeight: 700 }}>
          Terms of Use
        </Link>{" "}
        for the full rules.
      </p>
    </div>
  );
}
