"use client";

import { CSSProperties, useState } from "react";
import { colors } from "@/lib/colors";

interface ChipProps {
  icon: string;
  name: string;
  active?: boolean;
  onClick?: () => void;
  lift?: boolean;
}

// Category chip used on home, map filter rail, and sell flow.
export default function Chip({ icon, name, active, onClick, lift = true }: ChipProps) {
  const [hover, setHover] = useState(false);
  const activeStyle: CSSProperties = active
    ? { background: colors.ink, borderColor: colors.ink, color: colors.bg }
    : { background: "#fff", borderColor: colors.sand, color: colors.textDark };
  return (
    <button
      type="button"
      onClick={onClick}
      // Filter chips are toggles — screen readers should say which one is on.
      aria-pressed={active ?? undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: "1.5px solid",
        borderRadius: 999,
        padding: "9px 16px",
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...activeStyle,
        ...(hover && lift ? { transform: "translateY(-2px)" } : null),
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {name}
    </button>
  );
}
