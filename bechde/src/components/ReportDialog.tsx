"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { reportListing, reportReasons, type ReportReason } from "@/lib/queries";

/**
 * In-page report sheet. Deliberately not a browser confirm()/alert() — those block
 * the page and can't carry a reason or the prohibited-items link.
 */
export default function ReportDialog({
  listingId,
  sellerId,
  listingName,
  onClose,
}: {
  listingId: string;
  sellerId?: string;
  listingName: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes it, focus moves in on open and is kept inside while it's up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!reason || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      await reportListing(listingId, sellerId, reason, details);
      setState("sent");
    } catch (e: unknown) {
      setState("idle");
      setError(e instanceof Error ? e.message : "Couldn't send that report.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(60,45,20,.34)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Report ${listingName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 22,
          padding: "24px 26px",
          width: "min(460px, 100%)",
          maxHeight: "86vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(60,45,20,.28)",
        }}
      >
        {state === "sent" ? (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 34 }}>🛡️</div>
            <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21 }}>Thanks — report sent</div>
            <div style={{ fontSize: 13.5, color: colors.textBody, lineHeight: 1.6 }}>
              We&apos;ve logged it against this listing. If it breaks the rules it comes down. You can also block this
              seller so you stop seeing their listings.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ marginTop: 6, background: colors.ink, color: colors.bg, border: "none", borderRadius: 999, padding: "10px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer", font: "inherit", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 21, letterSpacing: "-.5px" }}>Report this listing</div>
                <div style={{ fontSize: 13, color: colors.textFaint, fontWeight: 600, marginTop: 2 }}>{listingName}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report dialog"
                style={{ fontSize: 20, color: colors.textFaint, cursor: "pointer", lineHeight: 1, background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0 14px" }}>
              {reportReasons.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  aria-pressed={reason === r.value}
                  style={{
                    fontFamily: "inherit",
                    background: reason === r.value ? colors.ink : "#fff",
                    color: reason === r.value ? colors.bg : colors.textBody,
                    border: `1.5px solid ${reason === r.value ? colors.ink : colors.sand}`,
                    borderRadius: 999,
                    padding: "8px 15px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Anything else we should know? (optional)"
              style={{
                width: "100%",
                background: "#fff",
                border: `1.5px solid ${colors.sand}`,
                borderRadius: 14,
                padding: "13px 16px",
                fontSize: 14,
                lineHeight: 1.55,
                color: colors.textDark,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            <div style={{ fontSize: 12, color: colors.textFaint, fontWeight: 600, margin: "10px 0 16px", lineHeight: 1.5 }}>
              Not sure? See what&apos;s{" "}
              <Link href="/legal/prohibited" style={{ color: colors.clay, fontWeight: 700 }}>
                not allowed on Bech De
              </Link>
              .
            </div>

            {error && <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.terracotta, marginBottom: 10 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "#fff", border: `1.5px solid ${colors.sand}`, borderRadius: 999, padding: "10px 20px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!reason}
                style={{
                  fontFamily: "inherit",
                  border: "none",
                  background: reason ? colors.terracotta : colors.sand,
                  color: "#fff",
                  borderRadius: 999,
                  padding: "10px 22px",
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: reason ? "pointer" : "not-allowed",
                }}
              >
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
