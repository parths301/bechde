import { describe, it, expect } from "vitest";
import { haversineKm, offsetKm, formatKm, radarPlacement, radarPlacements } from "./geo";

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

  it("never leaves the box, for any seed or distance", () => {
    const points = [KORAMANGALA, HSR, INDIRANAGAR, { lat: 13.4, lng: 78.3 }];
    for (const point of points) {
      for (let i = 0; i < 40; i++) {
        const p = radarPlacement({ ...base, point, seed: `seed-${i}` });
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.left + base.size).toBeLessThanOrEqual(box.w);
        expect(p.top + base.size).toBeLessThanOrEqual(box.h);
      }
    }
  });
});

describe("radarPlacements", () => {
  const box = { w: 560, h: 520 };
  const shared = { origin: KORAMANGALA, radiusKm: 3, ringPx: 235, box };
  const sizes = [78, 75, 72, 69, 66, 63, 60];

  /** Smallest edge-to-edge gap in a placed set; negative means the bubbles overlap. */
  function tightestGap(
    placed: Array<{ left: number; top: number }>,
    itemSizes: number[]
  ): number {
    let worst = Infinity;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = Math.hypot(
          placed[i].left + itemSizes[i] / 2 - (placed[j].left + itemSizes[j] / 2),
          placed[i].top + itemSizes[i] / 2 - (placed[j].top + itemSizes[j] / 2)
        );
        worst = Math.min(worst, d - (itemSizes[i] + itemSizes[j]) / 2);
      }
    }
    return worst;
  }

  it("keeps seven listings in one neighbourhood from overlapping", () => {
    // All within ~400m of each other — the crowding case the radar actually hits.
    const items = sizes.map((size, i) => ({
      seed: `crowd-${i}`,
      point: { lat: KORAMANGALA.lat + i * 0.0006, lng: KORAMANGALA.lng + i * 0.0004 },
      size,
    }));
    expect(tightestGap(radarPlacements(items, shared), sizes)).toBeGreaterThan(0);
  });

  it("separates listings at byte-identical coordinates", () => {
    const items = sizes.slice(0, 5).map((size, i) => ({ seed: `same-${i}`, point: HSR, size }));
    const s = sizes.slice(0, 5);
    expect(tightestGap(radarPlacements(items, shared), s)).toBeGreaterThan(0);
  });

  it("separates listings that all clamp to the outer ring", () => {
    const far = { lat: 13.4, lng: 78.3 };
    const items = sizes.slice(0, 5).map((size, i) => ({ seed: `far-${i}`, point: far, size }));
    const s = sizes.slice(0, 5);
    expect(tightestGap(radarPlacements(items, shared), s)).toBeGreaterThan(0);
  });

  it("keeps every bubble inside the box", () => {
    const items = sizes.map((size, i) => ({
      seed: `box-${i}`,
      point: { lat: KORAMANGALA.lat + i * 0.0005, lng: KORAMANGALA.lng },
      size,
    }));
    radarPlacements(items, shared).forEach((p, i) => {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.left + sizes[i]).toBeLessThanOrEqual(box.w);
      expect(p.top + sizes[i]).toBeLessThanOrEqual(box.h);
    });
  });

  it("is deterministic", () => {
    const items = sizes.map((size, i) => ({ seed: `d-${i}`, point: HSR, size }));
    expect(radarPlacements(items, shared)).toEqual(radarPlacements(items, shared));
  });

  it("still puts nearer listings closer to the centre", () => {
    const [near, far] = radarPlacements(
      [
        { seed: "near", point: { lat: 12.9375, lng: 77.6265 }, size: 70 },
        { seed: "far", point: INDIRANAGAR, size: 70 },
      ],
      shared
    );
    const d = (p: { left: number; top: number }) =>
      Math.hypot(p.left + 35 - box.w / 2, p.top + 35 - box.h / 2);
    expect(d(near)).toBeLessThan(d(far));
  });
});
