# Bech De — neighbourhood resale marketplace

Implementation of the Claude Design prototype (`../project/Bech De Prototype.dc.html`)
as a Next.js 16 + TypeScript app. A cozy, playful hyperlocal resale marketplace
for young Indians — the "radar" of nearby items is the signature feature.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the flow starts at signup:

signup → OTP → home (radar + radius slider) → map (radius/category filters)
→ product (story timeline, like) → chat (offer → deal → meet-up)
→ sell (live preview → publish) → profile (tabs; likes sync into Saved)

## Structure

- `src/lib/colors.ts` — color tokens from the mini design system sheet
- `src/lib/data.ts` — mock item/chat data (in-memory, no backend)
- `src/lib/store.tsx` — React context for cross-screen state (radius, likes, offer, sell form)
- `src/components/` — shared pieces (Header, radar bubbles, chips, cards, striped photo placeholders)
- `src/app/` — one route per screen; `(app)/` group shares the header shell

Design rules (fonts Bricolage Grotesque + Karla, cream `#FBF6ED` background,
pill buttons, dashed dividers, prices in clay `#B4552D`) follow
`../project/Bech De Design System.dc.html`.

Product photos are intentionally striped placeholders, same as the prototype —
swap in real imagery later.
