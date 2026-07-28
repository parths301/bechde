"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { homeCategories } from "@/lib/data";
import { useNearbyItems, useUserLocation } from "@/lib/queries";
import { radarPlacements } from "@/lib/geo";
import { DEFAULT_FILTERS, searchHref } from "@/lib/search";
import Chip from "@/components/Chip";
import { SearchBar } from "@/components/Header";
import RadarBubble from "@/components/RadarBubble";
import ListingCard from "@/components/ListingCard";
import OsmMap, { type MapMarker } from "@/components/OsmMap";
import LocationChip from "@/components/LocationChip";

const RADAR_BOX = { w: 560, h: 520 };

export default function HomePage() {
  const router = useRouter();
  const { radiusKm, setRadiusKm } = useAppState();
  const origin = useUserLocation();
  const nearbyAll = useNearbyItems().data ?? [];
  const ringPx = 130 + radiusKm * 35;

  // Everything on this screen is driven by real distances from `origin`.
  const nearby = nearbyAll.filter((i) => i.km <= radiusKm);
  const nearbyCount = nearby.length;
  // The radar shows the closest few, positioned by their actual coordinates.
  const shown = nearby.slice(0, 7);
  const sizes = shown.map((_, i) => Math.max(54, 78 - i * 3));
  // Placed as a set, not one at a time — bubbles need to know about each other to
  // avoid piling up when several listings sit within the same kilometre.
  const placements = radarPlacements(
    shown.map((item, i) => ({ seed: item.id, point: { lat: item.lat, lng: item.lng }, size: sizes[i] })),
    { origin, radiusKm, ringPx, box: RADAR_BOX }
  );
  // The mobile hero map replaces the radar, so it shows the same nearby listings.
  const nearbyMarkers: MapMarker[] = nearby.map((m) => ({
    id: m.id,
    lat: m.lat,
    lng: m.lng,
    price: m.price,
    label: m.label,
    image: m.cover,
  }));
  const homeBubbles = shown.map((item, i) => ({
    item,
    size: sizes[i],
    dur: `${3 + (i % 5) * 0.2}s`,
    delay: `${(i % 4) * 0.25}s`,
    ...placements[i],
  }));
  const feedItems = [...nearby]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 8);

  return (
    <div>
      <div
        className="bd-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 560px",
          gap: 30,
          padding: "40px 36px 26px",
          alignItems: "center",
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              alignSelf: "flex-start",
              background: colors.sage,
              color: colors.pine,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ✦ {nearbyCount} {nearbyCount === 1 ? "thing" : "things"} for sale within {radiusKm} km
          </div>
          <LocationChip />
          <h1 className="bd-hero-h1" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 54, lineHeight: 1.05, letterSpacing: "-1.5px" }}>
            Good stuff,
            <br />
            walking distance.
          </h1>
          <p style={{ margin: 0, maxWidth: 400, fontSize: 16.5, lineHeight: 1.6, color: colors.textBody }}>
            Buy and sell with people in your own neighbourhood. No shipping, no strangers from far away — just meet, check, and take it home.
          </p>
          {/* mobile-only: the header search is hidden under the breakpoint */}
          <div className="bd-mobile-search" style={{ display: "none" }}>
            <SearchBar />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {homeCategories.map((c) => (
              <Chip
                key={c.name}
                icon={c.icon}
                name={c.name}
                onClick={() => router.push(searchHref({ ...DEFAULT_FILTERS, category: c.name, radiusKm }))}
              />
            ))}
          </div>
        </div>

        <div className="bd-hero-radar" style={{ position: "relative", width: 560, height: 520, display: "grid", placeItems: "center" }}>
          {/* faded square map backdrop */}
          <div
            className="bd-map-fade"
            style={{
              position: "absolute",
              width: 468,
              height: 468,
              borderRadius: 30,
              overflow: "hidden",
              pointerEvents: "none",
              opacity: 0.92,
            }}
          >
            <OsmMap
              center={{ lat: origin.lat, lng: origin.lng }}
              zoom={14}
              interactive={false}
              height="100%"
            />
            {/* feather the edges into the page background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 30,
                pointerEvents: "none",
                boxShadow: "inset 0 0 48px 26px #FBF6ED, inset 0 0 14px 3px rgba(251,246,237,.55)",
              }}
            />
          </div>
          <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
          <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: `1.5px dashed ${colors.ring}` }} />
          <div
            style={{
              position: "absolute",
              width: ringPx,
              height: ringPx,
              borderRadius: "50%",
              border: `2.5px solid ${colors.marigold}`,
              boxShadow: "0 0 0 8px rgba(242,169,59,.10)",
              transition: "width .3s,height .3s",
            }}
          />
          <div style={{ position: "absolute", display: "grid", placeItems: "center" }}>
            <div style={{ position: "absolute", width: 46, height: 46, borderRadius: "50%", background: colors.terracotta, animation: "bd-pulse 2.2s ease-out infinite" }} />
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: colors.terracotta,
                border: "3px solid #fff",
                boxShadow: "0 3px 10px rgba(232,106,79,.45)",
                display: "grid",
                placeItems: "center",
                fontSize: 19,
                position: "relative",
              }}
            >
              🏠
            </div>
            <div
              style={{
                position: "absolute",
                top: 52,
                background: colors.ink,
                color: colors.bg,
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                padding: "3px 9px",
                whiteSpace: "nowrap",
              }}
            >
              you
            </div>
          </div>

          {homeBubbles.map((b) => (
            <RadarBubble
              key={b.item.id}
              left={b.left}
              top={b.top}
              size={b.size}
              angle={b.item.angle}
              label={b.item.label}
              src={b.item.cover}
              price={b.item.price}
              dur={b.dur}
              delay={b.delay}
              onClick={() => router.push(`/product/${b.item.id}`)}
            />
          ))}

          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#fff",
              border: `1.5px solid ${colors.sand}`,
              borderRadius: 999,
              padding: "10px 20px",
              boxShadow: "0 6px 18px rgba(60,45,20,.08)",
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textBody, whiteSpace: "nowrap" }}>Radius</span>
            <input
              type="range"
              aria-label="Search radius in kilometres"
              min={1}
              max={10}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ width: 150, cursor: "pointer" }}
            />
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay, whiteSpace: "nowrap", minWidth: 44 }}>
              {radiusKm} km
            </span>
          </div>
        </div>

        {/* mobile-only: full-width square map + radius */}
        <div className="bd-hero-mobilemap" style={{ flexDirection: "column", gap: 14 }}>
          <div className="bd-map-fade" style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 26, overflow: "hidden" }}>
            {/* This map stands in for the radar on phones, so it has to carry the
                same listings. Without markers it was just an empty street map with
                a "you" pin, while the feed underneath listed items 0.1 km away. */}
            <OsmMap
              center={{ lat: origin.lat, lng: origin.lng }}
              zoom={14}
              interactive={false}
              user={origin}
              radiusKm={radiusKm}
              markers={nearbyMarkers}
              bubbleSize={52}
              onMarkerClick={(id) => router.push(`/product/${id}`)}
              height="100%"
            />
            {/* feather the edges into the page background, like the desktop map */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 26,
                pointerEvents: "none",
                boxShadow: "inset 0 0 44px 24px #FBF6ED, inset 0 0 14px 3px rgba(251,246,237,.55)",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1.5px solid ${colors.sand}`, borderRadius: 999, padding: "10px 18px" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textBody, whiteSpace: "nowrap" }}>Radius</span>
            <input type="range" aria-label="Search radius in kilometres" min={1} max={10} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ flex: 1, cursor: "pointer" }} />
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay, whiteSpace: "nowrap", minWidth: 44 }}>{radiusKm} km</span>
          </div>
        </div>
      </div>

      <div className="bd-feed-sec" style={{ padding: "10px 36px 44px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 18px" }}>
          <h2 className="bd-feed-h2" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.5px" }}>
            Fresh within {radiusKm} km
          </h2>
          <Link href="/map" style={{ fontSize: 13.5, fontWeight: 700, color: colors.clay, cursor: "pointer" }}>
            see all on map →
          </Link>
        </div>
        <div className="bd-feed-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {feedItems.map((f) => (
            <ListingCard key={f.id} item={f} />
          ))}
        </div>
      </div>
    </div>
  );
}
