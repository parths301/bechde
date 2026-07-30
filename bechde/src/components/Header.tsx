"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { colors } from "@/lib/colors";
import { useProfile, useUnreadCount } from "@/lib/queries";
import { DEFAULT_FILTERS, searchHref } from "@/lib/search";
import LocationChip from "./LocationChip";

import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function Header() {
  const pathname = usePathname();
  const profile = useProfile().data;
  const profileName = profile?.name;
  const unread = useUnreadCount();
  const { lang, setLang, t } = useTranslation();
  const avatarInitial = (profileName || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <header
      className="bd-header"
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

      <div className="bd-search-wrap" style={{ flex: 1, display: "flex" }}>
        <SearchBar />
      </div>

      <nav style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: 700, fontSize: 14.5 }}>
        <div className="bd-desktop-nav" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The only location control on desktop. It used to sit inside the search
              bar as well, so /home showed two of them. */}
          <LocationChip style={{ maxWidth: 190 }} />
          <NavLink href="/map" active={pathname === "/map"}>
            🗺️ {t("nav_map")}
          </NavLink>
          <NavLink href="/chat" active={pathname === "/chat"}>
            <span style={{ position: "relative" }}>
              {t("nav_chat")}
              {unread > 0 && (
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
                  {unread}
                </span>
              )}
            </span>
          </NavLink>
          {/* Read from the profile rather than an extra RPC. RLS refuses the data to
              everyone else regardless — this only avoids offering a link into a
              "Checking permissions…" dead end. */}
          {profile?.is_admin && (
            <NavLink href="/admin" active={pathname.startsWith("/admin")}>
              🛡️ Console
            </NavLink>
          )}
          <SellButton />
        </div>

        {/* Language Toggle Button */}
        <button
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          aria-label="Toggle language"
          style={{
            background: colors.bg2,
            border: `1px solid ${colors.sand}`,
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            color: colors.ink,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ opacity: lang === "en" ? 1 : 0.4 }}>EN</span>
          <span>|</span>
          <span style={{ opacity: lang === "hi" ? 1 : 0.4 }}>हिन्दी</span>
        </button>

        {profileName ? (
          <Link href="/profile" className="bd-header-avatar" style={{ display: "block" }}>
            <Avatar initial={avatarInitial} />
          </Link>
        ) : (
          <Link
            href="/login"
            style={{
              background: colors.marigold,
              color: colors.marigoldInk,
              borderRadius: 999,
              padding: "6px 14px",
              fontWeight: 800,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

export function SearchBar({ autoFocus }: { autoFocus?: boolean } = {}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const [q, setQ] = useState("");

  const submit = () => router.push(searchHref({ ...DEFAULT_FILTERS, q }));

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        // Flex items default to min-width: auto and won't shrink past their content,
        // which is what once pushed /home wider than the phone. See README.md §4.
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#fff",
        border: `1.5px solid ${hover ? colors.marigold : colors.sand}`,
        borderRadius: 999,
        padding: "10px 20px",
        color: colors.textFaint,
        fontSize: 14.5,
      }}
    >
      <button
        type="button"
        onClick={submit}
        aria-label="Search"
        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", color: "inherit" }}
      >
        ⌕
      </button>
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder='Search "study table", "iPhone 12", "kurta"…'
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14.5,
          fontFamily: "inherit",
          color: colors.ink,
        }}
      />
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
