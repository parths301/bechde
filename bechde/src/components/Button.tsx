"use client";

import { CSSProperties, ReactNode, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";

type Variant = "primary" | "secondary" | "accent";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: Variant;
  rotate?: number;
  flex?: boolean;
  style?: CSSProperties;
}

const base: Record<Variant, CSSProperties> = {
  primary: { background: colors.ink, color: colors.bg, border: "none" },
  secondary: { background: "#fff", color: colors.ink, border: `2px solid ${colors.ink}` },
  accent: { background: colors.marigold, color: colors.marigoldInk, border: "none" },
};

const hoverStyles: Record<Variant, CSSProperties> = {
  primary: { background: colors.terracotta },
  secondary: { borderColor: colors.terracotta, color: colors.clay },
  accent: { background: colors.terracotta, color: "#fff" },
};

export default function Button({ children, onClick, href, variant = "primary", rotate, flex, style }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const styleFinal: CSSProperties = {
    ...base[variant],
    textAlign: "center",
    borderRadius: 999,
    padding: variant === "secondary" ? "13px 24px" : "15px 26px",
    fontWeight: 800,
    fontSize: 15.5,
    cursor: "pointer",
    display: "inline-block",
    flex: flex ? 1 : undefined,
    ...style,
    ...(hover ? { ...hoverStyles[variant], ...(rotate ? { transform: `rotate(${rotate}deg)` } : null) } : null),
  };
  const handlers = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };

  if (href) {
    return (
      <Link href={href} style={styleFinal} {...handlers}>
        {children}
      </Link>
    );
  }
  // A real <button>: keyboard-operable and announced as a button, without changing
  // how it looks (the browser's own button styling is reset inline).
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styleFinal, font: "inherit", fontWeight: styleFinal.fontWeight, appearance: "none" }}
      {...handlers}
    >
      {children}
    </button>
  );
}
