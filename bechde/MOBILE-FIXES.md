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

### 5 · Location sheet — 520px wide on a 390px phone
*Screenshots: 01.14.48(1) (landscape), 01.14.52(1) (portrait), plus a follow-up report*

The sheet sat hard against the left edge with its right side cut off, and in landscape
the `Popular Cities` list ran off the bottom with **no way to scroll to it**.

This one took two passes, and the first pass was wrong in an instructive way.

**First attempt:** added `minWidth: 0`, `maxHeight: calc(100dvh - 40px)` and
`overflowY: auto`. That fixed the landscape height problem — and I verified it at
915 × 412 only. It looked correct.

**It wasn't.** The sheet was still **520px wide on a 390px viewport**, spanning 20–540.
520px simply *fits* inside 915px, so the test I wrote couldn't see the bug.

**Actual cause:** the overlay was `display: grid` with `place-items: center`. That makes
an implicit auto-sized column, and an auto column takes its width **from its item** — so
the column became 520px, and the sheet's `max-width: 100%` resolved against *its own*
520px and constrained nothing. A percentage max-width is only a constraint if the thing
it's a percentage *of* is independently sized.

**Fix:** overlay switched to flex centring, whose content box is the real available
width, and the sheet is now `width: 100%` / `maxWidth: 520` —
`src/components/LocationModal.tsx`.

**Test gap closed:** the sheet check now runs at 360px, 390px and 915px. Mutation-tested
— restoring the grid overlay fails the two narrow viewports with
`sheet spans 20–540 in a 390px viewport` while 915px still passes, which is exactly how
it slipped through the first time.

### 5b · The location chip wasn't a button
Found while writing the test above: the `📍 Select location / city` chip was a
`<div onClick>`, so it was unreachable by keyboard and announced as nothing. It opens a
dialog. Now a real `<button>` with `aria-haspopup="dialog"` and a label that includes the
current location, and it truncates rather than overflowing — `src/components/LocationChip.tsx`.

### 5c · The hero map on phones plotted no listings at all
*Reported from the device after the fixes above*

On phones the radar is hidden and a square map takes its place. It was rendering as an
empty street map with a single "you" pin — directly above a feed announcing items
**0.1 km away**.

**Cause:** the `<OsmMap>` in `.bd-hero-mobilemap` was never passed a `markers` prop, so
it defaulted to `[]`. Nothing errored; the content was simply absent. The desktop radar
got its bubbles from `radarPlacements`, and the mobile substitute was never wired to the
same data.

**Fix:** it now plots every nearby listing, and a pin opens the listing the same way a
radar bubble does on desktop — `src/app/(app)/home/page.tsx`.

**Test:** `e2e/mobile.spec.ts` asserts the pin count **equals the number claimed in the
hero pill**, so the map and the copy can't disagree again, and that tapping a pin
navigates. Mutation-tested by removing the `markers` prop.

### 5d · Sell button was clickable before the profile loaded
Found when the sell E2E started racing: clicking "Bech de! →" before `useProfile()`
resolved did nothing except print *"Still loading your profile — try again in a moment"*.
The button is now disabled until the profile is ready, reading "One moment…" — matching
how it already behaves during a photo upload.

### 5e · Every map now speaks the radar's language
*Requested from the device: "this is how I want all map screens to look — not with a pin
symbol dropped"*

The home radar shows listings as round cover-photo bubbles with the item name and a price
pill. Every other map used a generic teardrop pin, so the app had two visual languages for
the same thing.

