"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors } from "@/lib/colors";
import { useAppState } from "@/lib/store";
import { homeBubbles, homeCategories, feedItems } from "@/lib/data";
import Chip from "@/components/Chip";
import RadarBubble from "@/components/RadarBubble";
import ListingCard from "@/components/ListingCard";

export default function HomePage() {
  const router = useRouter();
  const { radiusKm, setRadiusKm } = useAppState();
  const ringPx = 130 + radiusKm * 35;
  const nearbyCount = 120 + radiusKm * 31;

  return (
    <div>
      <div
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
            ✦ {nearbyCount} things for sale near you right now
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 54, lineHeight: 1.05, letterSpacing: "-1.5px" }}>
            Good stuff,
            <br />
            walking distance.
          </h1>
          <p style={{ margin: 0, maxWidth: 400, fontSize: 16.5, lineHeight: 1.6, color: colors.textBody }}>
            Buy and sell with people in your own neighbourhood. No shipping, no strangers from far away — just meet, check, and take it home.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {homeCategories.map((c) => (
              <Chip key={c.name} icon={c.icon} name={c.name} onClick={() => router.push("/map")} />
            ))}
          </div>
        </div>

        <div style={{ position: "relative", width: 560, height: 520, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", inset: 20, borderRadius: "50%", background: "radial-gradient(circle,#F3EADA 0%,#FBF6ED 70%)" }} />
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
              key={b.id}
              left={b.home!.x}
              top={b.home!.y}
              size={b.home!.size}
              angle={b.angle}
              label={b.name.split(" ").slice(0, 2).join(" ")}
              price={b.price}
              dur={b.home!.dur}
              delay={b.home!.delay}
              onClick={() => router.push(`/product/${b.id}`)}
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

      <div style={{ padding: "10px 36px 44px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 18px" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 26, letterSpacing: "-.5px" }}>
            Fresh within {radiusKm} km
          </h2>
          <Link href="/map" style={{ fontSize: 13.5, fontWeight: 700, color: colors.clay, cursor: "pointer" }}>
            see all on map →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {feedItems.map((f) => (
            <ListingCard key={f.id} item={f} />
          ))}
        </div>
      </div>
    </div>
  );
}
