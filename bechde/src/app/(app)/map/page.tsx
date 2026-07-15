"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { mapItemsAll, mapCategoryNames, mapCategoryIcons } from "@/lib/data";
import RadarBubble from "@/components/RadarBubble";
import Chip from "@/components/Chip";

export default function MapPage() {
  const router = useRouter();
  const { mapRadius, setMapRadius, activeCat, setActiveCat } = useAppState();
  const mapRingPx = 220 + mapRadius * 54;

  const visible = (km: number, cat: string) => km <= mapRadius && (activeCat === "All" || cat === activeCat);
  const mapCount = mapItemsAll.filter((m) => visible(m.km, m.category)).length;

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 76px)" }}>
      <div style={{ position: "relative", background: "radial-gradient(circle at 50% 50%,#F3EADA 0%,#FBF6ED 75%)", overflow: "hidden" }}>
        {/* street doodles */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "30%", borderTop: "2px dashed rgba(200,180,140,.4)", transform: "rotate(-4deg)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "64%", borderTop: "2px dashed rgba(200,180,140,.4)", transform: "rotate(3deg)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "38%", borderLeft: "2px dashed rgba(200,180,140,.4)", transform: "rotate(6deg)" }} />

        {/* rings centered */}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 760, height: 760, transform: "translate(-50%,-50%)", borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 520, height: 520, transform: "translate(-50%,-50%)", borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 300, transform: "translate(-50%,-50%)", borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: mapRingPx,
            height: mapRingPx,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            border: `2.5px solid ${colors.marigold}`,
            boxShadow: "0 0 0 10px rgba(242,169,59,.09)",
            transition: "width .3s,height .3s",
          }}
        />

        {/* you */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "grid", placeItems: "center", zIndex: 3 }}>
          <div style={{ position: "absolute", width: 52, height: 52, borderRadius: "50%", background: colors.terracotta, animation: "bd-pulse 2.2s ease-out infinite" }} />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: colors.terracotta,
              border: "3px solid #fff",
              boxShadow: "0 3px 10px rgba(232,106,79,.45)",
              display: "grid",
              placeItems: "center",
              fontSize: 21,
            }}
          >
            🏠
          </div>
          <div style={{ position: "absolute", top: 58, background: colors.ink, color: colors.bg, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 9px", whiteSpace: "nowrap" }}>
            you · 5th Block
          </div>
        </div>

        {/* items */}
        {mapItemsAll.map((m) => (
          <RadarBubble
            key={m.id}
            left={m.map!.x}
            top={m.map!.y}
            size={m.map!.size}
            angle={m.angle}
            label={m.name.split(" ").slice(0, 2).join(" ")}
            price={m.price}
            dur={m.map!.dur}
            delay={m.map!.delay}
            hidden={!visible(m.km, m.category)}
            hoverZ={6}
            onClick={() => router.push(`/product/${m.id}`)}
          />
        ))}

        {/* count pill */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 26,
            background: colors.ink,
            color: colors.bg,
            borderRadius: 999,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 800,
            boxShadow: "0 6px 16px rgba(60,45,20,.2)",
          }}
        >
          {mapCount} items within {mapRadius} km
        </div>
      </div>

      {/* filter rail */}
      <div style={{ borderLeft: `1.5px dashed ${colors.divider}`, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 24, background: colors.bg }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16 }}>Radius</span>
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, color: colors.clay }}>{mapRadius} km</span>
          </div>
          <input type="range" min={1} max={10} value={mapRadius} onChange={(e) => setMapRadius(Number(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: colors.textFaint }}>
            <span>1 km</span>
            <span>10 km</span>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Category</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {mapCategoryNames.map((n) => (
              <Chip key={n} icon={mapCategoryIcons[n]} name={n} active={activeCat === n} onClick={() => setActiveCat(n)} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Price</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#fff", border: `1.5px solid ${colors.sand}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: colors.textFaint }}>
              ₹ min
            </div>
            <div style={{ flex: 1, background: "#fff", border: `1.5px solid ${colors.sand}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: colors.textFaint }}>
              ₹ max
            </div>
          </div>
        </div>

        <div style={{ background: colors.sage, borderRadius: 16, padding: "16px 18px", fontSize: 13, color: colors.pine, lineHeight: 1.55, fontWeight: 600 }}>
          💡 Tip: save this search and we&apos;ll ping you when something new pops up nearby.
        </div>

        <BackToHome />
      </div>
    </div>
  );
}

function BackToHome() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/home"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        marginTop: "auto",
        textAlign: "center",
        background: "#fff",
        border: `2px solid ${hover ? colors.terracotta : colors.ink}`,
        borderRadius: 999,
        padding: "12px 0",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
        display: "block",
        color: hover ? colors.clay : colors.ink,
      }}
    >
      ← Back to home
    </Link>
  );
}
