"use client"; // Error boundaries must be Client Components

import { useEffect, useSyncExternalStore } from "react";
import { reportError } from "@/lib/observability";
import { readLang, type Language } from "@/lib/i18n/config";
import { resolve } from "@/lib/i18n/resolve";

// Nothing changes the language while the fallback is on screen, so the subscription is
// a no-op. useSyncExternalStore is still the right primitive: it gives React a separate
// server snapshot, so reading localStorage can't desync hydration.
const noSubscribe = () => () => {};

// Last-resort boundary: this replaces the root layout, so it brings its own
// <html>/<body> and can't rely on the app's fonts or global styles.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Replacing the root layout also removes the LanguageProvider, so `useTranslation`
  // would throw — inside an error boundary, which would take the fallback down with
  // the page. Read localStorage directly instead.
  const lang = useSyncExternalStore<Language>(noSubscribe, readLang, () => "en");
  const t = (key: string, vars?: Record<string, string | number>) => resolve(lang, key, vars);

  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang={lang}>
      <body style={{ margin: 0, background: "#FBF6ED", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2E2A24" }}>
        <title>{t("errorPage.globalDocTitle")}</title>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🫠</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 8px" }}>{t("errorPage.globalTitle")}</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5C5347", margin: "0 0 18px" }}>{t("errorPage.globalBody")}</p>
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
              {t("errorPage.reload")}
            </button>
            {error.digest && (
              <div style={{ fontSize: 11.5, color: "#8C8271", marginTop: 14 }}>{t("errorPage.reference", { digest: error.digest })}</div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
