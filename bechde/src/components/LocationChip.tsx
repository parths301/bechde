"use client";

import { useEffect, useState } from "react";
import { colors } from "@/lib/colors";
import { currentPosition } from "@/lib/geo";
import { useUserLocation, saveUserLocation, useProfile } from "@/lib/queries";
import LocationModal from "./LocationModal";

export default function LocationChip({ style }: { style?: React.CSSProperties }) {
  const origin = useUserLocation();
  const profile = useProfile().data;
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Ask for browser geolocation automatically on first mount if not yet shared
  useEffect(() => {
    if (!origin.precise && typeof window !== "undefined" && navigator.geolocation) {
      setBusy(true);
      currentPosition()
        .then((point) => saveUserLocation(point))
        .catch(() => {
          // If permission is denied or ignored, stay un-precise so user can pick manually
        })
        .finally(() => setBusy(false));
    }
  }, []);

  const placeLabel = origin.precise
    ? profile?.neighbourhood ?? origin.label.replace(/^you · /, "")
    : "Select location / city";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", ...style }}>
        <div
          onClick={() => setModalOpen(true)}
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
            cursor: "pointer",
            whiteSpace: "nowrap",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <span>📍</span>
          <span>{busy ? "Locating..." : placeLabel}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </div>
      </div>

      <LocationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
