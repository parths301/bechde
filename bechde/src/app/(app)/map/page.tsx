"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { useNearbyItems, useUserLocation, saveSearch } from "@/lib/queries";
import { matchesFilters, searchCategories, type Filters } from "@/lib/search";
import OsmMap, { MapMarker } from "@/components/OsmMap";
import Chip from "@/components/Chip";
import LocationChip from "@/components/LocationChip";
import PriceInput from "@/components/PriceInput";

export default function MapPage() {
  const router = useRouter();
  const { mapRadius, setMapRadius, activeCat, setActiveCat } = useAppState();
  const origin = useUserLocation();
  const mapItemsAll = useNearbyItems().data ?? [];
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // The same filter shape /search uses — km is the real haversine distance from
  // `origin`, recomputed on every read.
  const filters: Filters = { q: "", category: activeCat, radiusKm: mapRadius, minPrice, maxPrice };
  const shown = mapItemsAll.filter((m) => matchesFilters(m, filters));

  const onSaveSearch = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      await saveSearch(filters);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  const mapCount = shown.length;

  const markers: MapMarker[] = shown.map((m) => ({
    id: m.id,
    lat: m.lat,
    lng: m.lng,
    price: m.price,
    // The short label, same as the radar bubbles use — a full listing name won't
    // fit inside a 62px circle.
    label: m.label,
    image: m.cover,
  }));

  return (
    <div className="bd-map-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 76px)" }}>
      <div className="bd-map-canvas" style={{ position: "relative", overflow: "hidden" }}>
        <OsmMap
          center={{ lat: origin.lat, lng: origin.lng }}
          zoom={12}
          user={origin}
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
      <div className="bd-map-rail" style={{ borderLeft: `1.5px dashed ${colors.divider}`, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 24, background: colors.bg }}>
        <LocationChip />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16 }}>Radius</span>
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, color: colors.clay }}>{mapRadius} km</span>
          </div>
          <input type="range" aria-label="Map radius in kilometres" min={1} max={10} value={mapRadius} onChange={(e) => setMapRadius(Number(e.target.value))} style={{ width: "100%", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: colors.textFaint }}>
            <span>1 km</span>
            <span>10 km</span>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Category</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {searchCategories.map((c) => (
              <Chip key={c.name} icon={c.icon} name={c.name} active={activeCat === c.name} onClick={() => setActiveCat(c.name)} />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Price</div>
          <div style={{ display: "flex", gap: 8 }}>
            <PriceInput placeholder="₹ min" value={minPrice} onCommit={setMinPrice} />
            <PriceInput placeholder="₹ max" value={maxPrice} onCommit={setMaxPrice} />
          </div>
        </div>

        <div style={{ background: colors.sage, borderRadius: 16, padding: "16px 18px", fontSize: 13, color: colors.pine, lineHeight: 1.55, fontWeight: 600 }}>
          <div style={{ marginBottom: 10 }}>
            💡 Save these filters and new matches get counted for you under{" "}
            <Link href="/search" style={{ color: colors.pineDark, fontWeight: 800 }}>
              search
            </Link>
            .
          </div>
          <div
            onClick={saveState === "saved" ? undefined : onSaveSearch}
            style={{
              textAlign: "center",
              background: saveState === "saved" ? colors.pine : "#fff",
              color: saveState === "saved" ? "#fff" : colors.pine,
              border: `2px solid ${colors.pine}`,
              borderRadius: 999,
              padding: "9px 0",
              fontWeight: 800,
              fontSize: 13,
              cursor: saveState === "saved" ? "default" : "pointer",
            }}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "✓ Search saved"
                : saveState === "error"
                  ? "Couldn't save — try again"
                  : "♡ Save this search"}
          </div>
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
