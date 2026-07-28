// Real-world distance helpers + geocoding (via the /api/geocode Nominatim proxy).

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** East/north offset of `point` from `origin`, in kilometres (for radar placement). */
export function offsetKm(origin: LatLng, point: LatLng): { east: number; north: number } {
  const north = (point.lat - origin.lat) * (Math.PI / 180) * EARTH_R_KM;
  const east = (point.lng - origin.lng) * (Math.PI / 180) * EARTH_R_KM * Math.cos(toRad(origin.lat));
  return { east, north };
}

/** "0.4 km" / "1.1 km" / "12 km" — matches the prototype's pill copy. */
export function formatKm(km: number): string {
  if (!isFinite(km)) return "";
  if (km < 0.1) return "right here";
  if (km < 10) return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km)} km`;
}

// ---------------------------------------------------------------------------
// Radar placement — projects a real coordinate onto the home radar's px box, so
// bubble positions come from geography instead of the hand-authored `home` jsonb.
// ---------------------------------------------------------------------------
/** Stable pseudo-random in [0,1) from a string, so a listing never jumps around. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export interface RadarPlacementOpts {
  origin: LatLng;
  point: LatLng;
  /** the slider value — the highlighted ring's radius in km */
  radiusKm: number;
  /** the highlighted ring's diameter in px */
  ringPx: number;
  box: { w: number; h: number };
  /** bubble diameter in px */
  size: number;
  /** listing id — drives the deterministic anti-overlap jitter */
  seed: string;
}

/** The band a bubble of this size may occupy: inside the box, clear of the "you" pin. */
function radarBounds(o: { ringPx: number; box: { w: number; h: number }; size: number }) {
  return {
    maxR: Math.min(o.ringPx / 2, o.box.h / 2 - o.size / 2 - 26, o.box.w / 2 - o.size / 2 - 6),
    minR: 40 + o.size / 2,
  };
}

/** Centre of a bubble relative to the box centre, from geography alone. */
function radarCentre(o: RadarPlacementOpts): { x: number; y: number } {
  const pxPerKm = o.ringPx / 2 / Math.max(o.radiusKm, 0.5);
  const { east, north } = offsetKm(o.origin, o.point);
  const { maxR, minR } = radarBounds(o);

  const rRaw = Math.hypot(east * pxPerKm, -north * pxPerKm);
  // A listing at your exact coordinates has no bearing to use, so give it a stable one.
  const bearing = rRaw < 0.001 ? hash01(o.seed) * Math.PI * 2 : Math.atan2(-north, east);

  // Compress the radial scale: most listings sit in the inner cluster, and true
  // distances would pack them all on top of the centre pin.
  const r = Math.min(Math.max(Math.pow(Math.min(rRaw / maxR, 1), 0.6) * maxR, minR), maxR);
  return { x: Math.cos(bearing) * r, y: Math.sin(bearing) * r };
}

/** Top-left px offset for a single radar bubble. Prefer radarPlacements() for a set —
 *  placed alone, a bubble sits at its true bearing with no anti-overlap applied. */
export function radarPlacement(o: RadarPlacementOpts): { left: number; top: number } {
  const { x, y } = radarCentre(o);
  return { left: o.box.w / 2 + x - o.size / 2, top: o.box.h / 2 + y - o.size / 2 };
}

/** Gap to leave between two bubble edges. */
const BUBBLE_PAD = 8;

/**
 * Place a whole set of bubbles at once, pushing overlapping pairs apart.
 *
 * Placement has to be sibling-aware to fix crowding: a per-bubble random nudge can't
 * know whether it made things better or worse, and with several listings inside one
 * kilometre it routinely made them worse. This runs a few rounds of pairwise
 * relaxation instead, re-clamping into the legal band each round. Deterministic, and
 * cheap at the handful of bubbles the radar shows.
 */
export function radarPlacements(
  items: Array<{ seed: string; point: LatLng; size: number }>,
  shared: { origin: LatLng; radiusKm: number; ringPx: number; box: { w: number; h: number } }
): Array<{ left: number; top: number }> {
  const pts = items.map((it) => ({ ...radarCentre({ ...shared, ...it }), ...radarBounds({ ...shared, size: it.size }) }));

  const clamp = (p: (typeof pts)[number], seed: string) => {
    let r = Math.hypot(p.x, p.y);
    // Relaxation can push a bubble exactly onto the centre; give it a stable way out.
    const a = r < 0.001 ? hash01(seed) * Math.PI * 2 : Math.atan2(p.y, p.x);
    if (r < 0.001) r = p.minR;
    r = Math.min(Math.max(r, p.minR), p.maxR);
    p.x = Math.cos(a) * r;
    p.y = Math.sin(a) * r;
  };

  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const need = (items[i].size + items[j].size) / 2 + BUBBLE_PAD;
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 0.001) {
          // Perfectly coincident: separate along a stable per-pair direction.
          const a = hash01(`${items[i].seed}|${items[j].seed}`) * Math.PI * 2;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        const push = (need - d) / 2;
        pts[i].x -= (dx / d) * push;
        pts[i].y -= (dy / d) * push;
        pts[j].x += (dx / d) * push;
        pts[j].y += (dy / d) * push;
        moved = true;
      }
    }
    pts.forEach((p, i) => clamp(p, items[i].seed));
    if (!moved) break;
  }

  return pts.map((p, i) => ({
    left: shared.box.w / 2 + p.x - items[i].size / 2,
    top: shared.box.h / 2 + p.y - items[i].size / 2,
  }));
}

// ---------------------------------------------------------------------------
// Geocoding — server-proxied so Nominatim gets a proper User-Agent
// ---------------------------------------------------------------------------
export interface GeocodeResult extends LatLng {
  label: string;
}

async function geo(params: Record<string, string>): Promise<GeocodeResult | null> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/geocode?${qs}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { lat?: number; lng?: number; label?: string };
  if (typeof json.lat !== "number" || typeof json.lng !== "number") return null;
  return { lat: json.lat, lng: json.lng, label: json.label ?? "" };
}

/** Free-text place → coordinates. */
export function geocode(query: string): Promise<GeocodeResult | null> {
  return geo({ q: query });
}

/** Coordinates → a short neighbourhood label. */
export function reverseGeocode(point: LatLng): Promise<GeocodeResult | null> {
  return geo({ lat: String(point.lat), lng: String(point.lng) });
}

/** Browser geolocation, promisified. Rejects with a human-readable message. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location permission denied — you can still browse by neighbourhood."
              : "Couldn't get your location. Try again in a moment."
          )
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
