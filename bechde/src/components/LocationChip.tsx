"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import { currentPosition } from "@/lib/geo";
import { useUserLocation, saveMyLocation, useProfile } from "@/lib/queries";

/**
 * The Phase-4 location capture affordance: asks the browser for coordinates, stores
 * them on the profile, and then shows the reverse-geocoded neighbourhood. Until the
 * person shares a location, everything falls back to the demo Koramangala centre.
 */
export default function LocationChip({ style }: { style?: React.CSSProperties }) {
  const origin = useUserLocation();
  const profile = useProfile().data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const point = await currentPosition();
      await saveMyLocation(point);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  };

  const label = busy
    ? "Finding you…"
    : origin.precise
      ? `${profile?.neighbourhood ?? "your spot"} · update`
      : "Use my exact location";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", ...style }}>
      <div
        onClick={ask}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: origin.precise ? "#fff" : colors.offerBg,
          border: `1.5px solid ${origin.precise ? colors.sand : "#E0B45C"}`,
          borderRadius: 999,
          padding: "7px 14px",
          fontSize: 12.5,
          fontWeight: 700,
          color: colors.textBody,
          cursor: busy ? "wait" : "pointer",
          whiteSpace: "nowrap",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <span>📍</span>
        {label}
      </div>
      {error && <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.terracotta, maxWidth: 320 }}>{error}</div>}
    </div>
  );
}
