"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import {
  useIsAdmin,
  useReports,
  updateReportStatus,
  setListingStatus,
  type Report,
} from "@/lib/queries";
import { listedAgo } from "@/lib/time";
import { reportReasons } from "@/lib/queries";
import Button from "@/components/Button";

export default function AdminReportsPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const reports = useReports();
  const items = reports.data ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Non-admin redirect. RLS already prevents data leakage, but the UI should
  // make it obvious you're not supposed to be here.
  const profile = useIsAdmin();
  useEffect(() => {
    // Give useIsAdmin a tick to resolve — don't redirect while still loading.
    if (profile === false && !reports.loading) {
      router.push("/home");
    }
  }, [profile, reports.loading, router]);

  if (!isAdmin) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: "calc(100vh - 76px)", color: colors.textFaint, fontWeight: 700 }}>
        Checking permissions…
      </div>
    );
  }

  const reasonLabel = (reason: string) =>
    reportReasons.find((r) => r.value === reason)?.label ?? reason;

  const withdraw = async (report: Report) => {
    if (!report.listingId || busy) return;
    setBusy(report.id);
    setError(null);
    try {
      await setListingStatus(report.listingId, "removed");
      await updateReportStatus(report.id, "actioned");
      reports.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (report: Report) => {
    if (busy) return;
    setBusy(report.id);
    setError(null);
    try {
      await updateReportStatus(report.id, "reviewed");
      reports.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const open = items.filter((r) => r.status === "open");
  const resolved = items.filter((r) => r.status !== "open");

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%", padding: "34px 36px 44px" }}>
      <h1
        style={{
          margin: "0 0 6px",
          fontFamily: "var(--font-bricolage)",
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: "-.7px",
        }}
      >
        Reports 🛡️
      </h1>
      <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginBottom: 24 }}>
        {open.length} open · {resolved.length} resolved
      </div>

      {error && (
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.terracotta, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {reports.loading && (
        <div style={{ color: colors.textFaint, fontWeight: 700 }}>Loading reports…</div>
      )}

      {!reports.loading && open.length === 0 && (
        <div
          style={{
            background: colors.sage,
            borderRadius: 18,
            padding: "28px 26px",
            maxWidth: 520,
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 8 }}>🧹</div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 19, color: colors.pine, marginBottom: 6 }}>
            All clear
          </div>
          <div style={{ fontSize: 13.5, color: colors.pineMuted, lineHeight: 1.6 }}>
            No open reports right now. They&apos;ll show up here when someone flags a listing.
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {open.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              reasonLabel={reasonLabel}
              onWithdraw={() => withdraw(report)}
              onDismiss={() => dismiss(report)}
              busy={busy === report.id}
            />
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
            {resolved.map((report) => (
              <ReportCard key={report.id} report={report} reasonLabel={reasonLabel} resolved />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReportCard({
  report,
  reasonLabel,
  onWithdraw,
  onDismiss,
  busy,
  resolved,
}: {
  report: Report;
  reasonLabel: (r: string) => string;
  onWithdraw?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
  resolved?: boolean;
}) {
  const age = listedAgo(report.createdAt, "just now");
  const statusBg = report.status === "actioned" ? colors.terracotta : colors.textFaint;

  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${colors.cardBorder}`,
        borderRadius: 18,
        padding: "18px 22px",
        opacity: resolved ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span
              style={{
                background: colors.terracotta,
                color: "#fff",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {reasonLabel(report.reason)}
            </span>
            {report.listingStatus === "removed" && (
              <span
                style={{
                  background: colors.textFaint,
                  color: "#fff",
                  borderRadius: 999,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                listing withdrawn
              </span>
            )}
            {resolved && (
              <span
                style={{
                  background: statusBg,
                  color: "#fff",
                  borderRadius: 999,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {report.status}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {report.listingName ?? "Deleted listing"}
          </div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 600 }}>
            Reported by {report.reporterName ?? "someone"} · {age}
            {report.reportedName && <> · seller: {report.reportedName}</>}
          </div>
        </div>
      </div>

      {report.details && (
        <div
          style={{
            fontSize: 13,
            color: colors.textBody,
            lineHeight: 1.55,
            background: colors.bg2,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
          }}
        >
          &ldquo;{report.details}&rdquo;
        </div>
      )}

      {!resolved && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {report.listingId && report.listingStatus !== "removed" && (
            <Button
              onClick={onWithdraw}
              style={{ padding: "9px 18px", fontSize: 13, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Withdrawing…" : "Withdraw listing"}
            </Button>
          )}
          <Button
            onClick={onDismiss}
            variant="secondary"
            style={{ padding: "9px 18px", fontSize: 13, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "…" : "Dismiss"}
          </Button>
          {report.listingId && (
            <Link
              href={`/product/${report.listingId}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.clay,
                textDecoration: "none",
              }}
            >
              View listing →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
