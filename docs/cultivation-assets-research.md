# Free UI assets for cultivation gamification — research

Sources for icons, patterns, and effects to build the cultivation layer
([`cultivation-gamify.md`](./cultivation-gamify.md)). Researched 2026-09-15.

## Hard constraint: offline + public repo

Two constraints shape every choice below:

- **Offline-first PWA.** `sw.js` caches assets; there is no runtime CDN. Everything must be
  **vendored into the repo** — inline SVG in markup, or a self-hosted font/file — not
  pulled from a CDN at runtime.
- **Public GitHub repo.** Licenses must permit redistribution. Attribution-required assets
  (CC BY) are fine but need a `CREDITS`/`NOTICE` entry. Prefer **CC0 / MIT / public domain**
  where possible to avoid the attribution burden; use CC BY where the asset is worth it.

## Icons

### game-icons.net — primary recommendation
- **What:** 4,170+ bold, high-contrast monochrome SVG game icons — swords, pills, potions,
  scrolls, talismans, beasts, gems. Covers essentially every cultivation prop (pill 丹药,
  sword 剑, talisman 符, spirit pet, spirit stone).
- **License:** **CC BY 3.0** — free commercial use, recolorable, **attribution required**.
  Single license across the whole set. Credit format: `Icon made by {author}, available on
  https://game-icons.net`. Per-icon author is shown on each icon's page.
- **How to use:** download individual SVGs, recolor to the app's jade/ink palette via
  `fill`/`currentColor`, inline them. Record each icon + author in a repo `CREDITS.md`.
- **Verdict:** best single source. Attribution cost is one credits file.
- https://game-icons.net/ · about/license: https://game-icons.net/about.html

### RPG-Awesome — fallback, not preferred
- Fantasy-themed **icon font** + CSS toolkit. Font is **SIL OFL 1.1**, CSS/SASS **MIT**,
  attribution appreciated not required.
- **Downside:** it's a webfont (heavier, less crisp, harder to recolor per-glyph) vs inline
  SVG. Only reach for it if you want a large icon set without vendoring many files.
- https://github.com/nagoshiashumari/Rpg-Awesome

### MIT UI icon sets (for chrome, not theme)
For non-thematic UI bits (close, chevron, check) use a permissive **MIT** set and inline the
few SVGs needed: Tabler Icons, Heroicons, Bootstrap Icons. No attribution required.

### OpenGameArt CC0
- OpenGameArt has a CC0 section with RPG icon packs (no attribution). Quality varies; useful
  for a spirit-pet sprite or pill art if game-icons.net lacks the exact thing.
- https://opengameart.org/content/cc0-resources
- Shikashi's Fantasy Icons Pack (itch.io, free tier) — pixel RPG item icons, check the
  specific pack's license before use.

## Background patterns (云纹 / ornamental)

Use a subtle repeating SVG behind the path header or breakthrough banner. Generators output
plain SVG/CSS you paste and vendor — no runtime dependency.

- **Pattern Monster** — large tileable SVG pattern library, code repo **MIT**, patterns free
  for commercial use. Good for geometric/cloud-like tiles. https://pattern.monster/
- **Hero Patterns** — repeatable SVG backgrounds, **MIT**. https://heropatterns.com/
- **fffuel.co** — free SVG generators (seamless patterns, gradients, blobs, noise). Output is
  yours to use; confirm per-tool note. https://www.fffuel.co/
- **SVG Silh** — **CC0** silhouettes/patterns, no attribution. https://svgsilh.com/
- For genuine Chinese cloud (云纹) motifs, generators give abstract tiles; a bespoke hand-authored
  云纹 path (public-domain motif, drawn fresh) avoids stock-license questions entirely and is
  cheap to author as inline SVG.

## Effects (breakthrough celebration) — all CSS-only, zero assets

The breakthrough moment needs no library and no images. Pure CSS keeps it offline-safe:

- **Aura / glow:** layered `box-shadow` (outer + inner) and `text-shadow` for the realm name;
  animate with `@keyframes` pulsing opacity/blur for a "qi surge."
- **Radiant burst:** a pseudo-element with a `conic-gradient` or `radial-gradient` rotated via
  `transform` + `@keyframes` behind the banner (echoes the existing `.ring` conic-gradient in
  `app.css:622`).
- **Particles:** multiple `box-shadow` dots on one element, animated upward with
  `hue-rotate` — cheap "spirit motes" without JS.
- Reference galleries for snippets: DevSnap CSS glow effects, CSS-Tricks/Speckyboy glow
  roundups. Copy technique, not code wholesale.
- https://devsnap.me/css-glow-effects · https://speckyboy.com/glow-effects-css-javascript/

## Recommended stack

| Need | Pick | License | Cost |
|---|---|---|---|
| Thematic icons (pills, swords, talismans) | game-icons.net, inlined + recolored | CC BY 3.0 | one `CREDITS.md` |
| UI chrome icons | Tabler / Heroicons, inlined | MIT | none |
| Header/banner pattern | hand-drawn 云纹 SVG, or Pattern Monster | original / MIT | none |
| Breakthrough effect | pure CSS glow + gradient burst | n/a | none |
| Spirit-pet art (Phase 2, optional) | OpenGameArt CC0, or commissioned/drawn | CC0 | none |

**Bottom line:** almost the entire visual layer can be **CC0/MIT with no attribution**,
except game-icons.net (CC BY, one credits file). Nothing requires a runtime CDN — everything
vendors into the repo and caches through `sw.js`.

## Action items when building

1. Create `CREDITS.md` (or a `## Credits` section in README) before adding any CC BY icon.
2. Vendor SVGs under an assets path (e.g. `assets/icons/`) and add to the `sw.js` precache list.
3. Recolor icons to `currentColor` so they inherit the jade/ink theme and dark mode.

## Sources

- game-icons.net (CC BY 3.0): https://game-icons.net/ , https://game-icons.net/about.html
- RPG-Awesome (OFL 1.1 / MIT): https://github.com/nagoshiashumari/Rpg-Awesome
- OpenGameArt CC0: https://opengameart.org/content/cc0-resources
- Pattern Monster (MIT): https://pattern.monster/
- Hero Patterns (MIT): https://heropatterns.com/
- fffuel: https://www.fffuel.co/
- SVG Silh (CC0): https://svgsilh.com/
- CSS glow galleries: https://devsnap.me/css-glow-effects , https://speckyboy.com/glow-effects-css-javascript/