**Change:** `OsmMap` markers are now radar bubbles — circular photo (striped placeholder
with the short label when there's no photo), price on a pill underneath, anchored on the
bubble's **centre** rather than a pin tip, because the circle marks the spot. Applied
everywhere at once, so `/map` and the phone hero map match the radar on desktop and
mobile alike — `src/components/OsmMap.tsx`.

**A second bug this exposed:** `/map` opened at zoom 12 — the whole of Bengaluru — for a
3 km radius, so every bubble collapsed into one unreadable pile in the middle. The map now
frames the radius ring, refitting only when the radius actually changes so it doesn't
fight your own panning. (First attempt used `L.circle().getBounds()`, which throws — a
circle that isn't on a map has no projection. Bounds are computed arithmetically instead.)

The "you" marker is also raised above the bubbles now; listings clustered around you
buried the one fixed point of reference on the map.

**Trade-off on `/map`:** bubbles are much larger than pins and sit at their **true
coordinates** — no radar-style relaxation, because on a real map that would misreport
where an item is. Listings a few hundred metres apart therefore overlap. Price pills hide
themselves when they collide, so the visible labels stay readable.

### 5f · …and the phone hero now shows the real radar, not an approximation of it
*Follow-up: "I want this map to look like this, the way it is shown on the bigger screens"*

Putting bubble markers on the phone hero map wasn't enough. Measured on a 375px screen,
four bubbles landed at x = 154, 162, 165, 170 — essentially stacked. The desktop radar
looks spacious because **it isn't a map**: `radarPlacements` relaxes the bubbles apart in
screen space. A map can't do that without lying about where things are.

So phones now show **the actual radar**, not a lookalike: same rings, same relaxation,
same centre pin, scaled down as one piece. The radar's layout is hard-coded to 560 × 520
(ring radii, bubble sizes, the relaxation box), and rather than rebuild that maths for
small screens, the whole thing is measured and scaled — so a phone renders the identical
component.

- CSS supplies an approximate scale immediately, so the radar is never painted at 560px
  inside a 343px column even for one frame; a `ResizeObserver` then refines it to the
  exact measured width. Written straight to the DOM — it's a measurement, not state.
- On desktop the wrapper is `display: contents`, so the layout is untouched.
- The radius pill that lives *inside* the radar is hidden on phones (scaled down it'd be
  unusable); the existing full-width control takes over.

### 5g · The radar ignored `prefers-reduced-motion`
Found because the E2E click kept timing out: seven bubbles bob forever, so their boxes
never settle. That's not just a test problem — continuous motion like that is a common
vestibular trigger, and the app was overriding the OS setting.

The bob is now declared in CSS under `@media (prefers-reduced-motion: no-preference)`
with per-bubble duration and delay passed as custom properties, so **motion is opt-in**
rather than something you have to override away. The `.bd-you-pulse` ring follows the
same rule.

Playwright's own `reducedMotion: "reduce"` emulation turned out not to apply in this
setup — `matchMedia` still reported `false` — so the spec stops the animation directly
and says why, rather than leaving a config line that looks like it works.

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

### 9 · `/login` — the card was 960px wide on a 393px phone

*Reported later, from a phone screenshot: the sign-in card hanging two-thirds off the
right edge, everything at desktop scale.*

Measured at three phone widths, the page was **990px wide regardless of viewport** — the
card rendered at its literal `width: 960px` on a 360px, 393px and 430px screen alike.

```
=== 393px  doc=393 bodyScroll=990
DIV.bd-login-card  w:960  right:990
```

**Why `maxWidth: "100%"` did nothing.** The wrapper was `display: grid; placeItems:
center` with no explicit template, so it had one **auto** track. An auto track sizes to
its item's max-content — 960px — and grid tracks are free to overflow their container.
`max-width: 100%` on the card then resolved *against that 960px track*, so the clamp
referred to its own cause and constrained nothing.

This is the identical trap as the location sheet in §5, in a different place. A flex
container's content box is the real available width, so the same one-line change fixes
it: `display: flex; align-items: center; justify-content: center`.

The mobile breakpoint's `.bd-login-card { grid-template-columns: 1fr }` had been working
correctly all along — the panels *were* stacked. They were stacked inside a 960px box.

Once it fit, two things were still desktop-scale and needed a mobile band: 30px of page
padding either side (15% of a 360px screen) with 44/40px panel padding, and a 38px
heading whose hand-written line break "second life waiting" cannot reflow its way out of
an overflow. Reduced to 16px / 26×20px / 27px. The decorative dashed rings, positioned
for a tall desktop panel, ran straight through the feature list in the short stacked one;
nudged out and dimmed.

**Why the existing overflow guard never caught it.** `ROUTES` in `responsive.spec.ts`
omits `/login`, and not by oversight that could simply be corrected — the E2E suite shares
one signed-in `storageState`, and `src/proxy.ts:41` redirects an authenticated visitor
from `/login` to `/home`. The one page every new user sees first was structurally
unreachable by the test that would have caught this. It now has its own
`test.use({ storageState: { cookies: [], origins: [] } })` block, and asserts the card's
right edge as well as `body.scrollWidth` — a page-level check alone would pass on a card
that was merely being clipped.

Mutation-tested: restoring `display: grid` fails all four phone viewports
(*"/login at 393px overflows by 597px (card is 960px wide)"*) and correctly still passes
at 1280px.

---

## Verification

`e2e/responsive.spec.ts` — 7 routes × 5 viewports, asserting `body.scrollWidth` never
exceeds the viewport, plus `/login` as a guest at those same 5 viewports, plus the
location sheet measured on its own at three widths (it's `position: fixed`, so it escapes
the page-level check entirely).

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
npm test            66 passed
npx playwright test 32 passed  (18 existing + 14 new)
npm run build       clean
```

Database left as seeded: 14 active + 7 sold listings.

---

## Note on deployment

These fixes are local. The screenshots came from `bechde.vercel.app`, which is running an
older build — so some of what they show (the radar overlap especially) is already fixed in
the repo but not yet live. Deploying is still gated on the hosted-database reconciliation
described in `HANDOVER.md`.
