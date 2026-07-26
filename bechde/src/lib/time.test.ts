import { describe, it, expect } from "vitest";
import { listedAgo } from "./time";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("listedAgo", () => {
  it("reads as just now for a fresh listing", () => {
    expect(listedAgo(ago(30_000))).toBe("listed just now");
  });

  it("switches to minutes, then hours, then days", () => {
    expect(listedAgo(ago(20 * MIN))).toBe("listed 20 min ago");
    expect(listedAgo(ago(3 * HOUR))).toBe("listed 3 hours ago");
    expect(listedAgo(ago(4 * DAY))).toBe("listed 4 days ago");
  });

  it("singularises one hour and says yesterday", () => {
    expect(listedAgo(ago(HOUR))).toBe("listed 1 hour ago");
    expect(listedAgo(ago(30 * HOUR))).toBe("listed yesterday");
  });

  it("rolls up to weeks and months", () => {
    expect(listedAgo(ago(14 * DAY))).toBe("listed 2 weeks ago");
    expect(listedAgo(ago(90 * DAY))).toBe("listed 3 months ago");
  });

  it("never shows a negative age for a clock-skewed future timestamp", () => {
    expect(listedAgo(new Date(Date.now() + 60_000).toISOString())).toBe("listed just now");
  });

  it("falls back when there's no usable timestamp", () => {
    expect(listedAgo(undefined, "listed 2 days ago")).toBe("listed 2 days ago");
    expect(listedAgo("not-a-date", "listed 2 days ago")).toBe("listed 2 days ago");
    expect(listedAgo(undefined)).toBe("");
  });
});
