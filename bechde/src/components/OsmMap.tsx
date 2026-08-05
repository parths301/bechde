"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { colors } from "@/lib/colors";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  price?: string;
  label?: string;
  /** cover photo — falls back to the striped placeholder, as elsewhere in the app */
  image?: string;
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
  /** diameter of the bubble markers in px — smaller on cramped mobile maps */
  bubbleSize?: number;
  onMarkerClick?: (id: string) => void;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Height the price pill and its gap add below the bubble. */
const PILL_BLOCK = 24;

/**
 * Markers are drawn as radar bubbles — a round cover photo with the item's name and
 * its price on a pill underneath — rather than a dropped map pin. The radar on the
 * home screen established that language and it's the thing people recognise, so every
 * map in the app now speaks it. Unlike the radar, these sit at their true coordinates.
 */
function bubbleHtml(mk: MapMarker, size: number) {
  const label = escapeHtml(mk.label ?? "");
  const face = mk.image
    ? `background:#EDE3D2 center/cover url("${encodeURI(mk.image)}")`
    : `background:repeating-linear-gradient(45deg, ${colors.stripe1} 0 9px, ${colors.stripe2} 9px 18px)`;
  // The name only goes inside the placeholder — over a photo it would be unreadable.
  const caption = mk.image
    ? ""
    : `<span data-user-content style="font:11px/1.15 ui-monospace,Menlo,monospace;color:${colors.textMuted};text-align:center;padding:0 6px;overflow:hidden">${label}</span>`;
  const pill = mk.price
    ? `<div class="bd-pin-pill" style="margin-top:4px;background:#fff;border:1.5px solid ${colors.sand};border-radius:999px;padding:2px 9px;font:700 11.5px/1.35 var(--font-karla,system-ui);color:${colors.ink};white-space:nowrap;box-shadow:0 2px 6px rgba(60,45,20,.1)">${escapeHtml(mk.price)}</div>`
    : "";
  return `<div class="bd-pin" style="display:flex;flex-direction:column;align-items:center">
    <div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(60,45,20,.18);display:grid;place-items:center;overflow:hidden;${face}">${caption}</div>
    ${pill}
  </div>`;
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
  bubbleSize = 62,
  onMarkerClick,
  height = "100%",
  radius = 0,
  style,
}: OsmMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groupRef = useRef<LayerGroup | null>(null);
  // Held in a ref so the marker-sync effect can call the latest handler without
  // re-subscribing every render. Assigned in an effect — writing a ref during render
  // is not safe under concurrent rendering.
  const clickRef = useRef(onMarkerClick);
  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);
  const [ready, setReady] = useState(false);

  /**
   * Price pills all sit at the same offset above their pin, so listings a few
   * hundred metres apart drew their pills on top of one another — an unreadable
   * stack of overlapping black capsules. Pins stay at their true coordinates
   * (moving them would misreport where the item is); instead the pill is hidden
   * on whichever markers collide with one already shown. The pin is still there
   * and still tappable, and zooming in reveals the prices again.
   */
  const pillsRef = useRef<{ marker: Marker; lat: number; lng: number }[]>([]);
  const relayoutPills = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    type Box = { x1: number; y1: number; x2: number; y2: number };
    const hits = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

    // Deliberately pill-vs-pill only. Reserving the bubbles as well was tried and
    // hides every price in a tight cluster — worse than the overlap it prevents.
    const taken: Box[] = [];

    // North-first, so the topmost pill in a cluster is the one that survives.
    const ordered = [...pillsRef.current].sort((a, b) => b.lat - a.lat);
    for (const p of ordered) {
      const pill = (p.marker.getElement() as HTMLElement | null)?.querySelector<HTMLElement>(".bd-pin-pill");
      if (!pill) continue;
      pill.style.visibility = "";
      // Measure the pill where it actually is rather than assuming an offset — the
      // marker's shape has changed once already and hardcoded geometry didn't survive it.
      const r = pill.getBoundingClientRect();
      if (r.width === 0) continue;
      const origin = map.getContainer().getBoundingClientRect();
      const box: Box = {
        x1: r.left - origin.left - 4,
        y1: r.top - origin.top - 3,
        x2: r.right - origin.left + 4,
        y2: r.bottom - origin.top + 3,
      };
      if (taken.some((t) => hits(box, t))) pill.style.visibility = "hidden";
      else taken.push(box);
    }
  }, []);

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
      // Which pills collide depends on zoom and pan, so redo it whenever either changes.
      map.on("zoomend", relayoutPills);
      map.on("moveend", relayoutPills);
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
        // Above the bubbles: it's the one fixed point of reference on the map, and
        // listings clustered around you would otherwise bury it.
        const m = L.marker([user.lat, user.lng], { icon, interactive: false, zIndexOffset: 1000 });
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
        const placed: { marker: Marker; lat: number; lng: number }[] = [];
        for (const mk of markers) {
          const icon = L.divIcon({
            html: bubbleHtml(mk, bubbleSize),
            className: "bd-pin-icon",
            iconSize: [bubbleSize, bubbleSize + PILL_BLOCK],
            // Anchored on the bubble's centre, not a pin tip: the circle marks the spot.
            iconAnchor: [bubbleSize / 2, bubbleSize / 2],
          });
          const marker = L.marker([mk.lat, mk.lng], { icon, title: mk.label });
          if (clickRef.current) marker.on("click", () => clickRef.current?.(mk.id));
          marker.addTo(group);
          placed.push({ marker, lat: mk.lat, lng: mk.lng });
        }
        pillsRef.current = placed;
        // Two frames out: Leaflet attaches the icon elements asynchronously, and
        // offsetWidth reads 0 until they've been laid out.
        requestAnimationFrame(() => requestAnimationFrame(relayoutPills));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, user, radiusKm, fuzzy, ready, bubbleSize, relayoutPills]);

  /**
   * Frame the radius ring rather than sitting at a fixed zoom.
   *
   * /map opened at zoom 12 — the whole of Bengaluru — for a 3 km radius, so every
   * bubble collapsed into one unreadable pile in the middle. Refitting only when the
   * radius actually changes leaves the user's own panning and zooming alone.
   */
  const fittedRadius = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !radiusKm || !user) return;
    if (fittedRadius.current === radiusKm) return;
    fittedRadius.current = radiusKm;
    // Bounds computed arithmetically rather than from an L.circle: a circle that
    // isn't on a map has no projection, and getBounds() throws inside Leaflet.
    const latSpan = radiusKm / 111.32;
    const lngSpan = radiusKm / (111.32 * Math.cos((user.lat * Math.PI) / 180) || 1);
    map.fitBounds(
      [
        [user.lat - latSpan, user.lng - lngSpan],
        [user.lat + latSpan, user.lng + lngSpan],
      ],
      { padding: [24, 24], maxZoom: 16, animate: false }
    );
  }, [radiusKm, user, ready]);

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
