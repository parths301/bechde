// Relative recency, so listings don't say "listed just now" forever.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "listed just now" / "listed 4 days ago" / "listed 3 weeks ago". */
export function listedAgo(iso?: string, fallback = ""): string {
  if (!iso) return fallback;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return fallback;
  const ms = Date.now() - then;
  if (ms < 0) return "listed just now";
  if (ms < 5 * MINUTE) return "listed just now";
  if (ms < HOUR) return `listed ${Math.round(ms / MINUTE)} min ago`;
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `listed ${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  if (ms < 2 * DAY) return "listed yesterday";
  if (ms < 7 * DAY) return `listed ${Math.round(ms / DAY)} days ago`;
  if (ms < 30 * DAY) {
    const w = Math.round(ms / (7 * DAY));
    return `listed ${w} ${w === 1 ? "week" : "weeks"} ago`;
  }
  const mo = Math.round(ms / (30 * DAY));
  return `listed ${mo} ${mo === 1 ? "month" : "months"} ago`;
}
