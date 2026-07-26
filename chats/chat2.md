# Bech De — prototype to production (build sessions)

_Started 2026-07-15 · last updated 2026-07-27_

A condensed log of the implementation work that followed the design handoff in
[`chat1.md`](./chat1.md). This is a summary of a long working session, not a verbatim
transcript: user messages are quoted as sent, the assistant side is compressed to what
was decided, built and verified.

Living documentation lives in the app, not here — see **`bechde/CLAUDE.md`** (architecture,
gotchas, prioritized next steps), **`bechde/DEPLOY.md`** (launch runbook) and
**`bechde/ROADMAP.md`** (phase-by-phase status).

---

## Session 1 — decide what "finish it" means

## User

> What all is left in this to deploy the website? Lets finish it. /plan

## Assistant

Audited the repo: a complete hi-fi prototype (all 7 screens working) with **everything
faked** — data in `src/lib/data.ts`, mutable state in a React context, OTP that accepted
any code, striped placeholder photos, distances from static numbers, a decorative search
bar.

Offered two honest paths and asked which: ship the prototype to Vercel as-is, or build the
real backend first.

**Chosen: build the real backend** (ROADMAP phases 0–5, Supabase).

Plan decisions baked in: email magic-link over phone OTP (free, no Twilio/DLT), and
client-side data hooks behind the existing screens rather than a rewrite to Server
Components. Dropped MapTiler — Leaflet + raw OSM tiles need no key.

---

## Session 2 — the backend

## User

> Create a supabase project yourself and integrate it.

## Assistant

Flagged the limit plainly: I can't create a cloud Supabase account — it needs email
verification and ToS acceptance under the user's identity. What I *could* do was stand up
the real thing locally.

## User

> Yes. do it using supabase cli

## Assistant

Installed colima (headless Docker), ran the full Supabase stack via the CLI, and built
**phases 0–3**:

- **Schema + RLS** (`0001_init.sql`): 8 tables, row-level security on every one, storage
  bucket, realtime publication.
- **Seed** (`supabase/seed.ts`): the prototype's 15 listings, 12 profiles and 4 chats,
  idempotent via deterministic UUIDs.
- **Data layer** (`src/lib/queries.ts`): hooks mirroring the old `data.ts` export names,
  so screen edits stayed mechanical.
- **Auth**: email magic-link → `/auth/confirm`. Reading the Next 16 docs first caught that
  `middleware` is now **`proxy`** — `src/proxy.ts` gates routes and refreshes sessions.
  `handle_new_user` links a new login to a seeded profile by email, so signing in as
  `aisha@bechde.local` inherits the demo chats.
- **Sell flow**: real photo upload to Storage, real listing insert, `Stripe` gained an
  `src` prop so uploads replace the stripes.

Verified at query and HTTP level (the browser extension was unavailable): unauth `/home`
→ 307, magic-link round trip → session cookie, Aisha's chats 0 → 4 after sign-in.

## User

> Yes, lets move on now.

_(then, later)_ > Continue. · > continue with the previous steps

## Assistant

**Phase 4 — location & real distances.** `src/lib/geo.ts` (haversine, `formatKm`,
`radarPlacement`), browser geolocation persisted to `profiles`, a Nominatim proxy at
`/api/geocode` so it can send a proper User-Agent. Distances became **read-time
computations from the viewer's position**; the radar started placing bubbles from real
coordinates, which meant new listings could finally appear on it.

**Phase 5 — live chat, offers, likes.** `useConversation` with Supabase Realtime,
message/offer timeline, accept/decline, likes moved to `saved_items`. Verified with two
real signed-in parties: message and offer events delivered live, an outsider saw zero
rows, likes survived.

> A test harness detail worth remembering: leave ~1.5 s after `SUBSCRIBED` before
> asserting, or the subscription isn't registered and the event is missed.

---

## Session 3 — search

## User

> What next? /plan

Chosen: **Phase 6 only**, full-text **plus saved searches**, and "I'll paste real details"
for the legal pages.

## Assistant

`0003_search.sql`: generated `tsvector` and `price_num` columns, GIN indexes, and
`search_listings(q)` — full-text with a fuzzy fallback so "gitar" finds the guitar. Two
things went differently than planned and are now documented: `SET
pg_trgm.word_similarity_threshold` inside a function is **denied** on Supabase (not a
superuser), so the threshold is compared explicitly; and PostgREST *does* support
embedding and filtering on a `setof table` RPC, so no fallback was needed.

