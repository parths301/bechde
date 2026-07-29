"use client";

import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAdminStats, useAuditLog } from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { H1, card } from "./_shared";

export default function AdminOverviewPage() {
  const stats = useAdminStats();
  const audit = useAuditLog();
  const recent = (audit.data ?? []).slice(0, 8);
  const s = stats.data;

  return (
    <>
      <H1 sub="Everything you change here is recorded, with your name on it.">Console 🛡️</H1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}
      >
        <Stat label="Open reports" value={s?.openReports} href="/admin/reports" urgent={!!s?.openReports} />
        <Stat label="Listed today" value={s?.listingsToday} />
        <Stat label="Active listings" value={s?.activeListings} />
        <Stat label="Suspended people" value={s?.suspended} href="/admin/users" urgent={!!s?.suspended} />
        <Stat label="New this week" value={s?.newProfilesWeek} />
      </div>

      <div
        style={{
          fontFamily: "var(--font-bricolage)",
          fontWeight: 800,
          fontSize: 18,
          marginBottom: 12,
        }}
      >
        Last few actions
      </div>

      {audit.loading && <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading…</div>}

      {!audit.loading && recent.length === 0 && (
        <div style={{ ...card, background: colors.sage, border: "none", maxWidth: 560 }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>📋</div>
          <div style={{ fontWeight: 800, color: colors.pine, marginBottom: 4 }}>Nothing logged yet</div>
          <div style={{ fontSize: 13.5, color: colors.pineMuted, lineHeight: 1.6 }}>
            Every edit, suspension and dismissal an admin makes shows up here with the reason they gave.
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((e) => (
            <div
              key={e.id}
              style={{
                ...card,
                padding: "12px 18px",
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 13.5 }}>{e.action}</span>
              <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600, flex: 1, minWidth: 0 }}>
                “{e.reason}”
              </span>
              <span style={{ fontSize: 12, color: colors.textFaint, fontWeight: 700, whiteSpace: "nowrap" }}>
                {e.actorName ?? "someone"} · {listedAgo(e.createdAt, "just now")}
              </span>
            </div>
          ))}
          <Link
            href="/admin/audit"
            style={{ fontSize: 13, fontWeight: 800, color: colors.clay, textDecoration: "none", marginTop: 4 }}
          >
            Full audit log →
          </Link>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  href,
  urgent,
}: {
  label: string;
  value: number | undefined;
  href?: string;
  urgent?: boolean;
}) {
  const body = (
    <div
      style={{
        ...card,
        borderColor: urgent ? colors.offerBorder : colors.cardBorder,
        background: urgent ? colors.offerBg : "#fff",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-bricolage)",
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: "-1px",
          color: urgent ? colors.offerText : colors.ink,
        }}
      >
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textMuted }}>{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {body}
    </Link>
  ) : (
    body
  );
}
