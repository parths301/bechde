import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { operator } from "@/lib/legal";

/**
 * Thin proxy over OpenStreetMap's Nominatim (free, no key). Server-side so we can send
 * the User-Agent their usage policy requires and keep the browser off their API.
 *   GET /api/geocode?q=Koramangala          → forward geocode
 *   GET /api/geocode?lat=12.93&lng=77.62    → reverse geocode
 *
 * Gated and throttled, which it wasn't before. Nominatim's usage policy caps callers at
 * roughly a request a second and wants a working contact address; an open, unthrottled
 * proxy is one scraper away from getting our egress IPs banned — and when that happens
 * the sell form and the location picker stop working for everybody, from a failure with
 * no obvious cause. Both limits below exist to keep us inside that policy.
 */

/** Their policy asks for a real contact, so it tracks the operator details. */
const UA = `BechDe/1.0 (${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bechde.app"}; ${operator.supportEmail})`;

/**
 * Per-profile token bucket. In-memory, so it's per-instance rather than global — which
 * is genuinely weaker than a shared counter and worth stating rather than glossing. It
 * still bounds the case that actually threatens the upstream limit (one person, one
 * tab, in a loop); a distributed limiter would need a Redis this project doesn't have.
 */
const BUCKET_SIZE = 12;
const REFILL_PER_MS = 12 / 60_000; // twelve lookups a minute, sustained
const buckets = new Map<string, { tokens: number; last: number }>();

function takeToken(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: BUCKET_SIZE, last: now };
  b.tokens = Math.min(BUCKET_SIZE, b.tokens + (now - b.last) * REFILL_PER_MS);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  // Don't let the map grow without bound on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.last > 600_000) buckets.delete(k);
  }
  return true;
}

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  residential?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  state_district?: string;
  state?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

/** "5th Block, Koramangala" style short label instead of Nominatim's long display_name. */
function shortLabel(place: NominatimPlace): string {
  const a = place.address ?? {};
  const local = a.neighbourhood || a.suburb || a.quarter || a.residential || a.road || place.name;
  const city = a.city || a.town || a.village || a.state_district;
  const parts = [local, city].filter(Boolean) as string[];
  if (parts.length) return [...new Set(parts)].join(", ");
  return (place.display_name ?? "").split(",").slice(0, 2).join(",").trim();
}

async function nominatim(path: string, params: Record<string, string>) {
  const url = new URL(`https://nominatim.openstreetmap.org/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signing in is the gate. A signed-out visitor picks from the curated cities table
  // (0017) on the location sheet, which needs no geocoding, so nothing legitimate
  // reaches here without a session.
  if (!user) {
    return NextResponse.json({ error: "sign in to search for a place" }, { status: 401 });
  }
  if (!takeToken(user.id)) {
    return NextResponse.json({ error: "too many lookups — try again in a minute" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    let place: NominatimPlace | undefined;
    if (lat && lng) {
      place = (await nominatim("reverse", { lat, lon: lng, zoom: "16" })) as NominatimPlace;
      if (!place?.lat) place = undefined;
    } else if (q && q.trim()) {
      const list = (await nominatim("search", { q: q.trim(), limit: "1", countrycodes: "in" })) as NominatimPlace[];
      place = list?.[0];
    } else {
      return NextResponse.json({ error: "pass q, or lat and lng" }, { status: 400 });
    }

    if (!place) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json(
      { lat: Number(place.lat), lng: Number(place.lon), label: shortLabel(place) },
      // Places don't move. `private` now, not `public`: the response is tied to a
      // signed-in request, and a shared cache must not serve one person's lookup
      // to another.
      { headers: { "Cache-Control": "private, max-age=86400" } }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "geocode failed" }, { status: 502 });
  }
}
