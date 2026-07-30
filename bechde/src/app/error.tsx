"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { reportError } from "@/lib/observability";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // `digest` is the id Next puts in the server logs for the same failure, so it's
    // what ties a user saying "reference 3f9a…" to the stack trace.
    reportError(error, { boundary: "route", digest: error.digest });
  }, [error]);

  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 28, background: colors.bg }}>
      <div style={{ textAlign: "center", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 44 }}>🫠</div>
        <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.7px", color: colors.ink }}>
          That didn&apos;t load
        </div>
        <div style={{ fontSize: 14.5, color: colors.textBody, lineHeight: 1.6 }}>
          Something broke on our side, not yours. Try again — if it keeps happening, head back home and give it a minute.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <div
            onClick={() => unstable_retry()}
            style={{ background: colors.ink, color: colors.bg, borderRadius: 999, padding: "11px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </div>
          <Link
            href="/home"
            style={{ background: "#fff", border: `2px solid ${colors.ink}`, color: colors.ink, borderRadius: 999, padding: "9px 22px", fontWeight: 800, fontSize: 14 }}
          >
            Back home
          </Link>
        </div>
        {error.digest && (
          <div style={{ fontSize: 11.5, color: colors.textFaint, fontWeight: 600, marginTop: 4 }}>reference: {error.digest}</div>
        )}
      </div>
    </div>
  );
}
