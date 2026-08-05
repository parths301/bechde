"use client";

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/colors";
import Stripe from "./Stripe";
import { formatKm } from "@/lib/geo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { Item } from "@/lib/data";

export default function ListingCard({ item }: { item: Item }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/product/${item.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: `1.5px solid ${colors.cardBorder}`,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        display: "block",
        transition: "transform .15s",
        ...(hover ? { transform: "translateY(-4px)", boxShadow: "0 10px 24px rgba(60,45,20,.1)" } : null),
      }}
    >
      <Stripe angle={item.angle} src={item.cover} label="product photo" style={{ height: 150 }}>
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: colors.ink,
            color: colors.bg,
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {formatKm(item.km, t)}
        </div>
      </Stripe>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.ink }} data-user-content>
            {item.name}
          </div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, color: colors.clay, whiteSpace: "nowrap" }}>{item.price}</div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textMuted, fontStyle: "italic" }} data-user-content>
          &ldquo;{item.note}&rdquo;
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, fontSize: 12, color: colors.textBody, fontWeight: 600 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: item.seller.color, flex: "none" }} />
          <span data-user-content>{item.seller.name}</span>
        </div>
      </div>
    </Link>
  );
}
