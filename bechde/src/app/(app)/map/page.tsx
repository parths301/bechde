"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { mapItemsAll, mapCategoryNames, mapCategoryIcons, USER_LOCATION } from "@/lib/data";
import OsmMap, { MapMarker } from "@/components/OsmMap";
import Chip from "@/components/Chip";

export default function MapPage() {
  const router = useRouter();
  const { mapRadius, setMapRadius, activeCat, setActiveCat } = useAppState();

  const visible = (km: number, cat: string) => km <= mapRadius && (activeCat === "All" || cat === activeCat);
  const shown = mapItemsAll.filter((m) => visible(m.km, m.category));
  const mapCount = shown.length;

  const markers: MapMarker[] = shown.map((m) => ({
    id: m.id,
    lat: m.lat,
    lng: m.lng,
    price: m.price,
    label: m.name,
  }));

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 76px)" }}>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <OsmMap
          center={{ lat: USER_LOCATION.lat, lng: USER_LOCATION.lng }}
          zoom={12}
          user={USER_LOCATION}
          radiusKm={mapRadius}
          markers={markers}
          onMarkerClick={(id) => router.push(`/product/${id}`)}
          height="100%"
        />

        {/* count pill */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 26,
            zIndex: 1000,
            pointerEvents: "none",
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
