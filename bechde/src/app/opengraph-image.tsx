import { ImageResponse } from "next/og";

// The card that shows up when someone drops a Bech De link into WhatsApp.
// Drawn in code so there's no binary asset to keep in sync with the brand.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bech De — good stuff, walking distance";

const CREAM = "#FBF6ED";
const INK = "#2E2A24";
const MARIGOLD = "#F2A93B";
const TERRACOTTA = "#E86A4F";
const CLAY = "#B4552D";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: CREAM,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 84px",
          position: "relative",
        }}
      >
        {/* radar rings, echoing the home screen */}
        <div style={{ position: "absolute", right: -120, top: 95, width: 440, height: 440, borderRadius: 440, border: `3px dashed ${MARIGOLD}`, opacity: 0.5, display: "flex" }} />
        <div style={{ position: "absolute", right: -40, top: 175, width: 280, height: 280, borderRadius: 280, border: `3px dashed ${MARIGOLD}`, opacity: 0.7, display: "flex" }} />
        <div style={{ position: "absolute", right: 60, top: 275, width: 80, height: 80, borderRadius: 80, background: TERRACOTTA, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38 }}>
          🏠
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 34 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: "24px 24px 24px 8px",
              background: MARIGOLD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
              color: "#4A3313",
            }}
          >
            B
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: INK, letterSpacing: "-1px", display: "flex" }}>
            Bech De<span style={{ color: TERRACOTTA }}>.</span>
          </div>
        </div>

        <div style={{ fontSize: 82, fontWeight: 800, color: INK, letterSpacing: "-3px", lineHeight: 1.05, display: "flex", flexDirection: "column" }}>
          <span>Good stuff,</span>
          <span>walking distance.</span>
        </div>

        <div style={{ fontSize: 30, color: CLAY, fontWeight: 600, marginTop: 26, display: "flex" }}>
          Buy and sell with people in your own neighbourhood
        </div>
      </div>
    ),
    size
  );
}
