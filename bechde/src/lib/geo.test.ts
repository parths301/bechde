import { describe, it, expect } from "vitest";
import { haversineKm, offsetKm, formatKm, radarPlacement } from "./geo";

// Real Bengaluru coordinates, so a broken haversine shows up as a wrong answer
// rather than a plausible-looking one.
const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const HSR = { lat: 12.9116, lng: 77.6389 };
const INDIRANAGAR = { lat: 12.9733, lng: 77.6405 };

describe("haversineKm", () => {
  it("measures a known city distance", () => {
    // Koramangala 5th Block → HSR Layout is about 3 km on the ground.
    expect(haversineKm(KORAMANGALA, HSR)).toBeCloseTo(3.06, 1);
  });

  it("is symmetric", () => {
    expect(haversineKm(KORAMANGALA, INDIRANAGAR)).toBeCloseTo(haversineKm(INDIRANAGAR, KORAMANGALA), 10);
  });

  it("is zero for the same point", () => {
    expect(haversineKm(KORAMANGALA, { ...KORAMANGALA })).toBe(0);
  });

  it("handles antipodal points without NaN from floating-point drift", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(20015, 0);
  });
});

describe("offsetKm", () => {
  it("puts north above and east to the right", () => {
    const { north, east } = offsetKm(KORAMANGALA, INDIRANAGAR);
    expect(north).toBeGreaterThan(0); // Indiranagar is north
    expect(east).toBeGreaterThan(0); // and slightly east
  });

  it("agrees with haversine on magnitude", () => {
    const { north, east } = offsetKm(KORAMANGALA, HSR);
    expect(Math.hypot(north, east)).toBeCloseTo(haversineKm(KORAMANGALA, HSR), 1);
  });
});

describe("formatKm", () => {
  it("collapses very short distances", () => {
    expect(formatKm(0.02)).toBe("right here");
  });

  it("keeps one decimal under 10 km", () => {
    expect(formatKm(0.44)).toBe("0.4 km");
    expect(formatKm(3.06)).toBe("3.1 km");
  });

  it("rounds to whole kilometres at 10 and above", () => {
    expect(formatKm(12.4)).toBe("12 km");
  });

  it("returns empty for a non-finite distance rather than 'NaN km'", () => {
    expect(formatKm(Number.NaN)).toBe("");
  });
});

describe("radarPlacement", () => {
  const box = { w: 560, h: 520 };
  const base = { origin: KORAMANGALA, radiusKm: 3, ringPx: 235, box, size: 70 };

  it("keeps a far listing inside the box", () => {
    const p = radarPlacement({ ...base, point: { lat: 13.2, lng: 78.1 }, seed: "far" });
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left + base.size).toBeLessThanOrEqual(box.w);
    expect(p.top + base.size).toBeLessThanOrEqual(box.h);
  });

  it("pushes a listing at your own address clear of the centre pin", () => {
    const p = radarPlacement({ ...base, point: KORAMANGALA, seed: "same-spot" });
    const dx = p.left + base.size / 2 - box.w / 2;
    const dy = p.top + base.size / 2 - box.h / 2;
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(40);
  });

  it("is deterministic for the same listing", () => {
    const a = radarPlacement({ ...base, point: HSR, seed: "yamaha-f310" });
    const b = radarPlacement({ ...base, point: HSR, seed: "yamaha-f310" });
    expect(a).toEqual(b);
  });

  it("separates two listings at identical coordinates", () => {
    const a = radarPlacement({ ...base, point: HSR, seed: "listing-a" });
    const b = radarPlacement({ ...base, point: HSR, seed: "listing-b" });
    expect(Math.hypot(a.left - b.left, a.top - b.top)).toBeGreaterThan(0);
  });

  it("places nearer listings closer to the centre than far ones", () => {
    const near = radarPlacement({ ...base, point: { lat: 12.9375, lng: 77.6265 }, seed: "x" });
    const far = radarPlacement({ ...base, point: HSR, seed: "x" });
    const dist = (p: { left: number; top: number }) =>
      Math.hypot(p.left + base.size / 2 - box.w / 2, p.top + base.size / 2 - box.h / 2);
    expect(dist(near)).toBeLessThan(dist(far));
  });
});
