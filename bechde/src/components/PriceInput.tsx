"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";

/**
 * A ₹ bound for the price filter. Keeps a local draft while typing and commits the
 * parsed number on blur/Enter, so filtering doesn't re-run on every keystroke.
 */
export default function PriceInput({
  placeholder,
  value,
  onCommit,
}: {
  placeholder: string;
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : String(value));

  const commit = () => {
    const digits = shown.replace(/[^\d]/g, "");
    setDraft(null);
    onCommit(digits ? Number(digits) : null);
  };

  return (
    <input
      inputMode="numeric"
      value={shown}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      style={{
        flex: 1,
        minWidth: 0,
        background: "#fff",
        border: `1.5px solid ${colors.sand}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 700,
        color: colors.ink,
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}
