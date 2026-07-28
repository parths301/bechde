# Mobile view — errors found and fixed

**Date: 2026-07-29** · Source: 14 screenshots from a real Android device (portrait and
landscape) against `bechde.vercel.app`.

Every issue in those screenshots was reproduced locally at the exact viewport, fixed at
the cause, and is now covered by `e2e/responsive.spec.ts` — which I mutation-tested by
reverting the main fix and confirming it fails.

---

## The one root cause behind most of it

Eleven of the fourteen screenshots showed the same thing from different angles: **content
running off the right edge of the screen and being cut off.**

The cause is a CSS default almost nobody expects. Grid and flex items are
`min-width: auto`, which means **a column will not shrink below the widest un-wrappable
thing inside it.** One nowrap chip — `Delhi NCR (Connaught Place)`, `Bengaluru
(Koramangala)`, the `1 km … 10 km` scale — was enough to force an entire page to **472px
wide on a 390px screen.**

What made it invisible rather than obvious: `html, body { overflow-x: hidden }`. The page
couldn't scroll sideways to reveal the overflow, so it silently **cropped its own right
edge**, and everything living there became unreachable. Nothing looked broken — things
were just *missing*.

Measured before the fix:

| Route | Viewport | Page width | Overflow |
|---|---|---|---|
| `/map` | 390px | 472px | **+82px** |
| `/search` | 390px | 472px | **+82px** |
| `/product/[id]` | 390px | 414px | **+24px** |
| `/home` | 390px | 405px | **+15px** |

---

## Each error, and what was actually wrong

### 1 · `/map` — the radius value, scale and filters were cut off
*Screenshots: 01.14.49(1), 01.14.49(2), 01.14.50, 01.14.50(1)*

`Radius` showed a truncated `3` instead of `3 km`; the `10 km` end of the scale read
`1`; the `Music` category chip, the `₹ max` price field, `Save this search` and
`Back to home` were all sliced down the middle; the Leaflet attribution was clipped.

**Cause:** `.bd-map-grid`'s single mobile column couldn't shrink below the min-content
width of the filter rail (472px).
**Fix:** `min-width: 0` on the mobile grid children — `src/app/globals.css`.

### 2 · `/search` — same rail, same clipping
*Same root cause and fix. 472px → 390px.*

### 3 · `/product/[id]` — "Make an offer" and half the spec cards cut off
*Screenshots: 01.14.51, 01.14.51(1)*

`Make an offer`, and the `DIAMETER` / `REASON` cards, were clipped at the right.

**Cause:** the gallery thumbnail row. Four `Thumb`s at a fixed `width: 88` plus gaps and
borders is 398px inside a 358px column, and they refused to shrink.
**Fix:** thumbs now share the row (`flex: 1 1 0`, `minWidth: 0`, `maxWidth: 88`) —
`src/app/(app)/product/[id]/ProductClient.tsx`.

> This one was nearly missed: my first audit reported `/product` as clean because the
> test URL 404'd. Re-run with a real listing id, it overflowed by 24px.

### 4 · `/home` — the search bar pushed the page 15px too wide
*Screenshot: 01.14.52*

The hero paragraph and the search bar ran past the right edge.

**Cause:** the location button inside `SearchBar` was `flex: none` with
`whiteSpace: nowrap`, holding a long place name. It could not shrink, so it widened
everything above it.
**Fix:** the button now truncates with an ellipsis (`flexShrink: 1`, `minWidth: 0`,
`overflow: hidden`, `maxWidth: 45%`) and the bar itself got `minWidth: 0` —
`src/components/Header.tsx`.

### 5 · Location sheet — flush left, right half off-screen, unscrollable
*Screenshots: 01.14.48(1) (landscape), 01.14.52(1) (portrait)*

The modal sat hard against the left edge with its right side cut off, and in landscape
the `Popular Cities` list ran off the bottom with **no way to scroll to it**.

**Cause:** two things. `maxWidth: 100%` couldn't win against the city chips' min-content
width, and the sheet had no height cap.
**Fix:** `minWidth: 0`, plus `maxHeight: calc(100dvh - 40px)` and `overflowY: auto` so
the list scrolls inside the sheet on a 412px-tall landscape screen —
`src/components/LocationModal.tsx`.

### 6 · Landscape header — wordmark on two lines, "Sign in" off-screen
*Screenshots: 01.14.48, 01.14.49*

At ~915px the desktop header applied but didn't fit: `Bech De.` broke onto two lines,
the `+ Bech de!` pill onto three, `Radar` stacked under its icon, and `Sign in` fell off
the right edge entirely.

**Cause:** a gap between the breakpoints. Below 820px the mobile layout hides the nav;
above that the desktop header assumed desktop spacing. A landscape phone lands in
between.
**Fix:** a new `821px–1080px` band that tightens header gaps and padding and applies
`white-space: nowrap` to the labels, which are labels and should never wrap —
`src/app/globals.css`.

### 7 · `/map` — price labels stacked into an unreadable pile
*Screenshots: 01.14.49(1), 01.14.49(2)*

Eight or nine black price capsules drawn on top of each other around Koramangala.

**Cause:** every pill renders at the same offset above its pin, so listings a few hundred
metres apart overlap at normal zoom.
**Fix:** collision detection in `src/components/OsmMap.tsx`. Pins **stay at their true
coordinates** — moving them would misreport where an item is — and instead the *pill* is
hidden on markers that collide with one already shown, north-first. The pin remains
visible and tappable, and zooming in brings the prices back. Nine overlapping pills → three
legible ones.

> I first also reserved the pin rectangles, so a pill couldn't land on a neighbouring
> pin. That hid **every** price in a dense cluster, which is worse than the overlap it
> prevented. Reverted to pill-vs-pill, and the reason is a comment in the code.

### 8 · Home radar — bubbles overlapping
*Screenshot: 01.14.48*

Already fixed before these screenshots were taken, but not yet deployed: `radarPlacements`
replaced the per-bubble random nudge with sibling-aware relaxation. Production is running
the older build.

---

## Verification

`e2e/responsive.spec.ts` — 7 routes × 5 viewports, asserting `body.scrollWidth` never
exceeds the viewport, plus a check that the location sheet fits and scrolls in landscape.

| Viewport | Result |
|---|---|
| 360 × 780 (small phone) | pass |
| 390 × 844 (phone) | pass |
| 430 × 932 (large phone) | pass |
| 915 × 412 (phone landscape) | pass |
| 1280 × 800 (desktop) | pass |

On failure it names the offending elements, so the next person doesn't have to rediscover
`min-width: auto`.

```
npm run lint        zero errors and warnings
npx tsc --noEmit    clean
npm test            60 passed
npx playwright test 24 passed  (18 existing + 6 new)
npm run build       clean
```

Database left as seeded: 14 active + 7 sold listings.

---

## Note on deployment

These fixes are local. The screenshots came from `bechde.vercel.app`, which is running an
older build — so some of what they show (the radar overlap especially) is already fixed in
the repo but not yet live. Deploying is still gated on the hosted-database reconciliation
described in `HANDOVER.md`.
