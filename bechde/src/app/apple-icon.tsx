import { ImageResponse } from "next/og";
import { colors } from "@/lib/colors";

// The home-screen icon. Bigger than the favicon, so it can carry the header mark as it
// actually is: the tilted marigold tile on cream, rather than the flattened tab version.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bg,
        }}
      >
        <div
          style={{
            width: 122,
            height: 122,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.marigold,
            // Per-corner, spelled out: Satori collapses the shorthand to a single radius
            // and the clipped bottom-left corner is the whole shape.
            borderTopLeftRadius: 38,
            borderTopRightRadius: 38,
            borderBottomRightRadius: 38,
            borderBottomLeftRadius: 12,
            color: colors.marigoldInk,
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: "-2px",
            transform: "rotate(-6deg)",
          }}
        >
          B
        </div>
      </div>
    ),
    { ...size },
  );
}
