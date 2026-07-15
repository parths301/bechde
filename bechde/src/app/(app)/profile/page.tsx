"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState, ProfileTab } from "@/lib/store";
import { getItem } from "@/lib/data";
import Stripe from "@/components/Stripe";

interface GridCard {
  id?: string;
  name: string;
  price: string;
  meta: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  angle: string;
}

export default function ProfilePage() {
  const { name, profTab, setProfTab, isLiked } = useAppState();
  const avatarInitial = (name || "A").trim().charAt(0).toUpperCase() || "A";
  const guitarLiked = isLiked("yamaha-f310");

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: "listings", label: "My listings · 2" },
    { key: "sold", label: "Sold · 1" },
    { key: "saved", label: "Saved ♡ · " + (guitarLiked ? 2 : 1) },
    { key: "reviews", label: "Reviews · 1" },
  ];

  const grids: Record<ProfileTab, GridCard[]> = {
    listings: [
      { id: "yamaha-f310", name: getItem("yamaha-f310")!.name, price: getItem("yamaha-f310")!.price, meta: "23 views · 3 chats", tag: "● Active", tagBg: colors.sage, tagColor: colors.pine, angle: "60deg" },
      { id: "desk-lamp", name: getItem("desk-lamp")!.name, price: getItem("desk-lamp")!.price, meta: "9 views · 1 chat", tag: "● Active", tagBg: colors.sage, tagColor: colors.pine, angle: "45deg" },
    ],
    sold: [
      { id: "boat-rockerz-550", name: getItem("boat-rockerz-550")!.name, price: getItem("boat-rockerz-550")!.price, meta: "sold in 3 days 🎉", tag: "✓ Sold", tagBg: colors.ink, tagColor: colors.bg, angle: "30deg" },
    ],
    saved: [
      { id: "study-table", name: getItem("study-table")!.name, price: getItem("study-table")!.price, meta: "0.4 km away", tag: "♡ Saved", tagBg: colors.savedBg, tagColor: colors.savedText, angle: "75deg" },
      ...(guitarLiked
        ? [{ id: "yamaha-f310", name: getItem("yamaha-f310")!.name, price: getItem("yamaha-f310")!.price, meta: "1.1 km away", tag: "♡ Saved", tagBg: colors.savedBg, tagColor: colors.savedText, angle: "60deg" }]
        : []),
    ],
    reviews: [{ name: "“Super smooth pickup”", price: "★ 5", meta: "from Kabir M. · buyer", tag: "review", tagBg: colors.offerBg, tagColor: colors.offerText, angle: "45deg" }],
  };

  const profStats = [
    { v: "1", k: "sold" },
    { v: "★ 5.0", k: "rating" },
    { v: "4 min", k: "avg reply" },
  ];
  const profBadges = ["🤝 Reliable meeter — never flaked", "⚡ Fast replier", "🌱 Gave 1 thing a second life"];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
      <div style={{ height: 130, background: "repeating-linear-gradient(-45deg,#F2A93B 0 18px,#EFA032 18px 36px)", position: "relative", borderRadius: "0 0 26px 26px" }}>
        <div
          style={{
            position: "absolute",
            left: 36,
            bottom: -44,
            width: 104,
            height: 104,
            borderRadius: 32,
            background: colors.teal,
            border: "5px solid #FBF6ED",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: "var(--font-bricolage)",
            fontWeight: 800,
            fontSize: 38,
            transform: "rotate(-3deg)",
          }}
        >
          {avatarInitial}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, padding: "14px 36px 0 164px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 28, letterSpacing: "-.7px" }}>{name}</h1>
            <span style={{ background: colors.sage, color: colors.pine, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>✓ phone verified</span>
          </div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, fontWeight: 600, marginTop: 3 }}>
            Koramangala, Bengaluru · joined Jul 2026 · &ldquo;hostel room minimalist in progress&rdquo;
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, paddingBottom: 4 }}>
          {profStats.map((ps) => (
            <div key={ps.k} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 24, color: colors.clay, whiteSpace: "nowrap" }}>{ps.v}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.textFaint, textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" }}>{ps.k}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "18px 36px 0", flexWrap: "wrap" }}>
        {profBadges.map((pb) => (
          <div
            key={pb}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 999,
              padding: "7px 15px",
              fontSize: 12.5,
              fontWeight: 700,
              color: colors.textBody,
              whiteSpace: "nowrap",
              flex: "none",
            }}
          >
            {pb}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 26, padding: "24px 36px 0", borderBottom: `1.5px dashed ${colors.divider}`, fontWeight: 800, fontSize: 14.5 }}>
        {tabs.map((t) => (
          <ProfileTabButton key={t.key} label={t.label} active={profTab === t.key} onClick={() => setProfTab(t.key)} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, padding: "24px 36px 40px" }}>
        {grids[profTab].map((pl, i) => (
          <ProfileGridCard key={`${pl.name}-${i}`} card={pl} />
        ))}
      </div>
    </div>
  );
}

function ProfileTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "0 0 12px",
        borderBottom: `3px solid ${active ? colors.terracotta : "transparent"}`,
        color: active || hover ? colors.ink : colors.textFaint,
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

function ProfileGridCard({ card }: { card: GridCard }) {
  const [hover, setHover] = useState(false);
  const inner = (
    <>
      <Stripe angle={card.angle} band={8} label="product photo" style={{ height: 130, fontSize: 10 }}>
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: card.tagBg,
            color: card.tagColor,
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 999,
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {card.tag}
        </div>
      </Stripe>
      <div style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: colors.ink }}>{card.name}</div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay, whiteSpace: "nowrap" }}>{card.price}</div>
        </div>
        <div style={{ fontSize: 12, color: colors.textFaint, fontWeight: 600 }}>{card.meta}</div>
      </div>
    </>
  );
  const style = {
    background: "#fff",
    border: `1.5px solid ${colors.cardBorder}`,
    borderRadius: 18,
    overflow: "hidden",
    cursor: card.id ? ("pointer" as const) : ("default" as const),
    display: "block" as const,
    ...(hover && card.id ? { transform: "translateY(-4px)", boxShadow: "0 10px 24px rgba(60,45,20,.1)" } : null),
  };

  if (card.id) {
    return (
      <Link href={`/product/${card.id}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={style}>
        {inner}
      </Link>
    );
  }
  return <div style={style}>{inner}</div>;
}
