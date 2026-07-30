"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

// Last-resort boundary: this replaces the root layout, so it brings its own
// <html>/<body> and can't rely on the app's fonts or global styles.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FBF6ED", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2E2A24" }}>
        <title>Something went wrong · Bech De</title>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🫠</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 8px" }}>Bech De had a moment</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5C5347", margin: "0 0 18px" }}>
              Something broke badly enough to take the whole page down. Reloading usually fixes it.
            </p>
            <button
              onClick={() => unstable_retry()}
              style={{
                background: "#2E2A24",
                color: "#FBF6ED",
                border: "none",
                borderRadius: 999,
                padding: "12px 26px",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Reload
            </button>
            {error.digest && <div style={{ fontSize: 11.5, color: "#8C8271", marginTop: 14 }}>reference: {error.digest}</div>}
          </div>
        </div>
      </body>
    </html>
  );
}
