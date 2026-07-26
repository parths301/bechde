import { NextRequest, NextResponse } from "next/server";

// Thin proxy over OpenStreetMap's Nominatim (free, no key). Server-side so we can
// send the User-Agent their usage policy requires and keep the browser off their API.
//   GET /api/geocode?q=Koramangala          → forward geocode
//   GET /api/geocode?lat=12.93&lng=77.62    → reverse geocode
const UA = "BechDe/0.1 (https://bechde.example; marketplace prototype)";

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
      // Places don't move; let the browser and CDN keep these for a day.
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "geocode failed" }, { status: 502 });
  }
}
