import type { MetadataRoute } from "next";
import { colors } from "@/lib/colors";

// Colours come from the tokens, not from a second set of hand-typed hexes — this file
// used to claim a #FF6B6B theme and a white background, neither of which the app has.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bech De — buy & sell nearby",
    short_name: "Bech De",
    description: "Buy and sell with people in your own neighbourhood.",
    start_url: "/",
    display: "standalone",
    background_color: colors.bg,
    theme_color: colors.bg,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
