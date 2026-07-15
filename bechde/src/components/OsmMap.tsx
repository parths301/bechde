"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { colors } from "@/lib/colors";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  price?: string;
  label?: string;
  /** dot colour — defaults to terracotta */
  color?: string;
}

interface OsmMapProps {
  markers?: MapMarker[];
  center: { lat: number; lng: number };
  zoom?: number;
  /** draw a "you are here" pin at this point */
  user?: { lat: number; lng: number; label?: string };
  /** draw a translucent radius ring (km) around the centre */
  radiusKm?: number;
  /** hide exact position behind a soft blur circle (privacy) instead of a pin */
  fuzzy?: boolean;
  interactive?: boolean;
  onMarkerClick?: (id: string) => void;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

// Custom price-pill pin, brand styled, drawn as an HTML divIcon.
function pinHtml(price: string | undefined, color: string) {
  const pill = price
    ? `<div style="position:absolute;left:50%;bottom:26px;transform:translateX(-50%);background:${colors.ink};color:${colors.bg};font:800 11px/1 var(--font-bricolage,system-ui);padding:4px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 3px 8px rgba(60,45,20,.28)">${price}</div>`
    : "";
  return `<div class="bd-pin">${pill}
    <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 4px 5px rgba(60,45,20,.35))">
      <path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.5 15 38 15 38s15-12.5 15-23.2C30 6.6 23.3 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="14.5" r="5.5" fill="#fff"/>
    </svg></div>`;
}

function youHtml() {
  return `<div style="display:grid;place-items:center">
    <div class="bd-you-pulse" style="position:absolute;width:34px;height:34px;border-radius:50%;background:${colors.terracotta};opacity:.35"></div>
    <div style="width:22px;height:22px;border-radius:50%;background:${colors.terracotta};border:3px solid #fff;box-shadow:0 2px 7px rgba(232,106,79,.5)"></div>
  </div>`;
}

export default function OsmMap({
  markers = [],
  center,
  zoom = 13,
  user,
  radiusKm,
  fuzzy = false,
  interactive = true,
  onMarkerClick,
  height = "100%",
  radius = 0,
  style,
}: OsmMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groupRef = useRef<LayerGroup | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const [ready, setReady] = useState(false);

  // Create the map once, on mount (client-only via dynamic import).
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      map = L.map(elRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      groupRef.current = L.layerGroup().addTo(map);
      setReady(true); // let the marker-sync effect run now that the map exists
    })();

    return () => {
      cancelled = true;
      setReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers / user pin / radius ring whenever inputs change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      const group = groupRef.current;
      if (cancelled || !map || !group) return;

      group.clearLayers();

      if (radiusKm && user) {
        L.circle([user.lat, user.lng], {
          radius: radiusKm * 1000,
          color: colors.marigold,
          weight: 2.5,
          fillColor: colors.marigold,
          fillOpacity: 0.08,
        }).addTo(group);
      }

      if (user) {
        const icon = L.divIcon({ html: youHtml(), className: "bd-you-icon", iconSize: [22, 22], iconAnchor: [11, 11] });
        const m = L.marker([user.lat, user.lng], { icon, interactive: false });
        if (user.label) m.bindTooltip(user.label, { direction: "bottom", offset: [0, 10], className: "bd-tip" });
        m.addTo(group);
      }

      if (fuzzy && markers.length === 1) {
        // privacy: show an approximate area, not the exact pin
        const only = markers[0];
        L.circle([only.lat, only.lng], {
          radius: 260,
          color: colors.terracotta,
          weight: 2,
          dashArray: "5 6",
          fillColor: colors.terracotta,
          fillOpacity: 0.14,
        }).addTo(group);
      } else {
        for (const mk of markers) {
          const icon = L.divIcon({
            html: pinHtml(mk.price, mk.color ?? colors.terracotta),
            className: "bd-pin-icon",
            iconSize: [30, 38],
            iconAnchor: [15, 38],
          });
          const marker = L.marker([mk.lat, mk.lng], { icon, title: mk.label });
          if (clickRef.current) marker.on("click", () => clickRef.current?.(mk.id));
          marker.addTo(group);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, user, radiusKm, fuzzy, ready]);

  // Keep the view centred when the centre prop changes.
  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], mapRef.current.getZoom());
  }, [center.lat, center.lng]);

  return (
    <div
      ref={elRef}
      style={{ width: "100%", height, borderRadius: radius, overflow: "hidden", zIndex: 0, ...style }}
    />
  );
}
