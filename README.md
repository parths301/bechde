# Bech De — repository guide

**The app is built.** This started as a handoff bundle from Claude Design
(claude.ai/design); the designs in `project/` have since been implemented as a real
Next.js + Supabase application in **`bechde/`**.

## CODING AGENTS: READ THIS FIRST

👉 **Start with [`bechde/CLAUDE.md`](./bechde/CLAUDE.md).** It is the current source of
truth: architecture, every subsystem, the gotchas that cost real time, and a prioritized
list of what to do next with acceptance criteria. Read it before touching code.

Then, depending on what you're doing:

| You want to… | Read |
|---|---|
| Understand or change the app | [`bechde/CLAUDE.md`](./bechde/CLAUDE.md) |
| Run it locally | [`bechde/README.md`](./bechde/README.md) |
| Deploy it | [`bechde/DEPLOY.md`](./bechde/DEPLOY.md) |
| See what's done per phase | [`bechde/ROADMAP.md`](./bechde/ROADMAP.md) |
| Know what the user actually asked for | `chats/` (see below) |
| Check a visual detail against the design | `project/*.dc.html` |

⚠️ The app runs on **Next.js 16**, which has breaking changes from earlier versions
(`middleware` → `proxy`, and more). Read `bechde/node_modules/next/dist/docs/` before
writing code — `bechde/CLAUDE.md` lists the traps already hit.

## Bundle contents

- **`bechde/`** — the real application (Next.js 16, TypeScript, Supabase, Leaflet/OSM).
  This is where the work happens.
- **`chats/`** — conversation transcripts. `chat1.md` is the original design session, where
  the user's intent lives; `chat2.md` logs the build from prototype to production,
  including the decisions and the bugs worth remembering.
- **`project/`** — the original HTML/CSS prototypes from the design tool. Still the
  reference for visual detail, and the design language (Bricolage Grotesque + Karla, cream
  `#FBF6ED`, pill buttons, dashed dividers) is fixed and should be respected. Note the
  prototypes contain placeholder data and invented numbers — the app deliberately does not.

## Status in one paragraph

A hyperlocal second-hand marketplace for India, with a radar of nearby listings as its
signature screen. Auth (email magic-link), listings with photo upload, real geographic
distances, ranked and typo-tolerant search with saved searches, live chat with offers and
accept/decline, reviews that drive derived seller reputation, reporting and blocking
enforced in row-level security, and DPDP-shaped legal pages. Covered by 42 unit tests, a
21-test RLS suite and 16 Playwright end-to-end tests with an accessibility pass, plus CI.
**Not yet deployed** — that needs accounts only the owner can create (Supabase cloud,
Vercel, SMTP, domain) and the operator details filled into `bechde/src/lib/legal.ts`. See
[`bechde/DEPLOY.md`](./bechde/DEPLOY.md).