Built `/search` (URL-driven, shareable), made the header search bar real, wired the map's
decorative ₹min/₹max boxes, and added saved searches that count new matches since saving.
Deleted `mapCategoryNames`, which had silently omitted "Music" — guitars were
unfilterable. Also derived `listedAgo` from `created_at` and back-dated the seed, since
every new listing had read "listed just now" forever.

---

## Session 4 — trust, safety, shipping prep

## User

> Continue. No questions asked. Lets move on and finish the project.

## Assistant

Proceeded without further questions, which meant the legal pages shipped with clearly
marked placeholders instead of the real details — flagged prominently, with a draft banner
that clears itself once `src/lib/legal.ts` is filled in.

**Phase 7:** `reports` and `blocks`, both **enforced in RLS rather than the UI**;
withdrawing a listing became a status change so chat history survives; prohibited-items
list; DPDP-shaped privacy policy, terms and grievance contact.

> One bug worth the retelling: the first version of "has someone blocked me?" read the
> `blocks` table inline inside the policy. That runs as the *sender*, and `blocks` is
> scoped to the *blocker* — so it read zero rows, concluded "not blocked", and let blocked
> users keep messaging. Fixed with a `SECURITY DEFINER` helper, `is_blocked_by()`. Review
> would not have caught it; a test did.

**Phase 8:** generated OG image via `next/og`, full metadata, error boundaries (Next 16
renamed `reset` → `unstable_retry`), and **`DEPLOY.md`** — the runbook plus an honest
"known gaps at launch" list. Sentry was left unwired rather than half-wired; it needs the
user's account.

Dropped the whole database and rebuilt from scratch to prove all four migrations apply
clean, then re-seeded and re-verified every phase.

---

## Session 5 — reputation, then hardening

## User

> What next? /plan

Chosen: **both, reputation first**, with the full review flow and everything derived.

## Assistant

**Part 1 — reputation.** `0005_reviews.sql`: reviews gated on an accepted offer (one per
side), `chat_reads` for a real unread badge, and `rating_avg` / `sold` / `reply_time`
maintained by **triggers**. The seed stopped writing those columns and instead seeds six
*past deals* — sold listing, chat, accepted offer, review — so the demo's numbers trace to
rows. Removed the last invented UI: the fake reviews tab, three invented badges (only the
derivable two survive), "phone verified" (now "email verified", which is true), the
hardcoded joined date and bio, four fake gallery thumbs, the `2` chat badge, "~40 people
nearby", and "sold for ₹2,800–3,500" (now real percentiles that hide under 3 comparables).

**Part 2 — tests, CI, accessibility.** 42 unit tests, a 21-test RLS suite, 16 Playwright
tests with an axe pass, and GitHub Actions. The RLS suite was mutation-tested: reinstating
the blocking bug makes it fail.

The browser tests immediately found **two real bugs that every previous check had
missed**:

1. **Sign-in was broken for real users.** `@supabase/ssr` hard-codes the PKCE flow, so the
   emailed token is `pkce_…`, which `verifyOtp` can't redeem. My earlier verifications
   used Node clients on the implicit flow — hex tokens, which worked. Fixed by linking to
   `{{ .ConfirmationURL }}` and exchanging the code server-side. Caveat now documented: a
   magic link only works in the browser that requested it.
2. **The palette failed WCAG AA.** `textFaint` was 2.8:1 and `textMuted` 3.9:1 — serious
   violations on every screen. Tokens darkened.

Also converted `Button`/`Chip`/`Hoverable`/`ReportDialog` to real buttons, added a skip
link, focus ring and dialog focus trap. First actual screenshots of the finished app came
out of this run.

---

## Session 6 — handover

## User

> Completely Update the claude.md file with whatever we have already covered and prepare a
> detailed list of things and what needs to be done in those things. I will use gemini to
> finish the work for next two days.
>
> Also save the chats and also update the roadmap and readme and any other such document.

## Assistant

Rewrote **`bechde/CLAUDE.md`** as a self-contained brief (Gemini won't resolve Claude's
`@import` syntax): what exists, how the data flows, the gotchas above, and a prioritized
work list with acceptance criteria — P0 moderation surface, unbounded photo upload,
missing pagination; P1 live chat list, saved-search emails, finishing the a11y sweep,
abuse limits; P2 a dozen smaller items. Refreshed `ROADMAP.md`, both `README.md`s and
this log.

---

## Where it stands

**Phases 0–9 complete and verified locally.** Nothing a user sees is mocked. `tsc`, lint
(zero warnings), 42 unit + 21 RLS + 16 E2E tests, and `build` all pass.

Not done, and deliberately so — it needs the user's own accounts: the cloud Supabase
project (ap-south-1), Vercel, a real SMTP provider, a domain, and the five operator fields
in `src/lib/legal.ts`.
