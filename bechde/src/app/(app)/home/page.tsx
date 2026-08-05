"use client";

import { useCallback, useEffect, useRef } from "react";
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
import OsmMap from "@/components/OsmMap";
import LocationChip from "@/components/LocationChip";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const RADAR_BOX = { w: 560, h: 520 };

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { radiusKm, setRadiusKm } = useAppState();
  const origin = useUserLocation();
  const nearbyAll = useNearbyItems().data ?? [];
  const ringPx = 130 + radiusKm * 35;

  /* The radar is laid out at a fixed 560x520 — ring radii, bubble sizes and the
     relaxation in radarPlacements all assume it. Rather than rebuild that maths for
     small screens, measure the space available and scale the whole thing, so a phone
     shows the identical radar. Written straight to the DOM: this is a measurement of
     the layout, not state, and routing it through React would re-render on resize. */
  const radarScaleRef = useRef<HTMLDivElement>(null);
  const fitRadar = useCallback(() => {
    const el = radarScaleRef.current;
    if (!el || !el.offsetParent) return; // display:contents on desktop — nothing to fit
    const scale = Math.min(1, el.clientWidth / RADAR_BOX.w);
    el.style.setProperty("--bd-radar-scale", String(scale));
    el.style.height = `${RADAR_BOX.h * scale}px`;
  }, []);
  useEffect(() => {
    fitRadar();
    const ro = new ResizeObserver(fitRadar);
    if (radarScaleRef.current) ro.observe(radarScaleRef.current);
    window.addEventListener("resize", fitRadar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fitRadar);
    };
  }, [fitRadar]);

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
            {t("home.forSaleWithin", { count: nearbyCount, radius: radiusKm })}
          </div>
          {/* Phones only — the header's copy is inside .bd-desktop-nav, which is
              hidden under the breakpoint. Showing both would be the duplication. */}
          <div className="bd-hero-loc">
            <LocationChip />
          </div>
          <h1 className="bd-hero-h1" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 54, lineHeight: 1.05, letterSpacing: "-1.5px" }}>
            {t("home.headline1")}
            <br />
            {t("home.headline2")}
          </h1>
          <p style={{ margin: 0, maxWidth: 400, fontSize: 16.5, lineHeight: 1.6, color: colors.textBody }}>
            {t("home.blurb")}
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

        {/* Phones get the same radar, not an approximation of it — scaled down as a
            whole so the ring spacing, bubble relaxation and centre pin stay exactly
            as designed. `display: contents` on desktop keeps the original layout. */}
        <div className="bd-radar-scale" ref={radarScaleRef}>
        <div className="bd-hero-radar" style={{ position: "relative", width: RADAR_BOX.w, height: RADAR_BOX.h, display: "grid", placeItems: "center" }}>
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
            className="bd-radar-radius"
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
            <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textBody, whiteSpace: "nowrap" }}>{t("home.radius")}</span>
            <input
              type="range"
              aria-label={t("home.radiusLabel")}
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
        </div>

        {/* mobile-only: the radius control that sits inside the radar on desktop */}
        <div className="bd-hero-mobilemap" style={{ flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1.5px solid ${colors.sand}`, borderRadius: 999, padding: "10px 18px" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.textBody, whiteSpace: "nowrap" }}>{t("home.radius")}</span>
            <input type="range" aria-label={t("home.radiusLabel")} min={1} max={10} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={{ flex: 1, cursor: "pointer" }} />
            <span style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 15, color: colors.clay, whiteSpace: "nowrap", minWidth: 44 }}>{radiusKm} km</span>
          </div>
        </div>
      </div>

      <div className="bd-feed-sec" style={{ padding: "10px 36px 44px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 18px" }}>
          <h2 className="bd-feed-h2" style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.5px" }}>
            {t("home.freshWithin", { km: radiusKm })}
          </h2>
          <Link href="/map" style={{ fontSize: 13.5, fontWeight: 700, color: colors.clay, cursor: "pointer" }}>
            {t("home.seeAllOnMap")}
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
