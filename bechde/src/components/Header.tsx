"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";

export default function Header() {
  const pathname = usePathname();
  const { name } = useAppState();
  const avatarInitial = (name || "A").trim().charAt(0).toUpperCase() || "A";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "16px 36px",
        borderBottom: `1px dashed ${colors.divider}`,
        background: colors.bg,
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <Link href="/home" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "12px 12px 12px 4px",
            background: colors.marigold,
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-bricolage)",
            fontWeight: 800,
            fontSize: 19,
            color: colors.marigoldInk,
            transform: "rotate(-6deg)",
          }}
        >
          B
        </div>
        <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 24, letterSpacing: "-.5px", color: colors.ink }}>
          Bech De<span style={{ color: colors.terracotta }}>.</span>
        </div>
      </Link>

      <SearchBar />

      <nav style={{ display: "flex", alignItems: "center", gap: 18, fontWeight: 700, fontSize: 14.5 }}>
        <NavLink href="/map" active={pathname === "/map"}>
          🗺️ Map
        </NavLink>
        <NavLink href="/chat" active={pathname === "/chat"}>
          <span style={{ position: "relative" }}>
            Chats
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -13,
                background: colors.terracotta,
                color: "#fff",
                fontSize: 9.5,
                fontWeight: 800,
                borderRadius: 999,
                padding: "1px 6px",
              }}
            >
              2
            </span>
          </span>
        </NavLink>
        <SellButton />
        <Link href="/profile" style={{ display: "block" }}>
          <Avatar initial={avatarInitial} />
        </Link>
      </nav>
    </header>
  );
}

function SearchBar() {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#fff",
        border: `1.5px solid ${hover ? colors.marigold : colors.sand}`,
        borderRadius: 999,
        padding: "10px 20px",
        color: colors.textFaint,
        fontSize: 14.5,
        cursor: "text",
      }}
    >
      ⌕ Search &quot;study table&quot;, &quot;iPhone 12&quot;, &quot;kurta&quot;…
      <span
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: colors.bg2,
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 12.5,
          color: colors.textBody,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        📍 Koramangala ▾
      </span>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: "pointer", color: active || hover ? colors.clay : colors.textBody }}
    >
      {children}
    </Link>
  );
}

function SellButton() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/sell"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? colors.terracotta : colors.ink,
        color: colors.bg,
        borderRadius: 999,
        padding: "11px 22px",
        fontWeight: 700,
        cursor: "pointer",
        transform: hover ? "rotate(-2deg)" : undefined,
        display: "inline-block",
      }}
    >
      + Bech de!
    </Link>
  );
}

function Avatar({ initial }: { initial: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: colors.teal,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontFamily: "var(--font-bricolage)",
        fontWeight: 800,
        fontSize: 15,
        border: "2px solid #fff",
        boxShadow: `0 0 0 1.5px ${colors.sand}`,
        cursor: "pointer",
        transform: hover ? "scale(1.08)" : undefined,
      }}
    >
      {initial}
    </div>
  );
}
