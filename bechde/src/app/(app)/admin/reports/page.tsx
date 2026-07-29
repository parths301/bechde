"use client";

import Link from "next/link";
import { colors } from "@/lib/colors";
import {
  adminRemoveReview,
  adminSetReportStatus,
  adminUpdateListing,
  reportReasons,
  useReports,
  type Report,
} from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { H1, MiniButton, Pill, card, useReasonPrompt } from "../_shared";

export default function AdminReportsPage() {
  const reports = useReports();
  const [ask, dialog] = useReasonPrompt(() => reports.reload());
  const items = reports.data ?? [];

  const reasonLabel = (reason: string) => reportReasons.find((r) => r.value === reason)?.label ?? reason;
  const open = items.filter((r) => r.status === "open");
  const resolved = items.filter((r) => r.status !== "open");

  return (
    <>
      <H1 sub={`${open.length} open · ${resolved.length} resolved`}>Reports</H1>

      {reports.loading && <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading reports…</div>}

      {!reports.loading && open.length === 0 && (
        <div style={{ ...card, background: colors.sage, border: "none", maxWidth: 520, marginBottom: 30 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🧹</div>
          <div
            style={{
              fontFamily: "var(--font-bricolage)",
              fontWeight: 800,
              fontSize: 19,
              color: colors.pine,
              marginBottom: 6,
            }}
          >
            All clear
          </div>
          <div style={{ fontSize: 13.5, color: colors.pineMuted, lineHeight: 1.6 }}>
            No open reports right now. They&apos;ll show up here when someone flags a listing or a review.
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {open.map((r) => (
            <ReportCard key={r.id} report={r} reasonLabel={reasonLabel} ask={ask} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-bricolage)",
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 14,
              paddingTop: 8,
              borderTop: `2px dashed ${colors.divider}`,
            }}
          >
            Resolved
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resolved.map((r) => (
              <ReportCard key={r.id} report={r} reasonLabel={reasonLabel} ask={ask} resolved />
            ))}
          </div>
        </>
      )}
      {dialog}
    </>
  );
}

function ReportCard({
  report,
  reasonLabel,
  ask,
  resolved,
}: {
  report: Report;
  reasonLabel: (r: string) => string;
  ask: (p: { title: string; detail?: string; confirmLabel?: string; run: (r: string) => Promise<unknown> }) => void;
  resolved?: boolean;
}) {
  const target = report.listingName ?? (report.reviewId ? "A review" : "Deleted content");

  return (
    <div style={{ ...card, opacity: resolved ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <Pill tone="bad">{reasonLabel(report.reason)}</Pill>
        {report.reviewId && <Pill tone="muted">review</Pill>}
        {report.listingStatus === "removed" && <Pill tone="muted">listing withdrawn</Pill>}
        {resolved && <Pill tone={report.status === "actioned" ? "warn" : "muted"}>{report.status}</Pill>}
      </div>

      <div style={{ fontWeight: 800, fontSize: 15 }}>{target}</div>
      <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>
        Reported by {report.reporterName ?? "someone"} · {listedAgo(report.createdAt, "just now")}
        {report.reportedName && <> · about {report.reportedName}</>}
        {resolved && report.resolvedBy && <> · closed by {report.resolvedBy}</>}
      </div>

      {report.reviewBody && (
        <div
          style={{
            fontSize: 13,
            color: colors.textBody,
            lineHeight: 1.55,
            background: colors.bg2,
            borderRadius: 12,
            padding: "10px 14px",
            marginTop: 10,
          }}
        >
          {"★".repeat(report.reviewRating ?? 0)} “{report.reviewBody}”
        </div>
      )}

      {report.details && (
        <div
          style={{
            fontSize: 13,
            color: colors.textBody,
            lineHeight: 1.55,
            background: colors.bg2,
            borderRadius: 12,
            padding: "10px 14px",
            marginTop: 10,
          }}
        >
          “{report.details}”
        </div>
      )}

      {!resolved && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          {report.listingId && report.listingStatus !== "removed" && (
            <MiniButton
              tone="danger"
              onClick={() =>
                ask({
                  title: `Withdraw “${report.listingName}”?`,
                  detail: "The listing stops appearing and the report is marked actioned.",
                  confirmLabel: "Withdraw",
                  run: async (reason) => {
                    await adminUpdateListing(report.listingId!, { status: "removed" }, reason);
                    await adminSetReportStatus(report.id, "actioned", reason);
                  },
                })
              }
            >
              Withdraw listing
            </MiniButton>
          )}

          {report.reviewId && (
            <MiniButton
              tone="danger"
              onClick={() =>
                ask({
                  title: "Remove this review?",
                  detail:
                    "It's deleted rather than hidden, because the seller's ★ average is derived from the reviews that exist — a hidden row would keep counting.",
                  confirmLabel: "Remove",
                  run: async (reason) => {
                    await adminRemoveReview(report.reviewId!, reason);
                    await adminSetReportStatus(report.id, "actioned", reason);
                  },
                })
              }
            >
              Remove review
            </MiniButton>
          )}

          <MiniButton
            onClick={() =>
              ask({
                title: "Dismiss this report?",
                confirmLabel: "Dismiss",
                run: (reason) => adminSetReportStatus(report.id, "reviewed", reason),
              })
            }
          >
            Dismiss
          </MiniButton>

          {report.listingId && (
            <Link
              href={`/product/${report.listingId}`}
              style={{ fontSize: 13, fontWeight: 700, color: colors.clay, textDecoration: "none" }}
            >
              View listing →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
