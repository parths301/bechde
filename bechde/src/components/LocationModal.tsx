"use client";

import { useState } from "react";
import { colors } from "@/lib/colors";
import { geocode, currentPosition, type GeocodeResult } from "@/lib/geo";
import { saveUserLocation, useUserLocation } from "@/lib/queries";

const POPULAR_CITIES = [
  { name: "Bengaluru (Koramangala)", lat: 12.9352, lng: 77.6245 },
  { name: "Mumbai (Bandra)", lat: 19.0596, lng: 72.8295 },
  { name: "Delhi NCR (Connaught Place)", lat: 28.6315, lng: 77.2167 },
  { name: "Hyderabad (Hitec City)", lat: 17.4435, lng: 78.3772 },
  { name: "Pune (Koregaon Park)", lat: 18.5362, lng: 73.894 },
  { name: "Chennai (T. Nagar)", lat: 13.0418, lng: 80.2341 },
  { name: "Kolkata (Park Street)", lat: 22.5532, lng: 88.3524 },
  { name: "Ahmedabad (Navrangpura)", lat: 23.0366, lng: 72.5608 },
  { name: "Jaipur (C-Scheme)", lat: 26.9099, lng: 75.8016 },
];

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationModal({ isOpen, onClose }: LocationModalProps) {
  const currentLocation = useUserLocation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim() || q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await geocode(q);
      if (res) {
        setResults([res]);
      } else {
        setResults([]);
      }
    } catch {
      setError("Could not search location. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectLocation = async (lat: number, lng: number, label: string) => {
    try {
      await saveUserLocation({ lat, lng, label });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error saving location.");
    }
  };

  const useGPS = async () => {
    setLocating(true);
    setError(null);
    try {
      const pos = await currentPosition();
      await saveUserLocation(pos);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Permission denied or unavailable.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          // The city chips don't wrap mid-name, so without min-width:0 the box
          // grew past the screen and sat flush-left with its right half cut off.
          minWidth: 0,
          // Landscape phones are ~430px tall: the list has to scroll inside the
          // sheet, or "Popular Cities" is simply unreachable.
          maxHeight: "calc(100dvh - 40px)",
          overflowY: "auto",
          background: colors.bg,
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: 20,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontSize: 22, fontWeight: 800, color: colors.ink }}>
              Select Location & City
            </h3>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
              Find second-hand deals in your exact neighbourhood
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: colors.textMuted,
            }}
          >
            ✕
          </button>
        </div>

        {/* GPS Button */}
        <button
          onClick={useGPS}
          disabled={locating}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: colors.marigold,
            color: colors.marigoldInk,
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 800,
            cursor: locating ? "wait" : "pointer",
          }}
        >
          <span>📍</span>
          {locating ? "Detecting GPS location..." : "Use Current GPS Location"}
        </button>

        {error && <div style={{ fontSize: 12.5, color: colors.terracotta, fontWeight: 700 }}>{error}</div>}

        {/* Manual Search */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.ink, marginBottom: 6 }}>
            Or search city / neighbourhood
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder='Type "Indiranagar", "Bandra", "Connaught Place"...'
            style={{
              width: "100%",
              background: "#fff",
              border: `1.5px solid ${colors.sand}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              color: colors.ink,
            }}
          />
          {searching && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Searching...</div>}
          {results.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {results.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => selectLocation(r.lat, r.lng, r.label)}
                  style={{
                    padding: "10px 12px",
                    background: "#fff",
                    border: `1px solid ${colors.sand}`,
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📍 {r.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular Cities Quick Select */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.ink, marginBottom: 8 }}>
            Popular Cities
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {POPULAR_CITIES.map((c) => (
              <button
                key={c.name}
                onClick={() => selectLocation(c.lat, c.lng, c.name)}
                style={{
                  background: currentLocation.label.includes(c.name.split(" ")[0]) ? colors.ink : colors.bg2,
                  color: currentLocation.label.includes(c.name.split(" ")[0]) ? "#fff" : colors.textBody,
                  border: `1px solid ${colors.sand}`,
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
