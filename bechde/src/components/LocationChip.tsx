"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import { useUserLocation, useProfile, useLocating } from "@/lib/queries";
import LocationModal from "./LocationModal";

export default function LocationChip({ style }: { style?: React.CSSProperties }) {
  const origin = useUserLocation();
  const profile = useProfile().data;
  // Auto-locating is a whole-app, once-ever concern and lives in useAutoLocate; the chip
  // only reports it. Running it per chip is what re-prompted on every screen.
  // Only "Locating…" while nothing is known yet — once a place is picked, showing it
  // would replace the label the person just chose with a spinner.
  const busy = useLocating() && !origin.precise;
  const [modalOpen, setModalOpen] = useState(false);

  const placeLabel = origin.precise
    ? profile?.neighbourhood ?? origin.label.replace(/^you · /, "")
    : "Select location / city";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", ...style }}>
        {/* A real button: this opens a dialog, and as a plain div it was
            unreachable by keyboard and invisible to assistive tech. */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Change location — currently ${placeLabel}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: origin.precise ? "#fff" : colors.offerBg,
            border: `1.5px solid ${origin.precise ? colors.sand : "#E0B45C"}`,
            borderRadius: 999,
            padding: "7px 14px",
            font: "inherit",
            fontSize: 12.5,
            fontWeight: 700,
            color: colors.textBody,
            cursor: "pointer",
            whiteSpace: "nowrap",
            maxWidth: "100%",
            overflow: "hidden",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <span>📍</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{busy ? "Locating..." : placeLabel}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </button>
      </div>

      <LocationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
