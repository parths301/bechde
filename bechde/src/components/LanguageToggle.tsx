"use client";

import { CSSProperties } from "react";
import { colors } from "@/lib/colors";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * EN | हिन्दी.
 *
 * Extracted from the header because `/login` sits outside the app layout and therefore
 * had no header — which meant the one screen every new user sees first was the one
 * screen where you couldn't choose a language. A Hindi speaker had to sign in *in
 * English* before discovering the app spoke Hindi at all.
 *
 * The labels stay in their own scripts on purpose: someone who can't read the current
 * language still has to be able to find the switch.
 */
export default function LanguageToggle({ style }: { style?: CSSProperties }) {
  const { lang, setLang, t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      aria-label={t("nav.toggleLanguage")}
      style={{
        background: colors.bg2,
        border: `1px solid ${colors.sand}`,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
        color: colors.ink,
        display: "flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
    >
      {/* Dimmed with a real colour, not opacity. `opacity: 0.4` on ink over cream
          computes to 2.25:1 — axe flags it, and 12px bold at that contrast genuinely
          isn't readable. textMuted is the token that was already darkened to clear AA. */}
      <span style={{ color: lang === "en" ? colors.ink : colors.textMuted }}>EN</span>
      <span aria-hidden="true" style={{ color: colors.textMuted }}>|</span>
      <span style={{ color: lang === "hi" ? colors.ink : colors.textMuted }}>हिन्दी</span>
    </button>
  );
}
